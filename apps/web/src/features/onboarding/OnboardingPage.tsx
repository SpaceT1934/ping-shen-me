import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGarden } from '../../app/garden-context';
import { LineIcon, ArtIcon, type SpriteName } from '../../components/Illustration';
import { PageHeading } from '../../components/PageHeading';
import { AmbientScene, LivingMascot } from '../../components/AmbientScene';
import { GoalFields, defaultGoal } from '../projects/components/GoalFields';
import { AIProjectSeed } from './AIProjectSeed';
export function WelcomePage() {
  const { startGarden, busy } = useGarden();
  const navigate = useNavigate();
  return (
    <div className="welcome-scene journal-welcome">
      <AmbientScene />
      <button
        disabled={busy}
        className="welcome-skip"
        onClick={async () => {
          if (await startGarden()) navigate('/');
        }}
      >
        看看我的树 →
      </button>
      <div className="welcome-brand">
        <h1>
          苹什么
          <span>
            <ArtIcon name="green" size={29} />
          </span>
        </h1>
        <p>
          用行动，养大每一棵树 <span>♥</span>
        </p>
      </div>
      <div className="welcome-message">
        把想做的事
        <br />
        种成一棵棵树
        <br />
        <span>
          在每一次行动中
          <br />
          慢慢长大～
        </span>
      </div>
      <div className="welcome-mascot">
        <LivingMascot size={245} />
      </div>
      <div className="welcome-sign">
        小行动
        <br />
        也能长成
        <br />
        大梦想 <span>♥</span>
      </div>
      <Link to="/seed" className="coral-button welcome-cta">
        开始种下我的树 <LineIcon name="arrow" size={23} />
      </Link>
      <div className="welcome-dots" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
export function SeedPage() {
  const [name, setName] = useState('');
  const [goal, setGoal] = useState(defaultGoal);
  const [withGoal, setWithGoal] = useState(false);
  const [icon, setIcon] = useState<SpriteName>('green');
  const { addProject, hasStarted, busy } = useGarden();
  const navigate = useNavigate();
  return (
    <div className="seed-page">
      <div className="seed-scene">
        <AmbientScene indoor />
        <PageHeading title="种下一个方向" back={hasStarted ? '/projects' : '/welcome'} />
        <div className="speech-bubble seed-bubble">
          hi！我是苹什猫
          <br />
          告诉我，你现在想做什么？
          <br />
          <span>我们从一个小方向开始吧。</span>
        </div>
        <div className="seed-mascot">
          <LivingMascot size={145} />
        </div>
      </div>
      <AIProjectSeed />
      <form
        className="seed-panel"
        onSubmit={async (event) => {
          event.preventDefault();
          const id = await addProject(name.trim(), withGoal ? goal : null, icon);
          if (id) navigate(`/projects/${id}`);
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
            maxLength={100}
            required
          />
        </label>
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
      </form>
    </div>
  );
}
