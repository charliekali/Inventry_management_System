import { useState, useEffect } from 'react';
import { productsAPI, productCategoriesAPI } from '../api';
import toast from 'react-hot-toast';
import { Plus, Edit2, Archive, Package, Download, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useBulkActions from '../hooks/useBulkActions';
import BulkActionBar from '../components/BulkActionBar';

const getStepBadgeClass = (step) => {
  switch (step) {
    case 'CLEANING': return 'badge-gray';
    case 'DRYING': return 'badge-orange';
    case 'ROASTING': return 'badge-cyan';
    case 'GRINDING': return 'badge-purple';
    case 'BLENDING': return 'badge-blue';
    case 'PACKING': return 'badge-green';
    default: return 'badge-gray';
  }
};

const getTypeBadgeClass = (type) => {
  switch (type) {
    case 'FINISHED_GOOD': return 'badge-blue';
    case 'RAW_MATERIAL': return 'badge-purple';
    case 'BLEND': return 'badge-cyan';
    case 'TOOL': return 'badge-gray';
    default: return 'badge-gray';
  }
};

const getTypeLabel = (type) => {
  switch (type) {
    case 'FINISHED_GOOD': return 'FG';
    case 'RAW_MATERIAL': return 'RM';
    case 'BLEND': return 'BLEND';
    case 'TOOL': return 'TOOL';
    default: return type;
  }
};

export default function ProductPage() {
  const { user, hasPermission } = useAuth();
  const isSuperAdmin = user?.role === 'Super Admin';

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

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
  } = useBulkActions(products);
  const [pSellingPrice, setPSellingPrice] = useState('');
  const [pCostPrice, setPCostPrice] = useState('');
  const [categories, setCategories] = useState([]); // [{category, subcategories:[]}]
  
  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [pCode, setPCode] = useState('');
  const [pName, setPName] = useState('');
  const [pType, setPType] = useState('FINISHED_GOOD');
  const [pUnit, setPUnit] = useState('PCS');
  const [pMinStock, setPMinStock] = useState('0');
  const [pDesc, setPDesc] = useState('');
  const [pCategory, setPCategory] = useState('');

  // New product pack config fields
  const [pPackSizeG, setPPackSizeG] = useState('');
  const [pPacksPerKg, setPPacksPerKg] = useState('');
  const [pBatchSizeKg, setPBatchSizeKg] = useState('');
  const [pProcessNotes, setPProcessNotes] = useState('');

  const loadProducts = (archived = showArchived) => {
    setLoading(true);
    productsAPI.list({ active: !archived })
      .then(r => setProducts(r.data.data))
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false));
  };

  const loadCategories = () => {
    productCategoriesAPI.list()
      .then(r => setCategories(r.data.data))
      .catch(() => {}); // non-critical
  };

  useEffect(() => {
    loadProducts(showArchived);
    clearSelection();
  }, [showArchived]);

  useEffect(() => {
    loadCategories();
  }, []);



  // Product CRUD
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!pCode.trim() || !pName.trim()) return toast.error('Code and Name are required');

    try {
      const payload = {
        code: pCode.toUpperCase(),
        name: pName,
        type: pType,
        unit: pUnit,
        min_stock: parseFloat(pMinStock) || 0,
        description: pDesc,
        category: pCategory,
        pack_size_g: pType === 'FINISHED_GOOD' && pPackSizeG ? parseFloat(pPackSizeG) : null,
        packs_per_kg: pType === 'FINISHED_GOOD' && pPacksPerKg ? parseFloat(pPacksPerKg) : null,
        batch_size_kg: pType === 'FINISHED_GOOD' && pBatchSizeKg ? parseFloat(pBatchSizeKg) : null,
        process_notes: pType === 'FINISHED_GOOD' ? pProcessNotes : ''
      };

      if (isSuperAdmin) {
        payload.selling_price = pSellingPrice ? parseFloat(pSellingPrice) : null;
        payload.cost_price = pCostPrice ? parseFloat(pCostPrice) : null;
      }

      if (editingProductId) {
        await productsAPI.update(editingProductId, payload);
        toast.success('Product updated successfully');
      } else {
        await productsAPI.create(payload);
        toast.success('Product created successfully');
      }
      setShowProductModal(false);
      resetProductForm();
      loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    }
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setPCode('');
    setPName('');
    setPType('FINISHED_GOOD');
    setPUnit('PCS');
    setPMinStock('0');
    setPDesc('');
    setPCategory('');
    setPPackSizeG('');
    setPPacksPerKg('');
    setPBatchSizeKg('');
    setPProcessNotes('');
    setPSellingPrice('');
    setPCostPrice('');
  };

  const handleEditProduct = (p, e) => {
    e.stopPropagation();
    setEditingProductId(p.id);
    setPCode(p.code);
    setPName(p.name);
    setPType(p.type);
    setPUnit(p.unit || 'PCS');
    setPMinStock(p.min_stock.toString());
    setPDesc(p.description || '');
    setPCategory(p.category || '');
    setPPackSizeG(p.pack_size_g ? p.pack_size_g.toString() : '');
    setPPacksPerKg(p.packs_per_kg ? p.packs_per_kg.toString() : '');
    setPBatchSizeKg(p.batch_size_kg ? p.batch_size_kg.toString() : '');
    setPProcessNotes(p.process_notes || '');
    setPSellingPrice(p.selling_price ? p.selling_price.toString() : '');
    setPCostPrice(p.cost_price ? p.cost_price.toString() : '');
    setShowProductModal(true);
  };

  const handleArchiveProduct = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to archive this product?')) return;
    try {
      await productsAPI.delete(id);
      toast.success('Product archived');
      loadProducts();
    } catch (err) {
      toast.error('Failed to archive product');
    }
  };

  const handleRestoreProduct = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to restore this product?')) return;
    try {
      await productsAPI.update(id, { is_active: true });
      toast.success('Product restored successfully');
      loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to restore product');
    }
  };

  const handleDeletePermanentProduct = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('WARNING: Are you sure you want to PERMANENTLY delete this product? This action cannot be undone.')) return;
    try {
      await productsAPI.delete(id, { permanent: true });
      toast.success('Product permanently deleted');
      loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to permanently delete product');
    }
  };

  const handleBulkArchive = async () => {
    if (!window.confirm(`Are you sure you want to archive ${selectedCount} products?`)) return;
    const loadingToast = toast.loading(`Archiving ${selectedCount} products...`);
    try {
      await Promise.all(selectedIds.map(id => productsAPI.delete(id)));
      toast.success('Selected products archived successfully', { id: loadingToast });
      clearSelection();
      loadProducts();
    } catch (err) {
      toast.error('Failed to archive some products', { id: loadingToast });
    }
  };

  const handleBulkRestore = async () => {
    if (!window.confirm(`Are you sure you want to restore ${selectedCount} products?`)) return;
    const loadingToast = toast.loading(`Restoring ${selectedCount} products...`);
    try {
      await Promise.all(selectedIds.map(id => productsAPI.update(id, { is_active: true })));
      toast.success('Selected products restored successfully', { id: loadingToast });
      clearSelection();
      loadProducts();
    } catch (err) {
      toast.error('Failed to restore some products', { id: loadingToast });
    }
  };

  const handleBulkDeletePermanent = async () => {
    if (!window.confirm(`WARNING: Are you sure you want to PERMANENTLY delete ${selectedCount} products? This action cannot be undone.`)) return;
    const loadingToast = toast.loading(`Deleting ${selectedCount} products permanently...`);
    try {
      await Promise.all(selectedIds.map(id => productsAPI.delete(id, { permanent: true })));
      toast.success('Selected products permanently deleted', { id: loadingToast });
      clearSelection();
      loadProducts();
    } catch (err) {
      toast.error('Failed to permanently delete some products. They may be referenced in records.', { id: loadingToast });
    }
  };

  const handleBulkExport = () => {
    const selected = getSelectedItems();
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Code,Name,Category,Type,Min Stock,Selling Price,Cost Price,Description\n';
    
    selected.forEach(p => {
      const row = [
        p.code,
        p.name,
        p.category || '',
        p.type,
        p.min_stock,
        p.selling_price || 0,
        p.cost_price || 0,
        p.description || ''
      ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
      csvContent += row + '\n';
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `products_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${selectedCount} products to CSV`);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Product Catalog</h2>
          <p>Manage raw material inputs, finished goods, and Bill of Material (BOM) recipes</p>
        </div>
        <div className="page-header-right" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--color-bg-card)', padding: 4, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <button 
              className={`btn btn-sm ${!showArchived ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => { setShowArchived(false); }}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              Active
            </button>
            <button 
              className={`btn btn-sm ${showArchived ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => { setShowArchived(true); }}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              Archived
            </button>
          </div>
          {hasPermission('PRODUCTS:CREATE') && (
            <button className="btn btn-primary" onClick={() => { resetProductForm(); setShowProductModal(true); }}>
              <Plus size={16} />
              Add Product
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">{showArchived ? 'Archived Products' : 'Products Catalog'}</div>
        </div>

        {loading ? (
          <div className="loading-center"><div className="loading-spinner"></div></div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            <Package size={32} />
            <p>{showArchived ? 'No archived products found' : 'No products created yet'}</p>
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
                  <th>Code</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Min</th>
                  {isSuperAdmin && <th>Selling Price</th>}
                  {isSuperAdmin && <th>Cost Price</th>}
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const isFG = p.type === 'FINISHED_GOOD';
                  const isChecked = isSelected(p.id);
                  return (
                    <tr key={p.id} style={{ background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'transparent' }}>
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => toggleSelect(p.id)} 
                          style={{ cursor: 'pointer' }}
                        />
                      </td>
                      <td style={{ fontWeight: 700 }}>{p.code}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Unit: {p.unit}</div>
                      </td>
                      <td>
                        {p.category ? (
                          <span className="badge badge-green" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{p.category}</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${getTypeBadgeClass(p.type)}`}>
                          {getTypeLabel(p.type)}
                        </span>
                      </td>
                      <td>{p.min_stock}</td>
                      {isSuperAdmin && <td>₹{(p.selling_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>}
                      {isSuperAdmin && <td>₹{(p.cost_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          {!showArchived ? (
                            <>
                              {hasPermission('PRODUCTS:EDIT') && (
                                <button className="btn btn-ghost btn-icon btn-sm" onClick={(e) => handleEditProduct(p, e)} title="Edit Product">
                                  <Edit2 size={13} />
                                </button>
                              )}
                              {hasPermission('PRODUCTS:DELETE') && (
                                <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={(e) => handleArchiveProduct(p.id, e)} title="Archive Product">
                                  <Archive size={13} />
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              {hasPermission('PRODUCTS:EDIT') && (
                                <button className="btn btn-ghost btn-icon btn-sm text-success" onClick={(e) => handleRestoreProduct(p.id, e)} title="Restore Product">
                                  <RotateCcw size={13} />
                                </button>
                              )}
                              {hasPermission('PRODUCTS:DELETE') && (
                                <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={(e) => handleDeletePermanentProduct(p.id, e)} title="Permanently Delete">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </>
                          )}
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

      {/* Product Add/Edit Modal */}
      {showProductModal && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <form className="modal" onSubmit={handleProductSubmit} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingProductId ? 'Update Product' : 'Add Product'}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowProductModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Product Code <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={pCode} 
                    onChange={(e) => setPCode(e.target.value)} 
                    placeholder="e.g. FG-1001, RM-2045"
                    disabled={editingProductId}
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Product Name <span>*</span></label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={pName} 
                    onChange={(e) => setPName(e.target.value)} 
                    placeholder="e.g. Aluminum Frame, Solar Inverter"
                    required 
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select 
                    className="form-control" 
                    value={pType} 
                    onChange={(e) => setPType(e.target.value)}
                    disabled={editingProductId}
                  >
                    <option value="FINISHED_GOOD">Finished Good (FG)</option>
                    <option value="RAW_MATERIAL">Raw Material (RM)</option>
                    <option value="BLEND">Blend</option>
                    <option value="TOOL">Tools</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Unit of Measure</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={pUnit} 
                    onChange={(e) => setPUnit(e.target.value)} 
                    placeholder="e.g. PCS, KG, LTRS"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Min Stock Level</label>
                  <input 
                    type="number" 
                    step="any"
                    className="form-control" 
                    value={pMinStock} 
                    onChange={(e) => setPMinStock(e.target.value)} 
                    placeholder="0.0"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-control"
                  value={pCategory}
                  onChange={(e) => setPCategory(e.target.value)}
                >
                  <option value="">— Select Category —</option>
                  {categories.map(group => (
                    <optgroup key={group.category} label={group.category}>
                      {group.subcategories.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {pType === 'FINISHED_GOOD' && (
                <div style={{ marginTop: 5, padding: 12, border: '1px dashed var(--color-border)', borderRadius: 8, background: 'rgba(255,255,255,0.01)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, color: 'var(--color-primary-light)' }}>
                    Production & Pack Configuration
                  </h4>
                  <div className="form-row-3">
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11 }}>Pack Size (g)</label>
                      <input 
                        type="number" 
                        step="any"
                        className="form-control" 
                        value={pPackSizeG} 
                        onChange={(e) => setPPackSizeG(e.target.value)} 
                        placeholder="e.g. 100"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11 }}>Packs per kg</label>
                      <input 
                        type="number" 
                        step="any"
                        className="form-control" 
                        value={pPacksPerKg} 
                        onChange={(e) => setPPacksPerKg(e.target.value)} 
                        placeholder="e.g. 10"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 11 }}>Batch Size (kg)</label>
                      <input 
                        type="number" 
                        step="any"
                        className="form-control" 
                        value={pBatchSizeKg} 
                        onChange={(e) => setPBatchSizeKg(e.target.value)} 
                        placeholder="e.g. 50"
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: 10 }}>
                    <label className="form-label" style={{ fontSize: 11 }}>Process / Blending Notes</label>
                    <textarea 
                      className="form-control" 
                      style={{ minHeight: 50 }}
                      value={pProcessNotes} 
                      onChange={(e) => setPProcessNotes(e.target.value)} 
                      placeholder="Specify blending steps, roasting/grinding instructions..."
                    />
                  </div>
                </div>
              )}

              {isSuperAdmin && (
                <div className="form-row" style={{ marginTop: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Selling Price (₹)</label>
                    <input 
                      type="number" 
                      step="any"
                      className="form-control" 
                      value={pSellingPrice} 
                      onChange={(e) => setPSellingPrice(e.target.value)} 
                      placeholder="0.00"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost Price (₹)</label>
                    <input 
                      type="number" 
                      step="any"
                      className="form-control" 
                      value={pCostPrice} 
                      onChange={(e) => setPCostPrice(e.target.value)} 
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginTop: 10 }}>
                <label className="form-label">Description</label>
                <textarea 
                  className="form-control" 
                  value={pDesc} 
                  onChange={(e) => setPDesc(e.target.value)} 
                  placeholder="Specify product details, specs, suppliers, dimensions..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowProductModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save Product</button>
            </div>
          </form>
        </div>
      )}

      <BulkActionBar 
        selectedCount={selectedCount}
        onClear={clearSelection}
        actions={!showArchived ? [
          {
            label: 'Export CSV',
            icon: <Download size={16} />,
            onClick: handleBulkExport,
            className: 'btn-secondary'
          },
          {
            label: 'Archive Selected',
            icon: <Archive size={16} />,
            onClick: handleBulkArchive,
            className: 'btn-danger text-danger'
          }
        ] : [
          {
            label: 'Export CSV',
            icon: <Download size={16} />,
            onClick: handleBulkExport,
            className: 'btn-secondary'
          },
          {
            label: 'Restore Selected',
            icon: <RotateCcw size={16} />,
            onClick: handleBulkRestore,
            className: 'btn-success text-success'
          },
          {
            label: 'Permanently Delete Selected',
            icon: <Trash2 size={16} />,
            onClick: handleBulkDeletePermanent,
            className: 'btn-danger text-danger'
          }
        ]}
      />
    </div>
  );
}
