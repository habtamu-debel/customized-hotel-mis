import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const links = [
  ['/', 'Home'],
  ['/rooms', 'Rooms'],
  ['/location', 'Location'],
  ['/offers', 'Offers'],
  ['/contact', 'Contact us'],
];

export default function SiteShell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_circle_at_20%_0%,#eef5fb,transparent_40%),linear-gradient(160deg,#d5e6f6_0%,#c3daf0_48%,#dbe8f4_100%)] px-3 py-3 md:px-5 md:py-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1180px] flex-col overflow-hidden rounded-[28px] bg-white shadow-card">
        <header className="flex items-center justify-between gap-4 px-5 py-5 md:px-10">
          <Link to="/" className="text-[13px] font-semibold tracking-[0.22em] text-ink">FIDEL PALACE</Link>
          <nav className="hidden items-center gap-7 md:flex">
            {links.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `text-[11px] font-semibold uppercase tracking-[0.16em] ${isActive ? 'text-ink' : 'text-mist hover:text-ink'}`}
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/book" className="rounded-full bg-ink px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white md:px-5">
              Book now
            </Link>
            <button className="grid h-10 w-10 place-items-center rounded-full border border-line md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </header>
        {open && (
          <div className="flex flex-col gap-3 border-t border-line px-5 py-4 md:hidden">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className="text-sm font-semibold uppercase tracking-[0.14em]">
                {label}
              </NavLink>
            ))}
          </div>
        )}
        <div className="flex-1">
          <Outlet />
        </div>
        <footer className="mt-8 border-t border-line px-5 py-8 md:px-10">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <p className="text-[13px] font-semibold tracking-[0.22em]">FIDEL PALACE</p>
              <p className="mt-3 text-sm leading-6 text-mist">Cameroon Street, Bole<br />Addis Ababa, Ethiopia</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mist">Stay</p>
              <p className="mt-3 text-sm leading-6">Check-in 14:00<br />Check-out 12:00<br />+251 11 667 2400</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mist">Write</p>
              <p className="mt-3 text-sm leading-6">stay@fidelpalace.com<br />Reservations desk, daily</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mist">House</p>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <Link to="/booking/find" className="hover:underline">Find a booking</Link>
                <Link to="/staff/login" className="hover:underline">Staff entrance</Link>
              </div>
            </div>
          </div>
          <p className="mt-8 text-xs text-mist">© {new Date().getFullYear()} Fidel Palace. Prices in Ethiopian Birr, with service charge and VAT shown before you confirm.</p>
        </footer>
      </div>
    </div>
  );
}
