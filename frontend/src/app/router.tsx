import { useState } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { Theme } from "../lib/types";
import { PRESETS } from "../lib/theme";

// Pages
import Layout from "./layout";
import LandingPage from "./landing/page";
import AuthPage from "./auth/page";
import DashboardPage from "./dashboard/page";
import SetupPage from "./setup/page";
import PipelinePage from "./pipeline/page";
import CandidatePage from "./candidate/page";
import NotFoundPage from "./not-found";

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
      path: "/",
      element: <Layout theme={theme} setTheme={setTheme} />,
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

  return <RouterProvider router={router} />;
}
