import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Modal from '../components/Modal';
import HistoryPanel from '../components/HistoryPanel';

const COLUMNS = ['Date', 'Consumable', 'Category', 'Qty Used', 'Unit', 'Batch No', 'Expiry', 'Used By', 'Notes', ''];

const STATS = [
  {
    key: 'total_entries', label: "Today's Entries", from: 'blue',
    icon: <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
  },
  {
    key: 'total_units_used', label: 'Units Used Today', from: 'emerald',
    icon: <path d="M19 14l-7 7m0 0l-7-7m7 7V3" />,
  },
  {
    key: 'unique_items', label: 'Unique Items', from: 'amber',
    icon: <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
  },
  {
    key: 'unique_users', label: 'Staff Logging', from: 'purple',
    icon: <path d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1a4 4 0 10-4-4 4 4 0 004 4zm6-4a4 4 0 11-8 0 4 4 0 018 0z" />,
  },
];

const STAT_COLORS = {
  blue: 'from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/30 border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400',
  emerald: 'from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400',
  amber: 'from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/30 border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-400',
  purple: 'from-purple-50 to-purple-100 dark:from-purple-950/40 dark:to-purple-900/30 border-purple-200 dark:border-purple-800/50 text-purple-600 dark:text-purple-400',
};

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

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const selectedItem = items.find(i => String(i.id) === String(form.consumable_id));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-700 flex items-center justify-center text-white shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Daily Consumable Usage</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{logs.length} record{logs.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 4v16m8-8H4" /></svg>
          Log Usage
        </button>
      </div>

      {/* Today's Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {STATS.map(s => (
          <div key={s.key} className={`card bg-gradient-to-br ${STAT_COLORS[s.from]} border`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{s.label}</p>
                {todayLoading
                  ? <div className="h-8 w-14 mt-2 rounded bg-black/10 dark:bg-white/10 animate-pulse" />
                  : <p className="text-3xl font-black mt-1">{todaySummary?.[s.key] ?? 0}</p>}
              </div>
              <div className="w-9 h-9 rounded-lg bg-white/60 dark:bg-white/10 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{s.icon}</svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Filters</h2>
          {activeFilterCount > 0 && (
            <span className="badge bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">{activeFilterCount} active</span>
          )}
        </div>
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="label">From</label>
            <input type="date" className="input w-36" value={filters.from} onChange={e => setFilters(p => ({ ...p, from: e.target.value }))} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input w-36" value={filters.to} onChange={e => setFilters(p => ({ ...p, to: e.target.value }))} />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="label">Consumable</label>
            <select className="input" value={filters.consumable_id} onChange={e => setFilters(p => ({ ...p, consumable_id: e.target.value }))}>
              <option value="">All consumables</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div className="w-48">
            <label className="label">Used By</label>
            <div className="relative">
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input className="input pl-9" placeholder="Staff name..." value={filters.used_by} onChange={e => setFilters(p => ({ ...p, used_by: e.target.value }))} />
            </div>
          </div>
          <button
            className="btn btn-secondary h-10 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-700"
            disabled={!activeFilterCount}
            onClick={() => setFilters({ from: '', to: '', consumable_id: '', used_by: '' })}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg>
            Clear
          </button>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              {COLUMNS.map(h => <th key={h} className="table-th">{h}</th>)}
            </tr></thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className={i % 2 ? 'table-row-odd' : 'table-row-even'}>
                    {COLUMNS.map((_, j) => (
                      <td key={j} className="table-td"><div className="h-3.5 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" style={{ width: `${50 + (j * 13) % 40}%` }} /></td>
                    ))}
                  </tr>
                ))
              ) : logs.length ? logs.map((log, idx) => (
                <tr key={log.id} className={`${idx % 2 ? 'table-row-odd' : 'table-row-even'} hover:bg-green-50/60 dark:hover:bg-gray-700/60`}>
                  <td className="table-td text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{format(new Date(log.usage_date), 'MMM d, yyyy')}</td>
                  <td className="table-td font-medium">{log.consumable_name}</td>
                  <td className="table-td"><span className="badge badge-cat">{log.category_name}</span></td>
                  <td className="table-td">
                    <span className="badge bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">−{log.quantity}</span>
                  </td>
                  <td className="table-td text-gray-500 dark:text-gray-400 text-xs">{log.unit_name || '—'}</td>
                  <td className="table-td text-gray-500 dark:text-gray-400 text-xs">{log.batch_no || '—'}</td>
                  <td className="table-td text-gray-500 dark:text-gray-400 text-xs">{log.expiry_date ? new Date(log.expiry_date).toLocaleDateString() : '—'}</td>
                  <td className="table-td text-gray-600 dark:text-gray-300">{log.used_by}</td>
                  <td className="table-td text-gray-400 dark:text-gray-500 text-xs max-w-[150px] truncate" title={log.notes || ''}>{log.notes || '—'}</td>
                  <td className="table-td text-right">
                    <button
                      onClick={() => handleDelete(log.id)}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      title="Delete and restore stock"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9.5 4h5a1 1 0 011 1v2h-7V5a1 1 0 011-1z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={COLUMNS.length} className="table-td text-center py-14">
                    <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                      <svg className="w-10 h-10 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      <p className="text-sm font-medium">No daily usage records found</p>
                      <p className="text-xs">{activeFilterCount ? 'Try adjusting your filters' : 'Log your first usage entry to get started'}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <HistoryPanel entityType="daily_usage" title="Daily Usage Activity History" />
      </div>

      {/* Log Usage Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Log Daily Consumable Usage"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit} disabled={usageMut.isLoading}>{usageMut.isLoading ? 'Logging...' : 'Log Usage'}</button></>}>
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
              <input className="input" type="number" min="1" max={selectedItem?.stock || undefined} placeholder="e.g. 2" value={form.quantity} onChange={f('quantity')} />
              {selectedItem && <p className="mt-1 text-xs text-gray-400">{selectedItem.stock} {selectedItem.unit} available</p>}
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
