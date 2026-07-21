import { supabase } from '../js/admin/supabase-client.js';

export class CrmMessagesRepository {
  /**
   * Busca um template ativo pelo evento e clínica
   */
  static async getTemplateByEvent(clinicId, triggerEvent) {
    const { data, error } = await supabase
      .from('crm_message_templates')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('trigger_event', triggerEvent)
      .eq('active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = Nenhum registro encontrado (single row)
    return data;
  }

  /**
   * Cria uma nova mensagem (invocando a função segura RPC)
   */
  static async createMessage(payload) {
    const { data: messageId, error } = await supabase.rpc('create_crm_message', {
      p_clinic_id: payload.clinic_id,
      p_patient_id: payload.patient_id,
      p_channel: payload.channel,
      p_provider: payload.provider,
      p_direction: payload.direction || 'OUTBOUND',
      p_template_id: payload.template_id,
      p_content: payload.content,
      p_status: payload.status || 'PENDING',
      p_error_message: payload.error_message || null
    });

    if (error) throw error;
    return messageId;
  }

  /**
   * Atualiza o status de uma mensagem
   */
  static async updateMessageStatus(messageId, status, errorMessage = null) {
    const { data, error } = await supabase
      .from('crm_messages')
      .update({
        status,
        error_message: errorMessage,
        sent_at: status === 'SENT' || status === 'DELIVERED' ? new Date().toISOString() : undefined
      })
      .eq('id', messageId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Retorna o histórico de mensagens
   */
  static async getHistory(clinicId, limit = 100) {
    const { data, error } = await supabase
      .from('crm_messages')
      .select(`
        *,
        patients:patient_id(nome)
      `)
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }
}
