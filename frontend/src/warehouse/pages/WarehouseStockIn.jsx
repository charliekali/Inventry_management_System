import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { productsAPI, warehousesAPI, transactionsAPI, productCategoriesAPI } from '../../api';
import toast from 'react-hot-toast';
import { ArrowDownCircle, Save, Warehouse } from 'lucide-react';
import SearchableSelect from '../../components/SearchableSelect';

const getTypeLabel = (type) => {
  switch (type) {
    case 'FINISHED_GOOD': return 'FG';
    case 'RAW_MATERIAL': return 'RM';
    case 'BLEND': return 'BLEND';
    case 'TOOL': return 'TOOL';
    default: return type;
  }
};

export default function WarehouseStockIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [sections, setSections] = useState([]);

  const [productId, setProductId] = useState(location.state?.productId || '');
  const [warehouseId, setWarehouseId] = useState(location.state?.warehouseId || '');
  const [sectionId, setSectionId] = useState(location.state?.sectionId || '');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [referenceDoc, setReferenceDoc] = useState('');
  const [remarks, setRemarks] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [stockType, setStockType] = useState('ALL');

  // Quick Add Product states
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickCode, setQuickCode] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickType, setQuickType] = useState('FINISHED_GOOD');
  const [quickUnit, setQuickUnit] = useState('PCS');
  const [quickMinStock, setQuickMinStock] = useState('0');
  const [quickCategory, setQuickCategory] = useState('');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    productsAPI.list()
      .then(res => setProducts(res.data.data || []))
      .catch(() => toast.error('Failed to load products'));

    warehousesAPI.list()
      .then(res => setWarehouses(res.data.data || []))
      .catch(() => toast.error('Failed to load warehouses'));

    productCategoriesAPI.list()
      .then(res => setCategories(res.data.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (warehouseId) {
      warehousesAPI.sections(warehouseId)
        .then(res => setSections(res.data.data || []))
        .catch(() => toast.error('Failed to load sections'));
    } else {
      setSections([]);
    }
  }, [warehouseId]);

  useEffect(() => {
    if (productId) {
      const p = products.find(prod => prod.id === productId);
      if (p) setUnit(p.unit || 'PCS');
    } else {
      setUnit('');
    }
  }, [productId, products]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productId || !warehouseId || !quantity) {
      return toast.error('Product, warehouse, and quantity are required');
    }
    if (parseFloat(quantity) <= 0) {
      return toast.error('Quantity must be greater than zero');
    }

    setSubmitting(true);
    try {
      const payload = {
        product_id: productId,
        warehouse_id: warehouseId,
        section_id: sectionId || null,
        quantity: parseFloat(quantity),
        unit,
        reference_doc: referenceDoc,
        remarks,
        transaction_date: transactionDate
      };

      const res = await transactionsAPI.stockIn(payload);
      toast.success(res.data.message || 'Stock IN recorded successfully!');
      navigate('/warehouse');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record stock IN');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();
    if (!quickCode.trim() || !quickName.trim()) {
      return toast.error('Product Code and Name are required');
    }
    setQuickSubmitting(true);
    try {
      const payload = {
        code: quickCode.toUpperCase().trim(),
        name: quickName.trim(),
        type: quickType,
        unit: quickUnit,
        min_stock: parseFloat(quickMinStock) || 0,
        description: quickDesc,
        category: quickCategory
      };
      const res = await productsAPI.create(payload);
      const newProd = res.data.data;
      setProducts(prev => [...prev, newProd]);
      setProductId(newProd.id);
      toast.success('Product created and selected successfully!');
      setShowQuickAddModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create product');
    } finally {
      setQuickSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => stockType === 'ALL' || p.type === stockType);
  const selectedWh = warehouses.find(w => String(w.id) === String(warehouseId));

  return (
    <div className="w-page w-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <ArrowDownCircle size={22} color="var(--w-success)" />
        <h3 style={{ fontSize: 16, fontWeight: 800 }}>Record Stock IN (GR Receipt)</h3>
      </div>

      {!warehouseId ? (
        <div>
          <div className="w-explore-title" style={{ marginTop: 0, marginBottom: 12 }}>
            🏢 Select Warehouse facility to record inward stock
          </div>
          <div className="w-grid">
            {warehouses.map(wh => (
              <button
                key={wh.id}
                className="w-grid-btn"
                onClick={() => {
                  setWarehouseId(wh.id);
                  setSectionId('');
                }}
                style={{ padding: '18px 12px' }}
              >
                <Warehouse size={22} />
                <div style={{ marginTop: 4 }}>{wh.name}</div>
                <small>{wh.location || 'No location'}</small>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="w-card w-card-padded">
          {/* Warehouse Header Banner */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            background: 'var(--w-surface)',
            border: '1px solid var(--w-border)',
            borderRadius: 'var(--w-radius-sm)',
            marginBottom: 16
          }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--w-text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Warehouse facility
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--w-text)', marginTop: 2 }}>
                {selectedWh?.name || 'Loading...'}
              </div>
            </div>
            <button
              type="button"
              className="w-btn ghost sm"
              onClick={() => {
                setWarehouseId('');
                setSectionId('');
              }}
              style={{ padding: '5px 10px', fontSize: 11 }}
            >
              Change
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="w-form-group">
              <label className="w-label">Stock Type</label>
              <select 
                className="w-input" 
                value={stockType} 
                onChange={e => { setStockType(e.target.value); setProductId(''); }}
                style={{ background: 'var(--w-surface)', color: 'var(--w-text)', border: '1px solid var(--w-border)' }}
              >
                <option value="ALL">All Stock Types</option>
                <option value="FINISHED_GOOD">Finished Goods (FG)</option>
                <option value="RAW_MATERIAL">Raw Materials (RM)</option>
                <option value="BLEND">Spices Blends</option>
                <option value="TOOL">Tools & Equipment</option>
              </select>
            </div>

            <div className="w-form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="w-label" style={{ marginBottom: 0 }}>Select Product *</label>
                <button 
                  type="button" 
                  className="w-btn ghost sm" 
                  onClick={() => {
                    setQuickCode('');
                    setQuickName('');
                    setQuickType(stockType === 'ALL' ? 'FINISHED_GOOD' : stockType);
                    setQuickUnit('PCS');
                    setQuickMinStock('0');
                    setQuickCategory('');
                    setQuickDesc('');
                    setShowQuickAddModal(true);
                  }}
                  style={{ padding: '3px 8px', fontSize: 10.5, borderRadius: 'var(--w-radius-sm)', border: '1px dashed var(--w-border)' }}
                >
                  + Quick Add Product
                </button>
              </div>
              <SearchableSelect
                options={filteredProducts.map(p => ({ value: p.id, label: `[${p.code}] ${p.name} (${getTypeLabel(p.type)})` }))}
                value={productId}
                onChange={val => setProductId(val)}
                placeholder="Choose product..."
              />
            </div>

            <div className="w-form-group">
              <label className="w-label">Select Shelf Section</label>
              <SearchableSelect
                options={sections.map(s => ({ value: s.id, label: s.name }))}
                value={sectionId}
                onChange={val => setSectionId(val)}
                placeholder="Open Area (No shelf)"
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div className="w-form-group" style={{ flex: 1.5 }}>
                <label className="w-label">Quantity *</label>
                <input
                  type="number" step="any" min="0.0001"
                  className="w-input"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="w-form-group" style={{ flex: 1 }}>
                <label className="w-label">Unit</label>
                <input
                  type="text"
                  className="w-input"
                  value={unit}
                  readOnly
                  placeholder="Unit"
                />
              </div>
            </div>

            <div className="w-form-group">
              <label className="w-label">Reference Document #</label>
              <input
                type="text"
                className="w-input"
                value={referenceDoc}
                onChange={e => setReferenceDoc(e.target.value)}
                placeholder="e.g. GR Slip / Supplier Invoice"
              />
            </div>

            <div className="w-form-group">
              <label className="w-label">Transaction Date</label>
              <input
                type="date"
                className="w-input"
                value={transactionDate}
                onChange={e => setTransactionDate(e.target.value)}
              />
            </div>

            <div className="w-form-group">
              <label className="w-label">Remarks</label>
              <input
                type="text"
                className="w-input"
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="e.g. Supplier delivery"
              />
            </div>

            <button
              type="submit"
              className="w-btn primary lg"
              style={{ marginTop: 14 }}
              disabled={submitting}
            >
              <Save size={16} />
              {submitting ? 'Recording Inward...' : 'Submit Stock IN'}
            </button>
          </form>
        </div>
      )}

      {/* Quick Add Product Modal for Mobile */}
      {showQuickAddModal && (
        <div className="w-modal-overlay" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16
        }} onClick={() => setShowQuickAddModal(false)}>
          <form 
            className="w-card w-card-padded" 
            onSubmit={handleQuickAddSubmit} 
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', maxHeight: '90vh' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--w-border)', paddingBottom: 10 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800 }}>Quick Add Product</h3>
              <button type="button" onClick={() => setShowQuickAddModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--w-text-3)', cursor: 'pointer' }}>×</button>
            </div>
            
            <div className="w-form-group">
              <label className="w-label">Product Code *</label>
              <input 
                type="text" 
                className="w-input" 
                value={quickCode} 
                onChange={e => setQuickCode(e.target.value.toUpperCase())} 
                placeholder="e.g. RM-PEPPER"
                required 
              />
            </div>

            <div className="w-form-group">
              <label className="w-label">Product Name *</label>
              <input 
                type="text" 
                className="w-input" 
                value={quickName} 
                onChange={e => setQuickName(e.target.value)} 
                placeholder="e.g. Black Pepper Whole"
                required 
              />
            </div>

            <div className="w-form-group">
              <label className="w-label">Type</label>
              <select 
                className="w-input" 
                value={quickType} 
                onChange={e => setQuickType(e.target.value)}
                style={{ background: 'var(--w-surface)', color: 'var(--w-text)', border: '1px solid var(--w-border)' }}
              >
                <option value="FINISHED_GOOD">Finished Good (FG)</option>
                <option value="RAW_MATERIAL">Raw Material (RM)</option>
                <option value="BLEND">Blend</option>
                <option value="TOOL">Tools</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div className="w-form-group" style={{ flex: 1.2 }}>
                <label className="w-label">Unit of Measure</label>
                <input 
                  type="text" 
                  className="w-input" 
                  value={quickUnit} 
                  onChange={e => setQuickUnit(e.target.value)} 
                  placeholder="PCS"
                  required 
                />
              </div>
              <div className="w-form-group" style={{ flex: 1 }}>
                <label className="w-label">Min Stock</label>
                <input 
                  type="number" 
                  step="any"
                  className="w-input" 
                  value={quickMinStock} 
                  onChange={e => setQuickMinStock(e.target.value)} 
                  placeholder="0"
                  required 
                />
              </div>
            </div>

            <div className="w-form-group">
              <label className="w-label">Category</label>
              <select 
                className="w-input" 
                value={quickCategory} 
                onChange={e => setQuickCategory(e.target.value)}
                style={{ background: 'var(--w-surface)', color: 'var(--w-text)', border: '1px solid var(--w-border)' }}
              >
                <option value="">Select Category...</option>
                {categories.map(c => (
                  <optgroup key={c.category} label={c.category}>
                    {c.subcategories.map(sub => (
                      <option key={sub} value={`${c.category} - ${sub}`}>{c.category} - ${sub}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="w-form-group">
              <label className="w-label">Description</label>
              <input 
                type="text"
                className="w-input" 
                value={quickDesc} 
                onChange={e => setQuickDesc(e.target.value)} 
                placeholder="Description (optional)"
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
              <button type="button" className="w-btn ghost sm" style={{ flex: 1 }} onClick={() => setShowQuickAddModal(false)}>Cancel</button>
              <button type="submit" className="w-btn primary sm" style={{ flex: 1.5 }} disabled={quickSubmitting}>
                {quickSubmitting ? 'Creating...' : 'Create & Select'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
