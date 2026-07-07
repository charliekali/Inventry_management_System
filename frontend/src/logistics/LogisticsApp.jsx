import { Routes, Route, Navigate } from 'react-router-dom';
import LogisticsAppLayout from './LogisticsAppLayout';
import LogisticsHome from './pages/LogisticsHome';
import LogisticsShipments from './pages/LogisticsShipments';
import LogisticsHistory from './pages/LogisticsHistory';
import LogisticsProfile from './pages/LogisticsProfile';
import MobileKeyRegistry from '../components/MobileKeyRegistry';

export default function LogisticsApp() {
  return (
    <LogisticsAppLayout>
      <Routes>
        <Route path="/" element={<LogisticsHome />} />
        <Route path="shipments" element={<LogisticsShipments />} />
        <Route path="history" element={<LogisticsHistory />} />
        <Route path="profile" element={<LogisticsProfile />} />
        <Route path="key-registry" element={<MobileKeyRegistry />} />
        {/* Redirect unknown routes back to home */}
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>
    </LogisticsAppLayout>
  );
}
