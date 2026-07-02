import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Login failed';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),_transparent_30%),#f8fafc] dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.22),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.14),_transparent_28%),#020617] flex items-center justify-center p-6">
      <div className="w-full max-w-5xl rounded-[2rem] border border-emerald-200/50 bg-white/95 shadow-[0_40px_80px_-40px_rgba(15,118,110,0.45)] backdrop-blur-xl dark:border-emerald-500/30 dark:bg-slate-950/95 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="relative px-10 py-12 lg:px-14 lg:py-16 bg-emerald-900 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.16),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.08),_transparent_25%)]" />
            <div className="relative z-10 space-y-8">
              <div className="inline-flex items-center justify-center flex-col gap-3 rounded-3xl bg-white/10 px-5 py-4 shadow-lg shadow-black/10 backdrop-blur-sm text-center">
                <div className="text-2xl sm:text-3xl uppercase tracking-[0.35em] text-emerald-100 font-black">ECEWS</div>
                <p className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">Consumables & Logistics Management System</p>
              </div>

              <div className="space-y-4">
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Secure Login for Your Supply Operations</h1>
                <p className="max-w-xl text-sm text-emerald-100/85 leading-7">
                  Access the Logistics Consumable Management System with a secure account. Track stock, submit requests, and monitor approval history from one polished dashboard.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/90 font-semibold mb-3">Fast access</p>
                  <p className="text-sm text-white/90">Login quickly with your credentials and get instant access to stock and request workflows.</p>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
                  <p className="text-xs uppercase tracking-[0.35em] text-emerald-200/90 font-semibold mb-3">Reliable control</p>
                  <p className="text-sm text-white/90">See inventory levels, manage approvals, and keep critical supplies in balance at all times.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-8 py-10 lg:px-12 lg:py-14 bg-slate-50 dark:bg-slate-950">
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-emerald-600 dark:text-emerald-300 font-semibold">Welcome back</p>
                  <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Sign in to continue</h2>
                </div>
                <div className="hidden sm:flex items-center gap-2 rounded-full bg-emerald-100/80 px-4 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-800/20 dark:text-emerald-200">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Secure access
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200/80 dark:border-slate-700/70 bg-white dark:bg-slate-900 shadow-sm p-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-900/10 dark:text-red-200">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="label">Username</label>
                    <input
                      type="text"
                      className="input"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      placeholder="Enter your username"
                    />
                  </div>

                  <div>
                    <label className="label">Password</label>
                    <input
                      type="password"
                      className="input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Enter your password"
                    />
                    <div className="text-right mt-2">
                      <Link to="/forgot-password" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 dark:hover:text-emerald-200">
                        Forgot password?
                      </Link>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center py-3 text-sm font-semibold">
                    {loading ? 'Signing in…' : 'Sign in'}
                  </button>
                </form>
              </div>

              <div className="text-center text-sm text-slate-500 dark:text-slate-400">
                <p>New to ECEWS?</p>
                <Link to="/register" className="font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-100">
                  Create an account
                </Link>
              </div>

              <div className="text-center text-sm text-slate-400 dark:text-slate-500">
                <Link to="/" className="hover:text-emerald-600 dark:hover:text-emerald-300">Return to homepage</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


