import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { roomApi } from '../../lib/api';
import { errorText, formatDate, money } from '../../lib/format';

export default function Rates() {
  const [types, setTypes] = useState([]);
  const [rates, setRates] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [form, setForm] = useState({ room_type_id: '', name: '', start_date: '', end_date: '', price: '', min_stay: 1 });

  function load() {
    roomApi.types().then((res) => {
      setTypes(res.data.data);
      setDrafts(Object.fromEntries(res.data.data.map((type) => [type.id, type.base_rate])));
      setForm((current) => ({ ...current, room_type_id: current.room_type_id || res.data.data[0]?.id || '' }));
    });
    roomApi.rates().then((res) => setRates(res.data.data.filter((rate) => rate.is_active)));
  }
  useEffect(load, []);

  async function saveBase(type) {
    try {
      await roomApi.updateType(type.id, { base_rate: Number(drafts[type.id]) });
      toast.success(`${type.name} rate saved`);
      load();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  async function add(event) {
    event.preventDefault();
    try {
      await roomApi.createRate({ ...form, price: Number(form.price), min_stay: Number(form.min_stay), room_type_id: Number(form.room_type_id) });
      toast.success('Season saved');
      setForm({ ...form, name: '', price: '' });
      load();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <div>
      <h1 className="display text-4xl">Rates</h1>
      <p className="mt-1 max-w-2xl text-sm text-mist">The base rate is the midweek price. Saturday and Sunday add the weekend uplift from hotel settings, unless a season below covers that night. Prices already confirmed on a booking stay as they were.</p>
      <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
        {types.map((type) => (
          <div key={type.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 text-sm">
            <div>
              <p className="font-semibold">{type.name}</p>
              <p className="text-xs text-mist">Extra adult {money(type.extra_adult_rate)} · extra child {money(type.extra_child_rate)}</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="number" value={drafts[type.id] ?? ''} onChange={(e) => setDrafts({ ...drafts, [type.id]: e.target.value })} className="w-32 rounded-xl border border-line px-3 py-2" />
              <button onClick={() => saveBase(type)} className="rounded-full bg-ink px-3 py-2 text-xs font-semibold text-white">Save</button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="mt-4 grid gap-2 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-3">
        <select value={form.room_type_id} onChange={(e) => setForm({ ...form, room_type_id: e.target.value })} className="rounded-xl border border-line px-3 py-2 text-sm">
          {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
        <input required placeholder="Season name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-line px-3 py-2 text-sm" />
        <input required type="number" placeholder="Nightly price" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-xl border border-line px-3 py-2 text-sm" />
        <input required type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="rounded-xl border border-line px-3 py-2 text-sm" />
        <input required type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="rounded-xl border border-line px-3 py-2 text-sm" />
        <input type="number" min="1" value={form.min_stay} onChange={(e) => setForm({ ...form, min_stay: e.target.value })} className="rounded-xl border border-line px-3 py-2 text-sm" />
        <button className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white md:col-span-3 md:w-fit">Add season</button>
      </form>

      <div className="mt-4 space-y-2">
        {rates.map((rate) => (
          <article key={rate.id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
            <div>
              <p className="font-semibold">{rate.name} · {rate.type_name}</p>
              <p className="text-mist">{formatDate(rate.start_date)} – {formatDate(rate.end_date)} · min {rate.min_stay} night{rate.min_stay > 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold">{money(rate.price)}</span>
              <button onClick={async () => { await roomApi.removeRate(rate.id); load(); }} className="text-xs font-semibold text-rose-700">Retire</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
