import { Icon, type IconName } from './Icon';

export type TabKey = 'watch' | 'globe' | 'saved' | 'profile';

const TABS: Array<{ key: TabKey; label: string; icon: IconName }> = [
  { key: 'watch', label: 'Home', icon: 'home' },
  { key: 'globe', label: 'Explore', icon: 'compass' },
  { key: 'saved', label: 'Saved', icon: 'bookmark' },
  { key: 'profile', label: 'Profile', icon: 'person' },
];

export function TabBar({ active, onChange }: { active: TabKey; onChange: (key: TabKey) => void }) {
  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className="tabbar__item"
          aria-current={active === tab.key ? 'page' : undefined}
          onClick={() => onChange(tab.key)}
        >
          <Icon name={active === tab.key && tab.key === 'saved' ? 'bookmark-filled' : tab.icon} size={21} />
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

export default TabBar;
