import { EspecialidadesService } from '../services/especialidades.service.js';
import { PermissionsService } from '../permissions.service.js';
import { RoleManager } from '../components/RoleManager.js';

export class EspecialidadesController {
  constructor(container) {
    this.container = container;
    this.tableBody = this.container.querySelector('#especialidades-tbody');
    this.init();
  }

  async init() {
    const isAllowed = await PermissionsService.checkAccess('configuracoes.visualizar', 'Módulo de Especialidades');
    if (!isAllowed) return;

    RoleManager.applyPermissions(this.container);

    await this.loadEspecialidades();
    this.bindEvents();
  }

  async loadEspecialidades() {
    try {
      this.tableBody.innerHTML = `<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando configurações...</td></tr>`;
      
      const especialidades = await EspecialidadesService.listEspecialidades();
      this.tableBody.innerHTML = '';

      if (especialidades.length === 0) {
        this.tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Nenhuma especialidade clínica configurada.</td></tr>`;
        return;
      }

      especialidades.forEach(esp => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 35px; height: 35px; border-radius: 8px; background: ${esp.cor_agenda || '#e5f0fa'}; display: flex; align-items: center; justify-content: center; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">
                <i class="${esp.icone || 'fas fa-stethoscope'}"></i>
              </div>
              <div>
                <div style="font-weight: 500; font-size: 0.95rem;">${esp.nome}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${esp.categoria || 'Geral'}</div>
              </div>
            </div>
          </td>
          <td>
            <div style="font-size: 0.9rem;">${esp.tempo_padrao} min</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Intervalo: ${esp.intervalo_recomendado} min</div>
          </td>
          <td>
            <div style="font-size: 0.9rem; font-weight: 500; color: var(--text-dark);">
              ${esp.valor_vista ? 'R$ ' + parseFloat(esp.valor_vista).toFixed(2) : '<span style="color:red; font-size: 0.8rem;">Indefinido</span>'}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Repasse: ${esp.percentual_repasse || 0}%</div>
          </td>
          <td>
            <span style="background: ${esp.status === 'Ativa' ? '#d4edda' : '#fce4e4'}; color: ${esp.status === 'Ativa' ? '#155724' : '#cc0033'}; padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; font-weight: 500;">
              ${esp.status}
            </span>
          </td>
          <td style="text-align: right;">
             <button class="btn btn-icon" data-permission="configuracoes.editar" title="Editar Especialidade" style="background: none; border: none; cursor: pointer; color: var(--primary-color); margin-right: 5px;">
               <i class="fas fa-cog"></i>
             </button>
             <button class="btn btn-icon btn-delete" data-id="${esp.id}" data-permission="configuracoes.editar" title="Desativar" style="background: none; border: none; cursor: pointer; color: #ff3b30;">
               <i class="fas fa-trash-alt"></i>
             </button>
          </td>
        `;
        this.tableBody.appendChild(row);
      });

      RoleManager.applyPermissions(this.container);

      this.container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => this.handleDelete(e));
      });

    } catch (error) {
      console.error(error);
      this.tableBody.innerHTML = `<tr><td colspan="5" class="text-center" style="color: #ff3b30;">Erro ao carregar especialidades.</td></tr>`;
    }
  }

  async handleDelete(e) {
    const btn = e.currentTarget;
    const id = btn.getAttribute('data-id');
    
    if (confirm('Atenção: Ao inativar, esta especialidade não aparecerá em novos agendamentos.')) {
      try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        await EspecialidadesService.softDeleteEspecialidade(id);
        await this.loadEspecialidades();
      } catch (error) {
        alert(error.message);
        btn.innerHTML = '<i class="fas fa-trash-alt"></i>';
      }
    }
  }

  bindEvents() {
    const btnNovo = this.container.querySelector('#btn-nova-especialidade');
    if (btnNovo) {
      btnNovo.addEventListener('click', () => {
        alert("Na versão final, abrirá o modal de configuração avançada da especialidade (Duração, Cor, Base de Valores).");
      });
    }
  }
}
