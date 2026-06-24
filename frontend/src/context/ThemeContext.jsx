import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Retrieve saved theme or default to 'system'
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('ttrims-theme');
    return saved || 'system';
  });

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('ttrims-theme', newTheme);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
