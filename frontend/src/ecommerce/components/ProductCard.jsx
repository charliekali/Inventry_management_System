import { Link } from 'react-router-dom';
import { Heart, ShoppingCart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();
  const [isWishlisted, setIsWishlisted] = useState(false);

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, 1);
    toast.success(`${product.name} added to cart!`);
  };

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWishlisted(!isWishlisted);
    toast.success(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist');
  };

  const price = product.price || 0;
  const discountPrice = product.discount_price;
  const hasDiscount = discountPrice && discountPrice < price;

  return (
    <div className="product-card">
      <Link to={`/store/product/${product.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="product-card-image-wrapper">
          <img 
            src={product.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400'} 
            alt={product.name} 
            className="product-card-image"
          />
          {hasDiscount && (
            <div className="product-card-badge">
              {Math.round(((price - discountPrice) / price) * 100)}% OFF
            </div>
          )}
          <button 
            type="button" 
            className={`product-card-wishlist ${isWishlisted ? 'active' : ''}`}
            onClick={handleWishlist}
          >
            <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="product-card-content">
          <span className="product-card-category">{product.category || 'Spices'}</span>
          <h4 className="product-card-title">{product.name}</h4>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '8px 0', fontSize: 13, color: '#f59e0b' }}>
            ★ ★ ★ ★ ☆ <span style={{ color: 'var(--color-text-muted)', marginLeft: 4 }}>(4.2)</span>
          </div>

          <div className="product-card-price-row">
            {hasDiscount ? (
              <>
                <span className="product-card-price">₹{discountPrice}</span>
                <span className="product-card-old-price">₹{price}</span>
              </>
            ) : (
              <span className="product-card-price">₹{price}</span>
            )}
          </div>

          <button 
            type="button"
            className="ecom-btn ecom-btn-primary ecom-btn-block" 
            onClick={handleAdd}
            style={{ padding: '8px 16px', fontSize: 14 }}
          >
            <ShoppingCart size={16} /> Add to Cart
          </button>
        </div>
      </Link>
    </div>
  );
}
