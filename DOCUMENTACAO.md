# 🩺 Documentação Técnica: Clínica Zoe Premium Web System

Esta documentação fornece instruções detalhadas para instalação, configuração, operação, segurança e evolução do **Sistema Web Premium da Clínica Zoe**.

---

## 1. Estrutura do Projeto

O projeto foi desenvolvido utilizando uma arquitetura modular de arquivos estáticos puros (HTML5, CSS3, JS ES6+) para garantir máxima velocidade de carregamento, facilidade de hospedagem e desacoplamento total do backend serverless (Supabase).

```
clinica/
├── index.html                # Página inicial institucional (Hero, Diferenciais, Avaliações, FAQ, Mapa, Footer)
├── package.json              # Configurações de comandos locais npm
├── server.js                 # Servidor estático local leve em Node.js (Pretty URLs e 404 Fallback)
├── DOCUMENTACAO.md           # Esta documentação completa de implantação
├── pages/
│   ├── sobre.html            # História da clínica, Missão, Visão, Valores e Galeria de Fotos
│   ├── especialidades.html   # Listagem e busca dinâmica de especialidades médicas/terapêuticas
│   ├── profissionais.html    # Lista de médicos com busca por texto e filtragem por especialidade
│   ├── agendamento.html      # Funil de agendamento em 5 passos com calendário e slots em tempo real
│   ├── contato.html          # Canais de atendimento e formulário de contato integrado
│   ├── login.html            # Tela de login administrativa/profissional segura
│   ├── dashboard.html        # Central Administrativa (Métricas, Gráficos Chart.js, Agenda e CRUDs)
│   ├── trabalhe-conosco.html # Formulário para atração e candidatura de novos profissionais
│   ├── politica.html         # Políticas de Privacidade e conformidade LGPD / DPO
│   ├── termos.html           # Termos de Uso e regras de agendamento
│   └── 404.html              # Página customizada de erro de rota
├── css/
│   ├── style.css             # Folha de estilo base (Design System inspirado na Apple, paleta HSL e redefinições)
│   ├── responsive.css        # Adaptação completa de layouts para tablets e celulares (Menu lateral móvel)
│   ├── darkmode.css          # Inversão de variáveis CSS e estilo escuro para inputs e mapas
│   └── animations.css        # Efeitos GSAP, AOS, esqueletos de carregamento (Skeleton loading) e flutuações
├── js/
│   ├── config.js             # Configurações das credenciais do Supabase e endpoints de WhatsApp
│   ├── supabase.js           # Inicializador do cliente Supabase e Motor de MOCK para Fallback de testes
│   ├── theme.js              # Controle inteligente de Light/Dark Mode (LocalStorage e OS listener)
│   ├── main.js               # Eventos comuns globais (Loader, menu mobile, cookies LGPD, newsletter)
│   ├── auth.js               # Gerenciador de login, registro, cookies de sessão e proteção de rotas
│   ├── professionals.js      # Listagem, busca e filtragem do corpo clínico
│   ├── calendar.js           # Geração do calendário do mês, validação de dias de trabalho e férias
│   ├── appointments.js       # Funil do agendamento (Paciente/Consulta) e barreira contra double-booking
│   ├── dashboard.js          # Listagem de agendamentos no painel, busca, mudança de status e exportação CSV
│   ├── admin.js              # Módulos CRUD de médicos/especialidades, lançamento de férias e bloqueios
│   ├── charts.js             # Renderização de gráficos dinâmicos de performance (Chart.js)
│   └── notifications.js      # Disparo de Toasts visuais e requisições para a API de WhatsApp
└── sql/
    ├── database.sql          # Scripts de criação de tabelas PostgreSQL e sementes iniciais
    └── policies.sql          # Políticas de controle de acesso de segurança Row Level Security (RLS)
```

---

## 2. Instalação e Execução Local

### Pré-requisitos
* **Node.js** (Versão 16 ou superior) instalado no sistema.

### Inicialização Rápida
1. Abra o prompt de comando ou terminal no diretório da pasta `clinica/`.
2. Execute o servidor de desenvolvimento local:
   ```bash
   npm run dev
   ```
3. O terminal exibirá:
   ```
   [Clinica Zoe] Dev server running at http://localhost:3000
   ```
4. Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.

> [!NOTE]
> **Modo de Demonstração (MOCK):** Caso as chaves do Supabase em `js/config.js` não sejam preenchidas, o sistema entrará automaticamente em **Modo de Demonstração**. Neste modo, todas as funcionalidades de agendamento online, login administrativo, cadastro de médicos/especialidades, bloqueio de horários, férias e gráficos funcionam perfeitamente salvando os dados em memória local (`LocalStorage`). Isso permite homologar a experiência do usuário imediatamente antes de criar o banco em produção!

---

## 3. Configuração do Banco de Dados no Supabase

Para conectar o site a um banco de dados real em nuvem, siga o passo a passo de configuração:

### Passo 1: Criar o Projeto no Supabase
1. Acesse [https://supabase.com](https://supabase.com) e crie uma conta gratuita.
2. No painel, clique em **New Project** (Novo Projeto).
3. Defina o nome do projeto (ex: `clinica-zoe`), defina uma senha forte para o banco de dados PostgreSQL e selecione a região do servidor (recomenda-se *sa-east-1 - São Paulo* para menor latência).
4. Aguarde de 2 a 3 minutos até que a infraestrutura seja provisionada pelo Supabase.

### Passo 2: Importar a Estrutura de Tabelas (SQL)
1. No menu lateral esquerdo do Supabase, clique em **SQL Editor**.
2. Clique em **New Query** (Nova Consulta).
3. Abra o arquivo [sql/database.sql](file:///C:/Users/anton/OneDrive/Desktop/clinica/sql/database.sql) localizado no projeto, copie todo o seu conteúdo e cole no campo de texto do SQL Editor do Supabase.
4. Clique em **Run** (Executar).
5. O Supabase criará todas as tabelas (`especialidades`, `profissionais`, `pacientes`, `agendamentos`, `horarios_bloqueados`, `ferias`, `avaliacoes`), os Enums e inserirá as especialidades e médicos semente automaticamente.

### Passo 3: Configurar o Arquivo `js/config.js`
1. No painel do seu projeto Supabase, acesse **Project Settings** (Engrenagem no canto inferior esquerdo) e vá em **API**.
2. Copie a **Project URL** (URL do Projeto) e a **Anon Key** (Chave Pública Anônima).
3. Abra o arquivo [js/config.js](file:///C:/Users/anton/OneDrive/Desktop/clinica/js/config.js) no seu editor de código e cole os valores nas respectivas variáveis:
   ```javascript
   const CONFIG = {
     SUPABASE_URL: 'https://sua-url-aqui.supabase.co',
     SUPABASE_KEY: 'sua-anon-key-aqui',
     // ...
   };
   ```
4. Salve o arquivo. Ao recarregar o site, ele estará conectado diretamente ao seu banco de dados PostgreSQL do Supabase em produção, desativando automaticamente o Modo Demo.

---

## 4. Segurança, RLS e Autenticação

Seguindo as diretrizes da **OWASP** e da **LGPD**, a segurança do sistema é gerida de forma descentralizada na nuvem com autenticação segura e Row Level Security (RLS) no PostgreSQL.

### Ativar Políticas de Acesso RLS
1. No menu do Supabase, vá em **SQL Editor** e crie uma nova consulta.
2. Copie o conteúdo do arquivo [sql/policies.sql](file:///C:/Users/anton/OneDrive/Desktop/clinica/sql/policies.sql), cole no editor e clique em **Run**.
3. Este script ativa as seguintes políticas de restrição:
   * **Pacientes/Público:** Podem ler médicos ativos, especialidades e avaliações. Podem criar agendamentos e registros de pacientes na fila.
   * **Profissionais (Médicos):** Se autenticados com seu e-mail funcional, conseguem ler e monitorar apenas a própria agenda e os bloqueios vinculados ao seu ID de profissional.
   * **Administradores:** Acesso irrestrito de leitura, escrita e exclusão em todas as tabelas do sistema.

### Como Cadastrar o Primeiro Administrador
Para criar o usuário administrativo principal da clínica no Supabase Auth:
1. No painel lateral do Supabase, clique em **Authentication** e selecione a aba **Users**.
2. Clique em **Add User** -> **Create User**.
3. Preencha o e-mail (ex: `admin@clinicazoe.com`) e defina uma senha de acesso.
4. Para designar este usuário como administrador:
   * Vá em **SQL Editor** no Supabase e execute o seguinte comando para atualizar os metadados do usuário e conceder o privilégio de `admin`:
     ```sql
     -- Substitua o email abaixo pelo email que você acabou de cadastrar
     UPDATE auth.users 
     SET raw_user_meta_data = '{"role": "admin"}'::jsonb 
     WHERE email = 'admin@clinicazoe.com';
     ```
5. Pronto! Agora você pode efetuar o login na tela em `/pages/login.html` com o e-mail cadastrado e acessar o Painel Administrativo.

---

## 5. Como Utilizar o Sistema

### Fluxo de Agendamento (Paciente)
1. O paciente clica em "Agendar Consulta" e é direcionado ao funil de 5 passos em `/pages/agendamento.html`.
2. **Passo 1:** Escolhe a Especialidade pretendida.
3. **Passo 2:** Escolhe o Profissional ativo associado àquela especialidade.
4. **Passo 3:** Abre-se o calendário. Dias fora do expediente do profissional ou cobertos por períodos de férias cadastrados ficam destacados em vermelho/cinza e bloqueados para clique. Ao clicar em um dia de atendimento livre, o motor calcula de 60 em 60 minutos os horários vagos, cruzando com agendamentos já marcados e bloqueios cirúrgicos daquele médico.
5. **Passo 4:** O paciente preenche seus dados cadastrais (Nome, E-mail, Celular, CPF). O sistema valida os campos e aplica máscaras.
6. **Passo 5:** O paciente revisa as informações e confirma.
   * *Prevenção de Duplicidades (Realtime):* O sistema assina o canal Realtime do Supabase. Caso outro usuário conecte-se no mesmo instante e confirme a reserva do mesmo slot de horário que está sendo visualizado pelo paciente, um Toast de atenção é exibido instantaneamente no topo da tela, o slot é marcado como indisponível e o paciente é redirecionado a selecionar uma nova hora.

### Operação no Painel Administrativo
O Administrador logado tem acesso às abas de gerenciamento na lateral esquerda do painel:
1. **Adicionar/Editar Profissionais:** Abre o formulário CRUD para inserir novos médicos, definir horários de jornada (Entrada e Saída), e-mail corporativo de acesso e marcar dias específicos da semana de trabalho (Segunda a Sábado).
2. **Adicionar Especialidades:** Permite criar novas especialidades cadastrando o nome descritivo e uma classe FontAwesome para ícone visual do portal.
3. **Bloquear Agenda:** Permite que o administrador selecione um profissional, selecione uma data e defina um intervalo de horas (ex: das 14h às 16h) para bloqueio operacional (ex: participação em congresso, cirurgia de emergência). Esse intervalo ficará automaticamente oculto do calendário de agendamento do paciente.
4. **Lançar Férias:** Permite cadastrar uma faixa de data de início e data de fim de recesso de um especialista.

---

## 6. Personalização Visual, Textos e Imagens

### Cores da Marca
A paleta de cores principal (estilo Apple minimalista com acentos em verde e lilás) está centralizada na folha de estilos [css/style.css](file:///C:/Users/anton/OneDrive/Desktop/clinica/css/style.css) na declaração `:root`. 
Para alterar a cor principal da clínica (verde) e de destaque (lilás), modifique as variáveis:
```css
:root {
  --primary: #2E8B57;         /* Verde Zoe */
  --primary-hover: #246e43;   /* Tom mais escuro para hover */
  --secondary: #9B59B6;       /* Lilás de acento */
  /* ... */
}
```

### Alterando Textos e Imagens
* **Imagens do Corpo Clínico:** Ao adicionar médicos pelo painel, forneça URLs de fotos hospedadas publicamente (ex: no Storage do Supabase, Unsplash ou CDN própria).
* **Galeria de Fotos da Clínica:** Os caminhos das imagens e o visualizador Lightbox estão localizados no arquivo [pages/sobre.html](file:///C:/Users/anton/OneDrive/Desktop/clinica/pages/sobre.html). Altere as fontes das tags `<img>` e o parâmetro da função `openLightbox()` para usar fotos reais da infraestrutura física da clínica.

---

## 7. Integrações e Evolução de Negócio

### Integração da API de WhatsApp
A lógica de disparo de notificações pós-agendamento está estruturada em [js/notifications.js](file:///C:/Users/anton/OneDrive/Desktop/clinica/js/notifications.js). O método `sendWhatsAppNotification` está preparado para enviar requisições POST para APIs de mercado como **Evolution API**, **Z-API** ou **Twilio**. 
Para ativar o envio real:
1. Configure as chaves de acesso e a URL de webhook em `js/config.js`:
   ```javascript
   WHATSAPP_PROVIDER: 'evolution',
   WHATSAPP_API_URL: 'https://seu-servidor-api.com/message/sendText/sua-instancia',
   WHATSAPP_TOKEN: 'seu-token-de-autorizacao-aqui',
   ```
2. Caso prefira o envio sem custos pelo celular do próprio paciente, o sistema já calcula e retorna automaticamente uma URL Click-to-Chat `https://api.whatsapp.com/send?...` na tela de sucesso final, permitindo que o paciente envie a mensagem formatada para a recepção da clínica em um clique.

### Integração de E-mails e Notificações adicionais
No painel do Supabase, você pode ativar o envio de e-mails transacionais utilizando o serviço de SMTP integrado (ex: SendGrid, Resend, Mailgun) acessando **Authentication -> Providers -> SMTP**. O Supabase enviará confirmações de contas automáticas para administradores e profissionais.

### Backups e Restauração de Dados
* Em Modo Demo, os dados ficam locais no navegador do administrador. Para fazer backup, basta exportar a agenda em CSV.
* Em produção no Supabase, backups diários automáticos do banco de dados PostgreSQL são realizados por padrão na plataforma na aba **Database -> Backups**. Caso queira realizar um backup manual, utilize a ferramenta pg_dump conectada à string de conexão do banco de dados (disponível em Project Settings -> Database).

---

## 8. Escalar o Sistema e Evolução para ERP

Este sistema foi projetado para facilitar futuras expansões operacionais:

### Escalonamento para Múltiplas Unidades
Para suportar mais de uma unidade física da Clínica Zoe:
1. Crie uma tabela `unidades` no banco de dados (ex: `id`, `nome`, `endereco`, `telefone`).
2. Adicione uma chave estrangeira `unidade_id` na tabela `profissionais` e `agendamentos`.
3. No funil de agendamento (`agendamento.html`), insira uma etapa inicial: "Selecione a Unidade". A partir da seleção, filtre os médicos disponíveis associados àquela filial específica.

### Evolução para um ERP Clínico Completo (Gestão Interna)
Caso a clínica Zoe cresça e demande funcionalidades internas avançadas (Prontuário Eletrônico do Paciente - PEP, Gestão de Faturamento, Controle Financeiro e Emissão de Notas Fiscais):
1. **Prontuário Eletrônico:** Adicione uma tabela `prontuarios` (vinculando `paciente_id` e `profissional_id`) contendo campos textuais criptografados para anamnese, receitas e tratamentos, protegida rigorosamente por criptografia em nível de coluna (pgcrypto) e políticas RLS de forma que apenas o médico responsável consiga decriptografar as anotações clínicas daquele paciente.
2. **Faturamento/Pagamentos:** Integre soluções de gateway de pagamento (como *Stripe, Mercado Pago ou Asaas*) diretamente nas Edge Functions do Supabase para processamento de Pix e cartões de crédito na etapa 5 da confirmação da consulta, marcando o status como `Agendado` e alterando automaticamente para `Confirmado` apenas após o webhook de confirmação de pagamento emitido pelo gateway.
