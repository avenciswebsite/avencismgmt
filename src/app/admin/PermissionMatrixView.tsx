import React from 'react';
import { 
  ShieldCheck, 
  Check, 
  X, 
  Lock, 
  Building2, 
  Users, 
  FileText, 
  Clock, 
  Calendar,
  AlertTriangle
} from 'lucide-react';

export const PermissionMatrixView: React.FC = () => {
  const permissions = [
    {
      category: 'Multi-Tenant & Client Administration',
      items: [
        { name: 'Onboard & Provision New Client Organisations', superAdmin: true, clientAdmin: false, employee: false, note: 'Global Avencis responsibility only' },
        { name: 'Register Client Legal Entities (Employers of Record)', superAdmin: true, clientAdmin: true, employee: false, note: 'Scoped to assigned client for Client Admin' },
        { name: 'Configure Work Locations & Geofence Polygons', superAdmin: true, clientAdmin: true, employee: false, note: 'Location radius from 50m to 500m' },
        { name: 'Modify 20 Client Policy Domains', superAdmin: true, clientAdmin: true, employee: false, note: 'Strict client-level scope; zero employee overrides' },
      ]
    },
    {
      category: 'Workforce & Employee Master',
      items: [
        { name: 'Onboard Employees & Upload Identity Dossiers', superAdmin: true, clientAdmin: true, employee: false, note: 'Must assign to Client Legal Entity' },
        { name: 'Update Salary CTC & Bank Disbursement Coordinates', superAdmin: true, clientAdmin: true, employee: false, note: 'Audited in governance ledger' },
        { name: 'View Personal Self-Service Profile', superAdmin: true, clientAdmin: true, employee: true, note: 'Read-only for employee' },
      ]
    },
    {
      category: 'Attendance & Geofencing Workflows',
      items: [
        { name: 'Record GPS Mobile Check-In / Check-Out', superAdmin: true, clientAdmin: true, employee: true, note: 'Validated against assigned site geofence' },
        { name: 'Live Supervisor Command Center Monitoring', superAdmin: true, clientAdmin: true, employee: false, note: 'Real-time telemetry and violation alarms' },
        { name: 'Submit Missed Punch Attendance Correction', superAdmin: true, clientAdmin: true, employee: true, note: 'Requires reason and supervisor justification' },
        { name: 'Approve or Reject Attendance Regularisations', superAdmin: true, clientAdmin: true, employee: false, note: 'Overwrites attendance record with audit trail' },
      ]
    },
    {
      category: 'Leave Governance',
      items: [
        { name: 'Apply for Leave (PL, CL, SL, LWP)', superAdmin: true, clientAdmin: true, employee: true, note: 'Validates against live balance ledger' },
        { name: 'Review & Decide Leave Applications', superAdmin: true, clientAdmin: true, employee: false, note: 'Automatically adjusts closing balance' },
        { name: 'Recalculate Annual Entitlement & Carry-Forward', superAdmin: true, clientAdmin: true, employee: false, note: 'Runs in accordance with client policy' },
      ]
    },
    {
      category: 'Payroll & Statutory Compliance',
      items: [
        { name: 'Simulate Guided Payroll Run', superAdmin: true, clientAdmin: true, employee: false, note: 'Gated strictly by 20 configured policy domains' },
        { name: 'Authorize & Lock Final Payroll Run', superAdmin: true, clientAdmin: false, employee: false, note: 'Final statutory sign-off restricted to Super Admin or verified CFO' },
        { name: 'Render Official Form XIX Printable Payslips', superAdmin: true, clientAdmin: true, employee: false, note: 'Rule 26 format under Payment of Wages' },
        { name: 'View & Download Personal Monthly Payslip', superAdmin: true, clientAdmin: true, employee: true, note: 'Delivered digitally via ESS portal' },
      ]
    },
    {
      category: 'Security & Governance',
      items: [
        { name: 'Inspect Immutable Security Audit Ledger', superAdmin: true, clientAdmin: true, employee: false, note: 'Client Admin restricted to own tenant logs' },
        { name: 'Impersonate Personas for System Evaluation', superAdmin: true, clientAdmin: false, employee: false, note: 'Evaluation sandbox testing feature' },
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded bg-primary-container text-primary text-xs font-semibold uppercase tracking-wider">
            RBAC Architecture • Security Tier I
          </span>
        </div>
        <h1 className="font-serif text-3xl text-primary font-normal">
          Enterprise Permission Matrix
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Role-Based Access Control (RBAC) definitions and tenant isolation boundaries across all system capabilities.
        </p>
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-surface-container-lowest rounded-xl border-l-4 border-primary shadow-sm">
          <span className="text-[10px] uppercase font-bold text-secondary tracking-wider block">Role Tier 01</span>
          <h3 className="font-serif text-lg text-primary font-normal mt-0.5">Avencis Global Super Admin</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Unrestricted master authority across all client workspaces, organisation onboarding, and payroll final sealing.
          </p>
        </div>

        <div className="p-5 bg-surface-container-lowest rounded-xl border-l-4 border-secondary shadow-sm">
          <span className="text-[10px] uppercase font-bold text-secondary tracking-wider block">Role Tier 02</span>
          <h3 className="font-serif text-lg text-primary font-normal mt-0.5">Client Workspace Admin</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Scoped strictly to single client tenant. Configures policies, manages employees, decides leaves, and processes payroll.
          </p>
        </div>

        <div className="p-5 bg-surface-container-lowest rounded-xl border-l-4 border-on-tertiary-container shadow-sm">
          <span className="text-[10px] uppercase font-bold text-secondary tracking-wider block">Role Tier 03</span>
          <h3 className="font-serif text-lg text-primary font-normal mt-0.5">Field / Office Employee (ESS)</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Personal self-service only. GPS mobile punches, attendance regularisations, leave applications, and payslip viewing.
          </p>
        </div>
      </div>

      {/* Comprehensive Permission Table */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-container text-on-surface-variant font-semibold border-b border-outline-variant/30">
                <th className="p-4 w-1/2">Capability / Operation</th>
                <th className="p-4 text-center w-1/6 bg-primary/5">Super Admin</th>
                <th className="p-4 text-center w-1/6">Client Admin</th>
                <th className="p-4 text-center w-1/6">Employee (ESS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {permissions.map((group, gIdx) => (
                <React.Fragment key={gIdx}>
                  <tr className="bg-surface-container-low font-bold text-primary">
                    <td colSpan={4} className="p-3 text-[11px] uppercase tracking-wider">
                      {group.category}
                    </td>
                  </tr>
                  {group.items.map((item, iIdx) => (
                    <tr key={iIdx} className="hover:bg-surface-container-low/30">
                      <td className="p-3 pl-6">
                        <span className="font-semibold text-on-surface block">{item.name}</span>
                        <span className="text-[10px] text-on-surface-variant">{item.note}</span>
                      </td>
                      <td className="p-3 text-center bg-primary/5">
                        {item.superAdmin ? (
                          <div className="w-5 h-5 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 bg-surface-container text-outline rounded-full flex items-center justify-center mx-auto">
                            <X className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {item.clientAdmin ? (
                          <div className="w-5 h-5 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 bg-surface-container text-outline rounded-full flex items-center justify-center mx-auto">
                            <X className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {item.employee ? (
                          <div className="w-5 h-5 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-5 h-5 bg-surface-container text-outline rounded-full flex items-center justify-center mx-auto">
                            <X className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
