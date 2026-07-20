import { AprovacoesService } from '../services/aprovacoes.service.js';
import { PermissionsService } from '../permissions.service.js';
import { RoleManager } from '../components/RoleManager.js';
import { Notifications } from '../notifications.js';

export class AprovacoesController {
  constructor(container) {
    this.container = container;
    this.init();
  }

  async init() {
    // Validamos se o usuário tem permissão para visualizar agenda ou editar
    const isAllowed = await PermissionsService.checkAccess('agenda.visualizar', 'Aprovações');
    if (!isAllowed) return;

    RoleManager.applyPermissions(this.container);
    
    await this.loadFilters();
    await this.loadSolicitacoes();
    this.bindEvents();
  }

  async loadFilters() {
    try {
      const profs = await AprovacoesService.getProfissionaisFilter();
      const selectProf = this.container.querySelector('#filter-profissional-aprov');
      if (selectProf) {
        let html = '<option value="">Todos os Profissionais</option>';
        profs.forEach(p => {
          html += `<option value="${p.id}">${p.nome}</option>`;
        });
        selectProf.innerHTML = html;
      }
    } catch (e) {
      console.error(e);
      Notifications.error('Erro ao carregar filtros');
    }
  }

  async loadSolicitacoes() {
    const listContainer = this.container.querySelector('#aprovacoes-list');
    if(!listContainer) return;

    listContainer.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
        <i class="fas fa-spinner fa-spin fa-2x"></i>
        <p style="margin-top: 1rem;">Carregando solicitações...</p>
      </div>`;

    try {
      const profId = this.container.querySelector('#filter-profissional-aprov')?.value || null;
      const periodo = this.container.querySelector('#filter-periodo')?.value || 'todas';

      const solicitacoes = await AprovacoesService.getSolicitacoesPendentes(profId, periodo);

      if (solicitacoes.length === 0) {
        listContainer.innerHTML = `
          <div style="text-align: center; padding: 3rem; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; border: 1px dashed var(--border-color);">
            <i class="fas fa-check-circle fa-3x" style="color: var(--success-color); margin-bottom: 1rem; opacity: 0.5;"></i>
            <h3>Tudo em dia!</h3>
            <p>Não há consultas aguardando aprovação para os filtros selecionados.</p>
          </div>
        `;
        return;
      }

      let html = '';
      solicitacoes.forEach(sol => {
        // Formatação
        const [y, m, d] = sol.data_consulta.split('-');
        const dataBr = `${d}/${m}/${y}`;
        const horaIn = sol.hora_inicio.substring(0,5);
        const horaFim = sol.hora_fim.substring(0,5);
        const cor = sol.especialidades?.cor_agenda || 'var(--primary-color)';
        
        // Formata Moeda BRL
        const valorRaw = sol.especialidades?.valor_padrao || 0;
        const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorRaw);

        html += `
          <div class="glass-card" style="display: flex; flex-direction: column; gap: 1rem; padding: 1.5rem; background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-color); border-left: 5px solid ${cor};">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
              <div>
                <h3 style="margin: 0 0 0.5rem 0; font-size: 1.2rem; color: var(--text-dark);">${sol.pacientes?.nome}</h3>
                <div style="display: flex; gap: 1.5rem; color: var(--text-muted); font-size: 0.9rem; flex-wrap: wrap;">
                  <span><i class="fas fa-user-md" style="width:16px;"></i> ${sol.profissionais?.nome}</span>
                  <span><i class="fas fa-stethoscope" style="width:16px;"></i> ${sol.especialidades?.nome}</span>
                  <span><i class="far fa-calendar" style="width:16px;"></i> ${dataBr}</span>
                  <span><i class="far fa-clock" style="width:16px;"></i> ${horaIn} às ${horaFim}</span>
                  <span><i class="fas fa-money-bill-wave" style="width:16px;"></i> ${valorFormatado}</span>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; align-items: flex-end;">
                <span style="background: var(--warning-color); color: white; padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">
                  SOLICITADA
                </span>
                <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">
                  Pedido há ${this.timeSince(new Date(sol.criado_em))}
                </span>
              </div>
            </div>

            ${sol.observacoes ? `
              <div style="background: var(--bg-input); padding: 0.75rem; border-radius: 8px; border-left: 3px solid var(--text-muted); font-size: 0.85rem; color: var(--text-dark);">
                <strong>Observações:</strong> ${sol.observacoes}
              </div>
            ` : ''}

            <div style="display: flex; gap: 0.75rem; margin-top: 0.5rem; flex-wrap: wrap;">
              <button class="btn-aprovar" data-id="${sol.id}" style="padding: 0.75rem 1.5rem; border-radius: 8px; background: var(--success-color); color: white; border: none; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: opacity 0.2s;">
                <i class="fas fa-check"></i> Aprovar
              </button>
              
              <button class="btn-recusar" data-id="${sol.id}" style="padding: 0.75rem 1.5rem; border-radius: 8px; background: transparent; color: var(--danger-color); border: 1px solid var(--danger-color); font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.2s;">
                <i class="fas fa-times"></i> Recusar
              </button>
              
              <button class="btn-remarcar" data-id="${sol.id}" style="padding: 0.75rem 1.5rem; border-radius: 8px; background: transparent; color: var(--primary-color); border: 1px solid var(--primary-color); font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.2s;">
                <i class="fas fa-calendar-alt"></i> Pedir Remarcação
              </button>
            </div>
            
          </div>
        `;
      });
      
      listContainer.innerHTML = html;
      this.bindCardEvents();

    } catch (e) {
      console.error(e);
      listContainer.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar solicitações. Tente novamente.</p>`;
    }
  }

  bindEvents() {
    this.container.querySelector('#btn-refresh')?.addEventListener('click', () => this.loadSolicitacoes());
    this.container.querySelector('#filter-profissional-aprov')?.addEventListener('change', () => this.loadSolicitacoes());
    this.container.querySelector('#filter-periodo')?.addEventListener('change', () => this.loadSolicitacoes());

    // Modal de Motivo
    const modal = this.container.querySelector('#modal-motivo');
    const btnClose = this.container.querySelector('.btn-close-modal');
    
    if(btnClose) btnClose.addEventListener('click', () => modal.classList.remove('active'));
    
    if(modal) {
      modal.addEventListener('click', (e) => {
        if(e.target === modal) modal.classList.remove('active');
      });
    }

    const formMotivo = this.container.querySelector('#form-motivo');
    if(formMotivo) {
      formMotivo.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const action = this.container.querySelector('#modal-motivo-action').value;
        const id = this.container.querySelector('#modal-motivo-id').value;
        const motivo = this.container.querySelector('#modal-motivo-select').value;
        const obs = this.container.querySelector('#modal-motivo-obs').value;

        const btn = this.container.querySelector('#btn-submit-motivo');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

        try {
          if (action === 'recusar') {
            await AprovacoesService.recusarConsulta(id, motivo, obs);
            Notifications.success('Consulta recusada com sucesso. (Slot liberado)');
          } else if (action === 'remarcar') {
            await AprovacoesService.solicitarRemarcacao(id, motivo, obs);
            Notifications.success('Remarcação solicitada. (Slot anterior liberado)');
          }
          modal.classList.remove('active');
          await this.loadSolicitacoes();
        } catch (error) {
          console.error(error);
          Notifications.error('Erro ao processar ação.');
        } finally {
          btn.disabled = false;
          btn.innerHTML = 'Confirmar Ação';
        }
      });
    }
  }

  bindCardEvents() {
    this.container.querySelectorAll('.btn-aprovar').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const originBtn = e.currentTarget;
        
        if (confirm('Confirma a aprovação desta consulta?')) {
          originBtn.disabled = true;
          originBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
          
          try {
            await AprovacoesService.aprovarConsulta(id);
            Notifications.success('Consulta Aprovada! (Preparando Etapa 10 - WhatsApp)');
            await this.loadSolicitacoes();
          } catch(err) {
            console.error(err);
            Notifications.error('Erro ao aprovar consulta');
            originBtn.disabled = false;
            originBtn.innerHTML = '<i class="fas fa-check"></i> Aprovar';
          }
        }
      });
    });

    this.container.querySelectorAll('.btn-recusar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.openMotivoModal(id, 'recusar', 'Recusar Consulta');
      });
    });

    this.container.querySelectorAll('.btn-remarcar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.openMotivoModal(id, 'remarcar', 'Solicitar Remarcação');
      });
    });
  }

  openMotivoModal(id, action, titleText) {
    const modal = this.container.querySelector('#modal-motivo');
    const title = this.container.querySelector('#modal-motivo-title');
    const actionInput = this.container.querySelector('#modal-motivo-action');
    const idInput = this.container.querySelector('#modal-motivo-id');
    const form = this.container.querySelector('#form-motivo');

    form.reset();
    title.textContent = titleText;
    actionInput.value = action;
    idInput.value = id;
    
    modal.classList.add('active');
  }

  timeSince(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " anos";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " meses";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " dias";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " horas";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutos";
    return Math.floor(seconds) + " segundos";
  }
}
