import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { AppShell } from './components/layout/AppShell';

// Auth
import { LoginView } from './app/auth/LoginView';

// Admin Views
import { MasterDashboard } from './app/admin/MasterDashboard';
import { ClientDirectoryView } from './app/admin/ClientDirectoryView';
import { ClientOnboardWizard } from './app/admin/ClientOnboardWizard';
import { LegalEntitiesView } from './app/admin/LegalEntitiesView';
import { UsersRolesView } from './app/admin/UsersRolesView';
import { PermissionMatrixView } from './app/admin/PermissionMatrixView';
import { SecurityAuditView } from './app/admin/SecurityAuditView';
import { ReportsAnalyticsView } from './app/admin/ReportsAnalyticsView';
import { OrganizationProfileView } from './app/admin/OrganizationProfileView';
import { WorkLocationsView } from './app/admin/WorkLocationsView';

// Workspace Views
import { ClientOverview } from './app/workspace/ClientOverview';
import { EmployeeDirectory } from './app/workspace/EmployeeDirectory';
import { AddEmployeeWizard } from './app/workspace/AddEmployeeWizard';
import { EmployeeProfileView } from './app/workspace/EmployeeProfileView';
import { AttendanceCommandCenter } from './app/workspace/AttendanceCommandCenter';
import { AttendanceRegularisations } from './app/workspace/AttendanceRegularisations';
import { LeaveManagement } from './app/workspace/LeaveManagement';
import { PayrollDashboard } from './app/workspace/PayrollDashboard';
import { PayrollGuidedWizard } from './app/workspace/PayrollGuidedWizard';
import { PayslipManagement } from './app/workspace/PayslipManagement';
import { OfficialPayslipView } from './app/workspace/OfficialPayslipView';
import { ClientPolicySettings } from './app/workspace/ClientPolicySettings';

// Employee Portal
import { EmployeePortal } from './app/portal/EmployeePortal';
import { MobilePunchCard } from './app/portal/MobilePunchCard';

// Root Router Redirector
const RootRedirect: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'super_admin') return <Navigate to="/admin/dashboard" replace />;
  if (['client_admin', 'hr_admin', 'payroll_admin', 'client_manager', 'location_manager'].includes(user.role)) {
    return <Navigate to="/workspace/overview" replace />;
  }
  return <Navigate to="/portal" replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <Routes>
            {/* Public Login */}
            <Route path="/login" element={<LoginView />} />

            {/* Authenticated Application Shell */}
            <Route element={<AppShell />}>
              <Route path="/" element={<RootRedirect />} />

              {/* Admin Routes */}
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={<MasterDashboard />} />
              <Route path="/admin/clients" element={<ClientDirectoryView />} />
              <Route path="/admin/clients/onboard" element={<ClientOnboardWizard />} />
              <Route path="/admin/clients/new" element={<ClientOnboardWizard />} />
              <Route path="/admin/onboard" element={<ClientOnboardWizard />} />
              <Route path="/clients" element={<Navigate to="/admin/clients" replace />} />
              <Route path="/clients/onboard" element={<Navigate to="/admin/onboard" replace />} />
              <Route path="/admin/entities" element={<LegalEntitiesView />} />
              <Route path="/admin/users" element={<UsersRolesView />} />
              <Route path="/admin/permissions" element={<PermissionMatrixView />} />
              <Route path="/admin/audit" element={<SecurityAuditView />} />
              <Route path="/admin/reports" element={<ReportsAnalyticsView />} />
              <Route path="/admin/organization" element={<OrganizationProfileView />} />
              <Route path="/admin/locations" element={<WorkLocationsView />} />
              <Route path="/organization" element={<Navigate to="/workspace/organization" replace />} />

              {/* Workspace Routes */}
              <Route path="/workspace" element={<Navigate to="/workspace/overview" replace />} />
              <Route path="/workspace/overview" element={<ClientOverview />} />
              <Route path="/workspace/organization" element={<OrganizationProfileView />} />
              <Route path="/workspace/locations" element={<WorkLocationsView />} />
              <Route path="/workspace/:clientId" element={<ClientOverview />} />
              <Route path="/workspace/:clientId/overview" element={<ClientOverview />} />
              <Route path="/workspace/:clientId/organization" element={<OrganizationProfileView />} />
              <Route path="/workspace/:clientId/locations" element={<WorkLocationsView />} />
              <Route path="/workspace/:clientId/employees" element={<EmployeeDirectory />} />
              <Route path="/workspace/:clientId/employees/new" element={<AddEmployeeWizard />} />
              <Route path="/workspace/:clientId/employees/:employeeId" element={<EmployeeProfileView />} />
              <Route path="/workspace/:clientId/attendance" element={<AttendanceCommandCenter />} />
              <Route path="/workspace/:clientId/attendance/regularisations" element={<AttendanceRegularisations />} />
              <Route path="/workspace/:clientId/settings" element={<ClientPolicySettings />} />
              <Route path="/workspace/:clientId/policies" element={<ClientPolicySettings />} />
              <Route path="/workspace/:clientId/payroll" element={<PayrollDashboard />} />
              <Route path="/workspace/:clientId/payroll/wizard" element={<PayrollGuidedWizard />} />
              <Route path="/workspace/:clientId/payroll/payslips" element={<PayslipManagement />} />
              <Route path="/workspace/:clientId/leaves" element={<LeaveManagement />} />
              <Route path="/workspace/:clientId/leave" element={<LeaveManagement />} />
              <Route path="/workspace/:clientId/reports" element={<ReportsAnalyticsView />} />
              <Route path="/workspace/employees" element={<EmployeeDirectory />} />
              <Route path="/workspace/employees/add" element={<AddEmployeeWizard />} />
              <Route path="/workspace/employees/:employeeId" element={<EmployeeProfileView />} />
              <Route path="/workspace/attendance" element={<AttendanceCommandCenter />} />
              <Route path="/workspace/regularisations" element={<AttendanceRegularisations />} />
              <Route path="/workspace/leaves" element={<LeaveManagement />} />
              <Route path="/workspace/leave" element={<LeaveManagement />} />
              <Route path="/workspace/payroll" element={<PayrollDashboard />} />
              <Route path="/workspace/payroll/run" element={<PayrollGuidedWizard />} />
              <Route path="/workspace/payslips" element={<PayslipManagement />} />
              <Route path="/workspace/payroll/payslips" element={<PayslipManagement />} />
              <Route path="/workspace/payslips/view/:employeeId" element={<OfficialPayslipView />} />
              <Route path="/workspace/policies" element={<ClientPolicySettings />} />
              <Route path="/workspace/reports" element={<ReportsAnalyticsView />} />

              {/* Employee Portal Routes - All share persistent header & tabs */}
              <Route path="/portal" element={<EmployeePortal defaultTab="punch" />} />
              <Route path="/portal/employee" element={<EmployeePortal defaultTab="punch" />} />
              <Route path="/portal/punch" element={<EmployeePortal defaultTab="punch" />} />
              <Route path="/portal/check-in" element={<EmployeePortal defaultTab="punch" />} />
              <Route path="/portal/leave" element={<EmployeePortal defaultTab="leaves" />} />
              <Route path="/portal/leaves" element={<EmployeePortal defaultTab="leaves" />} />
              <Route path="/portal/regularisations" element={<EmployeePortal defaultTab="regularisations" />} />
              <Route path="/portal/payslips" element={<EmployeePortal defaultTab="payslips" />} />
              <Route path="/portal/policies" element={<EmployeePortal defaultTab="policies" />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
