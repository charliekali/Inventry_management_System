import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Settings } from 'lucide-react';
import ThemeSelector from '../components/ThemeSelector';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@ttrims.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState(localStorage.getItem('customApiUrl') || '');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg">
        <div className="login-blob blob1"></div>
        <div className="login-blob blob2"></div>
        <div className="login-blob blob3"></div>
      </div>

      <div className="login-card">
        {/* Theme and Server Settings in card corner */}
        <div style={{ position: 'absolute', right: 20, top: 20, zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ThemeSelector />
          <button 
            type="button"
            className="btn btn-ghost btn-icon login-settings-btn" 
            onClick={() => setShowSettings(!showSettings)}
            title="Server Settings"
            style={{ padding: 8 }}
          >
            <Settings size={18} color="var(--color-text-muted)" />
          </button>
        </div>

        <div className="login-logo">
          <div className="login-logo-icon">📦</div>
          <div>
            <h1 className="login-title">TTRIMS IMS</h1>
            <p className="login-subtitle">Inventory Management System</p>
          </div>
        </div>

        {showSettings ? (
          <div className="fade-in">
            <div className="login-divider">
              <span>API Server Settings</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">API Base URL</label>
                <input
                  type="text"
                  className="form-control"
                  value={customApiUrl}
                  onChange={e => setCustomApiUrl(e.target.value)}
                  placeholder="e.g. http://192.168.1.100:5000/api"
                />
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                  Fallback defaults: <br/>
                  • Web: <code>http://localhost:5000/api</code> <br/>
                  • Android: <code>http://10.0.2.2:5000/api</code>
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if (customApiUrl.trim()) {
                      localStorage.setItem('customApiUrl', customApiUrl.trim());
                    } else {
                      localStorage.removeItem('customApiUrl');
                    }
                    toast.success('Settings saved. Reloading...');
                    setTimeout(() => window.location.reload(), 800);
                  }}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Save & Reload
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    localStorage.removeItem('customApiUrl');
                    setCustomApiUrl('');
                    toast.success('Restored defaults. Reloading...');
                    setTimeout(() => window.location.reload(), 800);
                  }}
                  style={{ justifyContent: 'center' }}
                >
                  Reset
                </button>
              </div>
              <button
                className="btn btn-ghost"
                onClick={() => setShowSettings(false)}
                style={{ width: '100%', justifyContent: 'center', fontSize: 13, color: 'var(--color-text-secondary)' }}
              >
                Back to Login
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="login-divider">
              <span>Sign in to your account</span>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@ttrims.com"
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                id="login-btn"
              >
                {loading ? (
                  <><div className="loading-spinner" style={{width:18,height:18,borderWidth:2}}></div> Signing in...</>
                ) : 'Sign In'}
              </button>
            </form>

            <p className="login-hint">
              Default credentials: <strong>admin@ttrims.com</strong> / <strong>Admin@123</strong>
            </p>
          </>
        )}
      </div>

      <style>{`
        .login-page {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: var(--color-bg-primary);
        }
        .login-bg { position: absolute; inset: 0; pointer-events: none; }
        .login-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.2;
        }
        .blob1 { width: 500px; height: 500px; background: #3b82f6; top: -200px; left: -150px; }
        .blob2 { width: 400px; height: 400px; background: #8b5cf6; bottom: -150px; right: -100px; }
        .blob3 { width: 300px; height: 300px; background: #06b6d4; top: 50%; left: 50%; transform: translate(-50%,-50%); }
        .login-card {
          background: var(--color-bg-card);
          backdrop-filter: blur(20px);
          border: 1px solid var(--color-border);
          border-radius: 24px;
          padding: 40px;
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 1;
          box-shadow: var(--shadow-lg);
          animation: slideUp 0.4s ease;
        }
        .login-logo {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 28px;
        }
        .login-logo-icon {
          width: 52px;
          height: 52px;
          background: var(--gradient-primary);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          box-shadow: 0 0 24px rgba(59,130,246,0.4);
          flex-shrink: 0;
        }
        .login-title {
          font-size: 22px;
          font-weight: 800;
          color: var(--color-text-primary);
          line-height: 1.1;
        }
        .login-subtitle {
          font-size: 12px;
          color: var(--color-text-muted);
          font-weight: 500;
          letter-spacing: 0.5px;
        }
        .login-divider {
          text-align: center;
          position: relative;
          margin-bottom: 24px;
        }
        .login-divider::before {
          content: '';
          position: absolute;
          left: 0; right: 0; top: 50%;
          height: 1px;
          background: var(--color-border);
        }
        .login-divider span {
          position: relative;
          background: var(--color-bg-card);
          padding: 0 12px;
          font-size: 12.5px;
          color: var(--color-text-muted);
        }
        .login-form { display: flex; flex-direction: column; gap: 16px; }
        .login-hint {
          margin-top: 20px;
          text-align: center;
          font-size: 12px;
          color: var(--color-text-muted);
          line-height: 1.6;
        }
        .login-hint strong { color: var(--color-text-secondary); }
        .login-settings-btn {
          background: transparent !important;
          border: none !important;
          padding: 8px !important;
          cursor: pointer;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        .login-settings-btn:hover {
          background: rgba(255, 255, 255, 0.05) !important;
        }

        /* ── Mobile & APK responsive layout ── */
        @media (max-width: 480px) {
          .login-page {
            background: var(--color-bg-card);
            align-items: flex-start;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
          }
          .login-bg {
            display: none;
          }
          .login-card {
            border-radius: 0;
            border: none;
            box-shadow: none;
            padding: calc(48px + env(safe-area-inset-top, 0px)) 24px calc(28px + env(safe-area-inset-bottom, 0px)) !important;
            max-width: 100%;
            min-height: 100dvh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            backdrop-filter: none;
            background: var(--color-bg-card);
          }
          .login-logo {
            margin-bottom: 24px;
            justify-content: center;
          }
          .login-logo-icon {
            width: 44px;
            height: 44px;
            font-size: 22px;
            border-radius: 12px;
            box-shadow: 0 0 16px rgba(59, 130, 246, 0.35);
          }
          .login-title {
            font-size: 20px;
          }
          .login-subtitle {
            font-size: 11px;
            letter-spacing: 0.2px;
          }
          .login-form {
            gap: 14px;
          }
          .form-group {
            gap: 4px;
          }
          .form-control {
            padding: 11px 14px;
            font-size: 14.5px;
          }
          .login-divider {
            margin-bottom: 20px;
          }
          .login-hint {
            margin-top: 16px;
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
}
