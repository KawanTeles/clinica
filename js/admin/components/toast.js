export class Toast {
  static init() {
    if (!document.getElementById('toast-container')) {
      const container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = 'position:fixed; top:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:10px;';
      document.body.appendChild(container);
    }
  }

  static show(message, type = 'success') {
    this.init();
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    const bgColors = {
      success: '#2ecc71',
      error: '#e74c3c',
      warning: '#f1c40f',
      info: '#3498db'
    };
    
    toast.style.cssText = `
      background: ${bgColors[type] || bgColors.info};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 250px;
    `;

    const iconMap = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };
    
    toast.innerHTML = `<i class="fas ${iconMap[type]}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Remove
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
  
  static success(msg) { this.show(msg, 'success'); }
  static error(msg) { this.show(msg, 'error'); }
  static warning(msg) { this.show(msg, 'warning'); }
  static info(msg) { this.show(msg, 'info'); }

  static confirm(message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(3px);';
    
    const dialog = document.createElement('div');
    dialog.style.cssText = 'background:var(--admin-bg, #fff); padding:24px; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.2); max-width:400px; width:90%; border:1px solid var(--admin-border, #ddd); text-align:left; color: #333;';
    
    dialog.innerHTML = `
      <h3 style="margin-top:0; color:var(--admin-text-main, #333); font-size:18px; font-family:'Inter', sans-serif;">Confirmação</h3>
      <p style="color:var(--admin-text-muted, #666); margin-bottom:20px; line-height:1.5; font-family:'Inter', sans-serif;">${message}</p>
      <div style="display:flex; justify-content:flex-end; gap:10px;">
        <button id="btn-confirm-cancel" class="admin-btn admin-btn-outline" style="padding:8px 16px; border:1px solid #ddd; background:transparent; border-radius:4px; cursor:pointer;">Cancelar</button>
        <button id="btn-confirm-ok" class="admin-btn admin-btn-danger" style="padding:8px 16px; border:none; background:#e74c3c; color:#fff; border-radius:4px; cursor:pointer;">Confirmar</button>
      </div>
    `;
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    document.getElementById('btn-confirm-cancel').addEventListener('click', () => overlay.remove());
    document.getElementById('btn-confirm-ok').addEventListener('click', () => {
      overlay.remove();
      onConfirm();
    });
  }
}
window.Toast = Toast;
