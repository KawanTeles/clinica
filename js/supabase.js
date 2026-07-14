// Inicialização do Supabase ou Banco de Dados Simulado (Mock)
// Mantém a compatibilidade de chamadas de API do Supabase em ambos os modos

(function () {
  let supabaseClient = null;

  // Carregar o SDK do Supabase se as credenciais existirem
  if (!window.CONFIG.DEMO_MODE) {
    try {
      // O script do Supabase JS é carregado via CDN no HTML
      if (typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(window.CONFIG.SUPABASE_URL, window.CONFIG.SUPABASE_KEY);
      }
    } catch (err) {
      console.error("Falha ao carregar o SDK do Supabase. Alternando para MODO DEMO.", err);
      window.CONFIG.DEMO_MODE = true;
    }
  }

  // --- SEED PARA O MODO DEMO (LOCAL STORAGE) ---
  const MOCK_DATA = {
    especialidades: [
      { id: "e1", nome: "Psicologia", descricao: "Apoio emocional e tratamento de distúrbios comportamentais e mentais.", icone: "fa-brain" },
      { id: "e2", nome: "Nutrição", descricao: "Planos alimentares personalizados para saúde, bem-estar e performance.", icone: "fa-apple-alt" },
      { id: "e3", nome: "Fisioterapia", descricao: "Reabilitação física, alívio de dores corporais e melhora de mobilidade.", icone: "fa-running" },
      { id: "e4", nome: "Pediatria", descricao: "Acompanhamento do desenvolvimento e saúde de crianças e adolescentes.", icone: "fa-child" },
      { id: "e5", nome: "Clínica Geral", descricao: "Consultas preventivas, diagnósticos gerais e encaminhamentos.", icone: "fa-stethoscope" },
      { id: "e6", nome: "Dermatologia", descricao: "Cuidados com a saúde e estética da pele, unhas e cabelos.", icone: "fa-spa" },
      { id: "e7", nome: "Psiquiatria", descricao: "Diagnóstico e tratamento médico de transtornos mentais complexos.", icone: "fa-user-md" },
      { id: "e8", nome: "Odontologia", descricao: "Saúde bucal completa, estética dentária e tratamentos preventivos.", icone: "fa-tooth" },
      { id: "e9", nome: "Fonoaudiologia", descricao: "Prevenção, avaliação e reabilitação da voz, fala e audição.", icone: "fa-volume-up" },
      { id: "e10", nome: "Terapia Ocupacional", descricao: "Auxílio na autonomia e inclusão em atividades do cotidiano.", icone: "fa-hand-holding-heart" }
    ],
    profissionais: [
      {
        id: "p1",
        nome: "Dra. Helena Souza",
        foto: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=400",
        especialidade_id: "e1",
        mini_curriculo: "Psicóloga clínica com mais de 8 anos de experiência, especialista em Terapia Cognitivo-Comportamental (TCC) e inteligência emocional.",
        whatsapp: "5511999999999",
        email: "helena.souza@clinicazoe.com",
        dias_atendimento: ["seg", "ter", "qua", "qui", "sex"],
        horario_inicio: "08:00",
        horario_fim: "18:00",
        ativo: true
      },
      {
        id: "p2",
        nome: "Dr. Lucas Alencar",
        foto: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400",
        especialidade_id: "e2",
        mini_curriculo: "Nutricionista esportivo e funcional focado em emagrecimento saudável, performance física e reeducação alimentar duradoura.",
        whatsapp: "5511988888888",
        email: "lucas.alencar@clinicazoe.com",
        dias_atendimento: ["seg", "qua", "sex"],
        horario_inicio: "09:00",
        horario_fim: "17:00",
        ativo: true
      },
      {
        id: "p3",
        nome: "Dra. Mariana Dias",
        foto: "https://images.unsplash.com/photo-1594824813573-246434de83fb?auto=format&fit=crop&q=80&w=400",
        especialidade_id: "e4",
        mini_curriculo: "Pediatra humanizada, pós-graduada em neonatologia, dedicada aos cuidados da primeira infância e suporte ao aleitamento materno.",
        whatsapp: "5511977777777",
        email: "mariana.dias@clinicazoe.com",
        dias_atendimento: ["ter", "qui", "sab"],
        horario_inicio: "08:00",
        horario_fim: "12:00",
        ativo: true
      },
      {
        id: "p4",
        nome: "Dr. Roberto Silva",
        foto: "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=400",
        especialidade_id: "e5",
        mini_curriculo: "Médico de família e clínico geral experiente. Dedicado a check-ups completos, diagnósticos iniciais e medicina preventiva.",
        whatsapp: "5511966666666",
        email: "roberto.silva@clinicazoe.com",
        dias_atendimento: ["seg", "ter", "qua", "qui", "sex"],
        horario_inicio: "08:00",
        horario_fim: "18:00",
        ativo: true
      }
    ],
    pacientes: [
      { id: "pa1", nome: "Camila Guimarães", telefone: "11977778888", email: "camila@email.com", cpf: "123.456.789-00", data_cadastro: "2026-07-01T10:00:00Z" },
      { id: "pa2", nome: "Thiago Mendes", telefone: "11966665555", email: "thiago@email.com", cpf: "987.654.321-11", data_cadastro: "2026-07-02T14:30:00Z" }
    ],
    agendamentos: [
      { id: "a1", paciente_id: "pa1", profissional_id: "p1", data: "2026-07-15", horario: "09:00", observacoes: "Primeira consulta de terapia.", status: "Confirmado" },
      { id: "a2", paciente_id: "pa2", profissional_id: "p2", data: "2026-07-15", horario: "10:00", observacoes: "Retorno nutricional.", status: "Agendado" }
    ],
    horarios_bloqueados: [
      { id: "hb1", profissional_id: "p1", data: "2026-07-20", horario_inicio: "14:00", horario_fim: "16:00", motivo: "Reunião Clínica" }
    ],
    ferias: [
      { id: "f1", profissional_id: "p3", inicio: "2026-07-25", fim: "2026-08-05" }
    ],
    avaliacoes: [
      { id: "av1", paciente: "Camila Guimarães", nota: 5, comentario: "Atendimento maravilhoso! A Dra. Helena é extremamente atenciosa e o ambiente da clínica transmite muita paz." },
      { id: "av2", paciente: "Thiago Mendes", nota: 5, comentario: "O plano alimentar do Dr. Lucas realmente fez a diferença na minha rotina de treinos. Resultados rápidos e consistentes!" },
      { id: "av3", paciente: "Fernanda Costa", nota: 4, comentario: "Excelente atendimento e profissionais capacitados. O agendamento online é muito prático e rápido." },
      { id: "av4", paciente: "Jonas Santos", nota: 5, comentario: "Dr. Roberto foi muito minucioso no meu check-up. Uma clínica de altíssimo padrão, recomendo fortemente!" }
    ]
  };

  // Inicializar o banco de dados simulado no LocalStorage caso ele não exista
  function initializeMockDb() {
    for (const table in MOCK_DATA) {
      const storageKey = `zoe_${table}`;
      if (!localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, JSON.stringify(MOCK_DATA[table]));
      }
    }

    // Adicionar usuário administrador simulado se não existir
    if (!localStorage.getItem('zoe_admin_user')) {
      localStorage.setItem('zoe_admin_user', JSON.stringify({
        email: 'admin@clinicazoe.com',
        role: 'admin',
        token: 'mock-jwt-admin-token'
      }));
    }
  }

  // Se estiver em modo demo, inicializa o mock
  if (window.CONFIG.DEMO_MODE) {
    initializeMockDb();
  }

  // --- IMPLEMENTAÇÃO DO CLIENTE MOCK (MIMETIZA O COMPORTAMENTO DO SUPABASE SDK) ---
  class MockQueryBuilder {
    constructor(tableName) {
      this.tableName = tableName;
      this.filters = [];
      this.orderCol = null;
      this.orderAscending = true;
      this.dataStore = JSON.parse(localStorage.getItem(`zoe_${tableName}`)) || [];
    }

    select(columns = '*') {
      // Retorna a si mesmo para continuar o encadeamento
      return this;
    }

    eq(column, value) {
      this.filters.push({ column, value, type: 'eq' });
      return this;
    }

    neq(column, value) {
      this.filters.push({ column, value, type: 'neq' });
      return this;
    }

    in(column, valuesArray) {
      this.filters.push({ column, value: valuesArray, type: 'in' });
      return this;
    }

    gte(column, value) {
      this.filters.push({ column, value, type: 'gte' });
      return this;
    }

    lte(column, value) {
      this.filters.push({ column, value, type: 'lte' });
      return this;
    }

    order(column, { ascending = true } = {}) {
      this.orderCol = column;
      this.orderAscending = ascending;
      return this;
    }

    // Executa filtros na memória
    _applyFilters(items) {
      let filtered = [...items];
      for (const filter of this.filters) {
        if (filter.type === 'eq') {
          filtered = filtered.filter(item => item[filter.column] == filter.value);
        } else if (filter.type === 'neq') {
          filtered = filtered.filter(item => item[filter.column] != filter.value);
        } else if (filter.type === 'in') {
          filtered = filtered.filter(item => filter.value.includes(item[filter.column]));
        } else if (filter.type === 'gte') {
          filtered = filtered.filter(item => item[filter.column] >= filter.value);
        } else if (filter.type === 'lte') {
          filtered = filtered.filter(item => item[filter.column] <= filter.value);
        }
      }

      if (this.orderCol) {
        filtered.sort((a, b) => {
          let valA = a[this.orderCol];
          let valB = b[this.orderCol];

          if (typeof valA === 'string') {
            return this.orderAscending 
              ? valA.localeCompare(valB) 
              : valB.localeCompare(valA);
          }
          return this.orderAscending ? valA - valB : valB - valA;
        });
      }

      return filtered;
    }

    async then(resolve, reject) {
      try {
        const result = this._applyFilters(this.dataStore);
        resolve({ data: result, error: null });
      } catch (err) {
        resolve({ data: null, error: err });
      }
    }

    async insert(newData) {
      try {
        const rows = Array.isArray(newData) ? newData : [newData];
        const inserted = [];

        for (const row of rows) {
          const item = { 
            id: row.id || Math.random().toString(36).substr(2, 9), 
            ...row,
            created_at: new Date().toISOString()
          };
          this.dataStore.push(item);
          inserted.push(item);
        }

        localStorage.setItem(`zoe_${this.tableName}`, JSON.stringify(this.dataStore));
        
        // Trigger de Realtime simulado
        window.dispatchEvent(new CustomEvent('supabase_realtime_change', {
          detail: { table: this.tableName, eventType: 'INSERT', new: inserted }
        }));

        return { data: inserted, error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    }

    async update(updateData) {
      try {
        const filteredToUpdate = this._applyFilters(this.dataStore);
        const idsToUpdate = filteredToUpdate.map(item => item.id);

        this.dataStore = this.dataStore.map(item => {
          if (idsToUpdate.includes(item.id)) {
            const updated = { ...item, ...updateData };
            // Realtime event trigger
            window.dispatchEvent(new CustomEvent('supabase_realtime_change', {
              detail: { table: this.tableName, eventType: 'UPDATE', new: updated, old: item }
            }));
            return updated;
          }
          return item;
        });

        localStorage.setItem(`zoe_${this.tableName}`, JSON.stringify(this.dataStore));
        return { data: this.dataStore.filter(item => idsToUpdate.includes(item.id)), error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    }

    async delete() {
      try {
        const filteredToDelete = this._applyFilters(this.dataStore);
        const idsToDelete = filteredToDelete.map(item => item.id);

        this.dataStore = this.dataStore.filter(item => {
          if (idsToDelete.includes(item.id)) {
            window.dispatchEvent(new CustomEvent('supabase_realtime_change', {
              detail: { table: this.tableName, eventType: 'DELETE', old: item }
            }));
            return false;
          }
          return true;
        });

        localStorage.setItem(`zoe_${this.tableName}`, JSON.stringify(this.dataStore));
        return { data: filteredToDelete, error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    }
  }

  // Mock Realtime Channel
  class MockChannel {
    constructor(channelName) {
      this.channelName = channelName;
      this.callbacks = [];
      this.listener = (e) => {
        const { table, eventType, new: newRow, old: oldRow } = e.detail;
        
        // Verifica se a tabela/evento é compatível
        this.callbacks.forEach(cb => {
          if (cb.event === '*' || cb.event === eventType) {
            if (cb.filter.table === table) {
              cb.callback({
                new: newRow,
                old: oldRow,
                eventType: eventType
              });
            }
          }
        });
      };
      
      window.addEventListener('supabase_realtime_change', this.listener);
    }

    on(type, filter, callback) {
      // type can be 'postgres_changes'
      this.callbacks.push({ event: filter.event || '*', filter, callback });
      return this;
    }

    subscribe() {
      console.log(`[Realtime Mock] Subscrito no canal: ${this.channelName}`);
      return this;
    }

    unsubscribe() {
      window.removeEventListener('supabase_realtime_change', this.listener);
      console.log(`[Realtime Mock] Desinscrito do canal: ${this.channelName}`);
    }
  }

  // Objeto Mock Principal do Supabase
  const mockSupabase = {
    from(tableName) {
      return new MockQueryBuilder(tableName);
    },

    channel(channelName) {
      return new MockChannel(channelName);
    },

    auth: {
      async signUp({ email, password, options }) {
        // Mock Cadastro
        let users = JSON.parse(localStorage.getItem('zoe_mock_users') || '[]');
        if (users.some(u => u.email === email)) {
          return { data: null, error: { message: "Usuário já existe" } };
        }

        const newUser = {
          id: Math.random().toString(36).substr(2, 9),
          email,
          role: options?.data?.role || 'patient',
          created_at: new Date().toISOString()
        };

        users.push({ ...newUser, password });
        localStorage.setItem('zoe_mock_users', JSON.stringify(users));

        return { data: { user: newUser, session: { access_token: 'mock-jwt-token-' + newUser.id } }, error: null };
      },

      async signInWithPassword({ email, password }) {
        // Verifica credenciais do admin principal
        const adminStr = localStorage.getItem('zoe_admin_user');
        if (adminStr) {
          const admin = JSON.parse(adminStr);
          if (email === admin.email && password === 'admin123') { // Senha padrão para mock
            localStorage.setItem('zoe_current_session', JSON.stringify(admin));
            return { data: { user: admin, session: admin }, error: null };
          }
        }

        // Verifica profissionais cadastrados para permitir login como profissional
        const profissionais = JSON.parse(localStorage.getItem('zoe_profissionais') || '[]');
        const prof = profissionais.find(p => p.email === email);
        if (prof && password === '123456') { // Senha padrão profissionais
          const session = { email: prof.email, role: 'professional', professional_id: prof.id, token: 'mock-token-' + prof.id };
          localStorage.setItem('zoe_current_session', JSON.stringify(session));
          return { data: { user: session, session }, error: null };
        }

        // Verifica outros usuários
        const users = JSON.parse(localStorage.getItem('zoe_mock_users') || '[]');
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
          const session = { email: user.email, role: user.role, token: 'mock-token-' + user.id };
          localStorage.setItem('zoe_current_session', JSON.stringify(session));
          return { data: { user, session }, error: null };
        }

        return { data: { user: null, session: null }, error: { message: "Credenciais inválidas. Para Admin use: admin@clinicazoe.com / admin123. Para médicos use seu email institucional / 123456." } };
      },

      async getSession() {
        const session = JSON.parse(localStorage.getItem('zoe_current_session'));
        return { data: { session }, error: null };
      },

      async getUser() {
        const session = JSON.parse(localStorage.getItem('zoe_current_session'));
        return { data: { user: session }, error: null };
      },

      async signOut() {
        localStorage.removeItem('zoe_current_session');
        return { error: null };
      },

      onAuthStateChange(callback) {
        // Disparador simples ao carregar a página
        const session = JSON.parse(localStorage.getItem('zoe_current_session'));
        callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);

        // Retorna função de desinscrição
        return {
          data: {
            subscription: {
              unsubscribe() {}
            }
          }
        };
      }
    }
  };

  // Definir na janela global o cliente correto
  window.supabaseClient = window.CONFIG.DEMO_MODE ? mockSupabase : supabaseClient;
})();
