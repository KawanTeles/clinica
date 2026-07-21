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

    // Formatar data se houver
    let formattedDate = event.payload?.date || '';
    if (formattedDate && formattedDate.includes('-')) {
      const parts = formattedDate.split('-');
      if (parts.length === 3) formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    // 3. Substituir variáveis do template
    const parsedContent = this.parseTemplate(template.content, {
      patient_name: patientData.nome,
      patient_phone: patientData.telefone,
      clinic_id: clinicId,
      appointment_date: formattedDate,
      appointment_time: event.payload?.time || '',
      professional_name: event.payload?.professional_name || ''
    });

    // 4. Buscar configuração de integração WhatsApp da Clínica
    const channel = config.channel || template.channel || 'WHATSAPP';
    let integrationConfig = null;
    if (channel === 'WHATSAPP') {
      try {
        integrationConfig = await CrmMessagesRepository.getIntegrationConfig(clinicId);
      } catch (err) {
        console.warn(`[Worker] Nenhuma integração de WhatsApp encontrada para clínica ${clinicId}. Fallback para config da regra.`);
      }
    }

    const provider = integrationConfig?.provider || config.provider || 'MOCK';
    
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
          if (!integrationConfig) throw new Error('Configuração Evolution ausente.');
          result = await EvolutionProvider.sendMessage(integrationConfig, payload);
          break;
        case 'CLOUD_API':
          if (!integrationConfig) throw new Error('Configuração Cloud API ausente.');
          result = await CloudApiProvider.sendMessage(integrationConfig, payload);
          break;
        case 'MOCK':
        default:
          result = await MockWhatsAppProvider.sendMessage(payload);
          break;
      }

      if (!result.success) {
        throw new Error(result.error || 'Unknown error from provider');
      }

      // 6. Atualizar para SENT/DELIVERED e external_id
      await CrmMessagesRepository.updateMessageStatus(messageId, result.status || 'SENT');
      
      if (result.external_message_id) {
        await CrmMessagesRepository.updateMessageExternalId(messageId, result.external_message_id);
      }

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
