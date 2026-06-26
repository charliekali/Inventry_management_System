import { useState, useEffect } from 'react';
import { productsAPI, warehousesAPI, transactionsAPI, productCategoriesAPI } from '../api';
import toast from 'react-hot-toast';
import { ArrowDownCircle, Save, Camera, MapPin, CheckCircle, X, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import QRScannerModal from '../components/QRScannerModal';
import useFormSettings from '../hooks/useFormSettings';
import SearchableSelect from '../components/SearchableSelect';

const getTypeLabel = (type) => {
  switch (type) {
    case 'FINISHED_GOOD': return 'FG';
    case 'RAW_MATERIAL': return 'RM';
    case 'BLEND': return 'BLEND';
    case 'TOOL': return 'TOOL';
    default: return type;
  }
};

export default function StockInPage() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [sections, setSections] = useState([]);
  
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [referenceDoc, setReferenceDoc] = useState('');
  const [remarks, setRemarks] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);
  const [customFieldsData, setCustomFieldsData] = useState({});
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

  // QR Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scannedLocation, setScannedLocation] = useState(null);

  // Dynamic form settings
  const { fields, isVisible, isRequired, getLabel, loading: settingsLoading } = useFormSettings('STOCK_IN');

  useEffect(() => {
    productsAPI.list()
      .then(r => setProducts(r.data.data))
      .catch(() => toast.error('Failed to load products'));
    
    warehousesAPI.list()
      .then(r => setWarehouses(r.data.data))
      .catch(() => toast.error('Failed to load warehouses'));

    productCategoriesAPI.list()
      .then(r => setCategories(r.data.data))
      .catch(() => {});
  }, []);

  // Fetch sections when warehouse changes
  useEffect(() => {
    if (warehouseId) {
      warehousesAPI.sections(warehouseId)
        .then(r => setSections(r.data.data))
        .catch(() => toast.error('Failed to load sections'));
      setSectionId('');
    } else {
      setSections([]);
      setSectionId('');
    }
  }, [warehouseId]);

  // Sync unit when product changes
  useEffect(() => {
    if (productId) {
      const p = products.find(prod => prod.id === productId);
      if (p) setUnit(p.unit || 'PCS');
    } else {
      setUnit('');
    }
  }, [productId, products]);

  // Handle QR scan result
  const handleQrScanned = (data) => {
    try {
      setWarehouseId(data.warehouse_id);
      setScannedLocation({ warehouse_name: data.warehouse_name, section_name: data.section_name });
      warehousesAPI.sections(data.warehouse_id)
        .then(r => {
          setSections(r.data.data);
          setSectionId(data.section_id);
        })
        .catch(() => toast.error('Failed to load sections for scanned warehouse'));
      toast.success(`📍 Location set: ${data.warehouse_name} › ${data.section_name}`);
    } catch {
      toast.error('Failed to apply scanned location');
    }
  };

  const clearScannedLocation = () => {
    setScannedLocation(null);
    setWarehouseId('');
    setSectionId('');
    setSections([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productId || !warehouseId || !quantity) {
      return toast.error('Product, Warehouse, and Quantity are required');
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
        transaction_date: transactionDate,
        custom_fields: customFieldsData
      };
      
      const r = await transactionsAPI.stockIn(payload);
      toast.success(r.data.message || 'Stock IN recorded successfully!');
      setProductId('');
      setSectionId('');
      setQuantity('');
      setReferenceDoc('');
      setRemarks('');
      setCustomFieldsData({});
      setScannedLocation(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record stock IN');
    } finally {
      setSubmitting(false);
    }
  };

  if (settingsLoading) {
    return (
      <div className="loading-center" style={{ height: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

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

  return (
    <div className="fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Stock IN</h2>
          <p>Record inward finished goods or raw materials to a warehouse location</p>
        </div>
        <div className="page-header-right">
          <Link to="/form-settings" className="btn btn-secondary btn-sm" title="Configure form fields">
            <SlidersHorizontal size={14} />
            Form Settings
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowDownCircle size={18} className="text-success" />
            <span>Digital Good Receipt (GR) Entry</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ padding: 0 }}>

          {/* ── QR Scan Section ─────────────────────────────────────────── */}
          <div style={{
            marginBottom: 20, padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(59, 130, 246, 0.06)',
            border: '1px solid rgba(59, 130, 246, 0.18)'
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-light)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} />
              Location (Scan or Select Manually)
            </div>
            {scannedLocation ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div className="scan-location-banner" style={{ flex: 1 }}>
                  <CheckCircle size={16} />
                  <span>📍 {scannedLocation.warehouse_name} › {scannedLocation.section_name}</span>
                </div>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={clearScannedLocation}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" className="scan-btn" onClick={() => setShowScanner(true)}>
                <Camera size={16} />
                Scan Section QR Code
              </button>
            )}
          </div>

          {/* ── Dynamic Fields ──────────────────────────────────────────── */}

          {/* Row: Stock Type + Product */}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Stock Type</label>
              <select 
                className="form-control" 
                value={stockType} 
                onChange={e => { setStockType(e.target.value); setProductId(''); }}
              >
                <option value="ALL">All Stock Types</option>
                <option value="FINISHED_GOOD">Finished Goods (FG)</option>
                <option value="RAW_MATERIAL">Raw Materials (RM)</option>
                <option value="BLEND">Spices Blends</option>
                <option value="TOOL">Tools & Equipment</option>
              </select>
            </div>

            {isVisible('product_id') && (
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{getLabel('product_id', 'Product')}{isRequired('product_id') && <span> *</span>}</span>
                  <button 
                    type="button" 
                    className="btn btn-link btn-sm" 
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
                    style={{ padding: 0, fontSize: 11.5, height: 'auto', textDecoration: 'none' }}
                  >
                    + Quick Add Product
                  </button>
                </label>
                <SearchableSelect
                  options={filteredProducts.map(p => ({ value: p.id, label: `[${p.code}] ${p.name} (${getTypeLabel(p.type)})` }))}
                  value={productId}
                  onChange={val => setProductId(val)}
                  placeholder="Select Product..."
                />
              </div>
            )}
          </div>

          {/* Row: Warehouse + Section + Transaction Date */}
          <div className="form-row-3">
            {isVisible('warehouse_id') && (
              <div className="form-group">
                <label className="form-label">
                  {getLabel('warehouse_id', 'Warehouse')}
                  {isRequired('warehouse_id') && <span> *</span>}
                </label>
                <SearchableSelect
                  options={warehouses.map(w => ({ value: w.id, label: `${w.name} (${w.location})` }))}
                  value={warehouseId}
                  onChange={val => { setWarehouseId(val); setScannedLocation(null); }}
                  placeholder="Select Warehouse..."
                />
              </div>
            )}

            {isVisible('section_id') && (
              <div className="form-group">
                <label className="form-label">
                  {getLabel('section_id', 'Section')}
                  {isRequired('section_id') && <span> *</span>}
                </label>
                <SearchableSelect
                  options={sections.map(s => ({ value: s.id, label: s.name }))}
                  value={sectionId}
                  disabled={!warehouseId}
                  onChange={val => setSectionId(val)}
                  placeholder="Select Section..."
                />
              </div>
            )}

            {isVisible('transaction_date') && (
              <div className="form-group">
                <label className="form-label">
                  {getLabel('transaction_date', 'Transaction Date')}
                  {isRequired('transaction_date') && <span> *</span>}
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={transactionDate}
                  onChange={e => setTransactionDate(e.target.value)}
                  required={isRequired('transaction_date')}
                />
              </div>
            )}
          </div>

          {/* Row: Quantity + Unit + Reference Doc */}
          <div className="form-row-3">
            {isVisible('quantity') && (
              <div className="form-group">
                <label className="form-label">
                  {getLabel('quantity', 'Quantity')}
                  {isRequired('quantity') && <span> *</span>}
                </label>
                <input
                  type="number" step="any" min="0.0001" placeholder="0.00"
                  className="form-control"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  required={isRequired('quantity')}
                />
              </div>
            )}

            {isVisible('unit') && (
              <div className="form-group">
                <label className="form-label">
                  {getLabel('unit', 'Unit of Measure')}
                  {isRequired('unit') && <span> *</span>}
                </label>
                <input
                  type="text" className="form-control"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="e.g. PCS, KG"
                />
              </div>
            )}

            {isVisible('reference_doc') && (
              <div className="form-group">
                <label className="form-label">
                  {getLabel('reference_doc', 'Reference Doc / GR Slip #')}
                  {isRequired('reference_doc') && <span> *</span>}
                </label>
                <input
                  type="text" placeholder="Physical GR Slip No."
                  className="form-control"
                  value={referenceDoc}
                  onChange={e => setReferenceDoc(e.target.value)}
                  required={isRequired('reference_doc')}
                />
              </div>
            )}
          </div>

          {/* Custom Fields (Dynamic) */}
          {fields.filter(f => f.is_custom && isVisible(f.field_key)).length > 0 && (
            <div className="form-row">
              {fields.filter(f => f.is_custom && isVisible(f.field_key)).map(f => (
                <div key={f.field_key} className="form-group">
                  <label className="form-label">
                    {getLabel(f.field_key, f.label)}
                    {isRequired(f.field_key) && <span> *</span>}
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={`Enter ${getLabel(f.field_key, f.label).toLowerCase()}`}
                    value={customFieldsData[f.field_key] || ''}
                    onChange={e => setCustomFieldsData(prev => ({ ...prev, [f.field_key]: e.target.value }))}
                    required={isRequired(f.field_key)}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Remarks */}
          {isVisible('remarks') && (
            <div className="form-group">
              <label className="form-label">
                {getLabel('remarks', 'Remarks')}
                {isRequired('remarks') && <span> *</span>}
              </label>
              <textarea
                className="form-control"
                placeholder="Add details, batch numbers, supplier info etc."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                required={isRequired('remarks')}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <Save size={16} />
              {submitting ? 'Recording...' : 'Submit GR / Stock IN'}
            </button>
          </div>
        </form>
      </div>

      {showScanner && (
        <QRScannerModal onScanned={handleQrScanned} onClose={() => setShowScanner(false)} />
      )}

      {/* Quick Add Product Modal */}
      {showQuickAddModal && (
        <div className="modal-overlay" onClick={() => setShowQuickAddModal(false)}>
          <form 
            className="modal" 
            onSubmit={handleQuickAddSubmit} 
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 500 }}
          >
            <div className="modal-header">
              <h3 className="modal-title">Quick Add Product</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowQuickAddModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Product Code *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={quickCode} 
                  onChange={e => setQuickCode(e.target.value.toUpperCase())} 
                  placeholder="e.g. RM-PEPPER"
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={quickName} 
                  onChange={e => setQuickName(e.target.value)} 
                  placeholder="e.g. Black Pepper Whole"
                  required 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select 
                    className="form-control" 
                    value={quickType} 
                    onChange={e => setQuickType(e.target.value)}
                  >
                    <option value="FINISHED_GOOD">Finished Good (FG)</option>
                    <option value="RAW_MATERIAL">Raw Material (RM)</option>
                    <option value="BLEND">Blend</option>
                    <option value="TOOL">Tools</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Unit of Measure</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={quickUnit} 
                    onChange={e => setQuickUnit(e.target.value)} 
                    placeholder="PCS"
                    required 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Min Stock Level</label>
                  <input 
                    type="number" 
                    step="any"
                    className="form-control" 
                    value={quickMinStock} 
                    onChange={e => setQuickMinStock(e.target.value)} 
                    placeholder="0"
                    required 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select 
                    className="form-control" 
                    value={quickCategory} 
                    onChange={e => setQuickCategory(e.target.value)}
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
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-control" 
                  value={quickDesc} 
                  onChange={e => setQuickDesc(e.target.value)} 
                  placeholder="Enter product description (optional)"
                  style={{ minHeight: 60 }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowQuickAddModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={quickSubmitting}>
                {quickSubmitting ? 'Creating...' : 'Create & Select Product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
