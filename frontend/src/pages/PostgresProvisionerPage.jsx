import { useState, useEffect, useRef } from 'react';
import { postgresAPI } from '../api';
import toast from 'react-hot-toast';
import { 
  Database, Plus, Trash2, Cpu, HardDrive, Activity, Terminal, 
  RefreshCw, ShieldAlert, CheckCircle, ExternalLink, Key, Globe, Layers
} from 'lucide-react';

const REGIONS = [
  { value: 'us-east-1', label: 'Virginia (US East)' },
  { value: 'us-west-2', label: 'Oregon (US West)' },
  { value: 'eu-central-1', label: 'Frankfurt (Europe)' },
  { value: 'ap-southeast-1', label: 'Singapore (Asia)' }
];

const VERSIONS = ['18', '17', '16', '15'];

const PLAN_OPTIONS = [
  { value: 'Hobby', price: 'Free', specs: 'Shared CPU, 256MB RAM, 1GB Storage', desc: 'Best for testing and development' },
  { value: 'Starter', price: '$7/mo', specs: '0.5 vCPU, 512MB RAM, 10GB SSD Storage', desc: 'Good for small hobby apps and staging' },
  { value: 'Pro Production', price: '$25/mo', specs: '1 vCPU, 2GB RAM, 50GB NVMe SSD', desc: 'For production traffic and high availability' },
  { value: 'Enterprise Dedicated', price: '$120/mo', specs: '4 vCPU, 16GB RAM, 250GB NVMe SSD', desc: 'Dedicated instance for heavy workloads' }
];

export default function PostgresProvisionerPage() {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState(null);
  
  const [metrics, setMetrics] = useState(null);
  const [logs, setLogs] = useState([]);
  const [pollingMetrics, setPollingMetrics] = useState(false);
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const logTerminalEndRef = useRef(null);

  // Form Fields State
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [databaseName, setDatabaseName] = useState('ims_db');
  const [username, setUsername] = useState('postgres');
  const [region, setRegion] = useState('Virginia (US East)');
  const [version, setVersion] = useState('18');
  const [planOption, setPlanOption] = useState('Hobby');
  const [showDatadog, setShowDatadog] = useState(false);
  const [datadogApiKey, setDatadogApiKey] = useState('');
  const [datadogRegion, setDatadogRegion] = useState('US1 (default)');

  const loadInstances = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await postgresAPI.list();
      setInstances(r.data.data || []);
      
      if (selectedInstance) {
        const updatedSelected = (r.data.data || []).find(inst => inst.id === selectedInstance.id);
        if (updatedSelected) {
          setSelectedInstance(updatedSelected);
        } else {
          setSelectedInstance(null);
        }
      }
    } catch {
      toast.error('Failed to load database instances');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
  }, []);

  useEffect(() => {
    let interval;
    if (selectedInstance && selectedInstance.status === 'ACTIVE') {
      const fetchMetricsAndLogs = async () => {
        try {
          const [mRes, lRes] = await Promise.all([
            postgresAPI.getMetrics(selectedInstance.id),
            postgresAPI.getLogs(selectedInstance.id)
          ]);
          setMetrics(mRes.data.data);
          setLogs(lRes.data.data || []);
        } catch {
          // Silent fail
        }
      };
      
      fetchMetricsAndLogs();
      interval = setInterval(fetchMetricsAndLogs, 4000);
    } else {
      setMetrics(null);
      setLogs([]);
    }

    return () => clearInterval(interval);
  }, [selectedInstance]);

  useEffect(() => {
    let statusInterval;
    const hasPending = instances.some(inst => inst.status === 'PROVISIONING' || inst.status === 'DELETING');
    if (hasPending) {
      statusInterval = setInterval(() => {
        loadInstances(true);
      }, 3000);
    }
    return () => clearInterval(statusInterval);
  }, [instances]);

  useEffect(() => {
    if (autoScrollLogs && logTerminalEndRef.current) {
      logTerminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScrollLogs]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Please enter a unique name for your instance');
    
    setSubmitting(true);
    try {
      await postgresAPI.create({
        name,
        databaseName,
        username,
        region,
        version,
        planOption,
        datadogApiKey: showDatadog ? datadogApiKey : '',
        datadogRegion: showDatadog ? datadogRegion : ''
      });
      toast.success('Database provisioning initiated!');
      setShowAddForm(false);
      resetForm();
      loadInstances();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initiate provisioning');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete database instance "${name}"? All data will be permanently destroyed.`)) return;

    try {
      await postgresAPI.delete(id);
      toast.success('Database teardown started');
      loadInstances();
    } catch {
      toast.error('Failed to trigger database teardown');
    }
  };

  const resetForm = () => {
    setName('');
    setDatabaseName('ims_db');
    setUsername('postgres');
    setRegion('Virginia (US East)');
    setVersion('18');
    setPlanOption('Hobby');
    setShowDatadog(false);
    setDatadogApiKey('');
    setDatadogRegion('US1 (default)');
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'ACTIVE': return 'badge-green';
      case 'PROVISIONING': return 'badge-orange';
      case 'DELETING': return 'badge-red';
      default: return 'badge-gray';
    }
  };

  const regionSlug = (selectedInstance && selectedInstance.region)
    ? selectedInstance.region.toLowerCase().replace(/[^a-z0-9]/g, '-')
    : 'unknown';

  return (
    <div className="fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div className="page-header">
        <div className="page-header-left">
          <h2>PostgreSQL Databases</h2>
          <p>Deploy, monitor, and configure PostgreSQL instances for your cloud networks</p>
        </div>
        <div className="page-header-right">
          <button 
            className="btn btn-primary" 
            onClick={() => { setShowAddForm(!showAddForm); setSelectedInstance(null); }}
          >
            <Plus size={16} />
            {showAddForm ? 'Back to Dashboard' : 'New Postgres Instance'}
          </button>
        </div>
      </div>

      {showAddForm ? (
        /* PROVISIONING FORM */
        <div className="card" style={{ maxWidth: 800, margin: '0 auto' }}>
          <div className="card-header" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 16, marginBottom: 24 }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Database size={18} className="text-primary" />
              <span>Create New PostgreSQL Instance</span>
            </div>
            <p className="card-subtitle">Configure database options, regional cluster networking, and Datadog APM settings</p>
          </div>

          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Instance Name */}
            <div className="form-group">
              <label className="form-label">Name <span>*</span></label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="example-postgresql-name"
                value={name}
                onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
              />
              <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                A unique identifier for your Postgres instance. Lowercase letters, numbers, and hyphens only.
              </p>
            </div>

            <div className="form-row">
              {/* Optional Database Name */}
              <div className="form-group">
                <label className="form-label">Database Name (Optional)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="randomly generated unless specified"
                  value={databaseName}
                  onChange={e => setDatabaseName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                />
              </div>

              {/* Optional Database User */}
              <div className="form-group">
                <label className="form-label">Master Username (Optional)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="randomly generated unless specified"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                />
              </div>
            </div>

            <div className="form-row">
              {/* Region Selector */}
              <div className="form-group">
                <label className="form-label">Region</label>
                <select className="form-control" value={region} onChange={e => setRegion(e.target.value)}>
                  {REGIONS.map(reg => (
                    <option key={reg.value} value={reg.label}>{reg.label}</option>
                  ))}
                </select>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Your services in the same region communicate over a secure private network.
                </p>
              </div>

              {/* Postgres Engine Version */}
              <div className="form-group">
                <label className="form-label">PostgreSQL Version</label>
                <select className="form-control" value={version} onChange={e => setVersion(e.target.value)}>
                  {VERSIONS.map(ver => (
                    <option key={ver} value={ver}>{ver}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Plan Options Selector */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: 10 }}>Plan Options</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
                {PLAN_OPTIONS.map(plan => {
                  const isSelected = planOption === plan.value;
                  return (
                    <div 
                      key={plan.value}
                      onClick={() => setPlanOption(plan.value)}
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 8
                      }}
                      className="plan-card-item"
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: isSelected ? 'var(--color-primary-light)' : 'var(--color-text-primary)' }}>
                            {plan.value}
                          </span>
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', lineHeight: '1.4' }}>{plan.desc}</p>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)' }}>{plan.price}</div>
                        <div style={{ fontSize: 9, color: 'var(--color-text-secondary)', marginTop: 2 }}>{plan.specs}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Datadog APM Integrations */}
            <div style={{ 
              background: 'rgba(255,255,255,0.02)', 
              border: '1px solid var(--color-border)', 
              borderRadius: 'var(--radius-md)',
              padding: '16px'
            }}>
              <div 
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => setShowDatadog(!showDatadog)}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    📊 Datadog Telemetry Monitoring <span style={{ fontSize: 9, color: 'var(--color-text-secondary)', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 4 }}>Optional</span>
                  </span>
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>Export metrics and logs directly to Datadog cloud monitoring dashboard</p>
                </div>
                <span style={{ fontSize: 12, color: 'var(--color-primary-light)' }}>{showDatadog ? 'Hide Config' : 'Show Config'}</span>
              </div>

              {showDatadog && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Datadog API Key</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      placeholder="The API key to enable Datadog monitoring"
                      value={datadogApiKey}
                      onChange={e => setDatadogApiKey(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Datadog Region</label>
                    <select 
                      className="form-control" 
                      value={datadogRegion} 
                      onChange={e => setDatadogRegion(e.target.value)}
                    >
                      <option value="US1 (default)">US1 (default)</option>
                      <option value="US3">US3</option>
                      <option value="US5">US5</option>
                      <option value="EU1">EU1</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowAddForm(false); resetForm(); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Initializing Cluster...' : 'Provision Postgres instance'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* DASHBOARD BOARD */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {loading ? (
            <div className="loading-center"><div className="loading-spinner" /></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: selectedInstance ? '1fr 480px' : '1fr', gap: 24, transition: 'all 0.3s' }}>
              {/* INSTANCE OVERVIEW LIST */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {instances.length === 0 ? (
                  <div className="card empty-state" style={{ padding: 80 }}>
                    <Database size={48} />
                    <h3>No Postgres Instances Configured</h3>
                    <p>Get started by provisioning a PostgreSQL cluster in your private application network.</p>
                    <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowAddForm(true)}>
                      <Plus size={14} /> Create Instance
                    </button>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Instance Name</th>
                          <th>Status</th>
                          <th>Engine Version</th>
                          <th>Region</th>
                          <th>Plan Size</th>
                          <th>Created At</th>
                          <th style={{ width: 100 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {instances.map(inst => {
                          const isSelected = selectedInstance?.id === inst.id;
                          return (
                            <tr 
                              key={inst.id}
                              style={{ 
                                cursor: 'pointer',
                                background: isSelected ? 'rgba(59, 130, 246, 0.06)' : 'transparent',
                                borderLeft: isSelected ? '3px solid var(--color-primary)' : 'none'
                              }}
                              onClick={() => setSelectedInstance(inst)}
                            >
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <Database size={16} className={inst.status === 'ACTIVE' ? 'text-primary' : 'text-muted'} />
                                  <div>
                                    <strong style={{ fontSize: 13.5 }}>{inst.name}</strong>
                                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{inst.databaseName}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className={`badge ${getStatusBadgeClass(inst.status)}`}>
                                  {inst.status === 'PROVISIONING' && <RefreshCw size={10} className="spin" style={{ marginRight: 4 }} />}
                                  {inst.status}
                                </span>
                              </td>
                              <td>
                                <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                                  v{inst.version}
                                </code>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                                  <Globe size={12} className="text-muted" />
                                  {inst.region}
                                </div>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                                  <Layers size={12} className="text-muted" />
                                  {inst.planOption}
                                </div>
                              </td>
                              <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                {inst.createdAt ? inst.createdAt.replace('T', ' ').substring(0, 16) : 'Just now'}
                              </td>
                              <td onClick={e => e.stopPropagation()}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button 
                                    className="btn btn-ghost btn-icon btn-sm text-danger" 
                                    onClick={() => handleDelete(inst.id, inst.name)}
                                    disabled={inst.status === 'DELETING'}
                                  >
                                    <Trash2 size={13} />
                                  </button>
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

              {/* METRICS & LOGS DETAILS SIDE PANEL */}
              {selectedInstance && (
                <div className="card fade-in" style={{ height: 'fit-content', display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Database size={18} className="text-primary" />
                        {selectedInstance.name}
                      </h3>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>ID: {selectedInstance.id}</span>
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => setSelectedInstance(null)}>✕</button>
                  </div>

                  {selectedInstance.status === 'PROVISIONING' ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <RefreshCw size={36} className="spin text-warning" />
                      <h4 style={{ color: 'var(--color-warning)' }}>Provisioning DB Instance</h4>
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', maxWidth: 320 }}>
                        We are currently deploying the database node in the network and registering the container DNS endpoints. This will complete in a few seconds...
                      </p>
                    </div>
                  ) : selectedInstance.status === 'DELETING' ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <RefreshCw size={36} className="spin text-danger" />
                      <h4 style={{ color: 'var(--color-danger)' }}>Teardown In Progress</h4>
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', maxWidth: 320 }}>
                        The Postgres cluster is terminating connection sessions, detaching active block storage disks, and freeing network IPs...
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* CONNECTION DETAILS */}
                      <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: 14, border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Key size={12} /> Connection Parameters (Private LAN)
                        </div>
                        <div style={{ fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div><strong>Host:</strong> <code style={{ color: 'var(--color-primary-light)' }}>{selectedInstance.name === 'ttrims-postgres' ? 'dpg-d8in6lcvikkc73c1l780-a' : `${selectedInstance.name}.${regionSlug}.ttrims.internal`}</code></div>
                          <div><strong>Port:</strong> <code>5432</code></div>
                          <div><strong>Database:</strong> <code>{selectedInstance.databaseName}</code></div>
                          <div><strong>Username:</strong> <code>{selectedInstance.username}</code></div>
                          <div><strong>Password:</strong> <code style={{ color: 'var(--color-warning)' }}>{selectedInstance.password}</code></div>
                          
                          <div style={{ marginTop: 8, borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: 8 }}>
                            <div style={{ color: 'var(--color-text-muted)', fontSize: 10, marginBottom: 2 }}>JDBC Connection String:</div>
                            <code style={{ fontSize: 9.5, wordBreak: 'break-all', color: 'var(--color-success)' }}>
                              jdbc:postgresql://{selectedInstance.name === 'ttrims-postgres' ? 'dpg-d8in6lcvikkc73c1l780-a' : `${selectedInstance.name}.${regionSlug}.ttrims.internal`}:5432/{selectedInstance.databaseName}
                            </code>
                          </div>
                        </div>
                      </div>

                      {/* DATADOG BANNER */}
                      {selectedInstance.datadogApiKey && (
                        <div style={{ 
                          display: 'flex', alignItems: 'center', gap: 8, 
                          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', 
                          borderRadius: 8, padding: '10px 12px', fontSize: 11.5, color: 'var(--color-primary-light)' 
                        }}>
                          <span>📊</span>
                          <div>
                            <strong>Datadog Monitoring Active</strong>
                            <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Shipping metrics/logs to region: {selectedInstance.datadogRegion}</div>
                          </div>
                        </div>
                      )}

                      {/* SIMULATED PERFORMANCE METRICS CHARTS */}
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Activity size={12} /> Live Cluster telemetry
                        </div>
                        {metrics ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {/* CPU Card */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 10, border: '1px solid var(--color-border)', borderRadius: 6 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--color-text-muted)' }}>
                                <span>CPU Usage</span>
                                <Cpu size={12} />
                              </div>
                              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{metrics.cpu}%</div>
                              <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                                <div style={{ width: `${metrics.cpu}%`, height: '100%', background: metrics.cpu > 70 ? 'var(--color-danger)' : 'var(--color-primary)' }} />
                              </div>
                            </div>

                            {/* RAM Card */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 10, border: '1px solid var(--color-border)', borderRadius: 6 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--color-text-muted)' }}>
                                <span>Memory</span>
                                <HardDrive size={12} />
                              </div>
                              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{metrics.memory} MB</div>
                              <span style={{ fontSize: 9.5, color: 'var(--color-text-muted)' }}>Active pool buffers</span>
                            </div>

                            {/* Active Connections */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 10, border: '1px solid var(--color-border)', borderRadius: 6 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--color-text-muted)' }}>
                                <span>Connections</span>
                                <Activity size={12} />
                              </div>
                              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{metrics.connections} sessions</div>
                              <span style={{ fontSize: 9.5, color: 'var(--color-text-muted)' }}>Max connections: 100</span>
                            </div>

                            {/* Storage usage */}
                            <div style={{ background: 'rgba(255,255,255,0.02)', padding: 10, border: '1px solid var(--color-border)', borderRadius: 6 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--color-text-muted)' }}>
                                <span>Disk Space</span>
                                <Database size={12} />
                              </div>
                              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>{metrics.storage} MB</div>
                              <span style={{ fontSize: 9.5, color: 'var(--color-text-muted)' }}>NVMe SSD Block storage</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', padding: 20, fontSize: 12, color: 'var(--color-text-muted)' }}>Loading live metrics...</div>
                        )}
                      </div>

                      {/* SIMULATED LOG TERMINAL CONTAINER */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Terminal size={12} /> Live Instance Logs
                          </span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                            <input 
                              type="checkbox" 
                              checked={autoScrollLogs} 
                              onChange={e => setAutoScrollLogs(e.target.checked)} 
                            />
                            Auto-scroll
                          </label>
                        </div>

                        <div style={{
                          height: 180,
                          background: '#070b13',
                          border: '1px solid var(--color-border)',
                          borderRadius: 6,
                          padding: '10px',
                          overflowY: 'auto',
                          fontFamily: 'Courier New, Courier, monospace',
                          fontSize: 10.5,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4
                        }}>
                          {logs.map((log, idx) => {
                            const isErr = log.level === 'ERROR' || log.level === 'FATAL';
                            const isWarn = log.level === 'WARNING';
                            const color = isErr ? 'var(--color-danger)' : isWarn ? 'var(--color-warning)' : 'var(--color-text-secondary)';
                            return (
                              <div key={idx} style={{ color, lineBreak: 'anywhere' }}>
                                <span style={{ color: 'var(--color-text-muted)' }}>[{log.timestamp}]</span>{' '}
                                <strong style={{ color: isErr || isWarn ? undefined : 'var(--color-primary-light)' }}>{log.level}</strong>: {log.message}
                              </div>
                            );
                          })}
                          <div ref={logTerminalEndRef} />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      <style>{`
        .spin { animation: spin-anim 1s linear infinite; }
        @keyframes spin-anim {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .plan-card-item:hover {
          border-color: rgba(99, 102, 241, 0.4) !important;
          background: rgba(255,255,255,0.04) !important;
        }
      `}</style>
    </div>
  );
}
