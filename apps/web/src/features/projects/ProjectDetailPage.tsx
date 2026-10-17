import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useGarden } from '../../app/garden-context';
import { ArtIcon, Illustration, LineIcon } from '../../components/Illustration';
import { PageHeading } from '../../components/PageHeading';
import { GoalCard } from './components/GoalCard';
import { TaskList } from './components/TaskList';
import { EntryList } from './components/EntryList';
import { ResultsList } from './components/ResultsList';
import { ProjectSettings } from './components/ProjectSettings';
import { ProjectTree } from '../../components/GardenVisuals';
import { growthStages } from '@apple/domain';
export function ProjectDetailPage() {
  const { id } = useParams();
  const { projects, tasks, entries, results } = useGarden();
  const project = projects.find((item) => item.id === id);
  const [params] = useSearchParams();
  const [tab, setTab] = useState(() =>
    params.get('tab') === 'basket' ? '果篮' : params.get('tab') === 'tasks' ? '计划' : '行动',
  );
  if (!project)
    return (
      <div className="paper-page">
        <PageHeading title="项目不存在" back="/projects" />
        <Link to="/projects">返回项目列表</Link>
      </div>
    );
  const labels = ['计划', '行动', '灵感', '目标建议', '果篮'];
  const counts = [
    tasks.filter((item) => item.projectId === id).length,
    entries.filter((item) => item.projectId === id && item.type === 'action').length,
    entries.filter((item) => item.projectId === id && item.type === 'idea').length,
    entries.filter((item) => item.projectId === id && item.type === 'goal').length,
    results.filter((item) => item.projectId === id && item.harvestedAt).length,
  ];
  return (
    <div className="detail-page">
      <div className="room-banner">
        <Link className="icon-button detail-back" to="/projects" aria-label="返回">
          <LineIcon name="back" size={20} />
        </Link>
        <div className="detail-name">
          <div>
            <h1>{project.name}</h1>
            <p>
              {project.status === 'active'
                ? `已收获 ${project.growth.harvestCount} 颗果实 · ${project.growth.name}`
                : project.status === 'paused'
                  ? '暂缓中 · 随时可以继续成长'
                  : project.status === 'archived'
                    ? '已归档 · 历史记录仍保留'
                    : '已结束 · 每一步都有意义'}
            </p>
            <a
              className="outline-button detail-edit"
              href="#project-settings"
              onClick={() => document.getElementById('project-settings')?.setAttribute('open', '')}
            >
              编辑
            </a>
          </div>
          <span className="detail-hero-tree">
            <Illustration
              name={
                ['tree-seedling', 'tree-large-green', 'tree-large-full', 'tree-large-red'][
                  project.growth.stageIndex
                ]!
              }
              size={155}
            />
          </span>
        </div>
      </div>
      <div className="detail-paper">
        <p className="section-kicker">当前阶段：{project.growth.name}</p>
        <div className="tree-stage-gallery" aria-label="成长阶段">
          {growthStages.map((stage, index) => (
            <div key={stage.name} className={project.growth.stageIndex === index ? 'current' : ''}>
              <ProjectTree stage={index} size={64} />
              <strong>{stage.name}</strong>
              <small>
                {index === 3
                  ? `${index * project.growth.threshold}+`
                  : `${index * project.growth.threshold}–${(index + 1) * project.growth.threshold - 1}`}{' '}
                颗
              </small>
            </div>
          ))}
        </div>
        <p className="small-print">
          每亲手收获 {project.growth.threshold}{' '}
          颗果实，小树长大一阶段。行动可以浇水，目标达成才会结果。
        </p>
        <div className="fig-links">
          <Link to={`/goals?project=${project.id}`}>目标清单 →</Link>
          <Link to={`/projects/${project.id}/plan`}>AI 拆任务 →</Link>
          <Link to="/timeline">成长时间线 →</Link>
        </div>
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
        {(tab === '行动' || tab === '灵感' || tab === '目标建议') && (
          <EntryList
            projectId={project.id}
            type={tab === '行动' ? 'action' : tab === '目标建议' ? 'goal' : 'idea'}
          />
        )}
        {tab === '果篮' && <ResultsList projectId={project.id} />}
        <div className="gentle-note">
          <ArtIcon name="mascot" size={58} />
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
