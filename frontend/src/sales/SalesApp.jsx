/**
 * SalesApp.jsx
 * Sub-app router for the Sales Person dashboard experience (APK).
 * Handles nested routes under /sales/* and integrates the SalesAppLayout.
 * Also enforces the Production Plan requirement:
 *   If no plan is assigned to the user for today, they are blocked with a message.
 */
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { productionPlansAPI } from '../api';
import SalesAppLayout from './SalesAppLayout';
import SalesHome from './pages/SalesHome';
import SalesCollections from './pages/SalesCollections';
import SalesOrders from './pages/SalesOrders';
import SalesPOS from './pages/SalesPOS';
import SalesProfile from './pages/SalesProfile';
import SalesAttendance from './pages/SalesAttendance';
import SalesRoute from './pages/SalesRoute';
import MobileKeyRegistry from '../components/MobileKeyRegistry';
import SalesCRMComponent from './pages/SalesCRM';
import ActualProductionEntryPage from '../pages/ActualProductionEntryPage';
import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import './SalesApp.css';

export default function SalesApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [checkingPlan, setCheckingPlan] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);

  const checkPlanAssignment = async () => {
    // Super Admins are exempt from the block so they can test/inspect the app
    if (user?.role === 'Super Admin' || user?.role_category === 'Super Admin') {
      setIsBlocked(false);
      setCheckingPlan(false);
      return;
    }

    try {
      setCheckingPlan(true);
      const res = await productionPlansAPI.myToday();
      if (res.data.success && res.data.hasPlan) {
        setIsBlocked(false);
      } else {
        setIsBlocked(true);
      }
    } catch (err) {
      console.error('Failed to verify production plan assignment:', err);
      // In case of a temporary network failure, we can allow or block.
      // Blocking is safer to enforce the business rule, but let's show an error.
      setIsBlocked(true);
    } finally {
      setCheckingPlan(false);
    }
  };

  useEffect(() => {
    checkPlanAssignment();
  }, [user]);

  const handleLogout = async () => {
    await logout().catch(() => {});
    toast.success('Logged out');
    navigate('/login');
  };

  if (checkingPlan) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="loading-spinner" />
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>Verifying production plan...</span>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg-primary)',
        padding: 24,
        boxSizing: 'border-box'
      }}>
        <div style={{
          maxWidth: 400,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          padding: 32,
          textAlign: 'center',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)'
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: 'var(--color-danger)'
          }}>
            <AlertTriangle size={32} />
          </div>
          
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', marginBottom: 12 }}>
            No Plan Assigned
          </h3>
          
          <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
            You have no Production Plan. Please Contact Your Manager. Else Your Attendance will be Not Calculated.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button 
              onClick={checkPlanAssignment}
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <RefreshCw size={14} />
              Retry Check
            </button>
            
            <button 
              onClick={handleLogout}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8, background: '#ef4444' }}
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SalesAppLayout>
      <Routes>
        <Route path="/" element={<SalesHome />} />
        <Route path="crm" element={<SalesCRMComponent />} />
        <Route path="collections" element={<SalesCollections />} />
        <Route path="orders" element={<SalesOrders />} />
        <Route path="pos" element={<SalesPOS />} />
        <Route path="attendance" element={<SalesAttendance />} />
        <Route path="actual-production" element={<ActualProductionEntryPage />} />
        <Route path="route" element={<SalesRoute />} />
        <Route path="key-registry" element={<MobileKeyRegistry />} />
        <Route path="profile" element={<SalesProfile />} />
        {/* Redirect unknown routes back to home */}
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </SalesAppLayout>
  );
}
