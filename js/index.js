// Inicialização do Swiper.js
    document.addEventListener('DOMContentLoaded', () => {
      new Swiper('.reviews-slider', {
        slidesPerView: 1,
        spaceBetween: 24,
        pagination: {
          el: '.swiper-pagination',
          clickable: true,
        },
        breakpoints: {
          768: {
            slidesPerView: 2,
          },
          1024: {
            slidesPerView: 3,
          }
        }
      });

      // Animações GSAP no Hero
      gsap.from('.hero-content > *', {
        opacity: 0,
        y: 30,
        duration: 1,
        stagger: 0.2,
        ease: 'power3.out'
      });
      
      gsap.from('.hero-image-container', {
        opacity: 0,
        scale: 0.9,
        duration: 1.2,
        ease: 'power3.out'
      });
    });

    // Custom FAQ Toggle para o index.html
    document.querySelectorAll('.faq-question').forEach(button => {
      button.addEventListener('click', () => {
        const item = button.parentElement;
        const answer = item.querySelector('.faq-answer');
        const icon = button.querySelector('.faq-icon');
        const isOpen = item.classList.contains('active');

        // Fechar todos outros
        document.querySelectorAll('.faq-item').forEach(other => {
          other.classList.remove('active');
          other.querySelector('.faq-answer').style.display = 'none';
          const otherIcon = other.querySelector('.faq-icon');
          if (otherIcon) otherIcon.style.transform = 'rotate(0deg)';
        });

        if (!isOpen) {
          item.classList.add('active');
          answer.style.display = 'block';
          icon.style.transform = 'rotate(180deg)';
        } else {
          item.classList.remove('active');
          answer.style.display = 'none';
          icon.style.transform = 'rotate(0deg)';
        }
      });
    });