import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
  /** Re-applies the persisted theme to the document root. */
  applyTheme: () => void;
}

const setDocumentTheme = (theme: Theme): void => {
  document.documentElement.setAttribute('data-theme', theme);
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggleTheme: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
        setDocumentTheme(next);
        set({ theme: next });
      },
      applyTheme: () => setDocumentTheme(get().theme),
    }),
    { name: 'travel_theme' },
  ),
);
