import { supabase } from '../supabase.js';
import { SessionService } from '../session.service.js';

export class DashboardService {
  
  static async getOverviewData() {
    const session = SessionService.getSession();
    const cargo = session.cargo.toLowerCase();
    
    // RBAC: Se for profissional, retorna apenas dados dele
    // Recepcionistas e Proprietários veem da clínica toda (mas a UI filtra o que a recepcionista vê).
    
    let data = {
      agenda: { hoje: 0, amanha: 0, pendentes: 0 },
      financeiro: { recebidoMes: 0, lucroLiquido: 0 },
      leads: { novos: 0, convertidos: 0 },
      profissionais: []
    };

    const hojeStr = new Date().toISOString().split('T')[0];

    try {
      // 1. Consultas Hoje (Status)
      let queryConsultas = supabase
        .from('view_dash_consultas_status')
        .select('*')
        .eq('clinica_id', session.clinica.id)
        .eq('data_consulta', hojeStr);

      const { data: dConsultas } = await queryConsultas.single();
      if (dConsultas) {
        data.agenda.hoje = dConsultas.total_consultas;
        data.agenda.pendentes = dConsultas.pendentes;
      }

      // 2. Leads (Apenas Proprietario / Recepcionista)
      if (cargo !== 'profissional') {
        const { data: dLeads } = await supabase.from('view_dash_leads').select('*').eq('clinica_id', session.clinica.id);
        if (dLeads) {
          dLeads.forEach(l => {
            if (l.status === 'Novo Lead') data.leads.novos += l.quantidade;
            if (l.status === 'Convertido') data.leads.convertidos += l.quantidade;
          });
        }
      }

      // 3. Financeiro (Apenas Proprietario)
      if (cargo === 'proprietario' || cargo === 'admin') {
        const mesStr = hojeStr.substring(0, 7); // YYYY-MM
        const { data: dFin } = await supabase
          .from('view_dash_financeiro_mensal')
          .select('*')
          .eq('clinica_id', session.clinica.id)
          .eq('mes_ano', mesStr)
          .single();
          
        if (dFin) {
          data.financeiro.recebidoMes = dFin.recebido;
          data.financeiro.lucroLiquido = dFin.lucro_liquido_realizado;
        }

        // Profissionais
        const { data: dProf } = await supabase.from('view_dash_profissionais_mes').select('*').eq('clinica_id', session.clinica.id);
        if (dProf) {
          data.profissionais = dProf;
        }
      }

    } catch (e) {
      console.error('Erro ao buscar dados do Dashboard', e);
    }
    
    return data;
  }
}
