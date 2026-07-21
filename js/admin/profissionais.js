import { ProfessionalsRepository } from '../../repositories/professionals.repository.js';
import { AuthRepository } from '../../repositories/auth.repository.js';

document.addEventListener('DOMContentLoaded', async () => {
  let clinicId = null;
  let isEditMode = false;
  let currentProfId = null;

  try {
    const { data: { session } } = await AuthRepository.getSession();
    if (!session) return; 

    const profileRes = await AuthRepository.getPerfilUsuario(session.user.id);
    clinicId = profileRes.data.clinic_id;
    const userRole = profileRes.data.roles.nome;

    if (userRole === 'RECEPCIONISTA') {
        // Guard already blocks, but just in case
        return;
    }

    setupEvents(userRole);
    await loadProfessionals();
  } catch (err) {
    console.error('Erro de inicialização Profissionais:', err);
  }

  function setupEvents(userRole) {
    const btnNovo = document.getElementById('btn-novo-prof');
    const modal = document.getElementById('modal-prof');
    const btnClose = document.getElementById('close-modal-prof');
    const btnCancelar = document.getElementById('btn-cancelar');
    const form = document.getElementById('form-prof');
    const searchInput = document.getElementById('search-prof');

    if (userRole === 'PROFISSIONAL') {
      if (btnNovo) btnNovo.style.display = 'none'; // Profissional não cria novo profissional
    }

    if (btnNovo) {
      btnNovo.addEventListener('click', () => {
        isEditMode = false;
        currentProfId = null;
        form.reset();
        document.getElementById('modal-title').textContent = 'Novo Profissional';
        document.getElementById('prof_senha').required = true;
        document.getElementById('prof_email').readOnly = false;
        modal.classList.add('active');
      });
    }

    if (btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));
    if (btnCancelar) btnCancelar.addEventListener('click', () => modal.classList.remove('active'));

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSalvar = document.getElementById('btn-salvar');
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        try {
          const payload = {
            nome: document.getElementById('prof_nome').value,
            email: document.getElementById('prof_email').value,
            especialidade: document.getElementById('prof_especialidade').value,
            registro_profissional: document.getElementById('prof_registro').value,
            telefone: document.getElementById('prof_telefone').value,
            whatsapp: document.getElementById('prof_whatsapp').value,
            valor_avista: parseFloat(document.getElementById('prof_avista').value),
            valor_cartao: parseFloat(document.getElementById('prof_cartao').value || 0),
            horarios: [document.getElementById('prof_horarios').value],
            dias: [document.getElementById('prof_dias').value],
            ativo: document.getElementById('prof_ativo').checked
          };

          const password = document.getElementById('prof_senha').value;

          if (isEditMode) {
            // Em modo de edição, se houver lógica para alterar senha (não suportado na RPC diretamente, precisaria de supabase admin)
            // Vamos apenas atualizar os dados do professional.
            await ProfessionalsRepository.updateProfessional(currentProfId, payload);
            alert('Profissional atualizado com sucesso!');
          } else {
            // Criar Novo
            payload.password = password;
            await ProfessionalsRepository.createProfessional(payload);
            alert('Profissional e usuário criados com sucesso!');
          }

          modal.classList.remove('active');
          await loadProfessionals();
        } catch (err) {
          console.error(err);
          alert('Erro ao salvar profissional: ' + (err.message || err.error_description || 'Desconhecido'));
        } finally {
          btnSalvar.disabled = false;
          btnSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar Profissional';
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const termo = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#prof-table-body tr');
        rows.forEach(row => {
          const texto = row.innerText.toLowerCase();
          row.style.display = texto.includes(termo) ? '' : 'none';
        });
      });
    }
  }

  async function loadProfessionals() {
    try {
      const profs = await ProfessionalsRepository.listProfessionals();
      const tbody = document.getElementById('prof-table-body');
      
      if (!profs || profs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem;">Nenhum profissional encontrado.</td></tr>';
        return;
      }

      tbody.innerHTML = profs.map(p => `
        <tr>
          <td>
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:32px; height:32px; border-radius:50%; background:var(--admin-primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold;">
                ${p.nome.charAt(0).toUpperCase()}
              </div>
              <div style="display:flex; flex-direction:column;">
                <strong>${p.nome}</strong>
                <small style="color:var(--admin-text-muted)">${p.telefone || ''}</small>
              </div>
            </div>
          </td>
          <td>${p.especialidade || '-'}</td>
          <td>${p.registro_profissional || '-'}</td>
          <td>À Vista: R$ ${p.valor_avista}<br>Cartão: R$ ${p.valor_cartao}</td>
          <td>
            <span class="status-badge ${p.ativo ? 'status-active' : 'status-inactive'}" style="padding:4px 8px; border-radius:4px; font-size:0.8rem; background:${p.ativo ? '#d4edda' : '#f8d7da'}; color:${p.ativo ? '#155724' : '#721c24'}">
              ${p.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </td>
          <td>
            <button class="btn-icon btn-edit" data-id="${p.id}" title="Editar" style="border:none; background:none; cursor:pointer; color:var(--admin-primary); margin-right:8px;"><i class="fas fa-edit"></i></button>
            <button class="btn-icon btn-toggle" data-id="${p.id}" data-active="${p.ativo}" title="${p.ativo ? 'Desativar' : 'Ativar'}" style="border:none; background:none; cursor:pointer; color:${p.ativo ? 'var(--admin-danger)' : 'var(--admin-success)'};"><i class="fas ${p.ativo ? 'fa-ban' : 'fa-check'}"></i></button>
          </td>
        </tr>
      `).join('');

      // Add listeners para os botões dinâmicos
      document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => openEditModal(btn.dataset.id));
      });
      document.querySelectorAll('.btn-toggle').forEach(btn => {
        btn.addEventListener('click', () => toggleStatus(btn.dataset.id, btn.dataset.active === 'true'));
      });

    } catch (err) {
      console.error('Erro ao carregar profissionais:', err);
    }
  }

  async function openEditModal(id) {
    try {
      const prof = await ProfessionalsRepository.getProfessionalById(id);
      
      isEditMode = true;
      currentProfId = id;
      
      document.getElementById('modal-title').textContent = 'Editar Profissional';
      document.getElementById('prof_nome').value = prof.nome;
      document.getElementById('prof_email').value = prof.email || '';
      document.getElementById('prof_email').readOnly = true; // Não permite trocar email por aqui, apenas via painel auth se preciso
      document.getElementById('prof_senha').required = false; // Não obriga preencher senha na edição
      document.getElementById('prof_especialidade').value = prof.especialidade || '';
      document.getElementById('prof_registro').value = prof.registro_profissional || '';
      document.getElementById('prof_telefone').value = prof.telefone || '';
      document.getElementById('prof_whatsapp').value = prof.whatsapp || '';
      document.getElementById('prof_avista').value = prof.valor_avista || 0;
      document.getElementById('prof_cartao').value = prof.valor_cartao || 0;
      
      // JSON arrays parsing
      const horarios = Array.isArray(prof.horarios_atendimento) ? prof.horarios_atendimento : [];
      const dias = Array.isArray(prof.dias_disponiveis) ? prof.dias_disponiveis : [];
      
      document.getElementById('prof_horarios').value = horarios.join(', ') || '';
      document.getElementById('prof_dias').value = dias.join(', ') || '';
      
      document.getElementById('prof_ativo').checked = prof.ativo;
      
      document.getElementById('modal-prof').classList.add('active');
    } catch (err) {
      console.error(err);
      alert('Erro ao carregar dados do profissional.');
    }
  }

  async function toggleStatus(id, currentlyActive) {
    if (confirm(`Deseja realmente ${currentlyActive ? 'desativar' : 'ativar'} este profissional?`)) {
      try {
        await ProfessionalsRepository.toggleStatus(id, !currentlyActive);
        await loadProfessionals();
      } catch (err) {
        console.error(err);
        alert('Erro ao alterar status.');
      }
    }
  }
});
