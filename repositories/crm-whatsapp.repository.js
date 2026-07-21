import { supabase } from '../js/admin/supabase-client.js';

export class CrmWhatsappRepository {
  /**
   * Obtém a integração ativa da clínica
   */
  static async getIntegration(clinicId) {
    const { data, error } = await supabase
      .from('crm_whatsapp_integrations')
      .select('*')
      .eq('clinic_id', clinicId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return data;
  }

  /**
   * Salva ou atualiza a integração
   */
  static async saveIntegration(payload) {
    // Usando upsert para garantir a unicidade de clinic_id
    const { data, error } = await supabase
      .from('crm_whatsapp_integrations')
      .upsert(payload, { onConflict: 'clinic_id' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Remove (desativa) a integração
   */
  static async toggleIntegration(integrationId, active) {
    const { data, error } = await supabase
      .from('crm_whatsapp_integrations')
      .update({ active })
      .eq('id', integrationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Teste simbólico de conexão
   * Na vida real enviaria um mock request ao backend
   */
  static async testConnection(provider, config) {
    try {
      if (provider === 'MOCK') {
        return { success: true, message: 'Mock conectado com sucesso.' };
      }
      
      if (!config.api_url && provider === 'EVOLUTION') {
        throw new Error('API URL faltando.');
      }
      
      if (!config.access_token_encrypted) {
        throw new Error('Token faltando.');
      }

      // Simulamos a chamada externa que seria feita por Edge Function
      return { success: true, message: 'Conectado.' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  /**
   * Retorna estatísticas sumárias de envio de mensagens para a clínica
   */
  static async getMessageStats(clinicId) {
    const { data: messages, error } = await supabase
      .from('crm_messages')
      .select('status, created_at, error_message')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    
    return {
      lastMessage: messages.length > 0 ? messages[0] : null
    };
  }
}
