/**
 * SalesCollections.jsx — Collections Module
 * Track outstanding invoices, record partial or full cash/digital collections.
 * View historical payments recorded by the salesperson.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ordersAPI } from '../../api';
import toast from 'react-hot-toast';
import {
  Wallet, DollarSign, Search, Clock, Calendar, CheckCircle2,
  AlertCircle, StickyNote, History, ArrowRight, CreditCard,
  User, Check, ChevronRight, X, Filter
} from 'lucide-react';

function fmtCurrency(v) {
  return '₹' + (v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDateShort(iso) {
  if (!iso) return '—';
  return iso.replace('T', ' ').substring(0, 16);
}

function getAgingLabel(days) {
  if (days === undefined || days === null) return { text: 'N/A', class: 'gray' };
  if (days < 7) return { text: `${days}d (New)`, class: 'green' };
  if (days < 30) return { text: `${days}d (Aging)`, class: 'orange' };
  return { text: `${days}d (Overdue)`, class: 'red' };
}

export default function SalesCollections() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('OUTSTANDING'); // OUTSTANDING | HISTORY
  const [searchTerm, setSearchTerm] = useState('');
  const [historyFilter, setHistoryFilter] = useState('MY'); // MY | ALL

  // Payment Form bottom sheet state
  const [showSheet, setShowSheet] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load invoices and payment history
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordersAPI.listInvoices();
      const list = res.data.data || [];
      setInvoices(list);

      // Fetch payment histories for all invoices that have some paid amount
      const paidInvoices = list.filter(inv => (inv.paid_amount || 0) > 0);
      const histories = await Promise.all(
        paidInvoices.map(async (inv) => {
          try {
            const hRes = await ordersAPI.getPaymentHistory(inv.id);
            return (hRes.data.data.history || []).map(tx => ({
              ...tx,
              invoice_number: inv.invoice_number,
              customer_name: inv.customer,
              invoice_id: inv.id
            }));
          } catch (_) {
            return [];
          }
        })
      );
      const allTx = histories.flat().sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
      setPayments(allTx);
    } catch (err) {
      toast.error('Failed to load collections data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Derived calculations
  const outstandingInvoices = invoices
    .map(inv => {
      const bal = Math.max(0, inv.grand_total - (inv.paid_amount || 0));
      return { ...inv, balance: bal };
    })
    .filter(inv => inv.balance > 0);

  const filteredOutstanding = outstandingInvoices.filter(inv => {
    const q = searchTerm.toLowerCase();
    return (
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.customer.toLowerCase().includes(q)
    );
  });

  const filteredPayments = payments.filter(p => {
    if (historyFilter === 'MY') {
      return p.recorded_by === user?.name;
    }
    return true;
  });

  // KPI Metrics
  const totalOutstanding = outstandingInvoices.reduce((s, i) => s + i.balance, 0);
  const totalCollectedToday = payments
    .filter(p => {
      const pDate = new Date(p.recorded_at).toDateString();
      const today = new Date().toDateString();
      return pDate === today;
    })
    .reduce((s, p) => s + p.amount, 0);

  const totalCollectedByMe = payments
    .filter(p => p.recorded_by === user?.name)
    .reduce((s, p) => s + p.amount, 0);

  const openSheet = (inv) => {
    setSelectedInvoice(inv);
    setAmount(inv.balance.toString());
    setPaymentMode('CASH');
    setNotes('');
    setShowSheet(true);
  };

  const closeSheet = () => {
    setShowSheet(false);
    setSelectedInvoice(null);
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    const pAmt = parseFloat(amount);
    if (isNaN(pAmt) || pAmt <= 0) {
      return toast.error('Enter a valid amount');
    }
    if (pAmt > selectedInvoice.balance) {
      return toast.error(`Amount exceeds outstanding balance of ${fmtCurrency(selectedInvoice.balance)}`);
    }

    setSubmitting(true);
    try {
      await ordersAPI.collectPayment(selectedInvoice.id, pAmt, paymentMode, notes.trim() || undefined);
      toast.success('Payment logged successfully');
      closeSheet();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="s-page s-fade-in">
      {/* KPI Stats Header */}
      <div className="s-kpi-row cols-3">
        <div className="s-kpi red">
          <div className="s-kpi-icon red"><Wallet size={14} color="#ef4444" /></div>
          <div className="s-kpi-val sm">{loading ? '…' : fmtCurrency(totalOutstanding)}</div>
          <div className="s-kpi-label">Outstanding</div>
        </div>
        <div className="s-kpi green">
          <div className="s-kpi-icon green"><DollarSign size={14} color="#10b981" /></div>
          <div className="s-kpi-val sm">{loading ? '…' : fmtCurrency(totalCollectedToday)}</div>
          <div className="s-kpi-label">Today's Collections</div>
        </div>
        <div className="s-kpi purple">
          <div className="s-kpi-icon purple"><History size={14} color="#8b5cf6" /></div>
          <div className="s-kpi-val sm">{loading ? '…' : fmtCurrency(totalCollectedByMe)}</div>
          <div className="s-kpi-label">My Total Cash</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="s-tabs s-mb-16">
        <button
          className={`s-tab${activeTab === 'OUTSTANDING' ? ' active' : ''}`}
          onClick={() => setActiveTab('OUTSTANDING')}
        >
          📋 Due Invoices ({outstandingInvoices.length})
        </button>
        <button
          className={`s-tab${activeTab === 'HISTORY' ? ' active' : ''}`}
          onClick={() => setActiveTab('HISTORY')}
        >
          💰 Recent Timeline ({filteredPayments.length})
        </button>
      </div>

      {/* Search bar for outstanding */}
      {activeTab === 'OUTSTANDING' && (
        <div className="s-search">
          <Search className="s-search-icon" size={16} />
          <input
            type="text"
            placeholder="Search invoice or customer..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      {/* History filters */}
      {activeTab === 'HISTORY' && (
        <div className="s-filter-row">
          <button
            className={`s-filter-chip${historyFilter === 'MY' ? ' active' : ''}`}
            onClick={() => setHistoryFilter('MY')}
          >
            👤 My Collections
          </button>
          <button
            className={`s-filter-chip${historyFilter === 'ALL' ? ' active' : ''}`}
            onClick={() => setHistoryFilter('ALL')}
          >
            🌍 All Collections
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="s-spinner-wrap">
          <div className="s-spinner" />
        </div>
      ) : activeTab === 'OUTSTANDING' ? (
        /* OUTSTANDING LIST */
        filteredOutstanding.length === 0 ? (
          <div className="s-empty">
            <CheckCircle2 size={40} color="#10b981" style={{ opacity: 0.6 }} />
            <p className="title">No outstanding balances</p>
            <p className="sub">All invoices are fully paid! Great job.</p>
          </div>
        ) : (
          <div className="s-card">
            <div className="s-list">
              {filteredOutstanding.map(inv => {
                const aging = getAgingLabel(inv.aging_days);
                return (
                  <div key={inv.id} className="s-list-item" onClick={() => openSheet(inv)}>
                    <div className="s-list-avatar" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
                      {(inv.customer || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div className="s-list-body">
                      <div className="s-list-title">{inv.customer}</div>
                      <div className="s-list-sub">
                        {inv.invoice_number} · {inv.invoice_date ? inv.invoice_date.split('T')[0] : 'N/A'}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <span className={`s-chip ${aging.class}`}>{aging.text}</span>
                      </div>
                    </div>
                    <div className="s-list-right" style={{ marginRight: 6 }}>
                      <div className="s-list-amount s-text-danger">{fmtCurrency(inv.balance)}</div>
                      <div className="s-list-date">Total: {fmtCurrency(inv.grand_total)}</div>
                    </div>
                    <ChevronRight size={16} color="var(--s-text-3)" style={{ flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        /* HISTORY TIMELINE */
        filteredPayments.length === 0 ? (
          <div className="s-empty">
            <AlertCircle size={40} color="var(--s-text-3)" style={{ opacity: 0.6 }} />
            <p className="title">No collections found</p>
            <p className="sub">No payments have been collected under this filter yet.</p>
          </div>
        ) : (
          <div className="s-timeline">
            {filteredPayments.map(tx => (
              <div key={tx.id} className="s-tm-item">
                <div className="s-tm-badge">
                  <DollarSign size={13} color="#fff" />
                </div>
                <div className="s-tm-content">
                  <div className="s-tm-header">
                    <span className="s-tm-title">{tx.customer_name}</span>
                    <span className="s-tm-amount">{fmtCurrency(tx.amount)}</span>
                  </div>
                  <div className="s-tm-sub">
                    Invoice: <strong style={{ color: 'var(--s-primary)' }}>{tx.invoice_number}</strong>
                  </div>
                  <div className="s-tm-desc">
                    <span className="s-chip gray" style={{ padding: '1px 6px', fontSize: 9 }}>{tx.payment_mode || 'CASH'}</span>
                    {tx.notes && (
                      <span className="s-tm-note" style={{ marginLeft: 8 }}>
                        <StickyNote size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                        {tx.notes}
                      </span>
                    )}
                  </div>
                  <div className="s-tm-footer">
                    <span>👤 {tx.recorded_by}</span>
                    <span>📅 {fmtDateShort(tx.recorded_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Bottom Sheet for Payment Logging */}
      {showSheet && selectedInvoice && (
        <div className="s-sheet-overlay" onClick={closeSheet}>
          <div className="s-sheet" onClick={e => e.stopPropagation()}>
            <div className="s-sheet-handle" />
            <div className="s-sheet-header">
              <div>
                <div className="s-sheet-title">Record Cash Collection</div>
                <div className="s-sheet-sub">
                  Invoice {selectedInvoice.invoice_number} · Balance: <strong>{fmtCurrency(selectedInvoice.balance)}</strong>
                </div>
              </div>
              <button
                className="s-btn ghost"
                style={{ padding: 6, borderRadius: '50%', width: 28, height: 28 }}
                onClick={closeSheet}
              >
                <X size={14} />
              </button>
            </div>
            <div className="s-sheet-body">
              <form onSubmit={handleSubmitPayment}>
                <div className="s-form-group">
                  <label className="s-label">Collection Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="s-input"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="Enter collected amount..."
                    required
                  />
                  <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="s-btn ghost sm"
                      onClick={() => setAmount(selectedInvoice.balance.toString())}
                    >
                      Pay Full ({fmtCurrency(selectedInvoice.balance)})
                    </button>
                    {selectedInvoice.balance > 5000 && (
                      <button
                        type="button"
                        className="s-btn ghost sm"
                        onClick={() => setAmount((selectedInvoice.balance / 2).toFixed(2))}
                      >
                        Pay 50%
                      </button>
                    )}
                  </div>
                </div>

                <div className="s-form-group">
                  <label className="s-label">Payment Mode</label>
                  <select
                    className="s-select"
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                  >
                    <option value="CASH">💵 Cash</option>
                    <option value="UPI">📱 UPI / PhonePe / GPay</option>
                    <option value="BANK_TRANSFER">🏦 Bank Transfer / NEFT</option>
                    <option value="CARD">💳 Card</option>
                    <option value="CHEQUE">✍ Cheque</option>
                  </select>
                </div>

                <div className="s-form-group">
                  <label className="s-label">Remarks / Collection Notes</label>
                  <textarea
                    className="s-textarea"
                    placeholder="Add cash memo ref, depositor name or location updates..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button type="button" className="s-btn ghost lg" onClick={closeSheet}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="s-btn success lg"
                    disabled={submitting}
                  >
                    {submitting ? 'Recording...' : '✓ Confirm & Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
