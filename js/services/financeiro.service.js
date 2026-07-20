import { supabase } from '../supabase.js';
import { SessionService } from '../session.service.js';
import { UserService } from '../user.service.js';

export class FinanceiroService {

  /**
   * Buscar Lista de Lançamentos
   */
  static async getLancamentos(filtros = {}) {
    const session = SessionService.getSession();
    let query = supabase
      .from('financeiro')
      .select(`
        *,
        pacientes(nome),
        profissionais(nome)
      `)
      .eq('clinica_id', session.clinica.id)
      .is('deleted_at', null)
      .order('data_vencimento', { ascending: false });

    // Se profissional, só vê o dele
    if (session.cargo.toLowerCase() === 'profissional') {
      const { data: prof } = await supabase.from('profissionais').select('id').eq('usuario_id', session.id).single();
      if (prof) query = query.eq('profissional_id', prof.id);
    } else if (filtros.profissional_id) {
      query = query.eq('profissional_id', filtros.profissional_id);
    }

    if (filtros.status && filtros.status !== 'Todos') {
      query = query.eq('status', filtros.status);
    }
    
    if (filtros.tipo) {
      query = query.eq('tipo', filtros.tipo);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  /**
   * Registrar Pagamento (E atualiza caixa)
   */
  static async registrarPagamento(financeiroId, payload) {
    // payload: { valor_pago, forma_pagamento_id, parcelas, taxa_operadora }
    const session = SessionService.getSession();

    // Busca valor líquido e status atual
    const { data: fin } = await supabase
      .from('financeiro')
      .select('valor_liquido, status')
      .eq('id', financeiroId)
      .single();

    if (fin.status === 'Pago') throw new Error('Esta conta já está paga.');

    let novoStatus = payload.valor_pago >= fin.valor_liquido ? 'Pago' : 'Parcialmente Pago';

    // 1. Inserir pagamento
    const { error: pErro } = await supabase
      .from('pagamentos')
      .insert({
        financeiro_id: financeiroId,
        forma_pagamento_id: payload.forma_pagamento_id,
        valor_pago: payload.valor_pago,
        parcela_numero: payload.parcelas || 1,
        taxa_operadora: payload.taxa_operadora || 0
      });
    if (pErro) throw pErro;

    // 2. Atualizar status na tabela financeiro
    await supabase.from('financeiro').update({ status: novoStatus }).eq('id', financeiroId);

    // 3. Atualizar Caixa Diário (Lógica simplificada)
    const hoje = new Date().toISOString().split('T')[0];
    
    // Verifica se tem caixa aberto hoje
    const { data: caixa } = await supabase
      .from('caixa_diario')
      .select('*')
      .eq('clinica_id', session.clinica.id)
      .eq('data_caixa', hoje)
      .single();

    if (caixa) {
      const field = fin.tipo === 'RECEITA' ? 'entradas' : 'saidas';
      const newVal = parseFloat(caixa[field]) + parseFloat(payload.valor_pago);
      await supabase.from('caixa_diario').update({ [field]: newVal }).eq('id', caixa.id);
    } else {
      // Abre caixa se não existir
      await supabase.from('caixa_diario').insert({
        clinica_id: session.clinica.id,
        data_caixa: hoje,
        entradas: fin.tipo === 'RECEITA' ? payload.valor_pago : 0,
        saidas: fin.tipo === 'DESPESA' ? payload.valor_pago : 0,
        aberto_por: session.id
      });
    }

    // 4. Auditoria & Automações
    await UserService.logAudit('PAGAMENTO_REGISTRADO', financeiroId, { valor: payload.valor_pago });
    console.log(`[EVENTO] financeiro_pago disparado para automações.`);
  }

  /**
   * Buscar Indicadores DRE Simplificado
   */
  static async getDashboardMetrics() {
    const session = SessionService.getSession();
    const { data } = await supabase
      .from('financeiro')
      .select('tipo, status, valor_liquido, comissao_valor, repasse_liquido')
      .eq('clinica_id', session.clinica.id)
      .is('deleted_at', null);

    let metrics = {
      receitaBruta: 0,
      receitaRecebida: 0,
      contasEmAberto: 0,
      totalComissao: 0,
      lucroLiquido: 0,
      despesas: 0
    };

    if (data) {
      data.forEach(item => {
        if (item.tipo === 'RECEITA') {
          if (item.status === 'Pago' || item.status === 'Parcialmente Pago') {
            metrics.receitaRecebida += parseFloat(item.valor_liquido || 0);
            metrics.totalComissao += parseFloat(item.comissao_valor || 0);
            metrics.lucroLiquido += parseFloat(item.repasse_liquido || 0);
          } else if (item.status === 'Em Aberto') {
            metrics.receitaBruta += parseFloat(item.valor_liquido || 0);
            metrics.contasEmAberto += parseFloat(item.valor_liquido || 0);
          }
        } else if (item.tipo === 'DESPESA') {
          metrics.despesas += parseFloat(item.valor_liquido || 0);
          if (item.status === 'Pago') {
            metrics.lucroLiquido -= parseFloat(item.valor_liquido || 0);
          }
        }
      });
    }
    
    // Calcula receita bruta como (recebido + em aberto)
    metrics.receitaBruta = metrics.receitaRecebida + metrics.contasEmAberto;
    
    return metrics;
  }
}
