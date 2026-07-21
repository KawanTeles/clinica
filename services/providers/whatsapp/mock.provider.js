export class MockWhatsAppProvider {
  /**
   * Simula o envio de uma mensagem pelo WhatsApp
   * @param {Object} payload 
   * @param {string} payload.to - Telefone destino
   * @param {string} payload.content - Conteúdo da mensagem
   * @returns {Object} Resultado simulado da API
   */
  static async sendMessage(payload) {
    console.log(`[MOCK WHATSAPP] Enviando mensagem para ${payload.to}...`);
    console.log(`[MOCK WHATSAPP] Conteúdo: "${payload.content}"`);
    
    // Simular delay de rede (500ms)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simular sucesso na maior parte das vezes, falha ocasionalmente se o número for "9999" (exemplo)
    if (payload.to && payload.to.includes('9999')) {
      throw new Error('Falha simulada de envio pelo MockProvider.');
    }

    console.log(`[MOCK WHATSAPP] Mensagem enviada com sucesso.`);
    return {
      success: true,
      message_id: 'mock-' + Date.now(),
      status: 'SENT'
    };
  }
}
