import { supabase } from './supabase.js';

export class UserService {
  static async getFullUserProfile(authUserId) {
    const { data: userData, error: userError } = await supabase
  .from('usuarios')
  .select(`
      id,
      nome,
      foto,
      clinica_id,
      clinicas(id,nome),
      usuario_cargos(
          cargo_id,
          cargos(nome)
      )
  `)
  .eq('auth_user_id', authUserId)
  .single();

console.log(userData);
console.log(userError);

    if (userError || !userData) {
      throw new Error('Usuário não encontrado na base de dados.');
    }

    const cargoInfo = userData.usuario_cargos?.[0];
    const cargoNome = cargoInfo?.cargos?.nome || 'Sem Cargo';
    const cargoId = cargoInfo?.cargo_id;

    let permissoesSlugs = [];

    if (cargoId) {
      const { data: permData } = await supabase
        .from('cargo_permissoes')
        .select('permissoes ( slug )')
        .eq('cargo_id', cargoId);
      
      if (permData) {
        permissoesSlugs = permData.map(p => p.permissoes.slug);
      }
    }

    const { data: individualPerms } = await supabase
      .from('usuario_permissoes')
      .select('permissoes ( slug )')
      .eq('usuario_id', userData.id);
      
    if (individualPerms) {
      const indSlugs = individualPerms.map(p => p.permissoes.slug);
      permissoesSlugs = [...new Set([...permissoesSlugs, ...indSlugs])];
    }

    return {
      usuario: { id: userData.id, nome: userData.nome, foto: userData.foto },
      clinica: userData.clinicas,
      cargo: cargoNome,
      permissoes: permissoesSlugs
    };
  }
  
  static async logAudit(operacao, registroId = null, detalhes = null) {
     await supabase.from('auditoria').insert({
        tabela: 'sistema',
        operacao: operacao,
        registro_id: registroId,
        valor_novo: detalhes
     });
  }
}
