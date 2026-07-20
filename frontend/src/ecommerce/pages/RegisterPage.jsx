import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useEcomAuth } from '../context/EcomAuthContext';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useEcomAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;

    setLoading(true);
    try {
      const res = await register(name.trim(), email.trim(), password, phone.trim());
      if (res.success) {
        toast.success('Registration successful!');
        navigate('/store');
      } else {
        toast.error(res.message || 'Registration failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error during registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 28, background: 'var(--color-bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)' }}>
      <h2 style={{ fontWeight: 800, textAlign: 'center', marginBottom: 24, fontSize: '22px' }}>Customer Registration</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="ecom-form-group">
          <label className="ecom-form-label">Full Name</label>
          <input 
            type="text" 
            className="ecom-form-control" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            required 
          />
        </div>

        <div className="ecom-form-group">
          <label className="ecom-form-label">Email Address</label>
          <input 
            type="email" 
            className="ecom-form-control" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
        </div>

        <div className="ecom-form-group">
          <label className="ecom-form-label">Phone Number</label>
          <input 
            type="text" 
            className="ecom-form-control" 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
          />
        </div>

        <div className="ecom-form-group">
          <label className="ecom-form-label">Password</label>
          <input 
            type="password" 
            className="ecom-form-control" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
        </div>

        <button type="submit" className="ecom-btn ecom-btn-primary ecom-btn-block" disabled={loading} style={{ height: 44, borderRadius: 3, marginTop: 10 }}>
          {loading ? 'Creating Account...' : 'Register'}
        </button>
      </form>

      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13.5, fontWeight: 500 }}>
        Already have an account? <Link to="/store/login" style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}>Login here</Link>
      </div>
    </div>
  );
}
