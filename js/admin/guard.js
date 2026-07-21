import { AuthRepository } from '../../repositories/auth.repository.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Obter sessão atual
  const { data: { session }, error: sessionError } = await AuthRepository.getSession();

  const currentPath = window.location.pathname;
  const isLoginPage = currentPath.includes('login.html');

  if (!session) {
    if (!isLoginPage) {
      window.location.href = 'login.html';
    }
    return;
  }

  // Se já estiver logado e na tela de login, redirecionar para o painel principal
  if (isLoginPage) {
    window.location.href = 'dashboard.html';
    return;
  }

  // Validação de Role e Redirecionamento RBAC
  try {
    const { data: profile, error: profileError } = await AuthRepository.getPerfilUsuario(session.user.id);

    if (profileError || !profile) {
      console.error('Erro ao buscar perfil do usuário:', profileError);
      alert('Seu perfil não foi encontrado. Contate o administrador.');
      await AuthRepository.signOut();
      window.location.href = 'login.html';
      return;
    }

    // Bloqueio de usuários inativos
    if (!profile.ativo) {
      alert('Sua conta está inativa. Acesso bloqueado.');
      await AuthRepository.signOut();
      window.location.href = 'login.html';
      return;
    }

    const roleName = profile.roles.nome;

    // Atualizar UI com dados do usuário (se os elementos existirem na tela)
    const userNameEl = document.querySelector('.user-name');
    const userRoleEl = document.querySelector('.user-role');
    if (userNameEl) userNameEl.textContent = profile.nome;
    if (userRoleEl) userRoleEl.textContent = roleName;

    const filename = currentPath.split('/').pop() || 'dashboard.html';

    // Injetar Role no body para manipulação de CSS (RBAC na UI)
    document.body.setAttribute('data-role', roleName.toLowerCase());
    
    // Injetar CSS dinâmico para RBAC
    const style = document.createElement('style');
    style.innerHTML = `
      body[data-role="recepcionista"] .admin-only { display: none !important; }
      body[data-role="recepcionista"] .admin-nav-item[href="usuarios.html"],
      body[data-role="recepcionista"] .admin-nav-item[href="financeiro.html"],
      body[data-role="recepcionista"] .admin-nav-item[href="profissionais.html"],
      body[data-role="recepcionista"] .admin-nav-item[href="configuracoes.html"],
      body[data-role="recepcionista"] .admin-nav-item[href="dashboard.html"] { display: none !important; }
      
      body[data-role="profissional"] .admin-only,
      body[data-role="profissional"] .reception-only { display: none !important; }
      body[data-role="profissional"] .admin-nav-item[href="usuarios.html"],
      body[data-role="profissional"] .admin-nav-item[href="financeiro.html"],
      body[data-role="profissional"] .admin-nav-item[href="profissionais.html"],
      body[data-role="profissional"] .admin-nav-item[href="configuracoes.html"],
      body[data-role="profissional"] .admin-nav-item[href="dashboard.html"] { display: none !important; }
    `;
    document.head.appendChild(style);

    if (roleName === 'ADMIN') {
      // Admin pode acessar tudo
      return;
    } 
    else if (roleName === 'RECEPCIONISTA') {
      // Recepcionista só acessa agenda e pacientes relacionados (simulado para este escopo restrito)
      const allowedPages = ['agenda.html', 'pacientes.html'];
      if (!allowedPages.includes(filename)) {
        window.location.href = 'agenda.html';
      }
    } 
    else if (roleName === 'PROFISSIONAL') {
      // Profissional acessa apenas sua agenda
      // Obs: Na vida real, a agenda e os pacientes vão filtrar no backend pelo uid()
      const allowedPages = ['agenda.html', 'pacientes.html'];
      if (!allowedPages.includes(filename)) {
        window.location.href = 'agenda.html'; // Idealmente, 'minha-agenda.html' mas usando 'agenda.html' provisoriamente
      }
    }
    else {
      // Outros perfis sem acesso ao painel admin
      alert('Acesso negado. Perfil não autorizado.');
      await AuthRepository.signOut();
      window.location.href = 'login.html';
    }

  } catch (err) {
    console.error('Erro de validação Guard:', err);
  }
});
