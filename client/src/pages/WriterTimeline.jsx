import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import './Timeline.css';

export default function WriterTimeline() {
  const { bookId } = useParams();
  const [events, setEvents] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [bookTitle, setBookTitle] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [chapterId, setChapterId] = useState('');

  function load() {
    api.writerTimeline(bookId).then((data) => setEvents(data.events)).catch(() => {});
  }

  useEffect(() => {
    load();
    api.writerChapters(bookId).then((data) => setChapters(data.chapters)).catch(() => {});
    api.writerBooks().then((data) => {
      const found = data.books.find((b) => String(b.id) === bookId);
      setBookTitle(found?.title || '');
    });
  }, [bookId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await api.createTimelineEvent(bookId, {
      title: title.trim(),
      description: description.trim(),
      event_date: eventDate.trim(),
      chapter_id: chapterId || null,
    });
    setTitle('');
    setDescription('');
    setEventDate('');
    setChapterId('');
    load();
  }

  async function handleDelete(id) {
    await api.deleteTimelineEvent(id);
    load();
  }

  async function handleReorder(id, direction) {
    await api.reorderTimelineEvent(id, direction);
    load();
  }

  return (
    <div className="timeline-page">
      <Link className="timeline-back" to={`/escritor/livros/${bookId}`}>Voltar ao livro</Link>
      <h1 className="timeline-title">Linha do tempo de {bookTitle}</h1>

      {events?.length === 0 && (
        <p className="timeline-empty">Nenhum evento na cronologia ainda.</p>
      )}

      {events?.length > 0 && (
        <div className="timeline-track">
          {events.map((ev, i) => (
            <div className="timeline-event" key={ev.id}>
              <div className="timeline-event-row">
                <div>
                  {ev.event_date && <div className="timeline-event-date">{ev.event_date}</div>}
                  <div className="timeline-event-title">{ev.title}</div>
                  {ev.description && <div className="timeline-event-description">{ev.description}</div>}
                  {ev.chapter_title && (
                    <div className="timeline-event-chapter">Capitulo: {ev.chapter_title}</div>
                  )}
                </div>
                <div className="timeline-event-actions">
                  <button onClick={() => handleReorder(ev.id, 'up')} disabled={i === 0}>Cima</button>
                  <button onClick={() => handleReorder(ev.id, 'down')} disabled={i === events.length - 1}>Baixo</button>
                  <button className="delete" onClick={() => handleDelete(ev.id)}>Excluir</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <form className="timeline-add-form" onSubmit={handleAdd}>
        <div className="timeline-add-form-row">
          <input
            placeholder="Titulo do evento"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            placeholder="Data (livre)"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
          <select value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
            <option value="">Sem capitulo</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <textarea
          placeholder="Descricao (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit">Adicionar evento</button>
      </form>
    </div>
  );
}
