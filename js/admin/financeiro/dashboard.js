// Dashboard Financeiro JS
import { supabase } from '../../supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    await carregarResumoMensal();
});

async function carregarResumoMensal() {
    try {
        const { data, error } = await supabase.from('vw_monthly_revenue').select('*').limit(1);
        if (error) throw error;

        if (data && data.length > 0) {
            const resumo = data[0];
            document.getElementById('kpi-receita').innerText = formatarMoeda(resumo.total_recebido);
            document.getElementById('kpi-aberto').innerText = formatarMoeda(resumo.total_em_aberto);
        }
    } catch (err) {
        console.error('Erro ao carregar Dashboard:', err);
    }
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}
