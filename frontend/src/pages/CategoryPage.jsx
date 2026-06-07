import { useState, useEffect } from 'react';
import { productCategoriesAPI } from '../api';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Tag, ChevronDown, ChevronRight } from 'lucide-react';

export default function CategoryPage() {
  const [items, setItems] = useState([]);      // flat list from /flat
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({}); // { categoryName: bool }

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [mCategory, setMCategory] = useState('');
  const [mSubcategory, setMSubcategory] = useState('');
  const [mSortOrder, setMSortOrder] = useState('0');
  const [useExisting, setUseExisting] = useState(true); // toggle between existing or new category name

  const load = () => {
    setLoading(true);
    productCategoriesAPI.flat()
      .then(r => {
        setItems(r.data.data);
        // auto-expand all groups on first load
        const groups = {};
        r.data.data.forEach(i => { groups[i.category_name] = true; });
        setExpanded(groups);
      })
      .catch(() => toast.error('Failed to load categories'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Group flat items by category_name
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category_name]) acc[item.category_name] = [];
    acc[item.category_name].push(item);
    return acc;
  }, {});

  const uniqueCategories = Object.keys(grouped).sort();

  const openAdd = () => {
    setEditingId(null);
    setMCategory(uniqueCategories[0] || '');
    setMSubcategory('');
    setMSortOrder('0');
    setUseExisting(uniqueCategories.length > 0);
    setShowModal(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setMCategory(item.category_name);
    setMSubcategory(item.subcategory_name);
    setMSortOrder(String(item.sort_order));
    setUseExisting(false); // when editing show free text
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cat = mCategory.trim();
    const sub = mSubcategory.trim();
    if (!cat || !sub) return toast.error('Both Category and Subcategory are required');

    try {
      const payload = { category_name: cat, subcategory_name: sub, sort_order: parseInt(mSortOrder) || 0 };
      if (editingId) {
        await productCategoriesAPI.update(editingId, payload);
        toast.success('Subcategory updated');
      } else {
        await productCategoriesAPI.create(payload);
        toast.success(`"${sub}" added to "${cat}"`);
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove subcategory "${name}"?`)) return;
    try {
      await productCategoriesAPI.delete(id);
      toast.success('Subcategory removed');
      load();
    } catch {
      toast.error('Failed to remove');
    }
  };

  const toggleExpand = (cat) => {
    setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h2>Product Categories</h2>
          <p>Manage category groups and subcategories used in the product catalog</p>
        </div>
        <div className="page-header-right">
          <button className="btn btn-primary" id="add-category-btn" onClick={openAdd}>
            <Plus size={16} />
            Add Subcategory
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Category Tree</div>
          <div className="card-subtitle">{items.length} subcategories across {uniqueCategories.length} groups</div>
        </div>

        {loading ? (
          <div className="loading-center"><div className="loading-spinner"></div></div>
        ) : uniqueCategories.length === 0 ? (
          <div className="empty-state">
            <Tag size={36} />
            <p>No categories found. Add your first one!</p>
          </div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {uniqueCategories.map(cat => {
              const subs = grouped[cat] || [];
              const isOpen = expanded[cat];
              return (
                <div key={cat} style={{ marginBottom: 4 }}>
                  {/* Category row */}
                  <div
                    onClick={() => toggleExpand(cat)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 20px',
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: 8,
                      margin: '0 12px 2px',
                      userSelect: 'none',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  >
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    <Tag size={15} style={{ color: 'var(--color-primary-light)' }} />
                    <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{cat}</span>
                    <span className="badge badge-gray">{subs.length} subcategories</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 12 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(null);
                        setMCategory(cat);
                        setMSubcategory('');
                        setMSortOrder('0');
                        setUseExisting(false);
                        setShowModal(true);
                      }}
                      title={`Add subcategory to "${cat}"`}
                    >
                      <Plus size={13} /> Add
                    </button>
                  </div>

                  {/* Subcategory rows */}
                  {isOpen && (
                    <div style={{ marginLeft: 44, marginRight: 12 }}>
                      {subs.sort((a, b) => a.sort_order - b.sort_order || a.subcategory_name.localeCompare(b.subcategory_name)).map(item => (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 16px',
                            borderRadius: 6,
                            marginBottom: 2,
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: 'var(--color-primary-light)', opacity: 0.5,
                            flexShrink: 0
                          }} />
                          <span style={{ flex: 1, fontSize: 13 }}>{item.subcategory_name}</span>
                          {item.sort_order > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>order: {item.sort_order}</span>
                          )}
                          <div style={{ display: 'inline-flex', gap: 4 }}>
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => openEdit(item)}
                              title="Edit"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              className="btn btn-ghost btn-icon btn-sm text-danger"
                              onClick={() => handleDelete(item.id, item.subcategory_name)}
                              title="Delete"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <form className="modal" onSubmit={handleSubmit} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingId ? 'Edit Subcategory' : 'Add Subcategory'}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className="modal-body">
              {/* Category field */}
              <div className="form-group">
                <label className="form-label">Category Group <span>*</span></label>
                {!editingId && uniqueCategories.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${useExisting ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setUseExisting(true)}
                    >
                      Use Existing
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${!useExisting ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => { setUseExisting(false); setMCategory(''); }}
                    >
                      New Group
                    </button>
                  </div>
                )}
                {useExisting && !editingId && uniqueCategories.length > 0 ? (
                  <select
                    className="form-control"
                    value={mCategory}
                    onChange={e => setMCategory(e.target.value)}
                    required
                  >
                    {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-control"
                    value={mCategory}
                    onChange={e => setMCategory(e.target.value)}
                    placeholder="e.g. Masala & Blends, Spices"
                    required
                  />
                )}
              </div>

              {/* Subcategory field */}
              <div className="form-group">
                <label className="form-label">Subcategory Name <span>*</span></label>
                <input
                  type="text"
                  className="form-control"
                  value={mSubcategory}
                  onChange={e => setMSubcategory(e.target.value)}
                  placeholder="e.g. Kashmiri Chilli, Star Anise"
                  required
                />
              </div>

              {/* Sort order */}
              <div className="form-group">
                <label className="form-label">Sort Order</label>
                <input
                  type="number"
                  className="form-control"
                  value={mSortOrder}
                  onChange={e => setMSortOrder(e.target.value)}
                  placeholder="0"
                  min="0"
                />
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  Lower numbers appear first in the dropdown. Leave 0 for alphabetical order.
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Update' : 'Add Subcategory'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
