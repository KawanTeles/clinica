import { MarketingService } from '../services/marketing.service.js';
import { PermissionsService } from '../permissions.service.js';
import { Notifications } from '../notifications.js';

export class MarketingController {
  constructor(container) {
    this.container = container;
    this.init();
  }

  async init() {
    const isAllowed = await PermissionsService.checkAccess('marketing.gerenciar', 'Marketing');
    if (!isAllowed) return;

    await this.loadCampanhas();
    
    this.container.querySelector('#btn-nova-campanha')?.addEventListener('click', () => {
      Notifications.info('Simulação: Abriria o modal de Nova Campanha (Segmentação inteligente de pacientes).');
    });
  }

  async loadCampanhas() {
    const list = this.container.querySelector('#marketing-list');
    try {
      const campanhas = await MarketingService.getCampanhas();
      
      this.container.querySelector('#kpi-campanhas').textContent = campanhas.length;

      if (campanhas.length === 0) {
        list.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhuma campanha criada.</td></tr>';
        return;
      }

      let html = '';
      campanhas.forEach(c => {
        const d = new Date(c.criado_em).toLocaleDateString('pt-BR');
        let statusBadge = `<span style="background:var(--bg-input); padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem;">${c.status}</span>`;
        if (c.status === 'CONCLUIDA') statusBadge = `<span style="background:var(--success-color); color:white; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem;">${c.status}</span>`;
        
        html += `
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 1rem 1.5rem; color: var(--text-dark); font-weight: 500;">
              ${c.nome}
              <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">Tpl: ${c.marketing_templates?.nome || '--'}</div>
            </td>
            <td style="padding: 1rem 1.5rem; color: var(--text-muted);">${c.objetivo || '--'}</td>
            <td style="padding: 1rem 1.5rem;">${statusBadge}</td>
            <td style="padding: 1rem 1.5rem; color: var(--text-dark);">${c.total_disparos}</td>
            <td style="padding: 1rem 1.5rem; color: var(--text-muted);">${d}</td>
          </tr>
        `;
      });
      list.innerHTML = html;
      
    } catch(e) {
      console.error(e);
      list.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: red;">Erro ao carregar campanhas.</td></tr>';
    }
  }
}
