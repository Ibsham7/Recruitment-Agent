import { useState, useEffect } from "react";
import { createBrowserRouter, RouterProvider, useNavigate } from "react-router";
import { Theme } from "../lib/types";
import { PRESETS } from "../lib/theme";
import { AuthProvider, useAuth } from "../lib/AuthContext";

// Pages
import Layout from "./layout";
import LandingPage from "./landing/page";
import AuthPage from "./auth/page";
import DashboardPage from "./dashboard/page";
import SetupPage from "./setup/page";
import PipelinePage from "./pipeline/page";
import CandidatePage from "./candidate/page";
import InterviewPage from "./interview/page";
import NotFoundPage from "./not-found";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !session) {
      navigate("/auth", { replace: true });
    }
  }, [session, isLoading, navigate]);

  if (isLoading) return null; // Or a loading spinner

  return session ? <>{children}</> : null;
}

export function AppRouter() {
  const [theme, setTheme] = useState<Theme>(PRESETS[4]);

  const router = createBrowserRouter([
    {
      path: "/",
      element: <LandingPage theme={theme} />,
    },
    {
      path: "/auth",
      element: <AuthPage theme={theme} />,
    },
    {
      path: "/interview/:id",
      element: <InterviewPage theme={theme} />,
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
          element: <DashboardPage theme={theme} />,
        },
        {
          path: "setup",
          element: <SetupPage theme={theme} />,
        },
        {
          path: "pipeline/:id",
          element: <PipelinePage theme={theme} />,
        },
        {
          path: "candidate/:id",
          element: <CandidatePage theme={theme} />,
        },
        {
          path: "notfound",
          element: <NotFoundPage theme={theme} />,
        },
        {
          path: "*",
          element: <NotFoundPage theme={theme} />,
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
