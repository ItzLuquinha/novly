# Novly

Plataforma privada de leitura e escrita para duas pessoas: um escritor e uma leitora.

Persistencia real via Express e SQLite (modulo nativo `node:sqlite` do Node 22,
sem dependencias nativas compiladas). Nenhuma API paga em nenhum ponto:
autenticacao com JWT em cookie HttpOnly e sessao revogavel, banco local, fontes do Google Fonts, sons ambiente
sintetizados ao vivo via Web Audio API (nao sao arquivos de audio baixados).

## O que esta funcionando

**Leitura**
- Login com sessao real, dois usuarios fixos (escritor e leitora).
- Biblioteca em estante, com progresso calculado a partir de leitura de verdade.
  Livros 100% lidos migram para uma segunda estante, "Historias concluidas",
  com uma pequena animacao quando isso acontece durante a sessao.
- Fita dourada aparece na lombada conforme capitulos sao lidos.
- Leitor com fonte, espacamento, largura e tema ajustaveis; navegacao entre
  capitulos; posicao e percentual de leitura salvos e restaurados automaticamente.
  Um capitulo so entra nas estatisticas depois de progresso real suficiente e tempo medido no servidor.
- Selecionar um trecho permite destacar ("Palavras que ficaram") ou comentar
  naquele trecho especifico.
- Comentarios podem ser fixados e marcados como resolvidos pelo escritor; a leitora pode criar e excluir os proprios comentarios.
- Bilhetes escondidos: o escritor agenda uma mensagem para uma data especial
  (dia e mes, sem ano, para repetir todo ano), com descoberta registrada por usuario
  e por ano, e opcao de so aparecer depois que aquela pessoa tiver lido um capitulo especifico.
- Paginas de personagens, lugares, objetos e linha do tempo por livro, visiveis
  para a leitora (eventos da linha do tempo vinculados a capitulos em rascunho
  ficam ocultos, para nao dar spoiler).

**Escrita**
- Dashboard com contagem de livros, capitulos publicados/rascunho, palavras
  hoje/semana/mes, sequencia de dias escrevendo, mapa de calor e calendario de
  producao, e uma pena que ganha detalhes visuais conforme a meta diaria avanca.
- Criar, editar, publicar, despublicar e agendar capitulos. Publicacoes agendadas
  sao processadas por um scheduler no servidor. O autosave usa revisoes otimistas,
  fila de salvamento e deteccao de conflito entre abas/sessoes.
- Historico de versoes com snapshots nomeados e restauracao (a restauracao
  salva o estado atual antes, entao nada se perde).
- Preferencias de aparencia do editor: fonte, tamanho e cor do texto, salvas
  por usuario.
- Personagens, lugares, objetos e linha do tempo, com CRUD completo e vinculo
  a livros e capitulos especificos (marcados diretamente na tela do editor).
- Cada personagem pode ter uma foto de referencia real, enviada da galeria ou
  por link de imagem (nada de boneco gerado, e uma foto de verdade que o
  escritor escolhe).
- Quadro Kanban por livro (ideia, rascunho, revisao, pronto), com arrastar e
  soltar entre colunas.
- Organizador de cenas por capitulo, reordenavel.
- Temporizador Pomodoro no editor.
- Excluir um capitulo ou um livro inteiro (a exclusao de livro apaga tambem
  todos os capitulos, comentarios, destaques, versoes e cenas relacionados).

**Configuracoes** (`/configuracoes`, disponivel para os dois papeis)
- Trocar email e senha, exigindo confirmacao da senha atual.
- Trocar o fundo do site: temas prontos com ilustracoes tematicas reais em SVG
  (estante de livros para "biblioteca a noite", xicara de cafe para "cafeteria",
  chamas para "lareira acesa", chuva na janela para "madrugada", texturas de
  papel e couro), upload de foto da propria galeria, ou link de uma imagem.
  O tema padrao muda de tom sutilmente conforme o horario do dia.
- Apenas um som ambiente toca por vez: ligar um desliga automaticamente
  qualquer outro que estivesse tocando.

**Sons ambiente**
- Chuva, lareira, maquina de escrever e um piano instrumental suave (progressao
  de acordes tipo jazz, com reverb), cada um sintetizado ao vivo no navegador
  (ruido filtrado e osciladores), com volume individual.

**Corretor ortografico** (no editor, ativavel/desativavel por preferencia)
- Modo basico: verifica palavras comuns sem acento (ex: "nao" -> "não"),
  instantaneo, funciona sem internet.
- Modo avancado: usa a API publica e gratuita do LanguageTool para checagem
  completa de ortografia e gramatica em portugues. Esse servico e gratuito mas
  tem limite de 20 requisicoes por minuto por IP e depende de internet; o
  backend aplica seu proprio limite (15/min) e debounce de 2.5s para nao
  estourar isso, e mostra um aviso claro se o servico estiver indisponivel ou
  o limite for atingido. Sublinhados aparecem direto no texto, com sugestoes
  de correcao ao clicar.
- Pode ser desligado completamente a qualquer momento.

**Tour guiado**
- Na primeira vez que entra, cada pessoa recebe a opcao de fazer um tour
  guiado pela interface (aceitar ou recusar). O conteudo e diferente para
  escritor e leitora, apontando com uma seta animada e um holofote para cada
  elemento explicado, com navegacao entre passos.
- Tours contextuais menores acontecem tambem na primeira vez que a pessoa
  abre um capitulo para ler, e na primeira vez que o escritor abre o editor.
- A escolha e lembrada por pessoa (armazenada localmente no navegador); o
  tour pode ser refeito a qualquer momento pelo link "Ver tour novamente" no
  rodape da barra lateral.

## O que ainda nao existe

Modelos 3D reais de lugares e objetos (fica para uma proxima etapa; hoje
lugares e objetos usam apenas campos de texto/cor). Mapa geografico interativo
dos lugares (ficou como campo de texto/descricao, para nao depender de uma
API paga de mapas).

## Como rodar localmente

Backend:

```
npm install
npm run seed
npm run server
```

O seed cria as duas contas, sem nenhum livro. A biblioteca comeca vazia e
so tera conteudo quando o escritor publicar algo pelo proprio site. Por padrao:

- escritor@novly.local / trocar-esta-senha
- leitora@novly.local / trocar-esta-senha

Troque essas credenciais assim que possivel, direto pelo site em
Configuracoes, ou defina variaveis de ambiente antes do primeiro seed:
`SEED_WRITER_EMAIL`, `SEED_WRITER_PASSWORD`, `SEED_READER_EMAIL`,
`SEED_READER_PASSWORD`.

Frontend, em outro terminal:

```
cd client
npm install
npm run dev
```

O Vite roda em `http://localhost:5173` e ja tem proxy configurado para a API em
`http://localhost:4001`.

## Sobre uploads de imagem

Uploads ficam no `UPLOAD_DIR` (por padrao, `data/uploads`) e `/uploads/<arquivo>`
exige autenticacao. Capas e fotos de personagens exigem papel de escritor; tipos
de arquivo sao validados pelo conteudo, ha limite de tamanho, quota e rate limit.
Essa pasta e local ao servidor e nao faz parte do
controle de versao; se voce mudar de servidor, os uploads antigos nao viajam
junto a menos que voce copie a pasta manualmente.

## Sobre o deploy

Este build usa Express com sessao via cookie HttpOnly. Para colocar no ar de verdade,
o backend precisa rodar em algum lugar com processo persistente (nao GitHub
Pages). Ha opcoes gratuitas para isso, mas a escolha depende de como voces
querem manter o projeto no ar a longo prazo.


### Frontend no Vercel

Use `client/` como **Root Directory** do projeto Vercel. O arquivo
`client/vercel.json` ja faz proxy de `/api/*` e `/uploads/*` para o backend Render
atual e adiciona CSP e headers de seguranca. Isso mantem o cookie como first-party.
Se o endereco do backend mudar, altere apenas os dois destinos em `client/vercel.json`.
Nao defina `VITE_API_URL` no Vercel quando estiver usando esse proxy; o frontend usa
o proprio dominio por padrao.

## Estrutura

```
/
  server/
    db.js              schema SQLite e migracoes leves
    seed.js             cria as duas contas, sem conteudo
    auth.js              JWT, cookie HttpOnly e sessao revogavel
    security.js          validacao, rate limit e seguranca de uploads
    publishing.js        scheduler de publicacao
    timezone.js          datas/estatisticas no fuso configurado
    uploads/             fotos de fundo enviadas (nao versionado)
    routes/
      auth.js
      books.js                leitura: biblioteca, capitulos, progresso
      comments.js
      highlights.js
      home.js
      profile.js
      settings.js              email, senha, background
      uploads.js               upload de imagem de fundo
      notes.js                  bilhetes: checagem para a leitora
      writerBooks.js            CRUD de livros, exclusao completa
      writerChapters.js         editor, versionamento, lore por capitulo
      writerDashboard.js        estatisticas, historico, preferencias do editor
      writerCharacters.js
      writerPlaces.js
      writerObjects.js
      writerTimeline.js
      writerNotes.js             bilhetes: CRUD para o escritor
      writerKanban.js
      writerScenes.js
      bookLore.js                 personagens/lugares/objetos/timeline para leitura
  client/
    src/
      pages/           todas as telas, leitura e escrita
      components/       Shell, Pomodoro, AmbientSounds, HiddenNote, etc
      hooks/             useAuth, usePresence, useTimeOfDay, useResolvedBackground
      lib/                 api.js, ambientSounds.js, backgroundPresets.js
      styles/               global.css
```



## Persistencia no Render (importante)

Sem disco persistente, **cada deploy apaga o banco e os uploads** (livros, capas, etc.).

1. No Render: **Disks** → crie um disco (ex.: 1GB) montado em `/var/data`
2. Environment variables do servico:

```
DATA_DIR=/var/data
UPLOAD_DIR=/var/data/uploads
NODE_ENV=production
CLIENT_ORIGIN=https://seu-frontend.vercel.app
JWT_SECRET=use-pelo-menos-32-caracteres-aleatorios-e-exclusivos
APP_TIMEZONE=America/New_York
SEED_WRITER_EMAIL=seu@email.com
SEED_WRITER_PASSWORD=senha-forte-com-12+-caracteres
SEED_READER_EMAIL=leitora@email.com
SEED_READER_PASSWORD=outra-senha-forte-com-12+-caracteres
```

3. Em **Configuracoes** (escritor), use **Baixar backup do banco** de tempos em tempos.
   O backup usa a SQLite Backup API e o servidor mantem rotacao local dos 10 snapshots mais recentes.

Em ambiente hospedado, `CLIENT_ORIGIN` e um `JWT_SECRET` com pelo menos 32 caracteres sao obrigatorios. O servidor nao executa seed com credenciais padrao. Defina as variaveis `SEED_*` com senhas de pelo menos 12 caracteres no primeiro deploy. Se um banco antigo ainda tiver uma conta usando a senha padrao `trocar-esta-senha`, o servidor exige as `SEED_*` correspondentes e rotaciona essa conta no proprio ID, preservando os livros existentes.

## Testes e CI

- `npm run check:server` valida sintaxe de todos os arquivos do backend.
- `npm test` executa testes de regressao de seguranca (vazamento de rascunho/notas,
  permissoes, autosave concorrente, leitura, bilhetes, backup e scheduler).
- `.github/workflows/ci.yml` roda os testes e faz build do frontend em push/PR.
- Dependencias diretas estao fixadas em versoes exatas e `.npmrc` força a criacao de
  `package-lock.json`; depois do primeiro `npm install`, mantenha o lockfile versionado.
