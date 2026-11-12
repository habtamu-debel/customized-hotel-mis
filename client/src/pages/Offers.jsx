import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { addDays, formatDate, money, todayISO } from '../lib/format';

export default function Offers() {
  const [offers, setOffers] = useState([]);
  useEffect(() => {
    publicApi.offers().then((res) => setOffers(res.data.data)).catch(() => setOffers([]));
  }, []);
  const checkIn = addDays(todayISO(), 7);
  const checkOut = addDays(todayISO(), 10);

  return (
    <div className="px-5 py-8 md:px-12 md:py-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mist">Offers</p>
      <h1 className="display mt-2 text-5xl">A few codes, used honestly.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-mist">Enter the code on the booking page before you confirm. The discount is taken off the room total, then service charge and VAT are added. A code that is finished simply will not apply.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {offers.map((offer) => (
          <article key={offer.code} className="flex flex-col rounded-[28px] border border-line p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mist">{offer.code}</p>
            <h2 className="display mt-3 text-3xl">{offer.type === 'percent' ? `${Number(offer.value)}% off` : `${money(offer.value)} off`}</h2>
            <p className="mt-3 flex-1 text-sm leading-6 text-mist">{offer.description}</p>
            <p className="mt-4 text-xs text-mist">{formatDate(offer.valid_from)} – {formatDate(offer.valid_to)}</p>
            <Link to={`/book?checkIn=${checkIn}&checkOut=${checkOut}&adults=2&children=0&promo=${offer.code}`} className="mt-5 inline-flex w-fit rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
              Use this code
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
