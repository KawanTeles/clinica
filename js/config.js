// Configurações do Supabase e do Sistema
// Altere estas credenciais quando criar o seu projeto no Supabase

const CONFIG = {
  // URL do seu projeto Supabase (ex: https://xxxx.supabase.co)
  SUPABASE_URL: '',
  
  // Chave pública anônima do Supabase (Anon Key)
  SUPABASE_KEY: '',
  
  // Modo de demonstração (se true, utiliza banco de dados simulado no LocalStorage)
  // Útil para testar o sistema completo localmente sem precisar configurar o Supabase imediatamente.
  // Será automaticamente ativado caso as chaves acima estejam vazias.
  DEMO_MODE: true,

  // Configurações de Integração de WhatsApp (Exemplos de endpoint)
  WHATSAPP_PROVIDER: 'evolution', // 'evolution' | 'twilio' | 'zapi' | 'cloud_api'
  WHATSAPP_API_URL: 'https://api.clinicazoe.com/whatsapp',
  WHATSAPP_TOKEN: 'zoe-token-dev-2026',

  // Configuração Geral da Clínica
  CLINICA_NAME: 'Clínica Zoe',
  CLINICA_WHATSAPP: '5511999999999',
  CLINICA_EMAIL: 'contato@clinicazoe.com',
  CLINICA_ENDERECO: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
  CLINICA_GOOGLE_MAPS_LINK: 'https://goo.gl/maps/ZoeClinicExample',
  CLINICA_MAPS_EMBED: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3657.197587000854!2d-46.65463768502224!3d-23.5613496846819!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce59c8da0aa315%3A0xd59f9431f2c9776a!2sAv.%20Paulista%2C%20S%C3%A3o%20Paulo%20-%20SP!5e0!3m2!1spt-BR!2sbr!4v1650000000000!5m2!1spt-BR!2sbr'
};

// Detecção automática de DEMO_MODE caso as chaves estejam em branco
if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
  CONFIG.DEMO_MODE = true;
  console.log("%c[Clinica Zoe] Rodando em MODO DEMO. Conecte ao Supabase no arquivo js/config.js", "color: #ff9800; font-weight: bold; font-size: 12px;");
} else {
  CONFIG.DEMO_MODE = false;
  console.log("%c[Clinica Zoe] Conectado ao banco de dados Supabase.", "color: #2e7d32; font-weight: bold; font-size: 12px;");
}

// Exportar globalmente
window.CONFIG = CONFIG;
