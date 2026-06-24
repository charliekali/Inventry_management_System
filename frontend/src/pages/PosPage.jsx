import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsAPI, ordersAPI, stockAPI } from '../api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  User, 
  FileText, 
  CreditCard,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  ChevronDown
} from 'lucide-react';

export default function PosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'Super Admin';

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
  const [taxPercent, setTaxPercent] = useState(18); // Default 18% GST/tax
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState('');

  // Customer autocomplete
  const [allCustomerNames, setAllCustomerNames] = useState([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const customerInputRef = useRef(null);
  const customerDropdownRef = useRef(null);

  // Filtered suggestions based on typed text
  const customerSuggestions = customer.trim().length === 0
    ? allCustomerNames
    : allCustomerNames.filter(name =>
        name.toLowerCase().includes(customer.trim().toLowerCase())
      );

  useEffect(() => {
    Promise.all([
      productsAPI.list({ type: 'FINISHED_GOOD' }),
      stockAPI.balance(),
      ordersAPI.list()
    ])
      .then(([productsRes, stockRes, ordersRes]) => {
        setProducts(productsRes.data.data);
        
        // Map product balances
        const balances = {};
        stockRes.data.data.forEach(item => {
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
      .catch(() => toast.error('Failed to load POS data'))
      .finally(() => setLoading(false));
  }, []);

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

  // Filter products by search and category
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories for tabs
  const categories = ['ALL', ...new Set(products.map(p => p.category).filter(Boolean))];

  // Cart operations
  const addToCart = (product) => {
    const existing = cart.find(item => item.product_id === product.id);
    const balance = stockBalances[product.id] || 0;

    if (existing) {
      if (existing.qty_required >= balance) {
        toast.error(`Only ${balance} ${product.unit} available in stock!`);
      }
      setCart(cart.map(item => 
        item.product_id === product.id 
          ? { ...item, qty_required: item.qty_required + 1 }
          : item
      ));
    } else {
      if (balance <= 0) {
        toast.error(`Product out of stock!`);
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
        toast.error(`Only ${balance} units available in stock!`);
      }
      setCart(cart.map(i => 
        i.product_id === productId 
          ? { ...i, qty_required: newQty }
          : i
      ));
    }
  };

  const updatePrice = (productId, val) => {
    setCart(cart.map(i => 
      i.product_id === productId 
        ? { ...i, unit_price: parseFloat(val) || 0 }
        : i
    ));
  };

  const updateDiscount = (productId, val) => {
    setCart(cart.map(i => 
      i.product_id === productId 
        ? { ...i, discount: parseFloat(val) || 0 }
        : i
    ));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  // Calculations
  const calculateSubtotal = () => {
    return cart.reduce((sum, item) => sum + (item.unit_price * item.qty_required - item.discount), 0);
  };

  const subtotal = calculateSubtotal();
  const taxAmount = Math.round((subtotal * (taxPercent / 100)) * 100) / 100;
  const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;

  // Handle checkout submit
  const handleCheckout = (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      toast.error('Cart is empty!');
      return;
    }
    if (!customer.trim()) {
      toast.error('Customer name is required!');
      return;
    }

    setSubmitting(true);
    const orderData = {
      customer,
      remarks,
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

    ordersAPI.posCreate(orderData)
      .then(res => {
        toast.success('Sale completed successfully!');
        const orderId = res.data.data.id;
        navigate(`/invoice/${orderId}`);
      })
      .catch((err) => {
        console.error(err);
        toast.error(err.response?.data?.message || 'Failed to complete POS sale');
      })
      .finally(() => setSubmitting(false));
  };

  if (loading) return <div className="loading-center"><div className="loading-spinner"></div></div>;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => navigate('/sales-dashboard')} className="btn btn-secondary btn-icon btn-sm">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h2>Point of Sale (POS)</h2>
              <p>Instant billing counter for direct sales</p>
            </div>
          </div>
        </div>
        <div className="page-header-right">
          <div className="badge badge-green" style={{ fontSize: 13, padding: '8px 12px', display: 'flex', gap: 6, alignItems: 'center' }}>
            <Sparkles size={14} /> Counter Active
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ display: 'flex', gap: 20, flex: 1, overflow: 'hidden' }}>
        {/* Left: Product Grid Catalog */}
        <div style={{ flex: 1.4, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Search and Category Tabs */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <div className="search-wrapper" style={{ flex: 1, minWidth: 200 }}>
              <Search className="search-icon" size={18} />
              <input 
                type="text" 
                placeholder="Search products by name or code..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            {/* Category tabs */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ textTransform: 'capitalize', whiteSpace: 'nowrap' }}
                >
                  {cat.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Product Catalog Grid */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
            {filteredProducts.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <p>No products found matching filters.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                {filteredProducts.map(p => {
                  const balance = stockBalances[p.id] || 0;
                  const isOutOfStock = balance <= 0;
                  
                  return (
                    <div 
                      key={p.id} 
                      className={`card ${isOutOfStock ? 'disabled-card' : ''}`}
                      onClick={() => !isOutOfStock && addToCart(p)}
                      style={{ 
                        cursor: isOutOfStock ? 'not-allowed' : 'pointer', 
                        padding: 14, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'space-between',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        border: '1px solid var(--color-border)'
                      }}
                      onMouseEnter={(e) => {
                        if (!isOutOfStock) {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isOutOfStock) {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = 'none';
                        }
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-text-muted)' }}>{p.code}</span>
                          <span className={`badge ${isOutOfStock ? 'badge-red' : balance < 10 ? 'badge-orange' : 'badge-green'}`} style={{ fontSize: 10 }}>
                            {balance} {p.unit}
                          </span>
                        </div>
                        <h4 style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: 'var(--color-text-primary)' }}>{p.name}</h4>
                        {p.category && (
                          <span className="badge badge-gray" style={{ fontSize: 9, textTransform: 'uppercase' }}>{p.category}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-success)' }}>
                          ₹{p.selling_price ? p.selling_price.toLocaleString('en-IN') : '0.00'}
                        </span>
                        <button 
                          disabled={isOutOfStock}
                          className="btn btn-primary btn-sm btn-icon" 
                          style={{ borderRadius: '50%', width: 28, height: 28, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Checkout Billing Cart */}
        <form onSubmit={handleCheckout} style={{ flex: 1.1, display: 'flex', flexDirection: 'column', background: 'var(--color-bg-card)', borderRadius: 12, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
          {/* Cart Header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={18} color="var(--color-primary)" />
              <h3 style={{ fontWeight: 600, fontSize: 16 }}>Shopping Cart</h3>
            </div>
            <span className="badge badge-blue">{cart.reduce((s, i) => s + i.qty_required, 0)} Items</span>
          </div>

          {/* Cart Items List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {cart.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)', gap: 10 }}>
                <ShoppingCart size={40} style={{ opacity: 0.5 }} />
                <p style={{ fontWeight: 500 }}>No items in cart</p>
                <p style={{ fontSize: 12 }}>Select finished goods from the left catalog</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cart.map(item => (
                  <div key={item.product_id} style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-bg-app)', padding: 10, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                    {/* Item title & delete */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <h4 style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</h4>
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{item.code}</span>
                      </div>
                      <button type="button" onClick={() => removeFromCart(item.product_id)} className="text-danger" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {/* Price, qty and inputs */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      {/* Qty incrementors */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--color-bg-card)', borderRadius: 6, border: '1px solid var(--color-border)', padding: '2px 4px' }}>
                        <button type="button" onClick={() => updateQty(item.product_id, -1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                          <Minus size={12} />
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.qty_required}</span>
                        <button type="button" onClick={() => updateQty(item.product_id, 1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                          <Plus size={12} />
                        </button>
                      </div>

                      {/* Inputs: Price & Discount */}
                      <div style={{ display: 'flex', gap: 8, flex: 1 }}>
                        <div style={{ position: 'relative', flex: 1.2 }}>
                          <span style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--color-text-muted)' }}>₹</span>
                          <input 
                            type="number" 
                            value={item.unit_price} 
                            onChange={e => updatePrice(item.product_id, e.target.value)}
                            disabled={!isSuperAdmin}
                            style={{ width: '100%', fontSize: 11, padding: '4px 4px 4px 12px', borderRadius: 4, border: '1px solid var(--color-border)' }}
                            placeholder="Price"
                            step="0.01"
                          />
                        </div>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <span style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--color-text-muted)' }}>Disc</span>
                          <input 
                            type="number" 
                            value={item.discount} 
                            onChange={e => updateDiscount(item.product_id, e.target.value)}
                            style={{ width: '100%', fontSize: 11, padding: '4px 4px 4px 28px', borderRadius: 4, border: '1px solid var(--color-border)' }}
                            placeholder="Disc"
                            step="0.01"
                          />
                        </div>
                      </div>

                      {/* Line Total */}
                      <div style={{ textAlign: 'right', minWidth: 70 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>
                          ₹{Math.round((item.unit_price * item.qty_required - item.discount) * 100) / 100}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checkout Calculations & Form Panel */}
          <div style={{ padding: 14, background: 'var(--color-bg-app)', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Subtotal</span>
                <span style={{ fontWeight: 600 }}>₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Tax (%)</span>
                <input 
                  type="number" 
                  value={taxPercent}
                  onChange={e => setTaxPercent(parseFloat(e.target.value) || 0)}
                  style={{ width: 60, textAlign: 'right', fontSize: 12, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--color-border)' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Tax Amount</span>
                <span style={{ fontWeight: 600 }}>₹{taxAmount.toLocaleString('en-IN')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, borderTop: '1px dashed var(--color-border)', paddingTop: 6, marginTop: 4 }}>
                <span>Grand Total</span>
                <span style={{ color: 'var(--color-success)' }}>₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Customer Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Customer Name</label>
                  {/* Autocomplete combobox */}
                  <div style={{ position: 'relative' }} ref={customerDropdownRef}>
                    <User size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', zIndex: 1, pointerEvents: 'none' }} />
                    <input
                      ref={customerInputRef}
                      type="text"
                      value={customer}
                      onChange={e => { setCustomer(e.target.value); setCustomerDropdownOpen(true); }}
                      onFocus={() => setCustomerDropdownOpen(true)}
                      placeholder="Walk-in Customer"
                      style={{ width: '100%', fontSize: 12, padding: '6px 24px 6px 26px', borderRadius: 6, border: '1px solid var(--color-border)', boxSizing: 'border-box' }}
                      required
                      autoComplete="off"
                    />
                    <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                    {customerDropdownOpen && customerSuggestions.length > 0 && (
                      <div style={{
                        position: 'absolute', bottom: '100%', left: 0, right: 0,
                        background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
                        borderRadius: 8, boxShadow: 'var(--shadow-lg)', zIndex: 200,
                        maxHeight: 180, overflowY: 'auto', marginBottom: 4
                      }}>
                        {customerSuggestions.map((name, idx) => (
                          <div
                            key={idx}
                            onMouseDown={() => { setCustomer(name); setCustomerDropdownOpen(false); }}
                            style={{
                              padding: '7px 12px', fontSize: 12, cursor: 'pointer',
                              borderBottom: '1px solid var(--color-border)',
                              display: 'flex', alignItems: 'center', gap: 8
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover, rgba(99,102,241,0.08))'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <User size={11} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                            {name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Remarks / Notes</label>
                  <div style={{ position: 'relative' }}>
                    <FileText size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                    <input 
                      type="text" 
                      value={remarks} 
                      onChange={e => setRemarks(e.target.value)}
                      placeholder="Special instructions..."
                      style={{ width: '100%', fontSize: 12, padding: '6px 6px 6px 26px', borderRadius: 6, border: '1px solid var(--color-border)' }}
                    />
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Payment Mode</label>
                  <select 
                    value={paymentMode} 
                    onChange={e => setPaymentMode(e.target.value)}
                    style={{ width: '100%', fontSize: 12, padding: '6px', borderRadius: 6, border: '1px solid var(--color-border)' }}
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI (Paytm/GPay)</option>
                    <option value="CARD">Credit/Debit Card</option>
                    <option value="CREDIT">Customer Credit</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Paid Amount</label>
                  <div style={{ position: 'relative' }}>
                    <CreditCard size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                    <input 
                      type="number" 
                      value={paidAmount} 
                      onChange={e => setPaidAmount(e.target.value)}
                      placeholder={grandTotal}
                      step="0.01"
                      style={{ width: '100%', fontSize: 12, padding: '6px 6px 6px 26px', borderRadius: 6, border: '1px solid var(--color-border)' }}
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={submitting || cart.length === 0} 
                className="btn btn-primary"
                style={{ 
                  width: '100%', 
                  padding: 10, 
                  marginTop: 6, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: 8, 
                  fontSize: 14,
                  fontWeight: 600,
                  backgroundColor: 'var(--color-success)',
                  borderColor: 'var(--color-success)'
                }}
              >
                <CheckCircle2 size={16} />
                {submitting ? 'Completing Sale...' : 'Finalize Sale & Issue Invoice'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
