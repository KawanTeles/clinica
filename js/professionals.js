// Lógica para carregamento de Especialidades e Profissionais - Clínica Zoe

const Professionals = {
  // Busca todas as especialidades ativas
  async getSpecialties() {
    try {
      const { data, error } = await window.supabaseClient
        .from('especialidades')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Erro ao buscar especialidades:", err);
      return [];
    }
  },

  // Busca profissionais (e opcionalmente filtra por especialidade ou status ativo)
  async getProfessionals(activeOnly = true) {
    try {
      let query = window.supabaseClient.from('profissionais').select('*');
      
      if (activeOnly) {
        query = query.eq('ativo', true);
      }

      const { data, error } = await query.order('nome', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Erro ao buscar profissionais:", err);
      return [];
    }
  },

  // Retorna os dados completos de um único profissional
  async getProfessionalById(id) {
    try {
      const { data, error } = await window.supabaseClient
        .from('profissionais')
        .select('*')
        .eq('id', id);

      if (error) throw error;
      return data && data.length > 0 ? data[0] : null;
    } catch (err) {
      console.error(`Erro ao buscar profissional ${id}:`, err);
      return null;
    }
  },

  // Renderiza a lista de profissionais na página de Profissionais (com busca e filtros)
  renderList(professionals, specialties, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (professionals.length === 0) {
      container.innerHTML = `
        <div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
          <i class="fas fa-search" style="font-size: 2.5rem; margin-bottom: 16px;"></i>
          <p>Nenhum profissional encontrado com os filtros selecionados.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = professionals.map(prof => {
      // Encontra a especialidade correspondente
      const spec = specialties.find(s => s.id === prof.especialidade_id);
      const specName = spec ? spec.nome : 'Geral';
      
      // Traduz os dias de atendimento
      const translatedDays = prof.dias_atendimento.map(d => {
        const mapping = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', dom: 'Dom' };
        return mapping[d.toLowerCase()] || d;
      }).join(', ');

      return `
        <div class="card-professional fade-slide-in scale-hover" data-id="${prof.id}" data-aos="fade-up">
          <div class="prof-image-container">
            <img src="${prof.foto || 'https://via.placeholder.com/150'}" alt="${prof.nome}" class="prof-img">
          </div>
          <div class="prof-info">
            <span class="prof-specialty-badge"><i class="fas fa-stethoscope"></i> ${specName}</span>
            <h3 class="prof-name">${prof.nome}</h3>
            <p class="prof-curriculum">${prof.mini_curriculo}</p>
            <div class="prof-details">
              <div class="prof-detail-item">
                <i class="far fa-calendar-alt"></i>
                <span>Atendimento: ${translatedDays}</span>
              </div>
              <div class="prof-detail-item">
                <i class="far fa-clock"></i>
                <span>Horário: ${prof.horario_inicio} às ${prof.horario_fim}</span>
              </div>
            </div>
            <div class="prof-actions">
              <a href="agendamento.html?prof=${prof.id}" class="btn btn-primary btn-sm"><i class="far fa-calendar-check"></i> Agendar</a>
              <a href="https://api.whatsapp.com/send?phone=${prof.whatsapp}&text=Olá%20Doutor(a)%20gostaria%20de%20tirar%20uma%20dúvida." target="_blank" class="btn btn-secondary btn-sm"><i class="fab fa-whatsapp"></i> WhatsApp</a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
};

// Executa filtros de busca na página de profissionais
document.addEventListener('DOMContentLoaded', async () => {
  const containerId = 'profissionais-grid';
  if (!document.getElementById(containerId)) return;

  // Carregar dados iniciais
  const specialties = await Professionals.getSpecialties();
  const allProfessionals = await Professionals.getProfessionals(true);

  // Preencher Select de Especialidades se existir
  const filterSpecialty = document.getElementById('filter-specialty');
  if (filterSpecialty) {
    filterSpecialty.innerHTML = '<option value="">Todas as Especialidades</option>' + 
      specialties.map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
  }

  // Render inicial
  Professionals.renderList(allProfessionals, specialties, containerId);

  // Listener para busca e filtros
  const searchInput = document.getElementById('search-professional');
  const specialtyFilter = document.getElementById('filter-specialty');

  function applyFilters() {
    let filtered = [...allProfessionals];

    if (searchInput && searchInput.value) {
      const searchVal = searchInput.value.toLowerCase();
      filtered = filtered.filter(p => p.nome.toLowerCase().includes(searchVal) || p.mini_curriculo.toLowerCase().includes(searchVal));
    }

    if (specialtyFilter && specialtyFilter.value) {
      const specId = specialtyFilter.value;
      filtered = filtered.filter(p => p.especialidade_id === specId);
    }

    Professionals.renderList(filtered, specialties, containerId);
  }

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (specialtyFilter) specialtyFilter.addEventListener('change', applyFilters);
});

window.Professionals = Professionals;
