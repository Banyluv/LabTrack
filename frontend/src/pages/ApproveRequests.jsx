import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function ApproveRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvedQuantity, setApprovedQuantity] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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
    setApprovedQuantity(req.quantity);
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
      if (qty > (selectedRequest.consumable_stock || 0)) {
        toast.error(`Insufficient stock. Available: ${selectedRequest.consumable_stock}`);
        setActionLoading(false);
        return;
      }
      await api.put(`/requests/${selectedRequest.id}/approve`, {
        notes: approvalNotes,
        approved_quantity: qty
      });
      toast.success('Request approved!');
      setSelectedRequest(null);
      setApprovalNotes('');
      setApprovedQuantity('');
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
        notes: approvalNotes
      });
      toast.success('Request rejected!');
      setSelectedRequest(null);
      setApprovalNotes('');
      setApprovedQuantity('');
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject request');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
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
        {/* Requests List */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No requests found</p>
            ) : (
              <div className="space-y-2">
                {requests.map(req => (
                  <div
                    key={req.id}
                    onClick={() => handleSelectRequest(req)}
                    className={`border rounded-lg p-4 cursor-pointer transition ${
                      selectedRequest?.id === req.id
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">{req.consumable_name}</h3>
                        <p className="text-sm text-gray-600">{req.user_name} ({req.user_email})</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(req.status)}`}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      <strong>Quantity:</strong> {req.quantity} {req.unit}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Request Details & Actions */}
        <div>
          {selectedRequest ? (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Request Details</h2>
              
              <div className="space-y-3 mb-6">
                <div>
                  <p className="text-xs text-gray-500">Consumable</p>
                  <p className="font-semibold text-gray-900">{selectedRequest.consumable_name}</p>
                </div>
                
                <div>
                  <p className="text-xs text-gray-500">Requested By</p>
                  <p className="font-semibold text-gray-900">{selectedRequest.user_name}</p>
                  <p className="text-sm text-gray-600">{selectedRequest.user_email}</p>
                </div>
                
                <div>
                  <p className="text-xs text-gray-500">Requested Quantity</p>
                  <p className="font-semibold text-gray-900">{selectedRequest.quantity} {selectedRequest.unit}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Available Stock</p>
                  <p className={`font-semibold ${(selectedRequest.consumable_stock || 0) < selectedRequest.quantity ? 'text-red-600' : 'text-green-600'}`}>
                    {selectedRequest.consumable_stock ?? 0} {selectedRequest.unit}
                  </p>
                </div>

                {selectedRequest.user_facility && (
                  <div>
                    <p className="text-xs text-gray-500">Facility</p>
                    <p className="font-semibold text-gray-900">{selectedRequest.user_facility}</p>
                  </div>
                )}

                {selectedRequest.notes && (
                  <div>
                    <p className="text-xs text-gray-500">Notes</p>
                    <p className="text-sm text-gray-900">{selectedRequest.notes}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`inline-block text-xs font-medium px-2 py-1 rounded ${getStatusColor(selectedRequest.status)}`}>
                    {selectedRequest.status.charAt(0).toUpperCase() + selectedRequest.status.slice(1)}
                  </span>
                </div>
              </div>

              {selectedRequest.status === 'pending' && (
                <>
                  <div className="mb-4">
                    <label className="label">Quantity to Approve</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedRequest.consumable_stock || selectedRequest.quantity}
                      className="input"
                      value={approvedQuantity}
                      onChange={(e) => setApprovedQuantity(e.target.value)}
                    />
                    {approvedQuantity !== '' && parseInt(approvedQuantity) > (selectedRequest.consumable_stock || 0) && (
                      <p className="text-xs text-red-600 mt-1">
                        ⚠️ Exceeds available stock ({selectedRequest.consumable_stock ?? 0})
                      </p>
                    )}
                    {approvedQuantity !== '' && parseInt(approvedQuantity) > 0 && parseInt(approvedQuantity) < selectedRequest.quantity && (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ Less than requested quantity ({selectedRequest.quantity})
                      </p>
                    )}
                  </div>

                  <div className="mb-4">
                    <label className="label">Approval Notes</label>
                    <textarea
                      className="input resize-none"
                      rows="3"
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="Add approval notes..."
                    />
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={handleApprove}
                      disabled={actionLoading}
                      className="btn btn-primary w-full"
                    >
                      {actionLoading ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={actionLoading}
                      className="btn w-full bg-red-500 hover:bg-red-600 text-white"
                    >
                      {actionLoading ? 'Processing...' : 'Reject'}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="card p-6 text-center">
              <p className="text-gray-500">Select a request to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
