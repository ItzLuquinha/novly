import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth.jsx';
import GuidedTour from '../components/GuidedTour.jsx';
import { READER_CHAPTER_TOUR } from '../lib/tourSteps.js';
import './Reader.css';

const THEMES = {
  noite: { bg: '#0d0a08', text: '#e8dcc8', name: 'Noite' },
  sepia: { bg: '#2b2118', text: '#e0cfae', name: 'Sepia' },
  papel: { bg: '#1c1a17', text: '#d8d2c4', name: 'Papel' },
};

export default function Reader() {
  const { slug, chapterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const textRef = useRef(null);
  const progressPercentRef = useRef(0);
  const completionSentRef = useRef(false);
  const restoreScrollYRef = useRef(0);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [comments, setComments] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [pageInfo, setPageInfo] = useState({ current: 1, total: 1 });
  const [topbarHidden, setTopbarHidden] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [selection, setSelection] = useState(null);
  const [noteAnchor, setNoteAnchor] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');

  const [fontSize, setFontSize] = useState(19);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [maxWidth, setMaxWidth] = useState(680);
  const [theme, setTheme] = useState('noite');

  const lastScrollY = useRef(0);

  useEffect(() => {
    setError('');
    setData(null);
    completionSentRef.current = false;

    api.chapter(slug, chapterId)
      .then((res) => {
        setData(res);
        progressPercentRef.current = Number(res.current_progress?.progress_percent || 0);
        restoreScrollYRef.current = Number(res.current_progress?.scroll_position || 0);
      })
      .catch((e) => setError(e.message));

    api.chapterComments(chapterId)
      .then((res) => setComments(res.comments))
      .catch(() => {});
  }, [slug, chapterId]);

  useEffect(() => {
    if (!data || restoreScrollYRef.current <= 0) return;
    const targetY = restoreScrollYRef.current;
    restoreScrollYRef.current = 0;
    const frame1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => window.scrollTo({ top: targetY, behavior: 'auto' }));
    });
    return () => cancelAnimationFrame(frame1);
  }, [data, chapterId]);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setTopbarHidden(y > lastScrollY.current && y > 120);
      lastScrollY.current = y;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      progressPercentRef.current = Math.min(100, Math.max(0, (y / maxScroll) * 100));
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;

    async function persistReadingProgress() {
      const payload = {
        scroll_position: window.scrollY,
        char_offset: 0,
        progress_percent: progressPercentRef.current,
      };
      try {
        await api.saveProgress(slug, chapterId, payload);
        if (!cancelled && progressPercentRef.current >= 90 && !completionSentRef.current) {
          completionSentRef.current = true;
          try {
            await api.completeChapter(slug, chapterId, {});
          } catch (_) {
            // If the server says the minimum reading time has not been reached yet,
            // allow the next progress heartbeat to try again.
            completionSentRef.current = false;
          }
        }
      } catch (_) {}
    }

    persistReadingProgress();
    const interval = setInterval(persistReadingProgress, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      const finalPercent = progressPercentRef.current;
      api.saveProgress(slug, chapterId, {
        scroll_position: window.scrollY,
        char_offset: 0,
        progress_percent: finalPercent,
      }).then(() => {
        if (finalPercent >= 90 && !completionSentRef.current) {
          completionSentRef.current = true;
          return api.completeChapter(slug, chapterId, {}).catch(() => {
            completionSentRef.current = false;
          });
        }
        return null;
      }).catch(() => {});
    };
  }, [data, slug, chapterId]);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !textRef.current) {
      setSelection(null);
      return;
    }
    const text = sel.toString().trim();
    if (!text || !textRef.current.contains(sel.anchorNode)) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setSelection({
      text,
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY,
    });
  }, []);

  async function handleHighlight() {
    if (!selection) return;
    try {
      await api.createHighlight({
        chapter_id: Number(chapterId),
        book_id: data.chapter.book_id,
        text: selection.text,
      });
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    } catch (e) {
      console.error(e);
    }
  }

  function openNoteForm() {
    if (!selection) return;
    setNoteAnchor(selection);
    setSelection(null);
  }

  async function submitNote() {
    if (!noteAnchor || !noteDraft.trim()) return;
    try {
      const res = await api.postComment(chapterId, {
        content: noteDraft.trim(),
        anchor_text: noteAnchor.text,
        book_id: data.chapter.book_id,
      });
      setComments((prev) => [...prev, { ...res.comment, replies: [] }]);
      setNoteDraft('');
      setNoteAnchor(null);
      window.getSelection()?.removeAllRanges();
    } catch (e) {
      console.error(e);
    }
  }

  async function submitComment() {
    if (!commentDraft.trim()) return;
    try {
      const res = await api.postComment(chapterId, {
        content: commentDraft.trim(),
        book_id: data.chapter.book_id,
      });
      setComments((prev) => [...prev, { ...res.comment, replies: [] }]);
      setCommentDraft('');
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleResolve(id) {
    await api.resolveComment(id);
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, resolved: c.resolved ? 0 : 1 } : c))
    );
  }

  async function togglePin(id) {
    await api.pinComment(id);
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, pinned: c.pinned ? 0 : 1 } : c))
    );
  }


  useEffect(() => {
    if (!data) return;
    const words = (data.chapter.content || '').trim().split(/\s+/).filter(Boolean).length;
    const totalPages = Math.max(1, Math.ceil(words / 250));

    function updatePage() {
      const el = textRef.current;
      if (!el) {
        setPageInfo({ current: 1, total: totalPages });
        return;
      }
      const rect = el.getBoundingClientRect();
      const elTop = window.scrollY + rect.top;
      const elHeight = el.offsetHeight || 1;
      const progress = Math.min(1, Math.max(0, (window.scrollY + window.innerHeight * 0.35 - elTop) / elHeight));
      const current = Math.min(totalPages, Math.max(1, Math.ceil(progress * totalPages) || 1));
      setPageInfo({ current, total: totalPages });
    }

    updatePage();
    window.addEventListener('scroll', updatePage, { passive: true });
    window.addEventListener('resize', updatePage);
    return () => {
      window.removeEventListener('scroll', updatePage);
      window.removeEventListener('resize', updatePage);
    };
  }, [data, chapterId]);

  if (error) {
    return (
      <div className="reader-loading">
        <p>{error}</p>
        <Link to={`/biblioteca/${slug}`}>Voltar ao livro</Link>
      </div>
    );
  }

  if (!data) {
    return <div className="reader-loading">Abrindo o livro...</div>;
  }

  const paragraphs = data.chapter.content.split('\n\n');
  const currentTheme = THEMES[theme];

  return (
    <div className="reader-page" style={{ background: currentTheme.bg, color: currentTheme.text }}>
      <div className={`reader-topbar${topbarHidden ? ' hidden' : ''}`}>
        <div className="reader-topbar-left">
          <Link className="reader-back" to={`/biblioteca/${slug}`}>Voltar</Link>
          <span className="reader-topbar-title">{data.book.title}</span>
          <span className="reader-page-indicator">
            Pagina {pageInfo.current} de {pageInfo.total}
          </span>
        </div>
        <div className="reader-topbar-actions">
          <button
            className={`reader-icon-btn${showComments ? ' active' : ''}`}
            onClick={() => setShowComments((s) => !s)}
            aria-label="Comentarios"
            title="Comentarios"
            data-tour="reader-comentarios"
          >
            Notas {comments.length > 0 ? `(${comments.length})` : ''}
          </button>
          <button
            className={`reader-icon-btn${showSettings ? ' active' : ''}`}
            onClick={() => setShowSettings((s) => !s)}
            aria-label="Ajustes de leitura"
            title="Ajustes"
            data-tour="reader-ajustes"
          >
            Aa
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="reader-settings-panel">
          <div className="reader-setting-group">
            <div className="reader-setting-label"><span>Tamanho da fonte</span><span>{fontSize}px</span></div>
            <input type="range" min="15" max="26" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} />
          </div>
          <div className="reader-setting-group">
            <div className="reader-setting-label"><span>Espacamento</span><span>{lineHeight.toFixed(1)}</span></div>
            <input type="range" min="1.4" max="2.4" step="0.1" value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value))} />
          </div>
          <div className="reader-setting-group">
            <div className="reader-setting-label"><span>Largura</span><span>{maxWidth}px</span></div>
            <input type="range" min="480" max="880" step="20" value={maxWidth} onChange={(e) => setMaxWidth(Number(e.target.value))} />
          </div>
          <div className="reader-setting-group">
            <div className="reader-setting-label"><span>Tema</span></div>
            <div className="reader-theme-row">
              {Object.entries(THEMES).map(([key, t]) => (
                <button
                  key={key}
                  className={`reader-theme-swatch${theme === key ? ' active' : ''}`}
                  style={{ background: t.bg }}
                  onClick={() => setTheme(key)}
                  title={t.name}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="reader-body">
        <div className="reader-column" style={{ maxWidth: `${maxWidth}px` }}>
          <h1 className="reader-chapter-title">{data.chapter.title}</h1>

          {!data.prev_chapter && data.book.reader_guide && (
            <div className="reader-guide-block">
              <div className="reader-guide-label">Guia do livro</div>
              <p className="reader-guide-text">{data.book.reader_guide}</p>
            </div>
          )}

          <div
            ref={textRef}
            className="reader-text"
            style={{ fontSize: `${fontSize}px`, lineHeight }}
            onMouseUp={handleMouseUp}
            data-tour="reader-texto"
          >
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          <div className="reader-nav-footer">
            {data.prev_chapter ? (
              <button className="reader-nav-btn" onClick={() => navigate(`/biblioteca/${slug}/${data.prev_chapter.id}`)}>
                Anterior: {data.prev_chapter.title}
              </button>
            ) : <span />}
            {data.next_chapter ? (
              <button className="reader-nav-btn" onClick={() => navigate(`/biblioteca/${slug}/${data.next_chapter.id}`)}>
                Proximo: {data.next_chapter.title}
              </button>
            ) : <span />}
          </div>
        </div>
      </div>

      {selection && (
        <div className="selection-toolbar" style={{ left: selection.x - 70, top: selection.y - 44 }}>
          <button onClick={handleHighlight}>Destacar</button>
          <button onClick={openNoteForm}>Comentar</button>
        </div>
      )}

      {noteAnchor && (
        <div className="reader-margin-note-form" style={{ left: Math.min(noteAnchor.x - 140, window.innerWidth - 300), top: noteAnchor.y + 20 }}>
          <div className="reader-margin-note-quote">{noteAnchor.text}</div>
          <textarea
            autoFocus
            placeholder="Escreva sua nota aqui"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
          />
          <div className="reader-margin-note-actions">
            <button className="cancel" onClick={() => { setNoteAnchor(null); setNoteDraft(''); }}>Cancelar</button>
            <button className="save" onClick={submitNote}>Salvar</button>
          </div>
        </div>
      )}

      <div className={`reader-comments-drawer${showComments ? '' : ' closed'}`}>
        <div className="comments-drawer-header">
          <span className="comments-drawer-title">Anotacoes</span>
          <button className="reader-icon-btn" onClick={() => setShowComments(false)}>Fechar</button>
        </div>
        <div className="comments-drawer-list">
          {comments.length === 0 && (
            <p className="comments-empty">Nenhuma nota neste capitulo ainda. Selecione um trecho para comentar, ou deixe algo aqui embaixo.</p>
          )}
          {comments.map((c) => (
            <div className="comment-item" key={c.id}>
              {c.anchor_text && <div className="comment-anchor">{c.anchor_text}</div>}
              <div className="comment-meta">
                <span>{c.username}</span>
                <span>{new Date(c.created_at + 'Z').toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="comment-content">{c.content}</div>
              {user?.role === 'escritor' && (
                <div className="comment-actions">
                  <button className={c.pinned ? 'active' : ''} onClick={() => togglePin(c.id)}>
                    {c.pinned ? 'Fixado' : 'Fixar'}
                  </button>
                  <button className={c.resolved ? 'active' : ''} onClick={() => toggleResolve(c.id)}>
                    {c.resolved ? 'Resolvido' : 'Resolver'}
                  </button>
                </div>
              )}
              {c.replies?.map((r) => (
                <div className="comment-reply" key={r.id}>
                  <div className="comment-meta">
                    <span>{r.username}</span>
                    <span>{new Date(r.created_at + 'Z').toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="comment-content">{r.content}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="comments-drawer-composer">
          <textarea
            placeholder="Deixe uma nota sobre este capitulo"
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
          />
          <button onClick={submitComment}>Enviar</button>
        </div>
      </div>

      <GuidedTour
        steps={READER_CHAPTER_TOUR}
        storageKey="novly_tour_reader_chapter"
        promptTitle="Primeira vez lendo por aqui?"
        promptText="Posso mostrar rapidinho como destacar trechos e ajustar a leitura do seu jeito."
      />
    </div>
  );
}
