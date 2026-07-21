import { AuthRepository } from '../../repositories/auth.repository.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // Smooth scrolling function exposed to window for inline onclicks
    window.scrollToSection = function(sectionId) {
        const el = document.getElementById(sectionId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Highlight block momentarily
            el.style.backgroundColor = 'rgba(52, 152, 219, 0.1)';
            setTimeout(() => {
                el.style.backgroundColor = 'transparent';
                el.style.transition = 'background-color 0.5s ease';
            }, 1000);
        }
    };

    // Link Sidebar Clicks
    document.querySelectorAll('.help-topic-list a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').replace('#', '');
            window.scrollToSection(targetId);
        });
    });

    // Search functionality
    const searchInput = document.getElementById('help-search-input');
    const sections = document.querySelectorAll('.help-section');
    const faqs = document.querySelectorAll('.faq-item');

    searchInput.addEventListener('keyup', (e) => {
        const term = e.target.value.toLowerCase();
        
        // Search in sections
        sections.forEach(section => {
            const text = section.innerText.toLowerCase();
            // If empty search or match found, show it. However, if it's hidden by CSS due to role, we shouldn't force display block blindly.
            // Better to use opacity or just display block IF it's not an admin-only hidden by body role.
            // A safe way: just remove/add a 'hidden-search' class
            if (text.includes(term) || term === '') {
                section.style.display = ''; 
                // Restore dividers immediately following this section if any
                const nextEl = section.nextElementSibling;
                if(nextEl && nextEl.classList.contains('help-divider')) {
                    nextEl.style.display = '';
                }
            } else {
                section.style.display = 'none';
                const nextEl = section.nextElementSibling;
                if(nextEl && nextEl.classList.contains('help-divider')) {
                    nextEl.style.display = 'none';
                }
            }
        });

        // Search in FAQs
        faqs.forEach(faq => {
            const text = faq.innerText.toLowerCase();
            if (text.includes(term) || term === '') {
                faq.style.display = 'block';
            } else {
                faq.style.display = 'none';
            }
        });
    });

});
