import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, Camera, ArrowDownCircle, ArrowUpCircle, BarChart3, MapPin, User } from 'lucide-react';

const TABS = [
  { path: '/warehouse',           label: 'Home',     Icon: Home,            key: 'home' },
  { path: '/warehouse/scan',      label: 'Scan QR',  Icon: Camera,          key: 'scan' },
  { path: '/warehouse/stock-in',  label: 'In',       Icon: ArrowDownCircle, key: 'stock-in' },
  { path: '/warehouse/stock-out', label: 'Out',      Icon: ArrowUpCircle,   key: 'stock-out' },
  { path: '/warehouse/balance',   label: 'Balance',  Icon: BarChart3,       key: 'balance' },
  { path: '/warehouse/find',      label: 'Find',     Icon: MapPin,          key: 'find' },
  { path: '/warehouse/profile',   label: 'Me',       Icon: User,            key: 'profile' },
];

export default function WarehouseAppLayout({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'WH';

  const activeTab = TABS.findLast(t => location.pathname.startsWith(t.path));

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
