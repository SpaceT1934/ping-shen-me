import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGarden } from '../../app/garden-context';
import { Illustration } from '../../components/Illustration';
import { Filters, SceneHeading } from '../../design/components';

export function TimelinePage() {
  const { projects, entries, results } = useGarden();
  const [filter, setFilter] = useState('全部');
  const events = [
    ...projects.map((item) => ({
      key: `p-${item.id}`,
      at: item.createdAt,
      kind: '种树',
      icon: 'sprout',
      text: `种下了「${item.name}」`,
      projectId: item.id,
    })),
    ...entries
      .filter((item) => item.type === 'action')
      .map((item) => ({
        key: `a-${item.id}`,
        at: item.occurredAt || `${item.date}T12:00:00+08:00`,
        kind: '记录',
        icon: 'nav-tree',
        text: item.content,
        projectId: item.projectId,
      })),
    ...results.map((item) => ({
      key: `m-${item.id}`,
      at: item.completedAt,
      kind: '里程碑',
      icon: 'crown',
      text: `达成了「${item.title}」`,
      projectId: item.projectId,
    })),
    ...results
      .filter((item) => item.harvestedAt)
      .map((item) => ({
        key: `r-${item.id}`,
        at: item.harvestedAt!,
        kind: '摘果',
        icon: 'fruit-red',
        text: `摘下了「${item.title}」`,
        projectId: item.projectId,
      })),
  ]
    .filter((item) => filter === '全部' || item.kind === filter)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const groups = new Map<string, typeof events>();
  for (const item of events) {
    const day = new Date(item.at).toLocaleDateString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    groups.set(day, [...(groups.get(day) || []), item]);
  }
  return (
    <div>
      <SceneHeading title="成长时间线">
        回头看看，
        <br />
        原来已经走了这么远～
      </SceneHeading>
      <div className="fig-paper">
        <Filters
          options={['全部', '种树', '记录', '摘果', '里程碑']}
          value={filter}
          onChange={setFilter}
        />
        {[...groups].map(([day, items]) => (
          <section key={day}>
            <h2 className="timeline-date">{day}</h2>
            {items.map((item) => (
              <div className="fig-timeline-item" key={item.key}>
                <time>
                  {new Date(item.at).toLocaleTimeString('zh-CN', {
                    timeZone: 'Asia/Shanghai',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
                <Illustration name={item.icon} size={27} />
                <Link
                  className="fig-card"
                  to={item.projectId ? `/projects/${item.projectId}` : '/records'}
                >
                  <p>{item.text}</p>
                  <small>{item.kind}</small>
                </Link>
              </div>
            ))}
          </section>
        ))}
        {!events.length && (
          <p className="empty-copy">这个时间线还没有记录，今天就可以留下第一步。</p>
        )}
      </div>
    </div>
  );
}
