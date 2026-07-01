import { useState, useEffect, useCallback } from 'react';
import { usersAPI, ordersAPI, visitAllocationsAPI } from '../api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  MapPin, Calendar, User, Plus, Trash2, ArrowUp, ArrowDown,
  RefreshCw, List, Map, AlertCircle, CheckCircle2, X, Search, Info
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Helper to center Map on bounds of visit locations
function MapBounds({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords && coords.length > 0) {
      const validCoords = coords.filter(c => c && !isNaN(c[0]) && !isNaN(c[1]));
      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords);
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      }
    }
  }, [coords, map]);
  return null;
}

// Custom Marker Icon Maker showing sequence number
function createSequenceMarker(seq, name, status) {
  const color = status === 'COMPLETED' ? '#10b981' : status === 'SKIPPED' ? '#ef4444' : '#3b82f6';
  const size = 32;
  const html = `
    <div style="position:relative; width:${size}px; height:${size}px;">
      <div style="
        position:absolute; inset:0;
        background:${color};
        border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        color:#fff; font-weight:900; font-size:13px;
        border: 2.5px solid white;
        box-shadow: 0 3px 10px rgba(0,0,0,0.4);
      ">${seq}</div>
    </div>`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

export default function VisitAllocationsPage() {
  const { user } = useAuth();
  const [salespersons, setSalespersons] = useState([]);
  const [selectedSalespersonId, setSelectedSalespersonId] = useState('');
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [allocations, setAllocations] = useState([]);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [targets, setTargets] = useState([]); // combined list of leads and customers
  const [loadingTargets, setLoadingTargets] = useState(false);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // View mode toggler (List vs Map)
  const [viewMode, setViewMode] = useState('both'); // both | list | map

  // Load Salespersons
  const loadSalespersons = useCallback(async () => {
    try {
      const res = await usersAPI.list();
      const list = res.data.data || [];
      // Filter users who belong to Sales category or have Sales role
      const salesUsers = list.filter(u => 
        u.is_active && 
        ((u.role_name && u.role_name.toLowerCase().includes('sales')) || 
         (u.role && u.role.toLowerCase().includes('sales')) ||
         u.warehouse_id === null // salespersons are typically not restricted to one warehouse
        )
      );
      // Fallback to all users if none matches sales criteria specifically
      const finalSalesList = salesUsers.length > 0 ? salesUsers : list.filter(u => u.is_active);
      setSalespersons(finalSalesList);
      if (finalSalesList.length > 0) {
        setSelectedSalespersonId(finalSalesList[0].id);
      }
    } catch (err) {
      toast.error('Failed to load salespersons');
    }
  }, []);

  // Load Allocations
  const loadAllocations = useCallback(async () => {
    if (!selectedSalespersonId || !visitDate) return;
    setLoadingAllocations(true);
    try {
      const res = await visitAllocationsAPI.list({
        salespersonId: selectedSalespersonId,
        date: visitDate
      });
      setAllocations(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load visit allocations');
    } finally {
      setLoadingAllocations(false);
    }
  }, [selectedSalespersonId, visitDate]);

  // Load target leads and customers from orders API
  const loadTargets = useCallback(async () => {
    setLoadingTargets(true);
    try {
      const res = await ordersAPI.listOutstanding();
      const list = res.data.data || [];
      
      // Filter out and build descriptive label
      const mappedTargets = list.map(item => {
        const isLead = item.status === 'PENDING' && (!item.invoice_number || item.invoice_number.startsWith('ORD-'));
        const lat = item.custom_fields?.latitude;
        const lng = item.custom_fields?.longitude;
        const hasGPS = lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng));
        
        return {
          id: item.id,
          customer: item.customer || item.customer_name,
          type: isLead ? 'LEAD' : 'CUSTOMER',
          grand_total: item.grand_total,
          balance: item.balance || 0,
          order_number: item.order_number || item.invoice_number,
          hasGPS,
          latitude: lat,
          longitude: lng,
          phone: item.custom_fields?.phone || '—',
          email: item.custom_fields?.email || '—'
        };
      });
      setTargets(mappedTargets);
    } catch (err) {
      toast.error('Failed to load target leads/customers');
    } finally {
      setLoadingTargets(false);
    }
  }, []);

  useEffect(() => {
    loadSalespersons();
    loadTargets();
  }, [loadSalespersons, loadTargets]);

  useEffect(() => {
    loadAllocations();
  }, [loadAllocations]);

  // Handle reordering allocations
  const handleReorder = async (index, direction) => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === allocations.length - 1) return;

    const newAllocations = [...allocations];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    
    // Swap
    const temp = newAllocations[index];
    newAllocations[index] = newAllocations[targetIdx];
    newAllocations[targetIdx] = temp;

    // Call reorder API with list of sorted IDs
    const ids = newAllocations.map(a => a.id);
    const loadingToast = toast.loading('Reordering allocations...');
    try {
      await visitAllocationsAPI.reorder(ids);
      setAllocations(newAllocations.map((item, idx) => ({ ...item, sequence: idx + 1 })));
      toast.success('Sequence updated successfully!', { id: loadingToast });
    } catch (err) {
      toast.error('Failed to reorder sequence', { id: loadingToast });
    }
  };

  // Handle deleting allocation
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this visit allocation?')) return;
    try {
      await visitAllocationsAPI.delete(id);
      toast.success('Visit allocation deleted');
      loadAllocations();
    } catch (err) {
      toast.error('Failed to delete allocation');
    }
  };

  // Submit new allocation
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!selectedSalespersonId) return toast.error('Please select a salesperson');
    if (!selectedTargetId) return toast.error('Please select a target customer or lead');
    if (!visitDate) return toast.error('Please select a visit date');

    setSubmitting(true);
    try {
      await visitAllocationsAPI.create({
        salespersonId: selectedSalespersonId,
        orderId: selectedTargetId,
        visitDate,
        notes: notes.trim() || undefined
      });
      toast.success('Visit allocated successfully!');
      setShowModal(false);
      setSelectedTargetId('');
      setNotes('');
      setTargetSearch('');
      loadAllocations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to allocate visit');
    } finally {
      setSubmitting(false);
    }
  };

  // Collect GPS coords from current allocations for the map preview
  const mapMarkers = allocations
    .map(a => {
      const lat = parseFloat(a.custom_fields?.latitude);
      const lng = parseFloat(a.custom_fields?.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        return {
          sequence: a.sequence,
          customer: a.customer,
          status: a.visit_status,
          notes: a.notes,
          type: a.is_lead_order ? 'LEAD' : 'CUSTOMER',
          coords: [lat, lng]
        };
      }
      return null;
    })
    .filter(Boolean);

  const polylines = mapMarkers.map(m => m.coords);

  // Filtered target options based on search query
  const filteredTargets = targets.filter(t => {
    const q = targetSearch.toLowerCase();
    return !q ||
      t.customer?.toLowerCase().includes(q) ||
      t.order_number?.toLowerCase().includes(q) ||
      t.type?.toLowerCase().includes(q);
  });

  return (
    <div className="fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MapPin size={24} color="var(--color-primary)" />
            Visit Location Allocations
          </h2>
          <p>Allocate and optimize route sequences of leads and customers to visit for each sales representative.</p>
        </div>
        <div className="page-header-right">
          <button 
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <Plus size={16} /> Allocate New Visit
          </button>
        </div>
      </div>

      {/* Date & Salesperson Filter Console */}
      <div className="card" style={{ marginBottom: 20, padding: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end' }}>
          
          <div className="form-group" style={{ margin: 0, minWidth: 240, flex: 1 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={14} /> Select Sales Representative
            </label>
            <select 
              className="form-control"
              value={selectedSalespersonId}
              onChange={e => setSelectedSalespersonId(e.target.value)}
            >
              {salespersons.length === 0 && <option value="">No sales users found</option>}
              {salespersons.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.name} ({sp.email})</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0, minWidth: 160, width: 'auto' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={14} /> Visit Date
            </label>
            <input 
              type="date"
              className="form-control"
              value={visitDate}
              onChange={e => setVisitDate(e.target.value)}
            />
          </div>

          <button 
            className="btn btn-secondary btn-icon"
            onClick={loadAllocations}
            title="Refresh Allocations"
            style={{ height: 40, width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <RefreshCw size={16} className={loadingAllocations ? 'spin' : ''} />
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
            {[
              { key: 'both', label: 'Split View', icon: Info },
              { key: 'list', label: 'List Only', icon: List },
              { key: 'map', label: 'Map Route', icon: Map }
            ].map(m => (
              <button
                key={m.key}
                onClick={() => setViewMode(m.key)}
                style={{
                  padding: '8px 14px',
                  background: viewMode === m.key ? 'var(--color-primary)' : 'rgba(0,0,0,0.1)',
                  color: viewMode === m.key ? '#fff' : 'var(--color-text-muted)',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s'
                }}
              >
                <m.icon size={13} />
                {m.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Main Content Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: viewMode === 'both' ? '1fr 1fr' : '1fr',
        gap: 20,
        alignItems: 'start'
      }}>
        
        {/* LEFT COLUMN: Allocations List */}
        {(viewMode === 'both' || viewMode === 'list') && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Allocated Visits List ({allocations.length})</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Drag/Sequence order will show on salesperson mobile GPS routing.</span>
            </div>

            {loadingAllocations ? (
              <div className="loading-center" style={{ padding: 60 }}><div className="loading-spinner" /></div>
            ) : allocations.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <MapPin size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                <h4 style={{ margin: '0 0 6px', color: 'var(--color-text-primary)' }}>No Visits Allocated</h4>
                <p style={{ margin: 0, fontSize: 13 }}>Click &ldquo;Allocate New Visit&rdquo; to schedule targets for this day.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 60, textAlign: 'center' }}>Seq</th>
                      <th>Lead / Customer</th>
                      <th style={{ width: 90 }}>Type</th>
                      <th>Admin Instructions / Notes</th>
                      <th style={{ width: 100 }}>GPS</th>
                      <th style={{ width: 100 }}>Status</th>
                      <th style={{ width: 140, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map((a, index) => {
                      const lat = a.custom_fields?.latitude;
                      const lng = a.custom_fields?.longitude;
                      const hasCoords = lat && lng;

                      return (
                        <tr key={a.id} style={{ borderBottom: '1px solid var(--color-border)', background: index % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                          <td style={{ textAlign: 'center', fontWeight: 800, fontSize: 15, color: 'var(--color-primary-light)' }}>
                            {a.sequence}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{a.customer_name}</div>
                            {a.order_number && (
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                                Ref: {a.order_number}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${a.is_lead_order ? 'badge-green' : 'badge-purple'}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                              {a.is_lead_order ? 'LEAD' : 'CUSTOMER'}
                            </span>
                          </td>
                          <td style={{ fontSize: 13, color: 'var(--color-text-primary)', maxWidth: 220, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            {a.notes || <em style={{ opacity: 0.5 }}>No notes added</em>}
                          </td>
                          <td>
                            {hasCoords ? (
                              <span style={{ color: '#10b981', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                📍 Pinned
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-text-muted)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                ⚠️ No GPS
                              </span>
                            )}
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: a.visit_status === 'COMPLETED' ? 'rgba(16,185,129,0.15)' : a.visit_status === 'SKIPPED' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                              color: a.visit_status === 'COMPLETED' ? '#10b981' : a.visit_status === 'SKIPPED' ? '#f87171' : 'var(--color-text-muted)',
                              border: `1px solid ${a.visit_status === 'COMPLETED' ? 'rgba(16,185,129,0.3)' : a.visit_status === 'SKIPPED' ? 'rgba(239,68,68,0.3)' : 'var(--color-border)'}`
                            }}>
                              {a.visit_status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 4 }}>
                              <button 
                                className="btn btn-ghost btn-sm"
                                disabled={index === 0}
                                onClick={() => handleReorder(index, 'up')}
                                style={{ padding: 4 }}
                                title="Move Up"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button 
                                className="btn btn-ghost btn-sm"
                                disabled={index === allocations.length - 1}
                                onClick={() => handleReorder(index, 'down')}
                                style={{ padding: 4 }}
                                title="Move Down"
                              >
                                <ArrowDown size={14} />
                              </button>
                              <button 
                                className="btn btn-ghost btn-sm btn-icon"
                                onClick={() => handleDelete(a.id)}
                                style={{ padding: 4, color: '#f87171' }}
                                title="Remove Allocation"
                              >
                                <Trash2 size={14} />
                              </button>
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
        )}

        {/* RIGHT COLUMN: Route Map Preview */}
        {(viewMode === 'both' || viewMode === 'map') && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Planned Route Map Preview</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Connections represent sequence order.</span>
            </div>
            
            <div style={{ height: 500, width: '100%', position: 'relative' }}>
              {mapMarkers.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.1)', color: 'var(--color-text-muted)', padding: 20, textAlign: 'center' }}>
                  <Map size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
                  <h4>No Pinned Visit Locations</h4>
                  <p style={{ maxWidth: 300, fontSize: 13, margin: 0 }}>Add allocations with GPS coordinates to preview the sequenced route layout.</p>
                </div>
              ) : (
                <MapContainer 
                  center={mapMarkers[0].coords} 
                  zoom={12} 
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://maps.google.com">Google Maps</a>'
                    url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                    subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                    maxZoom={20}
                  />
                  {mapMarkers.map(m => (
                    <Marker 
                      key={m.sequence} 
                      position={m.coords}
                      icon={createSequenceMarker(m.sequence, m.customer, m.status)}
                    >
                      <Popup>
                        <div style={{ color: 'var(--color-text-primary)', fontFamily: 'system-ui' }}>
                          <div style={{ fontWeight: 'bold', fontSize: 14 }}>#{m.sequence} {m.customer}</div>
                          <div style={{ marginTop: 2 }}>
                            <span className={`badge ${m.type === 'LEAD' ? 'badge-green' : 'badge-purple'}`} style={{ fontSize: 10, padding: '1px 5px' }}>
                              {m.type}
                            </span>
                          </div>
                          {m.notes && (
                            <div style={{ marginTop: 8, fontSize: 12, borderTop: '1px solid var(--color-border)', paddingTop: 6 }}>
                              <strong>Notes:</strong> {m.notes}
                            </div>
                          )}
                          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>
                            Status: <strong style={{ color: m.status === 'COMPLETED' ? '#10b981' : m.status === 'SKIPPED' ? '#ef4444' : '#3b82f6' }}>{m.status}</strong>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  {polylines.length > 1 && (
                    <Polyline 
                      positions={polylines} 
                      color="#3b82f6" 
                      dashArray="8, 8" 
                      weight={3.5}
                      opacity={0.8}
                    />
                  )}
                  <MapBounds coords={polylines} />
                </MapContainer>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Allocation Modal Popup */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div className="card" style={{
            position: 'relative', width: 560, maxHeight: '90vh', overflowY: 'auto',
            borderRadius: 16, border: '1px solid var(--color-border)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)', margin: 20
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px 16px',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.12))',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 16 }}>Allocate Visit Location</span>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>Choose a prospect lead or customer account to assign to this salesperson.</p>
              </div>
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => setShowModal(false)}
                style={{ padding: 6 }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreate} style={{ padding: '20px 24px' }}>
              
              <div className="form-group">
                <label className="form-label">Salesperson Representative</label>
                <select 
                  className="form-control"
                  disabled
                  value={selectedSalespersonId}
                >
                  {salespersons.map(sp => (
                    <option key={sp.id} value={sp.id}>{sp.name} ({sp.email})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Scheduled Date</label>
                <input 
                  type="date" 
                  className="form-control"
                  value={visitDate}
                  onChange={e => setVisitDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Select Target Lead or Customer Account *</span>
                  {loadingTargets && <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Loading...</span>}
                </label>
                
                {/* Simple target search search box */}
                <div style={{ position: 'relative', marginBottom: 10 }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input 
                    type="text" 
                    placeholder="Search client name, type or invoice ref..."
                    className="form-control"
                    value={targetSearch}
                    onChange={e => setTargetSearch(e.target.value)}
                    style={{ paddingLeft: 34 }}
                  />
                </div>

                <div style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  maxHeight: 180,
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.1)'
                }}>
                  {filteredTargets.length === 0 ? (
                    <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
                      No matching targets found
                    </div>
                  ) : (
                    filteredTargets.map(t => {
                      const isSelected = selectedTargetId === t.id;
                      return (
                        <div 
                          key={t.id}
                          onClick={() => setSelectedTargetId(t.id)}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid var(--color-border)',
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(59,130,246,0.15)' : 'transparent',
                            color: isSelected ? 'var(--color-primary-light)' : 'var(--color-text-primary)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 13
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600 }}>{t.customer}</span>
                            <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 8 }}>({t.order_number})</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className={`badge ${t.type === 'LEAD' ? 'badge-green' : 'badge-purple'}`} style={{ fontSize: 9, padding: '1px 5px' }}>
                              {t.type}
                            </span>
                            <span style={{ fontSize: 11, color: t.hasGPS ? '#10b981' : 'var(--color-text-muted)' }}>
                              {t.hasGPS ? '📍 Has GPS' : '⚠️ No GPS'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Instructions / Notes (Optional)</label>
                <textarea 
                  className="form-control"
                  rows={3}
                  placeholder="Provide instructions for this visit (e.g. Inquire about Ground Masala stock, collect pending dues, etc.)"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting || !selectedTargetId}
                  style={{ flex: 1 }}
                >
                  {submitting ? 'Allocating...' : 'Allocate Visit'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
