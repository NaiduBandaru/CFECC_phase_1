import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api.js';
import { Modal } from '../../components/ui/Modal.js';
import {
  ShieldCheck,
  MessageSquare,
  Building2,
  CheckCircle,
  Settings,
  Send,
  RefreshCw,
  Key,
  Phone,
  AlertCircle,
  Copy,
  ExternalLink,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [waLogs, setWaLogs] = useState<any[]>([]);
  const [waConfig, setWaConfig] = useState<any>(null);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  // WhatsApp Config Modal
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configForm, setConfigForm] = useState({
    phoneNumberId: '',
    accessToken: '',
    businessAccountId: '',
    webhookVerifyToken: 'cfecc_wa_verify_2026',
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // Test Message Modal / State
  const [testPhone, setTestPhone] = useState('');
  const [testNote, setTestNote] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    fetchWaLogs();
    fetchWaConfig();
  }, []);

  const fetchWaLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await api.get('/whatsapp/logs');
      if (res.data.success) {
        setWaLogs(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const fetchWaConfig = async () => {
    try {
      const res = await api.get('/whatsapp/config');
      if (res.data.success) {
        setWaConfig(res.data.data);
        setConfigForm({
          phoneNumberId: res.data.data.phoneNumberId || '',
          accessToken: '',
          businessAccountId: res.data.data.businessAccountId || '',
          webhookVerifyToken: res.data.data.webhookVerifyToken || 'cfecc_wa_verify_2026',
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      const res = await api.post('/whatsapp/config', configForm);
      if (res.data.success) {
        setIsConfigModalOpen(false);
        fetchWaConfig();
        alert('Meta WhatsApp Cloud API credentials updated successfully!');
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update WhatsApp settings');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) return;

    try {
      setSendingTest(true);
      setTestResult(null);
      const res = await api.post('/whatsapp/send-test', {
        phoneNumber: testPhone,
        customNote: testNote || undefined,
      });
      setTestResult({
        success: res.data.success,
        message: res.data.message,
      });
      fetchWaLogs();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.message || 'Failed to dispatch test message',
      });
    } finally {
      setSendingTest(false);
    }
  };

  const copyWebhookUrl = () => {
    const fullUrl = `${window.location.origin}/api/whatsapp/webhook`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'DELIVERED' || s === 'READ') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">{s}</span>;
    }
    if (s === 'SENT') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">SENT</span>;
    }
    if (s === 'SIMULATED') {
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">SIMULATED</span>;
    }
    return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">{s || 'PENDING'}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-800">System Administration & Configurations</h2>
          <p className="text-xs text-textSecondary mt-0.5">
            Enterprise organization parameters, security roles, audit logs and official Meta WhatsApp Cloud API gateway
          </p>
        </div>

        <button
          onClick={() => setIsConfigModalOpen(true)}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-subtle self-start sm:self-auto"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Configure WhatsApp API</span>
        </button>
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
          <div className="flex items-center justify-between pb-2 border-b border-borderLine">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-navy-800 uppercase">Meta WhatsApp Gateway</h3>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                waConfig?.isConfigured
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {waConfig?.isConfigured ? 'LIVE META CLOUD' : 'SIMULATED MODE'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-textSecondary block">Gateway Protocol</span>
              <span className="font-semibold text-navy-800">Meta Graph API {waConfig?.apiVersion || 'v21.0'}</span>
            </div>
            <div>
              <span className="text-textSecondary block">Phone Number ID</span>
              <span className="font-mono text-textPrimary">
                {waConfig?.phoneNumberId || 'Not configured (using fallback sandbox)'}
              </span>
            </div>
            <div>
              <span className="text-textSecondary block">Access Token Status</span>
              <span className="font-mono text-textPrimary">
                {waConfig?.hasAccessToken ? (
                  <span className="text-emerald-700 font-semibold">Active ({waConfig?.maskedAccessToken})</span>
                ) : (
                  <span className="text-amber-700 font-medium">No token set (Click Configure to add)</span>
                )}
              </span>
            </div>
            <div>
              <span className="text-textSecondary block">Approved Templates</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {(waConfig?.approvedTemplates || ['cfecc_monthly_statement', 'cfecc_pos_receipt']).map((t: string) => (
                  <span key={t} className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-textSecondary">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Meta API Test & Diagnostic Console */}
      <div className="bg-surface p-5 rounded-cfecc border border-borderLine shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-borderLine">
          <div>
            <h3 className="text-sm font-bold text-navy-800">Live WhatsApp Cloud API Test Console</h3>
            <p className="text-xs text-textSecondary">Send a live test ping to any recipient mobile number to verify Meta Cloud API connectivity</p>
          </div>
          <div className="flex items-center space-x-2">
            <a
              href="https://developers.facebook.com/apps"
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1 text-xs text-primary hover:underline font-semibold"
            >
              <span>Meta Developer Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <form onSubmit={handleSendTestMessage} className="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs items-end">
          <div className="md:col-span-4">
            <label className="block font-semibold text-textSecondary uppercase mb-1">
              Recipient Mobile Number *
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-2.5 text-textSecondary" />
              <input
                type="text"
                required
                placeholder="e.g. 9848022338 or +919848022338"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="md:col-span-5">
            <label className="block font-semibold text-textSecondary uppercase mb-1">
              Optional Test Note / Message
            </label>
            <input
              type="text"
              placeholder="e.g. Testing CFECC POS receipt dispatch..."
              value={testNote}
              onChange={(e) => setTestNote(e.target.value)}
              className="w-full px-3 py-2 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={sendingTest}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors disabled:opacity-50 shadow-subtle"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sendingTest ? 'Sending Ping...' : 'Send Test Ping'}</span>
            </button>
          </div>
        </form>

        {testResult && (
          <div
            className={`mt-4 p-3 rounded-lg border text-xs flex items-center space-x-2 ${
              testResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {testResult.success ? <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />}
            <span>{testResult.message}</span>
          </div>
        )}
      </div>

      {/* WhatsApp Message Delivery Audit Logs */}
      <div className="bg-surface rounded-cfecc border border-borderLine shadow-subtle overflow-hidden">
        <div className="p-4 border-b border-borderLine flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-navy-800">WhatsApp Notification & Statement Delivery Logs</h3>
            <p className="text-[11px] text-textSecondary">Real-time delivery status reported by Meta Cloud API Webhook</p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchWaLogs}
              disabled={loadingLogs}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-borderLine text-xs font-semibold text-textSecondary hover:text-navy-800 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
              <span>Refresh Logs</span>
            </button>
            <span className="text-xs text-textSecondary bg-slate-100 px-2.5 py-1 rounded-full font-semibold">
              {waLogs.length} total messages
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-borderLine text-[11px] font-bold text-textSecondary uppercase tracking-wider">
                <th className="py-3 px-4">Recipient</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Message Type</th>
                <th className="py-3 px-4">Reference Document</th>
                <th className="py-3 px-4">Provider Message ID</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderLine">
              {waLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-textSecondary">
                    No WhatsApp notifications logged yet. Dispatches will appear here automatically.
                  </td>
                </tr>
              ) : (
                waLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-navy-800">{log.recipient_name || 'Valued Customer'}</td>
                    <td className="py-3 px-4 font-mono">{log.recipient_phone}</td>
                    <td className="py-3 px-4 font-mono text-textSecondary">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-semibold">
                        {log.message_type || log.template_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-navy-800">{log.reference_id || 'N/A'}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-textSecondary">
                      {log.provider_message_id || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="py-3 px-4 text-textSecondary whitespace-nowrap">
                      {new Date(log.sent_at || log.created_at).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Meta WhatsApp Cloud API Configuration Modal */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title="Meta WhatsApp Cloud API Configuration"
      >
        <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 space-y-1">
            <div className="font-bold flex items-center space-x-1.5">
              <Key className="w-4 h-4 text-primary" />
              <span>Official Meta Developer Portal Credentials</span>
            </div>
            <p className="text-[11px] text-blue-800">
              Get your Phone Number ID and Permanent Access Token from{' '}
              <a
                href="https://developers.facebook.com"
                target="_blank"
                rel="noreferrer"
                className="underline font-semibold"
              >
                developers.facebook.com
              </a>{' '}
              under your WhatsApp App $\rightarrow$ API Setup.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">
              WhatsApp Phone Number ID *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 104859392817281"
              value={configForm.phoneNumberId}
              onChange={(e) => setConfigForm({ ...configForm, phoneNumberId: e.target.value })}
              className="w-full px-3 py-2 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">
              System User / Permanent Access Token *
            </label>
            <textarea
              rows={3}
              placeholder={waConfig?.hasAccessToken ? '(Token is currently set. Enter new token to change)' : 'Paste EAAB... token from Meta'}
              value={configForm.accessToken}
              onChange={(e) => setConfigForm({ ...configForm, accessToken: e.target.value })}
              className="w-full px-3 py-2 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-mono text-[11px]"
            />
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">
              WhatsApp Business Account ID (WABA ID)
            </label>
            <input
              type="text"
              placeholder="e.g. 109283746591023"
              value={configForm.businessAccountId}
              onChange={(e) => setConfigForm({ ...configForm, businessAccountId: e.target.value })}
              className="w-full px-3 py-2 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-textSecondary uppercase mb-1">
              Webhook Verification Secret Token
            </label>
            <input
              type="text"
              value={configForm.webhookVerifyToken}
              onChange={(e) => setConfigForm({ ...configForm, webhookVerifyToken: e.target.value })}
              className="w-full px-3 py-2 border border-borderLine rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-mono"
            />
          </div>

          {/* Webhook Callback URL Copy Box */}
          <div className="p-3 bg-slate-50 border border-borderLine rounded-lg">
            <span className="block font-semibold text-textSecondary uppercase text-[11px] mb-1">
              Your Webhook Callback URL (Paste in Meta Portal):
            </span>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/api/whatsapp/webhook`}
                className="w-full px-2.5 py-1.5 border border-borderLine rounded bg-white text-[11px] font-mono text-textPrimary"
              />
              <button
                type="button"
                onClick={copyWebhookUrl}
                className="flex items-center space-x-1 px-3 py-1.5 rounded bg-surface border border-borderLine font-semibold hover:bg-slate-100 text-textSecondary text-[11px]"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedWebhook ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-borderLine">
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(false)}
              className="px-4 py-2 font-semibold text-textSecondary hover:text-textPrimary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingConfig}
              className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white font-semibold transition-all shadow-subtle disabled:opacity-50"
            >
              {savingConfig ? 'Saving...' : 'Save Meta API Credentials'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
