import { AuditRepository } from '../../repositories/audit.repository.js';

document.addEventListener('DOMContentLoaded', () => {
  loadLogs();

  document.getElementById('filter-form').addEventListener('submit', (e) => {
    e.preventDefault();
    loadLogs();
  });
});

async function loadLogs() {
  const tbody = document.getElementById('logs-tbody');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Carregando logs...</td></tr>';

  const filters = {
    entity_type: document.getElementById('filter-module').value,
    action: document.getElementById('filter-action').value,
    start_date: document.getElementById('filter-start').value,
    end_date: document.getElementById('filter-end').value,
    limit: 100
  };

  const { data: logs, error } = await AuditRepository.getLogs(filters);

  if (error) {
    window.Toast?.error('Erro ao carregar logs.');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Falha ao carregar dados.</td></tr>';
    return;
  }

  if (!logs || logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhum registro encontrado para este filtro.</td></tr>';
    updateDashboard(0, 0);
    return;
  }

  // Estatisticas rapidas
  const hoje = new Date().toLocaleDateString('pt-BR');
  const logsHoje = logs.filter(l => l.date.includes(hoje)).length;
  const deletes = logs.filter(l => l.action === 'DELETE').length;

  updateDashboard(logsHoje, deletes);

  tbody.innerHTML = '';
  logs.forEach(log => {
    const tr = document.createElement('tr');
    
    let actionClass = '';
    if (log.action === 'INSERT') actionClass = 'log-action-insert';
    if (log.action === 'UPDATE') actionClass = 'log-action-update';
    if (log.action === 'DELETE') actionClass = 'log-action-delete';

    tr.innerHTML = `
      <td>${log.date}</td>
      <td>
        <strong>${log.userName}</strong><br>
        <small class="badge">${log.roleName}</small>
      </td>
      <td>${log.module}</td>
      <td class="${actionClass}">${log.action}</td>
      <td>${log.description}</td>
    `;
    tbody.appendChild(tr);
  });
}

function updateDashboard(hoje, deletes) {
  document.getElementById('count-hoje').textContent = hoje;
  document.getElementById('count-deletes').textContent = deletes;
  // Usuarios count (estático placeholder para manter a tela)
  document.getElementById('count-usuarios').textContent = 'Ativo';
}
