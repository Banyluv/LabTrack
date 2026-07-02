import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInDays, addDays } from 'date-fns';
import api from '../utils/api';

export default function BatchExpiryPage() {
  const [search, setSearch] = useState('');
  const [expiryFilter, setExpiryFilter] = useState('all'); // all, expired, expiring30, expiring60, expiring90

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['receive-logs-batch'],
    queryFn: () => api.get('/receive', { params: { limit: 500 } }).then(r => r.data),
  });

  const { data: items = [] } = useQuery({
    queryKey: ['consumables-all'],
    queryFn: () => api.get('/consumables').then(r => r.data),
  });

  // Build batch records from receive logs that have batch_no or expiry_date
  const batchRecords = useMemo(() => {
    const records = logs
      .filter(log => log.batch_no || log.expiry_date)
      .map(log => {
        const expiryDate = log.expiry_date ? new Date(log.expiry_date) : null;
        const daysUntilExpiry = expiryDate ? differenceInDays(expiryDate, new Date()) : null;
        let status = 'none';
        if (expiryDate) {
          if (daysUntilExpiry < 0) status = 'expired';
          else if (daysUntilExpiry <= 30) status = 'critical';
          else if (daysUntilExpiry <= 60) status = 'warning';
          else status = 'ok';
        }
        return {
          id: log.id,
          consumable_id: log.consumable_id,
          consumable_name: log.consumable_name,
          category_name: log.category_name,
          batch_no: log.batch_no,
          expiry_date: log.expiry_date,
          expiryDate,
          daysUntilExpiry,
          status,
          quantity: log.quantity,
          supplier: log.supplier,
          received_by: log.received_by,
          received_at: log.received_at,
          invoice_ref: log.invoice_ref,
        };
      });

    // Also include consumables that have batch_no/expiry_date but may not be in receive logs
    items.forEach(item => {
      if ((item.batch_no || item.expiry_date) && !records.find(r => r.consumable_id === item.id && r.batch_no === item.batch_no && r.expiry_date === item.expiry_date)) {
        const expiryDate = item.expiry_date ? new Date(item.expiry_date) : null;
        const daysUntilExpiry = expiryDate ? differenceInDays(expiryDate, new Date()) : null;
        let status = 'none';
        if (expiryDate) {
          if (daysUntilExpiry < 0) status = 'expired';
          else if (daysUntilExpiry <= 30) status = 'critical';
          else if (daysUntilExpiry <= 60) status = 'warning';
          else status = 'ok';
        }
        records.push({
          id: `c-${item.id}`,
          consumable_id: item.id,
          consumable_name: item.name,
          category_name: item.category_name,
          batch_no: item.batch_no,
          expiry_date: item.expiry_date,
          expiryDate,
          daysUntilExpiry,
          status,
          quantity: 0,
          supplier: '',
          received_by: '',
          received_at: item.updated_at || item.created_at,
          invoice_ref: '',
        });
      }
    });

    return records;
  }, [logs, items]);

  const filteredRecords = useMemo(() => {
    let records = batchRecords;
    if (search) {
      const s = search.toLowerCase();
      records = records.filter(r =>
        (r.consumable_name && r.consumable_name.toLowerCase().includes(s)) ||
        (r.batch_no && r.batch_no.toLowerCase().includes(s)) ||
        (r.category_name && r.category_name.toLowerCase().includes(s))
      );
    }
    if (expiryFilter !== 'all') {
      const today = new Date();
      records = records.filter(r => {
        if (!r.expiryDate) return false;
        const days = differenceInDays(r.expiryDate, today);
        switch (expiryFilter) {
          case 'expired': return days < 0;
          case 'expiring30': return days >= 0 && days <= 30;
          case 'expiring60': return days >= 31 && days <= 60;
          case 'ok': return days > 60;
          default: return true;
        }
      });
    }
    return records.sort((a, b) => {
      if (a.expiryDate && b.expiryDate) return a.expiryDate - b.expiryDate;
      if (a.expiryDate) return -1;
      if (b.expiryDate) return 1;
      return 0;
    });
  }, [batchRecords, search, expiryFilter]);

  const stats = useMemo(() => {
    const today = new Date();
    let expired = 0, critical = 0, warning = 0, ok = 0, noExpiry = 0;
    batchRecords.forEach(r => {
      if (!r.expiryDate) { noExpiry++; return; }
      const days = differenceInDays(r.expiryDate, today);
      if (days < 0) expired++;
      else if (days <= 30) critical++;
      else if (days <= 60) warning++;
      else ok++;
    });
    return { expired, critical, warning, ok, noExpiry, total: batchRecords.length };
  }, [batchRecords]);

  const getStatusBadge = (status, daysUntilExpiry) => {
    if (status === 'expired') return <span className="badge badge-out">Expired ({Math.abs(daysUntilExpiry)}d ago)</span>;
    if (status === 'critical') return <span className="badge badge-out border-red-500 text-red-700">Expires in {daysUntilExpiry}d</span>;
    if (status === 'warning') return <span className="badge badge-low">Expires in {daysUntilExpiry}d</span>;
    if (status === 'ok') return <span className="badge badge-ok">{daysUntilExpiry}d remaining</span>;
    return <span className="badge badge-cat text-xs">No expiry</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Batch & Expiry Overview</h1>
          <p className="text-sm text-gray-500">Track each batch number, expiry date, and remaining shelf life to prioritize what should be used first.</p>
        </div>
        <p className="text-sm text-gray-600 max-w-3xl">
          Use this page to find expired or soon-to-expire stock, confirm batch details, and make safer inventory decisions. Search by consumable name, batch number, or category, and filter to see only items that need immediate attention.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div className="card !p-4 text-center border-l-4 border-red-500">
          <p className="text-2xl font-bold text-red-600">{stats.expired}</p>
          <p className="text-xs text-gray-500">{stats.expired === 0 ? 'No expired batches' : 'Expired batches'}</p>
        </div>
        <div className="card !p-4 text-center border-l-4 border-orange-500">
          <p className="text-2xl font-bold text-orange-600">{stats.critical}</p>
          <p className="text-xs text-gray-500">{stats.critical === 0 ? 'No batches expiring within 30 days' : 'Expiring within 30 days'}</p>
        </div>
        <div className="card !p-4 text-center border-l-4 border-yellow-500">
          <p className="text-2xl font-bold text-yellow-600">{stats.warning}</p>
          <p className="text-xs text-gray-500">{stats.warning === 0 ? 'No batches expiring in 31-60 days' : 'Expiring within 31-60 days'}</p>
        </div>
        <div className="card !p-4 text-center border-l-4 border-green-500">
          <p className="text-2xl font-bold text-green-600">{stats.ok}</p>
          <p className="text-xs text-gray-500">{stats.ok === 0 ? 'No batches good beyond 60 days' : 'Good for more than 60 days'}</p>
        </div>
        <div className="card !p-4 text-center border-l-4 border-gray-400">
          <p className="text-2xl font-bold text-gray-500">{stats.noExpiry}</p>
          <p className="text-xs text-gray-500">Batch/expiry not set</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <input className="input flex-1 min-w-48" placeholder="Search by consumable name, batch number, or category" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input w-full lg:w-48" value={expiryFilter} onChange={e => setExpiryFilter(e.target.value)}>
          <option value="all">All batches</option>
          <option value="expired">Expired only</option>
          <option value="expiring30">Expiring within 30 days</option>
          <option value="expiring60">Expiring within 31-60 days</option>
          <option value="ok">Good for more than 60 days</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr>
              {['Consumable','Category','Batch No.','Expiry Date','Days Left','Status','Qty','Supplier','Received'].map(h => <th key={h} className="table-th">{h}</th>)}
            </tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={9} className="table-td text-center py-10 text-gray-400">Loading...</td></tr>
               : filteredRecords.length ? filteredRecords.map(rec => (
                <tr key={rec.id} className={`hover:bg-gray-50 ${rec.status === 'expired' ? 'bg-red-50/50' : rec.status === 'critical' ? 'bg-orange-50/30' : ''}`}>
                  <td className="table-td font-medium">{rec.consumable_name}</td>
                  <td className="table-td"><span className="badge badge-cat">{rec.category_name}</span></td>
                  <td className="table-td font-mono text-xs">{rec.batch_no || 'Not set'}</td>
                  <td className="table-td text-xs whitespace-nowrap">{rec.expiry_date ? format(new Date(rec.expiry_date), 'MMM d yyyy') : 'No expiry date'}</td>
                  <td className="table-td font-semibold">{rec.daysUntilExpiry !== null ? (rec.daysUntilExpiry < 0 ? <span className="text-red-600">{Math.abs(rec.daysUntilExpiry)}d past</span> : `${rec.daysUntilExpiry}d`) : '—'}</td>
                  <td className="table-td">{getStatusBadge(rec.status, rec.daysUntilExpiry)}</td>
                  <td className="table-td">{rec.quantity || 'Unknown'}</td>
                  <td className="table-td text-xs">{rec.supplier || 'Unknown'}</td>
                  <td className="table-td text-xs text-gray-500 whitespace-nowrap">{rec.received_at ? format(new Date(rec.received_at), 'MMM d yyyy') : 'Unknown'}</td>
                </tr>
              )) : <tr><td colSpan={9} className="table-td text-center py-10 text-gray-400">No batch records found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}