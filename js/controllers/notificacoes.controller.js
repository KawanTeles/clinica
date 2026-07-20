import { NotificacoesService } from '../services/notificacoes.service.js';
import { PermissionsService } from '../permissions.service.js';
import { RoleManager } from '../components/RoleManager.js';
import { Notifications } from '../notifications.js';

export class NotificacoesController {
  constructor(container) {
    this.container = container;
    this.init();
  }

  async init() {
    const isAllowed = await PermissionsService.checkAccess('notificacoes.visualizar', 'Comunicação');
    if (!isAllowed) return;

    RoleManager.applyPermissions(this.container);
    
    await this.loadFila();
    this.bindEvents();
    
    // Auto refresh a cada 10s para simular backend
    this.refreshInterval = setInterval(() => {
      if(document.body.contains(this.container)) {
        this.loadFila(true);
      } else {
        clearInterval(this.refreshInterval);
      }
    }, 10000);
  }

  async loadFila(silent = false) {
    const tbody = this.container.querySelector('#notificacoes-table-body');
    if(!tbody) return;

    if (!silent) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Carregando fila...</td></tr>';
    }

    try {
      const fila = await NotificacoesService.getQueueStatus();
      
      let enviadas = 0;
      let pendentes = 0;
      let falhas = 0;
      let html = '';

      if (fila.length === 0) {
        html = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">A fila está vazia. Nenhuma mensagem recente.</td></tr>';
      } else {
        fila.forEach(msg => {
          if(msg.status === 'ENVIADA') enviadas++;
          else if(msg.status === 'FALHA') falhas++;
          else pendentes++;

          let statusBadge = '';
          if (msg.status === 'ENVIADA') statusBadge = '<span style="background:var(--success-color); color:white; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem;">ENVIADA</span>';
          else if (msg.status === 'FALHA') statusBadge = '<span style="background:var(--danger-color); color:white; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem;">FALHA</span>';
          else if (msg.status === 'ENVIANDO') statusBadge = '<span style="background:var(--warning-color); color:white; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem;"><i class="fas fa-spinner fa-spin"></i> ENVIANDO</span>';
          else statusBadge = '<span style="background:var(--bg-input); color:var(--text-dark); border: 1px solid var(--border-color); padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem;">PENDENTE</span>';

          const d = new Date(msg.criado_em);
          const dataBr = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

          html += `
            <tr style="border-bottom: 1px solid var(--border-color);">
              <td style="padding: 1rem 1.5rem; color: var(--text-dark);">${dataBr}</td>
              <td style="padding: 1rem 1.5rem; color: var(--text-dark); font-weight: 500;">${msg.destinatario || 'Desconhecido'}</td>
              <td style="padding: 1rem 1.5rem; color: var(--text-muted);"><i class="fab fa-${msg.canal.toLowerCase()}"></i> ${msg.canal}</td>
              <td style="padding: 1rem 1.5rem;">${statusBadge}</td>
              <td style="padding: 1rem 1.5rem; color: var(--text-muted);">${msg.tentativas}</td>
            </tr>
          `;
        });
      }

      tbody.innerHTML = html;

      // Update Stats
      const sEnv = this.container.querySelector('#stat-enviadas');
      const sPen = this.container.querySelector('#stat-pendentes');
      const sFal = this.container.querySelector('#stat-falhas');
      if(sEnv) sEnv.textContent = enviadas;
      if(sPen) sPen.textContent = pendentes;
      if(sFal) sFal.textContent = falhas;

    } catch (e) {
      console.error(e);
      if(!silent) Notifications.error('Erro ao carregar fila de notificações');
    }
  }

  bindEvents() {
    this.container.querySelector('#btn-refresh-notif')?.addEventListener('click', () => {
      this.loadFila();
    });
  }
}
