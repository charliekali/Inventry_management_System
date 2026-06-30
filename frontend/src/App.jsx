// Main Application Routing Shell
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, NavLink, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App as CapApp } from '@capacitor/app';
import Sidebar from './components/Sidebar';
import ThemeSelector from './components/ThemeSelector';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StockInPage from './pages/StockInPage';
import StockOutPage from './pages/StockOutPage';
import TransactionPage from './pages/TransactionPage';
import StockBalancePage from './pages/StockBalancePage';
import LocatePage from './pages/LocatePage';
import WarehousePage from './pages/WarehousePage';
import ProductPage from './pages/ProductPage';
import OrderPage from './pages/OrderPage';
import FeasibilityPage from './pages/FeasibilityPage';
import UserPage from './pages/UserPage';
import RolePage from './pages/RolePage';
import FormSettingsPage from './pages/FormSettingsPage';
import CategoryPage from './pages/CategoryPage';
import DataPortabilityPage from './pages/DataPortabilityPage';
import ProductionRunPage from './pages/ProductionRunPage';
import RecipePage from './pages/RecipePage';
import ProductionHistoryPage from './pages/ProductionHistoryPage';
import YieldAnalyticsPage from './pages/YieldAnalyticsPage';
import PostgresProvisionerPage from './pages/PostgresProvisionerPage';
import ProductionDashboard from './pages/ProductionDashboard';
import WarehouseDashboard from './pages/WarehouseDashboard';
import SalesDashboard from './pages/SalesDashboard';
import PosPage from './pages/PosPage';
import InvoicePrint from './pages/InvoicePrint';
import InvoiceDesignerPage from './pages/InvoiceDesignerPage';
import BillingPage from './pages/BillingPage';
import SalesCRMDashboard from './pages/SalesCRMDashboard';
import NewLeadsPage from './pages/NewLeadsPage';
import CustomersPage from './pages/CustomersPage';
import AttendanceTrackingPage from './pages/AttendanceTrackingPage';
import KeyRegistryPage from './pages/KeyRegistryPage';
import MobileKeyRegistry from './components/MobileKeyRegistry';
import SalesApp from './sales/SalesApp';
import ProductionApp from './production/ProductionApp';
import WarehouseApp from './warehouse/WarehouseApp';

// Protected Route Guard
function ProtectedRoute({ children, perm }) {
  const { user, loading, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Restrict access based on role category or role name for non-Super Admins
  if (user.role !== 'Super Admin' && user.role_category !== 'Super Admin') {
    const category = user.role_category;
    
    // 1. Warehouse people can ONLY access /warehouse
    if (category === 'Warehouse') {
      if (!location.pathname.startsWith('/warehouse')) {
        return <Navigate to="/warehouse" replace />;
      }
    }
    // 2. Sales people can ONLY access /sales
    else if (category === 'Sales') {
      if (!location.pathname.startsWith('/sales')) {
        return <Navigate to="/sales" replace />;
      }
    }
    // 3. Production people can ONLY access /production
    else if (category === 'Production') {
      if (!location.pathname.startsWith('/production')) {
        return <Navigate to="/production" replace />;
      }
    }
    // 4. Fallbacks using name checks for unassigned roles
    else {
      const roleLower = (user.role || '').toLowerCase();
      if (roleLower.includes('warehouse') || roleLower.includes('keeper')) {
        if (!location.pathname.startsWith('/warehouse')) {
          return <Navigate to="/warehouse" replace />;
        }
      } else if (roleLower.includes('sales')) {
        if (!location.pathname.startsWith('/sales')) {
          return <Navigate to="/sales" replace />;
        }
      } else if (roleLower.includes('production')) {
        if (!location.pathname.startsWith('/production')) {
          return <Navigate to="/production" replace />;
        }
      } else {
        // Default general fallback
        if (!location.pathname.startsWith('/warehouse')) {
          return <Navigate to="/warehouse" replace />;
        }
      }
    }
  }

  if (perm && !hasPermission(perm)) {
    if (user.role !== 'Super Admin' && user.role_category !== 'Super Admin') {
      const category = user.role_category;
      if (category === 'Warehouse') return <Navigate to="/warehouse" replace />;
      if (category === 'Sales') return <Navigate to="/sales" replace />;
      if (category === 'Production') return <Navigate to="/production" replace />;

      const roleLower = (user.role || '').toLowerCase();
      if (roleLower.includes('warehouse') || roleLower.includes('keeper')) return <Navigate to="/warehouse" replace />;
      if (roleLower.includes('sales')) return <Navigate to="/sales" replace />;
      if (roleLower.includes('production')) return <Navigate to="/production" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

import { useState, useEffect } from 'react';
import { Menu, LayoutDashboard, ArrowDownCircle, ArrowUpCircle, MapPin, ArrowLeft } from 'lucide-react';

// Layout Shell for Authenticated Users
function AuthenticatedLayout({ children }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const ADMIN_TABS = [
    { path: '/dashboard', label: 'Home', Icon: LayoutDashboard },
    { path: '/stock-in', label: 'Stock IN', Icon: ArrowDownCircle },
    { path: '/stock-out', label: 'Stock OUT', Icon: ArrowUpCircle },
    { path: '/locate', label: 'Finder', Icon: MapPin },
  ];

  const isHome = location.pathname === '/dashboard' || location.pathname === '/';
  
  if (Capacitor.isNativePlatform()) {
    const showHeader = !isHome && location.pathname !== '/login';
    return (
      <div className="app-layout native-layout" style={{ display: 'block' }}>
        {showHeader && (
          <header className="mobile-native-header" style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            background: 'var(--color-bg-card)',
            borderBottom: '1px solid var(--color-border)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            gap: 12
          }}>
            <button 
              className="btn btn-ghost btn-icon" 
              onClick={() => navigate(-1)}
              style={{ padding: 8, minWidth: 'auto', display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', color: 'var(--color-text-primary)', cursor: 'pointer' }}
            >
              <ArrowLeft size={20} />
            </button>
            <span style={{ fontWeight: 600, fontSize: 17, color: 'var(--color-text-primary)' }}>
              Back
            </span>
          </header>
        )}
        <main className="main-content" style={{ marginLeft: 0, paddingTop: 0 }}>
          <div className="page-content" style={{ padding: '16px 12px', marginTop: 0 }}>
            {children}
          </div>
        </main>
      </div>
    );
  }
  
  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <main className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-ghost btn-icon mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            {!isHome && (
              <button 
                className="btn btn-ghost btn-icon back-btn" 
                onClick={() => navigate(-1)}
                title="Go Back"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ArrowLeft size={20} />
              </button>
            )}
          </div>
          <div className="topbar-title">
            <h1>TTRIMS Inventory Console</h1>
            <p>Welcome back, {user?.name || 'User'} (Role: {user?.role || 'Staff'})</p>
          </div>
          <div className="topbar-actions">
            <ThemeSelector />
            <span className="badge badge-green">API Connected</span>
          </div>
        </header>
        <div className="page-content">
          {children}
        </div>
        
        {/* Mobile Bottom Navigation */}
        <nav className="bottom-nav">
          {ADMIN_TABS.map(({ path, label, Icon }) => {
            const isActive = location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));
            return (
              <NavLink
                key={path}
                to={path}
                className={`bottom-nav-item${isActive ? ' active' : ''}`}
              >
                <div className="bottom-nav-item-icon">
                  <Icon size={18} />
                </div>
                <span className="bottom-nav-label">{label}</span>
              </NavLink>
            );
          })}
          <button
            type="button"
            className="bottom-nav-item"
            onClick={() => setSidebarOpen(true)}
          >
            <div className="bottom-nav-item-icon">
              <Menu size={18} />
            </div>
            <span className="bottom-nav-label">Menu</span>
          </button>
        </nav>
      </main>
    </div>
  );
}

function App() {
  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    
    // Add class to body for mobile styling overrides
    document.body.classList.toggle('native-app', isNative);

    if (isNative) {
      // Configure Status Bar style
      const setupStatusBar = async () => {
        try {
          await StatusBar.setStyle({ style: Style.Dark });
        } catch (e) {
          console.warn('StatusBar not available:', e);
        }
      };
      setupStatusBar();

      // Handle hardware back button navigation
      const setupBackButton = async () => {
        try {
          const listener = await CapApp.addListener('backButton', () => {
            const path = window.location.pathname;
            if (path === '/dashboard' || path === '/login' || path === '/') {
              CapApp.exitApp();
            } else {
              window.history.back();
            }
          });
          return listener;
        } catch (e) {
          console.warn('BackButton handler not available:', e);
        }
      };

      const listenerPromise = setupBackButton();

      return () => {
        listenerPromise.then(listener => {
          if (listener) listener.remove();
        });
      };
    }
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
      <Router>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <DashboardPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/dashboard/production" element={
            <ProtectedRoute perm="STOCK:VIEW">
              <AuthenticatedLayout>
                <ProductionDashboard />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/dashboard/warehouse" element={
            <ProtectedRoute perm="STOCK:VIEW">
              <AuthenticatedLayout>
                <WarehouseDashboard />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/dashboard/sales" element={
            <ProtectedRoute perm="ORDERS:VIEW">
              <AuthenticatedLayout>
                <SalesDashboard />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/stock-in" element={
            <ProtectedRoute perm="TRANSACTIONS:STOCK_IN">
              <AuthenticatedLayout>
                <StockInPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/stock-out" element={
            <ProtectedRoute perm="TRANSACTIONS:STOCK_OUT">
              <AuthenticatedLayout>
                <StockOutPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/production-run" element={
            <ProtectedRoute perm="PRODUCTION:RUN">
              <AuthenticatedLayout>
                <ProductionRunPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/production-history" element={
            <ProtectedRoute perm="PRODUCTION:HISTORY">
              <AuthenticatedLayout>
                <ProductionHistoryPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/yield-analytics" element={
            <ProtectedRoute perm="TRANSACTIONS:VIEW">
              <AuthenticatedLayout>
                <YieldAnalyticsPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/transactions" element={
            <ProtectedRoute perm="TRANSACTIONS:VIEW">
              <AuthenticatedLayout>
                <TransactionPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/stock-balance" element={
            <ProtectedRoute perm="STOCK:VIEW">
              <AuthenticatedLayout>
                <StockBalancePage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/locate" element={
            <ProtectedRoute perm="STOCK:LOCATE">
              <AuthenticatedLayout>
                <LocatePage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/warehouses" element={
            <ProtectedRoute perm="WAREHOUSES:VIEW">
              <AuthenticatedLayout>
                <WarehousePage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/products" element={
            <ProtectedRoute perm="PRODUCTS:VIEW">
              <AuthenticatedLayout>
                <ProductPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/recipes" element={
            <ProtectedRoute perm="BOM:VIEW">
              <AuthenticatedLayout>
                <RecipePage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/orders" element={
            <ProtectedRoute perm="ORDERS:VIEW">
              <AuthenticatedLayout>
                <OrderPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/feasibility" element={
            <ProtectedRoute perm="ORDERS:CHECK_FEASIBILITY">
              <AuthenticatedLayout>
                <FeasibilityPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/users" element={
            <ProtectedRoute perm="USERS:VIEW">
              <AuthenticatedLayout>
                <UserPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/roles" element={
            <ProtectedRoute perm="ROLES:VIEW">
              <AuthenticatedLayout>
                <RolePage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/form-settings" element={
            <ProtectedRoute perm="ROLES:VIEW">
              <AuthenticatedLayout>
                <FormSettingsPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/categories" element={
            <ProtectedRoute perm="ROLES:VIEW">
              <AuthenticatedLayout>
                <CategoryPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/data-portability" element={
            <ProtectedRoute perm="ROLES:VIEW">
              <AuthenticatedLayout>
                <DataPortabilityPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/postgres-provisioner" element={
            <ProtectedRoute perm="INFRASTRUCTURE:VIEW">
              <AuthenticatedLayout>
                <PostgresProvisionerPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/invoice-designer" element={
            <ProtectedRoute perm="ROLES:VIEW">
              <AuthenticatedLayout>
                <InvoiceDesignerPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/billing" element={
            <ProtectedRoute perm="SALES:COLLECT">
              <AuthenticatedLayout>
                <BillingPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/crm" element={
            <ProtectedRoute perm="SALES:CRM">
              <AuthenticatedLayout>
                <SalesCRMDashboard />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/crm/leads" element={
            <ProtectedRoute perm="SALES:LEADS">
              <AuthenticatedLayout>
                <NewLeadsPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/crm/customers" element={
            <ProtectedRoute perm="SALES:CUSTOMERS">
              <AuthenticatedLayout>
                <CustomersPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/pos" element={
            <ProtectedRoute perm="ORDERS:CREATE">
              <AuthenticatedLayout>
                <PosPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/invoice/:id" element={
            <ProtectedRoute perm="ORDERS:VIEW">
              <AuthenticatedLayout>
                <InvoicePrint />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/sales/*" element={
            <ProtectedRoute>
              <SalesApp />
            </ProtectedRoute>
          } />

          <Route path="/production/*" element={
            <ProtectedRoute>
              <ProductionApp />
            </ProtectedRoute>
          } />

          <Route path="/warehouse/*" element={
            <ProtectedRoute>
              <WarehouseApp />
            </ProtectedRoute>
          } />

          <Route path="/attendance-tracking" element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <AttendanceTrackingPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/key-registry" element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                {Capacitor.isNativePlatform() ? <MobileKeyRegistry /> : <KeyRegistryPage />}
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
      <Toaster position="top-right" toastOptions={{
        style: {
          background: 'var(--color-bg-card)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
        }
      }} />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
