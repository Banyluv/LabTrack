import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function QuarterlyReports() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ['quarterly-reports'],
    queryFn: () => api.get('/reports/quarterly').then((res) => res.data),
    staleTime: 1000 * 60,
  });

  const handleUpload = async () => {
    if (!file) {
      toast.error('Select an Excel file to upload');
      return;
    }

    const formData = new FormData();
    formData.append('excelFile', file);

    try {
      setUploading(true);
      const response = await api.post('/reports/quarterly/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(response.data.message || 'Quarterly report imported');
      setFile(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Quarterly Reports</h1>
          <p className="text-sm text-gray-500">Upload and view quarterly/historical report spreadsheets.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 cursor-pointer hover:border-teal-400">
            <span className="text-sm font-medium text-gray-700">Choose Excel file</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload Report'}
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Imported Quarterly Reports</h2>
            <p className="text-sm text-gray-500">Reports are stored with original sheet content.</p>
          </div>
          <div className="text-sm text-gray-500">{reports.length} reports</div>
        </div>

        {isLoading ? (
          <div className="py-14 text-center text-sm text-gray-500">Loading reports…</div>
        ) : !reports.length ? (
          <div className="py-14 text-center text-sm text-gray-500">No quarterly reports imported yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {['Title', 'Month', 'Year', 'Rows', 'Imported At', 'File name'].map((heading) => (
                    <th key={heading} className="table-th">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50">
                    <td className="table-td font-medium">{report.title}</td>
                    <td className="table-td">{report.month || '-'}</td>
                    <td className="table-td">{report.year || '-'}</td>
                    <td className="table-td">{report.row_count}</td>
                    <td className="table-td">{new Date(report.created_at).toLocaleString()}</td>
                    <td className="table-td">{report.file_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
