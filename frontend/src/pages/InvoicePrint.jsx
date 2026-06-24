import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ordersAPI, invoiceSettingsAPI } from '../api';
import toast from 'react-hot-toast';
import { 
  Printer, ArrowLeft, CheckCircle2, AlertCircle, 
  Palette, Sliders, Settings, Check, LayoutGrid, Info
} from 'lucide-react';

const PRESET_COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Slate', value: '#334155' },
  { name: 'Rose', value: '#f43f5e' }
];

export default function InvoicePrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  // Customizer Panel State
  const [customTheme, setCustomTheme] = useState('modern');
  const [customPrimaryColor, setCustomPrimaryColor] = useState('#3b82f6');
  const [customCompanyName, setCustomCompanyName] = useState('TTRIMS IMS');
  const [customCompanyAddress, setCustomCompanyAddress] = useState('');
  const [customCompanyPhone, setCustomCompanyPhone] = useState('');
  const [customCompanyEmail, setCustomCompanyEmail] = useState('');
  const [customCompanyWebsite, setCustomCompanyWebsite] = useState('');
  const [customGstin, setCustomGstin] = useState('');
  const [customLogoUrl, setCustomLogoUrl] = useState('');
  const [customTerms, setCustomTerms] = useState('');
  const [customShowLogo, setCustomShowLogo] = useState(true);
  const [customShowGstin, setCustomShowGstin] = useState(true);
  const [customShowTerms, setCustomShowTerms] = useState(true);
  const [customShowSignature, setCustomShowSignature] = useState(true);
  
  // Real-time Print Options
  const [showPaidStamp, setShowPaidStamp] = useState(true);
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(true);

  useEffect(() => {
    Promise.all([
      ordersAPI.getInvoice(id),
      invoiceSettingsAPI.get()
    ])
      .then(([invoiceRes, settingsRes]) => {
        setInvoice(invoiceRes.data.data);
        
        const settings = settingsRes.data.data;
        if (settings) {
          setCustomTheme(settings.theme || 'modern');
          setCustomPrimaryColor(settings.primaryColor || '#3b82f6');
          setCustomCompanyName(settings.companyName || 'TTRIMS IMS');
          setCustomCompanyAddress(settings.companyAddress || '');
          setCustomCompanyPhone(settings.companyPhone || '');
          setCustomCompanyEmail(settings.companyEmail || '');
          setCustomCompanyWebsite(settings.companyWebsite || '');
          setCustomGstin(settings.gstin || '');
          setCustomLogoUrl(settings.logoUrl || '');
          setCustomTerms(settings.terms || '');
          setCustomShowLogo(settings.showLogo === 'true');
          setCustomShowGstin(settings.showGstin === 'true');
          setCustomShowTerms(settings.showTerms === 'true');
          setCustomShowSignature(settings.showSignature === 'true');
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error('Failed to load invoice or design settings');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="loading-center"><div className="loading-spinner"></div></div>;
  
  if (!invoice) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <AlertCircle size={48} color="var(--color-danger)" style={{ marginBottom: 16 }} />
        <h3>Invoice Not Found</h3>
        <p>This order might not be fulfilled yet, or the invoice does not exist.</p>
        <button onClick={() => navigate('/dashboard/sales')} className="btn btn-primary" style={{ marginTop: 16 }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const items = invoice.items || [];
  const balanceDue = Math.max(0, invoice.grand_total - invoice.paid_amount);

  return (
    <div className="fade-in" style={{ padding: '10px 0' }}>
      
      {/* Top action bar - Hidden during print */}
      <div className="no-print" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 20, 
        background: 'var(--color-bg-card)', 
        padding: '12px 20px', 
        borderRadius: 12, 
        border: '1px solid var(--color-border)' 
      }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => navigate(-1)} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={16} /> Back
          </button>
          <button onClick={() => navigate('/dashboard/sales')} className="btn btn-secondary btn-sm">
            Sales Dashboard
          </button>
        </div>
        <button onClick={handlePrint} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 6, backgroundColor: 'var(--color-success)', borderColor: 'var(--color-success)' }}>
          <Printer size={16} /> Print / Save PDF
        </button>
      </div>

      {/* Main Grid: Customizer Sidebar + Document Preview */}
      <div style={{ display: 'flex', gap: 24, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* Left Column: Print Options Sidebar (No Print) */}
        <div className="no-print" style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Section 1: Template Toggles */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--color-border)', paddingBottom: 8, margin: 0 }}>
              <LayoutGrid size={15} className="text-primary" /> Invoice Layout Style
            </h3>

            {/* Quick Theme Switcher */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Choose Theme</label>
              <select 
                className="form-control" 
                value={customTheme} 
                onChange={e => setCustomTheme(e.target.value)}
                style={{ padding: '6px 10px', fontSize: 12 }}
              >
                <option value="modern">Modern Accent</option>
                <option value="classic">Classic Corporate</option>
                <option value="elegant">Elegant Serif</option>
                <option value="compact">Compact Receipt</option>
              </select>
            </div>

            {/* Quick Color Overrides */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Branding Override</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PRESET_COLORS.map(col => (
                  <button
                    key={col.value}
                    type="button"
                    onClick={() => setCustomPrimaryColor(col.value)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: col.value,
                      border: customPrimaryColor === col.value ? '2px solid var(--color-text-primary)' : '1px solid var(--color-border)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title={col.name}
                  >
                    {customPrimaryColor === col.value && <Check size={10} color="#ffffff" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Toggle Visibility Options */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--color-border)', paddingBottom: 8, margin: 0 }}>
              <Sliders size={15} className="text-primary" /> Invoice Options (Bulk/Retail)
            </h3>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showPaidStamp}
                onChange={e => setShowPaidStamp(e.target.checked)}
              />
              Overlay "PAID" Stamp
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={customShowLogo}
                onChange={e => setCustomShowLogo(e.target.checked)}
              />
              Show Company Logo
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={customShowGstin}
                onChange={e => setCustomShowGstin(e.target.checked)}
              />
              Show Company GSTIN
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showTaxBreakdown}
                onChange={e => setShowTaxBreakdown(e.target.checked)}
              />
              Show Detailed Tax Rate
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={customShowTerms}
                onChange={e => setCustomShowTerms(e.target.checked)}
              />
              Display Terms & Conditions
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={customShowSignature}
                onChange={e => setCustomShowSignature(e.target.checked)}
              />
              Include Signature Box
            </label>
          </div>

          <div style={{
            display: 'flex',
            gap: 8,
            padding: 12,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontSize: 11.5,
            color: 'var(--color-text-secondary)'
          }}>
            <Info size={16} className="text-primary" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ margin: 0 }}>
              Adjusting these checkboxes immediately alters the styles of the document on the right. Toggles here are hidden during PDF printing.
            </p>
          </div>
        </div>

        {/* Right Column: Dynamic Invoice Paper Document */}
        <div style={{ flex: '1.3 1 650px' }}>
          
          <div className="invoice-container" style={{ 
            background: '#ffffff', 
            color: '#1e293b', 
            padding: customTheme === 'compact' ? '20px 30px' : '40px 50px', 
            borderRadius: 8, 
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid #cbd5e1',
            maxWidth: '850px',
            margin: '0 auto',
            fontFamily: customTheme === 'elegant' ? '"Georgia", serif' : 'system-ui, -apple-system, sans-serif',
            fontSize: customTheme === 'compact' ? '12px' : '13.5px',
            position: 'relative',
            lineHeight: 1.5,
            transition: 'all 0.3s'
          }}>
            
            {/* Top accent bar for Modern Theme */}
            {customTheme === 'modern' && (
              <div style={{ 
                height: 10, 
                background: customPrimaryColor, 
                margin: customTheme === 'compact' ? '-20px -30px 14px -30px' : '-40px -50px 24px -50px', 
                borderTopLeftRadius: 6, 
                borderTopRightRadius: 6 
              }} />
            )}

            {/* PAID overlay stamp */}
            {showPaidStamp && (
              <div style={{
                position: 'absolute',
                top: '25%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(-12deg)',
                border: '4px double #10b981',
                borderRadius: 8,
                color: '#10b981',
                fontFamily: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
                fontSize: customTheme === 'compact' ? 44 : 64,
                letterSpacing: 2,
                padding: '4px 20px',
                opacity: 0.16,
                pointerEvents: 'none',
                userSelect: 'none',
                zIndex: 10
              }}>
                PAID & FULFILLED
              </div>
            )}
            
            {/* Header Block */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              borderBottom: `2px solid ${customTheme === 'modern' ? customPrimaryColor : '#e2e8f0'}`,
              paddingBottom: customTheme === 'compact' ? 14 : 24, 
              marginBottom: customTheme === 'compact' ? 14 : 24 
            }}>
              <div>
                {customShowLogo && customLogoUrl ? (
                  <img src={customLogoUrl} alt="Logo" style={{ maxHeight: 50, maxWidth: 180, marginBottom: 10, display: 'block' }} />
                ) : (
                  <h1 style={{ 
                    fontSize: customTheme === 'compact' ? 24 : 28, 
                    fontWeight: 800, 
                    color: customTheme === 'modern' ? customPrimaryColor : '#0f172a', 
                    margin: '0 0 4px 0', 
                    letterSpacing: '-0.5px' 
                  }}>
                    {customCompanyName}
                  </h1>
                )}
                {customCompanyAddress && <p style={{ margin: '2px 0', fontSize: '12px', color: '#64748b', whiteSpace: 'pre-line', maxWidth: 350 }}>{customCompanyAddress}</p>}
                {(customCompanyPhone || customCompanyEmail) && (
                  <p style={{ margin: '2px 0', fontSize: '11.5px', color: '#64748b' }}>
                    {customCompanyPhone && `Tel: ${customCompanyPhone}`} {customCompanyEmail && `| ${customCompanyEmail}`}
                  </p>
                )}
                {customCompanyWebsite && <p style={{ margin: '2px 0', fontSize: '11.5px', color: '#64748b' }}>{customCompanyWebsite}</p>}
                {customShowGstin && customGstin && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#475569', fontWeight: 600 }}>GSTIN: {customGstin}</p>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ 
                  fontSize: customTheme === 'compact' ? 20 : 24, 
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
                  fontSize: '10px', 
                  fontWeight: 700, 
                  padding: '3px 8px', 
                  borderRadius: 4, 
                  textTransform: 'uppercase', 
                  marginBottom: 8 
                }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={11} /> FULFILLED
                  </span>
                </div>
                <p style={{ margin: '2px 0', fontSize: '12px', fontWeight: 600 }}>Invoice #: <span style={{ color: customPrimaryColor }}>{invoice.invoice_number}</span></p>
                <p style={{ margin: '2px 0', fontSize: '12px', color: '#475569' }}>
                  Date: {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
                    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  }) : 'N/A'}
                </p>
              </div>
            </div>

            {/* Customer & Order metadata */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: customTheme === 'compact' ? 18 : 28 }}>
              <div style={{ flex: 1.2 }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '10.5px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>Billed To</h4>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '15.5px', fontWeight: 700, color: '#0f172a' }}>{invoice.customer}</h3>
                {invoice.remarks && (
                  <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#64748b', fontStyle: 'italic', background: '#f8fafc', padding: '6px 10px', borderRadius: 4, display: 'inline-block' }}>
                    <strong>Remarks:</strong> {invoice.remarks}
                  </p>
                )}
              </div>
              <div style={{ flex: 1, textAlign: 'right' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '10.5px', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>Order Details</h4>
                <p style={{ margin: '2px 0', fontSize: '12px' }}>Order No: <strong>{invoice.order_number}</strong></p>
                <p style={{ margin: '2px 0', fontSize: '12px' }}>Sales Rep: {invoice.created_by_name}</p>
                <p style={{ margin: '2px 0', fontSize: '12px' }}>Payment Mode: <strong style={{ color: '#0f172a' }}>{invoice.payment_mode || 'N/A'}</strong></p>
              </div>
            </div>

            {/* Itemized Table */}
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              marginBottom: customTheme === 'compact' ? 16 : 24, 
              fontSize: customTheme === 'compact' ? '11.5px' : '13px',
              border: customTheme === 'classic' ? '1px solid #cbd5e1' : 'none'
            }}>
              <thead>
                <tr style={{ 
                  background: customTheme === 'modern' ? 'rgba(241,245,249,0.9)' : customTheme === 'elegant' ? '#f8fafc' : '#f1f5f9', 
                  borderBottom: `2px solid ${customTheme === 'classic' ? '#cbd5e1' : '#cbd5e1'}` 
                }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#475569', width: '30px' }}>#</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Item Details</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', width: '70px' }}>Qty</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', width: '90px' }}>Rate</th>
                  {showTaxBreakdown && (
                    <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', width: '70px' }}>Tax Rate</th>
                  )}
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', width: '85px' }}>Discount</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#475569', width: '100px' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 8px', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.product_name}</div>
                      <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>Code: {item.product_code}</div>
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600 }}>{item.qty_required} {item.unit}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right' }}>₹{(item.unit_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    {showTaxBreakdown && (
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: '#475569' }}>{invoice.tax_percent}%</td>
                    )}
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: item.discount > 0 ? '#dc2626' : '#64748b' }}>
                      {item.discount > 0 ? `-₹${item.discount.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      ₹{(item.line_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Calculations and totals */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <div style={{ flex: 1.2 }}>
                {/* Terms / conditions */}
                {customShowTerms && customTerms && (
                  <div style={{ 
                    border: '1px solid #cbd5e1', 
                    padding: 10, 
                    borderRadius: 6, 
                    fontSize: '10.5px', 
                    color: '#64748b', 
                    marginRight: 40, 
                    background: '#f8fafc',
                    whiteSpace: 'pre-line'
                  }}>
                    <strong style={{ display: 'block', color: '#475569', marginBottom: 4 }}>Terms & Conditions:</strong>
                    {customTerms}
                  </div>
                )}
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Subtotal:</span>
                    <span style={{ fontWeight: 600 }}>₹{(invoice.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Tax ({invoice.tax_percent || 0}%):</span>
                    <span style={{ fontWeight: 600 }}>₹{(invoice.tax_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    borderTop: `1px solid ${customPrimaryColor}`, 
                    paddingTop: 8, 
                    fontSize: '14.5px', 
                    fontWeight: 700, 
                    color: '#0f172a' 
                  }}>
                    <span>Grand Total:</span>
                    <span style={{ color: customTheme === 'modern' ? customPrimaryColor : '#0f172a' }}>
                      ₹{(invoice.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #cbd5e1', paddingTop: 6 }}>
                    <span style={{ color: '#64748b' }}>Amount Paid:</span>
                    <span style={{ fontWeight: 600, color: '#16a34a' }}>₹{(invoice.paid_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span style={{ color: '#64748b' }}>Balance Due:</span>
                    <span style={{ color: balanceDue > 0 ? '#dc2626' : '#0f172a' }}>
                      ₹{balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Signature Line */}
            {customShowSignature && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: customTheme === 'compact' ? 30 : 50, paddingTop: 10 }}>
                <div style={{ fontSize: '9.5px', color: '#cbd5e1' }}>
                  Generated electronically by TTRIMS IMS.
                  <br />
                  System Timestamp: {new Date().toLocaleString('en-IN')}
                </div>
                <div style={{ textAlign: 'center', width: '200px' }}>
                  <div style={{ height: 40, borderBottom: '1px solid #cbd5e1', marginBottom: 6 }}></div>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#334155' }}>Authorized Signatory</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>{customCompanyName}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print Stylesheet Inject */}
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .invoice-container {
            border: none !important;
            box-shadow: none !important;
            padding: 10px 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
          /* Override general app layout spacing during printing */
          .app-layout, .main-content, .page-content {
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .sidebar, .topbar, .app-sidebar, .app-header {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
