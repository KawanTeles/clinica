import { PortalService } from '../services/portal.service.js';

export class PortalController {
  constructor() {
    this.session = PortalService.getPortalSession();
    if (!this.session) {
      PortalService.logout();
      return;
    }
    
    this.init();
  }

  async init() {
    const greeting = document.getElementById('user-greeting');
    if (greeting) {
      greeting.textContent = `Olá, ${this.session.paciente.nome.split(' ')[0]}`;
      greeting.style.display = 'block';
    }

    document.getElementById('btn-logout')?.addEventListener('click', () => PortalService.logout());
    
    await this.loadAgendamentos();
    await this.loadHistorico();
    this.setupLGPDPref();
  }

  async loadAgendamentos() {
    const list = document.getElementById('agendamentos-list');
    try {
      const agendamentos = await PortalService.getProximosAgendamentos();
      if (agendamentos.length === 0) {
        list.innerHTML = `
          <div style="text-align:center; padding:3rem; border-radius:16px; border:1px dashed var(--border-color);">
            <i class="far fa-calendar-times fa-3x" style="color: var(--text-muted); margin-bottom:1rem; opacity:0.5;"></i>
            <h3 style="margin:0; font-weight:500;">Nenhuma consulta futura</h3>
            <p style="color:var(--text-muted); font-size:0.9rem;">Você não possui agendamentos confirmados no momento.</p>
          </div>
        `;
        return;
      }

      let html = '';
      agendamentos.forEach(ag => {
        const d = ag.data_consulta.split('-');
        const dataFmt = `${d[2]}/${d[1]}/${d[0]}`;
        const horaFmt = ag.hora_inicio.substring(0,5);
        const cor = ag.especialidades?.cor_agenda || 'var(--primary-color)';
        const valorFmt = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(ag.especialidades?.valor_padrao || 0);

        let statusColor = 'var(--bg-input)';
        let statusText = ag.status_consulta.nome;
        
        if(statusText === 'Confirmada') statusColor = 'var(--success-color)';
        else if(statusText === 'Solicitada') statusColor = 'var(--warning-color)';
        
        let badgesHtml = `<span class="status-badge" style="background:${statusColor}; color:${statusText === 'Confirmada' ? 'white' : 'var(--text-dark)'}; border:1px solid var(--border-color);">${statusText}</span>`;

        html += `
          <div class="appointment-card" style="border-left: 6px solid ${cor};">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <h3 style="margin:0 0 0.5rem 0; color:var(--text-dark);">${ag.especialidades.nome}</h3>
                <p style="margin:0; color:var(--text-muted); font-size:0.95rem;">Com ${ag.profissionais.nome}</p>
              </div>
              <div style="text-align:right;">
                ${badgesHtml}
                <div style="margin-top:0.5rem; font-size:1.1rem; font-weight:700;">${dataFmt} às ${horaFmt}</div>
              </div>
            </div>
            
            <div style="background:var(--bg-body); padding:1rem; border-radius:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem;">
              <div style="display:flex; gap:1rem; color:var(--text-muted); font-size:0.85rem;">
                <span><i class="far fa-clock"></i> Chegue 15 min antes</span>
                <span><i class="fas fa-money-bill"></i> ${valorFmt}</span>
              </div>
            </div>

            ${statusText === 'Confirmada' ? `
              <div class="action-buttons" style="display:flex; gap:1rem; margin-top:0.5rem;">
                <button class="btn-portal btn-confirm" data-id="${ag.id}" onclick="window.confirmPresence('${ag.id}')">Confirmar Presença</button>
                <button class="btn-portal btn-reschedule" data-id="${ag.id}" onclick="window.reschedule('${ag.id}')">Remarcar</button>
                <button class="btn-portal btn-cancel" data-id="${ag.id}" onclick="window.cancel('${ag.id}')">Cancelar</button>
              </div>
            ` : ''}
          </div>
        `;
      });
      list.innerHTML = html;
      
    } catch (e) {
      console.error(e);
      list.innerHTML = `<p style="color:red; text-align:center;">Erro ao carregar agendamentos.</p>`;
    }
  }

  async loadHistorico() {
    const list = document.getElementById('historico-list');
    try {
      const historico = await PortalService.getHistorico();
      if(historico.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem;">Sem histórico de consultas passadas.</p>';
        return;
      }
      
      let html = '<div style="display:grid; gap:0.5rem;">';
      historico.forEach(ag => {
        const d = ag.data_consulta.split('-');
        const dataFmt = `${d[2]}/${d[1]}/${d[0]}`;
        html += `
          <div style="background:var(--bg-card); padding:1rem; border-radius:8px; border:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="display:block;">${ag.especialidades.nome}</strong>
              <span style="color:var(--text-muted); font-size:0.85rem;">${ag.profissionais.nome} - ${dataFmt}</span>
            </div>
            <span style="font-size:0.8rem; font-weight:600; text-transform:uppercase;">${ag.status_consulta.nome}</span>
          </div>
        `;
      });
      html += '</div>';
      list.innerHTML = html;
      
    } catch(e) {
      console.error(e);
    }
  }

  setupLGPDPref() {
    const modal = document.getElementById('modal-lgpd');
    document.getElementById('btn-lgpd').addEventListener('click', async () => {
      const prefs = await PortalService.getPreferencias();
      document.getElementById('pref-whatsapp').checked = prefs.aceita_whatsapp;
      document.getElementById('pref-email').checked = prefs.aceita_email;
      modal.style.display = 'flex';
    });

    document.getElementById('btn-fechar-lgpd').addEventListener('click', () => modal.style.display = 'none');
    
    document.getElementById('btn-salvar-lgpd').addEventListener('click', async (e) => {
      e.target.innerText = 'Salvando...';
      try {
        await PortalService.updatePreferencias({
          whatsapp: document.getElementById('pref-whatsapp').checked,
          email: document.getElementById('pref-email').checked
        });
        modal.style.display = 'none';
        alert('Preferências salvas com sucesso!');
      } catch(err) {
        console.error(err);
        alert('Erro ao salvar preferências.');
      } finally {
        e.target.innerText = 'Salvar';
      }
    });

    // Global Functions for buttons
    window.confirmPresence = async (id) => {
      if(confirm('Deseja confirmar sua presença nesta consulta?')) {
        await PortalService.confirmarPresenca(id, 'sim');
        alert('Presença confirmada! Obrigado.');
      }
    };
    
    window.reschedule = async (id) => {
      if(confirm('Para remarcar, este horário será liberado. Deseja prosseguir?')) {
        await PortalService.solicitarRemarcacao(id);
        alert('Solicitação enviada. Um novo horário será disponibilizado para você.');
        this.loadAgendamentos();
      }
    };

    window.cancel = async (id) => {
      if(confirm('Tem certeza que deseja cancelar esta consulta?')) {
        await PortalService.cancelarConsulta(id);
        alert('Consulta cancelada.');
        this.loadAgendamentos();
      }
    };
  }
}
