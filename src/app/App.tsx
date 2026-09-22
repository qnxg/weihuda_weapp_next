import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense, useSyncExternalStore, type ReactNode } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "../auth/AuthProvider";
import { RequireAuth } from "../auth/RequireAuth";
import { getTfaChallenge, subscribeTfaChallenge } from "../auth/tfa";
import { PageSkeleton } from "../components/ui";
import { AppErrorBoundary } from "./AppErrorBoundary";
import { AppShell } from "./AppShell";

const TodayPage = lazy(() => import("../pages/TodayPage"));
const SchedulePage = lazy(() => import("../pages/SchedulePage"));
const ServicesPage = lazy(() => import("../pages/ServicesPage"));
const ProfilePage = lazy(() => import("../pages/ProfilePage"));
const LoginPage = lazy(() => import("../pages/LoginPage"));
const TfaPage = lazy(() => import("../pages/TfaPage"));
const FeedbackPage = lazy(() => import("../pages/FeedbackPage"));
const NoticesPage = lazy(() => import("../pages/NoticesPage"));
const SettingsPage = lazy(() => import("../pages/SettingsPage"));
const AboutPage = lazy(() => import("../pages/AboutPage"));
const CardPage = lazy(() => import("../pages/services/CardPage"));
const GradesPage = lazy(() => import("../pages/services/GradesPage"));
const PointsPage = lazy(() => import("../pages/services/PointsPage"));
const DormPage = lazy(() => import("../pages/services/DormPage"));
const NetworkPage = lazy(() => import("../pages/services/NetworkPage"));
const ExamsPage = lazy(() => import("../pages/services/ExamsPage"));
const GymPage = lazy(() => import("../pages/services/GymPage"));
const LabPage = lazy(() => import("../pages/services/LabPage"));
const RoomsPage = lazy(() => import("../pages/services/RoomsPage"));
const AnnouncementsPage = lazy(() => import("../pages/services/AnnouncementsPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

function Protected({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}

function TfaRedirect() {
  const challenge = useSyncExternalStore(subscribeTfaChallenge, getTfaChallenge, () => null);
  const location = useLocation();
  return challenge && location.pathname !== "/tfa" ? <Navigate replace to="/tfa" /> : null;
}

function NotFoundPage() {
  return (
    <div className="page">
      <h1>页面不存在</h1>
      <p className="muted">这个地址没有对应的校园服务。</p>
      <Link className="button button--primary" to="/">返回今日</Link>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <TfaRedirect />
          <AppErrorBoundary>
            <Suspense fallback={<div className="page"><PageSkeleton rows={6} /></div>}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/tfa" element={<Protected><TfaPage /></Protected>} />
                <Route element={<AppShell />}>
                  <Route index element={<TodayPage />} />
                  <Route path="schedule" element={<SchedulePage />} />
                  <Route path="services" element={<ServicesPage />} />
                  <Route path="me" element={<ProfilePage />} />
                  <Route path="feedback" element={<FeedbackPage />} />
                  <Route path="about" element={<AboutPage />} />
                  <Route path="notices" element={<Protected><NoticesPage /></Protected>} />
                  <Route path="settings" element={<Protected><SettingsPage /></Protected>} />
                  <Route path="services/card" element={<Protected><CardPage /></Protected>} />
                  <Route path="services/grades" element={<Protected><GradesPage /></Protected>} />
                  <Route path="services/points" element={<Protected><PointsPage /></Protected>} />
                  <Route path="services/dorm" element={<Protected><DormPage /></Protected>} />
                  <Route path="services/network" element={<Protected><NetworkPage /></Protected>} />
                  <Route path="services/exams" element={<Protected><ExamsPage /></Protected>} />
                  <Route path="services/gym" element={<Protected><GymPage /></Protected>} />
                  <Route path="services/lab" element={<Protected><LabPage /></Protected>} />
                  <Route path="services/rooms" element={<Protected><RoomsPage /></Protected>} />
                  <Route path="services/announcements" element={<Protected><AnnouncementsPage /></Protected>} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Routes>
            </Suspense>
          </AppErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
