# CFECC Dedicated PostgreSQL Server & Production Deployment Guide
**Coromandel Fertilisers Employees Co-operative Consumers Society Ltd. (CFECC)**
*Regd No: B-1463 • Visakhapatnam, Andhra Pradesh*

---

## 1. Executive Summary & Architecture Blueprint

This document details the complete end-to-end setup for running the CFECC Stores Management System on a **Dedicated On-Premise Store Server** powered by **PostgreSQL 16**.

### Network Topology

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 DEDICATED SERVER PC                    │
                  │             Static Local IP: 192.168.1.100             │
                  │                                                        │
                  │  ┌───────────────────────┐   ┌──────────────────────┐  │
                  │  │ PostgreSQL Database   │◄──┤ CFECC Backend API    │  │
                  │  │ Port 5432 (cfecc_db)  │   │ Node.js Service:5000 │  │
                  │  └───────────────────────┘   └──────────▲───────────┘  │
                  │                                         │              │
                  │  ┌──────────────────────────────────────┴───────────┐  │
                  │  │ CFECC Web Client / POS Host (Port 3000 / 80)     │  │
                  │  └──────────────────────▲───────────────────────────┘  │
                  └─────────────────────────┼──────────────────────────────┘
                                            │ Gigabit Local Switch / Router
        ┌───────────────────────────────────┼────────────────────────────────────┐
        ▼                                   ▼                                    ▼
 ┌──────────────┐                    ┌──────────────┐                     ┌──────────────┐
 │  COUNTER 1   │                    │  COUNTER 2   │                     │ MANAGER PC   │
 │ POS Terminal │                    │ POS Terminal │                     │ Back-Office  │
 │ USB Barcode  │                    │ USB Barcode  │                     │ Reports & HR │
 │ Thermal 80mm │                    │ Thermal 80mm │                     │ Admin Ops    │
 └──────────────┘                    └──────────────┘                     └──────────────┘
```

---

## 2. Hardware & Infrastructure Checklist

### Dedicated Server PC Specifications
* **CPU**: Intel Core i5 (10th/11th Gen+) or AMD Ryzen 5 (4+ Cores).
* **RAM**: 16 GB DDR4/DDR5 (Allows PostgreSQL memory buffering and fast indexing).
* **Storage**: 512 GB NVMe M.2 SSD (Ensures <5ms barcode item lookups).
* **Networking**: Gigabit Ethernet port plugged via CAT6 cable directly into the main store network switch/router.
* **Power Supply (Mandatory)**: 600 VA to 1000 VA Line-Interactive UPS to protect against sudden power failure and preserve uncommitted transactions.
* **Operating System**: Windows 11 Pro / Windows 10 Pro (or Ubuntu Server 22.04 LTS).

### Network Configuration (Static Local IP)
Assign a static local IP to the dedicated server so counter terminals never lose connection:
* **IP Address**: `192.168.1.100` (or `192.168.0.100` depending on your router subnet)
* **Subnet Mask**: `255.255.255.0`
* **Default Gateway**: `192.168.1.1`
* **DNS**: `8.8.8.8`, `1.1.1.1`

---

## 3. Step-by-Step PostgreSQL 16 Installation & Tuning

### Step 1: Install PostgreSQL
1. Download **PostgreSQL 16** for Windows from [EnterpriseDB / PostgreSQL Official](https://www.postgresql.org/download/windows/).
2. Run installer. Default directory: `C:\Program Files\PostgreSQL\16`.
3. Set password for user `postgres`: e.g. `CfeccDb@2026`.
4. Leave port as `5432`.
5. Complete installation (uncheck Stack Builder at the end).

### Step 2: Configure `postgresql.conf` for Local Network & SSD Performance
Open `C:\Program Files\PostgreSQL\16\data\postgresql.conf` as Administrator:
```ini
# Listen on all network adapters
listen_addresses = '*'
port = 5432

# Performance Tuning for 16GB RAM + SSD
max_connections = 100
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 20MB
min_wal_size = 1GB
max_wal_size = 4GB
```

### Step 3: Configure `pg_hba.conf` to Allow Store LAN Devices
Open `C:\Program Files\PostgreSQL\16\data\pg_hba.conf` as Administrator. Add this line at the bottom:
```text
# Allow CFECC store local network computers to connect
host    all             all             192.168.1.0/24          scram-sha-256
```
*(If your store router uses `192.168.0.x`, adjust the subnet to `192.168.0.0/24`)*.

### Step 4: Open Firewall Port 5432
Run in PowerShell (as Administrator):
```powershell
New-NetFirewallRule -DisplayName "PostgreSQL 5432" -Direction Inbound -LocalPort 5432 -Protocol TCP -Action Allow
```

### Step 5: Create Production Database
Open **pgAdmin 4** (or `psql -U postgres`) and run:
```sql
CREATE DATABASE cfecc_db WITH ENCODING 'UTF8';
```

---

## 4. CFECC Application Configuration & Clean Initialization

### Production `.env` Configuration
In the project root `c:\Users\naidu\CFECC_phase1\.env`:

```env
# Node Environment
NODE_ENV=production
PORT=5000

# Dedicated Local Server PostgreSQL Connection String
DATABASE_URL=postgresql://postgres:CfeccDb@2026@127.0.0.1:5432/cfecc_db

# Security
JWT_SECRET=cfecc_super_secure_jwt_token_2026_enterprise_corp
JWT_EXPIRES_IN=12h

# WhatsApp Cloud API (Meta Production)
WHATSAPP_PHONE_NUMBER_ID=1508483332337537
WHATSAPP_ACCESS_TOKEN=EAAWNuklxnGYBS8q92N8AECh4Ggiv9ndj4ZCSAbx8f3ZAQsi6kfqx41bPk24PihlTjzXurkUlX7jxUOZBFmziqI38u35p2EWNB8BRnU0NgvqYPvu8vZAOHQHBIs6UjhveEN0WbpyGmMX0D10XBUyjpyumRbyEjX5W5BCo5PgvViyjSzfXD6XZCsqSEcy4Ymct3M2zG6tO4cBuThlrZAxEaRNPwhNVXlZAnWSpajtzZCidMLZA8dQMAwe5WsPM39shH7FWUs2zPJyDlrtrblWb4EZCfaiehl
WHATSAPP_BUSINESS_ACCOUNT_ID=1163250609708730
WHATSAPP_API_VERSION=v21.0
```

### Initialize Clean Production Schema (Zero Dummy Data)
Run the clean production initialization command:
```powershell
pnpm run db:prod-init
```

This automatically sets up:
1. **5 Master Roles**: `SUPER_ADMIN`, `STORE_MANAGER`, `CASHIER`, `ACCOUNTS_OFFICER`, `HR_PAYROLL`.
2. **System Permissions & RBAC mapping**.
3. **Official Measurement Units**: `PCS`, `KG`, `LTR`, `PKT`, `BOX`.
4. **Official Categories**: `PROVISIONS`, `DAIRY`, `SNACKS`, `PERSONAL`, `STATIONERY`.
5. **Initial Administrator Account**: Username `admin` / Password `Admin@123`.
6. **NO dummy employees, NO fake sales, NO test purchase orders.**

---

## 5. Running CFECC as a 24/7 Windows Service

To guarantee that the backend and web portal remain online continuously:

### Option A: Using PM2 Process Manager (Recommended)
1. Install PM2:
   ```powershell
   npm install -g pm2
   npm install -g pm2-windows-service
   ```
2. Build the production bundles:
   ```powershell
   pnpm run build
   ```
3. Start and register CFECC with PM2:
   ```powershell
   pm2 start "pnpm start" --name "cfecc-enterprise"
   pm2 save
   ```
4. PM2 automatically restarts the software if an unhandled error occurs and starts automatically on Windows boot.

### Option B: 1-Click Desktop Shortcut
A ready-to-run startup script has been provided at:
`scripts\start-cfecc-production.bat`
Place a shortcut to this file in the Windows Startup folder:
`shell:startup`

---

## 6. Automated Nightly Database Backup (30-Day Retention)

The backup script is located at:
`scripts\backup-database.bat`

### What it does:
1. Generates a compressed, timestamped binary dump: `C:\CFECC_Backups\cfecc_backup_YYYY-MM-DD_HH-MM-SS.sql`.
2. Verifies integrity.
3. Automatically deletes backups older than 30 days to prevent disk bloat.

### Schedule it in Windows Task Scheduler:
1. Open **Task Scheduler** on the Server PC.
2. Click **Create Basic Task** -> Name: `CFECC_Nightly_Database_Backup`.
3. Trigger: **Daily** at **11:59:00 PM**.
4. Action: **Start a program** -> Browse to `C:\Users\naidu\CFECC_phase1\scripts\backup-database.bat`.
5. Check: *"Run whether user is logged on or not"* with highest privileges.

---

## 7. Counter POS Terminal Setup (Cashier Workstations)

### Counter PC Requirements
* Any standard PC or laptop connected to the store Wi-Fi or LAN cable.
* Chrome, Edge, or Brave browser.

### 1-Click Cashier Desktop Shortcut:
Create a desktop shortcut on Counter 1 and Counter 2 PCs pointing to:
```text
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk http://192.168.1.100:3000/pos
```
* Using `--kiosk` opens Chrome in **Full-Screen Cashier Terminal Mode** without browser address bars or tabs.

### Hardware Peripherals Setup:
1. **Barcode Scanner (USB)**:
   - Plug into the Counter PC. Standard scanners function as HID keyboards.
   - Cashiers simply scan barcodes—the system instantly loads item details and applies employee subsidy prices automatically.
2. **Thermal Receipt Printer (80mm / 58mm USB/Ethernet)**:
   - Set as Windows Default Printer.
   - In Chrome, enable *"Silent Printing"* with `--kiosk-printing` so receipts print instantly upon checkout without print dialog delays.

