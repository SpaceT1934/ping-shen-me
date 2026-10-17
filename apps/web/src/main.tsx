import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { GardenProvider } from './app/GardenProvider';
import './styles/global.css';
import './styles/journal-fonts.css';
import './styles/journal.css';
import './styles/figma21.css';

// A tab may still hold an older entry bundle after main deploys new route chunks.
window.addEventListener('vite:preloadError', (event) => {
  if (!navigator.onLine) return;
  try {
    const key = 'apple-last-chunk-refresh';
    const now = Date.now();
    if (now - Number(sessionStorage.getItem(key) || 0) < 60_000) return;
    sessionStorage.setItem(key, String(now));
    event.preventDefault();
    window.location.reload();
  } catch {
    /* The route error screen remains available when storage is blocked. */
  }
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <GardenProvider>
        <RouterProvider router={router} />
      </GardenProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
