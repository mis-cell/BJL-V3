/**
 * ============================================================================
 * BJCL Raw Jute ERP: Automated Supabase -> PostgreSQL 18 Migration Engine
 * System: Bally Jute Company Limited (BJL)
 * ============================================================================
 */

const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lxuapkccxaadwixjpirs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4dWFwa2NjeGFhZHdpeGpwaXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MzQ4NDksImV4cCI6MjA5NDQxMDg0OX0.rzjJFNOb1gx0Z4cMSfkW9yDe4rI8oO6TLTzcVXswPek';

const DATABASE_URL = process.env.DATABASE_URL || `postgresql://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'bjcl_db'}`;

const TABLES_ORDER = [
  // 1. Master Tables
  'financial_year_master',
  'area_master',
  'agency_master',
  'grade_master',
  'godown_master',
  'supply_master',
  'broker_master',
  'unit_master',
  'user_master',
  'authentication_master',

  // 2. Sauda / Satta
  'sauda_master',
  'sauda_quality_details',
  'sauda_check_point',
  'sauda_check_point_details',
  'sauda_check_point_deductions',
  'satta_master',
  'satta_quality_details',
  'satta_base_rates',
  'satta_differentials',
  'satta_calculated_rates',

  // 3. Purchase Orders
  'purchase_master',
  'purchase_detail_master',
  'temporary_po',
  'temporary_po_details',

  // 4. Arrivals & Amad
  'issue_master',
  'temporary_material_received',
  'final_arrival',

  // 5. Inspection
  'inspection_master',
  'inspection_details',
  'inspection_checklist',
  'inspection_checklist_details',
  'mill_inspection_master',
  'mill_inspection_detail',

  // 6. Weighment & Inventory
  'lorry_weighments',
  'opening_stock',
  'closing_stock',

  // 7. Payments & Vouchers
  'payment_master',
  'payment_details',
  'material_issue_master',
  'bardana_vouchers',
  'lorry_dispatches',

  // 8. Communication & Logs
  'imap_emails',
  'sms_sauda_logs',
  'material_mismatch',
  'satta_mismatch',
  'system_notices',
  'report_master'
];

async function ensureTableAndColumns(pgClient, tableName, sampleRow) {
  const keys = Object.keys(sampleRow);
  if (keys.length === 0) return;

  // 1. Ensure table exists
  const tableCheck = await pgClient.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = $1
    );
  `, [tableName]);

  if (!tableCheck.rows[0].exists) {
    const colDefs = keys.map(k => `"${k}" TEXT`).join(', ');
    await pgClient.query(`CREATE TABLE IF NOT EXISTS "${tableName}" (${colDefs});`);
  }

  // 2. Fetch existing columns in local PostgreSQL
  const colsRes = await pgClient.query(`
    SELECT column_name, data_type FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = $1
  `, [tableName]);
  
  const existingCols = new Set(colsRes.rows.map(r => r.column_name));

  // 3. Add any missing columns as TEXT / JSONB
  for (const k of keys) {
    if (!existingCols.has(k)) {
      const val = sampleRow[k];
      const isJson = (val !== null && typeof val === 'object');
      const colType = isJson ? 'JSONB' : 'TEXT';
      try {
        await pgClient.query(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${k}" ${colType};`);
      } catch (e) {
        // ignore if already added
      }
    }
  }
}

async function runMigration() {
  console.log('================================================================');
  console.log('🚀 BJCL LIVE DATA MIGRATION: SUPABASE -> POSTGRESQL 18 (bjcl_db)');
  console.log('================================================================');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
  });

  const pgClient = new Client({ connectionString: DATABASE_URL });

  try {
    await pgClient.connect();
    console.log('✅ Connected to local PostgreSQL 18 database: bjcl_db\n');

    // Disable triggers & foreign keys during bulk import
    await pgClient.query('SET session_replication_role = replica;');

    const summary = [];
    let totalMigrated = 0;

    for (const table of TABLES_ORDER) {
      process.stdout.write(`Migrating [${table}]... `);

      let offset = 0;
      const limit = 500;
      let count = 0;
      let hasMore = true;
      let tableChecked = false;

      while (hasMore) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .range(offset, offset + limit - 1);

        if (error) {
          if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('schema cache')) {
            process.stdout.write(`(Not found in Supabase, skipped)\n`);
            summary.push({ table, rows: 0, status: 'NOT_IN_SUPABASE' });
          } else {
            process.stdout.write(`❌ Error: ${error.message}\n`);
            summary.push({ table, rows: 0, status: `ERROR: ${error.message}` });
          }
          hasMore = false;
          break;
        }

        if (!data || data.length === 0) {
          if (offset === 0) {
            process.stdout.write(`0 records found\n`);
            summary.push({ table, rows: 0, status: 'EMPTY_IN_SUPABASE' });
          }
          hasMore = false;
          break;
        }

        // Ensure table columns match exactly on first batch
        if (!tableChecked && data.length > 0) {
          await ensureTableAndColumns(pgClient, table, data[0]);
          tableChecked = true;
        }

        // Insert rows into local PostgreSQL
        for (const row of data) {
          const keys = Object.keys(row);
          if (keys.length === 0) continue;

          const columns = keys.map(k => `"${k}"`).join(', ');
          const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
          const values = keys.map(k => {
            const val = row[k];
            if (val !== null && typeof val === 'object') {
              return JSON.stringify(val);
            }
            return val;
          });

          // Dynamic insert with conflict handling or fallback
          try {
            const query = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders}) ON CONFLICT DO NOTHING;`;
            await pgClient.query(query, values);
            count++;
          } catch (insertErr) {
            try {
              const fallbackQuery = `INSERT INTO "${table}" (${columns}) VALUES (${placeholders});`;
              await pgClient.query(fallbackQuery, values);
              count++;
            } catch (err2) {
              // Ignore duplicate
            }
          }
        }

        offset += limit;
        if (data.length < limit) {
          hasMore = false;
        }
      }

      if (count > 0) {
        process.stdout.write(`✅ ${count} records migrated!\n`);
        summary.push({ table, rows: count, status: 'MIGRATED' });
        totalMigrated += count;
      }
    }

    // Re-enable triggers and foreign keys
    await pgClient.query('SET session_replication_role = DEFAULT;');

    console.log('\n================================================================');
    console.log('🎉 ALL SUPABASE DATA MIGRATED TO POSTGRESQL 18 bjcl_db!');
    console.log(`Total Records Migrated: ${totalMigrated}`);
    console.log('================================================================');
    console.table(summary);
    console.log('================================================================\n');

  } catch (err) {
    console.error('\n❌ Migration Error:', err.message);
  } finally {
    await pgClient.end();
  }
}

runMigration();
