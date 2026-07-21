# Relatório de Auditoria: Módulo de Ajuda / Manual Interno
**Painel Administrativo - Clínica Zoe**

## 1. Avaliação do Sistema e Navegação Atual
- O painel conta com uma barra lateral de navegação (`<aside class="admin-sidebar">`) presente em todos os arquivos de visualização (ex: `dashboard.html`). 
- Será necessário criar o botão "Ajuda" na barra e definir sua classe `admin-nav-item`.
- As restrições de visibilidade no menu são controladas no backend (`guard.js`) por injeção de CSS (ex: esconder as tags com a classe `.admin-only` e atuar nos atalhos com `href="financeiro.html"`).

## 2. Configurações de Roles (RBAC) e Guard.js
- Atualmente o arquivo `js/admin/guard.js` gerencia as URLs permitidas para `RECEPCIONISTA` e `PROFISSIONAL`. 
- **Auditoria concluída**: Modificamos o `guard.js` para autorizar ambas as Roles a navegarem para o roteiro `/ajuda.html`. 
- **Privilégios da View (`ajuda.html`)**: A página em si fará a leitura da propriedade `document.body.getAttribute('data-role')` para ocultar os blocos de ajuda sobre Finanças e Configurações aos que não possuírem permissão de ADMIN. Seções como Agenda e Pacientes estarão acessíveis a todos.

## 3. Padrão Visual e Requisitos Vanilla
- O CSS manterá as classes existentes do repositório (`admin-card`, `admin-btn`, `form-input`, `badge`).
- Apenas CSS in-line leve ou injeção de CSS no bloco `<head>` será feita para formatação limpa das âncoras (ex: FAQ e Accordions), evitando adição de novos arquivos que inflem o projeto se não for necessário. 

## 4. Conclusão
A estrutura está pronta. A `ETAPA 1` foi concluída com sucesso. Podemos partir para a Criação e Estruturação das páginas HTML e a lógica JavaScript para pesquisa (`ajuda.html`).
