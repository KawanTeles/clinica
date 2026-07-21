import { supabase } from '../js/admin/supabase-client.js';

export class CrmUsersRepository {
  
  // Localizar usuários por clínica
  static async getUsersByClinic(clinicId) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('auth_user_id, roles(nome)')
      .eq('clinic_id', clinicId);
      
    if (error) throw error;
    return data;
  }

  // Localizar recepcionistas disponíveis em uma clínica
  static async getReceptionistsByClinic(clinicId) {
    const users = await this.getUsersByClinic(clinicId);
    return users.filter(u => u.roles?.nome === 'RECEPCIONISTA');
  }

  // Obter o ID de uma recepcionista (retorna o primeiro encontrado)
  static async getFirstReceptionistId(clinicId) {
    const receptionists = await this.getReceptionistsByClinic(clinicId);
    if (receptionists.length > 0) {
      return receptionists[0].auth_user_id;
    }
    return null;
  }
}
