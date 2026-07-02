import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const ACTION_LABELS = {
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
  received: 'Received',
  dispatched: 'Dispatched',
  approved: 'Approved',
  rejected: 'Rejected',
  transferred: 'Transferred',
  procured: 'Procured',
};

const ACTION_COLORS = {
  created: { bg: 'bg-green-50', text: 'text-green-700' },
  updated: { bg: 'bg-blue-50', text: 'text-blue-700' },
  deleted: { bg: 'bg-red-50', text: 'text-red-700' },
  received: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  dispatched: { bg: 'bg-orange-50', text: 'text-orange-700' },
  approved: { bg: 'bg-teal-50', text: 'text-teal-700' },
  rejected: { bg: 'bg-rose-50', text: 'text-rose-700' },
  transferred: { bg: 'bg-purple-50', text: 'text-purple-700' },
  procured: { bg: 'bg-amber-50', text: 'text-amber-700' },
};

const ENTITY_LABELS = {
  consumable: 'Consumable',
  request: 'Request',
  dispatch: 'Dispatch',
  receive: 'Receive',
  stock_transfer: 'Stock Transfer',
  procurement: 'Procurement',
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entityTypes, setEntityTypes] = useState([]);
  const [filters, setFilters] = useState({
    entity_type: '',
    action: '',
    search: '',
    from: '',
    to: '',
  });
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 });
  const [expanded, setExpanded] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.entity_type) params.append('entity_type', filters.entity_type);
      if (filters.action) params.append('action', filters.action);
      if (filters.search) params.append('search', filters.search);
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      params.append('limit', pagination.limit);
      params.append('offset', pagination.offset);

      const res = await api.get(`/activities?${params.toString()}`);
      setLogs(res.data.logs || []);
      setTotal(res.data.total || 0);
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination]);

  useEffect(() => {
    api.get('/activities/types')
      .then((res) => setEntityTypes(res.data || []))
      .catch(() => setEntityTypes([]));
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Activity Log</h1>
        <p className="text-sm text-gray-500 mt-1">Track everything happening across the system</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Entity Type</label>
            <select
              value={filters.entity_type}
              onChange={(e) => { setFilters((f) => ({ ...f, entity_type: e.target.value })); setPagination((p) => ({ ...p, offset: 0 })); }}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
            >
              <option value="">All</option>
              {entityTypes.map((t) => (
                <option key={t.entity_type} value={t.entity_type}>
                  {ENTITY_LABELS[t.entity_type] || t.entity_type} ({t.count})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
            <select
              value={filters.action}
              onChange={(e) => { setFilters((f) => ({ ...f, action: e.target.value })); setPagination((p) => ({ ...p, offset: 0 })); }}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
            >
              <option value="">All</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by details or user..."
              value={filters.search}
              onChange={(e) => { setFilters((f) => ({ ...f, search: e.target.value })); }}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => { setFilters((f) => ({ ...f, from: e.target.value })); setPagination((p) => ({ ...p, offset: 0 })); }}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => { setFilters((f) => ({ ...f, to: e.target.value })); setPagination((p) => ({ ...p, offset: 0 })); }}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
            />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={fetchLogs}
            className="text-sm bg-green-600 text-white px-4 py-1.5 rounded hover:bg-green-700 transition-colors"
          >
            Apply Filters
          </button>
          <span className="text-xs text-gray-400">{total} total records</span>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading activity log...</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No activities found.</div>
        ) : (
          <>
            <ul className="divide-y divide-gray-50">
              {logs.map((log, idx) => {
                const colors = ACTION_COLORS[log.action] || { bg: 'bg-gray-50', text: 'text-gray-600' };
                const isExpanded = expanded === log.id;
                return (
                  <li key={log.id || idx}>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : log.id)}
                      className="w-full text-left px-5 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          log.action === 'created' ? 'bg-green-500' :
                          log.action === 'deleted' ? 'bg-red-500' :
                          log.action === 'approved' ? 'bg-teal-500' :
                          log.action === 'rejected' ? 'bg-rose-500' :
                          log.action === 'received' ? 'bg-emerald-500' :
                          log.action === 'dispatched' ? 'bg-orange-500' :
                          log.action === 'transferred' ? 'bg-purple-500' :
                          log.action === 'procured' ? 'bg-amber-500' :
                          'bg-blue-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                              {ACTION_LABELS[log.action] || log.action}
                            </span>
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {ENTITY_LABELS[log.entity_type] || log.entity_type} #{log.entity_id}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{log.details}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                            <span className="font-medium text-gray-500">{log.performed_by || 'System'}</span>
                            <span>{formatDate(log.created_at)}</span>
                          </div>
                          {isExpanded && log.changes && typeof log.changes === 'object' && Object.keys(log.changes).length > 0 && (
                            <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono text-gray-600 max-h-40 overflow-y-auto">
                              <pre className="whitespace-pre-wrap break-all">
                                {JSON.stringify(log.changes, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <button
                  disabled={pagination.offset === 0}
                  onClick={() => setPagination((p) => ({ ...p, offset: Math.max(0, p.offset - p.limit) }))}
                  className="text-sm text-green-600 disabled:text-gray-300 disabled:cursor-not-allowed hover:text-green-800"
                >
                  ← Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={pagination.offset + pagination.limit >= total}
                  onClick={() => setPagination((p) => ({ ...p, offset: p.offset + p.limit }))}
                  className="text-sm text-green-600 disabled:text-gray-300 disabled:cursor-not-allowed hover:text-green-800"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}