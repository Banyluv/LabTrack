import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const statusBadge = (stock, min) => {
  if (stock === 0) return <span className="badge badge-out text-xs">Out of Stock</span>;
  if (stock <= (min || 0)) return <span className="badge badge-low text-xs">Low Stock</span>;
  return <span className="badge badge-ok text-xs">Adequate</span>;
};

export default function RequestConsumables() {
  const { user } = useAuth();
  const [consumables, setConsumables] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedConsumable, setSelectedConsumable] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const handleSelect = (c) => {
    setSelectedConsumable(c.id);
    setSelectedItem(c);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedConsumable || !quantity) {
      toast.error('Please select a consumable and quantity');
      return;
    }
    
    setSubmitting(true);
    try {
      await api.post('/requests', {
        consumable_id: selectedConsumable,
        quantity: parseInt(quantity),
        notes
      });
      toast.success('Request submitted successfully!');
      setSelectedConsumable('');
      setSelectedItem(null);
      setQuantity('');
      setNotes('');
      fetchMyRequests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit request');
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
                    {statusBadge(selectedItem.stock, selectedItem.reorder_quantity)}
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
                      <span className={`ml-1 font-medium ${selectedItem.stock === 0 ? 'text-red-500' : selectedItem.stock <= (selectedItem.reorder_quantity || 0) ? 'text-amber-500' : 'text-green-600 dark:text-green-400'}`}>
                        {selectedItem.stock}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 dark:text-gray-500">Reorder At:</span>
                      <span className="ml-1 text-gray-600 dark:text-gray-300">{selectedItem.reorder_quantity || 0}</span>
                    </div>
                  </div>
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
                disabled={submitting}
                className="btn btn-primary w-full"
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
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <strong>Requested:</strong> {req.quantity} {req.unit}
                    </p>
                    {req.status === 'approved' && req.approved_quantity != null && (
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                        <strong>Approved:</strong> {req.approved_quantity} {req.unit}
                      </p>
                    )}
                    {req.notes && (
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        <strong>Notes:</strong> {req.notes}
                      </p>
                    )}
                    {req.admin_comment && (
                      <p className="text-sm text-blue-600 dark:text-blue-400 italic mt-1">
                        <strong>Reason:</strong> {req.admin_comment}
                      </p>
                    )}
                    {req.approved_by && (
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        <strong>Approved by:</strong> {req.approved_by}
                      </p>
                    )}
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
    </div>
  );
}