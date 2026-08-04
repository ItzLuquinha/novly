import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import './Lore.css';

const LONG_FIELDS = [
  ['description', 'Descricao'],
  ['significance', 'Significado na historia'],
  ['notes', 'Anotacoes'],
];

export default function WriterObjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [object, setObject] = useState(null);
  const [allBooks, setAllBooks] = useState([]);
  const [saveState, setSaveState] = useState('idle');
  const debounceRef = useRef(null);

  function load() {
    api.writerObject(id).then((data) => setObject(data.object)).catch(() => {});
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
        await api.updateObject(id, patch);
        setSaveState('salvo');
      } catch (e) {
        setSaveState('erro');
      }
    }, 700);
  }, [id]);

  function updateField(field, value) {
    setObject((o) => ({ ...o, [field]: value }));
    scheduleSave({ [field]: value });
  }

  async function handleDelete() {
    if (!window.confirm(`Excluir "${object.name}"? Isso nao pode ser desfeito.`)) return;
    await api.deleteObject(id);
    navigate('/escritor/objetos');
  }

  async function handleLinkBook(e) {
    const bookId = e.target.value;
    if (!bookId) return;
    await api.linkObjectBook(id, bookId);
    load();
    e.target.value = '';
  }

  async function handleUnlinkBook(bookId) {
    await api.unlinkObjectBook(id, bookId);
    load();
  }

  if (!object) return null;

  const linkedBookIds = new Set(object.books.map((b) => b.id));
  const availableBooks = allBooks.filter((b) => !linkedBookIds.has(b.id));

  return (
    <div className="lore-page">
      <Link className="lore-detail-back" to="/escritor/objetos">Voltar aos objetos</Link>

      <div className="lore-detail-header">
        <div className="lore-detail-avatar" style={{ background: object.photo_color, borderRadius: '4px' }} />
        <input
          className="lore-detail-name-input"
          value={object.name}
          onChange={(e) => updateField('name', e.target.value)}
        />
        <button className="lore-detail-delete" onClick={handleDelete}>Excluir</button>
      </div>

      <div className="lore-field">
        <label>Categoria</label>
        <input value={object.category || ''} onChange={(e) => updateField('category', e.target.value)} placeholder="Presente, carta, documento..." />
      </div>

      {LONG_FIELDS.map(([key, label]) => (
        <div className="lore-field" key={key}>
          <label>{label}</label>
          <textarea value={object[key] || ''} onChange={(e) => updateField(key, e.target.value)} />
        </div>
      ))}

      <div className="lore-save-hint">
        {saveState === 'salvando' && 'Salvando...'}
        {saveState === 'salvo' && 'Salvo.'}
        {saveState === 'erro' && 'Erro ao salvar.'}
      </div>

      <h2 className="lore-section-heading">Aparece em</h2>
      <div className="lore-tag-list">
        {object.books.map((b) => (
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
    </div>
  );
}
