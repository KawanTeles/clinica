export class CloudApiProvider {
  /**
   * Envia mensagem usando a API oficial Cloud do WhatsApp
   */
  static async sendMessage(config, payload) {
    if (!config.phone_number_id || !config.access_token_encrypted) {
      throw new Error('Cloud API config is missing phone_number_id or access_token.');
    }

    const { phone_number_id, access_token_encrypted } = config;
    const version = 'v17.0'; // ou similar da Meta
    const endpoint = `https://graph.facebook.com/${version}/${phone_number_id}/messages`;
    
    const token = access_token_encrypted; // No backend real, decriptar.

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: payload.to.replace(/\D/g, ''), // cloud API exige números limpos com código do país
          type: 'text',
          text: {
            preview_url: false,
            body: payload.content
          }
        })
      });
      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(`Cloud API Error: ${response.status} ${response.statusText}`);
      }

      return {
        success: true,
        external_message_id: data.messages && data.messages.length > 0 ? data.messages[0].id : null,
        status: 'SENT'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async getMessageStatus(config, externalMessageId) {
    // Cloud API envia o status via webhook. Geralmente não precisamos fazer poll.
  }
}
