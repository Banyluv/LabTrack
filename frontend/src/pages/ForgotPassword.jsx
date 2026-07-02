import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
      toast.success('Password reset link sent to your email');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="card p-8 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-3">Check your email</h2>
            <p className="text-white/80 mb-6">
              We've sent a password reset link to <strong>{email}</strong>. Click the link to reset your password.
            </p>
            <p className="text-sm text-white/70 mb-6">The link will expire in 1 hour.</p>
            <Link
              to="/login"
              className="inline-block px-6 py-2 bg-white hover:bg-gray-100 text-green-700 rounded-lg font-medium transition"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-black text-emerald-800 dark:text-emerald-400 tracking-tight leading-tight">ECEWS</h1>
          <p className="text-base text-emerald-800 dark:text-emerald-300 font-bold">Consumables & Logistics Management System</p>
          <p className="text-sm text-green-700 dark:text-green-300 mt-2">Reset your password</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
            </div>
            <p className="text-xs text-white/70">
              We'll send you a link to reset your password.
            </p>
            <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center py-2.5">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Sending...
                </span>
              ) : 'Send Reset Link'}
            </button>
          </form>
          <p className="text-center text-xs text-white/80 mt-4">
            Remember your password? <Link to="/login" className="text-white font-semibold hover:underline underline-offset-2">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
