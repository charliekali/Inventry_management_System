import { useState, useEffect } from 'react';
import { stockAPI, productsAPI, warehousesAPI } from '../api';
import toast from 'react-hot-toast';
import { BarChart3, Search, AlertTriangle, RefreshCw, Layers, Download } from 'lucide-react';
import useBulkActions from '../hooks/useBulkActions';
import BulkActionBar from '../components/BulkActionBar';

export default function StockBalancePage() {
  const [balances, setBalances] = useState([]);
  const [summary, setSummary] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [viewType, setViewType] = useState('summary'); // 'summary' or 'detailed'
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [type, setType] = useState('');

  const loadData = () => {
    setLoading(true);
    const params = {
      product_id: productId || null,
      warehouse_id: warehouseId || null,
      type: type || null
    };

    if (viewType === 'summary') {
      stockAPI.summary(params)
        .then(r => setSummary(r.data.data))
        .catch(() => toast.error('Failed to load stock summary'))
        .finally(() => setLoading(false));
    } else {
      stockAPI.balance(params)
        .then(r => setBalances(r.data.data))
        .catch(() => toast.error('Failed to load detailed stock balances'))
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    productsAPI.list()
      .then(r => setProducts(r.data.data))
      .catch(() => {});

    warehousesAPI.list()
      .then(r => setWarehouses(r.data.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [viewType, productId, warehouseId, type]);

  // Filter local rows for quick search
  const filteredSummary = summary.filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.code.toLowerCase().includes(search.toLowerCase())
  );

  const filteredBalances = balances.filter(item => 
    item.product_name.toLowerCase().includes(search.toLowerCase()) ||
    item.product_code.toLowerCase().includes(search.toLowerCase()) ||
    item.warehouse_name.toLowerCase().includes(search.toLowerCase()) ||
    (item.section_name && item.section_name.toLowerCase().includes(search.toLowerCase()))
  );

  // Initialize two separate bulk action hooks
  const summaryBulk = useBulkActions(filteredSummary);
  const detailedBulk = useBulkActions(filteredBalances);

  const activeBulk = viewType === 'summary' ? summaryBulk : detailedBulk;

  const handleBulkExport = () => {
    const selected = activeBulk.getSelectedItems();
    let csvContent = '';
    let filename = '';
    
    if (viewType === 'summary') {
      csvContent = 'Product Code,Product Name,Type,Min Level,Current Total,UOM,Status\n';
      selected.forEach(item => {
        const status = item.min_stock > 0 && item.is_low_stock ? 'Low Stock' : 'Healthy';
        const row = [
          item.code,
          item.name,
          item.type,
          item.min_stock,
          item.total_quantity,
          item.unit,
          status
        ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
        csvContent += row + '\n';
      });
      filename = `stock_summary_export_${Date.now()}.csv`;
    } else {
      csvContent = 'Product Code,Product Name,Product Type,Warehouse,Section,In-Stock Quantity,UOM,Alert Status,Last Updated\n';
      selected.forEach(item => {
        const status = item.is_low_stock && item.min_stock > 0 ? 'Low Stock' : 'OK';
        const row = [
          item.product_code,
          item.product_name,
          item.product_type,
          item.warehouse_name,
          item.section_name || 'Unspecified',
          item.quantity,
          item.product_unit,
          status,
          item.updated_at ? item.updated_at.split('T')[0] : 'N/A'
        ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
        csvContent += row + '\n';
      });
      filename = `stock_location_map_export_${Date.now()}.csv`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${activeBulk.selectedCount} items to CSV`);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Stock Balance</h2>
          <p>Real-time view of current inventory levels and storage coordinates</p>
        </div>
        <div className="page-header-right">
          <div style={{ display: 'flex', background: 'var(--color-bg-card)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <button 
              className={`btn btn-sm ${viewType === 'summary' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => { setViewType('summary'); }}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              Summary By Product
            </button>
            <button 
              className={`btn btn-sm ${viewType === 'detailed' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => { setViewType('detailed'); }}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              Detailed Location Map
            </button>
          </div>
        </div>
      </div>

      {/* Filter Row */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="filters-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ minWidth: 200, flex: 1 }}>
            <label className="form-label" style={{ fontSize: 10 }}>Search Inventory</label>
            <div className="search-bar" style={{ width: '100%' }}>
              <Search size={14} />
              <input 
                type="text" 
                placeholder={viewType === 'summary' ? "Search code, name..." : "Search code, name, warehouse, section..."}
                className="form-control"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ minWidth: 120 }}>
            <label className="form-label" style={{ fontSize: 10 }}>Type</label>
            <select className="form-control" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All Types</option>
              <option value="FINISHED_GOOD">Finished Goods</option>
              <option value="RAW_MATERIAL">Raw Materials</option>
            </select>
          </div>

          {viewType === 'detailed' && (
            <div className="form-group" style={{ minWidth: 160 }}>
              <label className="form-label" style={{ fontSize: 10 }}>Product</label>
              <select className="form-control" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">All Products</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group" style={{ minWidth: 160 }}>
            <label className="form-label" style={{ fontSize: 10 }}>Warehouse</label>
            <select className="form-control" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <button className="btn btn-secondary" onClick={loadData} style={{ padding: '10px 18px' }}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Content Table */}
      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="loading-spinner"></div></div>
        ) : viewType === 'summary' ? (
          /* Summary Table */
          filteredSummary.length === 0 ? (
            <div className="empty-state">
              <BarChart3 size={48} />
              <h3>No Stock Items Found</h3>
              <p>Check search keyword or filter settings.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={summaryBulk.isAllSelected} 
                        onChange={summaryBulk.toggleSelectAll} 
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th>Product Code</th>
                    <th>Product Name</th>
                    <th>Type</th>
                    <th>Min Level</th>
                    <th>Current Total</th>
                    <th>UOM</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummary.map(item => {
                    const isChecked = summaryBulk.isSelected(item.id);
                    return (
                      <tr key={item.id} style={{ background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => summaryBulk.toggleSelect(item.id)} 
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ fontWeight: 700 }}>{item.code}</td>
                        <td style={{ fontWeight: 600 }}>{item.name}</td>
                        <td>
                          <span className={`badge ${item.type === 'FINISHED_GOOD' ? 'badge-blue' : 'badge-purple'}`}>
                            {item.type}
                          </span>
                        </td>
                        <td>{item.min_stock}</td>
                        <td style={{ fontSize: 15, fontWeight: 700, color: item.is_low_stock && item.min_stock > 0 ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                          {item.total_quantity}
                        </td>
                        <td>{item.unit}</td>
                        <td>
                          {item.min_stock > 0 && item.is_low_stock ? (
                            <span className="badge badge-red" style={{ display: 'inline-flex', gap: 4 }}>
                              <AlertTriangle size={12} />
                              Low Stock
                            </span>
                          ) : (
                            <span className="badge badge-green">Healthy</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* Detailed Location Map Table */
          filteredBalances.length === 0 ? (
            <div className="empty-state">
              <Layers size={48} />
              <h3>No Locations Mapped</h3>
              <p>Record a Stock IN to occupy slots.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40, textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={detailedBulk.isAllSelected} 
                        onChange={detailedBulk.toggleSelectAll} 
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th>Product</th>
                    <th>Warehouse</th>
                    <th>Section</th>
                    <th>In-Stock Quantity</th>
                    <th>Alert Status</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBalances.map(item => {
                    const isChecked = detailedBulk.isSelected(item.id);
                    return (
                      <tr key={item.id} style={{ background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => detailedBulk.toggleSelect(item.id)} 
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{item.product_code} · {item.product_type}</div>
                        </td>
                        <td style={{ fontWeight: 500 }}>{item.warehouse_name}</td>
                        <td>{item.section_name ? <span className="badge badge-gray">{item.section_name}</span> : <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>Unspecified</span>}</td>
                        <td style={{ fontSize: 15, fontWeight: 700, color: item.is_low_stock && item.min_stock > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                          {item.quantity} {item.product_unit}
                        </td>
                        <td>
                          {item.is_low_stock && item.min_stock > 0 ? (
                            <span className="badge badge-red" style={{ display: 'inline-flex', gap: 4 }}>
                              <AlertTriangle size={12} />
                              Low Stock
                            </span>
                          ) : (
                            <span className="badge badge-green">OK</span>
                          )}
                        </td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                          {item.updated_at ? item.updated_at.split('T')[0] : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      <BulkActionBar 
        selectedCount={activeBulk.selectedCount}
        onClear={activeBulk.clearSelection}
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
