import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import FieldLabel from '../components/FieldLabel';
import toast from 'react-hot-toast';

export default function Suppliers() {
  const qc = useQueryClient();
  const { data: suppliers = [], isLoading } = useQuery({ queryKey: ['suppliers'], queryFn: () => api.get('/suppliers').then(r => r.data) });
  const [modal, setModal] = useState(null);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', contact_person: '', email: '', phone: '', address: '' });

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));

  const openAdd = () => { setForm({ name: '', contact_person: '', email: '', phone: '', address: '' }); setEditId(null); setModal('add'); };
  const openEdit = (s) => { setForm({ name: s.name, contact_person: s.contact_person || '', email: s.email || '', phone: s.phone || '', address: s.address || '' }); setEditId(s.id); setModal('edit'); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name required'); return; }
    try {
      if (editId) { await api.put('/suppliers/' + editId, form); toast.success('Updated'); }
      else { await api.post('/suppliers', form); toast.success('Created'); }
      setModal(null); qc.invalidateQueries({ queryKey: ['suppliers'] });
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this supplier?')) return;
    try { await api.delete('/suppliers/' + id); toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['suppliers'] }); }
    catch (err) { toast.error('Failed to delete'); }
  };

  if (isLoading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-xl font-semibold text-green-800 dark:text-green-300">Suppliers</h1><p className="text-sm text-green-700 dark:text-green-200 mt-0.5">{suppliers.length} suppliers</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Supplier</button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="table-th">Name</th><th className="table-th">Contact</th><th className="table-th">Email</th><th className="table-th">Phone</th><th className="table-th w-24">Actions</th></tr></thead>
            <tbody>
              {suppliers.map((s, i) => (
                <tr key={s.id} className={i % 2 === 0 ? 'table-row-even' : 'table-row-odd'}>
                  <td className="table-td font-medium">{s.name}</td>
                  <td className="table-td">{s.contact_person || '-'}</td>
                  <td className="table-td">{s.email || '-'}</td>
                  <td className="table-td">{s.phone || '-'}</td>
                  <td className="table-td"><div className="flex gap-1"><button className="btn btn-sm btn-secondary" onClick={() => openEdit(s)}>Edit</button><button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id)}>Del</button></div></td>
                </tr>
              ))}
              {suppliers.length === 0 && <tr><td colSpan={5} className="table-td text-center text-gray-400 py-8">No suppliers yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{editId ? 'Edit' : 'Add'} Supplier</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><FieldLabel label="Name" tip="The name of the vendor or supplying organisation." required /><input className="input" value={form.name} onChange={f('name')} /></div>
              <div className="grid grid-cols-2 gap-3"><div><FieldLabel label="Contact Person" tip="Phone number, email, or primary contact person at the supplier." /><input className="input" value={form.contact_person} onChange={f('contact_person')} /></div><div><FieldLabel label="Email" tip="The primary email address for contacting this supplier." /><input className="input" type="email" value={form.email} onChange={f('email')} /></div></div>
              <div className="grid grid-cols-2 gap-3"><div><FieldLabel label="Phone" tip="Contact phone number for the supplier." /><input className="input" value={form.phone} onChange={f('phone')} /></div><div><FieldLabel label="Address" tip="Physical or postal address of the supplier." /><input className="input" value={form.address} onChange={f('address')} /></div></div>
              <div className="flex gap-2 pt-2"><button type="submit" className="btn btn-primary flex-1">Save</button><button type="button" className="btn btn-secondary flex-1" onClick={() => setModal(null)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
