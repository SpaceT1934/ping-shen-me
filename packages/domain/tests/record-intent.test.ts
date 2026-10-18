import { expect, it } from 'vitest';
import { isFeelingOnly } from '../src/index.js';
it('纯情绪和否定自评不是行动，真实行为及混合内容不能被整段丢弃', () => {
  for (const text of [
    '我今天很累，我觉得我什么事情都没做',
    '我很累',
    '什么都没干',
    '今天一事无成',
    '今天好开心',
    '我觉得压力很大',
    '我有点累又有点焦虑',
  ])
    expect(isFeelingOnly(text), text).toBe(true);
  for (const text of [
    '今天剪完视频',
    '我很累，但是今天跑了三公里',
    '我觉得我完成了报告',
    '今天和朋友聊了心情',
    '研究了情绪识别',
    '完成了一次呼吸练习',
    '累得不想动，但还是完成了复习',
    '',
    '就是'.repeat(1000) + '完成了报告',
  ])
    expect(isFeelingOnly(text), text.slice(0, 50)).toBe(false);
});
