/**
 * SalesCRMDashboard.jsx
 * Primary workspace for Sales Person role.
 * Focuses on:
 *  - Outstanding dues with aging indicators
 *  - CRM Follow-Up scheduling and recording
 *  - Payment collection
 *  - Personal stats (my follow-ups, overdue items)
 */
import { useState, useEffect, useCallback } from 'react';
import { ordersAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  PhoneCall, CalendarDays, User, X, Check, AlertCircle,
  Clock, TrendingUp, DollarSign, Search, RefreshCw,
  ChevronDown, ChevronUp, History, StickyNote, Banknote,
  CreditCard, CheckCircle2, MessageSquareMore, ClipboardList,
  Wallet, IndentIncrease, Bell, UserCheck, Target
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(val) {
  return '₹' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}
function fmtDateShort(iso) {
  if (!iso) return '—';
  return iso.replace('T', ' ').substring(0, 16);
}
function agingColor(days) {
  if (days < 7)  return { color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: 'Recent' };
  if (days < 30) return { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Aging' };
  return { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Overdue' };
}
function isOverdue(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d <= today;
}
function getFollowUpStatusStyle(status) {
  switch (status) {
    case 'PENDING':         return { bg: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' };
    case 'CONTACTED':       return { bg: 'rgba(59,130,246,0.15)',  color: '#93c5fd',  border: '1px solid rgba(59,130,246,0.3)' };
    case 'PROMISE_TO_PAY':  return { bg: 'rgba(16,185,129,0.15)',  color: '#a7f3d0',  border: '1px solid rgba(16,185,129,0.3)' };
    case 'ESCALATED':       return { bg: 'rgba(239,68,68,0.15)',   color: '#fca5a5',  border: '1px solid rgba(239,68,68,0.3)' };
    case 'RESOLVED':        return { bg: 'rgba(139,92,246,0.15)',  color: '#c4b5fd',  border: '1px solid rgba(139,92,246,0.3)' };
    default:                return { bg: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' };
  }
}

// ─── Follow-Up Modal ──────────────────────────────────────────────────────────
function FollowUpModal({ invoice, onClose, onSaved }) {
  const [status, setStatus]             = useState('CONTACTED');
  const [comments, setComments]         = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [nextDate, setNextDate]         = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [history, setHistory]           = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab]       = useState('LOG'); // LOG | HISTORY

  useEffect(() => {
    ordersAPI.getFollowUps(invoice.id)
      .then(r => setHistory(r.data.data.followups || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [invoice.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comments.trim()) return toast.error('Please enter follow-up comments');
    setSubmitting(true);
    try {
      await ordersAPI.addFollowUp(invoice.id, {
        follow_up_status: status,
        comments: comments.trim(),
        contact_person: contactPerson.trim() || undefined,
        next_follow_up_date: nextDate || undefined,
      });
      toast.success('Follow-up recorded!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save follow-up');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', width: 560, maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--color-surface)', borderRadius: 16,
        border: '1px solid var(--color-border)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.12))',
          borderBottom: '1px solid var(--color-border)',
          borderRadius: '16px 16px 0 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <PhoneCall size={18} color="#3b82f6" />
              <span style={{ fontWeight: 700, fontSize: 16 }}>CRM Follow-Up</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Invoice: <strong style={{ color: 'var(--color-primary-light)' }}>{invoice.invoice_number}</strong>
              {' · '}<span>{invoice.customer_name}</span>
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>
                Balance: {fmtCurrency(Math.max(0, invoice.grand_total - (invoice.paid_amount || 0)))}
              </span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }}><X size={16} /></button>
        </div>

        {/* Sub-tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.1)' }}>
          {[
            { key: 'LOG', label: '📝 Log Follow-Up' },
            { key: 'HISTORY', label: `📞 History (${history.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              flex: 1, padding: '12px 8px', background: 'none', border: 'none',
              borderBottom: activeTab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === t.key ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s'
            }}>{t.label}</button>
          ))}
        </div>

        <div style={{ padding: '20px 24px' }}>
          {activeTab === 'LOG' && (
            <form onSubmit={handleSubmit}>
              {/* Status */}
              <div className="form-group">
                <label className="form-label">Follow-Up Status *</label>
                <select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="CONTACTED">📞 Contacted</option>
                  <option value="PROMISE_TO_PAY">✅ Promise to Pay</option>
                  <option value="PENDING">⏳ Pending / No Response</option>
                  <option value="ESCALATED">🚨 Escalated</option>
                  <option value="RESOLVED">✔️ Resolved</option>
                </select>
              </div>

              {/* Contact Person */}
              <div className="form-group">
                <label className="form-label">Contact Person Spoken To</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="e.g. Mr. Rajan, Accounts dept…"
                  value={contactPerson}
                  onChange={e => setContactPerson(e.target.value)}
                />
              </div>

              {/* Comments */}
              <div className="form-group">
                <label className="form-label">Current Follow-Up Update / Comments *</label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Describe what was discussed, any commitments made, payment timeline mentioned…"
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {/* Next Follow-Up Date */}
              <div className="form-group">
                <label className="form-label">Next Follow-Up Date</label>
                <input
                  className="form-control"
                  type="date"
                  value={nextDate}
                  onChange={e => setNextDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ flex: 1 }}>
                  {submitting ? 'Saving…' : '💾 Save Follow-Up'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              </div>
            </form>
          )}

          {activeTab === 'HISTORY' && (
            <div>
              {loadingHistory ? (
                <div className="loading-center" style={{ padding: 40 }}><div className="loading-spinner" /></div>
              ) : history.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <PhoneCall size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p>No follow-up history yet.</p>
                  <p style={{ fontSize: 12 }}>Switch to the "Log Follow-Up" tab to record your first update.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {history.map((fu, idx) => {
                    const ss = getFollowUpStatusStyle(fu.follow_up_status);
                    return (
                      <div key={fu.id} style={{
                        padding: '14px 16px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)',
                        position: 'relative'
                      }}>
                        <div style={{
                          position: 'absolute', top: -10, left: 14,
                          background: 'var(--color-primary)', color: '#fff',
                          borderRadius: 20, fontSize: 10, fontWeight: 700, padding: '2px 8px'
                        }}>#{history.length - idx}</div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <div>
                            <span style={{
                              fontSize: 10, padding: '2px 8px', borderRadius: 10,
                              fontWeight: 600, textTransform: 'uppercase',
                              background: ss.bg, color: ss.color, border: ss.border
                            }}>{fu.follow_up_status}</span>
                            {fu.contact_person && (
                              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 8 }}>
                                Contact: <strong>{fu.contact_person}</strong>
                              </span>
                            )}
                          </div>
                        </div>
                        <p style={{ fontSize: 13, marginTop: 10, whiteSpace: 'pre-line', lineHeight: '1.5', color: 'var(--color-text-primary)' }}>
                          {fu.comments}
                        </p>
                        <div style={{
                          marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--color-border)',
                          display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)'
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CalendarDays size={11} /> Next: <strong style={{ color: '#3b82f6' }}>{fu.next_follow_up_date || '—'}</strong>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Payment Collection Modal ─────────────────────────────────────────────────
function PaymentModal({ invoice, onClose, onSaved }) {
  const balance = Math.max(0, (invoice.grand_total || 0) - (invoice.paid_amount || 0));
  const [amount, setAmount]   = useState(balance.toFixed(2));
  const [mode, setMode]       = useState(invoice.payment_mode || 'CASH');
  const [notes, setNotes]     = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return toast.error('Enter a valid amount');
    setSubmitting(true);
    try {
      await ordersAPI.collectPayment(invoice.id, amt, mode, notes.trim() || undefined);
      toast.success('Payment recorded!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'relative', width: 440,
        background: 'var(--color-surface)', borderRadius: 16,
        border: '1px solid var(--color-border)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          padding: '20px 24px 16px',
          background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.1))',
          borderBottom: '1px solid var(--color-border)',
          borderRadius: '16px 16px 0 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <DollarSign size={18} color="#10b981" />
              <span style={{ fontWeight: 700, fontSize: 16 }}>Collect Payment</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {invoice.invoice_number} · {invoice.customer_name}
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 700 }}>Outstanding: {fmtCurrency(balance)}</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
          <div className="form-group">
            <label className="form-label">Amount to Collect (₹) *</label>
            <input className="form-control" type="number" step="0.01" min="0.01"
              value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Payment Mode *</label>
            <select className="form-control" value={mode} onChange={e => setMode(e.target.value)}>
              <option value="CASH">💵 Cash</option>
              <option value="UPI">📱 UPI</option>
              <option value="BANK_TRANSFER">🏦 Bank Transfer</option>
              <option value="CHEQUE">📝 Cheque</option>
              <option value="CREDIT">💳 Credit</option>
              <option value="OTHER">⚙ Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes (optional)</label>
            <input className="form-control" type="text"
              placeholder="Reference, cheque number, etc."
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ flex: 1, background: '#10b981', borderColor: '#10b981' }}>
              {submitting ? 'Processing…' : '✔ Record Payment'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Outstanding Row ──────────────────────────────────────────────────────────
function OutstandingRow({ inv, onFollowUp, onPayment, expanded, onToggle }) {
  const balance = Math.max(0, (inv.grand_total || 0) - (inv.paid_amount || 0));
  const age = agingColor(inv.aging_days || 0);
  const overdue = isOverdue(inv.latest_next_follow_up_date);
  const ss = inv.latest_follow_up_status ? getFollowUpStatusStyle(inv.latest_follow_up_status) : null;

  return (
    <>
      <tr style={{ cursor: 'pointer' }} onClick={onToggle}>
        <td>
          <div style={{ fontWeight: 700, color: 'var(--color-primary-light)', fontSize: 13 }}>{inv.invoice_number}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{inv.order_number}</div>
        </td>
        <td>
          <div style={{ fontWeight: 600 }}>{inv.customer_name}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{fmtDateShort(inv.invoice_date)}</div>
        </td>
        <td style={{ fontWeight: 700, color: '#ef4444', fontSize: 15 }}>{fmtCurrency(balance)}</td>
        <td>
          <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: 20,
            background: age.bg, color: age.color, fontSize: 11, fontWeight: 700
          }}>{inv.aging_days ?? '—'}d · {age.label}</span>
        </td>
        <td>
          {ss ? (
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 20,
              background: ss.bg, color: ss.color, border: ss.border,
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase'
            }}>{inv.latest_follow_up_status}</span>
          ) : (
            <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>No contact yet</span>
          )}
        </td>
        <td>
          {inv.latest_next_follow_up_date ? (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
              color: overdue ? '#ef4444' : 'var(--color-text-primary)', fontWeight: overdue ? 700 : 400
            }}>
              <CalendarDays size={12} color={overdue ? '#ef4444' : undefined} />
              {inv.latest_next_follow_up_date}
              {overdue && <span style={{ fontSize: 10, background: '#ef444420', color: '#ef4444', padding: '1px 6px', borderRadius: 8, fontWeight: 700 }}>DUE</span>}
            </span>
          ) : (
            <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>
          )}
        </td>
        <td onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}
              onClick={() => onFollowUp(inv)}
              title="Log CRM Follow-Up"
            >
              <PhoneCall size={13} /> Follow-Up
            </button>
            <button
              className="btn btn-primary btn-sm"
              style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, background: '#10b981', borderColor: '#10b981' }}
              onClick={() => onPayment(inv)}
              title="Collect Payment"
            >
              <DollarSign size={13} /> Pay
            </button>
          </div>
        </td>
        <td style={{ width: 32, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} style={{ padding: 0, background: 'rgba(0,0,0,0.08)' }}>
            <div style={{ padding: '14px 24px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Invoice Total: </span>
                <strong>{fmtCurrency(inv.grand_total)}</strong>
              </div>
              <div style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Paid: </span>
                <strong style={{ color: '#10b981' }}>{fmtCurrency(inv.paid_amount || 0)}</strong>
              </div>
              <div style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Payment Mode: </span>
                <strong>{inv.payment_mode || '—'}</strong>
              </div>
              {inv.latest_comments && (
                <div style={{ fontSize: 12, flex: 1, minWidth: 200 }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Last Note: </span>
                  <em style={{ color: 'var(--color-text-primary)' }}>{inv.latest_comments}</em>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function SalesCRMDashboard() {
  const { user } = useAuth();
  const [outstanding, setOutstanding] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [expandedRow, setExpandedRow]   = useState(null);

  // Modal state
  const [followUpInvoice, setFollowUpInvoice] = useState(null);
  const [paymentInvoice, setPaymentInvoice]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    ordersAPI.listOutstanding()
      .then(res => setOutstanding(res.data.data || []))
      .catch(() => toast.error('Failed to load outstanding dues'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalDue      = outstanding.reduce((s, i) => s + Math.max(0, (i.grand_total || 0) - (i.paid_amount || 0)), 0);
  const overdueCount  = outstanding.filter(i => isOverdue(i.latest_next_follow_up_date)).length;
  const noContactCount = outstanding.filter(i => !i.latest_follow_up_status).length;
  const dueToday       = outstanding.filter(i => {
    if (!i.latest_next_follow_up_date) return false;
    const d = new Date(i.latest_next_follow_up_date); d.setHours(0,0,0,0);
    const t = new Date(); t.setHours(0,0,0,0);
    return d.getTime() === t.getTime();
  }).length;

  // ── Filter / Search ────────────────────────────────────────────────────────
  const filtered = outstanding.filter(inv => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.customer_name?.toLowerCase().includes(q) ||
      inv.order_number?.toLowerCase().includes(q);
    const matchStatus = filterStatus === 'ALL' ||
      (filterStatus === 'NO_CONTACT' && !inv.latest_follow_up_status) ||
      (filterStatus === 'OVERDUE' && isOverdue(inv.latest_next_follow_up_date)) ||
      (filterStatus === 'TODAY' && (() => {
        if (!inv.latest_next_follow_up_date) return false;
        const d = new Date(inv.latest_next_follow_up_date); d.setHours(0,0,0,0);
        const t = new Date(); t.setHours(0,0,0,0);
        return d.getTime() === t.getTime();
      })()) ||
      inv.latest_follow_up_status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Sort: overdue first, then by aging days desc
  const sorted = [...filtered].sort((a, b) => {
    const aOverdue = isOverdue(a.latest_next_follow_up_date) ? 1 : 0;
    const bOverdue = isOverdue(b.latest_next_follow_up_date) ? 1 : 0;
    if (bOverdue !== aOverdue) return bOverdue - aOverdue;
    return (b.aging_days || 0) - (a.aging_days || 0);
  });

  return (
    <div className="fade-in">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-left">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PhoneCall size={22} color="#3b82f6" />
            CRM &amp; Collections Workspace
          </h2>
          <p>Track outstanding dues, log follow-ups, and collect payments. Welcome, {user?.name}.</p>
        </div>
        <div className="page-header-right">
          <button
            className="btn btn-secondary btn-sm"
            onClick={load}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────────────── */}
      <div className="kpi-grid" style={{ marginBottom: 28 }}>
        <div className="kpi-card red">
          <div className="kpi-icon red"><Wallet size={20} color="#ef4444" /></div>
          <div className="kpi-value" style={{ fontSize: '1.3rem' }}>{fmtCurrency(totalDue)}</div>
          <div className="kpi-label">Total Outstanding</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-icon orange"><ClipboardList size={20} color="#f59e0b" /></div>
          <div className="kpi-value">{outstanding.length}</div>
          <div className="kpi-label">Open Invoices</div>
        </div>
        <div className="kpi-card red">
          <div className="kpi-icon red"><Bell size={20} color="#ef4444" /></div>
          <div className="kpi-value">{overdueCount}</div>
          <div className="kpi-label">Overdue Follow-Ups</div>
        </div>
        <div className="kpi-card blue">
          <div className="kpi-icon blue"><Target size={20} color="#3b82f6" /></div>
          <div className="kpi-value">{dueToday}</div>
          <div className="kpi-label">Due Today</div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-icon purple"><UserCheck size={20} color="#8b5cf6" /></div>
          <div className="kpi-value">{noContactCount}</div>
          <div className="kpi-label">Never Contacted</div>
        </div>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
            <Search size={15} style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)'
            }} />
            <input
              className="form-control"
              style={{ paddingLeft: 32, margin: 0 }}
              placeholder="Search invoice, customer, order…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { key: 'ALL',           label: `All (${outstanding.length})` },
              { key: 'OVERDUE',       label: `⚠ Overdue (${overdueCount})` },
              { key: 'TODAY',         label: `📅 Due Today (${dueToday})` },
              { key: 'NO_CONTACT',    label: `🚫 No Contact (${noContactCount})` },
              { key: 'CONTACTED',     label: 'Contacted' },
              { key: 'PROMISE_TO_PAY', label: 'Promise' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={`btn btn-sm ${filterStatus === f.key ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: 12 }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Outstanding Table ───────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Outstanding Collections</div>
            <div className="card-subtitle">{sorted.length} invoices requiring follow-up</div>
          </div>
          <MessageSquareMore size={18} color="var(--color-primary)" />
        </div>

        {loading ? (
          <div className="loading-center" style={{ padding: 60 }}><div className="loading-spinner" /></div>
        ) : sorted.length === 0 ? (
          <div className="empty-state" style={{ padding: 60 }}>
            <CheckCircle2 size={40} color="#10b981" style={{ opacity: 0.5, marginBottom: 12 }} />
            <p style={{ fontWeight: 600, fontSize: 15 }}>All caught up!</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              {search || filterStatus !== 'ALL'
                ? 'No results match your current filter.'
                : 'No outstanding dues at the moment.'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Balance Due</th>
                  <th>Aging</th>
                  <th>CRM Status</th>
                  <th>Next Follow-Up</th>
                  <th>Actions</th>
                  <th style={{ width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(inv => (
                  <OutstandingRow
                    key={inv.id}
                    inv={inv}
                    onFollowUp={setFollowUpInvoice}
                    onPayment={setPaymentInvoice}
                    expanded={expandedRow === inv.id}
                    onToggle={() => setExpandedRow(expandedRow === inv.id ? null : inv.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {followUpInvoice && (
        <FollowUpModal
          invoice={followUpInvoice}
          onClose={() => setFollowUpInvoice(null)}
          onSaved={load}
        />
      )}
      {paymentInvoice && (
        <PaymentModal
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
