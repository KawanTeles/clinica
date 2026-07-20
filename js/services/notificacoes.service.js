import { supabase } from '../supabase.js';
import { SessionService } from '../session.service.js';

export class NotificacoesService {
  
  /**
   * Enfileira uma nova mensagem para envio (Notification Engine)
   */
  static async enqueueMessage(payload) {
    const session = SessionService.getSession();
    
    // 1. Verificar Consentimento (Se for para paciente)
    if (payload.paciente_id) {
      const { data: consent } = await supabase
        .from('pacientes_consentimento')
        .select('aceita_whatsapp')
        .eq('paciente_id', payload.paciente_id)
        .single();
        
      if (consent && !consent.aceita_whatsapp && payload.canal === 'WHATSAPP') {
        console.warn(`[NOTIFICACOES] Envio bloqueado: Paciente ${payload.paciente_id} não aceita WhatsApp (LGPD).`);
        return null;
      }
    }

    // 2. Busca Template
    const { data: template } = await supabase
      .from('notificacoes_templates')
      .select('conteudo')
      .eq('clinica_id', session.clinica.id)
      .eq('nome', payload.template_nome)
      .eq('canal', payload.canal || 'WHATSAPP')
      .single();

    let conteudo = template ? template.conteudo : payload.fallback_conteudo || 'Nova Notificação';
    
    // Preenche Variáveis
    if (payload.variaveis) {
      for (const [key, value] of Object.entries(payload.variaveis)) {
        conteudo = conteudo.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
    }

    // 3. Enfileirar no Banco
    const { data, error } = await supabase
      .from('notificacoes_fila')
      .insert({
        clinica_id: session.clinica.id,
        paciente_id: payload.paciente_id || null,
        profissional_id: payload.profissional_id || null,
        consulta_id: payload.consulta_id || null,
        canal: payload.canal || 'WHATSAPP',
        template_nome: payload.template_nome,
        destinatario: payload.destinatario,
        conteudo: conteudo,
        status: 'PENDENTE'
      }).select().single();

    if (error) throw error;
    
    console.log(`[NOTIFICACOES] Mensagem enfileirada ID: ${data.id}`);
    
    // Aciona processamento assíncrono abstraído
    this.triggerMockProcessWorker();

    return data;
  }

  /**
   * Worker Assíncrono Mockado (Em produção rodaria via Edge Function / CronJob)
   */
  static async triggerMockProcessWorker() {
    setTimeout(async () => {
      // Puxa 10 mensagens pendentes
      const { data: pendentes } = await supabase
        .from('notificacoes_fila')
        .select('*')
        .eq('status', 'PENDENTE')
        .limit(10);
        
      if (!pendentes || pendentes.length === 0) return;
      
      for (const msg of pendentes) {
        // Marca como ENVIANDO
        await supabase.from('notificacoes_fila').update({ status: 'ENVIANDO' }).eq('id', msg.id);
        
        try {
          // Provider Adapter (Mock) - Chamada para Evolution API / Twilio
          const success = await this._mockProviderAdapter(msg);
          
          if (success) {
            await supabase.from('notificacoes_fila').update({ 
              status: 'ENVIADA',
              provedor_usado: 'mock_meta_cloud'
            }).eq('id', msg.id);
            console.log(`[NOTIFICACOES] Sucesso ao enviar ID: ${msg.id}`);
          } else {
            throw new Error('Falha de conexão com provedor');
          }
        } catch (e) {
          // Lógica de Retry
          const novasTentativas = msg.tentativas + 1;
          const statusFinal = novasTentativas >= msg.max_tentativas ? 'FALHA' : 'PENDENTE';
          
          await supabase.from('notificacoes_fila').update({ 
            status: statusFinal,
            tentativas: novasTentativas,
            erro_mensagem: e.message
          }).eq('id', msg.id);
          
          console.error(`[NOTIFICACOES] Erro ao enviar ID: ${msg.id}. Tentativa ${novasTentativas}`);
        }
      }
    }, 2000);
  }

  static async _mockProviderAdapter(msg) {
    // Simula tempo de rede e 10% de chance de erro
    return new Promise((resolve) => {
      setTimeout(() => {
        const errorChance = Math.random() < 0.1; 
        resolve(!errorChance);
      }, 800);
    });
  }

  /**
   * Retorna histórico / painel
   */
  static async getQueueStatus() {
    const session = SessionService.getSession();
    const { data, error } = await supabase
      .from('notificacoes_fila')
      .select('id, destinatario, status, tentativas, canal, criado_em, atualizado_em, conteudo')
      .eq('clinica_id', session.clinica.id)
      .order('criado_em', { ascending: false })
      .limit(50);
      
    if (error) throw error;
    return data;
  }
}
