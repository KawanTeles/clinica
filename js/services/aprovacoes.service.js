import { supabase } from '../supabase.js';
import { SessionService } from '../session.service.js';
import { UserService } from '../user.service.js';
import { NotificacoesService } from './notificacoes.service.js';

export class AprovacoesService {
  /**
   * Busca consultas no status "Solicitada"
   */
  static async getSolicitacoesPendentes(profissionalId = null, periodo = 'todas') {
    const session = SessionService.getSession();
    
    // Status Solicitada ID
    const { data: statusList } = await supabase.from('status_consulta').select('id, nome').eq('nome', 'Solicitada');
    if (!statusList || statusList.length === 0) return [];
    const statusSolicitada = statusList[0].id;

    let query = supabase
      .from('consultas')
      .select(`
        id, data_consulta, hora_inicio, hora_fim, observacoes, criado_em,
        pacientes ( id, nome, telefone ),
        profissionais ( id, nome ),
        especialidades ( id, nome, cor_agenda, valor_padrao )
      `)
      .eq('clinica_id', session.clinica.id)
      .eq('status_id', statusSolicitada)
      .is('deleted_at', null)
      .order('criado_em', { ascending: false });

    // Filtros de RBAC
    if (session.cargo.toLowerCase() === 'profissional') {
      const { data: prof } = await supabase.from('profissionais').select('id').eq('usuario_id', session.id).single();
      if (prof) query = query.eq('profissional_id', prof.id);
    } else if (profissionalId) {
      query = query.eq('profissional_id', profissionalId);
    }

    // Filtro de Data
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];
    
    if (periodo === 'hoje') {
      query = query.eq('data_consulta', hojeStr);
    } else if (periodo === 'amanha') {
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);
      query = query.eq('data_consulta', amanha.toISOString().split('T')[0]);
    } else if (periodo === 'semana') {
      const weekEnd = new Date(hoje);
      weekEnd.setDate(weekEnd.getDate() + 7);
      query = query.gte('data_consulta', hojeStr).lte('data_consulta', weekEnd.toISOString().split('T')[0]);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return data;
  }

  /**
   * Pega os profissionais para o filtro
   */
  static async getProfissionaisFilter() {
    const session = SessionService.getSession();
    const { data, error } = await supabase
      .from('profissionais')
      .select('id, nome, usuario_id')
      .eq('clinica_id', session.clinica.id)
      .is('deleted_at', null)
      .order('nome');
      
    if(error) throw error;
    
    if (session.cargo.toLowerCase() === 'profissional') {
      return data.filter(p => p.usuario_id === session.id);
    }
    
    return data;
  }

  /**
   * Helper para pegar ID do status por nome
   */
  static async _getStatusId(nome) {
    const { data, error } = await supabase.from('status_consulta').select('id').eq('nome', nome).single();
    if(error) throw error;
    return data.id;
  }

  /**
   * Aprovar Consulta
   */
  static async aprovarConsulta(consultaId) {
    const idConfirmada = await this._getStatusId('Confirmada');
    
    const { data, error } = await supabase
      .from('consultas')
      .update({ status_id: idConfirmada, atualizado_em: new Date().toISOString() })
      .eq('id', consultaId)
      .select('paciente_id, profissional_id, especialidade_id, data_consulta, hora_inicio, pacientes(telefone), especialidades(valor_padrao)')
      .single();
      
    if (error) throw error;

    await UserService.logAudit('CONSULTA_APROVADA', consultaId, { acao: 'aprovar' });
    
    // Etapa 13: Criar automaticamente Conta a Receber "Em Aberto"
    try {
      // 1. Busca regra de comissão (se houver)
      let comissao_valor = 0;
      const { data: regra } = await supabase
        .from('comissoes_regras')
        .select('tipo, valor')
        .eq('profissional_id', data.profissional_id)
        .eq('especialidade_id', data.especialidade_id)
        .single();
        
      if (regra) {
        if (regra.tipo === 'FIXO') comissao_valor = regra.valor;
        else if (regra.tipo === 'PERCENTUAL') comissao_valor = (data.especialidades.valor_padrao * regra.valor) / 100;
      }

      await supabase.from('financeiro').insert({
        clinica_id: SessionService.getSession().clinica.id,
        paciente_id: data.paciente_id,
        profissional_id: data.profissional_id,
        consulta_id: consultaId,
        valor_total: data.especialidades.valor_padrao || 0,
        comissao_valor: comissao_valor,
        data_vencimento: data.data_consulta,
        status: 'Em Aberto',
        tipo: 'RECEITA'
      });
      console.log(`[FINANCEIRO] Conta a Receber criada automaticamente. Consulta ID: ${consultaId}`);
    } catch(err) {
      console.error('[FINANCEIRO] Erro ao criar conta a receber:', err);
    }
    
    // Dispara evento interno para Etapa 10 (WhatsApp)
    try {
      if (data.pacientes?.telefone) {
        await NotificacoesService.enqueueMessage({
          paciente_id: data.paciente_id,
          consulta_id: consultaId,
          canal: 'WHATSAPP',
          template_nome: 'consulta_aprovada',
          destinatario: data.pacientes.telefone,
          fallback_conteudo: `Sua consulta para ${data.data_consulta} às ${data.hora_inicio} foi APROVADA.`
        });
      }
    } catch(e) { console.error(e); }
    
    return data;
  }

  /**
   * Recusar Consulta
   */
  static async recusarConsulta(consultaId, motivo, observacoes = '') {
    const idRecusada = await this._getStatusId('Recusada');
    
    const { data, error } = await supabase
      .from('consultas')
      .update({ status_id: idRecusada, atualizado_em: new Date().toISOString() })
      .eq('id', consultaId)
      .select('paciente_id, pacientes(telefone)')
      .single();
      
    if (error) throw error;

    await UserService.logAudit('CONSULTA_RECUSADA', consultaId, { motivo, observacoes });
    
    try {
      if (data.pacientes?.telefone) {
        await NotificacoesService.enqueueMessage({
          paciente_id: data.paciente_id,
          consulta_id: consultaId,
          canal: 'WHATSAPP',
          template_nome: 'consulta_recusada',
          destinatario: data.pacientes.telefone,
          fallback_conteudo: `Infelizmente sua solicitação de consulta foi recusada no momento por indisponibilidade.`
        });
      }
    } catch(e) { console.error(e); }
    
    return data;
  }

  /**
   * Remarcar Consulta (Pedir Remarcação)
   */
  static async solicitarRemarcacao(consultaId, motivo, observacoes = '') {
    const idRemarcada = await this._getStatusId('Remarcada');
    
    const { data, error } = await supabase
      .from('consultas')
      .update({ status_id: idRemarcada, atualizado_em: new Date().toISOString() })
      .eq('id', consultaId)
      .select('paciente_id, pacientes(telefone)')
      .single();
      
    if (error) throw error;

    await UserService.logAudit('CONSULTA_REMARCADA', consultaId, { motivo, observacoes });
    
    try {
      if (data.pacientes?.telefone) {
        await NotificacoesService.enqueueMessage({
          paciente_id: data.paciente_id,
          consulta_id: consultaId,
          canal: 'WHATSAPP',
          template_nome: 'consulta_remarcada',
          destinatario: data.pacientes.telefone,
          fallback_conteudo: `Tivemos um imprevisto e precisamos remarcar sua consulta. Por favor, acesse seu portal para escolher um novo horário.`
        });
      }
    } catch(e) { console.error(e); }
    
    return data;
  }
}
