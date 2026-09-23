# 🚀 Complete Beginner Step-by-Step Guide for `C:\BJCL`
## Bally Jute Company Limited (BJL) — Local Windows Server 2022 Setup

Welcome! This guide is written in simple, plain language so you can set up everything effortlessly in **`C:\BJCL`** on your **Windows Server 2022** and connect from any computer in your mill/office network.

---

### 📂 Step 1: Your Folder Structure in `C:\BJCL`

Place the project files in your `C:\BJCL` folder as shown below:

```
C:\BJCL\
 │
 ├── 1_setup_database.bat             <-- (Step 1: Double-click to create database)
 ├── 2_migrate_data_from_supabase.bat  <-- (Step 2: Double-click to copy all data)
 ├── 3_start_server.bat               <-- (Step 3: Double-click to start server)
 ├── init_bjcl_db.sql                 <-- (Database tables and structure)
 ├── .env                             <-- (Configuration file)
 ├── package.json                     <-- (Dependencies list)
 ├── server.ts                        <-- (Backend & API server)
 ├── index.html                       <-- (Web page entry)
 ├── vite.config.ts                   <-- (Build settings)
 ├── src/                             <-- (Frontend UI screens and components)
 └── scripts/
      └── migrate_supabase_to_pg.cjs  <-- (Migration engine)
```

---

### ⚙️ Step 2: Install Node.js and PostgreSQL 18

If you haven't already installed them:

1. **Install Node.js**:
   - Download the LTS version installer (`.msi`) from **[nodejs.org](https://nodejs.org)**.
   - Click **Next -> Next -> Finish** (leave all defaults).
2. **Install PostgreSQL 18**:
   - Download from **[PostgreSQL Downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)**.
   - When asked for a **password for user `postgres`**, enter a password (for example: `BjlAdmin@2026`) and write it down.
   - Leave port as **5432**.

---

### 🛠️ Step 3: Run the 3 One-Click Batch Files

In your `C:\BJCL` folder, run these 3 files in order:

#### 1️⃣ Step 1: Initialize Database
- Double-click **`1_setup_database.bat`** (or Right-Click -> **Run as Administrator**).
- Type your PostgreSQL password when asked.
- It will automatically create **`bjcl_db`**, create all tables, and configure the Windows Firewall for you!

#### 2️⃣ Step 2: Migrate All Data from Supabase
- Double-click **`2_migrate_data_from_supabase.bat`**.
- Type your PostgreSQL password when asked.
- It will download **all existing records, users, and tables** from your Supabase account and insert them into your local `bjcl_db`.

#### 3️⃣ Step 3: Start the ERP Server
- Double-click **`3_start_server.bat`**.
- You will see:
  ```
  Server running on http://localhost:3000
  ```
- Keep this window open! Your ERP is now live!

---

### 🌐 Step 4: Accessing from Any Computer on the Network

1. Find your Windows Server's Local IP Address:
   - Open **Command Prompt (cmd)** on the server.
   - Type: `ipconfig`
   - Look for **IPv4 Address** (e.g. `192.168.1.100`).

2. On any other PC, Laptop, or Weighbridge terminal on the same Wi-Fi/LAN:
   - Open Google Chrome or Edge.
   - Go to:
     ```
     http://192.168.1.100:3000
     ```
     *(Replace `192.168.1.100` with your server's actual IP address)*.

---

### 🔄 How to Run 24/7 in the Background (Optional)

If you don't want to keep the black CMD window open, you can run it as a background service:

1. Open **Command Prompt as Administrator**.
2. Run these commands:
   ```cmd
   cd C:\BJCL
   npm install -g pm2
   npm install -g pm2-windows-startup
   pm2-startup install
   pm2 start npm --name "bjl-erp" -- run dev
   pm2 save
   ```
3. Now the app will start automatically every time your Windows Server turns on or reboots!

---

### ❓ Troubleshooting

| Issue | Quick Fix |
| :--- | :--- |
| **"createdb is not recognized"** | PostgreSQL bin path needs to be added to PATH, or ensure PostgreSQL is installed at `C:\Program Files\PostgreSQL\18\bin`. |
| **"Password authentication failed"** | Enter the exact master password you chose when installing PostgreSQL 18. |
| **Other PCs cannot open the link** | Run `1_setup_database.bat` as Administrator so it opens Port 3000 in Windows Defender Firewall. |
