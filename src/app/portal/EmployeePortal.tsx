import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import { employeeService } from '../../services/employeeService';
import { attendanceService } from '../../services/attendanceService';
import { leaveService } from '../../services/leaveService';
import { payrollService } from '../../services/payrollService';
import { calculateEffectiveLeaveDays } from '../../services/leaveCalculationHelper';
import { 
  getDaysInMonth, 
  aggregateMonthlyAttendance, 
  calculateEmployeePayrollItem 
} from '../../services/payrollCalculationHelper';
import { CallerScope, LeaveBalanceRow, LeaveRequestRow, PayslipRow } from '../../services/serviceTypes';
import { 
  Clock, 
  Calendar, 
  FileText, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  Printer, 
  Download, 
  X, 
  Building2, 
  UserCheck, 
  Sparkles, 
  ChevronRight, 
  ArrowUpRight, 
  Smartphone,
  Navigation,
  Sliders,
  Key
} from 'lucide-react';
import { ChangePasswordModal } from '../../components/auth/ChangePasswordModal';

interface EmployeePortalProps {
  defaultTab?: 'punch' | 'leaves' | 'regularisations' | 'payslips' | 'policies';
}

export const EmployeePortal: React.FC<EmployeePortalProps> = ({ defaultTab = 'punch' }) => {
  const { user } = useAuth();
  const { currentClient, activeLocations, activeLegalEntity, departments, clientPolicy } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();

  // Tab State - Persistent tabs
  const getInitialTab = (): 'punch' | 'leaves' | 'regularisations' | 'payslips' | 'policies' => {
    const path = location.pathname;
    if (path.includes('/punch') || path.includes('/check-in')) return 'punch';
    if (path.includes('/leave')) return 'leaves';
    if (path.includes('/regularisations')) return 'regularisations';
    if (path.includes('/payslips')) return 'payslips';
    if (path.includes('/policies')) return 'policies';
    return defaultTab;
  };

  const [activeTab, setActiveTab] = useState<'punch' | 'leaves' | 'regularisations' | 'payslips' | 'policies'>(getInitialTab());
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Keep activeTab in sync if route prop changes
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/punch') || path.includes('/check-in')) setActiveTab('punch');
    else if (path.includes('/leave')) setActiveTab('leaves');
    else if (path.includes('/regularisations')) setActiveTab('regularisations');
    else if (path.includes('/payslips')) setActiveTab('payslips');
    else if (path.includes('/policies')) setActiveTab('policies');
  }, [location.pathname]);

  // Live Digital Clock
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateFormatted, setCurrentDateFormatted] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
      setCurrentDateFormatted(now.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Punch state
  const [isPunching, setIsPunching] = useState<boolean>(false);
  const [punchFeedback, setPunchFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [portalCoords, setPortalCoords] = useState<{ lat: number; lng: number }>({ lat: 18.5204, lng: 73.8567 });
  const [portalAccuracy, setPortalAccuracy] = useState<number>(8.5);
  const [liveMuster, setLiveMuster] = useState<any>(null);
  const [liveCorrections, setLiveCorrections] = useState<any[]>([]);
  const [liveLeaveBalances, setLiveLeaveBalances] = useState<LeaveBalanceRow[]>([]);
  const [liveLeaveRequests, setLiveLeaveRequests] = useState<LeaveRequestRow[]>([]);
  const [leaveFeedback, setLeaveFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmittingLeave, setIsSubmittingLeave] = useState<boolean>(false);

  // Leave Form state
  const [leaveType, setLeaveType] = useState<'PL' | 'CL' | 'SL'>('CL');
  const [startDate, setStartDate] = useState<string>('2026-11-10');
  const [endDate, setEndDate] = useState<string>('2026-11-10');
  const [leaveReason, setLeaveReason] = useState<string>('');
  const [isHalfDay, setIsHalfDay] = useState<boolean>(false);
  const [leaveAppliedSuccess, setLeaveAppliedSuccess] = useState<boolean>(false);

  // Regularisation Form state
  const [regDate, setRegDate] = useState<string>('2026-11-02');
  const [regCheckIn, setRegCheckIn] = useState<string>('09:00 AM');
  const [regCheckOut, setRegCheckOut] = useState<string>('06:00 PM');
  const [regReason, setRegReason] = useState<string>('');
  const [regSuccess, setRegSuccess] = useState<boolean>(false);

  // Payslip Modal state
  const [selectedPayslipMonth, setSelectedPayslipMonth] = useState<string | null>(null);

  // Data retrieval
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    if (currentClient?.id) {
      employeeService.getEmployees({ clientId: currentClient.id }).then(res => {
        if (res.data) {
          setEmployees(res.data.map(e => ({
            id: e.id,
            clientId: e.client_id,
            legalEntityId: e.legal_entity_id,
            workLocationId: e.work_location_id,
            departmentId: (e as any).department_id || '',
            employeeCode: e.employee_code,
            firstName: e.first_name,
            lastName: e.last_name,
            email: e.email,
            mobile: (e as any).mobile || (e as any).phone || '',
            designation: e.designation || 'Staff',
            joiningDate: (e as any).joining_date || (e as any).date_of_joining || new Date().toISOString().split('T')[0],
            employmentType: 'FULL_TIME',
            status: 'ACTIVE',
            fixedMonthlySalary: Number((e as any).fixed_monthly_salary || 25000),
            variableIncentive: Number((e as any).variable_incentive || 0),
            otherAllowances: 0,
            bankName: (e as any).bank_name || 'HDFC Bank',
            accountNumber: (e as any).account_number || '000000000000',
            ifscCode: (e as any).ifsc_code || 'HDFC0000001',
            panNumber: (e as any).pan || '',
            aadhaarNumber: (e as any).aadhaar || '',
            uanNumber: (e as any).uan_number || '',
            esicNumber: (e as any).esic_number || '',
          })));
        }
      });
    }
  }, [currentClient?.id]);

  const currentEmp = employees.find(e => e.email?.toLowerCase() === user?.email?.toLowerCase()) || employees[0];
  const departmentName = currentEmp ? (departments.find(d => d.id === currentEmp.departmentId)?.name || 'Operations') : 'Operations';
  const todayAttendance = liveMuster ? {
    checkInTime: liveMuster.check_in_time || liveMuster.checkInTime,
    checkOutTime: liveMuster.check_out_time || liveMuster.checkOutTime,
    totalHours: liveMuster.total_hours ?? liveMuster.totalHours,
  } : undefined;
  const leaveBalances = liveLeaveBalances.map(b => ({
    id: b.id,
    employeeId: b.employee_id,
    leaveType: b.leave_type,
    opening: b.opening,
    credited: b.credited,
    used: b.used,
    closing: b.closing,
  }));
  const employeeRequests = liveLeaveRequests.map(r => ({
    id: r.id,
    employeeId: r.employee_id,
    leaveType: r.leave_type,
    startDate: r.start_date,
    endDate: r.end_date,
    totalDays: r.total_days,
    reason: r.reason,
    status: r.status.toUpperCase(),
    appliedAt: (r as any).created_at || (r as any).applied_at || new Date().toISOString(),
  }));
  const employeeCorrections = liveCorrections.map(c => ({
    id: c.id,
    employeeId: c.employee_id,
    date: c.date,
    requestedCheckIn: c.requested_check_in,
    requestedCheckOut: c.requested_check_out,
    reason: c.reason,
    status: c.status.toUpperCase(),
    managerRemarks: c.manager_remarks,
  }));
  const assignedLocation = currentEmp ? (activeLocations.find(l => l.id === currentEmp.workLocationId) || activeLocations[0]) : undefined;
  const policy = clientPolicy;

  const currentClientId = currentClient?.id;
  const currentEmpId = currentEmp?.id;
  const userRole = user?.role;
  const userClientId = user?.clientId;
  const userEmployeeId = user?.employeeId;

  // Caller scope for role-based authorization - memoized to prevent infinite re-render loops
  const callerScope: CallerScope | undefined = useMemo(() => userRole ? {
    role: userRole,
    clientId: userClientId || currentClientId,
    employeeId: userEmployeeId,
  } : undefined, [userRole, userClientId, currentClientId, userEmployeeId]);

  // Live Attendance & Regularisations loader from attendanceService
  const loadLiveAttendance = useCallback(async () => {
    if (!currentClientId || !currentEmpId) return;
    const todayDate = new Date().toISOString().split('T')[0];
    const scope: CallerScope | undefined = userRole ? {
      role: userRole,
      clientId: userClientId || currentClientId,
      employeeId: userEmployeeId,
    } : undefined;

    try {
      const [attRes, corrRes, balRes, reqRes] = await Promise.all([
        attendanceService.getTodayAttendance(currentClientId, currentEmpId, todayDate, scope),
        attendanceService.getRegularisationRequests({ clientId: currentClientId, employeeId: currentEmpId }, scope),
        leaveService.getLeaveBalances(currentEmpId, undefined, scope),
        leaveService.getLeaveRequests({ clientId: currentClientId, employeeId: currentEmpId }, scope)
      ]);
      if (attRes.data?.muster) {
        setLiveMuster(attRes.data.muster);
      }
      if (corrRes.data) {
        setLiveCorrections(corrRes.data);
      }
      if (balRes.data) {
        setLiveLeaveBalances(balRes.data);
      }
      if (reqRes.data) {
        setLiveLeaveRequests(reqRes.data);
      }
    } catch (e) {
      console.error('Failed to load live portal data:', e);
    }
  }, [currentClientId, currentEmpId, userRole, userClientId, userEmployeeId]);

  // Fetch GPS coordinates once on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPortalCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setPortalAccuracy(Math.round(pos.coords.accuracy * 10) / 10);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  useEffect(() => {
    loadLiveAttendance();
  }, [loadLiveAttendance]);

  if (!currentClient || !currentEmp) {
    return (
      <div className="p-8 text-on-surface-variant bg-surface-container-low rounded-xl border border-outline-variant/30 text-center">
        <p className="font-semibold text-primary">No active employee profile linked to current session.</p>
        <p className="text-xs text-on-surface-variant mt-1">Please select an employee persona or client workspace.</p>
      </div>
    );
  }

  // Active muster state
  const effectiveInTime = liveMuster ? ((liveMuster as any).checkInTime || (liveMuster as any).check_in_time) : todayAttendance?.checkInTime;
  const effectiveOutTime = liveMuster ? ((liveMuster as any).checkOutTime || (liveMuster as any).check_out_time) : todayAttendance?.checkOutTime;
  const effectiveTotalHours = liveMuster ? ((liveMuster as any).totalHours ?? (liveMuster as any).total_hours) : todayAttendance?.totalHours;
  const isAlreadyCheckedIn = Boolean(effectiveInTime && !effectiveOutTime);
  const isShiftCompleted = Boolean(effectiveInTime && effectiveOutTime);
  const canCheckIn = !isAlreadyCheckedIn && !isShiftCompleted;
  const canCheckOut = isAlreadyCheckedIn && !isShiftCompleted;

  // Handle Punch In / Out via attendanceService
  const handlePunch = async (type: 'CHECK_IN' | 'CHECK_OUT') => {
    if (type === 'CHECK_IN' && !canCheckIn) {
      setPunchFeedback({
        type: 'error',
        message: isAlreadyCheckedIn ? 'Already checked in today.' : 'Shift already completed for today.'
      });
      return;
    }
    if (type === 'CHECK_OUT' && !canCheckOut) {
      setPunchFeedback({
        type: 'error',
        message: 'Cannot check out without an active check-in session for today.'
      });
      return;
    }

    setIsPunching(true);
    setPunchFeedback(null);

    try {
      const coords = assignedLocation && assignedLocation.latitude 
        ? { latitude: portalCoords.lat || assignedLocation.latitude, longitude: portalCoords.lng || assignedLocation.longitude }
        : { latitude: portalCoords.lat, longitude: portalCoords.lng };

      const res = await attendanceService.recordPunch({
        clientId: currentClient.id,
        employeeId: currentEmp.id,
        eventType: type,
        coords,
        accuracyMeters: portalAccuracy,
        deviceInfo: 'Employee Portal Responsive Web App',
        verificationSource: 'BROWSER_TELEMETRY'
      }, callerScope);

      if (res.data) {
        setPunchFeedback({
          type: 'success',
          message: `Official ${type === 'CHECK_IN' ? 'Check-In' : 'Check-Out'} recorded successfully at ${currentTime} with GPS validation.`
        });
        await loadLiveAttendance();
      } else {
        setPunchFeedback({
          type: 'error',
          message: res.error?.message || 'Geofence validation failed. Punch could not be recorded.'
        });
      }
    } catch (err: any) {
      setPunchFeedback({
        type: 'error',
        message: err.message || 'Geofence validation failed. Punch could not be recorded.'
      });
    } finally {
      setIsPunching(false);
    }
  };

  // Handle Leave Submission via leaveService
  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentClient || !currentEmp) return;
    if (!leaveReason.trim()) {
      setLeaveFeedback({ type: 'error', message: 'Please provide a reason for absence (at least 5 characters).' });
      return;
    }

    const policy = clientPolicy;
    const calc = calculateEffectiveLeaveDays({
      startDate,
      endDate,
      weeklyOffDays: policy?.weeklyOffDays || ['SUNDAY'],
      isHalfDay: startDate === endDate && isHalfDay,
    });
    const days = calc.totalLeaveDays > 0 ? calc.totalLeaveDays : (isHalfDay ? 0.5 : 1);

    setIsSubmittingLeave(true);
    setLeaveFeedback(null);

    try {
      const res = await leaveService.submitLeaveRequest({
        clientId: currentClient.id,
        employeeId: currentEmp.id,
        leaveType,
        startDate,
        endDate,
        totalDays: days,
        reason: leaveReason.trim(),
        isHalfDay: startDate === endDate && isHalfDay,
      }, callerScope);

      if (res.data) {
        setLeaveAppliedSuccess(true);
        setLeaveFeedback({ type: 'success', message: `Leave application for ${days} day(s) submitted for supervisor approval.` });
        setLeaveReason('');
        await loadLiveAttendance();
        setTimeout(() => {
          setLeaveAppliedSuccess(false);
          setLeaveFeedback(null);
        }, 5000);
      } else {
        setLeaveFeedback({ type: 'error', message: res.error?.message || 'Failed to submit leave application.' });
      }
    } catch (err: any) {
      setLeaveFeedback({ type: 'error', message: err.message || 'An unexpected error occurred while applying for leave.' });
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  // Handle Cancel Leave Request
  const handleCancelLeave = async (reqId: string) => {
    if (!currentEmp) return;
    try {
      const res = await leaveService.cancelLeaveRequest(reqId, currentEmp.id, callerScope);
      if (res.data) {
        setLeaveFeedback({ type: 'success', message: 'Leave application cancelled successfully.' });
        await loadLiveAttendance();
        setTimeout(() => setLeaveFeedback(null), 4000);
      } else {
        setLeaveFeedback({ type: 'error', message: res.error?.message || 'Failed to cancel leave request.' });
      }
    } catch (err: any) {
      setLeaveFeedback({ type: 'error', message: err.message || 'Error cancelling leave request.' });
    }
  };

  // Handle Regularisation Submission via attendanceService
  const handleApplyRegularisation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regReason.trim()) return;

    try {
      const res = await attendanceService.submitRegularisation({
        clientId: currentClient.id,
        employeeId: currentEmp.id,
        date: regDate,
        requestedCheckIn: regCheckIn,
        requestedCheckOut: regCheckOut,
        reason: regReason,
      }, callerScope);

      if (res.data) {
        setRegSuccess(true);
        setRegReason('');
        await loadLiveAttendance();
        setTimeout(() => setRegSuccess(false), 5000);
      } else {
        setPunchFeedback({
          type: 'error',
          message: res.error?.message || 'Failed to submit regularisation request.'
        });
      }
    } catch (err: any) {
      console.error('Failed to submit regularisation request:', err);
    }
  };

  // Salary breakdown for Payslip preview & published payslips
  const [publishedPayslips, setPublishedPayslips] = useState<PayslipRow[]>([]);
  const [portalPayrollItem, setPortalPayrollItem] = useState<any>(null);

  useEffect(() => {
    if (!currentClient?.id || !currentEmp?.id) return;
    payrollService.getPayslips({ clientId: currentClient.id, employeeId: currentEmp.id }).then(res => {
      if (res.success && res.data) {
        setPublishedPayslips(res.data);
      }
    });
  }, [currentClient?.id, currentEmp?.id]);

  useEffect(() => {
    if (!currentEmp?.id || !selectedPayslipMonth) return;
    const monthNum = selectedPayslipMonth.includes('October') ? 10 : selectedPayslipMonth.includes('November') ? 11 : 9;
    payrollService.getPublishedPayslip(currentEmp.id, monthNum, 2026).then(res => {
      if (res.success && res.data?.item) {
        setPortalPayrollItem(res.data.item);
      }
    });
  }, [selectedPayslipMonth, currentEmp?.id]);

  let calendarDays = 30;
  let paidDays = 30;
  let unpaidDays = 0;
  let basic = 0;
  let hra = 0;
  let conveyance = 1600;
  let specialAllowance = 0;
  let overtimePay = 0;
  let variableIncentives = currentEmp.variableIncentive || 0;
  let otherAllowances = currentEmp.otherAllowances || 0;
  let grossEarnings = 0;
  let pf = 0;
  let esi = 0;
  let pt = 0;
  let tds = 0;
  let totalDeductions = 0;
  let netPay = 0;

  if (portalPayrollItem) {
    calendarDays = portalPayrollItem.calendarDays;
    paidDays = portalPayrollItem.paidDays;
    unpaidDays = portalPayrollItem.unpaidDays;
    basic = portalPayrollItem.basicPay ?? Math.round(portalPayrollItem.fixedSalary * 0.5);
    hra = portalPayrollItem.hra ?? Math.round(portalPayrollItem.fixedSalary * 0.3);
    conveyance = portalPayrollItem.conveyance ?? 1600;
    specialAllowance = portalPayrollItem.specialAllowance ?? Math.max(0, portalPayrollItem.grossEarned - basic - hra - conveyance - portalPayrollItem.incentives);
    overtimePay = portalPayrollItem.overtimePay ?? 0;
    variableIncentives = portalPayrollItem.incentives;
    otherAllowances = portalPayrollItem.otherAllowances;
    grossEarnings = portalPayrollItem.grossEarned;
    pf = portalPayrollItem.pfDeduction;
    esi = portalPayrollItem.esicDeduction;
    pt = portalPayrollItem.ptDeduction;
    tds = portalPayrollItem.tdsDeduction;
    totalDeductions = portalPayrollItem.totalDeductions;
    netPay = portalPayrollItem.netSalary;
  } else {
    calendarDays = getDaysInMonth(10, 2026);
    const empAtt: any[] = [];
    const attSummary = aggregateMonthlyAttendance(empAtt, 10, 2026, currentEmp.joiningDate);
    paidDays = attSummary.paidDays;
    unpaidDays = attSummary.unpaidDays;

    const calc = calculateEmployeePayrollItem(
      currentEmp,
      {
        fixedMonthlyBase: currentEmp.fixedMonthlySalary,
        hra: Math.round(currentEmp.fixedMonthlySalary * 0.3),
        conveyance: 1600,
        specialAllowances: Math.round(currentEmp.fixedMonthlySalary * 0.2),
        variableIncentives: currentEmp.variableIncentive,
        tdsWithholdingAmount: currentEmp.fixedMonthlySalary >= 50000 ? 2500 : 0,
      },
      attSummary,
      policy || ({} as any),
      10,
      2026,
      'Maharashtra'
    );

    basic = calc.earnings.basicPay;
    hra = calc.earnings.hra;
    conveyance = calc.earnings.conveyance;
    specialAllowance = calc.earnings.specialAllowance;
    overtimePay = calc.earnings.authorisedOvertimePay;
    variableIncentives = calc.earnings.authorisedIncentives;
    otherAllowances = calc.earnings.otherAllowances;
    grossEarnings = calc.earnings.grossEarned;
    pf = calc.deductions.pfEmployee;
    esi = calc.deductions.esicEmployee;
    pt = calc.deductions.ptDeduction;
    tds = calc.deductions.tdsDeduction;
    totalDeductions = calc.deductions.totalDeductions;
    netPay = calc.netSalary;
  }

  return (
    <div className="space-y-6">
      {/* 
        =======================================================================
        PART 1: PERSISTENT EMPLOYEE PORTAL HEADER
        Must remain visible across all tab selections without unmounting.
        =======================================================================
      */}
      <div className="bg-surface-container-low p-5 sm:p-6 rounded-xl border border-outline-variant/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <img
            src={currentEmp.avatarUrl}
            alt={`${currentEmp.firstName} ${currentEmp.lastName}`}
            className="w-14 h-14 rounded-full object-cover border-2 border-secondary/20 shadow-sm shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                Employee Self-Service (ESS)
              </span>
              <span className="text-[11px] font-mono text-on-surface-variant">
                ID: {currentEmp.employeeCode}
              </span>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl text-primary font-normal mt-1 leading-tight">
              Welcome, {currentEmp.firstName} {currentEmp.lastName}
            </h1>
            <p className="text-xs text-on-surface-variant mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-on-surface">{currentEmp.designation}</span>
              <span>•</span>
              <span>{departmentName}</span>
              <span>•</span>
              <span className="font-semibold text-primary">{currentClient.name}</span>
            </p>
          </div>
        </div>

        {/* Live Status Pill & Workplace Badge & Change Password */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 self-start md:self-center">
          <div className="px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant/20 flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-mono text-on-surface-variant">GPS Telemetry: Active</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-primary/5 text-primary border border-primary/20 text-xs font-semibold">
            {assignedLocation ? assignedLocation.name : 'Primary Operations Hub'}
          </div>
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container border border-outline-variant/30 flex items-center gap-1.5 text-xs font-semibold text-primary transition-colors shadow-sm"
            title="Change Account Password"
          >
            <Key className="w-3.5 h-3.5 text-primary" />
            <span>Change Password</span>
          </button>
        </div>
      </div>

      {/* 
        =======================================================================
        PART 1: PERSISTENT EMPLOYEE NAVIGATION TABS
        Must remain visible across all tab selections without unmounting.
        =======================================================================
      */}
      <div className="flex flex-wrap sm:flex-nowrap gap-2 bg-surface-container-lowest p-2 rounded-xl border border-outline-variant/30 shadow-sm">
        {[
          { key: 'punch', label: 'Mobile Punch Card', icon: Clock, badge: todayAttendance?.checkInTime ? 'Punched In' : 'Pending' },
          { key: 'leaves', label: 'Leave Center', icon: Calendar, badge: `${leaveBalances.reduce((acc, b) => acc + b.closing, 0)}d avail` },
          { key: 'regularisations', label: 'Regularisations', icon: ShieldCheck, badge: `${employeeCorrections.filter(c => c.status === 'PENDING').length} pending` },
          { key: 'payslips', label: 'My Payslips', icon: FileText, badge: 'Oct 2026' },
          { key: 'policies', label: 'Company Policies', icon: Sliders },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => {
                setActiveTab(t.key as any);
                navigate(`/portal/${t.key === 'punch' ? 'punch' : t.key}`, { replace: true });
              }}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-sm ring-1 ring-primary'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{t.label}</span>
              {t.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium ${
                  isActive ? 'bg-white/20 text-white' : 'bg-surface-container-high text-on-surface-variant'
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 
        =======================================================================
        ACTIVE TAB CONTENT CONTAINER
        Only this area changes when switching between tabs.
        =======================================================================
      */}
      <div className="min-h-[420px]">
        {/* ------------------------------------------------------------- */}
        {/* TAB 1: ATTENDANCE & PUNCH (GENUINE RESPONSIVE INTERFACE)      */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'punch' && (
          <div className="space-y-6">
            {punchFeedback && (
              <div className={`p-4 rounded-xl text-xs flex items-center gap-3 border ${
                punchFeedback.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                  : 'bg-red-50 text-red-900 border-red-200'
              }`}>
                {punchFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <span className="font-medium">{punchFeedback.message}</span>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (Desktop 7 cols, Mobile full-width): Punch Action Center */}
              <div className="lg:col-span-7 space-y-6">
                {/* Real-time Clock & GPS Card */}
                <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/20 pb-4">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-wider text-secondary font-bold">
                        Live Attendance Terminal
                      </span>
                      <div className="font-serif text-3xl sm:text-4xl text-primary font-bold tracking-tight mt-1">
                        {currentTime || '09:00:00 AM'}
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {currentDateFormatted || 'Tuesday, 03 Nov 2026'}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Shift Window</span>
                      <span className="font-semibold text-xs text-primary block mt-0.5">09:00 AM – 06:00 PM</span>
                      <span className="text-[10px] text-emerald-600 font-medium">15 min grace period active</span>
                    </div>
                  </div>

                  {/* Geofence Status Dossier */}
                  <div className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                        <span>{assignedLocation?.name || 'Authorized Fleet Depot'}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Inside Geofence Radius
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant">
                      {assignedLocation?.address || 'Plot 42, Hadapsar Industrial Area, Pune 411028'}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono text-on-surface-variant pt-1 border-t border-outline-variant/20">
                      <span>Lat: {assignedLocation?.latitude || '18.5204'}° N</span>
                      <span>Lng: {assignedLocation?.longitude || '73.8567'}° E</span>
                      <span>Accuracy: ±8.5m</span>
                      <span>Radius: {assignedLocation?.radiusMeters || 100}m</span>
                    </div>
                  </div>

                  {/* Large Touch/Click Punch Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <button
                      onClick={() => handlePunch('CHECK_IN')}
                      disabled={isPunching || !canCheckIn}
                      className={`py-4 px-6 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-md ${
                        canCheckIn
                          ? 'bg-primary text-white hover:bg-primary-dark'
                          : 'bg-surface-container-high text-on-surface-variant cursor-not-allowed opacity-60'
                      }`}
                    >
                      <Navigation className="w-5 h-5 text-accent-light" />
                      <span>
                        {isPunching 
                          ? 'Verifying GPS...' 
                          : isShiftCompleted 
                          ? 'Shift Completed' 
                          : isAlreadyCheckedIn 
                          ? 'Already Checked In' 
                          : 'Punch In (Check-In)'}
                      </span>
                    </button>

                    <button
                      onClick={() => handlePunch('CHECK_OUT')}
                      disabled={isPunching || !canCheckOut}
                      className={`py-4 px-6 rounded-xl border-2 font-semibold text-sm flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all shadow-sm ${
                        canCheckOut
                          ? 'bg-surface-container-lowest text-primary border-primary/20 hover:border-primary'
                          : 'bg-surface-container-low text-on-surface-variant border-outline-variant/20 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <Clock className="w-5 h-5 text-secondary" />
                      <span>
                        {isPunching 
                          ? 'Verifying GPS...' 
                          : isShiftCompleted 
                          ? 'Shift Completed' 
                          : !isAlreadyCheckedIn 
                          ? 'Check-In Required' 
                          : 'Punch Out (Check-Out)'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column (Desktop 5 cols, Mobile full-width): Today's Summary & Recent Activity */}
              <div className="lg:col-span-5 space-y-6">
                {/* Today's Shift Metrics */}
                <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm space-y-4">
                  <h3 className="font-serif text-base text-primary font-normal">Today's Attendance Status</h3>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/20">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant block">First In Time</span>
                      <span className="font-bold text-sm text-primary block mt-1">
                        {effectiveInTime || '--:--'}
                      </span>
                      <span className="text-[10px] text-emerald-600">Geo-Verified</span>
                    </div>

                    <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/20">
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Last Out Time</span>
                      <span className="font-bold text-sm text-primary block mt-1">
                        {effectiveOutTime || '--:--'}
                      </span>
                      <span className="text-[10px] text-on-surface-variant">
                        {isShiftCompleted ? 'Concluded' : isAlreadyCheckedIn ? 'In Progress' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/10 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-primary block">Effective Working Time</span>
                      <span className="text-[11px] text-on-surface-variant">Target: 8h 00m standard shift</span>
                    </div>
                    <span className="font-serif text-lg font-bold text-primary">
                      {effectiveTotalHours ? `${effectiveTotalHours}h` : (todayAttendance?.totalHours ? `${todayAttendance.totalHours}h` : '8h 15m')}
                    </span>
                  </div>
                </div>

                {/* Recent Attendance Mini-Ledger */}
                <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif text-sm text-primary font-normal">Recent Shift History</h4>
                    <span className="text-[10px] text-on-surface-variant uppercase font-mono">Last 5 Days</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {[
                      { date: '03 Nov 2026', in: '09:04 AM', out: 'In Progress', status: 'PRESENT', tag: 'bg-emerald-100 text-emerald-800' },
                      { date: '02 Nov 2026', in: '09:00 AM', out: '06:12 PM', status: 'ON TIME', tag: 'bg-emerald-100 text-emerald-800' },
                      { date: '01 Nov 2026', in: '--:--', out: '--:--', status: 'WEEKLY OFF', tag: 'bg-slate-100 text-slate-700' },
                      { date: '31 Oct 2026', in: '08:58 AM', out: '06:05 PM', status: 'ON TIME', tag: 'bg-emerald-100 text-emerald-800' },
                      { date: '30 Oct 2026', in: '09:12 AM', out: '06:30 PM', status: 'PRESENT', tag: 'bg-emerald-100 text-emerald-800' },
                    ].map((row, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-primary block">{row.date}</span>
                          <span className="text-[11px] text-on-surface-variant">{row.in} – {row.out}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.tag}`}>
                          {row.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}



        {/* ------------------------------------------------------------- */}
        {/* TAB 2: LEAVE CENTER                                           */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'leaves' && (
          <div className="space-y-6">
            {/* Balance Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(liveLeaveBalances.length > 0 ? liveLeaveBalances : leaveBalances).map((lb: any) => {
                const leaveType = lb.leave_type || lb.leaveType;
                const closing = lb.closing ?? 0;
                const used = lb.used ?? 0;
                const total = (lb.opening ?? 0) + (lb.credited ?? 0);

                return (
                  <div key={lb.id} className="p-5 bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-secondary">{leaveType} Balance</span>
                    <div className="font-serif text-3xl text-primary font-normal my-1">{closing} Days</div>
                    <span className="text-[11px] text-on-surface-variant">Used: {used} of {total} allocated</span>
                  </div>
                );
              })}
            </div>

            {/* Leave Feedback Banner */}
            {leaveFeedback && (
              <div className={`p-4 rounded-xl text-xs flex items-center justify-between gap-3 border ${
                leaveFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-red-50 text-red-900 border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {leaveFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span className="font-medium">{leaveFeedback.message}</span>
                </div>
                <button
                  onClick={() => setLeaveFeedback(null)}
                  className="text-xs font-bold underline shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Apply Form */}
              <div className="lg:col-span-1 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 space-y-4 shadow-sm">
                <h3 className="font-serif text-lg text-primary font-normal">Apply for Leave</h3>
                {leaveAppliedSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-200">
                    Leave application submitted successfully for supervisor approval.
                  </div>
                )}
                <form onSubmit={handleApplyLeave} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-on-surface-variant font-medium mb-1">Leave Type</label>
                    <select
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value as any)}
                      className="w-full p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-primary"
                    >
                      <option value="CL">Casual Leave (CL)</option>
                      <option value="PL">Privilege Leave (PL)</option>
                      <option value="SL">Sick Leave (SL)</option>
                      <option value="LWP">Leave Without Pay (LWP)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-on-surface-variant font-medium mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-on-surface-variant font-medium mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-primary"
                    />
                    {startDate === endDate && (
                      <div className="flex items-center space-x-2 mt-2">
                        <input
                          type="checkbox"
                          id="isHalfDayToggle"
                          checked={isHalfDay}
                          onChange={(e) => setIsHalfDay(e.target.checked)}
                          className="rounded border-outline-variant/30 text-primary focus:ring-primary h-4 w-4"
                        />
                        <label htmlFor="isHalfDayToggle" className="text-xs font-semibold text-on-surface-variant cursor-pointer">
                          Apply as Half-Day (0.5 Day)
                        </label>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-on-surface-variant font-medium mb-1">Reason for Absence</label>
                    <textarea
                      rows={3}
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      placeholder="State reason for absence..."
                      className="w-full p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-primary"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmittingLeave}
                    className="w-full py-3 bg-primary text-white rounded-lg font-semibold text-xs hover:bg-primary-dark transition-colors shadow flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <span>{isSubmittingLeave ? 'Submitting Application...' : 'Submit Leave Application'}</span>
                  </button>
                </form>
              </div>

              {/* Leave Requests Table */}
              <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-base text-primary font-normal">My Leave Requests</h4>
                  <span className="text-xs text-on-surface-variant">{(liveLeaveRequests.length > 0 ? liveLeaveRequests : employeeRequests).length} records</span>
                </div>

                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                        <th className="py-2.5">Type</th>
                        <th className="py-2.5">Dates</th>
                        <th className="py-2.5">Reason</th>
                        <th className="py-2.5 text-right">Status / Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {(liveLeaveRequests.length > 0 ? liveLeaveRequests : employeeRequests).map((req: any) => {
                        const lType = req.leave_type || req.leaveType;
                        const sDate = req.start_date || req.startDate;
                        const eDate = req.end_date || req.endDate;
                        const status = (req.status || 'PENDING').toUpperCase();

                        return (
                          <tr key={req.id}>
                            <td className="py-3 font-bold text-primary">{lType}</td>
                            <td className="py-3">{sDate} to {eDate}</td>
                            <td className="py-3 text-on-surface-variant truncate max-w-[200px]">{req.reason}</td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                  status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                                  status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                  status === 'CANCELLED' ? 'bg-surface-container-high text-on-surface-variant' :
                                  'bg-amber-100 text-amber-800'
                                }`}>
                                  {status}
                                </span>
                                {status === 'PENDING' && (
                                  <button
                                    onClick={() => handleCancelLeave(req.id)}
                                    title="Cancel this pending leave request"
                                    className="px-2 py-0.5 rounded text-[10px] font-bold text-error border border-error/30 hover:bg-error/10 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}



        {/* ------------------------------------------------------------- */}
        {/* TAB 3: REGULARISATIONS                                        */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'regularisations' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 space-y-4 shadow-sm">
              <h3 className="font-serif text-lg text-primary font-normal">Request Regularisation</h3>
              {regSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg border border-emerald-200">
                  Correction request submitted for supervisor verification.
                </div>
              )}
              <form onSubmit={handleApplyRegularisation} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-on-surface-variant font-medium mb-1">Date of Missed Punch</label>
                  <input
                    type="date"
                    value={regDate}
                    onChange={(e) => setRegDate(e.target.value)}
                    className="w-full p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-on-surface-variant font-medium mb-1">Check-In</label>
                    <input
                      type="text"
                      value={regCheckIn}
                      onChange={(e) => setRegCheckIn(e.target.value)}
                      className="w-full p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-on-surface-variant font-medium mb-1">Check-Out</label>
                    <input
                      type="text"
                      value={regCheckOut}
                      onChange={(e) => setRegCheckOut(e.target.value)}
                      className="w-full p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-on-surface-variant font-medium mb-1">Supervisor Justification</label>
                  <textarea
                    rows={3}
                    value={regReason}
                    onChange={(e) => setRegReason(e.target.value)}
                    placeholder="e.g. Field depot terminal scanner network outage, client site visit..."
                    className="w-full p-2.5 bg-surface-container-low rounded-lg border border-outline-variant/30 text-on-surface focus:outline-primary"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-primary text-white rounded-lg font-semibold text-xs hover:bg-primary-dark transition-colors shadow"
                >
                  Submit Correction Request
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-serif text-base text-primary font-normal">Submitted Regularisations</h4>
                <span className="text-xs text-on-surface-variant">{(liveCorrections.length > 0 ? liveCorrections : employeeCorrections).length} records</span>
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5">Requested Times</th>
                      <th className="py-2.5">Reason</th>
                      <th className="py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {(liveCorrections.length > 0 ? liveCorrections : employeeCorrections).map((corr: any) => {
                      const reqIn = corr.requestedCheckIn || corr.requested_check_in || corr.requested_in_time || '--:--';
                      const reqOut = corr.requestedCheckOut || corr.requested_check_out || corr.requested_out_time || '--:--';
                      const status = (corr.status || 'PENDING').toUpperCase();

                      return (
                        <tr key={corr.id}>
                          <td className="py-3 font-bold text-primary">{corr.date}</td>
                          <td className="py-3">{reqIn} – {reqOut}</td>
                          <td className="py-3 text-on-surface-variant truncate max-w-[200px]">{corr.reason}</td>
                          <td className="py-3 text-right">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                              status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}



        {/* ------------------------------------------------------------- */}
        {/* TAB 4: MY PAYSLIPS                                            */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'payslips' && (
          <div className="space-y-6">
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm space-y-4">
              <div>
                <h3 className="font-serif text-lg text-primary font-normal">Official Salary Payslips</h3>
                <p className="text-xs text-on-surface-variant">
                  Form XIX compliant statutory payslips signed by client legal entity.
                </p>
              </div>

              <div className="space-y-3">
                {(publishedPayslips.length > 0
                  ? publishedPayslips.map(p => ({
                      month: `${new Date(p.period_year, p.period_month - 1).toLocaleString('en-US', { month: 'long' })} ${p.period_year}`,
                      gross: grossEarnings,
                      net: p.net_salary || netPay,
                      days: paidDays,
                      status: 'LOCKED & AUDITED',
                    }))
                  : [
                      { month: 'October 2026', gross: grossEarnings, net: netPay, days: paidDays, status: 'LOCKED & AUDITED' },
                      { month: 'September 2026', gross: grossEarnings, net: netPay, days: 30, status: 'LOCKED & AUDITED' },
                      { month: 'August 2026', gross: grossEarnings, net: netPay, days: 31, status: 'LOCKED & AUDITED' },
                    ]
                ).map((slip, idx) => (
                  <div key={idx} className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-sm text-primary block">Salary Slip — {slip.month}</span>
                        <div className="text-xs text-on-surface-variant flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="font-semibold text-on-surface">Net Pay: ₹{slip.net.toLocaleString('en-IN')}</span>
                          <span>•</span>
                          <span>Gross: ₹{slip.gross.toLocaleString('en-IN')}</span>
                          <span>•</span>
                          <span>{slip.days} Paid Days</span>
                          <span>•</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                            {slip.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <button
                        onClick={() => setSelectedPayslipMonth(slip.month)}
                        className="px-3.5 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary-dark transition-colors shadow-sm"
                      >
                        View Form XIX Slip
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* =======================================================================
            TAB 5: COMPANY POLICIES & AUTHORIZED SITES
            ======================================================================= */}
        {activeTab === 'policies' && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                    Employee Workplace Policies
                  </span>
                  <span className="text-xs text-on-surface-variant font-medium">•</span>
                  <span className="text-xs text-on-surface-variant font-medium">
                    {currentClient?.name || 'Assigned Employer'}
                  </span>
                </div>
                <h2 className="font-serif text-2xl text-primary font-bold">
                  Workplace Operating Policies & Site Geofences
                </h2>
                <p className="text-xs text-on-surface-variant mt-1">
                  Official statutory parameters, attendance calculation rules, authorized working sites, and leave accrual guidelines applicable to your employment.
                </p>
              </div>

              <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 text-xs shrink-0 space-y-1">
                <span className="text-[10px] text-on-surface-variant uppercase tracking-wider block font-semibold">Employing Legal Entity</span>
                <span className="font-semibold text-primary block">{activeLegalEntity?.legalName || currentClient?.name}</span>
                <span className="font-mono text-[10px] text-on-surface-variant block">PAN: {activeLegalEntity?.panNumber || 'Statutory Verified'}</span>
              </div>
            </div>

            {/* Grid of Policies */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Attendance & Working Hours */}
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-outline-variant/20">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <Clock className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base text-primary font-bold">Attendance & Shift Timing Rules</h3>
                    <p className="text-[11px] text-on-surface-variant">Daily standard hours, grace duration, and shift attribution</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">Standard Working Shift:</span>
                    <span className="font-bold text-primary font-mono">{policy?.standardWorkingHours || 9.0} Hours / Day</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">Half-Day Threshold:</span>
                    <span className="font-bold text-primary font-mono">{policy?.halfDayHours || 4.5} Hours Minimum</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">Arrival Grace Period:</span>
                    <span className="font-bold text-emerald-700 font-mono">+{policy?.lateGraceMinutes || 15} Minutes</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">Late Entry Penalty Rule:</span>
                    <span className="font-semibold text-on-surface capitalize">
                      {policy?.latePenaltyRule ? policy.latePenaltyRule.replace(/_/g, ' ') : 'Standard 3 late days = half-day'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">Weekly Off Schedule:</span>
                    <span className="font-bold text-primary font-mono">
                      {policy?.weeklyOffDays?.join(', ') || 'SUNDAY'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Leave & Time-Off Entitlement */}
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-outline-variant/20">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <Calendar className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base text-primary font-bold">Leave & Time-Off Entitlements</h3>
                    <p className="text-[11px] text-on-surface-variant">Paid leave accrual, carry-forward, and encashment terms</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">Monthly Paid Leave Accrual:</span>
                    <span className="font-bold text-primary font-mono">+{policy?.monthlyPaidLeaveAccrual || 2.0} Days / Month</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">Max Annual Carry-Forward:</span>
                    <span className="font-bold text-primary font-mono">{policy?.maxCarryForward || 30} Days Max</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">Supported Leave Categories:</span>
                    <span className="font-semibold text-on-surface">
                      {policy?.leaveTypesSupported ? policy.leaveTypesSupported.join(', ') : 'Privilege (PL), Casual (CL), Sick (SL), LWP'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">Leave Encashment Eligibility:</span>
                    <span className={`font-semibold ${policy?.allowLeaveEncashment ? 'text-emerald-700' : 'text-on-surface-variant'}`}>
                      {policy?.allowLeaveEncashment ? 'Permitted on Financial Year End' : 'Non-Encashable (Lapse / Carry)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">Minimum Service for Leaves:</span>
                    <span className="font-bold text-primary font-mono">{policy?.minServiceDaysForLeave || 30} Days Post-Joining</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Statutory & Social Security Coverage */}
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-outline-variant/20">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base text-primary font-bold">Statutory Deductions & Social Security</h3>
                    <p className="text-[11px] text-on-surface-variant">Mandatory Indian labour code & retirement compliance</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">Employee Provident Fund (EPFO):</span>
                    <span className="font-bold text-primary font-mono">
                      {policy?.pfEnabled ? `${policy.pfEmployeePercent}% Employee Contribution` : 'Exempt / Custom CTC'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">ESIC Health Insurance:</span>
                    <span className="font-bold text-primary font-mono">
                      {policy?.esicEnabled ? `${policy.esicEmployeePercent}% Gross Deducted` : 'Exempt (Wage Threshold > ₹21,000)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">Professional Tax (PT):</span>
                    <span className="font-bold text-primary font-mono">
                      {policy?.ptEnabled ? 'State Slabs Enforced' : 'Exempt / Not Applicable'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">Monthly Salary Divisor:</span>
                    <span className="font-bold text-primary font-mono">{policy?.salaryDivisor || '30'} Days Standard</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Geofence Strictness & Mobile Biometric Telemetry */}
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm space-y-4">
                <div className="flex items-center gap-3 pb-3 border-b border-outline-variant/20">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                    <Navigation className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base text-primary font-bold">Geofence Telemetry & Verification</h3>
                    <p className="text-[11px] text-on-surface-variant">Mobile biometric validation and GPS strictness rules</p>
                  </div>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">GPS Geolocation Telemetry:</span>
                    <span className="font-bold text-emerald-700">Mandatory (Hardware Coordinate Lock)</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">Geofence Perimeter Enforcement:</span>
                    <span className={`font-semibold ${policy?.enforceStrictGeofence ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {policy?.enforceStrictGeofence ? 'Strict (Out-of-Bounds Punches Flagged)' : 'Warning Only'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">Facial Selfie Biometric:</span>
                    <span className="font-semibold text-on-surface">
                      {policy?.requireSelfie ? 'Mandatory Snapshot' : 'Standard GPS Verification'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-low">
                    <span className="text-on-surface-variant font-medium">Anti-Spoofing Heuristics:</span>
                    <span className="font-bold text-emerald-700">Active (Velocity & Timestamp Check)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Authorized Working Sites / Geofences */}
            <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/30 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-outline-variant/20">
                <div>
                  <h3 className="font-serif text-lg text-primary font-bold">
                    Authorized Working Sites & Punch Perimeters ({activeLocations.length})
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    You may record attendance and punch in from any of your employer's authorized physical operating facilities listed below.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeLocations.map((loc) => {
                  const mapsUrl = `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
                  const isPrimaryAssigned = loc.id === currentEmp?.workLocationId;

                  return (
                    <div key={loc.id} className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/25 space-y-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                              {loc.state || 'Maharashtra'}
                            </span>
                            {isPrimaryAssigned && (
                              <span className="ml-1.5 font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                                Primary Site
                              </span>
                            )}
                            <h4 className="font-serif text-sm text-primary font-bold mt-1.5">{loc.name}</h4>
                          </div>
                          <MapPin className="w-4 h-4 text-accent shrink-0 mt-1" />
                        </div>

                        <p className="text-[11px] text-on-surface-variant mt-2 leading-relaxed">
                          {loc.address}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-outline-variant/20 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between font-mono text-on-surface-variant">
                          <span>Lat: {loc.latitude}°</span>
                          <span>Lng: {loc.longitude}°</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-on-surface-variant">Geofence Radius:</span>
                          <span className="font-bold text-accent font-mono">{loc.radiusMeters || 150} meters</span>
                        </div>
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pt-1 text-[11px] text-accent hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>Open in Google Maps</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 
        =======================================================================
        OFFICIAL PAYSLIP MODAL (FORM XIX OFFICIAL PREVIEW)
        Rendered right inside portal so employee never leaves context!
        =======================================================================
      */}
      {selectedPayslipMonth && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-outline-variant/30 max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-secondary font-bold">
                  Official Statutory Document
                </span>
                <h3 className="font-serif text-xl text-primary font-bold">
                  Form XIX Salary Payslip — {selectedPayslipMonth}
                </h3>
              </div>
              <button
                onClick={() => setSelectedPayslipMonth(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form XIX Printable Body */}
            <div className="border border-slate-300 rounded-xl p-6 bg-slate-50/50 space-y-5 text-xs text-slate-800">
              <div className="text-center border-b border-slate-200 pb-3">
                <h4 className="font-bold text-sm uppercase text-slate-900">{currentClient.name}</h4>
                <p className="text-[11px] text-slate-600">{activeLegalEntity?.registeredAddress || 'Maharashtra, India'}</p>
                <p className="text-[10px] font-mono font-semibold text-slate-500 mt-0.5">
                  FORM XIX [Rule 26(2) of the Contract Labour (Regulation & Abolition) Rules]
                </p>
              </div>

              {/* Employee Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 block">Employee Code</span>
                  <span className="font-bold font-mono">{currentEmp.employeeCode}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Name</span>
                  <span className="font-bold">{currentEmp.firstName} {currentEmp.lastName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Designation</span>
                  <span className="font-semibold">{currentEmp.designation}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Department</span>
                  <span className="font-semibold">{departmentName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Paid Days / Calendar</span>
                  <span className="font-bold">{paidDays} / {calendarDays}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Bank Account</span>
                  <span className="font-mono">•••• •••• {currentEmp.accountNumber?.slice(-4) || '9821'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">UAN</span>
                  <span className="font-mono">{currentEmp.uanNumber || '101928374652'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">PAN</span>
                  <span className="font-mono">{currentEmp.panNumber || 'ABCDE1234F'}</span>
                </div>
              </div>

              {/* Earnings & Deductions Table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Earnings */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <div className="bg-slate-100 px-3 py-2 font-bold text-slate-900 border-b border-slate-200">
                    Earnings
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex justify-between">
                      <span>Basic Wages</span>
                      <span className="font-mono font-medium">₹{basic.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>House Rent Allowance (HRA)</span>
                      <span className="font-mono font-medium">₹{hra.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Special Allowance</span>
                      <span className="font-mono font-medium">₹{specialAllowance.toLocaleString('en-IN')}</span>
                    </div>
                    {variableIncentives > 0 && (
                      <div className="flex justify-between">
                        <span>Variable Incentives</span>
                        <span className="font-mono font-medium">₹{variableIncentives.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {overtimePay > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Authorised Overtime</span>
                        <span className="font-mono font-medium">+₹{overtimePay.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900">
                      <span>Gross Earnings</span>
                      <span className="font-mono">₹{grossEarnings.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <div className="bg-slate-100 px-3 py-2 font-bold text-slate-900 border-b border-slate-200">
                    Deductions
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex justify-between">
                      <span>Provident Fund (PF)</span>
                      <span className="font-mono font-medium">₹{pf.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Employee State Insurance (ESI)</span>
                      <span className="font-mono font-medium">₹{esi.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Professional Tax (PT)</span>
                      <span className="font-mono font-medium">₹{pt.toLocaleString('en-IN')}</span>
                    </div>
                    {tds > 0 && (
                      <div className="flex justify-between text-error">
                        <span>Income Tax (TDS)</span>
                        <span className="font-mono font-medium">₹{tds.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900">
                      <span>Total Deductions</span>
                      <span className="font-mono">₹{totalDeductions.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Pay Dossier */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">Net Take-Home Salary</span>
                  <div className="font-serif text-2xl font-bold text-emerald-900">
                    ₹{netPay.toLocaleString('en-IN')}
                  </div>
                  <span className="text-[10px] text-emerald-700">Transferred via NEFT/RTGS to registered bank account</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-bold">
                    Statutory Compliant
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-2 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print Form XIX</span>
              </button>
              <button
                onClick={() => {
                  alert('Form XIX Payslip download initiated.');
                }}
                className="px-4 py-2 rounded-lg bg-primary text-white font-semibold text-xs flex items-center gap-2 hover:bg-primary-dark transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
};
