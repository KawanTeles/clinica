import { ProfissionaisService } from '../services/profissionais.service.js';
import { PermissionsService } from '../permissions.service.js';
import { RoleManager } from '../components/RoleManager.js';

export class ProfissionaisController {
  constructor(container) {
    this.container = container;
    this.tableBody = this.container.querySelector('#profissionais-tbody');
    this.init();
  }

  async init() {
    // 1. Validar acesso crítico
    const isAllowed = await PermissionsService.checkAccess('profissionais.visualizar', 'Módulo de Profissionais');
    if (!isAllowed) return;

    // 2. Aplicar RBAC na interface
    RoleManager.applyPermissions(this.container);

    // 3. Carregar Dados
    await this.loadProfissionais();
    this.bindEvents();
  }

  async loadProfissionais() {
    try {
      this.tableBody.innerHTML = `<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando profissionais...</td></tr>`;
      
      const profissionais = await ProfissionaisService.listProfissionais();
      this.tableBody.innerHTML = '';

      if (profissionais.length === 0) {
        this.tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Nenhum profissional encontrado.</td></tr>`;
        return;
      }

      profissionais.forEach(prof => {
        const initial = prof.nome ? prof.nome.charAt(0).toUpperCase() : 'P';
        // Extrai especialidades
        const especialidades = prof.profissional_especialidade
          ? prof.profissional_especialidade.map(pe => pe.especialidades.nome).join(', ')
          : 'Geral';
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 40px; height: 40px; border-radius: 12px; background: var(--bg-hover); border: 1px solid var(--border-color); color: var(--primary-color); display: flex; align-items: center; justify-content: center; font-weight: 600;">
                ${initial}
              </div>
              <div>
                <div style="font-weight: 500; font-size: 0.95rem;">${prof.nome}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${prof.registro_conselho || 'S/ Registro'}</div>
              </div>
            </div>
          </td>
          <td><span style="font-size: 0.9rem; color: var(--text-dark);">${especialidades || 'Não definida'}</span></td>
          <td>
            <div style="font-size: 0.9rem;"><i class="fab fa-whatsapp" style="color: #25D366;"></i> ${prof.whatsapp || 'Não informado'}</div>
          </td>
          <td>
            <span style="background: ${prof.status === 'Ativo' ? '#d4edda' : '#fce4e4'}; color: ${prof.status === 'Ativo' ? '#155724' : '#cc0033'}; padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; font-weight: 500;">
              ${prof.status}
            </span>
          </td>
          <td style="text-align: right;">
             <a href="#perfil-profissional?id=${prof.id}" class="btn btn-icon" title="Ver Perfil Completo" style="text-decoration: none; display: inline-block; padding: 6px; color: var(--primary-color); margin-right: 5px;">
               <i class="fas fa-id-card"></i>
             </a>
             <button class="btn btn-icon btn-delete" data-id="${prof.id}" data-permission="profissionais.excluir" title="Desativar Profissional" style="background: none; border: none; cursor: pointer; color: #ff3b30;">
               <i class="fas fa-trash-alt"></i>
             </button>
          </td>
        `;
        this.tableBody.appendChild(row);
      });

      // Reforça o RBAC para os botões recém renderizados
      RoleManager.applyPermissions(this.container);

      // Vincular eventos de exclusão
      this.container.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => this.handleDelete(e));
      });

    } catch (error) {
      console.error(error);
      this.tableBody.innerHTML = `<tr><td colspan="5" class="text-center" style="color: #ff3b30;">Erro ao carregar dados dos profissionais.</td></tr>`;
    }
  }

  async handleDelete(e) {
    const btn = e.currentTarget;
    const profId = btn.getAttribute('data-id');
    
    if (confirm('Tem certeza que deseja inativar este profissional? A agenda e histórico financeiro serão mantidos para auditoria.')) {
      try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        await ProfissionaisService.softDeleteProfissional(profId);
        await this.loadProfissionais();
      } catch (error) {
        alert(error.message);
        btn.innerHTML = '<i class="fas fa-trash-alt"></i>';
      }
    }
  }

  bindEvents() {
    const btnNovo = this.container.querySelector('#btn-novo-profissional');
    if (btnNovo) {
      btnNovo.addEventListener('click', () => {
        // Redireciona para um esqueleto de criação ou abre modal
        alert("Na versão final, abrirá o modal de cadastro solicitando: CPF, Especialidades e Vinculação Opcional de Usuário.");
      });
    }
  }
}
