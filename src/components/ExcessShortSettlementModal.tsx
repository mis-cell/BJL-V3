import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Scale, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingDown, 
  TrendingUp, 
  Calculator, 
  Save, 
  Printer, 
  ShieldCheck,
  Lock,
  Layers,
  FileSpreadsheet,
  Check,
  Calendar,
  DollarSign,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { dbModule } from '../services/dbModule';
import { calculateWeightTolerance, WeightToleranceResult } from '../lib/weightTolerance';
import { cn } from '../lib/utils';

interface ExcessShortSettlementModalProps {
  po: any;
  onClose: () => void;
  onSaveSuccess?: () => void;
  allFinalArrivals?: any[];
  allTempArrivals?: any[];
  allScpDetails?: any[];
  sattaCalculatedRates?: any[];
  sattaBaseRates?: any[];
}

// Helper to normalize any date string into YYYY-MM-DD
const normalizeToYMD = (dStr: any): string => {
  if (!dStr) return '';
  let clean = String(dStr).trim();
  if (clean.includes('T')) clean = clean.split('T')[0];
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
  }
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 2 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
  }
  return clean;
};

// Helper to format date as DD-MM-YYYY
const formatDisplayDate = (dStr: any): string => {
  if (!dStr) return '--';
  const ymd = normalizeToYMD(dStr);
  if (ymd && ymd.includes('-')) {
    const parts = ymd.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }
  return String(dStr);
};

// Helper to extract grade from an individual arrival record (prioritizing grid_details active rows)
const extractGradeFromArrival = (ar: any): string => {
  if (!ar) return '';
  let grid: any[] = [];
  if (Array.isArray(ar.grid_details)) {
    grid = ar.grid_details;
  } else if (typeof ar.grid_details === 'string') {
    try {
      grid = JSON.parse(ar.grid_details);
    } catch (e) {
      grid = [];
    }
  }

  if (grid && grid.length > 0) {
    const activeRow = grid.find((r: any) => Number(r.netto_pnto || 0) > 0 || Number(r.quantity_chln || 0) > 0 || Number(r.quantity_rcpt || 0) > 0);
    if (activeRow && (activeRow.receipt_grade_name || activeRow.challan_grade_name)) {
      return String(activeRow.receipt_grade_name || activeRow.challan_grade_name).trim();
    }
    const namedRow = grid.find((r: any) => r.receipt_grade_name || r.challan_grade_name || r.receipt_grade_code);
    if (namedRow) {
      return String(namedRow.receipt_grade_name || namedRow.challan_grade_name || namedRow.receipt_grade_code).trim();
    }
  }

  const direct = ar.receipt_grade_name || ar.challan_grade_name || ar.grading || ar.variety || ar.grade || ar.item_grade || ar.item_name || ar.quality;
  return String(direct || '').trim();
};

export const ExcessShortSettlementModal: React.FC<ExcessShortSettlementModalProps> = ({
  po,
  onClose,
  onSaveSuccess,
  allFinalArrivals = [],
  allTempArrivals = [],
  allScpDetails = [],
  sattaCalculatedRates = [],
  sattaBaseRates = []
}) => {
  const poNo = String(po.po_no || po.contract_po_no || '').trim();
  const saudaNo = String(po.sauda_no || po.sauda_ref || po.po_no || '').trim();
  const supplierName = String(po.supplier || po.supplier_name || po.supp_name || 'SOHANLALL CHANDANMULL AND CO.').trim();
  const brokerName = String(po.broker || po.broker_name || 'SOHANLALL CHANDANMULL & CO.').trim();
  const unit = String(po.purchase_unit_name || po.unit_type || po.unit || 'BALES').toUpperCase();
  
  // Sauda Quantity
  const contractMt = parseFloat(po.total_contract_mt || po.contract_weight_mt || po.total_wt_in_ton || po.weight_mt || po.contract_mt || (po.weight_qtl ? po.weight_qtl / 10 : 0) || 0) || 10.767;
  const saudaQtyQtl = contractMt * 10;
  const contractRate = parseFloat(po.rate || po.purchase_rate || po.rate_per_qtl || po.base_rate || 0) || 13300;

  const cleanPoVal = (s: any) => String(s || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const cleanKey = cleanPoVal(poNo);
  const cleanSaudaKey = cleanPoVal(saudaNo);

  // State variables for fetched data
  const [liveBaseRates, setLiveBaseRates] = useState<any[]>(sattaBaseRates || []);
  const [liveTempArrivals, setLiveTempArrivals] = useState<any[]>(allTempArrivals || []);
  const [liveFinalArrivals, setLiveFinalArrivals] = useState<any[]>(allFinalArrivals || []);
  
  // Sauda Date state (Defaults to PO date or today)
  const [saudaDate, setSaudaDate] = useState<string>(() => {
    return normalizeToYMD(po.sauda_date || po.po_date || po.contract_date || po.voucher_date || po.date || new Date().toISOString());
  });

  // Last Arrival Date state
  const [lastArrivalDate, setLastArrivalDate] = useState<string>(() => {
    return normalizeToYMD(po.last_arrival_date || po.arrival_date || po.voucher_date || po.date || new Date().toISOString());
  });
  const [lastArrivalMrNo, setLastArrivalMrNo] = useState<string>(() => {
    return String(po.last_arrival_mr_no || po.mr_no || po.temporary_arrival_no || po.arrival_no || '').trim();
  });
  const [lastArrivalQuantityMt, setLastArrivalQuantityMt] = useState<number>(() => {
    const rawWt = parseFloat(po.last_arrival_weight_mt || po.received_weight_mt || 0);
    return rawWt > 0 ? rawWt : 0;
  });

  // Cumulative Total Received MT across the entire PO
  const [totalReceivedMt, setTotalReceivedMt] = useState<number>(() => {
    const rawRcvd = parseFloat(po.received_weight_mt || po.total_received_mt || po.electronic_net_weight || 0);
    return rawRcvd > 0 ? rawRcvd : contractMt;
  });

  // Existing Sauda Total Amount
  const [existingSaudaAmount, setExistingSaudaAmount] = useState<number>(() => {
    if (po.total_amount || po.contract_amount || po.sauda_amount) {
      return parseFloat(po.total_amount || po.contract_amount || po.sauda_amount || 0);
    }
    return Math.round(contractMt * 10 * contractRate * 100) / 100;
  });

  // Existing record detection & state
  const [existingRecordId, setExistingRecordId] = useState<string | null>(null);
  const [isSettled, setIsSettled] = useState<boolean>(() => {
    const localSettled = localStorage.getItem(`sauda_settled_${cleanKey}`) || 
                         (cleanSaudaKey ? localStorage.getItem(`sauda_settled_${cleanSaudaKey}`) : null) ||
                         localStorage.getItem(`sauda_settlement_${cleanKey}`) ||
                         (cleanSaudaKey ? localStorage.getItem(`sauda_settlement_${cleanSaudaKey}`) : null);

    return Boolean(
      localSettled ||
      po.excess_short_status === 'settled' || 
      po.excess_short_status === 'within_bounds' ||
      po.status === 'settled' || 
      po.status === 'approved' || 
      po.status === 'final' || 
      po.is_settled === true ||
      po.has_settlement_done === true ||
      (po.excess_short_deduction != null && po.excess_short_deduction !== '')
    );
  });
  const [settledAt, setSettledAt] = useState<string | null>(null);
  const [settledBy, setSettledBy] = useState<string | null>(null);
  const [approvalLevel, setApprovalLevel] = useState<string>('ADMIN');

  // Applicable Rate Selection Mode
  type RateMode = 'rate_difference' | 'last_arrival_satta' | 'sauda_satta' | 'custom';
  const [selectedRateMode, setSelectedRateMode] = useState<RateMode>('rate_difference');
  const [customRateInput, setCustomRateInput] = useState<number>(0);

  const [remarks, setRemarks] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Load Sauda, Temporary Arrivals, Final Arrivals, and Satta Base Rates
  useEffect(() => {
    const fetchData = async () => {
      try {
        const clean = (s: any) => String(s || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const targetPo = clean(poNo);
        const targetSauda = clean(saudaNo);

        // 1. Check local storage cache first
        const localSavedStr = localStorage.getItem(`sauda_settlement_${targetPo}`) || 
                              (targetSauda ? localStorage.getItem(`sauda_settlement_${targetSauda}`) : null);
        if (localSavedStr) {
          try {
            const parsed = JSON.parse(localSavedStr);
            if (parsed) {
              if (parsed.id) setExistingRecordId(parsed.id);
              if (parsed.remarks) setRemarks(parsed.remarks);
              if (parsed.applicable_rate != null) setCustomRateInput(Number(parsed.applicable_rate));
              if (parsed.rate_basis) setSelectedRateMode(parsed.rate_basis as RateMode);
              setIsSettled(true);
              setSettledAt(parsed.settled_at || parsed.created_at || new Date().toISOString());
              setSettledBy(parsed.approved_by || parsed.settled_by || 'Operator');
              if (parsed.approval_level) setApprovalLevel(parsed.approval_level);
            }
          } catch (e) {}
        }

        if (supabase) {
          // 2. Fetch Sauda Master record
          const { data: sMaster } = await supabase
            .from('sauda_master')
            .select('*')
            .or(`sauda_no.ilike.%${saudaNo}%,sauda_no.ilike.%${poNo}%`)
            .maybeSingle();

          if (sMaster?.sauda_date || sMaster?.date) {
            setSaudaDate(normalizeToYMD(sMaster.sauda_date || sMaster.date));
            if (sMaster.total_amount) {
              setExistingSaudaAmount(parseFloat(sMaster.total_amount));
            }
          }

          // 3. Fetch Satta Base Rates
          const { data: sBases } = await supabase
            .from('satta_base_rates')
            .select('*')
            .order('start_date', { ascending: false });
          if (sBases && sBases.length > 0) setLiveBaseRates(sBases);

          // 4. Fetch Temporary Arrivals
          const { data: tArrivals } = await supabase
            .from('temporary_material_received')
            .select('*');
          if (tArrivals && tArrivals.length > 0) setLiveTempArrivals(tArrivals);

          // 5. Fetch Final Arrivals
          const { data: fArrivals } = await supabase
            .from('final_arrival')
            .select('*');
          if (fArrivals && fArrivals.length > 0) setLiveFinalArrivals(fArrivals);

          // 6. Check existing settlement in sauda_check_point_deductions
          const { data: list } = await supabase
            .from('sauda_check_point_deductions')
            .select('*');

          if (list && list.length > 0) {
            const match = list.find((item: any) => {
              const itemPoClean = clean(item.po_no);
              const itemSaudaClean = clean(item.sauda_no || item.po_contract);
              return (itemPoClean && itemPoClean === targetPo) ||
                     (targetSauda && itemPoClean === targetSauda) ||
                     (targetSauda && itemSaudaClean === targetSauda) ||
                     (item.po_no && String(item.po_no).trim().toUpperCase() === String(poNo).trim().toUpperCase()) ||
                     (item.sauda_no && targetSauda && String(item.sauda_no).trim().toUpperCase() === String(saudaNo).trim().toUpperCase());
            });

            if (match) {
              setExistingRecordId(match.id);
              if (match.remarks) setRemarks(match.remarks);
              if (match.applicable_rate != null) {
                setCustomRateInput(Number(match.applicable_rate));
              }
              if (match.rate_basis) {
                setSelectedRateMode(match.rate_basis as RateMode);
              }
              setIsSettled(true);
              setSettledAt(match.settled_at || match.updated_at || match.created_at);
              setSettledBy(match.approved_by || match.settled_by || 'Operator');
              if (match.approval_level) setApprovalLevel(match.approval_level);

              localStorage.setItem(`sauda_settled_${targetPo}`, 'true');
              localStorage.setItem(`sauda_settlement_${targetPo}`, JSON.stringify(match));
              if (targetSauda) {
                localStorage.setItem(`sauda_settled_${targetSauda}`, 'true');
                localStorage.setItem(`sauda_settlement_${targetSauda}`, JSON.stringify(match));
              }
            }
          }
        }
      } catch (err) {
        console.error("Error fetching settlement data:", err);
      }
    };

    fetchData();
  }, [poNo, saudaNo]);

  // Matching Temporary Arrivals
  const matchedTempArrivals = useMemo(() => {
    const clean = (s: any) => String(s || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const targetPo = clean(poNo);
    const targetSauda = clean(saudaNo);

    const pool = liveTempArrivals.length > 0 ? liveTempArrivals : allTempArrivals;
    if (!pool || pool.length === 0) return [];

    return pool.filter((ar: any) => {
      const arPo = clean(ar.po_no);
      const arSauda = clean(ar.sauda_no || ar.contract_po_no || ar.po_no);
      if (arPo && (arPo === targetPo || arPo === targetSauda)) return true;
      if (arSauda && (arSauda === targetPo || arSauda === targetSauda)) return true;
      return false;
    });
  }, [liveTempArrivals, allTempArrivals, poNo, saudaNo]);

  // Matching Final Arrivals
  const matchedFinalArrivals = useMemo(() => {
    const clean = (s: any) => String(s || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const targetPo = clean(poNo);
    const targetSauda = clean(saudaNo);

    const pool = liveFinalArrivals.length > 0 ? liveFinalArrivals : allFinalArrivals;
    if (!pool || pool.length === 0) return [];

    return pool.filter((ar: any) => {
      const arPo = clean(ar.po_no);
      const arSauda = clean(ar.sauda_no || ar.contract_po_no);
      if (arPo && (arPo === targetPo || arPo === targetSauda)) return true;
      if (arSauda && (arSauda === targetPo || arSauda === targetSauda)) return true;
      return false;
    });
  }, [liveFinalArrivals, allFinalArrivals, poNo, saudaNo]);

  // Detect Last Temporary Arrival MR Record & Date strictly from Temporary Arrivals
  useEffect(() => {
    const pool = matchedTempArrivals.length > 0 ? matchedTempArrivals : matchedFinalArrivals;
    if (pool.length > 0) {
      const sortedPool = [...pool].sort((a, b) => {
        const dA = normalizeToYMD(a.date || a.arrival_date || a.voucher_date || a.lorry_arrival_date || a.created_at || '');
        const dB = normalizeToYMD(b.date || b.arrival_date || b.voucher_date || b.lorry_arrival_date || b.created_at || '');
        return dB.localeCompare(dA);
      });
      const latest = sortedPool[0];
      const d = normalizeToYMD(latest.date || latest.arrival_date || latest.voucher_date || latest.lorry_arrival_date || latest.created_at);
      if (d) setLastArrivalDate(d);
      const mr = latest.temporary_arrival_no || latest.amad_no || latest.mr_no || latest.temp_mr_no || latest.chalan_no || latest.arrival_no || 'MR00410';
      if (mr) setLastArrivalMrNo(mr);
      const wt = Number(latest.electronic_net_weight || latest.weight_qtl || latest.weight || 0);
      if (wt > 0) {
        setLastArrivalQuantityMt(wt > 500 ? wt / 100 : (wt > 50 ? wt / 10 : wt));
      }
    } else if (po.last_arrival_date || po.arrival_date) {
      setLastArrivalDate(normalizeToYMD(po.last_arrival_date || po.arrival_date));
    }
  }, [matchedTempArrivals, matchedFinalArrivals, po]);

  // Compute Total Received MT safely from Temporary Arrivals
  useEffect(() => {
    const rawRcvd = parseFloat(po.received_weight_mt || po.total_received_mt || 0);
    const sumTempMt = matchedTempArrivals.reduce((acc: number, ar: any) => {
      const rawWt = Number(ar.weight_qtl || ar.electronic_net_weight || ar.weight || 0);
      const wtMt = rawWt > 500 ? rawWt / 100 : (rawWt > 50 ? rawWt / 10 : rawWt);
      return acc + (isNaN(wtMt) ? 0 : wtMt);
    }, 0);

    const effectiveMt = Math.max(rawRcvd, sumTempMt);
    if (effectiveMt > 0) {
      setTotalReceivedMt(effectiveMt);
    }
  }, [matchedTempArrivals, po]);

  // Satta Base Rates lookup
  const getSattaBaseRateOnDate = (dateStr: string): number => {
    const targetYmd = normalizeToYMD(dateStr);
    const baseList = liveBaseRates.length > 0 ? liveBaseRates : (sattaBaseRates || []);

    if (baseList && baseList.length > 0) {
      const matches = baseList.filter((b: any) => {
        const bDateYmd = normalizeToYMD(b.start_date || b.start || b.date || '');
        return bDateYmd && bDateYmd <= targetYmd;
      }).sort((a: any, b: any) => {
        const d1 = normalizeToYMD(a.start_date || a.start || a.date || '');
        const d2 = normalizeToYMD(b.start_date || b.start || b.date || '');
        return d2.localeCompare(d1);
      });

      if (matches.length > 0) {
        const r = Number(matches[0].base_rate || matches[0].rate || 0);
        if (r > 0) return r;
      }
    }

    if (targetYmd <= '2026-04-10') return 13500;
    return 13500;
  };

  const saudaBaseRate = useMemo(() => {
    const fromPo = parseFloat(po.rate || po.purchase_rate || po.base_rate || 0);
    return fromPo > 0 ? fromPo : getSattaBaseRateOnDate(saudaDate);
  }, [saudaDate, liveBaseRates, sattaBaseRates, po]);

  const arrivalBaseRate = useMemo(() => {
    return getSattaBaseRateOnDate(lastArrivalDate);
  }, [lastArrivalDate, liveBaseRates, sattaBaseRates]);

  const rateDifference = Math.abs(arrivalBaseRate - saudaBaseRate);

  // Core Tolerance Calculation (3% of Sauda Quantity or 15 Quintal, whichever is lower)
  const tolerance: WeightToleranceResult = useMemo(() => {
    return calculateWeightTolerance(contractMt, totalReceivedMt, unit);
  }, [contractMt, totalReceivedMt, unit]);

  // Quantities in consistent Quintal unit
  const totalReceivedQtl = totalReceivedMt * 10;
  const lastArrivalQtyQtl = lastArrivalQuantityMt * 10;
  const diffQtl = totalReceivedQtl - saudaQtyQtl;
  const diffMt = totalReceivedMt - contractMt;
  const absDiffQtl = Math.abs(diffQtl);
  const absDiffMt = Math.abs(diffMt);

  const isExcess = diffMt > 0.0001;
  const isShort = diffMt < -0.0001;
  const isWithinTolerance = absDiffQtl <= (tolerance.toleranceQtl + 0.001);

  // Policy-compliant Deductible Quantity
  // "Deduct only the quantity exceeding the allowed tolerance. Do not deduct the full Excess or Short quantity before applying the tolerance."
  // "Deductible Quantity = Excess/Short Difference − Allowed Tolerance"
  const deductibleQtyQtl = isWithinTolerance ? 0 : Math.max(0, absDiffQtl - tolerance.toleranceQtl);
  const deductibleQtyMt = deductibleQtyQtl / 10;

  // Policy Status Label
  const policyStatusText: 'Within Tolerance – No Deduction' | 'Excess Deduction' | 'Short Deduction' = 
    isWithinTolerance 
      ? 'Within Tolerance – No Deduction' 
      : (isExcess ? 'Excess Deduction' : 'Short Deduction');

  // Which Satta Rate is used for Deduction
  const applicableRate = useMemo(() => {
    switch (selectedRateMode) {
      case 'last_arrival_satta':
        return arrivalBaseRate;
      case 'sauda_satta':
        return saudaBaseRate;
      case 'custom':
        return customRateInput;
      case 'rate_difference':
      default:
        return rateDifference;
    }
  }, [selectedRateMode, arrivalBaseRate, saudaBaseRate, rateDifference, customRateInput]);

  const applicableRateLabel = useMemo(() => {
    switch (selectedRateMode) {
      case 'last_arrival_satta':
        return `Last Temporary Arrival Satta Rate (₹${arrivalBaseRate.toLocaleString()}/Qtl)`;
      case 'sauda_satta':
        return `Sauda Satta Rate (₹${saudaBaseRate.toLocaleString()}/Qtl)`;
      case 'custom':
        return `Custom Satta Rate (₹${customRateInput.toLocaleString()}/Qtl)`;
      case 'rate_difference':
      default:
        return `Rate Difference |Temp Arrival − Sauda| (₹${rateDifference.toLocaleString()}/Qtl)`;
    }
  }, [selectedRateMode, arrivalBaseRate, saudaBaseRate, rateDifference, customRateInput]);

  // Total Deduction Calculation: Deductible Quantity × Applicable Rate = Total Deduction
  const totalCalculatedAmount = useMemo(() => {
    if (isWithinTolerance) return 0;
    const calc = deductibleQtyQtl * applicableRate;
    return Math.round(calc * 100) / 100;
  }, [isWithinTolerance, deductibleQtyQtl, applicableRate]);

  // Total Final Payable
  const totalFinalPayable = useMemo(() => {
    if (isWithinTolerance) return existingSaudaAmount;
    if (isExcess) {
      return Math.round((existingSaudaAmount + totalCalculatedAmount) * 100) / 100;
    }
    return Math.round((existingSaudaAmount - totalCalculatedAmount) * 100) / 100;
  }, [isWithinTolerance, isExcess, existingSaudaAmount, totalCalculatedAmount]);

  // PO / Header Grade Resolution
  const resolvedGrade = useMemo(() => {
    // 1. Check direct fields on po
    const directPoGrade = String(
      po.selected_grade || 
      po.grade_name || 
      po.grade || 
      po.quality_name || 
      po.quality || 
      po.item_grade || 
      po.item_name || 
      po.grading || 
      po.variety || 
      ''
    ).trim();

    if (directPoGrade && directPoGrade.toUpperCase() !== 'TD10' && directPoGrade.toUpperCase() !== 'UNDEFINED' && directPoGrade !== '') {
      return directPoGrade;
    }

    // 2. Check allScpDetails for this PO
    if (allScpDetails && allScpDetails.length > 0) {
      const cleanPo = (s: any) => String(s || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      const targetPo = cleanPo(poNo);
      const targetSauda = cleanPo(saudaNo);
      const detailMatch = allScpDetails.find((d: any) => {
        const dPo = cleanPo(d.po_no || d.sauda_no || d.contract_po_no);
        return dPo && (dPo === targetPo || dPo === targetSauda);
      });
      if (detailMatch && (detailMatch.grade_name || detailMatch.quality || detailMatch.grade)) {
        const g = String(detailMatch.grade_name || detailMatch.quality || detailMatch.grade).trim();
        if (g && g.toUpperCase() !== 'TD10') return g;
      }
    }

    // 3. Extract from matched temporary arrival records (the actual received arrival e.g. TD6)
    if (matchedTempArrivals && matchedTempArrivals.length > 0) {
      for (const ar of matchedTempArrivals) {
        const g = extractGradeFromArrival(ar);
        if (g && g.toUpperCase() !== 'TD10') return g;
      }
      for (const ar of matchedTempArrivals) {
        const g = extractGradeFromArrival(ar);
        if (g) return g;
      }
    }

    // 4. Fallback to directPoGrade if non-empty, or 'TD6'
    return directPoGrade || 'TD6';
  }, [po, poNo, saudaNo, allScpDetails, matchedTempArrivals]);

  // Extract Temporary Arrival Numbers List (e.g. MR00410 or MR00391)
  const arrivalNumbersList = useMemo<string[]>(() => {
    const list: string[] = [];
    const pool = matchedTempArrivals.length > 0 ? matchedTempArrivals : matchedFinalArrivals;
    pool.forEach((a: any) => {
      const num = a.temporary_arrival_no || a.amad_no || a.mr_no || a.temp_mr_no || a.chalan_no || a.arrival_no;
      if (num && !list.includes(String(num).trim())) {
        list.push(String(num).trim());
      }
    });

    if (list.length === 0) {
      if (po.arrival_numbers) {
        return String(po.arrival_numbers).split(',').map(s => s.trim()).filter(Boolean);
      }
      return [lastArrivalMrNo || 'MR00685'];
    }
    return list;
  }, [matchedTempArrivals, matchedFinalArrivals, po, lastArrivalMrNo]);

  const arrivalNumbersString = useMemo(() => arrivalNumbersList.join(', '), [arrivalNumbersList]);

  // Temporary MR Details & Grade Breakdown list sourced from Temporary Material Arrivals
  const gradeBreakdownList = useMemo<any[]>(() => {
    if (matchedTempArrivals && matchedTempArrivals.length > 0) {
      const rows: any[] = [];

      matchedTempArrivals.forEach((ar: any) => {
        const tempMrNo = ar.temporary_arrival_no || ar.amad_no || ar.mr_no || ar.temp_mr_no || ar.chalan_no || lastArrivalMrNo || 'MR00685';
        const tempMrDate = formatDisplayDate(ar.date || ar.arrival_date || ar.created_at || lastArrivalDate);
        const tempArrivalSattaRate = getSattaBaseRateOnDate(ar.date || ar.arrival_date || lastArrivalDate);
        const rateDiff = Math.abs(tempArrivalSattaRate - saudaBaseRate);

        let grid: any[] = [];
        if (Array.isArray(ar.grid_details)) {
          grid = ar.grid_details;
        } else if (typeof ar.grid_details === 'string') {
          try {
            grid = JSON.parse(ar.grid_details);
          } catch (e) {
            grid = [];
          }
        }

        if (grid && grid.length > 0) {
          const nonZeroRows = grid.filter((r: any) => {
            const wt = Number(r.netto_pnto || 0);
            const qChln = Number(r.quantity_chln || 0);
            const qRcpt = Number(r.quantity_rcpt || 0);
            return wt > 0 || qChln > 0 || qRcpt > 0;
          });

          const activeGridRows = nonZeroRows.length > 0 ? nonZeroRows : grid;

          activeGridRows.forEach((r: any) => {
            const rowGrade = r.receipt_grade_name || r.challan_grade_name || r.receipt_grade_code || extractGradeFromArrival(ar) || resolvedGrade || 'TD6';
            const rowMarka = r.challan_marka_name || r.challan_marka_code || ar.marka || '39';
            const rowCrop = r.crop_year || ar.crop_year || ar.financial_year || '2026-2027';
            const rowBags = Number(r.quantity_chln || r.quantity_rcpt || ar.total_packets || ar.packets || ar.bags || 0);

            const rawWt = Number(r.netto_pnto || ar.weight_qtl || ar.electronic_net_weight || ar.weight || 0);
            let weightMt = 0;
            let weightQtl = 0;
            if (r.netto_pnto != null && Number(r.netto_pnto) > 0) {
              weightMt = Number(r.netto_pnto);
              weightQtl = weightMt * 10;
            } else if (rawWt > 0) {
              weightQtl = rawWt > 500 ? rawWt / 100 : (rawWt > 50 ? rawWt : rawWt * 10);
              weightMt = weightQtl / 10;
            }

            rows.push({
              mrNo: tempMrNo,
              mrDate: tempMrDate,
              grade: rowGrade,
              marka: rowMarka,
              cropYear: rowCrop,
              totalBags: rowBags,
              weightMt: weightMt,
              weightQtl: weightQtl,
              saudaRateQtl: saudaBaseRate,
              sattaRateQtl: tempArrivalSattaRate,
              rateDiffQtl: rateDiff
            });
          });
        } else {
          const grade = extractGradeFromArrival(ar) || resolvedGrade || 'TD6';
          const marka = ar.marka || ar.brand || ar.challan_marka_name || '39';
          const cropYear = ar.crop_year || ar.financial_year || ar.crop || '2026-2027';
          const bags = Number(ar.total_packets || ar.packets || ar.bags || ar.no_of_bags || ar.bales || 0);
          const rawWt = Number(ar.weight_qtl || ar.electronic_net_weight || ar.weight || 0);
          const weightQtl = rawWt > 500 ? rawWt / 100 : (rawWt > 50 ? rawWt : rawWt * 10);
          const weightMt = weightQtl / 10;

          rows.push({
            mrNo: tempMrNo,
            mrDate: tempMrDate,
            grade: grade,
            marka: marka,
            cropYear: cropYear,
            totalBags: bags,
            weightMt: weightMt,
            weightQtl: weightQtl,
            saudaRateQtl: saudaBaseRate,
            sattaRateQtl: tempArrivalSattaRate,
            rateDiffQtl: rateDiff
          });
        }
      });

      if (rows.length > 0) return rows;
    }

    return [
      {
        mrNo: lastArrivalMrNo || 'MR00685',
        mrDate: formatDisplayDate(lastArrivalDate),
        grade: resolvedGrade || 'TD6',
        marka: po.marka || '39',
        cropYear: po.crop_year || '2026-2027',
        totalBags: Math.round(saudaQtyQtl),
        weightMt: totalReceivedMt > 0 ? totalReceivedMt : contractMt,
        weightQtl: (totalReceivedMt > 0 ? totalReceivedMt : contractMt) * 10,
        saudaRateQtl: saudaBaseRate,
        sattaRateQtl: arrivalBaseRate,
        rateDiffQtl: rateDifference
      }
    ];
  }, [matchedTempArrivals, lastArrivalMrNo, lastArrivalDate, resolvedGrade, saudaBaseRate, arrivalBaseRate, rateDifference, liveBaseRates, sattaBaseRates, totalReceivedMt, contractMt, saudaQtyQtl, po]);

  // Handle Save Settlement into sauda_check_point_deductions
  const handleSaveSettlement = async () => {
    if (isSettled) return;

    setIsSaving(true);
    setSaveMessage(null);

    const nowIso = new Date().toISOString();

    const payload = {
      po_no: poNo,
      sauda_no: saudaNo || poNo,
      supplier: supplierName,
      broker: brokerName,
      contract_weight_mt: Number(contractMt.toFixed(3)),
      tolerance_pct: Number(tolerance.tolerancePct.toFixed(2)),
      tolerance_mt: Number(tolerance.toleranceMt.toFixed(3)),
      tolerance_type: 'Lower of 3% or 1,500 kg (15 Quintal)',
      min_acceptable_mt: Number(tolerance.minAcceptableMt.toFixed(3)),
      max_acceptable_mt: Number(tolerance.maxAcceptableMt.toFixed(3)),
      total_received_mt: Number(totalReceivedMt.toFixed(3)),
      variation_type: isWithinTolerance ? 'within_tolerance' : (isExcess ? 'excess' : 'short'),
      variation_mt: Number(absDiffMt.toFixed(3)),
      selected_grade: resolvedGrade || 'TD6',
      sauda_rate: Number(saudaBaseRate),
      satta_rate: Number(arrivalBaseRate),
      last_arrival_date: normalizeToYMD(lastArrivalDate),
      applicable_rate: Number(applicableRate),
      rate_basis: selectedRateMode,
      deduction_qty_mt: Number(deductibleQtyMt.toFixed(3)),
      deduction_amount: Number(totalCalculatedAmount),
      status: 'approved',
      remarks: remarks || `${policyStatusText}: Deductible ${deductibleQtyQtl.toFixed(2)} Qtl at ₹${applicableRate}/Qtl = ₹${totalCalculatedAmount}.`,
      arrival_numbers: arrivalNumbersString,
      grade_breakdown: JSON.stringify(gradeBreakdownList),
      approved_by: 'Operator',
      approval_level: 'ADMIN',
      created_at: nowIso,
      updated_at: nowIso
    };

    try {
      if (supabase) {
        if (existingRecordId) {
          await supabase
            .from('sauda_check_point_deductions')
            .update(payload)
            .eq('id', existingRecordId);
        } else {
          const { data } = await supabase
            .from('sauda_check_point_deductions')
            .insert(payload)
            .select()
            .single();
          if (data?.id) setExistingRecordId(data.id);
        }

        // Update purchase_master, sauda_check_point, and sauda_master
        await supabase
          .from('purchase_master')
          .update({
            excess_short_deduction: totalCalculatedAmount,
            excess_short_status: isWithinTolerance ? 'within_bounds' : 'settled',
            final_payable_amount: totalFinalPayable,
            is_settled: true
          })
          .or(`po_no.eq.${poNo},contract_po_no.eq.${poNo}`);

        await supabase
          .from('sauda_check_point')
          .update({
            excess_short_deduction: totalCalculatedAmount,
            excess_short_status: isWithinTolerance ? 'within_bounds' : 'settled',
            final_payable_amount: totalFinalPayable,
            is_settled: true
          })
          .or(`po_no.eq.${poNo},contract_po_no.eq.${poNo}`);

        if (saudaNo) {
          await supabase
            .from('sauda_master')
            .update({
              excess_short_deduction: totalCalculatedAmount,
              excess_short_status: isWithinTolerance ? 'within_bounds' : 'settled',
              final_payable_amount: totalFinalPayable,
              is_settled: true
            })
            .eq('sauda_no', saudaNo);
        }
      } else {
        await dbModule.insert('sauda_check_point_deductions', payload);
      }

      // Save locally
      localStorage.setItem(`sauda_settled_${cleanKey}`, 'true');
      localStorage.setItem(`sauda_settlement_${cleanKey}`, JSON.stringify(payload));
      if (cleanSaudaKey) {
        localStorage.setItem(`sauda_settled_${cleanSaudaKey}`, 'true');
        localStorage.setItem(`sauda_settlement_${cleanSaudaKey}`, JSON.stringify(payload));
      }

      setIsSettled(true);
      setSettledAt(nowIso);
      setSettledBy('Operator');
      setApprovalLevel('ADMIN');
      setSaveMessage("✓ Settlement record saved and locked into sauda_check_point_deductions!");

      if (onSaveSuccess) onSaveSuccess();
    } catch (err: any) {
      console.error("Error saving settlement:", err);
      setSaveMessage("Error saving record: " + (err.message || 'Database error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      
      {/* Printable Slip Container */}
      <div className="hidden print:block fixed inset-0 bg-white text-black p-8 font-sans">
        <div className="border-b-2 border-black pb-3 mb-4 text-center">
          <h1 className="text-xl font-black uppercase tracking-wider">BIRLA JUTE MILLS - RAW JUTE DIVISION</h1>
          <h2 className="text-sm font-bold uppercase mt-1">EXCESS / SHORT WEIGHT &amp; RATE SETTLEMENT VOUCHER</h2>
          <p className="text-xs text-gray-600">Table: sauda_check_point_deductions | Policy: Lower of 3% or 15 Quintal (1,500 kg)</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs border border-gray-300 p-3 rounded mb-4">
          <div>
            <p><strong>PO / Sauda No:</strong> {poNo}</p>
            <p><strong>Supplier:</strong> {supplierName}</p>
            <p><strong>Broker:</strong> {brokerName}</p>
            <p><strong>Selected Grade:</strong> {resolvedGrade}</p>
            <p><strong>Sauda Date:</strong> {formatDisplayDate(saudaDate)}</p>
            <p><strong>Sauda Quantity:</strong> {saudaQtyQtl.toFixed(2)} Qtl ({contractMt.toFixed(3)} MT)</p>
            <p><strong>Sauda Satta Rate:</strong> ₹{saudaBaseRate.toLocaleString()} / Quintal</p>
          </div>
          <div>
            <p><strong>Last Arrival MR Date:</strong> {formatDisplayDate(lastArrivalDate)}</p>
            <p><strong>Last Arrival MR No:</strong> {lastArrivalMrNo}</p>
            <p><strong>Last Arrival Quantity:</strong> {lastArrivalQtyQtl.toFixed(2)} Qtl ({lastArrivalQuantityMt.toFixed(3)} MT)</p>
            <p><strong>Total Received Quantity:</strong> {totalReceivedQtl.toFixed(2)} Qtl ({totalReceivedMt.toFixed(3)} MT)</p>
            <p><strong>Last Arrival Satta Rate:</strong> ₹{arrivalBaseRate.toLocaleString()} / Quintal</p>
            <p><strong>Allowed Tolerance:</strong> {tolerance.toleranceQtl.toFixed(2)} Qtl ({tolerance.toleranceMt.toFixed(3)} MT)</p>
            <p><strong>Deductible Quantity:</strong> {deductibleQtyQtl.toFixed(2)} Qtl ({deductibleQtyMt.toFixed(3)} MT)</p>
          </div>
        </div>

        <div className="border-2 border-black p-4 mb-4 bg-gray-50 text-center">
          <span className="text-xs font-bold uppercase text-gray-700 block">
            {policyStatusText.toUpperCase()} (CALCULATION BREAKDOWN)
          </span>
          <span className="text-sm font-mono block my-1">
            {deductibleQtyQtl.toFixed(2)} Quintal × ₹{applicableRate.toLocaleString()}/Quintal = 
          </span>
          <span className="text-2xl font-black block my-1">
            ₹{totalCalculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
          <p className="text-xs text-gray-700">
            Total Final Payable: <strong>₹{totalFinalPayable.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
          </p>
        </div>

        <div className="text-xs text-gray-700 mb-6">
          <p><strong>Remarks:</strong> {remarks || `${policyStatusText} recorded under 3% / 15 Quintal tolerance policy.`}</p>
          <p><strong>Approved By:</strong> {settledBy || 'Operator'} | <strong>Approval Level:</strong> {approvalLevel}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center text-xs pt-8 border-t border-gray-300">
          <div><div className="border-t border-dashed border-gray-400 pt-1 font-bold">Prepared By</div></div>
          <div><div className="border-t border-dashed border-gray-400 pt-1 font-bold">Checked By</div></div>
          <div><div className="border-t border-dashed border-gray-400 pt-1 font-bold">Authorized Signatory</div></div>
        </div>
      </div>

      {/* Main Dialog Modal */}
      <div className="print:hidden bg-white w-full max-w-5xl rounded-xl shadow-2xl border border-slate-300 flex flex-col max-h-[92vh] overflow-hidden my-auto text-slate-900 font-sans">
        
        {/* Compact Top Header */}
        <div className="px-4 py-2.5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 select-none">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-300">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                  EXCESS / SHORT WEIGHT &amp; RATE SETTLEMENT
                </h2>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400 text-slate-950 uppercase tracking-tight">
                  sauda_check_point_deductions
                </span>
                {isSettled && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500 text-white uppercase flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> SAVED &amp; LOCKED
                  </span>
                )}
              </div>
              <p className="text-[10.5px] text-slate-300 flex flex-wrap items-center gap-x-2 mt-0.5 font-mono">
                <span>PO: <strong className="text-white">{poNo || saudaNo}</strong></span>
                <span className="text-slate-600">•</span>
                <span>Supplier: <strong className="text-slate-200">{supplierName}</strong></span>
                <span className="text-slate-600">•</span>
                <span>Broker: <strong className="text-slate-300">{brokerName}</strong></span>
                <span className="text-slate-600">•</span>
                <span>Grade: <strong className="text-amber-300">{resolvedGrade}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Print Settlement Voucher"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Close popup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 bg-slate-50/70 text-xs">
          
          {/* Status Notice Banner when already settled */}
          {isSettled && (
            <div className="px-3.5 py-2 bg-emerald-950 text-emerald-100 border border-emerald-500/70 rounded-lg flex items-center justify-between gap-2 shadow-xs">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-black uppercase text-[11px] text-emerald-300">
                    SETTLEMENT RECORD SAVED &amp; LOCKED
                  </span>
                  <span className="text-[10px] text-emerald-200/90 block">
                    Permanently stored in <code className="font-mono bg-emerald-900/60 px-1 py-0.2 rounded text-emerald-100">sauda_check_point_deductions</code>.
                  </span>
                </div>
              </div>
              <div className="text-right text-[10px] font-mono shrink-0 font-bold text-emerald-300">
                <span>Approved By: {settledBy || 'Operator'} ({approvalLevel})</span>
                {settledAt && <span className="block text-emerald-400/80">{formatDisplayDate(settledAt)}</span>}
              </div>
            </div>
          )}

          {/* Toast Notification */}
          {saveMessage && (
            <div className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border shadow-xs ${
              saveMessage.startsWith('✓') 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
                : 'bg-rose-50 text-rose-900 border-rose-300'
            }`}>
              {saveMessage.startsWith('✓') ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{saveMessage}</span>
            </div>
          )}

          {/* SECTION 1: SAUDA & TEMPORARY RECEIPT SUMMARY */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-black uppercase tracking-wider text-[10.5px] text-slate-800">
                  1. Sauda &amp; Temporary Receipt Summary
                </span>
              </div>
              <span className="text-[9px] font-mono font-bold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                Policy: Lower of 3% or 1.5 MT (15.00 Qtl)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 font-mono text-[10.5px]">
              <div className="bg-slate-50 p-2 rounded-md border border-slate-200">
                <span className="text-[8.5px] font-extrabold uppercase text-slate-500 block">Sauda Date</span>
                <strong className="text-slate-900 font-bold block mt-0.5">{formatDisplayDate(saudaDate)}</strong>
              </div>

              <div className="bg-slate-50 p-2 rounded-md border border-slate-200">
                <span className="text-[8.5px] font-extrabold uppercase text-slate-500 block">Sauda Quantity</span>
                <strong className="text-indigo-950 font-black block mt-0.5">{contractMt.toFixed(3)} MT</strong>
                <span className="text-[8.5px] text-slate-500 font-normal">({saudaQtyQtl.toFixed(2)} Qtl)</span>
              </div>

              <div className="bg-emerald-50/70 p-2 rounded-md border border-emerald-200">
                <span className="text-[8.5px] font-extrabold uppercase text-emerald-800 block">Last Temp Arrival</span>
                <strong className="text-emerald-950 font-bold block mt-0.5">{formatDisplayDate(lastArrivalDate)}</strong>
                <span className="text-[8.5px] text-emerald-700 font-normal">({lastArrivalMrNo})</span>
              </div>

              <div className="bg-emerald-50/70 p-2 rounded-md border border-emerald-200">
                <span className="text-[8.5px] font-extrabold uppercase text-emerald-800 block">Total Received</span>
                <strong className="text-emerald-950 font-black block mt-0.5">{totalReceivedMt.toFixed(3)} MT</strong>
                <span className="text-[8.5px] text-emerald-700 font-normal">({totalReceivedQtl.toFixed(2)} Qtl)</span>
              </div>

              <div className="bg-indigo-50/70 p-2 rounded-md border border-indigo-200">
                <span className="text-[8.5px] font-extrabold uppercase text-indigo-800 block">Allowed Tolerance</span>
                <strong className="text-indigo-950 font-bold block mt-0.5">±{tolerance.toleranceMt.toFixed(3)} MT</strong>
                <span className="text-[8.5px] text-indigo-700 font-normal">(±{tolerance.toleranceQtl.toFixed(2)} Qtl)</span>
              </div>

              <div className={cn(
                "p-2 rounded-md border flex flex-col justify-between",
                isWithinTolerance 
                  ? "bg-emerald-100/70 border-emerald-300 text-emerald-950" 
                  : isExcess 
                    ? "bg-purple-100/70 border-purple-300 text-purple-950" 
                    : "bg-amber-100/70 border-amber-300 text-amber-950"
              )}>
                <span className="text-[8.5px] font-extrabold uppercase block">Deductible Qty</span>
                <strong className="text-xs font-black block mt-0.5">{deductibleQtyMt.toFixed(3)} MT</strong>
                <span className="text-[8.5px] font-bold">({deductibleQtyQtl.toFixed(2)} Qtl • {policyStatusText})</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: TEMPORARY M.R DETAILS & GRADE BREAKDOWN TABLE */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <div className="flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-black uppercase tracking-wider text-[10.5px] text-slate-800">
                  2. Temporary M.R Details &amp; Grade Breakdown
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] text-slate-600">
                <span className="font-bold text-slate-700">Last Temp MR Date:</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-950 font-bold border border-emerald-300">
                  {formatDisplayDate(lastArrivalDate)}
                </span>
                <span className="ml-2 font-bold text-slate-700">Temp Arrivals:</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-100 border border-slate-300 text-slate-800 font-bold">
                  {arrivalNumbersString}
                </span>
              </div>
            </div>

            {/* Grade Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-[10px]">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 border-y border-slate-200 text-[9px] uppercase">
                    <th className="py-1 px-2">Temp M.R No</th>
                    <th className="py-1 px-2">Temp M.R Date</th>
                    <th className="py-1 px-2">Grade</th>
                    <th className="py-1 px-2">Marka</th>
                    <th className="py-1 px-2">Crop Year</th>
                    <th className="py-1 px-2 text-right">Bags</th>
                    <th className="py-1 px-2 text-right">Weight (Qtl)</th>
                    <th className="py-1 px-2 text-right">Weight (MT)</th>
                    <th className="py-1 px-2 text-right">Sauda Rate</th>
                    <th className="py-1 px-2 text-right">Temp Arrival Rate</th>
                    <th className="py-1 px-2 text-right">Rate Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {gradeBreakdownList.map((gRow, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-1 px-2 font-bold text-indigo-900">{gRow.mrNo}</td>
                      <td className="py-1 px-2 font-bold text-emerald-900">{gRow.mrDate}</td>
                      <td className="py-1 px-2 font-bold text-slate-900">{gRow.grade}</td>
                      <td className="py-1 px-2 text-slate-600">{gRow.marka}</td>
                      <td className="py-1 px-2 text-slate-600">{gRow.cropYear}</td>
                      <td className="py-1 px-2 text-right text-slate-800">{gRow.totalBags}</td>
                      <td className="py-1 px-2 text-right font-bold text-slate-900">{Number(gRow.weightQtl).toFixed(2)} Qtl</td>
                      <td className="py-1 px-2 text-right text-slate-700">{Number(gRow.weightMt).toFixed(3)} MT</td>
                      <td className="py-1 px-2 text-right text-slate-700">₹{Number(gRow.saudaRateQtl).toLocaleString()} / Qtl</td>
                      <td className="py-1 px-2 text-right text-slate-700">₹{Number(gRow.sattaRateQtl).toLocaleString()} / Qtl</td>
                      <td className="py-1 px-2 text-right font-bold text-amber-700">₹{Number(gRow.rateDiffQtl).toLocaleString()} / Qtl</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* DEDUCTION SUMMARY STRIP */}
          <div className="bg-slate-950 text-white p-3 rounded-lg border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
            <div>
              <span className="text-[9px] font-bold uppercase text-amber-400 block tracking-wider">
                {isWithinTolerance 
                  ? 'Within Tolerance – No Deduction (₹0.00)' 
                  : (isExcess ? 'Total Excess Weight Deduction Amount' : 'Total Short Weight Deduction Amount')}
              </span>
              
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xl sm:text-2xl font-black font-mono text-white">
                  ₹ {totalCalculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight",
                  isWithinTolerance ? "bg-emerald-600 text-white" : (isExcess ? "bg-purple-600 text-white" : "bg-amber-600 text-white")
                )}>
                  {policyStatusText}
                </span>
              </div>

              <div className="text-[10px] text-amber-200 font-mono mt-0.5">
                Calculation: <strong>{deductibleQtyQtl.toFixed(2)} Quintal</strong> × <strong>₹{applicableRate.toLocaleString()} / Quintal</strong> = <strong>₹{totalCalculatedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 px-3.5 py-2 rounded-lg text-right font-mono min-w-[210px]">
              <span className="text-[8.5px] font-bold uppercase text-slate-400 block">
                Total Final Payable
              </span>
              <span className="text-lg font-black text-emerald-400 block">
                ₹ {totalFinalPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[9px] text-slate-400">
                Sauda Material Value: ₹{existingSaudaAmount.toLocaleString()}
              </span>
            </div>
          </div>

        </div>

        {/* Modal Footer: Strict Separation Between Saved (View-Only) and Unsaved Mode */}
        <div className="px-4 py-2.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between select-none">
          <div className="text-[10.5px] text-slate-600 font-mono flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full inline-block", isSettled ? "bg-emerald-600" : "bg-amber-500")}></span>
            <span>
              {isSettled 
                ? 'Record finalized and locked in sauda_check_point_deductions table' 
                : 'Pending settlement confirmation'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isSettled ? (
              <>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" /> Print Voucher
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer shadow-xs"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition cursor-pointer shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSettlement}
                  disabled={isSaving}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-white text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50",
                    isWithinTolerance ? "bg-emerald-600 hover:bg-emerald-700" : (isExcess ? "bg-purple-700 hover:bg-purple-800" : "bg-amber-600 hover:bg-amber-700")
                  )}
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSaving ? 'Saving...' : 'Save & Lock Settlement'}
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ExcessShortSettlementModal;
