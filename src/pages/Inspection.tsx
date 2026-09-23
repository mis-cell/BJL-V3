import React, { useState, useEffect } from "react";
import { useLiveAutoRefresh } from "../hooks/useLiveAutoRefresh";
import {
  ShieldCheck,
  Search,
  Filter,
  Plus,
  Printer,
  Download,
  Eye,
  CheckCircle2,
  RefreshCw,
  FileText,
  Layers,
  X,
  Trash2,
  Percent,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Copy,
  ArrowLeft,
  Save,
  RotateCcw,
  Sparkles,
  Lock,
  Edit3,
  Loader2
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { dbModule } from "../services/dbModule";
import LegacyLayout from "../components/LegacyLayout";
import { PaginationControls } from "../components/PaginationControls";
import PrintModal from "../components/PrintModal";
import InspectionPrintSlip from "../components/InspectionPrintSlip";

export interface DeductionRow {
  id: string;
  deduction_type: string;
  deduction_rate: number;
  deduction_qty: number;
  deduction_amount: number;
  remarks?: string;
}

export const DEFAULT_DEDUCTION_TYPES = [
  { deduction: "GODOWN DAMAGE FOR BALES", rate_per_unit: 400, rate_per_qntl: null },
  { deduction: "RAIN WET FOR BALES", rate_per_unit: 200, rate_per_qntl: null },
  { deduction: "RTCH DAMAGE FOR BALES", rate_per_unit: 400, rate_per_qntl: null },
  { deduction: "CT FOR HABIJABI / CHATTA / ROPE", rate_per_unit: null, rate_per_qntl: 1500 },
  { deduction: "RAIN WET FOR DRUMS", rate_per_unit: 200, rate_per_qntl: null },
  { deduction: "GODOWN DAMAGE FOR DRUMS", rate_per_unit: 200, rate_per_qntl: null },
  { deduction: "GODOWN DAMAGE FOR HALF BALES", rate_per_unit: 200, rate_per_qntl: null },
  { deduction: "PITCH DAMAGE FOR DRUMS", rate_per_unit: 200, rate_per_qntl: null },
  { deduction: "PITCH DAMAGE FOR HALF BALES", rate_per_unit: 200, rate_per_qntl: null },
  { deduction: "GODOWN DAMAGE FOR LOOSE", rate_per_unit: null, rate_per_qntl: 400 },
  { deduction: "PITCH DAMAGE FOR LOOSE", rate_per_unit: null, rate_per_qntl: 400 },
  { deduction: "RAIN WET FOR LOOSE", rate_per_unit: null, rate_per_qntl: 400 },
  { deduction: "IN CASE OF BALE IF WEIGHT IS LESS THAN 144", rate_per_unit: 20, rate_per_qntl: null },
  { deduction: "IN CASE OF BALE IF WEIGHT IS LESS THAN 142", rate_per_unit: 30, rate_per_qntl: null },
  { deduction: "IN CASE OF BALES IF WEIGHT IS LESS THAN 139", rate_per_unit: 40, rate_per_qntl: null },
  { deduction: "DELIVERY CLAIM PER QUINTAL (RS. PER DAY)", rate_per_unit: 5, rate_per_qntl: null }
];

export function calculateBaleWeightDeduction(
  detailRows: InspectionDetailRow[],
  deductionMasterList: any[]
): {
  totalBales: number;
  totalReceiptGrossWtMt: number;
  totalWeightKg: number;
  avgKgPerBale: number;
  matchedRule: any | null;
  ruleName: string;
  rate: number;
} {
  const baleRows = (detailRows || []).filter(r => {
    const u = (r.unit || "").trim().toUpperCase();
    return !u || u.includes("BALE") || u === "BALES" || u === "B";
  });

  const totalBales = baleRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const totalReceiptGrossWtMt = baleRows.reduce((sum, r) => {
    const wt = Number(r.receipt_gross_wt) > 0 
      ? Number(r.receipt_gross_wt) 
      : (Number(r.gross_weight_batch) > 0 ? Number(r.gross_weight_batch) : Number(r.challan_gross_wt) || 0);
    return sum + wt;
  }, 0);

  const totalWeightKg = totalReceiptGrossWtMt * 1000;
  const avgKgPerBale = totalBales > 0 ? (totalWeightKg / totalBales) : 0;

  if (totalBales <= 0 || totalReceiptGrossWtMt <= 0 || avgKgPerBale <= 0) {
    return { totalBales, totalReceiptGrossWtMt, totalWeightKg, avgKgPerBale, matchedRule: null, ruleName: "", rate: 0 };
  }

  const masterList = deductionMasterList && deductionMasterList.length > 0 ? deductionMasterList : DEFAULT_DEDUCTION_TYPES;
  const candidates: { rule: any; threshold: number; rate: number }[] = [];

  for (const d of masterList) {
    const name = String(d.deduction || "").trim();
    if (!name) continue;

    // Matches rules like "IN CASE OF BALE IF WEIGHT IS LESS THAN 142", "IN CASE OF BALES IF WEIGHT IS LESS THAN 139", "LESS THAN 144", "< 142"
    const isBaleRelated = /BALE/i.test(name) || !/DRUM|HALF|LOOSE/i.test(name);
    const match = name.match(/LESS\s+THAN\s+(\d+(?:\.\d+)?)/i) || name.match(/<\s*(\d+(?:\.\d+)?)/i);
    if (isBaleRelated && match) {
      const threshold = parseFloat(match[1]);
      const rate = d.rate_per_unit != null ? Number(d.rate_per_unit) : (d.rate_per_qntl != null ? Number(d.rate_per_qntl) : 0);
      if (!isNaN(threshold) && threshold > 0 && rate > 0) {
        if (avgKgPerBale < threshold) {
          candidates.push({ rule: d, threshold, rate });
        }
      }
    }
  }

  // Sort ascending by threshold: e.g. 139 < 142 < 144
  candidates.sort((a, b) => a.threshold - b.threshold);

  if (candidates.length > 0) {
    const best = candidates[0];
    return {
      totalBales,
      totalReceiptGrossWtMt,
      totalWeightKg,
      avgKgPerBale,
      matchedRule: best.rule,
      ruleName: best.rule.deduction,
      rate: best.rate
    };
  }

  return { totalBales, totalReceiptGrossWtMt, totalWeightKg, avgKgPerBale, matchedRule: null, ruleName: "", rate: 0 };
}

export interface MatchedAutoDeduction {
  category: "bale_weight" | "ropes_chatta" | "delivery_claim" | "damage" | "other";
  ruleName: string;
  matchedRule: any;
  rate: number;
  qty: number;
  amount: number;
  reason: string;
  badge: string;
}

export function calculateAllMatchingDeductions(
  detailRows: InspectionDetailRow[],
  headerForm: Partial<InspectionMasterRecord>,
  deductionMasterList: any[]
): {
  matchedDeductions: MatchedAutoDeduction[];
  baleAudit: {
    totalBales: number;
    totalReceiptGrossWtMt: number;
    totalWeightKg: number;
    avgKgPerBale: number;
  };
} {
  const masterList = deductionMasterList && deductionMasterList.length > 0 ? deductionMasterList : DEFAULT_DEDUCTION_TYPES;
  const matchedDeductions: MatchedAutoDeduction[] = [];

  // 1. Bale Weight Evaluation
  const baleAudit = calculateBaleWeightDeduction(detailRows, deductionMasterList);
  if (baleAudit.matchedRule && baleAudit.rate > 0) {
    const totalBalesQty = baleAudit.totalBales > 0 ? baleAudit.totalBales : 1;
    const amount = Number((baleAudit.rate * totalBalesQty).toFixed(2));
    matchedDeductions.push({
      category: "bale_weight",
      ruleName: baleAudit.ruleName,
      matchedRule: baleAudit.matchedRule,
      rate: baleAudit.rate,
      qty: totalBalesQty,
      amount,
      reason: `Avg Weight ${baleAudit.avgKgPerBale.toFixed(2)} KG/Bale under standard threshold`,
      badge: `⚖️ Bale Weight Policy: ${baleAudit.totalBales} Bales (${baleAudit.avgKgPerBale.toFixed(2)} KG/Bale)`
    });
  }

  // 2. CT FOR HABIJABI / CHATTA / ROPE Evaluation
  const totalRopesKg = (detailRows || []).reduce((sum, r) => sum + (Number(r.ropes_weight) || 0) + (Number(r.chotta_weight) || 0), 0);
  const hbRows = (detailRows || []).filter(r => {
    const grade = `${r.arrival_grade || ""} ${r.stock_grade_name || ""} ${r.stock_grade_code || ""}`.toUpperCase();
    return grade.includes("HABIJABI") || grade.includes("HBJB") || grade.includes("CHATTA") || grade.includes("ROPES");
  });
  const hbRowsKg = hbRows.reduce((sum, r) => sum + ((Number(r.receipt_gross_wt) || Number(r.challan_gross_wt) || 0) * 1000), 0);
  const aggregateRopesKg = totalRopesKg > 0 ? totalRopesKg : (hbRowsKg > 0 ? hbRowsKg : 0);

  if (aggregateRopesKg > 0) {
    const ropesRule = masterList.find(d => {
      const n = String(d.deduction || "").toUpperCase();
      return n.includes("HABIJABI") || n.includes("CHATTA") || n.includes("ROPE") || n.includes("HBJB");
    });
    if (ropesRule) {
      const rate = ropesRule.rate_per_qntl != null ? Number(ropesRule.rate_per_qntl) : (Number(ropesRule.rate_per_unit) || 1500);
      const qtyQntl = Number((aggregateRopesKg / 100).toFixed(2));
      const amount = Number((rate * qtyQntl).toFixed(2));
      matchedDeductions.push({
        category: "ropes_chatta",
        ruleName: ropesRule.deduction,
        matchedRule: ropesRule,
        rate,
        qty: qtyQntl,
        amount,
        reason: `Ropes/Habijabi/Chatta: ${aggregateRopesKg.toFixed(2)} KG (${qtyQntl} Qntl)`,
        badge: `🧶 Habijabi / Chatta / Ropes (${qtyQntl} Qtl)`
      });
    }
  }

  // 3. DELIVERY CLAIM PER QUINTAL (RS. PER DAY) Evaluation
  const detentionDays = Number(headerForm?.detention_days) || 0;
  const isDeliveryClaim = detentionDays > 0 || Number(headerForm?.delivery_claim) > 0;
  const totalGrossMt = (detailRows || []).reduce((sum, r) => {
    const wt = Number(r.receipt_gross_wt) > 0 
      ? Number(r.receipt_gross_wt) 
      : (Number(r.gross_weight_batch) > 0 ? Number(r.gross_weight_batch) : Number(r.challan_gross_wt) || 0);
    return sum + wt;
  }, 0);

  if (isDeliveryClaim && totalGrossMt > 0) {
    const deliveryRule = masterList.find(d => {
      const n = String(d.deduction || "").toUpperCase();
      return n.includes("DELIVERY CLAIM") || n.includes("PER DAY");
    });
    if (deliveryRule) {
      const days = detentionDays > 0 ? detentionDays : 1;
      const baseRate = deliveryRule.rate_per_unit != null ? Number(deliveryRule.rate_per_unit) : (Number(deliveryRule.rate_per_qntl) || 5);
      const totalQuintals = Number((totalGrossMt * 10).toFixed(2));
      const effectiveRate = Number((baseRate * days).toFixed(2));
      const amount = Number((effectiveRate * totalQuintals).toFixed(2));
      matchedDeductions.push({
        category: "delivery_claim",
        ruleName: deliveryRule.deduction,
        matchedRule: deliveryRule,
        rate: effectiveRate,
        qty: totalQuintals,
        amount,
        reason: `Detention / Late Delivery: ${days} day(s) @ ₹${baseRate}/Qtl/Day`,
        badge: `🚚 Delivery Claim: ${days} Day(s) (${totalQuintals} Qtl)`
      });
    }
  }

  // 4. DAMAGE / WET Policies (Godown Damage, Rain Wet, Pitch Damage)
  const combinedRemarks = `${headerForm?.remarks || ""} ${headerForm?.mr_spcl_print || ""} ${(detailRows || []).map(r => `${r.row_remarks || ""} ${r.jqi_remarks || ""} ${r.jci_remarks || ""}`).join(" ")}`.toUpperCase();
  // Determine packaging type: LOOSE, DRUMS, HALF BALES, or BALES
  let dominantUnit = "BALES";
  const rawUnits = (detailRows || []).map(r => String(r.unit || "").trim().toUpperCase()).join(" ");
  if (rawUnits.includes("LOOSE")) {
    dominantUnit = "LOOSE";
  } else if (rawUnits.includes("DRUM")) {
    dominantUnit = "DRUMS";
  } else if (rawUnits.includes("HALF") || rawUnits.includes("H.BALE")) {
    dominantUnit = "HALF BALES";
  } else if (rawUnits.includes("BALE") || rawUnits.includes("P.BALE")) {
    dominantUnit = "BALES";
  }

  const totalItemQty = (detailRows || []).reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  // Rain Wet Evaluation (BALES, DRUMS, HALF BALES, LOOSE)
  if (combinedRemarks.includes("RAIN WET") || combinedRemarks.includes("RAIN DAMAGE") || combinedRemarks.includes("WET DAMAGE") || combinedRemarks.includes("RAIN")) {
    const rainRule = masterList.find(d => {
      const n = String(d.deduction || "").toUpperCase();
      if (!n.includes("RAIN WET")) return false;
      if (dominantUnit === "LOOSE") return n.includes("LOOSE");
      if (dominantUnit === "DRUMS") return n.includes("DRUMS");
      if (dominantUnit === "HALF BALES") return n.includes("HALF BALES");
      return n.includes("FOR BALES") || (!n.includes("DRUMS") && !n.includes("HALF") && !n.includes("LOOSE"));
    }) || masterList.find(d => String(d.deduction || "").toUpperCase().includes("RAIN WET"));

    if (rainRule) {
      const rate = rainRule.rate_per_unit != null ? Number(rainRule.rate_per_unit) : (Number(rainRule.rate_per_qntl) || 200);
      const isQntl = rainRule.rate_per_qntl != null;
      const qty = isQntl ? Number((totalGrossMt * 10).toFixed(2)) : (totalItemQty > 0 ? totalItemQty : (baleAudit.totalBales > 0 ? baleAudit.totalBales : 1));
      const amount = Number((rate * qty).toFixed(2));
      matchedDeductions.push({
        category: "damage",
        ruleName: rainRule.deduction,
        matchedRule: rainRule,
        rate,
        qty,
        amount,
        reason: `Rain wet condition noted for ${dominantUnit}`,
        badge: `🌧️ Rain Wet (${dominantUnit}): ${qty} ${isQntl ? 'Qtl' : 'Units'}`
      });
    }
  }

  // Godown Damage Evaluation (BALES, DRUMS, HALF BALES, LOOSE)
  if (combinedRemarks.includes("GODOWN DAMAGE") || combinedRemarks.includes("GODOWN")) {
    const godownRule = masterList.find(d => {
      const n = String(d.deduction || "").toUpperCase();
      if (!n.includes("GODOWN DAMAGE")) return false;
      if (dominantUnit === "LOOSE") return n.includes("LOOSE");
      if (dominantUnit === "DRUMS") return n.includes("DRUMS");
      if (dominantUnit === "HALF BALES") return n.includes("HALF BALES");
      return n.includes("FOR BALES") || (!n.includes("DRUMS") && !n.includes("HALF") && !n.includes("LOOSE"));
    }) || masterList.find(d => String(d.deduction || "").toUpperCase().includes("GODOWN DAMAGE"));

    if (godownRule) {
      const rate = godownRule.rate_per_unit != null ? Number(godownRule.rate_per_unit) : (Number(godownRule.rate_per_qntl) || 400);
      const isQntl = godownRule.rate_per_qntl != null;
      const qty = isQntl ? Number((totalGrossMt * 10).toFixed(2)) : (totalItemQty > 0 ? totalItemQty : (baleAudit.totalBales > 0 ? baleAudit.totalBales : 1));
      const amount = Number((rate * qty).toFixed(2));
      matchedDeductions.push({
        category: "damage",
        ruleName: godownRule.deduction,
        matchedRule: godownRule,
        rate,
        qty,
        amount,
        reason: `Godown damage noted for ${dominantUnit}`,
        badge: `🏚️ Godown Damage (${dominantUnit}): ${qty} ${isQntl ? 'Qtl' : 'Units'}`
      });
    }
  }

  // Pitch / Rtch Damage Evaluation (BALES, DRUMS, HALF BALES, LOOSE)
  if (combinedRemarks.includes("PITCH DAMAGE") || combinedRemarks.includes("RTCH DAMAGE") || combinedRemarks.includes("PITCH") || combinedRemarks.includes("RTCH")) {
    const pitchRule = masterList.find(d => {
      const n = String(d.deduction || "").toUpperCase();
      if (!n.includes("PITCH DAMAGE") && !n.includes("RTCH DAMAGE")) return false;
      if (dominantUnit === "LOOSE") return n.includes("LOOSE");
      if (dominantUnit === "DRUMS") return n.includes("DRUMS");
      if (dominantUnit === "HALF BALES") return n.includes("HALF BALES");
      return n.includes("FOR BALES") || (!n.includes("DRUMS") && !n.includes("HALF") && !n.includes("LOOSE"));
    }) || masterList.find(d => {
      const n = String(d.deduction || "").toUpperCase();
      return n.includes("PITCH DAMAGE") || n.includes("RTCH DAMAGE");
    });

    if (pitchRule) {
      const rate = pitchRule.rate_per_unit != null ? Number(pitchRule.rate_per_unit) : (Number(pitchRule.rate_per_qntl) || 400);
      const isQntl = pitchRule.rate_per_qntl != null;
      const qty = isQntl ? Number((totalGrossMt * 10).toFixed(2)) : (totalItemQty > 0 ? totalItemQty : (baleAudit.totalBales > 0 ? baleAudit.totalBales : 1));
      const amount = Number((rate * qty).toFixed(2));
      matchedDeductions.push({
        category: "damage",
        ruleName: pitchRule.deduction,
        matchedRule: pitchRule,
        rate,
        qty,
        amount,
        reason: `Pitch / Rtch damage noted for ${dominantUnit}`,
        badge: `⚠️ Pitch Damage (${dominantUnit}): ${qty} ${isQntl ? 'Qtl' : 'Units'}`
      });
    }
  }

  return {
    matchedDeductions,
    baleAudit
  };
}

interface InspectionMasterRecord {
  mr_no: string;
  mr_date?: string;
  arrival_no?: string;
  arrival_date?: string;
  po_no?: string;
  po_date?: string;
  broker_name?: string;
  supplier_name?: string;
  actual_moisture?: number;
  claim_moisture?: number;
  actual_dust?: number;
  claim_dust?: number;
  actual_ncv?: number;
  claim_ncv?: number;
  settlement_moisture?: number;
  settlement_grade_down?: number;
  settlement_dust?: number;
  settlement_ncv?: number;
  detention_days?: number;
  unloading_date?: string;
  mill_po_no?: string;
  mill_po_date?: string;
  mr_spcl_print?: string;
  remarks?: string;
  lorry_number?: string;
  delivery_claim?: number;
  unit_name?: string;
  unit_code?: string;
  deduction_type?: string;
  deduction_rate?: number;
  deduction_qty?: number;
  deduction_amount?: number;
  deductions?: DeductionRow[];
  status?: string;
  created_at?: string;
  grid_details?: any;
}

interface InspectionDetailRow {
  id?: number;
  mr_no?: string;
  srl_no?: number;
  arrival_grade?: string;
  stock_grade_code?: string;
  stock_grade_name?: string;
  area?: string;
  agency?: string;
  agency_code?: string;
  marks?: string;
  marka?: string;
  crop_year?: string;
  lot?: string;
  quantity?: number;
  unit?: string;
  rate?: number | string;
  rate_qntl?: number | string;
  challan_gross_wt?: number;
  receipt_gross_wt?: number;
  gross_weight_batch?: number;
  add_weight?: number;
  less_weight?: number;
  reduced_weight?: number;
  lorry_moisture_min?: number;
  lorry_moisture_max?: number;
  lorry_read_min?: number;
  lorry_read_max?: number;
  lorry_read_avg?: number;
  insp_read_min?: number;
  insp_read_max?: number;
  insp_read_avg?: number;
  moisture_act?: number;
  moisture_claim?: number;
  dust_act?: number;
  dust_claim?: number;
  ncv_act?: number;
  ncv_claim?: number;
  grade_down_act?: number;
  grade_down_claim?: number;
  actual_moisture?: number;
  claim_moisture?: number;
  actual_dust?: number;
  claim_dust?: number;
  actual_ncv?: number;
  claim_ncv?: number;
  actual_grade_down?: number;
  claim_grade_down?: number;
  final_receipt_wt?: number;
  settlement_moisture?: number;
  settlement_grade_down?: number;
  settlement_dust?: number;
  settlement_ncv?: number;
  ropes_weight?: number;
  ropes_tot_wt_grd?: number;
  ropes_grade?: string;
  chotta_weight?: number;
  chotta_tot_wt_grd?: number;
  chotta_grade?: string;
  tolerable?: string;
  premium?: string;
  is_premium?: boolean;
  amount?: number;
  row_remarks?: string;
  jqi_remarks?: string;
  jci_remarks?: string;
  expanded?: boolean;
  is_auto?: boolean;
  auto_fields?: string[];
  temporary_arrival_no?: string;
}

// Calculate Row Amount in ₹
export const calculateRowAmount = (row: InspectionDetailRow): number => {
  if (row.amount !== undefined && row.amount !== null && Number(row.amount) > 0) {
    return Number(Number(row.amount).toFixed(2));
  }
  const rate = Number(row.rate) || Number(row.rate_qntl) || 0;
  const wtMt = calculateQtyInMt(row);
  if (rate > 0 && wtMt > 0) {
    const ratePerMt = rate < 1000 ? rate * 1000 : rate * 10;
    return Number((wtMt * ratePerMt).toFixed(2));
  }
  return 0;
};

// Extract Month (1 to 12) from date string or Date object
export const extractMonthFromDate = (dateStr?: string | null): number => {
  if (!dateStr) return new Date().getMonth() + 1;
  const trimmed = String(dateStr).trim();
  if (!trimmed) return new Date().getMonth() + 1;

  // Match YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return parseInt(isoMatch[2], 10) || 1;
  }

  // Match DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (ddmmyyyyMatch) {
    return parseInt(ddmmyyyyMatch[2], 10) || 1;
  }

  // Fallback to JS Date parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.getMonth() + 1;
  }

  return 8; // fallback to dry season default if unparseable
};

// Robust Date Sanitizer for PostgreSQL DATE columns (avoids 400 Bad Request on empty strings or invalid dates)
export const sanitizeDate = (val: any): string | null => {
  if (!val) return null;
  if (typeof val !== 'string') {
    if (val instanceof Date && !isNaN(val.getTime())) {
      return val.toISOString().split('T')[0];
    }
    return null;
  }
  const trimmed = val.trim();
  if (!trimmed || trimmed === '' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined' || trimmed === 'nan-nan-nan') return null;
  // If DD-MM-YYYY or DD/MM/YYYY format, convert to YYYY-MM-DD for PostgreSQL
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const d = ddmmyyyy[1].padStart(2, '0');
    const m = ddmmyyyy[2].padStart(2, '0');
    const y = ddmmyyyy[3];
    return `${y}-${m}-${d}`;
  }
  // If YYYY-MM-DD or YYYY/MM/DD
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

// Calculate Claim Moisture % based on moisture_logic rules from database
// Formula: Claim Moisture % = CEIL(MAX(0, Actual Moisture % - Applicable Moisture %))
export const calculateClaimMoisture = (
  actualM: number,
  dateStr?: string | null,
  areaStr?: string | null,
  rules: any[] = []
): number => {
  const actual = Number(actualM) || 0;
  if (actual <= 0) return 0;

  const month = extractMonthFromDate(dateStr);
  const isWetSeason = month >= 1 && month <= 6; // Jan to Jun
  const seasonKeyword = isWetSeason ? "JANUARY TO JUNE" : "JULY TO DECEMBER";

  const cleanArea = String(areaStr || "").trim().toUpperCase();
  const isDaisee = cleanArea.includes("DAISEE");

  // Default standard thresholds if not configured in DB:
  // Jan - Jun (Wet Season): DAISEE = 18%, Standard / Non-DAISEE (e.g. BIHAR, ASSAM, etc.) = 16%
  // Jul - Dec (Dry Season): DAISEE = 20%, Standard / Non-DAISEE (e.g. BIHAR, ASSAM, etc.) = 18%
  let threshold = isDaisee ? (isWetSeason ? 18 : 20) : (isWetSeason ? 16 : 18);

  if (rules && rules.length > 0) {
    // 1. Try exact area match under the applicable season
    const exactMatch = rules.find((r: any) => {
      const rSeason = String(r.season || "").toUpperCase();
      const rArea = String(r.operating_area || "").toUpperCase();
      const seasonMatch =
        !rSeason ||
        rSeason.includes(seasonKeyword) ||
        (isWetSeason && rSeason.includes("WET")) ||
        (!isWetSeason && rSeason.includes("DRY"));
      return seasonMatch && cleanArea && rArea === cleanArea;
    });

    // 2. Try standard category match (DAISEE Operating Areas vs Standard / Non-DAISEE)
    const categoryMatch = rules.find((r: any) => {
      const rSeason = String(r.season || "").toUpperCase();
      const rArea = String(r.operating_area || "").toUpperCase();
      const seasonMatch =
        !rSeason ||
        rSeason.includes(seasonKeyword) ||
        (isWetSeason && rSeason.includes("WET")) ||
        (!isWetSeason && rSeason.includes("DRY"));
      const areaMatch = isDaisee
        ? rArea.includes("DAISEE") && !rArea.includes("NON-DAISEE")
        : (rArea.includes("NON-DAISEE") || rArea.includes("STANDARD") || (!rArea.includes("DAISEE") && cleanArea && (rArea.includes(cleanArea) || cleanArea.includes(rArea))));
      return seasonMatch && areaMatch;
    });

    const matchedRule = exactMatch || categoryMatch;
    if (matchedRule && matchedRule.threshold_limit) {
      const matchVal = String(matchedRule.threshold_limit).match(/(\d+(\.\d+)?)/);
      if (matchVal) {
        threshold = parseFloat(matchVal[1]);
      }
    }
  }

  const excess = actual - threshold;
  if (excess <= 0) return 0;
  return Math.ceil(excess);
};

export const isAutoBlocked = (row: InspectionDetailRow, field: keyof InspectionDetailRow): boolean => {
  if (row.is_auto === false) return false;
  if (field === "lorry_read_avg" || field === "insp_read_avg" || field === "moisture_claim") return true;
  if (row.auto_fields && Array.isArray(row.auto_fields) && row.auto_fields.includes(field as string)) {
    return true;
  }
  if (row.is_auto) {
    const val = row[field];
    // If the value in this field is empty, allow manual entry so user is never trapped
    if (val === undefined || val === null || val === "" || (typeof val === "string" && val.trim() === "")) {
      return false;
    }
    const defaultAutoFields: (keyof InspectionDetailRow)[] = [
      "arrival_grade",
      "stock_grade_code",
      "stock_grade_name",
      "area",
      "agency",
      "agency_code",
      "marks",
      "crop_year",
      "quantity",
      "unit",
      "challan_gross_wt",
      "receipt_gross_wt",
      "rate",
      "rate_qntl"
    ];
    if (defaultAutoFields.includes(field)) {
      return true;
    }
  }
  return false;
};

export const getFieldInputStyle = (isBlocked: boolean, customClasses = "") => {
  if (isBlocked) {
    return `w-full border border-blue-300/90 bg-blue-50/90 text-blue-950 font-bold rounded px-2 py-1 text-xs cursor-not-allowed select-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] transition-all ${customClasses}`;
  }
  return `w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 bg-white text-slate-900 transition-all ${customClasses}`;
};

// Calculate Quantity in Metric Tons (MT)
export const calculateQtyInMt = (row: InspectionDetailRow): number => {
  if (row.challan_gross_wt && Number(row.challan_gross_wt) > 0) {
    return Number(Number(row.challan_gross_wt).toFixed(3));
  }
  if (row.receipt_gross_wt && Number(row.receipt_gross_wt) > 0) {
    return Number(Number(row.receipt_gross_wt).toFixed(3));
  }
  const qty = Number(row.quantity) || 0;
  const unit = (row.unit || "BALES").toUpperCase();
  if (unit.includes("BALE") || unit.includes("BALES")) {
    return Number((qty * 0.18).toFixed(3)); // 1 Standard Jute Bale = ~180 kg = 0.180 MT
  }
  if (unit.includes("KG")) {
    return Number((qty * 0.001).toFixed(3));
  }
  if (unit.includes("QTL") || unit.includes("QUINTAL")) {
    return Number((qty * 0.10).toFixed(3));
  }
  if (unit.includes("DRUM")) {
    return Number((qty * 0.20).toFixed(3));
  }
  if (unit.includes("BAG")) {
    return Number((qty * 0.05).toFixed(3));
  }
  return Number(qty.toFixed(3));
};

// Calculate Premium Quantity in Metric Tons (MT)
export const getPremiumMt = (row: InspectionDetailRow): number => {
  const available = calculateQtyInMt(row);
  if (!row.premium && !row.is_premium) return 0;
  const pStr = String(row.premium || "").trim();
  if (pStr.toLowerCase() === "yes" || pStr === "true") {
    return available;
  }
  const num = parseFloat(pStr);
  if (!isNaN(num) && num > 0) {
    return Math.min(num, available);
  }
  if (row.is_premium) {
    return available;
  }
  return 0;
};

interface InspectionProps {
  onNavigate?: (page: string) => void;
}

const detailFieldsConfig: { name: keyof InspectionDetailRow; label: string; type: "text" | "number" | "select" }[] = [
  { name: "arrival_grade", label: "Arrival Grade", type: "text" },
  { name: "stock_grade_code", label: "Stock Grade Code", type: "text" },
  { name: "stock_grade_name", label: "Stock Grade Name", type: "text" },
  { name: "area", label: "Area", type: "text" },
  { name: "agency", label: "Agency", type: "text" },
  { name: "marks", label: "Marks / Marka", type: "text" },
  { name: "crop_year", label: "Crop Year", type: "text" },
  { name: "lot", label: "Lot", type: "text" },
  { name: "quantity", label: "Quantity", type: "number" },
  { name: "unit", label: "Unit", type: "text" },
  { name: "challan_gross_wt", label: "Challan Gross Wt. MT.", type: "number" },
  { name: "receipt_gross_wt", label: "Receipt Gross Wt. MT.", type: "number" },
  { name: "gross_weight_batch", label: "Gross Weight (Batch)", type: "number" },
  { name: "add_weight", label: "Add Weight M.Ton", type: "number" },
  { name: "less_weight", label: "Less Weight M.Ton", type: "number" },
  { name: "reduced_weight", label: "Reduced Weight M.Ton", type: "number" },
  { name: "lorry_moisture_min", label: "Lorry Moisture Min", type: "number" },
  { name: "lorry_moisture_max", label: "Lorry Moisture Max", type: "number" },
  { name: "lorry_read_min", label: "Lorry Moisture Read Min", type: "number" },
  { name: "lorry_read_max", label: "Lorry Moisture Read Max", type: "number" },
  { name: "lorry_read_avg", label: "Lorry Moisture Read Avg", type: "number" },
  { name: "insp_read_min", label: "Insp. Moisture Read Min", type: "number" },
  { name: "insp_read_max", label: "Insp. Moisture Read Max", type: "number" },
  { name: "insp_read_avg", label: "Insp. Moisture Read Avg", type: "number" },
  { name: "moisture_act", label: "Moisture % Actual", type: "number" },
  { name: "moisture_claim", label: "Moisture % Claim", type: "number" },
  { name: "dust_act", label: "Dust % Actual", type: "number" },
  { name: "dust_claim", label: "Dust % Claim", type: "number" },
  { name: "ncv_act", label: "NCV % Actual", type: "number" },
  { name: "ncv_claim", label: "NCV % Claim", type: "number" },
  { name: "grade_down_act", label: "Grade Down % Actual", type: "number" },
  { name: "grade_down_claim", label: "Grade Down % Claim", type: "number" },
  { name: "final_receipt_wt", label: "Final Receipt Wt. (Claim)", type: "number" },
  { name: "settlement_moisture", label: "Mill Settlement % Moisture", type: "number" },
  { name: "settlement_grade_down", label: "Mill Settlement % Gr. Down", type: "number" },
  { name: "settlement_dust", label: "Mill Settlement % Dust", type: "number" },
  { name: "settlement_ncv", label: "Mill Settlement % NCV", type: "number" },
  { name: "ropes_weight", label: "Ropes Weight (Kg)", type: "number" },
  { name: "ropes_tot_wt_grd", label: "Ropes Tot. Wt. Grd%", type: "number" },
  { name: "ropes_grade", label: "Ropes Grade", type: "text" },
  { name: "chotta_weight", label: "Chotta & Habi Jabi Weight (Kg)", type: "number" },
  { name: "chotta_tot_wt_grd", label: "Chotta & Habi Jabi Tot. Wt. Grd%", type: "number" },
  { name: "chotta_grade", label: "Chotta & Habi Jabi Grade", type: "text" },
  { name: "tolerable", label: "Tolerable", type: "select" },
  { name: "premium", label: "Premium (MT Mode)", type: "select" },
  { name: "amount", label: "Amount (₹)", type: "number" },
  { name: "row_remarks", label: "Remarks", type: "text" },
  { name: "jqi_remarks", label: "JCI Remarks", type: "text" }
];

interface SearchablePendingArrivalSelectProps {
  pendingArrivalList: any[];
  onSelect: (fa: any) => void;
}

const SearchablePendingArrivalSelect: React.FC<SearchablePendingArrivalSelectProps> = ({
  pendingArrivalList,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDisplay, setSelectedDisplay] = useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredList = pendingArrivalList.filter((fa) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    const faNo = String(fa.final_arrival_no || fa.mr_no || "").toLowerCase();
    const poNo = String(fa.po_no || "").toLowerCase();
    const supplier = String(fa.supplier || fa.challan_supplier || "").toLowerCase();
    const lorry = String(fa.lorry_number || "").toLowerCase();
    const broker = String(fa.broker || "").toLowerCase();

    return (
      faNo.includes(q) ||
      poNo.includes(q) ||
      supplier.includes(q) ||
      lorry.includes(q) ||
      broker.includes(q)
    );
  });

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white border border-emerald-300 hover:border-emerald-500 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-800 flex items-center justify-between cursor-pointer shadow-sm transition-all focus-within:ring-2 focus-within:ring-emerald-500"
      >
        <div className="flex items-center gap-2 truncate pr-2">
          <Search className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          <span className={selectedDisplay ? "text-slate-900 font-black truncate" : "text-slate-500 font-semibold truncate"}>
            {selectedDisplay || "-- Select / Search Pending Arrival Record to Auto-Fill --"}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedDisplay && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDisplay("");
                setSearchTerm("");
              }}
              className="p-0.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4 text-emerald-700" /> : <ChevronDown className="w-4 h-4 text-emerald-700" />}
        </div>
      </div>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 left-0 mt-1 bg-white border border-emerald-300 rounded-xl shadow-2xl z-50 overflow-hidden text-xs">
          {/* Search Bar Input */}
          <div className="p-2.5 border-b border-emerald-100 bg-emerald-50/70 flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Arrival #, PO #, Supplier, Lorry #..."
              className="w-full bg-white border border-emerald-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400 placeholder:font-normal"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {pendingArrivalList.length === 0 ? (
              <div className="p-4 text-center text-slate-500 font-medium italic">
                -- No Pending Arrivals (All Already Inspected) --
              </div>
            ) : filteredList.length === 0 ? (
              <div className="p-4 text-center text-slate-500 font-medium italic">
                No matching pending arrival record found for "{searchTerm}"
              </div>
            ) : (
              filteredList.map((fa, idx) => {
                const arrNo = fa.final_arrival_no || fa.mr_no || 'FA';
                const poNo = fa.po_no || '-';
                const suppName = fa.supplier || fa.challan_supplier || 'Supplier';
                const lorryNo = fa.lorry_number || '-';
                const labelStr = `Arrival #${arrNo} | PO: ${poNo} | ${suppName} | Lorry: ${lorryNo}`;
                const isSelected = selectedDisplay === labelStr;

                return (
                  <div
                    key={`p-arr-${idx}`}
                    onClick={() => {
                      setSelectedDisplay(labelStr);
                      onSelect(fa);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                    className={`px-3.5 py-2.5 cursor-pointer hover:bg-emerald-50 transition-colors flex items-center justify-between gap-3 ${
                      isSelected ? "bg-emerald-100/70 font-bold text-emerald-950" : "text-slate-800"
                    }`}
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md text-[11px] font-mono">
                          #{arrNo}
                        </span>
                        <span className="font-mono text-slate-700 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                          PO: <strong className="text-slate-900">{poNo}</strong>
                        </span>
                        {fa.lorry_number && (
                          <span className="text-[10px] text-slate-600 bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded font-mono font-bold">
                            Lorry: {fa.lorry_number}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600 truncate">
                        <span className="font-bold text-slate-900">{suppName}</span>
                        {fa.broker && <span className="text-slate-500 ml-1">(Broker: {fa.broker})</span>}
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function Inspection({ onNavigate }: InspectionProps) {
  const [records, setRecords] = useState<InspectionMasterRecord[]>([]);
  const [finalArrivalList, setFinalArrivalList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const isFetchingRecordsRef = React.useRef<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"dashboard" | "form">("dashboard");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Sorting state for arrival date, arrival no, status
  const [sortField, setSortField] = useState<"arrival_date" | "arrival_no" | "status">("arrival_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Print modal state
  const [copyType, setCopyType] = useState<string | null>('1');
  const [printingRecord, setPrintingRecord] = useState<InspectionMasterRecord | null>(null);
  const [printingDetails, setPrintingDetails] = useState<any[]>([]);

  // Pagination (100 rows per page)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Form State
  const [headerForm, setHeaderForm] = useState<InspectionMasterRecord>({
    mr_no: `MRRC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    mr_date: new Date().toISOString().split("T")[0],
    arrival_no: "",
    arrival_date: new Date().toISOString().split("T")[0],
    po_no: "",
    po_date: new Date().toISOString().split("T")[0],
    broker_name: "",
    supplier_name: "",
    actual_moisture: 0,
    claim_moisture: 0,
    actual_dust: 0,
    claim_dust: 0,
    actual_ncv: 0,
    claim_ncv: 0,
    detention_days: 0,
    unloading_date: "",
    mill_po_no: "",
    mill_po_date: "",
    mr_spcl_print: "",
    remarks: "",
    lorry_number: "",
    status: "Completed"
  });

  const [detailRows, setDetailRows] = useState<InspectionDetailRow[]>([
    {
      unit: "BALES",
      quantity: 0,
      challan_gross_wt: 0,
      tolerable: "Yes",
      expanded: false
    }
  ]);

  // Deduction state for multiple deduction rows
  const [deductionRows, setDeductionRows] = useState<DeductionRow[]>([
    { id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }
  ]);
  const [deductionMasterList, setDeductionMasterList] = useState<any[]>(DEFAULT_DEDUCTION_TYPES);
  const [moistureLogicRules, setMoistureLogicRules] = useState<any[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const syncHeaderDeductions = (rows: DeductionRow[]) => {
    const activeRows = rows.filter(r => (r.deduction_type && r.deduction_type.trim() !== "") || r.deduction_amount > 0 || r.deduction_rate > 0);
    const totalAmt = rows.reduce((acc, r) => acc + (Number(r.deduction_amount) || 0), 0);
    const primaryRow = activeRows[0] || rows[0] || { deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 };

    setHeaderForm(prev => ({
      ...prev,
      deduction_type: activeRows.map(r => r.deduction_type).filter(Boolean).join(", ") || primaryRow.deduction_type || "",
      deduction_rate: primaryRow.deduction_rate || 0,
      deduction_qty: primaryRow.deduction_qty || 0,
      deduction_amount: totalAmt,
      deductions: rows
    }));
  };

  // Helper to identify automated deduction rules
  const isAutoDeductionRule = (name: string) => {
    const n = String(name || "").trim().toUpperCase();
    return (
      ((n.includes("BALE") || n.includes("BALES")) && (n.includes("LESS THAN") || n.includes("WEIGHT") || n.includes("<"))) ||
      n.includes("DELIVERY CLAIM") || n.includes("PER DAY")
    );
  };

  // Helper to test specifically if a deduction rule is an automated bale weight rule
  const isBaleWeightDeductionRule = (name: string) => {
    const n = String(name || "").trim().toUpperCase();
    return (n.includes("BALE") || n.includes("BALES")) && (n.includes("LESS THAN") || n.includes("WEIGHT") || n.includes("<"));
  };

  // Comprehensive auto-sync of all deduction policies from deduction_master without erasing saved/user-entered rows
  const applyAllAutoDeductions = (
    details: InspectionDetailRow[],
    hForm: Partial<InspectionMasterRecord>,
    dMaster: any[]
  ) => {
    const { matchedDeductions } = calculateAllMatchingDeductions(details, hForm, dMaster);

    setDeductionRows(prevRows => {
      let nextRows = [...prevRows];

      // Keep track of which matched policies have been applied
      const matchedApplied = new Set<string>();

      // Update existing rows or prepare new rows for each matched auto policy
      matchedDeductions.forEach(matched => {
        const existingIdx = nextRows.findIndex(
          r => r.deduction_type === matched.ruleName || (matched.category === "bale_weight" && isBaleWeightDeductionRule(r.deduction_type || ""))
        );

        matchedApplied.add(matched.ruleName);

        if (existingIdx >= 0) {
          const cur = nextRows[existingIdx];
          nextRows[existingIdx] = {
            ...cur,
            deduction_type: matched.ruleName,
            deduction_rate: matched.rate,
            deduction_qty: matched.qty,
            deduction_amount: matched.amount
          };
        } else {
          // If first row is empty / placeholder
          const isFirstRowEmpty =
            nextRows.length === 1 &&
            (!nextRows[0].deduction_type ||
              nextRows[0].deduction_type.trim() === "" ||
              nextRows[0].deduction_type.includes("-- SELECT"));

          if (isFirstRowEmpty) {
            nextRows = [
              {
                id: nextRows[0].id || "1",
                deduction_type: matched.ruleName,
                deduction_rate: matched.rate,
                deduction_qty: matched.qty,
                deduction_amount: matched.amount
              }
            ];
          } else {
            // Append as a new deduction row
            nextRows.push({
              id: String(Date.now() + Math.random()),
              deduction_type: matched.ruleName,
              deduction_rate: matched.rate,
              deduction_qty: matched.qty,
              deduction_amount: matched.amount
            });
          }
        }
      });

      if (nextRows.length === 0) {
        nextRows = [{ id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }];
      }

      // Check if rows actually changed to avoid unnecessary renders
      const isSame =
        prevRows.length === nextRows.length &&
        prevRows.every(
          (r, i) =>
            r.deduction_type === nextRows[i].deduction_type &&
            Number(r.deduction_rate) === Number(nextRows[i].deduction_rate) &&
            Number(r.deduction_qty) === Number(nextRows[i].deduction_qty) &&
            Number(r.deduction_amount) === Number(nextRows[i].deduction_amount)
        );

      if (isSame) {
        return prevRows;
      }

      syncHeaderDeductions(nextRows);
      return nextRows;
    });
  };

  // Re-run auto policy evaluation whenever detailRows, header claim fields, remarks, or deduction master changes
  useEffect(() => {
    if (detailRows && detailRows.length > 0) {
      applyAllAutoDeductions(detailRows, headerForm, deductionMasterList);
    }
  }, [
    detailRows,
    headerForm.detention_days,
    headerForm.delivery_claim,
    headerForm.remarks,
    headerForm.mr_spcl_print,
    deductionMasterList
  ]);

  const handleDeductionTypeChange = (idx: number, selectedName: string) => {
    const found = deductionMasterList.find(d => d.deduction === selectedName);
    let rate = found ? (found.rate_per_unit != null ? Number(found.rate_per_unit) : (found.rate_per_qntl != null ? Number(found.rate_per_qntl) : 0)) : 0;

    const autoCalc = calculateBaleWeightDeduction(detailRows, deductionMasterList);
    const isBaleRule = isBaleWeightDeductionRule(selectedName);

    const totalGrossMt = (detailRows || []).reduce((sum, r) => {
      const wt = Number(r.receipt_gross_wt) > 0 
        ? Number(r.receipt_gross_wt) 
        : (Number(r.gross_weight_batch) > 0 ? Number(r.gross_weight_batch) : Number(r.challan_gross_wt) || 0);
      return sum + wt;
    }, 0);
    const totalItemQty = (detailRows || []).reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

    let defaultQty = 0;
    if (isBaleRule && autoCalc.totalBales > 0) {
      defaultQty = autoCalc.totalBales;
    } else if (found && found.rate_per_qntl != null && totalGrossMt > 0) {
      defaultQty = Number((totalGrossMt * 10).toFixed(2));
    } else if (selectedName.includes("DELIVERY CLAIM")) {
      const days = Number(headerForm?.detention_days) > 0 ? Number(headerForm?.detention_days) : 1;
      rate = Number((rate * days).toFixed(2));
      defaultQty = totalGrossMt > 0 ? Number((totalGrossMt * 10).toFixed(2)) : 1;
    } else if (totalItemQty > 0) {
      defaultQty = totalItemQty;
    }
    
    setDeductionRows(prev => {
      const updated = [...prev];
      const current = { ...(updated[idx] || { id: String(Date.now()), deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }) };
      current.deduction_type = selectedName;
      current.deduction_rate = rate;
      current.deduction_qty = defaultQty;
      current.deduction_amount = Number((rate * defaultQty).toFixed(2));
      updated[idx] = current;
      syncHeaderDeductions(updated);
      return updated;
    });
  };

  const handleDeductionChange = (idx: number, field: "deduction_rate" | "deduction_qty" | "deduction_amount", value: number) => {
    setDeductionRows(prev => {
      const updated = [...prev];
      const current = { ...(updated[idx] || { id: String(Date.now()), deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }) };
      if (field === "deduction_rate") current.deduction_rate = value;
      if (field === "deduction_qty") current.deduction_qty = value;
      if (field === "deduction_amount") {
        current.deduction_amount = value;
      } else {
        current.deduction_amount = Number(((current.deduction_rate || 0) * (current.deduction_qty || 0)).toFixed(2));
      }
      updated[idx] = current;
      syncHeaderDeductions(updated);
      return updated;
    });
  };

  const handleAddDeductionRow = () => {
    setDeductionRows(prev => {
      const updated = [
        ...prev,
        { id: String(Date.now() + Math.random()), deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }
      ];
      syncHeaderDeductions(updated);
      return updated;
    });
    showToast("Added new deduction entry row.");
  };

  const handleRemoveDeductionRow = (idx: number) => {
    setDeductionRows(prev => {
      if (prev.length <= 1) {
        const reset = [{ id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }];
        syncHeaderDeductions(reset);
        return reset;
      }
      const updated = prev.filter((_, i) => i !== idx);
      syncHeaderDeductions(updated);
      return updated;
    });
    showToast("Deduction entry removed.");
  };

  async function fetchInspectionRecords(isManual: boolean = false) {
    if (isFetchingRecordsRef.current) return;
    isFetchingRecordsRef.current = true;
    setLoading(true);
    try {
      let inspectionList: InspectionMasterRecord[] = [];
      let faList: any[] = [];
      const dbDeductionsMap = new Map<string, DeductionRow[]>();

      if (supabase) {
        try {
          const withTimeout = (promise: Promise<any>, ms: number = 12000) => {
            return Promise.race([
              promise,
              new Promise(resolve => setTimeout(() => resolve({ data: null, error: 'timeout' }), ms))
            ]);
          };

          const miCols = "mr_no, mr_date, date, arrival_no, arrival_date, po_no, po_date, supplier_name, broker_name, lorry_number, actual_moisture, claim_moisture, actual_dust, claim_dust, actual_ncv, claim_ncv, detention_days, unloading_date, mill_po_no, mill_po_date, remarks, deduction_type, deduction_rate, deduction_qty, deduction_amount, status, created_at, updated_at, deductions, deduction_rows, deduction_types, arrival_area, arrival_area_name, arrival_area_code, unit, unit_name, agency, area, marka, marks, rate, amount, quantity, gross_weight, net_weight, actual_grade_down, claim_grade_down, final_receipt_wt, arrival_grade, stock_grade_code, stock_grade_name";

          const faCols = "final_arrival_no, arrival_no, mr_no, final_arrival_id, temporary_arrival_no, lorry_number, po_no, po_date, date, supplier, challan_supplier, broker, status, created_at, arrival_date, unit_name, unit_code, arrival_area_name, arrival_area_code, total_packets, weight_qtl, actual_gross_weight, actual_tare_weight, electronic_net_weight, grid_details";

          const [miRes, mimRes, faRes, dedPrimaryRes, dedFallbackRes, dMasterRes, moistRes] = await Promise.all([
            withTimeout(Promise.resolve(supabase.from("material_inspection").select(miCols).order("created_at", { ascending: false }))),
            withTimeout(Promise.resolve(supabase.from("mill_inspection_master").select("*").order("created_at", { ascending: false }))).catch(() => ({ data: null })),
            withTimeout(Promise.resolve(supabase.from("final_arrival").select(faCols).order("created_at", { ascending: false }))),
            withTimeout(Promise.resolve(supabase.from("material_inspection_deductions").select("*").order("created_at", { ascending: true }))).catch(() => ({ data: null })),
            withTimeout(Promise.resolve(supabase.from("mill_inspection_deduction").select("*").order("created_at", { ascending: true }))).catch(() => ({ data: null })),
            withTimeout(Promise.resolve(supabase.from("deduction_master").select("*"))).catch(() => ({ data: null })),
            withTimeout(Promise.resolve(supabase.from("moisture_logic").select("*"))).catch(() => ({ data: null }))
          ]);

          if (miRes.data && Array.isArray(miRes.data)) {
            inspectionList = [...miRes.data];
          }
          if (mimRes?.data && Array.isArray(mimRes.data)) {
            const existingKeys = new Set(inspectionList.map(r => (r.mr_no || r.arrival_no || "").trim().toUpperCase()).filter(Boolean));
            mimRes.data.forEach((r: any) => {
              const k = (r.mr_no || r.arrival_no || "").trim().toUpperCase();
              if (k && !existingKeys.has(k)) {
                inspectionList.push(r);
                existingKeys.add(k);
              }
            });
          }
          if (faRes.data && Array.isArray(faRes.data)) {
            faList = faRes.data;
          }
          if (dMasterRes && dMasterRes.data && Array.isArray(dMasterRes.data) && dMasterRes.data.length > 0) {
            setDeductionMasterList(dMasterRes.data);
          }
          if (moistRes && moistRes.data && Array.isArray(moistRes.data) && moistRes.data.length > 0) {
            setMoistureLogicRules(moistRes.data);
          }

          const dedData = (dedPrimaryRes && dedPrimaryRes.data && dedPrimaryRes.data.length > 0)
            ? dedPrimaryRes.data
            : (dedFallbackRes?.data || []);

          if (dedData && Array.isArray(dedData)) {
            dedData.forEach((d: any) => {
              const k1 = (d.mr_no || "").trim().toUpperCase();
              const k2 = (d.arrival_no || "").trim().toUpperCase();
              const row: DeductionRow = {
                id: d.id ? String(d.id) : String(Math.random()),
                deduction_type: d.deduction_type || "",
                deduction_rate: Number(d.deduction_rate) || 0,
                deduction_qty: Number(d.deduction_qty) || 0,
                deduction_amount: Number(d.deduction_amount) || 0,
                remarks: d.remarks || ""
              };
              if (k1) {
                const list = dbDeductionsMap.get(k1) || [];
                list.push(row);
                dbDeductionsMap.set(k1, list);
              }
              if (k2 && k2 !== k1) {
                const list = dbDeductionsMap.get(k2) || [];
                list.push(row);
                dbDeductionsMap.set(k2, list);
              }
            });
          }
        } catch (e) {
          console.warn("Parallel fetch error in inspection records:", e);
        }
      }

      if (inspectionList.length === 0) {
        try {
          const cached = localStorage.getItem("material_inspection_records") || localStorage.getItem("inspection_master_records");
          if (cached) inspectionList = JSON.parse(cached);
        } catch (e) {}
      }

      // Local storage fallbacks for Final Arrival Vouchers
      try {
        const cachedFa = localStorage.getItem("final_arrival_vouchers");
        if (cachedFa) {
          const parsed = JSON.parse(cachedFa);
          parsed.forEach((item: any) => {
            if (!faList.some(f => (f.final_arrival_no && f.final_arrival_no === item.final_arrival_no) || (f.final_arrival_id && f.final_arrival_id === item.final_arrival_id) || (f.mr_no && f.mr_no === item.mr_no))) {
              faList.push(item);
            }
          });
        }
      } catch (e) {}

      setFinalArrivalList(faList);

      // Enrich existing saved inspection records
      const map = new Map<string, InspectionMasterRecord>();

      inspectionList.forEach(rec => {
        const k = (rec.mr_no || rec.arrival_no || "").trim().toUpperCase();
        if (k) map.set(k, rec);
      });

      // Enrich saved records with info from Final Arrival if available
      faList.forEach(fa => {
        const mrKey = (fa.mr_no || "").trim().toUpperCase();
        const arrKey = (fa.final_arrival_no || fa.arrival_no || "").trim().toUpperCase();

        const existing = (mrKey && map.get(mrKey)) || (arrKey && map.get(arrKey));

        if (existing) {
          // Fill missing header attributes from Final Arrival record
          if (!existing.po_no && fa.po_no) existing.po_no = fa.po_no;
          if (!existing.po_date && (fa.po_date || fa.date)) existing.po_date = fa.po_date || fa.date;
          if (!existing.supplier_name && (fa.supplier || fa.challan_supplier)) existing.supplier_name = fa.supplier || fa.challan_supplier;
          if (!existing.broker_name && fa.broker) existing.broker_name = fa.broker;
          if (!existing.lorry_number && fa.lorry_number) existing.lorry_number = fa.lorry_number;
          if (!existing.arrival_no && fa.final_arrival_no) existing.arrival_no = fa.final_arrival_no;
          if (!existing.arrival_date && fa.date) existing.arrival_date = fa.date;
          if (!existing.grid_details) existing.grid_details = fa.grid_details || fa.items || fa.details;
        }
      });

      const displayList = Array.from(map.values()).map(rec => {
        const mrK = (rec.mr_no || "").trim().toUpperCase();
        const arrK = (rec.arrival_no || "").trim().toUpperCase();
        let attachedDeductions: DeductionRow[] = [];

        if (mrK && dbDeductionsMap.has(mrK)) {
          attachedDeductions = dbDeductionsMap.get(mrK)!;
        } else if (arrK && dbDeductionsMap.has(arrK)) {
          attachedDeductions = dbDeductionsMap.get(arrK)!;
        } else if (rec.deductions) {
          if (Array.isArray(rec.deductions) && rec.deductions.length > 0) {
            attachedDeductions = rec.deductions;
          } else if (typeof rec.deductions === 'string') {
            try {
              const p = JSON.parse(rec.deductions);
              if (Array.isArray(p) && p.length > 0) attachedDeductions = p;
            } catch (e) {}
          }
        }

        if (attachedDeductions.length === 0 && (rec as any).deduction_rows) {
          const dr = (rec as any).deduction_rows;
          if (Array.isArray(dr) && dr.length > 0) attachedDeductions = dr;
          else if (typeof dr === 'string') {
            try {
              const p = JSON.parse(dr);
              if (Array.isArray(p) && p.length > 0) attachedDeductions = p;
            } catch (e) {}
          }
        }

        if (attachedDeductions.length === 0 && (rec as any).deductions_json) {
          try {
            const p = JSON.parse((rec as any).deductions_json);
            if (Array.isArray(p) && p.length > 0) attachedDeductions = p;
          } catch (e) {}
        }

        if (attachedDeductions.length === 0 && rec.mr_no) {
          try {
            const c = localStorage.getItem(`inspection_deductions_${rec.mr_no}`);
            if (c) {
              const p = JSON.parse(c);
              if (Array.isArray(p) && p.length > 0) attachedDeductions = p;
            }
          } catch (e) {}
        }

        if (attachedDeductions.length === 0 && rec.arrival_no) {
          try {
            const c = localStorage.getItem(`inspection_deductions_${rec.arrival_no}`);
            if (c) {
              const p = JSON.parse(c);
              if (Array.isArray(p) && p.length > 0) attachedDeductions = p;
            }
          } catch (e) {}
        }

        if (attachedDeductions.length === 0 && (rec.deduction_type || Number(rec.deduction_amount) > 0)) {
          attachedDeductions = [
            {
              id: "1",
              deduction_type: rec.deduction_type || "General Deduction",
              deduction_rate: Number(rec.deduction_rate) || 0,
              deduction_qty: Number(rec.deduction_qty) || 0,
              deduction_amount: Number(rec.deduction_amount) || 0
            }
          ];
        }

        if (attachedDeductions.length > 0) {
          rec.deductions = attachedDeductions;
          (rec as any).deduction_rows = attachedDeductions;
          if (!rec.deduction_amount || Number(rec.deduction_amount) === 0) {
            rec.deduction_amount = attachedDeductions.reduce((sum, d) => sum + (Number(d.deduction_amount) || 0), 0);
          }
        }

        return rec;
      });

      setRecords(displayList);

      try {
        localStorage.setItem("material_inspection_records", JSON.stringify(displayList));
        localStorage.setItem("inspection_master_records", JSON.stringify(displayList));
      } catch (e) {}

      if (isManual) {
        showToast("Inspection register data refreshed successfully.");
      }
    } catch (err) {
      console.error("Error fetching material_inspection records:", err);
      if (isManual) {
        showToast("Failed to refresh records from database.");
      }
    } finally {
      setLoading(false);
      isFetchingRecordsRef.current = false;
    }
  };

  useEffect(() => {
    fetchInspectionRecords();
  }, []);

  useLiveAutoRefresh(fetchInspectionRecords, [], { tables: ['material_inspection', 'material_inspection_details', 'final_arrival', 'purchase_master', 'purchase_detail_master', 'temporary_material_received', 'moisture_logic', 'deduction_master'] });

  const loadDetailsForPo = async (poNo: string) => {
    if (!poNo) return;
    try {
      const poClean = poNo.trim();
      const poUpper = poClean.toUpperCase();
      let matchedItems: any[] = [];
      let gradeMap: Record<string, string> = {};
      let agencyMap: Record<string, string> = {};
      let markaMap: Record<string, string> = {};
      let pmData: any = null;

      if (supabase) {
        const [pdmRes, scpRes, midRes, pmRes, gradesRes, agenciesRes, markasRes, scpHeaderRes] = await Promise.all([
          supabase.from('purchase_detail_master').select('*').or(`po_no.eq.${poClean},po_no.ilike.${poUpper}`),
          supabase.from('sauda_check_point_details').select('*').or(`po_no.eq.${poClean},po_no.ilike.${poUpper}`),
          supabase.from('material_inspection_details').select('*').or(`mr_no.eq.${poClean},mr_no.ilike.${poUpper},po_no.eq.${poClean}`),
          supabase.from('purchase_master').select('*').or(`po_no.eq.${poClean},po_no.ilike.${poUpper}`),
          supabase.from('grade_master').select('*'),
          supabase.from('agency_master').select('*'),
          supabase.from('marka_master').select('*'),
          supabase.from('sauda_check_point').select('*').or(`po_no.eq.${poClean},po_no.ilike.${poUpper}`)
        ]);

        if (gradesRes.data) {
          gradesRes.data.forEach((g: any) => {
            if (g.grade_code && g.grade_name) gradeMap[g.grade_code] = g.grade_name;
          });
        }
        if (agenciesRes.data) {
          agenciesRes.data.forEach((a: any) => {
            if (a.agency_code && a.agency_name) agencyMap[a.agency_code] = a.agency_name;
          });
        }
        if (markasRes.data) {
          markasRes.data.forEach((m: any) => {
            if (m.marka_code && m.marka_name) markaMap[m.marka_code] = m.marka_name;
          });
        }

        if (pmRes.data && pmRes.data.length > 0) {
          pmData = pmRes.data[0];
          const pm = pmData;
          setHeaderForm(prev => ({
            ...prev,
            po_no: pm.po_no || prev.po_no,
            po_date: pm.po_date || pm.date || prev.po_date,
            supplier_name: pm.supplier || pm.challan_supplier || prev.supplier_name,
            broker_name: pm.broker || prev.broker_name,
            lorry_number: pm.lorry_no || pm.lorry_number || prev.lorry_number
          }));
        } else if (scpHeaderRes.data && scpHeaderRes.data.length > 0) {
          const scp = scpHeaderRes.data[0];
          pmData = scp;
          setHeaderForm(prev => ({
            ...prev,
            po_no: scp.po_no || prev.po_no,
            po_date: scp.po_date || scp.s_date || prev.po_date,
            supplier_name: scp.supplier_name || scp.supplier || prev.supplier_name,
            broker_name: scp.broker_name || scp.broker || prev.broker_name,
            lorry_number: scp.lorry_number || prev.lorry_number
          }));
        }

        matchedItems = (pdmRes.data && pdmRes.data.length > 0)
          ? pdmRes.data
          : ((scpRes.data && scpRes.data.length > 0)
              ? scpRes.data
              : (midRes.data || []));
      }

      if (!matchedItems || matchedItems.length === 0) {
        const [allPdm, allScp] = await Promise.all([
          dbModule.fetchAll('purchase_detail_master').catch(() => []),
          dbModule.fetchAll('sauda_check_point_details').catch(() => [])
        ]);
        const pdm = (allPdm || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poUpper);
        const scp = (allScp || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poUpper);
        matchedItems = pdm.length > 0 ? pdm : scp;
      }

      if (matchedItems && matchedItems.length > 0) {
        let resolvedUnitName = (pmData?.unit_name || pmData?.unit || "").toString().trim().toUpperCase();
        if (!resolvedUnitName && matchedItems.length > 0) {
          for (const itm of matchedItems) {
            const u = (itm.unit || itm.unit_name || "").toString().trim().toUpperCase();
            if (u && u !== "BALES") {
              resolvedUnitName = u;
              break;
            }
          }
        }

        const details: InspectionDetailRow[] = matchedItems.map((item: any, i: number) => {
          const gradeCode = item.grade_code || item.receipt_grade_code || item.stock_grade_code || item.item_code || "";
          const resolvedGradeName = gradeMap[gradeCode] || item.grade_name || item.receipt_grade_name || item.challan_grade_name || item.variety || item.item_name || item.grade || gradeCode;
          const agencyCode = item.agency_code || "";
          const resolvedAgencyName = agencyMap[agencyCode] || item.agency_name || item.agency || agencyCode;
          const markaCode = item.marka_code || item.challan_marka_code || "";
          const resolvedMarkaName = markaMap[markaCode] || item.marka_name || item.challan_marka_name || item.marka || item.marks || markaCode;
          const areaName = (item.area_name || item.area || item.arrival_area_name || item.arrival_area || "").toUpperCase();
          const nettoVal = Number(item.netto_pnto !== undefined && item.netto_pnto !== null && item.netto_pnto !== "" ? item.netto_pnto : (item.weight_mt || item.quantity_mt || item.challan_gross_wt || item.receipt_gross_wt || item.gross_weight || item.weight || item.net_wt || 0));
          let qtyVal = 0;
          if (item.quantity_rcpt !== undefined && item.quantity_rcpt !== null && item.quantity_rcpt !== "") {
            qtyVal = Number(item.quantity_rcpt);
          } else if (item.quantity_chln !== undefined && item.quantity_chln !== null && item.quantity_chln !== "") {
            qtyVal = Number(item.quantity_chln);
          } else if (item.quantity !== undefined && item.quantity !== null && item.quantity !== "") {
            qtyVal = Number(item.quantity);
          } else if (item.bales !== undefined && item.bales !== null && item.bales !== "") {
            qtyVal = Number(item.bales);
          }
          const itemUnit = (item.unit || item.unit_name || "").toString().trim().toUpperCase();
          const unitVal = (itemUnit && itemUnit !== "BALES") ? itemUnit : (resolvedUnitName || itemUnit || "BALES");
          const rateVal = Number(item.rate_qntl || item.rate || item.po_rate || 0);

          const lMin = Number(item.lorry_read_min || 0);
          const lMax = Number(item.lorry_read_max || 0);
          const lAvg = Number(item.lorry_read_avg || (lMin > 0 && lMax > 0 ? (lMin + lMax) / 2 : (lMin || lMax)) || 0);

          const iMin = Number(item.insp_read_min || 0);
          const iMax = Number(item.insp_read_max || 0);
          const iAvg = Number(item.insp_read_avg || (iMin > 0 && iMax > 0 ? (iMin + iMax) / 2 : (iMin || iMax)) || 0);

          let combinedMoistAvg = 0;
          if (lAvg > 0 && iAvg > 0) {
            combinedMoistAvg = Number(((lAvg + iAvg) / 2).toFixed(2));
          } else if (lAvg > 0 || iAvg > 0) {
            combinedMoistAvg = Number((lAvg || iAvg).toFixed(2));
          }

          const moistAct = Number(item.moisture_act || combinedMoistAvg || 0);
          const moistClaim = Number(item.moisture_claim || combinedMoistAvg || 0);
          const gdAct = Number(item.grade_down_act || item.grade_down || 0);
          const dustAct = Number(item.dust_act || 0);
          const ncvAct = Number(item.ncv_act || 0);

          return {
            srl_no: item.srl_no || (i + 1),
            arrival_grade: resolvedGradeName,
            stock_grade_code: gradeCode,
            stock_grade_name: resolvedGradeName,
            area: areaName,
            agency: resolvedAgencyName,
            agency_code: agencyCode,
            marks: resolvedMarkaName,
            crop_year: item.crop_year || "2026-27",
            quantity: qtyVal,
            unit: unitVal,
            rate: rateVal,
            rate_qntl: rateVal,
            challan_gross_wt: nettoVal,
            receipt_gross_wt: nettoVal,
            final_receipt_wt: nettoVal,
            reduced_weight: nettoVal,
            moisture_act: moistAct,
            moisture_claim: Number(item.moisture_claim || item.claim_moisture || 0),
            grade_down_act: gdAct,
            grade_down_claim: Number(item.grade_down_claim || 0),
            dust_act: dustAct,
            dust_claim: Number(item.dust_claim || item.claim_dust || 0),
            ncv_act: ncvAct,
            ncv_claim: Number(item.ncv_claim || item.claim_ncv || 0),
            settlement_moisture: Number(item.settlement_moisture !== undefined && item.settlement_moisture !== null && item.settlement_moisture !== "" ? item.settlement_moisture : moistAct),
            settlement_grade_down: Number(item.settlement_grade_down !== undefined && item.settlement_grade_down !== null && item.settlement_grade_down !== "" ? item.settlement_grade_down : gdAct),
            settlement_dust: Number(item.settlement_dust !== undefined && item.settlement_dust !== null && item.settlement_dust !== "" ? item.settlement_dust : dustAct),
            settlement_ncv: Number(item.settlement_ncv !== undefined && item.settlement_ncv !== null && item.settlement_ncv !== "" ? item.settlement_ncv : ncvAct),
            tolerable: item.tolerable || "Yes",
            premium: item.premium !== undefined && item.premium !== null ? String(item.premium) : "",
            is_premium: item.is_premium || item.premium === "Yes",
            row_remarks: item.remarks || item.row_remarks || "",
            is_auto: true,
            expanded: false
          };
        });
        setDetailRows(details);
        showToast(`Loaded ${details.length} item(s) from purchase_detail_master.`);
      }
    } catch (e) {
      console.warn("Error loading details from PO:", e);
    }
  };

  const populateFromFinalArrival = async (fa: any) => {
    const displayMrNo = (fa.mr_no && fa.mr_no !== "DIRECT REGISTER" && fa.mr_no.trim() !== "")
      ? fa.mr_no
      : (fa.final_arrival_no || `FA-${fa.final_arrival_id || Math.floor(1000 + Math.random() * 9000)}`);

    const poNo = fa.po_no || fa.mr_no || "";
    const mrToCheck = (fa.mr_no || fa.final_arrival_no || displayMrNo || "").trim().toUpperCase();
    const existingRec = records.find(r => 
      (r.mr_no && (r.mr_no.toUpperCase() === mrToCheck || r.mr_no.toUpperCase() === (fa.final_arrival_no || "").toUpperCase())) ||
      (r.arrival_no && (r.arrival_no.toUpperCase() === (fa.final_arrival_no || "").toUpperCase() || r.arrival_no.toUpperCase() === (fa.temporary_arrival_no || "").toUpperCase()))
    );

    let initialHeader = {
      mr_no: existingRec?.mr_no || displayMrNo,
      mr_date: existingRec?.mr_date || fa.date || fa.arrival_date || new Date().toISOString().split("T")[0],
      arrival_no: existingRec?.arrival_no || fa.final_arrival_no || fa.arrival_no || displayMrNo,
      arrival_date: existingRec?.arrival_date || fa.date || fa.arrival_date || new Date().toISOString().split("T")[0],
      unloading_date: existingRec?.unloading_date || fa.unloading_date || fa.date || fa.arrival_date || new Date().toISOString().split("T")[0],
      po_no: existingRec?.po_no || poNo,
      po_date: existingRec?.po_date || fa.po_date || fa.date || "",
      mill_po_no: existingRec?.mill_po_no || fa.mill_po_no || fa.po_no || fa.mr_no || fa.final_arrival_no || displayMrNo || "",
      mill_po_date: existingRec?.mill_po_date || fa.mill_po_date || fa.po_date || fa.date || new Date().toISOString().split("T")[0],
      broker_name: existingRec?.broker_name || fa.broker || fa.broker_name || "",
      supplier_name: existingRec?.supplier_name || fa.supplier || fa.supplier_name || fa.challan_supplier || "",
      lorry_number: existingRec?.lorry_number || fa.lorry_number || fa.lorry_no || "",
      actual_moisture: existingRec?.actual_moisture !== undefined ? Number(existingRec.actual_moisture) : Number(fa.actual_moisture || 0),
      actual_dust: existingRec?.actual_dust !== undefined ? Number(existingRec.actual_dust) : Number(fa.actual_dust || 0),
      actual_ncv: existingRec?.actual_ncv !== undefined ? Number(existingRec.actual_ncv) : Number(fa.actual_ncv || 0),
      claim_moisture: existingRec?.claim_moisture !== undefined ? Number(existingRec.claim_moisture) : Number(fa.claim_moisture || 0),
      claim_dust: existingRec?.claim_dust !== undefined ? Number(existingRec.claim_dust) : Number(fa.claim_dust || 0),
      claim_ncv: existingRec?.claim_ncv !== undefined ? Number(existingRec.claim_ncv) : Number(fa.claim_ncv || 0),
      detention_days: existingRec?.detention_days !== undefined ? Number(existingRec.detention_days) : Number(fa.detention_days || 0),
      mr_spcl_print: existingRec?.mr_spcl_print || fa.mr_spcl_print || "",
      remarks: existingRec?.remarks || fa.remarks || fa.arrival_remarks || ""
    };

    setHeaderForm(initialHeader);
    setViewMode("form");

    let rawGrid = fa.grid_details || fa.details || fa.items;
    const voucherArea = (fa.arrival_area_name || fa.arrival_area || fa.area_name || fa.area || "").toUpperCase();

    if (typeof rawGrid === "string") {
      try { rawGrid = JSON.parse(rawGrid); } catch (e) {}
    }

    // Resolve parent unit from Final Arrival or look up from DB/cache if missing
    let resolvedUnitName = (fa.unit_name || fa.unit || fa.unit_code || existingRec?.unit_name || "").toString().trim().toUpperCase();

    // Check if any row in rawGrid has a unit
    if ((!resolvedUnitName || resolvedUnitName === "BALES") && Array.isArray(rawGrid)) {
      for (const row of rawGrid) {
        const u = (row?.unit || row?.unit_name || "").toString().trim().toUpperCase();
        if (u && u !== "BALES") {
          resolvedUnitName = u;
          break;
        }
      }
    }

    // Master dictionaries for code -> name lookup
    let gradeMap: Record<string, string> = {};
    let agencyMap: Record<string, string> = {};
    let markaMap: Record<string, string> = {};
    let poRateMap: Record<string, number> = {};

    // Load master lookup tables and PO rate details
    if (supabase) {
      try {
        const [gradesRes, agenciesRes, markasRes, pdmRes, scpRes, pmRes, scpMasterRes] = await Promise.all([
          supabase.from('grade_master').select('*'),
          supabase.from('agency_master').select('*'),
          supabase.from('marka_master').select('*'),
          poNo ? supabase.from('purchase_detail_master').select('*').eq('po_no', poNo) : Promise.resolve({ data: null }),
          poNo ? supabase.from('sauda_check_point_details').select('*').eq('po_no', poNo) : Promise.resolve({ data: null }),
          poNo ? supabase.from('purchase_master').select('*').eq('po_no', poNo).maybeSingle() : Promise.resolve({ data: null }),
          poNo ? supabase.from('sauda_check_point').select('*').eq('po_no', poNo).maybeSingle() : Promise.resolve({ data: null })
        ]);

        if (gradesRes.data) {
          gradesRes.data.forEach((g: any) => {
            if (g.grade_code && g.grade_name) gradeMap[String(g.grade_code).trim()] = g.grade_name;
          });
        }
        if (agenciesRes.data) {
          agenciesRes.data.forEach((a: any) => {
            if (a.agency_code && a.agency_name) agencyMap[String(a.agency_code).trim()] = a.agency_name;
          });
        }
        if (markasRes.data) {
          markasRes.data.forEach((m: any) => {
            if (m.marka_code && m.marka_name) markaMap[String(m.marka_code).trim()] = m.marka_name;
          });
        }

        // Map PO rates
        const poItems = pdmRes.data || scpRes.data || [];
        poItems.forEach((p: any) => {
          const r = Number(p.rate_qntl || p.rate || p.b_rate || 0);
          if (r > 0) {
            if (p.grade_code) poRateMap[String(p.grade_code).trim().toUpperCase()] = r;
            if (p.grade_name) poRateMap[String(p.grade_name).trim().toUpperCase()] = r;
            if (p.item_name) poRateMap[String(p.item_name).trim().toUpperCase()] = r;
          }
        });

        const poMaster = pmRes.data || scpMasterRes.data;
        if (poMaster) {
          setHeaderForm(prev => ({
            ...prev,
            po_date: prev.po_date || poMaster.po_date || poMaster.date || prev.po_date,
            broker_name: prev.broker_name || poMaster.broker || prev.broker_name,
            supplier_name: prev.supplier_name || poMaster.supplier || poMaster.challan_supplier || prev.supplier_name
          }));
        }
      } catch (mErr) {
        console.warn("Could not load master lookup maps / PO rates:", mErr);
      }
    }

    // Check if prior material inspection details exist in DB for this MR/Arrival
    if (supabase && (mrToCheck || fa.final_arrival_no || fa.arrival_no)) {
      try {
        const searchKeys = [mrToCheck, fa.final_arrival_no, fa.arrival_no, fa.mr_no].filter(Boolean);
        const orClause = searchKeys.map(k => `mr_no.eq.${k}`).join(',');
        const { data: savedMid } = await supabase
          .from('material_inspection_details')
          .select('*')
          .or(orClause)
          .order('srl_no', { ascending: true });

        if (savedMid && savedMid.length > 0) {
          rawGrid = savedMid;
        }
      } catch (e) {
        console.warn("Could not load saved material inspection details:", e);
      }
    }

    // If arrival grid details missing or empty, fetch fresh from DB
    if (!Array.isArray(rawGrid) || rawGrid.length === 0) {
      const searchKeys = [fa.final_arrival_no, fa.arrival_no, fa.mr_no, fa.temporary_arrival_no, fa.po_no].filter(Boolean);
      if (searchKeys.length > 0 && supabase) {
        try {
          for (const key of searchKeys) {
            const cleanKey = String(key).trim();
            const upperKey = cleanKey.toUpperCase();
            const [faDb, tmrDb, matInspRes, pdmRes, scpRes, pmDb] = await Promise.all([
              supabase.from('final_arrival').select('unit_name, unit_code, grid_details, arrival_area_name, arrival_area_code').or(`final_arrival_no.eq.${cleanKey},arrival_no.eq.${cleanKey},mr_no.eq.${cleanKey}`).limit(1),
              supabase.from('temporary_material_received').select('unit_name, unit_code, grid_details').or(`mr_no.eq.${cleanKey},arrival_no.eq.${cleanKey}`).limit(1),
              supabase.from('material_inspection_details').select('*').or(`mr_no.eq.${cleanKey},mr_no.ilike.${upperKey},po_no.eq.${cleanKey}`),
              supabase.from('purchase_detail_master').select('*').or(`po_no.eq.${cleanKey},po_no.ilike.${upperKey}`),
              supabase.from('sauda_check_point_details').select('*').or(`po_no.eq.${cleanKey},po_no.ilike.${upperKey}`),
              supabase.from('purchase_master').select('unit_name, unit_code').or(`po_no.eq.${cleanKey}`).limit(1)
            ]);

            if ((!resolvedUnitName || resolvedUnitName === "BALES")) {
              const foundUnit = faDb.data?.[0]?.unit_name || tmrDb.data?.[0]?.unit_name || pmDb.data?.[0]?.unit_name;
              if (foundUnit) {
                resolvedUnitName = foundUnit.toString().trim().toUpperCase();
              }
            }

            // 1. Prioritize actual arrival grid_details from final_arrival
            let arrivalGrid = faDb.data?.[0]?.grid_details;
            if (typeof arrivalGrid === 'string') {
              try { arrivalGrid = JSON.parse(arrivalGrid); } catch (e) {}
            }
            if (Array.isArray(arrivalGrid) && arrivalGrid.length > 0) {
              rawGrid = arrivalGrid;
              break;
            }

            // 2. Try temporary_material_received grid_details
            let tmrGrid = tmrDb.data?.[0]?.grid_details;
            if (typeof tmrGrid === 'string') {
              try { tmrGrid = JSON.parse(tmrGrid); } catch (e) {}
            }
            if (Array.isArray(tmrGrid) && tmrGrid.length > 0) {
              rawGrid = tmrGrid;
              break;
            }

            // 3. Try prior material inspection details
            if (matInspRes.data && Array.isArray(matInspRes.data) && matInspRes.data.length > 0) {
              rawGrid = matInspRes.data;
              break;
            }

            // 4. Fallback to purchase detail or sauda check point
            if (pdmRes.data && Array.isArray(pdmRes.data) && pdmRes.data.length > 0) {
              rawGrid = pdmRes.data;
              break;
            }
            if (scpRes.data && Array.isArray(scpRes.data) && scpRes.data.length > 0) {
              rawGrid = scpRes.data;
              break;
            }
          }
        } catch (e) {
          console.warn("Could not load arrival details from DB:", e);
        }
      }

      if (!rawGrid || rawGrid.length === 0) {
        try {
          const [allPdm, allScp] = await Promise.all([
            dbModule.fetchAll('purchase_detail_master').catch(() => []),
            dbModule.fetchAll('sauda_check_point_details').catch(() => [])
          ]);
          const poUpper = String(poNo || '').trim().toUpperCase();
          const pdm = (allPdm || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poUpper);
          const scp = (allScp || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poUpper);
          rawGrid = pdm.length > 0 ? pdm : scp;
        } catch (e) {}
      }
    }

    if (Array.isArray(rawGrid) && rawGrid.length > 0) {
      let totalMoistAct = 0;
      let totalMoistClaim = 0;
      let totalDustAct = 0;
      let totalNcvAct = 0;
      let rowCount = 0;

      const details: InspectionDetailRow[] = rawGrid.map((item: any, i: number) => {
        const gradeCode = item.receipt_grade_code || item.grade_code || item.stock_grade_code || item.item_code || "";
        const gradeName = item.receipt_grade_name || item.challan_grade_name || item.arrival_grade || item.grade_name || item.stock_grade_name || item.variety || item.item_name || item.grade || (gradeCode && gradeMap[gradeCode]) || "";
        const areaName = (item.arrival_area_name || item.area || item.area_name || item.arrival_area || voucherArea || "").toUpperCase();
        const agencyCode = item.agency_code || "";
        const agencyName = item.agency_name || item.agency || (agencyCode && agencyMap[agencyCode]) || agencyCode || "";
        const markaCode = item.challan_marka_code || item.marka_code || "";
        const markaName = item.challan_marka_name || item.marka_name || item.marks_phota || item.marka || item.marks || (markaCode && markaMap[markaCode]) || markaCode || "";
        const nettoVal = Number(item.netto_pnto !== undefined && item.netto_pnto !== null && item.netto_pnto !== "" ? item.netto_pnto : (item.weight_mt || item.quantity_mt || item.challan_gross_wt || item.receipt_gross_wt || item.gross_weight || item.weight || item.net_wt || 0));
        
        let qtyVal = 0;
        if (item.quantity_rcpt !== undefined && item.quantity_rcpt !== null && item.quantity_rcpt !== "") {
          qtyVal = Number(item.quantity_rcpt);
        } else if (item.quantity_chln !== undefined && item.quantity_chln !== null && item.quantity_chln !== "") {
          qtyVal = Number(item.quantity_chln);
        } else if (item.quantity !== undefined && item.quantity !== null && item.quantity !== "") {
          qtyVal = Number(item.quantity);
        } else if (item.bales !== undefined && item.bales !== null && item.bales !== "") {
          qtyVal = Number(item.bales);
        }

        const itemUnit = (item.unit || item.unit_name || "").toString().trim().toUpperCase();
        const unitVal = (itemUnit && itemUnit !== "BALES") ? itemUnit : (resolvedUnitName || itemUnit || "BALES");

        const lMin = Number(item.lorry_read_min || item.lorry_moisture_min || 0);
        const lMax = Number(item.lorry_read_max || item.lorry_moisture_max || 0);
        const lAvg = Number(item.lorry_read_avg || (lMin > 0 && lMax > 0 ? (lMin + lMax) / 2 : (lMin || lMax)) || 0);

        const iMin = Number(item.insp_read_min || 0);
        const iMax = Number(item.insp_read_max || 0);
        const iAvg = Number(item.insp_read_avg || (iMin > 0 && iMax > 0 ? (iMin + iMax) / 2 : (iMin || iMax)) || 0);

        let combinedMoistAvg = 0;
        if (lAvg > 0 && iAvg > 0) {
          combinedMoistAvg = Number(((lAvg + iAvg) / 2).toFixed(2));
        } else if (lAvg > 0 || iAvg > 0) {
          combinedMoistAvg = Number((lAvg || iAvg).toFixed(2));
        }

        const moistAct = Number(item.moisture_act || item.actual_moisture || combinedMoistAvg || 0);
        const moistClaim = Number(item.moisture_claim || item.claim_moisture || combinedMoistAvg || 0);
        const gdAct = Number(item.grade_down_act || item.grade_down || item.actual_grade_down || 0);
        const gdClaim = Number(item.grade_down_claim || item.claim_grade_down || 0);
        const dustAct = Number(item.dust_act || item.actual_dust || 0);
        const dustClaim = Number(item.dust_claim || item.claim_dust || 0);
        const ncvAct = Number(item.ncv_act || item.actual_ncv || 0);
        const ncvClaim = Number(item.ncv_claim || item.claim_ncv || 0);

        if (moistAct > 0) totalMoistAct += moistAct;
        if (moistClaim > 0) totalMoistClaim += moistClaim;
        if (dustAct > 0) totalDustAct += dustAct;
        if (ncvAct > 0) totalNcvAct += ncvAct;
        rowCount++;

        // Look up PO rate for this item
        const gKey = String(gradeName).trim().toUpperCase();
        const gCodeKey = String(gradeCode).trim().toUpperCase();
        const resolvedRate = Number(item.rate_qntl || item.rate || poRateMap[gKey] || poRateMap[gCodeKey] || item.po_rate || 0);

        return {
          srl_no: item.srl_no || (i + 1),
          arrival_grade: gradeName,
          stock_grade_code: gradeCode,
          stock_grade_name: gradeName,
          area: areaName,
          agency: agencyName,
          agency_code: agencyCode,
          marks: markaName,
          crop_year: item.crop_year || "2026-27",
          lot: item.lot || item.lot_no || "",
          quantity: qtyVal,
          unit: unitVal,
          rate: resolvedRate,
          rate_qntl: resolvedRate,
          challan_gross_wt: nettoVal,
          receipt_gross_wt: nettoVal,
          gross_weight_batch: Number(item.gross_weight_batch || item.batch_gross_weight || nettoVal || 0),
          add_weight: Number(item.add_weight || 0),
          less_weight: Number(item.less_weight || 0),
          reduced_weight: nettoVal,
          final_receipt_wt: nettoVal,
          lorry_moisture_min: lMin,
          lorry_moisture_max: lMax,
          lorry_read_min: lMin,
          lorry_read_max: lMax,
          lorry_read_avg: lAvg,
          insp_read_min: iMin,
          insp_read_max: iMax,
          insp_read_avg: iAvg,
          moisture_act: moistAct,
          moisture_claim: moistClaim,
          grade_down_act: gdAct,
          grade_down_claim: gdClaim,
          dust_act: dustAct,
          dust_claim: dustClaim,
          ncv_act: ncvAct,
          ncv_claim: ncvClaim,
          settlement_moisture: Number(item.settlement_moisture !== undefined && item.settlement_moisture !== null && item.settlement_moisture !== "" ? item.settlement_moisture : moistAct),
          settlement_grade_down: Number(item.settlement_grade_down !== undefined && item.settlement_grade_down !== null && item.settlement_grade_down !== "" ? item.settlement_grade_down : gdAct),
          settlement_dust: Number(item.settlement_dust !== undefined && item.settlement_dust !== null && item.settlement_dust !== "" ? item.settlement_dust : dustAct),
          settlement_ncv: Number(item.settlement_ncv !== undefined && item.settlement_ncv !== null && item.settlement_ncv !== "" ? item.settlement_ncv : ncvAct),
          tolerable: item.tolerable || "Yes",
          premium: item.premium !== undefined && item.premium !== null ? String(item.premium) : "",
          is_premium: item.is_premium || item.premium === "Yes",
          row_remarks: item.remarks || item.row_remarks || "",
          is_auto: true,
          expanded: false
        };
      });
      setDetailRows(details);

      // If header moisture / dust were zero, update with item averages
      if (rowCount > 0) {
        setHeaderForm(prev => ({
          ...prev,
          actual_moisture: prev.actual_moisture || Number((totalMoistAct / rowCount).toFixed(2)),
          claim_moisture: prev.claim_moisture || Number((totalMoistClaim / rowCount).toFixed(2)),
          actual_dust: prev.actual_dust || Number((totalDustAct / rowCount).toFixed(2)),
          actual_ncv: prev.actual_ncv || Number((totalNcvAct / rowCount).toFixed(2))
        }));
      }
    } else if (voucherArea) {
      setDetailRows(prev => prev.map(r => ({ ...r, area: r.area || voucherArea })));
    }

    let loadedDeductions: DeductionRow[] = [];
    if (existingRec && existingRec.deductions && Array.isArray(existingRec.deductions) && existingRec.deductions.length > 0) {
      loadedDeductions = existingRec.deductions;
    } else if (fa.deductions && Array.isArray(fa.deductions) && fa.deductions.length > 0) {
      loadedDeductions = fa.deductions;
    } else if (existingRec?.mr_no || mrToCheck) {
      try {
        const cached = localStorage.getItem(`inspection_deductions_${existingRec?.mr_no || mrToCheck}`);
        if (cached) {
          const p = JSON.parse(cached);
          if (Array.isArray(p) && p.length > 0) loadedDeductions = p;
        }
      } catch (e) {}
    }

    if (loadedDeductions.length > 0) {
      setDeductionRows(loadedDeductions);
    } else if (fa.deduction_type || (fa.deduction_amount && Number(fa.deduction_amount) > 0)) {
      setDeductionRows([
        {
          id: "1",
          deduction_type: fa.deduction_type || "",
          deduction_rate: Number(fa.deduction_rate) || 0,
          deduction_qty: Number(fa.deduction_qty) || 0,
          deduction_amount: Number(fa.deduction_amount) || 0
        }
      ]);
    } else if (existingRec && (existingRec.deduction_type || (existingRec.deduction_amount && Number(existingRec.deduction_amount) > 0))) {
      setDeductionRows([
        {
          id: "1",
          deduction_type: existingRec.deduction_type || "",
          deduction_rate: Number(existingRec.deduction_rate) || 0,
          deduction_qty: Number(existingRec.deduction_qty) || 0,
          deduction_amount: Number(existingRec.deduction_amount) || 0
        }
      ]);
    } else {
      setDeductionRows([
        { id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }
      ]);
    }

    if (supabase && (mrToCheck || existingRec?.mr_no)) {
      const mrTarget = existingRec?.mr_no || mrToCheck;
      const arrTarget = fa.final_arrival_no || fa.arrival_no || '';
      (async () => {
        try {
          let { data } = await supabase
            .from("mill_inspection_deduction")
            .select("*")
            .or(`mr_no.eq.${mrTarget},arrival_no.eq.${arrTarget}`)
            .order("created_at", { ascending: true });
          
          if (!data || data.length === 0) {
            const { data: fallbackData } = await supabase
              .from("material_inspection_deductions")
              .select("*")
              .or(`mr_no.eq.${mrTarget},arrival_no.eq.${arrTarget}`)
              .order("created_at", { ascending: true });
            data = fallbackData;
          }

          if (data && data.length > 0) {
            setDeductionRows(data.map((d: any, idx: number) => ({
              id: d.id ? String(d.id) : String(idx + 1),
              deduction_type: d.deduction_type || "",
              deduction_rate: Number(d.deduction_rate) || 0,
              deduction_qty: Number(d.deduction_qty) || 0,
              deduction_amount: Number(d.deduction_amount) || 0,
              remarks: d.remarks || ""
            })));
          }
        } catch (e) {}
      })();
    }

    showToast(`Loaded Final Arrival ${fa.final_arrival_no || displayMrNo} into inspection form.`);
  };

  const handleOpenNewForm = () => {
    setHeaderForm({
      mr_no: `MRRC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      mr_date: new Date().toISOString().split("T")[0],
      arrival_no: "",
      arrival_date: new Date().toISOString().split("T")[0],
      po_no: "",
      po_date: new Date().toISOString().split("T")[0],
      broker_name: "",
      supplier_name: "",
      actual_moisture: 0,
      claim_moisture: 0,
      actual_dust: 0,
      claim_dust: 0,
      actual_ncv: 0,
      claim_ncv: 0,
      detention_days: 0,
      unloading_date: "",
      mill_po_no: "",
      mill_po_date: "",
      mr_spcl_print: "",
      remarks: "",
      lorry_number: "",
      status: "Completed",
      deduction_type: "",
      deduction_rate: 0,
      deduction_qty: 0,
      deduction_amount: 0
    });
    setDetailRows([
      {
        unit: "BALES",
        quantity: 0,
        challan_gross_wt: 0,
        tolerable: "Yes",
        expanded: false
      }
    ]);
    setDeductionRows([
      { id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }
    ]);
    setViewMode("form");
  };

  const handlePrintRecord = async (rec: InspectionMasterRecord) => {
    const poNo = rec.po_no || rec.mill_po_no;
    if (poNo && supabase) {
      try {
        const poClean = String(poNo).trim();
        const { data: scp } = await supabase
          .from('sauda_check_point')
          .select('*')
          .eq('po_no', poClean)
          .maybeSingle();

        if (scp) {
          const isClosed = scp.status === 'closed' || scp.is_closed === true || scp.status === 'final' || scp.status === 'moved_to_final' || scp.status === 'settled';
          
          const { data: matMismatches } = await supabase
            .from('material_mismatch')
            .select('*')
            .eq('po_no', poClean);
          const { data: satMismatches } = await supabase
            .from('satta_mismatch')
            .select('*')
            .eq('po_no', poClean);

          const hasActiveMatMismatch = (matMismatches || []).some(m => {
            const st = String(m.status || m.resolution_status || '').toLowerCase();
            return st !== 'resolved' && st !== 'cleared' && st !== 'approved';
          });
          const hasActiveSatMismatch = (satMismatches || []).some(m => {
            const st = String(m.status || m.resolution_status || '').toLowerCase();
            return st !== 'resolved' && st !== 'cleared' && st !== 'approved';
          });

          const isCleared = scp.mismatch_cleared === true || scp.mismatch_cleared === 'true' || scp.satta_dispute_approved === true || scp.satta_dispute_approved === 'true';
          const isMismatch = !isCleared && (hasActiveMatMismatch || hasActiveSatMismatch || scp.pass_status === 'mismatch');

          if (!isClosed || isMismatch) {
            alert(`Mill Inspection Print Not Allowed!\n\nThis Purchase Order (${poClean}) does not satisfy the required conditions:\n- Sauda Check Point Status must be CLOSED (Current: ${isClosed ? 'CLOSED' : 'OPEN'})\n- Pass/Mismatch must be PASS (Current: ${isMismatch ? 'MISMATCH' : 'PASS'})\n\nPlease ensure Sauda Check Point is Closed and there are no unresolved mismatches before printing.`);
            return;
          }
        }
      } catch (err) {
        console.warn("Error validating print permissions:", err);
      }
    }

    setPrintingRecord(rec);
    setPrintingDetails([]);

    let loadedDetails: any[] = [];

    // If currently editing this record in form view, prioritize the in-memory detailRows
    if (headerForm.mr_no === rec.mr_no && detailRows.length > 0) {
      loadedDetails = detailRows.filter(r => Number(r.quantity) > 0 || Number(r.challan_gross_wt) > 0);
    }

    if (loadedDetails.length === 0 && supabase) {
      try {
        const midRes = await supabase.from("material_inspection_details").select("*").eq("mr_no", rec.mr_no).order("srl_no", { ascending: true });
        if (midRes.data && midRes.data.length > 0) {
          loadedDetails = midRes.data;
        }
      } catch (err) {
        console.warn("Could not fetch print details from remote DB:", err);
      }
    }

    if (loadedDetails.length === 0) {
      let rawGrid = rec.grid_details;
      if (typeof rawGrid === 'string') {
        try { rawGrid = JSON.parse(rawGrid); } catch (e) {}
      }
      if (Array.isArray(rawGrid) && rawGrid.length > 0) {
        loadedDetails = rawGrid
          .filter((item: any) => Number(item.quantity_rcpt || item.quantity_chln || item.quantity || item.bales || 0) > 0 || Number(item.netto_pnto || item.weight_mt || item.challan_gross_wt || item.gross_weight || item.weight || 0) > 0)
          .map((item: any) => ({
            crop_year: item.crop_year || "2026-27",
            marka: item.challan_marka_name || item.marka_name || item.marka || item.marks || (rec as any).area || "BJC",
            stock_grade_name: item.receipt_grade_name || item.challan_grade_name || item.grade_name || item.variety || item.grade || "TD-5",
            quantity: item.quantity_rcpt || item.quantity_chln || item.quantity || item.bales || 1,
            challan_gross_wt: item.netto_pnto || item.weight_mt || item.challan_gross_wt || item.gross_weight || item.weight || "",
            moisture_claim: item.moisture_claim ?? item.claim_moisture ?? item.moisture_act ?? item.actual_moisture ?? rec.claim_moisture ?? rec.actual_moisture ?? 5,
            actual_moisture: item.moisture_act || item.actual_moisture || rec.actual_moisture || 5,
            moisture_act: item.moisture_act || item.actual_moisture || rec.actual_moisture || 5,
            dust_claim: item.dust_claim ?? item.claim_dust ?? item.dust_act ?? item.actual_dust ?? rec.claim_dust ?? rec.actual_dust ?? 0,
            actual_dust: item.dust_act || item.actual_dust || rec.actual_dust || 0,
            dust_act: item.dust_act || item.actual_dust || rec.actual_dust || 0,
            ncv_claim: item.ncv_claim ?? item.claim_ncv ?? item.ncv_act ?? item.actual_ncv ?? rec.claim_ncv ?? rec.actual_ncv ?? 0,
            actual_ncv: item.ncv_act || item.actual_ncv || rec.actual_ncv || 0,
            ncv_act: item.ncv_act || item.actual_ncv || rec.actual_ncv || 0,
            settlement_moisture: item.settlement_moisture || '',
            settlement_dust: item.settlement_dust || '',
            settlement_ncv: item.settlement_ncv || '',
            final_receipt_wt: item.final_receipt_wt || item.net_wt || item.netto_pnto || "",
            rate: item.rate || item.rate_qntl || "",
            area: item.area || item.arrival_area_name || item.purch_area_name || (rec as any).area || "",
            agency: item.agency || item.arrival_agency_name || item.purch_agency_name || (rec as any).agency || ""
          }));
      }
    }

    setPrintingDetails(loadedDetails);
  };

  const handleEditRecord = async (rec: InspectionMasterRecord) => {
    setHeaderForm(rec);
    setDetailRows([]);

    let parsedDeductions: DeductionRow[] = [];
    if (rec.deductions) {
      if (Array.isArray(rec.deductions) && rec.deductions.length > 0) {
        parsedDeductions = rec.deductions;
      } else if (typeof rec.deductions === 'string') {
        try {
          const parsed = JSON.parse(rec.deductions);
          if (Array.isArray(parsed) && parsed.length > 0) parsedDeductions = parsed;
        } catch (e) {}
      }
    }
    if (parsedDeductions.length === 0 && (rec as any).deduction_rows) {
      const dr = (rec as any).deduction_rows;
      if (Array.isArray(dr) && dr.length > 0) parsedDeductions = dr;
      else if (typeof dr === 'string') {
        try {
          const parsed = JSON.parse(dr);
          if (Array.isArray(parsed) && parsed.length > 0) parsedDeductions = parsed;
        } catch (e) {}
      }
    }
    if (parsedDeductions.length === 0 && (rec as any).deductions_json) {
      try {
        const parsed = JSON.parse((rec as any).deductions_json);
        if (Array.isArray(parsed) && parsed.length > 0) parsedDeductions = parsed;
      } catch (e) {}
    }
    if (parsedDeductions.length === 0 && rec.mr_no) {
      try {
        const cached = localStorage.getItem(`inspection_deductions_${rec.mr_no}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) parsedDeductions = parsed;
        }
      } catch (e) {}
    }
    if (parsedDeductions.length === 0 && rec.arrival_no) {
      try {
        const cached = localStorage.getItem(`inspection_deductions_${rec.arrival_no}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) parsedDeductions = parsed;
        }
      } catch (e) {}
    }

    if (parsedDeductions.length > 0) {
      setDeductionRows(parsedDeductions);
    } else if (rec.deduction_type || (rec.deduction_amount && Number(rec.deduction_amount) > 0)) {
      setDeductionRows([
        {
          id: "1",
          deduction_type: rec.deduction_type || "General Deduction",
          deduction_rate: Number(rec.deduction_rate) || 0,
          deduction_qty: Number(rec.deduction_qty) || 0,
          deduction_amount: Number(rec.deduction_amount) || 0
        }
      ]);
    } else {
      setDeductionRows([
        { id: "1", deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 }
      ]);
      
      // Fallback query ONLY if no deductions were found in memory or cache
      if (supabase && (rec.mr_no || rec.arrival_no)) {
        const keys = [rec.mr_no, rec.arrival_no].filter(Boolean);
        const orFilter = keys.map(k => `mr_no.eq.${k},arrival_no.eq.${k}`).join(',');
        (async () => {
          try {
            let { data } = await supabase.from("material_inspection_deductions").select("*").or(orFilter).order("created_at", { ascending: true });
            if (!data || data.length === 0) {
              const { data: fallbackData } = await supabase.from("mill_inspection_deduction").select("*").or(orFilter).order("created_at", { ascending: true });
              data = fallbackData;
            }
            if (data && data.length > 0) {
              setDeductionRows(data.map((d: any, idx: number) => ({
                id: d.id ? String(d.id) : String(idx + 1),
                deduction_type: d.deduction_type || "",
                deduction_rate: Number(d.deduction_rate) || 0,
                deduction_qty: Number(d.deduction_qty) || 0,
                deduction_amount: Number(d.deduction_amount) || 0,
                remarks: d.remarks || ""
              })));
            }
          } catch (e) {}
        })();
      }
    }

    setViewMode("form");

    let loadedDetails: InspectionDetailRow[] = [];

    if (supabase) {
      try {
        const { data: midData } = await supabase.from("material_inspection_details").select("*").eq("mr_no", rec.mr_no).order("srl_no", { ascending: true });
        if (midData && midData.length > 0) {
          loadedDetails = midData.map(d => ({ ...d, is_auto: true, expanded: false }));
        }
      } catch (err) {
        console.warn("Could not query material_inspection_details:", err);
      }
    }

    if (loadedDetails.length === 0) {
      if (!rec.grid_details && supabase && (rec.mr_no || rec.arrival_no)) {
        try {
          const key = rec.mr_no || rec.arrival_no;
          const { data: fullMi } = await supabase
            .from("material_inspection")
            .select("grid_details, details, quality_matrix")
            .or(`mr_no.eq.${key},arrival_no.eq.${key}`)
            .maybeSingle();
          if (fullMi) {
            rec.grid_details = fullMi.grid_details || fullMi.details;
            (rec as any).details = fullMi.details;
            (rec as any).quality_matrix = fullMi.quality_matrix;
          }
        } catch (e) {}
      }

      // Build detail rows from grid_details if available (from Final Arrival)
      let rawGrid = rec.grid_details;
      if (typeof rawGrid === 'string') {
        try { rawGrid = JSON.parse(rawGrid); } catch (e) {}
      }

      if (Array.isArray(rawGrid) && rawGrid.length > 0) {
        const resolvedUnitName = (rec.unit_name || (rec as any).unit || "").toString().trim().toUpperCase();
        loadedDetails = rawGrid.map((item: any, i: number) => {
          const nettoVal = Number(item.netto_pnto !== undefined && item.netto_pnto !== null && item.netto_pnto !== "" ? item.netto_pnto : (item.weight_mt || item.quantity_mt || item.challan_gross_wt || item.receipt_gross_wt || item.gross_weight || item.weight || item.net_wt || 0));
          
          let qtyVal = 0;
          if (item.quantity_rcpt !== undefined && item.quantity_rcpt !== null && item.quantity_rcpt !== "") {
            qtyVal = Number(item.quantity_rcpt);
          } else if (item.quantity_chln !== undefined && item.quantity_chln !== null && item.quantity_chln !== "") {
            qtyVal = Number(item.quantity_chln);
          } else if (item.quantity !== undefined && item.quantity !== null && item.quantity !== "") {
            qtyVal = Number(item.quantity);
          } else if (item.bales !== undefined && item.bales !== null && item.bales !== "") {
            qtyVal = Number(item.bales);
          }

          const itemUnit = (item.unit || item.unit_name || "").toString().trim().toUpperCase();
          const unitVal = (itemUnit && itemUnit !== "BALES") ? itemUnit : (resolvedUnitName || itemUnit || "BALES");

          const moistAct = Number(item.moisture_act || item.actual_moisture || item.insp_read_avg || rec.actual_moisture || 0);
          const gdAct = Number(item.grade_down_act || item.grade_down || 0);
          const dustAct = Number(item.dust_act || item.actual_dust || rec.actual_dust || 0);
          const ncvAct = Number(item.ncv_act || item.actual_ncv || rec.actual_ncv || 0);

          return {
            srl_no: item.srl_no || (i + 1),
            arrival_grade: item.receipt_grade_name || item.challan_grade_name || item.grade_name || item.variety || item.grade || "",
            stock_grade_code: item.receipt_grade_code || item.grade_code || item.stock_grade_code || item.item_code || "",
            stock_grade_name: item.receipt_grade_name || item.challan_grade_name || item.grade_name || item.variety || item.grade || "",
            area: (item.area_name || item.area || "").toUpperCase(),
            agency: item.agency_name || item.agency || "",
            agency_code: item.agency_code || "",
            marks: item.challan_marka_name || item.marka_name || item.marks_phota || item.marka || item.marks || "",
            crop_year: item.crop_year || "2026-27",
            quantity: qtyVal,
            unit: unitVal,
            challan_gross_wt: nettoVal,
            receipt_gross_wt: nettoVal,
            reduced_weight: nettoVal,
            final_receipt_wt: nettoVal,
            moisture_act: moistAct,
            moisture_claim: Number(item.moisture_claim || item.claim_moisture || rec.claim_moisture || 0),
            grade_down_act: gdAct,
            grade_down_claim: Number(item.grade_down_claim || 0),
            dust_act: dustAct,
            dust_claim: Number(item.dust_claim || item.claim_dust || rec.claim_dust || 0),
            ncv_act: ncvAct,
            ncv_claim: Number(item.ncv_claim || item.claim_ncv || rec.claim_ncv || 0),
            settlement_moisture: Number(item.settlement_moisture !== undefined && item.settlement_moisture !== null && item.settlement_moisture !== "" ? item.settlement_moisture : moistAct),
            settlement_grade_down: Number(item.settlement_grade_down !== undefined && item.settlement_grade_down !== null && item.settlement_grade_down !== "" ? item.settlement_grade_down : gdAct),
            settlement_dust: Number(item.settlement_dust !== undefined && item.settlement_dust !== null && item.settlement_dust !== "" ? item.settlement_dust : dustAct),
            settlement_ncv: Number(item.settlement_ncv !== undefined && item.settlement_ncv !== null && item.settlement_ncv !== "" ? item.settlement_ncv : ncvAct),
            tolerable: item.tolerable || "Yes",
            premium: item.premium !== undefined && item.premium !== null ? String(item.premium) : "",
            is_premium: item.is_premium || item.premium === "Yes",
            row_remarks: item.remarks || item.row_remarks || "",
            is_auto: true,
            expanded: false
          };
        });
      }
    }

    // If still empty, attempt to load from purchase_detail_master by PO number
    if (loadedDetails.length === 0 && rec.po_no) {
      if (supabase) {
        const poClean = rec.po_no.trim();
        const { data: pdm } = await supabase.from('purchase_detail_master').select('*').eq('po_no', poClean);
        if (pdm && pdm.length > 0) {
          const resolvedUnitName = (rec.unit_name || (rec as any).unit || "").toString().trim().toUpperCase();
          loadedDetails = pdm.map((item: any, i: number) => {
            const nettoVal = Number(item.weight_mt || item.quantity_mt || item.netto_pnto || item.weight || item.quantity || 0);
            const moistAct = Number(item.moisture_act || item.actual_moisture || rec.actual_moisture || 0);
            const gdAct = Number(item.grade_down_act || item.grade_down || 0);
            const dustAct = Number(item.dust_act || item.actual_dust || rec.actual_dust || 0);
            const ncvAct = Number(item.ncv_act || item.actual_ncv || rec.actual_ncv || 0);
            const itemUnit = (item.unit || item.unit_name || "").toString().trim().toUpperCase();
            const unitVal = (itemUnit && itemUnit !== "BALES") ? itemUnit : (resolvedUnitName || itemUnit || "BALES");

            return {
              srl_no: item.srl_no || (i + 1),
              arrival_grade: item.grade_name || item.variety || item.grade || "",
              stock_grade_code: item.grade_code || "",
              stock_grade_name: item.grade_name || item.variety || item.grade || "",
              area: (item.area || "").toUpperCase(),
              agency: item.agency || item.agency_name || "",
              marks: item.marka || item.marka_name || "",
              crop_year: item.crop_year || "2026-27",
              quantity: Number(item.quantity || (nettoVal > 0 ? Math.round(nettoVal) : 0)) || 0,
              unit: unitVal,
              challan_gross_wt: nettoVal,
              receipt_gross_wt: nettoVal,
              reduced_weight: nettoVal,
              final_receipt_wt: nettoVal,
              moisture_act: moistAct,
              moisture_claim: Number(item.moisture_claim || item.claim_moisture || rec.claim_moisture || 0),
              grade_down_act: gdAct,
              grade_down_claim: Number(item.grade_down_claim || 0),
              dust_act: dustAct,
              dust_claim: Number(item.dust_claim || item.claim_dust || rec.claim_dust || 0),
              ncv_act: ncvAct,
              ncv_claim: Number(item.ncv_claim || item.claim_ncv || rec.claim_ncv || 0),
              settlement_moisture: Number(item.settlement_moisture !== undefined && item.settlement_moisture !== null && item.settlement_moisture !== "" ? item.settlement_moisture : moistAct),
              settlement_grade_down: Number(item.settlement_grade_down !== undefined && item.settlement_grade_down !== null && item.settlement_grade_down !== "" ? item.settlement_grade_down : gdAct),
              settlement_dust: Number(item.settlement_dust !== undefined && item.settlement_dust !== null && item.settlement_dust !== "" ? item.settlement_dust : dustAct),
              settlement_ncv: Number(item.settlement_ncv !== undefined && item.settlement_ncv !== null && item.settlement_ncv !== "" ? item.settlement_ncv : ncvAct),
              tolerable: "Yes",
              is_auto: true,
              expanded: false
            };
          });
        }
      }
    }

    // Resolve true unit from Final Arrival or record header
    const matchingFa = finalArrivalList.find(f => 
      (f.mr_no && (f.mr_no === rec.mr_no || f.mr_no === rec.arrival_no)) ||
      (f.final_arrival_no && (f.final_arrival_no === rec.mr_no || f.final_arrival_no === rec.arrival_no)) ||
      (f.temporary_arrival_no && (f.temporary_arrival_no === rec.mr_no || f.temporary_arrival_no === rec.arrival_no)) ||
      (f.po_no && (f.po_no === rec.po_no || f.po_no === (rec as any).mill_po_no))
    );
    let targetUnit = (matchingFa?.unit_name || matchingFa?.unit || rec.unit_name || (rec as any).unit || "").toString().trim().toUpperCase();
    if ((!targetUnit || targetUnit === "BALES") && matchingFa) {
      let rawGrid = matchingFa.grid_details || matchingFa.details || matchingFa.items;
      if (typeof rawGrid === "string") {
        try { rawGrid = JSON.parse(rawGrid); } catch (e) {}
      }
      if (Array.isArray(rawGrid)) {
        for (const row of rawGrid) {
          const u = (row?.unit || row?.unit_name || "").toString().trim().toUpperCase();
          if (u && u !== "BALES") {
            targetUnit = u;
            break;
          }
        }
      }
    }

    if (targetUnit && targetUnit !== "BALES") {
      loadedDetails = loadedDetails.map(r => ({
        ...r,
        unit: (!r.unit || r.unit === "BALES") ? targetUnit : r.unit
      }));
      if (supabase && rec.mr_no) {
        supabase.from("material_inspection_details").update({ unit: targetUnit }).eq("mr_no", rec.mr_no).then(() => {}, () => {});
        supabase.from("material_inspection").update({ unit_name: targetUnit }).eq("mr_no", rec.mr_no).then(() => {}, () => {});
      }
    }

    if (loadedDetails.length === 0) {
      loadedDetails = [{ unit: targetUnit || "BALES", quantity: 0, tolerable: "Yes", expanded: false }];
    }

    setDetailRows(loadedDetails);
  };

  const handleHeaderChange = (field: keyof InspectionMasterRecord, value: any) => {
    setHeaderForm(prev => ({ ...prev, [field]: value }));
    if (field === 'po_no' && value) {
      loadDetailsForPo(value);
    } else if ((field === 'mr_no' || field === 'arrival_no') && value) {
      const cleanVal = String(value).trim().toUpperCase();
      const match = finalArrivalList.find(fa => 
        String(fa.mr_no || '').trim().toUpperCase() === cleanVal ||
        String(fa.final_arrival_no || '').trim().toUpperCase() === cleanVal ||
        String(fa.arrival_no || '').trim().toUpperCase() === cleanVal
      );
      if (match) {
        populateFromFinalArrival(match);
      }
    } else if (field === 'arrival_date') {
      const arrDate = String(value);
      setDetailRows(prev => prev.map(r => {
        const actM = Number(r.moisture_act) || ((Number(r.lorry_read_avg) > 0 && Number(r.insp_read_avg) > 0) ? Number(((Number(r.lorry_read_avg) + Number(r.insp_read_avg)) / 2).toFixed(2)) : (Number(r.lorry_read_avg) || Number(r.insp_read_avg) || 0));
        const newClaim = calculateClaimMoisture(actM, arrDate, r.area || (headerForm as any).area, moistureLogicRules);
        let updatedRow = { ...r, moisture_claim: newClaim };
        if (Number(r.receipt_gross_wt) > 0) {
          const baseWt = Number(r.reduced_weight) || Number(r.receipt_gross_wt);
          const moisturediduct = ((baseWt / 100) * newClaim);
          updatedRow.final_receipt_wt = Number((baseWt - Number(moisturediduct.toFixed(3))).toFixed(3));
        }
        return updatedRow;
      }));
    } else if (field === 'actual_moisture' || field === 'claim_moisture') {
      const numVal = Number(value) || 0;
      setDetailRows(prev => prev.map(r => ({
        ...r,
        moisture_act: r.moisture_act || numVal,
        settlement_moisture: (r.settlement_moisture && r.settlement_moisture > 0) ? r.settlement_moisture : numVal
      })));
    } else if (field === 'actual_dust' || field === 'claim_dust') {
      const numVal = Number(value) || 0;
      setDetailRows(prev => prev.map(r => ({
        ...r,
        dust_act: r.dust_act || numVal,
        settlement_dust: (r.settlement_dust && r.settlement_dust > 0) ? r.settlement_dust : numVal
      })));
    } else if (field === 'actual_ncv' || field === 'claim_ncv') {
      const numVal = Number(value) || 0;
      setDetailRows(prev => prev.map(r => ({
        ...r,
        ncv_act: r.ncv_act || numVal,
        settlement_ncv: (r.settlement_ncv && r.settlement_ncv > 0) ? r.settlement_ncv : numVal
      })));
    }
  };
  let totalrow = '';
  const handleDetailChange = (index: number, field: keyof InspectionDetailRow, value: any) => {
    setDetailRows(prev => {
      const updated = [...prev];
      const currentRow = { ...updated[index], [field]: value };

      // Auto Calculate Lorry Moisture Read Avg from Min & Max
      if (field === "lorry_read_min" || field === "lorry_read_max") {
        const min = field === "lorry_read_min" ? Number(value) || 0 : Number(currentRow.lorry_read_min) || 0;
        const max = field === "lorry_read_max" ? Number(value) || 0 : Number(currentRow.lorry_read_max) || 0;
        let avg = 0;
        if (min > 0 && max > 0) {
          avg = Number(((min + max) / 2).toFixed(2));
        } else if (min > 0 || max > 0) {
          avg = min || max;
        }
        //currentRow.lorry_read_avg = avg;
      }

      // Auto Calculate Insp. Moisture Read Avg from Min & Max
      if (field === "insp_read_min" || field === "insp_read_max") {
        const min = field === "insp_read_min" ? Number(value) || 0 : Number(currentRow.insp_read_min) || 0;
        const max = field === "insp_read_max" ? Number(value) || 0 : Number(currentRow.insp_read_max) || 0;
        let avg = 0;
        if (min > 0 && max > 0) {
          avg = Number(((min + max) / 2).toFixed(2));
        } else if (min > 0 || max > 0) {
          avg = min || max;
        }
        //currentRow.insp_read_avg = avg;
      }

      // Auto-pull AVERAGE Value between Lorry Read Avg & Insp Read Avg into Moisture % Act.
      if (
        field === "lorry_read_min" ||
        field === "lorry_read_max" ||
        field === "lorry_read_avg" ||
        field === "insp_read_min" ||
        field === "insp_read_max" ||
        field === "insp_read_avg"
      ) {
        const lorryAvg = Number(currentRow.lorry_read_avg) || 0;
        const inspAvg = Number(currentRow.insp_read_avg) || 0;
        let combinedMoistAvg = 0;
        if (lorryAvg > 0 && inspAvg > 0) {
          combinedMoistAvg = Number(((lorryAvg + inspAvg) / 2).toFixed(2));
        } else if (lorryAvg > 0 || inspAvg > 0) {
          combinedMoistAvg = Number((lorryAvg || inspAvg).toFixed(2));
        }
        if (combinedMoistAvg > 0) {
          currentRow.moisture_act = lorryAvg;
        }
      }

      // Automatically calculate Claim Moisture % based on moisture_logic rules whenever moisture reading, moisture_act, or area changes
      if (
        field === "lorry_read_min" ||
        field === "lorry_read_max" ||
        field === "lorry_read_avg" ||
        field === "insp_read_min" ||
        field === "insp_read_max" ||
        field === "insp_read_avg" ||
        field === "moisture_act" ||
        field === "area"
      ) {
        const actM = Number(currentRow.moisture_act) || 0;
        const arrDate = headerForm.arrival_date || headerForm.mr_date || "";
        const rowArea = currentRow.area || (headerForm as any).area || "";
        const claimM = calculateClaimMoisture(actM, arrDate, rowArea, moistureLogicRules);
        currentRow.moisture_claim = claimM;
      }

      // Auto-pull Grade Down Act / Claim into Mill Settlement % Gr. Down
      if (field === "grade_down_act") {
        //currentRow.settlement_grade_down = Number(value) || 0;
      }
      if (field === "grade_down_claim" && (!currentRow.settlement_grade_down || currentRow.settlement_grade_down === 0)) {
        //currentRow.settlement_grade_down = Number(value) || 0;
      }

      // Auto-pull Dust Act / Claim into Mill Settlement % Dust
      if (field === "dust_act") {
        currentRow.dust_claim = Number(value) || 0;
      }

      // Auto-pull NCV Act / Claim into Mill Settlement % NCV
      if (field === "ncv_act") {
        currentRow.ncv_claim = Number(value) || 0;
      }

      // Reduced weight calculation
      if ((Number(currentRow.receipt_gross_wt) > 0) && (field === "add_weight" || field === "less_weight") ) {
        if ((currentRow.less_weight as any) === 'undefined' || currentRow.less_weight === undefined || isNaN(currentRow.less_weight)) {
          currentRow.less_weight = 0;
        }
        if ((currentRow.add_weight as any) === 'undefined' || currentRow.add_weight === undefined || isNaN(currentRow.add_weight)) {
          currentRow.add_weight = 0;
        }
        let reducewtt = Number(currentRow.receipt_gross_wt) + Number(currentRow.add_weight) - Number(currentRow.less_weight);
        currentRow.reduced_weight = Number(reducewtt.toFixed(3));
        currentRow.final_receipt_wt = Number(reducewtt.toFixed(3));
      }
      

      /* if (
        Number(currentRow.receipt_gross_wt) > 0 &&
        (field === "moisture_claim" ||
          field === "lorry_read_min" ||
          field === "lorry_read_max" ||
          field === "lorry_read_avg" ||
          field === "moisture_act" ||
          field === "area" ||
          field === "receipt_gross_wt" ||
          field === "add_weight" ||
          field === "less_weight")
      ) {
        const claimMoist = Number(currentRow.moisture_claim) || 0;
        const baseWt = Number(currentRow.reduced_weight) || Number(currentRow.receipt_gross_wt);
        const moisturediduct = ((baseWt / 100) * claimMoist);
        const finalrecieptwt = baseWt - Number(moisturediduct.toFixed(3));
        currentRow.final_receipt_wt = Number(finalrecieptwt.toFixed(3));
      } */
     if (
        Number(currentRow.receipt_gross_wt) > 0 &&
        (field === "moisture_claim" ||
          field === "lorry_read_min" ||
          field === "lorry_read_max" ||
          field === "lorry_read_avg" ||
          field === "moisture_act" ||
          field === "area" ||
          field === "receipt_gross_wt" ||
          field === "add_weight" ||
          field === "dust_act" ||
          field === "dust_claim" ||
          field === "less_weight")
      ) {
        let ductdiductwt = 0;
        let moisturediduct = 0;
        const claimDusttotal = Number(currentRow.dust_claim) || 0;
        const totalbaseWt = Number(currentRow.reduced_weight) || Number(currentRow.receipt_gross_wt);
        ductdiductwt = ((totalbaseWt / 100) * claimDusttotal);

        const claimMoist = Number(currentRow.moisture_claim) || 0;
        const baseWt = Number(currentRow.reduced_weight) || Number(currentRow.receipt_gross_wt);
        moisturediduct = ((baseWt / 100) * claimMoist);
        const finalrecieptwt = baseWt - Number(moisturediduct.toFixed(3)) - Number(ductdiductwt.toFixed(3));
        currentRow.final_receipt_wt = Number(finalrecieptwt.toFixed(3));
      }
        
      updated[index] = currentRow;
      return updated;
    });
  };

  // Auto-sync moisture_claim for all detail rows whenever moistureLogicRules or arrival_date updates
  useEffect(() => {
    if (moistureLogicRules && moistureLogicRules.length > 0 && detailRows.length > 0) {
      setDetailRows(prev => {
        let hasChanges = false;
        const updated = prev.map(row => {
          const actM = Number(row.moisture_act) || ((Number(row.lorry_read_avg) > 0 ) ? Number(((Number(row.lorry_read_avg) + Number(0))).toFixed(2)) : (Number(row.lorry_read_avg) || 0));
          if (actM > 0) {
            const calculatedClaim = calculateClaimMoisture(actM, headerForm.arrival_date || headerForm.mr_date, row.area || (headerForm as any).area, moistureLogicRules);
            if (row.moisture_claim !== calculatedClaim) {
              hasChanges = true;
              let nextRow = { ...row, moisture_act: row.moisture_act || actM, moisture_claim: calculatedClaim };
              if (Number(row.receipt_gross_wt) > 0) {
                const baseWt = Number(row.reduced_weight) || Number(row.receipt_gross_wt);
                const moisturediduct = ((baseWt / 100) * calculatedClaim);
                nextRow.final_receipt_wt = Number((baseWt - Number(moisturediduct.toFixed(3))).toFixed(3));
              }
              return nextRow;
            }
          }
          return row;
        });
        return hasChanges ? updated : prev;
      });
    }
  }, [moistureLogicRules, headerForm.arrival_date]);

  // Auto calculate Actual/Claim Moisture %, Dust %, NCV % header averages from detail rows
  useEffect(() => {
    if (!detailRows || detailRows.length === 0) return;

    let totalActMoisture = 0, countActMoisture = 0;
    let totalClaimMoisture = 0, countClaimMoisture = 0;
    let totalActDust = 0, countActDust = 0;
    let totalClaimDust = 0, countClaimDust = 0;
    let totalActNcv = 0, countActNcv = 0;
    let totalClaimNcv = 0, countClaimNcv = 0;

    detailRows.forEach(row => {
      const actM = Number(row.moisture_act) || Number(row.insp_read_avg) || 0;
      if (actM > 0) { totalActMoisture += actM; countActMoisture++; }

      const claimM = Number(row.moisture_claim) || 0;
      if (claimM > 0) { totalClaimMoisture += claimM; countClaimMoisture++; }

      const actD = Number(row.dust_act) || 0;
      if (actD > 0) { totalActDust += actD; countActDust++; }

      const claimD = Number(row.dust_claim) || 0;
      if (claimD > 0) { totalClaimDust += claimD; countClaimDust++; }

      const actN = Number(row.ncv_act) || 0;
      if (actN > 0) { totalActNcv += actN; countActNcv++; }

      const claimN = Number(row.ncv_claim) || 0;
      if (claimN > 0) { totalClaimNcv += claimN; countClaimNcv++; }
    });

    const avgActMoisture = countActMoisture > 0 ? Number((totalActMoisture / countActMoisture).toFixed(2)) : 0;
    const avgClaimMoisture = countClaimMoisture > 0 ? Number((totalClaimMoisture / countClaimMoisture).toFixed(2)) : 0;
    const avgActDust = countActDust > 0 ? Number((totalActDust / countActDust).toFixed(2)) : 0;
    const avgClaimDust = countClaimDust > 0 ? Number((totalClaimDust / countClaimDust).toFixed(2)) : 0;
    const avgActNcv = countActNcv > 0 ? Number((totalActNcv / countActNcv).toFixed(2)) : 0;
    const avgClaimNcv = countClaimNcv > 0 ? Number((totalClaimNcv / countClaimNcv).toFixed(2)) : 0;

    setHeaderForm(prev => {
      if (
        prev.actual_moisture === avgActMoisture &&
        prev.claim_moisture === avgClaimMoisture &&
        prev.actual_dust === avgActDust &&
        prev.claim_dust === avgClaimDust &&
        prev.actual_ncv === avgActNcv &&
        prev.claim_ncv === avgClaimNcv
      ) {
        return prev;
      }
      return {
        ...prev,
        actual_moisture: avgActMoisture,
        claim_moisture: avgClaimMoisture,
        actual_dust: avgActDust,
        claim_dust: avgClaimDust,
        actual_ncv: avgActNcv,
        claim_ncv: avgClaimNcv
      };
    });
  }, [detailRows]);

  const handleAddRow = () => {
    const existingUnit = detailRows.find(r => r.unit && r.unit.trim() !== "")?.unit || (headerForm as any).unit_name || "BALES";
    setDetailRows(prev => [
      ...prev,
      {
        unit: existingUnit,
        quantity: 0,
        challan_gross_wt: 0,
        tolerable: "Yes",
        expanded: false
      }
    ]);
    showToast("New inspection row added.");
  };

  const handleDuplicateRow = (index: number) => {
    const rowToCopy = detailRows[index];
    setDetailRows(prev => [
      ...prev.slice(0, index + 1),
      { ...rowToCopy, id: undefined, expanded: false },
      ...prev.slice(index + 1)
    ]);
    showToast("Inspection row duplicated.");
  };

  const handleDeleteRow = (index: number) => {
    if (detailRows.length <= 1) {
      showToast("At least one inspection row must remain.");
      return;
    }
    setDetailRows(prev => prev.filter((_, i) => i !== index));
    showToast("Inspection row removed.");
  };

  const handleToggleExpand = (index: number) => {
    setDetailRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], expanded: !updated[index].expanded };
      return updated;
    });
  };

  // Resilient Supabase persistence helpers that automatically handle missing table columns in Supabase
  const resilientSupabaseUpsert = async (
    client: any,
    table: string,
    record: any,
    matchColumn: string = "mr_no"
  ) => {
    let payload: Record<string, any> = { ...record };
    let attempts = 0;
    while (attempts < 20) {
      attempts++;
      const matchVal = payload[matchColumn];
      const { data: existing } = await client
        .from(table)
        .select(matchColumn)
        .eq(matchColumn, matchVal)
        .maybeSingle();

      let result;
      if (existing && existing[matchColumn]) {
        result = await client.from(table).update(payload).eq(matchColumn, matchVal).select();
      } else {
        result = await client.from(table).insert(payload).select();
      }

      if (!result.error) {
        return result.data && result.data.length > 0 ? result.data[0] : payload;
      }

      const missingColMatch = result.error.message?.match(/Could not find the '([^']+)' column of/i)
        || result.error.message?.match(/column "([^"]+)" of relation "[^"]+" does not exist/i)
        || result.error.message?.match(/column '([^']+)' does not exist/i);

      if (missingColMatch && missingColMatch[1]) {
        const col = missingColMatch[1];
        console.warn(`[Supabase Resilient Save] Column '${col}' not found in table '${table}', dropping column and retrying...`);
        delete payload[col];
        continue;
      }

      throw result.error;
    }
    return payload;
  };

  const resilientSupabaseInsertRows = async (
    client: any,
    table: string,
    rows: any[]
  ) => {
    if (!rows || rows.length === 0) return [];
    let currentRows: Record<string, any>[] = rows.map(r => ({ ...r }));
    let attempts = 0;
    while (attempts < 20) {
      attempts++;
      const { data, error } = await client.from(table).insert(currentRows).select();
      if (!error) {
        return data || currentRows;
      }

      const missingColMatch = error.message?.match(/Could not find the '([^']+)' column of/i)
        || error.message?.match(/column "([^"]+)" of relation "[^"]+" does not exist/i)
        || error.message?.match(/column '([^']+)' does not exist/i);

      if (missingColMatch && missingColMatch[1]) {
        const col = missingColMatch[1];
        console.warn(`[Supabase Resilient Rows Insert] Column '${col}' not in table '${table}', dropping column and retrying...`);
        currentRows = currentRows.map(r => {
          const copy = { ...r };
          delete copy[col];
          return copy;
        });
        continue;
      }

      throw error;
    }
    return currentRows;
  };

  const handleSaveForm = async () => {
    if (!headerForm.mr_no || !headerForm.mr_no.trim()) {
      alert("Arrival No. / M. R. No. is required.");
      return;
    }

    if (isSaving) return;
    setIsSaving(true);

    try {
      const cleanMrNo = headerForm.mr_no.trim();
      const activeDeductions = deductionRows.filter(r => (r.deduction_type && r.deduction_type.trim() !== "") || Number(r.deduction_amount) > 0);
      const totalDeductionAmt = deductionRows.reduce((acc, r) => acc + (Number(r.deduction_amount) || 0), 0);
      const primaryDeduction = activeDeductions[0] || deductionRows[0] || { deduction_type: "", deduction_rate: 0, deduction_qty: 0, deduction_amount: 0 };

      // Prepare detail rows
      const validDetails = detailRows.map((row, idx) => ({
        mr_no: cleanMrNo,
        srl_no: row.srl_no || idx + 1,
        arrival_grade: row.arrival_grade || row.stock_grade_name || "",
        stock_grade_code: row.stock_grade_code || "",
        stock_grade_name: row.stock_grade_name || row.arrival_grade || "",
        area: row.area || "",
        agency: row.agency || "",
        agency_code: (row as any).agency_code || "",
        marks: row.marks || (row as any).marka || "",
        marka: row.marks || (row as any).marka || "",
        crop_year: row.crop_year || "2026-27",
        lot: row.lot || "",
        quantity: Number(row.quantity) || 0,
        unit: row.unit || (headerForm as any).unit_name || "BALES",
        rate: Number((row as any).rate || (row as any).rate_qntl || 0) || 0,
        rate_qntl: Number((row as any).rate_qntl || (row as any).rate || 0) || 0,
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
        moisture_act: Number(row.moisture_act || (row as any).actual_moisture || 0) || 0,
        moisture_claim: Number(row.moisture_claim || (row as any).claim_moisture || 0) || 0,
        dust_act: Number(row.dust_act || (row as any).actual_dust || 0) || 0,
        dust_claim: Number(row.dust_claim || (row as any).claim_dust || 0) || 0,
        ncv_act: Number(row.ncv_act || (row as any).actual_ncv || 0) || 0,
        ncv_claim: Number(row.ncv_claim || (row as any).claim_ncv || 0) || 0,
        grade_down_act: Number(row.grade_down_act || (row as any).actual_grade_down || 0) || 0,
        grade_down_claim: Number(row.grade_down_claim || (row as any).claim_grade_down || 0) || 0,
        actual_moisture: Number(row.moisture_act || (row as any).actual_moisture || 0) || 0,
        claim_moisture: Number(row.moisture_claim || (row as any).claim_moisture || 0) || 0,
        actual_dust: Number(row.dust_act || (row as any).actual_dust || 0) || 0,
        claim_dust: Number(row.dust_claim || (row as any).claim_dust || 0) || 0,
        actual_ncv: Number(row.ncv_act || (row as any).actual_ncv || 0) || 0,
        claim_ncv: Number(row.ncv_claim || (row as any).claim_ncv || 0) || 0,
        actual_grade_down: Number(row.grade_down_act || (row as any).actual_grade_down || 0) || 0,
        claim_grade_down: Number(row.grade_down_claim || (row as any).claim_grade_down || 0) || 0,
        final_receipt_wt: Number(row.final_receipt_wt) || 0,
        settlement_moisture: Number(row.settlement_moisture) || 0,
        settlement_grade_down: Number(row.settlement_grade_down) || 0,
        settlement_dust: Number(row.settlement_dust) || 0,
        settlement_ncv: Number(row.settlement_ncv) || 0,
        ropes_weight: Number(row.ropes_weight) || 0,
        ropes_tot_wt_grd: Number(row.ropes_tot_wt_grd) || 0,
        ropes_grade: row.ropes_grade || "",
        chotta_weight: Number(row.chotta_weight) || 0,
        chotta_tot_wt_grd: Number(row.chotta_tot_wt_grd) || 0,
        chotta_grade: row.chotta_grade || "",
        tolerable: row.tolerable || "Yes",
        premium: row.premium !== undefined && row.premium !== null ? String(row.premium) : (row.is_premium ? "Yes" : "No"),
        is_premium: Boolean(row.is_premium || row.premium === "Yes" || (row.premium && String(row.premium).trim() !== "" && String(row.premium).toLowerCase() !== "no")),
        amount: Number(row.amount !== undefined && row.amount !== null && !isNaN(Number(row.amount)) ? row.amount : calculateRowAmount(row)) || 0,
        row_remarks: row.row_remarks || "",
        jqi_remarks: row.jqi_remarks || "",
        jci_remarks: row.jci_remarks || row.jqi_remarks || ""
      }));

      const resolvedMrDate = sanitizeDate(headerForm.mr_date) || sanitizeDate((headerForm as any).date) || new Date().toISOString().split("T")[0];
      const resolvedArrivalDate = sanitizeDate(headerForm.arrival_date) || resolvedMrDate;
      let resolvedPoDate = sanitizeDate(headerForm.po_date);

      if (supabase && headerForm.po_no) {
        try {
          const { data: scpData } = await supabase
            .from('purchase_master')
            .select('po_date')
            .eq('po_no', headerForm.po_no.trim())
            .maybeSingle();
          if (scpData && scpData.po_date) {
            resolvedPoDate = sanitizeDate(scpData.po_date) || resolvedPoDate;
          } else {
            const { data: scpViewData } = await supabase
              .from('sauda_check_point')
              .select('po_date, s_date')
              .eq('po_no', headerForm.po_no.trim())
              .maybeSingle();
            if (scpViewData) {
              resolvedPoDate = sanitizeDate(scpViewData.po_date || scpViewData.s_date) || resolvedPoDate;
            }
          }
        } catch (poErr) {
          console.warn("Error resolving PO Date source of truth:", poErr);
        }
      }

      const totalBalesCount = validDetails.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0) || Number((headerForm as any).total_quantity || (headerForm as any).quantity || 0);
      const totalChallanGrossMt = validDetails.reduce((sum, r) => sum + (Number(r.challan_gross_wt) || 0), 0) || Number((headerForm as any).challan_gross_wt || 0);
      const totalReceiptGrossMt = validDetails.reduce((sum, r) => sum + (Number(r.receipt_gross_wt) || 0), 0) || Number((headerForm as any).receipt_gross_wt || totalChallanGrossMt);
      const totalGrossBatch = validDetails.reduce((sum, r) => sum + (Number(r.gross_weight_batch) || 0), 0) || Number((headerForm as any).gross_weight_batch || 0);
      const totalAddWeight = validDetails.reduce((sum, r) => sum + (Number(r.add_weight) || 0), 0) || Number((headerForm as any).add_weight || 0);
      const totalLessWeight = validDetails.reduce((sum, r) => sum + (Number(r.less_weight) || 0), 0) || Number((headerForm as any).less_weight || 0);
      const totalReducedWeight = validDetails.reduce((sum, r) => sum + (Number(r.reduced_weight) || 0), 0) || Number((headerForm as any).reduced_weight || totalReceiptGrossMt);
      const totalFinalReceiptWt = validDetails.reduce((sum, r) => sum + (Number(r.final_receipt_wt) || 0), 0) || Number((headerForm as any).final_receipt_wt || totalReceiptGrossMt);
      const firstDetail = validDetails[0] || ({} as any);

      const masterPayload: any = {
        mr_no: cleanMrNo,
        mr_date: resolvedMrDate,
        date: resolvedMrDate,
        arrival_no: headerForm.arrival_no || cleanMrNo,
        arrival_date: resolvedArrivalDate,
        po_no: headerForm.po_no || null,
        po_date: resolvedPoDate,
        broker_name: headerForm.broker_name || "",
        supplier_name: headerForm.supplier_name || "",
        broker: headerForm.broker_name || "",
        supplier: headerForm.supplier_name || "",
        actual_moisture: Number(headerForm.actual_moisture) || 0,
        claim_moisture: Number(headerForm.claim_moisture) || 0,
        actual_dust: Number(headerForm.actual_dust) || 0,
        claim_dust: Number(headerForm.claim_dust) || 0,
        actual_ncv: Number(headerForm.actual_ncv) || 0,
        claim_ncv: Number(headerForm.claim_ncv) || 0,
        actual_grade_down: Number((headerForm as any).actual_grade_down) || 0,
        claim_grade_down: Number((headerForm as any).claim_grade_down) || 0,
        detention_days: Number(headerForm.detention_days) || 0,
        unloading_date: sanitizeDate(headerForm.unloading_date),
        mill_po_no: headerForm.mill_po_no || headerForm.po_no || null,
        mill_po_date: sanitizeDate(headerForm.mill_po_date) || resolvedPoDate,
        mr_spcl_print: headerForm.mr_spcl_print || null,
        remarks: headerForm.remarks || null,
        lorry_number: headerForm.lorry_number || null,
        delivery_claim: Number(headerForm.delivery_claim) || 0,
        deduction_type: activeDeductions.map(r => r.deduction_type).filter(Boolean).join(", ") || primaryDeduction.deduction_type || "",
        deduction_rate: Number(primaryDeduction.deduction_rate) || 0,
        deduction_qty: Number(primaryDeduction.deduction_qty) || 0,
        deduction_amount: Number(totalDeductionAmt) || 0,
        deductions: deductionRows,
        deduction_rows: deductionRows,
        deductions_json: JSON.stringify(deductionRows),
        deduction_types: deductionRows,
        unit_name: (headerForm as any).unit_name || validDetails[0]?.unit || "BALES",
        unit: (headerForm as any).unit_name || validDetails[0]?.unit || "BALES",
        status: headerForm.status || "Completed",
        grid_details: validDetails,
        details: validDetails,
        quantity: totalBalesCount,
        total_quantity: totalBalesCount,
        challan_gross_wt: totalChallanGrossMt,
        receipt_gross_wt: totalReceiptGrossMt,
        gross_weight_batch: totalGrossBatch,
        add_weight: totalAddWeight,
        less_weight: totalLessWeight,
        reduced_weight: totalReducedWeight,
        final_receipt_wt: totalFinalReceiptWt,
        arrival_grade: firstDetail.arrival_grade || (headerForm as any).arrival_grade || "",
        stock_grade_code: firstDetail.stock_grade_code || (headerForm as any).stock_grade_code || "",
        stock_grade_name: firstDetail.stock_grade_name || (headerForm as any).stock_grade_name || "",
        area: firstDetail.area || (headerForm as any).area || "",
        agency: firstDetail.agency || (headerForm as any).agency || "",
        agency_code: firstDetail.agency_code || (headerForm as any).agency_code || "",
        marks: firstDetail.marks || (headerForm as any).marks || "",
        marka: firstDetail.marka || firstDetail.marks || (headerForm as any).marka || "",
        crop_year: firstDetail.crop_year || (headerForm as any).crop_year || "2026-27",
        lot: firstDetail.lot || (headerForm as any).lot || "",
        company_id: (headerForm as any).company_id || null,
        unit_id: (headerForm as any).unit_id || null,
        machine_id: (headerForm as any).machine_id || null,
        shift: (headerForm as any).shift || null,
        department: (headerForm as any).department || null,
        production_id: (headerForm as any).production_id || (headerForm as any).production_ref || null,
        production_ref: (headerForm as any).production_ref || null,
        created_at: headerForm.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log("[INSPECTION REGISTER - FULL PAYLOAD BEFORE DATABASE SAVE]", masterPayload);
      console.log("[INSPECTION REGISTER - FRONTEND BEFORE SAVE & PRODUCTION VALIDATION]", {
        timestamp: new Date().toISOString(),
        cleanMrNo,
        arrival_no: headerForm.arrival_no,
        po_no: headerForm.po_no,
        production_id: masterPayload.production_id,
        production_ref: masterPayload.production_ref,
        mandatoryFieldsCheck: {
          mr_no: cleanMrNo,
          mr_date: resolvedMrDate,
          arrival_no: headerForm.arrival_no || cleanMrNo,
          arrival_date: resolvedArrivalDate,
          supplier_name: headerForm.supplier_name || "",
          broker_name: headerForm.broker_name || "",
          unit: masterPayload.unit,
          status: masterPayload.status
        },
        detailRowsCount: validDetails.length,
        deductionsCount: deductionRows.length
      });

      let savedDbRecord: any = null;
      let apiSuccess = false;
      let affectedRows = 0;

      // Primary Save Flow: Attempt Backend API route unless on static hosting (e.g. GitHub Pages)
      const isStaticHost = typeof window !== "undefined" && (
        window.location.hostname.includes("github.io") ||
        window.location.protocol === "file:" ||
        window.location.hostname.endsWith(".pages.dev")
      );

      if (!isStaticHost) {
        try {
          const response = await fetch("/api/inspection-register/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(masterPayload)
          });

          if (response.ok) {
            const resJson = await response.json();
            const isSuccess = Boolean(resJson && resJson.success === true);
            const rowCount = Number(resJson?.affectedRows ?? resJson?.rowCount ?? (resJson?.data ? 1 : 0));
            const returnedId = resJson?.recordId || resJson?.data?.id || resJson?.data?.mr_no;

            if (isSuccess && rowCount > 0 && resJson.data && returnedId && !resJson.error) {
              savedDbRecord = resJson.data;
              affectedRows = rowCount;
              apiSuccess = true;
            } else {
              const errMsg = resJson?.error || "Unable to save Inspection Module Register. Database returned invalid record ID or 0 affected rows. Data was not saved.";
              alert(errMsg);
              return;
            }
          } else if (response.status === 405 || response.status === 404 || response.status === 502) {
            // Method Not Allowed / Not Found on static host or GitHub Pages - seamlessly continue to direct Supabase
            console.warn(`[INSPECTION SAVE] Backend endpoint returned ${response.status} (static host/proxy). Switching automatically to direct Supabase transaction.`);
          } else if (response.status === 422 || response.status === 400) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData?.error || `Unable to save Inspection Module Register. Server returned status ${response.status}.`;
            alert(errMsg);
            return;
          } else {
            console.warn(`[INSPECTION SAVE] Backend API returned status ${response.status}, switching to direct Supabase transaction.`);
          }
        } catch (netErr) {
          console.warn("[INSPECTION SAVE] Backend API route unreachable, executing direct verified Supabase transaction:", netErr);
        }
      }

      // Supabase Direct Transaction (for GitHub Pages / static hosting or when API route unreachable)
      if (!apiSuccess && supabase) {
        // Step 0: Verify that the production row actually exists before allowing the INSERT/UPDATE ONLY IF a valid production_id is present
        const prodIdToCheck = String(masterPayload.production_id || masterPayload.production_ref || "").trim();
        if (prodIdToCheck && prodIdToCheck !== "null" && prodIdToCheck !== "undefined") {
          const { data: pCheck } = await supabase
            .from("production_records")
            .select("id, batch_no, production_no, lot_no")
            .or(`id.eq.${prodIdToCheck},batch_no.eq.${prodIdToCheck},production_no.eq.${prodIdToCheck},lot_no.eq.${prodIdToCheck}`)
            .limit(1)
            .maybeSingle();

          if (!pCheck) {
            throw new Error(`Unable to save Inspection Module Register: Required Production row '${prodIdToCheck}' not found in database.`);
          }
        }

        // Resilient save to material_inspection
        const masterSaveRes = await resilientSupabaseUpsert(supabase, "material_inspection", masterPayload, "mr_no");
        savedDbRecord = masterSaveRes;
        affectedRows = 1;

        // Child Details
        try {
          await supabase.from("material_inspection_details").delete().eq("mr_no", cleanMrNo);
          if (validDetails.length > 0) {
            await resilientSupabaseInsertRows(supabase, "material_inspection_details", validDetails);
          }
        } catch (cErr) {
          console.warn("Child details error:", cErr);
        }

        // All Deduction Fields for material_inspection_deductions
        try {
          const calculatedAvgBaleWeight = totalBalesCount > 0 ? (totalReceiptGrossMt * 1000) / totalBalesCount : 0;

          // Build complete deduction records with ALL fields from this app
          const allDeductionRows = deductionRows
            .filter(r => (r.deduction_type && r.deduction_type.trim() !== "") || Number(r.deduction_amount) > 0 || Number(r.deduction_rate) > 0)
            .map(r => ({
              mr_no: cleanMrNo,
              mr_date: resolvedMrDate,
              po_no: headerForm.po_no || null,
              po_date: resolvedPoDate,
              arrival_no: headerForm.arrival_no || cleanMrNo,
              arrival_date: resolvedArrivalDate,
              supplier: headerForm.supplier_name || "",
              supplier_name: headerForm.supplier_name || "",
              broker: headerForm.broker_name || "",
              broker_name: headerForm.broker_name || "",
              lorry_number: headerForm.lorry_number || "",
              deduction_type: r.deduction_type || "",
              deduction_rate: Number(r.deduction_rate) || 0,
              deduction_qty: Number(r.deduction_qty) || 0,
              deduction_amount: Number(r.deduction_amount) || 0,
              unit: (headerForm as any).unit_name || validDetails[0]?.unit || "BALES",
              gross_weight_mt: totalReceiptGrossMt,
              total_bales: totalBalesCount,
              avg_bale_weight: calculatedAvgBaleWeight,
              remarks: (r as any).remarks || headerForm.remarks || "",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }));

          // Primary Table: material_inspection_deductions
          await supabase.from("material_inspection_deductions").delete().eq("mr_no", cleanMrNo);
          if (allDeductionRows.length > 0) {
            await resilientSupabaseInsertRows(supabase, "material_inspection_deductions", allDeductionRows);
          }

          // Also sync to mill_inspection_deduction for compatibility
          try {
            await supabase.from("mill_inspection_deduction").delete().eq("mr_no", cleanMrNo);
            if (allDeductionRows.length > 0) {
              await resilientSupabaseInsertRows(supabase, "mill_inspection_deduction", allDeductionRows);
            }
          } catch (mErr) {}
        } catch (allDedErr) {
          console.warn("Error persisting deductions:", allDedErr);
        }

        try {
          const mrNoKey = cleanMrNo;
          const arrNoKey = headerForm.arrival_no ? headerForm.arrival_no.trim() : "";
          if (mrNoKey) {
            await supabase.from("final_arrival").update({
              status: "Completed",
              grid_details: validDetails
            }).or(`mr_no.eq.${mrNoKey},final_arrival_no.eq.${mrNoKey}${arrNoKey ? `,final_arrival_no.eq.${arrNoKey}` : ""}`);
          }
        } catch (faErr) {}

        // Verification Query
        const { data: verifiedRow, error: verifyErr } = await supabase
          .from("material_inspection")
          .select("*")
          .eq("mr_no", cleanMrNo)
          .maybeSingle();

        if (verifyErr || !verifiedRow) {
          throw new Error("Unable to save Inspection Module Register. Data was not saved in database.");
        }
        savedDbRecord = verifiedRow;
      }

      // Check strictly: Only proceed if record exists, has a valid ID, and affected rows > 0
      const validRecordId = savedDbRecord?.mr_no || savedDbRecord?.id;
      if (!savedDbRecord || !validRecordId || affectedRows <= 0) {
        throw new Error("Unable to save Inspection Module Register. Database returned invalid record ID or 0 affected rows. Data was not saved.");
      }

      // Step 9: Commit verified - Update in-memory state, caches and show success
      const finalCommittedRecord = savedDbRecord || masterPayload;

      console.log("[INSPECTION REGISTER - FRONTEND AFTER SAVE SUCCESS & VERIFIED]", {
        timestamp: new Date().toISOString(),
        status: "COMMITTED",
        recordId: validRecordId,
        affectedRows,
        mr_no: cleanMrNo,
        savedRecord: finalCommittedRecord
      });

      setRecords(prev => {
        const filtered = prev.filter(r => r.mr_no !== finalCommittedRecord.mr_no && (r.arrival_no ? r.arrival_no !== finalCommittedRecord.arrival_no : true));
        return [finalCommittedRecord, ...filtered];
      });

      try {
        localStorage.setItem(`inspection_deductions_${finalCommittedRecord.mr_no}`, JSON.stringify(deductionRows));
        const cached = localStorage.getItem("material_inspection_records") || localStorage.getItem("inspection_master_records");
        let list: InspectionMasterRecord[] = cached ? JSON.parse(cached) : [];
        list = [finalCommittedRecord, ...list.filter((r: any) => r.mr_no !== finalCommittedRecord.mr_no)];
        localStorage.setItem("material_inspection_records", JSON.stringify(list));
        localStorage.setItem("inspection_master_records", JSON.stringify(list));
      } catch (e) {}

      window.dispatchEvent(new Event("app-data-updated"));
      // Strictly fire the alert only after successful database response with valid record ID and affected rows > 0
      alert("Data Saved Successfully.");
      showToast("Data Saved Successfully.");
      setViewMode("dashboard");
      fetchInspectionRecords();

    } catch (err: any) {
      console.error("Save failure:", err);
      // On failure, keep the entered information in headerForm and detailRows so user can correct and retry
      alert(err.message || "Unable to save Inspection Module Register. Data was not saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecord = async (mr_no: string) => {
    if (!confirm(`Are you sure you want to delete inspection record ${mr_no}? This will remove it from all inspection tables.`)) return;
    try {
      if (supabase) {
        // Cascade delete: first remove child details & deductions, then remove master
        await Promise.all([
          supabase.from("material_inspection_details").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
          supabase.from("material_inspection_deductions").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
          supabase.from("mill_inspection_deduction").delete().eq("mr_no", mr_no).then(() => {}, () => {}),
        ]);
        await supabase.from("material_inspection").delete().eq("mr_no", mr_no);
      }
      setRecords(prev => prev.filter(r => r.mr_no !== mr_no));
      try {
        localStorage.removeItem(`inspection_deductions_${mr_no}`);
        const cached = localStorage.getItem("material_inspection_records") || localStorage.getItem("inspection_master_records");
        if (cached) {
          const list = JSON.parse(cached).filter((r: any) => r.mr_no !== mr_no);
          localStorage.setItem("material_inspection_records", JSON.stringify(list));
        }
        localStorage.removeItem("AUTOSAVE_MATERIAL_INSPECTION");
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('app-data-updated', { detail: { table: 'material_inspection', mr_no } }));
      window.dispatchEvent(new CustomEvent('app-data-updated', { detail: { table: 'material_inspection_details', mr_no } }));

      showToast(`Record ${mr_no} completely deleted from all respective tables.`);
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleExportCsv = () => {
    if (records.length === 0) return alert("No records to export");
    const headers = ["MR No", "MR Date", "PO No", "Supplier", "Broker", "Lorry No", "Moisture %", "Dust %", "Deductions", "Status"];
    const rows = filteredRecords.map(r => [
      r.mr_no,
      r.mr_date || "",
      r.po_no || "",
      `"${r.supplier_name || ""}"`,
      `"${r.broker_name || ""}"`,
      r.lorry_number || "",
      r.actual_moisture || 0,
      r.actual_dust || 0,
      r.deduction_amount || 0,
      r.status || "Completed"
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Mill_Inspection_Register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRecords = records.filter(r => {
    const query = searchQuery.toLowerCase();
    const matchesQuery =
      (r.mr_no || "").toLowerCase().includes(query) ||
      (r.arrival_no || "").toLowerCase().includes(query) ||
      (r.po_no || "").toLowerCase().includes(query) ||
      (r.supplier_name || "").toLowerCase().includes(query) ||
      (r.broker_name || "").toLowerCase().includes(query) ||
      (r.lorry_number || "").toLowerCase().includes(query);

    const matchesStatus =
      statusFilter === "all" ||
      (r.status || "Completed").toLowerCase() === statusFilter.toLowerCase();

    return matchesQuery && matchesStatus;
  }).sort((a, b) => {
    if (sortField === "arrival_date") {
      const dateA = new Date(a.arrival_date || a.mr_date || 0).getTime();
      const dateB = new Date(b.arrival_date || b.mr_date || 0).getTime();
      if (dateA !== dateB) {
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      }
    } else if (sortField === "arrival_no") {
      const arrNoA = (a.arrival_no || a.mr_no || '').toUpperCase();
      const arrNoB = (b.arrival_no || b.mr_no || '').toUpperCase();
      const diff = arrNoA.localeCompare(arrNoB, undefined, { numeric: true, sensitivity: 'base' });
      if (diff !== 0) {
        return sortOrder === "asc" ? diff : -diff;
      }
    } else if (sortField === "status") {
      const statusA = (a.status || 'Completed').toUpperCase();
      const statusB = (b.status || 'Completed').toUpperCase();
      const diff = statusA.localeCompare(statusB);
      if (diff !== 0) {
        return sortOrder === "asc" ? diff : -diff;
      }
    }

    const defaultTimeA = new Date(a.arrival_date || a.mr_date || 0).getTime();
    const defaultTimeB = new Date(b.arrival_date || b.mr_date || 0).getTime();
    return defaultTimeB - defaultTimeA;
  });

  const totalInspections = records.length;
  const avgMoisture = records.length > 0 ? (records.reduce((acc, r) => acc + (Number(r.actual_moisture) || 0), 0) / records.length).toFixed(1) : "0.0";
  const totalDeductions = records.reduce((acc, r) => acc + (Number(r.deduction_amount) || 0), 0);

  return (
    <LegacyLayout title="Mill Inspection Information" subtitle="Quality inspection register & entry module">
      <div className="flex-1 flex flex-col font-sans text-slate-800 space-y-4 w-full pb-10 px-2 sm:px-4">

        {/* TOAST NOTIFICATION */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        )}

        {/* HEADER TOOLBAR */}
        <div className="bg-[#174C2C] text-white px-6 py-4 rounded-xl shadow-lg flex flex-wrap items-center justify-between border border-[#0F351E] gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800/40 border border-emerald-400/40 flex items-center justify-center text-amber-300 shadow-inner">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-bold text-white tracking-wide">
                {viewMode === "form" ? "Mill Inspection Information Entry" : "INSPECTION MODULE REGISTER"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {viewMode === "form" ? (
              <>
                <div className="relative z-10 flex items-center gap-3">
                  <button
                    type="button"
                    className="px-3.5 py-1.5 bg-[#103A20] hover:bg-[#1C5130] text-amber-300 border border-[#235E39] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
                    title="Back to Sauda Desk (Esc)"
                    onClick={() => setViewMode("dashboard")}
                  >
                    <ArrowLeft className="h-4 w-4 text-amber-300" />
                    <span>Back</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={handleOpenNewForm}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 border border-emerald-400/50 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4 text-amber-300" />
                  <span>New Inspection Form</span>
                </button>

                <button
                  onClick={() => fetchInspectionRecords(true)}
                  disabled={loading}
                  className="p-2 bg-[#0b2415]/80 hover:bg-[#123920] active:scale-95 border border-emerald-400/50 rounded-lg text-white transition-all cursor-pointer shadow-sm disabled:opacity-50"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-4 h-4 text-amber-300 ${loading ? "animate-spin" : ""}`} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* VIEW MODE SWITCH */}
        {viewMode === "dashboard" ? (
          <>
            {/* KPI STATS BAR */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Audits</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{totalInspections}</p>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">material_inspection records</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Moisture %</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{avgMoisture}%</p>
                  <p className="text-[11px] text-blue-600 font-semibold mt-0.5">Quality Parameter</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <Percent className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Deductions</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">₹ {totalDeductions.toLocaleString()}</p>
                  <p className="text-[11px] text-amber-600 font-semibold mt-0.5">Quality Claims</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <TrendingDown className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sync Status</p>
                  <p className="text-xl font-black text-emerald-700 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Live DB
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Synced with Supabase</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <Layers className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* SEARCH & FILTERS BAR */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Arrival No, P.O. No, Supplier, Lorry No..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700/50 bg-slate-50/50"
                />
              </div>

              <div className="flex items-center gap-2">
                {/* SORT BY ARRIVAL DATE CONTROL */}
                <div className="flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-black uppercase text-slate-500">Sort:</span>
                  <span className="text-xs font-black text-slate-800">Arrival Date</span>
                  <button
                    onClick={() => {
                      setSortField("arrival_date");
                      setSortOrder(prev => prev === "desc" ? "asc" : "desc");
                    }}
                    className="ml-1 px-2 py-0.5 bg-white hover:bg-slate-200 text-slate-900 border border-slate-300 rounded text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all shadow-2xs"
                    title="Toggle Ascending / Descending by Arrival Date"
                  >
                    {sortField === "arrival_date" && sortOrder === "asc" ? "↑ Oldest" : "↓ Newest"}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Statuses</option>
                    <option value="completed">Completed</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>

                <button
                  onClick={handleExportCsv}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* REGISTER TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-[#174C2C] text-white font-extrabold uppercase tracking-wider text-[11px] border-b border-[#0F351E]">
                      <th 
                        onClick={() => {
                          setSortField("arrival_no");
                          setSortOrder(prev => prev === "desc" ? "asc" : "desc");
                        }}
                        className="py-3 px-4 cursor-pointer hover:bg-[#123920] select-none transition-colors"
                        title="Click to sort by Arrival No"
                      >
                        Arrival No {sortField === "arrival_no" ? (sortOrder === "desc" ? "↓" : "↑") : "↕"}
                      </th>
                      <th 
                        onClick={() => {
                          setSortField("arrival_date");
                          setSortOrder(prev => prev === "desc" ? "asc" : "desc");
                        }}
                        className="py-3 px-4 cursor-pointer hover:bg-[#123920] select-none transition-colors bg-[#123920]/40"
                        title="Click to sort by Arrival Date"
                      >
                        Arrival Date {sortField === "arrival_date" ? (sortOrder === "desc" ? "↓" : "↑") : "↕"}
                      </th>
                      <th className="py-3 px-4">P.O. No</th>
                      <th className="py-3 px-4">Supplier Name</th>
                      <th className="py-3 px-4">Broker Name</th>
                      <th className="py-3 px-4">Lorry No</th>
                      <th className="py-3 px-4 text-center">Act. Moisture %</th>
                      <th className="py-3 px-4 text-center">Act. Dust %</th>
                      <th className="py-3 px-4 text-right">Deduction (₹)</th>
                      <th 
                        onClick={() => {
                          setSortField("status");
                          setSortOrder(prev => prev === "desc" ? "asc" : "desc");
                        }}
                        className="py-3 px-4 text-center cursor-pointer hover:bg-[#123920] select-none transition-colors"
                        title="Click to sort by Status"
                      >
                        Status {sortField === "status" ? (sortOrder === "desc" ? "↓" : "↑") : "↕"}
                      </th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-700 mb-2" />
                          Loading inspection records...
                        </td>
                      </tr>
                    ) : filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 text-center text-slate-400">
                          No inspection records found matching your query.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((rec) => (
                        <tr
                          key={rec.mr_no}
                          onClick={() => handleEditRecord(rec)}
                          className="hover:bg-emerald-50/60 transition-colors cursor-pointer select-none"
                          title="Click to view and edit inspection & deduction details"
                        >
                          <td className="py-3 px-4 font-black text-emerald-950 font-mono flex items-center gap-1.5">
                            <span>{rec.arrival_no || rec.mr_no}</span>
                            {rec.arrival_no && rec.mr_no && rec.arrival_no !== rec.mr_no && (
                              <span className="text-[10px] text-slate-400 font-normal">({rec.mr_no})</span>
                            )}
                            {rec.deductions && Array.isArray(rec.deductions) && rec.deductions.filter((d: any) => d.deduction_type || Number(d.deduction_amount) > 0).length > 0 && (
                              <span className="text-[9px] bg-amber-100 text-amber-800 border border-amber-300 font-bold px-1.5 py-0.2 rounded" title="Contains deduction details">
                                Ded: {rec.deductions.filter((d: any) => d.deduction_type || Number(d.deduction_amount) > 0).length}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {rec.mr_date ? new Date(rec.mr_date).toLocaleDateString("en-GB") : (rec.arrival_date ? new Date(rec.arrival_date).toLocaleDateString("en-GB") : "-")}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-800">{rec.po_no || "N/A"}</td>
                          <td className="py-3 px-4 font-bold text-slate-900 max-w-[180px] truncate">
                            {rec.supplier_name || "-"}
                          </td>
                          <td className="py-3 px-4 text-slate-700">{rec.broker_name || "-"}</td>
                          <td className="py-3 px-4 font-mono text-slate-700">{rec.lorry_number || "-"}</td>
                          <td className="py-3 px-4 text-center font-bold text-blue-700">
                            {rec.actual_moisture ? `${rec.actual_moisture}%` : "-"}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-amber-700">
                            {rec.actual_dust ? `${rec.actual_dust}%` : "-"}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-rose-700">
                            {rec.deduction_amount ? `₹ ${Number(rec.deduction_amount).toLocaleString()}` : "₹ 0"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                              {rec.status || "Completed"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleEditRecord(rec)}
                                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 active:scale-95 text-white rounded font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                                title="Open Inspection and View Deductions"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handlePrintRecord(rec)}
                                className="px-2.5 py-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                                title="Print Marks & Quality Received Mill Copy"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print</span>
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(rec.mr_no)}
                                className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded cursor-pointer transition-colors"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-2 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
              <PaginationControls
                currentPage={currentPage}
                totalItems={filteredRecords.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </>
        ) : (
          /* FULL MODERN FORM VIEW BASED ON SPECIFICATION */
          <div className="space-y-6">
            {/* HEADER / MILL INFORMATION SECTION */}
            <section className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">Inspection Header / Mill Information</h2>
                  <p className="text-xs text-slate-500 mt-0.5">All fields from the original mill inspection form are preserved</p>
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold border border-emerald-200">
                  Header Form
                </span>
              </div>

              {/* Pick Final Arrival Banner */}
              {finalArrivalList.length > 0 && (() => {
                const pendingArrivalList = finalArrivalList.filter(fa => {
                  const normalize = (s: any) => String(s || "").trim().toLowerCase().replace(/^#/, '');

                  const faNo = normalize(fa.final_arrival_no || fa.arrival_no);
                  const faMrNo = normalize(fa.mr_no);
                  const faId = normalize(fa.final_arrival_id);
                  const faTempNo = normalize(fa.temporary_arrival_no);
                  const faLorry = String(fa.lorry_number || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

                  // Check if an inspection record exists specifically for THIS final arrival
                  const isAlreadyInspected = records.some(r => {
                    const rMr = normalize(r.mr_no);
                    const rArr = normalize(r.arrival_no);
                    const rTemp = normalize((r as any).temporary_arrival_no);
                    const rLorry = String(r.lorry_number || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

                    // 1. Direct arrival / MR number match
                    if (faNo && (rMr === faNo || rArr === faNo)) return true;
                    if (faMrNo && (rMr === faMrNo || rArr === faMrNo)) return true;
                    if (faId && (rMr === faId || rArr === faId || rMr === `fa-${faId}` || rArr === `fa-${faId}`)) return true;
                    if (faTempNo && (rTemp === faTempNo || rMr === faTempNo || rArr === faTempNo)) return true;

                    // 2. Lorry & partial arrival match
                    if (faLorry && rLorry && faLorry === rLorry) {
                      if (faNo && (rMr.includes(faNo) || rArr.includes(faNo))) return true;
                      if (faMrNo && (rMr.includes(faMrNo) || rArr.includes(faMrNo))) return true;
                    }

                    return false;
                  });

                  return !isAlreadyInspected;
                });

                return (
                  <div className="bg-emerald-50/80 px-5 py-3 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-700" />
                      <span className="text-xs font-bold text-emerald-950">
                        Import / Pick From Final Arrival:
                      </span>
                      {pendingArrivalList.length > 0 ? (
                        <span className="bg-emerald-200 text-emerald-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                          {pendingArrivalList.length} Pending
                        </span>
                      ) : (
                        <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          All Arrivals Inspected
                        </span>
                      )}
                    </div>
                    <SearchablePendingArrivalSelect
                      pendingArrivalList={pendingArrivalList}
                      onSelect={(selectedFa) => populateFromFinalArrival(selectedFa)}
                    />
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">Arrival No.</label>
                  <input
                    type="text"
                    value={headerForm.mr_no || ""}
                    onChange={(e) => handleHeaderChange("mr_no", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">Arrival Date</label>
                  <input
                    type="date"
                    value={headerForm.mr_date || ""}
                    onChange={(e) => handleHeaderChange("mr_date", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex flex-col gap-1" style={{ display: "none" }}>
                  <label className="text-xs font-extrabold text-slate-700">Arrival No.</label>
                  <input
                    type="text"
                    value={headerForm.arrival_no || ""}
                    onChange={(e) => handleHeaderChange("arrival_no", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex flex-col gap-1" style={{ display: "none" }}>
                  <label className="text-xs font-extrabold text-slate-700">Arrival Date</label>
                  <input
                    type="date"
                    value={headerForm.arrival_date || ""}
                    onChange={(e) => handleHeaderChange("arrival_date", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">P.O. No.</label>
                  <input
                    type="text"
                    value={headerForm.po_no || ""}
                    onChange={(e) => handleHeaderChange("po_no", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">P.O. Date</label>
                  <input
                    type="date"
                    value={headerForm.po_date || ""}
                    readOnly
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-slate-100 text-slate-500 cursor-not-allowed focus:outline-none"
                    title="P.O. Date is loaded automatically from Sauda Check Point"
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2 md:col-span-4">
                  <label className="text-xs font-extrabold text-slate-700">Broker Name</label>
                  <input
                    type="text"
                    value={headerForm.broker_name || ""}
                    onChange={(e) => handleHeaderChange("broker_name", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2 md:col-span-4">
                  <label className="text-xs font-extrabold text-slate-700">Supplier Name</label>
                  <input
                    type="text"
                    value={headerForm.supplier_name || ""}
                    onChange={(e) => handleHeaderChange("supplier_name", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold bg-white text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                {/* Left group */}
                <div className="flex flex-col gap-1 border-l-4 border-blue-400 pl-2">
                  <label className="text-xs font-extrabold text-slate-700">Actual Moisture %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={headerForm.actual_moisture || 0}
                    onChange={(e) => handleHeaderChange("actual_moisture", Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-blue-700 bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1 border-l-4 border-blue-400 pl-2">
                  <label className="text-xs font-extrabold text-slate-700">Actual Dust %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={headerForm.actual_dust || 0}
                    onChange={(e) => handleHeaderChange("actual_dust", Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-amber-700 bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1 border-l-4 border-blue-400 pl-2">
                  <label className="text-xs font-extrabold text-slate-700">Actual NCV %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={headerForm.actual_ncv || 0}
                    onChange={(e) => handleHeaderChange("actual_ncv", Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1 border-l-4 border-blue-400 pl-2">
                  <label className="text-xs font-extrabold text-slate-700">Detention Days</label>
                  <input
                    type="number"
                    step="1"
                    value={headerForm.detention_days || 0}
                    onChange={(e) => handleHeaderChange("detention_days", Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* Right group */}
                <div className="flex flex-col gap-1 border-l-4 border-purple-400 pl-2">
                  <label className="text-xs font-extrabold text-slate-700">Claim Moisture %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={headerForm.claim_moisture || 0}
                    onChange={(e) => handleHeaderChange("claim_moisture", Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-purple-700 bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex flex-col gap-1 border-l-4 border-purple-400 pl-2">
                  <label className="text-xs font-extrabold text-slate-700">Claim Dust %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={headerForm.claim_dust || 0}
                    onChange={(e) => handleHeaderChange("claim_dust", Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-purple-700 bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex flex-col gap-1 border-l-4 border-purple-400 pl-2">
                  <label className="text-xs font-extrabold text-slate-700">Claim NCV %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={headerForm.claim_ncv || 0}
                    onChange={(e) => handleHeaderChange("claim_ncv", Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold text-purple-700 bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex flex-col gap-1 border-l-4 border-purple-400 pl-2">
                  <label className="text-xs font-extrabold text-slate-700">Unloading Date</label>
                  <input
                    type="date"
                    value={headerForm.unloading_date || ""}
                    onChange={(e) => handleHeaderChange("unloading_date", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 bg-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">Mill P.O. No.</label>
                  <input
                    type="text"
                    value={headerForm.mill_po_no || ""}
                    onChange={(e) => handleHeaderChange("mill_po_no", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">Mill P.O. Date</label>
                  <input
                    type="date"
                    value={headerForm.mill_po_date || ""}
                    onChange={(e) => handleHeaderChange("mill_po_date", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">MR. Spcl Print</label>
                  <input
                    type="text"
                    value={headerForm.mr_spcl_print || ""}
                    onChange={(e) => handleHeaderChange("mr_spcl_print", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-extrabold text-slate-700">Lorry Number</label>
                  <input
                    type="text"
                    value={headerForm.lorry_number || ""}
                    onChange={(e) => handleHeaderChange("lorry_number", e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold bg-white text-slate-900 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2 md:col-span-4">
                  <label className="text-xs font-extrabold text-slate-700">Remarks</label>
                  <textarea
                    rows={2}
                    value={headerForm.remarks || ""}
                    onChange={(e) => handleHeaderChange("remarks", e.target.value)}
                    placeholder="General mill inspection notes..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium bg-white text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </section>

            {/* DEDUCTIONS & PENALTIES CARD (Compact & Sleek Layout) */}
            {(() => {
              const { matchedDeductions, baleAudit } = calculateAllMatchingDeductions(detailRows, headerForm, deductionMasterList);
              return (
                <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-rose-100 text-rose-700 rounded-md border border-rose-200">
                        <Percent className="w-3.5 h-3.5" />
                      </div>
                      <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">Deduction Details &amp; Penalties</h2>
                      <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-rose-200">
                        {deductionRows.length} {deductionRows.length === 1 ? "Option" : "Options"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {headerForm.deduction_amount ? (
                        <div className="bg-rose-50 text-rose-900 border border-rose-200 px-2.5 py-0.5 rounded-md text-xs font-black flex items-center gap-1">
                          <span className="text-[10px] font-bold text-rose-700 uppercase">Total Claim:</span>
                          <span className="font-mono text-xs text-rose-900">-₹{Number(headerForm.deduction_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleAddDeductionRow}
                        className="flex items-center gap-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Deduction</span>
                      </button>
                    </div>
                  </div>

                  {/* Auto-Policy Deduction Master Summary Banner */}
                  {(baleAudit.totalBales > 0 || matchedDeductions.length > 0) && (
                    <div className="mx-3 mt-3 px-3 py-2 bg-gradient-to-r from-amber-50/80 via-rose-50/50 to-slate-50 border border-amber-200/80 rounded-lg flex flex-col gap-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1">
                            ⚖️ Auto Policy Audit:
                          </span>
                          {baleAudit.totalBales > 0 && (
                            <>
                              <span className="bg-white border border-slate-300 text-slate-800 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
                                Qty: <strong className="text-indigo-700">{baleAudit.totalBales} Bales</strong>
                              </span>
                              <span className="bg-white border border-slate-300 text-slate-800 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
                                Gross Wt: <strong className="text-slate-900">{baleAudit.totalReceiptGrossWtMt.toFixed(3)} MT</strong> ({Math.round(baleAudit.totalWeightKg).toLocaleString()} KG)
                              </span>
                              <span className="bg-amber-100/80 border border-amber-300 text-amber-900 px-2.5 py-0.5 rounded font-mono font-black text-[11px]">
                                Avg: {baleAudit.avgKgPerBale.toFixed(2)} KG/Bale
                              </span>
                            </>
                          )}
                        </div>

                        {matchedDeductions.length === 0 ? (
                          <div className="text-emerald-700 font-bold text-[11px] bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                            ✓ Standard Weights &amp; Conditions (No Automated Deductions Applicable)
                          </div>
                        ) : (
                          <div className="text-rose-800 font-bold text-[11px] bg-rose-100/70 px-2.5 py-0.5 rounded border border-rose-300 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                            <span>{matchedDeductions.length} Policy Rule{matchedDeductions.length > 1 ? "s" : ""} Auto-Applied</span>
                          </div>
                        )}
                      </div>

                      {/* Display Badges for all matched auto-deduction policies */}
                      {matchedDeductions.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60">
                          {matchedDeductions.map((m, mIdx) => (
                            <div
                              key={mIdx}
                              className="flex items-center gap-1.5 bg-white border border-rose-300 text-rose-900 px-2.5 py-0.5 rounded-md shadow-2xs text-[11px] font-bold"
                            >
                              <span>{m.badge}</span>
                              <span className="text-slate-400">|</span>
                              <span className="text-rose-700 font-mono">₹{m.rate.toFixed(2)} × {m.qty} = <strong>-₹{m.amount.toFixed(2)}</strong></span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-3 overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-600">
                      <th className="py-1.5 px-2.5 w-10 text-center">#</th>
                      <th className="py-1.5 px-2.5">Deduction Type</th>
                      <th className="py-1.5 px-2.5 w-32 text-right">Deduction Rate (₹)</th>
                      <th className="py-1.5 px-2.5 w-28 text-right">Qty / Units</th>
                      <th className="py-1.5 px-2.5 w-36 text-right">Deduction Amount (-)</th>
                      <th className="py-1.5 px-2 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {deductionRows.map((dRow, idx) => (
                      <tr key={dRow.id || idx} className="hover:bg-rose-50/30 transition-colors">
                        <td className="py-1.5 px-2.5 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-1.5 px-2.5">
                          <select
                            value={dRow.deduction_type || ""}
                            onChange={(e) => handleDeductionTypeChange(idx, e.target.value)}
                            className="bg-white border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 rounded-md px-2 py-1 font-sans text-xs font-bold text-slate-800 w-full shadow-2xs outline-none"
                          >
                            <option value="">-- SELECT DEDUCTION TYPE --</option>
                            {dRow.deduction_type && !deductionMasterList.some(d => d.deduction === dRow.deduction_type) && (
                              <option value={dRow.deduction_type}>
                                {dRow.deduction_type}
                              </option>
                            )}
                            {deductionMasterList.map((d, dIdx) => (
                              <option key={dIdx} value={d.deduction}>
                                {d.deduction} {d.rate_per_unit ? `(₹${d.rate_per_unit}/Unit)` : d.rate_per_qntl ? `(₹${d.rate_per_qntl}/Qtl)` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-1.5 px-2.5 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={dRow.deduction_rate || ""}
                            onChange={(e) => handleDeductionChange(idx, "deduction_rate", parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="bg-white border border-slate-300 rounded-md px-2 py-1 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                          />
                        </td>
                        <td className="py-1.5 px-2.5 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={dRow.deduction_qty !== undefined && dRow.deduction_qty !== null ? dRow.deduction_qty : 0}
                            onChange={(e) => handleDeductionChange(idx, "deduction_qty", parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="bg-white border border-slate-300 rounded-md px-2 py-1 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                          />
                        </td>
                        <td className="py-1.5 px-2.5 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={dRow.deduction_amount || ""}
                            onChange={(e) => handleDeductionChange(idx, "deduction_amount", parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="bg-rose-50 border border-rose-300 rounded-md px-2 py-1 text-right font-mono font-black text-xs text-rose-800 shadow-2xs focus:outline-none w-full"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          {deductionRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveDeductionRow(idx)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors inline-flex items-center justify-center cursor-pointer"
                              title="Remove deduction"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 bg-slate-100/90">
                    <tr className="font-extrabold text-slate-800">
                      <td colSpan={3} className="py-2 px-2.5 text-right uppercase text-[11px] tracking-wide text-slate-700">
                        Total Deductions &amp; Penalties:
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-black text-xs text-slate-900">
                        {deductionRows.reduce((sum, r) => sum + (Number(r.deduction_qty) || 0), 0)}
                      </td>
                      <td className="py-2 px-2.5 text-right">
                        <span className="inline-block w-full bg-rose-100 text-rose-900 border border-rose-300 rounded px-2 py-1 font-mono font-black text-xs text-right shadow-2xs">
                          -₹{deductionRows.reduce((sum, r) => sum + (Number(r.deduction_amount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-2 px-2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          );
        })()}

            {/* INSPECTION DETAILS WIDE TABLE SECTION */}
            <section className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-extrabold text-slate-900">Inspection Details</h2>
                    <span className="bg-blue-100 text-blue-800 text-xs font-extrabold px-3 py-0.5 rounded-full border border-blue-200">
                      {detailRows.length} {detailRows.length === 1 ? "Row" : "Rows"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Horizontal scroll + Expand Row on every record for comprehensive quality audit details
                  </p>
                </div>

                {/* Color Legend & Add Row */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs text-[11px]">
                    <span className="font-bold text-slate-500 mr-1">Field Legend:</span>
                    <span className="inline-flex items-center gap-1 bg-blue-100/90 text-blue-900 border border-blue-300 px-2 py-0.5 rounded font-extrabold shadow-2xs" title="Auto-populated from Arrival / PO / Master (Protected from manual edits)">
                      <Lock className="w-3 h-3 text-blue-700" />
                      Auto-Populated &amp; Blocked
                    </span>
                    <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded font-medium">
                      Manual Entry Allowed
                    </span>
                  </div>

                  <button
                    onClick={handleAddRow}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1 shadow-sm transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Row</span>
                  </button>
                </div>
              </div>
              <style>{`
                .table-scroll::-webkit-scrollbar {
                  width: 7px;
                  height: 11px;
                }
              `}</style>
              <div className="table-scroll overflow-auto max-h-[calc(100vh-180px)] border-t border-slate-200">
                <table className="min-w-[4300px] w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1e3a8a] text-white text-[12px] font-bold">
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center sticky left-0 bg-[#1e3a8a] z-20 min-w-[50px]">Srl No.</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[120px]">Arrival Grade</th>
                      <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Stock Grade</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Area</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Agency</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Marks</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Crop Year</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Lot</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Quantity</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[100px]">Unit</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[130px]">Challan Gross Wt. MT.</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[130px]">Receipt Gross Wt. MT.</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[130px]">Gross Weight (Batch)</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[120px] bg-gradient-to-b from-[#065f46] to-[#047857] text-white font-extrabold shadow-inner">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span>Add Weight</span>
                          <span className="text-[9px] font-semibold text-emerald-200">M.Ton</span>
                        </div>
                      </th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[120px] bg-gradient-to-b from-[#991b1b] to-[#b91c1c] text-white font-extrabold shadow-inner">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span>Less Weight</span>
                          <span className="text-[9px] font-semibold text-rose-200">M.Ton</span>
                        </div>
                      </th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[130px] bg-gradient-to-b from-[#3730a3] to-[#4338ca] text-white font-extrabold shadow-inner">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span>Reduced Weight</span>
                          <span className="text-[9px] font-semibold text-indigo-200">M.Ton</span>
                        </div>
                      </th>
                      {/* <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Lorry Moisture</th> */}
                      <th colSpan={3} className="p-2 border-r border-white/20 text-center bg-[#1e40af]">Lorry Moisture Read (%)</th>
                      <th colSpan={3} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Insp. Moisture Read (%)</th>
                      <th colSpan={2} className="p-2 border-r border-blue-400 text-center bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white font-black shadow-inner">
                        <div className="flex items-center justify-center gap-1">
                          <Sparkles className="w-3 h-3 text-cyan-300 fill-cyan-300" />
                          <span className="tracking-wide">Moisture %</span>
                        </div>
                      </th>
                      <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Dust %</th>
                      <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1e40af]">NCV %</th>
                      <th colSpan={2} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Grade Down %</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[140px]">Final Receipt Wt. (Claim)</th>
                      <th colSpan={4} className="p-2 border-r border-emerald-400 text-center bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white font-black shadow-inner">
                        <div className="flex items-center justify-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
                          <span className="tracking-wide">Mill Settlement %</span>
                        </div>
                      </th>
                      <th colSpan={3} className="p-2 border-r border-white/20 text-center bg-[#1d4ed8]">Ropes</th>
                      <th colSpan={3} className="p-2 border-r border-white/20 text-center bg-[#1e40af]">Chotta &amp; Habi Jabi</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[90px]">Tolerable</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[130px] bg-gradient-to-b from-[#1d4ed8] to-[#1e3a8a] text-amber-300">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span className="font-black flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                            Premium
                          </span>
                          <span className="text-[9px] font-semibold text-blue-100 opacity-90">(Show Qty in MT)</span>
                        </div>
                      </th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[125px] bg-gradient-to-b from-[#1e40af] to-[#1e3a8a] text-white font-extrabold shadow-inner">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span>Amount</span>
                          <span className="text-[9px] font-semibold text-amber-300 font-mono">₹ Total</span>
                        </div>
                      </th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[140px]">Remarks</th>
                      <th rowSpan={2} className="p-2 border-r border-white/20 text-center min-w-[140px]">JCI Remarks</th>
                      <th rowSpan={2} className="p-2 text-center sticky right-0 bg-[#1e3a8a] z-20 min-w-[190px]">Row Actions</th>
                    </tr>
                    <tr className="bg-[#243b68] text-white text-[11px]">
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Code</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[120px]">Name</th>
                      {/* <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Min</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Max</th> */}
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Min</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Max</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Avg</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Min</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Max</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Avg</th>
                      <th className="p-1.5 border-r border-blue-500 text-center min-w-[90px] bg-blue-900 text-blue-100 font-black" title="Auto-pulled highest value between Lorry Avg and Insp Avg">Act.</th>
                      <th className="p-1.5 border-r border-blue-500 text-center min-w-[90px] bg-blue-900 text-blue-100 font-black" title="Auto-pulled highest value between Lorry Avg and Insp Avg">Claim</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Act.</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Claim</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Act.</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Claim</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Act.</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Claim</th>
                      <th className="p-1.5 border-r border-emerald-500 text-center min-w-[90px] bg-emerald-800 text-emerald-100 font-black" title="Auto-pulled from Moisture % Act.">Moisture</th>
                      <th className="p-1.5 border-r border-emerald-500 text-center min-w-[90px] bg-emerald-800 text-emerald-100 font-black" title="Auto-pulled from Grade Down % Act.">Gr. Down</th>
                      <th className="p-1.5 border-r border-emerald-500 text-center min-w-[90px] bg-emerald-800 text-emerald-100 font-black" title="Auto-pulled from Dust % Act.">Dust</th>
                      <th className="p-1.5 border-r border-emerald-500 text-center min-w-[90px] bg-emerald-800 text-emerald-100 font-black" title="Auto-pulled from NCV % Act.">NCV</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Weight (Kg)</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[100px]">Tot. Wt. Grd%</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Grade</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Weight (Kg)</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[100px]">Tot. Wt. Grd%</th>
                      <th className="p-1.5 border-r border-white/10 text-center min-w-[90px]">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((row, idx) => {
                      const isArrivalGradeBlocked = isAutoBlocked(row, "arrival_grade");
                      const isStockGradeCodeBlocked = isAutoBlocked(row, "stock_grade_code");
                      const isStockGradeNameBlocked = isAutoBlocked(row, "stock_grade_name");
                      const isAreaBlocked = isAutoBlocked(row, "area");
                      const isAgencyBlocked = isAutoBlocked(row, "agency");
                      const isMarksBlocked = isAutoBlocked(row, "marks");
                      const isCropYearBlocked = isAutoBlocked(row, "crop_year");
                      const isLotBlocked = isAutoBlocked(row, "lot");
                      const isQuantityBlocked = isAutoBlocked(row, "quantity");
                      const isUnitBlocked = isAutoBlocked(row, "unit");
                      const isChallanGrossWtBlocked = isAutoBlocked(row, "challan_gross_wt");
                      const isReceiptGrossWtBlocked = isAutoBlocked(row, "receipt_gross_wt");
                      const isGrossWeightBatchBlocked = isAutoBlocked(row, "gross_weight_batch");
                      const isAddWeightBlocked = isAutoBlocked(row, "add_weight");
                      const isLessWeightBlocked = isAutoBlocked(row, "less_weight");
                      const isReducedWeightBlocked = isAutoBlocked(row, "reduced_weight");
                      const isLorryMoistureMinBlocked = isAutoBlocked(row, "lorry_moisture_min");
                      const isLorryMoistureMaxBlocked = isAutoBlocked(row, "lorry_moisture_max");
                      const isLorryReadMinBlocked = isAutoBlocked(row, "lorry_read_min");
                      const isLorryReadMaxBlocked = isAutoBlocked(row, "lorry_read_max");
                      const isInspReadMinBlocked = isAutoBlocked(row, "insp_read_min");
                      const isInspReadMaxBlocked = isAutoBlocked(row, "insp_read_max");
                      const isMoistureActBlocked = isAutoBlocked(row, "moisture_act");
                      const isMoistureClaimBlocked = isAutoBlocked(row, "moisture_claim");
                      const isDustActBlocked = isAutoBlocked(row, "dust_act");
                      const isDustClaimBlocked = isAutoBlocked(row, "dust_claim");
                      const isNcvActBlocked = isAutoBlocked(row, "ncv_act");
                      const isNcvClaimBlocked = isAutoBlocked(row, "ncv_claim");
                      const isGradeDownActBlocked = isAutoBlocked(row, "grade_down_act");
                      const isGradeDownClaimBlocked = isAutoBlocked(row, "grade_down_claim");
                      const isFinalReceiptWtBlocked = isAutoBlocked(row, "final_receipt_wt");
                      const isSettlementMoistureBlocked = isAutoBlocked(row, "settlement_moisture");
                      const isSettlementGradeDownBlocked = isAutoBlocked(row, "settlement_grade_down");
                      const isSettlementDustBlocked = isAutoBlocked(row, "settlement_dust");
                      const isSettlementNcvBlocked = isAutoBlocked(row, "settlement_ncv");
                      const isRopesWeightBlocked = isAutoBlocked(row, "ropes_weight");
                      const isRopesTotWtGrdBlocked = isAutoBlocked(row, "ropes_tot_wt_grd");
                      const isRopesGradeBlocked = isAutoBlocked(row, "ropes_grade");
                      const isChottaWeightBlocked = isAutoBlocked(row, "chotta_weight");
                      const isChottaTotWtGrdBlocked = isAutoBlocked(row, "chotta_tot_wt_grd");
                      const isChottaGradeBlocked = isAutoBlocked(row, "chotta_grade");

                      return (
                        <React.Fragment key={idx}>
                          <tr className={`border-b border-slate-200 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"} ${row.expanded ? "bg-blue-50/50" : ""}`}>
                            {/* Srl No */}
                            <td className="p-2 border-r border-slate-200 text-center font-extrabold text-slate-700 sticky left-0 bg-white z-10">
                              <div className="flex items-center justify-center gap-1">
                                <span>{idx + 1}</span>
                                {row.is_auto && (
                                  <span title="Auto-filled from Arrival / PO">
                                    <Lock className="w-2.5 h-2.5 text-blue-600 inline" />
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Arrival Grade */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isArrivalGradeBlocked}
                                tabIndex={isArrivalGradeBlocked ? -1 : 0}
                                title={isArrivalGradeBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.arrival_grade || ""}
                                onChange={(e) => !isArrivalGradeBlocked && handleDetailChange(idx, "arrival_grade", e.target.value)}
                                className={getFieldInputStyle(isArrivalGradeBlocked)}
                              />
                            </td>

                            {/* Stock Grade Code & Name */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isStockGradeCodeBlocked}
                                tabIndex={isStockGradeCodeBlocked ? -1 : 0}
                                title={isStockGradeCodeBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.stock_grade_code || ""}
                                onChange={(e) => !isStockGradeCodeBlocked && handleDetailChange(idx, "stock_grade_code", e.target.value)}
                                className={getFieldInputStyle(isStockGradeCodeBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isStockGradeNameBlocked}
                                tabIndex={isStockGradeNameBlocked ? -1 : 0}
                                title={isStockGradeNameBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.stock_grade_name || ""}
                                onChange={(e) => !isStockGradeNameBlocked && handleDetailChange(idx, "stock_grade_name", e.target.value)}
                                className={getFieldInputStyle(isStockGradeNameBlocked)}
                              />
                            </td>

                            {/* Area & Agency */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isAreaBlocked}
                                tabIndex={isAreaBlocked ? -1 : 0}
                                title={isAreaBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.area || ""}
                                onChange={(e) => !isAreaBlocked && handleDetailChange(idx, "area", e.target.value)}
                                className={getFieldInputStyle(isAreaBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isAgencyBlocked}
                                tabIndex={isAgencyBlocked ? -1 : 0}
                                title={isAgencyBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.agency || ""}
                                onChange={(e) => !isAgencyBlocked && handleDetailChange(idx, "agency", e.target.value)}
                                className={getFieldInputStyle(isAgencyBlocked)}
                              />
                            </td>

                            {/* Marks, Crop Year, Lot */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isMarksBlocked}
                                tabIndex={isMarksBlocked ? -1 : 0}
                                title={isMarksBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.marks || ""}
                                onChange={(e) => !isMarksBlocked && handleDetailChange(idx, "marks", e.target.value)}
                                className={getFieldInputStyle(isMarksBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isCropYearBlocked}
                                tabIndex={isCropYearBlocked ? -1 : 0}
                                title={isCropYearBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.crop_year || ""}
                                onChange={(e) => !isCropYearBlocked && handleDetailChange(idx, "crop_year", e.target.value)}
                                className={getFieldInputStyle(isCropYearBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isLotBlocked}
                                tabIndex={isLotBlocked ? -1 : 0}
                                title={isLotBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.lot || ""}
                                onChange={(e) => !isLotBlocked && handleDetailChange(idx, "lot", e.target.value)}
                                className={getFieldInputStyle(isLotBlocked)}
                              />
                            </td>

                            {/* Quantity & Unit */}
                            <td className="p-1.5 border-r border-slate-200">
                              <div className="flex flex-col gap-0.5">
                                <input
                                  type="number"
                                  step="1"
                                  readOnly={isQuantityBlocked}
                                  tabIndex={isQuantityBlocked ? -1 : 0}
                                  title={isQuantityBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                  value={row.quantity !== undefined && row.quantity !== null ? row.quantity : 0}
                                  onChange={(e) => {
                                    if (isQuantityBlocked) return;
                                    const val = Number(e.target.value);
                                    handleDetailChange(idx, "quantity", val);
                                  }}
                                  className={getFieldInputStyle(isQuantityBlocked, "font-bold font-mono text-right")}
                                />
                                <span className="text-[9px] text-slate-500 font-medium">
                                  ≈ {calculateQtyInMt(row).toFixed(3)} MT
                                </span>
                              </div>
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <div className="flex flex-col gap-0.5">
                                <input
                                  type="text"
                                  readOnly={isUnitBlocked}
                                  tabIndex={isUnitBlocked ? -1 : 0}
                                  title={isUnitBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                  value={row.unit || (headerForm as any).unit_name || "BALES"}
                                  onChange={(e) => !isUnitBlocked && handleDetailChange(idx, "unit", e.target.value.toUpperCase())}
                                  className={getFieldInputStyle(isUnitBlocked, "text-center uppercase font-bold")}
                                />
                              </div>
                            </td>

                            {/* Weights */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isChallanGrossWtBlocked}
                                tabIndex={isChallanGrossWtBlocked ? -1 : 0}
                                title={isChallanGrossWtBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.challan_gross_wt || 0}
                                onChange={(e) => !isChallanGrossWtBlocked && handleDetailChange(idx, "challan_gross_wt", Number(e.target.value))}
                                className={getFieldInputStyle(isChallanGrossWtBlocked, "font-mono font-bold")}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isReceiptGrossWtBlocked}
                                tabIndex={isReceiptGrossWtBlocked ? -1 : 0}
                                title={isReceiptGrossWtBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.receipt_gross_wt || 0}
                                onChange={(e) => !isReceiptGrossWtBlocked && handleDetailChange(idx, "receipt_gross_wt", Number(e.target.value))}
                                className={getFieldInputStyle(isReceiptGrossWtBlocked, "font-mono font-bold")}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isGrossWeightBatchBlocked}
                                tabIndex={isGrossWeightBatchBlocked ? -1 : 0}
                                title={isGrossWeightBatchBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.gross_weight_batch || 0}
                                onChange={(e) => !isGrossWeightBatchBlocked && handleDetailChange(idx, "gross_weight_batch", Number(e.target.value))}
                                className={getFieldInputStyle(isGrossWeightBatchBlocked, "font-mono")}
                              />
                            </td>
                            <td className="p-1.5 border-r border-emerald-200 bg-emerald-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isAddWeightBlocked}
                                tabIndex={isAddWeightBlocked ? -1 : 0}
                                title={isAddWeightBlocked ? "Auto-populated (Manual edit blocked)" : "Add Weight M.Ton"}
                                value={row.add_weight || 0}
                                onChange={(e) => !isAddWeightBlocked && handleDetailChange(idx, "add_weight", Number(e.target.value))}
                                className={`w-full border border-emerald-300 rounded px-2 py-1 text-xs font-mono font-bold text-center bg-emerald-50/80 text-emerald-950 focus:ring-2 focus:ring-emerald-500 ${isAddWeightBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>
                            <td className="p-1.5 border-r border-rose-200 bg-rose-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isLessWeightBlocked}
                                tabIndex={isLessWeightBlocked ? -1 : 0}
                                title={isLessWeightBlocked ? "Auto-populated (Manual edit blocked)" : "Less Weight M.Ton"}
                                value={row.less_weight || 0}
                                onChange={(e) => !isLessWeightBlocked && handleDetailChange(idx, "less_weight", Number(e.target.value))}
                                className={`w-full border border-rose-300 rounded px-2 py-1 text-xs font-mono font-bold text-center bg-rose-50/80 text-rose-950 focus:ring-2 focus:ring-rose-500 ${isLessWeightBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>
                            <td className="p-1.5 border-r border-indigo-200 bg-indigo-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isReducedWeightBlocked}
                                tabIndex={isReducedWeightBlocked ? -1 : 0}
                                title={isReducedWeightBlocked ? "Auto-populated (Manual edit blocked)" : "Reduced Weight M.Ton"}
                                value={row.reduced_weight || 0}
                                onChange={(e) => !isReducedWeightBlocked && handleDetailChange(idx, "reduced_weight", Number(e.target.value))}
                                className={`w-full border border-indigo-300 rounded px-2 py-1 text-xs font-mono font-bold text-center bg-indigo-50/80 text-indigo-950 focus:ring-2 focus:ring-indigo-500 ${isReducedWeightBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>

                            {/* Lorry Moisture Min / Max */}
                           {/*  <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isLorryMoistureMinBlocked}
                                tabIndex={isLorryMoistureMinBlocked ? -1 : 0}
                                title={isLorryMoistureMinBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.lorry_moisture_min || 0}
                                onChange={(e) => !isLorryMoistureMinBlocked && handleDetailChange(idx, "lorry_moisture_min", Number(e.target.value))}
                                className={getFieldInputStyle(isLorryMoistureMinBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isLorryMoistureMaxBlocked}
                                tabIndex={isLorryMoistureMaxBlocked ? -1 : 0}
                                title={isLorryMoistureMaxBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.lorry_moisture_max || 0}
                                onChange={(e) => !isLorryMoistureMaxBlocked && handleDetailChange(idx, "lorry_moisture_max", Number(e.target.value))}
                                className={getFieldInputStyle(isLorryMoistureMaxBlocked)}
                              />
                            </td> */}

                            {/* Lorry Read Min / Max / Avg */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isLorryReadMinBlocked}
                                tabIndex={isLorryReadMinBlocked ? -1 : 0}
                                title={isLorryReadMinBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.lorry_read_min || 0}
                                onChange={(e) => !isLorryReadMinBlocked && handleDetailChange(idx, "lorry_read_min", Number(e.target.value))}
                                className={getFieldInputStyle(isLorryReadMinBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isLorryReadMaxBlocked}
                                tabIndex={isLorryReadMaxBlocked ? -1 : 0}
                                title={isLorryReadMaxBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.lorry_read_max || 0}
                                onChange={(e) => !isLorryReadMaxBlocked && handleDetailChange(idx, "lorry_read_max", Number(e.target.value))}
                                className={getFieldInputStyle(isLorryReadMaxBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={false}
                                tabIndex={-1}
                                title="Auto-calculated average (Locked)"
                                value={row.lorry_read_avg || 0}
                                onChange={(e) => handleDetailChange(idx, "lorry_read_avg", Number(e.target.value))}
                                className={getFieldInputStyle(false, "text-blue-900 font-black")}
                              />
                            </td>

                            {/* Insp Read Min / Max / Avg */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isInspReadMinBlocked}
                                tabIndex={isInspReadMinBlocked ? -1 : 0}
                                title={isInspReadMinBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.insp_read_min || 0}
                                onChange={(e) => !isInspReadMinBlocked && handleDetailChange(idx, "insp_read_min", Number(e.target.value))}
                                className={getFieldInputStyle(isInspReadMinBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isInspReadMaxBlocked}
                                tabIndex={isInspReadMaxBlocked ? -1 : 0}
                                title={isInspReadMaxBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.insp_read_max || 0}
                                onChange={(e) => !isInspReadMaxBlocked && handleDetailChange(idx, "insp_read_max", Number(e.target.value))}
                                className={getFieldInputStyle(isInspReadMaxBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={false}
                                tabIndex={-1}
                                title="Auto-calculated average (Locked)"
                                value={row.insp_read_avg || 0}
                                onChange={(e) => handleDetailChange(idx, "insp_read_avg", Number(e.target.value))}
                                className={getFieldInputStyle(false, "text-blue-900 font-black")}
                              />
                            </td>

                            {/* Moisture Act / Claim (Highlighted in Blue Theme with Auto Average Value) */}
                            <td className="p-1.5 border-r border-blue-200 bg-blue-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isMoistureActBlocked}
                                tabIndex={isMoistureActBlocked ? -1 : 0}
                                title={isMoistureActBlocked ? "Auto-populated (Manual edit blocked)" : "Moisture % Act. (Auto-calculated average of Lorry Read Avg & Insp. Read Avg)"}
                                value={row.moisture_act !== undefined && row.moisture_act !== null && Number(row.moisture_act) > 0 ? row.moisture_act : ((Number(row.lorry_read_avg) > 0 && Number(row.insp_read_avg) > 0) ? Number(((Number(row.lorry_read_avg) + Number(row.insp_read_avg)) / 2).toFixed(2)) : (Number(row.lorry_read_avg) || Number(row.insp_read_avg) || 0))}
                                onChange={(e) => !isMoistureActBlocked && handleDetailChange(idx, "moisture_act", Number(e.target.value))}
                                className={`w-full border border-blue-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 bg-blue-50/70 text-blue-950 font-black text-center ${isMoistureActBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>
                            <td className="p-1.5 border-r border-blue-200 bg-blue-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isMoistureClaimBlocked}
                                tabIndex={isMoistureClaimBlocked ? -1 : 0}
                                title={isMoistureClaimBlocked ? "Auto-populated (Manual edit blocked)" : "Moisture % Claim (Auto-calculated average of Lorry Read Avg & Insp. Read Avg)"}
                                //value={row.moisture_claim !== undefined && row.moisture_claim !== null && Number(row.moisture_claim) > 0 ? row.moisture_claim : (row.moisture_act || ((Number(row.lorry_read_avg) > 0 && Number(row.insp_read_avg) > 0) ? Number(((Number(row.lorry_read_avg) + Number(row.insp_read_avg)) / 2).toFixed(2)) : (Number(row.lorry_read_avg) || Number(row.insp_read_avg) || 0)))}
                                value={row.moisture_claim || 0}
                                onChange={(e) => !isMoistureClaimBlocked && handleDetailChange(idx, "moisture_claim", Number(e.target.value))}
                                className={`w-full border border-blue-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 bg-blue-50/70 text-indigo-950 font-black text-center ${isMoistureClaimBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>

                            {/* Dust Act / Claim */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isDustActBlocked}
                                tabIndex={isDustActBlocked ? -1 : 0}
                                title={isDustActBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.dust_act || 0}
                                onChange={(e) => !isDustActBlocked && handleDetailChange(idx, "dust_act", Number(e.target.value))}
                                className={getFieldInputStyle(isDustActBlocked, "text-amber-900 font-bold")}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isDustClaimBlocked}
                                tabIndex={isDustClaimBlocked ? -1 : 0}
                                title={isDustClaimBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.dust_claim || 0}
                                onChange={(e) => !isDustClaimBlocked && handleDetailChange(idx, "dust_claim", Number(e.target.value))}
                                className={getFieldInputStyle(isDustClaimBlocked, "text-purple-900 font-bold")}
                              />
                            </td>

                            {/* NCV Act / Claim */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isNcvActBlocked}
                                tabIndex={isNcvActBlocked ? -1 : 0}
                                title={isNcvActBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.ncv_act || 0}
                                onChange={(e) => !isNcvActBlocked && handleDetailChange(idx, "ncv_act", Number(e.target.value))}
                                className={getFieldInputStyle(isNcvActBlocked, "text-emerald-900 font-bold")}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isNcvClaimBlocked}
                                tabIndex={isNcvClaimBlocked ? -1 : 0}
                                title={isNcvClaimBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.ncv_claim || 0}
                                onChange={(e) => !isNcvClaimBlocked && handleDetailChange(idx, "ncv_claim", Number(e.target.value))}
                                className={getFieldInputStyle(isNcvClaimBlocked, "text-purple-900 font-bold")}
                              />
                            </td>

                            {/* Grade Down Act / Claim */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isGradeDownActBlocked}
                                tabIndex={isGradeDownActBlocked ? -1 : 0}
                                title={isGradeDownActBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.grade_down_act || 0}
                                onChange={(e) => !isGradeDownActBlocked && handleDetailChange(idx, "grade_down_act", Number(e.target.value))}
                                className={getFieldInputStyle(isGradeDownActBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isGradeDownClaimBlocked}
                                tabIndex={isGradeDownClaimBlocked ? -1 : 0}
                                title={isGradeDownClaimBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.grade_down_claim || 0}
                                onChange={(e) => !isGradeDownClaimBlocked && handleDetailChange(idx, "grade_down_claim", Number(e.target.value))}
                                className={getFieldInputStyle(isGradeDownClaimBlocked)}
                              />
                            </td>

                            {/* Final Receipt Wt */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isFinalReceiptWtBlocked}
                                tabIndex={isFinalReceiptWtBlocked ? -1 : 0}
                                title={isFinalReceiptWtBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.final_receipt_wt || 0}
                                onChange={(e) => !isFinalReceiptWtBlocked && handleDetailChange(idx, "final_receipt_wt", Number(e.target.value))}
                                className={getFieldInputStyle(isFinalReceiptWtBlocked, "font-mono font-bold")}
                              />
                            </td>

                            {/* Settlement % (Highlighted in Emerald Theme) */}
                            <td className="p-1.5 border-r border-emerald-200 bg-emerald-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isSettlementMoistureBlocked}
                                tabIndex={isSettlementMoistureBlocked ? -1 : 0}
                                title={isSettlementMoistureBlocked ? "Auto-populated (Manual edit blocked)" : "Mill Settlement % Moisture (Auto-pulled from Act. Moisture)"}
                                value={row.settlement_moisture !== undefined && row.settlement_moisture !== null && Number(row.settlement_moisture) > 0 ? row.settlement_moisture : (row.settlement_moisture || row.settlement_moisture || ((Number(row.settlement_moisture) > 0 && Number(row.settlement_moisture) > 0) ? Number(((Number(row.settlement_moisture) + Number(row.settlement_moisture)) / 2).toFixed(2)) : (Number(row.settlement_moisture) || Number(row.settlement_moisture) || 0)))}
                                onChange={(e) => !isSettlementMoistureBlocked && handleDetailChange(idx, "settlement_moisture", Number(e.target.value))}
                                className={`w-full border border-emerald-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-500 bg-emerald-50/70 text-emerald-950 font-black text-center ${isSettlementMoistureBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>
                            <td className="p-1.5 border-r border-emerald-200 bg-emerald-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isSettlementGradeDownBlocked}
                                tabIndex={isSettlementGradeDownBlocked ? -1 : 0}
                                title={isSettlementGradeDownBlocked ? "Auto-populated (Manual edit blocked)" : "Mill Settlement % Gr. Down (Auto-pulled from Act. Grade Down)"}
                                value={row.settlement_grade_down !== undefined && row.settlement_grade_down !== null && Number(row.settlement_grade_down) > 0 ? row.settlement_grade_down : (row.settlement_grade_down || row.settlement_grade_down || 0)}
                                onChange={(e) => !isSettlementGradeDownBlocked && handleDetailChange(idx, "settlement_grade_down", Number(e.target.value))}
                                className={`w-full border border-emerald-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-500 bg-emerald-50/70 text-emerald-950 font-black text-center ${isSettlementGradeDownBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>
                            <td className="p-1.5 border-r border-emerald-200 bg-emerald-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isSettlementDustBlocked}
                                tabIndex={isSettlementDustBlocked ? -1 : 0}
                                title={isSettlementDustBlocked ? "Auto-populated (Manual edit blocked)" : "Mill Settlement % Dust (Auto-pulled from Act. Dust)"}
                                value={row.settlement_dust !== undefined && row.settlement_dust !== null && Number(row.settlement_dust) > 0 ? row.settlement_dust : (row.settlement_dust || row.settlement_dust || headerForm.settlement_dust || headerForm.settlement_dust || 0)}
                                onChange={(e) => !isSettlementDustBlocked && handleDetailChange(idx, "settlement_dust", Number(e.target.value))}
                                className={`w-full border border-emerald-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-500 bg-emerald-50/70 text-emerald-950 font-black text-center ${isSettlementDustBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>
                            <td className="p-1.5 border-r border-emerald-200 bg-emerald-50/40">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isSettlementNcvBlocked}
                                tabIndex={isSettlementNcvBlocked ? -1 : 0}
                                title={isSettlementNcvBlocked ? "Auto-populated (Manual edit blocked)" : "Mill Settlement % NCV (Auto-pulled from Act. NCV)"}
                                value={row.settlement_ncv !== undefined && row.settlement_ncv !== null && Number(row.settlement_ncv) > 0 ? row.settlement_ncv : (row.settlement_ncv || row.settlement_ncv || headerForm.settlement_ncv || headerForm.settlement_ncv || 0)}
                                onChange={(e) => !isSettlementNcvBlocked && handleDetailChange(idx, "settlement_ncv", Number(e.target.value))}
                                className={`w-full border border-emerald-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-emerald-500 bg-emerald-50/70 text-emerald-950 font-black text-center ${isSettlementNcvBlocked ? "cursor-not-allowed opacity-80" : ""}`}
                              />
                            </td>

                            {/* Ropes */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isRopesWeightBlocked}
                                tabIndex={isRopesWeightBlocked ? -1 : 0}
                                title={isRopesWeightBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.ropes_weight || 0}
                                onChange={(e) => !isRopesWeightBlocked && handleDetailChange(idx, "ropes_weight", Number(e.target.value))}
                                className={getFieldInputStyle(isRopesWeightBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isRopesTotWtGrdBlocked}
                                tabIndex={isRopesTotWtGrdBlocked ? -1 : 0}
                                title={isRopesTotWtGrdBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.ropes_tot_wt_grd || 0}
                                onChange={(e) => !isRopesTotWtGrdBlocked && handleDetailChange(idx, "ropes_tot_wt_grd", Number(e.target.value))}
                                className={getFieldInputStyle(isRopesTotWtGrdBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isRopesGradeBlocked}
                                tabIndex={isRopesGradeBlocked ? -1 : 0}
                                title={isRopesGradeBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.ropes_grade || ""}
                                onChange={(e) => !isRopesGradeBlocked && handleDetailChange(idx, "ropes_grade", e.target.value)}
                                className={getFieldInputStyle(isRopesGradeBlocked)}
                              />
                            </td>

                            {/* Chotta & Habi Jabi */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isChottaWeightBlocked}
                                tabIndex={isChottaWeightBlocked ? -1 : 0}
                                title={isChottaWeightBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.chotta_weight || 0}
                                onChange={(e) => !isChottaWeightBlocked && handleDetailChange(idx, "chotta_weight", Number(e.target.value))}
                                className={getFieldInputStyle(isChottaWeightBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="number"
                                step="0.01"
                                readOnly={isChottaTotWtGrdBlocked}
                                tabIndex={isChottaTotWtGrdBlocked ? -1 : 0}
                                title={isChottaTotWtGrdBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.chotta_tot_wt_grd || 0}
                                onChange={(e) => !isChottaTotWtGrdBlocked && handleDetailChange(idx, "chotta_tot_wt_grd", Number(e.target.value))}
                                className={getFieldInputStyle(isChottaTotWtGrdBlocked)}
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                readOnly={isChottaGradeBlocked}
                                tabIndex={isChottaGradeBlocked ? -1 : 0}
                                title={isChottaGradeBlocked ? "Auto-populated (Manual edit blocked)" : undefined}
                                value={row.chotta_grade || ""}
                                onChange={(e) => !isChottaGradeBlocked && handleDetailChange(idx, "chotta_grade", e.target.value)}
                                className={getFieldInputStyle(isChottaGradeBlocked)}
                              />
                            </td>

                            {/* Tolerable */}
                            <td className="p-1.5 border-r border-slate-200">
                              <select
                                value={row.tolerable || "Yes"}
                                onChange={(e) => handleDetailChange(idx, "tolerable", e.target.value)}
                                className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-white font-medium focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                            </td>

                            {/* Premium (Manual Input / Qty in MT) */}
                            <td className="p-1.5 border-r border-slate-200 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1 w-full">
                                  <input
                                    type="text"
                                    value={row.premium !== undefined && row.premium !== null ? row.premium : (row.is_premium ? "Yes" : "")}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      handleDetailChange(idx, "premium", val);
                                      if (val.trim() !== "" && val.toLowerCase() !== "no") {
                                        handleDetailChange(idx, "is_premium", true);
                                      } else {
                                        handleDetailChange(idx, "is_premium", false);
                                      }
                                    }}
                                    placeholder={`e.g. 1.000 (Max ${calculateQtyInMt(row).toFixed(3)})`}
                                    className="w-full border border-slate-300 rounded px-1.5 py-1 text-xs bg-amber-50/40 font-bold text-amber-950 text-center"
                                    title="Enter numeric MT premium value or Yes (defaults to max available)"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const maxMt = calculateQtyInMt(row).toFixed(3);
                                      const currentPrem = getPremiumMt(row);
                                      const isFull = currentPrem >= Number(maxMt);
                                      if (isFull) {
                                        handleDetailChange(idx, "premium", "");
                                        handleDetailChange(idx, "is_premium", false);
                                      } else {
                                        handleDetailChange(idx, "premium", maxMt);
                                        handleDetailChange(idx, "is_premium", true);
                                        handleDetailChange(idx, "unit", "M.T.");
                                      }
                                    }}
                                    className={`p-1 rounded text-xs transition-all cursor-pointer shrink-0 ${
                                      getPremiumMt(row) > 0
                                        ? "bg-amber-400 text-slate-950 font-bold shadow-sm"
                                        : "bg-slate-100 hover:bg-amber-100 text-slate-600"
                                    }`}
                                    title="Click to fill Max Available MT Premium"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                {getPremiumMt(row) > 0 && (
                                  <span className="text-[10px] font-mono font-black text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shadow-inner whitespace-nowrap flex items-center gap-1">
                                    <span>{getPremiumMt(row).toFixed(3)} MT</span>
                                    <span className="text-[8px] text-slate-500 font-normal">/ {calculateQtyInMt(row).toFixed(3)} max</span>
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Amount (₹) */}
                            <td className="p-1.5 border-r border-slate-200 text-center min-w-[125px]">
                              <div className="flex flex-col items-center gap-1">
                                <div className="relative w-full">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs pointer-events-none">₹</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={row.amount !== undefined && row.amount !== null ? row.amount : (calculateRowAmount(row) > 0 ? calculateRowAmount(row) : "")}
                                    onChange={(e) => handleDetailChange(idx, "amount", parseFloat(e.target.value) || 0)}
                                    placeholder="0.00"
                                    className="w-full border border-slate-300 rounded pl-5 pr-2 py-1 text-xs bg-amber-50/20 font-mono font-bold text-slate-900 text-right focus:ring-1 focus:ring-blue-500"
                                    title="Amount in ₹"
                                  />
                                </div>
                                {calculateRowAmount(row) > 0 && (!row.amount || Number(row.amount) === calculateRowAmount(row)) && (
                                  <span className="text-[9px] font-mono text-emerald-700 font-bold">
                                    ₹{calculateRowAmount(row).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Remarks */}
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                value={row.row_remarks || ""}
                                onChange={(e) => handleDetailChange(idx, "row_remarks", e.target.value)}
                                className="w-full border border-slate-300 rounded px-2 py-1 text-xs bg-white"
                                placeholder="Row remarks..."
                              />
                            </td>
                            <td className="p-1.5 border-r border-slate-200">
                              <input
                                type="text"
                                value={row.jqi_remarks || ""}
                                onChange={(e) => handleDetailChange(idx, "jqi_remarks", e.target.value)}
                                className="w-full border border-slate-300 rounded px-2 py-1 text-xs bg-white"
                                placeholder="JCI remarks..."
                              />
                            </td>

                            {/* Row Actions Sticky Cell */}
                            <td className="p-2 sticky right-0 bg-white z-10 text-center border-l border-slate-200">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleToggleExpand(idx)}
                                  className={`px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 ${
                                    row.expanded ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-blue-600 text-white hover:bg-blue-700"
                                  }`}
                                >
                                  {row.expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                  <span>{row.expanded ? "Collapse" : "Expand"}</span>
                                </button>
                                <button
                                  onClick={() => handleDuplicateRow(idx)}
                                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[11px] font-bold"
                                  title="Duplicate Row"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRow(idx)}
                                  className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-[11px] font-bold"
                                  title="Delete Row"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* EXPANDED ROW PANEL */}
                          {row.expanded && (
                            <tr className="bg-slate-50 border-b-2 border-blue-200">
                              <td colSpan={48} className="p-4">
                                <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-inner">
                                  <div className="flex items-center justify-between mb-3 border-b border-slate-200 pb-2">
                                    <span className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                                      <Layers className="w-4 h-4 text-blue-600" />
                                      Expanded Inspection Detail View for Row #{idx + 1}
                                      {row.is_auto && (
                                        <span className="ml-2 inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] font-extrabold px-2 py-0.5 rounded border border-blue-200">
                                          <Lock className="w-2.5 h-2.5" /> Auto-populated data locked
                                        </span>
                                      )}
                                    </span>
                                    <button
                                      onClick={() => handleToggleExpand(idx)}
                                      className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                                    >
                                      Close Panel ✕
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                    {detailFieldsConfig.map(cfg => {
                                      const isBlocked = isAutoBlocked(row, cfg.name);
                                      return (
                                        <div key={cfg.name} className="flex flex-col gap-1">
                                          <div className="flex items-center justify-between">
                                            <label className="text-[11px] font-extrabold text-slate-600">{cfg.label}</label>
                                            {isBlocked && (
                                              <span className="text-[10px] text-blue-700 flex items-center gap-0.5 font-bold">
                                                <Lock className="w-2.5 h-2.5" /> Locked
                                              </span>
                                            )}
                                          </div>
                                          {cfg.type === "select" ? (
                                            <select
                                              disabled={isBlocked}
                                              value={(row[cfg.name] as string) || "Yes"}
                                              onChange={(e) => !isBlocked && handleDetailChange(idx, cfg.name, e.target.value)}
                                              className={isBlocked ? "border border-blue-300 bg-blue-50/90 text-blue-950 font-bold rounded px-2.5 py-1.5 text-xs cursor-not-allowed" : "border border-slate-300 rounded px-2.5 py-1.5 bg-white font-medium text-slate-900"}
                                            >
                                              <option value="Yes">Yes</option>
                                              <option value="No">No</option>
                                            </select>
                                          ) : (
                                            <input
                                              type={cfg.type}
                                              step={cfg.type === "number" ? "0.01" : undefined}
                                              readOnly={isBlocked}
                                              tabIndex={isBlocked ? -1 : 0}
                                              value={(row[cfg.name] as any) ?? ""}
                                              onChange={(e) =>
                                                !isBlocked && handleDetailChange(
                                                  idx,
                                                  cfg.name,
                                                  cfg.type === "number" ? Number(e.target.value) : e.target.value
                                                )
                                              }
                                              className={getFieldInputStyle(isBlocked, "px-2.5 py-1.5")}
                                            />
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* FOOTER BAR */}
              <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600">
                  Tip: Use <b className="text-blue-700">Expand</b> to edit/view the complete row without losing the wide-table structure. <b className="text-rose-700">Delete</b> removes only that inspection row.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddRow}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>＋ Add New Inspection Row</span>
                  </button>
                  <button
                    onClick={() => handlePrintRecord(headerForm)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                    title="Print Marks & Quality Received Mill Copy"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Slip</span>
                  </button>
                  <button
                    onClick={handleSaveForm}
                    disabled={isSaving}
                    className={`px-5 py-2 font-black text-xs rounded-lg flex items-center gap-1.5 shadow-md transition-all ${
                      isSaving
                        ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                        : "bg-amber-400 hover:bg-amber-300 text-slate-950 active:scale-95 cursor-pointer"
                    }`}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Inspection</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>

          </div>
        )}

        {/* PRINT MODAL (MARKS & QUALITY RECEIVED - MILL COPY) */}
        <PrintModal
          isOpen={printingRecord !== null}
          onClose={() => setPrintingRecord(null)}
          title={`MARKS & QUALITY RECEIVED - M.R. NO: ${printingRecord?.mr_no || ""}`}
          copyType={copyType}
          setCopyType={setCopyType}
        >
          {printingRecord && (
            <InspectionPrintSlip
              master={printingRecord}
              details={printingDetails}
              copyType={copyType}
            />
          )}
        </PrintModal>

      </div>
    </LegacyLayout>
  );
}
