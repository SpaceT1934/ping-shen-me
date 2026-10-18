import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GoalInput, ProjectCandidate } from '@apple/contracts';
import { useGarden } from '../../app/garden-context';
import { SpeechInput } from '../../components/SpeechInput';
import { aiApi } from '../../lib/ai-api';
import { createUuid } from '../../lib/uuid';
import { GoalFields } from '../projects/components/GoalFields';
import { ProjectTree } from '../../components/GardenVisuals';
import { categories, updatePreferences, usePreferences } from '../../lib/preferences';

type Candidate = ProjectCandidate & {
  key: string;
  selected: boolean;
  goal: GoalInput | null;
  category: string;
};
export function AIProjectSeed({ onStageChange }: { onStageChange?: (generated: boolean) => void }) {
  const [text, setText] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pending, setPending] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [error, setError] = useState('');
  const { addProjects, busy } = useGarden();
  const navigate = useNavigate();
  const prefs = usePreferences();
  const update = (key: string, patch: Partial<Candidate>) =>
    setCandidates((items) =>
      items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  const selected = candidates.filter((item) => item.selected);
  const valid =
    selected.length > 0 &&
    selected.every(
      (item) =>
        item.name.trim() && (!item.goal || (item.goal.title.trim() && item.goal.target > 0)),
    );
  return (
    <section className="seed-panel ai-seed">
      {candidates.length === 0 && (
        <>
          <h2>先聊聊你想做的事</h2>
          <textarea
            aria-label="描述成长方向"
            placeholder="我在做自媒体，也准备考雅思，希望三个月达到7分。"
            rows={3}
            maxLength={200}
            value={text}
            disabled={pending || busy || voiceBusy}
            onChange={(event) => setText(event.target.value)}
          />
          <p className="small-print">{text.length}/200 · AI 会整理成可修改的方向，确认后才种下。</p>
          <SpeechInput
            onBusyChange={setVoiceBusy}
            disabled={pending || busy}
            maxChars={200 - text.length - (text ? 1 : 0)}
            onText={(value) => setText((previous) => (previous ? `${previous}\n${value}` : value))}
          />
          <button
            type="button"
            className="coral-button full-width"
            disabled={!text.trim() || pending || busy || voiceBusy}
            onClick={async () => {
              setPending(true);
              setError('');
              try {
                const result = await aiApi.projects(text);
                setCandidates(
                  result.candidates.map((item) => ({
                    ...item,
                    key: createUuid(),
                    selected: true,
                    category: item.category || '其他',
                    goal: item.goalText
                      ? { title: item.goalText, type: 'manual', target: 1, unit: '' }
                      : null,
                  })),
                );
                onStageChange?.(result.candidates.length > 0);
                if (!result.candidates.length)
                  setError('还没有识别出方向，可以补充描述或手动创建。');
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : '整理失败，可以手动创建');
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? '正在整理方向…' : 'AI 整理成长方向'}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="record-notice">
          {error}
        </p>
      )}
      {candidates.length > 0 && (
        <div className="speech-bubble ai-seed-reply">
          我帮你整理了 {candidates.length} 个成长方向，
          <br />
          看看这些小树，喜欢吗？
        </div>
      )}
      {candidates.length > 0 && (
        <button
          className="text-button full-width"
          onClick={() => {
            setCandidates([]);
            onStageChange?.(false);
          }}
        >
          返回，修改想做的事
        </button>
      )}
      {candidates.map((item) => (
        <article className="ai-candidate" key={item.key}>
          <ProjectTree
            stage={0}
            size={78}
            fruits={
              item.goal
                ? [{ goalId: item.key, title: item.goal.title, percent: 0, resultId: null }]
                : []
            }
          />
          <div className="ai-candidate-fields">
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={item.selected}
                onChange={(event) => update(item.key, { selected: event.target.checked })}
              />
              种下这个方向
            </label>
            <label>
              方向名称
              <input
                aria-label="候选方向名称"
                maxLength={80}
                value={item.name}
                onChange={(event) => update(item.key, { name: event.target.value })}
              />
            </label>
            <label>
              成长分类
              <select
                value={item.category}
                onChange={(event) => update(item.key, { category: event.target.value })}
              >
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <details>
              <summary className="small-print">编辑阶段目标</summary>
              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={item.goal !== null}
                  onChange={(event) =>
                    update(item.key, {
                      goal: event.target.checked
                        ? { title: item.goalText ?? '', type: 'manual', target: 1, unit: '' }
                        : null,
                    })
                  }
                />
                设置阶段目标
              </label>
              {item.goal && (
                <GoalFields value={item.goal} onChange={(goal) => update(item.key, { goal })} />
              )}
              <p className="small-print">来自：{item.sourceText}</p>
            </details>
          </div>
        </article>
      ))}
      {candidates.length > 0 && (
        <button
          type="button"
          className="dark-button full-width"
          disabled={!valid || busy || pending || voiceBusy}
          onClick={async () => {
            const ids = await addProjects(
              selected.map((item) => ({
                name: item.name.trim(),
                category: item.category,
                goal: item.goal,
                icon:
                  item.category === '学习成长'
                    ? 'book'
                    : item.category === '工作事业'
                      ? 'work'
                      : 'green',
                color: 'sage',
              })),
            );
            if (ids) {
              updatePreferences({
                categories: {
                  ...prefs.categories,
                  ...Object.fromEntries(ids.map((id, index) => [id, selected[index]!.category])),
                },
              });
              navigate('/');
            }
          }}
        >
          {busy ? '正在种下…' : '确认，种下我的树们 →'}
        </button>
      )}
    </section>
  );
}
