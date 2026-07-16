// Agenda Inteligente — Clínica Zoe (reaproveita calendário e padrões existentes)
document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('dashboard-app')) return;
  const session = await window.Auth.checkProtectedRoute();
  if (!session) return;

  const S = () => window.supabaseClient.from('agendamentos');
  let agendamentos = [];
  let pacientes = [];
  let profissionais = [];

  setupSidebar();
  setupViews();

  await load();
  document.getElementById('loader-overlay')?.classList.add('fade-out');

  function setupSidebar() {
    const h = document.getElementById('hamburger-btn'), sb = document.getElementById('admin-sidebar'), ov = document.getElementById('sidebar-overlay');
    const open = () => { sb?.classList.add('sidebar-open'); ov?.classList.add('active'); document.body.style.overflow='hidden'; };
    const close = () => { sb?.classList.remove('sidebar-open'); ov?.classList.remove('active'); document.body.style.overflow=''; };
    h?.addEventListener('click', () => sb?.classList.contains('sidebar-open') ? close() : open());
    ov?.addEventListener('click', close);
    const u = JSON.parse(localStorage.getItem('zoe_current_session') || '{}');
    if (u.email) { const n = u.email.split('@')[0].replace(/^\w/, c=>c.toUpperCase()); document.getElementById('sidebar-user-name').textContent = n; document.getElementById('sidebar-avatar').textContent = n.charAt(0).toUpperCase(); }
    document.getElementById('sidebar-user-role').textContent = u.role==='professional'?'Profissional':'Administrador';
    if (session.role==='professional') document.getElementById('admin-sidebar-nav')?.classList.add('hide-admin-only');
  }

  function setupViews() {
    document.querySelectorAll('.ag-view').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('.ag-view').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const v = b.dataset.view;
      ['hoje','semana','mes','calendario'].forEach(x => document.getElementById('view-'+x).style.display = x===v ? 'block':'none');
      if (v==='calendario') renderCalendario();
    }));
    document.getElementById('ag-search')?.addEventListener('input', () => { renderHoje(); renderSemana(); renderMes(); });
    const fp = document.getElementById('filtro-prof');
    fp?.addEventListener('change', () => { renderHoje(); renderSemana(); renderMes(); });
  }

  async function load() {
    const profFilter = session.role==='professional' ? { eq: ['profissional_id', session.professional_id] } : null;
    let q = S().select('*');
    if (profFilter) q = q.eq('profissional_id', session.professional_id);
    const { data: ag } = await q.order('data', { ascending: true });
    agendamentos = ag || [];
    const { data: pac } = await window.supabaseClient.from('pacientes').select('*'); pacientes = pac || [];
    const { data: prof } = await window.supabaseClient.from('profissionais').select('*'); profissionais = prof || [];

    const sel = document.getElementById('filtro-prof');
    if (sel) sel.innerHTML = '<option value="">Todos os profissionais</option>' + profissionais.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('');

    renderHoje(); renderSemana(); renderMes();
    calcCounters();
  }

  function filtros() {
    const termo = (document.getElementById('ag-search')?.value || '').toLowerCase();
    const prof = document.getElementById('filtro-prof')?.value || '';
    return agendamentos.filter(a => {
      const pac = pacientes.find(p=>p.id===a.paciente_id);
      const okT = !termo || (pac && (pac.nome.toLowerCase().includes(termo) || (pac.cpf||'').includes(termo)));
      const okP = !prof || a.profissional_id===prof;
      return okT && okP;
    });
  }

  function pacNome(id){ const p = pacientes.find(x=>x.id===id); return p?p.nome:'Desconhecido'; }
  function profNome(id){ const p = profissionais.find(x=>x.id===id); return p?p.nome:'Geral'; }
  function esc(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function badge(s){ const m={Confirmado:'badge-confirmed',Cancelado:'badge-canceled',Finalizado:'badge-finalized'}; return `<span class="status-badge ${m[s]||'badge-pending'}">${esc(s)}</span>`; }
  function iso(d){ return d.toISOString().split('T')[0]; }

  function renderHoje() {
    const hoje = iso(new Date());
    const lista = filtros().filter(a => a.data === hoje).sort((a,b)=>a.horario.localeCompare(b.horario));
    fill('ag-body-hoje', lista.map(a=>`<tr><td>${a.horario?.substring(0,5)}</td><td>${esc(pacNome(a.paciente_id))}</td><td>${esc(profNome(a.profissional_id))}</td><td>${badge(a.status)}</td></tr>`));
  }
  function renderSemana() {
    const hoje = new Date(); const ini = new Date(); ini.setDate(hoje.getDate()-6);
    const lista = filtros().filter(a => a.data>=iso(ini) && a.data<=iso(hoje)).sort((a,b)=>a.data.localeCompare(b.data)||a.horario.localeCompare(b.horario));
    fill('ag-body-semana', lista.map(a=>`<tr><td>${new Date(a.data+'T00:00:00').toLocaleDateString('pt-BR')}</td><td>${a.horario?.substring(0,5)}</td><td>${esc(pacNome(a.paciente_id))}</td><td>${esc(profNome(a.profissional_id))}</td><td>${badge(a.status)}</td></tr>`));
  }
  function renderMes() {
    const n = new Date();
    const lista = filtros().filter(a => { const d=new Date(a.data+'T00:00:00'); return d.getMonth()===n.getMonth() && d.getFullYear()===n.getFullYear(); }).sort((a,b)=>a.data.localeCompare(b.data)||a.horario.localeCompare(b.horario));
    fill('ag-body-mes', lista.map(a=>`<tr><td>${new Date(a.data+'T00:00:00').toLocaleDateString('pt-BR')}</td><td>${a.horario?.substring(0,5)}</td><td>${esc(pacNome(a.paciente_id))}</td><td>${esc(profNome(a.profissional_id))}</td><td>${badge(a.status)}</td></tr>`));
  }
  function fill(id, rows) {
    const b = document.getElementById(id);
    if (!b) return;
    b.innerHTML = rows.length ? rows.join('') : `<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">Nenhuma consulta.</td></tr>`;
  }

  function calcCounters() {
    const hoje = iso(new Date()); const n = new Date();
    let livres = 0;
    profissionais.forEach(p => {
      const fim = parseInt(p.horario_fim)||18, ini=parseInt(p.horario_inicio)||8;
      const ocup = agendamentos.filter(a=>a.data===hoje && a.profissional_id===p.id && a.status!=='Cancelado').length;
      livres += Math.max(0, (fim-ini) - ocup);
    });
    set('ag-hoje', agendamentos.filter(a=>a.data===hoje).length);
    const ini = new Date(); ini.setDate(n.getDate()-6);
    set('ag-semana', agendamentos.filter(a=>a.data>=iso(ini)&&a.data<=hoje).length);
    set('ag-mes', agendamentos.filter(a=>{const d=new Date(a.data+'T00:00:00');return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();}).length);
    set('ag-livres', livres);
  }
  function set(id,v){ const e=document.getElementById(id); if(e) e.textContent=v; }

  function renderCalendario() {
    const c = document.getElementById('ag-calendario'); if (!c) return;
    const now = new Date(); const y = now.getFullYear(), m = now.getMonth();
    const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const first = new Date(y,m,1).getDay(), total = new Date(y,m+1,0).getDate();
    let html = `<div class="calendar-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><span class="calendar-month-title" style="font-weight:600;">${monthNames[m]} ${y}</span></div><div class="calendar-weekdays" style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;text-align:center;color:var(--text-muted);font-size:.8rem;"><div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div></div><div class="calendar-days-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:6px;">`;
    for (let i=0;i<first;i++) html += `<div></div>`;
    const hojeIso = iso(new Date());
    for (let d=1; d<=total; d++) {
      const di = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const count = agendamentos.filter(a=>a.data===di).length;
      const cls = di===hojeIso ? 'style="background:var(--primary);color:#fff;"' : 'style="background:var(--primary-light);"';
      html += `<div ${cls} style="border-radius:8px;padding:8px;text-align:center;font-size:.85rem;"><strong>${d}</strong>${count?`<br><small>${count} consulta(s)</small>`:''}</div>`;
    }
    html += `</div>`;
    c.innerHTML = html;
  }
});

