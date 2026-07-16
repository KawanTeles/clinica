// ══════════════════════════════════════════════════════════════════
//  Clínica Zoe — Sistema de Permissões e Guard de Rotas
//  Arquivo: js/permissions.js
//  Carregue ANTES de qualquer outro script nas páginas protegidas.
// ══════════════════════════════════════════════════════════════════

const Permissions = {
  // Páginas exclusivas do ADMINISTRADOR
  ADMIN_PAGES: [
    'dashboard.html',
    'gerenciar-profissionais.html',
    'financeiro.html',
    'auditoria.html',
    'backup.html',
    'configuracoes.html',
  ],

  // Páginas exclusivas do PROFISSIONAL
  PROFESSIONAL_PAGES: [
    'dashboard-profissional.html',
  ],

  // Páginas compartilhadas (ADMIN e PROFISSIONAL)
  SHARED_PAGES: [
    'pacientes.html',
    'agenda-inteligente.html',
    'crm.html',
    'relatorios.html',
    'mensagens.html',
  ],

  // Obtém a sessão do localStorage
  getSession() {
    try {
      const raw = localStorage.getItem('zoe_current_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  // Retorna o role da sessão atual
  getRole() {
    const s = this.getSession();
    return s ? (s.role || 'patient') : null;
  },

  // Retorna true se o usuário é administrador
  isAdmin() {
    return this.getRole() === 'admin';
  },

  // Retorna true se o usuário é profissional
  isProfessional() {
    return this.getRole() === 'professional';
  },

  // Detecta em qual "grupo de página" estamos
  detectPageGroup() {
    const path = window.location.pathname;
    for (const page of this.ADMIN_PAGES) {
      if (path.includes(page)) return 'admin';
    }
    for (const page of this.PROFESSIONAL_PAGES) {
      if (path.includes(page)) return 'professional';
    }
    for (const page of this.SHARED_PAGES) {
      if (path.includes(page)) return 'shared';
    }
    if (path.includes('login.html')) return 'login';
    return 'public';
  },

  // Guard principal — chame no início de cada página protegida
  enforce() {
    const group = this.detectPageGroup();
    const session = this.getSession();
    const role = session ? session.role : null;

    // Sem sessão em página protegida → login
    if (!session && (group === 'admin' || group === 'professional' || group === 'shared')) {
      window.location.replace('login.html');
      return false;
    }

    // Profissional tentando acessar área de admin → redireciona
    if (group === 'admin' && role === 'professional') {
      window.location.replace('dashboard-profissional.html');
      return false;
    }

    // Admin tentando acessar painel do profissional → redireciona
    if (group === 'professional' && role === 'admin') {
      window.location.replace('dashboard.html');
      return false;
    }

    // Já logado tentando acessar login → redireciona
    if (group === 'login' && session) {
      if (role === 'professional') {
        window.location.replace('dashboard-profissional.html');
      } else {
        window.location.replace('dashboard.html');
      }
      return false;
    }

    return true; // Acesso permitido
  },

  // Esconde elementos do DOM que o role atual não tem permissão
  applyUIRestrictions() {
    const role = this.getRole();

    // Esconder elementos marcados com data-role="admin"
    if (role !== 'admin') {
      document.querySelectorAll('[data-role="admin"]').forEach(el => {
        el.style.display = 'none';
      });
    }

    // Esconder elementos marcados com data-role="professional"
    if (role !== 'professional') {
      document.querySelectorAll('[data-role="professional"]').forEach(el => {
        el.style.display = 'none';
      });
    }
  }
};

window.Permissions = Permissions;

// Auto-executa o guard quando o script é carregado
Permissions.enforce();
