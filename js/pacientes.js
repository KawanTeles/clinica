// Gestão de Pacientes / CRM — Clínica Zoe
// Reaproveita: supabaseClient, Notifications, ZoeAudit, Auth, padrões do admin.js

let pacientes = [];
let prontuarios = [];
let anexos = [];
let historico = [];
let agendamentos = [];
let currentPacienteId = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('dashboard-app')) return;

  const session = await window.Auth.checkProtectedRoute();
  if (!session) return;

  if (session.role === 'professional') {
    document.body.classList.add('role-professional');
    document.getElementById('admin-sidebar-nav')?.classList.add('hide-admin-only');
  }

  setupSidebar();
  setupModals();
  setupFilters();
  await refreshAll();

  const loader = document.getElementById('loader-overlay');
  if (loader) loader.classList.add('fade-out');

  // ══ Sidebar (hamburguer + user card) ══
  function setupSidebar() {
    const h = document.getElementById('hamburger-btn');
    const sb = document.getElementById('admin-sidebar');
    const ov = document.getElementById('sidebar-overlay');
    const open = () => { sb?.classList.add('sidebar-open'); ov?.classList.add('active'); h?.classList.add('active'); document.body.style.overflow = 'hidden'; };
    const close = () => { sb?.classList.remove('sidebar-open'); ov?.classList.remove('active'); h?.classList.remove('active'); document.body.style.overflow = ''; };
    h?.addEventListener('click', () => sb?.classList.contains('sidebar-open') ? close() : open());
    ov?.addEventListener('click', close);

    const u = JSON.parse(localStorage.getItem('zoe_current_session') || '{}');
    if (u.email) {
      const name = u.email.split('@')[0];
      const disp = name.charAt(0).toUpperCase() + name.slice(1);
      const ne = document.getElementById('sidebar-user-name');
      const ae = document.getElementById('sidebar-avatar');
      if (ne) ne.textContent = disp;
      if (ae) ae.textContent = disp.charAt(0).toUpperCase();
    }
    const re = document.getElementById('sidebar-user-role');
    if (re) re.textContent = u.role === 'professional' ? 'Profissional' : 'Administrador';
  }

  // ══ Modais ══
  function setupModals() {
    const btnAdd = document.getElementById('btn-add-paciente');
    btnAdd?.addEventListener('click', () => {
      document.getElementById('form-paciente').reset();
      document.getElementById('pac-id').value = '';
      openModal('modal-paciente');
    });

    document.querySelectorAll('.modal .close-modal-icon').forEach(b => {
      b.addEventListener('click', () => b.closest('.modal').style.display = 'none');
    });
    window.addEventListener('click', e => { if (e.target.classList.contains('modal')) e.target.style.display = 'none'; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(m => m.style.display = 'none'); });

    // Abas do prontuário
    document.querySelectorAll('#pront-tabs a').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        document.querySelectorAll('#pront-tabs .admin-nav-item').forEach(li => li.classList.remove('active'));
        a.closest('.admin-nav-item').classList.add('active');
        const tab = a.dataset.tab;
        ['tab-resumo', 'tab-historico', 'tab-anexos'].forEach(t => document.getElementById(t).style.display = t === tab ? 'block' : 'none');
      });
    });

    // Salvar paciente
    document.getElementById('form-paciente')?.addEventListener('submit', async e => {
      e.preventDefault();
      const id = document.getElementById('pac-id').value;
      const payload = {
        nome: document.getElementById('pac-nome').value.trim(),
        cpf: document.getElementById('pac-cpf').value.trim(),
        telefone: document.getElementById('pac-telefone').value.trim(),
        email: document.getElementById('pac-email').value.trim(),
        data_cadastro: new Date().toISOString()
      };
      try {
        if (id) {
          await sb_from('pacientes').update(payload).eq('id', id);
          window.ZoeAudit.log('editou', 'paciente', id, 'Paciente atualizado');
          window.Notifications.show('Atualizado', 'Paciente salvo com sucesso.', 'success');
        } else {
          const { data } = await sb_from('pacientes').insert(payload);
          const newId = Array.isArray(data) ? data[0]?.id : data?.id;
          window.ZoeAudit.log('criou', 'paciente', newId, 'Paciente cadastrado');
          window.Notifications.show('Cadastrado', 'Paciente adicionado.', 'success');
        }
        document.getElementById('modal-paciente').style.display = 'none';
        await refreshAll();
      } catch (err) {
        window.Notifications.show('Erro', err.message, 'error');
      }
    });

    // Salvar prontuário
    document.getElementById('form-prontuario')?.addEventListener('submit', async e => {
      e.preventDefault();
      const pacienteId = document.getElementById('pront-paciente-id').value;
      const profId = document.getElementById('pront-profissional-id').value;
      const existingId = document.getElementById('pront-id').value;
      const payload = {
        paciente_id: pacienteId,
        profissional_id: profId || null,
        historico_clinico: document.getElementById('pront-historico').value,
        observacoes: document.getElementById('pront-observacoes').value,
        anotacoes: document.getElementById('pront-anotacoes').value,
        medicamentos: document.getElementById('pront-medicamentos').value,
        alergias: document.getElementById('pront-alergias').value,
        exames: document.getElementById('pront-exames').value,
        updated_at: new Date().toISOString()
      };
      try {
        if (existingId) {
          await sb_from('prontuarios').update(payload).eq('id', existingId);
        } else {
          await sb_from('prontuarios').insert(payload);
        }
        window.ZoeAudit.log('editou', 'prontuario', pacienteId, 'Prontuário atualizado');
        window.Notifications.show('Prontuário', 'Registro clínico salvo.', 'success');
        await refreshAll();
      } catch (err) {
        window.Notifications.show('Erro', err.message, 'error');
      }
    });

    // Anexo
    document.getElementById('form-anexo')?.addEventListener('submit', async e => {
      e.preventDefault();
      const file = document.getElementById('anexo-file').files[0];
      if (!file) return;
      try {
        const url = `local://${file.name}`;
        await sb_from('anexos').insert({
          paciente_id: currentPacienteId,
          profissional_id: getProfId(),
          nome_arquivo: file.name,
          url,
          tipo: file.type || 'arquivo',
          tamanho: file.size
        });
        window.ZoeAudit.log('anexou', 'paciente', currentPacienteId, file.name);
        await loadAnexos(currentPacienteId);
        window.Notifications.show('Anexo', 'Arquivo anexado.', 'success');
      } catch (err) {
        window.Notifications.show('Erro', err.message, 'error');
      }
    });
  }

  function setupFilters() {
    const s = document.getElementById('search-pac-input');
    const st = document.getElementById('filter-pac-status');
    s?.addEventListener('input', renderPacientes);
    st?.addEventListener('change', renderPacientes);
    document.getElementById('btn-clear-pac-filters')?.addEventListener('click', () => {
      if (s) s.value = ''; if (st) st.value = ''; renderPacientes();
    });
  }

  function sb_from(table) {
    const base = window.supabaseClient.from(table);
    if (typeof base.then === 'function') return base; // mock retorna thenável
    // Se for query builder encadeável, retorna direto
    return base;
  }

  function getProfId() {
    const s = JSON.parse(localStorage.getItem('zoe_current_session') || '{}');
    return s.professional_id || null;
  }

  // Escapa HTML para evitar XSS ao renderizar dados de pacientes no innerHTML
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  async function refreshAll() {
    try {
      const { data: p } = await sb_from('pacientes').select('*'); pacientes = p || [];
      const { data: pr } = await sb_from('prontuarios').select('*'); prontuarios = pr || [];
      const { data: an } = await sb_from('anexos').select('*'); anexos = an || [];
      const { data: ag } = await sb_from('agendamentos').select('*'); agendamentos = ag || [];
      const { data: hi } = await sb_from('historico_paciente').select('*'); historico = hi || [];
      calculateCounters();
      renderPacientes();
    } catch (err) {
      console.error(err);
      window.Notifications.show('Erro', 'Falha ao carregar pacientes.', 'error');
    }
  }

  function calculateCounters() {
    const now = new Date();
    const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const novos = pacientes.filter(p => new Date(p.data_cadastro) >= monthAgo).length;
    const ativosIds = new Set(agendamentos.map(a => a.paciente_id));
    const ativos = pacientes.filter(p => ativosIds.has(p.id)).length;
    const prox = agendamentos.filter(a => new Date(a.data) >= now && a.status !== 'Cancelado').length;
    const inativos = pacientes.filter(p => !ativosIds.has(p.id) || !recentConsulta(p.id)).length;
    const comAlergia = prontuarios.filter(x => x.alergias && x.alergias.trim()).length;
    set('stat-total', pacientes.length);
    set('stat-novos', novos);
    set('stat-ativos', ativos);
    set('stat-prox', prox);
    set('stat-pront', prontuarios.length);
    set('stat-anexos', anexos.length);
    set('stat-inativos', inativos);
    set('stat-alergias', comAlergia);
  }

  function recentConsulta(pacienteId) {
    const limite = new Date(); limite.setDate(limite.getDate() - 60);
    return agendamentos.some(a => a.paciente_id === pacienteId && new Date(a.data) >= limite);
  }

  function renderPacientes() {
    const body = document.getElementById('pacientes-body');
    if (!body) return;
    const search = document.getElementById('search-pac-input')?.value.toLowerCase() || '';
    const status = document.getElementById('filter-pac-status')?.value || '';

    let filtered = pacientes.filter(p => {
      const matchSearch = !search || p.nome.toLowerCase().includes(search) || (p.cpf || '').includes(search) || (p.email || '').includes(search);
      const ativosIds = new Set(agendamentos.map(a => a.paciente_id));
      let matchStatus = true;
      if (status === 'ativo') matchStatus = ativosIds.has(p.id);
      if (status === 'inativo') matchStatus = !recentConsulta(p.id);
      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:40px;"><i class="fas fa-users" style="font-size:2rem;opacity:0.3;display:block;margin-bottom:10px;"></i>Nenhum paciente encontrado.</td></tr>`;
      return;
    }

    body.innerHTML = filtered.map(p => {
      const ativosIds = new Set(agendamentos.map(a => a.paciente_id));
      const isAtivo = ativosIds.has(p.id) && recentConsulta(p.id);
      const badge = isAtivo ? 'badge-confirmed' : 'badge-canceled';
      const label = isAtivo ? 'Ativo' : 'Inativo';
      return `<tr data-id="${esc(p.id)}">
        <td><strong>${esc(p.nome)}</strong></td>
        <td>${esc(p.cpf) || '-'}</td>
        <td>${esc(p.telefone) || '-'}</td>
        <td>${esc(p.email) || '-'}</td>
        <td><span class="status-badge ${badge}">${label}</span></td>
        <td>
          <div class="row-actions">
            <button class="action-btn text-primary" title="Prontuário" onclick="PAC.abrirProntuario('${esc(p.id)}')"><i class="fas fa-notes-medical"></i></button>
            <button class="action-btn text-warning" title="Editar" onclick="PAC.editar('${esc(p.id)}')"><i class="fas fa-edit"></i></button>
            <button class="action-btn text-danger" title="Excluir" onclick="PAC.excluir('${esc(p.id)}')"><i class="far fa-trash-alt"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  window.PAC = {
    editar(id) {
      const p = pacientes.find(x => x.id === id);
      if (!p) return;
      document.getElementById('pac-id').value = p.id;
      document.getElementById('pac-nome').value = p.nome;
      document.getElementById('pac-cpf').value = p.cpf || '';
      document.getElementById('pac-telefone').value = p.telefone || '';
      document.getElementById('pac-email').value = p.email || '';
      openModal('modal-paciente');
    },
    async excluir(id) {
      if (!confirm('Excluir o paciente permanentemente?')) return;
      try {
        await sb_from('pacientes').delete().eq('id', id);
        window.ZoeAudit.log('excluiu', 'paciente', id, 'Paciente removido');
        window.Notifications.show('Excluído', 'Paciente removido.', 'success');
        await refreshAll();
      } catch (err) { window.Notifications.show('Erro', err.message, 'error'); }
    },
    async abrirProntuario(id) {
      currentPacienteId = id;
      const p = pacientes.find(x => x.id === id);
      const pr = prontuarios.find(x => x.paciente_id === id && (!getProfId() || x.profissional_id === getProfId()));
      document.getElementById('pront-nome').textContent = p?.nome || 'Paciente';
      document.getElementById('pront-paciente-id').value = id;
      document.getElementById('pront-profissional-id').value = getProfId() || (pr?.profissional_id || '');
      document.getElementById('pront-id').value = pr?.id || '';
      if (pr) {
        document.getElementById('pront-historico').value = pr.historico_clinico || '';
        document.getElementById('pront-observacoes').value = pr.observacoes || '';
        document.getElementById('pront-anotacoes').value = pr.anotacoes || '';
        document.getElementById('pront-medicamentos').value = pr.medicamentos || '';
        document.getElementById('pront-alergias').value = pr.alergias || '';
        document.getElementById('pront-exames').value = pr.exames || '';
      } else {
        ['pront-historico','pront-observacoes','pront-anotacoes','pront-medicamentos','pront-alergias','pront-exames'].forEach(f => document.getElementById(f).value = '');
      }
      // Registra evento no histórico se não existir
      await loadHistorico(id);
      await loadAnexos(id);
      openModal('modal-prontuario');
    }
  };

  async function loadHistorico(pacienteId) {
    const items = historico.filter(h => h.paciente_id === pacienteId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const icons = { agendou: 'fa-calendar-plus', confirmou: 'fa-check-circle', realizou: 'fa-stethoscope', retorno: 'fa-undo', anexo: 'fa-paperclip', cancelou: 'fa-times-circle' };
    const container = document.getElementById('historico-timeline');
    if (!container) return;
    if (items.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted);padding:20px;">Nenhum evento registrado ainda.</p>`;
      return;
    }
    container.innerHTML = items.map(h => `
      <div class="timeline-item">
        <div class="timeline-icon"><i class="fas ${icons[h.tipo] || 'fa-circle'}"></i></div>
        <div class="timeline-content">
          <strong>${h.descricao || h.tipo}</strong>
          <small>${new Date(h.created_at).toLocaleString('pt-BR')}</small>
        </div>
      </div>`).join('');
  }

  async function loadAnexos(pacienteId) {
    const items = anexos.filter(a => a.paciente_id === pacienteId);
    const body = document.getElementById('anexos-body');
    if (!body) return;
    if (items.length === 0) { body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">Nenhum anexo.</td></tr>`; return; }
    body.innerHTML = items.map(a => `
      <tr>
        <td><i class="fas fa-file"></i> ${a.nome_arquivo}</td>
        <td>${a.tipo || '-'}</td>
        <td>${new Date(a.created_at).toLocaleDateString('pt-BR')}</td>
        <td><div class="row-actions">
          <button class="action-btn text-danger" onclick="PAC.removerAnexo('${a.id}')"><i class="far fa-trash-alt"></i></button>
        </div></td>
      </tr>`).join('');
  }

  window.PAC.removerAnexo = async function (id) {
    if (!confirm('Remover anexo?')) return;
    await sb_from('anexos').delete().eq('id', id);
    await loadAnexos(currentPacienteId);
    window.Notifications.show('Removido', 'Anexo excluído.', 'success');
  };

  function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.style.display = 'block';
  }
});
