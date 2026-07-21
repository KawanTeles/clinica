import { supabase } from '../js/admin/supabase-client.js';

export class CrmAutomationRulesRepository {
  
  // Buscar regras ativas (ou todas se activeOnly = false)
  static async getRules(clinicId, triggerEvent = null, activeOnly = true) {
    let query = supabase.from('crm_automation_rules').select('*');
    
    if (clinicId) query = query.eq('clinic_id', clinicId);
    if (activeOnly) query = query.eq('active', true);
    if (triggerEvent) query = query.eq('trigger_event', triggerEvent);
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  // Criar nova regra
  static async createRule(payload) {
    const { data, error } = await supabase.from('crm_automation_rules').insert(payload).select().single();
    if (error) throw error;
    return data;
  }

  // Atualizar regra
  static async updateRule(id, payload) {
    const { data, error } = await supabase.from('crm_automation_rules').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  // Ativar / Desativar regra
  static async toggleRule(id, isActive) {
    const { data, error } = await supabase.from('crm_automation_rules').update({ active: isActive }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  // Registrar Log de Automação via Função Segura (SECURITY DEFINER)
  static async createAutomationLog(payload) {
    const { error } = await supabase.rpc('create_automation_log', {
      p_patient_id: payload.patient_id,
      p_professional_id: payload.professional_id || null,
      p_event: payload.event,
      p_status: payload.status,
      p_payload: payload.payload
    });
    if (error) throw error;
    return true;
  }
}
