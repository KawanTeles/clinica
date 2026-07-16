// Configurações do Supabase e do Sistema
//
// SEGURANÇA: as credenciais do Supabase NÃO são hardcoded.
// Em produção, forneça url + anon key via variável global injetada no deploy
// (ex.: Netlify Snippet Injection ou arquivo config.prod.js carregado antes deste).
// Exemplo de injeção (head do site, no Netlify):
//   <script>window.ZOE_SUPABASE = { url: "https://xxxxx.supabase.co", key: "eyJ...anon..." };</script>
// Se ausentes, o sistema roda automaticamente em MODO DEMO.

const ZOE_ENV = window.ZOE_SUPABASE || {};

const CONFIG = {
  // URL do projeto Supabase — vinda de variável de ambiente/deploy (não hardcoded)
  SUPABASE_URL: ZOE_ENV.url || null,

  // Chave pública anônima do Supabase (Anon Key) — vinda de variável de ambiente/deploy
  SUPABASE_KEY: ZOE_ENV.key || null,

  // Modo de demonstração (se true, utiliza banco de dados simulado no LocalStorage)
  // Útil para testar o sistema completo localmente sem precisar configurar o Supabase imediatamente.
  // Será automaticamente ativado caso as chaves acima estejam vazias.
  DEMO_MODE: true,

  // Configurações de Integração de WhatsApp (Exemplos de endpoint)
  WHATSAPP_PROVIDER: ZOE_ENV.whatsapp_provider || 'evolution', // 'evolution' | 'twilio' | 'zapi' | 'cloud_api'
  WHATSAPP_API_URL: ZOE_ENV.whatsapp_api_url || 'https://api.clinicazoe.com/whatsapp',
  WHATSAPP_TOKEN: ZOE_ENV.whatsapp_token || 'zoe-token-dev-2026',

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
}

// Log reflete o modo efetivo (não informa "Conectado" se estiver em DEMO)
if (CONFIG.DEMO_MODE) {
  console.log("%c[Clinica Zoe] Rodando em MODO DEMO.", "color: #ff9800; font-weight: bold; font-size: 12px;");
} else {
  console.log("%c[Clinica Zoe] Conectado ao banco de dados Supabase.", "color: #2e7d32; font-weight: bold; font-size: 12px;");
}

// Exportar globalmente
window.CONFIG = CONFIG;
