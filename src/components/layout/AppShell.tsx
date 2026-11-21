import React, { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import { useAuth } from '../../context/AuthContext';
import avencisSymbol from '@/assets/avencis-symbol.png';
import { ShieldAlert, LogOut } from 'lucide-react';

export const AppShell: React.FC = () => {
  const { currentUser, isLoading, isProfileMissing, authError, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Automatically close mobile navigation drawer when user navigates to a new page
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

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
    <div className="flex h-screen w-screen overflow-hidden bg-surface relative">
      {/* Mobile Backdrop Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-primary-dark/60 backdrop-blur-xs z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Responsive Navigation Sidebar */}
      <Sidebar 
        isOpenMobile={isMobileMenuOpen} 
        onCloseMobile={() => setIsMobileMenuOpen(false)} 
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)} />
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-8">
          <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
