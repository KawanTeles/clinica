function openLightbox(url) {
  const img = document.getElementById('lightbox-img');
  const modal = document.getElementById('lightbox-modal');
  if (img && modal) {
    img.src = url;
    modal.style.display = 'flex';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Gallery items click
  const galleryItems = document.querySelectorAll('.gallery-item');
  galleryItems.forEach(item => {
    item.addEventListener('click', () => {
      const src = item.getAttribute('data-lightbox-src');
      if (src) openLightbox(src);
    });
  });

  // Close lightbox modal
  const lightboxModal = document.getElementById('lightbox-modal');
  if (lightboxModal) {
    lightboxModal.addEventListener('click', function() {
      this.style.display = 'none';
    });
  }
});