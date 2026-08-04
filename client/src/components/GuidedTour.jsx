import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { READER_TOUR, WRITER_TOUR } from '../lib/tourSteps.js';
import './GuidedTour.css';

function getTourStatus(storageKey, userId) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data[userId] || null;
  } catch {
    return null;
  }
}

function setTourStatus(storageKey, userId, status) {
  try {
    const raw = localStorage.getItem(storageKey);
    const data = raw ? JSON.parse(raw) : {};
    data[userId] = status;
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    // ignore storage failures, tour prompt will just show again next time
  }
}

function findTargetRect(selector) {
  const el = document.querySelector(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return rect;
}

function cardPosition(rect, placement, cardWidth = 340, cardHeight = 180) {
  const margin = 18;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top;
  let left;

  if (placement === 'right') {
    top = rect.top + rect.height / 2 - cardHeight / 2;
    left = rect.right + margin;
  } else if (placement === 'left') {
    top = rect.top + rect.height / 2 - cardHeight / 2;
    left = rect.left - cardWidth - margin;
  } else if (placement === 'top') {
    top = rect.top - cardHeight - margin;
    left = rect.left + rect.width / 2 - cardWidth / 2;
  } else {
    top = rect.bottom + margin;
    left = rect.left + rect.width / 2 - cardWidth / 2;
  }

  top = Math.max(12, Math.min(top, vh - cardHeight - 12));
  left = Math.max(12, Math.min(left, vw - cardWidth - 12));

  return { top, left };
}

function pointerPosition(rect, placement) {
  if (placement === 'right') return { top: rect.top + rect.height / 2 - 18, left: rect.right + 4, dir: 'right' };
  if (placement === 'left') return { top: rect.top + rect.height / 2 - 18, left: rect.left - 40, dir: 'left' };
  if (placement === 'top') return { top: rect.top - 44, left: rect.left + rect.width / 2 - 18, dir: 'top' };
  return { top: rect.bottom + 6, left: rect.left + rect.width / 2 - 18, dir: 'bottom' };
}

function TourPointer({ dir, top, left }) {
  const rotation = { top: 180, bottom: 0, left: 90, right: -90 }[dir] || 0;
  return (
    <div className={`tour-pointer dir-${dir}`} style={{ top, left }}>
      <svg viewBox="0 0 36 36" style={{ transform: `rotate(${rotation}deg)` }}>
        <path d="M18 4 L18 26 M10 18 L18 26 L26 18" stroke="#c9a86a" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function SpotlightMask({ rect }) {
  if (!rect) return null;
  const pad = 10;
  const x = rect.left - pad;
  const y = rect.top - pad;
  const w = rect.width + pad * 2;
  const h = rect.height + pad * 2;
  const r = 10;

  return (
    <svg className="tour-backdrop-svg">
      <defs>
        <mask id="tour-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={r} fill="black" />
        </mask>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" className="tour-hole-mask-bg" mask="url(#tour-mask)" />
      <rect x={x} y={y} width={w} height={h} rx={r} className="tour-spotlight-ring" />
    </svg>
  );
}

export default function GuidedTour({
  steps: stepsProp,
  storageKey = 'novly_tour_status',
  promptTitle,
  promptText,
  autoPrompt = true,
  replayTriggerRef,
}) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [showPrompt, setShowPrompt] = useState(false);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const promptCheckedRef = useRef(false);

  const steps = stepsProp || (user?.role === 'escritor' ? WRITER_TOUR : READER_TOUR);
  const step = steps[stepIndex];

  useEffect(() => {
    if (!user || promptCheckedRef.current || !autoPrompt) return;
    promptCheckedRef.current = true;
    const status = getTourStatus(storageKey, user.id);
    if (!status) {
      setShowPrompt(true);
    }
  }, [user, storageKey, autoPrompt]);

  function handleReplay() {
    setStepIndex(0);
    setActive(true);
  }

  useEffect(() => {
    if (!replayTriggerRef) return;
    replayTriggerRef.current = handleReplay;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayTriggerRef]);

  const measure = useCallback(() => {
    if (!step) return;
    const found = findTargetRect(step.target);
    setRect(found);
  }, [step]);

  useEffect(() => {
    if (!active || !step) return;

    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
      return;
    }

    if (step.optional) {
      let cancelled = false;
      const raf = requestAnimationFrame(() => {
        if (cancelled) return;
        const found = findTargetRect(step.target);
        if (found) {
          setRect(found);
        } else {
          handleNext();
        }
      });
      window.addEventListener('resize', measure);
      window.addEventListener('scroll', measure, true);
      return () => {
        cancelled = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', measure);
        window.removeEventListener('scroll', measure, true);
      };
    }

    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      const found = findTargetRect(step.target);
      if (found) {
        setRect(found);
        clearInterval(interval);
      } else if (attempts > 40) {
        clearInterval(interval);
        handleNext();
      }
    }, 150);

    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex, location.pathname]);

  function handleAcceptTour() {
    setShowPrompt(false);
    setActive(true);
    setStepIndex(0);
  }

  function handleDeclineTour() {
    setShowPrompt(false);
    if (user) setTourStatus(storageKey, user.id, 'declined');
  }

  function handleNext() {
    if (stepIndex >= steps.length - 1) {
      handleFinish();
      return;
    }
    setRect(null);
    setStepIndex((i) => i + 1);
  }

  function handlePrev() {
    if (stepIndex === 0) return;
    setRect(null);
    setStepIndex((i) => i - 1);
  }

  function handleFinish() {
    setActive(false);
    setRect(null);
    if (user) setTourStatus(storageKey, user.id, 'completed');
  }

  if (showPrompt) {
    return (
      <div className="tour-prompt-overlay">
        <div className="tour-prompt-card">
          <div className="tour-prompt-icon">✦</div>
          <h2 className="tour-prompt-title">{promptTitle || 'Quer um tour rapido?'}</h2>
          <p className="tour-prompt-text">
            {promptText || 'Posso te mostrar onde fica cada coisa por aqui, bem rapidinho. Se preferir explorar sozinha, sem problema.'}
          </p>
          <div className="tour-prompt-actions">
            <button className="tour-decline" onClick={handleDeclineTour}>Agora nao</button>
            <button className="tour-accept" onClick={handleAcceptTour}>Sim, mostra</button>
          </div>
        </div>
      </div>
    );
  }

  if (!active || !step) {
    return null;
  }

  return (
    <>
      <div className="tour-backdrop">
        <SpotlightMask rect={rect} />
      </div>
      {rect && (
        <>
          {(() => {
            const p = pointerPosition(rect, step.placement);
            return <TourPointer dir={p.dir} top={p.top} left={p.left} />;
          })()}
          {(() => {
            const pos = cardPosition(rect, step.placement);
            return (
              <div className="tour-card" style={{ top: pos.top, left: pos.left }}>
                <div className="tour-card-step">Passo {stepIndex + 1} de {steps.length}</div>
                <h3 className="tour-card-title">{step.title}</h3>
                <p className="tour-card-text">{step.text}</p>
                <div className="tour-card-actions">
                  <button className="tour-card-skip" onClick={handleFinish}>Pular tour</button>
                  <div className="tour-card-nav">
                    {stepIndex > 0 && (
                      <button className="tour-prev" onClick={handlePrev}>Voltar</button>
                    )}
                    <button className="tour-next" onClick={handleNext}>
                      {stepIndex >= steps.length - 1 ? 'Concluir' : 'Proximo'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </>
  );
}
