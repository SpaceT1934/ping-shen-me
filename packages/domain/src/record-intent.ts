/** Conservative whole-clause guard; concrete activities are left for the classifier. */
const modifiers = [
  '我',
  '自己',
  '今天',
  '今日',
  '这一天',
  '现在',
  '最近',
  '这会儿',
  '感觉',
  '觉得',
  '感到',
  '好像',
  '似乎',
  '真的',
  '有点',
  '有些',
  '很',
  '好',
  '特别',
  '非常',
  '实在',
  '太',
  '又',
  '也',
  '就是',
  '就',
  '是',
  '了',
  '一点',
  '一直',
  '总是',
  '已经',
  '但是',
  '但',
  '可是',
  '而且',
  '其实',
  '啊',
  '呀',
  '唉',
  '哎',
  '嗯',
  '都',
  '挺',
  '并且',
  '并',
  '的',
  '得',
  '更',
  '那么',
  '这么',
  '越来越',
];
const feelings = [
  '累',
  '心累',
  '疲惫',
  '疲倦',
  '难过',
  '委屈',
  '迷茫',
  '焦虑',
  '烦躁',
  '烦',
  '崩溃',
  '低落',
  '沮丧',
  '害怕',
  '孤独',
  '无助',
  '不开心',
  '开心',
  '高兴',
  '困',
  '难受',
  '没劲',
  '没有动力',
  '提不起劲',
  '想哭',
  '没精神',
  '压力很大',
];
const tokens = (words: string[]) => [...words].sort((a, b) => b.length - a.length).join('|');
const modifierTokens = new RegExp(tokens(modifiers), 'g');
const feelingTokens = new RegExp(tokens(feelings), 'g');
const hasFeeling = new RegExp(tokens(feelings));
const selfDoubt =
  /^(?:(?:什么|任何)(?:事情|事|东西)?(?:都|也)?(?:没有|没)(?:做|干)(?:成|过|好)?|一事无成|毫无进展|没有进展|没做什么|没干什么)$/;
export function isFeelingOnly(text: string) {
  const clauses = text
    .split(/[，,。！？!?；;\n]+/)
    .map((part) => part.replace(/[\s“”"'‘’…～~]/g, ''))
    .filter(Boolean);
  return (
    clauses.length > 0 &&
    clauses.every(
      (clause) =>
        (hasFeeling.test(clause) &&
          !clause.replace(feelingTokens, '').replace(modifierTokens, '')) ||
        selfDoubt.test(clause.replace(modifierTokens, '')),
    )
  );
}
