import { useState } from 'react';

/**
 * Custom hook to manage checkbox selections for tables.
 * 
 * @param {Array} items - The full list of items in the table.
 * @param {String} keyField - The field name that uniquely identifies each item (default: 'id').
 */
export default function useBulkActions(items = [], keyField = 'id') {
  const [selectedIds, setSelectedIds] = useState(new Set());

  const getIds = () => items.map(item => item[keyField]);

  const isSelected = (id) => selectedIds.has(id);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const allIds = getIds();
      // If all visible items are already selected, clear selection
      const allSelected = allIds.every(id => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        allIds.forEach(id => next.delete(id));
        return next;
      } else {
        const next = new Set(prev);
        allIds.forEach(id => next.add(id));
        return next;
      }
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const isAllSelected = items.length > 0 && getIds().every(id => selectedIds.has(id));
  
  const getSelectedItems = () => {
    return items.filter(item => selectedIds.has(item[keyField]));
  };

  return {
    selectedIds: Array.from(selectedIds),
    selectedSet: selectedIds,
    isSelected,
    toggleSelect,
    toggleSelectAll,
    isAllSelected,
    clearSelection,
    getSelectedItems,
    selectedCount: selectedIds.size,
  };
}
