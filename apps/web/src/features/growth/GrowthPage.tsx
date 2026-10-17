import { useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { dateInZone } from '@apple/domain';
import type { Feedback } from '@apple/contracts';
import { useGarden } from '../../app/garden-context';
import { useActionFeedback } from '../../lib/garden/use-action-feedback';
import { PageHeading } from '../../components/PageHeading';
import { LineIcon, Illustration } from '../../components/Illustration';
import { LivingMascot } from '../../components/AmbientScene';
import { GoalFruit, ProjectTree, FruitBasket } from '../../components/GardenVisuals';
import { usePreferences } from '../../lib/preferences';
import { prepareHarvestSound } from '../../lib/harvest-sound';
import { FigmaMotion } from '../../design/FigmaMotion';
export function GrowthPage() {
  const prefs = usePreferences();
  const { projects, state, entries, results } = useGarden();
  const location = useLocation();
  const context = location.state as { feedback?: Feedback; actionCount?: number } | null;
  const feedback = context?.feedback;
  const todayActions = entries.filter(
    (item) => item.type === 'action' && item.date === dateInZone(new Date()),
  );
  const wateredIds = feedback?.growthProjectIds ?? todayActions.map((item) => item.projectId);
  const grown = projects.filter((item) => wateredIds.includes(item.id));
  const fruitId = feedback?.resultIds[0];
  const encouragement = useActionFeedback(state.version, prefs.recommendations && grown.length > 0);
  return (
    <div className="paper-page feedback-page">
      <PageHeading title="今天的小进步" back="/" />
      <div className="feedback-intro">
        <LivingMascot size={110} mood="feedback" />
        <div className="speech-bubble">
          <h1>{grown.length ? '太棒了！' : '每一步都算数'}</h1>
          <p>{encouragement.data?.text || '今天的努力已经好好记下，继续按自己的节奏慢慢来～'}</p>
        </div>
      </div>
      {grown[0] && (
        <section className="feedback-hero fig-card">
          <Illustration
            name={
              ['tree-seedling', 'tree-large-green', 'tree-large-full', 'tree-large-red'][
                grown[0].growth.stageIndex
              ]!
            }
            size={145}
          />
          <div>
            <h2>{grown[0].name}</h2>
            <FigmaMotion node="31:3058" className="feedback-action-count">
              {context?.actionCount ? `+${context.actionCount}` : '已浇水'}
            </FigmaMotion>
            <p>
              每一次认真行动，
              <br />
              都会让小树更有力量。
            </p>
          </div>
        </section>
      )}
      <div className="feedback-stats">
        <div>
          <strong>{todayActions.length}</strong>
          <span>今日行动</span>
        </div>
        <div>
          <strong>{grown.length}</strong>
          <span>照顾的树</span>
        </div>
        <div>
          <strong>{results.filter((item) => item.harvestedAt).length}</strong>
          <span>已收获果实</span>
        </div>
      </div>
      <h2 className="journal-section-title">
        <Illustration name="sprout" size={25} />
        小树的成长记录
      </h2>
      {grown.map((project) => (
        <section className="feedback-project" key={project.id}>
          <ProjectTree stage={project.growth.stageIndex} size={95} />
          <div>
            <h2>{project.name}</h2>
            <p>
              {project.growth.count} 次行动 · {project.growth.name}
            </p>
            <span className="feedback-water">已经浇过水啦 ✓</span>
          </div>
          <GoalFruit percent={project.percent} size={45} />
        </section>
      ))}
      <div className="gentle-note">
        <LivingMascot size={74} mood="cheer" />
        <p>
          行动会给小树浇水，
          <br />
          确认的目标进展让苹果慢慢变红。
        </p>
      </div>
      {fruitId && (
        <Link className="forest-ripe-notice" to={`/fruit?result=${fruitId}`}>
          <GoalFruit percent={100} size={29} />
          有果实成熟了，等你亲手摘下～
        </Link>
      )}
      {fruitId && (
        <div className="ripe-fruit-transition" aria-label="目标已经达成，果实成熟">
          <FigmaMotion node="31:3094">
            <Illustration name="fruit-transition-orange" size={75} />
          </FigmaMotion>
          <FigmaMotion node="31:3095">
            <Illustration name="fruit-transition-red" size={75} />
          </FigmaMotion>
        </div>
      )}
      <Link
        to={fruitId ? `/fruit?result=${fruitId}` : '/'}
        className="coral-button full-width feedback-return"
      >
        {fruitId ? '去收获这颗果实' : '太好了，回到我的树林'}
        <LineIcon name="arrow" size={21} />
      </Link>
    </div>
  );
}
export function FruitPage() {
  const prefs = usePreferences();
  const [params] = useSearchParams();
  const { projects, results, harvestResult, busy } = useGarden();
  const [caught, setCaught] = useState(false);
  const [followUp, setFollowUp] = useState<'continue' | 'complete' | 'next_goal'>('continue');
  const result =
    results.find((item) => item.id === params.get('result')) ||
    results.find((item) => item.projectId === params.get('project'));
  const project = projects.find((item) => item.id === result?.projectId);
  return (
    <div className={`harvest-page ${caught ? 'just-harvested' : ''}`}>
      <div className="harvest-heading">
        <PageHeading
          title={result?.harvestedAt ? '我的收获' : '成熟果实'}
          back={project ? `/projects/${project.id}` : '/'}
        />
      </div>
      <section className="harvest-scene">
        <div className="harvest-caption">
          <span>
            {caught
              ? '苹什猫接住啦！'
              : result?.harvestedAt
                ? '每一份努力，都有了结果'
                : result
                  ? '红苹果成熟了～'
                  : '下一颗果实，正在路上'}
          </span>
          <p>
            {result?.harvestedAt
              ? '已收入这棵树的果篮'
              : result
                ? '亲手摘下，留下属于你的成果'
                : '慢慢照顾你的目标，它会一点点长大。'}
          </p>
        </div>
        <div className="harvest-tree">
          <ProjectTree stage={project?.growth.stageIndex ?? 0} size={250} />
          {result && (!result.harvestedAt || caught) && (
            <div className="harvest-target">
              <GoalFruit percent={100} size={62} />
            </div>
          )}
        </div>
        <div className="harvest-companion">
          <LivingMascot size={115} mood={caught ? 'harvest' : 'cheer'} />
        </div>
        <div className="harvest-basket">
          <FruitBasket count={project?.growth.harvestCount ?? 0} />
        </div>
      </section>
      <section className="harvest-paper">
        <p className="section-kicker">{project?.name || '属于你的成长'}</p>
        <h1>{result?.title || '你的下一颗果实'}</h1>
        {result && (
          <>
            <div className="harvest-facts">
              <span>
                <strong>{result.days}</strong>天完成
              </span>
              <span>
                <strong>{result.actionCount}</strong>次相关行动
              </span>
              <span>
                <strong>
                  {new Date(result.completedAt).toLocaleDateString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                  })}
                </strong>
                达成日期
              </span>
            </div>
            {caught && project && (
              <div className="harvest-success" role="status">
                已放入「{project.name}」的果篮，共 {project.growth.harvestCount} 颗。
                <br />
                小树现在是{project.growth.name}。
                {project.growth.stageIndex < 3 &&
                  `再收获 ${project.growth.threshold - (project.growth.harvestCount % project.growth.threshold)} 颗，就能长大一阶段。`}
              </div>
            )}
            {!result.harvestedAt && (
              <label className="harvest-choice">
                收获之后
                <select
                  aria-label="收获之后"
                  value={followUp}
                  onChange={(event) => setFollowUp(event.target.value as typeof followUp)}
                >
                  <option value="continue">继续照顾这个方向</option>
                  <option value="next_goal">准备下一个目标</option>
                  <option value="complete">结束这个项目</option>
                </select>
              </label>
            )}
          </>
        )}
        {result && project ? (
          result.harvestedAt ? (
            <Link
              className="coral-button full-width"
              to={`/projects/${project.id}?${caught && followUp === 'next_goal' ? 'newGoal=1' : 'tab=basket'}`}
            >
              {caught && followUp === 'next_goal' ? '设置下一个目标' : '看看我的果篮'}
              <LineIcon name="arrow" size={21} />
            </Link>
          ) : (
            <button
              className="coral-button full-width"
              disabled={busy}
              onClick={async () => {
                const sound = prepareHarvestSound(prefs.sound);
                const saved = await harvestResult(result.id, followUp);
                sound(saved);
                if (saved) setCaught(true);
              }}
            >
              {busy ? '正在收获…' : '摘下这颗果实'}
              <LineIcon name="arrow" size={21} />
            </button>
          )
        ) : (
          <Link to="/" className="coral-button full-width">
            回到我的树林
          </Link>
        )}
        {result?.harvestedAt && (
          <Link className="outline-button full-width" to={`/share?result=${result.id}`}>
            做成日签 →
          </Link>
        )}
        <p className="harvest-footnote">一边做很多事，一边慢慢长大。</p>
      </section>
    </div>
  );
}
