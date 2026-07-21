import { supabase } from '../js/admin/supabase-client.js';

export class AuthRepository {
    static async getSession() {
        return await supabase.auth.getSession();
    }

    static async getUser() {
        return await supabase.auth.getUser();
    }

    static async signOut() {
        return await supabase.auth.signOut();
    }

    static async registrarLogSeguranca(payload) {
        return await supabase.from('security_logs').insert(payload);
    }

    static async getPerfilUsuario(uid) {
        return await supabase
            .from('user_profiles')
            .select('*, roles(nome)')
            .eq('auth_user_id', uid)
            .single();
    }
    static async signInWithPassword(email, password) {
        return await supabase.auth.signInWithPassword({ email, password });
    }
}
