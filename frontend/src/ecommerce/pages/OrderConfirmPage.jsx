import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, ShoppingBag, ArrowRight } from 'lucide-react';

export default function OrderConfirmPage() {
  const [searchParams] = useSearchParams();
  const orderNo = searchParams.get('orderNo') || 'ECO-12345';

  return (
    <div className="ecom-container" style={{ padding: '80px 0', textAlign: 'center', maxWidth: 600 }}>
      <CheckCircle size={72} style={{ color: 'var(--color-success)', marginBottom: 24 }} />
      <h1 style={{ fontWeight: 800, marginBottom: 12 }}>Order Confirmed!</h1>
      <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', marginBottom: 32 }}>
        Thank you for shopping with TTRIMS. Your order has been placed successfully and synchronized with our processing center.
      </p>

      <div style={{ background: 'var(--color-bg-secondary)', padding: '16px 24px', borderRadius: 8, display: 'inline-block', marginBottom: 40 }}>
        <span style={{ fontSize: 14, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>ORDER NUMBER</span>
        <strong style={{ fontSize: 20, color: 'var(--color-text-primary)' }}>{orderNo}</strong>
      </div>

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
        <Link to="/store/track" className="ecom-btn ecom-btn-primary" style={{ textDecoration: 'none' }}>
          Track Order Status
        </Link>
        <Link to="/store" className="ecom-btn ecom-btn-secondary" style={{ textDecoration: 'none' }}>
          Continue Shopping <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}
