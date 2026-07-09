/**
 * ProductionAppLayout.jsx
 * The complete shell for the Production Operator/Manager sub-app.
 * Mobile-first: compact topbar + 5-tab bottom navigation with slide-up actions drawer.
 * Completely isolated from the admin layout.
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Home, Factory, History, ListPlus, User, KeyRound, ClipboardList, MoreHorizontal, X, LogOut
} from 'lucide-react';

const CORE_TABS = [
  { path: '/production',          label: 'Home',    Icon: Home,          key: 'home',    perm: null },
  { path: '/production/plan',     label: 'Plan',    Icon: Factory,       key: 'plan',    perm: 'PRODUCTION:PLAN' },
  { path: '/production/actual',   label: 'Actuals', Icon: ClipboardList, key: 'actuals', perm: 'PRODUCTION:RUN' },
];

const DRAWER_ITEMS = [
  { path: '/production/runs',     label: 'Runs Ledger',Icon: ClipboardList,key: 'runs',      perm: 'PRODUCTION:RUN', bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  { path: '/production/history',  label: 'History', Icon: History,       key: 'history', perm: 'PRODUCTION:HISTORY', bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
  { path: '/production/recipes',  label: 'Recipes', Icon: ListPlus,      key: 'recipes', perm: 'BOM:VIEW', bg: 'rgba(236,72,153,0.15)', color: '#ec4899' },
  { path: '/production/key-registry', label: 'Keys',   Icon: KeyRound,      key: 'keys',    perm: null, bg: 'rgba(6,182,212,0.15)', color: '#06b6d4' },
  { path: '/production/profile',  label: 'Me',      Icon: User,          key: 'profile', perm: null, bg: 'rgba(99,102,241,0.15)', color: '#6366f1' },
];

export default function ProductionAppLayout({ children }) {
  const { user, logout, hasPermission, isPermanentSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const TABS = CORE_TABS.filter(t => !t.perm || hasPermission(t.perm));
  const MENU_ITEMS = DRAWER_ITEMS.filter(t => !t.perm || hasPermission(t.perm));

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'PM';

  const activeTab = [...TABS].reverse().find(t => location.pathname === t.path || (t.path !== '/production' && location.pathname.startsWith(t.path)));

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
    <div className="production-app">
      <div className="p-shell">
        {/* ── Top Bar ─────────────────────────────────────────────────────── */}
        <header className="p-topbar">
          <div className="p-topbar-logo">🏭</div>
          <div className="p-topbar-info">
            <div className="p-topbar-title">TTRIMS Production</div>
            <div className="p-topbar-sub">{activeTab?.label || 'Dashboard'}</div>
          </div>
          <div className="p-topbar-actions">
            <div
              className="p-avatar"
              title={user?.name}
              onClick={() => handleNavigate('/production/profile')}
            >
              {initials}
            </div>
          </div>
        </header>

        {/* ── Page Content ────────────────────────────────────────────────── */}
        <div className="p-content">
          {children}
        </div>

        {/* ── Bottom Navigation ───────────────────────────────────────────── */}
        <nav className="p-bottom-nav">
          {TABS.map(({ path, label, Icon, key }) => {
            const isActive = location.pathname === path ||
              (path !== '/production' && location.pathname.startsWith(path));

            return (
              <button
                key={key}
                className={`p-nav-item${isActive ? ' active' : ''}`}
                onClick={() => handleNavigate(path)}
              >
                <div className="p-nav-item-icon">
                  <Icon size={20} />
                </div>
                <span className="p-nav-label">{label}</span>
              </button>
            );
          })}
          
          <button
            className={`p-nav-item${drawerOpen ? ' active' : ''}`}
            onClick={() => setDrawerOpen(true)}
          >
            <div className="p-nav-item-icon">
              <MoreHorizontal size={20} />
            </div>
            <span className="p-nav-label">More</span>
          </button>
        </nav>

        {/* ── Bottom Sheet Drawer Overlay ─────────────────────────────────── */}
        {drawerOpen && (
          <div className="p-drawer-overlay" onClick={() => setDrawerOpen(false)}>
            <div className="p-drawer-sheet animate-slide-up" onClick={(e) => e.stopPropagation()}>
              <div className="p-drawer-header">
                <div className="p-drawer-indicator" />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginTop: 8 }}>
                  <h3 className="p-drawer-title">More Actions</h3>
                  <button className="p-drawer-close" onClick={() => setDrawerOpen(false)}>
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="p-drawer-grid">
                {MENU_ITEMS.map(({ path, label, Icon, key, bg, color }) => (
                  <button
                    key={key}
                    className="p-drawer-item"
                    onClick={() => handleNavigate(path)}
                  >
                    <div className="p-drawer-icon-wrap" style={{ backgroundColor: bg }}>
                      <Icon size={24} style={{ color: color }} />
                    </div>
                    <span className="p-drawer-item-label">{label}</span>
                  </button>
                ))}
                
                <button
                  className="p-drawer-item p-drawer-logout"
                  onClick={handleLogout}
                >
                  <div className="p-drawer-icon-wrap" style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}>
                    <LogOut size={24} style={{ color: '#ef4444' }} />
                  </div>
                  <span className="p-drawer-item-label" style={{ color: '#ef4444' }}>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
