import { supabase } from '../js/admin/supabase-client.js';

export class FinanceRepository {
  static async getTransactions() {
    return await supabase
      .from('financial_documents')
      .select(`
        id,
        status,
        valor_total,
        data_vencimento,
        tipo,
        patients ( nome ),
        appointments ( 
          data, 
          professionals ( nome ) 
        )
      `)
      .order('data_vencimento', { ascending: false });
  }

  static async createTransaction(payload) {
    return await supabase
      .from('financial_documents')
      .insert(payload)
      .select()
      .single();
  }

  static async updatePaymentStatus(documentId, status, paymentPayload) {
    // 1. Atualizar Documento
    const { data: doc, error: docError } = await supabase
      .from('financial_documents')
      .update({ status: status, saldo_devedor: status === 'PAGO' ? 0 : undefined })
      .eq('id', documentId)
      .select()
      .single();

    if (docError) throw docError;

    // 2. Registrar pagamento
    if (paymentPayload) {
      paymentPayload.document_id = documentId;
      paymentPayload.clinic_id = doc.clinic_id;
      
      const { error: payError } = await supabase
        .from('payments')
        .insert(paymentPayload);
        
      if (payError) console.error('Erro ao salvar payment log:', payError);
    }

    return { data: doc, error: null };
  }

  static async getFinancialDashboard() {
    // Busca dados no client side. Em produção extrema usaria-se View ou RPC.
    const { data, error } = await supabase
      .from('financial_documents')
      .select('status, valor_total, saldo_devedor, tipo');

    if (error) throw error;
    
    let receita = 0;
    let recebido = 0;
    let pendente = 0;

    data.forEach(d => {
      if (d.tipo === 'RECEITA') {
        receita += parseFloat(d.valor_total || 0);
        if (d.status === 'PAGO' || d.status === 'PARCIAL') {
           recebido += (parseFloat(d.valor_total || 0) - parseFloat(d.saldo_devedor || 0));
        }
        if (d.status === 'ABERTO' || d.status === 'PARCIAL') {
           pendente += parseFloat(d.saldo_devedor || 0);
        }
      }
    });

    return { data: { receita, recebido, pendente }, error: null };
  }

  static async getRevenueByPeriod(startDate, endDate) {
    const { data, error } = await supabase
      .from('financial_documents')
      .select('valor_total')
      .eq('tipo', 'RECEITA')
      .eq('status', 'PAGO')
      .gte('data_vencimento', startDate)
      .lte('data_vencimento', endDate);

    return { data, error };
  }

  static async getPaymentMethods(clinicId) {
    return await supabase
      .from('payment_methods')
      .select('id, nome, ativo')
      .eq('clinic_id', clinicId)
      .eq('ativo', true);
  }
}
