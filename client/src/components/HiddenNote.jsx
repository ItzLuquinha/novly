import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import './HiddenNote.css';

export default function HiddenNote() {
  const [note, setNote] = useState(null);

  useEffect(() => {
    api.availableNote().then((data) => {
      if (data.note) setNote(data.note);
    }).catch(() => {});
  }, []);

  function handleClose() {
    if (note) api.markNoteFound(note.id).catch(() => {});
    setNote(null);
  }

  if (!note) return null;

  return (
    <div className="hidden-note-overlay" onClick={handleClose}>
      <div className="hidden-note-paper" onClick={(e) => e.stopPropagation()}>
        <p className="hidden-note-message">{note.message}</p>
        <button className="hidden-note-close" onClick={handleClose}>Guardar esta pagina</button>
      </div>
    </div>
  );
}
