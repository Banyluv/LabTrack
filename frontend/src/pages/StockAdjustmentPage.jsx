import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Modal from '../components/Modal';
import HistoryPanel from '../components/HistoryPanel';
import SearchableSelect from '../components/SearchableSelect';

const adjustmentTypes = [
  { value: 'loss', label: 'Loss', color: 'text-red-500' },
  { value: 'expired', label: 'Expired', color: 'text-orange-600' },
  { value: 'damaged', label: 'Damaged', color: 'text-yellow-600' },
  { value: 'positive_adjustment_from', label: 'Positive Adjustment (From)', color: 'text-green-600' },
  { value: 'negative_adjustment_to', label: 'Negative Adjustment (To)', color: 'text-blue-600' },
];

export default function StockAdjustmentPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ consumable_id: '', quantity: '', adjustment_type: 'loss', reason: '' });
  const [filters, setFilters] = useState({ from: '', to: '', type: '' });

  const { data: items = [] } = useQuery({
    queryKey: ['consumables-all'],
    queryFn: () => api.get('/consumables', { params: { all: 'true' } }).then(r => r.data),
  });
  const { data: adjustments = [], isLoading } = useQuery({
    queryKey: ['stock-adjustments', filters],
    queryFn: () => api.get('/stock-adjustments', { params: filters }).then(r => r.data),
  });

  const adjMut = useMutation({
    mutationFn: d => api.post('/stock-adjustments', d),
    onSuccess: () => { qc.invalidateQueries(['stock-adjustments']); qc.invalidateQueries(['consumables']); qc.invalidateQueries(['dashboard']); toast.success('Stock adjusted successfully'); setModal(false); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const handleSubmit = () => {
    if (!form.consumable_id || !form.quantity || !form.adjustment_type) return toast.error('Fill all required fields');
    adjMut.mutate({ ...form, consumable_id: parseInt(form.consumable_id), quantity: parseInt(form.quantity) });
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const getTypeBadge = (type) => {
    const t = adjustmentTypes.find(a => a.value === type);
    const badgeClass = type === 'positive_adjustment_from' ? 'badge-ok' :
      (type === 'loss' || type === 'expired' || type === 'damaged' || type === 'negative_adjustment_to') ? 'badge-out' : 'badge-low';
    return <span className={`badge text-xs font-medium ${badgeClass} border`}>{t?.label || type}</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Stock Adjustments</h1>
          <p className="text-sm text-gray-500">{adjustments.length} records</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ New Adjustment</button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input type="date" className="input w-40" value={filters.from} onChange={e => setFilters(p => ({ ...p, from: e.target.value }))} />
        <input type="date" className="input w-40" value={filters.to} onChange={e => setFilters(p => ({ ...p, to: e.target.value }))} />
        <select className="input w-40" value={filters.type} onChange={e => setFilters(p => ({ ...p, type: e.target.value }))}>
          <option value="">All types</option>
          {adjustmentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={() => setFilters({ from: '', to: '', type: '' })}>Clear</button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              {['Date & Time','Consumable','Category','Type','Quantity','Previous','New','Performed By','Reason'].map(h => <th key={h} className="table-th">{h}</th>)}
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={9} className="table-td text-center py-10 text-gray-400">Loading...</td></tr>
               : adjustments.length ? adjustments.map(adj => (
                <tr key={adj.id} className="hover:bg-gray-50">
                  <td className="table-td text-xs text-gray-500 whitespace-nowrap">{format(new Date(adj.created_at), 'MMM d yyyy, h:mm a')}</td>
                  <td className="table-td font-medium">{adj.consumable_name}</td>
                  <td className="table-td"><span className="badge badge-cat">{adj.category_name}</span></td>
                  <td className="table-td">{getTypeBadge(adj.adjustment_type)}</td>
                  <td className="table-td font-semibold">{adj.quantity}</td>
                  <td className="table-td text-gray-500">{adj.previous_stock}</td>
                  <td className="table-td font-semibold">{adj.new_stock}</td>
                  <td className="table-td text-gray-500">{adj.performed_by}</td>
                  <td className="table-td text-gray-400 text-xs max-w-xs truncate">{adj.reason || '—'}</td>
                </tr>
              )) : <tr><td colSpan={9} className="table-td text-center py-10 text-gray-400">No adjustments found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <HistoryPanel entityType="stock_adjustment" title="Stock Adjustment History" />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="New Stock Adjustment"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit}>Confirm Adjustment</button></>}>
        <div className="space-y-4">
          <div><label className="label">Consumable *</label>
            <SearchableSelect
              options={items.map(i => ({ value: i.id, label: `${i.name} (Stock: ${i.stock})` }))}
              value={form.consumable_id}
              onChange={v => setForm(p => ({ ...p, consumable_id: v }))}
              placeholder="Search & select consumable..."
            />
          </div>
          <div><label className="label">Adjustment Type *</label>
            <select className="input" value={form.adjustment_type} onChange={f('adjustment_type')}>
              {adjustmentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div><label className="label">Quantity *</label>
            <input className="input" type="number" min="1" value={form.quantity} onChange={f('quantity')} />
          </div>
          <div><label className="label">Reason</label>
            <textarea className="input" rows="2" placeholder="Reason for adjustment..." value={form.reason} onChange={f('reason')} />
          </div>
        </div>
      </Modal>
    </div>
  );
}