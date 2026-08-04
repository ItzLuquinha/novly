import { useEffect, useState } from 'react';

const PHASES = {
  madrugada: { glow: 'rgba(74, 55, 40, 0.18)', warmth: '#0d0a08' },
  manha: { glow: 'rgba(201, 168, 106, 0.14)', warmth: '#171310' },
  tarde: { glow: 'rgba(181, 103, 58, 0.12)', warmth: '#14100d' },
  noite: { glow: 'rgba(74, 55, 40, 0.28)', warmth: '#0d0a08' },
};

function phaseForHour(hour) {
  if (hour >= 5 && hour < 9) return 'manha';
  if (hour >= 9 && hour < 18) return 'tarde';
  if (hour >= 18 && hour < 23) return 'noite';
  return 'madrugada';
}

export function useTimeOfDay() {
  const [phase, setPhase] = useState(() => phaseForHour(new Date().getHours()));

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase(phaseForHour(new Date().getHours()));
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { phase, ...PHASES[phase] };
}
