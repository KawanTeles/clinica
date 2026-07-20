-- Base Permissões
INSERT INTO permissoes (slug, descricao) VALUES
-- Agenda
('agenda.visualizar', 'Pode visualizar agendamentos'),
('agenda.criar', 'Pode criar agendamentos'),
('agenda.editar', 'Pode editar agendamentos'),
('agenda.cancelar', 'Pode cancelar agendamentos'),
('agenda.excluir', 'Pode excluir agendamentos'),

-- Pacientes
('pacientes.visualizar', 'Pode visualizar pacientes'),
('pacientes.criar', 'Pode cadastrar pacientes'),
('pacientes.editar', 'Pode editar dados dos pacientes'),
('pacientes.excluir', 'Pode inativar pacientes'),

-- Financeiro
('financeiro.visualizar', 'Pode visualizar dados financeiros'),
('financeiro.criar', 'Pode criar lançamentos financeiros'),
('financeiro.editar', 'Pode editar lançamentos financeiros'),
('financeiro.excluir', 'Pode excluir lançamentos financeiros'),

-- Marketing
('marketing.visualizar', 'Pode visualizar CRM e leads'),
('marketing.editar', 'Pode editar leads e funil'),

-- Usuários
('usuarios.criar', 'Pode cadastrar usuários'),
('usuarios.editar', 'Pode editar usuários'),
('usuarios.excluir', 'Pode inativar usuários'),

-- Configurações
('configuracoes.visualizar', 'Pode visualizar configurações'),
('configuracoes.editar', 'Pode alterar configurações da clínica')
ON CONFLICT (slug) DO NOTHING;