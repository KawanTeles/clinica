import { supabase } from '../js/admin/supabase-client.js';

export class UsuariosRepository {
    static async listarRoles() {
        return await supabase.from('roles').select('id, nome');
    }

    static async listarUsuarios() {
        return await supabase.from('user_profiles')
            .select('auth_user_id, nome, email, ativo, last_login_at, login_count, role_id, roles(nome), professionals(id)')
            .order('created_at', { ascending: false })
            .limit(100);
    }

    static async buscarUsuario(uid) {
        return await supabase.from('user_profiles')
            .select('auth_user_id, nome, email, role_id, ativo')
            .eq('auth_user_id', uid).single();
    }

    static async invocarManageUser(payload) {
        return await supabase.functions.invoke('manage-user', { body: payload });
    }

    static async invocarResetPassword(payload) {
        return await supabase.functions.invoke('reset-password', { body: payload });
    }
}
