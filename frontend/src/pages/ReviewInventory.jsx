import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../utils/api';
import HistoryPanel from '../components/HistoryPanel';
import { useAuth } from '../context/AuthContext';
import ImportModal from '../components/ImportModal';

const statusBadge = (item) => {
  const stock = item.stock || 0;
  const minStock = item.min_stock || item.reorder_quantity || 0;
  const safetyStock = item.safety_stock || 0;
  const eop = item.emergency_order_point || 0;
  if (stock === 0) return <span className="badge badge-out">Out of Stock</span>;
  if (eop > 0 && stock <= eop) return <span className="badge badge-low">Emergency</span>;
  if (safetyStock > 0 && stock <= safetyStock) return <span className="badge badge-low">Safety Level</span>;
  if (minStock > 0 && stock < minStock) return <span className="badge badge-low">Low Stock</span>;
  return <span className="badge badge-ok">Adequate</span>;
};

const stockLevelBar = (stock, maxStock) => {
  const pct = maxStock > 0 ? Math.min((stock / maxStock) * 100, 100) : 100;
  const color =
    stock === 0 ? 'bg-red-500'
    : pct <= 15 ? 'bg-red-400'
    : pct <= 30 ? 'bg-amber-400'
    : pct <= 60 ? 'bg-yellow-400'
    : 'bg-green-500';
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
    </div>
  );
};

export default function ReviewInventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [historyDate, setHistoryDate] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: () => api.get('/consumables/categories').then(r => r.data) });
  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['consumables', search, cat, historyDate],
    queryFn: () => api.get('/consumables', { params: { search, category: cat, ...(historyDate && { history_date: `${historyDate}T23:59:59` }) } }).then(r => r.data),
  });

  const items = (() => {
    if (!status) return allItems;
    const priority = (item) => {
      const stock = item.stock || 0;
      const minStock = item.min_stock || item.reorder_quantity || 0;
      const safetyStock = item.safety_stock || 0;
      const eop = item.emergency_order_point || 0;
      if (stock === 0) return 'out';
      if (eop > 0 && stock <= eop) return 'emergency';
      if (safetyStock > 0 && stock <= safetyStock) return 'safety';
      if (minStock > 0 && stock < minStock) return 'low';
      return 'ok';
    };
    return allItems.filter(item => priority(item) === status);
  })();

  const stats = {
    total: allItems.length,
    outOfStock: allItems.filter(i => (i.stock || 0) === 0).length,
    lowStock: allItems.filter(i => {
      const stock = i.stock || 0;
      const minStock = i.min_stock || i.reorder_quantity || 0;
      return stock > 0 && minStock > 0 && stock < minStock;
    }).length,
    adequate: allItems.filter(i => {
      const stock = i.stock || 0;
      const minStock = i.min_stock || i.reorder_quantity || 0;
      return stock >= minStock;
    }).length,
  };

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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-green-800 dark:text-green-300">Review Inventory</h1>
          <p className="text-sm text-green-700 dark:text-green-200 mt-0.5">
            {items.length} of {allItems.length} consumables {status && `— showing "${status}" items`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button className="btn btn-secondary" onClick={() => setImportModalOpen(true)} title="Import CSV">📥 Import CSV</button>
              <button className="btn btn-secondary" onClick={handleExport} disabled={exporting} title="Export to Excel">
                {exporting ? '⏳ Exporting...' : '📤 Export Excel'}
              </button>
            </>
          )}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
            <button
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-teal-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => setViewMode('table')}
            >
              📋 Table
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'cards' ? 'bg-teal-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              onClick={() => setViewMode('cards')}
            >
              🃏 Cards
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Items</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats.total}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-4 shadow-sm">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">Out of Stock</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">{stats.outOfStock}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4 shadow-sm">
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Low Stock</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{stats.lowStock}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-4 shadow-sm">
          <p className="text-xs font-semibold text-green-500 uppercase tracking-wider">Adequate</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">{stats.adequate}</p>
        </div>
      </div>

      {/* Filters */}
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
          <option value="safety">Safety Level</option>
          <option value="emergency">Emergency</option>
          <option value="out">Out of Stock</option>
        </select>
        <input type="date" className="input w-44" value={historyDate} onChange={e => setHistoryDate(e.target.value)} title="Filter inventory as of this date" />
        {historyDate && <button className="btn btn-sm btn-secondary" onClick={() => setHistoryDate('')}>Clear</button>}
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-green-700">
                  {['SKU', 'Name', 'Category', 'Unit', 'Stock', 'Min', 'Max', 'Safety', 'Reorder', 'Avg/Mo', 'Status', 'Stock Level'].map(h => (
                    <th key={h} className="table-th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={12} className="table-td text-center py-10 text-gray-400">Loading...</td></tr>
                ) : items.length ? items.map((item, idx) => (
                  <tr key={item.id} className={`hover:bg-green-100 dark:hover:bg-green-900/40 hover:shadow-sm hover:border-l-4 hover:border-l-green-600 transition-all duration-150 ${idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/50 dark:bg-gray-700/60'}`}>
                    <td className="table-td text-xs text-gray-500 font-mono">{item.sku || '—'}</td>
                    <td className="table-td font-medium">{item.name}</td>
                    <td className="table-td"><span className="badge badge-cat">{item.category_name}</span></td>
                    <td className="table-td text-gray-500">{item.unit}</td>
                    <td className="table-td font-semibold">{item.stock}</td>
                    <td className="table-td text-gray-500">{item.min_stock || '—'}</td>
                    <td className="table-td text-gray-500">{item.max_stock || '—'}</td>
                    <td className="table-td text-gray-500">{item.safety_stock || '—'}</td>
                    <td className="table-td text-gray-500">{item.reorder_quantity}</td>
                    <td className="table-td text-gray-500">{item.avg_consumption || '—'}</td>
                    <td className="table-td">{statusBadge(item)}</td>
                    <td className="table-td w-32">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500">{item.stock}/{item.max_stock || '—'}</span>
                        {stockLevelBar(item.stock, item.max_stock)}
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={12} className="table-td text-center py-10 text-gray-400">No consumables found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Card View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full text-center py-10 text-gray-400">Loading...</div>
          ) : items.length ? items.map(item => (
            <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{item.name}</h3>
                  <p className="text-xs text-gray-400">{item.sku || 'No SKU'} · {item.category_name}</p>
                </div>
                {statusBadge(item)}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div><span className="text-gray-400">Stock:</span> <span className="font-bold text-gray-800 dark:text-gray-200">{item.stock} {item.unit}</span></div>
                <div><span className="text-gray-400">Min:</span> <span className="text-gray-600 dark:text-gray-300">{item.min_stock || '—'}</span></div>
                <div><span className="text-gray-400">Max:</span> <span className="text-gray-600 dark:text-gray-300">{item.max_stock || '—'}</span></div>
                <div><span className="text-gray-400">Safety:</span> <span className="text-gray-600 dark:text-gray-300">{item.safety_stock || '—'}</span></div>
                <div><span className="text-gray-400">Reorder:</span> <span className="text-gray-600 dark:text-gray-300">{item.reorder_quantity}</span></div>
                <div><span className="text-gray-400">Avg/Mo:</span> <span className="text-gray-600 dark:text-gray-300">{item.avg_consumption || '—'}</span></div>
              </div>
              {stockLevelBar(item.stock, item.max_stock)}
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-gray-500">{item.stock}/{item.max_stock || '—'} {item.unit}</span>
              </div>
            </div>
          )) : <div className="col-span-full text-center py-10 text-gray-400">No consumables found</div>}
        </div>
      )}

      {/* Import CSV Modal */}
      <ImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportCSV}
      />

      {/* History */}
      <div className="mt-8">
        <HistoryPanel entityType="consumable" title="Inventory Activity History" />
      </div>
    </div>
  );
}