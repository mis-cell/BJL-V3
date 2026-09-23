import React, { useState, useEffect, useMemo } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { findMatchedPoItem } from '../pages/PaymentModule';
import { 
  FileCheck, 
  Plus, 
  Search, 
  Trash2, 
  Save, 
  X, 
  Printer, 
  FileText, 
  TrendingUp,
  DollarSign,
  Layers,
  Scale,
  RefreshCcw,
  Download,
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  FileSpreadsheet,
  Grid,
  Wallet,
  BookOpen,
  ArrowLeft,
  Clock,
  Filter
} from 'lucide-react';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import { supabase } from '../lib/supabase';
import { dbModule } from '../services/dbModule';
import { cn, sanitizeCsvData, formatIndianCurrency, formatIndianNumber, calculateFloor1000, calculate93PctPaidAmount } from '../lib/utils';
import { PaginationControls } from '../components/PaginationControls';
import { enforceEditOrDeletePermission, canEditOrDelete, canViewCompletedData, isL5OrAdmin } from '../lib/permissions';
import { calculateSattaDeduction, setCachedSattaDiffs, getCachedSattaDiffs, normalizeGrade, getNextLowerGrade } from '../services/sattaCalculation';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Payment Master Interface
export interface PaymentMaster {
  payment_id?: string;
  voucher_no: string;
  payment_date: string;
  mr_no: string;
  po_no: string;
  po_date: string;
  sett_date: string;
  po_type: string;
  broker: string;
  supplier: string;
  party_id: string;
  party_name: string;
  chn_supplier: string;
  lorry_number: string;
  auto_ho_settlement: boolean;
  detention_days: number;
  arrival_no: string;
  arrival_date: string;
  arival_apmc_fees: number;
  remarks: string;

  // Grade-wise summary panel
  summary_rate_qtel: number;
  summary_rate_aff_cd_cl: number;
  summary_delivery_claim: number;
  summary_rate_wt_claim: number;
  summary_instl_rate: number;
  summary_material_value: number;
  summary_misc_add?: number;
  summary_misc_less?: number;
  summary_premium_amount: number;
  summary_less_amount: number;
  summary_instl_amount?: number;

  // Deductions
  summary_deduction_type: string;
  summary_deduction_rate: number;
  summary_deduction_qty: number;
  summary_deduction_amount: number;

  // Valuation
  val_material_value: number;
  val_add_amt: number;
  val_less_amt: number;
  val_premium_amt: number;
  val_less_amount: number;
  val_qty_claim: number;
  val_ex_short: number;

  // Final MR & Payment details
  final_less_adv: number;
  final_on_ac_adv: number;
  final_apmc_fees: number;
  final_cst_pct_amt: number;

  payable_amt: number;
  payable_bill_no: string;
  payable_bill_date: string;

  total_amount: number;
  paid_amount: number;
  payment_mode: string;
  bank_name: string;
  reference_no: string;

  // Bottom bar
  wt_ded_wt_1: number;
  wt_ded_wt_2: number;
  wt_ded_wt_3: number;
  rate_qntl: number;
  value_amt: number;
  adjustment_amt: number;
  net_amt: number;
  challan_weight: number;
  supplier_net_wt: number;
  electronic_scale_net: number;

  status: string;
  payment_status: string;
  advance_payment_done?: string;
  advance_payment_from?:string;
  payment_settlementdate?:string;
  tenor?:string;
  repayment_date?:string;
}

// 4-Column specifications entry for Payment
export interface PaymentDetailColumn {
  col_index: number;
  grade: string;
  area: string;
  agency: string;
  marka_crop: string;
  quantity: number;
  arr_qty_wt: number;
  min_qty_wt: number;
  wt_phota: number;

  wt_quantity: number;
  rate_value: number;

  // Grade Down Settlement & Rate Adjustments
  sett_pct: number; // Sett (%) - Populated from Inspection Details Grade Down % Claim (or Mill Sett -> Gr. Down %)
  deduction_rate: number; // Deduction (₹/Qtl) = Settlement Basis (Original Rate) * Sett (%) / 100
  sett_rate: number; // Sett Rate (₹/Qtl) = Original Rate - Deduction (₹/Qtl)
  quantity_qtl: number; // Quantity (Qtl) = Weight (MT) * 10
  amount: number; // Amount (₹) = Quantity (Qtl) * Sett Rate (₹/Qtl)

  // Claims
  gd_claim: number;
  gd_sett: number;
  gd_rev: number;
  gd_final: number;

  moist_claim: number;
  moist_sett: number;
  moist_rev: number;
  moist_final: number;

  dust_claim: number;
  dust_sett: number;
  dust_rev: number;
  dust_final: number;

  ncv_claim: number;
  ncv_sett: number;
  ncv_rev: number;
  ncv_final: number;

  po_grade_claim: number;
  po_grade_sett: number;
  po_grade_rev: number;
  po_grade_final: number;

  adjust_type: string;
  remark: string;
  claim_settlement: number;
}

const emptyDetailColumn = (index: number): PaymentDetailColumn => ({
  col_index: index,
  grade: '',
  area: '',
  agency: '',
  marka_crop: '',
  quantity: 0,
  arr_qty_wt: 0,
  min_qty_wt: 0,
  wt_phota: 0,
  wt_quantity: 0,
  rate_value: 0,
  sett_pct: 0,
  deduction_rate: 0,
  sett_rate: 0,
  quantity_qtl: 0,
  amount: 0,
  gd_claim: 0, gd_sett: 0, gd_rev: 0, gd_final: 0,
  moist_claim: 0, moist_sett: 0, moist_rev: 0, moist_final: 0,
  dust_claim: 0, dust_sett: 0, dust_rev: 0, dust_final: 0,
  ncv_claim: 0, ncv_sett: 0, ncv_rev: 0, ncv_final: 0,
  po_grade_claim: 0, po_grade_sett: 0, po_grade_rev: 0, po_grade_final: 0,
  adjust_type: 'No Adjustment',
  remark: '',
  claim_settlement: 0
});

export const getColWtMt = (col?: PaymentDetailColumn): number => {
  if (!col) return 0;
  const arrWt = Number(col.arr_qty_wt) || 0;
  if (arrWt > 0) return arrWt;
  const wtQty = Number(col.wt_quantity) || 0;
  if (wtQty > 0) return wtQty;
  const qty = Number(col.quantity) || 0;
  const phota = Number(col.wt_phota) || 0;
  if (qty > 0 && phota > 0) return qty * phota;
  return 0;
};

// Quantity (Qtl) = Weight (MT) * 10
export const getColQtyQtl = (col?: PaymentDetailColumn): number => {
  const wtMt = getColWtMt(col);
  return Number((wtMt * 10).toFixed(3));
};

// Sett (%) - Populated from Inspection Details Grade Down % Claim (gd_claim), Mill Sett -> Gr. Down percentage (gd_sett), or user edited sett_pct
export const getColSettPct = (col?: PaymentDetailColumn): number => {
  if (!col) return 0;
  if (col.sett_pct !== undefined && col.sett_pct !== null && !isNaN(Number(col.sett_pct)) && Number(col.sett_pct) > 0) {
    return Number(col.sett_pct);
  }
  if (col.gd_claim !== undefined && col.gd_claim !== null && !isNaN(Number(col.gd_claim)) && Number(col.gd_claim) > 0) {
    return Number(col.gd_claim);
  }
  if (col.gd_sett !== undefined && col.gd_sett !== null && !isNaN(Number(col.gd_sett)) && Number(col.gd_sett) > 0) {
    return Number(col.gd_sett);
  }
  if (col.sett_pct !== undefined && col.sett_pct !== null && !isNaN(Number(col.sett_pct))) {
    return Number(col.sett_pct);
  }
  return 0;
};

// Deduction (₹/Qtl) - Calculated from Satta Chart grade differentials:
// Formula: Deduction (₹/Qtl) = |SattaDiff(Contracted Grade) - SattaDiff(Next Lower Grade)| * (Sett % / 100)
export const getColDeduction = (col?: PaymentDetailColumn, dbDiffs?: any[]): number => {
  if (!col) return 0;
  const settPct = getColSettPct(col);
  if (settPct <= 0) return 0;
  const res = calculateSattaDeduction(col, dbDiffs);
  return res.deduction;
};

// Formatted explanation for Satta-based deduction tooltips
export const getColDeductionExplanation = (col?: PaymentDetailColumn, dbDiffs?: any[]): string => {
  if (!col) return "";
  const res = calculateSattaDeduction(col, dbDiffs);
  return res.explanation;
};

// Sett Rate (₹/Qtl) = Original Rate (₹/Qtl) − Deduction (₹/Qtl)
export const getColSettRate = (col?: PaymentDetailColumn, dbDiffs?: any[]): number => {
  if (!col) return 0;
  const origRate = Number(col.rate_value) || 0;
  const deduction = getColDeduction(col, dbDiffs);
  return Math.max(0, Number((origRate - deduction).toFixed(2)));
};

// Amount (₹) = Quantity (Qtl) * Sett Rate (₹/Qtl)
export const getColAmount = (col?: PaymentDetailColumn, dbDiffs?: any[]): number => {
  if (!col) return 0;
  const qtyQtl = getColQtyQtl(col);
  const settRate = getColSettRate(col, dbDiffs);
  if (qtyQtl <= 0 || settRate <= 0) return 0;
  return Number((qtyQtl * settRate).toFixed(2));
};

// Robust helper to parse grid_details / items from string or array or object
export const parseGridOrItems = (raw: any): any[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    if (raw === 'undefined' || raw === 'null' || !raw.trim()) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return [parsed];
    } catch (e) {
      return [];
    }
  }
  if (typeof raw === 'object') return [raw];
  return [];
};

// Maps raw items or grid details into 4-column breakdown matrix with master lookup resolution
export const mapItemsToDetailCols = (
  rawItems: any,
  defaultRate: number = 0,
  poHeader?: any,
  masters?: {
    gradeMasters?: any[];
    agencyMasters?: any[];
    areaMasters?: any[];
    markaMasters?: any[];
  }
): PaymentDetailColumn[] => {
  const newCols = [emptyDetailColumn(1), emptyDetailColumn(2), emptyDetailColumn(3), emptyDetailColumn(4)];
  const parsedItems = parseGridOrItems(rawItems);

  const gradeList = masters?.gradeMasters || [];
  const agencyList = masters?.agencyMasters || [];
  const areaList = masters?.areaMasters || [];
  const markaList = masters?.markaMasters || [];

  const resolveGrade = (item: any) => {
    const rawCode = item.stock_grade_name || item.grade_name || item.grade || item.arrival_grade || item.quality || item.grade_code || item.stock_grade_code || item.receipt_grade_code || poHeader?.grade_code || poHeader?.grade;
    if (rawCode !== undefined && rawCode !== null && String(rawCode).trim() !== '') {
      const codeStr = String(rawCode).trim();
      const codeUpper = codeStr.toUpperCase();

      const match = gradeList.find(g => {
        if (!g) return false;
        const gCode = String(g.grade_code || g.code || g.id || '').trim().toUpperCase();
        const gName = String(g.grade_name || g.name || '').trim().toUpperCase();
        return gCode === codeUpper || gName === codeUpper || String(g.id || '') === codeStr;
      });

      if (match) return match.grade_name || match.name || codeStr;
      return codeStr;
    }
    return '';
  };

  const resolveAgency = (item: any) => {
    const rawCode = item.agency_name || item.agency || item.agency_code || poHeader?.agency_name || poHeader?.agency || poHeader?.agency_code || poHeader?.purchase_unit_name;
    if (rawCode !== undefined && rawCode !== null && String(rawCode).trim() !== '') {
      const codeStr = String(rawCode).trim();
      const codeUpper = codeStr.toUpperCase();

      const match = agencyList.find(a => {
        if (!a) return false;
        const aCode = String(a.agency_code || a.code || a.id || '').trim().toUpperCase();
        const aName = String(a.agency_name || a.name || '').trim().toUpperCase();
        return aCode === codeUpper || aName === codeUpper || String(a.id || '') === codeStr;
      });

      if (match) return match.agency_name || match.name || codeStr;
      return codeStr;
    }
    return poHeader?.agency_name || poHeader?.purchase_unit_name || '';
  };

  const resolveArea = (item: any) => {
    const rawCode = item.area_name || item.area || item.area_code || poHeader?.area_code || poHeader?.area || poHeader?.area_name;
    if (rawCode !== undefined && rawCode !== null && String(rawCode).trim() !== '') {
      const codeStr = String(rawCode).trim();
      const codeUpper = codeStr.toUpperCase();

      const match = areaList.find(a => {
        if (!a) return false;
        const aCode = String(a.area_code || a.code || a.id || '').trim().toUpperCase();
        const aName = String(a.area_name || a.name || '').trim().toUpperCase();
        return aCode === codeUpper || aName === codeUpper || String(a.id || '') === codeStr;
      });

      if (match) return match.area_name || match.name || codeStr;
      return codeStr;
    }
    return poHeader?.area_name || poHeader?.area || '';
  };

  const resolveMarka = (item: any) => {
    const rawCode = item.marka_code || item.marka_name || item.marka_crop || item.challan_marka_code || item.marka || poHeader?.marka_code || poHeader?.marka;
    if (rawCode !== undefined && rawCode !== null && String(rawCode).trim() !== '') {
      const codeStr = String(rawCode).trim();
      const codeUpper = codeStr.toUpperCase();

      const match = markaList.find(m => {
        if (!m) return false;
        const mCode = String(m.marka_code || m.code || m.id || '').trim().toUpperCase();
        const mName = String(m.marka_name || m.name || '').trim().toUpperCase();
        return mCode === codeUpper || mName === codeUpper || String(m.id || '') === codeStr;
      });

      if (match) return match.marka_name || match.name || codeStr;
      return codeStr;
    }
    return item.crop_year || poHeader?.crop_year || '';
  };

  if (parsedItems.length === 0 && poHeader) {
    const grade = resolveGrade(poHeader);
    const agency = resolveAgency(poHeader);
    const area = resolveArea(poHeader);
    const marka = resolveMarka(poHeader);
    const qty = Number(poHeader.total_units || poHeader.units_per_lorry || poHeader.quantity || 0);
    const wt = Number(poHeader.total_contract_mt || poHeader.weight_mt || poHeader.weight_per_lorry || 0);
    const rate = Number(poHeader.b_rate || poHeader.rate_qntl || defaultRate || 0);

    if (grade || area || agency || qty > 0 || wt > 0) {
      const settPct = Number(poHeader.sett_pct ?? 0);
      const origRate = rate;
      const deductionRate = Number(((origRate * settPct) / 100).toFixed(2));
      const settRate = Math.max(0, Number((origRate - deductionRate).toFixed(2)));
      const qtyQtl = Number((wt * 10).toFixed(3));
      const amount = Number((qtyQtl * settRate).toFixed(2));

      newCols[0] = {
        ...emptyDetailColumn(1),
        grade,
        area,
        agency,
        marka_crop: marka,
        quantity: qty,
        arr_qty_wt: wt,
        rate_value: rate,
        sett_pct: settPct,
        deduction_rate: deductionRate,
        sett_rate: settRate,
        quantity_qtl: qtyQtl,
        amount: amount
      };
      return newCols;
    }
  }

  parsedItems.forEach((item: any, idx: number) => {
    if (idx < 4) {
      const grade = resolveGrade(item);
      const agency = resolveAgency(item);
      const area = resolveArea(item);
      const marka = resolveMarka(item);
      const qty = Number(
        item.quantity !== undefined && item.quantity !== null && item.quantity !== ""
          ? item.quantity
          : (item.quantity_rcpt !== undefined && item.quantity_rcpt !== null && item.quantity_rcpt !== ''
              ? item.quantity_rcpt
              : (item.rcpt !== undefined && item.rcpt !== null && item.rcpt !== ''
                  ? item.rcpt
                  : (item.quantity_chln || item.qty || item.packets || item.units || item.total_units || 0)))
      );
      const wt = Number(
        item.final_receipt_wt !== undefined && item.final_receipt_wt !== null && item.final_receipt_wt !== ''
          ? item.final_receipt_wt
          : (item.netto_pnto !== undefined && item.netto_pnto !== null && item.netto_pnto !== ''
              ? item.netto_pnto
              : (item.netto !== undefined && item.netto !== null && item.netto !== ''
                  ? item.netto
                  : (item.netto_mt !== undefined && item.netto_mt !== null && item.netto_mt !== ''
                      ? item.netto_mt
                      : (item.arr_qty_wt || item.weight_mt || item.weight || item.receipt_gross_wt || item.challan_gross_wt || item.total_wt_in_ton || (item.weight_qtl ? Number(item.weight_qtl) / 10 : 0)))))
      );
      const rate = Number(item.rate_per_mt || item.rate_mt || item.rate_qntl || item.rate || item.rate_value || poHeader?.b_rate || defaultRate || 0);

      const gdClaim = Number(item.gd_claim ?? item.grade_down_claim ?? item.claim_grade_down ?? item.claim_gr_down ?? item.grade_down_act ?? item.actual_grade_down ?? 0);
      const gdSett = Number(item.gd_sett ?? item.settlement_grade_down ?? item.grade_down_sett ?? item.mill_sett_gr_down ?? 0);
      
      // Sett (%) Priority:
      // 1. Explicit user edited or non-zero saved sett_pct
      // 2. Inspection Details "Grade Down %" -> "Claim" (gdClaim)
      // 3. Inspection Details "Mill Settlement %" -> "Gr. Down" (gdSett)
      let settPct = 0;
      if (item.sett_pct !== undefined && item.sett_pct !== null && item.sett_pct !== "" && !isNaN(Number(item.sett_pct)) && Number(item.sett_pct) > 0) {
        settPct = Number(item.sett_pct);
      } else if (gdClaim > 0) {
        settPct = gdClaim;
      } else if (gdSett > 0) {
        settPct = gdSett;
      } else if (item.sett_pct !== undefined && item.sett_pct !== null && item.sett_pct !== "" && !isNaN(Number(item.sett_pct))) {
        settPct = Number(item.sett_pct);
      }

      const origRate = rate;
      const colCandidate: PaymentDetailColumn = {
        ...emptyDetailColumn(idx + 1),
        grade,
        area,
        agency,
        marka_crop: marka,
        rate_value: origRate,
        sett_pct: settPct,
        gd_claim: gdClaim,
        gd_sett: gdSett,
        arr_qty_wt: wt,
        quantity: qty
      };
      const calculatedDed = getColDeduction(colCandidate);
      const deductionRate = (settPct > 0 || calculatedDed > 0)
        ? calculatedDed
        : Number(item.deduction_rate !== undefined && item.deduction_rate !== null && item.deduction_rate !== "" ? item.deduction_rate : 0);
      const settRate = Math.max(0, Number((origRate - deductionRate).toFixed(2)));
      const qtyQtl = Number((wt * 10).toFixed(3));
      const amount = Number((qtyQtl * settRate).toFixed(2));

      newCols[idx] = {
        ...emptyDetailColumn(idx + 1),
        grade,
        area,
        agency,
        marka_crop: marka,
        quantity: qty,
        arr_qty_wt: wt,
        rate_value: rate,
        sett_pct: settPct,
        deduction_rate: deductionRate,
        sett_rate: settRate,
        quantity_qtl: qtyQtl,
        amount: amount,
        gd_claim: gdClaim,
        gd_sett: gdSett,
        moist_claim: Number(item.moist_claim ?? item.moisture_claim ?? item.claim_moisture ?? item.moisture_act ?? 0),
        moist_sett: Number(item.moist_sett ?? item.settlement_moisture ?? item.moisture_sett ?? 0),
        dust_claim: Number(item.dust_claim ?? item.dust_claim ?? item.claim_dust ?? item.dust_act ?? 0),
        dust_sett: Number(item.dust_sett ?? item.settlement_dust ?? item.dust_sett ?? 0),
        ncv_claim: Number(item.ncv_claim ?? item.ncv_claim ?? item.claim_ncv ?? item.ncv_act ?? 0),
        ncv_sett: Number(item.ncv_sett ?? item.settlement_ncv ?? item.ncv_sett ?? 0),
        po_grade_claim: Number(item.po_grade_claim ?? item.delivery_claim ?? 0),
        po_grade_sett: Number(item.po_grade_sett ?? 0),
      };
    }
  });

  return newCols;
};

const initialMaster = (): PaymentMaster => ({
  voucher_no: `PAY-${Date.now().toString().slice(-6)}`,
  payment_date: new Date().toISOString().split('T')[0],
  mr_no: '',
  po_no: '',
  po_date: '',
  sett_date: new Date().toISOString().split('T')[0],
  po_type: '',
  broker: '',
  supplier: '',
  party_id: '',
  party_name: '',
  chn_supplier: '',
  lorry_number: '',
  auto_ho_settlement: false,
  detention_days: 0,
  arrival_no: '',
  arrival_date: '',
  arival_apmc_fees: 0,
  remarks: '',
  summary_rate_qtel: 0,
  summary_rate_aff_cd_cl: 0,
  summary_delivery_claim: 0,
  summary_rate_wt_claim: 0,
  summary_instl_rate: 0,
  summary_material_value: 0,
  summary_misc_add: 0,
  summary_misc_less: 0,
  summary_premium_amount: 0,
  summary_less_amount: 0,
  summary_instl_amount: 0,
  summary_deduction_type: '',
  summary_deduction_rate: 0,
  summary_deduction_qty: 0,
  summary_deduction_amount: 0,
  val_material_value: 0,
  val_add_amt: 0,
  val_less_amt: 0,
  val_premium_amt: 0,
  val_less_amount: 0,
  val_qty_claim: 0,
  val_ex_short: 0,
  final_less_adv: 0,
  final_on_ac_adv: 0,
  final_apmc_fees: 0,
  final_cst_pct_amt: 0,
  payable_amt: 0,
  payable_bill_no: '',
  payable_bill_date: '',
  total_amount: 0,
  paid_amount: 0,
  payment_mode: 'Bank Transfer (NEFT/RTGS)',
  bank_name: '',
  reference_no: '',
  wt_ded_wt_1: 0,
  wt_ded_wt_2: 0,
  wt_ded_wt_3: 0,
  rate_qntl: 0,
  value_amt: 0,
  adjustment_amt: 0,
  net_amt: 0,
  challan_weight: 0,
  supplier_net_wt: 0,
  electronic_scale_net: 0,
  status: 'completed',
  payment_status: 'Paid',
  advance_payment_done: 'No',
  advance_payment_from:'1',
  payment_settlementdate:'',
  tenor:'',
  repayment_date:''
});

/* Helper to retrieve all verified arrivals / M.Rs linked to a specific P.O */
export function getLinkedMrsForPo(poOrPoNo: any, arrivalsList: any[] = []): any[] {
  if (!poOrPoNo || !arrivalsList || arrivalsList.length === 0) return [];

  const targetPoNo = typeof poOrPoNo === 'string'
    ? poOrPoNo
    : (poOrPoNo.po_no || poOrPoNo.ptf_no || poOrPoNo.sauda_no || poOrPoNo.contract_po_no || '');

  const cleanTarget = String(targetPoNo).trim().toUpperCase();
  if (!cleanTarget || cleanTarget === 'N/A') return [];

  const targetSuffix = cleanTarget.split('/').pop() || '';

  return arrivalsList.filter(arr => {
    const arrPo1 = String(arr.po_no || '').trim().toUpperCase();
    const arrPo2 = String(arr.mill_po_no || '').trim().toUpperCase();
    const arrPo3 = String(arr.contract_po_no || arr.sauda_no || arr.po_contract || '').trim().toUpperCase();
    
    const candidates = [arrPo1, arrPo2, arrPo3].filter(Boolean);
    for (const cand of candidates) {
      if (cand === cleanTarget) return true;
      if (cand.includes(cleanTarget) || cleanTarget.includes(cand)) return true;
      const candSuffix = cand.split('/').pop() || '';
      if (targetSuffix.length >= 3 && (candSuffix === targetSuffix || cand.includes(targetSuffix))) {
        return true;
      }
    }
    return false;
  });
}

/* Helper to verify if an M.R has already been processed in payment_master */
export function isMrAlreadyProcessed(
  mrNoOrArrival: string | any,
  paymentList: any[],
  currentVoucherNo?: string,
  poNo?: string
): { isPaid: boolean; paidPayment?: any } {
  if (!mrNoOrArrival || !paymentList || paymentList.length === 0) {
    return { isPaid: false };
  }

  const mrStr = typeof mrNoOrArrival === 'string'
    ? mrNoOrArrival
    : (mrNoOrArrival.mr_no || mrNoOrArrival.final_arrival_no || mrNoOrArrival.arrival_no || '');
  
  const cleanMr = String(mrStr).trim().toUpperCase();
  if (!cleanMr || cleanMr === 'N/A') {
    return { isPaid: false };
  }

  const cleanPo = poNo
    ? String(poNo).trim().toUpperCase()
    : (typeof mrNoOrArrival === 'object' ? String(mrNoOrArrival.po_no || mrNoOrArrival.mill_po_no || '').trim().toUpperCase() : '');

  const matchedPayment = paymentList.find(p => {
    if (currentVoucherNo && String(p.voucher_no || '').trim().toUpperCase() === String(currentVoucherNo).trim().toUpperCase()) {
      return false;
    }

    const pStatus = String(p.status || '').toLowerCase().trim();
    if (pStatus === 'cancelled' || pStatus === 'rejected') {
      return false;
    }

    const pMr = String(p.mr_no || p.arrival_no || '').trim().toUpperCase();
    if (!pMr) return false;

    const isMrMatch = pMr === cleanMr;

    if (isMrMatch) {
      if (cleanPo) {
        const pPo = String(p.po_no || '').trim().toUpperCase();
        if (pPo) {
          const pPoSuffix = pPo.split('/').pop() || '';
          const cleanPoSuffix = cleanPo.split('/').pop() || '';
          if (pPo === cleanPo || pPo.includes(cleanPo) || cleanPo.includes(pPo) || (cleanPoSuffix.length >= 3 && pPoSuffix === cleanPoSuffix)) {
            return true;
          }
        }
      }
      return true;
    }

    return false;
  });

  return {
    isPaid: Boolean(matchedPayment),
    paidPayment: matchedPayment
  };
}

/* Helper to evaluate if a P.O is eligible for payment based on both P.O status AND remaining unpaid M.R records */
export function isPoEligibleForPayment(
  po: any,
  arrivalsList: any[] = [],
  paymentsList: any[] = [],
  currentVoucherNo?: string
): boolean {
  if (!po) return false;

  const statusStr = String(po.status || '').toLowerCase().trim();
  const passMismatchStr = String(po.pass_mismatch || po.pass_status || po.mismatch_status || po.quality_status || '').toUpperCase().trim();
  
  const isCompleted = (statusStr === 'completed' || statusStr === 'closed' || statusStr === 'final' || statusStr === 'moved_to_final' || statusStr === 'settled' || (po.ptf_no && String(po.ptf_no).trim() && String(po.ptf_no).trim() !== 'N/A'));
  
  let isPass = false;
  if (passMismatchStr === 'PASS') isPass = true;
  else if (po.mismatch_cleared === true || String(po.mismatch_cleared) === 'true') isPass = true;
  else if (po.satta_dispute_approved === true || String(po.satta_dispute_approved) === 'true') isPass = true;
  else if (statusStr === 'final' || statusStr === 'moved_to_final' || statusStr === 'completed' || statusStr === 'settled') isPass = true;
  else if (po.ptf_no && String(po.ptf_no).trim() && String(po.ptf_no).trim() !== 'N/A') isPass = true;
  else if (statusStr !== 'mismatch' && statusStr !== 'dispute' && po.mismatch_cleared !== false) isPass = true;

  if (!isCompleted || !isPass) {
    return false;
  }

  const poNo = String(po.po_no || po.ptf_no || po.sauda_no || po.contract_po_no || '').trim().toUpperCase();

  // Step 1: Find all verified M.R records linked with this P.O
  const linkedMrs = getLinkedMrsForPo(po, arrivalsList);

  if (linkedMrs.length > 0) {
    // Step 2 & 3: Check each M.R against payment_master and exclude paid ones
    const unpaidMrs = linkedMrs.filter(mr => {
      const check = isMrAlreadyProcessed(mr, paymentsList, currentVoucherNo, poNo);
      return !check.isPaid;
    });

    // Step 4: If remaining eligible M.R. count > 0 -> Show P.O (Eligible: true)
    // If remaining eligible M.R. count = 0 -> Hide P.O (Eligible: false)
    return unpaidMrs.length > 0;
  }

  if (paymentsList && paymentsList.length > 0 && poNo) {
    const directPayment = paymentsList.find(p => {
      if (currentVoucherNo && String(p.voucher_no || '').trim().toUpperCase() === String(currentVoucherNo).trim().toUpperCase()) {
        return false;
      }
      const pStatus = String(p.status || '').toLowerCase().trim();
      if (pStatus === 'cancelled' || pStatus === 'rejected') return false;

      const pPo = String(p.po_no || '').trim().toUpperCase();
      if (pPo === poNo) return true;
      const pPoSuffix = pPo.split('/').pop() || '';
      const poSuffix = poNo.split('/').pop() || '';
      return (poSuffix.length >= 3 && pPoSuffix === poSuffix);
    });

    if (directPayment) {
      return false;
    }
  }

  return true;
}

/* Searchable P.O Dropdown Component */
interface SearchablePoSelectProps {
  selectedPoNo: string;
  onSelectPo: (poNo: string) => void;
  displayPos: any[];
  matchedFinalPo?: any;
  isPoEligibleForPayment: (po: any) => boolean;
  verifiedArrivals?: any[];
  paymentList?: any[];
  currentVoucherNo?: string;
}

function SearchablePoSelect({
  selectedPoNo,
  onSelectPo,
  displayPos,
  matchedFinalPo,
  isPoEligibleForPayment,
  verifiedArrivals = [],
  paymentList = [],
  currentVoucherNo
}: SearchablePoSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const baseList = displayPos.filter(po => isPoEligibleForPayment(po));

  const normalizedSearch = searchTerm.toLowerCase().trim();

  const filteredList = baseList.filter(po => {
    if (!normalizedSearch) return true;
    const poNo = String(po.po_no || po.ptf_no || po.sauda_no || '').toLowerCase();
    const supp = String(po.supplier || po.party_name || '').toLowerCase();
    const brok = String(po.broker || '').toLowerCase();
    const mt = String(po.total_contract_mt || po.total_amt || '').toLowerCase();
    return poNo.includes(normalizedSearch) || supp.includes(normalizedSearch) || brok.includes(normalizedSearch) || mt.includes(normalizedSearch);
  });

  const selectedPo = displayPos.find(p => (p.po_no || p.ptf_no || p.sauda_no) === selectedPoNo);

  const getLabel = () => {
    if (selectedPoNo && matchedFinalPo && selectedPoNo === matchedFinalPo.po_no) {
      return `✓ Matched P.O: ${matchedFinalPo.po_no} | ${matchedFinalPo.supplier || matchedFinalPo.party_name || 'Supplier'}`;
    }
    if (selectedPo) {
      const pNo = selectedPo.po_no || selectedPo.ptf_no || selectedPo.sauda_no;
      const supp = selectedPo.supplier || selectedPo.party_name || 'Supplier';
      const brok = selectedPo.broker || 'No Broker';
      const mt = selectedPo.total_contract_mt || selectedPo.total_amt || 0;
      return `${pNo} | ${supp} | ${brok} (${mt} MT)`;
    }
    if (selectedPoNo) {
      return `P.O: ${selectedPoNo}`;
    }
    return '-- Choose or Search P.O --';
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger Box */}
      <div
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          "w-full p-2 border rounded-lg bg-white font-semibold text-slate-900 shadow-sm flex items-center justify-between gap-2 cursor-pointer transition-all text-xs select-none",
          isOpen ? "border-purple-600 ring-2 ring-purple-400/30" : "border-purple-300 hover:border-purple-400",
          selectedPoNo ? "bg-purple-50/30" : ""
        )}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Search className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span className={cn("truncate font-medium", selectedPoNo ? "text-purple-900 font-bold" : "text-slate-500")}>
            {getLabel()}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selectedPoNo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectPo('');
                setSearchTerm('');
              }}
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronRight className={cn("w-4 h-4 text-purple-500 transition-transform duration-200", isOpen ? "rotate-90" : "rotate-0")} />
        </div>
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-purple-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2 border-b border-purple-100 bg-purple-50/60 flex items-center gap-2">
            <Search className="w-4 h-4 text-purple-600 shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Type P.O No, Supplier, Broker to search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs outline-none bg-transparent font-medium text-slate-900 placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Results List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
            {/* Clear option */}
            <div
              onClick={() => {
                onSelectPo('');
                setIsOpen(false);
                setSearchTerm('');
              }}
              className="p-2.5 hover:bg-slate-50 cursor-pointer text-slate-500 italic font-medium flex items-center justify-between"
            >
              <span>-- Clear Selection --</span>
            </div>

            {/* Matched PO highlight (only if eligible) */}
            {matchedFinalPo && isPoEligibleForPayment(matchedFinalPo) && (!normalizedSearch || matchedFinalPo.po_no.toLowerCase().includes(normalizedSearch) || (matchedFinalPo.supplier||'').toLowerCase().includes(normalizedSearch)) && (
              <div
                onClick={() => {
                  onSelectPo(matchedFinalPo.po_no);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={cn(
                  "p-2.5 cursor-pointer font-semibold flex items-center justify-between transition-colors bg-emerald-50 text-emerald-950 hover:bg-emerald-100 border-l-4 border-emerald-500",
                  selectedPoNo === matchedFinalPo.po_no ? "ring-1 ring-emerald-400" : ""
                )}
              >
                <div>
                  <div className="font-bold flex items-center gap-2 text-emerald-900">
                    <span>✓ Matched P.O: {matchedFinalPo.po_no}</span>
                    <span className="bg-emerald-200 text-emerald-900 text-[10px] px-1.5 py-0.2 rounded font-mono font-black">
                      MATCHED INSPECTION
                    </span>
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    {matchedFinalPo.supplier || matchedFinalPo.party_name} | {matchedFinalPo.broker || 'No Broker'} ({matchedFinalPo.total_contract_mt || matchedFinalPo.total_amt || 0} MT)
                  </div>
                </div>
                {selectedPoNo === matchedFinalPo.po_no && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
                )}
              </div>
            )}

            {/* Filtered List */}
            {filteredList.map((po, i) => {
              const poNo = po.po_no || po.ptf_no || po.sauda_no;
              if (matchedFinalPo && isPoEligibleForPayment(matchedFinalPo) && poNo === matchedFinalPo.po_no) return null;

              const isSelected = selectedPoNo === poNo;
              const linkedMrs = getLinkedMrsForPo(po, verifiedArrivals);
              const unpaidMrs = linkedMrs.filter(mr => !isMrAlreadyProcessed(mr, paymentList, currentVoucherNo, poNo).isPaid);

              return (
                <div
                  key={i}
                  onClick={() => {
                    onSelectPo(poNo);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={cn(
                    "p-2.5 cursor-pointer hover:bg-purple-50/80 transition-colors flex items-center justify-between gap-2",
                    isSelected ? "bg-purple-100/70 font-bold text-purple-950" : "text-slate-800"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-slate-900">{poNo}</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.2 rounded font-semibold border border-emerald-200">
                        {linkedMrs.length > 0 ? `${unpaidMrs.length} Unpaid M.R${unpaidMrs.length > 1 ? 's' : ''} (${linkedMrs.length} Total)` : 'Pending Payment'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 truncate mt-0.5">
                      Supplier: <strong className="text-slate-800">{po.supplier || po.party_name || 'N/A'}</strong> | Broker: {po.broker || 'N/A'} ({po.total_contract_mt || po.total_amt || 0} MT)
                    </div>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                  )}
                </div>
              );
            })}

            {filteredList.length === 0 && (!matchedFinalPo || !isPoEligibleForPayment(matchedFinalPo) || (normalizedSearch && !matchedFinalPo.po_no.toLowerCase().includes(normalizedSearch))) && (
              <div className="p-4 text-center text-slate-500 text-xs italic">
                {searchTerm ? `No eligible P.O matching "${searchTerm}"` : "No eligible P.O records pending payment."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* Searchable Inspection / M.R Dropdown Component */
interface SearchableMrSelectProps {
  selectedMrNo: string;
  onSelectMr: (mrNo: string) => void;
  verifiedArrivals: any[];
  allArrivals?: any[];
  selectedPoNo: string;
}

function SearchableMrSelect({
  selectedMrNo,
  onSelectMr,
  verifiedArrivals,
  allArrivals,
  selectedPoNo
}: SearchableMrSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const baseList = selectedPoNo
    ? getLinkedMrsForPo(selectedPoNo, verifiedArrivals)
    : verifiedArrivals;

  const normalizedSearch = searchTerm.toLowerCase().trim();

  const filteredList = baseList.filter(arr => {
    if (!normalizedSearch) return true;
    const mrNo = String(arr.mr_no || arr.final_arrival_no || arr.arrival_no || '').toLowerCase();
    const supp = String(arr.supplier || arr.supplier_name || '').toLowerCase();
    const poNo = String(arr.po_no || arr.mill_po_no || '').toLowerCase();
    const lorry = String(arr.lorry_number || '').toLowerCase();
    return mrNo.includes(normalizedSearch) || supp.includes(normalizedSearch) || poNo.includes(normalizedSearch) || lorry.includes(normalizedSearch);
  });

  const selectedArr = verifiedArrivals.find(a => (a.mr_no === selectedMrNo || a.final_arrival_no === selectedMrNo || a.arrival_no === selectedMrNo));

  const getLabel = () => {
    if (selectedArr) {
      const mr = selectedArr.mr_no || selectedArr.final_arrival_no || selectedArr.arrival_no;
      const supp = selectedArr.supplier || selectedArr.supplier_name || 'N/A';
      const po = selectedArr.po_no || selectedArr.mill_po_no || 'N/A';
      const lorry = selectedArr.lorry_number ? ` | Lorry: ${selectedArr.lorry_number}` : '';
      return `M.R: ${mr} | Supplier: ${supp} | P.O: ${po}${lorry}`;
    }
    if (selectedMrNo) {
      return `M.R: ${selectedMrNo}`;
    }
    return '-- Choose or Search Inspection --';
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          "w-full p-2 border rounded-lg bg-white font-semibold text-slate-900 shadow-sm flex items-center justify-between gap-2 cursor-pointer transition-all text-xs select-none",
          isOpen ? "border-emerald-600 ring-2 ring-emerald-400/30" : "border-emerald-300 hover:border-emerald-400",
          selectedMrNo ? "bg-emerald-50/30" : ""
        )}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Search className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className={cn("truncate font-medium", selectedMrNo ? "text-emerald-900 font-bold" : "text-slate-500")}>
            {getLabel()}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selectedMrNo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectMr('');
                setSearchTerm('');
              }}
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronRight className={cn("w-4 h-4 text-emerald-500 transition-transform duration-200", isOpen ? "rotate-90" : "rotate-0")} />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-emerald-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-emerald-100 bg-emerald-50/60 flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-600 shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Search M.R No, Supplier, P.O, Lorry..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full text-xs outline-none bg-transparent font-medium text-slate-900 placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
            <div
              onClick={() => {
                onSelectMr('');
                setIsOpen(false);
                setSearchTerm('');
              }}
              className="p-2.5 hover:bg-slate-50 cursor-pointer text-slate-500 italic font-medium flex items-center justify-between"
            >
              <span>-- Clear Selection --</span>
            </div>

            {filteredList.map((arr, i) => {
              const mr = arr.mr_no || arr.final_arrival_no || arr.arrival_no;
              const isSelected = selectedMrNo === mr;

              return (
                <div
                  key={i}
                  onClick={() => {
                    onSelectMr(mr);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={cn(
                    "p-2.5 cursor-pointer hover:bg-emerald-50/80 transition-colors flex items-center justify-between gap-2",
                    isSelected ? "bg-emerald-100/70 font-bold text-emerald-950" : "text-slate-800"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-slate-900">M.R: {mr}</span>
                      {arr.lorry_number && (
                        <span className="bg-slate-100 text-slate-700 text-[10px] px-1.5 py-0.2 rounded font-mono">
                          Lorry: {arr.lorry_number}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate mt-0.5">
                      Supplier: <strong className="text-slate-800">{arr.supplier || arr.supplier_name || 'N/A'}</strong> | P.O: {arr.po_no || arr.mill_po_no || 'N/A'}
                    </div>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                </div>
              );
            })}

            {filteredList.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-xs italic">
                No Inspection matching &quot;{searchTerm}&quot;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentReport({ onClose }: { onClose?: () => void }) {
  const [viewMode, setViewMode] = useState<'dashboard' | 'entry' | 'ledger'>('dashboard');
  const [selectedLedgerParty, setSelectedLedgerParty] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Payment Records list from payment_master
  const [paymentList, setPaymentList] = useState<PaymentMaster[]>([]);
  const [verifiedArrivals, setVerifiedArrivals] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [saudaCheckPoints, setSaudaCheckPoints] = useState<any[]>([]);
  const [showAllPos, setShowAllPos] = useState<boolean>(false);
  
  const [selectedPoNo, setSelectedPoNo] = useState<string>('');
  const [selectedPoData, setSelectedPoData] = useState<any>(null);
  const [selectedMrNo, setSelectedMrNo] = useState<string>('');

  const [showSuccessAnim, setShowSuccessAnim] = useState<boolean>(false);
  const [isEdit, setIsEdit] = useState(false);

  const [masterData, setMasterData] = useState<PaymentMaster>(initialMaster());
  const [detailCols, setDetailCols] = useState<PaymentDetailColumn[]>([
    emptyDetailColumn(1), emptyDetailColumn(2), emptyDetailColumn(3), emptyDetailColumn(4)
  ]);

  const [gradeMasterList, setGradeMasterList] = useState<any[]>([]);
  const [agencyMasterList, setAgencyMasterList] = useState<any[]>([]);
  const [markaMasterList, setMarkaMasterList] = useState<any[]>([]);
  const [areaMasterList, setAreaMasterList] = useState<any[]>([]);

  // Advance Recovery Calculation Engine
  const isPoCompletedStatus = (po: any): boolean => {
    if (!po) return false;
    const statusStr = String(po.status || '').toLowerCase().trim();
    const pendingStr = String(po.pending || '').toLowerCase().trim();
    
    if (po.pending === false || pendingStr === 'no' || pendingStr === 'false' || po.pending === 0) return true;
    if (statusStr === 'completed' || statusStr === 'settled' || statusStr === 'final' || statusStr === 'moved_to_final') return true;

    const contract = parseFloat(po.total_contract_mt || po.total_amt || 0) || 0;
    const rcvd = Number(po.received_weight_mt || po.delivered_mt || 0);
    if (contract > 0 && rcvd > 0) {
      const diff = Math.abs(contract - rcvd);
      if (rcvd >= contract || diff <= 0.5) return true;
    }
    return false;
  };

  const isPoPassStatus = (po: any): boolean => {
    if (!po) return false;
    const statusStr = String(po.status || '').toLowerCase().trim();
    const passMismatchStr = String(po.pass_mismatch || po.pass_status || po.mismatch_status || po.quality_status || '').toUpperCase().trim();
    
    if (passMismatchStr === 'PASS') return true;
    if (po.mismatch_cleared === true || String(po.mismatch_cleared) === 'true') return true;
    if (po.satta_dispute_approved === true || String(po.satta_dispute_approved) === 'true') return true;
    if (statusStr === 'final' || statusStr === 'moved_to_final' || statusStr === 'completed' || statusStr === 'settled') return true;
    if (po.ptf_no && String(po.ptf_no).trim() && String(po.ptf_no).trim() !== 'N/A') return true;
    if (statusStr !== 'mismatch' && statusStr !== 'dispute' && po.mismatch_cleared !== false) return true;

    return false;
  };

  const isPoEligibleForPaymentLocal = (po: any): boolean => {
    return isPoEligibleForPayment(
      po,
      verifiedArrivals,
      paymentList,
      isEdit ? masterData.voucher_no : undefined
    );
  };

  const findMatchingPo = (targetPoNo: string, poArray: any[]) => {
    if (!targetPoNo || !poArray || poArray.length === 0) return null;
    const cleanTarget = String(targetPoNo).trim().toUpperCase();
    const targetSuffix = cleanTarget.split('/').pop() || '';

    return poArray.find((p: any) => {
      const pNo = String(p.po_no || p.contract_po_no || '').trim().toUpperCase();
      const pSuffix = pNo.split('/').pop() || '';
      const sNo = String(p.sauda_no || p.po_contract || p.contract_no || '').trim().toUpperCase();
      const sSuffix = sNo.split('/').pop() || '';

      if (pNo === cleanTarget) return true;
      if (sNo && sNo === cleanTarget) return true;
      if (pNo && (pNo.includes(cleanTarget) || cleanTarget.includes(pNo))) return true;
      if (targetSuffix && targetSuffix.length >= 3) {
        if (pSuffix === targetSuffix || (pNo && pNo.includes(targetSuffix))) return true;
        if (sSuffix === targetSuffix || (sNo && sNo.includes(targetSuffix))) return true;
      }
      return false;
    });
  };

  // Filter verified arrivals to strictly exclude already processed/paid M.R. records
  const availableArrivals = useMemo(() => {
    return verifiedArrivals.filter(arr => {
      const { isPaid } = isMrAlreadyProcessed(
        arr,
        paymentList,
        isEdit ? masterData.voucher_no : undefined,
        selectedPoNo
      );
      return !isPaid;
    });
  }, [verifiedArrivals, paymentList, isEdit, masterData.voucher_no, selectedPoNo]);

  // Filter purchase orders where at least one eligible unpaid M.R remains
  const eligiblePos = useMemo(() => {
    return purchaseOrders.filter(po => isPoEligibleForPaymentLocal(po));
  }, [purchaseOrders, verifiedArrivals, paymentList, isEdit, masterData.voucher_no]);

  const ensurePaymentTablesExist = async () => {
    if (!supabase) return;
    try {
      await supabase.rpc('exec_sql', {
        query: `
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
            advance_payment_done TEXT DEFAULT 'No',
            advance_payment_from TEXT Default '1',
            payment_settlementdate DATE,
            tenor TEXT DEFAULT 0,
            repayment_date DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS payment_master DISABLE ROW LEVEL SECURITY;
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS advance_payment_done TEXT DEFAULT 'No';
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS advance_payment_from TEXT DEFAULT '1';
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS payment_settlementdate DATE DEFAULT '';
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS tenor TEXT DEFAULT '';
          ALTER TABLE IF EXISTS payment_master ADD COLUMN IF NOT EXISTS repayment_date DATE DEFAULT '';

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
          NOTIFY pgrst, 'reload schema';
        `
      });
    } catch (err) {
      console.warn("Auto-creation of payment tables notice:", err);
    }
  };

  // Load dashboards & verified entries from purchase_master and final_arrival
  const initPage = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      await ensurePaymentTablesExist();

      let gData: any[] = [];
      let agData: any[] = [];
      let mDataList: any[] = [];
      let aData: any[] = [];
      let payData: any[] = [];
      let poList: any[] = [];
      let scpList: any[] = [];
      let arrList: any[] = [];

      if (supabase) {
        // Master lookups
        const [gRes, agRes, mRes, aRes, sattaRes] = await Promise.all([
          supabase.from('grade_master').select('*').then(r => r.data || [], () => []),
          supabase.from('agency_master').select('*').then(r => r.data || [], () => []),
          supabase.from('marka_master').select('*').then(r => r.data || [], () => []),
          supabase.from('area_master').select('*').then(r => r.data || [], () => []),
          supabase.from('satta_differentials').select('*').then(r => r.data || [], () => [])
        ]);
        gData = gRes;
        agData = agRes;
        mDataList = mRes;
        aData = aRes;
        if (sattaRes && sattaRes.length > 0) {
          setCachedSattaDiffs(sattaRes);
        }

        // 1. Fetch Payment Master records from Supabase
        try {
          const { data: pData, error: pErr } = await supabase
            .from('payment_master')
            .select('*')
            .order('created_at', { ascending: false });
          if (!pErr && pData) {
            payData = pData;
          } else {
            const { data: pDataPlain } = await supabase.from('payment_master').select('*');
            if (pDataPlain) payData = pDataPlain;
          }
        } catch (err) {
          console.warn("Supabase payment_master fetch error:", err);
        }

        // 2. Fetch Final Purchase Orders (purchase_master)
        try {
          const { data: pList, error: pErr } = await supabase
            .from('purchase_master')
            .select('*')
            .order('created_at', { ascending: false });
          if (!pErr && pList) {
            poList = pList;
          } else {
            const { data: pListPlain } = await supabase.from('purchase_master').select('*');
            if (pListPlain) poList = pListPlain;
          }
        } catch (err) {
          console.warn("Supabase purchase_master fetch error:", err);
        }

        // 2b. Fetch Sauda Check Point (Temporary / Pending POs)
        try {
          const { data: sList } = await supabase.from('sauda_check_point').select('*');
          if (sList) scpList = sList;
        } catch (err) {
          console.warn("Supabase sauda_check_point fetch error:", err);
        }

        // 3. Fetch Final Arrivals (final_arrival) & Material Inspection (material_inspection)
        try {
          const [aRes, miRes] = await Promise.all([
            supabase.from('final_arrival').select('*').order('created_at', { ascending: false }).then(r => r.data || [], () => []),
            supabase.from('material_inspection').select('*').order('created_at', { ascending: false }).then(r => r.data || [], () => []),
          ]);

          const combinedMap = new Map<string, any>();

          (aRes || []).forEach((item: any) => {
            const key = item.mr_no || item.final_arrival_no || item.arrival_no;
            if (key) combinedMap.set(key, { ...item, source_module: 'final_arrival' });
          });

          (miRes || []).forEach((item: any) => {
            const key = item.mr_no || item.arrival_no || item.final_arrival_no;
            if (key) {
              const existing = combinedMap.get(key) || {};
              combinedMap.set(key, {
                ...existing,
                ...item,
                mr_no: key,
                supplier: item.supplier_name || item.supplier || existing.supplier,
                broker: item.broker_name || item.broker || existing.broker,
                po_no: item.po_no || item.mill_po_no || existing.po_no,
                source_module: 'material_inspection'
              });
            }
          });

          arrList = Array.from(combinedMap.values());
        } catch (err) {
          console.warn("Supabase final_arrival/inspection fetch error:", err);
        }
      }

      // Merge with dbModule local database fallback
      try {
        const localPay = await dbModule.fetchAll('payment_master').catch(() => []);
        if (localPay && localPay.length > 0) {
          const map = new Map<string, any>();
          payData.forEach((p: any) => { if (p.voucher_no) map.set(p.voucher_no, p); });
          localPay.forEach((p: any) => { if (p.voucher_no && !map.has(p.voucher_no)) map.set(p.voucher_no, p); });
          payData = Array.from(map.values());
        }

        if (poList.length === 0) {
          poList = await dbModule.fetchAll('purchase_master').catch(() => []);
        }

        const [localArr, localInsp, localMillInsp] = await Promise.all([
          dbModule.fetchAll('final_arrival').catch(() => []),
          dbModule.fetchAll('inspection_master').catch(() => []),
          dbModule.fetchAll('mill_inspection_master').catch(() => [])
        ]);

        const mergedMap = new Map<string, any>();
        (arrList || []).forEach((a: any) => {
          const k = a.mr_no || a.final_arrival_no || a.arrival_no;
          if (k) mergedMap.set(k, a);
        });
        (localArr || []).forEach((a: any) => {
          const k = a.mr_no || a.final_arrival_no || a.arrival_no;
          if (k && !mergedMap.has(k)) mergedMap.set(k, a);
        });
        (localInsp || []).forEach((a: any) => {
          const k = a.mr_no || a.arrival_no;
          if (k) {
            const existing = mergedMap.get(k) || {};
            mergedMap.set(k, {
              ...existing,
              ...a,
              mr_no: k,
              supplier: a.supplier_name || a.supplier || existing.supplier,
              broker: a.broker_name || a.broker || existing.broker,
              po_no: a.po_no || a.mill_po_no || existing.po_no
            });
          }
        });
        (localMillInsp || []).forEach((a: any) => {
          const k = a.mr_no || a.arrival_no;
          if (k) {
            const existing = mergedMap.get(k) || {};
            mergedMap.set(k, {
              ...existing,
              ...a,
              mr_no: k,
              supplier: a.supplier_name || a.supplier || existing.supplier,
              broker: a.broker_name || a.broker || existing.broker,
              po_no: a.po_no || a.mill_po_no || existing.po_no
            });
          }
        });

        // Also check cached inspection_master_records in localStorage
        try {
          const cachedInsp = localStorage.getItem('inspection_master_records');
          if (cachedInsp) {
            const parsedInsp = JSON.parse(cachedInsp);
            if (Array.isArray(parsedInsp)) {
              parsedInsp.forEach((ci: any) => {
                const k = ci.mr_no || ci.arrival_no;
                if (k) {
                  const existing = mergedMap.get(k) || {};
                  mergedMap.set(k, {
                    ...existing,
                    ...ci,
                    mr_no: k,
                    supplier: ci.supplier_name || ci.supplier || existing.supplier,
                    broker: ci.broker_name || ci.broker || existing.broker,
                    po_no: ci.po_no || ci.mill_po_no || existing.po_no
                  });
                }
              });
            }
          }
        } catch (e) {
          console.warn("Cached inspection merge notice:", e);
        }

        arrList = Array.from(mergedMap.values());
      } catch (err) {
        console.warn("dbModule fallback fetch error:", err);
      }

      const combinedPoMap = new Map<string, any>();
      (poList || []).forEach((p: any) => {
        const k = String(p.po_no || p.contract_po_no || p.ptf_no || '').trim().toUpperCase();
        if (k) combinedPoMap.set(k, { ...p, source_table: 'purchase_master' });
      });
      (scpList || []).forEach((s: any) => {
        const k = String(s.po_no || s.contract_po_no || s.ptf_no || s.sauda_no || '').trim().toUpperCase();
        if (k) {
          const existing = combinedPoMap.get(k) || {};
          combinedPoMap.set(k, { ...existing, ...s, source_table: 'sauda_check_point' });
        }
      });
      const combinedPos = Array.from(combinedPoMap.values());

      setPaymentList(payData);
      setPurchaseOrders(combinedPos);
      setSaudaCheckPoints(scpList);

      const verified = (arrList || []).filter(item => {
        const status = String(item.status || '').toLowerCase();
        return status !== 'cancelled' && status !== 'rejected';
      });
      setVerifiedArrivals(verified);

      // Fallback or fill empty masters from dbModule
      if (gData.length === 0) gData = await dbModule.fetchAll('grade_master').catch(() => []);
      if (agData.length === 0) agData = await dbModule.fetchAll('agency_master').catch(() => []);
      if (mDataList.length === 0) mDataList = await dbModule.fetchAll('marka_master').catch(() => []);
      if (aData.length === 0) aData = await dbModule.fetchAll('area_master').catch(() => []);

      setGradeMasterList(gData);
      setAgencyMasterList(agData);
      setMarkaMasterList(mDataList);
      setAreaMasterList(aData);
    } catch (e) {
      console.error("PaymentModule init error:", e);
    } finally {
      setLoading(false);
    }
  };

  useLiveAutoRefresh(initPage, [], { tables: ['payment_master', 'payment_details', 'm_r_settlement', 'final_arrival', 'inspection_master', 'mill_inspection_master', 'inspection_checklist', 'material_inspection_details', 'satta_differentials'] });

  useEffect(() => {
    initPage();
  }, []);

  // Helper to fetch detail item rows from purchase_detail_master / sauda_check_point_details
  const getPoItemDetails = async (po: any): Promise<any[]> => {
    if (!po) return [];
    let parsed = parseGridOrItems(po.items || po.grid_details);
    let itemsToEnrich: any[] = [];

    if (parsed.length > 0) {
      const hasAnyContent = parsed.some(it => it.grade || it.grade_name || it.grade_code || it.agency || it.agency_name || it.agency_code);
      if (hasAnyContent) {
        itemsToEnrich = parsed;
      }
    }

    if (itemsToEnrich.length === 0 && po.po_no) {
      const cleanPo = String(po.po_no || '').trim().replace(/^#/, '');
      const withHash = `#${cleanPo}`;
      try {
        if (supabase) {
          const { data: pdm } = await supabase
            .from('purchase_detail_master')
            .select('*')
            .or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${po.po_no}"`);
          if (pdm && pdm.length > 0) {
            itemsToEnrich = pdm;
          } else {
            const { data: pdmIlike } = await supabase
              .from('purchase_detail_master')
              .select('*')
              .ilike('po_no', cleanPo);
            if (pdmIlike && pdmIlike.length > 0) {
              itemsToEnrich = pdmIlike;
            }
          }

          if (itemsToEnrich.length === 0) {
            const { data: scp } = await supabase
              .from('sauda_check_point_details')
              .select('*')
              .or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${po.po_no}"`);
            if (scp && scp.length > 0) {
              itemsToEnrich = scp;
            } else {
              const { data: scpIlike } = await supabase
                .from('sauda_check_point_details')
                .select('*')
                .ilike('po_no', cleanPo);
              if (scpIlike && scpIlike.length > 0) {
                itemsToEnrich = scpIlike;
              }
            }
          }
        }
        
        if (itemsToEnrich.length === 0) {
          const allPdm = await dbModule.fetchAll('purchase_detail_master').catch(() => []);
          const filteredPdm = allPdm.filter((d: any) => {
            const pNo = String(d.po_no || '').trim().toUpperCase().replace(/^#/, '');
            return pNo === cleanPo.toUpperCase();
          });
          if (filteredPdm.length > 0) itemsToEnrich = filteredPdm;
        }

        if (itemsToEnrich.length === 0) {
          const allScp = await dbModule.fetchAll('sauda_check_point_details').catch(() => []);
          const filteredScp = allScp.filter((d: any) => {
            const pNo = String(d.po_no || '').trim().toUpperCase().replace(/^#/, '');
            return pNo === cleanPo.toUpperCase();
          });
          if (filteredScp.length > 0) itemsToEnrich = filteredScp;
        }
      } catch (e) {
        console.warn("Failed to fetch PO details:", e);
      }
    }

    if (itemsToEnrich.length === 0) {
      itemsToEnrich = parsed;
    }

    let gList = gradeMasterList;
    let agList = agencyMasterList;
    if ((gList.length === 0 || agList.length === 0) && supabase) {
      try {
        const [gData, agData] = await Promise.all([
          supabase.from('grade_master').select('*').then(r => r.data || [], () => []),
          supabase.from('agency_master').select('*').then(r => r.data || [], () => [])
        ]);
        if (gData.length > 0) { gList = gData; setGradeMasterList(gData); }
        if (agData.length > 0) { agList = agData; setAgencyMasterList(agData); }
      } catch (err) {
        console.warn("Failed to load masters in getPoItemDetails:", err);
      }
    }

    return itemsToEnrich.map(item => {
      let gradeName = item.grade_name || item.grade || '';
      if (!gradeName && item.grade_code && gList.length > 0) {
        const match = gList.find(g => String(g.grade_code || g.code || g.id || '').trim().toUpperCase() === String(item.grade_code).trim().toUpperCase());
        if (match) gradeName = match.grade_name || match.name || '';
      }

      let agencyName = item.agency_name || item.agency || '';
      if (!agencyName && item.agency_code && agList.length > 0) {
        const match = agList.find(a => String(a.agency_code || a.code || a.id || '').trim().toUpperCase() === String(item.agency_code).trim().toUpperCase());
        if (match) agencyName = match.agency_name || match.name || '';
      }

      const rateVal = Number(item.rate_qntl || item.rate_per_mt || item.rate_mt || item.rate || item.b_rate || 0);

      return {
        ...item,
        grade_name: gradeName || item.grade_code,
        agency_name: agencyName || item.agency_code,
        rate_qntl: rateVal,
        rate_per_mt: rateVal,
        rate: rateVal
      };
    });
  };

  // Selection Handler for Contract Final P.O
  const handlePoSelection = async (poNo: string) => {
    setSelectedPoNo(poNo);
    if (!poNo) {
      setSelectedPoData(null);
      return;
    }

    const po = purchaseOrders.find(p => p.po_no === poNo);
    if (po) {
      setSelectedPoData(po);

      // Ensure masters are loaded
      let gList = gradeMasterList;
      let agList = agencyMasterList;
      let aList = areaMasterList;
      let mList = markaMasterList;

      if (gList.length === 0 || agList.length === 0) {
        if (supabase) {
          const [gData, agData, mData, aData] = await Promise.all([
            supabase.from('grade_master').select('*').then(r => r.data || [], () => []),
            supabase.from('agency_master').select('*').then(r => r.data || [], () => []),
            supabase.from('marka_master').select('*').then(r => r.data || [], () => []),
            supabase.from('area_master').select('*').then(r => r.data || [], () => [])
          ]);
          if (gData.length > 0) { gList = gData; setGradeMasterList(gData); }
          if (agData.length > 0) { agList = agData; setAgencyMasterList(agData); }
          if (aData.length > 0) { aList = aData; setAreaMasterList(aData); }
          if (mData.length > 0) { mList = mData; setMarkaMasterList(mData); }
        }
      }

      // Fetch items from purchase_detail_master if necessary
      const poItems = await getPoItemDetails(po);
      const cols = mapItemsToDetailCols(poItems, Number(po.b_rate || po.rate_qntl || 0), po, {
        gradeMasters: gList,
        agencyMasters: agList,
        areaMasters: aList,
        markaMasters: mList
      });

      const totalColAmt = cols.reduce((sum, c) => sum + getColAmount(c), 0);
      const grossVal = Number(po.total_amount || po.total_amt || po.contract_value || totalColAmt || 0);
      const defaultPaid = grossVal > 0 ? calculate93PctPaidAmount(grossVal) : 0;

      setMasterData(prev => ({
        ...prev,
        po_no: po.po_no,
        po_date: po.po_date || po.s_date || po.created_at || prev.po_date,
        po_type: po.po_type || 'Standard',
        supplier: po.supplier || po.party_name || prev.supplier,
        party_name: po.party_name || po.supplier || prev.party_name,
        broker: po.broker || po.broker_name || prev.broker,
        rate_qntl: Number(po.b_rate || po.rate_qntl || 0),
        total_amount: grossVal > 0 ? grossVal : prev.total_amount,
        payable_amt: grossVal > 0 ? grossVal : prev.payable_amt,
        paid_amount: grossVal > 0 ? defaultPaid : prev.paid_amount,
      }));

      setDetailCols(cols);

      // Check if an arrival matches this PO
      const matchingArrival = verifiedArrivals.find(a => a.po_no === poNo);
      if (matchingArrival && !selectedMrNo) {
        handleMrSelection(matchingArrival.mr_no || matchingArrival.final_arrival_no, po);
      }
    }
  };

  // Selection Handler for M.R / Final Arrival
  const handleMrSelection = async (mrNo: string, overridePo?: any) => {
    setSelectedMrNo(mrNo);
    if (!mrNo) return;

    const arrival = verifiedArrivals.find(a => (a.mr_no === mrNo || a.final_arrival_no === mrNo));
    if (arrival) {
      const rawPoNo = arrival.po_no || arrival.mill_po_no || masterData.po_no;
      const matchedPo = overridePo || findMatchingPo(rawPoNo, purchaseOrders);
      if (matchedPo) {
        setSelectedPoNo(matchedPo.po_no);
        setSelectedPoData(matchedPo);
      } else {
        setSelectedPoNo('');
        setSelectedPoData(null);
      }
      const po = matchedPo;
      const poNo = matchedPo ? matchedPo.po_no : rawPoNo;

      // Ensure masters are loaded
      let gList = gradeMasterList;
      let agList = agencyMasterList;
      let aList = areaMasterList;
      let mList = markaMasterList;

      if (gList.length === 0 || agList.length === 0) {
        if (supabase) {
          const [gData, agData, mData, aData] = await Promise.all([
            supabase.from('grade_master').select('*').then(r => r.data || [], () => []),
            supabase.from('agency_master').select('*').then(r => r.data || [], () => []),
            supabase.from('marka_master').select('*').then(r => r.data || [], () => []),
            supabase.from('area_master').select('*').then(r => r.data || [], () => [])
          ]);
          if (gData.length > 0) { gList = gData; setGradeMasterList(gData); }
          if (agData.length > 0) { agList = agData; setAgencyMasterList(agData); }
          if (aData.length > 0) { aList = aData; setAreaMasterList(aData); }
          if (mData.length > 0) { mList = mData; setMarkaMasterList(mData); }
        }
      }

      // Map detail columns from arrival grid_details / inspection details, or fallback to PO items
      let rawArrItems: any[] = [];
      
      if (supabase) {
        try {
          const targetMr = arrival.mr_no || arrival.final_arrival_no || arrival.arrival_no || mrNo;
          const cleanMr = targetMr.replace(/^MR[-_ ]?/i, '');
          const candidateKeys = Array.from(new Set([
            targetMr,
            mrNo,
            arrival.mr_no,
            arrival.final_arrival_no,
            arrival.arrival_no,
            cleanMr,
            `MR${cleanMr}`,
            `MR-${cleanMr}`,
            `MR0${cleanMr}`,
            `MR00${cleanMr}`
          ].filter(Boolean)));

          for (const key of candidateKeys) {
            const midRes = await supabase
              .from('material_inspection_details')
              .select('*')
              .eq('mr_no', key)
              .order('srl_no', { ascending: true });
            if (midRes.data && midRes.data.length > 0) {
              rawArrItems = midRes.data;
              break;
            }
          }

          // If material_inspection_details has no rows, check material_inspection master table for grid_details / details
          if (rawArrItems.length === 0) {
            for (const key of candidateKeys) {
              const miRes = await supabase
                .from('material_inspection')
                .select('*')
                .or(`mr_no.eq.${key},arrival_no.eq.${key}`)
                .limit(1)
                .maybeSingle();
              if (miRes.data) {
                const grid = miRes.data.grid_details || miRes.data.details;
                const parsed = parseGridOrItems(grid);
                if (parsed && parsed.length > 0) {
                  rawArrItems = parsed;
                  break;
                }
              }
            }
          }
        } catch (e) {
          console.warn("Failed to fetch inspection details:", e);
        }
      }

      // If not loaded from DB, fallback to arrival grid_details
      if (rawArrItems.length === 0) {
        rawArrItems = parseGridOrItems(arrival.grid_details || arrival.items || arrival.details);
      }

      const poItems = po ? await getPoItemDetails(po) : [];

      if (rawArrItems.length === 0 && poItems.length > 0) {
        rawArrItems = poItems;
      }

      let cols = mapItemsToDetailCols(rawArrItems, Number(po?.b_rate || po?.rate_qntl || 0), po || arrival, {
        gradeMasters: gList,
        agencyMasters: agList,
        areaMasters: aList,
        markaMasters: mList
      });

      // Merge PO item line rates into the inspection detail columns with strict grade matching
      if (poItems.length > 0) {
        cols = cols.map((col) => {
          if (!col.grade && !col.arr_qty_wt && !col.quantity) return col;
          
          let lineRate = col.rate_value;
          const matchedPoItem = findMatchedPoItem(col, poItems, { gradeMasters: gList, agencyMasters: agList });

          if (matchedPoItem) {
            const r = Number(
              matchedPoItem.rate_per_mt || matchedPoItem.rate_mt || matchedPoItem.rate_qntl || matchedPoItem.rate || 0
            );
            if (r > 0) {
              lineRate = r;
            }
          }
          // If no specific grade match, but column has no rate, fallback to header base rate
          if (!lineRate || lineRate === 0) {
            const fallbackRate = Number(po?.b_rate || po?.rate_qntl || 0);
            if (fallbackRate > 0) {
              lineRate = fallbackRate;
            }
          }

          const settPct = getColSettPct(col);
          const colWithRate = { ...col, rate_value: lineRate, sett_pct: settPct };
          const ded = getColDeduction(colWithRate);
          const sRate = Math.max(0, Number((lineRate - ded).toFixed(2)));
          const qQtl = getColQtyQtl(col);
          const amt = Number((qQtl * sRate).toFixed(2));

          return {
            ...col,
            rate_value: lineRate,
            sett_pct: settPct,
            deduction_rate: ded,
            sett_rate: sRate,
            quantity_qtl: qQtl,
            amount: amt
          };
        });
      }

      const totalColAmt = cols.reduce((sum, c) => sum + getColAmount(c), 0);
      const grossVal = totalColAmt > 0
        ? totalColAmt
        : Number(arrival.payable_amt || arrival.net_amt || arrival.value_amt || arrival.total_amount || po?.total_amount || 0);
      const defaultPaid = grossVal > 0 ? calculate93PctPaidAmount(grossVal) : 0;
      const mrWeight = Number(arrival.electronic_net_weight || arrival.weight_qtl || 0);

      setMasterData(prev => ({
        ...prev,
        mr_no: arrival.mr_no || arrival.final_arrival_no || mrNo,
        po_no: poNo || prev.po_no,
        po_date: po?.po_date || po?.s_date || arrival.po_date || arrival.date || prev.po_date,
        supplier: arrival.supplier || po?.supplier || prev.supplier,
        party_name: arrival.supplier || po?.supplier || prev.party_name,
        broker: arrival.broker || po?.broker || prev.broker,
        po_type: po?.po_type || 'Standard',
        lorry_number: arrival.lorry_number || arrival.vehicle_no || prev.lorry_number,
        arrival_no: arrival.final_arrival_no || arrival.mr_no || prev.arrival_no,
        arrival_date: arrival.date || prev.arrival_date,
        total_amount: grossVal > 0 ? grossVal : prev.total_amount,
        payable_amt: grossVal > 0 ? grossVal : prev.payable_amt,
        paid_amount: grossVal > 0 ? defaultPaid : prev.paid_amount,
        net_amt: grossVal > 0 ? grossVal : prev.net_amt,
        electronic_scale_net: mrWeight,
        challan_weight: Number(arrival.challan_material_weight || prev.challan_weight)
      }));

      setDetailCols(cols);
    }
  };

  // Save / Upsert Payment Record
  const handleSavePayment = async () => {
    if (!masterData.voucher_no || masterData.voucher_no.trim() === '') {
      setErrorMessage("Voucher Number is required.");
      return;
    }

    const hasPo = Boolean((masterData.po_no && masterData.po_no.trim()) || (selectedPoNo && selectedPoNo.trim()));
    const hasMr = Boolean((masterData.mr_no && masterData.mr_no.trim()) || (selectedMrNo && selectedMrNo.trim()) || (masterData.arrival_no && masterData.arrival_no.trim()));

    if (!hasPo && !hasMr) {
      setErrorMessage("Validation Error: Both 'Final P.O' and 'Inspection' have no data. Please select at least one Final P.O or Inspection record before saving.");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      if (!supabase) throw new Error("Supabase client not connected.");

      await ensurePaymentTablesExist();

      const initialPayload: Record<string, any> = {
        voucher_no: masterData.voucher_no,
        payment_date: masterData.payment_date || new Date().toISOString().split('T')[0],
        mr_no: masterData.mr_no || null,
        po_no: masterData.po_no || null,
        po_date: masterData.po_date || null,
        sett_date: masterData.sett_date || null,
        po_type: masterData.po_type || null,
        broker: masterData.broker || null,
        supplier: masterData.supplier || null,
        party_id: masterData.party_id || masterData.supplier || 'N/A',
        party_name: masterData.party_name || masterData.supplier || 'N/A',
        chn_supplier: masterData.chn_supplier || null,
        lorry_number: masterData.lorry_number || null,
        arrival_no: masterData.arrival_no || null,
        arrival_date: masterData.arrival_date || null,
        arival_apmc_fees: Number(masterData.arival_apmc_fees) || 0,
        payable_amt: Number(masterData.payable_amt) || 0,
        payable_bill_no: masterData.payable_bill_no || null,
        payable_bill_date: masterData.payable_bill_date || null,
        total_amount: Number(masterData.total_amount) || Number(masterData.payable_amt) || 0,
        paid_amount: Number(masterData.paid_amount) || Number(masterData.payable_amt) || 0,
        payment_mode: masterData.payment_mode || 'Bank Transfer (NEFT/RTGS)',
        bank_name: masterData.bank_name || '',
        reference_no: masterData.reference_no || '',
        remarks: masterData.remarks || '',
        status: 'completed',
        payment_status: 'Paid',
        advance_payment_done: masterData.advance_payment_done || 'No',
        advance_payment_from: masterData.advance_payment_from || '1',
        payment_settlementdate: masterData.payment_settlementdate ||'',
        tenor: masterData.tenor ||'',
        repayment_date: masterData.repayment_date ||''
      };

      let savedMaster: any = null;
      let mErr: any = null;
      const currentPayload = { ...initialPayload };

      for (let attempt = 0; attempt < 8; attempt++) {
        // First attempt standard upsert
        let res = await supabase
          .from('payment_master')
          .upsert(currentPayload, { onConflict: 'voucher_no' })
          .select()
          .single();

        // Fallback if relation does not exist
        if (res.error && res.error.message?.includes('does not exist')) {
          await ensurePaymentTablesExist();
          res = await supabase
            .from('payment_master')
            .upsert(currentPayload, { onConflict: 'voucher_no' })
            .select()
            .single();
        }

        // Fallback if upsert ON CONFLICT fails due to missing unique constraint in schema
        if (res.error && (res.error.message?.includes('ON CONFLICT') || res.error.message?.includes('on conflict') || res.error.message?.includes('constraint'))) {
          const { data: existing } = await supabase
            .from('payment_master')
            .select('*')
            .eq('voucher_no', masterData.voucher_no)
            .maybeSingle();

          if (existing) {
            res = await supabase
              .from('payment_master')
              .update(currentPayload)
              .eq('voucher_no', masterData.voucher_no)
              .select()
              .single();
          } else {
            res = await supabase
              .from('payment_master')
              .insert(currentPayload)
              .select()
              .single();
          }
        }

        if (res.error) {
          const match = res.error.message?.match(/Could not find the '([^']+)' column/i);
          if (match && match[1] && match[1] in currentPayload) {
            console.warn(`Column '${match[1]}' not found in payment_master schema, stripping and retrying...`);
            delete currentPayload[match[1]];
            continue;
          }
          mErr = res.error;
          break;
        } else {
          savedMaster = res.data;
          mErr = null;
          break;
        }
      }

      // Always persist locally in dbModule fallback
      const recordToSave = savedMaster || currentPayload;
      if (recordToSave && recordToSave.voucher_no) {
        await dbModule.upsert('payment_master', recordToSave).catch(() => {});
      }

      if (mErr && !savedMaster) {
        throw new Error(mErr.message || "Failed to save to Supabase payment_master.");
      }

      // Save detail rows into payment_details
      const masterRecord = savedMaster || recordToSave;
      if (masterRecord && detailCols.length > 0) {
        await supabase.from('payment_details').delete().eq('voucher_no', masterData.voucher_no);
        const rowsToWrite = detailCols
          .filter(c => c.grade && c.grade.trim() !== '')
          .map(c => ({
            payment_id: masterRecord.payment_id || null,
            voucher_no: masterData.voucher_no,
            mr_no: masterData.mr_no,
            col_index: c.col_index,
            grade: c.grade,
            area: c.area,
            agency: c.agency,
            marka_crop: c.marka_crop,
            quantity: Number(c.quantity) || 0,
            arr_qty_wt: Number(c.arr_qty_wt) || 0,
            min_qty_wt: Number(c.min_qty_wt) || 0,
            wt_phota: Number(c.wt_phota) || 0,
            wt_quantity: Number(c.wt_quantity) || 0,
            rate_value: Number(c.rate_value) || 0,
            sett_pct: getColSettPct(c),
            deduction_rate: getColDeduction(c),
            sett_rate: getColSettRate(c),
            quantity_qtl: getColQtyQtl(c),
            amount: getColAmount(c),
            gd_claim: Number(c.gd_claim) || 0,
            gd_sett: Number(c.gd_sett) || 0,
            gd_rev: Number(c.gd_rev) || 0,
            gd_final: Number(c.gd_final) || 0,
            moist_claim: Number(c.moist_claim) || 0,
            moist_sett: Number(c.moist_sett) || 0,
            moist_rev: Number(c.moist_rev) || 0,
            moist_final: Number(c.moist_final) || 0,
            dust_claim: Number(c.dust_claim) || 0,
            dust_sett: Number(c.dust_sett) || 0,
            dust_rev: Number(c.dust_rev) || 0,
            dust_final: Number(c.dust_final) || 0,
            ncv_claim: Number(c.ncv_claim) || 0,
            ncv_sett: Number(c.ncv_sett) || 0,
            ncv_rev: Number(c.ncv_rev) || 0,
            ncv_final: Number(c.ncv_final) || 0,
            po_grade_claim: Number(c.po_grade_claim) || 0,
            po_grade_sett: Number(c.po_grade_sett) || 0,
            po_grade_rev: Number(c.po_grade_rev) || 0,
            po_grade_final: Number(c.po_grade_final) || 0,
            adjust_type: c.adjust_type,
            remark: c.remark,
            claim_settlement: Number(c.claim_settlement) || 0
          }));

        if (rowsToWrite.length > 0) {
          await supabase.from('payment_details').insert(rowsToWrite);
        }
      }

      // Update payment_status on final_arrival & purchase_master
      if (masterData.mr_no) {
        await supabase.from('final_arrival').update({ payment_status: 'Paid' }).eq('mr_no', masterData.mr_no);
      }
      if (masterData.po_no) {
        await supabase.from('purchase_master').update({ payment_status: 'Paid' }).eq('po_no', masterData.po_no);
      }

      setShowSuccessAnim(true);
      setTimeout(() => {
        setShowSuccessAnim(false);
        initPage();
        setViewMode('dashboard');
      }, 1500);

    } catch (err: any) {
      console.error("Save error:", err);
      setErrorMessage(err.message || "Failed to save payment record.");
    } finally {
      setLoading(false);
    }
  };

  // Delete Payment Record
  const handleDeletePayment = async (voucherNo: string) => {
    if (!enforceEditOrDeletePermission('Delete')) return;
    if (!window.confirm(`Are you sure you want to delete Payment Voucher ${voucherNo}?`)) return;

    setLoading(true);
    try {
      await supabase.from('payment_details').delete().eq('voucher_no', voucherNo);
      await supabase.from('payment_master').delete().eq('voucher_no', voucherNo);
      await dbModule.delete('payment_master', 'voucher_no', voucherNo).catch(() => {});
      setSuccessMessage(`Payment Voucher ${voucherNo} deleted successfully.`);
      initPage();
    } catch (e: any) {
      setErrorMessage(e.message || "Failed to delete payment.");
    } finally {
      setLoading(false);
    }
  };

  // Edit / Load existing Payment Record

  const handelTnordate = (e, masterData) => {
    const tenor = Number(e.target.value);

    if (masterData.payment_settlementdate) {
      const paysettledate = new Date(
        masterData.payment_settlementdate
      );

      paysettledate.setDate(paysettledate.getDate() + tenor);

      const year = paysettledate.getFullYear();
      const month = String(paysettledate.getMonth() + 1).padStart(2, "0");
      const day = String(paysettledate.getDate()).padStart(2, "0");

      const repaymentDate = `${year}-${month}-${day}`;

      setMasterData({
        ...masterData,
        tenor: e.target.value,
        repayment_date: repaymentDate
      });
    }
  };
  
  const handleEditPayment = async (item: PaymentMaster) => {
    setMasterData(item);
    setIsEdit(true);

    // Fetch details
    if (supabase && item.voucher_no) {
      const { data: details } = await supabase
        .from('payment_details')
        .select('*')
        .eq('voucher_no', item.voucher_no);

      if (details && details.length > 0) {
        const newCols = [emptyDetailColumn(1), emptyDetailColumn(2), emptyDetailColumn(3), emptyDetailColumn(4)];
        details.forEach((d: any, idx: number) => {
          if (idx < 4) {
            const settPct = d.sett_pct !== undefined && d.sett_pct !== null && !isNaN(Number(d.sett_pct)) && Number(d.sett_pct) > 0
              ? Number(d.sett_pct)
              : (Number(d.gd_claim) > 0 ? Number(d.gd_claim) : Number(d.gd_sett || d.sett_pct || 0));
            const origRate = Number(d.rate_value) || 0;
            const sattaDed = getColDeduction({ ...d, rate_value: origRate, sett_pct: settPct });
            const dedRate = (settPct > 0 || sattaDed > 0)
              ? sattaDed
              : (d.deduction_rate !== undefined && d.deduction_rate !== null && !isNaN(Number(d.deduction_rate))
                ? Number(d.deduction_rate)
                : 0);
            const sRate = Math.max(0, Number((origRate - dedRate).toFixed(2)));
            const qQtl = d.quantity_qtl !== undefined && d.quantity_qtl !== null && !isNaN(Number(d.quantity_qtl))
              ? Number(d.quantity_qtl)
              : Number((Number(d.arr_qty_wt || d.wt_quantity || 0) * 10).toFixed(3));
            const amt = d.amount !== undefined && d.amount !== null && !isNaN(Number(d.amount))
              ? Number(d.amount)
              : Number((qQtl * sRate).toFixed(2));

            newCols[idx] = {
              ...emptyDetailColumn(idx + 1),
              ...d,
              sett_pct: settPct,
              deduction_rate: dedRate,
              sett_rate: sRate,
              quantity_qtl: qQtl,
              amount: amt
            };
          }
        });
        setDetailCols(newCols);
      }
    }

    setViewMode('entry');
  };
  //Export csv
  const handleExportCsv = () => {
    if (filteredPayments.length === 0) {
      alert("No payment records to export.");
      return;
    }

    const headers = [
      'M.R No',
      'Supplier Name',
      'Advance Done',
      'Payable Amount',
      'Paid Amount',
      'Pending Amount',
      'Payment From',
      'Payment Settle date',
      'Tenor',
      'Re-Payment Date'
    ];

    const tableData = filteredPayments.map(p => {
      const payablep = Number(p.payable_amt || p.total_amount || 0);
      const paidp = Number(p.paid_amount || 0);
      const pendingp = payablep - paidp;

      const isAdvanceYesp =
        (p.advance_payment_done || 'No').toLowerCase() === 'yes';

      const advance_payment_fromp = p.advance_payment_from || '';

      const paymentFrom =
        advance_payment_fromp === '' || advance_payment_fromp === '1'
          ? 'FROM BANK'
          : advance_payment_fromp === '2'
          ? 'RXIL'
          : advance_payment_fromp === '3'
          ? 'TReDS'
          : advance_payment_fromp === '4'
          ? 'Invoice Mart'
          : '';

      return [
        p.mr_no || '',
        p.party_name || p.supplier || '',
        isAdvanceYesp ? 'YES' : 'NO',
        payablep.toFixed(2),
        paidp.toFixed(2),
        pendingp.toFixed(2),
        paymentFrom,
        p.payment_settlementdate
          ? new Date(p.payment_settlementdate).toLocaleDateString('en-IN')
          : '',
        p.tenor || '',
        p.repayment_date
          ? new Date(p.repayment_date).toLocaleDateString('en-IN')
          : ''
      ];
    });

    // Escape CSV values
    const escapeCsvValue = (value) => {
      const stringValue = String(value ?? '');

      if (
        stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n')
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    };

    // Create CSV
    const csvContent = [
      headers.map(escapeCsvValue).join(','),
      ...tableData.map(row =>
        row.map(escapeCsvValue).join(',')
      )
    ].join('\r\n');

    // Add BOM for proper Excel UTF-8 support
    const blob = new Blob(
      ['\uFEFF' + csvContent],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `Treds_Records_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  // Export PDF Ledger / Summary
  const handleExportPdf = () => {
    if (filteredPayments.length === 0) {
      alert("No payment records to export.");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Treds Report", 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = filteredPayments.map(p => {
      const payablep = Number(p.payable_amt || p.total_amount || 0);
      const paidp = Number(p.paid_amount || 0);
      const pendingp = payablep - paidp;

      const isAdvanceYesp =
        (p.advance_payment_done || 'No').toLowerCase() === 'yes';

      const advance_payment_fromp = p.advance_payment_from || '';

      return [
        p.mr_no,
        p.party_name || p.supplier || '',
        isAdvanceYesp ? 'YES' : 'NO',
        formatIndianCurrency(payablep),
        formatIndianCurrency(paidp),
        formatIndianCurrency(pendingp),

        advance_payment_fromp === '' || advance_payment_fromp === '1'
          ? 'FROM BANK'
          : advance_payment_fromp === '2'
          ? 'RXIL'
          : advance_payment_fromp === '3'
          ? 'TReDS'
          : advance_payment_fromp === '4'
          ? 'Invoice Mart'
          : '',

        p.payment_settlementdate
          ? new Date(p.payment_settlementdate).toLocaleDateString('en-IN')
          : '',

        p.tenor || '',

        p.repayment_date
          ? new Date(p.repayment_date).toLocaleDateString('en-IN')
          : '',
      ];
    });

    autoTable(doc, {
      startY: 28,
      head: [['M.R No', 'Supplier Name', 'Advance Done', 'Payable Amount', 'Paid Amount', 'Pending Amount', 'Payment From', 'Payment Settle date','Tenor','Re-Payment Date']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save('Treds_Records.pdf');
  };

  // 100-rows per page pagination (searches full dataset, displays paginated)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [ledgerCurrentPage, setLedgerCurrentPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(100);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter]);

  useEffect(() => {
    setLedgerCurrentPage(1);
  }, [selectedLedgerParty]);

  // Filtered Payments list
  const filteredPayments = paymentList.filter(p => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase().trim();
    return (
      (p.party_name && p.party_name.toLowerCase().includes(term)) ||
      (p.supplier && p.supplier.toLowerCase().includes(term)) ||
      (p.mr_no && p.mr_no.toLowerCase().includes(term)) ||
      (p.advance_payment_from.includes(term))
    );
  });

  // Calculate totals for dashboard summary cards
  const totalPaidSum = paymentList.reduce((sum, p) => sum + (Number(p.paid_amount || p.total_amount || 0)), 0);
  const totalPayableSum = paymentList.reduce((sum, p) => sum + (Number(p.payable_amt || p.total_amount || 0)), 0);
  const totalPendingSum = paymentList.reduce((sum, p) => {
    const payable = Number(p.payable_amt || p.total_amount || 0);
    const paid = Number(p.paid_amount || 0);
    const pending = payable - paid;
    return sum + (pending > 0 ? pending : 0);
  }, 0);

  const completedCount = paymentList.filter(p => (p.status || p.payment_status || '').toLowerCase() === 'completed' || (p.status || p.payment_status || '').toLowerCase() === 'paid').length;
  const pendingCount = paymentList.filter(p => {
    const payable = Number(p.payable_amt || p.total_amount || 0);
    const paid = Number(p.paid_amount || 0);
    return (payable - paid) > 0 || (p.status || p.payment_status || '').toLowerCase() === 'pending';
  }).length;

  // Party Ledger Calculations
  const partyList = Array.from(
    new Set(
      paymentList
        .map(p => p.party_name || p.supplier)
        .concat(verifiedArrivals.map(a => a.supplier || a.party_name))
        .filter(Boolean)
    )
  ).sort();

  const partyLedgerRecords = paymentList.filter(p => {
    if (!selectedLedgerParty) return true;
    const pName = (p.party_name || p.supplier || '').toLowerCase().trim();
    return pName === selectedLedgerParty.toLowerCase().trim();
  });

  const partyTotalPayable = partyLedgerRecords.reduce((sum, p) => sum + Number(p.payable_amt || p.total_amount || 0), 0);
  const partyTotalPaid = partyLedgerRecords.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);
  const partyTotalPending = partyTotalPayable - partyTotalPaid;

  

  return (
    <>
      {/* Top Header Actions Bar */}
      {/* <div className="mb-4 bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 text-white p-3 rounded-xl shadow-md flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg text-purple-300">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider">Payment Operations</h2>
            <p className="text-[10px] text-purple-200">Real-Time Supabase `payment_master` Sync</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('dashboard')}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5",
              viewMode === 'dashboard'
                ? "bg-purple-600 text-white border-purple-400 shadow"
                : "bg-purple-900/60 text-purple-200 border-purple-700 hover:bg-purple-800"
            )}
          >
            <Wallet className="w-3.5 h-3.5" />
            Payment Dashboard
          </button>

          <button
            onClick={() => setViewMode('ledger')}
            className={cn(
              "px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5",
              viewMode === 'ledger'
                ? "bg-purple-600 text-white border-purple-400 shadow"
                : "bg-purple-900/60 text-purple-200 border-purple-700 hover:bg-purple-800"
            )}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Party Ledger Accounts
          </button>

          {viewMode === 'entry' ? (
            <LegacyButton
              onClick={() => { setViewMode('dashboard'); setMasterData(initialMaster()); setIsEdit(false); }}
              variant="secondary"
              icon={ArrowLeft}
            >
              Back
            </LegacyButton>
          ) : (
            <LegacyButton
              onClick={() => {
                setMasterData(initialMaster());
                setDetailCols([emptyDetailColumn(1), emptyDetailColumn(2), emptyDetailColumn(3), emptyDetailColumn(4)]);
                setIsEdit(false);
                setViewMode('entry');
              }}
              variant="primary"
              icon={Plus}
            >
              New Payment Voucher
            </LegacyButton>
          )}
        </div>
      </div> */}
      {/* Messages */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-red-800 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="p-1 hover:bg-red-100 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between text-green-800 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="p-1 hover:bg-green-100 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* DASHBOARD VIEW */}
      {viewMode === 'dashboard' && (
        <div className="space-y-4">
          {/* Dashboard Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 auto-rows-fr">

            {/* Total Vouchers */}
            <div className="h-full min-w-0 bg-gradient-to-br from-blue-600 to-blue-800 text-white p-3 rounded-xl border border-blue-400/40 shadow-md flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100">
                  Total Vouchers
                </p>

                <h3 className="text-xl font-black mt-0.5">
                  {paymentList.length}
                </h3>

                {/* <p className="text-[9px] text-blue-200 mt-0.5 truncate">
                  Records in `payment_master`
                </p> */}
              </div>

              <div className="shrink-0 ml-2 p-2 bg-white/15 rounded-lg text-white">
                <Wallet className="w-5 h-5" />
              </div>
            </div>


            {/* Total Paid Amount */}
            <div className="h-full min-w-0 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white p-3 rounded-xl border border-emerald-400/40 shadow-md flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                  Total Paid Amount
                </p>

                <h3 className="text-lg font-black mt-0.5 truncate">
                  {formatIndianCurrency(totalPaidSum)}
                </h3>

                <p className="text-[9px] text-emerald-200 mt-0.5 truncate">
                  {completedCount} Vouchers Cleared
                </p>
              </div>

              <div className="shrink-0 ml-2 p-2 bg-white/15 rounded-lg text-white">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>


            {/* Total Payable Value */}
            <div className="h-full min-w-0 bg-gradient-to-br from-violet-600 to-violet-800 text-white p-3 rounded-xl border border-violet-400/40 shadow-md flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-100">
                  Total Payable Value
                </p>

                <h3 className="text-lg font-black mt-0.5 truncate">
                  {formatIndianCurrency(totalPayableSum)}
                </h3>

                <p className="text-[9px] text-violet-200 mt-0.5 truncate">
                  Total Gross Invoice Value
                </p>
              </div>

              <div className="shrink-0 ml-2 p-2 bg-white/15 rounded-lg text-white">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>


            {/* Pending / Retention */}
            <div className="h-full min-w-0 bg-gradient-to-br from-orange-500 to-orange-700 text-white p-3 rounded-xl border border-orange-300/50 shadow-md flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-100 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Pending / Retention
                </p>

                <h3 className="text-lg font-black mt-0.5 text-white truncate">
                  {formatIndianCurrency(totalPendingSum)}
                </h3>

                <p className="text-[9px] text-orange-100 mt-0.5 font-semibold truncate">
                  {pendingCount} Outstanding / Retention
                </p>
              </div>

              <div className="shrink-0 ml-2 p-2 bg-white/15 rounded-lg text-white">
                <Clock className="w-5 h-5" />
              </div>
            </div>

          </div>

          {/* Search Bar & Toolbar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-0 sm:min-w-[220px] w-full sm:w-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input id="search_by_voucher_no_part_1467" name="search_by_voucher_no_part" aria-label="Search by Voucher No, Party Name, M.R No, P.O No, Reference..." type="text"
                placeholder="Search by  Supplier Name, M.R No ..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="relative flex-1 min-w-0 sm:min-w-[220px] w-full sm:w-auto">
              <select
                id="search_by_voucher_no_part_1467"
                name="search_by_voucher_no_part"
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select Payment From</option>
                <option value="1">FROM BANK</option>
                <option value="2">RXIL</option>
                <option value="3">TReDS </option>
                <option value="4">Invoice Mart</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              {/* <button
                onClick={() => setViewMode('ledger')}
                className="px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Party Ledger View
              </button> */}
              <button
                onClick={handleExportCsv}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <button
                onClick={handleExportPdf}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export PDF
              </button>
              <button
                onClick={initPage}
                disabled={loading}
                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors disabled:opacity-50"
                title="Refresh Table"
              >
                <RefreshCcw className={cn("w-4 h-4", loading && "animate-spin text-purple-600")} />
              </button>
            </div>
          </div>

          {/* Payment Master Data Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                <Wallet className="w-4 h-4 text-purple-600" />
                Payment Records ({filteredPayments.length})
              </h3>
              {/* <span className="text-[10px] text-slate-500 font-semibold">
                Real-Time Database Sync (`payment_master`)
              </span> */}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] uppercase font-black text-slate-600">
                    <th className="p-2.5">M.R No</th>
                    <th className="p-2.5">Supplier</th>
                    <th className="p-2.5 text-center">Advance Done</th>
                    <th className="p-2.5 text-right">Payable Amount</th>
                    <th className="p-2.5 text-right">Paid Amount</th>
                    <th className="p-2.5 text-right">Pending Amount</th>
                    <th className="p-2.5 text-right">Payment From</th>
                    <th className="p-2.5">Payment Settle date</th>
                    <th className="p-2.5">Tenor</th>
                    <th className="p-2.5">Re-Payment Date </th>
                    {/* <th className="p-2.5 text-center">Actions</th> */}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredPayments.length > 0 ? (
                    filteredPayments.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((p, idx) => {
                      const payable = Number(p.payable_amt || p.total_amount || 0);
                      const paid = Number(p.paid_amount || 0);
                      const pending = payable - paid;
                      const isAdvanceYes = (p.advance_payment_done || 'No').toLowerCase() === 'yes';
                      const advance_payment_from = p.advance_payment_from || '';
                      return (
                        <tr key={p.payment_id || p.voucher_no || idx} className="hover:bg-purple-50/40 transition-colors">
                          <td className="p-2.5 font-mono text-slate-600">
                            <div className="text-[11px] font-bold text-slate-700">{p.mr_no || '-'}</div>
                            {p.po_no && <div className="text-[9px] text-slate-400">P.O: {p.po_no}</div>}
                          </td>
                          
                          <td className="p-2.5 font-semibold text-slate-800">
                            {p.party_name || p.supplier || '-'}
                          </td>
                          
                          <td className="p-2.5 text-center">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border inline-flex items-center gap-1",
                              isAdvanceYes
                                ? "bg-green-100 text-green-900 border-green-300"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            )}>
                              {isAdvanceYes ? 'YES' : 'NO'}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-700">
                            {formatIndianCurrency(payable)}
                          </td>
                          <td className="p-2.5 text-right font-extrabold text-emerald-700">
                            {formatIndianCurrency(paid)}
                          </td>
                          <td className="p-2.5 text-right">
                            {pending > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                {formatIndianCurrency(pending)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                                ₹0 (Cleared)
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            {(advance_payment_from === '' || advance_payment_from ==='1') &&(
                              <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">FROM BANK</span>
                            )}
                            {advance_payment_from ==='2' &&(
                              <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">RXIL</span>
                            )}
                            {advance_payment_from ==='3' &&(
                              <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">TReDS</span>
                            )}
                            {advance_payment_from ==='4' &&(
                              <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">Invoice Mart</span>
                            )} 
                          </td>
                          <td className="p-2.5 font-medium text-slate-600 text-center">
                            {p.payment_settlementdate ? new Date(p.payment_settlementdate).toLocaleDateString('en-IN') : '-'}
                          </td>
                          <td className="p-2.5 font-medium text-slate-600 text-center">
                            {p.tenor }
                          </td>
                          <td className="p-2.5 font-medium text-slate-600 text-center">
                            {p.repayment_date ? new Date(p.repayment_date).toLocaleDateString('en-IN') : '-'}
                          </td>
                          {/* <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleEditPayment(p)}
                                className="px-2 py-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors"
                              >
                                Payment Check
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedLedgerParty(p.party_name || p.supplier || '');
                                  setViewMode('ledger');
                                }}
                                className="px-2 py-1 text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors"
                                title="View Party Ledger"
                              >
                                Ledger
                              </button>
                              <button
                                onClick={() => handleDeletePayment(p.voucher_no)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button> 
                            </div>
                          </td> */}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 italic text-xs">
                        No payment records found in `payment_master`. Click "New Payment Voucher" to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-2">
              <PaginationControls
                currentPage={currentPage}
                totalItems={filteredPayments.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        </div>
      )}

      {/* PARTY LEDGER ACCOUNTS VIEW */}
      {viewMode === 'ledger' && (
        <div className="space-y-4">
          {/* Party Ledger Filter Header */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0 sm:min-w-[260px] w-full sm:w-auto">
              <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <label htmlFor="select_party_supplier_led_1661" className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                  Select Party / Supplier Ledger Account
                </label>
                <select id="select_party_supplier_led_1661" name="select_party_supplier_led" aria-label="Select Party / Supplier Ledger Account"                  value={selectedLedgerParty}
                  onChange={e => setSelectedLedgerParty(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-600 bg-slate-50 text-slate-800"
                >
                  <option value="">-- All Parties / Consolidated Ledger --</option>
                  {partyList.map(party => (
                    <option key={party} value={party}>{party}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* <button
                onClick={handleExportPartyLedgerPdf}
                className="px-3 py-1.5 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Export Ledger Statement (PDF)
              </button> */}
              <button
                onClick={() => setViewMode('dashboard')}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                Back
              </button>
            </div>
          </div>

          {/* Party Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-slate-500">Party Selected</p>
              <h4 className="text-sm font-black text-purple-900 truncate mt-0.5">
                {selectedLedgerParty || 'Consolidated (All Parties)'}
              </h4>
              <p className="text-[9px] text-slate-400 mt-1">{partyLedgerRecords.length} Payment Transactions</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-slate-500">Total Invoice / Payable Value</p>
              <h4 className="text-base font-black text-slate-800 mt-0.5">
                ₹ {partyTotalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h4>
              <p className="text-[9px] text-slate-400 mt-1">Gross Contract Bill Value</p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-slate-500">Total Amount Paid</p>
              <h4 className="text-base font-black text-emerald-700 mt-0.5">
                ₹ {partyTotalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h4>
              <p className="text-[9px] text-emerald-600 font-semibold mt-1">Total Cleared Disbursed</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-3.5 rounded-xl border border-amber-300 shadow-sm">
              <p className="text-[10px] font-black uppercase text-amber-800 flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-600" />
                Net Pending / Retention Balance
              </p>
              <h4 className="text-base font-black text-amber-900 mt-0.5">
                ₹ {partyTotalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h4>
              <p className="text-[9px] text-amber-700 font-bold mt-1">Outstanding Retention Payable</p>
            </div>
          </div>

          {/* Party Itemized Ledger Statement Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3 bg-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-300" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Itemized Party Ledger Statement — {selectedLedgerParty || 'All Suppliers'}
                </h3>
              </div>
              <span className="text-[10px] text-purple-200 font-semibold">
                Updated Real-Time
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase font-black text-slate-600">
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Voucher No</th>
                    <th className="p-2.5">Party / Supplier</th>
                    <th className="p-2.5">M.R No</th>
                    <th className="p-2.5">Payment Mode</th>
                    <th className="p-2.5 text-center">Advance Done?</th>
                    <th className="p-2.5 text-right">Bill / Payable (₹)</th>
                    <th className="p-2.5 text-right">Paid Amount (₹)</th>
                    <th className="p-2.5 text-right">Pending Balance (₹)</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {partyLedgerRecords.length > 0 ? (
                    partyLedgerRecords.slice((ledgerCurrentPage - 1) * ledgerPageSize, ledgerCurrentPage * ledgerPageSize).map((p, idx) => {
                      const payable = Number(p.payable_amt || p.total_amount || 0);
                      const paid = Number(p.paid_amount || 0);
                      const pending = payable - paid;
                      const isAdv = (p.advance_payment_done || 'No').toLowerCase() === 'yes';
                      return (
                        <tr key={p.payment_id || p.voucher_no || idx} className="hover:bg-purple-50/30">
                          <td className="p-2.5 font-medium text-slate-600">
                            {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '-'}
                          </td>
                          <td className="p-2.5 font-bold font-mono text-purple-900">{p.voucher_no}</td>
                          <td className="p-2.5 font-semibold text-slate-800">{p.party_name || p.supplier || '-'}</td>
                          <td className="p-2.5 font-mono text-slate-600 text-[11px]">
                            <div>{p.po_no || '-'}</div>
                            {p.mr_no && <div className="text-[9px] text-slate-400">MR: {p.mr_no}</div>}
                          </td>
                          <td className="p-2.5 text-slate-600">{p.payment_mode || 'Bank Transfer'}</td>
                          <td className="p-2.5 text-center">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border",
                              isAdv ? "bg-green-100 text-green-800 border-green-300" : "bg-slate-100 text-slate-600 border-slate-200"
                            )}>
                              {isAdv ? '✓ YES' : 'NO'}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-700">
                            ₹ {payable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 text-right font-extrabold text-emerald-700">
                            ₹ {paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 text-right font-black text-amber-800">
                            ₹ {pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2.5 text-center">
                            {(() => {
                              const totalVal = Number(p.payable_amt || p.total_amount || 0);
                              const paidVal = Number(p.paid_amount || 0);
                              let statusText = 'Pending';
                              let badgeStyle = 'bg-amber-100 text-amber-800 border-amber-300';

                              if (totalVal > 0 && paidVal >= totalVal - 0.01) {
                                statusText = 'Fully Settled';
                                badgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                              } else if (paidVal > 0) {
                                statusText = 'Partially Settled';
                                badgeStyle = 'bg-sky-100 text-sky-800 border-sky-300';
                              } else {
                                statusText = 'Pending';
                                badgeStyle = 'bg-amber-100 text-amber-800 border-amber-300';
                              }

                              return (
                                <span className={cn("px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border inline-flex items-center gap-1 shadow-2xs", badgeStyle)}>
                                  <span className={cn("w-1.5 h-1.5 rounded-full", statusText === 'Fully Settled' ? 'bg-emerald-600' : statusText === 'Partially Settled' ? 'bg-sky-600' : 'bg-amber-600')} />
                                  {statusText}
                                </span>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 italic text-xs">
                        No ledger transactions found for the selected party.
                      </td>
                    </tr>
                  )}
                </tbody>
                {partyLedgerRecords.length > 0 && (
                  <tfoot>
                    <tr className="bg-purple-50 font-black text-xs text-purple-950 border-t-2 border-purple-200">
                      <td colSpan={6} className="p-2.5 text-right uppercase tracking-wider">
                        Consolidated Ledger Total:
                      </td>
                      <td className="p-2.5 text-right font-black text-slate-900">
                        ₹ {partyTotalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5 text-right font-black text-emerald-800">
                        ₹ {partyTotalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5 text-right font-black text-amber-900">
                        ₹ {partyTotalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2.5"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div className="mt-2">
              <PaginationControls
                currentPage={ledgerCurrentPage}
                totalItems={partyLedgerRecords.length}
                pageSize={ledgerPageSize}
                onPageChange={setLedgerCurrentPage}
                onPageSizeChange={setLedgerPageSize}
              />
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT ENTRY FORM VIEW */}
      {viewMode === 'entry' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
                <Wallet className="w-5 h-5 text-purple-600" />
                {isEdit ? 'Edit Payment Voucher' : 'New Payment Voucher Entry'}
              </h3>
              <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded border border-purple-200">
                Voucher: {masterData.voucher_no}
              </span>
            </div>

            {/* CONTRACT P.O & VERIFIED M.R REFERENCE PANEL */}
            <div className="bg-gradient-to-r from-slate-50 via-purple-50/50 to-indigo-50/50 p-3.5 rounded-xl border border-purple-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-purple-200/60 pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-700" />
                  <span className="text-xs font-black uppercase text-purple-950 tracking-wide">
                    P.O & Linked Verified M.R Reference
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold">
                  <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded border border-purple-200">
                    {eligiblePos.length} Eligible P.O Records (Pending Payment)
                  </span>
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                    {availableArrivals.length} Unpaid M.R Records ({verifiedArrivals.length} Total Verified)
                  </span>
                </div>
              </div>

              {/* PO and Inspection Selector Logic */}
              {(() => {
                const displayPos = showAllPos ? purchaseOrders : eligiblePos;

                const selectedArrival = verifiedArrivals.find(a => (a.mr_no === selectedMrNo || a.final_arrival_no === selectedMrNo));
                const inspectionPoNo = selectedArrival?.po_no || selectedArrival?.mill_po_no || '';
                const matchedFinalPo = inspectionPoNo ? findMatchingPo(inspectionPoNo, purchaseOrders) : null;
                const matchedScpPo = (!matchedFinalPo && inspectionPoNo) ? findMatchingPo(inspectionPoNo, saudaCheckPoints) : null;
                const isPoNotInFinal = Boolean(selectedMrNo && inspectionPoNo && !matchedFinalPo);

                return (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* P.O Selector */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase text-purple-900">
                          <label className="flex items-center gap-1.5">
                            <span>P.O</span>
                            {selectedPoNo && <span className="text-purple-700 font-mono font-bold">({selectedPoNo})</span>}
                          </label>
                          <span className="text-[10px] font-semibold text-purple-700">
                            {eligiblePos.length} Pending Payment
                          </span>
                        </div>
                        <SearchablePoSelect
                          selectedPoNo={selectedPoNo}
                          onSelectPo={handlePoSelection}
                          displayPos={eligiblePos}
                          matchedFinalPo={matchedFinalPo}
                          isPoEligibleForPayment={isPoEligibleForPaymentLocal}
                          verifiedArrivals={verifiedArrivals}
                          paymentList={paymentList}
                          currentVoucherNo={isEdit ? masterData.voucher_no : undefined}
                        />
                      </div>

                      {/* Verified M.R & Inspection Selector */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-emerald-900 flex items-center justify-between">
                          <span>Inspection</span>
                          {selectedMrNo && <span className="text-emerald-700 font-mono font-bold">M.R: {selectedMrNo}</span>}
                        </label>
                        <SearchableMrSelect
                          selectedMrNo={selectedMrNo}
                          onSelectMr={handleMrSelection}
                          verifiedArrivals={availableArrivals}
                          allArrivals={verifiedArrivals}
                          selectedPoNo={selectedPoNo}
                        />
                      </div>
                    </div>

                    {/* Notice if Inspection P.O is in Check Point and not in P.O list */}
                    {isPoNotInFinal && (
                      <div className="p-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-start gap-2 shadow-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <div className="font-bold flex items-center gap-2">
                            <span>Inspection P.O ({inspectionPoNo}) is NOT in P.O list yet</span>
                            <span className="bg-amber-200 text-amber-900 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                              Status: In Sauda Check Point
                            </span>
                          </div>
                          <div className="text-[11px] text-amber-800 mt-0.5">
                            {matchedScpPo ? (
                              <span>
                                This P.O is currently located in <strong>Sauda Check Point / Temporary P.O</strong> (Sauda: {matchedScpPo.sauda_no || matchedScpPo.po_no}). Once mismatches are cleared and approved in Sauda Check Point, click <strong>"Pass ✓"</strong> to promote it to P.O.
                              </span>
                            ) : (
                              <span>
                                This P.O has not yet been passed/promoted to <strong>P.O</strong> (purchase_master). You can still proceed with Inspection details, or select an existing P.O using "Show All".
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Active PO / MR Summary Linkage Banner */}
              {(selectedPoData || selectedMrNo || masterData.po_no || masterData.mr_no) ? (
                <div className="bg-white/90 p-2.5 rounded-lg border border-purple-200 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-700 shadow-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-slate-900 text-[11px]">Contract Active Linkage:</span>
                    {masterData.po_no && (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-900 font-mono font-bold rounded border border-purple-300 text-[10px]">
                        P.O: {masterData.po_no}
                      </span>
                    )}
                    {masterData.mr_no && (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-mono font-bold rounded border border-emerald-300 text-[10px]">
                        M.R: {masterData.mr_no}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] flex-wrap">
                    <div><span className="text-slate-400">Supplier:</span> <strong className="text-slate-900">{masterData.supplier || masterData.party_name || '-'}</strong></div>
                    <div><span className="text-slate-400">Broker:</span> <strong className="text-slate-900">{masterData.broker || '-'}</strong></div>
                    <div><span className="text-slate-400">Lorry / Vehicle:</span> <strong className="text-slate-900">{masterData.lorry_number || '-'}</strong></div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50/90 p-2 rounded-lg border border-amber-200 text-xs flex items-center gap-2 text-amber-800 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Please select a <strong>P.O</strong> or <strong>Inspection</strong> record. At least one selection is required to save a payment record.</span>
                </div>
              )}
            </div>

            {/* Header Form Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <label htmlFor="voucher_no_1963" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Voucher No *</label>
                <input
 id="voucher_no_1963" name="voucher_no" aria-label="Voucher No *"                  type="text"
                  value={masterData.voucher_no}
                  onChange={e => setMasterData({ ...masterData, voucher_no: e.target.value })}
                  className="w-full p-2 font-mono font-bold border border-slate-300 rounded bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="payment_date_1973" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Payment Date *</label>
                <input
 id="payment_date_1973" name="payment_date" aria-label="Payment Date *"                  type="date"
                  value={masterData.payment_date}
                  onChange={e => setMasterData({ ...masterData, payment_date: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label htmlFor="selected_m_r_no_1983" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Selected M.R No</label>
                <input
 id="selected_m_r_no_1983" name="selected_m_r_no" aria-label="Selected M.R No"                  type="text"
                  value={masterData.mr_no || selectedMrNo}
                  onChange={e => {
                    setMasterData({ ...masterData, mr_no: e.target.value });
                    setSelectedMrNo(e.target.value);
                  }}
                  placeholder="M.R / Arrival No"
                  className="w-full p-2 border border-slate-300 rounded bg-emerald-50/40 font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label htmlFor="selected_p_o_no_1997" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Selected P.O No</label>
                <input
 id="selected_p_o_no_1997" name="selected_p_o_no" aria-label="Selected P.O No"                  type="text"
                  value={masterData.po_no || selectedPoNo}
                  onChange={e => {
                    setMasterData({ ...masterData, po_no: e.target.value });
                    setSelectedPoNo(e.target.value);
                  }}
                  placeholder="Purchase Order No"
                  className="w-full p-2 border border-slate-300 rounded bg-purple-50/40 font-mono font-bold text-slate-800"
                />
              </div>

              <div>
                <label htmlFor="party_supplier_name_2011" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Party / Supplier Name *</label>
                <input
 id="party_supplier_name_2011" name="party_supplier_name" aria-label="Party / Supplier Name *"                  type="text"
                  value={masterData.party_name || masterData.supplier}
                  onChange={e => setMasterData({ ...masterData, party_name: e.target.value, supplier: e.target.value })}
                  placeholder="Supplier / Party Name"
                  className="w-full p-2 border border-slate-300 rounded font-semibold"
                />
              </div>

              <div>
                <label htmlFor="broker_name_2022" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Broker Name</label>
                <input
 id="broker_name_2022" name="broker_name" aria-label="Broker Name"                  type="text"
                  value={masterData.broker}
                  onChange={e => setMasterData({ ...masterData, broker: e.target.value })}
                  placeholder="Broker Name"
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label htmlFor="payment_mode_2033" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Payment Mode</label>
                <select
 id="payment_mode_2033" name="payment_mode" aria-label="Payment Mode"                  value={masterData.payment_mode}
                  onChange={e => setMasterData({ ...masterData, payment_mode: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded"
                >
                  <option value="Bank Transfer (NEFT/RTGS)">Bank Transfer (NEFT/RTGS)</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Demand Draft">Demand Draft</option>
                </select>
              </div>

              <div>
                <label htmlFor="ref_utr_cheque_no_2048" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Ref / UTR / Cheque No</label>
                <input
 id="ref_utr_cheque_no_2048" name="ref_utr_cheque_no" aria-label="Ref / UTR / Cheque No"                  type="text"
                  value={masterData.reference_no}
                  onChange={e => setMasterData({ ...masterData, reference_no: e.target.value })}
                  placeholder="Transaction Reference No"
                  className="w-full p-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div >
                <label className="block text-[10px] font-black uppercase text-purple-900 mb-1 flex items-center justify-between">
                  <span>Advance Payment Done? *</span>
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase",
                    (masterData.advance_payment_done || 'No') === 'Yes'
                      ? "bg-green-100 text-green-800"
                      : "bg-slate-200 text-slate-700"
                  )}>
                    {(masterData.advance_payment_done || 'No') === 'Yes' ? 'ADVANCE DONE' : 'NO ADVANCE'}
                  </span>
                </label>
                <select id="masterdata_advance_paymen_2069" name="masterdata_advance_paymen" aria-label="masterdata advance paymen" value={masterData.advance_payment_done || 'No'}
                  onChange={e => setMasterData({ ...masterData, advance_payment_done: e.target.value })}
                  className={cn(
                    "w-full p-2 border rounded font-black text-xs transition-colors",
                    (masterData.advance_payment_done || 'No') === 'Yes'
                      ? "bg-green-50 text-green-950 border-green-400 focus:ring-2 focus:ring-green-500"
                      : "bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-purple-500"
                  )}
                >
                  <option value="No">No </option>
                  <option value="Yes">Yes </option>
                </select>
              </div>
              <div >
                <label className="block text-[10px] font-black uppercase text-purple-900 mb-1 flex items-center justify-between">
                  <span>Payment from</span>
                  {/* <span className={cn(
                    "text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase",
                    (masterData.advance_payment_done || 'No') === 'Yes'
                      ? "bg-green-100 text-green-800"
                      : "bg-slate-200 text-slate-700"
                  )}>
                    {(masterData.advance_payment_done || 'No') === 'Yes' ? 'ADVANCE DONE' : 'NO ADVANCE'}
                  </span> */}
                </label>
                <select id="masterdata_advance_paymen_from" name="masterdata_advance_paymen_from" aria-label="masterdata advance paymen"value={masterData.advance_payment_from || '1'}
                  onChange={e => setMasterData({ ...masterData, advance_payment_from: e.target.value })}
                  className="w-full p-2 border rounded font-black text-xs transition-colors"
                >
                  <option value="1">From Bank </option>
                  <option value="2">RXIL </option>
                  <option value="3">TReDS </option>
                  <option value="4">Invoice Mart </option>
                </select>
              </div>
              {masterData.advance_payment_from!=='1' &&(
                <>
                <div>
                  <label htmlFor="payment_settle_date_1973" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Payment Settlement Date *</label>
                  <input id="payment_settle_date_1973" name="payment_settle_date" aria-label="Payment settle Date *"type="date"
                    value={masterData.payment_settlementdate}
                    onChange={e => setMasterData({ ...masterData, payment_settlementdate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label htmlFor="tenor_2048" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Tenor</label>
                  <input id="tenor_2048" name="ref_utr_cheque_no" aria-label="tenor" type="text"
                    value={masterData.tenor}
                    //onChange={e => setMasterData({ ...masterData, tenor: e.target.value })}
                    onChange={(e) => handelTnordate(e, masterData)}
                    placeholder="Transaction Reference No"
                    className="w-full p-2 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="repayment_date_1973" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Repayment Date </label>
                  <input
                    id="repayment_date_1973"
                    name="repayment_date"
                    aria-label="Repayment Date"
                    type="date"
                    value={masterData.repayment_date || ""}
                    className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-purple-500"
                    readOnly={true}
                  />
                </div>
                </>
              )}
            </div>

            {/* Financial Amounts & Settlement Panel */}
            <div className="p-3 bg-gradient-to-r from-slate-50 via-purple-50/20 to-amber-50/20 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              {/* Payable Net Amount */}
              <div>
                <label htmlFor="payable_net_amount_2222" className="block text-[10px] font-bold uppercase text-slate-700 mb-1">
                  Payable Net Amount (₹)
                </label>
                <input
 id="payable_net_amount_2222" name="payable_net_amount" aria-label="Payable Net Amount (₹)"                  type="number"
                  step="0.01"
                  value={masterData.payable_amt}
                  onChange={e => {
                    const val = parseFloat(e.target.value) || 0;
                    const defaultPaid = calculate93PctPaidAmount(val);
                    setMasterData({
                      ...masterData,
                      payable_amt: val,
                      total_amount: val,
                      paid_amount: defaultPaid
                    });
                  }}
                  className="w-full p-2 font-black text-sm border border-slate-300 rounded bg-white text-slate-900 shadow-xs focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-[10px] text-slate-500 font-medium">
                  Full Invoice Value: {formatIndianCurrency(masterData.payable_amt)}
                </span>
              </div>

              {/* Paid Amount (93% Default) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold uppercase text-emerald-900">
                    Paid Amount (₹)
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const p = calculate93PctPaidAmount(masterData.payable_amt || 0);
                        setMasterData({ ...masterData, paid_amount: p });
                      }}
                      className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 transition-colors"
                      title="Apply 93% standard payment (floor rounded to nearest ₹1,000)"
                    >
                      93% (Floor ₹1K)
                    </button>
                  </div>
                </div>
                <input
 id="masterdata_paid_amount_2261" name="masterdata_paid_amount" aria-label="masterdata paid amount"                  type="number"
                  step="0.01"
                  value={masterData.paid_amount}
                  onChange={e => setMasterData({ ...masterData, paid_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2 font-black text-sm border border-emerald-400 rounded bg-emerald-50/70 text-emerald-950 focus:ring-2 focus:ring-emerald-500 shadow-xs"
                />
                <span className="text-[10px] text-emerald-700 font-bold">
                  {masterData.payable_amt > 0
                    ? `${formatIndianCurrency(masterData.paid_amount)} (${((masterData.paid_amount / masterData.payable_amt) * 100).toFixed(1)}% of bill)`
                    : '93% Default Payment (Floor ₹1,000)'}
                </span>
              </div>

              {/* Pending Balance for Final Settlement (7% Retention) */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50/80 p-2.5 rounded-lg border border-amber-300 flex flex-col justify-between shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-amber-900 tracking-wider flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                    Pending Amount
                  </span>
                  <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 border border-amber-300">
                    {masterData.payable_amt > 0
                      ? `${(((masterData.payable_amt - masterData.paid_amount) / masterData.payable_amt) * 100).toFixed(1)}%`
                      : '7.0%'}
                  </span>
                </div>
                <div className="text-base font-black text-amber-950 font-mono my-0.5">
                  {formatIndianCurrency(Math.max(0, masterData.payable_amt - masterData.paid_amount))}
                </div>
                <span className="text-[9.5px] text-amber-800 font-semibold leading-tight">
                  Retention for Final Settlement
                </span>
              </div>

              {/* Bill / Invoice No */}
              <div>
                <label htmlFor="bill_invoice_no_2299" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Bill / Invoice No</label>
                <input
 id="bill_invoice_no_2299" name="bill_invoice_no" aria-label="Bill / Invoice No"                  type="text"
                  value={masterData.payable_bill_no}
                  onChange={e => setMasterData({ ...masterData, payable_bill_no: e.target.value })}
                  placeholder="Supplier Bill No"
                  className="w-full p-2 border border-slate-300 rounded font-semibold focus:ring-1 focus:ring-purple-500"
                />
                <span className="text-[10px] text-slate-400 font-medium">Invoice Reference</span>
              </div>

              {/* Remarks */}
              <div>
                <label htmlFor="remarks_2312" className="block text-[10px] font-bold uppercase text-slate-600 mb-1">Remarks</label>
                <input
 id="remarks_2312" name="remarks" aria-label="Remarks"                  type="text"
                  value={masterData.remarks}
                  onChange={e => setMasterData({ ...masterData, remarks: e.target.value })}
                  placeholder="Payment Remarks"
                  className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-purple-500"
                />
                <span className="text-[10px] text-slate-400 font-medium">Optional Payment Notes</span>
              </div>
            </div>

            {/* 4-Column Specification Grid */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-2.5 bg-slate-100 border-b border-slate-200 text-xs font-black uppercase text-slate-800 flex items-center justify-between">
                <span>Material Grade Details (Optional Breakdown)</span>
                <span className="text-[10px] font-semibold text-slate-500">4 Column Specification Matrix</span>
              </div>
              <div className="p-3 overflow-x-auto">
                <datalist id="grade-options-list">
                  {gradeMasterList.map((g, i) => (
                    <option key={i} value={g.grade_name}>{g.grade_code ? `${g.grade_code} - ${g.grade_name}` : g.grade_name}</option>
                  ))}
                </datalist>
                <datalist id="area-options-list">
                  {areaMasterList.map((a, i) => (
                    <option key={i} value={a.area_name}>{a.area_code ? `${a.area_code} - ${a.area_name}` : a.area_name}</option>
                  ))}
                </datalist>
                <datalist id="agency-options-list">
                  {agencyMasterList.map((ag, i) => (
                    <option key={i} value={ag.agency_name}>{ag.agency_code ? `${ag.agency_code} - ${ag.agency_name}` : ag.agency_name}</option>
                  ))}
                </datalist>

                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b text-[10px] uppercase font-bold text-slate-600">
                      <th className="p-2 w-10">Col</th>
                      <th className="p-2">Grade</th>
                      <th className="p-2">Area</th>
                      <th className="p-2">Agency</th>
                      <th className="p-2 w-20">Packets / Qty</th>
                      <th className="p-2 w-24">Weight (MT)</th>
                      <th className="p-2 w-24">Rate (₹/Qtl)</th>
                      <th className="p-2 w-20 bg-emerald-50/70 text-emerald-800">Sett (%)</th>
                      <th className="p-2 w-24 bg-amber-50/70 text-amber-900">Deduction (₹/Qtl)</th>
                      <th className="p-2 w-24 bg-blue-50/70 text-blue-900">Sett Rate (₹/Qtl)</th>
                      <th className="p-2 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailCols.map((col, idx) => {
                      const settPct = getColSettPct(col);
                      const deduction = getColDeduction(col);
                      const settRate = getColSettRate(col);
                      const qtyQtl = getColQtyQtl(col);
                      const rowAmount = getColAmount(col);

                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-500">{col.col_index}</td>
                          <td className="p-2">
                            <input
                              id={`rep_grade_col_${idx}`}
                              name={`rep_grade_col_${idx}`}
                              aria-label="Grade"
                              type="text"
                              list="grade-options-list"
                              value={col.grade}
                              readOnly
                              placeholder="Grade (e.g. TD5)"
                              className="w-full p-1 border border-slate-200 bg-slate-100 text-slate-500 rounded text-xs font-semibold cursor-not-allowed"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              id={`rep_area_col_${idx}`}
                              name={`rep_area_col_${idx}`}
                              aria-label="Area"
                              type="text"
                              list="area-options-list"
                              value={col.area}
                              readOnly
                              placeholder="Area (e.g. DAISEE)"
                              className="w-full p-1 border border-slate-200 bg-slate-100 text-slate-500 rounded text-xs font-semibold cursor-not-allowed"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              id={`rep_agency_col_${idx}`}
                              name={`rep_agency_col_${idx}`}
                              aria-label="Agency"
                              type="text"
                              list="agency-options-list"
                              value={col.agency}
                              readOnly
                              placeholder="Agency (e.g. AMBAGAN)"
                              className="w-full p-1 border border-slate-200 bg-slate-100 text-slate-500 rounded text-xs font-semibold cursor-not-allowed"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              id={`rep_quantity_col_${idx}`}
                              name={`rep_quantity_col_${idx}`}
                              aria-label="Col quantity"
                              type="number"
                              value={col.quantity || ''}
                              onChange={e => {
                                const updated = [...detailCols];
                                updated[idx].quantity = parseFloat(e.target.value) || 0;
                                setDetailCols(updated);
                              }}
                              className="w-20 p-1 border rounded text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              id={`rep_arr_qty_wt_col_${idx}`}
                              name={`rep_arr_qty_wt_col_${idx}`}
                              aria-label="Col Weight MT"
                              type="number"
                              step="0.001"
                              value={col.arr_qty_wt || ''}
                              onChange={e => {
                                const updated = [...detailCols];
                                const newWt = parseFloat(e.target.value) || 0;
                                updated[idx].arr_qty_wt = newWt;
                                const qQtl = Number((newWt * 10).toFixed(3));
                                const sRate = getColSettRate(updated[idx]);
                                updated[idx].quantity_qtl = qQtl;
                                updated[idx].sett_rate = sRate;
                                updated[idx].deduction_rate = getColDeduction(updated[idx]);
                                updated[idx].amount = Number((qQtl * sRate).toFixed(2));
                                setDetailCols(updated);
                                const newTotal = updated.reduce((sum, c) => sum + getColAmount(c), 0);
                                if (newTotal > 0) {
                                  const newPaid = calculate93PctPaidAmount(newTotal);
                                  setMasterData(prev => ({
                                    ...prev,
                                    total_amount: newTotal,
                                    payable_amt: newTotal,
                                    net_amt: newTotal,
                                    paid_amount: newPaid
                                  }));
                                }
                              }}
                              className="w-24 p-1 border rounded text-xs font-mono"
                            />
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                              {qtyQtl > 0 ? `${qtyQtl} Qtl` : ''}
                            </div>
                          </td>
                          <td className="p-2">
                            <input
                              id={`rep_rate_value_col_${idx}`}
                              name={`rep_rate_value_col_${idx}`}
                              aria-label="Col Original Rate"
                              type="number"
                              step="0.01"
                              value={col.rate_value || ''}
                              onChange={e => {
                                const updated = [...detailCols];
                                const newRate = parseFloat(e.target.value) || 0;
                                updated[idx].rate_value = newRate;
                                const sPct = getColSettPct(updated[idx]);
                                const ded = getColDeduction(updated[idx]);
                                const sRate = Math.max(0, Number((newRate - ded).toFixed(2)));
                                const qQtl = getColQtyQtl(updated[idx]);
                                updated[idx].deduction_rate = ded;
                                updated[idx].sett_rate = sRate;
                                updated[idx].quantity_qtl = qQtl;
                                updated[idx].amount = Number((qQtl * sRate).toFixed(2));
                                setDetailCols(updated);
                                const newTotal = updated.reduce((sum, c) => sum + getColAmount(c), 0);
                                if (newTotal > 0) {
                                  const newPaid = calculate93PctPaidAmount(newTotal);
                                  setMasterData(prev => ({
                                    ...prev,
                                    total_amount: newTotal,
                                    payable_amt: newTotal,
                                    net_amt: newTotal,
                                    paid_amount: newPaid
                                  }));
                                }
                              }}
                              className="w-24 p-1 border rounded text-xs font-mono"
                            />
                          </td>
                          {/* Sett (%) - populated from Inspection Details -> Grade Down % -> Claim */}
                          <td className="p-2 bg-emerald-50/30">
                            <div className="flex flex-col">
                              <input
                                id={`rep_sett_pct_col_${idx}`}
                                name={`rep_sett_pct_col_${idx}`}
                                aria-label="Settlement Percentage"
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={col.sett_pct !== undefined && col.sett_pct !== null ? col.sett_pct : ((col.gd_claim > 0 ? col.gd_claim : col.gd_sett) || '')}
                                onChange={e => {
                                  const updated = [...detailCols];
                                  const newSettPct = parseFloat(e.target.value) || 0;
                                  updated[idx].sett_pct = newSettPct;
                                  const origRate = Number(updated[idx].rate_value) || 0;
                                  const ded = getColDeduction(updated[idx]);
                                  const sRate = Math.max(0, Number((origRate - ded).toFixed(2)));
                                  const qQtl = getColQtyQtl(updated[idx]);
                                  updated[idx].deduction_rate = ded;
                                  updated[idx].sett_rate = sRate;
                                  updated[idx].quantity_qtl = qQtl;
                                  updated[idx].amount = Number((qQtl * sRate).toFixed(2));
                                  setDetailCols(updated);
                                  const newTotal = updated.reduce((sum, c) => sum + getColAmount(c), 0);
                                  if (newTotal > 0) {
                                    const newPaid = calculate93PctPaidAmount(newTotal);
                                    setMasterData(prev => ({
                                      ...prev,
                                      total_amount: newTotal,
                                      payable_amt: newTotal,
                                      net_amt: newTotal,
                                      paid_amount: newPaid
                                    }));
                                  }
                                }}
                                placeholder="0"
                                title={`Settlement % (Populated from Inspection Details Grade Down % Claim: ${col.gd_claim || 0}%)`}
                                className="w-16 p-1 border border-emerald-300 rounded text-xs font-bold text-center bg-white text-emerald-950 focus:ring-1 focus:ring-emerald-500"
                              />
                              {col.gd_claim > 0 && (
                                <span className="text-[9px] text-amber-700 font-semibold mt-0.5" title={`Inspection Details Grade Down % Claim: ${col.gd_claim}%`}>
                                  Claim: {col.gd_claim}%
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Deduction (₹/Qtl) = Settlement Basis (Original Rate) * Sett (%) / 100 */}
                          <td className="p-2 bg-amber-50/30">
                            <div 
                              className="w-24 p-1 rounded text-xs font-mono font-bold text-amber-900 bg-amber-100/60 text-right border border-amber-200 cursor-help"
                              title={getColDeductionExplanation(col) || `Deduction = ₹${deduction.toFixed(2)}/Qtl`}
                            >
                              ₹{deduction.toFixed(2)}
                            </div>
                          </td>
                          {/* Sett Rate (₹/Qtl) = Original Rate - Deduction */}
                          <td className="p-2 bg-blue-50/30">
                            <div 
                              className="w-24 p-1 rounded text-xs font-mono font-bold text-blue-900 bg-blue-100/60 text-right border border-blue-200"
                              title={`Sett Rate = ₹${(Number(col.rate_value) || 0).toFixed(2)} − ₹${deduction.toFixed(2)} = ₹${settRate.toFixed(2)}/Qtl`}
                            >
                              ₹{settRate.toFixed(2)}
                            </div>
                          </td>
                          {/* Amount (₹) = Quantity (Qtl) * Sett Rate (₹/Qtl) */}
                          <td className="p-2 text-right">
                            <div 
                              className="font-bold text-slate-800 text-xs font-mono"
                              title={`${qtyQtl.toFixed(2)} Qtl × ₹${settRate.toFixed(2)}/Qtl = ₹${rowAmount.toFixed(2)}`}
                            >
                              {formatIndianCurrency(rowAmount)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inline Error Message */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between text-red-800 text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                <button onClick={() => setErrorMessage('')} className="p-1 hover:bg-red-100 rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => { setViewMode('dashboard'); setMasterData(initialMaster()); }}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePayment}
                disabled={loading}
                className="px-5 py-2 text-xs font-black text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving...' : 'Save Payment Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Animation */}
      <AnimatePresence>
        {showSuccessAnim && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center space-y-3">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-black text-slate-900">Payment Saved Successfully</h3>
              <p className="text-xs text-slate-500">
                Payment Record synced directly to `payment_master` table.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
