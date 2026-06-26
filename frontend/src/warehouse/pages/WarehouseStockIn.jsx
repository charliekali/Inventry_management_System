import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { productsAPI, warehousesAPI, transactionsAPI } from '../../api';
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

  useEffect(() => {
    productsAPI.list()
      .then(res => setProducts(res.data.data || []))
      .catch(() => toast.error('Failed to load products'));

    warehousesAPI.list()
      .then(res => setWarehouses(res.data.data || []))
      .catch(() => toast.error('Failed to load warehouses'));
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
              <label className="w-label">Select Product *</label>
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
    </div>
  );
}
