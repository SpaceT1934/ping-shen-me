import { useState } from 'react';
import { Link, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import { useGarden } from '../../app/garden-context';
import type { Feedback } from '@apple/contracts';
import { LineIcon, PixelIcon } from '../../components/PixelIcon';
import { AmbientScene, LivingMascot } from '../../components/AmbientScene';
export function GrowthPage() {
  const { projects } = useGarden();
  const location = useLocation();
  const feedback = (location.state as { feedback?: Feedback } | null)?.feedback;
  const grown = projects.filter((item) => feedback?.growthProjectIds.includes(item.id));
  const fruitId = feedback?.resultIds[0];
  return (
    <div className="growth-scene">
      <AmbientScene />
      <Link className="scene-close" to="/" aria-label="返回首页">
        <LineIcon name="close" />
      </Link>
      <div className="speech-bubble growth-bubble">
        <h1>{grown.length ? '太棒了！' : '每一步，都算数。'}</h1>
        <p>
          {grown.length ? (
            <>
              这次努力，已经记下来了。
              <br />
              {grown.map((item) => (
                <span className="growth-summary-row" key={item.id}>
                  {item.name} · {item.growth.count} 次行动 · {item.growth.name}
                </span>
              ))}
            </>
          ) : (
            <>
              继续按自己的节奏，
              <br />
              慢慢照顾你的成长方向。
            </>
          )}
        </p>
      </div>
      <div className="growth-spark spark-one">✦</div>
      <div className="growth-spark spark-two">✧</div>
      {grown.length > 0 && <div className="watering-drop" aria-hidden="true" />}
      <div className="growth-apple">
        <PixelIcon name={fruitId ? 'golden' : 'green'} size={155} />
      </div>
      <div className="growth-mascot">
        <LivingMascot size={122} />
      </div>
      <div className="scene-bottom">
        <p className="scene-note">
          {grown.length ? '每条已保存的行动，为方向积累一次成长。' : '准备好了，就从一件小事开始。'}
        </p>
        <Link to={fruitId ? `/fruit?result=${fruitId}` : '/'} className="dark-button full-width">
          {fruitId ? '有果实成熟了，去收获' : '太好了，回到我的树'}
          <LineIcon name="arrow" size={18} />
        </Link>
      </div>
    </div>
  );
}
export function FruitPage() {
  const [params] = useSearchParams();
  const { projects, results, harvestResult, busy } = useGarden();
  const [followUp, setFollowUp] = useState<'continue' | 'complete' | 'next_goal'>('continue');
  const navigate = useNavigate();
  const result =
    results.find((item) => item.id === params.get('result')) ||
    results.find((item) => item.projectId === params.get('project'));
  const project = projects.find((item) => item.id === result?.projectId);
  return (
    <div className="fruit-scene">
      <AmbientScene />
      <Link
        className="scene-close"
        to={project ? `/projects/${project.id}` : '/'}
        aria-label="返回"
      >
        <LineIcon name="close" />
      </Link>
      <div className="fruit-ribbon">{result ? '一颗属于你的果实！' : '果实正在慢慢生长'}</div>
      <div className="fruit-display">
        <PixelIcon name={result ? 'golden' : 'green'} size={230} />
        {result && <span className="fruit-glint">✦</span>}
      </div>
      <div className="fruit-companion">
        <LivingMascot size={95} />
      </div>
      <section className="fruit-paper">
        <h1>{result?.title || '你的下一颗果实，正在路上'}</h1>
        <p>{result ? '这是你一点点努力积累的结果。' : '目标达成后，成果会出现在这里。'}</p>
        {result && (
          <>
            <div className="fruit-stat">
              <span>从项目开始</span>
              <strong>{result.days} 天</strong>
              <span>相关行动</span>
              <strong>{result.actionCount} 次</strong>
              <span>积累灵感</span>
              <strong>{result.ideaCount} 个</strong>
            </div>
            {!result.harvestedAt && (
              <label className="harvest-choice">
                收获之后
                <select
                  aria-label="收获之后"
                  value={followUp}
                  onChange={(event) => setFollowUp(event.target.value as typeof followUp)}
                >
                  <option value="continue">继续这个方向，暂不设置新目标</option>
                  <option value="next_goal">准备下一个目标</option>
                  <option value="complete">结束这个项目</option>
                </select>
              </label>
            )}
          </>
        )}
        {result && project ? (
          result.harvestedAt ? (
            <Link className="dark-button full-width" to={`/projects/${project.id}`}>
              查看历史成果
              <LineIcon name="arrow" size={18} />
            </Link>
          ) : (
            <button
              className="dark-button full-width"
              disabled={busy}
              onClick={async () => {
                if (await harvestResult(result.id, followUp))
                  navigate(
                    `/projects/${project.id}${followUp === 'next_goal' ? '?newGoal=1' : ''}`,
                  );
              }}
            >
              {busy ? '正在收获…' : '收下这颗果实'}
              <LineIcon name="arrow" size={18} />
            </button>
          )
        ) : (
          <Link to="/" className="dark-button full-width">
            继续慢慢长大
          </Link>
        )}
      </section>
    </div>
  );
}
