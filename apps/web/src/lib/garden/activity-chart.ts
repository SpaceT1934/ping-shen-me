import type { Entry } from '@apple/contracts';
/** Presentation buckets use the server's exact reporting interval and saved action timestamps. */
export function activityBuckets(records: Entry[], startAt: string | null, endAt: string) {
  const end = Date.parse(endAt);
  const actions = records
    .filter((item) => !item.deletedAt && item.type === 'action')
    .map((item) => Date.parse(item.occurredAt || `${item.date}T00:00:00+08:00`))
    .filter((at) => at < end);
  const start = startAt
    ? Date.parse(startAt)
    : actions.length
      ? Math.min(...actions)
      : end - 7 * 86400000;
  const days = Math.max(1, Math.ceil((end - start) / 86400000));
  const count = Math.min(7, days);
  return Array.from({ length: count }, (_, index) => {
    const from = start + Math.floor((index * days) / count) * 86400000;
    const to = Math.min(end, start + Math.floor(((index + 1) * days) / count) * 86400000);
    return {
      from,
      to,
      label: new Date(from).toLocaleDateString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: 'numeric',
        day: 'numeric',
      }),
      count: actions.filter((at) => at >= from && at < to).length,
    };
  });
}
