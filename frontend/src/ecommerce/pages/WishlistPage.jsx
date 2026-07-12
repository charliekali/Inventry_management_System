import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../context/EcomAuthContext';
import { useCart } from '../context/CartContext';
import { storefrontAPI } from '../api/ecomApi';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WishlistPage() {
  const { customer } = useEcomAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) {
      navigate('/store/login');
      return;
    }

    storefrontAPI.getWishlist()
      .then(res => {
        if (res.data.success) {
          setWishlist(res.data.data);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [customer, navigate]);

  const handleRemove = async (productId) => {
    try {
      const res = await storefrontAPI.removeFromWishlist(productId);
      if (res.data.success) {
        setWishlist(prev => prev.filter(item => item.product.id !== productId));
        toast.success('Removed from wishlist');
      }
    } catch {
      toast.error('Error removing product');
    }
  };

  const handleAddToCart = (product) => {
    addToCart(product, 1);
    toast.success(`${product.name} added to cart!`);
  };

  if (loading) return <div className="loading-center"><div className="loading-spinner"></div></div>;

  return (
    <div className="ecom-container" style={{ margin: '40px auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32, display: 'flex', gap: 10, alignItems: 'center' }}>
        <Heart size={28} fill="var(--color-danger)" style={{ color: 'var(--color-danger)' }} /> My Wishlist
      </h1>

      {wishlist.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 16, marginBottom: 24 }}>Your wishlist is empty.</p>
          <Link to="/store/shop" className="ecom-btn ecom-btn-primary" style={{ textDecoration: 'none' }}>
            Browse Spices
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
          {wishlist.map(item => {
            const p = item.product;
            return (
              <div key={item.id} style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <img 
                  src={p.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=300'} 
                  alt={p.name} 
                  style={{ width: '100%', height: 180, objectFit: 'cover' }}
                />
                <div style={{ padding: 16, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontWeight: 600 }}>{p.name}</h4>
                  <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 16 }}>₹{p.sellingPrice}</div>
                  
                  <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                    <button onClick={() => handleAddToCart(p)} className="ecom-btn ecom-btn-primary" style={{ flexGrow: 1, padding: 8 }}>
                      <ShoppingCart size={16} /> Add
                    </button>
                    <button onClick={() => handleRemove(p.id)} className="ecom-btn ecom-btn-secondary" style={{ padding: 8, color: 'var(--color-danger)' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
