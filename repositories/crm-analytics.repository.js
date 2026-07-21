import { supabase } from '../js/admin/supabase-client.js';

export class CrmAnalyticsRepository {
  /**
   * Retorna os totais de mensagens de hoje (Enviadas, Falhas, Taxa de Entrega)
   */
  static async getTodayMessageStats(clinicId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('crm_messages')
      .select('status')
      .eq('clinic_id', clinicId)
      .gte('created_at', today.toISOString());

    if (error) throw error;

    const total = data.length;
    const sent = data.filter(m => m.status === 'SENT' || m.status === 'DELIVERED').length;
    const failed = data.filter(m => m.status === 'FAILED').length;
    
    let deliveryRate = 0;
    if (total > 0) {
      deliveryRate = Math.round((sent / total) * 100);
    }

    return { total, sent, failed, deliveryRate };
  }

  /**
   * Retorna a contagem de jobs pendentes
   */
  static async getPendingJobsCount(clinicId) {
    const { count, error } = await supabase
      .from('crm_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .in('status', ['pending', 'processing']);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Retorna os erros mais recentes de automação
   */
  static async getRecentErrors(clinicId, limit = 5) {
    const { data, error } = await supabase
      .from('automation_logs')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('status', 'ERROR')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  /**
   * Calcula o tempo médio de processamento (Média entre created_at e processed_at dos jobs completados)
   */
  static async getAverageProcessingTime(clinicId) {
    const { data, error } = await supabase
      .from('crm_jobs')
      .select('created_at, processed_at')
      .eq('clinic_id', clinicId)
      .eq('status', 'completed')
      .not('processed_at', 'is', null)
      .order('processed_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    if (data.length === 0) return 0;

    const totalTimeMs = data.reduce((acc, job) => {
      const created = new Date(job.created_at).getTime();
      const processed = new Date(job.processed_at).getTime();
      return acc + (processed - created);
    }, 0);

    // Retorna em segundos
    return Math.round((totalTimeMs / data.length) / 1000);
  }
}
