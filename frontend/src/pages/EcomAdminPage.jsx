import { ExternalLink, ShoppingBag } from 'lucide-react';

export default function EcomAdminPage() {
  return (
    <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 120px)' }}>
      <div className="kpi-card" style={{ maxWidth: 480, width: '100%', flexDirection: 'column', textAlign: 'center', padding: 36, gap: 20 }}>
        <div className="kpi-icon blue" style={{ width: 64, height: 64, borderRadius: 16, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShoppingBag size={32} />
        </div>
        <div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Standalone Dashboard Active</h3>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
            The E-Commerce configuration panel has been migrated to a dedicated standalone web application running on port **5174**.
          </p>
        </div>
        <a 
          href="http://localhost:5174" 
          target="_blank" 
          rel="noreferrer" 
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          Open Standalone Admin Console <ExternalLink size={16} />
        </a>
      </div>
    </div>
  );
}
