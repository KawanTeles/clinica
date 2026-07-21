// Caixa Diário JS
import { supabase } from '../../supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    await carregarStatusCaixa();
});

async function carregarStatusCaixa() {
    try {
        const { data, error } = await supabase
            .from('cash_registers')
            .select('*')
            .eq('status', 'ABERTO')
            .limit(1);
            
        if (error) throw error;

        if (data && data.length > 0) {
            const caixa = data[0];
            document.getElementById('status-atual').innerText = '● CAIXA ABERTO';
            document.getElementById('status-atual').className = 'caixa-status aberto';
            document.getElementById('saldo-inicial').innerText = `R$ ${caixa.saldo_inicial}`;
            // Load movements logic would follow here linking to cash_movements
        } else {
            document.getElementById('status-atual').innerText = '○ CAIXA FECHADO';
            document.getElementById('status-atual').className = 'caixa-status fechado';
        }
    } catch (err) {
        console.error('Erro ao verificar caixa:', err);
    }
}
