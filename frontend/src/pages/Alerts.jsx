import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Modal from '../components/Modal';

const statusLabel = (stock, reorder) => {
  if (stock === 0) return { text: 'Out of Stock', color: 'text-red-600', badge: 'badge-out' };
  if (stock <= reorder) return { text: 'Low Stock', color: 'text-amber-600', badge: 'badge-low' };
  return { text: 'Adequate', color: 'text-green-600', badge: 'badge-ok' };
};

export default function Alerts() {
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [form, setForm] = useState({ quantity: '', supplier: '', received_by: '', invoice_ref: '' });

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['consumables-alerts'],
    queryFn: () => api.get('/consumables').then(r => r.data),
    refetchInterval: 60000,
  });

  // Client-side sorting by status: matching items first, then others
  const items = (() => {
    if (!status) return allItems;
    const priority = (item) => {
      const reorder = item.reorder_quantity || 0;
      if (item.stock === 0) return 'out';
      if (item.stock <= reorder) return 'low';
      return 'ok';
    };
    return allItems.filter(item => priority(item) === status);
  })();

  const out = allItems.filter(i => i.stock === 0);
  const low = allItems.filter(i => i.stock > 0 && i.stock <= (i.reorder_quantity || 0));

  const receiveMut = useMutation({
    mutationFn: d => api.post('/receive', d),
    onSuccess: () => { qc.invalidateQueries(['consumables-alerts']); qc.invalidateQueries(['consumables']); qc.invalidateQueries(['dashboard']); toast.success('Stock updated'); setModal(false); },
    onError: e => toast.error(e.response?.data?.error || 'Failed'),
  });

  const openReceive = (item) => { setSelected(item); setForm({ quantity: '', supplier: '', received_by: '', invoice_ref: '' }); setModal(true); };
  const handleReceive = () => {
    if (!form.quantity || !form.received_by) return toast.error('Fill required fields');
    receiveMut.mutate({ consumable_id: selected.id, quantity: parseInt(form.quantity), supplier: form.supplier, received_by: form.received_by, invoice_ref: form.invoice_ref });
  };
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Stock Alerts</h1>
          <p className="text-sm text-gray-500">{out.length + low.length} items need attention · {allItems.length} total</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <select className="input w-40" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ok">Adequate</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
      </div>

      {(out.length > 0 || low.length > 0) && !status && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <span><strong>{out.length}</strong> out of stock and <strong>{low.length}</strong> running low.</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <p className="text-gray-600 font-medium">All stock levels are adequate</p>
          <p className="text-sm text-gray-400 mt-1">No items require immediate attention</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                {['Consumable','Category','Stock','Reorder Qty','Unit','Status','Action'].map(h => <th key={h} className="table-th">{h}</th>)}
              </tr></thead>
              <tbody>
                {items.map(item => {
                  const st = statusLabel(item.stock, item.reorder_quantity || 0);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="table-td font-medium">{item.name}</td>
                      <td className="table-td"><span className="badge badge-cat">{item.category_name}</span></td>
                      <td className={`table-td font-bold ${st.color}`}>{item.stock}</td>
                      <td className="table-td text-gray-500">{item.reorder_quantity}</td>
                      <td className="table-td text-gray-500">{item.unit}</td>
                      <td className="table-td"><span className={`badge ${st.badge}`}>{st.text}</span></td>
                      <td className="table-td">
                        <button className="btn btn-sm btn-primary" onClick={() => openReceive(item)}>Receive Stock</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Receive Stock"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleReceive}>Confirm Receipt</button></>}>
        {selected && <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm"><span className="font-medium">{selected.name}</span> — Current: <strong>{selected.stock}</strong> | Reorder: <strong>{selected.reorder_quantity}</strong></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Quantity *</label><input className="input" type="number" min="1" value={form.quantity} onChange={f('quantity')} /></div>
            <div><label className="label">Supplier</label><input className="input" placeholder="Supplier" value={form.supplier} onChange={f('supplier')} /></div>
          </div>
          <div><label className="label">Received By *</label><input className="input" placeholder="Staff name" value={form.received_by} onChange={f('received_by')} /></div>
          <div><label className="label">Invoice Ref</label><input className="input" placeholder="INV-0000" value={form.invoice_ref} onChange={f('invoice_ref')} /></div>
        </div>}
      </Modal>
    </div>
  );
}
