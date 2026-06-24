/**
 * SalesApp.jsx
 * Sub-app router for the Sales Person dashboard experience.
 * Handles nested routes under /sales/* and integrates the SalesAppLayout.
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import SalesAppLayout from './SalesAppLayout';
import SalesHome from './pages/SalesHome';
// Let's use correct relative paths: './pages/SalesHome', './pages/SalesCRM', './pages/SalesCollections', './pages/SalesOrders', './pages/SalesPOS', './pages/SalesProfile'.
import SalesCollections from './pages/SalesCollections';
import SalesOrders from './pages/SalesOrders';
import SalesPOS from './pages/SalesPOS';
import SalesProfile from './pages/SalesProfile';
import './SalesApp.css';

// We import SalesCRM as well
import SalesCRMComponent from './pages/SalesCRM';

export default function SalesApp() {
  return (
    <SalesAppLayout>
      <Routes>
        <Route path="/" element={<SalesHome />} />
        <Route path="crm" element={<SalesCRMComponent />} />
        <Route path="collections" element={<SalesCollections />} />
        <Route path="orders" element={<SalesOrders />} />
        <Route path="pos" element={<SalesPOS />} />
        <Route path="profile" element={<SalesProfile />} />
        {/* Redirect unknown routes back to home */}
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </SalesAppLayout>
  );
}
