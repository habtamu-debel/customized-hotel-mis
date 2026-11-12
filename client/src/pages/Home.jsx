import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BedDouble, Building2, Crown, Home as HomeIcon, Search, Sofa, Users } from 'lucide-react';
import { publicApi } from '../lib/api';
import { addDays, money, todayISO } from '../lib/format';

const ICONS = [BedDouble, Building2, Users, Sofa, Crown, HomeIcon];
const HERO = 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=2000&q=80';
const DINING = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1400&q=80';
const SPA = 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=80';
const LOUNGE = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80';
const TRANSFER = 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=900&q=80';
const NIGHT = 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1800&q=80';

const services = [
  { title: 'Kaffa restaurant', copy: 'A short menu that changes with the market. Dinner from 18:30, breakfast from 6:30.', image: DINING, wide: true },
  { title: 'Palace spa', copy: 'Three treatment rooms and a quiet hour if you ask for one.', image: SPA },
  { title: 'Airport greeting', copy: 'A driver with your name, from Bole Airport to the door.', image: TRANSFER },
  { title: 'Lobby lounge', copy: 'Coffee in the afternoon. Something stronger after dark.', image: LOUNGE },
];

export default function Home() {
  const navigate = useNavigate();
  const [types, setTypes] = useState([]);
  const [story, setStory] = useState(false);
  const [form, setForm] = useState({
    check_in: addDays(todayISO(), 1),
    check_out: addDays(todayISO(), 3),
    adults: 2,
    children: 0,
    type: '',
  });

  useEffect(() => {
    publicApi.roomTypes().then((res) => setTypes(res.data.data)).catch(() => setTypes([]));
  }, []);

  function search(event) {
    event.preventDefault();
    const params = new URLSearchParams({
      checkIn: form.check_in,
      checkOut: form.check_out,
      adults: String(form.adults),
      children: String(form.children),
    });
    if (form.type) params.set('type', form.type);
    navigate(`/book?${params.toString()}`);
  }

  const deals = types.slice(1, 4);

  return (
    <div>
      <section className="px-5 pb-4 pt-6 text-center md:px-16 md:pt-12">
        <h1 className="display text-[46px] leading-[0.95] text-ink sm:text-[68px] md:text-[84px]">
          Beyond Borders<br />Beyond Luxury
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-mist md:text-base">
          Handpicked rooms in Bole, Addis Ababa. Elevate your stay with quiet service, honest cooking, and a house that lets you slow down.
        </p>
        <a href="#rooms" className="mt-6 inline-flex rounded-full bg-ink px-6 py-2.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-white">
          Explore
        </a>
      </section>

      <section className="relative mt-8">
        <img src={HERO} alt="The modern front of Fidel Palace" className="h-[340px] w-full object-cover md:h-[460px]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent" />
      </section>

      <form onSubmit={search} className="relative z-10 mx-4 -mt-12 grid items-end gap-3 rounded-2xl border border-line bg-white p-3 shadow-[0_16px_50px_rgba(28,43,74,0.08)] md:mx-10 md:-mt-16 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:p-4">
        <label className="px-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mist">Check-in</span>
          <input type="date" required value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none" />
        </label>
        <label className="border-line px-2 md:border-l">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mist">Check-out</span>
          <input type="date" required value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none" />
        </label>
        <label className="border-line px-2 md:border-l">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mist">Guests</span>
          <div className="mt-1 flex gap-2">
            <select value={form.adults} onChange={(e) => setForm({ ...form, adults: Number(e.target.value) })} className="bg-transparent text-sm font-semibold outline-none">
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} adult{n > 1 ? 's' : ''}</option>)}
            </select>
            <select value={form.children} onChange={(e) => setForm({ ...form, children: Number(e.target.value) })} className="bg-transparent text-sm font-semibold outline-none">
              {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} child{n === 1 ? '' : 'ren'}</option>)}
            </select>
          </div>
        </label>
        <label className="border-line px-2 md:border-l">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mist">Room style</span>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full bg-transparent text-sm font-semibold outline-none">
            <option value="">Any style</option>
            {types.map((type) => <option key={type.id} value={type.slug}>{type.name}</option>)}
          </select>
        </label>
        <button className="grid h-12 w-full place-items-center rounded-xl bg-ink text-white md:w-12" aria-label="Search rooms">
          <Search size={18} />
        </button>
      </form>

      <section className="px-5 py-16 text-center md:px-16 md:py-24">
        <h2 className="display mx-auto max-w-3xl text-4xl leading-[1.05] md:text-6xl">
          Timeless luxury, effortless living.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-mist md:text-base">
          Fidel Palace keeps one address, twenty-three rooms, and a front desk that still knows the bookings by name. The building is modern. The hospitality is not in a hurry.
        </p>
      </section>

      <section id="rooms" className="px-5 pb-8 md:px-12">
        <div className="text-center">
          <h2 className="display text-4xl md:text-5xl">Luxury & Comfort</h2>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-mist">Room styles</p>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {types.map((type, index) => {
            const Icon = ICONS[index % ICONS.length];
            return (
              <Link key={type.id} to={`/rooms/${type.slug}`} className="group rounded-2xl px-2 py-4 text-center hover:bg-paper">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-line text-ink">
                  <Icon size={20} strokeWidth={1.4} />
                </span>
                <p className="mt-3 text-sm font-semibold">{type.name}</p>
                <p className="text-xs text-mist">From {money(type.base_rate)}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="px-5 py-12 md:px-12">
        <div className="text-center">
          <h2 className="display text-4xl md:text-5xl">Exclusive deals</h2>
          <p className="mt-2 text-sm text-mist">Current room rates, before the weekend uplift and before tax.</p>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {deals.map((type) => (
            <Link key={type.id} to={`/rooms/${type.slug}`} className="overflow-hidden rounded-3xl border border-line bg-white">
              <div className="relative">
                <img src={type.photos[0]} alt={type.name} className="h-52 w-full object-cover" />
              </div>
              <div className="flex items-end justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{type.name}</p>
                  <p className="mt-1 text-xs leading-5 text-mist">{type.tagline}</p>
                </div>
                <p className="shrink-0 text-right text-sm font-semibold">{money(type.base_rate)}<span className="block text-[10px] font-medium text-mist">/ night</span></p>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link to="/offers" className="text-sm font-semibold underline decoration-[#c5d0de] underline-offset-4">See offers and promo codes</Link>
        </div>
      </section>

      <section className="px-5 py-8 md:px-12">
        <div className="text-center">
          <h2 className="display text-4xl md:text-5xl">Discover our hospitality</h2>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-mist">In the house</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="overflow-hidden rounded-3xl bg-[#f3f7fb] md:col-span-2 md:grid md:grid-cols-[1.1fr_1fr]">
            <img src={services[0].image} alt="" className="h-64 w-full object-cover md:h-full" />
            <div className="flex flex-col justify-center p-6 md:p-10">
              <h3 className="display text-3xl">{services[0].title}</h3>
              <p className="mt-3 max-w-md text-sm leading-6 text-mist">{services[0].copy}</p>
              <Link to="/location" className="mt-5 text-sm font-semibold underline underline-offset-4">Details</Link>
            </div>
          </article>
          {services.slice(1).map((service) => (
            <article key={service.title} className="overflow-hidden rounded-3xl border border-line">
              <img src={service.image} alt="" className="h-44 w-full object-cover" />
              <div className="p-4">
                <h3 className="font-semibold">{service.title}</h3>
                <p className="mt-1 text-sm leading-6 text-mist">{service.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="px-5 py-12 md:px-12">
        <h2 className="display text-center text-4xl md:text-5xl">Insights</h2>
        <button type="button" onClick={() => setStory((v) => !v)} className="relative mt-8 block w-full overflow-hidden rounded-[28px] text-left">
          <img src={NIGHT} alt="The house at dusk" className="h-[320px] w-full object-cover md:h-[440px]" />
          <span className="absolute inset-0 bg-gradient-to-t from-[#1c2b4a]/50 to-transparent" />
          <span className="absolute bottom-6 left-6 right-6 text-white md:bottom-10 md:left-10">
            <span className="display block text-3xl md:text-5xl">The house on Cameroon Street</span>
            <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">{story ? 'Hide the story' : 'Read the story'}</span>
          </span>
        </button>
        {story && (
          <div className="mx-auto mt-6 max-w-3xl text-sm leading-7 text-mist md:text-base">
            <p>
              Fidel Palace was planned as a small hotel that could still feel like a house: a real restaurant, rooms with doors that close properly, and a desk that can change a date without sending you through a call centre. The building is new. The name is a nod to the fidel, the characters Ethiopian children learn first — a reminder that a stay should be readable, not complicated.
            </p>
            <p className="mt-4">
              There are twenty-three keys. Housekeeping marks a room clean, the manager inspects it, and only then does the front desk hand it to a guest. If the last suite is already promised, the website will say so. We would rather lose a booking than sell the same night twice.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
