import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { 
  Building2, 
  ChevronDown, 
  Bell, 
  Search, 
  LogOut, 
  Key,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export const TopNav: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { activeClient, activeClientId, switchClient, availableClients } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();

  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const isSuperAdmin = currentUser?.role === 'super_admin';

  const handleSelectClient = (clientId: string) => {
    switchClient(clientId);
    setShowClientDropdown(false);
    // Navigate into client workspace if on master admin or currently in a workspace
    if (location.pathname.startsWith('/admin') || location.pathname.startsWith('/workspace')) {
      navigate(`/workspace/${clientId}`);
    }
  };

  return (
    <header className="h-16 bg-surface-container-lowest border-b border-surface-container-high px-6 flex items-center justify-between shrink-0 shadow-sm z-20">
      {/* Left: Active Scope or Global Search */}
      <div className="flex items-center space-x-4">
        {/* Client Workspace Switcher (Super Admin) or Static Scope (Client Admin) */}
        {isSuperAdmin ? (
          <div className="relative">
            <button
              onClick={() => setShowClientDropdown(!showClientDropdown)}
              className="flex items-center space-x-2.5 px-3 py-1.5 rounded-lg border border-surface-container-high hover:border-primary/30 bg-surface-container-low transition-colors text-left"
            >
              <div className="w-6 h-6 rounded bg-primary text-white flex items-center justify-center font-bold text-xs">
                {activeClient?.code?.substring(0, 2) || 'CL'}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider leading-none">
                  Active Client
                </span>
                <span className="text-xs font-bold text-primary truncate max-w-[160px] leading-tight mt-0.5">
                  {activeClient?.name}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant" />
            </button>

            {showClientDropdown && (
              <div className="absolute top-full left-0 mt-1.5 w-72 bg-white rounded-xl shadow-elevated border border-surface-container-high p-2 z-50">
                <div className="text-[11px] font-bold text-on-surface-variant uppercase px-2 py-1">
                  Switch Client Workspace
                </div>
                <div className="space-y-1 mt-1">
                  {availableClients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectClient(c.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors ${
                        c.id === activeClientId
                          ? 'bg-primary/5 text-primary font-bold'
                          : 'hover:bg-surface-container-low text-on-surface'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded bg-surface-container-high flex items-center justify-center font-bold text-xs text-primary">
                          {c.code?.substring(0, 2) || 'CL'}
                        </div>
                        <div>
                          <div className="text-xs font-semibold">{c.name}</div>
                          <div className="text-[10px] text-on-surface-variant">{c.industry}</div>
                        </div>
                      </div>
                      {c.status === 'active' ? (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-warning" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-surface-container-high mt-2 pt-2">
                  <button
                    onClick={() => {
                      setShowClientDropdown(false);
                      navigate('/admin/clients/onboard');
                    }}
                    className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-accent hover:bg-accent/10 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Onboard New Client...</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-surface-container-low border border-surface-container-high">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-primary">{activeClient?.name}</span>
          </div>
        )}

        {/* Search Input */}
        <div className="relative hidden md:block w-64">
          <Search className="w-3.5 h-3.5 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search employees, IDs, records..."
            className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low rounded-lg text-xs border border-transparent focus:border-primary/20 focus:bg-white focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Quick Change Password Button */}
        <button
          onClick={() => setIsPasswordModalOpen(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-primary border border-surface-container-high transition-colors text-xs font-semibold"
          title="Change Account Password"
        >
          <Key className="w-3.5 h-3.5 text-primary" />
          <span className="hidden sm:inline">Change Password</span>
        </button>

        {/* Notifications Icon with dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors"
            title="System Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-elevated border border-surface-container-high p-4 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-surface-container-high text-xs font-bold text-primary">
                <span>System Notifications</span>
                <span className="text-[10px] text-on-surface-variant font-normal">All Caught Up</span>
              </div>
              <div className="py-6 text-center text-xs text-on-surface-variant">
                <Bell className="w-6 h-6 mx-auto mb-2 opacity-30 text-primary" />
                <p className="font-semibold text-on-surface">No new notifications</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">
                  Automated alerts, attendance regularisations, and leave approvals will appear here.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* User Pill & Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center space-x-2.5 pl-2 py-1 pr-1.5 rounded-xl border border-transparent hover:border-surface-container-high hover:bg-surface-container-low transition-colors"
          >
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.fullName || 'User'}
                className="w-8 h-8 rounded-full object-cover border border-surface-container-highest"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser?.fullName ? currentUser.fullName.substring(0, 2).toUpperCase() : 'U'}
              </div>
            )}
            <div className="hidden lg:block text-left">
              <div className="text-xs font-bold text-on-surface leading-none">{currentUser?.fullName}</div>
              <div className="text-[10px] text-on-surface-variant mt-0.5 capitalize">
                {currentUser?.role ? currentUser.role.replace('_', ' ') : ''}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant" />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-elevated border border-surface-container-high p-3 z-50 animate-in fade-in duration-100">
              {/* User overview */}
              <div className="p-2 border-b border-surface-container-high mb-2">
                <div className="text-xs font-bold text-on-surface truncate">{currentUser?.fullName}</div>
                <div className="text-[11px] text-on-surface-variant truncate">{currentUser?.email}</div>
                <div className="mt-1.5 inline-block text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {currentUser?.role?.replace('_', ' ')}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-1 text-xs">
                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    setIsPasswordModalOpen(true);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-on-surface hover:bg-surface-container-low hover:text-primary transition-colors text-left"
                >
                  <Key className="w-4 h-4 text-primary" />
                  <span className="font-medium">Change Password</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    logout();
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors text-left font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </header>
  );
};
