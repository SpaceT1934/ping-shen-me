import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { Illustration, LineIcon } from '../components/Illustration';
const navigation = [
  ['/', '我的树', 'home'],
  ['/projects', '项目', 'projects'],
  ['/records', '记录', 'record'],
  ['/reports', '成长', 'review'],
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
              {icon === 'record' ? (
                <LineIcon name="plus" size={26} />
              ) : (
                <Illustration
                  name={
                    {
                      home: 'nav-tree',
                      projects: 'nav-folder',
                      review: 'nav-chart',
                      user: 'nav-smile',
                    }[icon]
                  }
                  size={25}
                />
              )}
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
