import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsAPI, warehousesAPI, transactionsAPI, stockAPI } from '../../api';
import toast from 'react-hot-toast';
import { Factory, Warehouse, ChevronDown, Check, Save } from 'lucide-react';

export default function ProductionRuns() {
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

  // Recipe State
  const [bomItems, setBomItems] = useState([]);
  const [loadingBom, setLoadingBom] = useState(false);
  const [ingredientStockLocations, setIngredientStockLocations] = useState({});
  const [ingredientSelections, setIngredientSelections] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Load master data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingMaster(true);
        const prodRes = await productsAPI.list({ active: true });
        setProducts(prodRes.data.data);

        const whRes = await warehousesAPI.list();
        const whs = whRes.data.data;
        setWarehouses(whs);

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
        toast.error('Failed to load master data');
      } finally {
        setLoadingMaster(false);
      }
    };
    loadData();
  }, []);

  // Sync destination sections
  useEffect(() => {
    if (destWarehouseId) {
      setDestSections(allWarehouseSections[destWarehouseId] || []);
      setDestSectionId('');
    } else {
      setDestSections([]);
      setDestSectionId('');
    }
  }, [destWarehouseId, allWarehouseSections]);

  // Load BOM & live stock locations
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
          toast.error('Product does not have a recipe configured.');
          return;
        }

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

        // Prepopulate selections
        const initialSelections = {};
        const allPossibleLocations = [];
        warehouses.forEach(w => {
          const sections = allWarehouseSections[w.id] || [];
          if (sections.length === 0) {
            allPossibleLocations.push({ warehouseId: w.id, sectionId: null });
          } else {
            sections.forEach(s => {
              allPossibleLocations.push({ warehouseId: w.id, sectionId: s.id });
            });
          }
        });

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
        toast.error('Failed to load recipe configurations');
      } finally {
        setLoadingBom(false);
      }
    };

    loadRecipeAndStock();
  }, [selectedProductId, warehouses, allWarehouseSections]);

  const allPossibleLocations = [];
  warehouses.forEach(w => {
    const sections = allWarehouseSections[w.id] || [];
    if (sections.length === 0) {
      allPossibleLocations.push({
        key: `${w.id}:OPEN`,
        warehouseId: w.id,
        warehouseName: w.name,
        sectionId: null,
        sectionName: 'Open Area'
      });
    } else {
      sections.forEach(s => {
        allPossibleLocations.push({
          key: `${w.id}:${s.id}`,
          warehouseId: w.id,
          warehouseName: w.name,
          sectionId: s.id,
          sectionName: s.name
        });
      });
    }
  });

  const getIngredientStockForLocation = (ingredientId, whId, secId) => {
    const locs = ingredientStockLocations[ingredientId] || [];
    const matched = locs.find(sl => 
      sl.warehouse_id === whId && 
      ((!sl.section_id && !secId) || (sl.section_id === secId))
    );
    return matched ? matched.quantity : 0;
  };

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

  const selectedProduct = products.find(p => p.id === selectedProductId);
  
  const getKgMultiplier = (product) => {
    if (!product) return 1.0;
    if (product.unit?.toUpperCase() === 'KG') return 1.0;
    if (product.packs_per_kg && product.packs_per_kg > 0) return 1.0 / product.packs_per_kg;
    if (product.pack_size_g && product.pack_size_g > 0) return product.pack_size_g / 1000.0;
    return 1.0;
  };

  const multiplier = getKgMultiplier(selectedProduct);
  const wastage = parseFloat(wastagePct) || 0;
  const damage = parseFloat(damagePct) || 0;
  const lossMultiplier = 1.0 - ((wastage + damage) / 100.0);
  const scalingFactor = lossMultiplier > 0 ? (1.0 / lossMultiplier) : 1.0;

  const validateFeasibility = () => {
    if (bomItems.length === 0) return { feasible: false, error: 'No recipe configurations loaded.' };
    const qtyNum = parseFloat(targetQuantity);
    if (isNaN(qtyNum) || qtyNum <= 0) return { feasible: false, error: 'Target quantity is required.' };
    if (!destWarehouseId) return { feasible: false, error: 'Destination warehouse is required.' };

    for (let item of bomItems) {
      const ingredientId = item.raw_material_id;
      const selection = ingredientSelections[ingredientId];
      if (!selection || !selection.warehouseId) {
        return { feasible: false, error: `Allocation location is missing for ${item.raw_material_name}.` };
      }
      
      const requiredQty = item.qty_required * (qtyNum * multiplier) * scalingFactor;
      if (selection.availableStock < requiredQty) {
        return { feasible: false, error: `Insufficient stock for ${item.raw_material_name}.` };
      }
    }
    return { feasible: true, error: null };
  };

  const feasibility = validateFeasibility();

  const handleExecute = async (e) => {
    e.preventDefault();
    const qtyNum = parseFloat(targetQuantity);
    if (!selectedProductId || !destWarehouseId || isNaN(qtyNum) || qtyNum <= 0) {
      return toast.error('Please fill in all required configuration fields');
    }

    const check = validateFeasibility();
    if (!check.feasible) return toast.error(check.error);

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
          const needed = item.qty_required * (qtyNum * multiplier) * scalingFactor;
          return {
            product_id: ingredientId,
            quantity: Math.round(needed * 1000.0) / 1000.0,
            warehouse_id: selection.warehouseId,
            section_id: selection.sectionId
          };
        })
      };

      const res = await transactionsAPI.productionRun(payload);
      toast.success(res.data.message || 'Production Run executed successfully!');
      navigate('/production');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to execute production run');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMaster) {
    return (
      <div className="p-spinner-wrap">
        <div className="p-spinner" />
      </div>
    );
  }

  return (
    <div className="p-page p-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Factory size={22} color="var(--p-primary)" />
        <h3 style={{ fontSize: 16, fontWeight: 800 }}>Execute Production Run</h3>
      </div>

      <div className="p-card p-card-padded">
        <form onSubmit={handleExecute} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Target Product */}
          <div className="p-form-group">
            <label className="p-label">Target Product to Produce *</label>
            <select
              className="p-select"
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              required
            >
              <option value="">Select product...</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>[{p.code}] {p.name} ({p.unit})</option>
              ))}
            </select>
          </div>

          {/* Destination */}
          <div className="p-form-group">
            <label className="p-label">Destination Warehouse *</label>
            <select
              className="p-select"
              value={destWarehouseId}
              onChange={e => setDestWarehouseId(e.target.value)}
              required
            >
              <option value="">Select warehouse...</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="p-form-group">
            <label className="p-label">Destination Section</label>
            <select
              className="p-select"
              value={destSectionId}
              onChange={e => setDestSectionId(e.target.value)}
              disabled={!destWarehouseId}
            >
              <option value="">Open Area (No shelf)</option>
              {destSections.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Qty and Losses */}
          <div className="p-form-group">
            <label className="p-label">Target Quantity *</label>
            <input
              type="number" step="any" min="0.0001"
              className="p-input"
              value={targetQuantity}
              onChange={e => setTargetQuantity(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div className="p-form-group" style={{ flex: 1 }}>
              <label className="p-label">Wastage %</label>
              <input
                type="number" step="any" min="0" max="99"
                className="p-input"
                value={wastagePct}
                onChange={e => setWastagePct(e.target.value)}
              />
            </div>
            <div className="p-form-group" style={{ flex: 1 }}>
              <label className="p-label">Damage %</label>
              <input
                type="number" step="any" min="0" max="99"
                className="p-input"
                value={damagePct}
                onChange={e => setDamagePct(e.target.value)}
              />
            </div>
          </div>

          {/* Date & Remarks */}
          <div className="p-form-group">
            <label className="p-label">Transaction Date</label>
            <input
              type="date"
              className="p-input"
              value={transactionDate}
              onChange={e => setTransactionDate(e.target.value)}
            />
          </div>

          <div className="p-form-group">
            <label className="p-label">Remarks</label>
            <input
              type="text"
              className="p-input"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Optional remarks"
            />
          </div>

          {/* Dynamic Recipe Ingredient allocations */}
          {selectedProductId && (
            <div style={{ marginTop: 8 }}>
              <div className="p-section-label" style={{ marginTop: 0 }}>Recipe Ingredient Locations</div>
              {loadingBom ? (
                <div className="p-spinner-wrap" style={{ padding: 12 }}><div className="p-spinner" /></div>
              ) : bomItems.length === 0 ? (
                <div style={{ color: 'var(--p-danger)', fontSize: 13, padding: '10px 0' }}>⚠️ No recipe (BOM) configured for this product.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {bomItems.map((item, idx) => {
                    const ingredientId = item.raw_material_id;
                    const needed = item.qty_required * (parseFloat(targetQuantity || 0) * multiplier) * scalingFactor;
                    const selection = ingredientSelections[ingredientId] || { warehouseId: '', sectionId: null, availableStock: 0 };
                    const isSufficient = selection.availableStock >= needed;

                    return (
                      <div key={idx} style={{
                        padding: 12,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--p-border)',
                        borderRadius: 'var(--p-radius-sm)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                          <span>{item.raw_material_name}</span>
                          <span style={{ color: isSufficient ? 'var(--p-primary)' : 'var(--p-danger)' }}>
                            {isNaN(needed) ? '0.00' : needed.toFixed(2)} {item.unit}
                          </span>
                        </div>
                        <select
                          className="p-select"
                          style={{ padding: '8px 10px', fontSize: 12.5 }}
                          value={selection.warehouseId ? `${selection.warehouseId}:${selection.sectionId || 'OPEN'}` : ''}
                          onChange={e => handleIngredientLocationChange(ingredientId, e.target.value)}
                        >
                          <option value="">-- Choose Allocation Source --</option>
                          {allPossibleLocations.map(loc => {
                            const stock = getIngredientStockForLocation(ingredientId, loc.warehouseId, loc.sectionId);
                            return (
                              <option key={loc.key} value={loc.key}>
                                {loc.warehouseName} › {loc.sectionName} ({stock.toFixed(1)} {item.unit})
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Feasibility Check and Submit Button */}
          {selectedProductId && !loadingBom && bomItems.length > 0 && (
            <div style={{
              padding: 10,
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              background: feasibility.feasible ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              color: feasibility.feasible ? 'var(--p-primary)' : 'var(--p-danger)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 6
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: feasibility.feasible ? 'var(--p-primary)' : 'var(--p-danger)' }} />
              <span>{feasibility.feasible ? 'Allocation valid' : feasibility.error}</span>
            </div>
          )}

          <button
            type="submit"
            className="p-btn primary lg"
            style={{ marginTop: 14 }}
            disabled={submitting || !feasibility.feasible}
          >
            <Save size={16} />
            {submitting ? 'Executing Run...' : 'Execute Production Run'}
          </button>
        </form>
      </div>
    </div>
  );
}
