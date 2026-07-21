import { FinanceRepository } from '../../repositories/finance.repository.js';
import { AuthRepository } from '../../repositories/auth.repository.js';
import { AgendaRepository } from '../../repositories/agenda.repository.js'; // For dashboard appointment count

document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('finance-table-body');
    const modal = document.getElementById('modal-pagamento');
    const form = document.getElementById('form-pagamento');
    
    let clinicId = null;

    try {
        const { data: { session } } = await AuthRepository.getSession();
        if (!session) return; 
        
        const profileRes = await AuthRepository.getPerfilUsuario(session.user.id);
        clinicId = profileRes.data.clinic_id;
    } catch (err) {
        console.error('Erro de inicialização:', err);
    }

    document.querySelectorAll('.close-modal').forEach(b => b.addEventListener('click', () => {
        modal.style.display = 'none';
        form.reset();
    }));

    const loadFinanceiro = async () => {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Carregando...</td></tr>';
        
        try {
            // Load Dashboard
            const dashRes = await FinanceRepository.getFinancialDashboard();
            if (dashRes.data) {
                const { receita, recebido, pendente } = dashRes.data;
                document.getElementById('dash_receita').textContent = `R$ ${receita.toFixed(2).replace('.', ',')}`;
                document.getElementById('dash_recebido').textContent = `R$ ${recebido.toFixed(2).replace('.', ',')}`;
                document.getElementById('dash_pendente').textContent = `R$ ${pendente.toFixed(2).replace('.', ',')}`;
            }

            const appsRes = await AgendaRepository.getAppointmentsSummary(clinicId);
            if (appsRes && appsRes.data) {
                document.getElementById('dash_consultas').textContent = appsRes.data.filter(a => a.status === 'concluida' || a.status === 'concluída').length;
            }

            // Load Table
            const { data, error } = await FinanceRepository.getTransactions();
            if (error) throw error;

            tableBody.innerHTML = '';
            
            if (!data || data.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Nenhum lançamento encontrado.</td></tr>';
                return;
            }

            data.forEach(t => {
                const tr = document.createElement('tr');
                
                let paciente = t.patients ? t.patients.nome : 'N/A';
                let prof = t.appointments && t.appointments.professionals ? t.appointments.professionals.nome : 'Geral';
                let consulta = t.appointments ? new Date(t.appointments.data).toLocaleDateString() : '-';
                let valor = parseFloat(t.valor_total || 0).toFixed(2).replace('.', ',');
                
                let badgeClass = 'badge-warning';
                let statusLabel = 'Pendente';
                if (t.status === 'PAGO' || t.status === 'CONCLUIDO') { badgeClass = 'badge-success'; statusLabel = 'Pago'; }
                if (t.status === 'CANCELADO') { badgeClass = 'badge-danger'; statusLabel = 'Cancelado'; }

                tr.innerHTML = `
                    <td><strong>${paciente}</strong></td>
                    <td>${prof}</td>
                    <td>${consulta}</td>
                    <td>R$ ${valor}</td>
                    <td>-</td> <!-- Forma de pag na view atual (viria do split payments) -->
                    <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
                    <td>
                        ${t.status !== 'PAGO' && t.status !== 'CANCELADO' ? `<button class="admin-btn admin-btn-outline btn-pay" data-id="${t.id}" data-paciente="${paciente}" data-valor="${t.valor_total}" style="padding:4px 8px; color:var(--admin-success); border-color:var(--admin-success);"><i class="fas fa-dollar-sign"></i> Receber</button>` : '-'}
                    </td>
                `;
                tableBody.appendChild(tr);
            });

            document.querySelectorAll('.btn-pay').forEach(btn => btn.addEventListener('click', (e) => {
                const docId = e.currentTarget.dataset.id;
                const pacNome = e.currentTarget.dataset.paciente;
                const valorTotal = e.currentTarget.dataset.valor;
                
                document.getElementById('pag_doc_id').value = docId;
                document.getElementById('pag_paciente_nome').textContent = pacNome;
                document.getElementById('pag_valor').textContent = `R$ ${parseFloat(valorTotal).toFixed(2).replace('.', ',')}`;
                
                modal.style.display = 'flex';
            }));

        } catch (err) {
            console.error('Erro Load Financeiro:', err);
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:red;">Erro ao buscar dados.</td></tr>';
        }
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnSalvar = document.getElementById('btn-confirmar-pagamento');
        btnSalvar.disabled = true;

        const docId = document.getElementById('pag_doc_id').value;
        const formPayment = document.querySelector('input[name="pag_forma"]:checked').value;
        const valorRaw = document.getElementById('pag_valor').textContent.replace('R$ ', '').replace(',', '.');
        const valorPago = parseFloat(valorRaw);

        // O DB espera um ID de payment_method para PIX, DINHEIRO, etc.
        // Se a tabela payment_methods estiver vazia, o insert no payments pode falhar se não houver FK flexível (a migration restringe).
        // Vamos buscar ou bypassar de forma simples
        let methodId = null;
        try {
            const { data: methods } = await FinanceRepository.getPaymentMethods(clinicId);
            if (methods && methods.length > 0) {
               const found = methods.find(m => m.nome.toUpperCase() === formPayment.toUpperCase());
               if(found) methodId = found.id;
               else methodId = methods[0].id; // fallback
            }
        } catch(e) {}

        const paymentPayload = {
            valor_pago: valorPago,
            payment_method_id: methodId,
            status: 'CONCLUIDO'
        };

        // Se payment_method_id for null (banco zerado), remover o field para não dar erro (a FK aceita NULL dependendo do schema).
        // Mas a FK restringe. Na migration 011: payment_method_id UUID REFERENCES public.payment_methods(id). Sem NOT NULL.
        if (!paymentPayload.payment_method_id) delete paymentPayload.payment_method_id;

        try {
            await FinanceRepository.updatePaymentStatus(docId, 'PAGO', paymentPayload);
            window.Toast.success('Pagamento registrado com sucesso!');
            modal.style.display = 'none';
            loadFinanceiro();
        } catch(err) {
            console.error(err);
            window.Toast.error('Erro ao registrar pagamento.');
        } finally {
            btnSalvar.disabled = false;
        }
    });

    loadFinanceiro();
});
