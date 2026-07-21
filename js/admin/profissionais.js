document.addEventListener('DOMContentLoaded', () => {
  const sb = window.supabaseClient;
  const tableBody = document.getElementById('prof-table-body');
  
  // Modals
  const modal = document.getElementById('modal-prof');
  const btnNovo = document.getElementById('btn-novo-prof');
  const btnClose = document.getElementById('close-modal-prof');
  const btnCancel = document.getElementById('btn-cancelar');
  const form = document.getElementById('form-prof');

  const openModal = () => { modal.classList.add('active'); };
  const closeModal = () => { modal.classList.remove('active'); form.reset(); };

  btnNovo.addEventListener('click', () => {
    document.getElementById('modal-title').textContent = 'Novo Profissional';
    document.getElementById('prof_id').value = '';
    document.getElementById('prof_email').disabled = false;
    document.getElementById('prof_senha').required = true;
    openModal();
  });

  btnClose.addEventListener('click', closeModal);
  btnCancel.addEventListener('click', closeModal);

  // Carregar Dados Iniciais
  const loadProfessionals = async () => {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando dados...</td></tr>';
    const { data, error } = await sb.from('professionals')
      .select('id, nome, especialidade, registro_profissional, valor_avista, ativo')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error(error);
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:red;">Erro ao buscar dados.</td></tr>';
      return;
    }

    if (!data || data.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhum profissional cadastrado.</td></tr>';
      return;
    }

    tableBody.innerHTML = '';
    data.forEach(prof => {
      const statusBadge = prof.ativo 
        ? '<span class="badge badge-success">Ativo</span>' 
        : '<span class="badge badge-danger">Inativo</span>';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="display:flex; align-items:center; gap: 12px;">
            <div class="tenant-logo" style="background:#3498db; width: 40px; height: 40px;">${prof.nome.charAt(0)}</div>
            <span style="font-weight:600; color:var(--admin-text-main);">${prof.nome}</span>
          </div>
        </td>
        <td>${prof.especialidade}</td>
        <td>${prof.registro_profissional || '-'}</td>
        <td>R$ ${prof.valor_avista.toFixed(2)}</td>
        <td>${statusBadge}</td>
        <td>
          <button class="admin-btn admin-btn-outline btn-edit" data-id="${prof.id}" style="padding: 6px 10px;"><i class="fas fa-edit"></i></button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    // Anexar eventos aos botões de edição
    document.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', (e) => editProfessional(e.currentTarget.getAttribute('data-id')));
    });
  };

  const editProfessional = async (id) => {
    const { data, error } = await sb.from('professionals')
      .select('id, nome, especialidade, registro_profissional, whatsapp, valor_avista, ativo, user_profiles(email)')
      .eq('id', id).single();
    if (error || !data) return window.Toast.error('Erro ao carregar dados do profissional.');

    document.getElementById('modal-title').textContent = 'Editar Profissional';
    document.getElementById('prof_id').value = data.id;
    document.getElementById('prof_nome').value = data.nome;
    document.getElementById('prof_especialidade').value = data.especialidade;
    document.getElementById('prof_registro').value = data.registro_profissional;
    document.getElementById('prof_whatsapp').value = data.whatsapp;
    document.getElementById('prof_avista').value = data.valor_avista;
    document.getElementById('prof_ativo').checked = data.ativo;
    
    // Email não pode ser alterado por aqui (é Auth), senha vira opcional
    document.getElementById('prof_email').value = data.user_profiles.email;
    document.getElementById('prof_email').disabled = true;
    document.getElementById('prof_senha').required = false;

    openModal();
  };

  // Salvar ou Criar Profissional (Chamando a Edge Function Mock)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSalvar = document.getElementById('btn-salvar');
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';

    const id = document.getElementById('prof_id').value;
    const nome = document.getElementById('prof_nome').value;
    const email = document.getElementById('prof_email').value;
    const senha = document.getElementById('prof_senha').value;
    const especialidade = document.getElementById('prof_especialidade').value;
    const registro = document.getElementById('prof_registro').value;
    const whatsapp = document.getElementById('prof_whatsapp').value;
    const valorAvista = document.getElementById('prof_avista').value;
    const ativo = document.getElementById('prof_ativo').checked;

    try {
      if (id) {
        // UPDATE lógico
        const { error: updateError } = await sb.from('professionals').update({
          nome, especialidade, registro_profissional: registro,
          whatsapp, valor_avista: valorAvista, ativo
        }).eq('id', id);

        if (updateError) throw updateError;
        
        await sb.from('security_logs').insert({
          user_id: (await sb.auth.getUser()).data.user.id,
          acao: ativo ? 'UPDATE_PROFESSIONAL' : 'DISABLE_PROFESSIONAL',
          descricao: `Profissional ${nome} editado.`
        });
        
        window.Toast.success('Profissional atualizado com sucesso!');
      } else {
        // CREATE via Edge Function
        // Chamada nativa para a Edge Function do Supabase
        const { data: resData, error: invokeError } = await sb.functions.invoke('create-professional', {
          body: {
            email, password: senha, nome, especialidade, 
            registro, whatsapp, valorAvista, valorCartao: valorAvista // Mock
          }
        });

        if (invokeError) throw new Error(invokeError.message || 'Erro na criação');
        
        window.Toast.success('Profissional criado com sucesso e e-mail vinculado!');
      }

      closeModal();
      loadProfessionals();
    } catch (err) {
      window.Toast.error(err.message || 'Erro ao processar requisição.');
    } finally {
      btnSalvar.disabled = false;
      btnSalvar.innerHTML = '<i class="fas fa-save"></i> Salvar Profissional';
    }
  });

  // Init
  loadProfessionals();
});
