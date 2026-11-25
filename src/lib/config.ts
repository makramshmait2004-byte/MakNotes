// Public runtime configuration. The anon/publishable key is designed to be public;
// every table is protected by Row Level Security on the server.
import { publicConfig } from './public-config';

export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL || publicConfig.supabaseUrl;
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY || publicConfig.supabaseAnonKey;
export const ENABLE_GOOGLE: boolean = (import.meta.env.VITE_ENABLE_GOOGLE ?? String(publicConfig.enableGoogle)) === 'true';

export const isBackendConfigured = import.meta.env.MODE === 'e2e' || Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Absolute URL of the deployed app root, used for auth redirects. */
export function appUrl(hashPath = ''): string {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
  return hashPath ? `${base}#${hashPath}` : base;
}
