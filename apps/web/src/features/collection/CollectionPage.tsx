import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGarden } from '../../app/garden-context';
import { Illustration } from '../../components/Illustration';
import { Filters, Metrics, SceneHeading } from '../../design/components';
import { projectCategory, usePreferences } from '../../lib/preferences';
export function CollectionPage() {
  const { projects, results } = useGarden();
  const prefs = usePreferences();
  const [filter, setFilter] = useState('全部');
  const harvested = results.filter((item) => item.harvestedAt);
  const shortCategory = (id: string) => {
    const project = projects.find((item) => item.id === id);
    return projectCategory(id, project?.icon || '', prefs, project?.category).slice(0, 2);
  };
  const visible = harvested.filter(
    (item) => filter === '全部' || shortCategory(item.projectId) === filter,
  );
  const month = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 7);
  return (
    <div>
      <SceneHeading title="果实收藏">
        哇！这些都是你努力结出的
        <br />
        果子呀！每一颗都很棒～
      </SceneHeading>
      <div className="fig-paper">
        <Metrics
          items={[
            { label: '已收藏果子', value: harvested.length },
            {
              label: '本月收获',
              value: harvested.filter((item) => item.harvestedAt!.slice(0, 7) === month).length,
            },
            {
              label: '已制作日签',
              value: prefs.sharedResults.filter((id) => harvested.some((item) => item.id === id))
                .length,
            },
          ]}
        />
        <Filters
          options={['全部', '学习', '工作', '生活', '健康', '兴趣', '其他']}
          value={filter}
          onChange={setFilter}
        />
        <div className="fig-collection">
          {visible.map((item) => (
            <article className="fig-card" key={item.id}>
              <Illustration name="apple-stat" size={40} />
              <h2>{item.title}</h2>
              <p>
                {projects.find((project) => project.id === item.projectId)?.name} ·{' '}
                {shortCategory(item.projectId)}
              </p>
              <p>{item.harvestedAt!.slice(0, 10)}</p>
              <p>每一步，都算数。</p>
              <Link className="outline-button full-width" to={`/share?result=${item.id}`}>
                做成日签
              </Link>
            </article>
          ))}
        </div>
        {!visible.length && (
          <p className="empty-copy">还没有收藏的果子。完成目标后，亲手摘下来吧。</p>
        )}
      </div>
    </div>
  );
}
