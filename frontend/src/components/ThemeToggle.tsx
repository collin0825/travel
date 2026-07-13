import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/stores';

interface ThemeToggleProps {
  /**
   * `floating` pins it top-right; `inline` renders a plain icon button;
   * `sidebar` renders a nav-style row for the desktop side navigation.
   */
  variant?: 'floating' | 'inline' | 'sidebar';
  className?: string;
}

const variantClass: Record<NonNullable<ThemeToggleProps['variant']>, string> = {
  floating: 'theme-toggle--floating',
  inline: 'theme-toggle--inline',
  sidebar: 'side-nav-item',
};

const ThemeToggle: React.FC<ThemeToggleProps> = ({ variant = 'floating', className }) => {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const icon = theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="切換主題"
      className={`${variantClass[variant]}${className ? ` ${className}` : ''}`}
    >
      {icon}
      {variant === 'sidebar' && <span>切換主題</span>}
    </button>
  );
};

export default ThemeToggle;
