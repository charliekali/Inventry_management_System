import { useState, useEffect } from 'react';
import { productsAPI, warehousesAPI, transactionsAPI } from '../api';
import toast from 'react-hot-toast';
import { ArrowDownCircle, Save, Camera, MapPin, CheckCircle, X, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import QRScannerModal from '../components/QRScannerModal';
import useFormSettings from '../hooks/useFormSettings';
import SearchableSelect from '../components/SearchableSelect';

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
                  type="date"
                  className="form-control"
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
    </div>
  );
}
