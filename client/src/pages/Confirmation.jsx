import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { errorText, formatDate, money, STATUS_LABEL } from '../lib/format';

export default function Confirmation() {
  const { ref } = useParams();
  const [params] = useSearchParams();
  const finding = ref === 'find';
  const [email, setEmail] = useState(params.get('email') || sessionStorage.getItem('fp-booking-email') || '');
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');

  async function load(event) {
    event?.preventDefault();
    if (!email || finding && !params.get('ref') && !event) return;
    const code = finding ? (event?.target?.ref?.value || params.get('ref')) : ref;
    if (!code) return;
    setError('');
    try {
      const res = await publicApi.booking(code, email);
      setBooking(res.data.data);
      sessionStorage.setItem('fp-booking-email', email);
    } catch (err) {
      setBooking(null);
      setError(errorText(err, 'Booking not found.'));
    }
  }

  useEffect(() => {
    if (!finding && email) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  async function cancel() {
    if (!booking) return;
    setError('');
    try {
      await publicApi.cancel(booking.booking_ref, { email, reason });
      await load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div className="px-5 py-8 md:px-12 md:py-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mist">{finding ? 'Find a booking' : 'Confirmation'}</p>
      <h1 className="display mt-2 text-5xl">{finding ? 'Look up a stay.' : 'The desk has your request.'}</h1>

      <form onSubmit={load} className="mt-6 flex max-w-xl flex-col gap-3 sm:flex-row">
        {finding && <input name="ref" required placeholder="Reference, FP-…" defaultValue={params.get('ref') || ''} className="flex-1 rounded-xl border border-line px-3 py-3 text-sm uppercase" />}
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email on the booking" className="flex-1 rounded-xl border border-line px-3 py-3 text-sm" />
        <button className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">Show</button>
      </form>
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      {booking && (
        <article className="mt-8 max-w-3xl rounded-[28px] border border-line p-6 md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-mist">{STATUS_LABEL[booking.status] || booking.status}</p>
              <h2 className="display mt-1 text-4xl">{booking.booking_ref}</h2>
            </div>
            <p className="text-right text-sm">{booking.guest_name}<span className="block text-mist">{booking.email}</span></p>
          </div>
          <p className="mt-4 text-sm">{formatDate(booking.check_in)} – {formatDate(booking.check_out)} · {booking.adults} adults{booking.children ? `, ${booking.children} children` : ''}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {booking.rooms.map((room, index) => (
              <li key={index} className="flex justify-between gap-3 border-b border-line py-2">
                <span>{room.type_name}{room.room_number ? ` · ${room.room_number}` : ''}<span className="block text-xs text-mist">{room.nights} nights · {money(room.rate_per_night)} / night</span></span>
                <span>{money(room.line_total)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><dt>Rooms</dt><dd>{money(booking.subtotal)}</dd></div>
            {Number(booking.discount) > 0 && <div className="flex justify-between"><dt>Discount {booking.promo_code}</dt><dd>− {money(booking.discount)}</dd></div>}
            <div className="flex justify-between"><dt>Service</dt><dd>{money(booking.service_charge)}</dd></div>
            <div className="flex justify-between"><dt>VAT</dt><dd>{money(booking.vat)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{money(booking.total_amount)}</dd></div>
            <div className="flex justify-between"><dt>Paid</dt><dd>{money(booking.paid_amount)}</dd></div>
            <div className="flex justify-between"><dt>Balance</dt><dd>{money(booking.balance)}</dd></div>
          </dl>
          <p className="mt-4 text-sm leading-6 text-mist">{booking.cancellation_policy}</p>
          {booking.payment_preference === 'pay_now' && booking.status === 'pending' && (
            <p className="mt-3 text-sm">This stay is waiting on a transfer. The desk will send Telebirr or bank details to {booking.email}.</p>
          )}
          {booking.payment_preference === 'request' && booking.status === 'pending' && (
            <p className="mt-3 text-sm">The desk will call before this stay is confirmed.</p>
          )}
          {['pending', 'confirmed'].includes(booking.status) && (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, if you need to cancel" className="flex-1 rounded-xl border border-line px-3 py-2 text-sm" />
              <button type="button" onClick={cancel} className="rounded-full border border-line px-4 py-2 text-sm font-semibold">Cancel booking</button>
            </div>
          )}
        </article>
      )}
      <Link to="/book" className="mt-6 inline-block text-sm font-semibold underline underline-offset-4">Make another request</Link>
    </div>
  );
}
