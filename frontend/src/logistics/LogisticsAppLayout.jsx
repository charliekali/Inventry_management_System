/**
 * LogisticsAppLayout.jsx
 * Mobile-first shell for the Logistics & Dispatch sub-app.
 * Reuses the .warehouse-app styling wrappers for unified look and feel.
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Home, ClipboardList, User, KeyRound, MoreHorizontal, X, LogOut, Truck, Navigation, Clock
} from 'lucide-react';
import '../warehouse/WarehouseApp.css'; // Reuse warehouse styling namespace

const CORE_TABS = [
  { path: '/logistics',           label: 'Pending',   Icon: Truck,           key: 'home',      perm: 'DISPATCH:VIEW' },
  { path: '/logistics/shipments', label: 'Shipments', Icon: Navigation,      key: 'shipments', perm: 'SHIPMENTS:VIEW' },
  { path: '/logistics/history',   label: 'Dispatched',Icon: ClipboardList,   key: 'history',   perm: 'DISPATCH:VIEW' },
  { path: '/logistics/attendance',label: 'Attend',    Icon: Clock,           key: 'attendance',perm: 'SHIPMENTS:VIEW' },
  { path: '/logistics/key-registry', label: 'Keys',   Icon: KeyRound,        key: 'keys',      perm: null },
];

const DRAWER_ITEMS = [
  { path: '/logistics/profile',   label: 'Me',       Icon: User,            key: 'profile',   perm: null, bg: 'rgba(99,102,241,0.15)', color: '#6366f1' },
];

export default function LogisticsAppLayout({ children }) {
  const { user, logout, hasPermission, isPermanentSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const TABS = CORE_TABS.filter(t => !t.perm || hasPermission(t.perm));
  const MENU_ITEMS = DRAWER_ITEMS.filter(t => !t.perm || hasPermission(t.perm));

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'LG';

  const activeTab = [...TABS].reverse().find(t => location.pathname === t.path || (t.path !== '/logistics' && location.pathname.startsWith(t.path)));

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
        {/* Top Bar */}
        <header className="w-topbar">
          <div className="w-topbar-logo" style={{ background: 'linear-gradient(135deg, #06b6d4, #3b82f6)' }}>🚚</div>
          <div className="w-topbar-info">
            <div className="w-topbar-title">TTRIMS Logistics</div>
            <div className="w-topbar-sub">{activeTab?.label || 'Dispatch'}</div>
          </div>
          <div className="w-topbar-actions">
            <div
              className="w-avatar"
              title={user?.name}
              onClick={() => handleNavigate('/logistics/profile')}
            >
              {initials}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="w-content" style={{ paddingBottom: 'calc(var(--w-nav-height) + 16px)' }}>
          {children}
        </div>

        {/* Bottom Navigation */}
        <nav className="w-bottom-nav">
          {TABS.map(({ path, label, Icon, key }) => {
            const isActive = location.pathname === path ||
              (path !== '/logistics' && location.pathname.startsWith(path));

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

        {/* Bottom Sheet Drawer Overlay */}
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
