import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
import { ApiError } from './api/client';
import App from './App';
import { currentUserKey } from './features/auth/useCurrentUser';
import './index.css';

const queryClient: QueryClient = new QueryClient({
  // Session expired mid-use: mark the user logged out so RequireAuth redirects to /login.
  queryCache: new QueryCache({
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) queryClient.setQueryData(currentUserKey, null);
    },
  }),
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster position="bottom-right" toastOptions={{ style: { fontSize: 13 } }} />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
