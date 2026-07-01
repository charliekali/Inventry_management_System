import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { stockAPI } from '../../api';
import toast from 'react-hot-toast';
import { 
  Factory, ClipboardList, CheckCircle2, AlertTriangle, 
  ListPlus, History, User, RefreshCw, ChevronRight, Activity
} from 'lucide-react';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function ProductionHome() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    stockAPI.productionDashboard()
      .then(r => setData(r.data.data))
      .catch(() => toast.error('Failed to load production dashboard'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-spinner-wrap">
        <div className="p-spinner" />
      </div>
    );
  }

  if (!data) return null;

  const { kpis, recentProductionTx } = data;
  const firstName = user?.name?.split(' ')?.[0] || 'Operator';

  return (
    <div className="p-page p-fade-in">
      {/* Greeting */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800 }}>{getGreeting()}, {firstName}! 🏭</h3>
          <p style={{ fontSize: 12, color: 'var(--p-text-2)', marginTop: 4 }}>
            {kpis.pendingPOs > 0 
              ? `⚡ You have ${kpis.pendingPOs} active production orders pending` 
              : "✅ All scheduled runs are up to date"}
          </p>
        </div>
      </div>

      {/* KPI row */}
      <div className="p-kpi-row">
        <div className="p-kpi blue">
          <div className="p-kpi-icon blue"><ClipboardList size={16} color="#3b82f6" /></div>
          <div className="p-kpi-val">{kpis.pendingPOs}</div>
          <div className="p-kpi-label">Active Orders</div>
        </div>
        <div className="p-kpi green">
          <div className="p-kpi-icon green"><CheckCircle2 size={16} color="#10b981" /></div>
          <div className="p-kpi-val">{kpis.completedPOs}</div>
          <div className="p-kpi-label">Completed Runs</div>
        </div>
        <div className="p-kpi red">
          <div className="p-kpi-icon red"><AlertTriangle size={16} color="#ef4444" /></div>
          <div className="p-kpi-val">{kpis.lowStockCount}</div>
          <div className="p-kpi-label">Low Stock Alerts</div>
        </div>
        <div className="p-kpi purple">
          <div className="p-kpi-icon purple"><Activity size={16} color="#8b5cf6" /></div>
          <div className="p-kpi-val">{kpis.totalRM + kpis.totalFG}</div>
          <div className="p-kpi-label">Active SKUs</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-section-label">Quick Actions</div>
      <div className="p-quick-actions" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))' }}>
        {hasPermission('PRODUCTION:PLAN') && (
          <button className="p-qa-btn" onClick={() => navigate('/production/plan')}>
            <div className="p-qa-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>
              <Factory size={20} color="#3b82f6" />
            </div>
            <span className="p-qa-label">Plan Production</span>
          </button>
        )}
        {hasPermission('PRODUCTION:RUN') && (
          <button className="p-qa-btn" onClick={() => navigate('/production/actual')}>
            <div className="p-qa-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <ClipboardList size={20} color="#10b981" />
            </div>
            <span className="p-qa-label">Actual Entry</span>
          </button>
        )}
        <button className="p-qa-btn" onClick={() => navigate('/production/recipes')}>
          <div className="p-qa-icon" style={{ background: 'rgba(139,92,246,0.15)' }}>
            <ListPlus size={20} color="#8b5cf6" />
          </div>
          <span className="p-qa-label">Recipes / BOM</span>
        </button>
        <button className="p-qa-btn" onClick={() => navigate('/production/history')}>
          <div className="p-qa-icon" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <History size={20} color="#f59e0b" />
          </div>
          <span className="p-qa-label">Run History</span>
        </button>
      </div>

      {/* Recent Production Transactions */}
      <div className="p-section-label">📋 Recent Production Logs</div>
      <div className="p-card">
        {recentProductionTx.length === 0 ? (
          <div className="p-empty">
            <ClipboardList size={32} style={{ opacity: 0.5 }} />
            <p className="title">No production runs recorded</p>
            <p className="sub">Use the Plan or Actual Entry actions to start production logs.</p>
          </div>
        ) : (
          <div className="p-list">
            {recentProductionTx.map((tx, idx) => (
              <div key={idx} className="p-list-item" onClick={() => navigate('/production/history')}>
                <div className={`p-list-avatar ${tx.type === 'IN' ? 'avatar-green' : 'avatar-red'}`}>
                  {tx.type === 'IN' ? '↓' : '↑'}
                </div>
                <div className="p-list-body">
                  <div className="p-list-title">{tx.product_name}</div>
                  <div className="p-list-sub">
                    {tx.product_code} · {tx.warehouse_name}
                  </div>
                </div>
                <div className="p-list-right">
                  <div className={`p-list-amount ${tx.type === 'IN' ? 'p-text-success' : 'p-text-danger'}`}>
                    {tx.type === 'IN' ? '+' : '-'}{tx.quantity} {tx.unit}
                  </div>
                  <div className="p-list-date">{tx.transaction_date}</div>
                </div>
                <ChevronRight size={16} color="var(--p-text-3)" style={{ flexShrink: 0, marginLeft: 6 }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
