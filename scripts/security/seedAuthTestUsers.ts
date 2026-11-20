/**
 * Avencis Workforce Management (WFM)
 * Milestone 2.5B — Test User Provisioning Script
 *
 * PROPOSED TEST IDENTITY PROVISIONING ENGINE
 * -------------------------------------------------------------
 * STATUS: PREPARED FOR REVIEW ONLY — DO NOT EXECUTE WITHOUT APPROVAL
 *
 * This script defines the 10 deterministic test personas across all 7 WFM roles
 * and two distinct client tenants. It uses the Supabase Auth Admin API
 * (supabase.auth.admin.createUser) to provision accounts and link them to user_profiles.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Environment loader for standalone execution
function getEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [k, ...v] = trimmed.split('=');
          if (k.trim() === key) {
            return v.join('=').trim().replace(/^["']|["']$/g, '');
          }
        }
      }
    }
  } catch {}
  return undefined;
}

export interface ProposedTestPersona {
  personaId: string;
  email: string;
  fullName: string;
  role: 'super_admin' | 'client_admin' | 'hr_admin' | 'payroll_admin' | 'client_manager' | 'location_manager' | 'employee';
  clientId: string | null;
  clientCode: string | null;
  employeeId: string | null;
  employeeCode: string | null;
  workLocationId: string | null;
  isUnprovisioned?: boolean;
  purpose: string;
}

/**
 * Authoritative 10-Persona Test Matrix for Milestone 2.5B
 */
export const PROPOSED_TEST_PERSONAS: ProposedTestPersona[] = [
  // 1. Super Admin (Global Governance)
  {
    personaId: 'persona-super-admin',
    email: 'test.superadmin@avencis-wfm.test',
    fullName: 'Global Platform Administrator',
    role: 'super_admin',
    clientId: null,
    clientCode: null,
    employeeId: null,
    employeeCode: null,
    workLocationId: null,
    purpose: 'Validate cross-tenant global oversight, policy administration, and full catalog governance.',
  },

  // 2. Client Admin (Tenant 1: Suman Technologies)
  {
    personaId: 'persona-client-admin-suman',
    email: 'test.clientadmin@suman-demo.test',
    fullName: 'Prakash Singhania (Client Admin)',
    role: 'client_admin',
    clientId: '10000000-0000-0000-0000-000000000001',
    clientCode: 'DEMO-SUMAN',
    employeeId: null,
    employeeCode: null,
    workLocationId: null,
    purpose: 'Validate Tenant A administration, executive lock sign-off, and cross-tenant mutation denial.',
  },

  // 3. HR Admin (Tenant 1: Suman Technologies)
  {
    personaId: 'persona-hr-admin-suman',
    email: 'test.hradmin@suman-demo.test',
    fullName: 'Ananya Deshmukh (HR Admin)',
    role: 'hr_admin',
    clientId: '10000000-0000-0000-0000-000000000001',
    clientCode: 'DEMO-SUMAN',
    employeeId: null,
    employeeCode: null,
    workLocationId: null,
    purpose: 'Validate employee onboarding, leave review, and confidential salary structure access denial.',
  },

  // 4. Payroll Admin (Tenant 1: Suman Technologies)
  {
    personaId: 'persona-payroll-admin-suman',
    email: 'test.payrolladmin@suman-demo.test',
    fullName: 'Rajiv Mathur (Payroll Specialist)',
    role: 'payroll_admin',
    clientId: '10000000-0000-0000-0000-000000000001',
    clientCode: 'DEMO-SUMAN',
    employeeId: null,
    employeeCode: null,
    workLocationId: null,
    purpose: 'Validate payroll batch calculation, overtime overrides, and Segregation of Duties locking denial.',
  },

  // 5. Client Manager (Tenant 1: Suman Technologies)
  {
    personaId: 'persona-manager-suman',
    email: 'test.manager@suman-demo.test',
    fullName: 'Pooja Patel (Manager & Peer)',
    role: 'client_manager',
    clientId: '10000000-0000-0000-0000-000000000001',
    clientCode: 'DEMO-SUMAN',
    employeeId: '60000000-0000-0000-0000-000000000002',
    employeeCode: 'DEMO-ST-0102',
    workLocationId: '30000000-0000-0000-0000-000000000001',
    purpose: 'Validate general attendance/leave approvals and Anti-Self-Approval governance rule rejection.',
  },

  // 6. Location Manager (Tenant 1: Suman Technologies — Pune Tech Park)
  {
    personaId: 'persona-locmanager-pune',
    email: 'test.locmanager.pune@suman-demo.test',
    fullName: 'Vikram Rao (Pune Site Manager)',
    role: 'location_manager',
    clientId: '10000000-0000-0000-0000-000000000001',
    clientCode: 'DEMO-SUMAN',
    employeeId: '60000000-0000-0000-0000-000000000005',
    employeeCode: 'DEMO-ST-0105',
    workLocationId: '30000000-0000-0000-0000-000000000002',
    purpose: 'Validate worksite geofence scoping (Pune Hub staff visible; Mumbai Hub staff hidden).',
  },

  // 7. Employee 1 (Tenant 1: Suman Technologies — Pune Tech Park)
  {
    personaId: 'persona-emp-rahul',
    email: 'test.rahul.sharma@suman-demo.test',
    fullName: 'Rahul Sharma (Employee 1)',
    role: 'employee',
    clientId: '10000000-0000-0000-0000-000000000001',
    clientCode: 'DEMO-SUMAN',
    employeeId: '60000000-0000-0000-0000-000000000001',
    employeeCode: 'DEMO-ST-0101',
    workLocationId: '30000000-0000-0000-0000-000000000001',
    purpose: 'Validate self-service mobile punch, self leave requests, self payslips, and horizontal peer denial.',
  },

  // 8. Employee 2 (Tenant 1: Suman Technologies — Peer Target)
  {
    personaId: 'persona-emp-sneha',
    email: 'test.sneha.joshi@suman-demo.test',
    fullName: 'Sneha Joshi (Employee 2)',
    role: 'employee',
    clientId: '10000000-0000-0000-0000-000000000001',
    clientCode: 'DEMO-SUMAN',
    employeeId: '60000000-0000-0000-0000-000000000004',
    employeeCode: 'DEMO-ST-0104',
    workLocationId: '30000000-0000-0000-0000-000000000001',
    purpose: 'Target for horizontal isolation tests (verifying Rahul cannot view Sneha payslips/punches).',
  },

  // 9. Client Admin (Tenant 2: Maha India Logistics & Fleet)
  {
    personaId: 'persona-client-admin-maha',
    email: 'test.clientadmin@mahaindia-demo.test',
    fullName: 'Devendra Kulkarni (Maha Fleet Admin)',
    role: 'client_admin',
    clientId: '10000000-0000-0000-0000-000000000002',
    clientCode: 'DEMO-MAHA',
    employeeId: null,
    employeeCode: null,
    workLocationId: null,
    purpose: 'Validate cross-tenant SELECT, UPDATE, and DELETE denial against Suman Technologies.',
  },

  // 10. Unprovisioned Account (External Authenticated Identity)
  {
    personaId: 'persona-unprovisioned',
    email: 'test.unprovisioned@external-domain.test',
    fullName: 'External Rogue User',
    role: 'employee', // Ignored because no user_profiles record is inserted
    clientId: null,
    clientCode: null,
    employeeId: null,
    employeeCode: null,
    workLocationId: null,
    isUnprovisioned: true,
    purpose: 'Validate Fail-Closed security: authenticated JWT receives role=NULL and 0 rows across all tables.',
  },
];

/**
 * Provisioning Execution Harness (Dry-Run / Ready for Owner Approval)
 */
export async function provisionTestPersonas(options: { dryRun?: boolean; defaultPassword?: string } = {}) {
  const isDryRun = options.dryRun ?? true;
  const password = options.defaultPassword || process.env.TEST_PERSONA_PASSWORD;

  console.log('========================================================================');
  console.log('AVENCIS WFM — TEST PERSONA PROVISIONING ENGINE');
  console.log(`MODE: ${isDryRun ? 'DRY-RUN INSPECTION (Zero DB Writes)' : 'LIVE EXECUTION'}`);
  console.log('========================================================================\n');

  if (isDryRun) {
    console.log('[Notice] Dry-run mode active. Presenting proposed test accounts:');
    PROPOSED_TEST_PERSONAS.forEach((p, idx) => {
      console.log(`  [${idx + 1}] ${p.role.toUpperCase()} | ${p.email}`);
      console.log(`      Client: ${p.clientCode || 'GLOBAL'} | Employee: ${p.employeeCode || 'None'}`);
      console.log(`      Purpose: ${p.purpose}\n`);
    });
    console.log('[Notice] Account creation is paused awaiting explicit project owner authorization.');
    return;
  }

  // Execution boundary: requires service-role key injected via process.env
  const supabaseUrl = getEnv('VITE_SUPABASE_URL');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase URL or Service Role Key missing. Cannot provision test users.');
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const persona of PROPOSED_TEST_PERSONAS) {
    console.log(`[Provisioning] Creating user ${persona.email}...`);
    
    // 1. Create Supabase Auth User
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: persona.email,
      password: password || 'AvencisTest@2026!',
      email_confirm: true,
      user_metadata: { full_name: persona.fullName },
    });

    if (authError) {
      console.error(`  ❌ Failed to create Auth user ${persona.email}:`, authError.message);
      continue;
    }

    console.log(`  ✓ Auth user created: ${authUser.user.id}`);

    // If persona is designated unprovisioned, skip user_profiles row
    if (persona.isUnprovisioned) {
      console.log(`  ✓ Unprovisioned persona: Intentionally omitting user_profiles record.`);
      continue;
    }

    // 2. Insert Profile in public.user_profiles
    const { error: profileError } = await adminClient.from('user_profiles').upsert({
      id: authUser.user.id,
      email: persona.email,
      full_name: persona.fullName,
      role: persona.role,
      client_id: persona.clientId,
      employee_id: persona.employeeId,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      console.error(`  ❌ Failed to create user_profile for ${persona.email}:`, profileError.message);
    } else {
      console.log(`  ✓ Profile linked: role=${persona.role}, client=${persona.clientCode}`);
    }
  }

  console.log('\n[Provisioning Complete] All test accounts seeded.');
}

if (process.argv.includes('--execute')) {
  console.warn('Execution blocked: Manual owner approval required before running with --execute.');
} else {
  provisionTestPersonas({ dryRun: true });
}
