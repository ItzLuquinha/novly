# Novly na Cloudflare — Free-only (sem R2)

Esta variante foi feita para ficar no **Workers Free + D1 Free** sem ativar R2 nem adicionar uma assinatura pay-as-you-go de armazenamento.

## Arquitetura

- **Cloudflare Worker + Static Assets**: React e API no mesmo domínio.
- **D1**: banco do Novly e imagens pequenas privadas.
- **Cron Trigger**: publica capítulos agendados.
- **Sem R2**: nenhum binding/bucket R2 é necessário.

### Limites de mídia definidos pelo próprio Novly

Para proteger o banco e manter o projeto pequeno:

- imagens são comprimidas no navegador para WebP antes do upload;
- cada imagem enviada fica abaixo de ~1,1 MB e o servidor recusa acima de 1,25 MB;
- quota por usuário: 32 MB;
- quota global do Novly: 64 MB;
- upload de vídeo foi removido;
- wallpaper vivo continua disponível por **URL HTTPS direta para .mp4/.webm**.

O D1 Free não cobra excedentes automaticamente: quando uma conta Free atinge limites de uso/armazenamento, operações passam a falhar até o reset ou até liberar espaço. Mesmo assim, as quotas acima evitam que as imagens ocupem uma parcela grande do banco.

## Seu banco D1

Este pacote já está configurado para o banco criado durante esta instalação:

- database name: `novly-db`
- database id: `5aea08c4-44d2-489c-962f-5a8a15dd79d9`
- binding: `DB`

A migration `0001_initial.sql` já foi aplicada por você. Depois de substituir os arquivos pela versão deste ZIP, rode:

```bat
npm run cf:db:remote
```

O Wrangler deverá mostrar apenas a nova migration:

```text
0002_d1_uploads.sql
```

Confirme com `Y`. Ela cria a tabela privada `uploaded_files`.

## Secrets

Cadastre os secrets do Worker (não coloque no `wrangler.jsonc`):

```bat
npx wrangler secret put JWT_SECRET
npx wrangler secret put PASSWORD_PEPPER
npx wrangler secret put SEED_WRITER_EMAIL
npx wrangler secret put SEED_WRITER_PASSWORD
npx wrangler secret put SEED_READER_EMAIL
npx wrangler secret put SEED_READER_PASSWORD
```

Use valores diferentes para `JWT_SECRET` e `PASSWORD_PEPPER`. As senhas das contas devem ter 12–72 caracteres.

## Deploy

Depois dos secrets:

```bat
npm run deploy
```

No fim, Wrangler mostrará a URL `https://novly.<seu-subdominio>.workers.dev`.

Teste primeiro:

```text
https://novly.<seu-subdominio>.workers.dev/api/health
```

Resposta esperada:

```json
{"ok":true,"platform":"cloudflare-workers"}
```

Depois abra a URL principal e faça login.

## Backup

No site, o escritor pode baixar o backup lógico JSON. Para exportar o D1 inteiro em SQL:

```bat
npm run cf:db:export
```

Isso cria `novly-d1-backup.sql`.

## Desenvolvimento local

Crie `.dev.vars` a partir de `.dev.vars.example`, depois:

```bat
npm run cf:db:local
npm run dev
```

Abra `http://localhost:8787`.
