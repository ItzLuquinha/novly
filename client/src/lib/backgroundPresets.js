function svgToDataUri(svg) {
  const encoded = encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
}

const bookshelfSvg = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500" viewBox="0 0 900 500">
  <rect x="0" y="60" width="900" height="14" fill="#3a2c1f" opacity="0.5"/>
  <rect x="0" y="230" width="900" height="14" fill="#3a2c1f" opacity="0.5"/>
  <rect x="0" y="400" width="900" height="14" fill="#3a2c1f" opacity="0.5"/>
  ${[40, 75, 105, 145, 180, 215, 260, 300, 335, 375, 420, 460, 505, 545, 580, 620, 660, 700, 740, 780, 820, 860]
    .map((x, i) => {
      const h = 130 + (i % 4) * 15;
      const colors = ['#4a3728', '#5a4530', '#3a2c1f', '#6e4527', '#2b2118'];
      const color = colors[i % colors.length];
      const w = 22 + (i % 3) * 8;
      return `<rect x="${x}" y="${60 - h + 130}" width="${w}" height="${h}" fill="${color}" opacity="0.55"/>`;
    }).join('')}
  ${[40, 75, 105, 145, 180, 215, 260, 300, 335, 375, 420, 460, 505, 545, 580, 620, 660, 700, 740, 780, 820, 860]
    .map((x, i) => {
      const h = 120 + (i % 3) * 18;
      const colors = ['#5a4530', '#4a3728', '#6e4527', '#3a2c1f'];
      const color = colors[i % colors.length];
      const w = 20 + (i % 4) * 7;
      return `<rect x="${x}" y="${230 - h + 130}" width="${w}" height="${h}" fill="${color}" opacity="0.5"/>`;
    }).join('')}
</svg>
`);

const coffeeCupSvg = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
  <ellipse cx="250" cy="420" rx="90" ry="14" fill="#1a1410" opacity="0.3"/>
  <path d="M 170 300 L 190 400 Q 195 415 210 415 L 290 415 Q 305 415 310 400 L 330 300 Z" fill="#3a2c1f" opacity="0.6"/>
  <ellipse cx="250" cy="300" rx="80" ry="16" fill="#241a10" opacity="0.7"/>
  <path d="M 330 320 Q 370 320 370 350 Q 370 380 330 375" stroke="#3a2c1f" stroke-width="10" fill="none" opacity="0.6"/>
  <path d="M 235 260 Q 225 230 240 200 Q 250 180 240 155" stroke="#8f7648" stroke-width="4" fill="none" opacity="0.25"/>
  <path d="M 265 260 Q 255 225 270 195 Q 280 175 268 148" stroke="#8f7648" stroke-width="4" fill="none" opacity="0.2"/>
</svg>
`);

const fireplaceSvg = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="500" viewBox="0 0 600 500">
  <rect x="150" y="380" width="300" height="70" fill="#1a1410" opacity="0.5"/>
  <path d="M 260 420 Q 250 380 270 350 Q 265 335 280 310 Q 300 340 295 365 Q 315 345 310 320 Q 335 355 320 395 Q 340 375 335 350 Q 355 385 330 420 Z" fill="#b5673a" opacity="0.5"/>
  <path d="M 270 420 Q 265 395 280 375 Q 290 395 285 415 Z" fill="#d4823a" opacity="0.55"/>
  <path d="M 310 420 Q 305 390 320 365 Q 330 390 322 418 Z" fill="#e8a04a" opacity="0.5"/>
  ${[190, 220, 380, 410].map((x) => `<rect x="${x}" y="425" width="26" height="14" rx="4" fill="#2b2118" opacity="0.6"/>`).join('')}
</svg>
`);

const rainWindowSvg = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
  ${Array.from({ length: 26 }, (_, i) => {
    const x = (i * 37 + 10) % 500;
    const len = 30 + (i % 4) * 12;
    const y = (i * 53) % 460;
    return `<line x1="${x}" y1="${y}" x2="${x - 6}" y2="${y + len}" stroke="#8fa3b8" stroke-width="1.5" opacity="0.22"/>`;
  }).join('')}
</svg>
`);

const paperTextureSvg = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="noise"/><feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.79  0 0 0 0 0.66  0 0 0 0 0.42  0 0 0 0.05 0"/></filter>
  <rect width="400" height="400" filter="url(#n)"/>
</svg>
`);

const leatherTextureSvg = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <filter id="l"><feTurbulence type="turbulence" baseFrequency="0.045" numOctaves="3" result="noise"/><feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.22  0 0 0 0 0.1  0 0 0 0.12 0"/></filter>
  <rect width="400" height="400" filter="url(#l)"/>
</svg>
`);

export const BACKGROUND_PRESETS = [
  {
    key: 'biblioteca-noite',
    label: 'Biblioteca a noite',
    style: `radial-gradient(ellipse 90% 70% at 50% -10%, rgba(74, 55, 40, 0.5), transparent 65%), url("${bookshelfSvg}"), linear-gradient(180deg, #1a1410, #0d0a08)`,
  },
  {
    key: 'cafeteria',
    label: 'Cafeteria',
    style: `radial-gradient(ellipse 60% 60% at 78% 88%, rgba(181, 103, 58, 0.35), transparent 55%), url("${coffeeCupSvg}") right bottom / 340px no-repeat, linear-gradient(160deg, #2b2118, #14100d)`,
  },
  {
    key: 'lareira',
    label: 'Lareira acesa',
    style: `radial-gradient(ellipse 70% 60% at 50% 105%, rgba(212, 130, 58, 0.4), transparent 62%), url("${fireplaceSvg}") center bottom / 480px no-repeat, linear-gradient(0deg, #241a10, #100c09)`,
  },
  {
    key: 'madrugada',
    label: 'Madrugada chuvosa',
    style: `radial-gradient(ellipse 100% 60% at 50% 0%, rgba(63, 82, 110, 0.22), transparent 70%), url("${rainWindowSvg}") repeat, linear-gradient(180deg, #0f1216, #0a0807)`,
  },
  {
    key: 'papel-velho',
    label: 'Papel envelhecido',
    style: `radial-gradient(ellipse 90% 70% at 50% 0%, rgba(201, 168, 106, 0.18), transparent 62%), url("${paperTextureSvg}") repeat, linear-gradient(160deg, #2a2419, #171310)`,
  },
  {
    key: 'couro',
    label: 'Couro escuro',
    style: `radial-gradient(ellipse 80% 60% at 50% 15%, rgba(139, 94, 52, 0.32), transparent 62%), url("${leatherTextureSvg}") repeat, linear-gradient(160deg, #241a10, #120e0b)`,
  },
];

export function findPreset(key) {
  return BACKGROUND_PRESETS.find((p) => p.key === key);
}
