import { supabase } from '../js/admin/supabase-client.js';

export class CrmAutomationRepository {
  /**
   * Obtém estatísticas para o dashboard de automações
   */
  static async getDashboardStats(clinicId) {
    // 1. Total e Ativas
    const { data: rules, error: rulesError } = await supabase
      .from('crm_automation_rules')
      .select('id, active')
      .eq('clinic_id', clinicId);

    if (rulesError) throw rulesError;

    const totalRules = rules.length;
    const activeRules = rules.filter(r => r.active).length;

    // 2. Execuções de hoje
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { count: executionsToday, error: execError } = await supabase
      .from('automation_logs')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('created_at', startOfDay.toISOString());

    if (execError) throw execError;

    // 3. Falhas recentes (últimas 24h)
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { count: recentFailures, error: failError } = await supabase
      .from('automation_logs')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('status', 'FAILED')
      .gte('created_at', last24h.toISOString());

    if (failError) throw failError;

    return {
      totalRules,
      activeRules,
      executionsToday: executionsToday || 0,
      recentFailures: recentFailures || 0
    };
  }

  /**
   * Busca as regras de automação
   */
  static async getRules(clinicId) {
    const { data, error } = await supabase
      .from('crm_automation_rules')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Ativa ou desativa uma regra
   */
  static async toggleRule(ruleId, isActive) {
    const { data, error } = await supabase
      .from('crm_automation_rules')
      .update({ active: isActive })
      .eq('id', ruleId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Busca o histórico (logs)
   */
  static async getLogs(clinicId, limit = 100) {
    const { data, error } = await supabase
      .from('automation_logs')
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
