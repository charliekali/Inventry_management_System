/**
 * SalesAppLayout.jsx
 * The complete shell for the Sales Person sub-app.
 * Mobile-first: compact topbar + 5-tab bottom navigation with slide-up actions drawer.
 * Completely isolated from the admin layout.
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Home, PhoneCall, Wallet, ShoppingBag, Zap, User,
  LogOut, Clock, KeyRound, Navigation, Factory, MoreHorizontal, X
} from 'lucide-react';

const CORE_TABS = [
  { path: '/sales',              label: 'Home',     Icon: Home,        key: 'home',        perm: null },
  { path: '/sales/route',        label: 'Route',    Icon: Navigation,  key: 'route',       perm: null },
  { path: '/sales/crm',         label: 'CRM',      Icon: PhoneCall,   key: 'crm',         perm: 'SALES:CRM' },
  { path: '/sales/pos',         label: 'POS',      Icon: Zap,         key: 'pos',         perm: 'ORDERS:CREATE' },
];

const DRAWER_ITEMS = [
  { path: '/sales/collections', label: 'Collect',  Icon: Wallet,      key: 'collections', perm: 'SALES:COLLECT', bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
  { path: '/sales/orders',      label: 'Orders',   Icon: ShoppingBag, key: 'orders',      perm: 'ORDERS:VIEW', bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  { path: '/sales/attendance',  label: 'Attend',   Icon: Clock,       key: 'attendance',  perm: null, bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  { path: '/sales/actual-production', label: 'Actuals', Icon: Factory, key: 'actuals', perm: 'PRODUCTION:RUN', bg: 'rgba(168,85,247,0.15)', color: '#a855f7' },
  { path: '/sales/key-registry', label: 'Keys',     Icon: KeyRound,    key: 'keys',        perm: null, bg: 'rgba(6,182,212,0.15)', color: '#06b6d4' },
  { path: '/sales/profile',     label: 'Me',       Icon: User,        key: 'profile',     perm: null, bg: 'rgba(99,102,241,0.15)', color: '#6366f1' },
];

export default function SalesAppLayout({ children, crmBadge = 0, collectionBadge = 0 }) {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const TABS = CORE_TABS.filter(t => !t.perm || hasPermission(t.perm));
  const MENU_ITEMS = DRAWER_ITEMS.filter(t => !t.perm || hasPermission(t.perm));

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'SP';

  const activeTab = [...TABS].reverse().find(t => location.pathname === t.path || (t.path !== '/sales' && location.pathname.startsWith(t.path)));

  const handleLogout = async () => {
    setDrawerOpen(false);
    await logout().catch(() => {});
    toast.success('Logged out');
    navigate('/login');
  };

  const handleNavigate = (path) => {
    setDrawerOpen(false);
    navigate(path);
  };

  return (
    <div className="sales-app">
      <div className="s-shell">
        {/* ── Top Bar ─────────────────────────────────────────────────────── */}
        <header className="s-topbar">
          <div className="s-topbar-logo">🤝</div>
          <div className="s-topbar-info">
            <div className="s-topbar-title">TTRIMS Sales</div>
            <div className="s-topbar-sub">{activeTab?.label || 'Dashboard'}</div>
          </div>
          <div className="s-topbar-actions">
            <div
              className="s-avatar"
              title={user?.name}
              onClick={() => handleNavigate('/sales/profile')}
            >
              {initials}
            </div>
          </div>
        </header>

        {/* ── Page Content ────────────────────────────────────────────────── */}
        <div className="s-content">
          {children}
        </div>

        {/* ── Bottom Navigation ───────────────────────────────────────────── */}
        <nav className="s-bottom-nav">
          {TABS.map(({ path, label, Icon, key }) => {
            const isActive = location.pathname === path ||
              (path !== '/sales' && location.pathname.startsWith(path));
            const badge = key === 'crm' ? crmBadge : 0;

            return (
              <button
                key={key}
                className={`s-nav-item${isActive ? ' active' : ''}`}
                onClick={() => handleNavigate(path)}
              >
                <div className="s-nav-item-icon">
                  <Icon size={20} />
                  {badge > 0 && (
                    <div className="s-nav-badge">{badge > 9 ? '9+' : badge}</div>
                  )}
                </div>
                <span className="s-nav-label">{label}</span>
              </button>
            );
          })}
          
          <button
            className={`s-nav-item${drawerOpen ? ' active' : ''}`}
            onClick={() => setDrawerOpen(true)}
          >
            <div className="s-nav-item-icon">
              <MoreHorizontal size={20} />
              {collectionBadge > 0 && (
                <div className="s-nav-badge">{collectionBadge > 9 ? '9+' : collectionBadge}</div>
              )}
            </div>
            <span className="s-nav-label">More</span>
          </button>
        </nav>

        {/* ── Bottom Sheet Drawer Overlay ─────────────────────────────────── */}
        {drawerOpen && (
          <div className="s-drawer-overlay" onClick={() => setDrawerOpen(false)}>
            <div className="s-drawer-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
              <div className="s-drawer-header">
                <div className="s-drawer-indicator" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 8 }}>
                  <h3 className="s-drawer-title">More Actions</h3>
                  <button className="s-drawer-close" onClick={() => setDrawerOpen(false)}>
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="s-drawer-grid">
                {MENU_ITEMS.map(({ path, label, Icon, key, bg, color }) => {
                  const badge = key === 'collections' ? collectionBadge : 0;
                  return (
                    <button
                      key={key}
                      className="s-drawer-item"
                      onClick={() => handleNavigate(path)}
                    >
                      <div className="s-drawer-icon-wrap" style={{ backgroundColor: bg }}>
                        <Icon size={24} style={{ color: color }} />
                        {badge > 0 && (
                          <div className="s-drawer-badge">{badge}</div>
                        )}
                      </div>
                      <span className="s-drawer-item-label">{label}</span>
                    </button>
                  );
                })}
                
                <button
                  className="s-drawer-item s-drawer-logout"
                  onClick={handleLogout}
                >
                  <div className="s-drawer-icon-wrap" style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}>
                    <LogOut size={24} style={{ color: '#ef4444' }} />
                  </div>
                  <span className="s-drawer-item-label" style={{ color: '#ef4444' }}>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
