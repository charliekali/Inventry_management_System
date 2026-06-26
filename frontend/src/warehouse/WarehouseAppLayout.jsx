import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Camera, ArrowDownCircle, ArrowUpCircle, BarChart3, MapPin, User, KeyRound } from 'lucide-react';

const ALL_TABS = [
  { path: '/warehouse',           label: 'Home',     Icon: Home,            key: 'home',      perm: null },
  { path: '/warehouse/scan',      label: 'Scan QR',  Icon: Camera,          key: 'scan',      perm: 'TRANSACTIONS:STOCK_IN' },
  { path: '/warehouse/stock-in',  label: 'In',       Icon: ArrowDownCircle, key: 'stock-in',  perm: 'TRANSACTIONS:STOCK_IN' },
  { path: '/warehouse/stock-out', label: 'Out',      Icon: ArrowUpCircle,   key: 'stock-out', perm: 'TRANSACTIONS:STOCK_OUT' },
  { path: '/warehouse/balance',   label: 'Balance',  Icon: BarChart3,       key: 'balance',   perm: 'STOCK:VIEW' },
  { path: '/warehouse/find',      label: 'Find',     Icon: MapPin,          key: 'find',      perm: 'STOCK:LOCATE' },
  { path: '/warehouse/key-registry', label: 'Keys',   Icon: KeyRound,        key: 'keys',      perm: null },
  { path: '/warehouse/profile',   label: 'Me',       Icon: User,            key: 'profile',   perm: null },
];

export default function WarehouseAppLayout({ children }) {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const TABS = ALL_TABS.filter(t => {
    if (!t.perm) return true;
    if (t.key === 'scan') {
      return hasPermission('TRANSACTIONS:STOCK_IN') || hasPermission('TRANSACTIONS:STOCK_OUT');
    }
    return hasPermission(t.perm);
  });

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'WH';

  const activeTab = [...TABS].reverse().find(t => location.pathname.startsWith(t.path));

  return (
    <div className="warehouse-app">
      <div className="w-shell">
        {/* Top Bar */}
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
              onClick={() => navigate('/warehouse/profile')}
            >
              {initials}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="w-content">
          {children}
        </div>

        {/* Bottom Navigation */}
        <nav className="w-bottom-nav">
          {TABS.map(({ path, label, Icon, key }) => {
            const isActive = location.pathname === path ||
              (path !== '/warehouse' && location.pathname.startsWith(path));

            return (
              <button
                key={key}
                className={`w-nav-item${isActive ? ' active' : ''}`}
                onClick={() => navigate(path)}
              >
                <div className="w-nav-item-icon">
                  <Icon size={20} />
                </div>
                <span className="w-nav-label">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
