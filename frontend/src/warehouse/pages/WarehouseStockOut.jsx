import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { productsAPI, warehousesAPI, transactionsAPI } from '../../api';
import toast from 'react-hot-toast';
import { ArrowUpCircle, Save, Warehouse } from 'lucide-react';
import SearchableSelect from '../../components/SearchableSelect';

export default function WarehouseStockOut() {
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

      const res = await transactionsAPI.stockOut(payload);
      toast.success(res.data.message || 'Stock OUT recorded successfully!');
      navigate('/warehouse');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record stock OUT');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedWh = warehouses.find(w => String(w.id) === String(warehouseId));

  return (
    <div className="w-page w-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <ArrowUpCircle size={22} color="var(--w-danger)" />
        <h3 style={{ fontSize: 16, fontWeight: 800 }}>Record Stock OUT</h3>
      </div>

      {!warehouseId ? (
        <div>
          <div className="w-explore-title" style={{ marginTop: 0, marginBottom: 12 }}>
            🏢 Select Warehouse facility to record stock issues (Stock OUT)
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
              <label className="w-label">Select Product *</label>
              <SearchableSelect
                options={products.map(p => ({ value: p.id, label: `[${p.code}] ${p.name}` }))}
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
                placeholder="Optional Ref Doc"
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
                placeholder="Optional remarks"
              />
            </div>

            <button
              type="submit"
              className="w-btn primary lg"
              style={{ marginTop: 14 }}
              disabled={submitting}
            >
              <Save size={16} />
              {submitting ? 'Recording Outward...' : 'Submit Stock OUT'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
