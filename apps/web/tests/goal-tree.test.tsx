import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { GoalFruit, ProjectTree, FruitBasket } from '../src/components/GardenVisuals';
it('没有目标的树不包含装饰苹果；真实青果和红果分层显示，只有熟果可摘', () => {
  const empty = renderToStaticMarkup(<ProjectTree stage={3} />);
  expect(empty).toContain('tree-fruitless.webp');
  expect(empty).not.toContain('tree-goal-apple');
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <ProjectTree
        stage={0}
        interactive
        onPick={() => {}}
        pickResultId="r1"
        fruits={[
          { goalId: 'g1', title: '学习20分钟', percent: 35, resultId: null },
          { goalId: 'g2', title: '读完一章', percent: 100, resultId: 'r1' },
        ]}
      />
    </MemoryRouter>,
  );
  expect(html.match(/class="tree-goal-apple/g)).toHaveLength(2);
  expect(html).toContain('href="#goal-g1"');
  expect(html).toContain('进度 35%，尚未成熟');
  expect(html.match(/<button/g)).toHaveLength(1);
  expect(html).toContain('红苹果成熟，点击摘取');
});
it('中间进度使用连续颜色权重，保留青黄红三张透明图层', () => {
  const html = renderToStaticMarkup(<GoalFruit percent={63} />);
  expect(html).toContain('--fruit-amber:1');
  expect(html).toContain('--fruit-red:0.26');
  expect(html).toContain('goal-apple-green.webp');
  expect(html).toContain('goal-apple-amber.webp');
  expect(html).toContain('goal-apple-red.webp');
});

it('未摘取时果篮为空，收获后才叠加红苹果', () => {
  const empty = renderToStaticMarkup(<FruitBasket count={0} />);
  const picked = renderToStaticMarkup(<FruitBasket count={1} />);
  expect(empty).toContain('basket-empty-goals.webp');
  expect(empty).not.toContain('goal-apple-red.webp');
  expect(picked).toContain('goal-apple-red.webp');
  expect(picked).toContain('已收获 1 颗');
});
