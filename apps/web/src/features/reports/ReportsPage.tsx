import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gardenApi } from '../../lib/garden/garden-api';
import { useGarden } from '../../app/garden-context';
import { ArtIcon, Illustration } from '../../components/Illustration';
import { PageHeading } from '../../components/PageHeading';
import { activityBuckets } from '../../lib/garden/activity-chart';
import { AIReportSummary } from './AIReportSummary';
import { Link } from 'react-router-dom';
import { periodMetrics, periodChange } from '../../lib/garden/report-metrics';
import { usePreferences } from '../../lib/preferences';
export function ReportsPage() {
  const prefs = usePreferences();
  const [period, setPeriod] = useState<'7天' | '30天' | '本月' | '全部'>('7天');
  const { state, projects } = useGarden();
  const query = useQuery({
    queryKey: ['reports', period, state.version],
    queryFn: () => gardenApi.report(period),
  });
  const report = query.data;
  if (!report)
    return (
      <div className="paper-page">
        <PageHeading title="我的成长报告" />
        <p className="empty-copy">
          {query.isError ? '报告暂时无法加载，记录仍然保留。' : '正在整理你的成长数据…'}
        </p>
        {query.isError && (
          <button className="outline-button" onClick={() => void query.refetch()}>
            重试
          </button>
        )}
      </div>
    );
  const buckets = activityBuckets(state.records, report.start_at, report.end_at);
  const peak = Math.max(1, ...buckets.map((item) => item.count));
  const metrics = periodMetrics(state, report.start_at, report.end_at);
  const previous = report.start_at
    ? periodMetrics(
        state,
        new Date(2 * Date.parse(report.start_at) - Date.parse(report.end_at)).toISOString(),
        report.start_at,
      )
    : null;
  const trend = buckets.map((bucket, index) => ({
    x: 15 + (index * 250) / Math.max(1, buckets.length - 1),
    count: state.results.filter(
      (result) =>
        result.harvestedAt &&
        Date.parse(result.harvestedAt) >= bucket.from &&
        Date.parse(result.harvestedAt) < bucket.to,
    ).length,
  }));
  const total = Math.max(1, ...trend.map((item) => item.count));
  return (
    <div className="paper-page reports-page">
      <PageHeading title="生长报告" />
      <div className="fig-links">
        <Link to="/timeline">成长时间线 →</Link>
        <Link to="/collection">果实收藏 →</Link>
      </div>
      <div className="segment-tabs report-periods" role="tablist" aria-label="报告时间范围">
        {(['7天', '30天'] as const).map((label) => (
          <button
            key={label}
            role="tab"
            aria-selected={period === label}
            className={period === label ? 'selected' : ''}
            onClick={() => setPeriod(label)}
          >
            {label === '7天' ? '周报' : '月报'}
          </button>
        ))}
      </div>
      <section className="report-banner">
        <p>
          {report.action_count ? (
            <>
              这段时间你做了 {report.action_count} 件事，
              <br />
              照顾了 {report.active_project_count} 个成长方向。
              <br />
              一点点，也能走很远。
            </>
          ) : (
            <>
              还没有新的行动，
              <br />
              从今天的一件小事开始吧。
            </>
          )}
        </p>
        <ArtIcon name="mascot" size={76} />
      </section>
      <div className="report-stats fig-report-stats">
        {/* 数字始终来自业务统计，AI 仅生成回顾文字。 */}
        {metrics.map((value, index) => (
          <div key={index}>
            <Illustration
              name={['sprout', 'apple-stat', 'tree-green', 'crown'][index]!}
              size={32}
            />
            <span>{['行动次数', '成熟果实', '推进项目', '完成目标'][index]}</span>
            <strong>{value}</strong>
            <small>{previous ? periodChange(value, previous[index]!) : '累计'}</small>
          </div>
        ))}
      </div>
      <section className="journal-chart">
        <h2>
          <Illustration name="sprout" size={24} />
          行动统计
        </h2>
        <div className="activity-bars" aria-label="本周期行动统计">
          {buckets.map((item, index) => (
            <div key={index} title={`${item.label}起：${item.count}次行动`}>
              <strong>{item.count}</strong>
              <span style={{ height: `${(item.count / peak) * 85 + 3}px` }} />
              <small>{item.label}</small>
            </div>
          ))}
        </div>
        <p>按所选周期分段展示，数据来自已保存的行动。</p>
      </section>
      <section className="journal-chart trend-chart">
        <h2>
          <Illustration name="fruit-red" size={22} />
          果实收获趋势
        </h2>
        <svg
          viewBox="0 0 280 95"
          role="img"
          aria-label={`本周期收获 ${trend.reduce((sum, item) => sum + item.count, 0)} 颗果实`}
        >
          <path d="M15 82H265" stroke="#d9ccb5" fill="none" />
          <path
            d={trend
              .map(
                (item, index) => `${index ? 'L' : 'M'}${item.x} ${82 - (item.count / total) * 62}`,
              )
              .join(' ')}
            fill="none"
            stroke="#ee9a84"
            strokeWidth="2.5"
          />
          {trend.map((item, index) => (
            <g key={index}>
              <circle cx={item.x} cy={82 - (item.count / total) * 62} r="4" fill="#f18f7c" />
              <text
                x={item.x}
                y={72 - (item.count / total) * 62}
                textAnchor="middle"
                fill="#997a5d"
                fontSize="10"
              >
                {item.count}
              </text>
            </g>
          ))}
        </svg>
      </section>
      <section className="report-projects">
        {prefs.recommendations && (
          <AIReportSummary
            key={`${period}:${state.version}`}
            period={period}
            version={state.version}
            hasData={Boolean(report.action_count || report.new_result_count)}
          />
        )}
        <h2>各项目进展</h2>
        <p className="small-print">
          进度条显示当前目标进度；行动次数按所选周期统计，历史项目仍保留。
        </p>
        {projects.map((project) => {
          const row = report.projects.find((item) => item.project_id === project.id);
          return (
            <div className="report-project-row" key={project.id}>
              <ArtIcon name={project.icon} size={33} />
              <span>
                {project.name}
                {project.status !== 'active' && (
                  <small className="history-status">
                    {project.status === 'archived'
                      ? '归档'
                      : project.status === 'paused'
                        ? '暂缓'
                        : '完成'}
                  </small>
                )}
              </span>
              <strong>{row?.action_count ?? 0} 次</strong>
              <div className="progress-track">
                <span style={{ width: `${project.percent}%` }} />
              </div>
              <small>
                {project.goalType === 'manual'
                  ? project.goalCompleted
                    ? '已达成'
                    : '进行中'
                  : `${Math.round(project.percent)}%`}
              </small>
            </div>
          );
        })}
        {!projects.length && <p className="empty-copy">种下方向后，这里会展示你的成长。</p>}
      </section>
      <section className="recent-section">
        <h2>值得记住的小进步</h2>
        {[...report.recent_actions]
          .sort(
            (a, b) =>
              b.occurred_at.localeCompare(a.occurred_at) ||
              b.created_at.localeCompare(a.created_at),
          )
          .slice(0, 3)
          .map((item) => (
            <div className="recent-row" key={item.id}>
              <span className="entry-dot" />
              <p>{item.content}</p>
              <small>{item.occurred_at.slice(5, 10)}</small>
            </div>
          ))}
        {!report.action_count && <p className="empty-copy">这里会留下你的真实行动。</p>}
      </section>
      <p className="report-ending">每一步，都算数。</p>
    </div>
  );
}
