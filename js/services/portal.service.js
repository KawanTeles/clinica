import { supabase } from '../supabase.js';
import { NotificacoesService } from './notificacoes.service.js';

export class PortalService {
  
  static getPortalSession() {
    const sessionStr = localStorage.getItem('zoe_portal_session');
    if (!sessionStr) return null;
    return JSON.parse(sessionStr);
  }

  static async authenticateWithToken(tokenStr) {
    // 1. Busca token no banco
    const { data: tokenObj, error } = await supabase
      .from('portal_tokens')
      .select('*, pacientes(id, nome, telefone)')
      .eq('token', tokenStr)
      .eq('usado', false)
      .gte('expira_em', new Date().toISOString())
      .single();

    if (error || !tokenObj) throw new Error('Token inválido ou expirado.');

    // 2. Marca como usado (se for uso único)
    await supabase.from('portal_tokens').update({ usado: true }).eq('id', tokenObj.id);

    // 3. Cria Sessão Local do Portal (Diferente do CRM)
    const session = {
      paciente: tokenObj.pacientes,
      clinica_id: tokenObj.clinica_id,
      expira_em: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 horas de sessão
    };
    
    localStorage.setItem('zoe_portal_session', JSON.stringify(session));
    return session;
  }

  static logout() {
    localStorage.removeItem('zoe_portal_session');
    window.location.href = './login.html';
  }

  /**
   * Busca as consultas futuras do paciente
   */
  static async getProximosAgendamentos() {
    const session = this.getPortalSession();
    if (!session) this.logout();

    const hoje = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('consultas')
      .select(`
        id, data_consulta, hora_inicio, hora_fim, status_id, status_consulta(nome), observacoes,
        profissionais(nome), especialidades(nome, valor_padrao, cor_agenda)
      `)
      .eq('paciente_id', session.paciente.id)
      .gte('data_consulta', hoje)
      .is('deleted_at', null)
      .order('data_consulta', { ascending: true })
      .order('hora_inicio', { ascending: true });

    if (error) throw error;
    return data;
  }

  /**
   * Busca histórico passado
   */
  static async getHistorico() {
    const session = this.getPortalSession();
    const hoje = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('consultas')
      .select(`
        id, data_consulta, hora_inicio, status_consulta(nome),
        profissionais(nome), especialidades(nome)
      `)
      .eq('paciente_id', session.paciente.id)
      .lt('data_consulta', hoje)
      .is('deleted_at', null)
      .order('data_consulta', { ascending: false })
      .limit(20);

    if (error) throw error;
    return data;
  }

  /**
   * Paciente Solicita Remarcação (Etapa 9: Vai para "Remarcação Solicitada")
   */
  static async solicitarRemarcacao(consultaId) {
    const session = this.getPortalSession();
    const { data: status } = await supabase.from('status_consulta').select('id').eq('nome', 'Remarcação Solicitada').single();
    
    const { error } = await supabase
      .from('consultas')
      .update({ status_id: status.id, atualizado_em: new Date().toISOString() })
      .eq('id', consultaId)
      .eq('paciente_id', session.paciente.id);

    if (error) throw error;

    // Dispara Evento de Notificação
    await NotificacoesService.enqueueMessage({
      paciente_id: session.paciente.id,
      consulta_id: consultaId,
      canal: 'WHATSAPP',
      template_nome: 'consulta_remarcada_paciente',
      destinatario: session.paciente.telefone,
      fallback_conteudo: `Sua solicitação de remarcação foi recebida e seu horário anterior liberado.`
    });

    // Simulando auditoria - Em prod chamaria uma view/function
    this._logPortalAudit('PACIENTE_SOLICITOU_REMARCACAO', consultaId);
  }

  /**
   * Paciente Cancela Consulta
   */
  static async cancelarConsulta(consultaId) {
    const session = this.getPortalSession();
    const { data: status } = await supabase.from('status_consulta').select('id').eq('nome', 'Cancelada').single();
    
    const { error } = await supabase
      .from('consultas')
      .update({ status_id: status.id, atualizado_em: new Date().toISOString() })
      .eq('id', consultaId)
      .eq('paciente_id', session.paciente.id);

    if (error) throw error;

    // Dispara Evento de Notificação
    await NotificacoesService.enqueueMessage({
      paciente_id: session.paciente.id,
      consulta_id: consultaId,
      canal: 'WHATSAPP',
      template_nome: 'consulta_cancelada_paciente',
      destinatario: session.paciente.telefone,
      fallback_conteudo: `Confirmamos o cancelamento da sua consulta.`
    });

    this._logPortalAudit('PACIENTE_CANCELOU_CONSULTA', consultaId);
  }

  /**
   * Paciente Confirma Presença
   */
  static async confirmarPresenca(consultaId, resposta) {
    // resposta: 'sim', 'nao_sei'
    // Não altera status da consulta (status já é Confirmada), apenas registra no histórico/auditoria para o CRM ver.
    const session = this.getPortalSession();
    
    this._logPortalAudit('PACIENTE_CONFIRMOU_PRESENCA', consultaId, { resposta });
    
    await NotificacoesService.enqueueMessage({
      paciente_id: session.paciente.id,
      consulta_id: consultaId,
      canal: 'WHATSAPP',
      template_nome: 'confirmacao_presenca_recebida',
      destinatario: session.paciente.telefone,
      fallback_conteudo: `Obrigado por responder! Sua presença foi atualizada em nosso sistema.`
    });
  }

  /**
   * LGPD / Preferências
   */
  static async getPreferencias() {
    const session = this.getPortalSession();
    const { data } = await supabase
      .from('pacientes_consentimento')
      .select('*')
      .eq('paciente_id', session.paciente.id)
      .single();
    return data || { aceita_whatsapp: false, aceita_email: false };
  }

  static async updatePreferencias(prefs) {
    const session = this.getPortalSession();
    const { error } = await supabase
      .from('pacientes_consentimento')
      .upsert({
        paciente_id: session.paciente.id,
        clinica_id: session.clinica_id,
        aceita_whatsapp: prefs.whatsapp,
        aceita_email: prefs.email
      }, { onConflict: 'paciente_id' });
    if(error) throw error;
  }

  // Mock Auditoria
  static async _logPortalAudit(evento, consultaId, metadata = {}) {
    const session = this.getPortalSession();
    try {
      await supabase.from('auditoria_logs').insert({
        clinica_id: session.clinica_id,
        evento: evento,
        tabela: 'consultas',
        registro_id: consultaId,
        metadata: { ...metadata, origem: 'PORTAL_CLIENTE' }
      });
    } catch(e) { console.error('Auditoria Falhou', e); }
  }
}
