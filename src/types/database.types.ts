/**
 * Avencis Workforce Management (WFM)
 * Database Schema TypeScript Type Definitions
 * Matches PostgreSQL Schema in supabase/migrations/
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          code: string;
          name: string;
          industry: string;
          status: 'onboarding' | 'active' | 'suspended';
          contact_person: string;
          contact_email: string;
          contact_phone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          industry: string;
          status?: 'onboarding' | 'active' | 'suspended';
          contact_person: string;
          contact_email: string;
          contact_phone: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['clients']['Insert']>;
        Relationships: [];
      };
      client_legal_entities: {
        Row: {
          id: string;
          client_id: string;
          legal_name: string;
          trade_name: string | null;
          registration_type: 'PRIVATE_LIMITED' | 'PUBLIC_LIMITED' | 'LLP' | 'PROPRIETORSHIP';
          registration_number: string | null;
          pan: string;
          tan: string | null;
          gstin: string | null;
          pf_establishment_code: string | null;
          esic_registration_code: string | null;
          registered_address: string;
          payroll_responsibility: 'SELF_MANAGED' | 'AVENCIS_MANAGED' | 'HYBRID';
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          legal_name: string;
          trade_name?: string | null;
          registration_type: 'PRIVATE_LIMITED' | 'PUBLIC_LIMITED' | 'LLP' | 'PROPRIETORSHIP';
          registration_number?: string | null;
          pan: string;
          tan?: string | null;
          gstin?: string | null;
          pf_establishment_code?: string | null;
          esic_registration_code?: string | null;
          registered_address: string;
          payroll_responsibility?: 'SELF_MANAGED' | 'AVENCIS_MANAGED' | 'HYBRID';
          is_primary?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['client_legal_entities']['Insert']>;
        Relationships: [];
      };
      work_locations: {
        Row: {
          id: string;
          client_id: string;
          name: string;
          code: string | null;
          address: string;
          state: string;
          latitude: number;
          longitude: number;
          radius_meters: number;
          active_headcount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          name: string;
          code?: string | null;
          address: string;
          state: string;
          latitude: number;
          longitude: number;
          radius_meters?: number;
          active_headcount?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['work_locations']['Insert']>;
        Relationships: [];
      };
      departments: {
        Row: {
          id: string;
          client_id: string;
          name: string;
          code: string;
          head_employee_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          name: string;
          code: string;
          head_employee_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['departments']['Insert']>;
        Relationships: [];
      };
      user_profiles: {
        Row: {
          id: string; // references auth.users.id
          email: string;
          full_name: string;
          role: 'super_admin' | 'hr_admin' | 'payroll_admin' | 'client_admin' | 'client_manager' | 'location_manager' | 'employee';
          client_id: string | null;
          employee_id: string | null;
          is_active: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          role?: 'super_admin' | 'hr_admin' | 'payroll_admin' | 'client_admin' | 'client_manager' | 'location_manager' | 'employee';
          client_id?: string | null;
          employee_id?: string | null;
          is_active?: boolean;
          last_login_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>;
        Relationships: [];
      };
      user_work_locations: {
        Row: {
          id: string;
          user_id: string;
          work_location_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          work_location_id: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['user_work_locations']['Insert']>;
        Relationships: [];
      };
      client_policies: {
        Row: {
          id: string;
          client_id: string;
          is_configured: boolean;
          overtime_method: 'disabled' | 'multiplier' | 'flat_rate' | 'comp_off';
          overtime_rate: number;
          late_grace_minutes: number;
          late_penalty_rule: 'none' | 'deduct_half_day_per_3' | 'deduct_cl';
          overnight_shift_attribution: 'shift_start_date' | 'shift_end_date';
          standard_working_hours: number;
          half_day_hours: number;
          weekly_off_days: string[];
          attendance_tracking_mode: 'double_punch' | 'single_punch';
          require_gps: boolean;
          require_selfie: boolean;
          enforce_strict_geofence: boolean;
          leave_types_supported: string[];
          min_service_days_for_leave: number;
          monthly_paid_leave_accrual: number;
          max_carry_forward: number;
          allow_leave_encashment: boolean;
          unpaid_leave_deduction_formula: string;
          salary_divisor: '26' | '30' | 'calendar_days';
          pf_enabled: boolean;
          pf_employee_percent: number;
          pf_employer_percent: number;
          esic_enabled: boolean;
          esic_employee_percent: number;
          esic_employer_percent: number;
          pt_enabled: boolean;
          tds_enabled: boolean;
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          is_configured?: boolean;
          overtime_method?: 'disabled' | 'multiplier' | 'flat_rate' | 'comp_off';
          overtime_rate?: number;
          late_grace_minutes?: number;
          late_penalty_rule?: 'none' | 'deduct_half_day_per_3' | 'deduct_cl';
          overnight_shift_attribution?: 'shift_start_date' | 'shift_end_date';
          standard_working_hours?: number;
          half_day_hours?: number;
          weekly_off_days?: string[];
          attendance_tracking_mode?: 'double_punch' | 'single_punch';
          require_gps?: boolean;
          require_selfie?: boolean;
          enforce_strict_geofence?: boolean;
          leave_types_supported?: string[];
          min_service_days_for_leave?: number;
          monthly_paid_leave_accrual?: number;
          max_carry_forward?: number;
          allow_leave_encashment?: boolean;
          unpaid_leave_deduction_formula?: string;
          salary_divisor?: '26' | '30' | 'calendar_days';
          pf_enabled?: boolean;
          pf_employee_percent?: number;
          pf_employer_percent?: number;
          esic_enabled?: boolean;
          esic_employee_percent?: number;
          esic_employer_percent?: number;
          pt_enabled?: boolean;
          tds_enabled?: boolean;
          updated_at?: string;
          updated_by?: string;
        };
        Update: Partial<Database['public']['Tables']['client_policies']['Insert']>;
        Relationships: [];
      };
      employees: {
        Row: {
          id: string;
          client_id: string;
          legal_entity_id: string;
          work_location_id: string;
          department_id: string | null;
          employee_code: string;
          first_name: string;
          last_name: string;
          email: string;
          mobile: string;
          designation: string;
          joining_date: string;
          employment_arrangement: 'DIRECT_PERMANENT' | 'DIRECT_CONTRACT' | 'DEPUTED_STAFFING' | 'INTERN';
          status: 'ACTIVE' | 'ON_NOTICE' | 'SUSPENDED' | 'TERMINATED';
          pan_number: string;
          aadhaar_number: string;
          uan_number: string | null;
          esic_number: string | null;
          avatar_url: string | null;
          manager_id?: string | null;
          last_working_day?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          legal_entity_id: string;
          work_location_id: string;
          department_id?: string | null;
          employee_code: string;
          first_name: string;
          last_name: string;
          email: string;
          mobile: string;
          designation: string;
          joining_date: string;
          employment_arrangement?: 'DIRECT_PERMANENT' | 'DIRECT_CONTRACT' | 'DEPUTED_STAFFING' | 'INTERN';
          status?: 'ACTIVE' | 'ON_NOTICE' | 'SUSPENDED' | 'TERMINATED';
          pan_number: string;
          aadhaar_number: string;
          uan_number?: string | null;
          esic_number?: string | null;
          avatar_url?: string | null;
          manager_id?: string | null;
          last_working_day?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['employees']['Insert']>;
        Relationships: [];
      };
      employee_salary_structures: {
        Row: {
          id: string;
          employee_id: string;
          client_id: string;
          fixed_monthly_base: number;
          hra: number;
          conveyance: number;
          special_allowances: number;
          variable_incentives: number;
          effective_from: string;
          effective_to: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          client_id: string;
          fixed_monthly_base: number;
          hra?: number;
          conveyance?: number;
          special_allowances?: number;
          variable_incentives?: number;
          effective_from: string;
          effective_to?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['employee_salary_structures']['Insert']>;
        Relationships: [];
      };
      employee_bank_details: {
        Row: {
          id: string;
          employee_id: string;
          client_id: string;
          bank_name: string;
          account_number: string;
          ifsc_code: string;
          account_type: 'SAVINGS' | 'CURRENT' | 'SALARY';
          is_verified: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          client_id: string;
          bank_name: string;
          account_number: string;
          ifsc_code: string;
          account_type?: 'SAVINGS' | 'CURRENT' | 'SALARY';
          is_verified?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['employee_bank_details']['Insert']>;
        Relationships: [];
      };
      attendance_events: {
        Row: {
          id: string;
          client_id: string;
          employee_id: string;
          event_type: 'CHECK_IN' | 'CHECK_OUT';
          timestamp: string;
          latitude: number;
          longitude: number;
          accuracy_meters: number | null;
          geofence_status: 'WITHIN_GEOFENCE' | 'OUT_OF_BOUNDS';
          ip_address: string;
          device_info: string;
          selfie_url: string | null;
          is_suspicious: boolean;
        };
        Insert: {
          id?: string;
          client_id: string;
          employee_id: string;
          event_type: 'CHECK_IN' | 'CHECK_OUT';
          timestamp?: string;
          latitude: number;
          longitude: number;
          accuracy_meters?: number | null;
          geofence_status?: 'WITHIN_GEOFENCE' | 'OUT_OF_BOUNDS';
          ip_address: string;
          device_info: string;
          selfie_url?: string | null;
          is_suspicious?: boolean;
        };
        Update: Partial<Database['public']['Tables']['attendance_events']['Insert']>;
        Relationships: [];
      };
      daily_attendance_records: {
        Row: {
          id: string;
          client_id: string;
          employee_id: string;
          date: string;
          check_in_time: string | null;
          check_out_time: string | null;
          total_hours: number;
          status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'ON_DUTY' | 'PAID_LEAVE' | 'UNPAID_LEAVE' | 'WEEKLY_OFF' | 'HOLIDAY';
          leave_request_id?: string | null;
          location_name: string | null;
          is_regularised: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          employee_id: string;
          date: string;
          check_in_time?: string | null;
          check_out_time?: string | null;
          total_hours?: number;
          status?: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'ON_DUTY' | 'PAID_LEAVE' | 'UNPAID_LEAVE' | 'WEEKLY_OFF' | 'HOLIDAY';
          leave_request_id?: string | null;
          location_name?: string | null;
          is_regularised?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['daily_attendance_records']['Insert']>;
        Relationships: [];
      };
      attendance_corrections: {
        Row: {
          id: string;
          client_id: string;
          employee_id: string;
          date: string;
          original_check_in: string | null;
          original_check_out: string | null;
          requested_check_in: string;
          requested_check_out: string;
          reason: string;
          manager_remarks: string | null;
          status: 'PENDING' | 'APPROVED' | 'REJECTED';
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          employee_id: string;
          date: string;
          original_check_in?: string | null;
          original_check_out?: string | null;
          requested_check_in: string;
          requested_check_out: string;
          reason: string;
          manager_remarks?: string | null;
          status?: 'PENDING' | 'APPROVED' | 'REJECTED';
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['attendance_corrections']['Insert']>;
        Relationships: [];
      };
      leave_balances: {
        Row: {
          id: string;
          client_id: string;
          employee_id: string;
          leave_type: 'PL' | 'CL' | 'SL' | 'COMP_OFF';
          year: number;
          opening: number;
          credited: number;
          used: number;
          closing: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          employee_id: string;
          leave_type: 'PL' | 'CL' | 'SL' | 'COMP_OFF';
          year: number;
          opening?: number;
          credited?: number;
          used?: number;
          closing?: number;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['leave_balances']['Insert']>;
        Relationships: [];
      };
      leave_requests: {
        Row: {
          id: string;
          client_id: string;
          employee_id: string;
          leave_type: 'PL' | 'CL' | 'SL' | 'LWP' | 'COMP_OFF';
          start_date: string;
          end_date: string;
          total_days: number;
          reason: string;
          manager_remarks: string | null;
          status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          employee_id: string;
          leave_type: 'PL' | 'CL' | 'SL' | 'LWP' | 'COMP_OFF';
          start_date: string;
          end_date: string;
          total_days: number;
          reason: string;
          manager_remarks?: string | null;
          status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['leave_requests']['Insert']>;
        Relationships: [];
      };
      payroll_runs: {
        Row: {
          id: string;
          client_id: string;
          legal_entity_id: string | null;
          period_month: number;
          period_year: number;
          total_employees: number;
          total_gross: number;
          total_deductions: number;
          total_net: number;
          status: 'draft' | 'under_review' | 'approved' | 'locked';
          processed_at: string;
          approved_at: string | null;
          approved_by: string | null;
          locked_at: string | null;
          locked_by: string | null;
          policy_snapshot: Json | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          legal_entity_id?: string | null;
          period_month: number;
          period_year: number;
          total_employees?: number;
          total_gross?: number;
          total_deductions?: number;
          total_net?: number;
          status?: 'draft' | 'under_review' | 'approved' | 'locked';
          processed_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          policy_snapshot?: Json | null;
        };
        Update: Partial<Database['public']['Tables']['payroll_runs']['Insert']>;
        Relationships: [];
      };
      payroll_items: {
        Row: {
          id: string;
          run_id: string;
          client_id: string;
          employee_id: string;
          fixed_salary: number;
          incentives: number;
          other_allowances: number;
          calendar_days: number;
          paid_days: number;
          unpaid_days: number;
          gross_earned: number;
          unpaid_deduction: number;
          pf_deduction: number;
          esic_deduction: number;
          pt_deduction: number;
          tds_deduction: number;
          total_deductions: number;
          net_salary: number;
        };
        Insert: {
          id?: string;
          run_id: string;
          client_id: string;
          employee_id: string;
          fixed_salary: number;
          incentives?: number;
          other_allowances?: number;
          calendar_days?: number;
          paid_days?: number;
          unpaid_days?: number;
          gross_earned?: number;
          unpaid_deduction?: number;
          pf_deduction?: number;
          esic_deduction?: number;
          pt_deduction?: number;
          tds_deduction?: number;
          total_deductions?: number;
          net_salary?: number;
        };
        Update: Partial<Database['public']['Tables']['payroll_items']['Insert']>;
        Relationships: [];
      };
      payslips: {
        Row: {
          id: string;
          client_id: string;
          payroll_item_id: string;
          employee_id: string;
          period_month: number;
          period_year: number;
          revision_number: number;
          storage_pdf_url: string | null;
          generated_at: string;
          is_published: boolean;
        };
        Insert: {
          id?: string;
          client_id: string;
          payroll_item_id: string;
          employee_id: string;
          period_month: number;
          period_year: number;
          revision_number?: number;
          storage_pdf_url?: string | null;
          generated_at?: string;
          is_published?: boolean;
        };
        Update: Partial<Database['public']['Tables']['payslips']['Insert']>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          client_id: string | null;
          actor_name: string;
          actor_email: string;
          actor_role: string;
          action: string;
          target_entity: string;
          target_id: string;
          details: string;
          ip_address: string;
          timestamp: string;
          severity: 'info' | 'warning' | 'critical';
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          actor_name: string;
          actor_email: string;
          actor_role: string;
          action: string;
          target_entity: string;
          target_id: string;
          details: string;
          ip_address: string;
          timestamp?: string;
          severity?: 'info' | 'warning' | 'critical';
        };
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
        Relationships: [];
      };
      statutory_pt_slabs: {
        Row: {
          id: string;
          state: string;
          gender: 'ALL' | 'MALE' | 'FEMALE';
          monthly_gross_min: number;
          monthly_gross_max: number | null;
          tax_amount: number;
          february_tax_amount: number | null;
          effective_from: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          state: string;
          gender: 'ALL' | 'MALE' | 'FEMALE';
          monthly_gross_min: number;
          monthly_gross_max?: number | null;
          tax_amount: number;
          february_tax_amount?: number | null;
          effective_from: string;
          is_active?: boolean;
        };
        Update: Partial<Database['public']['Tables']['statutory_pt_slabs']['Insert']>;
        Relationships: [];
      };
      statutory_holidays: {
        Row: {
          id: string;
          client_id: string | null;
          work_location_id: string | null;
          name: string;
          date: string;
          year: number;
          is_mandatory: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          work_location_id?: string | null;
          name: string;
          date: string;
          year: number;
          is_mandatory?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['statutory_holidays']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
