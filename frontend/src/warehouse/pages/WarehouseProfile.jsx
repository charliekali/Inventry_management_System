import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { transactionsAPI } from '../../api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Shield, LogOut, Award, ClipboardList, RefreshCw } from 'lucide-react';

export default function WarehouseProfile() {
  const { user, logout, isPermanentSession } = useAuth();
  const navigate = useNavigate();
  const [txCount, setTxCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadStats = () => {
    setLoading(true);
    transactionsAPI.list({ limit: 100 })
      .then(res => {
        const list = res.data.data || [];
        // Filter transactions performed by this user
        const myTx = list.filter(tx => tx.performed_by_name === user?.name);
        setTxCount(myTx.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStats();
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch {
      toast.error('Logout failed');
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'WH';

  return (
    <div className="w-page w-fade-in">
      {/* Profile Header */}
      <div className="w-card" style={{ background: 'linear-gradient(135deg, var(--w-card), rgba(37,99,235,0.04))' }}>
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div className="w-avatar" style={{ width: 68, height: 68, fontSize: 24, borderWidth: 3, marginBottom: 12, pointerEvents: 'none' }}>
            {initials}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--w-text)' }}>{user?.name || 'Keeper'}</h3>
          <span className="w-chip blue" style={{ marginTop: 6, textTransform: 'uppercase' }}>
            <Award size={10} style={{ marginRight: 4 }} /> {user?.role || 'Warehouse Manager'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="w-section-label">📊 My Performance Stats</div>
      <div className="w-card w-card-padded">
        {loading ? (
          <div className="w-spinner-wrap" style={{ padding: 12 }}><div className="w-spinner" /></div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="w-kpi-icon blue" style={{ width: 44, height: 44, borderRadius: 12 }}>
              <ClipboardList size={22} color="var(--w-primary)" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{txCount}</div>
              <div style={{ fontSize: 11, color: 'var(--w-text-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Stock Entries Recorded
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="w-section-label">👤 Account Details</div>
      <div className="w-card">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--w-border)' }}>
            <User size={16} color="var(--w-text-3)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--w-text-3)', textTransform: 'uppercase' }}>Full Name</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--w-border)' }}>
            <Mail size={16} color="var(--w-text-3)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--w-text-3)', textTransform: 'uppercase' }}>Email Address</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.email}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
            <Shield size={16} color="var(--w-text-3)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--w-text-3)', textTransform: 'uppercase' }}>System Role</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.role}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
        {user?.role === 'Super Admin' && (
          <button className="w-btn primary lg" onClick={() => navigate('/dashboard')} style={{ width: '100%' }}>
            Back to Workspace Hub
          </button>
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button className="w-btn ghost lg" onClick={loadStats} style={{ flex: 1 }}>
            <RefreshCw size={14} /> Sync Stats
          </button>
            <button className="w-btn danger lg" onClick={handleLogout} style={{ flex: 1.2 }}>
              <LogOut size={14} /> Log Out
            </button>
        </div>
      </div>
    </div>
  );
}
