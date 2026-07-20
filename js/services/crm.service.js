import { supabase } from '../supabase.js';
import { SessionService } from '../session.service.js';
import { UserService } from '../user.service.js';

export class CrmService {

  // ============================================
  // LEADS & FUNIL (KANBAN)
  // ============================================
  static async getLeads() {
    const session = SessionService.getSession();
    const { data, error } = await supabase
      .from('leads')
      .select('*, especialidades(nome), profissionais(nome)')
      .eq('clinica_id', session.clinica.id)
      .is('deleted_at', null)
      .order('criado_em', { ascending: false });

    if (error) throw error;
    return data;
  }

  static async moverLead(leadId, novoStatus) {
    const { error } = await supabase
      .from('leads')
      .update({ status: novoStatus })
      .eq('id', leadId);
    
    if (error) throw error;
    await UserService.logAudit('LEAD_MOVIDO', leadId, { novoStatus });
  }

  static async converterLeadEmPaciente(leadId, pacienteId) {
    const { error } = await supabase
      .from('leads')
      .update({ status: 'Convertido', paciente_convertido_id: pacienteId })
      .eq('id', leadId);
      
    if (error) throw error;
    await UserService.logAudit('LEAD_CONVERTIDO', leadId, { pacienteId });
  }

  // ============================================
  // PACIENTES (360° VIEW & LISTING)
  // ============================================
  static async searchGlobal(termo) {
    const session = SessionService.getSession();
    // Busca flexível: nome, cpf, telefone ou email
    const { data, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('clinica_id', session.clinica.id)
      .is('deleted_at', null)
      .or(`nome.ilike.%${termo}%,cpf.ilike.%${termo}%,telefone.ilike.%${termo}%,email.ilike.%${termo}%`)
      .limit(20);

    if (error) throw error;
    return data;
  }

  static async getPaciente360(pacienteId) {
    const session = SessionService.getSession();
    
    // 1. Dados Básicos do Paciente
    const { data: paciente, error } = await supabase
      .from('pacientes')
      .select('*')
      .eq('id', pacienteId)
      .eq('clinica_id', session.clinica.id)
      .single();
    if (error) throw error;

    // 2. Histórico Clínico Administrativo (Consultas)
    const { data: consultas } = await supabase
      .from('consultas')
      .select('*, profissionais(nome), especialidades(nome, valor_padrao), status_consulta(nome)')
      .eq('paciente_id', pacienteId)
      .is('deleted_at', null)
      .order('data_consulta', { ascending: false });

    // 3. Comunicação (Notificações)
    const { data: notificacoes } = await supabase
      .from('notificacoes_fila')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('criado_em', { ascending: false });

    // 4. LGPD
    const { data: lgpd } = await supabase
      .from('pacientes_consentimento')
      .select('*')
      .eq('paciente_id', pacienteId)
      .single();

    // 5. Observações Privadas
    const { data: obs } = await supabase
      .from('pacientes_observacoes')
      .select('*, usuarios(nome)')
      .eq('paciente_id', pacienteId)
      .order('fixado', { ascending: false })
      .order('criado_em', { ascending: false });

    // Sumarização Financeira (Baseada nas consultas)
    let totalFaturado = 0;
    consultas?.forEach(c => {
      // Simulação financeira. Etapa 13 cuidará disso nativamente.
      if (c.status_consulta?.nome === 'Confirmada') {
        totalFaturado += (c.especialidades?.valor_padrao || 0);
      }
    });

    return {
      paciente,
      consultas: consultas || [],
      notificacoes: notificacoes || [],
      lgpd: lgpd || { aceita_whatsapp: false, aceita_email: false },
      observacoes: obs || [],
      kpis: {
        totalConsultas: consultas?.length || 0,
        totalFaturado
      }
    };
  }

  static async addObservacao(pacienteId, conteudo, fixado = false) {
    const session = SessionService.getSession();
    const { error } = await supabase
      .from('pacientes_observacoes')
      .insert({
        paciente_id: pacienteId,
        clinica_id: session.clinica.id,
        autor_id: session.id,
        conteudo,
        fixado
      });
      
    if (error) throw error;
    await UserService.logAudit('OBSERVACAO_CRIADA', pacienteId, { conteudo: conteudo.substring(0, 50) });
  }
}
