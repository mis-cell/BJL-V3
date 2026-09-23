import React from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { Mail, 
  TrendingUp, 
  Users, X, User, 
  Package,
  FileText,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Archive,
  HandCoins,
  PackageCheck,
  ClipboardList,
  Container,
  Settings,
  BarChart3,
  Sparkles,
  ShieldCheck,
  Layers,
  FileCheck,
  Lock,
  RefreshCw,
  Database,
  Scale,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  AlertTriangle,
  Link,
  LayoutDashboard,
  MessageSquare,
  Wallet,
  PlusCircle,
  Search,
  Check,
  Printer,
  Download,
  Trash2,
  Edit3,
  ArrowLeft,
  Plus,
  Calendar,
  Factory,
  Boxes,
  ShoppingCart,
  ShoppingBag,
  Wrench,
  Warehouse,
  Truck,
  ClipboardCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { getCurrentUserContext, hasModulePermission } from '../lib/permissions';
import LegacyLayout, { LegacyFieldset } from '../components/LegacyLayout';
import { dbModule } from '../services/dbModule';
import { supabase } from '../lib/supabase';
import QuickReport from '../components/QuickReport';
import MismatchCase from './MismatchCase';
import Reports from './Reports';
import ExecutiveBiDashboard from '../components/ExecutiveBiDashboard';
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
  Legend 
} from 'recharts';

export default function Dashboard({ 
  onNavigate, 
  isAdmin, 
  allowedModules,
  currentTab: propCurrentTab,
  setCurrentTab: propSetCurrentTab,
  isActive = true
}: { 
  onNavigate: (page: any, subId?: string) => void | Promise<boolean>; 
  isAdmin?: boolean; 
  allowedModules?: string[];
  currentTab?: 'menu' | 'mismatch' | 'reports';
  setCurrentTab?: (tab: 'menu' | 'mismatch' | 'reports') => void;
  isActive?: boolean;
}) {
  const [localCurrentTab, setLocalCurrentTab] = React.useState<'menu' | 'mismatch' | 'reports'>('menu');
  const currentTab = propCurrentTab !== undefined ? propCurrentTab : localCurrentTab;
  const setCurrentTab = propSetCurrentTab !== undefined ? propSetCurrentTab : setLocalCurrentTab;
  const [activeSectionIndex, setActiveSectionIndex] = React.useState<number>(0);

  const [emailHealthWarning, setEmailHealthWarning] = React.useState(false);

  React.useEffect(() => {
    const checkEmailHealth = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase.from('mail_logs')
          .select('status')
          .order('created_at', { ascending: false })
          .limit(3);
          
        if (data && data.length === 3) {
          const allFailed = data.every(log => log.status === 'Failed');
          setEmailHealthWarning(allFailed);
        }
      } catch (err) {
        console.error(err);
      }
    };
    checkEmailHealth();
    const interval = setInterval(checkEmailHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);


  const [stats, setStats] = React.useState<any>({ arrivals: '...', sauda: '...', traders: '...', po: '...', godownUtilization: '...', totalStockMt: 0 });
  const [godowns, setGodowns] = React.useState<any[]>([]);
  const [godownUtils, setGodownUtils] = React.useState<any[]>([]);
  const [isGodownModalOpen, setIsGodownModalOpen] = React.useState(false);
  const [selectedGodownIndex, setSelectedGodownIndex] = React.useState<number | null>(null);

  // New states for custom modals (SMS Sauda)
  const [isSmsSaudaModalOpen, setIsSmsSaudaModalOpen] = React.useState(false);
  const [smsSaudaTab, setSmsSaudaTab] = React.useState<'sms' | 'manual'>('sms');
  const [googleSheetSmsData, setGoogleSheetSmsData] = React.useState<any[]>([]);
  const [isGoogleSheetLoading, setIsGoogleSheetLoading] = React.useState(false);
  const [googleSheetError, setGoogleSheetError] = React.useState<string | null>(null);
  const [smsSearchTerm, setSmsSearchTerm] = React.useState('');
  const [smsSortOrder, setSmsSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [saudaSearchTerm, setSaudaSearchTerm] = React.useState('');
  const [saudaStatusFilter, setSaudaStatusFilter] = React.useState<'All' | 'Active' | 'Partial' | 'Closed'>('All');
  const [isManualFormOpen, setIsManualFormOpen] = React.useState(false);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);
  const [userProfileData, setUserProfileData] = React.useState<any>(null);
  const [newPassword, setNewPassword] = React.useState('');
  const [updatePasswordSuccess, setUpdatePasswordSuccess] = React.useState('');

  const loadUserProfile = async () => {
    try {
      const username = getCurrentUserContext().username || "ADMIN";
      const { data, error } = await supabase
        .from('user_master')
        .select('*')
        .eq('username', username.toUpperCase())
        .single();
      if (!error && data) {
        setUserProfileData(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) return;
    try {
      const username = getCurrentUserContext().username || "ADMIN";
      const { error } = await supabase
        .from('user_master')
        .update({ password: newPassword })
        .eq('username', username.toUpperCase());
      
      if (!error) {
        setUpdatePasswordSuccess('Password updated successfully!');
        setNewPassword('');
        setTimeout(() => setUpdatePasswordSuccess(''), 3000);
      } else {
        alert('Failed to update password');
      }
    } catch (e) {
      console.error(e);
    }
  };
  const [isSmsInboxOpen, setIsSmsInboxOpen] = React.useState(false);
  const [isAccountsSummaryOpen, setIsAccountsSummaryOpen] = React.useState(false);
  const [editingSmsSaudaId, setEditingSmsSaudaId] = React.useState<string | null>(null);

  // Manual form controlled states for easy pre-filling
  const [manualTrader, setManualTrader] = React.useState('');
  const [manualSupplier, setManualSupplier] = React.useState('');
  const [manualUnitType, setManualUnitType] = React.useState('BALES');
  const [manualStatus, setManualStatus] = React.useState<'Active' | 'Partial' | 'Closed'>('Active');
  const [manualGrade, setManualGrade] = React.useState('TD5');
  const [manualBales, setManualBales] = React.useState('');
  const [manualRate, setManualRate] = React.useState('');

  const fetchGoogleSheetSms = async () => {
    setIsGoogleSheetLoading(true);
    setGoogleSheetError(null);
    try {
      const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets/1WignMNJ2p2Qu5V34nuuthPItahIlNnQtBiJJ8KYgG9k/values/sauda!A:C?key=AIzaSyBLQaMfurS0w11dgPRPLIpUfAs6lOHRMgA");
      if (!res.ok) {
        throw new Error(`Google Sheets API responded with status ${res.status}`);
      }
      const data = await res.json();
      if (data.values && data.values.length > 0) {
        let rows = data.values;
        // Skip header if it is exactly the header keys
        if (rows[0] && rows[0][0]?.toLowerCase() === 'body') {
          rows = rows.slice(1);
        }
        
        const parsed = rows.map((row: any, index: number) => ({
          id: `SHEET-SMS-${index + 1}`,
          body: row[0] || '',
          service_center: row[1] || '',
          contact_name: row[2] || 'Unknown Sender',
          date: '2026-07-07' // aligned with system date
        }));
        setGoogleSheetSmsData(parsed);
      } else {
        setGoogleSheetSmsData([]);
      }
    } catch (err: any) {
      console.error("Error fetching Google Sheet SMS data:", err);
      setGoogleSheetError(err.message || "Failed to load SMS data");
    } finally {
      setIsGoogleSheetLoading(false);
    }
  };

  React.useEffect(() => {
    if (isSmsSaudaModalOpen && smsSaudaTab === 'sms') {
      fetchGoogleSheetSms();
    }
  }, [isSmsSaudaModalOpen, smsSaudaTab]);


  const [smsSaudas, setSmsSaudas] = React.useState<any[]>([]);
  const [rawSaudas, setRawSaudas] = React.useState<any[]>([]);
  const [payments, setPayments] = React.useState<any[]>([]);
  const [recentAmad, setRecentAmad] = React.useState<any[]>([]);
  const [rawArrivals, setRawArrivals] = React.useState<any[]>([]);
  const [rawPos, setRawPos] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [arrivalsMetrics, setArrivalsMetrics] = React.useState({
    totalPackets: 0,
    totalWeightQtl: 0
  });
  const [settlementStats, setSettlementStats] = React.useState({
    total: 0,
    pending: 0,
    settled: 0,
    partiallyPaid: 0,
    totalWeightMT: 0,
    totalScaleNetMT: 0
  });

  // Track state for the Quick Report summary component
  const [quickReportData, setQuickReportData] = React.useState({
    totalArrivals: 0,
    pendingMrSettlements: 0,
    totalPackets: 0,
    totalWeightQtl: 0,
    loading: true,
    error: ""
  });

  const [inspectionMasters, setInspectionMasters] = React.useState<any[]>([]);
  const [inspectionDetails, setInspectionDetails] = React.useState<any[]>([]);
  const [stockNodeStocks, setStockNodeStocks] = React.useState<any[]>([]);
  const [millIssueMasters, setMillIssueMasters] = React.useState<any[]>([]);
  const [millIssueDetails, setMillIssueDetails] = React.useState<any[]>([]);
  const [allOpeningStocks, setAllOpeningStocks] = React.useState<any[]>([]);
  const [rawScp, setRawScp] = React.useState<any[]>([]);
  const [rawScpDetails, setRawScpDetails] = React.useState<any[]>([]);
  const [activeChartTab, setActiveChartTab] = React.useState<'general' | 'grades'>('general');

  const loadStats = React.useCallback(async () => {
    setLoading(true);
    setQuickReportData(prev => ({ ...prev, loading: true }));
    try {
      const [
        arrivals, 
        saudas, 
        traders, 
        pos, 
        settlements, 
        godownsRes, 
        openingStocksRes, 
        finalArrivals, 
        paymentRecords,
        gwsRes,
        mimRes,
        midRes,
        scpRes,
        scpDetRes
      ] = await Promise.all([
        dbModule.fetchAll('temporary_material_received', 'created_at', false).catch(() => []),
        dbModule.fetchAll('sauda_master', 'created_at', false).catch(() => []),
        dbModule.fetchAll('user_master').catch(() => []),
        dbModule.fetchAll('purchase_master', 'created_at', false).catch(() => []),
        dbModule.fetchAll('m_r_settlement').catch(() => []),
        (async () => {
          try {
            if (supabase) {
              const r = await supabase.from('godown_master').select('*');
              if (r.data) return r.data;
            }
            return await dbModule.fetchAll('godown_master');
          } catch (e) {
            return [];
          }
        })(),
        (async () => {
          try {
            if (supabase) {
              const r = await supabase.from('opening_stock').select('*');
              if (r.data) return r.data;
            }
            return await dbModule.fetchAll('opening_stock');
          } catch (e) {
            return [];
          }
        })(),
        dbModule.fetchAll('final_arrival', 'created_at', false).catch(() => []),
        (async () => {
          try {
            if (supabase) {
              const r = await supabase.from('payment_master').select('*');
              if (r.data) return r.data;
            }
            return await dbModule.fetchAll('payment_master').catch(() => []);
          } catch (e) {
            return [];
          }
        })(),
        (async () => {
          try {
            if (supabase) {
              const r = await supabase.from('godown_wise_stock').select('*');
              if (r.data) return r.data;
            }
            return await dbModule.fetchAll('godown_wise_stock').catch(() => []);
          } catch (e) {
            return [];
          }
        })(),
        (async () => {
          try {
            if (supabase) {
              const r = await supabase.from('mill_issue_master').select('*');
              if (r.data) return r.data;
            }
            return await dbModule.fetchAll('mill_issue_master').catch(() => []);
          } catch (e) {
            return [];
          }
        })(),
        (async () => {
          try {
            if (supabase) {
              const r = await supabase.from('mill_issue_detail').select('*');
              if (r.data) return r.data;
            }
            return await dbModule.fetchAll('mill_issue_detail').catch(() => []);
          } catch (e) {
            return [];
          }
        })(),
        (async () => {
          try {
            if (supabase) {
              const r = await supabase.from('sauda_check_point').select('*');
              if (r.data) return r.data;
            }
            return await dbModule.fetchAll('sauda_check_point').catch(() => []);
          } catch (e) {
            return [];
          }
        })(),
        (async () => {
          try {
            if (supabase) {
              const r = await supabase.from('sauda_check_point_details').select('*');
              if (r.data) return r.data;
            }
            return await dbModule.fetchAll('sauda_check_point_details').catch(() => []);
          } catch (e) {
            return [];
          }
        })()
      ]);

      // Synchronize exact opening stock loader with StockSummary.tsx
      const opData = (openingStocksRes || []).map((r: any) => ({
        ...r,
        stock_date: r.opening_date || r.stock_date || new Date().toISOString().split('T')[0],
        opening_date: r.opening_date || r.stock_date || new Date().toISOString().split('T')[0]
      }));
      
      const gdnData = (gwsRes || []).map((r: any) => ({
        ...r,
        opening_date: r.stock_date || r.opening_date || new Date().toISOString().split('T')[0],
        stock_date: r.stock_date || r.opening_date || new Date().toISOString().split('T')[0]
      }));

      const localStoredOp = (function() {
        try {
          const stored = localStorage.getItem('po_auto_opening_stock');
          if (stored && stored !== 'undefined' && stored !== 'null') {
            const parsed = JSON.parse(stored === "undefined" ? "null" : stored);
            return Array.isArray(parsed) ? parsed : [];
          }
        } catch (_) {}
        return [];
      })();

      const combined = [...gdnData, ...opData];
      const unique = combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      const finalOpList = unique.length > 0 ? unique : localStoredOp;

      setAllOpeningStocks(finalOpList);
      setMillIssueMasters(mimRes || []);
      setMillIssueDetails(midRes || []);

      const FALLBACK_GODOWNS_WITH_CAPACITY = [
        { gdn_code: "1", gdn_name: "1", gdn_capacity: 600, gdn_short_name: "1" },
        { gdn_code: "2", gdn_name: "3", gdn_capacity: 450, gdn_short_name: "3" },
        { gdn_code: "3", gdn_name: "3A", gdn_capacity: 450, gdn_short_name: "3A" },
        { gdn_code: "4", gdn_name: "4", gdn_capacity: 450, gdn_short_name: "4" },
        { gdn_code: "5", gdn_name: "4A", gdn_capacity: 450, gdn_short_name: "4A" },
        { gdn_code: "6", gdn_name: "4B", gdn_capacity: 600, gdn_short_name: "4B" },
        { gdn_code: "7", gdn_name: "4C", gdn_capacity: 600, gdn_short_name: "4C" },
        { gdn_code: "8", gdn_name: "5", gdn_capacity: 450, gdn_short_name: "5" },
        { gdn_code: "9", gdn_name: "6", gdn_capacity: 450, gdn_short_name: "6" },
        { gdn_code: "10", gdn_name: "6A", gdn_capacity: 450, gdn_short_name: "6A" },
        { gdn_code: "11", gdn_name: "7", gdn_capacity: 450, gdn_short_name: "7" },
        { gdn_code: "12", gdn_name: "7A", gdn_capacity: 450, gdn_short_name: "7A" },
        { gdn_code: "13", gdn_name: "8", gdn_capacity: 450, gdn_short_name: "8" },
        { gdn_code: "14", gdn_name: "8A", gdn_capacity: 450, gdn_short_name: "8A" },
        { gdn_code: "15", gdn_name: "9", gdn_capacity: 450, gdn_short_name: "9" },
        { gdn_code: "16", gdn_name: "9A", gdn_capacity: 450, gdn_short_name: "9A" },
        { gdn_code: "17", gdn_name: "10", gdn_capacity: 450, gdn_short_name: "10" },
        { gdn_code: "18", gdn_name: "2", gdn_capacity: 450, gdn_short_name: "2" },
        { gdn_code: "19", gdn_name: "1A", gdn_capacity: 450, gdn_short_name: "1A" },
        { gdn_code: "20", gdn_name: "OUTSIDE", gdn_capacity: 500, gdn_short_name: "OS" },
        { gdn_code: "21", gdn_name: "2A", gdn_capacity: 450, gdn_short_name: "2A" },
        { gdn_code: "22", gdn_name: "INSP. MILL", gdn_capacity: 450, gdn_short_name: "IM" },
        { gdn_code: "23", gdn_name: "KATARI", gdn_capacity: 450, gdn_short_name: "KATA" },
        { gdn_code: "24", gdn_name: "MILL", gdn_capacity: 450, gdn_short_name: "MILL" },
        { gdn_code: "26", gdn_name: "STB", gdn_capacity: 450, gdn_short_name: "STB" },
        { gdn_code: "27", gdn_name: "INSP. STB", gdn_capacity: 450, gdn_short_name: "ISTB" },
        { gdn_code: "29", gdn_name: "INSP. KATARI", gdn_capacity: 450, gdn_short_name: "IKAT" },
        { gdn_code: "30", gdn_name: "SELECTION SHED", gdn_capacity: 450, gdn_short_name: "SHED" },
        { gdn_code: "31", gdn_name: "8B", gdn_capacity: 450, gdn_short_name: "8B" }
      ];
      const mergedGdns = (godownsRes && godownsRes.length > 0) ? godownsRes : FALLBACK_GODOWNS_WITH_CAPACITY;
      setGodowns(mergedGdns);

      const stocks = finalOpList || [];
      
      let totalCapacity = 0;
      let totalStockMt = 0;

      const godownUtilData = mergedGdns.map((g: any) => {
        const capacity = Number(g.gdn_capacity || g.capacity || 450);
        totalCapacity += capacity;

        const matchingStocks = stocks.filter((s: any) => {
          const sGodown = String(s.godown || "").trim().toUpperCase();
          const gName = String(g.gdn_name || "").trim().toUpperCase();
          const gCode = String(g.gdn_code || "").trim().toUpperCase();
          return sGodown === gName || sGodown === gCode;
        });

        const totalWtQtl = matchingStocks.reduce((sum: number, s: any) => sum + (Number(s.weight) || 0), 0);
        const totalBales = matchingStocks.reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0);
        const stockMt = totalWtQtl / 10;
        totalStockMt += stockMt;

        const utilization = capacity > 0 ? Number(((stockMt / capacity) * 100).toFixed(1)) : 0;

        return {
          code: g.gdn_code,
          name: g.gdn_name || `GDN-${g.gdn_code}`,
          capacity,
          stockMt,
          weightQtl: totalWtQtl,
          bales: totalBales,
          utilization,
          stocks: matchingStocks
        };
      });

      const avgUtilization = totalCapacity > 0 ? Number(((totalStockMt / totalCapacity) * 100).toFixed(1)) : 0;
      setGodownUtils(godownUtilData);

      const matchPoNo = (po1: string, po2: string) => {
        if (!po1 || !po2) return false;
        const p1 = po1.trim().toLowerCase();
        const p2 = po2.trim().toLowerCase();
        if (p1 === p2) return true;
        
        const clean1 = p1.replace(/[^a-z0-9]/g, '');
        const clean2 = p2.replace(/[^a-z0-9]/g, '');
        if (clean1 && clean1 === clean2) return true;

        if (clean1.length > 5 && clean2.length > 5 && (clean1.includes(clean2) || clean2.includes(clean1))) {
          return true;
        }

        const num1 = p1.replace(/[^0-9]/g, '');
        const num2 = p2.replace(/[^0-9]/g, '');
        if (num1.length >= 4 && num2.length >= 4 && (num1.includes(num2) || num2.includes(num1))) {
          return true;
        }
        return false;
      };

      const pendingPoCount = pos.filter((p: any) => {
        const contractWeight = parseFloat(p.total_contract_mt) || 0;
        const matchingFinal = (finalArrivals || []).filter((ar: any) => 
          matchPoNo(p.po_no, ar.po_no) || matchPoNo(p.contract_po_no, ar.po_no)
        );
        const matchingTemp = (arrivals || []).filter((ar: any) => 
          (matchPoNo(p.po_no, ar.po_no) || matchPoNo(p.contract_po_no, ar.po_no)) &&
          !matchingFinal.some(f => f.temporary_arrival_no === ar.temporary_arrival_no || f.mr_no === ar.amad_no)
        );
        const getLowestNetWeight = (item: any): number => {
          if (!item) return 0;
          const nets = [
            Number(item.electronic_net_weight),
            Number(item.supplier_net_weight),
            Number(item.challan_material_weight),
            Number(item.weight_reduced),
            item.weight_qtl ? Number(item.weight_qtl) / 10 : 0,
            Number(item.weight),
            Number(item.quantity)
          ].filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
          return nets.length > 0 ? Math.min(...nets) : 0;
        };

        const totalReceivedMt = [...matchingFinal, ...matchingTemp].reduce((sum: number, ar: any) => {
          return sum + getLowestNetWeight(ar);
        }, 0);

        const isDbCompleted = p.pending === false || p.pending === 'No' || String(p.pending).toLowerCase() === 'false' || p.pending === 0;
        const isWeightCompleted = contractWeight > 0 && totalReceivedMt >= (contractWeight - 0.01);
        
        if (isDbCompleted || isWeightCompleted) {
          return false; // Not pending anymore
        }

        const remainingVal = p.pending_received !== undefined && p.pending_received !== null 
          ? Number(p.pending_received) 
          : (p.pending === true || p.pending === 'Yes' ? Number(p.total_contract_mt || 0) : 0);
        return remainingVal > 0.001;
      }).length;

      setStats({
        arrivals: arrivals.length.toString(),
        sauda: `₹ ${(saudas.reduce((acc, curr) => {
          const val = Number(curr.total_value) || (Number(curr.b_rate) * Number(curr.total_wt_in_ton) * 10) || 0;
          return acc + val;
        }, 0) / 100000).toFixed(1)}L`,
        traders: traders.length.toString(),
        po: pendingPoCount.toString(),
        godownUtilization: avgUtilization.toString(),
        totalStockMt: totalStockMt
      });

      // Sum values for active arrivals
      const packetsSum = arrivals.reduce((sum: number, r: any) => {
        const u = (r.unit_name || r.unit || r.unit_code || '').toString().trim().toUpperCase();
        if (u.includes('LOOSE') || u === 'LOOSE') return sum;
        return sum + (Number(r.packets || r.total_packets) || 0);
      }, 0);
      const getLowestNetWeightHelper = (item: any): number => {
        if (!item) return 0;
        const nets = [
          Number(item.electronic_net_weight),
          Number(item.supplier_net_weight),
          Number(item.challan_material_weight),
          Number(item.weight_reduced),
          item.weight_qtl ? Number(item.weight_qtl) / 10 : 0,
          Number(item.weight),
          Number(item.quantity)
        ].filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
        return nets.length > 0 ? Math.min(...nets) : 0;
      };
      const weightSum = arrivals.reduce((sum: number, r: any) => sum + (getLowestNetWeightHelper(r) * 10), 0);

      setArrivalsMetrics({
        totalPackets: packetsSum,
        totalWeightQtl: weightSum
      });

      // Analyze payment status from payment_master (and settlements fallback)
      const pmList = paymentRecords || [];
      const hasPm = pmList.length > 0;
      
      const pendingCount = hasPm 
        ? pmList.filter((s: any) => {
            const st = (s.status || s.payment_status || 'pending').toLowerCase().trim();
            return st === 'pending' || st === 'draft';
          }).length
        : settlements.filter((s: any) => (s.payment_status || 'Pending').toLowerCase().trim() === 'pending').length;

      const settledCount = hasPm
        ? pmList.filter((s: any) => {
            const st = (s.status || s.payment_status || '').toLowerCase().trim();
            return st === 'completed' || st === 'paid' || st === 'settled';
          }).length
        : settlements.filter((s: any) => {
            const st = (s.payment_status || '').toLowerCase().trim();
            return st === 'settled' || st === 'paid';
          }).length;

      const partiallyPaidCount = hasPm
        ? pmList.filter((s: any) => {
            const st = (s.status || s.payment_status || '').toLowerCase().trim();
            return st === 'partial' || st === 'partially paid';
          }).length
        : settlements.filter((s: any) => (s.payment_status || '').toLowerCase().trim() === 'partially paid').length;
      
      const totalWeight = settlements.reduce((sum: number, s: any) => sum + (Number(s.quantity) || 0), 0);
      const totalScaleNet = settlements.reduce((sum: number, s: any) => sum + (Number(s.electronic_scale_net) || 0), 0);

      setSettlementStats({
        total: hasPm ? pmList.length : settlements.length,
        pending: pendingCount,
        settled: settledCount,
        partiallyPaid: partiallyPaidCount,
        totalWeightMT: totalWeight,
        totalScaleNetMT: totalScaleNet
      });

      setRecentAmad(arrivals.slice(0, 5));
      setRawArrivals(arrivals || []);
      setRawPos(pos || []);
      setRawSaudas(saudas || []);
      setRawScp(scpRes || []);
      setRawScpDetails(scpDetRes || []);
      setPayments(pmList || []);

      // Direct queries to custom Views / Tables: amad_register, material_inspection, and sauda_master in Supabase
      let amadRegisterData: any[] = [];
      let materialInspectionData: any[] = [];
      const settledMrNos = new Set<string>();

      if (supabase) {
        try {
          const { data: sMaster, error: sMasterErr } = await supabase.from('sauda_master').select('*');
          if (!sMasterErr && sMaster) {
            setRawSaudas(sMaster);
          }
        } catch (e) {
          console.warn("Direct query to sauda_master failed, utilizing fallback:", e);
        }
        try {
          const { data: amReg, error: amRegErr } = await supabase.from('amad_register').select('*');
          if (!amRegErr && amReg) {
            amadRegisterData = amReg;
            setRawArrivals(amReg);
            setRecentAmad(amReg.slice(0, 5));
          } else {
            amadRegisterData = arrivals;
          }
        } catch (e) {
          console.warn("Direct query to amad_register failed, utilizing fallback:", e);
          amadRegisterData = arrivals;
        }

        try {
          const { data: matInsp, error: matInspErr } = await supabase.from('material_inspection').select('*');
          if (!matInspErr && matInsp) {
            materialInspectionData = matInsp;
          } else {
            materialInspectionData = [];
          }
        } catch (e) {
          console.warn("Direct query to material_inspection failed:", e);
          materialInspectionData = [];
        }

        try {
          const { data: settledMasters } = await supabase.from('mr_settlement_master').select('mr_no');
          if (settledMasters) {
            settledMasters.forEach((s: any) => {
              if (s.mr_no) settledMrNos.add(String(s.mr_no).trim().toUpperCase());
            });
          }
        } catch (e) {
          console.warn("Error resolving settled MRs:", e);
        }

        try {
          const [matInspRes, matDetRes, stNodeStocksRes] = await Promise.all([
            supabase.from('material_inspection').select('mr_no, mr_date, arrival_date, date, status, created_at'),
            supabase.from('material_inspection_details').select('mr_no, stock_grade_code, quantity, unit'),
            supabase.from('opening_stock').select('grade, quantity, weight, godown')
          ]);
          
          const finalMasters = matInspRes.data || [];
          setInspectionMasters(finalMasters);
          
          const combinedDetails = matDetRes.data || [];
          setInspectionDetails(combinedDetails);
          
          const getOpeningStocksFallback = async () => {
            const fb = await dbModule.fetchAll('opening_stock').catch(() => []);
            if (fb && fb.length > 0) return fb;
            const local = localStorage.getItem('po_auto_opening_stock');
            if (local && local !== 'undefined' && local !== 'null') {
              try {
                return JSON.parse(local === "undefined" ? "null" : local).map((item: any) => ({
                  grade: item.grade,
                  quantity: item.quantity,
                  weight: item.weight,
                  godown: item.godown
                }));
              } catch (e) {}
            }
            return [];
          };

          if (stNodeStocksRes.data) {
            setStockNodeStocks(stNodeStocksRes.data);
          } else {
            const fallbackStocks = await getOpeningStocksFallback();
            setStockNodeStocks(fallbackStocks);
          }
        } catch (e) {
          console.warn("Error loading grade analytics from Supabase, utilizing fallback:", e);
          const getOpeningStocksFallback = () => {
            const local = localStorage.getItem('po_auto_opening_stock');
            if (local && local !== 'undefined' && local !== 'null') {
              try {
                return JSON.parse(local === "undefined" ? "null" : local).map((item: any) => ({
                  grade: item.grade,
                  quantity: item.quantity,
                  weight: item.weight,
                  godown: item.godown
                }));
              } catch (e) {}
            }
            return [];
          };
          const [fbMasters, fbDetails, fbStocks] = await Promise.all([
            dbModule.fetchAll('mill_inspection_master').catch(() => []),
            dbModule.fetchAll('mill_inspection_detail').catch(() => []),
            dbModule.fetchAll('opening_stock').catch(() => []).then(res => res.length ? res : getOpeningStocksFallback())
          ]);
          setInspectionMasters(fbMasters);
          setInspectionDetails(fbDetails);
          setStockNodeStocks(fbStocks);
        }
      } else {
        amadRegisterData = arrivals;
        materialInspectionData = await dbModule.fetchAll('mill_inspection_master').catch(() => []);

        const getOpeningStocksFallback = () => {
          const local = localStorage.getItem('po_auto_opening_stock');
          if (local && local !== 'undefined' && local !== 'null') {
            try {
              return JSON.parse(local === "undefined" ? "null" : local).map((item: any) => ({
                grade: item.grade,
                quantity: item.quantity,
                weight: item.weight,
                godown: item.godown
              }));
            } catch (e) {}
          }
          return [];
        };

        const [offMasters, offDetails, offStocks] = await Promise.all([
          dbModule.fetchAll('mill_inspection_master').catch(() => []),
          dbModule.fetchAll('mill_inspection_detail').catch(() => []),
          dbModule.fetchAll('opening_stock').catch(() => []).then(res => res.length ? res : getOpeningStocksFallback())
        ]);
        setInspectionMasters(offMasters);
        setInspectionDetails(offDetails);
        setStockNodeStocks(offStocks);
      }

      const pendingInspections = materialInspectionData.filter((insp: any) => {
        const mr = insp.mr_no ? String(insp.mr_no).trim().toUpperCase() : '';
        return mr && !settledMrNos.has(mr);
      });

      setQuickReportData({
        totalArrivals: amadRegisterData.length,
        pendingMrSettlements: pendingInspections.length,
        totalPackets: amadRegisterData.reduce((sum: number, r: any) => sum + (Number(r.packets || r.total_packets) || 0), 0),
        totalWeightQtl: amadRegisterData.reduce((sum: number, r: any) => sum + (Number(r.weight || r.weight_qtl) || 0), 0),
        loading: false,
        error: ""
      });

    } catch (err) {
      console.error("Dashboard Stats Error:", err);
      setQuickReportData(prev => ({ ...prev, loading: false, error: "Sync Error" }));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isActive) {
      loadStats();
    }
  }, [loadStats, isActive]);

  useLiveAutoRefresh(() => {
    if (isActive) loadStats();
  }, [isActive], { 
    tables: [
      'sauda_master', 
      'purchase_master', 
      'sauda_check_point', 
      'temporary_material_received', 
      'final_arrival', 
      'mill_inspection_master', 
      'payment_master', 
      'm_r_settlement', 
      'material_mismatch', 
      'satta_mismatch',
      'opening_stock',
      'godown_wise_stock',
      'mill_issue_master',
      'mill_issue_detail'
    ] 
  });

  const arrivalTrendsData = React.useMemo(() => {
    const groups: Record<string, { name: string; packets: number; count: number }> = {};
    
    rawArrivals.forEach(item => {
      const dStr = item.date || item.created_at;
      if (!dStr) return;
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return;
      
      const key = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
      if (!groups[key]) {
        groups[key] = { name: key, packets: 0, count: 0 };
      }
      const u = (item.unit_name || item.unit || item.unit_code || '').toString().trim().toUpperCase();
      const isLoose = u.includes('LOOSE') || u === 'LOOSE';
      groups[key].packets += isLoose ? 0 : (Number(item.packets) || Number(item.total_packets) || 0);
      groups[key].count++;
    });
    
    return Object.keys(groups)
      .sort()
      .slice(-8)
      .map(k => groups[k]);
  }, [rawArrivals]);

  const poDistributionData = React.useMemo(() => {
    const groups: Record<string, { name: string; weight: number; count: number }> = {};
    
    const pendingPosOnly = rawPos.filter((p: any) => {
      const remainingVal = p.pending_received !== undefined && p.pending_received !== null 
        ? Number(p.pending_received) 
        : (p.pending === true || p.pending === 'Yes' ? Number(p.total_contract_mt || 0) : 0);
      return remainingVal > 0.001;
    });

    pendingPosOnly.forEach(p => {
      const areaName = (p.area || 'Direct').trim().toUpperCase();
      if (!groups[areaName]) {
        groups[areaName] = { name: areaName, weight: 0, count: 0 };
      }
      let wt = p.pending_received !== undefined && p.pending_received !== null 
        ? Number(p.pending_received) 
        : Number(p.total_contract_mt) || 0;
      if (wt === 0) {
        const unitsVal = Number(p.total_units) || (Number(p.total_lorries) * Number(p.units_per_lorry)) || 0;
        wt = (unitsVal * (Number(p.weight_unit_kgs) || 50)) / 1000;
      }
      groups[areaName].weight += wt;
      groups[areaName].count++;
    });
    
    return Object.values(groups)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6);
  }, [rawPos]);

  const settlementPieData = React.useMemo(() => {
    return [
      { name: 'Settled', value: settlementStats.settled, color: '#10b981' },
      { name: 'Pending', value: settlementStats.pending, color: '#f43f5e' },
      { name: 'Partial', value: settlementStats.partiallyPaid, color: '#f59e0b' }
    ].filter(item => item.value > 0);
  }, [settlementStats]);

  // Grade-wise Stock Levels (Latest Stock)
  const gradeStockLevelsData = React.useMemo(() => {
    const groups: Record<string, number> = {};
    stockNodeStocks.forEach(item => {
      const g = (item.grade || 'UNKNOWN').trim().toUpperCase();
      const q = Number(item.quantity) || 0;
      groups[g] = (groups[g] || 0) + q;
    });
    return Object.keys(groups).map(grade => ({
      grade,
      quantity: groups[grade]
    })).sort((a, b) => b.quantity - a.quantity).slice(0, 10);
  }, [stockNodeStocks]);

  // Grade-wise Arrival Trends
  const gradeArrivalTrendsData = React.useMemo(() => {
    const dateMap: Record<string, Record<string, number>> = {};
    const gradesSet = new Set<string>();

    const masterMap = new Map<string, any>();
    inspectionMasters.forEach(m => {
      if (m.mr_no) {
        masterMap.set(String(m.mr_no).trim().toUpperCase(), m);
      }
    });

    inspectionDetails.forEach(det => {
      const mrNo = det.mr_no ? String(det.mr_no).trim().toUpperCase() : '';
      const master = masterMap.get(mrNo);
      const rawDate = master ? (master.arrival_date || master.mr_date) : null;
      if (!rawDate) return;

      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return;
      
      const dateStr = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
      const grade = (det.stock_grade_code || det.arrival_grade || 'UNKNOWN').trim().toUpperCase();
      const qty = Number(det.quantity) || 0;

      if (!dateMap[dateStr]) {
        dateMap[dateStr] = {};
      }
      dateMap[dateStr][grade] = (dateMap[dateStr][grade] || 0) + qty;
      gradesSet.add(grade);
    });

    const sortedDates = Object.keys(dateMap).sort().slice(-8);

    const trends = sortedDates.map(date => {
      const row: any = { date };
      gradesSet.forEach(g => {
        row[g] = dateMap[date][g] || 0;
      });
      return row;
    });

    return {
      trends,
      grades: Array.from(gradesSet).slice(0, 8)
    };
  }, [inspectionMasters, inspectionDetails]);

  // Operational Process Flowchart config (Ordered representation with custom vivid gradient mapping)
  const processSteps = [
    { 
      id: 'sauda', 
      label: 'SAUDA DESK', 
      icon: HandCoins, 
      desc: 'Sauda Contract Bookings', 
      step: '1',
      start: '#6DE195',
      end: '#C4E759',
      textColor: 'text-emerald-950',
      descColor: 'text-emerald-900/80',
      badgeColor: 'bg-emerald-950/10 text-emerald-950 border-emerald-950/20',
      iconBg: 'bg-emerald-950/20 text-emerald-950'
    },
    { 
      id: 'po', 
      label: 'SAUDA CHECK POINT', 
      icon: FileText, 
      desc: 'Verify Active Purchase Orders', 
      step: '2',
      start: '#6CACFF',
      end: '#8DEBFF',
      textColor: 'text-blue-950',
      descColor: 'text-blue-900/80',
      badgeColor: 'bg-blue-950/10 text-blue-950 border-blue-950/20',
      iconBg: 'bg-blue-950/20 text-blue-950'
    },
    { 
      id: 'amad', 
      label: 'TEMPORARY M.R', 
      icon: Clock, 
      desc: 'Log Incoming Lorry Gates', 
      step: '3',
      start: '#41C7AF',
      end: '#54E38E',
      textColor: 'text-teal-950',
      descColor: 'text-teal-900/80',
      badgeColor: 'bg-teal-950/10 text-teal-950 border-teal-950/20',
      iconBg: 'bg-teal-950/20 text-teal-950'
    },
    { 
      id: 'inspection', 
      label: 'MILL INSPECTION', 
      icon: ClipboardCheck, 
      desc: 'Quality Audit Register', 
      step: '4',
      start: '#10B981',
      end: '#059669',
      textColor: 'text-white',
      descColor: 'text-emerald-100/90',
      badgeColor: 'bg-white/15 text-white border-white/20',
      iconBg: 'bg-white/15 text-white'
    },
    { 
      id: 'material_inspection', 
      label: 'INSPECTION CHECKLIST', 
      icon: ShieldCheck, 
      desc: 'Mill Quality & Moisture Inspection', 
      step: '4.1',
      start: '#5583EE',
      end: '#41D8DD',
      textColor: 'text-white',
      descColor: 'text-sky-100/90',
      badgeColor: 'bg-white/15 text-white border-white/20',
      iconBg: 'bg-white/15 text-white'
    },
    { 
      id: 'final_arrival', 
      label: 'FINAL ARRIVAL', 
      icon: CheckCircle2, 
      desc: 'Acceptance & Weighbridge Entry', 
      step: '5',
      start: '#99E5A2',
      end: '#D4FC78',
      textColor: 'text-slate-900',
      descColor: 'text-slate-800/85',
      badgeColor: 'bg-slate-900/10 text-slate-900 border-slate-900/20',
      iconBg: 'bg-slate-950/20 text-slate-950'
    },
    { 
      id: 'mismatch', 
      label: 'MISMATCH CASE', 
      icon: AlertTriangle, 
      desc: 'Discrepant Transactions Audit', 
      step: '6',
      start: '#FF9B42',
      end: '#FF5E62',
      textColor: 'text-white',
      descColor: 'text-rose-50/90',
      badgeColor: 'bg-white/15 text-white border-white/20',
      iconBg: 'bg-white/15 text-white'
    },
    { 
      id: 'club_po_mr', 
      label: 'CLUB P.O & M.R', 
      icon: Link, 
      desc: 'Bind Contracts to Arrivals', 
      step: '7',
      start: '#4E65FF',
      end: '#92EFFD',
      textColor: 'text-white',
      descColor: 'text-sky-50/90',
      badgeColor: 'bg-white/15 text-white border-white/20',
      iconBg: 'bg-white/15 text-white'
    },
    { 
      id: 'issue', 
      label: 'MATERIAL ISSUE', 
      icon: PackageCheck, 
      desc: 'Dispatch Material to Mill Floors', 
      step: '8',
      start: '#A16BFE',
      end: '#DEB0DF',
      textColor: 'text-white',
      descColor: 'text-purple-100/90',
      badgeColor: 'bg-white/15 text-white border-white/20',
      iconBg: 'bg-white/15 text-white'
    },
    { 
      id: 'mr_settlement', 
      label: 'M.R. SETTLEMENT', 
      icon: FileCheck, 
      desc: 'Weighbridge Quantity Settlements', 
      step: '9',
      start: '#D279EE',
      end: '#F8C390',
      textColor: 'text-white',
      descColor: 'text-indigo-950/85',
      badgeColor: 'bg-white/15 text-white border-white/20',
      iconBg: 'bg-white/15 text-white'
    },
    { 
      id: 'closing_stock', 
      label: 'STOCK INVENTORY', 
      icon: Layers, 
      desc: 'Stock Inventory Entry', 
      step: '10',
      start: '#F39C12',
      end: '#F1C40F',
      textColor: 'text-amber-950',
      descColor: 'text-amber-900/80',
      badgeColor: 'bg-amber-950/10 text-amber-950 border-amber-950/20',
      iconBg: 'bg-amber-950/20 text-amber-950'
    },
    { 
      id: 'ledger', 
      label: 'ACCOUNT', 
      icon: Scale, 
      desc: 'Supplier Finance Ledger Balance', 
      step: '12',
      start: '#A43AB2',
      end: '#E13680',
      textColor: 'text-white',
      descColor: 'text-fuchsia-100/90',
      badgeColor: 'bg-white/15 text-white border-white/20',
      iconBg: 'bg-white/15 text-white'
    },
    { 
      id: 'reports', 
      label: 'REPORTS', 
      icon: BarChart3, 
      desc: 'Operational Logs & CSV Audit', 
      step: '13',
      start: '#9D2E7D',
      end: '#E16E93',
      textColor: 'text-white',
      descColor: 'text-pink-100/90',
      badgeColor: 'bg-white/15 text-white border-white/20',
      iconBg: 'bg-white/15 text-white'
    },
    { 
      id: 'admindesk', 
      label: 'ADMIN', 
      icon: Lock, 
      desc: 'Terminal Master Management', 
      step: '14',
      start: '#121317',
      end: '#323B42',
      textColor: 'text-white',
      descColor: 'text-slate-300/90',
      badgeColor: 'bg-white/15 text-white border-white/20',
      iconBg: 'bg-white/15 text-white'
    },
    { 
      id: 'satta', 
      label: 'SATTA', 
      icon: Sparkles, 
      desc: 'Agent Satta Registrations', 
      step: '15',
      start: '#ABC7FF',
      end: '#C1E3FF',
      textColor: 'text-blue-950',
      descColor: 'text-blue-900/80',
      badgeColor: 'bg-blue-950/10 text-blue-950 border-blue-950/20',
      iconBg: 'bg-blue-950/20 text-blue-950'
    },
    { 
      id: 'requisition_desk', 
      label: 'REQUISITION DESK', 
      icon: ClipboardList, 
      desc: 'Operational Requisition Register', 
      step: '16',
      start: '#FFFEE0',
      end: '#E8F5E9',
      textColor: 'text-indigo-950',
      descColor: 'text-slate-700/85',
      badgeColor: 'bg-indigo-950/10 text-indigo-950 border-indigo-950/20',
      iconBg: 'bg-indigo-950/15 text-indigo-950'
    }
  ];

  const isModuleAllowed = (id: string, altId?: string) => {
    return hasModulePermission(id, allowedModules, isAdmin) || (altId ? hasModulePermission(altId, allowedModules, isAdmin) : false);
  };

  const dashboardSections = [
    {
      title: "Sauda To P.O",
      desc: "Contract booking, Satta rates, SMS confirmation, and Purchase Order generation.",
      borderColor: "border-emerald-200",
      headerBg: "from-emerald-950 to-emerald-800",
      items: [
        { 
          id: 'satta', 
          mappedId: 'satta',
          label: 'Satta', 
          icon: Sparkles, 
          desc: 'Agent Satta Registrations', 
          step: '1.1',
          start: '#ABC7FF',
          end: '#C1E3FF'
        },
        { 
          id: 'sms_sauda', 
          mappedId: 'sms_sauda',
          label: 'SMS Sauda Desk', 
          icon: MessageSquare, 
          desc: 'SMS Sauda Contracts Log', 
          step: '1.2',
          start: '#A16BFE',
          end: '#DEB0DF'
        },
        { 
          id: 'sauda', 
          mappedId: 'sauda',
          label: 'Sauda Desk', 
          icon: HandCoins, 
          desc: 'Sauda Contract Bookings', 
          step: '1.3',
          start: '#6DE195',
          end: '#C4E759'
        },
        { 
          id: 'po_temp', 
          mappedId: 'po',
          label: 'Sauda Check Point', 
          icon: FileText, 
          desc: 'Draft Purchase Orders', 
          step: '1.4',
          start: '#FF9B42',
          end: '#FFD38C'
        },
        { 
          id: 'po_final', 
          mappedId: 'final_po',
          label: 'Final P.O', 
          icon: FileText, 
          desc: 'Verify Active Purchase Orders', 
          step: '1.5',
          start: '#6CACFF',
          end: '#8DEBFF'
        }
      ]
    },
    {
      title: "T.M.R To M.R",
      desc: "Incoming lorry register, quality and moisture audits, discrepancy logging, and weighbridge M.R.",
      borderColor: "border-blue-200",
      headerBg: "from-blue-950 to-blue-800",
      items: [
        { 
          id: 'amad', 
          mappedId: 'amad',
          label: 'TEMPORARY M.R', 
          icon: Clock, 
          desc: 'Log Incoming Lorry Gates', 
          step: '2.1',
          start: '#41C7AF',
          end: '#54E38E'
        },
        { 
          id: 'inspection', 
          mappedId: 'inspection',
          label: 'MILL INSPECTION', 
          icon: ClipboardCheck, 
          desc: 'Quality Audit Register', 
          step: '2.2',
          start: '#10B981',
          end: '#059669'
        },
        { 
          id: 'material_inspection', 
          mappedId: 'material_inspection',
          label: 'INSPECTION CHECKLIST', 
          icon: ShieldCheck, 
          desc: 'Mill Quality & Moisture Inspection', 
          step: '2.3',
          start: '#5583EE',
          end: '#41D8DD'
        },
        {
          id: 'mismatch',
          mappedId: 'mismatch',
          label: 'Satta Mismatch',
          icon: AlertTriangle,
          desc: 'Satta contract discrepancies',
          step: '2.3',
          start: '#FF9B42',
          end: '#FF5E62'
        },
        {
          id: 'material_mismatch',
          mappedId: 'material_mismatch',
          label: 'Material Mismatch',
          icon: AlertTriangle,
          desc: 'Material / inspection discrepancies',
          step: '2.4',
          start: '#FB7185',
          end: '#F43F5E'
        },
        {
          id: 'final_arrival',
          mappedId: 'final_arrival',
          label: 'Final M.R',
          icon: CheckCircle2,
          desc: 'Weighbridge Gate Entry Acceptance',
          step: '2.5',
          start: '#99E5A2',
          end: '#D4FC78'
        }
      ]
    },
    {
      title: "Club P.O To Payment",
      desc: "Contract binding, quantity settlements, financial ledger balancing, and payments.",
      borderColor: "border-purple-200",
      headerBg: "from-purple-950 to-purple-800",
      items: [
        { 
          id: 'club_po_mr', 
          mappedId: 'club_po_mr',
          label: 'Club P.O & M.R', 
          icon: Link, 
          desc: 'Bind Contracts to Arrivals', 
          step: '3.1',
          start: '#4E65FF',
          end: '#92EFFD'
        },
        { 
          id: 'payment', 
          mappedId: 'payment',
          label: 'Payment', 
          icon: Wallet, 
          desc: 'Record Cash & Bank Payments', 
          step: '3.2',
          start: '#FB7185',
          end: '#F43F5E'
        },
        { 
          id: 'mr_settlement', 
          mappedId: 'mr_settlement',
          label: 'M.R Settlement', 
          icon: FileCheck, 
          desc: 'Weighbridge Quantity Settlements', 
          step: '3.3',
          start: '#D279EE',
          end: '#F8C390'
        }
      ]
    },
    {
      title: "Material Issue To Inventory",
      desc: "Material floor dispatches, physical stock counts, and storehouse requisitions.",
      borderColor: "border-amber-200",
      headerBg: "from-amber-950 to-amber-800",
      items: [
        { 
          id: 'issue', 
          mappedId: 'issue',
          label: 'Material Issue', 
          icon: PackageCheck, 
          desc: 'Dispatch Material to Mill Floors', 
          step: '4.1',
          start: '#A16BFE',
          end: '#DEB0DF'
        },
        { 
          id: 'closing_stock', 
          mappedId: 'closing_stock',
          label: 'Stock Inventory', 
          icon: Layers, 
          desc: 'Physical Stock Inventory Log', 
          step: '4.2',
          start: '#F39C12',
          end: '#F1C40F'
        },
        { 
          id: 'requisition_desk', 
          mappedId: 'requisition_desk',
          label: 'Requisition Desk', 
          icon: ClipboardList, 
          desc: 'Storehouse Requisition Register', 
          step: '4.3',
          start: '#FFFEE0',
          end: '#E8F5E9'
        }
      ]
    },
    {
      title: "System Administration",
      desc: "Database administration, schema validation, and security override tools.",
      borderColor: "border-slate-300",
      headerBg: "from-slate-900 to-slate-850",
      items: [
        {
          id: 'admindesk',
          mappedId: 'admindesk',
          label: 'Admin Desk',
          icon: Lock,
          desc: 'Terminal Master Database Management',
          step: '5.1',
          start: '#121317',
          end: '#323B42'
        }
      ]
    }
  ];

  return (
    <LegacyLayout 
      title="P.O Automation" 
      subtitle="Operational Hub"
      activeNavTab="dashboard"
      allowedModules={allowedModules}
      isAdmin={isAdmin}
      onNavClick={(pageId) => {
        if (pageId === 'dashboard') {
          setCurrentTab('menu');
        } else {
          onNavigate(pageId);
        }
      }}
    >
      <div className="space-y-6 max-w-full px-2 sm:px-4">
        
        {/* Top-level Sub-Menu Dashboard Selection Navigation Tabs */}
        {/* <div className="flex items-center gap-2 no-print border-b border-[#D6CAA8] pb-4 mt-2 font-mono"> */}
          <div className="hidden">
          <button
            onClick={() => setCurrentTab('menu')}
            className={cn(
              "h-9 px-4 border-2 flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] rounded-lg cursor-pointer text-xs uppercase tracking-wider font-extrabold",
              currentTab === 'menu'
                ? "bg-[#1E331B] border-[#1E331B] text-[#FAF7F0] shadow-sm"
                : "bg-[#FAF7F0] border-[#D6CAA8] text-[#5A6E54] hover:bg-[#EAE2D2] hover:text-[#1E331B]"
            )}
          >
            <LayoutDashboard className="h-4 w-4 text-emerald-400" />
            <span>Executive BI Dashboard</span>
          </button>

          <button
            onClick={() => setCurrentTab('reports')}
            className={cn(
              "h-9 px-4 border-2 flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] rounded-lg cursor-pointer text-xs uppercase tracking-wider font-extrabold",
              currentTab === 'reports'
                ? "bg-[#1E331B] border-[#1E331B] text-[#FAF7F0] shadow-sm"
                : "bg-[#FAF7F0] border-[#D6CAA8] text-[#5A6E54] hover:bg-[#EAE2D2] hover:text-[#1E331B]"
            )}
          >
            <BarChart3 className="h-4 w-4 text-amber-400" />
            <span>Report Dashboard</span>
          </button>

          <button
            onClick={() => onNavigate('admindesk')}
            className={cn(
              "h-9 px-4 border-2 flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] rounded-lg cursor-pointer text-xs uppercase tracking-wider font-extrabold bg-[#EAE2D2] border-[#D6CAA8] text-[#1E331B] hover:bg-[#FAF7F0]"
            )}
          >
            <Lock className="h-4 w-4 text-[#1E331B]" />
            <span>Admin Desk</span>
          </button>
          
          {emailHealthWarning && (
            <div className="flex items-center gap-2 bg-rose-100 border border-rose-300 text-rose-800 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse shadow-sm ml-auto mr-2 cursor-help" title="The last 3 system emails failed to send. Check Email Activity in Admin Desk.">
              <Mail className="h-3 w-3" />
              SMTP Warning
            </div>
          )}

          <button
            onClick={() => {
              loadUserProfile();
              setIsProfileOpen(true);
            }}
            className={cn(
              "h-9 px-4 border-2 flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] rounded-lg cursor-pointer text-xs uppercase tracking-wider font-extrabold bg-[#FAF7F0] border-[#D6CAA8] text-[#1E331B] hover:bg-[#EAE2D2] ml-auto"
            )}
          >
            <User className="h-4 w-4 text-[#1E331B]" />
            <span>{getCurrentUserContext().username || "ADMIN"}</span>
          </button>
        </div>
        
        {currentTab === 'menu' && (
          <ExecutiveBiDashboard
            arrivals={rawArrivals}
            saudas={rawSaudas}
            saudaCheckPoints={rawScp}
            saudaCheckPointDetails={rawScpDetails}
            traders={[]}
            pos={rawPos}
            settlements={[]}
            godowns={godowns}
            openingStocks={allOpeningStocks.length > 0 ? allOpeningStocks : stockNodeStocks}
            millIssueMasters={millIssueMasters}
            millIssueDetails={millIssueDetails}
            finalArrivals={[]}
            paymentRecords={payments}
            loading={loading}
            onRefresh={loadStats}
            onNavigate={onNavigate}
            setcurrentTab ={setCurrentTab}
            currentTab = {currentTab}
            allowedModules={allowedModules}
            isAdmin={isAdmin}
          />
        )}



        {false ? (
            <div className="space-y-8 pt-4 border-t border-[#D6CAA8]">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-lg font-bold text-[#1E331B] flex items-center gap-2">
                  <span>Detailed Process Modules</span>
                </h3>
              </div>

              {!isAdmin ? (
                <div className="space-y-4">
                  {(() => {
                    const permittedSections = dashboardSections
                      .filter(section => section.title !== "System Administration")
                      .map(section => ({
                        ...section,
                        allowedItems: section.items.filter(item => isModuleAllowed(item.mappedId, item.id))
                      }))
                      .filter(section => section.allowedItems.length > 0);

                    if (permittedSections.length === 0) {
                      return (
                        <div className="bg-[#FAF7F0] border border-[#D6CAA8] rounded-xl p-8 text-center text-[#5A6E54]">
                          <p className="text-sm font-semibold">No dashboard modules are currently assigned to your account.</p>
                          <p className="text-xs text-[#5A6E54]/80 mt-1">Please contact your system administrator to assign module access.</p>
                        </div>
                      );
                    }

                    const safeActiveIndex = Math.min(activeSectionIndex, permittedSections.length - 1);
                    const activeSection = permittedSections[safeActiveIndex] || permittedSections[0];
                    const allowedItems = activeSection.allowedItems;

                    return (
                      <>
                        <div className="bg-[#FAF7F0] border border-[#D6CAA8] rounded-xl shadow-xs p-2 flex flex-wrap gap-2 w-full justify-start items-center">
                          {permittedSections.map((section, secIdx) => (
                            <button 
                              key={secIdx} 
                              onClick={() => setActiveSectionIndex(secIdx)}
                              className={cn(
                                "px-4 py-2 border font-bold text-[10px] uppercase tracking-widest rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer",
                                safeActiveIndex === secIdx
                                  ? "bg-[#1E331B] border-[#1E331B] text-[#FAF7F0] shadow-xs"
                                  : "bg-[#FAF7F0] hover:bg-[#EAE2D2] border-[#D6CAA8] text-[#5A6E54] hover:text-[#1E331B]"
                              )}
                            >
                              <Layers className="h-3.5 w-3.5" />
                              {section.title}
                            </button>
                          ))}
                        </div>
                        
                        {/* Selected Section Content */}
                        <div className="bg-[#FAF7F0] border border-[#D6CAA8] rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <div className="bg-gradient-to-r from-[#1C3119] to-[#2A4426] text-[#FAF7F0] px-5 py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#314E28]">
                            <div>
                              <h2 className="text-xs font-black uppercase tracking-wider italic flex items-center gap-2 text-[#E2EDDE]">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                {activeSection.title}
                              </h2>
                              <p className="text-[10px] text-[#A2C49D] font-bold uppercase tracking-wider mt-0.5 font-sans">
                                {activeSection.desc}
                              </p>
                            </div>
                            <span className="text-[9px] font-mono font-bold uppercase tracking-widest bg-[#274024] text-[#E2EDDE] border border-[#486343] px-2.5 py-0.5 rounded-md">
                              {allowedItems.length} PERMITTED MODULES
                            </span>
                          </div>
                          <div className="p-5 bg-[#F4EFE6]/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {allowedItems.map((item, itemIdx) => {
                              const stepItem = Object.values(processSteps).find(s => s.id === item.id) || 
                                              { step: '00', label: item.label, desc: item.desc, start: '#2e7d32', end: '#1b5e20' };
                              const IconComp = item.icon;
                              const allowed = isModuleAllowed(item.mappedId);
                              
                              return (
                                <div key={itemIdx} className="relative group">
                                  <button
                                    onClick={async () => {
                                      if (allowed) {
                                        if (item.id === 'sms_sauda') {
                                          await onNavigate('sms_sauda');
                                        } else {
                                          await onNavigate(item.mappedId, item.id);
                                        }
                                      } else {
                                        alert(`Access Denied to module [${item.id}]`);
                                      }
                                    }}
                                    className={cn(
                                      "w-full text-left bg-[#FAF7F0] border border-[#D6CAA8] rounded-xl p-4 shadow-xs transition-all duration-300 h-full flex flex-col relative overflow-hidden",
                                      allowed ? "hover:shadow-md hover:border-[#1E331B] hover:-translate-y-0.5 cursor-pointer" : "opacity-75 cursor-not-allowed bg-[#F4EFE6] grayscale-[50%]"
                                    )}
                                  >
                                    {/* Left green accent bar */}
                                    {allowed && (
                                      <div 
                                        className="absolute left-0 top-0 bottom-0 w-1 bg-[#1E331B]"
                                      />
                                    )}

                                    {/* Top: code pill badge & permission status */}
                                    <div className="flex justify-between items-center w-full pl-1.5">
                                      <span className={cn(
                                        "text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border",
                                        allowed
                                          ? "bg-[#EAE2D2] text-[#1E331B] border-[#D6CAA8]"
                                          : "bg-slate-100 text-slate-400 border-slate-200"
                                      )}>
                                        CODE {stepItem.step}
                                      </span>
                                      
                                      {!allowed ? (
                                        <span className="text-slate-400 bg-slate-100 p-1 rounded-full" title="Locked">
                                          <LockKeyhole className="h-3.5 w-3.5" />
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1 bg-emerald-100/70 px-2 py-0.5 rounded-md border border-emerald-300/60">
                                          <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse" />
                                          <span>READY</span>
                                        </span>
                                      )}
                                    </div>

                                    {/* Middle: Title & Description */}
                                    <div className="my-2.5 min-w-0 pl-1.5 flex-1">
                                      <h3 className={cn(
                                        "text-xs font-bold tracking-wide uppercase truncate leading-tight",
                                        allowed ? "text-[#1E331B]" : "text-slate-400"
                                      )}>
                                        {stepItem.label}
                                      </h3>
                                      <p className={cn(
                                        "text-[10px] font-medium leading-relaxed mt-1 uppercase tracking-tight line-clamp-2",
                                        allowed ? "text-[#5A6E54] group-hover:text-[#1E331B]" : "text-slate-400/80"
                                      )}>
                                        {stepItem.desc}
                                      </p>
                                    </div>

                                    {/* Bottom: Icon & Open CTA */}
                                    <div className="flex justify-between items-center w-full pt-2 border-t border-[#EAE2D2] pl-1.5 mt-auto">
                                      <div className="p-1.5 rounded-lg bg-[#EAE2D2]/60 text-[#1E331B]">
                                        <IconComp className="h-4 w-4 text-[#1E331B]" />
                                      </div>
                                      
                                      {allowed && (
                                        <div className="text-[9px] font-bold text-[#5A6E54] group-hover:text-[#1E331B] group-hover:translate-x-1 transition-all flex items-center gap-0.5 uppercase tracking-wider">
                                          <span>OPEN</span>
                                          <ArrowRight className="h-3 w-3" />
                                        </div>
                                      )}
                                    </div>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                dashboardSections.filter(section => isAdmin || section.title !== "System Administration").map((section, secIdx) => {
                  const allowedItems = section.items.filter(item => isModuleAllowed(item.mappedId, item.id));
                  if (!isAdmin && allowedItems.length === 0) return null;
                  
                  return (
                    <div key={secIdx} className="bg-[#FAF7F0] border border-[#D6CAA8] rounded-xl shadow-xs overflow-hidden">
                    {/* Section Title Header */}
                    <div className="bg-gradient-to-r from-[#1C3119] to-[#2A4426] text-[#FAF7F0] px-5 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#314E28]">
                      <div>
                        <h2 className="text-xs font-black uppercase tracking-wider italic flex items-center gap-2 text-[#E2EDDE]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          {section.title}
                        </h2>
                        <p className="text-[10px] text-[#A2C49D] font-bold uppercase tracking-wider mt-0.5 font-sans">
                          {section.desc}
                        </p>
                      </div>
                      <span className="text-[9px] font-mono font-bold uppercase tracking-widest bg-[#274024] text-[#E2EDDE] border border-[#486343] px-2.5 py-0.5 rounded-md">
                        {allowedItems.length} ACTIVE MODULES
                      </span>
                    </div>

                    {/* Section Grid Cards Container */}
                    <div className="p-5 bg-[#F4EFE6]/40">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 relative">
                        {section.items.map((stepItem, index) => {
                          const allowed = isModuleAllowed(stepItem.mappedId);
                          const IconComp = stepItem.icon;
                          
                          return (
                            <div key={index} className="relative flex flex-col justify-between group">
                              
                              {/* Step Button Card */}
                              <button
                                onClick={async () => {
                                  if (allowed) {
                                    if (stepItem.id === 'sms_sauda') {
                                      await onNavigate('sms_sauda');
                                    } else {
                                      await onNavigate(stepItem.mappedId, stepItem.id);
                                    }
                                  } else {
                                    alert(`Access Denied: Your Operator profile does not hold permissions for ${stepItem.label}.`);
                                  }
                                }}
                                disabled={false}
                                className={cn(
                                  "w-full text-left p-4 flex flex-col justify-between h-[154px] rounded-xl relative cursor-pointer transition-all duration-300 border overflow-hidden bg-[#FAF7F0] border-[#D6CAA8]",
                                  allowed 
                                    ? "shadow-xs hover:shadow-md hover:border-[#1E331B] hover:-translate-y-1" 
                                    : "bg-[#F4EFE6] border-[#D6CAA8] opacity-60 cursor-not-allowed"
                                )}
                              >
                                
                                {/* Left green accent bar */}
                                {allowed && (
                                  <div 
                                    className="absolute left-0 top-0 bottom-0 w-1 bg-[#1E331B]" 
                                  />
                                )}

                                {/* Top: code pill & status */}
                                <div className="flex justify-between items-center w-full pl-1.5">
                                  <span className={cn(
                                    "text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-md border",
                                    allowed 
                                      ? "bg-[#EAE2D2] text-[#1E331B] border-[#D6CAA8]" 
                                      : "bg-slate-100 text-slate-400 border-slate-200"
                                  )}>
                                    CODE {stepItem.step}
                                  </span>
                                  
                                  {!allowed ? (
                                    <span className="text-slate-400 bg-slate-100 p-1 rounded-full" title="Locked">
                                      <LockKeyhole className="h-3.5 w-3.5" />
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1 bg-emerald-100/70 px-2 py-0.5 rounded-md border border-emerald-300/60">
                                      <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse" />
                                      <span>READY</span>
                                    </span>
                                  )}
                                </div>
                                
                                {/* Middle: Title & Description */}
                                <div className="my-2 min-w-0 pl-1.5">
                                  <h3 className={cn(
                                    "text-[12.5px] font-extrabold tracking-wide uppercase truncate leading-tight",
                                    allowed ? "text-[#1E331B]" : "text-slate-400"
                                  )}>
                                    {stepItem.label}
                                  </h3>
                                  <p className={cn(
                                    "text-[9.5px] font-medium leading-relaxed mt-1 uppercase tracking-tight line-clamp-2",
                                    allowed ? "text-[#5A6E54] group-hover:text-[#1E331B]" : "text-slate-400/80"
                                  )}>
                                    {stepItem.desc}
                                  </p>
                                </div>

                                {/* Bottom: Icon & Open CTA */}
                                <div className="flex justify-between items-center w-full pt-2 border-t border-[#EAE2D2] pl-1.5">
                                  <div className="p-1.5 rounded-lg bg-[#EAE2D2]/60 text-[#1E331B]">
                                    <IconComp className="h-4 w-4 text-[#1E331B]" />
                                  </div>
                                  
                                  {allowed && (
                                    <div className="text-[9px] font-bold text-[#5A6E54] group-hover:text-[#1E331B] group-hover:translate-x-1 transition-all flex items-center gap-0.5 uppercase tracking-wider">
                                      <span>OPEN</span>
                                      <ArrowRight className="h-3 w-3" />
                                    </div>
                                  )}
                                </div>

                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }))}
            </div>
        ) : null}

        {false ? (
          <div className="space-y-6">

        
         {/* Analytical Insights Rechants Consoles */}
         <LegacyFieldset legend="Analytical Insights Console">
            <div className="flex border-b border-slate-200 mb-4  overflow-x-auto scrollbar-none">
               <button
                 type="button"
                 onClick={() => setActiveChartTab('general')}
                 className={cn(
                    "px-4 py-2.5 text-[10px] uppercase tracking-wider font-black border-b-2 transition-all cursor-pointer whitespace-nowrap",
                    activeChartTab === 'general' 
                      ? "border-blue-600 text-blue-600 bg-blue-50/20" 
                      : "border-transparent text-slate-400 hover:text-slate-600"
                 )}
               >
                  📁 Bales, Regions & Settlements
               </button>
               <button
                 type="button"
                 onClick={() => setActiveChartTab('grades')}
                 className={cn(
                    "px-4 py-2.5 text-[10px] uppercase tracking-wider font-black border-b-2 transition-all cursor-pointer whitespace-nowrap",
                    activeChartTab === 'grades' 
                      ? "border-emerald-500 text-emerald-600 bg-emerald-50/20" 
                      : "border-transparent text-slate-400 hover:text-slate-600"
                 )}
               >
                  🏷️ Jute Grade Stocks & Inspections
               </button>
            </div>

            {activeChartTab === 'general' ? (
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-1 ">
                  
                  {/* Chart 1: Arrival Trends */}
                  <div className="bg-white border border-slate-300 p-3 rounded-xl shadow-sm">
                     <h4 className="text-[10px] font-black uppercase text-indigo-950 mb-2 tracking-wider flex items-center gap-1 border-b pb-1">
                        📈 Station Arrival Trends (Packets/Day)
                     </h4>
                     <div className="h-44 w-full">
                        {arrivalTrendsData.length > 0 ? (
                           <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                              <BarChart data={arrivalTrendsData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                 <XAxis dataKey="name" tick={{ fontSize: 7 }} />
                                 <YAxis tick={{ fontSize: 7 }} />
                                 <Tooltip contentStyle={{ fontSize: 8, fontWeight: 'bold' }} />
                                 <Bar dataKey="packets" fill="#2563eb" radius={[1, 1, 0, 0]} name="Bale Packets" />
                              </BarChart>
                           </ResponsiveContainer>
                        ) : (
                           <div className="h-full flex items-center justify-center text-gray-400 italic text-[9px]">
                              No recent arrivals loaded...
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Chart 2: PO Regional Contract Volume Distribution */}
                  <div className="bg-white border border-slate-300 p-3 rounded-xl shadow-sm">
                     <h4 className="text-[10px] font-black uppercase text-indigo-950 mb-2 tracking-wider flex items-center gap-1 border-b pb-1">
                        📂 PO Contract Weight by Region (MT Tons)
                     </h4>
                     <div className="h-44 w-full">
                        {poDistributionData.length > 0 ? (
                           <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                              <AreaChart data={poDistributionData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                 <XAxis dataKey="name" tick={{ fontSize: 6.5, width: 50 }} interval={0} />
                                 <YAxis tick={{ fontSize: 7 }} />
                                 <Tooltip contentStyle={{ fontSize: 8, fontWeight: 'bold' }} />
                                 <Area type="monotone" dataKey="weight" stroke="#4f46e5" fill="#e0e7ff" name="Contract Weight" />
                              </AreaChart>
                           </ResponsiveContainer>
                        ) : (
                           <div className="h-full flex items-center justify-center text-gray-400 italic text-[9px]">
                              No historical PO contracts area distribution...
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Chart 3: Settlement Payment Status Breakdown */}
                  <div className="bg-white border border-slate-300 p-3 rounded-xl shadow-sm">
                     <h4 className="text-[10px] font-black uppercase text-indigo-950 mb-2 tracking-wider flex items-center gap-1 border-b pb-1">
                        ⚖️ Claim Settlement Payments Status Summary
                     </h4>
                     <div className="h-44 w-full flex items-center justify-center">
                        {settlementPieData.length > 0 ? (
                           <>
                              <div className="w-1/2 h-full">
                                 <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                                    <PieChart>
                                       <Pie
                                         data={settlementPieData}
                                         cx="50%"
                                         cy="50%"
                                         innerRadius={28}
                                         outerRadius={45}
                                         paddingAngle={2}
                                         dataKey="value"
                                       >
                                          {settlementPieData.map((entry, idx) => (
                                             <Cell key={idx} fill={entry.color} />
                                          ))}
                                       </Pie>
                                       <Tooltip contentStyle={{ fontSize: 8, fontWeight: 'bold' }} />
                                    </PieChart>
                                 </ResponsiveContainer>
                              </div>
                              <div className="w-1/2 space-y-1.5 pl-1 shrink-0">
                                 {settlementPieData.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-1 text-[8.5px] font-black leading-none">
                                       <div className="w-2 h-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                                       <span className="text-slate-500 uppercase truncate" style={{ maxWidth: '60px' }}>{item.name}:</span>
                                       <span className="text-slate-900 font-mono font-extrabold">{item.value}</span>
                                    </div>
                                 ))}
                              </div>
                           </>
                        ) : (
                           <div className="h-full flex items-center justify-center text-gray-400 italic text-[9px]">
                              No records in claim settlement nodes.
                           </div>
                        )}
                     </div>
                  </div>

               </div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-1 ">
                  
                  {/* Grade-wise Arrival Trends Stacked */}
                  <div className="bg-white border border-slate-300 p-3 rounded-xl shadow-sm md:col-span-2">
                     <h4 className="text-[10px] font-black uppercase text-indigo-950 mb-2 tracking-wider flex items-center justify-between border-b pb-1">
                        <span>📈 Station Arrival Volume Trends by Grade (MT Tons)</span>
                     </h4>
                     <div className="h-44 w-full">
                        {gradeArrivalTrendsData.trends.length > 0 ? (
                           <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                              <BarChart data={gradeArrivalTrendsData.trends} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                 <XAxis dataKey="date" tick={{ fontSize: 7 }} />
                                 <YAxis tick={{ fontSize: 7 }} />
                                 <Tooltip contentStyle={{ fontSize: 8, fontWeight: 'bold' }} />
                                 <Legend wrapperStyle={{ fontSize: 7.5, fontWeight: 'bold' }} />
                                 {gradeArrivalTrendsData.grades.map((grade, idx) => {
                                    const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1'];
                                    return (
                                       <Bar key={grade} dataKey={grade} stackId="a" fill={COLORS[idx % COLORS.length]} name={grade} />
                                    );
                                 })}
                              </BarChart>
                           </ResponsiveContainer>
                        ) : (
                           <div className="h-full flex items-center justify-center text-gray-400 italic text-[9px]">
                              No recent grade arrivals tracked. Keep loading Material Quality inspections first.
                           </div>
                        )}
                     </div>
                  </div>

                  {/* Grade-wise Stock Levels Bar */}
                  <div className="bg-white border border-slate-300 p-3 rounded-xl shadow-sm">
                     <h4 className="text-[10px] font-black uppercase text-indigo-950 mb-2 tracking-wider flex items-center justify-between border-b pb-1">
                        <span>📦 Warehouse Stock Levels (Bales)</span>
                     </h4>
                     <div className="h-44 w-full">
                        {gradeStockLevelsData.length > 0 ? (
                           <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                              <BarChart data={gradeStockLevelsData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                                 <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                 <XAxis dataKey="grade" tick={{ fontSize: 7 }} />
                                 <YAxis tick={{ fontSize: 7 }} />
                                 <Tooltip contentStyle={{ fontSize: 8, fontWeight: 'bold' }} />
                                 <Bar dataKey="quantity" fill="#ec4899" radius={[1, 1, 0, 0]} name="Bales Quantity" />
                              </BarChart>
                           </ResponsiveContainer>
                        ) : (
                           <div className="h-full flex items-center justify-center text-gray-400 italic text-[9px]">
                              No stock records found in Stock Inventory. Use "Stock Inventory" console to create opening stock entries.
                           </div>
                        )}
                     </div>
                  </div>

               </div>
            )}
         </LegacyFieldset>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
             {/* Quick Report Widget */}
             <QuickReport
               totalArrivals={quickReportData.totalArrivals}
               pendingMrSettlements={quickReportData.pendingMrSettlements}
               totalPackets={quickReportData.totalPackets}
               totalWeightQtl={quickReportData.totalWeightQtl}
               loading={quickReportData.loading}
               onRefresh={loadStats}
               onNavigate={onNavigate}
             />

             {/* Dynamic Activity Ledger */}
             <LegacyFieldset legend="Arrivals Activity Log Ledger">
                <div className="bg-white border border-slate-300 shadow-sm rounded-xl overflow-x-auto min-h-[220px]">
                   <table className="w-full text-left text-[10px] font-bold border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                         <tr>
                            <th className="px-3 py-2.5 border-r border-slate-100">Time</th>
                            <th className="px-3 py-2.5 border-r border-slate-100">Lorry Number</th>
                            <th className="px-3 py-2.5 border-r border-slate-100">Vyapari Name</th>
                            <th className="px-3 py-2.5 border-r border-slate-100">Station</th>
                            <th className="px-3 py-2.5 border-r border-slate-100">Qty (Bale)</th>
                            <th className="px-3 py-2.5">Status</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                         {recentAmad.length > 0 ? recentAmad.map((row, i) => {
                           const safeCell = (v: any, fallback = '...') => {
                             if (v === null || v === undefined) return fallback;
                             if (typeof v === 'object') return v.name || v.title || JSON.stringify(v);
                             return String(v);
                           };

                           return (
                             <tr key={i} className="hover:bg-slate-50 cursor-default transition-colors">
                                <td className="px-3 py-2.5 border-r border-slate-100 text-slate-400 font-mono italic">
                                   {row.created_at && !isNaN(new Date(row.created_at).getTime()) ? new Date(row.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                                </td>
                                <td className="px-3 py-2.5 border-r border-slate-100">{safeCell(row.truck_no || row.lorry_number || row.vehicle_no, '-')}</td>
                                <td className="px-3 py-2.5 border-r border-slate-100 text-indigo-950 font-extrabold">{safeCell(row.vyapari_name || row.supplier, 'LOCAL')}</td>
                                <td className="px-3 py-2.5 border-r border-slate-100">{safeCell(row.station, 'MAIN')}</td>
                                <td className="px-3 py-2.5 border-r border-slate-100 text-slate-700">{safeCell(row.packets, '0')}</td>
                                <td className="px-3 py-2.5 text-emerald-700">{safeCell(row.status, 'RECEIVED')}</td>
                             </tr>
                           );
                         }) : (
                           <tr>
                              <td colSpan={6} className="px-3 py-10 text-center text-slate-400 italic">No recent transactions found</td>
                           </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </LegacyFieldset>
          </div>

          {/* Quick Actions & Node details */}
          <div className="space-y-4">
             <LegacyFieldset legend="Quick Actions Center">
                <div className="flex flex-col gap-2">
                   <button 
                     onClick={() => onNavigate('material_inspection')}
                     className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 p-2.5 text-[10px] font-black uppercase text-left flex flex-row items-center justify-between group text-emerald-800 rounded-lg cursor-pointer transition-colors"
                   >
                      <span>Log Quality Audit Inspection</span>
                      <ArrowUpRight className="h-3 w-3 text-emerald-400 group-hover:text-emerald-750 font-extrabold" />
                   </button>

                </div>
             </LegacyFieldset>

             <LegacyFieldset legend="System State Metadata">
                <div className="space-y-3 py-1 font-mono text-[9px] font-bold text-slate-400">
                   <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span>STATION:</span>
                      <span className="text-indigo-950 font-black">BJCL-M01-WB</span>
                   </div>
                   <div className="flex justify-between border-b border-slate-100 pb-1.5">
                      <span>PERSISTENCE:</span>
                      <span className="text-emerald-600 font-extrabold">SUPABASE DATABASE (LIVE)</span>
                   </div>
                   <div className="flex justify-between pb-1">
                      <span>BUILD VERSION:</span>
                      <span className="text-slate-600">4.8.2-STABLE</span>
                   </div>
                </div>
             </LegacyFieldset>
          </div>
        </div>
      </div>
    ) : null}

        {/* Godown Capacity Audited Breakdown Modal */}
        {isGodownModalOpen && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#d4d0c8] border-2 border-white shadow-[4px_4px_16px_rgba(0,0,0,0.45),inset_1.5px_1.5px_0px_white] w-full max-w-4xl flex flex-col rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 h-[85vh]">
              
              {/* Title Bar Windows 95 style */}
              <div className="bg-[#000080] text-white px-2.5 py-1.5 flex justify-between items-center ">
                <div className="flex items-center gap-1.5 font-bold text-xs font-sans tracking-wide">
                  <Container className="h-4 w-4 text-slate-200" />
                  <span>GODOWN CAPACITY UTILIZATION SUMMARY REGISTER</span>
                </div>
                <button 
                  onClick={() => { setIsGodownModalOpen(false); setSelectedGodownIndex(null); }}
                  className="bg-[#d4d0c8] text-black px-1.5 py-0.5 border border-white hover:bg-red-650 hover:text-white transition-colors active:shadow-[inset_1px_1px_0_1px_rgba(0,0,0,0.5)] flex items-center justify-center cursor-pointer font-extrabold text-[10px]"
                >
                  ✕
                </button>
              </div>

              {/* Upper Control Bar */}
              <div className="bg-[#c0c0c0] p-3 border-b border-gray-400 border border-black/25 flex justify-between items-center  p-2 gap-2 flex-wrap">
                <div className="flex gap-4 flex-wrap">
                  <div className="bg-white px-3 py-1 border border-gray-400 rounded shadow-sm shadow-inner min-w-[110px]">
                    <span className="text-[8px] font-bold text-gray-500 uppercase block leading-none mb-0.5">Total Owned Nodes</span>
                    <span className="text-[11px] font-black italic text-stone-850 tracking-tight">{godownUtils.length} Godowns</span>
                  </div>
                  <div className="bg-white px-3 py-1 border border-gray-400 rounded shadow-sm shadow-inner min-w-[120px]">
                    <span className="text-[8px] font-bold text-gray-500 uppercase block leading-none mb-0.5">Total Registered Cap</span>
                    <span className="text-[11px] font-black italic text-indigo-950 tracking-tight">
                      {godownUtils.reduce((acc, g) => acc + g.capacity, 0).toLocaleString()} MT
                    </span>
                  </div>
                  <div className="bg-white px-3 py-1 border border-gray-400 rounded shadow-sm shadow-inner min-w-[130px]">
                    <span className="text-[8px] font-bold text-gray-500 uppercase block leading-none mb-0.5">Physical Stock Live</span>
                    <span className="text-[11px] font-black italic text-emerald-950 tracking-tight">
                      {godownUtils.reduce((acc, g) => acc + g.stockMt, 0).toFixed(1)} MT
                    </span>
                  </div>
                  <div className="bg-white px-3 py-1 border border-gray-400 rounded shadow-sm shadow-inner min-w-[120px]">
                    <span className="text-[8px] font-bold text-gray-500 uppercase block leading-none mb-0.5">Global Utility Rate</span>
                    <span className="text-[11px] font-black italic text-amber-600 tracking-tight">
                      {stats.godownUtilization || '0'}%
                    </span>
                  </div>
                </div>
                <div className="hidden md:block text-[9px] font-mono font-black italic text-indigo-950 pr-2 uppercase">Capacity Controls Center</div>
              </div>

              {/* Main Split Content Body */}
              <div className="flex-1 overflow-hidden flex bg-white divide-x divide-slate-300">
                
                {/* Left Side: Godown List */}
                <div className="w-1/2 overflow-y-auto p-2.5 space-y-2">
                  <p className="text-[9px] font-black uppercase text-gray-400 tracking-wide mb-2.5">Select a Warehouse Row to audit:</p>
                  
                  <div className="space-y-1.5">
                    {godownUtils.map((g, idx) => {
                      const isSelected = selectedGodownIndex === idx;
                      return (
                        <div 
                          key={idx}
                          onClick={() => setSelectedGodownIndex(idx)}
                          className={cn(
                            "p-2 py-2.5 border rounded transition-all cursor-pointer  relative group",
                            isSelected 
                              ? "bg-slate-100 border-indigo-600 shadow-sm shadow-slate-150" 
                              : "border-slate-200 hover:border-slate-350 hover:bg-slate-50"
                          )}
                        >
                          <div className="flex justify-between items-start mb-1.5">
                            <div>
                              <span className="text-[8px] font-black text-blue-800 bg-blue-50 border border-blue-200 px-1 py-0.5 rounded mr-1.5 font-mono uppercase tracking-wider">
                                {g.code}
                              </span>
                              <strong className="text-xs uppercase font-extrabold text-slate-800">{g.name}</strong>
                            </div>
                            <span className={cn(
                              "text-[10px] font-black font-mono",
                              g.utilization > 80 ? "text-red-650" :
                              g.utilization > 50 ? "text-amber-600" : "text-emerald-700"
                            )}>
                              {g.utilization}%
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-slate-200 rounded-sm h-1.5 mb-2 overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-sm transition-all duration-300",
                                g.utilization > 80 ? "bg-red-500" :
                                g.utilization > 50 ? "bg-amber-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${Math.min(100, g.utilization)}%` }}
                            />
                          </div>

                          <div className="flex justify-between text-[8px] font-bold text-gray-500 font-mono">
                            <span>CAPACITY: {g.capacity} MT</span>
                            <span>STOCK: {g.stockMt.toFixed(1)} MT ({g.bales.toLocaleString()} Bales)</span>
                          </div>

                          <span className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 text-[7px] font-black uppercase text-indigo-700 tracking-wider transition-opacity ">
                            Inspect details →
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Side: Detailed stock breakdown of selected Godown */}
                <div className="w-1/2 overflow-y-auto p-4 bg-slate-50/50 flex flex-col">
                  {selectedGodownIndex !== null ? (
                    (() => {
                      const selG = godownUtils[selectedGodownIndex];
                      return (
                        <div className="space-y-4">
                          <div className="border-b border-slate-200 pb-3">
                            <h4 className="text-xs font-black uppercase text-indigo-950 tracking-tight flex items-center gap-1.5">
                              <Scale className="h-4 w-4 text-indigo-800 shrink-0" />
                              RE-INSPECTION LEDGERS FOR GODOWN {selG.name}
                            </h4>
                            <p className="text-[10px] text-gray-500 font-medium font-mono">Code Reference: <strong className="font-extrabold text-slate-700">GDN-{selG.code}</strong></p>
                          </div>

                          {/* Snapshot stats */}
                          <div className="grid grid-cols-2 gap-3 h-fit">
                            <div className="bg-white p-2.5 border border-slate-200 rounded shadow-xs shadow-inner">
                              <span className="text-[8px] font-black text-gray-400 block uppercase leading-none mb-1">RATED CAPACITY</span>
                              <strong className="text-stone-850 text-[11px] font-mono leading-none">{selG.capacity} MT</strong>
                            </div>
                            <div className="bg-white p-2.5 border border-slate-200 rounded shadow-xs shadow-inner">
                              <span className="text-[8px] font-black text-gray-400 block uppercase leading-none mb-1">LOADED STOCK</span>
                              <strong className="text-stone-850 text-[11px] font-mono leading-none">{selG.stockMt.toFixed(2)} MT</strong>
                            </div>
                          </div>

                          <div className="border border-slate-350 rounded bg-white overflow-x-auto shadow-sm">
                            <table className="w-full text-left text-[9px] border-collapse min-w-[450px]">
                              <thead className="bg-[#c0c0c0] border-b border-slate-400 uppercase text-slate-800 font-black italic font-mono size-fit">
                                <tr className="h-7 border-b border-[#808080]/30 text-[9px]">
                                  <th className="px-3 border-r border-[#808080]/35 uppercase">Grade Component</th>
                                  <th className="px-3 text-right border-r border-[#808080]/35 uppercase">Bales Qty</th>
                                  <th className="px-3 text-right border-r border-[#808080]/35 uppercase">Weight (KG)</th>
                                  <th className="px-3 text-right uppercase">Weight (MT)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-155 font-bold text-slate-800 font-mono">
                                {selG.stocks && selG.stocks.length > 0 ? (
                                  selG.stocks.map((st: any, idx: number) => (
                                    <tr key={idx} className="h-7 hover:bg-slate-50 text-[9px]">
                                      <td className="px-3 border-r border-slate-100 font-bold">
                                        <span className="bg-indigo-50 border border-indigo-150 text-indigo-950 px-1 py-0.5 rounded text-[8px] font-black">
                                          {st.grade}
                                        </span>
                                      </td>
                                      <td className="px-3 text-right border-r border-slate-100 font-bold text-slate-700">{Number(st.quantity || 0).toLocaleString()}</td>
                                      <td className="px-3 text-right border-r border-slate-100 font-bold text-emerald-800">{(Number(st.weight || 0) * 100).toLocaleString(undefined, {maximumFractionDigits: 0})} kg</td>
                                      <td className="px-3 text-right font-bold text-blue-800">{(Number(st.weight || 0) / 10).toFixed(2)} MT</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr className="h-20 bg-stone-50">
                                    <td colSpan={4} className="text-center text-gray-400 italic">
                                      No direct physical stock records found in opening_stock tables for this godown.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          <div className="bg-amber-50 border border-amber-255 rounded p-2.5 shadow-sm font-sans">
                            <h5 className="text-[10px] font-black uppercase text-amber-800 mb-0.5">Capacity Auditing Notice</h5>
                            <p className="text-[9px] text-amber-900/90 leading-relaxed font-bold">
                              These stock metrics represent active inventory allocated securely inside this specific node directory. Always match against monthly physical floor counts before authorizing issues.
                            </p>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex-1 flex flex-col justify-center items-center text-center p-8 text-gray-400 ">
                      <Container className="h-10 w-10 text-slate-300 stroke-[1.25] mb-2" />
                      <h4 className="text-xs font-black text-slate-700 uppercase mb-1 font-sans">No Godown Selected</h4>
                      <p className="text-[10px] max-w-xs text-gray-400 leading-snug font-sans font-medium">Click any godown row on the left panel catalog list to print or view active stock allocations and live weight metrics directly from the database.</p>
                    </div>
                  )}

                </div>

              </div>

              {/* Popup Footer */}
              <div className="bg-[#c0c0c0] p-2 border-t border-slate-400 flex justify-end gap-1.5 ">
                <button 
                  onClick={() => { setIsGodownModalOpen(false); setSelectedGodownIndex(null); }}
                  className="bg-indigo-900 hover:bg-indigo-950 text-white font-extrabold uppercase tracking-wider text-[10px] px-6 h-7 border border-white shadow-[1px_1px_0_0_black] cursor-pointer"
                >
                  Close Summary Dialog
                </button>
              </div>

            </div>
          </div>
        )}

        {/* SMS Sauda Contract Booking Register Modal */}
        {isSmsSaudaModalOpen && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 ">
            <div className="bg-slate-50 border border-slate-200 shadow-2xl w-full max-w-7xl flex flex-col rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 h-[92vh] max-h-[92vh]">
              
              {/* Modern Header Bar matching primary dashboard styling */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white px-5 py-3.5 flex justify-between items-center  border-b border-slate-800 shrink-0">
                <div className="flex flex-col">
                  <h2 className="text-xs font-black uppercase tracking-wider italic flex items-center gap-2 text-indigo-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    SMS Sauda Desk
                  </h2>
                  <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider mt-0.5 font-sans">
                    BALLY JUTE COMPANY LIMITED » SAUDA REGISTER VIEW
                  </p>
                </div>
                
                {/* Window Controllers */}
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => setIsSmsSaudaModalOpen(false)}
                    title="Back to Main Dashboard"
                    className="h-8 w-8 bg-white/10 hover:bg-white/20 border border-white/10 text-white rounded-lg cursor-pointer flex items-center justify-center transition-all"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => setIsSmsSaudaModalOpen(false)}
                    className="h-8 w-8 bg-red-650 hover:bg-red-700 text-white rounded-lg font-black text-xs cursor-pointer flex items-center justify-center transition-all"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Tab Selector & Control Bar */}
              <div className="bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-4  shrink-0 shadow-sm font-sans">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setSmsSaudaTab('sms')}
                    className={cn(
                      "h-9 px-4 border-2 flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] rounded-md cursor-pointer text-xs uppercase tracking-wider font-extrabold",
                      smsSaudaTab === 'sms'
                        ? "bg-indigo-100 border-indigo-600 text-indigo-900 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.15)]"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <MessageSquare className="h-4 w-4 text-indigo-600" />
                    <span>SMS Inbox ({googleSheetSmsData.length})</span>
                  </button>

                  <button
                    onClick={() => setSmsSaudaTab('manual')}
                    className={cn(
                      "h-9 px-4 border-2 flex items-center gap-2 transition-all active:translate-x-[1px] active:translate-y-[1px] rounded-md cursor-pointer text-xs uppercase tracking-wider font-extrabold",
                      smsSaudaTab === 'manual'
                        ? "bg-indigo-100 border-indigo-600 text-indigo-900 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.15)]"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <PlusCircle className="h-4 w-4 text-indigo-600" />
                    <span>Manual Entry Form</span>
                  </button>
                  
                  {/* SMS Fetch / Sync Button always available at top */}
                  <button 
                    onClick={fetchGoogleSheetSms}
                    disabled={isGoogleSheetLoading}
                    className="bg-[#024a68] hover:bg-[#035b80] text-white font-mono font-black text-[10px] h-9 px-4 rounded-md shadow-sm cursor-pointer flex items-center gap-1.5 shrink-0 transition-colors"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isGoogleSheetLoading && "animate-spin")} />
                    <span>{isGoogleSheetLoading ? "Syncing..." : "Sync Sheet Data"}</span>
                  </button>
                </div>
                
                {/* Stats summary as beautiful modern badges */}
                <div className="flex items-center gap-2 font-mono text-[11px] font-bold">
                  <span className="bg-rose-50 text-rose-800 border border-rose-250 px-3 py-1 rounded-md shadow-xs">
                    Total Active: {smsSaudas.filter(s => s.status === 'Active' || s.status === 'Pending').length}
                  </span>
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-250 px-3 py-1 rounded-md shadow-xs">
                    Cumulative: ₹{smsSaudas.reduce((sum, s) => sum + (s.bales * 1.5 * s.rate), 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {smsSaudaTab === 'sms' ? (
                <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 overflow-hidden">
                  {/* Google Sheets Sync Header Row */}
                  <div className="p-4 bg-white border-b border-slate-200 flex flex-wrap gap-3 items-center justify-between  shadow-xs">
                    <div className="font-mono text-xs">
                      <span className="font-black text-slate-800 tracking-wider">GOOGLE SHEETS DATA LEDGER</span>
                      <span className="text-slate-300 mx-2">|</span>
                      <span className="text-slate-500 font-bold text-[10px]">Sheet ID: 1WignMNJ2p2...KYgG9k (sauda)</span>
                    </div>
                  </div>

                  {googleSheetError && (
                    <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 font-sans text-xs  shadow-sm animate-in fade-in duration-150">
                      <div className="flex items-center gap-1.5 font-black mb-1">
                        <AlertCircle className="h-4 w-4 text-red-650" />
                        <span className="uppercase tracking-wider text-[10px]">Sheets API Synchronization Fault</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-red-700 font-semibold">{googleSheetError}</p>
                    </div>
                  )}

                  {/* SMS Inbox Search Bar & Sort Control */}
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input  id="quick_filter_sms_logs_by__2275" name="quick_filter_sms_logs_by_" aria-label="Quick filter SMS logs by sender name or body..."
                        type="text"
                        placeholder="Quick filter SMS logs by sender name or body..."
                        value={smsSearchTerm}
                        onChange={(e) => setSmsSearchTerm(e.target.value)}
                        className="w-full bg-white pl-9 pr-3 py-2 text-xs border border-slate-250 rounded-lg shadow-sm font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-white border border-slate-250 px-2.5 py-1 rounded-lg shadow-xs">
                      <span className="text-[10px] font-black uppercase text-slate-500">Sort:</span>
                      <span className="text-[10px] font-black text-slate-800">Date</span>
                      <button
                        onClick={() => setSmsSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                        className="ml-1 px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all"
                        title="Toggle Ascending / Descending"
                      >
                        {smsSortOrder === 'desc' ? '↓ Newest' : '↑ Oldest'}
                      </button>
                    </div>
                  </div>

                  {/* Row-wise Spreadsheet/Excel style layout for raw SMS logs */}
                  <div className="flex-1 overflow-auto bg-white border-t border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#c2cfd6]/70 border-b-2 border-slate-400 text-slate-800 font-mono h-10 sticky top-0 z-10 font-bold uppercase ">
                        <tr>
                          <th className="px-3 border-r border-slate-300 text-[10px] tracking-wide text-center w-14">Row &or;</th>
                          <th 
                            onClick={() => setSmsSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                            className="px-3 border-r border-slate-300 text-[10px] tracking-wide w-28 cursor-pointer hover:bg-slate-300/80 select-none transition-colors"
                            title="Click to sort by Date"
                          >
                            Date {smsSortOrder === 'desc' ? '↓' : '↑'}
                          </th>
                          <th className="px-4 border-r border-slate-300 text-[10px] tracking-wide w-48">Sender (Broker/Vyapari) &or;</th>
                          <th className="px-4 border-r border-slate-300 text-[10px] tracking-wide">Raw SMS Text (Google Sheet Body payload)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono text-[11px] text-slate-800">
                        {isGoogleSheetLoading ? (
                          <tr>
                            <td colSpan={4} className="text-center py-24 text-slate-400 font-mono">
                              <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin mx-auto mb-2" />
                              <p className="text-xs font-black uppercase tracking-wider text-slate-700">Retrieving contract feed...</p>
                            </td>
                          </tr>
                        ) : (
                          (() => {
                            const filtered = googleSheetSmsData.filter(sms => {
                              const query = smsSearchTerm.toLowerCase();
                              return (
                                sms.contact_name.toLowerCase().includes(query) ||
                                sms.service_center.toLowerCase().includes(query) ||
                                sms.body.toLowerCase().includes(query)
                              );
                            }).sort((a, b) => {
                              const timeA = new Date(a.date || 0).getTime();
                              const timeB = new Date(b.date || 0).getTime();
                              return smsSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
                            });

                            if (filtered.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={4} className="text-center py-16 text-slate-400 font-mono font-bold uppercase">
                                    No matching logs found in Google Sheets SMS feed.
                                  </td>
                                </tr>
                              );
                            }

                            return filtered.map((sms, index) => {
                              // Alternate row backgrounds
                              const rowBgClass = index % 2 === 1 ? "bg-slate-50 hover:bg-slate-100" : "bg-white hover:bg-slate-50";

                              return (
                                <tr key={sms.id} className={cn("transition-colors h-10", rowBgClass)}>
                                  {/* Row ID */}
                                  <td className="px-3 py-2 border-r border-slate-200 text-center font-bold text-slate-400 ">
                                    {sms.id.replace('SHEET-SMS-', '')}
                                  </td>
                                  {/* Date */}
                                  <td className="px-3 py-2 border-r border-slate-200 text-slate-500 font-medium">{sms.date}</td>
                                  {/* Sender / Broker */}
                                  <td className="px-4 py-2 border-r border-slate-200 font-black text-slate-900 uppercase tracking-tight">
                                    <span className="flex items-center gap-1.5">
                                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse shrink-0" />
                                      {sms.contact_name.toUpperCase()}
                                    </span>
                                  </td>
                                  {/* Raw SMS Text payload */}
                                  <td className="px-4 py-2 border-r border-slate-200 font-mono text-[11px] text-slate-700 leading-normal select-text max-w-lg truncate hover:text-slate-950" title={sms.body}>
                                    {sms.body}
                                  </td>
                                </tr>
                              );
                            });
                          })()
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50 overflow-hidden">
                  
                  {/* Manual Form Log Section */}
                  <div className="p-5 bg-white border-b border-slate-200 shrink-0  shadow-sm font-sans">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                      <h4 className="text-xs font-black uppercase text-indigo-900 tracking-wider flex items-center gap-2">
                        <PlusCircle className="h-4 w-4 text-indigo-600" />
                        <span>{editingSmsSaudaId ? `Modify Contract #${editingSmsSaudaId}` : "Log New Sauda Contract Booking"}</span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setManualTrader('');
                          setManualSupplier('');
                          setManualUnitType('BALES');
                          setManualStatus('Active');
                          setManualGrade('TD5');
                          setManualBales('');
                          setManualRate('');
                          setEditingSmsSaudaId(null);
                        }}
                        className="text-slate-500 hover:text-indigo-600 font-bold uppercase text-[10px] hover:underline cursor-pointer transition-colors"
                      >
                        Reset Form Fields
                      </button>
                    </div>

                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!manualTrader || Number(manualBales) <= 0 || Number(manualRate) <= 0) {
                          alert("Please fill in Vyapari name, quantity, and rate.");
                          return;
                        }

                        if (editingSmsSaudaId) {
                          setSmsSaudas(smsSaudas.map(s => s.id === editingSmsSaudaId ? {
                            ...s,
                            trader: manualTrader,
                            supplier: manualSupplier || manualTrader,
                            unitType: manualUnitType,
                            status: manualStatus,
                            grade: manualGrade,
                            bales: Number(manualBales),
                            rate: Number(manualRate)
                          } : s));
                          setEditingSmsSaudaId(null);
                        } else {
                          const newSauda = {
                            id: `SMS-${Math.floor(100 + Math.random() * 900)}`,
                            trader: manualTrader,
                            supplier: manualSupplier || manualTrader,
                            unitType: manualUnitType,
                            status: manualStatus,
                            grade: manualGrade,
                            bales: Number(manualBales),
                            rate: Number(manualRate),
                            date: new Date().toISOString().split('T')[0]
                          };
                          setSmsSaudas([newSauda, ...smsSaudas]);
                        }

                        setManualTrader('');
                        setManualSupplier('');
                        setManualUnitType('BALES');
                        setManualStatus('Active');
                        setManualGrade('TD5');
                        setManualBales('');
                        setManualRate('');
                      }}
                      className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
                    >
                      <div>
                        <label htmlFor="trader_vyapari_2488" className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 tracking-wider">Trader / Vyapari</label>
                        <input  id="trader_vyapari_2488" name="trader_vyapari" aria-label="Trader / Vyapari"
                          type="text"
                          placeholder="e.g. Shiva Fibres"
                          value={manualTrader}
                          onChange={(e) => {
                            setManualTrader(e.target.value);
                            if (!manualSupplier) setManualSupplier(e.target.value);
                          }}
                          className="w-full bg-white px-3 py-2 text-xs border border-slate-250 rounded-lg shadow-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          required
                        />
                      </div>

                      <div>
                        <label htmlFor="supplier_name_2503" className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 tracking-wider">Supplier Name</label>
                        <input  id="supplier_name_2503" name="supplier_name" aria-label="Supplier Name"
                          type="text"
                          placeholder="e.g. SELF"
                          value={manualSupplier}
                          onChange={(e) => setManualSupplier(e.target.value)}
                          className="w-full bg-white px-3 py-2 text-xs border border-slate-250 rounded-lg shadow-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="grade_2515" className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 tracking-wider">Grade</label>
                          <select  id="grade_2515" name="grade" aria-label="Grade"
                            value={manualGrade}
                            onChange={(e) => setManualGrade(e.target.value)}
                            className="w-full bg-white px-2.5 py-2 text-[11px] border border-slate-250 rounded-lg shadow-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                          >
                            <option value="TD4">TD4 (Assam)</option>
                            <option value="TD5">TD5 (Std)</option>
                            <option value="TD6">TD6 (Low)</option>
                            <option value="W4">W4 (Prem)</option>
                            <option value="W5">W5 (White)</option>
                          </select>
                        </div>

                        <div>
                          <label htmlFor="unit_lorry_2530" className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 tracking-wider">Unit/Lorry</label>
                          <select  id="unit_lorry_2530" name="unit_lorry" aria-label="Unit/Lorry"
                            value={manualUnitType}
                            onChange={(e) => setManualUnitType(e.target.value)}
                            className="w-full bg-white px-2.5 py-2 text-[11px] border border-slate-250 rounded-lg shadow-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
                          >
                            <option value="BALES">BALES</option>
                            <option value="LORRY">LORRY</option>
                            <option value="LOOSE">LOOSE</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label htmlFor="qty_bales_2545" className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 tracking-wider">Qty (Bales)</label>
                          <input  id="qty_bales_2545" name="qty_bales" aria-label="Qty (Bales)"
                            type="number"
                            placeholder="150"
                            value={manualBales}
                            onChange={(e) => setManualBales(e.target.value)}
                            className="w-full bg-white px-3 py-2 text-xs border border-slate-250 rounded-lg shadow-sm font-bold text-right text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            required
                          />
                        </div>

                        <div>
                          <label htmlFor="rate_qtl_2557" className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 tracking-wider">Rate (₹/Qtl)</label>
                          <input  id="rate_qtl_2557" name="rate_qtl" aria-label="Rate (₹/Qtl)"
                            type="number"
                            placeholder="3450"
                            value={manualRate}
                            onChange={(e) => setManualRate(e.target.value)}
                            className="w-full bg-white px-3 py-2 text-xs border border-slate-250 rounded-lg shadow-sm font-bold text-right text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            required
                          />
                        </div>

                        <button 
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-black text-[10px] uppercase h-10 rounded-lg shadow-sm border border-indigo-600 cursor-pointer flex items-center justify-center gap-1 transition-all active:scale-95"
                        >
                          <Check className="h-4 w-4" />
                          <span>{editingSmsSaudaId ? "Update" : "Save Contract"}</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Sauda Ledger Search and Actions */}
                  <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-3 items-center justify-between  shadow-xs">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input  id="search_booked_contracts_2582" name="search_booked_contracts" aria-label="Search booked contracts..."
                        type="text"
                        placeholder="Search booked contracts..."
                        value={saudaSearchTerm}
                        onChange={(e) => setSaudaSearchTerm(e.target.value)}
                        className="w-full bg-white pl-9 pr-3 py-1.5 text-xs border border-slate-250 rounded-lg shadow-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const printWindow = window.open('', '_blank');
                          if (printWindow) {
                            printWindow.document.write(`
                              <html>
                                <head>
                                  <title>Sauda Booking Ledger Book</title>
                                  <style>
                                    body { font-family: monospace; padding: 25px; line-height: 1.4; color: #111; }
                                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                                    th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 11px; }
                                    th { background-color: #f2f2f2; font-weight: bold; }
                                    .text-right { text-align: right; }
                                    .text-center { text-align: center; }
                                    h2 { margin: 0; text-transform: uppercase; font-size: 16px; }
                                  </style>
                                </head>
                                <body>
                                  <h2>Bally Jute Company Limited</h2>
                                  <h3 style="margin-top:2px;font-weight:normal;font-size:12px;">Sauda Booking Register Ledger</h3>
                                  <p style="font-size:10px;color:#555;">Printed: ${new Date().toLocaleString()}</p>
                                  <table>
                                    <thead>
                                      <tr>
                                        <th>Date</th>
                                        <th>ID</th>
                                        <th>Vyapari / Broker</th>
                                        <th>Grade</th>
                                        <th>Unit</th>
                                        <th class="text-right">Qty Bales</th>
                                        <th class="text-right">Rate (₹)</th>
                                        <th class="text-right">Est. Value (₹)</th>
                                        <th class="text-center">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      ${smsSaudas.map((s: any) => `
                                        <tr>
                                          <td>${s.date}</td>
                                          <td>#${s.id}</td>
                                          <td><strong>${s.trader.toUpperCase()}</strong></td>
                                          <td>${s.grade}</td>
                                          <td>${s.unitType || 'BALES'}</td>
                                          <td class="text-right">${s.bales}</td>
                                          <td class="text-right">${s.rate}</td>
                                          <td class="text-right">₹${(s.bales * 1.5 * s.rate).toLocaleString()}</td>
                                          <td class="text-center">${s.status || 'Active'}</td>
                                        </tr>
                                      `).join('')}
                                    </tbody>
                                  </table>
                                </body>
                              </html>
                            `);
                            printWindow.document.close();
                            printWindow.print();
                          }
                        }}
                        className="bg-white hover:bg-slate-50 text-slate-700 font-mono font-bold text-[10px] h-8 px-3 rounded-lg border border-slate-250 shadow-xs cursor-pointer flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <Printer className="h-3.5 w-3.5 text-slate-500" />
                        <span>Print Register</span>
                      </button>

                      <button
                        onClick={() => {
                          const csvRows = smsSaudas.map(s => [
                            s.date,
                            s.id,
                            s.trader,
                            s.grade,
                            s.unitType,
                            s.bales,
                            s.rate,
                            s.bales * 1.5 * s.rate,
                            s.status
                          ].join(','));
                          const csvContent = "data:text/csv;charset=utf-8,Date,ID,Trader,Grade,Unit,QtyBales,Rate,Value,Status\n" + csvRows.join('\n');
                          const link = document.createElement("a");
                          link.href = encodeURI(csvContent);
                          link.download = "sauda_bookings.csv";
                          link.click();
                        }}
                        className="bg-white hover:bg-slate-50 text-slate-700 font-mono font-bold text-[10px] h-8 px-3 rounded-lg border border-slate-250 shadow-xs cursor-pointer flex items-center gap-1.5 transition-all active:scale-95"
                      >
                        <Download className="h-3.5 w-3.5 text-slate-500" />
                        <span>CSV Export</span>
                      </button>
                    </div>
                  </div>

                  {/* Registered Saudas Table list */}
                  <div className="flex-1 overflow-auto p-5 bg-slate-50/50">
                    <div className="border border-slate-200 rounded-xl overflow-x-auto overflow-y-auto bg-white shadow-sm w-full max-w-full">
                      <table className="w-full text-left text-xs border-collapse min-w-[1050px]">
                        <thead className="bg-slate-900 border-b border-slate-800 uppercase text-white font-mono h-10 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 border-r border-slate-800 text-[10px] tracking-wider">Date</th>
                            <th className="px-4 border-r border-slate-800 text-[10px] tracking-wider">ID</th>
                            <th className="px-4 border-r border-slate-800 text-[10px] tracking-wider">Vyapari / Broker Name</th>
                            <th className="px-4 border-r border-slate-800 text-[10px] tracking-wider text-center">Grade</th>
                            <th className="px-4 border-r border-slate-800 text-[10px] tracking-wider text-center">Unit</th>
                            <th className="px-4 border-r border-slate-800 text-[10px] tracking-wider text-right">Bales</th>
                            <th className="px-4 border-r border-slate-800 text-[10px] tracking-wider text-right">Rate / Qtl</th>
                            <th className="px-4 border-r border-slate-800 text-[10px] tracking-wider text-right">Est. Value</th>
                            <th className="px-4 border-r border-slate-800 text-[10px] tracking-wider text-center">Status</th>
                            <th className="px-4 text-[10px] tracking-wider text-center font-bold">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-850">
                          {(() => {
                            const query = saudaSearchTerm.toLowerCase();
                            const filtered = smsSaudas.filter(s => 
                              s.trader.toLowerCase().includes(query) ||
                              s.id.toLowerCase().includes(query) ||
                              s.grade.toLowerCase().includes(query)
                            );

                            if (filtered.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={10} className="text-center py-10 text-slate-400">
                                    No booked sauda entries found.
                                  </td>
                                </tr>
                              );
                            }

                            return filtered.map((s, idx) => (
                              <tr key={s.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"}>
                                <td className="px-4 py-2.5 border-r border-slate-100 text-slate-500 text-[10px]">{s.date}</td>
                                <td className="px-4 py-2.5 border-r border-slate-100 font-bold text-[#024a68]">#{s.id}</td>
                                <td className="px-4 py-2.5 border-r border-slate-100 font-black text-slate-900 uppercase">{s.trader}</td>
                                <td className="px-4 py-2.5 border-r border-slate-100 text-center text-amber-800 font-bold">{s.grade}</td>
                                <td className="px-4 py-2.5 border-r border-slate-100 text-center font-bold text-slate-500">{s.unitType || 'BALES'}</td>
                                <td className="px-4 py-2.5 border-r border-slate-100 text-right font-black">{s.bales}</td>
                                <td className="px-4 py-2.5 border-r border-slate-100 text-right font-black text-stone-850">₹{s.rate}</td>
                                <td className="px-4 py-2.5 border-r border-slate-100 text-right font-black text-emerald-800">₹{(s.bales * 1.5 * s.rate).toLocaleString()}</td>
                                <td className="px-4 py-2.5 border-r border-slate-100 text-center">
                                  <span className={cn(
                                    "text-[9px] font-black uppercase px-2.5 py-0.5 border rounded-md shadow-xs inline-block ",
                                    s.status === 'Closed' || s.status === 'Completed'
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                      : "bg-amber-50 text-amber-800 border-amber-200 animate-pulse"
                                  )}>
                                    {s.status === 'Closed' || s.status === 'Completed' ? 'COMPLETED' : 'PENDING'}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <div className="flex gap-2 justify-center">
                                    <button
                                      onClick={() => {
                                        setManualTrader(s.trader);
                                        setManualSupplier(s.supplier || s.trader);
                                        setManualUnitType(s.unitType || 'BALES');
                                        setManualStatus(s.status || 'Active');
                                        setManualGrade(s.grade);
                                        setManualBales(String(s.bales));
                                        setManualRate(String(s.rate));
                                        setEditingSmsSaudaId(s.id);
                                      }}
                                      title="Edit Contract details"
                                      className="text-[#024a68] hover:text-indigo-950 p-1 rounded-lg border border-slate-100 hover:border-slate-300 bg-slate-50 transition-all cursor-pointer"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </button>

                                    <button
                                      onClick={() => {
                                        const nextStatus = s.status === 'Closed' ? 'Active' : 'Closed';
                                        setSmsSaudas(smsSaudas.map(item => item.id === s.id ? { ...item, status: nextStatus } : item));
                                      }}
                                      title="Mark Completed / Toggle"
                                      className="text-emerald-650 hover:text-emerald-950 p-1 rounded-lg border border-slate-100 hover:border-slate-300 bg-slate-50 transition-all cursor-pointer"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                    </button>

                                    <button
                                      onClick={() => {
                                        if (confirm("Revoke this booked contract?")) {
                                          setSmsSaudas(smsSaudas.filter(item => item.id !== s.id));
                                        }
                                      }}
                                      title="Delete/Revoke contract"
                                      className="text-red-650 hover:text-red-955 p-1 rounded-lg border border-slate-100 hover:border-red-300 bg-slate-50 transition-all cursor-pointer"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* Modern Popup Footer */}
              <div className="bg-slate-100 px-6 py-4 border-t border-slate-200 flex justify-end shrink-0  shadow-sm">
                <button 
                  onClick={() => setIsSmsSaudaModalOpen(false)}
                  className="bg-slate-850 hover:bg-slate-950 text-white font-mono font-black uppercase text-[10px] tracking-widest px-8 py-2.5 rounded-lg border border-slate-850 cursor-pointer transition-all duration-150 shadow-sm active:scale-95"
                >
                  Close Register
                </button>
              </div>

            </div>
          </div>
        )}

        {isProfileOpen && (
          <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-legacy-bg border-2 border-white shadow-2xl w-full max-w-md flex flex-col">
              <div className="bg-gradient-to-r from-indigo-950 to-indigo-900 border-b border-indigo-400 p-2 flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-indigo-300" />
                  <span className="text-xs font-black uppercase tracking-widest">User Profile Console</span>
                </div>
                <button
                  onClick={() => setIsProfileOpen(false)}
                  className="bg-rose-600 hover:bg-rose-500 text-white w-5 h-5 flex items-center justify-center border border-white/20 shadow-sm"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <LegacyFieldset legend="System Account Info">
                  <div className="space-y-2 text-xs font-mono font-bold text-slate-700">
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                      <span>USER ID:</span>
                      <span className="text-indigo-900">{userProfileData?.user_id || '---'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                      <span>USERNAME:</span>
                      <span className="text-indigo-900 uppercase">{userProfileData?.username || getCurrentUserContext().username}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                      <span>ROLE:</span>
                      <span className="text-indigo-900">{userProfileData?.role || '---'}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-200 pb-1">
                      <span>LEVEL:</span>
                      <span className="text-indigo-900">{userProfileData?.level || '---'}</span>
                    </div>
                    <div className="flex justify-between pb-1">
                      <span>LAST LOGIN:</span>
                      <span className="text-indigo-900">{userProfileData?.last_login ? new Date(userProfileData.last_login).toLocaleString() : 'N/A'}</span>
                    </div>
                  </div>
                </LegacyFieldset>
                <LegacyFieldset legend="Security & Password">
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="new_password_2853" className="text-[10px] font-black uppercase text-indigo-900 mb-1 block">New Password</label>
                      <input
 id="new_password_2853" name="new_password" aria-label="New Password"                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full h-8 px-2 border border-slate-300 font-mono text-sm bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="Enter new password"
                      />
                    </div>
                    {updatePasswordSuccess && (
                      <p className="text-[10px] text-emerald-600 font-bold">{updatePasswordSuccess}</p>
                    )}
                    <button
                      onClick={handleUpdatePassword}
                      className="bg-indigo-900 hover:bg-indigo-950 text-white font-extrabold uppercase tracking-wider text-[10px] px-4 h-8 w-full border border-white shadow-[1px_1px_0_0_black] cursor-pointer"
                    >
                      Update Password
                    </button>
                  </div>
                </LegacyFieldset>
              </div>
            </div>
          </div>
        )}
       </div>
     </LegacyLayout>
  );
}

function StatCard({ label, value, icon: Icon, trend, color = 'text-indigo-950', onClick }: any) {
  const isInteractive = !!onClick;
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white border border-slate-200 p-4 shadow-sm relative group rounded-2xl overflow-hidden flex flex-col justify-between min-h-[100px]",
        isInteractive ? "cursor-pointer hover:border-indigo-400 hover:shadow-md hover:bg-indigo-50/20 transition-all active:scale-[0.98]" : ""
      )}
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
        <Icon className="h-16 w-16" />
      </div>
      <div className="flex justify-between items-start mb-3 z-10">
         <div className="p-2 bg-indigo-50/80 border border-indigo-100/50 rounded-xl shadow-inner">
            <Icon className="h-5 w-5 text-indigo-600" />
         </div>
         {trend && (
            <span className={cn(
              "text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm border",
              trend.includes('+') ? "text-emerald-700 bg-emerald-50/80 border-emerald-200" :
              trend.includes('-') ? "text-rose-700 bg-rose-50/80 border-rose-200" : "text-indigo-700 bg-indigo-50/80 border-indigo-200"
            )}>
               {trend.includes('+') ? <ArrowUpRight className="h-3 w-3" /> : 
                trend.includes('-') ? <ArrowDownRight className="h-3 w-3" /> : <Scale className="h-3 w-3" />}
               {trend}
            </span>
         )}
      </div>
      <div className="space-y-1 z-10 mt-auto">
        <h3 className="text-[11px] uppercase font-extrabold text-slate-500 tracking-widest">
          {label}
        </h3>
        <div className={cn("text-2xl font-black tabular-nums tracking-tight", color)}>
          {value}
        </div>
      </div>
      {isInteractive && (
         <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowRight className="h-4 w-4 text-indigo-600" />
         </div>
      )}
    </div>
  );
}
