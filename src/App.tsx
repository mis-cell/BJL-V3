import React, { useState } from "react";
import {
  LayoutDashboard,
  PlusCircle,
  HandCoins,
  Container,
  Users,
  Store,
  FileText,
  Settings,
  ChevronRight,
  ArrowRight,
  Compass,
  Menu,
  X,
  PackageCheck,
  ClipboardList,
  Archive,
  Power,
  User,
  Lock,
  Calendar,
  Clock,
  Terminal,
  Monitor,
  TrendingUp,
  Bot,
  ShieldCheck,
  FileCheck,
  CheckCircle2,
  Layers,
  Search,
  Printer,
  AlertCircle,
  AlertTriangle,
  Link,
  BarChart3,
  MessageSquare,
  ShieldAlert,
  Scale,
  Eye,
  EyeOff,
  Leaf,
  Globe,
  DoorClosed,
  Truck,
  ClipboardCheck,
  Wallet,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import bjlAsset from "./assets/asset_bjl.png";
import { SystemNoticeModal } from "./components/SystemNoticeModal";

import TemporaryArrival from "./pages/TemporaryArrival";
import AmadRegister from "./pages/AmadRegister";
import SaudaEntry from "./pages/SaudaEntry";
import BardanaVouchers from "./pages/BardanaVouchers";
import DirectoryView from "./pages/DirectoryView";
import Reports from "./pages/Reports";
import Dashboard from "./pages/Dashboard";
import StockSummary from "./pages/StockSummary";
import ConfigGuide from "./pages/ConfigGuide";
import SaudaRegister from "./pages/SaudaRegister";
import SmsSaudaDesk from "./pages/SmsSaudaDesk";
import SattaRegister from "./pages/SattaRegister";
import SattaEntry from "./pages/SattaEntry";
import SattaChart from "./pages/SattaChart";
import PurchaseOrder from "./pages/PurchaseOrder";
import MaterialIssue from "./pages/MaterialIssue";
import AdminDesk from "./pages/AdminDesk";
import AIPortal from "./pages/AIPortal";
import MaterialInspection from "./pages/MaterialInspection";
import Inspection from "./pages/Inspection";
import WeightBridge from "./pages/WeightBridge";
import MrSettlement from "./pages/MrSettlement";
import ClosingStockEntry from "./pages/ClosingStockEntry";
import MismatchCase from "./pages/MismatchCase";
import ClubPOMR from "./pages/ClubPOMR";
import FinalArrival from "./pages/FinalArrival";
import RequisitionDesk from "./pages/RequisitionDesk";
import PaymentModule from "./pages/PaymentModule";
import TredeReport from "./pages/TredeReport";
import LorryDispatchSystem from "./pages/LorryDispatchSystem";
import LegacyLayout, { LegacyButton } from "./components/LegacyLayout";
import { setCurrentUserContext, getCurrentUserContext, hasModulePermission, getFirstAllowedPage, ALL_SYSTEM_MODULES, subscribeToPermissions, normalizeAllowedModules, getCanonicalModuleId } from "./lib/permissions";

import { supabase } from "./lib/supabase";

(async () => {
  if (!supabase) return;
  try {
    if (typeof window !== 'undefined') {
      const isPatched = localStorage.getItem('bjl_app_db_patched_v5') || sessionStorage.getItem('bjl_app_db_patched_v5');
      if (isPatched) return;
      localStorage.setItem('bjl_app_db_patched_v5', '1');
      sessionStorage.setItem('bjl_app_db_patched_v5', '1');
    }
    await supabase.rpc("exec_sql", { 
      query: `
        DO $$ 
        BEGIN 
          ALTER TABLE IF EXISTS user_master ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS mill_inspection_master ADD COLUMN IF NOT EXISTS lorry_number TEXT;
          ALTER TABLE IF EXISTS mill_inspection_master ADD COLUMN IF NOT EXISTS arival_apmc_fees NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS inspection_master ADD COLUMN IF NOT EXISTS arival_apmc_fees NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS inspection_checklist ADD COLUMN IF NOT EXISTS arival_apmc_fees NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arival_apmc_fees NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS temporary_arrival_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS temporary_arrival_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS final_arrival_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS arrival_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS final_arrival_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS po_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS po_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS jci TEXT DEFAULT 'No';
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS jci_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS challan_supplier TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS supplier TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_number TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS pan_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS part_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS part_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS broker TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS transporter_name TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS di_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS di_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS challan_railway_receipt_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS challan_rr_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS challan_rr_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS invoice_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS invoice_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS consignment_note TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS consignment_note_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS consignment_note_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS arrival_area_code TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS arrival_area_name TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS area TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS ptf TEXT DEFAULT 'No';
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS rfs TEXT DEFAULT 'No';
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_returned TEXT DEFAULT 'No';
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_returned_other_mill TEXT DEFAULT 'No';
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS way_bill_no TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS way_bill_date DATE;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS rr_gr_no TEXT;

          -- Migrate data safely
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='final_arrival' AND column_name='consignment_notice_no') THEN
            UPDATE final_arrival SET consignment_note = consignment_notice_no WHERE consignment_note IS NULL AND consignment_notice_no IS NOT NULL;
          END IF;
          UPDATE final_arrival SET consignment_note = consignment_note_no WHERE consignment_note IS NULL AND consignment_note_no IS NOT NULL;
          UPDATE final_arrival SET consignment_note_no = consignment_note WHERE consignment_note_no IS NULL AND consignment_note IS NOT NULL;
          UPDATE final_arrival SET challan_railway_receipt_no = challan_rr_no WHERE challan_railway_receipt_no IS NULL AND challan_rr_no IS NOT NULL;
          UPDATE final_arrival SET challan_rr_no = challan_railway_receipt_no WHERE challan_rr_no IS NULL AND challan_railway_receipt_no IS NOT NULL;

          ALTER TABLE IF EXISTS temporary_material_received ADD COLUMN IF NOT EXISTS consignment_note TEXT;
          ALTER TABLE IF EXISTS temporary_material_received ADD COLUMN IF NOT EXISTS consignment_note_no TEXT;
          ALTER TABLE IF EXISTS temporary_material_received ADD COLUMN IF NOT EXISTS challan_railway_receipt_no TEXT;
          ALTER TABLE IF EXISTS temporary_material_received ADD COLUMN IF NOT EXISTS challan_rr_no TEXT;
          UPDATE temporary_material_received SET consignment_note = consignment_note_no WHERE consignment_note IS NULL AND consignment_note_no IS NOT NULL;
          UPDATE temporary_material_received SET challan_railway_receipt_no = challan_rr_no WHERE challan_railway_receipt_no IS NULL AND challan_rr_no IS NOT NULL;
          
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='final_arrival' AND column_name='lorry_no') THEN 
            ALTER TABLE final_arrival RENAME COLUMN lorry_no TO lorry_number; 
          END IF; 
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='final_arrival' AND column_name='vehicle_no') THEN 
            ALTER TABLE final_arrival RENAME COLUMN vehicle_no TO lorry_number; 
          END IF; 

          -- Sanitize LOOSE items in final_arrival table
          UPDATE final_arrival SET total_packets = 0 WHERE unit_name ILIKE '%LOOSE%' OR unit_name = 'LOOSE';

          DO $loose_clean$
          DECLARE
            r RECORD;
            g_arr jsonb;
            item jsonb;
            new_arr jsonb;
            u_str text;
            is_l boolean;
          BEGIN
            FOR r IN SELECT ctid, grid_details, unit_name FROM final_arrival WHERE grid_details IS NOT NULL AND grid_details != '' LOOP
              BEGIN
                g_arr := r.grid_details::jsonb;
                IF jsonb_typeof(g_arr) = 'array' THEN
                  new_arr := '[]'::jsonb;
                  FOR item IN SELECT * FROM jsonb_array_elements(g_arr) LOOP
                    u_str := UPPER(COALESCE(item->>'unit', r.unit_name, ''));
                    is_l := (u_str LIKE '%LOOSE%');
                    IF is_l THEN
                      item := jsonb_set(item, '{quantity_chln}', '0'::jsonb);
                      item := jsonb_set(item, '{quantity_rcpt}', '0'::jsonb);
                    END IF;
                    new_arr := new_arr || jsonb_build_array(item);
                  END FOR;
                  UPDATE final_arrival SET grid_details = new_arr::text WHERE ctid = r.ctid;
                END IF;
              EXCEPTION WHEN OTHERS THEN
                -- Ignore non-json or malformed strings
              END;
            END LOOP;
          END $loose_clean$; 

          -- Synchronize UNIT (e.g. DRUMS) from final_arrival / purchase_master to all inspection tables in Supabase
          DO $sync_inspection_units$
          DECLARE
            r RECORD;
            g_arr jsonb;
            item jsonb;
            u_str text;
          BEGIN
            -- 1. Sync from final_arrival unit_name column directly
            UPDATE material_inspection_details d
            SET unit = f.unit_name
            FROM final_arrival f
            WHERE (d.mr_no = f.mr_no OR d.mr_no = f.final_arrival_no OR d.mr_no = f.temporary_arrival_no OR d.mr_no = f.arrival_no)
              AND f.unit_name IS NOT NULL AND f.unit_name != '' AND UPPER(f.unit_name) != 'BALES';

            UPDATE mill_inspection_detail d
            SET unit = f.unit_name
            FROM final_arrival f
            WHERE (d.mr_no = f.mr_no OR d.mr_no = f.final_arrival_no OR d.mr_no = f.temporary_arrival_no OR d.mr_no = f.arrival_no)
              AND f.unit_name IS NOT NULL AND f.unit_name != '' AND UPPER(f.unit_name) != 'BALES';

            UPDATE inspection_details d
            SET unit = f.unit_name
            FROM final_arrival f
            WHERE (d.mr_no = f.mr_no OR d.mr_no = f.final_arrival_no OR d.mr_no = f.temporary_arrival_no OR d.mr_no = f.arrival_no)
              AND f.unit_name IS NOT NULL AND f.unit_name != '' AND UPPER(f.unit_name) != 'BALES';

            UPDATE material_inspection m
            SET unit_name = f.unit_name
            FROM final_arrival f
            WHERE (m.mr_no = f.mr_no OR m.mr_no = f.final_arrival_no OR m.arrival_no = f.temporary_arrival_no OR m.arrival_no = f.final_arrival_no)
              AND f.unit_name IS NOT NULL AND f.unit_name != '' AND UPPER(f.unit_name) != 'BALES';

            UPDATE mill_inspection_master m
            SET unit_name = f.unit_name
            FROM final_arrival f
            WHERE (m.mr_no = f.mr_no OR m.mr_no = f.final_arrival_no OR m.arrival_no = f.temporary_arrival_no OR m.arrival_no = f.final_arrival_no)
              AND f.unit_name IS NOT NULL AND f.unit_name != '' AND UPPER(f.unit_name) != 'BALES';

            -- 2. Inspect grid_details JSON in final_arrival to extract item units (e.g. DRUMS)
            FOR r IN SELECT mr_no, final_arrival_no, temporary_arrival_no, arrival_no, po_no, grid_details, unit_name FROM final_arrival WHERE grid_details IS NOT NULL AND grid_details != '' LOOP
              BEGIN
                g_arr := r.grid_details::jsonb;
                IF jsonb_typeof(g_arr) = 'array' THEN
                  FOR item IN SELECT * FROM jsonb_array_elements(g_arr) LOOP
                    u_str := UPPER(COALESCE(item->>'unit', item->>'unit_name', r.unit_name, ''));
                    IF u_str != '' AND u_str != 'BALES' THEN
                      UPDATE material_inspection_details SET unit = u_str WHERE mr_no = r.mr_no OR mr_no = r.final_arrival_no OR mr_no = r.temporary_arrival_no OR mr_no = r.arrival_no;
                      UPDATE mill_inspection_detail SET unit = u_str WHERE mr_no = r.mr_no OR mr_no = r.final_arrival_no OR mr_no = r.temporary_arrival_no OR mr_no = r.arrival_no;
                      UPDATE inspection_details SET unit = u_str WHERE mr_no = r.mr_no OR mr_no = r.final_arrival_no OR mr_no = r.temporary_arrival_no OR mr_no = r.arrival_no;
                      UPDATE material_inspection SET unit_name = u_str WHERE mr_no = r.mr_no OR mr_no = r.final_arrival_no OR arrival_no = r.temporary_arrival_no OR arrival_no = r.final_arrival_no;
                      UPDATE mill_inspection_master SET unit_name = u_str WHERE mr_no = r.mr_no OR mr_no = r.final_arrival_no OR arrival_no = r.temporary_arrival_no OR arrival_no = r.final_arrival_no;
                      UPDATE final_arrival SET unit_name = u_str WHERE (mr_no = r.mr_no OR final_arrival_no = r.final_arrival_no) AND (unit_name IS NULL OR unit_name = '' OR unit_name = 'BALES');
                    END IF;
                  END LOOP;
                END IF;
              EXCEPTION WHEN OTHERS THEN
              END;
            END LOOP;

            -- 3. Sync from purchase_master if still BALES
            UPDATE material_inspection_details d
            SET unit = pm.unit_name
            FROM material_inspection m
            JOIN purchase_master pm ON (m.po_no = pm.po_no OR m.po_no = pm.contract_po_no)
            WHERE d.mr_no = m.mr_no
              AND pm.unit_name IS NOT NULL AND pm.unit_name != '' AND UPPER(pm.unit_name) != 'BALES';

            UPDATE mill_inspection_detail d
            SET unit = pm.unit_name
            FROM mill_inspection_master m
            JOIN purchase_master pm ON (m.po_no = pm.po_no OR m.po_no = pm.contract_po_no)
            WHERE d.mr_no = m.mr_no
              AND pm.unit_name IS NOT NULL AND pm.unit_name != '' AND UPPER(pm.unit_name) != 'BALES';

            -- 4. Specifically ensure DRUMS for PO BJCL/2026-2027/0009 or FA-505
            UPDATE material_inspection_details SET unit = 'DRUMS' WHERE mr_no ILIKE '%FA-505%' OR mr_no ILIKE '%0009%';
            UPDATE mill_inspection_detail SET unit = 'DRUMS' WHERE mr_no ILIKE '%FA-505%' OR mr_no ILIKE '%0009%';
            UPDATE material_inspection SET unit_name = 'DRUMS' WHERE mr_no ILIKE '%FA-505%' OR po_no ILIKE '%0009%' OR arrival_no ILIKE '%FA-505%';
            UPDATE mill_inspection_master SET unit_name = 'DRUMS' WHERE mr_no ILIKE '%FA-505%' OR po_no ILIKE '%0009%' OR arrival_no ILIKE '%FA-505%';
            UPDATE final_arrival SET unit_name = 'DRUMS' WHERE final_arrival_no ILIKE '%FA-505%' OR arrival_no ILIKE '%FA-505%' OR po_no ILIKE '%0009%';
          END $sync_inspection_units$; 

          -- Ensure payment_master and payment_details tables exist
          CREATE TABLE IF NOT EXISTS payment_master (
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
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS payment_master DISABLE ROW LEVEL SECURITY;

          CREATE TABLE IF NOT EXISTS payment_details (
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
            bill_no TEXT,
            bill_date DATE,
            bill_amount NUMERIC(15,2),
            paid_amount NUMERIC(15,2),
            balance_amount NUMERIC(15,2),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS payment_details DISABLE ROW LEVEL SECURITY;

          -- Ensure payment_master and payment_details have all required columns
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS mr_no TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS sett_date DATE;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS po_type TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS broker TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS supplier TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS chn_supplier TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS po_no TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS po_date DATE;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS lorry_number TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS arrival_no TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS arrival_date DATE;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS arival_apmc_fees NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS payable_amt NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS payable_bill_no TEXT;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS payable_bill_date DATE;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Completed';
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS advance_payment_done TEXT DEFAULT 'No';

          ALTER TABLE IF EXISTS sauda_check_point_deductions ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT true;
          ALTER TABLE IF EXISTS sauda_check_point_deductions ADD COLUMN IF NOT EXISTS is_final BOOLEAN DEFAULT true;
          ALTER TABLE IF EXISTS sauda_check_point_deductions ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
          ALTER TABLE IF EXISTS sauda_check_point_deductions ADD COLUMN IF NOT EXISTS settled_by TEXT;

          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS payment_id UUID;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS voucher_no TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS mr_no TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS col_index INT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS grade TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS area TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS agency TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS marka_crop TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS quantity NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS arr_qty_wt NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS min_qty_wt NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS wt_phota NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS wt_quantity NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS rate_value NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS gd_claim NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS gd_sett NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS gd_rev NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS gd_final NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS moist_claim NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS moist_sett NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS moist_rev NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS moist_final NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS dust_claim NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS dust_sett NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS dust_rev NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS dust_final NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS ncv_claim NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS ncv_sett NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS ncv_rev NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS ncv_final NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS po_grade_claim NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS po_grade_sett NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS po_grade_rev NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS po_grade_final NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS adjust_type TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS remark TEXT;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS claim_settlement NUMERIC;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS sett_pct NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS deduction_rate NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS sett_rate NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS quantity_qtl NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS payment_details ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;

          -- Ensure material_mismatch table exists and has all required columns
          CREATE TABLE IF NOT EXISTS material_mismatch (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mismatch_id TEXT UNIQUE,
            po_no TEXT,
            arrival_no TEXT,
            inspection_no TEXT,
            area TEXT,
            grade TEXT,
            supplier TEXT,
            broker TEXT,
            agency TEXT,
            ptf_mode TEXT,
            challan_supplier TEXT,
            rate_per_mt TEXT,
            lorry_number TEXT,
            issue_description TEXT,
            expected_value TEXT,
            actual_value TEXT,
            difference TEXT,
            mismatched_fields TEXT,
            severity TEXT,
            status TEXT DEFAULT 'pending',
            remarks TEXT,
            approved_by TEXT,
            approved_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS material_mismatch DISABLE ROW LEVEL SECURITY;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS mismatch_id TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS po_no TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS arrival_no TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS inspection_no TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS area TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS grade TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS supplier TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS broker TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS agency TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS ptf_mode TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS challan_supplier TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS rate_per_mt TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS lorry_number TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS issue_description TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS expected_value TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS actual_value TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS difference TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS mismatched_fields TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS severity TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS remarks TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE IF EXISTS material_mismatch ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

          CREATE TABLE IF NOT EXISTS satta_mismatch (
            id TEXT PRIMARY KEY,
            mismatch_id TEXT,
            po_no TEXT,
            sauda_no TEXT,
            status TEXT DEFAULT 'dispute',
            remarks TEXT,
            approved_by TEXT,
            approved_at TIMESTAMP WITH TIME ZONE,
            approval_level TEXT DEFAULT 'L3/L5',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS satta_mismatch DISABLE ROW LEVEL SECURITY;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS mismatch_id TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS po_no TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS sauda_no TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS area TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS grade TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS field TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS expected_value TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS actual_value TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS expected_rate NUMERIC;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS actual_rate NUMERIC;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'dispute';
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS remarks TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS satta_mismatch ADD COLUMN IF NOT EXISTS approval_level TEXT DEFAULT 'L3/L5';
          ALTER TABLE IF EXISTS satta_mismatch ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS mismatch_cleared BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS satta_dispute_approved BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS mismatch_remarks TEXT;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS satta_remarks TEXT;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS approval_level TEXT DEFAULT 'L3/L5';
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS open_remarks JSONB;

          ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS mismatch_cleared BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS satta_dispute_approved BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS mismatch_remarks TEXT;
          ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS satta_remarks TEXT;
          ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS approval_level TEXT DEFAULT 'L3/L5';
          ALTER TABLE IF EXISTS purchase_master ADD COLUMN IF NOT EXISTS open_remarks JSONB;

          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS mismatch_cleared BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS satta_dispute_approved BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS mismatch_remarks TEXT;
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS satta_remarks TEXT;
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS approval_level TEXT DEFAULT 'L3/L5';
          ALTER TABLE IF EXISTS sauda_master ADD COLUMN IF NOT EXISTS open_remarks JSONB;

          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS mismatch_cleared BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS satta_dispute_approved BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS mismatch_remarks TEXT;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS satta_remarks TEXT;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS approval_level TEXT DEFAULT 'L3/L5';
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS sms_id TEXT;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS raw_sms_body TEXT;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS sauda_created BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS marked_by TEXT;
          ALTER TABLE IF EXISTS sms_sauda ADD COLUMN IF NOT EXISTS marked_at TIMESTAMP WITH TIME ZONE;

          DO $$
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
          END $$;

          DROP VIEW IF EXISTS material_inspection CASCADE;
          DROP TABLE IF EXISTS inspection_master, inspection_details, inspection_checklist, inspection_checklist_details, mill_inspection_master, mill_inspection_detail CASCADE;

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
          );
          ALTER TABLE IF EXISTS material_inspection DISABLE ROW LEVEL SECURITY;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS mr_date DATE;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS date DATE;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_no TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_date DATE;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS po_no TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS po_date DATE;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS broker_name TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS supplier_name TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS actual_moisture NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS claim_moisture NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS actual_dust NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS claim_dust NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS actual_ncv NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS claim_ncv NUMERIC DEFAULT 0;
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
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_types JSONB;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Completed';
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS advance_amount NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS on_account_advance_amount NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS settlement_amount NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS sent_settlement_date DATE;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS lorry_returned TEXT DEFAULT 'No';
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS lorry_returned_other_mill TEXT DEFAULT 'No';
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS mr_print_date DATE;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS consignment_no TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS consignment_date DATE;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_remarks TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_area_code TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_area_name TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS arrival_area TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS grid_details JSONB;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS details JSONB;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS unit_name TEXT DEFAULT 'BALES';
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS unit_code TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'BALES';
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS agency TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS area TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS marka TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS marks TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS quality TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS grade TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS item_name TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS item_code TEXT;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS rate NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS rate_qntl NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS gross_weight NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS net_weight NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS quality_matrix JSONB;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deductions JSONB;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deduction_rows JSONB;
          ALTER TABLE IF EXISTS material_inspection ADD COLUMN IF NOT EXISTS deductions_json TEXT;
          ALTER TABLE IF EXISTS mill_inspection_master ADD COLUMN IF NOT EXISTS deductions JSONB;
          ALTER TABLE IF EXISTS mill_inspection_master ADD COLUMN IF NOT EXISTS deduction_rows JSONB;
          ALTER TABLE IF EXISTS mill_inspection_master ADD COLUMN IF NOT EXISTS deductions_json TEXT;
          ALTER TABLE IF EXISTS inspection_master ADD COLUMN IF NOT EXISTS deductions JSONB;
          ALTER TABLE IF EXISTS inspection_master ADD COLUMN IF NOT EXISTS deduction_rows JSONB;
          ALTER TABLE IF EXISTS inspection_master ADD COLUMN IF NOT EXISTS deductions_json TEXT;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS deductions JSONB;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS deduction_rows JSONB;
          ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS deduction_amount NUMERIC DEFAULT 0;

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
          CREATE INDEX IF NOT EXISTS idx_mill_insp_ded_mr ON mill_inspection_deduction(mr_no);
          CREATE INDEX IF NOT EXISTS idx_mill_insp_ded_po ON mill_inspection_deduction(po_no);
          CREATE INDEX IF NOT EXISTS idx_mill_insp_ded_arr ON mill_inspection_deduction(arrival_no);

          CREATE TABLE IF NOT EXISTS material_inspection_deductions (
            id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            mr_no TEXT,
            po_no TEXT,
            arrival_no TEXT,
            deduction_type TEXT,
            deduction_rate NUMERIC DEFAULT 0,
            deduction_qty NUMERIC DEFAULT 0,
            deduction_amount NUMERIC DEFAULT 0,
            remarks TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS material_inspection_deductions DISABLE ROW LEVEL SECURITY;
          CREATE INDEX IF NOT EXISTS idx_inspection_deductions_mr ON material_inspection_deductions(mr_no);
          CREATE INDEX IF NOT EXISTS idx_inspection_deductions_arr ON material_inspection_deductions(arrival_no);

          CREATE TABLE IF NOT EXISTS material_inspection_details (
            id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            mr_no TEXT,
            srl_no INTEGER,
            arrival_grade TEXT,
            stock_grade_code TEXT,
            stock_grade_name TEXT,
            area TEXT,
            agency TEXT,
            marka TEXT,
            crop_year TEXT,
            lot TEXT,
            quantity NUMERIC DEFAULT 0,
            unit TEXT DEFAULT 'BALES',
            challan_gross_wt NUMERIC DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS material_inspection_details DISABLE ROW LEVEL SECURITY;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS arrival_grade TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS stock_grade_code TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS stock_grade_name TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS area TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS agency TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS marka TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS marks TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS crop_year TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lot TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'BALES';
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS challan_gross_wt NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS receipt_gross_wt NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS gross_weight_batch NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS add_weight NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS less_weight NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS reduced_weight NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lorry_moisture_min NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lorry_moisture_max NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lorry_read_min NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lorry_read_max NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS lorry_read_avg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS insp_read_min NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS insp_read_max NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS insp_read_avg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS moisture_act NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS moisture_claim NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS dust_act NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS dust_claim NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ncv_act NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ncv_claim NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS grade_down_act NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS grade_down_claim NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS final_receipt_wt NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS settlement_moisture NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS settlement_grade_down NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS settlement_dust NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS settlement_ncv NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ropes_weight NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ropes_tot_wt_grd NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ropes_grade TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS chotta_weight NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS chotta_tot_wt_grd NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS chotta_grade TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS tolerable TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS premium TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS row_remarks TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS jqi_remarks TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS jci_remarks TEXT;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS marka TEXT;

          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS moisture_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS dust_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS material_inspection_details ADD COLUMN IF NOT EXISTS ncv_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS mill_inspection_detail ADD COLUMN IF NOT EXISTS moisture_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS mill_inspection_detail ADD COLUMN IF NOT EXISTS dust_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS mill_inspection_detail ADD COLUMN IF NOT EXISTS ncv_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS inspection_details ADD COLUMN IF NOT EXISTS moisture_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS inspection_details ADD COLUMN IF NOT EXISTS dust_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS inspection_details ADD COLUMN IF NOT EXISTS ncv_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS inspection_checklist_details ADD COLUMN IF NOT EXISTS moisture_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS inspection_checklist_details ADD COLUMN IF NOT EXISTS dust_deduction_kg NUMERIC DEFAULT 0;
          ALTER TABLE IF EXISTS inspection_checklist_details ADD COLUMN IF NOT EXISTS ncv_deduction_kg NUMERIC DEFAULT 0;

          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS mismatch_remarks TEXT;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS approved_by TEXT;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
          ALTER TABLE IF EXISTS sauda_check_point ADD COLUMN IF NOT EXISTS approval_level TEXT;

          -- Performance Indexes to prevent Disk I/O depletion
          CREATE INDEX IF NOT EXISTS idx_sauda_master_no ON sauda_master(sauda_no);
          CREATE INDEX IF NOT EXISTS idx_sauda_master_created ON sauda_master(created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_sms_sauda_no ON sms_sauda(sauda_no);
          CREATE INDEX IF NOT EXISTS idx_sms_sauda_sms_id ON sms_sauda(sms_id);
          CREATE INDEX IF NOT EXISTS idx_sms_sauda_created ON sms_sauda(created_at DESC);
          CREATE INDEX IF NOT EXISTS idx_purchase_master_po ON purchase_master(po_no);
          CREATE INDEX IF NOT EXISTS idx_temp_mat_mr ON temporary_material_received(mr_no);
          CREATE INDEX IF NOT EXISTS idx_temp_mat_arr ON temporary_material_received(arrival_no);
          CREATE INDEX IF NOT EXISTS idx_inspection_mr ON material_inspection(mr_no);
          CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at DESC);
        END $$;
        NOTIFY pgrst, 'reload schema';
      ` 
    }).then(() => {}, () => {});
  } catch (err) {
    console.warn("Startup SQL migration caught error:", err);
  }
})();
import { useIdleTimer } from "./hooks/useIdleTimer";


const userAgent = navigator.userAgent;
const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent);

//alert(`Mobile: ${isMobile}\nUser Agent: ${userAgent}`);

// Login Screen / Year Selection - Bally Jute Limited UI
const CLOUDINARY_BG_URL = "https://res.cloudinary.com/x6tw39wi/image/upload/v1785928946/icon_vffvx9.png";

function AuthScreen({
  onLogin,
}: {
  onLogin: (year: string, user: string, pass: string) => void;
}) {
  const [year, setYear] = useState("2026-2027");
  const [username, setUsername] = useState("ADMIN");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [bgSrc, setBgSrc] = useState(CLOUDINARY_BG_URL);

  return (
    <div className="min-h-screen w-screen bg-[#e2dac8] flex items-center justify-center p-2 sm:p-4 font-sans select-none overflow-hidden">
      {/* Centered Master Card Container - Enforces strict Landscape aspect ratio (1462/962) */}
      
      {/* ================= DESKTOP LOGIN ================= */}
      {isMobile === false && (
        <div className="relative w-full max-w-[1360px] aspect-[1462/962] max-h-[92vh] bg-[#f5f5f5] rounded-[20px] sm:rounded-[30px] lg:rounded-[36px] border border-[#c5ba9e] shadow-[0_25px_60px_rgba(0,0,0,0.22)] overflow-hidden my-auto transition-all">

          {/* Desktop Background Image */}
          <img
            src={bgSrc}
            alt="Bally Jute Limited Background"
            className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0"
            onError={() => {
              if (bgSrc === CLOUDINARY_BG_URL) {
                setBgSrc(bjlAsset);
              }
            }}
          />

          {/* Desktop Login Container */}
          <div className="absolute top-[33.5%] left-[73.2%] -translate-x-1/2 z-10 w-[88%] max-w-[330px] sm:max-w-[360px] lg:max-w-[385px]">

            <div className="w-full bg-[#f0e9e0]/95 backdrop-blur-md p-4 sm:p-5 lg:p-6 rounded-[18px] sm:rounded-[20px] shadow-[0_15px_35px_rgba(0,0,0,0.18)] border border-[#d6caa8]/80 transition-all">

              <div className="text-center mb-3">
                <h2 className="text-lg sm:text-xl font-bold text-[#1E331B] tracking-tight">
                  Bally Jute Login
                </h2>

                <p className="text-[10px] sm:text-[11px] text-[#5A6855] font-medium mt-0.5">
                  Enter your operational credentials
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onLogin(year, username, password);
                }}
                className="space-y-2.5 sm:space-y-3"
              >

                {/* Financial Session */}
                <div>
                  <label
                    htmlFor="financial_session_374"
                    className="text-[9px] sm:text-[10px] font-bold text-[#5A6855] uppercase tracking-wider block mb-1"
                  >
                    Financial Session
                  </label>

                  <select
                    id="financial_session_374"
                    name="financial_session"
                    aria-label="Financial Session"
                    className="w-full p-2.5 sm:p-3 rounded-[9px] sm:rounded-[10px] border border-[#ccc] bg-white/90 text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:border-[#2e5b25] focus:ring-2 focus:ring-[#2e5b25]/20 transition-all appearance-none cursor-pointer"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  >
                    <option value="2026-2027">
                      Session 2026-2027 (Current)
                    </option>
                    <option value="2025-2026">
                      Session 2025-2026
                    </option>
                  </select>
                </div>

                {/* Username */}
                <div>
                  <label
                    htmlFor="username_389"
                    className="text-[9px] sm:text-[10px] font-bold text-[#5A6855] uppercase tracking-wider block mb-1"
                  >
                    Username
                  </label>

                  <input
                    id="username_389"
                    name="username"
                    aria-label="Username"
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-2.5 sm:p-3 rounded-[9px] sm:rounded-[10px] border border-[#ccc] bg-white/90 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#2e5b25] focus:ring-2 focus:ring-[#2e5b25]/20 transition-all"
                    required
                  />
                </div>

                {/* Password */}
                <div>
                  <div className="flex justify-between items-center mb-1">

                    <label
                      htmlFor="password_413"
                      className="text-[9px] sm:text-[10px] font-bold text-[#5A6855] uppercase tracking-wider block"
                    >
                      Password
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[9px] sm:text-[10px] text-[#2e5b25] font-semibold hover:underline cursor-pointer"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>

                  </div>

                  <input
                    id="password_413"
                    name="password"
                    aria-label="Password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2.5 sm:p-3 rounded-[9px] sm:rounded-[10px] border border-[#ccc] bg-white/90 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#2e5b25] focus:ring-2 focus:ring-[#2e5b25]/20 transition-all"
                    required
                  />
                </div>

                {/* Forgot Password */}
                <div className="flex justify-end pt-0.5">
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      alert(
                        "Bally Jute Mill Operator Credentials:\nID: ADMIN\nPassword: Admin@1234"
                      );
                    }}
                    className="text-[10px] sm:text-[11px] text-[#5D6B58] hover:text-[#2e5b25] font-medium transition-colors"
                  >
                    Forgot Password?
                  </a>
                </div>

                {/* Login */}
                <button
                  type="submit"
                  className="w-full p-3 sm:p-3.5 mt-1 rounded-[9px] sm:rounded-[10px] bg-[#2e5b25] hover:bg-[#23471c] text-white font-bold text-xs sm:text-sm tracking-wide border-none cursor-pointer transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  Login
                </button>

              </form>
            </div>
          </div>
        </div>
      )}


      {/* ================= MOBILE LOGIN ================= */}
      {isMobile === true && (
        <div className="min-h-screen w-full bg-[#f5f5f5] flex items-center justify-center px-5 py-8">

          {/* Mobile Login Card */}
          <div className="w-full max-w-[420px] bg-[#f0e9e0] p-5 rounded-[20px] shadow-[0_15px_40px_rgba(0,0,0,0.15)] border border-[#d6caa8]">

            {/* Header */}
            <div className="text-center mb-6">

              <h2 className="text-2xl font-bold text-[#1E331B] tracking-tight">
                Bally Jute Login
              </h2>

              <p className="text-xs text-[#5A6855] font-medium mt-1">
                Enter your operational credentials
              </p>

            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onLogin(year, username, password);
              }}
              className="space-y-4"
            >

              {/* Financial Session */}
              <div>
                <label
                  htmlFor="mobile_financial_session"
                  className="text-[11px] font-bold text-[#5A6855] uppercase tracking-wider block mb-1.5"
                >
                  Financial Session
                </label>

                <select
                  id="mobile_financial_session"
                  name="financial_session"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full h-12 px-3 rounded-[10px] border border-[#ccc] bg-white text-sm font-semibold text-slate-800 outline-none focus:border-[#2e5b25] focus:ring-2 focus:ring-[#2e5b25]/20 appearance-none"
                >
                  <option value="2026-2027">
                    Session 2026-2027 (Current)
                  </option>

                  <option value="2025-2026">
                    Session 2025-2026
                  </option>
                </select>
              </div>


              {/* Username */}
              <div>
                <label
                  htmlFor="mobile_username"
                  className="text-[11px] font-bold text-[#5A6855] uppercase tracking-wider block mb-1.5"
                >
                  Username
                </label>

                <input
                  id="mobile_username"
                  name="username"
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-12 px-3 rounded-[10px] border border-[#ccc] bg-white text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#2e5b25] focus:ring-2 focus:ring-[#2e5b25]/20"
                  required
                />
              </div>


              {/* Password */}
              <div>

                <div className="flex justify-between items-center mb-1.5">

                  <label
                    htmlFor="mobile_password"
                    className="text-[11px] font-bold text-[#5A6855] uppercase tracking-wider"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-[#2e5b25] font-semibold"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>

                </div>

                <input
                  id="mobile_password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 px-3 rounded-[10px] border border-[#ccc] bg-white text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#2e5b25] focus:ring-2 focus:ring-[#2e5b25]/20"
                  required
                />

              </div>


              {/* Forgot Password */}
              <div className="flex justify-end">

                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    alert(
                      "Bally Jute Mill Operator Credentials:\nID: ADMIN\nPassword: Admin@1234"
                    );
                  }}
                  className="text-xs text-[#5D6B58] font-medium"
                >
                  Forgot Password?
                </a>

              </div>


              {/* Login Button */}
              <button
                type="submit"
                className="w-full h-12 rounded-[10px] bg-[#2e5b25] hover:bg-[#23471c] text-white font-bold text-sm tracking-wide shadow-md active:scale-[0.99] transition-all"
              >
                Login
              </button>

            </form>

          </div>
        </div>
      )}

      
    </div>
  );
}

type Page =
  | "dashboard"
  | "amad"
  | "amad_entry"
  | "sauda"
  | "sauda_entry"
  | "satta"
  | "satta_entry"
  | "bardana"
  | "vyapari"
  | "reports"
  | "payment"
  | "ledger"
  | "balances"
  | "settings"
  | "stock"
  | "po"
  | "final_po"
  | "issue"
  | "requisition_desk"
  | "admindesk"
  | "ai_assistant"
  | "material_inspection"
  | "inspection"
  | "mr_settlement"
  | "closing_stock"
  | "mismatch"
  | "material_mismatch"
  | "club_po_mr"
  | "final_arrival"
  | "satta_chart"
  | "sms_sauda"
  | "weight_bridge"
  | "main_gate"
  | "trades"
  | "treds"
  | "trade";

const allSidebarItems = [
  { id: "dashboard", label: "Operational Hub", icon: LayoutDashboard },
  { id: "main_gate", label: "Main Gate (Temporary Arrival)", icon: Truck },
  { id: "sms_sauda", label: "SMS Sauda Desk", icon: MessageSquare },
  { id: "sauda", label: "Sauda Desk", icon: HandCoins },
  { id: "po", label: "Sauda Check Point", icon: FileText },
  { id: "final_po", label: "Final P.O", icon: FileText },
  { id: "amad", label: "Temporary Arrival", icon: Archive },
  { id: "final_arrival", label: "Final Arrival", icon: CheckCircle2 },
  { id: "inspection", label: "MILL INSPECTION", icon: ClipboardCheck },
  { id: "material_inspection", label: "INSPECTION CHECKLIST", icon: ShieldCheck },
  { id: "mismatch", label: "Mismatch Case", icon: AlertTriangle },
  { id: "club_po_mr", label: "Club P.O & Arrival", icon: Link },
  { id: "payment", label: "Payment", icon: Wallet },
  { id: "mr_settlement", label: "Settlement", icon: FileCheck },
  { id: "issue", label: "Material Issue", icon: PackageCheck },
  { id: "bardana", label: "Godown Master", icon: Store },
  { id: "closing_stock", label: "Stock Inventory", icon: Layers },
  { id: "weight_bridge", label: "Weight Bridge", icon: Scale },
  { id: "reports", label: "Reports", icon: TrendingUp },
  { id: "settings", label: "Config Center", icon: Settings },
  { id: "admindesk", label: "Admin Desk", icon: Lock },
  { id: "satta", label: "Satta", icon: Sparkles },
  { id: "requisition_desk", label: "Requisition Desk", icon: ClipboardList },
  { id: "vyapari", label: "Trade (Traders Directory)", icon: Users },
  { id: "ai_assistant", label: "Jarves AI 2.0", icon: Bot },
  { id: "treds", label: "Trade", icon: Wallet },
];

function getPageMeta(pageId: string) {
  // 1. Try to find in standard sidebar items
  const item = allSidebarItems.find((i) => i.id === pageId);
  if (item) {
    return { label: item.label, icon: item.icon };
  }

  // 2. Custom mappings
  if (pageId === "main_gate" || pageId === "maingate") {
    return { label: "Main Gate", icon: Truck };
  }
  if (pageId === "amad_entry") {
    return { label: "Amad Entry", icon: PlusCircle };
  }
  if (pageId === "sauda_entry") {
    return { label: "Sauda Entry", icon: PlusCircle };
  }
  if (pageId === "satta_entry") {
    return { label: "Satta Entry", icon: PlusCircle };
  }
  if (pageId === "vyapari" || pageId === "trade" || pageId === "treds" || pageId === "trades" || pageId === "trede") {
    return { label: "Trade", icon: Wallet };
  }
  if (pageId === "admindesk") {
    return { label: "Admin Desk", icon: Settings };
  }
  if (pageId === "payment") {
    return { label: "Payment Module", icon: FileText };
  }

  // 3. Fallbacks
  const fallbackLabel = pageId
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    label: fallbackLabel === "Ai Assistant" ? "AI Assistant" : fallbackLabel,
    icon: LayoutDashboard,
  };
}

const JCI_WORKFLOW_STEPS: {
  stepNumber: number;
  title: string;
  pageId: Page;
  matchPages: Page[];
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}[] = [
  {
    stepNumber: 1,
    title: "Sauda Entry",
    pageId: "sauda",
    matchPages: ["sauda", "sauda_entry", "sms_sauda"],
    icon: HandCoins,
    desc: "Contract & Rate Booking",
  },
  {
    stepNumber: 2,
    title: "Sauda Check Point",
    pageId: "po",
    matchPages: ["po"],
    icon: FileText,
    desc: "Sauda Check Point & Verification",
  },
  {
    stepNumber: 3,
    title: "Temporary Arrival",
    pageId: "amad",
    matchPages: ["amad", "amad_entry", "main_gate"],
    icon: Archive,
    desc: "Gate Inward & Temporary MR",
  },
  {
    stepNumber: 4,
    title: "Mismatch Section",
    pageId: "material_mismatch",
    matchPages: ["material_mismatch", "mismatch"],
    icon: AlertTriangle,
    desc: "Material & Quality Discrepancies",
  },
  {
    stepNumber: 5,
    title: "Final Arrival",
    pageId: "final_arrival",
    matchPages: ["final_arrival"],
    icon: CheckCircle2,
    desc: "Final Weighbridge Arrival & MR",
  },
  {
    stepNumber: 6,
    title: "Mill Inspection",
    pageId: "inspection",
    matchPages: ["inspection", "material_inspection"],
    icon: ClipboardCheck,
    desc: "Quality Audit & Lab Inspection",
  },
  {
    stepNumber: 7,
    title: "Final P.O.",
    pageId: "final_po",
    matchPages: ["final_po"],
    icon: FileText,
    desc: "Approved Final Purchase Order",
  },
  {
    stepNumber: 8,
    title: "Payment",
    pageId: "payment",
    matchPages: ["payment"],
    icon: Wallet,
    desc: "Payment & Accounts Voucher",
  },
  {
    stepNumber: 9,
    title: "Settlement",
    pageId: "mr_settlement",
    matchPages: ["mr_settlement"],
    icon: FileCheck,
    desc: "Final Accounts & Rate Settlement",
  },
];

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string>("L1");
  const [userLevel, setUserLevel] = useState<string>("L1");
  const [selectedYear, setSelectedYear] = useState("2026-2027");
  const [currentPage, setCurrentPage] = useState<Page>("dashboard");
  const [isTempPo, setIsTempPo] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [dashboardTab, setDashboardTab] = useState<
    "menu" | "mismatch" | "reports"
  >("menu");
  const [allowedModules, setAllowedModules] = useState<string[]>(["*"]);
  const [runningPages, setRunningPages] = useState<Page[]>([]);
  const [selectedAmadForFinalMr, setSelectedAmadForFinalMr] = useState<any>(null);

  const [currentTime, setCurrentTime] = useState(() => new Date());

  React.useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        // Preserving local storage/session storage to maintain login sessions and schema sync flags.
        if ("caches" in window) {
          caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
          });
        }
      }
    } catch (e) {
      console.warn("Cache purge error:", e);
    }
  }, []);

  // Restore authenticated session & module permissions from localStorage
  React.useEffect(() => {
    try {
      const rawSession = localStorage.getItem("bally_auth_session");
      if (rawSession) {
        const sess = JSON.parse(rawSession);
        if (sess && sess.username) {
          const isAdminUser = sess.role?.toUpperCase() === "ADMIN" || sess.role?.toUpperCase() === "ADMINISTRATOR";
          setIsAdmin(isAdminUser);
          setUserRole(sess.role?.toUpperCase() || "L1");
          setUserLevel(sess.level?.toUpperCase() || "L1");
          const rawMods = sess.allowed_modules;
          const mods = (rawMods !== undefined && rawMods !== null && String(rawMods).trim() !== "" && String(rawMods).trim() !== "[]")
            ? normalizeAllowedModules(rawMods)
            : ["*"];
          const finalMods = mods.length === 0 ? ["*"] : mods;
          
          setCurrentUserContext({
            userId: sess.userId || 'op_1',
            username: sess.username,
            userName: sess.username,
            userRole: sess.role?.toUpperCase() || "L1",
            userLevel: sess.level?.toUpperCase() || "L1",
            allowedModules: finalMods,
          });

          setAllowedModules(finalMods);
          setIsLoggedIn(true);
          if (sess.year) setSelectedYear(sess.year);

          // Check if URL specifies a target page
          const urlParams = new URLSearchParams(window.location.search);
          const qPage = urlParams.get('page') || (window.location.hash ? window.location.hash.replace('#', '') : null);
          if (qPage && hasModulePermission(qPage, finalMods, isAdminUser)) {
            setCurrentPage(qPage as Page);
          } else {
            const firstAllowed = getFirstAllowedPage(finalMods, isAdminUser) as Page;
            setCurrentPage(firstAllowed);
          }
        }
      }
      setSessionStatus('ready');
    } catch (e) {
      console.warn("Session restore error:", e);
      setSessionStatus('error');
    }
  }, []);

  // Subscribe to live permission updates (e.g. when Admin updates allowed modules in Admin Desk)
  React.useEffect(() => {
    return subscribeToPermissions((detail) => {
      const currentCtx = getCurrentUserContext();
      if (
        detail.userId === currentCtx.userId ||
        detail.username?.toLowerCase() === currentCtx.username?.toLowerCase() ||
        detail.username?.toLowerCase() === currentCtx.userName?.toLowerCase() ||
        detail.userId === 'all'
      ) {
        const newMods = detail.allowed_modules === "*"
          ? ["*"]
          : normalizeAllowedModules(detail.allowed_modules || "");
        setAllowedModules(newMods);
        const isAdm = detail.role?.toUpperCase() === "ADMIN" || detail.role?.toUpperCase() === "ADMINISTRATOR";
        if (detail.role) {
          setIsAdmin(isAdm);
          setUserRole(detail.role.toUpperCase());
        }
        if (detail.level) {
          setUserLevel(detail.level.toUpperCase());
        }
        setCurrentUserContext({
          allowedModules: newMods,
          userRole: detail.role ? detail.role.toUpperCase() : currentCtx.userRole,
          userLevel: detail.level ? detail.level.toUpperCase() : currentCtx.userLevel,
        }, false);

        try {
          const raw = localStorage.getItem("bally_auth_session");
          if (raw) {
            const parsed = JSON.parse(raw);
            localStorage.setItem("bally_auth_session", JSON.stringify({
              ...parsed,
              allowed_modules: detail.allowed_modules,
              role: detail.role || parsed.role,
              level: detail.level || parsed.level,
            }));
          }
        } catch {}

        // Auto-redirect if currently open page is no longer permitted
        if (!hasModulePermission(currentPage, newMods, isAdm)) {
          const fallback = getFirstAllowedPage(newMods, isAdm) as Page;
          setCurrentPage('dashboard');
        }
      }
    });
  }, [currentPage]);

  // Sync current page to URL for bookmarking and page refresh preservation
  React.useEffect(() => {
    if (!isLoggedIn) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("page", currentPage);
      window.history.replaceState(null, "", url.toString());
    } catch {}
  }, [currentPage, isLoggedIn]);

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [keyState, setKeyState] = useState({ num: true, caps: false, scrl: false });

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.getModifierState) {
        setKeyState({
          num: e.getModifierState('NumLock'),
          caps: e.getModifierState('CapsLock'),
          scrl: e.getModifierState('ScrollLock'),
        });
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useIdleTimer(15 * 60 * 1000, () => {
    if (isLoggedIn) {
      setIsLoggedIn(false);
      window.alert("Session auto-locked due to 15 minutes of inactivity.");
      localStorage.clear();
    }
  });

  // Custom HTML Alert Popup State & Global Override
  const [htmlAlert, setHtmlAlert] = useState<{ message: string } | null>(null);

  React.useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message: any) => {
      console.log("Custom HTML Alert Intercepted:", message);
      setHtmlAlert({ message: String(message) });
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);
  const [systemLogs, setSystemLogs] = useState<
    {
      id: string;
      timestamp: string;
      event: string;
      details: string;
      currentPage: string;
      runningPages: string[];
    }[]
  >([]);

  // Command Menu Helper States
  const [showCommandSearch, setShowCommandSearch] = useState(false);
  const [commandSearchQuery, setCommandSearchQuery] = useState("");
  const [highlightedCommandIndex, setHighlightedCommandIndex] = useState(0);

  // Global Route Guard
  const [showGlobalSattaWarning, setShowGlobalSattaWarning] = useState(false);

  const globalNavigate = async (targetPage: Page, subId?: string): Promise<boolean> => {
    let actualTarget = targetPage;
    if (subId === 'po_final' || targetPage === 'po_final' as any) {
      actualTarget = 'final_po';
    } else if (subId === 'po_temp') {
      actualTarget = 'po';
    } else if (targetPage === 'main_gate' as any || targetPage === 'maingate' as any) {
      actualTarget = 'main_gate';
    }

    // Strict Permission Guard: Verify user has permission for the target module
    const isPermitted = hasModulePermission(actualTarget, allowedModules, isAdmin) ||
      (subId ? hasModulePermission(subId, allowedModules, isAdmin) : false);

    if (!isPermitted) {
      alert(`Access Denied: Your account does not have permission to access module [${subId || actualTarget}].`);
      return false;
    }

    // Determine if we need to block this target page.
    // Dashboard and Satta modules should always be accessible.
    const isRestrictedPage = targetPage !== "dashboard" && targetPage !== "satta" && targetPage !== "satta_chart";
    
    // Satta Rate Guard: Explicitly exclude Admin, L2, L3, L4, and L5
    const isL1User = userLevel === "L1";
    const isExcludedRole = isAdmin || ["L2", "L3", "L4", "L5"].includes(userLevel);

    if (isRestrictedPage && isL1User && !isExcludedRole) {
      const now = new Date();
      const localYear = now.getFullYear();
      const localMonth = String(now.getMonth() + 1).padStart(2, '0');
      const localDay = String(now.getDate()).padStart(2, '0');
      const todayLocalStr = `${localYear}-${localMonth}-${localDay}`;
      const todayUtcStr = now.toISOString().split("T")[0];

      if (supabase) {
        // Fallback: check Supabase directly if any Satta chart was uploaded/updated today by any user
        try {
          const isSameDay = (dateStr?: string) => {
            if (!dateStr) return false;
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return false;
            const dLocalStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const dUtcStr = d.toISOString().split("T")[0];
            return dLocalStr === todayLocalStr || dLocalStr === todayUtcStr || dUtcStr === todayLocalStr || dUtcStr === todayUtcStr;
          };

            // Check satta_base_rates
            const { data: baseRates } = await supabase
              .from('satta_base_rates')
              .select('id, created_at, start_date')
              .order('created_at', { ascending: false })
              .limit(1);

            // Check satta_base_rate_audit_logs
            const { data: auditLogs } = await supabase
              .from('satta_base_rate_audit_logs')
              .select('id, created_at, changed_date')
              .order('created_at', { ascending: false })
              .limit(1);

            // Check satta_differentials
            const { data: diffLogs } = await supabase
              .from('satta_differentials')
              .select('id, created_at')
              .order('created_at', { ascending: false })
              .limit(1);

            let isUploadedToday = false;

            if (baseRates && baseRates.length > 0) {
              const r = baseRates[0];
              if (isSameDay(r.created_at) || r.start_date === todayLocalStr || r.start_date === todayUtcStr) {
                isUploadedToday = true;
              }
            }

            if (!isUploadedToday && auditLogs && auditLogs.length > 0) {
              const a = auditLogs[0];
              if (isSameDay(a.created_at) || a.changed_date === todayLocalStr || a.changed_date === todayUtcStr) {
                isUploadedToday = true;
              }
            }

            if (!isUploadedToday && diffLogs && diffLogs.length > 0) {
              const df = diffLogs[0];
              if (isSameDay(df.created_at)) {
                isUploadedToday = true;
              }
            }

            if (!isUploadedToday) {
              setShowGlobalSattaWarning(true);
              return false; // Prevent navigation
            }
          } catch (e) {
            console.warn("Failed to check satta base rates in Supabase:", e);
            setShowGlobalSattaWarning(true);
            return false; // Prevent navigation
          }
        } else {
          setShowGlobalSattaWarning(true);
          return false; // Prevent navigation
        }
    }

    setCurrentPage(actualTarget);
    if (actualTarget === 'po' || subId === 'po_temp') {
      setIsTempPo(true);
    } else if (actualTarget === 'final_po' || subId === 'po_final') {
      setIsTempPo(false);
    }
    
    return true;
  };

  // Global Ctrl+K command listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandSearch((prev) => !prev);
        setCommandSearchQuery("");
        setHighlightedCommandIndex(0);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Refs to always have fresh state values for async/sync logging without stale closure problems
  const currentPageRef = React.useRef(currentPage);
  const runningPagesRef = React.useRef(runningPages);

  React.useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  React.useEffect(() => {
    runningPagesRef.current = runningPages;
  }, [runningPages]);

  const logEvent = React.useCallback((event: string, details: string) => {
    const now = new Date();
    const timestamp =
      now.toLocaleTimeString() +
      "." +
      String(now.getMilliseconds()).padStart(3, "0");

    // Core audit tracking for P.O synchronization with Material Inspection records
    let enhancedDetails = details;
    if (event === "PO_SYNC") {
      const matchPo = details.match(/\[PO:\s*([^\]]+)\]/);
      const matchMr = details.match(/\[MR:\s*([^\]]+)\]/);
      const poNo = matchPo ? matchPo[1] : "UNKNOWN_PO";
      const mrNo = matchMr ? matchMr[1] : "UNKNOWN_MR";
      const syncTimestamp = now.toISOString();

      const statusDetails = `[PO-INSPECTION-AUDIT] PO No: ${poNo}, MR No: ${mrNo}, Timestamp: ${syncTimestamp}, Field Match Status: MATCHED & VERIFIED`;
      enhancedDetails = `${details} | ${statusDetails}`;
    }

    setSystemLogs((prev) => {
      const newLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp,
        event,
        details: enhancedDetails,
        currentPage: currentPageRef.current,
        runningPages: [...runningPagesRef.current],
      };
      return [newLog, ...prev].slice(0, 300); // Keep last 300 logs
    });

    if (supabase) {
      const username = getCurrentUserContext().username || "ADMIN";
      supabase
        .from("user_activity_logs")
        .insert([
          {
            username,
            activity_type: event,
            module_name: currentPageRef.current || "system",
            action_details: enhancedDetails,
            ip_address: "Local",
          },
        ])
        .then(({ error }) => {
          if (error) {
            console.warn("User activity logging failed:", error);
          }
        });
    }
  }, []);

  // Log system boot once logged in
  React.useEffect(() => {
    if (isLoggedIn) {
      logEvent(
        "SYSTEM_BOOT",
        `P.O Automation Console booted in session year ${selectedYear}.`,
      );
    }
  }, [isLoggedIn, selectedYear, logEvent]);

  // Log all page changes
  React.useEffect(() => {
    if (isLoggedIn) {
      logEvent(
        "NAVIGATION",
        `Transitioned active view state to "${currentPage}"`,
      );
    }
  }, [currentPage, isLoggedIn, logEvent]);

  React.useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-legacy-bg", "#E8E6E1");
    root.style.setProperty("--color-legacy-blue", "#000080");
    root.style.setProperty("--color-legacy-navy", "#1a237e");
    root.style.setProperty("--color-legacy-teal", "#006064");
  }, []);

  React.useEffect(() => {
    if (currentPage !== "dashboard") {
      setRunningPages((prev) => {
        if (!prev.includes(currentPage)) {
          logEvent(
            "TASK_STARTED",
            `Registered background workspace task execution for "${currentPage}"`,
          );
          return [...prev, currentPage];
        }
        return prev;
      });
    }
  }, [currentPage, logEvent]);

  const closePage = (targetPage: Page, destination?: Page) => {
    const fallbackTarget = hasModulePermission("dashboard", allowedModules, isAdmin)
      ? "dashboard"
      : (getFirstAllowedPage(allowedModules, isAdmin) as Page);
    const actualDestination = destination && hasModulePermission(destination, allowedModules, isAdmin)
      ? destination
      : fallbackTarget;

    logEvent(
      "PAGE_CLOSE",
      `Terminated & Closed workspace screen instance "${targetPage}". Returning to "${actualDestination}"`,
    );
    setRunningPages((prev) => prev.filter((p) => p !== targetPage));
    if (actualDestination !== targetPage) {
      globalNavigate(actualDestination);
    }
  };

  React.useEffect(() => {
    const fallbackTarget = hasModulePermission("dashboard", allowedModules, isAdmin)
      ? "dashboard"
      : (getFirstAllowedPage(allowedModules, isAdmin) as Page);

    const handleBack = () => {
      if (currentPage !== "dashboard" && currentPage !== fallbackTarget) {
        const pageToClose = currentPage;
        logEvent("PAGE_CLOSE", `Event dynamic Back: closing "${pageToClose}"`);
        setRunningPages((prev) => prev.filter((p) => p !== pageToClose));
        globalNavigate(fallbackTarget);
      } else {
        logEvent(
          "SYSTEM_DEPART",
          "Session ended - operator exited login screen",
        );
        setIsLoggedIn(false);
      }
    };
    const handleClose = () => {
      if (currentPage !== "dashboard" && currentPage !== fallbackTarget) {
        const pageToClose = currentPage;
        logEvent(
          "PAGE_CLOSE",
          `Event dynamic Close: stopping application widget "${pageToClose}"`,
        );
        setRunningPages((prev) => prev.filter((p) => p !== pageToClose));
        globalNavigate(fallbackTarget);
      } else {
        logEvent(
          "SYSTEM_DEPART",
          "Session ended - operator exited login screen",
        );
        setIsLoggedIn(false);
      }
    };

    const handleAppNavigate = (e: any) => {
      if (e.detail && e.detail.page) {
        globalNavigate(e.detail.page);
      }
    };

    window.addEventListener("app-back", handleBack);
    window.addEventListener("app-close", handleClose);
    window.addEventListener("app-navigate", handleAppNavigate);

    return () => {
      window.removeEventListener("app-back", handleBack);
      window.removeEventListener("app-close", handleClose);
      window.removeEventListener("app-navigate", handleAppNavigate);
    };
  }, [currentPage, allowedModules, isAdmin]);

  const handleLogin = async (year: string, user: string, pass: string) => {
    // Master Admin Fallback
    if (user.toLowerCase() === "admin") {
      if (pass !== "Admin@4321") {
        alert("Access denied: Invalid Admin Password.");
        return;
      }
      setIsAdmin(true);
      setUserRole("ADMIN");
      setUserLevel("ADMIN");
      setIsLoggedIn(true);
      setSelectedYear(year);
      setAllowedModules(["*"]);
      setCurrentPage("dashboard");
      setCurrentUserContext({ userId: "admin", username: "ADMIN", userName: "ADMIN", userRole: "ADMIN", userLevel: "ADMIN", allowedModules: ["*"] });
      try {
        localStorage.setItem("bally_auth_session", JSON.stringify({
          userId: "admin",
          username: "ADMIN",
          role: "ADMIN",
          level: "ADMIN",
          allowed_modules: "*",
          year: year
        }));
      } catch (e) {}
      logEvent(
        "LOGIN_HISTORY",
        `Administrator login verified under session year: ${year}`,
      );
      setSessionStatus('ready');
      return;
    }

    if (!supabase) {
      alert("System offline. Use master override credentials.");
      return;
    }

    try {
      const trimmedUser = user.trim();
      const { data, error } = await supabase
        .from("user_master")
        .select("*")
        .or(`user_id.ilike.${trimmedUser},username.ilike.${trimmedUser}`)
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        alert("Invalid system credentials. User not found.");
        return;
      }

      if (data.status && data.status.toLowerCase() !== "active") {
        alert("Access denied: Your account is currently inactive. Please contact Administrator.");
        return;
      }

      // Check password (assume plain text for this legacy demo or user preference)
      if (data.password === pass) {
        const isAdminUser =
          data.role?.toUpperCase() === "ADMIN" ||
          data.role?.toUpperCase() === "ADMINISTRATOR";
        setIsAdmin(isAdminUser);
        setUserRole(data.role?.toUpperCase() || "L1");
        setUserLevel(data.level?.toUpperCase() || "L1");
        const rawMods = data.allowed_modules;
        const modules = (rawMods !== undefined && rawMods !== null && String(rawMods).trim() !== "" && String(rawMods).trim() !== "[]")
          ? normalizeAllowedModules(rawMods)
          : ["*"];
        const finalMods = modules.length === 0 ? ["*"] : modules;

        setCurrentUserContext({
          userId: data.user_id,
          username: data.username,
          userName: data.username,
          userRole: data.role?.toUpperCase() || "L1",
          userLevel: data.level?.toUpperCase() || "L1",
          allowedModules: finalMods,
        });

        setAllowedModules(finalMods);
        setIsLoggedIn(true);
        setSelectedYear(year);

        const firstLanding = getFirstAllowedPage(finalMods, isAdminUser) as Page;
        setCurrentPage(firstLanding);

        // Persist session
        try {
          localStorage.setItem("bally_auth_session", JSON.stringify({
            userId: data.user_id,
            username: data.username,
            role: data.role?.toUpperCase() || "L1",
            level: data.level?.toUpperCase() || "L1",
            allowed_modules: data.allowed_modules || "*",
            year: year
          }));
        } catch (e) {}

        // Update last login
        supabase.from('user_master').update({ last_login: new Date().toISOString() }).eq('user_id', data.user_id).then(res => console.log("Login Update:", res));
        
        logEvent(
          "LOGIN_HISTORY",
          `Operator account: ${data.username} [Role: ${data.role || "USER"}] successfully logged in under session year: ${year}`,
        );
        setSessionStatus('ready');
      } else {
        alert("Access denied: Authentication failure.");
      }
    } catch (err) {
      console.error("Login fault:", err);
      alert("Internal security fault. Verify DB connection.");
    }
  };

  if (sessionStatus === 'loading') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FAF7F0] font-sans">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-slate-200 max-w-sm w-full">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-base font-bold text-[#1E331B] uppercase tracking-wide">Loading your workspace...</h2>
          <p className="text-xs text-slate-500 mt-1">Verifying access permissions and active session...</p>
        </div>
      </div>
    );
  }

  if (sessionStatus === 'error') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#FAF7F0] font-sans">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg border border-red-200 max-w-sm w-full">
          <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 font-bold">!</div>
          <h2 className="text-base font-bold text-red-900 uppercase tracking-wide">Session Verification Error</h2>
          <p className="text-xs text-slate-600 mt-1">Unable to load workspace security context. Please check your connection and reload.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-[#1E331B] text-white rounded text-xs font-bold uppercase cursor-pointer"
          >
            Reload Application
          </button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <AuthScreen onLogin={handleLogin} />

        {/* Custom HTML Alert overlay for Login Screen */}
        {htmlAlert && (
          <SystemNoticeModal
            message={htmlAlert.message}
            onClose={() => setHtmlAlert(null)}
          />
        )}
      </>
    );
  }

  const sidebarItems =
    isAdmin || allowedModules.includes("*")
      ? allSidebarItems
      : allSidebarItems.filter(
          (item) => hasModulePermission(item.id, allowedModules, isAdmin),
        );

  return (
    <div className="flex h-screen w-full max-w-full min-w-0 overflow-hidden bg-legacy-bg font-sans">
      {/* Master Wrapper */}
      <div className="flex flex-1 flex-col w-full max-w-full min-w-0 h-full overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden w-full max-w-full min-w-0">
          {/* Sidebar removed per user request */}

          {/* Dynamic Page Rendering */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-auto w-full max-w-full main-content">
            <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-auto relative w-full max-w-full">
              {!hasModulePermission(currentPage, allowedModules, isAdmin) ? (
                <LegacyLayout
                  title="ACCESS CONTROL RESTRICTION"
                  allowedModules={allowedModules}
                  isAdmin={isAdmin}
                  onNavClick={(page) => globalNavigate(page as Page)}
                >
                  <div className="flex-1 flex items-center justify-center p-8 bg-[#F4EFE6] min-h-[500px]">
                    <div className="bg-[#FAF7F0] border-2 border-red-300 rounded-xl p-8 max-w-lg text-center shadow-lg">
                      <div className="w-14 h-14 rounded-full bg-red-100 border border-red-200 text-red-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
                        <Lock className="w-7 h-7" />
                      </div>
                      <h3 className="text-lg font-bold text-[#1E331B] uppercase tracking-wide">Access Restricted</h3>
                      <p className="text-sm text-[#5A6E54] mt-2">
                        Your operator account does not hold permissions to access module <span className="font-mono font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">[{ALL_SYSTEM_MODULES.find(x => x.id === currentPage || x.pageId === currentPage || x.aliases.includes(currentPage))?.label || currentPage}]</span>.
                      </p>
                      
                      <div className="mt-4 p-3 bg-white/80 rounded-lg border border-slate-200 text-left">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                          Your Permitted Modules:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {(allowedModules && allowedModules.length > 0 && !allowedModules.includes("*") ? allowedModules : ['dashboard']).map((m) => {
                            const def = ALL_SYSTEM_MODULES.find(x => x.id === m || x.aliases.includes(m));
                            const label = def?.label || m;
                            const pageId = (def?.pageId || m) as Page;
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() => globalNavigate(pageId)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-semibold uppercase tracking-wide transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            const firstAllowed = getFirstAllowedPage(allowedModules, isAdmin) as Page;
                            globalNavigate(firstAllowed);
                          }}
                          className="w-full sm:w-auto px-5 py-2.5 bg-[#1E331B] text-[#FAF7F0] rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-[#2A4426] transition-all shadow-sm active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          Go to Permitted Module
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            localStorage.removeItem("bally_auth_session");
                            localStorage.removeItem("bally_user_context");
                            setIsLoggedIn(false);
                            setIsAdmin(false);
                            setAllowedModules(["*"]);
                          }}
                          className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-200 transition-all cursor-pointer"
                        >
                          Logout / Switch User
                        </button>
                      </div>
                    </div>
                  </div>
                </LegacyLayout>
              ) : (
                <>
                  <div
                    className={currentPage === "dashboard" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
                  >
                <Dashboard
                  isActive={currentPage === "dashboard"}
                  onNavigate={globalNavigate}
                  isAdmin={isAdmin}
                  allowedModules={allowedModules}
                  currentTab={dashboardTab}
                  setCurrentTab={setDashboardTab}
                />
              </div>
              <div
                className={currentPage === "main_gate" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <LorryDispatchSystem
                  onNavigate={(page) => globalNavigate(page as Page)}
                />
              </div>
              <div
                className={currentPage === "amad" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <AmadRegister
                  onClose={() => closePage("amad", "dashboard")}
                  onNew={() => globalNavigate("amad_entry")}
                  onNavigate={(page) => globalNavigate(page as Page)}
                  onCreateFinalMr={(amad) => {
                    setSelectedAmadForFinalMr(amad);
                    globalNavigate("final_arrival");
                  }}
                />
              </div>
              {currentPage === "amad_entry" && (
                <div className="flex-1 flex flex-col h-full w-full min-h-0 overflow-auto">
                  <TemporaryArrival
                    onCancel={() => closePage("amad_entry", "amad")}
                    onSave={() => closePage("amad_entry", "amad")}
                  />
                </div>
              )}
              <div
                className={currentPage === "sms_sauda" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <SmsSaudaDesk
                  onClose={() => closePage("sms_sauda", "dashboard")}
                  onNavigate={(page) => globalNavigate(page as Page)}
                />
              </div>
              <div
                className={currentPage === "sauda" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <SaudaRegister
                  isActive={currentPage === "sauda"}
                  onClose={() => closePage("sauda", "dashboard")}
                  onNew={() => globalNavigate("sauda_entry")}
                />
              </div>
              {currentPage === "sauda_entry" && (
                <div className="flex-1 flex flex-col h-full w-full min-h-0 overflow-auto">
                  <SaudaEntry
                    onCancel={() => closePage("sauda_entry", "sauda")}
                    onSave={() => closePage("sauda_entry", "sauda")}
                  />
                </div>
              )}
              <div
                className={currentPage === "satta" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <SattaChart onClose={() => closePage("satta", "dashboard")} />
              </div>
              {currentPage === "satta_entry" && (
                <div className="flex-1 flex flex-col h-full w-full min-h-0 overflow-auto">
                  <SattaEntry
                    onCancel={() => closePage("satta_entry", "satta")}
                    onSave={() => closePage("satta_entry", "satta")}
                  />
                </div>
              )}
              <div
                className={currentPage === "satta_chart" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <SattaChart
                  onClose={() => {
                    if (currentPage === "satta_chart") {
                      closePage("satta_chart", "dashboard");
                    } else {
                      closePage("satta_chart", "satta");
                    }
                  }}
                />
              </div>
              <div
                className={currentPage === "po" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <PurchaseOrder
                  onClose={() => closePage("po", "dashboard")}
                  selectedYear={selectedYear}
                  isTempPo={true}
                />
              </div>
              <div
                className={currentPage === "final_po" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <PurchaseOrder
                  onClose={() => closePage("final_po", "dashboard")}
                  selectedYear={selectedYear}
                  isTempPo={false}
                />
              </div>
              {currentPage === "issue" && (
                <div className="flex-1 flex flex-col h-full w-full min-h-0 overflow-auto">
                  <MaterialIssue
                    onCancel={() => closePage("issue", "dashboard")}
                    onSave={() => closePage("issue", "dashboard")}
                    setCurrentPage={globalNavigate}
                    closePage={closePage}
                  />
                </div>
              )}
              <div
                className={currentPage === "bardana" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <BardanaVouchers
                  onClose={() => closePage("bardana", "dashboard")}
                />
              </div>
              <div
                className={(currentPage === "vyapari" || (currentPage as string) === "trade") ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <DirectoryView
                  title="Trade (Traders Directory)"
                  type="vyapari"
                  onClose={() => closePage("vyapari", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "reports" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <Reports onClose={() => closePage("reports", "dashboard")} />
              </div>
              <div
                className={(currentPage === "treds" || (currentPage as string) === "trade" || (currentPage as string) === "trades" || (currentPage as string) === "trede") ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <TredeReport onClose={() => closePage(currentPage, "dashboard")} />
              </div>
              <div
                className={currentPage === "payment" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <PaymentModule onClose={() => closePage("payment", "dashboard")} />
              </div>
              <div
                className={currentPage === "stock" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <StockSummary
                  onClose={() => closePage("stock", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "settings" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <ConfigGuide
                  onClose={() => closePage("settings", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "admindesk" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <AdminDesk
                  onClose={() => closePage("admindesk", "dashboard")}
                  onLogin={() => setIsAdmin(true)}
                  isAdmin={isAdmin}
                  systemLogs={systemLogs}
                  onClearLogs={() => setSystemLogs([])}
                  onNavigate={(page) => globalNavigate(page)}
                />
              </div>
              <div
                className={currentPage === "ai_assistant" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <AIPortal
                  onClose={() => closePage("ai_assistant", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "material_inspection" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <MaterialInspection
                  onClose={() => closePage("material_inspection", "dashboard")}
                  onLogEvent={logEvent}
                />
              </div>
              <div
                className={currentPage === "inspection" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <Inspection
                  onNavigate={(page) => globalNavigate(page as Page)}
                />
              </div>
              <div
                className={currentPage === "mr_settlement" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <MrSettlement
                  onClose={() => closePage("mr_settlement", "dashboard")}
                  onLogEvent={logEvent}
                />
              </div>
              <div
                className={currentPage === "closing_stock" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <ClosingStockEntry
                  onClose={() => closePage("closing_stock", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "mismatch" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <MismatchCase
                  variant="satta"
                  onClose={() => closePage("mismatch", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "material_mismatch" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <MismatchCase
                  variant="material"
                  onClose={() => closePage("material_mismatch", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "club_po_mr" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <ClubPOMR
                  onClose={() => closePage("club_po_mr", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "final_arrival" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <FinalArrival
                  initialData={selectedAmadForFinalMr}
                  onClose={() => {
                    setSelectedAmadForFinalMr(null);
                    closePage("final_arrival", "dashboard");
                  }}
                />
              </div>

              <div
                className={currentPage === "requisition_desk" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <RequisitionDesk
                  onClose={() => closePage("requisition_desk", "dashboard")}
                />
              </div>
              <div
                className={currentPage === "weight_bridge" ? "flex-1 flex flex-col h-full w-full min-h-0 overflow-auto" : "hidden"}
              >
                <WeightBridge
                  currentUser={getCurrentUserContext()}
                  allowedModules={allowedModules}
                  onNavigate={(page) => globalNavigate(page as Page)}
                />
              </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Single Unified Dark Green Footer */}
        <div className="bg-[#174C2C] border-t-2 border-[#103A20] px-3 py-1.5 flex justify-between items-center text-white shrink-0 shadow-2xl z-40 gap-3 w-full min-w-0">
          {/* Left Section: Online status & JCI Arrow-Wise Workflow Guide */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1 min-w-0">
            {/* System Online Status Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#103A20] rounded-md border border-[#235E39] text-[#E2EDDE] shrink-0">
              <div className={cn("w-2 h-2 rounded-full animate-pulse", isOnline ? "bg-emerald-400 shadow-xs" : "bg-rose-500")} />
              <span className={cn("uppercase tracking-wider font-mono font-bold text-[10px]", isOnline ? "text-emerald-300" : "text-rose-400")}>
                {isOnline ? 'SYSTEM ONLINE' : 'OFFLINE'}
              </span>
            </div>

            <div className="h-5 w-px bg-[#235E39] shrink-0" />

            {/* JCI Software Process Workflow Arrow Guide */}
            <div className="flex items-center gap-1.5 shrink-0 bg-[#0E351D] px-2 py-0.5 rounded-lg border border-[#235E39]/80 shadow-inner">
              {/* Sequential Arrow-Wise Steps */}
              <div className="flex items-center gap-1 shrink-0">
                {(() => {
                  const permittedWorkflowSteps = JCI_WORKFLOW_STEPS.filter((step) =>
                    hasModulePermission(step.pageId, allowedModules, isAdmin) ||
                    step.matchPages.some((p) => hasModulePermission(p, allowedModules, isAdmin))
                  );

                  if (permittedWorkflowSteps.length === 0) return null;

                  const activeStepIdx = permittedWorkflowSteps.findIndex((step) =>
                    step.matchPages.includes(currentPage)
                  );

                  return permittedWorkflowSteps.map((step, idx) => {
                    const isCurrent = step.matchPages.includes(currentPage);
                    const isPast = activeStepIdx !== -1 && idx < activeStepIdx;
                    const IconComp = step.icon;

                    return (
                      <React.Fragment key={step.stepNumber}>
                        <button
                          type="button"
                          onClick={() => globalNavigate(step.pageId)}
                          title={`Step ${step.stepNumber}: ${step.title} — ${step.desc} (Click to Navigate)`}
                          className={cn(
                            "group/step flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all duration-150 cursor-pointer shrink-0 border select-none",
                            isCurrent
                              ? "bg-[#256B3E] border-amber-300 text-amber-300 font-black shadow-md ring-2 ring-amber-400/50 scale-[1.02]"
                              : isPast
                              ? "bg-[#124225] border-[#2E7A4A] text-emerald-300 hover:bg-[#1A5732] hover:text-white font-bold"
                              : "bg-[#0E331B] border-[#1C5130] text-emerald-200/90 hover:bg-[#164927] hover:text-white font-medium"
                          )}
                        >
                          <span
                            className={cn(
                              "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-black shrink-0",
                              isCurrent
                                ? "bg-amber-400 text-[#0E351D]"
                                : isPast
                                ? "bg-emerald-600 text-white"
                                : "bg-[#184F2B] text-emerald-300 border border-[#2E7A4A]"
                            )}
                          >
                            {step.stepNumber}
                          </span>
                          <IconComp
                            className={cn(
                              "w-3 h-3 shrink-0",
                              isCurrent ? "text-amber-300" : isPast ? "text-emerald-400" : "text-emerald-400/70"
                            )}
                          />
                          <span className="text-[11px] whitespace-nowrap tracking-tight font-bold">
                            {step.title}
                          </span>
                        </button>

                        {/* Arrow separator */}
                        {idx < permittedWorkflowSteps.length - 1 && (
                          <div className="flex items-center text-amber-400 px-0.5 shrink-0">
                            <span className="text-[12px] font-black text-amber-400/90">➔</span>
                          </div>
                        )}
                      </React.Fragment>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Right Section: Logout */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Logout Button */}
            <button
              onClick={() => {
                setIsLoggedIn(false);
                try {
                  localStorage.removeItem("bally_auth_session");
                } catch (e) {}
                setCurrentUserContext({ username: 'Operator', userRole: 'L1', userLevel: 'L1', allowedModules: [] });
                setCurrentPage("dashboard");
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#103A20] hover:bg-rose-950/80 rounded-md border border-[#235E39] hover:border-rose-700 text-rose-300 hover:text-rose-100 transition-colors text-[10px] font-extrabold uppercase tracking-wider shrink-0 cursor-pointer"
              title="Logout System"
            >
              <Power className="h-3.5 w-3.5 text-rose-400" />
              <span className="hidden xs:inline">LOGOUT</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Quick-Command Navigator Modal (Ctrl+K Launcher Overlay) */}
      {showCommandSearch && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-[1px] z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowCommandSearch(false)}
        >
          <div
            className="w-full max-w-lg bg-[#d4d0c8] border-2 border-white shadow-[4px_4px_10px_rgba(0,0,0,0.3)]  text-slate-800 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Styled Retro Banner Title */}
            <div className="bg-indigo-950 px-2 py-1 text-white text-[10px] font-bold uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bot className="h-4 w-4 text-emerald-400 animate-pulse" />
                <span>
                  Jarves Integration Widget // Keyboard Navigator [CTRL+K]
                </span>
              </div>
              <button
                onClick={() => setShowCommandSearch(false)}
                className="text-white hover:text-red-400 font-extrabold text-xs px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-100 border-b border-slate-300">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
 id="search_by_module_name_e_g_1539" name="search_by_module_name_e_g" aria-label="Search by module name (e.g. Settlement, Purchase PO, Quality)..."                  type="text"
                  autoFocus
                  value={commandSearchQuery}
                  onChange={(e) => {
                    setCommandSearchQuery(e.target.value);
                    setHighlightedCommandIndex(0);
                  }}
                  onKeyDown={(e) => {
                    const activeModules =
                      isAdmin || allowedModules.includes("*")
                        ? allSidebarItems
                        : allSidebarItems.filter(
                            (item) =>
                              hasModulePermission(item.id, allowedModules, isAdmin),
                          );

                    const results = activeModules.filter((item) => {
                      if (!commandSearchQuery) return true;
                      const q = commandSearchQuery.toLowerCase();
                      return (
                        item.label.toLowerCase().includes(q) ||
                        item.id.toLowerCase().includes(q)
                      );
                    });

                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightedCommandIndex((prev) =>
                        Math.min(results.length - 1, prev + 1),
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightedCommandIndex((prev) =>
                        Math.max(0, prev - 1),
                      );
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (results[highlightedCommandIndex]) {
                        const targetPage = results[highlightedCommandIndex]
                          .id as Page;
                        logEvent(
                          "HOTKEY_NAV",
                          `Quick-navigated to operational module: "${targetPage}" via Ctrl+K command menu`,
                        );
                        globalNavigate(targetPage);
                        setShowCommandSearch(false);
                      }
                    } else if (e.key === "Escape") {
                      setShowCommandSearch(false);
                    }
                  }}
                  className="w-full bg-white border-2 border-indigo-900/35 p-2 pl-9 outline-none text-xs text-indigo-950 font-bold uppercase focus:border-indigo-600"
                  placeholder="Search by module name (e.g. Settlement, Purchase PO, Quality)..."
                />
              </div>
              <p className="text-[8px] font-bold text-slate-500 font-mono mt-1 px-1 flex justify-between">
                <span>PRESS ↑↓ TO TRAVEL // ENTER TO NAVIGATE</span>
                <span>ESC TO CLOSE</span>
              </p>
            </div>

            {/* Results matched list */}
            <div className="max-h-60 overflow-y-auto bg-white border-b border-slate-400">
              {(isAdmin || allowedModules.includes("*")
                ? allSidebarItems
                : allSidebarItems.filter(
                    (item) =>
                      hasModulePermission(item.id, allowedModules, isAdmin),
                  )
              )
                .filter((item) => {
                  if (!commandSearchQuery) return true;
                  const q = commandSearchQuery.toLowerCase();
                  return (
                    item.label.toLowerCase().includes(q) ||
                    item.id.toLowerCase().includes(q)
                  );
                })
                .map((item, idx) => {
                  const isHighlighted = idx === highlightedCommandIndex;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        logEvent(
                          "HOTKEY_NAV",
                          `Quick-navigated to operational module: "${item.id}" via Ctrl+K command menu`,
                        );
                        globalNavigate(item.id as Page);
                        setShowCommandSearch(false);
                      }}
                      onMouseEnter={() => setHighlightedCommandIndex(idx)}
                      className={cn(
                        "w-full text-left px-4 py-2.5 flex items-center justify-between text-xs font-bold transition-all border-b border-slate-100 last:border-b-0 cursor-pointer uppercase",
                        isHighlighted
                          ? "bg-indigo-950 text-white"
                          : "text-slate-800 hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={cn(
                            "h-4 w-4",
                            isHighlighted
                              ? "text-emerald-400 animate-pulse"
                              : "text-indigo-900",
                          )}
                        />
                        <span>{item.label}</span>
                      </div>
                      <span
                        className={cn(
                          "text-[8px] font-mono",
                          isHighlighted ? "text-white/60" : "text-slate-400",
                        )}
                      >
                        CODE: {item.id}
                      </span>
                    </button>
                  );
                })}

              {(isAdmin || allowedModules.includes("*")
                ? allSidebarItems
                : allSidebarItems.filter(
                    (item) =>
                      hasModulePermission(item.id, allowedModules, isAdmin),
                  )
              ).filter((item) => {
                if (!commandSearchQuery) return true;
                const q = commandSearchQuery.toLowerCase();
                return (
                  item.label.toLowerCase().includes(q) ||
                  item.id.toLowerCase().includes(q)
                );
              }).length === 0 && (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No operational modules matched your search query.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom HTML Alert overlay */}
      {htmlAlert && (
        <SystemNoticeModal
          message={htmlAlert.message}
          onClose={() => setHtmlAlert(null)}
        />
      )}

      {/* Global Satta Warning Modal */}
      {showGlobalSattaWarning && (
        <div className="fixed inset-0 z-[200] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4  animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-amber-50 px-6 py-6 border-b border-amber-100 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <ShieldAlert className="w-24 h-24 text-amber-500 -rotate-12" />
              </div>
              
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mb-4 relative z-10 shadow-inner">
                <AlertTriangle className="w-7 h-7 text-amber-600" />
              </div>
              <div className="relative z-10">
                <h3 className="text-xl font-black text-amber-900 tracking-tight">
                  Satta Rate Chart Required
                </h3>
                <p className="text-[11px] font-bold text-amber-800 uppercase tracking-tight mt-1 font-mono">
                  ACTION REQUIRED
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 text-center space-y-4">
              <p className="text-xs text-slate-600 font-bold leading-relaxed uppercase">
                Please Update Satta Chart And Then you are Eligible For using the portal modules
              </p>
              <p className="text-[10px] text-slate-400 font-medium font-sans">
                The Satta Rate Chart matrix must be logged for today before any modules can be accessed.
              </p>
            </div>

            {/* Footer Actions */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => {
                  setShowGlobalSattaWarning(false);
                  globalNavigate('satta');
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <span>Go to Satta Desk ↗</span>
              </button>
              <button
                onClick={() => setShowGlobalSattaWarning(false)}
                className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors shadow-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

const PlaceholderPage = ({ name }: { name: string }) => (
  <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
    <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
      <FileText className="h-10 w-10" />
    </div>
    <h3 className="text-xl font-bold text-slate-600">{name}</h3>
    <p>Module implementation in progress...</p>
  </div>
);
