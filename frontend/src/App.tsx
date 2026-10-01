import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { Spinner } from './components/ui/Spinner';
import { RedirectIfAuthed, RequireAuth } from './features/auth/RequireAuth';
import EmailDetailPage from './pages/EmailDetailPage';
import LoginPage from './pages/LoginPage';
import MailboxPage from './pages/MailboxPage';

// The rich-text editor is the heaviest dependency; only load it when composing.
const ComposePage = lazy(() => import('./pages/ComposePage'));

/** The backend lands users on /dashboard after Google/Slack OAuth; keep its query (?slack=…). */
function DashboardRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/scheduled', search }} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <LoginPage />
          </RedirectIfAuthed>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        {/* key: switching tabs resets search + filter */}
        <Route path="/scheduled" element={<MailboxPage key="scheduled" tab="scheduled" />} />
        <Route path="/sent" element={<MailboxPage key="sent" tab="sent" />} />
      </Route>
      <Route
        path="/emails/:id"
        element={
          <RequireAuth>
            <EmailDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/compose"
        element={
          <RequireAuth>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <Spinner />
                </div>
              }
            >
              <ComposePage />
            </Suspense>
          </RequireAuth>
        }
      />
      <Route path="/dashboard" element={<DashboardRedirect />} />
      <Route path="*" element={<Navigate to="/scheduled" replace />} />
    </Routes>
  );
}
