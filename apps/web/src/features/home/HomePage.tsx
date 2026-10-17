import { Link } from 'react-router-dom';
import { goalPercent } from '@apple/domain';
import { useActionFeedback } from '../../lib/garden/use-action-feedback';
import { useGarden } from '../../app/garden-context';
import { LineIcon, Illustration } from '../../components/Illustration';
import { LivingMascot } from '../../components/AmbientScene';
import { ProjectTree, GoalFruit, FruitBasket } from '../../components/GardenVisuals';
export function HomePage() {
  const { projects, entries, results, state } = useGarden();
  const active = projects.filter((item) => item.status === 'active');
  const pending = results.filter((item) => !item.harvestedAt);
  const encouragement = useActionFeedback(
    state.version,
    entries.some((item) => item.type === 'action'),
  );
  return (
    <div className="forest-home">
      <header className="forest-heading">
        <div>
          <p className="journal-date">
            {new Date().toLocaleDateString('zh-CN', {
              timeZone: 'Asia/Shanghai',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </p>
          <h1>
            <Illustration name="sprout" size={28} />
            我的树林
          </h1>
          <p>
            这里是我用行动养成的树林～
            <br />
            每一棵树，都在慢慢长大。
          </p>
        </div>
        <Link to="/reports" className="forest-report" aria-label="成长报告">
          <Illustration name="nav-chart" size={26} />
        </Link>
      </header>
      <div className="forest-companion">
        <div className="speech-bubble">
          <small>苹什猫</small>
          <p>
            {pending.length
              ? `有 ${pending.length} 颗红果成熟了，等你亲手摘下。`
              : encouragement.data?.text || '每一步都算数，继续照顾你想做的事吧～'}
          </p>
        </div>
        <LivingMascot size={104} mood="wink" />
      </div>
      {pending[0] && (
        <Link className="forest-ripe-notice" to={`/fruit?result=${pending[0].id}`}>
          <Illustration name="fruit-red" size={23} /> 有成熟果实，去摘下{' '}
          <LineIcon name="arrow" size={17} />
        </Link>
      )}
      <div className="forest-grid" aria-label="每个项目一棵树">
        {active.map((project) => {
          const onTree = project.goals.filter(
            (goal) => !results.some((result) => result.goalId === goal.id && result.harvestedAt),
          );
          return (
            <article
              className={`forest-tree-card forest-stage-${project.growth.stageIndex}`}
              key={project.id}
            >
              <Link className="forest-tree-link" to={`/projects/${project.id}`}>
                <h2 className="wood-label">{project.name}</h2>
                <div className="forest-tree-art">
                  <ProjectTree stage={project.growth.stageIndex} size={190} />
                  <span className="branch-fruits">
                    {onTree.slice(0, 3).map((goal) => (
                      <GoalFruit key={goal.id} percent={goalPercent(goal)} size={32} />
                    ))}
                  </span>
                </div>
                <div className="forest-progress-note">
                  <strong>{project.growth.name}</strong>
                  <span>{project.goalId ? `${Math.round(project.percent)}%` : '还没有目标'}</span>
                  <div className="progress-track">
                    <span style={{ width: `${project.percent}%` }} />
                  </div>
                  <small>{project.goalId ? project.goal : '给小树种下一颗目标苹果'}</small>
                </div>
              </Link>
              <Link className="forest-basket-link" to={`/projects/${project.id}?tab=basket`}>
                <FruitBasket count={project.growth.harvestCount} />
                <span>
                  果篮 <LineIcon name="arrow" size={13} />
                </span>
              </Link>
            </article>
          );
        })}
        <Link to="/seed" className="plant-new-tree">
          <Illustration name="tree-sprout" size={90} />
          <strong>＋ 种下一棵新树</strong>
          <span>
            每个想做的事
            <br />
            都值得慢慢养大
          </span>
        </Link>
      </div>
      <div className="forest-footer">
        <Link className="quick-record" to="/records">
          <span className="mic-circle">
            <LineIcon name="mic" size={22} />
          </span>
          <span>说说今天做了什么…</span>
          <LineIcon name="arrow" size={19} />
        </Link>
        <p>
          已记录 {entries.filter((item) => item.type === 'action').length} 次行动 · 收获{' '}
          {results.filter((item) => item.harvestedAt).length} 颗果实
        </p>
      </div>
    </div>
  );
}
