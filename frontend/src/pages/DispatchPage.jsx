import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Modal from '../components/Modal';
import HistoryPanel from '../components/HistoryPanel';
import ExportButton from '../components/ExportButton';

export default function DispatchPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ consumable_id: '', quantity: '', issued_quantity: '', returned_quantity: '', receiving_officer: '', destination: '', dispatched_by: '', notes: '' });
  const [filters, setFilters] = useState({ from: '', to: '', destination: '' });

  const { data: items = [] } = useQuery({ queryKey: ['consumables-all'], queryFn: () => api.get('/consumables').then(r => r.data) });
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['dispatch-logs', filters],
    queryFn: () => api.get('/dispatch', { params: filters }).then(r => r.data),
  });

  const dispatchMut = useMutation({
    mutationFn: d => api.post('/dispatch', d),
    onSuccess: () => { qc.invalidateQueries(['dispatch-logs']); qc.invalidateQueries(['consumables']); qc.invalidateQueries(['dashboard']); toast.success('Dispatched successfully'); setModal(false); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const handleSubmit = () => {
    if (!form.consumable_id || !form.quantity || !form.destination || !form.dispatched_by) return toast.error('Fill all required fields');
    dispatchMut.mutate({ ...form, consumable_id: parseInt(form.consumable_id), quantity: parseInt(form.quantity) });
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Dispatch Log</h1>
          <p className="text-sm text-gray-500">{logs.length} records</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <ExportButton label="Export Dispatch Log" endpoint="/dispatch/export" fileName="dispatch-log.xlsx" />
          <button className="btn btn-primary" onClick={() => setModal(true)}>+ New Dispatch</button>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input type="date" className="input w-40" value={filters.from} onChange={e => setFilters(p => ({ ...p, from: e.target.value }))} />
        <input type="date" className="input w-40" value={filters.to} onChange={e => setFilters(p => ({ ...p, to: e.target.value }))} />
        <input className="input flex-1 min-w-40" placeholder="Filter by destination..." value={filters.destination} onChange={e => setFilters(p => ({ ...p, destination: e.target.value }))} />
        <button className="btn btn-secondary" onClick={() => setFilters({ from: '', to: '', destination: '' })}>Clear</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              {['Date & Time','Consumable','Category','Qty','Destination','Dispatched By','Notes'].map(h => <th key={h} className="table-th">{h}</th>)}
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={7} className="table-td text-center py-10 text-gray-400">Loading...</td></tr>
               : logs.length ? logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="table-td text-xs text-gray-500 whitespace-nowrap">{format(new Date(log.dispatched_at), 'MMM d yyyy, h:mm a')}</td>
                  <td className="table-td font-medium">{log.consumable_name}</td>
                  <td className="table-td"><span className="badge badge-cat">{log.category_name}</span></td>
                  <td className="table-td font-semibold text-red-500">-{log.quantity}</td>
                  <td className="table-td">{log.destination}</td>
                  <td className="table-td text-gray-500">{log.dispatched_by}</td>
                  <td className="table-td text-gray-400 text-xs">{log.notes || '—'}</td>
                </tr>
              )) : <tr><td colSpan={7} className="table-td text-center py-10 text-gray-400">No dispatch records</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <HistoryPanel entityType="dispatch" title="Dispatch Activity History" />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="New Dispatch to Hospital"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-danger" onClick={handleSubmit}>Confirm Dispatch</button></>}>
        <div className="space-y-4">
          <div><label className="label">Consumable *</label>
            <select className="input" value={form.consumable_id} onChange={f('consumable_id')}>
              <option value="">Select consumable...</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name} (Stock: {i.stock})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Quantity *</label><input className="input" type="number" min="1" value={form.quantity} onChange={f('quantity')} /></div>
            <div><label className="label">Destination *</label><input className="input" placeholder="Ward / Dept" value={form.destination} onChange={f('destination')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Issued Quantity</label><input className="input" type="number" min="0" value={form.issued_quantity} onChange={f('issued_quantity')} /></div>
            <div><label className="label">Returned Quantity</label><input className="input" type="number" min="0" value={form.returned_quantity} onChange={f('returned_quantity')} /></div>
          </div>
          <div><label className="label">Receiving Officer</label><input className="input" placeholder="Name of receiving officer" value={form.receiving_officer} onChange={f('receiving_officer')} /></div>
          <div><label className="label">Dispatched By *</label><input className="input" placeholder="Staff name" value={form.dispatched_by} onChange={f('dispatched_by')} /></div>
          <div><label className="label">Notes</label><input className="input" placeholder="Optional" value={form.notes} onChange={f('notes')} /></div>
        </div>
      </Modal>
    </div>
  );
}
