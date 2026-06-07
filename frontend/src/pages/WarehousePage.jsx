import { useState, useEffect, useRef } from 'react';
import { warehousesAPI } from '../api';
import toast from 'react-hot-toast';
import { Warehouse, Plus, ChevronRight, Edit2, Archive, FolderPlus, QrCode, Download, Printer, X } from 'lucide-react';
import QRCode from 'qrcode';

export default function WarehousePage() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Selection
  const [selectedWh, setSelectedWh] = useState(null);
  const [sections, setSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

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
  const qrCanvasRef = useRef(null);

  const loadWarehouses = () => {
    setLoading(true);
    warehousesAPI.list()
      .then(r => setWarehouses(r.data.data))
      .catch(() => toast.error('Failed to load warehouses'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadWarehouses();
  }, []);

  const loadSections = (whId) => {
    setSectionsLoading(true);
    warehousesAPI.sections(whId)
      .then(r => setSections(r.data.data))
      .catch(() => toast.error('Failed to load sections'))
      .finally(() => setSectionsLoading(false));
  };

  const handleSelectWh = (wh) => {
    setSelectedWh(wh);
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
    e.stopPropagation();
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
        <div className="page-header-right">
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
            <div className="card-title">Warehouses</div>
          </div>

          {loading ? (
            <div className="loading-center"><div className="loading-spinner"></div></div>
          ) : warehouses.length === 0 ? (
            <div className="empty-state">
              <Warehouse size={32} />
              <p>No warehouses created yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {warehouses.map(wh => {
                const isSelected = selectedWh?.id === wh.id;
                return (
                  <div 
                    key={wh.id}
                    className={`nav-item`}
                    onClick={() => handleSelectWh(wh)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)', padding: '14px 16px', color: 'var(--color-text-primary)'
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
                      <button className="btn btn-ghost btn-icon" onClick={(e) => handleEditWh(wh, e)}>
                        <Edit2 size={13} />
                      </button>
                      <button className="btn btn-ghost btn-icon text-danger" onClick={(e) => handleArchiveWh(wh.id, e)}>
                        <Archive size={13} />
                      </button>
                      <ChevronRight size={16} color="var(--color-text-muted)" style={{ alignSelf: 'center', marginLeft: 4 }} />
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
              <div className="card-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 16 }}>
                <div>
                  <div className="card-title">Sections in "{selectedWh.name}"</div>
                  <div className="card-subtitle">{selectedWh.location || 'No location configured'}</div>
                </div>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => { setEditingSecId(null); setSecName(''); setSecDesc(''); setShowSecModal(true); }}
                >
                  <FolderPlus size={14} />
                  Add Section
                </button>
              </div>

              <div style={{ marginTop: 20 }}>
                {sectionsLoading ? (
                  <div className="loading-center"><div className="loading-spinner"></div></div>
                ) : sections.length === 0 ? (
                  <div className="empty-state">
                    <FolderPlus size={36} />
                    <p>No storage sections defined in this warehouse.</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Section Name</th>
                          <th>Description</th>
                          <th style={{ textAlign: 'center' }}>QR Label</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sections.map(s => (
                          <tr key={s.id}>
                            <td style={{ fontWeight: 700 }}>{s.name}</td>
                            <td>{s.description || '-'}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleShowQr(s)}
                                title="View & Print QR Code"
                                style={{ gap: 5 }}
                              >
                                <QrCode size={13} />
                                QR
                              </button>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 4 }}>
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleEditSec(s)}>
                                  <Edit2 size={13} />
                                </button>
                                <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => handleArchiveSec(s.id)}>
                                  <Archive size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
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
    </div>
  );
}
