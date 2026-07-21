import { supabase } from '../js/admin/supabase-client.js';

export class PatientsRepository {
  static async getPatients() {
    return await supabase
      .from('patients')
      .select(`
        *,
        patient_contacts ( telefone, whatsapp, email )
      `)
      .order('nome', { ascending: true });
  }

  static async getPatientById(patientId) {
    return await supabase
      .from('patients')
      .select(`
        *,
        patient_contacts ( telefone, whatsapp, email ),
        patient_health_insurances ( id, insurance_company, plan_name, card_number )
      `)
      .eq('id', patientId)
      .single();
  }

  static async createPatient(payload, contactPayload) {
    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .insert(payload)
      .select()
      .single();

    if (patientError) throw patientError;

    if (contactPayload) {
      contactPayload.patient_id = patientData.id;
      contactPayload.clinic_id = patientData.clinic_id;
      const { error: contactErr } = await supabase
        .from('patient_contacts')
        .insert(contactPayload);
      if (contactErr) console.error('Erro ao salvar contato do paciente:', contactErr);
    }

    return { data: patientData, error: null };
  }

  static async updatePatient(patientId, payload, contactPayload) {
    const { data: patientData, error: patientError } = await supabase
      .from('patients')
      .update(payload)
      .eq('id', patientId)
      .select()
      .single();

    if (patientError) throw patientError;

    if (contactPayload) {
      // Verifica se já existe contato
      const { data: existingContact } = await supabase
        .from('patient_contacts')
        .select('id')
        .eq('patient_id', patientId)
        .single();
        
      if (existingContact) {
        await supabase
          .from('patient_contacts')
          .update(contactPayload)
          .eq('patient_id', patientId);
      } else {
        contactPayload.patient_id = patientId;
        contactPayload.clinic_id = payload.clinic_id;
        await supabase
          .from('patient_contacts')
          .insert(contactPayload);
      }
    }

    return { data: patientData, error: null };
  }

  static async deletePatient(patientId) {
    return await supabase
      .from('patients')
      .delete()
      .eq('id', patientId);
  }

  static async getPatientHistory(patientId) {
    return await supabase
      .from('appointments')
      .select(`
        id, data, hora_inicio, hora_fim, status, observacao_interna,
        professionals(nome)
      `)
      .eq('patient_id', patientId)
      .order('data', { ascending: false });
  }

  static async getPatientSummary(clinicId) {
    // Para simplificar no cliente web (que não deve ter RPC complexa aqui), 
    // podemos apenas puxar a lista de pacientes com 'status' e 'created_at'.
    // Mas para dashboard, fazer queries agregadas seria o ideal.
    const { data, error } = await supabase
      .from('patients')
      .select('id, status, created_at');

    if (error) throw error;
    return { data, error: null };
  }

  static async getAppointmentsSummary(clinicId) {
    const { data, error } = await supabase
      .from('appointments')
      .select('id, status');
    return { data, error };
  }
}
