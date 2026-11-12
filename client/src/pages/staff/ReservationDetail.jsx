import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { roomApi, stayApi } from '../../lib/api';
import { errorText, formatDate, money, STATUS_LABEL } from '../../lib/format';
import { useAuthStore } from '../../store/authStore';

export default function ReservationDetail() {
  const { id } = useParams();
  const role = useAuthStore((state) => state.user?.role);
  const [stay, setStay] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [pay, setPay] = useState({ amount: '', method: 'cash', reference: '' });
  const [charge, setCharge] = useState({ description: '', amount: '', item_type: 'restaurant', quantity: 1 });
  const [dates, setDates] = useState({ check_in: '', check_out: '' });
  const [reason, setReason] = useState('');

  function load() {
    stayApi.get(id).then((res) => {
      setStay(res.data.data);
      setDates({ check_in: res.data.data.check_in, check_out: res.data.data.check_out });
    });
  }
  useEffect(load, [id]);
  useEffect(() => { roomApi.list().then((res) => setRooms(res.data.data)); }, []);

  async function run(action, success) {
    try {
      const res = await action();
      setStay(res.data.data);
      toast.success(success);
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  if (!stay) return <p className="text-mist">Opening the booking…</p>;
  const open = ['pending', 'confirmed', 'checked_in'].includes(stay.status);

  return (
    <div>
      <Link to="/staff/reservations" className="no-print text-xs font-semibold uppercase tracking-[0.14em] text-mist">All bookings</Link>
      <div className="no-print mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mist">{STATUS_LABEL[stay.status]}</p>
          <h1 className="display text-4xl">{stay.booking_ref}</h1>
          <p className="text-sm">{stay.first_name} {stay.last_name} · {stay.phone} · {stay.email}</p>
        </div>
        <button onClick={() => window.print()} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold">Print invoice</button>
      </div>

      <div className="no-print mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-4">
          <article className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm">{formatDate(stay.check_in)} – {formatDate(stay.check_out)} · {stay.adults} adults, {stay.children} children</p>
            <p className="mt-1 text-sm capitalize text-mist">{stay.source.replace('_', ' ')} · {stay.payment_preference.replaceAll('_', ' ')}{stay.is_vip ? ' · VIP' : ''}</p>
            {stay.special_requests && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm">{stay.special_requests}</p>}
            <div className="mt-4 space-y-3">
              {stay.rooms.map((line) => {
                const choices = rooms.filter((room) => (
                  Number(room.room_type_id) === Number(line.room_type_id)
                  && (room.id === line.room_id || !['occupied', 'out_of_order', 'maintenance'].includes(room.status))
                ));
                return (
                  <div key={line.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-3 py-2 text-sm">
                    <div>
                      <p className="font-semibold">{line.type_name} {line.room_number ? `· ${line.room_number}` : ''}</p>
                      <p className="text-xs text-mist">{money(line.rate_per_night)} / night · {line.nights} nights · {money(line.line_total)}</p>
                    </div>
                    {open && (
                      <select
                        value={line.room_id || ''}
                        onChange={(e) => run(() => stayApi.assign(stay.id, line.id, { room_id: Number(e.target.value) }), 'Room assigned')}
                        className="rounded-xl border border-line bg-white px-2 py-1 text-sm"
                      >
                        <option value="" disabled>Assign room</option>
                        {choices.map((room) => <option key={room.id} value={room.id}>{room.room_number} · {ROOM(room.status)}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </article>

          <article className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="font-semibold">Folio</h2>
            <Row label="Rooms" value={money(stay.subtotal)} />
            {Number(stay.discount) > 0 && <Row label={`Discount ${stay.promo_code || ''}`} value={`− ${money(stay.discount)}`} />}
            <Row label="Service charge" value={money(stay.service_charge)} />
            <Row label="VAT" value={money(stay.vat)} />
            {stay.folio.map((item) => (
              <Row key={item.id} label={`${item.description} × ${item.quantity}`} value={money(Number(item.amount) * Number(item.quantity))} />
            ))}
            <Row label="Total" value={money(stay.grand_total)} strong />
            <Row label="Paid" value={money(stay.paid_amount)} />
            <Row label="Balance" value={money(stay.balance)} strong />
            <div className="mt-3 space-y-1 text-xs text-mist">
              {stay.payments.map((payment) => (
                <p key={payment.id}>{money(payment.amount)} · {payment.method.replace('_', ' ')} {payment.reference || ''}</p>
              ))}
            </div>
          </article>

          {open && (
            <div className="grid gap-4 md:grid-cols-2">
              <form className="rounded-2xl bg-white p-4 shadow-sm" onSubmit={(e) => { e.preventDefault(); run(() => stayApi.pay(stay.id, { ...pay, amount: Number(pay.amount) }), 'Payment recorded'); }}>
                <h2 className="font-semibold">Take payment</h2>
                <input required type="number" min="1" step="0.01" placeholder="Amount" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} className="field" />
                <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} className="field">
                  {['cash', 'card', 'telebirr', 'bank_transfer', 'city_ledger'].map((method) => <option key={method} value={method}>{method.replace('_', ' ')}</option>)}
                </select>
                <input placeholder="Reference" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} className="field" />
                <button className="mt-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Record</button>
              </form>
              <form className="rounded-2xl bg-white p-4 shadow-sm" onSubmit={(e) => { e.preventDefault(); run(() => stayApi.charge(stay.id, { ...charge, amount: Number(charge.amount), quantity: Number(charge.quantity) }), 'Charge posted'); }}>
                <h2 className="font-semibold">Post a charge</h2>
                <input required placeholder="Description" value={charge.description} onChange={(e) => setCharge({ ...charge, description: e.target.value })} className="field" />
                <input required type="number" step="0.01" placeholder="Amount" value={charge.amount} onChange={(e) => setCharge({ ...charge, amount: e.target.value })} className="field" />
                <select value={charge.item_type} onChange={(e) => setCharge({ ...charge, item_type: e.target.value })} className="field">
                  {['restaurant', 'minibar', 'laundry', 'service', 'fee', 'discount', 'other'].map((type) => <option key={type}>{type}</option>)}
                </select>
                <button className="mt-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">Post</button>
              </form>
            </div>
          )}
        </section>

        <aside className="space-y-3">
          {stay.status === 'pending' && <Action onClick={() => run(() => stayApi.confirm(stay.id), 'Confirmed')}>Confirm booking</Action>}
          {['pending', 'confirmed'].includes(stay.status) && <Action onClick={() => run(() => stayApi.checkIn(stay.id), 'Checked in')}>Check in to a clean room</Action>}
          {stay.status === 'checked_in' && <Action onClick={() => run(() => stayApi.checkOut(stay.id), 'Checked out')}>Check out</Action>}
          {stay.status === 'checked_in' && ['owner', 'manager'].includes(role) && (
            <Action onClick={() => run(() => stayApi.checkOut(stay.id, { force: true }), 'Checked out with balance')}>Check out with balance open</Action>
          )}
          {['pending', 'confirmed'].includes(stay.status) && <Action onClick={() => run(() => stayApi.noShow(stay.id), 'Marked no-show')}>Mark no-show</Action>}
          {open && (
            <form className="rounded-2xl bg-white p-4 shadow-sm" onSubmit={(e) => { e.preventDefault(); run(() => stayApi.dates(stay.id, dates), 'Dates updated'); }}>
              <h2 className="text-sm font-semibold">Change dates</h2>
              <input type="date" value={dates.check_in} onChange={(e) => setDates({ ...dates, check_in: e.target.value })} className="field" />
              <input type="date" value={dates.check_out} onChange={(e) => setDates({ ...dates, check_out: e.target.value })} className="field" />
              <button className="mt-2 rounded-full border border-line px-4 py-2 text-sm font-semibold">Recalculate</button>
            </form>
          )}
          {open && (
            <form className="rounded-2xl bg-white p-4 shadow-sm" onSubmit={(e) => { e.preventDefault(); run(() => stayApi.cancel(stay.id, { reason }), 'Cancelled'); }}>
              <h2 className="text-sm font-semibold">Cancel</h2>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="field" />
              <button className="mt-2 rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-800">Cancel booking</button>
            </form>
          )}
          <article className="rounded-2xl bg-white p-4 text-xs leading-5 text-mist shadow-sm">
            {stay.logs.map((log) => (
              <p key={log.id}>{log.created_at?.replace('T', ' ').slice(0, 16)} · {log.note || log.new_status} {log.user_name ? `· ${log.user_name}` : ''}</p>
            ))}
          </article>
        </aside>
      </div>

      <Invoice stay={stay} />
      <style>{`.field{margin-top:8px;width:100%;border-radius:12px;border:1px solid #e6edf5;padding:8px 10px;font-size:14px;background:white}`}</style>
    </div>
  );
}

function ROOM(status) {
  return status.replaceAll('_', ' ');
}
function Row({ label, value, strong }) {
  return <div className={`flex justify-between gap-3 py-1 text-sm ${strong ? 'font-semibold' : ''}`}><span>{label}</span><span>{value}</span></div>;
}
function Action({ children, onClick }) {
  return <button onClick={onClick} className="w-full rounded-2xl bg-ink px-4 py-3 text-left text-sm font-semibold text-white">{children}</button>;
}

function Invoice({ stay }) {
  return (
    <section className="print-sheet mx-auto max-w-3xl bg-white p-8 text-sm">
      <p className="text-xs tracking-[0.2em]">FIDEL PALACE</p>
      <h2 className="mt-1 text-2xl">Guest invoice · {stay.booking_ref}</h2>
      <p className="mt-1">Cameroon Street, Bole, Addis Ababa · TIN 0019876543</p>
      <p className="mt-4">{stay.first_name} {stay.last_name}<br />{stay.email}<br />{formatDate(stay.check_in)} – {formatDate(stay.check_out)}</p>
      <table className="mt-4 w-full">
        <tbody>
          {stay.rooms.map((line) => (
            <tr key={line.id}><td className="py-1">{line.type_name} {line.room_number || ''} · {line.nights} nights</td><td className="py-1 text-right">{money(line.line_total)}</td></tr>
          ))}
          <tr><td>Service charge</td><td className="text-right">{money(stay.service_charge)}</td></tr>
          <tr><td>VAT</td><td className="text-right">{money(stay.vat)}</td></tr>
          {Number(stay.discount) > 0 && <tr><td>Discount</td><td className="text-right">− {money(stay.discount)}</td></tr>}
          {stay.folio.map((item) => (
            <tr key={item.id}><td>{item.description}</td><td className="text-right">{money(Number(item.amount) * item.quantity)}</td></tr>
          ))}
          <tr><td className="pt-2 font-semibold">Total</td><td className="pt-2 text-right font-semibold">{money(stay.grand_total)}</td></tr>
          <tr><td>Paid</td><td className="text-right">{money(stay.paid_amount)}</td></tr>
          <tr><td>Balance</td><td className="text-right">{money(stay.balance)}</td></tr>
        </tbody>
      </table>
    </section>
  );
}
