import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { money } from '../lib/format';

export default function Rooms() {
  const [types, setTypes] = useState([]);
  useEffect(() => {
    publicApi.roomTypes().then((res) => setTypes(res.data.data));
  }, []);

  return (
    <div className="px-5 py-8 md:px-12 md:py-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mist">The rooms</p>
      <h1 className="display mt-2 text-5xl">Stay the way you actually live.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-mist">Six styles, from a quiet standard room to the residence with a kitchenette. Rates below are the midweek starting price for the included guests. Weekends and high season are priced when you choose dates.</p>
      <div className="mt-10 grid gap-6">
        {types.map((type) => (
          <article key={type.id} className="grid overflow-hidden rounded-[28px] border border-line md:grid-cols-[1.1fr_1fr]">
            <img src={type.photos[0]} alt={type.name} className="h-64 w-full object-cover md:h-full" />
            <div className="flex flex-col justify-between p-6 md:p-8">
              <div>
                <h2 className="display text-4xl">{type.name}</h2>
                <p className="mt-2 text-sm leading-6 text-mist">{type.tagline}</p>
                <p className="mt-4 text-sm leading-6">{type.description}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-mist">{type.size_sqm} m² · {type.bed_config} · Up to {type.max_occupancy} guests</p>
              </div>
              <div className="mt-6 flex items-center justify-between gap-4">
                <p className="text-sm font-semibold">From {money(type.base_rate)} <span className="font-medium text-mist">/ night</span></p>
                <Link to={`/rooms/${type.slug}`} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">View</Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
