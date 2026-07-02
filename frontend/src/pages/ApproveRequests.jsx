import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import DeliveryNote from '../components/DeliveryNote';
import HistoryPanel from '../components/HistoryPanel';

export default function ApproveRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvedQuantity, setApprovedQuantity] = useState('');
  const [adminComment, setAdminComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [deliveryNoteRequest, setDeliveryNoteRequest] = useState(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/requests');
      if (filter === 'all') {
        setRequests(data);
      } else {
        setRequests(data.filter(r => r.status === filter));
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      toast.error('Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

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
      fetchRequests();
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
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject request');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Approve Requests</h1>
          <p className="text-sm text-gray-600">Review and manage pending requests</p>
        </div>
        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-3 rounded-xl font-semibold shadow-lg">
          Pending: <span className="text-lg">{pendingCount}</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b-2 border-gray-200 bg-white rounded-t-lg p-1">
        {['all', 'pending', 'approved', 'rejected'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2.5 font-medium rounded-lg transition-all ${
              filter === status
                ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request List */}
        <div className="lg:col-span-2">
          <div className="card p-4 max-h-screen overflow-y-auto">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-center text-gray-500 py-12">No requests found</p>
            ) : (
              <div className="space-y-2">
                {requests.map(req => (
                  <div
                    key={req.id}
                    onClick={() => handleSelectRequest(req)}
                    className={`border rounded-lg p-4 cursor-pointer transition ${
                      selectedRequest?.id === req.id
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{req.consumable_name}</h3>
                        <p className="text-sm text-gray-500">{req.user_name} &middot; {req.user_email}</p>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${getStatusColor(req.status)}`}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="text-gray-600"><strong>Qty:</strong> {req.quantity} {req.unit}</span>
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
            <div className="card p-0 overflow-hidden">
              {/* Header */}
              <div className="bg-gray-50 px-6 py-4 border-b">
                <h3 className="text-lg font-bold text-gray-800">Request #{selectedRequest.id}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{new Date(selectedRequest.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>

              {/* Info Rows */}
              <div className="p-6 space-y-4">
                <div className="flex gap-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-36 shrink-0 pt-0.5">Consumable</span>
                  <span className="text-sm font-semibold text-gray-900">{selectedRequest.consumable_name}</span>
                </div>

                <div className="flex gap-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-36 shrink-0 pt-0.5">Requested By</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selectedRequest.user_name}</p>
                    <p className="text-xs text-gray-500">{selectedRequest.user_email}</p>
                  </div>
                </div>

                {selectedRequest.user_facility && (
                  <div className="flex gap-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-36 shrink-0 pt-0.5">Facility</span>
                    <span className="text-sm font-semibold text-gray-900">{selectedRequest.user_facility}</span>
                  </div>
                )}

                {/* Quantity Highlight */}
                <div className="bg-blue-50 rounded-xl p-4 mt-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Quantity Requested</p>
                      <p className="text-2xl font-bold text-blue-700">{selectedRequest.quantity} <span className="text-sm font-normal text-blue-400">{selectedRequest.unit}</span></p>
                    </div>
                    <div className="w-px h-10 bg-blue-200"></div>
                    <div>
                      <p className="text-xs font-semibold text-blue-500 uppercase tracking-wider">In Stock</p>
                      <p className={`text-2xl font-bold ${(selectedRequest.consumable_stock ?? 0) >= selectedRequest.quantity ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedRequest.consumable_stock ?? 0} <span className="text-sm font-normal text-gray-400">{selectedRequest.unit}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Staff Notes */}
                {selectedRequest.notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Staff Notes</p>
                    <p className="text-sm text-gray-700 italic">&ldquo;{selectedRequest.notes}&rdquo;</p>
                  </div>
                )}

                {/* Approved quantity & admin comment for processed requests */}
                {selectedRequest.status !== 'pending' && (
                  <div className="space-y-2 mt-1">
                    {selectedRequest.approved_quantity != null && selectedRequest.status === 'approved' && (
                      <div className="flex gap-3">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-36 shrink-0 pt-0.5">Quantity Approved</span>
                        <span className="text-sm font-bold text-green-700">{selectedRequest.approved_quantity} {selectedRequest.unit}
                          {selectedRequest.approved_quantity < selectedRequest.quantity && (
                            <span className="ml-1 text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">Partial</span>
                          )}
                        </span>
                      </div>
                    )}
                    {selectedRequest.admin_comment && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">Reason for {selectedRequest.status === 'approved' ? 'Approved Quantity' : 'Rejection'}</p>
                        <p className="text-sm text-gray-700 italic">&ldquo;{selectedRequest.admin_comment}&rdquo;</p>
                      </div>
                    )}
                    {selectedRequest.approved_by && (
                      <div className="flex gap-3">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-36 shrink-0 pt-0.5">Approved By</span>
                        <span className="text-sm font-semibold text-gray-900">{selectedRequest.approved_by}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</span>
                  <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full ${getStatusColor(selectedRequest.status)}`}>
                    {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                  </span>
                </div>

                {/* Delivery Note Button (for approved requests) */}
                {selectedRequest.status === 'approved' && (
                  <button
                    onClick={() => setDeliveryNoteRequest(selectedRequest)}
                    className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2"
                  >
                    🖨️ Print Delivery Note
                  </button>
                )}
              </div>

              {/* Approval Form (only for pending) */}
              {selectedRequest.status === 'pending' && (
                <>
                  <div className="bg-gray-50 px-6 py-3 border-t border-b">
                    <h4 className="text-base font-bold text-gray-800">Approval Decision</h4>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Quantity to Approve <span className="text-red-500">*</span></label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max={selectedRequest.consumable_stock ?? selectedRequest.quantity}
                          className="input text-lg font-bold w-28 text-center"
                          value={approvedQuantity}
                          onChange={(e) => setApprovedQuantity(e.target.value)}
                        />
                        <span className="text-sm text-gray-500">{selectedRequest.unit}</span>
                      </div>
                      {approvedQuantity !== '' && parseInt(approvedQuantity) > (selectedRequest.consumable_stock ?? 0) && (
                        <p className="text-xs text-red-600 mt-1.5">Not enough stock &mdash; only {selectedRequest.consumable_stock ?? 0} {selectedRequest.unit} available</p>
                      )}
                      {approvedQuantity !== '' && parseInt(approvedQuantity) > 0 && parseInt(approvedQuantity) < selectedRequest.quantity && (
                        <p className="text-xs text-amber-600 mt-1.5">Partial approval &mdash; requested {selectedRequest.quantity} {selectedRequest.unit}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason for Approval <span className="text-xs font-normal text-gray-400">(explain why this quantity)</span></label>
                      <textarea className="input resize-none text-sm" rows="3" value={adminComment} onChange={(e) => setAdminComment(e.target.value)} placeholder="E.g., Limited stock &mdash; issuing partial quantity. Remaining to be fulfilled by next delivery." />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Additional Notes <span className="text-xs font-normal text-gray-400">(optional)</span></label>
                      <textarea className="input resize-none text-sm" rows="2" value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} placeholder="Internal notes..." />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button onClick={handleApprove} disabled={actionLoading} className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm disabled:opacity-50 transition">
                        {actionLoading ? 'Processing...' : 'Approve Request'}
                      </button>
                      <button onClick={handleReject} disabled={actionLoading} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg text-sm disabled:opacity-50 transition">
                        {actionLoading ? 'Processing...' : 'Reject Request'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <p className="text-gray-400 text-sm">Select a request from the list to review</p>
            </div>
          )}
        </div>
      </div>

      {/* Delivery Note Modal */}
      {deliveryNoteRequest && (
        <DeliveryNote
          request={deliveryNoteRequest}
          onClose={() => setDeliveryNoteRequest(null)}
        />
      )}

      <div className="mt-6">
        <HistoryPanel entityType="request" title="Approval History" />
      </div>
    </div>
  );
}