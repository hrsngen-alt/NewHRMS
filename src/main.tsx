import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { routeTree } from './routeTree.gen';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

// Navigation loop protection
let navCount = 0;
const MAX_NAV = 20;
const router = createRouter({
  routeTree,
  context: { queryClient },
});

router.subscribe('onBeforeNavigate', () => {
  navCount++;
  if (navCount > MAX_NAV) {
    console.error("CRITICAL: Infinite navigation loop detected. Stopping.");
    throw new Error("Navigation loop detected");
  }
  // Reset count after 2 seconds of stability
  setTimeout(() => { navCount = Math.max(0, navCount - 1); }, 2000);
});

let root: ReactDOM.Root | null = null;

function renderApp() {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  if (!root) {
    root = ReactDOM.createRoot(rootElement);
    root.render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );
  }
}

// Initial render
renderApp();
