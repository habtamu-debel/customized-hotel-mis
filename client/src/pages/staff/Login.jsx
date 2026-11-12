import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../lib/api';
import { errorText } from '../../lib/format';
import { useAuthStore } from '../../store/authStore';

export default function Login() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState('desk@fidelpalace.com');
  const [password, setPassword] = useState('Palace@2026');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await authApi.login({ email, password });
      setSession(res.data.data.token, res.data.data.user);
      navigate(res.data.data.user.role === 'housekeeping' ? '/staff/housekeeping' : '/staff');
    } catch (err) {
      setError(errorText(err, 'Sign-in failed.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[linear-gradient(160deg,#d5e6f6,#c3daf0)] px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-card">
        <Link to="/" className="text-[12px] font-semibold tracking-[0.2em]">FIDEL PALACE</Link>
        <h1 className="display mt-4 text-4xl">Staff entrance</h1>
        <p className="mt-2 text-sm text-mist">Front desk, housekeeping, and the manager use the same door. The house decides what each person can touch.</p>
        <label className="mt-6 block text-xs font-semibold text-mist">Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-3 text-sm text-ink" />
        </label>
        <label className="mt-3 block text-xs font-semibold text-mist">Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-3 text-sm text-ink" />
        </label>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="mt-5 w-full rounded-full bg-ink py-3 text-sm font-semibold text-white">{busy ? 'Signing in…' : 'Enter'}</button>
        <div className="mt-6 rounded-2xl bg-paper p-4 text-xs leading-5 text-mist">
          <p className="font-semibold text-ink">This installation</p>
          owner@fidelpalace.com · manager@fidelpalace.com<br />
          desk@fidelpalace.com · house@fidelpalace.com<br />
          Password: Palace@2026
        </div>
      </form>
    </div>
  );
}
