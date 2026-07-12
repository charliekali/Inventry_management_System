import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useEcomAuth } from '../context/EcomAuthContext';
import { storefrontAPI } from '../api/ecomApi';
import toast from 'react-hot-toast';

export default function CheckoutPage() {
  const { cartItems, subtotal, taxAmount, shippingCharge, discount, grandTotal, clearCart } = useCart();
  const { customer } = useEcomAuth();
  const navigate = useNavigate();

  const [address, setAddress] = useState(customer?.addresses || '');
  const [paymentMode, setPaymentMode] = useState('COD');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!address.trim()) {
      toast.error('Delivery Address is required');
      return;
    }
    if (!customer) {
      toast.error('Please login to place an order.');
      navigate('/store/login');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        items: cartItems,
        delivery_address: address.trim(),
        payment_mode: paymentMode,
        subtotal,
        tax_amount: taxAmount,
        shipping_charge: shippingCharge,
        grand_total: grandTotal,
        latitude: 12.9716, // Default fallback GPS
        longitude: 77.5946
      };

      const res = await storefrontAPI.placeOrder(payload);
      if (res.data.success) {
        toast.success('Order placed successfully!');
        clearCart();
        navigate(`/store/order-confirm?orderNo=${res.data.data.orderNumber}`);
      } else {
        toast.error(res.data.message || 'Error placing order');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error processing checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ecom-container" style={{ margin: '40px auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32 }}>Checkout</h1>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 40 }}>
        {/* Shipping details */}
        <div>
          <div style={{ background: 'var(--color-bg-card)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)', marginBottom: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>1. Delivery Address</h3>
            <div className="form-group">
              <label className="form-label">Full Delivery Address *</label>
              <textarea 
                className="form-control" 
                rows="4" 
                placeholder="Enter complete building name, street, city, pin code..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ background: 'var(--color-bg-card)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>2. Payment Mode</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', padding: 12, border: '1px solid var(--color-border)', borderRadius: 8 }}>
                <input 
                  type="radio" 
                  name="paymentMode" 
                  value="COD" 
                  checked={paymentMode === 'COD'}
                  onChange={() => setPaymentMode('COD')}
                />
                <div>
                  <strong>Cash on Delivery (COD)</strong>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Pay with cash or UPI upon delivery</div>
                </div>
              </label>

              <label style={{ display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', padding: 12, border: '1px solid var(--color-border)', borderRadius: 8, opacity: 0.7 }}>
                <input 
                  type="radio" 
                  name="paymentMode" 
                  value="ONLINE" 
                  checked={paymentMode === 'ONLINE'}
                  onChange={() => setPaymentMode('ONLINE')}
                  disabled
                />
                <div>
                  <strong>Online Payment (Razorpay / UPI)</strong>
                  <span style={{ fontSize: 11, background: 'var(--color-warning-bg)', color: 'var(--color-warning)', padding: '2px 6px', borderRadius: 4, marginLeft: 8, fontWeight: 'bold' }}>COMING SOON</span>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Pay securely via Credit Cards, UPI, or Netbanking</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Totals panel */}
        <div>
          <div style={{ background: 'var(--color-bg-card)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Order Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cartItems.map(item => (
                <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span>{item.name} x {item.qty_required}</span>
                  <strong>₹{(item.unit_price * item.qty_required).toFixed(2)}</strong>
                </div>
              ))}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '16px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
              <span>Tax (18% GST)</span>
              <span>₹{taxAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
              <span>Shipping</span>
              <span>{shippingCharge === 0 ? 'FREE' : `₹${shippingCharge}`}</span>
            </div>
            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8, color: 'var(--color-success)' }}>
                <span>Discount</span>
                <span>-₹{discount.toFixed(2)}</span>
              </div>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '16px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, marginBottom: 24 }}>
              <span>Total</span>
              <span style={{ color: 'var(--color-success)' }}>₹{grandTotal.toFixed(2)}</span>
            </div>

            <button 
              type="submit" 
              className="ecom-btn ecom-btn-primary ecom-btn-block"
              disabled={loading || cartItems.length === 0}
            >
              {loading ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
