import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { EmotionMessage } from '@apple/contracts';
import { PageHeading } from '../../components/PageHeading';
import { Illustration, LineIcon } from '../../components/Illustration';
import { SpeechInput } from '../../components/SpeechInput';
import { aiApi } from '../../lib/ai-api';
import { createUuid } from '../../lib/uuid';

type Turn = { id: string; text: string; history: EmotionMessage[] };
export function EmotionPage() {
  const location = useLocation();
  const [conversationId] = useState(createUuid);
  const [past, setPast] = useState<EmotionMessage[]>([]);
  const [turn, setTurn] = useState<Turn | null>(() => {
    const seed = (location.state as { initialMessage?: unknown } | null)?.initialMessage;
    return typeof seed === 'string' && seed.trim()
      ? { id: createUuid(), text: seed.trim().slice(0, 2000), history: [] }
      : null;
  });
  const [text, setText] = useState('');
  const [voiceBusy, setVoiceBusy] = useState(false);
  const latestMessage = useRef<HTMLElement>(null);
  const response = useQuery({
    queryKey: ['emotion-conversation', conversationId, turn?.id],
    queryFn: () => aiApi.emotions(turn!.text, turn!.history),
    enabled: Boolean(turn),
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
  });
  const messages: EmotionMessage[] = [
    ...past,
    ...(turn ? [{ role: 'user' as const, content: turn.text }] : []),
    ...(response.data ? [{ role: 'assistant' as const, content: response.data.reply }] : []),
  ];
  useEffect(() => {
    if (!turn) return;
    const frame = requestAnimationFrame(() => {
      if (latestMessage.current)
        window.scrollTo({
          top: Math.max(0, window.scrollY + latestMessage.current.getBoundingClientRect().top - 24),
          behavior: 'instant',
        });
    });
    return () => cancelAnimationFrame(frame);
  }, [turn, response.data?.reply]);
  const send = (value: string) => {
    const content = value.trim().slice(0, 2000);
    if (!content || response.isFetching || voiceBusy) return;
    setPast(messages);
    setTurn({ id: createUuid(), text: content, history: messages.slice(-10) });
    setText('');
  };
  return (
    <div className="paper-page emotion-page">
      <PageHeading title="说说心情" back="/" />
      <div className="emotion-intro">
        <Illustration name="mascot-calm" size={100} />
        <div className="speech-bubble">
          <h2>先不急着给今天打分</h2>
          <p>累了、委屈了，或者有点开心，都可以慢慢说。我在听。</p>
        </div>
      </div>
      <p className="emotion-boundary">
        <Illustration name="heart" size={20} />
        这里的聊天不会记成行动，也不会改变目标进度。
      </p>
      <section
        className="emotion-conversation"
        aria-label="与苹什猫说心情"
        aria-live="polite"
        aria-busy={response.isFetching}
      >
        {messages.map((message, index) => (
          <article
            key={index}
            ref={index === messages.length - 1 ? latestMessage : undefined}
            className={`emotion-message emotion-${message.role}`}
          >
            <span>{message.role === 'user' ? '我' : '苹什猫'}</span>
            <p>{message.content}</p>
          </article>
        ))}
        {turn && response.isFetching && (
          <div role="status" className="emotion-listening">
            我在听，先不用急着给今天下结论……
          </div>
        )}
        {response.error && (
          <div role="alert" className="fig-card">
            <p>暂时没连上，你刚才说的话还在这里。</p>
            <button className="outline-button" onClick={() => void response.refetch()}>
              再试一次
            </button>
          </div>
        )}
        {response.data?.mode === 'fallback' && (
          <p className="small-print">当前为基础陪伴回复。AI 暂未连接，稍后可以继续聊。</p>
        )}
      </section>
      {response.data && (
        <section className="emotion-today fig-card" aria-label="今天真实保存的行动">
          <h2>今天留下的点滴</h2>
          {response.data.today.action_count > 0 ? (
            <>
              <p>
                今天已保存 {response.data.today.action_count} 条行动。这些具体的小事，也值得被看见。
              </p>
              <ul>
                {response.data.today.actions.slice(0, 3).map((action) => (
                  <li key={action.id}>
                    <Illustration name="sprout" size={20} />
                    <span>
                      {action.content}
                      {action.project_name && <small>{action.project_name}</small>}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>今天还没有保存的行动记录。没有记录，不等于没有付出，也不用为了聊天补一条记录。</p>
          )}
        </section>
      )}
      {!turn && (
        <div className="emotion-suggestions" aria-label="从一句心情开始">
          {['我今天很累，觉得什么事情都没做', '今天有点委屈，想找人说说', '今天有一点开心'].map(
            (value) => (
              <button key={value} className="outline-button" onClick={() => send(value)}>
                {value}
              </button>
            ),
          )}
        </div>
      )}
      <form
        className="emotion-composer fig-card"
        onSubmit={(event) => {
          event.preventDefault();
          send(text);
        }}
      >
        <label htmlFor="emotion-text">现在的你，感觉怎么样？</label>
        <textarea
          id="emotion-text"
          value={text}
          maxLength={2000}
          rows={3}
          placeholder="比如：我很累，感觉今天什么都没做……"
          disabled={response.isFetching || voiceBusy}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="input-footer">
          <span>{text.length}/2000</span>
          <span>不用组织好语言</span>
        </div>
        <SpeechInput
          disabled={response.isFetching}
          onBusyChange={setVoiceBusy}
          maxChars={2000 - text.length - (text ? 1 : 0)}
          onText={(value) => setText((previous) => (previous ? `${previous}\n${value}` : value))}
        />
        <button
          className="coral-button full-width"
          disabled={!text.trim() || response.isFetching || voiceBusy}
          type="submit"
        >
          {response.isFetching ? '苹什猫正在听…' : '说给苹什猫听'}
          <LineIcon name="arrow" size={20} />
        </button>
      </form>
      {turn && (
        <button
          className="text-button"
          disabled={response.isFetching || voiceBusy}
          onClick={() => {
            setPast([]);
            setTurn(null);
          }}
        >
          重新聊聊
        </button>
      )}
      <Link className="text-button emotion-record-link" to="/records">
        想记录具体做过的事？去行动记录 →
      </Link>
    </div>
  );
}
