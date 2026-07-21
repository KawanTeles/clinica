import { supabase } from '../js/admin/supabase-client.js';

export class CrmJobsRepository {
  /**
   * Cria um novo job manualmente (embora a maior parte venha da trigger)
   */
  static async createJob(payload) {
    const { data, error } = await supabase.from('crm_jobs').insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  /**
   * Busca jobs pendentes para execução que já estão no momento ou passaram da hora agendada.
   * Também busca jobs travados em 'processing' por mais de 10 minutos (Timeout fallback).
   */
  static async getPendingJobs(limit = 20) {
    const now = new Date().toISOString();
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('crm_jobs')
      .select('*, crm_automation_rules(*), crm_events(*)')
      .or(`and(status.eq.pending,scheduled_at.lte.${now}),and(status.eq.processing,updated_at.lte.${tenMinsAgo})`)
      .order('scheduled_at', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  /**
   * Atualiza status do job, útil para setar 'processing' (lock pessimista simples)
   */
  static async updateStatus(jobId, status) {
    const { data, error } = await supabase
      .from('crm_jobs')
      .update({ status })
      .eq('id', jobId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  /**
   * Marca o job como finalizado com sucesso
   */
  static async markCompleted(jobId, currentAttempts) {
    const { data, error } = await supabase
      .from('crm_jobs')
      .update({ 
        status: 'completed', 
        processed_at: new Date().toISOString(),
        attempts: (currentAttempts || 0) + 1
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Registra falha e controla política de retry (máximo 3 tentativas)
   */
  static async markFailed(jobId, errorMessage, currentAttempts) {
    const attempts = (currentAttempts || 0) + 1;
    const status = attempts >= 3 ? 'failed' : 'pending';
    
    const updateData = {
        attempts,
        error_message: errorMessage
    };

    if (status === 'failed') {
        updateData.status = 'failed';
        updateData.processed_at = new Date().toISOString();
    } else {
        updateData.status = 'pending';
        // Agendar para daqui a 1 minuto no retry
        const nextTime = new Date();
        nextTime.setMinutes(nextTime.getMinutes() + 1);
        updateData.scheduled_at = nextTime.toISOString();
    }

    const { data, error } = await supabase
      .from('crm_jobs')
      .update(updateData)
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
