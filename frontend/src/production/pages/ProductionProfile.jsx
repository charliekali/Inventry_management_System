import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { transactionsAPI } from '../../api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Shield, LogOut, Award, Factory, RefreshCw } from 'lucide-react';

export default function ProductionProfile() {
  const { user, logout, isPermanentSession } = useAuth();
  const navigate = useNavigate();
  const [runsCount, setRunsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadStats = () => {
    setLoading(true);
    transactionsAPI.productionRuns()
      .then(res => {
        const list = res.data.data || [];
        // Filter runs performed by this user
        const myRuns = list.filter(r => r.performed_by === user?.name);
        setRunsCount(myRuns.length);
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
    : 'OP';

  return (
    <div className="p-page p-fade-in">
      {/* Profile Header */}
      <div className="p-card" style={{ background: 'linear-gradient(135deg, var(--p-card), rgba(16,185,129,0.04))' }}>
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div className="p-avatar" style={{ width: 68, height: 68, fontSize: 24, borderWidth: 3, marginBottom: 12, pointerEvents: 'none' }}>
            {initials}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--p-text)' }}>{user?.name || 'Operator'}</h3>
          <span className="p-chip blue" style={{ marginTop: 6, textTransform: 'uppercase' }}>
            <Award size={10} style={{ marginRight: 4 }} /> {user?.role || 'Production Operator'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="p-section-label">📊 Operator Stats</div>
      <div className="p-card p-card-padded">
        {loading ? (
          <div className="p-spinner-wrap" style={{ padding: 12 }}><div className="p-spinner" /></div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="p-kpi-icon green" style={{ width: 44, height: 44, borderRadius: 12 }}>
              <Factory size={22} color="var(--p-primary)" />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{runsCount}</div>
              <div style={{ fontSize: 11, color: 'var(--p-text-2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Runs Executed By Me
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-section-label">👤 Account Details</div>
      <div className="p-card">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--p-border)' }}>
            <User size={16} color="var(--p-text-3)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--p-text-3)', textTransform: 'uppercase' }}>Full Name</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--p-border)' }}>
            <Mail size={16} color="var(--p-text-3)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--p-text-3)', textTransform: 'uppercase' }}>Email Address</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.email}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
            <Shield size={16} color="var(--p-text-3)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--p-text-3)', textTransform: 'uppercase' }}>System Role</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.role}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
        {user?.role === 'Super Admin' && (
          <button className="p-btn primary lg" onClick={() => navigate('/dashboard')} style={{ width: '100%' }}>
            Back to Workspace Hub
          </button>
        )}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button className="p-btn ghost lg" onClick={loadStats} style={{ flex: 1 }}>
            <RefreshCw size={14} /> Sync Stats
          </button>
            <button className="p-btn danger lg" onClick={handleLogout} style={{ flex: 1.2 }}>
              <LogOut size={14} /> Log Out
            </button>
        </div>
      </div>
    </div>
  );
}
