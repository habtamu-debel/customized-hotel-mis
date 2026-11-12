export function money(value, currency = 'ETB') {
  const n = Number(value || 0);
  const cents = Math.round(n * 100) % 100;
  return `${currency} ${n.toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })}`;
}

export function todayISO() {
  const d = new Date();
  return isoFromDate(d);
}

export function isoFromDate(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return isoFromDate(dt);
}

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export function nights(checkIn, checkOut) {
  const [y1, m1, d1] = checkIn.split('-').map(Number);
  const [y2, m2, d2] = checkOut.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export const STATUS_LABEL = {
  inquiry: 'Inquiry',
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'In house',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

export const ROOM_LABEL = {
  available: 'Available',
  occupied: 'Occupied',
  dirty: 'Dirty',
  clean: 'Clean',
  inspected: 'Inspected',
  out_of_order: 'Out of order',
  maintenance: 'Maintenance',
};

export const ROLE_LABEL = {
  owner: 'Owner',
  manager: 'Manager',
  front_desk: 'Front desk',
  housekeeping: 'Housekeeping',
};

export function errorText(error, fallback = 'Something went wrong.') {
  return error?.response?.data?.message || fallback;
}
