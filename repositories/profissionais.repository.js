import { supabase } from '../js/admin/supabase-client.js';

export class ProfissionaisRepository {
    static async listarProfissionais() {
        return await supabase.from('professionals')
            .select('id, nome, especialidade, registro_profissional, valor_avista, ativo')
            .order('created_at', { ascending: false })
            .limit(100);
    }

    static async buscarProfissional(id) {
        return await supabase.from('professionals')
            .select('id, nome, especialidade, registro_profissional, whatsapp, valor_avista, ativo, user_profiles(email)')
            .eq('id', id).single();
    }

    static async atualizarProfissional(id, payload) {
        return await supabase.from('professionals').update(payload).eq('id', id);
    }

    static async invocarCriacaoProfissional(payload) {
        return await supabase.functions.invoke('create-professional', { body: payload });
    }
}
