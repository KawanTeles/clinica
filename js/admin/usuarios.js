document.addEventListener('DOMContentLoaded', async () => {
  const sb = window.supabaseClient;
  const tableBody = document.getElementById('users-table-body');
  const roleSelect = document.getElementById('usr_role');
  
  // Modals
  const modal = document.getElementById('modal-user');
  const modalPass = document.getElementById('modal-pass');
  const form = document.getElementById('form-user');

  const closeModals = () => {
    modal.classList.remove('active');
    modalPass.classList.remove('active');
    form.reset();
  };
  
  document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', closeModals));
  document.getElementById('btn-cancelar').addEventListener('click', closeModals);

  // Load Roles
  const { data: roles } = await sb.from('roles').select('*');
  roles.forEach(r => {
    if(r.nome !== 'CLIENTE') roleSelect.add(new Option(r.nome, r.id));
  });

  document.getElementById('btn-novo-user').addEventListener('click', () => {
    document.getElementById('modal-title').textContent = 'Novo Usuário';
    document.getElementById('usr_id').value = '';
    document.getElementById('usr_email').disabled = false;
    document.getElementById('pass_group').style.display = 'block';
    document.getElementById('usr_senha').required = true;
    modal.classList.add('active');
  });

  const loadUsers = async () => {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Carregando...</td></tr>';
    
    // Join with professionals to check links
    const { data, error } = await sb.from('user_profiles')
      .select('auth_user_id, nome, email, ativo, last_login_at, login_count, role_id, roles(nome), professionals(id)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:red;">Erro ao buscar usuários.</td></tr>';
      return;
    }

    tableBody.innerHTML = '';
    data.forEach(user => {
      const badgeClass = user.roles.nome === 'ADMIN' ? 'badge-danger' : (user.roles.nome === 'RECEPCIONISTA' ? 'badge-info' : 'badge-warning');
      const statusBadge = user.ativo ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-danger">Inativo</span>';
      
      const isProf = user.professionals && user.professionals.length > 0;
      const profIcon = isProf ? '<i class="fas fa-stethoscope" title="Vinculado a Profissional" style="color:var(--admin-accent); margin-left: 8px;"></i>' : '';
      
      const lastLogin = user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Nunca';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${user.nome}</strong> ${profIcon}</td>
        <td>${user.email}</td>
        <td><span class="badge ${badgeClass}">${user.roles.nome}</span></td>
        <td>${lastLogin} (Acessos: ${user.login_count || 0})</td>
        <td>${statusBadge}</td>
        <td>
          <button class="admin-btn admin-btn-outline btn-edit" data-uid="${user.auth_user_id}" style="padding: 6px; margin-right: 4px;"><i class="fas fa-edit"></i></button>
          <button class="admin-btn admin-btn-outline btn-pass" data-uid="${user.auth_user_id}" data-email="${user.email}" style="padding: 6px;"><i class="fas fa-key"></i></button>
        </td>
      `;
      tableBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', e => editUser(e.currentTarget.dataset.uid)));
    document.querySelectorAll('.btn-pass').forEach(btn => btn.addEventListener('click', e => openPassModal(e.currentTarget.dataset.uid, e.currentTarget.dataset.email)));
  };

  const editUser = async (uid) => {
    const { data } = await sb.from('user_profiles')
      .select('auth_user_id, nome, email, role_id, ativo')
      .eq('auth_user_id', uid).single();
    document.getElementById('modal-title').textContent = 'Editar Usuário';
    document.getElementById('usr_auth_id').value = data.auth_user_id;
    document.getElementById('usr_nome').value = data.nome;
    document.getElementById('usr_email').value = data.email;
    document.getElementById('usr_role').value = data.role_id;
    document.getElementById('usr_ativo').checked = data.ativo;
    
    document.getElementById('usr_email').disabled = true;
    document.getElementById('pass_group').style.display = 'none';
    document.getElementById('usr_senha').required = false;

    modal.classList.add('active');
  };

  const openPassModal = (uid, email) => {
    document.getElementById('pass_user_id').value = uid;
    document.getElementById('pass_user_email').value = email;
    modalPass.classList.add('active');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const uid = document.getElementById('usr_auth_id').value;
    const action = uid ? 'UPDATE' : 'CREATE';
    
    const payload = {
      action,
      userId: uid,
      nome: document.getElementById('usr_nome').value,
      email: document.getElementById('usr_email').value,
      password: document.getElementById('usr_senha').value,
      roleId: document.getElementById('usr_role').value,
      ativo: document.getElementById('usr_ativo').checked
    };

    const btn = document.getElementById('btn-salvar');
    btn.disabled = true;
    btn.innerHTML = 'Salvando...';

    try {
      const { data, error: invokeError } = await sb.functions.invoke('manage-user', {
        body: payload
      });
      if (invokeError) throw new Error(invokeError.message || 'Erro na requisição');

      closeModals();
      loadUsers();
      window.Toast.success('Operação realizada com sucesso!');
    } catch (err) {
      window.Toast.error(err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-save"></i> Salvar Usuário';
    }
  });

  document.getElementById('btn-send-link').addEventListener('click', async () => handlePass('SEND_LINK'));
  document.getElementById('btn-force-pass').addEventListener('click', async () => handlePass('FORCE_RESET'));

  const handlePass = async (action) => {
    try {
      const { data, error: invokeError } = await sb.functions.invoke('reset-password', {
        body: {
          action,
          userId: document.getElementById('pass_user_id').value,
          email: document.getElementById('pass_user_email').value,
          newPassword: document.getElementById('pass_new').value
        }
      });
      if (invokeError) throw new Error(invokeError.message || 'Erro na requisição');
      window.Toast.success('Senha operada com sucesso!');
      closeModals();
    } catch (err) {
      window.Toast.error(err.message);
    }
  };

  loadUsers();
});
