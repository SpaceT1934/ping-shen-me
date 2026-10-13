import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useGarden } from '../../app/garden-context';
import { PixelIcon } from '../../components/PixelIcon';
import { PageHeading } from '../../components/PageHeading';
import { AmbientScene } from '../../components/AmbientScene';
import { GoalCard } from './components/GoalCard';
import { TaskList } from './components/TaskList';
import { EntryList } from './components/EntryList';
import { ResultsList } from './components/ResultsList';
import { ProjectSettings } from './components/ProjectSettings';
export function ProjectDetailPage() {
  const { id } = useParams();
  const { projects, tasks, entries, results } = useGarden();
  const project = projects.find((item) => item.id === id);
  const [tab, setTab] = useState('计划');
  if (!project)
    return (
      <div className="paper-page">
        <PageHeading title="项目不存在" back="/projects" />
        <Link to="/projects">返回项目列表</Link>
      </div>
    );
  const labels = ['计划', '行动', '灵感', '成果'];
  const counts = [
    tasks.filter((item) => item.projectId === id).length,
    entries.filter((item) => item.projectId === id && item.type === 'action').length,
    entries.filter((item) => item.projectId === id && item.type === 'idea').length,
    results.filter((item) => item.projectId === id).length,
  ];
  return (
    <div className="detail-page">
      <div className="room-banner">
        <AmbientScene indoor />
        <PageHeading title="项目详情" back="/projects" />
        <div className="detail-name">
          <PixelIcon name={project.icon} size={64} />
          <div>
            <h1>{project.name}</h1>
            <p>
              {project.status === 'active'
                ? `已积累 ${project.growth.count} 次行动 · ${project.growth.name}`
                : project.status === 'archived'
                  ? '已归档 · 历史记录仍保留'
                  : '已结束 · 每一步都有意义'}
            </p>
          </div>
        </div>
      </div>
      <div className="detail-paper">
        <GoalCard key={`${project.goalId}-${project.progress}`} project={project} />
        <div className="segment-tabs" role="tablist" aria-label="项目内容">
          {labels.map((label, index) => (
            <button
              role="tab"
              aria-selected={tab === label}
              key={label}
              className={tab === label ? 'selected' : ''}
              onClick={() => setTab(label)}
            >
              {label}({counts[index]})
            </button>
          ))}
        </div>
        {tab === '计划' && (
          <TaskList projectId={project.id} writable={project.status === 'active'} />
        )}
        {(tab === '行动' || tab === '灵感') && (
          <EntryList projectId={project.id} type={tab === '行动' ? 'action' : 'idea'} />
        )}
        {tab === '成果' && <ResultsList projectId={project.id} />}
        <div className="gentle-note">
          <PixelIcon name="mascot" size={58} />
          <p>
            不必每天都很厉害，
            <br />
            愿意行动就已经很棒。
          </p>
        </div>
        <ProjectSettings key={project.name} project={project} />
      </div>
    </div>
  );
}
