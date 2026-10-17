import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { EntryPage } from '../features/onboarding/EntryPage';
import { ProjectsPage } from '../features/projects/ProjectsPage';
import { RecordsPage } from '../features/records/RecordsPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { ProjectDetailPage } from '../features/projects/ProjectDetailPage';
import { WelcomePage, SeedPage } from '../features/onboarding/OnboardingPage';
import { GrowthPage, FruitPage } from '../features/growth/GrowthPage';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: (
      <div className="app-shell immersive-shell">
        <section className="connection-screen">
          <img src="/assets/figma21/mascot-sad.webp" width="120" height="120" alt="" />
          <h1>页面暂时没打开</h1>
          <p>
            可能刚刚更新了版本，或连接短暂中断。
            <br />
            已经保存的记录还在。
          </p>
          <button className="coral-button" onClick={() => window.location.reload()}>
            重新打开
          </button>
          <p>
            <a href="/">回到我的树林 →</a>
          </p>
        </section>
      </div>
    ),
    children: [
      { path: '/', element: <EntryPage /> },
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/projects/:id', element: <ProjectDetailPage /> },
      { path: '/welcome', element: <WelcomePage /> },
      { path: '/seed', element: <SeedPage /> },
      {
        path: '/seed/ai',
        lazy: async () => ({
          Component: (await import('../features/onboarding/AISeedPage')).AISeedPage,
        }),
      },
      {
        path: '/goals',
        lazy: async () => ({ Component: (await import('../features/goals/GoalsPage')).GoalsPage }),
      },
      {
        path: '/timeline',
        lazy: async () => ({
          Component: (await import('../features/timeline/TimelinePage')).TimelinePage,
        }),
      },
      {
        path: '/collection',
        lazy: async () => ({
          Component: (await import('../features/collection/CollectionPage')).CollectionPage,
        }),
      },
      {
        path: '/share',
        lazy: async () => ({
          Component: (await import('../features/collection/SharePage')).SharePage,
        }),
      },
      {
        path: '/preferences',
        lazy: async () => ({
          Component: (await import('../features/settings/PreferencesPage')).PreferencesPage,
        }),
      },
      {
        path: '/reminders',
        lazy: async () => ({
          Component: (await import('../features/settings/RemindersPage')).RemindersPage,
        }),
      },
      {
        path: '/reminders/preview',
        lazy: async () => ({
          Component: (await import('../features/settings/RemindersPage')).InactiveReminderPage,
        }),
      },
      {
        path: '/quiz',
        lazy: async () => ({
          Component: (await import('../features/settings/TreeQuizPage')).TreeQuizPage,
        }),
      },
      {
        path: '/projects/:id/plan',
        lazy: async () => ({
          Component: (await import('../features/projects/TaskPlannerPage')).TaskPlannerPage,
        }),
      },
      { path: '/growth', element: <GrowthPage /> },
      { path: '/fruit', element: <FruitPage /> },
      { path: '/records', element: <RecordsPage /> },
      { path: '/reports', element: <ReportsPage /> },
      { path: '/settings', element: <SettingsPage /> },
      {
        path: '*',
        element: (
          <section className="empty-state">
            <h1>没有找到这个页面</h1>
            <p>请通过底部导航继续。</p>
          </section>
        ),
      },
    ],
  },
]);
