import { AuthRepository } from '../../repositories/auth.repository.js';
import { CrmFeedbackRepository } from '../../repositories/crm-feedback.repository.js';

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
      // 1. Estatísticas
      const stats = await CrmFeedbackRepository.getFeedbackStats(clinicId);
      document.getElementById('val-total').textContent = stats.total;
      document.getElementById('val-avg-rating').textContent = stats.avgRating;
      document.getElementById('val-bad-ratings').textContent = stats.badRatings;
      document.getElementById('val-response-rate').textContent = `${stats.responseRate}%`;

      // 2. Lista
      const feedbacks = await CrmFeedbackRepository.getFeedbacksList(clinicId);
      renderFeedbacks(feedbacks);

    } catch (err) {
      console.error('Erro ao recarregar dashboard:', err);
    }
  }

  function renderFeedbacks(feedbacks) {
    const tbody = document.getElementById('feedbacks-tbody');
    const emptyState = document.getElementById('empty-state');
    
    if (!feedbacks || feedbacks.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    tbody.innerHTML = feedbacks.map(item => {
      const dateStr = new Date(item.created_at).toLocaleString('pt-BR');
      
      let badgeClass = 'rating-high';
      if (item.rating <= 3) badgeClass = 'rating-low';
      else if (item.rating === 4) badgeClass = 'rating-medium';

      const stars = Array(5).fill(0).map((_, i) => 
        `<i class="fas fa-star" style="color: ${i < item.rating ? 'inherit' : '#e0e0e0'}"></i>`
      ).join('');

      return `
        <tr>
          <td><strong>${item.patient_name}</strong></td>
          <td>${item.professional_name}</td>
          <td><span class="rating-badge ${badgeClass}">${stars} ${item.rating}/5</span></td>
          <td>${item.comment || '-'}</td>
          <td style="color: var(--text-color-muted); font-size: 0.85rem;">${dateStr}</td>
        </tr>
      `;
    }).join('');
  }
});
