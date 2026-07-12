import { useState, useEffect } from 'react';
import { shipmentsAPI, usersAPI, pickupAPI, dispatchAPI } from '../api';
import toast from 'react-hot-toast';
import { 
  Users, MapPin, Truck, Plus, Trash2, Edit, Check, X, 
  Calendar, Phone, UserCheck, RefreshCw, ClipboardList, Map, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function DriverDispatchManagementPage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('drivers'); // drivers, locations, tasks

  // Data states
  const [drivers, setDrivers] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [locations, setLocations] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [editingLocId, setEditingLocId] = useState(null);
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [locLat, setLocLat] = useState('');
  const [locLng, setLocLng] = useState('');
  const [locContactName, setLocContactName] = useState('');
  const [locContactPhone, setLocContactPhone] = useState('');

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskLocationId, setTaskLocationId] = useState('');
  const [taskDriverId, setTaskDriverId] = useState('');
  const [taskScheduledAt, setTaskScheduledAt] = useState('');
  const [taskRemarks, setTaskRemarks] = useState('');

  const [processing, setProcessing] = useState(false);

  // Load dashboard/logistics data
  const loadData = async () => {
    setLoading(true);
    try {
      const [usersRes, shipmentsRes, ordersRes, locsRes, tasksRes] = await Promise.all([
        usersAPI.list(),
        shipmentsAPI.list(),
        dispatchAPI.list(),
        pickupAPI.listLocations(),
        pickupAPI.listTasks()
      ]);

      // Filter drivers
      const allUsers = usersRes.data.data || [];
      const driverUsers = allUsers.filter(u => u.role === 'Driver' || u.role_name === 'Driver');
      setDrivers(driverUsers);

      setShipments(shipmentsRes.data.data || []);
      setOrders(ordersRes.data.data || []);
      setLocations(locsRes.data.data || []);
      setTasks(tasksRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load driver dispatch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ─── Location Handlers ───────────────────────────────────────────────────
  const resetLocationForm = () => {
    setEditingLocId(null);
    setLocName('');
    setLocAddress('');
    setLocLat('');
    setLocLng('');
    setLocContactName('');
    setLocContactPhone('');
  };

  const handleEditLocation = (loc) => {
    setEditingLocId(loc.id);
    setLocName(loc.name);
    setLocAddress(loc.address || '');
    setLocLat(loc.latitude || '');
    setLocLng(loc.longitude || '');
    setLocContactName(loc.contactPerson || '');
    setLocContactPhone(loc.contactPhone || '');
    setShowLocationModal(true);
  };

  const handleLocationSubmit = async (e) => {
    e.preventDefault();
    if (!locName.trim()) {
      return toast.error('Location name is required');
    }
    setProcessing(true);
    try {
      const payload = {
        name: locName,
        address: locAddress,
        latitude: locLat ? parseFloat(locLat) : null,
        longitude: locLng ? parseFloat(locLng) : null,
        contact_person: locContactName,
        contact_phone: locContactPhone
      };

      if (editingLocId) {
        await pickupAPI.updateLocation(editingLocId, payload);
        toast.success('Pickup location updated successfully');
      } else {
        await pickupAPI.createLocation(payload);
        toast.success('Pickup location created successfully');
      }
      setShowLocationModal(false);
      resetLocationForm();
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save location');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteLocation = async (id) => {
    if (!window.confirm('Are you sure you want to delete this pickup location?')) return;
    setProcessing(true);
    try {
      await pickupAPI.deleteLocation(id);
      toast.success('Location deleted successfully');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete location');
    } finally {
      setProcessing(false);
    }
  };

  // ─── Task Handlers ───────────────────────────────────────────────────────
  const resetTaskForm = () => {
    setTaskLocationId('');
    setTaskDriverId('');
    setTaskScheduledAt('');
    setTaskRemarks('');
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!taskLocationId || !taskDriverId) {
      return toast.error('Location and Driver are required');
    }
    setProcessing(true);
    try {
      const payload = {
        pickup_location_id: taskLocationId,
        driver_id: taskDriverId,
        scheduled_at: taskScheduledAt || new Date().toISOString(),
        remarks: taskRemarks
      };

      await pickupAPI.createTask(payload);
      toast.success('Driver assigned to pickup task successfully!');
      setShowTaskModal(false);
      resetTaskForm();
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign driver');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    const remarks = window.prompt(`Enter remarks for marking task as ${newStatus} (optional):`);
    if (remarks === null) return; // cancelled
    setProcessing(true);
    try {
      await pickupAPI.updateTaskStatus(taskId, newStatus, remarks);
      toast.success(`Task status updated to ${newStatus}`);
      loadData();
    } catch (err) {
      toast.error('Failed to update task status');
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Cancel/Delete this pickup task assignment?')) return;
    setProcessing(true);
    try {
      await pickupAPI.deleteTask(taskId);
      toast.success('Pickup task cancelled successfully');
      loadData();
    } catch (err) {
      toast.error('Failed to cancel task');
    } finally {
      setProcessing(false);
    }
  };

  // Helper: Find driver's active shipment
  const getDriverShipments = (driverId) => {
    return shipments.filter(s => s.driver?.id === driverId);
  };

  // Helper: Find driver's pickup tasks
  const getDriverPickupTasks = (driverId) => {
    return tasks.filter(t => t.driver_id === driverId);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AVAILABLE': return <span className="badge badge-green">Available</span>;
      case 'BUSY': return <span className="badge badge-orange">Busy / En Route</span>;
      case 'OFFLINE': return <span className="badge badge-gray">Offline</span>;
      default: return <span className="badge badge-gray">{status}</span>;
    }
  };

  const getTaskStatusBadge = (status) => {
    switch (status) {
      case 'PENDING': return <span className="badge badge-orange">Pending</span>;
      case 'EN_ROUTE': return <span className="badge badge-blue">En Route</span>;
      case 'COMPLETED': return <span className="badge badge-green">Completed</span>;
      case 'FAILED': return <span className="badge badge-red">Failed</span>;
      default: return <span className="badge badge-gray">{status}</span>;
    }
  };

  return (
    <div className="fade-in" style={{ padding: 24 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div className="page-header-left">
          <h2>Driver Dispatch Control Console</h2>
          <p>Assign drivers, track order shipments, manage supplier pick-up options, and assign drivers there.</p>
        </div>
        <div className="page-header-right" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
            Refresh Console
          </button>
        </div>
      </div>

      {/* KPI Section */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="kpi-card blue">
          <div className="kpi-card-header">
            <span className="kpi-label">Registered Fleet Drivers</span>
            <Users size={20} color="var(--color-primary)" />
          </div>
          <div className="kpi-value">{drivers.length}</div>
        </div>
        <div className="kpi-card green">
          <div className="kpi-card-header">
            <span className="kpi-label">Available Drivers</span>
            <UserCheck size={20} color="var(--color-success)" />
          </div>
          <div className="kpi-value">{drivers.filter(d => d.driver_status === 'AVAILABLE' || !d.driver_status).length}</div>
        </div>
        <div className="kpi-card orange">
          <div className="kpi-card-header">
            <span className="kpi-label">Pending Pickup Assignments</span>
            <MapPin size={20} color="var(--color-warning)" />
          </div>
          <div className="kpi-value">{tasks.filter(t => t.status === 'PENDING' || t.status === 'EN_ROUTE').length}</div>
        </div>
        <div className="kpi-card cyan">
          <div className="kpi-card-header">
            <span className="kpi-label">Pickup Locations Configured</span>
            <ClipboardList size={20} color="#06b6d4" />
          </div>
          <div className="kpi-value">{locations.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: 20 }}>
        <button
          className={`btn btn-sm ${activeTab === 'drivers' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('drivers')}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        >
          Drivers & Orders Allocation ({drivers.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'locations' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('locations')}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginLeft: 8 }}
        >
          Pick Up Locations ({locations.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'tasks' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('tasks')}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginLeft: 8 }}
        >
          Driver Pick Up Tasks ({tasks.length})
        </button>
      </div>

      {loading ? (
        <div className="loading-center"><div className="loading-spinner"></div></div>
      ) : (
        <>
          {/* TAB 1: DRIVERS LIST & ALLOCATIONS */}
          {activeTab === 'drivers' && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Fleet Status & Assigned Orders/Shipments</div>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Driver Info</th>
                      <th>Status</th>
                      <th>Delivery Shipments & Stop Orders</th>
                      <th>Pickup Tasks</th>
                      <th>Vehicle & zone</th>
                      <th>GPS Coordinates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center">No drivers registered yet.</td>
                      </tr>
                    ) : (
                      drivers.map(driver => {
                        const dShipments = getDriverShipments(driver.id);
                        const dPickups = getDriverPickupTasks(driver.id);

                        return (
                          <tr key={driver.id}>
                            <td>
                              <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{driver.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Phone size={11} /> {driver.email}
                              </div>
                            </td>
                            <td>{getStatusBadge(driver.driver_status || 'AVAILABLE')}</td>
                            <td>
                              {dShipments.length === 0 ? (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>— No deliveries —</span>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {dShipments.map(s => (
                                    <div key={s.id} style={{ background: 'rgba(59,130,246,0.06)', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.15)' }}>
                                      <div style={{ fontWeight: 600, fontSize: 12.5, color: '#3b82f6' }}>{s.shipmentNumber} ({s.status})</div>
                                      <div style={{ fontSize: 11, display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                                        {s.orders?.map(o => (
                                          <span key={o.id} className="badge badge-gray" style={{ fontSize: 10 }}>
                                            📦 Order: {o.order_number} ({o.customer})
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>
                              {dPickups.length === 0 ? (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>— No pickups —</span>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {dPickups.map(t => (
                                    <div key={t.id} style={{ background: 'rgba(16,185,129,0.06)', padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(16,185,129,0.15)' }}>
                                      <div style={{ fontWeight: 600, fontSize: 12.5, color: '#10b981' }}>{t.pickup_location?.name}</div>
                                      <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                                        <span>Status: {getTaskStatusBadge(t.status)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: 13 }}>{driver.vehicleNumber || '—'}</div>
                              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Zone: {driver.deliveryZone || 'Global'}</div>
                            </td>
                            <td>
                              {driver.currentLatitude && driver.currentLongitude ? (
                                <div style={{ fontSize: 12, fontFamily: 'monospace' }}>
                                  {driver.currentLatitude.toFixed(5)}, {driver.currentLongitude.toFixed(5)}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>No GPS data</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: PICK UP LOCATIONS */}
          {activeTab === 'locations' && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="card-title">Configured Pickup Locations / Options</div>
                {hasPermission('DISPATCH:MANAGE') && (
                  <button className="btn btn-primary btn-sm" onClick={() => { resetLocationForm(); setShowLocationModal(true); }}>
                    <Plus size={14} style={{ marginRight: 6 }} /> Add Pickup Location
                  </button>
                )}
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Location Name</th>
                      <th>Address</th>
                      <th>GPS Coordinates</th>
                      <th>Contact Person</th>
                      <th>Contact Phone</th>
                      {hasPermission('DISPATCH:MANAGE') && <th style={{ width: 100 }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {locations.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center">No pickup locations set up. Add a new pickup location option to assign drivers.</td>
                      </tr>
                    ) : (
                      locations.map(loc => (
                        <tr key={loc.id}>
                          <td style={{ fontWeight: 700 }}>{loc.name}</td>
                          <td>{loc.address || '—'}</td>
                          <td>
                            {loc.latitude && loc.longitude ? (
                              <span style={{ fontFamily: 'monospace' }}>{loc.latitude}, {loc.longitude}</span>
                            ) : '—'}
                          </td>
                          <td style={{ fontWeight: 600 }}>{loc.contactPerson || '—'}</td>
                          <td>{loc.contactPhone || '—'}</td>
                          {hasPermission('DISPATCH:MANAGE') && (
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleEditLocation(loc)}>
                                  <Edit size={14} />
                                </button>
                                <button className="btn btn-ghost btn-icon btn-sm text-red" onClick={() => handleDeleteLocation(loc.id)}>
                                  <Trash2 size={14} style={{ color: '#ef4444' }} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PICK UP TASKS */}
          {activeTab === 'tasks' && (
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="card-title">Assigned Driver Pickups & Schedules</div>
                {hasPermission('DISPATCH:MANAGE') && (
                  <button className="btn btn-primary btn-sm" onClick={() => { resetTaskForm(); setShowTaskModal(true); }} disabled={locations.length === 0}>
                    <Plus size={14} style={{ marginRight: 6 }} /> Create Pickup Assignment
                  </button>
                )}
              </div>

              {locations.length === 0 && (
                <div style={{ margin: 16, padding: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: '#ef4444', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShieldAlert size={16} /> Please configure at least one Pickup Location option first before creating assignments.
                </div>
              )}

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Pickup Location</th>
                      <th>Assigned Driver</th>
                      <th>Scheduled Time</th>
                      <th>Status</th>
                      <th>Remarks / Details</th>
                      <th>Created By</th>
                      <th style={{ width: 150 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center">No pickup tasks assigned yet.</td>
                      </tr>
                    ) : (
                      tasks.map(task => (
                        <tr key={task.id}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{task.pickup_location?.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{task.pickup_location?.address}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{task.driver_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Vehicle: {task.vehicle_number || '—'}</div>
                          </td>
                          <td>{task.scheduled_at ? new Date(task.scheduled_at).toLocaleString() : '—'}</td>
                          <td>{getTaskStatusBadge(task.status)}</td>
                          <td>{task.remarks || '—'}</td>
                          <td>{task.created_by}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {task.status === 'PENDING' && (
                                <button className="btn btn-sm btn-secondary" onClick={() => handleUpdateTaskStatus(task.id, 'EN_ROUTE')}>
                                  Start Trip
                                </button>
                              )}
                              {task.status === 'EN_ROUTE' && (
                                <>
                                  <button className="btn btn-sm btn-primary" onClick={() => handleUpdateTaskStatus(task.id, 'COMPLETED')}>
                                    Complete
                                  </button>
                                  <button className="btn btn-sm btn-secondary text-red" onClick={() => handleUpdateTaskStatus(task.id, 'FAILED')} style={{ color: '#ef4444' }}>
                                    Fail
                                  </button>
                                </>
                              )}
                              {hasPermission('DISPATCH:MANAGE') && (
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDeleteTask(task.id)} title="Cancel assignment">
                                  <Trash2 size={14} style={{ color: '#ef4444' }} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: ADD/EDIT PICKUP LOCATION */}
      {showLocationModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>{editingLocId ? 'Edit Pickup Location' : 'New Pickup Location Option'}</h3>
              <button className="btn-close" onClick={() => setShowLocationModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleLocationSubmit}>
              <div className="form-group">
                <label>Location Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  placeholder="e.g. North Supplier Depot"
                  required
                />
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea
                  className="form-control"
                  value={locAddress}
                  onChange={(e) => setLocAddress(e.target.value)}
                  placeholder="Street details..."
                  rows={2}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="form-control"
                    value={locLat}
                    onChange={(e) => setLocLat(e.target.value)}
                    placeholder="e.g. 6.9271"
                  />
                </div>
                <div className="form-group">
                  <label>Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="form-control"
                    value={locLng}
                    onChange={(e) => setLocLng(e.target.value)}
                    placeholder="e.g. 79.8612"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Contact Person Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={locContactName}
                  onChange={(e) => setLocContactName(e.target.value)}
                  placeholder="e.g. Mr. John Doe"
                />
              </div>
              <div className="form-group">
                <label>Contact Phone Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={locContactPhone}
                  onChange={(e) => setLocContactPhone(e.target.value)}
                  placeholder="e.g. +94 77 123 4567"
                />
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowLocationModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={processing}>
                  {editingLocId ? 'Update Location' : 'Create Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PICKUP TASK (ASSIGN DRIVER) */}
      {showTaskModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>Create Driver Pickup Assignment</h3>
              <button className="btn-close" onClick={() => setShowTaskModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleTaskSubmit}>
              <div className="form-group">
                <label>Select Pick Up Location *</label>
                <select
                  className="form-control"
                  value={taskLocationId}
                  onChange={(e) => setTaskLocationId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Option --</option>
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.address || 'No Address'})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Select Driver *</label>
                <select
                  className="form-control"
                  value={taskDriverId}
                  onChange={(e) => setTaskDriverId(e.target.value)}
                  required
                >
                  <option value="">-- Select Available Driver --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.driver_status || 'AVAILABLE'}) - {d.vehicleNumber || 'No Vehicle'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Scheduled Date & Time</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={taskScheduledAt}
                  onChange={(e) => setTaskScheduledAt(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Remarks / Instructions</label>
                <textarea
                  className="form-control"
                  value={taskRemarks}
                  onChange={(e) => setTaskRemarks(e.target.value)}
                  placeholder="e.g. Pick up 20 bags of raw material A..."
                  rows={3}
                />
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={processing}>
                  Assign Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
