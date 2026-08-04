import { useState, useEffect, useRef, useCallback } from 'react';
import './Pomodoro.css';

const FOCUS_MINUTES = 25;
const SHORT_BREAK_MINUTES = 5;
const LONG_BREAK_MINUTES = 15;
const CYCLES_BEFORE_LONG_BREAK = 4;

export default function Pomodoro() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('foco');
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_MINUTES * 60);
  const [running, setRunning] = useState(false);
  const [completedCycles, setCompletedCycles] = useState(0);
  const intervalRef = useRef(null);

  const durationFor = useCallback((m) => {
    if (m === 'foco') return FOCUS_MINUTES * 60;
    if (m === 'pausa_curta') return SHORT_BREAK_MINUTES * 60;
    return LONG_BREAK_MINUTES * 60;
  }, []);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          handleCycleEnd();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, mode]);

  function handleCycleEnd() {
    setRunning(false);
    if (mode === 'foco') {
      const nextCount = completedCycles + 1;
      setCompletedCycles(nextCount);
      const nextMode = nextCount % CYCLES_BEFORE_LONG_BREAK === 0 ? 'pausa_longa' : 'pausa_curta';
      setMode(nextMode);
      setSecondsLeft(durationFor(nextMode));
    } else {
      setMode('foco');
      setSecondsLeft(durationFor('foco'));
    }
  }

  function toggleRunning() {
    setRunning((r) => !r);
  }

  function reset() {
    setRunning(false);
    setSecondsLeft(durationFor(mode));
  }

  function skip() {
    handleCycleEnd();
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  const modeLabel = mode === 'foco' ? 'Foco' : mode === 'pausa_curta' ? 'Pausa curta' : 'Pausa longa';

  if (!open) {
    return (
      <button className="pomodoro-toggle-btn editor-btn" onClick={() => setOpen(true)}>
        Pomodoro
      </button>
    );
  }

  return (
    <div className="pomodoro-panel">
      <div className="pomodoro-mode-label">{modeLabel}</div>
      <div className="pomodoro-time">{minutes}:{seconds}</div>
      <div className="pomodoro-controls">
        <button onClick={() => setOpen(false)}>Fechar</button>
        <button onClick={reset}>Reiniciar</button>
        <button className="primary" onClick={toggleRunning}>
          {running ? 'Pausar' : 'Iniciar'}
        </button>
      </div>
      <div className="pomodoro-cycle-dots">
        {Array.from({ length: CYCLES_BEFORE_LONG_BREAK }, (_, i) => (
          <span
            key={i}
            className={`pomodoro-cycle-dot${i < completedCycles % CYCLES_BEFORE_LONG_BREAK ? ' done' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
