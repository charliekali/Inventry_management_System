import { useState, useEffect } from 'react';
import { transactionsAPI, productsAPI, warehousesAPI } from '../api';
import toast from 'react-hot-toast';
import { 
  History, Search, Eye, Calendar, User, 
  ShieldCheck, Factory, AlertTriangle, Package, Warehouse
} from 'lucide-react';

export default function ProductionHistoryPage() {
  const [runs, setRuns] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedWarehouseName, setSelectedWarehouseName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [selectedRun, setSelectedRun] = useState(null);

  useEffect(() => {
    // Load Master Data for Filters
    productsAPI.list()
      .then(res => setProducts(res.data.data))
      .catch(() => {});
      
    warehousesAPI.list()
      .then(res => setWarehouses(res.data.data))
      .catch(() => {});
      
    loadRuns();
  }, []);

  const loadRuns = () => {
    setLoading(true);
    transactionsAPI.productionRuns()
      .then(res => {
        setRuns(res.data.data);
      })
      .catch(() => toast.error('Failed to load production run history'))
      .finally(() => setLoading(false));
  };

  // Filtered runs list on frontend
  const filteredRuns = runs.filter(run => {
    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchRef = run.reference_doc?.toLowerCase().includes(q);
      const matchProdName = run.product_name?.toLowerCase().includes(q);
      const matchProdCode = run.product_code?.toLowerCase().includes(q);
      const matchRemarks = run.remarks?.toLowerCase().includes(q);
      const matchUser = run.performed_by?.toLowerCase().includes(q);
      if (!matchRef && !matchProdName && !matchProdCode && !matchRemarks && !matchUser) return false;
    }
    // Product filter
    if (selectedProductId && run.product_id !== selectedProductId) return false;
    // Warehouse filter
    if (selectedWarehouseName && run.warehouse_name !== selectedWarehouseName) return false;
    // Date filter
    if (dateFrom && run.transaction_date < dateFrom) return false;
    if (dateTo && run.transaction_date > dateTo) return false;
    
    return true;
  });

  // KPI Calculations based on filtered list
  const totalRuns = filteredRuns.length;
  const totalKgProduced = filteredRuns
    .filter(r => r.unit?.toUpperCase() === 'KG')
    .reduce((sum, r) => sum + r.quantity_produced, 0);
  const totalPcsProduced = filteredRuns
    .filter(r => r.unit?.toUpperCase() !== 'KG')
    .reduce((sum, r) => sum + r.quantity_produced, 0);
    
  const avgWastage = totalRuns > 0 
    ? filteredRuns.reduce((sum, r) => sum + (r.wastage_pct || 0), 0) / totalRuns 
    : 0;
  const avgDamage = totalRuns > 0 
    ? filteredRuns.reduce((sum, r) => sum + (r.damage_pct || 0), 0) / totalRuns 
    : 0;

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h2>Production History & Traceability</h2>
          <p>Chronological audit log of blending & packaging batches. Trace raw ingredients back to storage bins.</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-secondary btn-sm" onClick={loadRuns} style={{ display: 'flex', gap: 6 }}>
            <History size={14} />
            Refresh Logs
          </button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><Factory size={20} color="#60a5fa"/></div>
          <div className="kpi-value">{totalRuns}</div>
          <div className="kpi-label">Total Batches</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-icon green"><Package size={20} color="#10b981"/></div>
          <div className="kpi-value">{totalKgProduced.toFixed(1)} KG</div>
          <div className="kpi-label">Total Bulk Mass</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-icon orange"><AlertTriangle size={20} color="#f59e0b"/></div>
          <div className="kpi-value">{avgWastage.toFixed(1)}%</div>
          <div className="kpi-label">Avg Process Loss</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-icon red"><ShieldCheck size={20} color="#ef4444"/></div>
          <div className="kpi-value">{avgDamage.toFixed(1)}%</div>
          <div className="kpi-label">Avg Pack Damage</div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="filters-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ minWidth: 200, flex: 1 }}>
            <label className="form-label" style={{ fontSize: 10 }}>Search Production Runs</label>
            <div className="search-bar" style={{ width: '100%' }}>
              <Search size={14} />
              <input 
                type="text" 
                placeholder="Ref Doc, Product, Operator, Remarks..." 
                className="form-control"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ minWidth: 180 }}>
            <label className="form-label" style={{ fontSize: 10 }}>Produced Product</label>
            <select className="form-control" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)}>
              <option value="">All Products</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ minWidth: 160 }}>
            <label className="form-label" style={{ fontSize: 10 }}>Destination Warehouse</label>
            <select className="form-control" value={selectedWarehouseName} onChange={(e) => setSelectedWarehouseName(e.target.value)}>
              <option value="">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.name}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ minWidth: 120 }}>
            <label className="form-label" style={{ fontSize: 10 }}>Date From</label>
            <input type="date" className="form-control" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div className="form-group" style={{ minWidth: 120 }}>
            <label className="form-label" style={{ fontSize: 10 }}>Date To</label>
            <input type="date" className="form-control" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Runs Log Table */}
      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="loading-spinner"></div></div>
        ) : filteredRuns.length === 0 ? (
          <div className="empty-state">
            <History size={48} style={{ opacity: 0.5, marginBottom: 12 }} />
            <h3>No Production Batches Found</h3>
            <p>Either no production runs have been executed or they don't match the active filters.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Batch Reference</th>
                  <th>Date</th>
                  <th>Produced FG</th>
                  <th>Destination Location</th>
                  <th style={{ textAlign: 'right' }}>Yield Output</th>
                  <th style={{ textAlign: 'center' }}>Wastage %</th>
                  <th style={{ textAlign: 'center' }}>Damage %</th>
                  <th>Operator</th>
                  <th style={{ textAlign: 'center' }}>Traceability</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((run, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className="gr-number" style={{ fontFamily: 'monospace', fontWeight: 600 }}>{run.reference_doc}</span>
                    </td>
                    <td>{run.transaction_date}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{run.product_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Code: {run.product_code}</div>
                    </td>
                    <td>
                      <div>{run.warehouse_name}</div>
                      {run.section_name && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Section: {run.section_name}</div>}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--color-success)', textAlign: 'right' }}>
                      {run.quantity_produced.toFixed(2)} {run.unit}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${run.wastage_pct > 5 ? 'badge-red' : run.wastage_pct > 0 ? 'badge-orange' : 'badge-green'}`}>
                        {run.wastage_pct}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${run.damage_pct > 3 ? 'badge-red' : run.damage_pct > 0 ? 'badge-orange' : 'badge-green'}`}>
                        {run.damage_pct}%
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13 }}>{run.performed_by}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        className="btn btn-ghost btn-icon" 
                        onClick={() => setSelectedRun(run)}
                        title="Trace Batch Materials"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Traceability Modal */}
      {selectedRun && (
        <div className="modal-overlay" onClick={() => setSelectedRun(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 750 }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={20} className="text-success" />
                <span>Batch Traceability Ledger</span>
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedRun(null)}>×</button>
            </div>
            
            <div className="modal-body" style={{ fontSize: 14 }}>
              {/* Batch Info Header */}
              <div className="responsive-grid-equal-3" style={{ background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
                <div>
                  <span className="form-label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Batch Reference</span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-light)', marginTop: 4, fontFamily: 'monospace' }}>
                    {selectedRun.reference_doc}
                  </div>
                </div>
                <div>
                  <span className="form-label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Transaction Date</span>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={13} className="text-muted" />
                    {selectedRun.transaction_date}
                  </div>
                </div>
                <div>
                  <span className="form-label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Performed By</span>
                  <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <User size={13} className="text-muted" />
                    {selectedRun.performed_by}
                  </div>
                </div>
              </div>

              {/* Produced Good Summary Card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: 16,
                marginBottom: 20
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-success)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Produced Finished Good Output</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <div>
                    <h4 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>{selectedRun.product_name}</h4>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Code: {selectedRun.product_code}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-success)' }}>
                      {selectedRun.quantity_produced.toFixed(2)} {selectedRun.unit}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      Inwarded to {selectedRun.warehouse_name} {selectedRun.section_name ? `(${selectedRun.section_name})` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Yield Analysis & Wastage Progress KPI */}
              <div style={{ marginBottom: 20 }}>
                <span className="form-label" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Process Yield Efficiency</span>
                
                {/* Stacked yield bar */}
                <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', margin: '10px 0', background: 'var(--color-border)' }}>
                  <div style={{ width: `${100 - (selectedRun.wastage_pct || 0) - (selectedRun.damage_pct || 0)}%`, background: 'var(--color-success)' }} />
                  {(selectedRun.wastage_pct || 0) > 0 && <div style={{ width: `${selectedRun.wastage_pct}%`, background: 'var(--color-warning)' }} />}
                  {(selectedRun.damage_pct || 0) > 0 && <div style={{ width: `${selectedRun.damage_pct}%`, background: 'var(--color-danger)' }} />}
                </div>

                <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)' }} />
                    <span style={{ color: 'var(--color-text-secondary)' }}>Net Yield:</span>
                    <strong style={{ color: 'var(--color-success)' }}>{(100 - (selectedRun.wastage_pct || 0) - (selectedRun.damage_pct || 0)).toFixed(1)}%</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning)' }} />
                    <span style={{ color: 'var(--color-text-secondary)' }}>Process Wastage:</span>
                    <strong style={{ color: 'var(--color-warning)' }}>{selectedRun.wastage_pct || 0}%</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-danger)' }} />
                    <span style={{ color: 'var(--color-text-secondary)' }}>Damage / Defect Loss:</span>
                    <strong style={{ color: 'var(--color-danger)' }}>{selectedRun.damage_pct || 0}%</strong>
                  </div>
                </div>
              </div>

              {/* Remarks Box */}
              <div style={{ marginBottom: 20 }}>
                <span className="form-label" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Execution Remarks / Notes</span>
                <div style={{ 
                  fontSize: 13.5, background: 'rgba(255,255,255,0.03)', color: 'var(--color-text-secondary)',
                  padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginTop: 4, border: '1px solid var(--color-border)'
                }}>
                  {selectedRun.remarks || 'No remarks recorded for this production run.'}
                </div>
              </div>

              {/* Consumed Ingredients Table */}
              <div>
                <span className="form-label" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--color-text-primary)', display: 'block', marginBottom: 8 }}>
                  Consumed Recipe Ingredients (Traceability Outflow)
                </span>
                
                {selectedRun.ingredients && selectedRun.ingredients.length > 0 ? (
                  <div className="table-wrapper" style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                    <table style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Ingredient (Raw / Bulk Blend)</th>
                          <th>Source Storage Bin</th>
                          <th style={{ textAlign: 'right' }}>Consumed Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRun.ingredients.map((ing, idx) => (
                          <tr key={idx}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{ing.product_name}</div>
                              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Code: {ing.product_code}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Warehouse size={12} className="text-muted" />
                                <span>{ing.warehouse_name}</span>
                              </div>
                              {ing.section_name && (
                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 16 }}>
                                  Section: {ing.section_name}
                                </div>
                              )}
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--color-danger)', textAlign: 'right' }}>
                              -{ing.quantity.toFixed(3)} {ing.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{
                    padding: '16px 20px', background: 'rgba(239, 68, 68, 0.05)',
                    border: '1px dashed rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)',
                    color: 'var(--color-danger)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <AlertTriangle size={16} />
                    <span>No raw materials consumption details found for this batch.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedRun(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
