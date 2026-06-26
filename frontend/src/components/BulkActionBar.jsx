import React from 'react';
import { X } from 'lucide-react';

/**
 * BulkActionBar
 * 
 * A floating, glassmorphism-styled action pill that appears when items are selected.
 * 
 * @param {Number} selectedCount - Number of currently selected items.
 * @param {Function} onClear - Callback to clear selection.
 * @param {Array} actions - Array of action buttons to render:
 *   actions = [{ label: 'Export', icon: <Download />, onClick: () => {}, className: 'btn-primary' }]
 */
export default function BulkActionBar({ selectedCount, onClear, actions = [] }) {
  if (selectedCount === 0) return null;

  return (
    <div 
      className="bulk-action-bar fade-in" 
      style={{
        position: 'fixed',
        bottom: 74, // elevated slightly to clear bottom navigation on mobile
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(15, 23, 42, 0.9)', // Deep premium slate
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        color: '#ffffff',
        maxWidth: '92vw',
        width: 'max-content',
        animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      {/* Selection Counter & Clear button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button 
          onClick={onClear} 
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            borderRadius: '50%',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            e.currentTarget.style.color = '#f8fafc';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = '#94a3b8';
          }}
          title="Clear Selection"
        >
          <X size={16} />
        </button>
        <span style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
          {selectedCount} Selected
        </span>
      </div>
      
      {/* Separator */}
      <div style={{ height: 18, width: 1, background: 'rgba(255, 255, 255, 0.15)' }} />
      
      {/* Actions container */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {actions.map((action, idx) => (
          <button
            key={idx}
            onClick={action.onClick}
            className={`btn ${action.className || 'btn-primary'}`}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: '8px',
              cursor: 'pointer',
              border: 'none',
              height: '32px',
              color: action.className?.includes('text-danger') ? 'var(--color-danger)' : '#ffffff',
              ...action.style
            }}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translate(-50%, 20px);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
