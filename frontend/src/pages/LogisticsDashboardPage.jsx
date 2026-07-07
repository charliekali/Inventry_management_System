import { useState, useEffect } from 'react';
import { shipmentsAPI } from '../api';
import toast from 'react-hot-toast';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  Truck, CheckCircle2, AlertTriangle, Package, Calendar, Clock, BarChart3
} from 'lucide-react';

export default function LogisticsDashboardPage() {
  const [stats, setStats] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [statsRes, listRes] = await Promise.all([
          shipmentsAPI.analytics(),
          shipmentsAPI.list()
        ]);
        setStats(statsRes.data.data);
        setShipments(listRes.data.data);
      } catch (err) {
        toast.error('Failed to load logistics analytics');
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  if (loading) {
    return <div className="loading-center"><div className="loading-spinner"></div></div>;
  }

  // Chart 1: Status distribution
  const statusData = [
    { name: 'Created', value: stats?.created || 0, color: '#f59e0b' },
    { name: 'En Route', value: stats?.en_route || 0, color: '#3b82f6' },
    { name: 'Delivered', value: stats?.delivered || 0, color: '#10b981' },
    { name: 'Failed', value: stats?.failed || 0, color: '#ef4444' }
  ].filter(d => d.value > 0);

  // Chart 2: Recent shipment volume trends (e.g. bags vs pcs grouped by driver)
  // Let's create helper drivers data
  const driverData = shipments.reduce((acc, s) => {
    if (s.status === 'DELIVERED' && s.driver_name) {
      const existing = acc.find(item => item.driver === s.driver_name);
      if (existing) {
        existing.bags += s.total_bags || 0;
        existing.pcs += s.total_pcs || 0;
      } else {
        acc.push({ driver: s.driver_name, bags: s.total_bags || 0, pcs: s.total_pcs || 0 });
      }
    }
    return acc;
  }, []).slice(0, 5);

  // Route breakdown
  const routeData = shipments.reduce((acc, s) => {
    if (s.destination) {
      const existing = acc.find(item => item.route === s.destination);
      if (existing) {
        existing.count += 1;
      } else {
        acc.push({ route: s.destination, count: 1 });
      }
    }
    return acc;
  }, []).sort((a,b) => b.count - a.count).slice(0, 5);

  return (
    <div className="fade-in" style={{ padding: 24 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-header-left">
          <h2>Logistics Analytics & KPIs</h2>
          <p>Analyze delivery statistics, driver performance, and dispatch loads.</p>
        </div>
      </div>

      {stats && (
        <>
          {/* Key Metrics Cards */}
          <div className="kpi-grid" style={{ marginBottom: 24 }}>
            <div className="kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-label">Total Shipments Recorded</span>
                <Truck size={20} color="var(--color-primary)" />
              </div>
              <div className="kpi-value">{stats.total_shipments}</div>
            </div>
            <div className="kpi-card green">
              <div className="kpi-card-header">
                <span className="kpi-label">Delivered Shipments</span>
                <CheckCircle2 size={20} color="var(--color-success)" />
              </div>
              <div className="kpi-value">{stats.delivered}</div>
            </div>
            <div className="kpi-card red">
              <div className="kpi-card-header">
                <span className="kpi-label">Failed Deliveries</span>
                <AlertTriangle size={20} color="var(--color-danger)" />
              </div>
              <div className="kpi-value">{stats.failed}</div>
            </div>
            <div className="kpi-card cyan">
              <div className="kpi-card-header">
                <span className="kpi-label">Delivered Pieces (Pcs)</span>
                <Package size={20} color="#06b6d4" />
              </div>
              <div className="kpi-value">{stats.delivered_pcs}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24, marginBottom: 24 }}>
            {/* Chart 1: Status Share */}
            <div className="card" style={{ height: 350 }}>
              <div className="card-header"><div className="card-title">Shipment Status Share</div></div>
              <div className="card-body" style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {statusData.length === 0 ? (
                  <div className="empty-state" style={{ padding: 0 }}><Package size={24} /> No active shipments data</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Driver Volumes */}
            <div className="card" style={{ height: 350 }}>
              <div className="card-header"><div className="card-title">Top Driver Delivery Volumes (Bags / Pcs)</div></div>
              <div className="card-body" style={{ height: 260 }}>
                {driverData.length === 0 ? (
                  <div className="empty-state" style={{ padding: 0 }}><Package size={24} /> No delivered driver data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={driverData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="driver" stroke="var(--color-text-muted)" />
                      <YAxis stroke="var(--color-text-muted)" />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)' }} />
                      <Legend />
                      <Bar dataKey="bags" fill="#3b82f6" name="Total Bags" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="pcs" fill="#06b6d4" name="Total Pieces" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Top Routes & Driver list */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            <div className="card">
              <div className="card-header"><div className="card-title">Popular Dispatch Routes</div></div>
              <div className="card-body">
                {routeData.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>No dispatch route records found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {routeData.map((route, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--color-border)', borderRadius: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{route.route}</span>
                        <span className="badge badge-cyan" style={{ fontSize: 11 }}>{route.count} trips</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><div className="card-title">Latest Shipments Feed</div></div>
              <div className="card-body">
                {shipments.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 13.5 }}>No shipments tracked yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {shipments.slice(0, 5).map((s, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, borderBottom: idx < 4 ? '1px solid var(--color-border)' : 'none' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{s.shipment_number}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{s.vehicle_number} — {s.driver_name}</div>
                        </div>
                        <div>
                          {statusData.find(item => item.name === s.status) ? (
                            getStatusBadge(s.status)
                          ) : (
                            <span className="badge badge-gray">{s.status}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function getStatusBadge(status) {
  switch (status) {
    case 'CREATED': return <span className="badge badge-orange">Created</span>;
    case 'EN_ROUTE': return <span className="badge badge-blue">En Route</span>;
    case 'DELIVERED': return <span className="badge badge-green">Delivered</span>;
    case 'FAILED': return <span className="badge badge-red">Failed</span>;
    default: return <span className="badge badge-gray">{status}</span>;
  }
}
