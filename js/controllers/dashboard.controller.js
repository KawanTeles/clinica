import { DashboardService } from '../services/dashboard.service.js';
import { SessionService } from '../session.service.js';
import { PermissionsService } from '../permissions.service.js';

export class DashboardController {
  constructor(container) {
    this.container = container;
    this.init();
  }

  async init() {
    this.applyRBAC();
    await this.loadMetrics();
  }

  applyRBAC() {
    const session = SessionService.getSession();
    const cargo = session.cargo.toLowerCase();

    // Se for proprietario ou admin, mostra os cards financeiros
    if (cargo === 'proprietario' || cargo === 'admin') {
      this.container.querySelectorAll('.rbac-financeiro').forEach(el => el.style.display = 'block');
    }
    // Recepcionista vê agenda e leads, Profissional vê agenda dele.
  }

  async loadMetrics() {
    const data = await DashboardService.getOverviewData();
    const fmt = (val) => new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(val);

    // Update UI Agenda
    this.container.querySelector('#val-agenda-hoje').textContent = data.agenda.hoje;
    this.container.querySelector('#val-agenda-pendentes').textContent = `${data.agenda.pendentes} aguardando aprovação`;

    // Update UI Leads
    this.container.querySelector('#val-leads-novos').textContent = data.leads.novos;
    this.container.querySelector('#val-leads-convertidos').textContent = `${data.leads.convertidos} convertidos no total`;

    // Update UI Financeiro (Se visivel)
    const finRecebido = this.container.querySelector('#val-fin-recebido');
    if (finRecebido) finRecebido.textContent = fmt(data.financeiro.recebidoMes);
    
    const finLucro = this.container.querySelector('#val-fin-lucro');
    if (finLucro) finLucro.textContent = fmt(data.financeiro.lucroLiquido);

    // Update Lista Profissionais
    const listaProf = this.container.querySelector('#lista-profissionais');
    if (listaProf && data.profissionais.length > 0) {
      let html = '';
      data.profissionais.forEach(p => {
        html += `
          <div style="display: flex; justify-content: space-between; padding-bottom: 0.5rem; border-bottom: 1px dashed var(--border-color);">
            <div style="font-weight: 500; color: var(--text-dark);">${p.nome}</div>
            <div style="text-align: right;">
              <div style="color: var(--success-color); font-weight: bold;">${fmt(p.faturado)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">Comissão: ${fmt(p.comissao_gerada)}</div>
            </div>
          </div>
        `;
      });
      listaProf.innerHTML = html;
    } else if (listaProf) {
      listaProf.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">Sem dados no mês atual.</span>';
    }

    // Render Chart se Chart.js estiver carregado
    this.renderChart(data);
  }

  renderChart(data) {
    if (typeof Chart === 'undefined') return;
    
    const ctx = this.container.querySelector('#chart-receita');
    if (!ctx) return;

    // Dados Mockados para o Gráfico de Evolução (Em um app real, viria de uma view de ultimos 6 meses)
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
        datasets: [{
          label: 'Receita Bruta',
          data: [12000, 19000, 15000, 22000, 28000, data.financeiro.recebidoMes || 30000],
          borderColor: '#34c759',
          tension: 0.4,
          fill: true,
          backgroundColor: 'rgba(52, 199, 89, 0.1)'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
}
