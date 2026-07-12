import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useEcomAuth } from '../context/EcomAuthContext';
import { storefrontAPI } from '../api/ecomApi';
import { LogOut, User, Package, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AccountPage() {
  const { customer, logout } = useEcomAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) {
      navigate('/store/login');
      return;
    }

    storefrontAPI.getOrders()
      .then(res => {
        if (res.data.success) {
          setOrders(res.data.data);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [customer, navigate]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/store');
  };

  if (!customer) return null;

  return (
    <div className="ecom-container" style={{ margin: '40px auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0 }}>My Account</h1>
          <p style={{ color: 'var(--color-text-muted)', margin: '4px 0 0' }}>Welcome back, {customer.name}!</p>
        </div>
        <button onClick={handleLogout} className="ecom-btn ecom-btn-secondary" style={{ color: 'var(--color-danger)' }}>
          <LogOut size={18} /> Sign Out
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 40 }}>
        {/* Profile Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ background: 'var(--color-bg-card)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
              <User size={20} /> Personal Profile
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>NAME</span>
                <div style={{ fontWeight: 600 }}>{customer.name}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>EMAIL</span>
                <div style={{ fontWeight: 600 }}>{customer.email}</div>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>PHONE</span>
                <div style={{ fontWeight: 600 }}>{customer.phone || 'Not provided'}</div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--color-bg-card)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
              <MapPin size={20} /> Default Delivery Address
            </h3>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
              {customer.addresses || 'No default address configured yet. You can add one during checkout.'}
            </p>
          </div>
        </div>

        {/* Order History */}
        <div style={{ background: 'var(--color-bg-card)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Package size={20} /> Order History ({orders.length})
          </h3>

          {loading ? (
            <div className="loading-center"><div className="loading-spinner"></div></div>
          ) : orders.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px 0' }}>You haven't placed any orders yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {orders.map(order => (
                <div key={order.id} style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <strong style={{ fontSize: 15 }}>{order.orderNumber}</strong>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block' }}>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span style={{
                        background: order.status === 'DELIVERED' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                        color: order.status === 'DELIVERED' ? 'var(--color-success)' : 'var(--color-warning)',
                        fontSize: 12, fontWeight: 'bold', padding: '4px 8px', borderRadius: 4
                      }}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Grand Total:</span>
                    <strong>₹{order.grandTotal.toFixed(2)}</strong>
                  </div>
                  <div style={{ marginTop: 12, textAlign: 'right' }}>
                    <Link to={`/store/track?orderNo=${order.orderNumber}`} style={{ fontSize: 13, color: 'var(--color-success)', textDecoration: 'none', fontWeight: 600 }}>
                      Track Order Status →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
