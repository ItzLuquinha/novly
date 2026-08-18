# Livrinho 2.0

O Livrinho agora e um assistente editorial conectado ao contexto privado do Novly.

## Modos
- **Escrever**: continuar, reescrever selecao, aumentar tensao e sugerir dialogo. Mudancas so entram no editor apos confirmacao.
- **Analisar**: continuidade, diagnostico de cena, checkup do capitulo, voz dos personagens e extracao de possiveis fatos para a Story Bible.
- **Canon**: consulta o contexto do livro e faz busca em capitulos antigos para perguntas factuais.
- **Brainstorm**: proximas cenas, caminhos alternativos, foreshadowing e testes de plot twist, sempre tratados como hipotese.

## Context Engine
No editor, o backend envia ao escritor um contexto compacto com livro, capitulo, finais recentes, cenas, personagens, lugares, objetos, relacoes, localizacoes, timeline e kanban. O manuscrito atual e lido diretamente do editor para evitar contexto desatualizado.

## Memoria e privacidade
O historico recente do Livrinho fica salvo localmente por capitulo no navegador. A chave Gemini continua apenas em sessionStorage. Antes do primeiro uso, o Novly pede consentimento para enviar pergunta/contexto necessario ao Gemini.

## Protecao do manuscrito
Respostas de escrita nunca alteram o texto automaticamente. Ao aplicar uma sugestao, o editor verifica se a selecao/ancora ainda e a mesma usada quando a resposta foi gerada. Se o texto mudou, a aplicacao e recusada para evitar sobrescrita acidental.
