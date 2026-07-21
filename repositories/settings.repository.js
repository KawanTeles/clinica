import { supabase } from '../js/admin/supabase-client.js';

export class SettingsRepository {
  static async getSettings(clinicId) {
    const { data, error } = await supabase
      .from('clinics')
      .select(`
        nome,
        logo_url,
        telefone,
        whatsapp,
        email,
        endereco,
        cidade,
        estado,
        informacoes_publicas,
        dias_atendimento,
        horario_abertura,
        horario_fechamento,
        intervalo_inicio,
        intervalo_fim
      `)
      .eq('id', clinicId)
      .single();

    if (error) throw error;
    return data;
  }

  static async updateSettings(clinicId, payload) {
    const { data, error } = await supabase
      .from('clinics')
      .update(payload)
      .eq('id', clinicId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getActiveUsers(clinicId) {
    // Busca perfis de usuario ativos ligados à clínica, com nome das roles
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        id,
        nome,
        email,
        ativo,
        roles ( nome )
      `)
      .eq('clinic_id', clinicId)
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) throw error;
    return data;
  }

  static async getIntegrations(clinicId) {
    // Opcional se houver tabela de integracao whatsapp
    const { data, error } = await supabase
      .from('crm_whatsapp_integrations')
      .select('*')
      .eq('clinic_id', clinicId)
      .single();
    
    // Retorna null sem lançar erro se não existir ainda
    return data || null; 
  }
}
