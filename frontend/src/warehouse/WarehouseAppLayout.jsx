/**
 * WarehouseAppLayout.jsx
 * The complete shell for the Warehouse Person sub-app.
 * Mobile-first: compact topbar + 5-tab bottom navigation with slide-up actions drawer.
 * Completely isolated from the admin layout.
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Home, Camera, ArrowDownCircle, ArrowUpCircle, BarChart3, MapPin, User, KeyRound, MoreHorizontal, X, LogOut
} from 'lucide-react';

const CORE_TABS = [
  { path: '/warehouse',           label: 'Home',     Icon: Home,            key: 'home',      perm: null },
  { path: '/warehouse/scan',      label: 'Scan QR',  Icon: Camera,          key: 'scan',      perm: 'TRANSACTIONS:STOCK_IN' },
  { path: '/warehouse/stock-in',  label: 'Stock IN', Icon: ArrowDownCircle, key: 'stock-in',  perm: 'TRANSACTIONS:STOCK_IN' },
  { path: '/warehouse/stock-out', label: 'Stock OUT',Icon: ArrowUpCircle,   key: 'stock-out', perm: 'TRANSACTIONS:STOCK_OUT' },
];

const DRAWER_ITEMS = [
  { path: '/warehouse/balance',   label: 'Balance',  Icon: BarChart3,       key: 'balance',   perm: 'STOCK:VIEW', bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  { path: '/warehouse/find',      label: 'Find',     Icon: MapPin,          key: 'find',      perm: 'STOCK:LOCATE', bg: 'rgba(168,85,247,0.15)', color: '#a855f7' },
  { path: '/warehouse/key-registry', label: 'Keys',   Icon: KeyRound,        key: 'keys',      perm: null, bg: 'rgba(6,182,212,0.15)', color: '#06b6d4' },
  { path: '/warehouse/profile',   label: 'Me',       Icon: User,            key: 'profile',   perm: null, bg: 'rgba(99,102,241,0.15)', color: '#6366f1' },
];

export default function WarehouseAppLayout({ children }) {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const TABS = CORE_TABS.filter(t => {
    if (!t.perm) return true;
    if (t.key === 'scan') {
      return hasPermission('TRANSACTIONS:STOCK_IN') || hasPermission('TRANSACTIONS:STOCK_OUT');
    }
    return hasPermission(t.perm);
  });

  const MENU_ITEMS = DRAWER_ITEMS.filter(t => !t.perm || hasPermission(t.perm));

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'WH';

  const activeTab = [...TABS].reverse().find(t => location.pathname === t.path || (t.path !== '/warehouse' && location.pathname.startsWith(t.path)));

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
    <div className="warehouse-app">
      <div className="w-shell">
        {/* ── Top Bar ─────────────────────────────────────────────────────── */}
        <header className="w-topbar">
          <div className="w-topbar-logo">📦</div>
          <div className="w-topbar-info">
            <div className="w-topbar-title">TTRIMS Warehouse</div>
            <div className="w-topbar-sub">{activeTab?.label || 'Dashboard'}</div>
          </div>
          <div className="w-topbar-actions">
            <div
              className="w-avatar"
              title={user?.name}
              onClick={() => handleNavigate('/warehouse/profile')}
            >
              {initials}
            </div>
          </div>
        </header>

        {/* ── Page Content ────────────────────────────────────────────────── */}
        <div className="w-content">
          {children}
        </div>

        {/* ── Bottom Navigation ───────────────────────────────────────────── */}
        <nav className="w-bottom-nav">
          {TABS.map(({ path, label, Icon, key }) => {
            const isActive = location.pathname === path ||
              (path !== '/warehouse' && location.pathname.startsWith(path));

            return (
              <button
                key={key}
                className={`w-nav-item${isActive ? ' active' : ''}`}
                onClick={() => handleNavigate(path)}
              >
                <div className="w-nav-item-icon">
                  <Icon size={20} />
                </div>
                <span className="w-nav-label">{label}</span>
              </button>
            );
          })}
          
          <button
            className={`w-nav-item${drawerOpen ? ' active' : ''}`}
            onClick={() => setDrawerOpen(true)}
          >
            <div className="w-nav-item-icon">
              <MoreHorizontal size={20} />
            </div>
            <span className="w-nav-label">More</span>
          </button>
        </nav>

        {/* ── Bottom Sheet Drawer Overlay ─────────────────────────────────── */}
        {drawerOpen && (
          <div className="w-drawer-overlay" onClick={() => setDrawerOpen(false)}>
            <div className="w-drawer-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
              <div className="w-drawer-header">
                <div className="w-drawer-indicator" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 8 }}>
                  <h3 className="w-drawer-title">More Actions</h3>
                  <button className="w-drawer-close" onClick={() => setDrawerOpen(false)}>
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="w-drawer-grid">
                {MENU_ITEMS.map(({ path, label, Icon, key, bg, color }) => (
                  <button
                    key={key}
                    className="w-drawer-item"
                    onClick={() => handleNavigate(path)}
                  >
                    <div className="w-drawer-icon-wrap" style={{ backgroundColor: bg }}>
                      <Icon size={24} style={{ color: color }} />
                    </div>
                    <span className="w-drawer-item-label">{label}</span>
                  </button>
                ))}
                
                <button
                  className="w-drawer-item w-drawer-logout"
                  onClick={handleLogout}
                >
                  <div className="w-drawer-icon-wrap" style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}>
                    <LogOut size={24} style={{ color: '#ef4444' }} />
                  </div>
                  <span className="w-drawer-item-label" style={{ color: '#ef4444' }}>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
