import { NavLink, Outlet, ScrollRestoration, useLocation, Link } from 'react-router-dom';
import { useRef } from 'react';
import { LineIcon } from '../components/Illustration';
import { useDesignMotion } from '../design/use-design-motion';
import { useGardenPreferences } from '../features/settings/use-garden-preferences';
const navigation = [
  ['/', '我的树', 'home'],
  ['/projects', '项目', 'projects'],
  ['/records', '记录', 'record'],
  ['/reports', '生长', 'review'],
  ['/settings', '我的', 'user'],
] as const;
export function AppLayout() {
  const { pathname } = useLocation();
  const surface = useRef<HTMLElement>(null);
  useDesignMotion(surface, pathname);
  const { notice } = useGardenPreferences();
  const immersive = [
    '/welcome',
    '/seed',
    '/seed/ai',
    '/growth',
    '/fruit',
    '/share',
    '/quiz',
  ].includes(pathname);
  return (
    <div
      className={`app-shell ${pathname === '/' ? 'home-shell' : ''} ${immersive ? 'immersive-shell' : ''}`}
    >
      <main ref={surface}>
        <Outlet />
      </main>
      {notice && !immersive && (
        <Link className="garden-reminder" to={notice.to}>
          {notice.text} →
        </Link>
      )}
      <ScrollRestoration />
      {!immersive && (
        <nav className="bottom-nav" aria-label="主导航">
          {navigation.map(([path, label, icon]) => (
            <NavLink key={path} to={path} end={path === '/'}>
              {icon === 'record' ? (
                <LineIcon name="plus" size={26} />
              ) : (
                <LineIcon
                  name={
                    {
                      home: 'home',
                      projects: 'projects',
                      review: 'review',
                      user: 'user',
                    }[icon] as 'home' | 'projects' | 'review' | 'user'
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
