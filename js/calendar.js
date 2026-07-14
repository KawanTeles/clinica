// Motor do Calendário e Cálculo de Slots de Horários Livres - Clínica Zoe

const AppointmentCalendar = {
  selectedDate: null,
  professional: null,
  appointments: [],
  blockedTimes: [],
  vacations: [],
  currentMonth: new Date(),

  // Inicializa o calendário e carrega as restrições do profissional
  async init(professional, containerId, slotsContainerId, onSlotSelectCallback) {
    this.professional = professional;
    this.containerId = containerId;
    this.slotsContainerId = slotsContainerId;
    this.onSlotSelectCallback = onSlotSelectCallback;
    this.selectedDate = null;

    // Buscar restrições e agendamentos no banco
    await this.loadDoctorData();

    // Renderizar o calendário inicial
    this.renderCalendar();
  },

  // Busca agendamentos, férias e bloqueios do médico
  async loadDoctorData() {
    if (!this.professional) return;

    try {
      // 1. Buscar agendamentos futuros ou recentes
      const { data: appts, error: errAppts } = await window.supabaseClient
        .from('agendamentos')
        .select('*')
        .eq('profissional_id', this.professional.id)
        .neq('status', 'Cancelado');
      
      this.appointments = appts || [];

      // 2. Buscar bloqueios de horários
      const { data: blocks, error: errBlocks } = await window.supabaseClient
        .from('horarios_bloqueados')
        .select('*')
        .eq('profissional_id', this.professional.id);

      this.blockedTimes = blocks || [];

      // 3. Buscar férias
      const { data: vacs, error: errVacs } = await window.supabaseClient
        .from('ferias')
        .select('*')
        .eq('profissional_id', this.professional.id);

      this.vacations = vacs || [];

    } catch (err) {
      console.error("Erro ao carregar dados de restrições do calendário:", err);
    }
  },

  // Renderiza o grid de dias do calendário
  renderCalendar() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // Dia da semana do 1º dia
    const totalDays = new Date(year, month + 1, 0).getDate(); // Dias totais no mês

    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    // Layout estrutural do calendário
    container.innerHTML = `
      <div class="calendar-header">
        <button class="calendar-nav-btn prev-month"><i class="fas fa-chevron-left"></i></button>
        <span class="calendar-month-title">${monthNames[month]} ${year}</span>
        <button class="calendar-nav-btn next-month"><i class="fas fa-chevron-right"></i></button>
      </div>
      <div class="calendar-weekdays">
        <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
      </div>
      <div class="calendar-days-grid"></div>
    `;

    const grid = container.querySelector('.calendar-days-grid');
    
    // Configurar botões de navegação
    container.querySelector('.prev-month').addEventListener('click', () => {
      this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
      this.renderCalendar();
    });

    container.querySelector('.next-month').addEventListener('click', () => {
      this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
      this.renderCalendar();
    });

    // Adiciona dias em branco do início da semana
    for (let i = 0; i < firstDayIndex; i++) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'calendar-day empty';
      grid.appendChild(emptyDiv);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Mapeamento dos dias da semana
    const dayMapping = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

    // Adicionar dias do mês
    for (let day = 1; day <= totalDays; day++) {
      const dateToCheck = new Date(year, month, day);
      const weekdayName = dayMapping[dateToCheck.getDay()];
      const isPast = dateToCheck < today;
      
      // Verifica se o profissional trabalha neste dia de semana
      const worksOnWeekday = this.professional.dias_atendimento
        .map(d => d.toLowerCase())
        .includes(weekdayName);

      // Verifica se o dia cai em período de férias do profissional
      const isOnVacation = this.vacations.some(vac => {
        const start = new Date(vac.inicio + 'T00:00:00');
        const end = new Date(vac.fim + 'T00:00:00');
        return dateToCheck >= start && dateToCheck <= end;
      });

      const isSelectable = !isPast && worksOnWeekday && !isOnVacation;

      const dayDiv = document.createElement('div');
      dayDiv.className = 'calendar-day';
      dayDiv.innerText = day;

      if (!isSelectable) {
        dayDiv.classList.add('inactive');
        if (isPast) {
          dayDiv.title = "Data passada";
        } else if (isOnVacation) {
          dayDiv.title = "Profissional em férias";
          dayDiv.classList.add('on-vacation');
        } else {
          dayDiv.title = "Profissional não atende neste dia";
        }
      } else {
        dayDiv.classList.add('selectable');
        
        // Verifica se é a data previamente selecionada
        const dateStr = this.formatDateIso(dateToCheck);
        if (this.selectedDate === dateStr) {
          dayDiv.classList.add('selected');
        }

        dayDiv.addEventListener('click', () => {
          // Remover seleção anterior
          grid.querySelectorAll('.calendar-day').forEach(d => d.classList.remove('selected'));
          dayDiv.classList.add('selected');
          
          this.selectedDate = dateStr;
          this.calculateAndRenderSlots(dateToCheck);
        });
      }

      grid.appendChild(dayDiv);
    }
  },

  // Calcula e exibe slots de horários livres para o dia selecionado
  calculateAndRenderSlots(date) {
    const slotsContainer = document.getElementById(this.slotsContainerId);
    if (!slotsContainer) return;

    slotsContainer.innerHTML = '<div class="loader-slots"><i class="fas fa-spinner fa-spin"></i> Buscando horários...</div>';

    // Gerar todos os slots de 30 minutos dentro do horário de atendimento do médico
    const startParts = this.professional.horario_inicio.split(':');
    const endParts = this.professional.horario_fim.split(':');

    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
    
    // Intervalo padrão de consulta: 60 minutos (para maior facilidade)
    const slotDuration = 60; 
    const slots = [];

    const dateStr = this.formatDateIso(date);

    for (let current = startMinutes; current + slotDuration <= endMinutes; current += slotDuration) {
      const hr = Math.floor(current / 60);
      const min = current % 60;
      const timeStr = `${hr.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;

      // Verifica se o slot já está reservado
      const isReserved = this.appointments.some(appt => {
        // Normalizar strings de data e hora
        const apptDate = appt.data; // YYYY-MM-DD
        const apptTime = appt.horario.substring(0, 5); // HH:MM
        return apptDate === dateStr && apptTime === timeStr;
      });

      // Verifica se o slot está em algum período bloqueado do profissional
      const isBlocked = this.blockedTimes.some(block => {
        if (block.data !== dateStr) return false;
        
        const bStartParts = block.horario_inicio.split(':');
        const bEndParts = block.horario_fim.split(':');
        const bStart = parseInt(bStartParts[0]) * 60 + parseInt(bStartParts[1]);
        const bEnd = parseInt(bEndParts[0]) * 60 + parseInt(bEndParts[1]);

        return current >= bStart && current < bEnd;
      });

      if (!isReserved && !isBlocked) {
        slots.push(timeStr);
      }
    }

    // Renderizar slots na tela
    if (slots.length === 0) {
      slotsContainer.innerHTML = `
        <div class="no-slots-alert">
          <i class="far fa-frown"></i>
          <p>Não há horários disponíveis para este dia. Escolha outra data.</p>
        </div>
      `;
      return;
    }

    slotsContainer.innerHTML = `
      <h4 class="slots-section-title">Horários livres para o dia ${date.toLocaleDateString('pt-BR')}:</h4>
      <div class="slots-grid">
        ${slots.map(time => `<button class="slot-btn" data-time="${time}">${time}</button>`).join('')}
      </div>
    `;

    // Adicionar eventos de click aos botões de horário
    slotsContainer.querySelectorAll('.slot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        slotsContainer.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        
        const selectedTime = btn.getAttribute('data-time');
        this.onSlotSelectCallback(this.selectedDate, selectedTime);
      });
    });
  },

  // Helper: Formata uma data Date em YYYY-MM-DD local
  formatDateIso(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
};

window.AppointmentCalendar = AppointmentCalendar;
