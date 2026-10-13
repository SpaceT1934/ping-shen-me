import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useGarden } from '../../../app/garden-context';
import { PixelIcon } from '../../../components/PixelIcon';
import { GoalFields, defaultGoal } from './GoalFields';
import type { ProjectView } from '../../../lib/garden/view-model';
export function GoalCard({ project }: { project: ProjectView }) {
  const { busy, updateProgress, createGoal, results } = useGarden();
  const [value, setValue] = useState(project.progress);
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(() => params.get('newGoal') === '1');
  const [nextGoal, setNextGoal] = useState(defaultGoal);
  const navigate = useNavigate();
  const result = results.find((item) => item.goalId === project.goalId);
  return (
    <section className="goal-card">
      <PixelIcon name={result ? 'golden' : 'green'} size={60} className="goal-apple" />
      <p className="section-kicker">当前目标</p>
      <h2>{project.goal}</h2>
      {project.goalId && (
        <>
          <div className="progress-line">
            <div className="progress-track">
              <span style={{ width: `${project.percent}%` }} />
            </div>
            <strong>
              {project.goalType === 'manual'
                ? project.goalCompleted
                  ? '已达成'
                  : '进行中'
                : `${project.progress}/${project.target}${project.unit}`}
            </strong>
          </div>
          {project.goalCompleted
            ? result && (
                <Link to={`/fruit?result=${result.id}`} className="pending-fruit">
                  {result.harvestedAt ? '查看这颗果实' : '目标达成，收获果实'} →
                </Link>
              )
            : project.status === 'active' && (
                <details className="goal-edit">
                  <summary>更新目标进度</summary>
                  <form
                    onSubmit={async (event) => {
                      event.preventDefault();
                      const feedback = await updateProgress(
                        project.goalId!,
                        project.goalType === 'manual' ? 1 : value,
                      );
                      if (feedback?.resultIds[0])
                        navigate(`/fruit?result=${feedback.resultIds[0]}`);
                    }}
                  >
                    {project.goalType !== 'manual' && (
                      <label>
                        {project.goalType === 'percentage' ? '当前百分比' : '已完成数量'}
                        <input
                          aria-label="已完成数量"
                          type="number"
                          min="0"
                          max={project.target}
                          step={project.goalType === 'count' ? '1' : '0.1'}
                          value={value}
                          onChange={(event) => setValue(Number(event.target.value))}
                          required
                        />
                      </label>
                    )}
                    <button className="mini-button" disabled={busy}>
                      {project.goalType === 'manual' ? '确认目标已经达成' : '保存进度'}
                    </button>
                  </form>
                </details>
              )}
        </>
      )}
      {project.status === 'active' && (
        <>
          <button className="text-button" onClick={() => setEditing(!editing)}>
            {editing
              ? '取消'
              : project.goalId && !project.goalCompleted
                ? '替换当前目标'
                : '设置新目标'}
          </button>
          {editing && (
            <form
              className="goal-create-form"
              onSubmit={async (event) => {
                event.preventDefault();
                if (await createGoal(project.id, nextGoal, Boolean(project.goalId))) {
                  setParams({}, { replace: true });
                  setEditing(false);
                  setNextGoal(defaultGoal);
                }
              }}
            >
              <GoalFields value={nextGoal} onChange={setNextGoal} />
              {project.goalId && !project.goalCompleted && (
                <p className="small-print">保存会将当前目标转为历史目标，已有记录保留。</p>
              )}
              <button
                className="outline-button full-width"
                disabled={busy || !nextGoal.title.trim()}
              >
                保存目标
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
