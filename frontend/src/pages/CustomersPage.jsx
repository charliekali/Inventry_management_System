import { useState, useEffect, useCallback, Fragment } from 'react';
import { ordersAPI } from '../api';
import toast from 'react-hot-toast';
import { 
  Users, Search, RefreshCw, ChevronDown, ChevronUp, Download, Printer 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import useBulkActions from '../hooks/useBulkActions';
import BulkActionBar from '../components/BulkActionBar';

function fmtCurrency(val) {
  return '₹' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDateShort(iso) {
  if (!iso) return '—';
  return iso.replace('T', ' ').substring(0, 16);
}

export default function CustomersPage() {
  const [customers, setCustomers]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [expandedName, setExpandedName] = useState(null);

  const loadData = useCallback(() => {
    setLoading(true);
    ordersAPI.list()
      .then(res => {
        const list = res.data.data || [];
        
        // Find customers that have at least one invoice generated (excluding temporary orders)
        const invoicedItems = list.filter(o => o.invoice_number && !o.invoice_number.startsWith('ORD-'));
        const customerNames = Array.from(new Set(invoicedItems.map(o => o.customer)));

        const aggregated = customerNames.map(name => {
          const customerOrders = invoicedItems.filter(o => o.customer === name);
          
          let phone = '';
          let email = '';
          for (const co of customerOrders) {
            if (co.custom_fields?.phone) phone = co.custom_fields.phone;
            if (co.custom_fields?.email) email = co.custom_fields.email;
            if (phone && email) break;
          }

          const totalInvoiced = customerOrders.reduce((sum, o) => sum + (o.grand_total || 0), 0);
          const totalPaid = customerOrders.reduce((sum, o) => sum + (o.paid_amount || 0), 0);
          const balance = Math.max(0, totalInvoiced - totalPaid);

          return {
            name,
            phone,
            email,
            invoiceCount: customerOrders.length,
            totalInvoiced,
            totalPaid,
            balance,
            invoices: customerOrders.map(co => ({
              id: co.id,
              invoice_number: co.invoice_number,
              invoice_date: co.invoice_date || co.created_at,
              grand_total: co.grand_total,
              paid_amount: co.paid_amount,
              status: co.status
            }))
          };
        });

        setCustomers(aggregated);
      })
      .catch(() => toast.error('Failed to load customers'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = customers.filter(c => {
    const q = search.toLowerCase();
    return !q ||
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q);
  });

  // Bulk Actions Hook using customer name as key
  const {
    selectedIds,
    isSelected,
    toggleSelect,
    toggleSelectAll,
    isAllSelected,
    clearSelection,
    getSelectedItems,
    selectedCount
  } = useBulkActions(filtered, 'name');

  const handleBulkExport = () => {
    const selected = getSelectedItems();
    let csvContent = 'Customer Name,Phone,Email,Total Invoices,Total Invoiced,Total Paid,Outstanding Balance\n';
    
    selected.forEach(c => {
      const row = [
        c.name,
        c.phone || '',
        c.email || '',
        c.invoiceCount,
        c.totalInvoiced || 0,
        c.totalPaid || 0,
        c.balance || 0
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
      csvContent += row + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `customers_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedCount} customers to CSV`);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={22} color="#8b5cf6" />
            Customers Management
          </h2>
          <p>View accounts and billing stats for customers with generated invoices.</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-secondary btn-sm" onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--color-text-muted)'
          }} />
          <input
            className="form-control"
            style={{ paddingLeft: 32, margin: 0 }}
            placeholder="Search customers by name, phone, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Customers List Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Customers Overview</div>
            <div className="card-subtitle">{filtered.length} customers registered in invoicing system</div>
          </div>
          <Users size={18} color="var(--color-primary)" />
        </div>

        {loading ? (
          <div className="loading-center" style={{ padding: 60 }}><div className="loading-spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: 60 }}>
            <CheckCircle2 size={40} color="#10b981" style={{ opacity: 0.5, marginBottom: 12 }} />
            <p style={{ fontWeight: 600, fontSize: 15 }}>No customers found</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Add a lead and complete an invoice conversion to register active customers.
            </p>
          </div>
        ) : (
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
                  <th>Customer Name</th>
                  <th>Contact Info</th>
                  <th>Invoices</th>
                  <th>Total Invoiced</th>
                  <th>Total Paid</th>
                  <th>Outstanding Balance</th>
                  <th style={{ width: 32 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(cust => {
                  const isExpanded = expandedName === cust.name;
                  const isChecked = isSelected(cust.name);
                  return (
                    <Fragment key={cust.name}>
                      <tr 
                        style={{ cursor: 'pointer', background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }} 
                        onClick={() => setExpandedName(isExpanded ? null : cust.name)}
                      >
                        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            onChange={() => toggleSelect(cust.name)} 
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="sidebar-avatar" style={{ width: 28, height: 28, fontSize: 11, background: 'rgba(139, 92, 246, 0.12)', color: '#a7f3d0' }}>
                              {cust.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>{cust.name}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: 12.5 }}>
                            {cust.phone && <div>📞 {cust.phone}</div>}
                            {cust.email && <div>✉ {cust.email}</div>}
                            {!cust.phone && !cust.email && <span style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>—</span>}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-blue" style={{ fontWeight: 700 }}>📄 {cust.invoiceCount}</span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{fmtCurrency(cust.totalInvoiced)}</td>
                        <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{fmtCurrency(cust.totalPaid)}</td>
                        <td style={{ color: cust.balance > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: 700 }}>
                          {fmtCurrency(cust.balance)}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </td>
                      </tr>

                      {/* Expanded Section showing Customer Invoices */}
                      {isExpanded && (
                        <tr>
                          <td></td>
                          <td colSpan={7} style={{ padding: '12px 24px', background: 'rgba(0,0,0,0.1)' }}>
                            <div className="fade-in">
                              <h5 style={{ margin: '0 0 10px 0', fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-muted)' }}>Invoices Ledger</h5>
                              <table className="sub-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <th style={{ fontSize: 11, padding: '6px 8px', textAlign: 'left', color: 'var(--color-text-muted)' }}>Invoice No</th>
                                    <th style={{ fontSize: 11, padding: '6px 8px', textAlign: 'left', color: 'var(--color-text-muted)' }}>Date</th>
                                    <th style={{ fontSize: 11, padding: '6px 8px', textAlign: 'left', color: 'var(--color-text-muted)' }}>Total Amount</th>
                                    <th style={{ fontSize: 11, padding: '6px 8px', textAlign: 'left', color: 'var(--color-text-muted)' }}>Paid Amount</th>
                                    <th style={{ fontSize: 11, padding: '6px 8px', textAlign: 'left', color: 'var(--color-text-muted)' }}>Due Balance</th>
                                    <th style={{ fontSize: 11, padding: '6px 8px', textAlign: 'right', color: 'var(--color-text-muted)' }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cust.invoices.map(inv => {
                                    const balance = Math.max(0, inv.grand_total - inv.paid_amount);
                                    return (
                                      <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                        <td style={{ fontSize: 12.5, padding: '8px', color: 'var(--color-primary-light)' }}>{inv.invoice_number}</td>
                                        <td style={{ fontSize: 12, padding: '8px' }}>{fmtDateShort(inv.invoice_date)}</td>
                                        <td style={{ fontSize: 12.5, padding: '8px', fontWeight: 600 }}>{fmtCurrency(inv.grand_total)}</td>
                                        <td style={{ fontSize: 12.5, padding: '8px', color: 'var(--color-success)' }}>{fmtCurrency(inv.paid_amount)}</td>
                                        <td style={{ fontSize: 12.5, padding: '8px', color: balance > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', fontWeight: 700 }}>
                                          {fmtCurrency(balance)}
                                        </td>
                                        <td style={{ fontSize: 12, padding: '8px', textAlign: 'right' }}>
                                          <Link 
                                            to={`/invoice/${inv.id}`}
                                            className="btn btn-ghost btn-xs text-primary"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px' }}
                                          >
                                            <Printer size={11} /> Print
                                          </Link>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
