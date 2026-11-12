import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ROLE_LABEL } from '../lib/format';

const items = [
  { to: '/staff', label: 'Today', end: true, roles: ['owner', 'manager', 'front_desk', 'housekeeping'] },
  { to: '/staff/front-desk', label: 'Front desk', roles: ['owner', 'manager', 'front_desk'] },
  { to: '/staff/reservations', label: 'Bookings', roles: ['owner', 'manager', 'front_desk'] },
  { to: '/staff/housekeeping', label: 'Housekeeping', roles: ['owner', 'manager', 'front_desk', 'housekeeping'] },
  { to: '/staff/rooms', label: 'Rooms', roles: ['owner', 'manager', 'front_desk', 'housekeeping'] },
  { to: '/staff/guests', label: 'Guests', roles: ['owner', 'manager', 'front_desk'] },
  { to: '/staff/rates', label: 'Rates', roles: ['owner', 'manager'] },
  { to: '/staff/reports', label: 'Reports', roles: ['owner', 'manager'] },
  { to: '/staff/settings', label: 'Hotel', roles: ['owner', 'manager'] },
  { to: '/staff/users', label: 'Staff', roles: ['owner'] },
];

export default function StaffShell() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const visible = items.filter((item) => item.roles.includes(user?.role));

  return (
    <div className="min-h-screen bg-[#e7eef6] text-ink md:grid md:grid-cols-[230px_1fr]">
      <aside className="no-print flex gap-2 overflow-x-auto bg-ink px-3 py-3 text-white md:flex-col md:overflow-visible md:px-4 md:py-6">
        <div className="hidden md:block">
          <p className="text-[11px] font-semibold tracking-[0.2em] text-white/70">FIDEL PALACE</p>
          <p className="mt-1 text-sm text-white/80">{user?.name}</p>
          <p className="text-xs text-white/50">{ROLE_LABEL[user?.role]}</p>
        </div>
        <nav className="flex gap-1 md:mt-8 md:flex-col">
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `whitespace-nowrap rounded-full px-3 py-2 text-sm ${isActive ? 'bg-white text-ink' : 'text-white/80 hover:bg-white/10'}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          className="ml-auto rounded-full px-3 py-2 text-sm text-white/70 md:ml-0 md:mt-auto md:text-left"
          onClick={() => { logout(); navigate('/staff/login'); }}
        >
          Sign out
        </button>
      </aside>
      <main className="min-w-0 px-4 py-5 md:px-8 md:py-7">
        <Outlet />
      </main>
    </div>
  );
}
