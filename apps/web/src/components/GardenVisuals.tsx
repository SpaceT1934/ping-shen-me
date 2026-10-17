import { fruitStage } from '@apple/domain';
import { PixelIcon } from './PixelIcon';

/** Fruit colour depends only on confirmed goal progress, independently of tree stage. */
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
        <PixelIcon name={stage === 4 ? 'apple' : 'green'} size={size} />
      </span>
      {stage === 3 && (
        <span className="fruit-blush">
          <PixelIcon name="apple" size={size} />
        </span>
      )}
    </span>
  );
}

/** Code-native pixel trees share the existing warm green and brown palette. */
export function PixelTree({ stage, size = 150 }: { stage: number; size?: number }) {
  const level = Math.min(3, Math.max(0, stage));
  const crowns = [
    [
      [43, 55, 22, 17],
      [62, 44, 21, 18],
    ],
    [
      [30, 32, 57, 41],
      [24, 43, 72, 28],
    ],
    [
      [24, 18, 72, 58],
      [12, 41, 96, 34],
      [35, 10, 47, 25],
    ],
    [
      [14, 22, 91, 58],
      [4, 42, 112, 32],
      [29, 9, 65, 34],
    ],
  ][level]!;
  return (
    <svg
      className="pixel-tree"
      width={size}
      height={size}
      viewBox="0 0 120 128"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <ellipse cx="60" cy="118" rx={24 + level * 7} ry="5" fill="#536b3b" opacity=".22" />
      <path
        d={
          level === 0
            ? 'M58 117V65H63V117Z'
            : 'M49 118L54 72L38 57L44 51L60 67L79 45L84 51L65 78L69 118Z'
        }
        fill="#68432b"
      />
      <path
        d={
          level === 0
            ? 'M59 117V65H61V117Z'
            : 'M54 116L58 73L43 56L46 54L62 70L80 49L81 52L62 79L64 116Z'
        }
        fill="#b97b41"
      />
      <g className="pixel-tree-leaves">
        {crowns.map(([x, y, w, h], index) => (
          <g key={index}>
            <path
              d={`M${x! + 6} ${y}h${w! - 12}v6h6v${h! - 12}h-6v6H${x! + 6}v-6h-6V${y! + 6}h6Z`}
              fill="#415c32"
            />
            <path
              d={`M${x! + 7} ${y! + 3}h${w! - 17}v6h7v${h! - 17}h-6v5H${x! + 6}v-7h-3V${y! + 10}h4Z`}
              fill={index % 2 ? '#7b9c3d' : '#8eac42'}
            />
            {Array.from({ length: 7 }, (_, i) => (
              <rect
                key={i}
                x={x! + 9 + ((i * 13) % (w! - 16))}
                y={y! + 7 + ((i * 7) % (h! - 12))}
                width="5"
                height="4"
                fill={i % 2 ? '#b3c65a' : '#587934'}
              />
            ))}
          </g>
        ))}
      </g>
      <path d="M39 119h42v3H39zM47 116h5v4h-5zM73 115h4v5h-4z" fill="#6d8e42" />
    </svg>
  );
}

export function FruitBasket({ count }: { count: number }) {
  return (
    <span className="fruit-basket" role="img" aria-label={`果篮，已收获 ${count} 颗`}>
      <svg
        width="58"
        height="40"
        viewBox="0 0 58 40"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {count > 0 && (
          <>
            <path d="M16 13h10v10H16zM31 10h10v12H31z" fill="#d87950" />
            <path d="M21 9h3v6h-3zM36 6h3v6h-3z" fill="#53713d" />
          </>
        )}
        <path d="M10 20V9h6V4h26v5h6v11h-4V11h-6V8H20v3h-6v9z" fill="#86613d" />
        <path d="M6 19h46v7h-4v12H10V26H6z" fill="#805c3a" />
        <path d="M10 23h38v4H10zM14 29h30v6H14z" fill="#cfa15d" />
        <path d="M19 23v13M29 23v13M39 23v13" stroke="#a77b48" strokeWidth="2" />
      </svg>
      <span>{count}</span>
    </span>
  );
}
