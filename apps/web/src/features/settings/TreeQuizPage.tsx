import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Illustration } from '../../components/Illustration';
import { SceneHeading } from '../../design/components';
import { updatePreferences, usePreferences } from '../../lib/preferences';
const questions = [
  {
    title: '你最希望通过努力，在未来成为怎样的自己？',
    answers: [
      '拥有扎实的专业能力，在学业/工作上更优秀',
      '拥有更健康的生活方式，身心更平衡',
      '发展更多兴趣爱好，让生活更丰富',
      '成为更自律的人，更好地掌控时间',
    ],
  },
  {
    title: '空出一小时，你会选择？',
    answers: ['读书或练习', '运动或散步', '画画、音乐或创作', '整理房间和计划'],
  },
  {
    title: '什么样的进步最让你开心？',
    answers: ['终于学会了', '身体和心情更轻松', '表达了自己的想法', '生活更有规律'],
  },
  {
    title: '你喜欢怎么开始新目标？',
    answers: ['制定学习计划', '从轻松的运动开始', '跟着好奇心探索', '从一个小习惯开始'],
  },
  {
    title: '希望小树怎样陪伴你？',
    answers: ['见证知识的积累', '提醒我照顾自己', '鼓励我继续创造', '陪我坚持生活的小习惯'],
  },
];
export function TreeQuizPage() {
  const prefs = usePreferences();
  const [answers, setAnswers] = useState<number[]>(prefs.quiz.length === 5 ? prefs.quiz : []);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const result = ['学习成长', '健康运动', '兴趣爱好', '生活习惯'][
    [0, 1, 2, 3].sort(
      (a, b) => answers.filter((v) => v === b).length - answers.filter((v) => v === a).length,
    )[0]!
  ]!;
  return (
    <div>
      <SceneHeading title="小树测试" mascot="mascot-reading">
        做个小测试，
        <br />
        找到适合你的小树吧～
      </SceneHeading>
      <div className="fig-paper">
        {done ? (
          <section className="fig-card">
            <Illustration name="stage-full" size={160} />
            <h2>你的成长方向：{result}</h2>
            <p>从你在意的事情开始，按自己的节奏慢慢来。</p>
            <Link
              className="coral-button full-width"
              to={`/seed?category=${encodeURIComponent(result)}`}
            >
              种下我的小树
            </Link>
            <button
              className="text-button"
              onClick={() => {
                setDone(false);
                setStep(0);
              }}
            >
              再测一次
            </button>
          </section>
        ) : (
          <>
            <p className="section-kicker">{step + 1} / 5</p>
            <h2>{questions[step]!.title}</h2>
            {questions[step]!.answers.map((answer, index) => (
              <button
                className="fig-quiz-choice"
                key={answer}
                aria-pressed={answers[step] === index}
                onClick={() =>
                  setAnswers((previous) => {
                    const next = [...previous];
                    next[step] = index;
                    return next;
                  })
                }
              >
                <strong>{'ABCD'[index]}</strong>
                {answer}
              </button>
            ))}
            <div className="button-row">
              <button
                className="outline-button"
                disabled={step === 0}
                onClick={() => setStep(step - 1)}
              >
                上一题
              </button>
              <button
                className="coral-button"
                disabled={answers[step] === undefined}
                onClick={() => {
                  if (step < 4) setStep(step + 1);
                  else {
                    updatePreferences({ quiz: answers });
                    setDone(true);
                  }
                }}
              >
                {step === 4 ? '看看我的小树' : '下一题 →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
