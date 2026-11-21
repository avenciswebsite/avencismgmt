/**
 * Avencis Workforce Management (WFM)
 * Client Organisation, Structure & Operational Policy Service
 *
 * Interfaces with clients, client_legal_entities, work_locations,
 * departments, and client_policies tables in PostgreSQL.
 */

import { supabase } from '../lib/supabase';
import { isMockMode } from './serviceConfig';
import {
  ServiceResponse,
  ClientRow,
  ClientInsert,
  ClientUpdate,
  LegalEntityRow,
  LegalEntityInsert,
  WorkLocationRow,
  WorkLocationInsert,
  DepartmentRow,
  DepartmentInsert,
  DepartmentUpdate,
  ClientPolicyRow,
  ClientPolicyUpdate,
  ClientCardSummary,
  successResponse,
  errorResponse,
} from './serviceTypes';
import {
  handleSupabaseError,
  createValidationError,
  createNotFoundError,
} from './serviceErrors';
import { store } from '../data/store';

export const policyService = {
  /**
   * Retrieves all clients accessible to the current caller.
   * Super Admins receive all clients; Client Admins/Employees receive their tenant client.
   */
  async getAccessibleClients(userScope?: { role: string; clientId?: string | null }): Promise<ServiceResponse<ClientRow[]>> {
    if (isMockMode()) {
      let clients = store.getClients();
      if (userScope && userScope.role !== 'super_admin' && userScope.clientId) {
        clients = clients.filter(c => c.id === userScope.clientId);
      }
      const mockClients = clients.map(c => ({
        id: c.id,
        code: c.code,
        name: c.name,
        industry: c.industry,
        status: (c.status || 'active') as ClientRow['status'],
        contact_person: c.contactPerson || 'Demo Admin',
        contact_email: c.contactEmail || 'admin@demo.test',
        contact_phone: c.contactPhone || '+91 99999 00000',
        created_at: c.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      return successResponse(mockClients);
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) {
        return errorResponse(handleSupabaseError(error, 'policyService.getAccessibleClients'));
      }

      return successResponse(data || []);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.getAccessibleClients'));
    }
  },

  /**
   * Retrieves details for a specific client organization.
   */
  async getClient(clientId: string): Promise<ServiceResponse<ClientRow>> {
    if (!clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }

    if (isMockMode()) {
      const client = store.getClient(clientId);
      if (!client) {
        return errorResponse(createNotFoundError('Client', clientId));
      }
      return successResponse<ClientRow>({
        id: client.id,
        code: client.code,
        name: client.name,
        industry: client.industry,
        status: (client.status || 'active') as ClientRow['status'],
        contact_person: client.contactPerson || 'Demo Admin',
        contact_email: client.contactEmail || 'admin@demo.test',
        contact_phone: client.contactPhone || '+91 99999 00000',
        created_at: client.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'policyService.getClient'));
      }

      if (!data) {
        return errorResponse(createNotFoundError('Client', clientId));
      }

      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.getClient'));
    }
  },

  /**
   * Alias for getClient
   */
  getClientById(clientId: string) {
    return this.getClient(clientId);
  },

  /**
   * Retrieves legal entities registered under a client.
   */
  async getLegalEntities(clientId: string): Promise<ServiceResponse<LegalEntityRow[]>> {
    if (!clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }

    if (isMockMode()) {
      const les = store.getLegalEntities(clientId).map(le => ({
        id: le.id,
        client_id: le.clientId,
        legal_name: le.legalName,
        trade_name: null,
        registration_type: 'PRIVATE_LIMITED' as const,
        registration_number: le.registrationNumber || null,
        pan: le.pan || le.panNumber || 'DEMOPAN123',
        tan: null,
        gstin: le.gstin || null,
        pf_establishment_code: le.pfEstablishmentCode || null,
        esic_registration_code: le.esicRegistrationCode || null,
        registered_address: le.registeredAddress,
        payroll_responsibility: 'SELF_MANAGED' as const,
        is_primary: le.isPrimary ?? true,
        created_at: new Date().toISOString(),
      }));
      return successResponse(les);
    }

    try {
      const { data, error } = await supabase
        .from('client_legal_entities')
        .select('*')
        .eq('client_id', clientId)
        .order('is_primary', { ascending: false });

      if (error) {
        return errorResponse(handleSupabaseError(error, 'policyService.getLegalEntities'));
      }

      return successResponse(data || []);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.getLegalEntities'));
    }
  },

  /**
   * Retrieves authorized work locations with geofence radii for a client.
   */
  async getWorkLocations(clientId: string): Promise<ServiceResponse<WorkLocationRow[]>> {
    if (!clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }

    if (isMockMode()) {
      const locs = store.getLocations(clientId).map(loc => ({
        id: loc.id,
        client_id: loc.clientId,
        name: loc.name,
        code: loc.id,
        address: loc.address,
        state: 'Maharashtra',
        latitude: loc.latitude,
        longitude: loc.longitude,
        radius_meters: loc.radiusMeters || 150,
        active_headcount: loc.activeHeadcount || 0,
        created_at: new Date().toISOString(),
      }));
      return successResponse(locs);
    }

    try {
      const { data, error } = await supabase
        .from('work_locations')
        .select('*')
        .eq('client_id', clientId)
        .order('name');

      if (error) {
        return errorResponse(handleSupabaseError(error, 'policyService.getWorkLocations'));
      }

      return successResponse(data || []);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.getWorkLocations'));
    }
  },

  /**
   * Retrieves departments for a client organization.
   */
  async getDepartments(clientId: string): Promise<ServiceResponse<DepartmentRow[]>> {
    if (!clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }

    if (isMockMode()) {
      const depts = store.getDepartments(clientId).map(d => ({
        id: d.id,
        client_id: d.clientId,
        name: d.name,
        code: d.code,
        head_employee_id: null,
        created_at: new Date().toISOString(),
      }));
      return successResponse(depts);
    }

    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('client_id', clientId)
        .order('name');

      if (error) {
        return errorResponse(handleSupabaseError(error, 'policyService.getDepartments'));
      }

      return successResponse(data || []);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.getDepartments'));
    }
  },

  /**
   * Creates a single operational department for a client organization.
   */
  async createDepartment(departmentData: DepartmentInsert): Promise<ServiceResponse<DepartmentRow>> {
    if (!departmentData.client_id) {
      return errorResponse(createValidationError('Client ID is required.', 'client_id'));
    }
    if (!departmentData.name || departmentData.name.trim().length < 2) {
      return errorResponse(createValidationError('Department name must be at least 2 characters.', 'name'));
    }
    if (!departmentData.code || departmentData.code.trim().length < 1) {
      return errorResponse(createValidationError('Department code is required.', 'code'));
    }

    if (isMockMode()) {
      const created = store.addDepartment({
        clientId: departmentData.client_id,
        name: departmentData.name.trim(),
        code: departmentData.code.trim().toUpperCase(),
      });
      return successResponse({
        id: created.id,
        client_id: created.clientId,
        name: created.name,
        code: created.code,
        head_employee_id: null,
        created_at: new Date().toISOString(),
      });
    }

    try {
      const { data, error } = await supabase
        .from('departments')
        .insert({
          client_id: departmentData.client_id,
          name: departmentData.name.trim(),
          code: departmentData.code.trim().toUpperCase(),
          head_employee_id: departmentData.head_employee_id || null,
        })
        .select()
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'policyService.createDepartment'));
      }

      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.createDepartment'));
    }
  },

  /**
   * Creates multiple operational departments in batch for a client organization.
   */
  async createDepartmentsBatch(departments: DepartmentInsert[]): Promise<ServiceResponse<DepartmentRow[]>> {
    if (!departments || departments.length === 0) {
      return successResponse([]);
    }

    const clientId = departments[0]?.client_id;
    if (!clientId) {
      return errorResponse(createValidationError('Client ID is required for department batch creation.', 'client_id'));
    }

    if (isMockMode()) {
      const createdRows = departments.map(d => {
        const created = store.addDepartment({
          clientId: d.client_id,
          name: d.name.trim(),
          code: d.code.trim().toUpperCase(),
        });
        return {
          id: created.id,
          client_id: created.clientId,
          name: created.name,
          code: created.code,
          head_employee_id: null,
          created_at: new Date().toISOString(),
        };
      });
      return successResponse(createdRows);
    }

    try {
      const payload = departments.map(d => ({
        client_id: d.client_id,
        name: d.name.trim(),
        code: d.code.trim().toUpperCase(),
        head_employee_id: d.head_employee_id || null,
      }));

      const { data, error } = await supabase
        .from('departments')
        .upsert(payload, { onConflict: 'client_id,code' })
        .select();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'policyService.createDepartmentsBatch'));
      }

      return successResponse(data || []);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.createDepartmentsBatch'));
    }
  },

  /**
   * Deletes a department by ID.
   */
  async deleteDepartment(departmentId: string): Promise<ServiceResponse<boolean>> {
    if (!departmentId) {
      return errorResponse(createValidationError('Department ID is required.', 'departmentId'));
    }

    if (isMockMode()) {
      const removed = store.deleteDepartment(departmentId);
      return successResponse(removed);
    }

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', departmentId);

      if (error) {
        return errorResponse(handleSupabaseError(error, 'policyService.deleteDepartment'));
      }

      return successResponse(true);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.deleteDepartment'));
    }
  },

  /**
   * Retrieves the comprehensive operational, attendance, and leave policy for a client.
   */
  async getClientPolicy(clientId: string): Promise<ServiceResponse<ClientPolicyRow>> {
    if (!clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }

    if (isMockMode()) {
      const pol = store.getClientPolicy(clientId);
      const mockPolicy: ClientPolicyRow = {
        id: pol.id,
        client_id: pol.clientId,
        is_configured: pol.isConfigured,
        overtime_method: pol.overtimeMethod as ClientPolicyRow['overtime_method'],
        overtime_rate: pol.overtimeRate,
        late_grace_minutes: pol.lateGraceMinutes,
        late_penalty_rule: pol.latePenaltyRule as ClientPolicyRow['late_penalty_rule'],
        overnight_shift_attribution: pol.overnightShiftAttribution as ClientPolicyRow['overnight_shift_attribution'],
        standard_working_hours: pol.standardWorkingHours,
        half_day_hours: pol.halfDayHours,
        weekly_off_days: pol.weeklyOffDays,
        attendance_tracking_mode: pol.attendanceTrackingMode as ClientPolicyRow['attendance_tracking_mode'],
        require_gps: pol.requireGps,
        require_selfie: pol.requireSelfie,
        enforce_strict_geofence: pol.enforceStrictGeofence,
        leave_types_supported: pol.leaveTypesSupported,
        min_service_days_for_leave: pol.minServiceDaysForLeave,
        monthly_paid_leave_accrual: pol.monthlyPaidLeaveAccrual,
        max_carry_forward: pol.maxCarryForward,
        allow_leave_encashment: pol.allowLeaveEncashment,
        unpaid_leave_deduction_formula: pol.unpaidLeaveDeductionFormula,
        salary_divisor: pol.salaryDivisor as ClientPolicyRow['salary_divisor'],
        pf_enabled: pol.pfEnabled,
        pf_employee_percent: pol.pfEmployeePercent,
        pf_employer_percent: pol.pfEmployerPercent,
        esic_enabled: pol.esicEnabled,
        esic_employee_percent: pol.esicEmployeePercent,
        esic_employer_percent: pol.esicEmployerPercent,
        pt_enabled: pol.ptEnabled,
        tds_enabled: pol.tdsEnabled,
        updated_at: pol.updatedAt,
        updated_by: pol.updatedBy,
      };
      return successResponse(mockPolicy);
    }

    try {
      const { data, error } = await supabase
        .from('client_policies')
        .select('*')
        .eq('client_id', clientId)
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'policyService.getClientPolicy'));
      }

      if (!data) {
        return errorResponse(createNotFoundError('Client Policy', clientId));
      }

      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.getClientPolicy'));
    }
  },

  /**
   * Updates an operational policy for a client.
   */
  async updateClientPolicy(
    clientId: string,
    updates: ClientPolicyUpdate
  ): Promise<ServiceResponse<ClientPolicyRow>> {
    if (!clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }

    if (isMockMode()) {
      store.updateClientPolicy(clientId, updates as any);
      return this.getClientPolicy(clientId);
    }

    try {
      const { data, error } = await supabase
        .from('client_policies')
        .update(updates)
        .eq('client_id', clientId)
        .select()
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'policyService.updateClientPolicy'));
      }

      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.updateClientPolicy'));
    }
  },

  /**
   * Registers a new client organization.
   * Super Admin only per PostgreSQL Row Level Security.
   */
  async createClient(clientData: ClientInsert): Promise<ServiceResponse<ClientRow>> {
    if (!clientData.name || clientData.name.trim().length < 2) {
      return errorResponse(createValidationError('Client organization name must be at least 2 characters.', 'name'));
    }
    if (!clientData.code || !/^[A-Za-z0-9_-]{2,20}$/.test(clientData.code.trim())) {
      return errorResponse(createValidationError('Client code must be 2 to 20 alphanumeric characters (hyphens/underscores allowed).', 'code'));
    }
    const code = clientData.code.toUpperCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (clientData.contact_email && !emailRegex.test(clientData.contact_email)) {
      return errorResponse(createValidationError('Invalid contact email address format.', 'contact_email'));
    }

    if (isMockMode()) {
      const clients = store.getClients();
      if (clients.some(c => c.code.toUpperCase() === code)) {
        return errorResponse(createValidationError(`Duplicate client code '${code}'. Client code must be unique.`, 'code'));
      }
      const created = store.createClient({
        name: clientData.name.trim(),
        code,
        industry: clientData.industry || 'Enterprise Client',
        status: (clientData.status || 'onboarding') as any,
        contactPerson: clientData.contact_person || 'Operations Contact',
        contactEmail: clientData.contact_email || 'admin@client.com',
        contactPhone: clientData.contact_phone || '+91 99999 00000',
      });
      return successResponse<ClientRow>({
        id: created.id,
        name: created.name,
        code: created.code,
        industry: created.industry,
        status: created.status as ClientRow['status'],
        contact_person: created.contactPerson,
        contact_email: created.contactEmail,
        contact_phone: created.contactPhone,
        created_at: created.createdAt,
        updated_at: created.createdAt,
      });
    }

    try {
      // Check for uniqueness before insert
      const { data: existing } = await supabase
        .from('clients')
        .select('id')
        .eq('code', code)
        .maybeSingle();

      if (existing) {
        return errorResponse(createValidationError(`Duplicate client code '${code}'. A client with this identifier already exists.`, 'code'));
      }

      const { data, error } = await supabase
        .from('clients')
        .insert({
          ...clientData,
          code,
          status: clientData.status || 'onboarding',
          industry: clientData.industry || 'Enterprise Client',
        })
        .select()
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'policyService.createClient'));
      }

      // Initialize unconfigured client policy row for the newly created client
      await supabase.from('client_policies').insert({
        client_id: data.id,
        is_configured: false,
        overtime_method: 'disabled',
        salary_divisor: '30',
      }).select().maybeSingle();

      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.createClient'));
    }
  },

  /**
   * Updates an existing client organization.
   */
  async updateClient(clientId: string, updates: ClientUpdate): Promise<ServiceResponse<ClientRow>> {
    if (!clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }
    if (updates.code && !/^[A-Za-z0-9_-]{2,20}$/.test(updates.code.trim())) {
      return errorResponse(createValidationError('Client code must be 2 to 20 alphanumeric characters.', 'code'));
    }
    if (updates.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.contact_email)) {
      return errorResponse(createValidationError('Invalid contact email address format.', 'contact_email'));
    }

    if (isMockMode()) {
      const client = store.getClient(clientId);
      if (!client) {
        return errorResponse(createNotFoundError('Client', clientId));
      }
      const clientUpdates: any = {};
      if (updates.name) clientUpdates.name = updates.name;
      if (updates.code) clientUpdates.code = updates.code.toUpperCase().trim();
      if (updates.industry) clientUpdates.industry = updates.industry;
      if (updates.status) clientUpdates.status = updates.status;
      if (updates.contact_person) clientUpdates.contactPerson = updates.contact_person;
      if (updates.contact_email) clientUpdates.contactEmail = updates.contact_email;
      if (updates.contact_phone) clientUpdates.contactPhone = updates.contact_phone;
      if ((updates as any).address) clientUpdates.address = (updates as any).address;
      
      store.updateClient(clientId, clientUpdates);
      return this.getClient(clientId);
    }

    try {
      const sanitizedUpdates = { ...updates };
      if (sanitizedUpdates.code) {
        sanitizedUpdates.code = sanitizedUpdates.code.toUpperCase().trim();
      }
      const { data, error } = await supabase
        .from('clients')
        .update(sanitizedUpdates)
        .eq('id', clientId)
        .select()
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'policyService.updateClient'));
      }
      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.updateClient'));
    }
  },

  /**
   * Registers a legal entity under a client.
   */
  async createLegalEntity(entityData: LegalEntityInsert): Promise<ServiceResponse<LegalEntityRow>> {
    if (!entityData.client_id) {
      return errorResponse(createValidationError('Client ID is required.', 'client_id'));
    }
    if (!entityData.legal_name || entityData.legal_name.trim().length < 2) {
      return errorResponse(createValidationError('Corporate legal name is required.', 'legal_name'));
    }
    if (entityData.pan && entityData.pan.trim().length !== 10) {
      return errorResponse(createValidationError('PAN must be exactly 10 alphanumeric characters.', 'pan'));
    }

    if (isMockMode()) {
      const pan = (entityData.pan || 'DEMOPAN123').toUpperCase();
      const created = store.addLegalEntity({
        clientId: entityData.client_id,
        legalName: entityData.legal_name,
        tradeName: entityData.trade_name || undefined,
        registrationNumber: entityData.registration_number || `REG-${Date.now().toString(36)}`,
        pan,
        panNumber: pan,
        gstin: entityData.gstin || undefined,
        pfEstablishmentCode: entityData.pf_establishment_code || undefined,
        esicRegistrationCode: entityData.esic_registration_code || undefined,
        registeredAddress: entityData.registered_address || 'Corporate Registered Office',
        isPrimary: entityData.is_primary ?? true,
      });
      return successResponse<LegalEntityRow>({
        id: created.id,
        client_id: created.clientId,
        legal_name: created.legalName,
        trade_name: created.tradeName || null,
        registration_type: (entityData.registration_type || 'PRIVATE_LIMITED') as any,
        registration_number: created.registrationNumber || null,
        pan: created.pan || pan,
        tan: entityData.tan || null,
        gstin: created.gstin || null,
        pf_establishment_code: created.pfEstablishmentCode || null,
        esic_registration_code: created.esicRegistrationCode || null,
        registered_address: created.registeredAddress,
        payroll_responsibility: (entityData.payroll_responsibility || 'SELF_MANAGED') as any,
        is_primary: created.isPrimary ?? false,
        created_at: new Date().toISOString(),
      });
    }

    try {
      const { data, error } = await supabase
        .from('client_legal_entities')
        .insert({
          ...entityData,
          pan: (entityData.pan || 'DEMOPAN123').toUpperCase(),
          registration_type: entityData.registration_type || 'PRIVATE_LIMITED',
          registered_address: entityData.registered_address || 'Corporate Registered Office',
        })
        .select()
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'policyService.createLegalEntity'));
      }
      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.createLegalEntity'));
    }
  },

  /**
   * Registers a work location with GPS geofence for a client.
   */
  async createWorkLocation(locationData: WorkLocationInsert): Promise<ServiceResponse<WorkLocationRow>> {
    if (!locationData.client_id) {
      return errorResponse(createValidationError('Client ID is required.', 'client_id'));
    }
    if (!locationData.name || locationData.name.trim().length < 2) {
      return errorResponse(createValidationError('Work location name is required.', 'name'));
    }
    if (!locationData.address || locationData.address.trim().length < 3) {
      return errorResponse(createValidationError('Work location address is required.', 'address'));
    }
    const lat = Number(locationData.latitude);
    const lng = Number(locationData.longitude);
    if (isNaN(lat) || lat < -90 || lat > 90) {
      return errorResponse(createValidationError('Latitude must be a valid number between -90 and 90.', 'latitude'));
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return errorResponse(createValidationError('Longitude must be a valid number between -180 and 180.', 'longitude'));
    }
    const radius = locationData.radius_meters ? Number(locationData.radius_meters) : 150;
    if (radius < 20 || radius > 5000) {
      return errorResponse(createValidationError('Geofence radius must be between 20 and 5000 meters.', 'radius_meters'));
    }

    if (isMockMode()) {
      const created = store.addLocation({
        clientId: locationData.client_id,
        name: locationData.name,
        address: locationData.address,
        latitude: lat,
        longitude: lng,
        radiusMeters: radius,
      });
      return successResponse<WorkLocationRow>({
        id: created.id,
        client_id: created.clientId,
        name: created.name,
        code: created.id,
        address: created.address,
        state: locationData.state || 'Maharashtra',
        latitude: created.latitude,
        longitude: created.longitude,
        radius_meters: created.radiusMeters || 150,
        active_headcount: 0,
        created_at: new Date().toISOString(),
      });
    }

    try {
      const { data, error } = await supabase
        .from('work_locations')
        .insert({
          ...locationData,
          latitude: lat,
          longitude: lng,
          radius_meters: radius,
          state: locationData.state || 'Maharashtra',
        })
        .select()
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'policyService.createWorkLocation'));
      }
      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.createWorkLocation'));
    }
  },

  /**
   * Updates an existing work location and its GPS geofence parameters.
   */
  async updateWorkLocation(
    locationId: string,
    updates: Partial<WorkLocationInsert>
  ): Promise<ServiceResponse<WorkLocationRow>> {
    if (!locationId) {
      return errorResponse(createValidationError('Work location ID is required.', 'locationId'));
    }

    const sanitizedUpdates: any = { ...updates };
    if (updates.latitude !== undefined) {
      const lat = Number(updates.latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return errorResponse(createValidationError('Latitude must be a valid number between -90 and 90.', 'latitude'));
      }
      sanitizedUpdates.latitude = lat;
    }
    if (updates.longitude !== undefined) {
      const lng = Number(updates.longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return errorResponse(createValidationError('Longitude must be a valid number between -180 and 180.', 'longitude'));
      }
      sanitizedUpdates.longitude = lng;
    }
    if (updates.radius_meters !== undefined) {
      const radius = Number(updates.radius_meters);
      if (radius < 20 || radius > 5000) {
        return errorResponse(createValidationError('Geofence radius must be between 20 and 5000 meters.', 'radius_meters'));
      }
      sanitizedUpdates.radius_meters = radius;
    }

    if (isMockMode()) {
      const storeUpdates: any = {};
      if (sanitizedUpdates.name) storeUpdates.name = sanitizedUpdates.name;
      if (sanitizedUpdates.address) storeUpdates.address = sanitizedUpdates.address;
      if (sanitizedUpdates.state) storeUpdates.state = sanitizedUpdates.state;
      if (sanitizedUpdates.latitude !== undefined) storeUpdates.latitude = sanitizedUpdates.latitude;
      if (sanitizedUpdates.longitude !== undefined) storeUpdates.longitude = sanitizedUpdates.longitude;
      if (sanitizedUpdates.radius_meters !== undefined) storeUpdates.radiusMeters = sanitizedUpdates.radius_meters;

      const updated = store.updateLocation(locationId, storeUpdates);
      if (!updated) {
        return errorResponse(createNotFoundError('WorkLocation', locationId));
      }

      return successResponse<WorkLocationRow>({
        id: updated.id,
        client_id: updated.clientId,
        name: updated.name,
        code: updated.id,
        address: updated.address,
        state: updated.state || 'Maharashtra',
        latitude: updated.latitude,
        longitude: updated.longitude,
        radius_meters: updated.radiusMeters,
        active_headcount: updated.activeHeadcount,
        created_at: new Date().toISOString(),
      });
    }

    try {
      const { data, error } = await supabase
        .from('work_locations')
        .update(sanitizedUpdates)
        .eq('id', locationId)
        .select()
        .single();

      if (error) {
        return errorResponse(handleSupabaseError(error, 'policyService.updateWorkLocation'));
      }
      return successResponse(data);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.updateWorkLocation'));
    }
  },

  /**
   * Deletes a work location.
   */
  async deleteWorkLocation(locationId: string): Promise<ServiceResponse<boolean>> {
    if (!locationId) {
      return errorResponse(createValidationError('Work location ID is required.', 'locationId'));
    }

    if (isMockMode()) {
      const deleted = store.deleteLocation(locationId);
      if (!deleted) {
        return errorResponse(createNotFoundError('WorkLocation', locationId));
      }
      return successResponse(true);
    }

    try {
      const { error } = await supabase
        .from('work_locations')
        .delete()
        .eq('id', locationId);

      if (error) {
        return errorResponse(handleSupabaseError(error, 'policyService.deleteWorkLocation'));
      }
      return successResponse(true);
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.deleteWorkLocation'));
    }
  },

  /**
   * Retrieves summary card metadata (entity count, location count, headcount, policy health, primary entity)
   * for a specific client organization.
   */
  async getClientCardSummary(clientId: string): Promise<ServiceResponse<ClientCardSummary>> {
    if (!clientId) {
      return errorResponse(createValidationError('Client ID is required.', 'clientId'));
    }

    const clientRes = await this.getClient(clientId);
    if (!clientRes.success || !clientRes.data) {
      return errorResponse(clientRes.error || createNotFoundError('Client', clientId));
    }

    if (isMockMode()) {
      const les = store.getLegalEntities(clientId);
      const locs = store.getLocations(clientId);
      const emps = store.getEmployees(clientId);
      const pol = store.getClientPolicy(clientId);

      return successResponse<ClientCardSummary>({
        client: clientRes.data,
        legalEntitiesCount: les.length,
        locationsCount: locs.length,
        employeeCount: emps.length,
        isPolicyConfigured: pol?.isConfigured ?? false,
        primaryLegalEntityName: les.find(le => le.isPrimary)?.legalName || les[0]?.legalName || 'Pending Setup',
      });
    }

    try {
      const [lesRes, locsRes, polRes, empsRes] = await Promise.all([
        this.getLegalEntities(clientId),
        this.getWorkLocations(clientId),
        this.getClientPolicy(clientId),
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('client_id', clientId),
      ]);

      const legalEntities = lesRes.success && lesRes.data ? lesRes.data : [];
      const locations = locsRes.success && locsRes.data ? locsRes.data : [];
      const isConfigured = polRes.success && polRes.data ? polRes.data.is_configured : false;
      const primaryLE = legalEntities.find(le => le.is_primary) || legalEntities[0];
      const employeeCount = typeof empsRes.count === 'number' ? empsRes.count : 0;

      return successResponse<ClientCardSummary>({
        client: clientRes.data,
        legalEntitiesCount: legalEntities.length,
        locationsCount: locations.length,
        employeeCount,
        isPolicyConfigured: isConfigured,
        primaryLegalEntityName: primaryLE?.legal_name || 'Pending Setup',
      });
    } catch (err) {
      return errorResponse(handleSupabaseError(err, 'policyService.getClientCardSummary'));
    }
  },
};
