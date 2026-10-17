import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { applyCommand, emptyGarden, growthFor, createReport, fruitStage } from '../src/index.js';
import type { GardenState, Command, ManualDraft } from '@apple/contracts';
const now = '2026-10-13T05:00:00.000Z';
const runtime = { now, id: randomUUID };
function run(state: GardenState, command: Command) {
  return applyCommand(
    state,
    { command, expectedVersion: state.version, operationId: randomUUID() },
    JSON.stringify(command),
    runtime,
  );
}
function setup(type: 'count' | 'manual' | 'percentage' = 'count') {
  const state = run(emptyGarden(), {
    type: 'project.create',
    name: '自媒体',
    icon: 'video',
    color: 'sage',
    goal: { title: '发布视频', type, target: 2, unit: '条' },
  }).state;
  return { state, projectId: state.projects[0]!.id, goalId: state.goals[0]!.id };
}
const draft = (projectId: string | null, overrides: Partial<ManualDraft> = {}): ManualDraft => ({
  content: '发布一条视频',
  projectId,
  type: 'action',
  date: '2026-10-13',
  dueDate: null,
  contribution: 0,
  goalType: 'manual',
  target: 1,
  unit: '',
  ...overrides,
});
describe('手动业务规则', () => {
  it('已达成果的行动仍可纠正文案，不重新生成成果或重复贡献', () => {
    const { state: initial, projectId } = setup();
    let state = run(initial, {
      type: 'records.save',
      items: [draft(projectId, { contribution: 2 })],
    }).state;
    const record = state.records[0]!;
    state = run(state, {
      type: 'record.update',
      id: record.id,
      recordType: 'action',
      projectId,
      date: record.date,
      content: '发布了两条视频',
      contribution: 2,
    }).state;
    expect(state.records[0]!.content).toBe('发布了两条视频');
    expect(state.results).toHaveLength(1);
    expect(state.goals[0]!.currentValue).toBe(2);
    expect(growthFor(state, projectId).count).toBe(1);
  });
  it('完成、撤销、再次完成任务仍只对应一个有效行动和成长事件', () => {
    const { state: initial, projectId } = setup();
    let state = run(initial, {
      type: 'task.create',
      projectId,
      title: '剪辑视频',
      dueDate: null,
    }).state;
    const taskId = state.tasks[0]!.id;
    state = run(state, { type: 'task.complete', id: taskId, completed: true }).state;
    expect(growthFor(state, projectId).count).toBe(1);
    expect(state.goals[0]!.currentValue).toBe(0);
    state = run(state, { type: 'task.complete', id: taskId, completed: true }).state;
    expect(state.records).toHaveLength(1);
    state = run(state, { type: 'task.complete', id: taskId, completed: false }).state;
    expect(growthFor(state, projectId).count).toBe(0);
    state = run(state, { type: 'task.complete', id: taskId, completed: true }).state;
    expect(state.records).toHaveLength(1);
    expect(state.growthEvents).toHaveLength(1);
    expect(growthFor(state, projectId).count).toBe(1);
  });
  it('网络重试不重复成长，同一提交编号不同操作会拒绝', () => {
    const { state, projectId } = setup();
    const command: Command = { type: 'records.save', items: [draft(projectId)] };
    const envelope = { command, expectedVersion: state.version, operationId: randomUUID() };
    const first = applyCommand(state, envelope, 'same', runtime);
    const replay = applyCommand(first.state, envelope, 'same', runtime);
    expect(replay.state.version).toBe(first.state.version);
    expect(replay.state.records).toHaveLength(1);
    expect(() => applyCommand(first.state, envelope, 'different', runtime)).toThrow('同一提交编号');
  });
  it('只有明确贡献才推进目标，达成后生成唯一成果并保留快照', () => {
    const { state: initial, projectId, goalId } = setup();
    let state = run(initial, {
      type: 'records.save',
      items: [
        draft(projectId, { contribution: 1 }),
        draft(projectId, { type: 'idea', content: '一个选题' }),
      ],
    }).state;
    expect(state.results).toHaveLength(0);
    state = run(state, {
      type: 'records.save',
      items: [draft(projectId, { contribution: 1 })],
    }).state;
    expect(state.results).toHaveLength(1);
    expect(state.results[0]!.goalId).toBe(goalId);
    expect(state.results[0]!.actionCount).toBe(2);
    expect(state.results[0]!.ideaCount).toBe(1);
    state = run(state, { type: 'record.delete', id: state.records[0]!.id }).state;
    expect(growthFor(state, projectId).count).toBe(1);
    expect(state.results[0]!.actionCount).toBe(2);
  });
  it('灵感和未归类行动不产生成长，重新关联后会产生一次成长', () => {
    const { state: initial, projectId } = setup();
    let state = run(initial, {
      type: 'records.save',
      items: [draft(null), draft(projectId, { type: 'idea' })],
    }).state;
    expect(growthFor(state, projectId).count).toBe(0);
    const record = state.records[0]!;
    state = run(state, {
      type: 'record.update',
      id: record.id,
      content: record.content,
      recordType: 'action',
      projectId,
      date: record.date,
      contribution: 0,
    }).state;
    expect(growthFor(state, projectId).count).toBe(1);
  });
  it('数量、百分比和手动目标的完成规则都可用', () => {
    for (const type of ['manual', 'percentage'] as const) {
      const { state, goalId } = setup(type);
      expect(state.goals[0]!.target).toBe(type === 'manual' ? 1 : 100);
      const next = run(state, {
        type: 'goal.progress',
        id: goalId,
        value: type === 'manual' ? 1 : 100,
      }).state;
      expect(next.results).toHaveLength(1);
    }
  });
  it('收获历史成果不会覆盖新目标', () => {
    const { state: initial, projectId, goalId } = setup('manual');
    let state = run(initial, { type: 'goal.progress', id: goalId, value: 1 }).state;
    const resultId = state.results[0]!.id;
    state = run(state, {
      type: 'goal.create',
      projectId,
      replace: false,
      goal: { title: '下个目标', type: 'percentage', target: 100, unit: '%' },
    }).state;
    const nextGoalId = state.projects[0]!.currentGoalId;
    state = run(state, { type: 'result.harvest', id: resultId, followUp: 'continue' }).state;
    expect(state.projects[0]!.currentGoalId).toBe(nextGoalId);
    expect(state.results[0]!.harvestedAt).toBe(now);
  });
  it('归档保留历史报告，日期范围使用上海自然日', () => {
    const { state: initial, projectId } = setup();
    let state = run(initial, {
      type: 'records.save',
      items: [
        draft(projectId, { date: '2026-10-06' }),
        draft(projectId, { date: '2026-10-07' }),
        draft(projectId),
      ],
    }).state;
    state = run(state, { type: 'project.status', id: projectId, status: 'archived' }).state;
    expect(createReport(state, '7天', new Date(now)).actions).toHaveLength(2);
    expect(createReport(state, '全部', new Date(now)).actions).toHaveLength(3);
    expect(createReport(state, '7天', new Date(now)).activeCount).toBe(1);
  });
  it('失败的批量保存不修改原始状态；未来行动被拒绝', () => {
    const { state, projectId } = setup();
    expect(() =>
      run(state, {
        type: 'records.save',
        items: [draft(projectId), draft(null, { type: 'task' })],
      }),
    ).toThrow('计划需要关联');
    expect(state.records).toHaveLength(0);
    expect(() =>
      run(state, { type: 'records.save', items: [draft(projectId, { date: '2026-10-14' })] }),
    ).toThrow('未来日期');
  });
});

describe('PRD V1.1 目标、果实与树独立成长', () => {
  it('果实五档边界只由目标进度决定', () => {
    expect([0, 0.1, 30, 30.1, 60, 60.1, 99.9, 100].map(fruitStage)).toEqual([
      0, 1, 1, 2, 2, 3, 3, 4,
    ]);
  });
  it('大量普通行动不会成熟苹果或升级；重复摘果只记一次，各树独立', () => {
    const { state: initial, projectId, goalId } = setup('manual');
    let state = run(initial, {
      type: 'records.save',
      items: Array.from({ length: 30 }, () => draft(projectId)),
    }).state;
    state = run(state, {
      type: 'project.create',
      name: '另一棵树',
      icon: 'book',
      color: 'blue',
      goal: null,
    }).state;
    const other = state.projects[1]!.id;
    expect(growthFor(state, projectId).stageIndex).toBe(0);
    expect(state.results).toHaveLength(0);
    for (let index = 0; index < 10; index++) {
      let id = goalId;
      if (index > 0) {
        state = run(state, {
          type: 'goal.create',
          projectId,
          replace: false,
          goal: { title: `第${index}个目标`, type: 'manual', target: 1, unit: '' },
        }).state;
        id = state.goals.at(-1)!.id;
      }
      state = run(state, { type: 'goal.progress', id, value: 1 }).state;
      expect(growthFor(state, projectId).harvestCount).toBe(index);
      const result = state.results.at(-1)!;
      state = run(state, { type: 'result.harvest', id: result.id, followUp: 'continue' }).state;
      state = run(state, { type: 'result.harvest', id: result.id, followUp: 'continue' }).state;
      expect(growthFor(state, projectId).harvestCount).toBe(index + 1);
      expect(growthFor(state, projectId).stageIndex).toBe(Math.min(3, Math.floor((index + 1) / 3)));
      expect(growthFor(state, other).stageIndex).toBe(0);
    }
    state = run(state, { type: 'project.threshold', id: projectId, threshold: 2 }).state;
    expect(growthFor(state, projectId).threshold).toBe(2);
    const restored = JSON.parse(JSON.stringify(state)) as GardenState;
    expect(growthFor(restored, projectId)).toEqual(growthFor(state, projectId));
    state = run(state, { type: 'project.threshold', id: projectId, threshold: 1 }).state;
    expect(growthFor(state, projectId).threshold).toBe(1);
    expect(growthFor(state, other).threshold).toBe(3);
  });
  it('选择具体目标，关联行动可零贡献，目标切换不串进度，超过目标上限会截断', () => {
    const { state: initial, projectId, goalId } = setup();
    let state = run(initial, {
      type: 'goal.create',
      projectId,
      replace: false,
      goal: { title: '另一个目标', type: 'percentage', target: 100, unit: '%' },
    }).state;
    const secondId = state.goals.at(-1)!.id;
    expect(state.projects[0]!.currentGoalId).toBe(goalId);
    state = run(state, {
      type: 'records.save',
      items: [draft(projectId, { content: '剪完视频', goalId })],
    }).state;
    expect(state.goals[0]!.currentValue).toBe(0);
    state = run(state, { type: 'goal.primary', projectId, goalId: secondId }).state;
    state = run(state, {
      type: 'records.save',
      items: [draft(projectId, { goalId, contribution: 20 })],
    }).state;
    expect(state.goals[0]!.currentValue).toBe(2);
    expect(state.goals[1]!.currentValue).toBe(0);
    expect(state.results[0]!.actionCount).toBe(2);
    expect(state.results[0]!.harvestedAt).toBeNull();
    expect(growthFor(state, projectId).stageIndex).toBe(0);
  });
});
