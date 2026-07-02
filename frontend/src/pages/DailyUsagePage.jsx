import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Modal from '../components/Modal';
import HistoryPanel from '../components/HistoryPanel';

export default function DailyUsagePage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ consumable_id: '', quantity: '', used_by: '', usage_date: new Date().toISOString().slice(0, 10), notes: '', batch_no: '', expiry_date: '' });
  const [filters, setFilters] = useState({ from: '', to: '', consumable_id: '', used_by: '' });

  const { data: items = [] } = useQuery({ queryKey: ['consumables-all'], queryFn: () => api.get('/consumables').then(r => r.data) });
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['daily-usage-logs', filters],
    queryFn: () => {
      const params = {};
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      if (filters.consumable_id) params.consumable_id = filters.consumable_id;
      if (filters.used_by) params.used_by = filters.used_by;
      return api.get('/daily-usage', { params }).then(r => r.data);
    },
  });
  const { data: todaySummary, isLoading: todayLoading } = useQuery({
    queryKey: ['daily-usage-today'],
    queryFn: () => api.get('/daily-usage/today').then(r => r.data),
    refetchInterval: 30000,
  });

  const updateConsumableStockInCache = (consumableId, delta) => {
    qc.setQueriesData({ queryKey: ['consumables'] }, (oldData) => {
      if (!oldData) return oldData;
      if (Array.isArray(oldData)) {
        return oldData.map(item => item.id === consumableId ? { ...item, stock: Math.max(0, (item.stock || 0) + delta) } : item);
      }
      return oldData;
    });

    qc.setQueriesData({ queryKey: ['consumables-all'] }, (oldData) => {
      if (!oldData) return oldData;
      if (Array.isArray(oldData)) {
        return oldData.map(item => item.id === consumableId ? { ...item, stock: Math.max(0, (item.stock || 0) + delta) } : item);
      }
      return oldData;
    });
  };

  const usageMut = useMutation({
    mutationFn: d => api.post('/daily-usage', d),
    onMutate: async (newUsage) => {
      await qc.cancelQueries(['consumables']);
      await qc.cancelQueries(['consumables-all']);
      updateConsumableStockInCache(newUsage.consumable_id, -newUsage.quantity);
    },
    onSuccess: () => {
      qc.invalidateQueries(['daily-usage-logs']);
      qc.invalidateQueries(['daily-usage-today']);
      qc.invalidateQueries(['consumables']);
      qc.invalidateQueries(['consumables-all']);
      qc.invalidateQueries(['dashboard']);
      toast.success('Usage logged successfully');
      setModal(false);
      setForm(p => ({ ...p, consumable_id: '', quantity: '', used_by: p.used_by, usage_date: p.usage_date, notes: '' }));
    },
    onError: (e, newUsage) => {
      updateConsumableStockInCache(newUsage.consumable_id, newUsage.quantity);
      toast.error(e.response?.data?.error || 'Failed');
    },
  });

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/daily-usage/${id}`),
    onMutate: async (id) => {
      const logEntry = logs.find(entry => entry.id === id);
      if (!logEntry) return;
      await qc.cancelQueries(['consumables']);
      await qc.cancelQueries(['consumables-all']);
      updateConsumableStockInCache(logEntry.consumable_id, logEntry.quantity);
    },
    onSuccess: (data) => {
      qc.invalidateQueries(['daily-usage-logs']);
      qc.invalidateQueries(['daily-usage-today']);
      qc.invalidateQueries(['consumables']);
      qc.invalidateQueries(['consumables-all']);
      toast.success(data.data?.message || 'Entry deleted, stock restored');
    },
    onError: (e, id) => {
      const logEntry = logs.find(entry => entry.id === id);
      if (logEntry) {
        updateConsumableStockInCache(logEntry.consumable_id, -logEntry.quantity);
      }
      toast.error(e.response?.data?.error || 'Failed');
    },
  });

  const handleSubmit = () => {
    if (!form.consumable_id || !form.quantity || !form.used_by) return toast.error('Please fill all required fields');
    usageMut.mutate({ ...form, consumable_id: parseInt(form.consumable_id), quantity: parseInt(form.quantity) });
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleDelete = (id) => {
    if (window.confirm('Delete this entry? The stock will be restored.')) {
      deleteMut.mutate(id);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Today's Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Today's Entries</p>
          <p className="text-3xl font-black text-blue-700 mt-1">{todayLoading ? '...' : todaySummary?.total_entries ?? 0}</p>
        </div>
        <div className="card bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Units Used Today</p>
          <p className="text-3xl font-black text-emerald-700 mt-1">{todayLoading ? '...' : todaySummary?.total_units_used ?? 0}</p>
        </div>
        <div className="card bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Unique Items</p>
          <p className="text-3xl font-black text-amber-700 mt-1">{todayLoading ? '...' : todaySummary?.unique_items ?? 0}</p>
        </div>
        <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Staff Logging</p>
          <p className="text-3xl font-black text-purple-700 mt-1">{todayLoading ? '...' : todaySummary?.unique_users ?? 0}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Daily Consumable Usage</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{logs.length} records</p>
        </div>
        <button className="btn btn-danger" onClick={() => setModal(true)}>+ Log Usage</button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap items-end">
        <div>
          <label className="label text-xs">From</label>
          <input type="date" className="input w-36" value={filters.from} onChange={e => setFilters(p => ({ ...p, from: e.target.value }))} />
        </div>
        <div>
          <label className="label text-xs">To</label>
          <input type="date" className="input w-36" value={filters.to} onChange={e => setFilters(p => ({ ...p, to: e.target.value }))} />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="label text-xs">Consumable</label>
          <select className="input" value={filters.consumable_id} onChange={e => setFilters(p => ({ ...p, consumable_id: e.target.value }))}>
            <option value="">All consumables</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <div className="w-40">
          <label className="label text-xs">Used By</label>
          <input className="input" placeholder="Staff name..." value={filters.used_by} onChange={e => setFilters(p => ({ ...p, used_by: e.target.value }))} />
        </div>
        <button className="btn btn-secondary h-10" onClick={() => setFilters({ from: '', to: '', consumable_id: '', used_by: '' })}>Clear</button>
      </div>

      {/* Log Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              {['Date','Consumable','Category','Qty Used','Unit','Batch No','Expiry','Used By','Notes','Actions'].map(h => <th key={h} className="table-th">{h}</th>)}
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={10} className="table-td text-center py-10 text-gray-400">Loading...</td></tr>
               : logs.length ? logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="table-td text-xs text-gray-500 whitespace-nowrap">{format(new Date(log.usage_date), 'MMM d, yyyy')}</td>
                  <td className="table-td font-medium">{log.consumable_name}</td>
                  <td className="table-td"><span className="badge badge-cat">{log.category_name}</span></td>
                  <td className="table-td font-semibold text-red-500">-{log.quantity}</td>
                  <td className="table-td text-gray-500 text-xs">{log.unit_name || '—'}</td>
                  <td className="table-td text-gray-500 text-xs">{log.batch_no || '—'}</td>
                  <td className="table-td text-gray-500 text-xs">{log.expiry_date ? new Date(log.expiry_date).toLocaleDateString() : '—'}</td>
                  <td className="table-td text-gray-600">{log.used_by}</td>
                  <td className="table-td text-gray-400 text-xs max-w-[150px] truncate">{log.notes || '—'}</td>
                  <td className="table-td">
                    <button onClick={() => handleDelete(log.id)} className="text-red-500 hover:text-red-700 text-xs font-semibold" title="Delete and restore stock">
                      Delete
                    </button>
                  </td>
                </tr>
              )) : <tr><td colSpan={8} className="table-td text-center py-10 text-gray-400">No daily usage records found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <HistoryPanel entityType="daily_usage" title="Daily Usage Activity History" />
      </div>

      {/* Log Usage Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Log Daily Consumable Usage"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-danger" onClick={handleSubmit} disabled={usageMut.isLoading}>Log Usage</button></>}>
        <div className="space-y-4">
          <div>
            <label className="label">Consumable *</label>
            <select className="input" value={form.consumable_id} onChange={f('consumable_id')}>
              <option value="">Select consumable...</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.stock} {i.unit})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Quantity Used *</label>
              <input className="input" type="number" min="1" placeholder="e.g. 2" value={form.quantity} onChange={f('quantity')} />
            </div>
            <div>
              <label className="label">Date</label>
              <input className="input" type="date" value={form.usage_date} onChange={f('usage_date')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Batch No.</label>
              <input className="input" placeholder="Batch number (if any)" value={form.batch_no} onChange={f('batch_no')} />
            </div>
            <div>
              <label className="label">Expiry Date</label>
              <input className="input" type="date" value={form.expiry_date} onChange={f('expiry_date')} />
            </div>
          </div>
          <div>
            <label className="label">Used By (Staff Name) *</label>
            <input className="input" placeholder="e.g. Nurse Jane" value={form.used_by} onChange={f('used_by')} />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} placeholder="Optional notes..." value={form.notes} onChange={f('notes')} />
          </div>
        </div>
      </Modal>
    </div>
  );
}