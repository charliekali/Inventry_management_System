import { Link } from 'react-router-dom';

export default function EcomFooter() {
  return (
    <footer style={{ background: '#111827', color: '#9ca3af', padding: '64px 0 32px', marginTop: 80 }}>
      <div className="ecom-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 40, marginBottom: 48 }}>
        <div>
          <h3 style={{ color: 'white', marginBottom: 16, fontWeight: 700 }}>TTRIMS Store</h3>
          <p style={{ fontSize: 14, lineHeight: 1.6 }}>Your premium source for B2B/B2C high-quality spices, grains, and kitchen ingredients direct from warehouses.</p>
        </div>
        <div>
          <h4 style={{ color: 'white', marginBottom: 16 }}>Quick Links</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ marginBottom: 8 }}><Link to="/store/shop" style={{ color: 'inherit', textDecoration: 'none' }}>All Products</Link></li>
            <li style={{ marginBottom: 8 }}><Link to="/store/about" style={{ color: 'inherit', textDecoration: 'none' }}>About Us</Link></li>
            <li style={{ marginBottom: 8 }}><Link to="/store/contact" style={{ color: 'inherit', textDecoration: 'none' }}>Contact Support</Link></li>
            <li style={{ marginBottom: 8 }}><Link to="/store/track-order" style={{ color: 'inherit', textDecoration: 'none' }}>Track Your Order</Link></li>
          </ul>
        </div>
        <div>
          <h4 style={{ color: 'white', marginBottom: 16 }}>Categories</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ marginBottom: 8 }}>Spices & Seasoning</li>
            <li style={{ marginBottom: 8 }}>Flours & Grains</li>
            <li style={{ marginBottom: 8 }}>Herbs & Blends</li>
            <li style={{ marginBottom: 8 }}>Bulk Raw Materials</li>
          </ul>
        </div>
        <div>
          <h4 style={{ color: 'white', marginBottom: 16 }}>Subscribe</h4>
          <p style={{ fontSize: 13, marginBottom: 16 }}>Get updates on special offers and wholesale pricing details.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="email" placeholder="Enter your email" className="form-control" style={{ background: '#1f2937', border: '1px solid #374151', color: 'white' }} />
            <button className="ecom-btn ecom-btn-primary" style={{ padding: '8px 16px' }}>Join</button>
          </div>
        </div>
      </div>
      <div className="ecom-container" style={{ borderTop: '1px solid #1f2937', paddingTop: 24, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span>© 2026 TTRIMS Store. All rights reserved.</span>
        <div style={{ display: 'flex', gap: 16 }}>
          <span>Privacy Policy</span>
          <span>Terms & Conditions</span>
        </div>
      </div>
    </footer>
  );
}
