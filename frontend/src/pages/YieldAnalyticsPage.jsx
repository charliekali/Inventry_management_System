import { useState, useEffect } from 'react';
import { transactionsAPI } from '../api';
import toast from 'react-hot-toast';
import { 
  TrendingUp, AlertTriangle, ShieldCheck, Factory, BarChart3, LineChart, PieChart as PieIcon, Info, History, Download
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import useBulkActions from '../hooks/useBulkActions';
import BulkActionBar from '../components/BulkActionBar';

export default function YieldAnalyticsPage() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('all'); // all, 30days, 7days

  const loadData = () => {
    setLoading(true);
    transactionsAPI.productionRuns()
      .then(res => {
        setRuns(res.data.data);
      })
      .catch(() => toast.error('Failed to load yield analytics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    transactionsAPI.productionRuns()
      .then(res => {
        setRuns(res.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Filter runs by selected time range
  const getFilteredRuns = () => {
    if (timeRange === 'all') return runs;
    const limitDate = new Date();
    if (timeRange === '30days') limitDate.setDate(limitDate.getDate() - 30);
    if (timeRange === '7days') limitDate.setDate(limitDate.getDate() - 7);
    
    const limitStr = limitDate.toISOString().split('T')[0];
    return runs.filter(r => r.transaction_date >= limitStr);
  };

  const filteredRuns = getFilteredRuns();

  // 1. KPI Metrics Calculations
  let totalInputKg = 0;
  let totalOutputKg = 0;
  let totalPacksProduced = 0;
  let totalWastageKg = 0;
  let totalDamageKg = 0;

  filteredRuns.forEach(run => {
    const qty = run.quantity_produced;
    const wastage = run.wastage_pct || 0;
    const damage = run.damage_pct || 0;
    
    const isKg = run.unit?.toUpperCase() === 'KG';
    
    // Scale factor to find total raw input
    const lossMultiplier = 1.0 - ((wastage + damage) / 100.0);
    const totalInput = lossMultiplier > 0 ? (qty / lossMultiplier) : qty;
    
    if (isKg) {
      totalInputKg += totalInput;
      totalOutputKg += qty;
      totalWastageKg += totalInput * (wastage / 100.0);
      totalDamageKg += totalInput * (damage / 100.0);
    } else {
      totalPacksProduced += qty;
      // If packs unit, we can approximate packaging damage by pouch counts
      totalWastageKg += totalInput * (wastage / 100.0); // raw material equivalent
      totalDamageKg += totalInput * (damage / 100.0);
    }
  });

  const overallEfficiency = totalInputKg > 0 ? (totalOutputKg / totalInputKg) * 100 : 100;
  const avgWastagePct = filteredRuns.length > 0
    ? filteredRuns.reduce((sum, r) => sum + (r.wastage_pct || 0), 0) / filteredRuns.length
    : 0;
  const avgDamagePct = filteredRuns.length > 0
    ? filteredRuns.reduce((sum, r) => sum + (r.damage_pct || 0), 0) / filteredRuns.length
    : 0;

  // 2. Chart 1 Data: Yield & Wastage Trend Over Time
  const trendMap = {};
  filteredRuns.forEach(run => {
    const d = run.transaction_date;
    if (!trendMap[d]) {
      trendMap[d] = { date: d, produced: 0, wastageSum: 0, count: 0 };
    }
    trendMap[d].produced += run.quantity_produced;
    trendMap[d].wastageSum += run.wastage_pct || 0;
    trendMap[d].count += 1;
  });

  const trendData = Object.values(trendMap)
    .map(t => ({
      date: t.date,
      "Quantity Produced": Math.round(t.produced * 100) / 100,
      "Average Wastage %": Math.round((t.wastageSum / t.count) * 10) / 10
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 3. Chart 2 Data: Comparative Loss Breakdown by Product
  const productMap = {};
  filteredRuns.forEach(run => {
    const name = run.product_name;
    const code = run.product_code;
    const key = `${code} - ${name}`;
    if (!productMap[key]) {
      productMap[key] = { name: key, wastageSum: 0, damageSum: 0, count: 0, produced: 0, unit: run.unit };
    }
    productMap[key].wastageSum += run.wastage_pct || 0;
    productMap[key].damageSum += run.damage_pct || 0;
    productMap[key].count += 1;
    productMap[key].produced += run.quantity_produced;
  });

  const productData = Object.values(productMap).map((p, idx) => ({
    id: idx, // Adding a local ID for selection hook
    name: p.name,
    shortName: p.name.length > 25 ? p.name.slice(0, 22) + '...' : p.name,
    "Avg Wastage %": Math.round((p.wastageSum / p.count) * 10) / 10,
    "Avg Damage %": Math.round((p.damageSum / p.count) * 10) / 10,
    batches: p.count,
    produced: Math.round(p.produced * 100) / 100,
    unit: p.unit
  }));

  // 4. Chart 3 Data: Loss Share Pie Chart (Wastage vs Damage mass)
  const pieData = [
    { name: 'Process Wastage (Dust/Moisture)', value: totalWastageKg > 0 ? totalWastageKg : avgWastagePct },
    { name: 'Packaging Rejections (Damage)', value: totalDamageKg > 0 ? totalDamageKg : avgDamagePct }
  ];
  const COLORS = ['#f59e0b', '#ef4444'];

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
  } = useBulkActions(productData, 'id');

  if (loading) {
    return (
      <div className="loading-center" style={{ height: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  const handleBulkExport = () => {
    const selected = getSelectedItems();
    let csvContent = 'Product,Total Batches,Total Produced,Unit,Avg Wastage %,Avg Damage %,Yield Health\n';
    
    selected.forEach(item => {
      const totalLoss = item["Avg Wastage %"] + item["Avg Damage %"];
      const status = totalLoss > 6 ? 'Critical' : totalLoss > 3 ? 'Warning' : 'Healthy';
      const row = [
        item.name,
        item.batches,
        item.produced,
        item.unit,
        item["Avg Wastage %"],
        item["Avg Damage %"],
        status
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
      csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `yield_audit_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedCount} audit records to CSV`);
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h2>Yield & Process Loss Analytics</h2>
          <p>Monitor spices blending loss, grinding dust factors, and packaging damage trends</p>
        </div>
        <div className="page-header-right" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadData} style={{ display: 'flex', gap: 6, height: 38, alignItems: 'center' }}>
            <History size={14} />
            Refresh
          </button>
          <select 
            className="form-control" 
            style={{ width: 160, padding: '8px 12px', fontSize: 13, height: 38 }}
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="all">All-Time History</option>
            <option value="30days">Last 30 Days</option>
            <option value="7days">Last 7 Days</option>
          </select>
        </div>
      </div>

      {filteredRuns.length === 0 ? (
        <div className="card empty-state" style={{ padding: '60px 20px' }}>
          <LineChart size={48} style={{ opacity: 0.4, marginBottom: 12 }} />
          <h3>No Analytics Data Available</h3>
          <p>Execute production runs to populate interactive yield and process loss analytics.</p>
        </div>
      ) : (
        <>
          {/* KPI Analytics Row */}
          <div className="kpi-grid" style={{ marginBottom: 28 }}>
            <div className="kpi-card blue">
              <div className="kpi-icon blue"><TrendingUp size={20} color="#60a5fa"/></div>
              <div className="kpi-value">{overallEfficiency > 0 ? `${overallEfficiency.toFixed(1)}%` : '100%'}</div>
              <div className="kpi-label">Yield Efficiency (KG)</div>
            </div>
            <div className="kpi-card green">
              <div className="kpi-icon green"><Factory size={20} color="#10b981"/></div>
              <div className="kpi-value">{totalOutputKg.toFixed(1)} KG</div>
              <div className="kpi-label">Mass Output (Bulk)</div>
            </div>
            <div className="kpi-card cyan">
              <div className="kpi-icon cyan"><BarChart3 size={20} color="#06b6d4"/></div>
              <div className="kpi-value">{totalPacksProduced} Packs</div>
              <div className="kpi-label">Packs Packaging Output</div>
            </div>
            <div className="kpi-card orange">
              <div className="kpi-icon orange"><AlertTriangle size={20} color="#f59e0b"/></div>
              <div className="kpi-value">{totalWastageKg.toFixed(2)} KG</div>
              <div className="kpi-label">Raw Material Wastage</div>
            </div>
            <div className="kpi-card red">
              <div className="kpi-icon red"><ShieldCheck size={20} color="#ef4444"/></div>
              <div className="kpi-value">{totalDamageKg.toFixed(2)} KG</div>
              <div className="kpi-label">Packaging Damage Loss</div>
            </div>
          </div>

          {/* Visual Charts Layout */}
          <div className="responsive-grid-equal-2" style={{ marginBottom: 28, alignItems: 'stretch' }}>
            
            {/* Chart 1: Yield Trend */}
            <div className="card" style={{ minHeight: 380, display: 'flex', flexDirection: 'column' }}>
              <div className="card-header" style={{ marginBottom: 16 }}>
                <div>
                  <div className="card-title">Production Yield & Loss Trend</div>
                  <div className="card-subtitle">Daily yield volume vs recipe wastage rates</div>
                </div>
                <LineChart size={18} color="var(--color-text-muted)" />
              </div>
              <div style={{ flex: 1, minHeight: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="producedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" stroke="var(--color-text-muted)" style={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" stroke="var(--color-text-secondary)" style={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="var(--color-warning)" style={{ fontSize: 11 }} unit="%" />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'var(--color-bg-card)', 
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                        borderRadius: 'var(--radius-sm)'
                      }} 
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area yAxisId="left" type="monotone" dataKey="Quantity Produced" stroke="var(--color-primary)" fillOpacity={1} fill="url(#producedGrad)" />
                    <Area yAxisId="right" type="monotone" dataKey="Average Wastage %" stroke="var(--color-warning)" fill="none" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Product Comparative Loss */}
            <div className="card" style={{ minHeight: 380, display: 'flex', flexDirection: 'column' }}>
              <div className="card-header" style={{ marginBottom: 16 }}>
                <div>
                  <div className="card-title">Wastage & Damage by Product</div>
                  <div className="card-subtitle">Comparing blending loss vs packaging damage per item</div>
                </div>
                <BarChart3 size={18} color="var(--color-text-muted)" />
              </div>
              <div style={{ flex: 1, minHeight: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="shortName" stroke="var(--color-text-muted)" style={{ fontSize: 10 }} />
                    <YAxis stroke="var(--color-text-secondary)" style={{ fontSize: 11 }} unit="%" />
                    <Tooltip 
                      contentStyle={{ 
                        background: 'var(--color-bg-card)', 
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                        borderRadius: 'var(--radius-sm)'
                      }} 
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Avg Wastage %" fill="var(--color-warning)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Avg Damage %" fill="var(--color-danger)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'stretch' }}>
            
            {/* Table: Product Audit Audit */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Product Yield Audit Ledger</div>
                  <div className="card-subtitle">Batch stats and recipe yield health audit</div>
                </div>
              </div>
              
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
                      <th>Product</th>
                      <th style={{ textAlign: 'center' }}>Total Batches</th>
                      <th style={{ textAlign: 'right' }}>Total Produced</th>
                      <th style={{ textAlign: 'center' }}>Avg Wastage</th>
                      <th style={{ textAlign: 'center' }}>Avg Damage</th>
                      <th style={{ textAlign: 'center' }}>Yield Health</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productData.map((item) => {
                      const totalLoss = item["Avg Wastage %"] + item["Avg Damage %"];
                      const status = totalLoss > 6 ? 'Critical' : totalLoss > 3 ? 'Warning' : 'Healthy';
                      const badgeClass = status === 'Critical' ? 'badge-red' : status === 'Warning' ? 'badge-orange' : 'badge-green';
                      const isChecked = isSelected(item.id);

                      return (
                        <tr key={item.id} style={{ background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox" 
                              checked={isChecked} 
                              onChange={() => toggleSelect(item.id)} 
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.name}</div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.batches}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>
                            {item.produced} {item.unit}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--color-warning)', fontWeight: 600 }}>
                            {item["Avg Wastage %"]}%
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--color-danger)', fontWeight: 600 }}>
                            {item["Avg Damage %"]}%
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${badgeClass}`}>{status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Distribution Pie Chart */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-header" style={{ marginBottom: 12 }}>
                <div>
                  <div className="card-title">Loss Cause Share</div>
                  <div className="card-subtitle">Wastage vs packaging defects</div>
                </div>
                <PieIcon size={18} color="var(--color-text-muted)" />
              </div>
              
              <div style={{ flex: 1, minHeight: 200, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val) => [`${Number(val).toFixed(2)} KG equivalent`, 'Loss Mass']}
                      contentStyle={{ 
                        background: 'var(--color-bg-card)', 
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                        borderRadius: 'var(--radius-sm)'
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, marginTop: 12 }}>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                    <span style={{ color: 'var(--color-text-secondary)' }}>Wastage</span>
                  </div>
                  <strong>{totalWastageKg.toFixed(1)} KG ({((totalWastageKg / (totalWastageKg + totalDamageKg || 1)) * 100).toFixed(0)}%)</strong>
                </div>
                <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
                    <span style={{ color: 'var(--color-text-secondary)' }}>Damage</span>
                  </div>
                  <strong>{totalDamageKg.toFixed(1)} KG ({((totalDamageKg / (totalWastageKg + totalDamageKg || 1)) * 100).toFixed(0)}%)</strong>
                </div>
              </div>

              <div style={{
                marginTop: 18,
                padding: 12,
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--color-border)',
                fontSize: 11.5,
                color: 'var(--color-text-muted)',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start'
              }}>
                <Info size={14} className="text-primary" style={{ flexShrink: 0, marginTop: 2 }} />
                <span>Losses are scaled based on batch size configurations in Finished Goods.</span>
              </div>
            </div>

          </div>
        </>
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
          }
        ]}
      />
    </div>
  );
}
