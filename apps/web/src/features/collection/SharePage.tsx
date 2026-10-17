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
  const save = async (share: boolean) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await document.fonts.ready;
      await document.fonts.load(
        '40px JournalHand',
        `${day}${weekday}${quote}${result?.title || ''}${project?.name || prefs.name}小行动，也能长成大梦想用天次收获这颗果实今天完成了个小任务苹什么每一步都算数`,
      );
      const canvas = document.createElement('canvas');
      canvas.width = 780;
      canvas.height = 1320;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('当前浏览器不能生成图片');
      context.fillStyle = {
        garden: '#fffcf5',
        night: '#e5e9f4',
        sea: '#e7f3ef',
        sunset: '#fff0df',
      }[theme];
      context.fillRect(0, 0, 780, 1320);
      const [background, mascot, sun, leaf] = await Promise.all(
        ['forest-background', 'mascot-cheer', 'sun', 'leaf-falling'].map((name) =>
          image(`/assets/figma21/${name}.webp`),
        ),
      );
      drawArt(context, background!, 30, 250, 720, 350, true);
      drawArt(context, mascot!, 285, 365, 210, 180);
      drawArt(context, sun!, 52, 275, 50, 50);
      drawArt(context, leaf!, 674, 330, 40, 40);
      context.fillStyle = '#4a2c1e';
      context.textAlign = 'center';
      context.font = '64px JournalHand';
      context.fillText(day, 390, 100);
      context.font = '30px JournalHand';
      context.fillText(weekday, 390, 155);
      context.fillText('苹什么 · 每一步，都算数', 390, 211);
      context.font = '40px JournalHand';
      ['每一次认真行动，', '都在让理想的自己', '更靠近一点。'].forEach((line, index) =>
        context.fillText(line, 390, 680 + 48 * index),
      );
      let y = 824;
      context.font = '30px JournalHand';
      y = wrap(context, result?.title || project?.name || prefs.name, y + 24, 650);
      wrap(
        context,
        result
          ? `用 ${result.days} 天、${result.actionCount} 次行动，收获这颗果实。`
          : `今天完成了 ${completedTasks} 个小任务。`,
        y + 18,
        650,
      );
      context.fillStyle = '#807b72';
      context.font = '28px JournalHand';
      context.fillText('小行动，也能长成大梦想', 390, 1250);
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
        <div className="share-date">{day}</div>
        <p>{weekday}</p>
        <div className="share-illustration">
          <Illustration name="mascot-cheer" size={145} />
          <span className="share-decoration-sun">
            <Illustration name="sun" size={34} />
          </span>
          <span className="share-decoration-leaf">
            <Illustration name="leaf-falling" size={28} />
          </span>
        </div>
        <h2>
          每一次认真行动，
          <br />
          都在让理想的自己
          <br />
          更靠近一点。
        </h2>
        <p>{result?.title || project?.name || prefs.name}</p>
        <p>
          {result
            ? `${result.days} 天，${result.actionCount} 次行动，收获一颗果实。`
            : `今天完成了 ${completedTasks} 个小任务。`}
        </p>
        <p>每一步，都算数。</p>
        <small>苹什么 · 用行动，养大每一棵树</small>
      </div>
      <div className="share-theme-choices" aria-label="日签主题">
        {(['garden', 'sea', 'sunset', 'night'] as const).map((item, index) => (
          <button key={item} aria-pressed={theme === item} onClick={() => setTheme(item)}>
            <Illustration name={`theme-${item}`} size={60} />
            <span>{['花园', '海边', '日落', '夜晚'][index]}</span>
          </button>
        ))}
      </div>
      <div className="button-row share-actions">
        <button className="outline-button" disabled={busy} onClick={() => void save(false)}>
          保存图片
        </button>
        <button className="coral-button" disabled={busy} onClick={() => void save(true)}>
          分享日签
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
