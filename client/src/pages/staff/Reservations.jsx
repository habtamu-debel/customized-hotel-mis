import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { roomApi, stayApi } from '../../lib/api';
import { addDays, errorText, formatDate, money, STATUS_LABEL, todayISO } from '../../lib/format';

const empty = {
  check_in: todayISO(),
  check_out: addDays(todayISO(), 1),
  adults: 1,
  children: 0,
  room_type_id: '',
  quantity: 1,
  source: 'walk_in',
  payment_preference: 'pay_at_hotel',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  nationality: '',
  special_requests: '',
};

export default function Reservations() {
  const [params] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState(params.get('status') || '');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [types, setTypes] = useState([]);

  function load() {
    stayApi.list({ q, status }).then((res) => setRows(res.data.data));
  }
  useEffect(load, [status]);
  useEffect(() => {
    roomApi.types().then((res) => {
      setTypes(res.data.data);
      setForm((current) => ({ ...current, room_type_id: current.room_type_id || res.data.data[0]?.id || '' }));
    });
  }, []);

  async function create(event) {
    event.preventDefault();
    try {
      const res = await stayApi.create({
        check_in: form.check_in,
        check_out: form.check_out,
        adults: Number(form.adults),
        children: Number(form.children),
        rooms: [{ room_type_id: Number(form.room_type_id), quantity: Number(form.quantity) }],
        source: form.source,
        payment_preference: form.payment_preference,
        special_requests: form.special_requests,
        guest: {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone,
          nationality: form.nationality,
        },
      });
      toast.success(res.data.data.booking_ref);
      setOpen(false);
      load();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-4xl">Bookings</h1>
          <p className="text-sm text-mist">Search by name, phone, reference, or room number.</p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">New booking</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Search" className="rounded-xl border border-line bg-white px-3 py-2 text-sm" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <button onClick={load} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold">Search</button>
      </div>

      {open && (
        <form onSubmit={create} className="mt-4 grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-4">
          <Field label="Check-in"><input type="date" required value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} className="field" /></Field>
          <Field label="Check-out"><input type="date" required value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} className="field" /></Field>
          <Field label="Adults"><input type="number" min="1" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} className="field" /></Field>
          <Field label="Children"><input type="number" min="0" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} className="field" /></Field>
          <Field label="Room">
            <select value={form.room_type_id} onChange={(e) => setForm({ ...form, room_type_id: e.target.value })} className="field">
              {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </Field>
          <Field label="Qty"><input type="number" min="1" max="5" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="field" /></Field>
          <Field label="Source">
            <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="field">
              {['walk_in', 'phone', 'website', 'agent', 'ota'].map((source) => <option key={source} value={source}>{source.replace('_', ' ')}</option>)}
            </select>
          </Field>
          <Field label="Payment">
            <select value={form.payment_preference} onChange={(e) => setForm({ ...form, payment_preference: e.target.value })} className="field">
              <option value="pay_at_hotel">Pay at hotel</option>
              <option value="pay_now">Transfer</option>
              <option value="request">Request</option>
            </select>
          </Field>
          <Field label="First name"><input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="field" /></Field>
          <Field label="Last name"><input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="field" /></Field>
          <Field label="Email"><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="field" /></Field>
          <Field label="Phone"><input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="field" /></Field>
          <Field label="Note" wide><input value={form.special_requests} onChange={(e) => setForm({ ...form, special_requests: e.target.value })} className="field" /></Field>
          <div className="md:col-span-4"><button className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Save booking</button></div>
        </form>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-mist">
            <tr>
              {['Guest', 'Reference', 'Stay', 'Status', 'Source', 'Total', 'Paid'].map((head) => <th key={head} className="px-4 py-3 font-semibold">{head}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-3 font-semibold"><Link to={`/staff/reservations/${row.id}`}>{row.first_name} {row.last_name}</Link>{row.is_vip ? <span className="ml-2 text-[10px] uppercase text-amber-700">VIP</span> : null}</td>
                <td className="px-4 py-3">{row.booking_ref}</td>
                <td className="px-4 py-3">{formatDate(row.check_in)} – {formatDate(row.check_out)}</td>
                <td className="px-4 py-3">{STATUS_LABEL[row.status]}</td>
                <td className="px-4 py-3 capitalize">{row.source.replace('_', ' ')}</td>
                <td className="px-4 py-3">{money(row.total_amount)}</td>
                <td className="px-4 py-3">{money(row.paid_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="px-4 py-6 text-sm text-mist">Nothing matched.</p>}
      </div>
      <style>{`.field{margin-top:4px;width:100%;border-radius:12px;border:1px solid #e6edf5;padding:8px 10px;font-size:14px;}`}</style>
    </div>
  );
}

function Field({ label, children, wide }) {
  return <label className={`text-xs font-semibold text-mist ${wide ? 'md:col-span-2' : ''}`}>{label}{children}</label>;
}
