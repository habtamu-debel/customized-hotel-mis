import { useState } from 'react';
import { publicApi } from '../lib/api';
import { errorText } from '../lib/format';

const empty = { name: '', email: '', phone: '', topic: 'Stay', body: '' };

export default function Contact() {
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSending(true);
    setError('');
    setMessage('');
    try {
      const res = await publicApi.message(form);
      setMessage(res.data.message);
      setForm(empty);
    } catch (err) {
      setError(errorText(err, 'The message did not send.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-10 px-5 py-8 md:grid-cols-2 md:px-12 md:py-12">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mist">Contact</p>
        <h1 className="display mt-2 text-5xl">Write to the desk.</h1>
        <p className="mt-4 text-sm leading-7 text-mist">For a room, the booking page is faster and shows a real price. Use this note for a celebration, a long stay, or a question the form does not ask.</p>
        <p className="mt-6 text-sm leading-7">
          +251 11 667 2400<br />
          stay@fidelpalace.com<br />
          Cameroon Street, Bole
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3 rounded-[28px] bg-paper p-5 md:p-7">
        <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm outline-none" />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm outline-none" />
        <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm outline-none" />
        <select value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm outline-none">
          {['Stay', 'Celebration', 'Long stay', 'Airport car', 'Other'].map((topic) => <option key={topic}>{topic}</option>)}
        </select>
        <textarea required minLength={5} rows={5} placeholder="How can the house help?" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="w-full rounded-xl border border-line bg-white px-3 py-3 text-sm outline-none" />
        {error && <p className="text-sm text-red-700">{error}</p>}
        {message && <p className="text-sm text-emerald-800">{message}</p>}
        <button disabled={sending} className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {sending ? 'Sending…' : 'Send the note'}
        </button>
      </form>
    </div>
  );
}
