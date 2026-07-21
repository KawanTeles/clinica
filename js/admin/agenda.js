import { AgendaRepository } from '../../repositories/agenda.repository.js';

document.addEventListener('DOMContentLoaded', async () => {
  const profSelect = document.getElementById('agenda_prof_filter');
  const calendarGrid = document.getElementById('calendar-grid');
  let currentProfId = null;
  let currentDate = new Date(); // Start with today

  // Load Professionals for Dropdown
  const loadProfessionals = async () => {
    // Se for RECEPCIONISTA ou ADMIN, carrega todos ativos
    // Se for PROFISSIONAL, carrega apenas a si próprio. O backend RLS cuida da segurança.
    const { data: profs, error } = await AgendaRepository.getProfissionaisAtivos();
    if (!error && profs) {
      profs.forEach(p => profSelect.add(new Option(p.nome, p.id)));
      if (profs.length > 0) {
        currentProfId = profs[0].id;
        document.getElementById('prof_settings_area').style.display = 'block';
        renderCalendar();
      }
    }
  };

  profSelect.addEventListener('change', (e) => {
    currentProfId = e.target.value;
    renderCalendar();
  });

  document.getElementById('btn-prev-week').addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 7);
    renderCalendar();
  });

  document.getElementById('btn-next-week').addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() + 7);
    renderCalendar();
  });

  // Modal Functions
  const modalCons = document.getElementById('modal-consulta');
  document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => {
    modalCons.classList.remove('active');
    document.getElementById('form-consulta').reset();
  }));

  document.getElementById('btn-nova-consulta').addEventListener('click', () => {
    document.getElementById('modal-consulta-title').textContent = 'Agendar Paciente';
    document.getElementById('cons_id').value = '';
    document.getElementById('status-group').style.display = 'none';
    modalCons.classList.add('active');
  });

  // Form Submit
  document.getElementById('form-consulta').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentProfId) return alert('Selecione um profissional primeiro.');

    const btn = document.getElementById('btn-salvar-consulta');
    btn.disabled = true;
    
    const consId = document.getElementById('cons_id').value;
    const data = document.getElementById('cons_data').value;
    const inicio = document.getElementById('cons_inicio').value;
    const fim = document.getElementById('cons_fim').value;
    const status = document.getElementById('cons_status').value || 'agendada';

    try {
      if (consId) {
        // Usa a Função RPC de mudança de status (segura e audita)
        const { error: rpcErr } = await AgendaRepository.atualizarStatus(
          consId,
          status,
          'Status alterado via painel admin'
        );
        if (rpcErr) throw rpcErr;
        window.Toast.success('Agendamento atualizado com sucesso.');
      } else {
        // Insert direto (irá falhar se houver EXCLUDE double booking)
        const { error: insErr } = await AgendaRepository.criarAgendamento({
          professional_id: currentProfId,
          data: data,
          hora_inicio: inicio,
          hora_fim: fim,
          status: 'confirmada'
        });
        if (insErr) {
          if (insErr.message.includes('overlapping') || insErr.code === '23P01') {
            throw new Error('Conflito de Horário! Já existe uma consulta ou bloqueio para este horário.');
          }
          throw insErr;
        }
        window.Toast.success('Consulta agendada com sucesso!');
      }
      modalCons.classList.remove('active');
      renderCalendar();
    } catch (err) {
      window.Toast.error(err.message);
    } finally {
      btn.disabled = false;
    }
  });

  const getStartOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Adjust to Sunday
    return new Date(d.setDate(diff));
  };

  const renderCalendar = async () => {
    if (!currentProfId) return;
    calendarGrid.innerHTML = '';

    const startOfWeek = getStartOfWeek(currentDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    document.getElementById('current-week-label').textContent = 
      `${startOfWeek.toLocaleDateString()} a ${endOfWeek.toLocaleDateString()}`;

    // Buscar consultas dessa semana
    const startStr = startOfWeek.toISOString().split('T')[0];
    const endStr = endOfWeek.toISOString().split('T')[0];
    
    const { data: appointments } = await AgendaRepository.getAgendamentosNaSemana(currentProfId, startStr, endStr);

    // Renderizar Headers (Hora + Dias)
    let headerHTML = '<div class="calendar-header-row"><div class="calendar-header-cell">Hora</div>';
    for (let i=0; i<7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
      headerHTML += `<div class="calendar-header-cell">${dayNames[i]}<br><small>${day.getDate()}/${day.getMonth()+1}</small></div>`;
    }
    headerHTML += '</div>';
    calendarGrid.insertAdjacentHTML('beforeend', headerHTML);

    // Renderizar Linhas (Horas de 08:00 às 18:00)
    for (let h=8; h<=18; h++) {
      const timeStr = `${h.toString().padStart(2, '0')}:00`;
      let rowHTML = `<div class="calendar-time-col"><div class="calendar-time-slot">${timeStr}</div></div>`;
      
      for (let d=0; d<7; d++) {
        rowHTML += `<div class="calendar-day-col"><div class="calendar-cell" data-day="${d}" data-time="${timeStr}"></div></div>`;
      }
      calendarGrid.insertAdjacentHTML('beforeend', rowHTML);
    }

    // Posicionar Agendamentos visualmente
    if (appointments) {
      appointments.forEach(app => {
        if(app.status === 'cancelada') return; // Hide or show with opacity depending on rule
        
        // Match day
        const appDate = new Date(app.data);
        // Correct timezone offset issue natively
        const localDate = new Date(appDate.getTime() + appDate.getTimezoneOffset() * 60000);
        const diffDays = Math.floor((localDate - startOfWeek) / (1000 * 60 * 60 * 24));
        
        if (diffDays >= 0 && diffDays < 7) {
          // Calculate Top and Height based on hours (8:00 = 0px, 9:00 = 60px)
          const [startH, startM] = app.hora_inicio.split(':').map(Number);
          const [endH, endM] = app.hora_fim.split(':').map(Number);
          
          if (startH >= 8 && startH <= 18) {
            const top = ((startH - 8) * 60) + startM;
            const height = ((endH - startH) * 60) + (endM - startM);
            
            // Achar a coluna correta
            // O Grid tem column 1 = Time, Columns 2-8 = Days
            const colIndex = diffDays + 2; 
            
            let badge = '';
            if (app.status === 'aguardando_pagamento') badge = '🟡 Aguardando pag.';
            else if (app.status === 'pago') badge = '🟢 Pago';
            else if (app.status === 'agendada') badge = '🗓️ Agendada';
            else if (app.status === 'em_atendimento') badge = '⚕️ Em Atend.';
            else if (app.status === 'concluida') badge = '✅ Concluída';
            else badge = `🔹 ${app.status.replace('_', ' ')}`;
            
            const card = document.createElement('div');
            card.className = `appointment-card status-${app.status}`;
            card.style.top = `${top}px`;
            card.style.height = `${height}px`;
            card.innerHTML = `<strong>Consulta</strong><br>${app.hora_inicio} - ${app.hora_fim}<br><small>${badge}</small>`;
            
            card.addEventListener('click', (e) => {
              e.stopPropagation();
              editAppointment(app);
            });

            // Injetar na coluna exata
            const col = document.querySelectorAll('.calendar-day-col')[diffDays];
            if(col) col.appendChild(card);
          }
        }
      });
    }
  };

  const editAppointment = (app) => {
    document.getElementById('modal-consulta-title').textContent = 'Detalhes do Agendamento';
    document.getElementById('cons_id').value = app.id;
    document.getElementById('cons_data').value = app.data;
    document.getElementById('cons_inicio').value = app.hora_inicio.slice(0,5);
    document.getElementById('cons_fim').value = app.hora_fim.slice(0,5);
    document.getElementById('cons_status').value = app.status;
    document.getElementById('status-group').style.display = 'block';
    
    const btnPagamento = document.getElementById('btn-abrir-pagamento');
    if (app.status === 'aguardando_pagamento' || app.status === 'em_atendimento') {
      btnPagamento.style.display = 'inline-block';
    } else {
      btnPagamento.style.display = 'none';
    }
    
    modalCons.classList.add('active');
  };

  // Payment Logic
  const modalPagamento = document.getElementById('modal-pagamento');
  document.getElementById('close-pagamento-btn').addEventListener('click', () => {
    modalPagamento.classList.remove('active');
  });

  document.getElementById('btn-abrir-pagamento').addEventListener('click', async () => {
    modalCons.classList.remove('active'); // hide appointment modal
    const appId = document.getElementById('cons_id').value;
    document.getElementById('pag_cons_id').value = appId;
    
    // Na vida real: Buscar financial_document_id vinculado a este appointment_id
    // Como simplificação, pegamos o valor via query ou assumimos.
    document.getElementById('pag_paciente_nome').textContent = 'Paciente Vinculado'; 
    document.getElementById('pag_valor').textContent = 'R$ 180,00'; // Simulação
    
    modalPagamento.classList.add('active');
  });

  document.getElementById('form-pagamento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-confirmar-pagamento');
    btn.disabled = true;
    try {
      const appId = document.getElementById('pag_cons_id').value;
      const forma = document.querySelector('input[name="pag_forma"]:checked').value;
      
      // Update appointment status to 'pago'
      const { error: rpcErr } = await AgendaRepository.atualizarStatus(
          appId,
          'pago',
          `Pagamento recebido via ${forma}`
      );
      if (rpcErr) throw rpcErr;
      
      // (Mock) The DB triggers handles the financial document balance logic based on `payments` table inserts.
      
      window.Toast.success('Pagamento registrado com sucesso!');
      modalPagamento.classList.remove('active');
      renderCalendar();
    } catch (err) {
      alert(err.message);
    } finally {
      btn.disabled = false;
    }
  });

  loadProfessionals();
});
