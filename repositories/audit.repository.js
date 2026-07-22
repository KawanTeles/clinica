import { getSupabaseClient } from '../supabase-client.js';

export const AuditRepository = {
  /**
   * Registra manualmente uma ação no log de auditoria
   * Utilizado para eventos de negócio que não geram gatilhos (triggers) ou que precisam de descrições ricas.
   */
  async logAction(action, entityType, description) {
    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return { error: new Error('Não autenticado') };
      
      // Tentar obter clinic_id do JWT ou usar uma default (caso não consiga ler)
      let clinicId = null;
      try {
        clinicId = session.user.user_metadata?.clinic_id;
      } catch (e) {}

      const { data, error } = await supabase
        .from('audit_logs')
        .insert([{
          action: action,
          entity_type: entityType,
          description: description,
          changed_by: session.user.id,
          clinic_id: clinicId,
          entity_id: session.user.id // placeholder se não tiver entity afetado
        }])
        .select()
        .single();
        
      if (error) {
        console.error('Audit Log Error:', error);
        return { error };
      }
      return { data };
    } catch (err) {
      console.error('Audit Log Exception:', err);
      return { error: err };
    }
  },

  /**
   * Busca os logs da clínica atual (Bloqueado por RLS para não-admins)
   */
  async getLogs(filters = {}) {
    try {
      const supabase = getSupabaseClient();
      let query = supabase
        .from('audit_logs')
        .select(`
          id,
          action,
          entity_type,
          description,
          created_at,
          changed_by,
          user_profiles!changed_by ( nome, role_id ),
          roles:user_profiles!changed_by ( roles (nome) )
        `)
        .order('created_at', { ascending: false })
        .limit(filters.limit || 50);

      if (filters.entity_type && filters.entity_type !== 'all') {
        query = query.eq('entity_type', filters.entity_type);
      }
      if (filters.action && filters.action !== 'all') {
        query = query.eq('action', filters.action);
      }
      if (filters.start_date) {
        query = query.gte('created_at', filters.start_date);
      }
      if (filters.end_date) {
        // adiciona 23:59:59 ao endDate para fechar o dia
        const end = new Date(filters.end_date);
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }

      const { data, error } = await query;
      
      if (error) {
        return { error, data: null };
      }

      // Normaliza os dados (os joins com user_profiles e roles vêm aninhados)
      const logs = data.map(log => {
        let userName = 'Sistema / Automático';
        let roleName = '-';
        if (log.user_profiles) {
          userName = log.user_profiles.nome || userName;
        }
        if (log.roles && log.roles.roles && log.roles.roles.nome) {
           roleName = log.roles.roles.nome;
        }

        return {
          id: log.id,
          action: log.action,
          module: log.entity_type,
          description: log.description || `Alteração em ${log.entity_type}`,
          date: new Date(log.created_at).toLocaleString('pt-BR'),
          userName: userName,
          roleName: roleName
        };
      });

      return { data: logs, error: null };
    } catch (err) {
      console.error('Audit getLogs Exception:', err);
      return { error: err, data: null };
    }
  }
};
