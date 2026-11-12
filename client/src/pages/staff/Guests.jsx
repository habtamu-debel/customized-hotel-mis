import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { guestApi } from '../../lib/api';
import { errorText, formatDate, money, STATUS_LABEL } from '../../lib/format';

export default function Guests() {
  const { id } = useParams();
  return id ? <GuestDetail id={id} /> : <GuestList />;
}

function GuestList() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  function load() { guestApi.list(q).then((res) => setRows(res.data.data)); }
  useEffect(load, []);
  return (
    <div>
      <h1 className="display text-4xl">Guests</h1>
      <div className="mt-4 flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Name, phone, email, company" className="w-full max-w-md rounded-xl border border-line bg-white px-3 py-2 text-sm" />
        <button onClick={load} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Search</button>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
        {rows.map((guest) => (
          <Link key={guest.id} to={`/staff/guests/${guest.id}`} className="flex items-center justify-between border-b border-line px-4 py-3 text-sm last:border-0">
            <span>
              <span className="font-semibold">{guest.first_name} {guest.last_name}</span>
              {guest.is_vip ? <em className="ml-2 text-xs not-italic text-amber-700">VIP</em> : null}
              {guest.is_blacklisted ? <em className="ml-2 text-xs not-italic text-rose-700">Blocked</em> : null}
              <span className="block text-mist">{guest.email} · {guest.phone}</span>
            </span>
            <span className="text-mist">{guest.nationality}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function GuestDetail({ id }) {
  const navigate = useNavigate();
  const [guest, setGuest] = useState(null);
  const [form, setForm] = useState(null);

  useEffect(() => {
    guestApi.get(id).then((res) => {
      setGuest(res.data.data);
      setForm(res.data.data);
    });
  }, [id]);

  async function save(event) {
    event.preventDefault();
    try {
      await guestApi.update(id, {
        ...form,
        is_vip: Boolean(form.is_vip),
        is_blacklisted: Boolean(form.is_blacklisted),
      });
      toast.success('Guest updated');
      const res = await guestApi.get(id);
      setGuest(res.data.data);
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  if (!guest || !form) return <p className="text-mist">Loading guest…</p>;
  return (
    <div>
      <button onClick={() => navigate('/staff/guests')} className="text-xs font-semibold uppercase tracking-[0.14em] text-mist">All guests</button>
      <h1 className="display mt-2 text-4xl">{guest.first_name} {guest.last_name}</h1>
      <p className="text-sm text-mist">Lifetime room revenue {money(guest.spend)}</p>
      <form onSubmit={save} className="mt-4 grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-2">
        {['first_name', 'last_name', 'email', 'phone', 'nationality', 'id_type', 'id_number', 'company_name'].map((key) => (
          <label key={key} className="text-xs font-semibold capitalize text-mist">{key.replace('_', ' ')}
            <input value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink" />
          </label>
        ))}
        <label className="text-xs font-semibold text-mist md:col-span-2">Notes
          <textarea value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink" />
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.is_vip)} onChange={(e) => setForm({ ...form, is_vip: e.target.checked })} /> VIP</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(form.is_blacklisted)} onChange={(e) => setForm({ ...form, is_blacklisted: e.target.checked })} /> Block new bookings</label>
        {form.is_blacklisted ? (
          <input value={form.blacklist_reason || ''} onChange={(e) => setForm({ ...form, blacklist_reason: e.target.value })} placeholder="Reason" className="rounded-xl border border-line px-3 py-2 text-sm md:col-span-2" />
        ) : null}
        <button className="w-fit rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Save guest</button>
      </form>
      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Stays</h2>
        {guest.stays.map((stay) => (
          <Link key={stay.id} to={`/staff/reservations/${stay.id}`} className="mt-2 flex justify-between border-b border-line py-2 text-sm">
            <span>{stay.booking_ref} · {formatDate(stay.check_in)} – {formatDate(stay.check_out)}</span>
            <span>{STATUS_LABEL[stay.status]} · {money(stay.total_amount)}</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
