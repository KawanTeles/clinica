// Configurações da Clínica — Clínica Zoe
document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('dashboard-app')) return;
  const session = await window.Auth.checkProtectedRoute();
  if (!session) return;

  setupSidebar();
  await load();

  async function load(){
    const{data}=await window.supabaseClient.from('clinic_config').select('*').limit(1);
    const c=data&&data[0];
    if(c){
      document.getElementById('cfg-nome').value=c.nome||'';
      document.getElementById('cfg-logo').value=c.logo_url||'';
      document.getElementById('cfg-tel').value=c.telefone||'';
      document.getElementById('cfg-wpp').value=c.whatsapp||'';
      document.getElementById('cfg-email').value=c.email||'';
      document.getElementById('cfg-horario').value=c.horario_funcionamento||'';
      document.getElementById('cfg-endereco').value=c.endereco||'';
      try{const rs=JSON.parse(c.redes_sociais||'{}');document.getElementById('cfg-instagram').value=rs.instagram||'';document.getElementById('cfg-facebook').value=rs.facebook||'';}catch(e){}
    }
    document.getElementById('loader-overlay')?.classList.add('fade-out');

    document.getElementById('btn-save-config')?.addEventListener('click',async()=>{
      const payload={
        nome:document.getElementById('cfg-nome').value.trim(),
        logo_url:document.getElementById('cfg-logo').value.trim(),
        telefone:document.getElementById('cfg-tel').value.trim(),
        whatsapp:document.getElementById('cfg-wpp').value.trim(),
        email:document.getElementById('cfg-email').value.trim(),
        horario_funcionamento:document.getElementById('cfg-horario').value.trim(),
        endereco:document.getElementById('cfg-endereco').value.trim(),
        redes_sociais:JSON.stringify({instagram:document.getElementById('cfg-instagram').value.trim(),facebook:document.getElementById('cfg-facebook').value.trim()}),
        updated_at:new Date().toISOString()
      };
      try{
        if(c){await window.supabaseClient.from('clinic_config').update(payload).eq('id',c.id);}
        else{await window.supabaseClient.from('clinic_config').insert(payload);}
        window.ZoeAudit.log('editou','clinic_config',c?c.id:null,'Configurações salvas');
        window.Notifications.show('Salvo','Configurações atualizadas.','success');
      }catch(err){window.Notifications.show('Erro',err.message,'error');}
    });
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
    if(session.role==='professional')document.getElementById('admin-sidebar-nav')?.classList.add('hide-admin-only');
  }
});
