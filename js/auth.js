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
      
      let role = 'patient';
      let professional_id = null;

      if (window.CONFIG.DEMO_MODE) {
        // No modo demonstração, o mock já retorna o papel e o id do profissional no objeto de sessão
        role = data.session.role || 'patient';
        professional_id = data.session.professional_id || null;
        
        if (role === 'professional' && !professional_id) {
          try {
            const { data: profs } = await window.supabaseClient
              .from('profissionais')
              .select('id')
              .eq('email', data.user?.email || email)
              .eq('ativo', true);
            if (profs && profs.length > 0) {
              professional_id = profs[0].id;
            }
          } catch (e) {
            console.error("Erro ao verificar papel do profissional no mock db:", e);
          }
        }
      } else {
        // No Supabase de produção, verificamos se o e-mail pertence a um administrador ou médico
        const userEmail = data.user?.email || email;
        const userId    = data.user?.id;
        const metadata  = data.user?.user_metadata || {};
        
        if (metadata.role === 'admin' || userEmail === 'admin@clinicazoe.com') {
          role = 'admin';
        } else {
          // Verifica pelo auth_user_id primeiro (mais seguro), depois por e-mail
          try {
            let query = window.supabaseClient
              .from('profissionais')
              .select('id, auth_user_id')
              .eq('ativo', true);

            if (userId) {
              // Busca pelo auth_user_id linkado ao cadastro
              const { data: byId } = await window.supabaseClient
                .from('profissionais')
                .select('id')
                .eq('auth_user_id', userId)
                .eq('ativo', true)
                .limit(1);
              if (byId && byId.length > 0) {
                role = 'professional';
                professional_id = byId[0].id;
              }
            }

            // Fallback: busca por e-mail
            if (role !== 'professional') {
              const { data: profs, error: profErr } = await window.supabaseClient
                .from('profissionais')
                .select('id')
                .eq('email', userEmail)
                .eq('ativo', true)
                .limit(1);

              if (!profErr && profs && profs.length > 0) {
                role = 'professional';
                professional_id = profs[0].id;
              }
            }
          } catch (e) {
            console.error("Erro ao verificar papel do profissional no banco:", e);
          }
        }
      }

      const unifiedSession = {
        email: data.user?.email || email,
        role: role,
        professional_id: professional_id,
        token: data.session.access_token || data.session.token,
        user: data.user
      };
      
      // Salva sessão localmente para controle rápido
      localStorage.setItem('zoe_current_session', JSON.stringify(unifiedSession));
      return { success: true, user: data.user };
    } catch (err) {
      console.error("[Auth Error]", err);
      let msg = err.message;
      if (msg === 'Email not confirmed' || msg === 'Email confirmation required' || (msg && msg.toLowerCase().includes('confirm'))) {
        msg = 'EmailNotConfirmed';
      }
      return { success: false, error: msg };
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
        window.location.href = 'login.html';
      }, 1000);
      
      return { success: true };
    } catch (err) {
      console.error("[Auth Logout Error]", err);
      return { success: false, error: err.message };
    }
  },

  // Retorna a sessão ativa unificada
  async checkSession() {
    try {
      const local = localStorage.getItem('zoe_current_session');
      if (!local) return null;

      const session = JSON.parse(local);

      if (!window.CONFIG.DEMO_MODE) {
        // Valida se a sessão no Supabase ainda está ativa e válida
        const { data, error } = await window.supabaseClient.auth.getSession();
        if (error || !data.session) {
          localStorage.removeItem('zoe_current_session');
          return null;
        }
      }

      return session;
    } catch (err) {
      console.error("[checkSession Error]", err);
      const local = localStorage.getItem('zoe_current_session');
      return local ? JSON.parse(local) : null;
    }
  },

  // Garante que apenas administradores ou médicos acessem suas respectivas páginas.
  // Reutiliza as constantes de Permissions (fonte única de verdade para rotas).
  async checkProtectedRoute() {
    const session = await this.checkSession();
    const currentPage = window.location.pathname;
    const isLoginPage = currentPage.includes('login.html');
    const group = (window.Permissions && window.Permissions.detectPageGroup)
      ? window.Permissions.detectPageGroup()
      : null;

    if (!session) {
      // Permissions.enforce() já redireciona páginas protegidas; reforço aqui para login.
      if (group === 'admin' || group === 'professional' || group === 'shared') {
        window.location.replace('login.html');
        return null;
      }
    } else {
      if (isLoginPage) {
        window.location.replace(
          session.role === 'professional' ? 'dashboard-profissional.html' : 'dashboard.html'
        );
      }
      // Redirecionamentos entre grupos são de responsabilidade de Permissions.enforce();
      // aqui apenas garantimos coerência caso o guard ainda não tenha rodado.
      else if (group === 'admin' && session.role === 'professional') {
        window.location.replace('dashboard-profissional.html');
      } else if (group === 'professional' && session.role === 'admin') {
        window.location.replace('dashboard.html');
      }
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
  },

  // Reenvia e-mail de confirmação
  async resendConfirmation(email) {
    try {
      if (window.CONFIG.DEMO_MODE) {
        console.log(`[Demo Mode] Simulando reenvio de confirmação para ${email}`);
        return true;
      }
      
      const { error } = await window.supabaseClient.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: window.location.origin + '/pages/login.html'
        }
      });
      
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("[Auth Resend Error]", err);
      return false;
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
      const errorBox = document.getElementById('login-error');
      const errorMsg = document.getElementById('login-error-msg');

      // Ocultar erro anterior
      if (errorBox) errorBox.style.display = 'none';

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Autenticando...';

      const result = await Auth.login(email, password);

      if (result.success) {
        if (window.Notifications) {
          window.Notifications.show('Login Autorizado', 'Redirecionando para o painel...', 'success');
        }
        submitBtn.innerHTML = '<i class="fas fa-check"></i> Acesso Autorizado!';
        setTimeout(() => {
          const session = JSON.parse(localStorage.getItem('zoe_current_session') || '{}');
          if (session.role === 'professional') {
            window.location.href = 'dashboard-profissional.html';
          } else {
            window.location.href = 'dashboard.html';
          }
        }, 1200);
      } else {
        // Mostra erro inline
        let mensagem = result.error || 'Credenciais inválidas.';
        let isHTML = false;
        
        if (mensagem === 'EmailNotConfirmed') {
          mensagem = 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada ou spam. <a href="#" id="resend-conf-link" style="color: var(--primary); text-decoration: underline; font-weight: 600; margin-left: 5px;">Reenviar link</a>';
          isHTML = true;
        } else if (mensagem === 'Invalid login credentials') {
          mensagem = 'E-mail ou senha incorretos.';
        } else if (mensagem.includes('rate limit') || mensagem.includes('Too many requests')) {
          mensagem = 'Muitas tentativas. Por favor, aguarde alguns minutos antes de tentar novamente.';
        }

        if (errorBox && errorMsg) {
          if (isHTML) {
            errorMsg.innerHTML = mensagem;
            
            // Adicionar evento para reenviar
            const resendLink = document.getElementById('resend-conf-link');
            if (resendLink) {
              resendLink.addEventListener('click', async (e) => {
                e.preventDefault();
                resendLink.style.pointerEvents = 'none';
                resendLink.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reenviando...';
                
                const emailVal = document.getElementById('email').value.trim();
                const success = await Auth.resendConfirmation(emailVal);
                
                if (success) {
                  errorMsg.innerHTML = '<span style="color: var(--primary);"><i class="fas fa-check"></i> E-mail de confirmação reenviado! Verifique sua caixa de entrada e spam.</span>';
                } else {
                  errorMsg.innerHTML = '<span style="color: #dc2626;"><i class="fas fa-times"></i> Não foi possível reenviar. Tente novamente mais tarde.</span>';
                }
              });
            }
          } else {
            errorMsg.textContent = mensagem;
          }
          errorBox.style.display = 'flex';
        }
        
        // Dispara evento global de erro
        window.dispatchEvent(new CustomEvent('auth_error', { detail: { message: isHTML ? 'Seu e-mail ainda não foi confirmado.' : mensagem } }));
        // Toast como fallback
        if (window.Notifications) {
          window.Notifications.show('Erro de Acesso', isHTML ? 'Seu e-mail ainda não foi confirmado.' : mensagem, 'error');
        }
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Vincular "Esqueci minha senha"
  const forgotBtn = document.getElementById('btn-forgot-password');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      if (!email) {
        if (window.Notifications) {
          window.Notifications.show('Informe seu e-mail', 'Digite seu e-mail corporativo no campo correspondente para solicitar a redefinição.', 'warning');
        } else {
          alert('Por favor, informe seu e-mail corporativo no campo correspondente.');
        }
        return;
      }
      
      try {
        if (window.CONFIG.DEMO_MODE) {
          if (window.Notifications) {
            window.Notifications.show('Demonstração', 'Simulação de redefinição de senha enviada para ' + email, 'success');
          } else {
            alert('Simulação de redefinição de senha enviada!');
          }
          return;
        }

        const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/pages/login.html'
        });
        if (error) throw error;
        
        if (window.Notifications) {
          window.Notifications.show('E-mail Enviado', 'Verifique sua caixa de entrada para redefinir a senha.', 'success');
        } else {
          alert('E-mail de recuperação enviado com sucesso!');
        }
      } catch (err) {
        console.error(err);
        if (window.Notifications) {
          window.Notifications.show('Falha ao enviar', err.message, 'error');
        } else {
          alert('Erro ao enviar e-mail: ' + err.message);
        }
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
