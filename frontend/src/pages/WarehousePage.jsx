import { useState, useEffect, useRef } from 'react';
import { warehousesAPI } from '../api';
import toast from 'react-hot-toast';
import { Warehouse, Plus, ChevronRight, Edit2, Archive, FolderPlus, QrCode, Download, Printer, X, RotateCcw, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';
import useBulkActions from '../hooks/useBulkActions';
import BulkActionBar from '../components/BulkActionBar';

// Bulk QR Label Print Sheet Modal
function BulkQrModal({ sections, warehouse, onClose }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    // Render each section's QR code on its respective canvas
    sections.forEach(async (sec) => {
      const canvas = document.getElementById(`bulk-qr-${sec.id}`);
      if (canvas) {
        const qrPayload = JSON.stringify({
          type: 'TTRIMS_SECTION',
          section_id: sec.id,
          section_name: sec.name,
          warehouse_id: sec.warehouse_id,
          warehouse_name: sec.warehouse_name || warehouse.name,
          warehouse_location: warehouse.location || ''
        });
        await QRCode.toCanvas(canvas, qrPayload, {
          width: 140,
          margin: 2,
          color: { dark: '#111111', light: '#ffffff' }
        });
      }
    });
  }, [sections, warehouse]);

  const handlePrint = () => {
    document.body.classList.add('qr-print-mode');
    window.print();
    setTimeout(() => document.body.classList.remove('qr-print-mode'), 500);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', width: '90vw', maxWidth: 800, maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--color-surface)', borderRadius: 16,
        border: '1px solid var(--color-border)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column'
      }}>
        <div style={{
          padding: '20px 24px 16px',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.12))',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <QrCode size={18} color="var(--color-primary-light)" />
            <span>Bulk QR Label Sheet ({sections.length} Selected)</span>
          </h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }} ref={containerRef}>
          <div className="qr-print-target bulk-qr-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 20,
            justifyContent: 'center'
          }}>
            {sections.map(sec => (
              <div key={sec.id} className="qr-label-card" style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                color: '#111111',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>📦</span>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#1d4ed8' }}>TTRIMS IMS</div>
                </div>
                <canvas id={`bulk-qr-${sec.id}`} style={{ width: 120, height: 120 }} />
                <div style={{ fontSize: 11, fontWeight: 800, textAlign: 'center', marginTop: 4, width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {warehouse.name}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#111', textAlign: 'center', margin: '2px 0' }}>
                  📂 {sec.name}
                </div>
                <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' }}>
                  ID: {sec.id.slice(0, 8).toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--color-border)' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handlePrint} style={{ display: 'flex', gap: 6 }}>
            <Printer size={15} />
            Print QR Sheet
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WarehousePage() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selection
  const [selectedWh, setSelectedWh] = useState(null);
  const [sections, setSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [showArchivedWh, setShowArchivedWh] = useState(false);
  const [showArchivedSec, setShowArchivedSec] = useState(false);

  // Modal States
  const [showWhModal, setShowWhModal] = useState(false);
  const [whName, setWhName] = useState('');
  const [whLocation, setWhLocation] = useState('');
  const [editingWhId, setEditingWhId] = useState(null);

  const [showSecModal, setShowSecModal] = useState(false);
  const [secName, setSecName] = useState('');
  const [secDesc, setSecDesc] = useState('');
  const [editingSecId, setEditingSecId] = useState(null);

  // QR Modal
  const [qrSection, setQrSection] = useState(null); // section being previewed
  const [showBulkQr, setShowBulkQr] = useState(false);
  const qrCanvasRef = useRef(null);

  const loadWarehouses = (archived = showArchivedWh) => {
    setLoading(true);
    warehousesAPI.list({ active: !archived })
      .then(r => setWarehouses(r.data.data))
      .catch(() => toast.error('Failed to load warehouses'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadWarehouses(showArchivedWh);
    setSelectedWh(null);
    setSections([]);
  }, [showArchivedWh]);

  const loadSections = (whId, archived = showArchivedSec) => {
    setSectionsLoading(true);
    warehousesAPI.sections(whId, { active: !archived })
      .then(r => setSections(r.data.data))
      .catch(() => toast.error('Failed to load sections'))
      .finally(() => setSectionsLoading(false));
  };

  useEffect(() => {
    if (selectedWh) {
      loadSections(selectedWh.id, showArchivedSec);
      clearSelection();
    }
  }, [showArchivedSec]);

  const handleSelectWh = (wh) => {
    setSelectedWh(wh);
    clearSelection();
    loadSections(wh.id);
  };

  // Warehouse CRUD
  const handleWhSubmit = async (e) => {
    e.preventDefault();
    if (!whName.trim()) return toast.error('Name is required');

    try {
      const payload = { name: whName, location: whLocation };
      if (editingWhId) {
        await warehousesAPI.update(editingWhId, payload);
        toast.success('Warehouse updated successfully');
      } else {
        await warehousesAPI.create(payload);
        toast.success('Warehouse created successfully');
      }
      setShowWhModal(false);
      setWhName('');
      setWhLocation('');
      setEditingWhId(null);
      loadWarehouses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save warehouse');
    }
  };

  const handleEditWh = (wh, e) => {
    e.stopPropagation();
    setEditingWhId(wh.id);
    setWhName(wh.name);
    setWhLocation(wh.location || '');
    setShowWhModal(true);
  };

  const handleArchiveWh = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to archive this warehouse?')) return;
    try {
      await warehousesAPI.delete(id);
      toast.success('Warehouse archived');
      if (selectedWh?.id === id) setSelectedWh(null);
      loadWarehouses();
    } catch (err) {
      toast.error('Failed to archive warehouse');
    }
  };

  const handleRestoreWh = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to restore this warehouse?')) return;
    try {
      await warehousesAPI.update(id, { is_active: true });
      toast.success('Warehouse restored successfully');
      loadWarehouses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore warehouse');
    }
  };

  const handleDeletePermanentWh = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('WARNING: Are you sure you want to PERMANENTLY delete this warehouse? This action cannot be undone.')) return;
    try {
      await warehousesAPI.delete(id, { permanent: true });
      toast.success('Warehouse permanently deleted');
      if (selectedWh?.id === id) setSelectedWh(null);
      loadWarehouses();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to permanently delete warehouse');
    }
  };

  // Section CRUD
  const handleSecSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWh) return;
    if (!secName.trim()) return toast.error('Name is required');

    try {
      const payload = { name: secName, description: secDesc };
      if (editingSecId) {
        await warehousesAPI.updateSection(selectedWh.id, editingSecId, payload);
        toast.success('Section updated successfully');
      } else {
        await warehousesAPI.createSection(selectedWh.id, payload);
        toast.success('Section created successfully');
      }
      setShowSecModal(false);
      setSecName('');
      setSecDesc('');
      setEditingSecId(null);
      loadSections(selectedWh.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save section');
    }
  };

  const handleEditSec = (sec) => {
    setEditingSecId(sec.id);
    setSecName(sec.name);
    setSecDesc(sec.description || '');
    setShowSecModal(true);
  };

  const handleArchiveSec = async (id) => {
    if (!window.confirm('Are you sure you want to archive this section?')) return;
    try {
      await warehousesAPI.deleteSection(selectedWh.id, id);
      toast.success('Section archived');
      loadSections(selectedWh.id);
    } catch (err) {
      toast.error('Failed to archive section');
    }
  };

  const handleRestoreSec = async (id) => {
    if (!window.confirm('Are you sure you want to restore this section?')) return;
    try {
      await warehousesAPI.updateSection(selectedWh.id, id, { is_active: true });
      toast.success('Section restored successfully');
      loadSections(selectedWh.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore section');
    }
  };

  const handleDeletePermanentSec = async (id) => {
    if (!window.confirm('WARNING: Are you sure you want to PERMANENTLY delete this section? This action cannot be undone.')) return;
    try {
      await warehousesAPI.deleteSection(selectedWh.id, id, { permanent: true });
      toast.success('Section permanently deleted');
      loadSections(selectedWh.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to permanently delete section');
    }
  };

  // Bulk Actions Hook
  const {
    selectedIds,
    isSelected,
    toggleSelect,
    toggleSelectAll,
    isAllSelected,
    clearSelection,
    getSelectedItems,
    selectedCount
  } = useBulkActions(sections);

  const handleBulkExport = () => {
    const selected = getSelectedItems();
    let csvContent = 'Section Name,Description,Warehouse Name,Location\n';
    
    selected.forEach(s => {
      const row = [
        s.name,
        s.description || '',
        selectedWh?.name || '',
        selectedWh?.location || ''
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
      csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sections_export_${selectedWh?.name || 'warehouse'}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedCount} sections to CSV`);
  };

  const handleBulkArchive = async () => {
    if (!window.confirm(`Are you sure you want to archive ${selectedCount} sections?`)) return;
    const loadingToast = toast.loading(`Archiving ${selectedCount} sections...`);
    try {
      for (const id of selectedIds) {
        await warehousesAPI.deleteSection(selectedWh.id, id);
      }
      toast.success('Selected sections archived successfully', { id: loadingToast });
      clearSelection();
      loadSections(selectedWh.id);
    } catch (err) {
      toast.error('Failed to archive some sections', { id: loadingToast });
    }
  };

  const handleBulkRestore = async () => {
    if (!window.confirm(`Are you sure you want to restore ${selectedCount} sections?`)) return;
    const loadingToast = toast.loading(`Restoring ${selectedCount} sections...`);
    try {
      for (const id of selectedIds) {
        await warehousesAPI.updateSection(selectedWh.id, id, { is_active: true });
      }
      toast.success('Selected sections restored successfully', { id: loadingToast });
      clearSelection();
      loadSections(selectedWh.id);
    } catch (err) {
      toast.error('Failed to restore some sections', { id: loadingToast });
    }
  };

  const handleBulkDeletePermanent = async () => {
    if (!window.confirm(`WARNING: Are you sure you want to PERMANENTLY delete ${selectedCount} sections? This action cannot be undone.`)) return;
    const loadingToast = toast.loading(`Deleting ${selectedCount} sections permanently...`);
    try {
      for (const id of selectedIds) {
        await warehousesAPI.deleteSection(selectedWh.id, id, { permanent: true });
      }
      toast.success('Selected sections permanently deleted', { id: loadingToast });
      clearSelection();
      loadSections(selectedWh.id);
    } catch (err) {
      toast.error('Failed to permanently delete some sections. They may be referenced in records.', { id: loadingToast });
    }
  };

  // ─── QR Code Logic ────────────────────────────────────────────────────────────

  const buildQrPayload = (section) => JSON.stringify({
    type: 'TTRIMS_SECTION',
    section_id: section.id,
    section_name: section.name,
    warehouse_id: section.warehouse_id,
    warehouse_name: section.warehouse_name,
    warehouse_location: selectedWh?.location || ''
  });

  const handleShowQr = async (section) => {
    setQrSection(section);
    // render QR on next tick once canvas ref mounts
    setTimeout(async () => {
      if (qrCanvasRef.current) {
        await QRCode.toCanvas(qrCanvasRef.current, buildQrPayload(section), {
          width: 220,
          margin: 2,
          color: { dark: '#111111', light: '#ffffff' }
        });
      }
    }, 80);
  };

  const handleDownloadQr = () => {
    if (!qrCanvasRef.current || !qrSection) return;
    const link = document.createElement('a');
    link.download = `QR_${qrSection.warehouse_name}_${qrSection.name}.png`.replace(/\s+/g, '_');
    link.href = qrCanvasRef.current.toDataURL('image/png');
    link.click();
  };

  const handlePrintQr = () => {
    document.body.classList.add('qr-print-mode');
    window.print();
    setTimeout(() => document.body.classList.remove('qr-print-mode'), 500);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Warehouses & Sections</h2>
          <p>Configure storage centers and section locations inside them</p>
        </div>
        <div className="page-header-right" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--color-bg-card)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <button 
              className={`btn btn-sm ${!showArchivedWh ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => { setShowArchivedWh(false); }}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              Active
            </button>
            <button 
              className={`btn btn-sm ${showArchivedWh ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => { setShowArchivedWh(true); }}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              Archived
            </button>
          </div>
          <button className="btn btn-primary" onClick={() => { setEditingWhId(null); setWhName(''); setWhLocation(''); setShowWhModal(true); }}>
            <Plus size={16} />
            Add Warehouse
          </button>
        </div>
      </div>

      <div className="responsive-grid-2-3">
        
        {/* Warehouse list */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">{showArchivedWh ? 'Archived Warehouses' : 'Warehouses'}</div>
          </div>

          {loading ? (
            <div className="loading-center"><div className="loading-spinner"></div></div>
          ) : warehouses.length === 0 ? (
            <div className="empty-state">
              <Warehouse size={32} />
              <p>{showArchivedWh ? 'No archived warehouses found' : 'No warehouses created yet'}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {warehouses.map(wh => {
                const isSelected = selectedWh?.id === wh.id;
                return (
                  <div 
                    key={wh.id}
                    className={`nav-item`}
                    onClick={() => !showArchivedWh && handleSelectWh(wh)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)', padding: '14px 16px', color: 'var(--color-text-primary)',
                      cursor: showArchivedWh ? 'default' : 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 20 }}>🏢</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{wh.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>
                          {wh.location || 'No address'} · {wh.section_count || 0} Sections
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {!showArchivedWh ? (
                        <>
                          <button className="btn btn-ghost btn-icon" onClick={(e) => handleEditWh(wh, e)} title="Edit Warehouse">
                            <Edit2 size={13} />
                          </button>
                          <button className="btn btn-ghost btn-icon text-danger" onClick={(e) => handleArchiveWh(wh.id, e)} title="Archive Warehouse">
                            <Archive size={13} />
                          </button>
                          <ChevronRight size={16} color="var(--color-text-muted)" style={{ alignSelf: 'center', marginLeft: 4 }} />
                        </>
                      ) : (
                        <>
                          <button className="btn btn-ghost btn-icon text-success" onClick={(e) => handleRestoreWh(wh.id, e)} title="Restore Warehouse">
                            <RotateCcw size={13} />
                          </button>
                          <button className="btn btn-ghost btn-icon text-danger" onClick={(e) => handleDeletePermanentWh(wh.id, e)} title="Permanently Delete">
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section Management */}
        <div className="card">
          {selectedWh ? (
            <div>
              <div className="card-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="card-title">{showArchivedSec ? `Archived Sections in "${selectedWh.name}"` : `Sections in "${selectedWh.name}"`}</div>
                  <div className="card-subtitle">{selectedWh.location || 'No location configured'}</div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ display: 'flex', background: 'var(--color-bg-card)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                    <button 
                      className={`btn btn-sm ${!showArchivedSec ? 'btn-primary' : 'btn-ghost'}`} 
                      onClick={() => { setShowArchivedSec(false); }}
                      style={{ padding: '4px 8px', fontSize: 11 }}
                    >
                      Active
                    </button>
                    <button 
                      className={`btn btn-sm ${showArchivedSec ? 'btn-primary' : 'btn-ghost'}`} 
                      onClick={() => { setShowArchivedSec(true); }}
                      style={{ padding: '4px 8px', fontSize: 11 }}
                    >
                      Archived
                    </button>
                  </div>
                  {!showArchivedSec && (
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => { setEditingSecId(null); setSecName(''); setSecDesc(''); setShowSecModal(true); }}
                    >
                      <FolderPlus size={14} />
                      Add Section
                    </button>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                {sectionsLoading ? (
                  <div className="loading-center"><div className="loading-spinner"></div></div>
                ) : sections.length === 0 ? (
                  <div className="empty-state">
                    <FolderPlus size={36} />
                    <p>{showArchivedSec ? 'No archived sections found.' : 'No storage sections defined in this warehouse.'}</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: 40, textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={isAllSelected} 
                              onChange={toggleSelectAll} 
                              style={{ cursor: 'pointer' }}
                            />
                          </th>
                          <th>Section Name</th>
                          <th>Description</th>
                          <th style={{ textAlign: 'center' }}>QR Label</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sections.map(s => {
                          const isChecked = isSelected(s.id);
                          return (
                            <tr key={s.id} style={{ background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                              <td style={{ textAlign: 'center' }}>
                                <input 
                                  type="checkbox" 
                                  checked={isChecked} 
                                  onChange={() => toggleSelect(s.id)} 
                                  style={{ cursor: 'pointer' }}
                               />
                              </td>
                              <td style={{ fontWeight: 700 }}>{s.name}</td>
                              <td>{s.description || '-'}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleShowQr(s)}
                                  title="View & Print QR Code"
                                  style={{ gap: 5 }}
                                  disabled={showArchivedSec}
                                >
                                  <QrCode size={13} />
                                  QR
                                </button>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: 4 }}>
                                  {!showArchivedSec ? (
                                    <>
                                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleEditSec(s)} title="Edit Section">
                                        <Edit2 size={13} />
                                      </button>
                                      <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => handleArchiveSec(s.id)} title="Archive Section">
                                        <Archive size={13} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button className="btn btn-ghost btn-icon btn-sm text-success" onClick={() => handleRestoreSec(s.id)} title="Restore Section">
                                        <RotateCcw size={13} />
                                      </button>
                                      <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => handleDeletePermanentSec(s.id)} title="Permanently Delete">
                                        <Trash2 size={13} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ height: '100%', display: 'flex', justifyContent: 'center' }}>
              <Warehouse size={48} style={{ opacity: 0.3 }} />
              <h3>Select a Warehouse</h3>
              <p>Choose a warehouse from the left list to load and configure its internal layout sections.</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── QR Preview Modal ──────────────────────────────────────────────────── */}
      {qrSection && (
        <div className="modal-overlay" onClick={() => setQrSection(null)}>
          <div className="qr-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <QrCode size={18} color="var(--color-primary-light)" />
                <h3 className="modal-title">Section QR Label</h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setQrSection(null)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '8px 24px 24px' }}>
              {/* Printable QR Card */}
              <div className="qr-print-target">
                <div className="qr-label-card">
                  {/* TTRIMS logo strip */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 22 }}>📦</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#1d4ed8', letterSpacing: 1 }}>TTRIMS IMS</div>
                      <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 0.5 }}>INVENTORY MANAGEMENT</div>
                    </div>
                  </div>

                  {/* QR Canvas */}
                  <canvas ref={qrCanvasRef} style={{ display: 'block' }} />

                  {/* Labels */}
                  <div className="qr-label-title">
                    {qrSection.warehouse_name}
                  </div>
                  <div style={{ width: '100%', height: 1, background: '#e5e7eb' }} />
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#111', textAlign: 'center' }}>
                    📂 {qrSection.name}
                  </div>
                  {qrSection.description && (
                    <div className="qr-label-subtitle">{qrSection.description}</div>
                  )}
                  {selectedWh?.location && (
                    <div className="qr-label-subtitle" style={{ color: '#374151' }}>
                      📍 {selectedWh.location}
                    </div>
                  )}
                  <div className="qr-label-badge">
                    ID: {qrSection.id.slice(0, 8).toUpperCase()}
                  </div>
                  <div style={{ fontSize: 9, color: '#9ca3af', letterSpacing: 0.3, textAlign: 'center' }}>
                    Scan this QR code to record Stock IN / OUT for this section
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleDownloadQr}>
                  <Download size={15} />
                  Download PNG
                </button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handlePrintQr}>
                  <Printer size={15} />
                  Print QR Label
                </button>
              </div>

              <p style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 12, textAlign: 'center', lineHeight: 1.6 }}>
                Print and affix this label to the physical shelf or rack. Use the QR scanner on Stock IN / OUT pages to record transactions instantly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bulk QR Printable Sheet Modal ────────────────────────────────────── */}
      {showBulkQr && (
        <BulkQrModal
          sections={getSelectedItems()}
          warehouse={selectedWh}
          onClose={() => { setShowBulkQr(false); clearSelection(); }}
        />
      )}

      {/* Warehouse Modal */}
      {showWhModal && (
        <div className="modal-overlay" onClick={() => setShowWhModal(false)}>
          <form className="modal" onSubmit={handleWhSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingWhId ? 'Update Warehouse' : 'Add Warehouse'}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowWhModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Warehouse Name <span>*</span></label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={whName} 
                  onChange={(e) => setWhName(e.target.value)} 
                  placeholder="e.g. Warehouse A, Finished Goods Hub"
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Location / Address</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={whLocation} 
                  onChange={(e) => setWhLocation(e.target.value)} 
                  placeholder="e.g. Block C, Industrial Zone"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowWhModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Warehouse</button>
            </div>
          </form>
        </div>
      )}

      {/* Section Modal */}
      {showSecModal && (
        <div className="modal-overlay" onClick={() => setShowSecModal(false)}>
          <form className="modal" onSubmit={handleSecSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingSecId ? 'Update Section' : 'Add Section'}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSecModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Section Name <span>*</span></label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={secName} 
                  onChange={(e) => setSecName(e.target.value)} 
                  placeholder="e.g. Row 3, Rack B, Cold Room"
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description / Storage Notes</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={secDesc} 
                  onChange={(e) => setSecDesc(e.target.value)} 
                  placeholder="e.g. Heavy load items, fragile products"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowSecModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Section</button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      <BulkActionBar 
        selectedCount={selectedCount}
        onClear={clearSelection}
        actions={!showArchivedSec ? [
          {
            label: 'Export CSV',
            icon: <Download size={16} />,
            onClick: handleBulkExport,
            className: 'btn-secondary'
          },
          {
            label: 'Print QR Labels',
            icon: <Printer size={16} />,
            onClick: () => setShowBulkQr(true),
            className: 'btn-primary'
          },
          {
            label: 'Archive Selected',
            icon: <Archive size={16} />,
            onClick: handleBulkArchive,
            className: 'btn-danger text-danger'
          }
        ] : [
          {
            label: 'Export CSV',
            icon: <Download size={16} />,
            onClick: handleBulkExport,
            className: 'btn-secondary'
          },
          {
            label: 'Restore Selected',
            icon: <RotateCcw size={16} />,
            onClick: handleBulkRestore,
            className: 'btn-success text-success'
          },
          {
            label: 'Permanently Delete Selected',
            icon: <Trash2 size={16} />,
            onClick: handleBulkDeletePermanent,
            className: 'btn-danger text-danger'
          }
        ]}
      />
    </div>
  );
}
