import { useState, useEffect } from 'react';
import { productsAPI, warehousesAPI, productionPlansAPI, usersAPI, stockAPI } from '../api';
import toast from 'react-hot-toast';
import { 
  Factory, Save, AlertTriangle, CheckCircle, Calendar, 
  Info, Warehouse, Package, RefreshCw, AlertCircle, ArrowRight, User
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function ProductionRunPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routerState = location.state;
  
  const [productionOrderId, setProductionOrderId] = useState('');
  const [productionOrderItemId, setProductionOrderItemId] = useState('');

  // Master Data
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [users, setUsers] = useState([]);
  const [allWarehouseSections, setAllWarehouseSections] = useState({});
  const [loadingMaster, setLoadingMaster] = useState(true);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('');
  const [destWarehouseId, setDestWarehouseId] = useState('');
  const [destSectionId, setDestSectionId] = useState('');
  const [destSections, setDestSections] = useState([]);
  const [assignedUserId, setAssignedUserId] = useState('');
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

  // Handle prefilled state from Production Order
  useEffect(() => {
    if (routerState) {
      if (routerState.product_id) {
        setSelectedProductId(routerState.product_id);
      }
      if (routerState.quantity) {
        setTargetQuantity(routerState.quantity);
      }
      if (routerState.production_order_id) {
        setProductionOrderId(routerState.production_order_id);
      }
      if (routerState.production_order_item_id) {
        setProductionOrderItemId(routerState.production_order_item_id);
      }
    }
  }, [routerState]);

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

        // Load all users for assignment
        const userRes = await usersAPI.list();
        setUsers(userRes.data.data || []);

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
            // Available stock for planning = total physical stock - locked stock
            const qty = matched ? (matched.quantity - (matched.locked_quantity || 0)) : 0;
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
        console.error('Failed to load recipe and stock:', err);
        toast.error('Failed to load recipe: ' + (err.response?.data?.message || err.message));
      } finally {
        setLoadingBom(false);
      }
    };

    loadRecipeAndStock();
  }, [selectedProductId, warehouses, allWarehouseSections]);

  // Build full flat list of warehouse/sections in the system
  const getAllPossibleLocations = () => {
    const list = [];
    warehouses.forEach(w => {
      const sections = allWarehouseSections[w.id] || [];
      // Always allow Open Area (no specific shelf)
      list.push({
        key: `${w.id}:OPEN`,
        warehouseId: w.id,
        warehouseName: w.name,
        sectionId: null,
        sectionName: 'Open Area'
      });
      // Add specific sections if any
      sections.forEach(s => {
        list.push({
          key: `${w.id}:${s.id}`,
          warehouseId: w.id,
          warehouseName: w.name,
          sectionId: s.id,
          sectionName: s.name
        });
      });
    });
    return list;
  };

  // Helper to get stock for a specific ingredient + location (adjusted for locked stock)
  const getIngredientStockForLocation = (ingredientId, whId, secId) => {
    const locs = ingredientStockLocations[ingredientId] || [];
    const matched = locs.find(sl => 
      sl.warehouse_id === whId && 
      ((!sl.section_id && !secId) || (sl.section_id === secId))
    );
    if (!matched) return 0;
    const avail = matched.quantity - (matched.locked_quantity || 0);
    return avail > 0 ? avail : 0;
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
  const getKgMultiplier = (product) => {
    if (!product) return 1.0;
    if (product.unit?.toUpperCase() === 'KG') {
      return 1.0;
    }
    if (product.packs_per_kg && product.packs_per_kg > 0) {
      return 1.0 / product.packs_per_kg;
    }
    if (product.pack_size_g && product.pack_size_g > 0) {
      return product.pack_size_g / 1000.0;
    }
    return 1.0;
  };
  const multiplier = getKgMultiplier(selectedProduct);
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
    if (!assignedUserId) return { feasible: false, error: 'Assigned Operator is required.' };

    for (let item of bomItems) {
      const ingredientId = item.raw_material_id;
      const selection = ingredientSelections[ingredientId];
      if (!selection || !selection.warehouseId) {
        return { feasible: false, error: `Allocation location is missing for ${item.raw_material_name}.` };
      }
      
      const requiredQty = item.qty_required * (qtyNum * multiplier) * scalingFactor;
      if (selection.availableStock < requiredQty) {
        return { feasible: false, error: `Insufficient stock for ${item.raw_material_name}. Need ${requiredQty.toFixed(3)}, have ${selection.availableStock.toFixed(3)}.` };
      }
    }
    return { feasible: true, error: null };
  };

  const feasibilityCheck = validateExecutionFeasibility();

  // Submit Plan
  const handleExecuteRun = async (e) => {
    e.preventDefault();
    
    const qtyNum = parseFloat(targetQuantity);
    if (!selectedProductId || !destWarehouseId || !assignedUserId || isNaN(qtyNum) || qtyNum <= 0) {
      return toast.error('Product, destination warehouse, assigned operator, and target quantity are required');
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
        assigned_user_id: assignedUserId,
        plan_date: transactionDate,
        ingredients: bomItems.map(item => {
          const ingredientId = item.raw_material_id;
          const selection = ingredientSelections[ingredientId];
          const needed = item.qty_required * (qtyNum * multiplier) * scalingFactor;
          return {
            product_id: ingredientId,
            quantity: Math.round(needed * 1000.0) / 1000.0,
            warehouse_id: selection.warehouseId,
            section_id: selection.sectionId
          };
        })
      };

      const res = await productionPlansAPI.create(payload);
      toast.success(res.data.message || 'Production Plan created & stock locked!');
      
      // Navigate to Actual Production Entry list
      navigate('/actual-production');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create production plan');
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

  const eligibleProducts = products;

  return (
    <div className="fade-in" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Create Production Plan</h2>
          <p>Plan a daily production run and lock raw materials without moving them out yet</p>
        </div>
        <div className="page-header-right">
          <Link to="/products" className="btn btn-secondary btn-sm">
            <Package size={14} />
            Configure Recipes
          </Link>
        </div>
      </div>

      <div className="production-run-layout">
        
        {/* Main Entry Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Section: Recipe Setup */}
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Factory size={18} className="text-primary" />
                <span>Production Plan Configuration</span>
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
                  <strong>Pack details:</strong> {selectedProduct.pack_size_g ? `${selectedProduct.pack_size_g}g Pack` : 'Bulk Blend'}
                  {selectedProduct.batch_size_kg && ` | Std Batch: ${selectedProduct.batch_size_kg} KG`}
                  {selectedProduct.process_notes && ` | Notes: ${selectedProduct.process_notes}`}
                </div>
              )}

              {/* Assignment and Date Configuration */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Assigned Operator (APK User)</label>
                  <select 
                    className="form-control"
                    value={assignedUserId}
                    onChange={e => setAssignedUserId(e.target.value)}
                  >
                    <option value="">Choose operator...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role || 'Staff'})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Plan Date</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input 
                      type="date"
                      className="form-control"
                      value={transactionDate}
                      onChange={e => setTransactionDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

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
                <div className="card-title">Recipe Ingredients Stock Locking & Allocation</div>
              </div>
              {/* Desktop Table View */}
              <div className="table-wrapper hide-on-mobile" style={{ margin: 0, border: 'none' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Raw Material Ingredient</th>
                      <th style={{ textAlign: 'right' }}>Formula Qty</th>
                      <th style={{ textAlign: 'right' }}>Total Needed</th>
                      <th>Source Stock Location</th>
                      <th style={{ textAlign: 'right' }}>Available Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingBom && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: 20 }}>
                          <div className="loading-spinner" style={{ margin: '0 auto' }} />
                        </td>
                      </tr>
                    )}
                    {!loadingBom && bomItems.map(item => {
                      const ingredientId = item.raw_material_id;
                      const selection = ingredientSelections[ingredientId] || { warehouseId: '', sectionId: null, availableStock: 0 };
                      const needed = item.qty_required * (parseFloat(targetQuantity) || 0) * multiplier * scalingFactor;
                      const isInsuff = selection.availableStock < needed;
                      
                      return (
                        <tr key={item.id} style={{ background: isInsuff ? 'rgba(239, 68, 68, 0.03)' : 'transparent' }}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.raw_material_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Code: {item.raw_material_code} | Step: {item.production_step || 'BLENDING'}</div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {item.qty_required} {item.raw_material_unit}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {needed.toFixed(3)} {item.raw_material_unit}
                          </td>
                          <td>
                            <select 
                              className="form-control form-control-sm"
                              value={selection.warehouseId ? `${selection.warehouseId}:${selection.sectionId || 'OPEN'}` : ''}
                              onChange={e => handleIngredientLocationChange(ingredientId, e.target.value)}
                              style={{ minWidth: 160, border: isInsuff ? '1px solid var(--color-danger)' : '1px solid var(--color-border)' }}
                            >
                              <option value="">Select source...</option>
                              {getAllPossibleLocations().map(loc => {
                                const stock = getIngredientStockForLocation(ingredientId, loc.warehouseId, loc.sectionId);
                                return (
                                  <option key={loc.key} value={`${loc.warehouseId}:${loc.sectionId || 'OPEN'}`}>
                                    {loc.warehouseName} - {loc.sectionName} ({stock.toFixed(2)} {item.raw_material_unit} avail)
                                  </option>
                                );
                              })}
                            </select>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: isInsuff ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            {selection.availableStock.toFixed(3)} {item.raw_material_unit}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="mobile-card-list show-on-mobile" style={{ padding: '0 16px 16px 16px' }}>
                {loadingBom && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                    <div className="loading-spinner" />
                  </div>
                )}
                {!loadingBom && bomItems.map(item => {
                  const ingredientId = item.raw_material_id;
                  const selection = ingredientSelections[ingredientId] || { warehouseId: '', sectionId: null, availableStock: 0 };
                  const needed = item.qty_required * (parseFloat(targetQuantity) || 0) * multiplier * scalingFactor;
                  const isInsuff = selection.availableStock < needed;

                  return (
                    <div className="mobile-card" key={item.id} style={{ border: isInsuff ? '1px solid var(--color-danger)' : '1px solid var(--color-border)', background: isInsuff ? 'rgba(239, 68, 68, 0.02)' : 'var(--color-bg-card)', marginBottom: 12 }}>
                      <div className="mobile-card-header" style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <span className="mobile-card-title">{item.raw_material_name}</span>
                        <span className="badge badge-gray" style={{ fontSize: 10 }}>{item.production_step || 'BLENDING'}</span>
                      </div>
                      
                      <div className="mobile-card-section" style={{ gap: 8 }}>
                        <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>Code: {item.raw_material_code}</div>
                        
                        <div className="mobile-card-metrics">
                          <div className="mobile-card-metric-item">
                            <span className="mobile-card-metric-label">Formula Qty</span>
                            <span className="mobile-card-metric-value">{item.qty_required} {item.raw_material_unit}</span>
                          </div>
                          <div className="mobile-card-metric-item">
                            <span className="mobile-card-metric-label">Total Needed</span>
                            <span className="mobile-card-metric-value" style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{needed.toFixed(3)} {item.raw_material_unit}</span>
                          </div>
                        </div>

                        <div className="form-group" style={{ margin: '8px 0 0 0' }}>
                          <label className="form-label" style={{ fontSize: 11, textTransform: 'uppercase', marginBottom: 4, display: 'block', fontWeight: 600 }}>Source Stock Location</label>
                          <select 
                            className="form-control form-control-sm"
                            value={selection.warehouseId ? `${selection.warehouseId}:${selection.sectionId || 'OPEN'}` : ''}
                            onChange={e => handleIngredientLocationChange(ingredientId, e.target.value)}
                            style={{ width: '100%', border: isInsuff ? '1px solid var(--color-danger)' : '1px solid var(--color-border)' }}
                          >
                            <option value="">Select source...</option>
                            {getAllPossibleLocations().map(loc => {
                              const stock = getIngredientStockForLocation(ingredientId, loc.warehouseId, loc.sectionId);
                              return (
                                <option key={loc.key} value={`${loc.warehouseId}:${loc.sectionId || 'OPEN'}`}>
                                  {loc.warehouseName} - {loc.sectionName} ({stock.toFixed(2)} {item.raw_material_unit} avail)
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: 13 }}>
                          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>Available Stock:</span>
                          <span style={{ fontWeight: 700, color: isInsuff ? 'var(--color-danger)' : 'var(--color-success)' }}>
                            {selection.availableStock.toFixed(3)} {item.raw_material_unit}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Audit / Summary Panel */}
        <div className="run-summary-panel">
          
          {/* Card: Plan Summary */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Production Summary</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Target Product</span>
                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{selectedProduct?.name || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Target Output</span>
                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {targetQuantity ? `${targetQuantity} ${selectedProduct?.unit || ''}` : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Process Loss</span>
                <span style={{ fontWeight: 700, color: wastage + damage > 0 ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>
                  {(wastage + damage).toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Operator</span>
                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {users.find(u => u.id === assignedUserId)?.name || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Plan Date</span>
                <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{transactionDate}</span>
              </div>
            </div>
          </div>

          {/* Card: Feasibility */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Planning Feasibility</div>
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
                        <strong>Plan Feasible</strong>
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
                <Save size={16} />
                {submitting ? 'Saving Plan...' : 'Save Production Plan'}
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
