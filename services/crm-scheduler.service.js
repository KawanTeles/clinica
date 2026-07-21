import { CrmJobsRepository } from '../repositories/crm-jobs.repository.js';
import { CrmRepository } from '../repositories/crm.repository.js';
import { CrmUsersRepository } from '../repositories/crm-users.repository.js';
import { CrmAutomationRulesRepository } from '../repositories/crm-automation-rules.repository.js';
import { CrmEventsRepository } from '../repositories/crm-events.repository.js';
import { AgendaRepository } from '../repositories/agenda.repository.js';
import { CrmMessageWorkerService } from './crm-message-worker.service.js';

export class CrmSchedulerService {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Processa a fila de jobs pendentes e gera eventos baseados em tempo.
   */
  async processQueue() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      // 1. Gerar novos eventos baseados no tempo (ex: Lembretes 24h)
      await this.generateTimeBasedEvents();

      // 2. Processar a fila normal de Jobs (originados por eventos)
      const jobs = await CrmJobsRepository.getPendingJobs(20);
      
      if (jobs.length > 0) {
        console.log(`[SchedulerService] Processando ${jobs.length} jobs pendentes...`);
      }

      for (const job of jobs) {
        await this.processJob(job);
      }
      
    } catch (err) {
      console.error('[SchedulerService] Erro ao processar fila:', err);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Identifica eventos temporais como APPOINTMENT_REMINDER_24H e os injeta em crm_events
   */
  async generateTimeBasedEvents() {
    try {
      const proximasConsultas = await AgendaRepository.getConsultasParaLembrete24h();
      for (const appt of proximasConsultas) {
        // Evitar duplicidade
        const alreadyHasEvent = await CrmEventsRepository.hasEventForAppointment(appt.id, 'APPOINTMENT_REMINDER_24H');
        if (!alreadyHasEvent) {
          await CrmEventsRepository.createEvent({
            clinic_id: appt.clinic_id,
            patient_id: appt.patient_id,
            event_type: 'APPOINTMENT_REMINDER_24H',
            payload: {
              appointment_id: appt.id,
              professional_id: appt.professional_id,
              professional_name: appt.professionals?.nome || 'Profissional',
              date: appt.data,
              time: appt.hora_inicio
            }
          });
          console.log(`[SchedulerService] Lembrete de 24h gerado para consulta ${appt.id}`);
        }
      }
    } catch (err) {
      console.error('[SchedulerService] Erro ao gerar eventos temporais:', err);
    }
  }

  /**
   * Tenta executar o job, lidando com retry automático
   */
  async processJob(job) {
    try {
      // 1. Bloquear concorrência (pessimistic lock simples)
      await CrmJobsRepository.updateStatus(job.id, 'processing');
      
      const { rule, event } = job;
      if (!rule || !event) {
        throw new Error("Job inválido: faltando rule ou event.");
      }

      // 2. Executar a ação baseada na regra
      await this.executeAction(rule, event);

      // 3. Sucesso - Finalizar job e registrar log
      await CrmJobsRepository.markCompleted(job.id, job.attempts);
      await this.logAutomation(job.clinic_id, event.patient_id, event.professional_id, event.event_type, rule, 'SUCCESS', null);

    } catch (err) {
      const errorMessage = err.message || JSON.stringify(err);
      console.error(`[SchedulerService] Falha no job ${job.id}:`, err);
      
      // 4. Falha - Atualizar status com lógica de retry e registrar log
      const updatedJob = await CrmJobsRepository.markFailed(job.id, errorMessage, job.attempts);
      
      // Se for a última tentativa e falhou definitivamente
      if (updatedJob.status === 'failed') {
        await this.logAutomation(job.clinic_id, job.event?.patient_id, job.event?.professional_id, job.event?.event_type, job.rule, 'FAILED', errorMessage);
      }
    }
  }

  async executeAction(rule, event) {
    const config = rule.action_config || {};
    
    switch (rule.action_type) {
      case 'CREATE_TASK':
        await this.actionCreateTask(config, event, rule.clinic_id);
        break;
      case 'CREATE_INTERACTION':
        await this.actionCreateInteraction(config, event, rule.clinic_id);
        break;
      case 'MOVE_PIPELINE':
        await this.actionMovePipeline(config, event);
        break;
      case 'LOG_ONLY':
        // Apenas registrar
        break;
      case 'SEND_MESSAGE':
        await CrmMessageWorkerService.processSendMessage(config, event, rule.clinic_id);
        break;
      default:
        throw new Error(`Ação não suportada: ${rule.action_type}`);
    }
  }

  async actionCreateTask(config, event, clinicId) {
    let assignedTo = null;
    
    if (config.assign_to_role === 'RECEPCIONISTA') {
      assignedTo = await CrmUsersRepository.getFirstReceptionistId(clinicId);
    }

    const payload = {
      clinic_id: clinicId,
      patient_id: event.patient_id,
      title: config.title || 'Tarefa Automática',
      description: config.description || `Gerado pelo evento ${event.event_type}`,
      assigned_to: assignedTo,
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    await CrmRepository.createTask(payload);
  }

  async actionCreateInteraction(config, event, clinicId) {
    const payload = {
      clinic_id: clinicId,
      patient_id: event.patient_id,
      type: config.type || 'system',
      description: config.description || 'Interação registrada por automação.'
    };
    
    await CrmRepository.createInteraction(payload);
  }

  async actionMovePipeline(config, event) {
    if (!config.target_stage) throw new Error("Faltando 'target_stage' no action_config.");
    
    const pipelineId = event.payload?.pipeline_id;
    if (!pipelineId) throw new Error("Evento não possui pipeline_id para mover.");

    await CrmRepository.updatePipelineStage(pipelineId, config.target_stage);
  }

  async logAutomation(clinicId, patientId, professionalId, eventType, rule, status, errorDetail) {
    try {
      await CrmAutomationRulesRepository.createAutomationLog({
        clinic_id: clinicId,
        patient_id: patientId,
        professional_id: professionalId,
        event: eventType || 'UNKNOWN_EVENT',
        status: status,
        payload: { 
          rule_name: rule?.name || 'Unknown Rule',
          action: rule?.action_type || 'UNKNOWN',
          error: errorDetail
        }
      });
    } catch (e) {
      console.error('Erro ao salvar automation log:', e);
    }
  }
}
