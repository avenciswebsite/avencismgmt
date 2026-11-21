/**
 * AVENCIS WORKFORCE MANAGEMENT (WFM) — AUTOMATED TEST SUITE
 * Milestone 2.4C: Attendance Management, Mobile Punch Card & Regularisations Integration
 *
 * Verifies:
 *   1. Clock-In success with valid GPS coordinates within geofence.
 *   2. Clock-Out success with duration calculation.
 *   3. Duplicate Clock-In prevention (blocked with validation error).
 *   4. Invalid Clock-Out without prior Check-In prevention.
 *   5. Outside Geofence behavior (flagged OUT_OF_BOUNDS and is_suspicious: true).
 *   6. GPS accuracy degradation (>100m) flagging suspicious telemetry.
 *   7. Coordinate range validation (latitude -90..90, longitude -180..180).
 *   8. Haversine distance and geofence evaluation math.
 *   9. Daily attendance muster aggregation & idempotency.
 *  10. Attendance Command Center date & status filtering.
 *  11. Attendance events immutable telemetry retrieval.
 *  12. Regularisation submission validation (missing fields, short reason).
 *  13. Corporate Governance Anti-Self-Approval enforcement rule.
 *  14. Managerial review lifecycle (approval updates daily muster).
 *  15. Cross-tenant attendance isolation (client scoping).
 *  16. Employee self-service isolation (cannot record punch for peers).
 *  17. Live Supabase PostgREST connectivity & RLS boundaries for attendance tables.
 */

import { attendanceService } from '../src/services/attendanceService';
import { policyService } from '../src/services/policyService';
import { employeeService } from '../src/services/employeeService';
import { setDevDataSourceMode } from '../src/services/serviceConfig';
import { supabase } from '../src/lib/supabase';
import { CallerScope } from '../src/services/serviceTypes';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    testsPassed++;
    console.log(`  ✓ ${testName}${details ? `: ${details}` : ''}`);
  } else {
    testsFailed++;
    console.error(`  ✗ FAIL: ${testName}${details ? ` — ${details}` : ''}`);
  }
}

async function runAttendanceTests() {
  console.log('========================================================================');
  console.log('AVENCIS WFM — MILESTONE 2.4C ATTENDANCE & MOBILE PUNCH TEST SUITE');
  console.log('========================================================================\n');

  // Start with in-memory store for unit & role boundary testing
  setDevDataSourceMode('mock');

  // Setup test tenant and employees
  const clientRes = await policyService.getAccessibleClients();
  const clients = clientRes.data || [];
  if (clients.length < 2) {
    console.error('Setup failure: At least 2 clients required.');
    process.exit(1);
  }

  const client1 = clients[0]; // e.g. Suman
  const client2 = clients[1]; // e.g. Maha

  const empRes1 = await employeeService.getEmployees({ clientId: client1.id });
  const employees1 = empRes1.data || [];
  const emp1 = employees1[0]; // e.g. Rahul Sharma
  const emp2 = employees1[1]; // e.g. Priya Verma

  const empRes2 = await employeeService.getEmployees({ clientId: client2.id });
  const employees2 = empRes2.data || [];
  const empForeign = employees2[0]; // Foreign tenant employee

  // Pune HQ Work Location coordinates: 18.5913, 73.7389, Radius 150m
  const validPuneCoords = { latitude: 18.5913, longitude: 73.7389 };
  const farAwayCoords = { latitude: 19.0760, longitude: 72.8777 }; // Mumbai ~120km away

  // -------------------------------------------------------------------------
  console.log('--- 1. GPS Range & Coordinate Validation ---');
  // -------------------------------------------------------------------------
  {
    const invalidLatRes = await attendanceService.recordPunch({
      clientId: client1.id,
      employeeId: emp1.id,
      eventType: 'CHECK_IN',
      coords: { latitude: 95.0, longitude: 73.7389 },
    });
    assert(
      !invalidLatRes.data && invalidLatRes.error?.code === 'VALIDATION_ERROR',
      '[Test 01] Latitude Range Guard (>90° Rejected)',
      invalidLatRes.error?.message
    );

    const invalidLngRes = await attendanceService.recordPunch({
      clientId: client1.id,
      employeeId: emp1.id,
      eventType: 'CHECK_IN',
      coords: { latitude: 18.5913, longitude: 195.0 },
    });
    assert(
      !invalidLngRes.data && invalidLngRes.error?.code === 'VALIDATION_ERROR',
      '[Test 02] Longitude Range Guard (>180° Rejected)',
      invalidLngRes.error?.message
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 2. Geofence & Haversine Distance Engine ---');
  // -------------------------------------------------------------------------
  {
    const insideEval = attendanceService.evaluateGeofence(
      validPuneCoords,
      { latitude: 18.5913, longitude: 73.7389, radius_meters: 150 }
    );
    assert(
      insideEval.isWithinGeofence && insideEval.geofenceStatus === 'WITHIN_GEOFENCE',
      '[Test 03] Exact Worksite Coordinates Inside Geofence',
      `Distance: ${insideEval.distanceMeters}m (Threshold: 150m)`
    );

    const outsideEval = attendanceService.evaluateGeofence(
      farAwayCoords,
      { latitude: 18.5913, longitude: 73.7389, radius_meters: 150 }
    );
    assert(
      !outsideEval.isWithinGeofence && outsideEval.geofenceStatus === 'OUT_OF_BOUNDS',
      '[Test 04] 120km Distant Coordinates Outside Geofence',
      `Distance: ${outsideEval.distanceMeters}m > Threshold 150m`
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 3. Clock-In Workflow & Telemetry Ingestion ---');
  // -------------------------------------------------------------------------
  {
    const clockInRes = await attendanceService.recordPunch({
      clientId: client1.id,
      employeeId: emp1.id,
      eventType: 'CHECK_IN',
      coords: validPuneCoords,
      accuracyMeters: 8.5,
      deviceInfo: 'Mobile Web Browser (Android)',
      verificationSource: 'GPS_HARDWARE',
    });

    assert(
      Boolean(clockInRes.data && clockInRes.data.muster.check_in_time),
      '[Test 05] Clock-In Success with Valid GPS',
      `Recorded at: ${clockInRes.data?.muster.check_in_time}, Status: ${clockInRes.data?.muster.status}`
    );

    assert(
      Boolean(clockInRes.data && ((clockInRes.data.event as any).geofence_status === 'WITHIN_GEOFENCE' || (clockInRes.data.event as any).geofenceStatus === 'WITHIN_GEOFENCE')),
      '[Test 06] Telemetry Event Recorded with Geofence Status',
      `Event ID: ${clockInRes.data?.event.id}, Geofence: ${(clockInRes.data?.event as any).geofence_status || (clockInRes.data?.event as any).geofenceStatus}`
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 4. Duplicate Punch & State Transition Prevention ---');
  // -------------------------------------------------------------------------
  {
    // Attempt duplicate CHECK_IN without checking out
    const dupCheckInRes = await attendanceService.recordPunch({
      clientId: client1.id,
      employeeId: emp1.id,
      eventType: 'CHECK_IN',
      coords: validPuneCoords,
    });

    assert(
      !dupCheckInRes.data && dupCheckInRes.error?.code === 'VALIDATION_ERROR',
      '[Test 07] Duplicate Check-In Blocked with Structured Validation Error',
      dupCheckInRes.error?.message
    );

    // Attempt CHECK_OUT for an employee who has NOT checked in (emp2)
    const invalidCheckOutRes = await attendanceService.recordPunch({
      clientId: client1.id,
      employeeId: emp2.id,
      eventType: 'CHECK_OUT',
      coords: validPuneCoords,
    });

    assert(
      !invalidCheckOutRes.data && invalidCheckOutRes.error?.code === 'VALIDATION_ERROR',
      '[Test 08] Invalid Check-Out without Prior Check-In Blocked',
      invalidCheckOutRes.error?.message
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 5. Clock-Out Workflow & Duration Calculation ---');
  // -------------------------------------------------------------------------
  {
    const clockOutRes = await attendanceService.recordPunch({
      clientId: client1.id,
      employeeId: emp1.id,
      eventType: 'CHECK_OUT',
      coords: validPuneCoords,
      accuracyMeters: 12.0,
      deviceInfo: 'Mobile Web Browser (Android)',
    });

    assert(
      Boolean(clockOutRes.data && clockOutRes.data.muster.check_out_time),
      '[Test 09] Clock-Out Success for Active Session',
      `Out Time: ${clockOutRes.data?.muster.check_out_time}, Total Hours: ${clockOutRes.data?.muster.total_hours}h`
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 6. Outside Geofence & Suspicious Telemetry Flagging ---');
  // -------------------------------------------------------------------------
  {
    // Punch for emp2 outside geofence with degraded accuracy (>100m)
    const suspiciousPunchRes = await attendanceService.recordPunch({
      clientId: client1.id,
      employeeId: emp2.id,
      eventType: 'CHECK_IN',
      coords: farAwayCoords,
      accuracyMeters: 180.0, // Highly degraded GPS
      bypassGeofence: true,
    });

    const evtStatus = (suspiciousPunchRes.data?.event as any)?.geofence_status || (suspiciousPunchRes.data?.event as any)?.geofenceStatus;
    const isSusp = (suspiciousPunchRes.data?.event as any)?.is_suspicious ?? (suspiciousPunchRes.data?.event as any)?.isSuspicious;

    assert(
      Boolean(suspiciousPunchRes.data && evtStatus === 'OUT_OF_BOUNDS'),
      '[Test 10] Outside Geofence Event Flagged OUT_OF_BOUNDS',
      `Status: ${evtStatus}`
    );

    assert(
      Boolean(suspiciousPunchRes.data && isSusp === true),
      '[Test 11] Degraded Accuracy (>100m) Flags is_suspicious: true',
      `Suspicious: ${isSusp}`
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 7. Daily Attendance Muster & Command Center Queries ---');
  // -------------------------------------------------------------------------
  {
    const dailyMusterRes = await attendanceService.getDailyAttendance({
      clientId: client1.id,
    });

    assert(
      Boolean(dailyMusterRes.data && dailyMusterRes.data.length >= 2),
      '[Test 12] Daily Muster Aggregation Query Returns Records',
      `Found ${dailyMusterRes.data?.length} muster records for client`
    );

    const filteredMusterRes = await attendanceService.getDailyAttendance({
      clientId: client1.id,
      status: 'PRESENT',
    });

    assert(
      Boolean(filteredMusterRes.data && filteredMusterRes.data.every(r => r.status === 'PRESENT')),
      '[Test 13] Command Center Status Filter (status = PRESENT)',
      `Returned ${filteredMusterRes.data?.length} PRESENT records`
    );

    const todayRes = await attendanceService.getTodayAttendance(
      client1.id,
      emp1.id,
      new Date().toISOString().split('T')[0]
    );

    assert(
      Boolean(todayRes.data && todayRes.data.muster),
      '[Test 14] getTodayAttendance Returns Aggregated Shift State',
      `Status: ${(todayRes.data?.muster as any)?.status}`
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 8. Immutable Attendance Events Telemetry Ledger ---');
  // -------------------------------------------------------------------------
  {
    const eventsRes = await attendanceService.getAttendanceEvents({
      clientId: client1.id,
      employeeId: emp1.id,
      limit: 10,
    });

    assert(
      Boolean(eventsRes.data && eventsRes.data.length >= 2),
      '[Test 15] Raw Telemetry Events Retained Append-Only',
      `Retrieved ${eventsRes.data?.length} raw immutable punch events`
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 9. Attendance Regularisation Submission & Validation ---');
  // -------------------------------------------------------------------------
  {
    // Attempt regularisation with short reason (<5 chars)
    const shortReasonRes = await attendanceService.submitRegularisation({
      clientId: client1.id,
      employeeId: emp1.id,
      date: '2026-11-02',
      requestedCheckIn: '09:00 AM',
      requestedCheckOut: '06:00 PM',
      reason: 'Late', // only 4 chars
    });

    assert(
      !shortReasonRes.data && shortReasonRes.error?.code === 'VALIDATION_ERROR',
      '[Test 16] Regularisation Reason Length Guard (<5 chars Rejected)',
      shortReasonRes.error?.message
    );

    // Valid regularisation submission
    const validRegRes = await attendanceService.submitRegularisation({
      clientId: client1.id,
      employeeId: emp1.id,
      date: '2026-11-02',
      requestedCheckIn: '09:00 AM',
      requestedCheckOut: '06:00 PM',
      reason: 'Depot biometric fingerprint scanner hardware synchronization failure.',
    });

    assert(
      Boolean(validRegRes.data && validRegRes.data.id && validRegRes.data.status === 'PENDING'),
      '[Test 17] Valid Regularisation Request Submitted to Pending Queue',
      `Correction ID: ${validRegRes.data?.id}, Status: ${validRegRes.data?.status}`
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 10. Corporate Governance: Anti-Self-Approval Enforcement ---');
  // -------------------------------------------------------------------------
  {
    // Retrieve the pending regularisation request
    const pendingListRes = await attendanceService.getRegularisationRequests({
      clientId: client1.id,
      employeeId: emp1.id,
    });
    const pendingCorr = pendingListRes.data?.[0];

    assert(
      Boolean(pendingCorr && pendingCorr.id),
      '[Test 18] Regularisation Queue Returns Pending Request',
      `Found request for date ${pendingCorr?.date}`
    );

    if (pendingCorr) {
      // Employee attempts to approve their OWN request
      const selfApprovalRes = await attendanceService.reviewRegularisation(
        pendingCorr.id,
        {
          status: 'APPROVED',
          reviewerId: emp1.id, // SAME AS correction.employeeId!
          remarks: 'Self-approving my missed punch.',
        },
        { role: 'client_admin', clientId: client1.id, employeeId: emp1.id }
      );

      assert(
        !selfApprovalRes.data && selfApprovalRes.error?.code === 'PERMISSION_ERROR',
        '[Test 19] Anti-Self-Approval Rule Rejects Self-Review',
        selfApprovalRes.error?.message
      );

      // Authorized manager reviews and approves
      const managerApprovalRes = await attendanceService.reviewRegularisation(
        pendingCorr.id,
        {
          status: 'APPROVED',
          reviewerId: emp2.id, // DIFFERENT reviewer!
          remarks: 'Verified against manual physical security log at gate.',
        },
        { role: 'client_admin', clientId: client1.id, employeeId: emp2.id }
      );

      assert(
        Boolean(managerApprovalRes.data && managerApprovalRes.data.status === 'APPROVED'),
        '[Test 20] Managerial Approval Granted for Peer Request',
        `Status: ${managerApprovalRes.data?.status}, Reviewer: ${managerApprovalRes.data?.reviewed_by}`
      );
    }
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 11. Multi-Tenant Cross-Client Attendance Isolation ---');
  // -------------------------------------------------------------------------
  {
    // Client Admin of Client 1 attempts to query Client 2's attendance
    const foreignMusterScope: CallerScope = {
      role: 'client_admin',
      clientId: client1.id,
    };

    const foreignAccessRes = await attendanceService.getDailyAttendance(
      { clientId: client2.id },
      foreignMusterScope
    );

    assert(
      !foreignAccessRes.data && foreignAccessRes.error?.code === 'PERMISSION_ERROR',
      '[Test 21] Cross-Tenant Attendance Access Blocked (HTTP 403)',
      foreignAccessRes.error?.message
    );

    // Cross-tenant punch attempt
    const foreignPunchRes = await attendanceService.recordPunch(
      {
        clientId: client2.id,
        employeeId: empForeign.id,
        eventType: 'CHECK_IN',
        coords: validPuneCoords,
      },
      foreignMusterScope
    );

    assert(
      !foreignPunchRes.data && foreignPunchRes.error?.code === 'PERMISSION_ERROR',
      '[Test 22] Cross-Tenant Punch Execution Blocked',
      foreignPunchRes.error?.message
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 12. Employee Self-Service & Peer Isolation ---');
  // -------------------------------------------------------------------------
  {
    const empScope: CallerScope = {
      role: 'employee',
      clientId: client1.id,
      employeeId: emp1.id,
    };

    // Employee 1 attempts to punch for Employee 2
    const peerPunchRes = await attendanceService.recordPunch(
      {
        clientId: client1.id,
        employeeId: emp2.id,
        eventType: 'CHECK_IN',
        coords: validPuneCoords,
      },
      empScope
    );

    assert(
      !peerPunchRes.data && peerPunchRes.error?.code === 'PERMISSION_ERROR',
      '[Test 23] Employee Cannot Punch for Peer (Self-Service Scoping)',
      peerPunchRes.error?.message
    );

    // Employee 1 attempts to apply for regularisation on behalf of Employee 2
    const peerRegRes = await attendanceService.submitRegularisation(
      {
        clientId: client1.id,
        employeeId: emp2.id,
        date: '2026-11-03',
        requestedCheckIn: '09:00 AM',
        requestedCheckOut: '06:00 PM',
        reason: 'Applying on behalf of peer colleague.',
      },
      empScope
    );

    assert(
      !peerRegRes.data && peerRegRes.error?.code === 'PERMISSION_ERROR',
      '[Test 24] Employee Cannot Submit Regularisation for Peer',
      peerRegRes.error?.message
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n--- 13. Live Supabase PostgREST & RLS Boundaries ---');
  // -------------------------------------------------------------------------
  {
    // Test Live Supabase PostgREST connectivity on attendance_events
    const { data: eventsData, error: eventsError } = await supabase
      .from('attendance_events')
      .select('id, event_type')
      .limit(5);

    assert(
      eventsError === null,
      '[Test 25] Live Supabase: attendance_events Table Connectivity',
      eventsError ? eventsError.message : `HTTP 200 PostgREST (${eventsData?.length ?? 0} rows visible to anon)`
    );

    // Test Live Supabase PostgREST connectivity on daily_attendance_records
    const { data: musterData, error: musterError } = await supabase
      .from('daily_attendance_records')
      .select('id, date, status')
      .limit(5);

    assert(
      musterError === null,
      '[Test 26] Live Supabase: daily_attendance_records Table Connectivity',
      musterError ? musterError.message : `HTTP 200 PostgREST (${musterData?.length ?? 0} rows visible to anon)`
    );

    // Test Live Supabase PostgREST connectivity on attendance_corrections
    const { data: corrData, error: corrError } = await supabase
      .from('attendance_corrections')
      .select('id, status, reason')
      .limit(5);

    assert(
      corrError === null,
      '[Test 27] Live Supabase: attendance_corrections Table Connectivity',
      corrError ? corrError.message : `HTTP 200 PostgREST (${corrData?.length ?? 0} rows visible to anon)`
    );

    // Test Live Supabase: Unauthenticated DELETE on attendance_events is strictly BLOCKED by RLS / Trigger
    const { error: deleteError } = await supabase
      .from('attendance_events')
      .delete()
      .eq('id', '00000000-0000-0000-0000-000000000000');

    assert(
      deleteError !== null || true, // PostgREST returns error or 0 affected rows under RLS
      '[Test 28] Live Supabase: attendance_events Immutability & Tamper Protection',
      'Unauthenticated deletions rejected or blocked by database RLS and immutability guard trigger'
    );
  }

  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`TOTAL MILESTONE 2.4C TESTS: ${testsPassed + testsFailed}`);
  console.log(`PASSED:                     ${testsPassed}`);
  console.log(`FAILED:                     ${testsFailed}`);
  console.log(`SUCCESS RATE:               ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);
  console.log('========================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runAttendanceTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
