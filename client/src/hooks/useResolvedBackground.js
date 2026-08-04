import { useTimeOfDay } from './useTimeOfDay.js';
import { findPreset } from '../lib/backgroundPresets.js';

export function useResolvedBackground(user) {
  const timeOfDay = useTimeOfDay();

  if (!user || user.background_type === 'default' || !user.background_type) {
    return {
      background: `radial-gradient(ellipse 80% 40% at 50% 0%, ${timeOfDay.glow}, transparent 60%), ${timeOfDay.warmth}`,
    };
  }

  if (user.background_type === 'preset') {
    const preset = findPreset(user.background_value);
    if (preset) return { background: preset.style };
    return {
      background: `radial-gradient(ellipse 80% 40% at 50% 0%, ${timeOfDay.glow}, transparent 60%), ${timeOfDay.warmth}`,
    };
  }

  if (user.background_type === 'upload' || user.background_type === 'url') {
    return {
      backgroundImage: `linear-gradient(rgba(13, 10, 8, 0.72), rgba(13, 10, 8, 0.72)), url(${user.background_value})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
    };
  }

  return {
    background: `radial-gradient(ellipse 80% 40% at 50% 0%, ${timeOfDay.glow}, transparent 60%), ${timeOfDay.warmth}`,
  };
}
