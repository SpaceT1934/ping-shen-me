import { useActionFeedback } from '../../lib/garden/use-action-feedback';
import { Link } from 'react-router-dom';
import { goalPercent } from '@apple/domain';
import { useGarden } from '../../app/garden-context';
import { LineIcon, PixelIcon } from '../../components/PixelIcon';
import { LivingMascot } from '../../components/AmbientScene';
import { PixelTree, GoalFruit, FruitBasket } from '../../components/GardenVisuals';
export function HomePage() {
  const { projects, entries, results, state } = useGarden();
  const encouragement = useActionFeedback(
    state.version,
    entries.some((item) => item.type === 'action'),
  );
  const active = projects.filter((item) => item.status === 'active');
  const pending = results.filter((item) => !item.harvestedAt);
  const today = new Date().toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  return (
    <div className="garden-home forest-home">
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
      <p className="forest-date">{today}</p>
      <div className="forest-greeting">
        <LivingMascot size={66} />
        <div className="speech-bubble">
          <small>苹什猫</small>
          <p>
            {pending.length
              ? `有 ${pending.length} 颗红果成熟了，等你亲手摘下。`
              : active.length
                ? encouragement.data?.text || '一点点努力都值得记下，果实按目标的进度慢慢成熟。'
                : '每一个方向，都值得被照顾。先种下想开始的一件事吧。'}
          </p>
        </div>
      </div>
      <div className="forest-section-heading">
        <h1>
          我的小树林 <small>{active.length} 个方向</small>
        </h1>
        <Link to="/seed">＋ 种新树</Link>
      </div>
      {pending[0] && (
        <Link className="forest-ripe-notice" to={`/fruit?result=${pending[0].id}`}>
          有成熟果实，去摘下 →
        </Link>
      )}
      <div className="forest-grid" aria-label="每个项目一棵树">
        {active.map((project) => {
          const onTree = project.goals.filter(
            (goal) => !results.some((result) => result.goalId === goal.id && result.harvestedAt),
          );
          return (
            <article className="forest-tree-card" key={project.id}>
              <Link className="forest-tree-link" to={`/projects/${project.id}`}>
                <span className="forest-tree-stage">{project.growth.name}</span>
                <div className="forest-tree-art">
                  <PixelTree stage={project.growth.stageIndex} />
                  <span className="branch-fruits">
                    {onTree.slice(0, 3).map((goal) => (
                      <GoalFruit key={goal.id} percent={goalPercent(goal)} size={31} />
                    ))}
                  </span>
                </div>
                <h2 className="wood-label">{project.name}</h2>
                <p>
                  {project.goalId
                    ? `${project.goal} · ${Math.round(project.percent)}%`
                    : '给这棵树设一个目标'}
                </p>
                <small>
                  {onTree.length} 颗目标果实 · {project.growth.count} 次行动
                </small>
              </Link>
              <Link className="forest-basket-link" to={`/projects/${project.id}?tab=basket`}>
                <FruitBasket count={project.growth.harvestCount} />
                <span>我的果篮 →</span>
              </Link>
            </article>
          );
        })}
        {!active.length && (
          <Link to="/seed" className="forest-empty">
            <PixelTree stage={0} />
            <strong>＋ 种下第一个成长方向</strong>
            <p>一件想做的事，就是一棵树的开始。</p>
          </Link>
        )}
      </div>
      <div className="forest-footer">
        <Link className="quick-record" to="/records">
          <span className="mic-circle">
            <LineIcon name="mic" size={25} />
          </span>
          <span>说一说 / 写下今天的努力</span>
          <LineIcon name="arrow" size={20} />
        </Link>
        <p className="today-summary">
          已记录 {entries.filter((item) => item.type === 'action').length} 次行动 · 收获{' '}
          {results.filter((item) => item.harvestedAt).length} 颗果实
        </p>
      </div>
    </div>
  );
}
