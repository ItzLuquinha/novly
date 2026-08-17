import { Link } from 'react-router-dom';
import './Legal.css';

export default function Privacy() {
  return (
    <div className="legal-page">
      <h1>Politica de privacidade</h1>
      <p className="legal-updated">Ultima atualizacao: 11 de agosto de 2026</p>

      <p>
        Esta politica descreve como o Novly trata dados nesta instancia privada
        (escritor e leitora).
      </p>

      <h2>1. Dados que coletamos</h2>
      <ul>
        <li>Email, nome de usuario, senha (armazenada como hash) e papel (escritor ou leitora).</li>
        <li>Conteudo que voce cria: livros, capitulos, notas, comentarios, destaques, progresso de leitura.</li>
        <li>Preferencias de interface (fundo, editor, corretor, sons ambiente).</li>
        <li>Imagens enviadas (capas, fotos de personagens, fundo), guardadas no servidor da instancia.</li>
      </ul>

      <h2>2. Como usamos</h2>
      <p>
        Os dados servem apenas para operar a plataforma: autenticacao, leitura,
        escrita, estatisticas de escrita e leitura, e preferencias pessoais.
        Nao vendemos dados a terceiros.
      </p>

      <h2>3. Armazenamento</h2>
      <p>
        Os dados ficam no banco e no armazenamento de arquivos do servidor onde
        esta instancia do Novly esta hospedada. A sessao de autenticacao usa cookie
        HttpOnly, Secure em producao e com expiracao limitada; o token nao fica disponivel ao JavaScript da pagina.
      </p>

      <h2>4. Servicos de terceiros</h2>
      <p>
        O corretor avancado pode enviar trechos de texto a API publica do
        LanguageTool, conforme a preferencia do usuario. Quando o Livrinho e usado,
        prompts e os trechos de contexto escolhidos podem ser enviados ao Google Gemini.
        A chave Gemini fica apenas na sessao atual do navegador. Fontes tipograficas
        podem ser carregadas de CDNs (ex: Google Fonts).
      </p>

      <h2>5. Seus controles</h2>
      <p>
        Voce pode alterar email, senha e preferencias em Configuracoes. O escritor
        pode excluir livros e capitulos (e dados associados). Pedidos de exclusao
        de conta devem ser combinados entre as partes que operam esta instancia.
      </p>

      <h2>6. Seguranca</h2>
      <p>
        Usamos hash de senha, cookies HttpOnly, sessoes revogaveis e validacao de permissoes no servidor. Nenhuma medida e absoluta;
        proteja suas credenciais e o acesso ao servidor.
      </p>

      <h2>7. Alteracoes</h2>
      <p>
        Esta politica pode ser atualizada. A data no topo indica a versao vigente.
      </p>

      <p>
        Veja tambem os <Link to="/termos">Termos de uso</Link>.
      </p>
    </div>
  );
}
