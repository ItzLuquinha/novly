import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, mediaUrl } from '../lib/api';
import './Lore.css';

const FIELD_GROUPS = [
  { keys: ['nicknames', 'age'], labels: ['Apelidos', 'Idade'] },
];

const LONG_FIELDS = [
  ['description', 'Descricao'],
  ['appearance', 'Aparencia'],
  ['personality', 'Personalidade'],
  ['goals', 'Objetivos'],
  ['fears', 'Medos'],
  ['likes', 'Gostos'],
  ['relationships', 'Relacionamentos'],
  ['history', 'Historico'],
  ['trivia', 'Curiosidades'],
  ['notes', 'Anotacoes'],
];

export default function WriterCharacterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [character, setCharacter] = useState(null);
  const [allBooks, setAllBooks] = useState([]);
  const [saveState, setSaveState] = useState('idle');
  const [photoTab, setPhotoTab] = useState('upload');
  const [urlValue, setUrlValue] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const debounceRef = useRef(null);

  function load() {
    api.writerCharacter(id).then((data) => setCharacter(data.character)).catch(() => {});
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
        await api.updateCharacter(id, patch);
        setSaveState('salvo');
      } catch (e) {
        setSaveState('erro');
      }
    }, 700);
  }, [id]);

  function updateField(field, value) {
    setCharacter((c) => ({ ...c, [field]: value }));
    scheduleSave({ [field]: value });
  }

  async function handleDelete() {
    if (!window.confirm(`Excluir "${character.name}"? Isso nao pode ser desfeito.`)) return;
    await api.deleteCharacter(id);
    navigate('/escritor/personagens');
  }

  async function handleLinkBook(e) {
    const bookId = e.target.value;
    if (!bookId) return;
    await api.linkCharacterBook(id, bookId);
    load();
    e.target.value = '';
  }

  async function handleUnlinkBook(bookId) {
    await api.unlinkCharacterBook(id, bookId);
    load();
  }

  async function handlePhotoFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    setPhotoBusy(true);
    try {
      const res = await api.uploadCharacterPhoto(file);
      updateField('photo_url', res.url);
    } catch (err) {
      setPhotoError(err.message);
    } finally {
      setPhotoBusy(false);
    }
  }

  function handlePhotoUrlSubmit(e) {
    e.preventDefault();
    if (!urlValue.trim()) return;
    updateField('photo_url', urlValue.trim());
    setUrlValue('');
  }

  function handleRemovePhoto() {
    updateField('photo_url', '');
  }

  if (!character) return null;

  const linkedBookIds = new Set(character.books.map((b) => b.id));
  const availableBooks = allBooks.filter((b) => !linkedBookIds.has(b.id));

  return (
    <div className="lore-page">
      <Link className="lore-detail-back" to="/escritor/personagens">Voltar aos personagens</Link>

      <div className="lore-detail-header">
        <div
          className="lore-detail-avatar"
          style={
            character.photo_url
              ? { backgroundImage: `url(${mediaUrl(character.photo_url)})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: character.photo_color }
          }
        />
        <input
          className="lore-detail-name-input"
          value={character.name}
          onChange={(e) => updateField('name', e.target.value)}
        />
        <button className="lore-detail-delete" onClick={handleDelete}>Excluir</button>
      </div>

      <h2 className="lore-section-heading" style={{ marginTop: 0 }}>Foto de referencia</h2>
      <p className="lore-appearance-hint">
        Uma foto real ajuda mais do que qualquer boneco: envie uma imagem da
        galeria ou cole um link.
      </p>

      {character.photo_url ? (
        <div className="character-photo-preview">
          <img src={mediaUrl(character.photo_url)} alt={character.name} />
          <button className="character-photo-remove" onClick={handleRemovePhoto}>Remover foto</button>
        </div>
      ) : (
        <>
          <div className="character-photo-tabs">
            <button
              className={`character-photo-tab${photoTab === 'upload' ? ' active' : ''}`}
              onClick={() => setPhotoTab('upload')}
            >
              Da galeria
            </button>
            <button
              className={`character-photo-tab${photoTab === 'url' ? ' active' : ''}`}
              onClick={() => setPhotoTab('url')}
            >
              Link de foto
            </button>
          </div>

          {photoTab === 'upload' && (
            <label className="character-photo-upload-zone">
              <input type="file" accept="image/*" onChange={handlePhotoFile} disabled={photoBusy} />
              <p>{photoBusy ? 'Enviando...' : 'Clique para escolher uma foto da sua galeria'}</p>
            </label>
          )}

          {photoTab === 'url' && (
            <form className="character-photo-url-row" onSubmit={handlePhotoUrlSubmit}>
              <input
                type="url"
                placeholder="https://..."
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                required
              />
              <button type="submit">Usar este link</button>
            </form>
          )}

          {photoError && <p className="character-photo-error">{photoError}</p>}
        </>
      )}

      <div className="lore-field-grid">
        <div className="lore-field">
          <label>Apelidos</label>
          <input value={character.nicknames || ''} onChange={(e) => updateField('nicknames', e.target.value)} />
        </div>
        <div className="lore-field">
          <label>Idade</label>
          <input value={character.age || ''} onChange={(e) => updateField('age', e.target.value)} />
        </div>
      </div>

      {LONG_FIELDS.map(([key, label]) => (
        <div className="lore-field" key={key}>
          <label>{label}</label>
          <textarea value={character[key] || ''} onChange={(e) => updateField(key, e.target.value)} />
        </div>
      ))}

      <div className="lore-save-hint">
        {saveState === 'salvando' && 'Salvando...'}
        {saveState === 'salvo' && 'Salvo.'}
        {saveState === 'erro' && 'Erro ao salvar.'}
      </div>

      <h2 className="lore-section-heading">Aparece em</h2>
      <div className="lore-tag-list">
        {character.books.map((b) => (
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
