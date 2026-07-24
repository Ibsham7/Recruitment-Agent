import { useState, useEffect, lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider, useNavigate } from "react-router";
import { Theme } from "../lib/types";
import { PRESETS } from "../lib/theme";
import { AuthProvider, useAuth } from "../lib/AuthContext";

// Pages (Lazy loaded for code splitting)
import Layout from "./layout";
const LandingPage = lazy(() => import("./landing/page"));
const AuthPage = lazy(() => import("./auth/page"));
const DashboardPage = lazy(() => import("./dashboard/page"));
const SetupPage = lazy(() => import("./setup/page"));
const PipelinePage = lazy(() => import("./pipeline/page"));
const CandidatePage = lazy(() => import("./candidate/page"));
const InterviewPage = lazy(() => import("./interview/page"));
const InterviewsPage = lazy(() => import("./interviews/page"));
const NotFoundPage = lazy(() => import("./not-found"));

function PageLoader({ theme }: { theme: Theme }) {
  return (
    <div className="flex items-center justify-center min-h-[50vh] p-12 text-sm font-medium" style={{ color: theme.txtMuted }}>
      Loading page…
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !session) {
      navigate("/auth", { replace: true });
    }
  }, [session, isLoading, navigate]);

  if (isLoading) return null;

  return session ? <>{children}</> : null;
}

export function AppRouter() {
  const [theme, setTheme] = useState<Theme>(PRESETS[4]);

  const router = createBrowserRouter([
    {
      path: "/",
      element: (
        <Suspense fallback={<PageLoader theme={theme} />}>
          <LandingPage theme={theme} />
        </Suspense>
      ),
    },
    {
      path: "/auth",
      element: (
        <Suspense fallback={<PageLoader theme={theme} />}>
          <AuthPage theme={theme} />
        </Suspense>
      ),
    },
    {
      path: "/interview/:id",
      element: (
        <Suspense fallback={<PageLoader theme={theme} />}>
          <InterviewPage theme={theme} />
        </Suspense>
      ),
    },
    {
      path: "/",
      element: (
        <ProtectedRoute>
          <Layout theme={theme} setTheme={setTheme} />
        </ProtectedRoute>
      ),
      children: [
        {
          path: "dashboard",
          element: (
            <Suspense fallback={<PageLoader theme={theme} />}>
              <DashboardPage theme={theme} />
            </Suspense>
          ),
        },
        {
          path: "interviews",
          element: (
            <Suspense fallback={<PageLoader theme={theme} />}>
              <InterviewsPage theme={theme} />
            </Suspense>
          ),
        },
        {
          path: "setup",
          element: (
            <Suspense fallback={<PageLoader theme={theme} />}>
              <SetupPage theme={theme} />
            </Suspense>
          ),
        },
        {
          path: "pipeline/:id",
          element: (
            <Suspense fallback={<PageLoader theme={theme} />}>
              <PipelinePage theme={theme} />
            </Suspense>
          ),
        },
        {
          path: "candidate/:id",
          element: (
            <Suspense fallback={<PageLoader theme={theme} />}>
              <CandidatePage theme={theme} />
            </Suspense>
          ),
        },
        {
          path: "notfound",
          element: (
            <Suspense fallback={<PageLoader theme={theme} />}>
              <NotFoundPage theme={theme} />
            </Suspense>
          ),
        },
        {
          path: "*",
          element: (
            <Suspense fallback={<PageLoader theme={theme} />}>
              <NotFoundPage theme={theme} />
            </Suspense>
          ),
        },
      ],
    },
  ]);

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
