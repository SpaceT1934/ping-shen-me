import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useGarden } from '../../app/garden-context';
import { LineIcon, ArtIcon, type SpriteName } from '../../components/Illustration';
import { PageHeading } from '../../components/PageHeading';
import { AmbientScene, LivingMascot } from '../../components/AmbientScene';
import { GoalFields, defaultGoal } from '../projects/components/GoalFields';
import { FigmaMotion } from '../../design/FigmaMotion';
import { Illustration } from '../../components/Illustration';
import { categories, updatePreferences, usePreferences } from '../../lib/preferences';
import { aiApi } from '../../lib/ai-api';
export function WelcomePage() {
  return (
    <div className="fig-welcome">
      <div className="fig-welcome-canvas">
        <FigmaMotion node="30:923" className="fig-welcome-title">
          <h1>苹什么</h1>
        </FigmaMotion>
        <FigmaMotion node="30:924" className="fig-welcome-tagline">
          世界之大，
        </FigmaMotion>
        {['我们【苹】什么', '过垂直人生'].map((text, index) => (
          <FigmaMotion
            node={`30:${925 + index}`}
            key={text}
            className={`fig-welcome-line line-${index}`}
          >
            {text}
          </FigmaMotion>
        ))}
        <FigmaMotion node="30:922" className="fig-welcome-mascot">
          <Illustration name="mascot-welcome" size={232} />
        </FigmaMotion>
        <div className="fig-welcome-sign">
          <FigmaMotion node="30:941">
            小行动
            <br />
            也能长成
            <br />
            大梦想
          </FigmaMotion>
        </div>
        <FigmaMotion node="30:919" className="fig-welcome-button">
          <Link to="/seed/ai" className="coral-button full-width">
            开始种下我的树→
          </Link>
        </FigmaMotion>
      </div>
    </div>
  );
}
export function SeedPage() {
  const [params] = useSearchParams();
  const prefs = usePreferences();
  const [category, setCategory] = useState(params.get('category') || '学习成长');
  const [customCategory, setCustomCategory] = useState('');
  const [name, setName] = useState('');
  const [classifying, setClassifying] = useState(false);
  const [categoryNotice, setCategoryNotice] = useState('');
  const [goal, setGoal] = useState(defaultGoal);
  const [withGoal, setWithGoal] = useState(false);
  const [icon, setIcon] = useState<SpriteName>('green');
  const { addProject, hasStarted, busy } = useGarden();
  const navigate = useNavigate();
  return (
    <div className="seed-page">
      <div className="seed-scene">
        <AmbientScene indoor />
        <PageHeading title="种下一棵新树" back={hasStarted ? '/projects' : '/welcome'} />
        <div className="speech-bubble seed-bubble">
          无论是学习、工作、
          <br />
          生活还是兴趣，
          <br />
          <span>都可以种下一棵树～</span>
        </div>
        <div className="seed-mascot">
          <LivingMascot size={145} />
        </div>
      </div>
      <form
        className="seed-panel"
        onSubmit={async (event) => {
          event.preventDefault();
          const id = await addProject(
            name.trim(),
            withGoal ? goal : null,
            icon,
            category === '其他' && customCategory.trim() ? customCategory.trim() : category,
          );
          if (id) {
            updatePreferences({
              categories: {
                ...prefs.categories,
                [id]:
                  category === '其他' && customCategory.trim() ? customCategory.trim() : category,
              },
            });
            navigate(`/projects/${id}`);
          }
        }}
      >
        <p className="section-kicker">为新的方向取个名字</p>
        <label>
          成长方向
          <input
            aria-label="成长方向"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="比如：雅思、自媒体、开始运动"
            maxLength={200}
            required
          />
        </label>
        <label>选择成长分类</label>
        <button
          type="button"
          className="text-button"
          disabled={!name.trim() || classifying || busy}
          onClick={async () => {
            setClassifying(true);
            setCategoryNotice('');
            try {
              const response = await aiApi.projects(name);
              const recommended = response.candidates[0]?.category;
              if (recommended) {
                setCategory(recommended);
                setIcon(
                  recommended === '工作事业'
                    ? 'work'
                    : recommended === '学习成长'
                      ? 'book'
                      : 'green',
                );
                setCategoryNotice(`AI 为你推荐的分类：${recommended}，可以继续修改。`);
              } else setCategoryNotice('暂时没有识别出分类，可以自行选择。');
            } catch {
              setCategoryNotice('AI 暂时无法推荐，可以直接选择分类。');
            } finally {
              setClassifying(false);
            }
          }}
        >
          {classifying ? '正在推荐…' : 'AI 为我推荐分类'}
        </button>
        {categoryNotice && (
          <p className="small-print" role="status">
            {categoryNotice}
          </p>
        )}
        <div className="fig-category-grid">
          {categories.map((item, index) => (
            <button
              key={item}
              type="button"
              aria-pressed={category === item}
              onClick={() => {
                setCategory(item);
                setIcon(index === 0 ? 'work' : index === 1 ? 'book' : 'green');
              }}
            >
              <Illustration
                name={
                  [
                    'category-work',
                    'category-study',
                    'category-exercise',
                    'category-heart',
                    'category-art',
                    'category-other',
                  ][index]!
                }
                size={38}
              />
              <span>{item}</span>
            </button>
          ))}
        </div>
        {category === '其他' && (
          <label>
            自定义分类
            <input
              value={customCategory}
              onChange={(event) => setCustomCategory(event.target.value)}
              maxLength={20}
              placeholder="写下你的分类"
            />
          </label>
        )}
        <details>
          <summary className="small-print">更换项目图标</summary>
          <div className="icon-choices" aria-label="项目图标">
            {(['green', 'video', 'book', 'work'] as const).map((item, index) => (
              <button
                type="button"
                key={item}
                aria-label={['成长', '视频', '学习', '工作'][index]}
                aria-pressed={icon === item}
                className={icon === item ? 'selected' : ''}
                onClick={() => setIcon(item)}
              >
                <ArtIcon name={item} size={36} />
              </button>
            ))}
          </div>
        </details>
        <label className="checkbox-line">
          <input
            type="checkbox"
            checked={withGoal}
            onChange={(event) => setWithGoal(event.target.checked)}
          />
          同时设置一个阶段目标
        </label>
        {withGoal && <GoalFields value={goal} onChange={setGoal} />}
        <div className="example-chips">
          {['自媒体', '学习英语', '规律运动'].map((example) => (
            <button type="button" key={example} onClick={() => setName(example)}>
              {example}
            </button>
          ))}
        </div>
        <button
          className="dark-button full-width"
          type="submit"
          disabled={busy || !name.trim() || (withGoal && (!goal.title.trim() || goal.target <= 0))}
        >
          {busy ? '正在种下…' : '种下这个方向'}
          <LineIcon name="arrow" size={18} />
        </button>
        <Link className="text-button full-width" to="/seed/ai">
          让 AI 帮我整理成长方向 →
        </Link>
      </form>
    </div>
  );
}
