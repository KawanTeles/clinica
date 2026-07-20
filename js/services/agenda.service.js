import { supabase } from '../supabase.js';
import { SessionService } from '../session.service.js';
import { EspecialidadesService } from './especialidades.service.js';
import { UserService } from '../user.service.js';
import { NotificacoesService } from './notificacoes.service.js';

export class AgendaService {
  /**
   * Obtém a lista de consultas
   * Respeita RBAC: Se não for recepcionista/owner, pega só as próprias
   */
  static async listAppointments(startDate, endDate, profissionalId = null) {
    const session = SessionService.getSession();
    
    let query = supabase
      .from('consultas')
      .select(`
        id, data_consulta, hora_inicio, hora_fim, status_id, observacoes,
        pacientes ( id, nome, telefone ),
        profissionais ( id, nome ),
        especialidades ( id, nome, cor_agenda, tempo_padrao ),
        status_consulta ( nome )
      `)
      .eq('clinica_id', session.clinica.id)
      .is('deleted_at', null)
      .gte('data_consulta', startDate)
      .lte('data_consulta', endDate);
      
    // RBAC: Se o usuário logado for Profissional (sem acesso visual geral), filtra por ele
    if (session.cargo.toLowerCase() === 'profissional') {
      const { data: prof } = await supabase.from('profissionais').select('id').eq('usuario_id', session.id).single();
      if (prof) query = query.eq('profissional_id', prof.id);
    } else if (profissionalId) {
      // Filtro da UI
      query = query.eq('profissional_id', profissionalId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /**
   * Obtém listas para o modal
   */
  static async getModalData() {
    const session = SessionService.getSession();
    
    const [resPacientes, resProfissionais, resEspecialidades] = await Promise.all([
      supabase.from('pacientes').select('id, nome, cpf').eq('clinica_id', session.clinica.id).is('deleted_at', null).order('nome'),
      supabase.from('profissionais').select('id, nome, usuario_id').eq('clinica_id', session.clinica.id).is('deleted_at', null).order('nome'),
      supabase.from('especialidades').select('id, nome, tempo_padrao, intervalo_recomendado').eq('clinica_id', session.clinica.id).is('deleted_at', null).order('nome')
    ]);

    // Filtrar profissionais baseado em RBAC
    let profissionais = resProfissionais.data || [];
    if (session.cargo.toLowerCase() === 'profissional') {
      profissionais = profissionais.filter(p => p.usuario_id === session.id);
    }

    return {
      pacientes: resPacientes.data || [],
      profissionais: profissionais,
      especialidades: resEspecialidades.data || []
    };
  }

  /**
   * Utilitários de tempo
   */
  static _timeToMins(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  static _minsToTime(mins) {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  /**
   * Motor Inteligente de Slots: Calcula disponibilidade real de um dia
   */
  static async getAvailableSlots(profissionalId, dataStr, especialidadeId) {
    // Validação básica
    if (!profissionalId || !dataStr || !especialidadeId) return [];

    const dateObj = new Date(dataStr + 'T12:00:00Z'); // Evitar timezone issues
    const diaSemana = dateObj.getUTCDay(); // 0 = Domingo, 6 = Sábado

    // 1. Busca configurações bases do Profissional (horário de trabalho)
    const { data: configList } = await supabase
      .from('agenda_config')
      .select('*')
      .eq('profissional_id', profissionalId)
      .eq('dia_semana', diaSemana);
      
    if (!configList || configList.length === 0) {
      return []; // Não atende neste dia da semana
    }
    const config = configList[0]; // Pega o primeiro (normalmente 1 por dia)

    // 2. Busca regras da Especialidade (Duração + Intervalo)
    const { data: especialidade } = await supabase
      .from('especialidades')
      .select('tempo_padrao, intervalo_recomendado')
      .eq('id', especialidadeId)
      .single();

    if (!especialidade) return [];

    const duracaoMins = this._timeToMins(especialidade.tempo_padrao);
    const intervaloMins = this._timeToMins(especialidade.intervalo_recomendado) || 0;
    const stepMins = duracaoMins + intervaloMins;

    // 3. Busca Exceções Recorrentes e Bloqueios Temporários
    const { data: excecoes } = await supabase
      .from('agenda_excecoes')
      .select('*')
      .or(`profissional_id.eq.${profissionalId},profissional_id.is.null`);

    // Avalia se há bloqueio total para o dia
    let bloqueioTotal = false;
    let bloqueiosParciais = [];
    if (excecoes && excecoes.length > 0) {
      for (const exc of excecoes) {
        let aplica = false;
        if (exc.tipo === 'DATA_ESPECIFICA' && exc.parametro === dataStr) aplica = true;
        if (exc.tipo === 'SEMANAL' && exc.parametro === diaSemana.toString()) aplica = true;
        // MENSAL_DIA_SEMANA seria mais complexo, simplificado para o exemplo
        
        if (aplica) {
          if (exc.bloqueio_total) {
            bloqueioTotal = true;
            break;
          } else {
            bloqueiosParciais.push({
              inicio: this._timeToMins(exc.hora_inicio),
              fim: this._timeToMins(exc.hora_fim)
            });
          }
        }
      }
    }
    
    if (bloqueioTotal) return [];

    // 4. Busca consultas já marcadas no dia (não canceladas/recusadas)
    const { data: ocupados } = await supabase
      .from('consultas')
      .select('hora_inicio, hora_fim')
      .eq('profissional_id', profissionalId)
      .eq('data_consulta', dataStr)
      .not('status_id', 'in', `(SELECT id FROM status_consulta WHERE nome IN ('Cancelada', 'Recusada', 'Não compareceu'))`);

    if (ocupados) {
      ocupados.forEach(c => {
        bloqueiosParciais.push({
          inicio: this._timeToMins(c.hora_inicio),
          fim: this._timeToMins(c.hora_fim)
        });
      });
    }

    // 5. Geração e filtragem de Slots
    let startDayMins = this._timeToMins(config.hora_inicio);
    let endDayMins = this._timeToMins(config.hora_fim);
    let almoçoInicioMins = config.intervalo_inicio ? this._timeToMins(config.intervalo_inicio) : null;
    let almoçoFimMins = config.intervalo_fim ? this._timeToMins(config.intervalo_fim) : null;

    const slots = [];
    let curr = startDayMins;

    while (curr + duracaoMins <= endDayMins) {
      let slotInicio = curr;
      let slotFim = curr + duracaoMins;
      
      // Checa colisão com almoço
      let conflitoAlmoco = false;
      if (almoçoInicioMins !== null && almoçoFimMins !== null) {
        if ((slotInicio >= almoçoInicioMins && slotInicio < almoçoFimMins) || 
            (slotFim > almoçoInicioMins && slotFim <= almoçoFimMins) ||
            (slotInicio <= almoçoInicioMins && slotFim >= almoçoFimMins)) {
          conflitoAlmoco = true;
        }
      }

      // Checa colisão com consultas e exceções
      let conflitoAgenda = false;
      for (const blq of bloqueiosParciais) {
        if ((slotInicio >= blq.inicio && slotInicio < blq.fim) || 
            (slotFim > blq.inicio && slotFim <= blq.fim) ||
            (slotInicio <= blq.inicio && slotFim >= blq.fim)) {
          conflitoAgenda = true;
          break;
        }
      }

      if (!conflitoAlmoco && !conflitoAgenda) {
        slots.push({
          hora: this._minsToTime(slotInicio),
          horaFim: this._minsToTime(slotFim),
          disponivel: true
        });
      }

      curr += stepMins;
    }

    return slots;
  }

  /**
   * Criar agendamento (Fluxo obrigatório: nasce como Solicitada)
   */
  static async createAppointment(payload) {
    const session = SessionService.getSession();
    
    // Buscar ID do status "Solicitada"
    const { data: statusList } = await supabase.from('status_consulta').select('id, nome').eq('nome', 'Solicitada');
    if (!statusList || statusList.length === 0) throw new Error('Status "Solicitada" não encontrado no banco de dados.');
    const statusSolicitada = statusList[0].id;

    // Inserção - a trigger de banco ou RLS cuidará do resto
    const { data, error } = await supabase.from('consultas').insert({
      clinica_id: session.clinica.id,
      paciente_id: payload.paciente_id,
      profissional_id: payload.profissional_id,
      especialidade_id: payload.especialidade_id,
      status_id: statusSolicitada,
      data_consulta: payload.data_consulta,
      hora_inicio: payload.hora_inicio,
      hora_fim: payload.hora_fim,
      observacoes: payload.observacoes || ''
    }).select().single();

    if (error) {
      if (error.message.includes('conflicting key value') || error.message.includes('overlapping') || error.code === '23EXC') {
        throw new Error('Conflito detectado: O horário já foi ocupado ou bloqueado.');
      }
      throw error;
    }

    await UserService.logAudit('CONSULTA_CRIADA', data.id, {
      ...payload, status: 'Solicitada'
    });
    
    // Dispara Evento de Notificação (Etapa 10)
    // Para o profissional avisando que há uma nova solicitação
    try {
      const { data: profInfo } = await supabase.from('profissionais').select('telefone').eq('id', payload.profissional_id).single();
      if (profInfo && profInfo.telefone) {
        await NotificacoesService.enqueueMessage({
          paciente_id: payload.paciente_id,
          profissional_id: payload.profissional_id,
          consulta_id: data.id,
          canal: 'WHATSAPP',
          template_nome: 'consulta_solicitada',
          destinatario: profInfo.telefone,
          variaveis: {
            data: payload.data_consulta,
            hora: payload.hora_inicio
          },
          fallback_conteudo: `Nova solicitação de consulta em ${payload.data_consulta} às ${payload.hora_inicio}. Por favor, acesse o painel para aprovar.`
        });
      }
    } catch(e) {
      console.error('[NOTIFICACOES] Falha ao enfileirar notificação:', e);
    }
    
    return data;
  }
}

