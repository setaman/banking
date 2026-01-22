import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  effectiveTheme: 'light' | 'dark';
}

interface ThemeActions {
  setMode: (mode: ThemeMode) => void;
  initTheme: () => void;
}

type ThemeStore = ThemeState & ThemeActions;

/**
 * Zustand store for theme management
 * 
 * Supports light, dark, and system theme modes with localStorage persistence.
 * Automatically detects system theme preference when mode is 'system'.
 */
export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      // State
      mode: 'system',
      effectiveTheme: 'light',

      // Actions
      
      /**
       * Set theme mode (light, dark, or system)
       * Automatically applies the theme to document root
       */
      setMode: (mode) => {
        set({ mode });
        get().initTheme();
      },

      /**
       * Initialize theme by applying it to document root
       * Called on mount and when mode changes
       */
      initTheme: () => {
        const { mode } = get();
        let effectiveTheme: 'light' | 'dark' = 'light';

        if (mode === 'system') {
          // Detect system preference
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          effectiveTheme = prefersDark ? 'dark' : 'light';
        } else {
          effectiveTheme = mode;
        }

        // Apply theme to document root
        if (effectiveTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }

        set({ effectiveTheme });
      },
    }),
    {
      name: 'finance-dashboard-theme',
      partialize: (state) => ({ mode: state.mode }), // Only persist mode
    }
  )
);

/**
 * Initialize theme on app startup
 * Call this in your App component useEffect
 */
export const initializeTheme = () => {
  const store = useThemeStore.getState();
  store.initTheme();

  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = () => {
    if (store.mode === 'system') {
      store.initTheme();
    }
  };

  mediaQuery.addEventListener('change', handleChange);
  
  return () => {
    mediaQuery.removeEventListener('change', handleChange);
  };
};
