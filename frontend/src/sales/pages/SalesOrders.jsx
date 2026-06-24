/**
 * SalesOrders.jsx — Orders Module (Mobile-First)
 * View orders list, search & filter by status.
 * View order details including items and status.
 * Create a new order with locked unit prices (enforcing that salespeople can only apply discounts).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ordersAPI, productsAPI } from '../../api';
import toast from 'react-hot-toast';
import {
  ShoppingBag, Search, Plus, Trash2, X, ChevronRight,
  Eye, FileText, CheckCircle2, AlertCircle, ShoppingCart,
  Percent, DollarSign, Calendar, User, ChevronDown
} from 'lucide-react';
import SearchableSelect from '../../components/SearchableSelect';

function fmtCurrency(v) {
  return '₹' + (v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDateShort(iso) {
  if (!iso) return '—';
  return iso.replace('T', ' ').substring(0, 16);
}

function getStatusChipClass(status) {
  switch (status) {
    case 'PENDING':      return 'gray';
    case 'FEASIBLE':     return 'green';
    case 'PARTIAL':      return 'orange';
    case 'INSUFFICIENT': return 'red';
    case 'FULFILLED':    return 'blue';
    default:             return 'gray';
  }
}

export default function SalesOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [creatorFilter, setCreatorFilter] = useState('MY'); // MY | ALL

  // Create Order Form State
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [customer, setCustomer] = useState('');
  const [remarks, setRemarks] = useState('');
  const [taxPercent, setTaxPercent] = useState(18);
  const [itemsList, setItemsList] = useState([]);

  // Customer autocomplete
  const [allCustomerNames, setAllCustomerNames] = useState([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const customerInputRef = useRef(null);
  const customerDropdownRef = useRef(null);

  const customerSuggestions = customer.trim().length === 0
    ? allCustomerNames
    : allCustomerNames.filter(name =>
        name.toLowerCase().includes(customer.trim().toLowerCase())
      );

  // Current Item Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [unit, setUnit] = useState('pcs');

  // Order Detail Sheet State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);

  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Load orders and products
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordRes, prodRes] = await Promise.all([
        ordersAPI.list(),
        productsAPI.list()
      ]);
      const loadedOrders = ordRes.data.data || [];
      setOrders(loadedOrders);
      setProducts(prodRes.data.data || []);

      // Build unique customer/lead name list
      const names = [...new Set(
        loadedOrders
          .map(o => o.customer)
          .filter(n => n && n.trim() && n.toLowerCase() !== 'walk-in customer')
      )].sort((a, b) => a.localeCompare(b));
      setAllCustomerNames(names);
    } catch (err) {
      toast.error('Failed to load orders data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (
        customerInputRef.current && !customerInputRef.current.contains(e.target) &&
        customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)
      ) {
        setCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Product Selection handler: pre-fill standard price, lock editing
  const handleProductSelect = (pId) => {
    setSelectedProductId(pId);
    if (!pId) {
      setUnitPrice('');
      setDiscount('');
      setUnit('pcs');
      return;
    }
    const prod = products.find(p => p.id === pId);
    if (prod) {
      setUnitPrice(prod.selling_price || 0.0);
      setDiscount(0.0);
      setUnit(prod.unit || 'pcs');
    }
  };

  const handleAddItem = () => {
    if (!selectedProductId || !qty) return toast.error('Select product & enter quantity');
    const quantity = parseFloat(qty);
    if (isNaN(quantity) || quantity <= 0) return toast.error('Quantity must be greater than zero');

    if (itemsList.some(item => item.product_id === selectedProductId)) {
      return toast.error('Product already added to list');
    }

    const prod = products.find(p => p.id === selectedProductId);
    setItemsList([...itemsList, {
      product_id: selectedProductId,
      product_name: prod.name,
      product_code: prod.code,
      qty_required: quantity,
      unit: unit,
      unit_price: parseFloat(unitPrice) || 0.0,
      discount: parseFloat(discount) || 0.0
    }]);

    // Reset current item form
    setSelectedProductId('');
    setQty('');
    setUnitPrice('');
    setDiscount('');
    setUnit('pcs');
  };

  const handleRemoveItem = (index) => {
    setItemsList(itemsList.filter((_, i) => i !== index));
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!customer.trim()) return toast.error('Customer name is required');
    if (itemsList.length === 0) return toast.error('Add at least one item');

    setSubmittingOrder(true);
    try {
      const payload = {
        customer: customer.trim(),
        remarks: remarks.trim(),
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
      toast.success('Order placed successfully!');
      setShowCreateSheet(false);
      // Reset order form
      setCustomer('');
      setRemarks('');
      setItemsList([]);
      setTaxPercent(18);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to place order');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleViewDetails = async (order) => {
    setSelectedOrder(order);
    setDetailLoading(true);
    setShowDetailSheet(true);
    try {
      const res = await ordersAPI.get(order.id);
      setDetailItems(res.data.data.items || []);
    } catch (err) {
      toast.error('Failed to load order details');
      setShowDetailSheet(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter(ord => {
    const q = searchTerm.toLowerCase();
    const matchSearch = (ord.order_number?.toLowerCase() || '').includes(q) ||
                        (ord.customer?.toLowerCase() || '').includes(q);
    const matchStatus = statusFilter === 'ALL' || ord.status === statusFilter;
    const matchCreator = creatorFilter === 'ALL' || ord.created_by_name === user?.name;

    return matchSearch && matchStatus && matchCreator;
  });

  // Calculate stats for current list
  const totalOrderVolume = filteredOrders.reduce((s, o) => s + (o.grand_total || 0), 0);

  // Form Subtotal calculation
  const formSubtotal = itemsList.reduce((s, i) => s + (i.unit_price * i.qty_required) - (i.discount * i.qty_required), 0);
  const formTax = formSubtotal * (taxPercent / 100);
  const formTotal = formSubtotal + formTax;

  return (
    <div className="s-page s-fade-in">
      {/* Top Banner stats */}
      <div className="s-kpi-row">
        <div className="s-kpi blue">
          <div className="s-kpi-icon blue"><ShoppingBag size={14} color="#3b82f6" /></div>
          <div className="s-kpi-val sm">{loading ? '…' : filteredOrders.length}</div>
          <div className="s-kpi-label">Order Count</div>
        </div>
        <div className="s-kpi green">
          <div className="s-kpi-icon green"><DollarSign size={14} color="#10b981" /></div>
          <div className="s-kpi-val sm">{loading ? '…' : fmtCurrency(totalOrderVolume)}</div>
          <div className="s-kpi-label">Sales Volume</div>
        </div>
      </div>

      {/* Quick Action Button */}
      <button className="s-btn primary lg s-mb-16" onClick={() => setShowCreateSheet(true)}>
        <Plus size={16} /> Create Customer Order
      </button>

      {/* Tabs */}
      <div className="s-tabs s-mb-16">
        <button
          className={`s-tab${creatorFilter === 'MY' ? ' active' : ''}`}
          onClick={() => setCreatorFilter('MY')}
        >
          👤 My Orders
        </button>
        <button
          className={`s-tab${creatorFilter === 'ALL' ? ' active' : ''}`}
          onClick={() => setCreatorFilter('ALL')}
        >
          🌍 All Orders
        </button>
      </div>

      {/* Filters & Search */}
      <div className="s-search">
        <Search className="s-search-icon" size={16} />
        <input
          type="text"
          placeholder="Search order # or customer..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Status filter chips */}
      <div className="s-filter-row">
        {['ALL', 'PENDING', 'FEASIBLE', 'PARTIAL', 'INSUFFICIENT', 'FULFILLED'].map(st => (
          <button
            key={st}
            className={`s-filter-chip${statusFilter === st ? ' active' : ''}`}
            onClick={() => setStatusFilter(st)}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Order List */}
      {loading ? (
        <div className="s-spinner-wrap">
          <div className="s-spinner" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="s-empty">
          <AlertCircle size={40} color="var(--s-text-3)" style={{ opacity: 0.6 }} />
          <p className="title">No orders found</p>
          <p className="sub">Try changing your filters or create a new order.</p>
        </div>
      ) : (
        <div className="s-card">
          <div className="s-list">
            {filteredOrders.map(ord => {
              const statusClass = getStatusChipClass(ord.status);
              return (
                <div key={ord.id} className="s-list-item" onClick={() => handleViewDetails(ord)}>
                  <div className="s-list-avatar" style={{ background: 'rgba(139,92,246,0.1)', color: '#c4b5fd' }}>
                    <ShoppingBag size={16} />
                  </div>
                  <div className="s-list-body">
                    <div className="s-list-title">{ord.customer}</div>
                    <div className="s-list-sub">
                      {ord.order_number} · {ord.created_at ? ord.created_at.split('T')[0] : '—'}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span className={`s-chip ${statusClass}`}>{ord.status}</span>
                    </div>
                  </div>
                  <div className="s-list-right" style={{ marginRight: 6 }}>
                    <div className="s-list-amount">{fmtCurrency(ord.grand_total)}</div>
                    <div className="s-list-date">{ord.created_by_name}</div>
                  </div>
                  <ChevronRight size={16} color="var(--s-text-3)" style={{ flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAIL DRAWER */}
      {showDetailSheet && selectedOrder && (
        <div className="s-sheet-overlay" onClick={() => setShowDetailSheet(false)}>
          <div className="s-sheet" onClick={e => e.stopPropagation()}>
            <div className="s-sheet-handle" />
            <div className="s-sheet-header">
              <div>
                <div className="s-sheet-title">Order Details</div>
                <div className="s-sheet-sub">{selectedOrder.order_number} · {selectedOrder.customer}</div>
              </div>
              <button
                className="s-btn ghost"
                style={{ padding: 6, borderRadius: '50%', width: 28, height: 28 }}
                onClick={() => setShowDetailSheet(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="s-sheet-body">
              {detailLoading ? (
                <div className="s-spinner-wrap">
                  <div className="s-spinner" />
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                    <div className="s-card s-card-padded" style={{ padding: 12 }}>
                      <div className="s-kpi-label">Status</div>
                      <div style={{ marginTop: 4 }}>
                        <span className={`s-chip ${getStatusChipClass(selectedOrder.status)}`}>{selectedOrder.status}</span>
                      </div>
                    </div>
                    <div className="s-card s-card-padded" style={{ padding: 12 }}>
                      <div className="s-kpi-label">Grand Total</div>
                      <div className="s-list-amount" style={{ fontSize: 16, marginTop: 4 }}>{fmtCurrency(selectedOrder.grand_total)}</div>
                    </div>
                  </div>

                  <div className="s-section-label">Order Items</div>
                  <div className="s-card s-mb-16">
                    <div className="s-list">
                      {detailItems.map((item, idx) => (
                        <div key={idx} className="s-list-item" style={{ cursor: 'default' }}>
                          <div className="s-list-body">
                            <div className="s-list-title" style={{ fontSize: 13 }}>{item.product_name}</div>
                            <div className="s-list-sub">{item.product_code} · {item.qty_required} {item.unit}</div>
                            {item.discount > 0 && (
                              <div style={{ fontSize: 10, color: 'var(--s-success)', fontWeight: 600 }}>
                                Discount applied: -{fmtCurrency(item.discount)}/unit
                              </div>
                            )}
                          </div>
                          <div className="s-list-right">
                            <div className="s-list-amount">
                              {fmtCurrency((item.unit_price - (item.discount || 0)) * item.qty_required)}
                            </div>
                            <div className="s-list-date">{fmtCurrency(item.unit_price)}/unit</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {selectedOrder.remarks && (
                    <div className="s-form-group">
                      <label className="s-label">Remarks</label>
                      <div className="s-card s-card-padded" style={{ padding: 10, fontSize: 13, background: 'rgba(255,255,255,0.02)' }}>
                        {selectedOrder.remarks}
                      </div>
                    </div>
                  )}

                  <div className="s-form-group">
                    <label className="s-label">Timeline Info</label>
                    <div style={{ fontSize: 12, color: 'var(--s-text-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span>👤 Created by: <strong>{selectedOrder.created_by_name}</strong></span>
                      <span>📅 Created at: <strong>{fmtDateShort(selectedOrder.created_at)}</strong></span>
                      {selectedOrder.invoice_number && (
                        <span>🧾 Linked Invoice: <strong style={{ color: 'var(--s-primary)' }}>{selectedOrder.invoice_number}</strong></span>
                      )}
                    </div>
                  </div>

                  <button className="s-btn ghost lg" style={{ marginTop: 10 }} onClick={() => setShowDetailSheet(false)}>
                    Close Details
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE ORDER SHEET */}
      {showCreateSheet && (
        <div className="s-sheet-overlay" onClick={() => setShowCreateSheet(false)}>
          <div className="s-sheet" onClick={e => e.stopPropagation()}>
            <div className="s-sheet-handle" />
            <div className="s-sheet-header">
              <div>
                <div className="s-sheet-title">Create Sales Order</div>
                <div className="s-sheet-sub">Add customer billing info and list items.</div>
              </div>
              <button
                className="s-btn ghost"
                style={{ padding: 6, borderRadius: '50%', width: 28, height: 28 }}
                onClick={() => setShowCreateSheet(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="s-sheet-body">
              <form onSubmit={handleCreateOrder}>
                <div className="s-form-group">
                  <label className="s-label">Customer Name *</label>
                  {/* Autocomplete combobox */}
                  <div style={{ position: 'relative' }} ref={customerDropdownRef}>
                    <input
                      ref={customerInputRef}
                      type="text"
                      className="s-input"
                      value={customer}
                      onChange={e => { setCustomer(e.target.value); setCustomerDropdownOpen(true); }}
                      onFocus={() => setCustomerDropdownOpen(true)}
                      placeholder="Enter or search customer name..."
                      required
                      autoComplete="off"
                      style={{ paddingRight: 30 }}
                    />
                    <ChevronDown size={13} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--s-text-3)', pointerEvents: 'none' }} />
                    {customerDropdownOpen && customerSuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '105%', left: 0, right: 0,
                        background: 'var(--s-card)', border: '1px solid var(--s-border)',
                        borderRadius: 10, boxShadow: '0 4px 24px rgba(0,0,0,0.25)', zIndex: 300,
                        maxHeight: 200, overflowY: 'auto'
                      }}>
                        <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--s-text-3)', fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid var(--s-border)' }}>
                          Leads &amp; Customers
                        </div>
                        {customerSuggestions.map((name, idx) => (
                          <div
                            key={idx}
                            onMouseDown={() => { setCustomer(name); setCustomerDropdownOpen(false); }}
                            style={{
                              padding: '10px 14px', fontSize: 13, cursor: 'pointer',
                              borderBottom: idx < customerSuggestions.length - 1 ? '1px solid var(--s-border)' : 'none',
                              display: 'flex', alignItems: 'center', gap: 10
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <User size={13} style={{ color: 'var(--s-primary)', flexShrink: 0 }} />
                            {name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ADD ITEM SECTION */}
                <div className="s-card s-card-padded s-mb-16" style={{ background: 'rgba(255,255,255,0.01)' }}>
                  <div className="s-label" style={{ marginBottom: 12, color: 'var(--s-primary)' }}>🛒 Add Product Item</div>
                  
                  <div className="s-form-group">
                    <label className="s-label" style={{ fontSize: 10 }}>Select Product</label>
                    <SearchableSelect
                      options={products.map(p => ({ value: p.id, label: `${p.name} (${p.code})` }))}
                      value={selectedProductId}
                      onChange={handleProductSelect}
                      placeholder="-- Choose Product --"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="s-form-group">
                      <label className="s-label" style={{ fontSize: 10 }}>Qty Required</label>
                      <input
                        type="number"
                        className="s-input"
                        placeholder="0"
                        value={qty}
                        onChange={e => setQty(e.target.value)}
                      />
                    </div>
                    <div className="s-form-group">
                      <label className="s-label" style={{ fontSize: 10 }}>Unit</label>
                      <input
                        type="text"
                        className="s-input"
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                        placeholder="pcs"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="s-form-group">
                      <label className="s-label" style={{ fontSize: 10 }}>Unit Price (₹) [🔒 Admin Locked]</label>
                      <input
                        type="number"
                        className="s-input"
                        style={{ opacity: 0.7, background: 'rgba(0,0,0,0.1)' }}
                        value={unitPrice}
                        disabled
                        placeholder="0.00"
                      />
                    </div>
                    <div className="s-form-group">
                      <label className="s-label" style={{ fontSize: 10 }}>Apply Discount (₹/unit)</label>
                      <input
                        type="number"
                        className="s-input"
                        value={discount}
                        onChange={e => setDiscount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    className="s-btn primary"
                    style={{ width: '100%', borderRadius: 8, padding: 8, fontSize: 12 }}
                    onClick={handleAddItem}
                  >
                    Add Item to List
                  </button>
                </div>

                {/* ITEMS LIST TABLE */}
                {itemsList.length > 0 && (
                  <div className="s-form-group">
                    <label className="s-label">Items Selected</label>
                    <div className="s-card">
                      <div className="s-list">
                        {itemsList.map((item, index) => (
                          <div key={index} className="s-list-item" style={{ padding: '8px 12px', cursor: 'default' }}>
                            <div className="s-list-body">
                              <div className="s-list-title" style={{ fontSize: 12.5 }}>{item.product_name}</div>
                              <div className="s-list-sub" style={{ fontSize: 10.5 }}>
                                {item.qty_required} {item.unit} · {fmtCurrency(item.unit_price)}/unit
                                {item.discount > 0 && ` (-${fmtCurrency(item.discount)} disc)`}
                              </div>
                            </div>
                            <div className="s-list-right" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: 13 }}>
                                {fmtCurrency((item.unit_price - item.discount) * item.qty_required)}
                              </span>
                              <button
                                type="button"
                                className="s-btn danger sm"
                                style={{ padding: 4, borderRadius: 4 }}
                                onClick={() => handleRemoveItem(index)}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAX AND TOTAL */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 10, margin: '14px 0' }}>
                  <div className="s-form-group" style={{ margin: 0 }}>
                    <label className="s-label">GST Tax (%)</label>
                    <input
                      type="number"
                      className="s-input"
                      value={taxPercent}
                      onChange={e => setTaxPercent(e.target.value)}
                    />
                  </div>
                  <div className="s-card s-card-padded" style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--s-text-2)' }}>
                      <span>Subtotal:</span>
                      <span>{fmtCurrency(formSubtotal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--s-text-2)', marginTop: 2 }}>
                      <span>GST ({taxPercent}%):</span>
                      <span>{fmtCurrency(formTax)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 4, borderTop: '1px solid var(--s-border)', paddingTop: 4 }}>
                      <span>Grand Total:</span>
                      <span className="s-text-success">{fmtCurrency(formTotal)}</span>
                    </div>
                  </div>
                </div>

                <div className="s-form-group">
                  <label className="s-label">Order Remarks / Delivery Instructions</label>
                  <textarea
                    className="s-textarea"
                    placeholder="Enter special instructions or notes..."
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button type="button" className="s-btn ghost lg" onClick={() => setShowCreateSheet(false)}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="s-btn primary lg"
                    disabled={submittingOrder}
                  >
                    {submittingOrder ? 'Submitting...' : '✓ Place Order'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
