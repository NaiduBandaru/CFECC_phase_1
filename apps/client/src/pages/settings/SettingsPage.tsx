import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { Settings, ShieldCheck, MessageSquare, Building2, CheckCircle, Database } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [waLogs, setWaLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchWaLogs();
  }, []);

  const fetchWaLogs = async () => {
    try {
      const res = await api.get('/whatsapp/logs');
      if (res.data.success) {
        setWaLogs(res.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-navy-800">System Administration & Configurations</h2>
        <p className="text-xs text-textSecondary mt-0.5">
          Enterprise organization parameters, security roles, audit logs and WhatsApp API dispatch settings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Organization Profile */}
        <div className="bg-surface p-5 rounded-cfecc border border-borderLine shadow-subtle space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-borderLine">
            <Building2 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-navy-800 uppercase">Enterprise Client Details</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-textSecondary block">Client Entity</span>
              <span className="font-bold text-navy-800">CFECC Stores</span>
            </div>
            <div>
              <span className="text-textSecondary block">Facility Location</span>
              <span className="font-semibold text-navy-800">Visakhapatnam, Andhra Pradesh, India</span>
            </div>
            <div>
              <span className="text-textSecondary block">GSTIN Registration</span>
              <span className="font-mono font-semibold text-navy-800">37AAAAA0000A1Z5</span>
            </div>
            <div>
              <span className="text-textSecondary block">Billing Cycle Cutoff</span>
              <span className="font-semibold text-navy-800">25th of every month</span>
            </div>
            <div>
              <span className="text-textSecondary block">Database Engine</span>
              <span className="font-mono font-semibold text-emerald-700">PostgreSQL (Drizzle ORM)</span>
            </div>
          </div>
        </div>

        {/* Middle: Roles & Security */}
        <div className="bg-surface p-5 rounded-cfecc border border-borderLine shadow-subtle space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-borderLine">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-navy-800 uppercase">Configured Enterprise Roles</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded bg-slate-50 border border-borderLine flex justify-between items-center">
              <div>
                <div className="font-bold text-navy-800">Super Administrator</div>
                <div className="text-[11px] text-textSecondary">Full system & security control</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-navy-800 text-white">ALL PERMS</span>
            </div>

            <div className="p-2.5 rounded bg-slate-50 border border-borderLine flex justify-between items-center">
              <div>
                <div className="font-bold text-navy-800">Store Manager</div>
                <div className="text-[11px] text-textSecondary">Inventory, purchases & pricing</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-primary">OPS</span>
            </div>

            <div className="p-2.5 rounded bg-slate-50 border border-borderLine flex justify-between items-center">
              <div>
                <div className="font-bold text-navy-800">POS Cashier</div>
                <div className="text-[11px] text-textSecondary">Point of sale, receipts & customer credit</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">POS</span>
            </div>

            <div className="p-2.5 rounded bg-slate-50 border border-borderLine flex justify-between items-center">
              <div>
                <div className="font-bold text-navy-800">Accounts & HR Payroll</div>
                <div className="text-[11px] text-textSecondary">Billing, statement recovery & payslips</div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">FINANCE</span>
            </div>
          </div>
        </div>

        {/* Right: WhatsApp Integration */}
        <div className="bg-surface p-5 rounded-cfecc border border-borderLine shadow-subtle space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-borderLine">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-navy-800 uppercase">WhatsApp Cloud API Gateway</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-textSecondary block">Gateway Status</span>
              <span className="inline-flex items-center text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Active & Connected
              </span>
            </div>
            <div>
              <span className="text-textSecondary block">Approved Template</span>
              <span className="font-mono font-semibold text-navy-800">cfecc_monthly_statement</span>
            </div>
            <div>
              <span className="text-textSecondary block">Delivery Policy</span>
              <span className="text-textPrimary">Async queue, zero interruption to financial settlement</span>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Message Delivery Audit Logs */}
      <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
        <div className="p-4 border-b border-borderLine flex items-center justify-between">
          <h3 className="text-sm font-bold text-navy-800">WhatsApp Notification & Statement Delivery Logs</h3>
          <span className="text-xs text-textSecondary">{waLogs.length} messages logged</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Message Template</th>
                <th className="py-3 px-4">Reference Document</th>
                <th className="py-3 px-4">Provider Message ID</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {waLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-textSecondary">
                    No WhatsApp notifications dispatched yet. Dispatch statements from the Employee Billing module.
                  </td>
                </tr>
              ) : (
                waLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-navy-800">{log.recipient_name || 'Employee'}</td>
                    <td className="py-3 px-4 font-mono">{log.recipient_phone}</td>
                    <td className="py-3 px-4 font-mono text-textSecondary">{log.template_name}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-navy-800">{log.reference_id}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-textSecondary">{log.provider_message_id}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700">
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-textSecondary">
                      {new Date(log.sent_at || log.created_at).toLocaleString('en-IN')}
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

