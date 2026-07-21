/**
 * repositories/agenda.repository.js
 * Apenas acesso aos dados da Agenda. Nenhuma regra de negócio.
 */
import { supabase } from '../js/admin/supabase-client.js';

export class AgendaRepository {
    static async getProfissionaisAtivos() {
        return await supabase
            .from('professionals')
            .select('id, nome, horarios_atendimento, dias_disponiveis')
            .eq('ativo', true);
    }

    static async getPacientes() {
        return await supabase
            .from('patients')
            .select('id, nome, cpf')
            .order('nome', { ascending: true });
    }

    static async getAgendamentosNaSemana(profissionalId, dataInicio, dataFim) {
        let query = supabase
            .from('appointments')
            .select('*, patients(nome), professionals(nome)')
            .gte('data', dataInicio)
            .lte('data', dataFim);

        if (profissionalId) {
            query = query.eq('professional_id', profissionalId);
        }

        return await query;
    }

    static async getConsultasParaLembrete24h() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        // Buscar consultas de amanhã que estão agendadas/confirmadas
        // Em um sistema real pesado, faríamos a junção via RPC para excluir as que já tem evento.
        // Como estamos num supabase-js limpo, buscamos e filtramos no backend.
        const { data, error } = await supabase
            .from('appointments')
            .select('*, professionals(nome)')
            .eq('data', tomorrowStr)
            .in('status', ['solicitada', 'aguardando_aprovacao', 'confirmada', 'Agendado', 'agendado', 'pendente', 'Pendente']);
            
        if (error) throw error;
        return data || [];
    }

    static async getProximaConsulta(patientId, clinicId) {
        const { data, error } = await supabase
            .from('appointments')
            .select('*')
            .eq('patient_id', patientId)
            .eq('clinic_id', clinicId)
            .in('status', ['Agendado', 'agendado', 'pendente', 'Pendente'])
            .gte('data', new Date().toISOString().split('T')[0])
            .order('data', { ascending: true })
            .order('hora_inicio', { ascending: true })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    static async atualizarStatus(appointmentId, novoStatus, observacao = '') {
        const { data, error } = await supabase.rpc('update_appointment_status', {
            p_appointment_id: appointmentId,
            p_new_status: novoStatus,
            p_observacao: observacao
        });

        if (error) throw error;

        // Se o status foi alterado para concluída, gerar evento pós-atendimento
        if (novoStatus.toLowerCase() === 'concluida' || novoStatus.toLowerCase() === 'concluída') {
            try {
                // Obter dados da consulta para o payload
                const { data: appt } = await supabase
                    .from('appointments')
                    .select('patient_id, professional_id, clinic_id')
                    .eq('id', appointmentId)
                    .single();

                if (appt) {
                    // Inserir registro pendente no crm_feedbacks e gerar evento
                    // A inserção do crm_feedbacks não foi explicitada no fluxo APPOINTMENT_COMPLETED (pois pode ser gerado no recebimento ou antes).
                    // Para rastrear qual appointment está pendente de feedback, é bom ter um registro PENDING ou criar no webhook.
                    // A regra pede para salvar rating no webhook. Podemos criar PENDING agora ou apenas registrar o evento e o webhook cria o feedback. O prompt diz:
                    // Criar evento APPOINTMENT_COMPLETED com payload. O event -> job -> worker envia a msg. O webhook recebe nota -> atualiza ou insere crm_feedbacks.
                    // Vamos criar o registro inicial PENDING na tabela crm_feedbacks aqui, para cruzar o appointment_id quando a nota chegar.
                    
                    const { data: feedbackData } = await supabase
                        .from('crm_feedbacks')
                        .insert({
                            clinic_id: appt.clinic_id,
                            patient_id: appt.patient_id,
                            appointment_id: appointmentId,
                            status: 'PENDING'
                        })
                        .select()
                        .single();

                    await supabase.from('crm_events').insert({
                        clinic_id: appt.clinic_id,
                        event_type: 'APPOINTMENT_COMPLETED',
                        patient_id: appt.patient_id,
                        payload: {
                            appointment_id: appointmentId,
                            professional_id: appt.professional_id,
                            completed_at: new Date().toISOString(),
                            feedback_id: feedbackData?.id
                        }
                    });
                }
            } catch (err) {
                console.error('Erro ao gerar evento pós-consulta:', err);
            }
        }

        return { data, error };
    }

    static async criarAgendamento(payload) {
        // 1. Criar a consulta
        const { data, error } = await supabase
            .from('appointments')
            .insert(payload)
            .select()
            .single();

        if (error) throw error;

        // 2. Gerar evento no CRM para a esteira de automações
        try {
            // Obter nome do profissional
            let professionalName = 'Profissional';
            if (payload.professional_id) {
                const { data: prof } = await supabase
                    .from('professionals')
                    .select('nome')
                    .eq('id', payload.professional_id)
                    .single();
                if (prof) professionalName = prof.nome;
            }

            // Formatar data (YYYY-MM-DD para DD/MM/YYYY se necessário, ou mandar cru)
            // Mandando cru (YYYY-MM-DD), o Worker formata. Ou formatamos no JS.

            await supabase.from('crm_events').insert({
                clinic_id: payload.clinic_id,
                event_type: 'APPOINTMENT_CREATED',
                patient_id: payload.patient_id,
                payload: {
                    appointment_id: data.id,
                    professional_id: payload.professional_id,
                    professional_name: professionalName,
                    date: payload.data,
                    time: payload.hora_inicio
                }
            });
        } catch (eventErr) {
            console.error('Falha ao gerar evento CRM para agendamento:', eventErr);
            // Non-blocking error.
        }

        return { data, error: null };
    }

    // Novos métodos solicitados pela Etapa 5
    static async getAppointments(dataInicio, dataFim) {
        return await supabase
            .from('appointments')
            .select('*, patients(nome, cpf, telefone), professionals(nome)')
            .gte('data', dataInicio)
            .lte('data', dataFim);
    }

    static async getAppointmentsByProfessional(profissionalId, dataInicio, dataFim) {
        return await supabase
            .from('appointments')
            .select('*, patients(nome, cpf, telefone), professionals(nome)')
            .eq('professional_id', profissionalId)
            .gte('data', dataInicio)
            .lte('data', dataFim);
    }

    static async createAppointment(payload) {
        // 1. Inserir a consulta
        const { data: appData, error: appError } = await supabase
            .from('appointments')
            .insert(payload)
            .select()
            .single();

        if (appError) return { data: null, error: appError };

        // 2. Integração Financeira Automática (Etapa 6 Financeiro)
        // Ao criar a consulta, geramos a fatura ABERTA baseada no valor do profissional.
        try {
            if (payload.professional_id) {
                const { data: prof } = await supabase
                    .from('professionals')
                    .select('valor_avista')
                    .eq('id', payload.professional_id)
                    .single();

                const valorConsulta = prof ? parseFloat(prof.valor_avista || 0) : 0;
                
                if (valorConsulta > 0) {
                    await supabase.from('financial_documents').insert({
                        clinic_id: payload.clinic_id,
                        patient_id: payload.patient_id,
                        appointment_id: appData.id,
                        tipo: 'RECEITA',
                        status: 'ABERTO',
                        valor_total: valorConsulta,
                        saldo_devedor: valorConsulta,
                        data_emissao: new Date().toISOString().split('T')[0],
                        data_vencimento: payload.data
                    });
                }
            }
        } catch (finErr) {
            console.error('Falha ao gerar financeiro para agenda:', finErr);
            // Non-blocking
        }

        return { data: appData, error: null };
    }

    static async updateAppointment(appointmentId, payload) {
        return await supabase.from('appointments').update(payload).eq('id', appointmentId).select().single();
    }

    static async cancelAppointment(appointmentId, observacao) {
        return await this.atualizarStatus(appointmentId, 'cancelada', observacao);
    }

    static async getAvailableSlots(profissionalId, dateStr) {
        // Mock ou lógica simples para retornar horários disponíveis
        // Como o banco tem exclude constraint, a forma mais simples de verificar
        // a disponibilidade real de um dia é cruzar a tabela de `schedules` e `appointments`.
        // Para simplificar, pode-se implementar no frontend ou via uma RPC.
        // Aqui simularemos um array estático ou chamaremos uma RPC futura.
        return { data: [], error: null };
    }
}
