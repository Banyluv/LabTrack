import { useState, useEffect } from 'react';
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
  created: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  updated: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  deleted: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  received: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  dispatched: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  approved: { bg: 'bg-teal-50', text: 'text-teal-700', dot: 'bg-teal-500' },
  rejected: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  transferred: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  procured: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
};

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (isToday) return `Today at ${time}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ` at ${time}`;
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(dateStr);
}

export default function HistoryPanel({ entityType, entityId, title = 'Activity History' }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!entityType) return;

    // If entityId is provided, fetch history for that specific entity
    // Otherwise fetch all activities of that entity type
    const url = entityId
      ? `/activities/${entityType}/${entityId}`
      : `/activities/${entityType}`;

    setLoading(true);
    api
      .get(url)
      .then((res) => {
        // entity-specific endpoint returns an array, type endpoint returns { logs, total }
        if (entityId) {
          setLogs(res.data || []);
          setTotal((res.data || []).length);
        } else {
          setLogs(res.data?.logs || []);
          setTotal(res.data?.total || 0);
        }
      })
      .catch(() => {
        setLogs([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  if (!entityType) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {logs.length} {logs.length === 1 ? 'event' : 'events'}
        </span>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="py-8 text-center text-gray-400 text-sm">No activity recorded yet.</div>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <ul className="divide-y divide-gray-50">
            {logs.map((log, idx) => {
              const colors = ACTION_COLORS[log.action] || { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' };
              const isExpanded = expanded === log.id;
              return (
                <li key={log.id || idx}>
                  <button
                    onClick={() => setExpanded(isExpanded ? null : log.id)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-start gap-3"
                  >
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                        <span className="text-sm text-gray-800 truncate">{log.details}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span>{log.performed_by || 'Unknown'}</span>
                        <span>·</span>
                        <span title={formatDate(log.created_at)}>{formatTimeAgo(log.created_at)}</span>
                      </div>
                      {isExpanded && log.changes && typeof log.changes === 'object' && Object.keys(log.changes).length > 0 && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono text-gray-600 max-h-32 overflow-y-auto">
                          <pre className="whitespace-pre-wrap break-all">
                            {JSON.stringify(log.changes, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}