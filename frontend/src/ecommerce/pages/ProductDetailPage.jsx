import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { storefrontAPI } from '../api/ecomApi';
import { useCart } from '../context/CartContext';
import { Star, ShieldCheck, Heart, Truck, AlertCircle, ShoppingCart, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pincode, setPincode] = useState('');
  const [deliveryMessage, setDeliveryMessage] = useState('');

  useEffect(() => {
    setLoading(true);
    storefrontAPI.getProduct(id)
      .then(res => setProduct(res.data.data))
      .catch(err => {
        console.error(err);
        toast.error("Product not found");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart({
      id: product.id,
      code: product.code,
      name: product.name,
      selling_price: product.discount_price || product.price || product.selling_price || 0,
      image_url: product.image_url,
      weight: product.weight || 0,
      unit: product.unit || 'PCS'
    }, 1);
    toast.success("Added to Shopping Cart!");
  };

  const handleBuyNow = () => {
    handleAddToCart();
    navigate('/store/cart');
  };

  const handlePincodeCheck = (e) => {
    e.preventDefault();
    if (pincode.length === 6 && /^\d+$/.test(pincode)) {
      setDeliveryMessage("✓ Express delivery in 2-3 Days to this pincode.");
    } else {
      setDeliveryMessage("✗ Invalid pincode. Please enter a valid 6-digit PIN.");
    }
  };

  if (loading) {
    return <div className="ecom-container loading-center" style={{ minHeight: '60vh' }}><div className="loading-spinner"></div></div>;
  }

  if (!product) {
    return (
      <div className="ecom-container" style={{ textAlign: 'center', padding: '64px 0' }}>
        <AlertCircle size={48} style={{ color: 'var(--color-accent-red)', marginBottom: 16 }} />
        <h2>Product Not Found</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>This product may have been deactivated or hidden.</p>
      </div>
    );
  }

  const finalPrice = product.discount_price || product.price || product.selling_price || 0;
  const originalPrice = product.price || product.selling_price || 0;
  const hasDiscount = originalPrice > finalPrice;
  const discountPercent = hasDiscount ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100) : 0;

  return (
    <div className="ecom-container">
      <div className="detail-grid">
        {/* Left Side: Product Image & Quick Buttons */}
        <div className="detail-image-panel">
          <div className="detail-image-container">
            <img 
              src={product.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=600'} 
              alt={product.name} 
              className="detail-image"
            />
          </div>
          
          {/* Action CTAs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
            <button 
              onClick={handleAddToCart}
              className="ecom-btn"
              style={{ background: 'var(--color-accent-orange)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 }}
            >
              <ShoppingCart size={18} /> Add to Cart
            </button>
            <button 
              onClick={handleBuyNow}
              className="ecom-btn"
              style={{ background: 'var(--color-accent-red)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48 }}
            >
              <Zap size={18} /> Buy Now
            </button>
          </div>
        </div>

        {/* Right Side: Product Details & Specs */}
        <div className="detail-info">
          <span className="detail-brand">{product.brand || 'TTRIMS Spices'}</span>
          <h1 className="detail-title">{product.name}</h1>
          
          {/* Ratings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#388e3c', color: 'white', padding: '2px 8px', borderRadius: 3, fontSize: 12, fontWeight: 'bold' }}>
              4.5 <Star size={12} fill="currentColor" />
            </div>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 600 }}>128 Ratings & 45 Reviews</span>
          </div>

          {/* Pricing Info */}
          <div className="detail-price-panel">
            <div className="detail-price-row">
              <span className="detail-price">₹{finalPrice.toFixed(2)}</span>
              {hasDiscount && (
                <>
                  <span className="detail-old-price">₹{originalPrice.toFixed(2)}</span>
                  <span className="detail-discount">{discountPercent}% Off</span>
                </>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 6, fontWeight: 500 }}>Inclusive of all taxes</div>
          </div>

          {/* Pack Options */}
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', marginBottom: 12, color: '#212121' }}>Pack Size</h4>
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ border: '2px solid var(--color-primary)', padding: '6px 16px', borderRadius: 4, fontSize: 13, fontWeight: 'bold', color: 'var(--color-primary)', cursor: 'pointer' }}>
                {product.pack_size_g ? `${product.pack_size_g}g` : `${product.weight || 100}g`}
              </span>
            </div>
          </div>

          {/* Delivery Pincode Estimator */}
          <div style={{ border: '1px solid var(--color-border)', padding: 16, borderRadius: 4, marginBottom: 24 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', marginBottom: 10, color: '#212121' }}>Delivery Options</h4>
            <form onSubmit={handlePincodeCheck} style={{ display: 'flex', gap: 8 }}>
              <input 
                type="text" 
                maxLength="6"
                placeholder="Enter 6-Digit Delivery Pincode"
                value={pincode}
                onChange={e => setPincode(e.target.value)}
                style={{ flexGrow: 1, padding: '8px 12px', borderRadius: 4, border: '1px solid var(--color-border)', outline: 'none', fontSize: 13 }}
              />
              <button type="submit" className="ecom-btn ecom-btn-outline" style={{ padding: '8px 16px', fontSize: 13 }}>Check</button>
            </form>
            {deliveryMessage && (
              <div style={{ fontSize: 13, marginTop: 10, fontWeight: 600, color: deliveryMessage.startsWith('✓') ? '#388e3c' : 'var(--color-accent-red)' }}>
                {deliveryMessage}
              </div>
            )}
          </div>

          {/* Description */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, borderBottom: '1px solid #eee', paddingBottom: 8 }}>Product Description</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              {product.description || 'No detailed description configured for this product. Fully organic processing is maintained under hygienic standards.'}
            </p>
          </div>

          {/* Specifications Table */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, borderBottom: '1px solid #eee', paddingBottom: 8 }}>Specifications</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 0', color: 'var(--color-text-secondary)', width: 140 }}>Code</td>
                  <td style={{ padding: '8px 0', fontWeight: 500, color: '#212121' }}>{product.code}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 0', color: 'var(--color-text-secondary)' }}>Category</td>
                  <td style={{ padding: '8px 0', fontWeight: 500, color: '#212121' }}>{product.category || 'Spices'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 0', color: 'var(--color-text-secondary)' }}>Shelf Life</td>
                  <td style={{ padding: '8px 0', fontWeight: 500, color: '#212121' }}>{product.shelf_life || '12 Months'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 0', color: 'var(--color-text-secondary)' }}>Country of Origin</td>
                  <td style={{ padding: '8px 0', fontWeight: 500, color: '#212121' }}>{product.country_of_origin || 'India'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '8px 0', color: 'var(--color-text-secondary)' }}>Ingredients</td>
                  <td style={{ padding: '8px 0', fontWeight: 500, color: '#212121' }}>{product.ingredients || 'Organic ingredients'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
