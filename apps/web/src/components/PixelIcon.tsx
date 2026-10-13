import type { CSSProperties } from 'react';

export type SpriteName =
  'mascot' | 'apple' | 'golden' | 'green' | 'video' | 'book' | 'work' | 'calendar';
const sprites: SpriteName[] = [
  'mascot',
  'apple',
  'golden',
  'green',
  'video',
  'book',
  'work',
  'calendar',
];
export function PixelIcon({
  name,
  size = 40,
  className = '',
}: {
  name: SpriteName;
  size?: number;
  className?: string;
}) {
  const index = sprites.indexOf(name);
  return (
    <span
      className={`pixel-sprite ${className}`}
      aria-hidden="true"
      style={
        {
          '--sprite-size': `${size}px`,
          backgroundPosition: `${((index % 4) * 100) / 3}% ${Math.floor(index / 4) * 100}%`,
        } as CSSProperties
      }
    />
  );
}
type IconName =
  | 'home'
  | 'projects'
  | 'record'
  | 'review'
  | 'user'
  | 'mic'
  | 'arrow'
  | 'back'
  | 'plus'
  | 'check'
  | 'close'
  | 'settings';
const paths: Record<IconName, string> = {
  home: 'M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9',
  projects: 'M7 5H4v16h16V5h-3M9 3h6v5H9zM8 12h8M8 16h5',
  record: 'M7 3h10v3h3v15H4V6h3M8 11l3 3 5-5',
  review: 'M12 21S3 15 3 8c0-5 6-6 9-2 3-4 9-3 9 2 0 7-9 13-9 13Z',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3c0-6 16-6 16 0v3Z',
  mic: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8',
  arrow: 'M4 12h16M14 6l6 6-6 6',
  back: 'M20 12H4M10 6l-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l4 4L19 6',
  close: 'M6 6l12 12M6 18 18 6',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2',
};
export function LineIcon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
