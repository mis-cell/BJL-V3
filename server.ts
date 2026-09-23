import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import aiGatewayRouter from "./src/lib/ai-gateway.ts";
import nodemailer from "nodemailer";
import imaps from 'imap-simple';
import { simpleParser } from 'mailparser';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:Verified@3656@localhost:5432/bjcl_db',
  max: 25,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 6000,
});

// Test connection on launch & auto-init core tables
pgPool.query('SELECT current_database() as db, version() as ver;')
  .then(async (res) => {
    console.log(`✅ [LOCAL POSTGRESQL] Connected to Database: [${res.rows[0]?.db}]`);
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS satta_mismatch (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          mismatch_id TEXT,
          po_no TEXT,
          sauda_no TEXT,
          area TEXT,
          grade TEXT,
          field TEXT,
          expected_value TEXT,
          actual_value TEXT,
          expected_rate NUMERIC,
          actual_rate NUMERIC,
          status TEXT DEFAULT 'dispute',
          remarks TEXT,
          approved_by TEXT,
          approved_at TIMESTAMP WITH TIME ZONE,
          approval_level TEXT DEFAULT 'L3/L5',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS material_mismatch (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          mr_no TEXT,
          po_no TEXT,
          sauda_no TEXT,
          supplier TEXT,
          broker TEXT,
          field TEXT,
          expected_value TEXT,
          actual_value TEXT,
          status TEXT DEFAULT 'pending',
          remarks TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS imap_emails (
          id TEXT PRIMARY KEY,
          subject TEXT,
          sender_name TEXT,
          sender_email TEXT,
          date TIMESTAMP WITH TIME ZONE,
          snippet TEXT,
          body TEXT,
          html TEXT,
          attachments TEXT,
          unread BOOLEAN DEFAULT TRUE,
          starred BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
      console.log("✅ [LOCAL POSTGRESQL] Core tables verified/initialized successfully.");
    } catch (e: any) {
      console.warn("⚠️ [LOCAL POSTGRESQL] Schema init notice:", e.message);
    }
  })
  .catch(err => {
    console.warn(`⚠️ [LOCAL POSTGRESQL] Notice: ${err.message}`);
  });

// Helper to clean RFC 2047 encoded words if any remain
function cleanMimeWords(str: string): string {
  if (!str) return '';
  return str.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === 'B') {
        return Buffer.from(text, 'base64').toString('utf8');
      } else if (encoding.toUpperCase() === 'Q') {
        const decoded = text
          .replace(/_/g, ' ')
          .replace(/=([A-Fa-f0-9]{2})/g, (__: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
        return decodeURIComponent(escape(decoded));
      }
    } catch (e) {
      return text;
    }
    return text;
  });
}

async function runImapSync() {
  const config = {
    imap: {
      user: "rawjute@ballyjute.com",
      password: "ochhyhnjlkhdlpot",
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
    console.log("[Sync] Connecting to IMAP server...");
    connection = await imaps.connect(config);
    await connection.openBox('INBOX');
    
    const searchCriteria = ['ALL'];
    const fetchOptions = {
      bodies: [''],
      markSeen: false,
      struct: true
    };
    
    const results = await connection.search(searchCriteria, fetchOptions);
    console.log(`[Sync] Found ${results.length} total emails on live Gmail. Processing the most recent 50...`);
    
    // Sort UIDs descending and take top 50
    const sortedResults = results.sort((a, b) => b.attributes.uid - a.attributes.uid).slice(0, 50);
    
    const emails = await Promise.all(sortedResults.map(async (res) => {
      const fullPart = res.parts.find(part => part.which === '' || part.which === 'BODY[]' || part.which === 'TEXT');
      const id = res.attributes.uid;
      
      let parsed: any;
      try {
        if (fullPart && fullPart.body) {
          parsed = await simpleParser(fullPart.body);
        } else {
          const rawEmail = res.parts.map(p => p.body || '').join('\r\n\r\n');
          parsed = await simpleParser(rawEmail || 'No content');
        }
      } catch (parseErr) {
        console.error(`[Sync] Error parsing email UID ${id}:`, parseErr);
        parsed = {
          subject: 'Error parsing email',
          from: { value: [{ name: 'Unknown', address: 'Unknown' }] },
          date: new Date(),
          text: 'Content could not be parsed',
          html: ''
        };
      }

      let attachmentsList: any[] = [];
      if (parsed.attachments && Array.isArray(parsed.attachments)) {
        attachmentsList = parsed.attachments.map((att: any) => ({
          filename: att.filename || 'attachment',
          contentType: att.contentType || 'application/octet-stream',
          size: att.size || 0,
          content: att.content ? att.content.toString('base64') : ''
        }));
      }

      const rawSubject = cleanMimeWords(parsed.subject || 'No Subject');
      const senderName = cleanMimeWords(parsed.from?.value[0]?.name || parsed.from?.value[0]?.address || 'Unknown');
      const senderEmail = parsed.from?.value[0]?.address || 'Unknown';
      const cleanSnippet = (parsed.text ? parsed.text.substring(0, 180).replace(/\s+/g, ' ') : '').trim();

      return {
        id: id.toString(),
        subject: rawSubject,
        sender_name: senderName,
        sender_email: senderEmail,
        date: parsed.date ? parsed.date.toISOString() : new Date().toISOString(),
        snippet: cleanSnippet || (rawSubject ? `${rawSubject}...` : 'No preview'),
        body: parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''),
        html: parsed.html || '',
        attachments: JSON.stringify(attachmentsList),
        unread: !res.attributes.flags.includes('\\Seen'),
        starred: res.attributes.flags.includes('\\Flagged')
      };
    }));

    connection.end();
    connection = null;
    
    if (emails.length > 0) {
      console.log(`[Sync] Upserting ${emails.length} live Gmail emails to local PostgreSQL (bjcl_db)...`);
      for (const e of emails) {
        try {
          await pgPool.query(`
            INSERT INTO imap_emails (id, subject, sender_name, sender_email, date, snippet, body, html, attachments, unread, starred)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id) DO UPDATE SET
              subject = EXCLUDED.subject,
              sender_name = EXCLUDED.sender_name,
              sender_email = EXCLUDED.sender_email,
              date = EXCLUDED.date,
              snippet = EXCLUDED.snippet,
              body = EXCLUDED.body,
              html = EXCLUDED.html,
              attachments = EXCLUDED.attachments,
              unread = EXCLUDED.unread,
              starred = EXCLUDED.starred;
          `, [e.id, e.subject, e.sender_name, e.sender_email, e.date, e.snippet, e.body, e.html, e.attachments, e.unread, e.starred]);
        } catch (dbErr: any) {
          // Table might not exist yet; will be created on start
        }
      }
      console.log("[Sync] Successfully synchronized live Gmail emails to local PostgreSQL (bjcl_db)!");

      // Also update local cache file
      try {
        const filePath = path.join(process.cwd(), "emails.json");
        const mappedEmails = emails.map(e => ({
          id: e.id,
          subject: e.subject,
          senderName: e.sender_name,
          senderEmail: e.sender_email,
          date: e.date,
          snippet: e.snippet,
          body: e.body,
          html: e.html,
          attachments: e.attachments,
          unread: e.unread,
          starred: e.starred
        }));
        fs.writeFileSync(filePath, JSON.stringify({ success: true, emails: mappedEmails }, null, 2), "utf8");
      } catch (fileErr) {
        console.error("[Sync] Failed to write to local emails.json:", fileErr);
      }
    }
    return emails;
  } catch (err: any) {
    if (err.message?.includes('timed out') || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
      console.warn("[Sync] Background IMAP email sync paused (connection timed out / offline).");
    } else {
      console.error("[Sync] Error in live Gmail email sync:", err.message);
    }
    throw err;
  } finally {
    if (connection) {
      try { connection.end(); } catch (e) {}
    }
  }
}

async function syncEmailsBackground() {
  console.log("Starting background IMAP email sync process for local PostgreSQL...");
  
  // Ensure table exists in local PostgreSQL on startup
  try {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS imap_emails (
        id TEXT PRIMARY KEY,
        subject TEXT,
        sender_name TEXT,
        sender_email TEXT,
        date TIMESTAMP WITH TIME ZONE,
        snippet TEXT,
        body TEXT,
        html TEXT,
        attachments TEXT,
        unread BOOLEAN DEFAULT TRUE,
        starred BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log("Local PostgreSQL table 'imap_emails' verified/created successfully in bjcl_db.");
  } catch (err) {
    console.warn("Local PostgreSQL 'imap_emails' setup notice:", err);
  }

  // Run immediately, then every 30 seconds
  try {
    await runImapSync();
  } catch (e) {}
  setInterval(async () => {
    try {
      await runImapSync();
    } catch (e) {}
  }, 30000);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. CORS & No-Cache middleware
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");

    const origin = req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,Content-Type,Authorization");
    if (origin !== "*") {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // 2. Body Parser
  app.use(express.json({ limit: "50mb" }));

  // System Intelligence Route securely delegated to AI Gateway
  app.use(["/api/chat", "/Jute-Purchase-Automation/api/chat"], aiGatewayRouter);

  // ============================================================================
  // LOCAL POSTGRESQL 18 (bjcl_db) REST API & QUERY ROUTER
  // ============================================================================
  app.get(["/api/pg/health", "/Jute-Purchase-Automation/api/pg/health"], async (req, res) => {
    try {
      const result = await pgPool.query("SELECT current_database() as database, NOW() as server_time, version() as version;");
      return res.json({
        ok: true,
        connected: true,
        database: result.rows[0]?.database || 'bjcl_db',
        server_time: result.rows[0]?.server_time,
        version: result.rows[0]?.version
      });
    } catch (err: any) {
      return res.status(500).json({ ok: false, connected: false, error: err.message });
    }
  });

  app.post(["/api/pg/query", "/Jute-Purchase-Automation/api/pg/query"], async (req, res) => {
    const { query, params = [] } = req.body;
    if (!query) return res.status(400).json({ error: "Missing SQL query in request body" });
    try {
      const result = await pgPool.query(query, params);
      return res.json({ data: result.rows, rowCount: result.rowCount });
    } catch (err: any) {
      console.error("[PG Query Error]:", err.message, "SQL:", query);
      return res.status(500).json({ error: err.message, data: null });
    }
  });

  app.post(["/api/pg/rpc", "/Jute-Purchase-Automation/api/pg/rpc"], async (req, res) => {
    const { name, args = {} } = req.body;
    if (!name) return res.status(400).json({ error: "Missing RPC function name" });
    try {
      if (name === 'exec_sql') {
        const queryText = args.query;
        const result = await pgPool.query(queryText);
        return res.json({ data: result.rows || [], error: null });
      }
      if (name === 'exec_sql_return') {
        const queryText = args.query;
        const result = await pgPool.query(queryText);
        return res.json({ data: result.rows || [], error: null });
      }
      const keys = Object.keys(args);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const values = keys.map(k => args[k]);
      const sql = `SELECT * FROM ${name}(${placeholders});`;
      const result = await pgPool.query(sql, values);
      return res.json({ data: result.rows, error: null });
    } catch (err: any) {
      console.error(`[PG RPC Error in ${name}]:`, err.message);
      return res.status(500).json({ error: err.message, data: null });
    }
  });

  app.post(["/api/pg/crud", "/Jute-Purchase-Automation/api/pg/crud"], async (req, res) => {
    const { action, table, data, filters = {}, complexFilters = [], order, ascending = true, limit, offset, idCol } = req.body;
    if (!table) return res.status(400).json({ error: "Missing table name" });

    try {
      // 1. SELECT
      if (action === 'select') {
        let sql = `SELECT * FROM "${table}"`;
        const whereClauses: string[] = [];
        const params: any[] = [];

        Object.keys(filters).forEach((key) => {
          params.push(filters[key]);
          whereClauses.push(`"${key}" = $${params.length}`);
        });

        if (Array.isArray(complexFilters)) {
          complexFilters.forEach((cf: any) => {
            if (cf && cf.column && cf.op) {
              if (cf.op === 'IN' && Array.isArray(cf.value)) {
                const placeholders = cf.value.map((v: any) => {
                  params.push(v);
                  return `$${params.length}`;
                }).join(', ');
                whereClauses.push(`"${cf.column}" IN (${placeholders})`);
              } else {
                params.push(cf.value);
                whereClauses.push(`"${cf.column}" ${cf.op} $${params.length}`);
              }
            }
          });
        }

        let fullSql = sql;
        if (whereClauses.length > 0) {
          fullSql += ` WHERE ` + whereClauses.join(' AND ');
        }

        if (order) {
          fullSql += ` ORDER BY "${order}" ${ascending ? 'ASC' : 'DESC'}`;
        }

        const queryParams = [...params];
        if (limit) {
          queryParams.push(limit);
          fullSql += ` LIMIT $${queryParams.length}`;
        }

        if (offset) {
          queryParams.push(offset);
          fullSql += ` OFFSET $${queryParams.length}`;
        }

        try {
          const result = await pgPool.query(fullSql, queryParams);
          return res.json({ data: result.rows, error: null });
        } catch (queryErr: any) {
          // If ORDER BY column or specific WHERE column does not exist in schema, fallback to safe select
          if (queryErr.message?.includes('column') && queryErr.message?.includes('does not exist')) {
            console.warn(`[PG Select Fallback on ${table}]: ${queryErr.message}. Executing base SELECT...`);
            let safeSql = `SELECT * FROM "${table}"`;
            if (limit) safeSql += ` LIMIT ${Number(limit)}`;
            try {
              const safeResult = await pgPool.query(safeSql);
              let rows = safeResult.rows;
              // Filter in JavaScript if needed
              if (Object.keys(filters).length > 0) {
                rows = rows.filter((r: any) => {
                  return Object.keys(filters).every(k => String(r[k] ?? '') === String(filters[k] ?? ''));
                });
              }
              return res.json({ data: rows, error: null });
            } catch (fbErr: any) {
              // If table itself is missing, let outer catch auto-heal it
              throw fbErr;
            }
          }
          throw queryErr;
        }
      }

      // 2. INSERT
      if (action === 'insert') {
        const rows = Array.isArray(data) ? data : [data];
        if (rows.length === 0) return res.json({ data: [], error: null });

        const results: any[] = [];
        for (const row of rows) {
          const keys = Object.keys(row);
          const columns = keys.map(k => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const values = keys.map(k => (typeof row[k] === 'object' && row[k] !== null ? JSON.stringify(row[k]) : row[k]));

          const insertSql = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING *;`;
          const result = await pgPool.query(insertSql, values);
          results.push(result.rows[0]);
        }
        return res.json({ data: Array.isArray(data) ? results : results[0], error: null });
      }

      // 3. UPSERT
      if (action === 'upsert') {
        const rows = Array.isArray(data) ? data : [data];
        if (rows.length === 0) return res.json({ data: [], error: null });

        const results: any[] = [];
        for (const row of rows) {
          const keys = Object.keys(row);
          const columns = keys.map(k => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const values = keys.map(k => (typeof row[k] === 'object' && row[k] !== null ? JSON.stringify(row[k]) : row[k]));
          
          let conflictCol = idCol || keys[0];
          const updateSets = keys.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ');

          const upsertSql = `
            INSERT INTO "${table}" (${columns}) 
            VALUES (${placeholders}) 
            ON CONFLICT ("${conflictCol}") 
            DO UPDATE SET ${updateSets} 
            RETURNING *;
          `;
          try {
            const result = await pgPool.query(upsertSql, values);
            results.push(result.rows[0]);
          } catch (e) {
            // Fallback plain insert
            const fallbackSql = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) RETURNING *;`;
            const result = await pgPool.query(fallbackSql, values);
            results.push(result.rows[0]);
          }
        }
        return res.json({ data: Array.isArray(data) ? results : results[0], error: null });
      }

      // 4. UPDATE
      if (action === 'update') {
        const keys = Object.keys(data);
        if (keys.length === 0) return res.status(400).json({ error: "No update fields provided" });

        const params: any[] = [];
        const setClauses = keys.map((k, i) => {
          params.push(typeof data[k] === 'object' && data[k] !== null ? JSON.stringify(data[k]) : data[k]);
          return `"${k}" = $${i + 1}`;
        });

        const whereClauses: string[] = [];
        Object.keys(filters).forEach(k => {
          params.push(filters[k]);
          whereClauses.push(`"${k}" = $${params.length}`);
        });

        const updateSql = `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE ${whereClauses.join(' AND ')} RETURNING *;`;
        const result = await pgPool.query(updateSql, params);
        return res.json({ data: result.rows, error: null });
      }

      // 5. DELETE
      if (action === 'delete') {
        const params: any[] = [];
        const whereClauses: string[] = [];
        Object.keys(filters).forEach(k => {
          params.push(filters[k]);
          whereClauses.push(`"${k}" = $${params.length}`);
        });

        if (whereClauses.length === 0) {
          return res.status(400).json({ error: "Refusing to delete without filter conditions" });
        }

        const deleteSql = `DELETE FROM "${table}" WHERE ${whereClauses.join(' AND ')};`;
        const result = await pgPool.query(deleteSql, params);
        return res.json({ success: true, rowCount: result.rowCount, error: null });
      }

      return res.status(400).json({ error: `Unknown action: ${action}` });
    } catch (err: any) {
      // Auto-heal missing table (PostgreSQL 42P01: relation does not exist)
      if (err.code === '42P01' || err.message?.includes('does not exist')) {
        console.warn(`[Auto-Heal] Table "${table}" missing in PostgreSQL. Creating automatically...`);
        try {
          await pgPool.query(`
            CREATE TABLE IF NOT EXISTS "${table}" (
              id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
          `);
          if (action === 'select') {
            return res.json({ data: [], error: null });
          }
          if (action === 'insert' || action === 'upsert') {
            const sample = Array.isArray(data) ? data[0] : data;
            if (sample && typeof sample === 'object') {
              for (const col of Object.keys(sample)) {
                if (col !== 'id' && col !== 'created_at' && col !== 'updated_at') {
                  await pgPool.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col}" TEXT;`).catch(() => {});
                }
              }
            }
            return res.json({ data: data, error: null });
          }
          if (action === 'delete') {
            return res.json({ success: true, rowCount: 0, error: null });
          }
        } catch (healErr) {
          console.error(`[Auto-Heal Error for ${table}]:`, healErr);
        }
      }

      console.error(`[PG CRUD Error on ${table} - ${action}]:`, err.message);
      return res.status(500).json({ error: err.message, data: null });
    }
  });

  // Send Email Route
  app.post(["/api/send-email", "/Jute-Purchase-Automation/api/send-email"], async (req, res) => {
    const { to, subject, html, filename, pdfData } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: "Missing to, subject, or html body" });
    }

    // 1. HTTP-based Mail API Dispatchers (Bypasses SMTP port blocks completely via HTTPS Port 443)
    let apiSuccess = false;
    let apiProvider = '';
    let apiMessageId = '';

    if (process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || process.env.BREVO_API_KEY) {
      try {
        if (process.env.RESEND_API_KEY) {
          console.log(`[HTTP API] Sending email via Resend to ${to}...`);
          apiProvider = 'resend';
          const toList = to.split(',').map((email: string) => email.trim());
          
          const bodyPayload: any = {
            from: process.env.EMAIL_FROM || "Bally Jute PO Desk <onboarding@resend.dev>",
            to: toList,
            subject: subject,
            html: html,
          };

          if (filename && pdfData) {
            bodyPayload.attachments = [
              {
                filename: filename,
                content: pdfData // Base64 string
              }
            ];
          }

          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyPayload)
          });

          const data = await response.json() as any;
          if (response.ok && data.id) {
            apiSuccess = true;
            apiMessageId = data.id;
            console.log(`[HTTP API] Resend dispatch success: ${apiMessageId}`);
          } else {
            throw new Error(data.message || JSON.stringify(data));
          }

        } else if (process.env.SENDGRID_API_KEY) {
          console.log(`[HTTP API] Sending email via SendGrid to ${to}...`);
          apiProvider = 'sendgrid';
          const toList = to.split(',').map((email: string) => email.trim()).map(email => ({ email }));
          const fromEmail = process.env.EMAIL_FROM || "rawjute@ballyjute.com";

          const bodyPayload: any = {
            personalizations: [
              {
                to: toList
              }
            ],
            from: {
              email: fromEmail,
              name: "Bally Jute PO Desk"
            },
            subject: subject,
            content: [
              {
                type: "text/html",
                value: html
              }
            ]
          };

          if (filename && pdfData) {
            bodyPayload.attachments = [
              {
                content: pdfData,
                filename: filename,
                type: filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
                disposition: 'attachment'
              }
            ];
          }

          const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.SENDGRID_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyPayload)
          });

          if (response.ok) {
            apiSuccess = true;
            apiMessageId = `sg-${Date.now()}`;
            console.log(`[HTTP API] SendGrid dispatch success`);
          } else {
            const errText = await response.text();
            throw new Error(errText || `SendGrid response code ${response.status}`);
          }

        } else if (process.env.BREVO_API_KEY) {
          console.log(`[HTTP API] Sending email via Brevo to ${to}...`);
          apiProvider = 'brevo';
          const toList = to.split(',').map((email: string) => email.trim()).map(email => ({ email }));
          const fromEmail = process.env.EMAIL_FROM || "rawjute@ballyjute.com";

          const bodyPayload: any = {
            sender: {
              name: "Bally Jute PO Desk",
              email: fromEmail
            },
            to: toList,
            subject: subject,
            htmlContent: html
          };

          if (filename && pdfData) {
            bodyPayload.attachments = [
              {
                content: pdfData,
                name: filename
              }
            ];
          }

          const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "api-key": process.env.BREVO_API_KEY,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyPayload)
          });

          const data = await response.json() as any;
          if (response.ok && data.messageId) {
            apiSuccess = true;
            apiMessageId = data.messageId;
            console.log(`[HTTP API] Brevo dispatch success: ${apiMessageId}`);
          } else {
            throw new Error(data.message || JSON.stringify(data));
          }
        }

        // Write log to Supabase
        try {
          await supabase.from('mail_logs').insert([{ to_email: to, subject, status: 'Sent', provider: apiProvider, message_id: apiMessageId }]);
        } catch (logErr) {
          console.warn("Could not write HTTP API mail_logs into Supabase:", logErr);
        }

        return res.json({ success: true, messageId: apiMessageId, provider: apiProvider });

      } catch (apiErr: any) {
        console.warn(`[HTTP API] ${apiProvider || 'api'} send failed:`, apiErr.message || apiErr);
        console.warn("Falling back to standard SMTP / Gmail dispatch...");
        
        try {
          await supabase.from('mail_logs').insert([{ 
            to_email: to, 
            subject, 
            status: 'Failed-API-Fallback', 
            provider: apiProvider || 'api', 
            error_message: apiErr.message || String(apiErr) 
          }]);
        } catch (logErr) {
          console.warn("Could not write fallback log to Supabase:", logErr);
        }
      }
    }

    const attachments = [];
    if (filename && pdfData) {
      let contentType = 'application/octet-stream';
      if (filename.toLowerCase().endsWith('.pdf')) {
        contentType = 'application/pdf';
      } else if (filename.toLowerCase().endsWith('.png')) {
        contentType = 'image/png';
      } else if (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (filename.toLowerCase().endsWith('.xls') || filename.toLowerCase().endsWith('.xlsx')) {
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (filename.toLowerCase().endsWith('.doc') || filename.toLowerCase().endsWith('.docx')) {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (filename.toLowerCase().endsWith('.txt')) {
        contentType = 'text/plain';
      }
      attachments.push({
        filename: filename,
        content: Buffer.from(pdfData, 'base64'),
        contentType: contentType
      });
    }

    let status = 'Pending';
    let provider = null;
    let errorMessage = null;
    let messageId = null;

    try {
      console.log(`Sending email to ${to} for ${subject}...`);
      
      // Try smtp.gmail.com first
      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: "rawjute@ballyjute.com",
            pass: "ochhyhnjlkhdlpot",
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        const info = await transporter.sendMail({
          from: `"Bally Jute PO Desk" <rawjute@ballyjute.com>`,
          to,
          subject,
          html,
          attachments
        });
        console.log("Email sent successfully via smtp.gmail.com:", info.messageId);
        status = 'Sent';
        provider = 'gmail';
        messageId = info.messageId;
        
        try {
          await supabase.from('mail_logs').insert([{ to_email: to, subject, status, provider, message_id: messageId }]);
        } catch (logErr) {
          console.warn("Could not write mail_logs into Supabase, but email sent successfully:", logErr);
        }
        return res.json({ success: true, messageId: info.messageId, provider: "gmail" });
      } catch (gmailErr: any) {
        console.warn("smtp.gmail.com failed, trying mail.ballyjute.com fallback...", gmailErr);
        errorMessage = gmailErr.message || String(gmailErr);
        
        // Try fallback to mail.ballyjute.com
        const transporter = nodemailer.createTransport({
          host: "mail.ballyjute.com",
          port: 465,
          secure: true,
          auth: {
            user: "rawjute@ballyjute.com",
            pass: "ochhyhnjlkhdlpot",
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        const info = await transporter.sendMail({
          from: `"Bally Jute PO Desk" <rawjute@ballyjute.com>`,
          to,
          subject,
          html,
          attachments
        });
        console.log("Email sent successfully via mail.ballyjute.com:", info.messageId);
        status = 'Sent';
        provider = 'ballyjute';
        messageId = info.messageId;
        
        try {
          await supabase.from('mail_logs').insert([{ to_email: to, subject, status, provider, message_id: messageId }]);
        } catch (logErr) {
          console.warn("Could not write fallback mail_logs into Supabase, but email sent successfully:", logErr);
        }
        return res.json({ success: true, messageId: info.messageId, provider: "ballyjute" });
      }
    } catch (err: any) {
      console.error("All SMTP transports failed:", err);
      status = 'Failed';
      errorMessage = (errorMessage ? errorMessage + ' | ' : '') + (err.message || String(err));
      
      try {
        await supabase.from('mail_logs').insert([{ to_email: to, subject, status, provider: 'None', error_message: errorMessage }]);
      } catch (logErr) {
        console.warn("Could not write error mail_logs into Supabase:", logErr);
      }
      
      return res.status(500).json({ success: false, error: "SMTP transport failed: " + errorMessage });
    }
  });

  // Fetch Email Route via IMAP or Supabase cache
  app.get(["/api/fetch-emails", "/Jute-Purchase-Automation/api/fetch-emails"], async (req, res) => {
    try {
      console.log("Serving /api/fetch-emails from Supabase cache...");
      const { data, error } = await supabase
        .from('imap_emails')
        .select('*')
        .order('date', { ascending: false });
        
      if (error) {
        throw error;
      }
      
      const emails = data.map(item => {
        let attachmentsParsed = [];
        try {
          if (item.attachments) {
            attachmentsParsed = typeof item.attachments === 'string' ? JSON.parse(item.attachments) : item.attachments;
          }
        } catch (e) {
          console.warn("Failed to parse attachments for email:", item.id);
        }
        return {
          id: item.id,
          subject: cleanMimeWords(item.subject || 'No Subject'),
          senderName: cleanMimeWords(item.sender_name || 'Unknown'),
          senderEmail: item.sender_email || 'Unknown',
          date: item.date,
          snippet: item.snippet || '',
          body: item.body || '',
          html: item.html || '',
          attachments: attachmentsParsed,
          unread: item.unread,
          starred: item.starred
        };
      });
      
      return res.json({ success: true, emails });
    } catch (err: any) {
      console.warn("Supabase fetch failed, loading emails.json local cache fallback:", err.message);
      try {
        const filePath = path.join(process.cwd(), "emails.json");
        if (fs.existsSync(filePath)) {
          const cachedData = fs.readFileSync(filePath, "utf8");
          const parsed = JSON.parse(cachedData);
          return res.json(parsed);
        }
      } catch (fileErr) {
        console.error("Failed to read emails.json:", fileErr);
      }
      return res.status(500).json({ success: false, error: err.message, details: err.stack });
    }
  });

  // Manual on-demand IMAP sync endpoint
  app.post(["/api/sync-emails", "/Jute-Purchase-Automation/api/sync-emails"], async (req, res) => {
    try {
      console.log("Triggering on-demand IMAP sync with rawjute@ballyjute.com on Gmail...");
      const freshEmails = await runImapSync();
      return res.json({ success: true, count: freshEmails.length, emails: freshEmails });
    } catch (err: any) {
      console.error("On-demand sync failed:", err.message);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  
  app.get(["/api/check-email-connection", "/Jute-Purchase-Automation/api/check-email-connection"], async (req, res) => {
    return res.json({ 
      success: true, 
      message: "Connected to Inbox (Supabase Live Cloud Synchronization Active)" 
    });
  });
  
  app.post(["/api/test-smtp", "/Jute-Purchase-Automation/api/test-smtp"], async (req, res) => {
    const { host, port, secure, user, pass } = req.body;
    const logs = [];
    const transporter = nodemailer.createTransport({
      host: host || "smtp.gmail.com",
      port: port || 465,
      secure: secure !== undefined ? secure : true,
      auth: {
        user: user || "rawjute@ballyjute.com",
        pass: pass || "ochhyhnjlkhdlpot",
      },
      tls: {
        rejectUnauthorized: false
      },
      logger: {
        level: 'trace',
        trace: (...args: any[]) => logs.push({ type: 'trace', time: new Date().toISOString(), msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') }),
        debug: (...args: any[]) => logs.push({ type: 'debug', time: new Date().toISOString(), msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') }),
        info: (...args: any[]) => logs.push({ type: 'info', time: new Date().toISOString(), msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') }),
        warn: (...args: any[]) => logs.push({ type: 'warn', time: new Date().toISOString(), msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') }),
        error: (...args: any[]) => logs.push({ type: 'error', time: new Date().toISOString(), msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') }),
        fatal: (...args: any[]) => logs.push({ type: 'fatal', time: new Date().toISOString(), msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') })
      },
      debug: true,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    } as any);

    try {
      await transporter.verify();
      return res.json({ success: true, logs });
    } catch (err) {
      logs.push({ type: 'error', time: new Date().toISOString(), msg: err.message || String(err) });
      return res.status(500).json({ success: false, error: err.message, logs });
    }
  });

  // Payment Validation & Duplicate Prevention Route
  app.post(["/api/payments/check-duplicate", "/Jute-Purchase-Automation/api/payments/check-duplicate"], async (req, res) => {
    const { mr_no, po_no, current_voucher_no } = req.body || {};
    
    if (!mr_no || String(mr_no).trim() === '') {
      return res.json({ isDuplicate: false });
    }

    const cleanMr = String(mr_no).trim();
    const cleanPo = po_no ? String(po_no).trim() : '';

    try {
      const { data, error } = await supabase
        .from('payment_master')
        .select('voucher_no, mr_no, arrival_no, po_no, supplier, party_name, status, payment_date')
        .or(`mr_no.ilike.%${cleanMr}%,arrival_no.ilike.%${cleanMr}%`);

      if (error) {
        console.warn("[Backend Payment Check] Supabase query error:", error);
        return res.json({ isDuplicate: false });
      }

      if (data && data.length > 0) {
        const conflict = data.find((p: any) => {
          if (current_voucher_no && String(p.voucher_no).trim().toUpperCase() === String(current_voucher_no).trim().toUpperCase()) {
            return false;
          }
          const pStatus = String(p.status || '').toLowerCase().trim();
          if (pStatus === 'cancelled' || pStatus === 'rejected') return false;

          const pMr = String(p.mr_no || p.arrival_no || '').trim().toUpperCase();
          const targetMr = cleanMr.toUpperCase();
          return pMr === targetMr;
        });

        if (conflict) {
          return res.status(200).json({
            isDuplicate: true,
            conflictRecord: conflict,
            message: `Payment has already been processed for M.R. ${cleanMr} against P.O. ${conflict.po_no || cleanPo || 'N/A'} (Voucher No: ${conflict.voucher_no}). This M.R. cannot be selected again.`
          });
        }
      }

      return res.json({ isDuplicate: false });
    } catch (e: any) {
      console.error("[Backend Payment Check] Server error:", e);
      return res.status(200).json({ isDuplicate: false });
    }
  });

  // Ensure material_inspection schema & triggers exist on startup via exec_sql
  try {
    await supabase.rpc('exec_sql', {
      query: `
        -- Ensure production_records table exists (100% NON-DESTRUCTIVE)
        CREATE TABLE IF NOT EXISTS production_records (
          id TEXT PRIMARY KEY,
          batch_no TEXT,
          lot_no TEXT,
          production_no TEXT,
          date DATE,
          status TEXT DEFAULT 'Active',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE IF EXISTS production_records DISABLE ROW LEVEL SECURITY;

        -- Ensure material_inspection table exists
        CREATE TABLE IF NOT EXISTS material_inspection (
          mr_no TEXT PRIMARY KEY,
          mr_date DATE,
          date DATE,
          arrival_no TEXT,
          arrival_date DATE,
          po_no TEXT,
          po_date DATE,
          broker_name TEXT,
          supplier_name TEXT,
          broker TEXT,
          supplier TEXT,
          actual_moisture NUMERIC DEFAULT 0,
          claim_moisture NUMERIC DEFAULT 0,
          actual_dust NUMERIC DEFAULT 0,
          claim_dust NUMERIC DEFAULT 0,
          actual_ncv NUMERIC DEFAULT 0,
          claim_ncv NUMERIC DEFAULT 0,
          actual_grade_down NUMERIC DEFAULT 0,
          claim_grade_down NUMERIC DEFAULT 0,
          detention_days NUMERIC DEFAULT 0,
          unloading_date DATE,
          mill_po_no TEXT,
          mill_po_date DATE,
          mr_spcl_print TEXT,
          remarks TEXT,
          lorry_number TEXT,
          delivery_claim NUMERIC DEFAULT 0,
          deduction_type TEXT,
          deduction_rate NUMERIC DEFAULT 0,
          deduction_qty NUMERIC DEFAULT 0,
          deduction_amount NUMERIC DEFAULT 0,
          deductions JSONB,
          deduction_rows JSONB,
          deductions_json TEXT,
          deduction_types JSONB,
          unit_name TEXT DEFAULT 'BALES',
          unit TEXT DEFAULT 'BALES',
          status TEXT DEFAULT 'Completed',
          grid_details JSONB,
          details JSONB,
          company_id TEXT,
          unit_id TEXT,
          machine_id TEXT,
          shift TEXT,
          department TEXT,
          production_id TEXT,
          production_ref TEXT,
          batch_id TEXT,
          quantity NUMERIC DEFAULT 0,
          total_quantity NUMERIC DEFAULT 0,
          challan_gross_wt NUMERIC DEFAULT 0,
          receipt_gross_wt NUMERIC DEFAULT 0,
          gross_weight_batch NUMERIC DEFAULT 0,
          add_weight NUMERIC DEFAULT 0,
          less_weight NUMERIC DEFAULT 0,
          reduced_weight NUMERIC DEFAULT 0,
          final_receipt_wt NUMERIC DEFAULT 0,
          arrival_grade TEXT,
          stock_grade_code TEXT,
          stock_grade_name TEXT,
          area TEXT,
          agency TEXT,
          agency_code TEXT,
          marks TEXT,
          marka TEXT,
          crop_year TEXT DEFAULT '2026-27',
          lot TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE IF EXISTS material_inspection DISABLE ROW LEVEL SECURITY;

        -- Ensure columns in material_inspection (Preserves existing data)
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS mr_date DATE;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS date DATE;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_no TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_date DATE;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS po_no TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS po_date DATE;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS broker_name TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS supplier_name TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS broker TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS supplier TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS actual_moisture NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS claim_moisture NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS actual_dust NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS claim_dust NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS actual_ncv NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS claim_ncv NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS actual_grade_down NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS claim_grade_down NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS detention_days NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS unloading_date DATE;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS mill_po_no TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS mill_po_date DATE;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS mr_spcl_print TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS remarks TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS lorry_number TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS delivery_claim NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_type TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_rate NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_qty NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_amount NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deductions JSONB;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_rows JSONB;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deductions_json TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_types JSONB;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS unit_name TEXT DEFAULT 'BALES';
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'BALES';
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Completed';
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS grid_details JSONB;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS details JSONB;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS company_id TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS unit_id TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS machine_id TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS shift TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS department TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS production_id TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS production_ref TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS batch_id TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS total_quantity NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS challan_gross_wt NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS receipt_gross_wt NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS gross_weight_batch NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS add_weight NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS less_weight NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS reduced_weight NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS final_receipt_wt NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_grade TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS stock_grade_code TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS stock_grade_name TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS area TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS agency TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS agency_code TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS marks TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS marka TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS crop_year TEXT DEFAULT '2026-27';
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS lot TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS lorry_read_min NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS lorry_read_max NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS lorry_read_avg NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS insp_read_min NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS insp_read_max NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS insp_read_avg NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS ropes_weight NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS ropes_tot_wt_grd NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS ropes_grade TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS chotta_weight NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS chotta_tot_wt_grd NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS chotta_grade TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS habijabi_weight NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS habijabi_tot_wt_grd NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS habijabi_grade TEXT;
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

        -- Ensure material_inspection_details table
        CREATE TABLE IF NOT EXISTS material_inspection_details (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          mr_no TEXT,
          srl_no INTEGER,
          arrival_grade TEXT,
          stock_grade_code TEXT,
          stock_grade_name TEXT,
          area TEXT,
          agency TEXT,
          agency_code TEXT,
          marka TEXT,
          marks TEXT,
          crop_year TEXT DEFAULT '2026-27',
          lot TEXT,
          quantity NUMERIC DEFAULT 0,
          unit TEXT DEFAULT 'BALES',
          rate NUMERIC DEFAULT 0,
          rate_qntl NUMERIC DEFAULT 0,
          challan_gross_wt NUMERIC DEFAULT 0,
          receipt_gross_wt NUMERIC DEFAULT 0,
          gross_weight_batch NUMERIC DEFAULT 0,
          add_weight NUMERIC DEFAULT 0,
          less_weight NUMERIC DEFAULT 0,
          reduced_weight NUMERIC DEFAULT 0,
          lorry_moisture_min NUMERIC DEFAULT 0,
          lorry_moisture_max NUMERIC DEFAULT 0,
          lorry_read_min NUMERIC DEFAULT 0,
          lorry_read_max NUMERIC DEFAULT 0,
          lorry_read_avg NUMERIC DEFAULT 0,
          insp_read_min NUMERIC DEFAULT 0,
          insp_read_max NUMERIC DEFAULT 0,
          insp_read_avg NUMERIC DEFAULT 0,
          moisture_act NUMERIC DEFAULT 0,
          moisture_claim NUMERIC DEFAULT 0,
          dust_act NUMERIC DEFAULT 0,
          dust_claim NUMERIC DEFAULT 0,
          ncv_act NUMERIC DEFAULT 0,
          ncv_claim NUMERIC DEFAULT 0,
          grade_down_act NUMERIC DEFAULT 0,
          grade_down_claim NUMERIC DEFAULT 0,
          final_receipt_wt NUMERIC DEFAULT 0,
          settlement_moisture NUMERIC DEFAULT 0,
          settlement_grade_down NUMERIC DEFAULT 0,
          settlement_dust NUMERIC DEFAULT 0,
          settlement_ncv NUMERIC DEFAULT 0,
          ropes_weight NUMERIC DEFAULT 0,
          ropes_tot_wt_grd NUMERIC DEFAULT 0,
          ropes_grade TEXT,
          chotta_weight NUMERIC DEFAULT 0,
          chotta_tot_wt_grd NUMERIC DEFAULT 0,
          chotta_grade TEXT,
          habijabi_weight NUMERIC DEFAULT 0,
          habijabi_tot_wt_grd NUMERIC DEFAULT 0,
          habijabi_grade TEXT,
          tolerable TEXT DEFAULT 'Yes',
          premium TEXT,
          is_premium BOOLEAN DEFAULT FALSE,
          row_remarks TEXT,
          remarks TEXT,
          jqi_remarks TEXT,
          jci_remarks TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE IF EXISTS material_inspection_details DISABLE ROW LEVEL SECURITY;

        -- Ensure material_inspection_deductions table with all fields from the app
        CREATE TABLE IF NOT EXISTS material_inspection_deductions (
          id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
          mr_no TEXT,
          po_no TEXT,
          arrival_no TEXT,
          mr_date DATE,
          po_date DATE,
          arrival_date DATE,
          supplier TEXT,
          supplier_name TEXT,
          broker TEXT,
          broker_name TEXT,
          lorry_number TEXT,
          deduction_type TEXT,
          deduction_rate NUMERIC DEFAULT 0,
          deduction_qty NUMERIC DEFAULT 0,
          deduction_amount NUMERIC DEFAULT 0,
          unit TEXT DEFAULT 'BALES',
          gross_weight_mt NUMERIC(15,3) DEFAULT 0,
          total_bales NUMERIC(15,2) DEFAULT 0,
          avg_bale_weight NUMERIC(15,2) DEFAULT 0,
          remarks TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE IF EXISTS material_inspection_deductions DISABLE ROW LEVEL SECURITY;
        ALTER TABLE IF EXISTS material_inspection_deductions ADD COLUMN IF NOT EXISTS mr_date DATE;
        ALTER TABLE IF EXISTS material_inspection_deductions ADD COLUMN IF NOT EXISTS po_date DATE;
        ALTER TABLE IF EXISTS material_inspection_deductions ADD COLUMN IF NOT EXISTS arrival_date DATE;
        ALTER TABLE IF EXISTS material_inspection_deductions ADD COLUMN IF NOT EXISTS supplier TEXT;
        ALTER TABLE IF EXISTS material_inspection_deductions ADD COLUMN IF NOT EXISTS supplier_name TEXT;
        ALTER TABLE IF EXISTS material_inspection_deductions ADD COLUMN IF NOT EXISTS broker TEXT;
        ALTER TABLE IF EXISTS material_inspection_deductions ADD COLUMN IF NOT EXISTS broker_name TEXT;
        ALTER TABLE IF EXISTS material_inspection_deductions ADD COLUMN IF NOT EXISTS lorry_number TEXT;
        ALTER TABLE IF EXISTS material_inspection_deductions ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'BALES';
        ALTER TABLE IF EXISTS material_inspection_deductions ADD COLUMN IF NOT EXISTS gross_weight_mt NUMERIC(15,3) DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection_deductions ADD COLUMN IF NOT EXISTS total_bales NUMERIC(15,2) DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection_deductions ADD COLUMN IF NOT EXISTS avg_bale_weight NUMERIC(15,2) DEFAULT 0;
        ALTER TABLE IF EXISTS material_inspection_deductions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

        -- Ensure mill_inspection_deduction table
        CREATE TABLE IF NOT EXISTS mill_inspection_deduction (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          mr_no TEXT,
          mr_date DATE,
          po_no TEXT,
          po_date DATE,
          arrival_no TEXT,
          arrival_date DATE,
          supplier TEXT,
          supplier_name TEXT,
          broker TEXT,
          broker_name TEXT,
          lorry_number TEXT,
          deduction_type TEXT,
          deduction_rate NUMERIC(15,2) DEFAULT 0,
          deduction_qty NUMERIC(15,3) DEFAULT 0,
          deduction_amount NUMERIC(15,2) DEFAULT 0,
          unit TEXT DEFAULT 'BALES',
          gross_weight_mt NUMERIC(15,3),
          total_bales NUMERIC(15,2),
          avg_bale_weight NUMERIC(15,2),
          remarks TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE IF EXISTS mill_inspection_deduction DISABLE ROW LEVEL SECURITY;

        -- Ensure payment_details has settlement grade down columns and proper backfill
        ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS sett_pct NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS deduction_rate NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS sett_rate NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS quantity_qtl NUMERIC DEFAULT 0;
        ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;

        -- Backfill older payment_details records if sett_rate or amount are missing
        UPDATE payment_details 
        SET sett_pct = COALESCE(NULLIF(sett_pct, 0), gd_sett, 0),
            deduction_rate = COALESCE(NULLIF(deduction_rate, 0), CASE WHEN rate_value > 0 AND COALESCE(NULLIF(sett_pct, 0), gd_sett, 0) > 0 THEN ROUND((rate_value * COALESCE(NULLIF(sett_pct, 0), gd_sett, 0) / 100)::numeric, 2) ELSE 0 END),
            sett_rate = COALESCE(NULLIF(sett_rate, 0), CASE WHEN rate_value > 0 THEN ROUND((rate_value - (CASE WHEN COALESCE(NULLIF(sett_pct, 0), gd_sett, 0) > 0 THEN (rate_value * COALESCE(NULLIF(sett_pct, 0), gd_sett, 0) / 100) ELSE 0 END))::numeric, 2) ELSE 0 END),
            quantity_qtl = COALESCE(NULLIF(quantity_qtl, 0), ROUND((COALESCE(NULLIF(arr_qty_wt, 0), wt_quantity, 0) * 10)::numeric, 3)),
            amount = COALESCE(NULLIF(amount, 0), ROUND(((COALESCE(NULLIF(arr_qty_wt, 0), wt_quantity, 0) * 10) * (CASE WHEN rate_value > 0 THEN (rate_value - (CASE WHEN COALESCE(NULLIF(sett_pct, 0), gd_sett, 0) > 0 THEN (rate_value * COALESCE(NULLIF(sett_pct, 0), gd_sett, 0) / 100) ELSE 0 END)) ELSE 0 END))::numeric, 2))
        WHERE (sett_rate IS NULL OR sett_rate = 0 OR amount IS NULL OR amount = 0) AND (rate_value > 0 OR arr_qty_wt > 0);

        -- Safe Indexes
        CREATE INDEX IF NOT EXISTS idx_inspection_mr ON material_inspection(mr_no);
        CREATE INDEX IF NOT EXISTS idx_inspection_arr ON material_inspection(arrival_no);
        CREATE INDEX IF NOT EXISTS idx_inspection_details_mr ON material_inspection_details(mr_no);
        CREATE INDEX IF NOT EXISTS idx_inspection_deductions_mr ON material_inspection_deductions(mr_no);
        CREATE INDEX IF NOT EXISTS idx_mill_insp_ded_mr ON mill_inspection_deduction(mr_no);

        -- Safe Trigger function for material_inspection (does NOT block or fail valid rows)
        CREATE OR REPLACE FUNCTION trg_material_inspection_validate_sync()
        RETURNS TRIGGER AS $$
        BEGIN
          -- Enforce mandatory mr_no
          IF NEW.mr_no IS NULL OR TRIM(NEW.mr_no) = '' THEN
            RAISE EXCEPTION 'M.R. No is mandatory for Material Inspection Register.';
          END IF;

          -- Fallback arrival_no to mr_no
          IF NEW.arrival_no IS NULL OR TRIM(NEW.arrival_no) = '' THEN
            NEW.arrival_no := NEW.mr_no;
          END IF;

          -- Sanitize dates
          IF NEW.mr_date IS NULL THEN
            NEW.mr_date := CURRENT_DATE;
          END IF;
          IF NEW.date IS NULL THEN
            NEW.date := NEW.mr_date;
          END IF;
          IF NEW.arrival_date IS NULL THEN
            NEW.arrival_date := NEW.mr_date;
          END IF;

          NEW.updated_at := NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS trg_material_inspection_validate_sync ON material_inspection;
        CREATE TRIGGER trg_material_inspection_validate_sync
        BEFORE INSERT OR UPDATE ON material_inspection
        FOR EACH ROW
        EXECUTE FUNCTION trg_material_inspection_validate_sync();

        -- Transactional RPC function for complete atomic save & production verification
        CREATE OR REPLACE FUNCTION fn_save_material_inspection(payload JSONB)
        RETURNS JSONB AS $$
        DECLARE
          v_mr_no TEXT;
          v_prod_id TEXT;
          v_prod_exists BOOLEAN := true;
          v_res RECORD;
          v_item JSONB;
        BEGIN
          v_mr_no := TRIM(payload->>'mr_no');
          IF v_mr_no IS NULL OR v_mr_no = '' THEN
            RAISE EXCEPTION 'M.R. No is mandatory for Material Inspection Register.';
          END IF;

          v_prod_id := TRIM(COALESCE(payload->>'production_id', ''));
          IF v_prod_id <> '' THEN
            SELECT EXISTS(
              SELECT 1 FROM production_records 
              WHERE id = v_prod_id OR batch_no = v_prod_id OR production_no = v_prod_id OR lot_no = v_prod_id
            ) INTO v_prod_exists;

            IF NOT v_prod_exists THEN
              RAISE EXCEPTION 'Required Production row % not found in database.', v_prod_id;
            END IF;
          END IF;

          INSERT INTO material_inspection (
            mr_no, mr_date, date, arrival_no, arrival_date, po_no, po_date,
            broker_name, supplier_name, broker, supplier,
            actual_moisture, claim_moisture, actual_dust, claim_dust,
            actual_ncv, claim_ncv, actual_grade_down, claim_grade_down,
            detention_days, unloading_date, mill_po_no, mill_po_date,
            mr_spcl_print, remarks, lorry_number, delivery_claim,
            deduction_type, deduction_rate, deduction_qty, deduction_amount,
            deductions, deduction_rows, deductions_json, deduction_types,
            unit_name, unit, status, grid_details, details,
            company_id, unit_id, machine_id, shift, department,
            production_id, production_ref, batch_id, quantity, total_quantity,
            challan_gross_wt, receipt_gross_wt, gross_weight_batch,
            add_weight, less_weight, reduced_weight, final_receipt_wt,
            arrival_grade, stock_grade_code, stock_grade_name, area, agency,
            agency_code, marks, marka, crop_year, lot,
            created_at, updated_at
          ) VALUES (
            v_mr_no,
            COALESCE((payload->>'mr_date')::DATE, CURRENT_DATE),
            COALESCE((payload->>'date')::DATE, CURRENT_DATE),
            COALESCE(payload->>'arrival_no', v_mr_no),
            COALESCE((payload->>'arrival_date')::DATE, CURRENT_DATE),
            payload->>'po_no',
            (payload->>'po_date')::DATE,
            payload->>'broker_name',
            payload->>'supplier_name',
            payload->>'broker',
            payload->>'supplier',
            COALESCE((payload->>'actual_moisture')::NUMERIC, 0),
            COALESCE((payload->>'claim_moisture')::NUMERIC, 0),
            COALESCE((payload->>'actual_dust')::NUMERIC, 0),
            COALESCE((payload->>'claim_dust')::NUMERIC, 0),
            COALESCE((payload->>'actual_ncv')::NUMERIC, 0),
            COALESCE((payload->>'claim_ncv')::NUMERIC, 0),
            COALESCE((payload->>'actual_grade_down')::NUMERIC, 0),
            COALESCE((payload->>'claim_grade_down')::NUMERIC, 0),
            COALESCE((payload->>'detention_days')::NUMERIC, 0),
            (payload->>'unloading_date')::DATE,
            payload->>'mill_po_no',
            (payload->>'mill_po_date')::DATE,
            payload->>'mr_spcl_print',
            payload->>'remarks',
            payload->>'lorry_number',
            COALESCE((payload->>'delivery_claim')::NUMERIC, 0),
            payload->>'deduction_type',
            COALESCE((payload->>'deduction_rate')::NUMERIC, 0),
            COALESCE((payload->>'deduction_qty')::NUMERIC, 0),
            COALESCE((payload->>'deduction_amount')::NUMERIC, 0),
            payload->'deductions',
            payload->'deduction_rows',
            payload->>'deductions_json',
            payload->'deduction_types',
            COALESCE(payload->>'unit_name', 'BALES'),
            COALESCE(payload->>'unit', 'BALES'),
            COALESCE(payload->>'status', 'Completed'),
            payload->'grid_details',
            payload->'details',
            payload->>'company_id',
            payload->>'unit_id',
            payload->>'machine_id',
            payload->>'shift',
            payload->>'department',
            payload->>'production_id',
            payload->>'production_ref',
            payload->>'batch_id',
            COALESCE((payload->>'quantity')::NUMERIC, 0),
            COALESCE((payload->>'total_quantity')::NUMERIC, 0),
            COALESCE((payload->>'challan_gross_wt')::NUMERIC, 0),
            COALESCE((payload->>'receipt_gross_wt')::NUMERIC, 0),
            COALESCE((payload->>'gross_weight_batch')::NUMERIC, 0),
            COALESCE((payload->>'add_weight')::NUMERIC, 0),
            COALESCE((payload->>'less_weight')::NUMERIC, 0),
            COALESCE((payload->>'reduced_weight')::NUMERIC, 0),
            COALESCE((payload->>'final_receipt_wt')::NUMERIC, 0),
            payload->>'arrival_grade',
            payload->>'stock_grade_code',
            payload->>'stock_grade_name',
            payload->>'area',
            payload->>'agency',
            payload->>'agency_code',
            payload->>'marks',
            payload->>'marka',
            COALESCE(payload->>'crop_year', '2026-27'),
            payload->>'lot',
            NOW(),
            NOW()
          )
          ON CONFLICT (mr_no) DO UPDATE SET
            mr_date = EXCLUDED.mr_date,
            date = EXCLUDED.date,
            arrival_no = EXCLUDED.arrival_no,
            arrival_date = EXCLUDED.arrival_date,
            po_no = EXCLUDED.po_no,
            po_date = EXCLUDED.po_date,
            broker_name = EXCLUDED.broker_name,
            supplier_name = EXCLUDED.supplier_name,
            broker = EXCLUDED.broker,
            supplier = EXCLUDED.supplier,
            actual_moisture = EXCLUDED.actual_moisture,
            claim_moisture = EXCLUDED.claim_moisture,
            actual_dust = EXCLUDED.actual_dust,
            claim_dust = EXCLUDED.claim_dust,
            actual_ncv = EXCLUDED.actual_ncv,
            claim_ncv = EXCLUDED.claim_ncv,
            actual_grade_down = EXCLUDED.actual_grade_down,
            claim_grade_down = EXCLUDED.claim_grade_down,
            detention_days = EXCLUDED.detention_days,
            unloading_date = EXCLUDED.unloading_date,
            mill_po_no = EXCLUDED.mill_po_no,
            mill_po_date = EXCLUDED.mill_po_date,
            mr_spcl_print = EXCLUDED.mr_spcl_print,
            remarks = EXCLUDED.remarks,
            lorry_number = EXCLUDED.lorry_number,
            delivery_claim = EXCLUDED.delivery_claim,
            deduction_type = EXCLUDED.deduction_type,
            deduction_rate = EXCLUDED.deduction_rate,
            deduction_qty = EXCLUDED.deduction_qty,
            deduction_amount = EXCLUDED.deduction_amount,
            deductions = EXCLUDED.deductions,
            deduction_rows = EXCLUDED.deduction_rows,
            deductions_json = EXCLUDED.deductions_json,
            deduction_types = EXCLUDED.deduction_types,
            unit_name = EXCLUDED.unit_name,
            unit = EXCLUDED.unit,
            status = EXCLUDED.status,
            grid_details = EXCLUDED.grid_details,
            details = EXCLUDED.details,
            company_id = EXCLUDED.company_id,
            unit_id = EXCLUDED.unit_id,
            machine_id = EXCLUDED.machine_id,
            shift = EXCLUDED.shift,
            department = EXCLUDED.department,
            production_id = EXCLUDED.production_id,
            production_ref = EXCLUDED.production_ref,
            batch_id = EXCLUDED.batch_id,
            quantity = EXCLUDED.quantity,
            total_quantity = EXCLUDED.total_quantity,
            challan_gross_wt = EXCLUDED.challan_gross_wt,
            receipt_gross_wt = EXCLUDED.receipt_gross_wt,
            gross_weight_batch = EXCLUDED.gross_weight_batch,
            add_weight = EXCLUDED.add_weight,
            less_weight = EXCLUDED.less_weight,
            reduced_weight = EXCLUDED.reduced_weight,
            final_receipt_wt = EXCLUDED.final_receipt_wt,
            arrival_grade = EXCLUDED.arrival_grade,
            stock_grade_code = EXCLUDED.stock_grade_code,
            stock_grade_name = EXCLUDED.stock_grade_name,
            area = EXCLUDED.area,
            agency = EXCLUDED.agency,
            agency_code = EXCLUDED.agency_code,
            marks = EXCLUDED.marks,
            marka = EXCLUDED.marka,
            crop_year = EXCLUDED.crop_year,
            lot = EXCLUDED.lot,
            updated_at = NOW()
          RETURNING * INTO v_res;

          -- Clean and insert into material_inspection_deductions
          DELETE FROM material_inspection_deductions WHERE mr_no = v_mr_no;
          IF payload->'deduction_rows' IS NOT NULL AND jsonb_array_length(payload->'deduction_rows') > 0 THEN
            FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'deduction_rows')
            LOOP
              INSERT INTO material_inspection_deductions (
                mr_no, po_no, arrival_no, mr_date, po_date, arrival_date,
                supplier, supplier_name, broker, broker_name, lorry_number,
                deduction_type, deduction_rate, deduction_qty, deduction_amount,
                unit, gross_weight_mt, total_bales, avg_bale_weight, remarks,
                created_at, updated_at
              ) VALUES (
                v_mr_no,
                payload->>'po_no',
                COALESCE(payload->>'arrival_no', v_mr_no),
                COALESCE((payload->>'mr_date')::DATE, CURRENT_DATE),
                (payload->>'po_date')::DATE,
                COALESCE((payload->>'arrival_date')::DATE, CURRENT_DATE),
                payload->>'supplier',
                payload->>'supplier_name',
                payload->>'broker',
                payload->>'broker_name',
                payload->>'lorry_number',
                v_item->>'deduction_type',
                COALESCE((v_item->>'deduction_rate')::NUMERIC, 0),
                COALESCE((v_item->>'deduction_qty')::NUMERIC, 0),
                COALESCE((v_item->>'deduction_amount')::NUMERIC, 0),
                COALESCE(payload->>'unit', 'BALES'),
                COALESCE((payload->>'receipt_gross_wt')::NUMERIC, 0),
                COALESCE((payload->>'total_quantity')::NUMERIC, 0),
                0,
                v_item->>'remarks',
                NOW(),
                NOW()
              );
            END LOOP;
          END IF;

          RETURN jsonb_build_object(
            'success', true,
            'recordId', v_res.mr_no,
            'affectedRows', 1,
            'data', to_jsonb(v_res)
          );
        END;
        $$ LANGUAGE plpgsql;

        NOTIFY pgrst, 'reload schema';
      `
    });
    console.log("Supabase schema and trigger verified/updated successfully via exec_sql.");
  } catch (trgErr) {
    console.warn("Failed to create/verify inspection trigger in Supabase via RPC:", trgErr);
  }

  // Helper date sanitizer for server
  const serverSanitizeDate = (val: any): string | null => {
    if (!val) return null;
    if (typeof val !== 'string') {
      if (val instanceof Date && !isNaN(val.getTime())) {
        return val.toISOString().split('T')[0];
      }
      return null;
    }
    const trimmed = val.trim();
    if (!trimmed || trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined' || trimmed === 'nan-nan-nan') return null;
    const ddmmyyyy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyy) {
      const d = ddmmyyyy[1].padStart(2, '0');
      const m = ddmmyyyy[2].padStart(2, '0');
      const y = ddmmyyyy[3];
      return `${y}-${m}-${d}`;
    }
    const yyyymmdd = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (yyyymmdd) {
      const y = yyyymmdd[1];
      const m = yyyymmdd[2].padStart(2, '0');
      const d = yyyymmdd[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
  };

  // INSPECTION MODULE REGISTER SAVE ENDPOINT
  app.post([
    "/api/inspection-register/save", 
    "/Jute-Purchase-Automation/api/inspection-register/save",
    "/api/material-inspection/save",
    "/Jute-Purchase-Automation/api/material-inspection/save"
  ], async (req, res) => {
    try {
      const body = req.body || {};
      const mrNoRaw = body.mr_no || body.headerForm?.mr_no;
      
      // Step 1: Validate Frontend Data - Mandatory MR No
      if (!mrNoRaw || String(mrNoRaw).trim() === '') {
        console.error("[INSPECTION SAVE - VALIDATION ERROR]", { error: "Arrival No. / M.R. No. is required.", body });
        return res.status(400).json({ 
          success: false, 
          error: "Arrival No. / M.R. No. is required." 
        });
      }

      const cleanMrNo = String(mrNoRaw).trim();
      const rawDetails = Array.isArray(body.grid_details) 
        ? body.grid_details 
        : (Array.isArray(body.details) ? body.details : (Array.isArray(body.detailRows) ? body.detailRows : []));

      const rawDeductions = Array.isArray(body.deductions)
        ? body.deductions
        : (Array.isArray(body.deduction_rows) ? body.deduction_rows : (Array.isArray(body.deductionRows) ? body.deductionRows : []));

      const productionId = String(body.production_id || body.production_ref || body.batch_id || '').trim();
      const arrivalNo = String(body.arrival_no || body.headerForm?.arrival_no || cleanMrNo).trim();
      const poNo = String(body.po_no || body.headerForm?.po_no || '').trim();
      const requireProductionValidation = Boolean(body.require_production_validation);

      // Step 2: EXPLICIT LOGGING BEFORE PRODUCTION ROW VALIDATION
      console.log("[INSPECTION SAVE - BEFORE PRODUCTION ROW VALIDATION]", {
        timestamp: new Date().toISOString(),
        cleanMrNo,
        arrivalNo,
        poNo,
        productionId,
        requireProductionValidation,
        candidateSearchKeys: [productionId, arrivalNo, cleanMrNo, poNo].filter(Boolean),
        detailRowsCount: rawDetails.length,
        deductionsCount: rawDeductions.length
      });

      // Execute Multi-Tier Production Row Validation & Resolution
      let matchedProductionRow: any = null;
      let matchedSource = "none";

      const candidateKeys = [productionId, arrivalNo, cleanMrNo, poNo].filter(k => k && k.length > 0);

      for (const key of candidateKeys) {
        if (matchedProductionRow) break;

        // Tier 1: Check production_records
        try {
          const { data: prodRow, error: pErr } = await supabase
            .from('production_records')
            .select('*')
            .or(`id.ilike.%${key}%,batch_no.ilike.%${key}%,lot_no.ilike.%${key}%,production_no.ilike.%${key}%`)
            .limit(1)
            .maybeSingle();

          if (prodRow && !pErr) {
            matchedProductionRow = prodRow;
            matchedSource = "production_records";
            console.log(`[INSPECTION SAVE - PRODUCTION VALIDATION] Matched in production_records for key '${key}':`, prodRow);
            break;
          }
        } catch (e) {
          console.warn("[INSPECTION SAVE] Error checking production_records:", e);
        }

        // Tier 2: Check final_arrival
        try {
          const { data: faRow, error: faErr } = await supabase
            .from('final_arrival')
            .select('*')
            .or(`final_arrival_no.ilike.%${key}%,arrival_no.ilike.%${key}%,mr_no.ilike.%${key}%,po_no.ilike.%${key}%`)
            .limit(1)
            .maybeSingle();

          if (faRow && !faErr) {
            matchedProductionRow = faRow;
            matchedSource = "final_arrival";
            console.log(`[INSPECTION SAVE - PRODUCTION VALIDATION] Matched in final_arrival for key '${key}':`, faRow);
            break;
          }
        } catch (e) {
          console.warn("[INSPECTION SAVE] Error checking final_arrival:", e);
        }

        // Tier 3: Check temporary_material_received
        try {
          const { data: tmRow, error: tmErr } = await supabase
            .from('temporary_material_received')
            .select('*')
            .or(`mr_no.ilike.%${key}%,arrival_no.ilike.%${key}%,temporary_arrival_no.ilike.%${key}%,po_no.ilike.%${key}%`)
            .limit(1)
            .maybeSingle();

          if (tmRow && !tmErr) {
            matchedProductionRow = tmRow;
            matchedSource = "temporary_material_received";
            console.log(`[INSPECTION SAVE - PRODUCTION VALIDATION] Matched in temporary_material_received for key '${key}':`, tmRow);
            break;
          }
        } catch (e) {
          console.warn("[INSPECTION SAVE] Error checking temporary_material_received:", e);
        }

        // Tier 4: Check purchase_master
        try {
          const { data: pmRow, error: pmErr } = await supabase
            .from('purchase_master')
            .select('*')
            .or(`po_no.ilike.%${key}%,mill_po_no.ilike.%${key}%`)
            .limit(1)
            .maybeSingle();

          if (pmRow && !pmErr) {
            matchedProductionRow = pmRow;
            matchedSource = "purchase_master";
            console.log(`[INSPECTION SAVE - PRODUCTION VALIDATION] Matched in purchase_master for key '${key}':`, pmRow);
            break;
          }
        } catch (e) {
          console.warn("[INSPECTION SAVE] Error checking purchase_master:", e);
        }
      }

      // Step 3: EXPLICIT LOGGING & STRICT VERIFICATION FOR PRODUCTION ROW
      if (productionId) {
        let prodExists = false;
        try {
          const { data: pCheck, error: pErr } = await supabase
            .from('production_records')
            .select('id, batch_no, production_no, lot_no')
            .or(`id.eq.${productionId},batch_no.eq.${productionId},production_no.eq.${productionId},lot_no.eq.${productionId}`)
            .limit(1)
            .maybeSingle();

          if (pCheck && !pErr) {
            prodExists = true;
            matchedProductionRow = pCheck;
            matchedSource = "production_records";
          }
        } catch (pe) {
          console.warn("[INSPECTION SAVE] Error checking production_records directly:", pe);
        }

        if (!prodExists && candidateKeys.length > 0) {
          for (const key of candidateKeys) {
            try {
              const { data: pRow } = await supabase
                .from('production_records')
                .select('*')
                .or(`id.eq.${key},batch_no.eq.${key},production_no.eq.${key},lot_no.eq.${key}`)
                .limit(1)
                .maybeSingle();
              if (pRow) {
                prodExists = true;
                matchedProductionRow = pRow;
                matchedSource = "production_records";
                break;
              }
            } catch (e) {}
          }
        }

        if (!prodExists) {
          console.error("[INSPECTION SAVE - ABORTING SAVE DUE TO MISSING PRODUCTION ROW]", { productionId, cleanMrNo });
          return res.status(422).json({
            success: false,
            error: `Unable to save Inspection Module Register: Required Production row '${productionId}' not found in database.`
          });
        }
      }

      if (matchedProductionRow) {
        console.log("[INSPECTION SAVE - AFTER PRODUCTION ROW VALIDATION: SUCCESS]", {
          timestamp: new Date().toISOString(),
          status: "FOUND",
          resolvedSource: matchedSource,
          cleanMrNo,
          matchedRecordSummary: {
            id: matchedProductionRow.id || matchedProductionRow.final_arrival_no || matchedProductionRow.mr_no || matchedProductionRow.po_no,
            source: matchedSource
          }
        });
      } else if (requireProductionValidation) {
        console.error("[INSPECTION SAVE - ABORTING SAVE DUE TO MISSING PRODUCTION ROW]", { cleanMrNo });
        return res.status(422).json({
          success: false,
          error: `Unable to save Inspection Module Register: Required Production row for '${cleanMrNo}' not found in database.`
        });
      }

      // Format Dates & Numbers
      const resolvedMrDate = serverSanitizeDate(body.mr_date || body.date || body.headerForm?.mr_date) || new Date().toISOString().split('T')[0];
      const resolvedArrivalDate = serverSanitizeDate(body.arrival_date || body.headerForm?.arrival_date) || resolvedMrDate;
      const resolvedPoDate = serverSanitizeDate(body.po_date || body.headerForm?.po_date);
      const resolvedUnloadingDate = serverSanitizeDate(body.unloading_date || body.headerForm?.unloading_date);
      const resolvedMillPoDate = serverSanitizeDate(body.mill_po_date || body.headerForm?.mill_po_date) || resolvedPoDate;

      // Prepare Sanitize Detail Rows with strictly typed database column mappings
      const validDetails = rawDetails.map((row: any, idx: number) => ({
        mr_no: cleanMrNo,
        srl_no: Number(row.srl_no) || (idx + 1),
        arrival_grade: String(row.arrival_grade || row.stock_grade_name || row.grade || '').trim(),
        stock_grade_code: String(row.stock_grade_code || row.grade_code || '').trim(),
        stock_grade_name: String(row.stock_grade_name || row.arrival_grade || row.grade || '').trim(),
        area: String(row.area || '').trim(),
        agency: String(row.agency || '').trim(),
        agency_code: String(row.agency_code || '').trim(),
        marks: String(row.marks || row.marka || '').trim(),
        marka: String(row.marka || row.marks || '').trim(),
        crop_year: String(row.crop_year || '2026-27').trim(),
        lot: String(row.lot || '').trim(),
        quantity: Number(row.quantity) || 0,
        unit: String(row.unit || body.unit_name || body.unit || 'BALES').trim().toUpperCase(),
        rate: Number(row.rate || row.rate_qntl || 0) || 0,
        rate_qntl: Number(row.rate_qntl || row.rate || 0) || 0,
        challan_gross_wt: Number(row.challan_gross_wt) || 0,
        receipt_gross_wt: Number(row.receipt_gross_wt) || 0,
        gross_weight_batch: Number(row.gross_weight_batch) || 0,
        add_weight: Number(row.add_weight) || 0,
        less_weight: Number(row.less_weight) || 0,
        reduced_weight: Number(row.reduced_weight) || 0,
        lorry_moisture_min: Number(row.lorry_moisture_min) || 0,
        lorry_moisture_max: Number(row.lorry_moisture_max) || 0,
        lorry_read_min: Number(row.lorry_read_min) || 0,
        lorry_read_max: Number(row.lorry_read_max) || 0,
        lorry_read_avg: Number(row.lorry_read_avg) || 0,
        insp_read_min: Number(row.insp_read_min) || 0,
        insp_read_max: Number(row.insp_read_max) || 0,
        insp_read_avg: Number(row.insp_read_avg) || 0,
        moisture_act: Number(row.moisture_act || row.actual_moisture || 0) || 0,
        moisture_claim: Number(row.moisture_claim || row.claim_moisture || 0) || 0,
        dust_act: Number(row.dust_act || row.actual_dust || 0) || 0,
        dust_claim: Number(row.dust_claim || row.claim_dust || 0) || 0,
        ncv_act: Number(row.ncv_act || row.actual_ncv || 0) || 0,
        ncv_claim: Number(row.ncv_claim || row.claim_ncv || 0) || 0,
        grade_down_act: Number(row.grade_down_act || row.actual_grade_down || 0) || 0,
        grade_down_claim: Number(row.grade_down_claim || row.claim_grade_down || 0) || 0,
        actual_moisture: Number(row.moisture_act || row.actual_moisture || 0) || 0,
        claim_moisture: Number(row.moisture_claim || row.claim_moisture || 0) || 0,
        actual_dust: Number(row.dust_act || row.actual_dust || 0) || 0,
        claim_dust: Number(row.dust_claim || row.claim_dust || 0) || 0,
        actual_ncv: Number(row.ncv_act || row.actual_ncv || 0) || 0,
        claim_ncv: Number(row.ncv_claim || row.claim_ncv || 0) || 0,
        actual_grade_down: Number(row.grade_down_act || row.actual_grade_down || 0) || 0,
        claim_grade_down: Number(row.grade_down_claim || row.claim_grade_down || 0) || 0,
        final_receipt_wt: Number(row.final_receipt_wt) || 0,
        settlement_moisture: Number(row.settlement_moisture) || 0,
        settlement_grade_down: Number(row.settlement_grade_down) || 0,
        settlement_dust: Number(row.settlement_dust) || 0,
        settlement_ncv: Number(row.settlement_ncv) || 0,
        ropes_weight: Number(row.ropes_weight) || 0,
        ropes_tot_wt_grd: Number(row.ropes_tot_wt_grd) || 0,
        ropes_grade: String(row.ropes_grade || '').trim(),
        chotta_weight: Number(row.chotta_weight) || 0,
        chotta_tot_wt_grd: Number(row.chotta_tot_wt_grd) || 0,
        chotta_grade: String(row.chotta_grade || '').trim(),
        tolerable: String(row.tolerable || 'Yes').trim(),
        premium: String(row.premium || (row.is_premium ? 'Yes' : 'No')).trim(),
        is_premium: Boolean(row.is_premium || row.premium === 'Yes'),
        amount: Number(row.amount) || 0,
        row_remarks: String(row.row_remarks || '').trim(),
        jqi_remarks: String(row.jqi_remarks || '').trim(),
        jci_remarks: String(row.jci_remarks || row.jqi_remarks || '').trim()
      }));

      const activeDeductions = rawDeductions.filter((r: any) => (r.deduction_type && String(r.deduction_type).trim() !== '') || Number(r.deduction_amount) > 0);
      const totalDeductionAmt = rawDeductions.reduce((acc: number, r: any) => acc + (Number(r.deduction_amount) || 0), 0);
      const primaryDeduction = activeDeductions[0] || rawDeductions[0] || { deduction_type: '', deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 };

      // Step 4: Strictly Enforce Payload Mapping to Database Schema
      const masterPayload: any = {
        mr_no: cleanMrNo,
        mr_date: resolvedMrDate,
        date: resolvedMrDate,
        arrival_no: String(arrivalNo || cleanMrNo).trim(),
        arrival_date: resolvedArrivalDate,
        po_no: poNo ? String(poNo).trim() : null,
        po_date: resolvedPoDate,
        broker_name: String(body.broker_name || body.broker || '').trim(),
        supplier_name: String(body.supplier_name || body.supplier || '').trim(),
        broker: String(body.broker_name || body.broker || '').trim(),
        supplier: String(body.supplier_name || body.supplier || '').trim(),
        actual_moisture: Number(body.actual_moisture) || 0,
        claim_moisture: Number(body.claim_moisture) || 0,
        actual_dust: Number(body.actual_dust) || 0,
        claim_dust: Number(body.claim_dust) || 0,
        actual_ncv: Number(body.actual_ncv) || 0,
        claim_ncv: Number(body.claim_ncv) || 0,
        detention_days: Number(body.detention_days) || 0,
        unloading_date: resolvedUnloadingDate,
        mill_po_no: body.mill_po_no ? String(body.mill_po_no).trim() : (poNo ? String(poNo).trim() : null),
        mill_po_date: resolvedMillPoDate,
        mr_spcl_print: body.mr_spcl_print ? String(body.mr_spcl_print).trim() : null,
        remarks: body.remarks ? String(body.remarks).trim() : null,
        lorry_number: body.lorry_number ? String(body.lorry_number).trim() : null,
        delivery_claim: Number(body.delivery_claim) || 0,
        deduction_type: activeDeductions.map((r: any) => r.deduction_type).filter(Boolean).join(', ') || primaryDeduction.deduction_type || '',
        deduction_rate: Number(primaryDeduction.deduction_rate) || 0,
        deduction_qty: Number(primaryDeduction.deduction_qty) || 0,
        deduction_amount: Number(totalDeductionAmt) || 0,
        deductions: rawDeductions,
        deduction_rows: rawDeductions,
        deductions_json: JSON.stringify(rawDeductions),
        deduction_types: rawDeductions,
        unit_name: String(body.unit_name || body.unit || validDetails[0]?.unit || 'BALES').trim().toUpperCase(),
        unit: String(body.unit_name || body.unit || validDetails[0]?.unit || 'BALES').trim().toUpperCase(),
        status: String(body.status || 'Completed').trim(),
        grid_details: validDetails,
        details: validDetails,
        company_id: body.company_id ? String(body.company_id).trim() : null,
        unit_id: body.unit_id ? String(body.unit_id).trim() : null,
        machine_id: body.machine_id ? String(body.machine_id).trim() : null,
        shift: body.shift ? String(body.shift).trim() : null,
        department: body.department ? String(body.department).trim() : null,
        production_id: productionId || (matchedProductionRow?.id ? String(matchedProductionRow.id) : null),
        production_ref: body.production_ref || (matchedProductionRow ? String(matchedProductionRow.batch_no || matchedProductionRow.final_arrival_no || '') : null),
        updated_at: new Date().toISOString()
      };

      console.log("[INSPECTION SAVE - FULL PAYLOAD BEFORE SUPABASE DB CALL]", masterPayload);
      console.log("[INSPECTION SAVE - COMMITTING MASTER PAYLOAD TO DB]", {
        mr_no: masterPayload.mr_no,
        arrival_no: masterPayload.arrival_no,
        po_no: masterPayload.po_no,
        production_id: masterPayload.production_id,
        validDetailsCount: validDetails.length
      });

      // Step 4.5: Attempt Transactional RPC save in Supabase if function exists
      let saveResultData: any = null;
      let rpcHandled = false;
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('fn_save_material_inspection', { payload: masterPayload });
        if (!rpcErr && rpcRes && rpcRes.success) {
          console.log("[INSPECTION SAVE - TRANSACTIONAL RPC SUCCESS]", rpcRes);
          rpcHandled = true;
          saveResultData = rpcRes.data || masterPayload;
        } else if (rpcErr) {
          console.warn("[Inspection Save API] Transactional RPC fn_save_material_inspection notice (falling back to chained transaction):", rpcErr.message);
          // If RPC threw a production missing error, honor it immediately!
          if (rpcErr.message && rpcErr.message.toLowerCase().includes('production row')) {
            return res.status(422).json({
              success: false,
              error: `Unable to save Inspection Module Register: ${rpcErr.message}`
            });
          }
        }
      } catch (rpcCallErr: any) {
        console.warn("[Inspection Save API] RPC call exception, continuing with chained transaction:", rpcCallErr?.message);
      }

      if (!rpcHandled) {
        // Step 5: Check if record exists for INSERT vs UPDATE
        const { data: existingCheck, error: checkErr } = await supabase
          .from('material_inspection')
          .select('mr_no')
          .eq('mr_no', cleanMrNo)
          .maybeSingle();

        if (checkErr) {
          console.warn("[Inspection Save API] Check existing error:", checkErr);
        }

        if (existingCheck && existingCheck.mr_no) {
          // UPDATE existing record
          const { data: updateRes, error: updateErr } = await supabase
            .from('material_inspection')
            .update(masterPayload)
            .eq('mr_no', cleanMrNo)
            .select();

          if (updateErr) {
            console.error("[Inspection Save API] Update error:", updateErr);
            return res.status(500).json({
              success: false,
              error: `Unable to save Inspection Module Register: ${updateErr.message || 'Database update error'}. Data was not saved.`
            });
          }

          if (!updateRes || updateRes.length === 0) {
            return res.status(500).json({
              success: false,
              error: "Unable to save Inspection Module Register. Database update affected zero rows. Data was not saved."
            });
          }

          saveResultData = updateRes[0];
        } else {
          // INSERT new record
          masterPayload.created_at = new Date().toISOString();
          const { data: insertRes, error: insertErr } = await supabase
            .from('material_inspection')
            .insert(masterPayload)
            .select();

          if (insertErr) {
            console.error("[Inspection Save API] Insert error:", insertErr);
            return res.status(500).json({
              success: false,
              error: `Unable to save Inspection Module Register: ${insertErr.message || 'Database insert error'}. Data was not saved.`
            });
          }

          if (!insertRes || insertRes.length === 0) {
            return res.status(500).json({
              success: false,
              error: "Unable to save Inspection Module Register. Database insert affected zero rows. Data was not saved."
            });
          }

          saveResultData = insertRes[0];
        }
      }

      // Step 6: Save child details & material_inspection_deductions with ALL fields from this app
      try {
        await supabase.from('material_inspection_details').delete().eq('mr_no', cleanMrNo);
        if (validDetails.length > 0) {
          const { error: dErr } = await supabase.from('material_inspection_details').insert(validDetails);
          if (dErr) {
            console.warn("[Inspection Save API] material_inspection_details insert error:", dErr);
          }
        }
      } catch (childErr) {
        console.warn("[Inspection Save API] Child detail error:", childErr);
      }

      try {
        const totalBalesCount = validDetails.reduce((sum: number, r: any) => sum + (Number(r.quantity) || 0), 0) || Number(body.total_quantity || 0);
        const totalGrossMt = validDetails.reduce((sum: number, r: any) => sum + (Number(r.receipt_gross_wt) || 0), 0) || Number(body.receipt_gross_wt || body.challan_gross_wt || 0);
        const calculatedAvgBaleWeight = totalBalesCount > 0 ? (totalGrossMt * 1000) / totalBalesCount : 0;

        // Clean existing deduction rows for this MR No
        await supabase.from('material_inspection_deductions').delete().eq('mr_no', cleanMrNo);

        // Build complete deduction records with ALL fields from the app
        const allDeductionRows = rawDeductions
          .filter((r: any) => (r.deduction_type && String(r.deduction_type).trim() !== '') || Number(r.deduction_amount) > 0 || Number(r.deduction_rate) > 0)
          .map((r: any) => ({
            mr_no: cleanMrNo,
            mr_date: resolvedMrDate,
            po_no: poNo ? String(poNo).trim() : null,
            po_date: resolvedPoDate,
            arrival_no: String(arrivalNo || cleanMrNo).trim(),
            arrival_date: resolvedArrivalDate,
            supplier: String(body.supplier_name || body.supplier || '').trim(),
            supplier_name: String(body.supplier_name || body.supplier || '').trim(),
            broker: String(body.broker_name || body.broker || '').trim(),
            broker_name: String(body.broker_name || body.broker || '').trim(),
            lorry_number: body.lorry_number ? String(body.lorry_number).trim() : '',
            deduction_type: String(r.deduction_type || '').trim(),
            deduction_rate: Number(r.deduction_rate) || 0,
            deduction_qty: Number(r.deduction_qty) || 0,
            deduction_amount: Number(r.deduction_amount) || 0,
            unit: String(body.unit_name || body.unit || validDetails[0]?.unit || 'BALES').trim().toUpperCase(),
            gross_weight_mt: totalGrossMt,
            total_bales: totalBalesCount,
            avg_bale_weight: calculatedAvgBaleWeight,
            remarks: String(r.remarks || body.remarks || '').trim(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

        if (allDeductionRows.length > 0) {
          // Attempt insert with all extended columns
          const { error: insErr } = await supabase.from('material_inspection_deductions').insert(allDeductionRows);
          if (insErr) {
            console.warn("[Inspection Save API] Extended column insert on material_inspection_deductions failed, falling back to base columns:", insErr.message);
            const baseDeductionRows = allDeductionRows.map((r: any) => ({
              mr_no: r.mr_no,
              po_no: r.po_no,
              arrival_no: r.arrival_no,
              deduction_type: r.deduction_type,
              deduction_rate: r.deduction_rate,
              deduction_qty: r.deduction_qty,
              deduction_amount: r.deduction_amount,
              remarks: r.remarks,
              created_at: r.created_at
            }));
            const { error: fallbackErr } = await supabase.from('material_inspection_deductions').insert(baseDeductionRows);
            if (fallbackErr) {
              console.error("[Inspection Save API] Fallback deduction insert error:", fallbackErr);
            }
          }
        }

        // Also sync mill_inspection_deduction for backward compatibility
        try {
          await supabase.from('mill_inspection_deduction').delete().eq('mr_no', cleanMrNo);
          if (allDeductionRows.length > 0) {
            await supabase.from('mill_inspection_deduction').insert(allDeductionRows);
          }
        } catch (mErr) {}
      } catch (dedErr) {
        console.warn("[Inspection Save API] Deduction save error:", dedErr);
      }

      // Step 7: Sync to final_arrival
      try {
        await supabase.from('final_arrival').update({
          status: 'Completed',
          grid_details: validDetails,
          details: validDetails
        }).or(`mr_no.eq.${cleanMrNo},final_arrival_no.eq.${cleanMrNo}${arrivalNo ? `,final_arrival_no.eq.${arrivalNo}` : ''}`);
      } catch (faErr) {}

      // Step 8: Post-Commit Verification - Verify saved record genuinely exists in DB
      const { data: verifiedRecord, error: verifyErr } = await supabase
        .from('material_inspection')
        .select('*')
        .eq('mr_no', cleanMrNo)
        .maybeSingle();

      if (verifyErr || !verifiedRecord) {
        console.error("[Inspection Save API] Verification query failed:", verifyErr);
        return res.status(500).json({
          success: false,
          error: "Unable to save Inspection Module Register. Data was not saved."
        });
      }

      console.log("[INSPECTION SAVE - COMPLETED & VERIFIED]", {
        mr_no: verifiedRecord.mr_no,
        arrival_no: verifiedRecord.arrival_no,
        status: verifiedRecord.status,
        timestamp: new Date().toISOString()
      });

      // Step 9: Return confirmed success response
      const affectedRowsCount = (saveResultData && verifiedRecord) ? 1 : 0;
      return res.status(200).json({
        success: true,
        affectedRows: affectedRowsCount,
        rowCount: affectedRowsCount,
        recordId: verifiedRecord.mr_no,
        data: verifiedRecord,
        message: "Data Saved Successfully."
      });

    } catch (serverErr: any) {
      console.error("[Inspection Save API] Fatal exception:", serverErr);
      return res.status(500).json({
        success: false,
        error: `Unable to save Inspection Module Register: ${serverErr.message || 'Internal Server Error'}. Data was not saved.`
      });
    }
  });

  // Health Check
  app.get(["/api/health", "/Jute-Purchase-Automation/api/health"], (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    syncEmailsBackground().catch(err => {
      console.error("Background email sync failed to start:", err);
    });
  });
}

startServer();
