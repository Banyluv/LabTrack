import React, { useState } from 'react';

function AdminUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('excelFile', file);
    setUploading(true);

    try {
      const response = await fetch('http://localhost:5000/admin/upload-excel', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      setMessage('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="admin-upload">
      <h2>Admin: Upload Excel File</h2>
      <input 
        type="file" 
        accept=".xlsx, .xls" 
        onChange={handleFileChange} 
      />
      <button onClick={handleUpload} disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload to Database'}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}

export default AdminUpload;