import { supabase } from '../js/admin/supabase-client.js';

export class CrmRepository {
  /**
   * ==========================================
   * Pipeline (Funil de Vendas)
   * ==========================================
   */
  
  // Listar pipeline por clínica
  static async getPipeline(clinicId) {
    let query = supabase.from('crm_pipeline').select('*, patients(nome, email, telefone)');
    if (clinicId) query = query.eq('clinic_id', clinicId);
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Criar oportunidade/paciente no pipeline
  static async createOpportunity(payload) {
    const { data, error } = await supabase.from('crm_pipeline').insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  // Atualizar estágio do pipeline
  static async updatePipelineStage(id, stage) {
    const { data, error } = await supabase.from('crm_pipeline').update({ stage }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  // Atualizar prioridade
  static async updatePipelinePriority(id, priority) {
    const { data, error } = await supabase.from('crm_pipeline').update({ priority }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }


  /**
   * ==========================================
   * Tarefas
   * ==========================================
   */
  
  // Listar tarefas
  static async getTasks(clinicId, patientId) {
    let query = supabase.from('crm_tasks').select('*').order('due_date', { ascending: true });
    if (clinicId) query = query.eq('clinic_id', clinicId);
    if (patientId) query = query.eq('patient_id', patientId);
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Criar tarefa
  static async createTask(payload) {
    const { data, error } = await supabase.from('crm_tasks').insert(payload).select().single();
    if (error) throw error;
    
    // Disparar evento
    import('./crm-events.repository.js').then(module => {
      module.CrmEventsRepository.createEvent({
        clinic_id: data.clinic_id,
        patient_id: data.patient_id,
        event_type: 'TASK_CREATED',
        event_source: 'crm_repository',
        payload: { task_id: data.id }
      }).catch(e => console.warn('Erro não-crítico ao salvar evento TASK_CREATED:', e));
    });

    return data;
  }

  // Atualizar status
  static async updateTaskStatus(id, status) {
    const { data, error } = await supabase.from('crm_tasks').update({ status }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  // Atribuir responsável
  static async assignTask(id, userId) {
    const { data, error } = await supabase.from('crm_tasks').update({ assigned_to: userId }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }


  /**
   * ==========================================
   * Interações (Histórico)
   * ==========================================
   */
  
  // Listar histórico
  static async getInteractions(patientId) {
    let query = supabase.from('crm_interactions').select('*').order('created_at', { ascending: false });
    if (patientId) query = query.eq('patient_id', patientId);
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Criar interação
  static async createInteraction(payload) {
    const { data, error } = await supabase.from('crm_interactions').insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  /**
   * ==========================================
   * Gerenciamento de Pacientes (Leads)
   * ==========================================
   */

  // Buscar paciente por contato
  static async findPatientByContact(email, phone, clinicId) {
    if (!email && !phone) return null;
    
    let query = supabase.from('patients').select('id, nome, email, telefone').eq('clinic_id', clinicId);
    
    if (email && phone) {
      query = query.or(`email.eq.${email},telefone.eq.${phone}`);
    } else if (email) {
      query = query.eq('email', email);
    } else if (phone) {
      query = query.eq('telefone', phone);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data.length > 0 ? data[0] : null;
  }

  // Buscar paciente por ID
  static async getPatientById(patientId) {
    const { data, error } = await supabase
      .from('patients')
      .select('id, nome, email, telefone')
      .eq('id', patientId)
      .single();
    if (error) throw error;
    return data;
  }

  // Criar paciente
  static async createPatient(payload) {
    const { data, error } = await supabase.from('patients').insert(payload).select().single();
    if (error) throw error;
    return data;
  }
}
