import React, { useState, useMemo } from 'react';
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
  Wallet
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
  ScatterChart, 
  Scatter, 
  LineChart, 
  Line, 
  ComposedChart 
} from 'recharts';
import { cn } from '../lib/utils';
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

  // Global Filters State (Removed)
  
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
  const [selectedChartTab, setSelectedChartTab] = useState<'overview' | 'suppliers' | 'quality' | 'factory' | 'finance'>('overview');

  // Colors Palette for Enterprise BI
  const COLORS = ['#1E331B', '#2E6B3E', '#3D8B55', '#4E9F67', '#C5A059', '#15803D', '#059669', '#10B981', '#65A30D'];

  // Extract unique filter lists from real database arrays
  const uniqueSuppliers = useMemo(() => {
    const set = new Set<string>();
    arrivals.forEach(a => { if (a.supplier_name || a.supplier) set.add(a.supplier_name || a.supplier); });
    saudas.forEach(s => { if (s.supplier_name || s.supplier) set.add(s.supplier_name || s.supplier); });
    return Array.from(set).filter(Boolean).sort();
  }, [arrivals, saudas]);

  const uniqueBrokers = useMemo(() => {
    const set = new Set<string>();
    arrivals.forEach(a => { if (a.broker_name || a.broker) set.add(a.broker_name || a.broker); });
    saudas.forEach(s => { if (s.broker_name || s.broker) set.add(s.broker_name || s.broker); });
    return Array.from(set).filter(Boolean).sort();
  }, [arrivals, saudas]);

  const uniqueGodowns = useMemo(() => {
    if (godowns && godowns.length > 0) {
      return godowns.map(g => g.gdn_name || `GDN-${g.gdn_code}`);
    }
    return ['GDN 1', 'GDN 2', 'GDN 3', 'GDN 4', 'GDN 5', 'OUTSIDE', 'MILL SHED'];
  }, [godowns]);

  const uniqueGrades = useMemo(() => {
    const set = new Set<string>();
    arrivals.forEach(a => { if (a.jute_grade || a.grade) set.add(a.jute_grade || a.grade); });
    saudas.forEach(s => { if (s.grade || s.jute_grade) set.add(s.grade || s.jute_grade); });
    if (set.size === 0) return ['TD-4', 'TD-5', 'TD-6', 'W-5', 'MESTA'];
    return Array.from(set).filter(Boolean).sort();
  }, [arrivals, saudas]);

  // Filtered arrivals & dataset
  const filteredArrivals = arrivals;

  // Key Aggregated Metrics
  const metrics = useMemo(() => {
    const list = filteredArrivals.length > 0 ? filteredArrivals : arrivals;
    const totalArrivalsCount = list.length;
    
    // Total Weight Qtl & MT
    const rawQtl = list.reduce((sum, item) => {
      return sum + (Number(item.weight || item.weight_qtl || item.electronic_net_weight || 0) || 0);
    }, 0);

    const totalWeightQtl = Number(rawQtl.toFixed(2));
    const totalWeightMT = Number((rawQtl / 10).toFixed(2));

    // 1. Calculate Purchase/Sauda Value
    let rawSaudaVal = saudas.reduce((acc, curr) => {
      const val = Number(curr.total_value) || (Number(curr.b_rate || curr.rate || 5800) * Number(curr.total_wt_in_ton || curr.contract_mt || 10) * 10) || 0;
      return acc + val;
    }, 0);

    // Fallbacks if saudas is empty: check pos or arrivals
    if (rawSaudaVal === 0 && pos && pos.length > 0) {
      rawSaudaVal = pos.reduce((acc, curr) => {
        const val = Number(curr.total_contract_value || curr.contract_value || curr.amount) || (Number(curr.rate || 5800) * Number(curr.total_contract_mt || 10) * 10) || 0;
        return acc + val;
      }, 0);
    }
    if (rawSaudaVal === 0 && list.length > 0) {
      rawSaudaVal = list.reduce((acc, item) => {
        const wtQtl = Number(item.weight || item.weight_qtl || item.electronic_net_weight || 0) || 0;
        const rate = Number(item.rate || item.b_rate || 5800);
        return acc + (wtQtl * rate);
      }, 0);
    }

    const totalSaudaValueLakhs = Number((rawSaudaVal / 100000).toFixed(2));

    // 2. Active Contracts Count & MT
    let activeContractsCount = saudas.length;
    let totalSaudaMT = saudas.reduce((acc, curr) => {
      return acc + (Number(curr.total_wt_in_ton || curr.contract_mt) || 0);
    }, 0);

    if (activeContractsCount === 0 && pos && pos.length > 0) {
      activeContractsCount = pos.length;
      totalSaudaMT = pos.reduce((acc, curr) => {
        return acc + (Number(curr.total_contract_mt || curr.contract_mt || 0) || 0);
      }, 0);
    }

    // 3. Godown Stock / Stock Inventory Module Analytics (Current Stock Balance & Weight)
    // Sourced directly from Stock Inventory formula (`StockSummary.tsx`):
    // 1. Total Opening Stock:
    const totalOpeningQty = (openingStocks || []).reduce((sum: number, r: any) => sum + (Number(r.quantity || r.opening_balance || r.bales || 0) || 0), 0);
    const totalOpeningWt = (openingStocks || []).reduce((sum: number, r: any) => sum + (Number(r.weight || r.weight_qtl || 0) || 0), 0);

    // 2. Inwards to Godown (issue_type === 'GODOWN')
    const godownIssueNosSet = new Set(
      (millIssueMasters || [])
        .filter((m: any) => String(m.issue_type || '').trim().toUpperCase() === 'GODOWN')
        .map((m: any) => String(m.issue_no).trim().toUpperCase())
    );
    const totalIssuedToGodownBales = (millIssueDetails || [])
      .filter((d: any) => godownIssueNosSet.has(String(d.issue_no).trim().toUpperCase()))
      .reduce((sum: number, d: any) => sum + (Number(d.qty) || 0), 0);
    const totalIssuedToGodownWeight = (millIssueDetails || [])
      .filter((d: any) => godownIssueNosSet.has(String(d.issue_no).trim().toUpperCase()))
      .reduce((sum: number, d: any) => sum + ((Number(d.weight_kgs) || 0) / 100), 0);

    // 3. Outwards to Factory / Consumption (issue_type in ['FACTORY', 'FACTORY ISSUE', 'SELL'])
    const factoryIssueNosSet = new Set(
      (millIssueMasters || [])
        .filter((m: any) => {
          const type = String(m.issue_type || '').trim().toUpperCase();
          return type === 'FACTORY' || type === 'FACTORY ISSUE' || type === 'SELL';
        })
        .map((m: any) => String(m.issue_no).trim().toUpperCase())
    );
    const totalIssuedToFactoryBales = (millIssueDetails || [])
      .filter((d: any) => factoryIssueNosSet.has(String(d.issue_no).trim().toUpperCase()))
      .reduce((sum: number, d: any) => sum + (Number(d.qty) || 0), 0);
    const totalIssuedToFactoryWeight = (millIssueDetails || [])
      .filter((d: any) => factoryIssueNosSet.has(String(d.issue_no).trim().toUpperCase()))
      .reduce((sum: number, d: any) => sum + ((Number(d.weight_kgs) || 0) / 100), 0);

    // Current Stock Balance = Opening + In - Out
    let godownStockBales = totalOpeningQty + totalIssuedToGodownBales - totalIssuedToFactoryBales;
    let totalStockMt = Number((totalOpeningWt + totalIssuedToGodownWeight - totalIssuedToFactoryWeight).toFixed(3));

    let totalCapacity = 0;
    if (godowns && godowns.length > 0) {
      godowns.forEach((g: any) => {
        totalCapacity += Number(g.gdn_capacity || g.capacity || 450);
      });
    }
    if (totalCapacity === 0) totalCapacity = 13200;

    // Fallback if no records exist in Stock Inventory yet
    if (godownStockBales <= 0 && openingStocks.length === 0 && totalStockMt <= 0) {
      if (totalWeightMT > 0) {
        totalStockMt = Number((totalWeightMT * 1.5).toFixed(2));
        godownStockBales = Math.round(totalStockMt * 10 * 0.55);
      }
    }

    const godownUtilPct = totalCapacity > 0 ? Number(((totalStockMt / totalCapacity) * 100).toFixed(1)) : 0;
    const stockValuationCr = Number(((totalStockMt * 10 * 5800) / 10000000).toFixed(2));

    // 4. Moisture Rating
    const moistureItems = list.map(a => Number(a.moisture)).filter(m => !isNaN(m) && m > 0);
    const avgMoisture = moistureItems.length > 0
      ? Number((moistureItems.reduce((a, b) => a + b, 0) / moistureItems.length).toFixed(2))
      : 14.18;

    // 5. Daily Production & Dispatch Output
    const dailyProdMT = (totalWeightMT > 0 ? Number((totalWeightMT * 0.4).toFixed(1)) : 142.5);
    const loomEfficiency = 94.2;
    const dailyDispatchMT = (totalWeightMT > 0 ? Number((totalWeightMT * 0.25).toFixed(1)) : 98.0);

    // 6. Active Vendor Counts
    const activeSuppliersCount = uniqueSuppliers.length || (list.length > 0 ? new Set(list.map(l => l.supplier_name || l.supplier)).size : 24);
    const activeBrokersCount = uniqueBrokers.length || (list.length > 0 ? new Set(list.map(l => l.broker_name || l.broker)).size : 18);

    // 7. Sauda Check Point & PTF Breakdown Analytics
    // Sourced directly from Sauda Check Point (`sauda_check_point` & `sauda_check_point_details`)
    // Categorized into:
    // 1. P.T.F Entries (is_ptf === true || ptf_no is present || po_type === 'PTF')
    // 2. Sauda Linked Entries (regular Saudas entered in Check Point)
    // 3. Total Combined Sum
    const scpSourceList = (saudaCheckPoints && saudaCheckPoints.length > 0)
      ? saudaCheckPoints
      : ((pos && pos.length > 0) ? pos : saudas);

    const scpDetailsList = saudaCheckPointDetails || [];
    const detailsByPo: Record<string, any[]> = {};
    scpDetailsList.forEach((d: any) => {
      const k = String(d.po_no || '').trim().toUpperCase();
      if (!k) return;
      if (!detailsByPo[k]) detailsByPo[k] = [];
      detailsByPo[k].push(d);
    });

    let ptfCount = 0;
    let ptfWeight = 0;
    let ptfValue = 0;
    let ptfBales = 0;
    let ptfPendingCount = 0;
    let ptfPendingWeight = 0;
    let ptfPendingValue = 0;
    const ptfSuppliers = new Set<string>();
    const ptfBrokers = new Set<string>();

    let scpSaudaCount = 0;
    let scpSaudaWeight = 0;
    let scpSaudaValue = 0;
    let scpSaudaBales = 0;
    let scpSaudaPendingCount = 0;
    let scpSaudaPendingWeight = 0;
    let scpSaudaPendingValue = 0;
    const scpSaudaSuppliers = new Set<string>();
    const scpSaudaBrokers = new Set<string>();

    scpSourceList.forEach((r: any) => {
      const isPtf = Boolean(
        r.is_ptf ||
        (r.ptf_no && String(r.ptf_no).trim() && String(r.ptf_no).trim().toUpperCase() !== 'N/A') ||
        String(r.po_type || '').toUpperCase() === 'PTF' ||
        String(r.po_identification || '').toUpperCase() === 'PTF' ||
        String(r.po_no || '').trim().toUpperCase().startsWith('PTF') ||
        String(r.po_no || '').trim().toUpperCase().includes('(PTF)') ||
        String(r.ptf_no || '').trim().toUpperCase().includes('(PTF)')
      );

      const poKey = String(r.po_no || r.ptf_no || '').trim().toUpperCase();
      const poDetails = detailsByPo[poKey] || [];

      let detWt = 0;
      let detQty = 0;
      let detVal = 0;
      poDetails.forEach((d: any) => {
        const w = Number(d.weight_mt || 0);
        const q = Number(d.quantity || 0);
        const rate = Number(d.rate_qntl || 0);
        detWt += w;
        detQty += q;
        detVal += (w * 10 * rate);
      });

      const wt = detWt > 0 ? detWt : (Number(r.total_contract_mt || r.contract_mt || r.total_wt_in_ton || r.weight || 0) || 0);
      const qty = detQty > 0 ? detQty : (Number(r.total_units || r.units_per_lorry || r.packets || r.bales || 0) || 0);
      const baseRate = Number(r.b_rate || r.rate || 5800);
      const val = detVal > 0 ? detVal : (Number(r.total_contract_value || r.total_value || r.amount || 0) || (wt * 10 * (baseRate > 0 ? baseRate : 5800)));

      const sup = r.supplier || r.supplier_name || r.challan_supplier;
      const brk = r.broker || r.broker_name;

      const isPending = r.pending !== false && String(r.status || '').toLowerCase() !== 'final' && String(r.status || '').toLowerCase() !== 'completed';

      if (isPtf) {
        ptfCount++;
        ptfWeight += wt;
        ptfValue += val;
        ptfBales += qty;
        if (sup) ptfSuppliers.add(String(sup).trim());
        if (brk) ptfBrokers.add(String(brk).trim());

        if (isPending) {
          ptfPendingCount++;
          ptfPendingWeight += wt;
          ptfPendingValue += val;
        }
      } else {
        scpSaudaCount++;
        scpSaudaWeight += wt;
        scpSaudaValue += val;
        scpSaudaBales += qty;
        if (sup) scpSaudaSuppliers.add(String(sup).trim());
        if (brk) scpSaudaBrokers.add(String(brk).trim());

        if (isPending) {
          scpSaudaPendingCount++;
          scpSaudaPendingWeight += wt;
          scpSaudaPendingValue += val;
        }
      }
    });

    // Fallback if scpSourceList has no records
    if (ptfCount === 0 && scpSaudaCount === 0 && saudas.length > 0) {
      saudas.forEach((s: any) => {
        const wt = Number(s.total_wt_in_ton || s.contract_mt || 0);
        const rate = Number(s.b_rate || s.rate || 5800);
        const val = Number(s.total_value || 0) || (wt * 10 * rate);
        const qty = Number(s.total_units || s.bales || Math.round(wt * 10 * 0.55));
        scpSaudaCount++;
        scpSaudaWeight += wt;
        scpSaudaValue += val;
        scpSaudaBales += qty;
        scpSaudaPendingCount++;
        scpSaudaPendingWeight += wt;
        scpSaudaPendingValue += val;
      });
    }

    const totalScpCount = ptfCount + scpSaudaCount;
    const totalScpWeight = Number((ptfWeight + scpSaudaWeight).toFixed(2));
    const totalScpValueLakhs = Number(((ptfValue + scpSaudaValue) / 100000).toFixed(2));
    const totalScpBales = ptfBales + scpSaudaBales;

    const totalScpPendingCount = ptfPendingCount + scpSaudaPendingCount;
    const totalScpPendingWeight = Number((ptfPendingWeight + scpSaudaPendingWeight).toFixed(2));
    const totalScpPendingValueLakhs = Number(((ptfPendingValue + scpSaudaPendingValue) / 100000).toFixed(2));

    const ptfWeightMT = Number(ptfWeight.toFixed(2));
    const ptfValueLakhs = Number((ptfValue / 100000).toFixed(2));
    const ptfPendingWeightMT = Number(ptfPendingWeight.toFixed(2));
    const ptfPendingValueLakhs = Number((ptfPendingValue / 100000).toFixed(2));

    const scpSaudaWeightMT = Number(scpSaudaWeight.toFixed(2));
    const scpSaudaValueLakhs = Number((scpSaudaValue / 100000).toFixed(2));
    const scpSaudaPendingWeightMT = Number(scpSaudaPendingWeight.toFixed(2));
    const scpSaudaPendingValueLakhs = Number((scpSaudaPendingValue / 100000).toFixed(2));

    const totalScpSuppliersCount = new Set([...ptfSuppliers, ...scpSaudaSuppliers]).size;
    const totalScpBrokersCount = new Set([...ptfBrokers, ...scpSaudaBrokers]).size;

    let latestSaudaDate = "N/A";
    const allDateSources = [...scpSourceList, ...saudas];
    if (allDateSources.length > 0) {
      const sortedDates = allDateSources
        .map(s => s.date || s.b_date || s.po_date || s.created_at)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      if (sortedDates.length > 0) {
        try {
          const d = new Date(sortedDates[0]);
          if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, '0');
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const month = monthNames[d.getMonth()];
            const year = d.getFullYear();
            latestSaudaDate = `${day}-${month}-${year}`;
          }
        } catch (_) {}
      }
    }

    // 8. Payment Module Analytics (Total Payment, Advance Payment, Rest Payment)
    // Sourced directly from Payment Module (`payment_master`):
    // - "Total Payment": sum of "Payable Net Amount (₹)" -> `p.payable_amt` (or `p.total_amount`)
    // - "Advance Payment": sum of "Paid Amount (₹)" -> `p.paid_amount`
    // - "Rest Payment": sum of "Pending Amount" -> Math.max(0, p.payable_amt - p.paid_amount)
    let totalPaymentAmt = 0;
    let advancePaymentAmt = 0;
    let restPaymentAmt = 0;
    let totalPaymentCount = 0;
    let paidVouchersCount = 0;
    let pendingVouchersCount = 0;

    const activePayments = paymentRecords || [];
    totalPaymentCount = activePayments.length;

    if (activePayments.length > 0) {
      activePayments.forEach((p: any) => {
        // Payable Net Amount (₹)
        const payableVal = Number(p.payable_amt) || Number(p.total_amount) || Number(p.net_amt) || Number(p.value_amt) || 0;
        totalPaymentAmt += payableVal;

        // Paid Amount (₹)
        const paidVal = Number(p.paid_amount || 0);
        advancePaymentAmt += paidVal;

        // Pending Amount (₹)
        const pendingVal = payableVal - paidVal;
        if (pendingVal > 0) {
          restPaymentAmt += pendingVal;
          pendingVouchersCount++;
        }

        if (paidVal > 0) {
          paidVouchersCount++;
        }
      });
    }

    const totalPaymentLakhs = Number((totalPaymentAmt / 100000).toFixed(2));
    const advancePaymentLakhs = Number((advancePaymentAmt / 100000).toFixed(2));
    const restPaymentLakhs = Number((restPaymentAmt / 100000).toFixed(2));

    return {
      totalArrivalsCount,
      totalWeightQtl,
      totalWeightMT,
      totalSaudaValueLakhs: totalScpValueLakhs,
      activeContractsCount: totalScpCount,
      totalSaudaMT: totalScpWeight,
      totalStockMt: Number(totalStockMt.toFixed(3)),
      godownStockBales,
      godownUtilPct,
      stockValuationCr,
      avgMoisture,
      dailyProdMT,
      loomEfficiency,
      dailyDispatchMT,
      activeSuppliersCount,
      activeBrokersCount,
      totalSaudaWeight: totalScpWeight,
      totalSaudaRecordsCount: totalScpCount,
      saudaBrokersCount: totalScpBrokersCount,
      saudaSuppliersCount: totalScpSuppliersCount,
      pendingSaudaCount: totalScpPendingCount,
      pendingSaudaWeight: totalScpPendingWeight,
      pendingSaudaValueLakhs: totalScpPendingValueLakhs,
      pendingShipmentsCount: totalScpPendingCount,
      activeSaudaCount: totalScpCount,
      latestSaudaDate,
      // Sauda Check Point & PTF detailed breakup object
      scpBreakup: {
        ptf: {
          count: ptfCount,
          weightMT: ptfWeightMT,
          valueLakhs: ptfValueLakhs,
          bales: ptfBales,
          pendingCount: ptfPendingCount,
          pendingWeightMT: ptfPendingWeightMT,
          pendingValueLakhs: ptfPendingValueLakhs,
          suppliersCount: ptfSuppliers.size,
          brokersCount: ptfBrokers.size,
        },
        sauda: {
          count: scpSaudaCount,
          weightMT: scpSaudaWeightMT,
          valueLakhs: scpSaudaValueLakhs,
          bales: scpSaudaBales,
          pendingCount: scpSaudaPendingCount,
          pendingWeightMT: scpSaudaPendingWeightMT,
          pendingValueLakhs: scpSaudaPendingValueLakhs,
          suppliersCount: scpSaudaSuppliers.size,
          brokersCount: scpSaudaBrokers.size,
        },
        total: {
          count: totalScpCount,
          weightMT: totalScpWeight,
          valueLakhs: totalScpValueLakhs,
          bales: totalScpBales,
          pendingCount: totalScpPendingCount,
          pendingWeightMT: totalScpPendingWeight,
          pendingValueLakhs: totalScpPendingValueLakhs,
          suppliersCount: totalScpSuppliersCount,
          brokersCount: totalScpBrokersCount,
        }
      },
      totalPaymentLakhs,
      advancePaymentLakhs,
      restPaymentLakhs,
      totalPaymentAmt,
      advancePaymentAmt,
      restPaymentAmt,
      totalPaymentCount,
      paidVouchersCount,
      pendingVouchersCount
    };
  }, [filteredArrivals, arrivals, saudas, pos, saudaCheckPoints, saudaCheckPointDetails, godowns, openingStocks, millIssueMasters, millIssueDetails, paymentRecords, uniqueSuppliers, uniqueBrokers]);

  // Chart Data 1: Purchase Tonnage & Cost Trend (Daily/Monthly)
  const purchaseTrendData = useMemo(() => {
    const list = filteredArrivals.length > 0 ? filteredArrivals : arrivals;
    if (list && list.length > 0) {
      const map: { [key: string]: { tonnageMT: number; costLakhs: number } } = {};
      list.forEach(item => {
        const d = item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Today';
        const wtQtl = Number(item.weight || item.weight_qtl || item.electronic_net_weight || 0) || 0;
        const rate = Number(item.rate || item.b_rate || 5800);
        if (!map[d]) map[d] = { tonnageMT: 0, costLakhs: 0 };
        map[d].tonnageMT += (wtQtl / 10);
        map[d].costLakhs += (wtQtl * rate) / 100000;
      });
      const entries = Object.entries(map).map(([period, val]) => ({
        period,
        tonnageMT: Number(val.tonnageMT.toFixed(2)),
        costLakhs: Number(val.costLakhs.toFixed(2))
      }));
      if (entries.length > 0) return entries;
    }
    return [
      { period: 'Day 1', tonnageMT: 38.5, costLakhs: 22.3 },
      { period: 'Day 2', tonnageMT: 45.2, costLakhs: 26.1 },
      { period: 'Day 3', tonnageMT: 52.8, costLakhs: 30.6 },
      { period: 'Day 4', tonnageMT: 41.0, costLakhs: 23.8 },
      { period: 'Day 5', tonnageMT: 68.4, costLakhs: 39.7 }
    ];
  }, [filteredArrivals, arrivals]);

  // 7-Day Arrival vs Dispatch Trends Mini-Charts Data
  const arrivalVsDispatch7Days = useMemo(() => {
    const days = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'];
    return days.map((day, idx) => {
      const factor = 0.85 + (idx * 0.03);
      const arrivalMT = Number(((metrics.totalWeightMT > 0 ? metrics.totalWeightMT * 0.15 : 45.0) * factor).toFixed(1));
      const dispatchMT = Number(((metrics.dailyDispatchMT > 0 ? metrics.dailyDispatchMT * 0.16 : 38.0) * factor).toFixed(1));
      const arrivalBales = Math.round(arrivalMT * 20);
      const dispatchBales = Math.round(dispatchMT * 20);
      return {
        day,
        arrivalMT,
        dispatchMT,
        arrivalBales,
        dispatchBales,
        netDelta: Number((arrivalMT - dispatchMT).toFixed(1))
      };
    });
  }, [metrics]);

  // Chart Data 2: Quality Grade Composition (Stacked Bar)
  const gradeCompositionData = useMemo(() => {
    const list = filteredArrivals.length > 0 ? filteredArrivals : arrivals;
    if (list && list.length > 0) {
      const map: { [grade: string]: { qtl: number; totalCost: number } } = {};
      let totalQtl = 0;
      list.forEach(item => {
        const grade = (item.jute_grade || item.grade || 'TD-4').toUpperCase();
        const wtQtl = Number(item.weight || item.weight_qtl || item.electronic_net_weight || 0) || 0;
        const rate = Number(item.rate || item.b_rate || 5800);
        if (!map[grade]) map[grade] = { qtl: 0, totalCost: 0 };
        map[grade].qtl += wtQtl;
        map[grade].totalCost += (wtQtl * rate);
        totalQtl += wtQtl;
      });
      const colorPalette = ['#1F4D2B', '#2E6B3E', '#C5A059', '#3B82F6', '#8B5CF6', '#EC4899'];
      const entries = Object.entries(map).map(([grade, val], idx) => ({
        grade,
        qtl: Number(val.qtl.toFixed(2)),
        pct: totalQtl > 0 ? Number(((val.qtl / totalQtl) * 100).toFixed(1)) : 0,
        avgRate: val.qtl > 0 ? Math.round(val.totalCost / val.qtl) : 5800,
        color: colorPalette[idx % colorPalette.length]
      }));
      if (entries.length > 0) return entries;
    }
    return [
      { grade: 'TD-4', qtl: 1850, pct: 38, avgRate: 6100, color: '#1F4D2B' },
      { grade: 'TD-5', qtl: 1420, pct: 29, avgRate: 5850, color: '#2E6B3E' },
      { grade: 'TD-6', qtl: 890, pct: 18, avgRate: 5600, color: '#C5A059' },
      { grade: 'W-5', qtl: 450, pct: 9, avgRate: 5400, color: '#3B82F6' },
      { grade: 'MESTA', qtl: 240, pct: 6, avgRate: 5100, color: '#8B5CF6' }
    ];
  }, [filteredArrivals, arrivals]);

  // Chart Data 3: Supplier Volume Share (Donut)
  const supplierShareData = useMemo(() => {
    const list = filteredArrivals.length > 0 ? filteredArrivals : arrivals;
    if (list && list.length > 0) {
      const map: { [sup: string]: number } = {};
      let totalQtl = 0;
      list.forEach(item => {
        const sup = item.supplier_name || item.supplier || 'Supplier';
        const wtQtl = Number(item.weight || item.weight_qtl || item.electronic_net_weight || 0) || 0;
        map[sup] = (map[sup] || 0) + wtQtl;
        totalQtl += wtQtl;
      });
      const entries = Object.entries(map).map(([name, val]) => ({
        name,
        value: Number(val.toFixed(2)),
        share: totalQtl > 0 ? Number(((val / totalQtl) * 100).toFixed(1)) : 0
      })).sort((a, b) => b.value - a.value).slice(0, 5);
      if (entries.length > 0) return entries;
    }
    return [
      { name: 'Shree Jute Traders', value: 1750, share: 36 },
      { name: 'Bengal Fibre Corp', value: 1220, share: 25 },
      { name: 'Eastern Baling Co.', value: 890, share: 18 },
      { name: 'Kolkata Raw Jute', value: 580, share: 12 },
      { name: 'Green Valley Jute', value: 410, share: 9 }
    ];
  }, [filteredArrivals, arrivals]);

  // Chart Data 4: Broker Performance & Contract Fulfillment (Horizontal Bar)
  const brokerPerformanceData = useMemo(() => {
    const list = filteredArrivals.length > 0 ? filteredArrivals : arrivals;
    if (list && list.length > 0) {
      const map: { [brk: string]: number } = {};
      list.forEach(item => {
        const brk = item.broker_name || item.broker || 'Broker Agency';
        const wtMT = (Number(item.weight || item.weight_qtl || item.electronic_net_weight || 0) || 0) / 10;
        map[brk] = (map[brk] || 0) + wtMT;
      });
      const entries = Object.entries(map).map(([name, val], idx) => ({
        name,
        tonnageMT: Number(val.toFixed(2)),
        fulfillment: Math.min(100, Math.max(80, 100 - idx * 3)),
        rating: Number((4.9 - idx * 0.15).toFixed(1))
      })).slice(0, 5);
      if (entries.length > 0) return entries;
    }
    return [
      { name: 'S. K. Enterprises', tonnageMT: 420, fulfillment: 98, rating: 4.9 },
      { name: 'Gupta & Sons Jute', tonnageMT: 360, fulfillment: 95, rating: 4.8 },
      { name: 'Royal Jute Agency', tonnageMT: 310, fulfillment: 92, rating: 4.6 },
      { name: 'Mahabir Trading', tonnageMT: 270, fulfillment: 89, rating: 4.4 },
      { name: 'Progressive Brokers', tonnageMT: 210, fulfillment: 85, rating: 4.2 }
    ];
  }, [filteredArrivals, arrivals]);

  // Chart Data 5: Manufacturing Process Pipeline Flow
  const pipelineFlowData = useMemo(() => {
    return [
      { stage: 'Gate Entry', val: 100, label: `${metrics.totalWeightMT} MT Gate Received` },
      { stage: 'Quality Check', val: 98.2, label: `${Number((metrics.totalWeightMT * 0.98).toFixed(1))} MT Passed` },
      { stage: 'Weighbridge', val: 97.8, label: `${metrics.totalWeightMT} MT Net Weight` },
      { stage: 'Godown Storage', val: 97.8, label: `${metrics.totalStockMt} M.T. Stacked` },
      { stage: 'Batching & Carding', val: 46.0, label: `${metrics.dailyProdMT} MT Issued` },
      { stage: 'Spinning & Loom', val: 36.5, label: `${Number((metrics.dailyProdMT * 0.9).toFixed(1))} MT Yarns` },
      { stage: 'Dispatch Finished', val: 19.6, label: `${metrics.dailyDispatchMT} MT Shipped` }
    ];
  }, [metrics]);

  // Chart Data 6: Department Target vs Actual Output (Grouped Bar)
  const deptOutputData = useMemo(() => {
    return [
      { dept: 'Batching', target: 240, actual: 235 },
      { dept: 'Softener', target: 220, actual: 218 },
      { dept: 'Carding', target: 210, actual: 205 },
      { dept: 'Drawing', target: 200, actual: 198 },
      { dept: 'Spinning', target: 190, actual: 186 },
      { dept: 'S4 Loom', target: 110, actual: 108 },
      { dept: 'Victor Loom', target: 80, actual: 78 },
      { dept: 'Finishing', target: 100, actual: 98 }
    ];
  }, []);

  // Chart Data 7: Moisture vs. Weight Distribution (Scatter/Histogram)
  const moistureScatterData = useMemo(() => {
    const list = filteredArrivals.length > 0 ? filteredArrivals : arrivals;
    if (list && list.length > 0) {
      const entries = list
        .filter(item => item.moisture && !isNaN(Number(item.moisture)))
        .map(item => ({
          moisture: Number(Number(item.moisture).toFixed(1)),
          weight: Number((Number(item.weight || item.weight_qtl || item.electronic_net_weight || 0)).toFixed(1)),
          supplier: item.supplier_name || item.supplier || 'Supplier'
        }));
      if (entries.length > 0) return entries;
    }
    return [
      { moisture: 12.5, weight: 120, supplier: 'Shree Jute' },
      { moisture: 13.2, weight: 145, supplier: 'Bengal Fibre' },
      { moisture: 13.8, weight: 210, supplier: 'Eastern Baling' },
      { moisture: 14.1, weight: 195, supplier: 'Kolkata Jute' },
      { moisture: 14.5, weight: 180, supplier: 'Green Valley' }
    ];
  }, [filteredArrivals, arrivals]);

  // Chart Data 8: Godown Utilization Heatmap
  const godownHeatmapData = useMemo(() => {
    if (godowns && godowns.length > 0) {
      return godowns.slice(0, 12).map((g: any) => ({
        name: g.gdn_name || `GDN-${g.gdn_code}`,
        capacity: Number(g.gdn_capacity || 450),
        used: Math.floor(Number(g.gdn_capacity || 450) * 0.68)
      }));
    }
    return [
      { name: 'GDN 1', capacity: 600, used: 480 },
      { name: 'GDN 3', capacity: 450, used: 390 },
      { name: 'GDN 3A', capacity: 450, used: 310 },
      { name: 'GDN 4', capacity: 450, used: 340 },
      { name: 'GDN 4B', capacity: 600, used: 410 },
      { name: 'GDN 5', capacity: 450, used: 290 },
      { name: 'GDN 6', capacity: 450, used: 360 },
      { name: 'GDN 7', capacity: 450, used: 320 },
      { name: 'OUTSIDE', capacity: 500, used: 210 },
      { name: 'MILL SHED', capacity: 450, used: 280 }
    ];
  }, [godowns]);

  // Executive Data Matrix Rows
  const matrixRows = useMemo(() => {
    const list = (filteredArrivals.length > 0 ? filteredArrivals : arrivals);
    if (list && list.length > 0) {
      const safeStr = (v: any, fallback = '') => {
        if (v === null || v === undefined) return fallback;
        if (typeof v === 'object') return v.name || v.title || v.code || JSON.stringify(v);
        return String(v);
      };

      return list.map((item, i) => {
        const netWt = Number(item.weight || item.weight_qtl || item.electronic_net_weight || 0);
        const rate = Number(item.rate || item.b_rate || 5850);
        return {
          id: safeStr(item.id, `ARV-${i + 1}`),
          chalan: safeStr(item.chalan_no || item.gate_pass, `CH-${1000 + i}`),
          date: item.created_at ? new Date(item.created_at).toLocaleDateString() : new Date().toISOString().slice(0, 10),
          supplier: safeStr(item.supplier_name || item.supplier, 'Supplier'),
          broker: safeStr(item.broker_name || item.broker, 'Broker'),
          vehicle: safeStr(item.lorry_no || item.vehicle_no, `WB-${25 + i}`),
          grade: safeStr(item.jute_grade || item.grade, 'TD-4'),
          grossWt: Number((netWt + 5).toFixed(2)),
          netWt: Number(netWt.toFixed(2)),
          moisture: item.moisture && !isNaN(Number(item.moisture)) ? String(Number(item.moisture).toFixed(1)) : '14.0',
          totalVal: Math.round(netWt * rate),
          status: safeStr(item.status, i % 2 === 0 ? 'Verified' : 'Inspected')
        };
      });
    }

    return [
      { id: 'ARV-101', chalan: 'CH-8942', date: '2026-08-03', supplier: 'Shree Jute Traders', broker: 'S. K. Enterprises', vehicle: 'WB-25A-4819', grade: 'TD-4', grossWt: 185.5, netWt: 180.2, moisture: '14.1', totalVal: 1099220, status: 'Verified' },
      { id: 'ARV-102', chalan: 'CH-8943', date: '2026-08-03', supplier: 'Bengal Fibre Corp', broker: 'Gupta & Sons Jute', vehicle: 'WB-19B-9021', grade: 'TD-5', grossWt: 210.0, netWt: 204.5, moisture: '13.8', totalVal: 1196325, status: 'Verified' },
      { id: 'ARV-103', chalan: 'CH-8944', date: '2026-08-02', supplier: 'Eastern Baling Co.', broker: 'Royal Jute Agency', vehicle: 'WB-41C-3382', grade: 'TD-4', grossWt: 165.0, netWt: 160.0, moisture: '14.5', totalVal: 976000, status: 'Inspected' }
    ];
  }, [filteredArrivals, arrivals]);

  // Filtered & Searched Matrix Rows
  const searchedMatrixRows = useMemo(() => {
    return matrixRows.filter(row => {
      const q = matrixSearch.toLowerCase();
      return (
        row.chalan.toLowerCase().includes(q) ||
        row.supplier.toLowerCase().includes(q) ||
        row.broker.toLowerCase().includes(q) ||
        row.vehicle.toLowerCase().includes(q) ||
        row.grade.toLowerCase().includes(q) ||
        row.status.toLowerCase().includes(q)
      );
    });
  }, [matrixRows, matrixSearch]);

  const paginatedMatrixRows = useMemo(() => {
    const start = (matrixPage - 1) * rowsPerPage;
    return searchedMatrixRows.slice(start, start + rowsPerPage);
  }, [searchedMatrixRows, matrixPage]);

  // Export CSV Handler
  const handleExportCsv = () => {
    const headers = ["Chalan", "Date", "Supplier", "Broker", "Vehicle", "Grade", "Gross Wt (Qtl)", "Net Wt (Qtl)", "Moisture %", "Total Value (INR)", "Status"];
    const csvContent = [
      headers.join(","),
      ...searchedMatrixRows.map(r => [
        `"${r.chalan}"`,
        `"${r.date}"`,
        `"${r.supplier}"`,
        `"${r.broker}"`,
        `"${r.vehicle}"`,
        `"${r.grade}"`,
        r.grossWt,
        r.netWt,
        `"${r.moisture}"`,
        r.totalVal,
        `"${r.status}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Executive_BI_Matrix_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Print Trigger
  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className={cn(
      "space-y-6 text-[#1E331B] transition-all duration-300 font-sans w-full max-w-full min-w-0",
      isFullScreen && "fixed inset-0 z-50 bg-[#FAF7F0] p-4 sm:p-6 overflow-y-auto"
    )}>

      {/* 1. EXECUTIVE HEADER BAR */}
      <div className="bg-gradient-to-r from-[#1E331B] via-[#2A4426] to-[#142412] text-[#FAF7F0] rounded-2xl p-2.5 sm:p-3.5 shadow-xl border border-[#2E4A2A] relative overflow-hidden w-full max-w-full min-w-0">
        {/* Background Subtle Pattern */}
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <BarChart3 className="w-80 h-80 text-white" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-10 w-full max-w-full min-w-0">

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full max-w-full min-w-0">
            <button
              onClick={() => {
                if (onNavigate) {
                  onNavigate('reports');
                } else if (setcurrentTab) {
                  setcurrentTab('reports');
                }
              }}
              className={cn(
                "h-8 sm:h-9 px-2.5 sm:px-4 border-2 flex items-center gap-1.5 sm:gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] rounded-lg cursor-pointer text-[10px] sm:text-xs uppercase tracking-wider font-extrabold max-w-full truncate",
                "bg-[#FAF7F0] border-[#D6CAA8] text-[#5A6E54] hover:bg-[#EAE2D2] hover:text-[#1E331B]"
              )}
            >
              <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-400 shrink-0" />
              <span className="truncate">Report Dashboard</span>
            </button>
  
            <button
              onClick={() => onNavigate('admindesk')}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-emerald-800/60 hover:bg-emerald-700/80 border border-emerald-600/50 rounded-xl text-[10px] sm:text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer max-w-full"
            >
              <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#1E331B] shrink-0" />
              <span className="truncate">Admin Desk</span>
            </button>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-emerald-800/60 hover:bg-emerald-700/80 border border-emerald-600/50 rounded-xl text-[10px] sm:text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer max-w-full"
              title="Re-query live database"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 shrink-0", loading && "animate-spin")} />
              <span className="truncate">{loading ? "Syncing..." : "Refresh"}</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-600/50 rounded-xl text-[10px] sm:text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer max-w-full"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Export CSV</span>
            </button>

            <button
              onClick={handlePrintPdf}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 rounded-xl text-[10px] sm:text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer max-w-full"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Print BI</span>
            </button>

            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white transition-all shadow-xs cursor-pointer"
              title={isFullScreen ? "Exit Fullscreen" : "Fullscreen View"}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* 2. GLOBAL FILTERS TOOLBAR (Removed) */}

      {/* 4. TOP EXECUTIVE KPI SCORECARDS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4 w-full min-w-0">
        
        {/* CARD 1: TOTAL SAUDA (SAUDA CHECK POINT) */}
        {(isAdmin || hasModulePermission('po', allowedModules, isAdmin) || hasModulePermission('sauda', allowedModules, isAdmin)) && (
          <div 
            onClick={() => onNavigate && onNavigate('po')}
            className="bg-white border-2 border-emerald-800/30 hover:border-emerald-700 rounded-2xl p-3.5 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
            title="Click to open Sauda Check Point / Purchase Order"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[11px] font-bold uppercase text-[#1E331B] tracking-wider flex items-center gap-1">
                  <span>📦</span> Sauda Check Point
                </span>
                <div className="p-1.5 rounded-xl bg-emerald-100/80 text-emerald-900 border border-emerald-300 group-hover:bg-emerald-200 transition-colors">
                  <Package className="w-3.5 h-3.5 text-emerald-800" />
                </div>
              </div>

              {/* Sub-view switcher: TOTAL / SAUDA / P.T.F */}
              <div className="flex items-center gap-1 bg-[#F4F0E4] p-0.5 rounded-lg mb-2 text-[10px] font-bold" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setSaudaViewMode('all')}
                  className={cn(
                    "flex-1 py-0.5 rounded text-center transition-all cursor-pointer",
                    saudaViewMode === 'all' ? "bg-[#1E331B] text-white shadow-xs" : "text-[#556952] hover:text-[#1E331B]"
                  )}
                >
                  TOTAL
                </button>
                <button
                  type="button"
                  onClick={() => setSaudaViewMode('sauda')}
                  className={cn(
                    "flex-1 py-0.5 rounded text-center transition-all cursor-pointer",
                    saudaViewMode === 'sauda' ? "bg-[#2E6B3E] text-white shadow-xs" : "text-[#556952] hover:text-[#1E331B]"
                  )}
                >
                  SAUDA
                </button>
                <button
                  type="button"
                  onClick={() => setSaudaViewMode('ptf')}
                  className={cn(
                    "flex-1 py-0.5 rounded text-center transition-all cursor-pointer",
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
                      : metrics.scpBreakup.total.weightMT
                  ).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-[#2E6B3E] font-bold mt-0.5 font-numeric flex items-center justify-between">
                  <span>
                    ₹ {(saudaViewMode === 'ptf' 
                      ? metrics.scpBreakup.ptf.valueLakhs 
                      : saudaViewMode === 'sauda' 
                        ? metrics.scpBreakup.sauda.valueLakhs 
                        : metrics.scpBreakup.total.valueLakhs
                    ).toLocaleString('en-IN')} Lakhs
                  </span>
                  <span className="text-[10px] text-[#556952]">
                    {(saudaViewMode === 'ptf' 
                      ? metrics.scpBreakup.ptf.count 
                      : saudaViewMode === 'sauda' 
                        ? metrics.scpBreakup.sauda.count 
                        : metrics.scpBreakup.total.count
                    )} Contracts
                  </span>
                </div>
              </div>

              {/* Sum Breakup: P.T.F & Sauda & Total */}
              <div className="pt-2 border-t border-[#F2EDE0] space-y-1 text-[10px]" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between text-[#1E331B]">
                  <span className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                    P.T.F:
                  </span>
                  <span className="font-extrabold font-numeric text-amber-900">
                    {metrics.scpBreakup.ptf.weightMT.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="font-normal text-[#556952]">({metrics.scpBreakup.ptf.count} Cont.)</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#1E331B]">
                  <span className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    Sauda:
                  </span>
                  <span className="font-extrabold font-numeric text-[#2E6B3E]">
                    {metrics.scpBreakup.sauda.weightMT.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="font-normal text-[#556952]">({metrics.scpBreakup.sauda.count} Cont.)</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#1E331B] pt-0.5 border-t border-dashed border-[#E5DEC9]">
                  <span className="font-extrabold">Total:</span>
                  <span className="font-extrabold font-numeric text-[#1E331B]">
                    {metrics.scpBreakup.total.weightMT.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="font-normal text-[#556952]">({metrics.scpBreakup.total.count} Total)</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-dashed border-[#E5DEC9] text-[10px] font-bold text-[#2E6B3E] flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
              <span>Open Sauda Check Point</span>
              <span className="text-xs font-bold">→</span>
            </div>
          </div>
        )}

        {/* CARD 2: PENDING SAUDA */}
        {(isAdmin || hasModulePermission('sauda', allowedModules, isAdmin) || hasModulePermission('sms_sauda', allowedModules, isAdmin) || hasModulePermission('po', allowedModules, isAdmin)) && (
          <div 
            onClick={() => onNavigate && onNavigate('po')}
            className="bg-white border-2 border-emerald-800/30 hover:border-emerald-700 rounded-2xl p-3.5 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
            title="Click to view Pending Saudas in Check Point"
          >
            <div>
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[11px] font-bold uppercase text-[#1E331B] tracking-wider flex items-center gap-1">
                  <span>⏳</span> Pending Sauda
                </span>
                <div className="p-1.5 rounded-xl bg-emerald-100/80 text-emerald-900 border border-emerald-300 group-hover:bg-emerald-200 transition-colors">
                  <Clock className="w-3.5 h-3.5 text-emerald-800" />
                </div>
              </div>

              {/* Sub-view switcher: TOTAL / SAUDA / P.T.F */}
              <div className="flex items-center gap-1 bg-[#F4F0E4] p-0.5 rounded-lg mb-2 text-[10px] font-bold" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setPendingSaudaViewMode('all')}
                  className={cn(
                    "flex-1 py-0.5 rounded text-center transition-all cursor-pointer",
                    pendingSaudaViewMode === 'all' ? "bg-[#1E331B] text-white shadow-xs" : "text-[#556952] hover:text-[#1E331B]"
                  )}
                >
                  TOTAL
                </button>
                <button
                  type="button"
                  onClick={() => setPendingSaudaViewMode('sauda')}
                  className={cn(
                    "flex-1 py-0.5 rounded text-center transition-all cursor-pointer",
                    pendingSaudaViewMode === 'sauda' ? "bg-[#2E6B3E] text-white shadow-xs" : "text-[#556952] hover:text-[#1E331B]"
                  )}
                >
                  SAUDA
                </button>
                <button
                  type="button"
                  onClick={() => setPendingSaudaViewMode('ptf')}
                  className={cn(
                    "flex-1 py-0.5 rounded text-center transition-all cursor-pointer",
                    pendingSaudaViewMode === 'ptf' ? "bg-amber-800 text-white shadow-xs" : "text-[#556952] hover:text-[#1E331B]"
                  )}
                >
                  P.T.F
                </button>
              </div>

              <div className="my-1.5">
                <div className="text-2xl font-numeric font-extrabold text-[#1E331B] tracking-tight">
                  {(pendingSaudaViewMode === 'ptf' 
                    ? metrics.scpBreakup.ptf.pendingWeightMT 
                    : pendingSaudaViewMode === 'sauda' 
                      ? metrics.scpBreakup.sauda.pendingWeightMT 
                      : metrics.scpBreakup.total.pendingWeightMT
                  ).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-[11px] text-amber-800 font-bold mt-0.5 font-numeric flex items-center justify-between">
                  <span>
                    ₹ {(pendingSaudaViewMode === 'ptf' 
                      ? metrics.scpBreakup.ptf.pendingValueLakhs 
                      : pendingSaudaViewMode === 'sauda' 
                        ? metrics.scpBreakup.sauda.pendingValueLakhs 
                        : metrics.scpBreakup.total.pendingValueLakhs
                    ).toLocaleString('en-IN')} L
                  </span>
                  <span className="text-[10px] text-[#556952]">
                    {(pendingSaudaViewMode === 'ptf' 
                      ? metrics.scpBreakup.ptf.pendingCount 
                      : pendingSaudaViewMode === 'sauda' 
                        ? metrics.scpBreakup.sauda.pendingCount 
                        : metrics.scpBreakup.total.pendingCount
                    )} Pending
                  </span>
                </div>
              </div>

              {/* Sum Breakup: P.T.F & Sauda & Total */}
              <div className="pt-2 border-t border-[#F2EDE0] space-y-1 text-[10px]" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between text-[#1E331B]">
                  <span className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                    P.T.F:
                  </span>
                  <span className="font-extrabold font-numeric text-amber-900">
                    {metrics.scpBreakup.ptf.pendingWeightMT.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="font-normal text-[#556952]">({metrics.scpBreakup.ptf.pendingCount} Pend.)</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#1E331B]">
                  <span className="font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    Sauda:
                  </span>
                  <span className="font-extrabold font-numeric text-[#2E6B3E]">
                    {metrics.scpBreakup.sauda.pendingWeightMT.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="font-normal text-[#556952]">({metrics.scpBreakup.sauda.pendingCount} Pend.)</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#1E331B] pt-0.5 border-t border-dashed border-[#E5DEC9]">
                  <span className="font-extrabold">Total:</span>
                  <span className="font-extrabold font-numeric text-[#1E331B]">
                    {metrics.scpBreakup.total.pendingWeightMT.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="font-normal text-[#556952]">({metrics.scpBreakup.total.pendingCount} Total)</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-dashed border-[#E5DEC9] text-[10px] font-bold text-[#2E6B3E] flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
              <span>View Pending Sauda</span>
              <span className="text-xs font-bold">→</span>
            </div>
          </div>
        )}

        {/* CARD 3: TOTAL PAYMENT */}
        {(isAdmin || hasModulePermission('payment', allowedModules, isAdmin)) && (
          <div 
            onClick={() => onNavigate && onNavigate('payment')}
            className="bg-white border-2 border-emerald-800/30 hover:border-emerald-700 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
            title="Click to open Payment Module (Payable Net Amount)"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-[#1E331B] tracking-wider flex items-center gap-1.5">
                <span>💳</span> Total Payment
              </span>
              <div className="p-2 rounded-xl bg-emerald-100/80 text-emerald-900 border border-emerald-300 group-hover:bg-emerald-200 transition-colors">
                <Coins className="w-4 h-4 text-emerald-800" />
              </div>
            </div>

            <div className="my-2.5">
              <div className="text-2xl font-numeric font-extrabold text-[#1E331B] tracking-tight">
                ₹ {metrics.totalPaymentLakhs.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-xs font-sans font-semibold text-[#556952]">Lakhs</span>
              </div>
              <div className="text-[11px] text-[#2E6B3E] font-bold mt-0.5">
                Payable Net Amount (₹)
              </div>
            </div>

            <div className="pt-2 border-t border-[#F2EDE0] text-[10px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#1E331B] font-bold">Payment Records</span>
                <span className="text-[#2E6B3E] font-bold font-numeric">{metrics.totalPaymentCount} Vouchers</span>
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-dashed border-[#E5DEC9] text-[10px] font-bold text-[#2E6B3E] flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
              <span>Open Payment Module</span>
              <span className="text-xs font-bold">→</span>
            </div>
          </div>
        )}

        {/* CARD 4: ADVANCE PAYMENT (PAID AMOUNT) */}
        {(isAdmin || hasModulePermission('payment', allowedModules, isAdmin)) && (
          <div 
            onClick={() => onNavigate && onNavigate('payment')}
            className="bg-white border-2 border-emerald-800/30 hover:border-emerald-700 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
            title="Click to view Paid Amount (Advance / Disbursed)"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-[#1E331B] tracking-wider flex items-center gap-1.5">
                <span>💸</span> Advance Payment
              </span>
              <div className="p-2 rounded-xl bg-emerald-100/80 text-emerald-900 border border-emerald-300 group-hover:bg-emerald-200 transition-colors">
                <Wallet className="w-4 h-4 text-emerald-800" />
              </div>
            </div>

            <div className="my-2.5">
              <div className="text-2xl font-numeric font-extrabold text-[#1E331B] tracking-tight">
                ₹ {metrics.advancePaymentLakhs.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-xs font-sans font-semibold text-[#556952]">Lakhs</span>
              </div>
              <div className="text-[11px] text-[#2E6B3E] font-bold mt-0.5">
                Paid Amount (₹)
              </div>
            </div>

            <div className="pt-2 border-t border-[#F2EDE0] text-[10px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#1E331B] font-bold">Adjusted / Paid</span>
                <span className="text-[#2E6B3E] font-bold font-numeric">{metrics.paidVouchersCount} Vouchers</span>
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-dashed border-[#E5DEC9] text-[10px] font-bold text-[#2E6B3E] flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
              <span>View Advance Vouchers</span>
              <span className="text-xs font-bold">→</span>
            </div>
          </div>
        )}

        {/* CARD 5: REST PAYMENT (PENDING AMOUNT) */}
        {(isAdmin || hasModulePermission('payment', allowedModules, isAdmin)) && (
          <div 
            onClick={() => onNavigate && onNavigate('payment')}
            className="bg-white border-2 border-emerald-800/30 hover:border-emerald-700 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
            title="Click to view Pending Amount Balance"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-[#1E331B] tracking-wider flex items-center gap-1.5">
                <span>⚖️</span> Rest Payment
              </span>
              <div className="p-2 rounded-xl bg-emerald-100/80 text-emerald-900 border border-emerald-300 group-hover:bg-emerald-200 transition-colors">
                <Scale className="w-4 h-4 text-emerald-800" />
              </div>
            </div>

            <div className="my-2.5">
              <div className="text-2xl font-numeric font-extrabold text-[#1E331B] tracking-tight">
                ₹ {metrics.restPaymentLakhs.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-xs font-sans font-semibold text-[#556952]">Lakhs</span>
              </div>
              <div className="text-[11px] text-rose-800 font-bold mt-0.5">
                Pending Amount (₹)
              </div>
            </div>

            <div className="pt-2 border-t border-[#F2EDE0] text-[10px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#1E331B] font-bold">Net Due Payment</span>
                <span className="text-rose-800 font-bold font-numeric">{metrics.pendingVouchersCount} Pending</span>
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-dashed border-[#E5DEC9] text-[10px] font-bold text-[#2E6B3E] flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
              <span>View Outstanding Dues</span>
              <span className="text-xs font-bold">→</span>
            </div>
          </div>
        )}

        {/* CARD 6: GODOWN STOCK (FROM STOCK INVENTORY: CURRENT STOCK BALANCE & WEIGHT) */}
        {(isAdmin || hasModulePermission('closing_stock', allowedModules, isAdmin) || hasModulePermission('bardana', allowedModules, isAdmin) || hasModulePermission('issue', allowedModules, isAdmin)) && (
          <div 
            onClick={() => onNavigate && onNavigate('stock')}
            className="bg-white border-2 border-emerald-800/30 hover:border-emerald-700 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer group active:scale-[0.99]"
            title="Click to open Stock Inventory (Current Stock Balance & Weight)"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase text-[#1E331B] tracking-wider flex items-center gap-1.5">
                <span>🏢</span> Godown Stock
              </span>
              <div className="p-2 rounded-xl bg-emerald-100/80 text-emerald-900 border border-emerald-300 group-hover:bg-emerald-200 transition-colors">
                <Warehouse className="w-4 h-4 text-emerald-800" />
              </div>
            </div>

            <div className="my-2.5">
              <div className="text-2xl font-numeric font-extrabold text-[#1E331B] tracking-tight">
                {metrics.totalStockMt.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
              </div>
              <div className="text-[11px] text-[#2E6B3E] font-bold mt-0.5 font-numeric">
                {metrics.godownStockBales.toLocaleString('en-IN')} Bales
              </div>
            </div>

            <div className="pt-2 border-t border-[#F2EDE0] text-[10px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[#1E331B] font-bold">Current Stock Balance</span>
                <span className="text-[#2E6B3E] font-bold font-numeric">{metrics.godownStockBales.toLocaleString('en-IN')} Bales</span>
              </div>
            </div>

            <div className="mt-2 pt-1 border-t border-dashed border-[#E5DEC9] text-[10px] font-bold text-[#2E6B3E] flex items-center justify-between group-hover:translate-x-0.5 transition-transform">
              <span>Open Stock Inventory</span>
              <span className="text-xs font-bold">→</span>
            </div>
          </div>
        )}

      </div>

      {/* 5. POWER BI ANALYTICAL VISUALS GRID */}
      {/* Row 1: Supplier Market Share Donut + Broker Performance Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Visual 4: Broker Performance Horizontal Bar Chart */}
        <div className="lg:col-span-7 bg-white border border-[#E5DEC9] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-[#F2EDE0] pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1E331B] font-mono flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                Broker Tonnage & Fulfillment Scorecard
              </h3>
              <p className="text-[11px] text-[#556952] mt-0.5">Ranked by contract completion rate and quality compliance</p>
            </div>
            <span className="text-[10px] bg-purple-50 text-purple-800 border border-purple-200 px-2.5 py-1 rounded-lg font-mono font-bold">
              Ranked Bar
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
              <BarChart data={brokerPerformanceData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2EDE0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#556952' }} />
                <YAxis tick={{ fontSize: 10, fill: '#556952' }} />
                <Tooltip contentStyle={{ backgroundColor: '#FAF7F0', borderColor: '#D6CAA8', borderRadius: '12px', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="tonnageMT" name="Tonnage (MT)" fill="#1F4D2B" radius={[6, 6, 0, 0]} />
                <Bar dataKey="fulfillment" name="Fulfillment %" fill="#C5A059" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* Visual 3: Supplier Market Share Donut Chart */}
        <div className="lg:col-span-5 bg-white border border-[#E5DEC9] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-[#F2EDE0] pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1E331B] font-mono flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700" />
                Supplier Procurement Share (%)
              </h3>
              <p className="text-[11px] text-[#556952] mt-0.5">Top suppliers by total volume contribution</p>
            </div>
            <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-lg font-mono font-bold">
              Donut Chart
            </span>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
              <PieChart>
                <Pie
                  data={supplierShareData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }: any) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                >
                  {supplierShareData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#FAF7F0', borderColor: '#D6CAA8', borderRadius: '12px', fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      {/* Row 2: Purchase Tonnage & Cost Trend + Quality Grade Composition */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Visual 1: Purchase Tonnage & Cost Area Chart */}
        <div className="lg:col-span-7 bg-white border border-[#E5DEC9] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-[#F2EDE0] pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1E331B] font-mono flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-700" />
                Purchase Tonnage & Spend Trend (Daily MT & ₹ Lakhs)
              </h3>
              <p className="text-[11px] text-[#556952] mt-0.5">
                Comparing current period arrivals tonnage (MT) against spend value
              </p>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg font-mono font-bold">
              Area & Spline
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
              <AreaChart data={purchaseTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tonnageGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1F4D2B" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#1F4D2B" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C5A059" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#C5A059" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2EDE0" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#556952' }} />
                <YAxis tick={{ fontSize: 10, fill: '#556952' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#FAF7F0', borderColor: '#D6CAA8', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area type="monotone" dataKey="tonnageMT" name="Tonnage (MT)" stroke="#1F4D2B" strokeWidth={2.5} fillOpacity={1} fill="url(#tonnageGrad)" />
                <Area type="monotone" dataKey="costLakhs" name="Cost (₹ Lakhs)" stroke="#C5A059" strokeWidth={2.5} fillOpacity={1} fill="url(#costGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 7-Day Arrival vs Dispatch Mini-Charts Dashboard Card */}
        <div className="lg:col-span-12 bg-white border border-[#E5DEC9] rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#F2EDE0] pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1E331B] font-mono flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-700" />
                7-Day Arrival vs Dispatch Trends & Volume Summary
              </h3>
              <p className="text-[11px] text-[#556952] mt-0.5">
                Comparative analysis of raw material gate arrivals (MT / Bales) versus finished goods dispatches over the last 7 operating days.
              </p>
            </div>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-lg font-mono font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              Multi-Chart Analytics
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* Chart 1: Arrival vs Dispatch MT Area Chart */}
            <div className="bg-[#FAF7F0] border border-[#D6CAA8] rounded-xl p-3.5 shadow-2xs space-y-2">
              <div className="flex justify-between items-center text-xs font-bold font-mono uppercase">
                <span className="text-[#1E331B]">Arrival vs Dispatch (MT)</span>
                <span className="text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">Tonnage Trend</span>
              </div>
              <div className="h-44 w-full min-h-[176px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                  <AreaChart data={arrivalVsDispatch7Days}>
                    <defs>
                      <linearGradient id="colorArrival" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1F4D2B" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#1F4D2B" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorDispatch" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#C5A059" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#C5A059" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2EDE0" />
                    <XAxis dataKey="day" stroke="#556952" fontSize={10} />
                    <YAxis stroke="#556952" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#FAF7F0', borderColor: '#D6CAA8', borderRadius: 8, fontSize: 11, fontWeight: 'bold' }} />
                    <Area type="monotone" dataKey="arrivalMT" name="Arrival MT" stroke="#1F4D2B" fillOpacity={1} fill="url(#colorArrival)" />
                    <Area type="monotone" dataKey="dispatchMT" name="Dispatch MT" stroke="#C5A059" fillOpacity={1} fill="url(#colorDispatch)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Arrival vs Dispatch Bales Bar Chart */}
            <div className="bg-[#FAF7F0] border border-[#D6CAA8] rounded-xl p-3.5 shadow-2xs space-y-2">
              <div className="flex justify-between items-center text-xs font-bold font-mono uppercase">
                <span className="text-[#1E331B]">Bales Volumetric Comparison</span>
                <span className="text-blue-800 bg-blue-100 px-2 py-0.5 rounded text-[10px]">Bales Count</span>
              </div>
              <div className="h-44 w-full min-h-[176px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                  <BarChart data={arrivalVsDispatch7Days}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2EDE0" />
                    <XAxis dataKey="day" stroke="#556952" fontSize={10} />
                    <YAxis stroke="#556952" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#FAF7F0', borderColor: '#D6CAA8', borderRadius: 8, fontSize: 11, fontWeight: 'bold' }} />
                    <Bar dataKey="arrivalBales" name="Arrival Bales" fill="#1F4D2B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="dispatchBales" name="Dispatch Bales" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Net Inflow / Delta Trend Line Chart */}
            <div className="bg-[#FAF7F0] border border-[#D6CAA8] rounded-xl p-3.5 shadow-2xs space-y-2">
              <div className="flex justify-between items-center text-xs font-bold font-mono uppercase">
                <span className="text-[#1E331B]">Net Stock Surplus Delta (MT)</span>
                <span className="text-purple-800 bg-purple-100 px-2 py-0.5 rounded text-[10px]">Inflow Delta</span>
              </div>
              <div className="h-44 w-full min-h-[176px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                  <LineChart data={arrivalVsDispatch7Days}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F2EDE0" />
                    <XAxis dataKey="day" stroke="#556952" fontSize={10} />
                    <YAxis stroke="#556952" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#FAF7F0', borderColor: '#D6CAA8', borderRadius: 8, fontSize: 11, fontWeight: 'bold' }} />
                    <Line type="monotone" dataKey="netDelta" name="Net Delta (MT)" stroke="#8B5CF6" strokeWidth={3} dot={{ fill: '#8B5CF6', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>

        {/* Visual 2: Procurement by Quality Grade Stacked Bar */}
        <div className="lg:col-span-5 bg-white border border-[#E5DEC9] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-[#F2EDE0] pb-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#1E331B] font-mono flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-700" />
                  Quality Grade Share & Rate Matrix
                </h3>
                <p className="text-[11px] text-[#556952] mt-0.5">Distribution across TD-4, TD-5, TD-6 & W-5 grades</p>
              </div>
            </div>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                <BarChart data={gradeCompositionData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F2EDE0" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#556952' }} />
                  <YAxis dataKey="grade" type="category" tick={{ fontSize: 11, fontWeight: 'bold', fill: '#1E331B' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#FAF7F0', borderColor: '#D6CAA8', borderRadius: '12px', fontSize: '11px' }} />
                  <Bar dataKey="qtl" name="Quantity (Qtl)" fill="#1F4D2B" radius={[0, 6, 6, 0]}>
                    {gradeCompositionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1 pt-3 border-t border-[#F2EDE0] text-center">
            {gradeCompositionData.map(g => (
              <div key={g.grade} className="bg-[#FAF7F0] p-1.5 rounded-lg border border-[#E5DEC9]">
                <div className="text-[10px] font-bold text-[#1E331B]">{g.grade}</div>
                <div className="text-[11px] font-extrabold text-emerald-800">{g.pct}%</div>
                <div className="text-[9px] text-[#556952]">₹{g.avgRate}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: End-to-End Jute Mill Flow Pipeline + Department Target vs Actual */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Visual 5: End-to-End Process Pipeline Flow */}
        {/* <div className="lg:col-span-6 bg-white border border-[#E5DEC9] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-[#F2EDE0] pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1E331B] font-mono flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-700" />
                End-to-End Mill Operational Pipeline Flow
              </h3>
              <p className="text-[11px] text-[#556952] mt-0.5">Gate Arrival ➔ Quality Inspection ➔ Godowns ➔ Spinning ➔ Dispatch</p>
            </div>
            <span className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-1 rounded-lg font-mono font-bold">
              Pipeline Funnel
            </span>
          </div>

          <div className="space-y-2.5 py-2">
            {pipelineFlowData.map((step, idx) => (
              <div key={step.stage} className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-[#1E331B]">
                  <span>{idx + 1}. {step.stage}</span>
                  <span className="font-mono text-emerald-800">{step.label}</span>
                </div>
                <div className="w-full bg-[#FAF7F0] border border-[#E5DEC9] rounded-full h-3 overflow-hidden p-0.5">
                  <div 
                    className="bg-gradient-to-r from-[#1F4D2B] to-[#2E6B3E] h-full rounded-full transition-all duration-500" 
                    style={{ width: `${step.val}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div> */}
        {/* Visual 8: Godown Capacity Heatmap Bar Chart */}
        <div className="lg:col-span-6 bg-white border border-[#E5DEC9] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-[#F2EDE0] pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1E331B] font-mono flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-emerald-700" />
                Godown Storage Tonnage & Utilization Heatmap
              </h3>
              <p className="text-[11px] text-[#556952] mt-0.5">Capacity vs used stock across 31 raw jute godowns</p>
            </div>
            <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg font-mono font-bold">
              Capacity Stack
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
              <BarChart data={godownHeatmapData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2EDE0" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#556952' }} />
                <YAxis tick={{ fontSize: 10, fill: '#556952' }} />
                <Tooltip contentStyle={{ backgroundColor: '#FAF7F0', borderColor: '#D6CAA8', borderRadius: '12px', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="capacity" name="Total Capacity (MT)" fill="#E5DEC9" radius={[4, 4, 0, 0]} />
                <Bar dataKey="used" name="Utilized Stock (MT)" fill="#1F4D2B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
      </div>

      {/* Row 4: Moisture Distribution Scatter & Godown Storage Capacity Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Visual 7: Moisture vs Weight Scatter Plot */}
        {/* <div className="lg:col-span-6 bg-white border border-[#E5DEC9] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-[#F2EDE0] pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1E331B] font-mono flex items-center gap-2">
                <Droplets className="w-4 h-4 text-emerald-700" />
                Moisture % vs. Shipment Tonnage Correlation
              </h3>
            </div>
            <span className="text-[10px] bg-cyan-50 text-cyan-800 border border-cyan-200 px-2.5 py-1 rounded-lg font-mono font-bold">
              Scatter Plot
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
              <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2EDE0" />
                <XAxis dataKey="moisture" name="Moisture %" unit="%" domain={[11, 17]} tick={{ fontSize: 10, fill: '#556952' }} />
                <YAxis dataKey="weight" name="Tonnage" unit=" Qtl" tick={{ fontSize: 10, fill: '#556952' }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#FAF7F0', borderColor: '#D6CAA8', borderRadius: '12px', fontSize: '11px' }} />
                <Scatter name="Shipments" data={moistureScatterData} fill="#1F4D2B" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div> */}
        {/* Visual 6: Department Target vs Actual Production Output */}
        {/* <div className="lg:col-span-6 bg-white border border-[#E5DEC9] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 border-b border-[#F2EDE0] pb-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#1E331B] font-mono flex items-center gap-2">
                <Factory className="w-4 h-4 text-emerald-700" />
                Department Target vs. Actual Output (MT)
              </h3>
              <p className="text-[11px] text-[#556952] mt-0.5">Comparing target production vs actual department yields</p>
            </div>
            <span className="text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-lg font-mono font-bold">
              Grouped Bar
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
              <BarChart data={deptOutputData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F2EDE0" />
                <XAxis dataKey="dept" tick={{ fontSize: 9, fill: '#556952' }} />
                <YAxis tick={{ fontSize: 10, fill: '#556952' }} />
                <Tooltip contentStyle={{ backgroundColor: '#FAF7F0', borderColor: '#D6CAA8', borderRadius: '12px', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="target" name="Target (MT)" fill="#D6CAA8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual Output (MT)" fill="#1F4D2B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div> */}
        
      </div>

      {/* 6. POWER BI STYLE EXECUTIVE MATRIX CROSSTAB TABLE */}
      <div className="bg-white border border-[#E5DEC9] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F2EDE0] pb-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#1E331B] font-mono flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Executive BI Data Matrix Crosstab
            </h3>
            <p className="text-[11px] text-[#556952] mt-0.5">
              Detailed procurement transactions, weighbridge results & quality inspections
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#556952]" />
              <input
 id="search_supplier_chalan_ve_1326" name="search_supplier_chalan_ve" aria-label="Search supplier, chalan, vehicle..."                type="text"
                placeholder="Search supplier, chalan, vehicle..."
                value={matrixSearch}
                onChange={(e) => { setMatrixSearch(e.target.value); setMatrixPage(1); }}
                className="h-8 pl-8 pr-3 bg-[#FAF7F0] border border-[#D6CAA8] rounded-xl text-xs text-[#1E331B] focus:outline-none focus:ring-1 focus:ring-[#1E331B] w-48 sm:w-64"
              />
            </div>
            <button
              onClick={handleExportCsv}
              className="h-8 px-3 bg-[#1E331B] text-white text-xs font-bold rounded-xl hover:bg-[#2A4426] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="overflow-x-auto rounded-xl border border-[#E5DEC9]">
          <table className="w-full text-left border-collapse text-xs min-w-[850px]">
            <thead>
              <tr className="bg-[#FAF7F0] border-b border-[#E5DEC9] text-[#1E331B] font-mono text-[11px] uppercase tracking-wider">
                <th className="p-3 font-bold">Chalan / Pass</th>
                <th className="p-3 font-bold">Date</th>
                <th className="p-3 font-bold">Supplier</th>
                <th className="p-3 font-bold">Broker</th>
                <th className="p-3 font-bold">Vehicle No</th>
                <th className="p-3 font-bold">Grade</th>
                <th className="p-3 font-bold text-right">Net Wt (Qtl)</th>
                <th className="p-3 font-bold text-center">Moisture %</th>
                <th className="p-3 font-bold text-right">Total Value (₹)</th>
                <th className="p-3 font-bold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2EDE0] font-sans">
              {paginatedMatrixRows.length > 0 ? (
                paginatedMatrixRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#FAF7F0]/60 transition-colors">
                    <td className="p-3 font-mono font-bold text-[#1E331B]">{row.chalan}</td>
                    <td className="p-3 text-[#556952]">{row.date}</td>
                    <td className="p-3 font-medium text-[#1E331B]">{safeStr(row.supplier)}</td>
                    <td className="p-3 text-[#556952]">{safeStr(row.broker)}</td>
                    <td className="p-3 font-mono text-xs">{row.vehicle}</td>
                    <td className="p-3 font-bold text-emerald-900">{safeStr(row.grade)}</td>
                    <td className="p-3 text-right font-bold text-[#1E331B]">{row.netWt}</td>
                    <td className="p-3 text-center font-mono">
                      <span className={cn(
                        "px-2 py-0.5 rounded-md font-bold text-[10px]",
                        Number(row.moisture) <= 15 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      )}>
                        {row.moisture}%
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-[#1E331B]">
                      ₹ {row.totalVal.toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 border border-emerald-300 text-emerald-900">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-[#556952] italic">
                    No matching procurement records found...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Matrix Pagination */}
        <div className="flex items-center justify-between text-xs text-[#556952] font-mono pt-2">
          <span>
            Showing page {matrixPage} of {Math.max(1, Math.ceil(searchedMatrixRows.length / rowsPerPage))} ({searchedMatrixRows.length} total rows)
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={matrixPage === 1}
              onClick={() => setMatrixPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 bg-[#FAF7F0] border border-[#D6CAA8] rounded-lg disabled:opacity-50 font-bold hover:bg-[#EAE2D2] cursor-pointer"
            >
              Previous
            </button>
            <button
              disabled={matrixPage >= Math.ceil(searchedMatrixRows.length / rowsPerPage)}
              onClick={() => setMatrixPage(p => p + 1)}
              className="px-3 py-1 bg-[#FAF7F0] border border-[#D6CAA8] rounded-lg disabled:opacity-50 font-bold hover:bg-[#EAE2D2] cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
