

## Landing Page -- Simplificando Grupos

### Resumo

Criar uma landing page de vendas em `/landing`, acessivel publicamente (sem login), com design dark moderno inspirado no site de referencia (joinzapp.io), usando a identidade visual ja existente do projeto.

### Estrutura da Pagina

A pagina tera as seguintes secoes, de cima para baixo:

1. **Navbar** -- Logo + botao "Entrar" (link para /auth) + botao CTA
2. **Hero** -- Headline forte + subtitulo + botao CTA + imagem/mockup do dashboard
3. **Problema / Dor** -- Secao curta descrevendo a dor de quem gerencia muitos grupos manualmente
4. **Funcionalidades** -- Grid com os principais recursos do sistema:
   - Disparo em massa para infinitos grupos
   - Agendamento automatico (diario, semanal, mensal)
   - Mensagens com IA integrada
   - Campanhas organizadas
   - Dashboard com metricas em tempo real
   - Suporte a texto, imagem, video, audio, documentos
   - Fila inteligente com delay anti-ban
   - Backup e restauracao
5. **Planos e Precos** -- 3 cards lado a lado:
   - **Basico** -- R$ 97/mes -- 1 numero, infinitos grupos e disparos
   - **Profissional** -- R$ 197/mes -- 3 numeros, infinitos grupos e disparos
   - **Empresarial** -- R$ 247/mes -- 5 numeros, infinitos grupos e disparos
6. **FAQ** -- Accordion com perguntas frequentes
7. **CTA Final** -- Secao de fechamento com botao grande
8. **Footer** -- Minimalista

### Copy Proposta

**Hero:**
- Titulo: "Automatize seus Grupos de WhatsApp e Escale seus Resultados"
- Subtitulo: "Envie mensagens em massa para todos os seus grupos no piloto automatico. Agende, personalize com IA e acompanhe tudo em tempo real."

**Funcionalidades (destaques):**
- "Disparo Ilimitado" -- Envie para centenas de grupos com um clique
- "Agendamento Inteligente" -- Programe envios diarios, semanais ou mensais
- "IA Integrada" -- Gere mensagens persuasivas automaticamente
- "Campanhas Organizadas" -- Gerencie tudo com campanhas estruturadas
- "Dashboard Completo" -- Acompanhe entregas, erros e taxa de sucesso
- "Multimidia" -- Texto, imagem, video, audio, documentos e enquetes
- "Anti-Ban" -- Fila com delay inteligente para proteger seu numero
- "Backup Seguro" -- Exporte e restaure seus dados a qualquer momento

**Planos:**
- Todos incluem: grupos ilimitados, disparos ilimitados, agendamentos, IA, dashboard, suporte
- Diferenca entre planos: quantidade de numeros conectados

### Detalhes Tecnicos

**Arquivos a criar:**
- `src/pages/LandingPage.tsx` -- Componente principal da landing page com todas as secoes

**Arquivos a modificar:**
- `src/App.tsx` -- Adicionar rota `/landing` publica (fora do ProtectedRoute)

**Abordagem:**
- Pagina totalmente standalone, sem dependencia do layout do app (AppLayout/Sidebar)
- Usa os mesmos design tokens (CSS variables) do projeto para consistencia
- Botoes CTA apontam para um link externo (placeholder `#` ate voce fornecer o link real do WhatsApp/checkout)
- Responsiva (mobile-first)
- Animacoes sutis com CSS (gradients, hover effects) sem bibliotecas extras
- Usa componentes UI existentes (Button, Card, Accordion, Badge)
- Logo importada de `src/assets/logo.png`

