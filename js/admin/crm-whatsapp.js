import { AuthRepository } from '../../repositories/auth.repository.js';
import { CrmWhatsappRepository } from '../../repositories/crm-whatsapp.repository.js';

document.addEventListener('DOMContentLoaded', async () => {
  let clinicId = null;
  let currentIntegrationId = null;

  try {
    const { data: { session } } = await AuthRepository.getSession();
    if (!session) return; 

    const profileRes = await AuthRepository.getPerfilUsuario(session.user.id);
    clinicId = profileRes.data.clinic_id;

    setupEvents();
    await loadIntegration(clinicId);
    await loadStats(clinicId);
  } catch (err) {
    console.error('Erro de inicialização:', err);
  }

  function setupEvents() {
    const providerSelect = document.getElementById('wa-provider');
    const fieldsMock = document.getElementById('fields-mock');
    const fieldsEvolution = document.getElementById('fields-evolution');
    const fieldsCloud = document.getElementById('fields-cloud');

    providerSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      fieldsMock.style.display = val === 'MOCK' ? 'block' : 'none';
      fieldsEvolution.style.display = val === 'EVOLUTION' ? 'block' : 'none';
      fieldsCloud.style.display = val === 'CLOUD_API' ? 'block' : 'none';
    });

    const form = document.getElementById('wa-config-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveConfig();
    });

    const testBtn = document.getElementById('btn-test-connection');
    testBtn.addEventListener('click', async () => {
      await testConnection();
    });
  }

  async function loadIntegration(clinicId) {
    try {
      const integration = await CrmWhatsappRepository.getIntegration(clinicId);
      
      const statProvider = document.getElementById('stat-provider');
      const statStatus = document.getElementById('stat-status');
      const statusIcon = document.getElementById('status-icon');

      if (!integration) {
        statProvider.textContent = 'Nenhum';
        statStatus.textContent = 'Desconectado';
        statusIcon.className = 'stat-icon danger';
        return;
      }

      currentIntegrationId = integration.id;
      
      // Preencher Formulário
      document.getElementById('wa-provider').value = integration.provider;
      document.getElementById('wa-provider').dispatchEvent(new Event('change'));

      if (integration.provider === 'EVOLUTION') {
        document.getElementById('evo-api-url').value = integration.api_url || '';
        document.getElementById('evo-instance').value = integration.phone_number_id || '';
        document.getElementById('evo-apikey').value = integration.access_token_encrypted || '';
      } else if (integration.provider === 'CLOUD_API') {
        document.getElementById('cloud-phone-id').value = integration.phone_number_id || '';
        document.getElementById('cloud-token').value = integration.access_token_encrypted || '';
        document.getElementById('cloud-webhook-secret').value = integration.webhook_secret || '';
      }

      // Atualizar UI
      statProvider.textContent = integration.provider;
      if (integration.active) {
        statStatus.textContent = 'Conectado (Ativo)';
        statusIcon.className = 'stat-icon success';
      } else {
        statStatus.textContent = 'Pausado';
        statusIcon.className = 'stat-icon primary';
      }

    } catch (err) {
      console.error('Erro ao carregar integração:', err);
    }
  }

  async function loadStats(clinicId) {
    try {
      const stats = await CrmWhatsappRepository.getMessageStats(clinicId);
      const statLastMsg = document.getElementById('stat-last-msg');
      
      if (stats.lastMessage) {
        const dateStr = new Date(stats.lastMessage.created_at).toLocaleString('pt-BR');
        statLastMsg.textContent = `${stats.lastMessage.status} (${dateStr})`;
      } else {
        statLastMsg.textContent = 'Nenhum envio';
      }
    } catch (err) {
      console.error('Erro ao carregar stats:', err);
    }
  }

  async function saveConfig() {
    const provider = document.getElementById('wa-provider').value;
    if (!provider) return alert('Selecione um provedor.');

    const payload = {
      clinic_id: clinicId,
      provider: provider,
      active: true
    };

    if (provider === 'EVOLUTION') {
      payload.api_url = document.getElementById('evo-api-url').value;
      payload.phone_number_id = document.getElementById('evo-instance').value;
      payload.access_token_encrypted = document.getElementById('evo-apikey').value;
    } else if (provider === 'CLOUD_API') {
      payload.phone_number_id = document.getElementById('cloud-phone-id').value;
      payload.access_token_encrypted = document.getElementById('cloud-token').value;
      payload.webhook_secret = document.getElementById('cloud-webhook-secret').value;
    }

    try {
      const btn = document.querySelector('#wa-config-form button[type="submit"]');
      btn.textContent = 'Salvando...';
      btn.disabled = true;

      const saved = await CrmWhatsappRepository.saveIntegration(payload);
      currentIntegrationId = saved.id;
      
      alert('Configuração salva com sucesso!');
      await loadIntegration(clinicId);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar configuração.');
    } finally {
      const btn = document.querySelector('#wa-config-form button[type="submit"]');
      btn.textContent = 'Salvar Integração';
      btn.disabled = false;
    }
  }

  async function testConnection() {
    const provider = document.getElementById('wa-provider').value;
    if (!provider) return alert('Selecione um provedor antes de testar.');

    const config = {};
    if (provider === 'EVOLUTION') {
      config.api_url = document.getElementById('evo-api-url').value;
      config.access_token_encrypted = document.getElementById('evo-apikey').value;
    }

    const testBtn = document.getElementById('btn-test-connection');
    const resultDiv = document.getElementById('test-result');
    
    testBtn.disabled = true;
    testBtn.textContent = 'Testando...';
    resultDiv.style.display = 'none';
    resultDiv.className = 'test-result';

    try {
      const result = await CrmWhatsappRepository.testConnection(provider, config);
      
      resultDiv.style.display = 'block';
      if (result.success) {
        resultDiv.textContent = `✅ Sucesso: ${result.message}`;
        resultDiv.classList.add('success');
      } else {
        resultDiv.textContent = `❌ Falha: ${result.message}`;
        resultDiv.classList.add('error');
      }
    } catch (err) {
      resultDiv.style.display = 'block';
      resultDiv.textContent = `❌ Erro de requisição: ${err.message}`;
      resultDiv.classList.add('error');
    } finally {
      testBtn.disabled = false;
      testBtn.textContent = 'Testar Conexão';
    }
  }
});
