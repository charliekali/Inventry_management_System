import { useState, useEffect } from 'react';
import { transactionsAPI, productsAPI, warehousesAPI } from '../api';
import toast from 'react-hot-toast';
import { ClipboardList, Search, Eye, Filter, ArrowLeft, ArrowRight, Download } from 'lucide-react';
import useBulkActions from '../hooks/useBulkActions';
import BulkActionBar from '../components/BulkActionBar';

export default function TransactionPage() {
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  const [selectedTx, setSelectedTx] = useState(null);

  const loadData = () => {
    setLoading(true);
    const params = {
      page,
      limit,
      type: type || null,
      product_id: productId || null,
      warehouse_id: warehouseId || null,
      date_from: dateFrom || null,
      date_to: dateTo || null,
      search: search.trim() || null
    };

    transactionsAPI.list(params)
      .then(r => {
        setTransactions(r.data.data);
        setTotalPages(r.data.pagination.pages);
        setTotalElements(r.data.pagination.total);
      })
      .catch(() => toast.error('Failed to load transaction ledger'))
      .finally(() => setLoading(false));
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
  }, [page, type, productId, warehouseId, dateFrom, dateTo]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadData();
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
  } = useBulkActions(transactions);

  const handleBulkExport = () => {
    const selected = getSelectedItems();
    let csvContent = 'GR / Issue Slip,Date,Type,Product Code,Product Name,Product Type,Warehouse,Section,Quantity,Unit,Performed By,Reference Doc,Remarks\n';
    
    selected.forEach(tx => {
      const row = [
        tx.gr_number,
        tx.transaction_date,
        tx.type,
        tx.product_code,
        tx.product_name,
        tx.product_type,
        tx.warehouse_name,
        tx.section_name || '',
        tx.quantity,
        tx.unit,
        tx.performed_by_name,
        tx.reference_doc || '',
        tx.remarks || ''
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
      csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedCount} transactions to CSV`);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Transaction History</h2>
          <p>Digital stock ledger showing all inward (GR) and outward (Issue) stock movements</p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <form onSubmit={handleSearchSubmit} className="filters-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ minWidth: 200, flex: 1 }}>
            <label className="form-label" style={{ fontSize: 10 }}>Search Ledger</label>
            <div className="search-bar" style={{ width: '100%' }}>
              <Search size={14} />
              <input 
                type="text" 
                placeholder="GR Number, Ref Doc, Remarks..." 
                className="form-control"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ minWidth: 120 }}>
            <label className="form-label" style={{ fontSize: 10 }}>Type</label>
            <select className="form-control" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
              <option value="">All Types</option>
              <option value="IN">Stock IN (GR)</option>
              <option value="OUT">Stock OUT</option>
            </select>
          </div>

          <div className="form-group" style={{ minWidth: 160 }}>
            <label className="form-label" style={{ fontSize: 10 }}>Product</label>
            <select className="form-control" value={productId} onChange={(e) => { setProductId(e.target.value); setPage(1); }}>
              <option value="">All Products</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>[{p.code}] {p.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ minWidth: 160 }}>
            <label className="form-label" style={{ fontSize: 10 }}>Warehouse</label>
            <select className="form-control" value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setPage(1); }}>
              <option value="">All Warehouses</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ minWidth: 120 }}>
            <label className="form-label" style={{ fontSize: 10 }}>Date From</label>
            <input type="date" className="form-control" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          </div>

          <div className="form-group" style={{ minWidth: 120 }}>
            <label className="form-label" style={{ fontSize: 10 }}>Date To</label>
            <input type="date" className="form-control" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          </div>

          <button type="submit" className="btn btn-secondary" style={{ padding: '10px 18px' }}>
            <Filter size={15} />
            Filter
          </button>
        </form>
      </div>

      {/* Ledger Table */}
      <div className="card">
        {loading ? (
          <div className="loading-center"><div className="loading-spinner"></div></div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <ClipboardList size={48} />
            <h3>No Transactions Found</h3>
            <p>Try clearing filters or search terms.</p>
          </div>
        ) : (
          <>
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
                    <th>GR / Issue Slip</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Product</th>
                    <th>Location</th>
                    <th>Quantity</th>
                    <th>Performed By</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => {
                    const isChecked = isSelected(tx.id);
                    return (
                      <tr key={tx.id} style={{ background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => toggleSelect(tx.id)} 
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td>
                          <span className="gr-number">{tx.gr_number}</span>
                        </td>
                        <td>{tx.transaction_date}</td>
                        <td>
                          <span className={tx.type === 'IN' ? 'stock-in-pill' : 'stock-out-pill'}>
                            {tx.type === 'IN' ? '↓ IN' : '↑ OUT'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{tx.product_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{tx.product_code} · {tx.product_type}</div>
                        </td>
                        <td>
                          <div>{tx.warehouse_name}</div>
                          {tx.section_name && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Section: {tx.section_name}</div>}
                        </td>
                        <td style={{ fontWeight: 700, color: tx.type === 'IN' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {tx.type === 'IN' ? '+' : '-'}{tx.quantity} {tx.unit}
                        </td>
                        <td>{tx.performed_by_name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            className="btn btn-ghost btn-icon" 
                            onClick={() => setSelectedTx(tx)}
                            title="View Details"
                          >
                            <Eye size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                Showing <strong>{transactions.length}</strong> of <strong>{totalElements}</strong> entries
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  className="btn btn-secondary btn-sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ArrowLeft size={14} />
                  Prev
                </button>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 13, fontWeight: 600 }}>
                  Page {page} of {totalPages}
                </div>
                <button 
                  className="btn btn-secondary btn-sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Details Modal */}
      {selectedTx && (
        <div className="modal-overlay" onClick={() => setSelectedTx(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 className="modal-title">Transaction Receipt Details</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedTx(null)}>×</button>
            </div>
            
            <div className="modal-body" style={{ fontSize: 14 }}>
              <div className="responsive-grid-equal-2">
                <div>
                  <span className="form-label" style={{ fontSize: 11 }}>GR / Issue Slip #</span>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary-light)', marginTop: 4 }}>
                    {selectedTx.gr_number}
                  </div>
                </div>
                <div>
                  <span className="form-label" style={{ fontSize: 11 }}>Date Recorded</span>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{selectedTx.transaction_date}</div>
                </div>
              </div>
              
              <div className="divider" style={{ margin: '12px 0' }}></div>

              <div className="responsive-grid-equal-2">
                <div>
                  <span className="form-label" style={{ fontSize: 11 }}>Product Info</span>
                  <div style={{ fontWeight: 600, marginTop: 4 }}>{selectedTx.product_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Code: {selectedTx.product_code}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Type: {selectedTx.product_type}</div>
                </div>
                <div>
                  <span className="form-label" style={{ fontSize: 11 }}>Storage Location</span>
                  <div style={{ fontWeight: 600, marginTop: 4 }}>{selectedTx.warehouse_name}</div>
                  {selectedTx.section_name && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Section: {selectedTx.section_name}</div>}
                </div>
              </div>

              <div className="divider" style={{ margin: '12px 0' }}></div>

              <div className="responsive-grid-equal-2">
                <div>
                  <span className="form-label" style={{ fontSize: 11 }}>Quantity Moved</span>
                  <div style={{ 
                    fontSize: 18, fontWeight: 800, 
                    color: selectedTx.type === 'IN' ? 'var(--color-success)' : 'var(--color-danger)',
                    marginTop: 4 
                  }}>
                    {selectedTx.type === 'IN' ? '↓ +' : '↑ -'}{selectedTx.quantity} {selectedTx.unit}
                  </div>
                </div>
                <div>
                  <span className="form-label" style={{ fontSize: 11 }}>Performed By</span>
                  <div style={{ fontWeight: 600, marginTop: 4 }}>{selectedTx.performed_by_name}</div>
                </div>
              </div>

              <div className="divider" style={{ margin: '12px 0' }}></div>

              <div>
                <span className="form-label" style={{ fontSize: 11 }}>Reference Document</span>
                <div style={{ 
                  fontFamily: 'monospace', fontSize: 13, background: 'rgba(255,255,255,0.05)',
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginTop: 4
                }}>
                  {selectedTx.reference_doc || 'N/A'}
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <span className="form-label" style={{ fontSize: 11 }}>Remarks</span>
                <div style={{ 
                  fontSize: 13.5, background: 'rgba(255,255,255,0.03)', color: 'var(--color-text-secondary)',
                  padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginTop: 4, minHeight: 60
                }}>
                  {selectedTx.remarks || 'No remarks recorded.'}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedTx(null)}>Close</button>
            </div>
          </div>
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
          }
        ]}
      />
    </div>
  );
}
