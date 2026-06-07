import { useState, useEffect } from 'react';
import { formSettingsAPI } from '../api';
import toast from 'react-hot-toast';
import {
  SlidersHorizontal, Save, RotateCcw, Eye, EyeOff,
  AlertCircle, Check, ArrowDownCircle, ArrowUpCircle, GripVertical, Plus, Trash2,
  FileText
} from 'lucide-react';

const FORM_TYPES = [
  { key: 'STOCK_IN',  label: 'Stock IN',  icon: ArrowDownCircle, color: 'var(--color-success)' },
  { key: 'STOCK_OUT', label: 'Stock OUT', icon: ArrowUpCircle,   color: 'var(--color-danger)' },
  { key: 'ORDER',     label: 'Create Order', icon: FileText,      color: 'var(--color-warning)' },
];

export default function FormSettingsPage() {
  const [activeForm, setActiveForm] = useState('STOCK_IN');
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);

  // Custom Field State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const loadFields = (formType) => {
    setLoading(true);
    formSettingsAPI.get(formType)
      .then(r => setFields(r.data.data || []))
      .catch(() => toast.error('Failed to load form settings'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFields(activeForm);
  }, [activeForm]);

  const handleToggle = (idx, prop) => {
    setFields(prev => prev.map((f, i) => {
      if (i !== idx) return f;
      // Don't allow toggling locked fields
      if (prop === 'visible'  && f.locked_visible)  return f;
      if (prop === 'required' && f.locked_required) return f;
      // If hiding a field, also unset required
      if (prop === 'visible' && f.visible) return { ...f, visible: false, required: false };
      return { ...f, [prop]: !f[prop] };
    }));
  };

  const handleLabelChange = (idx, value) => {
    setFields(prev => prev.map((f, i) => i === idx ? { ...f, label: value } : f));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await formSettingsAPI.save(activeForm, fields.map((f, i) => ({ ...f, field_order: i + 1 })));
      toast.success('Form settings saved! Changes will apply immediately.');
      // Invalidate hook cache on next navigation
      loadFields(activeForm);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // ── Drag-to-reorder ──────────────────────────────────────────────────────
  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setFields(prev => {
      const reordered = [...prev];
      const [moved] = reordered.splice(dragIdx, 1);
      reordered.splice(idx, 0, moved);
      setDragIdx(idx);
      return reordered;
    });
  };
  const handleDragEnd = () => setDragIdx(null);

  const handleAddCustomField = () => {
    if (!newKey.trim() || !newLabel.trim()) return toast.error('Key and Label are required');
    const formattedKey = 'custom_' + newKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    if (fields.some(f => f.field_key === formattedKey)) {
      return toast.error('A field with this key already exists');
    }

    const newField = {
      field_key: formattedKey,
      label: newLabel.trim(),
      visible: true,
      required: false,
      field_order: fields.length + 1,
      is_custom: true,
      locked_visible: false,
      locked_required: false
    };

    setFields(prev => [...prev, newField]);
    setShowAddModal(false);
    setNewKey('');
    setNewLabel('');
    toast.success('Custom field added! Remember to save settings.');
  };

  const handleDeleteField = (idx) => {
    setFields(prev => {
      const reordered = [...prev];
      reordered[idx] = { ...reordered[idx], deleted: true };
      return reordered;
    });
  };

  const activeFormInfo = FORM_TYPES.find(f => f.key === activeForm);

  // Filter out locally deleted fields from UI
  const visibleFields = fields.filter(f => !f.deleted);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Form Settings</h2>
          <p>Configure which fields are visible and required on Stock IN / OUT forms</p>
        </div>
        <div className="page-header-right" style={{ gap: 10, display: 'flex' }}>
          <button className="btn btn-secondary" onClick={() => setShowAddModal(true)}>
            <Plus size={15} />
            Add Custom Field
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
            <Save size={15} />
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Form type tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {FORM_TYPES.map(ft => {
          const Icon = ft.icon;
          const isActive = activeForm === ft.key;
          return (
            <button
              key={ft.key}
              onClick={() => setActiveForm(ft.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 'var(--radius-md)',
                border: `2px solid ${isActive ? ft.color : 'var(--color-border)'}`,
                background: isActive ? `${ft.color}18` : 'var(--color-bg-card)',
                color: isActive ? ft.color : 'var(--color-text-muted)',
                fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Icon size={16} />
              {ft.label}
            </button>
          );
        })}
      </div>

      <div className="responsive-grid-2-3" style={{ gap: 24 }}>

        {/* ── Settings Table ─────────────────────────────────────────────── */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SlidersHorizontal size={17} color={activeFormInfo?.color} />
              <div className="card-title">{activeFormInfo?.label} Form Fields</div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <GripVertical size={14} />
              Drag rows to reorder fields
            </div>
          </div>

          {loading ? (
            <div className="loading-center"><div className="loading-spinner" /></div>
          ) : (
            <>
              {/* Info banner */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)',
                color: 'var(--color-primary-light)', fontSize: 12.5, marginBottom: 20
              }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  Fields with a 🔒 lock cannot be hidden or changed — they are required for valid stock entries.
                  Drag the <strong>grip handle</strong> on the left to reorder fields. Changes take effect immediately after saving.
                </span>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}></th>
                      <th>Field</th>
                      <th>Custom Label</th>
                      <th style={{ textAlign: 'center', width: 110 }}>Visible</th>
                      <th style={{ textAlign: 'center', width: 110 }}>Required</th>
                      <th style={{ textAlign: 'center', width: 80 }}>Status</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFields.map((f, idx) => {
                      // Find real index in full fields array
                      const realIdx = fields.findIndex(xf => xf.field_key === f.field_key);
                      const isLockedV = f.locked_visible === true;
                      const isLockedR = f.locked_required === true;
                      return (
                        <tr
                          key={f.field_key}
                          draggable
                          onDragStart={() => handleDragStart(realIdx)}
                          onDragOver={e => handleDragOver(e, realIdx)}
                          onDragEnd={handleDragEnd}
                          style={{
                            opacity: dragIdx === idx ? 0.5 : 1,
                            background: dragIdx === idx ? 'rgba(59,130,246,0.07)' : undefined,
                            cursor: 'grab'
                          }}
                        >
                          {/* Drag handle */}
                          <td>
                            <GripVertical size={16} color="var(--color-text-muted)" style={{ cursor: 'grab' }} />
                          </td>

                          {/* Field key + lock */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              <code style={{
                                fontSize: 11, padding: '2px 7px', borderRadius: 4,
                                background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)'
                              }}>{f.field_key}</code>
                              {(isLockedV || isLockedR) && (
                                <span title="Locked field — cannot be hidden or made optional" style={{ fontSize: 13 }}>🔒</span>
                              )}
                            </div>
                          </td>

                          {/* Custom label */}
                          <td>
                            <input
                              type="text"
                              className="form-control"
                              value={f.label}
                              onChange={e => handleLabelChange(realIdx, e.target.value)}
                              style={{ fontSize: 13, padding: '6px 10px', minWidth: 180 }}
                            />
                          </td>

                          {/* Visible toggle */}
                          <td style={{ textAlign: 'center' }}>
                            <label className="toggle-switch" title={isLockedV ? 'Cannot hide this field' : ''}>
                              <input
                                type="checkbox"
                                checked={f.visible !== false}
                                disabled={isLockedV}
                                onChange={() => handleToggle(realIdx, 'visible')}
                              />
                              <span className="toggle-slider" />
                            </label>
                          </td>

                          {/* Required toggle */}
                          <td style={{ textAlign: 'center' }}>
                            <label className="toggle-switch" title={isLockedR ? 'Always required' : (!f.visible ? 'Field is hidden' : '')}>
                              <input
                                type="checkbox"
                                checked={f.required === true || isLockedR}
                                disabled={isLockedR || f.visible === false}
                                onChange={() => handleToggle(realIdx, 'required')}
                              />
                              <span className="toggle-slider" style={isLockedR ? { opacity: 0.6 } : {}} />
                            </label>
                          </td>

                          {/* Status badge */}
                          <td style={{ textAlign: 'center' }}>
                            {f.visible === false ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 9px', borderRadius: 99,
                                background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
                                fontSize: 11, fontWeight: 700
                              }}>
                                <EyeOff size={11} /> Hidden
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 9px', borderRadius: 99,
                                background: 'var(--color-success-bg)', color: 'var(--color-success)',
                                fontSize: 11, fontWeight: 700
                              }}>
                                <Eye size={11} /> Visible
                              </span>
                            )}
                          </td>
                          
                          {/* Delete Action */}
                          <td>
                            {f.is_custom && (
                              <button
                                className="btn btn-ghost btn-icon"
                                onClick={() => handleDeleteField(realIdx)}
                                title="Delete custom field"
                                style={{ color: 'var(--color-danger)' }}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* ── Live Preview Card ───────────────────────────────────────────── */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {activeFormInfo && <activeFormInfo.icon size={17} color={activeFormInfo.color} />}
              <div className="card-title">{activeFormInfo?.label} Form Preview</div>
            </div>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Live preview of how the form will appear to operators</span>
          </div>

          {!loading && (
            <div style={{ padding: '8px 0' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12
              }}>
                {[...visibleFields]
                  .sort((a, b) => (a.field_order || 0) - (b.field_order || 0))
                  .filter(f => f.visible !== false)
                  .map(f => (
                    <div key={f.field_key} className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: 12, opacity: 0.8 }}>
                        {f.label}
                        {(f.required || f.locked_required) && (
                          <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>
                        )}
                      </label>
                      <div className="form-control" style={{
                        fontSize: 12, height: 36, opacity: 0.4,
                        display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)'
                      }}>
                        {getPlaceholder(f.field_key)}
                      </div>
                    </div>
                  ))
                }
              </div>
              {visibleFields.filter(f => f.visible !== false).length === 0 && (
                <div className="empty-state">
                  <EyeOff size={36} />
                  <p>All fields are hidden! At least the locked fields will always be shown.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Save button (sticky bottom on mobile) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, gap: 10 }}>
        <button className="btn btn-secondary" onClick={() => loadFields(activeForm)} disabled={loading}>
          <RotateCcw size={14} />
          Reset
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
          <Save size={15} />
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {/* Add Custom Field Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">Add Custom Field</h3>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Field Label *</label>
                <input
                  type="text" className="form-control"
                  placeholder="e.g. Temperature, Driver Name"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Internal Key *</label>
                <input
                  type="text" className="form-control"
                  placeholder="e.g. temperature, driver_name"
                  value={newKey}
                  onChange={e => setNewKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                />
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Only lowercase letters, numbers, and underscores. Will be prefixed with 'custom_'.
                </p>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddCustomField}>Add Field</button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle switch style */}
      <style>{`
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
          cursor: pointer;
        }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider {
          position: absolute;
          inset: 0;
          background: rgba(255,255,255,0.1);
          border-radius: 24px;
          transition: 0.3s;
          border: 1px solid var(--color-border);
        }
        .toggle-slider::before {
          content: '';
          position: absolute;
          width: 18px; height: 18px;
          left: 2px; bottom: 2px;
          background: #9ca3af;
          border-radius: 50%;
          transition: 0.3s;
        }
        .toggle-switch input:checked + .toggle-slider { background: var(--color-primary); border-color: var(--color-primary); }
        .toggle-switch input:checked + .toggle-slider::before { transform: translateX(20px); background: white; }
        .toggle-switch input:disabled + .toggle-slider { opacity: 0.45; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

function getPlaceholder(key) {
  const map = {
    product_id: 'Select Product…',
    transaction_date: 'YYYY-MM-DD',
    warehouse_id: 'Select Warehouse…',
    section_id: 'Select Section…',
    quantity: '0.00',
    unit: 'PCS',
    reference_doc: 'GR Slip / Doc #',
    remarks: 'Additional notes…'
  };
  return map[key] || (key.startsWith('custom_') ? 'Custom text value…' : '—');
}
