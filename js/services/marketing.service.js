import { supabase } from '../supabase.js';
import { SessionService } from '../session.service.js';
import { UserService } from '../user.service.js';

export class MarketingService {
  
  static async getCampanhas() {
    const session = SessionService.getSession();
    const { data, error } = await supabase
      .from('marketing_campanhas')
      .select('*, marketing_templates(nome)')
      .eq('clinica_id', session.clinica.id)
      .order('criado_em', { ascending: false });
      
    if (error) throw error;
    return data;
  }

  static async getTemplates() {
    const session = SessionService.getSession();
    const { data, error } = await supabase
      .from('marketing_templates')
      .select('*')
      .eq('clinica_id', session.clinica.id);
    
    if (error) throw error;
    return data;
  }

  static async criarCampanha(payload) {
    const session = SessionService.getSession();
    const { error } = await supabase
      .from('marketing_campanhas')
      .insert({
        clinica_id: session.clinica.id,
        nome: payload.nome,
        objetivo: payload.objetivo,
        template_id: payload.template_id,
        filtro_publico: payload.filtro_publico,
        status: payload.agendamento ? 'AGENDADA' : 'RASCUNHO',
        data_agendamento: payload.agendamento || null,
        criado_por: session.id
      });
      
    if (error) throw error;
    await UserService.logAudit('CAMPANHA_CRIADA', null, { nome: payload.nome });
  }

  static async calcularPublicoAlvo(filtros) {
    // Retorna a contagem de pacientes/leads que caem neste filtro, respeitando LGPD.
    // Para simplificar no MVP, retornamos um mock escalável.
    // Em prod, faríamos um .select() dinâmico na view ou pacientes integrando com pacientes_consentimento.
    
    // Exemplo: se filtros pedir 'Pacientes VIP' e 'Aceita Whatsapp'
    return Math.floor(Math.random() * 500) + 120; 
  }
}
