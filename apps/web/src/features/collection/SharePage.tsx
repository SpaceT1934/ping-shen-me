import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useGarden } from '../../app/garden-context';
import { PageHeading } from '../../components/PageHeading';
import { Illustration } from '../../components/Illustration';
import { usePreferences, updatePreferences } from '../../lib/preferences';
import { dateInZone } from '@apple/domain';

function image(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const value = new Image();
    value.onload = () => resolve(value);
    value.onerror = reject;
    value.src = source;
  });
}
function drawArt(
  context: CanvasRenderingContext2D,
  bitmap: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  cover = false,
) {
  if (cover) {
    const scale = Math.max(width / bitmap.width, height / bitmap.height);
    const sourceWidth = width / scale,
      sourceHeight = height / scale;
    context.drawImage(
      bitmap,
      (bitmap.width - sourceWidth) / 2,
      (bitmap.height - sourceHeight) / 2,
      sourceWidth,
      sourceHeight,
      x,
      y,
      width,
      height,
    );
  } else {
    const scale = Math.min(width / bitmap.width, height / bitmap.height);
    context.drawImage(
      bitmap,
      x + (width - bitmap.width * scale) / 2,
      y + (height - bitmap.height * scale) / 2,
      bitmap.width * scale,
      bitmap.height * scale,
    );
  }
}
function wrap(
  context: CanvasRenderingContext2D,
  value: string,
  y: number,
  width: number,
  maxLines = 4,
) {
  let line = '';
  const lines: string[] = [];
  for (const char of value) {
    if (context.measureText(line + char).width > width) {
      lines.push(line);
      line = '';
    }
    line += char;
  }
  lines.push(line);
  lines
    .slice(0, maxLines)
    .forEach((text, index) =>
      context.fillText(
        index === maxLines - 1 && lines.length > maxLines ? text.slice(0, -1) + '…' : text,
        390,
        y + index * 48,
      ),
    );
  return y + Math.min(lines.length, maxLines) * 48;
}
export function SharePage() {
  const { results, projects, tasks } = useGarden();
  const prefs = usePreferences();
  const [params] = useSearchParams();
  const result = results.find((item) => item.id === params.get('result') && item.harvestedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [openedAt] = useState(() => Date.now());
  const [theme, setTheme] = useState(prefs.theme);
  const date = new Date(result?.harvestedAt || openedAt);
  const day = date.toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: 'numeric',
  });
  const weekday = date.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', weekday: 'long' });
  const project = projects.find((item) => item.id === result?.projectId);
  const completedTasks = tasks.filter(
    (task) =>
      task.completedAt &&
      dateInZone(task.completedAt) === dateInZone(date) &&
      (!project || task.projectId === project.id),
  ).length;
  const quote = '每一次认真行动，都在让理想的自己更靠近一点。';
  const summaryTitle = result
    ? `用 ${result.days} 天，收获一颗果实`
    : `今天完成了 ${completedTasks} 个小任务`;
  const summaryDetail = `${project?.name || prefs.name} · ${result?.title || '每一步，都算数'}`;
  const backgroundName = theme === 'garden' ? 'welcome-background' : `theme-${theme}`;
  const save = async (share: boolean) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await document.fonts.ready;
      await document.fonts.load(
        '40px JournalHand',
        `${day}${weekday}${quote}${summaryTitle}${summaryDetail}小行动，也能长成大梦想用天次收获这颗果实今天完成了个小任务苹什么每一步都算数`,
      );
      const canvas = document.createElement('canvas');
      canvas.width = 780;
      canvas.height = 1060;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('当前浏览器不能生成图片');
      context.fillStyle = '#fff8e9';
      context.fillRect(0, 0, 780, 1060);
      const [background, mascot, sun, leaf, sprout] = await Promise.all(
        [backgroundName, 'mascot-cheer', 'sun', 'leaf-falling', 'sprout'].map((name) =>
          image(`/assets/figma21/${name}.webp`),
        ),
      );
      drawArt(context, background!, 28, 30, 724, 936, true);
      drawArt(context, mascot!, 320, 530, 240, 224);
      if (theme === 'garden') {
        drawArt(context, sun!, 480, 55, 86, 90);
        drawArt(context, leaf!, 495, 365, 69, 61);
      }
      context.fillStyle = theme === 'night' ? '#fff8e9' : '#4a2c1e';
      context.textAlign = 'left';
      context.font = '64px JournalHand';
      context.fillText(day, 96, 165);
      context.font = '38px JournalHand';
      context.fillText(weekday, 106, 225);
      context.font = '40px JournalHand';
      ['每一次认真行动，', '都在让理想的自己', '更靠近一点。'].forEach((line, index) =>
        context.fillText(line, 100, 335 + 58 * index),
      );
      context.fillStyle = '#fffcf5';
      context.beginPath();
      if (typeof context.roundRect === 'function') context.roundRect(94, 788, 566, 158, 24);
      else context.rect(94, 788, 566, 158);
      context.fill();
      drawArt(context, sprout!, 112, 834, 64, 64);
      context.fillStyle = '#807b72';
      context.textAlign = 'center';
      context.font = '28px JournalHand';
      wrap(context, summaryTitle, 842, 420, 1);
      wrap(context, summaryDetail, 900, 420, 1);
      context.fillText('苹什么 · 小行动，也能长成大梦想', 390, 1020);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error('生成失败，请重试'))),
          'image/png',
        ),
      );
      const file = new File([blob], '苹什么-成长日签.png', { type: 'image/png' });
      if (share && navigator.canShare?.({ files: [file] }))
        await navigator.share({ files: [file], title: '我的成长日签' });
      else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      if (result && !prefs.sharedResults.includes(result.id))
        updatePreferences({ sharedResults: [...prefs.sharedResults, result.id] });
      setMessage(
        share && navigator.canShare?.({ files: [file] })
          ? '日签已分享。'
          : '日签图片已生成，可在下载中查看。',
      );
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError'))
        setError(cause instanceof Error ? cause.message : '生成失败，请重试');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="paper-page">
      <PageHeading title="日签分享" back="/collection" />
      <div className={`fig-share-card share-theme-${theme}`}>
        <div
          className="share-poster"
          style={{ backgroundImage: `url('/assets/figma21/${backgroundName}.webp')` }}
        >
          <div className="share-date">{day}</div>
          <p className="share-weekday">{weekday}</p>
          <h2 className="share-quote">
            每一次认真行动，
            <br />
            都在让理想的自己
            <br />
            更靠近一点。
          </h2>
          <span className="share-poster-mascot">
            <Illustration name="mascot-cheer" size={120} />
          </span>
          {theme === 'garden' && (
            <>
              <span className="share-decoration-sun">
                <Illustration name="sun" size={43} />
              </span>
              <span className="share-decoration-leaf">
                <Illustration name="leaf-falling" size={35} />
              </span>
            </>
          )}
          <div className="share-summary">
            <Illustration name="sprout" size={34} />
            <div>
              <p>{summaryTitle}</p>
              <p title={summaryDetail}>{summaryDetail}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="share-theme-choices" aria-label="日签主题">
        {(['garden', 'sea', 'sunset', 'night'] as const).map((item, index) => (
          <button key={item} aria-pressed={theme === item} onClick={() => setTheme(item)}>
            <Illustration name={`theme-${item}`} size={60} />
            <span>{['花园', '海边', '日落', '夜晚'][index]}</span>
          </button>
        ))}
      </div>
      <div className="share-actions">
        <button className="coral-button full-width" disabled={busy} onClick={() => void save(true)}>
          保存并分享
        </button>
        <button className="text-button full-width" disabled={busy} onClick={() => void save(false)}>
          仅保存图片
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {message && (
        <p role="status" className="small-print">
          {message}
        </p>
      )}
      <Link className="text-button" to="/collection">
        返回果实收藏
      </Link>
    </div>
  );
}
