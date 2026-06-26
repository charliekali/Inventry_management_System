/**
 * KeyRegistryPage.jsx
 * Super Admin key management system.
 * Tab 1 — "Keys": master catalogue (add / edit / delete physical keys).
 * Tab 2 — "Registry": active checkouts board + full history table.
 * Tab 3 — "Checkout": log when someone takes a key.
 */
import { useState, useEffect, useCallback } from 'react';
import { keyRegistryAPI, usersAPI } from '../api';
import toast from 'react-hot-toast';
import {
  KeyRound, Plus, Edit2, Trash2, CheckCircle, Clock,
  RefreshCw, ArrowDownLeft, User, FileText, Search, X, AlertCircle, ShieldAlert, Check
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDuration(mins) {
  if (mins == null) return '--';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDateTime(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }) {
  let bg = 'rgba(100,116,139,0.12)';
  let color = '#94a3b8';
  let dot = '#94a3b8';
  let label = status;

  if (status === 'AVAILABLE') {
    bg = 'rgba(34,197,94,0.12)';
    color = '#16a34a';
    dot = '#22c55e';
    label = 'Available';
  } else if (status === 'CHECKED_OUT' || status === 'OUT') {
    bg = 'rgba(239,68,68,0.12)';
    color = '#ef4444';
    dot = '#ef4444';
    label = 'Checked Out';
  } else if (status === 'PENDING_CHECKOUT') {
    bg = 'rgba(245,158,11,0.12)';
    color = '#d97706';
    dot = '#f59e0b';
    label = 'Pending Checkout';
  } else if (status === 'PENDING_RETURN') {
    bg = 'rgba(139,92,246,0.12)';
    color = '#7c3aed';
    dot = '#8b5cf6';
    label = 'Pending Return';
  } else if (status === 'RETURNED') {
    bg = 'rgba(34,197,94,0.12)';
    color = '#16a34a';
    dot = '#22c55e';
    label = 'Returned';
  } else if (status === 'REJECTED') {
    bg = 'rgba(239,68,68,0.12)';
    color = '#ef4444';
    dot = '#ef4444';
    label = 'Rejected';
  }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 700,
      background: bg,
      color: color,
      border: `1px solid ${color}30`,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />
      {label}
    </span>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: '24px 28px', borderRadius: 16, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} className="btn btn-ghost btn-icon" style={{ padding: 6 }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Key Form Modal ───────────────────────────────────────────────────────────

function KeyFormModal({ existing, onClose, onSave }) {
  const [form, setForm] = useState({
    name: existing?.name || '',
    key_number: existing?.key_number || '',
    description: existing?.description || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Key name is required'); return; }
    setSaving(true);
    try {
      if (existing) {
        await keyRegistryAPI.updateKey(existing.id, form);
        toast.success('Key updated');
      } else {
        await keyRegistryAPI.addKey(form);
        toast.success('Key added to catalogue');
      }
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save key');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={existing ? 'Edit Key' : 'Add New Key'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label className="form-label">Key Name *</label>
          <input className="form-input" placeholder="e.g. Main Gate Key"
            value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label className="form-label">Tag / Number</label>
          <input className="form-input" placeholder="e.g. K-001"
            value={form.key_number} onChange={e => setForm(p => ({ ...p, key_number: e.target.value }))} />
        </div>
        <div>
          <label className="form-label">Description</label>
          <input className="form-input" placeholder="What does this key open?"
            value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : (existing ? 'Save Changes' : 'Add Key')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Checkout Modal ───────────────────────────────────────────────────────────

function CheckoutModal({ availableKeys, users, onClose, onSave }) {
  const [form, setForm] = useState({
    key_id: '',
    taken_by_name: '',
    taken_by_email: '',
    taken_by_id: '',
    reason: '',
    taken_at: new Date().toISOString().slice(0, 16),
  });
  const [userSearch, setUserSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase())
  ).slice(0, 6);

  const selectUser = (u) => {
    setForm(p => ({ ...p, taken_by_name: u.name, taken_by_email: u.email, taken_by_id: u.id }));
    setUserSearch('');
  };

  const handleCheckout = async () => {
    if (!form.key_id) { toast.error('Please select a key'); return; }
    if (!form.taken_by_name.trim()) { toast.error('Person name is required'); return; }
    if (!form.reason.trim()) { toast.error('Reason is required'); return; }
    setSaving(true);
    try {
      await keyRegistryAPI.checkout({
        ...form,
        taken_at: new Date(form.taken_at).toISOString().replace('Z', ''),
      });
      toast.success('Key checkout logged');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to log checkout');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Log Key Checkout" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Key selector */}
        <div>
          <label className="form-label">Key *</label>
          <select className="form-select" value={form.key_id}
            onChange={e => setForm(p => ({ ...p, key_id: e.target.value }))}>
            <option value="">— Select available key —</option>
            {availableKeys.map(k => (
              <option key={k.id} value={k.id}>
                {k.name}{k.key_number ? ` (${k.key_number})` : ''}
              </option>
            ))}
          </select>
          {availableKeys.length === 0 && (
            <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>⚠ No keys are currently available.</p>
          )}
        </div>

        {/* Person — search users or type name */}
        <div>
          <label className="form-label">Taken By *</label>
          <input className="form-input" placeholder="Search users or type name…"
            value={userSearch || form.taken_by_name}
            onChange={e => { setUserSearch(e.target.value); setForm(p => ({ ...p, taken_by_name: e.target.value, taken_by_id: '', taken_by_email: '' })); }} />
          {userSearch && filteredUsers.length > 0 && (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, marginTop: 4, overflow: 'hidden', background: 'var(--color-bg-card)' }}>
              {filteredUsers.map(u => (
                <div key={u.id}
                  onClick={() => selectUser(u)}
                  style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <User size={14} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{u.email}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="form-label">Reason *</label>
          <textarea className="form-input" rows={3} placeholder="Why is this key being taken?"
            value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
            style={{ resize: 'vertical', fontFamily: 'inherit' }} />
        </div>

        <div>
          <label className="form-label">Time Taken</label>
          <input className="form-input" type="datetime-local"
            value={form.taken_at} onChange={e => setForm(p => ({ ...p, taken_at: e.target.value }))} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCheckout} disabled={saving}>
            {saving ? 'Logging…' : '🔑 Log Checkout'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Return Modal ─────────────────────────────────────────────────────────────

function ReturnModal({ log, onClose, onSave }) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleReturn = async () => {
    setSaving(true);
    try {
      await keyRegistryAPI.returnKey(log.id, notes);
      toast.success(`${log.key_name} returned successfully`);
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark returned');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Mark Key as Returned" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>🔑 {log.key_name}{log.key_number ? ` (${log.key_number})` : ''}</div>
          <div style={{ color: 'var(--color-text-muted)' }}>Held by <strong>{log.taken_by_name}</strong> since {fmtDateTime(log.taken_at)}</div>
          <div style={{ color: 'var(--color-text-muted)', marginTop: 2 }}>Duration: {fmtDuration(log.duration_minutes)}</div>
        </div>
        <div>
          <label className="form-label">Return Notes (optional)</label>
          <textarea className="form-input" rows={3} placeholder="Any notes about the return…"
            value={notes} onChange={e => setNotes(e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleReturn} disabled={saving}
            style={{ background: '#22c55e', borderColor: '#22c55e' }}>
            {saving ? 'Saving…' : '✓ Confirm Return'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function KeyRegistryPage() {
  const [tab, setTab] = useState('approvals'); // 'approvals' | 'registry' | 'keys'
  const [keys, setKeys] = useState([]);
  const [activeLogs, setActiveLogs] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [pendingReqs, setPendingReqs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [keyModal, setKeyModal] = useState(null);    // null | 'add' | keyObject
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [returnModal, setReturnModal] = useState(null); // null | logObject

  // Search
  const [historySearch, setHistorySearch] = useState('');

  const load = useCallback(async () => {
    try {
      const [keysRes, logsRes, activeRes, usersRes, pendingRes] = await Promise.all([
        keyRegistryAPI.keys(),
        keyRegistryAPI.logs(),
        keyRegistryAPI.activeLogs(),
        usersAPI.list(),
        keyRegistryAPI.pendingRequests(),
      ]);
      setKeys(keysRes.data.data || []);
      setAllLogs(logsRes.data.data || []);
      setActiveLogs(activeRes.data.data || []);
      setUsers((usersRes.data.data || []).filter(u => u.is_active));
      setPendingReqs(pendingRes.data.data || []);
    } catch {
      toast.error('Failed to load key registry data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (key) => {
    if (!window.confirm(`Delete key "${key.name}"? This cannot be undone.`)) return;
    try {
      await keyRegistryAPI.deleteKey(key.id);
      toast.success('Key deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete key');
    }
  };

  const availableKeys = keys.filter(k => k.status === 'AVAILABLE');
  const filteredLogs = allLogs.filter(l => {
    const q = historySearch.toLowerCase();
    return !q || l.key_name?.toLowerCase().includes(q)
      || l.taken_by_name?.toLowerCase().includes(q)
      || l.reason?.toLowerCase().includes(q);
  });

  if (loading) return <div className="loading-center"><div className="loading-spinner" /></div>;

  return (
    <div className="fade-in">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="page-header-left">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <KeyRound size={22} className="text-primary" />
            Key Registry
          </h2>
          <p>Track factory key checkouts and returns. All activity is logged with reason and timestamps.</p>
        </div>
        <div className="page-header-right" style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={load}>
            <RefreshCw size={14} /> Refresh
          </button>
          {tab === 'keys' && (
            <button className="btn btn-primary btn-sm" onClick={() => setKeyModal('add')}>
              <Plus size={14} /> Add Key
            </button>
          )}
          {tab === 'registry' && (
            <button className="btn btn-primary btn-sm" onClick={() => setCheckoutModal(true)}
              disabled={availableKeys.length === 0}>
              <Plus size={14} /> Log Key Checkout
            </button>
          )}
        </div>
      </div>

      {/* ── Summary Cards ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Total Keys', value: keys.length, color: '#6366f1', icon: KeyRound },
          { label: 'Available', value: keys.filter(k => k.status === 'AVAILABLE').length, color: '#22c55e', icon: CheckCircle },
          { label: 'Checked Out', value: activeLogs.length, color: '#ef4444', icon: AlertCircle },
          { label: 'Total Checkouts', value: allLogs.length, color: '#f59e0b', icon: FileText },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="card" style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={18} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', fontWeight: 600 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tab Switcher ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 20 }}>
        {[
          { key: 'approvals', label: `Pending Requests (${pendingReqs.length})`, icon: ShieldAlert },
          { key: 'registry', label: 'Registry / Board', icon: Clock },
          { key: 'keys', label: 'Key Catalogue', icon: KeyRound },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', fontSize: 13.5, fontWeight: tab === key ? 700 : 500,
            color: tab === key ? 'var(--color-primary-light)' : 'var(--color-text-muted)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            borderBottom: tab === key ? '2px solid var(--color-primary-light)' : '2px solid transparent',
            marginBottom: -1, transition: 'all 0.15s',
          }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: APPROVALS */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'approvals' && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            {pendingReqs.length > 0 ? `${pendingReqs.length} Request${pendingReqs.length > 1 ? 's' : ''} Awaiting Approval` : 'No Pending Requests'}
          </div>

          {pendingReqs.length === 0 ? (
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <CheckCircle size={36} color="#22c55e" style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text-primary)' }}>All caught up!</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>There are no checkout or return requests pending.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {pendingReqs.map(req => (
                <div key={req.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid var(--color-border)' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>🔑 {req.key_name}</span>
                        {req.key_number && (
                          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-bg-hover)', padding: '1px 7px', borderRadius: 99, marginLeft: 8 }}>
                            {req.key_number}
                          </span>
                        )}
                      </div>
                      <StatusBadge status={req.status} />
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--color-text-primary)', marginBottom: 8, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                        <User size={13} color="var(--color-text-muted)" />
                        <span><strong>Requester:</strong> {req.taken_by_name} {req.taken_by_email && `(${req.taken_by_email})`}</span>
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        📋 <strong>Reason:</strong> "{req.reason}"
                      </div>
                      {req.return_notes && (
                        <div style={{ color: 'var(--color-text-muted)' }}>
                          📝 <strong>Return Notes:</strong> "{req.return_notes}"
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
                        Requested At: {fmtDateTime(req.created_at)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      onClick={async () => {
                        try {
                          await keyRegistryAPI.rejectRequest(req.id);
                          toast.success('Request rejected');
                          load();
                        } catch (err) {
                          toast.error('Failed to reject request');
                        }
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    >
                      <X size={14} /> Reject
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await keyRegistryAPI.approveRequest(req.id);
                          toast.success('Request approved');
                          load();
                        } catch (err) {
                          toast.error('Failed to approve request');
                        }
                      }}
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, background: '#22c55e', borderColor: '#22c55e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    >
                      <Check size={14} /> Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: REGISTRY */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'registry' && (
        <div>
          {/* ── Active Checkouts Board ──────────────────────────────────── */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
              {activeLogs.length > 0 ? `${activeLogs.length} Key${activeLogs.length > 1 ? 's' : ''} Currently Out` : 'No Keys Currently Checked Out'}
            </div>

            {activeLogs.length === 0 ? (
              <div className="card" style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <CheckCircle size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
                <div style={{ fontWeight: 600 }}>All keys are available</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>No active checkouts right now.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                {activeLogs.map(log => (
                  <div key={log.id} className="card" style={{
                    padding: '16px 18px',
                    border: '1.5px solid rgba(239,68,68,0.25)',
                    background: 'rgba(239,68,68,0.04)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                          <KeyRound size={15} color="#ef4444" />
                          <span style={{ fontWeight: 800, fontSize: 14.5 }}>{log.key_name}</span>
                          {log.key_number && (
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-bg-hover)', padding: '1px 7px', borderRadius: 99 }}>
                              {log.key_number}
                            </span>
                          )}
                        </div>
                        <StatusBadge status="OUT" />
                      </div>
                    </div>

                    <div style={{ fontSize: 13, marginBottom: 6 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                        <User size={13} color="var(--color-text-muted)" />
                        <span style={{ fontWeight: 600 }}>{log.taken_by_name}</span>
                        {log.taken_by_email && <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>· {log.taken_by_email}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6, paddingLeft: 19 }}>
                        📋 {log.reason}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', paddingLeft: 19 }}>
                        🕐 Taken {fmtDateTime(log.taken_at)} · <strong style={{ color: '#f59e0b' }}>{fmtDuration(log.duration_minutes)}</strong> ago
                      </div>
                      {log.recorded_by_name && (
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', paddingLeft: 19, marginTop: 2 }}>
                          Logged by {log.recorded_by_name}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setReturnModal(log)}
                      className="btn btn-sm"
                      style={{ width: '100%', background: '#22c55e', color: '#fff', border: 'none', fontWeight: 700, marginTop: 4 }}
                    >
                      <ArrowDownLeft size={14} /> Mark as Returned
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Full History Table ──────────────────────────────────────── */}
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Full History ({filteredLogs.length})
            </div>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                className="form-input"
                placeholder="Search key, person, reason…"
                value={historySearch}
                onChange={e => setHistorySearch(e.target.value)}
                style={{ paddingLeft: 30, width: 240, height: 34, fontSize: 13 }}
              />
            </div>
          </div>

          <div className="card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Taken By</th>
                    <th>Reason</th>
                    <th>Taken At</th>
                    <th>Returned At</th>
                    <th>Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
                      {historySearch ? 'No results match your search.' : 'No key checkouts recorded yet.'}
                    </td></tr>
                  ) : filteredLogs.map(log => (
                    <tr key={log.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{log.key_name}</div>
                        {log.key_number && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{log.key_number}</div>}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{log.taken_by_name}</div>
                        {log.taken_by_email && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{log.taken_by_email}</div>}
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        <div style={{ fontSize: 13, lineHeight: 1.4 }}>{log.reason}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>{fmtDateTime(log.taken_at)}</td>
                      <td style={{ fontSize: 13 }}>
                        {log.returned_at ? fmtDateTime(log.returned_at) : <span style={{ color: '#ef4444', fontWeight: 600 }}>Not yet</span>}
                        {log.return_notes && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>📝 {log.return_notes}</div>}
                      </td>
                      <td>
                        <span className="badge badge-blue">{fmtDuration(log.duration_minutes)}</span>
                      </td>
                      <td><StatusBadge status={log.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TAB: KEY CATALOGUE */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {tab === 'keys' && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Key Name</th>
                  <th>Tag / Number</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
                    <KeyRound size={28} style={{ marginBottom: 10, opacity: 0.3 }} />
                    <div>No keys added yet. Click <strong>+ Add Key</strong> to get started.</div>
                  </td></tr>
                ) : keys.map(k => (
                  <tr key={k.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <KeyRound size={15} color="var(--color-primary-light)" />
                        <span style={{ fontWeight: 700 }}>{k.name}</span>
                      </div>
                    </td>
                    <td>
                      {k.key_number
                        ? <span className="badge badge-gray">{k.key_number}</span>
                        : <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>
                      }
                    </td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                      {k.description || '—'}
                    </td>
                    <td><StatusBadge status={k.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Edit"
                          onClick={() => setKeyModal(k)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm"
                          title={k.status === 'CHECKED_OUT' ? 'Cannot delete — key is checked out' : 'Delete'}
                          onClick={() => handleDelete(k)}
                          disabled={k.status === 'CHECKED_OUT'}
                          style={{ color: k.status === 'CHECKED_OUT' ? 'var(--color-text-muted)' : '#ef4444' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {keyModal && (
        <KeyFormModal
          existing={keyModal === 'add' ? null : keyModal}
          onClose={() => setKeyModal(null)}
          onSave={() => { setKeyModal(null); load(); }}
        />
      )}
      {checkoutModal && (
        <CheckoutModal
          availableKeys={availableKeys}
          users={users}
          onClose={() => setCheckoutModal(false)}
          onSave={() => { setCheckoutModal(false); load(); }}
        />
      )}
      {returnModal && (
        <ReturnModal
          log={returnModal}
          onClose={() => setReturnModal(null)}
          onSave={() => { setReturnModal(null); load(); }}
        />
      )}
    </div>
  );
}
