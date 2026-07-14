// Módulo de Gerenciamento Administrativo (CRUD, Férias e Bloqueios) - Clínica Zoe

const AdminModule = {
  // --- INICIALIZAÇÃO E ABERTURA DE MODAIS ---
  init() {
    this.setupModalTriggers();
    this.setupFormSubmits();
  },

  setupModalTriggers() {
    // Abrir Gerenciamento de Profissionais
    const btnManageProfs = document.getElementById('btn-manage-professionals');
    if (btnManageProfs) {
      btnManageProfs.addEventListener('click', () => {
        this.openModal('modal-professionals');
        this.loadProfessionalsList();
        this.populateSpecialtyDropdowns();
      });
    }

    // Abrir Gerenciamento de Especialidades
    const btnManageSpecs = document.getElementById('btn-manage-specialties');
    if (btnManageSpecs) {
      btnManageSpecs.addEventListener('click', () => {
        this.openModal('modal-specialties');
        this.loadSpecialtiesList();
      });
    }

    // Abrir Configurações de Bloqueio/Férias
    const btnManageBlocks = document.getElementById('btn-manage-blocks');
    if (btnManageBlocks) {
      btnManageBlocks.addEventListener('click', () => {
        this.openModal('modal-blocks');
        this.populateDoctorDropdowns();
        this.loadBlocksAndVacationsList();
      });
    }

    // Configurar fechamento de todos os modais
    document.querySelectorAll('.modal .btn-close-modal, .modal .close-modal-icon').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) modal.style.display = 'none';
      });
    });

    // Fechar ao clicar fora do modal
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
      }
    });
  },

  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = 'block';
      // Resetar formulários dentro do modal
      const forms = modal.querySelectorAll('form');
      forms.forEach(f => f.reset());
      // Ocultar formulários de edição
      const editDiv = modal.querySelector('.edit-form-container');
      if (editDiv) editDiv.style.display = 'none';
    }
  },

  // --- PREENCHIMENTO DE DROPDOWNS ---
  populateSpecialtyDropdowns() {
    const selects = ['prof-especialidade'];
    selects.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (select && window.dashboardSpecialties) {
        select.innerHTML = window.dashboardSpecialties.map(s => 
          `<option value="${s.id}">${s.nome}</option>`
        ).join('');
      }
    });
  },

  populateDoctorDropdowns() {
    const selects = ['block-prof-id', 'vacation-prof-id'];
    selects.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (select && window.dashboardProfessionals) {
        select.innerHTML = window.dashboardProfessionals.map(p => 
          `<option value="${p.id}">${p.nome}</option>`
        ).join('');
      }
    });
  },

  // --- CRUD: PROFISSIONAIS ---
  async loadProfessionalsList() {
    const container = document.getElementById('admin-professionals-list');
    if (!container) return;

    container.innerHTML = '<tr><td colspan="5">Carregando médicos...</td></tr>';
    
    // Recarrega do banco para garantir consistência
    const { data: profs } = await window.supabaseClient.from('profissionais').select('*');
    if (!profs) return;

    container.innerHTML = profs.map(p => {
      const spec = window.dashboardSpecialties?.find(s => s.id === p.especialidade_id);
      return `
        <tr>
          <td><strong>${p.nome}</strong></td>
          <td>${spec ? spec.nome : 'Geral'}</td>
          <td>${p.email}</td>
          <td><span class="status-badge ${p.ativo ? 'badge-confirmed' : 'badge-canceled'}">${p.ativo ? 'Ativo' : 'Inativo'}</span></td>
          <td>
            <button class="action-btn text-warning" onclick="AdminModule.editProfessional('${p.id}')"><i class="fas fa-edit"></i></button>
            <button class="action-btn text-danger" onclick="AdminModule.deleteProfessional('${p.id}')"><i class="far fa-trash-alt"></i></button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async editProfessional(id) {
    const { data } = await window.supabaseClient.from('profissionais').select('*').eq('id', id);
    if (!data || data.length === 0) return;
    const p = data[0];

    const editContainer = document.querySelector('#modal-professionals .edit-form-container');
    editContainer.style.display = 'block';

    document.getElementById('edit-prof-id').value = p.id;
    document.getElementById('edit-prof-nome').value = p.nome;
    document.getElementById('edit-prof-email').value = p.email;
    document.getElementById('edit-prof-whatsapp').value = p.whatsapp;
    document.getElementById('edit-prof-mini-curriculo').value = p.mini_curriculo;
    document.getElementById('edit-prof-foto').value = p.foto || '';
    document.getElementById('edit-prof-inicio').value = p.horario_inicio.substring(0, 5);
    document.getElementById('edit-prof-fim').value = p.horario_fim.substring(0, 5);
    document.getElementById('edit-prof-ativo').checked = p.ativo;

    // Selecionar dias de atendimento (dias_atendimento array)
    const selectSpec = document.getElementById('edit-prof-especialidade');
    if (selectSpec && window.dashboardSpecialties) {
      selectSpec.innerHTML = window.dashboardSpecialties.map(s => 
        `<option value="${s.id}" ${s.id === p.especialidade_id ? 'selected' : ''}>${s.nome}</option>`
      ).join('');
    }

    // Checkboxes dos dias de atendimento
    const dayCheckboxes = document.querySelectorAll('.edit-prof-days-checkbox');
    dayCheckboxes.forEach(cb => {
      cb.checked = p.dias_atendimento.includes(cb.value);
    });
  },

  async deleteProfessional(id) {
    if (confirm("Aviso: Excluir este profissional impedirá novos agendamentos para ele. Deseja continuar?")) {
      try {
        const { error } = await window.supabaseClient.from('profissionais').delete().eq('id', id);
        if (error) throw error;
        window.Notifications.show('Médico Excluído', 'Médico removido com sucesso.', 'success');
        this.loadProfessionalsList();
        if (window.refreshDashboard) window.refreshDashboard();
      } catch (err) {
        window.Notifications.show('Erro', 'Não é possível excluir médicos com agendamentos ativos.', 'error');
      }
    }
  },

  // --- CRUD: ESPECIALIDADES ---
  async loadSpecialtiesList() {
    const container = document.getElementById('admin-specialties-list');
    if (!container) return;

    container.innerHTML = '<tr><td colspan="3">Carregando especialidades...</td></tr>';
    
    const { data: specs } = await window.supabaseClient.from('especialidades').select('*');
    if (!specs) return;

    container.innerHTML = specs.map(s => `
      <tr>
        <td><i class="fas ${s.icone}"></i></td>
        <td><strong>${s.nome}</strong></td>
        <td>${s.descricao}</td>
      </tr>
    `).join('');
  },

  // --- BLOQUEIOS E FÉRIAS ---
  async loadBlocksAndVacationsList() {
    const blockContainer = document.getElementById('admin-blocks-list');
    const vacContainer = document.getElementById('admin-vacations-list');

    if (blockContainer) {
      blockContainer.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
      const { data: blocks } = await window.supabaseClient.from('horarios_bloqueados').select('*');
      if (blocks) {
        blockContainer.innerHTML = blocks.map(b => {
          const prof = window.dashboardProfessionals?.find(p => p.id === b.profissional_id);
          const formattedDate = new Date(b.data + 'T00:00:00').toLocaleDateString('pt-BR');
          return `
            <tr>
              <td>${prof ? prof.nome : 'Médico'}</td>
              <td>${formattedDate}</td>
              <td>${b.horario_inicio.substring(0, 5)} - ${b.horario_fim.substring(0, 5)}</td>
              <td>${b.motivo}</td>
              <td><button class="action-btn text-danger" onclick="AdminModule.deleteBlock('${b.id}')"><i class="far fa-trash-alt"></i></button></td>
            </tr>
          `;
        }).join('');
      }
    }

    if (vacContainer) {
      vacContainer.innerHTML = '<tr><td colspan="4">Carregando...</td></tr>';
      const { data: vacations } = await window.supabaseClient.from('ferias').select('*');
      if (vacations) {
        vacContainer.innerHTML = vacations.map(v => {
          const prof = window.dashboardProfessionals?.find(p => p.id === v.profissional_id);
          const start = new Date(v.inicio + 'T00:00:00').toLocaleDateString('pt-BR');
          const end = new Date(v.fim + 'T00:00:00').toLocaleDateString('pt-BR');
          return `
            <tr>
              <td>${prof ? prof.nome : 'Médico'}</td>
              <td>${start} a ${end}</td>
              <td>Férias</td>
              <td><button class="action-btn text-danger" onclick="AdminModule.deleteVacation('${v.id}')"><i class="far fa-trash-alt"></i></button></td>
            </tr>
          `;
        }).join('');
      }
    }
  },

  async deleteBlock(id) {
    if (confirm("Deseja remover este bloqueio de horário?")) {
      await window.supabaseClient.from('horarios_bloqueados').delete().eq('id', id);
      window.Notifications.show('Bloqueio Removido', 'Horário liberado.', 'success');
      this.loadBlocksAndVacationsList();
    }
  },

  async deleteVacation(id) {
    if (confirm("Deseja cancelar o período de férias?")) {
      await window.supabaseClient.from('ferias').delete().eq('id', id);
      window.Notifications.show('Férias Removida', 'Período liberado na agenda.', 'success');
      this.loadBlocksAndVacationsList();
    }
  },

  // --- ENVIO DE FORMULÁRIOS ---
  setupFormSubmits() {
    // 1. Criar Novo Profissional
    const formCreateProf = document.getElementById('form-create-professional');
    if (formCreateProf) {
      formCreateProf.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const days = [];
        formCreateProf.querySelectorAll('.prof-days-checkbox:checked').forEach(cb => days.push(cb.value));

        const payload = {
          nome: document.getElementById('prof-nome').value,
          especialidade_id: document.getElementById('prof-especialidade').value,
          email: document.getElementById('prof-email').value,
          whatsapp: document.getElementById('prof-whatsapp').value,
          mini_curriculo: document.getElementById('prof-mini-curriculo').value,
          foto: document.getElementById('prof-foto').value || 'https://via.placeholder.com/150',
          horario_inicio: document.getElementById('prof-inicio').value,
          horario_fim: document.getElementById('prof-fim').value,
          dias_atendimento: days,
          ativo: true
        };

        const { error } = await window.supabaseClient.from('profissionais').insert(payload);
        if (error) {
          window.Notifications.show('Falha ao Criar', error.message, 'error');
        } else {
          window.Notifications.show('Médico Cadastrado', 'Médico inserido com sucesso.', 'success');
          formCreateProf.reset();
          this.loadProfessionalsList();
          if (window.refreshDashboard) window.refreshDashboard();
        }
      });
    }

    // 2. Editar Profissional Existente
    const formEditProf = document.getElementById('form-edit-professional');
    if (formEditProf) {
      formEditProf.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('edit-prof-id').value;
        const days = [];
        formEditProf.querySelectorAll('.edit-prof-days-checkbox:checked').forEach(cb => days.push(cb.value));

        const payload = {
          nome: document.getElementById('edit-prof-nome').value,
          especialidade_id: document.getElementById('edit-prof-especialidade').value,
          email: document.getElementById('edit-prof-email').value,
          whatsapp: document.getElementById('edit-prof-whatsapp').value,
          mini_curriculo: document.getElementById('edit-prof-mini-curriculo').value,
          foto: document.getElementById('edit-prof-foto').value,
          horario_inicio: document.getElementById('edit-prof-inicio').value,
          horario_fim: document.getElementById('edit-prof-fim').value,
          dias_atendimento: days,
          ativo: document.getElementById('edit-prof-ativo').checked
        };

        const { error } = await window.supabaseClient.from('profissionais').update(payload).eq('id', id);
        if (error) {
          window.Notifications.show('Erro ao Atualizar', error.message, 'error');
        } else {
          window.Notifications.show('Médico Atualizado', 'Cadastro alterado com sucesso.', 'success');
          document.querySelector('#modal-professionals .edit-form-container').style.display = 'none';
          this.loadProfessionalsList();
          if (window.refreshDashboard) window.refreshDashboard();
        }
      });
    }

    // 3. Adicionar Nova Especialidade
    const formCreateSpec = document.getElementById('form-create-specialty');
    if (formCreateSpec) {
      formCreateSpec.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
          nome: document.getElementById('spec-nome').value,
          descricao: document.getElementById('spec-descricao').value,
          icone: document.getElementById('spec-icone').value
        };

        const { error } = await window.supabaseClient.from('especialidades').insert(payload);
        if (error) {
          window.Notifications.show('Erro ao Criar', error.message, 'error');
        } else {
          window.Notifications.show('Especialidade Criada', 'Especialidade adicionada ao painel.', 'success');
          formCreateSpec.reset();
          this.loadSpecialtiesList();
          if (window.refreshDashboard) window.refreshDashboard();
        }
      });
    }

    // 4. Cadastrar Bloqueio de Horário
    const formBlock = document.getElementById('form-create-block');
    if (formBlock) {
      formBlock.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
          profissional_id: document.getElementById('block-prof-id').value,
          data: document.getElementById('block-date').value,
          horario_inicio: document.getElementById('block-start-time').value,
          horario_fim: document.getElementById('block-end-time').value,
          motivo: document.getElementById('block-reason').value
        };

        const { error } = await window.supabaseClient.from('horarios_bloqueados').insert(payload);
        if (error) {
          window.Notifications.show('Erro ao Bloquear', error.message, 'error');
        } else {
          window.Notifications.show('Horário Bloqueado', 'Médico bloqueado no horário escolhido.', 'success');
          formBlock.reset();
          this.loadBlocksAndVacationsList();
        }
      });
    }

    // 5. Cadastrar Férias
    const formVacation = document.getElementById('form-create-vacation');
    if (formVacation) {
      formVacation.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
          profissional_id: document.getElementById('vacation-prof-id').value,
          inicio: document.getElementById('vacation-start-date').value,
          fim: document.getElementById('vacation-end-date').value
        };

        const { error } = await window.supabaseClient.from('ferias').insert(payload);
        if (error) {
          window.Notifications.show('Erro ao salvar Férias', error.message, 'error');
        } else {
          window.Notifications.show('Férias Cadastradas', 'Agenda bloqueada para o período de férias.', 'success');
          formVacation.reset();
          this.loadBlocksAndVacationsList();
        }
      });
    }
  }
};

// Inicializar na abertura da página
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dashboard-app')) {
    AdminModule.init();
  }
});

// Expõe globalmente para botões do onclick HTML funcionarem
window.AdminModule = AdminModule;
