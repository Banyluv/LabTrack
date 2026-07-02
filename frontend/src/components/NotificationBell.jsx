import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function NotificationBell({ inDropdown = false }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const [listRes, countRes] = await Promise.all([
        api.get('/notifications?limit=10'),
        api.get('/notifications/unread-count'),
      ]);
      const list = listRes.data?.notifications || [];
      setNotifications(list);
      setUnreadCount(countRes.data?.unread_count || 0);
    } catch (err) {
      // Silently fail - notifications are non-critical
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleToggle = () => {
    if (!open) {
      fetchNotifications();
    }
    setOpen(prev => !prev);
  };

  const markAsRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      // silently fail
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {
      // silently fail
    }
  };

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      markAsRead(notif.id);
    }
    setOpen(false);
    // Use the link from the notification data, or infer from type
    const link = notif.link || notif.data?.link;
    if (link) {
      navigate(link);
      return;
    }
    const type = (notif.type || '').toLowerCase();
    if (type.includes('request_created')) {
      navigate('/dashboard/requests');
    } else if (type.includes('request_approved') || type.includes('request_rejected')) {
      navigate('/dashboard/requests');
    } else if (type.includes('receive') || type.includes('stock_in')) {
      navigate('/dashboard/receive');
    } else if (type.includes('dispatch') || type.includes('stock_out')) {
      navigate('/dashboard/dispatch');
    } else if (type.includes('transfer')) {
      navigate('/dashboard/stock-transfer');
    } else if (type.includes('procurement')) {
      navigate('/dashboard/procurement');
    } else if (type.includes('adjust')) {
      navigate('/dashboard/stock-adjustments');
    } else {
      navigate('/dashboard/activity-log');
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getIcon = (notif) => {
    const type = (notif.type || '').toLowerCase();
    if (type.includes('request_created') || type.includes('request')) {
      return (
        <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
      );
    }
    if (type.includes('receive') || type.includes('stock_in')) {
      return (
        <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
        </svg>
      );
    }
    if (type.includes('dispatch') || type.includes('stock_out')) {
      return (
        <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
        </svg>
      );
    }
    if (type.includes('transfer')) {
      return (
        <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
        </svg>
      );
    }
    if (type.includes('adjust')) {
      return (
        <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      );
    }
    if (type.includes('procurement')) {
      return (
        <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"/>
        </svg>
      );
    }
    if (type.includes('approved')) {
      return (
        <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M5 13l4 4L19 7"/>
        </svg>
      );
    }
    if (type.includes('rejected')) {
      return (
        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M6 18L18 6M6 6l12 12"/>
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {!inDropdown && (
        <button
          onClick={handleToggle}
          className="relative p-2.5 rounded-xl bg-emerald-700 text-white shadow-lg ring-2 ring-emerald-500/30 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
          title="Notifications"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-[20px] px-1 text-[10px] font-black text-white bg-red-600 rounded-full ring-2 ring-white dark:ring-gray-800 shadow-md">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Dropdown (when standalone) */}
      {!inDropdown && open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => { navigate('/dashboard/activity-log'); setOpen(false); }}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium"
              >
                View all
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-80">
            {loading && notifications.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <svg className="animate-spin w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                <svg className="w-8 h-8 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                <p className="text-xs">No notifications yet</p>
              </div>
            )}

            {notifications.map((notif, idx) => (
              <button
                key={notif.id || idx}
                onClick={() => handleNotificationClick(notif)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                  notif.is_read === false
                    ? 'bg-green-50 dark:bg-green-900/10 hover:bg-green-100 dark:hover:bg-green-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getIcon(notif)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {notif.title && (
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {notif.title}
                      </p>
                    )}
                    {notif.is_read === false && (
                      <span className="flex-shrink-0 w-2 h-2 bg-green-700 rounded-full" />
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-200 line-clamp-2">
                    {notif.message || notif.description || 'Notification'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatTime(notif.created_at || notif.createdAt)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Inline list (when inside a dropdown) */}
      {inDropdown && (
        <div className="py-1">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notifications</h4>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </div>

          {/* List */}
          <div className="max-h-60 overflow-y-auto">
            {loading && notifications.length === 0 && (
              <div className="flex items-center justify-center py-4">
                <svg className="animate-spin w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="text-center py-3 text-gray-400 dark:text-gray-500 text-xs">
                No notifications yet
              </div>
            )}

            {notifications.map((notif, idx) => (
              <button
                key={notif.id || idx}
                onClick={() => handleNotificationClick(notif)}
                className={`w-full flex items-start gap-2.5 px-4 py-2 text-left transition-colors ${
                  notif.is_read === false
                    ? 'bg-green-50 dark:bg-green-900/10 hover:bg-green-100 dark:hover:bg-green-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">{getIcon(notif)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {notif.title && (
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {notif.title}
                      </p>
                    )}
                    {notif.is_read === false && (
                      <span className="flex-shrink-0 w-1.5 h-1.5 bg-green-700 rounded-full" />
                    )}
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-200 line-clamp-2">
                    {notif.message || 'Notification'}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {formatTime(notif.created_at || notif.createdAt)}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <button
            onClick={() => { navigate('/dashboard/activity-log'); }}
            className="w-full text-center text-xs text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium py-2 border-t border-gray-100 dark:border-gray-700"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}