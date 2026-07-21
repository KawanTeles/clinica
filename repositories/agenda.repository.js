/**
 * repositories/agenda.repository.js
 * Apenas acesso aos dados da Agenda. Nenhuma regra de negócio.
 */
import { supabase } from '../js/admin/supabase-client.js';

export class AgendaRepository {
    static async getProfissionaisAtivos() {
        return await supabase
            .from('professionals')
            .select('id, nome')
            .eq('ativo', true);
    }

    static async getAgendamentosNaSemana(profissionalId, dataInicio, dataFim) {
        return await supabase
            .from('appointments')
            .select('*')
            .eq('professional_id', profissionalId)
            .gte('data', dataInicio)
            .lte('data', dataFim);
    }

    static async atualizarStatus(appointmentId, novoStatus, observacao = '') {
        return await supabase.rpc('update_appointment_status', {
            p_appointment_id: appointmentId,
            p_new_status: novoStatus,
            p_observacao: observacao
        });
    }

    static async criarAgendamento(payload) {
        return await supabase
            .from('appointments')
            .insert(payload);
    }
}
