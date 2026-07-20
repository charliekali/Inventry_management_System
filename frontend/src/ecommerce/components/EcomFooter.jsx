import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Globe, CreditCard, Leaf } from 'lucide-react';

export default function EcomFooter() {
  return (
    <footer style={{ background: '#1e293b', color: '#94a3b8', padding: '48px 0 24px', marginTop: 64, borderTop: '4px solid var(--color-primary)' }}>
      <div className="ecom-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 32, marginBottom: 40 }}>
        {/* About TTRIMS */}
        <div>
          <h3 style={{ color: 'white', marginBottom: 16, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Leaf size={20} style={{ color: 'var(--color-accent-orange)', strokeWidth: 2.5 }} /> TTRIMS Marketplace
          </h3>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
            TTRIMS is a premium commerce platform for traceable organic spices, premium blends, and essential food ingredients direct from production to your doorstep.
          </p>
        </div>

        {/* Support & Quick Links */}
        <div>
          <h4 style={{ color: 'white', marginBottom: 16, fontSize: 15, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Support Links</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13.5 }}>
            <li style={{ marginBottom: 10 }}><Link to="/store/shop" style={{ color: 'inherit', textDecoration: 'none' }}>Shop Catalog</Link></li>
            <li style={{ marginBottom: 10 }}><Link to="/store/about" style={{ color: 'inherit', textDecoration: 'none' }}>About Company</Link></li>
            <li style={{ marginBottom: 10 }}><Link to="/store/contact" style={{ color: 'inherit', textDecoration: 'none' }}>Contact & Help</Link></li>
            <li style={{ marginBottom: 10 }}><Link to="/store/track" style={{ color: 'inherit', textDecoration: 'none' }}>Track Your Order</Link></li>
          </ul>
        </div>

        {/* Contact Info Details */}
        <div>
          <h4 style={{ color: 'white', marginBottom: 16, fontSize: 15, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contact Details</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13.5, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <li style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <MapPin size={16} style={{ marginTop: 2, color: 'var(--color-primary)' }} />
              <span>123 Spice Market, Bangalore, India</span>
            </li>
            <li style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Phone size={16} style={{ color: 'var(--color-primary)' }} />
              <span>+91 98765 43210</span>
            </li>
            <li style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Mail size={16} style={{ color: 'var(--color-primary)' }} />
              <span>support@ttrims.com</span>
            </li>
          </ul>
        </div>

        {/* Payment Partner Details */}
        <div>
          <h4 style={{ color: 'white', marginBottom: 16, fontSize: 15, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Secure Shopping</h4>
          <p style={{ fontSize: 13, marginBottom: 14 }}>We accept all major UPI, Cards, and Internet Banking options securely.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ background: '#334155', color: '#fff', fontSize: 10, padding: '4px 8px', borderRadius: 3, fontWeight: 'bold' }}>UPI</span>
            <span style={{ background: '#334155', color: '#fff', fontSize: 10, padding: '4px 8px', borderRadius: 3, fontWeight: 'bold' }}>VISA</span>
            <span style={{ background: '#334155', color: '#fff', fontSize: 10, padding: '4px 8px', borderRadius: 3, fontWeight: 'bold' }}>MASTERCARD</span>
            <span style={{ background: '#334155', color: '#fff', fontSize: 10, padding: '4px 8px', borderRadius: 3, fontWeight: 'bold' }}>COD</span>
          </div>
        </div>
      </div>

      {/* Footer copyright */}
      <div className="ecom-container" style={{ borderTop: '1px solid #334155', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, flexWrap: 'wrap', gap: 12 }}>
        <span>© {new Date().getFullYear()} TTRIMS Storefront. All rights reserved.</span>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ cursor: 'pointer' }}>Privacy Policy</span>
          <span style={{ cursor: 'pointer' }}>Terms of Use</span>
        </div>
      </div>
    </footer>
  );
}
