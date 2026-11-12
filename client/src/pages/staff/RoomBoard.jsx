import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { roomApi } from '../../lib/api';
import { errorText, ROOM_LABEL } from '../../lib/format';
import { useAuthStore } from '../../store/authStore';

export default function RoomBoard() {
  const role = useAuthStore((state) => state.user?.role);
  const canEdit = role === 'owner' || role === 'manager';
  const [rooms, setRooms] = useState([]);
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({ room_number: '', floor: 2, room_type_id: '', view_type: '' });

  function load() {
    roomApi.list().then((res) => setRooms(res.data.data));
    if (canEdit) roomApi.types().then((res) => {
      setTypes(res.data.data);
      setForm((current) => ({ ...current, room_type_id: current.room_type_id || res.data.data[0]?.id || '' }));
    });
  }
  useEffect(load, [canEdit]);

  async function add(event) {
    event.preventDefault();
    try {
      await roomApi.createRoom({ ...form, floor: Number(form.floor), room_type_id: Number(form.room_type_id) });
      toast.success('Room added');
      setForm({ ...form, room_number: '' });
      load();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <div>
      <h1 className="display text-4xl">Rooms</h1>
      <p className="mt-1 text-sm text-mist">{rooms.length} keys. Occupied rooms are released to dirty at check-out.</p>
      {canEdit && (
        <form onSubmit={add} className="mt-4 grid gap-2 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-5">
          <input required placeholder="Number" value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} className="rounded-xl border border-line px-3 py-2 text-sm" />
          <input required type="number" placeholder="Floor" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} className="rounded-xl border border-line px-3 py-2 text-sm" />
          <select value={form.room_type_id} onChange={(e) => setForm({ ...form, room_type_id: e.target.value })} className="rounded-xl border border-line px-3 py-2 text-sm">
            {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
          <input placeholder="View" value={form.view_type} onChange={(e) => setForm({ ...form, view_type: e.target.value })} className="rounded-xl border border-line px-3 py-2 text-sm" />
          <button className="rounded-full bg-ink text-sm font-semibold text-white">Add room</button>
        </form>
      )}
      <div className="mt-4 overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-mist">
            <tr>{['Room', 'Type', 'Floor', 'View', 'Status', 'Note'].map((head) => <th key={head} className="px-4 py-3">{head}</th>)}</tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-t border-line">
                <td className="px-4 py-3 font-semibold">{room.room_number}</td>
                <td className="px-4 py-3">{room.type_name}</td>
                <td className="px-4 py-3">{room.floor}</td>
                <td className="px-4 py-3">{room.view_type}</td>
                <td className="px-4 py-3">{ROOM_LABEL[room.status]}</td>
                <td className="px-4 py-3 text-mist">{room.arrival ? `Arrival ${room.arrival.last_name}` : room.ooo_reason || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
