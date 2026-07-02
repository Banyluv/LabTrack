import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../utils/api';
import HistoryPanel from '../components/HistoryPanel';
import ExportButton from '../components/ExportButton';

export default function Procurement() {
  const qc = useQueryClient();
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ consumableId: '', quantity: '', cost: '' }]);
  const [submitting, setSubmitting] = useState(false);

  const { data: consumables = [] } = useQuery({
    queryKey: ['consumables-list'],
    queryFn: () => api.get('/consumables').then(r => r.data),
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => api.get('/suppliers').then(r => r.data),
  });

  const { data: orders = [], refetch } = useQuery({
    queryKey: ['procurement-orders'],
    queryFn: () => api.get('/procurement').then(r => r.data),
  });

  const addItem = () => {
    setItems(prev => [...prev, { consumableId: '', quantity: '', cost: '' }]);
  };

  const removeItem = (index) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supplier) {
      toast.error('Please select a supplier');
      return;
    }

    const validItems = items.filter(it => it.consumableId && it.quantity);
    if (validItems.length === 0) {
      toast.error('Please add at least one consumable with quantity');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/procurement', {
        supplierId: supplier,
        notes: notes || '',
        items: validItems.map(it => ({
          consumableId: it.consumableId,
          quantity: Number(it.quantity),
          cost: it.cost ? Number(it.cost) : 0,
        })),
      });
      toast.success('Procurement order created');
      setSupplier('');
      setNotes('');
      setItems([{ consumableId: '', quantity: '', cost: '' }]);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'received': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'ordered': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-green-800 dark:text-green-300">Procurement</h1>
          <p className="text-sm text-green-700 dark:text-green-200 mt-0.5">Manage purchase orders and supplier sourcing</p>
        </div>
        <ExportButton label="Export Procurements" endpoint="/procurement/export" fileName="procurement-orders.xlsx" />
      </div>

      <div className="card p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">New Purchase Order</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label dark:text-gray-300">Supplier *</label>
            <select value={supplier} onChange={e => setSupplier(e.target.value)} className="input dark:bg-gray-700 dark:text-white dark:border-gray-500">
              <option value="">Select supplier...</option>
              {suppliers.map(s => (
                <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Items Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label dark:text-gray-300 mb-0">Consumable Items *</label>
              <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 font-medium">
                + Add Item
              </button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 dark:bg-gray-750 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="col-span-5">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Consumable</label>
                    <select
                      value={item.consumableId}
                      onChange={e => updateItem(index, 'consumableId', e.target.value)}
                      className="input w-full text-sm dark:bg-gray-700 dark:text-white dark:border-gray-500"
                    >
                      <option value="">Select...</option>
                      {consumables.map(c => (
                        <option key={c._id || c.id} value={c._id || c.id}>
                          {c.name} (Stock: {c.stock ?? 0})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={e => updateItem(index, 'quantity', e.target.value)}
                      className="input w-full text-sm dark:bg-gray-700 dark:text-white dark:border-gray-500"
                      placeholder="Qty"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Cost (₦)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.cost}
                      onChange={e => updateItem(index, 'cost', e.target.value)}
                      className="input w-full text-sm dark:bg-gray-700 dark:text-white dark:border-gray-500"
                      placeholder="Optional"
                    />
                  </div>
                  <div className="col-span-1 flex items-end pt-5">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 text-lg font-bold leading-none"
                      title="Remove item"
                      disabled={items.length <= 1}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {items.length > 1 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{items.length} items in this order</p>
            )}
          </div>

          <div>
            <label className="label dark:text-gray-300">Order Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input w-full dark:bg-gray-700 dark:text-white dark:border-gray-500"
              rows={2}
              placeholder="Optional notes about this order..."
            />
          </div>

          <div>
            <button type="submit" disabled={submitting} className="btn btn-primary w-full">
              {submitting ? 'Creating...' : 'Create Purchase Order'}
            </button>
          </div>
        </form>
      </div>

      {/* Purchase Orders History */}
      <div className="card p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Purchase Orders</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No purchase orders yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-gray-600 dark:text-gray-400">Order #</th>
                  <th className="text-left py-2 text-gray-600 dark:text-gray-400">Date</th>
                  <th className="text-left py-2 text-gray-600 dark:text-gray-400">Supplier</th>
                  <th className="text-left py-2 text-gray-600 dark:text-gray-400">Items</th>
                  <th className="text-center py-2 text-gray-600 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const orderItems = o.items || [];
                  const totalQty = orderItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
                  const itemsSummary = orderItems.length > 0
                    ? orderItems.map(it => `${it.consumable_name || 'Unknown'} (${it.quantity})`).join(', ')
                    : 'No items';
                  return (
                    <tr key={o._id || o.id} className="border-b border-gray-100 dark:border-gray-700">
                      <td className="py-2 text-gray-900 dark:text-gray-200 font-mono text-xs">#{o.id}</td>
                      <td className="py-2 text-gray-900 dark:text-gray-200">{new Date(o.created_at || o.createdAt).toLocaleDateString()}</td>
                      <td className="py-2 text-gray-900 dark:text-gray-200">{o.supplier_name || 'N/A'}</td>
                      <td className="py-2">
                        <div className="text-gray-900 dark:text-gray-200 text-xs max-w-xs truncate" title={itemsSummary}>
                          {orderItems.length} item(s) - {totalQty} total units
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs truncate max-w-xs" title={itemsSummary}>
                          {itemsSummary}
                        </div>
                      </td>
                      <td className="py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(o.status)}`}>
                          {o.status || 'pending'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6">
        <HistoryPanel entityType="procurement" title="Procurement History" />
      </div>
    </div>
  );
}