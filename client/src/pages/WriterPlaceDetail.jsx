import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import './Lore.css';

export default function WriterPlaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [place, setPlace] = useState(null);
  const [allBooks, setAllBooks] = useState([]);
  const [saveState, setSaveState] = useState('idle');
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const debounceRef = useRef(null);

  function load() {
    api.writerPlace(id).then((data) => setPlace(data.place)).catch(() => {});
  }

  useEffect(() => {
    load();
    api.writerBooks().then((data) => setAllBooks(data.books)).catch(() => {});
  }, [id]);

  const scheduleSave = useCallback((patch) => {
    setSaveState('salvando');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        await api.updatePlace(id, patch);
        setSaveState('salvo');
      } catch (e) {
        setSaveState('erro');
      }
    }, 700);
  }, [id]);

  function updateField(field, value) {
    setPlace((p) => ({ ...p, [field]: value }));
    scheduleSave({ [field]: value });
  }

  async function handleDelete() {
    if (!window.confirm(`Excluir "${place.name}"? Isso nao pode ser desfeito.`)) return;
    await api.deletePlace(id);
    navigate('/escritor/lugares');
  }

  async function handleLinkBook(e) {
    const bookId = e.target.value;
    if (!bookId) return;
    await api.linkPlaceBook(id, bookId);
    load();
    e.target.value = '';
  }

  async function handleUnlinkBook(bookId) {
    await api.unlinkPlaceBook(id, bookId);
    load();
  }

  async function handleAddEvent(e) {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    await api.createPlaceEvent(id, { title: eventTitle.trim(), description: eventDescription.trim() });
    setEventTitle('');
    setEventDescription('');
    load();
  }

  async function handleDeleteEvent(eventId) {
    await api.deletePlaceEvent(id, eventId);
    load();
  }

  if (!place) return null;

  const linkedBookIds = new Set(place.books.map((b) => b.id));
  const availableBooks = allBooks.filter((b) => !linkedBookIds.has(b.id));

  return (
    <div className="lore-page">
      <Link className="lore-detail-back" to="/escritor/lugares">Voltar aos lugares</Link>

      <div className="lore-detail-header">
        <div className="lore-detail-avatar" style={{ background: place.photo_color, borderRadius: '4px' }} />
        <input
          className="lore-detail-name-input"
          value={place.name}
          onChange={(e) => updateField('name', e.target.value)}
        />
        <button className="lore-detail-delete" onClick={handleDelete}>Excluir</button>
      </div>

      <div className="lore-field">
        <label>Descricao</label>
        <textarea value={place.description || ''} onChange={(e) => updateField('description', e.target.value)} />
      </div>
      <div className="lore-field">
        <label>Historia do local</label>
        <textarea value={place.history || ''} onChange={(e) => updateField('history', e.target.value)} />
      </div>
      <div className="lore-field">
        <label>Anotacoes</label>
        <textarea value={place.notes || ''} onChange={(e) => updateField('notes', e.target.value)} />
      </div>

      <div className="lore-save-hint">
        {saveState === 'salvando' && 'Salvando...'}
        {saveState === 'salvo' && 'Salvo.'}
        {saveState === 'erro' && 'Erro ao salvar.'}
      </div>

      <h2 className="lore-section-heading">Aparece em</h2>
      <div className="lore-tag-list">
        {place.books.map((b) => (
          <span className="lore-tag" key={b.id}>
            {b.title}
            <button onClick={() => handleUnlinkBook(b.id)}>remover</button>
          </span>
        ))}
      </div>
      {availableBooks.length > 0 && (
        <select className="lore-add-tag-select" onChange={handleLinkBook} defaultValue="">
          <option value="" disabled>Adicionar a um livro</option>
          {availableBooks.map((b) => (
            <option key={b.id} value={b.id}>{b.title}</option>
          ))}
        </select>
      )}

      <h2 className="lore-section-heading">Eventos neste lugar</h2>
      {place.events.map((ev) => (
        <div className="lore-event-item" key={ev.id}>
          <div>
            <div className="lore-event-title">{ev.title}</div>
            {ev.description && <div className="lore-event-description">{ev.description}</div>}
          </div>
          <button className="lore-event-delete" onClick={() => handleDeleteEvent(ev.id)}>Excluir</button>
        </div>
      ))}

      <form className="lore-add-event-form" onSubmit={handleAddEvent}>
        <input
          placeholder="Titulo do evento"
          value={eventTitle}
          onChange={(e) => setEventTitle(e.target.value)}
        />
        <textarea
          placeholder="Descricao (opcional)"
          value={eventDescription}
          onChange={(e) => setEventDescription(e.target.value)}
        />
        <button type="submit">Adicionar evento</button>
      </form>
    </div>
  );
}
