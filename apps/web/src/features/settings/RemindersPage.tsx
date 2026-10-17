import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SceneHeading, Toggle } from '../../design/components';
import { Illustration } from '../../components/Illustration';
import { updatePreferences, usePreferences, type Preferences } from '../../lib/preferences';
import { HomePage } from '../home/HomePage';
import { useGarden } from '../../app/garden-context';
import { dateInZone } from '@apple/domain';
export function RemindersPage() {
  const prefs = usePreferences();
  const [permission, setPermission] = useState('');
  const update = (patch: Partial<Preferences['reminders']>) =>
    updatePreferences({ reminders: { ...prefs.reminders, ...patch } });
  return (
    <div>
      <SceneHeading title="提醒设置" mascot="mascot-wink">
        我会温柔地提醒你，
        <br />
        记得照顾自己的小树～
      </SceneHeading>
      <div className="fig-paper">
        {(['action', 'fruit', 'weekly'] as const).map((key, index) => (
          <section className="fig-card reminder-card" key={key}>
            <div className="fig-setting-row">
              <Illustration
                name={['remind-tree', 'remind-fruit', 'remind-calendar'][index]!}
                size={60}
              />
              <Toggle
                label={['每日行动提醒', '成熟果实提醒', '每周成长报告'][index]!}
                checked={prefs.reminders[key]}
                onChange={(checked) => update({ [key]: checked })}
              />
            </div>
            <p className="small-print">
              {
                [
                  '每天留一点时间，记录今天的小行动。',
                  '有果子成熟时，提醒你来摘下。',
                  '每周一起回顾，看看小树的变化。',
                ][index]
              }
            </p>
            {key === 'weekly' && (
              <label>
                提醒日期
                <select
                  value={prefs.reminders.weekday}
                  onChange={(event) => update({ weekday: event.target.value })}
                >
                  {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((label, day) => (
                    <option key={day} value={day}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              提醒时间
              <input
                type="time"
                value={prefs.reminders[`${key}Time`]}
                onChange={(event) => update({ [`${key}Time`]: event.target.value })}
                required
              />
            </label>
          </section>
        ))}
        <button
          className="outline-button full-width"
          onClick={async () => {
            if (!('Notification' in window)) {
              setPermission('当前浏览器支持页面内提醒，暂不支持系统通知。');
              return;
            }
            try {
              const result = await Notification.requestPermission();
              setPermission(
                result === 'granted'
                  ? '已开启：页面保持打开时，可收到系统提醒。'
                  : '继续使用页面内提醒，你可以稍后在浏览器设置中开启通知。',
              );
            } catch {
              setPermission('系统通知暂不可用，页面内提醒仍然有效。');
            }
          }}
        >
          开启浏览器通知
        </button>
        <p className="small-print" role="status">
          {permission || '提醒会在打开本页面时检查；当前版本暂不支持关闭网页后的后台推送。'}
        </p>
        <Link to="/reminders/preview" className="text-button">
          预览未行动提醒 →
        </Link>
      </div>
    </div>
  );
}
export function InactiveReminderPage() {
  const prefs = usePreferences();
  const { entries, projects } = useGarden();
  const [today] = useState(() => dateInZone(new Date()));
  const dates = entries.filter((item) => item.type === 'action').map((item) => item.date);
  const latest =
    [...(dates.length ? dates : projects.map((project) => dateInZone(project.createdAt)))]
      .sort()
      .at(-1) || today;
  const days = Math.max(0, Math.floor((Date.parse(today) - Date.parse(latest)) / 86400000));
  const dialog = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <div className="inactive-reminder-screen">
      <HomePage />
      <dialog
        ref={dialog}
        className="inactive-dialog fig-card"
        aria-labelledby="inactive-title"
        onCancel={(event) => {
          event.preventDefault();
          navigate('/');
        }}
      >
        <Illustration name="mascot-sad" size={115} />
        <h2 id="inactive-title">别让果子等太久呀！</h2>
        <p>
          {days >= 3 ? `已经 ${days} 天没有记录了，` : '每一个小行动，都值得记下来，'}
          <br />
          小树和果子都在想你呢～
          <br />
          今天也来种下一点进步吧！
        </p>
        <Link className="coral-button full-width" to="/records">
          记录今天的小行动 →
        </Link>
        <Link
          className="outline-button full-width"
          to="/"
          onClick={() =>
            updatePreferences({
              reminders: {
                ...prefs.reminders,
                snoozeUntil: new Date(Date.now() + 3 * 86400000).toISOString(),
              },
            })
          }
        >
          再想想
        </Link>
      </dialog>
    </div>
  );
}
