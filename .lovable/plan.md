

# Sistema de Backup e Restauracao

## Resumo
Criar uma pagina de Backup/Restauracao acessivel pelo menu lateral, onde o usuario pode:
1. **Exportar** todos os dados em um unico arquivo `.json` (dados do banco + arquivos de midia convertidos em base64 embutidos no JSON)
2. **Importar** um arquivo `.json` para restaurar todos os dados em outro sistema

## O que sera incluido no backup

| Dados | Descricao |
|-------|-----------|
| Instancias (api_configs) | URLs, chaves, limites |
| Campanhas (campaigns) | Nome, grupos, configuracoes |
| Mensagens agendadas (scheduled_messages) | Agendamentos, cron, conteudo |
| Templates (message_templates) | Modelos de mensagem |
| Historico (message_logs) | Registros de envio |
| Perfil (profiles) | Nome de exibicao |
| Arquivos de midia | Imagens, videos, audios do storage bucket "media" |

## Como funciona

### Backup (Exportar)
1. Busca todos os registros do usuario em cada tabela
2. Para cada URL de midia encontrada nos templates/mensagens, faz download do arquivo e converte para base64
3. Gera um objeto JSON com metadados (versao, data, email) + todos os dados + midias embutidas
4. Baixa como arquivo `.json` no navegador

### Restauracao (Importar)
1. Usuario seleciona o arquivo `.json`
2. Sistema valida a estrutura do arquivo
3. Faz upload das midias de volta para o storage, obtendo novas URLs
4. Substitui as URLs antigas pelas novas nos dados
5. Insere os dados nas tabelas na ordem correta (respeitando dependencias):
   - api_configs primeiro
   - campaigns (depende de api_configs)
   - scheduled_messages (depende de api_configs e campaigns)
   - message_templates
   - message_logs
   - profiles (update)
6. Mapeia IDs antigos para novos IDs gerados, mantendo as referencias corretas

## Mudancas no codigo

### Novos arquivos
- `src/pages/BackupPage.tsx` - Pagina principal com botoes de Backup e Restauracao
- `src/lib/backup.ts` - Logica de exportacao e importacao (funcoes utilitarias)

### Arquivos modificados
- `src/App.tsx` - Adicionar rota `/backup`
- `src/components/AppSidebar.tsx` - Adicionar item "Backup" no menu

### Detalhes tecnicos

**Exportacao:**
- Edge function `backup-export` para buscar arquivos do storage e converter para base64 (evita problemas de CORS)
- Arquivo JSON compactado com estrutura versionada

**Importacao:**
- Processamento no cliente com feedback de progresso
- Mapeamento de IDs antigos -> novos via `Map<string, string>`
- Ordem de insercao: api_configs -> campaigns -> scheduled_messages/templates/logs
- Re-upload de midias para o bucket "media" com novos paths

**Estrutura do arquivo de backup:**
```text
{
  "version": 1,
  "created_at": "2026-02-13T...",
  "user_email": "user@example.com",
  "data": {
    "profiles": [...],
    "api_configs": [...],
    "campaigns": [...],
    "scheduled_messages": [...],
    "message_templates": [...],
    "message_logs": [...]
  },
  "media": {
    "path/arquivo.jpg": "data:image/jpeg;base64,..."
  }
}
```

**Edge function `backup-export`:**
- Recebe lista de URLs de midia
- Faz fetch de cada uma e retorna os arquivos em base64
- Necessaria porque o browser nao consegue fazer fetch direto do storage por CORS

