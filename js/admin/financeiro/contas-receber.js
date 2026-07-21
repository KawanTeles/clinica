// Contas a Receber JS
import { supabase } from '../../supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    await carregarContasReceber();
});

async function carregarContasReceber() {
    try {
        const tbody = document.querySelector('#tabela-receber tbody');
        tbody.innerHTML = '<tr><td colspan="9">Carregando...</td></tr>';

        const { data, error } = await supabase
            .from('financial_documents')
            .select('*, patients(nome), appointments(professional_id)')
            .eq('tipo', 'RECEITA')
            .order('data_vencimento', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = '';
        data.forEach(doc => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Documento">DOC-${doc.id.split('-')[0]}</td>
                <td data-label="Paciente">${doc.patients?.nome || 'Avulso'}</td>
                <td data-label="Profissional">Dr(a) ID: ${doc.appointments?.professional_id || 'N/A'}</td>
                <td data-label="Valor Total">R$ ${doc.valor_total}</td>
                <td data-label="Pago">R$ ${(doc.valor_total - doc.saldo_devedor).toFixed(2)}</td>
                <td data-label="Saldo">R$ ${doc.saldo_devedor}</td>
                <td data-label="Vencimento">${new Date(doc.data_vencimento).toLocaleDateString()}</td>
                <td data-label="Status"><span class="status-badge st-${doc.status.toLowerCase()}">${doc.status}</span></td>
                <td data-label="Ações"><button class="btn-secundario btn-sm">Receber</button></td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error('Erro ao carregar contas a receber:', err);
    }
}
