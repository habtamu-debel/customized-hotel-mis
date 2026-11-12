import { Navigate, Route, Routes } from 'react-router-dom';
import SiteShell from './components/SiteShell';
import StaffShell from './components/StaffShell';
import Home from './pages/Home';
import Rooms from './pages/Rooms';
import RoomDetail from './pages/RoomDetail';
import Location from './pages/Location';
import Offers from './pages/Offers';
import Contact from './pages/Contact';
import Book from './pages/Book';
import Confirmation from './pages/Confirmation';
import Login from './pages/staff/Login';
import Dashboard from './pages/staff/Dashboard';
import Reservations from './pages/staff/Reservations';
import ReservationDetail from './pages/staff/ReservationDetail';
import FrontDesk from './pages/staff/FrontDesk';
import Housekeeping from './pages/staff/Housekeeping';
import RoomBoard from './pages/staff/RoomBoard';
import Guests from './pages/staff/Guests';
import Rates from './pages/staff/Rates';
import Reports from './pages/staff/Reports';
import Settings from './pages/staff/Settings';
import Users from './pages/staff/Users';
import { useAuthStore } from './store/authStore';

function RequireAuth({ children, roles }) {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/staff/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/staff" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<SiteShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/rooms" element={<Rooms />} />
        <Route path="/rooms/:slug" element={<RoomDetail />} />
        <Route path="/location" element={<Location />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/book" element={<Book />} />
        <Route path="/booking/:ref" element={<Confirmation />} />
      </Route>
      <Route path="/staff/login" element={<Login />} />
      <Route path="/staff" element={<RequireAuth><StaffShell /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="front-desk" element={<RequireAuth roles={['owner', 'manager', 'front_desk']}><FrontDesk /></RequireAuth>} />
        <Route path="reservations" element={<RequireAuth roles={['owner', 'manager', 'front_desk']}><Reservations /></RequireAuth>} />
        <Route path="reservations/:id" element={<RequireAuth roles={['owner', 'manager', 'front_desk']}><ReservationDetail /></RequireAuth>} />
        <Route path="rooms" element={<RoomBoard />} />
        <Route path="housekeeping" element={<Housekeeping />} />
        <Route path="guests" element={<RequireAuth roles={['owner', 'manager', 'front_desk']}><Guests /></RequireAuth>} />
        <Route path="guests/:id" element={<RequireAuth roles={['owner', 'manager', 'front_desk']}><Guests /></RequireAuth>} />
        <Route path="rates" element={<RequireAuth roles={['owner', 'manager']}><Rates /></RequireAuth>} />
        <Route path="reports" element={<RequireAuth roles={['owner', 'manager']}><Reports /></RequireAuth>} />
        <Route path="settings" element={<RequireAuth roles={['owner', 'manager']}><Settings /></RequireAuth>} />
        <Route path="users" element={<RequireAuth roles={['owner']}><Users /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
