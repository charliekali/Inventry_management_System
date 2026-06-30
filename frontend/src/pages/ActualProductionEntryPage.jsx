import { useState, useEffect } from 'react';
import { productionPlansAPI } from '../api';
import toast from 'react-hot-toast';
import { 
  ClipboardList, CheckCircle2, Factory, Calendar, 
  User, Warehouse, Play, Check, X, Search, Filter, AlertTriangle 
} from 'lucide-react';

export default function ActualProductionEntryPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('PLANNED'); // PLANNED, COMPLETED, ALL

  // Modal State
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [actualQuantity, setActualQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const res = await productionPlansAPI.list();
      setPlans(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load production plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleOpenEntry = (plan) => {
    setSelectedPlan(plan);
    setActualQuantity(plan.planned_quantity.toString());
  };

  const handleCloseEntry = () => {
    setSelectedPlan(null);
    setActualQuantity('');
  };

  const handleSubmitActual = async (e) => {
    e.preventDefault();
    if (!selectedPlan) return;

    const actualQtyNum = parseFloat(actualQuantity);
    if (isNaN(actualQtyNum) || actualQtyNum <= 0) {
      return toast.error('Please enter a valid actual quantity');
    }

    if (actualQtyNum > selectedPlan.planned_quantity) {
      return toast.error(`Actual quantity cannot exceed planned quantity of ${selectedPlan.planned_quantity} ${selectedPlan.product_unit}`);
    }

    setSubmitting(true);
    try {
      const res = await productionPlansAPI.recordActual(selectedPlan.id, actualQtyNum);
      toast.success(res.data.message || 'Actual production recorded successfully!');
      handleCloseEntry();
      loadPlans();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record actual production');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPlans = plans.filter(p => {
    const matchesSearch = 
      (p.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.product_code || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.assigned_user_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.plan_number || '').toLowerCase().includes(search.toLowerCase());

    const matchesStatus = 
      statusFilter === 'ALL' || 
      p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Actual Production Entry</h2>
          <p>Record actual output quantities and execute final raw material stock outs and finished goods GR</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 20,
        alignItems: 'center',
        background: 'var(--color-bg-card)',
        padding: 16,
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input 
            type="text"
            placeholder="Search by plan, product, or operator..."
            className="form-control"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Filter size={16} color="var(--color-text-muted)" />
          <select 
            className="form-control"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="PLANNED">Planned (Active)</option>
            <option value="COMPLETED">Completed</option>
            <option value="ALL">All Plans</option>
          </select>
        </div>
      </div>

      {/* Plans Grid / Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div className="loading-spinner" />
          </div>
        ) : filteredPlans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)' }}>
            <ClipboardList size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
            <h4>No Production Plans Found</h4>
            <p style={{ fontSize: 13 }}>Create a new production plan to get started.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Plan Number</th>
                  <th>Plan Date</th>
                  <th>Product</th>
                  <th>Assigned Operator</th>
                  <th style={{ textAlign: 'right' }}>Planned Qty</th>
                  <th style={{ textAlign: 'right' }}>Actual Qty</th>
                  <th>Destination</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map(p => (
                  <tr key={p.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{p.plan_number}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                        <Calendar size={13} color="var(--color-text-muted)" />
                        {p.plan_date}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{p.product_name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{p.product_code}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={14} color="var(--color-text-muted)" />
                        <span>{p.assigned_user_name}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>
                      {p.planned_quantity} {p.product_unit}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success)' }}>
                      {p.status === 'COMPLETED' ? `${p.actual_quantity} ${p.product_unit}` : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                        <Warehouse size={13} color="var(--color-text-muted)" />
                        <span>{p.warehouse_name} {p.section_name && `· ${p.section_name}`}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {p.status === 'PLANNED' ? (
                        <span className="badge badge-blue">Planned</span>
                      ) : p.status === 'COMPLETED' ? (
                        <span className="badge badge-green">Completed</span>
                      ) : (
                        <span className="badge badge-gray">Cancelled</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {p.status === 'PLANNED' ? (
                        <button 
                          className="btn btn-primary btn-xs"
                          onClick={() => handleOpenEntry(p)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Play size={11} fill="currentColor" />
                          Record Actual
                        </button>
                      ) : (
                        <button className="btn btn-ghost btn-xs" disabled>
                          <CheckCircle2 size={13} />
                          Finalized
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Actual Entry Modal */}
      {selectedPlan && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>Record Actual Output</h3>
              <button className="btn-close" onClick={handleCloseEntry}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitActual}>
              <div className="modal-body">
                <div style={{
                  padding: 14,
                  background: 'rgba(59, 130, 246, 0.05)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 16,
                  border: '1px dashed rgba(59, 130, 246, 0.15)'
                }}>
                  <div style={{ fontSize: 11.5, textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: 4 }}>Production Plan</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{selectedPlan.product_name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    Plan No: <strong>{selectedPlan.plan_number}</strong> | Date: <strong>{selectedPlan.plan_date}</strong>
                  </div>
                  <div style={{ fontSize: 13, marginTop: 8, fontWeight: 700 }}>
                    Planned Output: <span className="text-primary">{selectedPlan.planned_quantity} {selectedPlan.product_unit}</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Actual Quantity Produced ({selectedPlan.product_unit})</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input 
                      type="number"
                      step="any"
                      min="0.0001"
                      className="form-control"
                      value={actualQuantity}
                      onChange={e => setActualQuantity(e.target.value)}
                      placeholder="Enter actual output quantity..."
                      required
                      autoFocus
                    />
                    <span style={{ position: 'absolute', right: 12, fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      {selectedPlan.product_unit}
                    </span>
                  </div>
                  <small style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: 6 }}>
                    Enter the exact quantity produced. It can be any amount up to the planned quantity, but it cannot exceed <strong>{selectedPlan.planned_quantity} {selectedPlan.product_unit}</strong>.
                  </small>
                </div>

                {parseFloat(actualQuantity) > selectedPlan.planned_quantity && (
                  <div style={{
                    display: 'flex', gap: 8, alignItems: 'center', marginTop: 12,
                    color: 'var(--color-danger)', fontSize: 12, fontWeight: 600,
                    background: 'var(--color-danger-bg)', padding: '8px 12px', borderRadius: 8
                  }}>
                    <AlertTriangle size={14} />
                    <span>Actual quantity cannot exceed the planned quantity.</span>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseEntry} disabled={submitting}>
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={submitting || !actualQuantity || parseFloat(actualQuantity) <= 0 || parseFloat(actualQuantity) > selectedPlan.planned_quantity}
                >
                  <Check size={16} />
                  {submitting ? 'Recording...' : 'Submit & Stock Out'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
