document.addEventListener('DOMContentLoaded', () => {
      const errorBox = document.getElementById('login-error');
      const errorMsg = document.getElementById('login-error-msg');
      const demoHint = document.getElementById('demo-hint');

      // Oculta dica de credenciais de demonstração se o Supabase estiver em produção
      if (demoHint && window.CONFIG && !window.CONFIG.DEMO_MODE) {
        demoHint.style.display = 'none';
      }

      // Listener global de erro do Auth para exibir o bloco de erro inline
      window.addEventListener('auth_error', (e) => {
        if (errorBox && errorMsg) {
          errorMsg.textContent = e.detail.message || 'Credenciais inválidas.';
          errorBox.style.display = 'flex';
        }
      });
    });