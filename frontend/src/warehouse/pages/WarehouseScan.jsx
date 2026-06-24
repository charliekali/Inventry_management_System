import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRScannerModal from '../../components/QRScannerModal';
import { Camera, ArrowDownCircle, ArrowUpCircle, BarChart3, Scan, RotateCcw, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function WarehouseScan() {
  const navigate = useNavigate();
  const [showScanner, setShowScanner] = useState(false);
  const [scannedData, setScannedData] = useState(null);

  const handleQrScanned = (data) => {
    // Expected QR payload: { type: 'TTRIMS_SECTION', warehouse_id, warehouse_name, section_id, section_name }
    if (!data.warehouse_id) {
      toast.error('Invalid QR code data — warehouse ID missing');
      return;
    }
    setScannedData(data);
    toast.success('Section successfully scanned!');
  };

  const handleScanClick = () => {
    setShowScanner(true);
  };

  const handleReset = () => {
    setScannedData(null);
  };

  return (
    <div className="w-page w-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Camera size={22} color="var(--w-accent)" />
        <h3 style={{ fontSize: 16, fontWeight: 800 }}>Scan QR Module</h3>
      </div>

      {!scannedData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Info Card */}
          <div className="w-card w-card-padded" style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{
              width: 60, height: 60,
              borderRadius: '50%',
              background: 'rgba(6,182,212,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Scan size={30} color="var(--w-accent)" />
            </div>
            <h4 style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>Section & Shelf Scanner</h4>
            <p style={{ fontSize: 12.5, color: 'var(--w-text-2)', lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
              Hold your mobile camera over a physical shelf or section label QR code to automatically identify the warehouse place and perform transactions.
            </p>
          </div>

          {/* Trigger Button */}
          <button 
            className="w-scan-btn" 
            onClick={handleScanClick}
            style={{ 
              height: 52, 
              fontSize: 15, 
              boxShadow: '0 0 15px var(--w-accent-glow)',
              background: 'linear-gradient(135deg, var(--w-accent), #0891b2)'
            }}
          >
            <Camera size={18} />
            Start Camera Scanner
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Scanned Location Result */}
          <div className="w-card" style={{ border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid rgba(16,185,129,0.1)' }}>
              <CheckCircle size={18} color="var(--w-success)" />
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--w-success)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Location Identified
              </span>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--w-text-3)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                    Warehouse Facility
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--w-text)', marginTop: 2 }}>
                    {scannedData.warehouse_name}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--w-text-3)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
                    Section / Shelf Location
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--w-text)', marginTop: 2 }}>
                    {scannedData.section_name || 'Open Area'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Transaction Actions Grid */}
          <div className="w-section-label" style={{ marginTop: 8 }}>Available Shelf Transactions</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            <button 
              className="w-qa-btn"
              style={{ padding: '20px 12px', border: '1px solid var(--w-border)' }}
              onClick={() => navigate('/warehouse/stock-in', {
                state: { 
                  warehouseId: scannedData.warehouse_id, 
                  sectionId: scannedData.section_id 
                }
              })}
            >
              <div className="w-qa-icon" style={{ background: 'rgba(16,185,129,0.15)', marginBottom: 4 }}>
                <ArrowDownCircle size={22} color="#10b981" />
              </div>
              <span style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--w-text)' }}>Stock IN</span>
              <span style={{ fontSize: 10, color: 'var(--w-text-3)', marginTop: 2 }}>Receipt entry</span>
            </button>

            <button 
              className="w-qa-btn"
              style={{ padding: '20px 12px', border: '1px solid var(--w-border)' }}
              onClick={() => navigate('/warehouse/stock-out', {
                state: { 
                  warehouseId: scannedData.warehouse_id, 
                  sectionId: scannedData.section_id 
                }
              })}
            >
              <div className="w-qa-icon" style={{ background: 'rgba(239,68,68,0.15)', marginBottom: 4 }}>
                <ArrowUpCircle size={22} color="#ef4444" />
              </div>
              <span style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--w-text)' }}>Stock OUT</span>
              <span style={{ fontSize: 10, color: 'var(--w-text-3)', marginTop: 2 }}>Issue entry</span>
            </button>
          </div>

          <button 
            className="w-qa-btn" 
            style={{ width: '100%', padding: '16px', display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: 8, border: '1px solid var(--w-border)' }}
            onClick={() => navigate('/warehouse/find', {
              state: { 
                warehouseId: scannedData.warehouse_id, 
                sectionId: scannedData.section_id,
                autoLoad: true
              }
            })}
          >
            <BarChart3 size={18} color="var(--w-accent)" />
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--w-text)' }}>View Current Balances Here</span>
          </button>

          {/* Scan Again Button */}
          <button className="w-btn ghost lg" onClick={handleReset} style={{ marginTop: 8 }}>
            <RotateCcw size={16} />
            Scan Another Shelf
          </button>
        </div>
      )}

      {/* Render QR Scanner Modal */}
      {showScanner && (
        <QRScannerModal 
          onScanned={handleQrScanned} 
          onClose={() => setShowScanner(false)} 
        />
      )}
    </div>
  );
}
