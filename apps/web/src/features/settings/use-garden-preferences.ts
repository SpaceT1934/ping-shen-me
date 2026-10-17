import { useEffect, useState } from 'react';
import { useGarden } from '../../app/garden-context';
import { usePreferences } from '../../lib/preferences';
import { dateInZone } from '@apple/domain';
export function useGardenPreferences() {
  const prefs = usePreferences();
  const { entries, projects, results } = useGarden();
  const [clock, setClock] = useState(() => Date.now());
  const [notice, setNotice] = useState<{ text: string; to: string } | null>(null);
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = prefs.followSystem
        ? media.matches
          ? 'night'
          : 'garden'
        : prefs.theme;
      document.documentElement.dataset.motion = prefs.motion ? 'on' : 'off';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [prefs.theme, prefs.followSystem, prefs.motion]);
  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      const now = new Date();
      setClock(now.getTime());
      const today = dateInZone(now);
      const currentTime = now.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Shanghai',
        hour: '2-digit',
        minute: '2-digit',
      });
      const todayActions = entries.some((item) => item.type === 'action' && item.date === today);
      const pending = results.find((item) => !item.harvestedAt);
      const weekday = new Date(`${today}T12:00:00+08:00`).getUTCDay();
      const options = [
        {
          key: 'action',
          enabled: prefs.reminders.action && !todayActions,
          time: prefs.reminders.actionTime,
          text: '今天的小树等你来浇水，记下一件小行动吧～',
          to: '/records',
        },
        {
          key: 'fruit',
          enabled: prefs.reminders.fruit && Boolean(pending),
          time: prefs.reminders.fruitTime,
          text: '有一颗果子成熟了，来亲手摘下吧～',
          to: `/fruit?result=${pending?.id || ''}`,
        },
        {
          key: 'weekly',
          enabled: prefs.reminders.weekly && String(weekday) === prefs.reminders.weekday,
          time: prefs.reminders.weeklyTime,
          text: '这一周的小进步，已经长成了成长报告～',
          to: '/reports',
        },
      ];
      for (const option of options) {
        const key = `apple-reminder:${today}:${option.key}`;
        let sent = false;
        try {
          sent = sessionStorage.getItem(key) === 'sent';
        } catch {
          /* In-page reminder remains available. */
        }
        if (!option.enabled || !option.time || currentTime < option.time || sent) continue;
        setNotice({ text: option.text, to: option.to });
        try {
          sessionStorage.setItem(key, 'sent');
        } catch {
          /* No persistent notification identifier. */
        }
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const message = new Notification('苹什么', {
              body: option.text,
              icon: '/assets/figma21/avatar-apple.webp',
              tag: key,
            });
            message.onclick = () => {
              window.focus();
              window.location.assign(option.to);
              message.close();
            };
          } catch {
            /* Mobile browsers may only support ServiceWorker notifications. */
          }
        }
        break;
      }
    };
    tick();
    const interval = setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [prefs.reminders, entries, results]);
  const lastAction = entries
    .filter((item) => item.type === 'action')
    .map((item) => Date.parse(`${item.date}T12:00:00+08:00`));
  const latest = lastAction.length
    ? Math.max(...lastAction)
    : projects.length
      ? Math.max(...projects.map((item) => Date.parse(item.createdAt)))
      : clock;
  const inactive =
    projects.some((item) => item.status === 'active') &&
    clock - latest >= 3 * 86400000 &&
    !(Date.parse(prefs.reminders.snoozeUntil) > clock);
  return {
    notice:
      notice ||
      (inactive && prefs.recommendations
        ? { text: '小树想你啦，今天也从一件小事开始吧～', to: '/reminders/preview' }
        : null),
    dismiss: () => setNotice(null),
  };
}
