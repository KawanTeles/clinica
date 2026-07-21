import { supabase } from '../js/admin/supabase-client.js';

export class FinanceiroRepository {
    static async getResumoMensal() {
        return await supabase.from('vw_monthly_revenue').select('*').limit(1);
    }

    static async getContasReceber() {
        return await supabase
            .from('financial_documents')
            .select('id, valor_total, saldo_devedor, data_vencimento, status, tipo, patients(nome), appointments(professional_id)')
            .eq('tipo', 'RECEITA')
            .order('data_vencimento', { ascending: false })
            .limit(100);
    }

    static async getCaixaAberto() {
        return await supabase
            .from('cash_registers')
            .select('*')
            .eq('status', 'ABERTO')
            .limit(1);
    }
}
