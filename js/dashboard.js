// Painel Administrativo de Controle e Métricas - Clínica Zoe

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('dashboard-app')) return;

  // Estado Geral do Dashboard
  let appointments = [];
  let professionals = [];
  let patients = [];
  let specialties = [];
  
  // Inicialização principal
  await initDashboard();

  async function initDashboard() {
    // 1. Verificar autenticação
    const session = await window.Auth.checkProtectedRoute();
    if (!session) return;

    // Ajustar interface para Profissionais logados (ver apenas a própria agenda)
    if (session.role === 'professional') {
      document.body.classList.add('role-professional');
      document.getElementById('admin-sidebar-nav').classList.add('hide-admin-only');
    }

    // 2. Carregar dados das tabelas
    await refreshAllData();

    // 3. Setup de Eventos e Listeners
    setupSearchFilters();
    setupActions();
    setupExports();
  }

  // Recarrega todos os dados do banco e recalcula dashboards/tabelas
  async function refreshAllData() {
    showDashboardSkeleton(true);

    try {
      const session = JSON.parse(localStorage.getItem('zoe_current_session'));
      
      // Carregar Especialidades
      const { data: specs } = await window.supabaseClient.from('especialidades').select('*');
      specialties = specs || [];
      window.dashboardSpecialties = specialties;

      // Carregar Profissionais
      const { data: profs } = await window.supabaseClient.from('profissionais').select('*');
      professionals = profs || [];
      window.dashboardProfessionals = professionals;

      // Carregar Pacientes
      const { data: pats } = await window.supabaseClient.from('pacientes').select('*');
      patients = pats || [];

      // Carregar Consultas
      let queryAppt = window.supabaseClient.from('agendamentos').select('*');
      
      // Se for profissional logado, filtra apenas suas próprias consultas
      if (session && session.role === 'professional') {
        queryAppt = queryAppt.eq('profissional_id', session.professional_id);
      }
      
      const { data: appts } = await queryAppt.order('data', { ascending: false });
      appointments = appts || [];
      window.dashboardAppointments = appointments;

      // Renderizar elementos na tela
      calculateCounters();
      renderAppointmentsTable();
      
      // Desenhar gráficos
      window.ChartsManager.renderDashboardCharts(appointments, professionals, specialties);

    } catch (err) {
      console.error("Falha ao atualizar dados no Dashboard:", err);
      window.Notifications.show('Erro ao Carregar', 'Não foi possível carregar os dados.', 'error');
    } finally {
      showDashboardSkeleton(false);
    }
  }

  // Calcula indicadores rápidos do painel
  function calculateCounters() {
    const todayStr = new Date().toISOString().split('T')[0];

    const todayAppts = appointments.filter(a => a.data === todayStr);
    const confirmed = appointments.filter(a => a.status === 'Confirmado');
    const pending = appointments.filter(a => a.status === 'Agendado');
    const canceled = appointments.filter(a => a.status === 'Cancelado');

    const cancellationRate = appointments.length > 0 
      ? Math.round((canceled.length / appointments.length) * 100) 
      : 0;

    // Injetar valores no HTML
    document.getElementById('stat-consultas-dia').innerText = todayAppts.length;
    document.getElementById('stat-pacientes-total').innerText = patients.length;
    document.getElementById('stat-consultas-confirmadas').innerText = confirmed.length;
    document.getElementById('stat-cancellation-rate').innerText = `${cancellationRate}%`;
    document.getElementById('stat-consultas-pendentes').innerText = pending.length;
    document.getElementById('stat-consultas-canceladas').innerText = canceled.length;
  }

  // Renderiza tabela de agendamentos com filtros ativos
  function renderAppointmentsTable() {
    const tableBody = document.getElementById('table-appointments-body');
    if (!tableBody) return;

    const filterSearch = document.getElementById('search-patient-input').value.toLowerCase();
    const filterStatus = document.getElementById('filter-status-select').value;
    const filterDate = document.getElementById('filter-date-input').value;

    let filtered = [...appointments];

    // Filtro por Nome/CPF
    if (filterSearch) {
      filtered = filtered.filter(appt => {
        const patient = patients.find(p => p.id === appt.paciente_id);
        return patient && (
          patient.nome.toLowerCase().includes(filterSearch) || 
          patient.cpf.includes(filterSearch)
        );
      });
    }

    // Filtro por Status
    if (filterStatus) {
      filtered = filtered.filter(appt => appt.status === filterStatus);
    }

    // Filtro por Data
    if (filterDate) {
      filtered = filtered.filter(appt => appt.data === filterDate);
    }

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 40px;">
            Nenhum agendamento encontrado para os filtros selecionados.
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = filtered.map(appt => {
      const patient = patients.find(p => p.id === appt.paciente_id) || { nome: 'Desconhecido', telefone: '', cpf: '' };
      const prof = professionals.find(p => p.id === appt.profissional_id) || { nome: 'Geral' };
      const formattedDate = new Date(appt.data + 'T00:00:00').toLocaleDateString('pt-BR');

      let badgeClass = 'badge-pending';
      if (appt.status === 'Confirmado') badgeClass = 'badge-confirmed';
      if (appt.status === 'Cancelado') badgeClass = 'badge-canceled';
      if (appt.status === 'Finalizado') badgeClass = 'badge-finalized';

      return `
        <tr data-id="${appt.id}">
          <td>
            <strong>${patient.nome}</strong><br>
            <small>${patient.cpf}</small>
          </td>
          <td>${prof.nome}</td>
          <td>${formattedDate}</td>
          <td>${appt.horario.substring(0, 5)}</td>
          <td>${patient.telefone}</td>
          <td><span class="status-badge ${badgeClass}">${appt.status}</span></td>
          <td>
            <div class="row-actions">
              ${appt.status === 'Agendado' ? `
                <button class="action-btn btn-confirm text-success" title="Confirmar Consulta"><i class="fas fa-check"></i></button>
              ` : ''}
              ${appt.status !== 'Cancelado' && appt.status !== 'Finalizado' ? `
                <button class="action-btn btn-reschedule text-warning" title="Reagendar"><i class="far fa-clock"></i></button>
                <button class="action-btn btn-cancel text-danger" title="Cancelar"><i class="fas fa-times"></i></button>
              ` : ''}
              <button class="action-btn btn-delete text-muted" title="Excluir"><i class="far fa-trash-alt"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Configura busca e filtros da tabela
  function setupSearchFilters() {
    const searchInput = document.getElementById('search-patient-input');
    const statusSelect = document.getElementById('filter-status-select');
    const dateInput = document.getElementById('filter-date-input');

    if (searchInput) searchInput.addEventListener('input', renderAppointmentsTable);
    if (statusSelect) statusSelect.addEventListener('change', renderAppointmentsTable);
    if (dateInput) dateInput.addEventListener('change', renderAppointmentsTable);
    
    // Botão Limpar Filtros
    const clearBtn = document.getElementById('btn-clear-filters');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (statusSelect) statusSelect.value = '';
        if (dateInput) dateInput.value = '';
        renderAppointmentsTable();
      });
    }
  }

  // Lógica para confirmações, cancelamentos e reagendamentos
  function setupActions() {
    const tableBody = document.getElementById('table-appointments-body');
    if (!tableBody) return;

    tableBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('.action-btn');
      if (!btn) return;

      const row = btn.closest('tr');
      const appointmentId = row.getAttribute('data-id');

      // 1. Confirmar Consulta
      if (btn.classList.contains('btn-confirm')) {
        await updateAppointmentStatus(appointmentId, 'Confirmado');
      }

      // 2. Cancelar Consulta
      if (btn.classList.contains('btn-cancel')) {
        if (confirm("Deseja realmente cancelar este agendamento?")) {
          await updateAppointmentStatus(appointmentId, 'Cancelado');
        }
      }

      // 3. Excluir Consulta do histórico
      if (btn.classList.contains('btn-delete')) {
        if (confirm("Esta ação excluirá permanentemente o agendamento do banco. Confirmar?")) {
          await deleteAppointment(appointmentId);
        }
      }

      // 4. Reagendar Consulta (Abrir Modal)
      if (btn.classList.contains('btn-reschedule')) {
        openRescheduleModal(appointmentId);
      }
    });
  }

  async function updateAppointmentStatus(id, status) {
    try {
      const { error } = await window.supabaseClient
        .from('agendamentos')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      window.Notifications.show('Status Atualizado', `Consulta alterada para: ${status}`, 'success');
      await refreshAllData();
    } catch (err) {
      console.error(err);
      window.Notifications.show('Erro ao Atualizar', err.message, 'error');
    }
  }

  async function deleteAppointment(id) {
    try {
      const { error } = await window.supabaseClient
        .from('agendamentos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      window.Notifications.show('Excluído', 'Agendamento removido com sucesso.', 'success');
      await refreshAllData();
    } catch (err) {
      console.error(err);
      window.Notifications.show('Erro ao Excluir', err.message, 'error');
    }
  }

  // Modal de Reagendamento
  let currentRescheduleId = null;
  
  function openRescheduleModal(id) {
    currentRescheduleId = id;
    const modal = document.getElementById('modal-reschedule');
    const appt = appointments.find(a => a.id === id);
    
    if (modal && appt) {
      document.getElementById('reschedule-date').value = appt.data;
      document.getElementById('reschedule-time').value = appt.horario.substring(0, 5);
      modal.style.display = 'block';
    }
  }

  // Salvar Reagendamento
  const formReschedule = document.getElementById('form-reschedule');
  if (formReschedule) {
    formReschedule.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const newDate = document.getElementById('reschedule-date').value;
      const newTime = document.getElementById('reschedule-time').value;

      try {
        const { error } = await window.supabaseClient
          .from('agendamentos')
          .update({
            data: newDate,
            horario: newTime,
            status: 'Agendado' // Volta a pendente ao reagendar
          })
          .eq('id', currentRescheduleId);

        if (error) throw error;

        window.Notifications.show('Reagendado', 'Data e hora alteradas com sucesso.', 'success');
        document.getElementById('modal-reschedule').style.display = 'none';
        await refreshAllData();
      } catch (err) {
        console.error(err);
        window.Notifications.show('Erro ao Reagendar', 'Horário indisponível ou erro no sistema.', 'error');
      }
    });

    formReschedule.querySelector('.btn-close-modal').addEventListener('click', () => {
      document.getElementById('modal-reschedule').style.display = 'none';
    });
  }

  // Configurações de exportações
  function setupExports() {
    // Exportar CSV/Excel
    const exportExcelBtn = document.getElementById('btn-export-excel');
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', () => {
        if (appointments.length === 0) {
          window.Notifications.show('Sem Dados', 'Não há agendamentos para exportar.', 'warning');
          return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Paciente;CPF;Profissional;Data;Horario;Telefone;Status\n";

        appointments.forEach(appt => {
          const patient = patients.find(p => p.id === appt.paciente_id) || { nome: 'Desconhecido', cpf: '', telefone: '' };
          const prof = professionals.find(p => p.id === appt.profissional_id) || { nome: 'Desconhecido' };
          const formattedDate = new Date(appt.data + 'T00:00:00').toLocaleDateString('pt-BR');

          csvContent += `"${patient.nome}";"${patient.cpf}";"${prof.nome}";"${formattedDate}";"${appt.horario.substring(0, 5)}";"${patient.telefone}";"${appt.status}"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `agenda_clinica_zoe_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.Notifications.show('Exportação Concluída', 'Arquivo CSV baixado com sucesso.', 'success');
      });
    }

    // Exportar/Imprimir PDF
    const exportPdfBtn = document.getElementById('btn-export-pdf');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        window.print(); // O CSS de impressão do site formata uma visualização limpa da agenda
      });
    }
  }

  // Mostra/Oculta skeletons de carregamento
  function showDashboardSkeleton(show) {
    const tableBody = document.getElementById('table-appointments-body');
    const skeletons = document.querySelectorAll('.dashboard-stat-card .num, .chart-container canvas');
    
    if (show) {
      if (tableBody) {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7">
              <div class="skeleton skeleton-text" style="height: 30px; margin: 10px 0;"></div>
              <div class="skeleton skeleton-text" style="height: 30px; margin: 10px 0;"></div>
              <div class="skeleton skeleton-text" style="height: 30px; margin: 10px 0;"></div>
            </td>
          </tr>
        `;
      }
    }
  }

  // Vincula globalmente função para reatualizar os dados via console/outros scripts
  window.refreshDashboard = refreshAllData;
});
