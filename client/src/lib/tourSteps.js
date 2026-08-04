export const READER_TOUR = [
  {
    target: '[data-tour="nav-marca"]',
    title: 'Bem vinda ao Novly',
    text: 'Este e o espaco de voces dois. Aqui voce acompanha cada historia que ele escreve para voce, capitulo por capitulo. Vamos dar uma volta rapida?',
    placement: 'right',
  },
  {
    route: '/',
    target: '[data-tour="home-grid"]',
    title: 'Sua pagina inicial',
    text: 'Aqui aparece onde voce parou de ler, o comentario mais recente, e o proximo lancamento. E o primeiro lugar para olhar quando entrar.',
    placement: 'bottom',
  },
  {
    route: '/biblioteca',
    target: '[data-tour="nav-biblioteca"]',
    title: 'Biblioteca',
    text: 'Todos os livros publicados vivem aqui, como uma estante de verdade. Livros que voce ja terminou de ler ganham uma estante propria, "Historias concluidas".',
    placement: 'right',
  },
  {
    route: '/biblioteca',
    target: '[data-tour="library-shelf"]',
    title: 'Clique em um livro',
    text: 'Cada lombada mostra o progresso da leitura. Clique em qualquer uma para abrir a pagina do livro e ver os capitulos.',
    placement: 'top',
    optional: true,
  },
  {
    route: '/favoritos',
    target: '[data-tour="nav-favoritos"]',
    title: 'Palavras que ficaram',
    text: 'Quando voce destacar uma frase durante a leitura, ela aparece aqui, guardada para sempre.',
    placement: 'right',
  },
  {
    route: '/configuracoes',
    target: '[data-tour="nav-configuracoes"]',
    title: 'Configuracoes',
    text: 'Troque seu email, senha, ou o fundo do site aqui, quando quiser.',
    placement: 'right',
  },
];

export const READER_CHAPTER_TOUR = [
  {
    target: '[data-tour="reader-texto"]',
    title: 'Selecione um trecho',
    text: 'Passe o mouse e selecione qualquer frase para destacar ou deixar um comentario ali mesmo, na margem.',
    placement: 'top',
  },
  {
    target: '[data-tour="reader-comentarios"]',
    title: 'Notas do capitulo',
    text: 'Todos os comentarios deste capitulo aparecem aqui, incluindo os que ele responder.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="reader-ajustes"]',
    title: 'Do seu jeito',
    text: 'Ajuste o tamanho da fonte, o espacamento, a largura do texto, e o tema de leitura como preferir.',
    placement: 'bottom',
  },
];

export const WRITER_TOUR = [
  {
    target: '[data-tour="nav-marca"]',
    title: 'Bem vindo de volta',
    text: 'Este e o seu espaco para escrever para ela. Vamos passar rapidamente pelas ferramentas principais.',
    placement: 'right',
  },
  {
    route: '/escritor',
    target: '[data-tour="nav-escrever"]',
    title: 'Painel do escritor',
    text: 'Aqui fica tudo relacionado a escrita: seus livros, estatisticas, e o calendario de producao.',
    placement: 'right',
  },
  {
    route: '/escritor',
    target: '[data-tour="dashboard-stats"]',
    title: 'Seu progresso',
    text: 'Palavras escritas, sequencia de dias, e sua meta diaria, tudo em um lugar.',
    placement: 'bottom',
    optional: true,
  },
  {
    route: '/escritor',
    target: '[data-tour="dashboard-novo-livro"]',
    title: 'Comece um livro novo',
    text: 'Clique aqui quando quiser comecar uma historia nova. Depois e so criar capitulos e escrever.',
    placement: 'bottom',
  },
  {
    route: '/escritor',
    target: '[data-tour="nav-personagens"]',
    title: 'Personagens, lugares e objetos',
    text: 'Catalogue tudo sobre o mundo da sua historia aqui: quem sao os personagens, onde as cenas acontecem, e os objetos importantes.',
    placement: 'right',
  },
  {
    route: '/escritor',
    target: '[data-tour="nav-bilhetes"]',
    title: 'Bilhetes escondidos',
    text: 'Deixe uma mensagem escondida para ela encontrar em uma data especial, como um aniversario.',
    placement: 'right',
  },
];

export const WRITER_EDITOR_TOUR = [
  {
    target: '[data-tour="editor-texto"]',
    title: 'Escreva aqui',
    text: 'Tudo e salvo automaticamente enquanto voce digita. Sem botao de salvar, sem se preocupar.',
    placement: 'top',
  },
  {
    target: '[data-tour="editor-lore"]',
    title: 'Marque quem aparece',
    text: 'Vincule os personagens e lugares que aparecem neste capitulo especifico, direto daqui.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="editor-cenas"]',
    title: 'Organize em cenas',
    text: 'Quebre o capitulo em cenas menores para manter a estrutura clara.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="editor-versao"]',
    title: 'Historico de versoes',
    text: 'Crie uma versao salva a qualquer momento, e volte para ela depois se precisar.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="editor-publicar"]',
    title: 'Quando estiver pronto',
    text: 'Publique para ela ler na hora, ou agende para uma data especial.',
    placement: 'bottom',
  },
];
