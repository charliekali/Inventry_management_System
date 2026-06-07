import { useState, useEffect } from 'react';
import { ordersAPI, productsAPI } from '../api';
import toast from 'react-hot-toast';
import { BookOpen, Plus, Trash2, Eye, ShieldCheck, Clipboard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useFormSettings from '../hooks/useFormSettings';

export default function OrderPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Detail Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Creation Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customer, setCustomer] = useState('');
  const [remarks, setRemarks] = useState('');
  const [itemsList, setItemsList] = useState([]); // Array of { product_id, qty_required, unit }
  
  // Dynamic Item select inputs
  const [currentRmId, setCurrentRmId] = useState('');
  const [currentQty, setCurrentQty] = useState('');
  const [currentUnitType, setCurrentUnitType] = useState('pcs'); // Bags, Innerbags, pcs, others
  const [customUnit, setCustomUnit] = useState('');
  const [customFieldsData, setCustomFieldsData] = useState({});

  // Dynamic form settings
  const { fields, isVisible, isRequired, getLabel, loading: settingsLoading, invalidate: invalidateSettings } = useFormSettings('ORDER');

  const getFieldLabel = (key) => {
    return getLabel(key, key.replace('custom_', '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
  };

  const loadOrders = () => {
    setLoading(true);
    ordersAPI.list()
      .then(r => setOrders(r.data.data))
      .catch(() => toast.error('Failed to load orders list'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrders();
    productsAPI.list()
      .then(r => setProducts(r.data.data))
      .catch(() => {});
  }, []);

  const handleOpenCreateModal = () => {
    invalidateSettings();
    setCustomer('');
    setRemarks('');
    setCustomFieldsData({});
    setItemsList([]);
    setShowCreateModal(true);
  };

  const handleViewDetails = (order) => {
    setSelectedOrder(order);
    setDetailLoading(true);
    ordersAPI.get(order.id)
      .then(r => setOrderItems(r.data.data.items))
      .catch(() => toast.error('Failed to load order details'))
      .finally(() => setDetailLoading(false));
  };

  const handleProductChange = (productId) => {
    setCurrentRmId(productId);
    if (!productId) {
      setCurrentUnitType('pcs');
      setCustomUnit('');
      return;
    }
    const prod = products.find(p => p.id === productId);
    if (prod) {
      const u = prod.unit || 'pcs';
      const standardUnits = ['Bags', 'Innerbags', 'pcs'];
      const found = standardUnits.find(su => su.toLowerCase() === u.toLowerCase());
      if (found) {
        setCurrentUnitType(found);
        setCustomUnit('');
      } else {
        setCurrentUnitType('others');
        setCustomUnit(u);
      }
    }
  };

  const handleAddItem = () => {
    if (!currentRmId || !currentQty) return toast.error('Select product and enter quantity');
    if (parseFloat(currentQty) <= 0) return toast.error('Quantity must be positive');

    const unitToUse = currentUnitType === 'others' ? customUnit.trim() : currentUnitType;
    if (currentUnitType === 'others' && !unitToUse) {
      return toast.error('Please specify the custom unit');
    }

    // Check duplicate
    if (itemsList.some(item => item.product_id === currentRmId)) {
      return toast.error('Product already added to list');
    }

    const prod = products.find(p => p.id === currentRmId);
    setItemsList([...itemsList, {
      product_id: currentRmId,
      product_name: prod.name,
      product_code: prod.code,
      qty_required: parseFloat(currentQty),
      unit: unitToUse
    }]);

    setCurrentRmId('');
    setCurrentQty('');
    setCurrentUnitType('pcs');
    setCustomUnit('');
  };

  const handleRemoveItem = (index) => {
    const list = [...itemsList];
    list.splice(index, 1);
    setItemsList(list);
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();

    // Validate required fields based on form settings
    for (const f of fields) {
      if (f.visible !== false && (f.required === true || f.locked_required === true)) {
        const val = f.field_key === 'customer' ? customer : (f.field_key === 'remarks' ? remarks : customFieldsData[f.field_key]);
        if (!val || !val.trim()) {
          return toast.error(`${getLabel(f.field_key, f.label)} is required`);
        }
      }
    }

    if (itemsList.length === 0) return toast.error('Please add at least one item to the order');

    try {
      const payload = {
        customer,
        remarks,
        custom_fields: customFieldsData,
        items: itemsList.map(i => ({
          product_id: i.product_id,
          qty_required: i.qty_required,
          unit: i.unit
        }))
      };

      await ordersAPI.create(payload);
      toast.success('Order placed successfully');
      setShowCreateModal(false);
      setCustomer('');
      setRemarks('');
      setCustomFieldsData({});
      setItemsList([]);
      loadOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    }
  };

  const handleUpdateStatus = async (orderId, status) => {
    try {
      await ordersAPI.updateStatus(orderId, status);
      toast.success('Status updated');
      setSelectedOrder(prev => prev ? { ...prev, status } : null);
      loadOrders();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING': return 'badge-gray';
      case 'FEASIBLE': return 'badge-green';
      case 'PARTIAL': return 'badge-orange';
      case 'INSUFFICIENT': return 'badge-red';
      case 'FULFILLED': return 'badge-blue';
      default: return 'badge-gray';
    }
  };

  if (loading || settingsLoading) {
    return <div className="loading-center"><div className="loading-spinner"></div></div>;
  }

  // Pre-calculate rows of 2 for form fields rendering
  const visibleFields = fields.filter(f => isVisible(f.field_key));
  const fieldRows = [];
  for (let i = 0; i < visibleFields.length; i += 2) {
    fieldRows.push(visibleFields.slice(i, i + 2));
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Sales Orders</h2>
          <p>Create customer orders and track stock feasibility calculations</p>
        </div>
        <div className="page-header-right" style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/feasibility')}>
            <ShieldCheck size={16} />
            Quick Feasibility Check
          </button>
          <button className="btn btn-primary" onClick={handleOpenCreateModal}>
            <Plus size={16} />
            Create Order
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="loading-spinner"></div></div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <BookOpen size={48} />
            <h3>No Orders Placed</h3>
            <p>Click "Create Order" to request items.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Order Number</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Total Items</th>
                  <th>Date Placed</th>
                  <th>Remarks</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{o.order_number}</td>
                    <td style={{ fontWeight: 600 }}>{o.customer}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(o.status)}`}>
                        {o.status}
                      </span>
                    </td>
                    <td>{o.item_count} items</td>
                    <td>{o.created_at ? o.created_at.split('T')[0] : 'N/A'}</td>
                    <td>{o.remarks || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleViewDetails(o)}>
                        <Eye size={13} style={{ marginRight: 4 }} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Details Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Sales Order Details: {selectedOrder.order_number}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOrder(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="responsive-grid-4">
                <div>
                  <span className="form-label" style={{ fontSize: 10 }}>Customer</span>
                  <div style={{ fontWeight: 600, fontSize: 15, marginTop: 4 }}>{selectedOrder.customer}</div>
                </div>
                <div>
                  <span className="form-label" style={{ fontSize: 10 }}>Date Placed</span>
                  <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>{selectedOrder.created_at ? selectedOrder.created_at.split('T')[0] : 'N/A'}</div>
                </div>
                <div>
                  <span className="form-label" style={{ fontSize: 10 }}>Order Feasibility Status</span>
                  <div style={{ marginTop: 4 }}>
                    <span className={`badge ${getStatusBadge(selectedOrder.status)}`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="form-label" style={{ fontSize: 10 }}>Recorded By</span>
                  <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>{selectedOrder.created_by_name}</div>
                </div>
                {selectedOrder.custom_fields && Object.entries(selectedOrder.custom_fields).map(([key, val]) => (
                  <div key={key}>
                    <span className="form-label" style={{ fontSize: 10 }}>{getFieldLabel(key)}</span>
                    <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>{val || '-'}</div>
                  </div>
                ))}
              </div>

              <div className="divider" style={{ margin: '16px 0' }}></div>

              <div className="form-group">
                <span className="form-label" style={{ fontSize: 10 }}>Internal Notes / Remarks</span>
                <p style={{ fontStyle: 'italic', fontSize: 13.5, background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 'var(--radius-sm)' }}>
                  {selectedOrder.remarks || 'No remarks recorded.'}
                </p>
              </div>

              <div style={{ marginTop: 8 }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>Items List</h4>
                {detailLoading ? (
                  <div className="loading-center"><div className="loading-spinner"></div></div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Product Name</th>
                          <th>Type</th>
                          <th>Quantity Requested</th>
                          <th>Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems.map(item => (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 700 }}>{item.product_code}</td>
                            <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                            <td>
                              <span className={`badge ${item.product_type === 'FINISHED_GOOD' ? 'badge-blue' : 'badge-purple'}`}>
                                {item.product_type}
                              </span>
                            </td>
                            <td style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary-light)' }}>
                              {item.qty_required}
                            </td>
                            <td>{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {selectedOrder.status !== 'FULFILLED' && (
                  <>
                    <button className="btn btn-success btn-sm" onClick={() => handleUpdateStatus(selectedOrder.id, 'FULFILLED')}>
                      Mark FULFILLED
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                      // Redirect to feasibility checker with these items
                      setShowCreateModal(false);
                      setSelectedOrder(null);
                      navigate('/feasibility', { state: { checkItems: orderItems } });
                    }}>
                      <ShieldCheck size={13} style={{ marginRight: 2 }} />
                      Run BOM Feasibility Audit
                    </button>
                  </>
                )}
              </div>
              <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <form className="modal modal-lg" onSubmit={handleCreateOrder} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Place Customer Order</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              {fieldRows.map((rowFields, rIdx) => (
                <div className="form-row" key={rIdx} style={{ marginBottom: 16 }}>
                  {rowFields.map(f => (
                    <div className="form-group" key={f.field_key} style={{ margin: 0 }}>
                      <label className="form-label">
                        {getLabel(f.field_key, f.label)}
                        {isRequired(f.field_key) && <span style={{ color: 'var(--color-danger)' }}> *</span>}
                      </label>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={f.field_key === 'customer' ? customer : (f.field_key === 'remarks' ? remarks : (customFieldsData[f.field_key] || ''))} 
                        onChange={(e) => {
                          const val = e.target.value;
                          if (f.field_key === 'customer') setCustomer(val);
                          else if (f.field_key === 'remarks') setRemarks(val);
                          else setCustomFieldsData(prev => ({ ...prev, [f.field_key]: val }));
                        }} 
                        placeholder={
                          f.field_key === 'customer' ? "e.g. Acme Corp, John Doe" :
                          f.field_key === 'remarks' ? "e.g. Rush delivery, special shipping requirements" :
                          `Enter ${getLabel(f.field_key, f.label).toLowerCase()}...`
                        }
                        required={isRequired(f.field_key)} 
                      />
                    </div>
                  ))}
                </div>
              ))}

              <div className="divider"></div>

              {/* Items input panel */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Add Products to Order</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Product</label>
                    <select className="form-control" value={currentRmId} onChange={(e) => handleProductChange(e.target.value)}>
                      <option value="">Select product...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>[{p.code}] {p.name} ({p.type})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Qty Needed</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="0.00" 
                      className="form-control" 
                      value={currentQty} 
                      onChange={(e) => setCurrentQty(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Unit Type</label>
                    <select className="form-control" value={currentUnitType} onChange={(e) => setCurrentUnitType(e.target.value)}>
                      <option value="Bags">Bags</option>
                      <option value="Innerbags">Innerbags</option>
                      <option value="pcs">pcs</option>
                      <option value="others">others</option>
                    </select>
                  </div>
                  {currentUnitType === 'others' && (
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Specify Unit</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Kg, Box" 
                        className="form-control" 
                        value={customUnit} 
                        onChange={(e) => setCustomUnit(e.target.value)}
                      />
                    </div>
                  )}
                  <button type="button" className="btn btn-secondary" onClick={handleAddItem} style={{ height: 42, width: '100%' }}>
                    Add Item
                  </button>
                </div>
              </div>

              {/* Added Items List Table */}
              <div style={{ marginTop: 12 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Order Items ({itemsList.length})</h4>
                {itemsList.length === 0 ? (
                  <p style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: 20 }}>
                    No products added to the order yet.
                  </p>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Product Name</th>
                          <th>Qty Required</th>
                          <th>Unit</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsList.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 700 }}>{item.product_code}</td>
                            <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                            <td style={{ fontWeight: 700, fontSize: 14 }}>{item.qty_required}</td>
                            <td>{item.unit}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button type="button" className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => handleRemoveItem(idx)}>
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={itemsList.length === 0}>
                Place Sales Order
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
