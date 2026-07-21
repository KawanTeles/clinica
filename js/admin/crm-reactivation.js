import { AuthRepository } from '../../repositories/auth.repository.js';
import { CrmReactivationRepository } from '../../repositories/crm-reactivation.repository.js';

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
      const stats = await CrmReactivationRepository.getDashboardStats(clinicId);
      document.getElementById('val-total').textContent = stats.total;
      document.getElementById('val-contacted').textContent = stats.contacted;
      document.getElementById('val-responded').textContent = stats.responded;
      document.getElementById('val-reactivated').textContent = stats.reactivated;

      // 2. Lista
      const campaigns = await CrmReactivationRepository.getCampaignsList(clinicId);
      renderCampaigns(campaigns);

    } catch (err) {
      console.error('Erro ao recarregar dashboard de reativação:', err);
    }
  }

  function getStatusLabel(status) {
    const map = {
      'PENDING': 'Pendente',
      'CONTACTED': 'Contatado',
      'RESPONDED': 'Respondeu',
      'REACTIVATED': 'Recuperado',
      'IGNORED': 'Ignorado'
    };
    return map[status] || status;
  }

  function renderCampaigns(campaigns) {
    const tbody = document.getElementById('reactivation-tbody');
    const emptyState = document.getElementById('empty-state');
    
    if (!campaigns || campaigns.length === 0) {
      tbody.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    tbody.innerHTML = campaigns.map(item => {
      const dateStr = new Date(item.inactive_since).toLocaleDateString('pt-BR');
      
      const badgeClass = `status-${item.status.toLowerCase()}`;

      return `
        <tr>
          <td><strong>${item.patient_name}</strong></td>
          <td>${dateStr}</td>
          <td><span style="color: #dc3545; font-weight: 600;">${item.inactive_days} dias</span></td>
          <td><span class="status-badge ${badgeClass}">${getStatusLabel(item.status)}</span></td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="alert('Ver detalhes em breve')">Detalhes</button>
          </td>
        </tr>
      `;
    }).join('');
  }
});
