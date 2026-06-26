import { useState, useEffect, useCallback } from 'react';
import { ordersAPI } from '../api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { 
  PhoneCall, CalendarDays, User, X, Search, RefreshCw, 
  MessageSquareMore, FileText, CheckCircle2, ChevronDown, ChevronUp, Download
} from 'lucide-react';
import useBulkActions from '../hooks/useBulkActions';
import BulkActionBar from '../components/BulkActionBar';

function fmtCurrency(val) {
  return '₹' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDateShort(iso) {
  if (!iso) return '—';
  return iso.replace('T', ' ').substring(0, 16);
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

// Reuse/Adapt FollowUpModal
function FollowUpModal({ lead, onClose, onSaved }) {
  const [status, setStatus]             = useState('CONTACTED');
  const [comments, setComments]         = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [nextDate, setNextDate]         = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [history, setHistory]           = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab]       = useState('LOG');

  useEffect(() => {
    ordersAPI.getFollowUps(lead.id)
      .then(r => setHistory(r.data.data.followups || []))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [lead.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comments.trim()) return toast.error('Please enter follow-up comments');
    setSubmitting(true);
    try {
      await ordersAPI.addFollowUp(lead.id, {
        follow_up_status: status,
        comments: comments.trim(),
        contact_person: contactPerson.trim() || undefined,
        next_follow_up_date: nextDate || undefined,
      });
      toast.success('Follow-up logged!');
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
              <span style={{ fontWeight: 700, fontSize: 16 }}>CRM Follow-Up (Prospect Lead)</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Lead Name: <strong style={{ color: 'var(--color-primary-light)' }}>{lead.customer}</strong>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }}><X size={16} /></button>
        </div>

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

              <div className="form-group">
                <label className="form-label">Contact Person Spoken To</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="e.g. Mr. Rajan, Buyer…"
                  value={contactPerson}
                  onChange={e => setContactPerson(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Comments *</label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="What was discussed with this lead? Requirements? Budget validation?"
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

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
                                Spoke with: <strong>{fu.contact_person}</strong>
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

// Bulk Follow-Up Modal
function BulkFollowUpModal({ leads, onClose, onSaved }) {
  const [status, setStatus]             = useState('CONTACTED');
  const [comments, setComments]         = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [nextDate, setNextDate]         = useState('');
  const [submitting, setSubmitting]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comments.trim()) return toast.error('Please enter follow-up comments');
    setSubmitting(true);
    const loadingToast = toast.loading(`Logging follow-up for ${leads.length} leads...`);
    try {
      for (const lead of leads) {
        await ordersAPI.addFollowUp(lead.id, {
          follow_up_status: status,
          comments: comments.trim(),
          contact_person: contactPerson.trim() || undefined,
          next_follow_up_date: nextDate || undefined,
        });
      }
      toast.success(`Follow-up logged for ${leads.length} leads!`, { id: loadingToast });
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save follow-ups', { id: loadingToast });
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
              <span style={{ fontWeight: 700, fontSize: 16 }}>Bulk CRM Follow-Up</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Logging for <strong style={{ color: 'var(--color-primary-light)' }}>{leads.length} selected prospective leads</strong>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6 }}><X size={16} /></button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <form onSubmit={handleSubmit}>
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

            <div className="form-group">
              <label className="form-label">Contact Person Spoken To</label>
              <input
                className="form-control"
                type="text"
                placeholder="e.g. Mr. Rajan, Buyer…"
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Comments *</label>
              <textarea
                className="form-control"
                rows={4}
                placeholder="Comments applied to all selected leads..."
                value={comments}
                onChange={e => setComments(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

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
                {submitting ? 'Saving…' : '💾 Save Bulk Follow-Ups'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function NewLeadsPage() {
  const { hasPermission } = useAuth();
  const [leads, setLeads]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [expandedId, setExpandedId]   = useState(null);
  const [followUpLead, setFollowUpLead] = useState(null);
  const [showBulkFollowUp, setShowBulkFollowUp] = useState(false);

  const loadData = useCallback(() => {
    setLoading(true);
    ordersAPI.listOutstanding()
      .then(res => {
        const list = res.data.data || [];
        // Extract customer names that have generated invoices
        const invoicedCustomers = new Set(
          list.filter(item => item.invoice_number && !item.invoice_number.startsWith('ORD-')).map(item => item.customer)
        );
        // Leads are PENDING orders with no invoice generated AND whose customer has no active invoices
        const prospects = list.filter(
          item => item.status === 'PENDING' && !invoicedCustomers.has(item.customer)
        );
        setLeads(prospects);
      })
      .catch(() => toast.error('Failed to load prospects'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    return !q ||
      l.customer?.toLowerCase().includes(q) ||
      l.order_number?.toLowerCase().includes(q) ||
      l.remarks?.toLowerCase().includes(q);
  });

  // Bulk Actions Hook
  const {
    selectedIds,
    isSelected,
    toggleSelect,
    toggleSelectAll,
    isAllSelected,
    clearSelection,
    getSelectedItems,
    selectedCount
  } = useBulkActions(filtered);

  const handleBulkExport = () => {
    const selected = getSelectedItems();
    let csvContent = 'Lead Name,Order Ref,Phone,Email,Est. Deal Value,Added By,Date Added,Remarks\n';
    
    selected.forEach(l => {
      const row = [
        l.customer,
        l.order_number,
        l.custom_fields?.phone || '',
        l.custom_fields?.email || '',
        l.grand_total || 0,
        l.created_by_name || 'System',
        fmtDateShort(l.created_at),
        l.remarks || ''
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
      csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedCount} leads to CSV`);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={22} color="#3b82f6" />
            New Prospective Leads
          </h2>
          <p>Manage targets and prospective customer accounts with no invoices generated yet.</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-secondary btn-sm" onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--color-text-muted)'
          }} />
          <input
            className="form-control"
            style={{ paddingLeft: 32, margin: 0 }}
            placeholder="Search prospective leads by customer name, order number, or remarks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Leads Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Prospect Leads Tracker</div>
            <div className="card-subtitle">{filtered.length} leads currently pending invoice conversion</div>
          </div>
          <MessageSquareMore size={18} color="var(--color-primary)" />
        </div>

        {loading ? (
          <div className="loading-center" style={{ padding: 60 }}><div className="loading-spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 60 }}>
            <CheckCircle2 size={40} color="#10b981" style={{ opacity: 0.5, marginBottom: 12 }} />
            <p style={{ fontWeight: 600, fontSize: 15 }}>No prospective leads found</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              All prospects have either been converted to customers (invoiced) or no leads exist.
            </p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={isAllSelected} 
                      onChange={toggleSelectAll} 
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>Lead Name</th>
                  <th>Order Ref</th>
                  <th>Contact Info</th>
                  <th>Est. Deal Value</th>
                  <th>Added By</th>
                  <th>Date Added</th>
                  {hasPermission('SALES:LOG_FOLLOWUP') && <th style={{ textAlign: 'right' }}>Actions</th>}
                  <th style={{ width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => {
                  const isExpanded = expandedId === lead.id;
                  const isChecked = isSelected(lead.id);
                  return (
                    <tr 
                      key={lead.id} 
                      style={{ cursor: 'pointer', background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }} 
                      onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                    >
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => toggleSelect(lead.id)} 
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{lead.customer}</span>
                        {lead.status === 'PENDING' && (
                          <span className="badge badge-green" style={{ marginLeft: 8, fontSize: 10 }}>PROSPECT</span>
                        )}
                      </td>
                      <td>
                        <span style={{ color: 'var(--color-primary-light)', fontSize: 12.5, fontFamily: 'monospace' }}>{lead.order_number}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: 12.5 }}>
                          {lead.custom_fields?.phone && <div>📞 {lead.custom_fields.phone}</div>}
                          {lead.custom_fields?.email && <div>✉ {lead.custom_fields.email}</div>}
                          {!lead.custom_fields?.phone && !lead.custom_fields?.email && <span style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>No Contact Info</span>}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700, color: '#f59e0b', fontSize: 14 }}>{fmtCurrency(lead.grand_total)}</td>
                      <td>
                        <span className="badge badge-purple">👤 {lead.created_by_name || 'System'}</span>
                      </td>
                      <td>{fmtDateShort(lead.created_at)}</td>
                      {hasPermission('SALES:LOG_FOLLOWUP') && (
                        <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}
                            onClick={() => setFollowUpLead(lead)}
                          >
                            <PhoneCall size={12} /> Log Follow-Up
                          </button>
                        </td>
                      )}
                      <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expanded card detail view for leads */}
      {expandedId && (() => {
        const lead = leads.find(l => l.id === expandedId);
        if (!lead) return null;
        return (
          <div className="card fade-in" style={{ marginTop: -15, borderTop: 'none', borderTopLeftRadius: 0, borderTopRightRadius: 0, background: 'rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '16px 20px' }}>
              <h5 style={{ margin: '0 0 8px 0', fontSize: 13, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Requirements / Remarks</h5>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>
                {lead.remarks || 'No detailed requirements entered.'}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Follow-Up Modal */}
      {followUpLead && (
        <FollowUpModal
          lead={followUpLead}
          onClose={() => setFollowUpLead(null)}
          onSaved={loadData}
        />
      )}

      {/* Bulk Follow-Up Modal */}
      {showBulkFollowUp && (
        <BulkFollowUpModal
          leads={getSelectedItems()}
          onClose={() => { setShowBulkFollowUp(false); clearSelection(); }}
          onSaved={loadData}
        />
      )}

      {/* Floating Bulk Action Bar */}
      <BulkActionBar 
        selectedCount={selectedCount}
        onClear={clearSelection}
        actions={[
          {
            label: 'Export CSV',
            icon: <Download size={16} />,
            onClick: handleBulkExport,
            className: 'btn-secondary'
          },
          {
            label: 'Log Bulk Follow-Up',
            icon: <PhoneCall size={16} />,
            onClick: () => setShowBulkFollowUp(true),
            className: 'btn-primary'
          }
        ]}
      />
    </div>
  );
}
