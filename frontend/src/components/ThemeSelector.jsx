import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const getThemeIcon = (t) => {
    switch (t) {
      case 'light': return <Sun size={15} />;
      case 'dark': return <Moon size={15} />;
      default: return <Monitor size={15} />;
    }
  };

  const getThemeLabel = (t) => {
    switch (t) {
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      default: return 'System';
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button 
        type="button"
        className="btn btn-secondary btn-sm" 
        onClick={() => setOpen(!open)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}
        title={`Theme: ${getThemeLabel(theme)}`}
      >
        {getThemeIcon(theme)}
        <span style={{ textTransform: 'capitalize' }}>{getThemeLabel(theme)}</span>
      </button>

      {open && (
        <>
          <div 
            style={{ 
              position: 'fixed', 
              inset: 0, 
              zIndex: 999 
            }} 
            onClick={() => setOpen(false)} 
          />
          <div 
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 8px)',
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '4px',
              minWidth: '120px',
              boxShadow: 'var(--shadow-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              zIndex: 1000,
              animation: 'fadeIn 0.15s ease'
            }}
          >
            {['light', 'dark', 'system'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTheme(t);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: theme === t ? 'var(--color-bg-secondary)' : 'transparent',
                  color: theme === t ? 'var(--color-primary-light)' : 'var(--color-text-secondary)',
                  width: '100%',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: theme === t ? '600' : '500',
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
                className="btn-ghost"
              >
                {getThemeIcon(t)}
                {getThemeLabel(t)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
