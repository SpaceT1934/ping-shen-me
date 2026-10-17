import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { goalPercent } from '@apple/domain';
import { useGarden } from '../../app/garden-context';
import { GoalFruit } from '../../components/GardenVisuals';
import { SceneHeading, Filters } from '../../design/components';

export function GoalsPage() {
  const { state, projects } = useGarden();
  const [params] = useSearchParams();
  const [filter, setFilter] = useState(params.get('project') || '全部');
  const goals = state.goals.filter(
    (goal) => !goal.archivedAt && (filter === '全部' || goal.projectId === filter),
  );
  const render = (completed: boolean) =>
    goals
      .filter((goal) => Boolean(goal.completedAt) === completed)
      .map((goal) => {
        const project = projects.find((item) => item.id === goal.projectId);
        return (
          <Link
            className="fig-card goal-checklist-card"
            to={`/projects/${goal.projectId}`}
            key={goal.id}
          >
            <GoalFruit percent={goalPercent(goal)} size={45} />
            <div>
              <h2>{goal.title}</h2>
              <p>{project?.name}</p>
              <div className="progress-line">
                <div className="progress-track">
                  <span style={{ width: `${goalPercent(goal)}%` }} />
                </div>
                <span>
                  {goal.type === 'manual'
                    ? completed
                      ? '已完成'
                      : '进行中'
                    : `${goal.currentValue}/${goal.target}${goal.unit}`}
                </span>
              </div>
            </div>
          </Link>
        );
      });
  return (
    <div>
      <SceneHeading title="目标清单" back="/projects">
        每一个小目标，
        <br />
        都是一颗正在长大的苹果～
      </SceneHeading>
      <div className="fig-paper">
        <div className="fig-filter" aria-label="按项目筛选目标">
          <button aria-pressed={filter === '全部'} onClick={() => setFilter('全部')}>
            全部
          </button>
          {projects.map((project) => (
            <button
              key={project.id}
              aria-pressed={filter === project.id}
              onClick={() => setFilter(project.id)}
            >
              {project.name}
            </button>
          ))}
        </div>
        <Filters options={['正在成长']} value="正在成长" onChange={() => {}} />
        {render(false)}
        {!goals.some((goal) => !goal.completedAt) && (
          <p className="empty-copy">还没有正在成长的目标，去给小树添一颗苹果吧。</p>
        )}
        <details className="completed-goals">
          <summary>已完成的目标（{goals.filter((goal) => goal.completedAt).length}）</summary>
          {render(true)}
        </details>
        <Link
          className="coral-button full-width"
          to={filter === '全部' ? '/seed' : `/projects/${filter}`}
        >
          添加一个新目标
        </Link>
      </div>
    </div>
  );
}
