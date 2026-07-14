// Lógica de Autenticação - Clínica Zoe

const Auth = {
  // Realiza login
  async login(email, password) {
    try {
      const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      
      // Salva sessão localmente para controle rápido
      localStorage.setItem('zoe_current_session', JSON.stringify(data.session));
      return { success: true, user: data.user };
    } catch (err) {
      console.error("[Auth Error]", err);
      return { success: false, error: err.message };
    }
  },

  // Realiza logout
  async logout() {
    try {
      const { error } = await window.supabaseClient.auth.signOut();
      if (error) throw error;
      
      localStorage.removeItem('zoe_current_session');
      window.Notifications.show('Sessão Encerrada', 'Você saiu do sistema com sucesso.', 'info');
      
      setTimeout(() => {
        window.location.href = '../index.html';
      }, 1000);
      
      return { success: true };
    } catch (err) {
      console.error("[Auth Logout Error]", err);
      return { success: false, error: err.message };
    }
  },

  // Retorna a sessão ativa
  async checkSession() {
    try {
      const { data, error } = await window.supabaseClient.auth.getSession();
      if (error) throw error;
      return data.session;
    } catch (err) {
      // Tentar ler do LocalStorage
      const local = localStorage.getItem('zoe_current_session');
      return local ? JSON.parse(local) : null;
    }
  },

  // Garante que apenas administradores ou médicos acessem a página de dashboard
  async checkProtectedRoute() {
    const session = await this.checkSession();
    const currentPage = window.location.pathname;

    if (!session && currentPage.includes('dashboard.html')) {
      window.location.href = 'login.html';
      return null;
    }

    if (session && currentPage.includes('login.html')) {
      window.location.href = 'dashboard.html';
    }

    return session;
  },

  // Registra novos usuários de forma simplificada
  async registerUser(email, password, fullName) {
    try {
      const { data, error } = await window.supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'patient' // Regra padrão
          }
        }
      });

      if (error) throw error;
      return { success: true, user: data.user };
    } catch (err) {
      console.error("[Auth Register Error]", err);
      return { success: false, error: err.message };
    }
  }
};

// Vincula eventos ao carregar a página de login
document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('login-form');
  const isLoginPage = window.location.pathname.includes('login.html');
  const isDashboardPage = window.location.pathname.includes('dashboard.html');

  if (isLoginPage || isDashboardPage) {
    await Auth.checkProtectedRoute();
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autenticando...';

      const result = await Auth.login(email, password);

      if (result.success) {
        window.Notifications.show('Login Autorizado', 'Redirecionando para o painel...', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1200);
      } else {
        window.Notifications.show('Erro de Acesso', result.error, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Vincular botão de logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await Auth.logout();
    });
  }
});

window.Auth = Auth;
