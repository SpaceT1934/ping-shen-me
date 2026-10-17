import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { dateInZone } from '@apple/domain';
import { useGarden } from '../../app/garden-context';
import { SceneHeading } from '../../design/components';
import { SpeechInput } from '../../components/SpeechInput';
import { aiApi } from '../../lib/ai-api';
export function TaskPlannerPage() {
  const { id = '' } = useParams();
  const { projects, saveEntries, busy } = useGarden();
  const project = projects.find((item) => item.id === id);
  const [text, setText] = useState(project?.goalId ? project.goal : '');
  const [tasks, setTasks] = useState<{ title: string; description: string; selected: boolean }[]>(
    [],
  );
  const [pending, setPending] = useState(false);
  const [voice, setVoice] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const valid =
    tasks.some((item) => item.selected) &&
    tasks
      .filter((item) => item.selected)
      .every((item) => item.title.trim() && item.description.trim());
  if (!project)
    return (
      <div className="paper-page">
        <p>请先选择一个项目。</p>
        <Link to="/projects">返回项目列表</Link>
      </div>
    );
  return (
    <div className="task-planner-page">
      <SceneHeading title="AI 拆任务" back={`/projects/${id}`}>
        <textarea
          aria-label="我想达成的目标"
          maxLength={200}
          rows={3}
          value={text}
          disabled={pending || busy || voice}
          onChange={(event) => {
            setText(event.target.value);
            setTasks([]);
          }}
          placeholder="例如：我想在三个月内考到雅思7分"
        />
        <p className="small-print">{text.length}/200</p>
      </SceneHeading>
      <div className="fig-paper">
        <div className="planner-toolbar">
          <SpeechInput
            disabled={pending || busy}
            onBusyChange={setVoice}
            maxChars={200 - text.length}
            onText={(value) => {
              setText((previous) => previous + value);
              setTasks([]);
            }}
          />
          <button
            className="coral-button full-width"
            disabled={!text.trim() || pending || busy || voice || project.status !== 'active'}
            onClick={async () => {
              setPending(true);
              setError('');
              try {
                const result = await aiApi.plan(id, text);
                setTasks(result.tasks.map((item) => ({ ...item, selected: true })));
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : '暂时无法生成，可以在项目里手动添加任务。',
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? '正在拆成小任务…' : '让 AI 拆成小任务'}
          </button>
        </div>
        <div className="task-plan-list">
          {tasks.map((task, index) => (
            <article className="fig-card" key={index}>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={task.selected}
                  onChange={(event) =>
                    setTasks((items) =>
                      items.map((item, i) =>
                        i === index ? { ...item, selected: event.target.checked } : item,
                      ),
                    )
                  }
                />
                任务 {index + 1}
              </label>
              <input
                aria-label={`任务${index + 1}名称`}
                maxLength={80}
                value={task.title}
                onChange={(event) =>
                  setTasks((items) =>
                    items.map((item, i) =>
                      i === index ? { ...item, title: event.target.value } : item,
                    ),
                  )
                }
              />
              <textarea
                aria-label={`任务${index + 1}说明`}
                rows={2}
                maxLength={110}
                value={task.description}
                onChange={(event) =>
                  setTasks((items) =>
                    items.map((item, i) =>
                      i === index ? { ...item, description: event.target.value } : item,
                    ),
                  )
                }
              />
            </article>
          ))}
        </div>
        {tasks.length > 0 && (
          <button
            className="coral-button full-width"
            disabled={!valid || pending || busy}
            onClick={async () => {
              if (
                await saveEntries(
                  tasks
                    .filter((item) => item.selected)
                    .map((item) => ({
                      content: `${item.title.trim()}：${item.description.trim()}`,
                      projectId: id,
                      type: 'task',
                      date: dateInZone(new Date()),
                      dueDate: null,
                      goalId: null,
                      contribution: 0,
                      goalType: 'manual',
                      target: 1,
                      unit: '',
                      sourceText: text,
                    })),
                  text,
                )
              )
                navigate(`/projects/${id}?tab=tasks`);
            }}
          >
            {busy ? '正在添加…' : '确认，添加这些任务'}
          </button>
        )}
        {error && <p role="alert">{error}</p>}
        <p className="small-print">任务可修改、可取消，只有确认后才会加入你的计划。</p>
      </div>
    </div>
  );
}
