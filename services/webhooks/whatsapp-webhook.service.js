import { CrmMessagesRepository } from '../../repositories/crm-messages.repository.js';
import { CrmRepository } from '../../repositories/crm.repository.js';
import { AgendaRepository } from '../../repositories/agenda.repository.js';
import { CrmFeedbackRepository } from '../../repositories/crm-feedback.repository.js';
import { CrmReactivationRepository } from '../../repositories/crm-reactivation.repository.js';

export class WhatsappWebhookService {
  /**
   * Processa o payload de webhook recebido da Evolution ou Cloud API.
   * Em produção, este método seria invocado por uma Edge Function (Supabase)
   * ou rota serverless (Node/Express).
   */
  static async handleWebhook(req) {
    // 1. Validar estrutura básica (Segurança)
    const { clinic_id, provider, payload, signature } = req;
    
    if (!clinic_id || !provider || !payload) {
      throw new Error('Payload inválido. Faltando clinic_id, provider ou payload.');
    }

    // 2. Buscar configuração da clínica para validar assinatura (Segurança)
    const config = await CrmMessagesRepository.getIntegrationConfig(clinic_id);
    if (!config) {
      throw new Error(`Integração não encontrada para a clínica ${clinic_id}.`);
    }

    // 3. Validar assinatura do Webhook (Exemplo simbólico)
    if (config.webhook_secret && signature !== config.webhook_secret) {
      throw new Error('Assinatura de Webhook inválida.');
    }

    // 4. Normalizar payload dependendo do provider
    const event = this.normalizePayload(provider, payload);
    
    if (!event) {
      console.log('[Webhook] Evento não suportado ou ignorado.');
      return { status: 'ignored' };
    }

    // 5. Atualizar status de mensagens enviadas
    if (event.type === 'STATUS_UPDATE' && event.external_message_id) {
      await this.handleStatusUpdate(event, clinic_id);
    } 
    // 6. Processar respostas do paciente
    else if (event.type === 'MESSAGE_RECEIVED') {
      await this.handlePatientReply(event, clinic_id);
    }

    return { status: 'success' };
  }

  static normalizePayload(provider, payload) {
    // Exemplo: Converter payload proprietário da Evolution ou Meta para um formato padrão Zoe.
    if (provider === 'EVOLUTION') {
      // Retornos de mensagem enviada (ack)
      if (payload.event === 'messages.update') {
        const statusMap = { 'SERVER_ACK': 'SENT', 'DELIVERY_ACK': 'DELIVERED', 'READ': 'READ', 'ERROR': 'FAILED' };
        return {
          type: 'STATUS_UPDATE',
          external_message_id: payload.data.key.id,
          status: statusMap[payload.data.status] || 'SENT'
        };
      }
      
      // Mensagens recebidas
      if (payload.event === 'messages.upsert') {
        return {
          type: 'MESSAGE_RECEIVED',
          phone: payload.data.key.remoteJid.replace('@s.whatsapp.net', ''),
          content: payload.data.message?.conversation || ''
        };
      }
    }
    
    if (provider === 'CLOUD_API') {
      // Cloud API parsing logic
      if (payload.entry?.[0]?.changes?.[0]?.value?.statuses) {
        const statusData = payload.entry[0].changes[0].value.statuses[0];
        return {
          type: 'STATUS_UPDATE',
          external_message_id: statusData.id,
          status: statusData.status.toUpperCase() // sent, delivered, read, failed
        };
      }

      if (payload.entry?.[0]?.changes?.[0]?.value?.messages) {
        const msg = payload.entry[0].changes[0].value.messages[0];
        return {
          type: 'MESSAGE_RECEIVED',
          phone: msg.from,
          content: msg.text?.body || ''
        };
      }
    }

    return null;
  }

  static async handleStatusUpdate(event, clinic_id) {
    // Na vida real precisariamos buscar a mensagem local pelo external_message_id.
    // Como a RPC updateMessageStatus exige messageId (interno), 
    // teríamos que criar CrmMessagesRepository.updateMessageStatusByExternalId.
    await CrmMessagesRepository.updateMessageStatusByExternalId(event.external_message_id, event.status);
  }

  static async handlePatientReply(event, clinic_id) {
    // 1. Achar o paciente pelo telefone e clínica
    const patient = await CrmRepository.findPatientByContact(null, event.phone, clinic_id);
    if (!patient) {
      console.warn(`[Webhook] Mensagem recebida de número desconhecido: ${event.phone}`);
      return;
    }

    // 2. Registrar Interação
    await CrmRepository.createInteraction({
      clinic_id: clinic_id,
      patient_id: patient.id,
      type: 'whatsapp_reply',
      description: `Paciente respondeu: ${event.content}`
    });

    const contentUpper = event.content.trim().toUpperCase();

    // 3. Checar intenção de confirmação de consulta
    if (contentUpper === 'SIM' || contentUpper === 'CONFIRMO') {
      try {
        const nextAppt = await AgendaRepository.getProximaConsulta(patient.id, clinic_id);
        if (nextAppt) {
          await AgendaRepository.atualizarStatus(nextAppt.id, 'Confirmada', 'Confirmado automaticamente via WhatsApp');
          
          await CrmRepository.createInteraction({
            clinic_id: clinic_id,
            patient_id: patient.id,
            type: 'system_action',
            description: `Consulta de ${nextAppt.data} às ${nextAppt.hora_inicio} confirmada automaticamente.`
          });
          return; // Para a execução se já tratou
        }
      } catch (err) {
        console.error('Falha ao tentar confirmar consulta via webhook:', err);
      }
    } 

    // 4. Checar intenção de cancelamento ou remarcação
    if (contentUpper === 'CANCELAR' || contentUpper === 'REMARCAR') {
      try {
        const nextAppt = await AgendaRepository.getProximaConsulta(patient.id, clinic_id);
        if (nextAppt) {
          await AgendaRepository.atualizarStatus(nextAppt.id, 'cancelada', 'Cancelado via WhatsApp pelo paciente');
          
          await CrmRepository.createInteraction({
            clinic_id: clinic_id,
            patient_id: patient.id,
            type: 'system_action',
            description: `Consulta de ${nextAppt.data} cancelada pelo paciente via WhatsApp.`
          });

          // Criar tarefa para a recepção
          await CrmRepository.createTask({
            clinic_id: clinic_id,
            patient_id: patient.id,
            title: 'Paciente deseja alterar consulta',
            description: `Paciente solicitou ${contentUpper} a consulta do dia ${nextAppt.data}. Entrar em contato.`,
            due_date: new Date().toISOString()
          });
          return; // Para a execução
        }
      } catch (err) {
        console.error('Falha ao tentar cancelar consulta via webhook:', err);
      }
    } 

    // 5. Checar feedback (NPS / Nota 1 a 5)
    let rating = null;
    const matchNumber = event.content.match(/\b([1-5])\b/);
    if (matchNumber) {
      rating = parseInt(matchNumber[1], 10);
    } else if (contentUpper.includes('EXCELENTE') || contentUpper.includes('OTIMO') || contentUpper.includes('ÓTIMO') || contentUpper.includes('PERFEITO')) {
      rating = 5;
    } else if (contentUpper.includes('PESSIMO') || contentUpper.includes('PÉSSIMO') || contentUpper.includes('RUIM') || contentUpper.includes('HORRIVEL') || contentUpper.includes('HORRÍVEL')) {
      rating = 1;
    }

    if (rating !== null) {
      try {
        await CrmFeedbackRepository.registerFeedbackResponse(clinic_id, patient.id, rating, event.content);

        await CrmRepository.createInteraction({
          clinic_id: clinic_id,
          patient_id: patient.id,
          type: 'feedback',
          description: `Paciente avaliou o atendimento com nota ${rating}.`
        });

        if (rating <= 3) {
          await CrmRepository.createTask({
            clinic_id: clinic_id,
            patient_id: patient.id,
            title: 'Paciente avaliou negativamente atendimento',
            description: `Nota recebida: ${rating}. Comentário: ${event.content}. Entrar em contato para entender.`,
            due_date: new Date().toISOString()
          });
        }
        return; // Para a execução
      } catch (err) {
        console.error('Falha ao processar feedback via webhook:', err);
      }
    }

    // 6. Checar intenção de Reativação de Paciente Inativo (Fase 6.4)
    if (contentUpper.includes('SIM') || contentUpper.includes('QUERO') || contentUpper.includes('MARCAR') || contentUpper.includes('AGENDAR')) {
      try {
        // Verifica se o paciente tem uma campanha PENDING ou CONTACTED
        const campaign = await CrmReactivationRepository.getActiveCampaign(patient.id, clinic_id);
        if (campaign) {
          await CrmReactivationRepository.updateCampaignStatus(campaign.id, 'RESPONDED');

          await CrmRepository.createTask({
            clinic_id: clinic_id,
            patient_id: patient.id,
            title: 'Paciente respondeu campanha de reativação',
            description: `Paciente deseja marcar nova consulta (Respondeu: "${event.content}"). Entrar em contato!`,
            due_date: new Date().toISOString()
          });

          await CrmRepository.createInteraction({
            clinic_id: clinic_id,
            patient_id: patient.id,
            type: 'system_action',
            description: `Paciente respondeu positivamente à campanha de reativação.`
          });
        }
      } catch (err) {
        console.error('Falha ao processar resposta de reativação:', err);
      }
    }
  }
}
