import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { userApi } from '../../lib/api';
import { errorText, ROLE_LABEL } from '../../lib/format';

const empty = { name: '', email: '', password: '', role: 'front_desk' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(empty);

  function load() { userApi.list().then((res) => setUsers(res.data.data)); }
  useEffect(load, []);

  async function create(event) {
    event.preventDefault();
    try {
      await userApi.create(form);
      toast.success('Staff account created');
      setForm(empty);
      load();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  async function toggle(user) {
    try {
      await userApi.update(user.id, { name: user.name, role: user.role, is_active: !user.is_active });
      load();
    } catch (error) {
      toast.error(errorText(error));
    }
  }

  return (
    <div>
      <h1 className="display text-4xl">Staff</h1>
      <p className="mt-1 text-sm text-mist">Housekeeping can update room status. They cannot change a rate, take a payment, or cancel a booking.</p>
      <form onSubmit={create} className="mt-4 grid gap-2 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-4">
        <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl border border-line px-3 py-2 text-sm" />
        <input required type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl border border-line px-3 py-2 text-sm" />
        <input required type="password" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-xl border border-line px-3 py-2 text-sm" />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="rounded-xl border border-line px-3 py-2 text-sm">
          {Object.entries(ROLE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <button className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white md:col-span-4 md:w-fit">Add staff</button>
      </form>
      <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
        {users.map((user) => (
          <div key={user.id} className="flex items-center justify-between border-b border-line px-4 py-3 text-sm last:border-0">
            <div>
              <p className="font-semibold">{user.name}</p>
              <p className="text-mist">{user.email} · {ROLE_LABEL[user.role]}</p>
            </div>
            <button onClick={() => toggle(user)} className="text-xs font-semibold underline">{user.is_active ? 'Deactivate' : 'Activate'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
