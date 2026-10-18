import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { Goal } from '@apple/contracts';
import { goalPercent } from '@apple/domain';
import { useGarden } from '../../../app/garden-context';
import { GoalFruit } from '../../../components/GardenVisuals';
import { GoalFields, defaultGoal } from './GoalFields';
import type { ProjectView } from '../../../lib/garden/view-model';
function GoalItem({ goal, project }: { goal: Goal; project: ProjectView }) {
  const { busy, updateProgress, results, setPrimaryGoal } = useGarden();
  const [draft, setDraft] = useState<{ base: number; value: number } | null>(null);
  const value = draft?.base === goal.currentValue ? draft.value : goal.currentValue;
  const navigate = useNavigate();
  const result = results.find((item) => item.goalId === goal.id);
  const percent = goalPercent(goal);
  return (
    <article id={`goal-${goal.id}`} className="goal-card target-goal">
      <GoalFruit percent={percent} size={58} />
      <p className="section-kicker">
        {project.goalId === goal.id ? '主要目标' : '阶段目标'}
        {result?.harvestedAt ? ' · 已收入果篮' : goal.completedAt ? ' · 已成熟' : ''}
      </p>
      <h2>{goal.title}</h2>
      <div className="progress-line">
        <div className="progress-track">
          <span style={{ width: `${percent}%` }} />
        </div>
        <strong>
          {goal.type === 'manual'
            ? goal.completedAt
              ? '已达成'
              : '待确认达成'
            : `${goal.currentValue}/${goal.target}${goal.unit}`}
        </strong>
      </div>
      {goal.completedAt
        ? result && (
            <Link to={`/fruit?result=${result.id}`} className="pending-fruit">
              {result.harvestedAt ? '查看这颗果实' : '摘下这颗果实'} →
            </Link>
          )
        : project.status === 'active' && (
            <>
              {project.goalId !== goal.id && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void setPrimaryGoal(project.id, goal.id)}
                >
                  设为主要目标
                </button>
              )}
              <details className="goal-edit">
                <summary>更新目标进度</summary>
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const feedback = await updateProgress(
                      goal.id,
                      goal.type === 'manual' ? 1 : value,
                    );
                    if (feedback?.resultIds[0]) navigate(`/fruit?result=${feedback.resultIds[0]}`);
                  }}
                >
                  {goal.type !== 'manual' && (
                    <label>
                      {goal.type === 'percentage' ? '当前百分比' : '已完成数量'}
                      <input
                        aria-label={`已完成数量：${goal.title}`}
                        type="number"
                        min="0"
                        max={goal.target}
                        step={goal.type === 'count' ? 1 : 0.1}
                        value={value}
                        onChange={(event) =>
                          setDraft({ base: goal.currentValue, value: Number(event.target.value) })
                        }
                        required
                      />
                    </label>
                  )}
                  <button className="mini-button" disabled={busy}>
                    {goal.type === 'manual' ? '确认目标已经达成' : '确认并保存进度'}
                  </button>
                </form>
              </details>
            </>
          )}
    </article>
  );
}
export function GoalCard({ project }: { project: ProjectView }) {
  const { busy, createGoal } = useGarden();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(() => params.get('newGoal') === '1');
  const [nextGoal, setNextGoal] = useState(defaultGoal);
  const active = project.goals.filter((goal) => !goal.completedAt);
  const ripe = project.goals.filter((goal) => goal.completedAt);
  const onTreeIds = new Set(project.fruits.map((fruit) => fruit.goalId));
  const onTree = project.goals.filter((goal) => onTreeIds.has(goal.id));
  const harvested = ripe.filter((goal) => !onTreeIds.has(goal.id));
  return (
    <section id="project-goals" className="project-goals">
      <div className="goal-section-title">
        <h2>这棵树的目标</h2>
        <small>一个目标，一颗苹果</small>
      </div>
      {onTree.map((goal) => (
        <GoalItem key={goal.id} goal={goal} project={project} />
      ))}
      {!active.length && (
        <p className="small-print">
          {ripe.length
            ? '这一阶段已经完成，可以再种下一颗目标果实。'
            : '给这个方向设一个小目标，让努力有处安放。'}
        </p>
      )}
      {project.status === 'active' && (
        <>
          <button className="outline-button full-width" onClick={() => setEditing(!editing)}>
            {editing ? '取消添加' : '＋ 添加一个阶段目标'}
          </button>
          {editing && (
            <form
              className="goal-create-form"
              onSubmit={async (event) => {
                event.preventDefault();
                if (await createGoal(project.id, nextGoal, false)) {
                  setParams({}, { replace: true });
                  setEditing(false);
                  setNextGoal(defaultGoal);
                }
              }}
            >
              <GoalFields value={nextGoal} onChange={setNextGoal} />
              <button className="dark-button full-width" disabled={busy || !nextGoal.title.trim()}>
                种下目标苹果
              </button>
            </form>
          )}
        </>
      )}
      {harvested.length > 0 && (
        <details className="completed-goals">
          <summary>已摘取的目标 · {harvested.length}</summary>
          {harvested.map((goal) => (
            <GoalItem key={goal.id} goal={goal} project={project} />
          ))}
        </details>
      )}
    </section>
  );
}
