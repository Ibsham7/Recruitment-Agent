import { useState, useEffect, lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider, useNavigate } from "react-router";
import { Theme } from "../lib/types";
import { PRESETS, loadSavedTheme, saveTheme } from "../lib/theme";
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
const BillingPage = lazy(() => import("./billing/page"));
const AdminPage = lazy(() => import("./admin/page"));
const PrivacyPage = lazy(() => import("./privacy/page"));
const TermsPage = lazy(() => import("./terms/page"));
const NotFoundPage = lazy(() => import("./not-found"));

import RouteErrorPage from "./error-page";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";

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

function AdminRoute({ children, theme }: { children: React.ReactNode; theme: Theme }) {
  const { session, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (!session) {
        navigate("/auth", { replace: true });
      } else if (!isAdmin) {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [session, isAdmin, isLoading, navigate]);

  if (isLoading) {
    return <PageLoader theme={theme} />;
  }

  if (!session || !isAdmin) {
    return null;
  }

  return <>{children}</>;
}

export function AppRouter() {
  const [theme, setTheme] = useState<Theme>(loadSavedTheme);

  useEffect(() => {
    saveTheme(theme);
  }, [theme]);


  const router = createBrowserRouter([
    {
      path: "/",
      errorElement: <RouteErrorPage theme={PRESETS[4]} />,
      element: (
        <Suspense fallback={<PageLoader theme={PRESETS[4]} />}>
          <LandingPage theme={PRESETS[4]} />
        </Suspense>
      ),
    },
    {
      path: "/auth",
      errorElement: <RouteErrorPage theme={theme} />,
      element: (
        <Suspense fallback={<PageLoader theme={theme} />}>
          <AuthPage theme={theme} />
        </Suspense>
      ),
    },
    {
      path: "/interview/:id",
      errorElement: <RouteErrorPage theme={theme} />,
      element: (
        <Suspense fallback={<PageLoader theme={theme} />}>
          <InterviewPage theme={theme} />
        </Suspense>
      ),
    },
    {
      path: "/privacy",
      errorElement: <RouteErrorPage theme={theme} />,
      element: (
        <Suspense fallback={<PageLoader theme={theme} />}>
          <PrivacyPage theme={theme} />
        </Suspense>
      ),
    },
    {
      path: "/terms",
      errorElement: <RouteErrorPage theme={theme} />,
      element: (
        <Suspense fallback={<PageLoader theme={theme} />}>
          <TermsPage theme={theme} />
        </Suspense>
      ),
    },
    {
      path: "/",
      errorElement: <RouteErrorPage theme={theme} />,
      element: (
        <ProtectedRoute>
          <Layout theme={theme} setTheme={setTheme} />
        </ProtectedRoute>
      ),
      children: [
        {
          path: "dashboard",
          errorElement: <RouteErrorPage theme={theme} />,
          element: (
            <Suspense fallback={<PageLoader theme={theme} />}>
              <DashboardPage theme={theme} />
            </Suspense>
          ),
        },
        {
          path: "interviews",
          errorElement: <RouteErrorPage theme={theme} />,
          element: (
            <Suspense fallback={<PageLoader theme={theme} />}>
              <InterviewsPage theme={theme} />
            </Suspense>
          ),
        },
        {
          path: "billing",
          errorElement: <RouteErrorPage theme={theme} />,
          element: (
            <Suspense fallback={<PageLoader theme={theme} />}>
              <BillingPage theme={theme} />
            </Suspense>
          ),
        },
        {
          path: "admin",
          errorElement: <RouteErrorPage theme={theme} />,
          element: (
            <AdminRoute theme={theme}>
              <Suspense fallback={<PageLoader theme={theme} />}>
                <AdminPage theme={theme} />
              </Suspense>
            </AdminRoute>
          ),
        },
        {
          path: "setup",
          errorElement: <RouteErrorPage theme={theme} />,
          element: (
            <Suspense fallback={<PageLoader theme={theme} />}>
              <SetupPage theme={theme} />
            </Suspense>
          ),
        },
        {
          path: "pipeline/:id",
          errorElement: <RouteErrorPage theme={theme} />,
          element: (
            <Suspense fallback={<PageLoader theme={theme} />}>
              <PipelinePage theme={theme} />
            </Suspense>
          ),
        },
        {
          path: "candidate/:id",
          errorElement: <RouteErrorPage theme={theme} />,
          element: (
            <Suspense fallback={<PageLoader theme={theme} />}>
              <CandidatePage theme={theme} />
            </Suspense>
          ),
        },
        {
          path: "notfound",
          errorElement: <RouteErrorPage theme={theme} />,
          element: (
            <Suspense fallback={<PageLoader theme={theme} />}>
              <NotFoundPage theme={theme} />
            </Suspense>
          ),
        },
        {
          path: "*",
          errorElement: <RouteErrorPage theme={theme} />,
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

