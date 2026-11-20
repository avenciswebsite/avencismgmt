/**
 * Avencis Workforce Management (WFM)
 * Milestone 2.4A — Client Management Module Integration Test Suite
 *
 * Verifies all required functional, security, and data integrity aspects:
 * 1. Client directory initial loading (mock & Supabase live modes)
 * 2. Search and status filtering logic
 * 3. Opening client overview and context hydration
 * 4. Switching between authorized workspaces
 * 5. Legal entity loading
 * 6. Work location and geofence loading
 * 7. Department loading
 * 8. Operational policy loading
 * 9. Client card summary composite metadata
 * 10. Create client validation (mandatory fields, code format)
 * 11. Duplicate client code collision guard
 * 12. Create client execution lifecycle
 * 13. Update client operations
 * 14. Create legal entity validation (PAN 10-char format)
 * 15. Create work location validation (GPS boundary & radius)
 * 16. Network failure categorization (HTTP 503)
 * 17. Empty state handling
 * 18. Cross-tenant access isolation & tenant scoping
 * 19. Live Supabase PostgREST connectivity & RLS boundary
 * 20. Live Supabase non-existent record error mapping (NOT_FOUND)
 */

import { policyService } from '../src/services/policyService';
import { 
  setDevDataSourceMode, 
  isMockMode, 
  getDataSourceMode 
} from '../src/services/serviceConfig';
import { 
  handleSupabaseError, 
  createValidationError, 
  createNotFoundError, 
  formatErrorMessage 
} from '../src/services/serviceErrors';
import { supabase } from '../src/lib/supabase';
import { store } from '../src/data/store';

interface ScenarioResult {
  code: string;
  name: string;
  type: 'REAL_INTEGRATION' | 'ISOLATED_UNIT_TEST';
  passed: boolean;
  message: string;
  details?: unknown;
}

const results: ScenarioResult[] = [];

function recordTest(
  code: string,
  name: string,
  type: 'REAL_INTEGRATION' | 'ISOLATED_UNIT_TEST',
  condition: boolean,
  message: string,
  details?: unknown
) {
  results.push({
    code,
    name,
    type,
    passed: condition,
    message: condition ? `PASS: ${message}` : `FAIL: ${message}`,
    details,
  });

  const badge = type === 'REAL_INTEGRATION' ? '[REAL DB/AUTH]' : '[UNIT MOCK]';
  if (!condition) {
    console.error(`  ❌ [${code}] ${name} ${badge}: FAIL - ${message}`, details || '');
  } else {
    console.log(`  ✓ [${code}] ${name} ${badge}: ${message}`);
  }
}

async function runClientManagementTestSuite() {
  console.log('========================================================================');
  console.log('AVENCIS WFM — MILESTONE 2.4A CLIENT MANAGEMENT TEST SUITE');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // 1. Initial Client Directory Loading
  // -------------------------------------------------------------------------
  console.log('--- 1. Client Directory Loading ---');
  setDevDataSourceMode('mock');
  const dirRes = await policyService.getAccessibleClients();
  recordTest(
    'Test 01',
    'Client Directory Initial Loading',
    'ISOLATED_UNIT_TEST',
    dirRes.success && Array.isArray(dirRes.data) && dirRes.data.length >= 3,
    `Loaded ${dirRes.data?.length} accessible client organisations in mock mode`
  );

  // -------------------------------------------------------------------------
  // 2. Search and Filtering Logic
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Search & Filtering ---');
  const allClients = dirRes.data || [];
  const searchMatch = allClients.filter(c => 
    c.name.toLowerCase().includes('suman') || c.code.toLowerCase().includes('suman')
  );
  const statusActiveMatch = allClients.filter(c => c.status === 'active');
  const nonExistentMatch = allClients.filter(c => c.name.toLowerCase().includes('xyz-nonexistent-org'));

  recordTest(
    'Test 02',
    'Search & Status Filtering Logic',
    'ISOLATED_UNIT_TEST',
    searchMatch.length === 1 && statusActiveMatch.length >= 2 && nonExistentMatch.length === 0,
    `Search matches 'Suman' (${searchMatch.length}), filter 'active' (${statusActiveMatch.length}), empty query returns (0)`
  );

  // -------------------------------------------------------------------------
  // 3. Client Overview Context Hydration
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Client Overview Hydration ---');
  const sampleClientId = allClients[0].id;
  const clientDetailRes = await policyService.getClient(sampleClientId);
  recordTest(
    'Test 03',
    'Client Overview Record Hydration',
    'ISOLATED_UNIT_TEST',
    clientDetailRes.success && clientDetailRes.data?.id === sampleClientId,
    `Hydrated client record: name='${clientDetailRes.data?.name}', code='${clientDetailRes.data?.code}'`
  );

  // -------------------------------------------------------------------------
  // 4. Switching Authorized Workspaces
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Authorized Workspace Switching ---');
  const secondClientId = allClients[1].id;
  const switchRes = await policyService.getClient(secondClientId);
  recordTest(
    'Test 04',
    'Switching Authorized Workspaces',
    'ISOLATED_UNIT_TEST',
    switchRes.success && switchRes.data?.id === secondClientId && switchRes.data.id !== sampleClientId,
    `Switched active context to workspace '${switchRes.data?.name}' (${switchRes.data?.code})`
  );

  // -------------------------------------------------------------------------
  // 5. Legal Entities Loading
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Legal Entity Loading ---');
  const lesRes = await policyService.getLegalEntities(sampleClientId);
  recordTest(
    'Test 05',
    'Legal Entities Retrieval',
    'ISOLATED_UNIT_TEST',
    lesRes.success && Array.isArray(lesRes.data) && lesRes.data.length > 0 && !!lesRes.data[0].pan,
    `Loaded ${lesRes.data?.length} legal entities; Primary PAN: ${lesRes.data?.[0]?.pan}`
  );

  // -------------------------------------------------------------------------
  // 6. Work Locations & Geofence Loading
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Work Location Loading ---');
  const locsRes = await policyService.getWorkLocations(sampleClientId);
  recordTest(
    'Test 06',
    'Work Locations & Geofence Retrieval',
    'ISOLATED_UNIT_TEST',
    locsRes.success && Array.isArray(locsRes.data) && locsRes.data.length > 0 && locsRes.data[0].radius_meters >= 20,
    `Loaded ${locsRes.data?.length} sites; Primary site '${locsRes.data?.[0]?.name}' radius=${locsRes.data?.[0]?.radius_meters}m`
  );

  // -------------------------------------------------------------------------
  // 7. Departments Loading
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Department Loading ---');
  const deptsRes = await policyService.getDepartments(sampleClientId);
  recordTest(
    'Test 07',
    'Departments Retrieval',
    'ISOLATED_UNIT_TEST',
    deptsRes.success && Array.isArray(deptsRes.data) && deptsRes.data.length > 0,
    `Loaded ${deptsRes.data?.length} departments for client '${sampleClientId}'`
  );

  // -------------------------------------------------------------------------
  // 8. Client Operational Policy Loading
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Client Policy Loading ---');
  const polRes = await policyService.getClientPolicy(sampleClientId);
  recordTest(
    'Test 08',
    'Operational Policy Retrieval',
    'ISOLATED_UNIT_TEST',
    polRes.success && polRes.data?.client_id === sampleClientId && !!polRes.data.salary_divisor,
    `Loaded policy: is_configured=${polRes.data?.is_configured}, divisor=${polRes.data?.salary_divisor}, OT=${polRes.data?.overtime_method}`
  );

  // -------------------------------------------------------------------------
  // 9. Composite Client Card Summary
  // -------------------------------------------------------------------------
  console.log('\n--- 9. Composite Client Card Summary ---');
  const summaryRes = await policyService.getClientCardSummary(sampleClientId);
  recordTest(
    'Test 09',
    'Composite Client Card Summary Metadata',
    'ISOLATED_UNIT_TEST',
    summaryRes.success && 
    summaryRes.data !== null &&
    summaryRes.data.legalEntitiesCount >= 1 &&
    summaryRes.data.locationsCount >= 1 &&
    typeof summaryRes.data.employeeCount === 'number',
    `Aggregated metadata: entities=${summaryRes.data?.legalEntitiesCount}, locations=${summaryRes.data?.locationsCount}, headcount=${summaryRes.data?.employeeCount}`
  );

  // -------------------------------------------------------------------------
  // 10. Create Client Validation — Mandatory Fields
  // -------------------------------------------------------------------------
  console.log('\n--- 10. Create Client Validation ---');
  const invalidNameRes = await policyService.createClient({
    name: ' ', // empty name
    code: 'VALID',
    industry: 'Tech',
    status: 'onboarding',
    contact_person: 'Contact',
    contact_email: 'admin@client.com',
    contact_phone: '+91 99999 00000',
  });
  const invalidCodeRes = await policyService.createClient({
    name: 'Valid Name',
    code: '!', // invalid code format
    industry: 'Tech',
    status: 'onboarding',
    contact_person: 'Contact',
    contact_email: 'admin@client.com',
    contact_phone: '+91 99999 00000',
  });
  recordTest(
    'Test 10',
    'Create Client Validation (Mandatory & Format Guards)',
    'ISOLATED_UNIT_TEST',
    !invalidNameRes.success && invalidNameRes.error?.field === 'name' &&
    !invalidCodeRes.success && invalidCodeRes.error?.field === 'code',
    'Rejects empty name and malformed client code with structured validation errors'
  );

  // -------------------------------------------------------------------------
  // 11. Duplicate Client Code Collision Guard
  // -------------------------------------------------------------------------
  console.log('\n--- 11. Duplicate Code Collision Guard ---');
  const dupCodeRes = await policyService.createClient({
    name: 'Duplicate Suman',
    code: allClients[0].code, // existing code
    industry: 'Retail',
    status: 'onboarding',
    contact_person: 'Admin',
    contact_email: 'admin@dup.test',
    contact_phone: '+91 99999 00000',
  });
  recordTest(
    'Test 11',
    'Duplicate Client Code Guard',
    'ISOLATED_UNIT_TEST',
    !dupCodeRes.success && dupCodeRes.error?.code === 'VALIDATION_ERROR',
    `Blocked duplicate registration attempt for code '${allClients[0].code}': ${dupCodeRes.error?.message}`
  );

  // -------------------------------------------------------------------------
  // 12. Create Client Execution Lifecycle
  // -------------------------------------------------------------------------
  console.log('\n--- 12. Create Client Execution Lifecycle ---');
  const newClientCode = `TEST${Date.now().toString().slice(-4)}`;
  const createRes = await policyService.createClient({
    name: 'Zenith Logistics Enterprises',
    code: newClientCode,
    industry: 'Logistics & Supply Chain',
    status: 'onboarding',
    contact_person: 'Ramesh Verma',
    contact_email: 'rverma@zenith.test',
    contact_phone: '+91 98200 11223',
  });
  recordTest(
    'Test 12',
    'Create Client Lifecycle Execution',
    'ISOLATED_UNIT_TEST',
    createRes.success && createRes.data?.code === newClientCode,
    `Registered new client organisation '${createRes.data?.name}' with code '${createRes.data?.code}'`
  );

  const createdId = createRes.data?.id || '';

  // -------------------------------------------------------------------------
  // 13. Update Client Operations
  // -------------------------------------------------------------------------
  console.log('\n--- 13. Update Client Operations ---');
  const updateRes = await policyService.updateClient(createdId, {
    contact_person: 'Anil Mehta (Promoted)',
    status: 'active',
  });
  recordTest(
    'Test 13',
    'Update Client Operations',
    'ISOLATED_UNIT_TEST',
    updateRes.success && updateRes.data?.contact_person === 'Anil Mehta (Promoted)' && updateRes.data.status === 'active',
    `Updated client '${createdId}': contact_person='${updateRes.data?.contact_person}', status='${updateRes.data?.status}'`
  );

  // -------------------------------------------------------------------------
  // 14. Create Legal Entity Validation
  // -------------------------------------------------------------------------
  console.log('\n--- 14. Create Legal Entity Validation ---');
  const invalidPanRes = await policyService.createLegalEntity({
    client_id: createdId,
    legal_name: 'Zenith Global Private Limited',
    pan: 'SHORT12', // Invalid length (< 10)
  });
  const validLeRes = await policyService.createLegalEntity({
    client_id: createdId,
    legal_name: 'Zenith Global Private Limited',
    pan: 'AABCS9999F',
    registered_address: 'Plot 42, Hinjewadi Phase 1, Pune',
    is_primary: true,
  });
  recordTest(
    'Test 14',
    'Create Legal Entity Validation & Registration',
    'ISOLATED_UNIT_TEST',
    !invalidPanRes.success && invalidPanRes.error?.field === 'pan' && validLeRes.success,
    `Rejects invalid PAN (${invalidPanRes.error?.message}); registers valid entity '${validLeRes.data?.legal_name}'`
  );

  // -------------------------------------------------------------------------
  // 15. Create Work Location Validation
  // -------------------------------------------------------------------------
  console.log('\n--- 15. Create Work Location Validation ---');
  const invalidLatRes = await policyService.createWorkLocation({
    client_id: createdId,
    name: 'Invalid Site',
    address: 'Pune Expressway',
    latitude: 95.0, // Invalid: must be <= 90
    longitude: 73.8,
    radius_meters: 150,
  });
  const validLocRes = await policyService.createWorkLocation({
    client_id: createdId,
    name: 'Zenith Pune Hub',
    address: 'Talawade IT Park, Pune',
    latitude: 18.6780,
    longitude: 73.7850,
    radius_meters: 250,
  });
  recordTest(
    'Test 15',
    'Create Work Location Validation & Registration',
    'ISOLATED_UNIT_TEST',
    !invalidLatRes.success && invalidLatRes.error?.field === 'latitude' && validLocRes.success,
    `Rejects invalid latitude (${invalidLatRes.error?.message}); registers valid worksite '${validLocRes.data?.name}'`
  );

  // -------------------------------------------------------------------------
  // 16. Network Failure Categorization
  // -------------------------------------------------------------------------
  console.log('\n--- 16. Network Failure Categorization ---');
  const simulatedNetworkErr = new TypeError('Failed to fetch: net::ERR_CONNECTION_REFUSED');
  const serviceErr = handleSupabaseError(simulatedNetworkErr, 'policyService.networkTest');
  recordTest(
    'Test 16',
    'Network Failure Categorization (HTTP 503)',
    'ISOLATED_UNIT_TEST',
    serviceErr.code === 'NETWORK_ERROR' && serviceErr.status === 503,
    `Network exception categorized to code='${serviceErr.code}', status=${serviceErr.status}`
  );

  // -------------------------------------------------------------------------
  // 17. Empty State Handling
  // -------------------------------------------------------------------------
  console.log('\n--- 17. Empty State Handling ---');
  const emptyFilterMatch = allClients.filter(c => c.status === 'suspended');
  recordTest(
    'Test 17',
    'Empty State Detection on Non-Matching Filter',
    'ISOLATED_UNIT_TEST',
    Array.isArray(emptyFilterMatch) && emptyFilterMatch.length === 0,
    'Filter with 0 matching records cleanly resolves to empty array without throwing'
  );

  // -------------------------------------------------------------------------
  // 18. Cross-Tenant Access Isolation
  // -------------------------------------------------------------------------
  console.log('\n--- 18. Cross-Tenant Access Isolation ---');
  const tenantScopedRes = await policyService.getAccessibleClients({
    role: 'client_admin',
    clientId: sampleClientId,
  });
  recordTest(
    'Test 18',
    'Cross-Tenant Access Scoping',
    'ISOLATED_UNIT_TEST',
    tenantScopedRes.success && 
    tenantScopedRes.data?.length === 1 && 
    tenantScopedRes.data[0].id === sampleClientId,
    `Non-super-admin user strictly restricted to assigned tenant '${tenantScopedRes.data?.[0]?.name}'`
  );

  // -------------------------------------------------------------------------
  // 19. Live Supabase PostgREST Table Accessibility & RLS Boundary
  // -------------------------------------------------------------------------
  console.log('\n--- 19. Live Supabase PostgREST Connectivity & RLS ---');
  setDevDataSourceMode('supabase');
  try {
    const liveClientsQuery = await supabase.from('clients').select('id, code, name, status');
    const isLiveConnected = liveClientsQuery.status === 200 && liveClientsQuery.error === null;
    const isRlsGuarded = Array.isArray(liveClientsQuery.data) && liveClientsQuery.data.length === 0;

    recordTest(
      'Test 19',
      'Live Supabase PostgREST Connectivity & RLS Boundary',
      'REAL_INTEGRATION',
      isLiveConnected && isRlsGuarded,
      `Connected to live Supabase (HTTP ${liveClientsQuery.status}); RLS blocks unauthenticated anon reads (0 rows returned)`
    );
  } catch (err: any) {
    recordTest(
      'Test 19',
      'Live Supabase PostgREST Connectivity & RLS Boundary',
      'REAL_INTEGRATION',
      false,
      `Live Supabase query threw exception: ${err.message}`
    );
  }

  // -------------------------------------------------------------------------
  // 20. Live Supabase Non-Existent Record Error Mapping (NOT_FOUND)
  // -------------------------------------------------------------------------
  console.log('\n--- 20. Live Supabase Non-Existent Record Error Mapping ---');
  try {
    const fakeClientId = '00000000-0000-0000-0000-000000000000';
    const notFoundRes = await policyService.getClient(fakeClientId);
    recordTest(
      'Test 20',
      'Live Supabase Non-Existent Record Mapping',
      'REAL_INTEGRATION',
      !notFoundRes.success && notFoundRes.error?.code === 'NOT_FOUND',
      `Query for non-existent client cleanly returns NOT_FOUND (HTTP ${notFoundRes.error?.status}): '${notFoundRes.error?.message}'`
    );
  } catch (err: any) {
    recordTest(
      'Test 20',
      'Live Supabase Non-Existent Record Mapping',
      'REAL_INTEGRATION',
      false,
      `Live getClient threw unexpected exception: ${err.message}`
    );
  }

  // Reset data source mode to mock
  setDevDataSourceMode('mock');

  // -------------------------------------------------------------------------
  // SUMMARY SCORECARD
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`TOTAL MILESTONE 2.4A TESTS: ${total}`);
  console.log(`PASSED:                     ${passed}`);
  console.log(`FAILED:                     ${failed}`);
  console.log(`SUCCESS RATE:               ${((passed / total) * 100).toFixed(1)}%`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runClientManagementTestSuite().catch(err => {
  console.error('Fatal Client Management Test Error:', err);
  process.exit(1);
});
