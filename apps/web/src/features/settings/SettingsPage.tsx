import { Link } from 'react-router-dom';
import { useGarden } from '../../app/garden-context';
import { LineIcon, PixelIcon } from '../../components/PixelIcon';
import { PageHeading } from '../../components/PageHeading';
export function SettingsPage() {
  const { projects, entries, results, state } = useGarden();
  const exportData = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ ...state, operations: [] }, null, 2)], {
        type: 'application/json',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `苹什么_记录_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="paper-page settings-page">
      <PageHeading title="我的小花园" />
      <div className="profile-card">
        <PixelIcon name="mascot" size={100} />
        <h2>慢慢长大的你</h2>
        <p>不用着急，按自己的节奏来。</p>
        <span className="profile-badge">手动记录 · 匿名体验</span>
      </div>
      <div className="profile-stats">
        <span>
          <strong>{projects.length}</strong>成长方向
        </span>
        <span>
          <strong>{entries.filter((item) => item.type === 'action').length}</strong>行动记录
        </span>
        <span>
          <strong>{results.length}</strong>已达成果
        </span>
      </div>
      <div className="settings-list">
        <Link to="/">
          <LineIcon name="home" />
          我的树
          <LineIcon name="arrow" size={18} />
        </Link>
        <Link to="/reports">
          <LineIcon name="review" />
          数据与报告
          <LineIcon name="arrow" size={18} />
        </Link>
        <Link to="/welcome">
          <PixelIcon name="apple" size={27} />
          关于苹什么
          <LineIcon name="arrow" size={18} />
        </Link>
      </div>
      <section className="experience-note">
        <h3>记录与数据</h3>
        {projects.some((item) => ['media', 'ielts', 'intern', 'practice'].includes(item.id)) && (
          <p>已保留旧版体验数据，其中可能包含早期示例项目，可按需编辑和归档。</p>
        )}
        <p>项目、记录、成长与成果已保存到服务端数据库。此浏览器通过匿名会话打开自己的花园。</p>
        <p>
          当前还没有手机号或第三方登录。换浏览器、清除 Cookie
          后会进入新花园；服务端历史数据仍保留。建议定期导出记录。
        </p>
        <button className="outline-button full-width" onClick={exportData}>
          导出我的记录
        </button>
        <p className="small-print">
          成长阶段暂采用：刚种下、萌芽、枝叶舒展、茂盛。每条有效行动等权累计。
        </p>
      </section>
      <p className="settings-footer">
        苹什么 <span>·</span> 把努力种成一棵树
      </p>
    </div>
  );
}
