import { useState, useEffect, useCallback } from 'react';
import { ordersAPI } from '../api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Receipt, DollarSign, TrendingUp, Clock, Search,
  CreditCard, Printer, AlertCircle, ChevronDown, ChevronUp,
  History, Banknote, CalendarDays, User, StickyNote, X, PhoneCall, Download
} from 'lucide-react';
import useBulkActions from '../hooks/useBulkActions';
import BulkActionBar from '../components/BulkActionBar';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(val) {
  return '₹' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}
function fmtDateShort(iso) {
  if (!iso) return '—';
  return iso.replace('T', ' ').substring(0, 16);
}
function agingColor(days) {
  if (days < 7)  return { color: '#10b981', label: 'Recent' };
  if (days < 30) return { color: '#f59e0b', label: 'Aging' };
  return { color: '#ef4444', label: 'Overdue' };
}
function isOverdue(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d <= today;
}

function getFollowUpStatusStyle(status) {
  switch (status) {
    case 'PENDING':
      return { background: 'rgba(255, 255, 255, 0.05)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' };
    case 'CONTACTED':
      return { background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.3)' };
    case 'PROMISE_TO_PAY':
      return { background: 'rgba(16, 185, 129, 0.15)', color: '#a7f3d0', border: '1px solid rgba(16, 185, 129, 0.3)' };
    case 'ESCALATED':
      return { background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' };
    case 'RESOLVED':
      return { background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd', border: '1px solid rgba(139, 92, 246, 0.3)' };
    default:
      return { background: 'rgba(255, 255, 255, 0.05)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' };
  }
}

// ─── Payment History Drawer ────────────────────────────────────────────────────
function PaymentHistoryDrawer({ invoiceId, onClose }) {
  const [data, setData] = useState(null);
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('PAYMENTS'); // PAYMENTS | FOLLOWUPS

  useEffect(() => {
    setLoading(true);
    Promise.all([
      ordersAPI.getPaymentHistory(invoiceId),
      ordersAPI.getFollowUps(invoiceId)
    ])
      .then(([payRes, followRes]) => {
        setData(payRes.data.data);
        setFollowups(followRes.data.data.followups || []);
      })
      .catch(() => toast.error('Failed to load history details'))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', justifyContent: 'flex-end'
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
      />
      {/* Drawer Panel */}
      <div style={{
        position: 'relative', width: 460, height: '100%', background: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-border)', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px', borderBottom: '1px solid var(--color-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <History size={18} color="var(--color-primary-light)" />
              <span style={{ fontWeight: 700, fontSize: 16 }}>Billing History & CRM</span>
            </div>
            {data && (
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                Invoice: <strong style={{ color: 'var(--color-primary-light)' }}>{data.invoice_number}</strong>
              </span>
            )}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }}>
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="loading-center" style={{ flex: 1 }}><div className="loading-spinner" /></div>
        ) : !data ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <AlertCircle size={32} style={{ opacity: 0.4 }} />
            <p>Unable to load history details.</p>
          </div>
        ) : (
          <>
            {/* Drawer Sub-tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.1)' }}>
              <button
                onClick={() => setActiveSubTab('PAYMENTS')}
                style={{
                  flex: 1, padding: '12px 8px', background: 'none', border: 'none',
                  borderBottom: activeSubTab === 'PAYMENTS' ? '2px solid var(--color-primary)' : '2px solid transparent',
                  color: activeSubTab === 'PAYMENTS' ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                💰 Payments ({data.installment_count})
              </button>
              <button
                onClick={() => setActiveSubTab('FOLLOWUPS')}
                style={{
                  flex: 1, padding: '12px 8px', background: 'none', border: 'none',
                  borderBottom: activeSubTab === 'FOLLOWUPS' ? '2px solid var(--color-primary)' : '2px solid transparent',
                  color: activeSubTab === 'FOLLOWUPS' ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                📞 Follow-Ups ({followups.length})
              </button>
            </div>

            <div style={{ padding: '20px 24px', flex: 1 }}>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
                {[
                  { label: 'Invoice Total', value: fmtCurrency(data.grand_total), color: '#3b82f6' },
                  { label: 'Total Paid', value: fmtCurrency(data.paid_amount), color: '#10b981' },
                  { label: 'Balance Due', value: fmtCurrency(data.balance), color: data.balance > 0 ? '#ef4444' : '#10b981' },
                ].map(c => (
                  <div key={c.label} style={{
                    padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${c.color}30`
                  }}>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>{c.label}</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: c.color }}>{c.value}</div>
                  </div>
                ))}
              </div>

              {/* PAYMENTS SUB-TAB */}
              {activeSubTab === 'PAYMENTS' && (
                <>
                  <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 13, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Payment Installments Timeline
                  </div>

                  {data.history.length === 0 ? (
                    <div style={{
                      padding: 24, textAlign: 'center', borderRadius: 10,
                      background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--color-border)'
                    }}>
                      <History size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                      <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                        No installment records found.<br />
                        <span style={{ fontSize: 11 }}>Payments made before history tracking was enabled are not shown here.</span>
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {data.history.map((tx, idx) => (
                        <div key={tx.id} style={{
                          padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--color-border)', position: 'relative'
                        }}>
                          {/* Installment number badge */}
                          <div style={{
                            position: 'absolute', top: -10, left: 14,
                            background: 'var(--color-primary)', color: '#fff',
                            borderRadius: 20, fontSize: 10, fontWeight: 700,
                            padding: '2px 8px'
                          }}>#{idx + 1}</div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 18, color: '#10b981' }}>
                                {fmtCurrency(tx.amount)}
                              </div>
                              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                                <span style={{
                                  fontSize: 10, padding: '2px 8px', borderRadius: 10,
                                  background: 'rgba(59,130,246,0.15)', color: '#93c5fd',
                                  fontWeight: 600, textTransform: 'uppercase'
                                }}>{tx.payment_mode || 'N/A'}</span>
                                {tx.notes && (
                                  <span style={{
                                    fontSize: 10, padding: '2px 8px', borderRadius: 10,
                                    background: 'rgba(139,92,246,0.12)', color: '#c4b5fd',
                                    display: 'flex', alignItems: 'center', gap: 3
                                  }}>
                                    <StickyNote size={9} /> {tx.notes}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Balance after</div>
                              <div style={{ fontWeight: 700, fontSize: 13, color: tx.balance_after > 0 ? '#f59e0b' : '#10b981' }}>
                                {fmtCurrency(tx.balance_after)}
                              </div>
                            </div>
                          </div>

                          <div style={{
                            marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--color-border)',
                            display: 'flex', gap: 14, fontSize: 11, color: 'var(--color-text-muted)'
                          }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <CalendarDays size={11} /> {fmtDateShort(tx.recorded_at)}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <User size={11} /> {tx.recorded_by}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* FOLLOW-UPS SUB-TAB */}
              {activeSubTab === 'FOLLOWUPS' && (
                <>
                  <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 13, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Follow-Up CRM Timeline
                  </div>

                  {followups.length === 0 ? (
                    <div style={{
                      padding: 24, textAlign: 'center', borderRadius: 10,
                      background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--color-border)'
                    }}>
                      <CalendarDays size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                      <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                        No follow-up records found.<br />
                        <span style={{ fontSize: 11 }}>Click the follow-up icon on the table row to schedule and record updates.</span>
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {followups.map((fu, idx) => {
                        const statusStyle = getFollowUpStatusStyle(fu.follow_up_status);
                        return (
                          <div key={fu.id} style={{
                            padding: '14px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--color-border)', position: 'relative'
                          }}>
                            {/* Follow-up index number badge */}
                            <div style={{
                              position: 'absolute', top: -10, left: 14,
                              background: 'var(--color-primary)', color: '#fff',
                              borderRadius: 20, fontSize: 10, fontWeight: 700,
                              padding: '2px 8px'
                            }}>Follow-Up #{followups.length - idx}</div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 }}>
                              <div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <span style={{
                                    fontSize: 10, padding: '2px 8px', borderRadius: 10,
                                    fontWeight: 600, textTransform: 'uppercase', ...statusStyle
                                  }}>{fu.follow_up_status}</span>
                                  {fu.contact_person && (
                                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                      Contact: <strong>{fu.contact_person}</strong>
                                    </span>
                                  )}
                                </div>
                                <p style={{ fontSize: 13, color: 'var(--color-text)', marginTop: 8, whiteSpace: 'pre-line', lineHeight: '1.4' }}>
                                  {fu.comments}
                                </p>
                              </div>
                            </div>

                            <div style={{
                              marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--color-border)',
                              display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)'
                            }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <CalendarDays size={11} /> Next: <strong style={{ color: 'var(--color-primary-light)' }}>{fu.next_follow_up_date}</strong>
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <User size={11} /> {fu.recorded_by} @ {fmtDateShort(fu.recorded_at)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function BillingPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [outstanding, setOutstanding] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingOutstanding, setLoadingOutstanding] = useState(false);
  const [activeTab, setActiveTab] = useState('LEDGER'); // LEDGER | FOLLOWUP
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');

  // History Drawer
  const [historyInvoiceId, setHistoryInvoiceId] = useState(null);

  // Payment Collection Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [modalHistory, setModalHistory] = useState(null);

  const loadInvoices = useCallback(() => {
    setLoading(true);
    ordersAPI.listInvoices()
      .then(res => setInvoices(res.data.data || []))
      .catch(() => toast.error('Failed to load invoice ledger'))
      .finally(() => setLoading(false));
  }, []);

  const loadOutstanding = useCallback(() => {
    setLoadingOutstanding(true);
    ordersAPI.listOutstanding()
      .then(res => setOutstanding(res.data.data || []))
      .catch(() => toast.error('Failed to load outstanding dues'))
      .finally(() => setLoadingOutstanding(false));
  }, []);

  useEffect(() => {
    loadInvoices();
    loadOutstanding();
  }, [loadInvoices, loadOutstanding]);

  const handleOpenPaymentModal = async (invoice) => {
    setSelectedInvoice(invoice);
    const balance = Math.max(0, invoice.grand_total - (invoice.paid_amount || 0));
    setPaymentAmount(balance.toFixed(2));
    setPaymentMode(invoice.payment_mode || 'CASH');
    setPaymentNotes('');
    setModalHistory(null);
    setShowPaymentModal(true);
    // Load history for context
    try {
      const res = await ordersAPI.getPaymentHistory(invoice.id);
      setModalHistory(res.data.data);
    } catch (_) {}
  };

  const handleCollectPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return toast.error('Please enter a valid positive payment amount');

    setSubmittingPayment(true);
    try {
      await ordersAPI.collectPayment(selectedInvoice.id, amount, paymentMode, paymentNotes.trim() || undefined);
      toast.success('Payment recorded successfully!');
      setShowPaymentModal(false);
      loadInvoices();
      loadOutstanding();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Follow-Up Modal State
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [followUpInvoice, setFollowUpInvoice] = useState(null);
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [followUpStatus, setFollowUpStatus] = useState('PENDING');
  const [contactPerson, setContactPerson] = useState('');
  const [followUpComments, setFollowUpComments] = useState('');
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);

  const handleOpenFollowUpModal = (invoice) => {
    setFollowUpInvoice(invoice);
    // Default next follow up date to tomorrow (formatted as YYYY-MM-DD)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    setNextFollowUpDate(`${yyyy}-${mm}-${dd}`);
    setFollowUpStatus(invoice.follow_up_status || 'PENDING');
    setContactPerson(invoice.contact_person || '');
    setFollowUpComments('');
    setShowFollowUpModal(true);
  };

  const handleRecordFollowUp = async (e) => {
    e.preventDefault();
    if (!followUpInvoice) return;
    if (!nextFollowUpDate) return toast.error('Please select next follow-up date');
    if (!followUpComments.trim()) return toast.error('Please enter follow-up comments/updates');

    setSubmittingFollowUp(true);
    try {
      await ordersAPI.addFollowUp(followUpInvoice.id, {
        next_follow_up_date: nextFollowUpDate,
        follow_up_status: followUpStatus,
        contact_person: contactPerson.trim() || undefined,
        comments: followUpComments.trim()
      });
      toast.success('Follow-up logged successfully!');
      setShowFollowUpModal(false);
      loadOutstanding();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record follow-up');
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  // ─── Derived data ──────────────────────────────────────────────────────────
  const invoicesWithBalance = invoices.map(inv => {
    const balance = Math.max(0, inv.grand_total - (inv.paid_amount || 0));
    let paymentStatus = 'UNPAID';
    if (balance <= 0) paymentStatus = 'PAID';
    else if (inv.paid_amount > 0) paymentStatus = 'PARTIAL';
    return { ...inv, balance, paymentStatus };
  });

  const filteredInvoices = invoicesWithBalance.filter(inv => {
    const q = searchTerm.toLowerCase();
    const matchSearch = inv.invoice_number.toLowerCase().includes(q) ||
                        inv.customer.toLowerCase().includes(q) ||
                        (inv.order_number && inv.order_number.toLowerCase().includes(q));
    const matchStatus = selectedStatus === 'ALL' || inv.paymentStatus === selectedStatus;
    const matchMethod = selectedMethod === 'ALL' || inv.payment_mode === selectedMethod;
    let matchType = true;
    if (selectedType === 'POS') matchType = inv.is_pos_order === true;
    else if (selectedType === 'BULK') matchType = !inv.is_pos_order;
    return matchSearch && matchStatus && matchMethod && matchType;
  });

  // KPIs
  const totalBilling   = invoices.reduce((s, i) => s + (i.grand_total || 0), 0);
  const totalCollected = invoices.reduce((s, i) => s + (i.paid_amount || 0), 0);
  const totalOutstanding = Math.max(0, totalBilling - totalCollected);
  const collectionRate   = totalBilling > 0 ? Math.round((totalCollected / totalBilling) * 100) : 100;
  const partialCount     = invoicesWithBalance.filter(i => i.paymentStatus === 'PARTIAL').length;
  const unpaidCount      = invoicesWithBalance.filter(i => i.paymentStatus === 'UNPAID').length;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID':    return 'badge-green';
      case 'PARTIAL': return 'badge-orange';
      case 'UNPAID':  return 'badge-red';
      default:        return 'badge-gray';
    }
  };

  // Initialize bulk action hooks
  const ledgerBulk = useBulkActions(filteredInvoices);
  const outstandingBulk = useBulkActions(outstanding);

  const handleBulkExportLedger = () => {
    const selected = ledgerBulk.getSelectedItems();
    let csvContent = 'Invoice #,Order Ref,Customer,Date Issued,Type,Grand Total,Paid,Balance,Status\n';
    
    selected.forEach(inv => {
      const typeStr = inv.is_pos_order ? 'RETAIL' : 'BULK';
      const row = [
        inv.invoice_number,
        inv.order_number || '',
        inv.customer,
        inv.invoice_date ? fmtDateShort(inv.invoice_date) : 'N/A',
        typeStr,
        inv.grand_total || 0,
        inv.paid_amount || 0,
        inv.balance || 0,
        inv.paymentStatus
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
      csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `invoice_ledger_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${ledgerBulk.selectedCount} invoices to CSV`);
  };

  const handleBulkExportOutstanding = () => {
    const selected = outstandingBulk.getSelectedItems();
    let csvContent = 'Invoice #,Customer,Date Issued,Balance Due,Paid,Grand Total,Days Overdue,Next Follow-Up Date,Follow-Up Status,Latest Remarks\n';
    
    selected.forEach(inv => {
      const balance = inv.balance || Math.max(0, inv.grand_total - (inv.paid_amount || 0));
      const row = [
        inv.invoice_number,
        inv.customer,
        inv.invoice_date ? fmtDateShort(inv.invoice_date).split(' ')[0] : '—',
        balance,
        inv.paid_amount || 0,
        inv.grand_total || 0,
        inv.days_overdue,
        inv.next_follow_up_date || 'Not Scheduled',
        inv.follow_up_status || 'NONE',
        inv.latest_comment || ''
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
      csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `outstanding_dues_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${outstandingBulk.selectedCount} accounts to CSV`);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in" style={{ maxWidth: 1300, margin: '0 auto' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="page-header-left">
          <h2>Invoice & Billing Ledger</h2>
          <p>Track cash collections, manage accounts receivable, and follow up on outstanding dues</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-secondary btn-sm" onClick={() => { loadInvoices(); loadOutstanding(); }}
            style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><Receipt size={20} color="#3b82f6" /></div>
          <div className="kpi-value">{fmtCurrency(totalBilling)}</div>
          <div className="kpi-label">Total Invoiced</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-icon green"><DollarSign size={20} color="#10b981" /></div>
          <div className="kpi-value">{fmtCurrency(totalCollected)}</div>
          <div className="kpi-label">Revenue Collected</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-icon orange"><Clock size={20} color="#f59e0b" /></div>
          <div className="kpi-value">{fmtCurrency(totalOutstanding)}</div>
          <div className="kpi-label">Accounts Receivable</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-icon purple"><TrendingUp size={20} color="#8b5cf6" /></div>
          <div className="kpi-value">{collectionRate}%</div>
          <div className="kpi-label">Collection Efficiency</div>
        </div>
      </div>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
        <button
          onClick={() => { setActiveTab('LEDGER'); ledgerBulk.clearSelection(); }}
          className={`btn ${activeTab === 'LEDGER' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: 13.5, padding: '8px 16px' }}
        >
          📄 Invoices History / Ledger
        </button>
        <button
          onClick={() => { setActiveTab('FOLLOWUP'); outstandingBulk.clearSelection(); }}
          className={`btn ${activeTab === 'FOLLOWUP' ? 'btn-primary' : 'btn-ghost'}`}
          style={{ fontSize: 13.5, padding: '8px 16px', display: 'flex', gap: 6, alignItems: 'center' }}
        >
          ⏰ Aging & Collections
          {unpaidCount + partialCount > 0 && (
            <span className="badge badge-red" style={{ fontSize: 10, padding: '2px 6px', fontWeight: 700 }}>
              {unpaidCount + partialCount} Dues
            </span>
          )}
        </button>
      </div>

      {/* ══ LEDGER TAB ═══════════════════════════════════════════════════════ */}
      {activeTab === 'LEDGER' && (
        <>
          {/* Filters Card */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="filters-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              
              {/* Search Bar */}
              <div className="form-group" style={{ minWidth: 220, flex: 1 }}>
                <label className="form-label" style={{ fontSize: 10 }}>Search Ledger</label>
                <div className="search-bar" style={{ width: '100%' }}>
                  <Search size={14} />
                  <input type="text" className="form-control" style={{ width: '100%' }}
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Invoice #, Order Ref, Customer..." />
                </div>
              </div>

              {/* Status Filter */}
              <div className="form-group" style={{ minWidth: 140 }}>
                <label className="form-label" style={{ fontSize: 10 }}>Status</label>
                <select className="form-control" value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
                  <option value="ALL">All Statuses</option>
                  <option value="PAID">Fully Paid</option>
                  <option value="PARTIAL">Partially Paid</option>
                  <option value="UNPAID">Unpaid</option>
                </select>
              </div>

              {/* Type Filter */}
              <div className="form-group" style={{ minWidth: 130 }}>
                <label className="form-label" style={{ fontSize: 10 }}>Billing Type</label>
                <select className="form-control" value={selectedType} onChange={e => setSelectedType(e.target.value)}>
                  <option value="ALL">All Channels</option>
                  <option value="POS">Retail (POS)</option>
                  <option value="BULK">Bulk Sales</option>
                </select>
              </div>

              {/* Method Filter */}
              <div className="form-group" style={{ minWidth: 140 }}>
                <label className="form-label" style={{ fontSize: 10 }}>Payment Mode</label>
                <select className="form-control" value={selectedMethod} onChange={e => setSelectedMethod(e.target.value)}>
                  <option value="ALL">All Methods</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI Transfer</option>
                  <option value="CARD">Card</option>
                  <option value="NETBANKING">Net Banking</option>
                  <option value="CREDIT">Credit</option>
                </select>
              </div>
            </div>

            {/* Quick Status Tabs shortcut */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              {[
                { value: 'ALL',     label: `All Invoices (${invoicesWithBalance.length})` },
                { value: 'PAID',    label: `✅ Fully Paid (${invoicesWithBalance.filter(i => i.paymentStatus === 'PAID').length})` },
                { value: 'PARTIAL', label: `🔸 Partial (${partialCount})` },
                { value: 'UNPAID',  label: `🔴 Unpaid (${unpaidCount})` },
              ].map(tab => (
                <button key={tab.value} onClick={() => setSelectedStatus(tab.value)}
                  className={`btn btn-sm ${selectedStatus === tab.value ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '6px 12px', fontSize: 12.5 }}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ledger Table */}
          <div className="card">
            {loading ? (
              <div className="loading-center" style={{ padding: 60 }}><div className="loading-spinner" /></div>
            ) : filteredInvoices.length === 0 ? (
              <div className="empty-state" style={{ padding: 60 }}>
                <Receipt size={40} style={{ opacity: 0.5 }} />
                <h3>No Bills Found</h3>
                <p>No processed invoices match the current filters.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={ledgerBulk.isAllSelected} 
                          onChange={ledgerBulk.toggleSelectAll} 
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                      <th>Invoice #</th>
                      <th>Order Ref</th>
                      <th>Customer</th>
                      <th>Date Issued</th>
                      <th>Type</th>
                      <th>Grand Total</th>
                      <th>Paid</th>
                      <th>Balance</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right', width: 160 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map(inv => {
                      const isChecked = ledgerBulk.isSelected(inv.id);
                      return (
                        <tr key={inv.id} style={{ background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={isChecked} 
                              onChange={() => ledgerBulk.toggleSelect(inv.id)} 
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--color-primary-light)' }}>{inv.invoice_number}</td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{inv.order_number || '—'}</td>
                          <td style={{ fontWeight: 600 }}>{inv.customer}</td>
                          <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                            {inv.invoice_date ? fmtDateShort(inv.invoice_date) : 'N/A'}
                          </td>
                          <td>
                            <span className={`badge ${inv.is_pos_order ? 'badge-blue' : 'badge-purple'}`} style={{ fontSize: 9.5 }}>
                              {inv.is_pos_order ? 'RETAIL' : 'BULK'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{fmtCurrency(inv.grand_total)}</td>
                          <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{fmtCurrency(inv.paid_amount)}</td>
                          <td style={{ color: inv.balance > 0 ? 'var(--color-danger)' : 'inherit', fontWeight: 700 }}>
                            {fmtCurrency(inv.balance)}
                          </td>
                          <td><span className={`badge ${getStatusBadge(inv.paymentStatus)}`}>{inv.paymentStatus}</span></td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn-ghost btn-icon btn-sm text-primary"
                                onClick={() => setHistoryInvoiceId(inv.id)} title="View Payment History">
                                <History size={14} />
                              </button>
                              <button className="btn btn-ghost btn-icon btn-sm text-primary"
                                onClick={() => navigate(`/invoice/${inv.id}`)} title="Print Invoice">
                                <Printer size={14} />
                              </button>
                              {inv.balance > 0 && (
                                <button className="btn btn-secondary btn-sm"
                                  style={{ padding: '4px 8px', fontSize: 11.5 }}
                                  onClick={() => handleOpenPaymentModal(inv)}>
                                  <CreditCard size={12} style={{ marginRight: 4 }} />
                                  Collect
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══ FOLLOW-UP TAB ════════════════════════════════════════════════════ */}
      {activeTab === 'FOLLOWUP' && (
        <div className="card">
          {/* Legend */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)' }}>Aging Legend:</span>
            {[
              { color: '#10b981', label: '< 7 days (Recent)' },
              { color: '#f59e0b', label: '7–30 days (Aging)' },
              { color: '#ef4444', label: '> 30 days (Overdue)' },
            ].map(a => (
              <span key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: a.color, display: 'inline-block' }} />
                {a.label}
              </span>
            ))}
          </div>

          {loadingOutstanding ? (
            <div className="loading-center" style={{ padding: 60 }}><div className="loading-spinner" /></div>
          ) : outstanding.length === 0 ? (
            <div className="empty-state" style={{ padding: 70 }}>
              <span style={{ fontSize: 48 }}>🎉</span>
              <h3>All Caught Up!</h3>
              <p>No outstanding balances found. All invoices are fully paid.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={outstandingBulk.isAllSelected} 
                        onChange={outstandingBulk.toggleSelectAll} 
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ width: 16 }}></th>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th>Balance Due</th>
                    <th>Days Overdue</th>
                    <th>Next Follow-Up</th>
                    <th>Status</th>
                    <th>Latest Update</th>
                    <th style={{ textAlign: 'right', width: 200 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {outstanding.map(inv => {
                    const aging = agingColor(inv.days_overdue);
                    const balance = inv.balance || Math.max(0, inv.grand_total - (inv.paid_amount || 0));
                    const paymentStatus = inv.paid_amount > 0 ? 'PARTIAL' : 'UNPAID';
                    const isChecked = outstandingBulk.isSelected(inv.id);
                    return (
                      <tr key={inv.id} style={{ borderLeft: `3px solid ${aging.color}`, background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => outstandingBulk.toggleSelect(inv.id)} 
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: aging.color, display: 'inline-block' }} title={aging.label} />
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--color-primary-light)' }}>{inv.invoice_number}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600 }}>{inv.customer}</span>
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                              Issued: {inv.invoice_date ? fmtDateShort(inv.invoice_date).split(' ')[0] : '—'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ color: aging.color, fontWeight: 700 }}>{fmtCurrency(balance)}</span>
                            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                              Paid: {fmtCurrency(inv.paid_amount)} / Total: {fmtCurrency(inv.grand_total)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{
                              fontWeight: 700, padding: '2px 8px', borderRadius: 12, fontSize: 11,
                              background: `${aging.color}20`, color: aging.color, width: 'fit-content'
                            }}>{inv.days_overdue}d</span>
                            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                              Last Paid: {inv.last_payment_date ? fmtDateShort(inv.last_payment_date).split(' ')[0] : 'Never'}
                            </span>
                          </div>
                        </td>
                        <td>
                          {inv.next_follow_up_date ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={isOverdue(inv.next_follow_up_date) ? { color: 'var(--color-danger)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 } : { fontWeight: 600 }}>
                                {isOverdue(inv.next_follow_up_date) && <AlertCircle size={12} />}
                                {inv.next_follow_up_date}
                              </span>
                              {inv.follow_up_recorded_by && (
                                <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>by {inv.follow_up_recorded_by}</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: 12 }}>Not Scheduled</span>
                          )}
                        </td>
                        <td>
                          {inv.follow_up_status ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{
                                fontSize: 10, padding: '2px 8px', borderRadius: 10,
                                fontWeight: 600, textTransform: 'uppercase', width: 'fit-content',
                                ...getFollowUpStatusStyle(inv.follow_up_status)
                              }}>{inv.follow_up_status}</span>
                              {inv.contact_person && (
                                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inv.contact_person}>
                                  Contact: {inv.contact_person}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', textTransform: 'uppercase' }}>NONE</span>
                          )}
                        </td>
                        <td style={{ maxWidth: 180 }}>
                          {inv.latest_comment ? (
                            <div style={{
                              fontSize: 12, color: 'var(--color-text)', overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }} title={inv.latest_comment}>
                              {inv.latest_comment}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button className="btn btn-ghost btn-icon btn-sm text-primary"
                              onClick={() => setHistoryInvoiceId(inv.id)} title="View History & CRM">
                              <History size={14} />
                            </button>
                            <button className="btn btn-ghost btn-icon btn-sm text-primary"
                              onClick={() => navigate(`/invoice/${inv.id}`)} title="Print Invoice">
                              <Printer size={14} />
                            </button>
                            <button className="btn btn-ghost btn-icon btn-sm text-primary"
                              onClick={() => handleOpenFollowUpModal(inv)} title="Record CRM Follow-Up">
                              <PhoneCall size={14} />
                            </button>
                            <button className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px', fontSize: 11.5 }}
                              onClick={() => handleOpenPaymentModal({ ...inv, balance, paymentStatus })}>
                              <CreditCard size={12} style={{ marginRight: 4 }} />
                              Collect
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ PAYMENT HISTORY DRAWER ═══════════════════════════════════════════ */}
      {historyInvoiceId && (
        <PaymentHistoryDrawer
          invoiceId={historyInvoiceId}
          onClose={() => setHistoryInvoiceId(null)}
        />
      )}

      {/* ══ COLLECT PAYMENT MODAL ════════════════════════════════════════════ */}
      {showPaymentModal && selectedInvoice && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <form className="modal" onSubmit={handleCollectPayment} onClick={e => e.stopPropagation()}
            style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CreditCard size={18} className="text-primary" />
                Record Customer Payment
              </h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPaymentModal(false)}>×</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Invoice Summary */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
                background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 10,
                border: '1px solid var(--color-border)'
              }}>
                <div>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Invoice</span>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-primary-light)' }}>{selectedInvoice.invoice_number}</div>
                </div>
                <div>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Customer</span>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{selectedInvoice.customer}</div>
                </div>
                <div>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Grand Total</span>
                  <div style={{ fontWeight: 700 }}>{fmtCurrency(selectedInvoice.grand_total)}</div>
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Paid So Far</span>
                  <div style={{ fontWeight: 700, color: '#10b981' }}>{fmtCurrency(selectedInvoice.paid_amount)}</div>
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Balance Due</span>
                  <div style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{fmtCurrency(selectedInvoice.balance)}</div>
                </div>
                {modalHistory && (
                  <div style={{ marginTop: 4 }}>
                    <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Installments</span>
                    <div style={{ fontWeight: 700 }}>{modalHistory.installment_count} recorded</div>
                  </div>
                )}
              </div>

              {/* Prior payments mini-list */}
              {modalHistory && modalHistory.history.length > 0 && (
                <div style={{
                  borderRadius: 8, border: '1px solid var(--color-border)',
                  background: 'rgba(255,255,255,0.01)', maxHeight: 120, overflowY: 'auto'
                }}>
                  <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border)' }}>
                    Prior Payments
                  </div>
                  {modalHistory.history.map((tx, i) => (
                    <div key={tx.id} style={{
                      display: 'flex', justifyContent: 'space-between', padding: '7px 12px', fontSize: 12,
                      borderBottom: i < modalHistory.history.length - 1 ? '1px solid var(--color-border)' : 'none'
                    }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>#{i + 1} · {fmtDateShort(tx.recorded_at)} · {tx.payment_mode}</span>
                      <span style={{ fontWeight: 700, color: '#10b981' }}>+{fmtCurrency(tx.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Amount */}
              <div className="form-group">
                <label className="form-label">
                  <Banknote size={13} style={{ marginRight: 5 }} />
                  Payment Amount Received (₹) <span className="text-danger">*</span>
                </label>
                <input type="number" step="any" className="form-control"
                  value={paymentAmount} min="0.01"
                  max={selectedInvoice.balance}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="0.00" required />
              </div>

              {/* Mode */}
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-control" value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                  <option value="CASH">Cash Payment</option>
                  <option value="UPI">UPI Transfer</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="NETBANKING">Net Banking</option>
                  <option value="CREDIT">Customer Credit</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">
                  <StickyNote size={13} style={{ marginRight: 5 }} />
                  Notes / Reference (optional)
                </label>
                <input type="text" className="form-control"
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Cheque #1234, Advance deposit, Bank Ref..." />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submittingPayment}>
                {submittingPayment ? 'Recording...' : 'Record Payment Receipt'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══ RECORD FOLLOW-UP MODAL ═══════════════════════════════════════════ */}
      {showFollowUpModal && followUpInvoice && (
        <div className="modal-overlay" onClick={() => setShowFollowUpModal(false)}>
          <form className="modal" onSubmit={handleRecordFollowUp} onClick={e => e.stopPropagation()}
            style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PhoneCall size={18} className="text-primary" />
                Schedule & Record Follow-Up
              </h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowFollowUpModal(false)}>×</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Invoice Summary */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
                background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 10,
                border: '1px solid var(--color-border)'
              }}>
                <div>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Invoice</span>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-primary-light)' }}>{followUpInvoice.invoice_number}</div>
                </div>
                <div>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Customer</span>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{followUpInvoice.customer}</div>
                </div>
                <div>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Balance Due</span>
                  <div style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{fmtCurrency(followUpInvoice.balance || (followUpInvoice.grand_total - (followUpInvoice.paid_amount || 0)))}</div>
                </div>
              </div>

              {/* Next Follow Up Date */}
              <div className="form-group">
                <label className="form-label">
                  <CalendarDays size={13} style={{ marginRight: 5 }} />
                  Next Follow-Up Date <span className="text-danger">*</span>
                </label>
                <input type="date" className="form-control"
                  value={nextFollowUpDate}
                  onChange={e => setNextFollowUpDate(e.target.value)}
                  required />
              </div>

              {/* Status */}
              <div className="form-group">
                <label className="form-label">Follow-Up Status <span className="text-danger">*</span></label>
                <select className="form-control" value={followUpStatus} onChange={e => setFollowUpStatus(e.target.value)} required>
                  <option value="PENDING">Pending (Not Attempted)</option>
                  <option value="CONTACTED">Contacted (In Discussion)</option>
                  <option value="PROMISE_TO_PAY">Promise to Pay</option>
                  <option value="ESCALATED">Escalated to Manager</option>
                  <option value="RESOLVED">Resolved / Fully Collected</option>
                </select>
              </div>

              {/* Contact Person */}
              <div className="form-group">
                <label className="form-label">
                  <User size={13} style={{ marginRight: 5 }} />
                  Contact Person (optional)
                </label>
                <input type="text" className="form-control"
                  value={contactPerson}
                  onChange={e => setContactPerson(e.target.value)}
                  placeholder="e.g. John Doe, Accounts Dept" />
              </div>

              {/* Comments */}
              <div className="form-group">
                <label className="form-label">
                  Comments / Updates <span className="text-danger">*</span>
                </label>
                <textarea className="form-control" rows="4"
                  value={followUpComments}
                  onChange={e => setFollowUpComments(e.target.value)}
                  placeholder="Record full details of conversation, payment commitment details..."
                  style={{ resize: 'vertical' }}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowFollowUpModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submittingFollowUp}>
                {submittingFollowUp ? 'Logging...' : 'Save Follow-Up CRM Entry'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Action Bar for Invoices Ledger (active when Tab is LEDGER) */}
      {activeTab === 'LEDGER' && (
        <BulkActionBar 
          selectedCount={ledgerBulk.selectedCount}
          onClear={ledgerBulk.clearSelection}
          actions={[
            {
              label: 'Export CSV',
              icon: <Download size={16} />,
              onClick: handleBulkExportLedger,
              className: 'btn-secondary'
            }
          ]}
        />
      )}

      {/* Floating Action Bar for Outstanding Dues (active when Tab is FOLLOWUP) */}
      {activeTab === 'FOLLOWUP' && (
        <BulkActionBar 
          selectedCount={outstandingBulk.selectedCount}
          onClear={outstandingBulk.clearSelection}
          actions={[
            {
              label: 'Export CSV',
              icon: <Download size={16} />,
              onClick: handleBulkExportOutstanding,
              className: 'btn-secondary'
            }
          ]}
        />
      )}
    </div>
  );
}
