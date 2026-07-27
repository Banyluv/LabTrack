import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import PasswordInput from '../components/PasswordInput';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const qc = useQueryClient();

  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '', facility_name: user?.facility_name || '', state: user?.state || '', lga: user?.lga || '' });
  const [saving, setSaving] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [changing, setChanging] = useState(false);

  const { data: facilities = [] } = useQuery({ queryKey: ['facilities'], queryFn: () => api.get('/facilities').then(r => r.data), enabled: user?.role === 'admin' });
  const { data: users = [] } = useQuery({ queryKey: ['users-list'], queryFn: () => api.get('/auth/users').then(r => r.data), enabled: user?.role === 'admin' });

  const handleProfile = async (e) => { e.preventDefault(); setSaving(true); try { await api.put('/auth/profile', profile); toast.success('Profile updated'); } catch (err) { toast.error(err.response?.data?.error || 'Failed'); } finally { setSaving(false); } };
  const handlePassword = async (e) => { e.preventDefault(); if (passwords.new !== passwords.confirm) { toast.error('Passwords do not match'); return; } setChanging(true); try { await api.put('/auth/change-password', { currentPassword: passwords.current, newPassword: passwords.new }); toast.success('Password changed'); setPasswords({ current: '', new: '', confirm: '' }); } catch (err) { toast.error(err.response?.data?.error || 'Failed'); } finally { setChanging(false); } };
  const toggleFacility = async (id) => { try { await api.put('/facilities/' + id + '/toggle-status'); qc.invalidateQueries({ queryKey: ['facilities'] }); toast.success('Toggled'); } catch (err) { toast.error('Failed'); } };
  const toggleUser = async (id) => { try { await api.put('/auth/users/' + id + '/toggle-status'); qc.invalidateQueries({ queryKey: ['users-list'] }); toast.success('Toggled'); } catch (err) { toast.error('Failed'); } };

  const L = 'label dark:text-gray-300', I = 'input dark:bg-gray-700 dark:text-white dark:border-gray-500';

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div><h1 className="text-xl font-semibold text-green-800 dark:text-green-300">Settings</h1><p className="text-sm text-green-700 dark:text-green-200 mt-0.5">Manage your account</p></div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden"><div className="px-6 py-4 border-b"><h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Profile</h2></div>
        <form onSubmit={handleProfile} className="p-6 space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={L}>Name</label><input name="name" className={I} value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} /></div>
            <div><label className={L}>Email</label><input name="email" type="email" className={I} value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} /></div>
            <div><label className={L}>Facility</label><input name="facility_name" className={I} value={profile.facility_name} onChange={e => setProfile(p => ({ ...p, facility_name: e.target.value }))} /></div>
            <div><label className={L}>State</label><input name="state" className={I} value={profile.state} onChange={e => setProfile(p => ({ ...p, state: e.target.value }))} /></div>
            <div><label className={L}>LGA</label><input name="lga" className={I} value={profile.lga} onChange={e => setProfile(p => ({ ...p, lga: e.target.value }))} /></div>
            <div className="flex items-end"><p className="text-xs text-gray-400">Role: <span className="font-semibold capitalize">{user?.role}</span></p></div>
        </div><button type="submit" disabled={saving} className="btn btn-primary">{saving ? "Saving..." : "Save Changes"}</button></form></div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden"><div className="px-6 py-4 border-b"><h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Change Password</h2></div>
        <form onSubmit={handlePassword} className="p-6 space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={L}>Current Password</label><PasswordInput className={I} value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} required /></div><div></div>
            <div><label className={L}>New Password</label><PasswordInput className={I} value={passwords.new} onChange={e => setPasswords(p => ({ ...p, new: e.target.value }))} required /></div>
            <div><label className={L}>Confirm Password</label><PasswordInput className={I} value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} required /></div>
        </div><button type="submit" disabled={changing} className="btn btn-primary">{changing ? "Changing..." : "Change Password"}</button></form></div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden"><div className="px-6 py-4 border-b"><h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Appearance</h2></div>
        <div className="p-6 flex items-center justify-between"><div><p className="text-sm font-medium text-gray-900 dark:text-gray-100">Dark Mode</p><p className="text-xs text-gray-500 dark:text-gray-400">Toggle theme</p></div>
          <button onClick={toggleTheme} className={`relative w-12 h-6 rounded-full ${dark ? "bg-green-600" : "bg-gray-300"}`}><span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${dark ? "translate-x-6" : "translate-x-0.5"}`} /></button></div></div>
      {user?.role === "admin" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden"><div className="px-6 py-4 border-b"><h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Facilities</h2></div>
          <div className="p-6"><div className="space-y-2">
            {facilities.map(f => (<div key={f.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"><div><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{f.name}</p><p className="text-xs text-gray-400">{f.state}{f.lga ? " / " + f.lga : ""}</p></div>
              <button onClick={() => toggleFacility(f.id)} className={`text-xs font-medium px-3 py-1 rounded-full transition ${f.status === "active" ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700" : "bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700"}`}>{f.status === "active" ? "Active" : "Inactive"}</button></div>))}
          </div></div></div>
      )}
      {user?.role === "admin" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden"><div className="px-6 py-4 border-b"><h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Users</h2></div>
          <div className="p-6"><div className="space-y-2">
            {users.map(u => (<div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"><div><p className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.name} <span className="text-xs text-gray-400 capitalize">({u.role})</span></p><p className="text-xs text-gray-400">{u.email}{u.facility_name ? " / " + u.facility_name : ""}</p></div>
              <button onClick={() => toggleUser(u.id)} className={`text-xs font-medium px-3 py-1 rounded-full transition ${u.status === "active" ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700" : "bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700"}`}>{u.status === "active" ? "Active" : "Inactive"}</button></div>))}
          </div></div></div>
      )}
    </div>
  );
}
