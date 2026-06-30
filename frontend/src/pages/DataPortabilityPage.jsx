import { useState, useEffect, useRef } from 'react';
import { dataPortabilityAPI } from '../api';
import toast from 'react-hot-toast';
import { Database, Download, Upload, Search, RefreshCw, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';

export default function DataPortabilityPage() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [importingTable, setImportingTable] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({}); // { tableName: boolean }
  const fileInputRef = useRef(null);

  const loadTables = async () => {
    setLoading(true);
    try {
      const res = await dataPortabilityAPI.listTables();
      setTables(res.data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load database tables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTables();
  }, []);

  const handleExport = async (tableName) => {
    const loadingToast = toast.loading(`Exporting ${tableName}...`);
    try {
      const res = await dataPortabilityAPI.exportTable(tableName);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${tableName}_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success(`${tableName} exported successfully!`, { id: loadingToast });
    } catch (err) {
      toast.error(`Failed to export ${tableName}`, { id: loadingToast });
    }
  };

  const handleDownloadTemplate = async (tableName) => {
    const loadingToast = toast.loading(`Generating template for ${tableName}...`);
    try {
      const res = await dataPortabilityAPI.getTemplate(tableName);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${tableName}_template.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`${tableName} template downloaded!`, { id: loadingToast });
    } catch (err) {
      toast.error(`Failed to generate template for ${tableName}`, { id: loadingToast });
    }
  };

  const triggerFileInput = (tableName) => {
    setImportingTable(tableName);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !importingTable) return;

    // Reset input
    e.target.value = '';

    const tableName = importingTable;
    setImportingTable(null);

    const loadingToast = toast.loading(`Importing data into ${tableName}...`);
    setUploadProgress(prev => ({ ...prev, [tableName]: true }));

    try {
      const res = await dataPortabilityAPI.importTable(tableName, file);
      toast.success(res.data.message || `Imported successfully into ${tableName}!`, { 
        id: loadingToast,
        duration: 5000 
      });
      loadTables(); // Refresh row counts
    } catch (err) {
      const errMsg = err.response?.data?.message || `Failed to import into ${tableName}`;
      toast.error(
        <div style={{ maxHeight: 200, overflowY: 'auto' }}>
          <strong>Import Failed:</strong>
          <p style={{ margin: '4px 0 0 0', fontSize: 12 }}>{errMsg}</p>
        </div>,
        { id: loadingToast, duration: 8000 }
      );
    } finally {
      setUploadProgress(prev => ({ ...prev, [tableName]: false }));
    }
  };

  const handleExportAll = async () => {
    const activeTables = filteredTables;
    if (activeTables.length === 0) return;
    
    if (!window.confirm(`Are you sure you want to export all ${activeTables.length} tables? This will trigger multiple downloads.`)) {
      return;
    }

    for (const table of activeTables) {
      await handleExport(table.name);
      // Small delay between downloads to prevent browser blocking
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const filteredTables = tables.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fade-in">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".csv" 
        style={{ display: 'none' }} 
      />

      <div className="page-header">
        <div className="page-header-left">
          <h2>Data Portability</h2>
          <p>Export database tables to CSV or import/upsert data back into the system</p>
        </div>
        <div className="page-header-right" style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={loadTables} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-primary" onClick={handleExportAll} disabled={loading || filteredTables.length === 0}>
            <Download size={16} />
            Export All ({filteredTables.length})
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: 16,
        background: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 24,
        fontSize: 13,
        color: 'var(--color-text)'
      }}>
        <AlertCircle size={20} style={{ color: 'var(--color-primary-light)', flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong style={{ color: 'var(--color-primary-light)', display: 'block', marginBottom: 4 }}>Important Import Guidelines:</strong>
          <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.6 }}>
            <li>CSV headers must exactly match the database table column names (case-insensitive).</li>
            <li>If the CSV contains an <code>id</code> column, the system will perform an <strong>UPSERT</strong> (insert new rows or update existing rows on ID match).</li>
            <li>If there is no <code>id</code> column, the system will perform a standard <strong>INSERT</strong>.</li>
            <li>Foreign key constraints are enforced. Please import master tables (like <code>warehouses</code>, <code>products</code>) before transactional tables (like <code>stock_transactions</code>, <code>bom</code>).</li>
          </ul>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
          <Search size={18} style={{ color: 'var(--color-text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search tables by name..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text)',
              outline: 'none',
              fontSize: 14
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-center"><div className="loading-spinner"></div></div>
      ) : filteredTables.length === 0 ? (
        <div className="empty-state">
          <Database size={36} />
          <p>No tables found matching your search.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16
        }}>
          {filteredTables.map(table => (
            <div key={table.name} className="card" style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: 20,
              transition: 'transform 0.2s, box-shadow 0.2s',
              border: '1px solid var(--color-border)'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileSpreadsheet size={20} style={{ color: 'var(--color-primary-light)' }} />
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
                      {table.name}
                    </span>
                  </div>
                  <span className="badge badge-gray" style={{ fontSize: 11 }}>
                    {table.rowCount.toLocaleString()} rows
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
                  <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.4 }}>
                    Manage bulk data portability for <code>{table.name}</code>.
                  </p>
                  <button 
                    className="btn btn-link btn-sm" 
                    onClick={() => handleDownloadTemplate(table.name)}
                    style={{ fontSize: 12, color: 'var(--color-primary-light)', padding: '2px 6px', border: '1px dashed rgba(59, 130, 246, 0.3)', borderRadius: '4px', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Template
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => handleExport(table.name)}
                >
                  <Download size={14} />
                  Export
                </button>
                <button 
                  className="btn btn-primary btn-sm" 
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => triggerFileInput(table.name)}
                  disabled={uploadProgress[table.name]}
                >
                  <Upload size={14} />
                  {uploadProgress[table.name] ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
