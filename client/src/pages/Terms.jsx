import { Link } from 'react-router-dom';
import './Legal.css';

export default function Terms() {
  return (
    <div className="legal-page">
      <h1>Termos de uso</h1>
      <p className="legal-updated">Ultima atualizacao: 11 de agosto de 2026</p>

      <p>
        Estes termos regem o uso do Novly, plataforma privada de leitura e escrita
        compartilhada entre o escritor e a leitora cadastrados.
      </p>

      <h2>1. Conta e acesso</h2>
      <p>
        O acesso e restrito aos usuarios autorizados. Voce e responsavel por manter
        a confidencialidade das suas credenciais e por toda atividade feita na sua conta.
      </p>

      <h2>2. Conteudo</h2>
      <ul>
        <li>
          O conteudo original publicado pelo escritor no Novly permanece sob a
          titularidade dele, salvo acordo em contrario.
        </li>
        <li>
          A leitora pode comentar, destacar trechos e registrar progresso apenas
          no ambito da plataforma.
        </li>
        <li>
          E proibido republicar, distribuir ou comercializar o conteudo do Novly
          fora da plataforma sem autorizacao expressa do titular.
        </li>
      </ul>


      <h2>3. Uso aceitavel</h2>
      <p>
        Nao e permitido tentar obter acesso nao autorizado ao sistema, interferir
        no funcionamento do servico, ou usar a plataforma de forma ilegal.
      </p>

      <h2>4. Disponibilidade</h2>
      <p>
        O servico e oferecido como esta. Podem ocorrer interrupcoes para manutencao
        ou por motivos fora do nosso controle.
      </p>

      <h2>5. Alteracoes</h2>
      <p>
        Estes termos podem ser atualizados. O uso continuado apos a publicacao de
        mudancas implica aceite da versao vigente.
      </p>

      <h2>6. Contato</h2>
      <p>
        Duvidas sobre estes termos podem ser tratadas diretamente entre as partes
        que usam esta instancia do Novly.
      </p>

      <p>
        Veja tambem a <Link to="/privacidade">Politica de privacidade</Link>.
      </p>
    </div>
  );
}
