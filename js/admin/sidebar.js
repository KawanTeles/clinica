// Sidebar toggle logic for mobile
document.addEventListener('DOMContentLoaded', () => {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('admin-sidebar');
    let overlay = document.querySelector('.sidebar-overlay');

    // Create overlay if it doesn't exist
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    const toggleSidebar = () => {
        const isOpen = sidebar.classList.toggle('sidebar-open');
        if (isOpen) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    };

    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', toggleSidebar);
    }

    // Close sidebar when clicking outside on mobile
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('sidebar-open');
        overlay.classList.remove('active');
    });

    // Close sidebar on window resize if crossing breakpoint
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            sidebar.classList.remove('sidebar-open');
            overlay.classList.remove('active');
        }
    });
});
