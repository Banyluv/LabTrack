import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../utils/api';
import Modal from '../components/Modal';
import HistoryPanel from '../components/HistoryPanel';
import ExportButton from '../components/ExportButton';
import FieldLabel from '../components/FieldLabel';
import SearchableSelect from '../components/SearchableSelect';

export default function ReceivePage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ consumable_id: '', quantity: '', supplier: '', received_by: '', invoice_ref: '', batch_no: '', expiry_date: '', grn: '', ordered_by: '', approved_by: '', damaged_quantity: '', returned_quantity: '' });
  const [filters, setFilters] = useState({ from: '', to: '' });

  const { data: items = [] } = useQuery({ queryKey: ['consumables-all'], queryFn: () => api.get('/consumables', { params: { all: 'true' } }).then(r => r.data) });
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Receive Stock</h1>
          <p className="text-sm text-gray-500">{logs.length} records</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <ExportButton label="Export Received Stock" endpoint="/receive/export" fileName="received-stock.xlsx" />
          <button className="btn btn-primary" onClick={() => setModal(true)}>+ Receive Stock</button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input type="date" className="input w-40" value={filters.from} onChange={e => setFilters(p => ({ ...p, from: e.target.value }))} />
        <input type="date" className="input w-40" value={filters.to} onChange={e => setFilters(p => ({ ...p, to: e.target.value }))} />
        <button className="btn btn-secondary" onClick={() => setFilters({ from: '', to: '' })}>Clear</button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              {['Date & Time','Consumable','Category','Qty Received','Supplier','Received By','Batch No.','Expiry Date','Invoice Ref'].map(h => <th key={h} className="table-th">{h}</th>)}
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={9} className="table-td text-center py-10 text-gray-400">Loading...</td></tr>
               : logs.length ? logs.map(log => (
                <tr key={log.id} className="hover:bg-emerald-50 dark:hover:bg-emerald-700/30 transition-colors">
                  <td className="table-td text-xs text-gray-500 dark:text-gray-300 whitespace-nowrap">{format(new Date(log.received_at), 'MMM d yyyy, h:mm a')}</td>
                  <td className="table-td font-medium text-gray-900 dark:text-gray-100">{log.consumable_name}</td>
                  <td className="table-td"><span className="badge badge-cat">{log.category_name}</span></td>
                  <td className="table-td font-semibold text-green-600 dark:text-green-300">+{log.quantity}</td>
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

      <div className="mt-8">
        <HistoryPanel entityType="receive" title="Receive Activity History" />
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Receive Stock from Store"
        footer={<><button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit}>Confirm Receipt</button></>}>
        <div className="space-y-4">
          <div>
            <FieldLabel label="Consumable" tip="Select the item you are receiving into stock. Current stock levels are shown for reference." required />
            <SearchableSelect
              options={items.map(i => ({ value: i.id, label: `${i.name} (Current: ${i.stock})` }))}
              value={form.consumable_id}
              onChange={v => setForm(p => ({ ...p, consumable_id: v }))}
              placeholder="Search & select consumable..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel label="Quantity" tip="Number of units being received. Must be a positive number." required /><input className="input" type="number" min="1" value={form.quantity} onChange={f('quantity')} /></div>
            <div><FieldLabel label="Supplier" tip="The vendor, manufacturer, or organisation that supplied the items." /><input className="input" placeholder="Supplier name" value={form.supplier} onChange={f('supplier')} /></div>
          </div>
          <div><FieldLabel label="Received By" tip="The staff member who received and checked the goods against the delivery note." required /><input className="input" placeholder="Staff name" value={form.received_by} onChange={f('received_by')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel label="Batch No." tip="The manufacturer or supplier batch/lot number for traceability." /><input className="input" placeholder="BATCH-001" value={form.batch_no} onChange={f('batch_no')} /></div>
            <div><FieldLabel label="Expiry Date" tip="The date after which this consumable should not be used. Helps manage stock rotation." /><input className="input" type="date" value={form.expiry_date} onChange={f('expiry_date')} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><FieldLabel label="GRN" tip="Goods Received Note number — a document that confirms receipt of goods for auditing." /><input className="input" placeholder="GRN-0001" value={form.grn} onChange={f('grn')} /></div>
            <div><FieldLabel label="Ordered By" tip="The person who placed the original order with the supplier." /><input className="input" placeholder="Officer name" value={form.ordered_by} onChange={f('ordered_by')} /></div>
            <div><FieldLabel label="Approved By" tip="The person who authorised the procurement or receipt of these goods." /><input className="input" placeholder="Approver name" value={form.approved_by} onChange={f('approved_by')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><FieldLabel label="Damaged Quantity" tip="Quantity found damaged, expired, or unusable upon receipt. These are recorded but not added to usable stock." /><input className="input" type="number" min="0" value={form.damaged_quantity} onChange={f('damaged_quantity')} /></div>
            <div><FieldLabel label="Returned Quantity" tip="Quantity returned to the supplier instead of being accepted." /><input className="input" type="number" min="0" value={form.returned_quantity} onChange={f('returned_quantity')} /></div>
          </div>
          <div><FieldLabel label="Invoice / Reference No." tip="Invoice, waybill, or delivery note number for auditing and record-keeping." /><input className="input" placeholder="INV-0000" value={form.invoice_ref} onChange={f('invoice_ref')} /></div>
        </div>
      </Modal>
    </div>
  );
}
