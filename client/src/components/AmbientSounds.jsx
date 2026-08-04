import { useState } from 'react';
import { toggleSound, setVolume } from '../lib/ambientSounds';
import './AmbientSounds.css';

const SOUNDS = [
  { key: 'chuva', label: 'Chuva' },
  { key: 'lareira', label: 'Lareira' },
  { key: 'maquina_escrever', label: 'Maquina de escrever' },
  { key: 'instrumental', label: 'Piano instrumental' },
];

export default function AmbientSounds() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({
    chuva: { on: false, volume: 0.4 },
    lareira: { on: false, volume: 0.4 },
    maquina_escrever: { on: false, volume: 0.3 },
    instrumental: { on: false, volume: 0.35 },
  });

  function handleToggle(key) {
    const next = !state[key].on;

    setState((s) => {
      const updated = { ...s };
      if (next) {
        Object.keys(updated).forEach((otherKey) => {
          if (otherKey !== key && updated[otherKey].on) {
            toggleSound(otherKey, false);
            updated[otherKey] = { ...updated[otherKey], on: false };
          }
        });
      }
      updated[key] = { ...updated[key], on: next };
      return updated;
    });

    toggleSound(key, next, state[key].volume);
  }

  function handleVolume(key, value) {
    const volume = Number(value);
    setVolume(key, volume);
    setState((s) => ({ ...s, [key]: { ...s[key], volume } }));
  }

  const anyOn = Object.values(state).some((s) => s.on);

  return (
    <>
      <button
        className={`ambient-toggle-btn${anyOn ? ' active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Sons ambiente"
        title="Sons ambiente"
      >
        Som
      </button>

      {open && (
        <div className="ambient-panel">
          {SOUNDS.map((s) => (
            <div className="ambient-sound-row" key={s.key}>
              <div className="ambient-sound-header">
                <span className={`ambient-sound-label${state[s.key].on ? ' on' : ''}`}>{s.label}</span>
                <div
                  className={`ambient-sound-switch${state[s.key].on ? ' on' : ''}`}
                  onClick={() => handleToggle(s.key)}
                  role="switch"
                  aria-checked={state[s.key].on}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleToggle(s.key)}
                >
                  <div className="ambient-sound-switch-knob" />
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={state[s.key].volume}
                onChange={(e) => handleVolume(s.key, e.target.value)}
                disabled={!state[s.key].on}
              />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
