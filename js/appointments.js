// Funil de Agendamento Online da Clínica Zoe

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('booking-funnel')) return;

  // Estado Geral do Fluxo
  const BookingState = {
    specialtyId: null,
    professionalId: null,
    professional: null,
    date: null,
    time: null,
    patientName: '',
    patientEmail: '',
    patientPhone: '',
    patientCpf: '',
    notes: '',
    realtimeChannel: null
  };

  // Referências do DOM
  const stepSpecialty = document.getElementById('step-specialty');
  const stepProfessional = document.getElementById('step-professional');
  const stepCalendar = document.getElementById('step-calendar');
  const stepDetails = document.getElementById('step-details');
  const stepReview = document.getElementById('step-review');

  const listSpecialties = document.getElementById('list-specialties');
  const listProfessionals = document.getElementById('list-professionals');
  const calendarContainer = document.getElementById('calendar-container');
  const slotsGrid = document.getElementById('slots-grid');
  const patientForm = document.getElementById('patient-form');

  const reviewSpecialty = document.getElementById('review-specialty');
  const reviewProfessional = document.getElementById('review-professional');
  const reviewDateTime = document.getElementById('review-datetime');
  const reviewPatient = document.getElementById('review-patient');
  
  const confirmBookingBtn = document.getElementById('confirm-booking-btn');

  // Inicializar o agendamento
  initBooking();

  async function initBooking() {
    setupMasks();
    await loadSpecialties();
    setupBackButtonListeners();
  }

  // Máscaras de entrada (CPF, Telefone)
  function setupMasks() {
    const phoneInput = document.getElementById('patient-phone');
    const cpfInput = document.getElementById('patient-cpf');

    if (phoneInput) {
      phoneInput.addEventListener('input', (e) => {
        let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
        e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
      });
    }

    if (cpfInput) {
      cpfInput.addEventListener('input', (e) => {
        let x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})/);
        e.target.value = !x[2] ? x[1] : x[1] + '.' + x[2] + '.' + x[3] + (x[4] ? '-' + x[4] : '');
      });
    }
  }

  // Passo 1: Carregar Especialidades
  async function loadSpecialties() {
    listSpecialties.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-spin"></i> Carregando especialidades...</div>';
    
    const specialties = await window.Professionals.getSpecialties();
    
    if (specialties.length === 0) {
      listSpecialties.innerHTML = '<p>Erro ao carregar especialidades. Tente novamente.</p>';
      return;
    }

    listSpecialties.innerHTML = specialties.map(spec => `
      <div class="card-specialty scale-hover" data-id="${spec.id}">
        <div class="specialty-icon"><i class="fas ${spec.icone}"></i></div>
        <h3>${spec.nome}</h3>
        <p>${spec.descricao}</p>
      </div>
    `).join('');

    // Listener para seleção de especialidade
    listSpecialties.querySelectorAll('.card-specialty').forEach(card => {
      card.addEventListener('click', () => {
        BookingState.specialtyId = card.getAttribute('data-id');
        goToStep(stepProfessional);
        loadProfessionalsBySpecialty();
      });
    });
  }

  // Passo 2: Carregar Médicos da Especialidade Escolhida
  async function loadProfessionalsBySpecialty() {
    listProfessionals.innerHTML = '<div class="loader"><i class="fas fa-spinner fa-spin"></i> Carregando médicos...</div>';
    
    const allProfs = await window.Professionals.getProfessionals(true);
    const specialties = await window.Professionals.getSpecialties();
    
    const filtered = allProfs.filter(p => p.especialidade_id === BookingState.specialtyId);
    const spec = specialties.find(s => s.id === BookingState.specialtyId);

    if (filtered.length === 0) {
      listProfessionals.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 20px;">
          <p>Desculpe, não há profissionais disponíveis para a especialidade <strong>${spec ? spec.nome : ''}</strong> no momento.</p>
          <button class="btn btn-secondary btn-sm back-to-specialties" style="margin-top: 15px;">Escolher outra especialidade</button>
        </div>
      `;
      listProfessionals.querySelector('.back-to-specialties').addEventListener('click', () => {
        goToStep(stepSpecialty);
      });
      return;
    }

    listProfessionals.innerHTML = filtered.map(prof => `
      <div class="card-doctor scale-hover" data-id="${prof.id}">
        <img src="${prof.foto || 'https://via.placeholder.com/150'}" alt="${prof.nome}" class="doctor-avatar">
        <div class="doctor-details">
          <h3>${prof.nome}</h3>
          <p>${prof.mini_curriculo}</p>
          <span class="doctor-schedule"><i class="far fa-clock"></i> ${prof.horario_inicio} às ${prof.horario_fim}</span>
        </div>
      </div>
    `).join('');

    // Listener para seleção de profissional
    listProfessionals.querySelectorAll('.card-doctor').forEach(card => {
      card.addEventListener('click', async () => {
        BookingState.professionalId = card.getAttribute('data-id');
        BookingState.professional = allProfs.find(p => p.id === BookingState.professionalId);
        
        goToStep(stepCalendar);
        initCalendarModule();
      });
    });
  }

  // Passo 3: Inicializar Módulo de Calendário
  async function initCalendarModule() {
    slotsGrid.innerHTML = '<p class="calendar-hint">Selecione um dia no calendário para ver os horários livres.</p>';
    
    // Iniciar calendário interativo
    await window.AppointmentCalendar.init(
      BookingState.professional,
      'calendar-container',
      'slots-grid',
      (dateStr, timeStr) => {
        BookingState.date = dateStr;
        BookingState.time = timeStr;
        
        // Ativar canal Realtime para evitar double booking
        setupRealtimeBookingCheck();

        // Ir para próximo passo após escolher horário
        setTimeout(() => {
          goToStep(stepDetails);
        }, 300);
      }
    );
  }

  // Ouvinte Realtime Supabase (Prevenção de Duplicidades)
  function setupRealtimeBookingCheck() {
    // Cancela canal anterior se houver
    if (BookingState.realtimeChannel) {
      BookingState.realtimeChannel.unsubscribe();
    }

    // Inicia escuta em tempo real para a tabela 'agendamentos'
    BookingState.realtimeChannel = window.supabaseClient
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agendamentos' },
        (payload) => {
          const newAppt = payload.new;
          
          // Verifica se colidiu com a escolha atual do paciente
          if (
            newAppt.profissional_id === BookingState.professionalId &&
            newAppt.data === BookingState.date &&
            newAppt.horario.substring(0, 5) === BookingState.time
          ) {
            window.Notifications.show(
              'Atenção!', 
              'O horário selecionado acaba de ser reservado por outro paciente. Por favor, escolha outro slot.', 
              'warning',
              6000
            );

            // Reseta horário escolhido e volta para o passo do calendário
            BookingState.time = null;
            goToStep(stepCalendar);
            initCalendarModule();
          }
        }
      )
      .subscribe();
  }

  // Passo 4: Coleta de Detalhes e Validação
  if (patientForm) {
    patientForm.addEventListener('submit', (e) => {
      e.preventDefault();

      BookingState.patientName = document.getElementById('patient-name').value.trim();
      BookingState.patientEmail = document.getElementById('patient-email').value.trim();
      BookingState.patientPhone = document.getElementById('patient-phone').value.trim();
      BookingState.patientCpf = document.getElementById('patient-cpf').value.trim();
      BookingState.notes = document.getElementById('patient-notes').value.trim();

      if (!BookingState.patientName || !BookingState.patientEmail || !BookingState.patientPhone || !BookingState.patientCpf) {
        window.Notifications.show('Campos obrigatórios', 'Por favor preencha todas as informações do paciente.', 'error');
        return;
      }

      // Preparar revisão final
      const formattedDate = new Date(BookingState.date + 'T00:00:00').toLocaleDateString('pt-BR');
      
      reviewSpecialty.innerText = document.querySelector('.card-specialty[data-id="' + BookingState.specialtyId + '"] h3').innerText;
      reviewProfessional.innerText = BookingState.professional.nome;
      reviewDateTime.innerText = `${formattedDate} às ${BookingState.time}`;
      reviewPatient.innerHTML = `
        <strong>Nome:</strong> ${BookingState.patientName}<br>
        <strong>Email:</strong> ${BookingState.patientEmail}<br>
        <strong>CPF:</strong> ${BookingState.patientCpf}<br>
        <strong>Tel:</strong> ${BookingState.patientPhone}
      `;

      goToStep(stepReview);
    });
  }

  // Passo 5: Confirmar Agendamento no Banco de Dados
  if (confirmBookingBtn) {
    confirmBookingBtn.addEventListener('click', async () => {
      confirmBookingBtn.disabled = true;
      confirmBookingBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirmando...';

      try {
        // 1. Verificar/Cadastrar Paciente
        let pacienteId = null;

        // Tentar ver se o paciente com o CPF já existe
        const { data: existingPatients, error: errPatientCheck } = await window.supabaseClient
          .from('pacientes')
          .select('id')
          .eq('cpf', BookingState.patientCpf);

        if (errPatientCheck) throw errPatientCheck;

        if (existingPatients && existingPatients.length > 0) {
          pacienteId = existingPatients[0].id;
        } else {
          // Criar novo paciente
          const { data: newPatient, error: errPatientCreate } = await window.supabaseClient
            .from('pacientes')
            .insert({
              nome: BookingState.patientName,
              email: BookingState.patientEmail,
              telefone: BookingState.patientPhone,
              cpf: BookingState.patientCpf
            });

          if (errPatientCreate) throw errPatientCreate;
          
          // Buscar ID do paciente recém criado
          const { data: searchNew } = await window.supabaseClient
            .from('pacientes')
            .select('id')
            .eq('cpf', BookingState.patientCpf);
            
          pacienteId = searchNew[0].id;
        }

        // 2. Tentar Inserir o Agendamento
        const { data: newAppt, error: errBooking } = await window.supabaseClient
          .from('agendamentos')
          .insert({
            paciente_id: pacienteId,
            profissional_id: BookingState.professionalId,
            data: BookingState.date,
            horario: BookingState.time,
            observacoes: BookingState.notes,
            status: 'Agendado'
          });

        if (errBooking) {
          // Se for erro de constraint única (duplicidade)
          if (errBooking.message.includes('unique_profissional_data_horario') || errBooking.code === '23505') {
            throw new Error("Este horário acabou de ser preenchido por outro usuário. Escolha outra hora.");
          }
          throw errBooking;
        }

        // 3. Sucesso! Disparar notificações e WhatsApp
        window.Notifications.show('Agendamento Confirmado!', 'Seu agendamento foi salvo com sucesso.', 'success');
        
        // Buscar agendamento inserido (para envio do WhatsApp)
        const apptObj = { data: BookingState.date, horario: BookingState.time, observacoes: BookingState.notes };
        const patientObj = { nome: BookingState.patientName, telefone: BookingState.patientPhone };
        
        const wpLink = await window.Notifications.sendWhatsAppNotification(apptObj, patientObj, BookingState.professional);

        // Desinscrever canal Realtime
        if (BookingState.realtimeChannel) {
          BookingState.realtimeChannel.unsubscribe();
        }

        // Mostrar tela de sucesso
        showSuccessScreen(wpLink);

      } catch (err) {
        console.error("Erro no fluxo de confirmação do agendamento:", err);
        window.Notifications.show('Falha no Agendamento', err.message, 'error');
        confirmBookingBtn.disabled = false;
        confirmBookingBtn.innerHTML = '<i class="far fa-check-circle"></i> Confirmar Agendamento';
      }
    });
  }

  // Helpers de Navegação do Funil
  function goToStep(targetStep) {
    const steps = [stepSpecialty, stepProfessional, stepCalendar, stepDetails, stepReview];
    
    // Animação de transição suave
    steps.forEach(step => {
      if (step) {
        step.classList.remove('active');
        step.style.display = 'none';
      }
    });

    if (targetStep) {
      targetStep.style.display = 'block';
      setTimeout(() => {
        targetStep.classList.add('active');
      }, 50);
    }

    // Scroll para o topo do widget
    document.getElementById('booking-funnel').scrollIntoView({ behavior: 'smooth' });
  }

  function setupBackButtonListeners() {
    document.querySelectorAll('.back-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const currentId = btn.closest('.funnel-step').id;
        
        if (currentId === 'step-professional') goToStep(stepSpecialty);
        if (currentId === 'step-calendar') goToStep(stepProfessional);
        if (currentId === 'step-details') {
          // Se voltar cancela o listener realtime
          if (BookingState.realtimeChannel) {
            BookingState.realtimeChannel.unsubscribe();
          }
          goToStep(stepCalendar);
        }
        if (currentId === 'step-review') goToStep(stepDetails);
      });
    });
  }

  function showSuccessScreen(whatsappLink) {
    const bookingWidget = document.getElementById('booking-funnel');
    bookingWidget.className = 'booking-success-container fade-slide-in';
    bookingWidget.innerHTML = `
      <div class="success-icon"><i class="fas fa-calendar-check"></i></div>
      <h2>Agendamento Concluído!</h2>
      <p class="success-desc">O agendamento para a Clínica Zoe foi finalizado com sucesso. Enviamos uma confirmação para o profissional de saúde.</p>
      
      <div class="success-actions">
        <a href="${whatsappLink}" target="_blank" class="btn btn-primary whatsapp-confirm-btn"><i class="fab fa-whatsapp"></i> Confirmar via WhatsApp</a>
        <a href="../index.html" class="btn btn-secondary"><i class="fas fa-home"></i> Voltar à Página Inicial</a>
      </div>
    `;
  }
});
