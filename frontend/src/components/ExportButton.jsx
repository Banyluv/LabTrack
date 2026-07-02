import toast from 'react-hot-toast';
import api from '../utils/api';

export default function ExportButton({ label, endpoint, params = {}, fileName }) {
  const handleExport = async () => {
    try {
      const res = await api.get(endpoint, { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'export.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${label} downloaded`);
    } catch (err) {
      toast.error(`Unable to export ${label}`);
    }
  };

  return (
    <button type="button" onClick={handleExport} className="btn btn-secondary">
      {label}
    </button>
  );
}
