import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { settingsApi } from '../../lib/api';
import { errorText } from '../../lib/format';

const fields = [
  ['hotel_name', 'Hotel name'],
  ['tagline', 'Tagline'],
  ['address', 'Address'],
  ['city', 'City'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['tin', 'TIN'],
  ['check_in_time', 'Check-in time'],
  ['check_out_time', 'Check-out time'],
  ['currency', 'Currency'],
  ['vat_rate', 'VAT %'],
  ['service_charge_rate', 'Service charge %'],
  ['weekend_percent', 'Weekend uplift %'],
  ['cancel_hours', 'Free cancellation, hours before arrival'],
];

export default function Settings() {
  const [form, setForm] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    settingsApi.get().then((res) => setForm(res.data.data));
    settingsApi.messages().then((res) => setMessages(res.data.data)).catch(() => {});
  }, []);

  async function save(event) {
    event.preventDefault();
    try {
      const res = await settingsApi.update(form);
      setForm(res.data.data);
      toast.success('Hotel settings saved');
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  if (!form) return <p className="text-mist">Loading settings…</p>;
  return (
    <div>
      <h1 className="display text-4xl">The hotel</h1>
      <form onSubmit={save} className="mt-4 grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-2">
        {fields.map(([key, label]) => (
          <label key={key} className="text-xs font-semibold text-mist">{label}
            <input value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink" />
          </label>
        ))}
        <label className="text-xs font-semibold text-mist md:col-span-2">Short description
          <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink" />
        </label>
        <label className="text-xs font-semibold text-mist md:col-span-2">Cancellation policy
          <textarea value={form.cancellation_policy || ''} onChange={(e) => setForm({ ...form, cancellation_policy: e.target.value })} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink" />
        </label>
        <button className="w-fit rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Save</button>
      </form>
      <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">Website messages</h2>
        <div className="mt-3 space-y-3">
          {messages.map((note) => (
            <article key={note.id} className="rounded-xl bg-paper p-3 text-sm">
              <p className="font-semibold">{note.name} · {note.topic} {!note.is_read && <span className="text-xs text-amber-700">New</span>}</p>
              <p className="text-mist">{note.email} {note.phone}</p>
              <p className="mt-1">{note.body}</p>
              {!note.is_read && <button onClick={async () => { await settingsApi.read(note.id); setMessages(messages.map((item) => item.id === note.id ? { ...item, is_read: 1 } : item)); }} className="mt-2 text-xs font-semibold underline">Mark read</button>}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
