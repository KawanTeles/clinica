import { AuthRepository } from '../../repositories/auth.repository.js';
import { CrmAutomationRepository } from '../../repositories/crm-automation.repository.js';

document.addEventListener('DOMContentLoaded', async () => {
  let clinicId = null;

  try {
    const { data: { session } } = await AuthRepository.getSession();
    if (!session) return; // Guard handles redirection

    const profileRes = await AuthRepository.getPerfilUsuario(session.user.id);
    if (!profileRes.data || !profileRes.data.clinic_id) {
      throw new Error("Clínica não encontrada para o usuário logado.");
    }

    clinicId = profileRes.data.clinic_id;

    setupTabs();
    await loadDashboardStats(clinicId);
    await loadRules(clinicId);
    await loadHistory(clinicId);

  } catch (err) {
    console.error('Erro ao inicializar página de automações:', err);
    alert('Erro ao carregar os dados de automação.');
  }

  function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        // Remover classes active
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        // Adicionar classes active no item clicado
        btn.classList.add('active');
        const targetId = `tab-${btn.getAttribute('data-tab')}`;
        document.getElementById(targetId).classList.add('active');
      });
    });
  }

  async function loadDashboardStats(clinicId) {
    try {
      const stats = await CrmAutomationRepository.getDashboardStats(clinicId);
      
      document.getElementById('stat-total-rules').textContent = stats.totalRules;
      document.getElementById('stat-active-rules').textContent = stats.activeRules;
      document.getElementById('stat-executions-today').textContent = stats.executionsToday;
      document.getElementById('stat-recent-failures').textContent = stats.recentFailures;
    } catch (err) {
      console.error('Erro ao carregar estatísticas do dashboard:', err);
    }
  }

  async function loadRules(clinicId) {
    const tbody = document.getElementById('rules-table-body');
    try {
      const rules = await CrmAutomationRepository.getRules(clinicId);

      if (!rules || rules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Nenhuma regra encontrada.</td></tr>';
        return;
      }

      tbody.innerHTML = '';
      rules.forEach(rule => {
        const tr = document.createElement('tr');
        
        const statusClass = rule.active ? 'status-active' : 'status-inactive';
        const statusText = rule.active ? 'Ativa' : 'Inativa';
        
        const btnClass = rule.active ? 'active-btn' : 'inactive-btn';
        const btnText = rule.active ? 'Desativar' : 'Ativar';

        tr.innerHTML = `
          <td>${rule.name || 'Sem nome'}</td>
          <td><code>${rule.trigger_event}</code></td>
          <td><code>${rule.action_type}</code></td>
          <td><span class="status-badge ${statusClass}">${statusText}</span></td>
          <td>${new Date(rule.created_at).toLocaleDateString('pt-BR')}</td>
          <td>
            <button class="btn-toggle-rule ${btnClass}" data-id="${rule.id}" data-active="${rule.active}">
              ${btnText}
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Bind events to toggle buttons
      document.querySelectorAll('.btn-toggle-rule').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const ruleId = e.target.getAttribute('data-id');
          const isCurrentlyActive = e.target.getAttribute('data-active') === 'true';
          const newStatus = !isCurrentlyActive;
          
          if (confirm(`Deseja realmente ${newStatus ? 'ativar' : 'desativar'} esta regra?`)) {
            try {
              e.target.disabled = true;
              e.target.textContent = 'Processando...';
              
              await CrmAutomationRepository.toggleRule(ruleId, newStatus);
              
              // Recarregar os dados
              await loadRules(clinicId);
              await loadDashboardStats(clinicId);
            } catch (error) {
              console.error('Erro ao alternar status da regra:', error);
              alert('Erro ao atualizar regra.');
              e.target.disabled = false;
              e.target.textContent = isCurrentlyActive ? 'Desativar' : 'Ativar';
            }
          }
        });
      });

    } catch (err) {
      console.error('Erro ao carregar regras:', err);
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">Erro ao carregar as regras.</td></tr>';
    }
  }

  async function loadHistory(clinicId) {
    const tbody = document.getElementById('history-table-body');
    try {
      const logs = await CrmAutomationRepository.getLogs(clinicId, 100);

      if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Nenhum registro encontrado.</td></tr>';
        return;
      }

      tbody.innerHTML = '';
      logs.forEach(log => {
        const tr = document.createElement('tr');
        
        const dateStr = new Date(log.created_at).toLocaleString('pt-BR');
        const patientName = log.patients ? log.patients.nome : 'N/A';
        const statusClass = `status-${log.status}`;

        tr.innerHTML = `
          <td>${dateStr}</td>
          <td><code>${log.event}</code></td>
          <td><span class="status-badge ${statusClass}">${log.status}</span></td>
          <td>${patientName}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: red;">Erro ao carregar o histórico.</td></tr>';
    }
  }
});
