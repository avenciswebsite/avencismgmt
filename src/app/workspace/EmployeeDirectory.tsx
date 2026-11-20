import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useAuth } from '../../context/AuthContext';
import { employeeService } from '../../services/employeeService';
import { policyService } from '../../services/policyService';
import { 
  EmployeeRow, 
  DepartmentRow, 
  WorkLocationRow, 
  SalaryStructureRow 
} from '../../services/serviceTypes';
import { store } from '../../data/store';
import { isMockMode } from '../../services/serviceConfig';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  MapPin, 
  Building2, 
  Mail, 
  Phone, 
  ChevronRight,
  Download,
  CreditCard,
  AlertCircle,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';

export const EmployeeDirectory: React.FC = () => {
  const { clientId: routeClientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { activeClient, activeClientId, refreshWorkspace } = useWorkspace();
  const { currentUser } = useAuth();

  const effectiveClientId = routeClientId || activeClientId || activeClient?.id;

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [locations, setLocations] = useState<WorkLocationRow[]>([]);
  const [salaryMap, setSalaryMap] = useState<Record<string, SalaryStructureRow>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('ALL');
  const [selectedLoc, setSelectedLoc] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Security Gate: Check if caller is authorized to view sensitive compensation CTC
  const canViewCompensation = currentUser && ['super_admin', 'client_admin', 'payroll_admin'].includes(currentUser.role);
  const canOnboard = currentUser && ['super_admin', 'client_admin', 'hr_admin'].includes(currentUser.role);

  const userRole = currentUser?.role;
  const userClientId = currentUser?.clientId || effectiveClientId;
  const userEmpId = currentUser?.employeeId;

  const callerScope = useMemo(() => ({
    role: userRole,
    clientId: userClientId,
    employeeId: userEmpId,
  }), [userRole, userClientId, userEmpId]);

  const loadData = useCallback(async () => {
    if (!effectiveClientId) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      // 1. Fetch departments and locations in parallel
      const [deptRes, locRes] = await Promise.all([
        policyService.getDepartments(effectiveClientId),
        policyService.getWorkLocations(effectiveClientId),
      ]);

      if (deptRes.success && deptRes.data) {
        setDepartments(deptRes.data);
      }
      if (locRes.success && locRes.data) {
        setLocations(locRes.data);
      }

      // 2. Fetch employees scoped to client and caller role
      const empRes = await employeeService.getEmployees(
        {
          clientId: effectiveClientId,
          workLocationId: selectedLoc !== 'ALL' ? selectedLoc : undefined,
          departmentId: selectedDept !== 'ALL' ? selectedDept : undefined,
          status: selectedStatus !== 'ALL' ? (selectedStatus as any) : undefined,
          searchQuery: searchTerm.trim() || undefined,
        },
        callerScope
      );

      if (!empRes.success) {
        setErrorMsg(empRes.error?.message || 'Failed to load employee records.');
        setEmployees([]);
        setIsLoading(false);
        return;
      }

      const loadedEmployees = empRes.data || [];
      setEmployees(loadedEmployees);

      // 3. If caller is authorized for compensation, fetch active salary structures
      if (canViewCompensation && loadedEmployees.length > 0) {
        const salEntries: Record<string, SalaryStructureRow> = {};
        // Fetch structures in parallel batches
        await Promise.all(
          loadedEmployees.slice(0, 30).map(async (emp) => {
            const salRes = await employeeService.getSalaryStructure(emp.id, callerScope);
            if (salRes.success && salRes.data) {
              salEntries[emp.id] = salRes.data;
            }
          })
        );
        setSalaryMap(salEntries);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred while fetching directory data.');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveClientId, selectedDept, selectedLoc, selectedStatus, searchTerm, canViewCompensation]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const clientName = activeClient?.name || 'Selected Client';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-surface-container-high">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-accent font-sans">
            Workforce Management
          </div>
          <h1 className="text-2xl font-serif font-bold text-primary">Employees Directory</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Active staff members deployed under <strong>{clientName}</strong> legal entities.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => loadData()}
            disabled={isLoading}
            className="p-2.5 rounded-lg border border-surface-container-high hover:bg-surface-container-low text-on-surface-variant transition-colors"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-accent' : ''}`} />
          </button>

          {canOnboard && (
            <button
              onClick={() => navigate(effectiveClientId ? `/workspace/${effectiveClientId}/employees/new` : '/workspace/employees/add')}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Onboard New Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 bg-error/10 border border-error/30 rounded-xl flex items-center justify-between text-xs text-error">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
          <button
            onClick={() => loadData()}
            className="px-3 py-1 bg-error text-white font-bold rounded-lg text-xs hover:bg-error/90 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest p-4 rounded-xl border border-surface-container-high shadow-card flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-3.5 h-3.5 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by name, ID code, designation..."
            className="w-full pl-9 pr-3 py-2 bg-surface-container-low rounded-lg border border-transparent focus:border-primary/20 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center space-x-2">
            <span className="text-on-surface-variant font-medium">Department:</span>
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="px-2.5 py-1.5 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
            >
              <option value="ALL">All Departments ({departments.length})</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-on-surface-variant font-medium">Work Site:</span>
            <select
              value={selectedLoc}
              onChange={e => setSelectedLoc(e.target.value)}
              className="px-2.5 py-1.5 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
            >
              <option value="ALL">All Locations ({locations.length})</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-on-surface-variant font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-surface-container-low rounded-lg border border-surface-container-high font-semibold text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_NOTICE">On Notice</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Employee Master Table */}
      <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container-low text-on-surface-variant uppercase font-bold text-[10px] border-b border-surface-container-high">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Designation & Department</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Fixed Monthly Base</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {isLoading ? (
                // Shimmer Loading Skeletons
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-surface-container-high" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-28 bg-surface-container-high rounded" />
                          <div className="h-2 w-20 bg-surface-container-high rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-3 w-24 bg-surface-container-high rounded mb-1" />
                      <div className="h-2 w-16 bg-surface-container-high rounded" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-3 w-20 bg-surface-container-high rounded" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-3 w-16 bg-surface-container-high rounded" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-3 w-28 bg-surface-container-high rounded mb-1" />
                      <div className="h-2 w-20 bg-surface-container-high rounded" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 w-12 bg-surface-container-high rounded-full" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="h-4 w-4 bg-surface-container-high rounded ml-auto" />
                    </td>
                  </tr>
                ))
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-on-surface-variant">
                    <Users className="w-8 h-8 text-on-surface-variant/40 mx-auto mb-2" />
                    <p className="font-semibold text-sm text-on-surface">No employees found.</p>
                    <p className="text-xs mt-1">Try adjusting your filters or search keywords.</p>
                    {(selectedDept !== 'ALL' || selectedLoc !== 'ALL' || selectedStatus !== 'ALL' || searchTerm) && (
                      <button
                        onClick={() => {
                          setSelectedDept('ALL');
                          setSelectedLoc('ALL');
                          setSelectedStatus('ALL');
                          setSearchTerm('');
                        }}
                        className="mt-3 px-3 py-1.5 rounded-lg bg-surface-container-high text-primary font-bold text-xs hover:bg-surface-container-highest transition-colors"
                      >
                        Clear All Filters
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                employees.map(emp => {
                  const loc = locations.find(l => l.id === emp.work_location_id);
                  const dept = departments.find(d => d.id === emp.department_id);
                  const sal = salaryMap[emp.id];

                  // Status badge styling
                  let statusColor = 'bg-success/10 text-success border-success/20';
                  if (emp.status === 'ON_NOTICE') statusColor = 'bg-amber-100 text-amber-800 border-amber-300';
                  if (emp.status === 'SUSPENDED') statusColor = 'bg-error/10 text-error border-error/20';
                  if (emp.status === 'TERMINATED') statusColor = 'bg-surface-container-high text-on-surface-variant border-surface-container-highest';

                  const destinationUrl = effectiveClientId 
                    ? `/workspace/${effectiveClientId}/employees/${emp.id}`
                    : `/workspace/employees/${emp.id}`;

                  return (
                    <tr 
                      key={emp.id} 
                      className="hover:bg-surface-container-low/60 transition-colors cursor-pointer"
                      onClick={() => navigate(destinationUrl)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <img
                            src={emp.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=100'}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover border border-surface-container-highest"
                          />
                          <div>
                            <div className="font-bold text-primary text-sm">
                              {emp.first_name} {emp.last_name}
                            </div>
                            <div className="text-[10px] text-on-surface-variant font-mono">
                              ID: {emp.employee_code} • Joined {emp.joining_date}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-on-surface">{emp.designation}</div>
                        <div className="text-[10px] text-on-surface-variant flex items-center space-x-1">
                          <span>{dept?.name || 'General Operations'}</span>
                          <span>•</span>
                          <span className="font-mono text-[9px] uppercase text-accent font-semibold">
                            {emp.employment_arrangement.replace('_', ' ')}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1 text-on-surface">
                          <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
                          <span className="truncate max-w-[160px]">{loc?.name || 'Assigned Site'}</span>
                        </div>
                      </td>

                      {/* Financial Compensation Gate */}
                      <td className="py-3 px-4">
                        {canViewCompensation ? (
                          sal ? (
                            <div>
                              <div className="font-mono font-bold text-primary">
                                ₹{sal.fixed_monthly_base.toLocaleString('en-IN')}
                              </div>
                              <div className="text-[10px] text-on-surface-variant">
                                + ₹{(sal.variable_incentives || 0).toLocaleString('en-IN')} Incentive
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] font-mono text-on-surface-variant italic">
                              Pending Setup
                            </span>
                          )
                        ) : (
                          <div>
                            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-[10px] font-semibold flex items-center space-x-1 w-fit">
                              <ShieldAlert className="w-3 h-3 text-on-surface-variant" />
                              <span>Restricted CTC</span>
                            </span>
                            <span className="text-[9px] text-on-surface-variant block mt-0.5">
                              Confidential
                            </span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-[11px] text-on-surface-variant space-y-0.5">
                        <div className="flex items-center space-x-1">
                          <Mail className="w-3 h-3 text-on-surface-variant" />
                          <span className="truncate max-w-[140px]">{emp.email}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Phone className="w-3 h-3 text-on-surface-variant" />
                          <span>{emp.mobile}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusColor}`}>
                          {emp.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className="p-1 rounded-lg text-primary hover:bg-surface-container-high transition-colors inline-block">
                          <ChevronRight className="w-4 h-4" />
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
