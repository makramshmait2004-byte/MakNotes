import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isBackendConfigured } from './config';

import { FakeServer } from '@/test/fakeSupabase';

// `vite build --mode e2e` swaps in an in-memory backend so UI tests run without a real project.
// This branch is removed from production builds (import.meta.env.MODE is a build-time constant).
export const supabase: SupabaseClient =
  import.meta.env.MODE === 'e2e'
    ? (new FakeServer('maknotes-e2e-server').client('e2e00000-0000-4000-8000-000000000001') as unknown as SupabaseClient)
    : createClient(
  isBackendConfigured ? SUPABASE_URL : 'http://localhost:54321',
  isBackendConfigured ? SUPABASE_ANON_KEY : 'not-configured',
  {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'maknotes-auth',
    },
    realtime: { params: { eventsPerSecond: 20 } },
  },
);
