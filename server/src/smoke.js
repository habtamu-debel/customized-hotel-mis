const base = 'http://localhost:5055/api/v1';

function iso(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function assert(cond, message, extra) {
  if (!cond) {
    console.error('FAIL', message, extra ? JSON.stringify(extra).slice(0, 400) : '');
    process.exitCode = 1;
  } else {
    console.log('OK', message);
  }
}

const health = await fetch('http://localhost:5055/health').then((r) => r.json());
assert(health.success, 'health');

const types = await call('/public/room-types');
assert(types.status === 200 && types.data.data.length === 6, 'six room types', types.data);

const checkIn = iso(12);
const checkOut = iso(14);
const avail = await call('/public/availability', {
  method: 'POST',
  body: { check_in: checkIn, check_out: checkOut, adults: 2, children: 0 },
});
assert(avail.status === 200, 'availability', avail.data);
const palace = avail.data.data.find((room) => room.slug === 'palace');
assert(palace && palace.available === 1 && palace.sample?.total > 0, 'palace available with price', palace);

const login = await call('/auth/login', {
  method: 'POST',
  body: { email: 'desk@fidelpalace.com', password: 'Palace@2026' },
});
assert(login.status === 200 && login.data.data.token, 'desk login');
const token = login.data.data?.token;

const dash = await call('/reports/dashboard', { token });
assert(dash.status === 200 && dash.data.data.arrivals.length >= 1, 'dashboard arrivals', {
  arrivals: dash.data.data?.arrivals?.length,
  occupancy: dash.data.data?.occupancy_percent,
});

const house = await call('/auth/login', {
  method: 'POST',
  body: { email: 'house@fidelpalace.com', password: 'Palace@2026' },
});
const denied = await call('/reservations', { token: house.data.data.token });
assert(denied.status === 403, 'housekeeping cannot list bookings', denied.data);

const guest = (n) => ({
  first_name: 'Test',
  last_name: `Guest${n}`,
  email: `race${n}@example.com`,
  phone: `+25191100010${n}`,
  nationality: 'Ethiopian',
});
const body = {
  check_in: checkIn,
  check_out: checkOut,
  adults: 2,
  children: 0,
  rooms: [{ room_type_id: palace.id, quantity: 1 }],
  payment_preference: 'pay_at_hotel',
};
const [a, b] = await Promise.all([
  call('/public/bookings', { method: 'POST', body: { ...body, guest: guest(1) } }),
  call('/public/bookings', { method: 'POST', body: { ...body, guest: guest(2) } }),
]);
const statuses = [a.status, b.status].sort();
assert(statuses[0] === 201 && statuses[1] === 409, 'only one palace booking wins', { a: a.status, b: b.status, am: a.data.message, bm: b.data.message });

const winner = a.status === 201 ? a.data.data : b.data.data;
const looked = await call(`/public/bookings/${winner.booking_ref}?email=${encodeURIComponent(winner.email)}`);
assert(looked.status === 200 && looked.data.data.total_amount > 0, 'confirmation lookup', looked.data.data?.booking_ref);

const list = await call('/reservations?q=Sara', { token });
const sara = list.data.data?.find((row) => row.last_name === 'Mekonnen');
assert(sara, 'sara arrival exists');
if (sara) {
  const checked = await call(`/reservations/${sara.id}/check-in`, { method: 'POST', token, body: {} });
  assert(checked.status === 200 && checked.data.data.status === 'checked_in', 'sara check-in', checked.data);
}

if (process.exitCode) process.exit(process.exitCode);
console.log('smoke passed');
