import { useEffect, useState, useMemo } from 'react';
import { api } from '../lib/api';
import './WritingCalendar.css';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function levelFor(words) {
  if (!words || words <= 0) return 0;
  if (words < 150) return 1;
  if (words < 400) return 2;
  if (words < 800) return 3;
  return 4;
}

export default function WritingCalendar() {
  const [history, setHistory] = useState(null);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  useEffect(() => {
    api.writerHistory(366).then((data) => setHistory(data.days)).catch(() => setHistory([]));
  }, []);

  const byDay = useMemo(() => {
    if (!history) return new Map();
    return new Map(history.map((d) => [d.day, d.words]));
  }, [history]);

  if (!history) return null;

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = new Date().toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, key, words: byDay.get(key) || 0 });
  }

  function prevMonth() {
    setCursor(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCursor(new Date(year, month + 1, 1));
  }

  return (
    <div>
      <div className="wcal-header">
        <button className="wcal-nav-btn" onClick={prevMonth}>Anterior</button>
        <span className="wcal-month-label">{MONTHS[month]} de {year}</span>
        <button className="wcal-nav-btn" onClick={nextMonth}>Proximo</button>
      </div>
      <div className="wcal-grid">
        {WEEKDAYS.map((w, i) => (
          <div className="wcal-weekday" key={i}>{w}</div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div className="wcal-day empty" key={`empty-${i}`} />;
          const level = levelFor(cell.words);
          return (
            <div
              key={cell.key}
              className={`wcal-day${cell.words > 0 ? ' has-words' : ''}${cell.key === todayKey ? ' today' : ''}`}
              data-level={level || undefined}
              title={cell.words > 0 ? `${cell.words} palavras` : undefined}
            >
              {cell.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}
