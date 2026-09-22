/**
 * The glyph set. Hand-drawn SVG paths on a 24-unit grid, one stroke weight, so
 * the controls read as one family rather than an icon-font grab bag. No emoji
 * anywhere in this product.
 */

export type IconName =
  | 'chevron-down' | 'chevron-right' | 'close' | 'search' | 'pin'
  | 'play' | 'pause' | 'shuffle' | 'back-10' | 'forward-10'
  | 'airplay' | 'pip' | 'captions' | 'expand' | 'info'
  | 'bookmark' | 'bookmark-filled' | 'share' | 'globe' | 'home'
  | 'person' | 'sound-on' | 'sound-off' | 'more' | 'arrow-right' | 'compass'
  | 'moon' | 'stack' | 'link';

const PATHS: Record<IconName, JSX.Element> = {
  'chevron-down': <path d="M6 9.5 12 15.5 18 9.5" />,
  'chevron-right': <path d="M9.5 6 15.5 12 9.5 18" />,
  close: <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />,
  search: <><circle cx="11" cy="11" r="6.2" /><path d="M15.6 15.6 20 20" /></>,
  pin: <><path d="M12 21c4-4.6 6-7.9 6-10.5A6 6 0 0 0 6 10.5C6 13.1 8 16.4 12 21Z" /><circle cx="12" cy="10.4" r="2.2" /></>,
  play: <path d="M8 5.6 19 12 8 18.4Z" />,
  pause: <><path d="M9.5 5.5v13" /><path d="M14.5 5.5v13" /></>,
  shuffle: <><path d="M3 7h3.2l3 4.4M21 7h-4l-8 10H3" /><path d="M17.6 4.4 21 7l-3.4 2.6M17.6 14.4 21 17l-3.4 2.6" /><path d="M21 17h-4" /></>,
  'back-10': <><path d="M12 6V3L7.5 6.5 12 10V7a7 7 0 1 1-6.8 5.4" /><text x="12" y="16.6" textAnchor="middle" fontSize="7.5" fill="currentColor" stroke="none" fontFamily="inherit">10</text></>,
  'forward-10': <><path d="M12 6V3l4.5 3.5L12 10V7a7 7 0 1 0 6.8 5.4" /><text x="12" y="16.6" textAnchor="middle" fontSize="7.5" fill="currentColor" stroke="none" fontFamily="inherit">10</text></>,
  airplay: <><path d="M5.5 16.5H4.2A1.2 1.2 0 0 1 3 15.3V5.7a1.2 1.2 0 0 1 1.2-1.2h15.6A1.2 1.2 0 0 1 21 5.7v9.6a1.2 1.2 0 0 1-1.2 1.2h-1.3" /><path d="m12 13.6 4.6 5.9H7.4Z" /></>,
  pip: <><rect x="3" y="5" width="18" height="14" rx="2" /><rect x="12.5" y="11.5" width="6" height="5" rx="1" /></>,
  captions: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 10.4a2.6 2.6 0 1 0 0 3.2M17 10.4a2.6 2.6 0 1 0 0 3.2" /></>,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  info: <><circle cx="12" cy="12" r="8.6" /><path d="M12 11v5.5" /><circle cx="12" cy="7.9" r="0.9" fill="currentColor" stroke="none" /></>,
  bookmark: <path d="M6.5 4.5h11v15l-5.5-4-5.5 4Z" />,
  'bookmark-filled': <path d="M6.5 4.5h11v15l-5.5-4-5.5 4Z" fill="currentColor" />,
  share: <><path d="M12 15.5V4" /><path d="m8 7.6 4-3.6 4 3.6" /><path d="M5.5 12.5v6a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-6" /></>,
  globe: <><circle cx="12" cy="12" r="8.6" /><path d="M3.6 12h16.8" /><path d="M12 3.4c2.4 2.6 3.6 5.5 3.6 8.6s-1.2 6-3.6 8.6c-2.4-2.6-3.6-5.5-3.6-8.6S9.6 6 12 3.4Z" /></>,
  home: <path d="M4 10.8 12 4l8 6.8V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" />,
  person: <><circle cx="12" cy="8.4" r="3.6" /><path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6" /></>,
  'sound-on': <><path d="M4 9.5h3.4L12 5.6v12.8L7.4 14.5H4Z" /><path d="M15.4 9.4a3.6 3.6 0 0 1 0 5.2M18 7a7 7 0 0 1 0 10" /></>,
  'sound-off': <><path d="M4 9.5h3.4L12 5.6v12.8L7.4 14.5H4Z" /><path d="m16 10 4 4M20 10l-4 4" /></>,
  more: <><circle cx="6" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="18" cy="12" r="1.3" fill="currentColor" stroke="none" /></>,
  'arrow-right': <path d="M4.5 12h14M13.5 6.5 19 12l-5.5 5.5" />,
  compass: <><circle cx="12" cy="12" r="8.6" /><path d="m15.4 8.6-1.9 5-5 1.9 1.9-5Z" /></>,
  moon: <path d="M19.2 14.6A7.8 7.8 0 0 1 9.4 4.8a7.8 7.8 0 1 0 9.8 9.8Z" />,
  stack: <><rect x="4" y="9" width="16" height="11" rx="1.6" /><path d="M6.5 6h11M9 3.5h6" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" /></>,
};

export function Icon({ name, size = 22, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

export default Icon;
