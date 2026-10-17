import { useSyncExternalStore } from 'react';
import { z } from 'zod';
export const categories = [
  '工作事业',
  '学习成长',
  '健康运动',
  '生活习惯',
  '兴趣爱好',
  '其他',
] as const;
export type Preferences = {
  name: string;
  tagline: string;
  theme: 'garden' | 'night' | 'sea' | 'sunset';
  followSystem: boolean;
  motion: boolean;
  sound: boolean;
  recommendations: boolean;
  categories: Record<string, string>;
  quiz: number[];
  sharedResults: string[];
  reminders: {
    action: boolean;
    fruit: boolean;
    weekly: boolean;
    actionTime: string;
    fruitTime: string;
    weeklyTime: string;
    weekday: string;
    snoozeUntil: string;
  };
};
const defaults: Preferences = {
  name: '小苹果',
  tagline: '种下目标，收获更好的自己！',
  theme: 'garden',
  followSystem: false,
  motion: true,
  sound: false,
  recommendations: true,
  categories: {},
  quiz: [],
  sharedResults: [],
  reminders: {
    action: false,
    fruit: false,
    weekly: false,
    actionTime: '21:00',
    fruitTime: '20:00',
    weeklyTime: '20:00',
    weekday: '0',
    snoozeUntil: '',
  },
};
const key = 'apple-garden-preferences-v1';
const settingsSchema = z.object({
  name: z.string().max(24).catch(defaults.name),
  tagline: z.string().max(60).catch(defaults.tagline),
  theme: z.enum(['garden', 'night', 'sea', 'sunset']).catch('garden'),
  followSystem: z.boolean().catch(false),
  motion: z.boolean().catch(true),
  sound: z.boolean().catch(false),
  recommendations: z.boolean().catch(true),
  categories: z.record(z.string(), z.string().max(20)).catch({}),
  quiz: z.array(z.number().int().min(0).max(3)).max(5).catch([]),
  sharedResults: z.array(z.string()).max(2000).catch([]),
  reminders: z
    .object({
      action: z.boolean().catch(false),
      fruit: z.boolean().catch(false),
      weekly: z.boolean().catch(false),
      actionTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .catch('21:00'),
      fruitTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .catch('20:00'),
      weeklyTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
        .catch('20:00'),
      weekday: z.enum(['0', '1', '2', '3', '4', '5', '6']).catch('0'),
      snoozeUntil: z.string().catch(''),
    })
    .catch({ ...defaults.reminders, weekday: '0' as const }),
});
function restore(): Preferences {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return settingsSchema.parse(value);
  } catch {
    return defaults;
  }
}
let preferences = restore();
const listeners = new Set<() => void>();
export function updatePreferences(patch: Partial<Preferences>) {
  preferences = settingsSchema.parse({ ...preferences, ...patch });
  try {
    localStorage.setItem(key, JSON.stringify(preferences));
  } catch {
    /* Session preferences still work. */
  }
  listeners.forEach((listener) => listener());
}
window.addEventListener('storage', (event) => {
  if (event.key === key) {
    preferences = restore();
    listeners.forEach((listener) => listener());
  }
});
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function usePreferences() {
  return useSyncExternalStore(subscribe, () => preferences);
}
export function projectCategory(
  id: string,
  icon: string,
  value = preferences,
  savedCategory?: string,
) {
  return (
    savedCategory ||
    value.categories[id] ||
    (icon === 'book' ? '学习成长' : ['work', 'video'].includes(icon) ? '工作事业' : '其他')
  );
}
