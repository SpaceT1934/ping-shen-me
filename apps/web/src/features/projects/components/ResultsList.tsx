import { Link } from 'react-router-dom';
import { useGarden } from '../../../app/garden-context';
import { PixelIcon } from '../../../components/PixelIcon';
export function ResultsList({ projectId }: { projectId: string }) {
  const { results } = useGarden();
  const items = results
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return (
    <div className="results-list">
      {items.map((item) => (
        <Link className="result-card" key={item.id} to={`/fruit?result=${item.id}`}>
          <PixelIcon name="golden" size={58} />
          <div>
            <h3>{item.title}</h3>
            <p>
              {item.days} 天 · {item.actionCount} 次行动 · {item.ideaCount} 个灵感
            </p>
            <span>{item.harvestedAt ? '已经收获' : '成熟了，等待收获'} →</span>
          </div>
        </Link>
      ))}
      {!items.length && (
        <div className="result-empty">
          <PixelIcon name="green" size={90} />
          <h3>果实正在慢慢酝酿</h3>
          <p>完成当前目标，就能收获一颗新果实。</p>
        </div>
      )}
    </div>
  );
}
