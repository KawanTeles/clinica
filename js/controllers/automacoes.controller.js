import { AutomacoesService } from '../services/automacoes.service.js';
import { PermissionsService } from '../permissions.service.js';
import { Notifications } from '../notifications.js';

export class AutomacoesController {
  constructor(container) {
    this.container = container;
    this.init();
  }

  async init() {
    const isAllowed = await PermissionsService.checkAccess('automacoes.gerenciar', 'Automações');
    if (!isAllowed) return;

    await this.loadRegras();
    
    this.container.querySelector('#btn-nova-regra')?.addEventListener('click', () => {
      Notifications.info('Simulação: Modal de Criação de Gatilho e Ação abertos.');
    });
  }

  async loadRegras() {
    const list = this.container.querySelector('#automacoes-list');
    try {
      const regras = await AutomacoesService.getRegras();
      
      if (regras.length === 0) {
        list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">Nenhuma regra configurada.</td></tr>';
        return;
      }

      let html = '';
      regras.forEach(r => {
        
        let acaoFmt = '';
        if (r.acao_tipo === 'ENVIAR_MENSAGEM') acaoFmt = `Enviar Msg: ${r.acao_payload.template_nome || 'Template'}`;
        else if (r.acao_tipo === 'MOVER_LEAD') acaoFmt = `Mover para: ${r.acao_payload.novo_status || 'Convertido'}`;
        else acaoFmt = r.acao_tipo;

        html += `
          <tr style="border-bottom: 1px solid var(--border-color); opacity: ${r.ativo ? '1' : '0.5'};">
            <td style="padding: 1rem 1.5rem; color: var(--text-dark); font-weight: 500;">${r.nome}</td>
            <td style="padding: 1rem 1.5rem; color: var(--warning-color); font-family: monospace; font-size: 0.85rem;">[${r.evento_gatilho}]</td>
            <td style="padding: 1rem 1.5rem; color: var(--primary-color); font-weight: 500;">${acaoFmt}</td>
            <td style="padding: 1rem 1.5rem; text-align: center;">
              <label style="position: relative; display: inline-block; width: 40px; height: 20px;">
                <input type="checkbox" class="toggle-regra" data-id="${r.id}" ${r.ativo ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${r.ativo ? 'var(--success-color)' : 'var(--bg-input)'}; transition: .4s; border-radius: 20px;"></span>
              </label>
            </td>
          </tr>
        `;
      });
      list.innerHTML = html;
      
      // Bind Toggles
      list.querySelectorAll('.toggle-regra').forEach(chk => {
        chk.addEventListener('change', async (e) => {
          try {
            await AutomacoesService.toggleRegra(e.target.dataset.id, e.target.checked);
            Notifications.success('Regra atualizada.');
            this.loadRegras();
          } catch(err) {
            console.error(err);
            Notifications.error('Erro ao atualizar regra.');
            e.target.checked = !e.target.checked; // revert
          }
        });
      });
      
    } catch(e) {
      console.error(e);
      list.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: red;">Erro ao carregar automações.</td></tr>';
    }
  }
}
