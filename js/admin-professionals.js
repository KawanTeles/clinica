// ══════════════════════════════════════════════════════════════════
//  Clínica Zoe — Gerenciamento de Profissionais (Admin)
//  Arquivo: js/admin-professionals.js
// ══════════════════════════════════════════════════════════════════

const ProfessionalsAdmin = {

  // ─── Estado Interno ───────────────────────────────────────────
  state: {
    allProfessionals: [],
    filtered: [],
    specialties: [],
    currentPage: 1,
    perPage: 8,
    sortBy: 'nome',
    sortDir: 'asc',
    searchQuery: '',
    filterStatus: '',
    filterSpecialty: '',
    viewMode: 'table', // 'table' | 'cards'
    realtimeChannel: null,
    editingId: null,
    viewingId: null,
  },

  // ─── Inicialização ────────────────────────────────────────────
  async init() {
    this.showPageSkeleton();
    await this.loadSpecialties();
    await this.loadProfessionals();
    this.setupFilters();
    this.setupModals();
    this.setupRealtimeSubscription();
    this.setupPhotoUploads();
    this.applyFiltersAndRender();
  },

  // ─── Skeleton Loading ─────────────────────────────────────────
  showPageSkeleton() {
    const tbody = document.getElementById('prof-table-body');
    if (tbody) {
      tbody.innerHTML = Array(5).fill('').map(() => `
        <tr class="skeleton-row">
          <td><div class="skeleton sk-avatar"></div></td>
          <td><div class="skeleton sk-text" style="width:140px"></div></td>
          <td><div class="skeleton sk-text" style="width:100px"></div></td>
          <td><div class="skeleton sk-text" style="width:80px"></div></td>
          <td><div class="skeleton sk-text" style="width:140px"></div></td>
          <td><div class="skeleton sk-text" style="width:60px"></div></td>
          <td><div class="skeleton sk-text" style="width:80px"></div></td>
          <td><div class="skeleton sk-badge"></div></td>
          <td><div class="skeleton sk-text" style="width:80px"></div></td>
        </tr>
      `).join('');
    }
    const cardsGrid = document.getElementById('prof-cards-grid');
    if (cardsGrid) {
      cardsGrid.innerHTML = Array(6).fill('').map(() => `
        <div class="prof-card-skeleton">
          <div class="skeleton sk-card-avatar"></div>
          <div class="skeleton sk-text" style="width:70%;margin:12px auto 6px;"></div>
          <div class="skeleton sk-text" style="width:50%;margin:0 auto 12px;"></div>
          <div class="skeleton sk-text" style="width:80%;margin:0 auto 6px;"></div>
          <div class="skeleton sk-text" style="width:60%;margin:0 auto;"></div>
        </div>
      `).join('');
    }
  },

  // ─── Carregar Dados do Supabase ────────────────────────────────
  async loadSpecialties() {
    try {
      const { data, error } = await window.supabaseClient
        .from('especialidades')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      this.state.specialties = data || [];
      this.populateSpecialtyFilters();
    } catch (err) {
      console.error('Erro ao carregar especialidades:', err);
    }
  },

  async loadProfessionals() {
    try {
      const { data, error } = await window.supabaseClient
        .from('profissionais')
        .select('*')
        .order('nome', { ascending: true });
      if (error) throw error;
      this.state.allProfessionals = data || [];
    } catch (err) {
      console.error('Erro ao carregar profissionais:', err);
      this.showToast('Erro ao carregar', 'Não foi possível buscar os profissionais.', 'error');
    }
  },

  // ─── Filtros & Pesquisa ───────────────────────────────────────
  setupFilters() {
    const searchInput = document.getElementById('search-prof');
    const filterStatus = document.getElementById('filter-prof-status');
    const filterSpecialty = document.getElementById('filter-prof-specialty');
    const sortSelect = document.getElementById('sort-prof');
    const btnClearFilters = document.getElementById('btn-clear-prof-filters');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.state.searchQuery = searchInput.value.trim().toLowerCase();
        this.state.currentPage = 1;
        this.applyFiltersAndRender();
      });
    }

    if (filterStatus) {
      filterStatus.addEventListener('change', () => {
        this.state.filterStatus = filterStatus.value;
        this.state.currentPage = 1;
        this.applyFiltersAndRender();
      });
    }

    if (filterSpecialty) {
      filterSpecialty.addEventListener('change', () => {
        this.state.filterSpecialty = filterSpecialty.value;
        this.state.currentPage = 1;
        this.applyFiltersAndRender();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        const [col, dir] = sortSelect.value.split('_');
        this.state.sortBy = col;
        this.state.sortDir = dir || 'asc';
        this.state.currentPage = 1;
        this.applyFiltersAndRender();
      });
    }

    if (btnClearFilters) {
      btnClearFilters.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (filterStatus) filterStatus.value = '';
        if (filterSpecialty) filterSpecialty.value = '';
        if (sortSelect) sortSelect.value = 'nome_asc';
        this.state.searchQuery = '';
        this.state.filterStatus = '';
        this.state.filterSpecialty = '';
        this.state.sortBy = 'nome';
        this.state.sortDir = 'asc';
        this.state.currentPage = 1;
        this.applyFiltersAndRender();
      });
    }

    // Alternar visualização tabela/cards
    const btnViewTable = document.getElementById('btn-view-table');
    const btnViewCards = document.getElementById('btn-view-cards');
    if (btnViewTable) {
      btnViewTable.addEventListener('click', () => {
        this.state.viewMode = 'table';
        this.updateViewToggle();
        this.renderCurrentView();
      });
    }
    if (btnViewCards) {
      btnViewCards.addEventListener('click', () => {
        this.state.viewMode = 'cards';
        this.updateViewToggle();
        this.renderCurrentView();
      });
    }
  },

  populateSpecialtyFilters() {
    const filterSelect = document.getElementById('filter-prof-specialty');
    const createSpecSelect = document.getElementById('modal-prof-especialidade');
    const editSpecSelect = document.getElementById('modal-edit-especialidade');

    const options = this.state.specialties.map(s =>
      `<option value="${s.id}">${s.nome}</option>`
    ).join('');

    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">Todas as Especialidades</option>' + options;
    }
    if (createSpecSelect) {
      createSpecSelect.innerHTML = '<option value="">Selecione a Especialidade *</option>' + options;
    }
    if (editSpecSelect) {
      editSpecSelect.innerHTML = options;
    }
  },

  applyFiltersAndRender() {
    let data = [...this.state.allProfessionals];

    // Pesquisa
    if (this.state.searchQuery) {
      const q = this.state.searchQuery;
      data = data.filter(p =>
        (p.nome || '').toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.telefone || '').includes(q) ||
        (p.whatsapp || '').includes(q) ||
        this.getSpecialtyName(p.especialidade_id).toLowerCase().includes(q)
      );
    }

    // Filtro por status
    if (this.state.filterStatus !== '') {
      const isActive = this.state.filterStatus === 'ativo';
      data = data.filter(p => !!p.ativo === isActive);
    }

    // Filtro por especialidade
    if (this.state.filterSpecialty) {
      data = data.filter(p => p.especialidade_id === this.state.filterSpecialty);
    }

    // Ordenação
    data.sort((a, b) => {
      let valA, valB;
      if (this.state.sortBy === 'nome') {
        valA = (a.nome || '').toLowerCase();
        valB = (b.nome || '').toLowerCase();
        return this.state.sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (this.state.sortBy === 'created') {
        valA = new Date(a.created_at || 0).getTime();
        valB = new Date(b.created_at || 0).getTime();
        return this.state.sortDir === 'asc' ? valA - valB : valB - valA;
      }
      if (this.state.sortBy === 'especialidade') {
        valA = this.getSpecialtyName(a.especialidade_id).toLowerCase();
        valB = this.getSpecialtyName(b.especialidade_id).toLowerCase();
        return this.state.sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return 0;
    });

    this.state.filtered = data;
    this.updateCounters();
    this.renderCurrentView();
    this.renderPagination();
  },

  updateCounters() {
    const total = this.state.allProfessionals.length;
    const active = this.state.allProfessionals.filter(p => p.ativo).length;
    const inactive = total - active;
    const filtered = this.state.filtered.length;

    const elTotal = document.getElementById('counter-total');
    const elActive = document.getElementById('counter-active');
    const elInactive = document.getElementById('counter-inactive');
    const elFiltered = document.getElementById('counter-filtered');

    if (elTotal) elTotal.textContent = total;
    if (elActive) elActive.textContent = active;
    if (elInactive) elInactive.textContent = inactive;
    if (elFiltered) elFiltered.textContent = filtered;
  },

  updateViewToggle() {
    const btnTable = document.getElementById('btn-view-table');
    const btnCards = document.getElementById('btn-view-cards');
    const tableWrap = document.getElementById('table-view-wrapper');
    const cardsWrap = document.getElementById('cards-view-wrapper');

    if (this.state.viewMode === 'table') {
      btnTable?.classList.add('view-btn-active');
      btnCards?.classList.remove('view-btn-active');
      if (tableWrap) tableWrap.style.display = 'block';
      if (cardsWrap) cardsWrap.style.display = 'none';
    } else {
      btnCards?.classList.add('view-btn-active');
      btnTable?.classList.remove('view-btn-active');
      if (cardsWrap) cardsWrap.style.display = 'grid';
      if (tableWrap) tableWrap.style.display = 'none';
    }
  },

  renderCurrentView() {
    const start = (this.state.currentPage - 1) * this.state.perPage;
    const end = start + this.state.perPage;
    const pageData = this.state.filtered.slice(start, end);

    if (this.state.viewMode === 'table') {
      this.renderTable(pageData);
    } else {
      this.renderCards(pageData);
    }

    // Empty state
    const emptyEl = document.getElementById('prof-empty-state');
    if (this.state.allProfessionals.length === 0) {
      if (emptyEl) emptyEl.style.display = 'flex';
    } else if (this.state.filtered.length === 0) {
      if (emptyEl) {
        emptyEl.style.display = 'flex';
        emptyEl.innerHTML = `
          <div class="empty-icon"><i class="fas fa-search"></i></div>
          <h3>Nenhum resultado encontrado</h3>
          <p>Tente ajustar os filtros ou o termo de busca.</p>
          <button class="btn btn-secondary" onclick="document.getElementById('btn-clear-prof-filters').click()">
            <i class="fas fa-undo"></i> Limpar Filtros
          </button>
        `;
      }
    } else {
      if (emptyEl) emptyEl.style.display = 'none';
    }
  },

  // ─── Renderizar Tabela ─────────────────────────────────────────
  renderTable(profs) {
    const tbody = document.getElementById('prof-table-body');
    if (!tbody) return;

    if (profs.length === 0) {
      tbody.innerHTML = '';
      return;
    }

    tbody.innerHTML = profs.map(p => {
      const specName = this.getSpecialtyName(p.especialidade_id);
      const dias = this.formatDays(p.dias_atendimento);
      const avatar = p.foto
        ? `<img src="${p.foto}" alt="${this.escHtml(p.nome)}" class="prof-avatar-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : '';
      const avatarFallback = `<div class="prof-avatar-fallback" style="${p.foto ? 'display:none' : ''}">${(p.nome || '?').charAt(0).toUpperCase()}</div>`;

      return `
        <tr class="prof-table-row animate-in" data-id="${p.id}">
          <td>
            <div class="prof-avatar-wrap">
              ${avatar}
              ${avatarFallback}
            </div>
          </td>
          <td>
            <div class="prof-name-cell">
              <span class="prof-name-main">${this.escHtml(p.nome)}</span>
              ${p.email ? `<span class="prof-name-sub">${this.escHtml(p.email)}</span>` : ''}
            </div>
          </td>
          <td>
            <span class="specialty-tag">${this.escHtml(specName)}</span>
          </td>
          <td class="text-sm">${p.telefone ? this.escHtml(p.telefone) : '<span class="text-muted">—</span>'}</td>
          <td class="text-sm">${p.whatsapp ? `<a href="https://wa.me/${p.whatsapp.replace(/\D/g,'')}" target="_blank" class="wa-link"><i class="fab fa-whatsapp"></i> ${this.escHtml(p.whatsapp)}</a>` : '<span class="text-muted">—</span>'}</td>
          <td class="text-sm text-muted">${dias || '—'}</td>
          <td class="text-sm">${p.horario_inicio && p.horario_fim ? `<span class="time-badge">${p.horario_inicio.substring(0,5)} – ${p.horario_fim.substring(0,5)}</span>` : '<span class="text-muted">—</span>'}</td>
          <td>
            <span class="status-chip ${p.ativo ? 'status-active' : 'status-inactive'}">
              <span class="status-dot"></span>
              ${p.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </td>
          <td>
            <div class="row-actions-pro">
              <button class="action-pro-btn btn-view-prof" title="Visualizar" onclick="ProfessionalsAdmin.openViewModal('${p.id}')">
                <i class="fas fa-eye"></i>
              </button>
              <button class="action-pro-btn btn-edit-prof" title="Editar" onclick="ProfessionalsAdmin.openEditModal('${p.id}')">
                <i class="fas fa-edit"></i>
              </button>
              <button class="action-pro-btn btn-delete-prof" title="Excluir" onclick="ProfessionalsAdmin.confirmDelete('${p.id}', '${this.escHtml(p.nome)}')">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ─── Renderizar Cards ──────────────────────────────────────────
  renderCards(profs) {
    const grid = document.getElementById('prof-cards-grid');
    if (!grid) return;

    if (profs.length === 0) {
      grid.innerHTML = '';
      return;
    }

    grid.innerHTML = profs.map(p => {
      const specName = this.getSpecialtyName(p.especialidade_id);
      const dias = this.formatDays(p.dias_atendimento);
      const avatarStyle = p.foto
        ? `background-image:url('${p.foto}');background-size:cover;background-position:center;`
        : `background:var(--primary-gradient);`;
      const avatarContent = p.foto ? '' : `<span>${(p.nome || '?').charAt(0).toUpperCase()}</span>`;

      return `
        <div class="prof-card animate-in">
          <div class="prof-card-header">
            <div class="prof-card-avatar" style="${avatarStyle}">${avatarContent}</div>
            <span class="status-chip ${p.ativo ? 'status-active' : 'status-inactive'}">
              <span class="status-dot"></span>${p.ativo ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          <div class="prof-card-body">
            <h3 class="prof-card-name">${this.escHtml(p.nome)}</h3>
            <span class="specialty-tag">${this.escHtml(specName)}</span>
            <div class="prof-card-details">
              ${p.email ? `<div class="prof-card-detail"><i class="fas fa-envelope"></i><span>${this.escHtml(p.email)}</span></div>` : ''}
              ${p.telefone ? `<div class="prof-card-detail"><i class="fas fa-phone"></i><span>${this.escHtml(p.telefone)}</span></div>` : ''}
              ${p.whatsapp ? `<div class="prof-card-detail"><i class="fab fa-whatsapp"></i><a href="https://wa.me/${p.whatsapp.replace(/\D/g,'')}" target="_blank">${this.escHtml(p.whatsapp)}</a></div>` : ''}
              ${dias ? `<div class="prof-card-detail"><i class="fas fa-calendar-week"></i><span>${dias}</span></div>` : ''}
              ${p.horario_inicio ? `<div class="prof-card-detail"><i class="far fa-clock"></i><span>${p.horario_inicio.substring(0,5)} – ${(p.horario_fim||'').substring(0,5)}</span></div>` : ''}
            </div>
          </div>
          <div class="prof-card-footer">
            <button class="prof-card-btn btn-view-card" onclick="ProfessionalsAdmin.openViewModal('${p.id}')">
              <i class="fas fa-eye"></i> Ver
            </button>
            <button class="prof-card-btn btn-edit-card" onclick="ProfessionalsAdmin.openEditModal('${p.id}')">
              <i class="fas fa-edit"></i> Editar
            </button>
            <button class="prof-card-btn btn-delete-card" onclick="ProfessionalsAdmin.confirmDelete('${p.id}', '${this.escHtml(p.nome)}')">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  // ─── Paginação ─────────────────────────────────────────────────
  renderPagination() {
    const container = document.getElementById('pagination-container');
    if (!container) return;

    const total = this.state.filtered.length;
    const totalPages = Math.ceil(total / this.state.perPage);
    const current = this.state.currentPage;

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= current - 1 && i <= current + 1)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    const start = (current - 1) * this.state.perPage + 1;
    const end = Math.min(current * this.state.perPage, total);

    container.innerHTML = `
      <div class="pagination-info">Mostrando ${start}–${end} de ${total} profissionais</div>
      <div class="pagination-btns">
        <button class="page-btn" ${current === 1 ? 'disabled' : ''} onclick="ProfessionalsAdmin.goToPage(${current - 1})">
          <i class="fas fa-chevron-left"></i>
        </button>
        ${pages.map(p => p === '...'
          ? `<span class="page-ellipsis">…</span>`
          : `<button class="page-btn ${p === current ? 'page-btn-active' : ''}" onclick="ProfessionalsAdmin.goToPage(${p})">${p}</button>`
        ).join('')}
        <button class="page-btn" ${current === totalPages ? 'disabled' : ''} onclick="ProfessionalsAdmin.goToPage(${current + 1})">
          <i class="fas fa-chevron-right"></i>
        </button>
      </div>
    `;
  },

  goToPage(page) {
    this.state.currentPage = page;
    this.renderCurrentView();
    this.renderPagination();
    document.getElementById('prof-main-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // ─── Modais ────────────────────────────────────────────────────
  setupModals() {
    // Botão "Adicionar Profissional"
    const btnAdd = document.getElementById('btn-add-professional');
    if (btnAdd) btnAdd.addEventListener('click', () => this.openCreateModal());

    const btnAddEmpty = document.getElementById('btn-add-first-professional');
    if (btnAddEmpty) btnAddEmpty.addEventListener('click', () => this.openCreateModal());

    // Fechar modais
    document.querySelectorAll('.modal-pro .close-modal-pro, .modal-pro .btn-cancel-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-pro');
        if (modal) this.closeModal(modal.id);
      });
    });

    // Fechar ao clicar no backdrop
    document.querySelectorAll('.modal-pro').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal(modal.id);
      });
    });

    // ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-pro.modal-open').forEach(m => this.closeModal(m.id));
      }
    });

    // Formulário de criação
    const formCreate = document.getElementById('form-create-prof');
    if (formCreate) formCreate.addEventListener('submit', (e) => { e.preventDefault(); this.createProfessional(); });

    // Formulário de edição
    const formEdit = document.getElementById('form-edit-prof');
    if (formEdit) formEdit.addEventListener('submit', (e) => { e.preventDefault(); this.updateProfessional(); });

    // Botão confirmar exclusão
    const btnConfirmDel = document.getElementById('btn-confirm-delete');
    if (btnConfirmDel) btnConfirmDel.addEventListener('click', () => this.executeDeletion());
  },

  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('modal-open');
      document.body.style.overflow = 'hidden';
    }
  },

  closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('modal-open');
      document.body.style.overflow = '';
    }
  },

  openCreateModal() {
    const form = document.getElementById('form-create-prof');
    if (form) form.reset();
    const preview = document.getElementById('create-foto-preview');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    document.getElementById('create-foto-url').value = '';
    this.populateSpecialtyFilters();
    this.openModal('modal-create-prof');
  },

  async openViewModal(id) {
    const p = this.state.allProfessionals.find(x => x.id === id);
    if (!p) return;

    const specName = this.getSpecialtyName(p.especialidade_id);
    const dias = this.formatDays(p.dias_atendimento);

    const container = document.getElementById('modal-view-content');
    if (!container) return;

    container.innerHTML = `
      <div class="view-prof-header">
        <div class="view-prof-avatar">
          ${p.foto
            ? `<img src="${p.foto}" alt="${this.escHtml(p.nome)}" class="view-prof-img">`
            : `<div class="view-prof-fallback">${(p.nome||'?').charAt(0).toUpperCase()}</div>`}
        </div>
        <div class="view-prof-meta">
          <h2 class="view-prof-name">${this.escHtml(p.nome)}</h2>
          <span class="specialty-tag">${this.escHtml(specName)}</span>
          <span class="status-chip ${p.ativo ? 'status-active' : 'status-inactive'}" style="margin-top:8px;">
            <span class="status-dot"></span>${p.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </div>
      <div class="view-prof-grid">
        <div class="view-prof-item"><i class="fas fa-envelope"></i><div><label>E-mail</label><span>${p.email || '—'}</span></div></div>
        <div class="view-prof-item"><i class="fas fa-phone"></i><div><label>Telefone</label><span>${p.telefone || '—'}</span></div></div>
        <div class="view-prof-item"><i class="fab fa-whatsapp"></i><div><label>WhatsApp</label><span>${p.whatsapp || '—'}</span></div></div>
        <div class="view-prof-item"><i class="fas fa-calendar-week"></i><div><label>Dias de Atendimento</label><span>${dias || '—'}</span></div></div>
        <div class="view-prof-item"><i class="far fa-clock"></i><div><label>Horário</label><span>${p.horario_inicio && p.horario_fim ? p.horario_inicio.substring(0,5)+' às '+p.horario_fim.substring(0,5) : '—'}</span></div></div>
        <div class="view-prof-item"><i class="fas fa-calendar-plus"></i><div><label>Cadastrado em</label><span>${p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—'}</span></div></div>
      </div>
      ${p.mini_curriculo ? `
        <div class="view-prof-curriculo">
          <label><i class="fas fa-file-alt"></i> Mini Currículo</label>
          <p>${this.escHtml(p.mini_curriculo)}</p>
        </div>
      ` : ''}
      <div class="modal-view-footer">
        <button class="btn btn-secondary btn-cancel-modal" onclick="ProfessionalsAdmin.closeModal('modal-view-prof')">
          Fechar
        </button>
        <button class="btn btn-primary" onclick="ProfessionalsAdmin.closeModal('modal-view-prof');ProfessionalsAdmin.openEditModal('${p.id}')">
          <i class="fas fa-edit"></i> Editar Profissional
        </button>
      </div>
    `;
    this.openModal('modal-view-prof');
  },

  async openEditModal(id) {
    const p = this.state.allProfessionals.find(x => x.id === id);
    if (!p) {
      // Busca direto no banco se não estiver na memória
      const { data } = await window.supabaseClient.from('profissionais').select('*').eq('id', id);
      if (!data || !data[0]) return;
      return this.openEditModal(id); // retry
    }

    this.state.editingId = id;
    this.populateSpecialtyFilters();

    // Preencher campos
    document.getElementById('edit-prof-id').value = p.id;
    document.getElementById('edit-prof-nome').value = p.nome || '';
    document.getElementById('edit-prof-email').value = p.email || '';
    document.getElementById('edit-prof-telefone').value = p.telefone || '';
    document.getElementById('edit-prof-whatsapp').value = p.whatsapp || '';
    document.getElementById('edit-prof-curriculo').value = p.mini_curriculo || '';
    document.getElementById('edit-prof-inicio').value = (p.horario_inicio || '').substring(0, 5);
    document.getElementById('edit-prof-fim').value = (p.horario_fim || '').substring(0, 5);
    document.getElementById('edit-prof-ativo').checked = !!p.ativo;
    document.getElementById('edit-foto-url').value = p.foto || '';

    // Foto preview
    const preview = document.getElementById('edit-foto-preview');
    if (preview) {
      if (p.foto) {
        preview.src = p.foto;
        preview.style.display = 'block';
      } else {
        preview.src = '';
        preview.style.display = 'none';
      }
    }

    // Especialidade
    const specSelect = document.getElementById('edit-prof-especialidade');
    if (specSelect) {
      this.state.specialties.forEach(s => {
        const opt = specSelect.querySelector(`option[value="${s.id}"]`);
        if (opt) opt.selected = s.id === p.especialidade_id;
      });
    }

    // Dias de atendimento
    document.querySelectorAll('.edit-day-check').forEach(cb => {
      cb.checked = Array.isArray(p.dias_atendimento) && p.dias_atendimento.includes(cb.value);
    });

    this.openModal('modal-edit-prof');
  },

  confirmDelete(id, name) {
    this.state.editingId = id;
    const nameEl = document.getElementById('delete-prof-name');
    if (nameEl) nameEl.textContent = name;
    this.openModal('modal-delete-confirm');
  },

  // ─── CRUD: Criar ───────────────────────────────────────────────
  async createProfessional() {
    const btn = document.getElementById('btn-create-submit');
    const btnText = btn?.querySelector('.btn-text');
    const btnLoader = btn?.querySelector('.btn-loader');

    // Coletar dados
    const nome = document.getElementById('create-prof-nome')?.value.trim();
    const email = document.getElementById('create-prof-email')?.value.trim();
    const telefone = document.getElementById('create-prof-telefone')?.value.trim();
    const whatsapp = document.getElementById('create-prof-whatsapp')?.value.trim();
    const especialidade_id = document.getElementById('modal-prof-especialidade')?.value;
    const mini_curriculo = document.getElementById('create-prof-curriculo')?.value.trim();
    const horario_inicio = document.getElementById('create-prof-inicio')?.value;
    const horario_fim = document.getElementById('create-prof-fim')?.value;
    const ativo = document.getElementById('create-prof-ativo')?.checked !== false;
    const foto = document.getElementById('create-foto-url')?.value || '';
    const senha = document.getElementById('create-prof-senha')?.value;

    const dias_atendimento = Array.from(document.querySelectorAll('.create-day-check:checked')).map(cb => cb.value);

    // Validação básica
    if (!nome || !email || !especialidade_id) {
      this.showToast('Campos obrigatórios', 'Preencha nome, e-mail e especialidade.', 'error');
      return;
    }

    if (btn) { btn.disabled = true; if (btnText) btnText.style.display = 'none'; if (btnLoader) btnLoader.style.display = 'inline-block'; }

    try {
      // 1. Criar usuário no Supabase Auth (se senha fornecida)
      let authUserId = null;
      if (senha && senha.length >= 6) {
        const { data: authData, error: authError } = await window.supabaseClient.auth.signUp({
          email,
          password: senha,
          options: { data: { role: 'professional', nome } }
        });
        if (authError) {
          console.warn('Auth SignUp warning:', authError.message);
        } else {
          authUserId = authData?.user?.id;
        }
      }

      // 2. Inserir na tabela profissionais
      const payload = {
        nome,
        email,
        telefone: telefone || null,
        whatsapp: whatsapp || null,
        especialidade_id,
        mini_curriculo: mini_curriculo || null,
        horario_inicio: horario_inicio || '08:00',
        horario_fim: horario_fim || '18:00',
        dias_atendimento: dias_atendimento.length > 0 ? dias_atendimento : ['seg','ter','qua','qui','sex'],
        ativo,
        foto: foto || null,
        ...(authUserId ? { auth_user_id: authUserId } : {}),
      };

      console.log('[Profissionais] Dados enviados para INSERT:', payload);
      const { data, error } = await window.supabaseClient.from('profissionais').insert(payload);
      if (error) {
        console.error('[Profissionais] Erro no INSERT:', error.message, error);
        throw error;
      }

      this.showToast('Profissional Cadastrado!', `${nome} foi adicionado com sucesso.`, 'success');
      this.closeModal('modal-create-prof');

      // Recarregar lista
      await this.loadProfessionals();
      this.applyFiltersAndRender();

    } catch (err) {
      console.error('Erro ao criar profissional:', err);
      this.showToast('Erro ao Cadastrar', err.message || 'Tente novamente.', 'error');
    } finally {
      if (btn) { btn.disabled = false; if (btnText) btnText.style.display = 'inline'; if (btnLoader) btnLoader.style.display = 'none'; }
    }
  },

  // ─── CRUD: Atualizar ───────────────────────────────────────────
  async updateProfessional() {
    const btn = document.getElementById('btn-edit-submit');
    const btnText = btn?.querySelector('.btn-text');
    const btnLoader = btn?.querySelector('.btn-loader');

    const id = document.getElementById('edit-prof-id')?.value;
    const nome = document.getElementById('edit-prof-nome')?.value.trim();
    const email = document.getElementById('edit-prof-email')?.value.trim();
    const telefone = document.getElementById('edit-prof-telefone')?.value.trim();
    const whatsapp = document.getElementById('edit-prof-whatsapp')?.value.trim();
    const especialidade_id = document.getElementById('edit-prof-especialidade')?.value;
    const mini_curriculo = document.getElementById('edit-prof-curriculo')?.value.trim();
    const horario_inicio = document.getElementById('edit-prof-inicio')?.value;
    const horario_fim = document.getElementById('edit-prof-fim')?.value;
    const ativo = document.getElementById('edit-prof-ativo')?.checked;
    const foto = document.getElementById('edit-foto-url')?.value || null;
    const dias_atendimento = Array.from(document.querySelectorAll('.edit-day-check:checked')).map(cb => cb.value);

    if (!nome || !email) {
      this.showToast('Campos obrigatórios', 'Preencha nome e e-mail.', 'error');
      return;
    }

    if (btn) { btn.disabled = true; if (btnText) btnText.style.display = 'none'; if (btnLoader) btnLoader.style.display = 'inline-block'; }

    try {
      const updatePayload = {
        nome,
        email,
        telefone: telefone || null,
        whatsapp: whatsapp || null,
        especialidade_id,
        mini_curriculo: mini_curriculo || null,
        horario_inicio: horario_inicio || '08:00',
        horario_fim: horario_fim || '18:00',
        dias_atendimento: dias_atendimento.length > 0 ? dias_atendimento : ['seg','ter','qua','qui','sex'],
        ativo: !!ativo,
        foto,
      };

      console.log('[Profissionais] Dados enviados para UPDATE (id:', id, '):', updatePayload);
      const { error } = await window.supabaseClient.from('profissionais').update(updatePayload).eq('id', id);

      if (error) {
        console.error('[Profissionais] Erro no UPDATE:', error.message, error);
        throw error;
      }

      this.showToast('Atualizado com Sucesso!', `${nome} foi atualizado.`, 'success');
      this.closeModal('modal-edit-prof');

      await this.loadProfessionals();
      this.applyFiltersAndRender();

    } catch (err) {
      console.error('Erro ao atualizar profissional:', err);
      this.showToast('Erro ao Atualizar', err.message || 'Tente novamente.', 'error');
    } finally {
      if (btn) { btn.disabled = false; if (btnText) btnText.style.display = 'inline'; if (btnLoader) btnLoader.style.display = 'none'; }
    }
  },

  // ─── CRUD: Deletar ─────────────────────────────────────────────
  async executeDeletion() {
    const id = this.state.editingId;
    if (!id) return;

    const btn = document.getElementById('btn-confirm-delete');
    if (btn) btn.disabled = true;

    try {
      // Pegar dados do profissional antes de deletar (para limpar foto)
      const prof = this.state.allProfessionals.find(p => p.id === id);

      // 1. Deletar da tabela profissionais
      const { error } = await window.supabaseClient.from('profissionais').delete().eq('id', id);
      if (error) throw error;

      // 2. Tentar excluir foto do Storage (se existir e tiver caminho no Storage)
      if (prof?.foto && prof.foto.includes('supabase') && !window.CONFIG.DEMO_MODE) {
        const filePath = prof.foto.split('/storage/v1/object/public/profissionais/')[1];
        if (filePath) {
          await window.supabaseClient.storage.from('profissionais').remove([filePath]);
        }
      }

      this.showToast('Profissional Excluído', 'O registro foi removido com sucesso.', 'success');
      this.closeModal('modal-delete-confirm');

      await this.loadProfessionals();
      this.applyFiltersAndRender();

      // Atualizar o dashboard principal se estiver disponível
      if (window.refreshDashboard) window.refreshDashboard();

    } catch (err) {
      console.error('Erro ao deletar profissional:', err);
      this.showToast('Erro ao Excluir', err.message || 'Verifique agendamentos ativos.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  // ─── Upload de Foto ────────────────────────────────────────────
  setupPhotoUploads() {
    this.setupUpload({
      fileInputId: 'create-foto-file',
      previewId: 'create-foto-preview',
      urlInputId: 'create-foto-url',
      progressId: 'create-upload-progress',
      progressBarId: 'create-upload-bar',
    });
    this.setupUpload({
      fileInputId: 'edit-foto-file',
      previewId: 'edit-foto-preview',
      urlInputId: 'edit-foto-url',
      progressId: 'edit-upload-progress',
      progressBarId: 'edit-upload-bar',
    });
  },

  setupUpload({ fileInputId, previewId, urlInputId, progressId, progressBarId }) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput) return;

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) await this.handleUpload(file, { previewId, urlInputId, progressId, progressBarId });
    });

    // Drag & Drop na área de upload
    const dropArea = fileInput.closest('.upload-drop-zone');
    if (dropArea) {
      dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('drag-over');
      });
      dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
      dropArea.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) await this.handleUpload(file, { previewId, urlInputId, progressId, progressBarId });
      });
    }
  },

  async handleUpload(file, { previewId, urlInputId, progressId, progressBarId }) {
    if (file.size > 3 * 1024 * 1024) {
      this.showToast('Arquivo muito grande', 'Tamanho máximo: 3MB.', 'error');
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      this.showToast('Formato inválido', 'Use PNG, JPG ou WEBP.', 'error');
      return;
    }

    // Preview local imediato
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = document.getElementById(previewId);
      if (preview) { preview.src = e.target.result; preview.style.display = 'block'; }
    };
    reader.readAsDataURL(file);

    // Barra de progresso
    const progressEl = document.getElementById(progressId);
    const barEl = document.getElementById(progressBarId);
    if (progressEl) progressEl.style.display = 'block';
    if (barEl) barEl.style.width = '30%';

    try {
      if (window.CONFIG.DEMO_MODE) {
        // Em modo demo, usar Data URL como foto
        if (barEl) barEl.style.width = '100%';
        const preview = document.getElementById(previewId);
        if (preview?.src) {
          const urlInput = document.getElementById(urlInputId);
          if (urlInput) urlInput.value = preview.src;
        }
        this.showToast('Foto Selecionada', 'Foto pronta para salvar.', 'success');
        setTimeout(() => { if (progressEl) progressEl.style.display = 'none'; }, 1500);
        return;
      }

      const ext = file.name.split('.').pop();
      const fileName = `prof_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
      const filePath = `fotos/${fileName}`;

      if (barEl) barEl.style.width = '60%';

      const { error } = await window.supabaseClient.storage
        .from('profissionais')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      if (barEl) barEl.style.width = '90%';

      const { data: urlData } = window.supabaseClient.storage.from('profissionais').getPublicUrl(filePath);
      const publicUrl = urlData?.publicUrl;

      if (!publicUrl) throw new Error('Não foi possível obter URL pública.');

      const urlInput = document.getElementById(urlInputId);
      if (urlInput) urlInput.value = publicUrl;

      const preview = document.getElementById(previewId);
      if (preview) { preview.src = publicUrl; preview.style.display = 'block'; }

      if (barEl) barEl.style.width = '100%';
      this.showToast('Upload Concluído', 'Foto enviada com sucesso!', 'success');
      setTimeout(() => { if (progressEl) progressEl.style.display = 'none'; }, 2000);

    } catch (err) {
      console.error('Erro no upload:', err);
      this.showToast('Erro no Upload', err.message || 'Verifique as configurações do Storage.', 'error');
      if (progressEl) progressEl.style.display = 'none';
    }
  },

  // ─── Realtime ──────────────────────────────────────────────────
  setupRealtimeSubscription() {
    try {
      this.state.realtimeChannel = window.supabaseClient
        .channel('profissionais-admin-page')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profissionais' }, async (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          console.log('[Realtime] profissionais ->', eventType);

          if (eventType === 'INSERT') {
            if (!this.state.allProfessionals.find(p => p.id === newRow.id)) {
              this.state.allProfessionals.push(newRow);
            }
          } else if (eventType === 'UPDATE') {
            const idx = this.state.allProfessionals.findIndex(p => p.id === (newRow?.id || oldRow?.id));
            if (idx !== -1) this.state.allProfessionals[idx] = newRow;
          } else if (eventType === 'DELETE') {
            this.state.allProfessionals = this.state.allProfessionals.filter(p => p.id !== oldRow?.id);
          }

          this.applyFiltersAndRender();
        })
        .subscribe();
    } catch (err) {
      console.warn('[Realtime] Não foi possível subscrever:', err);
    }
  },

  // ─── Utilitários ───────────────────────────────────────────────
  getSpecialtyName(id) {
    const spec = this.state.specialties.find(s => s.id === id);
    return spec ? spec.nome : 'Geral';
  },

  formatDays(days) {
    if (!Array.isArray(days) || days.length === 0) return '';
    const map = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom' };
    return days.map(d => map[d?.toLowerCase()] || d).join(', ');
  },

  escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  // ─── Toast Notifications ───────────────────────────────────────
  showToast(title, message, type = 'info') {
    // Usar o sistema de notificações existente se disponível
    if (window.Notifications) {
      window.Notifications.show(title, message, type);
      return;
    }

    // Fallback: toast próprio
    let container = document.getElementById('pro-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'pro-toast-container';
      container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
      document.body.appendChild(container);
    }

    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
    const colors = { success: '#2E8B57', error: '#EF4444', info: '#3B82F6', warning: '#F59E0B' };

    const toast = document.createElement('div');
    toast.style.cssText = `
      display:flex;align-items:center;gap:12px;
      background:var(--bg-surface,#fff);border:1px solid var(--border-color,#e5e7eb);
      border-left:4px solid ${colors[type]};border-radius:10px;
      padding:14px 18px;min-width:280px;max-width:360px;
      box-shadow:0 4px 20px rgba(0,0,0,0.12);
      animation:slideInToast 0.3s ease;
    `;

    toast.innerHTML = `
      <i class="fas ${icons[type]}" style="color:${colors[type]};font-size:1.2rem;flex-shrink:0;"></i>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:0.88rem;color:var(--text-main,#111);margin-bottom:2px;">${title}</div>
        <div style="font-size:0.8rem;color:var(--text-muted,#6b7280);">${message}</div>
      </div>
      <button onclick="this.closest('div').remove()" style="background:none;border:none;cursor:pointer;color:var(--text-muted,#6b7280);font-size:1rem;padding:0 0 0 4px;">&times;</button>
    `;

    if (!document.querySelector('#pro-toast-style')) {
      const style = document.createElement('style');
      style.id = 'pro-toast-style';
      style.textContent = '@keyframes slideInToast{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}';
      document.head.appendChild(style);
    }

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
  },
};

// ─── Boot ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticação
  const session = JSON.parse(localStorage.getItem('zoe_current_session') || 'null');
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  // Preencher dados do usuário na sidebar
  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-avatar');

  if (session.email) {
    const namePart = session.email.split('@')[0];
    const display = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    if (nameEl) nameEl.textContent = display;
    if (avatarEl) avatarEl.textContent = display.charAt(0).toUpperCase();
  }
  if (roleEl) roleEl.textContent = session.role === 'professional' ? 'Profissional' : 'Administrador';

  // Esconder loader
  const loader = document.getElementById('loader-overlay');
  if (loader) {
    setTimeout(() => {
      loader.classList.add('fade-out');
      setTimeout(() => loader.remove(), 500);
    }, 400);
  }

  // Mobile sidebar
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const adminSidebar = document.getElementById('admin-sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  function openSidebar() {
    adminSidebar?.classList.add('sidebar-open');
    sidebarOverlay?.classList.add('active');
    hamburgerBtn?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    adminSidebar?.classList.remove('sidebar-open');
    sidebarOverlay?.classList.remove('active');
    hamburgerBtn?.classList.remove('active');
    document.body.style.overflow = '';
  }

  hamburgerBtn?.addEventListener('click', () =>
    adminSidebar?.classList.contains('sidebar-open') ? closeSidebar() : openSidebar()
  );
  sidebarOverlay?.addEventListener('click', closeSidebar);

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await window.supabaseClient.auth.signOut();
      localStorage.removeItem('zoe_current_session');
      window.location.href = 'login.html';
    });
  }

  // Tema (usando o ThemeManager global)
  if (window.ThemeManager) {
    window.ThemeManager.initOnLoad();
    
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      const updateIcon = (theme) => {
        const icon = themeBtn.querySelector('i');
        if (icon) {
          icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
      };
      
      // Sincroniza ícone inicial
      updateIcon(window.ThemeManager.getCurrentTheme());
      
      themeBtn.addEventListener('click', () => {
        const newTheme = window.ThemeManager.toggleTheme();
        updateIcon(newTheme);
      });
    }
  }

  // Inicializar módulo principal
  await ProfessionalsAdmin.init();
});

window.ProfessionalsAdmin = ProfessionalsAdmin;
