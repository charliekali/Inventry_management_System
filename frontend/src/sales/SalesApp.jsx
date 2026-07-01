/**
 * SalesApp.jsx
 * Sub-app router for the Sales Person dashboard experience (APK).
 * Handles nested routes under /sales/* and integrates the SalesAppLayout.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
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
import './SalesApp.css';

export default function SalesApp() {
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
