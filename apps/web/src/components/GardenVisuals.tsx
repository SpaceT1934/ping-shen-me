import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { fruitColorMix, fruitStage, type TreeFruit } from '@apple/domain';
import { Illustration } from './Illustration';
export function GoalFruit({ percent, size = 40 }: { percent: number; size?: number }) {
  const progress = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const stage = fruitStage(progress);
  const mix = fruitColorMix(progress);
  const labels = ['青苹果', '青绿苹果', '黄绿苹果', '橙红苹果', '红苹果已成熟'];
  return (
    <span
      className={`goal-fruit maturity-${stage}`}
      style={
        {
          width: size,
          height: size,
          '--fruit-amber': mix.amber,
          '--fruit-red': mix.red,
        } as CSSProperties
      }
      role="img"
      aria-label={`${labels[stage]}，进度 ${Math.floor(progress * 10) / 10}%`}
    >
      <span className="fruit-base">
        <Illustration name="goal-apple-green" size={size} />
      </span>
      <span className="fruit-amber">
        <Illustration name="goal-apple-amber" size={size} />
      </span>
      <span className="fruit-red">
        <Illustration name="goal-apple-red" size={size} />
      </span>
    </span>
  );
}
const fruitSlots = [
  [30, 39],
  [68, 40],
  [49, 53],
  [17, 55],
  [82, 55],
  [49, 30],
  [32, 67],
  [66, 67],
];
export function ProjectTree({
  stage,
  size = 150,
  fruits = [],
  harvestCount,
  threshold = 3,
  interactive = false,
  onPick,
  pickResultId,
  picking = false,
  goalBasePath = '',
}: {
  stage: number;
  size?: number;
  fruits?: TreeFruit[];
  harvestCount?: number;
  threshold?: number;
  interactive?: boolean;
  onPick?: (resultId: string) => void;
  pickResultId?: string;
  picking?: boolean;
  goalBasePath?: string;
}) {
  const level = Math.min(3, Math.max(0, stage));
  const scale =
    0.68 + Math.min(3, harvestCount === undefined ? level : harvestCount / threshold) * 0.1067;
  const summary = `${fruits.length} 颗目标苹果，其中 ${fruits.filter((fruit) => fruit.percent >= 100 && fruit.resultId).length} 颗成熟待摘`;
  const displayFruits = pickResultId
    ? [...fruits].sort(
        (a, b) => Number(b.resultId === pickResultId) - Number(a.resultId === pickResultId),
      )
    : fruits;
  return (
    <span
      className={`project-tree tree-stage-${level}`}
      style={{ width: size, height: size, '--tree-scale': scale } as CSSProperties}
    >
      <span
        className="project-tree-layers"
        role={interactive ? 'group' : 'img'}
        aria-label={summary}
      >
        <Illustration name="tree-fruitless" size={size} className="project-tree-base" />
        {displayFruits.slice(0, fruitSlots.length).map((fruit, index) => {
          const ready = fruit.percent >= 100 && Boolean(fruit.resultId);
          const label = `${fruit.title}，${ready ? '红苹果成熟，点击摘取' : `进度 ${Math.floor(fruit.percent * 10) / 10}%，尚未成熟`}`;
          const style = { left: `${fruitSlots[index]![0]}%`, top: `${fruitSlots[index]![1]}%` };
          const apple = <GoalFruit percent={fruit.percent} size={Math.max(18, size * 0.2)} />;
          return interactive ? (
            ready && onPick && fruit.resultId === pickResultId ? (
              <button
                type="button"
                key={fruit.goalId}
                className="tree-goal-apple is-ripe"
                style={style}
                aria-label={label}
                title={label}
                disabled={picking}
                onClick={() => onPick(fruit.resultId!)}
              >
                {apple}
              </button>
            ) : ready ? (
              <Link
                key={fruit.goalId}
                className="tree-goal-apple is-ripe"
                style={style}
                aria-label={label}
                title={label}
                to={`/fruit?result=${fruit.resultId}`}
              >
                {apple}
              </Link>
            ) : (
              <a
                key={fruit.goalId}
                className="tree-goal-apple"
                style={style}
                aria-label={label}
                title={label}
                href={`${goalBasePath}#goal-${fruit.goalId}`}
                onClick={(event) => {
                  if (goalBasePath) return;
                  const target = document.getElementById(`goal-${fruit.goalId}`);
                  if (target) {
                    event.preventDefault();
                    window.scrollTo({
                      top: window.scrollY + target.getBoundingClientRect().top - 16,
                      behavior: 'instant',
                    });
                  }
                }}
              >
                {apple}
              </a>
            )
          ) : (
            <span
              key={fruit.goalId}
              className={`tree-goal-apple ${ready ? 'is-ripe' : ''}`}
              style={style}
              title={label}
            >
              {apple}
            </span>
          );
        })}
        {fruits.length > fruitSlots.length &&
          (interactive ? (
            <a
              className="tree-more-apples"
              href={`${goalBasePath}#project-goals`}
              aria-label={`查看全部 ${fruits.length} 颗目标苹果`}
            >
              +{fruits.length - fruitSlots.length}
            </a>
          ) : (
            <span className="tree-more-apples" title={summary}>
              +{fruits.length - fruitSlots.length}
            </span>
          ))}
      </span>
    </span>
  );
}
export function TreeGrowth({
  harvestCount,
  threshold,
  stageIndex,
}: {
  harvestCount: number;
  threshold: number;
  stageIndex: number;
}) {
  const completed = stageIndex >= 3;
  const current = completed ? threshold : harvestCount % threshold;
  return (
    <div className="tree-growth-progress" aria-label="摘果成长进度">
      <span>
        {completed
          ? `小树已长成，累计收获 ${harvestCount} 颗`
          : `本阶段成长 ${current}/${threshold} · 再摘 ${threshold - current} 颗升级`}
      </span>
      <div
        className="progress-track"
        role="progressbar"
        aria-label="小树阶段成长"
        aria-valuemin={0}
        aria-valuemax={threshold}
        aria-valuenow={current}
      >
        <span style={{ width: `${(current / threshold) * 100}%` }} />
      </div>
    </div>
  );
}
export function FruitBasket({ count }: { count: number }) {
  return (
    <span className="fruit-basket" role="img" aria-label={`果篮，已收获 ${count} 颗`}>
      <span className="basket-art">
        <Illustration name="basket-empty-goals" size={62} />
        {Array.from({ length: Math.min(3, count) }, (_, index) => (
          <span className={`basket-fruit basket-fruit-${index}`} key={index}>
            <Illustration name="goal-apple-red" size={23} />
          </span>
        ))}
        {count > 0 && <Illustration name="basket-empty-goals" size={62} className="basket-front" />}
      </span>
      <strong>{count}</strong>
    </span>
  );
}
