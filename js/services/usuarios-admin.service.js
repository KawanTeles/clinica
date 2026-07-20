import { supabase } from '../supabase.js';
import { SessionService } from '../session.service.js';
import { UserService } from '../user.service.js';

export class UsuariosAdminService {
  /**
   * Busca os usuários da mesma clínica
   */
  static async listUsuarios() {
    const session = SessionService.getSession();
    const { data, error } = await supabase
      .from('usuarios')
      .select(`
        id, nome, email, foto, status, ultimo_login, criado_em,
        usuario_cargos ( cargos ( nome ) )
      `)
      .eq('clinica_id', session.clinica.id)
      .is('deleted_at', null)
      .order('criado_em', { ascending: false });
      
    if (error) throw error;
    return data;
  }

  /**
   * Convida usuário disparando e-mail do Supabase Auth
   * O frontend não deve ter a Service Role Key, então invocamos uma Edge Function.
   */
  static async inviteUsuario(payload) {
    const session = SessionService.getSession();
    
    // A Function usará admin.inviteUserByEmail e inserirá na tabela `usuarios`
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: {
        email: payload.email,
        nome: payload.nome,
        telefone: payload.telefone,
        cargo_id: payload.cargo_id,
        permissoes_extras: payload.permissoes,
        clinica_id: session.clinica.id
      }
    });
    
    if (error) throw error;
    
    await UserService.logAudit('USUARIO_CRIADO_CONVITE', data.usuario_id, payload);
    return data;
  }

  /**
   * Soft Delete - Desativa usuário sem deletar rastros financeiros/histórico
   */
  static async softDeleteUsuario(usuarioId) {
    const session = SessionService.getSession();
    if (session.id === usuarioId) {
      throw new Error("Ação bloqueada de segurança: Você não pode deletar a própria conta ativa.");
    }
    
    // Além de inativar na tabela, precisaria chamar edge function para suspender no Auth (admin.updateUserByEmail)
    // Para efeito de UI, marcamos status e deleted_at.
    const { data, error } = await supabase
      .from('usuarios')
      .update({ deleted_at: new Date().toISOString(), status: 'Inativo' })
      .eq('id', usuarioId)
      .select();
      
    if (error) throw error;
    
    await UserService.logAudit('USUARIO_DESATIVADO', usuarioId, { acao: 'Soft Delete' });
    return data;
  }
}
