import { useState } from 'react';
import { useGarden } from '../../../app/garden-context';
import type { ProjectView } from '../../../lib/garden/view-model';
export function ProjectSettings({ project }: { project: ProjectView }) {
  const { editProject, setProjectStatus, busy } = useGarden();
  const [name, setName] = useState(project.name);
  return (
    <details className="project-settings">
      <summary>项目设置</summary>
      <form
        className="editor-form"
        onSubmit={async (event) => {
          event.preventDefault();
          await editProject(project.id, name.trim(), project.icon, project.color);
        }}
      >
        <label>
          项目名称
          <input
            aria-label="项目名称"
            value={name}
            maxLength={100}
            required
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button className="outline-button" disabled={busy || !name.trim()}>
          保存名称
        </button>
      </form>
      <p className="small-print">归档只隐藏项目，历史记录和报告会保留。</p>
      <div className="form-actions">
        {project.status === 'active' ? (
          <>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void setProjectStatus(project.id, 'archived')}
            >
              归档项目
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void setProjectStatus(project.id, 'completed')}
            >
              结束项目
            </button>
          </>
        ) : (
          <button
            className="outline-button"
            disabled={busy}
            onClick={() => void setProjectStatus(project.id, 'active')}
          >
            恢复进行中
          </button>
        )}
      </div>
    </details>
  );
}
