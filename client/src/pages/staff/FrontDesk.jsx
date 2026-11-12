import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { reportApi, stayApi } from '../../lib/api';
import { errorText, money, STATUS_LABEL } from '../../lib/format';

export default function FrontDesk() {
  const [data, setData] = useState(null);

  function load() {
    reportApi.dashboard().then((res) => setData(res.data.data));
  }
  useEffect(load, []);

  async function checkIn(id) {
    try {
      await stayApi.checkIn(id);
      toast.success('Checked in');
      load();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  if (!data) return <p className="text-mist">Loading the desk…</p>;

  return (
    <div>
      <h1 className="display text-4xl">Front desk</h1>
      <p className="mt-1 text-sm text-mist">{data.in_house} in house · {data.dirty_rooms} rooms still dirty</p>
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Column title="Arriving">
          {data.arrivals.map((row) => (
            <Card key={row.id} row={row} meta={`${row.room_types}${row.room_numbers ? ` · ${row.room_numbers}` : ''}`}>
              <button onClick={() => checkIn(row.id)} className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">Check in</button>
              <Link to={`/staff/reservations/${row.id}`} className="text-xs font-semibold underline">Open</Link>
            </Card>
          ))}
          {!data.arrivals.length && <Empty>No arrivals left today.</Empty>}
        </Column>
        <Column title="In house">
          <p className="text-sm text-mist">{data.in_house} guests checked in. Open a departure or a booking to post a charge.</p>
          <Link to="/staff/reservations?status=checked_in" className="mt-3 inline-block text-sm font-semibold underline">See the in-house list</Link>
        </Column>
        <Column title="Leaving">
          {data.departures.map((row) => (
            <Card key={row.id} row={row} meta={`Room ${row.room_numbers || '—'} · due ${money(Math.max(0, Number(row.total_amount) + Number(row.extras || 0) - Number(row.paid_amount)))}`}>
              <Link to={`/staff/reservations/${row.id}`} className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">Settle & leave</Link>
            </Card>
          ))}
          {!data.departures.length && <Empty>No departures today.</Empty>}
        </Column>
      </div>
    </div>
  );
}

function Column({ title, children }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
function Card({ row, meta, children }) {
  return (
    <article className="rounded-xl bg-paper p-3 text-sm">
      <p className="font-semibold">{row.first_name} {row.last_name}</p>
      <p className="text-xs text-mist">{row.booking_ref} · {STATUS_LABEL[row.status]}</p>
      <p className="mt-1 text-xs">{meta}</p>
      <div className="mt-2 flex items-center gap-3">{children}</div>
    </article>
  );
}
function Empty({ children }) {
  return <p className="text-sm text-mist">{children}</p>;
}
