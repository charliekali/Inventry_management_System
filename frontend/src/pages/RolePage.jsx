import { useState, useEffect } from 'react';
import { rolesAPI } from '../api';
import toast from 'react-hot-toast';
import { Shield, Plus, Edit2, Archive, CheckSquare, Square, Download } from 'lucide-react';
import useBulkActions from '../hooks/useBulkActions';
import BulkActionBar from '../components/BulkActionBar';

export default function RolePage() {
  const [roles, setRoles] = useState([]);
  const [groupedPermissions, setGroupedPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  // Modal / Form States
  const [showModal, setShowModal] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [rName, setRName] = useState('');
  const [rDesc, setRDesc] = useState('');
  const [rCategory, setRCategory] = useState('');
  const [selectedPermIds, setSelectedPermIds] = useState(new Set());
  const [isSystem, setIsSystem] = useState(false);

  const loadRoles = () => {
    setLoading(true);
    rolesAPI.list()
      .then(r => setRoles(r.data.data))
      .catch(() => toast.error('Failed to load roles'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRoles();
    rolesAPI.permissions()
      .then(r => setGroupedPermissions(r.data.data))
      .catch(() => toast.error('Failed to load permissions grid'));
  }, []);

  const resetForm = () => {
    setEditingRoleId(null);
    setRName('');
    setRDesc('');
    setRCategory('');
    setSelectedPermIds(new Set());
    setIsSystem(false);
  };

  const handleEditRole = (role) => {
    setEditingRoleId(role.id);
    setRName(role.name);
    setRDesc(role.description || '');
    setRCategory(role.category || '');
    setIsSystem(role.is_system || false);
    setSelectedPermIds(new Set(role.permissions.map(p => p.id)));
    setShowModal(true);
  };

  const handleTogglePermission = (permId) => {
    const next = new Set(selectedPermIds);
    if (next.has(permId)) {
      next.delete(permId);
    } else {
      next.add(permId);
    }
    setSelectedPermIds(next);
  };

  const handleToggleModuleAll = (modulePerms, allChecked) => {
    const next = new Set(selectedPermIds);
    modulePerms.forEach(p => {
      if (allChecked) {
        next.delete(p.id);
      } else {
        next.add(p.id);
      }
    });
    setSelectedPermIds(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rName.trim()) return toast.error('Role name is required');

    try {
      const payload = {
        name: rName,
        description: rDesc,
        category: rCategory,
        permission_ids: Array.from(selectedPermIds)
      };

      if (editingRoleId) {
        await rolesAPI.update(editingRoleId, payload);
        toast.success('Role updated successfully');
      } else {
        await rolesAPI.create(payload);
        toast.success('Role created successfully');
      }

      setShowModal(false);
      resetForm();
      loadRoles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save role');
    }
  };

  const handleArchiveRole = async (id) => {
    if (!window.confirm('Are you sure you want to delete/archive this role?')) return;
    try {
      await rolesAPI.delete(id);
      toast.success('Role deleted');
      loadRoles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete role');
    }
  };

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
  } = useBulkActions(roles);

  const handleBulkExport = () => {
    const selected = getSelectedItems();
    let csvContent = 'Role Name,Category Scope,Description,Permissions Count,System Protected\n';
    
    selected.forEach(r => {
      const row = [
        r.name,
        r.category || 'Not Set',
        r.description || '',
        r.permissions?.length || 0,
        r.is_system ? 'YES' : 'NO'
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
      csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `roles_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedCount} roles to CSV`);
  };

  const handleBulkArchive = async () => {
    const selected = getSelectedItems();
    const systemProtected = selected.filter(r => r.is_system);
    const customRoles = selected.filter(r => !r.is_system);

    if (customRoles.length === 0) {
      toast.error('Cannot archive selected roles. All selected roles are system-protected.');
      return;
    }

    let confirmMsg = `Are you sure you want to archive ${customRoles.length} custom roles?`;
    if (systemProtected.length > 0) {
      confirmMsg += ` (${systemProtected.length} system-protected roles will be skipped.)`;
    }

    if (!window.confirm(confirmMsg)) return;

    const loadingToast = toast.loading(`Archiving ${customRoles.length} roles...`);
    try {
      for (const r of customRoles) {
        await rolesAPI.delete(r.id);
      }
      toast.success(`Archived ${customRoles.length} roles successfully`, { id: loadingToast });
      clearSelection();
      loadRoles();
    } catch (err) {
      toast.error('Failed to archive some roles', { id: loadingToast });
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Roles & Permissions</h2>
          <p>Define RBAC profiles and security control lists for users</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
            <Plus size={16} />
            Create Role
          </button>
        </div>
      </div>

      {/* Roles grid list */}
      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="loading-spinner"></div></div>
        ) : roles.length === 0 ? (
          <div className="empty-state">
            <Shield size={32} />
            <p>No security roles defined yet</p>
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
                  <th>Role Name</th>
                  <th>Category Scope</th>
                  <th>Description</th>
                  <th>Permission Load</th>
                  <th>System Flag</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map(r => {
                  const isChecked = isSelected(r.id);
                  return (
                    <tr key={r.id} style={{ background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => toggleSelect(r.id)} 
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
                          <span>🛡️</span>
                          {r.name}
                        </div>
                      </td>
                      <td>
                        {r.category ? (
                          <span className="badge badge-purple" style={{ textTransform: 'uppercase', fontSize: 10 }}>
                            {r.category}
                          </span>
                        ) : (
                          <span className="badge badge-gray">Not Set</span>
                        )}
                      </td>
                      <td>{r.description || '-'}</td>
                      <td>
                        <span className="badge badge-blue">
                          {r.permissions?.length || 0} permissions assigned
                        </span>
                      </td>
                      <td>
                        {r.is_system ? (
                          <span className="badge badge-blue">Protected</span>
                        ) : (
                          <span className="badge badge-gray">Custom</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleEditRole(r)} title="Edit Role Permissions">
                            <Edit2 size={13} />
                          </button>
                          {!r.is_system && (
                            <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => handleArchiveRole(r.id)} title="Delete Custom Role">
                              <Archive size={13} />
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

      {/* Role creation modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <form className="modal modal-lg" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingRoleId ? 'Edit Role Policy' : 'Create Role Policy'}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              <div className="form-group">
                <label className="form-label">Role Title <span>*</span></label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={rName} 
                  onChange={(e) => setRName(e.target.value)} 
                  placeholder="e.g. Stock Auditor, Finance Reviewer"
                  disabled={isSystem}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={rDesc} 
                  onChange={(e) => setRDesc(e.target.value)} 
                  placeholder="e.g. Read-only audit access across all stock balances"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category Scope *</label>
                <select
                  className="form-control"
                  value={rCategory}
                  onChange={(e) => setRCategory(e.target.value)}
                  required
                >
                  <option value="">-- Choose Role Category --</option>
                  <option value="Super Admin">Super Admin</option>
                  <option value="Warehouse">Warehouse</option>
                  <option value="Sales">Sales</option>
                  <option value="Production">Production</option>
                </select>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Assigned scope determines which mobile sub-app or admin console dashboard users will access.
                </p>
              </div>

              <div className="divider"></div>

              {/* Permissions grid checkbox builder */}
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 12 }}>
                  Set Security Privileges
                </h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {Object.entries(groupedPermissions)
                    .filter(([module]) => {
                      if (!rCategory) return true;
                      const cat = rCategory.toLowerCase();
                      if (cat === 'super admin') return true;
                      if (cat === 'warehouse') {
                        return ['stock', 'transactions', 'warehouses', 'sections', 'products', 'reports'].includes(module.toLowerCase());
                      }
                      if (cat === 'production') {
                        return ['stock', 'transactions', 'bom', 'production', 'production_orders', 'products', 'warehouses', 'sections', 'reports'].includes(module.toLowerCase());
                      }
                      if (cat === 'sales') {
                        return ['orders', 'sales', 'products', 'reports'].includes(module.toLowerCase());
                      }
                      return true;
                    })
                    .map(([module, perms]) => {
                      const moduleCheckedCount = perms.filter(p => selectedPermIds.has(p.id)).length;
                      const allChecked = moduleCheckedCount === perms.length;

                      return (
                        <div key={module} style={{
                          background: 'rgba(255,255,255,0.02)', padding: 14, borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-border)'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                            <span style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--color-text-primary)', letterSpacing: 0.5 }}>
                              {module}
                            </span>
                            <button 
                              type="button" 
                              className="btn btn-ghost btn-sm" 
                              onClick={() => handleToggleModuleAll(perms, allChecked)}
                              style={{ padding: '2px 8px', fontSize: 11, fontWeight: 700 }}
                            >
                              {allChecked ? 'Deselect All' : 'Select All'}
                            </button>
                          </div>

                          <div className="responsive-grid-4" style={{ gap: 10 }}>
                            {perms.map(p => {
                              const isChecked = selectedPermIds.has(p.id);
                              return (
                                <div 
                                  key={p.id}
                                  onClick={() => handleTogglePermission(p.id)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
                                    cursor: 'pointer', padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                                    background: isChecked ? 'rgba(59,130,246,0.1)' : 'transparent',
                                    border: isChecked ? '1px solid rgba(59,130,246,0.2)' : '1px solid transparent',
                                    transition: 'all var(--transition-fast)'
                                  }}
                                >
                                  {isChecked ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} color="var(--color-text-muted)" />}
                                  <span style={{ fontWeight: isChecked ? 600 : 400, color: isChecked ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                                    {p.action}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Role Policy</button>
            </div>
          </form>
        </div>
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
            label: 'Archive Selected',
            icon: <Archive size={16} />,
            onClick: handleBulkArchive,
            className: 'btn-danger text-danger'
          }
        ]}
      />
    </div>
  );
}
