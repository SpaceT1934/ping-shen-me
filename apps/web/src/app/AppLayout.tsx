import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { LineIcon } from '../components/PixelIcon';
const navigation = [
  ['/', '首页', 'home'],
  ['/projects', '项目', 'projects'],
  ['/records', '记录', 'record'],
  ['/reports', '回顾', 'review'],
  ['/settings', '我的', 'user'],
] as const;
export function AppLayout() {
  const { pathname } = useLocation();
  const immersive = ['/welcome', '/seed', '/growth', '/fruit'].includes(pathname);
  return (
    <div
      className={`app-shell ${pathname === '/' ? 'home-shell' : ''} ${immersive ? 'immersive-shell' : ''}`}
    >
      <main>
        <Outlet />
      </main>
      <ScrollRestoration />
      {!immersive && (
        <nav className="bottom-nav" aria-label="主导航">
          {navigation.map(([path, label, icon]) => (
            <NavLink key={path} to={path} end={path === '/'}>
              <LineIcon name={icon} size={23} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
