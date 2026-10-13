import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGarden } from '../../app/garden-context';
import { LineIcon, PixelIcon } from '../../components/PixelIcon';
import { AmbientScene, LivingMascot } from '../../components/AmbientScene';
export function HomePage() {
  const { projects, entries, results } = useGarden();
  const [page, setPage] = useState(0);
  const active = projects.filter((item) => item.status === 'active');
  const pages = Math.max(1, Math.ceil(active.length / 4));
  const current = Math.min(page, pages - 1);
  const pending = results.filter((item) => !item.harvestedAt);
  return (
    <div className="garden-home">
      <AmbientScene />
      <header className="garden-header">
        <Link to="/settings" className="avatar" aria-label="我的">
          <PixelIcon name="mascot" size={42} />
        </Link>
        <Link to="/welcome" className="garden-brand">
          <PixelIcon name="apple" size={25} />
          <span>苹什么</span>
        </Link>
        <Link to="/reports" className="calendar-button" aria-label="成长报告">
          <PixelIcon name="calendar" size={34} />
        </Link>
      </header>
      <Link className="demo-tag" to="/projects">
        我的成长树 · {active.length} 个方向
      </Link>
      <div className="speech-bubble home-bubble">
        {active.length ? (
          <>
            今天也辛苦了！
            <br />
            一点点努力，也会让它长大 <span className="tiny-leaf">✦</span>
          </>
        ) : (
          <>
            每一个方向，都值得被照顾。
            <br />
            先种下你想开始的一件事吧。
          </>
        )}
      </div>
      {active.length ? (
        <div className="tree-projects" aria-label="树上的项目">
          {active.slice(current * 4, current * 4 + 4).map((project, index) => (
            <Link
              className={`tree-node tree-node-${index}`}
              to={`/projects/${project.id}`}
              key={project.id}
            >
              <span className="wood-label">{project.name}</span>
              <PixelIcon
                name={project.goalCompleted ? 'golden' : 'green'}
                size={project.goalCompleted ? 90 : project.growth.size}
              />
              <small className="node-growth-label">
                {project.goalCompleted ? '果实成熟' : project.growth.name} · {project.growth.count}{' '}
                次
              </small>
            </Link>
          ))}
        </div>
      ) : (
        <Link to="/seed" className="empty-garden-cta wood-label">
          ＋ 种下第一个方向
        </Link>
      )}
      {pages > 1 && (
        <div className="tree-pager" aria-label="项目翻页">
          {Array.from({ length: pages }, (_, index) => (
            <button
              key={index}
              aria-label={`第${index + 1}组项目`}
              aria-pressed={current === index}
              className={current === index ? 'selected' : ''}
              onClick={() => setPage(index)}
            />
          ))}
        </div>
      )}
      {pending[0] && (
        <Link className="harvest-notice" to={`/fruit?result=${pending[0].id}`}>
          有 {pending.length} 颗果实成熟了，去收获 →
        </Link>
      )}
      <div className="garden-bottom">
        <div className="mascot-ground">
          <LivingMascot size={97} />
        </div>
        <div className="garden-caption">一边做很多事，一边慢慢长大。</div>
        <Link className="quick-record" to="/records">
          <span className="mic-circle">
            <LineIcon name="record" size={25} />
          </span>
          <span>记下今天做过的一点努力…</span>
          <LineIcon name="arrow" size={20} />
        </Link>
        <p className="today-summary">
          已记录 {entries.filter((item) => item.type === 'action').length} 次努力 <span>·</span>{' '}
          {active.length} 个成长方向
        </p>
      </div>
    </div>
  );
}
