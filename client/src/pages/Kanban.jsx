import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import './Kanban.css';

const COLUMNS = [
  { key: 'ideia', label: 'Ideia' },
  { key: 'rascunho', label: 'Rascunho' },
  { key: 'revisao', label: 'Revisao' },
  { key: 'pronto', label: 'Pronto' },
];

export default function Kanban() {
  const { bookId } = useParams();
  const [cards, setCards] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [bookTitle, setBookTitle] = useState('');
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [newTitleByColumn, setNewTitleByColumn] = useState({});
  const [newChapterByColumn, setNewChapterByColumn] = useState({});

  function load() {
    api.writerKanban(bookId).then((data) => setCards(data.cards)).catch(() => {});
  }

  useEffect(() => {
    load();
    api.writerChapters(bookId).then((data) => setChapters(data.chapters)).catch(() => {});
    api.writerBooks().then((data) => {
      const found = data.books.find((b) => String(b.id) === bookId);
      setBookTitle(found?.title || '');
    });
  }, [bookId]);

  async function handleAdd(status, e) {
    e.preventDefault();
    const title = (newTitleByColumn[status] || '').trim();
    if (!title) return;
    await api.createKanbanCard(bookId, {
      title,
      status,
      chapter_id: newChapterByColumn[status] || null,
    });
    setNewTitleByColumn((s) => ({ ...s, [status]: '' }));
    setNewChapterByColumn((s) => ({ ...s, [status]: '' }));
    load();
  }

  async function handleDelete(id) {
    await api.deleteKanbanCard(id);
    load();
  }

  function handleDragStart(id) {
    setDraggingId(id);
  }

  function handleDragOver(e, columnKey) {
    e.preventDefault();
    setDragOverColumn(columnKey);
  }

  async function handleDrop(status) {
    if (draggingId == null) return;
    setDragOverColumn(null);
    const id = draggingId;
    setDraggingId(null);
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === status) return;
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    await api.moveKanbanCard(id, status);
    load();
  }

  if (!cards) return null;

  return (
    <div className="kanban-page">
      <Link className="kanban-back" to={`/escritor/livros/${bookId}`}>Voltar ao livro</Link>
      <h1 className="kanban-title">Quadro de {bookTitle}</h1>

      <div className="kanban-board">
        {COLUMNS.map((col) => {
          const columnCards = cards.filter((c) => c.status === col.key);
          return (
            <div className="kanban-column" key={col.key}>
              <div className="kanban-column-header">
                <span className="kanban-column-title">{col.label}</span>
                <span className="kanban-column-count">{columnCards.length}</span>
              </div>

              <div
                className={`kanban-column-dropzone${dragOverColumn === col.key ? ' drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, col.key)}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={() => handleDrop(col.key)}
              >
                {columnCards.map((card) => (
                  <div
                    key={card.id}
                    className={`kanban-card${draggingId === card.id ? ' dragging' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(card.id)}
                    onDragEnd={() => setDraggingId(null)}
                  >
                    <div className="kanban-card-title">{card.title}</div>
                    {card.chapter_title && (
                      <div className="kanban-card-chapter">{card.chapter_title}</div>
                    )}
                    {card.description && (
                      <div className="kanban-card-description">{card.description}</div>
                    )}
                    <div className="kanban-card-actions">
                      <button className="kanban-card-delete" onClick={() => handleDelete(card.id)}>
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <form className="kanban-add-form" onSubmit={(e) => handleAdd(col.key, e)}>
                <input
                  placeholder="Novo cartao"
                  value={newTitleByColumn[col.key] || ''}
                  onChange={(e) => setNewTitleByColumn((s) => ({ ...s, [col.key]: e.target.value }))}
                />
                <select
                  value={newChapterByColumn[col.key] || ''}
                  onChange={(e) => setNewChapterByColumn((s) => ({ ...s, [col.key]: e.target.value }))}
                >
                  <option value="">Sem capitulo</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <button type="submit">Adicionar</button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
