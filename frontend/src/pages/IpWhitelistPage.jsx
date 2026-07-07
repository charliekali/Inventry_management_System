import { useState, useEffect } from 'react';
import { ipWhitelistAPI, usersAPI } from '../api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Shield, User, Globe, AlertCircle, Calendar } from 'lucide-react';

export default function IpWhitelistPage() {
  const [whitelists, setWhitelists] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [ipAddress, setIpAddress] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [wlRes, usersRes] = await Promise.all([
        ipWhitelistAPI.list(),
        usersAPI.list({ active: true })
      ]);
      setWhitelists(wlRes.data.data);
      setUsers(usersRes.data.data);
      if (usersRes.data.data.length > 0) {
        setSelectedUserId(usersRes.data.data[0].id);
      }
    } catch (err) {
      toast.error('Failed to load IP Whitelist data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ip = ipAddress.trim();
    if (!selectedUserId || !ip) {
      return toast.error('Both user and IP address are required');
    }

    // Basic IP validation (IPv4 or IPv6 placeholder)
    const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^localhost$|^127\.0\.0\.1$/;
    if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip) && ip !== '0:0:0:0:0:0:0:1') {
      return toast.error('Please enter a valid IP address');
    }

    try {
      await ipWhitelistAPI.create({
        userId: selectedUserId,
        ipAddress: ip
      });
      toast.success('IP whitelisted successfully');
      setIpAddress('');
      setShowModal(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to whitelist IP');
    }
  };

  const handleDelete = async (id, ip, email) => {
    if (!window.confirm(`Are you sure you want to remove the whitelist for IP "${ip}" of user "${email}"?`)) return;
    try {
      await ipWhitelistAPI.delete(id);
      toast.success('IP Whitelist entry removed');
      loadData();
    } catch (err) {
      toast.error('Failed to delete whitelist entry');
    }
  };

  return (
    <div className="container-fluid" style={{ padding: '20px 0' }}>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Shield size={26} className="text-primary" /> IP Whitelist Control Panel
            </h2>
            <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-muted)', fontSize: 14 }}>
              Manage IP Whitelists for users. Logs from these IPs will not automatically log out from sessions.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Plus size={16} /> Whitelist New IP
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <div className="loading-spinner"></div>
            </div>
          ) : whitelists.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--color-text-muted)' }}>
              <AlertCircle size={40} style={{ marginBottom: 12, opacity: 0.7 }} />
              <h3>No IP Whitelist Records Found</h3>
              <p style={{ maxWidth: 450, margin: '8px auto 0 auto', fontSize: 14 }}>
                Every user's first login IP is automatically whitelisted. You can also manually add trusted IP addresses here.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>IP Address</th>
                    <th>Whitelisted Date</th>
                    <th style={{ width: 100, textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {whitelists.map((wl) => (
                    <tr key={wl.id}>
                      <td style={{ fontWeight: 500 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <User size={16} style={{ color: 'var(--color-text-muted)' }} />
                          {wl.userName}
                        </span>
                      </td>
                      <td>{wl.userEmail}</td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'monospace', fontWeight: 600 }}>
                          <Globe size={14} style={{ color: 'var(--color-text-muted)' }} />
                          {wl.ipAddress}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text-muted)' }}>
                          <Calendar size={14} />
                          {new Date(wl.createdAt).toLocaleString()}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn btn-ghost text-danger" 
                          onClick={() => handleDelete(wl.id, wl.ipAddress, wl.userEmail)}
                          title="Remove IP Whitelist"
                          style={{ padding: 4, minWidth: 'auto' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1050 }}>
          <div className="card" style={{ width: '100%', maxWidth: 500, margin: 16 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Whitelist New IP Address</h3>
              <button 
                type="button" 
                className="btn btn-close" 
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontWeight: 500, fontSize: 14 }}>Select User</label>
                  <select 
                    className="form-control" 
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-input)' }}
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontWeight: 500, fontSize: 14 }}>IP Address</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. 192.168.1.1" 
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-input)' }}
                  />
                  <small style={{ color: 'var(--color-text-muted)' }}>IPv4 (e.g. 192.168.1.5) or IPv6 format.</small>
                </div>
              </div>
              <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid var(--color-border)', padding: '12px 24px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Whitelist IP</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
