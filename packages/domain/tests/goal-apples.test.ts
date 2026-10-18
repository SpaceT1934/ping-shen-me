import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Command, GardenState } from '@apple/contracts';
import {
  applyCommand,
  emptyGarden,
  fruitColorMix,
  growthFor,
  treeFruitsFor,
} from '../src/index.js';
const now = '2026-10-18T01:00:00.000Z';
function run(state: GardenState, command: Command) {
  return applyCommand(
    state,
    { command, expectedVersion: state.version, operationId: randomUUID() },
    JSON.stringify(command),
    { now, id: randomUUID },
  ).state;
}
describe('目标苹果与摘果成长', () => {
  it('无目标无苹果；每个目标一颗，进度变色，成熟不成长，摘取才成长并从树上移除', () => {
    let state = run(emptyGarden(), {
      type: 'project.create',
      name: '阅读',
      icon: 'book',
      color: 'sage',
      goal: null,
    });
    const projectId = state.projects[0]!.id;
    expect(treeFruitsFor(state, projectId)).toEqual([]);
    state = run(state, {
      type: 'goal.create',
      projectId,
      replace: false,
      goal: { title: '读完10章', type: 'count', target: 10, unit: '章' },
    });
    const goalId = state.goals[0]!.id;
    expect(treeFruitsFor(state, projectId)).toEqual([
      { goalId, title: '读完10章', percent: 0, resultId: null },
    ]);
    state = run(state, { type: 'goal.progress', id: goalId, value: 4 });
    expect(treeFruitsFor(state, projectId)[0]!.percent).toBe(40);
    expect(growthFor(state, projectId)).toMatchObject({ harvestCount: 0, stageProgress: 0 });
    state = run(state, { type: 'goal.progress', id: goalId, value: 10 });
    const resultId = state.results[0]!.id;
    expect(treeFruitsFor(state, projectId)[0]).toMatchObject({ percent: 100, resultId });
    expect(growthFor(state, projectId)).toMatchObject({ harvestCount: 0, stageProgress: 0 });
    state = run(state, { type: 'result.harvest', id: resultId, followUp: 'continue' });
    expect(treeFruitsFor(state, projectId)).toEqual([]);
    expect(growthFor(state, projectId)).toMatchObject({
      harvestCount: 1,
      stageIndex: 0,
      stageProgress: 1 / 3,
    });
    state = run(state, { type: 'result.harvest', id: resultId, followUp: 'continue' });
    expect(growthFor(state, projectId).harvestCount).toBe(1);
    expect(treeFruitsFor(JSON.parse(JSON.stringify(state)), projectId)).toEqual([]);
  });
  it('多目标苹果独立，替换旧目标移除旧青果，别的项目不会串入', () => {
    let state = run(emptyGarden(), {
      type: 'project.batch',
      projects: [
        {
          name: '阅读',
          icon: 'book',
          color: 'sage',
          goal: { title: '旧目标', type: 'manual', target: 1, unit: '' },
        },
        {
          name: '运动',
          icon: 'apple',
          color: 'blue',
          goal: { title: '运动目标', type: 'manual', target: 1, unit: '' },
        },
      ],
    });
    const projectId = state.projects[0]!.id;
    state = run(state, {
      type: 'goal.create',
      projectId,
      replace: true,
      goal: { title: '新目标', type: 'count', target: 10, unit: '次' },
    });
    state = run(state, {
      type: 'goal.create',
      projectId,
      replace: false,
      goal: { title: '并行目标', type: 'percentage', target: 100, unit: '%' },
    });
    const goals = state.goals.filter((goal) => goal.projectId === projectId && !goal.archivedAt);
    state = run(state, { type: 'goal.progress', id: goals[1]!.id, value: 75 });
    expect(treeFruitsFor(state, projectId).map((fruit) => [fruit.title, fruit.percent])).toEqual([
      ['新目标', 0],
      ['并行目标', 75],
    ]);
    expect(treeFruitsFor(state, state.projects[1]!.id).map((fruit) => fruit.title)).toEqual([
      '运动目标',
    ]);
  });
  it('颜色按连续进度混合，存在黄绿和橙红中间色，边界安全', () => {
    expect(fruitColorMix(0)).toEqual({ amber: 0, red: 0 });
    expect(fruitColorMix(25)).toEqual({ amber: 0.5, red: 0 });
    expect(fruitColorMix(50)).toEqual({ amber: 1, red: 0 });
    expect(fruitColorMix(75)).toEqual({ amber: 1, red: 0.5 });
    expect(fruitColorMix(100)).toEqual({ amber: 1, red: 1 });
    expect(
      new Set(Array.from({ length: 101 }, (_, index) => JSON.stringify(fruitColorMix(index)))).size,
    ).toBe(101);
    expect(fruitColorMix(49.9).amber).toBeCloseTo(0.998);
    expect(fruitColorMix(50.1).red).toBeCloseTo(0.002);
    expect(fruitColorMix(-20)).toEqual(fruitColorMix(0));
    expect(fruitColorMix(120)).toEqual(fruitColorMix(100));
    expect(fruitColorMix(NaN)).toEqual(fruitColorMix(0));
  });
});
