import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../utils/api';
import HistoryPanel from '../components/HistoryPanel';
import ExportButton from '../components/ExportButton';

export default function StockTransfer() {
  const [fromFacility, setFromFacility] = useState('');
  const [toFacility, setToFacility] = useState('');
  const [consumableId, setConsumableId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [transferBy, setTransferBy] = useState('');
  const [receivedBy, setReceivedBy] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: facilities = [] } = useQuery({
    queryKey: ['facilities-list'],
    queryFn: () => api.get('/facilities').then(r => r.data),
  });

  const { data: consumables = [] } = useQuery({
    queryKey: ['consumables-list'],
    queryFn: () => api.get('/consumables').then(r => r.data),
  });

  const { data: transfers = [], refetch } = useQuery({
    queryKey: ['stock-transfers'],
    queryFn: () => api.get('/transfers').then(r => r.data),
  });

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!fromFacility || !toFacility || !consumableId || !quantity) {
      toast.error('All fields are required');
      return;
    }
    if (fromFacility === toFacility) {
      toast.error('Source and destination must be different');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/transfers', {
        fromFacilityId: fromFacility,
        toFacilityId: toFacility,
        consumableId,
        quantity: Number(quantity),
        transferred_by: transferBy || '',
        received_by: receivedBy || '',
        approved_by: approvedBy || '',
      });
      toast.success('Stock transferred successfully');
      setFromFacility(''); setToFacility(''); setConsumableId(''); setQuantity('');
      setTransferBy(''); setReceivedBy(''); setApprovedBy('');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedConsumable = consumables.find(c => c._id === consumableId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-green-800 dark:text-green-300">Stock Transfer</h1>
          <p className="text-sm text-green-700 dark:text-green-200 mt-0.5">Move stock between facilities</p>
        </div>
        <ExportButton label="Export Transfer History" endpoint="/transfers/export" fileName="stock-transfer-history.xlsx" />
      </div>

      <div className="card p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <form onSubmit={handleTransfer} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label dark:text-gray-300">Consumable</label>
            <select value={consumableId} onChange={e => setConsumableId(e.target.value)} className="input dark:bg-gray-700 dark:text-white dark:border-gray-500">
              <option value="">Select consumable...</option>
              {consumables.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 grid grid-cols-3 gap-3">
            <div>
              <label className="label dark:text-gray-300">Transferred By</label>
              <input className="input" value={transferBy} onChange={e => setTransferBy(e.target.value)} placeholder="Name" />
            </div>
            <div>
              <label className="label dark:text-gray-300">Received By</label>
              <input className="input" value={receivedBy} onChange={e => setReceivedBy(e.target.value)} placeholder="Name" />
            </div>
            <div>
              <label className="label dark:text-gray-300">Approved By</label>
              <input className="input" value={approvedBy} onChange={e => setApprovedBy(e.target.value)} placeholder="Name" />
            </div>
          </div>
          <div>
            <label className="label dark:text-gray-300">From Facility</label>
            <select value={fromFacility} onChange={e => setFromFacility(e.target.value)} className="input dark:bg-gray-700 dark:text-white dark:border-gray-500">
              <option value="">Select source...</option>
              {facilities.map(f => (
                <option key={f._id} value={f._id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label dark:text-gray-300">To Facility</label>
            <select value={toFacility} onChange={e => setToFacility(e.target.value)} className="input dark:bg-gray-700 dark:text-white dark:border-gray-500">
              <option value="">Select destination...</option>
              {facilities.map(f => (
                <option key={f._id} value={f._id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label dark:text-gray-300">Quantity</label>
            <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="input dark:bg-gray-700 dark:text-white dark:border-gray-500" placeholder="Enter quantity" />
            {selectedConsumable && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Unit: {selectedConsumable.unit || 'N/A'} — In stock: <span className="font-medium text-gray-700 dark:text-gray-200">{selectedConsumable.stock ?? 0}</span>
              </p>
            )}
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={submitting} className="btn btn-primary w-full">
              {submitting ? 'Transferring...' : 'Transfer Stock'}
            </button>
          </div>
        </form>
      </div>

      {/* Transfer History */}
      <div className="card p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Transfer History</h2>
        {transfers.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No transfers recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 text-gray-600 dark:text-gray-400">Date</th>
                  <th className="text-left py-2 text-gray-600 dark:text-gray-400">Consumable</th>
                  <th className="text-left py-2 text-gray-600 dark:text-gray-400">From</th>
                  <th className="text-left py-2 text-gray-600 dark:text-gray-400">To</th>
                  <th className="text-right py-2 text-gray-600 dark:text-gray-400">Qty</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map(t => (
                  <tr key={t._id} className="border-b border-gray-100 dark:border-gray-700">
                    <td className="py-2 text-gray-900 dark:text-gray-200">{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td className="py-2 text-gray-900 dark:text-gray-200">{t.consumable?.name || 'N/A'}</td>
                    <td className="py-2 text-gray-900 dark:text-gray-200">{t.fromFacility?.name || 'N/A'}</td>
                    <td className="py-2 text-gray-900 dark:text-gray-200">{t.toFacility?.name || 'N/A'}</td>
                    <td className="py-2 text-right text-gray-900 dark:text-gray-200">{t.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6">
        <HistoryPanel entityType="stock_transfer" title="Stock Transfer History" />
      </div>
    </div>
  );
}
