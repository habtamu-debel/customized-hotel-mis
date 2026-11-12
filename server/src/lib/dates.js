export function todayISO(date = new Date()) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return todayISO(dt);
}

export function nightsBetween(checkIn, checkOut) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn || '') || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut || '')) {
    return NaN;
  }
  const [y1, m1, d1] = checkIn.split('-').map(Number);
  const [y2, m2, d2] = checkOut.split('-').map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

export function eachNight(checkIn, nights) {
  const [y, m, d] = checkIn.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const out = [];
  for (let i = 0; i < nights; i += 1) {
    out.push(dt.toISOString().slice(0, 10));
    dt.setUTCDate(dt.getUTCDate() + 1);
  }
  return out;
}

export function weekday(iso) {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

export function asDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}
