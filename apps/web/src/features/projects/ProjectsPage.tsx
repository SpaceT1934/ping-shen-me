import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGarden } from '../../app/garden-context';
import { PixelIcon, LineIcon } from '../../components/PixelIcon';
import { PageHeading } from '../../components/PageHeading';
export function ProjectsPage() {
  const { projects } = useGarden();
  const [status, setStatus] = useState('active');
  const [search, setSearch] = useState('');
  const visible = projects.filter(
    (item) =>
      item.status === status && item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <div className="paper-page">
      <PageHeading title="我的成长方向" />
      <div className="page-intro">
        <p className="eyebrow">每一种努力，都有自己的枝丫</p>
        <h2>正在慢慢长大的事</h2>
        <p>不用一次走很远，今天向前一点就好。</p>
      </div>
      <div className="segment-tabs" role="tablist" aria-label="项目状态">
        {[
          ['active', '进行中'],
          ['completed', '已结束'],
          ['archived', '已归档'],
        ].map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={status === value}
            className={status === value ? 'selected' : ''}
            onClick={() => setStatus(value!)}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        className="search-input"
        aria-label="搜索项目"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="找一个成长方向…"
      />
      <div className="project-list">
        {visible.map((project) => (
          <Link className="project-card" key={project.id} to={`/projects/${project.id}`}>
            <div className="project-card-top">
              <span className={`project-icon ${project.color}`}>
                <PixelIcon name={project.icon} size={48} />
              </span>
              <div>
                <h3>{project.name}</h3>
                <p>{project.goal}</p>
              </div>
              <LineIcon name="arrow" size={18} />
            </div>
            {project.goalId && (
              <div className="progress-line">
                <div className="progress-track">
                  <span style={{ width: `${project.percent}%` }} />
                </div>
                <span>{Math.round(project.percent)}%</span>
              </div>
            )}
            <div className="project-meta">
              <span>
                {project.growth.count} 次行动 · {project.growth.harvestCount} 颗收获
              </span>
              <span>
                {project.growth.name}
                <span className="little-dot" />
              </span>
            </div>
          </Link>
        ))}
        {!visible.length && (
          <p className="empty-copy">这里还没有方向。可以先种下一个，或换个筛选看看。</p>
        )}
      </div>
      <Link to="/seed" className="outline-button full-width">
        <LineIcon name="plus" size={18} />
        种下一个新方向
      </Link>
      <div className="gentle-note">
        <PixelIcon name="mascot" size={48} />
        <p>
          每一条人生线程，
          <br />
          都值得被好好照顾。
        </p>
      </div>
    </div>
  );
}
