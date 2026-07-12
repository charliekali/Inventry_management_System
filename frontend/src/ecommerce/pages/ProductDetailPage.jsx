import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Heart, Shield, Award, Sparkles } from 'lucide-react';
import { storefrontAPI } from '../api/ecomApi';
import { useCart } from '../context/CartContext';
import toast from 'react-hot-toast';

export default function ProductDetailPage() {
  const { id } = useParams();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    setLoading(true);
    storefrontAPI.getProduct(id)
      .then(res => {
        setProduct(res.data.data);
        setReviews(res.data.data.reviews || []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  const handleAdd = () => {
    if (product) {
      addToCart(product, qty);
      toast.success(`${product.name} added to cart!`);
    }
  };

  if (loading) return <div className="loading-center"><div className="loading-spinner"></div></div>;
  if (!product) return <div className="ecom-container" style={{ padding: '64px 0', textAlign: 'center' }}><h2>Product not found</h2></div>;

  const price = product.price || 0;
  const discountPrice = product.discount_price;
  const hasDiscount = discountPrice && discountPrice < price;

  return (
    <div className="ecom-container">
      <div className="detail-grid">
        {/* Left Side: Product Image */}
        <div className="detail-image-panel">
          <img 
            src={product.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=600'} 
            alt={product.name} 
            className="detail-image"
          />
        </div>

        {/* Right Side: Product Details */}
        <div className="detail-info">
          <span className="detail-brand">{product.brand || 'Generic'}</span>
          <h1 className="detail-title">{product.name}</h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 0', color: '#f59e0b' }}>
            ★ ★ ★ ★ ☆ <span style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>(4.2 Rating)</span>
          </div>

          <div className="detail-price-panel">
            {hasDiscount ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-success)' }}>₹{discountPrice}</span>
                <span style={{ fontSize: 18, color: 'var(--color-text-muted)', textDecoration: 'line-through' }}>₹{price}</span>
                <span style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', fontSize: 12, padding: '4px 8px', borderRadius: 4, fontWeight: 'bold' }}>
                  {Math.round(((price - discountPrice) / price) * 100)}% OFF
                </span>
              </div>
            ) : (
              <span style={{ fontSize: 28, fontWeight: 800 }}>₹{price}</span>
            )}
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '8px 0 0' }}>Prices are inclusive of {product.gst_percent || 18}% GST.</p>
          </div>

          <p style={{ lineHeight: 1.6, marginBottom: 24 }}>{product.description || 'No description available for this finished product.'}</p>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="ecom-btn ecom-btn-secondary" style={{ padding: 12, borderRadius: 0 }}>-</button>
              <span style={{ padding: '0 16px', fontWeight: 600 }}>{qty}</span>
              <button onClick={() => setQty(q => Math.min(product.max_order_qty || 100, q + 1))} className="ecom-btn ecom-btn-secondary" style={{ padding: 12, borderRadius: 0 }}>+</button>
            </div>
            <button onClick={handleAdd} className="ecom-btn ecom-btn-primary" style={{ flexGrow: 1 }}>
              <ShoppingCart size={20} /> Add to Cart
            </button>
          </div>

          {/* Product trust tags */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
              <Shield size={20} style={{ color: 'var(--color-success)' }} /> Safe Packaging
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
              <Award size={20} style={{ color: 'var(--color-success)' }} /> Quality Inspected
            </div>
          </div>
        </div>
      </div>

      {/* Reviews section */}
      <section style={{ marginTop: 64 }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Customer Reviews ({reviews.length})</h3>
        {reviews.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>No reviews yet. Be the first to review!</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {reviews.map(r => (
              <div key={r.id} style={{ background: 'var(--color-bg-card)', padding: 20, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong>{r.customerName}</strong>
                  <span style={{ color: '#f59e0b' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                </div>
                <h5 style={{ fontWeight: 600, margin: '0 0 8px 0' }}>{r.title}</h5>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)' }}>{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
