import { supabase } from '../supabase.js';
import { SessionService } from '../session.service.js';
import { UserService } from '../user.service.js';
import { NotificacoesService } from './notificacoes.service.js';

export class AutomacoesService {
  
  static async getRegras() {
    const session = SessionService.getSession();
    const { data, error } = await supabase
      .from('automacoes_regras')
      .select('*')
      .eq('clinica_id', session.clinica.id)
      .order('criado_em', { ascending: false });
      
    if (error) throw error;
    return data;
  }

  static async toggleRegra(id, ativo) {
    const { error } = await supabase
      .from('automacoes_regras')
      .update({ ativo })
      .eq('id', id);
    if (error) throw error;
    await UserService.logAudit('REGRA_AUTOMACAO_ALTERADA', id, { ativo });
  }

  /**
   * Disparador Global de Eventos
   * Essa função deve ser chamada em pontos chaves do sistema (Aprovações, Pagamentos, etc)
   * ex: AutomacoesService.triggerEvent('CONSULTA_APROVADA', { paciente_id, consulta_id });
   */
  static async triggerEvent(evento, payload) {
    console.log(`[EVENT_ENGINE] Disparando evento interno: ${evento}`, payload);
    
    // Na vida real (Supabase), isso poderia ser uma Edge Function escutando Webhooks
    // Aqui no MVP, simulamos o listener de automação
    
    // Busca regras ativas para este evento
    const session = SessionService.getSession();
    if(!session) return;
    
    const { data: regras } = await supabase
      .from('automacoes_regras')
      .select('*')
      .eq('clinica_id', session.clinica.id)
      .eq('evento_gatilho', evento)
      .eq('ativo', true);
      
    if (!regras || regras.length === 0) return;

    regras.forEach(async (regra) => {
      console.log(`[EVENT_ENGINE] Executando regra: ${regra.nome}`);
      
      if (regra.acao_tipo === 'ENVIAR_MENSAGEM') {
        // Usa a fila de mensagens
        await NotificacoesService.enqueueMessage({
          paciente_id: payload.paciente_id,
          telefone: payload.telefone, // Precisaria ser repassado no payload
          template: regra.acao_payload.template_nome || evento,
          variaveis: payload
        });
      }
      else if (regra.acao_tipo === 'MOVER_LEAD') {
        // Move no kanban
        if(payload.lead_id) {
          await supabase.from('leads').update({ status: regra.acao_payload.novo_status }).eq('id', payload.lead_id);
        }
      }
    });
  }
}
