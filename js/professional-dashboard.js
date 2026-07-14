// ══════════════════════════════════════════════════════════════════
//  Clínica Zoe — Painel Exclusivo do Profissional
//  Arquivo: js/professional-dashboard.js
// ══════════════════════════════════════════════════════════════════

const ProfessionalDashboard = {
  state: {
    session: null,
    professional: null,
    appointments: [],
    patients: [],
    filtered: [],
    myPatients: [],       // Pacientes com consulta vinculada a este profissional
    currentSection: 'inicio',
    searchQuery: '',
    filterStatus: '',
    filterDate: '',
    specialtyName: '',
  },

  async init() {
    // Guard síncrono já executado pelo permissions.js
    const session = JSON.parse(localStorage.getItem('zoe_current_session') || 'null');
    if (!session || session.role !== 'professional') {
      window.location.replace('login.html');
      return;
    }
    this.state.session = session;

    this.showSkeleton();

    // Carregar perfil do profissional
    await this.loadDoctorProfile();
    if (!this.state.professional) {
      this.showToast('Erro de Perfil', 'Seu cadastro de profissional não foi localizado no sistema.', 'error');
      return;
    }

    // Carregar dados em paralelo
    await Promise.all([
      this.loadPatients(),
      this.loadAppointments(),
    ]);

    this.deriveMyPatients();

    // Configurar interface
    this.setupNavigation();
    this.setupUI();
    this.setupFilters();
    this.setupModals();
    this.setupRealtime();

    this.applyFiltersAndRender();
    this.setupInlineSettingsForms();
    this.updateDashboard();
    this.renderMyPatients();
    this.renderProfile();
  },

  showSkeleton() {
    const tbody = document.getElementById('appointments-table-body');
    if (tbody) {
      tbody.innerHTML = Array(3).fill('').map(() => `
        <tr class="skeleton-row">
          <td><div class="skeleton" style="height:16px;width:120px;border-radius:4px;background:#e5e7eb;"></div></td>
          <td><div class="skeleton" style="height:16px;width:80px;border-radius:4px;background:#e5e7eb;"></div></td>
          <td><div class="skeleton" style="height:16px;width:60px;border-radius:4px;background:#e5e7eb;"></div></td>
          <td><div class="skeleton" style="height:16px;width:100px;border-radius:4px;background:#e5e7eb;"></div></td>
          <td><div class="skeleton" style="height:20px;width:80px;border-radius:999px;background:#e5e7eb;"></div></td>
          <td><div class="skeleton" style="height:16px;width:80px;border-radius:4px;background:#e5e7eb;"></div></td>
        </tr>
      `).join('');
    }
  },

  // ─── Carregar Perfil do Médico ────────────────────────────────
  async loadDoctorProfile() {
    try {
      const email  = this.state.session.email;
      const userId = this.state.session.user?.id || null;

      let data = null;

      // Tenta auth_user_id primeiro (se disponível)
      if (userId && !window.CONFIG.DEMO_MODE) {
        const { data: byId } = await window.supabaseClient
          .from('profissionais')
          .select('*')
          .eq('auth_user_id', userId)
          .limit(1);
        if (byId && byId.length > 0) data = byId;
      }

      // Fallback por e-mail
      if (!data || data.length === 0) {
        const { data: byEmail, error } = await window.supabaseClient
          .from('profissionais')
          .select('*')
          .eq('email', email)
          .limit(1);
        if (!error && byEmail && byEmail.length > 0) data = byEmail;
      }

      if (data && data.length > 0) {
        this.state.professional = data[0];
        if (this.state.session.professional_id !== data[0].id) {
          this.state.session.professional_id = data[0].id;
          localStorage.setItem('zoe_current_session', JSON.stringify(this.state.session));
        }

        // Buscar nome da especialidade
        this.state.specialtyName = await this.getSpecialtyName(data[0].especialidade_id);
      }
    } catch (err) {
      console.error('Erro ao carregar perfil do médico:', err);
    }
  },

  async loadPatients() {
    try {
      const { data, error } = await window.supabaseClient.from('pacientes').select('*');
      if (error) throw error;
      this.state.patients = data || [];
    } catch (err) {
      console.error('Erro ao carregar pacientes:', err);
    }
  },

  async loadAppointments() {
    try {
      const profId = this.state.professional.id;
      const { data, error } = await window.supabaseClient
        .from('agendamentos')
        .select('*')
        .eq('profissional_id', profId);
      if (error) throw error;
      this.state.appointments = data || [];
    } catch (err) {
      console.error('Erro ao carregar agendamentos:', err);
      this.showToast('Erro de Agenda', 'Não foi possível buscar suas consultas.', 'error');
    }
  },

  // Deriva a lista de pacientes únicos vinculados ao profissional
  deriveMyPatients() {
    const patientIds = [...new Set(this.state.appointments.map(a => a.paciente_id))];
    this.state.myPatients = this.state.patients.filter(p => patientIds.includes(p.id));
  },

  // ─── Navegação entre Seções ────────────────────────────────────
  setupNavigation() {
    document.querySelectorAll('[data-section]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.getAttribute('data-section');
        this.navigateTo(section);
      });
    });
  },

  navigateTo(section) {
    this.state.currentSection = section;

    // Atualizar nav ativa
    document.querySelectorAll('.admin-nav-item').forEach(item => {
      item.classList.remove('active');
    });
    const activeLink = document.querySelector(`[data-section="${section}"]`);
    if (activeLink) activeLink.closest('.admin-nav-item')?.classList.add('active');

    // Mostrar/ocultar seções
    document.querySelectorAll('.section-content').forEach(sec => {
      sec.style.display = sec.id === `section-${section}` ? '' : 'none';
    });

    // Atualizar título do header
    const titles = {
      inicio: { h1: 'Início', p: 'Visão geral do seu dia e próximas consultas.' },
      agenda: { h1: 'Minha Agenda', p: 'Gerencie suas consultas, confirme horários e acompanhe pacientes.' },
      pacientes: { h1: 'Meus Pacientes', p: 'Pacientes com consultas vinculadas ao seu perfil.' },
      perfil: { h1: 'Meu Perfil', p: 'Suas informações profissionais cadastradas na clínica.' },
      configuracoes: { h1: 'Configurações', p: 'Altere sua senha e foto de perfil.' },
    };
    const t = titles[section] || titles.inicio;
    const h1 = document.getElementById('page-title');
    const p  = document.getElementById('page-subtitle');
    if (h1) h1.textContent = t.h1;
    if (p)  p.textContent  = t.p;

    // Fechar sidebar mobile
    document.getElementById('admin-sidebar')?.classList.remove('sidebar-open');
    document.getElementById('sidebar-overlay')?.classList.remove('active');
    document.body.style.overflow = '';
  },

  // ─── Dashboard de Hoje ─────────────────────────────────────────
  updateDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const now   = new Date();

    const allApps = this.state.appointments;
    const todayApps = allApps.filter(a => a.data === today);
    const weekApps  = allApps.filter(a => {
      const d = new Date(a.data + 'T00:00:00');
      const dayOfWeek = now.getDay();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return d >= startOfWeek && d <= endOfWeek;
    });

    // Próximo atendimento
    const upcoming = allApps
      .filter(a => a.status !== 'Cancelado' && a.status !== 'Finalizado')
      .filter(a => new Date(`${a.data}T${a.horario}`) >= now)
      .sort((a, b) => new Date(`${a.data}T${a.horario}`) - new Date(`${b.data}T${b.horario}`))[0];

    // Stats cards
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('dash-today',   todayApps.length);
    set('dash-week',    weekApps.length);
    set('dash-total',   allApps.length);
    set('dash-next',    upcoming
      ? `${new Date(upcoming.data + 'T00:00:00').toLocaleDateString('pt-BR')} às ${upcoming.horario.substring(0,5)}`
      : '—');

    // Agenda do dia
    this.renderTodayAgenda(todayApps);
  },

  renderTodayAgenda(todayApps) {
    const container = document.getElementById('today-agenda-list');
    if (!container) return;

    if (todayApps.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:32px;color:var(--text-muted);">
          <i class="far fa-calendar-times" style="font-size:2rem;margin-bottom:12px;display:block;"></i>
          Nenhuma consulta para hoje.
        </div>`;
      return;
    }

    const sorted = [...todayApps].sort((a, b) => a.horario.localeCompare(b.horario));
    container.innerHTML = sorted.map(a => {
      const patient = this.getPatient(a.paciente_id) || { nome: 'Paciente', telefone: '—' };
      const badgeClasses = {
        'Agendado': 'badge-pending', 'Pendente': 'badge-pending',
        'Confirmado': 'badge-confirmed', 'Cancelado': 'badge-canceled', 'Finalizado': 'badge-finalized'
      };
      return `
        <div class="today-agenda-item">
          <div class="today-time">${a.horario.substring(0,5)}</div>
          <div class="today-info">
            <div class="today-patient-name">${this.escHtml(patient.nome)}</div>
            <div class="today-patient-contact"><i class="fas fa-phone" style="font-size:0.7rem;"></i> ${this.escHtml(patient.telefone)}</div>
          </div>
          <span class="status-badge ${badgeClasses[a.status] || 'badge-pending'}">${a.status}</span>
        </div>`;
    }).join('');
  },

  // ─── Perfil completo ───────────────────────────────────────────
  renderProfile() {
    const prof = this.state.professional;
    if (!prof) return;

    const diasMap = { seg:'Segunda', ter:'Terça', qua:'Quarta', qui:'Quinta', sex:'Sexta', sab:'Sábado', dom:'Domingo' };
    const dias = (prof.dias_atendimento || []).map(d => diasMap[d] || d).join(', ');

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
    const setHtml = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };

    // Foto no perfil
    const avatarEl = document.getElementById('profile-avatar-large');
    if (avatarEl) {
      avatarEl.innerHTML = prof.foto
        ? `<img src="${prof.foto}" alt="${this.escHtml(prof.nome)}">`
        : `<span>${(prof.nome || '?').charAt(0).toUpperCase()}</span>`;
    }

    set('profile-nome',           prof.nome);
    set('profile-especialidade',  this.state.specialtyName);
    set('profile-email',          prof.email);
    set('profile-telefone',       prof.telefone || prof.whatsapp);
    set('profile-whatsapp',       prof.whatsapp);
    set('profile-horario',        `${prof.horario_inicio ? prof.horario_inicio.substring(0,5) : '—'} às ${prof.horario_fim ? prof.horario_fim.substring(0,5) : '—'}`);
    set('profile-dias',           dias);
    set('profile-curriculo',      prof.mini_curriculo);
  },

  // ─── Meus Pacientes ────────────────────────────────────────────
  renderMyPatients() {
    const container = document.getElementById('patients-list-body');
    if (!container) return;

    const patients = this.state.myPatients;
    if (patients.length === 0) {
      container.innerHTML = `
        <tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);">
          <i class="fas fa-user-slash" style="font-size:2rem;margin-bottom:12px;display:block;"></i>
          Nenhum paciente vinculado ainda.
        </td></tr>`;
      return;
    }

    container.innerHTML = patients.map(p => {
      const appsForPatient = this.state.appointments.filter(a => a.paciente_id === p.id);
      const last = appsForPatient.sort((a, b) => b.data.localeCompare(a.data))[0];
      return `
        <tr>
          <td>
            <div style="font-weight:600;color:var(--text-main);">${this.escHtml(p.nome)}</div>
            ${p.cpf ? `<div style="font-size:0.75rem;color:var(--text-muted);">CPF: ${this.escHtml(p.cpf)}</div>` : ''}
          </td>
          <td>${this.escHtml(p.telefone || '—')}</td>
          <td>${this.escHtml(p.email || '—')}</td>
          <td>${appsForPatient.length}</td>
          <td>${last ? new Date(last.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
        </tr>`;
    }).join('');
  },

  // ─── Lógica de Filtros e Pesquisa (Agenda) ────────────────────
  setupFilters() {
    const searchInput  = document.getElementById('search-appointment');
    const statusSelect = document.getElementById('filter-appointment-status');
    const dateInput    = document.getElementById('filter-appointment-date');
    const btnClear     = document.getElementById('btn-clear-filters');

    if (searchInput) searchInput.addEventListener('input', () => {
      this.state.searchQuery = searchInput.value.trim().toLowerCase();
      this.applyFiltersAndRender();
    });
    if (statusSelect) statusSelect.addEventListener('change', () => {
      this.state.filterStatus = statusSelect.value;
      this.applyFiltersAndRender();
    });
    if (dateInput) dateInput.addEventListener('change', () => {
      this.state.filterDate = dateInput.value;
      this.applyFiltersAndRender();
    });
    if (btnClear) btnClear.addEventListener('click', () => {
      if (searchInput)  searchInput.value  = '';
      if (statusSelect) statusSelect.value = '';
      if (dateInput)    dateInput.value    = '';
      this.state.searchQuery  = '';
      this.state.filterStatus = '';
      this.state.filterDate   = '';
      this.applyFiltersAndRender();
    });
  },

  applyFiltersAndRender() {
    let data = [...this.state.appointments];

    if (this.state.searchQuery) {
      const q = this.state.searchQuery;
      data = data.filter(a => {
        const patient = this.getPatient(a.paciente_id);
        if (!patient) return false;
        return (patient.nome  || '').toLowerCase().includes(q) ||
               (patient.cpf   || '').includes(q) ||
               (patient.email || '').toLowerCase().includes(q);
      });
    }
    if (this.state.filterStatus) {
      data = data.filter(a => a.status === this.state.filterStatus);
    }
    if (this.state.filterDate) {
      data = data.filter(a => a.data === this.state.filterDate);
    }

    data.sort((a, b) => new Date(`${a.data}T${a.horario}`) - new Date(`${b.data}T${b.horario}`));
    this.state.filtered = data;
    this.updateStats();
    this.renderAppointments();
  },

  updateStats() {
    const all       = this.state.appointments;
    const confirmed = all.filter(a => a.status === 'Confirmado').length;
    const pending   = all.filter(a => a.status === 'Agendado' || a.status === 'Pendente').length;
    const canceled  = all.filter(a => a.status === 'Cancelado').length;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-total-appointments', all.length);
    set('stat-confirmed', confirmed);
    set('stat-pending',   pending);
    set('stat-canceled',  canceled);
  },

  renderAppointments() {
    const tbody      = document.getElementById('appointments-table-body');
    const emptyState = document.getElementById('appointment-empty-state');
    if (!tbody) return;

    if (this.state.filtered.length === 0) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';

    tbody.innerHTML = this.state.filtered.map(a => {
      const patient = this.getPatient(a.paciente_id) || { nome: 'Paciente Não Encontrado', telefone: '—', email: '—' };
      const formattedDate = new Date(a.data + 'T00:00:00').toLocaleDateString('pt-BR');

      const badgeClasses = {
        'Agendado': 'badge-pending', 'Pendente': 'badge-pending',
        'Confirmado': 'badge-confirmed', 'Cancelado': 'badge-canceled', 'Finalizado': 'badge-finalized'
      };
      const statusBadge = `<span class="status-badge ${badgeClasses[a.status] || 'badge-pending'}">${a.status}</span>`;

      let actionButtons = '';
      if (a.status !== 'Finalizado' && a.status !== 'Cancelado') {
        actionButtons = `
          ${a.status !== 'Confirmado' ? `
            <button class="action-btn text-success" onclick="ProfessionalDashboard.updateStatus('${a.id}', 'Confirmado')" title="Confirmar Consulta">
              <i class="fas fa-check-circle"></i>
            </button>
          ` : ''}
          <button class="action-btn text-warning" onclick="ProfessionalDashboard.updateStatus('${a.id}', 'Finalizado')" title="Marcar como Realizada">
            <i class="fas fa-clipboard-check"></i>
          </button>
          <button class="action-btn text-danger" onclick="ProfessionalDashboard.updateStatus('${a.id}', 'Cancelado')" title="Cancelar Consulta">
            <i class="fas fa-times-circle"></i>
          </button>
        `;
      }

      return `
        <tr class="animate-in">
          <td>
            <div style="font-weight:600; color:var(--text-main);">${this.escHtml(patient.nome)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${patient.cpf ? 'CPF: '+this.escHtml(patient.cpf) : ''}</div>
          </td>
          <td>${formattedDate}</td>
          <td><span class="time-badge">${a.horario.substring(0, 5)}</span></td>
          <td>
            <div style="font-size:0.8rem;"><i class="fab fa-whatsapp" style="color:#2E8B57;"></i> ${this.escHtml(patient.telefone)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${this.escHtml(patient.email)}</div>
          </td>
          <td>${statusBadge}</td>
          <td>
            <div class="row-actions">
              <button class="action-btn text-primary" onclick="ProfessionalDashboard.viewAppointment('${a.id}')" title="Ver Detalhes">
                <i class="fas fa-eye"></i>
              </button>
              ${actionButtons}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ─── Atualizar Status de Consulta ─────────────────────────────
  async updateStatus(id, newStatus) {
    try {
      const { error } = await window.supabaseClient
        .from('agendamentos')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;

      this.showToast('Agenda Atualizada', `Status alterado para "${newStatus}".`, 'success');
      await this.loadAppointments();
      this.deriveMyPatients();
      this.applyFiltersAndRender();
      this.updateDashboard();
      this.renderMyPatients();
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      this.showToast('Erro', 'Não foi possível alterar o status.', 'error');
    }
  },

  // ─── Ver Detalhes da Consulta ─────────────────────────────────
  viewAppointment(id) {
    const a = this.state.appointments.find(item => item.id === id);
    if (!a) return;

    const patient = this.getPatient(a.paciente_id) || { nome: 'Desconhecido', telefone: '—', email: '—', cpf: '—' };
    const dateFormatted = new Date(a.data + 'T00:00:00').toLocaleDateString('pt-BR');

    const detailsBox = document.getElementById('appointment-details-content');
    if (detailsBox) {
      detailsBox.innerHTML = `
        <div class="patient-details-row"><span class="patient-details-label">Paciente</span><span class="patient-details-value">${this.escHtml(patient.nome)}</span></div>
        <div class="patient-details-row"><span class="patient-details-label">CPF</span><span class="patient-details-value">${this.escHtml(patient.cpf || '—')}</span></div>
        <div class="patient-details-row"><span class="patient-details-label">Telefone</span><span class="patient-details-value">${this.escHtml(patient.telefone)}</span></div>
        <div class="patient-details-row"><span class="patient-details-label">E-mail</span><span class="patient-details-value">${this.escHtml(patient.email)}</span></div>
        <div class="patient-details-row"><span class="patient-details-label">Data</span><span class="patient-details-value">${dateFormatted}</span></div>
        <div class="patient-details-row"><span class="patient-details-label">Horário</span><span class="patient-details-value">${a.horario.substring(0, 5)}</span></div>
        <div class="patient-details-row"><span class="patient-details-label">Status</span><span class="patient-details-value" style="font-weight:700;">${a.status}</span></div>
        <div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border-color);">
          <div class="patient-details-label" style="margin-bottom:6px;"><i class="far fa-sticky-note"></i> Observações:</div>
          <div style="font-size:0.85rem; color:var(--text-main); background:var(--bg-surface); padding:12px; border-radius:6px; border:1px solid var(--border-color); line-height:1.5;">
            ${a.observacoes ? this.escHtml(a.observacoes) : '<span style="color:var(--text-muted)">Nenhuma observação cadastrada.</span>'}
          </div>
        </div>
      `;
    }
    this.openModal('modal-view-appointment');
  },

  // ─── Interface Principal ───────────────────────────────────────
  setupUI() {
    const prof = this.state.professional;

    // Nome e especialidade na sidebar e header
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('doctor-name',        prof.nome);
    setEl('sidebar-user-name',  prof.nome);
    setEl('doctor-specialty',   this.state.specialtyName);
    setEl('sidebar-user-role',  this.state.specialtyName || 'Profissional');

    // Avatar
    const updateAvatars = (url) => {
      const html = url
        ? `<img src="${url}" alt="${this.escHtml(prof.nome)}">`
        : `<span>${(prof.nome || '?').charAt(0).toUpperCase()}</span>`;
      ['doctor-large-avatar', 'sidebar-avatar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = html;
      });
    };
    updateAvatars(prof.foto);

    // Sidebar hamburguer (mobile)
    const hamburgerBtn    = document.getElementById('hamburger-btn');
    const adminSidebar    = document.getElementById('admin-sidebar');
    const sidebarOverlay  = document.getElementById('sidebar-overlay');

    const openSidebar = () => {
      adminSidebar?.classList.add('sidebar-open');
      sidebarOverlay?.classList.add('active');
      hamburgerBtn?.classList.add('active');
      document.body.style.overflow = 'hidden';
    };
    const closeSidebar = () => {
      adminSidebar?.classList.remove('sidebar-open');
      sidebarOverlay?.classList.remove('active');
      hamburgerBtn?.classList.remove('active');
      document.body.style.overflow = '';
    };

    hamburgerBtn?.addEventListener('click', () =>
      adminSidebar?.classList.contains('sidebar-open') ? closeSidebar() : openSidebar()
    );
    sidebarOverlay?.addEventListener('click', closeSidebar);

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      await window.supabaseClient.auth.signOut();
      localStorage.removeItem('zoe_current_session');
      window.location.replace('login.html');
    });

    // Tema
    if (window.ThemeManager) {
      window.ThemeManager.initOnLoad();
      const themeBtn = document.getElementById('theme-toggle');
      if (themeBtn) {
        const updateIcon = (theme) => {
          const icon = themeBtn.querySelector('i');
          if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        };
        updateIcon(window.ThemeManager.getCurrentTheme());
        themeBtn.addEventListener('click', () => updateIcon(window.ThemeManager.toggleTheme()));
      }
    }

    // Loader
    const loader = document.getElementById('loader-overlay');
    if (loader) {
      setTimeout(() => {
        loader.classList.add('fade-out');
        setTimeout(() => loader.remove(), 400);
      }, 300);
    }

    // Navegar para início por padrão
    this.navigateTo('inicio');
  },

  // ─── Modais ────────────────────────────────────────────────────
  setupModals() {
    // Abrir modal de configurações de perfil
    document.getElementById('btn-update-profile')?.addEventListener('click', () => {
      const prof = this.state.professional;
      const inputUrl = document.getElementById('profile-photo-url');
      if (inputUrl) inputUrl.value = prof.foto || '';
      const inputPass = document.getElementById('new-password');
      if (inputPass) inputPass.value = '';
      const inputPhone = document.getElementById('profile-telefone-input');
      if (inputPhone) inputPhone.value = prof.telefone || '';
      const inputWa = document.getElementById('profile-whatsapp-input');
      if (inputWa) inputWa.value = prof.whatsapp || '';
      this.openModal('modal-profile-settings');
    });

    // Fechar modais
    document.querySelectorAll('.modal-pro .close-modal-pro, .modal-pro .btn-cancel-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-pro');
        if (modal) this.closeModal(modal.id);
      });
    });

    // Formulário de configurações
    document.getElementById('form-profile-settings')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveProfileSettings();
    });
  },

  async saveProfileSettings() {
    const newPass   = document.getElementById('new-password')?.value;
    const photoUrl  = document.getElementById('profile-photo-url')?.value;
    const photoFile = document.getElementById('profile-photo-file')?.files[0];
    const newPhone  = document.getElementById('profile-telefone-input')?.value?.trim();
    const newWa     = document.getElementById('profile-whatsapp-input')?.value?.trim();

    try {
      let finalPhotoUrl = photoUrl || this.state.professional.foto;

      // Upload de arquivo (se selecionado)
      if (photoFile) {
        if (photoFile.size > 3 * 1024 * 1024) {
          this.showToast('Arquivo muito grande', 'Tamanho máximo: 3MB.', 'error');
          return;
        }
        if (!window.CONFIG.DEMO_MODE) {
          const ext      = photoFile.name.split('.').pop();
          const fileName = `prof_${this.state.professional.id}_${Date.now()}.${ext}`;
          const { error: uploadErr } = await window.supabaseClient.storage
            .from('profissionais').upload(`fotos/${fileName}`, photoFile, { cacheControl: '3600', upsert: true });
          if (uploadErr) throw uploadErr;
          const { data: urlData } = window.supabaseClient.storage.from('profissionais').getPublicUrl(`fotos/${fileName}`);
          finalPhotoUrl = urlData.publicUrl;
        } else {
          finalPhotoUrl = await this.readAsDataURL(photoFile);
        }
      }

      // Atualizar senha
      if (newPass && newPass.length >= 6) {
        if (!window.CONFIG.DEMO_MODE) {
          const { error: authErr } = await window.supabaseClient.auth.updateUser({ password: newPass });
          if (authErr) throw authErr;
        }
        this.showToast('Senha Atualizada', 'Sua nova senha foi salva.', 'success');
      }

      // Atualizar dados editáveis (foto, telefone, whatsapp)
      const updates = { foto: finalPhotoUrl };
      if (newPhone !== undefined) updates.telefone = newPhone;
      if (newWa    !== undefined) updates.whatsapp  = newWa;

      const { error: updateErr } = await window.supabaseClient
        .from('profissionais')
        .update(updates)
        .eq('id', this.state.professional.id);
      if (updateErr) throw updateErr;

      // Atualizar estado local
      Object.assign(this.state.professional, updates);
      this.closeModal('modal-profile-settings');
      this.setupUI();
      this.renderProfile();
      this.showToast('Perfil Atualizado', 'Suas informações foram salvas.', 'success');

    } catch (err) {
      console.error('Erro ao salvar configurações do perfil:', err);
      this.showToast('Erro ao Salvar', err.message || 'Tente novamente.', 'error');
    }
  },

  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) { modal.classList.add('modal-open'); document.body.style.overflow = 'hidden'; }
  },

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) { modal.classList.remove('modal-open'); document.body.style.overflow = ''; }
  },

  // ─── Realtime ─────────────────────────────────────────────────
  setupRealtime() {
    try {
      window.supabaseClient
        .channel('doctor-dashboard')
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'agendamentos',
          filter: `profissional_id=eq.${this.state.professional.id}`
        }, async (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          if (eventType === 'INSERT') {
            if (!this.state.appointments.find(a => a.id === newRow.id))
              this.state.appointments.push(newRow);
          } else if (eventType === 'UPDATE') {
            const idx = this.state.appointments.findIndex(a => a.id === (newRow?.id || oldRow?.id));
            if (idx !== -1) this.state.appointments[idx] = newRow;
          } else if (eventType === 'DELETE') {
            this.state.appointments = this.state.appointments.filter(a => a.id !== oldRow?.id);
          }
          this.deriveMyPatients();
          this.applyFiltersAndRender();
          this.updateDashboard();
          this.renderMyPatients();
        })
        .subscribe();
    } catch (err) {
      console.warn('[Realtime error]', err);
    }
  },

  // ─── Utilitários ──────────────────────────────────────────────
  getPatient(id) { return this.state.patients.find(p => p.id === id); },

  async getSpecialtyName(id) {
    try {
      const { data, error } = await window.supabaseClient
        .from('especialidades').select('nome').eq('id', id).limit(1);
      if (!error && data && data.length > 0) return data[0].nome;
    } catch {}
    return 'Geral';
  },

  readAsDataURL(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  },

  escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  },

  showToast(title, message, type = 'info') {
    if (window.Notifications) { window.Notifications.show(title, message, type); return; }
    console.log(`[${type}] ${title}: ${message}`);
  }
,
  setupInlineSettingsForms() {
    // Preencher campos inline com dados do perfil assim que carregar
    setTimeout(() => {
      const prof = this.state.professional;
      if (prof) {
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        setVal('inline-photo-url', prof.foto);
        setVal('inline-telefone',  prof.telefone);
        setVal('inline-whatsapp',  prof.whatsapp);
      }
    }, 2000);

    // Alterar senha (inline)
    document.getElementById('form-change-password')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pass    = document.getElementById('inline-new-password').value;
      const confirm = document.getElementById('inline-confirm-password').value;
      if (pass !== confirm) {
        this.showToast('Senhas não coincidem', 'Digite a mesma senha nos dois campos.', 'error');
        return;
      }
      if (pass.length < 6) {
        this.showToast('Senha curta', 'Mínimo de 6 caracteres.', 'error');
        return;
      }
      try {
        if (!window.CONFIG.DEMO_MODE) {
          const { error } = await window.supabaseClient.auth.updateUser({ password: pass });
          if (error) throw error;
        }
        document.getElementById('inline-new-password').value    = '';
        document.getElementById('inline-confirm-password').value = '';
        this.showToast('Senha Atualizada', 'Sua nova senha foi salva com sucesso.', 'success');
      } catch (err) {
        this.showToast('Erro', err.message, 'error');
      }
    });

    // Foto e contato (inline)
    document.getElementById('form-change-photo')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const photoUrl  = document.getElementById('inline-photo-url').value;
      const photoFile = document.getElementById('inline-photo-file').files[0];
      const newPhone  = document.getElementById('inline-telefone').value.trim();
      const newWa     = document.getElementById('inline-whatsapp').value.trim();

      const prof = this.state.professional;
      if (!prof) return;

      let finalPhotoUrl = photoUrl || prof.foto;

      try {
        if (photoFile) {
          if (photoFile.size > 3 * 1024 * 1024) {
            this.showToast('Arquivo grande', 'Tamanho máximo: 3MB.', 'error');
            return;
          }
          if (!window.CONFIG.DEMO_MODE) {
            const ext = photoFile.name.split('.').pop();
            const fileName = `prof_${prof.id}_${Date.now()}.${ext}`;
            const { error: upErr } = await window.supabaseClient.storage
              .from('profissionais').upload(`fotos/${fileName}`, photoFile, { cacheControl: '3600', upsert: true });
            if (upErr) throw upErr;
            const { data: urlData } = window.supabaseClient.storage.from('profissionais').getPublicUrl(`fotos/${fileName}`);
            finalPhotoUrl = urlData.publicUrl;
          } else {
            finalPhotoUrl = await this.readAsDataURL(photoFile);
          }
        }

        const updates = { foto: finalPhotoUrl, telefone: newPhone, whatsapp: newWa };
        const { error } = await window.supabaseClient
          .from('profissionais').update(updates).eq('id', prof.id);
        if (error) throw error;

        Object.assign(prof, updates);
        this.setupUI();
        this.renderProfile();
        this.showToast('Salvo!', 'Foto e contato atualizados.', 'success');
      } catch (err) {
        this.showToast('Erro', err.message, 'error');
      }
    });

    // Navigate to agenda click handler (replacing onclick inline)
    document.getElementById('btn-nav-agenda')?.addEventListener('click', () => {
      this.navigateTo('agenda');
    });
  },

};

document.addEventListener('DOMContentLoaded', () => { ProfessionalDashboard.init(); });
window.ProfessionalDashboard = ProfessionalDashboard;
