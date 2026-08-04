import './WriterFeather.css';

function stageFor(percent) {
  if (percent >= 100) return 3;
  if (percent >= 50) return 2;
  if (percent > 0) return 1;
  return 0;
}

const CAPTIONS = [
  'A pena ainda espera.',
  'A pena comeca a brilhar.',
  'A pena ganha um contorno dourado.',
  'A pena esta plena hoje.',
];

export default function WriterFeather({ percent = 0 }) {
  const stage = stageFor(percent);
  const goldOpacity = [0, 0.35, 0.7, 1][stage];
  const glowOpacity = stage === 3 ? 0.9 : 0;

  return (
    <div className="feather-wrap">
      <svg className="feather-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M32 6C32 6 16 18 16 36C16 46 23 54 32 58C41 54 48 46 48 36C48 18 32 6 32 6Z"
          fill="#2b2118"
          stroke="#8f7648"
          strokeWidth="1"
        />
        <path
          d="M32 6C32 6 16 18 16 36C16 46 23 54 32 58C41 54 48 46 48 36C48 18 32 6 32 6Z"
          fill="none"
          stroke="#c9a86a"
          strokeWidth="1.4"
          opacity={goldOpacity}
          className={stage === 3 ? 'feather-shine' : undefined}
        />
        <line x1="32" y1="10" x2="32" y2="56" stroke="#8f7648" strokeWidth="0.8" opacity="0.6" />
        {stage >= 1 && (
          <>
            <line x1="32" y1="18" x2="22" y2="24" stroke="#c9a86a" strokeWidth="0.8" opacity={goldOpacity} />
            <line x1="32" y1="18" x2="42" y2="24" stroke="#c9a86a" strokeWidth="0.8" opacity={goldOpacity} />
          </>
        )}
        {stage >= 2 && (
          <>
            <line x1="32" y1="28" x2="20" y2="35" stroke="#c9a86a" strokeWidth="0.8" opacity={goldOpacity} />
            <line x1="32" y1="28" x2="44" y2="35" stroke="#c9a86a" strokeWidth="0.8" opacity={goldOpacity} />
            <line x1="32" y1="38" x2="22" y2="45" stroke="#c9a86a" strokeWidth="0.8" opacity={goldOpacity} />
            <line x1="32" y1="38" x2="42" y2="45" stroke="#c9a86a" strokeWidth="0.8" opacity={goldOpacity} />
          </>
        )}
        {stage >= 3 && (
          <circle cx="32" cy="32" r="26" stroke="#c9a86a" strokeWidth="0.5" opacity={glowOpacity * 0.3} fill="none" />
        )}
      </svg>
      <p className="feather-caption">{CAPTIONS[stage]}</p>
    </div>
  );
}
