/**
 * SalesPOS.jsx — Mobile POS (Point of Sale) Module
 * Select finished goods, view live stock, add to cart.
 * Complete cash/UPI checkout with locked unit prices (discount only).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsAPI, ordersAPI, stockAPI } from '../../api';
import toast from 'react-hot-toast';
import {
  Search, ShoppingCart, Trash2, Plus, Minus, X,
  CheckCircle2, DollarSign, CreditCard, Tag, RefreshCw, User, ChevronDown
} from 'lucide-react';

function fmtCurrency(v) {
  return '₹' + (v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function SalesPOS() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [stockBalances, setStockBalances] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Cart state
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState('Walk-in Customer');
  const [remarks, setRemarks] = useState('');
  const [taxPercent, setTaxPercent] = useState(18);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState('');
  
  // Mobile UI flow state: CART | PRODUCTS
  const [activeMode, setActiveMode] = useState('PRODUCTS'); // PRODUCTS | CART
  const [showCheckoutSheet, setShowCheckoutSheet] = useState(false);

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

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      productsAPI.list({ type: 'FINISHED_GOOD' }),
      stockAPI.balance(),
      ordersAPI.list()
    ])
      .then(([prodRes, stockRes, ordersRes]) => {
        setProducts(prodRes.data.data || []);
        
        // Map product balances
        const balances = {};
        (stockRes.data.data || []).forEach(item => {
          const pid = item.product_id || item.product?.id;
          if (pid) {
            balances[pid] = (balances[pid] || 0) + (item.quantity || 0);
          }
        });
        setStockBalances(balances);

        // Build unique customer/lead name list
        const orders = ordersRes.data.data || [];
        const names = [...new Set(
          orders
            .map(o => o.customer)
            .filter(n => n && n.trim() && n.toLowerCase() !== 'walk-in customer')
        )].sort((a, b) => a.localeCompare(b));
        setAllCustomerNames(names);
      })
      .catch(() => toast.error('Failed to load POS inventory data'))
      .finally(() => setLoading(false));
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

  const addToCart = (product) => {
    const existing = cart.find(item => item.product_id === product.id);
    const balance = stockBalances[product.id] || 0;

    if (existing) {
      if (existing.qty_required >= balance) {
        return toast.error(`Only ${balance} ${product.unit} available in stock!`);
      }
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, qty_required: item.qty_required + 1 }
          : item
      ));
    } else {
      if (balance <= 0) {
        return toast.error(`Product is out of stock!`);
      }
      setCart([...cart, {
        product_id: product.id,
        name: product.name,
        code: product.code,
        unit: product.unit,
        unit_price: product.selling_price || 0,
        discount: 0,
        qty_required: 1
      }]);
    }
    toast.success(`${product.name} added to cart`, { duration: 800 });
  };

  const updateQty = (productId, delta) => {
    const item = cart.find(i => i.product_id === productId);
    if (!item) return;

    const newQty = item.qty_required + delta;
    if (newQty <= 0) {
      removeFromCart(productId);
    } else {
      const balance = stockBalances[productId] || 0;
      if (delta > 0 && newQty > balance) {
        return toast.error(`Only ${balance} units available in stock!`);
      }
      setCart(cart.map(i =>
        i.product_id === productId
          ? { ...i, qty_required: newQty }
          : i
      ));
    }
  };

  const updateDiscount = (productId, val) => {
    const discountVal = parseFloat(val) || 0;
    setCart(cart.map(i =>
      i.product_id === productId
        ? { ...i, discount: discountVal }
        : i
    ));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  // Computations
  const subtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.qty_required - item.discount * item.qty_required), 0);
  const taxAmount = Math.round((subtotal * (taxPercent / 100)) * 100) / 100;
  const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;

  const totalItemsCount = cart.reduce((sum, item) => sum + item.qty_required, 0);

  // Filter products by search and category
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['ALL', ...new Set(products.map(p => p.category).filter(Boolean))];

  const handleCheckout = (e) => {
    e.preventDefault();
    if (cart.length === 0) return toast.error('Cart is empty!');
    if (!customer.trim()) return toast.error('Customer name is required');

    setSubmitting(true);
    const orderPayload = {
      customer: customer.trim(),
      remarks: remarks.trim(),
      tax_percent: taxPercent,
      payment_mode: paymentMode,
      paid_amount: paidAmount === '' ? grandTotal : parseFloat(paidAmount),
      items: cart.map(item => ({
        product_id: item.product_id,
        qty_required: item.qty_required,
        unit: item.unit,
        unit_price: item.unit_price,
        discount: item.discount
      }))
    };

    ordersAPI.posCreate(orderPayload)
      .then(res => {
        toast.success('POS Sale recorded successfully!');
        setCart([]);
        setCustomer('Walk-in Customer');
        setRemarks('');
        setPaidAmount('');
        setShowCheckoutSheet(false);
        setActiveMode('PRODUCTS');
        const orderId = res.data.data.id;
        navigate(`/invoice/${orderId}`);
      })
      .catch((err) => {
        toast.error(err.response?.data?.message || 'Failed to complete POS sale');
      })
      .finally(() => setSubmitting(false));
  };

  return (
    <div className="s-page s-fade-in" style={{ paddingBottom: 80 }}>
      {/* Mobile Top Mode Toggle */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <button
          className={`s-btn ${activeMode === 'PRODUCTS' ? 'primary' : 'ghost'}`}
          style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 13 }}
          onClick={() => setActiveMode('PRODUCTS')}
        >
          🏷️ Catalog ({filteredProducts.length})
        </button>
        <button
          className={`s-btn ${activeMode === 'CART' ? 'primary' : 'ghost'}`}
          style={{ flex: 1, padding: 10, borderRadius: 10, fontSize: 13, position: 'relative' }}
          onClick={() => setActiveMode('CART')}
        >
          🛒 Cart {totalItemsCount > 0 && `(${totalItemsCount})`}
          {totalItemsCount > 0 && (
            <div className="s-nav-badge" style={{ top: -6, right: -4 }}>{totalItemsCount}</div>
          )}
        </button>
      </div>

      {loading ? (
        <div className="s-spinner-wrap">
          <div className="s-spinner" />
        </div>
      ) : activeMode === 'PRODUCTS' ? (
        /* CATALOG MODE */
        <div>
          {/* Search bar */}
          <div className="s-search">
            <Search className="s-search-icon" size={16} />
            <input
              type="text"
              placeholder="Search finished goods..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Categories */}
          <div className="s-filter-row">
            {categories.map(cat => (
              <button
                key={cat}
                className={`s-filter-chip${selectedCategory === cat ? ' active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Products List Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredProducts.map(p => {
              const stock = stockBalances[p.id] || 0;
              const inCart = cart.find(item => item.product_id === p.id);
              return (
                <div key={p.id} className="s-card s-card-padded" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--s-text-2)', marginTop: 2 }}>
                      Code: {p.code} · Price: <strong style={{ color: 'var(--s-primary)' }}>{fmtCurrency(p.selling_price)}</strong>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span className={`s-chip ${stock > 0 ? 'green' : 'red'}`} style={{ padding: '2px 6px', fontSize: 9 }}>
                        Stock: {stock} {p.unit}
                      </span>
                      {inCart && (
                        <span className="s-chip blue" style={{ padding: '2px 6px', fontSize: 9, marginLeft: 6 }}>
                          {inCart.qty_required} in cart
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className="s-btn primary"
                    style={{ padding: 8, borderRadius: 8 }}
                    disabled={stock <= 0}
                    onClick={() => addToCart(p)}
                  >
                    <Plus size={16} /> Add
                  </button>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="s-empty">
                <AlertCircle size={32} />
                <p>No products found</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* CART MODE */
        <div>
          {cart.length === 0 ? (
            <div className="s-empty">
              <ShoppingCart size={48} style={{ opacity: 0.4 }} />
              <p className="title">Your cart is empty</p>
              <p className="sub">Switch to the Catalog tab to add items.</p>
              <button className="s-btn primary md" style={{ marginTop: 12 }} onClick={() => setActiveMode('PRODUCTS')}>
                Browse Products
              </button>
            </div>
          ) : (
            <div>
              <div className="s-section-label">Selected Items</div>
              <div className="s-card s-mb-16">
                <div className="s-list">
                  {cart.map(item => (
                    <div key={item.product_id} className="s-list-item" style={{ padding: 12, cursor: 'default' }}>
                      <div className="s-list-body">
                        <div className="s-list-title" style={{ fontSize: 13.5 }}>{item.name}</div>
                        <div className="s-list-sub" style={{ fontSize: 11 }}>
                          Unit Price: <strong>{fmtCurrency(item.unit_price)}</strong> (Locked)
                        </div>
                        {/* Discount inline adjustment */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                          <Tag size={12} color="var(--s-text-3)" />
                          <span style={{ fontSize: 11, color: 'var(--s-text-3)' }}>Discount/unit:</span>
                          <input
                            type="number"
                            className="s-input"
                            style={{ width: 70, padding: '3px 6px', fontSize: 11, borderRadius: 6 }}
                            value={item.discount}
                            onChange={e => updateDiscount(item.product_id, e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      
                      <div className="s-list-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>
                          {fmtCurrency((item.unit_price - item.discount) * item.qty_required)}
                        </span>
                        
                        {/* Qty selectors */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button
                            className="s-btn ghost"
                            style={{ padding: 4, borderRadius: 6 }}
                            onClick={() => updateQty(item.product_id, -1)}
                          >
                            <Minus size={12} />
                          </button>
                          <span style={{ width: 24, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
                            {item.qty_required}
                          </span>
                          <button
                            className="s-btn ghost"
                            style={{ padding: 4, borderRadius: 6 }}
                            onClick={() => updateQty(item.product_id, 1)}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order total strip */}
              <div className="s-card s-card-padded s-mb-16" style={{ background: 'rgba(255,255,255,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--s-text-2)' }}>
                  <span>Subtotal:</span>
                  <span>{fmtCurrency(subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--s-text-2)', marginTop: 4 }}>
                  <span>GST ({taxPercent}%):</span>
                  <span>{fmtCurrency(taxAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, marginTop: 8, borderTop: '1px solid var(--s-border)', paddingTop: 8 }}>
                  <span>Grand Total:</span>
                  <span className="s-text-success" style={{ color: 'var(--s-success)' }}>{fmtCurrency(grandTotal)}</span>
                </div>
              </div>

              <button className="s-btn success lg" onClick={() => setShowCheckoutSheet(true)}>
                Proceed to Checkout ({fmtCurrency(grandTotal)})
              </button>
            </div>
          )}
        </div>
      )}

      {/* CHECKOUT BOTTOM SHEET */}
      {showCheckoutSheet && (
        <div className="s-sheet-overlay" onClick={() => setShowCheckoutSheet(false)}>
          <div className="s-sheet" onClick={e => e.stopPropagation()}>
            <div className="s-sheet-handle" />
            <div className="s-sheet-header">
              <div>
                <div className="s-sheet-title">Complete Quick POS Sale</div>
                <div className="s-sheet-sub">Collect payment info and complete transaction.</div>
              </div>
              <button
                className="s-btn ghost"
                style={{ padding: 6, borderRadius: '50%', width: 28, height: 28 }}
                onClick={() => setShowCheckoutSheet(false)}
              >
                <X size={14} />
              </button>
            </div>
            <div className="s-sheet-body">
              <form onSubmit={handleCheckout}>
                <div className="s-form-group">
                  <label className="s-label">Customer Name</label>
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
                        position: 'absolute', bottom: '110%', left: 0, right: 0,
                        background: 'var(--s-card)', border: '1px solid var(--s-border)',
                        borderRadius: 10, boxShadow: '0 -4px 24px rgba(0,0,0,0.25)', zIndex: 300,
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

                <div className="s-form-group">
                  <label className="s-label">Payment Mode</label>
                  <select
                    className="s-select"
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                  >
                    <option value="CASH">💵 Cash</option>
                    <option value="UPI">📱 UPI / QR Code</option>
                    <option value="CARD">💳 Card swipe</option>
                  </select>
                </div>

                <div className="s-form-group">
                  <label className="s-label">Amount Paid by Customer (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="s-input"
                    value={paidAmount}
                    onChange={e => setPaidAmount(e.target.value)}
                    placeholder={`Full Amount: ${grandTotal}`}
                  />
                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      className="s-btn ghost sm"
                      onClick={() => setPaidAmount(grandTotal.toString())}
                    >
                      Prefill Full Payment ({fmtCurrency(grandTotal)})
                    </button>
                  </div>
                </div>

                <div className="s-form-group">
                  <label className="s-label">Remarks / Sales Notes</label>
                  <textarea
                    className="s-textarea"
                    placeholder="Reference notes, counter name or location info..."
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                  />
                </div>

                {/* Final amount summary */}
                <div className="s-card s-card-padded s-mb-16" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Invoice Total:</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--s-success)' }}>{fmtCurrency(grandTotal)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button type="button" className="s-btn ghost lg" onClick={() => setShowCheckoutSheet(false)}>
                    Back to Cart
                  </button>
                  <button
                    type="submit"
                    className="s-btn success lg"
                    disabled={submitting}
                  >
                    {submitting ? 'Processing...' : '✓ Complete Sale'}
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
