import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import avencisSymbolDarkBg from '@/assets/avencis-symbol-darkbg.png';
import avencisWordmark from '@/assets/avencis-wordmark.png';
import { 
  Building2, 
  MapPin,
  Users, 
  CalendarCheck, 
  FileText, 
  DollarSign, 
  Receipt, 
  Settings, 
  ShieldCheck, 
  BarChart3, 
  Home, 
  Clock, 
  FileCheck2,
  Sliders,
  Sparkles,
  ArrowLeft,
  X
} from 'lucide-react';

interface SidebarProps {
  collapsed?: boolean;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  collapsed = false,
  isOpenMobile = false,
  onCloseMobile
}) => {
  const { currentUser } = useAuth();
  const { activeClient, activeClientId } = useWorkspace();
  const location = useLocation();

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isEmployee = currentUser?.role === 'employee';
  const isInClientWorkspace = location.pathname.startsWith('/workspace');
  const path = location.pathname.toLowerCase();

  // Helper for consistent navigation item styling with prominent active highlighting
  const getNavItemClasses = (isActive: boolean) =>
    `group flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all select-none ${
      isActive
        ? 'bg-accent text-white shadow-md ring-1 ring-white/20'
        : 'text-white/75 hover:bg-white/10 hover:text-white font-medium'
    }`;

  const getIconClasses = (isActive: boolean) =>
    `w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-white' : 'text-white/70 group-hover:text-white'}`;

  // Employee Portal Navigation
  if (isEmployee) {
    const isPortalHome = path === '/portal' || path === '/portal/employee';
    const isPortalPunch = path === '/portal/punch' || path === '/portal/check-in';
    const isPortalLeave = path.includes('/portal/leave');
    const isPortalRegularisation = path.includes('/portal/regularisation');
    const isPortalPayslips = path.includes('/portal/payslip');
    const isPortalPolicies = path.includes('/portal/polic');

    return (
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] lg:static ${collapsed ? 'lg:w-20' : 'lg:w-64'} bg-primary-dark text-white flex flex-col shrink-0 border-r border-primary-active select-none transform transition-transform duration-300 ease-in-out ${
        isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Brand Header */}
        <div className={`p-4 border-b border-white/10 ${collapsed ? 'flex flex-col items-center' : ''}`}>
          {collapsed ? (
            <NavLink
              to="/portal"
              onClick={onCloseMobile}
              className="flex items-center justify-center p-1 group focus:outline-none"
              title="Avencis Portal"
            >
              <img
                src={avencisSymbolDarkBg}
                alt="Avencis"
                className="w-8 h-8 object-contain group-hover:scale-105 transition-transform"
              />
            </NavLink>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <NavLink
                  to="/portal"
                  onClick={onCloseMobile}
                  className="flex items-center gap-3 group focus:outline-none"
                  title="Avencis Self-Service Portal"
                >
                  <img
                    src={avencisSymbolDarkBg}
                    alt="Avencis Symbol"
                    className="h-7 w-auto max-w-[36px] object-contain shrink-0 group-hover:scale-105 transition-transform"
                  />
                  <img
                    src={avencisWordmark}
                    alt="Avencis"
                    className="h-[20px] w-auto max-w-[120px] object-contain brightness-0 invert shrink-0"
                  />
                </NavLink>
                {onCloseMobile && (
                  <button
                    onClick={onCloseMobile}
                    className="lg:hidden p-1.5 -mr-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Close navigation"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              <div className="mt-2.5 px-0.5 flex items-center justify-between">
                <span className="text-[10px] font-mono tracking-widest uppercase text-white/70 font-semibold">
                  Self-Service Portal
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-accent-light font-bold">
                  Employee
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-b border-white/10 bg-white/5">
          <div className="text-[11px] uppercase tracking-wider text-accent-light font-bold">Assigned Organisation</div>
          <div className="font-semibold text-sm text-white mt-0.5 truncate">{activeClient?.name || 'Client Employee'}</div>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          <NavLink
            to="/portal"
            end
            onClick={onCloseMobile}
            className={() => getNavItemClasses(isPortalHome)}
          >
            <Home className={getIconClasses(isPortalHome)} />
            <span>Employee Home</span>
          </NavLink>

          <NavLink
            to="/portal/punch"
            onClick={onCloseMobile}
            className={() => getNavItemClasses(isPortalPunch)}
          >
            <Clock className={getIconClasses(isPortalPunch)} />
            <span>Attendance & Punch</span>
          </NavLink>

          <NavLink
            to="/portal/leave"
            onClick={onCloseMobile}
            className={() => getNavItemClasses(isPortalLeave)}
          >
            <FileText className={getIconClasses(isPortalLeave)} />
            <span>Leave Requests & Balances</span>
          </NavLink>

          <NavLink
            to="/portal/regularisations"
            onClick={onCloseMobile}
            className={() => getNavItemClasses(isPortalRegularisation)}
          >
            <ShieldCheck className={getIconClasses(isPortalRegularisation)} />
            <span>Regularisations</span>
          </NavLink>

          <NavLink
            to="/portal/payslips"
            end
            onClick={onCloseMobile}
            className={() => getNavItemClasses(isPortalPayslips)}
          >
            <Receipt className={getIconClasses(isPortalPayslips)} />
            <span>My Payslips</span>
          </NavLink>

          <NavLink
            to="/portal/policies"
            end
            onClick={onCloseMobile}
            className={() => getNavItemClasses(isPortalPolicies)}
          >
            <Sliders className={getIconClasses(isPortalPolicies)} />
            <span>Company Policies</span>
          </NavLink>
        </nav>
      </aside>
    );
  }

  // Active state evaluators for Master Admin Platform Governance
  const isMasterDashboardActive = path === '/' || path === '/admin' || path === '/admin/dashboard';
  const isClientsDirectoryActive = (path.startsWith('/admin/clients') || path === '/clients') && !path.includes('/onboard') && !path.includes('/new');
  const isOnboardActive = path.includes('/onboard') || path.includes('/clients/new');
  const isEntitiesActive = path.startsWith('/admin/entities') || path.startsWith('/entities');
  const isLocationsActive = path === '/admin/locations' || path === '/locations';
  const isUsersActive = path.startsWith('/admin/users') || path.startsWith('/users');
  const isPermissionsActive = path.startsWith('/admin/permissions') || path.startsWith('/permissions');
  const isAuditActive = path.startsWith('/admin/audit') || path.startsWith('/audit');

  // Active state evaluators for Client Workspace
  const effectiveClientId = activeClientId || activeClient?.id;
  const isClientOverviewActive = path === '/workspace' || 
    path === '/workspace/overview' || 
    (Boolean(effectiveClientId) && (path === `/workspace/${effectiveClientId?.toLowerCase()}` || path === `/workspace/${effectiveClientId?.toLowerCase()}/overview`));
  const isWorkspaceEmployeesActive = path.includes('/workspace') && path.includes('/employee');
  const isWorkspaceAttendanceActive = path.includes('/workspace') && path.includes('/attendance') && !path.includes('/regularisation');
  const isWorkspaceRegularisationActive = path.includes('/workspace') && path.includes('/regularisation');
  const isWorkspaceLeaveActive = path.includes('/workspace') && (path.includes('/leave') || path.includes('/leaves'));
  const isWorkspacePayrollActive = path.includes('/workspace') && path.includes('/payroll') && !path.includes('/payslip');
  const isWorkspacePayslipsActive = path.includes('/workspace') && path.includes('/payslip');
  const isWorkspaceOrgActive = path.includes('/workspace') && path.includes('/organization');
  const isWorkspaceLocationsActive = path.includes('/workspace') && path.includes('/location');
  const isWorkspacePolicyActive = path.includes('/workspace') && (path.includes('/settings') || path.includes('/polic'));
  const isWorkspaceReportsActive = path.includes('/workspace') && path.includes('/report');

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] lg:static ${collapsed ? 'lg:w-20' : 'lg:w-64'} bg-primary text-white flex flex-col shrink-0 border-r border-primary-active select-none transform transition-transform duration-300 ease-in-out ${
      isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
    }`}>
      {/* Brand Header */}
      <div className={`p-4 border-b border-white/10 ${collapsed ? 'flex flex-col items-center' : ''}`}>
        {collapsed ? (
          <NavLink
            to="/admin/dashboard"
            onClick={onCloseMobile}
            className="flex items-center justify-center p-1 group focus:outline-none"
            title="Avencis WFM"
          >
            <img
              src={avencisSymbolDarkBg}
              alt="Avencis"
              className="w-8 h-8 object-contain group-hover:scale-105 transition-transform"
            />
          </NavLink>
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <NavLink
                to="/admin/dashboard"
                onClick={onCloseMobile}
                className="flex items-center gap-3 group focus:outline-none"
                title="Avencis Master Administration"
              >
                <img
                  src={avencisSymbolDarkBg}
                  alt="Avencis Symbol"
                  className="h-7 w-auto max-w-[36px] object-contain shrink-0 group-hover:scale-105 transition-transform"
                />
                <img
                  src={avencisWordmark}
                  alt="Avencis"
                  className="h-[20px] w-auto max-w-[120px] object-contain brightness-0 invert shrink-0"
                />
              </NavLink>
              {onCloseMobile && (
                <button
                  onClick={onCloseMobile}
                  className="lg:hidden p-1.5 -mr-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close navigation"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="mt-2.5 px-0.5 flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/70 font-semibold">
                {isInClientWorkspace ? 'Client Workspace' : 'Master Admin'}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-accent-light font-bold">
                WFM
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Mode Badge & Switcher indicator */}
      {isInClientWorkspace ? (
        <div className="p-3 mx-3 my-2 rounded-lg bg-white/10 border border-white/10">
          <div className="text-[10px] uppercase font-bold tracking-wider text-accent-light flex items-center justify-between">
            <span>Active Client Scope</span>
            <span className="w-2 h-2 rounded-full bg-success"></span>
          </div>
          <div className="font-bold text-sm text-white truncate mt-0.5">{activeClient?.name}</div>
          <div className="text-[11px] text-white/60 mt-0.5">{activeClient?.code} • {activeClient?.employeeCount} Employees</div>

          {isSuperAdmin && (
            <NavLink
              to="/admin/dashboard"
              onClick={onCloseMobile}
              className="mt-2 text-[11px] text-accent hover:text-accent-light font-bold flex items-center space-x-1 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Master Dashboard</span>
            </NavLink>
          )}
        </div>
      ) : (
        <div className="p-3 mx-3 my-2 rounded-lg bg-white/5 border border-white/5">
          <div className="text-[10px] uppercase font-bold tracking-wider text-white/60">Global Platform View</div>
          <div className="text-xs text-white/80 font-medium mt-0.5">Managing All Client Organisations</div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        {isInClientWorkspace ? (
          /* Client Workspace Navigation */
          <>
            {/* Manager Self-Service Quick Access */}
            {['client_admin', 'client_manager', 'hr_admin'].includes(currentUser?.role || '') && (
              <div className="mb-2 pb-2 border-b border-white/10">
                <div className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-accent-light">
                  Manager Self-Service
                </div>
                <NavLink
                  to="/portal/punch"
                  onClick={onCloseMobile}
                  className={() => getNavItemClasses(path.startsWith('/portal'))}
                >
                  <Clock className={getIconClasses(path.startsWith('/portal'))} />
                  <div className="flex items-center justify-between flex-1">
                    <span>My Attendance & Punch</span>
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-accent/30 text-white font-bold">ESS</span>
                  </div>
                </NavLink>
              </div>
            )}

            <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
              Workspace Operations
            </div>

            <NavLink
              to={effectiveClientId ? `/workspace/${effectiveClientId}` : '/workspace/overview'}
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isClientOverviewActive)}
            >
              <Home className={getIconClasses(isClientOverviewActive)} />
              <span>Client Overview</span>
            </NavLink>

            <NavLink
              to={effectiveClientId ? `/workspace/${effectiveClientId}/employees` : '/workspace/employees'}
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isWorkspaceEmployeesActive)}
            >
              <Users className={getIconClasses(isWorkspaceEmployeesActive)} />
              <span>Employees Directory</span>
            </NavLink>

            <NavLink
              to={effectiveClientId ? `/workspace/${effectiveClientId}/attendance` : '/workspace/attendance'}
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isWorkspaceAttendanceActive)}
            >
              <CalendarCheck className={getIconClasses(isWorkspaceAttendanceActive)} />
              <span>Attendance Command</span>
            </NavLink>

            <NavLink
              to={effectiveClientId ? `/workspace/${effectiveClientId}/attendance/regularisations` : '/workspace/regularisations'}
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isWorkspaceRegularisationActive)}
            >
              <Clock className={getIconClasses(isWorkspaceRegularisationActive)} />
              <span>Regularisation Queue</span>
            </NavLink>

            <NavLink
              to={effectiveClientId ? `/workspace/${effectiveClientId}/leave` : '/workspace/leave'}
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isWorkspaceLeaveActive)}
            >
              <FileText className={getIconClasses(isWorkspaceLeaveActive)} />
              <span>Leave Management</span>
            </NavLink>

            <NavLink
              to={effectiveClientId ? `/workspace/${effectiveClientId}/payroll` : '/workspace/payroll'}
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isWorkspacePayrollActive)}
            >
              <DollarSign className={getIconClasses(isWorkspacePayrollActive)} />
              <span>Payroll Processing</span>
            </NavLink>

            <NavLink
              to={effectiveClientId ? `/workspace/${effectiveClientId}/payroll/payslips` : '/workspace/payslips'}
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isWorkspacePayslipsActive)}
            >
              <Receipt className={getIconClasses(isWorkspacePayslipsActive)} />
              <span>Payslips Archive</span>
            </NavLink>

            <div className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
              Governance & Policies
            </div>

            <NavLink
              to={effectiveClientId ? `/workspace/${effectiveClientId}/organization` : '/workspace/organization'}
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isWorkspaceOrgActive)}
            >
              <Building2 className={getIconClasses(isWorkspaceOrgActive)} />
              <span>Organization Profile</span>
            </NavLink>

            <NavLink
              to={effectiveClientId ? `/workspace/${effectiveClientId}/locations` : '/workspace/locations'}
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isWorkspaceLocationsActive)}
            >
              <MapPin className={getIconClasses(isWorkspaceLocationsActive)} />
              <span>Work Locations & Geofence</span>
            </NavLink>

            <NavLink
              to={effectiveClientId ? `/workspace/${effectiveClientId}/settings` : '/workspace/policies'}
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isWorkspacePolicyActive)}
            >
              <Sliders className={getIconClasses(isWorkspacePolicyActive)} />
              <span>Client Policy Engine</span>
            </NavLink>

            <NavLink
              to={effectiveClientId ? `/workspace/${effectiveClientId}/reports` : '/workspace/reports'}
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isWorkspaceReportsActive)}
            >
              <BarChart3 className={getIconClasses(isWorkspaceReportsActive)} />
              <span>Client Reports</span>
            </NavLink>
          </>
        ) : (
          /* Master Admin Navigation */
          <>
            <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
              Platform Governance
            </div>

            <NavLink
              to="/admin/dashboard"
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isMasterDashboardActive)}
            >
              <Home className={getIconClasses(isMasterDashboardActive)} />
              <span>Master Dashboard</span>
            </NavLink>

            <NavLink
              to="/admin/clients"
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isClientsDirectoryActive)}
            >
              <Building2 className={getIconClasses(isClientsDirectoryActive)} />
              <span>Clients Directory</span>
            </NavLink>

            <NavLink
              to="/admin/clients/onboard"
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isOnboardActive)}
            >
              <Sparkles className={getIconClasses(isOnboardActive)} />
              <span>Onboard New Client</span>
            </NavLink>

            <NavLink
              to="/admin/entities"
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isEntitiesActive)}
            >
              <FileCheck2 className={getIconClasses(isEntitiesActive)} />
              <span>Legal Entities</span>
            </NavLink>

            <NavLink
              to="/admin/locations"
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isLocationsActive)}
            >
              <MapPin className={getIconClasses(isLocationsActive)} />
              <span>Work Locations & Geofence</span>
            </NavLink>

            <NavLink
              to="/admin/users"
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isUsersActive)}
            >
              <Users className={getIconClasses(isUsersActive)} />
              <span>Users & Roles</span>
            </NavLink>

            <NavLink
              to="/admin/permissions"
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isPermissionsActive)}
            >
              <Sliders className={getIconClasses(isPermissionsActive)} />
              <span>Permission Matrix</span>
            </NavLink>

            <NavLink
              to="/admin/audit"
              onClick={onCloseMobile}
              className={() => getNavItemClasses(isAuditActive)}
            >
              <ShieldCheck className={getIconClasses(isAuditActive)} />
              <span>Security Audit Logs</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer / Mobile View Quick Link */}
      <div className="p-3 border-t border-white/10 bg-white/5">
        <NavLink
          to="/portal"
          onClick={onCloseMobile}
          className={({ isActive }) =>
            `flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
              isActive || path.startsWith('/portal')
                ? 'bg-accent text-white shadow-sm'
                : 'bg-accent/20 hover:bg-accent/30 text-accent-light'
            }`
          }
        >
          <span className="flex items-center space-x-2">
            <Clock className="w-3.5 h-3.5" />
            <span>Employee Portal</span>
          </span>
          <span className="text-[10px] bg-accent px-1.5 py-0.5 rounded text-white font-bold">ESS</span>
        </NavLink>
      </div>
    </aside>
  );
};
