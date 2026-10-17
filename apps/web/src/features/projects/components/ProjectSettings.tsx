import { useState } from 'react';
import { useGarden } from '../../../app/garden-context';
import type { ProjectView } from '../../../lib/garden/view-model';
import { categories, projectCategory, usePreferences } from '../../../lib/preferences';
export function ProjectSettings({ project }: { project: ProjectView }) {
  const { editProject, setProjectStatus, setTreeThreshold, busy } = useGarden();
  const [name, setName] = useState(project.name);
  const prefs = usePreferences();
  return (
    <details className="project-settings" id="project-settings">
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
            maxLength={200}
            required
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button className="outline-button" disabled={busy || !name.trim()}>
          保存名称
        </button>
      </form>
      <label>
        成长分类
        <select
          value={projectCategory(project.id, project.icon, prefs, project.category)}
          disabled={busy}
          onChange={(event) =>
            void editProject(
              project.id,
              project.name,
              project.icon,
              project.color,
              event.target.value,
            )
          }
        >
          {categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
          {!categories.some((category) => category === project.category) && project.category && (
            <option>{project.category}</option>
          )}
        </select>
      </label>
      <label>
        小树每升一阶段所需收获数
        <select
          aria-label="成长阈值"
          disabled={busy}
          value={project.growth.threshold}
          onChange={(event) =>
            void setTreeThreshold(project.id, Number(event.target.value) as 1 | 2 | 3)
          }
        >
          <option value="3">3 颗（新版默认）</option>
          <option value="2">2 颗</option>
          <option value="1">1 颗</option>
        </select>
      </label>
      <p className="small-print">归档只隐藏项目，历史记录和报告会保留。</p>
      <div className="form-actions">
        {project.status === 'active' ? (
          <>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void setProjectStatus(project.id, 'paused')}
            >
              暂缓项目
            </button>
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
