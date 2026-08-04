import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import './WriterBook.css';

export default function WriterBook() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [saveState, setSaveState] = useState('idle');
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
        <button className="writer-delete-book-btn" onClick={handleDeleteBook}>Excluir livro</button>
      </div>

      <div className="writer-form-section">
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
