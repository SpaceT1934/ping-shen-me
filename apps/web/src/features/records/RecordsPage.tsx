import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dateInZone } from '@apple/domain';
import { manualDraftSchema, type ManualDraft } from '@apple/contracts';
import { z } from 'zod';
import { useGarden } from '../../app/garden-context';
import { PageHeading } from '../../components/PageHeading';
import { LineIcon, ArtIcon, Illustration } from '../../components/Illustration';
import { AmbientScene, LivingMascot } from '../../components/AmbientScene';
import { createUuid } from '../../lib/uuid';
import { EntryList } from '../projects/components/EntryList';
import { SpeechInput } from '../../components/SpeechInput';
import { aiApi } from '../../lib/ai-api';
type Draft = ManualDraft & { key: string; selected: boolean };
const draftKey = 'apple-manual-draft-v2';
function restoreDraft(): {
  text: string;
  drafts: Draft[];
  confirming: boolean;
  source: 'text' | 'voice';
} {
  try {
    const value = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
    if (value && typeof value.text === 'string') {
      const parsed = z
        .array(manualDraftSchema.extend({ key: z.string(), selected: z.boolean() }))
        .max(50)
        .safeParse(value.drafts);
      return {
        text: value.text.slice(0, 2000),
        drafts: parsed.success ? parsed.data : [],
        confirming: parsed.success && value.confirming === true,
        source: value.source === 'voice' ? 'voice' : 'text',
      };
    }
  } catch {
    /* 无草稿时从空输入开始。 */
  }
  return { text: '', drafts: [], confirming: false, source: 'text' };
}
const blankDraft = (content = ''): Draft => ({
  key: createUuid(),
  selected: true,
  goalId: null,
  content,
  projectId: null,
  type: 'action',
  date: dateInZone(new Date()),
  dueDate: null,
  contribution: 0,
  goalType: 'manual',
  target: 1,
  unit: '',
});
export function RecordsPage() {
  const { projects, state, saveEntries, busy } = useGarden();
  const [savedDraft] = useState(restoreDraft);
  const [text, setText] = useState(savedDraft.text);
  const [inputSource, setInputSource] = useState<'text' | 'voice'>(savedDraft.source);
  const [drafts, setDrafts] = useState<Draft[]>(savedDraft.drafts);
  const [confirming, setConfirming] = useState(savedDraft.confirming);
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ text, drafts, confirming, source: inputSource }),
      );
    } catch {
      /* 请求失败时仍保留当前页面输入。 */
    }
  }, [text, drafts, confirming, inputSource]);
  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((previous) =>
      previous.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  const selected = drafts.filter((item) => item.selected);
  const hasGrowth = selected.some((item) => item.type === 'action' && item.projectId);
  const valid =
    selected.length > 0 &&
    selected.every(
      (item) =>
        item.content.trim() &&
        (item.type !== 'task' || (item.projectId && item.content.length <= 200)) &&
        Number.isFinite(item.contribution) &&
        item.contribution >= 0 &&
        (item.contribution === 0 ||
          Boolean(
            item.goalId &&
            state.goals.some(
              (goal) =>
                goal.id === item.goalId &&
                goal.projectId === item.projectId &&
                !goal.completedAt &&
                (goal.type !== 'count' || Number.isInteger(item.contribution)),
            ),
          )),
    );
  const save = async () => {
    if (!valid) return;
    const feedback = await saveEntries(
      selected.map((item) => ({
        content: item.content,
        projectId: item.projectId,
        type: item.type,
        date: item.date,
        dueDate: item.dueDate,
        goalId: item.type === 'action' ? item.goalId : null,
        contribution: item.contribution,
        goalType: item.goalType,
        target: item.target,
        unit: item.unit,
        sourceText: item.sourceText,
        emotion: item.emotion,
        source: item.source ?? inputSource,
      })),
      text,
    );
    if (!feedback) return;
    setText('');
    setInputSource('text');
    setDrafts([]);
    setConfirming(false);
    if (feedback.growthProjectIds.length)
      navigate('/growth', {
        state: {
          feedback,
          actionCount: selected.filter((item) => item.type === 'action' && item.projectId).length,
        },
      });
    else if (feedback.resultIds[0]) navigate(`/fruit?result=${feedback.resultIds[0]}`);
    else setNotice('记录已保存，可以在项目详情或记录历史里查看。');
  };
  if (history)
    return (
      <div className="paper-page">
        <PageHeading title="我的记录" onBack={() => setHistory(false)} />
        <EntryList />
      </div>
    );
  if (confirming)
    return (
      <div className="paper-page confirm-page">
        <PageHeading title="确认今天的小进步" onBack={() => setConfirming(false)} />
        <div className="confirm-intro">
          <ArtIcon name="mascot" size={62} />
          <p>
            把今天的努力安放好，
            <br />
            确认后就能给树浇水啦～
          </p>
        </div>
        <p className="small-print">
          请检查分类、方向和日期；未归类记录也能保存。目标进度由你确认贡献数量。
        </p>
        {drafts[0]?.sourceText && (
          <section className="fig-card ai-classification">
            <h2>AI 建议归类</h2>
            <p>
              {projects.find((project) => project.id === drafts[0]?.projectId)?.name ||
                '还没有匹配的项目，可以自行选择。'}
            </p>
            <p className="small-print">也可能是以下项目：</p>
            <div className="fig-filter">
              {projects
                .filter((project) => project.status === 'active')
                .map((project) => (
                  <button
                    key={project.id}
                    aria-pressed={drafts[0]?.projectId === project.id}
                    onClick={() =>
                      update(drafts[0]!.key, {
                        projectId: project.id,
                        goalId: null,
                        contribution: 0,
                      })
                    }
                  >
                    {project.name}
                  </button>
                ))}
            </div>
          </section>
        )}
        <div className="draft-list">
          {drafts.map((item) => {
            const project = projects.find((project) => project.id === item.projectId);
            const goals = state.goals.filter(
              (goal) => goal.projectId === item.projectId && !goal.completedAt && !goal.archivedAt,
            );
            const goal = goals.find((goal) => goal.id === item.goalId);
            return (
              <article className={`draft-card ${project?.color || 'peach'}`} key={item.key}>
                {item.sourceText && (
                  <p className="small-print">
                    来自：{item.sourceText}
                    {item.emotion ? ` · 情绪：${item.emotion}` : ''}
                  </p>
                )}
                <div className="draft-card-top">
                  <ArtIcon name={project?.icon || 'apple'} size={44} />
                  <div className="draft-selects">
                    <select
                      aria-label="关联项目"
                      value={item.projectId || ''}
                      onChange={(event) =>
                        update(item.key, {
                          projectId: event.target.value || null,
                          goalId: null,
                          contribution: 0,
                        })
                      }
                    >
                      <option value="">未归类</option>
                      {projects
                        .filter((project) => project.status === 'active')
                        .map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                    </select>
                    <select
                      aria-label="记录类型"
                      value={item.type}
                      onChange={(event) =>
                        update(item.key, {
                          type: event.target.value as Draft['type'],
                          goalId: null,
                          contribution: 0,
                        })
                      }
                    >
                      <option value="action">行动</option>
                      <option value="task">计划</option>
                      <option value="idea">灵感</option>
                      <option value="goal">目标</option>
                    </select>
                  </div>
                  <input
                    type="checkbox"
                    aria-label={`保存${item.content}`}
                    checked={item.selected}
                    onChange={(event) => update(item.key, { selected: event.target.checked })}
                  />
                </div>
                <textarea
                  aria-label="记录内容"
                  value={item.content}
                  onChange={(event) => update(item.key, { content: event.target.value })}
                  rows={2}
                  maxLength={item.type === 'task' ? 200 : 2000}
                />
                <div className="draft-extras">
                  <label>
                    {item.type === 'task' ? '计划日期' : '发生日期'}
                    <input
                      aria-label={item.type === 'task' ? '计划日期' : '发生日期'}
                      type="date"
                      value={item.type === 'task' ? item.dueDate || '' : item.date}
                      max={item.type === 'task' ? undefined : dateInZone(new Date())}
                      onChange={(event) =>
                        update(
                          item.key,
                          item.type === 'task'
                            ? { dueDate: event.target.value || null }
                            : { date: event.target.value },
                        )
                      }
                    />
                  </label>
                  {item.type === 'action' && item.projectId && (
                    <div className="contribution-editor">
                      <label>
                        关联目标（可选）
                        <select
                          aria-label="关联目标"
                          value={item.goalId || ''}
                          onChange={(event) =>
                            update(item.key, {
                              goalId: event.target.value || null,
                              contribution: 0,
                            })
                          }
                        >
                          <option value="">仅记录行动，不推进目标</option>
                          {goals.map((goal) => (
                            <option key={goal.id} value={goal.id}>
                              {goal.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      {goal && goal.type !== 'manual' && (
                        <label>
                          确认本次实际完成
                          {goal.type === 'percentage'
                            ? '的百分点'
                            : `的数量（${goal.unit || '个'}）`}
                          <input
                            aria-label="本次目标贡献"
                            type="number"
                            min="0"
                            max={goal.target}
                            step={goal.type === 'count' ? 1 : 0.1}
                            value={item.contribution}
                            required
                            onChange={(event) =>
                              update(item.key, { contribution: Number(event.target.value) })
                            }
                          />
                        </label>
                      )}
                      <p className="small-print">
                        {goal?.type === 'manual'
                          ? '手动目标请在目标详情确认达成；这条行动只作关联记录。'
                          : '默认不增加进度。只有实际符合目标指标时才填写；剪完视频不等于发布视频。'}
                      </p>
                    </div>
                  )}
                  {item.type === 'goal' && (
                    <p className="small-print">
                      保存为目标建议，不会替换当前目标。设置目标请到项目详情。
                    </p>
                  )}
                  {item.type === 'task' && !item.projectId && (
                    <p className="small-print">计划需要选择一个项目。</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <button
          className="text-button add-record"
          disabled={drafts.length >= 50}
          onClick={() => setDrafts((previous) => [...previous, blankDraft()])}
        >
          <LineIcon name="plus" size={18} />
          手动添加一条
        </button>
        <div className="confirmation-actions">
          <button
            className="dark-button full-width"
            disabled={!valid || busy}
            onClick={() => void save()}
          >
            {busy ? '正在保存…' : hasGrowth ? '确认并浇水' : '保存记录'}
            <LineIcon name="arrow" size={20} />
          </button>
          <button className="text-button full-width" onClick={() => setConfirming(false)}>
            返回修改原文
          </button>
        </div>
      </div>
    );
  return (
    <div className="record-page">
      <div className="record-scene">
        <AmbientScene indoor />
        <PageHeading title="今天，发生了什么？" />
        <div className="speech-bubble record-bubble">
          不用写得很完整，
          <br />
          今天的一点努力，也值得记下来。
        </div>
        <div className="record-mascot">
          <LivingMascot size={105} />
        </div>
      </div>
      <section className="record-panel">
        <span className="record-mic" aria-hidden="true">
          <LineIcon name="record" size={32} />
        </span>
        <h2>写下今天的一点努力</h2>
        <textarea
          aria-label="今天的记录"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="今天剪完了一条视频。背了30个单词。明天想去拍些新素材…"
          rows={4}
          maxLength={2000}
          disabled={analyzing || voiceBusy}
        />
        <div className="input-footer">
          <span>{text.length}/2000</span>
          <span>多件事可以用句号分开</span>
        </div>
        <SpeechInput
          onBusyChange={setVoiceBusy}
          disabled={analyzing}
          maxChars={2000 - text.length - (text ? 1 : 0)}
          onText={(value) => {
            setInputSource('voice');
            setText((previous) => (previous ? `${previous}\n${value}` : value));
          }}
        />
        <div className="example-chips">
          <button
            disabled={analyzing || voiceBusy}
            onClick={() => setText('今天剪完了一条视频。背了30个单词。想做一期生活采访。')}
          >
            试一段示例
          </button>
          <button disabled={analyzing || voiceBusy} onClick={() => setHistory(true)}>
            查看记录历史
          </button>
          <Link to="/projects">看看我的方向</Link>
        </div>
        <div className="record-growth-preview">
          <Illustration name="tree-large-full" size={130} />
          <p>
            每一次行动，
            <br />
            都在为小树浇水。
          </p>
          <Illustration name="mascot-watering" size={102} />
        </div>
        <button
          className="coral-button full-width"
          disabled={!text.trim() || analyzing || voiceBusy}
          onClick={async () => {
            setAnalyzing(true);
            setNotice('');
            try {
              const result = await aiApi.records(text, inputSource);
              if (!result.items.length) {
                setNotice('没有识别出可保存的事项，可以补充描述或手动整理。');
                return;
              }
              setDrafts(result.items.map((item) => ({ ...blankDraft(), ...item })));
              setConfirming(true);
            } catch (cause) {
              setNotice(cause instanceof Error ? cause.message : '整理失败，原文已保留');
            } finally {
              setAnalyzing(false);
            }
          }}
        >
          {analyzing ? '正在整理记录…' : 'AI 整理记录'}
        </button>
        <button
          className="outline-button full-width"
          disabled={!text.trim() || analyzing || voiceBusy}
          onClick={() => {
            const items = text
              .split(/[。；;\n]+/)
              .map((item) => item.trim())
              .filter(Boolean)
              .map(blankDraft);
            if (items.length) {
              if (items.length > 50) {
                setNotice('单次最多整理 50 条，请分批保存；原文已保留。');
                return;
              }
              setDrafts(items);
              setConfirming(true);
            }
          }}
        >
          手动整理记录
          <LineIcon name="arrow" size={20} />
        </button>
        <p className="record-notice" role="status">
          {notice || '未提交的草稿会保留在当前浏览器会话中。'}
        </p>
      </section>
    </div>
  );
}
