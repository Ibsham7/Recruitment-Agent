import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes fresh data window for route transitions
      gcTime: 1000 * 60 * 10,   // Keep unused cache in memory for 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
