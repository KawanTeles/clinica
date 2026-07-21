import { supabase } from '../js/admin/supabase-client.js';

export class CrmFeedbackRepository {
  /**
   * Registra a resposta de feedback de um paciente e atualiza o status.
   * Se não houver um PENDING, pode criar um novo (caso venha atrasado).
   */
  static async registerFeedbackResponse(clinicId, patientId, rating, comment = '') {
    // 1. Encontrar o último feedback PENDING deste paciente
    const { data: pending, error: errPending } = await supabase
      .from('crm_feedbacks')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (pending) {
      // 2. Atualizar o PENDING
      const { data, error } = await supabase
        .from('crm_feedbacks')
        .update({
          rating: rating,
          comment: comment,
          status: 'ANSWERED'
        })
        .eq('id', pending.id)
        .select()
        .single();
        
      if (error) throw error;
      return data;
    } else {
      // Cria um solto se não tiver PENDING
      const { data, error } = await supabase
        .from('crm_feedbacks')
        .insert({
          clinic_id: clinicId,
          patient_id: patientId,
          rating: rating,
          comment: comment,
          status: 'ANSWERED'
        })
        .select()
        .single();
        
      if (error) throw error;
      return data;
    }
  }

  /**
   * Obtém as métricas de feedback para o dashboard analítico.
   */
  static async getFeedbackStats(clinicId) {
    const { data, error } = await supabase
      .from('crm_feedbacks')
      .select('rating, status')
      .eq('clinic_id', clinicId);

    if (error) throw error;

    const total = data.length;
    const answered = data.filter(f => f.status === 'ANSWERED');
    const responseRate = total > 0 ? Math.round((answered.length / total) * 100) : 0;
    
    let sumRatings = 0;
    let badRatings = 0;

    answered.forEach(f => {
      sumRatings += f.rating || 0;
      if (f.rating <= 3) badRatings++;
    });

    const avgRating = answered.length > 0 ? (sumRatings / answered.length).toFixed(1) : 0;

    return {
      total: answered.length,
      avgRating,
      badRatings,
      responseRate
    };
  }

  /**
   * Lista feedbacks com detalhes para tabela.
   */
  static async getFeedbacksList(clinicId) {
    const { data, error } = await supabase
      .from('crm_feedbacks')
      .select(`
        id, rating, comment, created_at, status,
        patients(nome),
        appointments(professionals(nome))
      `)
      .eq('clinic_id', clinicId)
      .eq('status', 'ANSWERED')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    
    return data.map(item => ({
      id: item.id,
      rating: item.rating,
      comment: item.comment,
      created_at: item.created_at,
      patient_name: item.patients?.nome || 'Desconhecido',
      professional_name: item.appointments?.professionals?.nome || '-'
    }));
  }
}
