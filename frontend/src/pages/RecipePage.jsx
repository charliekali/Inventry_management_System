import { useState, useEffect } from 'react';
import { productsAPI } from '../api';
import toast from 'react-hot-toast';
import { Plus, Edit2, Package, ListPlus, Trash2, Sliders, CheckCircle, Info } from 'lucide-react';

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

export default function RecipePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selection / BOM
  const [selectedFg, setSelectedFg] = useState(null);
  const [bomItems, setBomItems] = useState([]);
  const [bomLoading, setBomLoading] = useState(false);

  // Modals
  const [showBomModal, setShowBomModal] = useState(false);
  const [bomRmId, setBomRmId] = useState('');
  const [bomQty, setBomQty] = useState('');
  const [bomStep, setBomStep] = useState('');
  const [bomBlendPct, setBomBlendPct] = useState('');
  const [bomNotes, setBomNotes] = useState('');
  const [editingBomId, setEditingBomId] = useState(null);

  // Load products on mount
  const loadProducts = () => {
    setLoading(true);
    productsAPI.list()
      .then(r => {
        setProducts(r.data.data);
        // Retain selection if available
        if (selectedFg) {
          const updated = r.data.data.find(p => p.id === selectedFg.id);
          if (updated) setSelectedFg(updated);
        }
      })
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const loadBom = (fgId) => {
    setBomLoading(true);
    productsAPI.getBom(fgId)
      .then(r => setBomItems(r.data.data))
      .catch(() => toast.error('Failed to load BOM recipes'))
      .finally(() => setBomLoading(false));
  };

  const handleSelectFg = (prod) => {
    if (prod.type !== 'FINISHED_GOOD') {
      setSelectedFg(null);
      return;
    }
    setSelectedFg(prod);
    loadBom(prod.id);
  };

  // Recipe Form Reset
  const resetBomForm = () => {
    setEditingBomId(null);
    setBomRmId('');
    setBomQty('');
    setBomStep('');
    setBomBlendPct('');
    setBomNotes('');
  };

  // Prepopulate edit form
  const handleEditBom = (item) => {
    setEditingBomId(item.id);
    setBomRmId(item.raw_material_id);
    setBomQty(item.qty_required.toString());
    setBomStep(item.production_step || '');
    setBomBlendPct(item.blend_pct ? item.blend_pct.toString() : '');
    setBomNotes(item.notes || '');
    setShowBomModal(true);
  };

  // Blend Percentage Auto-calculation
  useEffect(() => {
    if (!selectedFg || !selectedFg.pack_size_g || !bomRmId || !bomQty) {
      setBomBlendPct('');
      return;
    }
    const selectedRm = rawMaterials.find(rm => rm.id === bomRmId);
    const rmUnit = selectedRm ? selectedRm.unit : '';
    const qtyVal = parseFloat(bomQty);
    if (isNaN(qtyVal)) {
      setBomBlendPct('');
      return;
    }
    const qtyInGrams = (rmUnit?.toUpperCase() === 'KG') ? (qtyVal * 1000) : qtyVal;
    const calculated = (qtyInGrams / selectedFg.pack_size_g) * 100;
    setBomBlendPct(calculated.toFixed(2));
  }, [bomRmId, bomQty, selectedFg]);

  // Submit recipe line
  const handleBomSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFg || !bomRmId || !bomQty) return;
    if (parseFloat(bomQty) <= 0) return toast.error('Quantity required must be positive');

    try {
      const payload = {
        raw_material_id: bomRmId,
        qty_required: parseFloat(bomQty),
        production_step: bomStep || null,
        blend_pct: bomBlendPct ? parseFloat(bomBlendPct) : null,
        notes: bomNotes || ''
      };

      if (editingBomId) {
        await productsAPI.updateBom(selectedFg.id, editingBomId, payload);
        toast.success('Recipe ingredient updated successfully');
      } else {
        await productsAPI.addBom(selectedFg.id, payload);
        toast.success('Recipe ingredient added successfully');
      }
      setShowBomModal(false);
      resetBomForm();
      loadBom(selectedFg.id);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save recipe ingredient');
    }
  };

  // Delete recipe line
  const handleDeleteBom = async (bomId) => {
    if (!window.confirm('Remove this ingredient from recipe?')) return;
    try {
      await productsAPI.deleteBom(selectedFg.id, bomId);
      toast.success('Ingredient removed from recipe');
      loadBom(selectedFg.id);
    } catch (err) {
      toast.error('Failed to remove ingredient');
    }
  };

  // Filter finished goods / blends (only finished goods can have BOM)
  const finishedGoods = products.filter(p => p.type === 'FINISHED_GOOD');

  // List eligible ingredients (filter out self-reference)
  const rawMaterials = products.filter(p => !selectedFg || p.id !== selectedFg.id);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Recipe Management</h2>
          <p>Configure raw material mixtures, grinding ratios, packing blend percentages, and execution steps</p>
        </div>
      </div>

      <div className="responsive-grid-4-6">
        
        {/* Finished Goods / Blends Selection List */}
        <div className="card">
          <div className="card-header">
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Package size={16} className="text-primary" />
              <span>Select Finished Good / Spice Blend</span>
            </div>
          </div>

          {loading ? (
            <div className="loading-center"><div className="loading-spinner"></div></div>
          ) : finishedGoods.length === 0 ? (
            <div className="empty-state">
              <Package size={32} />
              <p>No finished good products defined in catalog.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Pack Size</th>
                  </tr>
                </thead>
                <tbody>
                  {finishedGoods.map(p => {
                    const isSelected = selectedFg?.id === p.id;
                    return (
                      <tr 
                        key={p.id}
                        onClick={() => handleSelectFg(p)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent'
                        }}
                      >
                        <td style={{ fontWeight: 700 }}>{p.code}</td>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td>
                          {p.category ? (
                            <span className="badge badge-blue" style={{ fontSize: 10 }}>{p.category}</span>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ fontSize: 13, fontWeight: 500 }}>
                          {p.packSizeG ? `${p.packSizeG}g` : 'Bulk (KG)'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recipe Configuration (BOM) */}
        <div className="card">
          {selectedFg ? (
            <div>
              <div className="card-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 16 }}>
                <div>
                  <div className="card-title">Recipe Bill of Materials: {selectedFg.name}</div>
                  <div className="card-subtitle">Define ingredients and proportions to produce 1 {selectedFg.unit}</div>
                </div>
                <button 
                  className="btn btn-primary btn-sm" 
                  onClick={() => { resetBomForm(); setShowBomModal(true); }}
                >
                  <ListPlus size={14} />
                  Add Ingredient
                </button>
              </div>

              {selectedFg.packSizeG && (
                <div style={{ 
                  padding: '10px 16px', 
                  background: 'rgba(59, 130, 246, 0.05)', 
                  fontSize: 12.5, 
                  display: 'flex', 
                  gap: 20, 
                  borderBottom: '1px dashed var(--color-border)',
                  color: 'var(--color-text-secondary)'
                }}>
                  <span><strong>Pack weight:</strong> {selectedFg.packSizeG}g</span>
                  {selectedFg.packsPerKg && <span><strong>Packs / KG:</strong> {selectedFg.packsPerKg}</span>}
                  {selectedFg.batchSizeKg && <span><strong>Batch Size:</strong> {selectedFg.batchSizeKg} KG</span>}
                </div>
              )}

              {selectedFg.processNotes && (
                <div style={{ padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', fontSize: 12.5, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 6, borderBottom: '1px solid var(--color-border)' }}>
                  <Info size={14} style={{ marginTop: 2, flexShrink: 0, color: 'var(--color-primary-light)' }} />
                  <div><strong>Process Notes:</strong> {selectedFg.processNotes}</div>
                </div>
              )}

              <div style={{ marginTop: 20 }}>
                {bomLoading ? (
                  <div className="loading-center"><div className="loading-spinner"></div></div>
                ) : bomItems.length === 0 ? (
                  <div className="empty-state">
                    <Sliders size={36} />
                    <p>No ingredients configured for this spice recipe.</p>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Ingredient Name</th>
                          <th>Production Step</th>
                          <th style={{ textAlign: 'right' }}>Qty Required</th>
                          <th>Unit</th>
                          <th style={{ textAlign: 'right' }}>Blend %</th>
                          <th>Processing Notes</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bomItems.map(item => (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 700 }}>{item.raw_material_code}</td>
                            <td style={{ fontWeight: 600 }}>{item.raw_material_name}</td>
                            <td>
                              {item.production_step ? (
                                <span className={`badge ${getStepBadgeClass(item.production_step)}`} style={{ fontSize: 10 }}>
                                  {item.production_step}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                              )}
                            </td>
                            <td style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-light)', textAlign: 'right' }}>
                              {item.qty_required.toFixed(4)}
                            </td>
                            <td>{item.unit}</td>
                            <td style={{ fontWeight: 600, textAlign: 'right' }}>
                              {item.blend_pct != null ? `${item.blend_pct}%` : '—'}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--color-text-secondary)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.notes}>
                              {item.notes || '—'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: 4 }}>
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleEditBom(item)}>
                                  <Edit2 size={13} />
                                </button>
                                <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => handleDeleteBom(item.id)}>
                                  <Trash2 size={13} />
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
              <Sliders size={48} style={{ opacity: 0.3 }} />
              <h3>BOM Recipe Setup</h3>
              <p>Choose a Finished Good or Spice Blend from the list on the left to configure or inspect its ingredients.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Ingredient Modal */}
      {showBomModal && (
        <div className="modal-overlay" onClick={() => setShowBomModal(false)}>
          <form className="modal" onSubmit={handleBomSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingBomId ? 'Edit Recipe Ingredient' : 'Add Recipe Ingredient'}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowBomModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Select Ingredient Product (Raw Material / Bulk Blend) <span>*</span></label>
                <select 
                  className="form-control" 
                  value={bomRmId} 
                  onChange={(e) => setBomRmId(e.target.value)}
                  disabled={editingBomId != null}
                  required
                >
                  <option value="">Select ingredient...</option>
                  {rawMaterials.map(rm => (
                    <option key={rm.id} value={rm.id}>[{rm.code}] {rm.name} ({rm.unit})</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Quantity Required (per 1 {selectedFg.unit}) <span>*</span></label>
                  <input 
                    type="number" 
                    step="any"
                    min="0.00001"
                    placeholder="0.00" 
                    className="form-control" 
                    value={bomQty} 
                    onChange={(e) => setBomQty(e.target.value)}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Production Step</label>
                  <select 
                    className="form-control"
                    value={bomStep}
                    onChange={(e) => setBomStep(e.target.value)}
                  >
                    <option value="">— Select Step —</option>
                    <option value="CLEANING">Cleaning</option>
                    <option value="DRYING">Drying</option>
                    <option value="ROASTING">Roasting</option>
                    <option value="GRINDING">Grinding</option>
                    <option value="BLENDING">Blending</option>
                    <option value="PACKING">Packing</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Blend % (Calculated)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={bomBlendPct ? `${bomBlendPct}%` : 'N/A (Ensure Pack Size on parent FG is set)'} 
                  disabled 
                  style={{ background: 'var(--color-bg-input)', opacity: 0.7 }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Ingredient Processing / Execution Notes</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={bomNotes} 
                  onChange={(e) => setBomNotes(e.target.value)} 
                  placeholder="e.g. coarse grind, temper, dry roast first..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowBomModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">{editingBomId ? 'Save Changes' : 'Add to Recipe'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
