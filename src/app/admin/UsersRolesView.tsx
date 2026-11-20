import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { authService } from '../../services/authService';
import { UserProfileRow } from '../../services/serviceTypes';
import { 
  Users, 
  ShieldCheck, 
  UserPlus, 
  Search, 
  Mail, 
  Key, 
  Lock, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  Copy,
  Check,
  X,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';

export const UsersRolesView: React.FC = () => {
  const { currentUser, provisionUser } = useAuth();
  const { availableClients } = useWorkspace();

  const [users, setUsers] = useState<UserProfileRow[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  // Modal State
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [provisionName, setProvisionName] = useState('');
  const [provisionEmail, setProvisionEmail] = useState('');
  const [provisionPassword, setProvisionPassword] = useState('Avencis@2026!');
  const [provisionRole, setProvisionRole] = useState<UserProfileRow['role']>('client_admin');
  const [provisionClientId, setProvisionClientId] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [provisionSuccessData, setProvisionSuccessData] = useState<{
    email: string;
    password: string;
    fullName: string;
    role: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Load users from backend
  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const res = await authService.getAllUsers();
      if (res.success && res.data) {
        setUsers(res.data);
      }
    } catch (err) {
      console.error('[UsersRolesView] Failed to load users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Set default client id when available
  useEffect(() => {
    if (availableClients.length > 0 && !provisionClientId) {
      setProvisionClientId(availableClients[0].id);
    }
  }, [availableClients, provisionClientId]);

  const handleOpenProvisionModal = () => {
    setProvisionName('');
    setProvisionEmail('');
    setProvisionPassword('Avencis@2026!');
    setProvisionRole('client_admin');
    if (availableClients.length > 0) {
      setProvisionClientId(availableClients[0].id);
    }
    setModalError(null);
    setProvisionSuccessData(null);
    setCopied(false);
    setIsProvisionModalOpen(true);
  };

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!provisionEmail || !provisionEmail.includes('@')) {
      setModalError('Please enter a valid email address.');
      return;
    }
    if (provisionPassword.length < 6) {
      setModalError('Password must be at least 6 characters long.');
      return;
    }
    if (!provisionName.trim()) {
      setModalError('Full name is mandatory.');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetClientId = provisionRole === 'super_admin' ? null : (provisionClientId || null);
      const res = await provisionUser({
        email: provisionEmail.trim(),
        password: provisionPassword,
        fullName: provisionName.trim(),
        role: provisionRole,
        clientId: targetClientId,
      });

      if (res.success) {
        setProvisionSuccessData({
          email: provisionEmail.trim(),
          password: provisionPassword,
          fullName: provisionName.trim(),
          role: provisionRole,
        });
        await loadUsers();
      } else {
        setModalError(res.error || 'Failed to provision user account.');
      }
    } catch (err: any) {
      setModalError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!provisionSuccessData) return;
    const text = `Avencis WFM Account Credentials\nName: ${provisionSuccessData.fullName}\nEmail: ${provisionSuccessData.email}\nInitial Password: ${provisionSuccessData.password}\nRole: ${provisionSuccessData.role}\nLogin URL: ${window.location.origin}\n\nNote: You can change your password anytime after logging in via the User Profile / Change Password menu.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            Security Tier I • Governance
          </span>
          <h1 className="font-serif text-3xl text-primary font-normal">
            Users & Access Management
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Enterprise user accounts, role definitions, tenant scoping, and session security credentials.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadUsers()}
            disabled={isLoadingUsers}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-semibold text-on-surface transition-colors border border-outline-variant/30"
            title="Refresh Users List"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenProvisionModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-semibold text-xs hover:bg-primary/95 shadow transition-all"
          >
            <UserPlus className="w-4 h-4 text-white" />
            <span className="text-white">Provision New User</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-xs text-on-surface-variant uppercase tracking-wider">
            <span>Total Registered Accounts</span>
            <Users className="w-4 h-4 text-secondary" />
          </div>
          <div className="font-serif text-3xl text-primary font-normal mt-2">
            {users.length}
          </div>
          <span className="text-[11px] text-emerald-700 font-medium">100% Identity Verified</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-xs text-on-surface-variant uppercase tracking-wider">
            <span>Global Super Admins</span>
            <ShieldCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="font-serif text-3xl text-primary font-normal mt-2">
            {users.filter(u => u.role === 'super_admin').length}
          </div>
          <span className="text-[11px] text-on-surface-variant font-medium">Master Governance</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-xs text-on-surface-variant uppercase tracking-wider">
            <span>Client Tenant Admins</span>
            <Building2 className="w-4 h-4 text-secondary" />
          </div>
          <div className="font-serif text-3xl text-primary font-normal mt-2">
            {users.filter(u => u.role === 'client_admin').length}
          </div>
          <span className="text-[11px] text-on-surface-variant font-medium">Client Scoped Strictly</span>
        </div>

        <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between text-xs text-on-surface-variant uppercase tracking-wider">
            <span>Staff & Portal Users</span>
            <Key className="w-4 h-4 text-secondary-fixed-dim" />
          </div>
          <div className="font-serif text-3xl text-primary font-normal mt-2">
            {users.filter(u => u.role !== 'super_admin' && u.role !== 'client_admin').length}
          </div>
          <span className="text-[11px] text-on-surface-variant font-medium">HR, Managers & Employees</span>
        </div>
      </div>

      {/* Filter and Table */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden">
        <div className="p-4 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-outline-variant/30">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-outline" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-xs text-on-surface focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-on-surface-variant">Role Filter:</span>
            {['ALL', 'super_admin', 'client_admin', 'hr_admin', 'payroll_admin', 'location_manager', 'employee'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold uppercase transition-colors ${
                  roleFilter === r
                    ? 'bg-primary text-white'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {r.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoadingUsers ? (
            <div className="p-12 text-center text-xs text-on-surface-variant">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary opacity-60" />
              <span>Loading user accounts from database...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-xs text-on-surface-variant">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-primary" />
              <p className="font-bold text-on-surface">No user accounts found matching query</p>
              <p className="text-[11px] mt-1">Click "Provision New User" above to create an account.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant font-semibold border-b border-outline-variant/30">
                  <th className="p-3">User</th>
                  <th className="p-3">Role & Scope</th>
                  <th className="p-3">Client Tenant</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Account Security</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {filteredUsers.map((u) => {
                  const client = availableClients.find(c => c.id === u.client_id);
                  const isCurrentActive = currentUser?.id === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-surface-container-low/40">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {u.full_name ? u.full_name.substring(0, 2).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-on-surface block">{u.full_name}</span>
                              {isCurrentActive && (
                                <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary text-[9px] font-bold">YOU</span>
                              )}
                            </div>
                            <span className="text-[11px] text-on-surface-variant">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            u.role === 'super_admin'
                              ? 'bg-primary text-white'
                              : u.role === 'client_admin'
                              ? 'bg-secondary-container text-on-secondary-container'
                              : 'bg-surface-container-high text-on-surface'
                          }`}
                        >
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-on-surface">
                        {client ? client.name : (
                          u.role === 'super_admin' 
                            ? <span className="text-secondary font-semibold">Global (All Clients)</span>
                            : <span className="text-on-surface-variant">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                          {u.is_active ? 'ACTIVE' : 'SUSPENDED'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Password Configured</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Provision User Modal */}
      {isProvisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-surface-container-high"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-primary-dark text-white p-5 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-accent/20 rounded-xl text-accent-light">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Provision User Account</h3>
                  <p className="text-xs text-white/70">Create credentials for Client Admins or Staff</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProvisionModalOpen(false)}
                className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {modalError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{modalError}</span>
                </div>
              )}

              {provisionSuccessData ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Account Successfully Provisioned!</span>
                    </div>
                    <p className="text-xs text-emerald-800">
                      Share these credentials with the user. They can log in immediately and change their password anytime via the User Profile menu.
                    </p>
                  </div>

                  {/* Credentials Card */}
                  <div className="p-4 bg-surface-container-low border border-surface-container-high rounded-xl space-y-2.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant font-sans font-semibold">Full Name:</span>
                      <span className="font-bold text-on-surface">{provisionSuccessData.fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant font-sans font-semibold">User Email / ID:</span>
                      <span className="font-bold text-primary">{provisionSuccessData.email}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-on-surface-variant font-sans font-semibold">Initial Password:</span>
                      <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        {provisionSuccessData.password}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant font-sans font-semibold">Assigned Role:</span>
                      <span className="font-bold text-on-surface uppercase">{provisionSuccessData.role}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleCopyCredentials}
                      className="flex items-center gap-1.5 px-4 py-2 bg-secondary text-white rounded-xl text-xs font-semibold hover:bg-secondary/90 shadow-sm transition-all"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-white" />
                          <span className="text-white">Credentials Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-white" />
                          <span className="text-white">Copy Credentials</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsProvisionModalOpen(false)}
                      className="px-5 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/95 shadow-sm transition-all"
                    >
                      <span className="text-white">Done</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleProvisionSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={provisionName}
                      onChange={(e) => setProvisionName(e.target.value)}
                      placeholder="e.g. Ramesh Patel"
                      required
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Email Address (Login ID) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={provisionEmail}
                      onChange={(e) => setProvisionEmail(e.target.value)}
                      placeholder="e.g. admin@clientorg.com"
                      required
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Role <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={provisionRole}
                        onChange={(e) => setProvisionRole(e.target.value as any)}
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                      >
                        <option value="client_admin">Client Admin (Tenant Master)</option>
                        <option value="hr_admin">HR Administrator</option>
                        <option value="payroll_admin">Payroll Administrator</option>
                        <option value="location_manager">Location Operations Manager</option>
                        <option value="employee">Employee (Portal Self-Service)</option>
                        {currentUser?.role === 'super_admin' && (
                          <option value="super_admin">Avencis Super Admin</option>
                        )}
                      </select>
                    </div>

                    {provisionRole !== 'super_admin' && (
                      <div>
                        <label className="block text-xs font-semibold text-on-surface mb-1">
                          Client Organisation <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={provisionClientId}
                          onChange={(e) => setProvisionClientId(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                        >
                          {availableClients.length === 0 ? (
                            <option value="">No clients created yet</option>
                          ) : (
                            availableClients.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.code})
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-on-surface mb-1">
                      Initial Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={provisionPassword}
                        onChange={(e) => setProvisionPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                        minLength={6}
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2 text-outline hover:text-on-surface transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-on-surface-variant mt-1">
                      User can change this password after initial sign-in.
                    </p>
                  </div>

                  <div className="pt-3 flex items-center justify-end space-x-2 border-t border-surface-container-high">
                    <button
                      type="button"
                      onClick={() => setIsProvisionModalOpen(false)}
                      disabled={isSubmitting}
                      className="px-4 py-2 text-xs font-semibold rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || !provisionName || !provisionEmail || !provisionPassword}
                      className="px-5 py-2 text-xs font-semibold rounded-xl bg-primary text-white hover:bg-primary/95 transition-all shadow-sm disabled:opacity-50 flex items-center space-x-1.5"
                    >
                      {isSubmitting ? (
                        <span className="text-white">Provisioning...</span>
                      ) : (
                        <>
                          <Key className="w-3.5 h-3.5 text-white" />
                          <span className="text-white">Create Account</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
