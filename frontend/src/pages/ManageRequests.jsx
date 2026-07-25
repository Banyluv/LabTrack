import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import DeliveryNote from '../components/DeliveryNote';
import HistoryPanel from '../components/HistoryPanel';

const getStockStatus = (stock, min_stock, safety_stock, emergency_order_point) => {
  if (stock === 0) return { label: 'Out of Stock', className: 'badge badge-out text-xs' };
  if (stock <= (emergency_order_point || 0)) return { label: 'Emergency', className: 'badge badge-out text-xs' };
  if (stock <= (safety_stock || 0)) return { label: 'Safety Stock', className: 'badge badge-low text-xs' };
  if (stock <= (min_stock || 0)) return { label: 'Low Stock', className: 'badge badge-low text-xs' };
  return { label: 'Adequate', className: 'badge badge-ok text-xs' };
};

const getStatusColor = (status) => {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
    case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
    case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

export default function ManageRequests() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Tab state: 'submit' | 'my-requests' | 'approve' (admin only)
  const [activeTab, setActiveTab] = useState(isAdmin ? 'approve' : 'submit');

  // --- Submit Request State ---
  const [consumables, setConsumables] = useState([]);
  const [selectedConsumable, setSelectedConsumable] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [requestingOfficer, setRequestingOfficer] = useState('');
  const [loadingConsumables, setLoadingConsumables] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [balance, setBalance] = useState(null);
  const [checkingBalance, setCheckingBalance] = useState(false);

  // --- My Requests State ---
  const [myRequests, setMyRequests] = useState([]);
  const [loadingMyRequests, setLoadingMyRequests] = useState(false);

  // --- Approve Requests State ---
  const [allRequests, setAllRequests] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loadingAllRequests, setLoadingAllRequests] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvedQuantity, setApprovedQuantity] = useState('');
  const [adminComment, setAdminComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [deliveryNoteRequest, setDeliveryNoteRequest] = useState(null);

  // --- Data Fetching ---
  const fetchConsumables = async () => {
    setLoadingConsumables(true);
    try {
      const { data } = await api.get('/consumables?all=true');
      setConsumables(data);
    } catch (err) {
      toast.error('Failed to fetch consumables');
    } finally {
      setLoadingConsumables(false);
    }
  };

  const fetchMyRequests = async () => {
    setLoadingMyRequests(true);
    try {
      const { data } = await api.get('/requests/my-requests');
      setMyRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMyRequests(false);
    }
  };

  const fetchAllRequests = useCallback(async () => {
    setLoadingAllRequests(true);
    try {
      const { data } = await api.get('/requests');
      if (filter === 'all') {
        setAllRequests(data);
      } else {
        setAllRequests(data.filter(r => r.status === filter));
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      toast.error('Failed to fetch requests');
    } finally {
      setLoadingAllRequests(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchConsumables();
    fetchMyRequests();
  }, []);

  useEffect(() => {
    if (isAdmin) fetchAllRequests();
  }, [fetchAllRequests, isAdmin]);

  // Refresh my requests when tab switches
  useEffect(() => {
    if (activeTab === 'my-requests') fetchMyRequests();
    if (activeTab === 'approve') fetchAllRequests();
  }, [activeTab]);

  // --- Submit Handlers ---
  const handleSelect = async (c) => {
    setSelectedConsumable(c.id);
    setSelectedItem(c);
    setBalance(null);
    setCheckingBalance(true);
    try {
      const { data } = await api.get(`/balance/check/${c.id}`);
      setBalance(data);
    } catch (err) {
      console.error('Balance check failed:', err);
      setBalance(null);
    } finally {
      setCheckingBalance(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedConsumable || !quantity) {
      toast.error('Please select a consumable and quantity');
      return;
    }
    if (balance && !balance.allowed) {
      toast.error(balance.reason || 'Cannot request — previous dispatch not yet fully accounted for in daily usage.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/requests', {
        consumable_id: selectedConsumable,
        quantity: parseInt(quantity),
        notes,
        requesting_officer: requestingOfficer
      });
      toast.success('Request submitted successfully!');
      setSelectedConsumable('');
      setSelectedItem(null);
      setQuantity('');
      setNotes('');
      setRequestingOfficer('');
      setBalance(null);
      fetchMyRequests();
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.code === 'BALANCE_NOT_SETTLED') {
        toast.error(errData.error || 'Cannot request — balance not settled.', { duration: 6000 });
      } else {
        toast.error(errData?.error || 'Failed to submit request');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // --- Approve Handlers ---
  const handleSelectRequest = (req) => {
    setSelectedRequest(req);
    setApprovalNotes('');
    setApprovedQuantity(Math.min(req.quantity, req.consumable_stock ?? req.quantity));
    setAdminComment('');
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      const qty = approvedQuantity !== '' ? parseInt(approvedQuantity) : selectedRequest.quantity;
      if (isNaN(qty) || qty <= 0) {
        toast.error('Quantity must be a positive number');
        setActionLoading(false);
        return;
      }
      if (qty > (selectedRequest.consumable_stock ?? 0)) {
        toast.error(`Insufficient stock. Available: ${selectedRequest.consumable_stock}`);
        setActionLoading(false);
        return;
      }
      await api.put(`/requests/${selectedRequest.id}/approve`, {
        notes: approvalNotes,
        approved_quantity: qty,
        admin_comment: adminComment,
      });
      toast.success('Request approved!');
      toast('📧 Email notification sent to staff', { icon: '📬' });
      setSelectedRequest(null);
      setApprovalNotes('');
      setApprovedQuantity('');
      setAdminComment('');
      fetchAllRequests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      await api.put(`/requests/${selectedRequest.id}/reject`, {
        notes: approvalNotes,
        admin_comment: adminComment,
      });
      toast.success('Request rejected');
      toast('📧 Email notification sent to staff', { icon: '📬' });
      setSelectedRequest(null);
      setApprovalNotes('');
      setApprovedQuantity('');
      setAdminComment('');
      fetchAllRequests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject request');
    } finally {
      setActionLoading(false);
    }
  };

  const tabs = [
    { key: 'submit', label: 'New Request', icon: '📝', roles: ['admin', 'super_admin', 'staff'] },
    { key: 'my-requests', label: 'My Requests', icon: '📋', roles: ['admin', 'super_admin', 'staff'] },
    ...(isAdmin ? [{ key: 'approve', label: 'Approve / Review', icon: '✅', roles: ['admin', 'super_admin'] }] : []),
  ];

  const filteredTabs = tabs.filter(t => t.roles.some(r => r === user?.role));

  const pendingCount = allRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Manage Requests</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isAdmin ? 'Submit, review, and approve consumable requests' : 'Submit and track your consumable requests'}
          </p>
        </div>
        {isAdmin && (
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-3 rounded-xl font-semibold shadow-lg">
            Pending: <span className="text-lg">{pendingCount}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b-2 border-gray-200 dark:border-gray-700 pb-0">
        {filteredTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 font-medium rounded-t-lg transition-all ${
              activeTab === tab.key
                ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md -mb-[2px]'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'submit' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Submit Form */}
          <div className="lg:col-span-1">
            <div className="card p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">New Request</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label dark:text-gray-300">Select Consumable</label>
                  <select
                    className="input dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                    value={selectedConsumable}
                    onChange={(e) => {
                      const id = e.target.value;
                      const item = consumables.find(c => c.id.toString() === id);
                      if (item) handleSelect(item);
                      else { setSelectedConsumable(''); setSelectedItem(null); }
                    }}
                    disabled={loadingConsumables}
                  >
                    <option value="">-- Choose a consumable --</option>
                    {consumables.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.unit}) - Stock: {c.stock} | {c.category_name || 'N/A'}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedItem && (
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{selectedItem.name}</span>
                      {(() => {
                        const s = getStockStatus(selectedItem.stock, selectedItem.min_stock, selectedItem.safety_stock, selectedItem.emergency_order_point);
                        return <span className={s.className}>{s.label}</span>;
                      })()}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-gray-400 dark:text-gray-500">Category:</span><span className="ml-1 text-gray-600 dark:text-gray-300">{selectedItem.category_name || '—'}</span></div>
                      <div><span className="text-gray-400 dark:text-gray-500">Unit:</span><span className="ml-1 text-gray-600 dark:text-gray-300">{selectedItem.unit}</span></div>
                      <div><span className="text-gray-400 dark:text-gray-500">In Stock:</span><span className={`ml-1 font-medium ${selectedItem.stock === 0 ? 'text-red-500' : selectedItem.stock <= (selectedItem.emergency_order_point || 0) ? 'text-red-500' : selectedItem.stock <= (selectedItem.safety_stock || 0) ? 'text-amber-500' : selectedItem.stock <= (selectedItem.min_stock || 0) ? 'text-amber-500' : 'text-green-600 dark:text-green-400'}`}>{selectedItem.stock}</span></div>
                      <div><span className="text-gray-400 dark:text-gray-500">Min Stock:</span><span className="ml-1 text-gray-600 dark:text-gray-300">{selectedItem.min_stock || 0}</span></div>
                    </div>

                    {checkingBalance ? (
                      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600 flex items-center gap-2 text-xs text-gray-400">
                        <div className="w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                        Checking balance...
                      </div>
                    ) : balance ? (
                      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                        <div className={`rounded-md p-2 text-xs ${balance.allowed ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-2 h-2 rounded-full ${balance.allowed ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className={`font-semibold ${balance.allowed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                              {balance.allowed ? 'Eligible to Request' : 'Not Eligible'}
                            </span>
                          </div>
                          {balance.balance && (
                            <div className="space-y-0.5 text-gray-600 dark:text-gray-400">
                              <div className="flex justify-between">
                                <span>Dispatched:</span>
                                <span className="font-medium">{balance.balance.total_dispatched} {selectedItem.unit}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Used:</span>
                                <span className="font-medium">{balance.balance.total_used} {selectedItem.unit}</span>
                              </div>
                              <div className="flex justify-between border-t border-gray-300 dark:border-gray-600 pt-0.5">
                                <span className="font-semibold">Balance:</span>
                                <span className={`font-bold ${balance.balance.balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>{balance.balance.balance} {selectedItem.unit}</span>
                              </div>
                              {balance.balance.daily_usage_rate > 0 && (
                                <div className="mt-2 pt-1.5 border-t border-gray-300 dark:border-gray-600">
                                  <div className="flex justify-between"><span>Daily Rate:</span><span>{balance.balance.daily_usage_rate} {selectedItem.unit}/day</span></div>
                                  {balance.balance.days_remaining != null && (
                                    <div className="flex justify-between">
                                      <span>Days Left:</span>
                                      <span className={`font-bold ${balance.balance.days_remaining <= 0 ? 'text-red-600' : balance.balance.days_remaining <= 3 ? 'text-amber-600' : 'text-green-600'}`}>
                                        {balance.balance.days_remaining <= 0 ? 'Depleted' : `${balance.balance.days_remaining} days`}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          {!balance.allowed && <p className="mt-1.5 text-red-600 dark:text-red-400 text-xs">{balance.reason || 'Cannot request at this time.'}</p>}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                <div>
                  <label className="label dark:text-gray-300">Quantity *</label>
                  <input type="number" className="input dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Enter quantity" min="1" required />
                </div>
                <div>
                  <label className="label dark:text-gray-300">Requesting Officer (Optional)</label>
                  <input type="text" className="input dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600" value={requestingOfficer} onChange={(e) => setRequestingOfficer(e.target.value)} placeholder="Name of requesting officer" />
                </div>
                <div>
                  <label className="label dark:text-gray-300">Notes (Optional)</label>
                  <textarea className="input resize-none dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600" rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any notes..." />
                </div>
                <button type="submit" disabled={submitting || (balance && !balance.allowed)} className={`btn btn-primary w-full ${(balance && !balance.allowed) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </form>
            </div>
          </div>

          {/* My Requests preview */}
          <div className="lg:col-span-2">
            <div className="card p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Your Recent Requests</h2>
              {loadingMyRequests ? (
                <div className="text-center py-8"><div className="inline-block w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : myRequests.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No requests yet</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {myRequests.slice(0, 10).map(req => (
                    <div key={req.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{req.consumable_name}</h3>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${getStatusColor(req.status)}`}>{req.status.charAt(0).toUpperCase() + req.status.slice(1)}</span>
                      </div>
                      <div className="text-xs space-y-0.5">
                        <div className="flex gap-4">
                          <span className="text-gray-500">Qty: <strong>{req.quantity} {req.unit}</strong></span>
                          {req.status === 'approved' && req.approved_quantity != null && (
                            <span className="text-green-600">Approved: <strong>{req.approved_quantity} {req.unit}</strong></span>
                          )}
                        </div>
                        {req.admin_comment && <p className="text-gray-500 italic">&ldquo;{req.admin_comment}&rdquo;</p>}
                        <p className="text-gray-400">{new Date(req.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'my-requests' && (
        <div className="card p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Your Requests</h2>
          {loadingMyRequests ? (
            <div className="text-center py-8"><div className="inline-block w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : myRequests.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No requests yet</p>
          ) : (
            <div className="space-y-3">
              {myRequests.map(req => (
                <div key={req.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">{req.consumable_name}</h3>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(req.status)}`}>{req.status.charAt(0).toUpperCase() + req.status.slice(1)}</span>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 dark:text-gray-400 w-20 font-medium">Requested:</span>
                      <span className="text-gray-900 dark:text-gray-100 font-semibold">{req.quantity} {req.unit}</span>
                    </div>
                    {req.status === 'approved' && req.approved_quantity != null && (
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 dark:text-green-400 w-20 font-medium">Approved:</span>
                        <span className="text-green-700 dark:text-green-300 font-bold text-base">{req.approved_quantity} {req.unit}</span>
                        {req.approved_quantity < req.quantity && <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">Partial</span>}
                      </div>
                    )}
                    {req.admin_comment && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2 mt-1">
                        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5">Reason for {req.status === 'approved' ? 'Approved Quantity' : 'Rejection'}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 italic">&ldquo;{req.admin_comment}&rdquo;</p>
                      </div>
                    )}
                    {req.notes && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1"><strong>Notes:</strong> {req.notes}</div>}
                    {req.approved_by && <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400"><span className="font-medium">Approved by:</span><span>{req.approved_by}</span></div>}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{new Date(req.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'approve' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Request List */}
          <div className="lg:col-span-2">
            {/* Filter Tabs */}
            <div className="flex gap-2 bg-white dark:bg-gray-800 rounded-t-lg p-1 border-b border-gray-200 dark:border-gray-700 mb-0">
              {['all', 'pending', 'approved', 'rejected'].map(s => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-4 py-2 font-medium rounded-lg transition-all text-sm ${
                    filter === s
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <div className="card p-4 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-h-[70vh] overflow-y-auto rounded-tl-none">
              {loadingAllRequests ? (
                <div className="text-center py-12"><div className="inline-block w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
              ) : allRequests.length === 0 ? (
                <p className="text-center text-gray-500 py-12">No requests found</p>
              ) : (
                <div className="space-y-2">
                  {allRequests.map(req => (
                    <div
                      key={req.id}
                      onClick={() => handleSelectRequest(req)}
                      className={`border rounded-lg p-4 cursor-pointer transition ${
                        selectedRequest?.id === req.id ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{req.consumable_name}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{req.user_name} &middot; {req.user_email}</p>
                        </div>
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${getStatusColor(req.status)}`}>{req.status.charAt(0).toUpperCase() + req.status.slice(1)}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-gray-600 dark:text-gray-300"><strong>Qty:</strong> {req.quantity} {req.unit}</span>
                        <span className="text-gray-400 text-xs">{new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Detail Panel */}
          <div>
            {selectedRequest ? (
              <div className="card p-0 overflow-hidden bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">Request #{selectedRequest.id}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{new Date(selectedRequest.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex gap-3"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-36 shrink-0 pt-0.5">Consumable</span><span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedRequest.consumable_name}</span></div>
                  <div className="flex gap-3"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-36 shrink-0 pt-0.5">Requested By</span><div><p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedRequest.user_name}</p><p className="text-xs text-gray-500">{selectedRequest.user_email}</p></div></div>
                  {selectedRequest.user_facility && (
                    <div className="flex gap-3"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-36 shrink-0 pt-0.5">Facility</span><span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedRequest.user_facility}</span></div>
                  )}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div><p className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Requested</p><p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{selectedRequest.quantity} <span className="text-sm font-normal text-blue-400">{selectedRequest.unit}</span></p></div>
                      <div className="w-px h-10 bg-blue-200 dark:bg-blue-700" />
                      <div><p className="text-xs font-semibold text-blue-500 uppercase tracking-wider">In Stock</p><p className={`text-2xl font-bold ${(selectedRequest.consumable_stock ?? 0) >= selectedRequest.quantity ? 'text-green-600' : 'text-red-600'}`}>{selectedRequest.consumable_stock ?? 0} <span className="text-sm font-normal text-gray-400">{selectedRequest.unit}</span></p></div>
                    </div>
                  </div>
                  {selectedRequest.notes && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Staff Notes</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 italic">&ldquo;{selectedRequest.notes}&rdquo;</p>
                    </div>
                  )}
                  {selectedRequest.status !== 'pending' && (
                    <div className="space-y-2 mt-1">
                      {selectedRequest.approved_quantity != null && selectedRequest.status === 'approved' && (
                        <div className="flex gap-3"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-36 shrink-0 pt-0.5">Approved</span><span className="text-sm font-bold text-green-700 dark:text-green-300">{selectedRequest.approved_quantity} {selectedRequest.unit}{selectedRequest.approved_quantity < selectedRequest.quantity && <span className="ml-1 text-xs text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">Partial</span>}</span></div>
                      )}
                      {selectedRequest.admin_comment && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Reason for {selectedRequest.status === 'approved' ? 'Approved Quantity' : 'Rejection'}</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 italic">&ldquo;{selectedRequest.admin_comment}&rdquo;</p>
                        </div>
                      )}
                      {selectedRequest.approved_by && <div className="flex gap-3"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-36 shrink-0 pt-0.5">Approved By</span><span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{selectedRequest.approved_by}</span></div>}
                    </div>
                  )}
                  <div className="flex items-center gap-2"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</span><span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${getStatusColor(selectedRequest.status)}`}>{selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}</span></div>
                  {selectedRequest.status === 'approved' && (
                    <button onClick={() => setDeliveryNoteRequest(selectedRequest)} className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2">
                      🖨️ Print Delivery Note
                    </button>
                  )}
                </div>
                {selectedRequest.status === 'pending' && (
                  <>
                    <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 border-t border-b border-gray-200 dark:border-gray-600"><h4 className="text-base font-bold text-gray-800 dark:text-gray-100">Approval Decision</h4></div>
                    <div className="p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Quantity to Approve <span className="text-red-500">*</span></label>
                        <div className="flex items-center gap-2">
                          <input type="number" min="1" max={selectedRequest.consumable_stock ?? selectedRequest.quantity} className="input text-lg font-bold w-28 text-center dark:bg-gray-700" value={approvedQuantity} onChange={(e) => setApprovedQuantity(e.target.value)} />
                          <span className="text-sm text-gray-500">{selectedRequest.unit}</span>
                        </div>
                        {approvedQuantity !== '' && parseInt(approvedQuantity) > (selectedRequest.consumable_stock ?? 0) && <p className="text-xs text-red-600 mt-1.5">Not enough stock — only {selectedRequest.consumable_stock ?? 0} {selectedRequest.unit} available</p>}
                        {approvedQuantity !== '' && parseInt(approvedQuantity) > 0 && parseInt(approvedQuantity) < selectedRequest.quantity && <p className="text-xs text-amber-600 mt-1.5">Partial approval — requested {selectedRequest.quantity} {selectedRequest.unit}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Reason for Approval <span className="text-xs font-normal text-gray-400">(explain why this quantity)</span></label>
                        <textarea className="input resize-none text-sm dark:bg-gray-700" rows="3" value={adminComment} onChange={(e) => setAdminComment(e.target.value)} placeholder="E.g., Limited stock — issuing partial quantity." />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Additional Notes <span className="text-xs font-normal text-gray-400">(optional)</span></label>
                        <textarea className="input resize-none text-sm dark:bg-gray-700" rows="2" value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} placeholder="Internal notes..." />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={handleApprove} disabled={actionLoading} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm disabled:opacity-50 transition">{actionLoading ? 'Processing...' : '✅ Approve'}</button>
                        <button onClick={handleReject} disabled={actionLoading} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50 transition">{actionLoading ? 'Processing...' : '❌ Reject'}</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="card p-8 text-center bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <p className="text-gray-400 text-sm">Select a request from the list to review</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delivery Note Modal */}
      {deliveryNoteRequest && <DeliveryNote request={deliveryNoteRequest} onClose={() => setDeliveryNoteRequest(null)} />}

      <div className="mt-6">
        <HistoryPanel entityType="request" title="Request History" />
      </div>
    </div>
  );
}