import { useState, useRef } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function ImportModal({ open, onClose, onImport }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files[0];
    if (!file) { toast.error('Select a CSV file'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/consumables/import', formData);
      setResult(data);
      toast.success('Import completed');
      if (onImport) onImport();
    } catch (err) { toast.error(err.response?.data?.error || 'Import failed'); }
    finally { setUploading(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Import CSV</h2>
        {!result ? (
          <form onSubmit={handleUpload} className="space-y-4">
            <p className="text-sm text-gray-500">Upload a CSV file with columns: name, category, unit, stock, reorder_quantity, price</p>
            <input ref={fileRef} type="file" accept=".csv" className="input" />
            <div className="flex gap-2"><button type="submit" disabled={uploading} className="btn btn-primary flex-1">{uploading ? 'Uploading...' : 'Import'}</button><button type="button" className="btn btn-secondary flex-1" onClick={onClose}>Cancel</button></div>
          </form>
        ) : (
          <div className="space-y-3">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="text-sm font-semibold text-green-800">Import Complete</h4>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-green-700"><div>Total rows:</div><div className="font-semibold">{result.total_rows}</div><div>Created/Updated:</div><div className="font-semibold">{result.created_or_updated}</div><div>Errors:</div><div className="font-semibold">{result.errors}</div></div>
            </div>
            <button className="btn btn-primary w-full" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
