import { useTimeOfDay } from './useTimeOfDay.js';
import { findPreset } from '../lib/backgroundPresets.js';
import { mediaUrl } from '../lib/api';

function isVideoUrl(value) {
  if (!value) return false;
  const lower = value.toLowerCase().split('?')[0];
  return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.includes('/bgvid-');
}

export function useResolvedBackground(user) {
  const timeOfDay = useTimeOfDay();

  const defaultStyle = {
    background: `radial-gradient(ellipse 80% 40% at 50% 0%, ${timeOfDay.glow}, transparent 60%), ${timeOfDay.warmth}`,
  };

  if (!user || user.background_type === 'default' || !user.background_type) {
    return { style: defaultStyle, videoUrl: null };
  }

  if (user.background_type === 'preset') {
    const preset = findPreset(user.background_value);
    if (preset) return { style: { background: preset.style }, videoUrl: null };
    return { style: defaultStyle, videoUrl: null };
  }

  if (user.background_type === 'video' || (user.background_type === 'url' && isVideoUrl(user.background_value))) {
    return {
      style: {
        background: 'rgba(12, 11, 18, 0.72)',
      },
      videoUrl: mediaUrl(user.background_value),
    };
  }

  if (user.background_type === 'upload' || user.background_type === 'url') {
    return {
      style: {
        backgroundImage: `linear-gradient(rgba(12, 11, 18, 0.75), rgba(12, 11, 18, 0.75)), url(${mediaUrl(user.background_value)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      },
      videoUrl: null,
    };
  }

  return { style: defaultStyle, videoUrl: null };
}
