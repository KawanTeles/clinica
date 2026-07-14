// Módulo de Gerenciamento Administrativo (CRUD, Férias e Bloqueios) - Clínica Zoe

const AdminModule = {
  // ─── INICIALIZAÇÃO ─────────────────────────────────────────────
  init() {
    this.setupModalTriggers();
    this.setupFormSubmits();
    this.setupPhotoUploads();
    this.checkHashRoute();
    window.addEventListener('hashchange', () => this.checkHashRoute());
  },

  checkHashRoute() {
    const hash = window.location.hash;
    if (hash === '#modal-specialties') {
      this.openModal('modal-specialties');
      this.loadSpecialtiesList();
      // Limpa hash para não abrir de novo
      history.pushState("", document.title, window.location.pathname + window.location.search);
    } else if (hash === '#modal-blocks') {
      this.openModal('modal-blocks');
      this.populateDoctorDropdowns();
      this.loadBlocksAndVacationsList();
      // Limpa hash para não abrir de novo
      history.pushState("", document.title, window.location.pathname + window.location.search);
    }
  },

  // ─── MODAIS ────────────────────────────────────────────────────
  setupModalTriggers() {
    // Abrir Gerenciamento de Profissionais
    const btnManageProfs = document.getElementById('btn-manage-professionals');
    if (btnManageProfs) {
      btnManageProfs.addEventListener('click', () => {
        this.openModal('modal-professionals');
        this.loadProfessionalsList();
        this.populateSpecialtyDropdowns();
      });
    }

    // Abrir Gerenciamento de Especialidades
    const btnManageSpecs = document.getElementById('btn-manage-specialties');
    if (btnManageSpecs) {
      btnManageSpecs.addEventListener('click', () => {
        this.openModal('modal-specialties');
        this.loadSpecialtiesList();
      });
    }

    // Abrir Configurações de Bloqueio/Férias
    const btnManageBlocks = document.getElementById('btn-manage-blocks');
    if (btnManageBlocks) {
      btnManageBlocks.addEventListener('click', () => {
        this.openModal('modal-blocks');
        this.populateDoctorDropdowns();
        this.loadBlocksAndVacationsList();
      });
    }

    // Fechar modais pelos botões
    document.querySelectorAll('.modal .btn-close-modal, .modal .close-modal-icon').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) modal.style.display = 'none';
      });
    });

    // Fechar ao clicar fora do modal
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
      }
    });

    // Fechar com ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
      }
    });
  },

  openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.style.display = 'block';
      // Resetar formulários
      modal.querySelectorAll('form').forEach(f => f.reset());
      // Ocultar formulário de edição
      const editDiv = modal.querySelector('.edit-form-container');
      if (editDiv) editDiv.style.display = 'none';
      // Resetar previews de foto
      const previews = modal.querySelectorAll('.photo-preview');
      previews.forEach(p => { p.style.display = 'none'; p.src = ''; });
      // Resetar label de upload
      const uploadLabel = document.getElementById('upload-label');
      if (uploadLabel) {
        uploadLabel.innerHTML = `
          <i class="fas fa-cloud-upload-alt"></i>
          <p>Clique para selecionar uma foto ou arraste aqui<br><small>PNG, JPG ou WEBP até 2MB</small></p>
        `;
      }
    }
  },

  // ─── DROPDOWNS ─────────────────────────────────────────────────
  populateSpecialtyDropdowns() {
    const selects = ['prof-especialidade', 'edit-prof-especialidade'];
    selects.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (select && window.dashboardSpecialties) {
        select.innerHTML = window.dashboardSpecialties.map(s =>
          `<option value="${s.id}">${s.nome}</option>`
        ).join('');
      }
    });
  },

  populateDoctorDropdowns() {
    const selects = ['block-prof-id', 'vacation-prof-id'];
    selects.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (select && window.dashboardProfessionals) {
        select.innerHTML = window.dashboardProfessionals.map(p =>
          `<option value="${p.id}">${p.nome}</option>`
        ).join('');
      }
    });
  },

  // ─── UPLOAD DE FOTOS (SUPABASE STORAGE) ────────────────────────
  setupPhotoUploads() {
    // Upload para Cadastro de novo profissional
    const fileInputCreate = document.getElementById('prof-foto-file');
    if (fileInputCreate) {
      fileInputCreate.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await this.uploadProfessionalPhoto(file, 'prof-foto', 'prof-foto-preview', 'upload-progress', 'upload-bar', 'upload-status-text', 'upload-label');
      });

      // Drag & Drop
      const uploadArea = document.getElementById('upload-label');
      if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = 'var(--primary)'; });
        uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = ''; });
        uploadArea.addEventListener('drop', async (e) => {
          e.preventDefault();
          uploadArea.style.borderColor = '';
          const file = e.dataTransfer.files[0];
          if (file) await this.uploadProfessionalPhoto(file, 'prof-foto', 'prof-foto-preview', 'upload-progress', 'upload-bar', 'upload-status-text', 'upload-label');
        });
      }
    }

    // Upload para Edição de profissional existente
    const fileInputEdit = document.getElementById('edit-prof-foto-file');
    if (fileInputEdit) {
      fileInputEdit.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        await this.uploadProfessionalPhoto(file, 'edit-prof-foto', 'edit-prof-foto-preview', null, null, null, null);
      });
    }
  },

  /**
   * Faz upload de foto para o bucket 'profissionais' no Supabase Storage.
   * Retorna a URL pública da imagem e atualiza os campos do formulário.
   */
  async uploadProfessionalPhoto(file, hiddenInputId, previewImgId, progressDivId, progressBarId, statusTextId, uploadLabelId) {
    // Validação de tamanho (2MB)
    if (file.size > 2 * 1024 * 1024) {
      window.Notifications?.show('Arquivo muito grande', 'O tamanho máximo é 2MB.', 'error');
      return null;
    }

    // Validação de tipo
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      window.Notifications?.show('Formato inválido', 'Use PNG, JPG ou WEBP.', 'error');
      return null;
    }

    // Mostrar progresso
    if (progressDivId) {
      const progressDiv = document.getElementById(progressDivId);
      if (progressDiv) progressDiv.style.display = 'block';
    }
    if (progressBarId) {
      const bar = document.getElementById(progressBarId);
      if (bar) bar.style.width = '20%';
    }
    if (statusTextId) {
      const statusEl = document.getElementById(statusTextId);
      if (statusEl) statusEl.textContent = 'Enviando para o servidor...';
    }

    try {
      // Gerar nome único para o arquivo
      const ext = file.name.split('.').pop();
      const fileName = `prof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
      const filePath = `fotos/${fileName}`;

      // Simular progresso
      if (progressBarId) {
        const bar = document.getElementById(progressBarId);
        if (bar) bar.style.width = '50%';
      }

      // Upload para o Supabase Storage
      const { data, error } = await window.supabaseClient.storage
        .from('profissionais')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Progresso: 80%
      if (progressBarId) {
        const bar = document.getElementById(progressBarId);
        if (bar) bar.style.width = '80%';
      }

      // Obter URL pública
      const { data: urlData } = window.supabaseClient.storage
        .from('profissionais')
        .getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl;

      if (!publicUrl) throw new Error('Não foi possível obter a URL pública da imagem.');

      // Preencher campo oculto com a URL
      const hiddenInput = document.getElementById(hiddenInputId);
      if (hiddenInput) hiddenInput.value = publicUrl;

      // Mostrar preview
      const preview = document.getElementById(previewImgId);
      if (preview) {
        preview.src = publicUrl;
        preview.style.display = 'block';
      }

      // Progresso: 100%
      if (progressBarId) {
        const bar = document.getElementById(progressBarId);
        if (bar) bar.style.width = '100%';
      }
      if (statusTextId) {
        const statusEl = document.getElementById(statusTextId);
        if (statusEl) statusEl.textContent = '✓ Foto enviada com sucesso!';
        statusEl.style.color = 'var(--primary)';
      }

      // Atualizar label de upload
      if (uploadLabelId) {
        const uploadLabel = document.getElementById(uploadLabelId);
        if (uploadLabel) {
          uploadLabel.innerHTML = `
            <i class="fas fa-check-circle" style="color:var(--primary);"></i>
            <p style="color:var(--primary);font-weight:600;">${file.name}</p>
          `;
        }
      }

      window.Notifications?.show('Upload Concluído', 'Foto enviada para o servidor!', 'success');
      return publicUrl;

    } catch (err) {
      console.error('Erro no upload da foto:', err);
      if (statusTextId) {
        const statusEl = document.getElementById(statusTextId);
        if (statusEl) { statusEl.textContent = '✗ Erro no upload. URL manual abaixo.'; statusEl.style.color = '#EF4444'; }
      }
      window.Notifications?.show('Erro no Upload', err.message || 'Verifique as configurações do bucket "profissionais".', 'error');
      return null;
    }
  },

  // ─── CRUD: PROFISSIONAIS ────────────────────────────────────────

  async loadProfessionalsList() {
    const container = document.getElementById('admin-professionals-list');
    if (!container) return;

    container.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:24px;">
          <div class="skeleton" style="height:20px;margin:8px auto;max-width:60%;border-radius:6px;"></div>
          <div class="skeleton" style="height:20px;margin:8px auto;max-width:80%;border-radius:6px;"></div>
          <div class="skeleton" style="height:20px;margin:8px auto;max-width:50%;border-radius:6px;"></div>
        </td>
      </tr>
    `;

    const { data: profs } = await window.supabaseClient.from('profissionais').select('*');
    if (!profs) return;

    if (profs.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted);">
            <i class="fas fa-user-md" style="font-size:2rem;display:block;margin-bottom:10px;opacity:0.3;"></i>
            Nenhum profissional cadastrado ainda.
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = profs.map(p => {
      const spec = window.dashboardSpecialties?.find(s => s.id === p.especialidade_id);
      const avatarHtml = p.foto
        ? `<img src="${p.foto}" alt="${p.nome}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;border:2px solid var(--primary);">`
        : `<div style="width:38px;height:38px;border-radius:50%;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;">${p.nome.charAt(0)}</div>`;

      return `
        <tr>
          <td>${avatarHtml}</td>
          <td><strong>${p.nome}</strong></td>
          <td>${spec ? spec.nome : 'Geral'}</td>
          <td style="font-size:0.85rem;color:var(--text-muted);">${p.email}</td>
          <td><span class="status-badge ${p.ativo ? 'badge-confirmed' : 'badge-canceled'}">${p.ativo ? 'Ativo' : 'Inativo'}</span></td>
          <td>
            <div class="row-actions">
              <button class="action-btn text-warning" onclick="AdminModule.editProfessional('${p.id}')" title="Editar">
                <i class="fas fa-edit"></i>
              </button>
              <button class="action-btn text-danger" onclick="AdminModule.deleteProfessional('${p.id}')" title="Excluir">
                <i class="far fa-trash-alt"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async editProfessional(id) {
    const { data } = await window.supabaseClient.from('profissionais').select('*').eq('id', id);
    if (!data || data.length === 0) return;
    const p = data[0];

    const editContainer = document.querySelector('#modal-professionals .edit-form-container');
    if (editContainer) {
      editContainer.style.display = 'block';
      editContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    document.getElementById('edit-prof-id').value        = p.id;
    document.getElementById('edit-prof-nome').value      = p.nome;
    document.getElementById('edit-prof-email').value     = p.email;
    document.getElementById('edit-prof-whatsapp').value  = p.whatsapp;
    document.getElementById('edit-prof-mini-curriculo').value = p.mini_curriculo;
    document.getElementById('edit-prof-foto').value      = p.foto || '';
    document.getElementById('edit-prof-inicio').value    = p.horario_inicio.substring(0, 5);
    document.getElementById('edit-prof-fim').value       = p.horario_fim.substring(0, 5);
    document.getElementById('edit-prof-ativo').checked   = p.ativo;

    // Mostrar foto atual no preview
    const preview = document.getElementById('edit-prof-foto-preview');
    if (preview && p.foto) {
      preview.src = p.foto;
      preview.style.display = 'block';
    }

    // Atualizar select de especialidade
    const selectSpec = document.getElementById('edit-prof-especialidade');
    if (selectSpec && window.dashboardSpecialties) {
      selectSpec.innerHTML = window.dashboardSpecialties.map(s =>
        `<option value="${s.id}" ${s.id === p.especialidade_id ? 'selected' : ''}>${s.nome}</option>`
      ).join('');
    }

    // Checkboxes dos dias
    document.querySelectorAll('.edit-prof-days-checkbox').forEach(cb => {
      cb.checked = Array.isArray(p.dias_atendimento) && p.dias_atendimento.includes(cb.value);
    });
  },

  async deleteProfessional(id) {
    if (!confirm('Aviso: Excluir este profissional impedirá novos agendamentos para ele. Deseja continuar?')) return;

    try {
      const { error } = await window.supabaseClient.from('profissionais').delete().eq('id', id);
      if (error) throw error;
      window.Notifications?.show('Médico Excluído', 'Profissional removido com sucesso.', 'success');
      this.loadProfessionalsList();
      if (window.refreshDashboard) window.refreshDashboard();
    } catch (err) {
      window.Notifications?.show('Erro ao Excluir', 'Não é possível excluir médicos com agendamentos ativos.', 'error');
    }
  },

  // ─── CRUD: ESPECIALIDADES ───────────────────────────────────────

  async loadSpecialtiesList() {
    const container = document.getElementById('admin-specialties-list');
    if (!container) return;

    container.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;">Carregando...</td></tr>';

    const { data: specs } = await window.supabaseClient.from('especialidades').select('*');
    if (!specs) return;

    if (specs.length === 0) {
      container.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:30px;color:var(--text-muted);">Nenhuma especialidade cadastrada.</td></tr>';
      return;
    }

    container.innerHTML = specs.map(s => `
      <tr>
        <td><i class="fas ${s.icone}" style="color:var(--primary);font-size:1.2rem;"></i></td>
        <td><strong>${s.nome}</strong></td>
        <td style="font-size:0.875rem;color:var(--text-muted);">${s.descricao}</td>
      </tr>
    `).join('');
  },

  // ─── BLOQUEIOS E FÉRIAS ─────────────────────────────────────────

  async loadBlocksAndVacationsList() {
    const blockContainer = document.getElementById('admin-blocks-list');
    const vacContainer   = document.getElementById('admin-vacations-list');

    if (blockContainer) {
      blockContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;">Carregando...</td></tr>';
      const { data: blocks } = await window.supabaseClient.from('horarios_bloqueados').select('*');

      if (!blocks || blocks.length === 0) {
        blockContainer.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum bloqueio cadastrado.</td></tr>';
      } else {
        blockContainer.innerHTML = blocks.map(b => {
          const prof          = window.dashboardProfessionals?.find(p => p.id === b.profissional_id);
          const formattedDate = new Date(b.data + 'T00:00:00').toLocaleDateString('pt-BR');
          return `
            <tr>
              <td>${prof ? prof.nome : 'Médico'}</td>
              <td>${formattedDate}</td>
              <td>${b.horario_inicio.substring(0, 5)} – ${b.horario_fim.substring(0, 5)}</td>
              <td>${b.motivo}</td>
              <td>
                <button class="action-btn text-danger" onclick="AdminModule.deleteBlock('${b.id}')" title="Remover">
                  <i class="far fa-trash-alt"></i>
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    if (vacContainer) {
      vacContainer.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:16px;">Carregando...</td></tr>';
      const { data: vacations } = await window.supabaseClient.from('ferias').select('*');

      if (!vacations || vacations.length === 0) {
        vacContainer.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-muted);">Nenhum período de férias cadastrado.</td></tr>';
      } else {
        vacContainer.innerHTML = vacations.map(v => {
          const prof  = window.dashboardProfessionals?.find(p => p.id === v.profissional_id);
          const start = new Date(v.inicio + 'T00:00:00').toLocaleDateString('pt-BR');
          const end   = new Date(v.fim    + 'T00:00:00').toLocaleDateString('pt-BR');
          return `
            <tr>
              <td>${prof ? prof.nome : 'Médico'}</td>
              <td style="font-size:0.85rem;">${start} → ${end}</td>
              <td>
                <button class="action-btn text-danger" onclick="AdminModule.deleteVacation('${v.id}')" title="Remover">
                  <i class="far fa-trash-alt"></i>
                </button>
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  },

  async deleteBlock(id) {
    if (!confirm('Deseja remover este bloqueio de horário?')) return;
    await window.supabaseClient.from('horarios_bloqueados').delete().eq('id', id);
    window.Notifications?.show('Bloqueio Removido', 'Horário liberado com sucesso.', 'success');
    this.loadBlocksAndVacationsList();
  },

  async deleteVacation(id) {
    if (!confirm('Deseja cancelar o período de férias?')) return;
    await window.supabaseClient.from('ferias').delete().eq('id', id);
    window.Notifications?.show('Férias Removidas', 'Período liberado na agenda.', 'success');
    this.loadBlocksAndVacationsList();
  },

  // ─── ENVIO DE FORMULÁRIOS ───────────────────────────────────────
  setupFormSubmits() {

    // 1. CRIAR Profissional
    const formCreate = document.getElementById('form-create-professional');
    if (formCreate) {
      formCreate.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('btn-create-prof-submit');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; }

        const days = [];
        formCreate.querySelectorAll('.prof-days-checkbox:checked').forEach(cb => days.push(cb.value));

        // Foto: tenta usar URL do upload; fallback para URL manual ou placeholder
        const fotoUrl = document.getElementById('prof-foto')?.value ||
                        'https://ui-avatars.com/api/?name=' + encodeURIComponent(document.getElementById('prof-nome').value) + '&background=2E8B57&color=fff';

        const payload = {
          nome:           document.getElementById('prof-nome').value.trim(),
          especialidade_id: document.getElementById('prof-especialidade').value,
          email:          document.getElementById('prof-email').value.trim(),
          whatsapp:       document.getElementById('prof-whatsapp').value.trim(),
          mini_curriculo: document.getElementById('prof-mini-curriculo').value.trim(),
          foto:           fotoUrl,
          horario_inicio: document.getElementById('prof-inicio').value,
          horario_fim:    document.getElementById('prof-fim').value,
          dias_atendimento: days,
          ativo:          true
        };

        const { error } = await window.supabaseClient.from('profissionais').insert(payload);

        if (error) {
          window.Notifications?.show('Falha ao Criar', error.message, 'error');
        } else {
          window.Notifications?.show('Médico Cadastrado! ✓', 'Profissional inserido com sucesso.', 'success');
          formCreate.reset();
          // Resetar preview e progresso
          const preview = document.getElementById('prof-foto-preview');
          if (preview) { preview.src = ''; preview.style.display = 'none'; }
          const progressDiv = document.getElementById('upload-progress');
          if (progressDiv) progressDiv.style.display = 'none';
          document.getElementById('prof-foto').value = '';

          this.loadProfessionalsList();
          if (window.refreshDashboard) window.refreshDashboard();
        }

        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-check"></i> Cadastrar Médico'; }
      });
    }

    // 2. EDITAR Profissional
    const formEdit = document.getElementById('form-edit-professional');
    if (formEdit) {
      formEdit.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id   = document.getElementById('edit-prof-id').value;
        const days = [];
        formEdit.querySelectorAll('.edit-prof-days-checkbox:checked').forEach(cb => days.push(cb.value));

        const fotoUrl = document.getElementById('edit-prof-foto').value.trim() ||
                        'https://ui-avatars.com/api/?name=' + encodeURIComponent(document.getElementById('edit-prof-nome').value) + '&background=9B59B6&color=fff';

        const payload = {
          nome:             document.getElementById('edit-prof-nome').value.trim(),
          especialidade_id: document.getElementById('edit-prof-especialidade').value,
          email:            document.getElementById('edit-prof-email').value.trim(),
          whatsapp:         document.getElementById('edit-prof-whatsapp').value.trim(),
          mini_curriculo:   document.getElementById('edit-prof-mini-curriculo').value.trim(),
          foto:             fotoUrl,
          horario_inicio:   document.getElementById('edit-prof-inicio').value,
          horario_fim:      document.getElementById('edit-prof-fim').value,
          dias_atendimento: days,
          ativo:            document.getElementById('edit-prof-ativo').checked
        };

        const { error } = await window.supabaseClient.from('profissionais').update(payload).eq('id', id);
        if (error) {
          window.Notifications?.show('Erro ao Atualizar', error.message, 'error');
        } else {
          window.Notifications?.show('Médico Atualizado! ✓', 'Cadastro alterado com sucesso.', 'success');
          document.querySelector('#modal-professionals .edit-form-container').style.display = 'none';
          this.loadProfessionalsList();
          if (window.refreshDashboard) window.refreshDashboard();
        }
      });
    }

    // 3. CRIAR Especialidade
    const formSpec = document.getElementById('form-create-specialty');
    if (formSpec) {
      formSpec.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
          nome:     document.getElementById('spec-nome').value.trim(),
          descricao: document.getElementById('spec-descricao').value.trim(),
          icone:    document.getElementById('spec-icone').value.trim()
        };

        const { error } = await window.supabaseClient.from('especialidades').insert(payload);
        if (error) {
          window.Notifications?.show('Erro ao Criar', error.message, 'error');
        } else {
          window.Notifications?.show('Especialidade Criada! ✓', 'Especialidade adicionada ao painel.', 'success');
          formSpec.reset();
          this.loadSpecialtiesList();
          if (window.refreshDashboard) window.refreshDashboard();
        }
      });
    }

    // 4. CADASTRAR Bloqueio de Horário
    const formBlock = document.getElementById('form-create-block');
    if (formBlock) {
      formBlock.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
          profissional_id: document.getElementById('block-prof-id').value,
          data:            document.getElementById('block-date').value,
          horario_inicio:  document.getElementById('block-start-time').value,
          horario_fim:     document.getElementById('block-end-time').value,
          motivo:          document.getElementById('block-reason').value.trim()
        };

        const { error } = await window.supabaseClient.from('horarios_bloqueados').insert(payload);
        if (error) {
          window.Notifications?.show('Erro ao Bloquear', error.message, 'error');
        } else {
          window.Notifications?.show('Horário Bloqueado! ✓', 'Médico bloqueado no horário escolhido.', 'success');
          formBlock.reset();
          this.loadBlocksAndVacationsList();
        }
      });
    }

    // 5. CADASTRAR Férias
    const formVacation = document.getElementById('form-create-vacation');
    if (formVacation) {
      formVacation.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
          profissional_id: document.getElementById('vacation-prof-id').value,
          inicio:          document.getElementById('vacation-start-date').value,
          fim:             document.getElementById('vacation-end-date').value
        };

        const { error } = await window.supabaseClient.from('ferias').insert(payload);
        if (error) {
          window.Notifications?.show('Erro ao salvar Férias', error.message, 'error');
        } else {
          window.Notifications?.show('Férias Cadastradas! ✓', 'Agenda bloqueada para o período de férias.', 'success');
          formVacation.reset();
          this.loadBlocksAndVacationsList();
        }
      });
    }
  }
};

// ─── INICIALIZAR ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('dashboard-app')) {
    AdminModule.init();
  }
});

// Expor globalmente para os onclick's do HTML
window.AdminModule = AdminModule;
