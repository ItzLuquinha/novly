# Novly

Plataforma privada de leitura e escrita para duas pessoas: um escritor e uma leitora.

Persistencia real via Express e SQLite (modulo nativo `node:sqlite` do Node 22,
sem dependencias nativas compiladas). Nenhuma API paga em nenhum ponto:
autenticacao com JWT proprio, banco local, fontes do Google Fonts, sons ambiente
sintetizados ao vivo via Web Audio API (nao sao arquivos de audio baixados).

## O que esta funcionando

**Leitura**
- Login com sessao real, dois usuarios fixos (escritor e leitora).
- Biblioteca em estante, com progresso calculado a partir de leitura de verdade.
  Livros 100% lidos migram para uma segunda estante, "Historias concluidas",
  com uma pequena animacao quando isso acontece durante a sessao.
- Fita dourada aparece na lombada conforme capitulos sao lidos.
- Leitor com fonte, espacamento, largura e tema ajustaveis; navegacao entre
  capitulos; posicao de leitura salva automaticamente.
- Selecionar um trecho permite destacar ("Palavras que ficaram") ou comentar
  naquele trecho especifico.
- Comentarios podem ser fixados e marcados como resolvidos.
- Bilhetes escondidos: o escritor agenda uma mensagem para uma data especial
  (dia e mes, sem ano, para repetir todo ano), com a opcao de so aparecer depois
  que a leitora ja tiver lido um capitulo especifico.
- Paginas de personagens, lugares, objetos e linha do tempo por livro, visiveis
  para a leitora (eventos da linha do tempo vinculados a capitulos em rascunho
  ficam ocultos, para nao dar spoiler).

**Escrita**
- Dashboard com contagem de livros, capitulos publicados/rascunho, palavras
  hoje/semana/mes, sequencia de dias escrevendo, mapa de calor e calendario de
  producao, e uma pena que ganha detalhes visuais conforme a meta diaria avanca.
- Criar, editar, publicar, despublicar e agendar capitulos. Autosave real
  (debounce), com contagem de palavras/caracteres/paragrafos em tempo real.
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

Fotos de fundo enviadas pela galeria ficam salvas em `server/uploads/`, servidas
em `/uploads/<arquivo>`. Essa pasta e local ao servidor e nao faz parte do
controle de versao; se voce mudar de servidor, os uploads antigos nao viajam
junto a menos que voce copie a pasta manualmente.

## Sobre o deploy

Este build usa Express com sessao via cookie. Para colocar no ar de verdade,
o backend precisa rodar em algum lugar com processo persistente (nao GitHub
Pages). Ha opcoes gratuitas para isso, mas a escolha depende de como voces
querem manter o projeto no ar a longo prazo.

## Estrutura

```
/
  server/
    db.js              schema SQLite e migracoes leves
    seed.js             cria as duas contas, sem conteudo
    auth.js              JWT e middleware
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

