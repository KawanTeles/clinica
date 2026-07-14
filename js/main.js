// Lógica Global do Front-End da Clínica Zoe

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inicializar Tema e configurar Listener dos botões
  if (window.ThemeManager) {
    const themeButtons = document.querySelectorAll('#theme-toggle');
    
    const syncAllThemeIcons = (theme) => {
      themeButtons.forEach(btn => {
        const icon = btn.querySelector('i');
        if (icon) {
          icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
      });
    };

    // Sincroniza o estado inicial de todos os botões
    syncAllThemeIcons(window.ThemeManager.getCurrentTheme());

    themeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const newTheme = window.ThemeManager.toggleTheme();
        syncAllThemeIcons(newTheme);
        if (window.Notifications) {
          window.Notifications.show('Tema Atualizado', `Modo ${newTheme === 'dark' ? 'Escuro' : 'Claro'} ativado.`, 'info', 2000);
        }
      });
    });

    // Sincronização global para alterações automáticas do SO ou outros módulos
    window.addEventListener('themeChanged', (e) => {
      syncAllThemeIcons(e.detail.theme);
    });
  }


  // 2. Menu Mobile (Hamburguer)
  const menuBtn = document.getElementById('menu-btn');
  const navLinks = document.getElementById('nav-links');

  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menuBtn.classList.toggle('active');
      navLinks.classList.toggle('active');
    });

    // Fechar ao clicar no botão "X"
    const closeMenuBtn = document.getElementById('close-menu-btn');
    if (closeMenuBtn) {
      closeMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menuBtn.click(); // Reutiliza a função do menu hambúrguer para fechar
      });
    }

    // Fechar ao clicar em qualquer link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menuBtn.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });

    // Fechar ao clicar fora do menu
    document.addEventListener('click', (e) => {
      if (!navLinks.contains(e.target) && !menuBtn.contains(e.target)) {
        menuBtn.classList.remove('active');
        navLinks.classList.remove('active');
      }
    });

    // Fechar ao pressionar a tecla ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        menuBtn.classList.remove('active');
        navLinks.classList.remove('active');
      }
    });
  }

  // 3. Efeito do Header ao rolar a página
  const header = document.querySelector('.header-glass');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }

  // 4. Botão Voltar ao Topo
  const backToTopBtn = document.getElementById('back-to-top');
  if (backToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        backToTopBtn.classList.add('visible');
      } else {
        backToTopBtn.classList.remove('visible');
      }
    });

    backToTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // 5. Banner de Cookies (LGPD)
  const cookieBanner = document.getElementById('cookie-banner');
  const acceptCookiesBtn = document.getElementById('accept-cookies');

  if (cookieBanner && acceptCookiesBtn) {
    // Verifica se já aceitou anteriormente
    if (!localStorage.getItem('zoe-cookies-accepted')) {
      setTimeout(() => {
        cookieBanner.classList.add('visible');
      }, 1500);
    }

    acceptCookiesBtn.addEventListener('click', () => {
      localStorage.setItem('zoe-cookies-accepted', 'true');
      cookieBanner.classList.remove('visible');
      window.Notifications.show('Privacidade', 'Preferências de cookies salvas de acordo com a LGPD.', 'success', 2000);
    });
  }

  // 6. Formulário de Newsletter
  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = newsletterForm.querySelector('input[type="email"]');
      if (emailInput && emailInput.value) {
        // Envio simulado de newsletter
        window.Notifications.show('Inscrição Realizada', 'Obrigado por assinar nossa newsletter!', 'success');
        emailInput.value = '';
      }
    });
  }

  // 7. Formulário de Contato
  const contatoForm = document.getElementById('contato-form');
  if (contatoForm) {
    contatoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = contatoForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

      // Simula o tempo de envio de e-mail / lead
      setTimeout(() => {
        window.Notifications.show('Mensagem Enviada', 'Recebemos seu contato e responderemos em breve.', 'success');
        contatoForm.reset();
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }, 1500);
    });
  }

  // 8. FAQ Accordion (Perguntas Frequentes)
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        
        // Fechar todos outros FAQ
        faqItems.forEach(i => i.classList.remove('active'));
        
        if (!isActive) {
          item.classList.add('active');
        }
      });
    }
  });

  // 9. Inicializar AOS (Animate on Scroll)
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 800,
      easing: 'ease-in-out',
      once: true,
      mirror: false
    });
  }

  // 10. Remover Loader Elegantemente
  const loader = document.getElementById('loader-overlay');
  if (loader) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        loader.classList.add('fade-out');
        // Remover do DOM após a animação
        setTimeout(() => loader.remove(), 600);
      }, 500);
    });
    
    // Fallback caso a página demore a carregar
    setTimeout(() => {
      if (document.getElementById('loader-overlay')) {
        loader.classList.add('fade-out');
        setTimeout(() => loader.remove(), 600);
      }
    }, 3000);
  }
});
