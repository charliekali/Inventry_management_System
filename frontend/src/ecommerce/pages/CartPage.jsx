import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Trash2, ShoppingBag, Percent, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function CartPage() {
  const { 
    cartItems, 
    updateQuantity, 
    removeFromCart, 
    subtotal, 
    taxAmount, 
    shippingCharge, 
    discount, 
    grandTotal, 
    coupon, 
    applyCouponCode, 
    removeCoupon 
  } = useCart();

  const [promoCode, setPromoCode] = useState('');
  const navigate = useNavigate();

  const handlePromoSubmit = async (e) => {
    e.preventDefault();
    if (!promoCode.trim()) return;
    const res = await applyCouponCode(promoCode.trim());
    if (res.success) {
      toast.success(res.message);
      setPromoCode('');
    } else {
      toast.error(res.message);
    }
  };

  if (cartItems.length === 0) {
    return (
      <div className="ecom-container" style={{ padding: '80px 16px', textAlign: 'center' }}>
        <ShoppingBag size={64} style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }} />
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Your shopping cart is empty</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>Add premium items to your cart to get started.</p>
        <Link to="/store/shop" className="ecom-btn ecom-btn-primary" style={{ textDecoration: 'none' }}>
          Shop Storefront Now
        </Link>
      </div>
    );
  }

  return (
    <div className="ecom-container">
      <div className="cart-layout">
        {/* Left Side: Cart Items List */}
        <div className="cart-items-container">
          <h2 style={{ fontSize: 18, fontWeight: 700, borderBottom: '1px solid var(--color-border)', paddingBottom: 16, marginBottom: 0 }}>
            Shopping Cart ({cartItems.length} {cartItems.length === 1 ? 'Item' : 'Items'})
          </h2>

          <div>
            {cartItems.map(item => (
              <div key={item.product_id} className="cart-item">
                <img 
                  src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=150'} 
                  alt={item.name} 
                  className="cart-item-image"
                />
                
                <div className="cart-item-details">
                  <h4 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px 0', color: '#212121' }}>{item.name}</h4>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                    Pack Unit: {item.unit || 'PCS'} | Weight: {item.weight || 0}g
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Quantity controls */}
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
                      <button 
                        onClick={() => updateQuantity(item.product_id, item.qty_required - 1)} 
                        style={{ padding: '4px 10px', border: 'none', background: '#f5f5f5', cursor: 'pointer', fontWeight: 'bold' }}
                      >-</button>
                      <span style={{ padding: '0 12px', fontWeight: 'bold', fontSize: 13 }}>{item.qty_required}</span>
                      <button 
                        onClick={() => updateQuantity(item.product_id, item.qty_required + 1)} 
                        style={{ padding: '4px 10px', border: 'none', background: '#f5f5f5', cursor: 'pointer', fontWeight: 'bold' }}
                      >-</button>
                    </div>

                    {/* Remove Action */}
                    <button 
                      onClick={() => removeFromCart(item.product_id)} 
                      style={{ background: 'none', border: 'none', color: 'var(--color-accent-red)', cursor: 'pointer', fontSize: 13, fontWeight: '700', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Trash2 size={14} /> REMOVE
                    </button>
                  </div>
                </div>

                {/* Subtotal cost display */}
                <div style={{ textAlign: 'right', minWidth: 100 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#212121' }}>
                    ₹{(item.unit_price * item.qty_required).toFixed(2)}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    ₹{item.unit_price} / unit
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Order Price details Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Coupon Applicator */}
          <div className="cart-summary-panel">
            <h4 style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', marginBottom: 12, color: '#212121', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Percent size={16} /> Have a Coupon?
            </h4>
            {coupon ? (
              <div style={{ background: '#ecfdf5', border: '1px dashed #10b981', borderRadius: 4, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 'bold', color: '#047857' }}>Code: {coupon.code}</span>
                  <div style={{ fontSize: 11, color: '#065f46' }}>Applied successfully!</div>
                </div>
                <button 
                  onClick={removeCoupon}
                  style={{ background: 'none', border: 'none', color: 'var(--color-accent-red)', cursor: 'pointer', fontSize: 12, fontWeight: 'bold' }}
                >
                  REMOVE
                </button>
              </div>
            ) : (
              <form onSubmit={handlePromoSubmit} style={{ display: 'flex', gap: 8 }}>
                <input 
                  type="text" 
                  placeholder="Enter Code (e.g. FESTIVE10)" 
                  value={promoCode} 
                  onChange={e => setPromoCode(e.target.value)}
                  style={{ flexGrow: 1, padding: '8px 12px', borderRadius: 4, border: '1px solid var(--color-border)', outline: 'none', fontSize: 13 }}
                />
                <button type="submit" className="ecom-btn ecom-btn-outline" style={{ padding: '8px 16px', fontSize: 13 }}>Apply</button>
              </form>
            )}
          </div>

          {/* Pricing breakdown */}
          <div className="cart-summary-panel">
            <h3 style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', paddingBottom: 12, marginBottom: 16, color: 'var(--color-text-secondary)' }}>
              Price Details
            </h3>
            
            <div className="cart-summary-row">
              <span>Price ({cartItems.length} {cartItems.length === 1 ? 'Item' : 'Items'})</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            
            {discount > 0 && (
              <div className="cart-summary-row" style={{ color: '#388e3c', fontWeight: 600 }}>
                <span>Discount</span>
                <span>-₹{discount.toFixed(2)}</span>
              </div>
            )}

            <div className="cart-summary-row">
              <span>Tax (GST)</span>
              <span>₹{taxAmount.toFixed(2)}</span>
            </div>

            <div className="cart-summary-row">
              <span>Delivery Charges</span>
              {shippingCharge === 0 ? (
                <span style={{ color: '#388e3c', fontWeight: 600 }}>FREE</span>
              ) : (
                <span>₹{shippingCharge.toFixed(2)}</span>
              )}
            </div>

            <div className="cart-summary-row cart-summary-total">
              <span>Total Amount</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>

            {discount > 0 && (
              <div style={{ background: 'rgba(56, 142, 60, 0.1)', color: '#388e3c', fontSize: 13, fontWeight: 700, padding: 10, borderRadius: 4, textAlign: 'center', marginTop: 16 }}>
                You will save ₹{discount.toFixed(2)} on this order!
              </div>
            )}

            <button 
              onClick={() => navigate('/store/checkout')}
              className="ecom-btn ecom-btn-primary ecom-btn-block"
              style={{ marginTop: 20, height: 48, borderRadius: 3 }}
            >
              Place Order
            </button>
          </div>

          {/* Secure details */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--color-text-secondary)' }}>
            <ShieldCheck size={16} /> Safe and Secure Payments. 100% Authentic products.
          </div>
        </div>
      </div>
    </div>
  );
}
