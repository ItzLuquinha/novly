import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import Pomodoro from '../components/Pomodoro.jsx';
import SpellcheckOverlay from '../components/SpellcheckOverlay.jsx';
import GuidedTour from '../components/GuidedTour.jsx';
import { findAccentMistakes } from '../lib/localSpellcheck.js';
import { WRITER_EDITOR_TOUR } from '../lib/tourSteps.js';
import './Editor.css';

function countWords(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export default function Editor() {
  const { chapterId } = useParams();
  const navigate = useNavigate();

  const [chapter, setChapter] = useState(null);
  const [book, setBook] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saveState, setSaveState] = useState('idle');
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [showLore, setShowLore] = useState(false);
  const [lore, setLore] = useState(null);
  const [showScenes, setShowScenes] = useState(false);
  const [scenes, setScenes] = useState([]);
  const [newSceneTitle, setNewSceneTitle] = useState('');
  const [newSceneSummary, setNewSceneSummary] = useState('');
  const [showAppearance, setShowAppearance] = useState(false);
  const [editorFont, setEditorFont] = useState('reading');
  const [editorFontSize, setEditorFontSize] = useState(19);
  const [editorTextColor, setEditorTextColor] = useState('#e8dcc8');
  const [spellcheckMode, setSpellcheckMode] = useState('local');
  const [spellIssues, setSpellIssues] = useState([]);
  const [spellChecking, setSpellChecking] = useState(false);
  const [spellError, setSpellError] = useState('');
  const ignoredIssuesRef = useRef(new Set());
  const ltDebounceRef = useRef(null);

  const debounceRef = useRef(null);
  const dirtyRef = useRef(false);
  const textareaRef = useRef(null);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    setLoadError('');
    api.writerChapter(chapterId).then((data) => {
      setChapter(data.chapter);
      setTitle(data.chapter.title);
      setContent(data.chapter.content);
      api.writerBooks().then((res) => {
        const found = res.books.find((b) => b.id === data.chapter.book_id);
        setBook(found || null);
      }).catch(() => {});
      requestAnimationFrame(autoResize);
    }).catch((err) => {
      setLoadError(err.message || 'Nao foi possivel abrir este capitulo.');
    });
  }, [chapterId]);

  useEffect(() => {
    api.editorPreferences().then((prefs) => {
      setEditorFont(prefs.editor_font);
      setEditorFontSize(prefs.editor_font_size);
      setEditorTextColor(prefs.editor_text_color);
      setSpellcheckMode(prefs.spellcheck_mode || 'local');
    }).catch(() => {});
  }, []);

  function saveAppearance(patch) {
    api.updateEditorPreferences(patch).catch(() => {});
  }

  function handleFontChange(value) {
    setEditorFont(value);
    saveAppearance({ editor_font: value });
  }

  function handleFontSizeChange(value) {
    setEditorFontSize(value);
    saveAppearance({ editor_font_size: value });
  }

  function handleTextColorChange(value) {
    setEditorTextColor(value);
    saveAppearance({ editor_text_color: value });
  }

  function handleSpellcheckModeChange(mode) {
    setSpellcheckMode(mode);
    setSpellIssues([]);
    setSpellError('');
    ignoredIssuesRef.current = new Set();
    saveAppearance({ spellcheck_mode: mode });
  }

  useEffect(() => {
    if (spellcheckMode === 'off') {
      setSpellIssues([]);
      setSpellError('');
      return;
    }

    if (spellcheckMode === 'local') {
      const found = findAccentMistakes(content).map((m) => ({
        index: m.index,
        length: m.length,
        message: `Talvez falte acento: "${m.suggestion}"?`,
        suggestions: [m.suggestion],
        category: 'ortografia',
      }));
      const key = (issue) => `${issue.index}:${issue.length}`;
      setSpellIssues(found.filter((f) => !ignoredIssuesRef.current.has(key(f))));
      return;
    }

    if (spellcheckMode === 'languagetool') {
      clearTimeout(ltDebounceRef.current);
      if (!content.trim()) {
        setSpellIssues([]);
        return;
      }
      ltDebounceRef.current = setTimeout(async () => {
        setSpellChecking(true);
        setSpellError('');
        try {
          const res = await api.checkGrammar(content);
          const key = (issue) => `${issue.index}:${issue.length}`;
          const mapped = (res.matches || []).map((m) => ({
            index: m.offset,
            length: m.length,
            message: m.message,
            suggestions: m.replacements || [],
            category: m.category?.toLowerCase().includes('gram') ? 'gramatica' : 'ortografia',
          }));
          setSpellIssues(mapped.filter((m) => !ignoredIssuesRef.current.has(key(m))));
        } catch (err) {
          setSpellError(err.message || 'Nao foi possivel verificar agora.');
        } finally {
          setSpellChecking(false);
        }
      }, 2500);
    }

    return () => clearTimeout(ltDebounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, spellcheckMode]);

  function handleApplySuggestion(issue, suggestion) {
    const before = content.slice(0, issue.index);
    const after = content.slice(issue.index + issue.length);
    const nextContent = before + suggestion + after;
    handleContentChange(nextContent);
  }

  function handleIgnoreIssue(issue) {
    const key = `${issue.index}:${issue.length}`;
    ignoredIssuesRef.current.add(key);
    setSpellIssues((prev) => prev.filter((i) => `${i.index}:${i.length}` !== key));
  }

  const persist = useCallback((nextTitle, nextContent) => {
    setSaveState('salvando');
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.saveChapter(chapterId, { title: nextTitle, content: nextContent });
        setChapter(res.chapter);
        dirtyRef.current = false;
        setSaveState('salvo');
      } catch (e) {
        setSaveState('erro');
      }
    }, 900);
  }, [chapterId]);

  function handleTitleChange(value) {
    setTitle(value);
    dirtyRef.current = true;
    persist(value, content);
  }

  function handleContentChange(value) {
    setContent(value);
    dirtyRef.current = true;
    persist(title, value);
    autoResize();
  }

  useEffect(() => {
    function beforeUnload(e) {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      api.endWritingSession().catch(() => {});
    };
  }, []);

  async function openVersions() {
    const data = await api.chapterVersions(chapterId);
    setVersions(data.versions);
    setShowLore(false);
    setShowScenes(false);
    setShowVersions(true);
  }

  function loadLore() {
    api.chapterLore(chapterId).then(setLore).catch(() => {});
  }

  function toggleLore() {
    if (!showLore) {
      loadLore();
      setShowVersions(false);
      setShowScenes(false);
    }
    setShowLore((s) => !s);
  }

  async function handleAddCharacter(e) {
    const id = e.target.value;
    if (!id) return;
    await api.linkCharacterChapter(id, chapterId);
    loadLore();
    e.target.value = '';
  }

  async function handleRemoveCharacter(id) {
    await api.unlinkCharacterChapter(id, chapterId);
    loadLore();
  }

  async function handleAddPlace(e) {
    const id = e.target.value;
    if (!id) return;
    await api.linkPlaceChapter(id, chapterId);
    loadLore();
    e.target.value = '';
  }

  async function handleRemovePlace(id) {
    await api.unlinkPlaceChapter(id, chapterId);
    loadLore();
  }

  async function handleAddObject(e) {
    const id = e.target.value;
    if (!id) return;
    await api.linkObjectChapter(id, chapterId);
    loadLore();
    e.target.value = '';
  }

  async function handleRemoveObject(id) {
    await api.unlinkObjectChapter(id, chapterId);
    loadLore();
  }

  function loadScenes() {
    api.chapterScenes(chapterId).then((data) => setScenes(data.scenes)).catch(() => {});
  }

  function toggleScenes() {
    if (!showScenes) {
      loadScenes();
      setShowLore(false);
      setShowVersions(false);
    }
    setShowScenes((s) => !s);
  }

  async function handleAddScene(e) {
    e.preventDefault();
    if (!newSceneTitle.trim()) return;
    await api.createScene(chapterId, { title: newSceneTitle.trim(), summary: newSceneSummary.trim() });
    setNewSceneTitle('');
    setNewSceneSummary('');
    loadScenes();
  }

  async function handleDeleteScene(id) {
    await api.deleteScene(id);
    loadScenes();
  }

  async function handleReorderScene(id, direction) {
    await api.reorderScene(id, direction);
    loadScenes();
  }

  async function handleSnapshot() {
    const label = window.prompt('Nome para esta versao (opcional):', '');
    if (label === null) return;
    await api.createSnapshot(chapterId, label);
    if (showVersions) {
      const data = await api.chapterVersions(chapterId);
      setVersions(data.versions);
    }
  }

  async function handleRestore(versionId) {
    if (!window.confirm('Restaurar esta versao? O estado atual sera salvo antes, para nao se perder.')) return;
    const res = await api.restoreVersion(chapterId, versionId);
    setChapter(res.chapter);
    setTitle(res.chapter.title);
    setContent(res.chapter.content);
    const data = await api.chapterVersions(chapterId);
    setVersions(data.versions);
  }

  async function handlePublish() {
    await api.createSnapshot(chapterId, 'antes de publicar');
    const res = await api.publishChapter(chapterId);
    setChapter(res.chapter);
  }

  async function handleUnpublish() {
    const res = await api.unpublishChapter(chapterId);
    setChapter(res.chapter);
  }

  async function handleSchedule() {
    if (!scheduleDate) return;
    const res = await api.scheduleChapter(chapterId, new Date(scheduleDate).toISOString());
    setChapter(res.chapter);
    setShowSchedule(false);
  }

  const wordCount = useMemo(() => countWords(content), [content]);
  const charCount = content.length;
  const paragraphCount = useMemo(
    () => content.split('\n\n').filter((p) => p.trim()).length,
    [content]
  );
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  if (loadError) {
    return (
      <div className="editor-loading-error">
        <p>{loadError}</p>
        <Link to="/escritor">Voltar ao painel</Link>
      </div>
    );
  }

  if (!chapter) return null;

  return (
    <div className="editor-page">
      <div className="editor-topbar">
        <div className="editor-topbar-left">
          {book && <Link className="editor-back" to={`/escritor/livros/${book.id}`}>Voltar</Link>}
          <span className={`editor-save-status${saveState === 'salvo' ? ' saved' : ''}`}>
            {saveState === 'salvando' && 'Salvando...'}
            {saveState === 'salvo' && 'Tudo salvo'}
            {saveState === 'erro' && 'Erro ao salvar'}
            {saveState === 'idle' && ' '}
          </span>
        </div>
        <div className="editor-topbar-actions">
          <button className="editor-btn" onClick={() => setShowAppearance((s) => !s)}>Aa</button>
          <button className="editor-btn" onClick={toggleScenes} data-tour="editor-cenas">Cenas</button>
          <button className="editor-btn" onClick={toggleLore} data-tour="editor-lore">Personagens e lugares</button>
          <button className="editor-btn" onClick={handleSnapshot} data-tour="editor-versao">Criar versao</button>
          <button className="editor-btn" onClick={openVersions}>Historico</button>
          <div className="editor-actions-wrap">
            <button className="editor-btn" onClick={() => setShowSchedule((s) => !s)} data-tour="editor-agendar">Agendar</button>
            {showSchedule && (
              <div className="schedule-popover">
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                />
                <button className="editor-btn primary" style={{ width: '100%' }} onClick={handleSchedule}>
                  Confirmar
                </button>
              </div>
            )}
          </div>
          {chapter.status === 'publicado' ? (
            <button className="editor-btn" onClick={handleUnpublish} data-tour="editor-publicar">Despublicar</button>
          ) : (
            <button className="editor-btn primary" onClick={handlePublish} data-tour="editor-publicar">Publicar</button>
          )}
        </div>
      </div>

      {showAppearance && (
        <div className="appearance-panel">
          <div className="appearance-group">
            <div className="appearance-label"><span>Fonte</span></div>
            <div className="appearance-row">
              {[
                { key: 'reading', label: 'Serif' },
                { key: 'display', label: 'Editorial' },
                { key: 'ui', label: 'Simples' },
              ].map((f) => (
                <button
                  key={f.key}
                  className={`appearance-font-btn${editorFont === f.key ? ' active' : ''}`}
                  onClick={() => handleFontChange(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="appearance-group">
            <div className="appearance-label"><span>Tamanho da fonte</span><span>{editorFontSize}px</span></div>
            <input
              type="range"
              min="15"
              max="28"
              value={editorFontSize}
              onChange={(e) => handleFontSizeChange(Number(e.target.value))}
            />
          </div>
          <div className="appearance-group">
            <div className="appearance-label"><span>Cor do texto</span></div>
            <div className="appearance-row">
              {['#e8dcc8', '#c9a86a', '#d8cfae', '#b5673a', '#8f9aa6'].map((color) => (
                <button
                  key={color}
                  className={`appearance-swatch${editorTextColor === color ? ' active' : ''}`}
                  style={{ background: color }}
                  onClick={() => handleTextColorChange(color)}
                />
              ))}
            </div>
          </div>
          <div className="appearance-group">
            <div className="appearance-label"><span>Corretor</span></div>
            <div className="appearance-row">
              {[
                { key: 'off', label: 'Desligado' },
                { key: 'local', label: 'Basico' },
                { key: 'languagetool', label: 'Avancado' },
              ].map((m) => (
                <button
                  key={m.key}
                  className={`appearance-font-btn${spellcheckMode === m.key ? ' active' : ''}`}
                  onClick={() => handleSpellcheckModeChange(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {spellcheckMode === 'local' && (
              <p className="spellcheck-status" style={{ marginTop: 'var(--space-2)' }}>
                Verifica acentos comuns, sem precisar de internet.
              </p>
            )}
            {spellcheckMode === 'languagetool' && (
              <p className={`spellcheck-status${spellChecking ? ' checking' : ''}`} style={{ marginTop: 'var(--space-2)' }}>
                {spellChecking ? 'Verificando...' : 'Corretor completo via LanguageTool (servico gratuito online).'}
              </p>
            )}
            {spellError && (
              <p className="spellcheck-status" style={{ marginTop: 'var(--space-2)', color: 'var(--color-ember)' }}>
                {spellError}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="editor-body">
        <div className="editor-column">
          <input
            className="editor-title-input"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Titulo do capitulo"
          />
          <div className="spellcheck-overlay-wrap" data-tour="editor-texto">
            <textarea
              ref={textareaRef}
              className="editor-textarea"
              style={{
                fontFamily: editorFont === 'display'
                  ? 'var(--font-display)'
                  : editorFont === 'ui'
                    ? 'var(--font-ui)'
                    : 'var(--font-reading)',
                fontSize: `${editorFontSize}px`,
                color: editorTextColor,
                position: 'relative',
                zIndex: 1,
              }}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Comece a escrever aqui."
            />
            {spellcheckMode !== 'off' && (
              <SpellcheckOverlay
                text={content}
                issues={spellIssues}
                textareaRef={textareaRef}
                onApplySuggestion={handleApplySuggestion}
                onIgnore={handleIgnoreIssue}
                fontFamily={
                  editorFont === 'display'
                    ? 'var(--font-display)'
                    : editorFont === 'ui'
                      ? 'var(--font-ui)'
                      : 'var(--font-reading)'
                }
                fontSize={editorFontSize}
              />
            )}
          </div>

          <div className="editor-footer-stats">
            <span><strong>{wordCount}</strong> palavras</span>
            <span className="editor-page-indicator">~{Math.max(1, Math.ceil(wordCount / 250))} pag.</span>
            <span><strong>{charCount}</strong> caracteres</span>
            <span><strong>{paragraphCount}</strong> paragrafos</span>
            <span><strong>{readingMinutes}</strong> min de leitura</span>
            {spellcheckMode !== 'off' && spellIssues.length > 0 && (
              <span>
                <strong>{spellIssues.length}</strong> {spellIssues.length === 1 ? 'possivel erro' : 'possiveis erros'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={`versions-panel${showVersions ? '' : ' closed'}`}>
        <div className="versions-header">
          <span className="versions-header-title">Historico de versoes</span>
          <button className="editor-btn" onClick={() => setShowVersions(false)}>Fechar</button>
        </div>
        <div className="versions-list">
          {versions.length === 0 && (
            <p className="versions-empty">Nenhuma versao salva ainda. Crie uma versao para guardar este momento do texto.</p>
          )}
          {versions.map((v) => (
            <div className="version-item" key={v.id}>
              <div className="version-item-label">{v.label || 'Sem nome'}</div>
              <div className="version-item-meta">
                {new Date(v.created_at + 'Z').toLocaleString('pt-BR')} - {v.word_count} palavras
              </div>
              <div className="version-item-actions">
                <button onClick={() => handleRestore(v.id)}>Restaurar</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`versions-panel${showScenes ? '' : ' closed'}`}>
        <div className="versions-header">
          <span className="versions-header-title">Cenas deste capitulo</span>
          <button className="editor-btn" onClick={() => setShowScenes(false)}>Fechar</button>
        </div>
        <div className="versions-list">
          {scenes.length === 0 && (
            <p className="versions-empty">Nenhuma cena marcada ainda. Quebre o capitulo em cenas para organizar melhor a escrita.</p>
          )}
          {scenes.map((s, i) => (
            <div className="version-item" key={s.id}>
              <div className="version-item-label">{s.title}</div>
              {s.summary && <div className="version-item-meta">{s.summary}</div>}
              <div className="version-item-actions">
                <button onClick={() => handleReorderScene(s.id, 'up')} disabled={i === 0}>Cima</button>
                <button onClick={() => handleReorderScene(s.id, 'down')} disabled={i === scenes.length - 1}>Baixo</button>
                <button onClick={() => handleDeleteScene(s.id)}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
        <form className="comments-drawer-composer" onSubmit={handleAddScene}>
          <input
            style={{
              width: '100%',
              border: '1px solid var(--color-line-strong)',
              borderRadius: '4px',
              padding: 'var(--space-3)',
              fontSize: '0.85rem',
              marginBottom: 'var(--space-2)',
            }}
            placeholder="Titulo da cena"
            value={newSceneTitle}
            onChange={(e) => setNewSceneTitle(e.target.value)}
          />
          <textarea
            placeholder="Resumo curto (opcional)"
            value={newSceneSummary}
            onChange={(e) => setNewSceneSummary(e.target.value)}
          />
          <button type="submit">Adicionar cena</button>
        </form>
      </div>

      <div className={`lore-panel${showLore ? '' : ' closed'}`}>
        <div className="lore-panel-header">
          <span className="lore-panel-title">Personagens e lugares</span>
          <button className="editor-btn" onClick={() => setShowLore(false)}>Fechar</button>
        </div>
        <div className="lore-panel-body">
          {lore && (
            <>
              <div className="lore-panel-section">
                <div className="lore-panel-section-label">Personagens neste capitulo</div>
                {lore.linked_characters.length === 0 && (
                  <p className="lore-panel-empty">Ninguem marcado ainda.</p>
                )}
                <div className="lore-panel-chip-list">
                  {lore.linked_characters.map((c) => (
                    <span className="lore-panel-chip" key={c.id}>
                      <span className="lore-panel-chip-dot" style={{ background: c.photo_color }} />
                      {c.name}
                      <button onClick={() => handleRemoveCharacter(c.id)}>remover</button>
                    </span>
                  ))}
                </div>
                {lore.book_characters.length > 0 ? (
                  <select className="lore-panel-select" onChange={handleAddCharacter} defaultValue="">
                    <option value="" disabled>Marcar personagem</option>
                    {lore.book_characters
                      .filter((c) => !lore.linked_characters.some((lc) => lc.id === c.id))
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                ) : (
                  <p className="lore-panel-empty">Nenhum personagem vinculado a este livro ainda.</p>
                )}
                <Link className="lore-panel-manage-link" to="/escritor/personagens">Gerenciar personagens</Link>
              </div>

              <div className="lore-panel-section">
                <div className="lore-panel-section-label">Lugares neste capitulo</div>
                {lore.linked_places.length === 0 && (
                  <p className="lore-panel-empty">Nenhum lugar marcado ainda.</p>
                )}
                <div className="lore-panel-chip-list">
                  {lore.linked_places.map((p) => (
                    <span className="lore-panel-chip" key={p.id}>
                      <span className="lore-panel-chip-dot" style={{ background: p.photo_color }} />
                      {p.name}
                      <button onClick={() => handleRemovePlace(p.id)}>remover</button>
                    </span>
                  ))}
                </div>
                {lore.book_places.length > 0 ? (
                  <select className="lore-panel-select" onChange={handleAddPlace} defaultValue="">
                    <option value="" disabled>Marcar lugar</option>
                    {lore.book_places
                      .filter((p) => !lore.linked_places.some((lp) => lp.id === p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                  </select>
                ) : (
                  <p className="lore-panel-empty">Nenhum lugar vinculado a este livro ainda.</p>
                )}
                <Link className="lore-panel-manage-link" to="/escritor/lugares">Gerenciar lugares</Link>
              </div>

              <div className="lore-panel-section">
                <div className="lore-panel-section-label">Objetos neste capitulo</div>
                {lore.linked_objects.length === 0 && (
                  <p className="lore-panel-empty">Nenhum objeto marcado ainda.</p>
                )}
                <div className="lore-panel-chip-list">
                  {lore.linked_objects.map((o) => (
                    <span className="lore-panel-chip" key={o.id}>
                      <span className="lore-panel-chip-dot" style={{ background: o.photo_color }} />
                      {o.name}
                      <button onClick={() => handleRemoveObject(o.id)}>remover</button>
                    </span>
                  ))}
                </div>
                {lore.book_objects.length > 0 ? (
                  <select className="lore-panel-select" onChange={handleAddObject} defaultValue="">
                    <option value="" disabled>Marcar objeto</option>
                    {lore.book_objects
                      .filter((o) => !lore.linked_objects.some((lo) => lo.id === o.id))
                      .map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                  </select>
                ) : (
                  <p className="lore-panel-empty">Nenhum objeto vinculado a este livro ainda.</p>
                )}
                <Link className="lore-panel-manage-link" to="/escritor/objetos">Gerenciar objetos</Link>
              </div>
            </>
          )}
        </div>
      </div>

      <Pomodoro />

      <GuidedTour
        steps={WRITER_EDITOR_TOUR}
        storageKey="novly_tour_editor"
        promptTitle="Primeira vez escrevendo por aqui?"
        promptText="Posso mostrar rapidinho as ferramentas do editor: autosave, personagens do capitulo, versoes e publicacao."
      />
    </div>
  );
}
