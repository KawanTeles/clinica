import { AuthRepository } from '../../repositories/auth.repository.js';
import { CrmAnalyticsRepository } from '../../repositories/crm-analytics.repository.js';

document.addEventListener('DOMContentLoaded', async () => {
  let clinicId = null;

  try {
    const { data: { session } } = await AuthRepository.getSession();
    if (!session) return; 

    const profileRes = await AuthRepository.getPerfilUsuario(session.user.id);
    clinicId = profileRes.data.clinic_id;

    setupEvents();
    await refreshDashboard();
  } catch (err) {
    console.error('Erro de inicialização:', err);
  }

  function setupEvents() {
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', async () => {
        const icon = btnRefresh.querySelector('i');
        icon.classList.add('fa-spin');
        await refreshDashboard();
        setTimeout(() => icon.classList.remove('fa-spin'), 500);
      });
    }
  }

  async function refreshDashboard() {
    try {
      // 1. Mensagens Hoje
      const stats = await CrmAnalyticsRepository.getTodayMessageStats(clinicId);
      document.getElementById('val-sent').textContent = stats.sent;
      document.getElementById('val-delivery').textContent = `${stats.deliveryRate}%`;

      // 2. Jobs Pendentes
      const pending = await CrmAnalyticsRepository.getPendingJobsCount(clinicId);
      document.getElementById('val-pending').textContent = pending;

      // 3. Tempo Médio
      const avgTime = await CrmAnalyticsRepository.getAverageProcessingTime(clinicId);
      document.getElementById('val-avg-time').textContent = `${avgTime}s`;

      // 4. Últimas Falhas
      const errors = await CrmAnalyticsRepository.getRecentErrors(clinicId);
      renderErrors(errors);

    } catch (err) {
      console.error('Erro ao recarregar dashboard:', err);
    }
  }

  function renderErrors(errors) {
    const container = document.getElementById('errors-container');
    const badge = document.getElementById('val-failed-count');
    
    badge.textContent = `${errors.length} falhas recentes`;
    
    if (!errors || errors.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-check-circle text-success"></i>
          <p>Nenhuma falha de automação recente. Tudo operando normalmente.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = errors.map(err => {
      const dateStr = new Date(err.created_at).toLocaleString('pt-BR');
      return `
        <div class="error-item">
          <div class="error-time"><i class="far fa-clock"></i> ${dateStr}</div>
          <div class="error-msg">${err.error_message || 'Erro Desconhecido'}</div>
          <div class="error-meta">Regra ID: ${err.rule_id || 'N/A'} | Evento ID: ${err.event_id || 'N/A'}</div>
        </div>
      `;
    }).join('');
  }
});
