/**
 * SalesAppLayout.jsx
 * The complete shell for the Sales Person sub-app.
 * Mobile-first: compact topbar + 6-tab bottom navigation.
 * Completely isolated from the admin layout.
 */
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Home, PhoneCall, Wallet, ShoppingBag, Zap, User,
  LogOut
} from 'lucide-react';

const ALL_TABS = [
  { path: '/sales',            label: 'Home',       Icon: Home,        key: 'home',        perm: null },
  { path: '/sales/crm',        label: 'CRM',        Icon: PhoneCall,   key: 'crm',         perm: 'SALES:CRM' },
  { path: '/sales/collections',label: 'Collect',    Icon: Wallet,      key: 'collections', perm: 'SALES:COLLECT' },
  { path: '/sales/orders',     label: 'Orders',     Icon: ShoppingBag, key: 'orders',      perm: 'ORDERS:VIEW' },
  { path: '/sales/pos',        label: 'POS',        Icon: Zap,         key: 'pos',         perm: 'ORDERS:CREATE' },
  { path: '/sales/profile',    label: 'Me',         Icon: User,        key: 'profile',     perm: null },
];

export default function SalesAppLayout({ children, crmBadge = 0, collectionBadge = 0 }) {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const TABS = ALL_TABS.filter(t => !t.perm || hasPermission(t.perm));

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'SP';

  const activeTab = [...TABS].reverse().find(t => location.pathname.startsWith(t.path));

  const handleLogout = async () => {
    await logout().catch(() => {});
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="sales-app">
      <div className="s-shell">
        {/* ── Top Bar ─────────────────────────────────────────────────────── */}
        <header className="s-topbar">
          <div className="s-topbar-logo">🤝</div>
          <div className="s-topbar-info">
            <div className="s-topbar-title">TTRIMS Sales</div>
            <div className="s-topbar-sub">{activeTab?.label}</div>
          </div>
          <div className="s-topbar-actions">
            <div
              className="s-avatar"
              title={user?.name}
              onClick={() => navigate('/sales/profile')}
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
            const badge = key === 'crm' ? crmBadge : key === 'collections' ? collectionBadge : 0;

            return (
              <button
                key={key}
                className={`s-nav-item${isActive ? ' active' : ''}`}
                onClick={() => navigate(path)}
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
        </nav>
      </div>
    </div>
  );
}
