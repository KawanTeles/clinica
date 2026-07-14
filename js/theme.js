// Gerenciamento de Tema (Claro / Escuro)
// Executado no head para evitar oscilação de tela (flicker)

(function () {
  const STORAGE_KEY = 'zoe-theme';

  // Função para aplicar o tema correto
  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark-theme');
      document.body?.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark-theme');
      document.body?.classList.remove('dark-theme');
    }
  }

  // Detecta a preferência
  function getPreferredTheme() {
    // 1. Verifica LocalStorage
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    if (savedTheme) {
      return savedTheme;
    }

    // 2. Verifica a preferência do Sistema Operacional
    const userPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return userPrefersDark ? 'dark' : 'light';
  }

  // Inicializar o tema
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  // Expõe funções úteis globalmente para uso no switch
  window.ThemeManager = {
    getCurrentTheme() {
      return document.documentElement.classList.contains('dark-theme') ? 'dark' : 'light';
    },

    toggleTheme() {
      const current = this.getCurrentTheme();
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      
      applyTheme(nextTheme);
      localStorage.setItem(STORAGE_KEY, nextTheme);
      
      // Dispara evento para caso outros scripts queiram se adaptar (ex: Chart.js)
      window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: nextTheme } }));
      
      return nextTheme;
    },

    initOnLoad() {
      // Sincroniza a classe do body (pode não estar carregada no head)
      applyTheme(this.getCurrentTheme());
      
      // Configurar escuta para alterações automáticas do sistema operacional
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem(STORAGE_KEY)) {
          const newOSTheme = e.matches ? 'dark' : 'light';
          applyTheme(newOSTheme);
          window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: newOSTheme } }));
        }
      });
    }
  };
})();
