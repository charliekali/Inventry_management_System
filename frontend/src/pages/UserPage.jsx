import { useState, useEffect } from 'react';
import { usersAPI, rolesAPI, warehousesAPI } from '../api';
import toast from 'react-hot-toast';
import { Users, Plus, Edit2, Archive, Check, X } from 'lucide-react';

export default function UserPage() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals / forms
  const [showModal, setShowModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPassword, setUPassword] = useState('');
  const [uRoleId, setURoleId] = useState('');
  const [uWarehouseId, setUWarehouseId] = useState('');
  const [uActive, setUActive] = useState(true);

  const loadData = () => {
    setLoading(true);
    usersAPI.list()
      .then(r => setUsers(r.data.data))
      .catch(() => toast.error('Failed to load user accounts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    rolesAPI.list()
      .then(r => setRoles(r.data.data))
      .catch(() => {});
    warehousesAPI.list()
      .then(r => setWarehouses(r.data.data))
      .catch(() => {});
  }, []);

  const resetForm = () => {
    setEditingUserId(null);
    setUName('');
    setUEmail('');
    setUPassword('');
    setURoleId('');
    setUWarehouseId('');
    setUActive(true);
  };

  const handleEditUser = (user) => {
    setEditingUserId(user.id);
    setUName(user.name);
    setUEmail(user.email);
    setUPassword(''); // Keep password blank unless changing
    setURoleId(user.role_id || '');
    setUWarehouseId(user.warehouse_id || '');
    setUActive(user.is_active);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!uName.trim() || !uEmail.trim() || !uRoleId) {
      return toast.error('Name, Email, and Role are required');
    }

    try {
      const payload = {
        name: uName,
        email: uEmail,
        role_id: uRoleId,
        warehouse_id: uWarehouseId || null,
        is_active: uActive
      };

      if (!editingUserId && !uPassword) {
        return toast.error('Password is required for new users');
      }
      if (uPassword) {
        payload.password = uPassword;
      }

      if (editingUserId) {
        await usersAPI.update(editingUserId, payload);
        toast.success('User updated successfully');
      } else {
        await usersAPI.create(payload);
        toast.success('User created successfully');
      }

      setShowModal(false);
      resetForm();
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save user account');
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Are you sure you want to archive/deactivate this user?')) return;
    try {
      await usersAPI.delete(id);
      toast.success('User account deactivated');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to deactivate account');
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>User Management</h2>
          <p>Create staff accounts, assign RBAC security roles and warehouse scopes</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus size={16} />
            Create User
          </button>
        </div>
      </div>

      {/* Users table */}
      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="loading-spinner"></div></div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <Users size={32} />
            <p>No user accounts defined yet</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email Address</th>
                  <th>Security Role</th>
                  <th>Warehouse Scope</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="sidebar-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                          {u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <span style={{ fontWeight: 700 }}>{u.name}</span>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className="badge badge-purple" style={{ fontWeight: 700 }}>
                        🔑 {u.role_name || 'No Role'}
                      </span>
                    </td>
                    <td>
                      {u.warehouse_id ? (
                        <span className="badge badge-blue">
                          🏢 {warehouses.find(w => w.id === u.warehouse_id)?.name || 'Mapped'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 12.5, fontStyle: 'italic' }}>Global Scope</span>
                      )}
                    </td>
                    <td>
                      {u.is_active ? (
                        <span className="badge badge-green" style={{ display: 'inline-flex', gap: 4 }}>
                          <Check size={11} /> Active
                        </span>
                      ) : (
                        <span className="badge badge-red" style={{ display: 'inline-flex', gap: 4 }}>
                          <X size={11} /> Archived
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleEditUser(u)}>
                          <Edit2 size={13} />
                        </button>
                        {u.is_active && (
                          <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => handleDeactivate(u.id)}>
                            <Archive size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <form className="modal" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingUserId ? 'Edit User Account' : 'Register User Account'}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Full Name <span>*</span></label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={uName} 
                  onChange={(e) => setUName(e.target.value)} 
                  placeholder="e.g. John Doe"
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address <span>*</span></label>
                <input 
                  type="email" 
                  className="form-control" 
                  value={uEmail} 
                  onChange={(e) => setUEmail(e.target.value)} 
                  placeholder="e.g. john@company.com"
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password {editingUserId ? '(Leave blank to keep current)' : ' *'}</label>
                <input 
                  type="password" 
                  className="form-control" 
                  value={uPassword} 
                  onChange={(e) => setUPassword(e.target.value)} 
                  placeholder="Minimum 6 characters"
                  required={!editingUserId} 
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Role <span>*</span></label>
                  <select 
                    className="form-control" 
                    value={uRoleId} 
                    onChange={(e) => setURoleId(e.target.value)}
                    required
                  >
                    <option value="">Select Role...</option>
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Warehouse Scope</label>
                  <select 
                    className="form-control" 
                    value={uWarehouseId} 
                    onChange={(e) => setUWarehouseId(e.target.value)}
                  >
                    <option value="">Global (All Warehouses)</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {editingUserId && (
                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <input 
                    type="checkbox" 
                    id="isActiveCheck"
                    checked={uActive} 
                    onChange={(e) => setUActive(e.target.checked)} 
                  />
                  <label htmlFor="isActiveCheck" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>
                    Account is Active
                  </label>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Account</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
