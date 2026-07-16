// Financeiro — Clínica Zoe (preparado p/ gateway, sem integração de pagamento)
document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('dashboard-app')) return;
  const session = await window.Auth.checkProtectedRoute();
  if (!session) return;

  const S = () => window.supabaseClient.from('financeiro');
  let fin = [], pacientes = [];

  setupSidebar();
  setupModal();
  setupFilters();
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
    if(session.role==='professional')document.getElementById('admin-sidebar-nav')?.classList.add('hide-admin-only');
  }

  function setupModal() {
    document.getElementById('btn-add-fin')?.addEventListener('click',()=>{document.getElementById('form-fin').reset();document.getElementById('fin-id').value='';openModal('modal-fin');});
    document.querySelectorAll('.modal .close-modal-icon').forEach(b=>b.addEventListener('click',()=>b.closest('.modal').style.display='none'));
    window.addEventListener('click',e=>{if(e.target.classList.contains('modal'))e.target.style.display='none';});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal').forEach(m=>m.style.display='none');});

    document.getElementById('form-fin')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const id=document.getElementById('fin-id').value;
      const payload={descricao:document.getElementById('fin-desc').value.trim(),valor:parseFloat(document.getElementById('fin-valor').value)||0,forma:document.getElementById('fin-forma').value,status:document.getElementById('fin-status').value};
      try{
        if(id){await S().update(payload).eq('id',id);window.ZoeAudit.log('editou','financeiro',id,payload.descricao);}
        else{const{data}=await S().insert(payload);window.ZoeAudit.log('criou','financeiro',Array.isArray(data)?data[0]?.id:null,payload.descricao);}
        document.getElementById('modal-fin').style.display='none';
        window.Notifications.show('Financeiro','Lançamento salvo.','success');
        await load();
      }catch(err){window.Notifications.show('Erro',err.message,'error');}
    });
  }

  function setupFilters(){
    document.getElementById('fin-filtro-status')?.addEventListener('change',render);
    document.getElementById('fin-filtro-forma')?.addEventListener('change',render);
    document.getElementById('btn-clear-fin')?.addEventListener('click',()=>{document.getElementById('fin-filtro-status').value='';document.getElementById('fin-filtro-forma').value='';render();});
  }

  async function load(){
    const{data:f}=await S().select('*');fin=f||[];
    const{data:p}=await window.supabaseClient.from('pacientes').select('*');pacientes=p||[];
    calc();render();
  }

  function calc(){
    const sum=(arr)=>arr.reduce((s,x)=>s+(parseFloat(x.valor)||0),0);
    set('fin-recebido',fmt(sum(fin.filter(x=>x.status==='pago'))));
    set('fin-pendente',fmt(sum(fin.filter(x=>x.status==='pendente'))));
    set('fin-pix',fmt(sum(fin.filter(x=>x.forma==='pix'&&x.status==='pago'))));
    set('fin-cartao',fmt(sum(fin.filter(x=>x.forma==='cartao'&&x.status==='pago'))));
  }
  function set(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
  function fmt(v){return 'R$ '+(v||0).toFixed(2).replace('.',',');}
  function pacNome(id){const p=pacientes.find(x=>x.id===id);return p?p.nome:'Geral';}
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

  function render(){
    const st=document.getElementById('fin-filtro-status')?.value||'';
    const fm=document.getElementById('fin-filtro-forma')?.value||'';
    const lista=fin.filter(x=>(!st||x.status===st)&&(!fm||x.forma===fm)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const b=document.getElementById('fin-body');
    if(!b)return;
    if(!lista.length){b.innerHTML=`<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px;">Nenhum lançamento.</td></tr>`;return;}
    const stMap={pago:'badge-confirmed',pendente:'badge-pending',cancelado:'badge-canceled'};
    b.innerHTML=lista.map(x=>`<tr data-id="${esc(x.id)}">
      <td>${esc(x.descricao)}</td><td>${esc(pacNome(x.paciente_id))}</td><td>${fmt(x.valor)}</td>
      <td>${esc(x.forma)}</td><td><span class="status-badge ${stMap[x.status]||'badge-pending'}">${esc(x.status)}</span></td>
      <td><div class="row-actions">
        <button class="action-btn text-warning" onclick="FIN.edit('${esc(x.id)}')"><i class="fas fa-edit"></i></button>
        <button class="action-btn text-danger" onclick="FIN.del('${esc(x.id)}')"><i class="far fa-trash-alt"></i></button>
      </div></td></tr>`).join('');
  }

  window.FIN={
    edit(id){const x=fin.find(f=>f.id===id);if(!x)return;document.getElementById('fin-id').value=x.id;document.getElementById('fin-desc').value=x.descricao;document.getElementById('fin-valor').value=x.valor;document.getElementById('fin-forma').value=x.forma;document.getElementById('fin-status').value=x.status;openModal('modal-fin');},
    async del(id){if(!confirm('Excluir lançamento?'))return;await S().delete().eq('id',id);window.ZoeAudit.log('excluiu','financeiro',id,'');window.Notifications.show('Excluído','Removido.','success');await load();}
  };

  function openModal(id){const m=document.getElementById(id);if(m)m.style.display='block';}
});
