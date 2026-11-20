import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWorkspace } from '../../context/WorkspaceContext';
import avencisSymbolDarkBg from '@/assets/avencis-symbol-darkbg.png';
import avencisWordmark from '@/assets/avencis-wordmark.png';
import { 
  Building2, 
  MapPin,
  Users, 
  CalendarCheck, 
  FileText, 
  DollarSign, 
  Receipt, 
  Settings, 
  ShieldCheck, 
  BarChart3, 
  Home, 
  Clock, 
  FileCheck2,
  Sliders,
  Sparkles,
  ArrowLeft
} from 'lucide-react';

interface SidebarProps {
  collapsed?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed = false }) => {
  const { currentUser } = useAuth();
  const { activeClient, activeClientId } = useWorkspace();
  const location = useLocation();

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isEmployee = currentUser?.role === 'employee';
  const isInClientWorkspace = location.pathname.startsWith('/workspace');

  if (isEmployee) {
    return (
      <aside className={`${collapsed ? 'w-20' : 'w-64'} bg-primary-dark text-white flex flex-col shrink-0 border-r border-primary-active select-none transition-all duration-200`}>
        {/* Brand Header */}
        <div className={`p-4 border-b border-white/10 ${collapsed ? 'flex flex-col items-center' : ''}`}>
          {collapsed ? (
            <div className="flex items-center justify-center p-1" title="Avencis Portal">
              <img
                src={avencisSymbolDarkBg}
                alt="Avencis"
                className="w-8 h-8 object-contain"
              />
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2.5">
                <img
                  src={avencisSymbolDarkBg}
                  alt="Avencis Symbol"
                  className="h-7 w-auto object-contain shrink-0"
                />
                <img
                  src={avencisWordmark}
                  alt="Avencis"
                  className="h-4.5 w-auto object-contain brightness-0 invert shrink-0"
                />
              </div>
              <div className="mt-2.5 px-0.5 flex items-center justify-between">
                <span className="text-[10px] font-mono tracking-widest uppercase text-white/70 font-semibold">
                  Self-Service Portal
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-accent-light font-bold">
                  Employee
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-b border-white/10 bg-white/5">
          <div className="text-[11px] uppercase tracking-wider text-accent-light font-bold">Assigned Organisation</div>
          <div className="font-semibold text-sm text-white mt-0.5 truncate">{activeClient?.name || 'Client Employee'}</div>
        </div>

        <nav className="p-3 space-y-1 flex-1">
          <NavLink
            to="/portal"
            end
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Home className="w-4 h-4" />
            <span>Employee Home</span>
          </NavLink>

          <NavLink
            to="/portal/punch"
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Clock className="w-4 h-4" />
            <span>Attendance & Punch</span>
          </NavLink>

          <NavLink
            to="/portal/leave"
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <FileText className="w-4 h-4" />
            <span>Leave Requests & Balances</span>
          </NavLink>

          <NavLink
            to="/portal/regularisations"
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Regularisations</span>
          </NavLink>

          <NavLink
            to="/portal/payslips"
            end
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Receipt className="w-4 h-4" />
            <span>My Payslips</span>
          </NavLink>

          <NavLink
            to="/portal/policies"
            end
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Sliders className="w-4 h-4" />
            <span>Company Policies</span>
          </NavLink>
        </nav>
      </aside>
    );
  }

  return (
    <aside className={`${collapsed ? 'w-20' : 'w-64'} bg-primary text-white flex flex-col shrink-0 border-r border-primary-active select-none transition-all duration-200`}>
      {/* Brand Header */}
      <div className={`p-4 border-b border-white/10 ${collapsed ? 'flex flex-col items-center' : ''}`}>
        {collapsed ? (
          <div className="flex items-center justify-center p-1" title="Avencis WFM">
            <img
              src={avencisSymbolDarkBg}
              alt="Avencis"
              className="w-8 h-8 object-contain"
            />
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2.5">
              <img
                src={avencisSymbolDarkBg}
                alt="Avencis Symbol"
                className="h-7 w-auto object-contain shrink-0"
              />
              <img
                src={avencisWordmark}
                alt="Avencis"
                className="h-4.5 w-auto object-contain brightness-0 invert shrink-0"
              />
            </div>
            <div className="mt-2.5 px-0.5 flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/70 font-semibold">
                {isInClientWorkspace ? 'Client Workspace' : 'Master Admin'}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-accent-light font-bold">
                WFM
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Mode Badge & Switcher indicator */}
      {isInClientWorkspace ? (
        <div className="p-3 mx-3 my-2 rounded-lg bg-white/10 border border-white/10">
          <div className="text-[10px] uppercase font-bold tracking-wider text-accent-light flex items-center justify-between">
            <span>Active Client Scope</span>
            <span className="w-2 h-2 rounded-full bg-success"></span>
          </div>
          <div className="font-bold text-sm text-white truncate mt-0.5">{activeClient?.name}</div>
          <div className="text-[11px] text-white/60 mt-0.5">{activeClient?.code} • {activeClient?.employeeCount} Employees</div>

          {isSuperAdmin && (
            <NavLink
              to="/admin"
              className="mt-2 text-[11px] text-accent hover:text-accent-light font-bold flex items-center space-x-1 transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Master Dashboard</span>
            </NavLink>
          )}
        </div>
      ) : (
        <div className="p-3 mx-3 my-2 rounded-lg bg-white/5 border border-white/5">
          <div className="text-[10px] uppercase font-bold tracking-wider text-white/60">Global Platform View</div>
          <div className="text-xs text-white/80 font-medium mt-0.5">Managing All Client Organisations</div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        {isInClientWorkspace ? (
          /* Client Workspace Navigation */
          <>
            <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
              Workspace Operations
            </div>

            <NavLink
              to={`/workspace/${activeClientId}`}
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Home className="w-4 h-4" />
              <span>Client Overview</span>
            </NavLink>

            <NavLink
              to={`/workspace/${activeClientId}/employees`}
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Users className="w-4 h-4" />
              <span>Employees Directory</span>
            </NavLink>

            <NavLink
              to={`/workspace/${activeClientId}/attendance`}
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Attendance Command</span>
            </NavLink>

            <NavLink
              to={`/workspace/${activeClientId}/attendance/regularisations`}
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Clock className="w-4 h-4" />
              <span>Regularisation Queue</span>
            </NavLink>

            <NavLink
              to={`/workspace/${activeClientId}/leave`}
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <FileText className="w-4 h-4" />
              <span>Leave Management</span>
            </NavLink>

            <NavLink
              to={`/workspace/${activeClientId}/payroll`}
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <DollarSign className="w-4 h-4" />
              <span>Payroll Processing</span>
            </NavLink>

            <NavLink
              to={`/workspace/${activeClientId}/payroll/payslips`}
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Receipt className="w-4 h-4" />
              <span>Payslips Archive</span>
            </NavLink>

            <div className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
              Governance & Policies
            </div>

            <NavLink
              to={`/workspace/${activeClientId}/organization`}
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Building2 className="w-4 h-4" />
              <span>Organization Profile</span>
            </NavLink>

            <NavLink
              to={`/workspace/${activeClientId}/locations`}
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <MapPin className="w-4 h-4" />
              <span>Work Locations & Geofence</span>
            </NavLink>

            <NavLink
              to={`/workspace/${activeClientId}/settings`}
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Sliders className="w-4 h-4" />
              <span>Client Policy Engine</span>
            </NavLink>

            <NavLink
              to={`/workspace/${activeClientId}/reports`}
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <BarChart3 className="w-4 h-4" />
              <span>Client Reports</span>
            </NavLink>
          </>
        ) : (
          /* Master Admin Navigation */
          <>
            <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
              Platform Governance
            </div>

            <NavLink
              to="/admin"
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Home className="w-4 h-4" />
              <span>Master Dashboard</span>
            </NavLink>

            <NavLink
              to="/admin/clients"
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Building2 className="w-4 h-4" />
              <span>Clients Directory</span>
            </NavLink>

            <NavLink
              to="/admin/clients/onboard"
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Sparkles className="w-4 h-4 text-accent-light" />
              <span>Onboard New Client</span>
            </NavLink>

            <NavLink
              to="/admin/entities"
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Legal Entities</span>
            </NavLink>

            <NavLink
              to="/admin/locations"
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <MapPin className="w-4 h-4" />
              <span>Work Locations & Geofence</span>
            </NavLink>

            <NavLink
              to="/admin/users"
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Users className="w-4 h-4" />
              <span>Users & Roles</span>
            </NavLink>

            <NavLink
              to="/admin/permissions"
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Sliders className="w-4 h-4" />
              <span>Permission Matrix</span>
            </NavLink>

            <NavLink
              to="/admin/audit"
              end
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-accent text-white shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Security Audit Logs</span>
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer / Mobile View Quick Link */}
      <div className="p-3 border-t border-white/10 bg-white/5">
        <NavLink
          to="/portal"
          className="flex items-center justify-between px-3 py-2 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent-light text-xs font-semibold transition-colors"
        >
          <span className="flex items-center space-x-2">
            <Clock className="w-3.5 h-3.5" />
            <span>Employee Portal</span>
          </span>
          <span className="text-[10px] bg-accent px-1.5 py-0.5 rounded text-white font-bold">ESS</span>
        </NavLink>
      </div>
    </aside>
  );
};
