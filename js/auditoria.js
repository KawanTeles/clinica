// Auditoria / Log — Clínica Zoe
document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('dashboard-app')) return;
  const session = await window.Auth.checkProtectedRoute();
  if (!session) return;

  let logs = [];

  setupSidebar();
  document.getElementById('aud-filtro')?.addEventListener('change', render);
  document.getElementById('btn-clear-aud')?.addEventListener('click',()=>{document.getElementById('aud-filtro').value='';render();});
  await load();
  document.getElementById('loader-overlay')?.classList.add('fade-out');

  async function load(){
    const{data}=await window.supabaseClient.from('auditoria').select('*');
    logs=data||[];
    render();
  }

  function render(){
    const f=document.getElementById('aud-filtro')?.value||'';
    const lista=logs.filter(x=>!f||x.acao===f).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const b=document.getElementById('aud-body');if(!b)return;
    if(!lista.length){b.innerHTML=`<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px;">Nenhum registro.</td></tr>`;return;}
    const esc=v=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    b.innerHTML=lista.map(x=>`<tr>
      <td>${new Date(x.created_at).toLocaleString('pt-BR')}</td>
      <td>${esc(x.usuario_email)||'-'}</td>
      <td><span class="status-badge badge-pending">${esc(x.acao)}</span></td>
      <td>${esc(x.entidade)||'-'}</td>
      <td>${esc(x.detalhes)||'-'}</td>
      <td>${esc(x.ip)||'-'}</td></tr>`).join('');
  }

  function setupSidebar() {
    const h=document.getElementById('hamburger-btn'),sb=document.getElementById('admin-sidebar'),ov=document.getElementById('sidebar-overlay');
    const open=()=>{sb?.classList.add('sidebar-open');ov?.classList.add('active');document.body.style.overflow='hidden';};
    const close=()=>{sb?.classList.remove('sidebar-open');ov?.classList.remove('active');document.body.style.overflow='';};
    h?.addEventListener('click',()=>sb?.classList.contains('sidebar-open')?close():open());
    ov?.addEventListener('click',close);
    const u=JSON.parse(localStorage.getItem('zoe_current_session')||'{}');
    if(u.email){const n=u.email.split('@')[0].replace(/^\w/,c=>c.toUpperCase());document.getElementById('sidebar-user-name').textContent=n;document.getElementById('sidebar-avatar').textContent=n.charAt(0).toUpperCase();}
    document.getElementById('sidebar-user-role').textContent=u.role==='professional'?'Profissional':'Administrador';
  }
});
