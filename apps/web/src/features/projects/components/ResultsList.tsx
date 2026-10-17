import { Link } from 'react-router-dom';
import { useGarden } from '../../../app/garden-context';
import { GoalFruit, FruitBasket } from '../../../components/GardenVisuals';
export function ResultsList({ projectId }: { projectId: string }) {
  const { results } = useGarden();
  const items = results
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const ripe = items.filter((item) => !item.harvestedAt);
  const harvested = items.filter((item) => item.harvestedAt);
  const cards = (list: typeof items) =>
    list.map((item) => (
      <Link className="result-card" key={item.id} to={`/fruit?result=${item.id}`}>
        <GoalFruit percent={100} size={58} />
        <div>
          <h3>{item.title}</h3>
          <p>
            {new Date(item.completedAt).toLocaleDateString('zh-CN')} 达成
            <br />
            用时 {item.days} 天 · {item.actionCount} 次相关行动
          </p>
          <span>
            {item.harvestedAt
              ? `${new Date(item.harvestedAt).toLocaleDateString('zh-CN')} 已收入果篮`
              : '仍在树上，去摘下'}{' '}
            →
          </span>
        </div>
      </Link>
    ));
  return (
    <div className="results-list">
      {ripe.length > 0 && (
        <section className="ripe-results">
          <h3>树上待摘 · {ripe.length}</h3>
          {cards(ripe)}
        </section>
      )}
      <div className="basket-heading">
        <FruitBasket count={harvested.length} />
        <h3>这棵树的果篮</h3>
      </div>
      {cards(harvested)}
      {!harvested.length && (
        <div className="result-empty">
          <GoalFruit percent={0} size={70} />
          <h3>果篮还空着</h3>
          <p>目标达到 100% 后，亲手摘下的果实会一直保存在这里。</p>
        </div>
      )}
    </div>
  );
}
