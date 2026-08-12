import { useMemo, useState } from 'react';
import { toggleSound, setVolume } from '../lib/ambientSounds';
import './AmbientSounds.css';

const SOUNDS = [
  { key: 'chuva', label: 'Chuva' },
  { key: 'lareira', label: 'Lareira' },
  { key: 'maquina_escrever', label: 'Maquina de escrever' },
  { key: 'instrumental', label: 'Piano instrumental' },
];

function extractYoutubeId(input) {
  if (!input) return '';
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace('/', '').slice(0, 11);
    }
    const v = u.searchParams.get('v');
    if (v) return v.slice(0, 11);
    const parts = u.pathname.split('/');
    const embedIdx = parts.indexOf('embed');
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1].slice(0, 11);
  } catch {
    return '';
  }
  return '';
}

export default function AmbientSounds() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({
    chuva: { on: false, volume: 0.4 },
    lareira: { on: false, volume: 0.4 },
    maquina_escrever: { on: false, volume: 0.3 },
    instrumental: { on: false, volume: 0.35 },
  });
  const [ytInput, setYtInput] = useState(() => localStorage.getItem('novly_yt_url') || '');
  const [ytPlaying, setYtPlaying] = useState(false);
  const videoId = useMemo(() => extractYoutubeId(ytInput), [ytInput]);

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

  function handleYtSubmit(e) {
    e.preventDefault();
    localStorage.setItem('novly_yt_url', ytInput.trim());
    if (extractYoutubeId(ytInput)) setYtPlaying(true);
  }

  const anyOn = Object.values(state).some((s) => s.on) || ytPlaying;

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

          <div className="ambient-music-card">
            <div className="ambient-music-card-head">
              <span className="ambient-music-title">Musica (YouTube)</span>
              {ytPlaying && videoId && (
                <button type="button" className="ambient-music-stop" onClick={() => setYtPlaying(false)}>
                  Parar
                </button>
              )}
            </div>
            <p className="ambient-music-hint">Cole o link ou o ID de um video do YouTube.</p>
            <form className="ambient-music-form" onSubmit={handleYtSubmit}>
              <input
                type="text"
                value={ytInput}
                onChange={(e) => setYtInput(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
              />
              <button type="submit" disabled={!extractYoutubeId(ytInput)}>
                Tocar
              </button>
            </form>
            {ytPlaying && videoId && (
              <div className="ambient-music-embed">
                <iframe
                  title="Musica YouTube"
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
