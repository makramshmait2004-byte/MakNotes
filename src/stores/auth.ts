import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { isBackendConfigured } from '@/lib/config';
import { closeDb, openUserDb } from '@/data/db';
import { setRepoUser } from '@/data/repo';
import { startSync, stopSync } from '@/data/sync';

interface AuthState {
  session: Session | null;
  user: User | null;
  ready: boolean;
  recovery: boolean; // user arrived through a password-recovery link
}

export const useAuth = create<AuthState>(() => ({ session: null, user: null, ready: false, recovery: false }));

let activeUser: string | null = null;

function activate(user: User | null) {
  const id = user?.id ?? null;
  if (id === activeUser) return;
  activeUser = id;
  stopSync();
  if (id) {
    openUserDb(id);
    setRepoUser(id);
    startSync(supabase, id);
  } else {
    setRepoUser(null);
    closeDb();
  }
}

export async function initAuth() {
  if (!isBackendConfigured) {
    useAuth.setState({ ready: true });
    return;
  }
  supabase.auth.onAuthStateChange((event, session) => {
    // defer work out of the auth callback (supabase-js recommendation)
    setTimeout(() => {
      activate(session?.user ?? null);
      useAuth.setState({
        session,
        user: session?.user ?? null,
        ready: true,
        ...(event === 'PASSWORD_RECOVERY' ? { recovery: true } : {}),
      });
    }, 0);
  });
  // Works offline: the persisted session is read from localStorage.
  const { data } = await supabase.auth.getSession();
  activate(data.session?.user ?? null);
  useAuth.setState({ session: data.session, user: data.session?.user ?? null, ready: true });
}
