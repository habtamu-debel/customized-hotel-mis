import { useEffect, useState } from 'react';
import { reportApi } from '../../lib/api';
import { addDays, money, todayISO } from '../../lib/format';

export default function Reports() {
  const [from, setFrom] = useState(addDays(todayISO(), -29));
  const [to, setTo] = useState(addDays(todayISO(), 1));
  const [data, setData] = useState(null);

  function load() {
    reportApi.overview({ from, to }).then((res) => setData(res.data.data));
  }
  useEffect(load, []);

  if (!data) return <p className="text-mist">Preparing the figures…</p>;
  const maxSold = Math.max(1, ...data.occupancy.by_day.map((day) => day.sold));

  return (
    <div>
      <h1 className="display text-4xl">Reports</h1>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-xs font-semibold text-mist">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink" /></label>
        <label className="text-xs font-semibold text-mist">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink" /></label>
        <button onClick={load} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Update</button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {[
          ['Occupancy', `${data.occupancy.percent}%`],
          ['Room revenue', money(data.revenue.room)],
          ['ADR', money(data.revenue.adr)],
          ['RevPAR', money(data.revenue.revpar)],
        ].map(([label, value]) => (
          <article key={label} className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-mist">{label}</p>
            <p className="mt-1 text-xl font-semibold">{value}</p>
          </article>
        ))}
      </div>
      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Rooms sold by night</h2>
        <div className="mt-4 flex items-end gap-1 overflow-x-auto">
          {data.occupancy.by_day.map((day) => (
            <div key={day.date} className="w-6 shrink-0 text-center" title={`${day.date}: ${day.sold}`}>
              <div className="mx-auto w-3 rounded-t bg-ink" style={{ height: `${8 + (day.sold / maxSold) * 90}px` }} />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-mist">{data.occupancy.room_nights_sold} room nights sold of {data.occupancy.room_nights_available} available. Other revenue {money(data.revenue.extras)}. Cancellations {data.cancellations}. No-shows {data.no_shows}.</p>
      </section>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Breakdown title="Payments" rows={data.payments.map((row) => [row.method.replace('_', ' '), money(row.amount)])} />
        <Breakdown title="Source" rows={data.sources.map((row) => [row.label.replace('_', ' '), row.count])} />
        <Breakdown title="Nationality" rows={data.nationalities.map((row) => [row.label, row.count])} />
      </div>
      <section className="mt-4 rounded-2xl bg-white p-4 text-sm shadow-sm">
        <h2 className="font-semibold">Housekeeping now</h2>
        <p className="mt-2 text-mist">{data.housekeeping.map((row) => `${row.status.replaceAll('_', ' ')} ${row.count}`).join(' · ')}</p>
      </section>
    </div>
  );
}

function Breakdown({ title, rows }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-2 space-y-1 text-sm">
        {rows.map(([label, value]) => <div key={label} className="flex justify-between capitalize"><span>{label}</span><span>{value}</span></div>)}
        {!rows.length && <p className="text-mist">Nothing in this period.</p>}
      </div>
    </section>
  );
}
