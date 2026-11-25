import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Session storage directory
const AUTH_DIR = path.resolve(__dirname, '../../../.data/whatsapp_auth');

export type WhatsAppConnectionStatus = 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED';

class BaileysGatewayService {
  private socket: WASocket | null = null;
  private qrCodeDataUrl: string | null = null;
  private connectionStatus: WhatsAppConnectionStatus = 'DISCONNECTED';
  private connectedPhone: string | null = null;
  private isInitializing: boolean = false;

  constructor() {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
  }

  public getStatus() {
    return {
      status: this.connectionStatus,
      qrCode: this.qrCodeDataUrl,
      phone: this.connectedPhone,
    };
  }

  public async initialize(): Promise<void> {
    if (this.isInitializing || this.connectionStatus === 'CONNECTED') {
      return;
    }

    this.isInitializing = true;
    this.connectionStatus = 'CONNECTING';

    try {
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion();

      this.socket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        syncFullHistory: false,
      });

      this.socket.ev.on('creds.update', saveCreds);

      this.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            this.qrCodeDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
            this.connectionStatus = 'SCAN_QR';
            console.log('[WhatsApp Gateway] 📲 New QR code ready for scanning in Settings.');
          } catch (err) {
            console.error('[WhatsApp Gateway] Error generating QR code image:', err);
          }
        }

        if (connection === 'close') {
          const shouldReconnect =
            (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;

          this.connectionStatus = 'DISCONNECTED';
          this.qrCodeDataUrl = null;
          this.connectedPhone = null;
          this.socket = null;
          this.isInitializing = false;

          console.log(
            `[WhatsApp Gateway] ⚠️ Connection closed. Reason: ${lastDisconnect?.error?.message}. Reconnect: ${shouldReconnect}`
          );

          if (shouldReconnect) {
            setTimeout(() => this.initialize(), 5000);
          }
        } else if (connection === 'open') {
          this.connectionStatus = 'CONNECTED';
          this.qrCodeDataUrl = null;
          this.isInitializing = false;

          const rawJid = this.socket?.user?.id || '';
          this.connectedPhone = rawJid.split(':')[0] || rawJid.split('@')[0];

          console.log(`[WhatsApp Gateway] ✅ Connected successfully as +${this.connectedPhone}!`);
        }
      });
    } catch (err) {
      this.isInitializing = false;
      this.connectionStatus = 'DISCONNECTED';
      console.error('[WhatsApp Gateway Initialization Error]:', err);
    }
  }

  public async logout(): Promise<void> {
    try {
      if (this.socket) {
        await this.socket.logout();
      }
    } catch {
      // Ignore
    } finally {
      this.socket = null;
      this.connectionStatus = 'DISCONNECTED';
      this.qrCodeDataUrl = null;
      this.connectedPhone = null;
      this.isInitializing = false;

      // Clean auth session directory
      if (fs.existsSync(AUTH_DIR)) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      }

      console.log('[WhatsApp Gateway] 🚪 Logged out and session cleared.');
    }
  }

  public async sendMessage(
    recipientPhone: string,
    messageText: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (this.connectionStatus !== 'CONNECTED' || !this.socket) {
      return {
        success: false,
        error: 'WhatsApp Gateway is not connected. Please scan the QR code in Settings.',
      };
    }

    try {
      // Clean phone number (e.g. 919848022338)
      let cleanPhone = recipientPhone.replace(/\D/g, '');
      if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
        cleanPhone = cleanPhone.substring(1);
      }
      if (cleanPhone.length === 10) {
        cleanPhone = `91${cleanPhone}`;
      }

      const jid = `${cleanPhone}@s.whatsapp.net`;

      const result = await this.socket.sendMessage(jid, { text: messageText });
      const messageId = result?.key?.id || `wa_bl_${Date.now()}`;

      return {
        success: true,
        messageId,
      };
    } catch (err: any) {
      console.error('[WhatsApp Gateway Send Error]:', err);
      return {
        success: false,
        error: err.message || 'Failed to dispatch WhatsApp message via Gateway',
      };
    }
  }
}

export const baileysGateway = new BaileysGatewayService();
