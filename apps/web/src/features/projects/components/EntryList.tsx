import { useState } from 'react';
import { useGarden } from '../../../app/garden-context';
import type { Entry } from '@apple/contracts';
function EntryEditor({ entry, close }: { entry: Entry; close: () => void }) {
  const { projects, editEntry, busy } = useGarden();
  const [content, setContent] = useState(entry.content);
  const [date, setDate] = useState(entry.date);
  const [projectId, setProjectId] = useState(entry.projectId || '');
  const [type, setType] = useState(entry.type);
  const [contribution, setContribution] = useState(entry.contribution);
  return (
    <form
      className="editor-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (
          await editEntry(
            entry.id,
            content,
            projectId || null,
            type,
            date,
            type === 'action' ? contribution : 0,
          )
        )
          close();
      }}
    >
      <label>
        记录内容
        <textarea
          aria-label="编辑记录内容"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={2000}
          required
        />
      </label>
      <div className="form-grid">
        <label>
          记录分类
          <select
            aria-label="编辑记录分类"
            value={type}
            onChange={(event) => setType(event.target.value as Entry['type'])}
          >
            <option value="action">行动</option>
            <option value="idea">灵感</option>
          </select>
        </label>
        <label>
          发生日期
          <input
            aria-label="编辑发生日期"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>
      </div>
      <label>
        关联方向
        <select
          aria-label="编辑关联方向"
          value={projectId}
          onChange={(event) => {
            setProjectId(event.target.value);
            setContribution(0);
          }}
        >
          <option value="">未归类</option>
          {projects
            .filter((item) => item.status === 'active' || item.id === entry.projectId)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </label>
      {type === 'action' && (
        <label>
          贡献目标数量（不推进填 0）
          <input
            aria-label="编辑目标贡献"
            type="number"
            min="0"
            value={contribution}
            onChange={(event) => setContribution(Number(event.target.value))}
          />
        </label>
      )}
      <div className="form-actions">
        <button className="outline-button" disabled={busy || !content.trim()}>
          保存修改
        </button>
        <button type="button" className="text-button" onClick={close}>
          取消
        </button>
      </div>
    </form>
  );
}
export function EntryList({ projectId, type }: { projectId?: string; type?: 'action' | 'idea' }) {
  const { entries, projects, busy, deleteEntry } = useGarden();
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const items = entries
    .filter((item) => (!projectId || item.projectId === projectId) && (!type || item.type === type))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  return (
    <div className="entry-list">
      {items.map((item) => (
        <div key={item.id}>
          <article className="entry-row">
            <span className="entry-dot" />
            <div className="entry-content">
              <p>{item.content}</p>
              <small>
                {item.date} ·{' '}
                {projects.find((project) => project.id === item.projectId)?.name || '未归类'} ·{' '}
                {item.type === 'action' ? '行动' : '灵感'}
                {item.sourceTaskId ? ' · 来自任务' : ''}
              </small>
            </div>
            {!item.sourceTaskId && (
              <button className="text-button" onClick={() => setEditing(item.id)}>
                编辑
              </button>
            )}
            {!item.sourceTaskId && (
              <button
                className="text-button"
                aria-label={`删除记录${item.content}`}
                onClick={() => setRemoving(item.id)}
              >
                ×
              </button>
            )}
          </article>
          {editing === item.id && <EntryEditor entry={item} close={() => setEditing(null)} />}
          {removing === item.id && (
            <div className="inline-confirm">
              删除后会调整成长次数，已达成果保留。
              <button
                disabled={busy}
                className="text-button"
                onClick={async () => {
                  if (await deleteEntry(item.id)) setRemoving(null);
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
      {!items.length && <p className="empty-copy">这里会留下你的行动与灵感。</p>}
    </div>
  );
}
