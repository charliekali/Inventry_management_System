import { Routes, Route, Navigate } from 'react-router-dom';
import WarehouseAppLayout from './WarehouseAppLayout';
import WarehouseHome from './pages/WarehouseHome';
import WarehouseScan from './pages/WarehouseScan';
import WarehouseStockIn from './pages/WarehouseStockIn';
import WarehouseStockOut from './pages/WarehouseStockOut';
import WarehouseBalance from './pages/WarehouseBalance';
import WarehouseFind from './pages/WarehouseFind';
import WarehouseProfile from './pages/WarehouseProfile';
import './WarehouseApp.css';

export default function WarehouseApp() {
  return (
    <WarehouseAppLayout>
      <Routes>
        <Route path="/" element={<WarehouseHome />} />
        <Route path="scan" element={<WarehouseScan />} />
        <Route path="stock-in" element={<WarehouseStockIn />} />
        <Route path="stock-out" element={<WarehouseStockOut />} />
        <Route path="balance" element={<WarehouseBalance />} />
        <Route path="find" element={<WarehouseFind />} />
        <Route path="profile" element={<WarehouseProfile />} />
        {/* Redirect unknown routes back to home */}
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </WarehouseAppLayout>
  );
}
