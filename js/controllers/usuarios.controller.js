import { UsuariosAdminService } from '../services/usuarios-admin.service.js';
import { PermissionsService } from '../permissions.service.js';
import { RoleManager } from '../components/RoleManager.js';

export class UsuariosController {
  constructor(container) {
    this.container = container;
    this.tableBody = this.container.querySelector('#usuarios-tbody');
    this.init();
  }

  async init() {
    // 1. Validar acesso crítico
    const isAllowed = await PermissionsService.checkAccess('usuarios.visualizar', 'Módulo de Usuários');
    if (!isAllowed) return;

    // 2. Aplicar RBAC na interface (Esconder botões de ação se não tiver permissão)
    RoleManager.applyPermissions(this.container);

    // 3. Carregar Dados
    await this.loadUsuarios();
    this.bindEvents();
  }

  async loadUsuarios() {
    try {
      this.tableBody.innerHTML = `<tr><td colspan="5" class="text-center"><i class="fas fa-spinner fa-spin"></i> Carregando usuários...</td></tr>`;
      
      const usuarios = await UsuariosAdminService.listUsuarios();
      this.tableBody.innerHTML = '';

      if (usuarios.length === 0) {
        this.tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">Nenhum usuário encontrado.</td></tr>`;
        return;
      }

      usuarios.forEach(user => {
        const cargo = user.usuario_cargos?.[0]?.cargos?.nome || 'Sem cargo';
        const initial = user.nome.charAt(0).toUpperCase();
        
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 35px; height: 35px; border-radius: 50%; background: var(--primary-color); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">
                ${initial}
              </div>
              <div>
                <div style="font-weight: 500;">${user.nome}</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">${user.email}</div>
              </div>
            </div>
          </td>
          <td><span style="background: #e5f0fa; color: #0071e3; padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; font-weight: 500;">${cargo}</span></td>
          <td>
            <span style="color: ${user.status === 'Ativo' ? '#28a745' : '#dc3545'}; font-size: 0.9rem; display: flex; align-items: center; gap: 5px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${user.status === 'Ativo' ? '#28a745' : '#dc3545'};"></span>
              ${user.status}
            </span>
          </td>
          <td style="color: var(--text-muted); font-size: 0.9rem;">
            ${user.ultimo_login ? new Date(user.ultimo_login).toLocaleDateString('pt-BR') : 'Nunca acessou'}
          </td>
          <td style="text-align: right;">
             <button class="btn btn-icon" data-permission="usuarios.editar" title="Editar Permissões" style="background: none; border: none; cursor: pointer; color: var(--text-muted); margin-right: 10px;">
               <i class="fas fa-edit"></i>
             </button>
             <button class="btn btn-icon btn-delete" data-id="${user.id}" data-permission="usuarios.excluir" title="Desativar Conta" style="background: none; border: none; cursor: pointer; color: #ff3b30;">
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
      this.tableBody.innerHTML = `<tr><td colspan="5" class="text-center" style="color: #ff3b30;">Erro ao carregar dados.</td></tr>`;
    }
  }

  async handleDelete(e) {
    const btn = e.currentTarget;
    const userId = btn.getAttribute('data-id');
    
    if (confirm('Atenção: Tem certeza que deseja revogar o acesso deste usuário permanentemente? O histórico será mantido.')) {
      try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        await UsuariosAdminService.softDeleteUsuario(userId);
        await this.loadUsuarios();
      } catch (error) {
        alert(error.message);
        btn.innerHTML = '<i class="fas fa-trash-alt"></i>';
      }
    }
  }

  bindEvents() {
    const btnNovo = this.container.querySelector('#btn-novo-usuario');
    if (btnNovo) {
      btnNovo.addEventListener('click', () => {
        alert("O formulário invoca a Edge Function 'invite-user' enviando e-mail oficial pelo Supabase.");
      });
    }
  }
}
