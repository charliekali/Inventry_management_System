import { useState, useEffect } from 'react';
import { invoiceSettingsAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  Palette, Sliders, Building, Check, Save, FileText, 
  Eye, HelpCircle, Layout, Info, Printer
} from 'lucide-react';

const PRESET_COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Slate', value: '#334155' },
  { name: 'Rose', value: '#f43f5e' }
];

export default function InvoiceDesignerPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Design Settings State
  const [theme, setTheme] = useState('modern');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [companyName, setCompanyName] = useState('TTRIMS IMS');
  const [companyAddress, setCompanyAddress] = useState('12, Industrial Area Phase II, Bangalore, KA, India');
  const [companyPhone, setCompanyPhone] = useState('+91 80 4123 4567');
  const [companyEmail, setCompanyEmail] = useState('billing@ttrims.com');
  const [companyWebsite, setCompanyWebsite] = useState('www.ttrims.com');
  const [gstin, setGstin] = useState('29AAFCT5683K1Z2');
  const [logoUrl, setLogoUrl] = useState('');
  const [terms, setTerms] = useState('');
  const [showGstin, setShowGstin] = useState(true);
  const [showSignature, setShowSignature] = useState(true);
  const [showTerms, setShowTerms] = useState(true);
  const [showLogo, setShowLogo] = useState(true);

  useEffect(() => {
    invoiceSettingsAPI.get()
      .then(res => {
        const data = res.data.data;
        if (data) {
          setTheme(data.theme || 'modern');
          setPrimaryColor(data.primaryColor || '#3b82f6');
          setCompanyName(data.companyName || 'TTRIMS IMS');
          setCompanyAddress(data.companyAddress || '12, Industrial Area Phase II, Bangalore, KA, India');
          setCompanyPhone(data.companyPhone || '+91 80 4123 4567');
          setCompanyEmail(data.companyEmail || 'billing@ttrims.com');
          setCompanyWebsite(data.companyWebsite || 'www.ttrims.com');
          setGstin(data.gstin || '29AAFCT5683K1Z2');
          setLogoUrl(data.logoUrl || '');
          setTerms(data.terms || '');
          setShowGstin(data.showGstin === 'true');
          setShowSignature(data.showSignature === 'true');
          setShowTerms(data.showTerms === 'true');
          setShowLogo(data.showLogo === 'true');
        }
      })
      .catch(() => toast.error('Failed to load invoice designer settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (user?.role !== 'Super Admin') {
      return toast.error('Only Super Admins are permitted to modify the invoice design template.');
    }

    setSaving(true);
    const payload = {
      theme,
      primaryColor,
      companyName,
      companyAddress,
      companyPhone,
      companyEmail,
      companyWebsite,
      gstin,
      logoUrl,
      terms,
      showGstin: String(showGstin),
      showSignature: String(showSignature),
      showTerms: String(showTerms),
      showLogo: String(showLogo)
    };

    try {
      await invoiceSettingsAPI.save(payload);
      toast.success('Invoice design template saved and published!');
    } catch {
      toast.error('Failed to save invoice designer settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-center"><div className="loading-spinner"></div></div>;

  const isSuperAdmin = user?.role === 'Super Admin';

  return (
    <div className="fade-in" style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="page-header-left">
          <h2>Tax Invoice Template Designer</h2>
          <p>Global branding configuration, layout themes, and print customization for sales documents</p>
        </div>
      </div>

      {!isSuperAdmin && (
        <div style={{
          display: 'flex',
          gap: 12,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          color: 'var(--color-danger)',
          marginBottom: 20,
          fontSize: 13.5
        }}>
          <Info size={18} style={{ flexShrink: 0 }} />
          <div>
            <strong>Read-only access</strong>
            <p style={{ margin: 0, opacity: 0.85, fontSize: 12 }}>
              Only users with the Super Admin role can edit and publish changes to the global invoice template design.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* Left: Designer form */}
        <form onSubmit={handleSave} style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Card 1: Layout Themes & Colors */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
              <Palette size={16} className="text-primary" /> Visual Branding & Styling
            </h3>

            {/* Accent color picker */}
            <div className="form-group">
              <label className="form-label">Branding Accent Color</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                {PRESET_COLORS.map(col => (
                  <button
                    key={col.value}
                    type="button"
                    onClick={() => isSuperAdmin && setPrimaryColor(col.value)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: col.value,
                      border: primaryColor === col.value ? '3px solid var(--color-text-primary)' : '1px solid var(--color-border)',
                      cursor: isSuperAdmin ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.1s'
                    }}
                    title={col.name}
                  >
                    {primaryColor === col.value && <Check size={14} color="#ffffff" />}
                  </button>
                ))}
                
                {/* Custom Color Input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                  <input
                    type="color"
                    value={primaryColor}
                    disabled={!isSuperAdmin}
                    onChange={e => setPrimaryColor(e.target.value)}
                    style={{
                      width: 30,
                      height: 30,
                      padding: 0,
                      border: '1px solid var(--color-border)',
                      borderRadius: 4,
                      background: 'none',
                      cursor: isSuperAdmin ? 'pointer' : 'default'
                    }}
                  />
                  <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{primaryColor.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* Layout options */}
            <div className="form-group">
              <label className="form-label">Invoice Layout Theme</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { value: 'modern', label: 'Modern Accent', desc: 'Stylish top bar color banner' },
                  { value: 'classic', label: 'Classic Corporate', desc: 'Standard formal grid borders' },
                  { value: 'elegant', label: 'Elegant Editorial', desc: 'Light borders and sans-serif fonts' },
                  { value: 'compact', label: 'Compact Receipt', desc: 'Reduced spacing and padding' }
                ].map(opt => {
                  const isSelected = theme === opt.value;
                  return (
                    <div
                      key={opt.value}
                      onClick={() => isSuperAdmin && setTheme(opt.value)}
                      style={{
                        padding: 12,
                        borderRadius: 'var(--radius-sm)',
                        border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: isSelected ? 'rgba(59, 130, 246, 0.06)' : 'rgba(255,255,255,0.01)',
                        cursor: isSuperAdmin ? 'pointer' : 'default',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 13, color: isSelected ? 'var(--color-primary-light)' : 'var(--color-text-primary)' }}>
                        {opt.label}
                      </div>
                      <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>{opt.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2: Company Info */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
              <Building size={16} className="text-primary" /> Company Metadata & Headers
            </h3>

            <div className="form-group">
              <label className="form-label">Registered Company Name</label>
              <input
                type="text"
                className="form-control"
                value={companyName}
                disabled={!isSuperAdmin}
                onChange={e => setCompanyName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Company Address Details</label>
              <textarea
                className="form-control"
                value={companyAddress}
                disabled={!isSuperAdmin}
                onChange={e => setCompanyAddress(e.target.value)}
                style={{ minHeight: 60 }}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Contact Phone</label>
                <input
                  type="text"
                  className="form-control"
                  value={companyPhone}
                  disabled={!isSuperAdmin}
                  onChange={e => setCompanyPhone(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Support Email</label>
                <input
                  type="email"
                  className="form-control"
                  value={companyEmail}
                  disabled={!isSuperAdmin}
                  onChange={e => setCompanyEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Website URL</label>
                <input
                  type="text"
                  className="form-control"
                  value={companyWebsite}
                  disabled={!isSuperAdmin}
                  onChange={e => setCompanyWebsite(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">GSTIN / Tax ID Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={gstin}
                  disabled={!isSuperAdmin}
                  onChange={e => setGstin(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Custom Logo Image URL</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. https://example.com/logo.png (leave empty for default company text)"
                value={logoUrl}
                disabled={!isSuperAdmin}
                onChange={e => setLogoUrl(e.target.value)}
              />
            </div>
          </div>

          {/* Card 3: Display Toggles & Footer Terms */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
              <Sliders size={16} className="text-primary" /> Print Visibility Settings & Terms
            </h3>

            {/* Switch / toggles grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isSuperAdmin ? 'pointer' : 'default', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={showLogo}
                  disabled={!isSuperAdmin}
                  onChange={e => setShowLogo(e.target.checked)}
                />
                Show Logo Banner
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isSuperAdmin ? 'pointer' : 'default', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={showGstin}
                  disabled={!isSuperAdmin}
                  onChange={e => setShowGstin(e.target.checked)}
                />
                Show Company GSTIN
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isSuperAdmin ? 'pointer' : 'default', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={showTerms}
                  disabled={!isSuperAdmin}
                  onChange={e => setShowTerms(e.target.checked)}
                />
                Display Terms & Conditions
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isSuperAdmin ? 'pointer' : 'default', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={showSignature}
                  disabled={!isSuperAdmin}
                  onChange={e => setShowSignature(e.target.checked)}
                />
                Require Signature Block
              </label>
            </div>

            <div className="form-group" style={{ marginTop: 6 }}>
              <label className="form-label">Terms & Conditions (One item per line)</label>
              <textarea
                className="form-control"
                value={terms}
                disabled={!isSuperAdmin}
                onChange={e => setTerms(e.target.value)}
                placeholder="e.g. 1. Goods once sold cannot be returned."
                style={{ minHeight: 80 }}
              />
            </div>
          </div>

          {/* Action Footer */}
          {isSuperAdmin && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="submit" disabled={saving} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Save size={16} />
                {saving ? 'Publishing Design...' : 'Save & Publish Template'}
              </button>
            </div>
          )}
        </form>

        {/* Right: Live Interactive Mock Preview */}
        <div style={{ flex: '1 1 500px', position: 'sticky', top: 20 }}>
          <div className="card-header" style={{ marginBottom: 12, paddingLeft: 0, paddingRight: 0 }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.95rem' }}>
              <Eye size={16} color="var(--color-primary-light)" />
              <span>Real-Time Template Preview</span>
            </div>
            <p className="card-subtitle">Updates instantly as styling or metadata is edited</p>
          </div>

          {/* Paper Document Container */}
          <div style={{
            background: '#ffffff',
            color: '#1e293b',
            borderRadius: 6,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            border: '1px solid #cbd5e1',
            padding: theme === 'compact' ? '20px 24px' : '30px 36px',
            fontFamily: theme === 'elegant' ? '"Georgia", serif' : 'system-ui, sans-serif',
            fontSize: theme === 'compact' ? '11px' : '13px',
            minHeight: 520,
            transition: 'all 0.3s'
          }}>
            
            {/* Top Bar Banner for Modern Theme */}
            {theme === 'modern' && (
              <div style={{ 
                height: 10, 
                background: primaryColor, 
                margin: '-30px -36px 20px -36px', 
                borderTopLeftRadius: 5, 
                borderTopRightRadius: 5 
              }} />
            )}

            {/* Header Block */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              borderBottom: `2px solid ${theme === 'modern' ? primaryColor : '#e2e8f0'}`,
              paddingBottom: theme === 'compact' ? 12 : 20, 
              marginBottom: theme === 'compact' ? 12 : 20 
            }}>
              <div>
                {showLogo && logoUrl ? (
                  <img src={logoUrl} alt="Logo" style={{ maxHeight: 40, maxWidth: 150, marginBottom: 8, display: 'block' }} />
                ) : (
                  <h1 style={{ 
                    fontSize: theme === 'compact' ? 20 : 25, 
                    fontWeight: 800, 
                    color: theme === 'modern' ? primaryColor : '#0f172a', 
                    margin: '0 0 4px 0', 
                    letterSpacing: '-0.5px' 
                  }}>
                    {companyName}
                  </h1>
                )}
                <p style={{ margin: '2px 0', fontSize: '11px', color: '#64748b', whiteSpace: 'pre-line' }}>{companyAddress}</p>
                <p style={{ margin: '2px 0', fontSize: '11px', color: '#64748b' }}>Tel: {companyPhone} | {companyEmail}</p>
                {showGstin && gstin && (
                  <p style={{ margin: '2px 0', fontSize: '11px', color: '#475569', fontWeight: 600 }}>GSTIN: {gstin}</p>
                )}
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ 
                  fontSize: theme === 'compact' ? 18 : 20, 
                  fontWeight: 700, 
                  margin: '0 0 6px 0', 
                  color: '#0f172a', 
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Tax Invoice
                </h2>
                <div style={{ 
                  display: 'inline-block', 
                  background: '#ecfdf5', 
                  color: '#047857', 
                  fontSize: '9px', 
                  fontWeight: 700, 
                  padding: '2px 6px', 
                  borderRadius: 4, 
                  marginBottom: 8 
                }}>
                  FULFILLED
                </div>
                <p style={{ margin: '2px 0', fontWeight: 600 }}>Invoice #: <span style={{ color: primaryColor }}>INV-20260617-0004</span></p>
                <p style={{ margin: '2px 0', color: '#64748b' }}>Date: 17-Jun-2026</p>
              </div>
            </div>

            {/* Billing Metadata */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme === 'compact' ? 14 : 22 }}>
              <div>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>Billed To</span>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>John Doe</h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Customer ID: CUST-4910</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>Order Ref</span>
                <p style={{ margin: '2px 0', fontWeight: 600 }}>ORD-POS-1781706694</p>
                <p style={{ margin: '2px 0', color: '#64748b' }}>Payment: UPI (Direct)</p>
              </div>
            </div>

            {/* Table */}
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              marginBottom: theme === 'compact' ? 14 : 22,
              border: theme === 'classic' ? '1px solid #cbd5e1' : 'none'
            }}>
              <thead>
                <tr style={{ 
                  background: theme === 'modern' ? 'rgba(241,245,249,0.9)' : theme === 'elegant' ? '#f8fafc' : '#f1f5f9',
                  borderBottom: `2px solid ${theme === 'classic' ? '#cbd5e1' : '#e2e8f0'}`
                }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Item Details</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', width: '60px' }}>Qty</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', width: '80px' }}>Rate</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', width: '90px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>Chicken Masala 100g</div>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>Code: FG-CM100</div>
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600 }}>10 PCS</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹350.00</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>₹3,500.00</td>
                </tr>
              </tbody>
            </table>

            {/* Calculations & signature blocks */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              
              {/* Terms and conditions */}
              <div style={{ flex: 1.2, paddingRight: 30 }}>
                {showTerms && terms && (
                  <div style={{ 
                    border: '1px solid #cbd5e1', 
                    padding: 8, 
                    borderRadius: 4, 
                    fontSize: '10px', 
                    color: '#64748b', 
                    background: '#f8fafc' 
                  }}>
                    <strong style={{ display: 'block', color: '#475569', marginBottom: 2 }}>Terms & Conditions:</strong>
                    <div style={{ whiteSpace: 'pre-line' }}>{terms}</div>
                  </div>
                )}
              </div>

              {/* Subtotals */}
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Subtotal:</span>
                    <span style={{ fontWeight: 600 }}>₹3,500.00</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Tax (18%):</span>
                    <span style={{ fontWeight: 600 }}>₹630.00</span>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    borderTop: `1px solid ${primaryColor}`, 
                    paddingTop: 6, 
                    fontSize: '13px', 
                    fontWeight: 700, 
                    color: '#0f172a' 
                  }}>
                    <span>Grand Total:</span>
                    <span style={{ color: theme === 'modern' ? primaryColor : '#0f172a' }}>₹4,130.00</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Signatures */}
            {showSignature && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: theme === 'compact' ? 25 : 35 }}>
                <div style={{ textAlign: 'center', width: 140 }}>
                  <div style={{ height: 28, borderBottom: '1px solid #cbd5e1', marginBottom: 4 }}></div>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#334155' }}>Authorized Signatory</div>
                  <div style={{ fontSize: '9px', color: '#64748b' }}>{companyName}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
