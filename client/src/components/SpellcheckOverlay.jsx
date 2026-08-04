import { useState, useRef, useEffect } from 'react';
import './SpellcheckOverlay.css';

export default function SpellcheckOverlay({ text, issues, textareaRef, onApplySuggestion, onIgnore, fontFamily, fontSize }) {
  const [popover, setPopover] = useState(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    function syncScroll() {
      if (overlayRef.current && textareaRef.current) {
        overlayRef.current.scrollTop = textareaRef.current.scrollTop;
        overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
    }
    const el = textareaRef.current;
    el?.addEventListener('scroll', syncScroll);
    return () => el?.removeEventListener('scroll', syncScroll);
  }, [textareaRef]);

  const overlayStyle = { fontFamily, fontSize: fontSize ? `${fontSize}px` : undefined };

  if (!issues || issues.length === 0) {
    return <div className="spellcheck-overlay" style={overlayStyle} ref={overlayRef}>{text}</div>;
  }

  const sorted = [...issues].sort((a, b) => a.index - b.index);
  const segments = [];
  let cursor = 0;

  sorted.forEach((issue, i) => {
    if (issue.index < cursor) return;
    if (issue.index > cursor) {
      segments.push({ type: 'text', content: text.slice(cursor, issue.index) });
    }
    segments.push({
      type: 'mark',
      content: text.slice(issue.index, issue.index + issue.length),
      issue,
      key: `${issue.index}-${i}`,
    });
    cursor = issue.index + issue.length;
  });
  if (cursor < text.length) {
    segments.push({ type: 'text', content: text.slice(cursor) });
  }

  function handleMarkClick(e, issue) {
    const rect = e.target.getBoundingClientRect();
    setPopover({ issue, x: rect.left, y: rect.bottom + 6 });
  }

  function handleSuggestion(suggestion) {
    if (popover) {
      onApplySuggestion(popover.issue, suggestion);
      setPopover(null);
    }
  }

  function handleIgnore() {
    if (popover) {
      onIgnore(popover.issue);
      setPopover(null);
    }
  }

  return (
    <>
      <div className="spellcheck-overlay" style={overlayStyle} ref={overlayRef} onClick={() => setPopover(null)}>
        {segments.map((seg, i) =>
          seg.type === 'text' ? (
            <span key={i}>{seg.content}</span>
          ) : (
            <span
              key={seg.key}
              className={`spellcheck-mark${seg.issue.category === 'gramatica' ? ' gramatica' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleMarkClick(e, seg.issue);
              }}
            >
              {seg.content}
            </span>
          )
        )}
      </div>

      {popover && (
        <div className="spellcheck-popover" style={{ left: popover.x, top: popover.y }}>
          <p className="spellcheck-popover-message">{popover.issue.message}</p>
          {popover.issue.suggestions?.length > 0 && (
            <div className="spellcheck-popover-suggestions">
              {popover.issue.suggestions.map((s) => (
                <button key={s} onClick={() => handleSuggestion(s)}>{s}</button>
              ))}
            </div>
          )}
          <button className="spellcheck-popover-ignore" onClick={handleIgnore}>Ignorar</button>
        </div>
      )}
    </>
  );
}
