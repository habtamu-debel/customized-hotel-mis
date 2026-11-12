import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportApi } from '../../lib/api';
import { formatDate, money, STATUS_LABEL } from '../../lib/format';
import { useAuthStore } from '../../store/authStore';

export default function Dashboard() {
  const role = useAuthStore((state) => state.user?.role);
  const finance = role !== 'housekeeping';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    reportApi.dashboard().then((res) => setData(res.data.data)).catch(() => setError('The day board did not load.'));
  }, []);

  if (error) return <p>{error}</p>;
  if (!data) return <p className="text-mist">Loading the house…</p>;

  const cards = [
    ['Occupancy', `${data.occupancy_percent}%`],
    ['In house', data.in_house],
    ['Arrivals', data.arrivals.length],
    ['Departures', data.departures.length],
    ['Rooms to clean', data.dirty_rooms],
    finance ? ['Collected today', money(data.collected_today)] : ['Sold tonight', data.sold_tonight],
  ];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mist">{formatDate(data.today)}</p>
      <h1 className="display mt-1 text-4xl">Today in the house</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mist">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <List title="Arrivals" rows={data.arrivals} empty="No one expected today." />
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Departures</h2>
          <div className="mt-3 space-y-2">
            {data.departures.map((row) => (
              <Link key={row.id} to={`/staff/reservations/${row.id}`} className="block rounded-xl bg-paper px-3 py-2 text-sm">
                <span className="font-semibold">{row.first_name} {row.last_name}</span>
                <span className="block text-mist">Room {row.room_numbers || '—'} · balance {money(Number(row.total_amount) - Number(row.paid_amount))}</span>
              </Link>
            ))}
            {!data.departures.length && <p className="text-sm text-mist">No departures on the book.</p>}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Next seven mornings</h2>
        <div className="mt-4 flex items-end gap-2">
          {data.forecast.map((day) => (
            <div key={day.date} className="flex-1 text-center">
              <div className="mx-auto w-full rounded-t-lg bg-ink/90" style={{ height: `${12 + day.arrivals * 18}px` }} />
              <p className="mt-1 text-[10px] text-mist">{day.date.slice(5)}</p>
              <p className="text-xs font-semibold">{day.arrivals}</p>
            </div>
          ))}
        </div>
      </section>

      {finance && (
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Notes from the website</h2>
          <div className="mt-3 space-y-2">
            {data.messages.map((note) => (
              <article key={note.id} className="rounded-xl bg-paper px-3 py-2 text-sm">
                <p className="font-semibold">{note.name} · {note.topic}</p>
                <p className="text-mist">{note.body}</p>
              </article>
            ))}
            {!data.messages.length && <p className="text-sm text-mist">No messages yet.</p>}
          </div>
        </section>
      )}
    </div>
  );
}

function List({ title, rows, empty }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <Link key={row.id} to={`/staff/reservations/${row.id}`} className="block rounded-xl bg-paper px-3 py-2 text-sm">
            <span className="font-semibold">{row.first_name} {row.last_name}</span>
            <span className="float-right text-xs text-mist">{STATUS_LABEL[row.status]}</span>
            <span className="block text-mist">{row.booking_ref} · {row.room_types}</span>
          </Link>
        ))}
        {!rows.length && <p className="text-sm text-mist">{empty}</p>}
      </div>
    </section>
  );
}
