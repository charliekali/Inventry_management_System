import { Routes, Route, Navigate } from 'react-router-dom';
import ProductionAppLayout from './ProductionAppLayout';
import ProductionHome from './pages/ProductionHome';
import ProductionRuns from './pages/ProductionRuns';
import ProductionHistory from './pages/ProductionHistory';
import ProductionRecipes from './pages/ProductionRecipes';
import ProductionProfile from './pages/ProductionProfile';
import './ProductionApp.css';

export default function ProductionApp() {
  return (
    <ProductionAppLayout>
      <Routes>
        <Route path="/" element={<ProductionHome />} />
        <Route path="runs" element={<ProductionRuns />} />
        <Route path="history" element={<ProductionHistory />} />
        <Route path="recipes" element={<ProductionRecipes />} />
        <Route path="profile" element={<ProductionProfile />} />
        {/* Redirect unknown routes back to home */}
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </ProductionAppLayout>
  );
}
