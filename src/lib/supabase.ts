import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

/**
 * The Supabase client, or `null` when the project has no credentials.
 *
 * Both are safe in the bundle: the URL is public and the publishable key only
 * ever acts as `anon`, which row-level security confines to reading the public
 * catalogue. Nothing that writes, and no read key, is reachable with it.
 */

const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};

const url = (env.VITE_SUPABASE_URL ?? '').trim();
const publishableKey = (env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const supabase: SupabaseClient<Database> | null =
  url && publishableKey
    ? createClient<Database>(url, publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      })
    : null;

/** False when the app runs off the bundled station list instead of the database. */
export const isSupabaseConfigured = supabase !== null;

/**
 * Supabase reports a failed function call by putting the response on the error
 * rather than in the message, so unwrap it before showing anything.
 */
export async function describeError(err: unknown): Promise<string> {
  if (err && typeof err === 'object' && 'context' in err) {
    const context = (err as { context?: unknown }).context;
    if (context instanceof Response) {
      const body = await context
        .clone()
        .json()
        .catch(() => null);
      if (body && typeof body === 'object' && 'error' in body) return String(body.error);
      return `${context.status} ${context.statusText}`;
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
