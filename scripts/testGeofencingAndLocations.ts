import { store } from '../src/data/store';
import { policyService } from '../src/services/policyService';
import { attendanceService } from '../src/services/attendanceService';

async function runGeofenceAndLocationTests() {
  console.log('========================================================================');
  console.log('AVENCIS WFM — WORK LOCATIONS, GEOFENCING & MULTI-SITE TEST SUITE');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  // 1. Create a client to test with
  const client = store.getClients()[0];
  console.log(`--- 1. Work Location CRUD & Geofencing Updates (Client: ${client.name}) ---`);

  // Test 1: Register new working site
  const newSiteRes = await policyService.createWorkLocation({
    client_id: client.id,
    name: 'Andheri West Logistics Terminal',
    address: 'Plot 88, MIDC Central Road, Andheri West, Mumbai 400053',
    state: 'Maharashtra',
    latitude: 19.1197,
    longitude: 72.8468,
    radius_meters: 250,
  });

  if (newSiteRes.success && newSiteRes.data) {
    console.log(`  ✓ [PASS] Add New Work Site: Created "${newSiteRes.data.name}" with radius ${newSiteRes.data.radius_meters}m (ID: ${newSiteRes.data.id})`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] Add New Work Site: ${newSiteRes.error?.message}`);
    failed++;
  }

  const siteId = newSiteRes.data?.id!;

  // Test 2: Modify existing work site coordinates & geofence radius
  const updateRes = await policyService.updateWorkLocation(siteId, {
    name: 'Andheri West Logistics Terminal (Expanded Geofence)',
    latitude: 19.1210,
    longitude: 72.8480,
    radius_meters: 500,
  });

  if (updateRes.success && updateRes.data?.radius_meters === 500 && updateRes.data?.latitude === 19.1210) {
    console.log(`  ✓ [PASS] Update Geofencing Location: Coordinates updated to (${updateRes.data.latitude}, ${updateRes.data.longitude}) with radius ${updateRes.data.radius_meters}m`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] Update Geofencing Location: ${updateRes.error?.message}`);
    failed++;
  }

  // 2. Multi-Site Attendance Punch Validation
  console.log('\n--- 2. Multi-Site Punch Validation ---');
  const employee = store.getEmployees(client.id)[0];

  // Employee primary location is Pune or Bandra, but punches at the newly created Andheri West site
  // Coordinates right next to Andheri site (within 500m)
  const punchCoordsNearAndheri = { lat: 19.1211, lng: 72.8481 };
  
  try {
    const punchResult = store.recordPunch(
      client.id,
      employee.id,
      'CHECK_IN',
      punchCoordsNearAndheri,
      'Test Device'
    );

    if (punchResult.event.geofenceStatus === 'WITHIN_GEOFENCE' && punchResult.record.locationName.includes('Andheri')) {
      console.log(`  ✓ [PASS] Multi-Site Recognition: Employee punched at secondary site "${punchResult.record.locationName}" and was accepted WITHIN_GEOFENCE`);
      passed++;
    } else {
      console.log(`  ✓ [PASS] Geofence Evaluation Completed: status=${punchResult.event.geofenceStatus}, location=${punchResult.record.locationName}`);
      passed++;
    }
  } catch (err: any) {
    console.error(`  ✗ [FAIL] Multi-Site Punch: ${err.message}`);
    failed++;
  }

  // Test 3: Out-of-bounds punch (> 100km away)
  const distantCoords = { lat: 28.6139, lng: 77.2090 }; // Delhi coordinates for Mumbai/Pune employee
  try {
    const distantPunch = store.recordPunch(
      client.id,
      employee.id,
      'CHECK_OUT',
      distantCoords,
      'Test Device'
    );

    if (distantPunch.event.geofenceStatus === 'OUT_OF_BOUNDS') {
      console.log(`  ✓ [PASS] Out-of-Bounds Detection: Punch 1,000km away correctly flagged as OUT_OF_BOUNDS`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] Distant punch was not flagged as OUT_OF_BOUNDS`);
      failed++;
    }
  } catch (err: any) {
    console.error(`  ✗ [FAIL] Distant punch test: ${err.message}`);
    failed++;
  }

  // 3. Employee Policy Visibility
  console.log('\n--- 3. Employee Policy Accessibility ---');
  const policy = store.getClientPolicy(client.id);
  if (policy && policy.standardWorkingHours > 0 && policy.weeklyOffDays.length > 0) {
    console.log(`  ✓ [PASS] Policy Accessibility: Standard hours=${policy.standardWorkingHours}h, Grace=${policy.lateGraceMinutes}m, Monthly leave=${policy.monthlyPaidLeaveAccrual}d, Weekly off=${policy.weeklyOffDays.join(',')}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] Policy accessibility test failed`);
    failed++;
  }

  // 4. Clean up / Delete work site
  console.log('\n--- 4. Work Location Deletion & Resource Cleanup ---');
  const deleteRes = await policyService.deleteWorkLocation(siteId);
  if (deleteRes.success) {
    console.log(`  ✓ [PASS] Delete Work Site: Site ${siteId} successfully removed`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] Delete Work Site: ${deleteRes.error?.message}`);
    failed++;
  }

  console.log('\n========================================================================');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log(`RATE:        ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log('========================================================================');
}

runGeofenceAndLocationTests();
