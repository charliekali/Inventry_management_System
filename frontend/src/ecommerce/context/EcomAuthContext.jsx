import { createContext, useContext, useState, useEffect } from 'react';
import { storefrontAPI } from '../api/ecomApi';

const EcomAuthContext = createContext(null);

export function EcomAuthProvider({ children }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ecomCustomerToken');
    if (token) {
      storefrontAPI.getProfile()
        .then(res => {
          if (res.data.success) {
            setCustomer(res.data.customer);
          } else {
            logout();
          }
        })
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await storefrontAPI.login(email, password);
    if (res.data.success) {
      localStorage.setItem('ecomCustomerToken', res.data.token);
      setCustomer(res.data.customer);
    }
    return res.data;
  };

  const register = async (name, email, password, phone) => {
    const res = await storefrontAPI.register(name, email, password, phone);
    if (res.data.success) {
      localStorage.setItem('ecomCustomerToken', res.data.token);
      setCustomer(res.data.customer);
    }
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('ecomCustomerToken');
    setCustomer(null);
  };

  const updateProfile = async (data) => {
    const res = await storefrontAPI.updateProfile(data);
    if (res.data.success) {
      setCustomer(res.data.customer);
    }
    return res.data;
  };

  return (
    <EcomAuthContext.Provider value={{ customer, loading, login, register, logout, updateProfile }}>
      {children}
    </EcomAuthContext.Provider>
  );
}

export const useEcomAuth = () => useContext(EcomAuthContext);
