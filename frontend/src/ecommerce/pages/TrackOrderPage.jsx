import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { storefrontAPI } from '../api/ecomApi';
import { Search, Package, MapPin, Truck, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TrackOrderPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const orderNoParam = searchParams.get('orderNo') || '';

  const [orderNo, setOrderNo] = useState(orderNoParam);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async (code) => {
    if (!code) return;
    setLoading(true);
    try {
      const res = await storefrontAPI.trackOrder(code);
      if (res.data.success) {
        setOrder(res.data.data);
      } else {
        toast.error('Order not found.');
      }
    } catch {
      toast.error('Order not found or invalid order number.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderNoParam) {
      fetchStatus(orderNoParam);
    }
  }, [orderNoParam]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!orderNo.trim()) return;
    setSearchParams({ orderNo: orderNo.trim() });
  };

  const steps = ['PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
  const currentStepIdx = order ? steps.indexOf(order.status?.toUpperCase()) : -1;

  return (
    <div className="ecom-container" style={{ margin: '40px auto', maxWidth: 700 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Track Your Order</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: 32 }}>Enter your order number to see real-time dispatch and shipment status.</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, marginBottom: 48 }}>
        <input 
          type="text" 
          placeholder="e.g. ECO-159847293" 
          className="form-control" 
          value={orderNo}
          onChange={(e) => setOrderNo(e.target.value)}
          required
        />
        <button type="submit" className="ecom-btn ecom-btn-primary" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Search size={18} /> Track
        </button>
      </form>

      {loading && <div className="loading-center"><div className="loading-spinner"></div></div>}

      {order && (
        <div style={{ background: 'var(--color-bg-card)', padding: 32, borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <div>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>ORDER NUMBER</span>
              <h3 style={{ margin: 0, fontWeight: 700 }}>{order.orderNumber}</h3>
            </div>
            <div>
              <span style={{
                background: 'var(--color-success-bg)', color: 'var(--color-success)',
                fontSize: 12, fontWeight: 'bold', padding: '6px 12px', borderRadius: 4
              }}>
                {order.status}
              </span>
            </div>
          </div>

          {/* Progress Tracker bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', marginBottom: 40 }}>
            {/* Line connector */}
            <div style={{
              position: 'absolute', top: 20, left: 24, right: 24, height: 4,
              background: 'var(--color-border)', zIndex: 1
            }} />
            <div style={{
              position: 'absolute', top: 20, left: 24, height: 4,
              width: `${(currentStepIdx / (steps.length - 1)) * 100}%`,
              background: 'var(--color-success)', zIndex: 2, transition: 'width 0.4s ease'
            }} />

            {steps.map((step, idx) => {
              const active = idx <= currentStepIdx;
              return (
                <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10, position: 'relative' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: active ? 'var(--color-success)' : 'var(--color-bg-card)',
                    border: `4px solid ${active ? 'var(--color-success-bg)' : 'var(--color-border)'}`,
                    color: active ? 'white' : 'var(--color-text-muted)',
                    display: 'flex', alignItems: 'center', justify: 'center', alignContent: 'center', justifyContent: 'center',
                    fontWeight: 'bold', fontSize: 14,
                    transition: 'all 0.4s ease'
                  }}>
                    {idx + 1}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, marginTop: 8, color: active ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'start', fontSize: 14, lineHeight: 1.5, background: 'var(--color-bg-secondary)', padding: 16, borderRadius: 8 }}>
            <MapPin size={20} style={{ color: 'var(--color-success)', marginTop: 2 }} />
            <div>
              <strong>Delivery Destination</strong>
              <div style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>{order.deliveryAddress}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
