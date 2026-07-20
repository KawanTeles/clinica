import { AgendaService } from '../services/agenda.service.js';
import { PermissionsService } from '../permissions.service.js';
import { RoleManager } from '../components/RoleManager.js';
import { Notifications } from '../notifications.js';

export class AgendaController {
  constructor(container) {
    this.container = container;
    this.currentDate = new Date();
    this.currentView = 'semana';
    this.modalData = null;
    this.init();
  }

  async init() {
    const isAllowed = await PermissionsService.checkAccess('agenda.visualizar', 'Agenda Inteligente');
    if (!isAllowed) return;

    RoleManager.applyPermissions(this.container);
    
    await this.loadModalData();
    this.renderCalendarGrid();
    await this.loadAppointments();
    this.bindEvents();
    this.updateDateDisplay();
  }

  async loadModalData() {
    try {
      this.modalData = await AgendaService.getModalData();
      
      const selectProfFilter = this.container.querySelector('#filter-profissional');
      const selectProf = this.container.querySelector('#modal-profissional');
      const selectPac = this.container.querySelector('#modal-paciente');
      
      let profOptions = '<option value="">Todos os Profissionais</option>';
      let modalProfOptions = '<option value="">Selecione o profissional...</option>';
      this.modalData.profissionais.forEach(p => {
        profOptions += `<option value="${p.id}">${p.nome}</option>`;
        modalProfOptions += `<option value="${p.id}">${p.nome}</option>`;
      });
      if(selectProfFilter) selectProfFilter.innerHTML = profOptions;
      if(selectProf) selectProf.innerHTML = modalProfOptions;

      let pacOptions = '<option value="">Selecione um paciente...</option>';
      this.modalData.pacientes.forEach(p => {
        pacOptions += `<option value="${p.id}">${p.nome} - ${p.cpf}</option>`;
      });
      if(selectPac) selectPac.innerHTML = pacOptions;

    } catch (e) {
      console.error(e);
      Notifications.error('Erro ao carregar dados da agenda');
    }
  }

  updateDateDisplay() {
    const display = this.container.querySelector('#current-date-display');
    if(display) {
      if(this.currentView === 'dia') {
        display.textContent = this.currentDate.toLocaleDateString('pt-BR');
      } else if (this.currentView === 'semana') {
        const start = this.getStartOfWeek(this.currentDate);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        display.textContent = `${start.toLocaleDateString('pt-BR', {day:'2-digit', month:'short'})} - ${end.toLocaleDateString('pt-BR', {day:'2-digit', month:'short', year:'numeric'})}`;
      } else {
        display.textContent = this.currentDate.toLocaleDateString('pt-BR', {month:'long', year:'numeric'}).toUpperCase();
      }
    }
  }

  getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  renderCalendarGrid() {
    const grid = this.container.querySelector('#agenda-grid');
    if(!grid) return;
    grid.innerHTML = '';

    // Coluna de Horas
    const timeCol = document.createElement('div');
    timeCol.className = 'agenda-time-column';
    timeCol.innerHTML = '<div class="agenda-header-cell" style="position:sticky; top:0; background:var(--bg-card); z-index:10; border-bottom:1px solid var(--border-color); padding:1rem;">GMT-3</div>';
    timeCol.style.borderRight = '1px solid var(--border-color)';
    
    for(let h=8; h<=20; h++) {
      timeCol.innerHTML += `<div class="agenda-time-slot" style="height:60px; border-bottom:1px solid var(--border-color); display:flex; align-items:flex-start; padding:0.5rem; color:var(--text-muted); font-size:0.8rem;">${h.toString().padStart(2, '0')}:00</div>`;
    }
    grid.appendChild(timeCol);

    const numDays = this.currentView === 'dia' ? 1 : (this.currentView === 'semana' ? 7 : 7 /* Simplificado */);
    const startData = this.currentView === 'dia' ? new Date(this.currentDate) : this.getStartOfWeek(this.currentDate);
    
    grid.style.gridTemplateColumns = `60px repeat(${numDays}, 1fr)`;

    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    for(let d=0; d<numDays; d++) {
      const currD = new Date(startData);
      currD.setDate(startData.getDate() + d);
      
      const dayCol = document.createElement('div');
      dayCol.className = 'agenda-day-column';
      dayCol.style.position = 'relative';
      dayCol.style.borderRight = '1px solid var(--border-color)';
      dayCol.dataset.date = currD.toISOString().split('T')[0];
      
      const isToday = currD.toDateString() === new Date().toDateString();
      const headerBg = isToday ? 'var(--primary-color)' : 'var(--bg-card)';
      const headerColor = isToday ? 'white' : 'var(--text-dark)';
      
      dayCol.innerHTML = `<div class="agenda-header-cell" style="position:sticky; top:0; background:${headerBg}; color:${headerColor}; z-index:10; border-bottom:1px solid var(--border-color); padding:1rem; text-align:center; font-weight:600;">${days[currD.getDay()]} ${currD.getDate()}</div>`;
      
      for(let h=8; h<=20; h++) {
        const slot = document.createElement('div');
        slot.className = 'agenda-cell-slot';
        slot.style.height = '60px';
        slot.style.borderBottom = '1px solid var(--border-color)';
        slot.style.opacity = '0.3';
        slot.dataset.date = currD.toISOString().split('T')[0];
        slot.dataset.hour = h;
        dayCol.appendChild(slot);
      }
      grid.appendChild(dayCol);
    }
  }

  async loadAppointments() {
    try {
      const startData = this.currentView === 'dia' ? new Date(this.currentDate) : this.getStartOfWeek(this.currentDate);
      const numDays = this.currentView === 'dia' ? 1 : 7;
      const endData = new Date(startData);
      endData.setDate(startData.getDate() + numDays - 1);
      
      const filterProf = this.container.querySelector('#filter-profissional')?.value || null;

      const apts = await AgendaService.listAppointments(
        startData.toISOString().split('T')[0], 
        endData.toISOString().split('T')[0],
        filterProf
      );
      
      // Limpa cards antigos
      this.container.querySelectorAll('.appointment-card').forEach(c => c.remove());

      if(apts && apts.length > 0) {
        apts.forEach(apt => this.renderAppointmentCard(apt));
      }
    } catch (error) {
      console.error(error);
      Notifications.error('Erro ao buscar agendamentos.');
    }
  }

  renderAppointmentCard(apt) {
    const dayCols = Array.from(this.container.querySelectorAll('.agenda-day-column'));
    const col = dayCols.find(c => c.dataset.date === apt.data_consulta);
    if(!col) return;

    const hStart = parseInt(apt.hora_inicio.split(':')[0]);
    const mStart = parseInt(apt.hora_inicio.split(':')[1]);
    const hEnd = parseInt(apt.hora_fim.split(':')[0]);
    const mEnd = parseInt(apt.hora_fim.split(':')[1]);
    
    if (hStart < 8 || hStart > 20) return; // Fora do grid visível
    
    const topPx = 54 + ((hStart - 8) * 60) + mStart; // 54px header height approx
    const durationMins = ((hEnd * 60) + mEnd) - ((hStart * 60) + mStart);
    
    const card = document.createElement('div');
    card.className = 'appointment-card';
    card.style.position = 'absolute';
    card.style.top = `${topPx}px`; 
    card.style.height = `${durationMins - 2}px`;
    card.style.left = '4px';
    card.style.right = '4px';
    card.style.backgroundColor = 'var(--bg-card)';
    card.style.border = '1px solid var(--border-color)';
    card.style.borderLeft = `4px solid ${apt.especialidades?.cor_agenda || 'var(--primary-color)'}`;
    card.style.borderRadius = '6px';
    card.style.padding = '0.25rem 0.5rem';
    card.style.fontSize = '0.75rem';
    card.style.overflow = 'hidden';
    card.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
    card.style.zIndex = '5';
    card.style.cursor = 'pointer';

    let statusIcon = 'fa-clock';
    let statusColor = 'var(--warning-color)';
    if(apt.status_consulta?.nome === 'Confirmada') { statusIcon = 'fa-check-circle'; statusColor = 'var(--success-color)'; }
    if(apt.status_consulta?.nome === 'Cancelada') { statusIcon = 'fa-times-circle'; statusColor = 'var(--danger-color)'; }

    card.innerHTML = `
      <div style="font-weight:600; color:var(--text-dark); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${apt.pacientes?.nome || 'Paciente'}</div>
      <div style="color:var(--text-muted); margin-top:2px; display:flex; justify-content:space-between;">
        <span>${apt.hora_inicio.substring(0,5)} - ${apt.hora_fim.substring(0,5)}</span>
        <i class="fas ${statusIcon}" style="color:${statusColor}" title="${apt.status_consulta?.nome}"></i>
      </div>
    `;

    card.addEventListener('click', () => {
      // Futuro modal de detalhes
      console.log('Detalhes:', apt);
    });

    col.appendChild(card);
  }

  bindEvents() {
    // Views e Navegação
    this.container.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        this.container.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentView = e.target.dataset.view;
        this.renderCalendarGrid();
        this.updateDateDisplay();
        await this.loadAppointments();
      });
    });

    this.container.querySelector('#btn-hoje')?.addEventListener('click', async () => {
      this.currentDate = new Date();
      this.renderCalendarGrid();
      this.updateDateDisplay();
      await this.loadAppointments();
    });

    this.container.querySelector('#btn-prev-date')?.addEventListener('click', async () => {
      if(this.currentView === 'dia') this.currentDate.setDate(this.currentDate.getDate() - 1);
      else if(this.currentView === 'semana') this.currentDate.setDate(this.currentDate.getDate() - 7);
      else this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      this.renderCalendarGrid();
      this.updateDateDisplay();
      await this.loadAppointments();
    });

    this.container.querySelector('#btn-next-date')?.addEventListener('click', async () => {
      if(this.currentView === 'dia') this.currentDate.setDate(this.currentDate.getDate() + 1);
      else if(this.currentView === 'semana') this.currentDate.setDate(this.currentDate.getDate() + 7);
      else this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      this.renderCalendarGrid();
      this.updateDateDisplay();
      await this.loadAppointments();
    });

    this.container.querySelector('#filter-profissional')?.addEventListener('change', async () => {
      await this.loadAppointments();
    });

    // Modal
    const btnNovo = this.container.querySelector('#btn-nova-consulta');
    const modalOverlay = this.container.querySelector('#modal-agendamento');
    const btnClose = this.container.querySelector('.btn-close-modal');
    
    if (btnNovo && modalOverlay) {
      btnNovo.addEventListener('click', () => {
        this.resetModalForm();
        modalOverlay.classList.add('active');
      });
    }

    if(btnClose) btnClose.addEventListener('click', () => modalOverlay.classList.remove('active'));
    
    if(modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if(e.target === modalOverlay) modalOverlay.classList.remove('active');
      });
    }

    // Modal Form Logic
    const selectProf = this.container.querySelector('#modal-profissional');
    const selectEsp = this.container.querySelector('#modal-especialidade');
    const inputDate = this.container.querySelector('#modal-data');
    const selectTime = this.container.querySelector('#modal-horario');
    const form = this.container.querySelector('#form-novo-agendamento');

    if(selectProf) {
      selectProf.addEventListener('change', (e) => {
        const val = e.target.value;
        if(!val) {
          selectEsp.disabled = true;
          selectEsp.innerHTML = '<option value="">Selecione primeiro o profissional...</option>';
          inputDate.disabled = true;
          selectTime.disabled = true;
          return;
        }
        
        let espOptions = '<option value="">Selecione a especialidade...</option>';
        this.modalData.especialidades.forEach(es => {
          espOptions += `<option value="${es.id}" data-duration="${es.tempo_padrao}">${es.nome}</option>`;
        });
        selectEsp.innerHTML = espOptions;
        selectEsp.disabled = false;
        selectEsp.style.opacity = '1';
      });
    }

    if(selectEsp) {
      selectEsp.addEventListener('change', (e) => {
        if(e.target.value) {
          inputDate.disabled = false;
          inputDate.style.opacity = '1';
        } else {
          inputDate.disabled = true;
          selectTime.disabled = true;
        }
      });
    }

    if(inputDate) {
      inputDate.addEventListener('change', async (e) => {
        if(!e.target.value || !selectProf.value || !selectEsp.value) return;
        
        selectTime.innerHTML = '<option value="">Calculando horários livres...</option>';
        selectTime.disabled = true;
        
        try {
          const slots = await AgendaService.getAvailableSlots(selectProf.value, e.target.value, selectEsp.value);
          
          if(slots.length === 0) {
            selectTime.innerHTML = '<option value="">Nenhum horário disponível neste dia</option>';
            return;
          }

          let html = '<option value="">Selecione o horário...</option>';
          slots.forEach(s => {
            html += `<option value="${s.hora}|${s.horaFim}">${s.hora} as ${s.horaFim}</option>`;
          });
          selectTime.innerHTML = html;
          selectTime.disabled = false;
          selectTime.style.opacity = '1';

        } catch (error) {
          console.error(error);
          Notifications.error('Erro ao calcular disponibilidade');
          selectTime.innerHTML = '<option value="">Erro ao buscar slots</option>';
        }
      });
    }

    if(form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pacId = this.container.querySelector('#modal-paciente').value;
        const profId = selectProf.value;
        const espId = selectEsp.value;
        const date = inputDate.value;
        const timeVal = selectTime.value;
        const obs = this.container.querySelector('#modal-observacoes').value;

        if(!pacId || !profId || !espId || !date || !timeVal) {
          Notifications.warning('Preencha todos os campos obrigatórios');
          return;
        }

        const [hInicio, hFim] = timeVal.split('|');
        const btn = this.container.querySelector('#btn-submit-agendamento');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

        try {
          await AgendaService.createAppointment({
            paciente_id: pacId,
            profissional_id: profId,
            especialidade_id: espId,
            data_consulta: date,
            hora_inicio: hInicio,
            hora_fim: hFim,
            observacoes: obs
          });

          Notifications.success('Agendamento solicitado com sucesso!');
          modalOverlay.classList.remove('active');
          await this.loadAppointments();
        } catch (error) {
          console.error(error);
          Notifications.error(error.message || 'Erro ao criar agendamento');
        } finally {
          btn.disabled = false;
          btn.innerHTML = 'Agendar Consulta (Status: Solicitada)';
        }
      });
    }
  }

  resetModalForm() {
    const form = this.container.querySelector('#form-novo-agendamento');
    if(form) form.reset();
    
    const selectEsp = this.container.querySelector('#modal-especialidade');
    const inputDate = this.container.querySelector('#modal-data');
    const selectTime = this.container.querySelector('#modal-horario');
    
    if(selectEsp) {
      selectEsp.disabled = true;
      selectEsp.style.opacity = '0.7';
      selectEsp.innerHTML = '<option value="">Selecione primeiro o profissional...</option>';
    }
    if(inputDate) {
      inputDate.disabled = true;
      inputDate.style.opacity = '0.7';
    }
    if(selectTime) {
      selectTime.disabled = true;
      selectTime.style.opacity = '0.7';
      selectTime.innerHTML = '<option value="">Aguardando seleção...</option>';
    }
  }
}
