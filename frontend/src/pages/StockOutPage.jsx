import { useState, useEffect } from 'react';
import { productsAPI, warehousesAPI, transactionsAPI, stockAPI } from '../api';
import toast from 'react-hot-toast';
import { ArrowUpCircle, Save, Info, Camera, MapPin, CheckCircle, X, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import QRScannerModal from '../components/QRScannerModal';
import useFormSettings from '../hooks/useFormSettings';
import SearchableSelect from '../components/SearchableSelect';

export default function StockOutPage() {
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [sections, setSections] = useState([]);
  const [availableQty, setAvailableQty] = useState(null);
  
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

  // QR Scanner state
  const [showScanner, setShowScanner] = useState(false);
  const [scannedLocation, setScannedLocation] = useState(null);

  // Dynamic form settings
  const { fields, isVisible, isRequired, getLabel, loading: settingsLoading } = useFormSettings('STOCK_OUT');

  useEffect(() => {
    productsAPI.list()
      .then(r => setProducts(r.data.data))
      .catch(() => toast.error('Failed to load products'));
    
    warehousesAPI.list()
      .then(r => setWarehouses(r.data.data))
      .catch(() => toast.error('Failed to load warehouses'));
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

  // Query live available stock
  useEffect(() => {
    if (productId && warehouseId) {
      stockAPI.balance({ product_id: productId, warehouse_id: warehouseId })
        .then(r => {
          const bal = r.data.data.find(b =>
            (!sectionId && !b.section_id) || (sectionId && b.section_id === sectionId)
          );
          setAvailableQty(bal ? bal.quantity : 0);
        })
        .catch(() => setAvailableQty(0));
    } else {
      setAvailableQty(null);
    }
  }, [productId, warehouseId, sectionId]);

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
    if (availableQty !== null && parseFloat(quantity) > availableQty) {
      return toast.error(`Insufficient stock. Only ${availableQty} ${unit} available at this location.`);
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
      
      const r = await transactionsAPI.stockOut(payload);
      toast.success(r.data.message || 'Stock OUT recorded successfully!');
      setProductId('');
      setSectionId('');
      setQuantity('');
      setReferenceDoc('');
      setRemarks('');
      setAvailableQty(null);
      setCustomFieldsData({});
      setScannedLocation(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record stock OUT');
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

  return (
    <div className="fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Stock OUT</h2>
          <p>Disburse finished goods or raw materials from a warehouse location</p>
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
            <ArrowUpCircle size={18} className="text-danger" />
            <span>Digital Good Issue Entry</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-body" style={{ padding: 0 }}>

          {/* ── QR Scan Section ─────────────────────────────────────────── */}
          <div style={{
            marginBottom: 20, padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.18)'
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-danger)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
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
              <button
                type="button" className="scan-btn" onClick={() => setShowScanner(true)}
                style={{ background: 'linear-gradient(135deg, #dc2626, #7c3aed)' }}
              >
                <Camera size={16} />
                Scan Section QR Code
              </button>
            )}
          </div>

          {/* ── Dynamic Fields ──────────────────────────────────────────── */}

          {/* Row: Product + Transaction Date */}
          <div className="form-row">
            {isVisible('product_id') && (
              <div className="form-group">
                <label className="form-label">
                  {getLabel('product_id', 'Product')}
                  {isRequired('product_id') && <span> *</span>}
                </label>
                <SearchableSelect
                  options={products.map(p => ({ value: p.id, label: `[${p.code}] ${p.name} (${p.type})` }))}
                  value={productId}
                  onChange={val => setProductId(val)}
                  placeholder="Select Product..."
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
                  type="date" className="form-control"
                  value={transactionDate}
                  onChange={e => setTransactionDate(e.target.value)}
                  required={isRequired('transaction_date')}
                />
              </div>
            )}
          </div>

          {/* Row: Warehouse + Section */}
          <div className="form-row">
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
          </div>

          {/* Stock availability indicator */}
          {availableQty !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              background: availableQty > 0 ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              color: availableQty > 0 ? 'var(--color-success)' : 'var(--color-danger)',
              fontSize: 13, fontWeight: 500, marginBottom: 16
            }}>
              <Info size={16} />
              <span>Available stock at this location: <strong>{availableQty} {unit}</strong></span>
            </div>
          )}

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
                  {getLabel('reference_doc', 'Reference Doc / Dispatch #')}
                  {isRequired('reference_doc') && <span> *</span>}
                </label>
                <input
                  type="text" placeholder="Delivery Challan No."
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
                placeholder="Add details, sales order number, customer dispatch info etc."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                required={isRequired('remarks')}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={submitting || (availableQty !== null && availableQty <= 0)}
              style={{ background: 'var(--gradient-danger)', color: 'white', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)' }}
            >
              <Save size={16} />
              {submitting ? 'Recording...' : 'Submit Good Issue / Stock OUT'}
            </button>
          </div>
        </form>
      </div>

      {showScanner && (
        <QRScannerModal onScanned={handleQrScanned} onClose={() => setShowScanner(false)} />
      )}
    </div>
  );
}
