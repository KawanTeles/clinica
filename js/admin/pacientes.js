import { PacientesRepository } from '../../repositories/pacientes.repository.js';

// Tab Logic
window.openTab = function(evt, tabName) {
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    document.querySelectorAll('.tab-link').forEach(tl => tl.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('pacientes-table-body');
    const modal = document.getElementById('modal-paciente');
    const form = document.getElementById('form-paciente');
    
    document.querySelectorAll('.close-modal').forEach(b => b.addEventListener('click', () => {
        modal.classList.remove('active');
        form.reset();
    }));

    document.getElementById('btn-novo-paciente').addEventListener('click', () => {
        document.getElementById('modal-title').textContent = 'Novo Paciente';
        document.getElementById('pac_id').value = '';
        document.getElementById('lbl_total_consultas').textContent = '0';
        document.getElementById('lbl_total_aberto').textContent = 'R$ 0,00';
        modal.classList.add('active');
        document.querySelector('.tab-link').click(); // Volta para 1a aba
    });

    const loadPacientes = async (searchTerm = '') => {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Carregando...</td></tr>';
        
        const { data, error } = await PacientesRepository.listarPacientesComFinanceiro(searchTerm);
        if(error || !data) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:red;">Erro ao buscar pacientes.</td></tr>';
            return;
        }

        tableBody.innerHTML = '';
        data.forEach(p => {
            const tr = document.createElement('tr');
            const dataProx = p.proxima_consulta ? new Date(p.proxima_consulta).toLocaleDateString() : 'Nenhuma';
            
            tr.innerHTML = `
                <td>
                    <div style="font-weight:600;">${p.nome}</div>
                    <div style="font-size:0.8rem; color:var(--admin-text-muted);">${p.patients.whatsapp || p.patients.telefone || '-'}</div>
                </td>
                <td>${p.cpf}</td>
                <td>${p.patients.whatsapp || '-'}</td>
                <td>${dataProx}</td>
                <td style="color:${p.total_em_aberto > 0 ? 'red' : 'inherit'}">R$ ${p.total_em_aberto.toFixed(2)}</td>
                <td><span class="badge badge-success">${p.patients.status}</span></td>
                <td>
                    <button class="admin-btn admin-btn-outline btn-edit" data-id="${p.patient_id}" style="padding:4px 8px;"><i class="fas fa-edit"></i></button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        document.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', (e) => editPaciente(e.currentTarget.dataset.id)));
    };

    const editPaciente = async (id) => {
        const { data } = await PacientesRepository.buscarPaciente(id);
        const { data: fin } = await PacientesRepository.buscarResumoFinanceiro(id);
        
        document.getElementById('modal-title').textContent = 'Editar Paciente';
        document.getElementById('pac_id').value = data.id;
        document.getElementById('pac_nome').value = data.nome;
        document.getElementById('pac_cpf').value = data.cpf;
        document.getElementById('pac_nascimento').value = data.data_nascimento || '';
        document.getElementById('pac_whatsapp').value = data.whatsapp || '';
        document.getElementById('pac_email').value = data.email || '';
        document.getElementById('pac_alerta').value = data.alerta_medico || '';
        
        document.getElementById('pac_cep').value = data.cep || '';
        document.getElementById('pac_logradouro').value = data.logradouro || '';
        document.getElementById('pac_numero').value = data.numero || '';
        document.getElementById('pac_bairro').value = data.bairro || '';

        if(fin) {
            document.getElementById('lbl_total_consultas').textContent = fin.total_consultas;
            document.getElementById('lbl_total_aberto').textContent = `R$ ${fin.total_em_aberto.toFixed(2)}`;
        }

        modal.classList.add('active');
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('pac_id').value;
        const payload = {
            nome: document.getElementById('pac_nome').value,
            cpf: document.getElementById('pac_cpf').value,
            data_nascimento: document.getElementById('pac_nascimento').value || null,
            whatsapp: document.getElementById('pac_whatsapp').value,
            email: document.getElementById('pac_email').value || null,
            alerta_medico: document.getElementById('pac_alerta').value,
            cep: document.getElementById('pac_cep').value,
            logradouro: document.getElementById('pac_logradouro').value,
            numero: document.getElementById('pac_numero').value,
            bairro: document.getElementById('pac_bairro').value
        };

        try {
            if (id) {
                // UPDATE
                const { error } = await PacientesRepository.atualizarPaciente(id, payload);
                if (error) throw error;
                window.Toast.success('Paciente atualizado. Histórico salvo automaticamente pela Trigger SQL.');
            } else {
                // INSERT
                const { error } = await PacientesRepository.criarPaciente(payload);
                if (error) {
                    if (error.code === '23505') throw new Error('CPF ou E-mail já cadastrados.');
                    throw error;
                }
                window.Toast.success('Paciente cadastrado com sucesso!');
            }
            modal.classList.remove('active');
            loadPacientes();
        } catch(err) {
            window.Toast.error(err.message);
        }
    });

    let debounce;
    document.getElementById('search-paciente').addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => loadPacientes(e.target.value), 400);
    });

    loadPacientes();
});
