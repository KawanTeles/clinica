import { supabase } from '../supabase.js';
import { SessionService } from '../session.service.js';
import { UserService } from '../user.service.js';

export class ProfissionaisService {
  /**
   * Lista todos os profissionais ativos da clínica logada
   */
  static async listProfissionais() {
    const session = SessionService.getSession();
    const { data, error } = await supabase
      .from('profissionais')
      .select(`
        id, nome, email, foto, status, registro_conselho, telefone, whatsapp,
        profissional_especialidade ( especialidades ( nome ) )
      `)
      .eq('clinica_id', session.clinica.id)
      .is('deleted_at', null)
      .order('nome', { ascending: true });
      
    if (error) throw error;
    return data;
  }

  /**
   * Busca os dados completos para a página de Perfil do Profissional
   */
  static async getProfissional(id) {
    const session = SessionService.getSession();
    const { data, error } = await supabase
      .from('profissionais')
      .select(`
        *,
        usuarios ( id, email, status ),
        profissional_especialidade ( especialidades ( id, nome ) )
      `)
      .eq('id', id)
      .eq('clinica_id', session.clinica.id)
      .single();
      
    if (error) throw error;
    return data;
  }

  /**
   * Soft Delete do Profissional
   */
  static async softDeleteProfissional(id) {
    const { data, error } = await supabase
      .from('profissionais')
      .update({ deleted_at: new Date().toISOString(), status: 'Inativo' })
      .eq('id', id)
      .select();
      
    if (error) throw error;
    
    await UserService.logAudit('PROFISSIONAL_DESATIVADO', id, { acao: 'Soft Delete' });
    return data;
  }

  /**
   * Salva as configurações de Agenda do Profissional (Etapa 8 preview)
   */
  static async saveAgendaConfig(profissionalId, configs) {
    // Integração futura garantida
    return true;
  }
}
