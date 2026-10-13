import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dateInZone } from '@apple/domain';
import { manualDraftSchema, type ManualDraft } from '@apple/contracts';
import { z } from 'zod';
import { useGarden } from '../../app/garden-context';
import { PageHeading } from '../../components/PageHeading';
import { LineIcon, PixelIcon } from '../../components/PixelIcon';
import { AmbientScene, LivingMascot } from '../../components/AmbientScene';
import { EntryList } from '../projects/components/EntryList';
type Draft = ManualDraft & { key: string; selected: boolean };
const draftKey = 'apple-manual-draft-v2';
function restoreDraft(): { text: string; drafts: Draft[]; confirming: boolean } {
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
      };
    }
  } catch {
    /* 无草稿时从空输入开始。 */
  }
  return { text: '', drafts: [], confirming: false };
}
const blankDraft = (content = ''): Draft => ({
  key: crypto.randomUUID(),
  selected: true,
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
  const { projects, saveEntries, busy } = useGarden();
  const [savedDraft] = useState(restoreDraft);
  const [text, setText] = useState(savedDraft.text);
  const [drafts, setDrafts] = useState<Draft[]>(savedDraft.drafts);
  const [confirming, setConfirming] = useState(savedDraft.confirming);
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ text, drafts, confirming }));
    } catch {
      /* 请求失败时仍保留当前页面输入。 */
    }
  }, [text, drafts, confirming]);
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
        ((item.type !== 'task' && item.type !== 'goal') ||
          (item.projectId && item.content.length <= 200)),
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
        contribution: item.contribution,
        goalType: item.goalType,
        target: item.target,
        unit: item.unit,
      })),
    );
    if (!feedback) return;
    setText('');
    setDrafts([]);
    setConfirming(false);
    if (feedback.growthProjectIds.length) navigate('/growth', { state: { feedback } });
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
          <PixelIcon name="mascot" size={62} />
          <p>
            把今天的努力安放好，
            <br />
            确认后就能给树浇水啦～
          </p>
        </div>
        <p className="small-print">请手动选择分类和方向；未归类记录也能保存。</p>
        <div className="draft-list">
          {drafts.map((item) => {
            const project = projects.find((project) => project.id === item.projectId);
            const contributes =
              item.type === 'action' &&
              project?.goalId &&
              !project.goalCompleted &&
              project.goalType !== 'manual';
            return (
              <article className={`draft-card ${project?.color || 'peach'}`} key={item.key}>
                <div className="draft-card-top">
                  <PixelIcon name={project?.icon || 'apple'} size={44} />
                  <div className="draft-selects">
                    <select
                      aria-label="关联项目"
                      value={item.projectId || ''}
                      onChange={(event) =>
                        update(item.key, { projectId: event.target.value || null, contribution: 0 })
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
                  maxLength={item.type === 'task' || item.type === 'goal' ? 200 : 2000}
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
                  {contributes && (
                    <label>
                      推进目标（不推进填 0）
                      <input
                        aria-label="目标贡献"
                        type="number"
                        min="0"
                        step={project.goalType === 'count' ? 1 : 0.1}
                        value={item.contribution}
                        onChange={(event) =>
                          update(item.key, { contribution: Number(event.target.value) })
                        }
                      />
                    </label>
                  )}
                  {item.type === 'goal' && (
                    <>
                      <label>
                        目标方式
                        <select
                          aria-label="目标方式"
                          value={item.goalType}
                          onChange={(event) => {
                            const goalType = event.target.value as Draft['goalType'];
                            update(item.key, {
                              goalType,
                              target:
                                goalType === 'percentage' ? 100 : goalType === 'manual' ? 1 : 10,
                            });
                          }}
                        >
                          <option value="manual">手动完成</option>
                          <option value="count">数量目标</option>
                          <option value="percentage">百分比</option>
                        </select>
                      </label>
                      {item.goalType === 'count' && (
                        <label>
                          目标数量
                          <input
                            aria-label="目标数量"
                            type="number"
                            min="1"
                            step="1"
                            value={item.target}
                            onChange={(event) =>
                              update(item.key, { target: Number(event.target.value) })
                            }
                          />
                        </label>
                      )}
                      <p className="small-print">保存会替换这个方向的当前目标，旧目标转为历史。</p>
                    </>
                  )}
                  {(item.type === 'task' || item.type === 'goal') && !item.projectId && (
                    <p className="small-print">计划和目标需要选择一个项目。</p>
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
        />
        <div className="input-footer">
          <span>{text.length}/2000</span>
          <span>多件事可以用句号分开</span>
        </div>
        <div className="example-chips">
          <button onClick={() => setText('今天剪完了一条视频。背了30个单词。想做一期生活采访。')}>
            试一段示例
          </button>
          <button onClick={() => setHistory(true)}>查看记录历史</button>
          <Link to="/projects">看看我的方向</Link>
        </div>
        <button
          className="coral-button full-width"
          disabled={!text.trim()}
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
