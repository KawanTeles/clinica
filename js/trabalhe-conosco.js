document.getElementById('careers-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

      setTimeout(() => {
        window.Notifications.show('Candidatura Recebida', 'Seus dados foram salvos no nosso banco de talentos corporativo. Boa sorte!', 'success');
        e.target.reset();
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar Candidatura';
      }, 1500);
    });