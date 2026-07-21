import { supabase } from '../js/admin/supabase-client.js';

export class CrmEventsRepository {
  // Criar novo evento
  static async createEvent(payload) {
    const { data, error } = await supabase.from('crm_events').insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  // Buscar eventos pendentes de processamento
  static async getPendingEvents(clinicId, limit = 50) {
    let query = supabase
      .from('crm_events')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(limit);
      
    if (clinicId) {
      query = query.eq('clinic_id', clinicId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Marcar evento como processado
  static async markProcessed(eventId) {
    const { data, error } = await supabase
      .from('crm_events')
      .update({ processed: true })
      .eq('id', eventId)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }
}
