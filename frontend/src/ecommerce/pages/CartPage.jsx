import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { Trash2, ArrowRight, ShoppingBag } from 'lucide-react';
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
      <div className="ecom-container" style={{ padding: '80px 0', textAlign: 'center' }}>
        <ShoppingBag size={64} style={{ color: 'var(--color-text-muted)', marginBottom: 24 }} />
        <h2>Your shopping cart is empty</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 24 }}>Add premium products from our shop section to get started.</p>
        <Link to="/store/shop" className="ecom-btn ecom-btn-primary" style={{ textDecoration: 'none' }}>
          Explore Products
        </Link>
      </div>
    );
  }

  return (
    <div className="ecom-container" style={{ margin: '40px auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32 }}>Shopping Cart</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 40 }}>
        {/* Cart Items list */}
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {cartItems.map(item => (
              <div key={item.product_id} style={{ display: 'flex', gap: 20, background: 'var(--color-bg-card)', padding: 20, borderRadius: 12, border: '1px solid var(--color-border)', alignItems: 'center' }}>
                <img 
                  src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=150'} 
                  alt={item.name} 
                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }}
                />
                <div style={{ flexGrow: 1 }}>
                  <h4 style={{ fontWeight: 600, margin: '0 0 6px 0' }}>{item.name}</h4>
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Price per unit: ₹{item.unit_price}</span>
                </div>
                
                {/* Quantity adjustments */}
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
                  <button onClick={() => updateQuantity(item.product_id, item.qty_required - 1)} style={{ padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer' }}>-</button>
                  <span style={{ padding: '0 8px', fontWeight: 'bold' }}>{item.qty_required}</span>
                  <button onClick={() => updateQuantity(item.product_id, item.qty_required + 1)} style={{ padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer' }}>+</button>
                </div>

                <div style={{ width: 100, textAlign: 'right', fontWeight: 'bold' }}>
                  ₹{(item.unit_price * item.qty_required).toFixed(2)}
                </div>

                <button 
                  onClick={() => removeFromCart(item.product_id)} 
                  style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: 8 }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary & Pricing */}
        <div>
          <div style={{ background: 'var(--color-bg-card)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Order Summary</h3>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>GST / Tax (18%)</span>
              <span>₹{taxAmount.toFixed(2)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Shipping</span>
              <span>{shippingCharge === 0 ? 'FREE' : `₹${shippingCharge}`}</span>
            </div>

            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, color: 'var(--color-success)', fontWeight: 500 }}>
                <span>Coupon Discount ({coupon?.code})</span>
                <span>-₹{discount.toFixed(2)}</span>
              </div>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '16px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, fontSize: 18, fontWeight: 800 }}>
              <span>Total</span>
              <span style={{ color: 'var(--color-success)' }}>₹{grandTotal.toFixed(2)}</span>
            </div>

            {/* Promo code form */}
            <form onSubmit={handlePromoSubmit} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <input 
                type="text" 
                placeholder="Apply Coupon Code" 
                className="form-control" 
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                disabled={!!coupon}
              />
              {coupon ? (
                <button type="button" onClick={removeCoupon} className="ecom-btn ecom-btn-secondary" style={{ padding: '8px 12px' }}>Remove</button>
              ) : (
                <button type="submit" className="ecom-btn ecom-btn-primary" style={{ padding: '8px 16px' }}>Apply</button>
              )}
            </form>

            <Link to="/store/checkout" className="ecom-btn ecom-btn-primary ecom-btn-block" style={{ textDecoration: 'none' }}>
              Proceed to Checkout <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
