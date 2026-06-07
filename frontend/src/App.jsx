// Main Application Routing Shell
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';

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
import ProductionRunPage from './pages/ProductionRunPage';
import RecipePage from './pages/RecipePage';
import ProductionHistoryPage from './pages/ProductionHistoryPage';
import YieldAnalyticsPage from './pages/YieldAnalyticsPage';

// Protected Route Guard
function ProtectedRoute({ children, perm }) {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="loading-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (perm && !hasPermission(perm)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

import { useState } from 'react';
import { Menu } from 'lucide-react';

// Layout Shell for Authenticated Users
function AuthenticatedLayout({ children }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <main className="main-content">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="topbar-title">
            <h1>TTRIMS Inventory Console</h1>
            <p>Welcome back, {user?.name || 'User'} (Role: {user?.role || 'Staff'})</p>
          </div>
          <div className="topbar-actions">
            <span className="badge badge-green">API Connected</span>
          </div>
        </header>
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
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
            <ProtectedRoute perm="TRANSACTIONS:STOCK_OUT">
              <AuthenticatedLayout>
                <ProductionRunPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          } />

          <Route path="/production-history" element={
            <ProtectedRoute perm="TRANSACTIONS:VIEW">
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
  );
}

export default App;
