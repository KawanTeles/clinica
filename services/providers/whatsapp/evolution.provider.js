export class EvolutionProvider {
  /**
   * Envia uma mensagem usando a Evolution API
   */
  static async sendMessage(config, payload) {
    if (!config.api_url || !config.access_token_encrypted) {
      throw new Error('Evolution API config is missing api_url or access_token.');
    }

    const { api_url, access_token_encrypted, phone_number_id } = config;
    const instanceName = phone_number_id; // Na Evolution, phone_number_id costuma ser o nome da instância

    const endpoint = `${api_url}/message/sendText/${instanceName}`;
    
    // Na vida real, haveria desencriptação de access_token_encrypted no backend.
    const apiKey = access_token_encrypted;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({
          number: payload.to.replace(/\D/g, ''),
          options: {
            delay: 1200,
            presence: 'composing'
          },
          textMessage: {
            text: payload.content
          }
        })
      });
      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        // Prevent leaking tokens in error messages
        throw new Error(`Evolution API Error: ${response.status} ${response.statusText}`);
      }

      return {
        success: true,
        external_message_id: data.key?.id || data.messageId, // Depende da versão da API
        status: 'SENT'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async checkConnection(config) {
    // TODO: Implementar rota de check status da instance
  }

  static async getStatus(config) {
    // TODO: Obter status de bateria/conexão
  }
}
