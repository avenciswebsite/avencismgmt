/**
 * Avencis Workforce Management (WFM)
 * Service Configuration & Data Source Mode Manager
 *
 * Enforces explicit separation between real Supabase backend access
 * and intentional offline development previews.
 */

import { isSupabaseConfigured } from '../lib/supabase';

export type DataSourceMode = 'supabase' | 'mock';

// Allow development override via environment variable or localStorage
let devModeOverride: DataSourceMode | null = null;

function getEnvVar(key: string): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta && (import.meta as any).env) {
    return (import.meta as any).env[key];
  }
  const proc = (globalThis as any).process;
  if (proc && proc.env) {
    return proc.env[key];
  }
  return undefined;
}

function isProd(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta && (import.meta as any).env) {
    return !!(import.meta as any).env.PROD;
  }
  const proc = (globalThis as any).process;
  if (proc && proc.env) {
    return proc.env.NODE_ENV === 'production';
  }
  return false;
}

/**
 * Resolves the active data source mode.
 * - In production: Always 'supabase' (mock mode prohibited).
 * - In development: Respects VITE_DATA_SOURCE_MODE, dev override, or falls back to 'supabase' if configured.
 */
export function getDataSourceMode(): DataSourceMode {
  // Production boundary: never allow mock mode in production builds
  if (isProd()) {
    return 'supabase';
  }

  // Developer runtime override
  if (devModeOverride) {
    return devModeOverride;
  }

  // Check localStorage for persisted developer preference
  try {
    const saved = localStorage.getItem('avencis_dev_data_source_mode');
    if (saved === 'supabase' || saved === 'mock') {
      return saved;
    }
  } catch {
    // Non-browser or sandbox environment
  }

  // Environment variable preference
  const envMode = getEnvVar('VITE_DATA_SOURCE_MODE');
  if (envMode === 'supabase' || envMode === 'mock') {
    return envMode as DataSourceMode;
  }

  // Default: Always use 'supabase' when backend is configured
  return isSupabaseConfigured() ? 'supabase' : 'mock';
}

/**
 * Sets the developer data source mode at runtime (development only).
 */
export function setDevDataSourceMode(mode: DataSourceMode): void {
  if (isProd()) {
    console.warn('[Avencis WFM] setDevDataSourceMode is disabled in production builds.');
    return;
  }
  devModeOverride = mode;
  try {
    localStorage.setItem('avencis_dev_data_source_mode', mode);
  } catch {
    // Ignore storage errors in test runners
  }
}

/**
 * Helper: Returns true if currently operating in mock preview mode.
 */
export function isMockMode(): boolean {
  return getDataSourceMode() === 'mock';
}

/**
 * Helper: Returns true if currently operating in live Supabase mode.
 */
export function isSupabaseMode(): boolean {
  return getDataSourceMode() === 'supabase';
}

/**
 * Security Rule: Developer Persona Switcher is completely disabled for production readiness.
 */
export function isDevPersonaAllowed(): boolean {
  return false;
}
