import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Modal from '../components/Modal';

export default function ReceivePage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ consumable_id: '', quantity: '', supplier: '', received_by: '', invoice_ref: '', batch_no: '', expiry_date: '' });
  const [filters, setFilters] = useState({ from: '', to: '' });

  const { data: items = [] } = useQuery({ queryKey: ['consumables-all'], queryFn: () => api.get('/consumables').then(r => r.data) });
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['receive-logs', filters],
    queryFn: () => api.get('/receive', { params: filters }).then(r => r.data),
  });

  const receiveMut = useMutation({
    mutationFn: d => api.post('/receive', d),
    onSuccess: () => { qc.invalidateQueries(['receive-logs']); qc.invalidateQueries(['consumables']); qc.invalidateQueries(['dashboard']); toast.success('Stock received successfully'); setModal(false); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const handleSubmit = () => {
    if (!form.consumable_id || !form.quantity || !form.received_by) return toast.error('Fill all required fields');
    receiveMut.mutate({ ...form, consumable_id: parseInt(form.consumable_id), quantity: parseInt(form.quantity) });
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Receive Stock</h1>
          <p className="text-sm text-gray-500">{logs.length} records</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Receive Stock</button>
      </div>

      <div className="flex gap-3 mb-4">
        <input type="date" className="input w-40" value={filters.from} onChange={e => setFilters(p => ({ ...p, from: e.target.value }))} />
        <input type="date" className="input w-40" value={filters.to} onChange={e => setFilters(p => ({ ...p, to: e.target.value }))} />
        <button className="btn btn-secondary" onClick={() => setFilters({ from: '', to: '' })}>Clear</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              {['Date & Time','Consumable','Category','Qty Received','Supplier','Received By','Batch No.','Expiry Date','Invoice Ref'].map(h => <th key={h} className="table-th">{h}</th>)}
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={9} className="table-td text-center py-10 text-gray-400">Loading...</td></tr>
               : logs.length ? logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="table-td text-xs text-gray-500 whitespace-nowrap">{format(new Date(log.received_at), 'MMM d yyyy, h:mm a')}</td>
                  <td className="table-td font-medium">{log.consumable_name}</td>
                  <td className="table-td"><span className="badge badge-cat">{log.category_name}</span></td>
                  <td className="table-td font-semibold text-green-600">+{log.quantity}</td>
                  <td className="table-td">{log.supplier || '—'}</td>
                  <td className="table-td text-gray-500">{log.received_by}</td>
                  <td className="table-td font-mono text-xs">{log.batch_no || '—'}</td>
                  <td className="table-td text-xs">{log.expiry_date ? format(new Date(log.expiry_date), 'MMM d yyyy') : '—'}</td>
                  <td className="table-td text-gray-400 text-xs">{log.invoice_ref || '—'}</td>
                </tr>
              )) : <tr><td colSpan={9} className="table-td text-center py-10 text-gray-400">No receive records</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Receive Stock from Store"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit}>Confirm Receipt</button></>}>
        <div className="space-y-4">
          <div><label className="label">Consumable *</label>
            <select className="input" value={form.consumable_id} onChange={f('consumable_id')}>
              <option value="">Select consumable...</option>
              {items.map(i => <option key={i.id} value={i.id}>{i.name} (Current: {i.stock})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Quantity *</label><input className="input" type="number" min="1" value={form.quantity} onChange={f('quantity')} /></div>
            <div><label className="label">Supplier</label><input className="input" placeholder="Supplier name" value={form.supplier} onChange={f('supplier')} /></div>
          </div>
          <div><label className="label">Received By *</label><input className="input" placeholder="Staff name" value={form.received_by} onChange={f('received_by')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Batch No.</label><input className="input" placeholder="BATCH-001" value={form.batch_no} onChange={f('batch_no')} /></div>
            <div><label className="label">Expiry Date</label><input className="input" type="date" value={form.expiry_date} onChange={f('expiry_date')} /></div>
          </div>
          <div><label className="label">Invoice / Reference No.</label><input className="input" placeholder="INV-0000" value={form.invoice_ref} onChange={f('invoice_ref')} /></div>
        </div>
      </Modal>
    </div>
  );
}
