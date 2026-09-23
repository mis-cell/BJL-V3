import React, { useState, useEffect, useMemo } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
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
  Calculator,
  CheckCircle2,
  FileSpreadsheet,
  Grid,
  Truck,
  Eye,
  ArrowLeft
} from 'lucide-react';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import PrintModal from '../components/PrintModal';
import SearchableSelect from '../components/SearchableSelect';
import { supabase } from '../lib/supabase';
import { dbModule } from '../services/dbModule';
import { cn, sanitizeCsvData } from '../lib/utils';
import { PaginationControls } from '../components/PaginationControls';
import { enforceEditOrDeletePermission, canEditOrDelete, canViewCompletedData, isL5OrAdmin } from '../lib/permissions';
import { findMatchedPoItem, parseGridOrItems } from './PaymentModule';

export interface SettlementDeductionItem {
  id?: string;
  deduction_type: string;
  deduction_rate: number;
  deduction_qty: number;
  deduction_amount: number;
}

// Detailed master interface
interface SettlementMaster {
  settlement_id?: string;
  mr_no: string;
  sett_date: string;
  po_type: string;
  broker: string;
  supplier: string;
  chn_supplier: string;
  po_no: string;
  po_date: string;
  lorry_number: string;
  auto_ho_settlement: boolean;
  detention_days: number;
  arrival_no: string;
  arrival_date: string;
  arival_apmc_fees: number;
  actual_apmc_fees: number;
  remarks: string;

  // Grade-wise summary panel
  summary_rate_qtel: number;
  summary_rate_aff_cd_cl: number;
  summary_delivery_claim: number;
  summary_rate_wt_claim: number;
  summary_instl_rate: number;
  summary_premium_wt?: number;
  summary_material_value: number;
  summary_misc_add?: number;
  summary_misc_less?: number;
  summary_premium_amount: number;
  summary_less_amount: number;
  summary_instl_amount?: number;

  // Deductions from Deduction Master
  summary_deduction_type: string;
  summary_deduction_rate: number;
  summary_deduction_qty: number;
  summary_deduction_amount: number;
  deductions?: SettlementDeductionItem[];

  // valuation
  val_material_value: number;
  val_add_amt: number;
  val_less_amt: number;
  val_premium_amt: number;
  val_less_amount: number;
  val_qty_claim: number;
  val_ex_short: number;

  // final MR
  final_less_adv: number;
  final_on_ac_adv: number;
  final_apmc_fees: number;
  final_cst_pct_amt: number;

  // payable
  payable_amt: number;
  payable_bill_no: string;
  payable_bill_date: string;

  // bottom bar
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
  payment_status: string;
}

// 4-Column specifications entry
interface SettlementDetailColumn {
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

const emptyDetailColumn = (index: number): SettlementDetailColumn => ({
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
  gd_claim: 0, gd_sett: 0, gd_rev: 0, gd_final: 0,
  moist_claim: 0, moist_sett: 0, moist_rev: 0, moist_final: 0,
  dust_claim: 0, dust_sett: 0, dust_rev: 0, dust_final: 0,
  ncv_claim: 0, ncv_sett: 0, ncv_rev: 0, ncv_final: 0,
  po_grade_claim: 0, po_grade_sett: 0, po_grade_rev: 0, po_grade_final: 0,
  adjust_type: 'No Adjustment',
  remark: '',
  claim_settlement: 0
});

export const getColWtMt = (col?: SettlementDetailColumn): number => {
  if (!col) return 0;
  const arrWt = Number(col.arr_qty_wt) || 0;
  if (arrWt > 0) return arrWt;
  const qty = Number(col.quantity) || 0;
  const wtPerQty = Number(col.wt_quantity) || Number(col.wt_phota) || 0;
  if (qty > 0 && wtPerQty > 0) {
    return Number(((qty * wtPerQty) / 1000).toFixed(3));
  }
  return 0;
};

export const getColAmount = (col?: SettlementDetailColumn, fallbackRate: number = 0): number => {
  if (!col) return 0;
  const wtMt = getColWtMt(col);
  const reconRate = Number(col.rate_value) > 0 ? Number(col.rate_value) : (Number(fallbackRate) || 0);
  if (wtMt <= 0 || reconRate <= 0) return 0;
  // WT(MT) to KG = wtMt * 1000
  // Recon Rate (₹/Qtl) to ₹/KG = reconRate / 100
  // Column Amount = WT(KG) * Rate(KG) = WT(MT) * ReconRate * 10
  const wtKg = wtMt * 1000;
  const rateKg = reconRate / 100;
  return wtKg * rateKg;
};

export const calculateWeightedRatePerMT = (cols: SettlementDetailColumn[]): number => {
  let totalWeightMt = 0;
  let totalAmount = 0;

  cols.forEach(col => {
    const wtMt = getColWtMt(col);
    const reconRateQtl = Number(col.rate_value) || 0;
    
    if (wtMt > 0 && reconRateQtl > 0) {
      const colAmount = wtMt * reconRateQtl * 10; // WT(MT) * ReconRate(₹/Qtl) * 10
      totalWeightMt += wtMt;
      totalAmount += colAmount;
    }
  });

  if (totalWeightMt <= 0) return 0;
  const weightedRateMt = totalAmount / totalWeightMt;
  return Number(weightedRateMt.toFixed(2));
};

const initialMaster = (): SettlementMaster => ({
  mr_no: '',
  sett_date: new Date().toISOString().split('T')[0],
  po_type: '',
  broker: '',
  supplier: '',
  chn_supplier: '',
  po_no: '',
  po_date: '',
  lorry_number: '',
  auto_ho_settlement: false,
  detention_days: 0,
  arrival_no: '',
  arrival_date: '',
  arival_apmc_fees: 0,
  actual_apmc_fees: 0,
  remarks: '',
  summary_rate_qtel: 0,
  summary_rate_aff_cd_cl: 0,
  summary_delivery_claim: 0,
  summary_rate_wt_claim: 0,
  summary_instl_rate: 0,
  summary_premium_wt: 0,
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
  deductions: [],
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
  payment_status: 'Pending'
});

// Helper function to parse date string without timezone offset shifts
function parseDateOnly(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (!s) return null;
  if (s.includes('T')) {
    const parts = s.split('T')[0].split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]), m = Number(parts[1]) - 1, d = Number(parts[2]);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
    }
  }
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts[0].length === 4) { // YYYY-MM-DD
      const y = Number(parts[0]), m = Number(parts[1]) - 1, d = Number(parts[2]);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
    } else if (parts[2].length === 4) { // DD-MM-YYYY
      const y = Number(parts[2]), m = Number(parts[1]) - 1, d = Number(parts[0]);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
    }
  }
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts[2].length === 4) { // DD/MM/YYYY
      const y = Number(parts[2]), m = Number(parts[1]) - 1, d = Number(parts[0]);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return new Date(y, m, d);
    }
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  return null;
}

function formatToInputDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = parseDateOnly(dateStr);
  if (!d) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function MrSettlement({ onClose, onLogEvent }: { onClose?: () => void; onLogEvent?: (event: string, details: string) => void }) {
  // Page switching & Lists
  const [viewMode, setViewMode] = useState<'dashboard' | 'entry'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Auto-populated dropdown lists
  const [settledList, setSettledList] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  
  // Real-time PO fields & statistics tracking
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [selectedPoNo, setSelectedPoNo] = useState<string>('');
  const [selectedPoData, setSelectedPoData] = useState<any>(null);
  const [poStats, setPoStats] = useState<{
    contractQty: number;
    receivedQty: number;
    settledQty: number;
    pendingQty: number;
    customReceivedQty: number;
    pendingReceivedQty: number;
    dbPendingReceived: number;
  } | null>(null);

  const [customSettlementRecords, setCustomSettlementRecords] = useState<any[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [showSuccessAnim, setShowSuccessAnim] = useState<boolean>(false);
  const [paymentList, setPaymentList] = useState<any[]>([]);
  const [paymentValidationInfo, setPaymentValidationInfo] = useState<{ mrNo: string; poNo: string; paidAmount: number; voucherNo: string } | null>(null);
  
  // Overwrite Authorization / Audit modal state
  const [showAuditOverwriteModal, setShowAuditOverwriteModal] = useState<boolean>(false);
  const [auditOverwriteInfo, setAuditOverwriteInfo] = useState<{
    activeWeight: number;
    allowedWeight: number;
    selectedPoNo: string;
    targetMrNo: string;
  } | null>(null);

  const syncPaymentModuleData = async (mrNo: string, poNo: string): Promise<{ totalPaid: number; payDetails: any[] }> => {
    try {
      let payRecords: any[] = [];
      let payDetails: any[] = [];

      if (supabase) {
        try {
          const res = await supabase.from('payment_master').select('*');
          if (res.data) payRecords = res.data;
        } catch (e) {}
        try {
          const resDet = await supabase.from('payment_details').select('*');
          if (resDet.data) payDetails = resDet.data;
        } catch (e) {}
      }
      const payments = payRecords && payRecords.length > 0 ? payRecords : await dbModule.fetchAll('payment_master').catch(() => []);
      const details = payDetails && payDetails.length > 0 ? payDetails : await dbModule.fetchAll('payment_details').catch(() => []);
      setPaymentList(payments);

      const cleanStr = (s: string) => (s || '').replace(/#/g, '').replace(/[\s\-\/]/g, '').trim().toLowerCase();
      const targetMrClean = cleanStr(mrNo);
      const targetPoClean = cleanStr(poNo);
      const targetPoRaw = (poNo || '').replace(/#/g, '').trim().toLowerCase();

      // Collect voucher numbers linked via payment_details table matching target MR
      const vouchersFromDetails = new Set<string>();
      const matchedDetailsList: any[] = [];
      if (targetMrClean) {
        details.forEach((d: any) => {
          const dMr = cleanStr(d.mr_no);
          if (dMr && (dMr === targetMrClean || dMr.includes(targetMrClean) || targetMrClean.includes(dMr))) {
            if (d.voucher_no) vouchersFromDetails.add(d.voucher_no);
            matchedDetailsList.push(d);
          }
        });
      }

      // Priority 1: Match payments specifically linked to this MR
      let matchingPayments: any[] = [];
      if (targetMrClean) {
        matchingPayments = payments.filter((p: any) => {
          const pMrClean = cleanStr(p.mr_no);
          const pArrivalClean = cleanStr(p.arrival_no);
          const pBillClean = cleanStr(p.payable_bill_no);
          const pRefClean = cleanStr(p.reference_no);
          const pRemarksClean = cleanStr(p.remarks);
          const isVoucherMatch = Boolean(p.voucher_no && vouchersFromDetails.has(p.voucher_no));

          return (
            isVoucherMatch ||
            (pMrClean && (pMrClean === targetMrClean || pMrClean.includes(targetMrClean) || targetMrClean.includes(pMrClean))) ||
            (pArrivalClean && (pArrivalClean === targetMrClean || pArrivalClean.includes(targetMrClean) || targetMrClean.includes(pArrivalClean))) ||
            (pBillClean && (pBillClean === targetMrClean || pBillClean.includes(targetMrClean) || targetMrClean.includes(pBillClean))) ||
            (pRefClean && pRefClean.includes(targetMrClean)) ||
            (pRemarksClean && pRemarksClean.includes(targetMrClean))
          );
        });
      }

      // Priority 2: Fallback to PO-matched payments if no MR-specific payments found
      if (matchingPayments.length === 0 && (targetPoClean || targetPoRaw)) {
        matchingPayments = payments.filter((p: any) => {
          const pPoClean = cleanStr(p.po_no);
          const pPoRaw = (p.po_no || '').replace(/#/g, '').trim().toLowerCase();
          return (
            (targetPoRaw && (pPoRaw === targetPoRaw || pPoRaw.includes(targetPoRaw) || targetPoRaw.includes(pPoRaw))) ||
            (targetPoClean && (pPoClean === targetPoClean || pPoClean.includes(targetPoClean) || targetPoClean.includes(pPoClean)))
          );
        });
      }

      // Also gather payment_details from matched payments if not already collected
      if (matchingPayments.length > 0 && matchedDetailsList.length === 0) {
        const matchedVoucherSet = new Set(matchingPayments.map(p => p.voucher_no).filter(Boolean));
        details.forEach((d: any) => {
          if (d.voucher_no && matchedVoucherSet.has(d.voucher_no)) {
            matchedDetailsList.push(d);
          }
        });
      }

      // Also live-update detailCols if payment has sett_rate for grades
      if (matchedDetailsList.length > 0) {
        setDetailCols(prevCols => prevCols.map(col => {
          const hasData = Boolean(col.grade || col.quantity || col.arr_qty_wt);
          if (!hasData) return col;
          const match = matchedDetailsList.find(pd => Number(pd.col_index) === col.col_index) ||
                        matchedDetailsList.find(pd => {
                          const pdGrade = (resolveGradeName(pd.grade, gradeMasterList) || String(pd.grade || '')).trim().toUpperCase();
                          const colGrade = (resolveGradeName(col.grade, gradeMasterList) || String(col.grade || '')).trim().toUpperCase();
                          return Boolean(pdGrade && colGrade && pdGrade === colGrade);
                        });
          if (match) {
            const settRate = (match.sett_rate !== undefined && match.sett_rate !== null && Number(match.sett_rate) > 0)
              ? Number(match.sett_rate)
              : (Number(match.rate_value) > 0 ? Number(match.rate_value) - Number(match.deduction_rate || 0) : 0);
            if (settRate > 0) {
              return { ...col, rate_value: settRate };
            }
          }
          return col;
        }));
      }

      if (matchingPayments.length > 0) {
        const totalPaid = matchingPayments.reduce((sum, p) => sum + Number(p.paid_amount !== undefined && p.paid_amount !== null ? p.paid_amount : (p.total_amount || 0)), 0);
        const firstMatch = matchingPayments[0];
        setPaymentValidationInfo({
          mrNo: firstMatch.mr_no || mrNo,
          poNo: firstMatch.po_no || poNo,
          paidAmount: totalPaid,
          voucherNo: matchingPayments.map(p => p.voucher_no || 'N/A').join(', ')
        });
        setMasterData(prev => ({
          ...prev,
          final_on_ac_adv: totalPaid
        }));
        return { totalPaid, payDetails: matchedDetailsList };
      } else {
        setPaymentValidationInfo(null);
        return { totalPaid: 0, payDetails: matchedDetailsList };
      }
    } catch (e) {
      console.warn("Payment module sync error:", e);
      return { totalPaid: 0, payDetails: [] };
    }
  };

  // Function to calculate 'pending_received' quantity by comparing contract against received sums
  const calculatePendingReceived = (contractQty: number, totalCustomReceived: number): number => {
    return Math.max(0, contractQty - totalCustomReceived);
  };

  // Form State
  const [isEdit, setIsEdit] = useState(false);
  const [masterData, setMasterData] = useState<SettlementMaster>(initialMaster());
  const [saudaDeductionRecord, setSaudaDeductionRecord] = useState<any>(null);
  const [detailCols, setDetailCols] = useState<SettlementDetailColumn[]>([
    emptyDetailColumn(1), emptyDetailColumn(2), emptyDetailColumn(3), emptyDetailColumn(4)
  ]);
  const [showAllSpecCols, setShowAllSpecCols] = useState(false);
  const [showAllDeductionCols, setShowAllDeductionCols] = useState(false);

  // Helper to calculate total claim percentage for a column
  const getColTotalClaim = (col: SettlementDetailColumn | undefined): number => {
    if (!col) return 0;
    const isColActive = (Number(col.quantity) || 0) > 0 || (Number(col.arr_qty_wt) || 0) > 0 || (Number(col.wt_quantity) || 0) > 0;
    if (!isColActive) return 0;
    const gdVal = Number(col.gd_sett) > 0 ? Number(col.gd_sett) : Number(col.gd_claim || 0);
    const mVal = Number(col.moist_sett) > 0 ? Number(col.moist_sett) : Number(col.moist_claim || 0);
    const dVal = Number(col.dust_sett) > 0 ? Number(col.dust_sett) : Number(col.dust_claim || 0);
    const nVal = Number(col.ncv_sett) > 0 ? Number(col.ncv_sett) : Number(col.ncv_claim || 0);
    return Number((gdVal + mVal + dVal + nVal).toFixed(2));
  };

  // Condition: Only show Settlement Columns if 'Arr. Qty/Wt' is not null / > 0
  const visibleSpecCols = useMemo(() => {
    if (showAllSpecCols) return [1, 2, 3, 4];
    const active = [1, 2, 3, 4].filter(idx => {
      const col = detailCols[idx - 1];
      return col && col.arr_qty_wt !== null && col.arr_qty_wt !== undefined && Number(col.arr_qty_wt) > 0;
    });
    return active.length > 0 ? active : [1, 2, 3, 4];
  }, [detailCols, showAllSpecCols]);

  // Condition: In Active Deductions / Claims Audit Sheet, if Total Claim is 0 then do NOT show in column
  const visibleDeductionCols = useMemo(() => {
    if (showAllDeductionCols) return [1, 2, 3, 4];
    return [1, 2, 3, 4].filter(idx => {
      const col = detailCols[idx - 1];
      const hasArrWt = col && col.arr_qty_wt !== null && col.arr_qty_wt !== undefined && Number(col.arr_qty_wt) > 0;
      const totalClaim = getColTotalClaim(col);
      const poVal = Number(col?.po_grade_sett) > 0 ? Number(col?.po_grade_sett) : Number(col?.po_grade_claim || 0);
      return hasArrWt && (totalClaim > 0 || poVal > 0);
    });
  }, [detailCols, showAllDeductionCols]);

  // Helper to fetch Sauda Checkpoint deduction for a PO from sauda_check_point_deductions table
  const fetchSaudaCheckpointDeduction = async (cleanPoNo: string) => {
    if (!cleanPoNo) return null;
    try {
      const rawPoNo = cleanPoNo.trim().replace(/^#/, '');
      const poWithHash = '#' + rawPoNo;

      if (supabase) {
        const { data } = await supabase
          .from('sauda_check_point_deductions')
          .select('*')
          .or(`po_no.eq.${rawPoNo},po_no.eq.${poWithHash}`)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) return data;
      }

      const localRecords = await dbModule.fetchAll('sauda_check_point_deductions').catch(() => []);
      if (Array.isArray(localRecords) && localRecords.length > 0) {
        const found = localRecords.find((r: any) => {
          const rPo = String(r.po_no || '').trim().replace(/^#/, '').toUpperCase();
          return rPo === rawPoNo.toUpperCase();
        });
        if (found) return found;
      }
    } catch (err) {
      console.warn("Could not fetch sauda checkpoint deduction:", err);
    }
    return null;
  };

  // Helper to determine if a given MR number is the LAST / LATEST Final M.R. for a P.O.
  const isLastMrForPo = (targetMrNo: string, poNo: string) => {
    if (!targetMrNo || !poNo) return true;
    const cleanTargetPo = poNo.trim().replace(/^#/, '').toUpperCase();

    // Collect all inspection / final arrival items for this PO
    const matched = inspections.filter((insp: any) => {
      const mrVal = insp.mr_no || insp.final_arrival_no || insp.arrival_no;
      if (!mrVal) return false;
      const inspPo = (insp.po_no || '').trim().replace(/^#/, '').toUpperCase();
      return inspPo === cleanTargetPo ||
        (selectedPoData?.id && insp.po_id === selectedPoData.id) ||
        (selectedPoData?.purchase_order_id && (insp.po_id === selectedPoData.purchase_order_id || insp.purchase_order_id === selectedPoData.purchase_order_id));
    });

    const mrKeys = Array.from(new Set(matched.map((insp: any) => String(insp.mr_no || insp.final_arrival_no || insp.arrival_no || '').trim()).filter(Boolean)));

    if (targetMrNo && !mrKeys.some(k => k.toUpperCase() === targetMrNo.trim().toUpperCase())) {
      mrKeys.push(targetMrNo.trim());
    }

    if (mrKeys.length <= 1) return true;

    // Sort descending by numeric suffix / alphanumeric so highest/latest FA number is first
    mrKeys.sort((a, b) => {
      const getSuffix = (val: string) => {
        const m = val.match(/\d+/g);
        return m ? Number(m[m.length - 1]) : 0;
      };
      const suffA = getSuffix(a);
      const suffB = getSuffix(b);
      if (suffA !== suffB) return suffB - suffA;
      return b.localeCompare(a);
    });

    const lastMr = mrKeys[0];
    return targetMrNo.trim().toUpperCase() === lastMr.trim().toUpperCase();
  };
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewModalData, setViewModalData] = useState<{
    master: SettlementMaster;
    details: SettlementDetailColumn[];
  } | null>(null);

  const handleOpenViewSettlement = async (targetMrNo: string) => {
    try {
      setLoading(true);
      let foundMaster: any = null;
      let foundDetails: any[] = [];

      if (supabase) {
        try {
          const { data: mData } = await supabase
            .from('mr_settlement_master')
            .select('*')
            .eq('mr_no', targetMrNo)
            .maybeSingle();
          if (mData) foundMaster = mData;

          const { data: dData } = await supabase
            .from('mr_settlement_detail')
            .select('*')
            .eq('mr_no', targetMrNo)
            .order('col_index', { ascending: true });
          if (dData && dData.length > 0) foundDetails = dData;
        } catch (e) {}
      }

      if (!foundMaster) {
        const localMasters = await dbModule.fetchAll('mr_settlement_master').catch(() => []);
        foundMaster = localMasters.find((m: any) => m.mr_no === targetMrNo);
      }

      if (foundDetails.length === 0) {
        const localDetails = await dbModule.fetchAll('mr_settlement_detail').catch(() => []);
        foundDetails = localDetails.filter((d: any) => d.mr_no === targetMrNo);
      }

      const activeMaster = foundMaster || masterData;
      
      // Parse deductions if needed
      let deductionsList: SettlementDeductionItem[] = [];
      if (Array.isArray(activeMaster.deductions) && activeMaster.deductions.length > 0) {
        deductionsList = activeMaster.deductions;
      } else if (typeof activeMaster.deductions === 'string' && activeMaster.deductions.trim() !== '') {
        try {
          const parsed = JSON.parse(activeMaster.deductions);
          if (Array.isArray(parsed) && parsed.length > 0) deductionsList = parsed;
        } catch (e) {}
      }

      // Check inspection table or mill_inspection_deduction table if deduction list is still empty or single generic
      if (deductionsList.length === 0 || (deductionsList.length === 1 && !deductionsList[0].deduction_type)) {
        try {
          if (supabase) {
            // First check mill_inspection_deduction
            const { data: millDedList } = await supabase
              .from('mill_inspection_deduction')
              .select('*')
              .or(`mr_no.eq.${targetMrNo},arrival_no.eq.${targetMrNo}`)
              .order('created_at', { ascending: true });

            if (millDedList && millDedList.length > 0) {
              deductionsList = millDedList.map((d: any) => ({
                deduction_type: d.deduction_type || '',
                deduction_rate: Number(d.deduction_rate) || 0,
                deduction_qty: Number(d.deduction_qty) || 0,
                deduction_amount: Number(d.deduction_amount) || 0
              }));
            } else {
              const { data: inspData } = await supabase
                .from('material_inspection')
                .select('deductions, deduction_types, summary_deduction_type, summary_deduction_rate, summary_deduction_qty, summary_deduction_amount')
                .or(`mr_no.eq.${targetMrNo},final_arrival_no.eq.${targetMrNo},arrival_no.eq.${targetMrNo}`)
                .maybeSingle();
              
              if (inspData) {
                if (Array.isArray(inspData.deductions) && inspData.deductions.length > 0) {
                  deductionsList = inspData.deductions;
                } else if (Array.isArray(inspData.deduction_types) && inspData.deduction_types.length > 0) {
                  deductionsList = inspData.deduction_types;
                }
              }
            }
          }
        } catch (e) {
          console.warn("Could not load deductions from inspection:", e);
        }
      }

      if (deductionsList.length === 0) {
        const dType = activeMaster.summary_deduction_type || '';
        const dRate = Number(activeMaster.summary_deduction_rate) || 0;
        const dQty = Number(activeMaster.summary_deduction_qty) || (dRate > 0 ? 1 : 0);
        const dAmt = Number(activeMaster.summary_deduction_amount) || (dRate * dQty);

        if (dType.includes('\n') || dType.includes(',') || dType.includes(';')) {
          const parts = dType.split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean);
          deductionsList = parts.map((part: string, idx: number) => {
            let rowRate = 0;
            let rowQty = 1;
            let rowAmt = 0;
            const amtMatch = part.match(/₹\s*([0-9.]+)/i);
            const rateMatch = part.match(/@\s*₹?\s*([0-9.]+)/i) || part.match(/₹\s*([0-9.]+)/i);
            const qtyMatch = part.match(/([0-9.]+)\s*@/i) || part.match(/([0-9.]+)\s*(?:bales|units|nos|qntl)/i);
            if (amtMatch) rowAmt = parseFloat(amtMatch[1]) || 0;
            if (rateMatch) rowRate = parseFloat(rateMatch[1]) || 0;
            if (qtyMatch) rowQty = parseFloat(qtyMatch[1]) || 1;
            if (rowAmt === 0 && rowRate > 0) rowAmt = rowRate * rowQty;
            const cleanType = part.replace(/\(.*\)/g, '').replace(/@.*/g, '').replace(/₹.*/g, '').trim() || part;
            return {
              deduction_type: cleanType,
              deduction_rate: rowRate || (idx === 0 ? dRate : 0),
              deduction_qty: rowQty || (idx === 0 ? dQty : 1),
              deduction_amount: rowAmt || (idx === 0 ? dAmt : 0)
            };
          });
        } else if (dType && !dType.includes('-- SELECT') && (dRate > 0 || dAmt > 0)) {
          deductionsList = [{
            deduction_type: dType,
            deduction_rate: dRate,
            deduction_qty: dQty || 1,
            deduction_amount: dAmt || (dRate * (dQty || 1))
          }];
        }
      }

      const activeDetails: SettlementDetailColumn[] = [1, 2, 3, 4].map(idx => {
        const existing = foundDetails.find((d: any) => Number(d.col_index) === idx);
        return existing ? { ...emptyDetailColumn(idx), ...existing } : (detailCols[idx-1] || emptyDetailColumn(idx));
      });

      setViewModalData({
        master: {
          ...activeMaster,
          deductions: deductionsList
        },
        details: activeDetails
      });
      setShowViewModal(true);
    } catch (err: any) {
      console.error("Failed to load view settlement:", err);
      setErrorMessage("Unable to open settlement view: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const po = masterData.po_no || selectedPoNo;
    const mr = masterData.mr_no;
    if (po || mr) {
      syncPaymentModuleData(mr, po);
    }
  }, [masterData.po_no, masterData.mr_no, selectedPoNo]);

  // Derived options for P.O. and P.O.-filtered FA (Final Arrival / MR) searchable dropdowns
  const poOptions = React.useMemo(() => {
    return purchaseOrders.map((po: any) => {
      const isDone = po.isCompleted || po.status === 'completed' || po.status === 'settled';
      return {
        value: po.po_no,
        label: `#${po.po_no} (${po.supplier || 'PO'})${isDone ? ' - [COMPLETED]' : ''}`
      };
    });
  }, [purchaseOrders]);

  const faOptionsForSelectedPo = React.useMemo(() => {
    if (!selectedPoNo) return [];

    const cleanTargetPo = selectedPoNo.trim().replace(/^#/, '').toUpperCase();

    const matched = inspections.filter((insp: any) => {
      const mrVal = insp.mr_no || insp.final_arrival_no || insp.arrival_no;
      if (!mrVal) return false;

      const inspPo = (insp.po_no || '').trim().replace(/^#/, '').toUpperCase();
      const cleanPo = (s: string) => (s || '').replace(/^#/, '').replace(/[\s\-\/]/g, '').trim().toUpperCase();
      const isPoMatch = inspPo === cleanTargetPo ||
        cleanPo(inspPo) === cleanPo(cleanTargetPo) ||
        inspPo.includes(cleanTargetPo) ||
        cleanTargetPo.includes(inspPo) ||
        (selectedPoData?.id && insp.po_id === selectedPoData.id) ||
        (selectedPoData?.purchase_order_id && (insp.po_id === selectedPoData.purchase_order_id || insp.purchase_order_id === selectedPoData.purchase_order_id));

      if (!isPoMatch) return false;

      const isAlreadySettled = settledList.some(s => String(s.mr_no).trim().toUpperCase() === String(mrVal).trim().toUpperCase()) || insp.status === 'settled';
      const isCurrentMr = masterData.mr_no && String(masterData.mr_no).trim().toUpperCase() === String(mrVal).trim().toUpperCase();

      return !isAlreadySettled || isCurrentMr || (isEdit && isCurrentMr);
    });

    const seen = new Set<string>();
    const optionsList: { label: string; value: string }[] = [];

    matched.forEach((insp: any) => {
      const mrVal = String(insp.mr_no || insp.final_arrival_no || insp.arrival_no || '').trim();
      if (!mrVal) return;
      const key = mrVal.toUpperCase();
      if (seen.has(key)) return;
      seen.add(key);

      const lorryVal = insp.lorry_number || insp.lorry_no || insp.vehicle_no || insp.final_arrival_no || insp.arrival_no || mrVal;
      optionsList.push({
        value: mrVal,
        label: `${mrVal} (Lorry: ${lorryVal})`
      });
    });

    optionsList.sort((a, b) => {
      const getSuffix = (val: string) => {
        const m = val.match(/\d+/g);
        return m ? Number(m[m.length - 1]) : 0;
      };
      const suffA = getSuffix(a.value);
      const suffB = getSuffix(b.value);
      if (suffA !== suffB) return suffB - suffA;
      return b.value.localeCompare(a.value);
    });

    if (masterData.mr_no && !seen.has(masterData.mr_no.toUpperCase())) {
      const lorryVal = masterData.lorry_number || masterData.mr_no;
      optionsList.unshift({
        value: masterData.mr_no,
        label: `${masterData.mr_no} (Lorry: ${lorryVal})`
      });
    }

    return optionsList;
  }, [selectedPoNo, selectedPoData, inspections, settledList, isEdit, masterData.mr_no, masterData.lorry_number]);

  const [gradeMasterList, setGradeMasterList] = useState<any[]>([]);
  const [agencyMasterList, setAgencyMasterList] = useState<any[]>([]);
  const [markaMasterList, setMarkaMasterList] = useState<any[]>([]);
  const [areaMasterList, setAreaMasterList] = useState<any[]>([]);
  const [deductionMasterList, setDeductionMasterList] = useState<any[]>([]);

  const resolveGradeName = (raw: any, overrideList?: any[]): string => {
    if (!raw && raw !== 0) return '';
    const str = String(raw).trim();
    if (!str) return '';
    const list = overrideList || gradeMasterList;
    const matchByName = list.find(g => 
      String(g.grade_name || '').trim().toUpperCase() === str.toUpperCase() ||
      String(g.grade || '').trim().toUpperCase() === str.toUpperCase()
    );
    if (matchByName) return matchByName.grade_name || matchByName.grade || str;
    const matchByCode = list.find(g => 
      String(g.grade_code || '').trim().toUpperCase() === str.toUpperCase() ||
      String(g.id || '').trim() === str
    );
    if (matchByCode) return matchByCode.grade_name || matchByCode.grade || str;
    return str;
  };

  const resolveAgencyName = (raw: any, overrideList?: any[]): string => {
    if (!raw && raw !== 0) return '';
    const str = String(raw).trim();
    if (!str) return '';
    const list = overrideList || agencyMasterList;
    const matchByName = list.find(a => 
      String(a.agency_name || '').trim().toUpperCase() === str.toUpperCase() ||
      String(a.agency || '').trim().toUpperCase() === str.toUpperCase()
    );
    if (matchByName) return matchByName.agency_name || matchByName.agency || str;
    const matchByCode = list.find(a => 
      String(a.agency_code || '').trim().toUpperCase() === str.toUpperCase() ||
      String(a.id || '').trim() === str
    );
    if (matchByCode) return matchByCode.agency_name || matchByCode.agency || str;
    return str;
  };

  const resolveMarkaName = (raw: any, overrideList?: any[]): string => {
    if (!raw && raw !== 0) return '';
    const str = String(raw).trim();
    if (!str) return '';
    const list = overrideList || markaMasterList;
    const matchByName = list.find(m => 
      String(m.marka_name || '').trim().toUpperCase() === str.toUpperCase() ||
      String(m.marka || '').trim().toUpperCase() === str.toUpperCase()
    );
    if (matchByName) return matchByName.marka_name || matchByName.marka || str;
    const matchByCode = list.find(m => 
      String(m.marka_code || '').trim().toUpperCase() === str.toUpperCase() ||
      String(m.id || '').trim() === str
    );
    if (matchByCode) return matchByCode.marka_name || matchByCode.marka || str;
    return str;
  };

  const resolveAreaName = (raw: any, overrideList?: any[]): string => {
    if (!raw && raw !== 0) return '';
    const str = String(raw).trim();
    if (!str) return '';
    const list = overrideList || areaMasterList;
    const matchByName = list.find(a => 
      String(a.area_name || '').trim().toUpperCase() === str.toUpperCase() ||
      String(a.area || '').trim().toUpperCase() === str.toUpperCase()
    );
    if (matchByName) return matchByName.area_name || matchByName.area || str;
    const matchByCode = list.find(a => 
      String(a.area_code || '').trim().toUpperCase() === str.toUpperCase() ||
      String(a.id || '').trim() === str
    );
    if (matchByCode) return matchByCode.area_name || matchByCode.area || str;
    return str;
  };

  const buildSettlementCol = (
    idx: number,
    item: any,
    pDet: any,
    faMaster: any,
    inspMaster: any,
    poData: any,
    gList?: any[],
    agList?: any[],
    mList?: any[],
    arList?: any[],
    inspItem?: any,
    payDetailItem?: any
  ): SettlementDetailColumn => {
    const col = emptyDetailColumn(idx);
    if (!item && !pDet && !inspItem) return col;

    // 1. Grade (Primary from Mill Inspection / arrival item if present, otherwise PO item)
    const poGrade = pDet?.grade_name || pDet?.quality || (pDet?.grade_code ? resolveGradeName(pDet.grade_code, gList) : '') || pDet?.grade || '';
    const arrivalGrade = 
      inspItem?.stock_grade_name || inspItem?.arrival_grade || inspItem?.grade || inspItem?.grade_name || 
      inspItem?.stock_grade_code || inspItem?.grade_code ||
      item?.stock_grade_name || item?.arrival_grade || item?.grade || item?.grade_name || item?.receipt_grade_name || 
      item?.grade_code || item?.stock_grade_code || item?.receipt_grade_code || item?.challan_grade_name || 
      item?.quality || item?.stock_grade || '';
    
    const rawGrade = arrivalGrade || poGrade;
    col.grade = resolveGradeName(rawGrade, gList) || rawGrade || '';

    // 2. Area (Primary from Mill Inspection Item, then arrival, then PO)
    const rawArea = 
      inspItem?.area || inspMaster?.arrival_area_name || 
      item?.area || item?.arrival_area_name || faMaster?.arrival_area_name || 
      pDet?.area || poData?.area || '';
    
    col.area = resolveAreaName(rawArea, arList) || rawArea || '';

    // 3. Agency (Primary from Mill Inspection Item, then arrival, then PO)
    const rawAgency = 
      inspItem?.agency_name || inspItem?.agency || inspItem?.agency_code || 
      item?.agency_name || item?.agency || item?.agency_code || 
      pDet?.agency_name || pDet?.agency_code || pDet?.agency || 
      faMaster?.agency_name || faMaster?.agency || faMaster?.grid_details?.[0]?.agency_name || 
      inspMaster?.agency_name || poData?.agency || '';
    
    col.agency = resolveAgencyName(rawAgency, agList) || rawAgency || '';

    // 4. Marka / Crop (Primary from Mill Inspection Item, then arrival, then PO)
    const rawMarka = 
      inspItem?.marka_name || inspItem?.marka || inspItem?.marka_code || 
      item?.marka_name || item?.challan_marka_name || item?.marka || item?.marka_code || item?.challan_marka_code || 
      pDet?.marka_name || pDet?.marka_code || pDet?.marka || 
      faMaster?.marka || faMaster?.grid_details?.[0]?.challan_marka_name || inspMaster?.marka || poData?.marks || '';
    const resolvedMarka = resolveMarkaName(rawMarka, mList) || rawMarka || '';

    const rawCrop = 
      inspItem?.crop_year || inspItem?.crop || inspMaster?.crop_year || faMaster?.crop_year || 
      item?.crop_year || item?.crop || pDet?.crop_year || poData?.crop_year || faMaster?.grid_details?.[0]?.crop_year || '2026-27';

    col.marka_crop = (resolvedMarka ? resolvedMarka : '') + 
      (rawCrop ? (resolvedMarka ? ` / ${rawCrop}` : rawCrop) : '');

    // 5. Quantity (Bales) - only if this material arrived in this lorry
    const rawQty = (inspItem || item) ? (
      inspItem?.quantity || inspItem?.bales ||
      item?.quantity || item?.quantity_rcpt || item?.quantity_chln || item?.qty || item?.packets || item?.total_packets || item?.bales || 0
    ) : 0;
    
    col.quantity = Number(rawQty) || 0;

    // 6. Arrival Quantity / Weight (Arr Qty Wt) -> EXACTLY Final Receipt Wt. (Claim) from Mill Inspection
    let rawWt = 0;
    if (inspItem || item) {
      if (inspItem?.final_receipt_wt !== undefined && inspItem?.final_receipt_wt !== null && Number(inspItem.final_receipt_wt) > 0) {
        rawWt = Number(inspItem.final_receipt_wt);
      } else if (item?.final_receipt_wt !== undefined && item?.final_receipt_wt !== null && Number(item.final_receipt_wt) > 0) {
        rawWt = Number(item.final_receipt_wt);
      } else if (inspItem?.receipt_gross_wt && Number(inspItem.receipt_gross_wt) > 0) {
        rawWt = Number(inspItem.receipt_gross_wt);
      } else if (inspItem?.challan_gross_wt && Number(inspItem.challan_gross_wt) > 0) {
        rawWt = Number(inspItem.challan_gross_wt);
      } else if (item?.receipt_gross_wt && Number(item.receipt_gross_wt) > 0) {
        rawWt = Number(item.receipt_gross_wt);
      } else if (item?.weight && Number(item.weight) > 0) {
        rawWt = Number(item.weight);
      } else if (item?.arr_qty_wt && Number(item.arr_qty_wt) > 0) {
        rawWt = Number(item.arr_qty_wt);
      } else if (inspItem?.weight && Number(inspItem.weight) > 0) {
        rawWt = Number(inspItem.weight);
      }
    }
    
    col.arr_qty_wt = col.quantity > 0 || rawWt > 0 ? (Number(rawWt) || 0) : 0;
    // Min.Qty/Wt is "Arr. Qty/Wt" with 3% acceptable (97% of Arr. Qty/Wt)
    col.min_qty_wt = col.arr_qty_wt > 0 ? Number((col.arr_qty_wt * 0.97).toFixed(3)) : 0;

    // 7. Rate (Primary from Payment Section "Sett Rate (₹/Qtl)", then Final P.O contract rate, then inspection/arrival)
    let paymentSettRate = 0;
    if (payDetailItem) {
      if (payDetailItem.sett_rate !== undefined && payDetailItem.sett_rate !== null && Number(payDetailItem.sett_rate) > 0) {
        paymentSettRate = Number(payDetailItem.sett_rate);
      } else if (Number(payDetailItem.rate_value) > 0) {
        const ded = Number(payDetailItem.deduction_rate) || 0;
        paymentSettRate = Math.max(0, Number(payDetailItem.rate_value) - ded);
      }
    }

    if (paymentSettRate > 0) {
      col.rate_value = paymentSettRate;
    } else {
      const rawRate = 
        pDet?.rate_qntl || pDet?.rate_per_mt || pDet?.rate || pDet?.rate_mt ||
        poData?.rate_qntl || poData?.rate_mt || poData?.b_rate ||
        inspItem?.rate || inspItem?.rate_qntl ||
        item?.rate_value || item?.rate || item?.rate_qntl || item?.recon_rate_mt || 0;
      
      col.rate_value = Number(rawRate) || 0;
      if (!col.rate_value || col.rate_value === 0) {
        const fallbackRate = Number(poData?.b_rate || poData?.rate_qntl || poData?.rate_mt || 0);
        if (fallbackRate > 0) {
          col.rate_value = fallbackRate;
        }
      }
    }

    // 8. Wt/Quantity calculation: Round "Arr. Qty/Wt" convert in kg / Quantity (B)
    const rawWtKg = col.arr_qty_wt > 0 ? (col.arr_qty_wt <= 50 ? col.arr_qty_wt * 1000 : col.arr_qty_wt) : 0;
    col.wt_quantity = col.quantity > 0 && rawWtKg > 0 ? Math.round(rawWtKg / col.quantity) : (Number(inspItem?.marks_phota || item?.marks_phota) || 0);
    col.wt_phota = col.wt_quantity;

    // 9. Active Deductions / Claims Audit Sheet mappings from Inspection Details:
    // Grade Down (%)
    // SETT (%) comes from Inspection "Gr. Down" in "Mill Settlement %" table
    const rawGdSett = inspItem?.settlement_grade_down ?? item?.settlement_grade_down ?? 
      inspItem?.grade_down_sett ?? item?.grade_down_sett ?? 
      inspItem?.gd_sett ?? item?.gd_sett ?? 
      inspItem?.sett_grade_down ?? item?.sett_grade_down;
    if (rawGdSett != null) col.gd_sett = Number(rawGdSett);

    // CLAIM (%) comes from Inspection "Grade Down Claim" or "Grade Down Act"
    const rawGdClaim = inspItem?.grade_down_claim ?? item?.grade_down_claim ?? 
      inspItem?.claim_grade_down ?? item?.claim_grade_down ?? 
      inspItem?.grade_down_act ?? item?.grade_down_act ?? 
      inspItem?.actual_grade_down ?? item?.actual_grade_down ?? 
      inspItem?.gd_claim ?? item?.gd_claim;
    if (rawGdClaim != null) col.gd_claim = Number(rawGdClaim);
    else if (inspMaster?.claim_grade_down != null) col.gd_claim = Number(inspMaster.claim_grade_down);

    // Moisture (%)
    // SETT (%) comes from Inspection "Moisture" in "Mill Settlement %" table
    const rawMoistSett = inspItem?.settlement_moisture ?? item?.settlement_moisture ?? 
      inspItem?.moisture_sett ?? item?.moisture_sett ?? 
      inspItem?.moist_sett ?? item?.moist_sett ?? 
      inspItem?.sett_moisture ?? item?.sett_moisture;
    if (rawMoistSett != null) col.moist_sett = Number(rawMoistSett);

    // CLAIM (%) comes from Inspection "Moisture Claim" or "Moisture Act" or "Insp Read Avg"
    const rawMoistClaim = inspItem?.moisture_claim ?? item?.moisture_claim ?? 
      inspItem?.claim_moisture ?? item?.claim_moisture ?? 
      inspItem?.moisture_act ?? item?.moisture_act ?? 
      inspItem?.actual_moisture ?? item?.actual_moisture ?? 
      inspItem?.insp_read_avg ?? item?.insp_read_avg ?? 
      inspItem?.moist_claim ?? item?.moist_claim;
    if (rawMoistClaim != null) col.moist_claim = Number(rawMoistClaim);
    else if (inspMaster?.claim_moisture != null) col.moist_claim = Number(inspMaster.claim_moisture);

    // Dust (%)
    // SETT (%) comes from Inspection "Dust" in "Mill Settlement %" table
    const rawDustSett = inspItem?.settlement_dust ?? item?.settlement_dust ?? 
      inspItem?.dust_sett ?? item?.dust_sett ?? 
      inspItem?.sett_dust ?? item?.sett_dust;
    if (rawDustSett != null) col.dust_sett = Number(rawDustSett);

    // CLAIM (%) comes from Inspection "Dust Claim" or "Dust Act"
    const rawDustClaim = inspItem?.dust_claim ?? item?.dust_claim ?? 
      inspItem?.claim_dust ?? item?.claim_dust ?? 
      inspItem?.dust_act ?? item?.dust_act ?? 
      inspItem?.actual_dust ?? item?.actual_dust ?? 
      inspItem?.dust_claim ?? item?.dust_claim;
    if (rawDustClaim != null) col.dust_claim = Number(rawDustClaim);
    else if (inspMaster?.claim_dust != null) col.dust_claim = Number(inspMaster.claim_dust);

    // NCV (%)
    // SETT (%) comes from Inspection "NCV" in "Mill Settlement %" table
    const rawNcvSett = inspItem?.settlement_ncv ?? item?.settlement_ncv ?? 
      inspItem?.ncv_sett ?? item?.ncv_sett ?? 
      inspItem?.sett_ncv ?? item?.sett_ncv;
    if (rawNcvSett != null) col.ncv_sett = Number(rawNcvSett);

    // CLAIM (%) comes from Inspection "NCV Claim" or "NCV Act"
    const rawNcvClaim = inspItem?.ncv_claim ?? item?.ncv_claim ?? 
      inspItem?.claim_ncv ?? item?.claim_ncv ?? 
      inspItem?.ncv_act ?? item?.ncv_act ?? 
      inspItem?.actual_ncv ?? item?.actual_ncv ?? 
      inspItem?.ncv_claim ?? item?.ncv_claim;
    if (rawNcvClaim != null) col.ncv_claim = Number(rawNcvClaim);
    else if (inspMaster?.claim_ncv != null) col.ncv_claim = Number(inspMaster.claim_ncv);

    // PO / Grade / Delivery Claim
    const rawPoGradeSett = inspItem?.po_grade_sett ?? item?.po_grade_sett;
    if (rawPoGradeSett != null) col.po_grade_sett = Number(rawPoGradeSett);

    const rawPoGradeClaim = inspItem?.po_grade_claim ?? item?.po_grade_claim ?? 
      inspItem?.delivery_claim ?? item?.delivery_claim;
    if (rawPoGradeClaim != null) col.po_grade_claim = Number(rawPoGradeClaim);
    else if (inspMaster?.delivery_claim != null) col.po_grade_claim = Number(inspMaster.delivery_claim);

    // Total Claim calculation: Grade Down (%) + Moisture (%) + Dust (%) + NCV (%)
    const gdVal = Number(col.gd_sett) > 0 ? Number(col.gd_sett) : Number(col.gd_claim || 0);
    const mVal = Number(col.moist_sett) > 0 ? Number(col.moist_sett) : Number(col.moist_claim || 0);
    const dVal = Number(col.dust_sett) > 0 ? Number(col.dust_sett) : Number(col.dust_claim || 0);
    const nVal = Number(col.ncv_sett) > 0 ? Number(col.ncv_sett) : Number(col.ncv_claim || 0);
    col.claim_settlement = Number((gdVal + mVal + dVal + nVal).toFixed(2));

    return col;
  };

  const buildAlignedSettlementColumns = (
    poDetails: any[],
    inspDetails: any[],
    faGridArr: any[],
    faMaster: any,
    inspMaster: any,
    poData: any,
    gList: any[],
    agList: any[],
    mList: any[],
    arList: any[],
    payDetails: any[] = []
  ): SettlementDetailColumn[] => {
    // 1. Prepare normalized arrival rows
    const arrivalRows: Array<{ inspItem: any; faItem: any; rawGrade: string; gradeName: string; gradeCode: string; hasData: boolean }> = [];
    const maxArrivalLen = Math.max(inspDetails?.length || 0, faGridArr?.length || 0);
    for (let i = 0; i < maxArrivalLen; i++) {
      const inspItem = inspDetails?.[i] || null;
      const faItem = faGridArr?.[i] || null;
      const rawG = 
        inspItem?.stock_grade_name || inspItem?.arrival_grade || inspItem?.grade || inspItem?.grade_name || 
        inspItem?.stock_grade_code || inspItem?.grade_code ||
        faItem?.receipt_grade_name || faItem?.challan_grade_name || faItem?.stock_grade_name || faItem?.arrival_grade || 
        faItem?.grade || faItem?.grade_name || faItem?.quality || '';
      const codeG = String(
        inspItem?.stock_grade_code || inspItem?.grade_code || 
        faItem?.receipt_grade_code || faItem?.grade_code || ''
      ).trim();
      const nameG = (resolveGradeName(rawG || codeG, gList) || rawG || '').trim().toUpperCase();

      const wt = Number(inspItem?.weight_qtl || inspItem?.arr_qty_wt || faItem?.weight_qtl || faItem?.arr_qty_wt || 0);
      const qty = Number(inspItem?.bales || inspItem?.quantity || faItem?.bales || faItem?.quantity || 0);
      const hasData = wt > 0 || qty > 0 || Boolean(nameG || codeG);

      if (hasData) {
        arrivalRows.push({
          inspItem,
          faItem,
          rawGrade: rawG,
          gradeName: nameG,
          gradeCode: codeG,
          hasData
        });
      }
    }

    const matchedPoIndices = new Set<number>();

    // Priority 1: If arrival rows exist, assign columns 1..4 based on the actual ARRIVED materials
    if (arrivalRows.length > 0) {
      return [1, 2, 3, 4].map(idx => {
        const arr = arrivalRows[idx - 1] || null;
        if (arr) {
          // Find matching PO item for this arrived grade
          let matchedPoItem: any = null;
          let matchedPoIdx = -1;
          if (poDetails && poDetails.length > 0) {
            // 1. Try findMatchedPoItem first with unallocated PO items
            const availablePoItems = poDetails.filter((_, pIdx) => !matchedPoIndices.has(pIdx));
            const colSpec = {
              grade: arr.gradeName || arr.rawGrade,
              stock_grade_code: arr.gradeCode,
              agency: arr.inspItem?.agency_name || arr.inspItem?.agency || arr.faItem?.agency_name || arr.faItem?.agency || '',
              area: arr.inspItem?.area || arr.faItem?.area || ''
            };
            const matched = findMatchedPoItem(colSpec, availablePoItems, { gradeMasters: gList, agencyMasters: agList });
            if (matched) {
              matchedPoItem = matched;
              matchedPoIdx = poDetails.indexOf(matched);
            } else {
              // 2. Fallback to manual matching
              for (let pIdx = 0; pIdx < poDetails.length; pIdx++) {
                if (matchedPoIndices.has(pIdx)) continue;
                const pDet = poDetails[pIdx];
                const poRawG = pDet.grade_name || pDet.quality || pDet.grade || '';
                const poCodeG = String(pDet.grade_code || '').trim();
                const poNameG = (resolveGradeName(poRawG || poCodeG, gList) || poRawG || '').trim().toUpperCase();

                const isNameMatch = Boolean(poNameG && arr.gradeName && poNameG === arr.gradeName);
                const isCodeMatch = Boolean(poCodeG && arr.gradeCode && poCodeG === arr.gradeCode);
                const isCrossCodeNameMatch = Boolean(
                  (poCodeG && arr.gradeName && resolveGradeName(poCodeG, gList)?.trim().toUpperCase() === arr.gradeName) ||
                  (arr.gradeCode && poNameG && resolveGradeName(arr.gradeCode, gList)?.trim().toUpperCase() === poNameG)
                );

                if (isNameMatch || isCodeMatch || isCrossCodeNameMatch) {
                  matchedPoItem = pDet;
                  matchedPoIdx = pIdx;
                  break;
                }
              }
            }
          }
          if (matchedPoIdx !== -1) {
            matchedPoIndices.add(matchedPoIdx);
          }

          // Find matching payment detail row from Payment Module
          const matchedPayDetail = (payDetails || []).find(pd => Number(pd.col_index) === idx) ||
            (payDetails || []).find(pd => {
              const pdGrade = (resolveGradeName(pd.grade, gList) || String(pd.grade || '')).trim().toUpperCase();
              const arrGrade = (resolveGradeName(arr.gradeName || arr.rawGrade, gList) || String(arr.gradeName || arr.rawGrade || '')).trim().toUpperCase();
              return Boolean(pdGrade && arrGrade && pdGrade === arrGrade);
            });

          return buildSettlementCol(
            idx,
            arr.inspItem || arr.faItem,
            matchedPoItem,
            faMaster,
            inspMaster,
            poData,
            gList,
            agList,
            mList,
            arList,
            arr.inspItem,
            matchedPayDetail
          );
        } else {
          return emptyDetailColumn(idx);
        }
      });
    }

    // Priority 2: If no arrival rows exist yet, populate from PO details
    if (poDetails && poDetails.length > 0) {
      return [1, 2, 3, 4].map(idx => {
        const pDet = poDetails[idx - 1] || null;
        if (pDet) {
          const matchedPayDetail = (payDetails || []).find(pd => Number(pd.col_index) === idx) ||
            (payDetails || []).find(pd => {
              const pdGrade = (resolveGradeName(pd.grade, gList) || String(pd.grade || '')).trim().toUpperCase();
              const poGrade = (resolveGradeName(pDet.grade_name || pDet.quality || pDet.grade, gList) || '').trim().toUpperCase();
              return Boolean(pdGrade && poGrade && pdGrade === poGrade);
            });

          return buildSettlementCol(
            idx,
            null,
            pDet,
            faMaster,
            inspMaster,
            poData,
            gList,
            agList,
            mList,
            arList,
            null,
            matchedPayDetail
          );
        }
        return emptyDetailColumn(idx);
      });
    }

    return [1, 2, 3, 4].map(idx => emptyDetailColumn(idx));
  };

  const fetchPoAndItemDetails = async (poNo: string): Promise<{ poData: any; poDetails: any[] }> => {
    if (!poNo) return { poData: null, poDetails: [] };
    const cleanPo = String(poNo).trim().replace(/^#/, '');
    const withHash = `#${cleanPo}`;

    let poData: any = null;
    let poDetails: any[] = [];

    try {
      if (supabase) {
        // 1. Fetch PO Master from purchase_master, sauda_check_point, or po_archive
        const [pmRes, scpRes] = await Promise.all([
          supabase.from('purchase_master').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}"`).maybeSingle(),
          supabase.from('sauda_check_point').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}"`).maybeSingle()
        ]);

        if (pmRes?.data) {
          poData = pmRes.data;
        } else if (scpRes?.data) {
          const scp = scpRes.data;
          poData = {
            ...scp,
            po_date: scp.po_date || scp.s_date,
            supplier: scp.supplier_name || scp.supplier,
            broker: scp.broker_name || scp.broker,
            total_contract_mt: scp.total_contract_mt || scp.quantity || 0,
            pending: scp.pending ?? true,
            status: scp.status || 'temp'
          };
        } else {
          // Check po_archive
          const { data: archPo } = await supabase.from('po_archive').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}"`).maybeSingle();
          if (archPo) poData = archPo;
        }

        // ILIKE fallback if still not found
        if (!poData) {
          const [pmIlike, scpIlike] = await Promise.all([
            supabase.from('purchase_master').select('*').ilike('po_no', cleanPo).limit(1),
            supabase.from('sauda_check_point').select('*').ilike('po_no', cleanPo).limit(1)
          ]);
          if (pmIlike?.data && pmIlike.data.length > 0) poData = pmIlike.data[0];
          else if (scpIlike?.data && scpIlike.data.length > 0) {
            const scp = scpIlike.data[0];
            poData = {
              ...scp,
              po_date: scp.po_date || scp.s_date,
              supplier: scp.supplier_name || scp.supplier,
              broker: scp.broker_name || scp.broker,
              total_contract_mt: scp.total_contract_mt || scp.quantity || 0,
              pending: scp.pending ?? true,
              status: scp.status || 'temp'
            };
          }
        }

        // 2. Fetch PO line items
        if (poData?.items || poData?.grid_details) {
          const parsed = parseGridOrItems(poData.items || poData.grid_details);
          if (parsed.length > 0 && parsed.some((it: any) => it.grade || it.grade_name || it.grade_code || it.rate_qntl || it.rate)) {
            poDetails = parsed;
          }
        }

        if (poDetails.length === 0) {
          const [pdmRes, scpdRes] = await Promise.all([
            supabase.from('purchase_detail_master').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}"`).order('srl_no', { ascending: true }),
            supabase.from('sauda_check_point_details').select('*').or(`po_no.eq."${cleanPo}",po_no.eq."${withHash}",po_no.eq."${poNo}"`).order('srl_no', { ascending: true })
          ]);

          if (pdmRes?.data && pdmRes.data.length > 0) {
            poDetails = pdmRes.data;
          } else if (scpdRes?.data && scpdRes.data.length > 0) {
            poDetails = scpdRes.data;
          } else {
            // ILIKE fallback
            const [pdmIlike, scpdIlike] = await Promise.all([
              supabase.from('purchase_detail_master').select('*').ilike('po_no', cleanPo),
              supabase.from('sauda_check_point_details').select('*').ilike('po_no', cleanPo)
            ]);
            if (pdmIlike?.data && pdmIlike.data.length > 0) poDetails = pdmIlike.data;
            else if (scpdIlike?.data && scpdIlike.data.length > 0) poDetails = scpdIlike.data;
          }
        }
      }

      // Local indexedDB fallback
      if (!poData) {
        const [localPm, localScp] = await Promise.all([
          dbModule.fetchAll('purchase_master').catch(() => []),
          dbModule.fetchAll('sauda_check_point').catch(() => [])
        ]);
        const matchPm = (localPm || []).find((p: any) => String(p.po_no || '').trim().toUpperCase().replace(/^#/, '') === cleanPo.toUpperCase());
        if (matchPm) poData = matchPm;
        else {
          const matchScp = (localScp || []).find((p: any) => String(p.po_no || '').trim().toUpperCase().replace(/^#/, '') === cleanPo.toUpperCase());
          if (matchScp) poData = matchScp;
        }
      }

      if (poDetails.length === 0) {
        const [localPdm, localScpd] = await Promise.all([
          dbModule.fetchAll('purchase_detail_master').catch(() => []),
          dbModule.fetchAll('sauda_check_point_details').catch(() => [])
        ]);
        const matchPdm = (localPdm || []).filter((d: any) => String(d.po_no || '').trim().toUpperCase().replace(/^#/, '') === cleanPo.toUpperCase());
        if (matchPdm.length > 0) poDetails = matchPdm;
        else {
          const matchScpd = (localScpd || []).filter((d: any) => String(d.po_no || '').trim().toUpperCase().replace(/^#/, '') === cleanPo.toUpperCase());
          if (matchScpd.length > 0) poDetails = matchScpd;
        }
      }
    } catch (err) {
      console.warn("Error in fetchPoAndItemDetails:", err);
    }

    // Resolve master lists to enrich items
    let gList = gradeMasterList;
    let agList = agencyMasterList;
    if ((!gList || gList.length === 0 || !agList || agList.length === 0) && supabase) {
      try {
        const [gData, agData] = await Promise.all([
          supabase.from('grade_master').select('*').then(r => r.data || [], () => []),
          supabase.from('agency_master').select('*').then(r => r.data || [], () => [])
        ]);
        if (gData?.length > 0) { gList = gData; setGradeMasterList(gData); }
        if (agData?.length > 0) { agList = agData; setAgencyMasterList(agData); }
      } catch (e) {}
    }

    const enrichedItems = poDetails.map((item: any) => {
      let gradeName = item.grade_name || item.grade || item.quality || '';
      if (!gradeName && item.grade_code && gList && gList.length > 0) {
        const match = gList.find((g: any) => String(g.grade_code || g.code || g.id || '').trim().toUpperCase() === String(item.grade_code).trim().toUpperCase());
        if (match) gradeName = match.grade_name || match.name || '';
      }

      let agencyName = item.agency_name || item.agency || '';
      if (!agencyName && item.agency_code && agList && agList.length > 0) {
        const match = agList.find((a: any) => String(a.agency_code || a.code || a.id || '').trim().toUpperCase() === String(item.agency_code).trim().toUpperCase());
        if (match) agencyName = match.agency_name || match.name || '';
      }

      const rateVal = Number(item.rate_qntl || item.rate_per_mt || item.rate_mt || item.rate || poData?.b_rate || poData?.rate_qntl || 0);

      return {
        ...item,
        grade_name: gradeName || item.grade_code || '',
        agency_name: agencyName || item.agency_code || '',
        rate_qntl: rateVal,
        rate_per_mt: rateVal,
        rate: rateVal
      };
    });

    if (poData && !poData.rate_qntl) {
      poData.rate_qntl = Number(poData.rate_mt || poData.b_rate || 0);
    }

    return { poData, poDetails: enrichedItems };
  };

  useLiveAutoRefresh(initPage, [], { 
    tables: [
      'mr_settlement_master', 
      'm_r_settlement', 
      'material_inspection',
      'material_inspection_details',
      'mill_inspection_master',
      'mill_inspection_detail',
      'mill_inspection_deduction',
      'final_arrival', 
      'purchase_master', 
      'payment_master', 
      'temporary_material_received', 
      'sauda_check_point', 
      'sauda_master'
    ] 
  });

  // Load dashboards & dropdowns
  async function initPage() {
    if (settledList.length === 0) setLoading(true);
    try {
      if (supabase) {
        // Fetch master registers for lookup
        const [gData, agData, mDataList, aData, dData] = await Promise.all([
          supabase.from('grade_master').select('*').then(r => r.data || [], () => []),
          supabase.from('agency_master').select('*').then(r => r.data || [], () => []),
          supabase.from('marka_master').select('*').then(r => r.data || [], () => []),
          supabase.from('area_master').select('*').then(r => r.data || [], () => []),
          supabase.from('deduction_master').select('*').then(r => r.data || [], () => [])
        ]);
        setGradeMasterList(gData);
        setAgencyMasterList(agData);
        setMarkaMasterList(mDataList);
        setAreaMasterList(aData);
        setDeductionMasterList(dData);

        // 1. Fetch saved settlements & payments
        const [mDataRes, payRes] = await Promise.all([
          supabase.from('mr_settlement_master').select('*').order('created_at', { ascending: false }),
          supabase.from('payment_master').select('*').then(res => res, () => ({ data: [] }))
        ]);
        if (!mDataRes.error && mDataRes.data) setSettledList(mDataRes.data);
        const payList = payRes.data && payRes.data.length > 0 ? payRes.data : await dbModule.fetchAll('payment_master').catch(() => []);
        setPaymentList(payList);

        // 2. Fetch completed inspections from Mill Inspection Section (material_inspection, final_arrival)
        const [matInspRes, faRes] = await Promise.all([
          supabase.from('material_inspection').select('*').order('created_at', { ascending: false }).then(r => r.data || [], () => []),
          supabase.from('final_arrival').select('*').order('date', { ascending: false }).then(r => r.data || [], () => []),
        ]);

        const combinedInspections: any[] = [];
        const seenMrNos = new Set<string>();

        // Priority 1: material_inspection (Mill Inspection primary)
        if (matInspRes) {
          for (const item of matInspRes) {
            const mrKey = item.mr_no || item.arrival_no || item.final_arrival_no;
            if (mrKey && !seenMrNos.has(mrKey)) {
              seenMrNos.add(mrKey);
              combinedInspections.push(item);
            }
          }
        }

        // Priority 2: final_arrival
        if (faRes) {
          for (const item of faRes) {
            const mrKey = item.mr_no || item.final_arrival_no || item.arrival_no;
            if (mrKey && !seenMrNos.has(mrKey)) {
              seenMrNos.add(mrKey);
              if (!item.mr_no) item.mr_no = mrKey;
              if (!item.final_arrival_no) item.final_arrival_no = mrKey;
              combinedInspections.push(item);
            }
          }
        }

        // Check local storage cache as well
        try {
          const cachedMat = localStorage.getItem("material_inspection_records");
          if (cachedMat) {
            const parsed = JSON.parse(cachedMat);
            if (Array.isArray(parsed)) {
              parsed.forEach((item: any) => {
                const mrKey = item.mr_no || item.arrival_no || item.final_arrival_no;
                if (mrKey && !seenMrNos.has(mrKey)) {
                  seenMrNos.add(mrKey);
                  combinedInspections.push(item);
                }
              });
            }
          }
        } catch (e) {}

        setInspections(combinedInspections);

        // 3. Fetch purchase orders list for selection from Final P.O and Sauda Check Point
        const { data: poList } = await supabase
          .from('purchase_master')
          .select('po_no, po_date, broker, supplier, total_contract_mt, status, pending, pending_received')
          .order('po_no', { ascending: false });

        const { data: poArchList } = await supabase
          .from('po_archive')
          .select('po_no, po_date, broker, supplier, total_contract_mt, status, pending')
          .order('po_no', { ascending: false })
          .then(res => res, () => ({ data: [] }));

        const { data: scpPoList } = await supabase
          .from('sauda_check_point')
          .select('po_no, po_date, s_date, broker, broker_name, supplier, supplier_name, quantity, total_contract_mt, status, pending')
          .then(res => res, () => ({ data: [] }));

        const rawCombined = [
          ...(poList || []),
          ...(poArchList || []),
          ...((scpPoList || []).map((s: any) => ({
            ...s,
            po_date: s.po_date || s.s_date,
            broker: s.broker_name || s.broker,
            supplier: s.supplier_name || s.supplier,
            total_contract_mt: s.total_contract_mt || s.quantity || 0,
          })))
        ];

        if (rawCombined.length > 0) {
          const poReceivedMap = new Map<string, number>();
          if (combinedInspections && combinedInspections.length > 0) {
            combinedInspections.forEach((item: any) => {
              if (item.po_no) {
                let wtMt = 0;
                if (item.final_receipt_wt && Number(item.final_receipt_wt) > 0) wtMt = Number(item.final_receipt_wt);
                else if (item.weight_qtl && Number(item.weight_qtl) > 0) wtMt = Number(item.weight_qtl) / 10;
                else if (item.electronic_net_weight && Number(item.electronic_net_weight) > 0) {
                  const val = Number(item.electronic_net_weight);
                  wtMt = val > 50 ? val / 10 : val;
                } else if (item.challan_material_weight && Number(item.challan_material_weight) > 0) {
                  const val = Number(item.challan_material_weight);
                  wtMt = val > 50 ? val / 10 : val;
                } else if (item.chalan_wt && Number(item.chalan_wt) > 0) {
                  const val = Number(item.chalan_wt);
                  wtMt = val > 50 ? val / 10 : val;
                }
                poReceivedMap.set(item.po_no, (poReceivedMap.get(item.po_no) || 0) + wtMt);
              }
            });
          }

          const existingPoNos = new Set<string>();
          const processedList: any[] = [];

          rawCombined.forEach(p => {
            if (!p.po_no || existingPoNos.has(p.po_no)) return;
            if (p.status === 'cancelled' || p.status === 'temp' || p.status === 'draft') return;
            if (p.po_no.endsWith('T') || p.po_no.includes('TEMP')) return;

            existingPoNos.add(p.po_no);

            const statusStr = String(p.status || '').trim().toLowerCase();
            const pendingStr = String(p.pending ?? '').trim().toLowerCase();
            const contractWt = Number(p.total_contract_mt) || 0;
            const receivedWt = poReceivedMap.get(p.po_no) || 0;

            const isExplicitCompleted = statusStr === 'completed' || statusStr === 'settled';
            const isPendingFalse = p.pending === false || pendingStr === 'false' || pendingStr === 'no' || p.pending === 0;
            const isWeightCompleted = contractWt > 0 && receivedWt >= (contractWt - 0.05);

            processedList.push({
              ...p,
              isCompleted: isExplicitCompleted || isPendingFalse || isWeightCompleted
            });
          });

          if (combinedInspections && combinedInspections.length > 0) {
            combinedInspections.forEach((item: any) => {
              if (item.po_no && !existingPoNos.has(item.po_no) && !item.po_no.endsWith('T') && !item.po_no.includes('TEMP')) {
                existingPoNos.add(item.po_no);
                processedList.push({
                  po_no: item.po_no,
                  supplier: item.supplier_name || item.supplier || 'Inspection PO',
                  status: item.status || 'completed',
                  isCompleted: true
                });
              }
            });
          }

          setPurchaseOrders(processedList);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      await initPage();
      const currentPo = masterData.po_no || selectedPoNo;
      if (currentPo) {
        await handlePoNoSelection(currentPo, Boolean(masterData.mr_no));
      }
      if (masterData.mr_no) {
        syncPaymentModuleData(masterData.mr_no, currentPo);
      }
      setSuccessMessage('Settlement database, P.O. dropdowns & arrival records refreshed successfully!');
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err: any) {
      console.error("Refresh failed:", err);
      setErrorMessage("Refresh failed: " + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePoNoSelection = async (poNo: string, preserveMrNo: boolean = false) => {
    setSelectedPoNo(poNo);
    if (!poNo) {
      setSelectedPoData(null);
      setPoStats(null);
      setCustomSettlementRecords([]);
      if (!preserveMrNo) {
        setMasterData(prev => ({
          ...prev,
          po_no: '',
          po_date: '',
          broker: '',
          supplier: '',
          chn_supplier: '',
          mr_no: '',
          lorry_number: '',
          arrival_no: '',
          arrival_date: ''
        }));
      }
      return;
    }
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (!supabase) return;
      
      const cleanPoNo = poNo.trim().replace(/^#/, '');

      // Fetch Sauda Checkpoint deduction recorded for this PO from sauda_check_point_deductions table
      const saudaDed = await fetchSaudaCheckpointDeduction(cleanPoNo);
      const isLastMr = masterData.mr_no ? isLastMrForPo(masterData.mr_no, cleanPoNo) : true;

      if (isLastMr && saudaDed) {
        setSaudaDeductionRecord(saudaDed);
        if (Number(saudaDed.deduction_amount) > 0) {
          setMasterData(prev => ({
            ...prev,
            val_less_amt: Number(saudaDed.deduction_amount)
          }));
        }
      } else {
        setSaudaDeductionRecord(null);
      }

      // 1. Fetch matching PO master and item details (checking purchase_master, sauda_check_point, po_archive, and indexedDB)
      const { poData, poDetails: fetchedDetails } = await fetchPoAndItemDetails(cleanPoNo);

      if (!poData) {
        setSelectedPoData(null);
        setErrorMessage(`Could not resolve details for P.O No. ${poNo}`);
        setLoading(false);
        return;
      }

      setSelectedPoData(poData);
      if (preserveMrNo && masterData.mr_no) {
        await syncPaymentModuleData(masterData.mr_no, poNo);
      }

      // 2. Fetch all mill inspections & final arrivals for this P.O to sum total received quantity in Metric Tons (MT)
      const [matInspForPoRes, finalArrivalsForPoRes] = await Promise.all([
        supabase.from('material_inspection').select('*').eq('po_no', poData.po_no || cleanPoNo).then(r => r.data || [], () => []),
        supabase.from('final_arrival').select('*').eq('po_no', poData.po_no || cleanPoNo).then(r => r.data || [], () => [])
      ]);

      const inspectionsForPo = matInspForPoRes || [];
      const finalArrivalsForPo = finalArrivalsForPoRes || [];

      // Merge newly fetched arrivals into state so FA dropdown is always complete
      const incomingList: any[] = [...(inspectionsForPo || []), ...(finalArrivalsForPo || [])];
      if (incomingList.length > 0) {
        setInspections(prev => {
          const existingMap = new Map(prev.map(i => [(i.mr_no || i.final_arrival_no || i.arrival_no), i]));
          incomingList.forEach(item => {
            const key = item.mr_no || item.final_arrival_no || item.arrival_no;
            if (key && !existingMap.has(key)) {
              existingMap.set(key, item);
            }
          });
          return Array.from(existingMap.values());
        });
      }

      let totalInspectedMt = 0;
      const processedMrNos = new Set<string>();

      // A) Process final_arrival records for this PO
      if (finalArrivalsForPo && finalArrivalsForPo.length > 0) {
        for (const item of finalArrivalsForPo) {
          const key = item.mr_no || item.final_arrival_no || item.arrival_no;
          if (key) processedMrNos.add(key);

          let wtMt = 0;
          if (item.weight_qtl && Number(item.weight_qtl) > 0) {
            wtMt = Number(item.weight_qtl) / 10;
          } else if (item.electronic_net_weight && Number(item.electronic_net_weight) > 0) {
            const val = Number(item.electronic_net_weight);
            wtMt = val > 50 ? val / 10 : val;
          } else if (item.challan_material_weight && Number(item.challan_material_weight) > 0) {
            const val = Number(item.challan_material_weight);
            wtMt = val > 50 ? val / 10 : val;
          }

          if (wtMt === 0 && item.grid_details) {
            try {
              const grids = typeof item.grid_details === 'string' ? JSON.parse(item.grid_details) : item.grid_details;
              if (Array.isArray(grids)) {
                const totalGrossQtl = grids.reduce((s: number, g: any) => s + (Number(g.weight || g.weight_qtl || g.arr_qty_wt) || 0), 0);
                if (totalGrossQtl > 0) {
                  wtMt = totalGrossQtl > 50 ? totalGrossQtl / 10 : totalGrossQtl;
                }
              }
            } catch (e) {}
          }

          totalInspectedMt += wtMt;
        }
      }

      // B) Process mill_inspection_master records for this PO
      if (inspectionsForPo && inspectionsForPo.length > 0) {
        for (const item of inspectionsForPo) {
          if (item.mr_no && processedMrNos.has(item.mr_no)) continue;
          if (item.mr_no) processedMrNos.add(item.mr_no);

          let wtMt = 0;
          if (item.weight_qtl && Number(item.weight_qtl) > 0) {
            wtMt = Number(item.weight_qtl) / 10;
          } else if (item.electronic_net_weight && Number(item.electronic_net_weight) > 0) {
            const val = Number(item.electronic_net_weight);
            wtMt = val > 50 ? val / 10 : val;
          } else if (item.challan_material_weight && Number(item.challan_material_weight) > 0) {
            const val = Number(item.challan_material_weight);
            wtMt = val > 50 ? val / 10 : val;
          }

          if (wtMt === 0 && item.mr_no) {
            const { data: details } = await supabase
              .from('mill_inspection_detail')
              .select('challan_gross_wt')
              .eq('mr_no', item.mr_no);
            if (details && details.length > 0) {
              const detailGrossQtl = details.reduce((sum, r) => sum + (Number(r.challan_gross_wt) || 0), 0);
              if (detailGrossQtl > 0) {
                wtMt = detailGrossQtl > 50 ? detailGrossQtl / 10 : detailGrossQtl;
              }
            }
          }

          totalInspectedMt += wtMt;
        }
      }

      // 3. Fetch already settled quantity against this P.O
      const { data: settlementsForPo } = await supabase
        .from('mr_settlement_master')
        .select('mr_no, electronic_scale_net')
        .eq('po_no', poData.po_no || cleanPoNo);
      
      let totalSettledMt = 0;
      if (settlementsForPo && settlementsForPo.length > 0) {
        const mrNos = settlementsForPo.map(s => s.mr_no);
        const { data: sDetails } = await supabase
          .from('mr_settlement_detail')
          .select('quantity')
          .in('mr_no', mrNos);
        if (sDetails && sDetails.length > 0) {
          totalSettledMt = sDetails.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
        }
        if (totalSettledMt === 0) {
          totalSettledMt = settlementsForPo.reduce((sum, s) => sum + (Number(s.electronic_scale_net) || 0), 0);
        }
      }

      // 4. Fetch data from 'm_r_settlement' table based on selected P.O number
      const { data: customSettlements, error: customErr } = await supabase
        .from('m_r_settlement')
        .select('*')
        .eq('po_no', poData.po_no || cleanPoNo)
        .order('created_at', { ascending: false });

      let totalCustomReceivedMt = 0;
      if (!customErr && customSettlements) {
        setCustomSettlementRecords(customSettlements);
        totalCustomReceivedMt = customSettlements.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
      } else {
        setCustomSettlementRecords([]);
      }

      const contractQty = Number(poData.total_contract_mt) || 0;
      const pendingQty = Math.max(0, contractQty - totalInspectedMt);
      const pendingReceivedQty = calculatePendingReceived(contractQty, totalCustomReceivedMt);

      setPoStats({
        contractQty,
        receivedQty: totalInspectedMt,
        settledQty: totalSettledMt,
        pendingQty: pendingQty,
        customReceivedQty: totalCustomReceivedMt,
        pendingReceivedQty: pendingReceivedQty,
        dbPendingReceived: Number(poData.pending_received) || 0
      });

      setLastSyncTime(new Date().toLocaleTimeString());

      // If preserveMrNo is false, clear MR and prepare base PO columns so user can select from the filtered FA dropdown
      if (!preserveMrNo) {
        const poDetails = (fetchedDetails && fetchedDetails.length > 0) ? fetchedDetails : [];

        const newCols = [1, 2, 3, 4].map(idx => {
          const pDet = poDetails && poDetails[idx - 1] ? poDetails[idx - 1] : null;
          return buildSettlementCol(
            idx,
            null,
            pDet,
            null,
            null,
            poData,
            gradeMasterList,
            agencyMasterList,
            markaMasterList,
            areaMasterList
          );
        });

        setMasterData(prev => ({
          ...initialMaster(),
          po_no: poData.po_no || cleanPoNo,
          po_date: poData.po_date || '',
          broker: poData.broker || '',
          supplier: poData.supplier || '',
          chn_supplier: poData.supplier || '',
          po_type: poData.po_type || 'MILL_PO',
          rate_qntl: Number(poData.rate_qntl || poData.rate_mt || poData.b_rate || 0),
          sett_date: prev.sett_date || new Date().toISOString().split('T')[0],
          mr_no: '',
          lorry_number: '',
          arrival_no: '',
          arrival_date: ''
        }));
        setDetailCols(newCols);
      }

      if (onLogEvent) {
        onLogEvent('PO_SYNC', `Resolved P.O #${poNo}: Contract=${contractQty} MT, Unloaded=${totalInspectedMt} MT, Settled=${totalSettledMt} MT, Pending=${pendingQty} MT`);
      }

    } catch (err: any) {
      setErrorMessage("Failed to resolve PO statistics: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initPage();
  }, []);

  // Fetch complete details from and populate form
  const handleProceedWithMrNo = async (targetMrNo: string, forceSync: boolean = false) => {
    if (!targetMrNo) return;
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (!supabase) return;

      // 1. Fetch source records first (final_arrival or mill_inspection_master & details) for enrichment
      const { data: faMaster } = await supabase
        .from('final_arrival')
        .select('*')
        .or(`mr_no.eq.${targetMrNo},final_arrival_no.eq.${targetMrNo},arrival_no.eq.${targetMrNo}`)
        .maybeSingle();

      let faGridArr: any[] = [];
      if (faMaster?.grid_details) {
        if (Array.isArray(faMaster.grid_details)) faGridArr = faMaster.grid_details;
        else if (typeof faMaster.grid_details === 'string') {
          try { faGridArr = JSON.parse(faMaster.grid_details); } catch (e) {}
        }
      }

      let inspMaster: any = null;
      try {
        const matInspRes = await supabase.from('material_inspection').select('*').or(`mr_no.eq.${targetMrNo},arrival_no.eq.${targetMrNo}`).maybeSingle();
        inspMaster = matInspRes?.data || null;
      } catch (e) {
        console.warn("Error fetching inspection master:", e);
      }

      let inspDetails: any[] = [];
      if (inspMaster) {
        if (inspMaster.grid_details) {
          if (Array.isArray(inspMaster.grid_details)) inspDetails = inspMaster.grid_details;
          else if (typeof inspMaster.grid_details === 'string') {
            try { inspDetails = JSON.parse(inspMaster.grid_details); } catch (e) {}
          }
        } else if (inspMaster.details && Array.isArray(inspMaster.details)) {
          inspDetails = inspMaster.details;
        }
      }

      if (inspDetails.length === 0) {
        try {
          const matDetRes = await supabase.from('material_inspection_details').select('*').eq('mr_no', targetMrNo).order('srl_no', { ascending: true });
          const fetchedDet = matDetRes?.data || [];
          if (fetchedDet.length > 0) inspDetails = fetchedDet;
        } catch (e) {
          console.warn("Error fetching inspection details:", e);
        }
      }

      const poNoForDet = faMaster?.po_no || inspMaster?.po_no || '';
      const cleanTargetPo = (poNoForDet || selectedPoNo || masterData.po_no || '').trim().replace(/^#/, '');
      const isLastMr = isLastMrForPo(targetMrNo, cleanTargetPo);

      let saudaDedRecord: any = null;
      if (isLastMr && cleanTargetPo) {
        saudaDedRecord = await fetchSaudaCheckpointDeduction(cleanTargetPo);
        setSaudaDeductionRecord(saudaDedRecord);
      } else {
        setSaudaDeductionRecord(null);
      }

      let poDetails: any[] = [];
      let poData: any = null;
      const effectivePoNo = poNoForDet || cleanTargetPo;
      if (effectivePoNo) {
        const { poData: fetchedPo, poDetails: fetchedDetails } = await fetchPoAndItemDetails(effectivePoNo);
        poData = fetchedPo;
        poDetails = fetchedDetails;
        if (poData) setSelectedPoData(poData);
      }

      let gList = gradeMasterList;
      if (!gList || gList.length === 0) {
        const { data: gData } = await supabase.from('grade_master').select('*');
        if (gData && gData.length > 0) {
          gList = gData;
          setGradeMasterList(gData);
        }
      }
      let agList = agencyMasterList;
      if (!agList || agList.length === 0) {
        const { data: agData } = await supabase.from('agency_master').select('*');
        if (agData && agData.length > 0) {
          agList = agData;
          setAgencyMasterList(agData);
        }
      }
      let mList = markaMasterList;
      if (!mList || mList.length === 0) {
        const { data: mData } = await supabase.from('marka_master').select('*');
        if (mData && mData.length > 0) {
          mList = mData;
          setMarkaMasterList(mData);
        }
      }
      let arList = areaMasterList;
      if (!arList || arList.length === 0) {
        const { data: aData } = await supabase.from('area_master').select('*');
        if (aData && aData.length > 0) {
          arList = aData;
          setAreaMasterList(aData);
        }
      }

      // Fetch Temporary Arrival record to retrieve A.P.M.C Fees (Rs.)
      let tempArrivalData: any = null;
      try {
        const poNo = poNoForDet;
        const lorryNo = faMaster?.lorry_number || inspMaster?.lorry_number || '';
        const arrNo = faMaster?.final_arrival_no || faMaster?.arrival_no || inspMaster?.arrival_no || targetMrNo;

        const [tempRes, dbTemp] = await Promise.all([
          supabase.from('temporary_material_received').select('*'),
          dbModule.fetchAll('temporary_material_received').catch(() => [])
        ]);
        const allTemp = [...(tempRes.data || []), ...(dbTemp || [])];

        if (allTemp.length > 0) {
          const match = allTemp.find((t: any) => {
            const tAmad = String(t.amad_no || t.temporary_arrival_no || t.arrival_no || '').trim().toUpperCase();
            const tLorry = String(t.lorry_number || t.vehicle_no || '').trim().toUpperCase();
            const tPo = String(t.po_no || '').trim().toUpperCase();
            const targetUpper = String(arrNo || targetMrNo).trim().toUpperCase();
            const lorryUpper = String(lorryNo).trim().toUpperCase();
            const poUpper = String(poNo).trim().toUpperCase();

            return (
              (targetUpper && (tAmad === targetUpper || tAmad.includes(targetUpper) || targetUpper.includes(tAmad))) ||
              (tLorry && lorryUpper && (tLorry === lorryUpper || tLorry.includes(lorryUpper) || lorryUpper.includes(tLorry))) ||
              (tPo && poUpper && tPo === poUpper && tLorry && lorryUpper && tLorry === lorryUpper) ||
              (tPo && poUpper && tPo === poUpper)
            );
          });
          if (match) tempArrivalData = match;
        }
      } catch (e) {
        console.warn("Could not fetch temporary arrival APMC fees:", e);
      }

      const resolvedArrivalApmcFees = Number(
        tempArrivalData?.apmc_fees ?? tempArrivalData?.arival_apmc_fees ?? faMaster?.apmc_fees ?? faMaster?.arival_apmc_fees ?? inspMaster?.apmc_fees ?? 0
      );

      const { totalPaid: syncedPaidAmount, payDetails: matchedPayDetails } = await syncPaymentModuleData(targetMrNo, poNoForDet);

      // Calculate total Premium Quantity (MT), Premium WT (Qtl), and Premium Amount (₹) from Inspection Details
      let totalPremMt = 0;
      let calculatedPremTotalAmt = 0;
      if (inspDetails && inspDetails.length > 0) {
        inspDetails.forEach((row: any) => {
          const rawPrem = row.premium !== undefined && row.premium !== null ? String(row.premium).trim() : "";
          const parsedNum = parseFloat(rawPrem);
          const isNumericPrem = !isNaN(parsedNum) && parsedNum > 0;
          const isExplicitPrem = row.is_premium === true || 
            rawPrem.toLowerCase() === "yes" || 
            (rawPrem !== "" && rawPrem.toLowerCase() !== "no");

          if (isNumericPrem || isExplicitPrem) {
            let rowPremMt = 0;
            if (isNumericPrem) {
              rowPremMt = parsedNum;
            } else if (row.premium_mt && Number(row.premium_mt) > 0) {
              rowPremMt = Number(row.premium_mt);
            } else if (row.premium_quantity && Number(row.premium_quantity) > 0) {
              rowPremMt = Number(row.premium_quantity);
            } else {
              if (row.challan_gross_wt && Number(row.challan_gross_wt) > 0) {
                rowPremMt = Number(row.challan_gross_wt);
              } else if (row.receipt_gross_wt && Number(row.receipt_gross_wt) > 0) {
                rowPremMt = Number(row.receipt_gross_wt);
              } else {
                const q = Number(row.quantity) || 0;
                const u = String(row.unit || "BALES").toUpperCase();
                if (u.includes("BALE")) rowPremMt = q * 0.18;
                else if (u.includes("KG")) rowPremMt = q * 0.001;
                else if (u.includes("QTL") || u.includes("QUINTAL")) rowPremMt = q * 0.10;
                else if (u.includes("DRUM")) rowPremMt = q * 0.20;
                else if (u.includes("BAG")) rowPremMt = q * 0.05;
                else rowPremMt = q;
              }
            }

            if (rowPremMt > 0) {
              totalPremMt += rowPremMt;
              const rowRate = Number(row.amount) || Number(row.rate) || Number(row.rate_qntl) || 0;
              const rowPremQtl = rowPremMt * 10;
              calculatedPremTotalAmt += (rowPremQtl * rowRate);
            }
          }
        });
      }
      const calculatedPremWtQtl = Number((totalPremMt * 10).toFixed(2));
      const calculatedPremRatePerQtl = calculatedPremWtQtl > 0 ? Number((calculatedPremTotalAmt / calculatedPremWtQtl).toFixed(2)) : 0;
      calculatedPremTotalAmt = Number(calculatedPremTotalAmt.toFixed(2));

      // Extract comprehensive deduction details and summarized deduction types from Inspection Master / Details
      let inspDeductionType = inspMaster?.deduction_type || '';
      let inspDeductionRate = Number(inspMaster?.deduction_rate) || 0;
      let inspDeductionQty = Number(inspMaster?.deduction_qty) || 0;
      let inspDeductionAmount = Number(inspMaster?.deduction_amount) || 0;

      // Check if deductions or deduction_types array is stored in JSONB
      const rawDeductionsArray = inspMaster?.deduction_types || inspMaster?.deductions;
      let parsedDeductions: SettlementDeductionItem[] = [];
      let deductionSummaryText = inspDeductionType;
      if (Array.isArray(rawDeductionsArray) && rawDeductionsArray.length > 0) {
        parsedDeductions = rawDeductionsArray
          .filter((d: any) => d && ((d.deduction_type && String(d.deduction_type).trim() !== '' && !String(d.deduction_type).includes('-- SELECT')) || (d.deduction && String(d.deduction).trim() !== '') || Number(d.deduction_amount || d.amount) > 0 || Number(d.deduction_rate || d.rate) > 0))
          .map((d: any) => {
            const name = String(d.deduction_type || d.deduction || d.name || '').trim();
            const rate = Number(d.deduction_rate || d.rate) || 0;
            const qty = Number(d.deduction_qty || d.qty) || 1;
            const amt = Number(d.deduction_amount || d.amount) || Number((rate * qty).toFixed(2));
            return { deduction_type: name, deduction_rate: rate, deduction_qty: qty, deduction_amount: amt };
          });

        const typeSummaries = parsedDeductions.map(d => {
          if (d.deduction_amount > 0) return `${d.deduction_type} (₹${d.deduction_amount})`;
          if (d.deduction_rate > 0 && d.deduction_qty > 0) return `${d.deduction_type} (${d.deduction_qty} @ ₹${d.deduction_rate})`;
          return d.deduction_type;
        });

        if (typeSummaries.length > 0) {
          deductionSummaryText = typeSummaries.join(', ');
        }
        if (!inspDeductionAmount) {
          inspDeductionAmount = parsedDeductions.reduce((s: number, d: any) => s + (Number(d.deduction_amount) || 0), 0);
        }
        if (parsedDeductions.length > 0) {
          inspDeductionRate = parsedDeductions[0].deduction_rate;
          inspDeductionQty = parsedDeductions[0].deduction_qty;
        }
      }

      if (parsedDeductions.length === 0 && inspDeductionType && !inspDeductionType.includes('-- SELECT') && (inspDeductionRate > 0 || inspDeductionAmount > 0)) {
        parsedDeductions = [{
          deduction_type: inspDeductionType,
          deduction_rate: inspDeductionRate || inspDeductionAmount,
          deduction_qty: inspDeductionQty || 1,
          deduction_amount: inspDeductionAmount || Number(((inspDeductionRate || 0) * (inspDeductionQty || 1)).toFixed(2))
        }];
      } else if (parsedDeductions.length === 0) {
        deductionSummaryText = '';
        inspDeductionRate = 0;
        inspDeductionQty = 0;
        inspDeductionAmount = 0;
      }

      // Check if settlement already exists for this MR. If yes, load for editing!
      if (!forceSync) {
        const { data: existingMaster } = await supabase
          .from('mr_settlement_master')
          .select('*')
          .eq('mr_no', targetMrNo)
          .maybeSingle();

        if (existingMaster) {
          setIsEdit(true);
          const mergedMaster = {
            ...existingMaster,
            summary_deduction_type: existingMaster.summary_deduction_type || deductionSummaryText || '',
            summary_deduction_rate: (Number(existingMaster.summary_deduction_rate) > 0) ? existingMaster.summary_deduction_rate : inspDeductionRate,
            summary_deduction_qty: (Number(existingMaster.summary_deduction_qty) > 0) ? existingMaster.summary_deduction_qty : (inspDeductionQty || (deductionSummaryText ? 1 : 0)),
            summary_deduction_amount: (Number(existingMaster.summary_deduction_amount) > 0) ? existingMaster.summary_deduction_amount : inspDeductionAmount,
            deductions: (existingMaster.deductions && Array.isArray(existingMaster.deductions) && existingMaster.deductions.length > 0)
              ? existingMaster.deductions
              : (parsedDeductions.length > 0 ? parsedDeductions : []),
            summary_premium_wt: (existingMaster.summary_premium_wt !== undefined && existingMaster.summary_premium_wt !== null && Number(existingMaster.summary_premium_wt) > 0) 
              ? existingMaster.summary_premium_wt 
              : (existingMaster.summary_instl_rate || calculatedPremWtQtl),
            summary_premium_amount: (existingMaster.summary_premium_amount !== undefined && existingMaster.summary_premium_amount !== null && Number(existingMaster.summary_premium_amount) > 0)
              ? existingMaster.summary_premium_amount
              : calculatedPremRatePerQtl,
            val_premium_amt: (existingMaster.val_premium_amt !== undefined && existingMaster.val_premium_amt !== null && Number(existingMaster.val_premium_amt) > 0)
              ? existingMaster.val_premium_amt
              : calculatedPremTotalAmt,
            val_less_amt: isLastMr
              ? (Number(existingMaster.val_less_amt) > 0 ? existingMaster.val_less_amt : Number(saudaDedRecord?.deduction_amount || 0))
              : Number(existingMaster.val_less_amt || 0),
            summary_delivery_claim: (existingMaster.summary_delivery_claim === 5550) ? 0 : (Number(existingMaster.summary_delivery_claim) || 0),
            arival_apmc_fees: (Number(existingMaster.arival_apmc_fees) > 0) ? existingMaster.arival_apmc_fees : resolvedArrivalApmcFees,
            final_on_ac_adv: (existingMaster.final_on_ac_adv && Number(existingMaster.final_on_ac_adv) > 0) ? Number(existingMaster.final_on_ac_adv) : syncedPaidAmount
          };
          setMasterData(mergedMaster);

          const { data: existingDetails } = await supabase
            .from('mr_settlement_detail')
            .select('*')
            .eq('mr_no', targetMrNo)
            .order('col_index', { ascending: true });

          const fallbackCols = buildAlignedSettlementColumns(
            poDetails,
            inspDetails,
            faGridArr,
            faMaster,
            inspMaster,
            poData,
            gList,
            agList,
            mList,
            arList,
            matchedPayDetails
          );

          if (existingDetails && existingDetails.length > 0) {
            // Fill columns up to 4, backfilling missing fields if necessary
            const newCols = [1, 2, 3, 4].map(idx => {
              const dbMatch = existingDetails.find(d => d.col_index === idx);
              const fallbackCol = fallbackCols[idx - 1] || emptyDetailColumn(idx);

              if (dbMatch) {
                const merged = { ...emptyDetailColumn(idx), ...dbMatch };
                if (!merged.grade && fallbackCol.grade) merged.grade = fallbackCol.grade;
                if (!merged.area && fallbackCol.area) merged.area = fallbackCol.area;
                if (!merged.agency && fallbackCol.agency) merged.agency = fallbackCol.agency;
                if (!merged.marka_crop && fallbackCol.marka_crop) merged.marka_crop = fallbackCol.marka_crop;
                if (!merged.quantity && fallbackCol.quantity) merged.quantity = fallbackCol.quantity;
                if (!merged.arr_qty_wt && fallbackCol.arr_qty_wt) merged.arr_qty_wt = fallbackCol.arr_qty_wt;
                if (merged.arr_qty_wt > 0 && (!merged.min_qty_wt || Number(merged.min_qty_wt) === Number(merged.arr_qty_wt))) {
                  merged.min_qty_wt = Number((merged.arr_qty_wt * 0.97).toFixed(3));
                }
                if (merged.arr_qty_wt > 0 && merged.quantity > 0 && (!merged.wt_quantity || merged.wt_quantity === 0)) {
                  const arrWtKg = merged.arr_qty_wt <= 50 ? merged.arr_qty_wt * 1000 : merged.arr_qty_wt;
                  merged.wt_quantity = Math.round(arrWtKg / merged.quantity);
                  merged.wt_phota = merged.wt_quantity;
                }
                if ((!merged.rate_value || Number(merged.rate_value) === 0) && fallbackCol.rate_value) {
                  merged.rate_value = fallbackCol.rate_value;
                }
                if (merged.gd_sett == null || merged.gd_sett === 0) merged.gd_sett = fallbackCol.gd_sett;
                if (merged.gd_claim == null || merged.gd_claim === 0) merged.gd_claim = fallbackCol.gd_claim;
                if (merged.moist_sett == null || merged.moist_sett === 0) merged.moist_sett = fallbackCol.moist_sett;
                if (merged.moist_claim == null || merged.moist_claim === 0) merged.moist_claim = fallbackCol.moist_claim;
                if (merged.dust_sett == null || merged.dust_sett === 0) merged.dust_sett = fallbackCol.dust_sett;
                if (merged.dust_claim == null || merged.dust_claim === 0) merged.dust_claim = fallbackCol.dust_claim;
                if (merged.ncv_sett == null || merged.ncv_sett === 0) merged.ncv_sett = fallbackCol.ncv_sett;
                if (merged.ncv_claim == null || merged.ncv_claim === 0) merged.ncv_claim = fallbackCol.ncv_claim;
                return merged;
              }
              return fallbackCol;
            });
            setDetailCols(newCols);
          } else {
            setDetailCols(fallbackCols);
          }
          if (existingMaster.po_no) {
          setSelectedPoNo(existingMaster.po_no);
          handlePoNoSelection(existingMaster.po_no, true);
        }
          setSuccessMessage(`Loaded existing Settlement Report for M.R. No. ${targetMrNo}`);
          return;
        }
      }

      // 2. Build new settlement from final_arrival / mill_inspection_master
      if (faMaster || inspMaster) {
        setIsEdit(false);
        const resolvedMrNo = faMaster?.mr_no || faMaster?.final_arrival_no || inspMaster?.mr_no || inspMaster?.arrival_no || targetMrNo;

        const prefilledMaster: SettlementMaster = {
          ...initialMaster(),
          mr_no: resolvedMrNo,
          po_type: 'MILL_PO',
          broker: faMaster?.broker || inspMaster?.broker_name || inspMaster?.broker || '',
          supplier: faMaster?.supplier || inspMaster?.supplier_name || inspMaster?.supplier || '',
          chn_supplier: faMaster?.challan_supplier || faMaster?.supplier || inspMaster?.supplier_name || inspMaster?.supplier || '',
          po_no: faMaster?.po_no || inspMaster?.po_no || '',
          po_date: faMaster?.po_date || inspMaster?.po_date || '',
          rate_qntl: Number(poData?.rate_qntl || poData?.rate_mt || poData?.b_rate || 0),
          lorry_number: faMaster?.lorry_number || faMaster?.final_arrival_no || inspMaster?.lorry_number || inspMaster?.arrival_no || '',
          arrival_no: faMaster?.final_arrival_no || faMaster?.arrival_no || inspMaster?.arrival_no || '',
          arrival_date: formatToInputDate(faMaster?.date || faMaster?.arrival_date || inspMaster?.arrival_date) || '',
          remarks: faMaster?.remarks || inspMaster?.remarks || '',
          challan_weight: Number(faMaster?.challan_material_weight || faMaster?.weight_qtl || inspMaster?.challan_material_weight || inspMaster?.weight_qtl) || 0,
          supplier_net_wt: Number(faMaster?.supplier_net_weight || faMaster?.weight_qtl || inspMaster?.supplier_net_weight || inspMaster?.weight_qtl) || 0,
          electronic_scale_net: Number(faMaster?.electronic_net_weight || faMaster?.weight_qtl || inspMaster?.electronic_net_weight || inspMaster?.weight_qtl) || 0,
          summary_deduction_type: deductionSummaryText || '',
          summary_deduction_rate: inspDeductionRate,
          summary_deduction_qty: inspDeductionQty > 0 ? inspDeductionQty : (deductionSummaryText ? 1 : 0),
          summary_deduction_amount: inspDeductionAmount,
          deductions: parsedDeductions,
          summary_premium_wt: calculatedPremWtQtl,
          summary_instl_rate: calculatedPremWtQtl,
          summary_premium_amount: calculatedPremRatePerQtl,
          val_premium_amt: calculatedPremTotalAmt,
          val_less_amt: (isLastMr && saudaDedRecord && Number(saudaDedRecord.deduction_amount) > 0) ? Number(saudaDedRecord.deduction_amount) : 0,
          arival_apmc_fees: resolvedArrivalApmcFees,
          final_apmc_fees: 0,
          final_on_ac_adv: syncedPaidAmount
        };

        const populatedCols = buildAlignedSettlementColumns(
          poDetails,
          inspDetails,
          faGridArr,
          faMaster,
          inspMaster,
          poData,
          gList,
          agList,
          mList,
          arList,
          matchedPayDetails
        );

        const activeColsCount = populatedCols.filter(c => 
          (Number(c.quantity) || 0) > 0 || (Number(c.arr_qty_wt) || 0) > 0 || (Number(c.wt_quantity) || 0) > 0
        ).length || 1;

        populatedCols.forEach(c => {
          const isActive = (Number(c.quantity) || 0) > 0 || (Number(c.arr_qty_wt) || 0) > 0 || (Number(c.wt_quantity) || 0) > 0;
          if (!isActive) {
            c.gd_claim = 0;
            c.gd_sett = 0;
            c.moist_claim = 0;
            c.moist_sett = 0;
            c.dust_claim = 0;
            c.dust_sett = 0;
            c.ncv_claim = 0;
            c.ncv_sett = 0;
            c.po_grade_claim = 0;
            c.po_grade_sett = 0;
            c.claim_settlement = 0;
          } else if (inspMaster) {
            if (c.moist_claim === 0 && inspMaster.claim_moisture != null) c.moist_claim = Number((Number(inspMaster.claim_moisture) / activeColsCount).toFixed(2));
            if (c.dust_claim === 0 && inspMaster.claim_dust != null) c.dust_claim = Number((Number(inspMaster.claim_dust) / activeColsCount).toFixed(2));
            if (c.ncv_claim === 0 && inspMaster.claim_ncv != null) c.ncv_claim = Number((Number(inspMaster.claim_ncv) / activeColsCount).toFixed(2));
            if (c.gd_claim === 0 && inspMaster.claim_grade_down != null) c.gd_claim = Number((Number(inspMaster.claim_grade_down) / activeColsCount).toFixed(2));
          }
          const gdF = (Number(c.gd_claim || 0) - Number(c.gd_sett || 0));
          const mF = (Number(c.moist_claim || 0) - Number(c.moist_sett || 0));
          const dF = (Number(c.dust_claim || 0) - Number(c.dust_sett || 0));
          const nF = (Number(c.ncv_claim || 0) - Number(c.ncv_sett || 0));
          c.claim_settlement = Number((gdF + mF + dF + nF).toFixed(2));
        });

        setMasterData(prefilledMaster);
        setDetailCols(populatedCols);
        if (prefilledMaster.po_no) {
          setSelectedPoNo(prefilledMaster.po_no);
          handlePoNoSelection(prefilledMaster.po_no, true);
        }
        setSuccessMessage(`Prepopulated settlement data successfully from Final M.R. [${resolvedMrNo}]`);
        return;
      }

      // 3. Fallback: load fields from mill_inspection_master
      if (!inspMaster) {
        alert(`No Quality Inspection or Final Arrival details found for MR No "${targetMrNo}". Please verify quality entry.`);
        setLoading(false);
        return;
      }

      setIsEdit(false);
      const prefilledMaster: SettlementMaster = {
        ...initialMaster(),
        mr_no: inspMaster.mr_no || '',
        po_type: 'MILL_PO',
        broker: inspMaster.broker_name || '',
        supplier: inspMaster.supplier_name || '',
        chn_supplier: inspMaster.supplier_name || '',
        po_no: inspMaster.po_no || '',
        po_date: inspMaster.po_date || '',
        rate_qntl: Number(poData?.rate_qntl || poData?.rate_mt || poData?.b_rate || 0),
        lorry_number: inspMaster.lorry_number || inspMaster.arrival_no || '',
        detention_days: inspMaster.detention_days || 0,
        arrival_no: inspMaster.arrival_no || '',
        arrival_date: formatToInputDate(inspMaster.arrival_date) || '',
        remarks: inspMaster.remarks || '',
        summary_deduction_type: deductionSummaryText || '',
        summary_deduction_rate: inspDeductionRate,
        summary_deduction_qty: inspDeductionQty > 0 ? inspDeductionQty : (deductionSummaryText ? 1 : 0),
        summary_deduction_amount: inspDeductionAmount,
        deductions: parsedDeductions,
        summary_premium_wt: calculatedPremWtQtl,
        summary_instl_rate: calculatedPremWtQtl,
        summary_premium_amount: calculatedPremRatePerQtl,
        val_premium_amt: calculatedPremTotalAmt,
        val_less_amt: (isLastMr && saudaDedRecord && Number(saudaDedRecord.deduction_amount) > 0) ? Number(saudaDedRecord.deduction_amount) : 0,
        arival_apmc_fees: resolvedArrivalApmcFees,
        final_apmc_fees: 0,
        final_on_ac_adv: syncedPaidAmount
      };

      const populatedCols = buildAlignedSettlementColumns(
        poDetails,
        inspDetails,
        [],
        null,
        inspMaster,
        poData,
        gList,
        agList,
        mList,
        arList,
        matchedPayDetails
      );

      const activeColsCountFallback = populatedCols.filter(c => 
        (Number(c.quantity) || 0) > 0 || (Number(c.arr_qty_wt) || 0) > 0 || (Number(c.wt_quantity) || 0) > 0
      ).length || 1;

      populatedCols.forEach(c => {
        const isActive = (Number(c.quantity) || 0) > 0 || (Number(c.arr_qty_wt) || 0) > 0 || (Number(c.wt_quantity) || 0) > 0;
        if (!isActive) {
          c.gd_claim = 0;
          c.gd_sett = 0;
          c.moist_claim = 0;
          c.moist_sett = 0;
          c.dust_claim = 0;
          c.dust_sett = 0;
          c.ncv_claim = 0;
          c.ncv_sett = 0;
          c.po_grade_claim = 0;
          c.po_grade_sett = 0;
          c.claim_settlement = 0;
        } else if (inspMaster) {
          if (c.moist_claim === 0 && inspMaster.claim_moisture != null) c.moist_claim = Number((Number(inspMaster.claim_moisture) / activeColsCountFallback).toFixed(2));
          if (c.dust_claim === 0 && inspMaster.claim_dust != null) c.dust_claim = Number((Number(inspMaster.claim_dust) / activeColsCountFallback).toFixed(2));
          if (c.ncv_claim === 0 && inspMaster.claim_ncv != null) c.ncv_claim = Number((Number(inspMaster.claim_ncv) / activeColsCountFallback).toFixed(2));
          if (c.gd_claim === 0 && inspMaster.claim_grade_down != null) c.gd_claim = Number((Number(inspMaster.claim_grade_down) / activeColsCountFallback).toFixed(2));
        }
        const gdF = (Number(c.gd_claim || 0) - Number(c.gd_sett || 0));
        const mF = (Number(c.moist_claim || 0) - Number(c.moist_sett || 0));
        const dF = (Number(c.dust_claim || 0) - Number(c.dust_sett || 0));
        const nF = (Number(c.ncv_claim || 0) - Number(c.ncv_sett || 0));
        c.claim_settlement = Number((gdF + mF + dF + nF).toFixed(2));
      });

      setMasterData(prefilledMaster);
      setDetailCols(populatedCols);
      if (inspMaster.po_no) setSelectedPoNo(inspMaster.po_no);
      setSuccessMessage(`Prepopulated settlement data successfully using MR No. ${targetMrNo}`);

    } catch (err: any) {
      setErrorMessage("Proceed fail: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Ensure selectedPoData is in sync whenever PO number changes
  useEffect(() => {
    const targetPo = masterData.po_no || selectedPoNo;
    if (!targetPo || !supabase) {
      return;
    }
    if (selectedPoData && selectedPoData.po_no === targetPo) return;

    supabase
      .from('purchase_master')
      .select('*')
      .eq('po_no', targetPo)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSelectedPoData(data);
      });
  }, [masterData.po_no, selectedPoNo]);

  // Live Auto Calculations based on inputs
  useEffect(() => {
    if (viewMode !== 'entry') return;

    // Calculators
    let calculatedMaterialValue = 0;
    let totalQtyWeightClaims = 0;

    detailCols.forEach(col => {
      // Amount for column = WT(KG) * Rate(KG) = WT(MT)*1000 * (Recon Rate / 100)
      const calculatedValueCol = getColAmount(col);
      calculatedMaterialValue += calculatedValueCol;

      // Total Claim calculation for column: Grade Down (%) + Moisture (%) + Dust (%) + NCV (%)
      const gdVal = Number(col.gd_sett) > 0 ? Number(col.gd_sett) : Number(col.gd_claim || 0);
      const mVal = Number(col.moist_sett) > 0 ? Number(col.moist_sett) : Number(col.moist_claim || 0);
      const dVal = Number(col.dust_sett) > 0 ? Number(col.dust_sett) : Number(col.dust_claim || 0);
      const nVal = Number(col.ncv_sett) > 0 ? Number(col.ncv_sett) : Number(col.ncv_claim || 0);
      col.claim_settlement = Number((gdVal + mVal + dVal + nVal).toFixed(2));

      // Grade Claim calculation logic: Claim - Sett
      const claimTotal = (Number(col.gd_claim) + Number(col.moist_claim) + Number(col.dust_claim) + Number(col.ncv_claim));
      const settTotal = (Number(col.gd_sett) + Number(col.moist_sett) + Number(col.dust_sett) + Number(col.ncv_sett));
      
      const colClaimValue = Math.max(0, claimTotal - settTotal) * Number(col.quantity);
      totalQtyWeightClaims += colClaimValue;
    });

    // Calculate Rate / m.T (Weighted Average Rate per Metric Ton across all 4 columns)
    const calculatedRatePerMt = calculateWeightedRatePerMT(detailCols);
    const nextRatePerMt = calculatedRatePerMt > 0 ? calculatedRatePerMt : (masterData.summary_rate_qtel || 0);

    // Calculate Moisture Claim % as the Average of "Final (%)" from Grade Spec Table (Moisture % row)
    const activeMoistCols = detailCols.filter(col => {
      const isColActive = (Number(col.quantity) || 0) > 0 || (Number(col.arr_qty_wt) || 0) > 0 || (Number(col.wt_quantity) || 0) > 0 || (col.grade && col.grade.trim() !== '');
      return isColActive;
    });

    let avgFinalMoisturePct = 0;
    if (activeMoistCols.length > 0) {
      const sumMoist = activeMoistCols.reduce((sum, col) => {
        const mVal = Number(col.moist_sett) > 0 ? Number(col.moist_sett) : Number(col.moist_claim || 0);
        return sum + mVal;
      }, 0);
      avgFinalMoisturePct = Number((sumMoist / activeMoistCols.length).toFixed(2));
    } else {
      const colsWithMoist = detailCols.filter(col => {
        const mVal = Number(col.moist_sett) > 0 ? Number(col.moist_sett) : Number(col.moist_claim || 0);
        return mVal > 0;
      });
      if (colsWithMoist.length > 0) {
        const sumMoist = colsWithMoist.reduce((sum, col) => {
          const mVal = Number(col.moist_sett) > 0 ? Number(col.moist_sett) : Number(col.moist_claim || 0);
          return sum + mVal;
        }, 0);
        avgFinalMoisturePct = Number((sumMoist / colsWithMoist.length).toFixed(2));
      }
    }

    const calculatedRateWtClaim = avgFinalMoisturePct;

    // Delivery Claim in Grade-wise summary panel must default to 0 (user-editable, not auto-penalized)
    const deliveryClaimAmt = (Number(masterData.summary_delivery_claim) === 5550)
      ? 0
      : (Number(masterData.summary_delivery_claim) || 0);

    // Material valuation summaries
    const finalExShort = Number(masterData.val_ex_short) || 0;
    const finalLessAmount = 0;

    // Calculate Premium Amount: Premium Rate (₹/Qtl) * Premium WT (in Qtl)
    const premiumRatePerQtl = Number(masterData.summary_premium_amount) || 0;
    const premiumWeightQtl = (masterData.summary_premium_wt !== undefined && masterData.summary_premium_wt !== null && Number(masterData.summary_premium_wt) > 0)
      ? Number(masterData.summary_premium_wt)
      : Number(masterData.summary_less_amount || 0);
    const calculatedPremiumAmount = Number((premiumRatePerQtl * premiumWeightQtl).toFixed(2));
    const calculatedDeductionAmount = Number(masterData.summary_deduction_amount) || 0;

    // Valuation calculation = Material Value + Add Amt + Premium Amt - Deduction Amount - Ded Claim Total - Qty Claim - Val Less Amt - Ex/Short - Delivery Claim(-)
    const calculatedValuationVal = Number((
      calculatedMaterialValue 
      + Number(masterData.val_add_amt || 0) 
      + calculatedPremiumAmount 
      - calculatedDeductionAmount 
      - finalLessAmount 
      - Number(masterData.val_qty_claim || 0) 
      - Number(masterData.val_less_amt || 0) 
      - finalExShort
      - deliveryClaimAmt
    ).toFixed(2));

    // APMC Fees = Arrival APMC Fees - Actual APMC Fees
    // Negative APMC Fees (e.g. 0 - 1132.50 = -1132.50) is deducted from RESOLVED PAYABLE ACCOUNT
    const calculatedApmcFees = Number((calculatedMaterialValue * 0.01).toFixed(2));
    const arrivalApmcFees = Number(masterData.arival_apmc_fees) || 0;
    const actualApmcFees = Number(masterData.actual_apmc_fees) || (calculatedApmcFees > 0 ? calculatedApmcFees : 0);
    const finalApmcFees = Number((arrivalApmcFees - actualApmcFees).toFixed(2));
    const cstAmt = (calculatedValuationVal * (Number(masterData.final_cst_pct_amt) || 0)) / 100;

    // RESOLVED PAYABLE ACCOUNT = Valuation - Less Adv - On/Ac Adv + finalApmcFees (which deducts when negative e.g. -1132.50) + CST
    const calculatedPayable = Number((
      calculatedValuationVal 
      - Number(masterData.final_less_adv || 0) 
      - Number(masterData.final_on_ac_adv || 0) 
      + finalApmcFees 
      + cstAmt
    ).toFixed(2));

    // Only update if changes to prevent cycling
    setMasterData(prev => {
      const nextActualApmcFees = prev.actual_apmc_fees || calculatedApmcFees;
      const targetRateAffCdCl = prev.summary_rate_aff_cd_cl > 0 ? prev.summary_rate_aff_cd_cl : nextRatePerMt;

      const targetDeliveryClaim = (prev.summary_delivery_claim === 5550 || prev.summary_delivery_claim === undefined) ? 0 : (Number(prev.summary_delivery_claim) || 0);

      if (
        prev.summary_material_value !== calculatedMaterialValue ||
        prev.val_material_value !== calculatedMaterialValue ||
        prev.payable_amt !== calculatedPayable ||
        prev.val_less_amount !== finalLessAmount ||
        prev.final_apmc_fees !== finalApmcFees ||
        prev.summary_rate_wt_claim !== calculatedRateWtClaim ||
        prev.summary_rate_aff_cd_cl !== targetRateAffCdCl ||
        prev.val_premium_amt !== calculatedPremiumAmount ||
        prev.summary_delivery_claim !== targetDeliveryClaim ||
        (!prev.actual_apmc_fees && calculatedApmcFees > 0 && prev.actual_apmc_fees !== nextActualApmcFees) ||
        (calculatedRatePerMt > 0 && (prev.summary_rate_qtel !== nextRatePerMt || prev.rate_qntl !== nextRatePerMt))
      ) {
        return {
          ...prev,
          summary_material_value: calculatedMaterialValue,
          val_material_value: calculatedMaterialValue,
          value_amt: calculatedMaterialValue,
          val_less_amount: finalLessAmount,
          payable_amt: calculatedPayable,
          net_amt: calculatedPayable,
          actual_apmc_fees: nextActualApmcFees,
          final_apmc_fees: finalApmcFees,
          summary_rate_qtel: nextRatePerMt,
          rate_qntl: nextRatePerMt,
          summary_rate_aff_cd_cl: targetRateAffCdCl,
          summary_rate_wt_claim: calculatedRateWtClaim,
          val_premium_amt: calculatedPremiumAmount,
          summary_delivery_claim: targetDeliveryClaim
        };
      }
      return prev;
    });

  }, [detailCols, masterData.electronic_scale_net, masterData.summary_rate_aff_cd_cl, masterData.summary_rate_qtel, masterData.summary_premium_amount, masterData.summary_premium_wt, masterData.summary_deduction_amount, masterData.summary_delivery_claim, masterData.val_add_amt, masterData.val_less_amt, masterData.val_qty_claim, masterData.val_ex_short, masterData.summary_less_amount, masterData.final_less_adv, masterData.final_on_ac_adv, masterData.final_cst_pct_amt, masterData.actual_apmc_fees, masterData.arival_apmc_fees, masterData.arrival_date, masterData.sett_date, selectedPoData]);

  // Handle master updates
  const handleMasterChange = (field: keyof SettlementMaster, value: any) => {
    setMasterData(prev => ({ ...prev, [field]: value }));
  };

  // Handle multi-row deductions updates
  const handleDeductionRowChange = (index: number, field: keyof SettlementDeductionItem, value: any) => {
    setMasterData(prev => {
      const currentDeductions: SettlementDeductionItem[] = (prev.deductions && prev.deductions.length > 0)
        ? [...prev.deductions]
        : [{
            deduction_type: prev.summary_deduction_type || '',
            deduction_rate: prev.summary_deduction_rate || 0,
            deduction_qty: prev.summary_deduction_qty || 1,
            deduction_amount: prev.summary_deduction_amount || 0
          }];
      
      const updatedRow = { ...currentDeductions[index], [field]: value };
      if (field === 'deduction_rate' || field === 'deduction_qty') {
        const rate = field === 'deduction_rate' ? (Number(value) || 0) : (Number(updatedRow.deduction_rate) || 0);
        const qty = field === 'deduction_qty' ? (Number(value) || 0) : (Number(updatedRow.deduction_qty) || 0);
        updatedRow.deduction_amount = Number((rate * qty).toFixed(2));
      }
      currentDeductions[index] = updatedRow;

      const totalDeductionAmt = Number(currentDeductions.reduce((s, r) => s + (Number(r.deduction_amount) || 0), 0).toFixed(2));
      const summaryTypes = currentDeductions
        .filter(r => r.deduction_type && r.deduction_type.trim() !== '')
        .map(r => {
          if (r.deduction_amount > 0) return `${r.deduction_type} (₹${r.deduction_amount})`;
          if (r.deduction_rate > 0 && r.deduction_qty > 0) return `${r.deduction_type} (${r.deduction_qty} @ ₹${r.deduction_rate})`;
          return r.deduction_type;
        })
        .join(', ');

      return {
        ...prev,
        deductions: currentDeductions,
        summary_deduction_amount: totalDeductionAmt,
        summary_deduction_type: summaryTypes || currentDeductions[0]?.deduction_type || '',
        summary_deduction_rate: currentDeductions[0]?.deduction_rate || 0,
        summary_deduction_qty: currentDeductions[0]?.deduction_qty || 1
      };
    });
  };

  const handleAddDeductionRow = () => {
    setMasterData(prev => {
      const currentDeductions: SettlementDeductionItem[] = (prev.deductions && prev.deductions.length > 0)
        ? [...prev.deductions]
        : [{
            deduction_type: prev.summary_deduction_type || '',
            deduction_rate: prev.summary_deduction_rate || 0,
            deduction_qty: prev.summary_deduction_qty || 1,
            deduction_amount: prev.summary_deduction_amount || 0
          }];
      currentDeductions.push({
        deduction_type: '',
        deduction_rate: 0,
        deduction_qty: 1,
        deduction_amount: 0
      });
      return {
        ...prev,
        deductions: currentDeductions
      };
    });
  };

  const handleRemoveDeductionRow = (index: number) => {
    setMasterData(prev => {
      const currentDeductions: SettlementDeductionItem[] = (prev.deductions && prev.deductions.length > 0)
        ? [...prev.deductions]
        : [];
      if (currentDeductions.length <= 1) {
        return {
          ...prev,
          deductions: [{ deduction_type: '', deduction_rate: 0, deduction_qty: 1, deduction_amount: 0 }],
          summary_deduction_type: '',
          summary_deduction_rate: 0,
          summary_deduction_qty: 0,
          summary_deduction_amount: 0
        };
      }
      currentDeductions.splice(index, 1);
      const totalDeductionAmt = Number(currentDeductions.reduce((s, r) => s + (Number(r.deduction_amount) || 0), 0).toFixed(2));
      const summaryTypes = currentDeductions
        .filter(r => r.deduction_type && r.deduction_type.trim() !== '')
        .map(r => r.deduction_type)
        .join(', ');

      return {
        ...prev,
        deductions: currentDeductions,
        summary_deduction_amount: totalDeductionAmt,
        summary_deduction_type: summaryTypes || currentDeductions[0]?.deduction_type || '',
        summary_deduction_rate: currentDeductions[0]?.deduction_rate || 0,
        summary_deduction_qty: currentDeductions[0]?.deduction_qty || 1
      };
    });
  };

  // Handle columns grid updates
  const handleColChange = (idx: number, field: keyof SettlementDetailColumn, value: any) => {
    setDetailCols(prev => {
      const isColActive = (col: SettlementDetailColumn) => {
        const qty = Number(col.quantity) || 0;
        const arrWt = Number(col.arr_qty_wt) || 0;
        const wtQty = Number(col.wt_quantity) || 0;
        return (qty > 0 || arrWt > 0 || wtQty > 0);
      };

      const claimFields = ['gd_claim', 'moist_claim', 'dust_claim', 'ncv_claim', 'po_grade_claim'];
      if (claimFields.includes(field as string)) {
        return prev.map(c => {
          if (!isColActive(c)) {
            return { ...c, [field]: 0 };
          }
          if (c.col_index === idx) {
            return { ...c, [field]: value };
          }
          return c;
        });
      }

      return prev.map(c => {
        if (c.col_index !== idx) return c;
        const updated = { ...c, [field]: value };

        if (field === 'quantity' || field === 'arr_qty_wt' || field === 'wt_phota' || field === 'min_qty_wt') {
          const qty = Number(updated.quantity) || 0;
          const arrWt = Number(updated.arr_qty_wt) || 0;
          
          if (field === 'quantity' && qty === 0) {
            updated.wt_quantity = 0;
            updated.arr_qty_wt = 0;
            updated.min_qty_wt = 0;
            updated.wt_phota = 0;
            updated.gd_claim = 0;
            updated.gd_sett = 0;
            updated.moist_claim = 0;
            updated.moist_sett = 0;
            updated.dust_claim = 0;
            updated.dust_sett = 0;
            updated.ncv_claim = 0;
            updated.ncv_sett = 0;
            updated.po_grade_claim = 0;
            updated.po_grade_sett = 0;
            updated.claim_settlement = 0;
          } else {
            // Auto update Min.Qty/Wt to 3% acceptable (97% of Arr. Qty/Wt) when Arr. Qty/Wt changes
            if (field === 'arr_qty_wt') {
              updated.min_qty_wt = arrWt > 0 ? Number((arrWt * 0.97).toFixed(3)) : 0;
            }
            // Auto update Wt/Quantity calculation: Round "Arr. Qty/Wt" convert in kg / Quantity (B)
            const arrWtKg = arrWt > 0 ? (arrWt <= 50 ? arrWt * 1000 : arrWt) : 0;
            if (qty > 0 && arrWtKg > 0) {
              updated.wt_quantity = Math.round(arrWtKg / qty);
              updated.wt_phota = updated.wt_quantity;
            } else if (qty > 0 && Number(updated.wt_phota) > 0) {
              updated.wt_quantity = Number(updated.wt_phota);
            }
          }
        }
        return updated;
      });
    });
  };

  // Perform Db save/register
  const handleSaveSettlement = async (bypassAudit: boolean = false) => {
    if (isEdit && !enforceEditOrDeletePermission("Edit")) {
      return;
    }

    // Mandatory Validation for Bill No. and Bill Date
    const trimmedBillNo = (masterData.payable_bill_no || '').trim();
    const trimmedBillDate = (masterData.payable_bill_date || '').trim();

    if (!trimmedBillNo || !trimmedBillDate) {
      const missingFields = [];
      if (!trimmedBillNo) missingFields.push("Bill No.");
      if (!trimmedBillDate) missingFields.push("Bill Date");
      setErrorMessage(`Mandatory Field Error: Please enter ${missingFields.join(' and ')} before settling the account.`);
      return;
    }

    let targetMrNo = masterData.mr_no ? masterData.mr_no.trim() : '';
    if (!targetMrNo) {
      if (masterData.lorry_number) {
        const cleanLorry = masterData.lorry_number.trim().toUpperCase().replace(/\s+/g, '');
        targetMrNo = `MR-${cleanLorry}`;
      } else if (masterData.po_no) {
        targetMrNo = `MR-PO-${masterData.po_no.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;
      } else {
        targetMrNo = `MR-${Date.now().toString().slice(-6)}`;
      }
      setMasterData(prev => ({ ...prev, mr_no: targetMrNo }));
    }

    // Validate that settlement_weight (we check both totalSettleQty and electronic_scale_net / challan_weight)
    // does not exceed pendingReceivedQty
    const totalSettleQty = detailCols.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
    const activeWeight = Math.max(
      totalSettleQty, 
      Number(masterData.electronic_scale_net) || 0, 
      Number(masterData.challan_weight) || 0
    );

    let allowedWeight = poStats ? poStats.pendingReceivedQty : 0;
    if (isEdit && selectedPoNo) {
      // Find if there was an existing record for this mr_no in customSettlementRecords
      const existingRecord = customSettlementRecords.find(r => r.mr_no === targetMrNo || r.id === masterData.settlement_id);
      if (existingRecord) {
        allowedWeight += (Number(existingRecord.quantity) || 0);
      }
    }

    if (!bypassAudit && poStats && activeWeight > allowedWeight && allowedWeight > 0) {
      setAuditOverwriteInfo({
        activeWeight,
        allowedWeight,
        selectedPoNo: selectedPoNo || masterData.po_no || 'N/A',
        targetMrNo
      });
      setShowAuditOverwriteModal(true);
      setErrorMessage(`Validation Failure (Audit Block): The settlement weight of ${activeWeight.toFixed(3)} MT exceeds the currently calculated 'pending_received' limit of ${allowedWeight.toFixed(3)} MT for selected PO ${selectedPoNo}. Click 'Authorize & Overwrite' to confirm and save.`);
      return;
    }

    // Close overwrite modal if open
    setShowAuditOverwriteModal(false);

    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      if (!supabase) throw new Error("Supabase client is not available.");

      // 1. Insert or Update Master
      const { error: masterErr } = await supabase
        .from('mr_settlement_master')
        .upsert({
          mr_no: targetMrNo,
          sett_date: masterData.sett_date,
          po_type: masterData.po_type,
          broker: masterData.broker,
          supplier: masterData.supplier,
          chn_supplier: masterData.chn_supplier,
          po_no: masterData.po_no,
          po_date: masterData.po_date || null,
          lorry_number: masterData.lorry_number,
          auto_ho_settlement: masterData.auto_ho_settlement,
          detention_days: Number(masterData.detention_days) || 0,
          arrival_no: masterData.arrival_no,
          arrival_date: masterData.arrival_date || null,
          arival_apmc_fees: Number(masterData.arival_apmc_fees) || 0,
          actual_apmc_fees: Number(masterData.actual_apmc_fees) || 0,
          remarks: masterData.remarks,
          summary_rate_qtel: Number(masterData.summary_rate_qtel) || 0,
          summary_rate_aff_cd_cl: Number(masterData.summary_rate_aff_cd_cl) || 0,
          summary_delivery_claim: Number(masterData.summary_delivery_claim) || 0,
          summary_rate_wt_claim: Number(masterData.summary_rate_wt_claim) || 0,
          summary_instl_rate: Number(masterData.summary_premium_wt ?? masterData.summary_instl_rate ?? 0),
          summary_premium_wt: Number(masterData.summary_premium_wt ?? 0),
          summary_material_value: Number(masterData.summary_material_value) || 0,
          summary_misc_add: Number(masterData.summary_misc_add) || 0,
          summary_misc_less: Number(masterData.summary_misc_less) || 0,
          summary_premium_amount: Number(masterData.summary_premium_amount) || 0,
          summary_less_amount: Number(masterData.summary_less_amount) || 0,
          summary_instl_amount: Number(masterData.summary_instl_amount) || 0,
          summary_deduction_type: masterData.summary_deduction_type || '',
          summary_deduction_rate: Number(masterData.summary_deduction_rate) || 0,
          summary_deduction_qty: Number(masterData.summary_deduction_qty) || 0,
          summary_deduction_amount: Number(masterData.summary_deduction_amount) || 0,
          deductions: masterData.deductions || [],
          val_material_value: Number(masterData.val_material_value) || 0,
          val_add_amt: Number(masterData.val_add_amt) || 0,
          val_less_amt: Number(masterData.val_less_amt) || 0,
          val_premium_amt: Number(masterData.val_premium_amt) || 0,
          val_less_amount: Number(masterData.val_less_amount) || 0,
          val_qty_claim: Number(masterData.val_qty_claim) || 0,
          val_ex_short: Number(masterData.val_ex_short) || 0,
          final_less_adv: Number(masterData.final_less_adv) || 0,
          final_on_ac_adv: Number(masterData.final_on_ac_adv) || 0,
          final_apmc_fees: Number(masterData.final_apmc_fees) || 0,
          final_cst_pct_amt: Number(masterData.final_cst_pct_amt) || 0,
          payable_amt: Number(masterData.payable_amt) || 0,
          payable_bill_no: masterData.payable_bill_no,
          payable_bill_date: masterData.payable_bill_date || null,
          wt_ded_wt_1: Number(masterData.wt_ded_wt_1) || 0,
          wt_ded_wt_2: Number(masterData.wt_ded_wt_2) || 0,
          wt_ded_wt_3: Number(masterData.wt_ded_wt_3) || 0,
          rate_qntl: Number(masterData.rate_qntl) || 0,
          value_amt: Number(masterData.value_amt) || 0,
          adjustment_amt: Number(masterData.adjustment_amt) || 0,
          net_amt: Number(masterData.net_amt) || 0,
          challan_weight: Number(masterData.challan_weight) || 0,
          supplier_net_wt: Number(masterData.supplier_net_wt) || 0,
          electronic_scale_net: Number(masterData.electronic_scale_net) || 0,
          payment_status: masterData.payment_status || 'Pending'
        }, { onConflict: 'mr_no' });

      if (masterErr) throw masterErr;

      // 2. Clear old detail rows 
      await supabase
        .from('mr_settlement_detail')
        .delete()
        .eq('mr_no', targetMrNo);

      // 3. Write active columns (where grade or area is present)
      const rowsToWrite = detailCols
        .filter(c => c.grade.trim() !== '')
        .map(c => ({
          mr_no: targetMrNo,
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
        const { error: matchErr } = await supabase
          .from('mr_settlement_detail')
          .insert(rowsToWrite);
        if (matchErr) throw matchErr;
      }

      // Live sync to custom table 'm_r_settlement' with manual weight entries and status checks
      const qualitySummary = `Moisture Claim: ${detailCols.map(c => c.moist_claim).filter(Boolean).join('/') || '0'} | Dust Claim: ${detailCols.map(c => c.dust_claim).filter(Boolean).join('/') || '0'}`;
      const materialDetails = detailCols.map(c => `${c.grade || 'N/A'} (${c.area || 'N/A'} - ${c.agency || 'N/A'})`).filter(g => !g.startsWith('N/A')).join(', ');

      const { error: customTableErr } = await supabase
        .from('m_r_settlement')
        .insert({
          mr_no: targetMrNo,
          po_no: masterData.po_no,
          lorry_number: masterData.lorry_number,
          material_details: materialDetails || 'Material Goods Received',
          quality: qualitySummary,
          quantity: totalSettleQty,
          settlement_date: masterData.sett_date,
          payment_status: masterData.payment_status || 'Pending',
          challan_weight: Number(masterData.challan_weight) || 0,
          supplier_net_wt: Number(masterData.supplier_net_wt) || 0,
          electronic_scale_net: Number(masterData.electronic_scale_net) || 0,
          remarks: masterData.remarks
        });
      
      if (customTableErr) {
        console.warn("m_r_settlement Sync Notice:", customTableErr);
      }

      // Mark P.O and M.R status as 'settled' so they move to Settlement table
      if (masterData.po_no) {
        await supabase
          .from('purchase_master')
          .update({ status: 'settled', pending: false })
          .eq('po_no', masterData.po_no);

        await supabase
          .from('sauda_master')
          .update({ status: 'settled', pending: false })
          .or(`sauda_no.eq.${masterData.po_no},po_no.eq.${masterData.po_no}`);

        await supabase
          .from('sauda_check_point')
          .update({ status: 'settled', pending: false })
          .eq('po_no', masterData.po_no);
      }

      if (targetMrNo || masterData.po_no) {
        const filterStr = targetMrNo && masterData.po_no 
          ? `mr_no.eq.${targetMrNo},arrival_no.eq.${targetMrNo},po_no.eq.${masterData.po_no}`
          : targetMrNo ? `mr_no.eq.${targetMrNo},arrival_no.eq.${targetMrNo}` : `po_no.eq.${masterData.po_no}`;

        await supabase
          .from('mill_inspection_master')
          .update({ status: 'settled' })
          .or(filterStr);

        await supabase
          .from('final_arrival')
          .update({ status: 'settled' })
          .or(filterStr);

        await supabase
          .from('temporary_material_received')
          .update({ status: 'settled' })
          .or(filterStr);
      }



      if (onLogEvent) {
        onLogEvent('MR_SETTLEMENT', `Archived settlement for MR [MR: ${masterData.mr_no}] against PO [PO: ${masterData.po_no}] with Payment Status: ${masterData.payment_status || 'Pending'}. Settle Quantity: ${totalSettleQty} MT`);
      }

      setSuccessMessage(`M.R. Settlement [MR No ${masterData.mr_no}] finalized and archived successfully !`);
      setLastSyncTime(new Date().toLocaleTimeString());
      setShowSuccessAnim(true);
      setTimeout(() => {
        setShowSuccessAnim(false);
        setViewMode('dashboard');
        initPage();
      }, 2500);

    } catch (err: any) {
      setErrorMessage("Save failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Revert Settlement Functionality (Restricted to Admin / L5 users)
  const handleRevertSettlement = async (targetMr: string, targetPoNo?: string) => {
    if (!isL5OrAdmin()) {
      alert("Permission Denied: Revert operation is restricted. Only Admin and L5 users can revert settlements.");
      return;
    }

    const poInfo = targetPoNo ? ` (P.O #${targetPoNo})` : '';
    if (!window.confirm(`REVERT SETTLEMENT CONFIRMATION:\nAre you sure you want to CANCEL & REVERT the settlement for M.R. #${targetMr}${poInfo}?\n\nThis action will cancel the settlement and MOVE the P.O data back to Final P.O and Final M.R data back to Final M.R registers.`)) {
      return;
    }

    setLoading(true);
    try {
      if (!supabase) throw new Error("Supabase client is not available.");

      // 1. Delete settlement records
      await supabase.from('mr_settlement_detail').delete().eq('mr_no', targetMr);
      await supabase.from('mr_settlement_master').delete().eq('mr_no', targetMr);
      await supabase.from('m_r_settlement').delete().eq('mr_no', targetMr);



      // 2. Restore P.O status in purchase_master and sauda_master back to Final P.O (pending/final)
      if (targetPoNo) {
        await supabase
          .from('purchase_master')
          .update({ status: 'final', pending: true })
          .eq('po_no', targetPoNo);

        await supabase
          .from('sauda_master')
          .update({ status: 'active', pending: true })
          .or(`sauda_no.eq.${targetPoNo},po_no.eq.${targetPoNo}`);
      }

      // 3. Restore Final M.R data status back to Final M.R (active)
      const filterStr = targetPoNo ? `mr_no.eq.${targetMr},po_no.eq.${targetPoNo}` : `mr_no.eq.${targetMr}`;
      await supabase
        .from('mill_inspection_master')
        .update({ status: 'active' })
        .or(filterStr);

      await supabase
        .from('final_arrival')
        .update({ status: 'active' })
        .or(filterStr);

      await supabase
        .from('temporary_material_received')
        .update({ status: 'active' })
        .or(filterStr);

      if (onLogEvent) {
        onLogEvent('MR_SETTLEMENT_REVERT', `Reverted settlement for M.R #${targetMr} / PO #${targetPoNo || 'N/A'}. P.O data restored to Final P.O and Final M.R.`);
      }

      alert(`SUCCESS: Settlement for M.R. #${targetMr} has been cancelled and reverted!\n\nP.O data moved back to Final P.O and Final M.R data moved back to Final M.R.`);
      initPage();
    } catch (err: any) {
      console.error("Revert error:", err);
      alert("Error reverting settlement: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Settle removal / purge
  const handleDeleteSettlement = async (targetMr: string) => {
    if (!enforceEditOrDeletePermission("Delete")) {
      return;
    }

    if (!window.confirm(`Settle Warning: Permanently purge Settlement record for MR: ${targetMr}?`)) return;
    setLoading(true);
    try {
      if (!supabase) return;
      const { error } = await supabase
        .from('mr_settlement_master')
        .delete()
        .eq('mr_no', targetMr);
      if (error) throw error;
      alert(`Settlement report for ${targetMr} deleted.`);
      initPage();
    } catch (err: any) {
      alert("Error dropping record: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Export full records
  const handleExportCsv = () => {
    if (settledList.length === 0) {
      alert("No settlement logs available to export.");
      return;
    }
    const dataToExport = settledList.map(row => ({
      "MR No": row.mr_no,
      "Date": row.sett_date,
      "PO No": row.po_no,
      "Lorry Number": row.lorry_number,
      "Supplier": row.supplier,
      "Broker": row.broker,
      "Payable Value (INR)": row.payable_amt,
      "Bill No": row.payable_bill_no,
      "Bill Date": row.payable_bill_date
    }));
    const sanitizedData = sanitizeCsvData(dataToExport);
    const csv = Papa.unparse(sanitizedData);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MR_Settlement_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Excel/CSV for Selected P.O.
  const handleExportExcelForSelectedPo = () => {
    if (!selectedPoNo || !poStats) {
      alert("Please select a P.O number first to export its settlement data.");
      return;
    }

    // Header & Meta Configuration Section
    const fileHeader = [
      { "P.O Settlement Export Report": `P.O NUMBER: #${selectedPoNo}`, "Value / Metric": "" },
      { "P.O Settlement Export Report": "Expressed in Metric Tons (MT)", "Value / Metric": "" },
      { "P.O Settlement Export Report": `Generated At`, "Value / Metric": new Date().toLocaleString() },
      { "P.O Settlement Export Report": "", "Value / Metric": "" },
      { "P.O Settlement Export Report": "--- CONTRACT & INVENTORY STATUS SUMMARY ---", "Value / Metric": "" },
      { "P.O Settlement Export Report": "Total PO Contract Weight", "Value / Metric": `${poStats.contractQty.toFixed(3)} MT` },
      { "P.O Settlement Export Report": "Inspected Received Weight", "Value / Metric": `${poStats.receivedQty.toFixed(3)} MT` },
      { "P.O Settlement Export Report": "Classic Settled Weight Sum", "Value / Metric": `${poStats.settledQty.toFixed(3)} MT` },
      { "P.O Settlement Export Report": "M.R Custom Settlements Sum", "Value / Metric": `${poStats.customReceivedQty.toFixed(3)} MT` },
      { "P.O Settlement Export Report": "Current Calculated Pending Received Balance", "Value / Metric": `${poStats.pendingReceivedQty.toFixed(3)} MT` },
      { "P.O Settlement Export Report": "", "Value / Metric": "" },
      { "P.O Settlement Export Report": "--- DETAILED SETTLEMENT TRANSACTION ENTRIES ---", "Value / Metric": "" }
    ];

    // Map m_r_settlement logs to rows
    const detailRows = customSettlementRecords.map((r, idx) => ({
      "P.O Settlement Export Report": `Entry #${idx + 1} | ID: ${r.id || 'N/A'}`,
      "Value / Metric": `Settle Date: ${r.settlement_date ? r.settlement_date.split('T')[0] : 'N/A'} | Settle Qty: ${Number(r.quantity).toFixed(3)} MT | Lorry Scale Net: ${Number(r.electronic_scale_net || 0).toFixed(3)} MT | Status: ${r.payment_status || 'Pending'} | Quality Claims: ${r.quality || 'N/A'} | Details: ${r.material_details || 'N/A'}`
    }));

    const finalExportArray = [...fileHeader, ...detailRows];
    
    const sanitizedData = sanitizeCsvData(finalExportArray);
    const csv = Papa.unparse(sanitizedData);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PO_${selectedPoNo}_Settlement_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 100-rows per page pagination (searches full dataset, displays paginated)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter]);

  // Filter dashboard 
  const filteredSettles = settledList.filter(item => {
    if (!canViewCompletedData()) {
      const pStatus = (item.payment_status || '').toLowerCase();
      const isCompleted = pStatus === 'settled' || pStatus === 'paid' || pStatus === 'cleared' || pStatus === 'approved';
      if (isCompleted) return false;
    }
    const term = searchFilter.toLowerCase();
    return (
      (item.mr_no || '').toLowerCase().includes(term) ||
      (item.po_no || '').toLowerCase().includes(term) ||
      (item.supplier || '').toLowerCase().includes(term) ||
      (item.broker || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="w-full text-[11px] font-sans selection:bg-rose-100 ">
      {viewMode === 'dashboard' ? (
        <LegacyLayout title="Settlement" subtitle="" onClose={onClose}>
          <div className="space-y-4">

            {/* Aesthetic Top Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">

              {/* ARCHIVED SETTLEMENTS */}
              <div className="group relative overflow-hidden bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="absolute left-0 top-0 h-full w-1 bg-rose-500" />

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Archived Settlements
                    </p>

                    <p className="mt-1 text-xl font-black text-slate-800 font-mono">
                      {settledList.length}
                      <span className="ml-1 text-xs font-bold text-slate-500">
                        Accounts
                      </span>
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 border border-rose-100 text-rose-600">
                    <FileCheck className="h-5 w-5" />
                  </div>
                </div>
              </div>


              {/* TOTAL SETTLED OUTFLOW */}
              <div className="group relative overflow-hidden bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="absolute left-0 top-0 h-full w-1 bg-emerald-500" />

                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Total Settled Outflow
                    </p>

                    <p className="mt-1 text-lg font-black text-emerald-700 font-mono truncate">
                      ₹{" "}
                      {settledList
                        .reduce(
                          (sum, item) =>
                            sum + (Number(item.payable_amt) || 0),
                          0
                        )
                        .toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                    </p>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
              </div>


              {/* AVERAGE BILL VALUE */}
              <div className="group relative overflow-hidden bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="absolute left-0 top-0 h-full w-1 bg-indigo-500" />

                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Avg Bill Value
                    </p>

                    <p className="mt-1 text-lg font-black text-indigo-700 font-mono truncate">
                      ₹{" "}
                      {settledList.length
                        ? (
                            settledList.reduce(
                              (sum, item) =>
                                sum + (Number(item.payable_amt) || 0),
                              0
                            ) / settledList.length
                          ).toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })
                        : "0.00"}
                    </p>
                  </div>

                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                    <Calculator className="h-5 w-5" />
                  </div>
                </div>
              </div>


              {/* PENDING AUDITS */}
              <div className="group relative overflow-hidden bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="absolute left-0 top-0 h-full w-1 bg-amber-500" />

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Pending Audits
                    </p>

                    <p className="mt-1 text-xl font-black text-amber-700 font-mono">
                      {Math.max(0, inspections.length - settledList.length)}
                      <span className="ml-1 text-xs font-bold text-slate-500">
                        Materials
                      </span>
                    </p>
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 border border-amber-100 text-amber-600">
                    <Scale className="h-5 w-5" />
                  </div>
                </div>
              </div>

            </div>
            {/* <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-2.5 bg-slate-100 border border-slate-300">
              
              <div className="bg-white border border-gray-400 p-2.5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Archived Settlements</p>
                  <p className="text-lg font-black text-slate-800 font-mono">{settledList.length} Accounts</p>
                </div>
                <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700">
                  <FileCheck className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-white border border-gray-400 p-2.5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Total Settled Outflow</p>
                  <p className="text-lg font-black text-rose-700 font-mono">
                    ₹ {settledList.reduce((sum, item) => sum + (Number(item.payable_amt) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-white border border-gray-400 p-2.5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Avg Bill Value</p>
                  <p className="text-lg font-black text-indigo-900 font-mono">
                    ₹ {settledList.length ? (settledList.reduce((sum, item) => sum + (Number(item.payable_amt) || 0), 0) / settledList.length).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '0.00'}
                  </p>
                </div>
                <div className="p-2 bg-indigo-50 border border-indigo-200 text-indigo-700">
                  <Calculator className="h-5 w-5" />
                </div>
              </div>

              <div className="bg-white border border-gray-400 p-2.5 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Pending Audits</p>
                  <p className="text-lg font-black text-amber-700 font-mono">
                    {Math.max(0, inspections.length - settledList.length)} Materials
                  </p>
                </div>
                <div className="p-2 bg-amber-50 border border-amber-200 text-amber-700">
                  <Scale className="h-5 w-5" />
                </div>
              </div>

            </div> */}

            {/* Dashboard Controls */}
            <div className="flex bg-[#174C2C] p-3 border border-[#103A20] rounded-lg gap-3 items-center flex-wrap shadow-md">

              {/* SEARCH */}
              <div className="flex bg-white border border-white/30 rounded-md flex-1 min-w-[280px] overflow-hidden shadow-sm">
                <input
                  id="query_by_m_r_no_supplier__2032"
                  name="query_by_m_r_no_supplier_"
                  aria-label="Query by M.R. No., Supplier Name, Broker, P.O. No..."
                  className="flex-1 text-xs px-3 outline-none py-2 font-sans font-semibold text-slate-700 placeholder:text-slate-400"
                  placeholder="Query by M.R. No., Supplier Name, Broker, P.O. No..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />

                <button className="bg-[#103A20] px-3 border-l border-[#174C2C] hover:bg-[#0b2b18] transition-colors cursor-pointer">
                  <Search className="h-4 w-4 text-white" />
                </button>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex gap-2 flex-wrap">

                {/* CREATE */}
                <button
                  onClick={() => {
                    setMasterData(initialMaster());
                    setDetailCols([1, 2, 3, 4].map(emptyDetailColumn));
                    setErrorMessage('');
                    setSuccessMessage('');
                    setIsEdit(false);
                    setViewMode('entry');
                  }}
                  className="bg-yellow-400 border border-[#1B5E20] rounded-md px-3.5 py-2 text-[10px] uppercase font-bold text-white flex items-center gap-1.5 hover:bg-[#1B5E20] shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-white" />
                  Create Settlement
                </button>

                {/* EXPORT */}
                <button
                  onClick={handleExportCsv}
                  className="bg-white border border-white/50 rounded-md px-3.5 py-2 text-[10px] uppercase font-bold text-slate-700 flex items-center gap-1.5 hover:bg-blue-50 hover:text-blue-700 shadow-sm transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-600" />
                  Export CSV
                </button>

                {/* CLEAR */}
                <button
                  onClick={() => setSearchFilter('')}
                  className="bg-white border border-white/50 rounded-md px-3 py-2 text-[10px] uppercase font-bold text-slate-700 flex items-center gap-1.5 hover:bg-rose-50 hover:text-rose-700 shadow-sm transition-all cursor-pointer"
                  title="Clear Search"
                >
                  <X className="h-3.5 w-3.5 text-rose-600" />
                  Clear
                </button>

                {/* REFRESH */}
                <button
                  onClick={handleManualRefresh}
                  className="bg-[#103A20] hover:bg-[#0b2b18] text-white border border-white/30 rounded-md px-3.5 py-2 text-[10px] uppercase font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                  disabled={loading}
                >
                  <RefreshCcw
                    className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                  />
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>

              </div>
            </div>
            {/* <div className="flex bg-[#c0c0c0] p-1.5 border border-black/20 gap-2 items-center flex-wrap shadow-sm">
              <div className="flex bg-white border border-gray-400 p-px flex-1 min-w-[280px]">
                <input  id="query_by_m_r_no_supplier__2032" name="query_by_m_r_no_supplier_" aria-label="Query by M.R. No., Supplier Name, Broker, P.O. No..."
                  className="flex-1 text-xs px-2.5 outline-none py-1.5 font-sans font-bold" 
                  placeholder="Query by M.R. No., Supplier Name, Broker, P.O. No..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
                <button className="bg-[#d4d0c8] px-3 border-l border-gray-400 hover:bg-gray-300 transition-colors">
                  <Search className="h-3.5 w-3.5 text-slate-800" />
                </button>
              </div>

              <div className="flex gap-1">
                <button 
                  onClick={() => {
                    setMasterData(initialMaster());
                    setDetailCols([1, 2, 3, 4].map(emptyDetailColumn));
                    setErrorMessage('');
                    setSuccessMessage('');
                    setIsEdit(false);
                    setViewMode('entry');
                  }}
                  className="bg-[#d4d0c8] border border-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] px-3.5 py-1.5 text-[10px] uppercase font-black flex items-center gap-1 hover:bg-white active:shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.5)] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 text-green-800" /> Create Settlement
                </button>
                <button 
                  onClick={handleExportCsv}
                  className="bg-[#d4d0c8] border border-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] px-3.5 py-1.5 text-[10px] uppercase font-black flex items-center gap-1 hover:bg-white active:shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.5)] cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-800" /> Export CSV
                </button>
                <button 
                  onClick={() => setSearchFilter('')}
                  className="bg-[#d4d0c8] border border-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] px-3 py-1.5 text-[10px] uppercase font-black flex items-center gap-1 active:shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.5)] cursor-pointer"
                  title="Clear Search"
                >
                  <X className="h-3.5 w-3.5 text-red-800" /> Clear
                </button>
                <button 
                  onClick={handleManualRefresh}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white border border-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] px-3 py-1.5 text-[10px] uppercase font-black flex items-center gap-1 active:shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.5)] transition-colors disabled:opacity-50 disabled:cursor-wait"
                  disabled={loading}
                >
                  <RefreshCcw className={`h-3.5 w-3.5 text-emerald-100 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div> */}

            {/* List Table Grid of settlements */}
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-sans min-w-[1100px]">

                  <thead>
                    <tr className="bg-[#174C2C] text-[10px] font-black uppercase text-white tracking-wide">
                      <th className="px-3 py-2.5 border-r border-white/20 whitespace-nowrap">
                        M.R. No.
                      </th>
                      <th className="px-3 py-2.5 border-r border-white/20 whitespace-nowrap">
                        Audit Date
                      </th>
                      <th className="px-3 py-2.5 border-r border-white/20 whitespace-nowrap">
                        P.O. No.
                      </th>
                      <th className="px-3 py-2.5 border-r border-white/20 whitespace-nowrap">
                        Supplier Name
                      </th>
                      <th className="px-3 py-2.5 border-r border-white/20 whitespace-nowrap">
                        Broker Name
                      </th>
                      <th className="px-3 py-2.5 border-r border-white/20 whitespace-nowrap">
                        Lorry Number
                      </th>
                      <th className="px-3 py-2.5 border-r border-white/20 text-right whitespace-nowrap">
                        Settled Amt
                      </th>
                      <th className="px-3 py-2.5 border-r border-white/20 whitespace-nowrap">
                        Bill No / Date
                      </th>
                      <th className="px-3 py-2.5 border-r border-white/20 text-center whitespace-nowrap">
                        Status
                      </th>
                      <th className="px-3 py-2.5 text-center whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 font-medium">

                    {loading ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="text-center py-10 text-xs font-bold text-slate-500 uppercase tracking-widest italic animate-pulse"
                        >
                          Retrieving Accounts settlement ledger logs from Supabase ...
                        </td>
                      </tr>

                    ) : filteredSettles.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="text-center py-10 text-xs font-bold text-slate-400 italic"
                        >
                          No Settled M.R. Records discovered. Click "Create Settlement" to resolve quality entries.
                        </td>
                      </tr>

                    ) : (
                      filteredSettles.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row) => (
                        <tr
                          key={row.settlement_id}
                          className="hover:bg-emerald-50/60 text-[11px] font-sans transition-colors duration-150"
                        >

                          <td className="px-3 py-2.5 border-r border-slate-100 font-bold text-rose-700 whitespace-nowrap">
                            {row.mr_no}
                          </td>

                          <td className="px-3 py-2.5 border-r border-slate-100 text-slate-600 whitespace-nowrap">
                            {row.sett_date}
                          </td>

                          <td className="px-3 py-2.5 border-r border-slate-100 font-semibold text-slate-700 whitespace-nowrap">
                            {row.po_no}
                          </td>

                          <td className="px-3 py-2.5 border-r border-slate-100 text-slate-800 uppercase font-bold whitespace-nowrap">
                            {row.supplier}
                          </td>

                          <td className="px-3 py-2.5 border-r border-slate-100 text-slate-600 whitespace-nowrap">
                            {row.broker}
                          </td>

                          <td className="px-3 py-2.5 border-r border-slate-100 font-mono text-slate-700 whitespace-nowrap">
                            {row.lorry_number}
                          </td>

                          <td className="px-3 py-2.5 border-r border-slate-100 text-right font-mono font-black text-emerald-700 whitespace-nowrap">
                            ₹{" "}
                            {Number(row.payable_amt).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </td>

                          <td className="px-3 py-2.5 border-r border-slate-100 font-mono text-slate-500 whitespace-nowrap">
                            {row.payable_bill_no
                              ? `${row.payable_bill_no} / ${row.payable_bill_date || ""}`
                              : "-"}
                          </td>

                          <td className="px-3 py-2.5 border-r border-slate-100 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[8px] font-extrabold uppercase tracking-wide ${
                                row.payment_status === "Paid"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : row.payment_status === "Settled"
                                  ? "bg-blue-100 text-blue-800 border border-blue-300"
                                  : row.payment_status === "Partially Paid"
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : "bg-rose-100 text-rose-700 border border-rose-300"
                              }`}
                            >
                              {row.payment_status || "Pending"}
                            </span>
                          </td>

                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">

                              <button
                                onClick={() => handleOpenViewSettlement(row.mr_no)}
                                className="bg-emerald-50 hover:bg-emerald-700 hover:text-white border border-emerald-300 text-emerald-700 rounded px-2.5 py-1.5 font-bold text-[9px] uppercase transition-all cursor-pointer flex items-center gap-1"
                                title="View full settlement details & deduction breakdown table"
                              >
                                <Eye className="w-3 h-3" />
                                View
                              </button>

                              {canEditOrDelete() && (
                                <>
                                  <button
                                    onClick={async () => {
                                      if (!enforceEditOrDeletePermission("Edit")) return;
                                      setViewMode("entry");
                                      await handleProceedWithMrNo(row.mr_no);
                                    }}
                                    className="bg-slate-50 hover:bg-[#3f51b5] hover:text-white border border-slate-300 text-slate-700 rounded px-2.5 py-1.5 font-bold text-[9px] uppercase transition-all cursor-pointer"
                                    title="Edit Settlement entry"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    onClick={() => handleDeleteSettlement(row.mr_no)}
                                    className="bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-300 text-rose-600 rounded px-2.5 py-1.5 font-bold text-[9px] uppercase transition-all cursor-pointer"
                                    title="Delete Settlement record"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}

                              {isL5OrAdmin() && (
                                <button
                                  onClick={() =>
                                    handleRevertSettlement(row.mr_no, row.po_no)
                                  }
                                  className="bg-amber-50 hover:bg-amber-600 hover:text-white border border-amber-300 text-amber-800 rounded px-2.5 py-1.5 font-bold text-[9px] uppercase transition-all cursor-pointer flex items-center gap-1"
                                  title="Revert Settlement: Cancels settlement and moves P.O & Final M.R data back to Final P.O & Final M.R registers (Admin/L5 Only)"
                                >
                                  <span>↺</span>
                                  Revert
                                </button>
                              )}

                            </div>
                          </td>

                        </tr>
                      ))
                    )}

                  </tbody>
                </table>
              </div>
              <div className="mt-2">
                <PaginationControls
                  currentPage={currentPage}
                  totalItems={filteredSettles.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            </div>

            {/* <div className="bg-white border border-gray-400 overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans">
                <thead>
                  <tr className="bg-[#f0f0f0] border-b border-gray-400 text-[10px] font-black uppercase text-gray-700">
                    <th className="px-3 py-2 border-r border-gray-300">M.R. No.</th>
                    <th className="px-3 py-2 border-r border-gray-300">Audit Date</th>
                    <th className="px-3 py-2 border-r border-gray-300">P.O. No.</th>
                    <th className="px-3 py-2 border-r border-gray-300">Supplier Name</th>
                    <th className="px-3 py-2 border-r border-gray-300">Broker Name</th>
                    <th className="px-3 py-2 border-r border-gray-300">Lorry Number</th>
                    <th className="px-3 py-2 border-r border-gray-300 text-right">Settled Amt</th>
                    <th className="px-3 py-2 border-r border-gray-300">Bill No / Date</th>
                    <th className="px-3 py-2 border-r border-gray-300 text-center">Status</th>
                    <th className="px-3 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-xs font-bold text-slate-500 uppercase tracking-widest italic animate-pulse">
                        Retrieving Accounts settlement ledger logs from Supabase ...
                      </td>
                    </tr>
                  ) : filteredSettles.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-xs font-bold text-slate-400 italic">
                        No Settled M.R. Records discovered. Click "Create Settlement" to resolve quality entries.
                      </td>
                    </tr>
                  ) : (
                    filteredSettles.map((row) => (
                      <tr key={row.settlement_id} className="hover:bg-slate-50 text-[11px] font-sans">
                        <td className="px-3 py-2 border-r border-gray-200 font-bold text-rose-700">{row.mr_no}</td>
                        <td className="px-3 py-2 border-r border-gray-200">{row.sett_date}</td>
                        <td className="px-3 py-2 border-r border-gray-200 font-semibold">{row.po_no}</td>
                        <td className="px-3 py-2 border-r border-gray-200 text-slate-800 uppercase font-bold">{row.supplier}</td>
                        <td className="px-3 py-2 border-r border-gray-200 text-slate-600 font-sans">{row.broker}</td>
                        <td className="px-3 py-2 border-r border-gray-200 font-mono">{row.lorry_number}</td>
                        <td className="px-3 py-2 border-r border-gray-200 text-right font-mono font-black text-emerald-800">
                          ₹ {Number(row.payable_amt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-200 font-mono text-gray-500">
                          {row.payable_bill_no ? `${row.payable_bill_no} / ${row.payable_bill_date || ''}` : '-'}
                        </td>
                        <td className="px-3 py-2 border-r border-gray-200 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                            row.payment_status === 'Paid' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            row.payment_status === 'Settled' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                            row.payment_status === 'Partially Paid' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            'bg-rose-100 text-[#ca1515] border border-rose-300'
                          }`}>
                            {row.payment_status || 'Pending'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => handleOpenViewSettlement(row.mr_no)}
                            className="bg-emerald-100 hover:bg-emerald-700 hover:text-white border border-emerald-400 text-emerald-800 px-2 py-1 font-bold text-[9px] uppercase transition-all tracking-tight cursor-pointer flex items-center gap-1"
                            title="View full settlement details & deduction breakdown table"
                          >
                            <Eye className="w-3 h-3" /> View
                          </button>
                          {canEditOrDelete() && (
                            <>
                              <button 
                                onClick={async () => {
                                  if (!enforceEditOrDeletePermission("Edit")) return;
                                  setViewMode('entry');
                                  await handleProceedWithMrNo(row.mr_no);
                                }}
                                className="bg-slate-200 hover:bg-[#3f51b5] hover:text-white border border-gray-400 px-2.5 py-1 font-bold text-[9px] uppercase transition-all tracking-tight cursor-pointer"
                                title="Edit Settlement entry"
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteSettlement(row.mr_no)}
                                className="bg-white hover:bg-rose-600 hover:text-white border border-gray-400 text-rose-600 px-2.5 py-1 font-bold text-[9px] uppercase transition-all tracking-tight cursor-pointer"
                                title="Delete Settlement record"
                              >
                                Delete
                              </button>
                            </>
                          )}

                          {isL5OrAdmin() && (
                            <button 
                              onClick={() => handleRevertSettlement(row.mr_no, row.po_no)}
                              className="bg-amber-100 hover:bg-amber-600 hover:text-white border border-amber-500 text-amber-900 px-2.5 py-1 font-bold text-[9px] uppercase transition-all tracking-tight cursor-pointer flex items-center gap-1"
                              title="Revert Settlement: Cancels settlement and moves P.O & Final M.R data back to Final P.O & Final M.R registers (Admin/L5 Only)"
                            >
                              <span>↺</span> Revert
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div> */}

          </div>
        </LegacyLayout>
      ) : (
        // *ENTRY FORM SCREEN* - Highly customized retro Windows layout replicating screenshot details!
        <LegacyLayout title="SETTLEMENT" onClose={() => setViewMode('dashboard')}>
          
          <AnimatePresence>
            {showSuccessAnim && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 10 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: -10 }}
                  transition={{ type: "spring", damping: 20 }}
                  className="bg-[#faf8f5] border-3 border-emerald-600 shadow-[8px_8px_0_0_rgba(16,185,129,0.3)] p-6 max-w-md w-full text-center space-y-4"
                >
                  <div className="mx-auto h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center border-2 border-emerald-500">
                    <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 font-sans">
                    📊 Synchronization Success 📊
                  </h3>
                  <div className="space-y-1.5 p-3.5 bg-emerald-50 border border-emerald-400 rounded-sm">
                    <p className="text-xs text-slate-800 font-black">
                      M.R. Settlement Sync Completed!
                    </p>
                    <p className="text-[10px] text-slate-600 leading-relaxed font-sans font-medium">
                      The pending received quantities against <strong>PO #{selectedPoNo}</strong> have been recalculated & updated on the main database.
                    </p>
                  </div>
                  <div className="flex justify-center flex-col items-center gap-1.5">
                    <span className="text-[9px] font-mono font-bold text-emerald-700 animate-pulse uppercase">
                      Inventory Stocks verified & updated
                    </span>
                    <div className="h-1.5 w-32 bg-emerald-200 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2.2, ease: "easeInOut" }}
                        className="h-full bg-emerald-600"
                      />
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* HEADER BAR */}
          <div className="bg-[#174C2C] text-white px-6 py-4 rounded-xl shadow-lg flex flex-wrap items-center justify-between border border-[#0F351E] gap-4">
            {/* Left Badge */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <h1 className="text-base font-bold text-white tracking-wide">
                  SETTLEMENT
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
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
          </div>

          <div className="space-y-3 font-sans relative">
            {/* Proceed Control Center */}
            <div className="bg-[#d4d0c8] p-3 border-2 border-white shadow-[2px_2px_0_0_rgba(0,0,0,0.15)] space-y-3">
              <div className="flex items-center gap-4 flex-wrap text-xs">
                
                {/* PO Number Searchable Dropdown */}
                <div className="flex items-center gap-2 bg-white border border-gray-400 p-1 rounded-sm">
                  <span className="font-extrabold text-slate-800 uppercase text-[10px] tracking-tight shrink-0">Final P.O:</span>
                  <div className="w-[260px] sm:w-[320px]">
                    <SearchableSelect
                      id="selectedpono_2238"
                      name="selectedpono"
                      value={selectedPoNo}
                      onChange={(newPo) => handlePoNoSelection(newPo, false)}
                      options={poOptions}
                      placeholder="-- SEARCH / SELECT FINAL P.O --"
                      compact={true}
                      inputClassName="font-mono text-xs font-bold text-blue-800 bg-white border-0 py-0.5"
                    />
                  </div>
                </div>

                {/* Inspection Searchable Dropdown - Filtered strictly by selected P.O */}
                <div className="flex items-center gap-2 bg-white border border-gray-400 p-1 rounded-sm">
                  <span className="font-extrabold text-slate-800 uppercase text-[10px] tracking-tight shrink-0">Inspection:</span>
                  <div className="w-[220px] sm:w-[280px]">
                    <SearchableSelect
                      id="masterdata_mr_no_2258"
                      name="masterdata_mr_no"
                      value={masterData.mr_no}
                      onChange={(mrVal) => {
                        handleMasterChange('mr_no', mrVal);
                        handleProceedWithMrNo(mrVal);
                      }}
                      options={faOptionsForSelectedPo}
                      placeholder={selectedPoNo ? "-- CHOOSE INSPECTION --" : "-- SELECT P.O FIRST --"}
                      disabled={!selectedPoNo}
                      compact={true}
                      inputClassName="font-mono text-xs font-bold text-rose-800 bg-white border-0 py-0.5"
                    />
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={() => {
                    if (masterData.mr_no) {
                      handleProceedWithMrNo(masterData.mr_no, true);
                    } else {
                      setErrorMessage("Please select an Inspection (M.R) first to sync.");
                    }
                  }}
                  className="bg-[#d4d0c8] hover:bg-white text-[10px] uppercase font-black px-4 py-2 border border-gray-400 cursor-pointer shadow-xs active:translate-y-px rounded"
                >
                  Force Sync Inspection
                </button>

                <button 
                  type="button"
                  onClick={handleManualRefresh}
                  disabled={loading}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-extrabold uppercase px-3.5 py-2 border border-emerald-500 shadow-sm active:translate-y-px flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 rounded"
                  title="Refresh all database records, Final P.O. dropdown, Inspection list & payment vouchers without hard browser reloading"
                >
                  <RefreshCcw className={`h-3.5 w-3.5 text-emerald-200 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
                </button>

                {masterData.mr_no && (
                  <button 
                    type="button"
                    onClick={() => handleOpenViewSettlement(masterData.mr_no)}
                    className="bg-indigo-700 hover:bg-indigo-800 text-white text-[10px] font-extrabold uppercase px-3.5 py-1.5 border border-indigo-500 shadow-sm active:translate-y-px flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="View printable settlement statement with deduction breakdown table"
                  >
                    <Eye className="h-3.5 w-3.5 text-indigo-200" />
                    <span>View Settlement Statement</span>
                  </button>
                )}

                {selectedPoNo && (
                  <button 
                    onClick={handleExportExcelForSelectedPo}
                    className="bg-emerald-850 hover:bg-emerald-750 text-white text-[10px] font-extrabold uppercase px-3.5 py-1.5 border border-emerald-600 shadow-sm active:translate-y-px flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-300" />
                    <span>Export P.O. to Excel</span>
                  </button>
                )}

                {loading && <span className="text-[10px] font-bold text-blue-800 italic animate-pulse">Syncing...</span>}
              </div>

              {/* Dynamic P.O Quantities Reduction Panel & 1-to-N Consignment Meter */}
              {poStats && (
                <div className="space-y-2">
                  {/* 1-to-N Fulfillment Progress Bar */}
                  <div className="bg-slate-900 border-2 border-indigo-900 p-2.5 rounded-sm text-white space-y-1.5 shadow-md">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                      <span className="text-indigo-300 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-cyan-400 inline" />
                        <span>1-to-N P.O Consignment Fulfillment Progress (PO #{selectedPoNo})</span>
                      </span>
                      <span className="text-emerald-400 font-mono text-xs font-bold">
                        {((poStats.customReceivedQty + poStats.receivedQty) / (poStats.contractQty || 1) * 100).toFixed(1)}% Fulfilled
                      </span>
                    </div>

                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
                      <div 
                        className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 h-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, ((poStats.customReceivedQty + poStats.receivedQty) / (poStats.contractQty || 1) * 100)))}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[9px] text-slate-300 font-mono pt-0.5">
                      <span>Contract: <strong className="text-white">{poStats.contractQty.toFixed(3)} MT</strong></span>
                      <span>Delivered (Inspection): <strong className="text-emerald-300">{(poStats.customReceivedQty + poStats.receivedQty).toFixed(3)} MT</strong></span>
                      <span>Pending Balance: <strong className="text-amber-300">{poStats.pendingReceivedQty.toFixed(3)} MT</strong></span>
                      <span className="text-cyan-300 font-bold">
                        Linked Consignments: {inspections.filter(i => i.po_no === selectedPoNo).length} Truckloads
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white p-3 border-2 border-slate-700 shadow-inner rounded-sm">
                    <div className="border-r border-slate-700/50 pr-2">
                      <p className="text-[8px] font-extrabold uppercase text-indigo-200 tracking-wider">Total PO Contract</p>
                      <p className="text-xs font-mono font-black text-white">{poStats.contractQty.toFixed(3)} MT</p>
                    </div>
                    <div className="border-r border-slate-700/50 px-2">
                      <p className="text-[8px] font-extrabold uppercase text-emerald-300 tracking-wider">Inspected Received</p>
                      <p className="text-xs font-mono font-black text-emerald-400">{poStats.receivedQty.toFixed(3)} MT</p>
                    </div>
                    <div className="border-r border-slate-700/50 px-2">
                      <p className="text-[8px] font-extrabold uppercase text-amber-300 tracking-wider">Settles Sum (Classic)</p>
                      <p className="text-xs font-mono font-black text-amber-400">{poStats.settledQty.toFixed(3)} MT</p>
                    </div>
                    <div className="border-r border-slate-700/50 px-2 bg-slate-900/40 rounded-xs p-1">
                      <p className="text-[8px] font-extrabold uppercase text-cyan-300 tracking-wider">M.R. Settlements Sum</p>
                      <p className="text-xs font-mono font-black text-cyan-400">{poStats.customReceivedQty.toFixed(3)} MT</p>
                    </div>
                    <div className="pl-2 bg-indigo-900/40 rounded-xs p-1">
                      <p className="text-[8px] font-extrabold uppercase text-pink-300 tracking-wider">Pending Received (Custom)</p>
                      <p className="text-xs font-mono font-black text-pink-400 animate-pulse">{poStats.pendingReceivedQty.toFixed(3)} MT</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-[9px] bg-slate-950 border-x-2 border-b-2 border-slate-700/70 px-3 py-1.5 -mt-2 text-slate-350 font-mono italic rounded-b-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "font-extrabold tracking-tight flex items-center gap-1",
                        Math.abs((poStats.dbPendingReceived || 0) - poStats.pendingReceivedQty) < 0.001
                          ? "text-emerald-400 font-bold" 
                          : "text-amber-400"
                      )}>
                        ● DB-SYNC: {
                          Math.abs((poStats.dbPendingReceived || 0) - poStats.pendingReceivedQty) < 0.001
                            ? `VERIFIED (purchase_master.pending_received = ${poStats.dbPendingReceived.toFixed(3)} MT)`
                            : `ACTIVE (Pending validation)`
                        }
                      </span>
                      <span className="text-slate-600">|</span>
                      <span>Last DB Sync: <strong className="text-white font-bold font-sans not-italic">{lastSyncTime || 'Pending Selection'}</strong></span>
                    </div>
                    <div>
                      <span>Cumulative Received Weight Summary: <strong className="text-cyan-400 font-bold not-italic font-sans text-xs">{(poStats.customReceivedQty + poStats.receivedQty).toFixed(3)} MT</strong></span>
                    </div>
                  </div>

                  {customSettlementRecords.length > 0 && (
                    <div className="bg-[#f0ede6] p-2 border border-yellow-800/20 text-[10px] space-y-1">
                      <p className="font-extrabold text-slate-800 uppercase text-[9px] tracking-wider text-rose-900 underline">Active P.O Settlements Log (m_r_settlement Table):</p>
                      <div className="max-h-24 overflow-y-auto space-y-1 font-mono text-[9px]">
                        {customSettlementRecords.map((r, i) => (
                          <div key={r.id || i} className="flex justify-between border-b border-black/5 pb-1">
                            <span>Settle-Dt: {r.settlement_date ? r.settlement_date.split('T')[0] : 'N/A'} - Quant: <b className="text-indigo-900">{Number(r.quantity).toFixed(3)} MT</b></span>
                            <span className="text-gray-600 font-sans text-[8px]">Scale Net: {Number(r.electronic_scale_net || 0).toFixed(3)} MT | Status: <b className="uppercase font-sans font-black text-[8px]">{r.payment_status}</b></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Error & Success indicators */}
            {errorMessage && (
              <div className="bg-amber-50 border-2 border-amber-400 p-2 text-amber-900 font-bold flex flex-wrap items-center justify-between gap-2 rounded-sm shadow-2xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span className="text-xs">{errorMessage}</span>
                </div>
                {errorMessage.includes("Validation Failure (Audit Block)") && (
                  <button
                    type="button"
                    onClick={() => {
                      if (auditOverwriteInfo) {
                        setShowAuditOverwriteModal(true);
                      } else {
                        handleSaveSettlement(false);
                      }
                    }}
                    className="ml-auto bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black px-2.5 py-1 rounded shadow-xs uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                  >
                    <span>Authorize &amp; Overwrite</span>
                  </button>
                )}
              </div>
            )}

            {successMessage && (
              <div className="bg-emerald-50 border-2 border-emerald-400 p-2 text-emerald-800 font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Main Double Panel Form Grid */}
            <div className="grid grid-cols-12 gap-3 items-start">
              
              {/* LEFT SIDE PANEL: Calculations & Valuation Cards */}
              <div className="col-span-12 lg:col-span-4 space-y-2.5">
                
                {/* 1. Grade-Wise Summary Panel */}
                <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-2xs relative">
                  <div className="inline-block bg-[#f4ece1] border border-[#e5dcce] text-[#2d3748] text-[9.5px] font-extrabold uppercase px-2.5 py-0.5 rounded shadow-2xs mb-2">
                    GRADE-WISE SUMMARY PANEL
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                    {/* Row 1 */}
                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1 mb-0.5">
                        <label className="text-[9px] uppercase font-bold text-slate-600">Rate / M.T</label>
                        <span className="text-[7.5px] font-black bg-[#0f172a] text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-48 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                          DB Reference: <code className="text-yellow-400 font-mono">mr_settlement_master.summary_rate_qtel</code>
                          <p className="mt-1">Format: Numeric dec. Jute price per 1000 kg (Metric Ton) used to compute the value of the material received.</p>
                        </div>
                      </div>
                      <input id="masterdata_summary_rate_q_2435" name="masterdata_summary_rate_q" aria-label="masterdata summary rate q"
                        type="number" 
                        step="0.01"
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.summary_rate_qtel || calculateWeightedRatePerMT(detailCols) || ''} 
                        onChange={(e) => handleMasterChange('summary_rate_qtel', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="rate_aff_cd_cl_2446" className="text-[9px] uppercase font-bold text-slate-600 mb-0.5">Rate aff. Cd. Cl</label>
                      <input id="rate_aff_cd_cl_2446" name="rate_aff_cd_cl" aria-label="Rate aff. Cd. Cl"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#991b1b] shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.summary_rate_aff_cd_cl || ''} 
                        onChange={(e) => handleMasterChange('summary_rate_aff_cd_cl', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* Row 2 */}
                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1 mb-0.5">
                        <label className="text-[9px] uppercase font-bold text-slate-600">Delivery Claim(-)</label>
                        <span className="text-[7.5px] font-black bg-[#0f172a] text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
                        {selectedPoData?.delivery_to && (
                          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-56 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                            <p className="text-yellow-300 font-bold">Delivery Claim Information</p>
                            <p>Delivery To (Deadline): <code className="text-cyan-300">{selectedPoData.delivery_to}</code></p>
                            <p>Receipt / Arrival Date: <code className="text-cyan-300">{masterData.arrival_date || masterData.sett_date || 'N/A'}</code></p>
                            <p className="mt-1 pt-1 border-t border-slate-700 text-emerald-300 font-bold">Standard Delivery Claim: ₹0.00</p>
                          </div>
                        )}
                      </div>
                      <input id="masterdata_summary_delive_2489" name="masterdata_summary_delive" aria-label="masterdata summary delive"
                        type="number" 
                        step="0.01"
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-rose-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.summary_delivery_claim !== undefined && masterData.summary_delivery_claim !== null ? masterData.summary_delivery_claim : 0} 
                        onChange={(e) => handleMasterChange('summary_delivery_claim', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="moisture_claim_pct_2500" className="text-[9px] uppercase font-bold text-slate-600 mb-0.5">Moisture Claim %</label>
                      <input id="moisture_claim_pct_2500" name="moisture_claim_pct" aria-label="Moisture Claim %"
                        type="number" 
                        step="0.01"
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.summary_rate_wt_claim || ''} 
                        onChange={(e) => handleMasterChange('summary_rate_wt_claim', parseFloat(e.target.value) || 0)}
                        placeholder="0.00%"
                      />
                    </div>

                    {/* Row 3 */}
                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1 mb-0.5">
                        <label htmlFor="premium_wt_qtl_field" className="text-[9px] uppercase font-bold text-slate-600">Premium WT (₹/QTL)</label>
                        <span className="text-[7.5px] font-black bg-[#0f172a] text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-64 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                          <p className="text-yellow-300 font-bold">Premium Weight (Qtl)</p>
                          <p>Sum of Premium Quantity (in MT) from Inspection Details table converted to Quintals (MT × 10).</p>
                        </div>
                      </div>
                      <input id="premium_wt_qtl_field" name="premium_wt_qtl_field" aria-label="Premium WT (₹/QTL)"
                        type="number" 
                        step="0.01"
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#b45309] shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.summary_premium_wt !== undefined && masterData.summary_premium_wt !== null ? masterData.summary_premium_wt : ''} 
                        onChange={(e) => handleMasterChange('summary_premium_wt', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="material_value_2522" className="text-[9px] uppercase font-extrabold text-[#1e1b4b] mb-0.5">Material Value</label>
                      <input id="material_value_2522" name="material_value" aria-label="Material Value"
                        type="number" 
                        disabled
                        className="bg-[#f1f5f9] border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-900 shadow-2xs w-full"
                        value={masterData.summary_material_value.toFixed(2)} 
                      />
                    </div>

                    {/* Row 4 */}
                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1 mb-0.5">
                        <label className="text-[9px] uppercase font-bold text-slate-600">Premium Rate (₹/QTL)</label>
                        <span className="text-[7.5px] font-black bg-[#0f172a] text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-60 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                          <p className="text-yellow-300 font-bold">Premium Rate &amp; Calculation</p>
                          <p>Premium Rate: <code className="text-cyan-300">₹{masterData.summary_premium_amount || 0} / Qtl</code></p>
                          <p>Premium Weight: <code className="text-cyan-300">{(masterData.summary_premium_wt !== undefined && masterData.summary_premium_wt !== null && Number(masterData.summary_premium_wt) > 0 ? masterData.summary_premium_wt : masterData.summary_less_amount) || 0} Qtl</code></p>
                          <p className="mt-1 pt-1 border-t border-slate-700 text-white font-bold">Total Premium Amt: ₹{((masterData.summary_premium_amount || 0) * Number(masterData.summary_premium_wt !== undefined && masterData.summary_premium_wt !== null && Number(masterData.summary_premium_wt) > 0 ? masterData.summary_premium_wt : (masterData.summary_less_amount || 0))).toFixed(2)}</p>
                        </div>
                      </div>
                      <input id="masterdata_summary_premiu_2541" name="masterdata_summary_premiu" aria-label="masterdata summary premiu"
                        type="number" 
                        step="0.01"
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.summary_premium_amount || ''} 
                        onChange={(e) => handleMasterChange('summary_premium_amount', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="addtl_quality_claims_in_q_2552" className="text-[9px] uppercase font-bold text-[#991b1b] mb-0.5">Addtl Quality Claims in Quntl</label>
                      <input id="addtl_quality_claims_in_q_2552" name="addtl_quality_claims_in_q" aria-label="Addtl Quality claims in Quntl"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#991b1b] shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.summary_less_amount || ''} 
                        onChange={(e) => handleMasterChange('summary_less_amount', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* 2nd Screenshot Position: Exact 1st Screenshot Table in Settlement */}
                    <div className="flex flex-col col-span-2 space-y-1">
                      <div className="border border-[#cbd5e1] rounded-lg overflow-hidden bg-white shadow-xs">
                        <table className="w-full text-xs text-left border-collapse font-sans">
                          <thead>
                            <tr className="bg-[#eef3f9] border-b-2 border-[#2563eb] text-[11px] font-black uppercase text-slate-800 tracking-wider">
                              <th className="py-2.5 px-4 border-r border-[#cbd5e1] text-left w-7/12">
                                DEDUCTION TYPE
                              </th>
                              <th className="py-2.5 px-4 border-r border-[#cbd5e1] text-center w-3/12">
                                DEDUCTION RATE (₹)
                              </th>
                              <th className="py-2.5 px-4 text-center w-2/12">
                                QTY
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#cbd5e1]">
                            {(() => {
                              let deds: SettlementDeductionItem[] = [];
                              if (Array.isArray(masterData.deductions) && masterData.deductions.length > 0) {
                                deds = masterData.deductions;
                              } else if (typeof (masterData.deductions as any) === 'string' && (masterData.deductions as any).trim() !== '') {
                                try {
                                  const parsed = JSON.parse(masterData.deductions as any);
                                  if (Array.isArray(parsed) && parsed.length > 0) deds = parsed;
                                } catch (e) {}
                              }

                              if (deds.length === 0) {
                                const dType = masterData.summary_deduction_type || '';
                                const dRate = Number(masterData.summary_deduction_rate) || 0;
                                const dQty = Number(masterData.summary_deduction_qty) || (dRate > 0 ? 1 : 0);
                                const dAmt = Number(masterData.summary_deduction_amount) || (dRate * dQty);

                                if (dType.includes('\n') || dType.includes(',') || dType.includes(';')) {
                                  const parts = dType.split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean);
                                  deds = parts.map((part: string, idx: number) => {
                                    let rowRate = 0;
                                    let rowQty = 1;
                                    let rowAmt = 0;
                                    const amtMatch = part.match(/₹\s*([0-9.]+)/i);
                                    const rateMatch = part.match(/@\s*₹?\s*([0-9.]+)/i) || part.match(/₹\s*([0-9.]+)/i);
                                    const qtyMatch = part.match(/([0-9.]+)\s*@/i) || part.match(/([0-9.]+)\s*(?:bales|units|nos|qntl)/i);
                                    if (amtMatch) rowAmt = parseFloat(amtMatch[1]) || 0;
                                    if (rateMatch) rowRate = parseFloat(rateMatch[1]) || 0;
                                    if (qtyMatch) rowQty = parseFloat(qtyMatch[1]) || 1;
                                    if (rowAmt === 0 && rowRate > 0) rowAmt = rowRate * rowQty;
                                    const cleanType = part.replace(/\(.*\)/g, '').replace(/@.*/g, '').replace(/₹.*/g, '').trim() || part;
                                    return {
                                      deduction_type: cleanType,
                                      deduction_rate: rowRate || (idx === 0 ? dRate : 0),
                                      deduction_qty: rowQty || (idx === 0 ? dQty : 1),
                                      deduction_amount: rowAmt || (idx === 0 ? dAmt : 0)
                                    };
                                  });
                                } else if (dType && !dType.includes('-- SELECT') && (dRate > 0 || dAmt > 0)) {
                                  deds = [{
                                    deduction_type: dType,
                                    deduction_rate: dRate,
                                    deduction_qty: dQty || 1,
                                    deduction_amount: dAmt || (dRate * (dQty || 1))
                                  }];
                                }
                              }

                              if (deds.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={3} className="py-3.5 px-4 text-center text-xs font-semibold text-slate-400 italic bg-slate-50/40">
                                      No Deductions or Penalties Applied (₹0.00)
                                    </td>
                                  </tr>
                                );
                              }

                              return deds.map((dItem, dIdx) => {
                                const rate = Number(dItem.deduction_rate) || 0;
                                const qty = Number(dItem.deduction_qty) || (rate > 0 ? 1 : 0);

                                return (
                                  <tr key={dIdx} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-4 border-r border-[#cbd5e1] font-bold text-xs text-slate-900 uppercase">
                                      {dItem.deduction_type || '-'}
                                    </td>
                                    <td className="py-3 px-4 border-r border-[#cbd5e1] text-center font-mono font-bold text-xs text-slate-900">
                                      ₹{rate}
                                    </td>
                                    <td className="py-3 px-4 text-center font-mono font-bold text-xs text-slate-900">
                                      {qty}
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Row 7: Deduction Amount */}
                    <div className="flex flex-col col-span-2">
                      <label htmlFor="deduction_amount_2631" className="text-[9px] uppercase font-extrabold text-[#991b1b] mb-0.5">Deduction Amount (-)</label>
                      <input id="deduction_amount_2631" name="deduction_amount" aria-label="Deduction Amount (-)"
                        type="number" 
                        step="0.01"
                        className="bg-[#fff1f2] border border-[#fecdd3] rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#991b1b] shadow-2xs focus:outline-none w-full"
                        value={masterData.summary_deduction_amount || ''} 
                        onChange={(e) => handleMasterChange('summary_deduction_amount', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                  </div>
                </div>

                {/* 2. M.R. Valuation Matrix */}
                <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-2xs relative">
                  <div className="inline-block bg-[#f4ece1] border border-[#e5dcce] text-[#2d3748] text-[9.5px] font-extrabold uppercase px-2.5 py-0.5 rounded shadow-2xs mb-2">
                    M.R. VALUATION MATRIX
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                    {/* Row 1 */}
                    <div className="flex flex-col">
                      <label htmlFor="material_value_2649" className="text-[9px] font-bold text-slate-600 mb-0.5">Material Value</label>
                      <input id="material_value_2649" name="material_value" aria-label="Material Value"
                        type="number" 
                        disabled
                        className="bg-[#f1f5f9] border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-900 shadow-2xs w-full"
                        value={masterData.val_material_value.toFixed(2)} 
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="add_amt_2659" className="text-[9px] font-bold text-[#047857] mb-0.5">Add Amt(+)</label>
                      <input id="add_amt_2659" name="add_amt" aria-label="Add Amt(+)"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#047857] shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.val_add_amt || ''} 
                        onChange={(e) => handleMasterChange('val_add_amt', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* Row 2: Val Less Amt(-) with Sauda Checkpoint Deduction details & Why Deduct */}
                    <div className="flex flex-col col-span-1">
                      <div className="group relative flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1">
                          <label htmlFor="val_less_amt_2669" className="text-[9px] font-bold text-slate-600">Val Less Amt(-)</label>
                          <span className="text-[7.5px] font-black bg-[#0f172a] text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
                          <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-64 bg-slate-900 text-white p-2 text-[8.5px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                            <p className="text-amber-300 font-bold">Sauda Checkpoint Deduction</p>
                            <p>Table: <code className="text-cyan-300">sauda_check_point_deductions</code></p>
                            <p>PO Lookup: <code className="text-white">{selectedPoNo || masterData.po_no || 'N/A'}</code></p>
                            {saudaDeductionRecord ? (
                              <>
                                <p>Reason (variation_type): <span className="text-amber-300 font-bold uppercase">{saudaDeductionRecord.variation_type || 'N/A'}</span></p>
                                <p>Deduction Amount: <span className="text-emerald-300 font-bold font-mono">₹{Number(saudaDeductionRecord.deduction_amount || 0).toFixed(2)}</span></p>
                                <p>Quantity: <span className="text-white">{saudaDeductionRecord.deduction_qty_mt} MT / {saudaDeductionRecord.deduction_qty_qtl} Qtl</span></p>
                                <p>Selected Grade: <span className="text-cyan-200">{saudaDeductionRecord.selected_grade || 'Auto'}</span></p>
                                <p className="text-amber-200 text-[7.5px] mt-1 border-t border-slate-700 pt-1 italic">* Applied on Last Final M.R. for this P.O.</p>
                              </>
                            ) : (
                              <p className="text-slate-400 italic">No checkpoint deduction for this M.R. (Sauda deductions apply exclusively to the Last Final M.R.).</p>
                            )}
                          </div>
                        </div>

                        {saudaDeductionRecord && (
                          <span className={cn(
                            "text-[7.5px] font-black px-1.5 py-0.2 rounded uppercase border shrink-0",
                            saudaDeductionRecord.variation_type === 'excess' 
                              ? "bg-amber-100 text-amber-900 border-amber-300" 
                              : saudaDeductionRecord.variation_type === 'short'
                              ? "bg-rose-100 text-rose-900 border-rose-300"
                              : "bg-blue-100 text-blue-900 border-blue-300"
                          )}>
                            {saudaDeductionRecord.variation_type === 'excess' ? 'Excess Wt' : saudaDeductionRecord.variation_type === 'short' ? 'Short Wt' : 'Sauda Checkpoint'}
                          </span>
                        )}
                      </div>

                      <input id="val_less_amt_2669" name="val_less_amt" aria-label="Val Less Amt(-)"
                        type="number" 
                        step="0.01"
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.val_less_amt || ''} 
                        onChange={(e) => handleMasterChange('val_less_amt', parseFloat(e.target.value) || 0)}
                      />

                      {saudaDeductionRecord && (
                        <div className="mt-1 p-1.5 rounded bg-amber-50 border border-amber-200 text-[8.5px] text-amber-950 space-y-0.5">
                          <div className="font-extrabold flex items-center justify-between text-amber-900">
                            <span>Why Deduct:</span>
                            <span className="font-mono text-amber-950 font-black text-[9px]">
                              ₹{Number(saudaDeductionRecord.deduction_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="text-[8px] text-amber-800 font-semibold leading-tight">
                            {saudaDeductionRecord.variation_type === 'excess' 
                              ? 'Excess Weight Settlement Deduction' 
                              : saudaDeductionRecord.variation_type === 'short' 
                              ? 'Short Weight Settlement Deduction' 
                              : 'Sauda Checkpoint Settlement'} 
                            {saudaDeductionRecord.deduction_qty_mt ? ` (${saudaDeductionRecord.deduction_qty_mt} MT / ${(saudaDeductionRecord.deduction_qty_mt * 10).toFixed(2)} Qtl)` : ''}
                            {saudaDeductionRecord.selected_grade ? ` [Grade: ${saudaDeductionRecord.selected_grade}]` : ''}
                          </div>
                          {saudaDeductionRecord.remarks && (
                            <div className="text-[7.5px] italic text-amber-700 truncate">
                              Note: {saudaDeductionRecord.remarks}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1 mb-0.5">
                        <label className="text-[9px] font-bold text-slate-600">Premium Amt (+)</label>
                        <span className="text-[7.5px] font-black bg-[#0f172a] text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-56 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                          <p className="text-yellow-300 font-bold">Total Premium Amount</p>
                          <p>Formula: Premium Rate × Premium WT (Qtl)</p>
                          <p><code className="text-cyan-300">₹{masterData.summary_premium_amount || 0}/Qtl × {(masterData.summary_premium_wt !== undefined && masterData.summary_premium_wt !== null && Number(masterData.summary_premium_wt) > 0 ? masterData.summary_premium_wt : (masterData.summary_less_amount || 0))} Qtl</code></p>
                          <p className="mt-1 pt-1 border-t border-slate-700 text-white font-bold">= ₹{(masterData.val_premium_amt || 0).toFixed(2)}</p>
                        </div>
                      </div>
                      <input id="masterdata_val_premium_am_2688" name="masterdata_val_premium_am" aria-label="masterdata val premium am"
                        type="number" 
                        step="0.01"
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.val_premium_amt || ''} 
                        onChange={(e) => handleMasterChange('val_premium_amt', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* Row 3 */}
                    <div className="flex flex-col">
                      <label htmlFor="ded_claim_total_2699" className="text-[9px] font-bold text-[#991b1b] mb-0.5">Ded Claim Total (-)</label>
                      <input id="ded_claim_total_2699" name="ded_claim_total" aria-label="Ded Claim Total (-)"
                        type="number" 
                        disabled 
                        className="bg-[#fff1f2] border border-[#fecdd3] rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-[#991b1b] shadow-2xs w-full"
                        value={(0).toFixed(2)} 
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="qty_claim_2709" className="text-[9px] font-bold text-slate-600 mb-0.5">Qty Claim</label>
                      <input id="qty_claim_2709" name="qty_claim" aria-label="Qty Claim"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.val_qty_claim || ''} 
                        onChange={(e) => handleMasterChange('val_qty_claim', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* Row 4: Ex/Short */}
                    <div className="flex flex-col">
                      <label htmlFor="ex_short_2719" className="text-[9px] font-bold text-slate-600 mb-0.5">Ex/Short (-)</label>
                      <input id="ex_short_2719" name="ex_short" aria-label="Ex/Short (-)"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.val_ex_short || ''} 
                        onChange={(e) => handleMasterChange('val_ex_short', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                  </div>
                </div>

                {/* 3. Final MR Net Value */}
                <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-2xs relative">
                  <div className="inline-block bg-[#f4ece1] border border-[#e5dcce] text-[#2d3748] text-[9.5px] font-extrabold uppercase px-2.5 py-0.5 rounded shadow-2xs mb-2">
                    FINAL MR NET VALUE
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                    {/* Row 1 */}
                    <div className="flex flex-col">
                      <label htmlFor="less_adv_2736" className="text-[9px] font-bold text-slate-600 mb-0.5">Less Adv (-)</label>
                      <input id="less_adv_2736" name="less_adv" aria-label="Less Adv (-)"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.final_less_adv || ''} 
                        onChange={(e) => handleMasterChange('final_less_adv', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="on_ac_adv_2746" className="text-[9px] font-bold text-slate-600 mb-0.5">On/Ac Adv</label>
                      <input id="on_ac_adv_2746" name="on_ac_adv" aria-label="On/Ac Adv"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        value={masterData.final_on_ac_adv || ''} 
                        onChange={(e) => handleMasterChange('final_on_ac_adv', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* Row 2 */}
                    <div className="flex flex-col">
                      <label htmlFor="apmc_fees_2756" className="text-[9px] font-bold text-slate-600 mb-0.5">APMC Fees</label>
                      <input id="apmc_fees_2756" name="apmc_fees" aria-label="APMC Fees"
                        type="number" 
                        disabled
                        className="bg-[#f1f5f9] border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-900 shadow-2xs w-full"
                        value={((Number(masterData.arival_apmc_fees) || 0) - (Number(masterData.actual_apmc_fees) || 0)).toFixed(2)} 
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="c_s_t_tax_2766" className="text-[9px] font-bold text-slate-600 mb-0.5">C.S.T. (Tax) %</label>
                      <input id="c_s_t_tax_2766" name="c_s_t_tax" aria-label="C.S.T. (Tax) %"
                        type="number" 
                        className="bg-white border border-slate-300 rounded-md px-2 py-1 h-7 text-right font-mono font-bold text-xs text-slate-800 shadow-2xs focus:border-indigo-500 focus:outline-none w-full"
                        placeholder="e.g. 5 for 5%"
                        value={masterData.final_cst_pct_amt || ''} 
                        onChange={(e) => handleMasterChange('final_cst_pct_amt', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                  </div>
                </div>

                {/* 4. Net Settle Outflow Payable */}
                <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-2xs relative">
                  <div className="inline-block bg-[#f4ece1] border border-[#e5dcce] text-[#2d3748] text-[9.5px] font-extrabold uppercase px-2.5 py-0.5 rounded shadow-2xs mb-2">
                    NET SETTLE OUTFLOW PAYABLE
                  </div>

                  <div className="space-y-2 font-bold text-xs">
                    {/* Big Dark Banner */}
                    <div className="bg-[#0b1329] rounded-md p-2.5 text-center border border-slate-800 shadow-inner">
                      <div className="group relative flex items-center justify-center gap-1 mb-0.5">
                        <label className="text-[8.5px] uppercase tracking-wider font-extrabold text-[#00e676]">RESOLVED PAYABLE ACCOUNT</label>
                        <span className="text-[7px] font-black bg-emerald-950 border border-emerald-400 text-emerald-300 rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help">i</span>
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block z-50 w-80 bg-slate-900 text-white p-2.5 text-[8px] rounded-lg border border-slate-700 shadow-xl leading-relaxed font-normal text-left normal-case">
                          <p className="text-yellow-300 font-bold border-b border-slate-700 pb-1 mb-1">Payable Account Formula</p>
                          <p className="font-mono text-cyan-200 leading-tight">
                            RESOLVED PAYABLE ACCOUNT = Material Value + Add Amt(+) + Premium Amt(+) - Deduction Amount(-) - Delivery Claim(-) - Val Less Amt(-) - Ded Claim Total(-) - APMC Fees - Less Adv(-) - On/Ac Adv + CST Tax
                          </p>
                        </div>
                      </div>
                      <div className="text-xl font-black font-mono text-[#00e676] tracking-wide">
                        ₹ {masterData.payable_amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    {/* Bill No & Bill Date - Mandatory Fields */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col">
                        <label htmlFor="bill_no_2798" className="text-[9px] font-bold text-slate-700 mb-0.5 flex items-center justify-between">
                          <span>Bill No. <span className="text-rose-600">*</span></span>
                          <span className="text-rose-500 font-bold text-[8px]">Mandatory</span>
                        </label>
                        <input id="bill_no_2798" name="bill_no" aria-label="Bill No."
                          type="text" 
                          required
                          placeholder="e.g. BILL-101"
                          className={cn(
                            "bg-white border rounded-md px-2 py-1 h-7 font-mono uppercase font-bold text-xs text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-none w-full",
                            !masterData.payable_bill_no && errorMessage.includes("Bill No.") ? "border-rose-500 bg-rose-50/50 ring-1 ring-rose-500" : "border-slate-300"
                          )}
                          value={masterData.payable_bill_no || ''} 
                          onChange={(e) => handleMasterChange('payable_bill_no', e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col">
                        <label htmlFor="bill_date_2807" className="text-[9px] font-bold text-slate-700 mb-0.5 flex items-center justify-between">
                          <span>Bill Date <span className="text-rose-600">*</span></span>
                          <span className="text-rose-500 font-bold text-[8px]">Mandatory</span>
                        </label>
                        <input id="bill_date_2807" name="bill_date" aria-label="Bill Date"
                          type="date" 
                          required
                          className={cn(
                            "bg-white border rounded-md px-2 py-1 h-7 font-mono font-bold text-xs text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-none w-full",
                            !masterData.payable_bill_date && errorMessage.includes("Bill Date") ? "border-rose-500 bg-rose-50/50 ring-1 ring-rose-500" : "border-slate-300"
                          )}
                          value={masterData.payable_bill_date || ''} 
                          onChange={(e) => handleMasterChange('payable_bill_date', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Left Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button 
                    onClick={() => setViewMode('dashboard')}
                    className="bg-white hover:bg-slate-50 border-2 border-slate-700 rounded-md py-2 text-xs font-bold uppercase text-slate-800 tracking-wider shadow-xs transition-all active:scale-[0.98] text-center cursor-pointer"
                  >
                    EXIT GATE
                  </button>
                  <button 
                    onClick={() => handleSaveSettlement(false)}
                    className="bg-[#000080] hover:bg-blue-950 border-2 border-[#000080] rounded-md py-2 text-xs font-bold uppercase text-white tracking-wider shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Save className="h-4 w-4 text-green-300" />
                    SETTLE ACCOUNT
                  </button>
                </div>

              </div>
              
              {/* RIGHT SIDE PANEL: Detailed 4-Column Core Specification Grids */}
              <div className="col-span-12 lg:col-span-8 space-y-3">
                
                {/* Upper Core Header Fields */}
                <LegacyFieldset legend="Basic MR Arrival Identity Records (PO Aligned Checkpoint)">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-bold p-1">
                    {paymentValidationInfo && (
                      <div className="col-span-4 bg-emerald-50 border border-emerald-300 text-emerald-900 px-2 py-1.5 text-[10px] font-bold rounded flex items-center justify-between mb-1">
                        <span>
                          ✓ <strong>Payment Module Validated (`payment_master`)</strong>: MR: {paymentValidationInfo.mrNo} | P.O: {paymentValidationInfo.poNo} | Voucher: {paymentValidationInfo.voucherNo}
                        </span>
                        <span className="font-mono bg-emerald-200 px-1.5 py-0.5 rounded text-emerald-950 font-black">
                          Paid Amount (On/Ac Adv): ₹{paymentValidationInfo.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex flex-col">
                      <label htmlFor="m_r_no_from_final_m_r_2855" className="text-gray-500 text-[8px] uppercase font-black text-rose-900">Inspection No (From Mill Inspection)</label>
                      <SearchableSelect
                        id="m_r_no_from_final_m_r_2855"
                        name="m_r_no_from_final_m_r"
                        value={masterData.mr_no}
                        onChange={(mrVal) => {
                          handleMasterChange('mr_no', mrVal);
                          handleProceedWithMrNo(mrVal);
                        }}
                        options={faOptionsForSelectedPo}
                        placeholder={selectedPoNo ? "-- Select Inspection --" : "-- Select P.O First --"}
                        disabled={!selectedPoNo}
                        compact={true}
                        inputClassName="font-mono font-bold text-rose-800 text-[11px] py-1"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="date_2882" className="text-gray-500 text-[8px] uppercase">Date</label>
                      <input  id="date_2882" name="date" aria-label="Date"
                        type="date" 
                        className="bg-white border border-gray-400 p-1 font-mono text-center"
                        value={masterData.sett_date} 
                        onChange={(e) => handleMasterChange('sett_date', e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col col-span-2">
                      <label htmlFor="p_o_type_2892" className="text-gray-500 text-[8px] uppercase">P.O. Type</label>
                      <input  id="p_o_type_2892" name="p_o_type" aria-label="P.O. Type"
                        type="text" 
                        className="bg-white border border-gray-400 p-1 font-sans "
                        placeholder="e.g. MILL_PO"
                        value={masterData.po_type} 
                        onChange={(e) => handleMasterChange('po_type', e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col col-span-2">
                      <label htmlFor="broker_name_2903" className="text-gray-500 text-[8px] uppercase">Broker Name</label>
                      <input  id="broker_name_2903" name="broker_name" aria-label="Broker Name"
                        type="text" 
                        className="bg-white border border-gray-400 p-1 font-sans text-slate-800"
                        value={masterData.broker} 
                        onChange={(e) => handleMasterChange('broker', e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col col-span-2">
                      <label htmlFor="suppler_name_2913" className="text-gray-500 text-[8px] uppercase">Suppler Name</label>
                      <input  id="suppler_name_2913" name="suppler_name" aria-label="Suppler Name"
                        type="text" 
                        className="bg-white border border-gray-400 p-1 font-sans text-slate-800"
                        value={masterData.supplier} 
                        onChange={(e) => handleMasterChange('supplier', e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col col-span-2">
                      <label htmlFor="chn_supplier_2923" className="text-gray-500 text-[8px] uppercase">Chn..Supplier</label>
                      <input  id="chn_supplier_2923" name="chn_supplier" aria-label="Chn..Supplier"
                        type="text" 
                        className="bg-white border border-gray-400 p-1 font-sans"
                        value={masterData.chn_supplier} 
                        onChange={(e) => handleMasterChange('chn_supplier', e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="p_o_no_from_final_p_o_2933" className="text-gray-500 text-[8px] uppercase font-black text-indigo-900">P.O. No. (From Final P.O)</label>
                      <SearchableSelect
                        id="p_o_no_from_final_p_o_2933"
                        name="p_o_no_from_final_p_o"
                        value={selectedPoNo || masterData.po_no}
                        onChange={(newPo) => handlePoNoSelection(newPo, false)}
                        options={poOptions}
                        placeholder="-- Select Final P.O --"
                        compact={true}
                        inputClassName="font-mono font-bold text-indigo-900 text-[11px] py-1"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="p_o_date_2952" className="text-gray-500 text-[8px] uppercase">P.O Date</label>
                      <input  id="p_o_date_2952" name="p_o_date" aria-label="P.O Date"
                        type="date" 
                        disabled
                        className="bg-slate-150 border border-gray-400 p-1 font-mono text-center"
                        value={masterData.po_date} 
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="lorry_number_2962" className="text-gray-500 text-[8px] uppercase">Lorry Number</label>
                      <input  id="lorry_number_2962" name="lorry_number" aria-label="Lorry Number"
                        type="text" 
                        className="bg-white border border-gray-400 p-1 font-mono uppercase"
                        value={masterData.lorry_number} 
                        onChange={(e) => handleMasterChange('lorry_number', e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="detention_days_2972" className="text-gray-500 text-[8px] uppercase">Detention Days</label>
                      <input  id="detention_days_2972" name="detention_days" aria-label="Detention Days"
                        type="number" 
                        className="bg-white border border-gray-400 p-1 font-mono text-center"
                        value={masterData.detention_days} 
                        onChange={(e) => handleMasterChange('detention_days', parseInt(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="arrival_no_2982" className="text-gray-500 text-[8px] uppercase">Arrival No.</label>
                      <input  id="arrival_no_2982" name="arrival_no" aria-label="Arrival No."
                        type="text" 
                        className="bg-white border border-gray-400 p-1 font-mono"
                        value={masterData.arrival_no} 
                        onChange={(e) => handleMasterChange('arrival_no', e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="arrival_date_2992" className="text-gray-500 text-[8px] uppercase">Arrival Date</label>
                      <input  id="arrival_date_2992" name="arrival_date" aria-label="Arrival Date"
                        type="date" 
                        className="bg-white border border-gray-400 p-1 font-mono text-center"
                        value={masterData.arrival_date} 
                        onChange={(e) => handleMasterChange('arrival_date', e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="actual_apmc_fees_3001" className="text-slate-500 text-[8px] uppercase">Actual APMC Fees</label>
                      <input  id="actual_apmc_fees_3001" name="actual_apmc_fees" aria-label="Actual APMC Fees"
                        type="number" 
                        className="bg-white border border-gray-400 p-1 text-right font-mono"
                        value={masterData.actual_apmc_fees || ''} 
                        onChange={(e) => handleMasterChange('actual_apmc_fees', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="arival_apmc_fees_3010" className="text-slate-500 text-[8px] uppercase">Arival APMC Fees</label>
                      <input  id="arival_apmc_fees_3010" name="arival_apmc_fees" aria-label="Arival APMC Fees"
                        type="number" 
                        className="bg-white border border-gray-400 p-1 text-right font-mono"
                        value={masterData.arival_apmc_fees || ''} 
                        onChange={(e) => handleMasterChange('arival_apmc_fees', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col col-span-2">
                      <label htmlFor="remarks_narration_3020" className="text-slate-500 text-[8px] uppercase">Remarks / Narration</label>
                      <textarea  id="remarks_narration_3020" name="remarks_narration" aria-label="Remarks / Narration"
                        className="bg-white border border-gray-400 p-1 text-xs font-sans h-[35px]"
                        value={masterData.remarks}
                        onChange={(e) => handleMasterChange('remarks', e.target.value)}
                      />
                    </div>

                    {/* Auto-H.O Settlement layout check checkbox */}
                    <div className="flex items-center gap-2 border border-dashed border-gray-400 bg-[#e1dfda] px-2 py-1  col-span-2">
                      <input  name="checkbox" aria-label="checkbox"
                        type="checkbox"
                        id="auto_ho_id"
                        checked={masterData.auto_ho_settlement}
                        onChange={(e) => handleMasterChange('auto_ho_settlement', e.target.checked)}
                        className="h-3.5 w-3.5 text-blue-900 border-gray-400"
                      />
                      <label htmlFor="auto_ho_id" className="text-[10px] font-black uppercase text-gray-700 cursor-pointer">
                        Auto H.O. Settlement Archival
                      </label>
                    </div>

                    {/* 4 Custom Checklist Weight Fields */}
                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1.5 h-4">
                        <label className="text-blue-900 font-extrabold text-[8px] uppercase">Challan Weight (MT)</label>
                        <span className="text-[7.5px] font-black bg-indigo-950 border border-white text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help hover:bg-slate-700">i</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-48 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                          DB Reference: <code className="text-yellow-400 font-mono">m_r_settlement.challan_weight</code>
                          <p className="mt-1">Format: Metric Tons (MT). Weights from supplier invoice / challan form. Must be numeric.</p>
                        </div>
                      </div>
                      <input  id="0_000_3051" name="0_000" aria-label="0.000"
                        type="number" 
                        step="0.001"
                        placeholder="0.000"
                        className="bg-blue-50 border border-blue-300 p-1 font-mono font-bold text-right text-blue-900"
                        value={masterData.challan_weight || ''} 
                        onChange={(e) => handleMasterChange('challan_weight', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1.5 h-4">
                        <label className="text-teal-900 font-extrabold text-[8px] uppercase">Supplier Net Wt (MT)</label>
                        <span className="text-[7.5px] font-black bg-indigo-950 border border-white text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help hover:bg-slate-700">i</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-48 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                          DB Reference: <code className="text-yellow-400 font-mono">m_r_settlement.supplier_net_wt</code>
                          <p className="mt-1">Format: Metric Tons (MT). Net transit weights declared by the dispatching supplier.</p>
                        </div>
                      </div>
                      <input  id="0_000_3070" name="0_000" aria-label="0.000"
                        type="number" 
                        step="0.001"
                        placeholder="0.000"
                        className="bg-teal-50 border border-teal-300 p-1 font-mono font-bold text-right text-teal-950"
                        value={masterData.supplier_net_wt || ''} 
                        onChange={(e) => handleMasterChange('supplier_net_wt', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1.5 h-4">
                        <label className="text-purple-900 font-extrabold text-[8px] uppercase">Electronic Scale Net (MT)</label>
                        <span className="text-[7.5px] font-black bg-indigo-950 border border-white text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help hover:bg-slate-700">i</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-48 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                          DB Reference: <code className="text-yellow-400 font-mono">m_r_settlement.electronic_scale_net</code>
                          <p className="mt-1">Format: Metric Tons (MT). Official weighbridge weight recorded at the jute mill gate.</p>
                        </div>
                      </div>
                      <input  id="0_000_3089" name="0_000" aria-label="0.000"
                        type="number" 
                        step="0.001"
                        placeholder="0.000"
                        className="bg-purple-50 border border-purple-300 p-1 font-mono font-bold text-right text-purple-950"
                        value={masterData.electronic_scale_net || ''} 
                        onChange={(e) => handleMasterChange('electronic_scale_net', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div className="flex flex-col">
                      <div className="group relative flex items-center gap-1.5 h-4">
                        <label className="text-rose-900 font-extrabold text-[8px] uppercase">Payment Status</label>
                        <span className="text-[7.5px] font-black bg-indigo-950 border border-white text-white rounded-full w-3 h-3 inline-flex items-center justify-center font-serif cursor-help hover:bg-slate-700">i</span>
                        <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 w-48 bg-slate-900 text-white p-2 text-[8px] rounded border border-slate-700 shadow-md leading-normal font-normal normal-case">
                          DB Reference: <code className="text-yellow-400 font-mono">m_r_settlement.payment_status</code>
                          <p className="mt-1">Format: ENUM values ("Pending", "Partially Paid", "Approved", "Cleared") matching treasury statuses.</p>
                        </div>
                      </div>
                      <select  id="masterdata_payment_status_3108" name="masterdata_payment_status" aria-label="masterdata payment status"
                        className="bg-rose-50 border border-rose-300 p-1 text-xs font-bold text-rose-900"
                        value={masterData.payment_status || 'Pending'} 
                        onChange={(e) => handleMasterChange('payment_status', e.target.value)}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Partially Paid">Partially Paid</option>
                        <option value="Paid">Paid</option>
                        <option value="Settled">Settled</option>
                      </select>
                    </div>

                  </div>
                </LegacyFieldset>

                {/* Sub-bar: Wt. / Ded.Wt */}
                <div className="bg-[#bce0bc] border-t border-b border-gray-500 p-1.5 flex items-center justify-between gap-4 text-[10px] font-black">
                  <div className="flex items-center gap-2  text-emerald-950">
                    <Scale className="h-4 w-4 shrink-0 text-emerald-900" />
                    <span>Wt. / Ded.Wt. (M.Ton.):</span>
                  </div>
                  <div className="flex gap-2">
                    <input  id="0_000_3130" name="0_000" aria-label="0.000"
                      type="number" 
                      placeholder="0.000"
                      className="w-16 bg-white border border-gray-400 text-right p-0.5 font-mono text-[10px]"
                      value={masterData.wt_ded_wt_1 || ''}
                      onChange={(e) => handleMasterChange('wt_ded_wt_1', parseFloat(e.target.value) || 0)}
                    />
                    <input  id="0_000_3137" name="0_000" aria-label="0.000"
                      type="number" 
                      placeholder="0.000"
                      className="w-16 bg-white border border-gray-400 text-right p-0.5 font-mono text-[10px]"
                      value={masterData.wt_ded_wt_2 || ''}
                      onChange={(e) => handleMasterChange('wt_ded_wt_2', parseFloat(e.target.value) || 0)}
                    />
                    <input  id="0_000_3144" name="0_000" aria-label="0.000"
                      type="number" 
                      placeholder="0.000"
                      className="w-16 bg-white border border-gray-400 text-right p-0.5 font-mono text-[10px]"
                      value={masterData.wt_ded_wt_3 || ''}
                      onChange={(e) => handleMasterChange('wt_ded_wt_3', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  
                  <div className="h-4 w-px bg-emerald-800" />

                  <div className="flex items-center gap-2">
                    <span className="text-gray-700">Rate/m.T</span>
                    <input  id="masterdata_rate_qntl_calc_3157" name="masterdata_rate_qntl_calc" aria-label="masterdata rate qntl calc"
                      type="number" 
                      step="0.01"
                      className="w-20 bg-white border border-gray-400 text-right p-0.5 font-mono text-[10px] font-bold text-slate-900"
                      value={masterData.rate_qntl || calculateWeightedRatePerMT(detailCols) || ''}
                      onChange={(e) => handleMasterChange('rate_qntl', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Grid 1: Vertical Spec Table */}
                <div className="flex items-center justify-between pb-1 px-1">
                  <span className="text-[9.5px] text-gray-600 font-bold uppercase tracking-wider">
                    Settlement Columns {visibleSpecCols.length < 4 ? `(${visibleSpecCols.length} Active with Arr. Wt)` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllSpecCols(!showAllSpecCols)}
                    className="text-[9px] px-2 py-0.5 rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-bold cursor-pointer transition-colors shadow-2xs"
                  >
                    {showAllSpecCols ? 'Hide Unarrived Columns' : 'Show All 4 Columns'}
                  </button>
                </div>
                <div className="bg-white border border-gray-400 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse font-sans text-[10px]">
                    <thead>
                      <tr className="bg-[#e4dfd8] border-b border-gray-400 text-center font-black uppercase text-gray-700">
                        <th className="px-2 py-1.5 border-r border-gray-300 w-24">Grade Spec</th>
                        {visibleSpecCols.map((idx, colPos) => (
                          <th key={idx} className={`px-2 py-1.5 ${colPos < visibleSpecCols.length - 1 ? 'border-r border-gray-300' : ''}`}>
                            Column {idx} {detailCols[idx-1]?.grade ? `(${detailCols[idx-1]?.grade})` : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300 font-bold">
                      
                      {/* Rows corresponding to column specifications */}
                      <tr className="hover:bg-slate-50">
                        <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-500">Grade</td>
                        {visibleSpecCols.map(idx => (
                          <td key={idx} className="p-0.5 border-r border-gray-200">
                            <input  id="grade_name_3186" name="grade_name" aria-label="Grade Name"
                              type="text" 
                              className="w-full bg-transparent p-1 outline-none text-center font-black text-slate-800"
                              placeholder="Grade Name"
                              value={detailCols[idx-1]?.grade || ''}
                              onChange={(e) => handleColChange(idx, 'grade', e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-500">Area</td>
                        {visibleSpecCols.map(idx => (
                          <td key={idx} className="p-0.5 border-r border-gray-200">
                            <input  id="area_3201" name="area" aria-label="Area"
                              type="text" 
                              className="w-full bg-transparent p-1 outline-none text-center"
                              placeholder="Area"
                              value={detailCols[idx-1]?.area || ''}
                              onChange={(e) => handleColChange(idx, 'area', e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-500">Agency</td>
                        {visibleSpecCols.map(idx => (
                          <td key={idx} className="p-0.5 border-r border-gray-200">
                            <input  id="agency_3216" name="agency" aria-label="Agency"
                              type="text" 
                              className="w-full bg-transparent p-1 outline-none text-center"
                              placeholder="Agency"
                              value={detailCols[idx-1]?.agency || ''}
                              onChange={(e) => handleColChange(idx, 'agency', e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-500">Marka/Crop</td>
                        {visibleSpecCols.map(idx => (
                          <td key={idx} className="p-0.5 border-r border-gray-200">
                            <input  id="marka_crop_3231" name="marka_crop" aria-label="Marka/Crop"
                              type="text" 
                              className="w-full bg-transparent p-1 outline-none text-center text-[9px] font-mono"
                              placeholder="Marka/Crop"
                              value={detailCols[idx-1]?.marka_crop || ''}
                              onChange={(e) => handleColChange(idx, 'marka_crop', e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 text-rose-800 uppercase">Quantity (B)</td>
                        {visibleSpecCols.map(idx => (
                          <td key={idx} className="p-0.5 border-r border-gray-200">
                            <input  id="0_3246" name="0" aria-label="0"
                              type="number" 
                              className="w-full bg-transparent p-1 outline-none text-center font-mono font-bold text-rose-800 bg-rose-50/40"
                              placeholder="0"
                              value={detailCols[idx-1]?.quantity || ''}
                              onChange={(e) => handleColChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-500">Arr. Qty/Wt</td>
                        {visibleSpecCols.map(idx => (
                          <td key={idx} className="p-0.5 border-r border-gray-200">
                            <input  id="0_000_3261" name="0_000" aria-label="0.000"
                              type="number" 
                              className="w-full bg-transparent p-1 outline-none text-center font-mono"
                              placeholder="0.000"
                              value={detailCols[idx-1]?.arr_qty_wt || ''}
                              onChange={(e) => handleColChange(idx, 'arr_qty_wt', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-slate-50">
                        <td className="px-2 py-1 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-bold">
                          <div className="flex flex-col">
                            <span>Min.Qty/Wt</span>
                            <span className="text-[7.5px] text-gray-400 font-normal lowercase">(3% acceptable)</span>
                          </div>
                        </td>
                        {visibleSpecCols.map(idx => (
                          <td key={idx} className="p-0.5 border-r border-gray-200">
                            <input  id={`min_qty_wt_${idx}`} name={`min_qty_wt_${idx}`} aria-label={`Min.Qty/Wt Col ${idx}`}
                              type="number" 
                              step="0.001"
                              className="w-full bg-transparent p-1 outline-none text-center font-mono font-bold text-slate-700"
                              placeholder="0.000"
                              value={detailCols[idx-1]?.min_qty_wt || ''}
                              onChange={(e) => handleColChange(idx, 'min_qty_wt', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                      </tr>

                      {/* Intermediate sub-bars */}
                      <tr className="bg-indigo-50/40 hover:bg-indigo-50 font-black">
                        <td className="px-2 py-1 border-r border-gray-200 uppercase text-indigo-900">
                          <div className="flex flex-col">
                            <span>Wt/Quantity</span>
                            <span className="text-[7.5px] text-indigo-700 font-normal lowercase">(Round Kg / Qty)</span>
                          </div>
                        </td>
                        {visibleSpecCols.map(idx => {
                          const col = detailCols[idx-1];
                          const qty = Number(col?.quantity) || 0;
                          const arrWt = Number(col?.arr_qty_wt) || 0;
                          const wtPerQty = qty > 0 && arrWt > 0 
                            ? Math.round((arrWt <= 50 ? arrWt * 1000 : arrWt) / qty) 
                            : (Number(col?.wt_quantity) || Number(col?.wt_phota) || 0);
                          return (
                            <td key={idx} className="p-1 border-r border-gray-200 text-center font-mono font-black text-indigo-950 text-xs">
                              {wtPerQty > 0 ? `${wtPerQty} kg` : '-'}
                            </td>
                          );
                        })}
                      </tr>

                      <tr className="bg-indigo-50/40 hover:bg-slate-50 font-black">
                        <td className="px-2 py-1 border-r border-gray-200 uppercase text-indigo-900 flex items-center gap-1">
                          Recon Rate
                        </td>
                        {visibleSpecCols.map(idx => (
                          <td key={idx} className="p-0.5 border-r border-gray-200">
                            <input  id={`recon_rate_${idx}`} name={`recon_rate_${idx}`} aria-label={`₹ Rate Col ${idx}`}
                              type="number" 
                              className="w-full bg-white text-center p-0.5 font-mono text-indigo-950 font-bold border border-indigo-200 text-[10px]"
                              placeholder="₹ Rate"
                              value={detailCols[idx-1]?.rate_value || ''}
                              onChange={(e) => handleColChange(idx, 'rate_value', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                        ))}
                      </tr>

                      {/* Calculated Column Amount Row */}
                      <tr className="bg-[#eef7f2] hover:bg-[#e2f0e8] font-black border-t border-emerald-300">
                        <td className="px-2 py-1 border-r border-gray-300 uppercase text-emerald-950 font-extrabold flex items-center justify-between text-[10px] bg-[#e2f0e8]">
                          <span>Recon Amount</span>
                          <span className="text-[8.5px] text-emerald-800 font-mono">(₹)</span>
                        </td>
                        {visibleSpecCols.map(idx => {
                          const colAmt = getColAmount(detailCols[idx-1], Number(masterData.rate_qntl) || Number(selectedPoData?.b_rate) || 0);
                          return (
                            <td key={idx} className="p-1 border-r border-gray-300 text-center font-mono font-bold text-emerald-950 text-[11px] bg-[#eef7f2]">
                              ₹{colAmt.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                            </td>
                          );
                        })}
                      </tr>

                    </tbody>
                  </table>
                </div>

                {/* Recon Rate, Rate / m.T & Actual APMC Fees Clean Summary Card */}
                {(() => {
                  const activeColsForCalc = visibleSpecCols;
                  const grandTotal = activeColsForCalc.reduce((sum, idx) => sum + getColAmount(detailCols[idx - 1]), 0);
                  const apmc1Pct = grandTotal * 0.01;
                  const weightedRateMt = calculateWeightedRatePerMT(detailCols);
                  const totalWtMt = activeColsForCalc.reduce((sum, idx) => sum + getColWtMt(detailCols[idx - 1]), 0);

                  return (
                    <div className="mt-2 bg-[#f8fafc] border border-indigo-200 rounded p-2.5 shadow-sm text-slate-800">
                      <div className="flex items-center justify-between border-b border-indigo-100 pb-1.5 mb-2">
                        <div className="flex items-center gap-1.5">
                          <Calculator className="h-3.5 w-3.5 text-indigo-700" />
                          <h4 className="text-[10px] font-extrabold uppercase tracking-wide text-indigo-950">
                            Calculation Breakdown Summary
                          </h4>
                        </div>
                        <span className="text-[8.5px] text-indigo-900 font-mono bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          Rate / m.T = Total Amount ÷ Total Weight ({totalWtMt.toFixed(3)} MT)
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5 text-center text-xs">
                        {activeColsForCalc.map(idx => {
                          const col = detailCols[idx - 1];
                          const colAmt = getColAmount(col);
                          const wt = getColWtMt(col);
                          return (
                            <div key={idx} className="bg-white border border-slate-200 rounded p-1.5 flex flex-col justify-between">
                              <span className="text-[8.5px] font-bold text-slate-500 uppercase">Col {idx} {col?.grade ? `(${col.grade})` : ''} Amt</span>
                              <span className="my-0.5 font-mono font-bold text-slate-900 text-xs">
                                ₹{colAmt.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                              </span>
                              <span className="text-[7.5px] text-slate-500 font-mono">
                                {wt.toFixed(3)} MT
                              </span>
                            </div>
                          );
                        })}

                        <div className="bg-[#eef7f2] border border-emerald-300 rounded p-1.5 flex flex-col justify-between">
                          <span className="text-[8.5px] font-black text-emerald-900 uppercase">Grand Total</span>
                          <span className="my-0.5 font-mono font-black text-emerald-950 text-xs">
                            ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                          </span>
                          <span className="text-[7.5px] text-emerald-700 font-mono">Sum of Recon Amts</span>
                        </div>

                        <div className="bg-[#eef4ff] border border-blue-300 rounded p-1.5 flex flex-col justify-between">
                          <span className="text-[8.5px] font-black text-blue-900 uppercase">Rate / m.T</span>
                          <span className="my-0.5 font-mono font-black text-blue-950 text-xs">
                            ₹{weightedRateMt.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[7.5px] text-blue-700 font-mono">Weighted / MT</span>
                        </div>

                        <div className="bg-[#fffbeb] border border-amber-300 rounded p-1.5 flex flex-col justify-between">
                          <span className="text-[8.5px] font-black text-amber-900 uppercase">Actual APMC Fees</span>
                          <span className="my-0.5 font-mono font-black text-amber-950 text-xs">
                            ₹{apmc1Pct.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-[7.5px] text-amber-700 font-mono">
                            1% of Total
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Grid 2: Claims Subdivided Grid Layout */}
                <LegacyFieldset legend="Active Deductions / Claims Audit Sheet (Moisture, Dust, Grade Down, NCV & L.Dely claims)">
                  <div className="flex items-center justify-between pb-1 px-1">
                    <span className="text-[9.5px] text-gray-600 font-bold uppercase tracking-wider">
                      {visibleDeductionCols.length > 0
                        ? `Audit Columns (${visibleDeductionCols.length} Active with Claim > 0)`
                        : 'No columns with active claims (Total Claim = 0)'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAllDeductionCols(!showAllDeductionCols)}
                      className="text-[9px] px-2 py-0.5 rounded border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-bold cursor-pointer transition-colors shadow-2xs"
                    >
                      {showAllDeductionCols ? 'Hide 0% Claim Columns' : 'Show All Columns to Edit Claims'}
                    </button>
                  </div>

                  {visibleDeductionCols.length === 0 ? (
                    <div className="p-4 text-center bg-slate-50 border border-gray-300 rounded text-slate-500 text-xs">
                      <p className="font-semibold text-gray-600 mb-1">All columns currently have Total Claim = 0.00% (No Deductions).</p>
                      <p className="text-[11px] text-gray-400">Columns with 0 claim are hidden. Click below if you need to view or manually enter deduction percentages.</p>
                      <button
                        type="button"
                        onClick={() => setShowAllDeductionCols(true)}
                        className="mt-2 text-xs px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded border border-rose-300 font-bold cursor-pointer transition-colors"
                      >
                        Show All Columns to Enter Claims
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-400 overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          
                          {/* Major divided column headers */}
                          <tr className="bg-[#ffd2ce] border-b border-gray-400 font-extrabold uppercase text-[#dc2626] text-center">
                            <th className="px-2 py-1.5 border-r border-gray-300 w-28 text-[10px]">Deductions</th>
                            {visibleDeductionCols.map(idx => (
                              <th key={idx} colSpan={3} className="px-2 py-1.5 border-r border-gray-300 text-[10.5px]">
                                Col {idx} - {detailCols[idx-1]?.grade || 'Empty Spec'}
                              </th>
                            ))}
                          </tr>

                          {/* Minor divided column subheaders */}
                          <tr className="bg-[#fff1f0] border-b border-gray-400 font-black uppercase text-gray-700 text-[9px] text-center">
                            <th className="px-1.5 py-1 border-r border-gray-300">Metric</th>
                            {visibleDeductionCols.map(idx => (
                              <React.Fragment key={idx}>
                                <th className="px-1 py-1 border-r border-gray-200 text-rose-850 font-bold">Claim (%)</th>
                                <th className="px-1 py-1 border-r border-gray-200 text-blue-900 font-bold">SETT (%)</th>
                                <th className="px-1 py-1 border-r border-gray-300 text-emerald-800 font-extrabold bg-emerald-50/60">Final (%)</th>
                              </React.Fragment>
                            ))}
                          </tr>

                        </thead>
                        <tbody className="divide-y divide-gray-300 font-black text-center font-mono">
                          
                          {/* Row 1: Grade Down */}
                          <tr className="hover:bg-slate-50">
                            <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold">Grade Down (%)</td>
                            {visibleDeductionCols.map(idx => {
                              const gdVal = Number(detailCols[idx-1]?.gd_sett) > 0 ? Number(detailCols[idx-1]?.gd_sett) : Number(detailCols[idx-1]?.gd_claim || 0);
                              return (
                                <React.Fragment key={idx}>
                                  <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_gd_claim`} name={`detailcols_${idx}_gd_claim`} aria-label={`detailcols ${idx} gd claim`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-slate-900 text-[10.5px] p-0.5 focus:bg-amber-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.gd_claim || ''} onChange={(e) => handleColChange(idx, 'gd_claim', parseFloat(e.target.value) || 0)} /></td>
                                  <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_gd_sett`} name={`detailcols_${idx}_gd_sett`} aria-label={`detailcols ${idx} gd sett`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-blue-900 text-[10.5px] p-0.5 focus:bg-blue-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.gd_sett ?? 0} onChange={(e) => handleColChange(idx, 'gd_sett', parseFloat(e.target.value) || 0)} /></td>
                                  <td className="p-1 border-r border-gray-300 text-emerald-800 bg-emerald-50/40 font-black text-[10.5px]">{gdVal.toFixed(1)}%</td>
                                </React.Fragment>
                              );
                            })}
                          </tr>

                          {/* Row 2: Moisture */}
                          <tr className="hover:bg-slate-50">
                            <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold">Moisture (%)</td>
                            {visibleDeductionCols.map(idx => {
                              const mVal = Number(detailCols[idx-1]?.moist_sett) > 0 ? Number(detailCols[idx-1]?.moist_sett) : Number(detailCols[idx-1]?.moist_claim || 0);
                              return (
                                <React.Fragment key={idx}>
                                  <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_moist_claim`} name={`detailcols_${idx}_moist_claim`} aria-label={`detailcols ${idx} moist claim`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-slate-900 text-[10.5px] p-0.5 focus:bg-amber-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.moist_claim || ''} onChange={(e) => handleColChange(idx, 'moist_claim', parseFloat(e.target.value) || 0)} /></td>
                                  <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_moist_sett`} name={`detailcols_${idx}_moist_sett`} aria-label={`detailcols ${idx} moist sett`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-blue-900 text-[10.5px] p-0.5 focus:bg-blue-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.moist_sett ?? 0} onChange={(e) => handleColChange(idx, 'moist_sett', parseFloat(e.target.value) || 0)} /></td>
                                  <td className="p-1 border-r border-gray-300 text-emerald-800 bg-emerald-50/40 font-black text-[10.5px]">{mVal.toFixed(2)}%</td>
                                </React.Fragment>
                              );
                            })}
                          </tr>

                          {/* Row 3: Dust */}
                          <tr className="hover:bg-slate-50">
                            <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold">Dust (%)</td>
                            {visibleDeductionCols.map(idx => {
                              const dVal = Number(detailCols[idx-1]?.dust_sett) > 0 ? Number(detailCols[idx-1]?.dust_sett) : Number(detailCols[idx-1]?.dust_claim || 0);
                              return (
                                <React.Fragment key={idx}>
                                  <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_dust_claim`} name={`detailcols_${idx}_dust_claim`} aria-label={`detailcols ${idx} dust claim`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-slate-900 text-[10.5px] p-0.5 focus:bg-amber-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.dust_claim || ''} onChange={(e) => handleColChange(idx, 'dust_claim', parseFloat(e.target.value) || 0)} /></td>
                                  <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_dust_sett`} name={`detailcols_${idx}_dust_sett`} aria-label={`detailcols ${idx} dust sett`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-blue-900 text-[10.5px] p-0.5 focus:bg-blue-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.dust_sett ?? 0} onChange={(e) => handleColChange(idx, 'dust_sett', parseFloat(e.target.value) || 0)} /></td>
                                  <td className="p-1 border-r border-gray-300 text-emerald-800 bg-emerald-50/40 font-black text-[10.5px]">{dVal.toFixed(2)}%</td>
                                </React.Fragment>
                              );
                            })}
                          </tr>

                          {/* Row 4: NCV */}
                          <tr className="hover:bg-slate-50">
                            <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold">NCV (%)</td>
                            {visibleDeductionCols.map(idx => {
                              const nVal = Number(detailCols[idx-1]?.ncv_sett) > 0 ? Number(detailCols[idx-1]?.ncv_sett) : Number(detailCols[idx-1]?.ncv_claim || 0);
                              return (
                                <React.Fragment key={idx}>
                                  <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_ncv_claim`} name={`detailcols_${idx}_ncv_claim`} aria-label={`detailcols ${idx} ncv claim`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-slate-900 text-[10.5px] p-0.5 focus:bg-amber-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.ncv_claim || ''} onChange={(e) => handleColChange(idx, 'ncv_claim', parseFloat(e.target.value) || 0)} /></td>
                                  <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_ncv_sett`} name={`detailcols_${idx}_ncv_sett`} aria-label={`detailcols ${idx} ncv sett`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-blue-900 text-[10.5px] p-0.5 focus:bg-blue-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.ncv_sett ?? 0} onChange={(e) => handleColChange(idx, 'ncv_sett', parseFloat(e.target.value) || 0)} /></td>
                                  <td className="p-1 border-r border-gray-300 text-emerald-800 bg-emerald-50/40 font-black text-[10.5px]">{nVal.toFixed(2)}%</td>
                                </React.Fragment>
                              );
                            })}
                          </tr>

                          {/* Row 5: Late dely */}
                          <tr className="hover:bg-slate-50">
                            <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold leading-none">PO/Grade/A/L.Dely (Amt)</td>
                            {visibleDeductionCols.map(idx => {
                              const poVal = Number(detailCols[idx-1]?.po_grade_sett) > 0 ? Number(detailCols[idx-1]?.po_grade_sett) : Number(detailCols[idx-1]?.po_grade_claim || 0);
                              return (
                                <React.Fragment key={idx}>
                                  <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_po_grade_claim`} name={`detailcols_${idx}_po_grade_claim`} aria-label={`detailcols ${idx} po grade claim`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-slate-900 text-[10.5px] p-0.5 focus:bg-amber-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.po_grade_claim || ''} onChange={(e) => handleColChange(idx, 'po_grade_claim', parseFloat(e.target.value) || 0)} /></td>
                                  <td className="p-1 border-r border-gray-200"><input  id={`detailcols_${idx}_po_grade_sett`} name={`detailcols_${idx}_po_grade_sett`} aria-label={`detailcols ${idx} po grade sett`} type="number" step="0.1" className="w-full text-center bg-transparent outline-none font-bold text-blue-900 text-[10.5px] p-0.5 focus:bg-blue-50 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={detailCols[idx-1]?.po_grade_sett ?? 0} onChange={(e) => handleColChange(idx, 'po_grade_sett', parseFloat(e.target.value) || 0)} /></td>
                                  <td className="p-1 border-r border-gray-300 text-emerald-800 bg-emerald-50/40 font-black text-[10.5px]">{poVal.toFixed(1)}</td>
                                </React.Fragment>
                              );
                            })}
                          </tr>

                          {/* Text remarks input row */}
                          <tr className="hover:bg-slate-50">
                            <td className="px-2 py-1.5 border-r border-gray-200 bg-slate-100 uppercase text-gray-600 font-sans text-[9px] text-left font-bold">Remarks</td>
                            {visibleDeductionCols.map(idx => (
                              <td key={idx} colSpan={3} className="p-1 border-r border-gray-300">
                                <input  id={`audit_remarks_${idx}`} name={`audit_remarks_${idx}`} aria-label="Audit remarks..."
                                  type="text" 
                                  className="w-full bg-transparent p-0.5 outline-none font-sans font-medium text-left px-2 text-[9.5px]"
                                  placeholder="Audit remarks..."
                                  value={detailCols[idx-1]?.remark || ''}
                                  onChange={(e) => handleColChange(idx, 'remark', e.target.value)}
                                />
                              </td>
                            ))}
                          </tr>

                          {/* Settled Claims sum row: Total Claim = Grade Down (%) + Moisture (%) + Dust (%) + NCV (%) */}
                          <tr className="bg-rose-50/70 hover:bg-rose-100">
                            <td className="px-2 py-1.5 border-r border-gray-200 text-red-900 uppercase font-sans text-[9px] text-left font-bold">Total Claim</td>
                            {visibleDeductionCols.map(idx => {
                              const col = detailCols[idx-1];
                              const isColActive = (Number(col?.quantity) || 0) > 0 || (Number(col?.arr_qty_wt) || 0) > 0 || (Number(col?.wt_quantity) || 0) > 0;
                              const gdVal = Number(col?.gd_sett) > 0 ? Number(col?.gd_sett) : Number(col?.gd_claim || 0);
                              const mVal = Number(col?.moist_sett) > 0 ? Number(col?.moist_sett) : Number(col?.moist_claim || 0);
                              const dVal = Number(col?.dust_sett) > 0 ? Number(col?.dust_sett) : Number(col?.dust_claim || 0);
                              const nVal = Number(col?.ncv_sett) > 0 ? Number(col?.ncv_sett) : Number(col?.ncv_claim || 0);
                              const totalClaimVal = gdVal + mVal + dVal + nVal;
                              return (
                                <td key={idx} colSpan={3} className="px-2 py-1.5 border-r border-gray-300 text-center font-black text-red-700 bg-red-100/50 text-[11px]">
                                  {isColActive ? `${totalClaimVal.toFixed(2)}%` : '0.0%'}
                                </td>
                              );
                            })}
                          </tr>

                        </tbody>
                      </table>
                    </div>
                  )}
                </LegacyFieldset>


              </div>

            </div>

          </div>
        </LegacyLayout>
      )}

      {/* View Settlement Modal (Table Type Statement) */}
      {showViewModal && viewModalData && (
        <PrintModal
          isOpen={showViewModal}
          onClose={() => {
            setShowViewModal(false);
            setViewModalData(null);
          }}
          title={`SETTLEMENT STATEMENT - M.R. #${viewModalData.master.mr_no || 'N/A'}`}
        >
          <div id="print-modal-children-canvas" className="p-6 bg-white text-slate-900 font-sans space-y-4">
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-3 text-center">
              <h2 className="text-xl font-black tracking-wide text-[#2a3088] uppercase">BALLY JUTE COMPANY LIMITED</h2>
              <p className="text-[11px] text-slate-600 font-medium">P.O. BALLY, DIST: HOWRAH, WEST BENGAL - 711201</p>
              <div className="inline-block mt-2 bg-slate-900 text-white text-xs font-black uppercase px-4 py-1 tracking-wider rounded-xs">
                M.R. SETTLEMENT & QUALITY AUDIT STATEMENT
              </div>
            </div>

            {/* Top Summary Info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 bg-slate-50 border border-slate-300 p-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">M.R. Number</span>
                <span className="font-mono font-black text-rose-700 text-sm">{viewModalData.master.mr_no || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Settlement Date</span>
                <span className="font-bold">{viewModalData.master.sett_date || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Purchase Order No</span>
                <span className="font-mono font-bold text-blue-800">{viewModalData.master.po_no || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Lorry / Vehicle No</span>
                <span className="font-mono font-bold">{viewModalData.master.lorry_number || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Moisture (%)</span>
                <span className="font-mono font-black text-blue-900">{Number(viewModalData.master.summary_rate_wt_claim || 0) > 0 ? `${Number(viewModalData.master.summary_rate_wt_claim).toFixed(2)}%` : '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Supplier Name</span>
                <span className="font-bold text-slate-800 uppercase">{viewModalData.master.supplier || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Broker Name</span>
                <span className="font-bold text-slate-700">{viewModalData.master.broker || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Bill No & Date</span>
                <span className="font-mono">{viewModalData.master.payable_bill_no ? `${viewModalData.master.payable_bill_no} (${viewModalData.master.payable_bill_date || '-'})` : '-'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Payment Status</span>
                <span className="font-bold uppercase text-emerald-700">{viewModalData.master.payment_status || 'Settled'}</span>
              </div>
            </div>

            {/* Quality & Grade Specification Table */}
            <div className="space-y-1">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
                1. Material Quality & Specification Breakdown
              </h4>
              <div className="border border-slate-300 overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-[10px] font-black uppercase text-slate-700">
                      <th className="p-1.5 border-r border-slate-300">Col #</th>
                      <th className="p-1.5 border-r border-slate-300">Grade</th>
                      <th className="p-1.5 border-r border-slate-300">Area</th>
                      <th className="p-1.5 border-r border-slate-300">Agency</th>
                      <th className="p-1.5 border-r border-slate-300">Marka</th>
                      <th className="p-1.5 border-r border-slate-300 text-center">Moisture (%)</th>
                      <th className="p-1.5 border-r border-slate-300 text-right">Quantity</th>
                      <th className="p-1.5 border-r border-slate-300 text-right">Weight (MT)</th>
                      <th className="p-1.5 border-r border-slate-300 text-right">Rate (₹/Qtl)</th>
                      <th className="p-1.5 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {viewModalData.details.filter(c => (Number(c.quantity) > 0 || Number(c.arr_qty_wt) > 0 || Number(c.rate_value) > 0)).map((col, idx) => {
                      const wtMt = getColWtMt(col);
                      const amt = getColAmount(col);
                      const moistVal = Number(col.moist_sett) > 0 ? Number(col.moist_sett) : Number(col.moist_claim || 0);
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-1.5 border-r border-slate-200 font-bold">{col.col_index || idx + 1}</td>
                          <td className="p-1.5 border-r border-slate-200 font-bold text-blue-900">{resolveGradeName(col.grade)}</td>
                          <td className="p-1.5 border-r border-slate-200">{col.area || '-'}</td>
                          <td className="p-1.5 border-r border-slate-200">{col.agency || '-'}</td>
                          <td className="p-1.5 border-r border-slate-200">{col.marka_crop || '-'}</td>
                          <td className="p-1.5 border-r border-slate-200 text-center font-mono font-bold text-blue-950">
                            {moistVal > 0 ? `${moistVal.toFixed(2)}%` : (Number(viewModalData.master.summary_rate_wt_claim) > 0 ? `${Number(viewModalData.master.summary_rate_wt_claim).toFixed(2)}%` : '-')}
                          </td>
                          <td className="p-1.5 border-r border-slate-200 text-right font-mono">{col.quantity || 0}</td>
                          <td className="p-1.5 border-r border-slate-200 text-right font-mono font-bold">{wtMt.toFixed(3)}</td>
                          <td className="p-1.5 border-r border-slate-200 text-right font-mono">₹{Number(col.rate_value || 0).toFixed(2)}</td>
                          <td className="p-1.5 text-right font-mono font-black text-slate-900">₹{amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DEDUCTION BREAKDOWN (TABLE TYPE - MATCHING USER SCREENSHOT) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between border-b border-slate-300 pb-1">
                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                  2. Deduction Breakdown
                </h4>
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  Inspection Deductions & Penalties
                </span>
              </div>
              
              {/* Exact Table Card Style as User Screenshot */}
              <div className="border border-[#cbd5e1] rounded-lg overflow-hidden bg-white shadow-xs">
                <table className="w-full text-xs text-left border-collapse font-sans">
                  <thead>
                    <tr className="bg-[#eef3f9] border-b-2 border-[#2563eb] text-[11px] font-black uppercase text-slate-800 tracking-wider">
                      <th className="py-2.5 px-4 border-r border-[#cbd5e1] text-left w-7/12">
                        DEDUCTION TYPE
                      </th>
                      <th className="py-2.5 px-4 border-r border-[#cbd5e1] text-center w-3/12">
                        DEDUCTION RATE (₹)
                      </th>
                      <th className="py-2.5 px-4 text-center w-2/12">
                        QTY
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#cbd5e1]">
                    {(() => {
                      const deds = (viewModalData.master.deductions && Array.isArray(viewModalData.master.deductions))
                        ? viewModalData.master.deductions.filter((d: any) => d && ((d.deduction_type && !String(d.deduction_type).includes('-- SELECT')) || Number(d.deduction_rate) > 0 || Number(d.deduction_amount) > 0))
                        : [];

                      if (deds.length === 0) {
                        return (
                          <tr>
                            <td colSpan={3} className="py-3.5 px-4 text-center text-xs font-semibold text-slate-400 italic bg-slate-50/40">
                              No Deductions or Penalties Applied (₹0.00)
                            </td>
                          </tr>
                        );
                      }

                      return deds.map((dItem, dIdx) => {
                        const rate = Number(dItem.deduction_rate) || 0;
                        const qty = Number(dItem.deduction_qty) || (rate > 0 ? 1 : 0);

                        return (
                          <tr key={dIdx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 border-r border-[#cbd5e1] font-bold text-xs text-slate-900 uppercase">
                              {dItem.deduction_type || '-'}
                            </td>
                            <td className="py-3 px-4 border-r border-[#cbd5e1] text-center font-mono font-bold text-xs text-slate-900">
                              ₹{rate}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-xs text-slate-900">
                              {qty}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 border-t border-[#cbd5e1] font-bold text-xs text-slate-700">
                      <td className="py-2 px-4 border-r border-[#cbd5e1] text-right font-black uppercase text-[10px] text-slate-600">
                        Total Deduction Subtracted (-):
                      </td>
                      <td colSpan={2} className="py-2 px-4 text-center font-mono font-black text-xs text-[#991b1b]">
                        ₹ {Number(viewModalData.master.summary_deduction_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Financial Summary & Payable Calculation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 border border-slate-300 p-3 rounded-xs text-xs">
              <div className="space-y-1.5">
                <p className="font-black text-slate-700 uppercase text-[10px] border-b border-slate-200 pb-1">Valuation Calculations</p>
                <div className="flex justify-between">
                  <span className="text-slate-600">Material Value (+):</span>
                  <span className="font-mono font-bold">₹ {Number(viewModalData.master.val_material_value || viewModalData.master.summary_material_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Additional Charges (+):</span>
                  <span className="font-mono font-bold">₹ {Number(viewModalData.master.val_add_amt || viewModalData.master.summary_misc_add || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Premium Amount (+):</span>
                  <span className="font-mono font-bold text-emerald-700">₹ {Number(viewModalData.master.val_premium_amt || viewModalData.master.summary_premium_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Quality Claims & Deductions (-):</span>
                  <span className="font-mono font-bold text-rose-700">₹ {Number(viewModalData.master.summary_deduction_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="space-y-1.5 md:border-l md:border-slate-300 md:pl-4">
                <p className="font-black text-slate-700 uppercase text-[10px] border-b border-slate-200 pb-1">Final Settlement Outflow</p>
                <div className="flex justify-between">
                  <span className="text-slate-600">Less Advance (-):</span>
                  <span className="font-mono font-bold">₹ {Number(viewModalData.master.final_less_adv || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">On Account Advance (-):</span>
                  <span className="font-mono font-bold">₹ {Number(viewModalData.master.final_on_ac_adv || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">APMC Fees (-):</span>
                  <span className="font-mono font-bold">₹ {Number(viewModalData.master.final_apmc_fees || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t border-slate-300 text-sm">
                  <span className="font-black uppercase text-slate-900">Net Payable Amount:</span>
                  <span className="font-mono font-black text-emerald-800">₹ {Number(viewModalData.master.payable_amt || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* Signature Area */}
            <div className="pt-6 grid grid-cols-2 gap-12 text-center text-xs font-bold text-slate-700">
              <div className="border-t border-slate-400 pt-1">Prepared By</div>
              <div className="border-t border-slate-400 pt-1">Quality Inspector</div>
            </div>
          </div>
        </PrintModal>
      )}

      {/* PO Audit Limit Overwrite Confirmation Modal */}
      {showAuditOverwriteModal && auditOverwriteInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-2xl border-2 border-amber-500 max-w-lg w-full overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-amber-500 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm uppercase tracking-wider">
                <AlertTriangle className="h-5 w-5 text-white animate-bounce" />
                <span>Audit Block Override Confirmation</span>
              </div>
              <button 
                type="button"
                onClick={() => setShowAuditOverwriteModal(false)}
                className="text-white hover:text-amber-100 font-bold text-lg leading-none cursor-pointer"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Body Content */}
            <div className="p-4 space-y-3 text-slate-800 text-xs">
              <div className="bg-amber-50 border border-amber-300 rounded p-3 space-y-1.5">
                <p className="font-bold text-amber-950 text-sm">
                  Settlement weight exceeds PO pending received balance limit.
                </p>
                <p className="text-amber-800 text-xs leading-relaxed">
                  The calculated pending received limit for this PO is smaller than the current settlement weight. Review the comparative values below:
                </p>
              </div>

              {/* Data comparison grid */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-200 p-3 rounded text-xs">
                <div>
                  <span className="text-gray-500 text-[10px] uppercase font-bold block">Purchase Order No:</span>
                  <span className="font-mono font-bold text-slate-900">{auditOverwriteInfo.selectedPoNo}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] uppercase font-bold block">M.R Number:</span>
                  <span className="font-mono font-bold text-rose-700">{auditOverwriteInfo.targetMrNo || masterData.mr_no || 'N/A'}</span>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-gray-500 text-[10px] uppercase font-bold block">Calculated Pending Limit:</span>
                  <span className="font-mono font-extrabold text-blue-700 text-sm">{auditOverwriteInfo.allowedWeight.toFixed(3)} MT</span>
                </div>
                <div className="bg-white p-2 rounded border border-amber-300 bg-amber-50/50">
                  <span className="text-amber-800 text-[10px] uppercase font-bold block">Current Settlement Weight:</span>
                  <span className="font-mono font-extrabold text-rose-700 text-sm">{auditOverwriteInfo.activeWeight.toFixed(3)} MT</span>
                </div>
                <div className="col-span-2 bg-rose-50 border border-rose-200 p-2 rounded flex justify-between items-center">
                  <span className="text-rose-800 font-bold text-[11px]">Weight Overage / Excess:</span>
                  <span className="font-mono font-black text-rose-900 text-sm">
                    +{(auditOverwriteInfo.activeWeight - auditOverwriteInfo.allowedWeight).toFixed(3)} MT
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-600 bg-slate-100 p-2.5 rounded border border-slate-200 leading-normal">
                <span className="font-bold text-slate-800">Overwrite Authorization Action:</span> Clicking <strong>&quot;Overwrite &amp; Save&quot;</strong> will bypass the audit threshold, finalize the settlement in the database, and mark the associated Purchase Order &amp; Material Arrival records as settled.
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-100 px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAuditOverwriteModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold rounded text-xs uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancel &amp; Review
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSaveSettlement(true);
                }}
                disabled={loading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-black rounded text-xs uppercase tracking-wider shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{loading ? "Saving..." : "Overwrite & Save"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
