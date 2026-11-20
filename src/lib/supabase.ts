/**
 * Avencis Workforce Management (WFM)
 * Supabase Client Singleton & Environment Validator
 *
 * Enforces strict environment variable validation, type-safe queries,
 * and zero exposure of service-role/secret keys.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

function getEnv(key: string): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta && (import.meta as any).env) {
    return (import.meta as any).env[key];
  }
  const proc = (globalThis as any).process;
  if (proc && proc.env) {
    return proc.env[key];
  }
  return undefined;
}

// Live Project Default Supabase Credentials (Safe public publishable credentials)
const DEFAULT_SUPABASE_URL = 'https://mlopgvkvzhwhkbewhefb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_CZCMyb2JJdj57VZ6SkG4yQ_-nGo2mIN';

// Read public environment variables safely (prefixed with VITE_), falling back to live project defaults
const supabaseUrl = getEnv('VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY;

/**
 * Validates that environment variables are present and syntactically valid
 */
export function validateSupabaseEnv(): { isValid: boolean; error?: string } {
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      isValid: false,
      error: 'Supabase configuration missing: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env',
    };
  }

  // Check if URL is still placeholder
  if (supabaseUrl.includes('your-project-id') || supabaseAnonKey.includes('your-anon-public-key')) {
    return {
      isValid: false,
      error: 'Supabase configuration contains placeholder values. Please update .env with live credentials.',
    };
  }

  try {
    const parsed = new URL(supabaseUrl);
    if (!parsed.protocol.startsWith('https')) {
      return {
        isValid: false,
        error: 'VITE_SUPABASE_URL must be a valid HTTPS URL.',
      };
    }
  } catch {
    return {
      isValid: false,
      error: 'VITE_SUPABASE_URL is not a valid URL format.',
    };
  }

  return { isValid: true };
}

const envCheck = validateSupabaseEnv();

const isDev = (typeof import.meta !== 'undefined' && import.meta && (import.meta as any).env) 
  ? !!(import.meta as any).env.DEV 
  : (((globalThis as any).process && (globalThis as any).process.env) ? (globalThis as any).process.env.NODE_ENV !== 'production' : true);

if (!envCheck.isValid && isDev) {
  console.warn(`[Avencis WFM] Supabase Environment Notice: ${envCheck.error}`);
}

/**
 * Creates the Supabase Client Singleton.
 * Uses a dummy fallback client if environment variables are not yet configured,
 * ensuring the application compiles and runs without crashing in local development.
 */
function createSupabaseInstance(): SupabaseClient<Database> {
  const targetUrl = envCheck.isValid && supabaseUrl ? supabaseUrl : 'https://placeholder.supabase.co';
  const targetKey = envCheck.isValid && supabaseAnonKey ? supabaseAnonKey : 'placeholder-anon-key';

  return createClient<Database>(targetUrl, targetKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'avencis_wfm_auth_token',
    },
    global: {
      headers: {
        'x-client-info': 'avencis-wfm-web@1.0.0',
      },
    },
  });
}

export const supabase = createSupabaseInstance();

/**
 * Helper to check whether live Supabase backend is configured and ready
 */
export function isSupabaseConfigured(): boolean {
  return envCheck.isValid;
}

/**
 * Health check helper to test database connectivity
 */
export async function checkSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: envCheck.error || 'Supabase not configured' };
  }

  try {
    const { data: _data, error } = await supabase.from('clients').select('id').limit(1);
    if (error) {
      // If table doesn't exist yet (PGRST205), connectivity is still verified
      if (error.code === 'PGRST205') {
        return { ok: true, message: 'Connected to Supabase project (schema tables pending migration)' };
      }
      return { ok: false, message: `Supabase query error [${error.code}]: ${error.message}` };
    }
    return { ok: true, message: 'Connected to Supabase project and database schema active' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Network error connecting to Supabase: ${message}` };
  }
}
