import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'system', label: 'Match system', Icon: Monitor },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

/** Three-way switch with a sliding highlight. `compact` hides the system option on small spaces. */
export default function ThemeToggle({ className = '', onDark = false }) {
  const { theme, setTheme } = useTheme();
  const index = OPTIONS.findIndex((o) => o.value === theme);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`theme-toggle ${className.includes('absolute') ? '' : 'relative'} ${onDark ? 'theme-toggle-on-dark' : ''} ${className}`}
      style={{ '--i': index }}
    >
      <span className="theme-toggle-thumb" aria-hidden="true" />
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={theme === value ? 'is-active' : ''}
        >
          <Icon className="h-[15px] w-[15px]" strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
