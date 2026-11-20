import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { useAuth } from '../../context/AuthContext';
import avencisSymbol from '@/assets/avencis-symbol.png';
import { ShieldAlert, LogOut } from 'lucide-react';

export const AppShell: React.FC = () => {
  const { currentUser, isLoading, isProfileMissing, authError, logout } = useAuth();

  // 1. Session Loading State: Prevent flashing incorrect or unauthorized dashboards
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <img src={avencisSymbol} alt="Avencis" className="h-10 w-auto animate-pulse object-contain" />
          <span className="text-xs text-on-surface-variant font-mono tracking-wider uppercase">
            Verifying Session & Security Scope...
          </span>
        </div>
      </div>
    );
  }

  // 2. Profile Missing State: Authenticated in GoTrue but not provisioned in user_profiles
  if (isProfileMissing) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface p-4">
        <div className="max-w-md w-full bg-surface-container-lowest p-6 rounded-2xl border border-red-500/20 shadow-xl text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-serif text-primary font-medium mb-2">Access Restricted</h2>
          <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
            {authError || 'Authenticated user account has no provisioned user profile in the database. Administrative role elevation is prohibited.'}
          </p>
          <button
            onClick={() => logout()}
            className="w-full py-2.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/95 flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out & Return to Login</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. Unauthenticated State: Redirect to login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // 4. Authenticated Shell
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
