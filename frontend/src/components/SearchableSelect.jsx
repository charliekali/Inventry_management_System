import { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = '-- Choose Option --',
  className = '',
  style = {},
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter options based on search term
  const filteredOptions = options.filter(opt =>
    (opt.label || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Find the selected option's label to display in the trigger
  const selectedOption = options.find(opt => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : '';

  const handleSelect = (val) => {
    if (onChange) {
      onChange(val);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange('');
    }
    setSearchTerm('');
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
        ...style
      }}
      className={`searchable-select-container ${className}`}
    >
      {/* Trigger Button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          padding: '10px 14px',
          background: 'var(--color-bg-input, #ffffff)',
          border: isOpen ? '1px solid var(--color-primary, #3b82f6)' : '1px solid var(--color-border, rgba(0, 0, 0, 0.08))',
          borderRadius: 'var(--radius-sm, 8px)',
          color: displayLabel ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
          fontSize: '14px',
          transition: 'all 150ms ease',
          boxShadow: isOpen ? '0 0 0 3px var(--color-primary-glow)' : 'none',
          userSelect: 'none'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {displayLabel || placeholder}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {displayLabel && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'none',
                border: 'none',
                padding: 2,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-text-muted)'
              }}
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown
            size={16}
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms ease',
              color: 'var(--color-text-muted)'
            }}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            background: 'var(--color-bg-card, #ffffff)',
            border: '1px solid var(--color-border, rgba(0, 0, 0, 0.08))',
            borderRadius: 'var(--radius-sm, 8px)',
            boxShadow: 'var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.08))',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Search Bar inside dropdown */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              borderBottom: '1px solid var(--color-border, rgba(0, 0, 0, 0.05))',
              gap: 8,
              background: 'var(--color-bg-secondary, #f1f5f9)'
            }}
          >
            <Search size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              autoFocus
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                fontSize: '13px',
                color: 'var(--color-text-primary)',
                padding: 0,
                outline: 'none'
              }}
              onClick={(e) => e.stopPropagation()}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSearchTerm(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 2,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-muted)'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Options List */}
          <div
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              padding: '4px 0'
            }}
          >
            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: '10px 14px',
                  fontSize: '13px',
                  color: 'var(--color-text-muted)',
                  textAlign: 'center'
                }}
              >
                No results found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--color-bg-secondary-btn-hover, rgba(0,0,0,0.04))';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                    style={{
                      padding: '10px 14px',
                      fontSize: '13.5px',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--color-primary-glow, rgba(59, 130, 246, 0.1))' : 'transparent',
                      color: isSelected ? 'var(--color-primary-light, #2563eb)' : 'var(--color-text-primary)',
                      fontWeight: isSelected ? '600' : 'normal',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 100ms ease'
                    }}
                  >
                    <span>{opt.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
