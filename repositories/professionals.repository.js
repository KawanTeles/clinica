import { supabase } from '../js/admin/supabase-client.js';

export class ProfessionalsRepository {
  /**
   * Lista todos os profissionais ativos/inativos da clínica atual.
   */
  static async listProfessionals() {
    const { data, error } = await supabase
      .from('professionals')
      .select(`
        id, nome, especialidade, registro_profissional, telefone, 
        whatsapp, ativo, valor_avista, valor_cartao
      `)
      .order('nome', { ascending: true });
      
    if (error) throw error;
    return data;
  }

  /**
   * Cria um profissional junto com a sua conta de usuário (Auth).
   * Requer que o chamador seja ADMIN (verificado via RPC no Supabase).
   */
  static async createProfessional(payload) {
    // Como a migration 029 definiu a RPC 'admin_create_professional', usamos ela
    const { data, error } = await supabase.rpc('admin_create_professional', {
      p_email: payload.email,
      p_password: payload.password,
      p_nome: payload.nome,
      p_telefone: payload.telefone,
      p_whatsapp: payload.whatsapp,
      p_especialidade: payload.especialidade,
      p_registro_profissional: payload.registro_profissional,
      p_valor_avista: parseFloat(payload.valor_avista || 0),
      p_valor_cartao: parseFloat(payload.valor_cartao || 0),
      p_horarios: payload.horarios || [],
      p_dias: payload.dias || []
    });

    if (error) throw error;
    return data;
  }

  /**
   * Busca um profissional pelo ID.
   */
  static async getProfessionalById(id) {
    const { data, error } = await supabase
      .from('professionals')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error) throw error;
    return data;
  }

  /**
   * Atualiza dados de um profissional existente.
   */
  static async updateProfessional(id, payload) {
    const { data, error } = await supabase
      .from('professionals')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  /**
   * Ativa ou desativa um profissional (Soft Delete).
   */
  static async toggleStatus(id, isActive) {
    const { data, error } = await supabase
      .from('professionals')
      .update({ ativo: isActive })
      .eq('id', id)
      .select('id, ativo')
      .single();
      
    if (error) throw error;
    return data;
  }
}
