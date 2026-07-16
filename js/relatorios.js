// Relatórios — Clínica Zoe (PDF / Excel / CSV / Impressão)
document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('dashboard-app')) return;
  const session = await window.Auth.checkProtectedRoute();
  if (!session) return;

  let agendamentos=[], pacientes=[], profissionais=[], espec=[], financeiro=[];

  setupSidebar();
  await load();

  async function load(){
    const{data:ag}=await window.supabaseClient.from('agendamentos').select('*');agendamentos=ag||[];
    const{data:pac}=await window.supabaseClient.from('pacientes').select('*');pacientes=pac||[];
    const{data:prof}=await window.supabaseClient.from('profissionais').select('*');profissionais=prof||[];
    const{data:sp}=await window.supabaseClient.from('especialidades').select('*');espec=sp||[];
    const{data:fz}=await window.supabaseClient.from('financeiro').select('*');financeiro=fz||[];
    document.getElementById('rel-prof').innerHTML='<option value="">Profissional</option>'+profissionais.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('');
    document.getElementById('rel-spec').innerHTML='<option value="">Especialidade</option>'+espec.map(s=>`<option value="${s.id}">${esc(s.nome)}</option>`).join('');
    document.getElementById('rel-pac').innerHTML='<option value="">Paciente</option>'+pacientes.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('');
    document.getElementById('loader-overlay')?.classList.add('fade-out');
    render();
    ['rel-prof','rel-spec','rel-pac','rel-ini','rel-fim'].forEach(id=>document.getElementById(id).addEventListener('change',render));
    document.getElementById('rel-pdf').addEventListener('click',()=>exportar('pdf'));
    document.getElementById('rel-excel').addEventListener('click',()=>exportar('excel'));
    document.getElementById('rel-csv').addEventListener('click',()=>exportar('csv'));
    document.getElementById('rel-print').addEventListener('click',()=>window.print());
  }

  function pacNome(id){const p=pacientes.find(x=>x.id===id);return p?p.nome:'Desconhecido';}
  function profNome(id){const p=profissionais.find(x=>x.id===id);return p?p.nome:'Geral';}
  function specId(profId){const p=profissionais.find(x=>x.id===profId);return p?p.especialidade_id:null;}
  function valor(ap){const f=financeiro.find(x=>x.agendamento_id===ap.id);return f?f.valor:0;}
  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

  function filtrados(){
    const fp=document.getElementById('rel-prof').value, fs=document.getElementById('rel-spec').value, fpc=document.getElementById('rel-pac').value;
    const ini=document.getElementById('rel-ini').value, fim=document.getElementById('rel-fim').value;
    return agendamentos.filter(a=>{
      if(fp&&a.profissional_id!==fp)return false;
      if(fs&&specId(a.profissional_id)!==fs)return false;
      if(fpc&&a.paciente_id!==fpc)return false;
      if(ini&&a.data<ini)return false;
      if(fim&&a.data>fim)return false;
      return true;
    }).sort((a,b)=>a.data.localeCompare(b.data));
  }

  function render(){
    const lista=filtrados();
    const b=document.getElementById('rel-body');
    if(!b)return;
    if(!lista.length){b.innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:30px;">Sem dados para os filtros.</td></tr>`;return;}
    b.innerHTML=lista.map(a=>`<tr><td>${new Date(a.data+'T00:00:00').toLocaleDateString('pt-BR')}</td><td>${esc(pacNome(a.paciente_id))}</td><td>${esc(profNome(a.profissional_id))}</td><td>${esc(a.status)}</td><td>R$ ${(valor(a)||0).toFixed(2).replace('.',',')}</td></tr>`).join('');
  }

  function csvContent(lista){
    let csv='data;paciente;profissional;status;valor\n';
    lista.forEach(a=>{csv+=`${a.data};"${pacNome(a.paciente_id)}";"${profNome(a.profissional_id)}";${a.status};${(valor(a)||0).toFixed(2)}\n`;});
    return csv;
  }

  function exportar(tipo){
    const lista=filtrados();
    if(!lista.length){window.Notifications.show('Sem dados','Nada a exportar.','warning');return;}
    if(tipo==='csv'){
      const link=document.createElement('a');
      link.href='data:text/csv;charset=utf-8,'+encodeURI(csvContent(lista));
      link.download=`relatorio_clinica_zoe_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.Notifications.show('CSV','Arquivo gerado.','success');
    } else if(tipo==='excel'){
      const html='<table border="1"><tr><th>Data</th><th>Paciente</th><th>Profissional</th><th>Status</th><th>Valor</th></tr>'+lista.map(a=>`<tr><td>${a.data}</td><td>${pacNome(a.paciente_id)}</td><td>${profNome(a.profissional_id)}</td><td>${a.status}</td><td>${(valor(a)||0).toFixed(2)}</td></tr>`).join('')+'</table>';
      const link=document.createElement('a');
      link.href='data:application/vnd.ms-excel;charset=utf-8,'+encodeURI(html);
      link.download=`relatorio_clinica_zoe_${new Date().toISOString().split('T')[0]}.xls`;
      link.click();
      window.Notifications.show('Excel','Arquivo gerado.','success');
    } else if(tipo==='pdf'){
      window.print();
      window.Notifications.show('PDF','Use a janela de impressão para salvar em PDF.','info');
    }
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
