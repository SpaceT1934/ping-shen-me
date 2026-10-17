import { useState } from 'react';
import { gardenApi } from '../../lib/garden/garden-api';
import { Link } from 'react-router-dom';
import { useGarden } from '../../app/garden-context';
import { LineIcon, ArtIcon } from '../../components/Illustration';
import { PageHeading } from '../../components/PageHeading';
import { Filters, Metrics, Toggle } from '../../design/components';
import { usePreferences, updatePreferences } from '../../lib/preferences';
export function SettingsPage() {
  const { projects, entries, results } = useGarden();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [period, setPeriod] = useState('全部');
  const prefs = usePreferences();
  const now = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  const inPeriod = (date: string) =>
    period === '全部' || date.startsWith(now.slice(0, period === '本月' ? 7 : 4));
  const exportData = async () => {
    setExporting(true);
    setExportError('');
    try {
      const data = await gardenApi.exportData();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `苹什么_记录_${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError('导出暂时失败，请稍后重试。');
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="paper-page settings-page">
      <PageHeading
        title="我的"
        action={
          <Link to="/preferences" aria-label="偏好设置">
            <LineIcon name="settings" />
          </Link>
        }
      />
      <div className="profile-card">
        <img
          className="journal-art profile-avatar"
          src="/assets/figma21/avatar-apple.webp"
          width="88"
          height="88"
          alt="小苹果头像"
        />
        <h2>{prefs.name || '小苹果'}</h2>
        <p>{prefs.tagline}</p>
        <span className="profile-badge">成长手帐 · 匿名体验</span>
      </div>
      <Filters options={['全部', '本月', '今年']} value={period} onChange={setPeriod} />
      <Metrics
        items={[
          {
            label: '成长方向',
            value: projects.filter((item) => inPeriod(item.createdAt)).length,
            icon: 'sprout',
          },
          {
            label: '累计熟果',
            value: results.filter((item) => inPeriod(item.completedAt)).length,
            icon: 'apple-stat',
          },
          {
            label: '完成目标',
            value: results.filter((item) => inPeriod(item.completedAt)).length,
            icon: 'crown',
          },
          {
            label: '行动天数',
            value: new Set(
              entries
                .filter((item) => item.type === 'action' && inPeriod(item.date))
                .map((item) => item.date),
            ).size,
            icon: 'calendar',
          },
        ]}
      />
      <section className="fig-card">
        <h2>我的小树</h2>
        {projects
          .filter((item) => item.status === 'active')
          .map((project) => (
            <Link className="profile-project-row" key={project.id} to={`/projects/${project.id}`}>
              <ArtIcon name={project.icon} size={35} />
              <span>
                {project.name}
                <div className="progress-track">
                  <span style={{ width: `${project.percent}%` }} />
                </div>
              </span>
              <small>{project.growth.harvestCount} 颗</small>
            </Link>
          ))}
        {!projects.some((item) => item.status === 'active') && (
          <Link to="/seed">种下我的第一棵树 →</Link>
        )}
      </section>
      <div className="fig-links">
        <Link to="/collection">果实收藏 →</Link>
        <Link to="/timeline">成长时间线 →</Link>
        <Link to="/quiz">小树测试 →</Link>
      </div>
      <div className="settings-list">
        <Link to="/reminders">
          <LineIcon name="settings" />
          提醒设置
          <LineIcon name="arrow" size={18} />
        </Link>
        <Link to="/preferences">
          <LineIcon name="settings" />
          偏好设置
          <LineIcon name="arrow" size={18} />
        </Link>
        <Link to="/">
          <LineIcon name="home" />
          我的树
          <LineIcon name="arrow" size={18} />
        </Link>
        <Link to="/reports">
          <LineIcon name="review" />
          数据与报告
          <LineIcon name="arrow" size={18} />
        </Link>
        <Link to="/welcome">
          <ArtIcon name="apple" size={27} />
          关于苹什么
          <LineIcon name="arrow" size={18} />
        </Link>
      </div>
      <section className="fig-card">
        <Toggle
          label="界面动态效果"
          icon="speaker"
          checked={prefs.motion}
          onChange={(motion) => updatePreferences({ motion })}
        />
        <Toggle
          label="成长建议"
          icon="sprout"
          checked={prefs.recommendations}
          onChange={(recommendations) => updatePreferences({ recommendations })}
        />
      </section>
      <section className="experience-note">
        <h3>记录与数据</h3>
        {projects.some((item) => ['media', 'ielts', 'intern', 'practice'].includes(item.id)) && (
          <p>已保留旧版体验数据，其中可能包含早期示例项目，可按需编辑和归档。</p>
        )}
        <p>项目、记录、成长与成果都会自动保存。</p>
        <p>
          暂不支持跨设备登录。换浏览器或清除浏览数据后，会打开新的花园；原有记录仍然保留。建议定期导出备份。
        </p>
        <button
          className="outline-button full-width"
          disabled={exporting}
          onClick={() => void exportData()}
        >
          {exporting ? '正在导出…' : '导出我的记录'}
        </button>
        {exportError && <p role="alert">{exportError}</p>}
        <p className="small-print">
          树苗期 → 成长中 → 茁壮成长 → 硕果累累。新版默认每手动收获 3
          颗果实升级一次，各棵树独立计算。
        </p>
      </section>
      <p className="settings-footer">
        苹什么 <span>·</span> 把努力种成一棵树
      </p>
    </div>
  );
}
