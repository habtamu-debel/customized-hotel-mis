import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { addDays, errorText, money, nights, todayISO } from '../lib/format';

const emptyGuest = {
  first_name: '', last_name: '', email: '', phone: '', nationality: '', id_type: '', id_number: '',
};

export default function Book() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [stay, setStay] = useState({
    check_in: params.get('checkIn') || addDays(todayISO(), 1),
    check_out: params.get('checkOut') || addDays(todayISO(), 3),
    adults: Number(params.get('adults') || 2),
    children: Number(params.get('children') || 0),
  });
  const [results, setResults] = useState([]);
  const [qty, setQty] = useState({});
  const [quote, setQuote] = useState(null);
  const [guest, setGuest] = useState(emptyGuest);
  const [promo, setPromo] = useState(params.get('promo') || '');
  const [requests, setRequests] = useState('');
  const [pay, setPay] = useState('pay_at_hotel');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const preferred = params.get('type') || '';

  const selected = useMemo(
    () => results.filter((room) => (qty[room.id] || 0) > 0).map((room) => ({ room_type_id: room.id, quantity: qty[room.id] })),
    [results, qty]
  );

  async function search(event) {
    event?.preventDefault();
    setError('');
    setQuote(null);
    if (nights(stay.check_in, stay.check_out) < 1) {
      setError('Check-out has to be after check-in.');
      return;
    }
    setLoading(true);
    try {
      const res = await publicApi.availability(stay);
      setResults(res.data.data);
      const initial = {};
      if (preferred) {
        const match = res.data.data.find((room) => room.slug === preferred && room.available > 0);
        if (match) initial[match.id] = 1;
      }
      setQty(initial);
      setStep(2);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (params.get('checkIn')) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected.length || step < 2) {
      setQuote(null);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await publicApi.quote({ ...stay, rooms: selected, promo_code: promo });
        setQuote(res.data.data);
        setError('');
      } catch (err) {
        setQuote(null);
        setError(errorText(err));
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [selected, stay, promo, step]);

  async function confirm(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await publicApi.book({
        ...stay,
        rooms: selected,
        promo_code: promo,
        payment_preference: pay,
        special_requests: requests,
        guest,
      });
      const booking = res.data.data;
      sessionStorage.setItem('fp-booking-email', booking.email);
      navigate(`/booking/${booking.booking_ref}`);
    } catch (err) {
      setError(errorText(err, 'The room could not be held.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-5 py-8 md:px-12 md:py-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mist">Booking</p>
      <h1 className="display mt-2 text-5xl">Request a room.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-mist">The price includes the weekend uplift when it applies, then service charge and VAT. A room is only taken off the board when this request is accepted.</p>

      <form onSubmit={search} className="mt-8 grid gap-3 rounded-[24px] border border-line p-4 md:grid-cols-5">
        <label className="text-xs font-semibold text-mist">Check-in
          <input type="date" value={stay.check_in} onChange={(e) => setStay({ ...stay, check_in: e.target.value })} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink" />
        </label>
        <label className="text-xs font-semibold text-mist">Check-out
          <input type="date" value={stay.check_out} onChange={(e) => setStay({ ...stay, check_out: e.target.value })} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink" />
        </label>
        <label className="text-xs font-semibold text-mist">Adults
          <input type="number" min="1" max="12" value={stay.adults} onChange={(e) => setStay({ ...stay, adults: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink" />
        </label>
        <label className="text-xs font-semibold text-mist">Children
          <input type="number" min="0" max="8" value={stay.children} onChange={(e) => setStay({ ...stay, children: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink" />
        </label>
        <button className="self-end rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white" disabled={loading}>
          {loading && step === 1 ? 'Looking…' : 'Show rooms'}
        </button>
      </form>

      {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      {step >= 2 && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-4">
            {results.map((room) => {
              const count = qty[room.id] || 0;
              const closed = room.available < 1;
              return (
                <article key={room.id} className={`grid gap-4 rounded-[24px] border border-line p-3 md:grid-cols-[180px_1fr] ${closed ? 'opacity-60' : ''}`}>
                  <img src={room.photos[0]} alt="" className="h-36 w-full rounded-2xl object-cover" />
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">{room.name}</h2>
                        <p className="text-sm text-mist">{room.tagline}</p>
                      </div>
                      <p className="text-right text-sm font-semibold">
                        {room.sample ? money(room.sample.total) : money(room.base_rate)}
                        <span className="block text-[11px] font-medium text-mist">{room.sample ? `total · ${room.sample.nights} nights` : 'per night'}</span>
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-mist">
                      {closed ? 'Sold for these dates' : `${room.available} open`}
                      {room.fits ? '' : ' · this party needs more than one of these, or a larger style'}
                      {room.sample ? ` · ${money(room.sample.nightly)} a night before tax` : ''}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <button type="button" disabled={count === 0} onClick={() => setQty({ ...qty, [room.id]: count - 1 })} className="h-8 w-8 rounded-full border border-line">–</button>
                      <span className="w-6 text-center text-sm font-semibold">{count}</span>
                      <button type="button" disabled={closed || count >= room.available} onClick={() => setQty({ ...qty, [room.id]: count + 1 })} className="h-8 w-8 rounded-full border border-line">+</button>
                    </div>
                  </div>
                </article>
              );
            })}
            {!results.length && <p className="text-sm text-mist">{loading ? 'Looking up rooms…' : 'No rooms came back for those dates.'}</p>}
          </div>

          <aside className="h-fit rounded-[24px] bg-paper p-5">
            <h2 className="font-semibold">Your stay</h2>
            {!quote && <p className="mt-3 text-sm text-mist">Choose a room to see the full price.</p>}
            {quote && (
              <div className="mt-4 space-y-2 text-sm">
                {quote.lines.map((line, index) => (
                  <div key={`${line.room_type_id}-${index}`} className="flex justify-between gap-3">
                    <span>{line.name}<span className="block text-xs text-mist">{line.nights} nights · {line.adults} adults{line.children ? `, ${line.children} children` : ''}</span></span>
                    <span>{money(line.each_total)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2"><span>Rooms</span><span>{money(quote.subtotal)}</span></div>
                {quote.discount > 0 && <div className="flex justify-between text-emerald-800"><span>Promo {quote.promo?.code}</span><span>− {money(quote.discount)}</span></div>}
                <div className="flex justify-between"><span>Service {quote.service_charge_rate}%</span><span>{money(quote.service_charge)}</span></div>
                <div className="flex justify-between"><span>VAT {quote.vat_rate}%</span><span>{money(quote.vat)}</span></div>
                <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><span>Total</span><span>{money(quote.total)}</span></div>
              </div>
            )}
            <label className="mt-4 block text-xs font-semibold text-mist">Promo code
              <input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold uppercase text-ink" placeholder="WELCOME10" />
            </label>
            {quote && step === 2 && (
              <button type="button" onClick={() => setStep(3)} className="mt-4 w-full rounded-full bg-ink py-3 text-sm font-semibold text-white">Continue</button>
            )}
          </aside>
        </div>
      )}

      {step >= 3 && quote && (
        <form onSubmit={confirm} className="mt-8 grid gap-4 rounded-[24px] border border-line p-5 md:grid-cols-2">
          <h2 className="md:col-span-2 font-semibold">Who is arriving?</h2>
          {[
            ['first_name', 'First name'],
            ['last_name', 'Last name'],
            ['email', 'Email'],
            ['phone', 'Phone'],
            ['nationality', 'Nationality'],
            ['id_number', 'ID or passport number'],
          ].map(([key, label]) => (
            <label key={key} className="text-xs font-semibold text-mist">{label}
              <input required={['first_name', 'last_name', 'email', 'phone'].includes(key)} type={key === 'email' ? 'email' : 'text'} value={guest[key]} onChange={(e) => setGuest({ ...guest, [key]: e.target.value })} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink" />
            </label>
          ))}
          <label className="text-xs font-semibold text-mist md:col-span-2">Requests for the desk
            <textarea value={requests} onChange={(e) => setRequests(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink" />
          </label>
          <fieldset className="md:col-span-2">
            <legend className="text-xs font-semibold text-mist">How would you like to settle this?</legend>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {[
                ['pay_at_hotel', 'Pay at the hotel', 'The room is confirmed. Settle on arrival by cash, card, or Telebirr.'],
                ['pay_now', 'Pay by transfer', 'We hold the room as pending and send Telebirr or bank details.'],
                ['request', 'Ask the desk first', 'Nothing is confirmed until the hotel calls you back.'],
              ].map(([value, title, copy]) => (
                <label key={value} className={`rounded-2xl border p-3 text-sm ${pay === value ? 'border-ink bg-paper' : 'border-line'}`}>
                  <input type="radio" name="pay" value={value} checked={pay === value} onChange={() => setPay(value)} className="mr-2" />
                  <span className="font-semibold">{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-mist">{copy}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button disabled={loading} className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white md:col-span-2 md:w-fit">
            {loading ? 'Holding the room…' : `Confirm · ${money(quote.total)}`}
          </button>
        </form>
      )}
    </div>
  );
}
