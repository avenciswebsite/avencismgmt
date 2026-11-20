/**
 * Avencis Workforce Management (WFM)
 * Workspace Context Provider
 *
 * Connects frontend presentation to policyService.ts.
 * Implements accessible client retrieval, tenant workspace isolation,
 * authorized client switching, and worksite/policy configuration synchronization.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Client, ClientPolicy, ClientLegalEntity, WorkLocation, Department } from '../types';
import { policyService } from '../services/policyService';
import { 
  ClientRow, 
  ClientPolicyRow, 
  WorkLocationRow, 
  LegalEntityRow, 
  DepartmentRow 
} from '../services/serviceTypes';
import { formatErrorMessage } from '../services/serviceErrors';
import { useAuth } from './AuthContext';

export interface WorkspaceContextType {
  activeClient: Client;
  currentClient: Client; // alias
  activeClientId: string;
  switchClient: (clientId: string) => Promise<boolean>;
  clientPolicy: ClientPolicy;
  refreshWorkspace: () => void;
  availableClients: Client[];
  clients: Client[]; // alias
  activeLegalEntity?: ClientLegalEntity;
  activeLocations: WorkLocation[];
  departments: Department[];
  isLoadingWorkspace: boolean;
  workspaceError: string | null;
}

const FALLBACK_CLIENT: Client = {
  id: '',
  name: 'No Workspace Selected',
  code: 'NA',
  industry: 'Enterprise',
  status: 'onboarding',
  employeeCount: 0,
  activeLocationsCount: 0,
  contactPerson: '',
  contactEmail: '',
  contactPhone: '',
  createdAt: new Date().toISOString(),
};

const FALLBACK_POLICY: ClientPolicy = {
  id: '',
  clientId: '',
  isConfigured: false,
  overtimeMethod: 'disabled',
  overtimeRate: 1.0,
  lateGraceMinutes: 0,
  latePenaltyRule: 'none',
  overnightShiftAttribution: 'shift_start_date',
  standardWorkingHours: 9.0,
  halfDayHours: 4.5,
  weeklyOffDays: ['SUNDAY'],
  attendanceTrackingMode: 'double_punch',
  requireGps: true,
  requireSelfie: false,
  enforceStrictGeofence: true,
  leaveTypesSupported: ['PL', 'CL', 'SL', 'LWP'],
  minServiceDaysForLeave: 30,
  monthlyPaidLeaveAccrual: 2.0,
  maxCarryForward: 30,
  allowLeaveEncashment: false,
  unpaidLeaveDeductionFormula: 'per_day_proration',
  salaryDivisor: '30',
  pfEnabled: false,
  pfEmployeePercent: 0,
  pfEmployerPercent: 0,
  esicEnabled: false,
  esicEmployeePercent: 0,
  esicEmployerPercent: 0,
  ptEnabled: false,
  tdsEnabled: false,
  updatedAt: new Date().toISOString(),
  updatedBy: 'System Initializer',
};

// Data mappers from service rows to frontend types
function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    industry: row.industry,
    status: row.status,
    contactPerson: row.contact_person,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    employeeCount: 0,
    activeLocationsCount: 0,
    createdAt: row.created_at,
  };
}

function mapPolicy(row: ClientPolicyRow): ClientPolicy {
  return {
    id: row.id,
    clientId: row.client_id,
    isConfigured: row.is_configured,
    overtimeMethod: row.overtime_method,
    overtimeRate: Number(row.overtime_rate),
    lateGraceMinutes: row.late_grace_minutes,
    latePenaltyRule: row.late_penalty_rule,
    overnightShiftAttribution: row.overnight_shift_attribution,
    standardWorkingHours: Number(row.standard_working_hours),
    halfDayHours: Number(row.half_day_hours),
    weeklyOffDays: row.weekly_off_days as any,
    attendanceTrackingMode: row.attendance_tracking_mode,
    requireGps: row.require_gps,
    requireSelfie: row.require_selfie,
    enforceStrictGeofence: row.enforce_strict_geofence,
    leaveTypesSupported: row.leave_types_supported as any,
    minServiceDaysForLeave: row.min_service_days_for_leave,
    monthlyPaidLeaveAccrual: Number(row.monthly_paid_leave_accrual),
    maxCarryForward: row.max_carry_forward,
    allowLeaveEncashment: row.allow_leave_encashment,
    unpaidLeaveDeductionFormula: row.unpaid_leave_deduction_formula as any,
    salaryDivisor: row.salary_divisor,
    pfEnabled: row.pf_enabled,
    pfEmployeePercent: Number(row.pf_employee_percent),
    pfEmployerPercent: Number(row.pf_employer_percent),
    esicEnabled: row.esic_enabled,
    esicEmployeePercent: Number(row.esic_employee_percent),
    esicEmployerPercent: Number(row.esic_employer_percent),
    ptEnabled: row.pt_enabled,
    tdsEnabled: row.tds_enabled,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}

function mapLocation(row: WorkLocationRow): WorkLocation {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    code: row.code || undefined,
    address: row.address,
    state: row.state,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    radiusMeters: Number(row.radius_meters),
    activeHeadcount: row.active_headcount,
  };
}

function mapLegalEntity(row: LegalEntityRow): ClientLegalEntity {
  return {
    id: row.id,
    clientId: row.client_id,
    legalName: row.legal_name,
    tradeName: row.trade_name || undefined,
    registrationNumber: row.registration_number || undefined,
    registrationType: row.registration_type,
    pan: row.pan,
    panNumber: row.pan,
    tan: row.tan || undefined,
    gstin: row.gstin || undefined,
    pfEstablishmentCode: row.pf_establishment_code || undefined,
    esicRegistrationCode: row.esic_registration_code || undefined,
    registeredAddress: row.registered_address,
    isPrimary: row.is_primary,
  };
}

function mapDepartment(row: DepartmentRow): Department {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    code: row.code,
    headOfDepartment: row.head_employee_id || undefined,
    headEmployeeId: row.head_employee_id || undefined,
  };
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();

  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [activeClientId, setActiveClientId] = useState<string>('');
  const [activeClient, setActiveClient] = useState<Client>(FALLBACK_CLIENT);
  const [clientPolicy, setClientPolicy] = useState<ClientPolicy>(FALLBACK_POLICY);
  const [activeLegalEntity, setActiveLegalEntity] = useState<ClientLegalEntity | undefined>(undefined);
  const [activeLocations, setActiveLocations] = useState<WorkLocation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState<boolean>(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  /**
   * Loads specific workspace entities for a target client.
   */
  const loadWorkspaceDetails = useCallback(async (clientId: string, clientList: Client[]) => {
    if (!clientId) {
      setActiveClient(FALLBACK_CLIENT);
      setClientPolicy(FALLBACK_POLICY);
      setActiveLegalEntity(undefined);
      setActiveLocations([]);
      setDepartments([]);
      return;
    }

    const current = clientList.find(c => c.id === clientId) || clientList[0] || FALLBACK_CLIENT;
    setActiveClient(current);

    try {
      const [polRes, locsRes, deptsRes, lesRes] = await Promise.all([
        policyService.getClientPolicy(clientId),
        policyService.getWorkLocations(clientId),
        policyService.getDepartments(clientId),
        policyService.getLegalEntities(clientId),
      ]);

      if (polRes.success && polRes.data) {
        setClientPolicy(mapPolicy(polRes.data));
      } else {
        setClientPolicy({ ...FALLBACK_POLICY, clientId });
      }

      if (locsRes.success && locsRes.data) {
        setActiveLocations(locsRes.data.map(mapLocation));
      } else {
        setActiveLocations([]);
      }

      if (deptsRes.success && deptsRes.data) {
        setDepartments(deptsRes.data.map(mapDepartment));
      } else {
        setDepartments([]);
      }

      if (lesRes.success && lesRes.data && lesRes.data.length > 0) {
        setActiveLegalEntity(mapLegalEntity(lesRes.data[0]));
      } else {
        setActiveLegalEntity(undefined);
      }
    } catch (err: any) {
      console.error('[Avencis WFM] Error loading workspace entities:', err);
    }
  }, []);

  /**
   * Synchronizes the accessible workspace list based on current user permissions.
   */
  const syncWorkspaces = useCallback(async () => {
    if (!currentUser || !isAuthenticated) {
      setAvailableClients([]);
      setActiveClientId('');
      setActiveClient(FALLBACK_CLIENT);
      setClientPolicy(FALLBACK_POLICY);
      setActiveLocations([]);
      setDepartments([]);
      setIsLoadingWorkspace(false);
      return;
    }

    setIsLoadingWorkspace(true);
    setWorkspaceError(null);

    try {
      // 1. Fetch accessible clients based on role and database RLS
      const clientsRes = await policyService.getAccessibleClients({
        role: currentUser.role,
        clientId: currentUser.clientId,
      });

      if (!clientsRes.success || !clientsRes.data) {
        setWorkspaceError(clientsRes.error ? formatErrorMessage(clientsRes.error) : 'Failed to retrieve accessible workspaces.');
        setAvailableClients([]);
        setActiveClientId('');
        setActiveClient(FALLBACK_CLIENT);
        setIsLoadingWorkspace(false);
        return;
      }

      const clientList = clientsRes.data.map(mapClient);
      setAvailableClients(clientList);

      if (clientList.length === 0) {
        setWorkspaceError('No accessible client organisations found for this user account.');
        setActiveClientId('');
        setActiveClient(FALLBACK_CLIENT);
        setIsLoadingWorkspace(false);
        return;
      }

      // 2. Resolve target workspace ID
      let resolvedId = '';

      // If user is restricted to a single tenant (e.g. client_admin or employee)
      if (currentUser.role !== 'super_admin' && currentUser.clientId) {
        const tenantMatch = clientList.find(c => c.id === currentUser.clientId);
        resolvedId = tenantMatch ? tenantMatch.id : clientList[0].id;
      } else {
        // Super Admin: can access multiple workspaces; respect persisted selection if valid
        const saved = localStorage.getItem('avencis_active_client_id');
        if (saved && clientList.some(c => c.id === saved)) {
          resolvedId = saved;
        } else {
          resolvedId = clientList[0].id;
        }
      }

      setActiveClientId(resolvedId);
      await loadWorkspaceDetails(resolvedId, clientList);
    } catch (err: any) {
      setWorkspaceError(err.message || 'An unexpected error occurred while loading client workspaces.');
    } finally {
      setIsLoadingWorkspace(false);
    }
  }, [currentUser, isAuthenticated, loadWorkspaceDetails]);

  // Initial and reactive load on user change
  useEffect(() => {
    syncWorkspaces();
  }, [syncWorkspaces]);

  const location = useLocation();

  /**
   * Switches workspace with strict authorization validation.
   */
  const switchClient = useCallback(async (targetClientId: string): Promise<boolean> => {
    if (!targetClientId) return false;

    // Refresh available clients list if the target client was newly created or not in cache
    let currentClients = availableClients;
    if (!currentClients.some(c => c.id === targetClientId)) {
      const clientsRes = await policyService.getAccessibleClients({
        role: currentUser?.role || 'super_admin',
        clientId: currentUser?.clientId,
      });
      if (clientsRes.success && clientsRes.data) {
        currentClients = clientsRes.data.map(mapClient);
        setAvailableClients(currentClients);
      }
    }

    // Authorization validation: Super Admin can access any client; other roles must have target ID in clientList
    const isAuthorized = currentUser?.role === 'super_admin' || currentClients.some(c => c.id === targetClientId);

    if (!isAuthorized) {
      console.warn(`[Avencis Security] Unauthorized workspace switch attempted for client ID '${targetClientId}'. Action blocked.`);
      setWorkspaceError(`Access Denied: You do not have permissions to access workspace '${targetClientId}'.`);
      return false;
    }

    // Role-specific check: non-super-admins cannot switch away from assigned client
    if (currentUser && currentUser.role !== 'super_admin' && currentUser.clientId && currentUser.clientId !== targetClientId) {
      console.warn(`[Avencis Security] Cross-tenant switch blocked for role '${currentUser.role}'.`);
      setWorkspaceError(`Access Denied: Your account role is restricted to your assigned organization.`);
      return false;
    }

    setIsLoadingWorkspace(true);
    setWorkspaceError(null);
    setActiveClientId(targetClientId);
    localStorage.setItem('avencis_active_client_id', targetClientId);

    await loadWorkspaceDetails(targetClientId, currentClients);
    setIsLoadingWorkspace(false);
    return true;
  }, [availableClients, currentUser, loadWorkspaceDetails]);

  // Synchronize active workspace if URL contains an authorized client route
  useEffect(() => {
    const match = location.pathname.match(/\/workspace\/([^\/]+)/);
    const targetClientId = match ? match[1] : null;
    const reservedWorkspacePaths = [
      'overview', 'employees', 'attendance', 'regularisations',
      'leaves', 'leave', 'payroll', 'payslips', 'policies',
      'settings', 'reports', 'organization', 'locations'
    ];
    if (
      targetClientId &&
      !reservedWorkspacePaths.includes(targetClientId) &&
      targetClientId !== activeClientId &&
      availableClients.some(c => c.id === targetClientId)
    ) {
      if (currentUser?.role === 'super_admin' || currentUser?.clientId === targetClientId) {
        switchClient(targetClientId);
      }
    }
  }, [location.pathname, activeClientId, availableClients, currentUser, switchClient]);

  const refreshWorkspace = useCallback(() => {
    syncWorkspaces();
  }, [syncWorkspaces]);

  const contextValue = useMemo(() => ({
    activeClient,
    currentClient: activeClient,
    activeClientId,
    switchClient,
    clientPolicy,
    refreshWorkspace,
    availableClients,
    clients: availableClients,
    activeLegalEntity,
    activeLocations,
    departments,
    isLoadingWorkspace,
    workspaceError,
  }), [
    activeClient,
    activeClientId,
    switchClient,
    clientPolicy,
    refreshWorkspace,
    availableClients,
    activeLegalEntity,
    activeLocations,
    departments,
    isLoadingWorkspace,
    workspaceError,
  ]);

  return (
    <WorkspaceContext.Provider value={contextValue}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
