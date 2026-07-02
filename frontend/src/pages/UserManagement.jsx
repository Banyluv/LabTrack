import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../utils/api';

export default function UserManagement() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user', facilityId: '' });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get('/auth/users').then(r => r.data),
  });

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities-list'],
    queryFn: () => api.get('/facilities').then(r => r.data),
  });

  const toggleUserStatus = useMutation({
    mutationFn: (id) => api.put(`/auth/users/${id}/toggle-status`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-list'] });
      toast.success('User status toggled');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed'),
  });

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast.error('Name, email, and password are required');
      return;
    }
    try {
      await api.post('/auth/register', form);
      toast.success('User created successfully');
      setForm({ name: '', email: '', password: '', role: 'user', facilityId: '' });
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ['users-list'] });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-green-800 dark:text-green-300">User Management</h1>
          <p className="text-sm text-green-700 dark:text-green-200 mt-0.5">{users.length} registered users</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary">
          {showAdd ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showAdd && (
        <div className="card p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Add New User</h2>
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label dark:text-gray-300">Full Name</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input dark:bg-gray-700 dark:text-white dark:border-gray-500" placeholder="Enter full name" />
            </div>
            <div>
              <label className="label dark:text-gray-300">Email</label>
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input dark:bg-gray-700 dark:text-white dark:border-gray-500" placeholder="Enter email" />
            </div>
            <div>
              <label className="label dark:text-gray-300">Password</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="input dark:bg-gray-700 dark:text-white dark:border-gray-500" placeholder="Enter password" />
            </div>
            <div>
              <label className="label dark:text-gray-300">Role</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="input dark:bg-gray-700 dark:text-white dark:border-gray-500">
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label dark:text-gray-300">Facility (optional)</label>
              <select value={form.facilityId} onChange={e => setForm({...form, facilityId: e.target.value})} className="input dark:bg-gray-700 dark:text-white dark:border-gray-500">
                <option value="">No facility assigned</option>
                {facilities.map(f => (
                  <option key={f._id} value={f._id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="btn btn-primary w-full">Create User</button>
            </div>
          </form>
        </div>
      )}

      <div className="card bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-300">Name</th>
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-300">Email</th>
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-300">Role</th>
                  <th className="text-left py-3 px-4 text-gray-600 dark:text-gray-300">Facility</th>
                  <th className="text-center py-3 px-4 text-gray-600 dark:text-gray-300">Status</th>
                  <th className="text-center py-3 px-4 text-gray-600 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u._id} className={`table-row-even table-row-odd`}>
                    <td className="table-td">{u.name}</td>
                    <td className="table-td">{u.email}</td>
                    <td className="table-td capitalize">{u.role}</td>
                    <td className="table-td">{u.facility_name || '—'}</td>
                    <td className="table-td text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.active !== false
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {u.active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="table-td text-center">
                      <button
                        onClick={() => toggleUserStatus.mutate(u._id)}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          u.active !== false
                            ? 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900 dark:text-red-200'
                            : 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900 dark:text-green-200'
                        }`}
                      >
                        {u.active !== false ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}