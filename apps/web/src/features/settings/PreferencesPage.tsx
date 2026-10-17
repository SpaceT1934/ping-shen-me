import { Illustration } from '../../components/Illustration';
import { SceneHeading, Toggle } from '../../design/components';
import { updatePreferences, usePreferences } from '../../lib/preferences';
export function PreferencesPage() {
  const prefs = usePreferences();
  return (
    <div>
      <SceneHeading title="偏好设置" mascot="mascot-wink">
        让你的小花园，
        <br />
        更像你喜欢的样子～
      </SceneHeading>
      <div className="fig-paper">
        <section className="fig-card">
          <h2>个人信息</h2>
          <label>
            昵称
            <input
              maxLength={24}
              value={prefs.name}
              onChange={(event) => updatePreferences({ name: event.target.value })}
            />
          </label>
          <label>
            我的一句话
            <input
              maxLength={60}
              value={prefs.tagline}
              onChange={(event) => updatePreferences({ tagline: event.target.value })}
            />
          </label>
        </section>
        <section className="fig-card">
          <h2>小花园主题</h2>
          <div className="fig-theme-grid">
            {(['garden', 'night', 'sea', 'sunset'] as const).map((theme, index) => (
              <button
                key={theme}
                aria-pressed={prefs.theme === theme}
                onClick={() => updatePreferences({ theme, followSystem: false })}
              >
                <Illustration name={`theme-${theme}`} size={140} />
                <span>{['暖暖花园', '静谧夜晚', '海边微风', '日落时分'][index]}</span>
              </button>
            ))}
          </div>
          <Toggle
            label="跟随系统外观"
            checked={prefs.followSystem}
            onChange={(followSystem) => updatePreferences({ followSystem })}
          />
        </section>
        <section className="fig-card">
          <Toggle
            label="界面动态效果"
            icon="speaker"
            checked={prefs.motion}
            onChange={(motion) => updatePreferences({ motion })}
          />
          <Toggle
            label="收获提示音"
            icon="bell"
            checked={prefs.sound}
            onChange={(sound) => updatePreferences({ sound })}
          />
          <Toggle
            label="成长建议"
            icon="sprout"
            checked={prefs.recommendations}
            onChange={(recommendations) => updatePreferences({ recommendations })}
          />
        </section>
        <p className="small-print">这些偏好保存在当前浏览器，修改后立即生效。</p>
      </div>
    </div>
  );
}
