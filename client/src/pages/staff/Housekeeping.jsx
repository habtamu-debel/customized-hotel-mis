import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { roomApi } from '../../lib/api';
import { errorText, ROOM_LABEL } from '../../lib/format';
import { useAuthStore } from '../../store/authStore';

const tone = {
  dirty: 'bg-amber-50 border-amber-200',
  clean: 'bg-sky-50 border-sky-200',
  inspected: 'bg-emerald-50 border-emerald-200',
  occupied: 'bg-white border-line',
  available: 'bg-white border-line',
  out_of_order: 'bg-rose-50 border-rose-200',
  maintenance: 'bg-rose-50 border-rose-200',
};

export default function Housekeeping() {
  const role = useAuthStore((state) => state.user?.role);
  const [rooms, setRooms] = useState([]);
  const [floor, setFloor] = useState('all');
  const [status, setStatus] = useState('all');

  function load() {
    roomApi.list().then((res) => setRooms(res.data.data));
  }
  useEffect(load, []);

  async function mark(room, next) {
    try {
      await roomApi.status(room.id, { status: next, note: `Marked ${next} from housekeeping` });
      toast.success(`Room ${room.room_number} is ${ROOM_LABEL[next].toLowerCase()}`);
      load();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  const floors = [...new Set(rooms.map((room) => room.floor))];
  const visible = rooms.filter((room) => (floor === 'all' || Number(room.floor) === Number(floor)) && (status === 'all' || room.status === status));

  return (
    <div>
      <h1 className="display text-4xl">Housekeeping</h1>
      <p className="mt-1 text-sm text-mist">Dirty rooms with an arrival today are marked first. Reception sees the change as soon as you save it.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <select value={floor} onChange={(e) => setFloor(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
          <option value="all">All floors</option>
          {floors.map((level) => <option key={level} value={level}>Floor {level}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          {Object.entries(ROOM_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((room) => {
          const priority = room.status === 'dirty' && room.arrivals_for_type > 0;
          return (
            <article key={room.id} className={`rounded-2xl border p-4 ${tone[room.status] || 'bg-white'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-semibold">{room.room_number}</p>
                  <p className="text-sm text-mist">{room.type_name} · floor {room.floor}</p>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider">{ROOM_LABEL[room.status]}</p>
              </div>
              {priority && <p className="mt-2 text-xs font-semibold text-amber-800">Arrival waiting on this room type</p>}
              {room.ooo_reason && <p className="mt-2 text-xs">{room.ooo_reason}{room.ooo_until ? ` until ${room.ooo_until}` : ''}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {room.status !== 'occupied' && <Big onClick={() => mark(room, 'dirty')}>Dirty</Big>}
                {room.status !== 'occupied' && <Big onClick={() => mark(room, 'clean')}>Clean</Big>}
                {room.status !== 'occupied' && <Big onClick={() => mark(room, 'inspected')}>Inspected</Big>}
                {role !== 'housekeeping' && room.status !== 'occupied' && <Big onClick={() => mark(room, 'out_of_order')}>Out of order</Big>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Big({ children, onClick }) {
  return <button onClick={onClick} className="rounded-full bg-white px-3 py-2 text-sm font-semibold shadow-sm">{children}</button>;
}
