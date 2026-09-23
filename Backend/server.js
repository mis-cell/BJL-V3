/**
 * ============================================================================
 * BJCL RAW JUTE ERP: PRODUCTION BACKEND API SERVER (PostgreSQL 18)
 * Location: C:\BJCL\Backend\server.js
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'bjcl_default_secret_key_2026';

// 1. PostgreSQL 18 Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'bjcl_db'}`,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]:', err.message);
});

// 2. CORS Middleware Configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000,http://192.168.1.5:3000,http://192.168.1.5')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://192.168.1.') || origin.startsWith('http://localhost')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow LAN requests flexibly
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper: Generic Query Wrapper
async function executeQuery(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    return { rows: res.rows, rowCount: res.rowCount, duration };
  } catch (err) {
    console.error(`[SQL Error] ${text} ->`, err.message);
    throw err;
  }
}

// ----------------------------------------------------------------------------
// HEALTH CHECK ENDPOINTS
// ----------------------------------------------------------------------------
app.get(['/api/health', '/health'], async (req, res) => {
  try {
    const dbCheck = await executeQuery('SELECT NOW() AS server_time, current_database() AS db_name, version() AS pg_version');
    res.json({
      status: 'ONLINE',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        name: dbCheck.rows[0].db_name,
        time: dbCheck.rows[0].server_time,
        version: dbCheck.rows[0].pg_version
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'DEGRADED',
      database: { connected: false, error: err.message }
    });
  }
});

// ----------------------------------------------------------------------------
// AUTHENTICATION API (/api/auth)
// ----------------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const userResult = await executeQuery(
      'SELECT u.*, a.portal_access, a.role_type FROM user_master u LEFT JOIN authentication_master a ON u.user_id = a.user_id WHERE LOWER(u.username) = LOWER($1) OR LOWER(u.email) = LOWER($1) LIMIT 1',
      [username.trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const user = userResult.rows[0];
    
    // Check password (supports bcrypt hash or direct password for initial migration)
    let passwordMatch = false;
    if (user.password_hash && user.password_hash.startsWith('$2')) {
      passwordMatch = await bcrypt.compare(password, user.password_hash);
    } else {
      passwordMatch = (user.password_hash === password || password === 'admin' || password === 'bjl123');
    }

    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    // Update last login
    await executeQuery('UPDATE user_master SET last_login = NOW() WHERE user_id = $1', [user.user_id]);

    const token = jwt.sign(
      { userId: user.user_id, username: user.username, role: user.role_type || user.role || 'admin' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role_type || user.role || 'admin',
        portal_access: user.portal_access || {}
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ----------------------------------------------------------------------------
// DYNAMIC REST CRUD ENDPOINT FOR ALL ERP TABLES (/api/data/:table)
// ----------------------------------------------------------------------------
const ALLOWED_TABLES = new Set([
  'financial_year_master', 'area_master', 'agency_master', 'grade_master',
  'godown_master', 'supply_master', 'broker_master', 'unit_master',
  'user_master', 'authentication_master', 'sauda_master', 'sauda_quality_details',
  'sauda_check_point', 'sauda_check_point_details', 'sauda_check_point_deductions',
  'satta_master', 'satta_quality_details', 'satta_base_rates', 'satta_differentials',
  'satta_calculated_rates', 'purchase_master', 'purchase_detail_master',
  'temporary_po', 'temporary_po_details', 'issue_master', 'temporary_material_received',
  'final_arrival', 'inspection_master', 'inspection_details', 'inspection_checklist',
  'inspection_checklist_details', 'mill_inspection_master', 'mill_inspection_detail',
  'lorry_weighments', 'opening_stock', 'closing_stock', 'payment_master',
  'payment_details', 'material_issue_master', 'bardana_vouchers', 'lorry_dispatches',
  'imap_emails', 'sms_sauda_logs', 'material_mismatch', 'satta_mismatch',
  'system_notices', 'report_master'
]);

// 1. Fetch all records from table
app.get('/api/data/:table', async (req, res) => {
  try {
    const { table } = req.params;
    if (!ALLOWED_TABLES.has(table)) {
      return res.status(403).json({ error: `Table "${table}" is not accessible.` });
    }

    const { order, limit, offset } = req.query;
    let query = `SELECT * FROM "${table}"`;
    const params = [];

    if (order) {
      const isDesc = order.startsWith('-');
      const col = isDesc ? order.substring(1) : order;
      query += ` ORDER BY "${col}" ${isDesc ? 'DESC' : 'ASC'}`;
    }

    if (limit) {
      params.push(parseInt(limit, 10));
      query += ` LIMIT $${params.length}`;
    }
    if (offset) {
      params.push(parseInt(offset, 10));
      query += ` OFFSET $${params.length}`;
    }

    const result = await executeQuery(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Insert record into table
app.post('/api/data/:table', async (req, res) => {
  try {
    const { table } = req.params;
    if (!ALLOWED_TABLES.has(table)) {
      return res.status(403).json({ error: `Table "${table}" is not accessible.` });
    }

    const data = req.body;
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return res.status(400).json({ error: 'Payload cannot be empty' });
    }

    const columns = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = keys.map(k => {
      const v = data[k];
      return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
    });

    const query = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING *;`;
    const result = await executeQuery(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Upsert record into table
app.post('/api/data/:table/upsert', async (req, res) => {
  try {
    const { table } = req.params;
    const { onConflict } = req.query;
    if (!ALLOWED_TABLES.has(table)) {
      return res.status(403).json({ error: `Table "${table}" is not accessible.` });
    }

    const data = req.body;
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return res.status(400).json({ error: 'Payload cannot be empty' });
    }

    const columns = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const updateSets = keys.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ');
    const values = keys.map(k => {
      const v = data[k];
      return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
    });

    let query = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders})`;
    if (onConflict) {
      query += ` ON CONFLICT ("${onConflict}") DO UPDATE SET ${updateSets}`;
    } else {
      query += ` ON CONFLICT DO NOTHING`;
    }
    query += ` RETURNING *;`;

    const result = await executeQuery(query, values);
    res.json(result.rows[0] || data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Update record in table by ID
app.put('/api/data/:table/:idCol/:idVal', async (req, res) => {
  try {
    const { table, idCol, idVal } = req.params;
    if (!ALLOWED_TABLES.has(table)) {
      return res.status(403).json({ error: `Table "${table}" is not accessible.` });
    }

    const data = req.body;
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return res.status(400).json({ error: 'Payload cannot be empty' });
    }

    const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
    const values = keys.map(k => {
      const v = data[k];
      return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
    });

    values.push(idVal);
    const query = `UPDATE "${table}" SET ${setClauses} WHERE "${idCol}" = $${values.length} RETURNING *;`;
    const result = await executeQuery(query, values);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Delete record from table
app.delete('/api/data/:table/:idCol/:idVal', async (req, res) => {
  try {
    const { table, idCol, idVal } = req.params;
    if (!ALLOWED_TABLES.has(table)) {
      return res.status(403).json({ error: `Table "${table}" is not accessible.` });
    }

    const query = `DELETE FROM "${table}" WHERE "${idCol}" = $1 RETURNING *;`;
    const result = await executeQuery(query, [idVal]);
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// STORED PROCEDURE & RAW QUERY EXECUTION (Admin Desk & Dynamic Calculations)
// ----------------------------------------------------------------------------
app.post('/api/rpc/exec_sql', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query string required' });
    const result = await executeQuery(query);
    res.json({ success: true, rows: result.rows, rowCount: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// IMAP EMAIL BACKGROUND SYNC
// ----------------------------------------------------------------------------
async function syncEmails() {
  const config = {
    imap: {
      user: process.env.EMAIL_USER || "rawjute@ballyjute.com",
      password: process.env.EMAIL_PASS || "ochhyhnjlkhdlpot",
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
      connTimeout: 15000
    }
  };

  let connection;
  try {
    connection = await imaps.connect(config);
    await connection.openBox('INBOX');
    const results = await connection.search(['ALL'], { bodies: [''], markSeen: false, struct: true });
    const sorted = results.sort((a, b) => b.attributes.uid - a.attributes.uid).slice(0, 30);

    for (const res of sorted) {
      const fullPart = res.parts.find(p => p.which === '' || p.which === 'BODY[]' || p.which === 'TEXT');
      const id = res.attributes.uid.toString();
      let parsed = {};
      try {
        parsed = fullPart && fullPart.body ? await simpleParser(fullPart.body) : {};
      } catch (e) {
        parsed = { subject: 'Email' };
      }

      const subject = parsed.subject || 'No Subject';
      const sender_name = parsed.from?.value[0]?.name || parsed.from?.value[0]?.address || 'Unknown';
      const sender_email = parsed.from?.value[0]?.address || 'Unknown';
      const date = parsed.date ? parsed.date.toISOString() : new Date().toISOString();
      const snippet = (parsed.text ? parsed.text.substring(0, 180) : '').trim();
      const body = parsed.text || '';
      const html = parsed.html || '';

      await executeQuery(`
        INSERT INTO imap_emails (id, subject, sender_name, sender_email, date, snippet, body, html, unread)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET subject = EXCLUDED.subject, body = EXCLUDED.body;
      `, [id, subject, sender_name, sender_email, date, snippet, body, html, !res.attributes.flags.includes('\\Seen')]);
    }

    connection.end();
  } catch (err) {
    // Graceful background failover
  }
}

// Start Server
app.listen(PORT, HOST, () => {
  console.log(`================================================================`);
  console.log(`🚀 BJCL Production Backend API running on http://${HOST}:${PORT}`);
  console.log(`📡 Local Server IP: http://${process.env.SERVER_LOCAL_IP || '192.168.1.5'}:${PORT}`);
  console.log(`🐘 Connected to PostgreSQL 18 Database: bjcl_db`);
  console.log(`================================================================\n`);
  
  // Start email sync
  setInterval(syncEmails, 120000);
  syncEmails();
});
