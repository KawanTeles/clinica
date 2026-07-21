/**
 * repositories/pacientes.repository.js
 * Apenas acesso aos dados de Pacientes. Nenhuma regra de negócio.
 */
import { supabase } from '../js/admin/supabase-client.js';

export class PacientesRepository {
    static async listarPacientesComFinanceiro(searchTerm = '') {
        let query = supabase
            .from('patient_financial_summary')
            .select('patient_id, nome, cpf, total_em_aberto, proxima_consulta, patients(status, telefone, whatsapp)')
            .order('nome', { ascending: true })
            .limit(100);
            
        if (searchTerm) {
            // Buscando tanto no TSVECTOR (nome) quanto CPF exato
            query = query.or(`nome.ilike.%${searchTerm}%,cpf.eq.${searchTerm}`);
        }
        
        return await query;
    }

    static async buscarPaciente(id) {
        return await supabase
            .from('patients')
            .select('id, nome, cpf, data_nascimento, whatsapp, email, alerta_medico, cep, logradouro, numero, bairro')
            .eq('id', id)
            .single();
    }

    static async buscarResumoFinanceiro(id) {
        return await supabase
            .from('patient_financial_summary')
            .select('total_consultas, total_em_aberto')
            .eq('patient_id', id)
            .single();
    }

    static async atualizarPaciente(id, payload) {
        return await supabase
            .from('patients')
            .update(payload)
            .eq('id', id);
    }

    static async criarPaciente(payload) {
        return await supabase
            .from('patients')
            .insert(payload);
    }
}
