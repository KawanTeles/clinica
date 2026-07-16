// CRM / Leads — Clínica Zoe
document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('dashboard-app')) return;
  const session = await window.Auth.checkProtectedRoute();
  if (!session) return;

  const S = () => window.supabaseClient.from('leads');
  let leads = [];

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
    if(session.role==='professional')document.getElementById('admin-sidebar-nav')?.classList.add('hide-admin-only');
  }

  function setupModal() {
    document.getElementById('btn-add-lead')?.addEventListener('click',()=>{document.getElementById('form-lead').reset();document.getElementById('lead-id').value='';openModal('modal-lead');});
    document.querySelectorAll('.modal .close-modal-icon').forEach(b=>b.addEventListener('click',()=>b.closest('.modal').style.display='none'));
    window.addEventListener('click',e=>{if(e.target.classList.contains('modal'))e.target.style.display='none';});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal').forEach(m=>m.style.display='none');});
    document.getElementById('form-lead')?.addEventListener('submit',async e=>{
      e.preventDefault();
      const id=document.getElementById('lead-id').value;
      const payload={nome:document.getElementById('lead-nome').value.trim(),telefone:document.getElementById('lead-tel').value.trim(),email:document.getElementById('lead-email').value.trim(),origem:document.getElementById('lead-origem').value.trim()||'site',status:document.getElementById('lead-status').value,followup:document.getElementById('lead-follow').value||null,observacoes:document.getElementById('lead-obs').value};
      try{
        if(id){await S().update(payload).eq('id',id);window.ZoeAudit.log('editou','lead',id,payload.nome);}
        else{const{data}=await S().insert(payload);window.ZoeAudit.log('criou','lead',Array.isArray(data)?data[0]?.id:null,payload.nome);}
        document.getElementById('modal-lead').style.display='none';
        window.Notifications.show('CRM','Lead salvo.','success');
        await load();
      }catch(err){window.Notifications.show('Erro',err.message,'error');}
    });
  }

  function setupFilters(){document.getElementById('crm-filtro')?.addEventListener('change',render);document.getElementById('crm-search')?.addEventListener('input',render);document.getElementById('btn-clear-crm')?.addEventListener('click',()=>{document.getElementById('crm-filtro').value='';document.getElementById('crm-search').value='';render();});}

  async function load(){const{data:l}=await S().select('*');leads=l||[];calc();render();}

  function calc(){
    const hoje=new Date().toISOString().split('T')[0];
    set('crm-novos',leads.filter(x=>x.status==='novo').length);
    set('crm-recorrentes',leads.filter(x=>x.status==='recorrente').length);
    set('crm-inativos',leads.filter(x=>x.status==='inativo').length);
    set('crm-follow',leads.filter(x=>x.followup&&x.followup<=hoje&&x.status!=='inativo').length);
  }
  function set(id,v){const e=document.getElementById(id);if(e)e.textContent=v;}
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

  function render(){
    const st=document.getElementById('crm-filtro')?.value||'';
    const termo=(document.getElementById('crm-search')?.value||'').toLowerCase();
    const lista=leads.filter(x=>(!st||x.status===st)&&(!termo||x.nome.toLowerCase().includes(termo)||(x.email||'').toLowerCase().includes(termo))).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    const b=document.getElementById('crm-body');if(!b)return;
    if(!lista.length){b.innerHTML=`<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:30px;">Nenhum lead.</td></tr>`;return;}
    const stMap={novo:'badge-pending',recorrente:'badge-confirmed',inativo:'badge-canceled','em_contato':'badge-pending'};
    b.innerHTML=lista.map(x=>`<tr data-id="${esc(x.id)}">
      <td><strong>${esc(x.nome)}</strong></td>
      <td>${esc(x.telefone)||esc(x.email)||'-'}</td>
      <td>${esc(x.origem)||'-'}</td>
      <td><span class="status-badge ${stMap[x.status]||'badge-pending'}">${esc(x.status)}</span></td>
      <td>${x.followup?new Date(x.followup+'T00:00:00').toLocaleDateString('pt-BR'):'-'}</td>
      <td><div class="row-actions">
        <button class="action-btn text-warning" onclick="CRM.edit('${esc(x.id)}')"><i class="fas fa-edit"></i></button>
        <button class="action-btn text-primary" title="WhatsApp" onclick="CRM.wpp('${esc(x.id)}')"><i class="fab fa-whatsapp"></i></button>
        <button class="action-btn text-danger" onclick="CRM.del('${esc(x.id)}')"><i class="far fa-trash-alt"></i></button>
      </div></td></tr>`).join('');
  }

  window.CRM={
    edit(id){const x=leads.find(l=>l.id===id);if(!x)return;document.getElementById('lead-id').value=x.id;document.getElementById('lead-nome').value=x.nome;document.getElementById('lead-tel').value=x.telefone||'';document.getElementById('lead-email').value=x.email||'';document.getElementById('lead-origem').value=x.origem||'';document.getElementById('lead-status').value=x.status;document.getElementById('lead-follow').value=x.followup||'';document.getElementById('lead-obs').value=x.observacoes||'';openModal('modal-lead');},
    async del(id){if(!confirm('Excluir lead?'))return;await S().delete().eq('id',id);window.ZoeAudit.log('excluiu','lead',id,'');window.Notifications.show('Excluído','Removido.','success');await load();},
    wpp(id){const x=leads.find(l=>l.id===id);if(!x||!x.telefone)return;const tel=x.telefone.replace(/\D/g,'');window.open(`https://api.whatsapp.com/send?phone=55${tel}&text=${encodeURIComponent('Olá '+x.nome+', somos da Clínica Zoe!')}`);}
  };

  function openModal(id){const m=document.getElementById(id);if(m)m.style.display='block';}
});
