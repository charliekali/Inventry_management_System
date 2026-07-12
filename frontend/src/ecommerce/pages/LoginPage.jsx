import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useEcomAuth } from '../context/EcomAuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useEcomAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    try {
      const res = await login(email.trim(), password);
      if (res.success) {
        toast.success('Logged in successfully!');
        navigate('/store');
      } else {
        toast.error(res.message || 'Login failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 24, background: 'var(--color-bg-card)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
      <h2 style={{ fontWeight: 800, textAlign: 'center', marginBottom: 24 }}>Customer Login</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input 
            type="email" 
            className="form-control" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
        </div>

        <div className="form-group" style={{ margin: '16px 0 24px 0' }}>
          <label className="form-label">Password</label>
          <input 
            type="password" 
            className="form-control" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
        </div>

        <button type="submit" className="ecom-btn ecom-btn-primary ecom-btn-block" disabled={loading}>
          {loading ? 'Logging in...' : 'Sign In'}
        </button>
      </form>

      <div style={{ marginTop: 24, textAlign: 'center', fontSize: 14 }}>
        Don't have an account? <Link to="/store/register" style={{ color: 'var(--color-success)', fontWeight: 600 }}>Register here</Link>
      </div>
    </div>
  );
}
