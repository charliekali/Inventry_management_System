import { createContext, useContext, useState, useEffect } from 'react';
import { storefrontAPI } from '../api/ecomApi';
import { useEcomAuth } from './EcomAuthContext';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [cartItems, setCartItems] = useState([]);
  const [coupon, setCoupon] = useState(null);
  const { customer } = useEcomAuth();

  // Load initial cart
  useEffect(() => {
    if (customer) {
      storefrontAPI.getCart()
        .then(res => {
          if (res.data.success) {
            try {
              setCartItems(JSON.parse(res.data.data) || []);
            } catch {
              setCartItems([]);
            }
          }
        })
        .catch(() => {
          const local = localStorage.getItem('ecomCart');
          if (local) setCartItems(JSON.parse(local));
        });
    } else {
      const local = localStorage.getItem('ecomCart');
      if (local) {
        setCartItems(JSON.parse(local));
      }
    }
  }, [customer]);

  // Sync local changes to localStorage and Backend
  useEffect(() => {
    localStorage.setItem('ecomCart', JSON.stringify(cartItems));
    if (customer) {
      storefrontAPI.updateCart(JSON.stringify(cartItems)).catch(() => {});
    }
  }, [cartItems, customer]);

  const addToCart = (product, quantity = 1) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product_id === product.id
            ? { ...item, qty_required: Math.min(product.max_order_qty || 100, item.qty_required + quantity) }
            : item
        );
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        qty_required: Math.max(product.min_order_qty || 1, quantity),
        unit_price: product.discount_price || product.price,
        image_url: product.image_url,
        unit: product.unit || 'PCS'
      }];
    });
  };

  const updateQuantity = (productId, qty) => {
    setCartItems(prev =>
      prev.map(item =>
        item.product_id === productId
          ? { ...item, qty_required: Math.max(1, qty) }
          : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCartItems(prev => prev.filter(item => item.product_id !== productId));
  };

  const clearCart = () => {
    setCartItems([]);
    setCoupon(null);
  };

  const applyCouponCode = async (code) => {
    try {
      const res = await storefrontAPI.applyCoupon(code);
      if (res.data.success) {
        setCoupon(res.data.coupon);
        return { success: true, message: 'Coupon applied successfully' };
      }
      return { success: false, message: 'Invalid coupon' };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Error applying coupon' };
    }
  };

  const removeCoupon = () => setCoupon(null);

  // Subtotal, Tax, Shipping & Grand Total calculations
  const subtotal = cartItems.reduce((sum, item) => sum + (item.unit_price * item.qty_required), 0);
  const taxAmount = Math.round((subtotal * 0.18) * 100) / 100; // 18% GST default

  let discount = 0;
  if (coupon) {
    if (subtotal >= coupon.min_order_amount) {
      if (coupon.discount_type === 'PERCENTAGE') {
        discount = Math.min(coupon.max_discount_amount, (subtotal * coupon.discount_value) / 100);
      } else {
        discount = Math.min(coupon.max_discount_amount, coupon.discount_value);
      }
    }
  }

  const shippingCharge = subtotal > 1000 || subtotal === 0 ? 0 : 150; // Free shipping above 1000
  const grandTotal = Math.max(0, Math.round((subtotal + taxAmount + shippingCharge - discount) * 100) / 100);

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      subtotal,
      taxAmount,
      shippingCharge,
      discount,
      grandTotal,
      coupon,
      applyCouponCode,
      removeCoupon
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
