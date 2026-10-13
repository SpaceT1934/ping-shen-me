import { describe, expect, it } from 'vitest';
import { recordDraftSchema } from '../src/index.js';

describe('记录草稿契约', () => {
  it('允许未归类记录', () => {
    expect(
      recordDraftSchema.safeParse({
        content: '剪完视频',
        type: 'action',
        projectId: null,
        emotion: null,
        sourceText: '今天剪完视频',
      }).success,
    ).toBe(true);
  });

  it('拒绝空内容及未知分类', () => {
    expect(
      recordDraftSchema.safeParse({
        content: '  ',
        type: 'fruit',
        projectId: null,
        emotion: null,
        sourceText: '',
      }).success,
    ).toBe(false);
  });
});
