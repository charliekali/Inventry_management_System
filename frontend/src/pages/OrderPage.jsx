import { useState, useEffect, useRef } from 'react';
import { ordersAPI, productsAPI, productionOrdersAPI } from '../api';
import toast from 'react-hot-toast';
import { BookOpen, Plus, Trash2, Eye, ShieldCheck, Clipboard, Factory, Upload, Download, FileText, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useFormSettings from '../hooks/useFormSettings';
import { useAuth } from '../context/AuthContext';

export default function OrderPage() {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const [activeTab, setActiveTab] = useState('sales');
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Production Orders state
  const [productionOrders, setProductionOrders] = useState([]);
  const [loadingPo, setLoadingPo] = useState(false);
  const [showCreatePoModal, setShowCreatePoModal] = useState(false);
  const [poRemarks, setPoRemarks] = useState('');
  const [submittingPo, setSubmittingPo] = useState(false);
  // Multi-item PO form
  const [poItems, setPoItems] = useState([]); // [{product_id, product_name, product_code, quantity, unit}]
  const [poCurrentProductId, setPoCurrentProductId] = useState('');
  const [poCurrentQty, setPoCurrentQty] = useState('');
  // Expanded PO row
  const [expandedPoId, setExpandedPoId] = useState(null);

  // Import / Export state
  const importFileRef = useRef(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [importResult, setImportResult] = useState(null); // { imported, failed, errors }

  // Detail Modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Creation Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customer, setCustomer] = useState('');
  const [remarks, setRemarks] = useState('');
  const [itemsList, setItemsList] = useState([]); // Array of { product_id, qty_required, unit, unit_price, discount }
  
  // Dynamic Item select inputs
  const [currentRmId, setCurrentRmId] = useState('');
  const [currentQty, setCurrentQty] = useState('');
  const [currentUnitPrice, setCurrentUnitPrice] = useState('');
  const [currentDiscount, setCurrentDiscount] = useState('');
  const [currentUnitType, setCurrentUnitType] = useState('pcs'); // Bags, Innerbags, pcs, others
  const [customUnit, setCustomUnit] = useState('');
  const [customFieldsData, setCustomFieldsData] = useState({});
  const [taxPercent, setTaxPercent] = useState(18);

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

  const loadProductionOrders = () => {
    setLoadingPo(true);
    productionOrdersAPI.list()
      .then(r => setProductionOrders(r.data.data))
      .catch(() => toast.error('Failed to load production orders'))
      .finally(() => setLoadingPo(false));
  };

  useEffect(() => {
    loadOrders();
    loadProductionOrders();
    productsAPI.list()
      .then(r => setProducts(r.data.data))
      .catch(() => {});
  }, []);

  const handleCreateProductionOrder = async (e) => {
    e.preventDefault();
    if (poItems.length === 0) {
      return toast.error('Please add at least one product to the production order.');
    }

    setSubmittingPo(true);
    try {
      await productionOrdersAPI.create({
        items: poItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit: i.unit })),
        remarks: poRemarks
      });
      toast.success('Production order placed successfully');
      setShowCreatePoModal(false);
      setPoItems([]);
      setPoCurrentProductId('');
      setPoCurrentQty('');
      setPoRemarks('');
      loadProductionOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place production order');
    } finally {
      setSubmittingPo(false);
    }
  };

  const handleAddPoItem = () => {
    if (!poCurrentProductId || !poCurrentQty) return toast.error('Select a product and enter quantity');
    const qty = parseFloat(poCurrentQty);
    if (isNaN(qty) || qty <= 0) return toast.error('Quantity must be positive');
    if (poItems.some(i => i.product_id === poCurrentProductId)) return toast.error('Product already added');
    const prod = products.find(p => p.id === poCurrentProductId);
    setPoItems(prev => [...prev, {
      product_id: prod.id,
      product_name: prod.name,
      product_code: prod.code,
      quantity: qty,
      unit: prod.unit
    }]);
    setPoCurrentProductId('');
    setPoCurrentQty('');
  };

  const handleRemovePoItem = (idx) => {
    setPoItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCancelProductionOrder = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this production order?')) return;
    try {
      await productionOrdersAPI.updateStatus(id, 'CANCELLED');
      toast.success('Production order cancelled');
      loadProductionOrders();
    } catch (err) {
      toast.error('Failed to cancel production order');
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const res = await productionOrdersAPI.exportCsv();
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'production_orders_export.csv';
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded!');
    } catch {
      toast.error('Failed to export production orders');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleDownloadTemplate = () => {
    const header = 'production_order_number,product_code,product_name,quantity,unit,status,remarks\n';
    const example = ',FG-001,,100,pcs,,Batch for June production\n';
    const blob = new Blob([header + example], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'production_orders_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Template downloaded!');
  };

  const handleImportFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // reset input so same file can be re-imported
    e.target.value = '';
    setImportingCsv(true);
    try {
      const res = await productionOrdersAPI.importCsv(file);
      const { imported, failed, errors } = res.data;
      setImportResult({ imported, failed, errors });
      if (imported > 0) {
        toast.success(`Imported ${imported} production order(s)!`);
        loadProductionOrders();
      }
      if (failed > 0) toast.error(`${failed} row(s) failed — check import report.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed');
    } finally {
      setImportingCsv(false);
    }
  };

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
      setCurrentUnitPrice('');
      setCurrentDiscount('');
      return;
    }
    const prod = products.find(p => p.id === productId);
    if (prod) {
      setCurrentUnitPrice(prod.selling_price || 0.0);
      setCurrentDiscount(0.0);
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
      unit: unitToUse,
      unit_price: parseFloat(currentUnitPrice) || 0.0,
      discount: parseFloat(currentDiscount) || 0.0
    }]);

    setCurrentRmId('');
    setCurrentQty('');
    setCurrentUnitPrice('');
    setCurrentDiscount('');
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
        tax_percent: parseFloat(taxPercent) || 0.0,
        items: itemsList.map(i => ({
          product_id: i.product_id,
          qty_required: i.qty_required,
          unit: i.unit,
          unit_price: i.unit_price,
          discount: i.discount
        }))
      };

      await ordersAPI.create(payload);
      toast.success('Order placed successfully');
      setShowCreateModal(false);
      setCustomer('');
      setRemarks('');
      setCustomFieldsData({});
      setItemsList([]);
      setTaxPercent(18);
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
          <h2>{activeTab === 'sales' ? 'Sales Orders' : 'Production Orders'}</h2>
          <p>{activeTab === 'sales' ? 'Create customer orders and track stock feasibility calculations' : 'Place and track factory production orders'}</p>
        </div>
        <div className="page-header-right" style={{ display: 'flex', gap: 10 }}>
          {activeTab === 'sales' ? (
            <>
              <button className="btn btn-secondary" onClick={() => navigate('/feasibility')}>
                <ShieldCheck size={16} />
                Quick Feasibility Check
              </button>
              <button className="btn btn-primary" onClick={handleOpenCreateModal}>
                <Plus size={16} />
                Create Order
              </button>
            </>
          ) : (
            <>
              {/* Hidden CSV file input — Super Admin only */}
              {user?.role === 'Super Admin' && (
                <input
                  type="file"
                  accept=".csv"
                  ref={importFileRef}
                  style={{ display: 'none' }}
                  onChange={handleImportFileChange}
                />
              )}
              {user?.role === 'Super Admin' && (
                <button className="btn btn-secondary" onClick={handleDownloadTemplate} title="Download CSV template">
                  <FileText size={16} />
                  Template
                </button>
              )}
              {user?.role === 'Super Admin' && (
                <button className="btn btn-secondary" onClick={() => importFileRef.current?.click()} disabled={importingCsv}>
                  <Upload size={16} />
                  {importingCsv ? 'Importing...' : 'Import CSV'}
                </button>
              )}
              <button className="btn btn-secondary" onClick={handleExportCsv} disabled={exportingCsv}>
                <Download size={16} />
                {exportingCsv ? 'Exporting...' : 'Export CSV'}
              </button>
              {user?.role === 'Super Admin' && (
                <button className="btn btn-primary" onClick={() => { setPoItems([]); setPoRemarks(''); setShowCreatePoModal(true); }}>
                  <Plus size={16} />
                  Place Production Order
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-md)', padding: 4, width: 'fit-content', border: '1px solid var(--color-border)' }}>
        <button
          className={`btn btn-sm ${activeTab === 'sales' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('sales')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <BookOpen size={14} />
          Sales Orders
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'production' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('production')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Factory size={14} />
          Production Orders
        </button>
      </div>

      {/* Sales Orders List */}
      {activeTab === 'sales' && (
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
      )}

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
                  <>
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>Product Name</th>
                            <th>Type</th>
                            <th>Qty</th>
                            <th>Unit</th>
                            <th style={{ textAlign: 'right' }}>Rate</th>
                            <th style={{ textAlign: 'right' }}>Discount</th>
                            <th style={{ textAlign: 'right' }}>Line Total</th>
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
                              <td style={{ fontSize: 14, fontWeight: 700 }}>
                                {item.qty_required}
                              </td>
                              <td>{item.unit}</td>
                              <td style={{ textAlign: 'right' }}>₹{(item.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right', color: item.discount > 0 ? 'var(--color-danger)' : 'inherit' }}>
                                {item.discount > 0 ? `-₹${item.discount.toLocaleString('en-IN')}` : '—'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                ₹{(item.line_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 14 }}>
                      <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                        {selectedOrder.payment_mode && (
                          <div style={{ marginBottom: 4 }}>
                            Payment Mode: <strong style={{ color: 'var(--color-text-primary)' }}>{selectedOrder.payment_mode}</strong>
                          </div>
                        )}
                        {selectedOrder.paid_amount !== undefined && (
                          <div>
                            Paid Amount: <strong style={{ color: 'var(--color-text-primary)' }}>₹{selectedOrder.paid_amount.toLocaleString('en-IN')}</strong>
                          </div>
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '300px', fontSize: 13, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Subtotal:</span>
                          <span style={{ fontWeight: 600 }}>₹{(selectedOrder.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Tax ({selectedOrder.tax_percent || 0}%):</span>
                          <span style={{ fontWeight: 600 }}>₹{(selectedOrder.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--color-primary-light)', borderTop: '1px dashed var(--color-border)', paddingTop: 6 }}>
                          <span>Grand Total:</span>
                          <span>₹{(selectedOrder.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>

                    {selectedOrder.invoice_number && (
                      <div style={{ marginTop: 16, background: 'rgba(16,185,129,0.1)', padding: '12px 16px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <div>
                          <span style={{ fontSize: 10, textTransform: 'uppercase', color: '#10b981', fontWeight: 700, display: 'block' }}>Invoice Issued</span>
                          <strong style={{ fontSize: 15, color: '#10b981' }}>{selectedOrder.invoice_number}</strong>
                          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 10 }}>
                            Issued on: {selectedOrder.invoice_date ? new Date(selectedOrder.invoice_date).toLocaleDateString('en-IN') : 'N/A'}
                          </span>
                        </div>
                        <button type="button" onClick={() => { setSelectedOrder(null); navigate(`/invoice/${selectedOrder.id}`); }} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: '#10b981', borderColor: '#10b981' }}>
                          <Printer size={13} /> View / Print Invoice
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {selectedOrder.status !== 'FULFILLED' && (
                  <>
                    {hasPermission('ORDERS:FULFILL') && (
                      <button className="btn btn-success btn-sm" onClick={() => handleUpdateStatus(selectedOrder.id, 'FULFILLED')}>
                        Mark FULFILLED
                      </button>
                    )}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Product</label>
                    <select className="form-control" value={currentRmId} onChange={(e) => handleProductChange(e.target.value)}>
                      <option value="">Select product...</option>
                      {products.filter(p => p.type === 'FINISHED_GOOD').map(p => (
                        <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
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
                    <label className="form-label">Unit Price (₹)</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="0.00" 
                      className="form-control" 
                      value={currentUnitPrice} 
                      onChange={(e) => setCurrentUnitPrice(e.target.value)}
                      disabled={user?.role !== 'Super Admin'}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Discount (₹)</label>
                    <input 
                      type="number" 
                      step="any"
                      placeholder="0.00" 
                      className="form-control" 
                      value={currentDiscount} 
                      onChange={(e) => setCurrentDiscount(e.target.value)}
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
                  <>
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>Product Name</th>
                            <th>Qty Required</th>
                            <th>Unit</th>
                            <th style={{ textAlign: 'right' }}>Unit Price</th>
                            <th style={{ textAlign: 'right' }}>Discount</th>
                            <th style={{ textAlign: 'right' }}>Line Total</th>
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
                              <td style={{ textAlign: 'right' }}>₹{(item.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right' }}>₹{(item.discount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                ₹{(item.unit_price * item.qty_required - item.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
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

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 14 }}>
                      <div className="form-group" style={{ margin: 0, width: 140 }}>
                        <label className="form-label" style={{ fontSize: 11 }}>Tax Percentage (%)</label>
                        <input 
                          type="number" 
                          className="form-control" 
                          value={taxPercent} 
                          onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
                          placeholder="18"
                        />
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '280px', fontSize: 13, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Subtotal:</span>
                          <span style={{ fontWeight: 600 }}>
                            ₹{itemsList.reduce((sum, item) => sum + (item.unit_price * item.qty_required - item.discount), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-secondary)' }}>Tax ({taxPercent}%):</span>
                          <span style={{ fontWeight: 600 }}>
                            ₹{(Math.round((itemsList.reduce((sum, item) => sum + (item.unit_price * item.qty_required - item.discount), 0) * (taxPercent / 100)) * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--color-primary-light)', borderTop: '1px dashed var(--color-border)', paddingTop: 6 }}>
                          <span>Grand Total:</span>
                          <span>
                            ₹{(Math.round((itemsList.reduce((sum, item) => sum + (item.unit_price * item.qty_required - item.discount), 0) * (1 + taxPercent / 100)) * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
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

      {/* Production Orders List */}
      {activeTab === 'production' && (
        <div className="card">
          {loadingPo ? (
            <div className="loading-center"><div className="loading-spinner"></div></div>
          ) : productionOrders.length === 0 ? (
            <div className="empty-state">
              <Factory size={48} />
              <h3>No Production Orders</h3>
              <p>Click "Place Production Order" to schedule production runs.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 28 }}></th>
                    <th>PO Number</th>
                    <th>Items</th>
                    <th>Overall Status</th>
                    <th>Remarks</th>
                    <th>Date Placed</th>
                    <th>Placed By</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {productionOrders.map(po => (
                    <>
                      {/* PO header row */}
                      <tr key={po.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedPoId(prev => prev === po.id ? null : po.id)}>
                        <td style={{ textAlign: 'center', fontSize: 14 }}>
                          {expandedPoId === po.id ? '▼' : '▶'}
                        </td>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{po.production_order_number}</td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{po.item_count} product{po.item_count !== 1 ? 's' : ''}</span>
                          {po.items && po.items.length > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                              {po.items.slice(0, 2).map(i => i.product_code).join(', ')}{po.items.length > 2 ? ` +${po.items.length - 2} more` : ''}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${
                            po.status === 'PENDING'   ? 'badge-gray'   :
                            po.status === 'COMPLETED' ? 'badge-green'  :
                            po.status === 'PARTIAL'   ? 'badge-orange' : 'badge-red'
                          }`}>
                            {po.status}
                          </span>
                        </td>
                        <td>{po.remarks || '-'}</td>
                        <td>{po.created_at ? po.created_at.split('T')[0] : 'N/A'}</td>
                        <td>{po.created_by_name}</td>
                        <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          {user?.role === 'Super Admin' && (po.status === 'PENDING' || po.status === 'PARTIAL') && (
                            <button
                              className="btn btn-ghost btn-icon btn-sm text-danger"
                              title="Cancel Entire PO"
                              onClick={() => handleCancelProductionOrder(po.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                      {/* Expanded items sub-rows */}
                      {expandedPoId === po.id && po.items && po.items.map(item => (
                        <tr key={item.id} style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <td></td>
                          <td colSpan={2} style={{ paddingLeft: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 12, color: 'var(--color-text-muted)' }}>{item.product_code}</span>
                              <span style={{ fontWeight: 600 }}>{item.product_name}</span>
                              <span style={{ fontSize: 12, color: 'var(--color-primary-light)', fontWeight: 700 }}>{item.quantity} {item.unit}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${
                              item.status === 'PENDING'   ? 'badge-gray'   :
                              item.status === 'COMPLETED' ? 'badge-green'  : 'badge-red'
                            }`} style={{ fontSize: 10 }}>
                              {item.status}
                            </span>
                          </td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td style={{ textAlign: 'right' }}>
                            {item.status === 'PENDING' && (
                              <button
                                className="btn btn-success btn-sm"
                                style={{ fontSize: 12 }}
                                onClick={() => navigate('/production-run', {
                                  state: {
                                    product_id: item.product_id,
                                    quantity: item.quantity,
                                    production_order_id: po.id,
                                    production_order_item_id: item.id
                                  }
                                })}
                              >
                                <Factory size={12} style={{ marginRight: 4 }} />
                                Execute Run
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Production Order Modal — multi-item */}
      {showCreatePoModal && (
        <div className="modal-overlay" onClick={() => setShowCreatePoModal(false)}>
          <form className="modal modal-lg" onSubmit={handleCreateProductionOrder} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Place Production Order</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreatePoModal(false)}>×</button>
            </div>

            <div className="modal-body">
              {/* Add product row */}
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Add Products to Produce</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'end' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Finished Good Product</label>
                    <select
                      className="form-control"
                      value={poCurrentProductId}
                      onChange={e => setPoCurrentProductId(e.target.value)}
                    >
                      <option value="">Select product...</option>
                      {products.filter(p => p.type === 'FINISHED_GOOD').map(p => (
                        <option key={p.id} value={p.id}>[{p.code}] {p.name} ({p.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Target Qty</label>
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      placeholder="e.g. 100"
                      className="form-control"
                      value={poCurrentQty}
                      onChange={e => setPoCurrentQty(e.target.value)}
                      style={{ width: 120 }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleAddPoItem}
                    style={{ height: 42 }}
                  >
                    <Plus size={14} style={{ marginRight: 4 }} />
                    Add
                  </button>
                </div>
              </div>

              {/* Items list */}
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Items to Produce ({poItems.length})</h4>
                {poItems.length === 0 ? (
                  <p style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: 20, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
                    No products added yet. Use the panel above to add products.
                  </p>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Product Name</th>
                          <th>Target Qty</th>
                          <th>Unit</th>
                          <th style={{ textAlign: 'right' }}>Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poItems.map((item, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{item.product_code}</td>
                            <td style={{ fontWeight: 600 }}>{item.product_name}</td>
                            <td style={{ fontWeight: 700, color: 'var(--color-primary-light)' }}>{item.quantity}</td>
                            <td>{item.unit}</td>
                            <td style={{ textAlign: 'right' }}>
                              <button type="button" className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => handleRemovePoItem(idx)}>
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

              {/* Remarks */}
              <div className="form-group">
                <label className="form-label">Remarks / Production Instructions</label>
                <textarea
                  className="form-control"
                  placeholder="e.g. Blending batch #12 for June orders"
                  value={poRemarks}
                  onChange={e => setPoRemarks(e.target.value)}
                  style={{ minHeight: 70 }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreatePoModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submittingPo || poItems.length === 0}>
                {submittingPo ? 'Placing Order...' : `Place Production Order (${poItems.length} item${poItems.length !== 1 ? 's' : ''})`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Import Result Modal */}
      {importResult && (
        <div className="modal-overlay" onClick={() => setImportResult(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">CSV Import Report</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setImportResult(null)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-success, #22c55e)' }}>{importResult.imported}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Rows Imported</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-danger, #ef4444)' }}>{importResult.failed}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Rows Failed</div>
                </div>
              </div>
              {importResult.errors && importResult.errors.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--color-danger, #ef4444)' }}>Error Details</h4>
                  <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {importResult.errors.map((e, i) => (
                      <div key={i} style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 13 }}>
                        <strong>Row {e.row}:</strong> {e.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {importResult.failed === 0 && (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', fontStyle: 'italic' }}>
                  All rows imported successfully ✓
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setImportResult(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
