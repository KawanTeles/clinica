import { CrmService } from '../services/crm.service.js';
import { PermissionsService } from '../permissions.service.js';
import { Notifications } from '../notifications.js';

export class PacientesController {
  constructor(container) {
    this.container = container;
    this.currentPacienteId = null;
    this.init();
  }

  async init() {
    const isAllowed = await PermissionsService.checkAccess('pacientes.visualizar', 'Pacientes');
    if (!isAllowed) return;

    this.bindEvents();
    // Inicia busca vazia
    this.performSearch('');
  }

  bindEvents() {
    const inputSearch = this.container.querySelector('#search-paciente');
    
    // Debounce search
    let timeout = null;
    inputSearch?.addEventListener('keyup', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.performSearch(e.target.value);
      }, 300);
    });

    this.container.querySelector('#btn-add-obs')?.addEventListener('click', async () => {
      const input = this.container.querySelector('#input-nova-obs');
      if (!input.value.trim() || !this.currentPacienteId) return;

      try {
        await CrmService.addObservacao(this.currentPacienteId, input.value.trim());
        input.value = '';
        Notifications.success('Observação salva.');
        this.loadPaciente360(this.currentPacienteId);
      } catch(e) {
        console.error(e);
        Notifications.error('Erro ao salvar observação.');
      }
    });
  }

  async performSearch(term) {
    const list = this.container.querySelector('#lista-pacientes');
    try {
      const resultados = await CrmService.searchGlobal(term);
      
      if (resultados.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size: 0.85rem; padding: 1rem;">Nenhum paciente encontrado.</p>';
        return;
      }

      let html = '';
      resultados.forEach(pac => {
        html += `
          <div class="paciente-item" data-id="${pac.id}">
            <div style="font-weight: 500; color: var(--text-dark);">${pac.nome}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${pac.telefone || pac.cpf || 'Sem contato'}</div>
          </div>
        `;
      });
      list.innerHTML = html;

      // Bind click
      list.querySelectorAll('.paciente-item').forEach(el => {
        el.addEventListener('click', () => {
          list.querySelectorAll('.paciente-item').forEach(i => i.classList.remove('active'));
          el.classList.add('active');
          this.loadPaciente360(el.dataset.id);
        });
      });

    } catch (e) {
      console.error(e);
    }
  }

  async loadPaciente360(id) {
    this.currentPacienteId = id;
    const painel = this.container.querySelector('#painel-360');
    painel.style.display = 'block';
    
    try {
      const data = await CrmService.getPaciente360(id);
      
      // Header
      this.container.querySelector('#pac-nome').textContent = data.paciente.nome;
      this.container.querySelector('#pac-avatar').textContent = data.paciente.nome.substring(0, 2).toUpperCase();
      this.container.querySelector('#pac-telefone').innerHTML = `<i class="fab fa-whatsapp"></i> ${data.paciente.telefone || '--'}`;
      this.container.querySelector('#pac-cpf').innerHTML = `<i class="fas fa-id-card"></i> ${data.paciente.cpf || '--'}`;
      this.container.querySelector('#pac-origem').innerHTML = `<i class="fas fa-bullseye"></i> ${data.paciente.origem || 'Orgânico'}`;
      
      // Score
      const scoreEl = this.container.querySelector('#pac-score');
      scoreEl.textContent = data.paciente.score;
      if(data.paciente.score < 50) scoreEl.style.color = 'var(--danger-color)';
      else if(data.paciente.score < 80) scoreEl.style.color = 'var(--warning-color)';
      else scoreEl.style.color = 'var(--success-color)';

      // Tags
      const tagsContainer = this.container.querySelector('#pac-tags');
      tagsContainer.innerHTML = '';
      if (data.paciente.tags) {
        data.paciente.tags.forEach(t => {
          tagsContainer.innerHTML += `<span style="background: rgba(0,113,227,0.1); color: var(--primary-color); padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">${t}</span>`;
        });
      }

      // KPIs
      this.container.querySelector('#kpi-consultas').textContent = data.kpis.totalConsultas;
      this.container.querySelector('#kpi-faturado').textContent = new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(data.kpis.totalFaturado);

      // Obs Internas
      const obsList = this.container.querySelector('#pac-obs-list');
      obsList.innerHTML = '';
      if(data.observacoes.length === 0) obsList.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">Nenhuma observação.</span>';
      data.observacoes.forEach(o => {
        const d = new Date(o.criado_em).toLocaleDateString('pt-BR');
        obsList.innerHTML += `
          <div style="font-size:0.85rem; padding-bottom:0.5rem; border-bottom:1px dashed rgba(0,0,0,0.1); color: var(--text-dark);">
            <strong style="color:var(--text-muted); font-size:0.75rem;">${d} - ${o.usuarios.nome}:</strong><br>
            ${o.conteudo}
          </div>
        `;
      });

      // Linha do tempo unificada
      const timeline = this.container.querySelector('#pac-timeline');
      timeline.innerHTML = '';
      
      // Mesclar consultas e notificações para a timeline
      let eventos = [];
      
      data.consultas.forEach(c => {
        eventos.push({
          data: new Date(c.data_consulta + 'T' + c.hora_inicio),
          tipo: 'consulta',
          icone: 'fa-user-md',
          cor: 'var(--primary-color)',
          titulo: `Consulta: ${c.especialidades.nome}`,
          desc: `Com ${c.profissionais.nome}. Status: <strong>${c.status_consulta.nome}</strong>`
        });
      });

      data.notificacoes.forEach(n => {
        eventos.push({
          data: new Date(n.criado_em),
          tipo: 'notificacao',
          icone: 'fa-paper-plane',
          cor: 'var(--success-color)',
          titulo: `Mensagem: ${n.template_nome}`,
          desc: `Canal: ${n.canal} | Status: ${n.status}`
        });
      });
      
      // Ordena decrescente
      eventos.sort((a,b) => b.data - a.data);
      
      if(eventos.length === 0) timeline.innerHTML = '<span style="color:var(--text-muted); font-size:0.9rem;">Nenhum evento registrado.</span>';

      eventos.forEach(ev => {
        const dFmt = ev.data.toLocaleDateString('pt-BR') + ' ' + ev.data.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
        timeline.innerHTML += `
          <div class="timeline-item">
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.25rem;">${dFmt}</div>
            <div style="background:var(--bg-body); padding:1rem; border-radius:8px; border:1px solid var(--border-color);">
              <h5 style="margin:0 0 0.25rem 0; color:var(--text-dark);"><i class="fas ${ev.icone}" style="color:${ev.cor}; margin-right:0.5rem;"></i> ${ev.titulo}</h5>
              <div style="font-size:0.85rem; color:var(--text-muted);">${ev.desc}</div>
            </div>
          </div>
        `;
      });

    } catch (e) {
      console.error(e);
      Notifications.error('Erro ao carregar dados do paciente.');
    }
  }
}
