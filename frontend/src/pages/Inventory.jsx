import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import ImportModal from '../components/ImportModal';

const statusBadge = (stock, min) => {
  if (stock === 0) return <span className="badge badge-out">Out of Stock</span>;
  if (stock < 10) return <span className="badge badge-low">Low Stock</span>;
  return <span className="badge badge-ok">Adequate</span>;
};

const emptyForm = { name: '', category_id: '', unit: '', stock: 0, reorder_quantity: 0, description: '', batch_no: '', expiry_date: '' };

export default function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [historyDate, setHistoryDate] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'dispatch' | 'receive'
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [txForm, setTxForm] = useState({ quantity: '', destination: '', dispatched_by: '', supplier: '', received_by: '', invoice_ref: '', notes: '', batch_no: '', expiry_date: '' });
  const [selectedItem, setSelectedItem] = useState(null);
  const [consumableSearch, setConsumableSearch] = useState('');
  const [consumableDropdownOpen, setConsumableDropdownOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const dropdownWrapperRef = useRef(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/consumables/categories').then(r => r.data) });
  const { data: units = [] } = useQuery({ queryKey: ['units'], queryFn: () => api.get('/units').then(r => r.data) });
  const { data: facilities = [] } = useQuery({ queryKey: ['facilities'], queryFn: () => api.get('/facilities').then(r => r.data) });
  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['consumables', search, cat, historyDate],
    queryFn: () => api.get('/consumables', { params: { search, category: cat, ...(historyDate && { history_date: `${historyDate}T23:59:59` }) } }).then(r => r.data),
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownWrapperRef.current && !dropdownWrapperRef.current.contains(e.target)) {
        setConsumableDropdownOpen(false);
        setConsumableSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Client-side filtering by status: show only matching items
  const items = (() => {
    if (!status) return allItems;
    const priority = (item) => {
      const reorder = item.reorder_quantity || 0;
      if (item.stock === 0) return 'out';
      if (item.stock < 10) return 'low';
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

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = { search, category: cat };
      if (historyDate) params.history_date = `${historyDate}T23:59:59`;
      const res = await api.get('/consumables/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-export${historyDate ? '-' + historyDate : ''}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (err) {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleImportCSV = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/consumables/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      qc.invalidateQueries(['consumables']);
      return res.data;
    } catch (err) {
      throw err.response?.data?.error || 'Import failed';
    }
  };

  const openEdit = (item) => {
    setForm({ name: item.name, category_id: item.category_id, unit: item.unit, stock: item.stock, reorder_quantity: item.reorder_quantity, description: item.description || '', batch_no: item.batch_no || '', expiry_date: item.expiry_date ? item.expiry_date.substring(0, 10) : '' });
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
    receiveMut.mutate({ consumable_id: selectedItem.id, quantity: parseInt(txForm.quantity), supplier: txForm.supplier, received_by: txForm.received_by, invoice_ref: txForm.invoice_ref, batch_no: txForm.batch_no, expiry_date: txForm.expiry_date });
  };

  const f = (key) => e => setForm(p => ({ ...p, [key]: e.target.value }));
  const tf = (key) => e => setTxForm(p => ({ ...p, [key]: e.target.value }));

  const filteredConsumables = consumableSearch
    ? allItems.filter(c =>
        c.name.toLowerCase().includes(consumableSearch.toLowerCase()) ||
        (c.category_name && c.category_name.toLowerCase().includes(consumableSearch.toLowerCase()))
      )
    : allItems;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
           <h1 className="text-xl font-semibold text-green-800 dark:text-green-300">Inventory</h1>
           <p className="text-sm text-green-700 dark:text-green-200 mt-0.5">{items.length} consumables</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button className="btn btn-secondary" onClick={() => setImportModalOpen(true)} title="Import CSV">📥 Import CSV</button>
              <button className="btn btn-secondary" onClick={handleExport} disabled={exporting} title="Export to Excel">
                {exporting ? '⏳ Exporting...' : '📤 Export Excel'}
              </button>
              <button className="btn btn-primary" onClick={() => { setForm(emptyForm); setFormError(''); setSelectedItem(null); setConsumableSearch(''); setModal('add'); }}>+ Add Consumable</button>
            </>
          )}
        </div>
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
        <input type="date" className="input w-44" value={historyDate} onChange={e => setHistoryDate(e.target.value)} title="Filter inventory as of this date" />
        {historyDate && <button className="btn btn-sm btn-secondary" onClick={() => setHistoryDate('')}>Clear</button>}
      </div>

       <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-green-700">
                {['Name','Category','Unit','Stock','Reorder Qty','Batch No.','Expiry Date','Status','Actions'].map(h => <th key={h} className="table-th">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={9} className="table-td text-center py-10 text-gray-400">Loading...</td></tr>
               ) : items.length ? items.map((item, idx) => (
                <tr key={item.id} className={`hover:bg-green-100 dark:hover:bg-green-900/40 hover:shadow-sm hover:border-l-4 hover:border-l-green-600 transition-all duration-150 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-750'}`}>
                  <td className="table-td font-medium">{item.name}</td>
                  <td className="table-td"><span className="badge badge-cat">{item.category_name}</span></td>
                  <td className="table-td text-gray-500">{item.unit}</td>
                  <td className="table-td font-semibold">{item.stock}</td>
                  <td className="table-td text-gray-500">{item.reorder_quantity}</td>
                  <td className="table-td text-gray-500">{item.batch_no || '—'}</td>
                  <td className="table-td text-gray-500">{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : '—'}</td>
                  <td className="table-td">{statusBadge(item.stock, item.reorder_quantity)}</td>
                  <td className="table-td">
                    <div className="flex items-center gap-2">
                      <button className="btn btn-sm btn-primary" onClick={() => { setSelectedItem(item); setTxForm({ quantity: '', destination: '', dispatched_by: '', supplier: '', received_by: '', invoice_ref: '', notes: '', batch_no: '', expiry_date: '' }); setModal('dispatch'); }}>Dispatch</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => { setSelectedItem(item); setTxForm({ quantity: '', destination: '', dispatched_by: '', supplier: '', received_by: '', invoice_ref: '', notes: '', batch_no: '', expiry_date: '' }); setModal('receive'); }}>Receive</button>
                      {isAdmin && <button className="btn btn-sm btn-danger" onClick={() => openEdit(item)}>Edit</button>}
                      {isAdmin && <button className="btn btn-sm btn-danger" onClick={() => setDeleteConfirm(item)}>Del</button>}
                    </div>
                  </td>
                </tr>
              )) : <tr><td colSpan={9} className="table-td text-center py-10 text-gray-400">No consumables found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modal === 'add' || modal === 'edit'} onClose={() => { setModal(null); setFormError(''); }} title={modal === 'add' ? 'Add Consumable' : 'Edit Consumable'}
        footer={<><button className="btn btn-secondary" onClick={() => { setModal(null); setFormError(''); }}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Save</button></>}>
        <div className="space-y-4">
          {/* Name: searchable dropdown for add, plain text input for edit */}
          {modal === 'add' ? (
            <div ref={dropdownWrapperRef}>
              <label className="label">Consumable *</label>
              <div className="relative">
                <button
                  type="button"
                  className="input flex items-center justify-between pr-3 text-left cursor-pointer"
                  onClick={() => { setConsumableDropdownOpen(!consumableDropdownOpen); setConsumableSearch(''); }}
                >
                  {selectedItem ? (
                    <span className="flex items-center gap-2 truncate">
                      <span className="font-medium truncate">{selectedItem.name}</span>
                      <span className="text-xs text-gray-400">({selectedItem.unit})</span>
                      <span className="text-xs text-gray-500 ml-1">Stock: {selectedItem.stock}</span>
                      {statusBadge(selectedItem.stock, selectedItem.reorder_quantity)}
                    </span>
                  ) : form.name ? (
                    <span className="font-medium truncate">{form.name}</span>
                  ) : (
                    <span className="text-gray-400">Search and select a consumable...</span>
                  )}
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ml-2 flex-shrink-0 ${consumableDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {consumableDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                      <input
                        type="text"
                        className="input text-sm py-1.5"
                        placeholder="Search consumable..."
                        value={consumableSearch}
                        onChange={(e) => setConsumableSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto max-h-56">
                      {filteredConsumables.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">No consumables found</p>
                      ) : (
                        filteredConsumables.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            className={`w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-teal-50 transition-colors ${selectedItem?.id === c.id ? 'bg-teal-50 border-l-2 border-teal-500' : ''}`}
                            onClick={() => {
                              setSelectedItem(c);
                              setForm(p => ({ ...p, name: c.name, category_id: c.category_id, unit: c.unit, description: c.description || '' }));
                              setConsumableDropdownOpen(false);
                              setConsumableSearch('');
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-800 truncate">{c.name}</span>
                                <span className="text-xs text-gray-400 flex-shrink-0">({c.unit})</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {c.category_name && <span className="text-xs text-gray-400">{c.category_name}</span>}
                                <span className="text-xs text-gray-500">Stock: <span className={c.stock === 0 ? 'text-red-500 font-medium' : c.stock <= (c.reorder_quantity || 0) ? 'text-amber-500 font-medium' : ''}>{c.stock}</span></span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 ml-2">{statusBadge(c.stock, c.reorder_quantity)}</div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* Stock balance card when item selected */}
              {selectedItem && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-800">{selectedItem.name}</span>
                    {statusBadge(selectedItem.stock, selectedItem.reorder_quantity)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-gray-400">Category:</span> <span className="text-gray-600">{selectedItem.category_name || '—'}</span></div>
                    <div><span className="text-gray-400">Unit:</span> <span className="text-gray-600">{selectedItem.unit}</span></div>
                    <div><span className="text-gray-400">In Stock:</span> <span className={`font-medium ${selectedItem.stock === 0 ? 'text-red-500' : selectedItem.stock <= (selectedItem.reorder_quantity || 0) ? 'text-amber-500' : 'text-green-600'}`}>{selectedItem.stock}</span></div>
                  </div>
                  {selectedItem.description && <p className="text-xs text-gray-400 mt-2 border-t border-gray-200 pt-2">{selectedItem.description}</p>}
                </div>
              )}
            </div>
          ) : (
            <div><label className="label">Name *</label><input className="input" value={form.name} onChange={f('name')} /></div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Category *</label>
              <input className="input" list="category-list" value={form.category_id} onChange={f('category_id')} placeholder="Type or select..." />
              <datalist id="category-list">
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </datalist>
            </div>
            <div><label className="label">Unit *</label>
              <input className="input" list="unit-list" value={form.unit} onChange={f('unit')} placeholder="Type or select..." />
              <datalist id="unit-list">
                {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
              </datalist>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {modal === 'add' && <div><label className="label">In Stock</label><div className="input bg-gray-100 text-gray-700">{selectedItem ? selectedItem.stock : 0}</div></div>}
            <div>
              <label className="label flex items-center gap-1">Reorder Quantity <span className="text-xs text-gray-400">(must be {'<'} stock)</span></label>
              <input className={`input ${formError ? 'border-red-500' : ''}`} type="number" min="0" value={form.reorder_quantity} onChange={(e) => { setFormError(''); f('reorder_quantity')(e); }} />
              {formError && <p className="text-red-600 text-xs mt-1">{formError}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Batch No.</label><input className="input" placeholder="BATCH-001" value={form.batch_no} onChange={f('batch_no')} /></div>
            <div><label className="label">Expiry Date</label><input className="input" type="date" value={form.expiry_date} onChange={f('expiry_date')} /></div>
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

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirm Deletion"
        footer={<><button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button><button className="btn btn-danger" onClick={() => { deleteMut.mutate(deleteConfirm.id); setDeleteConfirm(null); }}>Delete</button></>}>
        {deleteConfirm && (
          <div className="text-center py-2">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <p className="text-sm text-gray-700 mb-1">Are you sure you want to delete</p>
            <p className="text-base font-semibold text-gray-900">{deleteConfirm.name}?</p>
            <p className="text-xs text-gray-500 mt-2">This action cannot be undone.</p>
          </div>
        )}
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
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Batch No.</label><input className="input" placeholder="BATCH-001" value={txForm.batch_no} onChange={tf('batch_no')} /></div>
            <div><label className="label">Expiry Date</label><input className="input" type="date" value={txForm.expiry_date} onChange={tf('expiry_date')} /></div>
          </div>
          <div><label className="label">Invoice / Reference No.</label><input className="input" placeholder="INV-0000" value={txForm.invoice_ref} onChange={tf('invoice_ref')} /></div>
        </div>}
      </Modal>

      {/* Import CSV Modal */}
      <ImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportCSV}
      />
    </div>
  );
}