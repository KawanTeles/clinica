import { FinanceiroService } from '../services/financeiro.service.js';
import { PermissionsService } from '../permissions.service.js';
import { Notifications } from '../notifications.js';

export class FinanceiroController {
  constructor(container) {
    this.container = container;
    this.init();
  }

  async init() {
    const isAllowed = await PermissionsService.checkAccess('financeiro.visualizar', 'Financeiro');
    if (!isAllowed) return;

    await this.loadDashboardMetrics();
    await this.loadLancamentos();
    this.bindEvents();
  }

  async loadDashboardMetrics() {
    try {
      const metrics = await FinanceiroService.getDashboardMetrics();
      
      const fmt = (val) => new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(val);
      
      this.container.querySelector('#kpi-faturado').textContent = fmt(metrics.receitaBruta);
      this.container.querySelector('#kpi-recebido').textContent = fmt(metrics.receitaRecebida);
      this.container.querySelector('#kpi-comissoes').textContent = fmt(metrics.totalComissao);
      this.container.querySelector('#kpi-lucro').textContent = fmt(metrics.lucroLiquido);
      
    } catch(e) {
      console.error(e);
      Notifications.error('Erro ao carregar DRE Simplificado.');
    }
  }

  async loadLancamentos() {
    const tbody = this.container.querySelector('#financeiro-table-body');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);"><i class="fas fa-spinner fa-spin"></i> Carregando...</td></tr>';
    
    try {
      const filtros = {
        tipo: this.container.querySelector('#filter-tipo').value,
        status: this.container.querySelector('#filter-status').value
      };

      const lancamentos = await FinanceiroService.getLancamentos(filtros);

      if (lancamentos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhum lançamento encontrado.</td></tr>';
        return;
      }

      let html = '';
      lancamentos.forEach(lan => {
        const d = new Date(lan.data_vencimento).toLocaleDateString('pt-BR');
        const isDespesa = lan.tipo === 'DESPESA';
        const corLinha = isDespesa ? 'color: var(--danger-color);' : 'color: var(--text-dark);';
        const valorFmt = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(lan.valor_liquido);
        
        let statusBadge = '';
        if (lan.status === 'Pago') statusBadge = '<span style="background:var(--success-color); color:white; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem;">Pago</span>';
        else if (lan.status === 'Em Aberto') statusBadge = '<span style="background:var(--warning-color); color:white; padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem;">Aberto</span>';
        else statusBadge = `<span style="background:var(--bg-input); color:var(--text-dark); border:1px solid var(--border-color); padding:0.25rem 0.5rem; border-radius:4px; font-size:0.75rem;">${lan.status}</span>`;

        html += `
          <tr style="border-bottom: 1px solid var(--border-color);">
            <td style="padding: 1rem 1.5rem; color: var(--text-dark);">${d}</td>
            <td style="padding: 1rem 1.5rem; color: var(--text-dark); font-weight: 500;">
              ${lan.pacientes?.nome || lan.observacoes || 'Sem descrição'}
              ${lan.comissao_valor > 0 ? `<br><small style="color:var(--warning-color); font-weight:normal;">Comissão: R$ ${lan.comissao_valor.toFixed(2)}</small>` : ''}
            </td>
            <td style="padding: 1rem 1.5rem; color: var(--text-muted);">${lan.profissionais?.nome || '--'}</td>
            <td style="padding: 1rem 1.5rem; font-weight:bold; ${isDespesa ? 'color:var(--danger-color)' : 'color:var(--success-color)'};">
              <i class="fas ${isDespesa ? 'fa-arrow-down' : 'fa-arrow-up'}"></i> ${lan.tipo}
            </td>
            <td style="padding: 1rem 1.5rem; ${corLinha} font-weight:600;">${valorFmt}</td>
            <td style="padding: 1rem 1.5rem;">${statusBadge}</td>
            <td style="padding: 1rem 1.5rem; text-align: right;">
              ${lan.status === 'Em Aberto' || lan.status === 'Parcialmente Pago' ? `
                <button class="btn-receber" data-id="${lan.id}" data-valor="${lan.valor_liquido}" style="background: var(--success-color); color: white; border: none; padding: 0.5rem 0.75rem; border-radius: 6px; cursor: pointer;" title="Registrar Pagamento">
                  <i class="fas fa-check-circle"></i>
                </button>
              ` : `
                <button disabled style="background: var(--bg-input); color: var(--text-muted); border: none; padding: 0.5rem 0.75rem; border-radius: 6px;" title="Já pago">
                  <i class="fas fa-lock"></i>
                </button>
              `}
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = html;
      this.bindCardEvents();

    } catch (e) {
      console.error(e);
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem; color: red;">Erro ao carregar dados.</td></tr>';
    }
  }

  bindEvents() {
    this.container.querySelector('#filter-tipo')?.addEventListener('change', () => this.loadLancamentos());
    this.container.querySelector('#filter-status')?.addEventListener('change', () => this.loadLancamentos());
    
    // Modal
    const modal = this.container.querySelector('#modal-pagamento');
    const btnClose = this.container.querySelector('.btn-close-modal');
    
    btnClose?.addEventListener('click', () => modal.style.display = 'none');
    
    this.container.querySelector('#form-pagamento')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btnSubmit = this.container.querySelector('#btn-submit-pagamento');
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

      const id = this.container.querySelector('#modal-fin-id').value;
      const valor = parseFloat(this.container.querySelector('#modal-fin-valor').value);
      const formaId = this.container.querySelector('#modal-fin-forma').value;

      try {
        await FinanceiroService.registrarPagamento(id, {
          valor_pago: valor,
          forma_pagamento_id: formaId
        });
        
        Notifications.success('Pagamento registrado com sucesso!');
        modal.style.display = 'none';
        
        await this.loadLancamentos();
        await this.loadDashboardMetrics();
      } catch (err) {
        console.error(err);
        Notifications.error(err.message || 'Erro ao registrar pagamento.');
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = 'Confirmar Recebimento';
      }
    });
  }

  bindCardEvents() {
    this.container.querySelectorAll('.btn-receber').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const valor = e.currentTarget.dataset.valor;
        
        this.container.querySelector('#modal-fin-id').value = id;
        this.container.querySelector('#modal-fin-valor').value = valor;
        this.container.querySelector('#modal-pagamento').style.display = 'flex';
      });
    });
  }
}
