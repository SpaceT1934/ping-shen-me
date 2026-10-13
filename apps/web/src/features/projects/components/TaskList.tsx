import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGarden } from '../../../app/garden-context';
import { LineIcon } from '../../../components/PixelIcon';
export function TaskList({ projectId, writable }: { projectId: string; writable: boolean }) {
  const { tasks, busy, toggleTask, addTask, editTask, deleteTask } = useGarden();
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const navigate = useNavigate();
  const items = tasks.filter((item) => item.projectId === projectId);
  const open = (id: string) => {
    const task = items.find((item) => item.id === id);
    setEditing(id);
    setTitle(task?.title || '');
    setDate(task?.dueDate || '');
  };
  return (
    <div className="task-list">
      {items.map((task) => (
        <div key={task.id}>
          <div className={`task-row ${task.done ? 'done' : ''}`}>
            <label className="task-check">
              <input
                aria-label={`完成${task.title}`}
                type="checkbox"
                checked={task.done}
                disabled={busy || !writable}
                onChange={async () => {
                  const feedback = await toggleTask(task.id);
                  if (feedback && !task.done) navigate('/growth', { state: { feedback } });
                }}
              />
              <span>{task.title}</span>
            </label>
            <small>{task.when}</small>
            {writable && (
              <button
                aria-label={`编辑${task.title}`}
                className="text-button"
                onClick={() => open(task.id)}
              >
                编辑
              </button>
            )}
            {writable && !task.done && (
              <button
                aria-label={`删除${task.title}`}
                className="text-button"
                onClick={() => setRemoving(task.id)}
              >
                ×
              </button>
            )}
          </div>
          {removing === task.id && (
            <div className="inline-confirm">
              删除这个计划？
              <button
                className="text-button"
                disabled={busy}
                onClick={async () => {
                  if (await deleteTask(task.id)) setRemoving(null);
                }}
              >
                确认删除
              </button>
              <button className="text-button" onClick={() => setRemoving(null)}>
                取消
              </button>
            </div>
          )}
        </div>
      ))}
      {!items.length && <p className="empty-copy">还没有计划，写下一件准备做的小事。</p>}
      {editing ? (
        <form
          className="editor-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const saved =
              editing === 'new'
                ? await addTask(projectId, title, date || null)
                : await editTask(editing, title, date || null);
            if (saved) setEditing(null);
          }}
        >
          <label>
            任务名称
            <input
              autoFocus
              aria-label="任务名称"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
            />
          </label>
          <label>
            计划日期
            <input
              aria-label="计划日期"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <div className="form-actions">
            <button className="outline-button" disabled={busy || !title.trim()}>
              保存任务
            </button>
            <button type="button" className="text-button" onClick={() => setEditing(null)}>
              取消
            </button>
          </div>
        </form>
      ) : (
        writable && (
          <button className="outline-button full-width" onClick={() => open('new')}>
            <LineIcon name="plus" size={18} />
            添加任务
          </button>
        )
      )}
    </div>
  );
}
