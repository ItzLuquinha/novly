import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import './Timeline.css';

export default function BookTimeline() {
  const { slug } = useParams();
  const [events, setEvents] = useState(null);
  const [bookTitle, setBookTitle] = useState('');

  useEffect(() => {
    api.book(slug).then((data) => setBookTitle(data.book.title)).catch(() => {});
    api.bookTimeline(slug).then((data) => setEvents(data.events)).catch(() => setEvents([]));
  }, [slug]);

  return (
    <div className="timeline-page">
      <Link className="timeline-back" to={`/biblioteca/${slug}`}>Voltar ao livro</Link>
      <h1 className="timeline-title">Linha do tempo de {bookTitle}</h1>

      {events?.length === 0 && (
        <p className="timeline-empty">Nenhum evento revelado na historia ainda.</p>
      )}

      {events?.length > 0 && (
        <div className="timeline-track">
          {events.map((ev) => (
            <div className="timeline-event" key={ev.id}>
              {ev.event_date && <div className="timeline-event-date">{ev.event_date}</div>}
              <div className="timeline-event-title">{ev.title}</div>
              {ev.description && <div className="timeline-event-description">{ev.description}</div>}
              {ev.chapter_title && (
                <div className="timeline-event-chapter">Capitulo: {ev.chapter_title}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
