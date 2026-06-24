import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { X, Wifi, AlertTriangle } from 'lucide-react';
import { getApiBase } from '../api';

export default function ServerSettings({ isOpen, onClose }) {
  const [customUrl, setCustomUrl] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCustomUrl(localStorage.getItem('customApiUrl') || '');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    const trimmed = customUrl.trim();
    if (!trimmed) {
      toast.error('Please enter a URL to test');
      return;
    }
    
    setTesting(true);
    try {
      // Test requesting a generic/public api endpoint, or just the root
      await axios.get(`${trimmed}/roles/permissions`, { timeout: 6000 });
      toast.success('Connection successful!');
    } catch (err) {
      if (err.response) {
        // Any response from the backend means the server is reachable and active
        toast.success(`Server reachable! (Response code: ${err.response.status})`);
      } else {
        toast.error('Could not reach server. Verify the URL is correct and backend is running.');
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    const trimmed = customUrl.trim();
    if (trimmed) {
      localStorage.setItem('customApiUrl', trimmed);
    } else {
      localStorage.removeItem('customApiUrl');
    }
    toast.success('Server settings saved successfully!');
    onClose();
    // Reloading app to apply the new base API URL dynamically and clear state
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleReset = () => {
    localStorage.removeItem('customApiUrl');
    setCustomUrl('');
    toast.success('Restored default server settings.');
    onClose();
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wifi size={18} className="text-primary" /> API Server Connection
          </h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          <div className="form-group">
            <label className="form-label">Backend API URL</label>
            <input
              type="text"
              className="form-control"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="e.g. http://192.168.1.100:5000/api"
              style={{ fontSize: '13.5px' }}
            />
          </div>

          <div style={{
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            fontSize: '12px',
            lineHeight: '1.5',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
              <AlertTriangle size={14} className="text-warning" /> Current Settings
            </div>
            <div>
              <strong>Active URL:</strong> <code>{getApiBase()}</code>
            </div>
            <div>
              <strong>Fallback Defaults:</strong>
              <ul style={{ paddingLeft: '16px', marginTop: '4px', listStyleType: 'disc' }}>
                <li>Web: <code>http://localhost:5000/api</code></li>
                <li>Android Emulator: <code>http://10.0.2.2:5000/api</code></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '16px 24px', display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleReset}
            style={{ marginRight: 'auto' }}
          >
            Reset
          </button>
          
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTestConnection}
            disabled={testing}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
          >
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
}
