/**
 * Avencis Workforce Management (WFM)
 * Authentication & Identity Context Provider
 *
 * Connects frontend presentation to authService.ts.
 * Implements session restoration, Supabase GoTrue authentication,
 * profile resolution, role authorization, and developer persona controls.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import { authService, ResolvedUserContext } from '../services/authService';
import { isMockMode, isDevPersonaAllowed } from '../services/serviceConfig';
import { formatErrorMessage } from '../services/serviceErrors';
import type { Session } from '@supabase/supabase-js';

export interface AuthContextType {
  currentUser: User | null;
  user: User | null; // convenient alias
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isProfileMissing: boolean;
  authError: string | null;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  provisionUser: (params: {
    email: string;
    password: string;
    fullName: string;
    role: any;
    clientId?: string | null;
    employeeId?: string | null;
  }) => Promise<{ success: boolean; userId?: string; error?: string }>;
  switchUser: (email: string) => Promise<void>;
  switchPersona: (role: UserRole, clientId?: string) => Promise<void>;
  loginAsPersona: (email: string) => Promise<void>;
  isDevPersonaAvailable: boolean;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Maps a resolved domain user context to the frontend User interface.
 */
function mapContextToUser(ctx: ResolvedUserContext): User {
  return {
    id: ctx.userId,
    email: ctx.email,
    fullName: ctx.fullName,
    name: ctx.fullName,
    role: ctx.role as UserRole,
    clientId: ctx.clientId || undefined,
    employeeId: ctx.employeeId || undefined,
    avatarUrl: ctx.employeeProfile?.avatar_url || undefined,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isProfileMissing, setIsProfileMissing] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isDevPersonaAvailable = isDevPersonaAllowed();

  /**
   * Resolves the user context from authService and updates context state.
   */
  const syncUserContext = useCallback(async (activeSession?: Session | null) => {
    try {
      const contextRes = await authService.resolveUserContext();

      if (!contextRes.success || !contextRes.data) {
        // If error indicates profile missing (NOT_FOUND)
        if (contextRes.error?.code === 'NOT_FOUND') {
          setIsProfileMissing(true);
          setCurrentUser(null);
          setAuthError('Access Denied: No application user profile exists for this authenticated account.');
          return false;
        }

        // If deactivated or permission denied
        if (contextRes.error?.code === 'PERMISSION_ERROR' || contextRes.error?.code === 'AUTH_ERROR') {
          setIsProfileMissing(false);
          setCurrentUser(null);
          setAuthError(formatErrorMessage(contextRes.error));
          return false;
        }

        // Unauthenticated or network error
        setIsProfileMissing(false);
        setCurrentUser(null);
        if (activeSession) {
          setAuthError(formatErrorMessage(contextRes.error || { code: 'UNEXPECTED_ERROR', message: 'Failed to resolve user profile.' } as any));
        }
        return false;
      }

      // Successful profile resolution
      const mapped = mapContextToUser(contextRes.data);
      setCurrentUser(mapped);
      setIsProfileMissing(false);
      setAuthError(null);
      return true;
    } catch (err: any) {
      setIsProfileMissing(false);
      setCurrentUser(null);
      setAuthError(err.message || 'An unexpected error occurred during user profile resolution.');
      return false;
    }
  }, []);

  /**
   * Application Startup: Restore session or initialize development preview persona.
   */
  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      setIsLoading(true);
      setAuthError(null);

      // 1. Mock Mode (Development Preview Only)
      if (isMockMode()) {
        try {
          // Check if developer selected a specific persona previously
          const saved = localStorage.getItem('avencis_active_mock_persona');
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed?.email) {
                await authService.devSetPersonaByEmail(parsed.email);
              }
            } catch {
              // Ignore invalid storage
            }
          }
          await syncUserContext();
        } finally {
          if (isMounted) setIsLoading(false);
        }
        return;
      }

      // 2. Live Supabase Authentication Mode
      try {
        const sessionRes = await authService.getSession();
        if (sessionRes.success && sessionRes.data) {
          if (isMounted) setSession(sessionRes.data);
          await syncUserContext(sessionRes.data);
        } else {
          // No active session
          if (isMounted) {
            setSession(null);
            setCurrentUser(null);
            setIsProfileMissing(false);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setAuthError(err.message || 'Failed to verify authentication session.');
          setCurrentUser(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initializeAuth();

    // Subscribe to real-time GoTrue authentication state changes
    const { unsubscribe } = authService.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      setSession(newSession);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (newSession) {
          await syncUserContext(newSession);
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsProfileMissing(false);
        setAuthError(null);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [syncUserContext]);

  /**
   * Signs in with email and password using Supabase Authentication.
   */
  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setAuthError(null);
    setIsProfileMissing(false);

    try {
      // 1. In Mock Mode (Dev Only)
      if (isMockMode()) {
        const devRes = await authService.devSetPersonaByEmail(email);
        if (!devRes.success || !devRes.data) {
          const errText = devRes.error ? formatErrorMessage(devRes.error) : 'User persona not found.';
          setAuthError(errText);
          setIsLoading(false);
          return { success: false, error: errText };
        }
        const user = mapContextToUser(devRes.data);
        setCurrentUser(user);
        localStorage.setItem('avencis_active_mock_persona', JSON.stringify({ email: user.email }));
        setIsLoading(false);
        return { success: true };
      }

      // 2. In Live Supabase Mode
      const signInRes = await authService.signIn({ email, password });
      if (!signInRes.success || !signInRes.data) {
        const errText = signInRes.error ? formatErrorMessage(signInRes.error) : 'Authentication failed. Please verify your credentials.';
        setAuthError(errText);
        setIsLoading(false);
        return { success: false, error: errText };
      }

      setSession(signInRes.data.session);

      // Resolve application user profile from PostgreSQL
      const resolved = await syncUserContext(signInRes.data.session);
      setIsLoading(false);

      if (!resolved) {
        return {
          success: false,
          error: isProfileMissing
            ? 'Account authenticated, but no application user profile has been provisioned.'
            : authError || 'Failed to resolve user profile.',
        };
      }

      return { success: true };
    } catch (err: any) {
      const errText = err.message || 'An unexpected error occurred during login.';
      setAuthError(errText);
      setIsLoading(false);
      return { success: false, error: errText };
    }
  };

  /**
   * Signs out the current user and clears authentication state.
   */
  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (!isMockMode()) {
        await authService.signOut();
      }
      setSession(null);
      setCurrentUser(null);
      setIsProfileMissing(false);
      setAuthError(null);
      localStorage.removeItem('avencis_active_mock_persona');
      localStorage.removeItem('avencis_active_client_id');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Securely changes the password for the current authenticated user.
   */
  const changePassword = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    const res = await authService.changePassword(newPassword);
    if (!res.success) {
      return { success: false, error: formatErrorMessage(res.error!) };
    }
    return { success: true };
  };

  /**
   * Provisions a user account with an initial password.
   */
  const provisionUser = async (params: {
    email: string;
    password: string;
    fullName: string;
    role: any;
    clientId?: string | null;
    employeeId?: string | null;
  }): Promise<{ success: boolean; userId?: string; error?: string }> => {
    const res = await authService.provisionUserAccount(params);
    if (!res.success) {
      return { success: false, error: formatErrorMessage(res.error!) };
    }
    return { success: true, userId: res.data?.userId };
  };

  /**
   * Developer Persona Switcher by email (Development mock preview only).
   */
  const loginAsPersona = async (email: string): Promise<void> => {
    if (!isDevPersonaAvailable) {
      console.warn('[Avencis WFM] Persona switcher is disabled in production or live auth mode.');
      return;
    }
    await login(email);
  };

  /**
   * Developer Persona Switcher by role and client (Development mock preview only).
   */
  const switchPersona = async (role: UserRole, clientId?: string): Promise<void> => {
    if (!isDevPersonaAvailable) {
      console.warn('[Avencis WFM] Persona switcher is disabled in production or live auth mode.');
      return;
    }
    setIsLoading(true);
    try {
      const switchRes = await authService.devSwitchPersona(role as any, clientId);
      if (switchRes.success && switchRes.data) {
        const user = mapContextToUser(switchRes.data);
        setCurrentUser(user);
        localStorage.setItem('avencis_active_mock_persona', JSON.stringify({ email: user.email }));
        setAuthError(null);
        setIsProfileMissing(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Legacy alias for loginAsPersona.
   */
  const switchUser = async (email: string): Promise<void> => {
    await loginAsPersona(email);
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const isAuthenticated = !!currentUser && !isProfileMissing && !isLoading;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        user: currentUser,
        session,
        isAuthenticated,
        isLoading,
        isProfileMissing,
        authError,
        login,
        logout,
        changePassword,
        provisionUser,
        switchUser,
        switchPersona,
        loginAsPersona,
        isDevPersonaAvailable,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
