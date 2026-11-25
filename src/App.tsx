import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './stores/auth';
import { useApplySettings, useSettings } from './stores/settings';
import { isBackendConfigured } from './lib/config';
import { AppLayout } from './components/layout/AppLayout';
import { AuthPage } from './features/auth/AuthPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { SetupRequired } from './features/auth/SetupRequired';
import { ConfirmHost, Spinner, Toaster } from './components/ui/misc';
import { ReminderRunner } from './features/tasks/ReminderRunner';
import { useT } from './i18n';
import TodayPage from './features/today/TodayPage';

const CalendarPage = lazy(() => import('./features/calendar/CalendarPage'));
const JournalPage = lazy(() => import('./features/journal/JournalPage'));
const JournalEntryPage = lazy(() => import('./features/journal/JournalEntryPage'));
const TasksPage = lazy(() => import('./features/tasks/TasksPage'));
const NotebooksPage = lazy(() => import('./features/notebooks/NotebooksPage'));
const NotebookPage = lazy(() => import('./features/notebooks/NotebookPage'));
const SketchbookPage = lazy(() => import('./features/sketch/SketchbookPage'));
const SketchEditorPage = lazy(() => import('./features/sketch/SketchEditorPage'));
const HabitsPage = lazy(() => import('./features/habits/HabitsPage'));
const GoalsPage = lazy(() => import('./features/goals/GoalsPage'));
const GoalDetailPage = lazy(() => import('./features/goals/GoalDetailPage'));
const ProjectsPage = lazy(() => import('./features/projects/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./features/projects/ProjectDetailPage'));
const InsightsPage = lazy(() => import('./features/insights/InsightsPage'));
const FocusPage = lazy(() => import('./features/focus/FocusPage'));
const SettingsPage = lazy(() => import('./features/settings/SettingsPage'));
const SearchPage = lazy(() => import('./features/search/SearchPage'));
const HomePage = lazy(() => import('./features/home/HomePage'));
const WelcomePage = lazy(() => import('./features/home/WelcomePage'));
const PrintPage = lazy(() => import('./features/export/PrintPage'));

function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to={loc.pathname === '/' ? '/welcome' : '/auth/login'} replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

function StartPage() {
  const { start_page } = useSettings();
  return <Navigate to={start_page === 'home' ? '/home' : '/today'} replace />;
}

function SettingsApplier() {
  const settings = useSettings();
  useApplySettings(settings);
  return null;
}

export default function App() {
  const recovery = useAuth((s) => s.recovery);
  const t = useT();

  useEffect(() => {
    // remove ?code=... left over from the auth redirect
    if (window.location.search.includes('code=')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('code');
      window.history.replaceState(null, '', url.toString());
    }
  }, []);

  if (!isBackendConfigured) return <SetupRequired />;

  return (
    <HashRouter>
      <SettingsApplier />
      <Toaster />
      <ConfirmHost cancelLabel={t('Cancel')} okLabel={t('Confirm')} />
      <Suspense fallback={<Loading />}>
        {recovery ? (
          <ResetPasswordPage />
        ) : (
          <Routes>
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/auth/:mode" element={<AuthPage />} />
            <Route path="/print/:kind/:id" element={<Protected><PrintPage /></Protected>} />
            <Route
              element={
                <Protected>
                  <ReminderRunner />
                  <AppLayout />
                </Protected>
              }
            >
              <Route path="/" element={<StartPage />} />
              <Route path="/home" element={<HomePage />} />
              <Route path="/today" element={<TodayPage />} />
              <Route path="/day/:date" element={<TodayPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/journal" element={<JournalPage />} />
              <Route path="/journal/:id" element={<JournalEntryPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/notebooks" element={<NotebooksPage />} />
              <Route path="/notebooks/:id" element={<NotebookPage />} />
              <Route path="/notebooks/:id/:pageId" element={<NotebookPage />} />
              <Route path="/sketchbook" element={<SketchbookPage />} />
              <Route path="/sketchbook/:id" element={<SketchEditorPage />} />
              <Route path="/habits" element={<HabitsPage />} />
              <Route path="/goals" element={<GoalsPage />} />
              <Route path="/goals/:id" element={<GoalDetailPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/focus" element={<FocusPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/today" replace />} />
            </Route>
          </Routes>
        )}
      </Suspense>
    </HashRouter>
  );
}
