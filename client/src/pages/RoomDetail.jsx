import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { addDays, money, todayISO } from '../lib/format';

export default function RoomDetail() {
  const { slug } = useParams();
  const [room, setRoom] = useState(null);
  const [missing, setMissing] = useState(false);
  const [photo, setPhoto] = useState(0);

  useEffect(() => {
    setMissing(false);
    publicApi.room(slug).then((res) => {
      setRoom(res.data.data);
      setPhoto(0);
    }).catch(() => setMissing(true));
  }, [slug]);

  if (missing) return <p className="px-8 py-16">This room style is not on the book.</p>;
  if (!room) return <p className="px-8 py-16 text-mist">Loading the room…</p>;

  const checkIn = addDays(todayISO(), 1);
  const checkOut = addDays(todayISO(), 3);

  return (
    <div className="px-5 py-8 md:px-12 md:py-12">
      <Link to="/rooms" className="text-xs font-semibold uppercase tracking-[0.16em] text-mist">All rooms</Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
        <div>
          <img src={room.photos[photo]} alt={room.name} className="h-[420px] w-full rounded-[28px] object-cover" />
          <div className="mt-3 flex gap-3">
            {room.photos.map((src, index) => (
              <button key={src} onClick={() => setPhoto(index)} className={`h-20 w-28 overflow-hidden rounded-xl ${index === photo ? 'ring-2 ring-ink' : ''}`}>
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <h1 className="display text-5xl">{room.name}</h1>
          <p className="mt-3 text-sm leading-6 text-mist">{room.tagline}</p>
          <p className="mt-5 text-sm leading-7">{room.description}</p>
          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-paper p-3"><dt className="text-mist">Size</dt><dd className="font-semibold">{room.size_sqm} m²</dd></div>
            <div className="rounded-2xl bg-paper p-3"><dt className="text-mist">Sleeps</dt><dd className="font-semibold">{room.base_occupancy} included, {room.max_occupancy} max</dd></div>
            <div className="rounded-2xl bg-paper p-3"><dt className="text-mist">Beds</dt><dd className="font-semibold">{room.bed_config}</dd></div>
            <div className="rounded-2xl bg-paper p-3"><dt className="text-mist">From</dt><dd className="font-semibold">{money(room.base_rate)} / night</dd></div>
          </dl>
          <ul className="mt-5 flex flex-wrap gap-2">
            {room.amenities.map((item) => (
              <li key={item} className="rounded-full border border-line px-3 py-1 text-xs font-semibold">{item}</li>
            ))}
          </ul>
          <Link
            to={`/book?checkIn=${checkIn}&checkOut=${checkOut}&adults=${room.base_occupancy}&children=0&type=${room.slug}`}
            className="mt-6 inline-flex rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white"
          >
            Check availability
          </Link>
          <p className="mt-3 text-xs leading-5 text-mist">Extra adult {money(room.extra_adult_rate)} per night. Extra child {money(room.extra_child_rate)} per night. Weekend nights carry a 15% uplift unless a seasonal rate replaces it.</p>
        </div>
      </div>
    </div>
  );
}
