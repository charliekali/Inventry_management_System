import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { productionPlansAPI } from '../api';
import ProductionAppLayout from './ProductionAppLayout';
import ProductionHome from './pages/ProductionHome';
import ProductionRuns from './pages/ProductionRuns';
import ProductionHistory from './pages/ProductionHistory';
import ProductionRecipes from './pages/ProductionRecipes';
import ProductionProfile from './pages/ProductionProfile';
import MobileKeyRegistry from '../components/MobileKeyRegistry';
import ProductionRunPage from '../pages/ProductionRunPage';
import ActualProductionEntryPage from '../pages/ActualProductionEntryPage';
import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import './ProductionApp.css';

export default function ProductionApp() {
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
      // In case of a temporary network failure, we can block the operator for safety
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
    <ProductionAppLayout>
      <Routes>
        <Route path="/" element={<ProductionHome />} />
        <Route path="plan" element={<ProductionRunPage />} />
        <Route path="actual" element={<ActualProductionEntryPage />} />
        <Route path="runs" element={<ProductionRuns />} />
        <Route path="history" element={<ProductionHistory />} />
        <Route path="recipes" element={<ProductionRecipes />} />
        <Route path="profile" element={<ProductionProfile />} />
        <Route path="key-registry" element={<MobileKeyRegistry />} />
        {/* Redirect unknown routes back to home */}
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </ProductionAppLayout>
  );
}
