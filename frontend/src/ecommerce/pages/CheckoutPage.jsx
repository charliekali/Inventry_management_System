import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useEcomAuth } from '../context/EcomAuthContext';
import { storefrontAPI } from '../api/ecomApi';
import { MapPin, CreditCard, ShoppingBag, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CheckoutPage() {
  const { cartItems, subtotal, taxAmount, shippingCharge, discount, grandTotal, clearCart } = useCart();
  const { customer } = useEcomAuth();
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(1); // 1: Address, 2: Payment, 3: Review
  const [address, setAddress] = useState(customer?.addresses || '');
  const [paymentMode, setPaymentMode] = useState('COD');
  const [loading, setLoading] = useState(false);

  const handleNextStep = () => {
    if (activeStep === 1 && !address.trim()) {
      toast.error('Delivery Address is required');
      return;
    }
    setActiveStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setActiveStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
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
    <div className="ecom-container">
      {/* Checkout Steps Header */}
      <div className="checkout-steps">
        <div className={`checkout-step ${activeStep >= 1 ? 'active' : ''}`}>
          <span className="checkout-step-number">1</span>
          <span>Delivery Address</span>
        </div>
        <div style={{ height: 1, flexGrow: 1, background: 'var(--color-border)', margin: '0 16px' }}></div>
        <div className={`checkout-step ${activeStep >= 2 ? 'active' : ''}`}>
          <span className="checkout-step-number">2</span>
          <span>Payment Method</span>
        </div>
        <div style={{ height: 1, flexGrow: 1, background: 'var(--color-border)', margin: '0 16px' }}></div>
        <div className={`checkout-step ${activeStep >= 3 ? 'active' : ''}`}>
          <span className="checkout-step-number">3</span>
          <span>Review & Confirm</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'flex-start' }}>
        {/* Step Body */}
        <div style={{ background: 'var(--color-bg-surface)', padding: 24, borderRadius: 4, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border)' }}>
          {activeStep === 1 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={18} style={{ color: 'var(--color-primary)' }} /> Shipping Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Full Delivery Address *</label>
                <textarea 
                  rows="4" 
                  placeholder="Enter complete building name, street, city, landmark, pin code..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid var(--color-border)', padding: 12, borderRadius: 4, outline: 'none', fontSize: 14, fontFamily: 'inherit' }}
                  required
                />
              </div>
              <button onClick={handleNextStep} className="ecom-btn ecom-btn-primary" style={{ width: '100%', height: 48, borderRadius: 3 }}>
                Proceed to Payment
              </button>
            </div>
          )}

          {activeStep === 2 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CreditCard size={18} style={{ color: 'var(--color-primary)' }} /> Select Payment Method
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                <label style={{ display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', padding: 16, border: paymentMode === 'COD' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', borderRadius: 4, background: paymentMode === 'COD' ? 'rgba(40,116,240,0.02)' : 'transparent' }}>
                  <input 
                    type="radio" 
                    name="paymentMode" 
                    value="COD" 
                    checked={paymentMode === 'COD'}
                    onChange={() => setPaymentMode('COD')}
                  />
                  <div>
                    <strong style={{ fontSize: 14 }}>Cash on Delivery (COD)</strong>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>Pay with cash/UPI at the time of delivery</div>
                  </div>
                </label>

                <label style={{ display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', padding: 16, border: paymentMode === 'ONLINE' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)', borderRadius: 4, background: paymentMode === 'ONLINE' ? 'rgba(40,116,240,0.02)' : 'transparent' }}>
                  <input 
                    type="radio" 
                    name="paymentMode" 
                    value="ONLINE" 
                    checked={paymentMode === 'ONLINE'}
                    onChange={() => setPaymentMode('ONLINE')}
                  />
                  <div>
                    <strong style={{ fontSize: 14 }}>Paytm / Net Banking / Credit Card</strong>
                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>Instant secure redirection (Gateway simulator)</div>
                  </div>
                </label>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={handlePrevStep} className="ecom-btn ecom-btn-outline" style={{ flexGrow: 1, height: 48, borderRadius: 3 }}>
                  Back to Address
                </button>
                <button onClick={handleNextStep} className="ecom-btn ecom-btn-primary" style={{ flexGrow: 1, height: 48, borderRadius: 3 }}>
                  Review Order
                </button>
              </div>
            </div>
          )}

          {activeStep === 3 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, textTransform: 'uppercase', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingBag size={18} style={{ color: 'var(--color-primary)' }} /> Review and Confirm Order
              </h3>
              
              <div style={{ background: '#f9f9f9', padding: 16, borderRadius: 4, marginBottom: 24, fontSize: 14 }}>
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Deliver To</strong>
                  <div style={{ color: '#212121', lineHeight: 1.5 }}>{address}</div>
                </div>
                <div>
                  <strong style={{ textTransform: 'uppercase', fontSize: 11, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}>Payment Mode</strong>
                  <div style={{ color: '#212121', fontWeight: 600 }}>{paymentMode === 'COD' ? 'Cash on Delivery' : 'Online Gateway Redirect'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={handlePrevStep} className="ecom-btn ecom-btn-outline" style={{ flexGrow: 1, height: 48, borderRadius: 3 }}>
                  Back to Payment
                </button>
                <button 
                  onClick={handleSubmit} 
                  disabled={loading}
                  className="ecom-btn ecom-btn-primary" 
                  style={{ flexGrow: 1, height: 48, borderRadius: 3 }}
                >
                  {loading ? 'Processing...' : 'Confirm and Place Order'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Order summary details */}
        <div className="cart-summary-panel">
          <h3 style={{ fontSize: 15, fontWeight: 700, textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)', paddingBottom: 12, marginBottom: 16, color: 'var(--color-text-secondary)' }}>
            Checkout Summary
          </h3>
          
          <div className="cart-summary-row">
            <span>Subtotal</span>
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

          <div className="cart-summary-row cart-summary-total" style={{ borderTop: '1px dashed var(--color-border)', paddingTop: 16, marginTop: 16 }}>
            <span>Order Total</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 20 }}>
            <ShieldCheck size={16} /> 100% Secure Checkout Guaranteed
          </div>
        </div>
      </div>
    </div>
  );
}
