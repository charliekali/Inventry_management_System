import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Home, Factory, History, ListPlus, User } from 'lucide-react';

const ALL_TABS = [
  { path: '/production',          label: 'Home',    Icon: Home,     key: 'home',    perm: null },
  { path: '/production/runs',     label: 'Runs',    Icon: Factory,  key: 'runs',    perm: 'PRODUCTION:RUN' },
  { path: '/production/history',  label: 'History', Icon: History,  key: 'history', perm: 'PRODUCTION:HISTORY' },
  { path: '/production/recipes',  label: 'Recipes', Icon: ListPlus, key: 'recipes', perm: 'BOM:VIEW' },
  { path: '/production/profile',  label: 'Me',      Icon: User,     key: 'profile', perm: null },
];

export default function ProductionAppLayout({ children }) {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const TABS = ALL_TABS.filter(t => !t.perm || hasPermission(t.perm));

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'PM';

  const activeTab = [...TABS].reverse().find(t => location.pathname.startsWith(t.path));

  return (
    <div className="production-app">
      <div className="p-shell">
        {/* Top Bar */}
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
              onClick={() => navigate('/production/profile')}
            >
              {initials}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-content">
          {children}
        </div>

        {/* Bottom Navigation */}
        <nav className="p-bottom-nav">
          {TABS.map(({ path, label, Icon, key }) => {
            const isActive = location.pathname === path ||
              (path !== '/production' && location.pathname.startsWith(path));

            return (
              <button
                key={key}
                className={`p-nav-item${isActive ? ' active' : ''}`}
                onClick={() => navigate(path)}
              >
                <div className="p-nav-item-icon">
                  <Icon size={20} />
                </div>
                <span className="p-nav-label">{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
