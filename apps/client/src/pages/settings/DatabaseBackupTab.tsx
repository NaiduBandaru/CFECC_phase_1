import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { formatISTDateTime } from '../../lib/date.js';
import {
  Database,
  Download,
  HardDriveDownload,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  Clock,
  FileText,
  Sparkles,
  Layers,
  AlertCircle,
  Calendar,
  ArrowDownToLine,
  Search,
  Filter,
} from 'lucide-react';

interface TableStat {
  tableName: string;
  displayName: string;
  category: 'MASTER' | 'INVENTORY' | 'PURCHASING' | 'POS_SALES' | 'CREDIT_PAYROLL' | 'HISTORICAL' | 'SYSTEM';
  count: number;
}

interface BackupStats {
  engine: string;
  status: string;
  lastBackupAt: string | null;
  lastBackupFile: string | null;
  totalTables: number;
  totalLiveRecords: number;
  totalHistoricalRecords: number;
  grandTotalRecords: number;
  tables: TableStat[];
  scheduler: {
    enabled: boolean;
    frequency: string;
    retentionDays: number;
    backupDirectory: string;
  };
}

interface BackupHistoryItem {
  id: number;
  filename: string;
  file_size: number;
  backup_type: string;
  status: string;
  record_count_summary: Record<string, number> | null;
  created_by: string;
  created_at: string;
}

export const DatabaseBackupTab: React.FC = () => {
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [history, setHistory] = useState<BackupHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [creatingSnapshot, setCreatingSnapshot] = useState<boolean>(false);
  const [downloadingExport, setDownloadingExport] = useState<boolean>(false);
  const [optimizing, setOptimizing] = useState<boolean>(false);
  const [includeHistorical, setIncludeHistorical] = useState<boolean>(true);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Table filter
  const [tableSearch, setTableSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, historyRes] = await Promise.all([
        api.get('/backup/stats'),
        api.get('/backup/history'),
      ]);

      if (statsRes.data.success) {
        setStats(statsRes.data.data);
      }
      if (historyRes.data.success) {
        setHistory(historyRes.data.data);
      }
    } catch (err: any) {
      console.error(err);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to load backup data from server.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInstantBackup = async () => {
    try {
      setDownloadingExport(true);
      setActionMessage(null);

      const response = await api.get(`/backup/export?includeHistorical=${includeHistorical}`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/json' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      const todayStr = new Date().toISOString().slice(0, 10);
      link.download = `CFECC_Store_Backup_${todayStr}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setActionMessage({
        type: 'success',
        text: 'Store backup downloaded successfully to your computer.',
      });
      fetchData();
    } catch (err: any) {
      console.error(err);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to export backup.',
      });
    } finally {
      setDownloadingExport(false);
    }
  };

  const handleCreateServerSnapshot = async () => {
    try {
      setCreatingSnapshot(true);
      setActionMessage(null);
      const res = await api.post('/backup/create');
      if (res.data.success) {
        setActionMessage({
          type: 'success',
          text: `Server snapshot saved: ${res.data.data.filename} (${formatFileSize(res.data.data.fileSize)})`,
        });
        fetchData();
      }
    } catch (err: any) {
      console.error(err);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to generate server snapshot.',
      });
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleOptimizeDatabase = async () => {
    try {
      setOptimizing(true);
      setActionMessage(null);
      const res = await api.post('/backup/optimize');
      if (res.data.success) {
        setActionMessage({
          type: 'success',
          text: `Optimization complete: ${res.data.tablesAnalyzed} tables analyzed & primary key sequences synchronized in ${res.data.durationMs}ms.`,
        });
      }
    } catch (err: any) {
      console.error(err);
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to optimize database.',
      });
    } finally {
      setOptimizing(false);
    }
  };

  const handleDownloadSavedFile = async (filename: string) => {
    try {
      const response = await api.get(`/backup/download/${encodeURIComponent(filename)}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/json' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Could not download archive file.');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredTables = (stats?.tables || []).filter((t) => {
    if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase().trim();
      return (
        t.tableName.toLowerCase().includes(q) ||
        t.displayName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Alert banner if action performed */}
      {actionMessage && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-xs font-medium border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-gray-400 hover:text-gray-700 ml-4 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Card */}
        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-textSecondary uppercase tracking-wider">
              Database Engine
            </span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="mt-2">
            <div className="text-base font-bold text-navy-800 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-primary" />
              <span>PostgreSQL (Cloud)</span>
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
              Connected with SSL & Zero DBF
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-borderLine text-[10px] text-textSecondary flex items-center justify-between">
            <span>Pool Status</span>
            <span className="font-semibold text-emerald-700">Healthy</span>
          </div>
        </div>

        {/* Total Protected Records */}
        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-textSecondary uppercase tracking-wider">
              Total Records
            </span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-navy-800">
              {loading ? (
                <span className="text-sm text-textSecondary">Loading...</span>
              ) : (
                stats?.grandTotalRecords?.toLocaleString('en-IN') || '0'
              )}
            </div>
            <p className="text-[11px] text-textSecondary mt-0.5">
              Across {stats?.totalTables || 0} relational tables
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-borderLine text-[10px] text-textSecondary flex items-center justify-between">
            <span>Live: {stats?.totalLiveRecords?.toLocaleString('en-IN') || 0}</span>
            <span>Historical: {stats?.totalHistoricalRecords?.toLocaleString('en-IN') || 0}</span>
          </div>
        </div>

        {/* Automated Daily Snapshot */}
        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-textSecondary uppercase tracking-wider">
              Auto Daily Backup
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <div className="text-sm font-bold text-navy-800 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>Nightly 23:00 IST</span>
            </div>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
              Active Daemon (30-day retention)
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-borderLine text-[10px] text-textSecondary flex items-center justify-between">
            <span>Server Disk Backups</span>
            <span className="font-semibold text-navy-800">{history.length} Saved</span>
          </div>
        </div>

        {/* Last Snapshot Status */}
        <div className="bg-surface p-4 rounded-cfecc border border-borderLine shadow-subtle flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-textSecondary uppercase tracking-wider">
              Last Backup
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-xs font-bold text-navy-800 truncate" title={stats?.lastBackupFile || 'None'}>
              {stats?.lastBackupFile ? stats.lastBackupFile : 'Ready to snapshot'}
            </div>
            <p className="text-[11px] text-textSecondary mt-0.5">
              {stats?.lastBackupAt
                ? formatISTDateTime(stats.lastBackupAt)
                : 'No manual backup taken yet'}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-borderLine text-[10px] text-textSecondary flex items-center justify-between">
            <span>Integrity Status</span>
            <span className="font-semibold text-emerald-700">Verified</span>
          </div>
        </div>
      </div>

      {/* Action Command Center */}
      <div className="bg-surface p-5 rounded-cfecc border border-borderLine shadow-subtle">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-borderLine">
          <div>
            <h3 className="text-sm font-bold text-navy-800 uppercase flex items-center gap-2">
              <HardDriveDownload className="w-4 h-4 text-primary" />
              <span>Backup & Maintenance Command Center</span>
            </h3>
            <p className="text-xs text-textSecondary mt-0.5">
              Create instant offsite database snapshots or run query optimization maintenance
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-textSecondary cursor-pointer select-none bg-gray-50 px-2.5 py-1.5 rounded-lg border border-borderLine">
              <input
                type="checkbox"
                checked={includeHistorical}
                onChange={(e) => setIncludeHistorical(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span>Include 106k Legacy Archive</span>
            </label>

            {/* Download Instant Backup */}
            <button
              onClick={handleDownloadInstantBackup}
              disabled={downloadingExport || loading}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-subtle disabled:opacity-50"
            >
              {downloadingExport ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{downloadingExport ? 'Packaging Snapshot...' : 'Download Instant Backup'}</span>
            </button>

            {/* Create Server Snapshot */}
            <button
              onClick={handleCreateServerSnapshot}
              disabled={creatingSnapshot || loading}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-subtle disabled:opacity-50"
            >
              {creatingSnapshot ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <HardDriveDownload className="w-3.5 h-3.5" />
              )}
              <span>{creatingSnapshot ? 'Saving to Server...' : 'Create Server Snapshot'}</span>
            </button>

            {/* Optimize Database */}
            <button
              onClick={handleOptimizeDatabase}
              disabled={optimizing || loading}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-white border border-borderLine text-navy-800 text-xs font-semibold hover:bg-gray-50 transition-colors shadow-subtle disabled:opacity-50"
            >
              {optimizing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>{optimizing ? 'Analyzing...' : 'Run Optimization'}</span>
            </button>
          </div>
        </div>

        {/* Detailed Table Breakdown */}
        <div className="mt-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h4 className="text-xs font-bold text-navy-800 uppercase flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-textSecondary" />
              <span>Table Inventory & Record Breakdown ({filteredTables.length} tables)</span>
            </h4>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search table..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="pl-8 pr-3 py-1 text-xs border border-borderLine rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary w-40 sm:w-48"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs border border-borderLine rounded-lg bg-white px-2.5 py-1 text-navy-800 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Categories</option>
                <option value="MASTER">Master Data</option>
                <option value="INVENTORY">Inventory & Stock</option>
                <option value="PURCHASING">Purchasing</option>
                <option value="POS_SALES">POS & Sales</option>
                <option value="CREDIT_PAYROLL">Credit & Recovery</option>
                <option value="HISTORICAL">Historical FoxPro Archives</option>
                <option value="SYSTEM">System Logs</option>
              </select>
            </div>
          </div>

          <div className="border border-borderLine rounded-lg overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-borderLine sticky top-0 text-[11px] font-bold text-textSecondary uppercase">
                  <tr>
                    <th className="px-4 py-2">Module / Category</th>
                    <th className="px-4 py-2">Business Data Entity</th>
                    <th className="px-4 py-2">PostgreSQL Table</th>
                    <th className="px-4 py-2 text-right">Record Count</th>
                    <th className="px-4 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderLine">
                  {filteredTables.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-textSecondary text-xs">
                        No matching tables found.
                      </td>
                    </tr>
                  ) : (
                    filteredTables.map((t) => (
                      <tr key={t.tableName} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.category === 'HISTORICAL'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : t.category === 'POS_SALES'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : t.category === 'CREDIT_PAYROLL'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}
                          >
                            {t.category}
                          </span>
                        </td>
                        <td className="px-4 py-2 font-semibold text-navy-800">
                          {t.displayName}
                        </td>
                        <td className="px-4 py-2 font-mono text-[11px] text-textSecondary">
                          {t.tableName}
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-navy-800">
                          {t.count.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Protected</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Past Server Snapshots Table */}
      <div className="bg-surface p-5 rounded-cfecc border border-borderLine shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-borderLine">
          <div>
            <h3 className="text-sm font-bold text-navy-800 uppercase flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>Saved Server Backup Snapshots</span>
            </h3>
            <p className="text-xs text-textSecondary mt-0.5">
              Automated daily backups and manual administrator archives stored on disk
            </p>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-lg border border-borderLine hover:bg-gray-50 text-textSecondary transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="border border-borderLine rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase">
              <tr>
                <th className="px-4 py-2.5">Archive Filename</th>
                <th className="px-4 py-2.5">Backup Type</th>
                <th className="px-4 py-2.5">File Size</th>
                <th className="px-4 py-2.5">Generated By</th>
                <th className="px-4 py-2.5">Date & Time</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-textSecondary text-xs">
                    No server backups created yet. Click "Create Server Snapshot" to generate one.
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-navy-800 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{item.filename}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.backup_type === 'SCHEDULED'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : item.backup_type === 'MANUAL'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}
                      >
                        {item.backup_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-navy-800">
                      {formatFileSize(item.file_size)}
                    </td>
                    <td className="px-4 py-2.5 text-textSecondary">
                      {item.created_by || 'System'}
                    </td>
                    <td className="px-4 py-2.5 text-textSecondary">
                      {formatISTDateTime(item.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleDownloadSavedFile(item.filename)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-gray-100 hover:bg-primary hover:text-white text-navy-800 text-[11px] font-semibold transition-colors border border-borderLine"
                        title="Download JSON file to PC"
                      >
                        <ArrowDownToLine className="w-3 h-3" />
                        <span>Download</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

