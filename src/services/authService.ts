/**
 * Avencis Workforce Management (WFM)
 * Authentication & Identity Service
 *
 * Wraps Supabase GoTrue authentication and user profile resolution.
 * Strictly prevents client-side role self-elevation and preserves
 * developer personas exclusively for offline development previews.
 */

import { supabase } from '../lib/supabase';
import { isMockMode, isDevPersonaAllowed } from './serviceConfig';
import { 
  ServiceResponse, 
  UserProfileRow, 
  EmployeeRow, 
  successResponse, 
  errorResponse 
} from './serviceTypes';
import { 
  handleSupabaseError, 
  createAuthError, 
  createValidationError, 
  createNotFoundError,
  createPermissionError,
} from './serviceErrors';
import { store } from '../data/store';
import type { Session, User } from '@supabase/supabase-js';

// Development mock persona state tracker
let activeDevPersonaEmail: string | null = null;

export interface ResolvedUserContext {
  userId: string;
  email: string;
  fullName: string;
  role: UserProfileRow['role'];
  clientId: string | null;
  employeeId: string | null;
  employeeProfile?: EmployeeRow | null;
  isActive: boolean;
}

export const authService = {
  /**
   * Retrieves the current Supabase session.
   */
  async getSession(): Promise<ServiceResponse<Session | null>> {
    if (isMockMode()) {
      return successResponse<Session | null>(null);
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        return errorResponse(handleSupabaseError(error, 'authService.getSession'));
      }
      return successResponse(data.session);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'authService.getSession'));
    }
  },

  /**
   * Retrieves the current authenticated user from GoTrue.
   */
  async getCurrentUser(): Promise<ServiceResponse<User | null>> {
    if (isMockMode()) {
      return successResponse<User | null>(null);
    }

    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        return errorResponse(handleSupabaseError(error, 'authService.getCurrentUser'));
      }
      return successResponse(data.user);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'authService.getCurrentUser'));
    }
  },

  /**
   * Subscribes to Supabase authentication state changes.
   */
  onAuthStateChange(
    callback: (event: string, session: Session | null) => void
  ): { unsubscribe: () => void } {
    if (isMockMode()) {
      return { unsubscribe: () => {} };
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });

    return {
      unsubscribe: () => subscription.unsubscribe(),
    };
  },

  /**
   * Signs in a user using email and password.
   */
  async signIn(credentials: { email: string; password?: string }): Promise<ServiceResponse<{ session: Session | null; user: User | null }>> {
    if (!credentials.email || !credentials.email.includes('@')) {
      return errorResponse(createValidationError('A valid email address is required.', 'email'));
    }

    if (isMockMode()) {
      const mockUser = store.getUserByEmail(credentials.email);
      if (!mockUser) {
        return errorResponse(createNotFoundError('User persona', credentials.email));
      }
      return successResponse({ session: null, user: null });
    }

    if (!credentials.password) {
      return errorResponse(createValidationError('Password is required for production authentication.', 'password'));
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email.trim(),
        password: credentials.password,
      });

      if (error) {
        return errorResponse(handleSupabaseError(error, 'authService.signIn'));
      }

      return successResponse({ session: data.session, user: data.user });
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'authService.signIn'));
    }
  },

  /**
   * Signs out the currently authenticated user.
   */
  async signOut(): Promise<ServiceResponse<void>> {
    if (isMockMode()) {
      return successResponse(undefined);
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return errorResponse(handleSupabaseError(error, 'authService.signOut'));
      }
      return successResponse(undefined);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'authService.signOut'));
    }
  },

  /**
   * Securely updates the password for the current active user session.
   * Available to all roles (Super Admin, Client Admin, HR Admin, Employee, etc.)
   */
  async changePassword(newPassword: string): Promise<ServiceResponse<void>> {
    if (!newPassword || newPassword.length < 6) {
      return errorResponse(createValidationError('New password must be at least 6 characters long.', 'newPassword'));
    }

    if (isMockMode()) {
      return successResponse(undefined);
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return errorResponse(handleSupabaseError(error, 'authService.changePassword'));
      }

      return successResponse(undefined);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'authService.changePassword'));
    }
  },

  /**
   * Provisions a new user account with initial password in Supabase.
   * Super Admins can provision Client Admins; Client Admins can provision Employees/Managers.
   */
  async provisionUserAccount(params: {
    email: string;
    password: string;
    fullName: string;
    role: UserProfileRow['role'];
    clientId?: string | null;
    employeeId?: string | null;
  }): Promise<ServiceResponse<{ userId: string }>> {
    if (!params.email || !params.email.includes('@')) {
      return errorResponse(createValidationError('A valid email address is required.', 'email'));
    }
    if (!params.password || params.password.length < 6) {
      return errorResponse(createValidationError('Initial password must be at least 6 characters long.', 'password'));
    }
    if (!params.fullName || params.fullName.trim().length === 0) {
      return errorResponse(createValidationError('Full name is required.', 'fullName'));
    }

    if (isMockMode()) {
      const mockId = `user-${Date.now()}`;
      return successResponse({ userId: mockId });
    }

    try {
      const { data, error } = await (supabase.rpc as any)('provision_user_account', {
        p_email: params.email.trim().toLowerCase(),
        p_password: params.password,
        p_full_name: params.fullName.trim(),
        p_role: params.role,
        p_client_id: params.clientId || null,
        p_employee_id: params.employeeId || null,
      });

      if (error) {
        return errorResponse(handleSupabaseError(error, 'authService.provisionUserAccount'));
      }

      const res = data as any;
      return successResponse({ userId: res?.user_id || '' });
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'authService.provisionUserAccount'));
    }
  },

  /**
   * Retrieves all user profile accounts accessible to the current user.
   */
  async getAllUsers(): Promise<ServiceResponse<UserProfileRow[]>> {
    if (isMockMode()) {
      const mockUsers = store.getUsers().map(u => ({
        id: u.id,
        email: u.email,
        full_name: u.fullName || u.name || 'User',
        role: u.role as UserProfileRow['role'],
        client_id: u.clientId || null,
        employee_id: u.employeeId || null,
        is_active: true,
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      return successResponse(mockUsers);
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return errorResponse(handleSupabaseError(error, 'authService.getAllUsers'));
      }

      return successResponse(data || []);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'authService.getAllUsers'));
    }
  },

  /**
   * Resolves the user_profiles record corresponding to an auth user ID.
   */
  async getUserProfile(userId: string): Promise<ServiceResponse<UserProfileRow>> {
    if (!userId) {
      return errorResponse(createValidationError('User ID is required.', 'userId'));
    }

    if (isMockMode()) {
      const users = store.getUsers();
      const match = users.find(u => u.id === userId);
      if (!match) {
        return errorResponse(createNotFoundError('User Profile', userId));
      }
      const mockProfile: UserProfileRow = {
        id: match.id,
        email: match.email,
        full_name: match.fullName || match.name || 'Mock User',
        role: match.role as UserProfileRow['role'],
        client_id: match.clientId || null,
        employee_id: match.employeeId || null,
        is_active: true,
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return successResponse(mockProfile);
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'authService.getUserProfile'));
      }

      if (!data) {
        return errorResponse(createNotFoundError('User Profile', userId));
      }

      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'authService.getUserProfile'));
    }
  },

  /**
   * Resolves the linked employee record for an employee user account.
   */
  async getEmployeeProfile(employeeId: string): Promise<ServiceResponse<EmployeeRow>> {
    if (!employeeId) {
      return errorResponse(createValidationError('Employee ID is required.', 'employeeId'));
    }

    if (isMockMode()) {
      const emp = store.getEmployee(employeeId);
      if (!emp) {
        return errorResponse(createNotFoundError('Employee', employeeId));
      }
      const mockEmp: EmployeeRow = {
        id: emp.id,
        client_id: emp.clientId,
        legal_entity_id: emp.legalEntityId || '',
        work_location_id: emp.workLocationId || '',
        department_id: emp.departmentId || null,
        employee_code: emp.employeeCode,
        first_name: emp.firstName,
        last_name: emp.lastName,
        email: emp.email,
        mobile: emp.mobile,
        designation: emp.designation,
        joining_date: emp.joiningDate,
        employment_arrangement: (emp.employmentType === 'CONTRACT' ? 'DIRECT_CONTRACT' : 'DIRECT_PERMANENT') as EmployeeRow['employment_arrangement'],
        status: (emp.status || 'ACTIVE') as EmployeeRow['status'],
        pan_number: emp.panNumber || 'MOCKPAN123',
        aadhaar_number: emp.aadhaarNumber || '0000 0000 0000',
        uan_number: emp.uanNumber || null,
        esic_number: emp.esicNumber || null,
        avatar_url: emp.avatarUrl || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return successResponse(mockEmp);
    }

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'authService.getEmployeeProfile'));
      }

      if (!data) {
        return errorResponse(createNotFoundError('Employee', employeeId));
      }

      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'authService.getEmployeeProfile'));
    }
  },

  /**
   * Resolves full user context including RBAC role, client scope, and linked employee.
   */
  async resolveUserContext(): Promise<ServiceResponse<ResolvedUserContext>> {
    if (isMockMode()) {
      const users = store.getUsers();
      const u = (activeDevPersonaEmail ? users.find(x => x.email.toLowerCase() === activeDevPersonaEmail!.toLowerCase()) : null) || users[0];
      return successResponse<ResolvedUserContext>({
        userId: u.id,
        email: u.email,
        fullName: u.fullName || u.name || 'Administrator',
        role: u.role as UserProfileRow['role'],
        clientId: u.clientId || null,
        employeeId: u.employeeId || null,
        isActive: true,
      });
    }

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return errorResponse(createAuthError('No active authenticated session found.'));
      }

      const profileRes = await this.getUserProfile(user.id);
      if (!profileRes.success || !profileRes.data) {
        return errorResponse(profileRes.error || createNotFoundError('User Profile', user.id));
      }

      const profile = profileRes.data;
      if (!profile.is_active) {
        return errorResponse(createAuthError('User account has been deactivated. Please contact your system administrator.'));
      }

      let employeeProfile: EmployeeRow | null = null;
      if (profile.employee_id) {
        const empRes = await this.getEmployeeProfile(profile.employee_id);
        if (empRes.success) {
          employeeProfile = empRes.data;
        }
      }

      return successResponse<ResolvedUserContext>({
        userId: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role,
        clientId: profile.client_id,
        employeeId: profile.employee_id,
        employeeProfile,
        isActive: profile.is_active,
      });
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'authService.resolveUserContext'));
    }
  },

  /**
   * Sets the active mock persona by email (Development mock mode only).
   */
  async devSetPersonaByEmail(email: string): Promise<ServiceResponse<ResolvedUserContext>> {
    if (!isDevPersonaAllowed()) {
      return errorResponse(createPermissionError('Developer persona switcher is prohibited in production builds or live authentication mode.'));
    }
    const u = store.getUserByEmail(email);
    if (!u) {
      return errorResponse(createNotFoundError('Developer Persona', email));
    }
    activeDevPersonaEmail = u.email;
    return this.resolveUserContext();
  },

  /**
   * Switches development persona by role and optional client ID (Development mock mode only).
   */
  async devSwitchPersona(role: UserProfileRow['role'], clientId?: string): Promise<ServiceResponse<ResolvedUserContext>> {
    if (!isDevPersonaAllowed()) {
      return errorResponse(createPermissionError('Developer persona switcher is prohibited in production builds or live authentication mode.'));
    }
    const users = store.getUsers();
    let target = users.find(u => u.role === role && (!clientId || u.clientId === clientId));
    if (!target) {
      target = users.find(u => u.role === role) || users[0];
    }
    activeDevPersonaEmail = target.email;
    return this.resolveUserContext();
  },

  /**
   * Exposes development personas exclusively when in development preview mode.
   */
  getDevPersonas() {
    if (!isDevPersonaAllowed()) {
      return [];
    }
    return store.getUsers();
  },

  /**
   * Helper: Validates user role against an array of permitted roles.
   */
  verifyRole(user: UserProfileRow | ResolvedUserContext, allowedRoles: UserProfileRow['role'][]): boolean {
    return allowedRoles.includes(user.role);
  },
};
