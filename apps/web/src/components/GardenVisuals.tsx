import { fruitStage } from '@apple/domain';
import { Illustration } from './Illustration';
export function GoalFruit({ percent, size = 40 }: { percent: number; size?: number }) {
  const stage = fruitStage(percent);
  const labels = ['小青果', '青果', '青黄果', '青红果', '红果成熟'];
  return (
    <span
      className={`goal-fruit maturity-${stage}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${labels[stage]}，进度 ${Math.round(percent)}%`}
    >
      <span className="fruit-base">
        <Illustration name={stage === 4 ? 'goal-fruit-red' : 'goal-fruit-green'} size={size} />
      </span>
      {stage === 3 && (
        <span className="fruit-blush">
          <Illustration name="goal-fruit-red" size={size} />
        </span>
      )}
    </span>
  );
}
export function ProjectTree({ stage, size = 150 }: { stage: number; size?: number }) {
  const level = Math.min(3, Math.max(0, stage));
  return (
    <span
      className={`project-tree tree-stage-${level}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Illustration name={level === 0 ? 'tree-sprout' : 'tree-bare'} size={size} />
    </span>
  );
}
export function FruitBasket({ count }: { count: number }) {
  return (
    <span className="fruit-basket" role="img" aria-label={`果篮，已收获 ${count} 颗`}>
      <span className="basket-art">
        <Illustration name="basket-empty" size={62} />
        {count > 0 && (
          <span className="basket-fruit">
            <Illustration name="goal-fruit-red" size={23} />
          </span>
        )}
      </span>
      <strong>{count}</strong>
    </span>
  );
}
