import { useState } from 'react';
import './ExternalBooks.css';

async function searchExternalBooks(query, page = 1) {
  // search api aqui -->
  void query;
  void page;
  return {
    results: [],
    total: 0,
    placeholder: true,
    message: 'Busca em bibliotecas externas ainda nao esta conectada.',
  };
}

function getDownloadLink(md5Hash) {
  // download api aqui -->
  void md5Hash;
  return null;
}

const SAMPLE_CARDS = [
  {
    id: 'sample-1',
    title: 'Dominio publico (exemplo)',
    author: 'Autor classico',
    year: '-',
    language: 'pt',
    format: 'EPUB / PDF',
    note: 'Card ilustrativo. Resultados reais aparecem apos conectar a API.',
  },
  {
    id: 'sample-2',
    title: 'Outro titulo de exemplo',
    author: 'Autora de exemplo',
    year: '1920',
    language: 'en',
    format: 'PDF',
    note: 'Use a busca acima quando a integracao estiver ativa.',
  },
];

export default function ExternalBooks() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(1);

  async function handleSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await searchExternalBooks(q, page);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Nao foi possivel buscar.');
    } finally {
      setLoading(false);
    }
  }

  function handleOpen(item) {
    const link = item.md5 ? getDownloadLink(item.md5) : item.url || null;
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      window.alert('Download ainda nao disponivel para este item.');
    }
  }

  const showSamples = !result || result.placeholder;

  return (
    <div className="external-books">
      <header className="external-books-header">
        <h2 className="external-books-title">Livros externos</h2>
        <p className="external-books-lead">
          Explore titulos fora da estante do Novly. Conecte sua API de busca e download
          nos pontos marcados no codigo.
        </p>
      </header>

      <form className="external-search" onSubmit={handleSearch}>
        <input
          type="search"
          className="external-search-input"
          placeholder="Buscar por titulo, autor..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar livros externos"
        />
        <button type="submit" className="external-search-btn" disabled={loading || !query.trim()}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {error && <p className="external-error">{error}</p>}

      {result?.placeholder && (
        <div className="external-placeholder-banner">
          <strong>API ainda nao conectada.</strong> Preencha as funcoes de busca e download
          no arquivo ExternalBooks.jsx.
        </div>
      )}

      <div className="external-grid">
        {(showSamples ? SAMPLE_CARDS : result.results).map((item) => (
          <article key={item.id || item.md5 || item.title} className="external-card">
            <div className="external-card-cover" aria-hidden="true">
              <span className="external-card-cover-label">Livro</span>
            </div>
            <div className="external-card-body">
              <h3 className="external-card-title">{item.title}</h3>
              <p className="external-card-meta">
                {item.author}
                {item.year && item.year !== '-' ? ` · ${item.year}` : ''}
                {item.language ? ` · ${item.language}` : ''}
              </p>
              {item.format && <p className="external-card-format">{item.format}</p>}
              {item.note && <p className="external-card-note">{item.note}</p>}
              <button type="button" className="external-card-action" onClick={() => handleOpen(item)}>
                Abrir / baixar
              </button>
            </div>
          </article>
        ))}
      </div>

      {result && !result.placeholder && result.results?.length === 0 && (
        <p className="external-empty">Nenhum resultado para essa busca.</p>
      )}

      {result && !result.placeholder && result.total > 25 && (
        <div className="external-pagination">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </button>
          <span>Pagina {page}</span>
          <button
            type="button"
            disabled={loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Proxima
          </button>
        </div>
      )}
    </div>
  );
}
