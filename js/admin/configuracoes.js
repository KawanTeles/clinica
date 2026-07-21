import { SettingsRepository } from '../../repositories/settings.repository.js';
import { AuthRepository } from '../../repositories/auth.repository.js';

document.addEventListener('DOMContentLoaded', async () => {
    let clinicId = null;

    try {
        const { data: { session } } = await AuthRepository.getSession();
        if (!session) return; 
        
        const profileRes = await AuthRepository.getPerfilUsuario(session.user.id);
        clinicId = profileRes.data.clinic_id;
    } catch (err) {
        console.error('Erro de inicialização:', err);
        return;
    }

    // Tabs Logic
    const navItems = document.querySelectorAll('.settings-nav-item');
    const sections = document.querySelectorAll('.settings-section');

    navItems.forEach(btn => {
        btn.addEventListener('click', (e) => {
            navItems.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.style.display = 'none');
            
            const targetId = e.currentTarget.dataset.target;
            document.getElementById(targetId).style.display = 'block';
            e.currentTarget.classList.add('active');
            
            if (targetId === 'tab-permissoes') loadUsers();
            if (targetId === 'tab-integracoes') loadIntegrations();
        });
    });

    // 1 & 2. Carregar Configurações Atuais
    const loadSettings = async () => {
        try {
            const data = await SettingsRepository.getSettings(clinicId);
            if (!data) return;

            document.getElementById('set_nome').value = data.nome || '';
            document.getElementById('set_telefone').value = data.telefone || '';
            document.getElementById('set_whatsapp').value = data.whatsapp || '';
            document.getElementById('set_email').value = data.email || '';
            document.getElementById('set_endereco').value = data.endereco || '';
            document.getElementById('set_cidade').value = data.cidade || '';
            document.getElementById('set_estado').value = data.estado || '';
            document.getElementById('set_info').value = data.informacoes_publicas || '';

            document.getElementById('set_hora_abertura').value = data.horario_abertura || '08:00';
            document.getElementById('set_hora_fechamento').value = data.horario_fechamento || '18:00';
            document.getElementById('set_intervalo_inicio').value = data.intervalo_inicio || '12:00';
            document.getElementById('set_intervalo_fim').value = data.intervalo_fim || '13:00';

            const dias = data.dias_atendimento || [];
            document.querySelectorAll('#dias_atendimento input').forEach(cb => {
                cb.checked = dias.includes(parseInt(cb.value));
            });

        } catch(err) {
            console.error('Erro ao carregar configuracoes:', err);
            window.Toast?.error('Falha ao carregar dados da clínica.');
        }
    };

    // Salvar Clinica
    document.getElementById('form-clinica').addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            nome: document.getElementById('set_nome').value,
            telefone: document.getElementById('set_telefone').value,
            whatsapp: document.getElementById('set_whatsapp').value,
            email: document.getElementById('set_email').value,
            endereco: document.getElementById('set_endereco').value,
            cidade: document.getElementById('set_cidade').value,
            estado: document.getElementById('set_estado').value,
            informacoes_publicas: document.getElementById('set_info').value
        };

        try {
            await SettingsRepository.updateSettings(clinicId, payload);
            window.Toast?.success('Informações da clínica atualizadas com sucesso!');
        } catch(err) {
            console.error(err);
            window.Toast?.error('Erro ao salvar informações.');
        }
    });

    // Salvar Horários
    document.getElementById('form-horarios').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const dias = [];
        document.querySelectorAll('#dias_atendimento input:checked').forEach(cb => {
            dias.push(parseInt(cb.value));
        });

        const payload = {
            horario_abertura: document.getElementById('set_hora_abertura').value,
            horario_fechamento: document.getElementById('set_hora_fechamento').value,
            intervalo_inicio: document.getElementById('set_intervalo_inicio').value || null,
            intervalo_fim: document.getElementById('set_intervalo_fim').value || null,
            dias_atendimento: dias
        };

        try {
            await SettingsRepository.updateSettings(clinicId, payload);
            window.Toast?.success('Horários atualizados com sucesso!');
        } catch(err) {
            console.error(err);
            window.Toast?.error('Erro ao salvar horários.');
        }
    });

    // 3. Usuários
    const loadUsers = async () => {
        const tbody = document.getElementById('users-table-body');
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Carregando...</td></tr>';
        
        try {
            const users = await SettingsRepository.getActiveUsers(clinicId);
            tbody.innerHTML = '';
            
            if (!users || users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Nenhum usuário encontrado.</td></tr>';
                return;
            }

            users.forEach(u => {
                const roleBadge = u.roles.nome === 'ADMIN' ? 'badge-danger' : 
                                 (u.roles.nome === 'RECEPCIONISTA' ? 'badge-primary' : 'badge-warning');
                
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${u.nome}</strong></td>
                        <td>${u.email}</td>
                        <td><span class="badge ${roleBadge}">${u.roles.nome}</span></td>
                        <td><span class="badge badge-success">Ativo</span></td>
                    </tr>
                `;
            });
        } catch(err) {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Erro ao buscar usuários.</td></tr>';
        }
    };

    // 4. Integracoes
    const loadIntegrations = async () => {
        const wppStatus = document.getElementById('wpp-status');
        try {
            const inte = await SettingsRepository.getIntegrations(clinicId);
            if (inte && inte.status === 'CONNECTED') {
                wppStatus.textContent = 'Conectado';
                wppStatus.className = 'badge badge-success';
            } else if (inte) {
                wppStatus.textContent = inte.status || 'Desconectado';
                wppStatus.className = 'badge badge-danger';
            } else {
                wppStatus.textContent = 'Não configurado';
                wppStatus.className = 'badge badge-warning';
            }
        } catch(err) {
            console.error(err);
            wppStatus.textContent = 'Erro ao verificar';
            wppStatus.className = 'badge badge-danger';
        }
    };

    // Iniciar
    loadSettings();
});
