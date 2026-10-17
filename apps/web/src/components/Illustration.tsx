import type { CSSProperties } from 'react';
export type SpriteName =
  'mascot' | 'apple' | 'golden' | 'green' | 'video' | 'book' | 'work' | 'calendar';
export type MascotMood = 'welcome' | 'wink' | 'cheer' | 'sad' | 'feedback' | 'harvest';
const assetFor: Record<SpriteName, string> = {
  mascot: 'mascot-welcome',
  apple: 'goal-fruit-red',
  golden: 'fruit-orange',
  green: 'goal-fruit-green',
  video: 'category-work',
  book: 'category-study',
  work: 'category-work',
  calendar: 'calendar',
};
export function Illustration({
  name,
  size = 40,
  className = '',
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <img
      className={`journal-art ${className}`}
      src={`/assets/journal/${name}.webp`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ '--art-size': `${size}px` } as CSSProperties}
      draggable={false}
    />
  );
}
/** Stored icon keys remain compatible with existing projects; artwork comes from the new library. */
export function ArtIcon({
  name,
  size = 40,
  className = '',
}: {
  name: SpriteName;
  size?: number;
  className?: string;
}) {
  return <Illustration name={assetFor[name]} size={size} className={className} />;
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
const operationFor: Record<IconName, string> = {
  home: 'home',
  projects: 'projects',
  record: 'record',
  review: 'review',
  user: 'user',
  mic: 'mic',
  arrow: 'arrow',
  back: 'back',
  plus: 'plus',
  check: 'check',
  close: 'close',
  settings: 'settings',
};
export function LineIcon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <img
      className="journal-line-icon"
      src={`/assets/journal/icons/${operationFor[name]}.svg`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
    />
  );
}
