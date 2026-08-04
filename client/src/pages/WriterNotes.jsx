import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import './WriterNotes.css';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function formatDate(mmdd) {
  const [month, day] = mmdd.split('-').map(Number);
  return `${day} de ${MONTHS[month - 1]}`;
}

export default function WriterNotes() {
  const [notes, setNotes] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [message, setMessage] = useState('');
  const [month, setMonth] = useState('01');
  const [day, setDay] = useState('01');
  const [chapterId, setChapterId] = useState('');

  function load() {
    api.writerNotes().then((data) => setNotes(data.notes)).catch(() => {});
  }

  useEffect(() => {
    load();
    api.writerBooks().then((data) => {
      Promise.all(data.books.map((b) => api.writerChapters(b.id).then((r) => r.chapters.map((c) => ({ ...c, bookTitle: b.title })))))
        .then((lists) => setChapters(lists.flat()));
    });
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!message.trim()) return;
    await api.createNote({
      message: message.trim(),
      special_date: `${month}-${day}`,
      chapter_id: chapterId || null,
    });
    setMessage('');
    setChapterId('');
    load();
  }

  async function handleDelete(id) {
    await api.deleteNote(id);
    load();
  }

  return (
    <div className="notes-page">
      <h1 className="notes-title">Bilhetes escondidos</h1>
      <p className="notes-subtitle">Pequenas surpresas que aparecem em datas especiais.</p>

      {notes?.length === 0 && <p className="notes-empty">Nenhum bilhete criado ainda.</p>}

      {notes?.map((n) => (
        <div className="note-item" key={n.id}>
          <div className="note-item-date">{formatDate(n.special_date)}</div>
          <div style={{ flex: 1 }}>
            <div className="note-item-message">{n.message}</div>
            <div className={`note-item-meta${n.found_at ? ' found' : ''}`}>
              {n.chapter_title ? `Aparece apos ler: ${n.chapter_title}` : 'Aparece em qualquer momento na data'}
              {n.found_at ? ' - ja encontrado' : ''}
            </div>
          </div>
          <button className="note-item-delete" onClick={() => handleDelete(n.id)}>Excluir</button>
        </div>
      ))}

      <form className="notes-add-form" onSubmit={handleAdd}>
        <textarea
          placeholder="A mensagem do bilhete"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="notes-add-form-row">
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
            ))}
          </select>
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
            ))}
          </select>
        </div>
        <select value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
          <option value="">Aparece em qualquer momento na data</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>{c.bookTitle} - {c.title}</option>
          ))}
        </select>
        <p className="notes-add-form-hint">
          Se escolher um capitulo, o bilhete so aparece depois que ela ja tiver lido aquele capitulo.
        </p>
        <button type="submit">Criar bilhete</button>
      </form>
    </div>
  );
}
