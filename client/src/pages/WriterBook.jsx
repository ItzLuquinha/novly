import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, mediaUrl } from '../lib/api';
import './WriterBook.css';

export default function WriterBook() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [saveState, setSaveState] = useState('idle');
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState('');
  const [coverTab, setCoverTab] = useState('upload');
  const [coverUrlValue, setCoverUrlValue] = useState('');
  const debounceRef = useRef(null);

  function loadChapters() {
    api.writerChapters(bookId).then((data) => setChapters(data.chapters)).catch(() => {});
  }

  useEffect(() => {
    api.writerBooks().then((data) => {
      const found = data.books.find((b) => String(b.id) === bookId);
      setBook(found || null);
    });
    loadChapters();
  }, [bookId]);

  const scheduleSave = useCallback((patch) => {
    setSaveState('salvando');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.updateBook(bookId, patch);
        setBook(res.book);
        setSaveState('salvo');
      } catch (e) {
        setSaveState('erro');
      }
    }, 700);
  }, [bookId]);

  function updateField(field, value) {
    setBook((b) => ({ ...b, [field]: value }));
    scheduleSave({ [field]: value });
  }

  async function handlePublishBook() {
    const res = await api.publishBook(bookId);
    setBook(res.book);
  }

  async function handleDeleteBook() {
    const confirmed = window.confirm(
      `Excluir "${book.title}" para sempre? Isso apaga todos os capitulos, comentarios, destaques e historico de versoes deste livro. Nao pode ser desfeito.`
    );
    if (!confirmed) return;
    await api.deleteBook(bookId);
    navigate('/escritor');
  }

  async function handleAddChapter() {
    const res = await api.createChapter(bookId, { title: 'Novo capitulo' });
    navigate(`/escritor/capitulos/${res.chapter.id}`);
  }

  async function handleDeleteChapter(id, e) {
    e.stopPropagation();
    if (!window.confirm('Excluir este capitulo? Isso tambem remove seu historico de versoes.')) return;
    await api.deleteChapter(id);
    loadChapters();
  }

  async function handleReorder(id, direction, e) {
    e.stopPropagation();
    await api.reorderChapter(id, direction);
    loadChapters();
  }

  async function handleCoverFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverBusy(true);
    setCoverError('');
    try {
      const data = await api.uploadBookCover(file);
      updateField('cover_url', data.url);
    } catch (err) {
      setCoverError(err.message || 'Falha ao enviar a capa.');
    } finally {
      setCoverBusy(false);
      e.target.value = '';
    }
  }

  function handleCoverUrlSubmit(e) {
    e.preventDefault();
    if (!coverUrlValue.trim()) return;
    updateField('cover_url', coverUrlValue.trim());
    setCoverUrlValue('');
  }

  function handleRemoveCover() {
    updateField('cover_url', '');
  }

  async function handleExport() {
    try {
      const data = await api.exportBook(bookId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${book.slug || book.title || 'livro'}-novly.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(err.message || 'Falha ao exportar.');
    }
  }

  if (!book) return null;

  return (
    <div className="writer-book-page">
      <Link className="writer-book-back" to="/escritor">Voltar ao painel</Link>

      <div className="writer-book-title-row">
        <h1 className="writer-book-page-title">{book.title}</h1>
        <Link className="writer-book-back" to={`/escritor/livros/${bookId}/linha-do-tempo`} style={{ marginBottom: 0 }}>
          Linha do tempo
        </Link>
        <Link className="writer-book-back" to={`/escritor/livros/${bookId}/quadro`} style={{ marginBottom: 0 }}>
          Quadro
        </Link>
        {book.published_at ? (
          <span className="writer-publish-badge live">Publicado</span>
        ) : (
          <button className="writer-publish-btn" onClick={handlePublishBook}>Publicar livro</button>
        )}
        <button className="writer-export-btn" onClick={handleExport}>Exportar</button>
        <button className="writer-delete-book-btn" onClick={handleDeleteBook}>Excluir livro</button>
      </div>

      <div className="writer-form-section">
        <h2 className="writer-chapters-heading" style={{ marginTop: 0 }}>Capa do livro</h2>
        <p className="cover-size-hint">
          Tamanho recomendado da capa: <strong>1600 x 2560 pixels</strong> (proporcao 5:8, retrato).
          Aceita JPG, PNG ou WebP ate 8 MB. Imagens menores tambem funcionam, mas podem perder nitidez na estante.
        </p>
        {book.cover_url ? (
          <div className="book-cover-preview">
            <img src={mediaUrl(book.cover_url)} alt="Capa" />
            <button className="character-photo-remove" onClick={handleRemoveCover} type="button">Remover capa</button>
          </div>
        ) : (
          <>
            <div className="character-photo-tabs">
              <button
                className={`character-photo-tab${coverTab === 'upload' ? ' active' : ''}`}
                onClick={() => setCoverTab('upload')}
                type="button"
              >
                Da galeria
              </button>
              <button
                className={`character-photo-tab${coverTab === 'url' ? ' active' : ''}`}
                onClick={() => setCoverTab('url')}
                type="button"
              >
                Link de imagem
              </button>
            </div>
            {coverTab === 'upload' && (
              <label className="character-photo-upload-zone">
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleCoverFile} disabled={coverBusy} />
                <p>{coverBusy ? 'Enviando...' : 'Clique para escolher a capa (1600 x 2560 px ideal)'}</p>
              </label>
            )}
            {coverTab === 'url' && (
              <form className="character-photo-url-row" onSubmit={handleCoverUrlSubmit}>
                <input
                  type="url"
                  placeholder="https://..."
                  value={coverUrlValue}
                  onChange={(e) => setCoverUrlValue(e.target.value)}
                  required
                />
                <button type="submit">Usar este link</button>
              </form>
            )}
            {coverError && <p className="character-photo-error">{coverError}</p>}
          </>
        )}

        <div className="writer-field-row" style={{ marginTop: 'var(--space-4)' }}>
          <div className="writer-field">
            <label htmlFor="cover_color">Cor da capa</label>
            <input
              id="cover_color"
              type="color"
              value={book.cover_color || '#4a3728'}
              onChange={(e) => updateField('cover_color', e.target.value)}
            />
          </div>
          <div className="writer-field">
            <label htmlFor="spine_color">Cor da lombada</label>
            <input
              id="spine_color"
              type="color"
              value={book.spine_color || '#3a2b1f'}
              onChange={(e) => updateField('spine_color', e.target.value)}
            />
          </div>
        </div>

        <div className="writer-field-row">
          <div className="writer-field">
            <label htmlFor="title">Titulo</label>
            <input id="title" value={book.title} onChange={(e) => updateField('title', e.target.value)} />
          </div>
          <div className="writer-field">
            <label htmlFor="category">Categoria</label>
            <input id="category" value={book.category || ''} onChange={(e) => updateField('category', e.target.value)} />
          </div>
        </div>
        <div className="writer-field" style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="synopsis">Sinopse</label>
          <textarea id="synopsis" value={book.synopsis || ''} onChange={(e) => updateField('synopsis', e.target.value)} />
        </div>
        <div className="writer-field" style={{ marginBottom: 'var(--space-4)' }}>
          <label htmlFor="warnings">Avisos</label>
          <input id="warnings" value={book.warnings || ''} onChange={(e) => updateField('warnings', e.target.value)} />
        </div>
        <div className="writer-field">
          <label htmlFor="notes">Notas do escritor</label>
          <textarea id="notes" value={book.writer_notes || ''} onChange={(e) => updateField('writer_notes', e.target.value)} />
        </div>
        <div className="writer-field" style={{ marginTop: 'var(--space-4)' }}>
          <label htmlFor="reader_guide">Guia do livro (primeira pagina)</label>
          <p className="cover-size-hint" style={{ marginBottom: '0.5rem' }}>
            Texto que a leitora ve no inicio do livro: mapa de personagens, avisos de tom, como ler, etc.
          </p>
          <textarea
            id="reader_guide"
            value={book.reader_guide || ''}
            onChange={(e) => updateField('reader_guide', e.target.value)}
            rows={6}
            placeholder="Ex: Este livro tem tres arcos. Clara e a protagonista..."
          />
        </div>
        <div className="writer-save-hint">
          {saveState === 'salvando' && 'Salvando...'}
          {saveState === 'salvo' && 'Salvo.'}
          {saveState === 'erro' && 'Erro ao salvar.'}
        </div>
      </div>

      <div className="writer-chapters-heading-row">
        <h2 className="writer-chapters-heading">Capitulos</h2>
        <button className="writer-add-chapter-btn" onClick={handleAddChapter}>Novo capitulo</button>
      </div>

      {chapters.map((chapter, i) => (
        <div className="writer-chapter-row" key={chapter.id}>
          <div className="writer-chapter-reorder">
            <button onClick={(e) => handleReorder(chapter.id, 'up', e)} disabled={i === 0}>Cima</button>
            <button onClick={(e) => handleReorder(chapter.id, 'down', e)} disabled={i === chapters.length - 1}>Baixo</button>
          </div>
          <span
            className="writer-chapter-row-title"
            onClick={() => navigate(`/escritor/capitulos/${chapter.id}`)}
          >
            {chapter.title}
          </span>
          <span className={`writer-chapter-status ${chapter.status}`}>
            {chapter.status === 'publicado' ? 'Publicado' : chapter.status === 'agendado' ? 'Agendado' : 'Rascunho'}
          </span>
          <span className="writer-chapter-meta">{chapter.word_count} palavras</span>
          <button className="writer-chapter-delete" onClick={(e) => handleDeleteChapter(chapter.id, e)}>
            Excluir
          </button>
        </div>
      ))}
    </div>
  );
}
