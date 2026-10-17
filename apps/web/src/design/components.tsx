import type { ReactNode } from 'react';
import { Illustration } from '../components/Illustration';
import { PageHeading } from '../components/PageHeading';

export function SceneHeading({
  title,
  children,
  mascot = 'mascot-cheer',
  back = '/settings',
}: {
  title: string;
  children: ReactNode;
  mascot?: string;
  back?: string;
}) {
  return (
    <header className="fig-header">
      <PageHeading title={title} back={back} />
      <div className="fig-header-body">
        <div className="speech-bubble">{children}</div>
        <Illustration name={mascot} size={118} />
      </div>
    </header>
  );
}
export function Filters({
  options,
  value,
  onChange,
  label = '筛选',
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <div className="fig-filter" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
export function Metrics({ items }: { items: { label: string; value: number; icon?: string }[] }) {
  return (
    <div className="fig-metrics">
      {items.map((item) => (
        <div key={item.label}>
          {item.icon && <Illustration name={item.icon} size={30} />}
          <strong>{item.value}</strong>
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
  icon,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: string;
}) {
  return (
    <label className="fig-setting-row">
      <span>
        {icon && <Illustration name={icon} size={26} />}
        {label}
      </span>
      <input
        className="fig-switch"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
