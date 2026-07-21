import { PatientsRepository } from '../../repositories/patients.repository.js';
import { AuthRepository } from '../../repositories/auth.repository.js';

// Tab Logic
window.openTab = function(evt, tabName) {
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    document.querySelectorAll('.tab-link').forEach(tl => tl.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

document.addEventListener('DOMContentLoaded', async () => {
    const tableBody = document.getElementById('pacientes-table-body');
    const modal = document.getElementById('modal-paciente');
    const form = document.getElementById('form-paciente');
    
    let clinicId = null;
    let userRole = null;

    try {
        const { data: { session } } = await AuthRepository.getSession();
        if (!session) return; 
        
        const profileRes = await AuthRepository.getPerfilUsuario(session.user.id);
        clinicId = profileRes.data.clinic_id;
        userRole = profileRes.data.roles.nome;
    } catch (err) {
        console.error('Erro de inicialização:', err);
    }

    document.querySelectorAll('.close-modal').forEach(b => b.addEventListener('click', () => {
        modal.classList.remove('active');
        form.reset();
    }));

    document.getElementById('btn-novo-paciente').addEventListener('click', () => {
        document.getElementById('modal-title').textContent = 'Novo Paciente';
        document.getElementById('pac_id').value = '';
        document.getElementById('lbl_total_consultas').textContent = '0';
        document.getElementById('lbl_total_aberto').textContent = 'R$ 0,00';
        document.getElementById('pac_status').value = 'Ativo';
        modal.classList.add('active');
        document.querySelector('.tab-link').click(); // Volta para 1a aba
    });

    const loadPacientes = async (searchTerm = '') => {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Carregando...</td></tr>';
        
        try {
            const { data, error } = await PatientsRepository.getPatients();
            if (error) throw error;
            
            // Dashboard Stats
            let ativos = 0;
            let novosMes = 0;
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();

            const filteredData = data.filter(p => {
                const searchStr = `${p.nome} ${p.cpf} ${p.patient_contacts?.[0]?.telefone} ${p.patient_contacts?.[0]?.email}`.toLowerCase();
                if (searchTerm && !searchStr.includes(searchTerm.toLowerCase())) return false;
                
                if (p.status === 'Ativo') ativos++;
                
                const createdDate = new Date(p.created_at);
                if (createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear) {
                    novosMes++;
                }

                return true;
            });

            // Update Dash
            if (!searchTerm) {
                document.getElementById('dash_total').textContent = data.length;
                document.getElementById('dash_ativos').textContent = ativos;
                document.getElementById('dash_novos').textContent = novosMes;
                
                const appsRes = await PatientsRepository.getAppointmentsSummary(clinicId);
                if (appsRes.data) {
                    document.getElementById('dash_consultas').textContent = appsRes.data.filter(a => a.status === 'concluida' || a.status === 'concluída').length;
                }
            }

            tableBody.innerHTML = '';
            
            if (filteredData.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Nenhum paciente encontrado.</td></tr>';
                return;
            }

            for (const p of filteredData) {
                const tr = document.createElement('tr');
                const contato = p.patient_contacts && p.patient_contacts.length > 0 ? p.patient_contacts[0] : {};
                const foneWhats = contato.whatsapp || contato.telefone || '-';
                
                let dataProx = 'Nenhuma';
                // Para pegar próxima consulta e status financeiro seria via um RPC de resumo
                // Como não queremos criar um novo RPC, simularemos vazio.
                
                let statusBadge = p.status === 'Ativo' ? 'badge-success' : 'badge-danger';
                
                tr.innerHTML = `
                    <td>
                        <div style="font-weight:600;">${p.nome}</div>
                        <div style="font-size:0.8rem; color:var(--admin-text-muted);">${contato.email || ''}</div>
                    </td>
                    <td>${p.cpf || '-'}</td>
                    <td>${foneWhats}</td>
                    <td>${dataProx}</td>
                    <td style="color:inherit">R$ 0,00</td>
                    <td><span class="badge ${statusBadge}">${p.status}</span></td>
                    <td>
                        <button class="admin-btn admin-btn-outline btn-edit" data-id="${p.id}" style="padding:4px 8px;"><i class="fas fa-edit"></i></button>
                    </td>
                `;
                tableBody.appendChild(tr);
            }

            document.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', (e) => editPaciente(e.currentTarget.dataset.id)));

        } catch (err) {
            console.error('Erro Load Pacientes:', err);
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:red;">Erro ao buscar pacientes.</td></tr>';
        }
    };

    const editPaciente = async (id) => {
        try {
            const { data } = await PatientsRepository.getPatientById(id);
            const contato = data.patient_contacts && data.patient_contacts.length > 0 ? data.patient_contacts[0] : {};

            document.getElementById('modal-title').textContent = 'Editar Paciente';
            document.getElementById('pac_id').value = data.id;
            
            // Tab Dados Pessoais
            document.getElementById('pac_nome').value = data.nome || '';
            document.getElementById('pac_cpf').value = data.cpf || '';
            document.getElementById('pac_nascimento').value = data.data_nascimento || '';
            document.getElementById('pac_sexo').value = data.sexo || 'O';
            document.getElementById('pac_telefone').value = contato.telefone || '';
            document.getElementById('pac_whatsapp').value = contato.whatsapp || '';
            document.getElementById('pac_email').value = contato.email || '';
            document.getElementById('pac_status').value = data.status || 'Ativo';
            document.getElementById('pac_alerta').value = data.alerta_medico || '';
            document.getElementById('pac_observacao').value = data.observacoes || '';
            
            // Tab Endereco
            document.getElementById('pac_cep').value = data.endereco_cep || '';
            document.getElementById('pac_logradouro').value = data.endereco_logradouro || '';
            document.getElementById('pac_numero').value = data.endereco_numero || '';
            document.getElementById('pac_bairro').value = data.endereco_bairro || '';

            // Historico de Consultas
            const hist = await PatientsRepository.getPatientHistory(data.id);
            if(hist && hist.data) {
                document.getElementById('lbl_total_consultas').textContent = hist.data.length;
            }

            modal.classList.add('active');
        } catch (err) {
            console.error(err);
            window.Toast.error('Erro ao abrir paciente.');
        }
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Bloquear botão
        const btnSalvar = document.getElementById('btn-salvar');
        btnSalvar.disabled = true;
        btnSalvar.textContent = 'Salvando...';

        const id = document.getElementById('pac_id').value;
        
        const payload = {
            clinic_id: clinicId,
            nome: document.getElementById('pac_nome').value,
            cpf: document.getElementById('pac_cpf').value || null,
            data_nascimento: document.getElementById('pac_nascimento').value || null,
            sexo: document.getElementById('pac_sexo').value,
            status: document.getElementById('pac_status').value,
            alerta_medico: document.getElementById('pac_alerta').value || null,
            observacoes: document.getElementById('pac_observacao').value || null,
            endereco_cep: document.getElementById('pac_cep').value || null,
            endereco_logradouro: document.getElementById('pac_logradouro').value || null,
            endereco_numero: document.getElementById('pac_numero').value || null,
            endereco_bairro: document.getElementById('pac_bairro').value || null
        };

        const contactPayload = {
            telefone: document.getElementById('pac_telefone').value || null,
            whatsapp: document.getElementById('pac_whatsapp').value || null,
            email: document.getElementById('pac_email').value || null
        };

        try {
            if (id) {
                await PatientsRepository.updatePatient(id, payload, contactPayload);
                window.Toast.success('Paciente atualizado com sucesso.');
            } else {
                await PatientsRepository.createPatient(payload, contactPayload);
                window.Toast.success('Paciente cadastrado com sucesso!');
            }
            modal.classList.remove('active');
            loadPacientes();
        } catch(err) {
            console.error(err);
            if (err.code === '23505') {
                window.Toast.error('Erro: CPF já cadastrado no sistema.');
            } else {
                window.Toast.error('Erro ao salvar paciente: ' + (err.message || 'Desconhecido'));
            }
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.textContent = 'Salvar Paciente';
        }
    });

    let debounce;
    document.getElementById('search-paciente').addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => loadPacientes(e.target.value), 400);
    });

    loadPacientes();
});
