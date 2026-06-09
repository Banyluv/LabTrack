import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const statusBadge = (stock, min) => {
  if (stock === 0) return <span className="badge badge-out">Out of Stock</span>;
  if (stock <= min) return <span className="badge badge-low">Low Stock</span>;
  return <span className="badge badge-ok">Adequate</span>;
};

const emptyForm = { name: '', category_id: '', unit: '', stock: 0, reorder_quantity: 0, price: 0, description: '' };

export default function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'dispatch' | 'receive'
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [txForm, setTxForm] = useState({ quantity: '', destination: '', dispatched_by: '', supplier: '', received_by: '', invoice_ref: '', notes: '' });
  const [selectedItem, setSelectedItem] = useState(null);

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/consumables/categories').then(r => r.data) });
  const { data: units = [] } = useQuery({ queryKey: ['units'], queryFn: () => api.get('/units').then(r => r.data) });
  const { data: facilities = [] } = useQuery({ queryKey: ['facilities'], queryFn: () => api.get('/facilities').then(r => r.data) });
  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['consumables', search, cat],
    queryFn: () => api.get('/consumables', { params: { search, category: cat } }).then(r => r.data),
  });

  // Client-side filtering by status: show only matching items
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

  const createMut = useMutation({ mutationFn: d => api.post('/consumables', d), onSuccess: () => { qc.invalidateQueries(['consumables']); toast.success('Consumable added'); setModal(null); }, onError: e => toast.error(e.response?.data?.error || 'Create failed') });
  const updateMut = useMutation({ mutationFn: ({ id, ...d }) => api.put(`/consumables/${id}`, d), onSuccess: () => { qc.invalidateQueries(['consumables']); toast.success('Updated'); setModal(null); }, onError: e => toast.error(e.response?.data?.error || 'Update failed') });
  const deleteMut = useMutation({ mutationFn: id => api.delete(`/consumables/${id}`), onSuccess: () => { qc.invalidateQueries(['consumables']); toast.success('Deleted'); } });
  const dispatchMut = useMutation({
    mutationFn: d => api.post('/dispatch', d),
    onSuccess: () => { qc.invalidateQueries(['consumables']); toast.success('Dispatched to hospital'); setModal(null); },
    onError: e => toast.error(e.response?.data?.error || 'Dispatch failed'),
  });
  const receiveMut = useMutation({
    mutationFn: d => api.post('/receive', d),
    onSuccess: () => { qc.invalidateQueries(['consumables']); toast.success('Stock received'); setModal(null); },
    onError: e => toast.error(e.response?.data?.error || 'Receive failed'),
  });

  const openEdit = (item) => {
    setForm({ name: item.name, category_id: item.category_id, unit: item.unit, stock: item.stock, reorder_quantity: item.reorder_quantity, price: item.price, description: item.description || '' });
    setEditId(item.id);
    setModal('edit');
  };

  const [formError, setFormError] = useState('');
  const handleSave = () => {
    const rq = typeof form.reorder_quantity === 'number' ? form.reorder_quantity : parseInt(form.reorder_quantity) || 0;
    const st = typeof form.stock === 'number' ? form.stock : parseInt(form.stock) || 0;
    if (st > 0 && rq > 0 && rq >= st) {
      setFormError('Reorder quantity must be less than current stock');
      return;
    }
    setFormError('');
    if (modal === 'add') createMut.mutate(form);
    else updateMut.mutate({ id: editId, ...form, stock: undefined });
  };

  const handleDispatch = () => {
    if (!txForm.quantity || !txForm.destination || !txForm.dispatched_by) return toast.error('Fill all required fields');
    dispatchMut.mutate({ consumable_id: selectedItem.id, quantity: parseInt(txForm.quantity), destination: txForm.destination, dispatched_by: txForm.dispatched_by, notes: txForm.notes });
  };

  const handleReceive = () => {
    if (!txForm.quantity || !txForm.received_by) return toast.error('Fill all required fields');
    receiveMut.mutate({ consumable_id: selectedItem.id, quantity: parseInt(txForm.quantity), supplier: txForm.supplier, received_by: txForm.received_by, invoice_ref: txForm.invoice_ref });
  };

  const f = (key) => e => setForm(p => ({ ...p, [key]: e.target.value }));
  const tf = (key) => e => setTxForm(p => ({ ...p, [key]: e.target.value }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} consumables</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setFormError(''); setModal('add'); }}>+ Add Consumable</button>}
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input className="input flex-1 min-w-48" placeholder="Search consumables..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-44" value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select className="input w-40" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ok">Adequate</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              {['Name','Category','Unit','Stock','Reorder Qty','Status','Actions'].map(h => <th key={h} className="table-th">{h}</th>)}
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="table-td text-center py-10 text-gray-400">Loading...</td></tr>
              ) : items.length ? items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-td font-medium">{item.name}</td>
                  <td className="table-td"><span className="badge badge-cat">{item.category_name}</span></td>
                  <td className="table-td text-gray-500">{item.unit}</td>
                  <td className="table-td font-semibold">{item.stock}</td>
                  <td className="table-td text-gray-500">{item.reorder_quantity}</td>
                  <td className="table-td">{statusBadge(item.stock, item.reorder_quantity)}</td>
                  <td className="table-td">
                    <div className="flex items-center gap-2">
                      <button className="btn btn-sm btn-primary" onClick={() => { setSelectedItem(item); setTxForm({ quantity: '', destination: '', dispatched_by: '', supplier: '', received_by: '', invoice_ref: '', notes: '' }); setModal('dispatch'); }}>Dispatch</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => { setSelectedItem(item); setTxForm({ quantity: '', destination: '', dispatched_by: '', supplier: '', received_by: '', invoice_ref: '', notes: '' }); setModal('receive'); }}>Receive</button>
                      {isAdmin && <button className="btn btn-sm btn-secondary" onClick={() => openEdit(item)}>Edit</button>}
                      {isAdmin && <button className="btn btn-sm btn-danger" onClick={() => { if(confirm('Delete this consumable?')) deleteMut.mutate(item.id); }}>Del</button>}
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan={7} className="table-td text-center py-10 text-gray-400">No consumables found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modal === 'add' || modal === 'edit'} onClose={() => { setModal(null); setFormError(''); }} title={modal === 'add' ? 'Add Consumable' : 'Edit Consumable'}
        footer={<><button className="btn btn-secondary" onClick={() => { setModal(null); setFormError(''); }}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Save</button></>}>
        <div className="space-y-4">
          <div><label className="label">Name *</label><input className="input" value={form.name} onChange={f('name')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Category *</label>
              <select className="input" value={form.category_id} onChange={f('category_id')}>
                <option value="">Select...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div><label className="label">Unit *</label>
              <select className="input" value={form.unit} onChange={f('unit')}>
                <option value="">Select...</option>
                {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {modal === 'add' && <div><label className="label">Initial Stock</label><input className="input" type="number" min="0" value={form.stock} onChange={f('stock')} /></div>}
            <div>
              <label className="label flex items-center gap-1">Reorder Quantity <span className="text-xs text-gray-400">(must be {'<'} stock)</span></label>
              <input className={`input ${formError ? 'border-red-500' : ''}`} type="number" min="0" value={form.reorder_quantity} onChange={(e) => { setFormError(''); f('reorder_quantity')(e); }} />
              {formError && <p className="text-red-600 text-xs mt-1">{formError}</p>}
            </div>
            <div><label className="label">Price (₦)</label><input className="input" type="number" min="0" value={form.price} onChange={f('price')} /></div>
          </div>
          <div><label className="label">Description</label><input className="input" value={form.description} onChange={f('description')} /></div>
        </div>
      </Modal>

      {/* Dispatch Modal */}
      <Modal open={modal === 'dispatch'} onClose={() => setModal(null)} title="Dispatch to Hospital"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-danger" onClick={handleDispatch}>Confirm Dispatch</button></>}>
        {selectedItem && <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm"><span className="font-medium">{selectedItem.name}</span> — <span className="text-gray-500">Available: <strong>{selectedItem.stock}</strong> {selectedItem.unit}</span></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Quantity *</label><input className="input" type="number" min="1" max={selectedItem.stock} value={txForm.quantity} onChange={tf('quantity')} /></div>
            <div><label className="label">Facility *</label>
              <select className="input" value={txForm.destination} onChange={tf('destination')}>
                <option value="">Select facility...</option>
                {facilities.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
              </select>
            </div>
          </div>
          <div><label className="label">Dispatched By *</label><input className="input" placeholder="Staff name" value={txForm.dispatched_by} onChange={tf('dispatched_by')} /></div>
          <div><label className="label">Notes</label><input className="input" placeholder="Optional remarks" value={txForm.notes} onChange={tf('notes')} /></div>
        </div>}
      </Modal>

      {/* Receive Modal */}
      <Modal open={modal === 'receive'} onClose={() => setModal(null)} title="Receive Stock"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" onClick={handleReceive}>Confirm Receipt</button></>}>
        {selectedItem && <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm"><span className="font-medium">{selectedItem.name}</span> — <span className="text-gray-500">Current stock: <strong>{selectedItem.stock}</strong></span></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Quantity Received *</label><input className="input" type="number" min="1" value={txForm.quantity} onChange={tf('quantity')} /></div>
            <div><label className="label">Supplier</label><input className="input" placeholder="Supplier name" value={txForm.supplier} onChange={tf('supplier')} /></div>
          </div>
          <div><label className="label">Received By *</label><input className="input" placeholder="Staff name" value={txForm.received_by} onChange={tf('received_by')} /></div>
          <div><label className="label">Invoice / Reference No.</label><input className="input" placeholder="INV-0000" value={txForm.invoice_ref} onChange={tf('invoice_ref')} /></div>
        </div>}
      </Modal>
    </div>
  );
}