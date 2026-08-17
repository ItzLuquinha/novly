# Security / reliability changes

Esta versão mantém o hardening anterior e migra o Novly para Cloudflare Workers + D1, sem Render e sem R2.

Principais proteções:

- sessão em cookie HttpOnly, revogável por `session_version`;
- secrets obrigatórios fora do código;
- backend decide quais campos leitor/escritor podem receber;
- validação de relacionamento entre livros, capítulos e lore;
- moderação restrita ao escritor;
- progresso de leitura medido/validado no servidor;
- autosave com revisão para evitar sobrescrita por requests antigas;
- uploads privados somente para usuários autenticados;
- imagens validadas por magic bytes e comprimidas no cliente;
- D1 media hard cap de 1,25 MB por imagem, 32 MB por usuário e 64 MB global;
- sem upload de vídeos para evitar uso excessivo de banco;
- operações destrutivas limpam imagens gerenciadas que deixam de ser usadas;
- scheduler nativo via Cron Trigger;
- headers de segurança e política same-origin;
- migrations e testes de regressão para a arquitetura Cloudflare.
