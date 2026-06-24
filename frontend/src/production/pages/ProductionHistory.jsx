import { useState, useEffect } from 'react';
import { transactionsAPI } from '../../api';
import toast from 'react-hot-toast';
import { History, Calendar, User, ChevronDown, ChevronUp } from 'lucide-react';

export default function ProductionHistory() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRun, setExpandedRun] = useState(null);

  useEffect(() => {
    transactionsAPI.productionRuns()
      .then(res => setRuns(res.data.data || []))
      .catch(() => toast.error('Failed to load production runs history'))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = (refDoc) => {
    if (expandedRun === refDoc) {
      setExpandedRun(null);
    } else {
      setExpandedRun(refDoc);
    }
  };

  if (loading) {
    return (
      <div className="p-spinner-wrap">
        <div className="p-spinner" />
      </div>
    );
  }

  return (
    <div className="p-page p-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <History size={22} color="var(--p-primary)" />
        <h3 style={{ fontSize: 16, fontWeight: 800 }}>Production Run History</h3>
      </div>

      {runs.length === 0 ? (
        <div className="p-card p-empty">
          <History size={32} style={{ opacity: 0.5 }} />
          <p className="title">No history logs</p>
          <p className="sub">Executed runs will appear here dynamically.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {runs.map((run) => {
            const isExpanded = expandedRun === run.reference_doc;
            return (
              <div key={run.reference_doc} className="p-card" style={{ marginBottom: 0 }}>
                {/* Header Section */}
                <div 
                  onClick={() => toggleExpand(run.reference_doc)}
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: isExpanded ? 'rgba(255,255,255,0.02)' : 'none'
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{run.product_name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--p-text-2)', marginTop: 4 }}>
                      Batch: {run.reference_doc.substring(0, 16)}... · {run.transaction_date}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div className="p-text-success" style={{ fontWeight: 800, fontSize: 14 }}>
                        +{run.quantity_produced} {run.unit}
                      </div>
                      <span className="p-chip gray" style={{ fontSize: 9, padding: '1px 6px', marginTop: 2 }}>{run.warehouse_name}</span>
                    </div>
                    {isExpanded ? <ChevronUp size={16} color="var(--p-text-3)" /> : <ChevronDown size={16} color="var(--p-text-3)" />}
                  </div>
                </div>

                {/* Collapsible Details */}
                {isExpanded && (
                  <div style={{
                    padding: '16px',
                    borderTop: '1px solid var(--p-border)',
                    background: 'rgba(0,0,0,0.1)'
                  }}>
                    <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--p-text-3)' }}>Operator:</span>
                        <span style={{ fontWeight: 600 }}>{run.performed_by}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--p-text-3)' }}>Process Wastage:</span>
                        <span style={{ fontWeight: 600 }}>{run.wastage_pct}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--p-text-3)' }}>Damage / Rejection:</span>
                        <span style={{ fontWeight: 600 }}>{run.damage_pct}%</span>
                      </div>
                      {run.remarks && (
                        <div style={{ borderTop: '1px dashed var(--p-border)', paddingTop: 8, marginTop: 4 }}>
                          <span style={{ color: 'var(--p-text-3)' }}>Remarks: </span>
                          <span style={{ fontStyle: 'italic' }}>"{run.remarks}"</span>
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--p-text-3)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.04em' }}>
                      Consumed Ingredients
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {run.ingredients.map((ing, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          background: 'rgba(255,255,255,0.02)',
                          borderRadius: 4,
                          fontSize: 12
                        }}>
                          <span>{ing.product_name} <span style={{ color: 'var(--p-text-3)', fontSize: 10 }}>({ing.warehouse_name})</span></span>
                          <span className="p-text-danger" style={{ fontWeight: 700 }}>
                            -{ing.quantity} {ing.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
