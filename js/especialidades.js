// Filtro em tempo real de especialidades
    const searchInput = document.getElementById('search-specialty');
    const cards = document.querySelectorAll('.card-specialty-detailed');

    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase();
      cards.forEach(card => {
        const name = card.getAttribute('data-name').toLowerCase();
        if (name.includes(query)) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });