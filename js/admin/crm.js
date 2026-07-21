import { CrmRepository } from '../../repositories/crm.repository.js';
import { AuthRepository } from '../../repositories/auth.repository.js';
import { CrmEventsRepository } from '../../repositories/crm-events.repository.js';
import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('CRM Kanban Initialized (Phase 3.3)');
  
  const columns = document.querySelectorAll('.kanban-cards');
  let draggedCard = null;
  let currentUser = null;

  // Modal Elements
  const modal = document.getElementById('modal-crm-detalhes');
  const btnCloseModal = document.getElementById('btn-close-crm-modal');
  const formNovaInteracao = document.getElementById('form-nova-interacao');

  // Modal Novo Lead Elements
  const btnNovoLead = document.getElementById('btn-novo-lead');
  const modalNovoLead = document.getElementById('modal-novo-lead');
  const btnCloseNovoLead = document.getElementById('btn-close-novo-lead');
  const formNovoLead = document.getElementById('form-novo-lead');

  try {
    const session = await supabase.auth.getSession();
    if (!session.data.session) return;
    
    const userRes = await supabase.auth.getUser();
    currentUser = userRes.data.user;
    
    await loadPipeline();
    setupDragAndDrop();
    setupModalEvents();
    setupNovoLeadEvents();
    
  } catch (error) {
    console.error('Erro ao inicializar CRM Kanban:', error);
  }

  // ==========================================
  // PIPELINE KANBAN
  // ==========================================
  async function loadPipeline() {
    try {
      columns.forEach(col => {
        col.innerHTML = '<div style="text-align: center; color: var(--admin-text-muted); font-size: 0.85rem; padding: 10px;">Carregando...</div>';
        updateColumnCount(col);
      });

      const items = await CrmRepository.getPipeline();
      
      columns.forEach(col => {
        col.innerHTML = '';
      });

      items.forEach(item => {
        const stage = item.stage;
        const column = document.getElementById(`col-${stage.replace('_', '-')}`);
        if (column) {
          const card = createCardElement(item);
          column.appendChild(card);
          updateColumnCount(column);
        }
      });
    } catch (err) {
      console.error('Erro ao carregar pipeline:', err);
      alert('Erro ao carregar os dados do Kanban.');
    }
  }

  function createCardElement(item) {
    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-id', item.id);
    card.setAttribute('data-clinic-id', item.clinic_id);
    card.setAttribute('data-patient-id', item.patient_id);
    
    const pacienteNome = item.patients ? item.patients.nome : 'Paciente Desconhecido';
    const pacienteTelefone = item.patients && item.patients.telefone ? item.patients.telefone : '';
    const priorityClass = item.priority ? `priority-${item.priority}` : 'priority-media';
    
    card.innerHTML = `
      <div class="kanban-card-header">
        <span class="kanban-card-title">${pacienteNome}</span>
        <span class="kanban-card-priority ${priorityClass}">${item.priority || 'media'}</span>
      </div>
      <div class="kanban-card-body">
        ${pacienteTelefone ? `<i class="fas fa-phone"></i> ${pacienteTelefone}` : 'Sem contato'}
      </div>
      <div class="kanban-card-footer">
        <i class="fas fa-clock"></i> ${new Date(item.created_at).toLocaleDateString('pt-BR')}
      </div>
    `;

    card.addEventListener('dragstart', () => {
      draggedCard = card;
      setTimeout(() => card.classList.add('dragging'), 0);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      draggedCard = null;
    });

    // Abrir Modal
    card.addEventListener('click', (e) => {
      if (card.classList.contains('dragging')) return;
      openModal(item);
    });

    return card;
  }

  function updateColumnCount(column) {
    const countElement = column.parentElement.querySelector('.kanban-count');
    if (countElement) {
      countElement.textContent = column.children.length;
    }
  }

  function setupDragAndDrop() {
    columns.forEach(column => {
      column.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = getDragAfterElement(column, e.clientY);
        const dragging = document.querySelector('.dragging');
        if (dragging) {
          if (afterElement == null) {
            column.appendChild(dragging);
          } else {
            column.insertBefore(dragging, afterElement);
          }
        }
      });

      column.addEventListener('drop', async e => {
        e.preventDefault();
        if (draggedCard) {
          const newStage = column.parentElement.getAttribute('data-stage');
          const id = draggedCard.getAttribute('data-id');
          
          try {
            await CrmRepository.updatePipelineStage(id, newStage);
            
            // Disparar evento PIPELINE_CHANGED
            const clinicId = draggedCard.getAttribute('data-clinic-id') || document.getElementById('interacao-clinic-id').value || (await AuthRepository.getPerfilUsuario(currentUser.id)).data.clinic_id;
            await CrmEventsRepository.createEvent({
              clinic_id: clinicId,
              patient_id: draggedCard.getAttribute('data-patient-id'),
              event_type: 'PIPELINE_CHANGED',
              event_source: 'kanban_ui',
              payload: { stage: newStage, pipeline_id: id }
            }).catch(e => console.warn('Erro não-crítico ao salvar evento:', e));

            updateColumnCount(column);
            columns.forEach(col => updateColumnCount(col));
          } catch (err) {
            console.error('Erro ao mover card:', err);
            alert('Não foi possível mover o card. Verifique suas permissões.');
            await loadPipeline();
          }
        }
      });
    });
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.kanban-card:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // ==========================================
  // MODAL CRM
  // ==========================================
  function setupModalEvents() {
    btnCloseModal.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    formNovaInteracao.addEventListener('submit', async (e) => {
      e.preventDefault();
      const patientId = document.getElementById('interacao-patient-id').value;
      const clinicId = document.getElementById('interacao-clinic-id').value;
      const type = document.getElementById('interacao-tipo').value;
      const description = document.getElementById('interacao-descricao').value;

      try {
        const payload = {
          patient_id: patientId,
          clinic_id: clinicId,
          created_by: currentUser.id,
          type: type,
          description: description
        };
        const interaction = await CrmRepository.createInteraction(payload);
        
        // Disparar evento INTERACTION_CREATED
        await CrmEventsRepository.createEvent({
          clinic_id: clinicId,
          patient_id: patientId,
          event_type: 'INTERACTION_CREATED',
          event_source: 'modal_crm',
          payload: { interaction_id: interaction.id, type: type }
        }).catch(e => console.warn('Erro não-crítico ao salvar evento:', e));

        // Limpar e recarregar histórico
        document.getElementById('interacao-descricao').value = '';
        await loadInteractions(patientId);
      } catch (err) {
        console.error('Erro ao criar interação:', err);
        alert('Erro ao salvar a interação.');
      }
    });
  }

  function formatStage(stage) {
    const stages = {
      'novo_lead': 'Novo Lead',
      'contato_realizado': 'Contato Realizado',
      'consulta_agendada': 'Consulta Agendada',
      'paciente_ativo': 'Paciente Ativo',
      'retorno': 'Retorno'
    };
    return stages[stage] || stage;
  }

  async function openModal(item) {
    const pacienteNome = item.patients ? item.patients.nome : 'Desconhecido';
    const pacienteTelefone = item.patients && item.patients.telefone ? item.patients.telefone : 'Não informado';
    const pacienteEmail = item.patients && item.patients.email ? item.patients.email : 'Não informado';
    
    // Atualizar Header e Info
    document.getElementById('crm-modal-title').textContent = `Detalhes: ${pacienteNome}`;
    
    document.getElementById('crm-modal-info').innerHTML = `
      <p><strong>Telefone</strong> ${pacienteTelefone}</p>
      <p><strong>E-mail</strong> ${pacienteEmail}</p>
      <p><strong>Estágio Atual</strong> ${formatStage(item.stage)}</p>
      <p><strong>Prioridade</strong> <span style="text-transform: uppercase;">${item.priority || 'Média'}</span></p>
      <p><strong>Entrada</strong> ${new Date(item.created_at).toLocaleDateString('pt-BR')}</p>
    `;

    // Atualizar form hidden inputs
    document.getElementById('interacao-patient-id').value = item.patient_id;
    document.getElementById('interacao-clinic-id').value = item.clinic_id;

    modal.style.display = 'flex';

    // Carregar Dados Assíncronos
    await loadInteractions(item.patient_id);
    await loadTasks(item.clinic_id, item.patient_id);
  }

  function closeModal() {
    modal.style.display = 'none';
  }

  async function loadInteractions(patientId) {
    const container = document.getElementById('crm-modal-history');
    container.innerHTML = '<p style="text-align: center; font-size: 0.85rem;">Carregando...</p>';
    
    try {
      const interactions = await CrmRepository.getInteractions(patientId);
      
      if (interactions.length === 0) {
        container.innerHTML = '<p style="text-align: center; font-size: 0.85rem;">Nenhuma interação registrada.</p>';
        return;
      }

      container.innerHTML = interactions.map(int => `
        <div class="crm-list-item">
          <div class="crm-list-item-header">
            <span style="text-transform: capitalize;"><i class="fas fa-tag"></i> ${int.type}</span>
            <span>${new Date(int.created_at).toLocaleDateString('pt-BR')}</span>
          </div>
          <div class="crm-list-item-body">
            ${int.description}
          </div>
        </div>
      `).join('');

    } catch (err) {
      console.error('Erro ao carregar interações:', err);
      container.innerHTML = '<p style="text-align: center; font-size: 0.85rem; color: red;">Erro ao carregar histórico.</p>';
    }
  }

  async function loadTasks(clinicId, patientId) {
    const container = document.getElementById('crm-modal-tasks');
    container.innerHTML = '<p style="text-align: center; font-size: 0.85rem;">Carregando...</p>';
    
    try {
      const tasks = await CrmRepository.getTasks(clinicId, patientId);
      
      if (tasks.length === 0) {
        container.innerHTML = '<p style="text-align: center; font-size: 0.85rem;">Nenhuma tarefa pendente.</p>';
        return;
      }

      container.innerHTML = tasks.map(task => {
        const isOverdue = new Date(task.due_date) < new Date() && task.status !== 'concluida';
        const color = isOverdue ? 'color: var(--admin-danger);' : '';
        
        return `
        <div class="crm-list-item" style="border-left: 3px solid ${task.status === 'concluida' ? 'var(--admin-success)' : (isOverdue ? 'var(--admin-danger)' : 'var(--admin-warning)')};">
          <div class="crm-list-item-header">
            <span>${task.title}</span>
            <span style="text-transform: capitalize;">${task.status}</span>
          </div>
          <div class="crm-list-item-body">
            ${task.description || 'Sem descrição'}
          </div>
          <div class="crm-list-item-footer" style="${color}">
            Vencimento: ${new Date(task.due_date).toLocaleDateString('pt-BR')}
          </div>
        </div>
      `}).join('');

    } catch (err) {
      console.error('Erro ao carregar tarefas:', err);
      container.innerHTML = '<p style="text-align: center; font-size: 0.85rem; color: red;">Erro ao carregar tarefas.</p>';
    }
  }
  
  // ==========================================
  // NOVO LEAD (Fase 3.4)
  // ==========================================
  function setupNovoLeadEvents() {
    btnNovoLead.addEventListener('click', () => {
      formNovoLead.reset();
      modalNovoLead.style.display = 'flex';
    });

    btnCloseNovoLead.addEventListener('click', () => {
      modalNovoLead.style.display = 'none';
    });

    modalNovoLead.addEventListener('click', (e) => {
      if (e.target === modalNovoLead) modalNovoLead.style.display = 'none';
    });

    formNovoLead.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnSalvar = document.getElementById('btn-salvar-lead');
      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Salvando...';

      try {
        // Obter clinic_id do usuario logado (via AuthRepository para não ferir a regra)
        const userProfile = await AuthRepository.getPerfilUsuario(currentUser.id);
        const clinicId = userProfile.data.clinic_id;

        const nome = document.getElementById('lead-nome').value.trim();
        const telefone = document.getElementById('lead-telefone').value.trim();
        const email = document.getElementById('lead-email').value.trim();
        const origem = document.getElementById('lead-origem').value;
        const observacao = document.getElementById('lead-observacao').value.trim();

        // 1. Verificar se o paciente já existe ou criar
        let patient = await CrmRepository.findPatientByContact(email, telefone, clinicId);
        
        if (!patient) {
          patient = await CrmRepository.createPatient({
            clinic_id: clinicId,
            nome: nome,
            telefone: telefone,
            email: email,
            status: 'lead' // Se houver controle de status no paciente
          });
        }

        // 2. Criar registro em crm_pipeline
        const pipelinePayload = {
          clinic_id: clinicId,
          patient_id: patient.id,
          stage: 'novo_lead',
          priority: 'media'
        };
        const pipeline = await CrmRepository.createOpportunity(pipelinePayload);

        // 3. Criar interação inicial
        const descText = `Novo lead criado no CRM. Origem: ${origem}. ${observacao ? 'Obs: ' + observacao : ''}`;
        const interaction = await CrmRepository.createInteraction({
          clinic_id: clinicId,
          patient_id: patient.id,
          created_by: currentUser.id,
          type: 'lead_created',
          description: descText
        });

        // 4. Disparar evento LEAD_CREATED
        await CrmEventsRepository.createEvent({
          clinic_id: clinicId,
          patient_id: patient.id,
          event_type: 'LEAD_CREATED',
          event_source: 'novo_lead_modal',
          payload: { pipeline_id: pipeline.id, interaction_id: interaction.id, origem: origem }
        }).catch(e => console.warn('Erro não-crítico ao salvar evento:', e));

        modalNovoLead.style.display = 'none';
        await loadPipeline();
        
      } catch (err) {
        console.error('Erro ao criar novo lead:', err);
        alert('Erro ao salvar novo lead. Verifique se os dados estão corretos ou se já existe um lead em andamento.');
      } finally {
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar Novo Lead';
      }
    });
  }
});
