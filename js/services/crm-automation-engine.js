import { CrmEventsRepository } from '../../repositories/crm-events.repository.js';
import { CrmAutomationRulesRepository } from '../../repositories/crm-automation-rules.repository.js';
import { CrmRepository } from '../../repositories/crm.repository.js';
import { AuthRepository } from '../../repositories/auth.repository.js';
import { CrmUsersRepository } from '../../repositories/crm-users.repository.js';

export class CrmAutomationEngine {
  constructor() {
    this.intervalId = null;
    this.clinicId = null;
    this.isRunning = false;
  }

  // Inicializar o motor
  async init() {
    try {
      const session = await AuthRepository.getSession();
      if (!session.data.session) return;
      
      const userRes = await AuthRepository.getUser();
      const userProfile = await AuthRepository.getPerfilUsuario(userRes.data.user.id);
      
      if (!userProfile.data || !userProfile.data.clinic_id) {
        console.warn('CrmAutomationEngine: Usuário sem clinic_id.');
        return;
      }
      
      this.clinicId = userProfile.data.clinic_id;
      
      // Rodar a cada 30 segundos
      this.startPolling(30000);
      console.log('CRM Automation Engine Initialized (Rules Engine v1).');
    } catch (err) {
      console.error('CrmAutomationEngine error on init:', err);
    }
  }

  startPolling(intervalMs) {
    if (this.intervalId) clearInterval(this.intervalId);
    this.processEvents();
    this.intervalId = setInterval(() => {
      this.processEvents();
    }, intervalMs);
  }

  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async processEvents() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const events = await CrmEventsRepository.getPendingEvents(this.clinicId, 20);
      
      if (events.length > 0) {
        console.log(`[AutomationEngine] Processando ${events.length} eventos pendentes...`);
      }

      for (const event of events) {
        await this.handleEvent(event);
        // Marcar como processado
        await CrmEventsRepository.markProcessed(event.id);
      }
      
    } catch (err) {
      console.error('[AutomationEngine] Erro ao processar eventos:', err);
    } finally {
      this.isRunning = false;
    }
  }

  async handleEvent(event) {
    console.log(`[AutomationEngine] Processando evento: ${event.event_type}`, event);
    
    try {
      const rules = await CrmAutomationRulesRepository.getRules(this.clinicId, event.event_type, true);
      
      for (const rule of rules) {
        await this.executeRule(rule, event);
      }
    } catch (err) {
      console.error(`[AutomationEngine] Erro ao buscar regras para evento ${event.event_type}:`, err);
    }
  }

  async executeRule(rule, event) {
    let status = 'SUCCESS';
    let errorDetail = null;

    try {
      switch (rule.action_type) {
        case 'CREATE_TASK':
          await this.actionCreateTask(rule.action_config, event);
          break;
        case 'CREATE_INTERACTION':
          await this.actionCreateInteraction(rule.action_config, event);
          break;
        case 'MOVE_PIPELINE':
          await this.actionMovePipeline(rule.action_config, event);
          break;
        case 'LOG_ONLY':
          // Apenas registrar no automation_logs
          break;
        default:
          throw new Error(`Ação não suportada: ${rule.action_type}`);
      }
    } catch (err) {
      status = 'FAILED';
      errorDetail = err.message || JSON.stringify(err);
      console.error(`[AutomationEngine] Falha na regra ${rule.name}:`, err);
    }

    // Registrar no automation_logs
    await CrmAutomationRulesRepository.createAutomationLog({
      clinic_id: this.clinicId,
      patient_id: event.patient_id,
      professional_id: event.professional_id,
      event: event.event_type,
      status: status,
      payload: { 
        rule_name: rule.name,
        action: rule.action_type,
        error: errorDetail,
        event_payload: event.payload
      }
    }).catch(e => console.error('Erro ao salvar automation log:', e));
  }

  async actionCreateTask(config, event) {
    let assignedTo = null;
    
    // Obter responsável dinamicamente via Repository
    if (config.assign_to_role === 'RECEPCIONISTA') {
      assignedTo = await CrmUsersRepository.getFirstReceptionistId(this.clinicId);
    }

    const payload = {
      clinic_id: this.clinicId,
      patient_id: event.patient_id,
      title: config.title || 'Tarefa Automática',
      description: config.description || `Gerado pelo evento ${event.event_type}`,
      assigned_to: assignedTo,
      due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // +24h
    };
    
    await CrmRepository.createTask(payload);
  }

  async actionCreateInteraction(config, event) {
    const payload = {
      clinic_id: this.clinicId,
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
}
