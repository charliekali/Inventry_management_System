import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import {
  LayoutDashboard, Warehouse, Package, ArrowDownCircle,
  ArrowUpCircle, BarChart3, MapPin, ShieldCheck, Users,
  Settings, LogOut, ClipboardList, BookOpen, SlidersHorizontal, Tags,
  Factory, ListPlus, History, LineChart, Database, ShoppingBag, FileText,
  PhoneCall, Target, Wifi, Radio, KeyRound
} from 'lucide-react';
import ServerSettings from './ServerSettings';

const NAV_ITEMS = [
  { group: 'Overview', items: [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: null },
    { path: '/dashboard/production', label: 'Production Dashboard', icon: Factory, perm: 'STOCK:VIEW' },
    { path: '/dashboard/warehouse', label: 'Warehouse Dashboard', icon: Warehouse, perm: 'STOCK:VIEW' },
    { path: '/dashboard/sales', label: 'Sales Dashboard', icon: ShoppingBag, perm: 'ORDERS:VIEW' },
  ]},
  { group: 'CRM & Collections', items: [
    { path: '/crm', label: 'CRM Workspace', icon: PhoneCall, perm: 'SALES:CRM' },
    { path: '/crm/leads', label: 'New Leads', icon: Target, perm: 'SALES:LEADS' },
    { path: '/crm/customers', label: 'Customers', icon: Users, perm: 'SALES:CUSTOMERS' },
    { path: '/crm/visit-allocations', label: 'Visit Allocations', icon: MapPin, perm: 'SALES:CRM' },
    { path: '/billing', label: 'Invoice & Billing', icon: ClipboardList, perm: 'SALES:COLLECT' },
  ]},
  { group: 'Inventory', items: [
    { path: '/stock-in', label: 'Stock IN', icon: ArrowDownCircle, perm: 'TRANSACTIONS:STOCK_IN' },
    { path: '/stock-out', label: 'Stock OUT', icon: ArrowUpCircle, perm: 'TRANSACTIONS:STOCK_OUT' },
    { path: '/production-run', label: 'Production Plan', icon: Factory, perm: 'PRODUCTION:PLAN' },
    { path: '/actual-production', label: 'Actual Production', icon: ClipboardList, perm: 'PRODUCTION:RUN' },
    { path: '/production-history', label: 'Production History', icon: History, perm: 'PRODUCTION:HISTORY' },
    { path: '/yield-analytics', label: 'Yield Analytics', icon: LineChart, perm: 'TRANSACTIONS:VIEW' },
    { path: '/transactions', label: 'Transaction History', icon: ClipboardList, perm: 'TRANSACTIONS:VIEW' },
    { path: '/stock-balance', label: 'Stock Balance', icon: BarChart3, perm: 'STOCK:VIEW' },
    { path: '/locate', label: 'Location Finder', icon: MapPin, perm: 'STOCK:LOCATE' },
  ]},
  { group: 'Masters', items: [
    { path: '/warehouses', label: 'Warehouses', icon: Warehouse, perm: 'WAREHOUSES:VIEW' },
    { path: '/products', label: 'Products', icon: Package, perm: 'PRODUCTS:VIEW' },
    { path: '/recipes', label: 'Recipes / BOM', icon: ListPlus, perm: 'BOM:VIEW' },
  ]},
  { group: 'Orders', items: [
    { path: '/orders', label: 'Orders', icon: BookOpen, perm: 'ORDERS:VIEW' },
    { path: '/feasibility', label: 'Feasibility Check', icon: ShieldCheck, perm: 'ORDERS:CHECK_FEASIBILITY' },
  ]},
  { group: 'Administration', items: [
    { path: '/users', label: 'Users', icon: Users, perm: 'USERS:VIEW' },
    { path: '/roles', label: 'Roles & Permissions', icon: Settings, perm: 'ROLES:VIEW' },
    { path: '/categories', label: 'Product Categories', icon: Tags, perm: 'ROLES:VIEW' },
    { path: '/data-portability', label: 'Data Portability', icon: Database, perm: 'ROLES:VIEW' },
    { path: '/form-settings', label: 'Form Settings', icon: SlidersHorizontal, perm: 'ROLES:VIEW' },
    { path: '/invoice-designer', label: 'Invoice Designer', icon: FileText, perm: 'ROLES:VIEW' },
    { path: '/attendance-tracking', label: 'Live Tracking', icon: Radio, perm: null },
    { path: '/key-registry', label: 'Key Registry', icon: KeyRound, perm: null },
    { path: '/postgres-provisioner', label: 'Postgres Databases', icon: Database, perm: 'INFRASTRUCTURE:VIEW' },
  ]},
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [serverSettingsOpen, setServerSettingsOpen] = useState(false);
  const isMobile = Capacitor.isNativePlatform();

  const handleLogout = async () => {
    if (onClose) onClose();
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'SA';

  return (
    <aside className={`sidebar${isOpen ? ' open' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-inner">
          <div className="sidebar-logo-icon">📦</div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-title">TTRIMS IMS</span>
            <span className="sidebar-logo-subtitle">Inventory System</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(group => {
          const visibleItems = group.items.filter(item =>
             !item.perm || hasPermission(item.perm)
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.group}>
              <div className="sidebar-section-label">{group.group}</div>
              {visibleItems.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={handleLinkClick}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <item.icon size={17} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name || 'Admin'}</div>
            <div className="sidebar-user-role">{user?.role || 'Super Admin'}</div>
          </div>
          {isMobile && (
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setServerSettingsOpen(true)}
              title="Server Settings"
              style={{ marginRight: '6px' }}
            >
              <Wifi size={16} />
            </button>
          )}
          <button
            className="btn btn-ghost btn-icon"
            onClick={handleLogout}
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
        
        <ServerSettings
          isOpen={serverSettingsOpen}
          onClose={() => setServerSettingsOpen(false)}
        />
      </div>
    </aside>
  );
}
