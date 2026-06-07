import { useState, useEffect } from 'react';
import { productsAPI, warehousesAPI, transactionsAPI, stockAPI } from '../api';
import toast from 'react-hot-toast';
import { 
  Factory, Save, AlertTriangle, CheckCircle, Calendar, 
  Info, Warehouse, Package, RefreshCw, AlertCircle, ArrowRight 
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function ProductionRunPage() {
  const navigate = useNavigate();

  // Master Data
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [allWarehouseSections, setAllWarehouseSections] = useState({});
  const [loadingMaster, setLoadingMaster] = useState(true);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('');
  const [destWarehouseId, setDestWarehouseId] = useState('');
  const [destSectionId, setDestSectionId] = useState('');
  const [destSections, setDestSections] = useState([]);
  const [wastagePct, setWastagePct] = useState('0');
  const [damagePct, setDamagePct] = useState('0');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  
  // Recipe & Inventory State
  const [bomItems, setBomItems] = useState([]);
  const [loadingBom, setLoadingBom] = useState(false);
  const [ingredientStockLocations, setIngredientStockLocations] = useState({});
  const [ingredientSelections, setIngredientSelections] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Load master data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingMaster(true);
        // Load all active products
        const prodRes = await productsAPI.list({ active: true });
        setProducts(prodRes.data.data);

        // Load all warehouses
        const whRes = await warehousesAPI.list();
        const whs = whRes.data.data;
        setWarehouses(whs);

        // Eagerly load sections for all warehouses to map allocations
        const secPromises = whs.map(w =>
          warehousesAPI.sections(w.id)
            .then(res => ({ warehouseId: w.id, sections: res.data.data }))
            .catch(() => ({ warehouseId: w.id, sections: [] }))
        );
        const secs = await Promise.all(secPromises);
        const secMap = {};
        secs.forEach(s => {
          secMap[s.warehouseId] = s.sections;
        });
        setAllWarehouseSections(secMap);
      } catch (err) {
        toast.error('Failed to load master configuration data');
      } finally {
        setLoadingMaster(false);
      }
    };
    loadData();
  }, []);

  // Sync destination sections when destination warehouse changes
  useEffect(() => {
    if (destWarehouseId) {
      setDestSections(allWarehouseSections[destWarehouseId] || []);
      setDestSectionId('');
    } else {
      setDestSections([]);
      setDestSectionId('');
    }
  }, [destWarehouseId, allWarehouseSections]);

  // Load BOM and live ingredient stock locations when product changes
  useEffect(() => {
    if (!selectedProductId) {
      setBomItems([]);
      setIngredientStockLocations({});
      setIngredientSelections({});
      return;
    }

    const loadRecipeAndStock = async () => {
      setLoadingBom(true);
      try {
        const bomRes = await productsAPI.getBom(selectedProductId);
        const bomData = bomRes.data.data;
        setBomItems(bomData);

        if (bomData.length === 0) {
          toast.error('Selected product does not have any recipe (BOM) configured.');
          return;
        }

        // Fetch location stock balances for all recipe ingredients
        const locPromises = bomData.map(item =>
          stockAPI.locate(item.raw_material_id)
            .then(res => ({
              productId: item.raw_material_id,
              locations: res.data.data.locations,
              total: res.data.data.total_quantity
            }))
            .catch(() => ({
              productId: item.raw_material_id,
              locations: [],
              total: 0
            }))
        );
        const stockData = await Promise.all(locPromises);
        
        const locMap = {};
        stockData.forEach(d => {
          locMap[d.productId] = d.locations;
        });
        setIngredientStockLocations(locMap);

        // Prepopulate best source warehouse & section for each ingredient
        const initialSelections = {};
        const allPossibleLocations = getAllPossibleLocations();

        bomData.forEach(item => {
          const ingredientId = item.raw_material_id;
          const locs = locMap[ingredientId] || [];
          
          let bestLoc = null;
          let maxStock = -1;

          allPossibleLocations.forEach(loc => {
            const matched = locs.find(sl => 
              sl.warehouse_id === loc.warehouseId && 
              ((!sl.section_id && !loc.sectionId) || (sl.section_id === loc.sectionId))
            );
            const qty = matched ? matched.quantity : 0;
            if (qty > maxStock) {
              maxStock = qty;
              bestLoc = loc;
            }
          });

          initialSelections[ingredientId] = {
            warehouseId: bestLoc ? bestLoc.warehouseId : '',
            sectionId: bestLoc ? bestLoc.sectionId : null,
            availableStock: maxStock > 0 ? maxStock : 0
          };
        });
        setIngredientSelections(initialSelections);

      } catch (err) {
        toast.error('Failed to load recipe ingredients and current stock balances');
      } finally {
        setLoadingBom(false);
      }
    };

    loadRecipeAndStock();
  }, [selectedProductId]);

  // Build full flat list of warehouse/sections in the system
  const getAllPossibleLocations = () => {
    const list = [];
    warehouses.forEach(w => {
      const sections = allWarehouseSections[w.id] || [];
      if (sections.length === 0) {
        list.push({
          key: `${w.id}:OPEN`,
          warehouseId: w.id,
          warehouseName: w.name,
          sectionId: null,
          sectionName: 'Open Area'
        });
      } else {
        sections.forEach(s => {
          list.push({
            key: `${w.id}:${s.id}`,
            warehouseId: w.id,
            warehouseName: w.name,
            sectionId: s.id,
            sectionName: s.name
          });
        });
      }
    });
    return list;
  };

  const allPossibleLocations = getAllPossibleLocations();

  // Helper to get stock for a specific ingredient + location
  const getIngredientStockForLocation = (ingredientId, whId, secId) => {
    const locs = ingredientStockLocations[ingredientId] || [];
    const matched = locs.find(sl => 
      sl.warehouse_id === whId && 
      ((!sl.section_id && !secId) || (sl.section_id === secId))
    );
    return matched ? matched.quantity : 0;
  };

  // Handle ingredient location selector change
  const handleIngredientLocationChange = (ingredientId, valueKey) => {
    if (!valueKey) {
      setIngredientSelections(prev => ({
        ...prev,
        [ingredientId]: { warehouseId: '', sectionId: null, availableStock: 0 }
      }));
      return;
    }

    const [whId, secId] = valueKey.split(':');
    const targetSec = secId === 'OPEN' ? null : secId;
    const stock = getIngredientStockForLocation(ingredientId, whId, targetSec);

    setIngredientSelections(prev => ({
      ...prev,
      [ingredientId]: {
        warehouseId: whId,
        sectionId: targetSec,
        availableStock: stock
      }
    }));
  };

  // Calculations
  const selectedProduct = products.find(p => p.id === selectedProductId);
  const wastage = parseFloat(wastagePct) || 0;
  const damage = parseFloat(damagePct) || 0;
  const lossMultiplier = 1.0 - ((wastage + damage) / 100.0);
  const scalingFactor = lossMultiplier > 0 ? (1.0 / lossMultiplier) : 1.0;

  // Verify all ingredients are allocated and have sufficient stock
  const validateExecutionFeasibility = () => {
    if (bomItems.length === 0) return { feasible: false, error: 'No recipe items loaded.' };
    const qtyNum = parseFloat(targetQuantity);
    if (isNaN(qtyNum) || qtyNum <= 0) return { feasible: false, error: 'Please enter a valid production quantity.' };
    if (!destWarehouseId) return { feasible: false, error: 'Destination warehouse is required.' };

    for (let item of bomItems) {
      const ingredientId = item.raw_material_id;
      const selection = ingredientSelections[ingredientId];
      if (!selection || !selection.warehouseId) {
        return { feasible: false, error: `Allocation location is missing for ${item.raw_material_name}.` };
      }
      
      const requiredQty = item.qtyRequired * qtyNum * scalingFactor;
      if (selection.availableStock < requiredQty) {
        return { feasible: false, error: `Insufficient stock for ${item.raw_material_name}. Need ${requiredQty.toFixed(3)}, have ${selection.availableStock.toFixed(3)}.` };
      }
    }
    return { feasible: true, error: null };
  };

  const feasibilityCheck = validateExecutionFeasibility();

  // Submit Run
  const handleExecuteRun = async (e) => {
    e.preventDefault();
    
    const qtyNum = parseFloat(targetQuantity);
    if (!selectedProductId || !destWarehouseId || isNaN(qtyNum) || qtyNum <= 0) {
      return toast.error('Product, destination warehouse, and target quantity are required');
    }

    const check = validateExecutionFeasibility();
    if (!check.feasible) {
      return toast.error(check.error);
    }

    setSubmitting(true);
    try {
      const payload = {
        product_id: selectedProductId,
        quantity: qtyNum,
        warehouse_id: destWarehouseId,
        section_id: destSectionId || null,
        wastage_pct: wastage,
        damage_pct: damage,
        transaction_date: transactionDate,
        remarks: remarks || `Production run of ${selectedProduct.name} - ${qtyNum} ${selectedProduct.unit}`,
        ingredients: bomItems.map(item => {
          const ingredientId = item.raw_material_id;
          const selection = ingredientSelections[ingredientId];
          const needed = item.qtyRequired * qtyNum * scalingFactor;
          return {
            product_id: ingredientId,
            quantity: Math.round(needed * 1000.0) / 1000.0,
            warehouse_id: selection.warehouseId,
            section_id: selection.sectionId
          };
        })
      };

      const res = await transactionsAPI.productionRun(payload);
      toast.success(res.data.message || 'Production Run recorded and executed!');
      
      // Navigate to Transaction History to see the result
      navigate('/transactions');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to execute production run');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMaster) {
    return (
      <div className="loading-center" style={{ height: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  // Filter products that have recipes or are marked as FG
  // (We allow any product since users might define custom blends, 
  // but if they don't have BOM, the recipe loader will warn them)
  const eligibleProducts = products;

  return (
    <div className="fade-in" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Production Execution</h2>
          <p>Deduct raw materials and package items transactionally to record finished goods output</p>
        </div>
        <div className="page-header-right">
          <Link to="/products" className="btn btn-secondary btn-sm">
            <Package size={14} />
            Configure Recipes
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        
        {/* Main Entry Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Section: Recipe Setup */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Factory size={18} className="text-primary" />
                <span>Production Batch Configuration</span>
              </div>
            </div>

            <div className="modal-body" style={{ padding: 0 }}>
              
              {/* Product selection */}
              <div className="form-group">
                <label className="form-label">Target Product to Produce (Bulk Blend / Pouch Pack)</label>
                <select 
                  className="form-control"
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                >
                  <option value="">Select product to produce...</option>
                  {eligibleProducts.map(p => (
                    <option key={p.id} value={p.id}>[{p.code}] {p.name} ({p.unit})</option>
                  ))}
                </select>
              </div>

              {selectedProduct && (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(59, 130, 246, 0.05)',
                  border: '1px dashed rgba(59, 130, 246, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 13,
                  color: 'var(--color-text-secondary)'
                }}>
                  <strong>Pack details:</strong> {selectedProduct.packSizeG ? `${selectedProduct.packSizeG}g Pack` : 'Bulk Blend'}
                  {selectedProduct.batchSizeKg && ` | Std Batch: ${selectedProduct.batchSizeKg} KG`}
                  {selectedProduct.processNotes && ` | Notes: ${selectedProduct.processNotes}`}
                </div>
              )}

              {/* Destination storage configuration */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Destination Warehouse (Output Stock-In)</label>
                  <select 
                    className="form-control"
                    value={destWarehouseId}
                    onChange={e => setDestWarehouseId(e.target.value)}
                  >
                    <option value="">Choose warehouse...</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.location})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Destination Section</label>
                  <select 
                    className="form-control"
                    value={destSectionId}
                    onChange={e => setDestSectionId(e.target.value)}
                    disabled={!destWarehouseId}
                  >
                    <option value="">Open Area (No specific shelf)</option>
                    {destSections.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quantity and Process loss inputs */}
              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Target Quantity to Output</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input 
                      type="number" step="any" min="0.0001" placeholder="0.00"
                      className="form-control"
                      value={targetQuantity}
                      onChange={e => setTargetQuantity(e.target.value)}
                    />
                    <span style={{ position: 'absolute', right: 12, fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      {selectedProduct?.unit || 'PCS'}
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Process Wastage %</label>
                  <input 
                    type="number" step="any" min="0" max="99" placeholder="0%"
                    className="form-control"
                    value={wastagePct}
                    onChange={e => setWastagePct(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Damage / Rejection %</label>
                  <input 
                    type="number" step="any" min="0" max="99" placeholder="0%"
                    className="form-control"
                    value={damagePct}
                    onChange={e => setDamagePct(e.target.value)}
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Section: Ingredients Allocation Table */}
          {selectedProductId && (
            <div className="card">
              <div className="card-header">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Warehouse size={18} className="text-success" />
                  <span>Recipe Ingredients Stock Allocations</span>
                </div>
                {loadingBom && <RefreshCw size={16} className="loading-spinner" />}
              </div>

              {loadingBom ? (
                <div className="loading-center"><div className="loading-spinner"></div></div>
              ) : bomItems.length === 0 ? (
                <div className="empty-state">
                  <AlertTriangle size={32} className="text-warning" />
                  <h3>No Recipe Configuration Found</h3>
                  <p>You cannot execute production runs on products that don't have a BOM defined.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Ingredient</th>
                        <th>Qty Needed</th>
                        <th>Source Location & Available Stock</th>
                        <th>Allocation Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bomItems.map((item, idx) => {
                        const ingredientId = item.raw_material_id;
                        const needed = item.qtyRequired * parseFloat(targetQuantity || 0) * scalingFactor;
                        const selection = ingredientSelections[ingredientId] || { warehouseId: '', sectionId: null, availableStock: 0 };
                        const isSufficient = selection.availableStock >= needed;

                        return (
                          <tr key={idx}>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <strong style={{ color: 'var(--color-text-primary)' }}>{item.raw_material_name}</strong>
                                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                  Code: {item.raw_material_code} | Step: {item.productionStep || 'BLENDING'}
                                </span>
                              </div>
                            </td>
                            <td style={{ fontWeight: 700, fontSize: 14 }}>
                              {isNaN(needed) ? '0.000' : needed.toFixed(3)} {item.unit}
                              <div style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 400 }}>
                                (Base: {item.qtyRequired} {item.unit}/fg)
                              </div>
                            </td>
                            <td>
                              <select
                                className="form-control"
                                style={{ padding: '6px 10px', fontSize: 13, minWidth: 260 }}
                                value={selection.warehouseId ? `${selection.warehouseId}:${selection.sectionId || 'OPEN'}` : ''}
                                onChange={e => handleIngredientLocationChange(ingredientId, e.target.value)}
                              >
                                <option value="">-- Choose Allocation Source --</option>
                                {allPossibleLocations.map(loc => {
                                  const stock = getIngredientStockForLocation(ingredientId, loc.warehouseId, loc.sectionId);
                                  return (
                                    <option key={loc.key} value={loc.key}>
                                      {loc.warehouseName} › {loc.sectionName} ({stock.toFixed(2)} {item.unit})
                                    </option>
                                  );
                                })}
                              </select>
                            </td>
                            <td>
                              {selection.warehouseId ? (
                                isSufficient ? (
                                  <span className="badge badge-green">Sufficient</span>
                                ) : (
                                  <span className="badge badge-red">Insufficient</span>
                                )
                              ) : (
                                <span className="badge badge-orange">Required</span>
                              )}
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
        </div>

        {/* Sidebar Status / Execution panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Metadata Card */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <div className="card-title">Run Log Details</div>
            </div>
            
            <div className="modal-body" style={{ padding: 0, gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Transaction Date</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="date"
                    className="form-control"
                    value={transactionDate}
                    onChange={e => setTransactionDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Execution Remarks</label>
                <textarea 
                  className="form-control"
                  placeholder="e.g. Batch #42 grinding run, fine texture."
                  style={{ minHeight: 70 }}
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Validation & Submit Card */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: 12 }}>
              <div className="card-title">Execution Audit Check</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {selectedProductId ? (
                bomItems.length > 0 ? (
                  feasibilityCheck.feasible ? (
                    <div style={{
                      padding: 12,
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-success-bg)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      color: 'var(--color-success)',
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8
                    }}>
                      <CheckCircle size={16} />
                      <div>
                        <strong>Batch Feasible</strong>
                        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>All ingredients are allocated with sufficient stock.</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: 12,
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-danger-bg)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      color: 'var(--color-danger)',
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8
                    }}>
                      <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <strong>Allocation Error</strong>
                        <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>{feasibilityCheck.error}</div>
                      </div>
                    </div>
                  )
                ) : (
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Info size={14} />
                    <span>Configure standard recipe first.</span>
                  </div>
                )
              ) : (
                <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Info size={14} />
                  <span>Choose a target product to calculate ingredients.</span>
                </div>
              )}

              <div className="divider" style={{ margin: '8px 0' }} />

              <button 
                type="button" 
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: 12 }}
                disabled={submitting || !feasibilityCheck.feasible}
                onClick={handleExecuteRun}
              >
                <Factory size={16} />
                {submitting ? 'Executing Run...' : 'Execute Production Run'}
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
