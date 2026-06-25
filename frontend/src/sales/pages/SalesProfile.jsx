/**
 * SalesProfile.jsx — Profile Module (Mobile-First)
 * Stats summary (my total sales volume, collections, logged CRM calls) and user account settings.
 * Secure logout functionality.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ordersAPI } from '../../api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  User, Mail, Shield, LogOut, Award, ShoppingBag,
  Wallet, PhoneCall, RefreshCw, BarChart2, Star
} from 'lucide-react';

function fmtCurrency(v) {
  return '₹' + (v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function SalesProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    myOrdersCount: 0,
    mySalesVolume: 0,
    myCollectionsToday: 0,
    myCollectionsTotal: 0,
    myFollowupsLogged: 0
  });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const [ordRes, invRes] = await Promise.all([
        ordersAPI.list(),
        ordersAPI.listInvoices()
      ]);

      const ordList = ordRes.data.data || [];
      const invList = invRes.data.data || [];

      // Filter orders created by me
      const myOrders = ordList.filter(o => o.created_by_name === user?.name);
      const mySalesVol = myOrders.reduce((sum, o) => sum + (o.grand_total || 0), 0);

      // Filter and load payment histories to count my collections
      const paidInvoices = invList.filter(inv => (inv.paid_amount || 0) > 0);
      const histories = await Promise.all(
        paidInvoices.map(async (inv) => {
          try {
            const hRes = await ordersAPI.getPaymentHistory(inv.id);
            return (hRes.data.data.history || []).map(tx => ({
              ...tx,
              invoice_id: inv.id
            }));
          } catch (_) {
            return [];
          }
        })
      );
      const allTx = histories.flat();
      const myTx = allTx.filter(tx => tx.recorded_by === user?.name);
      
      const myCollTotal = myTx.reduce((sum, tx) => sum + tx.amount, 0);
      const myCollToday = myTx
        .filter(tx => new Date(tx.recorded_at).toDateString() === new Date().toDateString())
        .reduce((sum, tx) => sum + tx.amount, 0);

      // Load CRM followups logged by me
      const crmInvoices = invList.filter(inv => inv.latest_follow_up_status);
      const followUpHistories = await Promise.all(
        crmInvoices.map(async (inv) => {
          try {
            const fRes = await ordersAPI.getFollowUps(inv.id);
            return (fRes.data.data.followups || []);
          } catch (_) {
            return [];
          }
        })
      );
      const allFollowUps = followUpHistories.flat();
      const myFollowUps = allFollowUps.filter(fu => fu.recorded_by === user?.name);

      setStats({
        myOrdersCount: myOrders.length,
        mySalesVolume: mySalesVol,
        myCollectionsToday: myCollToday,
        myCollectionsTotal: myCollTotal,
        myFollowupsLogged: myFollowUps.length
      });
    } catch (err) {
      toast.error('Failed to compile performance metrics');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (e) {
      toast.error('Logout failed');
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'SP';

  return (
    <div className="s-page s-fade-in">
      {/* Profile Header */}
      <div className="s-card s-mb-16" style={{ background: 'linear-gradient(135deg, var(--s-card), rgba(59,130,246,0.05))' }}>
        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div className="s-avatar" style={{ width: 68, height: 68, fontSize: 24, borderWidth: 3, marginBottom: 12, pointerEvents: 'none' }}>
            {initials}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--s-text)' }}>{user?.name || 'Sales Representative'}</h3>
          <span className="s-chip blue" style={{ marginTop: 6, textTransform: 'uppercase' }}>
            <Award size={10} style={{ marginRight: 4 }} /> {user?.role || 'Sales Representative'}
          </span>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="s-section-label">📊 My Performance Stats</div>
      
      {loading ? (
        <div className="s-spinner-wrap" style={{ padding: 24 }}>
          <div className="s-spinner" />
        </div>
      ) : (
        <div className="s-kpi-row" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 20 }}>
          <div className="s-kpi blue">
            <div className="s-kpi-icon blue"><ShoppingBag size={14} color="#3b82f6" /></div>
            <div className="s-kpi-val sm">{stats.myOrdersCount}</div>
            <div className="s-kpi-label">Orders Placed</div>
            <div style={{ fontSize: 10, color: 'var(--s-text-3)', marginTop: 4 }}>Total Vol: {fmtCurrency(stats.mySalesVolume)}</div>
          </div>
          <div className="s-kpi green">
            <div className="s-kpi-icon green"><Wallet size={14} color="#10b981" /></div>
            <div className="s-kpi-val sm">{fmtCurrency(stats.myCollectionsTotal)}</div>
            <div className="s-kpi-label">Cash Collected</div>
            <div style={{ fontSize: 10, color: 'var(--s-text-3)', marginTop: 4 }}>Today: {fmtCurrency(stats.myCollectionsToday)}</div>
          </div>
          <div className="s-kpi purple">
            <div className="s-kpi-icon purple"><PhoneCall size={14} color="#8b5cf6" /></div>
            <div className="s-kpi-val sm">{stats.myFollowupsLogged}</div>
            <div className="s-kpi-label">Follow-Ups logged</div>
          </div>
          <div className="s-kpi orange">
            <div className="s-kpi-icon orange"><Star size={14} color="#f59e0b" /></div>
            <div className="s-kpi-val sm">Active</div>
            <div className="s-kpi-label">CRM Performance</div>
          </div>
        </div>
      )}

      {/* Account Settings / Info */}
      <div className="s-section-label">👤 Account Details</div>
      <div className="s-card s-mb-20">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--s-border)' }}>
            <User size={16} color="var(--s-text-3)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--s-text-3)', textTransform: 'uppercase' }}>Full Name</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.name}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--s-border)' }}>
            <Mail size={16} color="var(--s-text-3)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--s-text-3)', textTransform: 'uppercase' }}>Email Address</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.email}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
            <Shield size={16} color="var(--s-text-3)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--s-text-3)', textTransform: 'uppercase' }}>System Role</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.role}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
        {user?.role === 'Super Admin' && (
          <button className="s-btn primary lg" onClick={() => navigate('/dashboard')} style={{ width: '100%' }}>
            Back to Workspace Hub
          </button>
        )}
        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button className="s-btn ghost lg" onClick={loadStats} style={{ flex: 1 }}>
            <RefreshCw size={14} /> Sync Data
          </button>
          <button className="s-btn danger lg" onClick={handleLogout} style={{ flex: 1.2 }}>
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
