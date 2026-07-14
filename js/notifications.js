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

  // --- INTEGRAÇÃO COM WHATSAPP ---
  async sendWhatsAppNotification(appointment, patient, professional) {
    const formattedDate = new Date(appointment.data + 'T00:00:00').toLocaleDateString('pt-BR');
    const messageText = `🩺 *Clínica Zoe - Novo Agendamento!* \n\n*Paciente:* ${patient.nome}\n*Telefone:* ${patient.telefone}\n*Data:* ${formattedDate}\n*Horário:* ${appointment.horario}\n*Observações:* ${appointment.observacoes || 'Nenhuma'}`;
    
    console.log(`%c[WhatsApp Integration] Enviando para o Profissional (${professional.nome}):`, "color: #25d366; font-weight: bold;");
    console.log(messageText);

    // Estrutura para API Real (Evolution API / Twilio / Z-API / WhatsApp Cloud API)
    if (!window.CONFIG.DEMO_MODE) {
      try {
        const payload = {
          number: professional.whatsapp,
          message: messageText,
          provider: window.CONFIG.WHATSAPP_PROVIDER
        };

        const response = await fetch(window.CONFIG.WHATSAPP_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.CONFIG.WHATSAPP_TOKEN}`
          },
          body: JSON.stringify(payload)
        });
        
        if (response.ok) {
          console.log("[WhatsApp Integration] Enviado com sucesso via API.");
        } else {
          console.warn("[WhatsApp Integration] Falha no disparo da API. Status:", response.status);
        }
      } catch (err) {
        console.error("[WhatsApp Integration] Erro ao integrar com API externa de WhatsApp", err);
      }
    } else {
      // Simulação em Modo Demo
      console.log(`[WhatsApp Simulado] Mensagem entregue ao médico ${professional.nome} (${professional.whatsapp})`);
    }

    // Retorna o link para redirecionamento do próprio paciente no frontend (Click-to-Chat)
    const patientMsg = `Olá! Meu agendamento na Clínica Zoe está confirmado.\nProfissional: ${professional.nome}\nData: ${formattedDate} às ${appointment.horario}.`;
    return `https://api.whatsapp.com/send?phone=${professional.whatsapp}&text=${encodeURIComponent(patientMsg)}`;
  }
};

window.Notifications = Notifications;
