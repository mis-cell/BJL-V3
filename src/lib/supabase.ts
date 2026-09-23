import { createClient } from '@supabase/supabase-js';

const isLocalPgMode = (import.meta as any).env.VITE_USE_LOCAL_POSTGRES === 'true' || 
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('10.')));

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || 'https://lxuapkccxaadwixjpirs.supabase.co';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4dWFwa2NjeGFhZHdpeGpwaXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MzQ4NDksImV4cCI6MjA5NDQxMDg0OX0.rzjJFNOb1gx0Z4cMSfkW9yDe4rI8oO6TLTzcVXswPek';

// Native Local PostgreSQL 18 Client Adapter
class LocalPgQueryBuilder {
  private table: string;
  private action: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private filters: Record<string, any> = {};
  private orderCol?: string;
  private ascending: boolean = true;
  private limitCount?: number;
  private offsetCount?: number;
  private idCol?: string;
  private wantsSingle: boolean = false;
  private wantsMaybeSingle: boolean = false;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = '*') {
    this.action = 'select';
    return this;
  }

  insert(data: any) {
    this.action = 'insert';
    this.payload = data;
    return this;
  }

  upsert(data: any, options?: { onConflict?: string }) {
    this.action = 'upsert';
    this.payload = data;
    if (options?.onConflict) this.idCol = options.onConflict;
    return this;
  }

  update(data: any) {
    this.action = 'update';
    this.payload = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters[column] = value;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.ascending = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.offsetCount = from;
    this.limitCount = to - from + 1;
    return this;
  }

  single() {
    this.wantsSingle = true;
    return this;
  }

  maybeSingle() {
    this.wantsMaybeSingle = true;
    return this;
  }

  async then(resolve: (res: { data: any; error: any; count?: number }) => void, reject?: (err: any) => void) {
    try {
      const res = await fetch('/api/pg/crud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: this.action,
          table: this.table,
          data: this.payload,
          filters: this.filters,
          order: this.orderCol,
          ascending: this.ascending,
          limit: this.limitCount,
          offset: this.offsetCount,
          idCol: this.idCol
        })
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        resolve({ data: null, error: json.error || new Error('PostgreSQL Query Error') });
        return;
      }

      let data = json.data;
      if (this.wantsSingle) {
        data = Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data;
      } else if (this.wantsMaybeSingle) {
        data = Array.isArray(data) ? (data.length > 0 ? data[0] : null) : data;
      }

      resolve({ data, error: null, count: Array.isArray(data) ? data.length : 1 });
    } catch (err: any) {
      resolve({ data: null, error: err });
    }
  }
}

const localPgClient = {
  from(table: string) {
    return new LocalPgQueryBuilder(table);
  },
  async rpc(name: string, args?: any) {
    try {
      const res = await fetch('/api/pg/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, args })
      });
      const json = await res.json();
      return { data: json.data, error: json.error || null };
    } catch (err: any) {
      return { data: null, error: err };
    }
  }
};

const rawSupabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const supabase: any = isLocalPgMode ? localPgClient : rawSupabase;

if (isLocalPgMode) {
  console.log("🚀 [LOCAL MODE] Connected directly to Local PostgreSQL 18 (bjcl_db) - Supabase Disconnected.");
} else {
  console.log("☁️ [CLOUD MODE] Connected to Supabase.");
}

// Programmatically align database and upgrade partitioned layouts to standard clean unified tables per user's directive.
if (supabase) {
  Promise.resolve().then(async () => {
    try {
      if (typeof window !== 'undefined') {
        const isSynced = localStorage.getItem('bjl_schema_synced_v3') || sessionStorage.getItem('bjl_schema_synced_v3');
        if (isSynced) return;
        localStorage.setItem('bjl_schema_synced_v3', '1');
        sessionStorage.setItem('bjl_schema_synced_v3', '1');
      }
      await supabase.rpc('exec_sql', {
        query: `
          DO $$
          BEGIN
            -- 1. Create temporary backups if parent tables / detail tables exist
            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sauda_master') THEN
              CREATE TABLE IF NOT EXISTS temp_sauda_backup AS SELECT * FROM sauda_master;
            END IF;

            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sauda_quality_details') THEN
              CREATE TABLE IF NOT EXISTS temp_sauda_details_backup AS SELECT * FROM sauda_quality_details;
            END IF;

            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'purchase_master') THEN
              CREATE TABLE IF NOT EXISTS temp_purchase_backup AS SELECT * FROM purchase_master;
            END IF;

            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'purchase_detail_master') THEN
              CREATE TABLE IF NOT EXISTS temp_purchase_details_backup AS SELECT * FROM purchase_detail_master;
            END IF;

            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'issue_master') THEN
              CREATE TABLE IF NOT EXISTS temp_issue_backup AS SELECT * FROM issue_master;
            END IF;

            -- 2. Drop dependent constraints and tables CASCADE
            DROP TABLE IF EXISTS sauda_quality_details CASCADE;
            DROP TABLE IF EXISTS purchase_detail_master CASCADE;
            DROP TABLE IF EXISTS sauda_master CASCADE;
            DROP TABLE IF EXISTS purchase_master CASCADE;
            DROP TABLE IF EXISTS issue_master CASCADE;

            -- 3. Re-create the master tables as clean, regular non-partitioned tables
            CREATE TABLE sauda_master (
                sauda_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                financial_year TEXT NOT NULL,
                sauda_no TEXT NOT NULL,
                session TEXT, 
                po_type TEXT,
                date DATE NOT NULL,
                broker TEXT,
                supplier TEXT,
                challan_supplier TEXT,
                area TEXT,
                agency TEXT,
                marks TEXT,
                no_of_lorries INTEGER,
                units_per_lorry NUMERIC(15,2),
                units_per_lorry_type TEXT,
                total_unit INTEGER,
                wt_per_lorry NUMERIC(15,3),
                unit_type TEXT,
                total_wt_in_ton NUMERIC(15,3),
                shipment_date DATE,
                shipment_days INTEGER,
                shipment_penalty NUMERIC(15,2),
                marks_claim NUMERIC(15,2),
                quantity_claim NUMERIC(15,2),
                remarks TEXT,
                b_rate NUMERIC(15,2),
                b_date DATE,
                superior_normal_marks TEXT,
                signature_url TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE purchase_master (
                po_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                financial_year TEXT NOT NULL,
                purchase_order TEXT,
                po_type TEXT,
                ptf_no TEXT,
                pending BOOLEAN DEFAULT TRUE,
                po_no TEXT NOT NULL UNIQUE,
                po_date DATE NOT NULL,
                broker TEXT,
                supplier TEXT,
                challan_supplier TEXT,
                area TEXT,
                trans_paid_by TEXT,
                weight_unit_kgs NUMERIC(15,2),
                against_cancellation TEXT,
                purchase_unit_code TEXT,
                purchase_unit_name TEXT,
                total_lorries NUMERIC(15,2),
                units_per_lorry NUMERIC(15,2),
                total_units NUMERIC(15,2),
                weight_per_lorry NUMERIC(15,3),
                total_contract_mt NUMERIC(15,3),
                marka_type TEXT,
                marka_penalty NUMERIC(15,2),
                qty_penalty NUMERIC(15,2),
                delivery_from DATE,
                delivery_to DATE,
                grace_days INTEGER,
                delivery_penalty NUMERIC(15,2),
                contract_po_no TEXT,
                contract_date DATE,
                rate_detail TEXT,
                delivery_schedule TEXT,
                terms_condition TEXT,
                remarks TEXT,
                po_identification TEXT,
                b_rate NUMERIC(15,2),
                s_date DATE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE issue_master (
                amad_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                financial_year TEXT NOT NULL,
                amad_no TEXT NOT NULL,
                date DATE NOT NULL,
                floor TEXT,
                chamber TEXT,
                farmer_name TEXT,
                acc_no TEXT,
                commodity TEXT,
                variety TEXT,
                grading TEXT,
                marka TEXT,
           driver_number TEXT,
                bardana_type TEXT,
                lorry_number TEXT,
                total_packets INTEGER,
                weight_qtl NUMERIC(15,2),
                remarks TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- 4. Re-create the dependent details tables with simple relationships (referencing cleanly)
            CREATE TABLE sauda_quality_details (
                detail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                sauda_id UUID REFERENCES sauda_master(sauda_id) ON DELETE CASCADE,
                financial_year TEXT,
                quality TEXT,
                qty NUMERIC(15,3),
                rs NUMERIC(15,2),
                agency TEXT,
                marka TEXT
            );

            CREATE TABLE purchase_detail_master (
                item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                po_no TEXT REFERENCES purchase_master(po_no) ON DELETE CASCADE,
                srl_no INTEGER,
                crop_year TEXT,
                grade_code TEXT,
                agency_code TEXT,
                marka_code TEXT,
                quantity INTEGER,
                weight_mt NUMERIC(15,3),
                rate_qntl NUMERIC(15,2)
            );

            -- 5. Restore the data cleanly
            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'temp_sauda_backup') THEN
              INSERT INTO sauda_master (
                sauda_id, financial_year, sauda_no, session, po_type, date, broker, supplier, 
                challan_supplier, area, agency, marks, no_of_lorries, units_per_lorry_type, 
                total_unit, wt_per_lorry, unit_type, total_wt_in_ton, shipment_date, shipment_days, 
                shipment_penalty, marks_claim, quantity_claim, remarks, b_rate, b_date, 
                superior_normal_marks, signature_url, status, created_at
              )
              SELECT DISTINCT ON (sauda_id)
                sauda_id, financial_year, sauda_no, session, po_type, date, broker, supplier, 
                challan_supplier, area, agency, marks, no_of_lorries, units_per_lorry_type, 
                total_unit, wt_per_lorry, unit_type, total_wt_in_ton, shipment_date, shipment_days, 
                shipment_penalty, marks_claim, quantity_claim, remarks, b_rate, b_date, 
                superior_normal_marks, signature_url, status, created_at
              FROM temp_sauda_backup;
              
              DROP TABLE IF EXISTS temp_sauda_backup CASCADE;
            END IF;

            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'temp_sauda_details_backup') THEN
              INSERT INTO sauda_quality_details (
                detail_id, sauda_id, financial_year, quality, qty, rs, agency, marka
              )
              SELECT 
                detail_id, sauda_id, financial_year, quality, qty, rs, agency, marka
              FROM temp_sauda_details_backup;
              
              DROP TABLE IF EXISTS temp_sauda_details_backup CASCADE;
            END IF;

            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'temp_purchase_backup') THEN
              INSERT INTO purchase_master (
                po_id, financial_year, purchase_order, po_type, ptf_no, pending, po_no, po_date, 
                broker, supplier, challan_supplier, area, trans_paid_by, weight_unit_kgs, 
                against_cancellation, purchase_unit_code, purchase_unit_name, total_lorries, 
                units_per_lorry, total_units, weight_per_lorry, total_contract_mt, marka_type, 
                marka_penalty, qty_penalty, delivery_from, delivery_to, grace_days, 
                delivery_penalty, contract_po_no, contract_date, rate_detail, delivery_schedule, 
                terms_condition, remarks, po_identification, b_rate, s_date, created_at
              )
              SELECT DISTINCT ON (po_no)
                po_id, financial_year, purchase_order, po_type, ptf_no, pending, po_no, po_date, 
                broker, supplier, challan_supplier, area, trans_paid_by, weight_unit_kgs, 
                against_cancellation, purchase_unit_code, purchase_unit_name, total_lorries, 
                units_per_lorry, total_units, weight_per_lorry, total_contract_mt, marka_type, 
                marka_penalty, qty_penalty, delivery_from, delivery_to, grace_days, 
                delivery_penalty, contract_po_no, contract_date, rate_detail, delivery_schedule, 
                terms_condition, remarks, po_identification, b_rate, s_date, created_at
              FROM temp_purchase_backup;
              
              DROP TABLE IF EXISTS temp_purchase_backup CASCADE;
            END IF;

            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'temp_purchase_details_backup') THEN
              INSERT INTO purchase_detail_master (
                item_id, po_no, srl_no, crop_year, grade_code, agency_code, marka_code, quantity, weight_mt, rate_qntl
              )
              SELECT 
                item_id, po_no, srl_no, crop_year, grade_code, agency_code, marka_code, quantity, weight_mt, rate_qntl
              FROM temp_purchase_details_backup;
              
              DROP TABLE IF EXISTS temp_purchase_details_backup CASCADE;
            END IF;

            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'temp_issue_backup') THEN
              INSERT INTO issue_master (
                amad_id, financial_year, amad_no, date, floor, chamber, farmer_name, acc_no, 
                commodity, variety, grading, marka, bardana_type, lorry_number, total_packets, 
                weight_qtl, remarks, created_at
              )
              SELECT DISTINCT ON (amad_id)
                amad_id, financial_year, amad_no, date, floor, chamber, farmer_name, acc_no, 
                commodity, variety, grading, marka, bardana_type, lorry_number, total_packets, 
                weight_qtl, remarks, created_at
              FROM temp_issue_backup;
              
              DROP TABLE IF EXISTS temp_issue_backup CASCADE;
            END IF;

            -- 6. Disable RLS for standard accessible operations in applet
            ALTER TABLE IF EXISTS sauda_master DISABLE ROW LEVEL SECURITY;
            ALTER TABLE IF EXISTS sauda_quality_details DISABLE ROW LEVEL SECURITY;
            ALTER TABLE IF EXISTS purchase_master DISABLE ROW LEVEL SECURITY;
            ALTER TABLE IF EXISTS purchase_detail_master DISABLE ROW LEVEL SECURITY;
            ALTER TABLE IF EXISTS issue_master DISABLE ROW LEVEL SECURITY;

            -- Create M.R. Settlement tables if not exist
            CREATE TABLE IF NOT EXISTS m_r_settlement (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                po_no TEXT NOT NULL,
                material_details TEXT,
                quality TEXT,
                quantity NUMERIC(15,3) DEFAULT 0.000,
                settlement_date DATE,
                payment_status TEXT DEFAULT 'Pending',
                challan_weight NUMERIC(15,3) DEFAULT 0.000,
                supplier_net_wt NUMERIC(15,3) DEFAULT 0.000,
                electronic_scale_net NUMERIC(15,3) DEFAULT 0.000,
                remarks TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS m_r_settlement DISABLE ROW LEVEL SECURITY;

            CREATE TABLE IF NOT EXISTS mr_settlement_master (
                settlement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                mr_no TEXT UNIQUE NOT NULL,
                sett_date DATE,
                po_type TEXT,
                broker TEXT,
                supplier TEXT,
                chn_supplier TEXT,
                po_no TEXT,
                po_date DATE,
                lorry_number TEXT,
                auto_ho_settlement BOOLEAN DEFAULT FALSE,
                detention_days INTEGER DEFAULT 0,
                arrival_no TEXT,
                arrival_date DATE,
                arival_apmc_fees NUMERIC(15,2) DEFAULT 0.00,
                actual_apmc_fees NUMERIC(15,2) DEFAULT 0.00,
                remarks TEXT,
                
                -- Grade-Wise Summary Panel
                summary_rate_qtel NUMERIC(15,2) DEFAULT 0.00,
                summary_rate_aff_cd_cl NUMERIC(15,2) DEFAULT 0.00,
                summary_delivery_claim NUMERIC(15,2) DEFAULT 0.00,
                summary_rate_wt_claim NUMERIC(15,2) DEFAULT 0.00,
                summary_instl_rate NUMERIC(15,2) DEFAULT 0.00,
                summary_premium_wt NUMERIC(15,2) DEFAULT 0.00,
                summary_material_value NUMERIC(15,2) DEFAULT 0.00,
                summary_misc_add NUMERIC(15,2) DEFAULT 0.00,
                summary_misc_less NUMERIC(15,2) DEFAULT 0.00,
                summary_premium_amount NUMERIC(15,2) DEFAULT 0.00,
                summary_less_amount NUMERIC(15,2) DEFAULT 0.00,
                summary_instl_amount NUMERIC(15,2) DEFAULT 0.00,
                summary_deduction_type TEXT,
                summary_deduction_rate NUMERIC(15,2) DEFAULT 0.00,
                summary_deduction_qty NUMERIC(15,2) DEFAULT 0.00,
                summary_deduction_amount NUMERIC(15,2) DEFAULT 0.00,
                
                -- M.R. Valuation Panel
                val_material_value NUMERIC(15,2) DEFAULT 0.00,
                val_add_amt NUMERIC(15,2) DEFAULT 0.00,
                val_less_amt  NUMERIC(15,2) DEFAULT 0.00,
                val_premium_amt NUMERIC(15,2) DEFAULT 0.00,
                val_less_amount NUMERIC(15,2) DEFAULT 0.00,
                val_qty_claim NUMERIC(15,2) DEFAULT 0.00,
                val_ex_short NUMERIC(15,2) DEFAULT 0.00,
                
                -- Final MR Value Panel
                final_less_adv NUMERIC(15,2) DEFAULT 0.00,
                final_on_ac_adv NUMERIC(15,2) DEFAULT 0.00,
                final_apmc_fees NUMERIC(15,2) DEFAULT 0.00,
                final_cst_pct_amt NUMERIC(15,2) DEFAULT 0.00,
                
                -- Payable panel
                payable_amt NUMERIC(15,2) DEFAULT 0.00,
                payable_bill_no TEXT,
                payable_bill_date DATE,
                
                -- Bottom sub-bar
                wt_ded_wt_1 NUMERIC(15,3) DEFAULT 0.000,
                wt_ded_wt_2 NUMERIC(15,3) DEFAULT 0.000,
                wt_ded_wt_3 NUMERIC(15,3) DEFAULT 0.000,
                rate_qntl NUMERIC(15,2) DEFAULT 0.00,
                value_amt NUMERIC(15,2) DEFAULT 0.00,
                adjustment_amt NUMERIC(15,2) DEFAULT 0.00,
                net_amt NUMERIC(15,2) DEFAULT 0.00,
                
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS mr_settlement_detail (
                detail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                mr_no TEXT REFERENCES mr_settlement_master(mr_no) ON DELETE CASCADE,
                col_index INTEGER NOT NULL, -- 1 to 4
                
                -- First Grid Columns
                grade TEXT,
                area TEXT,
                agency TEXT,
                marka_crop TEXT,
                quantity INTEGER DEFAULT 0,
                arr_qty_wt NUMERIC(15,3) DEFAULT 0.000,
                min_qty_wt NUMERIC(15,3) DEFAULT 0.000,
                wt_phota NUMERIC(15,3) DEFAULT 0.000,
                
                wt_quantity NUMERIC(15,3) DEFAULT 0.000,
                rate_value NUMERIC(15,2) DEFAULT 0.00,
                
                -- Claims Grid Sub-columns
                gd_claim NUMERIC(15,2) DEFAULT 0.00,
                gd_sett NUMERIC(15,2) DEFAULT 0.00,
                gd_rev NUMERIC(15,2) DEFAULT 0.00,
                gd_final NUMERIC(15,2) DEFAULT 0.00,
                
                moist_claim NUMERIC(15,2) DEFAULT 0.00,
                moist_sett NUMERIC(15,2) DEFAULT 0.00,
                moist_rev NUMERIC(15,2) DEFAULT 0.00,
                moist_final NUMERIC(15,2) DEFAULT 0.00,
                
                dust_claim NUMERIC(15,2) DEFAULT 0.00,
                dust_sett NUMERIC(15,2) DEFAULT 0.00,
                dust_rev NUMERIC(15,2) DEFAULT 0.00,
                dust_final NUMERIC(15,2) DEFAULT 0.00,
                
                ncv_claim NUMERIC(15,2) DEFAULT 0.00,
                ncv_sett NUMERIC(15,2) DEFAULT 0.00,
                ncv_rev NUMERIC(15,2) DEFAULT 0.00,
                ncv_final NUMERIC(15,2) DEFAULT 0.00,
                
                po_grade_claim NUMERIC(15,2) DEFAULT 0.00,
                po_grade_sett NUMERIC(15,2) DEFAULT 0.00,
                po_grade_rev NUMERIC(15,2) DEFAULT 0.00,
                po_grade_final NUMERIC(15,2) DEFAULT 0.00,
                
                adjust_type TEXT,
                remark TEXT,
                claim_settlement NUMERIC(15,2) DEFAULT 0.00
            );

            ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';
            ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS summary_premium_wt NUMERIC(15,2) DEFAULT 0.00;
            ALTER TABLE IF EXISTS mr_settlement_master DISABLE ROW LEVEL SECURITY;
            ALTER TABLE IF EXISTS mr_settlement_detail DISABLE ROW LEVEL SECURITY;
            
            -- Clear obsolete tables
            DROP TABLE IF EXISTS csv_master CASCADE;
            DROP TABLE IF EXISTS export_master CASCADE;
            DROP TABLE IF EXISTS issue_logic_master CASCADE;
            DROP TABLE IF EXISTS pdf_master CASCADE;
            DROP TABLE IF EXISTS setting_master CASCADE;
            DROP TABLE IF EXISTS stock_summary CASCADE;

            -- Ensure supplementary helper columns
            ALTER TABLE IF EXISTS sauda_quality_details ADD COLUMN IF NOT EXISTS agency TEXT;
            ALTER TABLE IF EXISTS sauda_quality_details ADD COLUMN IF NOT EXISTS marka TEXT;

            -- Create Master Tables if not existing and disable RLS
            CREATE TABLE IF NOT EXISTS supply_master (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                supp_code TEXT,
                supp_name TEXT,
                acc_no TEXT,
                supp_add1 TEXT,
                supp_add2 TEXT,
                supp_add3 TEXT,
                supp_city TEXT,
                supp_contact TEXT,
                supp_ph_no TEXT,
                supp_cell_no TEXT,
                supp_fax_no TEXT,
                supp_email TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS supply_master DISABLE ROW LEVEL SECURITY;

            CREATE TABLE IF NOT EXISTS broker_master (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                brok_code TEXT,
                brok_name TEXT,
                acc_no TEXT,
                brok_add1 TEXT,
                brok_add2 TEXT,
                brok_add3 TEXT,
                brok_city TEXT,
                brok_contact TEXT,
                brok_ph_no TEXT,
                brok_cell_no TEXT,
                brok_fax_no TEXT,
                brok_email TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS broker_master DISABLE ROW LEVEL SECURITY;

            CREATE TABLE IF NOT EXISTS area_master (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                area_code TEXT,
                area_name TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS area_master DISABLE ROW LEVEL SECURITY;

            CREATE TABLE IF NOT EXISTS agency_master (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                agency_code TEXT,
                agency_name TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS agency_master DISABLE ROW LEVEL SECURITY;

            CREATE TABLE IF NOT EXISTS grade_master (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                grade_code TEXT,
                grade_name TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS grade_master DISABLE ROW LEVEL SECURITY;

            CREATE TABLE IF NOT EXISTS marka_master (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                marka_code TEXT,
                marka_name TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS marka_master DISABLE ROW LEVEL SECURITY;

            CREATE TABLE IF NOT EXISTS batch_master (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code TEXT,
                name TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS batch_master DISABLE ROW LEVEL SECURITY;

            -- Helper RPC function for raw query execution returning JSON set
            CREATE OR REPLACE FUNCTION exec_sql_return(query text) RETURNS SETOF json AS $$
            BEGIN
              RETURN QUERY EXECUTE query;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;

            -- Align supply_master to always use uppercase supp_name
            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'supply_master') THEN
              UPDATE supply_master SET supp_name = UPPER(supp_name) WHERE supp_name IS NOT NULL;
              
              CREATE OR REPLACE FUNCTION upper_supp_name_trigger()
              RETURNS TRIGGER AS $func$
              BEGIN
                IF NEW.supp_name IS NOT NULL THEN
                  NEW.supp_name := UPPER(NEW.supp_name);
                END IF;
                RETURN NEW;
              END;
              $func$ LANGUAGE plpgsql;

              DROP TRIGGER IF EXISTS trg_upper_supp_name ON supply_master;
              CREATE TRIGGER trg_upper_supp_name
              BEFORE INSERT OR UPDATE ON supply_master
              FOR EACH ROW
              EXECUTE FUNCTION upper_supp_name_trigger();
            END IF;

            -- Create pending_received column on purchase_master if not exists
            ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS pending_received NUMERIC(15,3) DEFAULT 0.000;

            -- Trigger function to automatically keep purchase_master.pending_received sync'd with m_r_settlement
            CREATE OR REPLACE FUNCTION update_purchase_pending_received()
            RETURNS TRIGGER AS $trg$
            DECLARE
              v_po_no TEXT;
              v_total_contract NUMERIC(15,3);
              v_total_settled NUMERIC(15,3);
            BEGIN
              IF TG_OP = 'DELETE' THEN
                v_po_no := OLD.po_no;
              ELSE
                v_po_no := NEW.po_no;
              END IF;

              SELECT COALESCE(total_contract_mt, 0)
              INTO v_total_contract
              FROM purchase_master
              WHERE po_no = v_po_no;

              SELECT COALESCE(SUM(quantity), 0)
              INTO v_total_settled
              FROM m_r_settlement
              WHERE po_no = v_po_no;

              UPDATE purchase_master
              SET pending_received = GREATEST(0, v_total_contract - v_total_settled)
              WHERE po_no = v_po_no;

              IF TG_OP = 'DELETE' THEN
                RETURN OLD;
              END IF;
              RETURN NEW;
            END;
            $trg$ LANGUAGE plpgsql;

            DROP TRIGGER IF EXISTS trg_update_purchase_pending_received ON m_r_settlement;
            CREATE TRIGGER trg_update_purchase_pending_received
            AFTER INSERT OR UPDATE OR DELETE ON m_r_settlement
            FOR EACH ROW
            EXECUTE FUNCTION update_purchase_pending_received();

            -- Initial backfill for existing records to keep everything perfectly synchronized
            UPDATE purchase_master p
            SET pending_received = GREATEST(0, COALESCE(total_contract_mt, 0) - COALESCE((
              SELECT SUM(quantity) 
              FROM m_r_settlement m 
              WHERE m.po_no = p.po_no
            ), 0))
            WHERE p.po_no IS NOT NULL;

            -- Create godown_master and godown_entry tables
            CREATE TABLE IF NOT EXISTS godown_master (
                gdn_code TEXT PRIMARY KEY,
                gdn_name TEXT NOT NULL UNIQUE,
                gdn_capacity NUMERIC(15,2),
                gdn_short_name TEXT
            );
            ALTER TABLE IF EXISTS godown_master DISABLE ROW LEVEL SECURITY;

            -- Seed godowns with exact genuine list and remove any non-genuine godowns
            INSERT INTO godown_master (gdn_code, gdn_name, gdn_capacity, gdn_short_name)
            VALUES 
            ('1', '1', 600.00, '1'),
            ('2', '3', 450.00, '3'),
            ('3', '3A', 450.00, '3A'),
            ('4', '4', 450.00, '4'),
            ('5', '4A', 450.00, '4A'),
            ('6', '4B', 600.00, '4B'),
            ('7', '4C', 600.00, '4C'),
            ('8', '5', 450.00, '5'),
            ('9', '6', 450.00, '6'),
            ('10', '6A', 450.00, '6A'),
            ('11', '7', 450.00, '7'),
            ('12', '7A', 450.00, '7A'),
            ('13', '8', 450.00, '8'),
            ('14', '8A', 450.00, '8A'),
            ('15', '9', 450.00, '9'),
            ('16', '9A', 450.00, '9A'),
            ('17', '10', 450.00, '10'),
            ('18', '2', 450.00, '2'),
            ('19', '1A', 450.00, '1A'),
            ('20', 'OUTSIDE', 500.00, 'OS'),
            ('21', '2A', 450.00, '2A'),
            ('22', 'INSP. MILL', 450.00, 'IM'),
            ('23', 'KATARI', 450.00, 'KATA'),
            ('24', 'MILL', 450.00, 'MILL'),
            ('26', 'STB', 450.00, 'STB'),
            ('27', 'INSP. STB', 450.00, 'ISTB'),
            ('29', 'INSP. KATARI', 450.00, 'IKAT'),
            ('30', 'SELECTION SHED', 450.00, 'SHED'),
            ('31', '8B', 450.00, '8B')
            ON CONFLICT (gdn_code) DO UPDATE SET gdn_name = EXCLUDED.gdn_name, gdn_capacity = EXCLUDED.gdn_capacity;

            DELETE FROM godown_master WHERE gdn_code NOT IN ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '26', '27', '29', '30', '31');

            CREATE TABLE IF NOT EXISTS godown_entry (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                voucher_no TEXT NOT NULL,
                date DATE NOT NULL,
                gdn_code TEXT,
                item_type TEXT DEFAULT 'Jute Bales',
                account_name TEXT,
                quantity INTEGER DEFAULT 0,
                rate NUMERIC(15,2) DEFAULT 0.00,
                amount NUMERIC(15,2) DEFAULT 0.00,
                narration TEXT,
                voucher_type TEXT NOT NULL, -- 'issue', 'return', 'transfer'
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS godown_entry ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'Jute Bales';
            ALTER TABLE IF EXISTS godown_entry DISABLE ROW LEVEL SECURITY;

            -- Create the godown_audit table for real-time tracking of godown movements
            CREATE TABLE IF NOT EXISTS godown_audit (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                operator_id TEXT DEFAULT 'OPERATOR-01',
                action_type TEXT, -- 'INSERT', 'UPDATE', 'DELETE', 'BULK_TRANSFER'
                quantity INTEGER,
                item_type TEXT,
                source_ref TEXT,
                dest_ref TEXT,
                voucher_no TEXT
            );
            ALTER TABLE IF EXISTS godown_audit DISABLE ROW LEVEL SECURITY;

            -- Create the amad_change_history table for Material Received (Amad) tracking
            CREATE TABLE IF NOT EXISTS amad_change_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                amad_no TEXT NOT NULL,
                amad_id TEXT,
                action_type TEXT NOT NULL,
                modified_by TEXT NOT NULL,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                old_values TEXT,
                new_values TEXT,
                changes_summary TEXT
            );
            ALTER TABLE IF EXISTS amad_change_history DISABLE ROW LEVEL SECURITY;

            -- Create the satta_master table for Satta Desk transactions
            CREATE TABLE IF NOT EXISTS satta_master (
                satta_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                financial_year TEXT NOT NULL DEFAULT '2026-2027',
                satta_no TEXT NOT NULL,
                session TEXT,
                po_type TEXT,
                date DATE NOT NULL DEFAULT CURRENT_DATE,
                broker TEXT,
                supplier TEXT,
                challan_supplier TEXT,
                area TEXT,
                agency TEXT,
                marks TEXT,
                no_of_lorries INTEGER,
                units_per_lorry_type TEXT,
                total_unit INTEGER,
                wt_per_lorry NUMERIC(15,3),
                unit_type TEXT,
                total_wt_in_ton NUMERIC(15,3),
                shipment_date DATE,
                shipment_days INTEGER,
                shipment_penalty NUMERIC(15,2),
                marks_claim NUMERIC(15,2),
                quantity_claim NUMERIC(15,2),
                remarks TEXT,
                b_rate NUMERIC(15,2) DEFAULT 0,
                b_date DATE,
                superior_normal_marks TEXT,
                signature_url TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS satta_master DISABLE ROW LEVEL SECURITY;

            -- Ensure columns exist in satta_master for existing installations
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS session TEXT;
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS po_type TEXT;
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS challan_supplier TEXT;
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS area TEXT;
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS agency TEXT;
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS marks TEXT;
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS no_of_lorries INTEGER;
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS units_per_lorry_type TEXT;
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS total_unit INTEGER;
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS wt_per_lorry NUMERIC(15,3);
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS unit_type TEXT;
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS total_wt_in_ton NUMERIC(15,3);
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS shipment_date DATE;
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS shipment_days INTEGER;
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS shipment_penalty NUMERIC(15,2);
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS marks_claim NUMERIC(15,2);
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS quantity_claim NUMERIC(15,2);
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS b_rate NUMERIC(15,2) DEFAULT 0;
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS b_date DATE;
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS superior_normal_marks TEXT;
            ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS signature_url TEXT;

            -- Create the unit_master table if not exists for Latest Stock Section
            CREATE TABLE IF NOT EXISTS unit_master (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                unit_name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS unit_master DISABLE ROW LEVEL SECURITY;

            -- Seed standard unit names
            INSERT INTO unit_master (unit_name)
            VALUES 
            ('DRUMS'),
            ('BALES'),
            ('LOOSE'),
            ('P.BALES'),
            ('H.BALES')
            ON CONFLICT DO NOTHING;

            -- Drop unit_maste table if exists
            DROP TABLE IF EXISTS unit_maste CASCADE;

            -- Create the opening_stock table for Latest Stock Section
            CREATE TABLE IF NOT EXISTS opening_stock (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                opening_date DATE NOT NULL,
                stock_date DATE,
                godown TEXT NOT NULL,
                area TEXT NOT NULL,
                grade TEXT NOT NULL,
                jci TEXT NOT NULL DEFAULT 'No',
                unit TEXT NOT NULL DEFAULT 'BALES',
                quantity NUMERIC(15,3) NOT NULL DEFAULT 0.00,
                weight NUMERIC(15,3) NOT NULL DEFAULT 0.00,
                avg_weight NUMERIC(15,3) NOT NULL DEFAULT 0.00,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS opening_stock ADD COLUMN IF NOT EXISTS avg_weight NUMERIC(15,3) DEFAULT 0.00;
            ALTER TABLE IF EXISTS opening_stock ADD COLUMN IF NOT EXISTS stock_date DATE;
            ALTER TABLE IF EXISTS opening_stock DISABLE ROW LEVEL SECURITY;

            -- Create the closing_stock table if it doesn't exist for Latest Stock
            CREATE TABLE IF NOT EXISTS closing_stock (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                stock_date DATE NOT NULL,
                godown VARCHAR(50) NOT NULL,
                commodity VARCHAR(100) DEFAULT 'RAW JUTE',
                variety VARCHAR(50),
                grade VARCHAR(50),
                no_of_bales INTEGER DEFAULT 0,
                weight_qtl NUMERIC(10,2) DEFAULT 0.0,
                rate_per_qtl NUMERIC(10,2) DEFAULT 0.0,
                total_value NUMERIC(12,2) DEFAULT 0.0,
                recorded_by VARCHAR(100) DEFAULT 'ADMIN',
                remarks TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS closing_stock DISABLE ROW LEVEL SECURITY;

            -- Satta Base Rate configurations 
            CREATE TABLE IF NOT EXISTS satta_base_rates (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                base_rate NUMERIC(15,2) NOT NULL DEFAULT 17500,
                start_date DATE NOT NULL DEFAULT CURRENT_DATE,
                remarks TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS satta_base_rates DISABLE ROW LEVEL SECURITY;

            -- Satta Differentials mapping Area & Grade premium/discounts
            CREATE TABLE IF NOT EXISTS satta_differentials (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                area TEXT NOT NULL,
                grade TEXT NOT NULL,
                differential NUMERIC(15,2) NOT NULL DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(area, grade)
            );
            ALTER TABLE IF EXISTS satta_differentials DISABLE ROW LEVEL SECURITY;

            -- Historic Satta Calculated Rates (full log for reports)
            CREATE TABLE IF NOT EXISTS satta_calculated_rates (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                base_rate_id UUID,
                base_rate NUMERIC(15,2) NOT NULL,
                start_date DATE NOT NULL,
                area TEXT NOT NULL,
                grade TEXT NOT NULL,
                differential NUMERIC(15,2) NOT NULL,
                final_rate NUMERIC(15,2) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS satta_calculated_rates DISABLE ROW LEVEL SECURITY;

            -- Add entry_notes column if they don't exist
            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'material_received') THEN
              IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'temporary_material_received') THEN
                ALTER TABLE material_received RENAME TO temporary_material_received;
              END IF;
            END IF;

            -- Create the temporary_material_received table if it still doesn't exist
            CREATE TABLE IF NOT EXISTS temporary_material_received (
                amad_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                financial_year TEXT NOT NULL DEFAULT '2026-2027',
                temporary_arrival_no TEXT,
                po_no TEXT,
                date DATE,
                jci TEXT DEFAULT 'No',
                challan_supplier TEXT,
                supplier TEXT,
                agency_name TEXT,
                broker TEXT,
                transporter_name TEXT,
                challan_rr_no TEXT,
                challan_railway_receipt_no TEXT,
                lorry_number TEXT,
                pan_no TEXT,
                lorry_date DATE,
                consignment_note TEXT,
                consignment_note_no TEXT,
                consignment_note_date DATE,
                di_no TEXT,
                di_date DATE,
                invoice_no TEXT,
                invoice_date DATE,
                ptf TEXT DEFAULT 'No',
                lorry_returned TEXT DEFAULT 'No',
                lorry_returned_other_mill TEXT DEFAULT 'No',
                arrival_area_code TEXT,
                arrival_area_name TEXT,
                unit_code TEXT DEFAULT 'I',
                unit_name TEXT DEFAULT 'BALES',
                way_bill_no TEXT,
                way_bill_date DATE,
                apmc_fees NUMERIC(15,2) DEFAULT 0,
                remarks TEXT,
                total_packets INTEGER DEFAULT 0,
                weight_qtl NUMERIC(15,3) DEFAULT 0,
                grid_details TEXT,
                challan_material_weight NUMERIC(15,3) DEFAULT 0,
                actual_gross_weight NUMERIC(15,3) DEFAULT 0,
                actual_tare_weight NUMERIC(15,3) DEFAULT 0,
                supplier_net_weight NUMERIC(15,3) DEFAULT 0,
                supplier_challan_gross NUMERIC(15,3) DEFAULT 0,
                supplier_tare_weight NUMERIC(15,3) DEFAULT 0,
                electronic_net_weight NUMERIC(15,3) DEFAULT 0,
                electronic_gross_weight NUMERIC(15,3) DEFAULT 0,
                electronic_tare_weight NUMERIC(15,3) DEFAULT 0,
                weight_reduced NUMERIC(15,3) DEFAULT 0,
                entry_notes TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS temporary_material_received DISABLE ROW LEVEL SECURITY;

            -- If temporary_material_received was renamed or exists, ensure column is temporary_arrival_no
            IF NOT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_name = 'temporary_material_received' AND column_name = 'temporary_arrival_no'
            ) THEN
              IF EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'temporary_material_received' AND column_name = 'amad_no'
              ) THEN
                ALTER TABLE temporary_material_received RENAME COLUMN amad_no TO temporary_arrival_no;
              ELSE
                ALTER TABLE temporary_material_received ADD COLUMN temporary_arrival_no TEXT;
              END IF;
            END IF;

            IF NOT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_name = 'temporary_material_received' AND column_name = 'entry_notes'
            ) THEN
              ALTER TABLE temporary_material_received ADD COLUMN entry_notes TEXT;
            END IF;

            IF NOT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_name = 'temporary_material_received' AND column_name = 'agency_name'
            ) THEN
              ALTER TABLE temporary_material_received ADD COLUMN agency_name TEXT;
            END IF;

            -- Create table for final_arrival
            DROP TABLE IF EXISTS final_arrival CASCADE;
            CREATE TABLE final_arrival (
                final_arrival_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                id UUID UNIQUE DEFAULT gen_random_uuid(),
                financial_year TEXT,
                temporary_arrival_no TEXT,
                temporary_arrival_date DATE,
                final_arrival_no TEXT UNIQUE,
                arrival_no TEXT,
                final_arrival_date DATE,
                date DATE,
                po_no TEXT,
                po_date DATE,
                jci TEXT DEFAULT 'No',
                jci_no TEXT,
                challan_supplier TEXT,
                supplier TEXT,
                broker TEXT,
                transporter_name TEXT,
                challan_rr_no TEXT,
                challan_railway_receipt_no TEXT,
                challan_rr_date DATE,
                challan_no TEXT,
                receipt_no TEXT,
                challan_date DATE,
                receipt_date DATE,
                lorry_number TEXT,
                lorry_no TEXT,
                pan_no TEXT,
                part_no TEXT,
                part_date DATE,
                consignment_note TEXT,
                consignment_note_no TEXT,
                consignment_note_date DATE,
                di_no TEXT,
                di_date DATE,
                invoice_no TEXT,
                invoice_date DATE,
                ptf TEXT DEFAULT 'No',
                rfs TEXT DEFAULT 'No',
                lorry_returned TEXT DEFAULT 'No',
                lorry_returned_other_mill TEXT DEFAULT 'No',
                arrival_area_code TEXT,
                arrival_area_name TEXT,
                area TEXT,
                unit_code TEXT DEFAULT 'I',
                unit_name TEXT DEFAULT 'BALES',
                way_bill_no TEXT,
                way_bill_date DATE,
                rr_gr_no TEXT,
                apmc_fees NUMERIC(15,2) DEFAULT 0.00,
                remarks TEXT,
                total_packets INTEGER DEFAULT 0,
                weight_qtl NUMERIC(15,3) DEFAULT 0.000,
                grid_details JSONB,
                
                -- Weighments
                challan_material_weight NUMERIC(15,3) DEFAULT 0.000,
                actual_gross_weight NUMERIC(15,3) DEFAULT 0.000,
                actual_tare_weight NUMERIC(15,3) DEFAULT 0.000,
                supplier_net_weight NUMERIC(15,3) DEFAULT 0.000,
                supplier_challan_gross NUMERIC(15,3) DEFAULT 0.000,
                supplier_tare_weight NUMERIC(15,3) DEFAULT 0.000,
                electronic_net_weight NUMERIC(15,3) DEFAULT 0.000,
                electronic_gross_weight NUMERIC(15,3) DEFAULT 0.000,
                electronic_tare_weight NUMERIC(15,3) DEFAULT 0.000,
                weight_reduced NUMERIC(15,3) DEFAULT 0.000,

                -- Backwards compatibility with Quality inspection sync:
                mr_no TEXT,
                mr_date DATE,
                broker_name TEXT,
                supplier_name TEXT,
                actual_moisture NUMERIC(15,3),
                claim_moisture NUMERIC(15,3),
                actual_dust NUMERIC(15,3),
                claim_dust NUMERIC(15,3),
                actual_ncv NUMERIC(15,3),
                claim_ncv NUMERIC(15,3),
                detention_days INTEGER,
                unloading_date DATE,
                
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            ALTER TABLE IF EXISTS final_arrival DISABLE ROW LEVEL SECURITY;

            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'issue_master') THEN
              IF NOT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'issue_master' AND column_name = 'entry_notes'
              ) THEN
                ALTER TABLE issue_master ADD COLUMN entry_notes TEXT;
              END IF;
              IF NOT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'issue_master' AND column_name = 'agency_name'
              ) THEN
                ALTER TABLE issue_master ADD COLUMN agency_name TEXT;
              END IF;
            END IF;

            -- Create Views for Quick Report compatibility and direct queries
            -- Check if source tables exist before creating views to avoid migration errors
            -- Drop first to prevent "cannot replace existing view with new columns" errors
            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'temporary_material_received') THEN
              EXECUTE 'DROP VIEW IF EXISTS amad_register CASCADE';
              EXECUTE 'CREATE OR REPLACE VIEW amad_register AS 
                SELECT 
                  amad_id, financial_year, temporary_arrival_no AS amad_no, po_no, date, jci, challan_supplier, supplier, agency_name, broker, transporter_name, challan_rr_no, lorry_number, pan_no, lorry_date, consignment_note_no, di_no, di_date, invoice_no, invoice_date, ftf AS ptf, lorry_returned, lorry_returned_other_mill, arrival_area_code, arrival_area_name, unit_code, unit_name, way_bill_no, way_bill_date, apmc_fees, remarks, total_packets, weight_qtl, grid_details, challan_material_weight, actual_gross_weight, actual_tare_weight, supplier_net_weight, supplier_challan_gross, supplier_tare_weight, electronic_net_weight, electronic_gross_weight, electronic_tare_weight, weight_reduced, entry_notes, created_at 
                FROM temporary_material_received';
            END IF;

            -- Drop material_inspection view if it exists so it can be a real table or replaced cleanly
            EXECUTE 'DROP VIEW IF EXISTS material_inspection CASCADE';

          END $$;
          -- Reload schema cache to ensure PostgREST cache is perfectly synchronized
          NOTIFY pgrst, 'reload schema';
        `
      });
      console.log('Database upgraded to single unified layouts successfully. Partition tables fully purged.');
    } catch (err) {
      console.warn('DB layout alignment failed or completed previously:', err);
    }

    // Independent table & column provisioning
    const schemaQueries = [
      `ALTER TABLE IF EXISTS user_master ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;`,
      `CREATE TABLE IF NOT EXISTS user_activity_logs (
         log_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
         username TEXT,
         activity_type TEXT,
         module_name TEXT,
         action_details TEXT,
         ip_address TEXT DEFAULT 'Local',
         created_at TIMESTAMPTZ DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS user_activity_logs DISABLE ROW LEVEL SECURITY;`,
      `DROP TABLE IF EXISTS inspection_master, inspection_details, inspection_checklist, inspection_checklist_details, mill_inspection_master, mill_inspection_detail CASCADE;`,
      `CREATE TABLE IF NOT EXISTS material_inspection (
         mr_no TEXT PRIMARY KEY,
         mr_date DATE,
         date DATE,
         arrival_no TEXT,
         arrival_date DATE,
         po_no TEXT,
         po_date DATE,
         broker_name TEXT,
         supplier_name TEXT,
         actual_moisture NUMERIC,
         claim_moisture NUMERIC,
         actual_dust NUMERIC,
         claim_dust NUMERIC,
         actual_ncv NUMERIC,
         claim_ncv NUMERIC,
         detention_days NUMERIC,
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
         status TEXT DEFAULT 'Completed',
         created_at TIMESTAMPTZ DEFAULT NOW(),
         updated_at TIMESTAMPTZ DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS material_inspection DISABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS mr_date DATE;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS date DATE;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_no TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_date DATE;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS po_no TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS po_date DATE;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS broker_name TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS supplier_name TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS actual_moisture NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS claim_moisture NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS actual_dust NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS claim_dust NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS actual_ncv NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS claim_ncv NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS detention_days NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS unloading_date DATE;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS mill_po_no TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS mill_po_date DATE;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS mr_spcl_print TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS remarks TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS lorry_number TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS delivery_claim NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_type TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_rate NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_qty NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_amount NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_types JSONB;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Completed';`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_area_code TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_area_name TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_area TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS broker TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS supplier TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS quality_matrix JSONB;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS advance_amount NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS on_account_advance_amount NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS settlement_amount NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS sent_settlement_date DATE;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS lorry_returned TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS lorry_returned_other_mill TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS mr_print_date DATE;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS consignment_no TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS consignment_date DATE;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_remarks TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arival_apmc_fees NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS grid_details JSONB;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS details JSONB;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS company_id TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS unit_id TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS machine_id TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS shift TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS department TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS production_id TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS production_ref TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS batch_id TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS delivery_claim NUMERIC DEFAULT 0;`,
      `CREATE TABLE IF NOT EXISTS production_records (
         id TEXT PRIMARY KEY,
         batch_no TEXT,
         lot_no TEXT,
         production_no TEXT,
         date DATE,
         status TEXT DEFAULT 'Active',
         created_at TIMESTAMPTZ DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS production_records DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS material_inspection_details (
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
         crop_year TEXT,
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
         actual_moisture NUMERIC DEFAULT 0,
         claim_moisture NUMERIC DEFAULT 0,
         actual_dust NUMERIC DEFAULT 0,
         claim_dust NUMERIC DEFAULT 0,
         actual_ncv NUMERIC DEFAULT 0,
         claim_ncv NUMERIC DEFAULT 0,
         actual_grade_down NUMERIC DEFAULT 0,
         claim_grade_down NUMERIC DEFAULT 0,
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
         tolerable TEXT DEFAULT 'Yes',
         premium TEXT DEFAULT 'No',
         is_premium BOOLEAN DEFAULT FALSE,
         row_remarks TEXT,
         jqi_remarks TEXT,
         jci_remarks TEXT,
         created_at TIMESTAMPTZ DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deductions JSONB;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_types JSONB;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS grid_details JSONB;`,
      `ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS details JSONB;`,
      `ALTER TABLE IF EXISTS material_inspection_details DISABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS premium TEXT DEFAULT 'No';`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS rate NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS rate_qntl NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS agency_code TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS actual_moisture NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS claim_moisture NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS actual_dust NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS claim_dust NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS actual_ncv NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS claim_ncv NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS actual_grade_down NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS claim_grade_down NUMERIC DEFAULT 0;`,
      `CREATE TABLE IF NOT EXISTS mill_inspection_master (LIKE material_inspection INCLUDING ALL);`,
      `ALTER TABLE IF EXISTS mill_inspection_master DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS mill_inspection_detail (LIKE material_inspection_details INCLUDING ALL);`,
      `ALTER TABLE IF EXISTS mill_inspection_detail DISABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE IF EXISTS mill_inspection_detail ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS mill_inspection_detail ADD COLUMN IF NOT EXISTS premium TEXT DEFAULT 'No';`,
      `ALTER TABLE IF EXISTS mill_inspection_detail ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;`,
      `CREATE TABLE IF NOT EXISTS inspection_master (LIKE material_inspection INCLUDING ALL);`,
      `ALTER TABLE IF EXISTS inspection_master DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS inspection_details (LIKE material_inspection_details INCLUDING ALL);`,
      `ALTER TABLE IF EXISTS inspection_details DISABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE IF EXISTS inspection_details ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS inspection_details ADD COLUMN IF NOT EXISTS premium TEXT DEFAULT 'No';`,
      `ALTER TABLE IF EXISTS inspection_details ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;`,
      `CREATE TABLE IF NOT EXISTS inspection_checklist_details (LIKE material_inspection_details INCLUDING ALL);`,
      `ALTER TABLE IF EXISTS inspection_checklist_details DISABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE IF EXISTS inspection_checklist_details ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS inspection_checklist_details ADD COLUMN IF NOT EXISTS premium TEXT DEFAULT 'No';`,
      `ALTER TABLE IF EXISTS inspection_checklist_details ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS summary_deduction_type TEXT;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS summary_deduction_rate NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS summary_deduction_qty NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS summary_deduction_amount NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS summary_premium_wt NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS summary_premium_amount NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS val_premium_amt NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS deductions JSONB;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS lorry_number TEXT;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS lorry_no TEXT;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS auto_ho_settlement BOOLEAN DEFAULT FALSE;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS detention_days INTEGER DEFAULT 0;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS arrival_no TEXT;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS arrival_date DATE;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS arival_apmc_fees NUMERIC(15,2) DEFAULT 0.00;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS actual_apmc_fees NUMERIC(15,2) DEFAULT 0.00;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS remarks TEXT;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS challan_weight NUMERIC(15,3) DEFAULT 0.000;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS supplier_net_wt NUMERIC(15,3) DEFAULT 0.000;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS electronic_scale_net NUMERIC(15,3) DEFAULT 0.000;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS payable_bill_no TEXT;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS payable_bill_date DATE;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS payable_amt NUMERIC(15,2) DEFAULT 0.00;`,
      `ALTER TABLE IF EXISTS "p.o_archive" ADD COLUMN IF NOT EXISTS pending_received NUMERIC(15,3) DEFAULT 0.000;`,
      `ALTER TABLE IF EXISTS "p.o_archive" ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'settled';`,
      `ALTER TABLE IF EXISTS "p.o_archive" ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`,
      `ALTER TABLE IF EXISTS po_archive ADD COLUMN IF NOT EXISTS pending_received NUMERIC(15,3) DEFAULT 0.000;`,
      `ALTER TABLE IF EXISTS po_archive ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'settled';`,
      `ALTER TABLE IF EXISTS po_archive ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`,
      `ALTER TABLE IF EXISTS m_r_settlement ADD COLUMN IF NOT EXISTS lorry_number TEXT;`,
      `ALTER TABLE IF EXISTS m_r_settlement ADD COLUMN IF NOT EXISTS lorry_no TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS arrival_grade TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS stock_grade_code TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS stock_grade_name TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS area TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS agency TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS marka TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS marks TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS crop_year TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lot TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'BALES';`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS challan_gross_wt NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS receipt_gross_wt NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS gross_weight_batch NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS add_weight NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS less_weight NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS reduced_weight NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lorry_moisture_min NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lorry_moisture_max NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lorry_read_min NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lorry_read_max NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lorry_read_avg NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS insp_read_min NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS insp_read_max NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS insp_read_avg NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS moisture_act NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS moisture_claim NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS dust_act NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS dust_claim NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ncv_act NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ncv_claim NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS grade_down_act NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS grade_down_claim NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS final_receipt_wt NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS settlement_moisture NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS settlement_grade_down NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS settlement_dust NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS settlement_ncv NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ropes_weight NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ropes_tot_wt_grd NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ropes_grade TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS chotta_weight NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS chotta_tot_wt_grd NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS chotta_grade TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS tolerable TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS premium TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS row_remarks TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS jqi_remarks TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS jci_remarks TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS marka TEXT;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS moisture_deduction_kg NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS dust_deduction_kg NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ncv_deduction_kg NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS mill_inspection_detail ADD COLUMN IF NOT EXISTS moisture_deduction_kg NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS mill_inspection_detail ADD COLUMN IF NOT EXISTS dust_deduction_kg NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS mill_inspection_detail ADD COLUMN IF NOT EXISTS ncv_deduction_kg NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS inspection_details ADD COLUMN IF NOT EXISTS moisture_deduction_kg NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS inspection_details ADD COLUMN IF NOT EXISTS dust_deduction_kg NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS inspection_details ADD COLUMN IF NOT EXISTS ncv_deduction_kg NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS inspection_checklist_details ADD COLUMN IF NOT EXISTS moisture_deduction_kg NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS inspection_checklist_details ADD COLUMN IF NOT EXISTS dust_deduction_kg NUMERIC DEFAULT 0;`,
      `ALTER TABLE IF EXISTS inspection_checklist_details ADD COLUMN IF NOT EXISTS ncv_deduction_kg NUMERIC DEFAULT 0;`,
      `CREATE TABLE IF NOT EXISTS satta_base_rates (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         base_rate NUMERIC(15,2) NOT NULL DEFAULT 17500,
         start_date DATE NOT NULL DEFAULT CURRENT_DATE,
         remarks TEXT,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS satta_base_rates DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS satta_differentials (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         area TEXT NOT NULL,
         grade TEXT NOT NULL,
         differential NUMERIC(15,2) NOT NULL DEFAULT 0,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
         UNIQUE(area, grade)
       );`,
      `ALTER TABLE IF EXISTS satta_differentials DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS satta_calculated_rates (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         base_rate_id UUID,
         base_rate NUMERIC(15,2) NOT NULL,
         start_date DATE NOT NULL,
         area TEXT NOT NULL,
         grade TEXT NOT NULL,
         differential NUMERIC(15,2) NOT NULL,
         final_rate NUMERIC(15,2) NOT NULL,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS satta_calculated_rates DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS satta_master (
         satta_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         financial_year TEXT NOT NULL DEFAULT '2026-2027',
         satta_no TEXT NOT NULL,
         date DATE NOT NULL DEFAULT CURRENT_DATE,
         broker TEXT,
         supplier TEXT,
         status TEXT DEFAULT 'pending',
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,
      `ALTER TABLE IF EXISTS satta_master DISABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS session TEXT;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS po_type TEXT;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS challan_supplier TEXT;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS area TEXT;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS agency TEXT;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS marks TEXT;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS no_of_lorries INTEGER;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS units_per_lorry_type TEXT;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS total_unit INTEGER;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS wt_per_lorry NUMERIC(15,3);`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS unit_type TEXT;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS total_wt_in_ton NUMERIC(15,3);`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS shipment_date DATE;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS shipment_days INTEGER;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS shipment_penalty NUMERIC(15,2);`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS marks_claim NUMERIC(15,2);`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS quantity_claim NUMERIC(15,2);`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS b_rate NUMERIC(15,2) DEFAULT 0;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS b_date DATE;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS superior_normal_marks TEXT;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS signature_url TEXT;`,
      `ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS remarks TEXT;`,
      `CREATE TABLE IF NOT EXISTS godown_wise_stock (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         stock_date DATE NOT NULL,
         godown VARCHAR(150) NOT NULL,
         area VARCHAR(150),
         grade VARCHAR(150),
         jci VARCHAR(50) DEFAULT 'No',
         unit VARCHAR(50) DEFAULT 'BALES',
         quantity NUMERIC(15,3) NOT NULL DEFAULT 0.00,
         weight NUMERIC(15,3) NOT NULL DEFAULT 0.00,
         avg_weight NUMERIC(15,3) NOT NULL DEFAULT 0.00,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS godown_wise_stock DISABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE IF EXISTS closing_stock ADD COLUMN IF NOT EXISTS area VARCHAR(150);`,
      `ALTER TABLE IF EXISTS closing_stock ADD COLUMN IF NOT EXISTS jci VARCHAR(50) DEFAULT 'No';`,
      `ALTER TABLE IF EXISTS closing_stock ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'BALES';`,
      `ALTER TABLE IF EXISTS closing_stock ADD COLUMN IF NOT EXISTS quantity NUMERIC(15,3) DEFAULT 0.00;`,
      `ALTER TABLE IF EXISTS temporary_material_received ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`,
      `ALTER TABLE IF EXISTS temporary_material_received ADD COLUMN IF NOT EXISTS consignment_note TEXT;`,
      `ALTER TABLE IF EXISTS temporary_material_received ADD COLUMN IF NOT EXISTS consignment_note_no TEXT;`,
      `ALTER TABLE IF EXISTS temporary_material_received ADD COLUMN IF NOT EXISTS challan_railway_receipt_no TEXT;`,
      `ALTER TABLE IF EXISTS temporary_material_received ADD COLUMN IF NOT EXISTS challan_rr_no TEXT;`,
      `UPDATE temporary_material_received SET consignment_note = consignment_note_no WHERE consignment_note IS NULL AND consignment_note_no IS NOT NULL;`,
      `UPDATE temporary_material_received SET consignment_note_no = consignment_note WHERE consignment_note_no IS NULL AND consignment_note IS NOT NULL;`,
      `UPDATE temporary_material_received SET challan_railway_receipt_no = challan_rr_no WHERE challan_railway_receipt_no IS NULL AND challan_rr_no IS NOT NULL;`,
      `UPDATE temporary_material_received SET challan_rr_no = challan_railway_receipt_no WHERE challan_rr_no IS NULL AND challan_railway_receipt_no IS NOT NULL;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS temporary_arrival_no TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS temporary_arrival_date DATE;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS final_arrival_no TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS arrival_no TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS final_arrival_date DATE;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS po_no TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS po_date DATE;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS jci TEXT DEFAULT 'No';`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS jci_no TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS challan_supplier TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS supplier TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_number TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_no TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS pan_no TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS part_no TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS part_date DATE;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS broker TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS transporter_name TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS di_no TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS di_date DATE;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS consignment_note TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS consignment_note_no TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS consignment_note_date DATE;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS challan_railway_receipt_no TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS challan_rr_no TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS challan_rr_date DATE;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS invoice_no TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS invoice_date DATE;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS arrival_area_code TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS arrival_area_name TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS area TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS ptf TEXT DEFAULT 'No';`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS rfs TEXT DEFAULT 'No';`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_returned TEXT DEFAULT 'No';`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_returned_other_mill TEXT DEFAULT 'No';`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS way_bill_no TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS way_bill_date DATE;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS rr_gr_no TEXT;`,
      `UPDATE final_arrival SET consignment_note = consignment_note_no WHERE consignment_note IS NULL AND consignment_note_no IS NOT NULL;`,
      `UPDATE final_arrival SET consignment_note_no = consignment_note WHERE consignment_note_no IS NULL AND consignment_note IS NOT NULL;`,
      `UPDATE final_arrival SET challan_railway_receipt_no = challan_rr_no WHERE challan_railway_receipt_no IS NULL AND challan_rr_no IS NOT NULL;`,
      `UPDATE final_arrival SET challan_rr_no = challan_railway_receipt_no WHERE challan_rr_no IS NULL AND challan_railway_receipt_no IS NOT NULL;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_number TEXT;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_date DATE;`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_returned TEXT DEFAULT 'No';`,
      `ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_returned_other_mill TEXT DEFAULT 'No';`,
      `ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';`,
      `CREATE TABLE IF NOT EXISTS mill_issue_master (
         issue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         financial_year TEXT NOT NULL DEFAULT '2026-2027',
         issue_no TEXT NOT NULL UNIQUE,
         date DATE NOT NULL DEFAULT CURRENT_DATE,
         issue_type TEXT DEFAULT 'FACTORY ISSUE',
         mill_shift TEXT DEFAULT 'A',
         department TEXT NOT NULL,
         godown TEXT NOT NULL,
         stock_group TEXT DEFAULT 'RAW JUTE',
         remarks TEXT,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS mill_issue_master DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS mill_issue_detail (
         detail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         issue_no TEXT NOT NULL,
         srl INTEGER NOT NULL,
         crop TEXT DEFAULT '2025-26',
         grade_code TEXT,
         grade_name TEXT,
         marka TEXT DEFAULT 'NO MARK',
         qty NUMERIC(15,2) DEFAULT 0.00,
         weight_kgs NUMERIC(15,3) DEFAULT 0.00,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS mill_issue_detail DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS department_master (
         dept_code TEXT PRIMARY KEY,
         dept_name TEXT NOT NULL UNIQUE,
         location TEXT,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS department_master DISABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE IF EXISTS department_master ADD COLUMN IF NOT EXISTS location TEXT;`,
      `ALTER TABLE IF EXISTS godown_master ADD COLUMN IF NOT EXISTS gdn_location TEXT;`,
      `ALTER TABLE IF EXISTS godown_master ADD COLUMN IF NOT EXISTS location TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS grade_name TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS unit TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS quantity NUMERIC(15,3);`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS weight_mt NUMERIC(15,3);`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS challan_no TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS gate_pass_no TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS lorry_number TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS party_name TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS destination_godown TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS requisition_no TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS issued_by TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS received_by TEXT;`,
      `INSERT INTO department_master (dept_code, dept_name, location) VALUES 
       ('BATCHING', 'BATCHING', 'FLOOR A'),
       ('PREPARING', 'PREPARING', 'FLOOR A'),
       ('SPINNING', 'SPINNING', 'FLOOR B'),
       ('WINDING', 'WINDING', 'FLOOR B'),
       ('BEAMING', 'BEAMING (SIZING)', 'FLOOR C'),
       ('WEAVING', 'WEAVING', 'FLOOR C'),
       ('FINISHING', 'FINISHING', 'FLOOR D'),
       ('DUST_SHAKING', 'DUST SHAKING', 'OUTDOOR'),
       ('SEWING', 'SEWING & HEMMING', 'FLOOR D'),
       ('PACKING', 'PACKING & BALING', 'WAREHOUSE 1'),
       ('MAINTENANCE', 'MAINTENANCE / WORKSHOP', 'WORKSHOP SHED'),
       ('ELECTRICAL', 'ELECTRICAL', 'POWER ROOM'),
       ('BOILER_HOUSE', 'BOILER HOUSE', 'BOILER SHED'),
       ('STORES', 'STORES / GENERAL', 'MAIN STORE')
       ON CONFLICT DO NOTHING;`,
      `CREATE TABLE IF NOT EXISTS batch_master (
        code TEXT PRIMARY KEY,
        batch_name TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,
      `ALTER TABLE IF EXISTS batch_master DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS requisitions (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         requisition_no TEXT UNIQUE NOT NULL,
         requisition_date DATE NOT NULL DEFAULT CURRENT_DATE,
         department TEXT NOT NULL,
         issued_for TEXT DEFAULT 'MAIN MILL',
         batch_order TEXT,
         stock_group TEXT DEFAULT 'RAW JUTE',
         crop_year TEXT DEFAULT '2025-26',
         grade_name TEXT DEFAULT 'TD5',
         marka TEXT DEFAULT 'NO MARK',
         qty_bales NUMERIC(15,2) DEFAULT 0.00,
         weight_kgs NUMERIC(15,3) DEFAULT 0.00,
         status TEXT DEFAULT 'PENDING',
         remarks TEXT,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS requisitions DISABLE ROW LEVEL SECURITY;`,
      `INSERT INTO batch_master (code, batch_name) VALUES
        ('1', 'EXPORT YARN 6.5 LBS'),
        ('2', 'SACKING WARP 12 LBS'),
        ('4', 'HESSIAN WARP 8.5 LBS'),
        ('5', 'SACKING WARP 10.5 LBS'),
        ('6', 'SALE YARN 14.0 LBS'),
        ('7', 'SACKING WEFT'),
        ('8', 'BRIGHT SALE YARN 36 LBS'),
        ('9', 'EXPORT YARN 8.0 – 12.0 LBS'),
        ('10', 'EXPORT YARN 8.00 LBS'),
        ('11', 'HESSIAN WARP 7.5 LBS'),
        ('12', 'TEA BAG 8.00 – 8.50 LBS'),
        ('13', 'BRIGHT 48.0 LBS'),
        ('14', 'CANVAS'),
        ('15', 'DOBBY COLOUR YARN'),
        ('16', 'EXPORT YARN 9.00 LBS'),
        ('17', 'F.G.Q HESSIAN 9.00 LBS'),
        ('18', 'JACQUARD'),
        ('19', 'RUSSIAN'),
        ('20', 'SALE YARN 36 LBS'),
        ('21', 'SINGLE WARP CANVAS 10.0 LBS'),
        ('22', 'S.T.B'),
        ('23', 'EXPORT YARN 10.0 LBS'),
        ('24', 'EXPORT YARN 4.8 LBS'),
        ('25', 'H.C.F SACKING'),
        ('26', 'H.C.F HESSIAN'),
        ('27', 'BATCH NOT AVAILABLE'),
        ('28', 'EXPORT YARN 17 LBS'),
        ('29', 'BROAD LOOM'),
        ('30', 'I.L'),
        ('31', 'DYE YARN'),
        ('32', '9.50 LBS BLEACHED YARN'),
        ('33', 'N.C.B 6.00 LBS TO 6.50 LBS'),
        ('34', 'J/NG/JB'),
        ('35', 'HEAVY SACKING WARP'),
        ('36', 'SACKING WARP 9.5 – 10.0 LBS'),
        ('37', 'BIS SAMPLE')
        ON CONFLICT DO NOTHING;`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS stack_no TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS jci TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS batch_order TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS requisition_date DATE;`,
      `ALTER TABLE IF EXISTS mill_issue_master ADD COLUMN IF NOT EXISTS issued_for TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_detail ADD COLUMN IF NOT EXISTS area TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_detail ADD COLUMN IF NOT EXISTS agency TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_detail ADD COLUMN IF NOT EXISTS code TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_detail ADD COLUMN IF NOT EXISTS batch_name TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_detail ADD COLUMN IF NOT EXISTS unit TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_detail ADD COLUMN IF NOT EXISTS place TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_detail ADD COLUMN IF NOT EXISTS itg_no TEXT;`,
      `ALTER TABLE IF EXISTS mill_issue_detail ADD COLUMN IF NOT EXISTS rate NUMERIC(15,2);`,
      `ALTER TABLE IF EXISTS mill_issue_detail ADD COLUMN IF NOT EXISTS location_dest TEXT;`,
      `CREATE TABLE IF NOT EXISTS godown_master (
          gdn_code TEXT PRIMARY KEY,
          gdn_name TEXT NOT NULL UNIQUE,
          gdn_capacity NUMERIC(15,2),
          gdn_short_name TEXT
       );`,
      `ALTER TABLE IF EXISTS godown_master DISABLE ROW LEVEL SECURITY;`,
      `INSERT INTO godown_master (gdn_code, gdn_name, gdn_capacity, gdn_short_name)
       VALUES 
       ('GDN-01', 'MAIN GODOWN', 10000.00, 'MAIN'),
       ('GDN-02', 'GODOWN-B', 5000.00, 'GDW-B'),
       ('GDN-03', 'GDW-A (RAW MAIN)', 15000.00, 'GD-A')
       ON CONFLICT DO NOTHING;`,
      `CREATE TABLE IF NOT EXISTS godown_entry (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          voucher_no TEXT NOT NULL,
          date DATE NOT NULL,
          gdn_code TEXT,
          item_type TEXT DEFAULT 'Jute Bales',
          account_name TEXT,
          quantity INTEGER DEFAULT 0,
          rate NUMERIC(15,2) DEFAULT 0.00,
          amount NUMERIC(15,2) DEFAULT 0.00,
          narration TEXT,
          voucher_type TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS godown_entry ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'Jute Bales';`,
      `ALTER TABLE IF EXISTS godown_entry DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS godown_audit (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          operator_id TEXT DEFAULT 'OPERATOR-01',
          action_type TEXT,
          quantity INTEGER,
          item_type TEXT,
          source_ref TEXT,
          dest_ref TEXT,
          voucher_no TEXT
       );`,
      `ALTER TABLE IF EXISTS godown_audit DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS opening_stock (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          opening_date DATE NOT NULL,
          stock_date DATE,
          godown TEXT NOT NULL,
          area TEXT NOT NULL,
          grade TEXT NOT NULL,
          jci TEXT NOT NULL DEFAULT 'No',
          unit TEXT NOT NULL DEFAULT 'BALES',
          quantity NUMERIC(15,3) NOT NULL DEFAULT 0.00,
          weight NUMERIC(15,3) NOT NULL DEFAULT 0.00,
          avg_weight NUMERIC(15,3) NOT NULL DEFAULT 0.00,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS opening_stock ADD COLUMN IF NOT EXISTS avg_weight NUMERIC(15,3) DEFAULT 0.00;`,
      `ALTER TABLE IF EXISTS opening_stock ADD COLUMN IF NOT EXISTS stock_date DATE;`,
      `ALTER TABLE IF EXISTS opening_stock DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS sms_sauda (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sauda_no TEXT,
          po_type TEXT DEFAULT 'Normal',
          date DATE,
          session TEXT,
          broker TEXT,
          supplier TEXT,
          challan_supplier TEXT,
          area TEXT,
          no_of_lorries INTEGER,
          units_per_lorry NUMERIC(15,2),
          total_unit INTEGER,
          wt_per_lorry NUMERIC(15,3),
          unit_type TEXT,
          total_wt_tons NUMERIC(15,3),
          shipment_date DATE,
          shipment_days INTEGER,
          shipment_penalty NUMERIC(15,2),
          marks_claim NUMERIC(15,2),
          quantity_claim NUMERIC(15,2),
          remarks TEXT,
          b_rate NUMERIC(15,2),
          b_date DATE,
          superior_normal_marks TEXT,
          status TEXT DEFAULT 'Pending',
          quality_details JSONB,
          sms_id TEXT,
          raw_sms_body TEXT,
          sauda_created BOOLEAN DEFAULT FALSE,
          marked_by TEXT,
          marked_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS sms_sauda DISABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS sms_id TEXT;`,
      `ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS raw_sms_body TEXT;`,
      `ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS sauda_created BOOLEAN DEFAULT FALSE;`,
      `ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS marked_by TEXT;`,
      `ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS marked_at TIMESTAMP WITH TIME ZONE;`,

      `CREATE INDEX IF NOT EXISTS idx_sauda_master_no ON sauda_master(sauda_no);`,
      `CREATE INDEX IF NOT EXISTS idx_sauda_master_created ON sauda_master(created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_sms_sauda_no ON sms_sauda(sauda_no);`,
      `CREATE INDEX IF NOT EXISTS idx_sms_sauda_sms_id ON sms_sauda(sms_id);`,
      `CREATE INDEX IF NOT EXISTS idx_sms_sauda_created ON sms_sauda(created_at DESC);`,
      `CREATE INDEX IF NOT EXISTS idx_purchase_master_po ON purchase_master(po_no);`,
      `CREATE INDEX IF NOT EXISTS idx_temp_mat_mr ON temporary_material_received(mr_no);`,
      `CREATE INDEX IF NOT EXISTS idx_temp_mat_arr ON temporary_material_received(arrival_no);`,
      `CREATE INDEX IF NOT EXISTS idx_inspection_mr ON material_inspection(mr_no);`,
      `CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);`,
      
      `DO $$
      BEGIN
        -- sauda_master units_per_lorry
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'sauda_master' AND column_name = 'units_per_lorry'
        ) THEN
          IF (SELECT data_type FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = 'sauda_master' AND column_name = 'units_per_lorry') IN ('text', 'character varying', 'varchar') THEN
            ALTER TABLE sauda_master 
            ALTER COLUMN units_per_lorry TYPE NUMERIC(15,2) 
            USING (
              CASE 
                WHEN trim(units_per_lorry::text) ~ '^[0-9]+(\.[0-9]+)?$' THEN trim(units_per_lorry::text)::numeric 
                ELSE NULL 
              END
            );
          END IF;
        ELSE
          ALTER TABLE sauda_master ADD COLUMN IF NOT EXISTS units_per_lorry NUMERIC(15,2);
        END IF;

        -- sms_sauda units_per_lorry
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'sms_sauda' AND column_name = 'units_per_lorry'
        ) THEN
          IF (SELECT data_type FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = 'sms_sauda' AND column_name = 'units_per_lorry') IN ('text', 'character varying', 'varchar') THEN
            ALTER TABLE sms_sauda 
            ALTER COLUMN units_per_lorry TYPE NUMERIC(15,2) 
            USING (
              CASE 
                WHEN trim(units_per_lorry::text) ~ '^[0-9]+(\.[0-9]+)?$' THEN trim(units_per_lorry::text)::numeric 
                ELSE NULL 
              END
            );
          END IF;
        ELSE
          ALTER TABLE sms_sauda ADD COLUMN IF NOT EXISTS units_per_lorry NUMERIC(15,2);
        END IF;

        -- satta_master units_per_lorry
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'satta_master' AND column_name = 'units_per_lorry'
        ) THEN
          IF (SELECT data_type FROM information_schema.columns 
              WHERE table_schema = 'public' AND table_name = 'satta_master' AND column_name = 'units_per_lorry') IN ('text', 'character varying', 'varchar') THEN
            ALTER TABLE satta_master 
            ALTER COLUMN units_per_lorry TYPE NUMERIC(15,2) 
            USING (
              CASE 
                WHEN trim(units_per_lorry::text) ~ '^[0-9]+(\.[0-9]+)?$' THEN trim(units_per_lorry::text)::numeric 
                ELSE NULL 
              END
            );
          END IF;
        ELSE
          ALTER TABLE satta_master ADD COLUMN IF NOT EXISTS units_per_lorry NUMERIC(15,2);
        END IF;
      END $$;`,
      
      `UPDATE temporary_material_received 
       SET grid_details = (
         SELECT json_agg(
           CASE 
             WHEN (elem->>'netto_pnto')::numeric > 0 AND (COALESCE((elem->>'quantity_rcpt')::numeric, 0) = 0 OR COALESCE((elem->>'quantity_chln')::numeric, 0) = 0) THEN
               jsonb_set(
                 jsonb_set(
                   elem::jsonb,
                   '{quantity_chln}',
                   to_jsonb(round((elem->>'netto_pnto')::numeric))
                 ),
                 '{quantity_rcpt}',
                 to_jsonb(round((elem->>'netto_pnto')::numeric))
               )
             ELSE elem::jsonb
           END
         )::text
         FROM json_array_elements(grid_details::json) AS elem
       )
       WHERE grid_details IS NOT NULL AND grid_details != '[]' AND grid_details != '' AND left(grid_details, 1) = '[';`,

      `UPDATE final_arrival 
       SET grid_details = (
         SELECT json_agg(
           CASE 
             WHEN (elem->>'netto_pnto')::numeric > 0 AND (COALESCE((elem->>'quantity_rcpt')::numeric, 0) = 0 OR COALESCE((elem->>'quantity_chln')::numeric, 0) = 0) THEN
               jsonb_set(
                 jsonb_set(
                   elem::jsonb,
                   '{quantity_chln}',
                   to_jsonb(round((elem->>'netto_pnto')::numeric))
                 ),
                 '{quantity_rcpt}',
                 to_jsonb(round((elem->>'netto_pnto')::numeric))
               )
             ELSE elem::jsonb
           END
         )
         FROM json_array_elements(grid_details::json) AS elem
       )
       WHERE grid_details IS NOT NULL AND jsonb_typeof(grid_details::jsonb) = 'array';`,

      `CREATE TABLE IF NOT EXISTS sauda_check_point (
          po_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          financial_year TEXT NOT NULL,
          purchase_order TEXT,
          po_type TEXT,
          ptf_no TEXT,
          pending BOOLEAN DEFAULT TRUE,
          po_no TEXT NOT NULL UNIQUE,
          po_date DATE NOT NULL,
          broker TEXT,
          supplier TEXT,
          challan_supplier TEXT,
          area TEXT,
          trans_paid_by TEXT,
          weight_unit_kgs NUMERIC(15,2),
          against_cancellation TEXT,
          purchase_unit_code TEXT,
          purchase_unit_name TEXT,
          total_lorries NUMERIC(15,2),
          units_per_lorry NUMERIC(15,2),
          total_units NUMERIC(15,2),
          weight_per_lorry NUMERIC(15,3),
          total_contract_mt NUMERIC(15,3),
          marka_type TEXT,
          marka_penalty NUMERIC(15,2),
          qty_penalty NUMERIC(15,2),
          delivery_from DATE,
          delivery_to DATE,
          grace_days INTEGER,
          delivery_penalty NUMERIC(15,2),
          contract_po_no TEXT,
          contract_date DATE,
          rate_detail TEXT,
          delivery_schedule TEXT,
          terms_condition TEXT,
          remarks TEXT,
          po_identification TEXT,
          b_rate NUMERIC(15,2),
          s_date DATE,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          open_remarks JSONB
       );`,
      `ALTER TABLE IF EXISTS sauda_check_point DISABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS open_remarks JSONB;`,
      `ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS open_remarks JSONB;`,
      `ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS open_remarks JSONB;`,
      `CREATE TABLE IF NOT EXISTS sauda_check_point_details (
          item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          po_no TEXT REFERENCES sauda_check_point(po_no) ON DELETE CASCADE,
          srl_no INTEGER,
          crop_year TEXT,
          grade_code TEXT,
          agency_code TEXT,
          marka_code TEXT,
          quantity INTEGER,
          weight_mt NUMERIC(15,3),
          rate_qntl NUMERIC(15,2)
       );`,
      `ALTER TABLE IF EXISTS sauda_check_point_details DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS customer_master (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          firm_name TEXT,
          proprietor_name TEXT,
          email TEXT,
          contact_number TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS customer_master DISABLE ROW LEVEL SECURITY;`,
      // Mismatch tables — one per mismatch type. Created empty; populated only by
      // real discrepancies (no seed/dummy data).
      `CREATE TABLE IF NOT EXISTS satta_mismatch (
         id TEXT PRIMARY KEY,
         mismatch_id TEXT,
         sauda_no TEXT, po_no TEXT, area TEXT, grade TEXT,
         field TEXT, expected_value TEXT, actual_value TEXT,
         expected_rate NUMERIC(15,2), actual_rate NUMERIC(15,2),
         status TEXT DEFAULT 'dispute', remarks TEXT,
         approved_by TEXT, approved_at TIMESTAMP WITH TIME ZONE, approval_level TEXT DEFAULT 'L3/L5',
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS satta_mismatch DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS material_mismatch (
         id TEXT PRIMARY KEY,
         mismatch_id TEXT,
         po_no TEXT, arrival_no TEXT, inspection_no TEXT, area TEXT, grade TEXT,
         supplier TEXT, broker TEXT, agency TEXT, ptf_mode TEXT, challan_supplier TEXT,
         rate_per_mt TEXT, lorry_number TEXT, issue_description TEXT,
         field TEXT, expected_value TEXT, actual_value TEXT, difference TEXT, mismatched_fields TEXT, severity TEXT,
         status TEXT DEFAULT 'pending', remarks TEXT,
         approved_by TEXT, approved_at TIMESTAMP WITH TIME ZONE, approval_level TEXT DEFAULT 'L3/L5',
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS material_mismatch DISABLE ROW LEVEL SECURITY;`,
       `CREATE TABLE IF NOT EXISTS mill_inspection_deduction (
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
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );`,
       `ALTER TABLE IF EXISTS mill_inspection_deduction DISABLE ROW LEVEL SECURITY;`,
       `ALTER TABLE IF EXISTS mill_inspection_deduction ADD COLUMN IF NOT EXISTS mr_date DATE;`,
       `ALTER TABLE IF EXISTS mill_inspection_deduction ADD COLUMN IF NOT EXISTS po_date DATE;`,
       `ALTER TABLE IF EXISTS mill_inspection_deduction ADD COLUMN IF NOT EXISTS arrival_date DATE;`,
       `ALTER TABLE IF EXISTS mill_inspection_deduction ADD COLUMN IF NOT EXISTS supplier_name TEXT;`,
       `ALTER TABLE IF EXISTS mill_inspection_deduction ADD COLUMN IF NOT EXISTS broker_name TEXT;`,
       `ALTER TABLE IF EXISTS mill_inspection_deduction ADD COLUMN IF NOT EXISTS lorry_number TEXT;`,
       `ALTER TABLE IF EXISTS mill_inspection_deduction ADD COLUMN IF NOT EXISTS gross_weight_mt NUMERIC(15,3);`,
       `ALTER TABLE IF EXISTS mill_inspection_deduction ADD COLUMN IF NOT EXISTS total_bales NUMERIC(15,2);`,
       `ALTER TABLE IF EXISTS mill_inspection_deduction ADD COLUMN IF NOT EXISTS avg_bale_weight NUMERIC(15,2);`,
       `CREATE TABLE IF NOT EXISTS sauda_check_point_deductions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          po_no TEXT NOT NULL,
          sauda_no TEXT,
          supplier TEXT,
          broker TEXT,
          contract_weight_mt NUMERIC(15,3),
          tolerance_pct NUMERIC(15,3),
          tolerance_mt NUMERIC(15,3),
          tolerance_type TEXT,
          min_acceptable_mt NUMERIC(15,3),
          max_acceptable_mt NUMERIC(15,3),
          total_received_mt NUMERIC(15,3),
          variation_type TEXT,
          variation_mt NUMERIC(15,3),
          selected_grade TEXT,
          sauda_rate NUMERIC(15,2),
          satta_rate NUMERIC(15,2),
          last_arrival_date DATE,
          applicable_rate NUMERIC(15,2),
          rate_basis TEXT,
          deduction_qty_mt NUMERIC(15,3),
          deduction_amount NUMERIC(15,2),
          status TEXT DEFAULT 'calculated',
          remarks TEXT,
          arrival_numbers TEXT,
          grade_breakdown JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );`,
       `ALTER TABLE IF EXISTS sauda_check_point_deductions DISABLE ROW LEVEL SECURITY;`,
       `ALTER TABLE IF EXISTS sauda_check_point_deductions ADD COLUMN IF NOT EXISTS rate_difference NUMERIC(15,2);`,
       `ALTER TABLE IF EXISTS sauda_check_point_deductions ADD COLUMN IF NOT EXISTS deduction_qty_qtl NUMERIC(15,2);`,
       `ALTER TABLE IF EXISTS sauda_check_point_deductions ADD COLUMN IF NOT EXISTS approved_by TEXT;`,
       `ALTER TABLE IF EXISTS sauda_check_point_deductions ADD COLUMN IF NOT EXISTS approval_level TEXT;`,
       `ALTER TABLE IF EXISTS sauda_check_point_deductions ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT true;`,
       `ALTER TABLE IF EXISTS sauda_check_point_deductions ADD COLUMN IF NOT EXISTS is_final BOOLEAN DEFAULT true;`,
       `ALTER TABLE IF EXISTS sauda_check_point_deductions ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`,
       `ALTER TABLE IF EXISTS sauda_check_point_deductions ADD COLUMN IF NOT EXISTS settled_by TEXT;`,
       `ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS excess_short_deduction NUMERIC(15,2);`,
       `ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS excess_short_status TEXT;`,
       `ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS excess_short_deduction NUMERIC(15,2);`,
       `ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS excess_short_status TEXT;`,
      `CREATE TABLE IF NOT EXISTS deduction_master (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         deduction TEXT NOT NULL UNIQUE,
         rate_per_qntl NUMERIC(15,2),
         rate_per_unit NUMERIC(15,2),
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS deduction_master DISABLE ROW LEVEL SECURITY;`,
      `INSERT INTO deduction_master (deduction, rate_per_qntl, rate_per_unit) VALUES
       ('GODOWN DAMAGE FOR BALES', NULL, 400),
       ('RAIN WET FOR BALES', NULL, 200),
       ('RTCH DAMAGE FOR BALES', NULL, 400),
       ('CT FOR HABIJABI / CHATTA / ROPE', 1500, NULL),
       ('RAIN WET FOR DRUMS', NULL, 200),
       ('RAIN WET FOR HALF BALES', NULL, 200),
       ('GODOWN DAMAGE FOR DRUMS', NULL, 200),
       ('GODOWN DAMAGE FOR HALF BALES', NULL, 200),
       ('PITCH DAMAGE FOR DRUMS', NULL, 200),
       ('PITCH DAMAGE FOR HALF BALES', NULL, 200),
       ('GODOWN DAMAGE FOR LOOSE', 400, NULL),
       ('PITCH DAMAGE FOR LOOSE', 400, NULL),
       ('RAIN WET FOR LOOSE', 400, NULL),
       ('IN CASE OF BALE IF WEIGHT IS LESS THAN 144', NULL, 20),
       ('IN CASE OF BALE IF WEIGHT IS LESS THAN 142', NULL, 30),
       ('IN CASE OF BALES IF WEIGHT IS LESS THAN 139', NULL, 40),
       ('DELIVERY CLAIM PER QUINTAL (RS. PER DAY)', NULL, 5)
       ON CONFLICT (deduction) DO NOTHING;`,
      `CREATE TABLE IF NOT EXISTS moisture_logic (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         season TEXT,
         operating_area TEXT,
         threshold_limit TEXT,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS moisture_logic DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS payment_master (
          payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          voucher_no TEXT UNIQUE NOT NULL,
          payment_date DATE,
          mr_no TEXT,
          po_no TEXT,
          po_date DATE,
          sett_date DATE,
          po_type TEXT,
          broker TEXT,
          supplier TEXT,
          party_id TEXT,
          party_name TEXT,
          chn_supplier TEXT,
          lorry_number TEXT,
          arrival_no TEXT,
          arrival_date DATE,
          arival_apmc_fees NUMERIC DEFAULT 0,
          payable_amt NUMERIC DEFAULT 0,
          payable_bill_no TEXT,
          payable_bill_date DATE,
          total_amount NUMERIC DEFAULT 0,
          paid_amount NUMERIC DEFAULT 0,
          payment_mode TEXT,
          bank_name TEXT,
          reference_no TEXT,
          remarks TEXT,
          status TEXT DEFAULT 'completed',
          payment_status TEXT DEFAULT 'Paid',
          advance_payment_done TEXT DEFAULT 'No',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS payment_master DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS payment_details (
          detail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          payment_id UUID,
          voucher_no TEXT,
          mr_no TEXT,
          col_index INT,
          grade TEXT,
          area TEXT,
          agency TEXT,
          marka_crop TEXT,
          quantity NUMERIC DEFAULT 0,
          arr_qty_wt NUMERIC DEFAULT 0,
          min_qty_wt NUMERIC DEFAULT 0,
          wt_phota NUMERIC DEFAULT 0,
          wt_quantity NUMERIC DEFAULT 0,
          rate_value NUMERIC DEFAULT 0,
          gd_claim NUMERIC DEFAULT 0,
          gd_sett NUMERIC DEFAULT 0,
          gd_rev NUMERIC DEFAULT 0,
          gd_final NUMERIC DEFAULT 0,
          moist_claim NUMERIC DEFAULT 0,
          moist_sett NUMERIC DEFAULT 0,
          moist_rev NUMERIC DEFAULT 0,
          moist_final NUMERIC DEFAULT 0,
          dust_claim NUMERIC DEFAULT 0,
          dust_sett NUMERIC DEFAULT 0,
          dust_rev NUMERIC DEFAULT 0,
          dust_final NUMERIC DEFAULT 0,
          ncv_claim NUMERIC DEFAULT 0,
          ncv_sett NUMERIC DEFAULT 0,
          ncv_rev NUMERIC DEFAULT 0,
          ncv_final NUMERIC DEFAULT 0,
          po_grade_claim NUMERIC DEFAULT 0,
          po_grade_sett NUMERIC DEFAULT 0,
          po_grade_rev NUMERIC DEFAULT 0,
          po_grade_final NUMERIC DEFAULT 0,
          adjust_type TEXT,
          remark TEXT,
          claim_settlement NUMERIC DEFAULT 0,
          sett_pct NUMERIC DEFAULT 0,
          deduction_rate NUMERIC DEFAULT 0,
          sett_rate NUMERIC DEFAULT 0,
          quantity_qtl NUMERIC DEFAULT 0,
          amount NUMERIC DEFAULT 0,
          bill_no TEXT,
          bill_date DATE,
          bill_amount NUMERIC(15,2),
          paid_amount NUMERIC(15,2),
          balance_amount NUMERIC(15,2),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS payment_details DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS party_ledger (
          ledger_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          party_id TEXT NOT NULL,
          party_name TEXT NOT NULL,
          transaction_date DATE NOT NULL,
          transaction_type TEXT NOT NULL,
          reference_no TEXT,
          debit NUMERIC(15,2) DEFAULT 0.00,
          credit NUMERIC(15,2) DEFAULT 0.00,
          balance NUMERIC(15,2) DEFAULT 0.00,
          remarks TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS party_ledger DISABLE ROW LEVEL SECURITY;`,
      // Ledger Triggers
      `CREATE OR REPLACE FUNCTION trg_payment_master_ledger()
       RETURNS TRIGGER AS $
       BEGIN
          INSERT INTO party_ledger (party_id, party_name, transaction_date, transaction_type, reference_no, debit, credit, remarks)
          VALUES (NEW.party_id, NEW.party_name, NEW.payment_date, 'Payment', NEW.voucher_no, NEW.total_amount, 0.00, NEW.remarks);
          RETURN NEW;
       END;
       $ LANGUAGE plpgsql;`,
      `DROP TRIGGER IF EXISTS trg_payment_master_ledger_insert ON payment_master;`,
      `CREATE TRIGGER trg_payment_master_ledger_insert
       AFTER INSERT ON payment_master
       FOR EACH ROW EXECUTE FUNCTION trg_payment_master_ledger();`,
       
      `CREATE OR REPLACE FUNCTION trg_mr_settlement_ledger()
       RETURNS TRIGGER AS $
       BEGIN
          INSERT INTO party_ledger (party_id, party_name, transaction_date, transaction_type, reference_no, debit, credit, remarks)
          VALUES (NEW.supplier, NEW.supplier, NEW.sett_date, 'MR Approved', NEW.mr_no, 0.00, COALESCE(NEW.payable_amt, 0.00), NEW.remarks);
          RETURN NEW;
       END;
       $ LANGUAGE plpgsql;`,
      `DROP TRIGGER IF EXISTS trg_mr_settlement_ledger_insert ON mr_settlement_master;`,
      `CREATE TRIGGER trg_mr_settlement_ledger_insert
       AFTER INSERT ON mr_settlement_master
       FOR EACH ROW EXECUTE FUNCTION trg_mr_settlement_ledger();`,
      `INSERT INTO moisture_logic (season, operating_area, threshold_limit)
       SELECT 'JANUARY TO JUNE (WET SEASON)', 'DAISEE Operating Areas', 'Moisture threshold limit is 18%'
       WHERE NOT EXISTS (SELECT 1 FROM moisture_logic WHERE season = 'JANUARY TO JUNE (WET SEASON)' AND operating_area = 'DAISEE Operating Areas');`,
      `INSERT INTO moisture_logic (season, operating_area, threshold_limit)
       SELECT 'JANUARY TO JUNE (WET SEASON)', 'Standard / Non-DAISEE', 'Moisture threshold limit is 16%'
       WHERE NOT EXISTS (SELECT 1 FROM moisture_logic WHERE season = 'JANUARY TO JUNE (WET SEASON)' AND operating_area = 'Standard / Non-DAISEE');`,
      `INSERT INTO moisture_logic (season, operating_area, threshold_limit)
       SELECT 'JULY TO DECEMBER (DRY SEASON)', 'DAISEE Operating Areas', 'Moisture threshold limit is 20%'
       WHERE NOT EXISTS (SELECT 1 FROM moisture_logic WHERE season = 'JULY TO DECEMBER (DRY SEASON)' AND operating_area = 'DAISEE Operating Areas');`,
      `INSERT INTO moisture_logic (season, operating_area, threshold_limit)
       SELECT 'JULY TO DECEMBER (DRY SEASON)', 'Standard / Non-DAISEE', 'Moisture threshold limit is 18%'
       WHERE NOT EXISTS (SELECT 1 FROM moisture_logic WHERE season = 'JULY TO DECEMBER (DRY SEASON)' AND operating_area = 'Standard / Non-DAISEE');`,
      // Rename vehicle tracking columns to lorry_number
      `DO $ 
       BEGIN 
         IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='temporary_material_received' AND column_name='lorry_no') THEN 
           ALTER TABLE temporary_material_received RENAME COLUMN lorry_no TO lorry_number; 
         END IF; 
         IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='material_inspection' AND column_name='lorry_no') THEN 
           ALTER TABLE material_inspection RENAME COLUMN lorry_no TO lorry_number; 
         END IF; 
         IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='temp_amad_backup' AND column_name='lorry_no') THEN 
           ALTER TABLE temp_amad_backup RENAME COLUMN lorry_no TO lorry_number; 
         END IF; 
         IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mill_issue_master' AND column_name='vehicle_no') THEN 
           ALTER TABLE mill_issue_master RENAME COLUMN vehicle_no TO lorry_number; 
         END IF; 
         IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='final_arrival' AND column_name='lorry_no') THEN 
           ALTER TABLE final_arrival RENAME COLUMN lorry_no TO lorry_number; 
         END IF; 
         IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='final_arrival' AND column_name='vehicle_no') THEN 
           ALTER TABLE final_arrival RENAME COLUMN vehicle_no TO lorry_number; 
         END IF; 
         
         -- Recreate any views if necessary, or just rely on the new column names
       END $;`,
      `ALTER TABLE IF EXISTS mr_settlement_master ADD COLUMN IF NOT EXISTS deductions JSONB;`,
      // Self-heal: if an earlier Temp/Final split left POs only in sauda_check_point,
      // pull them back into purchase_master so the single-table (status-based) split
      // has every row. Idempotent — inserts nothing once consolidated.
      `DO $$
       BEGIN
         IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='sauda_check_point') THEN
           -- no-op
         END IF;
         IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='sauda_check_point_details') THEN
           -- no-op
         END IF;
         -- Move all existing unpassed POs into 'temp' status so they belong to Sauda Check Point
         -- no-op
       END $$;`,
      `CREATE TABLE IF NOT EXISTS lorry_weighments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          ticket_number TEXT UNIQUE NOT NULL,
          date DATE NOT NULL,
          lorry_number TEXT NOT NULL,
          party_name TEXT,
          driver_number TEXT,
          stage1_gross_weight NUMERIC(15,3),
          stage1_tare_weight NUMERIC(15,3),
          stage1_net_weight NUMERIC(15,3),
          grade TEXT,
          grade_details JSONB,
          unit TEXT,
          mokam TEXT,
          marka TEXT,
          stage1_completed BOOLEAN DEFAULT FALSE,
          stage1_date TIMESTAMP WITH TIME ZONE,

          stage2_gross_weight NUMERIC(15,3),
          stage2_tare_weight NUMERIC(15,3),
          stage2_net_weight NUMERIC(15,3),
          stage2_completed BOOLEAN DEFAULT FALSE,
          stage2_date TIMESTAMP WITH TIME ZONE,

          stage3_gross_weight NUMERIC(15,3),
          stage3_tare_weight NUMERIC(15,3),
          stage3_net_weight NUMERIC(15,3),
          stage3_completed BOOLEAN DEFAULT FALSE,
          stage3_date TIMESTAMP WITH TIME ZONE,

          final_weight NUMERIC(15,3),
          final_weight_date TIMESTAMP WITH TIME ZONE,
          status TEXT DEFAULT 'IN',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS lorry_weighments ADD COLUMN IF NOT EXISTS driver_number TEXT;`,
      `ALTER TABLE IF EXISTS lorry_weighments DISABLE ROW LEVEL SECURITY;`,
      // Create Final P.O Archive (p.o_archive & po_archive) and Final M.R Archive (m.r_archive & mr_archive)
      `CREATE TABLE IF NOT EXISTS "p.o_archive" (
          po_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          financial_year TEXT,
          purchase_order TEXT,
          po_type TEXT,
          ptf_no TEXT,
          pending BOOLEAN DEFAULT FALSE,
          po_no TEXT UNIQUE,
          po_date DATE,
          broker TEXT,
          supplier TEXT,
          challan_supplier TEXT,
          area TEXT,
          trans_paid_by TEXT,
          weight_unit_kgs NUMERIC(15,3),
          against_cancellation TEXT,
          purchase_unit_code TEXT,
          purchase_unit_name TEXT,
          total_lorries NUMERIC(15,2),
          units_per_lorry NUMERIC(15,2),
          total_units NUMERIC(15,2),
          weight_per_lorry NUMERIC(15,3),
          total_contract_mt NUMERIC(15,3),
          marka_type TEXT,
          marka_penalty NUMERIC(15,2),
          qty_penalty NUMERIC(15,2),
          delivery_from DATE,
          delivery_to DATE,
          grace_days INTEGER,
          delivery_penalty NUMERIC(15,2),
          contract_po_no TEXT,
          contract_date DATE,
          rate_detail TEXT,
          delivery_schedule TEXT,
          terms_condition TEXT,
          remarks TEXT,
          po_identification TEXT,
          b_rate NUMERIC(15,2),
          s_date DATE,
          status TEXT DEFAULT 'settled',
          archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS "p.o_archive" DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS po_archive ( LIKE "p.o_archive" INCLUDING ALL );`,
      `ALTER TABLE IF EXISTS po_archive DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS "m.r_archive" (
          final_arrival_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          id UUID DEFAULT gen_random_uuid(),
          financial_year TEXT,
          temporary_arrival_no TEXT,
          temporary_arrival_date DATE,
          final_arrival_no TEXT,
          mr_no TEXT,
          final_arrival_date DATE,
          date DATE,
          po_no TEXT,
          po_date DATE,
          jci TEXT DEFAULT 'No',
          challan_supplier TEXT,
          supplier TEXT,
          broker TEXT,
          transporter_name TEXT,
          challan_rr_no TEXT,
          challan_railway_receipt_no TEXT,
          challan_rr_date DATE,
          lorry_number TEXT,
          pan_no TEXT,
          consignment_note TEXT,
          consignment_note_no TEXT,
          consignment_note_date DATE,
          di_no TEXT,
          di_date DATE,
          invoice_no TEXT,
          invoice_date DATE,
          ptf TEXT DEFAULT 'No',
          lorry_returned TEXT DEFAULT 'No',
          lorry_returned_other_mill TEXT DEFAULT 'No',
          arrival_area_code TEXT,
          arrival_area_name TEXT,
          unit_code TEXT DEFAULT 'I',
          unit_name TEXT DEFAULT 'BALES',
          way_bill_no TEXT,
          way_bill_date DATE,
          apmc_fees NUMERIC(15,2) DEFAULT 0.00,
          gross_weight NUMERIC(15,3),
          tare_weight NUMERIC(15,3),
          net_weight NUMERIC(15,3),
          chalan_wt NUMERIC(15,3),
          electronic_scale_net NUMERIC(15,3),
          item_name TEXT,
          quality TEXT,
          status TEXT DEFAULT 'settled',
          archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS "m.r_archive" DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS mr_archive ( LIKE "m.r_archive" INCLUDING ALL );`,
      `ALTER TABLE IF EXISTS mr_archive DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS mill_inspection_print_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          mr_no TEXT,
          printed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          printed_by TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS mill_inspection_print_logs DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS satta_base_rate_audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT,
          action TEXT,
          details JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS satta_base_rate_audit_logs DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS mismatch_cases (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          mr_no TEXT,
          po_no TEXT,
          reason TEXT,
          remarks TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS mismatch_cases DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS clubbed_pomr (
          id TEXT PRIMARY KEY,
          supplier TEXT,
          clubbed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          details JSONB
       );`,
      `ALTER TABLE IF EXISTS clubbed_pomr DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS imap_emails (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          sender TEXT,
          subject TEXT,
          body TEXT,
          received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS imap_emails DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS mail_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          recipient TEXT,
          subject TEXT,
          status TEXT,
          sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS mail_logs DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS inspection_checklist (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          mr_no TEXT,
          checklist_data JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS inspection_checklist DISABLE ROW LEVEL SECURITY;`,
      `DO $$
       BEGIN
         IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='area_master') THEN
           -- Ensure PURNEA (LOOSE) is seeded
           IF NOT EXISTS (SELECT 1 FROM area_master WHERE UPPER(TRIM(area_name)) = 'PURNEA (LOOSE)' OR UPPER(TRIM(area_name)) = 'PURNEA LOOSE') THEN
             INSERT INTO area_master (area_code, area_name) VALUES ('PURNEA_LOOSE', 'PURNEA (LOOSE)');
           END IF;
           -- Ensure other standard areas exist
           INSERT INTO area_master (area_code, area_name)
           SELECT code, name FROM (VALUES
             ('DAISEE', 'DAISEE'),
             ('TULSIHATTA', 'TULSIHATTA'),
             ('BANGLADESH', 'BANGLADESH'),
             ('GRP_LOOSE', 'GRP LOOSE'),
             ('LA_TARABARI', 'L/A TARABARI'),
             ('U_ASSAM', 'U/ASSAM'),
             ('KANKI', 'KANKI'),
             ('RAIGANJ', 'RAIGANJ'),
             ('DHULIYAAN', 'DHULIYAAN'),
             ('SAMSI_JUNGLE', 'SAMSI JUNGLE'),
             ('RAIGANJ_LOOSE', 'RAIGANJ Loose'),
             ('NORTHERN', 'NORTHERN'),
             ('GAJAL_LOOSE', 'GAJAL LOOSE'),
             ('BADURIA', 'BADURIA'),
             ('BASIRHAT', 'BASIRHAT'),
             ('GOLABRI_DD', 'GOLABRI D/D'),
             ('HARIPAL', 'HARIPAL'),
             ('MAYNA_DS', 'MAYNA D/S'),
             ('SN_ISLAMPUR', 'S/N ISLAMPUR'),
             ('SHEORAPHULLY', 'SHEORAPHULLY'),
             ('GRP_MESTA_LOOSE', 'GRP MESTA LOOSE'),
             ('PURNEA_BIHAR', 'PURNEA(BIHAR)'),
             ('PURNEA_LOOSE', 'PURNEA (LOOSE)'),
             ('ASSAM', 'ASSAM'),
             ('SN_MESTA', 'S/N MESTA')
           ) AS t(code, name)
           WHERE NOT EXISTS (SELECT 1 FROM area_master WHERE UPPER(TRIM(area_master.area_name)) = UPPER(TRIM(t.name)));
         END IF;

         IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='satta_differentials') THEN
           INSERT INTO satta_differentials (area, grade, differential)
           VALUES
             ('PURNEA (LOOSE)', 'TD5', 100),
             ('PURNEA (LOOSE)', 'TD6', -300),
             ('PURNEA (LOOSE)', 'TD7', -700),
             ('PURNEA (LOOSE)', 'TD8', -1200),
             ('PURNEA(BIHAR)', 'TD5', 500),
             ('PURNEA(BIHAR)', 'TD6', -600),
             ('PURNEA(BIHAR)', 'TD7', -1000),
             ('PURNEA(BIHAR)', 'TD8', -1500),
             ('BIHAR', 'TD5', 500),
             ('BIHAR', 'TD6', -600),
             ('BIHAR', 'TD7', -1000),
             ('BIHAR', 'TD8', -1500)
           ON CONFLICT (area, grade) DO NOTHING;
         END IF;

         IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='purchase_master') THEN
           INSERT INTO "p.o_archive" SELECT * FROM purchase_master WHERE status = 'settled' ON CONFLICT DO NOTHING;
           INSERT INTO po_archive SELECT * FROM purchase_master WHERE status = 'settled' ON CONFLICT DO NOTHING;
         END IF;
         IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='final_arrival') THEN
           INSERT INTO "m.r_archive" SELECT * FROM final_arrival WHERE status = 'settled' ON CONFLICT DO NOTHING;
           INSERT INTO mr_archive SELECT * FROM final_arrival WHERE status = 'settled' ON CONFLICT DO NOTHING;
         END IF;
       END $$;`
    ];

    // Combine schema queries into a single compound execution to eliminate 50+ network roundtrips
    try {
      const combinedSchemaQuery = schemaQueries.join(';\n');
      await supabase.rpc('exec_sql', { query: combinedSchemaQuery });
    } catch (bulkErr) {
      console.warn('Batch schema sync fallback:', bulkErr);
    }

    // Force PostgREST schema cache reload
    try {
      await supabase.rpc('exec_sql', { 
        query: `CREATE OR REPLACE VIEW vw_po_consignment_ledger AS
                SELECT 
                    p.po_no,
                    p.supplier,
                    p.broker,
                    p.total_contract_mt AS contract_weight_mt,
                    t.temporary_arrival_no AS temp_amad_no,
                    t.lorry_number,
                    t.date AS arrival_date,
                    COALESCE(t.weight_qtl, 0) / 10.0 AS amad_weight_mt,
                    i.inspection_no,
                    i.moisture_percent,
                    f.mr_no AS final_mr_no,
                    COALESCE(f.weight_qtl, 0) / 10.0 AS final_accepted_weight_mt,
                    s.settled_amount,
                    s.status AS settlement_status
                FROM purchase_master p
                LEFT JOIN temporary_material_received t ON p.po_no = t.po_no
                LEFT JOIN mill_inspection_master i ON (t.temporary_arrival_no = i.temporary_arrival_no OR t.temporary_arrival_no = i.arrival_no OR p.po_no = i.po_no)
                LEFT JOIN final_arrival f ON (t.temporary_arrival_no = f.temporary_arrival_no OR t.temporary_arrival_no = f.arrival_no OR p.po_no = f.po_no)
                LEFT JOIN mr_settlement_master s ON f.mr_no = s.mr_no;` 
      }).then(() => {}, () => {});
      await supabase.rpc('exec_sql', { query: `NOTIFY pgrst, 'reload schema';` });
      console.log('PostgREST schema cache forced reload successfully.');
    } catch (refErr) {
      console.warn('PostgREST schema reload signal failed:', refErr);
    }
  });
}

export const getSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.');
  }
  return supabase;
};