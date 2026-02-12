

## Desenvolver a Pagina de Templates

A pagina de Templates sera transformada de um placeholder para uma interface completa de gerenciamento de modelos de mensagens reutilizaveis, usando a tabela `message_templates` que ja existe no banco de dados.

---

### Funcionalidades

1. **Listagem de templates** -- Cards com nome, tipo, categoria, preview do conteudo e data de criacao
2. **Criar novo template** -- Dialog com formulario completo (reutilizando a mesma logica de tipos de mensagem do formulario de agendamento)
3. **Editar template existente** -- Mesmo dialog, pre-preenchido
4. **Excluir template** -- Confirmacao antes de deletar
5. **Filtro por categoria** -- Tabs ou badges para filtrar por categoria (ex: geral, marketing, informativo)
6. **Estado vazio** -- Ilustracao quando nao ha templates

---

### Detalhes Tecnicos

**Arquivo: `src/pages/Templates.tsx`** (reescrever)
- Query com `@tanstack/react-query` para buscar templates do usuario (`message_templates` table)
- Listagem em grid de cards com icone do tipo, nome, preview do conteudo, badge de categoria e tipo
- Botoes de editar e excluir em cada card
- Botao "Novo Template" no header
- Filtro por categoria usando badges clicaveis

**Arquivo: `src/components/templates/TemplateFormDialog.tsx`** (novo)
- Dialog para criar/editar template
- Campos: nome, categoria (select com opcoes: geral, marketing, informativo, suporte), tipo de mensagem (grid identico ao ScheduledMessageForm)
- Campos de conteudo dinamicos por tipo (texto, imagem+legenda, video+legenda, documento, audio, localizacao, contato, enquete, lista)
- Reutilizar os mesmos tipos e icones de `MESSAGE_TYPES` do ScheduledMessageForm
- Salva via `supabase.from("message_templates").insert/update`

**Arquivo: `src/components/templates/TemplateCard.tsx`** (novo)
- Card individual do template com:
  - Icone do tipo de mensagem
  - Nome e preview do conteudo (truncado)
  - Badge de categoria e tipo
  - Botoes de editar/excluir
  - Data de criacao formatada

**Sem alteracoes no banco de dados** -- a tabela `message_templates` ja possui todos os campos necessarios (name, category, message_type, content jsonb, user_id).

