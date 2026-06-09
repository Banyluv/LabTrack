import { useState, useEffect, useRef } from 'react';
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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    fetchConsumables();
    fetchMyRequests();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setDropdownOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchConsumables = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/consumables');
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
    setDropdownOpen(false);
    setSearch('');
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

  const filtered = consumables.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.category_name && c.category_name.toLowerCase().includes(search.toLowerCase()))
  );

  const showSuggestion = search && !filtered.some(c => c.id === selectedConsumable);

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
              {/* Searchable Dropdown */}
              <div ref={wrapperRef}>
                <label className="label dark:text-gray-300">Select Consumable</label>
                <div className="relative">
                  {/* Selected pill / trigger */}
                  <button
                    type="button"
                    className="input flex items-center justify-between pr-3 text-left cursor-pointer dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                    onClick={() => { setDropdownOpen(!dropdownOpen); setSearch(''); }}
                  >
                    {selectedItem ? (
                      <span className="flex items-center gap-2 truncate">
                        <span className="font-medium truncate">{selectedItem.name}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">({selectedItem.unit})</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">Stock: {selectedItem.stock}</span>
                        {statusBadge(selectedItem.stock, selectedItem.reorder_quantity)}
                      </span>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">Choose a consumable...</span>
                    )}
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ml-2 flex-shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown list */}
                  {dropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl max-h-72 overflow-hidden">
                      {/* Search input */}
                      <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                        <input
                          type="text"
                          className="input text-sm py-1.5 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                          placeholder="Search consumable..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto max-h-56">
                        {filtered.length === 0 ? (
                          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">No consumables found</p>
                        ) : (
                          filtered.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              className={`w-full text-left px-3 py-2.5 flex items-center justify-between hover:bg-teal-50 dark:hover:bg-teal-900/30 transition-colors ${
                                selectedConsumable === c.id ? 'bg-teal-50 dark:bg-teal-900/30 border-l-2 border-teal-500' : ''
                              }`}
                              onClick={() => handleSelect(c)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{c.name}</span>
                                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">({c.unit})</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {c.category_name && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">{c.category_name}</span>
                                  )}
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    Stock: <span className={c.stock === 0 ? 'text-red-500 font-medium' : c.stock <= (c.reorder_quantity || 0) ? 'text-amber-500 font-medium' : ''}>{c.stock}</span>
                                  </span>
                                </div>
                              </div>
                              <div className="flex-shrink-0 ml-2">
                                {statusBadge(c.stock, c.reorder_quantity)}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
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