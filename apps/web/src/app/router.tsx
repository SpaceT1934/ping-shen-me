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
    children: [
      { path: '/', element: <EntryPage /> },
      { path: '/projects', element: <ProjectsPage /> },
      { path: '/projects/:id', element: <ProjectDetailPage /> },
      { path: '/welcome', element: <WelcomePage /> },
      { path: '/seed', element: <SeedPage /> },
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
