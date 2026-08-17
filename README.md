# Novly

Novly é uma plataforma privada de escrita/leitura agora preparada para rodar inteiramente na Cloudflare sem Render e **sem R2**.

## Infraestrutura

```text
Cloudflare Worker
├── React/Vite (Static Assets)
├── Express API
├── D1 (dados + imagens pequenas privadas)
└── Cron Trigger (capítulos agendados)
```

Esta edição é **free-only**: não requer ativar a assinatura R2. Imagens são comprimidas no navegador e possuem quotas rígidas; vídeos de fundo podem ser usados apenas por URL externa direta.

Leia **[CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md)** para aplicar a migration restante, configurar secrets e publicar.
