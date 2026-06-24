/**
 * SalesHome.jsx — Home Dashboard
 * KPIs, today's follow-up agenda, recent activity, quick actions.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ordersAPI } from '../../api';
import toast from 'react-hot-toast';
import {
  PhoneCall, DollarSign, Wallet, AlertCircle, Calendar,
  ChevronRight, Zap, Plus, RefreshCw, TrendingUp,
  CheckCircle2, Clock, Bell
} from 'lucide-react';

function fmtCurrency(v) {
  return '₹' + (v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDateShort(iso) {
  if (!iso) return '—';
  return iso.replace('T', ' ').substring(0, 16);
}
function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  const t = new Date(); t.setHours(0,0,0,0);
  return d.getTime() === t.getTime();
}
function isOverdue(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  const t = new Date(); t.setHours(0,0,0,0);
  return d < t;
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function getFollowUpStatusChipClass(status) {
  switch (status) {
    case 'CONTACTED':       return 'blue';
    case 'PROMISE_TO_PAY':  return 'green';
    case 'ESCALATED':       return 'red';
    case 'RESOLVED':        return 'purple';
    default:                return 'gray';
  }
}

export default function SalesHome({ onRefresh }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [outstanding, setOutstanding] = useState([]);
  const [loading, setLoading]         = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    ordersAPI.listOutstanding()
      .then(r => setOutstanding(r.data.data || []))
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalDue       = outstanding.reduce((s, i) => s + Math.max(0, (i.grand_total||0) - (i.paid_amount||0)), 0);
  const totalCount     = outstanding.length;
  const todayAgenda    = outstanding.filter(i => isToday(i.latest_next_follow_up_date));
  const overdueItems   = outstanding.filter(i => isOverdue(i.latest_next_follow_up_date));
  const neverContacted = outstanding.filter(i => !i.latest_follow_up_status);

  const firstName = user?.name?.split(' ')?.[0] || 'there';

  return (
    <div className="s-page s-fade-in">
      {/* Greeting */}
      <div className="s-greeting">
        <div className="s-greeting-text">
          <h3>{getGreeting()}, {firstName}! 👋</h3>
          <p>
            {loading ? 'Loading your dashboard…'
              : overdueItems.length > 0
                ? `⚠ ${overdueItems.length} overdue follow-up${overdueItems.length > 1 ? 's' : ''} need attention`
                : todayAgenda.length > 0
                  ? `📅 ${todayAgenda.length} follow-up${todayAgenda.length > 1 ? 's' : ''} scheduled for today`
                  : "✅ You're all caught up for today"}
          </p>
        </div>
        <div className="s-greeting-emoji">{new Date().getHours() < 12 ? '🌅' : new Date().getHours() < 17 ? '☀️' : '🌙'}</div>
      </div>

      {/* KPI Cards */}
      <div className="s-kpi-row">
        <div className="s-kpi red">
          <div className="s-kpi-icon red"><Wallet size={16} color="#ef4444" /></div>
          <div className="s-kpi-val">{loading ? '…' : fmtCurrency(totalDue)}</div>
          <div className="s-kpi-label">Total Outstanding</div>
        </div>
        <div className="s-kpi orange">
          <div className="s-kpi-icon orange"><Clock size={16} color="#f59e0b" /></div>
          <div className="s-kpi-val">{loading ? '…' : totalCount}</div>
          <div className="s-kpi-label">Open Invoices</div>
        </div>
        <div className="s-kpi blue">
          <div className="s-kpi-icon blue"><Bell size={16} color="#3b82f6" /></div>
          <div className="s-kpi-val">{loading ? '…' : overdueItems.length}</div>
          <div className="s-kpi-label">Overdue Calls</div>
        </div>
        <div className="s-kpi purple">
          <div className="s-kpi-icon purple"><AlertCircle size={16} color="#8b5cf6" /></div>
          <div className="s-kpi-val">{loading ? '…' : neverContacted.length}</div>
          <div className="s-kpi-label">Never Called</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="s-section-label">Quick Actions</div>
      <div className="s-quick-actions" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <button className="s-qa-btn" onClick={() => navigate('/sales/crm')}>
          <div className="s-qa-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>
            <PhoneCall size={20} color="#3b82f6" />
          </div>
          <span className="s-qa-label">Log Follow-Up</span>
        </button>
        <button className="s-qa-btn" onClick={() => navigate('/sales/collections')}>
          <div className="s-qa-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
            <DollarSign size={20} color="#10b981" />
          </div>
          <span className="s-qa-label">Collect Payment</span>
        </button>
        <button className="s-qa-btn" onClick={() => navigate('/sales/pos')}>
          <div className="s-qa-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <Zap size={20} color="#f59e0b" />
          </div>
          <span className="s-qa-label">Quick Sale (POS)</span>
        </button>
        <button className="s-qa-btn" onClick={() => navigate('/sales/orders')}>
          <div className="s-qa-icon" style={{ background: 'rgba(139,92,246,0.15)' }}>
            <Plus size={20} color="#8b5cf6" />
          </div>
          <span className="s-qa-label">New Order</span>
        </button>
        <button className="s-qa-btn" onClick={() => navigate('/sales/crm?filter=OVERDUE')}>
          <div className="s-qa-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>
            <AlertCircle size={20} color="#ef4444" />
          </div>
          <span className="s-qa-label">Overdue Items</span>
        </button>
        <button className="s-qa-btn" onClick={load}>
          <div className="s-qa-icon" style={{ background: 'rgba(100,116,139,0.15)' }}>
            <RefreshCw size={20} color="#94a3b8" />
          </div>
          <span className="s-qa-label">Refresh Data</span>
        </button>
      </div>

      {/* Today's Agenda */}
      <div className="s-section-label">
        📅 Today's Follow-Up Agenda
        {todayAgenda.length > 0 && (
          <span className="s-chip red" style={{ marginLeft: 8 }}>{todayAgenda.length} due</span>
        )}
      </div>

      <div className="s-card s-mb-20">
        {loading ? (
          <div className="s-spinner-wrap" style={{ padding: 30 }}>
            <div className="s-spinner" />
          </div>
        ) : todayAgenda.length === 0 ? (
          <div className="s-empty" style={{ padding: 32 }}>
            <CheckCircle2 size={32} color="#10b981" style={{ opacity: 0.6 }} />
            <p className="title">Nothing due today</p>
            <p className="sub">Check the CRM tab to schedule new follow-ups.</p>
          </div>
        ) : (
          <div className="s-list">
            {todayAgenda.map(inv => {
              const balance = Math.max(0, (inv.grand_total||0) - (inv.paid_amount||0));
              const chipClass = getFollowUpStatusChipClass(inv.latest_follow_up_status);
              return (
                <div key={inv.id} className="s-list-item" onClick={() => navigate('/sales/crm')}>
                  <div className="s-list-avatar" style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd' }}>
                    {(inv.customer_name || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div className="s-list-body">
                    <div className="s-list-title">{inv.customer_name}</div>
                    <div className="s-list-sub">{inv.invoice_number}</div>
                    <div style={{ marginTop: 4 }}>
                      {inv.latest_follow_up_status && (
                        <span className={`s-chip ${chipClass}`}>{inv.latest_follow_up_status}</span>
                      )}
                    </div>
                  </div>
                  <div className="s-list-right">
                    <div className="s-list-amount s-text-danger">{fmtCurrency(balance)}</div>
                    <div className="s-list-date">Due today</div>
                  </div>
                  <ChevronRight size={16} color="var(--s-text-3)" style={{ flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Overdue Items */}
      {overdueItems.length > 0 && (
        <>
          <div className="s-section-label">
            🚨 Overdue Follow-Ups
          </div>
          <div className="s-card s-mb-20">
            <div className="s-list">
              {overdueItems.slice(0, 5).map(inv => {
                const balance = Math.max(0, (inv.grand_total||0) - (inv.paid_amount||0));
                return (
                  <div key={inv.id} className="s-list-item" onClick={() => navigate('/sales/crm')}>
                    <div className="s-list-avatar" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
                      {(inv.customer_name || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div className="s-list-body">
                      <div className="s-list-title">{inv.customer_name}</div>
                      <div className="s-list-sub">
                        {inv.invoice_number} · Was due: <strong style={{ color: '#ef4444' }}>{inv.latest_next_follow_up_date}</strong>
                      </div>
                    </div>
                    <div className="s-list-right">
                      <div className="s-list-amount s-text-danger">{fmtCurrency(balance)}</div>
                      <span className="s-badge-overdue">OVERDUE</span>
                    </div>
                  </div>
                );
              })}
              {overdueItems.length > 5 && (
                <button
                  className="s-list-item s-btn ghost"
                  style={{ width: '100%', justifyContent: 'center', border: 'none', borderRadius: 0, color: '#3b82f6', fontWeight: 600, fontSize: 13 }}
                  onClick={() => navigate('/sales/crm?filter=OVERDUE')}
                >
                  View all {overdueItems.length} overdue items
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Never Contacted */}
      {neverContacted.length > 0 && (
        <>
          <div className="s-section-label">🚫 Never Contacted ({neverContacted.length})</div>
          <div className="s-card s-mb-20">
            <div className="s-list">
              {neverContacted.slice(0, 3).map(inv => {
                const balance = Math.max(0, (inv.grand_total||0) - (inv.paid_amount||0));
                return (
                  <div key={inv.id} className="s-list-item" onClick={() => navigate('/sales/crm')}>
                    <div className="s-list-avatar" style={{ background: 'rgba(100,116,139,0.15)', color: '#94a3b8' }}>
                      {(inv.customer_name || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div className="s-list-body">
                      <div className="s-list-title">{inv.customer_name}</div>
                      <div className="s-list-sub">{inv.invoice_number} · Aging: {inv.aging_days ?? '—'}d</div>
                    </div>
                    <div className="s-list-right">
                      <div className="s-list-amount s-text-danger">{fmtCurrency(balance)}</div>
                      <span className="s-chip gray">No contact</span>
                    </div>
                  </div>
                );
              })}
              {neverContacted.length > 3 && (
                <button
                  className="s-list-item"
                  style={{ width: '100%', justifyContent: 'center', border: 'none', borderRadius: 0, color: '#3b82f6', fontWeight: 600, fontSize: 13, background: 'none', cursor: 'pointer' }}
                  onClick={() => navigate('/sales/crm?filter=NO_CONTACT')}
                >
                  +{neverContacted.length - 3} more
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
