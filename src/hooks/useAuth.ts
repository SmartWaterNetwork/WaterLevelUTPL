import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AppRole } from '../lib/database.types';

export interface Auth {
  session: Session | null;
  email: string | null;
  /** Null while signed out, or while the role is still being read. */
  role: AppRole | null;
  isAdmin: boolean;
  isLoading: boolean;
  /** True when this account may claim the first admin role — see claimAdmin. */
  canBootstrap: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  claimAdmin: () => Promise<void>;
  clearError: () => void;
}

const signedOut: Omit<Auth, 'signIn' | 'signUp' | 'signOut' | 'claimAdmin' | 'clearError'> = {
  session: null,
  email: null,
  role: null,
  isAdmin: false,
  isLoading: false,
  canBootstrap: false,
  error: null,
};

/**
 * Session and role for the signed-in user.
 *
 * The role is asked of the database rather than read off the token: what is in
 * the JWT is whatever the user last put there, and `user_metadata` in
 * particular is editable by the account it describes. `current_user_role()`
 * answers from `user_roles` under row-level security, which is the only place
 * that decides anything.
 */
export function useAuth(): Auth {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [canBootstrap, setCanBootstrap] = useState(false);
  const [isLoading, setIsLoading] = useState(supabase !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    let alive = true;

    client.auth.getSession().then(({ data }) => {
      if (alive) setSession(data.session);
    });

    const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /** Re-reads the role and whether the bootstrap is still on offer. */
  const refreshRole = useCallback(async () => {
    if (!supabase) return;

    if (!session) {
      setRole(null);
      setCanBootstrap(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const [roleResult, bootstrapResult] = await Promise.all([
      supabase.rpc('current_user_role'),
      supabase.rpc('admin_bootstrap_available'),
    ]);

    setRole((roleResult.data as AppRole | null) ?? null);
    setCanBootstrap(bootstrapResult.data === true);
    setIsLoading(false);
  }, [session]);

  useEffect(() => {
    void refreshRole();
  }, [refreshRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return;
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) setError(err.message);
  }, []);

  /** Returns a message when the address still has to be confirmed. */
  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) return null;
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({ email, password });
    if (err) {
      setError(err.message);
      return null;
    }
    if (data.user && !data.session) {
      return 'Cuenta creada. Confirma la dirección desde el correo que acabas de recibir y vuelve a entrar.';
    }
    return null;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setRole(null);
    setCanBootstrap(false);
  }, []);

  /**
   * Takes the admin role, once, while the network still has none.
   *
   * The database checks both halves of that — no administrator yet, and this
   * address on the allow-list — so a rejection here is the server's decision,
   * not the button's.
   */
  const claimAdmin = useCallback(async () => {
    if (!supabase) return;
    setError(null);
    const { error: err } = await supabase.rpc('claim_admin');
    if (err) {
      setError(err.message);
      return;
    }
    await refreshRole();
  }, [refreshRole]);

  if (!supabase) {
    return {
      ...signedOut,
      signIn: async () => {},
      signUp: async () => null,
      signOut: async () => {},
      claimAdmin: async () => {},
      clearError: () => {},
    };
  }

  return {
    session,
    email: session?.user.email ?? null,
    role,
    isAdmin: role === 'admin',
    isLoading,
    canBootstrap,
    error,
    signIn,
    signUp,
    signOut,
    claimAdmin,
    clearError: () => setError(null),
  };
}
