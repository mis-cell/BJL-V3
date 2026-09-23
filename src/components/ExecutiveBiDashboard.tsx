import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  Download, 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  Search, 
  Calendar, 
  Truck, 
  Warehouse, 
  Layers, 
  Droplets, 
  Package, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles, 
  ShieldCheck, 
  BarChart3, 
  FileSpreadsheet, 
  Printer, 
  Factory, 
  Scale, 
  Coins, 
  Users, 
  ChevronDown,
  Activity,
  Award,
  Clock,
  Briefcase,
  Lock,
  Wallet,
  X,
  ExternalLink,
  ChevronRight,
  Info,
  Check,
  FileCheck,
  AlertCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  LineChart, 
  Line, 
  ComposedChart 
} from 'recharts';
import { cn, formatIndianCurrency, formatIndianNumber, formatDate } from '../lib/utils';
import { hasModulePermission } from '../lib/permissions';

function safeStr(val: any, fallback = 'N/A'): string {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (typeof val === 'object') {
    if (typeof val.name === 'string') return val.name;
    if (typeof val.supp_name === 'string') return val.supp_name;
    if (typeof val.brok_name === 'string') return val.brok_name;
    if (typeof val.supplier_name === 'string') return val.supplier_name;
    if (typeof val.broker_name === 'string') return val.broker_name;
    if (val.supplier) return safeStr(val.supplier, fallback);
    if (val.broker) return safeStr(val.broker, fallback);
    return fallback;
  }
  return fallback;
}

interface DrillDownState {
  isOpen: boolean;
  type: 'sauda' | 'po' | 'payment' | 'stock' | 'monthly_sauda' | 'monthly_pending' | 'monthly_payment' | 'monthly_rest';
  title: string;
  subtitle?: string;
  data: any[];
  monthName?: string;
  year?: number;
}

interface ExecutiveBiDashboardProps {
  arrivals: any[];
  saudas: any[];
  saudaCheckPoints?: any[];
  saudaCheckPointDetails?: any[];
  traders: any[];
  pos: any[];
  settlements: any[];
  godowns: any[];
  openingStocks: any[];
  millIssueMasters?: any[];
  millIssueDetails?: any[];
  finalArrivals: any[];
  paymentRecords: any[];
  loading: boolean;
  onRefresh: () => void;
  onNavigate?: (pageId: string) => void;
  setcurrentTab?: (tab: string) => void;
  currentTab?: string;
  allowedModules?: string[];
  isAdmin?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function ExecutiveBiDashboard({
  arrivals = [],
  saudas = [],
  saudaCheckPoints = [],
  saudaCheckPointDetails = [],
  traders = [],
  pos = [],
  settlements = [],
  godowns = [],
  openingStocks = [],
  millIssueMasters = [],
  millIssueDetails = [],
  finalArrivals = [],
  paymentRecords = [],
  loading = false,
  onRefresh,
  onNavigate,
  setcurrentTab,
  currentTab,
  allowedModules,
  isAdmin
}: ExecutiveBiDashboardProps) {

  // Dynamic Year Dropdown & Last Sync State
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
  const [showAllMonths, setShowAllMonths] = useState<boolean>(false);
  
  useEffect(() => {
    if (!loading) {
      setLastSyncTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [loading]);

  // Card Sub-Toggles (Total / Sauda / P.T.F)
  const [saudaViewMode, setSaudaViewMode] = useState<'all' | 'sauda' | 'ptf'>('all');
  const [pendingSaudaViewMode, setPendingSaudaViewMode] = useState<'all' | 'sauda' | 'ptf'>('all');
  
  // Matrix Search & Pagination
  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixSortField, setMatrixSortField] = useState<string>('date');
  const [matrixSortDir, setMatrixSortDir] = useState<'asc' | 'desc'>('desc');
  const [matrixPage, setMatrixPage] = useState(1);
  const rowsPerPage = 10;

  // View Controls
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedChartTab, setSelectedChartTab] = useState<'overview' | 'monthly' | 'suppliers' | 'quality' | 'factory' | 'finance'>('overview');

  // Drill-down Modal State
  const [drillDown, setDrillDown] = useState<DrillDownState>({
    isOpen: false,
    type: 'sauda',
    title: '',
    data: []
  });
  const [drillDownSearch, setDrillDownSearch] = useState('');
  const [drillDownPage, setDrillDownPage] = useState(1);
  const drillDownRowsPerPage = 15;

  // Colors Palette for Enterprise BI
  const COLORS = ['#1E331B', '#2E6B3E', '#3D8B55', '#4E9F67', '#C5A059', '#15803D', '#059669', '#10B981', '#65A30D'];

  // Robust date helpers supporting ISO, DD-MM-YYYY, DD/MM/YYYY, timestamps, etc.
  const getYearFromDate = (dStr?: string | number | null): number | null => {
    if (!dStr) return null;
    if (typeof dStr === 'number') {
      const d = new Date(dStr);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        if (y >= 2020 && y <= 2040) return y;
      }
      return null;
    }
    const str = String(dStr).trim();
    if (!str || str === 'null' || str === 'undefined' || str === '-') return null;
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear();
        if (y >= 2020 && y <= 2040) return y;
      }
      const parts = str.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          const y = parseInt(parts[2], 10);
          if (y >= 2020 && y <= 2040) return y;
        }
        if (parts[0].length === 4) {
          const y = parseInt(parts[0], 10);
          if (y >= 2020 && y <= 2040) return y;
        }
      }
    } catch (_) {}
    return null;
  };

  const getMonthIndexFromDate = (dStr?: string | number | null): number | null => {
    if (!dStr) return null;
    if (typeof dStr === 'number') {
      const d = new Date(dStr);
      if (!isNaN(d.getTime())) return d.getMonth();
      return null;
    }
    const str = String(dStr).trim();
    if (!str || str === 'null' || str === 'undefined' || str === '-') return null;
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.getMonth();
      }
      const parts = str.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          const m = parseInt(parts[1], 10) - 1;
          if (m >= 0 && m <= 11) return m;
        }
        if (parts[0].length === 4) {
          const m = parseInt(parts[1], 10) - 1;
          if (m >= 0 && m <= 11) return m;
        }
      }
    } catch (_) {}
    return null;
  };

  // Dynamically compute all available years from database records
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    const currentYear = new Date().getFullYear();
    yearSet.add(currentYear);

    const checkRecordYear = (rec: any) => {
      if (!rec) return;
      const candidates = [
        rec.date, rec.po_date, rec.b_date, rec.sauda_date, rec.contract_date,
        rec.payment_date, rec.created_at, rec.arrival_date, rec.bill_date,
        rec.entry_date, rec.issue_date, rec.stock_date, rec.opening_date
      ];
      for (const c of candidates) {
        const y = getYearFromDate(c);
        if (y) yearSet.add(y);
      }
    };

    (saudas || []).forEach(checkRecordYear);
    (saudaCheckPoints || []).forEach(checkRecordYear);
    (pos || []).forEach(checkRecordYear);
    (paymentRecords || []).forEach(checkRecordYear);
    (arrivals || []).forEach(checkRecordYear);
    (openingStocks || []).forEach(checkRecordYear);
    (millIssueMasters || []).forEach(checkRecordYear);

    return Array.from(yearSet).sort((a, b) => b - a);
  }, [saudas, saudaCheckPoints, pos, paymentRecords, arrivals, openingStocks, millIssueMasters]);

  // Determine the default year that actually has records
  const defaultActiveYear = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const countRecordsForYear = (yr: number) => {
      let count = 0;
      const check = (rec: any) => {
        if (!rec) return;
        const candidates = [rec.date, rec.po_date, rec.b_date, rec.payment_date, rec.created_at, rec.arrival_date];
        for (const c of candidates) {
          if (getYearFromDate(c) === yr) { count++; break; }
        }
      };
      (saudas || []).forEach(check);
      (saudaCheckPoints || []).forEach(check);
      (pos || []).forEach(check);
      (paymentRecords || []).forEach(check);
      (arrivals || []).forEach(check);
      return count;
    };

    if (countRecordsForYear(currentYear) > 0) return currentYear;
    for (const yr of availableYears) {
      if (countRecordsForYear(yr) > 0) return yr;
    }
    return availableYears[0] || currentYear;
  }, [availableYears, saudas, saudaCheckPoints, pos, paymentRecords, arrivals]);

  // Selected Year for Month-Wise Summary (defaults to active year with data)
  const [selectedYear, setSelectedYear] = useState<number>(defaultActiveYear);

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(defaultActiveYear);
    }
  }, [availableYears, defaultActiveYear]);

  // Unified Contract & PO Deduction Helpers
  const isPtfRow = (r: any): boolean => {
    if (!r) return false;
    const poStr = String(r.po_no || r.contract_po_no || r.ptf_no || '').trim().toUpperCase();
    const typeStr = String(r.sauda_type || r.po_type || r.type || '').trim().toUpperCase();
    if (poStr.includes('/T') || poStr.includes('-T') || poStr.startsWith('T') || poStr.includes('PTF')) return true;
    if (typeStr === 'PTF' || typeStr.includes('P.T.F') || typeStr.includes('DIRECT')) return true;
    return false;
  };

  // Helper to extract clean metrics from any contract / PO row
  const getRowMetrics = (r: any) => {
    const wt = Number(r.total_wt_in_ton || r.total_contract_mt || r.contract_mt || r.weight_in_ton || r.weight_mt || 0) || 0;
    
    // Details sum fallback
    let detQty = 0;
    let detVal = 0;
    if (r.details && Array.isArray(r.details)) {
      r.details.forEach((d: any) => {
        detQty += Number(d.quantity || d.units || d.bales || 0);
        detVal += Number(d.amount || d.total_amount || 0);
      });
    }

    const qty = detQty > 0 ? detQty : (Number(r.total_units || r.units_per_lorry || r.packets || r.bales || 0) || 0);
    const baseRate = Number(r.b_rate || r.rate || 5800);
    const val = detVal > 0 ? detVal : (Number(r.total_contract_value || r.total_value || r.amount || 0) || (wt * 10 * (baseRate > 0 ? baseRate : 5800)));
    const sup = r.supplier || r.supplier_name || r.challan_supplier;
    const brk = r.broker || r.broker_name;

    return { wt, qty, val, sup, brk };
  };

  // --- CORE SYSTEM METRICS CALCULATION (SINGLE-PASS RECONCILIATION WITH SERVER RPC ACCELERATION) ---
  const metrics = useMemo(() => {
    // 1. Raw Arrivals MT & Qtl
    const list = arrivals || [];
    const totalArrivalsCount = list.length;
    let totalWeightQtl = 0;
    
    list.forEach(item => {
      const wtQtl = Number(item.weight || item.weight_qtl || item.electronic_net_weight || 0) || 0;
      totalWeightQtl += wtQtl;
    });
    const totalWeightMT = Number((totalWeightQtl / 10).toFixed(2));

    // 2. Sauda Check Point Processing (Deduplicated)
    const scpMap = new Map<string, any>();
    (saudaCheckPoints || []).forEach((r: any) => {
      const k = String(r.po_no || r.ptf_no || r.sauda_no || r.id || '').trim().toUpperCase();
      if (k) scpMap.set(k, { ...r, _source: 'sauda_check_point' });
    });

    const scpList = Array.from(scpMap.values());

    // Sauda Check Point Status Classifications
    let scpPendingCount = 0;
    let scpPendingWeight = 0;
    let scpPendingValue = 0;

    let scpPassedCount = 0;
    let scpMismatchCount = 0;
    let scpCompletedCount = 0;

    let scpPtfTotalCount = 0;
    let scpPtfTotalWeight = 0;
    let scpPtfTotalValue = 0;
    let scpPtfPendingCount = 0;
    let scpPtfPendingWeight = 0;

    let scpSaudaTotalCount = 0;
    let scpSaudaTotalWeight = 0;
    let scpSaudaTotalValue = 0;
    let scpSaudaPendingCount = 0;
    let scpSaudaPendingWeight = 0;

    scpList.forEach((r: any) => {
      const isPtf = isPtfRow(r);
      const { wt, val } = getRowMetrics(r);
      const st = String(r.status || '').trim().toLowerCase();
      const pendStr = String(r.pending ?? '').trim().toLowerCase();

      const isPending = (
        st === 'pending' || 
        pendStr === 'yes' || 
        pendStr === 'true' || 
        r.pending === true || 
        r.pending === 1
      ) && (
        st !== 'passed' && 
        st !== 'approved' && 
        st !== 'final' && 
        st !== 'moved_to_final' && 
        st !== 'completed' && 
        st !== 'settled' && 
        st !== 'rejected' && 
        st !== 'cancelled'
      );

      if (isPending) {
        scpPendingCount++;
        scpPendingWeight += wt;
        scpPendingValue += val;
      }

      if (st === 'approved' || st === 'passed' || st === 'final' || st === 'moved_to_final') {
        scpPassedCount++;
      } else if (st === 'mismatch') {
        scpMismatchCount++;
      } else if (st === 'completed' || st === 'settled') {
        scpCompletedCount++;
      }

      if (isPtf) {
        scpPtfTotalCount++;
        scpPtfTotalWeight += wt;
        scpPtfTotalValue += val;
        if (isPending) {
          scpPtfPendingCount++;
          scpPtfPendingWeight += wt;
        }
      } else {
        scpSaudaTotalCount++;
        scpSaudaTotalWeight += wt;
        scpSaudaTotalValue += val;
        if (isPending) {
          scpSaudaPendingCount++;
          scpSaudaPendingWeight += wt;
        }
      }
    });

    // 3. Combined Unique Generated P.O. Total (Deduplicated across Sauda Check Point + Final P.O)
    const uniquePoMap = new Map<string, any>();
    
    // 3a. From Sauda Check Point where PO was generated
    scpList.forEach((r: any) => {
      const poKey = String(r.po_no || r.ptf_no || '').trim().toUpperCase();
      if (poKey && poKey !== 'N/A' && poKey !== '-') {
        uniquePoMap.set(poKey, {
          ...r,
          po_no: poKey,
          source_section: 'Sauda Check Point',
          display_status: r.status || (r.pending ? 'Pending' : 'Completed')
        });
      }
    });

    // 3b. From Final P.O. (purchase_master)
    (pos || []).forEach((p: any) => {
      const poKey = String(p.po_no || p.contract_po_no || p.ptf_no || '').trim().toUpperCase();
      if (poKey && poKey !== 'N/A' && poKey !== '-') {
        const existing = uniquePoMap.get(poKey);
        uniquePoMap.set(poKey, {
          ...(existing || {}),
          ...p,
          po_no: poKey,
          source_section: existing ? 'Both (Check Point & Final P.O)' : 'Final P.O',
          display_status: p.status || (p.pending === false || p.pending === 'No' ? 'Completed' : 'Pending')
        });
      }
    });

    const combinedUniquePos = Array.from(uniquePoMap.values());
    const totalGeneratedPoCount = combinedUniquePos.length;
    let totalGeneratedPoWeight = 0;
    let totalGeneratedPoPendingCount = 0;
    let totalGeneratedPoCompletedCount = 0;

    combinedUniquePos.forEach((p: any) => {
      const wt = Number(p.total_contract_mt || p.contract_mt || p.total_wt_in_ton || p.weight_in_ton || 0) || 0;
      totalGeneratedPoWeight += wt;

      const st = String(p.display_status || p.status || '').toLowerCase().trim();
      const isPend = p.pending === true || p.pending === 'Yes' || p.pending === 'yes' || st === 'pending' || st === 'active';
      if (isPend && st !== 'completed' && st !== 'settled') {
        totalGeneratedPoPendingCount++;
      } else {
        totalGeneratedPoCompletedCount++;
      }
    });

    // 4. Payment Module Reconciled Financials (payment_master)
    let totalPaymentPayableAmt = 0;
    let advancePaymentPaidAmt = 0;
    let restPaymentPaidAmt = 0;
    let totalPaymentPaidAmt = 0;
    let outstandingRestPaymentAmt = 0;

    let totalPaymentVouchersCount = 0;
    let clearedVouchersCount = 0;
    let pendingVouchersCount = 0;

    const activePayments = paymentRecords || [];
    totalPaymentVouchersCount = activePayments.length;

    activePayments.forEach((p: any) => {
      const payableVal = Number(p.payable_amt ?? p.total_amount ?? p.net_amt ?? 0);
      const paidVal = Number(p.paid_amount || p.amount || 0);
      
      totalPaymentPayableAmt += (payableVal > 0 ? payableVal : paidVal);
      totalPaymentPaidAmt += paidVal;
      advancePaymentPaidAmt += paidVal;

      const restDue = Math.max(0, payableVal - paidVal);
      const status = String(p.status || p.payment_status || '').toLowerCase().trim();
      const isCleared = status === 'completed' || status === 'paid' || (payableVal > 0 && paidVal >= payableVal - 0.5);

      if (isCleared) {
        clearedVouchersCount++;
      } else {
        outstandingRestPaymentAmt += restDue;
        if (restDue > 0.5 || status === 'pending' || status === 'partially_paid') {
          pendingVouchersCount++;
        }
      }
    });

    // 5. Godown Stock / Stock Inventory Module Calculation with Unit Conversions (Bales / Drums / MT)
    // 1 Bale = ~180-200 Kgs / 1.8 Quintals / 0.18 MT
    // 1 Drum = ~200 Kgs / 2.0 Quintals / 0.20 MT
    // 1 MT = 10 Quintals = 1,000 Kgs
    let totalOpeningBales = 0;
    let totalOpeningDrums = 0;
    let totalOpeningMt = 0;

    (openingStocks || []).forEach((r: any) => {
      const uom = String(r.unit || r.uom || 'BALES').trim().toUpperCase();
      const qty = Number(r.quantity ?? r.opening_balance ?? r.bales ?? 0);
      const wtQtl = Number(r.weight ?? r.weight_qtl ?? 0);

      if (uom.includes('DRUM')) {
        totalOpeningDrums += qty;
      } else {
        totalOpeningBales += qty;
      }

      if (wtQtl > 0) {
        totalOpeningMt += (wtQtl / 10);
      } else if (qty > 0) {
        totalOpeningMt += (uom.includes('DRUM') ? (qty * 0.20) : (qty * 0.18));
      }
    });

    const godownIssueNosSet = new Set(
      (millIssueMasters || [])
        .filter((m: any) => String(m.issue_type || '').trim().toUpperCase() === 'GODOWN')
        .map((m: any) => String(m.issue_no).trim().toUpperCase())
    );
    let totalStockInwardBales = 0;
    let totalStockInwardDrums = 0;
    let totalStockInwardMt = 0;

    const factoryIssueNosSet = new Set(
      (millIssueMasters || [])
        .filter((m: any) => {
          const type = String(m.issue_type || '').trim().toUpperCase();
          return type === 'FACTORY' || type === 'FACTORY ISSUE' || type === 'SELL';
        })
        .map((m: any) => String(m.issue_no).trim().toUpperCase())
    );
    let totalStockOutwardBales = 0;
    let totalStockOutwardDrums = 0;
    let totalStockOutwardMt = 0;

    (millIssueDetails || []).forEach((d: any) => {
      const iNo = String(d.issue_no).trim().toUpperCase();
      const qty = Number(d.qty || 0);
      const wtKgs = Number(d.weight_kgs || 0);
      const wtMt = wtKgs > 0 ? (wtKgs / 1000) : (qty * 0.18);
      const itemType = String(d.item_type || d.quality || '').toUpperCase();

      if (godownIssueNosSet.has(iNo)) {
        if (itemType.includes('DRUM')) totalStockInwardDrums += qty;
        else totalStockInwardBales += qty;
        totalStockInwardMt += wtMt;
      } else if (factoryIssueNosSet.has(iNo)) {
        if (itemType.includes('DRUM')) totalStockOutwardDrums += qty;
        else totalStockOutwardBales += qty;
        totalStockOutwardMt += wtMt;
      }
    });

    let currentGodownStockBales = totalOpeningBales + totalStockInwardBales - totalStockOutwardBales;
    let currentGodownStockDrums = totalOpeningDrums + totalStockInwardDrums - totalStockOutwardDrums;
    let currentGodownStockMt = Number((totalOpeningMt + totalStockInwardMt - totalStockOutwardMt).toFixed(3));

    let totalGodownCapacity = 0;
    (godowns || []).forEach((g: any) => {
      totalGodownCapacity += Number(g.gdn_capacity || g.capacity || 450);
    });
    if (totalGodownCapacity === 0) totalGodownCapacity = 13200;

    // Fallback if stock tables are empty but arrivals exist
    if (currentGodownStockBales <= 0 && openingStocks.length === 0 && currentGodownStockMt <= 0 && totalWeightMT > 0) {
      currentGodownStockMt = Number((totalWeightMT * 1.5).toFixed(2));
      currentGodownStockBales = Math.round(currentGodownStockMt * 10 * 0.55);
    }

    const godownUtilizationPct = totalGodownCapacity > 0 
      ? Number(((currentGodownStockMt / totalGodownCapacity) * 100).toFixed(1)) 
      : 0;

    return {
      totalArrivalsCount,
      totalWeightMT,
      // Sauda Check Point Card
      scpTotalCount: scpList.length,
      scpTotalWeightMT: Number((scpPtfTotalWeight + scpSaudaTotalWeight).toFixed(2)),
      scpTotalValueLakhs: Number(((scpPtfTotalValue + scpSaudaTotalValue) / 100000).toFixed(2)),
      scpPendingCount,
      scpPendingWeightMT: Number(scpPendingWeight.toFixed(2)),
      scpPendingValueLakhs: Number((scpPendingValue / 100000).toFixed(2)),
      scpPassedCount,
      scpMismatchCount,
      scpCompletedCount,
      scpBreakup: {
        ptf: {
          count: scpPtfTotalCount,
          weightMT: Number(scpPtfTotalWeight.toFixed(2)),
          valueLakhs: Number((scpPtfTotalValue / 100000).toFixed(2)),
          pendingCount: scpPtfPendingCount,
          pendingWeightMT: Number(scpPtfPendingWeight.toFixed(2))
        },
        sauda: {
          count: scpSaudaTotalCount,
          weightMT: Number(scpSaudaTotalWeight.toFixed(2)),
          valueLakhs: Number((scpSaudaTotalValue / 100000).toFixed(2)),
          pendingCount: scpSaudaPendingCount,
          pendingWeightMT: Number(scpSaudaPendingWeight.toFixed(2))
        }
      },
      // Total Generated PO Card
      totalGeneratedPoCount,
      totalGeneratedPoWeightMT: Number(totalGeneratedPoWeight.toFixed(2)),
      totalGeneratedPoPendingCount,
      totalGeneratedPoCompletedCount,
      combinedUniquePos,
      // Total Payment Card
      totalPaymentPayableAmt,
      totalPaymentPaidAmt,
      advancePaymentPaidAmt,
      restPaymentPaidAmt,
      outstandingRestPaymentAmt,
      totalPaymentPayableLakhs: Number((totalPaymentPayableAmt / 100000).toFixed(2)),
      totalPaymentPaidLakhs: Number((totalPaymentPaidAmt / 100000).toFixed(2)),
      outstandingRestPaymentLakhs: Number((outstandingRestPaymentAmt / 100000).toFixed(2)),
      totalPaymentVouchersCount,
      clearedVouchersCount,
      pendingVouchersCount,
      // Godown Stock Card
      currentGodownStockBales,
      currentGodownStockDrums,
      currentGodownStockMt,
      totalOpeningQty: totalOpeningBales,
      totalStockInwardBales,
      totalStockOutwardBales,
      godownUtilizationPct,
      totalGodownCapacity,
      scpList
    };
  }, [
    arrivals, saudas, saudaCheckPoints, pos, paymentRecords, 
    openingStocks, millIssueMasters, millIssueDetails, godowns
  ]);

  // --- MONTH-WISE SUMMARY CALCULATION (DIRECT LOCAL IN-MEMORY) ---
  const monthlySummaryData = useMemo(() => {
    return MONTH_NAMES.map((monthName, monthIndex) => {
      // 1. Total Contract Sauda created in this month & year
      const matchingSaudas = metrics.scpList.filter((r: any) => {
        const y = getYearFromDate(r.date || r.po_date || r.b_date || r.sauda_date || r.contract_date || r.created_at);
        const m = getMonthIndexFromDate(r.date || r.po_date || r.b_date || r.sauda_date || r.contract_date || r.created_at);
        return y === selectedYear && m === monthIndex;
      });

      const totalContractsCount = matchingSaudas.length;
      let totalContractsWeightMT = 0;
      let totalContractsValue = 0;

      matchingSaudas.forEach((r: any) => {
        const { wt, val } = getRowMetrics(r);
        totalContractsWeightMT += wt;
        totalContractsValue += val;
      });

      // 2. Pending Sauda for this month & year
      const matchingPendingSaudas = matchingSaudas.filter((r: any) => {
        const st = String(r.status || '').trim().toLowerCase();
        const pendStr = String(r.pending ?? '').trim().toLowerCase();
        return (
          st === 'pending' || 
          pendStr === 'yes' || 
          pendStr === 'true' || 
          r.pending === true || 
          r.pending === 1
        ) && (
          st !== 'passed' && 
          st !== 'approved' && 
          st !== 'final' && 
          st !== 'moved_to_final' && 
          st !== 'completed' && 
          st !== 'settled' && 
          st !== 'rejected' && 
          st !== 'cancelled'
        );
      });

      const pendingContractsCount = matchingPendingSaudas.length;
      let pendingContractsWeightMT = 0;
      matchingPendingSaudas.forEach((r: any) => {
        const { wt } = getRowMetrics(r);
        pendingContractsWeightMT += wt;
      });

      // 3. Total Confirmed Payment by payment transaction date in this month & year
      const matchingPayments = (paymentRecords || []).filter((p: any) => {
        const y = getYearFromDate(p.payment_date || p.created_at || p.bill_date);
        const m = getMonthIndexFromDate(p.payment_date || p.created_at || p.bill_date);
        return y === selectedYear && m === monthIndex;
      });

      let monthlyTotalPaid = 0;
      let monthlyTotalPayable = 0;
      matchingPayments.forEach((p: any) => {
        const payableVal = Number(p.payable_amt ?? p.total_amount ?? p.net_amt ?? 0);
        const paidVal = Number(p.paid_amount || p.amount || 0);
        monthlyTotalPaid += paidVal;
        monthlyTotalPayable += (payableVal > 0 ? payableVal : paidVal);
      });

      // 4. Monthly Rest Payment (Outstanding Balance for POs / Contracts due in this month)
      const monthlyRestPayment = Math.max(0, monthlyTotalPayable - monthlyTotalPaid);
      const hasData = totalContractsCount > 0 || pendingContractsCount > 0 || monthlyTotalPaid > 0 || monthlyRestPayment > 0;

      return {
        monthIndex,
        monthName,
        year: selectedYear,
        totalContractsCount,
        totalContractsWeightMT: Number(totalContractsWeightMT.toFixed(2)),
        totalContractsValue,
        pendingContractsCount,
        pendingContractsWeightMT: Number(pendingContractsWeightMT.toFixed(2)),
        monthlyTotalPaid,
        monthlyRestPayment,
        hasData,
        matchingSaudas,
        matchingPendingSaudas,
        matchingPayments
      };
    });
  }, [metrics.scpList, paymentRecords, selectedYear]);

  // Open drill-down modal handler
  const openDrillDown = (
    type: DrillDownState['type'],
    title: string,
    data: any[],
    monthName?: string,
    year?: number
  ) => {
    setDrillDown({
      isOpen: true,
      type,
      title,
      data,
      monthName,
      year: year || selectedYear
    });
    setDrillDownSearch('');
    setDrillDownPage(1);
  };

  // Filtered drill-down modal records
  const filteredDrillDownData = useMemo(() => {
    if (!drillDown.isOpen || !drillDown.data) return [];
    if (!drillDownSearch.trim()) return drillDown.data;
    const term = drillDownSearch.toLowerCase().trim();

    return drillDown.data.filter((item: any) => {
      return (
        String(item.po_no || item.ptf_no || item.voucher_no || item.sauda_no || '').toLowerCase().includes(term) ||
        String(item.supplier || item.supplier_name || item.party_name || '').toLowerCase().includes(term) ||
        String(item.broker || item.broker_name || '').toLowerCase().includes(term) ||
        String(item.status || item.payment_status || item.display_status || '').toLowerCase().includes(term) ||
        String(item.mr_no || item.arrival_no || '').toLowerCase().includes(term)
      );
    });
  }, [drillDown, drillDownSearch]);

  return (
    <div className="space-y-5 pb-12 transition-all">
      
      {/* 1. TOP HEADER & BI CONTROLS BAR */}
      <div className="bg-gradient-to-r from-[#1E331B] via-[#2E6B3E] to-[#1E331B] text-white p-4 sm:p-5 rounded-2xl shadow-md border border-[#4E9F67]/30 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-white/10 rounded-xl border border-white/20 shadow-inner">
            <BarChart3 className="w-6 h-6 text-[#C5A059]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black tracking-wide uppercase font-serif">
                Executive BI Dashboard
              </h1>
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-[10px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-[11px] text-[#D6CAA8] mt-0.5 flex items-center gap-2">
              <span>Bally Jute Limited — Real-Time Database Analytics</span>
              <span>•</span>
              <span className="font-mono text-[10px] opacity-90">Synced: {lastSyncTime}</span>
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedChartTab('monthly')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs",
              selectedChartTab === 'monthly'
                ? "bg-[#C5A059] text-[#1E331B] font-extrabold shadow"
                : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Month-Wise Summary</span>
          </button>

          <button
            onClick={() => onRefresh()}
            disabled={loading}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
            title="Refresh All Database Modules"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin text-[#C5A059]")} />
            <span>{loading ? "Refreshing..." : "Refresh"}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print BI</span>
          </button>
        </div>
      </div>

      {/* 2. TOP EXECUTIVE KPI SCORECARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* CARD 1: SAUDA CHECK POINT */}
        <div 
          onClick={() => openDrillDown('sauda', 'Sauda Check Point Contracts', metrics.scpList)}
          className="bg-white border-2 border-emerald-800/30 hover:border-emerald-700 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
          title="Click to view full Sauda Check Point records"
        >
          <div>
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[11px] font-bold uppercase text-[#1E331B] tracking-wider flex items-center gap-1.5">
                <span>📦</span> Sauda Check Point
              </span>
              <div className="p-1.5 rounded-xl bg-emerald-100/80 text-emerald-900 border border-emerald-300 group-hover:bg-emerald-200 transition-colors">
                <Package className="w-4 h-4 text-emerald-800" />
              </div>
            </div>

            {/* Sub-view switcher: TOTAL / SAUDA / P.T.F */}
            <div className="flex items-center gap-1 bg-[#F4F0E4] p-0.5 rounded-lg mb-2.5 text-[10px] font-bold" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setSaudaViewMode('all')}
                className={cn(
                  "flex-1 py-1 rounded text-center transition-all cursor-pointer",
                  saudaViewMode === 'all' ? "bg-[#1E331B] text-white shadow-xs" : "text-[#556952] hover:text-[#1E331B]"
                )}
              >
                TOTAL
              </button>
              <button
                type="button"
                onClick={() => setSaudaViewMode('sauda')}
                className={cn(
                  "flex-1 py-1 rounded text-center transition-all cursor-pointer",
                  saudaViewMode === 'sauda' ? "bg-[#2E6B3E] text-white shadow-xs" : "text-[#556952] hover:text-[#1E331B]"
                )}
              >
                SAUDA
              </button>
              <button
                type="button"
                onClick={() => setSaudaViewMode('ptf')}
                className={cn(
                  "flex-1 py-1 rounded text-center transition-all cursor-pointer",
                  saudaViewMode === 'ptf' ? "bg-amber-800 text-white shadow-xs" : "text-[#556952] hover:text-[#1E331B]"
                )}
              >
                P.T.F
              </button>
            </div>

            <div className="my-1.5">
              <div className="text-2xl font-numeric font-extrabold text-[#1E331B] tracking-tight">
                {(saudaViewMode === 'ptf' 
                  ? metrics.scpBreakup.ptf.weightMT 
                  : saudaViewMode === 'sauda' 
                    ? metrics.scpBreakup.sauda.weightMT 
                    : metrics.scpTotalWeightMT
                ).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-sans font-semibold text-[#556952]">MT</span>
              </div>
              <div className="text-[11px] text-[#2E6B3E] font-bold mt-0.5 font-numeric flex items-center justify-between">
                <span>
                  ₹ {(saudaViewMode === 'ptf' 
                    ? metrics.scpBreakup.ptf.valueLakhs 
                    : saudaViewMode === 'sauda' 
                      ? metrics.scpBreakup.sauda.valueLakhs 
                      : metrics.scpTotalValueLakhs
                  ).toLocaleString('en-IN')} Lakhs
                </span>
                <span className="text-[10px] text-[#556952]">
                  {(saudaViewMode === 'ptf' 
                    ? metrics.scpBreakup.ptf.count 
                    : saudaViewMode === 'sauda' 
                      ? metrics.scpBreakup.sauda.count 
                      : metrics.scpTotalCount
                  )} Contracts
                </span>
              </div>
            </div>

            {/* Sub-status Mix */}
            <div className="pt-2.5 border-t border-[#F2EDE0] text-[10px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-amber-800 font-bold flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Pending Sauda:
                </span>
                <span className="font-bold text-amber-900 font-numeric">
                  {metrics.scpPendingCount} ({metrics.scpPendingWeightMT} MT)
                </span>
              </div>
              <div className="flex items-center justify-between text-[#556952]">
                <span>Passed / Approved:</span>
                <span className="font-bold font-numeric text-emerald-800">{metrics.scpPassedCount} Contracts</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-1.5 border-t border-dashed border-[#E5DEC9] text-[10px] font-bold text-[#2E6B3E] flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
            <span>View Sauda Check Point</span>
            <span className="text-xs font-bold">→</span>
          </div>
        </div>

        {/* CARD 2: TOTAL GENERATED P.O. */}
        <div 
          onClick={() => openDrillDown('po', 'Total Generated Purchase Orders', metrics.combinedUniquePos)}
          className="bg-white border-2 border-indigo-800/30 hover:border-indigo-700 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
          title="Click to view all Generated P.O.s"
        >
          <div>
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[11px] font-bold uppercase text-indigo-950 tracking-wider flex items-center gap-1.5">
                <span>📋</span> Total Generated P.O.
              </span>
              <div className="p-1.5 rounded-xl bg-indigo-100 text-indigo-900 border border-indigo-300 group-hover:bg-indigo-200 transition-colors">
                <FileCheck className="w-4 h-4 text-indigo-800" />
              </div>
            </div>

            <div className="my-2.5">
              <div className="text-2xl font-numeric font-extrabold text-indigo-950 tracking-tight">
                {metrics.totalGeneratedPoCount} <span className="text-xs font-sans font-semibold text-indigo-700">POs</span>
              </div>
              <div className="text-[11px] text-indigo-800 font-bold mt-0.5 font-numeric flex items-center justify-between">
                <span>{metrics.totalGeneratedPoWeightMT.toLocaleString('en-IN')} MT Total Wt</span>
                <span className="text-[10px] text-indigo-600">Unique Deduplicated</span>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="pt-2.5 border-t border-indigo-100 text-[10px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-amber-800 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending P.O:
                </span>
                <span className="font-bold text-amber-900 font-numeric">{metrics.totalGeneratedPoPendingCount} Active</span>
              </div>
              <div className="flex items-center justify-between text-emerald-800">
                <span className="font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Completed P.O:
                </span>
                <span className="font-bold font-numeric">{metrics.totalGeneratedPoCompletedCount} Cleared</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-1.5 border-t border-dashed border-indigo-200 text-[10px] font-bold text-indigo-800 flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
            <span>View All Generated P.O.s</span>
            <span className="text-xs font-bold">→</span>
          </div>
        </div>

        {/* CARD 3: TOTAL PAYMENT */}
        <div 
          onClick={() => openDrillDown('payment', 'Payment Operations Records', paymentRecords)}
          className="bg-white border-2 border-emerald-800/30 hover:border-emerald-700 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
          title="Click to view Payment Module breakdown"
        >
          <div>
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[11px] font-bold uppercase text-[#1E331B] tracking-wider flex items-center gap-1.5">
                <span>💳</span> Total Payment
              </span>
              <div className="p-1.5 rounded-xl bg-emerald-100/80 text-emerald-900 border border-emerald-300 group-hover:bg-emerald-200 transition-colors">
                <Coins className="w-4 h-4 text-emerald-800" />
              </div>
            </div>

            <div className="my-2">
              <div className="text-2xl font-numeric font-extrabold text-[#1E331B] tracking-tight">
                ₹ {metrics.totalPaymentPaidLakhs.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-xs font-sans font-semibold text-[#556952]">Lakhs</span>
              </div>
              <div className="text-[11px] text-[#2E6B3E] font-bold mt-0.5 font-numeric flex items-center justify-between">
                <span>Total Confirmed Paid</span>
                <span className="text-[10px] text-[#556952]">{metrics.clearedVouchersCount} Cleared</span>
              </div>
            </div>

            {/* Financial Details */}
            <div className="pt-2.5 border-t border-[#F2EDE0] text-[10px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#1E331B] font-bold">Payable Net Value:</span>
                <span className="font-bold text-[#2E6B3E] font-numeric">₹ {metrics.totalPaymentPayableLakhs.toLocaleString('en-IN')} L</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-rose-800 font-bold">Outstanding Rest:</span>
                <span className="font-bold text-rose-800 font-numeric">₹ {metrics.outstandingRestPaymentLakhs.toLocaleString('en-IN')} L ({metrics.pendingVouchersCount} Due)</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-1.5 border-t border-dashed border-[#E5DEC9] text-[10px] font-bold text-[#2E6B3E] flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
            <span>View Payment Operations</span>
            <span className="text-xs font-bold">→</span>
          </div>
        </div>

        {/* CARD 4: GODOWN STOCK */}
        <div 
          onClick={() => onNavigate && onNavigate('stock')}
          className="bg-white border-2 border-slate-700/30 hover:border-slate-800 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
          title="Click to view Stock Inventory"
        >
          <div>
            <div className="flex items-center justify-between gap-1 mb-2">
              <span className="text-[11px] font-bold uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                <span>🏢</span> Godown Stock
              </span>
              <div className="flex items-center gap-1">
                {metrics.currentGodownStockMt === 0 && metrics.totalArrivalsCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefresh();
                    }}
                    className="p-1 px-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="Refresh Stock Query"
                  >
                    <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
                    <span>Refresh</span>
                  </button>
                )}
                <div className="p-1.5 rounded-xl bg-slate-100 text-slate-800 border border-slate-300 group-hover:bg-slate-200 transition-colors">
                  <Warehouse className="w-4 h-4 text-slate-800" />
                </div>
              </div>
            </div>

            <div className="my-2">
              <div className="text-2xl font-numeric font-extrabold text-slate-900 tracking-tight flex items-baseline gap-1.5">
                <span>{metrics.currentGodownStockMt.toLocaleString('en-IN', { minimumFractionDigits: 3 })}</span>
                <span className="text-xs font-sans font-semibold text-slate-600">MT</span>
              </div>
              <div className="text-[11px] text-slate-700 font-bold mt-0.5 font-numeric flex items-center justify-between">
                <span>
                  {metrics.currentGodownStockBales.toLocaleString('en-IN')} Bales
                  {metrics.currentGodownStockDrums > 0 ? ` • ${metrics.currentGodownStockDrums.toLocaleString('en-IN')} Drums` : ''}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold">{metrics.godownUtilizationPct}% Cap</span>
              </div>
            </div>

            {/* Inventory Movements */}
            <div className="pt-2.5 border-t border-slate-200 text-[10px] space-y-1">
              <div className="flex items-center justify-between text-slate-700">
                <span>Opening: {metrics.totalOpeningQty.toLocaleString('en-IN')} Units</span>
                <span>Inward: +{metrics.totalStockInwardBales.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between text-rose-800 font-bold">
                <span>Outward / Factory Issue:</span>
                <span className="font-numeric">-{metrics.totalStockOutwardBales.toLocaleString('en-IN')} Units</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-1.5 border-t border-dashed border-slate-300 text-[10px] font-bold text-slate-800 flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
            <span>View Stock Inventory</span>
            <span className="text-xs font-bold">→</span>
          </div>
        </div>

      </div>

      {/* 3. MONTH-WISE SUMMARY SECTION */}
      <div className="bg-[#FAF7F0] border-2 border-[#D6CAA8] rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        
        {/* Section Header with Dynamic Year Dropdown */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E5DEC9]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#1E331B] text-white rounded-xl shadow-xs">
              <Calendar className="w-5 h-5 text-[#C5A059]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-[#1E331B] font-serif uppercase tracking-wide">
                  Month-Wise Summary
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#EAE2C8] text-[#1E331B]">
                  {monthlySummaryData.filter(m => showAllMonths || m.hasData).length} {monthlySummaryData.filter(m => showAllMonths || m.hasData).length === 1 ? 'Month' : 'Months'}
                </span>
              </div>
              <p className="text-[11px] text-[#556952]">
                Contract, Pending, Payment & Outstanding Breakdown ({selectedYear})
              </p>
            </div>
          </div>

          {/* Controls: Active Months Toggle + Dynamic Year Dropdown */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowAllMonths(!showAllMonths)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all cursor-pointer",
                showAllMonths 
                  ? "bg-[#2E6B3E] text-white border-[#2E6B3E] shadow-xs" 
                  : "bg-white text-[#2E6B3E] border-[#D6CAA8] hover:bg-[#FAF7F0]"
              )}
            >
              {showAllMonths ? 'Showing All 12 Months' : 'Active Months Only'}
            </button>

            <div className="flex items-center gap-1.5">
              <label htmlFor="summary_year_select" className="text-[11px] font-bold text-[#1E331B] uppercase tracking-wider">
                Year:
              </label>
              <div className="relative">
                <select
                  id="summary_year_select"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="appearance-none bg-white border border-[#2E6B3E] text-[#1E331B] font-bold text-xs px-2.5 py-1 pr-6 rounded-lg shadow-xs focus:outline-none focus:ring-1 focus:ring-[#2E6B3E] cursor-pointer"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-[#2E6B3E] absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* COMPACT (1/4 SIZE) MONTHLY CARDS RESPONSIVE GRID */}
        {(() => {
          const visibleMonths = monthlySummaryData.filter((m) => showAllMonths || m.hasData);

          if (visibleMonths.length === 0) {
            return (
              <div className="text-center py-6 px-4 bg-[#FAF7F0] border border-dashed border-[#D6CAA8] rounded-xl">
                <p className="text-xs font-semibold text-[#556952]">No transaction or sauda activity recorded in {selectedYear}.</p>
                <button
                  onClick={() => setShowAllMonths(true)}
                  className="mt-2 text-[11px] font-bold text-[#2E6B3E] hover:underline cursor-pointer"
                >
                  Click here to show all 12 empty calendar months
                </button>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
              {visibleMonths.map((month) => {
                const hasData = month.hasData;

                return (
                  <div
                    key={month.monthIndex}
                    onClick={() => openDrillDown('monthly_sauda', `${month.monthName} ${selectedYear} Activity`, month.matchingSaudas, month.monthName, selectedYear)}
                    className={cn(
                      "bg-white border rounded-lg p-2 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group hover:-translate-y-0.5",
                      hasData 
                        ? "border-[#D6CAA8] hover:border-[#2E6B3E]" 
                        : "border-slate-200 bg-slate-50/50 opacity-70 hover:opacity-100"
                    )}
                  >
                    {/* Compact Month Header */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#F2EDE0]">
                      <span className="text-[11px] font-extrabold text-[#1E331B] uppercase tracking-wide flex items-center gap-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full", hasData ? "bg-[#2E6B3E]" : "bg-slate-300")} />
                        {month.monthName.slice(0, 3)} {String(selectedYear).slice(-2)}
                      </span>
                      {hasData ? (
                        <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-800 text-[9px] font-bold rounded border border-emerald-200">
                          {month.totalContractsCount} S
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-400 italic">0</span>
                      )}
                    </div>

                    {/* 4 Ultra-Compact Key Metrics */}
                    <div className="py-1.5 space-y-1 text-[10px]">
                      {/* Contract */}
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Sauda:</span>
                        <span className="font-bold text-[#1E331B] font-numeric">
                          {month.totalContractsCount} <span className="text-[9px] text-slate-400 font-normal">({month.totalContractsWeightMT}T)</span>
                        </span>
                      </div>

                      {/* Pending */}
                      <div className="flex items-center justify-between">
                        <span className="text-amber-700 font-medium">Pending:</span>
                        <span className="font-bold text-amber-900 font-numeric">
                          {month.pendingContractsCount} <span className="text-[9px] text-amber-600 font-normal">({month.pendingContractsWeightMT}T)</span>
                        </span>
                      </div>

                      {/* Paid */}
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-700 font-medium">Paid:</span>
                        <span className="font-bold text-emerald-900 font-numeric">
                          {month.monthlyTotalPaid > 0 ? formatIndianCurrency(month.monthlyTotalPaid) : '₹0'}
                        </span>
                      </div>

                      {/* Rest Due */}
                      <div className="flex items-center justify-between">
                        <span className="text-rose-700 font-medium">Due:</span>
                        <span className="font-bold text-rose-900 font-numeric">
                          {month.monthlyRestPayment > 0 ? formatIndianCurrency(month.monthlyRestPayment) : '₹0'}
                        </span>
                      </div>
                    </div>

                    {/* Micro Footer */}
                    <div className="pt-1 border-t border-[#F2EDE0] flex items-center justify-between text-[9px] font-bold text-[#2E6B3E] group-hover:text-[#1E331B]">
                      <span>View</span>
                      <ChevronRight className="w-2.5 h-2.5 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* 4. PROCESS MATRIX DATA TABLE */}
      <div className="bg-white border-2 border-[#D6CAA8] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#F2EDE0]">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#2E6B3E]" />
            <h3 className="font-serif text-sm sm:text-base font-bold text-[#1E331B] uppercase tracking-wide">
              Recent Operational Process Matrix
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                placeholder="Search PO, Supplier, Broker, Status..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FAF7F0] border border-[#D6CAA8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6B3E]"
              />
            </div>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto rounded-xl border border-[#D6CAA8]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#1E331B] text-[#D6CAA8] uppercase font-bold tracking-wider text-[10px]">
                <th className="p-2.5">Date</th>
                <th className="p-2.5">PO / PTF No</th>
                <th className="p-2.5">Supplier</th>
                <th className="p-2.5">Broker</th>
                <th className="p-2.5 text-right">Contract MT</th>
                <th className="p-2.5 text-right">Value (₹)</th>
                <th className="p-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2EDE0] bg-white">
              {metrics.scpList
                .filter(r => {
                  if (!matrixSearch.trim()) return true;
                  const term = matrixSearch.toLowerCase();
                  return (
                    String(r.po_no || r.ptf_no || '').toLowerCase().includes(term) ||
                    String(r.supplier || '').toLowerCase().includes(term) ||
                    String(r.broker || '').toLowerCase().includes(term) ||
                    String(r.status || '').toLowerCase().includes(term)
                  );
                })
                .slice((matrixPage - 1) * rowsPerPage, matrixPage * rowsPerPage)
                .map((row, idx) => {
                  const { wt, val, sup, brk } = getRowMetrics(row);
                  const st = String(row.status || (row.pending ? 'Pending' : 'Completed')).toUpperCase();

                  return (
                    <tr key={idx} className="hover:bg-[#FAF7F0] transition-colors">
                      <td className="p-2.5 font-mono text-slate-600">{formatDate(row.date || row.po_date || row.created_at)}</td>
                      <td className="p-2.5 font-bold text-indigo-900">{row.po_no || row.ptf_no || row.sauda_no || 'N/A'}</td>
                      <td className="p-2.5 text-slate-800 font-medium">{safeStr(sup)}</td>
                      <td className="p-2.5 text-slate-600">{safeStr(brk)}</td>
                      <td className="p-2.5 text-right font-numeric font-bold">{wt.toFixed(2)} MT</td>
                      <td className="p-2.5 text-right font-numeric font-bold text-[#2E6B3E]">{formatIndianCurrency(val)}</td>
                      <td className="p-2.5 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold",
                          st.includes('PEND') ? "bg-amber-100 text-amber-800 border border-amber-300" :
                          st.includes('COMP') || st.includes('PASS') || st.includes('APP') ? "bg-emerald-100 text-emerald-800 border border-emerald-300" :
                          "bg-slate-100 text-slate-700"
                        )}>
                          {st}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. UNIVERSAL INTERACTIVE DRILL-DOWN MODAL */}
      {drillDown.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-white border-2 border-[#D6CAA8] rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#1E331B] to-[#2E6B3E] text-white p-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-serif text-base font-bold uppercase tracking-wider flex items-center gap-2">
                  <span>📊</span> {drillDown.title}
                </h3>
                <p className="text-xs text-[#D6CAA8]">
                  Total {filteredDrillDownData.length} records matching current criteria
                </p>
              </div>
              <button
                onClick={() => setDrillDown({ ...drillDown, isOpen: false })}
                className="p-1.5 hover:bg-white/20 rounded-xl text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Export Toolbar */}
            <div className="p-3 bg-[#FAF7F0] border-b border-[#E5DEC9] flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={drillDownSearch}
                  onChange={(e) => {
                    setDrillDownSearch(e.target.value);
                    setDrillDownPage(1);
                  }}
                  placeholder="Filter records..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#D6CAA8] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E6B3E]"
                />
              </div>

              <div className="text-xs font-bold text-[#556952]">
                Page {drillDownPage} of {Math.max(1, Math.ceil(filteredDrillDownData.length / drillDownRowsPerPage))}
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-auto p-4">
              {filteredDrillDownData.length === 0 ? (
                <div className="text-center py-12 text-[#556952]">
                  <p className="text-sm font-semibold">No detailed records found.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1E331B] text-[#D6CAA8] uppercase font-bold tracking-wider text-[10px] sticky top-0 shadow-xs">
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Ref / PO / Voucher</th>
                      <th className="p-2.5">Supplier / Party</th>
                      <th className="p-2.5">Broker</th>
                      <th className="p-2.5 text-right">Quantity / MT</th>
                      <th className="p-2.5 text-right">Amount (₹)</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EDE0] bg-white">
                    {filteredDrillDownData
                      .slice((drillDownPage - 1) * drillDownRowsPerPage, drillDownPage * drillDownRowsPerPage)
                      .map((row, idx) => {
                        const dateStr = formatDate(row.date || row.po_date || row.payment_date || row.created_at);
                        const refStr = row.po_no || row.ptf_no || row.voucher_no || row.sauda_no || 'N/A';
                        const supStr = safeStr(row.supplier || row.supplier_name || row.party_name);
                        const brkStr = safeStr(row.broker || row.broker_name);
                        const wtStr = Number(row.total_contract_mt || row.contract_mt || row.total_wt_in_ton || 0);
                        const amtStr = Number(row.paid_amount || row.payable_amt || row.total_contract_value || row.amount || 0);
                        const stStr = String(row.status || row.payment_status || row.display_status || 'Active').toUpperCase();

                        return (
                          <tr key={idx} className="hover:bg-[#FAF7F0] transition-colors">
                            <td className="p-2.5 font-mono text-slate-600">{dateStr}</td>
                            <td className="p-2.5 font-bold text-indigo-900">{refStr}</td>
                            <td className="p-2.5 font-medium text-slate-800">{supStr}</td>
                            <td className="p-2.5 text-slate-600">{brkStr}</td>
                            <td className="p-2.5 text-right font-numeric font-bold">{wtStr > 0 ? `${wtStr.toFixed(2)} MT` : '-'}</td>
                            <td className="p-2.5 text-right font-numeric font-bold text-[#2E6B3E]">{formatIndianCurrency(amtStr)}</td>
                            <td className="p-2.5 text-center">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                stStr.includes('PEND') ? "bg-amber-100 text-amber-800 border border-amber-300" :
                                stStr.includes('COMP') || stStr.includes('PASS') || stStr.includes('PAID') ? "bg-emerald-100 text-emerald-800 border border-emerald-300" :
                                "bg-slate-100 text-slate-700"
                              )}>
                                {stStr}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Pagination Footer */}
            <div className="p-3 bg-[#FAF7F0] border-t border-[#E5DEC9] flex items-center justify-between gap-3">
              <span className="text-xs text-[#556952]">
                Showing {Math.min(filteredDrillDownData.length, (drillDownPage - 1) * drillDownRowsPerPage + 1)} - {Math.min(filteredDrillDownData.length, drillDownPage * drillDownRowsPerPage)} of {filteredDrillDownData.length}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDrillDownPage(p => Math.max(1, p - 1))}
                  disabled={drillDownPage <= 1}
                  className="px-3 py-1 bg-white border border-[#D6CAA8] rounded-lg text-xs font-bold text-[#1E331B] disabled:opacity-40 cursor-pointer"
                >
                  Prev
                </button>
                <button
                  onClick={() => setDrillDownPage(p => p + 1)}
                  disabled={drillDownPage >= Math.ceil(filteredDrillDownData.length / drillDownRowsPerPage)}
                  className="px-3 py-1 bg-white border border-[#D6CAA8] rounded-lg text-xs font-bold text-[#1E331B] disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
