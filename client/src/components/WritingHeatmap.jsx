import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import './WritingHeatmap.css';

function levelFor(words) {
  if (!words || words <= 0) return 0;
  if (words < 150) return 1;
  if (words < 400) return 2;
  if (words < 800) return 3;
  return 4;
}

export default function WritingHeatmap({ days = 182 }) {
  const [history, setHistory] = useState(null);

  useEffect(() => {
    api.writerHistory(days).then((data) => setHistory(data.days)).catch(() => setHistory([]));
  }, [days]);

  if (!history) return null;

  const byDay = new Map(history.map((d) => [d.day, d.words]));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cells = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ key, words: byDay.get(key) || 0 });
  }

  const leadingBlanks = (cells[0] ? new Date(cells[0].key).getDay() : 0);
  const paddedCells = Array.from({ length: leadingBlanks }, () => null).concat(cells);

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-grid">
        {paddedCells.map((cell, i) => (
          <div
            key={cell ? cell.key : `blank-${i}`}
            className="heatmap-cell"
            data-level={cell ? levelFor(cell.words) : undefined}
            style={cell ? undefined : { background: 'transparent' }}
            title={cell ? `${cell.key}: ${cell.words} palavras` : undefined}
          />
        ))}
      </div>
      <div className="heatmap-legend">
        <span>menos</span>
        <div className="heatmap-legend-cells">
          {[0, 1, 2, 3, 4].map((lvl) => (
            <div key={lvl} className="heatmap-cell" data-level={lvl || undefined} />
          ))}
        </div>
        <span>mais</span>
      </div>
    </div>
  );
}
