// Gerenciamento de Gráficos do Dashboard com Chart.js - Clínica Zoe

const ChartsManager = {
  charts: {},

  // Auxiliar para obter estilos de fonte e cores do tema ativo
  getThemeColors() {
    const isDark = document.body.classList.contains('dark-theme');
    return {
      text: isDark ? '#F5F5F7' : '#1D1D1F',
      grid: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
      tooltipBg: isDark ? 'rgba(28, 28, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
      tooltipText: isDark ? '#FFFFFF' : '#1D1D1F',
      primary: '#2E8B57',
      secondary: '#9B59B6',
      palette: ['#2E8B57', '#9B59B6', '#3498DB', '#F1C40F', '#E74C3C', '#1ABC9C', '#34495E']
    };
  },

  // Destrói gráficos existentes para evitar bugs de sobreposição
  destroyCharts() {
    Object.keys(this.charts).forEach(key => {
      if (this.charts[key]) {
        this.charts[key].destroy();
      }
    });
    this.charts = {};
  },

  // Renderiza todos os gráficos baseados nos dados do Supabase
  renderDashboardCharts(appointments, professionals, specialties) {
    this.destroyCharts();
    
    const colors = this.getThemeColors();

    // Configurações globais padrão do Chart.js
    if (typeof Chart !== 'undefined') {
      Chart.defaults.color = colors.text;
      Chart.defaults.font.family = 'Inter, sans-serif';
    } else {
      console.warn("Chart.js não está carregado. Impossível desenhar gráficos.");
      return;
    }

    // 1. Gráfico de Evolução de Agendamentos (Últimos 7 dias)
    this.renderEvolucaoChart(appointments, colors);

    // 2. Gráfico de Especialidades Mais Procuradas
    this.renderEspecialidadesChart(appointments, specialties, colors);

    // 3. Gráfico de Profissionais Mais Procurados
    this.renderProfissionaisChart(appointments, professionals, colors);

    // 4. Gráfico de Status de Consultas
    this.renderStatusChart(appointments, colors);
  },

  // 1. Evolução de consultas (Últimos 7 dias)
  renderEvolucaoChart(appointments, colors) {
    const ctx = document.getElementById('chart-evolucao');
    if (!ctx) return;

    // Agrega agendamentos por dia nos últimos 7 dias
    const last7Days = [];
    const counts = [];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      last7Days.push(displayDate);

      const count = appointments.filter(a => a.data === iso).length;
      counts.push(count);
    }

    this.charts.evolucao = new Chart(ctx, {
      type: 'line',
      data: {
        labels: last7Days,
        datasets: [{
          label: 'Consultas Agendadas',
          data: counts,
          borderColor: colors.primary,
          backgroundColor: 'rgba(46, 139, 87, 0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { color: colors.grid }, ticks: { color: colors.text } },
          y: { 
            grid: { color: colors.grid }, 
            ticks: { stepSize: 1, precision: 0, color: colors.text },
            beginAtZero: true 
          }
        }
      }
    });
  },

  // 2. Especialidades
  renderEspecialidadesChart(appointments, specialties, colors) {
    const ctx = document.getElementById('chart-especialidades');
    if (!ctx) return;

    const dataMap = {};
    specialties.forEach(s => dataMap[s.nome] = 0);

    // Conta agendamentos por especialidade (precisa mapear pelo médico)
    appointments.forEach(appt => {
      const prof = window.dashboardProfessionals?.find(p => p.id === appt.profissional_id);
      if (prof) {
        const spec = specialties.find(s => s.id === prof.especialidade_id);
        if (spec) {
          dataMap[spec.nome] = (dataMap[spec.nome] || 0) + 1;
        }
      }
    });

    const labels = Object.keys(dataMap).filter(key => dataMap[key] > 0);
    const values = labels.map(key => dataMap[key]);

    // Fallback se não houver agendamentos
    const finalLabels = labels.length ? labels : ['Nenhum agendamento'];
    const finalValues = values.length ? values : [0];

    this.charts.especialidades = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: finalLabels,
        datasets: [{
          data: finalValues,
          backgroundColor: colors.secondary,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // Barra horizontal
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { color: colors.grid }, ticks: { stepSize: 1, precision: 0, color: colors.text } },
          y: { grid: { display: false }, ticks: { color: colors.text } }
        }
      }
    });
  },

  // 3. Profissionais
  renderProfissionaisChart(appointments, professionals, colors) {
    const ctx = document.getElementById('chart-profissionais');
    if (!ctx) return;

    const dataMap = {};
    professionals.forEach(p => dataMap[p.nome] = 0);

    appointments.forEach(appt => {
      const prof = professionals.find(p => p.id === appt.profissional_id);
      if (prof) {
        dataMap[prof.nome] = (dataMap[prof.nome] || 0) + 1;
      }
    });

    const labels = Object.keys(dataMap).filter(key => dataMap[key] > 0);
    const values = labels.map(key => dataMap[key]);

    const finalLabels = labels.length ? labels : ['Nenhum'];
    const finalValues = values.length ? values : [0];

    this.charts.profissionais = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: finalLabels,
        datasets: [{
          data: finalValues,
          backgroundColor: colors.palette,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, color: colors.text } }
        }
      }
    });
  },

  // 4. Status de consultas
  renderStatusChart(appointments, colors) {
    const ctx = document.getElementById('chart-status');
    if (!ctx) return;

    const statusCounts = {
      Agendado: 0,
      Confirmado: 0,
      Cancelado: 0,
      Finalizado: 0
    };

    appointments.forEach(appt => {
      if (statusCounts[appt.status] !== undefined) {
        statusCounts[appt.status]++;
      }
    });

    this.charts.status = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: Object.keys(statusCounts),
        datasets: [{
          data: Object.values(statusCounts),
          backgroundColor: ['#3498DB', '#2E8B57', '#E74C3C', '#95A5A6'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, color: colors.text } }
        }
      }
    });
  }
};

// Ouvinte para reajustar as cores se o tema for alternado em tempo real
window.addEventListener('themeChanged', () => {
  if (window.dashboardAppointments) {
    ChartsManager.renderDashboardCharts(
      window.dashboardAppointments,
      window.dashboardProfessionals,
      window.dashboardSpecialties
    );
  }
});

window.ChartsManager = ChartsManager;
