// Sistema de Notificações Toast e Integração WhatsApp

const Notifications = {
  // --- SISTEMA DE TOASTS (UI) ---
  show(title, message, type = 'success', duration = 4000) {
    // Garantir que a container de toast existe
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    // Criar elemento do toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Escolher ícone apropriado
    let iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-times-circle';
    if (type === 'warning') iconClass = 'fa-exclamation-triangle';
    if (type === 'info') iconClass = 'fa-info-circle';

    toast.innerHTML = `
      <i class="fas ${iconClass} toast-icon"></i>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <i class="fas fa-times toast-close"></i>
    `;

    container.appendChild(toast);

    // Animação de entrada
    setTimeout(() => {
      toast.classList.add('show');
    }, 50);

    // Configurar fechar manual
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      this._hideToast(toast);
    });

    // Auto-destruir após a duração
    const timeoutId = setTimeout(() => {
      this._hideToast(toast);
    }, duration);

    // Pausar auto-destruição no hover
    toast.addEventListener('mouseenter', () => clearTimeout(timeoutId));
    toast.addEventListener('mouseleave', () => {
      setTimeout(() => this._hideToast(toast), 2000);
    });
  },

  _hideToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 400); // tempo correspondente à transição CSS
  },

  
};

window.Notifications = Notifications;
