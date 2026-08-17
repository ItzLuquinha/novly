const db = require('./db');

function timeZone() {
  try { return db.env().APP_TIMEZONE || 'America/New_York'; }
  catch { return 'America/New_York'; }
}

function formatter() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone(),
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return new Date(`${value.replace(' ', 'T')}Z`);
  return new Date(value);
}

function dateKey(value = new Date()) {
  const parts = formatter().formatToParts(toDate(value));
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function shiftDateKey(key, days) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function consecutiveStreak(keys, today = dateKey()) {
  const set = new Set(keys);
  let cursor = today;
  let streak = 0;
  if (!set.has(cursor)) cursor = shiftDateKey(cursor, -1);
  while (set.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

module.exports = { timeZone, dateKey, shiftDateKey, consecutiveStreak };
