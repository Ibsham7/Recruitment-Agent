import { supabase } from './supabase';

/**
 * Single source of truth for the Backend API URL across both development and production.
 * Checks VITE_API_URL and VITE_BACKEND_URL interchangeably.
 * Falls back to localhost in dev mode only; avoids silent local network requests in production.
 */
export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? 'http://localhost:8000' : '')
).replace(/\/+$/, '');

export async function apiFetch(url: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Support both relative paths ('/api/...') and absolute URLs
  const targetUrl = url.startsWith('http://') || url.startsWith('https://')
    ? url
    : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;

  return fetch(targetUrl, {
    ...options,
    headers
  });
}

