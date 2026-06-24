/**
 * SalesCRM.jsx — CRM Follow-Ups Module
 * Full outstanding list, filters, log follow-up bottom sheet, follow-up history, and Lead creation modal.
 */
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { ordersAPI } from '../../api';
import toast from 'react-hot-toast';
import {
  PhoneCall, CalendarDays, ChevronDown, X,
  Search, User, CheckCircle2, RefreshCw
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v) {
  return '₹' + (v||0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function isOverdue(d) {
  if (!d) return false;
  const dt = new Date(d); dt.setHours(0,0,0,0);
  const t = new Date(); t.setHours(0,0,0,0);
  return dt < t;
}
function isToday(d) {
  if (!d) return false;
  const dt = new Date(d); dt.setHours(0,0,0,0);
  const t = new Date(); t.setHours(0,0,0,0);
  return dt.getTime() === t.getTime();
}
function agingStyle(days) {
  if ((days||0) < 7)  return { color: '#10b981', label: 'Recent' };
  if ((days||0) < 30) return { color: '#f59e0b', label: 'Aging' };
  return { color: '#ef4444', label: 'Overdue' };
}
function chipClass(status) {
  switch (status) {
    case 'CONTACTED':       return 'blue';
    case 'PROMISE_TO_PAY':  return 'green';
    case 'ESCALATED':       return 'red';
    case 'RESOLVED':        return 'purple';
    case 'PENDING':         return 'orange';
    default:                return 'gray';
  }
}

// ── Follow-Up Bottom Sheet ────────────────────────────────────────────────────
function FollowUpSheet({ invoice, onClose, onSaved }) {
  const [tab, setTab]                 = useState('LOG');
  const [status, setStatus]           = useState('CONTACTED');
  const [comments, setComments]       = useState('');
  const [contact, setContact]         = useState('');
  const [nextDate, setNextDate]       = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [submitting, setSubmitting]   = useState(false);
  const [history, setHistory]         = useState([]);
  const [loadingHist, setLoadingHist] = useState(true);

  useEffect(() => {
    ordersAPI.getFollowUps(invoice.id)
      .then(r => setHistory(r.data.data.followups || []))
      .catch(() => {})
      .finally(() => setLoadingHist(false));
  }, [invoice.id]);

  const balance = Math.max(0, (invoice.grand_total||0) - (invoice.paid_amount||0));

  const submit = async (e) => {
    e.preventDefault();
    if (!comments.trim()) return toast.error('Comments are required');
    setSubmitting(true);
    try {
      await ordersAPI.addFollowUp(invoice.id, {
        follow_up_status: status,
        comments: comments.trim(),
        contact_person: contact.trim() || undefined,
        next_follow_up_date: nextDate || undefined,
      });
      toast.success('Follow-up saved!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="s-sheet-overlay" onClick={onClose}>
      <div className="s-sheet" onClick={e => e.stopPropagation()}>
        <div className="s-sheet-handle" />

        {/* Header */}
        <div className="s-sheet-header">
          <div>
            <div className="s-sheet-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <PhoneCall size={18} color="#3b82f6" /> CRM Follow-Up
            </div>
            <div className="s-sheet-sub">
              <strong style={{ color: '#93c5fd' }}>{invoice.invoice_number || 'LEAD'}</strong> · {invoice.customer_name || invoice.customer}
            </div>
            <div style={{ marginTop: 6, fontSize: 13 }}>
              Balance: <strong style={{ color: '#ef4444' }}>{fmt(balance)}</strong>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--s-text-2)', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="s-tabs">
          <button className={`s-tab${tab==='LOG' ? ' active' : ''}`} onClick={() => setTab('LOG')}>
            📝 Log Follow-Up
          </button>
          <button className={`s-tab${tab==='HIST' ? ' active' : ''}`} onClick={() => setTab('HIST')}>
            📞 History ({history.length})
          </button>
        </div>

        <div className="s-sheet-body">
          {tab === 'LOG' && (
            <form onSubmit={submit}>
              {/* Status */}
              <div className="s-form-group">
                <label className="s-label">Follow-Up Status *</label>
                <select className="s-select" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="CONTACTED">📞 Contacted</option>
                  <option value="PROMISE_TO_PAY">✅ Promise to Pay</option>
                  <option value="PENDING">⏳ Pending / No Response</option>
                  <option value="ESCALATED">🚨 Escalated</option>
                  <option value="RESOLVED">✔️ Resolved</option>
                </select>
              </div>

              {/* Contact Person */}
              <div className="s-form-group">
                <label className="s-label">Contact Person Spoken To</label>
                <input className="s-input" type="text" placeholder="e.g. Mr. Rajan, Accounts…"
                  value={contact} onChange={e => setContact(e.target.value)} />
              </div>

              {/* Comments */}
              <div className="s-form-group">
                <label className="s-label">Current Update / Comments *</label>
                <textarea className="s-textarea" rows={4}
                  placeholder="What was discussed? Any payment promise? Next steps?"
                  value={comments} onChange={e => setComments(e.target.value)} />
              </div>

              {/* Next Follow-Up Date */}
              <div className="s-form-group">
                <label className="s-label">Next Follow-Up Date</label>
                <input className="s-input" type="date" value={nextDate}
                  onChange={e => setNextDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]} />
              </div>

              <button type="submit" className="s-btn success xl" disabled={submitting}>
                {submitting ? '⏳ Saving…' : '💾 Save Follow-Up'}
              </button>
            </form>
          )}

          {tab === 'HIST' && (
            <div>
              {loadingHist ? (
                <div className="s-spinner-wrap"><div className="s-spinner" /></div>
              ) : history.length === 0 ? (
                <div className="s-empty">
                  <PhoneCall size={32} style={{ opacity: 0.3 }} />
                  <p className="title">No history yet</p>
                  <p className="sub">Switch to Log Follow-Up to record your first update.</p>
                </div>
              ) : (
                <div className="s-timeline">
                  {history.map((fu, idx) => (
                    <div key={fu.id} className="s-tl-entry">
                      <div className="s-tl-dot" style={{
                        background: fu.follow_up_status === 'PROMISE_TO_PAY' ? '#10b981'
                          : fu.follow_up_status === 'ESCALATED' ? '#ef4444'
                          : fu.follow_up_status === 'CONTACTED' ? '#3b82f6'
                          : '#64748b'
                      }} />
                      <div className="s-tl-body">
                        <div className="s-tl-head">
                          <span className={`s-chip ${chipClass(fu.follow_up_status)}`}>
                            {fu.follow_up_status}
                          </span>
                          <span className="s-text-xs s-text-muted">#{history.length - idx}</span>
                        </div>
                        {fu.contact_person && (
                          <div style={{ fontSize: 12, color: 'var(--s-text-2)', marginTop: 4 }}>
                            Contact: <strong>{fu.contact_person}</strong>
                          </div>
                        )}
                        <p style={{ fontSize: 13, marginTop: 6, lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                          {fu.comments}
                        </p>
                        <div className="s-tl-meta s-row gap-12">
                          <span className="s-row gap-4">
                            <CalendarDays size={11} />
                            Next: <strong style={{ color: '#3b82f6' }}>{fu.next_follow_up_date || '—'}</strong>
                          </span>
                          <span className="s-row gap-4">
                            <User size={11} /> {fu.recorded_by}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add Lead Bottom Sheet ──────────────────────────────────────────────────
function AddLeadSheet({ onClose, onSaved }) {
  const [leadName, setLeadName]       = useState('');
  const [phone, setPhone]             = useState('');
  const [email, setEmail]             = useState('');
  const [estValue, setEstValue]       = useState('');
  const [remarks, setRemarks]         = useState('');
  const [submitting, setSubmitting]   = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!leadName.trim()) return toast.error('Lead / Customer Name is required');
    setSubmitting(true);
    try {
      await ordersAPI.create({
        customer: leadName.trim(),
        remarks: remarks.trim() || undefined,
        grand_total: parseFloat(estValue) || 0.0,
        is_lead: true,
        custom_fields: {
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          is_lead: "true"
        }
      });
      toast.success('Lead created successfully!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create lead');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="s-sheet-overlay" onClick={onClose}>
      <div className="s-sheet" onClick={e => e.stopPropagation()}>
        <div className="s-sheet-handle" />

        {/* Header */}
        <div className="s-sheet-header">
          <div>
            <div className="s-sheet-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              👤 Add New Lead / Customer
            </div>
            <div className="s-sheet-sub">Create a prospective account or sales target</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--s-text-2)', cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <div className="s-sheet-body">
          <form onSubmit={submit}>
            {/* Customer Name */}
            <div className="s-form-group">
              <label className="s-label">Customer / Company Name *</label>
              <input className="s-input" type="text" placeholder="e.g. Acme Corp / John Doe"
                value={leadName} onChange={e => setLeadName(e.target.value)} required />
            </div>

            {/* Contact Phone */}
            <div className="s-form-group">
              <label className="s-label">Phone Number</label>
              <input className="s-input" type="tel" placeholder="e.g. +91 98765 43210"
                value={phone} onChange={e => setPhone(e.target.value)} />
            </div>

            {/* Contact Email */}
            <div className="s-form-group">
              <label className="s-label">Email Address</label>
              <input className="s-input" type="email" placeholder="e.g. buyer@example.com"
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>

            {/* Estimated Budget / Value */}
            <div className="s-form-group">
              <label className="s-label">Est. Deal Value (Budget) *</label>
              <input className="s-input" type="number" placeholder="e.g. 50000" min="0" step="any"
                value={estValue} onChange={e => setEstValue(e.target.value)} required />
            </div>

            {/* Remarks / Requirements */}
            <div className="s-form-group">
              <label className="s-label">Requirements / Remarks</label>
              <textarea className="s-textarea" rows={3}
                placeholder="Product interest, delivery details, initial discussion notes…"
                value={remarks} onChange={e => setRemarks(e.target.value)} />
            </div>

            <button type="submit" className="s-btn success xl" disabled={submitting}>
              {submitting ? '⏳ Creating Lead...' : '💾 Save Lead Details'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main CRM Page ─────────────────────────────────────────────────────────────
export default function SalesCRM() {
  const location   = useLocation();
  const urlParams  = new URLSearchParams(location.search);
  const initFilter = urlParams.get('filter') || 'ALL';

  const [outstanding, setOutstanding] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [filter, setFilter]           = useState(initFilter);
  const [expandedId, setExpandedId]   = useState(null);
  const [sheetInvoice, setSheetInvoice] = useState(null);
  const [showAddLeadSheet, setShowAddLeadSheet] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    ordersAPI.listOutstanding()
      .then(r => setOutstanding(r.data.data || []))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Counts for filter chips ────────────────────────────────────────────────
  const leadsCount     = outstanding.filter(i => i.status === 'PENDING').length;
  const invoicesCount  = outstanding.filter(i => i.status !== 'PENDING').length;
  const overdueCount   = outstanding.filter(i => isOverdue(i.latest_next_follow_up_date)).length;
  const todayCount     = outstanding.filter(i => isToday(i.latest_next_follow_up_date)).length;
  const noContactCount = outstanding.filter(i => !i.latest_follow_up_status).length;
  const promiseCount   = outstanding.filter(i => i.latest_follow_up_status === 'PROMISE_TO_PAY').length;

  // ── Filtered + sorted list ─────────────────────────────────────────────────
  const filtered = outstanding.filter(inv => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.order_number?.toLowerCase().includes(q) ||
      inv.customer?.toLowerCase().includes(q) ||
      inv.customer_name?.toLowerCase().includes(q);

    let matchFilter = true;
    if (filter === 'OVERDUE')     matchFilter = isOverdue(inv.latest_next_follow_up_date);
    else if (filter === 'TODAY')  matchFilter = isToday(inv.latest_next_follow_up_date);
    else if (filter === 'NO_CONTACT') matchFilter = !inv.latest_follow_up_status;
    else if (filter === 'LEADS')  matchFilter = inv.status === 'PENDING';
    else if (filter === 'INVOICES') matchFilter = inv.status !== 'PENDING';
    else if (filter !== 'ALL')    matchFilter = inv.latest_follow_up_status === filter;

    return matchSearch && matchFilter;
  }).sort((a, b) => {
    const ao = isOverdue(a.latest_next_follow_up_date) ? 1 : 0;
    const bo = isOverdue(b.latest_next_follow_up_date) ? 1 : 0;
    if (bo !== ao) return bo - ao;
    return (b.aging_days||0) - (a.aging_days||0);
  });

  const FILTERS = [
    { key: 'ALL',            label: `All (${outstanding.length})` },
    { key: 'LEADS',          label: `📝 Leads (${leadsCount})` },
    { key: 'INVOICES',       label: `🧾 Invoices (${invoicesCount})` },
    { key: 'OVERDUE',        label: `⚠ Overdue (${overdueCount})` },
    { key: 'TODAY',          label: `📅 Today (${todayCount})` },
    { key: 'NO_CONTACT',     label: `🚫 No Contact (${noContactCount})` },
    { key: 'PROMISE_TO_PAY', label: `✅ Promise (${promiseCount})` },
  ];

  return (
    <div className="s-page s-fade-in">
      {/* Header */}
      <div className="s-row between s-mb-12">
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>CRM Follow-Ups</div>
          <div className="s-text-sm s-text-muted">{outstanding.length} CRM items assigned</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="s-btn success sm"
            onClick={() => setShowAddLeadSheet(true)}
            style={{ display: 'flex', gap: 5, alignItems: 'center' }}
          >
            ➕ Add Lead
          </button>
          <button
            className="s-btn ghost sm"
            onClick={load}
            style={{ display: 'flex', gap: 5, alignItems: 'center' }}
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="s-search">
        <Search size={16} className="s-search-icon" />
        <input
          type="text"
          placeholder="Search customer, lead or invoice…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'var(--s-text-3)', cursor: 'pointer', padding: 0 }}>
            <X size={15} />
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="s-filter-row">
        {FILTERS.map(f => (
          <button
            key={f.key}
            className={`s-filter-chip${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="s-spinner-wrap"><div className="s-spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="s-card">
          <div className="s-empty">
            <CheckCircle2 size={36} color="#10b981" style={{ opacity: 0.5 }} />
            <p className="title">All clear!</p>
            <p className="sub">No leads or invoices match the selected filter.</p>
          </div>
        </div>
      ) : (
        <div className="s-card">
          <div className="s-list">
            {filtered.map(inv => {
              const balance = Math.max(0, (inv.grand_total||0) - (inv.paid_amount||0));
              const aging   = agingStyle(inv.aging_days);
              const overdue = isOverdue(inv.latest_next_follow_up_date);
              const isExp   = expandedId === inv.id;
              const name    = inv.customer_name || inv.customer || 'Customer';

              return (
                <div key={inv.id}>
                  {/* Main row */}
                  <div className="s-list-item" onClick={() => setExpandedId(isExp ? null : inv.id)}>
                    <div className="s-list-avatar" style={{
                      background: inv.status === 'PENDING' ? 'rgba(16,185,129,0.15)' : `${aging.color}22`,
                      color: inv.status === 'PENDING' ? '#10b981' : aging.color,
                      fontWeight: 800,
                      fontSize: 16
                    }}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="s-list-body">
                      <div className="s-list-title">{name}</div>
                      <div className="s-list-sub" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{inv.invoice_number || inv.order_number}</span>
                        {inv.status === 'PENDING' && (
                          <span className="s-chip green" style={{ fontSize: 8.5, padding: '1px 5px', fontWeight: 800 }}>LEAD</span>
                        )}
                      </div>
                      <div style={{ marginTop: 5, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="s-chip" style={{ fontSize: 9, padding: '2px 7px', background: `${aging.color}22`, color: aging.color }}>
                          {inv.aging_days ?? 0}d · {inv.status === 'PENDING' ? 'Prospect' : aging.label}
                        </span>
                        {inv.latest_follow_up_status ? (
                          <span className={`s-chip ${chipClass(inv.latest_follow_up_status)}`}>
                            {inv.latest_follow_up_status}
                          </span>
                        ) : (
                          <span className="s-chip gray">No contact</span>
                        )}
                        {overdue && <span className="s-badge-overdue">OVERDUE</span>}
                      </div>
                    </div>
                    <div className="s-list-right">
                      <div className="s-list-amount s-text-danger">{fmt(balance)}</div>
                      <div className="s-list-date">
                        {inv.latest_next_follow_up_date
                          ? (overdue
                              ? <span style={{ color: '#ef4444' }}>Due: {inv.latest_next_follow_up_date}</span>
                              : `Next: ${inv.latest_next_follow_up_date}`)
                          : 'Schedule follow-up'}
                      </div>
                    </div>
                    <ChevronDown size={16} color="var(--s-text-3)" style={{
                      flexShrink: 0, transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s'
                    }} />
                  </div>

                  {/* Expanded section */}
                  {isExp && (
                    <div className="s-expand-row">
                      {inv.latest_comment && (
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 11, color: 'var(--s-text-3)', fontWeight: 600 }}>LAST NOTE: </span>
                          <em style={{ fontSize: 13 }}>{inv.latest_comment}</em>
                          {inv.contact_person && (
                            <span style={{ fontSize: 11.5, color: 'var(--s-text-2)', marginLeft: 8 }}>
                              (Spoke with: <strong>{inv.contact_person}</strong>)
                            </span>
                          )}
                        </div>
                      )}
                      <div className="s-expand-row-inner" style={{ marginBottom: 12 }}>
                        <div>
                          <span className="s-text-xs s-text-muted">{inv.status === 'PENDING' ? 'Est. Budget: ' : 'Invoice Total: '}</span>
                          <strong>{fmt(inv.grand_total)}</strong>
                        </div>
                        <div>
                          <span className="s-text-xs s-text-muted">Paid Amount: </span>
                          <strong style={{ color: '#10b981' }}>{fmt(inv.paid_amount||0)}</strong>
                        </div>
                        {inv.remarks && (
                          <div style={{ gridColumn: 'span 2', marginTop: 4 }}>
                            <span className="s-text-xs s-text-muted">Requirements: </span>
                            <span style={{ fontSize: 12.5, color: 'var(--s-text-1)' }}>{inv.remarks}</span>
                          </div>
                        )}
                        {inv.custom_fields && (inv.custom_fields.phone || inv.custom_fields.email) && (
                          <div style={{ gridColumn: 'span 2', marginTop: 4, display: 'flex', gap: 14 }}>
                            {inv.custom_fields.phone && (
                              <span style={{ fontSize: 12 }}>📞 {inv.custom_fields.phone}</span>
                            )}
                            {inv.custom_fields.email && (
                              <span style={{ fontSize: 12 }}>✉️ {inv.custom_fields.email}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        className="s-btn primary md"
                        style={{ width: '100%' }}
                        onClick={e => { e.stopPropagation(); setSheetInvoice(inv); }}
                      >
                        <PhoneCall size={14} /> Log Follow-Up
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Sheet */}
      {sheetInvoice && (
        <FollowUpSheet
          invoice={sheetInvoice}
          onClose={() => setSheetInvoice(null)}
          onSaved={load}
        />
      )}

      {/* Add Lead Bottom Sheet */}
      {showAddLeadSheet && (
        <AddLeadSheet
          onClose={() => setShowAddLeadSheet(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
