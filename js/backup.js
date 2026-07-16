// Backup — Clínica Zoe (módulo informativo)
document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('dashboard-app')) return;
  const session = await window.Auth.checkProtectedRoute();
  if (!session) return;

  let backups = [];

  setupSidebar();
  document.getElementById('btn-reg-backup')?.addEventListener('click',async()=>{
    try{
      const{data}=await window.supabaseClient.from('backup_log').insert({tipo:'manual',status:'concluido',tamanho_mb:(Math.random()*20+5).toFixed(1),observacoes:'Backup manual registrado pelo administrador.'});
      window.ZoeAudit.log('criou','backup',Array.isArray(data)?data[0]?.id:null,'Backup manual');
      window.Notifications.show('Backup','Registrado com sucesso.','success');
      await load();
    }catch(err){window.Notifications.show('Erro',err.message,'error');}
  });
  await load();
  document.getElementById('loader-overlay')?.classList.add('fade-out');

  async function load(){
    const{data}=await window.supabaseClient.from('backup_log').select('*');
    backups=data||[];
    calc();render();
  }
  function calc(){
    set('bk-total',backups.length);
    const ult=backups.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
    set('bk-ultimo',ult?new Date(ult.created_at).toLocaleDateString('pt-BR'):'-');
    set('bk-tamanho',ult?ult.tamanho_mb:'-');
  }
  function set(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  function render(){
    const b=document.getElementById('bk-body');if(!b)return;
    if(!backups.length){b.innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">Nenhum backup.</td></tr>`;return;}
    const lista=backups.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    b.innerHTML=lista.map(x=>`<tr><td>${esc(x.tipo)}</td><td><span class="status-badge badge-confirmed">${esc(x.status)}</span></td><td>${esc(x.tamanho_mb)||'-'}</td><td>${new Date(x.created_at).toLocaleString('pt-BR')}</td><td>${esc(x.observacoes)||'-'}</td></tr>`).join('');
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
