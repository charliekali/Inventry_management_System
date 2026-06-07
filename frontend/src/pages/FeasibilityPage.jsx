import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ordersAPI, productsAPI } from '../api';
import toast from 'react-hot-toast';
import {
  ShieldCheck, Plus, Trash2, FlaskConical,
  AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Info
} from 'lucide-react';

const getStepBadgeClass = (step) => {
  switch (step) {
    case 'CLEANING': return 'badge-gray';
    case 'DRYING': return 'badge-orange';
    case 'ROASTING': return 'badge-cyan';
    case 'GRINDING': return 'badge-purple';
    case 'BLENDING': return 'badge-blue';
    case 'PACKING': return 'badge-green';
    default: return 'badge-gray';
  }
};

function RecipeFlowTree({ rmAnalysis, depth = 0 }) {
  if (!rmAnalysis || rmAnalysis.length === 0) return null;

  const steps = ['CLEANING', 'DRYING', 'ROASTING', 'GRINDING', 'BLENDING', 'PACKING', 'OTHER'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: depth > 0 ? 16 : 0, borderLeft: depth > 0 ? '1px dashed rgba(255, 255, 255, 0.1)' : 'none', marginTop: depth > 0 ? 8 : 0 }}>
      {steps.map(step => {
        const stepItems = rmAnalysis.filter(rm => {
          const rmStep = rm.production_step || 'OTHER';
          if (step === 'OTHER') {
            return rmStep === 'OTHER' || !['CLEANING', 'DRYING', 'ROASTING', 'GRINDING', 'BLENDING', 'PACKING'].includes(rmStep);
          }
          return rmStep === step;
        });

        if (stepItems.length === 0) return null;

        return (
          <div key={step} style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span className={`badge ${getStepBadgeClass(step)}`} style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 8px' }}>
                {step}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stepItems.map((rm, rIdx) => {
                const hasSubBOM = rm.has_bom && rm.sub_analysis && rm.sub_analysis.length > 0;
                const sufficient = rm.sufficient_for_shortfall || rm.sufficient_with_production;

                return (
                  <div key={rm.product_id || rIdx} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ color: sufficient ? 'var(--color-text-primary)' : 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span>{sufficient ? '🟢' : '🔴'}</span>
                        <span style={{ fontWeight: 700 }}>[{rm.rm_code || rm.product_code}] {rm.rm_name || rm.product_name}</span>
                        
                        {rm.blend_pct != null && (
                          <span style={{ fontSize: 10, color: 'var(--color-text-secondary)', background: 'rgba(59, 130, 246, 0.12)', padding: '1px 5px', borderRadius: 4 }}>
                            {rm.blend_pct}% blend
                          </span>
                        )}
                        {rm.notes && (
                          <span style={{ fontSize: 10.5, color: 'var(--color-warning)', fontStyle: 'italic' }}>
                            ({rm.notes})
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                        <span>Need: <strong style={{ color: 'var(--color-text-primary)' }}>{rm.qty_needed_for_shortfall} {rm.unit}</strong></span>
                        <span>Have: <strong style={{ color: rm.qty_available >= rm.qty_needed_for_shortfall ? 'var(--color-success)' : 'var(--color-danger)' }}>{rm.qty_available} {rm.unit}</strong></span>
                        {rm.shortfall > 0 && <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>Short: -{rm.shortfall}</span>}
                        {rm.producible_units > 0 && (
                          <span style={{ color: 'var(--color-primary-light)' }}>Producible: {rm.producible_units} units</span>
                        )}
                      </div>
                    </div>

                    {rm.pack_size_g && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', gap: 12, background: 'rgba(0,0,0,0.1)', padding: '4px 8px', borderRadius: 4 }}>
                        <span><strong>Pack Weight:</strong> {rm.pack_size_g}g</span>
                        {rm.batch_size_kg && <span><strong>Batch Size:</strong> {rm.batch_size_kg} kg</span>}
                        {rm.process_notes && <span style={{ fontStyle: 'italic' }}>— {rm.process_notes}</span>}
                      </div>
                    )}

                    {hasSubBOM && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          ↳ Recipe for {rm.rm_name || rm.product_name} shortfall:
                        </div>
                        <RecipeFlowTree rmAnalysis={rm.sub_analysis} depth={depth + 1} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab: Feasibility Audit (original) ────────────────────────────────────────
function FeasibilityAuditTab({ products }) {
  const routerState = useLocation().state;
  const [itemsList, setItemsList] = useState([]);
  const [currentRmId, setCurrentRmId] = useState('');
  const [currentQty, setCurrentQty] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (routerState && routerState.checkItems) {
      setItemsList(routerState.checkItems.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        product_code: i.product_code,
        qty_required: i.qty_required,
        unit: i.unit || 'PCS'
      })));
    }
  }, [routerState]);

  const handleAddItem = () => {
    if (!currentRmId || !currentQty) return toast.error('Select product and enter quantity');
    if (parseFloat(currentQty) <= 0) return toast.error('Quantity must be positive');
    if (itemsList.some(item => item.product_id === currentRmId)) return toast.error('Product already added');
    const prod = products.find(p => p.id === currentRmId);
    setItemsList([...itemsList, {
      product_id: currentRmId, product_name: prod.name, product_code: prod.code,
      qty_required: parseFloat(currentQty), unit: prod.unit || 'PCS'
    }]);
    setCurrentRmId(''); setCurrentQty(''); setResults(null);
  };

  const handleRemoveItem = (index) => {
    const list = [...itemsList]; list.splice(index, 1); setItemsList(list); setResults(null);
  };

  const handleCheck = async () => {
    if (itemsList.length === 0) return toast.error('Add at least one item');
    setLoading(true);
    try {
      const r = await ordersAPI.checkFeasibility(itemsList.map(i => ({ product_id: i.product_id, qty_required: i.qty_required })));
      setResults(r.data.data);
      toast.success('Feasibility audit completed!');
    } catch { toast.error('Failed to run audit'); }
    finally { setLoading(false); }
  };

  const getOverallCls = (s) => `feasibility-overall ${s === 'FEASIBLE' ? 'feasible' : s === 'PARTIAL' ? 'partial' : 'insufficient'}`;
  const getOverallText = (s) => s === 'FEASIBLE' ? '✅ ALL ITEMS FEASIBLE' : s === 'PARTIAL' ? '⚠️ PARTIALLY FEASIBLE' : '❌ INSUFFICIENT STOCK & MATERIALS';

  const getItemBadge = (s) => {
    if (s === 'FEASIBLE') return <span className="badge badge-green">Feasible from Stock</span>;
    if (s === 'FEASIBLE_WITH_PRODUCTION') return <span className="badge badge-blue">Feasible with Production</span>;
    if (s === 'PARTIAL') return <span className="badge badge-orange">Partial Shortage</span>;
    return <span className="badge badge-red">Insufficient</span>;
  };

  return (
    <div className="responsive-grid-feasibility">
      {/* Left panel */}
      <div className="card" style={{ height: 'fit-content' }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 12, marginBottom: 16 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={18} />
            <span>Simulate Demand List</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: 10 }}>Product</label>
            <select className="form-control" value={currentRmId} onChange={e => setCurrentRmId(e.target.value)}>
              <option value="">Choose item...</option>
              {products.map(p => <option key={p.id} value={p.id}>[{p.code}] {p.name} ({p.type})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: 10 }}>Target Quantity</label>
            <input type="number" step="any" placeholder="0.00" className="form-control" value={currentQty} onChange={e => setCurrentQty(e.target.value)} />
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItem} style={{ width: '100%', height: 38 }}>
            <Plus size={14} /> Add to Simulation
          </button>
        </div>

        <div className="divider" style={{ margin: '16px 0' }} />
        <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>
          Simulation Cart ({itemsList.length})
        </h4>
        {itemsList.length === 0 ? (
          <p style={{ fontStyle: 'italic', fontSize: 12.5, color: 'var(--color-text-muted)', textAlign: 'center', padding: 12 }}>No items added.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
            {itemsList.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: 13 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{item.product_code}</div>
                </div>
                <div style={{ fontWeight: 700, marginRight: 6 }}>{item.qty_required} {item.unit}</div>
                <button type="button" className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => handleRemoveItem(idx)}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
        {itemsList.length > 0 && (
          <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={loading} onClick={handleCheck}>
            {loading ? 'Analyzing...' : 'Run Feasibility Audit'}
          </button>
        )}
      </div>

      {/* Right panel */}
      <div className="card">
        <div className="card-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 12, marginBottom: 16 }}>
          <div className="card-title">Audit Diagnostic Report</div>
        </div>
        {results ? (
          <div className="fade-in">
            <div className={getOverallCls(results.overall_status)}>{getOverallText(results.overall_status)}</div>
            <div className="responsive-grid-4" style={{ gap: 10, marginBottom: 16 }}>
              {[['Fulfillable', results.summary.feasible, 'var(--color-success)'],
                ['Need Prod.', results.summary.feasible_with_production, 'var(--color-primary-light)'],
                ['Partial', results.summary.partial, 'var(--color-warning)'],
                ['Unavailable', results.summary.insufficient, 'var(--color-danger)']].map(([label, val, color]) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{label}</div>
                </div>
              ))}
            </div>

            {results.items.map((item, idx) => {
              const accentColor = item.status === 'FEASIBLE' ? 'var(--color-success)'
                : item.status === 'FEASIBLE_WITH_PRODUCTION' ? 'var(--color-primary)'
                : item.status === 'PARTIAL' ? 'var(--color-warning)'
                : 'var(--color-danger)';
              return (
                <div key={idx} style={{ borderLeft: `4px solid ${accentColor}`, background: 'rgba(255,255,255,0.015)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 14 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>[{item.product_code}] {item.product_name}</span>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                        Type: {item.product_type} &nbsp;|&nbsp; Demand: <strong>{item.qty_required} {item.unit}</strong>
                      </div>
                    </div>
                    <div>{getItemBadge(item.status)}</div>
                  </div>

                  {/* 3-stage pipeline: Stock → Produce → Pack */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
                    {/* Stage 1: Stock */}
                    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: 10, border: `1px solid ${item.can_fulfill_from_stock ? 'var(--color-success)' : 'var(--color-border)'}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6 }}>📦 1. In Stock</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: item.can_fulfill_from_stock ? 'var(--color-success)' : item.fg_available > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                        {item.fg_available}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{item.unit} available</div>
                      {item.can_fulfill_from_stock
                        ? <div style={{ fontSize: 10, color: 'var(--color-success)', marginTop: 4 }}>✅ Covers demand</div>
                        : <div style={{ fontSize: 10, color: 'var(--color-danger)', marginTop: 4 }}>↓ Short by {item.fg_shortfall} {item.unit}</div>}
                    </div>

                    {/* Stage 2: Produce */}
                    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: 10, border: `1px solid ${item.all_ingredients_ok ? 'var(--color-success)' : item.producible_units > 0 ? 'var(--color-warning)' : 'var(--color-border)'}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6 }}>⚗️ 2. Producible</div>
                      {item.has_bom ? (
                        <>
                          <div style={{ fontSize: 18, fontWeight: 800, color: item.all_ingredients_ok ? 'var(--color-success)' : item.producible_units > 0 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                            {item.producible_units}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{item.unit} from RM stock</div>
                          {item.all_ingredients_ok
                            ? <div style={{ fontSize: 10, color: 'var(--color-success)', marginTop: 4 }}>✅ Ingredients OK</div>
                            : <div style={{ fontSize: 10, color: 'var(--color-danger)', marginTop: 4 }}>⚠️ Ingredient shortage</div>}
                        </>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>No BOM defined</div>
                      )}
                    </div>

                    {/* Stage 3: Pack */}
                    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: 10, border: `1px solid ${!item.packaging_present ? 'var(--color-border)' : item.all_packaging_ok ? 'var(--color-success)' : 'var(--color-danger)'}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 6 }}>🏷️ 3. Pack</div>
                      {item.packaging_present ? (
                        <>
                          <div style={{ fontSize: 18, fontWeight: 800, color: item.all_packaging_ok ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {item.all_packaging_ok ? '✅' : '❌'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Packaging materials</div>
                          {item.all_packaging_ok
                            ? <div style={{ fontSize: 10, color: 'var(--color-success)', marginTop: 4 }}>Packaging sufficient</div>
                            : <div style={{ fontSize: 10, color: 'var(--color-danger)', marginTop: 4 }}>Packaging shortage!</div>}
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-muted)' }}>—</div>
                          <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>No packaging in BOM</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Combined total row */}
                  <div style={{ display: 'flex', gap: 10, padding: '8px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, fontSize: 12.5, flexWrap: 'wrap', marginBottom: item.has_bom ? 10 : 0, alignItems: 'center' }}>
                    <span>🎯 Demand: <strong>{item.qty_required} {item.unit}</strong></span>
                    <span style={{ color: 'var(--color-text-muted)' }}>|</span>
                    <span>Stock: <strong>{item.fg_available}</strong></span>
                    <span>+</span>
                    <span>Producible: <strong>{item.producible_units}</strong></span>
                    <span>=</span>
                    <span style={{ color: item.can_fulfill_total ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>
                      Total: {item.total_available} {item.unit}
                    </span>
                    {item.remaining_shortfall > 0 && (
                      <span style={{ color: 'var(--color-danger)' }}>
                        &nbsp;(still short by <strong>{item.remaining_shortfall} {item.unit}</strong>)
                      </span>
                    )}
                  </div>

                  {/* Pack & Batch calculations */}
                  {item.pack_size_g && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: 6, padding: '10px 12px', fontSize: 12.5, marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', Typography: 'inherit', fontWeight: 600 }}>
                        <span style={{ color: 'var(--color-primary-light)' }}>🏷️ Pack Configuration & Batch Calculation</span>
                        {item.batch_runs_needed != null && (
                          <span className="badge badge-blue">
                            Batches Needed: {item.batch_runs_needed} (each {item.batch_size_kg} kg)
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 11.5, color: 'var(--color-text-secondary)', flexWrap: 'wrap', marginTop: 4 }}>
                        <span><strong>Pack Size:</strong> {item.pack_size_g} g</span>
                        <span><strong>Packs per kg:</strong> {item.packs_per_kg || (1000 / item.pack_size_g).toFixed(1)}</span>
                        {item.process_notes && (
                          <div style={{ width: '100%', fontStyle: 'italic', marginTop: 4, color: 'var(--color-text-muted)' }}>
                            <strong>Process Notes:</strong> {item.process_notes}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Grouped BOM details by production step */}
                  {item.has_bom && item.rm_analysis && item.rm_analysis.length > 0 && (
                    <div style={{ marginTop: 10, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-primary-light)', marginBottom: 12, borderBottom: '1px solid var(--color-border)', paddingBottom: 6 }}>
                        ⚙️ Manufacturing & Blend Recipe Flow
                      </div>
                      <RecipeFlowTree rmAnalysis={item.rm_analysis} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state" style={{ height: 300, display: 'flex', justifyContent: 'center' }}>
            <ShieldCheck size={48} style={{ opacity: 0.3 }} />
            <h3>Awaiting Simulation Data</h3>
            <p>Add finished goods or raw materials to the simulation list and run the audit.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Production Yield Calculator ─────────────────────────────────────────
function ProductionYieldTab({ products }) {
  const rawMaterials = products.filter(p => p.type === 'RAW_MATERIAL');

  const [rmList, setRmList] = useState([]);
  const [currentRmId, setCurrentRmId] = useState('');
  const [currentQty, setCurrentQty] = useState('');
  const [wastagePct, setWastagePct] = useState('5');
  const [damagePct, setDamagePct] = useState('2');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [expandedFg, setExpandedFg] = useState({});

  const handleAddRm = () => {
    if (!currentRmId || !currentQty) return toast.error('Select raw material and quantity');
    if (parseFloat(currentQty) <= 0) return toast.error('Quantity must be positive');
    if (rmList.some(r => r.raw_material_id === currentRmId)) return toast.error('Already added');
    const rm = rawMaterials.find(p => p.id === currentRmId);
    setRmList([...rmList, { raw_material_id: currentRmId, rm_name: rm.name, rm_code: rm.code, qty_available: parseFloat(currentQty), unit: rm.unit }]);
    setCurrentRmId(''); setCurrentQty(''); setResults(null);
  };

  const handleRemoveRm = (idx) => {
    const list = [...rmList]; list.splice(idx, 1); setRmList(list); setResults(null);
  };

  const handleCalculate = async () => {
    if (rmList.length === 0) return toast.error('Add at least one raw material');
    setLoading(true);
    try {
      const r = await ordersAPI.productionYield({
        wastage_pct: parseFloat(wastagePct) || 0,
        damage_pct: parseFloat(damagePct) || 0,
        raw_materials: rmList.map(r => ({ raw_material_id: r.raw_material_id, qty_available: r.qty_available }))
      });
      setResults(r.data.data);
      const exp = {};
      r.data.data.finished_goods_yield.forEach(fg => { exp[fg.fg_id] = fg.has_all_materials; });
      setExpandedFg(exp);
      toast.success('Production yield calculated!');
    } catch { toast.error('Failed to calculate yield'); }
    finally { setLoading(false); }
  };

  const totalLoss = (parseFloat(wastagePct) || 0) + (parseFloat(damagePct) || 0);

  return (
    <div className="responsive-grid-feasibility">
      {/* Left panel: Input */}
      <div className="card" style={{ height: 'fit-content' }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 12, marginBottom: 16 }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FlaskConical size={18} />
            <span>Raw Materials in Hand</span>
          </div>
          <div className="card-subtitle">Enter how much of each raw material you have</div>
        </div>

        {/* Wastage / Damage inputs */}
        <div style={{ background: 'rgba(255,165,0,0.07)', border: '1px solid rgba(255,165,0,0.2)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-warning)', marginBottom: 10 }}>
            ⚠️ Loss Factors
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 10 }}>Wastage %</label>
              <input type="number" min="0" max="100" step="0.1" className="form-control" value={wastagePct} onChange={e => { setWastagePct(e.target.value); setResults(null); }} placeholder="e.g. 5" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 10 }}>Damage / Rejection %</label>
              <input type="number" min="0" max="100" step="0.1" className="form-control" value={damagePct} onChange={e => { setDamagePct(e.target.value); setResults(null); }} placeholder="e.g. 2" />
            </div>
          </div>
          <div style={{ fontSize: 11, marginTop: 8, color: 'var(--color-text-muted)' }}>
            Total loss: <strong style={{ color: totalLoss > 0 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>{totalLoss.toFixed(1)}%</strong> &mdash; Effective yield factor: <strong>{(100 - totalLoss).toFixed(1)}%</strong>
          </div>
        </div>

        {/* Add RM */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: 10 }}>Raw Material</label>
            <select className="form-control" value={currentRmId} onChange={e => setCurrentRmId(e.target.value)}>
              <option value="">Choose raw material...</option>
              {rawMaterials.map(p => <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" style={{ fontSize: 10 }}>Quantity in Hand</label>
            <input type="number" step="any" min="0" placeholder="0.00" className="form-control" value={currentQty} onChange={e => setCurrentQty(e.target.value)} />
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddRm} style={{ width: '100%', height: 38 }}>
            <Plus size={14} /> Add Raw Material
          </button>
        </div>

        <div className="divider" style={{ margin: '16px 0' }} />
        <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>
          Materials List ({rmList.length})
        </h4>
        {rmList.length === 0 ? (
          <p style={{ fontStyle: 'italic', fontSize: 12.5, color: 'var(--color-text-muted)', textAlign: 'center', padding: 12 }}>No raw materials added yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
            {rmList.map((rm, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: 13 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rm.rm_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{rm.rm_code}</div>
                </div>
                <div style={{ fontWeight: 700, color: 'var(--color-primary-light)', whiteSpace: 'nowrap' }}>{rm.qty_available} {rm.unit}</div>
                <button type="button" className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => handleRemoveRm(idx)}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
        {rmList.length > 0 && (
          <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={loading} onClick={handleCalculate}>
            {loading ? 'Calculating...' : '⚗️ Calculate Production Yield'}
          </button>
        )}
      </div>

      {/* Right panel: Results */}
      <div className="card">
        <div className="card-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 12, marginBottom: 16 }}>
          <div className="card-title">Production Yield Report</div>
        </div>

        {results ? (
          <div className="fade-in">
            {/* Loss summary banner */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              {[
                ['Wastage', results.wastage_pct + '%', 'var(--color-warning)'],
                ['Damage / Rej.', results.damage_pct + '%', 'var(--color-danger)'],
                ['Total Loss', results.loss_pct_total + '%', results.loss_pct_total > 0 ? 'var(--color-danger)' : 'var(--color-success)'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 'var(--radius-sm)', textAlign: 'center', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Raw material effective summary */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 10 }}>
                Raw Material Effective Quantities (after losses)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {results.raw_material_summary.map((rm, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', fontSize: 12.5 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700 }}>[{rm.rm_code}]</span> {rm.rm_name}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11.5 }}>
                      <span>Raw: <strong>{rm.qty_raw} {rm.unit}</strong></span>
                      {rm.wastage_qty > 0 && <span style={{ color: 'var(--color-warning)' }}>Wastage: -{rm.wastage_qty}</span>}
                      {rm.damage_qty > 0 && <span style={{ color: 'var(--color-danger)' }}>Damage: -{rm.damage_qty}</span>}
                      <span style={{ color: 'var(--color-success)', fontWeight: 700 }}>Effective: {rm.effective_qty} {rm.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FG yield cards */}
            <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 10 }}>
              Finished Goods Production Estimate ({results.finished_goods_yield.length} products)
            </h4>

            {results.finished_goods_yield.length === 0 ? (
              <div className="empty-state">
                <Info size={32} />
                <p>No finished goods have BOMs matching your raw materials. Define BOMs in the Products page first.</p>
              </div>
            ) : (
              results.finished_goods_yield.map((fg, idx) => {
                const isExpanded = expandedFg[fg.fg_id];
                const hasAll = fg.has_all_materials;
                const maxBatches = fg.max_full_batches;
                return (
                  <div key={idx} style={{
                    border: `1px solid ${hasAll ? 'var(--color-success)' : 'var(--color-warning)'}`,
                    borderLeft: `4px solid ${hasAll ? 'var(--color-success)' : 'var(--color-warning)'}`,
                    borderRadius: 'var(--radius-md)', marginBottom: 12, overflow: 'hidden'
                  }}>
                    {/* FG header */}
                    <div
                      onClick={() => setExpandedFg(prev => ({ ...prev, [fg.fg_id]: !prev[fg.fg_id] }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)' }}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>[{fg.fg_code}] {fg.fg_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {hasAll ? '✅ All required materials available' : '⚠️ Some materials missing from input'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: maxBatches > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {fg.max_producible_units}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                          {fg.fg_unit} producible
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {maxBatches} full units
                        </div>
                      </div>
                    </div>

                    {/* Expanded breakdown */}
                    {isExpanded && (
                      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.15)' }}>
                        {/* BOM breakdown per RM */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                            BOM Constraint Analysis
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {fg.bom_breakdown.map((b, bi) => (
                              <div key={bi} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '5px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 4, border: b.missing ? '1px solid var(--color-danger)' : '1px solid var(--color-border)' }}>
                                <span style={{ fontSize: 14 }}>{b.missing ? '🔴' : '🟢'}</span>
                                <span style={{ flex: 1, fontWeight: 600 }}>[{b.rm_code}] {b.rm_name}</span>
                                <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>
                                  ({b.effective_qty_available} {b.unit} available)
                                </span>
                                <span style={{ color: 'var(--color-text-muted)' }}>{b.qty_per_unit_fg} {b.unit}/unit</span>
                                {b.missing ? (
                                  <span className="badge badge-red" style={{ fontSize: 10 }}>Not in input</span>
                                ) : (
                                  <span style={{ color: 'var(--color-primary-light)', fontWeight: 700 }}>
                                    Max: {b.max_units_from_this_rm} units
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* RM consumption if max produced */}
                        {fg.max_full_batches > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                              RM Consumed (if {fg.max_full_batches} units are produced)
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {fg.rm_consumption.map((c, ci) => (
                                <div key={ci} style={{ padding: '4px 10px', background: 'rgba(59,130,246,0.1)', borderRadius: 4, fontSize: 12, border: '1px solid rgba(59,130,246,0.2)' }}>
                                  [{c.rm_code}] {c.rm_name}: <strong>{c.qty_consumed} {c.unit}</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="empty-state" style={{ height: 300, display: 'flex', justifyContent: 'center' }}>
            <FlaskConical size={48} style={{ opacity: 0.3 }} />
            <h3>Production Yield Calculator</h3>
            <p>Enter your raw materials on hand, set wastage & damage %, then click Calculate to see how many finished goods you can produce.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function FeasibilityPage() {
  const [products, setProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('audit');

  useEffect(() => {
    productsAPI.list().then(r => setProducts(r.data.data)).catch(() => {});
  }, []);

  return (
    <div className="fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Feasibility & Yield</h2>
          <p>Audit stock feasibility for orders, or calculate how many finished goods you can produce from available raw materials</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', padding: 4, width: 'fit-content', border: '1px solid var(--color-border)' }}>
        <button
          className={`btn btn-sm ${activeTab === 'audit' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('audit')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ShieldCheck size={14} />
          Feasibility Audit
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'yield' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('yield')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <FlaskConical size={14} />
          Production Yield Calculator
        </button>
      </div>

      {activeTab === 'audit'
        ? <FeasibilityAuditTab products={products} />
        : <ProductionYieldTab products={products} />
      }
    </div>
  );
}
