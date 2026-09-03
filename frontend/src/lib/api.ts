import { supabase } from './supabase';

/**
 * Single source of truth for the Backend API URL across both development and production.
 * Checks VITE_API_URL and VITE_BACKEND_URL interchangeably.
 *
 * In browser development:
 * When accessed from a mobile phone or another device on the local network (e.g. http://192.168.1.8:5173),
 * hardcoding 'http://localhost:8000' causes the mobile phone to make requests to ITSELF rather than the host machine.
 *
 * By defaulting to relative paths (''), all API calls route through Vite's dev server proxy to http://localhost:8000.
 */
export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined') {
    return '';
  }

  return import.meta.env.DEV ? 'http://localhost:8000' : '';
}

export const API_BASE_URL = getApiBaseUrl();

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

