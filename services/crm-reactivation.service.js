import { CrmReactivationRepository } from '../repositories/crm-reactivation.repository.js';
import { CrmEventsRepository } from '../repositories/crm-events.repository.js';

export class CrmReactivationService {
  /**
   * Procura pacientes inativos e gera eventos PATIENT_INACTIVE na esteira do CRM
   */
  static async generateReactivationEvents(inactiveMonths = 6) {
    try {
      // 1 mês ~= 30 dias
      const inactiveDays = inactiveMonths * 30;
      const inactivePatients = await CrmReactivationRepository.getInactivePatients(inactiveDays);
      
      const limitDate = new Date();
      limitDate.setMonth(limitDate.getMonth() - 2); // Ex: Só mandar 1 campanha a cada 2 meses
      const limitDateStr = limitDate.toISOString().split('T')[0];

      for (const p of inactivePatients) {
        // Idempotência: Checa se já existe campanha recente
        const alreadyHasCampaign = await CrmReactivationRepository.hasCampaign(p.patient_id, limitDateStr);
        
        if (!alreadyHasCampaign) {
          // Insere PENDING campaign para trackear
          const campaign = await CrmReactivationRepository.createCampaign({
            clinic_id: p.clinic_id,
            patient_id: p.patient_id,
            last_appointment_id: p.last_appointment_id,
            inactive_since: p.last_appointment_date,
            status: 'PENDING'
          });

          // Gera o evento na esteira
          await CrmEventsRepository.createEvent({
            clinic_id: p.clinic_id,
            patient_id: p.patient_id,
            event_type: 'PATIENT_INACTIVE',
            payload: {
              patient_id: p.patient_id,
              last_appointment_id: p.last_appointment_id,
              inactive_days: inactiveDays,
              campaign_id: campaign.id
            }
          });

          console.log(`[ReactivationService] Evento PATIENT_INACTIVE gerado para paciente ${p.patient_id}`);
        }
      }
    } catch (err) {
      console.error('[ReactivationService] Erro ao gerar eventos de reativação:', err);
    }
  }
}
