import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';
import HistoryPanel from '../components/HistoryPanel';

const getStockStatus = (stock, min_stock, safety_stock, emergency_order_point) => {
  if (stock === 0) return { label: 'Out of Stock', className: 'badge badge-out text-xs' };
  if (stock <= (emergency_order_point || 0)) return { label: 'Emergency', className: 'badge badge-out text-xs' };
  if (stock <= (safety_stock || 0)) return { label: 'Safety Stock', className: 'badge badge-low text-xs' };
  if (stock <= (min_stock || 0)) return { label: 'Low Stock', className: 'badge badge-low text-xs' };
  return { label: 'Adequate', className: 'badge badge-ok text-xs' };
};

export default function RequestConsumables() {
  const { user } = useAuth();
  const [consumables, setConsumables] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedConsumable, setSelectedConsumable] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [requestingOfficer, setRequestingOfficer] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [balance, setBalance] = useState(null);
  const [checkingBalance, setCheckingBalance] = useState(false);

  useEffect(() => {
    fetchConsumables();
    fetchMyRequests();
  }, []);

  const fetchConsumables = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/consumables?all=true');
      setConsumables(data);
    } catch (err) {
      toast.error('Failed to fetch consumables');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyRequests = async () => {
    try {
      const { data } = await api.get('/requests/my-requests');
      setRequests(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelect = async (c) => {
    setSelectedConsumable(c.id);
    setSelectedItem(c);
    setBalance(null);

    // Check balance eligibility for this consumable
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

    // Frontend balance guard
    if (balance && !balance.allowed) {
      toast.error(balance.reason || 'Cannot request — previous dispatch not yet fully accounted for in daily usage.');
      return;
    }
    
    setSubmitting(true);
    try {
      const { data } = await api.post('/requests', {
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

  const getStatusColor = (status) => {
    switch(status) {
      case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Request Consumables</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request Form */}
        <div className="lg:col-span-1">
          <div className="card p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">New Request</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Consumable Dropdown */}
              <div>
                <label className="label dark:text-gray-300">Select Consumable</label>
                <select
                  className="input dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                  value={selectedConsumable}
                  onChange={(e) => {
                    const id = e.target.value;
                    const item = consumables.find(c => c.id.toString() === id);
                    if (item) handleSelect(item);
                    else { setSelectedConsumable(""); setSelectedItem(null); }
                  }}
                >
                  <option value="">-- Choose a consumable --</option>
                  {consumables.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.unit}) - Stock: {c.stock} | {c.category_name || "N/A"}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected item detail card */}
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
                    <div>
                      <span className="text-gray-400 dark:text-gray-500">Category:</span>
                      <span className="ml-1 text-gray-600 dark:text-gray-300">{selectedItem.category_name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 dark:text-gray-500">Unit:</span>
                      <span className="ml-1 text-gray-600 dark:text-gray-300">{selectedItem.unit}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 dark:text-gray-500">In Stock:</span>
                      <span className={`ml-1 font-medium ${
                        selectedItem.stock === 0 ? 'text-red-500' 
                        : selectedItem.stock <= (selectedItem.emergency_order_point || 0) ? 'text-red-500'
                        : selectedItem.stock <= (selectedItem.safety_stock || 0) ? 'text-amber-500'
                        : selectedItem.stock <= (selectedItem.min_stock || 0) ? 'text-amber-500'
                        : 'text-green-600 dark:text-green-400'
                      }`}>
                        {selectedItem.stock}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 dark:text-gray-500">Min Stock:</span>
                      <span className="ml-1 text-gray-600 dark:text-gray-300">{selectedItem.min_stock || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 dark:text-gray-500">Safety Stock:</span>
                      <span className="ml-1 text-gray-600 dark:text-gray-300">{selectedItem.safety_stock || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 dark:text-gray-500">Emergency Pt:</span>
                      <span className="ml-1 text-gray-600 dark:text-gray-300">{selectedItem.emergency_order_point || 0}</span>
                    </div>
                  </div>

                  {/* Balance & Forecast Section */}
                  {checkingBalance ? (
                    <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <div className="w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                        Checking balance...
                      </div>
                    </div>
                  ) : balance ? (
                    <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                      <div className={`rounded-md p-2 text-xs ${
                        balance.allowed 
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                          : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                      }`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`w-2 h-2 rounded-full ${balance.allowed ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className={`font-semibold ${balance.allowed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                            {balance.allowed ? 'Eligible to Request' : 'Not Eligible'}
                          </span>
                        </div>

                        {balance.balance && (
                          <div className="space-y-0.5 text-gray-600 dark:text-gray-400">
                            <div className="flex justify-between">
                              <span>Dispatched (Total):</span>
                              <span className="font-medium text-gray-800 dark:text-gray-200">{balance.balance.total_dispatched} {selectedItem.unit}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Used (Daily Log):</span>
                              <span className="font-medium text-gray-800 dark:text-gray-200">{balance.balance.total_used} {selectedItem.unit}</span>
                            </div>
                            <div className="flex justify-between border-t border-gray-300 dark:border-gray-600 pt-0.5">
                              <span className="font-semibold">Remaining Balance:</span>
                              <span className={`font-bold ${balance.balance.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                                {balance.balance.balance} {selectedItem.unit}
                              </span>
                            </div>

                            {/* Forecast */}
                            {balance.balance.daily_usage_rate > 0 && (
                              <div className="mt-2 pt-1.5 border-t border-gray-300 dark:border-gray-600">
                                <div className="flex justify-between">
                                  <span>Daily Usage Rate:</span>
                                  <span className="font-medium">{balance.balance.daily_usage_rate} {selectedItem.unit}/day</span>
                                </div>
                                {balance.balance.days_remaining != null && (
                                  <div className="flex justify-between">
                                    <span>Est. Days Remaining:</span>
                                    <span className={`font-bold ${
                                      balance.balance.days_remaining <= 0 ? 'text-red-600' 
                                      : balance.balance.days_remaining <= 3 ? 'text-amber-600' 
                                      : 'text-green-600'
                                    }`}>
                                      {balance.balance.days_remaining <= 0 ? 'Depleted' : `${balance.balance.days_remaining} days`}
                                    </span>
                                  </div>
                                )}
                                {balance.balance.forecast_date && (
                                  <div className="flex justify-between">
                                    <span>Next Distribution Forecast:</span>
                                    <span className="font-medium text-teal-600 dark:text-teal-400">{balance.balance.forecast_date}</span>
                                  </div>
                                )}
                                {balance.balance.last_dispatch_date && (
                                  <div className="flex justify-between">
                                    <span>Last Dispatch:</span>
                                    <span className="text-gray-500">{new Date(balance.balance.last_dispatch_date).toLocaleDateString()}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {!balance.allowed && (
                          <p className="mt-1.5 text-red-600 dark:text-red-400 text-xs leading-relaxed">
                            {balance.reason || 'Cannot request at this time.'}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {selectedItem.description && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 border-t border-gray-200 dark:border-gray-600 pt-2">
                      {selectedItem.description}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="label dark:text-gray-300">Quantity</label>
                <input
                  type="number"
                  className="input dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Enter quantity"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="label dark:text-gray-300">Requesting Officer (Optional)</label>
                <input
                  type="text"
                  className="input dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                  value={requestingOfficer}
                  onChange={(e) => setRequestingOfficer(e.target.value)}
                  placeholder="Name of requesting officer"
                />
              </div>

              <div>
                <label className="label dark:text-gray-300">Notes (Optional)</label>
                <textarea
                  className="input resize-none dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                  rows="3"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes..."
                />
              </div>

              <button
                type="submit"
                disabled={submitting || (balance && !balance.allowed)}
                className={`btn btn-primary w-full ${(balance && !balance.allowed) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </form>
          </div>
        </div>

        {/* Requests History */}
        <div className="lg:col-span-2">
          <div className="card p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Your Requests</h2>
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">No requests yet</p>
            ) : (
              <div className="space-y-3">
                {requests.map(req => (
                  <div key={req.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{req.consumable_name}</h3>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(req.status)}`}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      {/* Quantity Requested */}
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400 w-20 font-medium">Requested:</span>
                        <span className="text-gray-900 dark:text-gray-100 font-semibold">{req.quantity} {req.unit}</span>
                      </div>
                      
                      {/* Quantity Approved (only for approved requests) */}
                      {req.status === 'approved' && req.approved_quantity != null && (
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 dark:text-green-400 w-20 font-medium">Approved:</span>
                          <span className="text-green-700 dark:text-green-300 font-bold text-base">{req.approved_quantity} {req.unit}</span>
                          {req.approved_quantity < req.quantity && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">Partial</span>
                          )}
                        </div>
                      )}

                      {/* Reason for approval (admin_comment) */}
                      {req.admin_comment && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-2 mt-1">
                          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-0.5">Reason for {req.status === 'approved' ? 'Approved Quantity' : 'Rejection'}</p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 italic">&ldquo;{req.admin_comment}&rdquo;</p>
                        </div>
                      )}
                      
                      {/* Notes */}
                      {req.notes && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <strong className="text-gray-600 dark:text-gray-300">Notes:</strong> {req.notes}
                        </div>
                      )}
                      
                      {/* Approved By */}
                      {req.approved_by && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="font-medium text-gray-600 dark:text-gray-300">Approved by:</span>
                          <span>{req.approved_by}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                      {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <HistoryPanel entityType="request" title="Request History" />
      </div>
    </div>
  );
}