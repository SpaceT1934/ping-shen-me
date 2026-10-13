import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gardenApi } from '../../lib/garden/garden-api';
import { useGarden } from '../../app/garden-context';
import { PixelIcon } from '../../components/PixelIcon';
import { PageHeading } from '../../components/PageHeading';
export function ReportsPage() {
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
  return (
    <div className="paper-page reports-page">
      <PageHeading title="我的成长报告" />
      <div className="segment-tabs report-periods" role="tablist" aria-label="报告时间范围">
        {(['7天', '30天', '本月', '全部'] as const).map((label) => (
          <button
            key={label}
            role="tab"
            aria-selected={period === label}
            className={period === label ? 'selected' : ''}
            onClick={() => setPeriod(label)}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="report-banner">
        <p>
          {report.actions.length ? (
            <>
              这段时间你做了 {report.actions.length} 件事，
              <br />
              照顾了 {report.activeCount} 个成长方向。
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
        <PixelIcon name="mascot" size={76} />
      </section>
      <div className="report-stats">
        <div>
          <PixelIcon name="apple" size={35} />
          <span>行动次数</span>
          <strong>
            {report.actions.length}
            <small> 次</small>
          </strong>
        </div>
        <div>
          <PixelIcon name="green" size={35} />
          <span>活跃方向</span>
          <strong>
            {report.activeCount}
            <small> 个</small>
          </strong>
        </div>
        <div>
          <PixelIcon name="golden" size={35} />
          <span>新成果</span>
          <strong>
            {report.resultCount}
            <small> 个</small>
          </strong>
        </div>
      </div>
      <section className="report-projects">
        <h2>各项目进展</h2>
        <p className="small-print">
          进度条为当前目标，右侧为本周期累计进度变化；历史项目也会保留。
        </p>
        {projects.map((project) => {
          const row = report.projects.find((item) => item.projectId === project.id)!;
          return (
            <div className="report-project-row" key={project.id}>
              <PixelIcon name={project.icon} size={33} />
              <span>
                {project.name}
                {project.status !== 'active' && (
                  <small className="history-status">
                    {project.status === 'archived' ? '归档' : '结束'}
                  </small>
                )}
              </span>
              <strong>{row.count} 次</strong>
              <div className="progress-track">
                <span style={{ width: `${project.percent}%` }} />
              </div>
              <small>
                {row.delta > 0 ? '+' : ''}
                {Math.round(row.delta)}%
              </small>
            </div>
          );
        })}
        {!projects.length && <p className="empty-copy">种下方向后，这里会展示你的成长。</p>}
      </section>
      <section className="recent-section">
        <h2>值得记住的小进步</h2>
        {[...report.actions]
          .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
          .slice(0, 3)
          .map((item) => (
            <div className="recent-row" key={item.id}>
              <span className="entry-dot" />
              <p>{item.content}</p>
              <small>{item.date.slice(5)}</small>
            </div>
          ))}
        {!report.actions.length && <p className="empty-copy">这里会留下你的真实行动。</p>}
      </section>
      <p className="report-ending">每一步，都算数。</p>
    </div>
  );
}
