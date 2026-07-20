import { CrmService } from '../services/crm.service.js';
import { PermissionsService } from '../permissions.service.js';
import { Notifications } from '../notifications.js';

export class LeadsController {
  constructor(container) {
    this.container = container;
    this.init();
  }

  async init() {
    const isAllowed = await PermissionsService.checkAccess('leads.visualizar', 'Leads');
    if(!isAllowed) return;

    await this.loadLeads();
    this.setupDragAndDrop();
    
    this.container.querySelector('#btn-novo-lead')?.addEventListener('click', () => {
      Notifications.info('Criação de Lead será conectada ao Modal (Próxima etapa).');
    });
  }

  async loadLeads() {
    try {
      const leads = await CrmService.getLeads();
      
      const colunas = {
        'Novo Lead': this.container.querySelector('#col-novo-lead'),
        'Primeiro Contato': this.container.querySelector('#col-primeiro-contato'),
        'Em Negociação': this.container.querySelector('#col-negociacao'),
        'Agendamento Solicitado': this.container.querySelector('#col-agendamento'),
        'Convertido': this.container.querySelector('#col-convertido')
      };

      // Limpar colunas
      Object.values(colunas).forEach(c => { if(c) c.innerHTML = ''; });

      leads.forEach(lead => {
        const targetCol = colunas[lead.status];
        if (!targetCol) return;

        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.draggable = true;
        card.dataset.id = lead.id;
        
        const tempo = new Date(lead.criado_em).toLocaleDateString('pt-BR');

        card.innerHTML = `
          <h5>${lead.nome}</h5>
          ${lead.telefone ? `<p><i class="fab fa-whatsapp"></i> ${lead.telefone}</p>` : ''}
          ${lead.especialidades ? `<p style="margin-top:0.5rem; color:var(--primary-color);"><i class="fas fa-stethoscope"></i> ${lead.especialidades.nome}</p>` : ''}
          <div style="margin-top: 1rem; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.7rem; color:var(--text-muted);">${tempo}</span>
            <span style="background:var(--bg-input); padding:0.2rem 0.5rem; border-radius:4px; font-size:0.7rem;">${lead.origem || 'Orgânico'}</span>
          </div>
        `;

        // Eventos Drag
        card.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', lead.id);
          card.style.opacity = '0.5';
        });

        card.addEventListener('dragend', () => {
          card.style.opacity = '1';
        });

        targetCol.appendChild(card);
      });

    } catch(e) {
      console.error(e);
      Notifications.error('Erro ao carregar funil de Leads.');
    }
  }

  setupDragAndDrop() {
    const columns = this.container.querySelectorAll('.kanban-col');

    columns.forEach(col => {
      const dropzone = col.querySelector('.kanban-cards-container');
      
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('drag-over');
      });

      col.addEventListener('dragleave', () => {
        dropzone.classList.remove('drag-over');
      });

      col.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.classList.remove('drag-over');
        
        const leadId = e.dataTransfer.getData('text/plain');
        const novoStatus = col.dataset.status;
        
        if(leadId && novoStatus) {
          try {
            await CrmService.moverLead(leadId, novoStatus);
            Notifications.success(`Lead movido para ${novoStatus}`);
            await this.loadLeads();
          } catch(err) {
            console.error(err);
            Notifications.error('Erro ao mover lead.');
          }
        }
      });
    });
  }
}
