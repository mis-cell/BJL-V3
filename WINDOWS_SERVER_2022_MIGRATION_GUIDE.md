# 🏢 Windows Server 2022 & PostgreSQL 18 Migration Guide
## Bally Jute Company Limited (BJL) — Complete On-Premise Migration & Deployment

This guide outlines the exact, step-by-step process to migrate **all tables, data, schemas, relations, and functions** from Supabase to your local **Windows Server 2022** running **PostgreSQL 18** with database **`bjcl_db`**, and host the full-stack ERP on your local network (LAN) with a **Static IP**.

---

### 🌐 System Architecture
```
                                 [ Router / Static IP ]
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │                                             │
      [ Office Workstation 1 ]                      [ Factory Weighbridge PC ]
    http://192.168.1.100:3000                      http://192.168.1.100:3000
                    │                                             │
                    └──────────────────────┬──────────────────────┘
                                           │
                             [ Windows Server 2022 ]
                     ┌────────────────────────────────────────┐
                     │ • Node.js Full-Stack App (Port 3000)   │
                     │ • Express Backend + React Frontend     │
                     │ • PostgreSQL 18 Database ("bjcl_db")   │
                     │ • Background Gmail/IMAP Sync Service   │
                     └────────────────────────────────────────┘
```

---

## 📋 Table of Contents
1. [Prerequisites & Software Installation](#1-prerequisites--software-installation)
2. [PostgreSQL 18 Setup & `bjcl_db` Creation](#2-postgresql-18-setup--bjcl_db-creation)
3. [PostgreSQL Network & Authentication Configuration](#3-postgresql-network--authentication-configuration)
4. [Windows Defender Firewall Configuration](#4-windows-defender-firewall-configuration)
5. [Automated Data & Schema Migration from Supabase](#5-automated-data--schema-migration-from-supabase)
6. [Server `.env` Configuration](#6-server-env-configuration)
7. [Running the Application on Windows Server 2022](#7-running-the-application-on-windows-server-2022)
8. [24/7 Production Deployment (PM2 Windows Service)](#8-247-production-deployment-pm2-windows-service)
9. [Static IP & Network Access Setup](#9-static-ip--network-access-setup)
10. [Automated Daily Database Backups](#10-automated-daily-database-backups)

---

## 1. Prerequisites & Software Installation

On your **Windows Server 2022** machine, install the following:

1. **Node.js (LTS Version 20.x or 22.x)**:
   - Download Windows Installer (.msi) from [nodejs.org](https://nodejs.org).
   - Ensure "Add to PATH" is checked.
2. **Git for Windows**:
   - Download from [git-scm.com](https://git-scm.com).
3. **PostgreSQL 18**:
   - Download the official installer from [EnterpriseDB PostgreSQL Downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).
   - During installation, select `Command Line Tools`, `PostgreSQL Server`, and `pgAdmin 4`.
   - Set the master password for the user `postgres` (e.g., `BjlAdmin@2026`). Keep this safe!
   - Set Port to `5432` (default).

---

## 2. PostgreSQL 18 Setup & `bjcl_db` Creation

Open **Command Prompt (CMD)** or **PowerShell as Administrator** on your Windows Server:

```powershell
# Verify PostgreSQL CLI is available
psql --version

# Create the database bjcl_db
psql -U postgres -c "CREATE DATABASE bjcl_db WITH OWNER = postgres ENCODING = 'UTF8';"
```

Alternatively, open **pgAdmin 4**:
1. Connect to **PostgreSQL 18**.
2. Right-click **Databases** > **Create** > **Database...**
3. Database Name: `bjcl_db`
4. Click **Save**.

---

## 3. PostgreSQL Network & Authentication Configuration

To allow your Node.js application and authorized machines on your network to connect to PostgreSQL:

1. Navigate to your PostgreSQL 18 data directory:
   `C:\Program Files\PostgreSQL\18\data`

2. Open **`postgresql.conf`** in Notepad (run Notepad as Administrator):
   Find `listen_addresses` and change it to:
   ```ini
   listen_addresses = '*'
   port = 5432
   ```

3. Open **`pg_hba.conf`** in Notepad and add the following lines at the bottom:
   ```ini
   # TYPE  DATABASE        USER            ADDRESS                 METHOD
   # Allow local server connections:
   host    all             all             127.0.0.1/32            scram-sha-256
   host    all             all             ::1/128                 scram-sha-256
   # Allow connections from your local subnet (e.g., 192.168.1.0/24 or all):
   host    all             all             0.0.0.0/0               scram-sha-256
   ```

4. Restart the PostgreSQL Windows Service:
   ```powershell
   Restart-Service postgresql-x64-18
   ```

---

## 4. Windows Defender Firewall Configuration

Allow inbound traffic on **Port 3000** (Web ERP Application) and **Port 5432** (PostgreSQL Database).

Run **PowerShell as Administrator**:

```powershell
# Open Port 3000 for BJL Web Application
New-NetFirewallRule -DisplayName "BJL Web ERP (Port 3000)" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow

# Open Port 5432 for PostgreSQL Database
New-NetFirewallRule -DisplayName "PostgreSQL 18 (Port 5432)" -Direction Inbound -LocalPort 5432 -Protocol TCP -Action Allow

# Open Port 80 / 443 (if using Reverse Proxy / IIS)
New-NetFirewallRule -DisplayName "BJL HTTP (Port 80)" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
```

---

## 5. Automated Data & Schema Migration from Supabase

We have provided **two automated methods** to migrate all your Supabase tables, sequences, foreign keys, stored functions, and data directly into `bjcl_db`.

### Method A: Direct Online Automated Migration (Recommended)
This method connects directly to Supabase, pulls all table rows in batches, runs `init_bjcl_db.sql`, and inserts every record into `bjcl_db` in correct dependency order.

In the project directory on Windows Server:

```powershell
# 1. Install dependencies
npm install

# 2. Run the automated migration tool
npm run migrate:supabase-to-local
```

You will see real-time progress:
```
🚀 BJL RAW JUTE ERP: SUPABASE -> LOCAL POSTGRESQL 18 MIGRATION
🔌 Connecting to local PostgreSQL database "bjcl_db"...
✅ Connected to local PostgreSQL 18 successfully!
📦 Applying complete table schemas, constraints, and functions...
✅ All PostgreSQL 18 tables, indexes, and stored procedures initialized.

📥 Extracting and migrating live table records...
  ⏳ Migrating [financial_year_master]... ✅ 3 records migrated!
  ⏳ Migrating [area_master]... ✅ 18 records migrated!
  ⏳ Migrating [agency_master]... ✅ 42 records migrated!
  ⏳ Migrating [sauda_master]... ✅ 150 records migrated!
  ⏳ Migrating [purchase_master]... ✅ 120 records migrated!
  ⏳ Migrating [final_arrival]... ✅ 310 records migrated!
  ...
🎉 MIGRATION COMPLETED SUCCESSFULLY!
```

---

### Method B: Offline Standalone SQL Dump Import
If your Windows Server has restricted internet access:

1. On a machine with internet, generate the SQL dump:
   ```powershell
   npm run export:supabase-dump
   ```
   This generates **`bjcl_db_full_data_dump.sql`**.

2. Copy `bjcl_db_full_data_dump.sql` to your Windows Server 2022.

3. Execute the dump into `bjcl_db`:
   ```powershell
   psql -U postgres -d bjcl_db -f bjcl_db_full_data_dump.sql
   ```

---

## 6. Server `.env` Configuration

Create or edit the **`.env`** file in your application root folder:

```ini
# Local PostgreSQL 18 Database Connection
DATABASE_URL=postgresql://postgres:BjlAdmin@2026@localhost:5432/bjcl_db
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=BjlAdmin@2026
PGDATABASE=bjcl_db

# Web Server Network Binding
PORT=3000
HOST=0.0.0.0

# Email Integration (Gmail IMAP / SMTP)
EMAIL_USER=rawjute@ballyjute.com
EMAIL_PASS=ochhyhnjlkhdlpot
```

---

## 7. Running the Application on Windows Server 2022

### Step 1: Build the Production Bundle
```powershell
npm run build
```

### Step 2: Start the Full-Stack Server
```powershell
npm start
```
The server will start listening on `http://0.0.0.0:3000`.

---

## 8. 24/7 Production Deployment (PM2 Windows Service)

To ensure the ERP runs continuously in the background and restarts automatically on Windows reboot:

1. Install **PM2** and **pm2-windows-startup**:
   ```powershell
   npm install -g pm2
   npm install -g pm2-windows-startup
   pm2-startup install
   ```

2. Start the application with PM2:
   ```powershell
   pm2 start dist/server.cjs --name "bjl-raw-jute-erp"
   ```

3. Save the PM2 process list:
   ```powershell
   pm2 save
   ```

### PM2 Management Commands:
- Check Status: `pm2 status`
- View Live Logs: `pm2 logs bjl-raw-jute-erp`
- Restart App: `pm2 restart bjl-raw-jute-erp`
- Stop App: `pm2 stop bjl-raw-jute-erp`

---

## 9. Static IP & Network Access Setup

### Step 1: Set Static IP on Windows Server 2022
1. Open **Control Panel** > **Network and Sharing Center** > **Change adapter settings**.
2. Right-click your Ethernet adapter > **Properties** > **Internet Protocol Version 4 (TCP/IPv4)** > **Properties**.
3. Select **Use the following IP address**:
   - IP address: `192.168.1.100` (or your chosen server IP)
   - Subnet mask: `255.255.255.0`
   - Default gateway: `192.168.1.1` (your router IP)
   - Preferred DNS server: `8.8.8.8`
4. Click **OK**.

### Step 2: Accessing from Any Workstation on LAN
Open any web browser on any office PC, laptop, or weighbridge computer connected to the same network and navigate to:
```
http://192.168.1.100:3000
```

### Step 3: Accessing from Outside via Router Static IP (Optional)
In your router settings (e.g. `192.168.1.1`):
1. Go to **Port Forwarding / Virtual Server**.
2. Forward **External Port `3000`** -> **Internal IP `192.168.1.100`** (Port `3000`).
3. Now access the ERP from anywhere via your router's Static IP:
   `http://<YOUR_STATIC_WAN_IP>:3000`

---

## 10. Automated Daily Database Backups

Create a backup batch script **`C:\BJL_Backups\backup_bjcl_db.bat`**:

```batch
@echo off
set PGPASSWORD=BjlAdmin@2026
set BACKUP_DIR=C:\BJL_Backups
set TIMESTAMP=%date:~10,4%-%date:~4,2%-%date:~7,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%

"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -U postgres -d bjcl_db -F c -b -v -f "%BACKUP_DIR%\bjcl_db_backup_%TIMESTAMP%.backup"

echo Backup completed: bjcl_db_backup_%TIMESTAMP%.backup
```

### Schedule Daily Backup via Windows Task Scheduler:
1. Open **Task Scheduler** > **Create Basic Task**.
2. Name: `BJL Database Daily Backup`.
3. Trigger: **Daily** at `11:59 PM`.
4. Action: **Start a program** > Browse to `C:\BJL_Backups\backup_bjcl_db.bat`.
5. Finish.

---

## ✅ Verification Checklist

| Item | Status | Command / Check |
| :--- | :---: | :--- |
| PostgreSQL 18 Service Running | ✅ | `Get-Service postgresql-x64-18` |
| Database `bjcl_db` Initialized | ✅ | `psql -U postgres -d bjcl_db -c "\dt"` |
| All Supabase Data Migrated | ✅ | `npm run migrate:supabase-to-local` |
| Windows Firewall Ports Opened | ✅ | TCP Ports 3000 & 5432 allowed |
| Node.js ERP Server Online | ✅ | `http://localhost:3000` responds 200 OK |
| LAN Workstation Access | ✅ | `http://192.168.1.100:3000` loads from other PCs |
| Automatic Reboot Persistence | ✅ | `pm2 status` shows online |
| Daily Backups Active | ✅ | Windows Task Scheduler configured |

Your Bally Jute Raw Jute ERP is now fully autonomous, secured on-premise, and running on your local Windows Server 2022 with PostgreSQL 18!
