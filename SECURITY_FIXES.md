# Novly — correcoes de seguranca e robustez

Esta versao endurece o projeto original sem mudar o modelo principal de escritor/leitora.

## Corrigido

- Rascunhos, capitulos agendados e `writer_notes` nao sao mais enviados para a leitora.
- Lore de leitura usa campos permitidos e exclui notas internas.
- Sessao saiu do `localStorage`: agora usa cookie `HttpOnly`, `Secure` em hospedagem e versao revogavel no banco.
- Troca de senha/email revoga sessoes antigas; logout tambem revoga a sessao.
- Producao exige `JWT_SECRET` forte e `CLIENT_ORIGIN` explicito; credenciais antigas padrao sao detectadas/rotacionadas.
- Login e uploads possuem rate limit; o limitador faz limpeza para evitar crescimento de memoria por chaves unicas.
- Uploads validam tipo real (magic bytes), tamanho, quota e role. Arquivos antigos e orfaos sao limpos com seguranca.
- IDs de livro/capitulo/comentario/highlight e associacoes de lore sao validados no backend.
- A leitora nao pode mais pinar/resolver comentarios.
- Tempo de leitura nao e aceito do cliente; o backend mede atividade e exige progresso antes de concluir.
- Posicao de leitura e restaurada ao reabrir um capitulo.
- Bilhetes secretos sao descobertos por usuario e por ano.
- Backup usa a SQLite Backup API, gera snapshot real e mantem rotacao local.
- Autosave usa `revision`/optimistic concurrency para impedir sobrescrita por requests antigos ou outra aba.
- Sessoes de escrita abandonadas sao encerradas e as estatisticas usam `APP_TIMEZONE`.
- Publicacao agendada roda por scheduler em processo e tambem e reconciliada nas leituras.
- API de producao usa origem configuravel/same-origin; `client/vercel.json` inclui proxy e security headers/CSP.
- Gemini usa chave em `sessionStorage`, header `x-goog-api-key` e consentimento antes de enviar contexto.
- Exclusoes limpam referencias de favoritos e arquivos gerenciados relacionados.
- Foram adicionados testes de regressao, verificacao de sintaxe e workflow de CI.

## Variaveis importantes de producao

- `NODE_ENV=production`
- `CLIENT_ORIGIN=https://seu-frontend...`
- `JWT_SECRET=<32+ caracteres aleatorios>`
- `APP_TIMEZONE=America/New_York` (ou a timezone desejada)
- `DATA_DIR` e `UPLOAD_DIR` em armazenamento persistente
- `SEED_*` apenas para criar/rotacionar as contas iniciais; senhas com 12-72 caracteres

Se frontend e backend forem usados em dominios realmente cross-site, configure `COOKIE_SAME_SITE=none`; isso exige HTTPS. O proxy Vercel incluido evita essa necessidade no setup recomendado.

## Verificacao desta entrega

A arvore foi validada com `node --check` no backend, parse de todos os arquivos JS/JSX do projeto, validacao dos arquivos JSON e smoke tests reais de schema/query/backup usando `node:sqlite`.

O ambiente desta revisao nao possui acesso ao registry do npm, por isso nao foi possivel instalar as dependencias para executar o servidor Express completo, o build Vite ou gerar um `package-lock.json` novo aqui. As dependencias diretas foram fixadas em versoes exatas, `.npmrc` exige lockfile e o CI inclui os testes/build para rodarem assim que `npm install` tiver acesso ao registry.
