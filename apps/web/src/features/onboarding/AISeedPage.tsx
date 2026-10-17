import { Link } from 'react-router-dom';
import { PageHeading } from '../../components/PageHeading';
import { Illustration } from '../../components/Illustration';
import { AIProjectSeed } from './AIProjectSeed';
import { useState } from 'react';
export function AISeedPage() {
  const [generated, setGenerated] = useState(false);
  return (
    <div className="ai-chat-page">
      <PageHeading title={generated ? '生成我的树们' : 'AI 创建我的树们'} back="/welcome" />
      {!generated && (
        <div className="ai-chat-message">
          <Illustration name="mascot-calm" size={90} />
          <div className="speech-bubble">
            嗨！我是苹什么～
            <br />
            我可以帮你把想做的事
            <br />
            变成一棵棵可爱的树～
            <br />
            你想一起种下什么呢？
          </div>
        </div>
      )}
      <AIProjectSeed onStageChange={setGenerated} />
      <Link className="text-button full-width" to="/seed">
        我想自己种一棵 →
      </Link>
    </div>
  );
}
