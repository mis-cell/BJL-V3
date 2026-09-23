/**
 * ============================================================================
 * BJCL_DB: Supabase to Standalone SQL Dump Generator
 * ============================================================================
 * Generates a self-contained SQL file (bjcl_db_full_data_dump.sql) containing
 * all DDL schemas + all records exported from Supabase as INSERT statements.
 *
 * Usage:
 *   node scripts/export_supabase_dump.cjs
 * Output:
 *   bjcl_db_full_data_dump.sql
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lxuapkccxaadwixjpirs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4dWFwa2NjeGFhZHdpeGpwaXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MzQ4NDksImV4cCI6MjA5NDQxMDg0OX0.rzjJFNOb1gx0Z4cMSfkW9yDe4rI8oO6TLTzcVXswPek';

const MIGRATION_TABLES = [
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
  'purchase_master',
  'purchase_detail_master',
  'temporary_po',
  'temporary_po_details',
  'issue_master',
  'temporary_material_received',
  'final_arrival',
  'inspection_master',
  'inspection_details',
  'inspection_checklist',
  'inspection_checklist_details',
  'mill_inspection_master',
  'mill_inspection_detail',
  'lorry_weighments',
  'opening_stock',
  'closing_stock',
  'payment_master',
  'payment_details',
  'material_issue_master',
  'bardana_vouchers',
  'lorry_dispatches',
  'imap_emails',
  'sms_sauda_logs',
  'material_mismatch',
  'satta_mismatch',
  'system_notices',
  'report_master'
];

function escapeSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : val.toString();
  if (typeof val === 'object') {
    const str = JSON.stringify(val).replace(/'/g, "''");
    return `'${str}'::jsonb`;
  }
  return `'${val.toString().replace(/'/g, "''")}'`;
}

async function exportDump() {
  console.log('================================================================');
  console.log('📦 EXPORTING SUPABASE DATA TO POSTGRESQL 18 SQL DUMP FILE');
  console.log('================================================================');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const outputFile = path.join(__dirname, '..', 'bjcl_db_full_data_dump.sql');
  const schemaFile = path.join(__dirname, '..', 'init_bjcl_db.sql');

  let outputSql = `-- ============================================================================
-- Standalone PostgreSQL 18 Data Dump for bjcl_db
-- Generated on: ${new Date().toISOString()}
-- Source: Bally Jute ERP Supabase Instance
-- ============================================================================

\\connect bjcl_db;

`;

  if (fs.existsSync(schemaFile)) {
    outputSql += fs.readFileSync(schemaFile, 'utf8') + '\n\n';
  }

  outputSql += `-- Temporarily disable foreign key triggers for fast bulk insert\n`;
  outputSql += `SET session_replication_role = replica;\n\n`;

  let totalRows = 0;

  for (const table of MIGRATION_TABLES) {
    console.log(`Extracting [${table}]...`);
    let offset = 0;
    const limit = 1000;
    let hasMore = true;
    let tableRows = 0;

    while (hasMore) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .range(offset, offset + limit - 1);

      if (error || !data || data.length === 0) {
        hasMore = false;
        break;
      }

      for (const row of data) {
        const cols = Object.keys(row);
        if (cols.length === 0) continue;

        const colStr = cols.map(c => `"${c}"`).join(', ');
        const valStr = cols.map(c => escapeSqlValue(row[c])).join(', ');

        outputSql += `INSERT INTO "${table}" (${colStr}) VALUES (${valStr}) ON CONFLICT DO NOTHING;\n`;
        tableRows++;
        totalRows++;
      }

      offset += limit;
      if (data.length < limit) {
        hasMore = false;
      }
    }
    console.log(`  -> ${tableRows} rows exported.`);
  }

  outputSql += `\n-- Re-enable triggers and foreign keys\n`;
  outputSql += `SET session_replication_role = DEFAULT;\n\n`;
  outputSql += `-- Final confirmation\nSELECT 'Migration data import completed successfully for bjcl_db!' AS status;\n`;

  fs.writeFileSync(outputFile, outputSql, 'utf8');
  console.log('\n================================================================');
  console.log(`✅ Dump file created: ${outputFile}`);
  console.log(`Total Records Exported: ${totalRows}`);
  console.log('To import into your Windows Server 2022 PostgreSQL 18 instance, run:');
  console.log('  psql -U postgres -d bjcl_db -f bjcl_db_full_data_dump.sql');
  console.log('================================================================\n');
}

exportDump().catch(err => {
  console.error('Export Error:', err);
});
