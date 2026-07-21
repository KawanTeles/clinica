import { CrmMessagesRepository } from '../repositories/crm-messages.repository.js';
import { CrmRepository } from '../repositories/crm.repository.js';
import { MockWhatsAppProvider } from './providers/whatsapp/mock.provider.js';
import { EvolutionProvider } from './providers/whatsapp/evolution.provider.js';
import { CloudApiProvider } from './providers/whatsapp/cloud-api.provider.js';

export class CrmMessageWorkerService {
  
  /**
   * Processa uma ação de envio de mensagem
   * @param {Object} config - Configurações da ação (ex: channel, provider)
   * @param {Object} event - Evento que engatilhou a regra
   * @param {string} clinicId - ID da clínica
   */
  static async processSendMessage(config, event, clinicId) {
    // 1. Validar e obter template
    const template = await CrmMessagesRepository.getTemplateByEvent(clinicId, event.event_type);
    if (!template) {
      throw new Error(`Template não encontrado ou inativo para o evento ${event.event_type}`);
    }

    // 2. Obter dados do paciente para substituição de variáveis e número de telefone
    const patientData = await CrmRepository.getPatientById(event.patient_id);
    if (!patientData) {
      throw new Error(`Paciente ${event.patient_id} não encontrado.`);
    }

    if (!patientData.telefone) {
      throw new Error(`Paciente ${patientData.nome} não possui telefone cadastrado.`);
    }

    // 3. Substituir variáveis do template
    const parsedContent = this.parseTemplate(template.content, {
      patient_name: patientData.nome,
      clinic_id: clinicId
    });

    // 4. Criar registro inicial da mensagem (PENDING)
    const channel = config.channel || template.channel || 'WHATSAPP';
    const provider = config.provider || 'MOCK';
    
    const messageId = await CrmMessagesRepository.createMessage({
      clinic_id: clinicId,
      patient_id: event.patient_id,
      channel: channel,
      provider: provider,
      direction: 'OUTBOUND',
      template_id: template.id,
      content: parsedContent,
      status: 'PENDING'
    });

    // 5. Acionar o Provider correspondente
    try {
      const payload = {
        to: patientData.telefone,
        content: parsedContent
      };

      let result;
      switch (provider) {
        case 'EVOLUTION':
          result = await EvolutionProvider.sendMessage(payload);
          break;
        case 'CLOUD_API':
          result = await CloudApiProvider.sendMessage(payload);
          break;
        case 'MOCK':
        default:
          result = await MockWhatsAppProvider.sendMessage(payload);
          break;
      }

      // 6. Atualizar para SENT/DELIVERED
      await CrmMessagesRepository.updateMessageStatus(messageId, result.status || 'SENT');

    } catch (err) {
      // 7. Atualizar para FAILED em caso de erro no envio
      const errorMessage = err.message || JSON.stringify(err);
      await CrmMessagesRepository.updateMessageStatus(messageId, 'FAILED', errorMessage);
      throw err; // Repassar o erro para o Scheduler logar a falha do job
    }
  }

  /**
   * Substitui as tags {{variavel}} pelo valor correspondente
   */
  static parseTemplate(content, variables) {
    let parsed = content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      parsed = parsed.replace(regex, value || '');
    }
    return parsed;
  }
}
