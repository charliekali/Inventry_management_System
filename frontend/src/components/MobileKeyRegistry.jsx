import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { keyRegistryAPI } from '../api';
import toast from 'react-hot-toast';
import {
  KeyRound, Clock, User, Check, X,
  RefreshCw, FileText, ChevronRight, AlertCircle
} from 'lucide-react';

function fmtDuration(mins) {
  if (mins == null) return '--';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtDateTime(iso) {
  if (!iso) return '--';
  return new Date(iso).toLocaleString('en-IN', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function MobileKeyRegistry() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Super Admin';
  const [tab, setTab] = useState(isAdmin ? 'approvals' : 'keys'); // approvals | keys | active | my
  const [keys, setKeys] = useState([]);
  const [activeLogs, setActiveLogs] = useState([]);
  const [myLogs, setMyLogs] = useState([]);
  const [pendingReqs, setPendingReqs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal / Form state
  const [checkoutModal, setCheckoutModal] = useState(null); // holds key object
  const [returnModal, setReturnModal] = useState(null); // holds log object
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [actioning, setActioning] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [keysRes, activeRes, myRes] = await Promise.all([
        keyRegistryAPI.keys(),
        keyRegistryAPI.activeLogs(),
        keyRegistryAPI.myLogs()
      ]);
      setKeys(keysRes.data.data || []);
      setActiveLogs(activeRes.data.data || []);
      setMyLogs(myRes.data.data || []);

      if (isAdmin) {
        const pendingRes = await keyRegistryAPI.pendingRequests();
        setPendingReqs(pendingRes.data.data || []);
      }
    } catch (err) {
      toast.error('Failed to sync key registry data');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Request Checkout
  const handleRequestCheckout = async () => {
    if (!reason.trim()) {
      toast.error('Please enter a reason');
      return;
    }
    setActioning(true);
    try {
      await keyRegistryAPI.checkout({
        key_id: checkoutModal.id,
        reason: reason.trim()
      });
      toast.success(isAdmin ? 'Key checkout logged' : 'Checkout request submitted for approval');
      setCheckoutModal(null);
      setReason('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed');
    } finally {
      setActioning(false);
    }
  };

  // Request Return
  const handleRequestReturn = async () => {
    setActioning(true);
    try {
      await keyRegistryAPI.returnKey(returnModal.id, notes.trim());
      toast.success(isAdmin ? 'Key returned successfully' : 'Return request submitted for approval');
      setReturnModal(null);
      setNotes('');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed');
    } finally {
      setActioning(false);
    }
  };

  // Approve Request
  const handleApprove = async (id) => {
    try {
      await keyRegistryAPI.approveRequest(id);
      toast.success(`Request approved`);
      loadData();
    } catch (err) {
      toast.error('Failed to approve request');
    }
  };

  // Reject Request
  const handleReject = async (id) => {
    try {
      await keyRegistryAPI.rejectRequest(id);
      toast.success(`Request rejected`);
      loadData();
    } catch (err) {
      toast.error('Failed to reject request');
    }
  };

  // Get status color matching
  const getStatusBadge = (status) => {
    let bg = 'rgba(100,116,139,0.12)';
    let color = '#94a3b8';
    let label = status;

    if (status === 'AVAILABLE') {
      bg = 'rgba(34,197,94,0.12)';
      color = '#22c55e';
      label = 'Available';
    } else if (status === 'CHECKED_OUT' || status === 'OUT') {
      bg = 'rgba(239,68,68,0.12)';
      color = '#ef4444';
      label = 'Checked Out';
    } else if (status === 'PENDING_CHECKOUT') {
      bg = 'rgba(245,158,11,0.12)';
      color = '#f59e0b';
      label = 'Pending Checkout';
    } else if (status === 'PENDING_RETURN') {
      bg = 'rgba(139,92,246,0.12)';
      color = '#a78bfa';
      label = 'Pending Return';
    } else if (status === 'RETURNED') {
      bg = 'rgba(34,197,94,0.12)';
      color = '#22c55e';
      label = 'Returned';
    } else if (status === 'REJECTED') {
      bg = 'rgba(239,68,68,0.12)';
      color = '#ef4444';
      label = 'Rejected';
    }

    return (
      <span style={{
        padding: '3px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
        background: bg, color: color, border: `1px solid ${color}40`, display: 'inline-block'
      }}>
        {label}
      </span>
    );
  };

  return (
    <div style={{ paddingBottom: 60, maxWidth: 480, margin: '0 auto' }}>
      {/* Header Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)' }}>Key Registry</h3>
        <button onClick={loadData} disabled={loading} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: 4 }}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Tabs list */}
      <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 10, marginBottom: 16 }}>
        {isAdmin && (
          <button
            onClick={() => setTab('approvals')}
            style={{
              flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
              background: tab === 'approvals' ? 'var(--color-primary)' : 'transparent',
              color: tab === 'approvals' ? '#fff' : 'var(--color-text-muted)'
            }}
          >
            Approvals ({pendingReqs.length})
          </button>
        )}
        <button
          onClick={() => setTab('keys')}
          style={{
            flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
            background: tab === 'keys' ? 'var(--color-primary)' : 'transparent',
            color: tab === 'keys' ? '#fff' : 'var(--color-text-muted)'
          }}
        >
          Keys Box
        </button>
        <button
          onClick={() => setTab('active')}
          style={{
            flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
            background: tab === 'active' ? 'var(--color-primary)' : 'transparent',
            color: tab === 'active' ? '#fff' : 'var(--color-text-muted)'
          }}
        >
          Holds
        </button>
        <button
          onClick={() => setTab('my')}
          style={{
            flex: 1, padding: '8px 4px', border: 'none', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
            background: tab === 'my' ? 'var(--color-primary)' : 'transparent',
            color: tab === 'my' ? '#fff' : 'var(--color-text-muted)'
          }}
        >
          My Requests
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="loading-spinner"></div>
        </div>
      ) : (
        <div>
          {/* TAB: APPROVALS (ADMIN) */}
          {tab === 'approvals' && isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pendingReqs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                  <Check size={28} color="#22c55e" style={{ marginBottom: 8 }} />
                  <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>All caught up!</div>
                  <div style={{ fontSize: 12 }}>No pending key requests to review.</div>
                </div>
              ) : (
                pendingReqs.map(req => (
                  <div key={req.id} className="card" style={{ padding: 14, border: '1px solid var(--color-border)', borderRadius: 12, background: 'var(--color-bg-card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>🔑 {req.key_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Tag: {req.key_number || 'None'}</div>
                      </div>
                      {getStatusBadge(req.status)}
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: 10, borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>
                      <div><strong>User:</strong> {req.taken_by_name} ({req.taken_by_email || 'No email'})</div>
                      <div style={{ marginTop: 4 }}><strong>Reason:</strong> "{req.reason}"</div>
                      {req.return_notes && <div style={{ marginTop: 4, color: 'var(--color-text-muted)' }}><strong>Return Note:</strong> "{req.return_notes}"</div>}
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>Requested: {fmtDateTime(req.created_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleReject(req.id)}
                        style={{ flex: 1, padding: '8px 12px', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 8, background: 'transparent', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}
                      >
                        <X size={14} /> Reject
                      </button>
                      <button
                        onClick={() => handleApprove(req.id)}
                        style={{ flex: 1, padding: '8px 12px', border: 'none', color: '#fff', borderRadius: 8, background: '#22c55e', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}
                      >
                        <Check size={14} /> Approve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: KEYS BOX */}
          {tab === 'keys' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {keys.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                  <AlertCircle size={28} style={{ marginBottom: 8 }} />
                  <div>No keys in catalogue</div>
                </div>
              ) : (
                keys.map(key => {
                  const isAvailable = key.status === 'AVAILABLE';
                  // Check if this user holds this key currently
                  const activeUserLog = activeLogs.find(l => l.key_id === key.id && l.taken_by_id === user.id);

                  return (
                    <div key={key.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, border: '1px solid var(--color-border)', borderRadius: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ background: isAvailable ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)', color: isAvailable ? '#22c55e' : '#94a3b8', width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <KeyRound size={18} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{key.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                            {key.key_number ? `Tag: ${key.key_number} ` : ''}
                            {getStatusBadge(key.status)}
                          </div>
                        </div>
                      </div>
                      <div>
                        {isAvailable ? (
                          <button
                            onClick={() => setCheckoutModal(key)}
                            style={{ padding: '6px 12px', border: 'none', background: 'var(--color-primary)', color: '#fff', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Checkout
                          </button>
                        ) : activeUserLog && key.status === 'CHECKED_OUT' ? (
                          <button
                            onClick={() => setReturnModal(activeUserLog)}
                            style={{ padding: '6px 12px', border: '1px solid #22c55e', color: '#22c55e', background: 'transparent', borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                          >
                            Return
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                            {key.status === 'PENDING_CHECKOUT' ? 'Pending check' : key.status === 'PENDING_RETURN' ? 'Pending ret' : 'In Use'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB: ACTIVE HOLDS */}
          {tab === 'active' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                  <Check size={28} color="#22c55e" style={{ marginBottom: 8 }} />
                  <div>All keys are in the box</div>
                </div>
              ) : (
                activeLogs.map(log => (
                  <div key={log.id} className="card" style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>🔑 {log.key_name}</div>
                      {getStatusBadge(log.status)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div>Holder: <strong style={{ color: 'var(--color-text-primary)' }}>{log.taken_by_name}</strong></div>
                      <div>Reason: "{log.reason}"</div>
                      <div>Out since: {fmtDateTime(log.taken_at)} ({fmtDuration(log.duration_minutes)} ago)</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB: MY LOGS */}
          {tab === 'my' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                  <FileText size={28} style={{ marginBottom: 8 }} />
                  <div>No request history yet</div>
                </div>
              ) : (
                myLogs.map(log => (
                  <div key={log.id} className="card" style={{ padding: 12, border: '1px solid var(--color-border)', borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5 }}>🔑 {log.key_name}</div>
                      {getStatusBadge(log.status)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      <div>Reason: "{log.reason}"</div>
                      <div style={{ marginTop: 2 }}>Date: {fmtDateTime(log.created_at)}</div>
                      {log.returned_at && <div style={{ marginTop: 2, color: '#22c55e' }}>Returned: {fmtDateTime(log.returned_at)}</div>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* CHECKOUT REQUEST MODAL */}
      {checkoutModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 360, padding: 18, borderRadius: 14, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 800 }}>Request Key Checkout</h4>
            <div style={{ fontSize: 13, background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, marginBottom: 12 }}>
              <strong>Key:</strong> {checkoutModal.name} {checkoutModal.key_number ? `(${checkoutModal.key_number})` : ''}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 6, color: 'var(--color-text-muted)' }}>Reason *</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Taking customer stock check, moving goods in warehouse"
                rows={3}
                style={{ width: '100%', padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', color: '#fff', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setCheckoutModal(null)} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleRequestCheckout} disabled={actioning} style={{ padding: '8px 14px', background: 'var(--color-primary)', border: 'none', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {actioning ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RETURN REQUEST MODAL */}
      {returnModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 360, padding: 18, borderRadius: 14, background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: 15, fontWeight: 800 }}>Request Key Return</h4>
            <div style={{ fontSize: 13, background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8, marginBottom: 12 }}>
              <strong>Key:</strong> {returnModal.key_name} {returnModal.key_number ? `(${returnModal.key_number})` : ''}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, display: 'block', marginBottom: 6, color: 'var(--color-text-muted)' }}>Return Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Locked the door correctly, left on hook 4"
                rows={3}
                style={{ width: '100%', padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--color-border)', color: '#fff', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setReturnModal(null)} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleRequestReturn} disabled={actioning} style={{ padding: '8px 14px', background: '#22c55e', border: 'none', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {actioning ? 'Submitting…' : 'Submit Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
