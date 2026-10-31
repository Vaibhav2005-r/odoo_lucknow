import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'loopbill-theme'; // 'light' | 'dark' | 'system'
const ThemeContext = createContext(null);

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
const readPref = () => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readPref);
  const [prefersDark, setPrefersDark] = useState(systemDark);
  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;

  // follow the operating system while the choice is "system"
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const on = (e) => setPrefersDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* private mode: the choice just lasts for this visit */
    }
  }, []);

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

// Pages that must always look like paper (printable invoices) call this.
export function useForceLight() {
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.dataset.theme;
    el.dataset.theme = 'light';
    el.style.colorScheme = 'light';
    return () => {
      el.dataset.theme = prev;
      el.style.colorScheme = prev;
    };
  }, []);
}
