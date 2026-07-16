// Mensagens — Clínica Zoe (centraliza WhatsApp / E-mail / Notificações)
document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('dashboard-app')) return;
  const session = await window.Auth.checkProtectedRoute();
  if (!session) return;

  const S = () => window.supabaseClient.from('mensagens');
  let msgs = [];

  setupSidebar(); setupModal(); setupFilters();
  await load();
  document.getElementById('loader-overlay')?.classList.add('fade-out');

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

  function setupModal() {
    document.getElementById('btn-add-msg')?.addEventListener('click',()=>{document.getElementById('form-msg').reset();openModal('modal-msg');});
    document.querySelectorAll('.modal .close-modal-icon').forEach(b=>b.addEventListener('click',()=>b.closest('.modal').style.display='none'));
    window.addEventListener('click',e=>{if(e.target.classList.contains('modal'))e.target.style.display='none';});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal').forEach(m=>m.style.display='none');});
    document.getElementById('form-msg')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const payload={canal:document.getElementById('msg-canal-form').value,assunto:document.getElementById('msg-assunto').value.trim(),conteudo:document.getElementById('msg-conteudo').value.trim(),direcao:'enviada',lida:true};
      try{const{data}=await S().insert(payload);window.ZoeAudit.log('enviou','mensagem',Array.isArray(data)?data[0]?.id:null,payload.canal);window.Notifications.show('Mensagem','Registrada.','success');document.getElementById('modal-msg').style.display='none';await load();}
      catch(err){window.Notifications.show('Erro',err.message,'error');}
    });
  }
  function setupFilters(){document.getElementById('msg-canal')?.addEventListener('change',render);document.getElementById('btn-clear-msg')?.addEventListener('click',()=>{document.getElementById('msg-canal').value='';render();});}
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  async function load(){const{data:m}=await S().select('*');msgs=m||[];render();}
  function render(){
    const canal=document.getElementById('msg-canal')?.value||'';
    const lista=msgs.filter(x=>!canal||x.canal===canal).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const b=document.getElementById('msg-body');if(!b)return;
    if(!lista.length){b.innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">Nenhuma mensagem.</td></tr>`;return;}
    const icon={whatsapp:'fab fa-whatsapp',email:'fas fa-envelope','notificacao':'fas fa-bell'};
    b.innerHTML=lista.map(x=>`<tr data-id="${esc(x.id)}"><td><i class="${icon[x.canal]||'fas fa-comment'}"></i> ${esc(x.canal)}</td><td>${esc(x.assunto)||'-'}</td><td>${esc(x.conteudo)}</td><td>${new Date(x.created_at).toLocaleString('pt-BR')}</td><td><div class="row-actions"><button class="action-btn text-danger" onclick="MSG.del('${esc(x.id)}')"><i class="far fa-trash-alt"></i></button></div></td></tr>`).join('');
  }
  window.MSG={async del(id){if(!confirm('Excluir mensagem?'))return;await S().delete().eq('id',id);window.Notifications.show('Excluído','Removida.','success');await load();}};
  function openModal(id){const m=document.getElementById(id);if(m)m.style.display='block';}
});
