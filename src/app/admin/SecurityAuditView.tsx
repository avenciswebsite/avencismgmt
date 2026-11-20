import React, { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { store } from '../../data/store';
import { 
  ShieldAlert, 
  Search, 
  Download, 
  Filter, 
  Lock, 
  AlertTriangle, 
  Info, 
  CheckCircle2,
  Calendar,
  Building2
} from 'lucide-react';

export const SecurityAuditView: React.FC = () => {
  const { clients } = useWorkspace();

  const [selectedClient, setSelectedClient] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const logs = selectedClient === 'ALL' 
    ? store.getAuditLogs() 
    : store.getAuditLogs(selectedClient);

  const filteredLogs = logs.filter(l => {
    const matchesSeverity = selectedSeverity === 'ALL' || l.severity === selectedSeverity;
    const matchesSearch = l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          l.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          l.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          l.targetEntity.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  const handleExportCsv = () => {
    const headers = ['Timestamp', 'Action', 'Target Entity', 'Actor', 'Severity', 'Details'];
    const rows = filteredLogs.map(l => [
      `"${new Date(l.timestamp).toISOString()}"`,
      `"${l.action.replace(/"/g, '""')}"`,
      `"${l.targetEntity.replace(/"/g, '""')}"`,
      `"${l.actorName.replace(/"/g, '""')}"`,
      `"${l.severity}"`,
      `"${l.details.replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `security_audit_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
            Statutory Compliance & System Integrity
          </span>
          <h1 className="font-serif text-3xl text-primary font-normal">
            Security Audit Logs & Governance Ledger
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Tamper-evident, chronologically ordered record of all policy modifications, payroll sealing events, and administrative overrides.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="flex items-center gap-1.5 px-4 py-2 bg-surface-container-lowest text-on-surface border border-outline-variant/30 rounded text-xs font-medium hover:bg-surface-container transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5 text-secondary" />
          <span>Export Ledger (.csv)</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/30 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-outline" />
          <input
            type="text"
            placeholder="Search by action, actor, or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-surface-container-low border border-outline-variant/30 rounded text-xs text-on-surface focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-secondary" />
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="p-1.5 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface text-xs focus:outline-none"
            >
              <option value="ALL">All Organisations ({clients.length})</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-secondary" />
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="p-1.5 bg-surface-container-low rounded border border-outline-variant/30 text-on-surface text-xs focus:outline-none"
            >
              <option value="ALL">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-container text-on-surface-variant font-semibold border-b border-outline-variant/30">
                <th className="p-3">Timestamp & IP</th>
                <th className="p-3">Action Event</th>
                <th className="p-3">Entity Scoped</th>
                <th className="p-3">Actor & Role</th>
                <th className="p-3">Audit Details</th>
                <th className="p-3 text-center">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {filteredLogs.map((log) => {
                const dateStr = new Date(log.timestamp).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });

                return (
                  <tr key={log.id} className="hover:bg-surface-container-low/40">
                    <td className="p-3">
                      <span className="font-mono text-on-surface block font-medium">{dateStr}</span>
                      <span className="font-mono text-[10px] text-on-surface-variant">IP: {log.ipAddress}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-mono font-bold text-primary block">{log.action}</span>
                      <span className="text-[10px] text-on-surface-variant font-mono">{log.id}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-on-surface block">{log.targetEntity}</span>
                      <span className="font-mono text-[10px] text-on-surface-variant truncate max-w-[120px] block">
                        {log.targetId}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold text-on-surface block">{log.actorName}</span>
                      <span className="text-[10px] text-on-surface-variant capitalize">
                        {log.actorRole.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3 max-w-xs text-on-surface leading-relaxed">
                      {log.details}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          log.severity === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : log.severity === 'warning'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {log.severity}
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
  );
};
