import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ComposedChart
} from 'recharts';
import { 
  FileText, 
  TrendingUp, 
  Scale, 
  Layers, 
  Search, 
  Filter, 
  Plus, 
  RefreshCw,
  Calculator,
  UserCheck,
  Calendar,
  Clock,
  TrendingDown,
  ClipboardList,
  Database,
  Download,
  MapPin,
  CheckCircle,
  FileSpreadsheet,
  Printer
} from 'lucide-react';
import { dbModule } from '../services/dbModule';
import { cn } from '../lib/utils';

interface PurchaseMaster {
  po_id: string;
  financial_year: string;
  po_no: string;
  po_date: string;
  po_type?: string;
  supplier?: string;
  broker?: string;
  total_contract_mt?: number | string;
  pending?: boolean;
  b_rate?: number | string;
  pending_received?: number;
  area?: string;
  arrival_area_name?: string;
  purchase_order?: string;
  ptf_no?: string;
  challan_supplier?: string;
  trans_paid_by?: string;
  weight_unit_kgs?: number | string;
  against_cancellation?: boolean;
  purchase_unit_code?: string;
  purchase_unit_name?: string;
  total_lorries?: number | string;
  units_per_lorry?: number | string;
  total_units?: number | string;
  weight_per_lorry?: number | string;
  marka_type?: string;
  marka_penalty?: number | string;
  qty_penalty?: number | string;
  delivery_from?: string;
  delivery_to?: string;
  grace_days?: number | string;
  delivery_penalty?: number | string;
  contract_po_no?: string;
  contract_date?: string;
  rate_detail?: string;
  delivery_schedule?: string;
  terms_condition?: string;
  remarks?: string;
  po_identification?: string;
  s_date?: string;
}

interface GroupedSupplier {
  supplier: string;
  total_contract_mt: number;
  orderCount: number;
}

const MONTH_LABELS = [
  { value: 'ALL', label: '-- ALL MONTHS --' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
];

const PO_REPORTS = [
  { key: 'r1', name: '1. Monthly Procurement Summary', description: 'Month-on-month overview of contract volumes, averages, and net estimate procurement capital.' },
  { key: 'r2', name: '2. Supplier Procurement Ledger', description: 'Procurement ranking and detailed lot sizing ledger summarized by prime selling suppliers.' },
  { key: 'r3', name: '3. Broker Allocations & Market Share', description: 'Volume allocation across authorized agents and independent supply-chain brokers.' },
  { key: 'r4', name: '4. Sourcing Area-wise Audit', description: 'Geographic audit across vital Bihar, Northern, the East Jute variety farm growing regions.' },
  { key: 'r5', name: '5. Quality Grade Distribution Analysis', description: 'Statistical distribution of fine, medium Jute qualities sourced into mill warehouses.' },
  { key: 'r6', name: '6. Delivery Timeline & Compliance Ledger', description: 'Contract operational windows, allowed grace days, and daily late shipment penalty audits.' },
  { key: 'r7', name: '7. Logistics Freight & Lorry Payload Registry', description: 'Vehicle count registry, average units/lorries, and aggregate freight payloads.' },
  { key: 'r8', name: '8. Agency-wide Sourcing Audit', description: 'Sourcing performances and actual transaction lines registered at each localized Agency station.' },
  { key: 'r9', name: '9. Pending Execution Status Log', description: 'Active open order commitments vs warehouse-dispatched fully compiled purchase contracts.' },
  { key: 'r10', name: '10. Base Rate (B-Rate) price Variance GAP', description: 'Granular comparison between theoretical base reference rates and final settled invoice rates.' }
];

export default function PurchaseOrderSummary({ refreshTrigger }: { refreshTrigger?: number }) {
  const [loading, setLoading] = useState(false);
  const [originalData, setOriginalData] = useState<PurchaseMaster[]>([]);
  const [poDetails, setPoDetails] = useState<any[]>([]);
  const [agencyList, setAgencyList] = useState<any[]>([]);
  const [gradeList, setGradeList] = useState<any[]>([]);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  // Layout View Mode
  const [viewMode, setViewMode] = useState<'dashboard' | 'advanced_reports'>('dashboard');

  // Standard Dashboard Filter States
  const [financialYearFilter, setFinancialYearFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  // Advanced Report Engine Filter States
  const [activePoReportKey, setActivePoReportKey] = useState<string>('r1');
  const [poReportMonth, setPoReportMonth] = useState<string>('ALL');
  const [poReportYear, setPoReportYear] = useState<string>('ALL');
  const [poReportSearch, setPoReportSearch] = useState<string>('');

  // New refined filters (Date range, merchant/supplier specific)
  const [poReportStartDate, setPoReportStartDate] = useState<string>('');
  const [poReportEndDate, setPoReportEndDate] = useState<string>('');
  const [poReportSupplier, setPoReportSupplier] = useState<string>('ALL');

  // Print selected / Multiple concated print reports
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [selectedMonthsForPrint, setSelectedMonthsForPrint] = useState<string[]>([]);

  // Selected trend metric for report type r1 (Monthly Procurement Summary)
  const [r1ChartMetric, setR1ChartMetric] = useState<'combo' | 'weight' | 'capital' | 'count'>('combo');

  // Extract unique supplier names from master data for filtering
  const reportSuppliersList = React.useMemo(() => {
    const sups = new Set<string>();
    originalData.forEach(po => {
      if (po.supplier) {
        sups.add(po.supplier.trim());
      }
    });
    return Array.from(sups).sort();
  }, [originalData]);

  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      const [data, details, agencies, grades] = await Promise.all([
        dbModule.fetchAll('purchase_master').catch(() => []),
        dbModule.fetchAll('purchase_detail_master').catch(() => []),
        dbModule.fetchAll('agency_master').catch(() => []),
        dbModule.fetchAll('grade_master').catch(() => [])
      ]);
      
      setOriginalData((data || []) as PurchaseMaster[]);
      setPoDetails(details || []);
      setAgencyList(agencies || []);
      setGradeList(grades || []);
    } catch (err) {
      console.error("Error fetching purchase order metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseOrders();
  }, [refreshTrigger]);

  // Standard Filters
  const filteredData = originalData.filter(po => {
    if (financialYearFilter !== 'ALL' && po.financial_year !== financialYearFilter) {
      return false;
    }
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const matchSupplier = po.supplier?.toLowerCase().includes(query) || false;
      const matchBroker = po.broker?.toLowerCase().includes(query) || false;
      const matchPoNo = po.po_no?.toLowerCase().includes(query) || false;
      if (!matchSupplier && !matchBroker && !matchPoNo) return false;
    }
    return true;
  });

  // Calculate Grouped data for the Bar Chart
  const groupedChartData: GroupedSupplier[] = React.useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    
    filteredData.forEach(po => {
      const name = po.supplier ? po.supplier.trim() : 'DIRECT';
      const weight = Number(po.total_contract_mt) || 0;
      if (!map[name]) {
        map[name] = { total: 0, count: 0 };
      }
      map[name].total += weight;
      map[name].count += 1;
    });

    return Object.entries(map).map(([supplier, info]) => ({
      supplier,
      total_contract_mt: parseFloat(info.total.toFixed(3)),
      orderCount: info.count
    })).sort((a, b) => b.total_contract_mt - a.total_contract_mt);
  }, [filteredData]);

  // General Dashboard KPI stats
  const stats = React.useMemo(() => {
    let totalWeight = 0;
    let pendingCount = 0;
    let maxWeight = 0;
    let maxSupplier = 'N/A';
    
    filteredData.forEach(po => {
      const w = Number(po.total_contract_mt) || 0;
      totalWeight += w;
      if (po.pending !== false) {
        pendingCount += 1;
      }
      if (w > maxWeight) {
        maxWeight = w;
        maxSupplier = po.supplier || 'DIRECT';
      }
    });

    return {
      totalWeight: parseFloat(totalWeight.toFixed(3)),
      totalCount: filteredData.length,
      pendingCount,
      averageWeight: filteredData.length > 0 ? parseFloat((totalWeight / filteredData.length).toFixed(3)) : 0,
      maxWeight,
      maxSupplier
    };
  }, [filteredData]);

  // List of all years found in DB for filters
  const financialYears = React.useMemo(() => {
    const years = new Set<string>();
    originalData.forEach(po => {
      if (po.financial_year) years.add(po.financial_year);
      if (po.po_date) {
        const calYr = new Date(po.po_date).getFullYear().toString();
        years.add(calYr);
      }
    });
    return Array.from(years).sort();
  }, [originalData]);

  const handleBarClick = (barData: GroupedSupplier) => {
    if (selectedSupplier === barData.supplier) {
      setSelectedSupplier(null);
    } else {
      setSelectedSupplier(barData.supplier);
    }
  };

  const displayedDetails = React.useMemo(() => {
    if (!selectedSupplier) return filteredData;
    return filteredData.filter(po => (po.supplier ? po.supplier.trim() : 'DIRECT') === selectedSupplier);
  }, [filteredData, selectedSupplier]);

  const barColors = [
    '#1e3a8a', '#0f766e', '#312e81', '#0891b2', '#4f46e5', '#1d4ed8', '#0d9488', '#2563eb'
  ];

  // ==================== ADVANCED MONTH-WISE & YEAR-WISE REPORTS ENGINE ====================
  
  // Filter core PO master lists for Advanced Reports
  const poFilteredByPeriod = React.useMemo(() => {
    return originalData.filter(po => {
      if (!po.po_date) return false;
      const d = new Date(po.po_date);
      const m = d.getMonth() + 1;
      const yr = d.getFullYear();
      
      // Month Filter
      if (poReportMonth !== 'ALL' && m.toString() !== poReportMonth) {
        return false;
      }
      
      // Year / FY Filter
      if (poReportYear !== 'ALL') {
        if (po.financial_year !== poReportYear && yr.toString() !== poReportYear) {
          return false;
        }
      }

      // Date Range Filters
      if (poReportStartDate) {
        const poDateStr = po.po_date.substring(0, 10);
        if (poDateStr < poReportStartDate) return false;
      }
      if (poReportEndDate) {
        const poDateStr = po.po_date.substring(0, 10);
        if (poDateStr > poReportEndDate) return false;
      }
      
      // Merchant-specific Filter
      if (poReportSupplier !== 'ALL') {
        if ((po.supplier || 'DIRECT').trim().toUpperCase() !== poReportSupplier.toUpperCase()) {
          return false;
        }
      }
      
      // Keywords search filter
      if (poReportSearch.trim()) {
        const trm = poReportSearch.toLowerCase();
        const matches = 
          (po.po_no || '').toLowerCase().includes(trm) ||
          (po.supplier || '').toLowerCase().includes(trm) ||
          (po.broker || '').toLowerCase().includes(trm) ||
          (po.po_type || '').toLowerCase().includes(trm) ||
          (po.area || '').toLowerCase().includes(trm);
        if (!matches) return false;
      }
      
      return true;
    });
  }, [originalData, poReportMonth, poReportYear, poReportSearch, poReportStartDate, poReportEndDate, poReportSupplier]);

  // Joined PO Detail rows based on filtered parents
  const filteredPoDetails = React.useMemo(() => {
    const poNos = new Set(poFilteredByPeriod.map(p => p.po_no));
    return poDetails.filter(d => poNos.has(d.po_no));
  }, [poDetails, poFilteredByPeriod]);

  // Build specialized dataset logic for all 10 reports
  const reportOutput = React.useMemo(() => {
    const result: {
      headers: string[];
      rows: string[][];
      chartData: any[];
      chartType: 'area' | 'bar' | 'hbar' | 'pie' | 'half_circle' | 'line' | 'composed';
      totalMT: number;
      totalCount: number;
    } = {
      headers: [],
      rows: [],
      chartData: [],
      chartType: 'bar',
      totalMT: 0,
      totalCount: 0
    };

    if (activePoReportKey === 'r1') {
      // 1. Monthly Procurement Summary
      const monthMap: Record<string, { monthYear: string; count: number; weight: number; sumRate: number; rateCount: number }> = {};
      poFilteredByPeriod.forEach(po => {
        if (!po.po_date) return;
        const d = new Date(po.po_date);
        const mLabel = d.toLocaleString('default', { month: 'short' });
        const yr = d.getFullYear();
        const key = `${mLabel} ${yr}`;
        if (!monthMap[key]) {
          monthMap[key] = { monthYear: key, count: 0, weight: 0, sumRate: 0, rateCount: 0 };
        }
        monthMap[key].count++;
        monthMap[key].weight += Number(po.total_contract_mt) || 0;
        if (po.b_rate) {
          monthMap[key].sumRate += Number(po.b_rate);
          monthMap[key].rateCount++;
        }
      });

      // Sort chronologically (e.g. Jan 2026 -> April 2026 -> May 2026)
      const sortedMonths = Object.values(monthMap).sort((a, b) => {
        const monthsOrder = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const [m1, y1] = a.monthYear.toLowerCase().split(/\s+/);
        const [m2, y2] = b.monthYear.toLowerCase().split(/\s+/);
        const year1 = parseInt(y1) || 0;
        const year2 = parseInt(y2) || 0;
        const index1 = monthsOrder.indexOf(m1);
        const index2 = monthsOrder.indexOf(m2);
        
        if (year1 !== year2) return year1 - year2;
        return index1 - index2;
      });

      result.headers = ['MONTH / YEAR', 'PO COUNT', 'TOTAL WEIGHT (MT)', 'AVG REFERENCE PRICE (INR)', 'ESTIMATED CAPITAL (INR)'];
      
      result.chartData = sortedMonths.map(m => {
        const avg = m.rateCount > 0 ? Math.round(m.sumRate / m.rateCount) : 17100;
        const estValue = m.weight * avg;
        return {
          name: m.monthYear,
          weight: parseFloat(m.weight.toFixed(3)),
          value: parseFloat(m.weight.toFixed(3)),
          averageRate: avg,
          estimatedValue: parseFloat(estValue.toFixed(2)),
          count: m.count
        };
      });

      result.rows = sortedMonths.map(m => {
        const avg = m.rateCount > 0 ? Math.round(m.sumRate / m.rateCount) : 17100;
        const val = m.weight * avg;
        return [
          m.monthYear,
          m.count.toString(),
          m.weight.toFixed(3),
          `Rs. ${avg.toLocaleString('en-IN')}`,
          `Rs. ${Math.round(val).toLocaleString('en-IN')}`
        ];
      });
      result.chartType = 'area';
    } 
    else if (activePoReportKey === 'r2') {
      // 2. Supplier Procurement Ledger
      const supMap: Record<string, { supplier: string; count: number; weight: number; sumRate: number; rateCount: number; broker: string }> = {};
      poFilteredByPeriod.forEach(po => {
        const name = po.supplier ? po.supplier.trim().toUpperCase() : 'DIRECT';
        if (!supMap[name]) {
          supMap[name] = { supplier: name, count: 0, weight: 0, sumRate: 0, rateCount: 0, broker: po.broker || 'DIRECT' };
        }
        supMap[name].count++;
        supMap[name].weight += Number(po.total_contract_mt) || 0;
        if (po.b_rate) {
          supMap[name].sumRate += Number(po.b_rate);
          supMap[name].rateCount++;
        }
      });

      result.headers = ['SUPPLIER NAME', 'PO COUNT', 'TOTAL SOURCED WEIGHT (MT)', 'AVG PRICE RATE (INR)', 'EST VALUE PRICE (INR)', 'Broker Mapped'];
      result.chartData = Object.values(supMap).map(s => ({
        name: s.supplier,
        weight: parseFloat(s.weight.toFixed(3)),
        value: parseFloat(s.weight.toFixed(3))
      })).sort((a, b) => b.value - a.value).slice(0, 8);

      result.rows = Object.values(supMap).map(s => {
        const avg = s.rateCount > 0 ? Math.round(s.sumRate / s.rateCount) : 17100;
        const val = s.weight * avg;
        return [
          s.supplier,
          s.count.toString(),
          s.weight.toFixed(3),
          `Rs. ${avg.toLocaleString('en-IN')}`,
          `Rs. ${Math.round(val).toLocaleString('en-IN')}`,
          s.broker
        ];
      });
      result.chartType = 'bar';
    }
    else if (activePoReportKey === 'r3') {
      // 3. Broker Allocations & Market Share
      const brokerMap: Record<string, { broker: string; count: number; weight: number; sumRate: number; rateCount: number }> = {};
      poFilteredByPeriod.forEach(po => {
        const name = po.broker ? po.broker.trim().toUpperCase() : 'DIRECT';
        if (!brokerMap[name]) {
          brokerMap[name] = { broker: name, count: 0, weight: 0, sumRate: 0, rateCount: 0 };
        }
        brokerMap[name].count++;
        brokerMap[name].weight += Number(po.total_contract_mt) || 0;
        if (po.b_rate) {
          brokerMap[name].sumRate += Number(po.b_rate);
          brokerMap[name].rateCount++;
        }
      });

      const totalWeightSum = Object.values(brokerMap).reduce((acc, curr) => acc + curr.weight, 0);

      result.headers = ['BROKER / SOURCING AGENT', 'CONTRACT COUNT', 'TOTAL COMMITTED WEIGHT (MT)', 'AVG PRICE CONTRACT (INR)', 'VOLUME ALLOCATION SHARE (%)'];
      result.chartData = Object.values(brokerMap).map(b => ({
        name: b.broker,
        weight: parseFloat(b.weight.toFixed(3)),
        value: parseFloat(b.weight.toFixed(3)),
        percentage: totalWeightSum > 0 ? parseFloat(((b.weight / totalWeightSum) * 100).toFixed(1)) : 0
      })).sort((a,b) => b.value - a.value);

      result.rows = Object.values(brokerMap).map(b => {
        const avg = b.rateCount > 0 ? Math.round(b.sumRate / b.rateCount) : 17100;
        const share = totalWeightSum > 0 ? ((b.weight / totalWeightSum) * 100).toFixed(1) : '0';
        return [
          b.broker,
          b.count.toString(),
          b.weight.toFixed(3),
          `Rs. ${avg.toLocaleString('en-IN')}`,
          `${share}%`
        ];
      });
      result.chartType = 'half_circle';
    }
    else if (activePoReportKey === 'r4') {
      // 4. Sourcing Area-wise Audit
      const areaMap: Record<string, { area: string; count: number; weight: number; sumRate: number; rateCount: number; leadSupplier: string }> = {};
      poFilteredByPeriod.forEach(po => {
        const name = po.area ? po.area.trim().toUpperCase() : 'DIRECT ZONE';
        if (!areaMap[name]) {
          areaMap[name] = { area: name, count: 0, weight: 0, sumRate: 0, rateCount: 0, leadSupplier: po.supplier || 'DIRECT' };
        }
        areaMap[name].count++;
        areaMap[name].weight += Number(po.total_contract_mt) || 0;
        if (po.b_rate) {
          areaMap[name].sumRate += Number(po.b_rate);
          areaMap[name].rateCount++;
        }
      });

      result.headers = ['SOURCING AREA REGION', 'CONTRACTS SOURCED', 'TOTAL TONNES (MT)', 'AVG B-RATE/QUINTAL (INR)', 'DOMINANT SUPPLIER'];
      result.chartData = Object.values(areaMap).map(a => ({
        name: a.area,
        weight: parseFloat(a.weight.toFixed(3)),
        value: parseFloat(a.weight.toFixed(3))
      })).sort((a, b) => b.value - a.value);

      result.rows = Object.values(areaMap).map(a => {
        const avg = a.rateCount > 0 ? Math.round(a.sumRate / a.rateCount) : 17100;
        return [
          a.area,
          a.count.toString(),
          a.weight.toFixed(3),
          `Rs. ${avg.toLocaleString('en-IN')}`,
          a.leadSupplier
        ];
      });
      result.chartType = 'hbar';
    }
    else if (activePoReportKey === 'r5') {
      // 5. Quality Grade Distribution Analysis
      const gradeMap: Record<string, { code: string; name: string; quantity: number; weight: number; sumRate: number; count: number }> = {};
      filteredPoDetails.forEach(d => {
        const code = d.grade_code ? d.grade_code.toString().toUpperCase().trim() : 'RAW';
        const itemWeight = Number(d.weight_mt) || Number(d.weight) || 0;
        const itemQty = Number(d.quantity) || 0;
        if (!gradeMap[code]) {
          const gObj = gradeList.find(g => g.grade_code === code);
          gradeMap[code] = { code, name: gObj ? gObj.grade_name : 'STANDARD', quantity: 0, weight: 0, sumRate: 0, count: 0 };
        }
        gradeMap[code].quantity += itemQty;
        gradeMap[code].weight += itemWeight;
        if (d.rate_qntl) {
          gradeMap[code].sumRate += Number(d.rate_qntl);
          gradeMap[code].count++;
        }
      });

      const totalWeightSum = Object.values(gradeMap).reduce((acc, curr) => acc + curr.weight, 0);

      result.headers = ['GRADE KEY', 'FINE/RAW GRADE NAME', 'CHALLAN PIECES SOURCED', 'WEIGHT VOLUME (MT)', 'WEIGHED AVG RATE/QL (INR)', 'DISTRIBUTION %'];
      result.chartData = Object.values(gradeMap).map(g => ({
        name: g.code,
        weight: parseFloat(g.weight.toFixed(3)),
        value: parseFloat(g.weight.toFixed(3)),
        percentage: totalWeightSum > 0 ? parseFloat(((g.weight / totalWeightSum) * 100).toFixed(1)) : 0
      })).sort((a, b) => b.value - a.value);

      result.rows = Object.values(gradeMap).map(g => {
        const avg = g.count > 0 ? Math.round(g.sumRate / g.count) : 17100;
        const share = totalWeightSum > 0 ? ((g.weight / totalWeightSum) * 100).toFixed(1) : '0';
        return [
          g.code,
          g.name,
          g.quantity.toLocaleString(),
          g.weight.toFixed(3),
          `Rs. ${avg.toLocaleString('en-IN')}`,
          `${share}%`
        ];
      });
      result.chartType = 'pie';
    }
    else if (activePoReportKey === 'r6') {
      // 6. Delivery Timeline & Compliance Ledger
      result.headers = ['PO ID', 'SUPPLIER / PARTY SOURCED', 'DELIVERY COMMENCE', 'DELIVERY DEADLINE', 'OPERATIONAL WINDOW', 'GRACE DAYS', 'DELAY PENALTY (INR)', 'COMPLIANCE STATUS'];
      result.rows = poFilteredByPeriod.map((po: any) => {
        const delFrom = po.delivery_from ? new Date(po.delivery_from) : null;
        const delTo = po.delivery_to ? new Date(po.delivery_to) : null;
        let dayRange = 0;
        if (delFrom && delTo) {
          dayRange = Math.round((delTo.getTime() - delFrom.getTime()) / (1000 * 3600 * 24)) || 0;
        }
        return [
          po.po_no,
          po.supplier || 'DIRECT',
          po.delivery_from ? new Date(po.delivery_from).toLocaleDateString('en-GB') : 'N/A',
          po.delivery_to ? new Date(po.delivery_to).toLocaleDateString('en-GB') : 'N/A',
          dayRange > 0 ? `${dayRange} Days` : 'Spot Delivery',
          `${po.grace_days || 0} Days`,
          `Rs. ${po.delivery_penalty || 5}/Day`,
          po.pending !== false ? 'Active Pending' : 'Fully Cleared'
        ];
      });

      result.chartData = poFilteredByPeriod.map((po: any) => {
        const delFrom = po.delivery_from ? new Date(po.delivery_from) : null;
        const delTo = po.delivery_to ? new Date(po.delivery_to) : null;
        let dayRange = 0;
        if (delFrom && delTo) {
          dayRange = Math.round((delTo.getTime() - delFrom.getTime()) / (1000 * 3600 * 24)) || 0;
        }
        return {
          name: po.po_no,
          value: dayRange,
          grace: po.grace_days || 0,
          weight: Number(po.total_contract_mt) || 0
        };
      }).slice(0, 10);
      result.chartType = 'bar';
    }
    else if (activePoReportKey === 'r7') {
      // 7. Logistics Freight & Lorry Payload Registry
      result.headers = ['PO ID', 'SUPPLIER NAME', 'TOTAL LORRIES BOOKED', 'UNITS / LORRY', 'PACKAGING SPEC', 'FREIGHT PAYLOAD WIT/LORRY', 'EST MASS TOTAL (MT)'];
      result.rows = poFilteredByPeriod.map((po: any) => {
        const estMass = (Number(po.total_lorries) || 0) * (Number(po.weight_per_lorry) || 0);
        return [
          po.po_no,
          po.supplier || 'DIRECT',
          (po.total_lorries || 0).toString(),
          (po.units_per_lorry || 0).toString(),
          po.purchase_unit_name || 'BALES',
          (po.weight_per_lorry || 0).toString() + ' MT',
          estMass.toFixed(3) + ' MT'
        ];
      });

      result.chartData = poFilteredByPeriod.map((po: any) => ({
        name: po.po_no,
        value: Number(po.total_lorries) || 0,
        lorries: Number(po.total_lorries) || 0,
        payload: Number(po.weight_per_lorry) || 0
      })).slice(0, 10);
      result.chartType = 'composed';
    }
    else if (activePoReportKey === 'r8') {
      // 8. Agency-wide Sourcing Audit
      const agMap: Record<string, { code: string; name: string; linesCount: number; sourcedMt: number; sourcedQty: number; sumRate: number; count: number }> = {};
      filteredPoDetails.forEach(d => {
        const code = d.agency_code ? d.agency_code.toString().trim() : 'MAIN';
        const itemQty = Number(d.quantity) || 0;
        const itemWt = Number(d.weight_mt) || d.weight || 0;
        if (!agMap[code]) {
          const matchedAg = agencyList.find(a => String(a.agency_code).toUpperCase() === code.toUpperCase());
          agMap[code] = { code, name: matchedAg ? matchedAg.agency_name : 'MAIN AGENCY STATION', linesCount: 0, sourcedMt: 0, sourcedQty: 0, sumRate: 0, count: 0 };
        }
        agMap[code].linesCount++;
        agMap[code].sourcedQty += itemQty;
        agMap[code].sourcedMt += itemWt;
        if (d.rate_qntl) {
          agMap[code].sumRate += Number(d.rate_qntl);
          agMap[code].count++;
        }
      });

      result.headers = ['AGENCY CODE', 'AGENCY SOURCING STATION', 'ACTIVE TRANSACTION LINES', 'SOURCED PCS/BALES', 'SOURCED TONNES (MT)', 'STIPULATED CONTRACT RATE'];
      result.chartData = Object.values(agMap).map(a => ({
        name: a.name,
        weight: parseFloat(a.sourcedMt.toFixed(3)),
        value: parseFloat(a.sourcedMt.toFixed(3))
      })).sort((a, b) => b.value - a.value);

      result.rows = Object.values(agMap).map(a => {
        const avg = a.count > 0 ? Math.round(a.sumRate / a.count) : 17100;
        return [
          a.code,
          a.name,
          a.linesCount.toString(),
          a.sourcedQty.toLocaleString(),
          a.sourcedMt.toFixed(3),
          `Rs. ${avg.toLocaleString('en-IN')}`
        ];
      });
      result.chartType = 'bar';
    }
    else if (activePoReportKey === 'r9') {
      // 9. Pending Execution Status Log
      let pendingWt = 0;
      let completedWt = 0;
      let pendingCount = 0;
      let completedCount = 0;
      poFilteredByPeriod.forEach(po => {
        const isPending = po.pending !== false;
        const wt = Number(po.total_contract_mt) || 0;
        if (isPending) {
          pendingWt += wt;
          pendingCount++;
        } else {
          completedWt += wt;
          completedCount++;
        }
      });

      result.headers = ['PO COVENANT RUNNING STATUS', 'PO DEALS COUNT', 'COMMITTED WEIGHT (MT)', 'EST VALUE PRICE BASE (INR)'];
      result.chartData = [
        { name: 'Pending Contracts', value: pendingCount, weight: parseFloat(pendingWt.toFixed(3)) },
        { name: 'Completed Full', value: completedCount, weight: parseFloat(completedWt.toFixed(3)) }
      ];

      result.rows = [
        ['Pending Purchase Orders', pendingCount.toString(), pendingWt.toFixed(3) + ' MT', `Rs. ${Math.round(pendingWt * 17100).toLocaleString('en-IN')}`],
        ['Completed & Dispatched Orders', completedCount.toString(), completedWt.toFixed(3) + ' MT', `Rs. ${Math.round(completedWt * 17100).toLocaleString('en-IN')}`]
      ];
      result.chartType = 'half_circle';
    }
    else if (activePoReportKey === 'r10') {
      // 10. Base Rate (B-Rate) price Variance GAP
      result.headers = ['PO REGISTRY ID', 'SUPPLIER NAME', 'B-RATE (BASE STANDARD)', 'ACTUAL RATE INVOICE', 'GAP DIFFERENCE (INR)', 'GAP RATIO %', 'VARIANCE AUDIT RUN'];
      
      const rateCompareList: any[] = [];
      poFilteredByPeriod.forEach(po => {
        const bRateVal = Number(po.b_rate) || 17100;
        const linkedDetails = filteredPoDetails.filter(d => d.po_no === po.po_no);
        const actualRateVal = linkedDetails.length > 0 && linkedDetails[0].rate_qntl ? Number(linkedDetails[0].rate_qntl) : bRateVal;
        
        const gapVal = actualRateVal - bRateVal;
        const gapRatio = bRateVal > 0 ? (gapVal / bRateVal) * 100 : 0;
        
        rateCompareList.push({
          po_no: po.po_no,
          supplier: po.supplier || 'DIRECT',
          bRate: bRateVal,
          actRate: actualRateVal,
          gap: gapVal,
          ratio: gapRatio
        });
      });

      result.rows = rateCompareList.map(item => {
        let verdict = 'Neutral Variance';
        if (item.ratio > 5) verdict = 'Premium Surcharged 🔴';
        else if (item.ratio < -5) verdict = 'Sub-market Saving 🟢';
        return [
          item.po_no,
          item.supplier,
          `Rs. ${item.bRate.toLocaleString('en-IN')}`,
          `Rs. ${item.actRate.toLocaleString('en-IN')}`,
          `Rs. ${item.gap.toLocaleString('en-IN')}`,
          `${item.ratio.toFixed(1)}%`,
          verdict
        ];
      });

      result.chartData = rateCompareList.slice(0, 10).map(item => ({
        name: item.po_no,
        baseRate: item.bRate,
        actualRate: item.actRate
      }));
      result.chartType = 'line';
    }

    result.totalCount = poFilteredByPeriod.length;
    result.totalMT = parseFloat(poFilteredByPeriod.reduce((sum, po) => sum + (Number(po.total_contract_mt) || 0), 0).toFixed(3));

    return result;
  }, [poFilteredByPeriod, filteredPoDetails, activePoReportKey, gradeList, agencyList]);

  // Helper to trigger download of detailed purchase orders with all fields and columns
  const triggerContractsCSVDownload = (pos: PurchaseMaster[], filename: string) => {
    const csvHeaders = [
      'PO ID',
      'PO NO',
      'PO DATE',
      'FINANCIAL YEAR',
      'PO TYPE',
      'PURCHASE ORDER OR PTF',
      'PTF NO',
      'GENERAL STATUS',
      'SUPPLIER',
      'CHALLAN SUPPLIER',
      'BROKER',
      'SOURCING AREA',
      'ARRIVAL AREA NAME',
      'TRANSPORT PAID BY',
      'WEIGHT UNIT (KGS)',
      'AGAINST CANCELLATION',
      'PURCHASE UNIT CODE',
      'PURCHASE UNIT NAME',
      'TOTAL LORRIES',
      'UNITS PER LORRY',
      'TOTAL UNITS',
      'WEIGHT PER LORRY',
      'TOTAL CONTRACT WEIGHT (MT)',
      'BASE RATE (B-RATE)',
      'MARKA TYPE',
      'MARKA PENALTY',
      'QUANTITY PENALTY',
      'DELIVERY FROM',
      'DELIVERY TO',
      'GRACE DAYS',
      'DELIVERY PENALTY',
      'CONTRACT PO NO',
      'CONTRACT DATE',
      'RATE DETAIL',
      'DELIVERY SCHEDULE',
      'TERMS & CONDITION',
      'SPECIAL REMARKS',
      'PO IDENTIFICATION',
      'START DATE',
      
      // Detailed Item Fields (LEFT JOIN)
      'ITEM DETAIL SRL NO',
      'CROP YEAR',
      'GRADE CODE',
      'AGENCY CODE',
      'MARKA CODE',
      'ITEM QUANTITY',
      'ITEM WEIGHT (MT)',
      'ITEM RATE (INR/m.T)',
      'ITEM EST REQUIRED CAPITAL (INR)'
    ];
    
    let totalWeightMT = 0;
    let totalEstimatedCapital = 0;
    let totalQuantity = 0;
    
    const csvRows: string[][] = [];
    
    pos.forEach(po => {
      const parentWeight = Number(po.total_contract_mt) || 0;
      const bRateVal = Number(po.b_rate) || 0;
      const parentEstCapital = parentWeight * bRateVal;
      const statusStr = po.pending !== false ? 'Pending' : 'Completed';
      
      const poDateStr = po.po_date ? new Date(po.po_date).toLocaleDateString('en-GB') : '';
      const deliveryFromStr = po.delivery_from ? new Date(po.delivery_from).toLocaleDateString('en-GB') : '';
      const deliveryToStr = po.delivery_to ? new Date(po.delivery_to).toLocaleDateString('en-GB') : '';
      const contractDateStr = po.contract_date ? new Date(po.contract_date).toLocaleDateString('en-GB') : '';
      const startDateStr = po.s_date ? new Date(po.s_date).toLocaleDateString('en-GB') : '';
      
      const parentFields = [
        po.po_id || '',
        po.po_no || '',
        poDateStr,
        po.financial_year || '',
        po.po_type || 'Standard',
        po.purchase_order || '',
        po.ptf_no || '',
        statusStr,
        po.supplier || 'DIRECT',
        po.challan_supplier || '',
        po.broker || 'DIRECT',
        po.area || po.arrival_area_name || 'MAIN ZONE',
        po.arrival_area_name || '',
        po.trans_paid_by || '',
        String(po.weight_unit_kgs ?? ''),
        po.against_cancellation ? 'Yes' : 'No',
        po.purchase_unit_code || '',
        po.purchase_unit_name || '',
        String(po.total_lorries ?? '0'),
        String(po.units_per_lorry ?? '0'),
        String(po.total_units ?? '0'),
        String(po.weight_per_lorry ?? '0'),
        parentWeight.toFixed(3),
        bRateVal.toString(),
        po.marka_type || '',
        String(po.marka_penalty ?? '0'),
        String(po.qty_penalty ?? '0'),
        deliveryFromStr,
        deliveryToStr,
        String(po.grace_days ?? '0'),
        String(po.delivery_penalty ?? '0'),
        po.contract_po_no || '',
        contractDateStr,
        po.rate_detail || '',
        po.delivery_schedule || '',
        po.terms_condition || '',
        po.remarks || '',
        po.po_identification || '',
        startDateStr
      ];

      // Match item-level detailed rows
      const matchingDetails = poDetails.filter((d: any) => d.po_no === po.po_no);
      if (matchingDetails.length > 0) {
        matchingDetails.forEach((item: any) => {
          const qtyVal = Number(item.quantity) || 0;
          const weightMTVal = Number(item.weight_mt) || 0;
          const itemRateVal = Number(item.rate_qntl) || 0;
          const itemEstCapital = weightMTVal * itemRateVal;
          
          totalWeightMT += weightMTVal;
          totalEstimatedCapital += itemEstCapital;
          totalQuantity += qtyVal;

          csvRows.push([
            ...parentFields,
            String(item.srl_no || ''),
            item.crop_year || '',
            item.grade_code || '',
            item.agency_code || '',
            item.marka_code || '',
            String(qtyVal),
            weightMTVal.toFixed(3),
            String(itemRateVal * 10),
            Math.round(itemEstCapital).toString()
          ]);
        });
      } else {
        totalWeightMT += parentWeight;
        totalEstimatedCapital += parentEstCapital;

        csvRows.push([
          ...parentFields,
          '',
          '',
          '',
          '',
          '',
          '0',
          '0.000',
          '0',
          '0'
        ]);
      }
    });

    const totalRow = Array(csvHeaders.length).fill('');
    totalRow[csvHeaders.indexOf('PO ID')] = 'GRAND TOTAL';
    totalRow[csvHeaders.indexOf('GENERAL STATUS')] = `${pos.length} Parents`;
    totalRow[csvHeaders.indexOf('TOTAL CONTRACT WEIGHT (MT)')] = totalWeightMT.toFixed(3);
    totalRow[csvHeaders.indexOf('ITEM QUANTITY')] = totalQuantity.toString();
    totalRow[csvHeaders.indexOf('ITEM WEIGHT (MT)')] = totalWeightMT.toFixed(3);
    totalRow[csvHeaders.indexOf('ITEM EST REQUIRED CAPITAL (INR)')] = Math.round(totalEstimatedCapital).toLocaleString('en-IN');

    const headersStr = csvHeaders.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
    const listRowsStr = csvRows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','));
    const totalRowStr = totalRow.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',');

    const csvContent = [headersStr, ...listRowsStr, totalRowStr].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Click handler to download data of a specific month in April 2026, May 2026, etc.
  const downloadIndividualContractsCSV = (monthYearStr: string) => {
    const parts = monthYearStr.trim().split(/\s+/);
    if (parts.length < 2) return;
    const monthAbbrev = parts[0].toLowerCase();
    const yearStr = parts[1];
    
    const monthAbbrevMap: Record<string, number> = {
      jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
      jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
      january: 1, february: 2, march: 3, april: 4, june: 6,
      july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
    };
    
    const targetMonth = monthAbbrevMap[monthAbbrev] || 0;
    const targetYear = Number(yearStr) || 0;
    if (!targetMonth || !targetYear) return;
    
    // Filter the filtered purchase order list to extract 100% contracts for that month & year, respecting other filters
    const matchingPos = poFilteredByPeriod.filter(po => {
      if (!po.po_date) return false;
      const d = new Date(po.po_date);
      return (d.getMonth() + 1) === targetMonth && d.getFullYear() === targetYear;
    });
    
    triggerContractsCSVDownload(matchingPos, `PO_Detailed_Contracts_${parts[0]}_${targetYear}.csv`);
  };

  // Helper to calculate total summary row for any reporting table page
  const calculateReportTotals = (reportKey: string, rows: string[][]): string[] => {
    if (!rows || rows.length === 0) return [];
    const numCols = rows[0].length;
    const totals = Array(numCols).fill('');
    
    if (reportKey === 'r1') {
      let totalCount = 0;
      let totalWeight = 0;
      let sumRate = 0;
      let rateCount = 0;
      let totalValue = 0;
      
      rows.forEach(r => {
        totalCount += Number(r[1]) || 0;
        totalWeight += Number(r[2]) || 0;
        const rateStr = r[3].replace(/[^\d]/g, '');
        const rateNum = Number(rateStr);
        if (rateNum) {
          sumRate += rateNum;
          rateCount++;
        }
        const valStr = r[4].replace(/[^\d]/g, '');
        const valNum = Number(valStr);
        if (valNum) {
          totalValue += valNum;
        }
      });
      
      const avgRate = rateCount > 0 ? Math.round(sumRate / rateCount) : 0;
      totals[0] = rows.length < reportOutput.rows.length ? `TOTAL (${rows.length} SEL)` : 'TOTAL';
      totals[1] = totalCount.toString();
      totals[2] = totalWeight.toFixed(3);
      totals[3] = avgRate > 0 ? `Rs. ${avgRate.toLocaleString('en-IN')}` : '--';
      totals[4] = `Rs. ${Math.round(totalValue).toLocaleString('en-IN')}`;
    } 
    else if (reportKey === 'r2') {
      let totalCount = 0;
      let totalWeight = 0;
      let sumRate = 0;
      let rateCount = 0;
      let totalValue = 0;
      
      rows.forEach(r => {
        totalCount += Number(r[1]) || 0;
        totalWeight += Number(r[2]) || 0;
        const rateStr = r[3].replace(/[^\d]/g, '');
        const rateNum = Number(rateStr);
        if (rateNum) {
          sumRate += rateNum;
          rateCount++;
        }
        const valStr = r[4].replace(/[^\d]/g, '');
        const valNum = Number(valStr);
        if (valNum) {
          totalValue += valNum;
        }
      });
      
      const avgRate = rateCount > 0 ? Math.round(sumRate / rateCount) : 0;
      totals[0] = 'TOTAL';
      totals[1] = totalCount.toString();
      totals[2] = totalWeight.toFixed(3);
      totals[3] = avgRate > 0 ? `Rs. ${avgRate.toLocaleString('en-IN')}` : '--';
      totals[4] = `Rs. ${Math.round(totalValue).toLocaleString('en-IN')}`;
      totals[5] = '';
    }
    else if (reportKey === 'r3') {
      let totalCount = 0;
      let totalWeight = 0;
      let sumRate = 0;
      let rateCount = 0;
      
      rows.forEach(r => {
        totalCount += Number(r[1]) || 0;
        totalWeight += Number(r[2]) || 0;
        const rateStr = r[3].replace(/[^\d]/g, '');
        const rateNum = Number(rateStr);
        if (rateNum) {
          sumRate += rateNum;
          rateCount++;
        }
      });
      
      const avgRate = rateCount > 0 ? Math.round(sumRate / rateCount) : 0;
      totals[0] = 'TOTAL';
      totals[1] = totalCount.toString();
      totals[2] = totalWeight.toFixed(3);
      totals[3] = avgRate > 0 ? `Rs. ${avgRate.toLocaleString('en-IN')}` : '--';
      totals[4] = '100.0%';
    }
    else if (reportKey === 'r4') {
      let totalCount = 0;
      let totalWeight = 0;
      let sumRate = 0;
      let rateCount = 0;
      
      rows.forEach(r => {
        totalCount += Number(r[1]) || 0;
        totalWeight += Number(r[2]) || 0;
        const rateStr = r[3].replace(/[^\d]/g, '');
        const rateNum = Number(rateStr);
        if (rateNum) {
          sumRate += rateNum;
          rateCount++;
        }
      });
      
      const avgRate = rateCount > 0 ? Math.round(sumRate / rateCount) : 0;
      totals[0] = 'TOTAL';
      totals[1] = totalCount.toString();
      totals[2] = totalWeight.toFixed(3);
      totals[3] = avgRate > 0 ? `Rs. ${avgRate.toLocaleString('en-IN')}` : '--';
      totals[4] = '';
    }
    else if (reportKey === 'r5') {
      let totalQty = 0;
      let totalWeight = 0;
      let sumRate = 0;
      let rateCount = 0;
      
      rows.forEach(r => {
        totalQty += Number(r[2].replace(/[^\d]/g, '')) || 0;
        totalWeight += Number(r[3]) || 0;
        const rateStr = r[4].replace(/[^\d]/g, '');
        const rateNum = Number(rateStr);
        if (rateNum) {
          sumRate += rateNum;
          rateCount++;
        }
      });
      
      const avgRate = rateCount > 0 ? Math.round(sumRate / rateCount) : 0;
      totals[0] = 'TOTAL';
      totals[1] = '';
      totals[2] = totalQty.toLocaleString();
      totals[3] = totalWeight.toFixed(3);
      totals[4] = avgRate > 0 ? `Rs. ${avgRate.toLocaleString('en-IN')}` : '--';
      totals[5] = '100.0%';
    }
    else if (reportKey === 'r6') {
      totals[0] = `TOTAL POs: ${rows.length}`;
      totals[1] = '';
      totals[2] = '';
      totals[3] = '';
      totals[4] = '';
      let totalGrace = 0;
      rows.forEach(r => {
        totalGrace += Number(r[5].replace(/[^\d]/g, '')) || 0;
      });
      totals[5] = `${totalGrace} Days`;
      totals[6] = '';
      totals[7] = '';
    }
    else if (reportKey === 'r7') {
      let totalLorries = 0;
      let totalWeight = 0;
      rows.forEach(r => {
        totalLorries += Number(r[2]) || 0;
        totalWeight += Number(r[6].replace(/[^\d.]/g, '')) || 0;
      });
      totals[0] = 'TOTAL';
      totals[1] = '';
      totals[2] = totalLorries.toString();
      totals[3] = '';
      totals[4] = '';
      totals[5] = '';
      totals[6] = `${totalWeight.toFixed(3)} MT`;
    }
    else if (reportKey === 'r8') {
      let totalLines = 0;
      let totalQty = 0;
      let totalWeight = 0;
      let sumRate = 0;
      let rateCount = 0;
      
      rows.forEach(r => {
        totalLines += Number(r[2]) || 0;
        totalQty += Number(r[3].replace(/[^\d]/g, '')) || 0;
        totalWeight += Number(r[4]) || 0;
        const rateStr = r[5].replace(/[^\d]/g, '');
        const rateNum = Number(rateStr);
        if (rateNum) {
          sumRate += rateNum;
          rateCount++;
        }
      });
      
      const avgRate = rateCount > 0 ? Math.round(sumRate / rateCount) : 0;
      totals[0] = 'TOTAL';
      totals[1] = '';
      totals[2] = totalLines.toString();
      totals[3] = totalQty.toLocaleString();
      totals[4] = totalWeight.toFixed(3);
      totals[5] = avgRate > 0 ? `Rs. ${avgRate.toLocaleString('en-IN')}` : '--';
    }
    else if (reportKey === 'r9') {
      let totalCount = 0;
      let totalWeight = 0;
      let totalValue = 0;
      rows.forEach(r => {
        totalCount += Number(r[1]) || 0;
        totalWeight += Number(r[2].replace(/[^\d.]/g, '')) || 0;
        totalValue += Number(r[3].replace(/[^\d]/g, '')) || 0;
      });
      totals[0] = 'TOTAL';
      totals[1] = totalCount.toString();
      totals[2] = `${totalWeight.toFixed(3)} MT`;
      totals[3] = `Rs. ${Math.round(totalValue).toLocaleString('en-IN')}`;
    }
    else if (reportKey === 'r10') {
      let sumBase = 0;
      let sumActual = 0;
      let sumGap = 0;
      let count = rows.length;
      
      rows.forEach(r => {
        sumBase += Number(r[2].replace(/[^\d]/g, '')) || 0;
        sumActual += Number(r[3].replace(/[^\d]/g, '')) || 0;
        sumGap += Number(r[4].replace(/[^\d-]/g, '')) || 0;
      });
      
      const avgBase = count > 0 ? Math.round(sumBase / count) : 0;
      const avgActual = count > 0 ? Math.round(sumActual / count) : 0;
      const avgGap = count > 0 ? Math.round(sumGap / count) : 0;
      const avgRatio = avgBase > 0 ? (avgGap / avgBase) * 100 : 0;
      
      totals[0] = 'TOTAL AVERAGE';
      totals[1] = '';
      totals[2] = `Rs. ${avgBase.toLocaleString('en-IN')}`;
      totals[3] = `Rs. ${avgActual.toLocaleString('en-IN')}`;
      totals[4] = `Rs. ${avgGap.toLocaleString('en-IN')}`;
      totals[5] = `${avgRatio.toFixed(1)}%`;
      totals[6] = '';
    }
    
    return totals;
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    const reportNameObj = PO_REPORTS.find(r => r.key === activePoReportKey);
    const reportName = reportNameObj ? reportNameObj.name.substring(3).trim().replace(/\s+/g, '_') : 'Procurements_Audit';
    const month = poReportMonth === 'ALL' ? 'AllMonths' : MONTH_LABELS.find(m => m.value === poReportMonth)?.label;
    const year = poReportYear === 'ALL' ? 'AllYears' : poReportYear;
    
    const filename = `PO_Report_${reportName}_${month}_${year}.csv`;
    
    // Support filtering rows by selection if checked (for r1)
    const targetRows = (activePoReportKey === 'r1' && selectedMonthsForPrint.length > 0)
      ? reportOutput.rows.filter(r => selectedMonthsForPrint.includes(r[0]))
      : reportOutput.rows;

    // Generate CSV content with Total Row added at the end
    const headersStr = reportOutput.headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
    const rowsStr = targetRows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','));
    
    // Calculate total summary row details
    const totalRowData = calculateReportTotals(activePoReportKey, targetRows);
    const totalRowStr = totalRowData.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',');
    
    const csvContent = [headersStr, ...rowsStr, totalRowStr].join('\n');
    
    // Download link block
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 p-4 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 border border-slate-200 rounded-2xl shadow-sm"
      id="purchase-order-summary-report"
    >
      
      {/* Dynamic Sub-tab selector bar inside card header */}
      {/* <div className="flex border-b-[2px] border-[#808080] pb-1 mb-2 items-center justify-between ">
        <div className="flex gap-1.5">
          <button 
            onClick={() => setViewMode('dashboard')}
            className={cn(
              "px-3 py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-wider border border-gray-400 shadow-[1px_1px_0_0_white] rounded-t transition-all",
              viewMode === 'dashboard' ? "bg-amber-100 text-slate-900 font-extrabold border-b-[#d4d0c8]" : "bg-[#c0c0c0] hover:bg-white text-slate-700 hover:text-slate-900"
            )}
          >
            📊 PO Metrics Dashboard
          </button>
          <button 
            onClick={() => setViewMode('advanced_reports')}
            className={cn(
              "px-3 py-1 text-[10px] sm:text-[11px] font-black uppercase tracking-wider border border-gray-400 shadow-[1px_1px_0_0_white] rounded-t transition-all",
              viewMode === 'advanced_reports' ? "bg-amber-100 text-slate-900 font-extrabold border-b-[#d4d0c8]" : "bg-[#c0c0c0] hover:bg-white text-slate-700 hover:text-slate-900"
            )}
          >
            📋 Advanced Month/Year Multi-Report Center (10 Presets)
          </button>
        </div>
        <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest font-mono hidden sm:inline">Advanced PO Audit Engine</span>
      </div> */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">

        {/* View Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-emerald-950 rounded-xl shadow-sm w-fit">

          <button
            onClick={() => setViewMode('dashboard')}
            className={cn(
              "px-3 sm:px-4 py-2 text-[10px] sm:text-[11px] font-black uppercase tracking-wide",
              "rounded-lg transition-all duration-200 flex items-center gap-1.5",
              viewMode === 'dashboard'
                ? "bg-white text-emerald-900 shadow-md"
                : "text-emerald-100 hover:bg-emerald-800 hover:text-white"
            )}
          >
            <span className="text-sm">📊</span>
            <span>PO Metrics Dashboard</span>
          </button>

          <button
            onClick={() => setViewMode('advanced_reports')}
            className={cn(
              "px-3 sm:px-4 py-2 text-[10px] sm:text-[11px] font-black uppercase tracking-wide",
              "rounded-lg transition-all duration-200 flex items-center gap-1.5",
              viewMode === 'advanced_reports'
                ? "bg-white text-emerald-900 shadow-md"
                : "text-emerald-100 hover:bg-emerald-800 hover:text-white"
            )}
          >
            <span className="text-sm">📋</span>
            <span>Advanced Reports</span>
            <span className="hidden sm:inline bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded-full text-[8px] font-black">
              10
            </span>
          </button>

        </div>

        {/* Engine Status */}
        {/* <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white border border-emerald-200 rounded-lg shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>

          <span className="text-[9px] font-black text-emerald-900 uppercase tracking-widest">
            Advanced PO Audit Engine
          </span>
        </div> */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 
          bg-gradient-to-r from-emerald-50 to-green-50 
          border border-emerald-300 rounded-full shadow-sm">

          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full 
              bg-emerald-400 opacity-75 animate-ping"></span>
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full 
              bg-emerald-600"></span>
          </span>

          <span className="text-[9px] font-black text-emerald-800 
            uppercase tracking-widest whitespace-nowrap">
            Advanced PO Audit Engine
          </span>
        </div>

      </div>

      {/* --- RENDER 1: STANDARD DASHBOARD MODE --- */}
      {viewMode === 'dashboard' && (
        <React.Fragment>
          {/* Upper Control Bar */}
          <div className="flex flex-wrap gap-3 items-end bg-gradient-to-r from-emerald-50 via-white to-slate-50 p-3 border border-emerald-200 shadow-sm rounded-xl">

            {/* Financial Year Filter */}
            <div className="space-y-1">
              <label
                htmlFor="financial_year_1293"
                className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wide leading-none block ml-1"
              >
                Financial Year
              </label>

              <div className="flex bg-white border border-emerald-300 rounded-lg overflow-hidden shadow-sm">
                <select
                  id="financial_year_1293"
                  name="financial_year"
                  aria-label="Financial Year"
                  value={financialYearFilter}
                  onChange={(e) => {
                    setFinancialYearFilter(e.target.value);
                    setSelectedSupplier(null);
                  }}
                  className="p-2 text-[11px] font-bold outline-none w-36 bg-white text-slate-700 cursor-pointer"
                >
                  <option value="ALL">-- ALL YEARS --</option>
                  {financialYears.filter(y => y.includes('-')).map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Global Keyword Filter */}
            <div className="flex-1 space-y-1 min-w-[240px]">
              <label className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wide leading-none block ml-1">
                Active Query Radar (Supplier, Broker, Contract No.)
              </label>

              <div className="flex bg-white border border-emerald-300 rounded-lg overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-emerald-200">
                <span className="bg-emerald-50 px-2.5 flex items-center border-r border-emerald-200 text-emerald-700">
                  <Search className="h-3.5 w-3.5" />
                </span>

                <input
                  id="search_supplier_broker_na_1318"
                  name="search_supplier_broker_na"
                  aria-label="Search supplier, broker name, PO numbers..."
                  className="flex-1 px-2.5 py-2 text-[11px] font-bold outline-none tracking-tight text-slate-700 placeholder:text-slate-400"
                  placeholder="Search supplier, broker name, PO numbers..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedSupplier(null);
                  }}
                />

                {selectedSupplier && (
                  <button
                    onClick={() => setSelectedSupplier(null)}
                    className="bg-rose-50 text-rose-700 px-3 font-bold text-[9px] hover:bg-rose-100 border-l border-rose-200 flex items-center gap-1 transition-colors"
                  >
                    Clear Selection
                  </button>
                )}
              </div>
            </div>

            {/* Action Button */}
            <div className="flex gap-1 shrink-0">
              <button
                onClick={fetchPurchaseOrders}
                disabled={loading}
                className="bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white rounded-lg px-3.5 py-2 text-[10px] font-extrabold uppercase flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-60"
              >
                <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
                <span>{loading ? "Reloading..." : "Reload Data"}</span>
              </button>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-12 gap-3">

            {/* KPI 1 */}
            <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-white border border-slate-200 rounded-xl shadow-sm p-3.5 flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Aggregate Contract Weight
                </span>

                <span className="text-xl font-mono font-black text-emerald-800 tracking-tight block">
                  {stats.totalWeight.toLocaleString('en-IN', {
                    minimumFractionDigits: 3
                  })}
                  <span className="text-xs text-slate-500 ml-1">MT</span>
                </span>
              </div>

              <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                <Scale className="h-5 w-5 text-emerald-700" />
              </div>
            </div>

            {/* KPI 2 */}
            <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-white border border-slate-200 rounded-xl shadow-sm p-3.5 flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Active Purchase Vouchers
                </span>

                <span className="text-xl font-mono font-black text-teal-700 tracking-tight block">
                  {stats.totalCount}
                  <span className="text-[9px] text-slate-500 ml-1">PO CONTRACTS</span>
                </span>
              </div>

              <div className="p-2.5 bg-teal-50 border border-teal-100 rounded-lg">
                <FileText className="h-5 w-5 text-teal-700" />
              </div>
            </div>

            {/* KPI 3 */}
            <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-white border border-slate-200 rounded-xl shadow-sm p-3.5 flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Avg Contract Lot Size
                </span>

                <span className="text-xl font-mono font-black text-cyan-700 tracking-tight block">
                  {stats.averageWeight.toLocaleString('en-IN', {
                    minimumFractionDigits: 3
                  })}
                  <span className="text-xs text-slate-500 ml-1">MT</span>
                </span>
              </div>

              <div className="p-2.5 bg-cyan-50 border border-cyan-100 rounded-lg">
                <Calculator className="h-5 w-5 text-cyan-700" />
              </div>
            </div>

            {/* KPI 4 */}
            <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-white border border-slate-200 rounded-xl shadow-sm p-3.5 flex items-center justify-between hover:shadow-md transition-shadow">
              <div className="space-y-1 min-w-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                  Primary Supplier Lead
                </span>

                <span className="text-[12px] font-black text-slate-800 tracking-tight block uppercase truncate max-w-[180px]">
                  {stats.maxSupplier}
                </span>

                <span className="text-[8px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 border border-rose-100 rounded inline-block uppercase">
                  Max single: {stats.maxWeight} MT
                </span>
              </div>

              <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg shrink-0">
                <UserCheck className="h-5 w-5 text-rose-700" />
              </div>
            </div>
          </div>

          {/* Main Content Layout */}
          <div className="grid grid-cols-12 gap-4">

            {/* Interactive Bar Chart */}
            <div className="col-span-12 lg:col-span-8 bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">

              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-emerald-700" />
                    <span>Supplier Contract Distribution Metric Chart</span>
                  </h3>

                  <p className="text-[9px] text-slate-400 italic mt-0.5">
                    {selectedSupplier
                      ? `Filtering details for selected supplier: "${selectedSupplier}"`
                      : 'Click on a bar to filter individual transaction vouchers below.'}
                  </p>
                </div>

                {selectedSupplier && (
                  <button
                    onClick={() => setSelectedSupplier(null)}
                    className="text-[9px] font-black border border-emerald-600 hover:bg-emerald-700 hover:text-white text-emerald-700 uppercase px-2.5 py-1 bg-emerald-50 rounded-md transition-colors"
                  >
                    Show All Suppliers
                  </button>
                )}
              </div>

              <div className="h-72 w-full font-mono text-[9px]">
                {groupedChartData.length === 0 ? (
                  <div className="h-full flex flex-col justify-center items-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                    <Layers className="h-8 w-8 text-slate-300 mb-2" />
                    <span>No purchase master records exist following current filters.</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                    <BarChart
                      data={groupedChartData}
                      margin={{ top: 15, right: 10, left: -25, bottom: 10 }}
                      onMouseMove={(state) => {
                        if (state && state.activeTooltipIndex !== undefined) {
                          setHoveredBar(state.activeTooltipIndex as number | null);
                        } else {
                          setHoveredBar(null);
                        }
                      }}
                      onMouseLeave={() => setHoveredBar(null)}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

                      <XAxis
                        dataKey="supplier"
                        tickFormatter={(val) =>
                          val.length > 12 ? `${val.substring(0, 10)}...` : val
                        }
                        stroke="#475569"
                        fontWeight="bold"
                      />

                      <YAxis
                        stroke="#475569"
                        fontWeight="bold"
                      />

                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: '8px',
                          color: '#f8fafc',
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '11px'
                        }}
                        cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }}
                        formatter={(value: any, name: string, props: any) => [
                          `${value.toFixed(3)} M.Ton`,
                          props.payload.supplier
                        ]}
                      />

                      <Bar
                        dataKey="total_contract_mt"
                        radius={[5, 5, 0, 0]}
                        onClick={(data: any) => {
                          if (!data) return;

                          if ('supplier' in data) {
                            handleBarClick(data as GroupedSupplier);
                          } else if (
                            data.activePayload &&
                            data.activePayload[0] &&
                            data.activePayload[0].payload
                          ) {
                            handleBarClick(
                              data.activePayload[0].payload as GroupedSupplier
                            );
                          } else if (data.payload) {
                            handleBarClick(data.payload as GroupedSupplier);
                          }
                        }}
                        className="cursor-pointer"
                      >
                        {groupedChartData.map((entry, index) => {
                          const baseColor = barColors[index % barColors.length];
                          const isSelected = selectedSupplier === entry.supplier;
                          const isHovered = hoveredBar === index;

                          let fill = baseColor;

                          if (selectedSupplier) {
                            fill = isSelected ? baseColor : `${baseColor}33`;
                          } else if (hoveredBar !== null) {
                            fill = isHovered ? baseColor : `${baseColor}cc`;
                          }

                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={fill}
                              stroke={isSelected ? '#047857' : 'none'}
                              strokeWidth={isSelected ? 2 : 0}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Supplier Summary Registry */}
            <div className="col-span-12 lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 overflow-hidden flex flex-col shadow-sm max-h-[352px]">

              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2 border-b border-slate-200 pb-2 flex items-center justify-between">
                <span>Supplier Summary Registry</span>

                <span className="text-[9px] font-bold text-slate-400 font-mono tracking-tighter bg-slate-50 px-2 py-1 rounded">
                  ({groupedChartData.length} active)
                </span>
              </h3>

              <div className="flex-1 overflow-auto bg-slate-50 border border-slate-200 rounded-lg">
                <table className="w-full text-[10px] border-collapse">

                  <thead className="bg-emerald-50 text-emerald-900 font-bold sticky top-0 border-b border-emerald-200">
                    <tr>
                      <th className="p-2 px-2.5 text-left border-r border-emerald-200">
                        SUPPLIER
                      </th>
                      <th className="p-2 text-center border-r border-emerald-200 w-16">
                        VOUCHERS
                      </th>
                      <th className="p-2 text-right w-24">
                        CONTRACT WT (MT)
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {groupedChartData.map((item, idx) => {
                      const isSelected = selectedSupplier === item.supplier;

                      return (
                        <tr
                          key={idx}
                          onClick={() => handleBarClick(item)}
                          className={cn(
                            "hover:bg-emerald-50 cursor-pointer font-bold transition-all text-[9.5px]",
                            isSelected
                              ? "bg-emerald-100 text-emerald-900 border-l-[3px] border-l-emerald-600 font-black"
                              : "even:bg-white"
                          )}
                        >
                          <td
                            className="p-1.5 px-2.5 font-black truncate max-w-[140px]"
                            title={item.supplier}
                          >
                            {item.supplier}
                          </td>

                          <td className="p-1.5 text-center font-mono tabular-nums text-slate-500">
                            {item.orderCount} POs
                          </td>

                          <td className="p-1.5 px-2.5 text-right font-mono tabular-nums text-emerald-800 font-black">
                            {item.total_contract_mt.toLocaleString('en-IN', {
                              minimumFractionDigits: 3
                            })}
                          </td>
                        </tr>
                      );
                    })}

                    {groupedChartData.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-4 text-center text-slate-400 italic"
                        >
                          No suppliers found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Bottom Ledger Vouchers Grid */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-3">

            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="font-extrabold">📁</span>
                  <span>Purchase Orders Transaction Audit Log</span>
                </h3>

                {selectedSupplier && (
                  <span className="text-[10px] text-slate-600 bg-emerald-50 px-2 py-1 border border-emerald-200 rounded-md font-bold mt-1 inline-block">
                    Currently Drilling Down:
                    <span className="font-black text-emerald-800 ml-1">
                      {selectedSupplier}
                    </span>
                  </span>
                )}
              </div>

              <span className="text-[9.5px] text-slate-600 italic bg-slate-50 border border-slate-200 font-bold px-2.5 py-1 rounded-md">
                Showing {displayedDetails.length} of {originalData.length} records
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg shadow-inner overflow-x-auto">

              <table className="w-full border-collapse text-[10px]">

                <thead className="bg-emerald-700 text-white font-bold text-center border-b border-emerald-800">
                  <tr className="h-9">
                    <th className="px-4 text-left border-r border-emerald-600 w-24">
                      DATE
                    </th>

                    <th className="px-3 border-r border-emerald-600 w-28">
                      PO CONTRACT #
                    </th>

                    <th className="px-3 border-r border-emerald-600 w-20">
                      FIN YEAR
                    </th>

                    <th className="px-5 text-left border-r border-emerald-600">
                      SUPPLIER (PARTY) IDENTITY
                    </th>

                    <th className="px-5 text-left border-r border-emerald-600">
                      BROKER CODE
                    </th>

                    <th className="px-3 border-r border-emerald-600 w-28">
                      PO TYPE
                    </th>

                    <th className="px-3 border-r border-emerald-600 w-20">
                      STATUS
                    </th>

                    <th className="px-4 text-right w-36">
                      CONTRACT WT. (MT)
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 font-bold">

                  {displayedDetails.map((po, index) => {
                    const wt = Number(po.total_contract_mt) || 0;

                    return (
                      <tr
                        key={po.po_id || index}
                        className="h-10 hover:bg-emerald-50 transition-colors group cursor-default border-b border-slate-100"
                      >
                        <td className="px-4 text-slate-500 font-mono italic">
                          {po.po_date
                            ? new Date(po.po_date).toLocaleDateString('en-GB')
                            : 'N/A'}
                        </td>

                        <td className="px-3 text-center bg-blue-50/30 text-blue-900 border-r border-slate-100 font-mono">
                          {po.po_no}
                        </td>

                        <td className="px-3 text-center text-slate-500">
                          {po.financial_year}
                        </td>

                        <td
                          className="px-5 text-slate-900 max-w-[200px] truncate"
                          title={po.supplier}
                        >
                          {po.supplier || 'DIRECT'}
                        </td>

                        <td className="px-5 text-slate-600 font-medium">
                          {po.broker || 'DIRECT'}
                        </td>

                        <td className="px-3 text-center text-slate-500 font-medium tracking-tight">
                          <span className="border border-slate-200 px-1.5 py-0.5 bg-slate-50 text-[9px] uppercase font-black rounded">
                            {po.po_type || 'RAW JUTE'}
                          </span>
                        </td>

                        <td className="px-3 text-center">
                          <span
                            className={cn(
                              "px-2 py-0.5 text-[8.5px] font-black uppercase rounded-full border",
                              po.pending !== false
                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            )}
                          >
                            {po.pending !== false ? 'Pending' : 'Completed'}
                          </span>
                        </td>

                        <td className="px-4 text-right tabular-nums text-emerald-800 font-black italic">
                          {wt.toLocaleString('en-IN', {
                            minimumFractionDigits: 3
                          })}{' '}
                          MT
                        </td>
                      </tr>
                    );
                  })}

                  {displayedDetails.length === 0 && (
                    <tr className="h-16">
                      <td
                        colSpan={8}
                        className="text-center text-slate-400 italic"
                      >
                        No individual transactions match the filter setup.
                      </td>
                    </tr>
                  )}

                </tbody>
              </table>
            </div>
          </div>
        </React.Fragment>
      )}

      {/* --- RENDER 2: DYNAMIC ADVANCED MONTH/YEAR WISE REPORTS ENGINE --- */}
      {viewMode === 'advanced_reports' && (
        <div className="space-y-4">
          
          {/* Advanced Filtering Block */}
          <div className="flex flex-wrap gap-3 items-end bg-[#c0c0c0] p-3.5 border-2 border-white shadow-[2px_2px_0_0_rgba(0,0,0,0.2)] rounded-sm">
            
            {/* Month Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-700 uppercase italic leading-none block ml-1 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-indigo-900" />
                <span>Procurement Month</span>
              </label>
              <div className="flex bg-white border border-gray-400 p-px">
                <select  id="poreportmonth_1676" name="poreportmonth" aria-label="poreportmonth"
                  value={poReportMonth}
                  onChange={(e) => setPoReportMonth(e.target.value)}
                  className="p-1 px-1.5 text-[11px] font-black outline-none w-36 bg-white"
                >
                  {MONTH_LABELS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Year Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-700 uppercase italic leading-none block ml-1 flex items-center gap-1">
                <ClipboardList className="h-3 w-3 text-teal-800" />
                <span>Financial/Calendar Year</span>
              </label>
              <div className="flex bg-white border border-gray-400 p-px">
                <select  id="poreportyear_1695" name="poreportyear" aria-label="poreportyear"
                  value={poReportYear}
                  onChange={(e) => setPoReportYear(e.target.value)}
                  className="p-1 px-1.5 text-[11px] font-black outline-none w-36 bg-white"
                >
                  <option value="ALL">-- ALL YEARS --</option>
                  {financialYears.map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Merchant / Supplier Filter */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-700 uppercase italic leading-none block ml-1 flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-emerald-800" />
                <span>Merchant / Supplier</span>
              </label>
              <div className="flex bg-white border border-gray-400 p-px">
                <select  id="poreportsupplier_1715" name="poreportsupplier" aria-label="poreportsupplier"
                  value={poReportSupplier}
                  onChange={(e) => setPoReportSupplier(e.target.value)}
                  className="p-1 px-1.5 text-[11px] font-black outline-none w-44 bg-white"
                >
                  <option value="ALL">-- ALL SUPPLIERS --</option>
                  {reportSuppliersList.map(sup => (
                    <option key={sup} value={sup}>{sup}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date Range Start */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-700 uppercase italic leading-none block ml-1 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-amber-800" />
                <span>Start Date</span>
              </label>
              <div className="flex bg-white border border-gray-400 p-px">
                <input  id="poreportstartdate_1735" name="poreportstartdate" aria-label="poreportstartdate"
                  type="date"
                  value={poReportStartDate}
                  onChange={(e) => setPoReportStartDate(e.target.value)}
                  className="p-0.5 px-1.5 text-[11px] font-black outline-none w-32 bg-white"
                />
              </div>
            </div>

            {/* Date Range End */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-700 uppercase italic leading-none block ml-1 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-amber-800" />
                <span>End Date</span>
              </label>
              <div className="flex bg-white border border-gray-400 p-px">
                <input  id="poreportenddate_1751" name="poreportenddate" aria-label="poreportenddate"
                  type="date"
                  value={poReportEndDate}
                  onChange={(e) => setPoReportEndDate(e.target.value)}
                  className="p-0.5 px-1.5 text-[11px] font-black outline-none w-32 bg-white"
                />
              </div>
            </div>

            {/* Query search inside the report scope */}
            <div className="flex-grow space-y-1 min-w-[200px]">
              <label className="text-[10px] font-bold text-gray-700 uppercase italic leading-none block ml-1 flex items-center gap-1">
                <Search className="h-3 w-3 text-slate-800" />
                <span>In-Report Search Filters</span>
              </label>
              <div className="flex bg-white border border-gray-400 p-px">
                <input  id="query_inside_selection_1767" name="query_inside_selection" aria-label="Query inside selection..."
                  className="flex-1 p-1 text-[11px] font-black outline-none tracking-tight placeholder:text-gray-400" 
                  placeholder="Query inside selection..." 
                  value={poReportSearch}
                  onChange={(e) => setPoReportSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Excel Download & Action buttons */}
            <div className="flex gap-1.5 shrink-0">
              <button 
                onClick={handleExportCSV}
                className="bg-emerald-700 hover:bg-emerald-850 text-white px-3.5 py-1.5 text-[10px] font-bold uppercase flex items-center gap-1.5 shadow-[1.5px_1.5px_0_0_black]"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Export (CSV)</span>
              </button>

              <button
                onClick={() => {
                  setPoReportMonth('ALL');
                  setPoReportYear('ALL');
                  setPoReportSearch('');
                  setPoReportStartDate('');
                  setPoReportEndDate('');
                  setPoReportSupplier('ALL');
                  setSelectedMonthsForPrint([]);
                }}
                className="bg-rose-700 hover:bg-rose-900 text-white px-2.5 py-1.5 text-[10px] font-bold uppercase flex items-center gap-1.5 shadow-[1px_1px_0_0_black]"
                title="Reset all Advanced Report filters"
              >
                Clear
              </button>
              
              <button 
                onClick={fetchPurchaseOrders} 
                disabled={loading}
                className="bg-[#d4d0c8] border border-white hover:bg-white px-3 py-1.5 text-[10px] font-bold uppercase flex items-center gap-1 shadow-[1px_1px_0_0_black]"
              >
                <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
              </button>
            </div>
          </div>

          {/* Central Reports Workspace Grid */}
          <div className="grid grid-cols-12 gap-4">
            
            {/* Sidebar list of 10 Reports */}
            <div className="col-span-12 lg:col-span-4 bg-[#c0c0c0] border-2 border-white p-2 flex flex-col shadow-[2px_2px_0_0_rgba(0,0,0,0.15)] h-auto lg:max-h-[500px] overflow-y-auto">
              <div className="text-[9.5px] font-black text-slate-900 border-b border-gray-400 pb-1.5 mb-2 uppercase  tracking-tight">
                Select Sourcing Report Format
              </div>
              <div className="space-y-1">
                {PO_REPORTS.map(r => {
                  const isActive = activePoReportKey === r.key;
                  return (
                    <button
                      key={r.key}
                      onClick={() => setActivePoReportKey(r.key)}
                      className={cn(
                        "w-full text-left p-2.5 text-[10px] font-bold flex flex-col justify-start rounded-sm transition-all border",
                        isActive 
                          ? "bg-indigo-950 text-white border-slate-950 shadow-inner" 
                          : "bg-[#d4d0c8] hover:bg-white text-slate-800 border-gray-300"
                      )}
                    >
                      <span className="uppercase text-[10px] font-black tracking-tight">{r.name}</span>
                      <span className={cn(
                        "text-[8px] font-medium mt-0.5 leading-normal",
                        isActive ? "text-slate-300" : "text-gray-500"
                      )}>{r.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visual Charts & Table Area */}
            <div className="col-span-12 lg:col-span-8 flex flex-col space-y-4">
              {/* Metric Summary Panel & Dynamic Chart Display */}
              <div className="bg-white border border-gray-400 p-4 rounded-sm shadow-sm space-y-3">
                <div className="flex justify-between items-start border-b pb-2 ">
                  <div>
                    <h3 className="text-[11px] font-black text-indigo-950 uppercase tracking-wider">
                      {PO_REPORTS.find(r => r.key === activePoReportKey)?.name}
                    </h3>
                    <p className="text-[8.5px] text-gray-400 italic">
                      Live compiled statistics for selected month and financial year.
                    </p>
                  </div>
                  
                  {/* Scope Totals badge */}
                  <div className="text-right flex flex-col leading-none font-mono text-[9px] font-black uppercase">
                    <span className="text-emerald-700">Committed: {reportOutput.totalMT.toLocaleString()} MT</span>
                    <span className="text-slate-400 mt-1">Contracts: {reportOutput.totalCount} Matches</span>
                  </div>
                </div>

                {/* Trend Metric interactive selector for report type r1 */}
                {activePoReportKey === 'r1' && (
                  <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-sm self-start ">
                    <span className="text-[8.5px] font-black text-slate-500 uppercase px-1">Trend Metric:</span>
                    {[
                      { key: 'combo', label: 'Combo Trend' },
                      { key: 'weight', label: 'Weight Volume (MT)' },
                      { key: 'capital', label: 'Capital Outlay (INR)' },
                      { key: 'count', label: 'Order Counts' }
                    ].map(m => (
                      <button
                        key={m.key}
                        onClick={() => setR1ChartMetric(m.key as any)}
                        className={cn(
                          "px-2 py-0.5 text-[8.5px] font-black rounded-sm transition-colors border",
                          r1ChartMetric === m.key 
                            ? "bg-indigo-950 text-white border-indigo-950" 
                            : "bg-white hover:bg-slate-50 text-slate-700 border-gray-200"
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Graph Zone */}
                <div className="h-56 mt-2 font-mono text-[9px] ">
                  {reportOutput.chartData.length === 0 ? (
                    <div className="h-full flex flex-col justify-center items-center text-gray-400 bg-slate-50 border border-dashed border-gray-200">
                      <Clock className="h-7 w-7 text-slate-300 animate-pulse mb-1.5" />
                      <span className="text-[9.5px]">No matching data points located within chosen filters scope.</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                      
                      {/* Custom Trend Charts for Monthly Procurement Summary (r1) */}
                      {activePoReportKey === 'r1' && (
                        <React.Fragment>
                          {r1ChartMetric === 'combo' && (
                            <ComposedChart data={reportOutput.chartData} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
                              <defs>
                                <linearGradient id="poColorComboArea" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.1}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 8 }} />
                              <YAxis yAxisId="left" stroke="#4f46e5" tick={{ fontSize: 8 }} />
                              <YAxis yAxisId="right" orientation="right" stroke="#10b981" tick={{ fontSize: 8 }} />
                              <Tooltip 
                                formatter={(value: any, name: string) => {
                                  if (name === "estimatedValue") return [`Rs. ${Math.round(value).toLocaleString('en-IN')}`, "Est. Capital Required"];
                                  if (name === "weight") return [`${value.toFixed(3)} MT`, "Volume Sourced"];
                                  return [value, name];
                                }}
                              />
                              <Legend wrapperStyle={{ fontSize: '8px' }} />
                              <Area yAxisId="left" type="monotone" dataKey="weight" name="weight" stroke="#4f46e5" fill="url(#poColorComboArea)" strokeWidth={1.5} />
                              <Line yAxisId="right" type="monotone" dataKey="estimatedValue" name="estimatedValue" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                            </ComposedChart>
                          )}

                          {r1ChartMetric === 'weight' && (
                            <AreaChart data={reportOutput.chartData} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
                              <defs>
                                <linearGradient id="poColorWeight" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 8 }} />
                              <YAxis stroke="#64748b" tick={{ fontSize: 8 }} />
                              <Tooltip formatter={(value: any) => [`${value.toFixed(3)} MT`, `Weight Volume (MT)`]} />
                              <Area type="monotone" dataKey="weight" stroke="#2563eb" fill="url(#poColorWeight)" strokeWidth={1.5} />
                            </AreaChart>
                          )}

                          {r1ChartMetric === 'capital' && (
                            <AreaChart data={reportOutput.chartData} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
                              <defs>
                                <linearGradient id="poColorCapital" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 8 }} />
                              <YAxis stroke="#64748b" tick={{ fontSize: 8 }} />
                              <Tooltip formatter={(value: any) => [`Rs. ${Math.round(value).toLocaleString('en-IN')}`, `Capital Outlay`]} />
                              <Area type="monotone" dataKey="estimatedValue" stroke="#10b981" fill="url(#poColorCapital)" strokeWidth={1.5} />
                            </AreaChart>
                          )}

                          {r1ChartMetric === 'count' && (
                            <BarChart data={reportOutput.chartData} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 8 }} />
                              <YAxis stroke="#64748b" tick={{ fontSize: 8 }} />
                              <Tooltip formatter={(value: any) => [value, `Contracts Count`]} />
                              <Bar dataKey="count" fill="#4f46e5" radius={[2, 2, 0, 0]} />
                            </BarChart>
                          )}
                        </React.Fragment>
                      )}

                      {/* Fallback to original layout for other reports */}
                      {activePoReportKey !== 'r1' && reportOutput.chartType === 'area' && (
                        <AreaChart data={reportOutput.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                          <defs>
                            <linearGradient id="poColorArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 8 }} />
                          <YAxis stroke="#64748b" tick={{ fontSize: 8 }} />
                          <Tooltip />
                          <Area type="monotone" dataKey="weight" stroke="#4f46e5" fillOpacity={1} fill="url(#poColorArea)" strokeWidth={1.5} />
                        </AreaChart>
                      )}

                      {/* Bar Chart representation */}
                      {reportOutput.chartType === 'bar' && (
                        <BarChart data={reportOutput.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 8 }} />
                          <YAxis stroke="#64748b" tick={{ fontSize: 8 }} />
                          <Tooltip />
                          <Bar dataKey="weight" fill="#0f766e" radius={[2, 2, 0, 0]}>
                            {reportOutput.chartData.map((e, idx) => (
                              <Cell key={idx} fill={barColors[idx % barColors.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      )}

                      {/* Horizontal Bar representation */}
                      {reportOutput.chartType === 'hbar' && (
                        <BarChart data={reportOutput.chartData} layout="vertical" margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis type="number" stroke="#64748b" tick={{ fontSize: 8 }} />
                          <YAxis dataKey="name" type="category" stroke="#64748b" tick={{ fontSize: 7.5 }} width={70} />
                          <Tooltip />
                          <Bar dataKey="weight" fill="#312e81" radius={[0, 2, 2, 0]} />
                        </BarChart>
                      )}

                      {/* Full Pie representation */}
                      {reportOutput.chartType === 'pie' && (
                        <PieChart>
                          <Pie
                            data={reportOutput.chartData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                          >
                            {reportOutput.chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      )}

                      {/* Half-circle gauge gauge representation */}
                      {reportOutput.chartType === 'half_circle' && (
                        <PieChart>
                          <Pie
                            data={reportOutput.chartData}
                            cx="50%"
                            cy="90%"
                            startAngle={180}
                            endAngle={0}
                            innerRadius={50}
                            outerRadius={90}
                            paddingAngle={2}
                            dataKey="value"
                            nameKey="name"
                            label={({ name, percent }: any) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                          >
                            {reportOutput.chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: '8px' }} />
                        </PieChart>
                      )}

                      {/* Line Chart representation */}
                      {reportOutput.chartType === 'line' && (
                        <LineChart data={reportOutput.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 8 }} />
                          <YAxis stroke="#64748b" tick={{ fontSize: 8 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: '8.5px' }} />
                          <Line type="monotone" dataKey="baseRate" stroke="#10b981" name="B-Rate (Base)" strokeWidth={2} />
                          <Line type="monotone" dataKey="actualRate" stroke="#f43f5e" name="Invoice Actual Qtl" strokeWidth={2} />
                        </LineChart>
                      )}

                      {/* Composed Mix logic representation */}
                      {reportOutput.chartType === 'composed' && (
                        <ComposedChart data={reportOutput.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                          <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 8 }} />
                          <YAxis stroke="#64748b" tick={{ fontSize: 8 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: '9px' }} />
                          <CartesianGrid stroke="#f1f5f9" />
                          <Bar dataKey="lorries" name="Lorries Dispatched" fill="#0284c7" barSize={20} radius={[2, 2, 0, 0]} />
                          <Line type="monotone" dataKey="payload" name="Payload Capacity (MT)" stroke="#ff7300" strokeWidth={2} />
                        </ComposedChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Comprehensive Data Grid output */}
              <div className="bg-[#d4d0c8] border-2 border-white shadow-[2px_2px_0_0_rgba(0,0,0,0.4)] p-4 space-y-2.5">
                <div className="flex justify-between items-center  font-mono text-[9px] font-black uppercase text-slate-800">
                  <div className="flex items-center gap-2">
                    <span>Report Output Records Grid</span>
                    {activePoReportKey === 'r1' && selectedMonthsForPrint.length > 0 && (
                      <button 
                        onClick={() => setShowPrintModal(true)}
                        className="bg-indigo-950 text-white hover:bg-slate-900 border border-indigo-900 px-2.5 py-1 text-[8.5px] font-black uppercase shadow-sm rounded-sm shrink-0"
                      >
                        Print Selected ({selectedMonthsForPrint.length})
                      </button>
                    )}
                  </div>
                  <span className="text-gray-500 italic bg-white/65 px-2 py-0.5 border border-slate-300">
                    Row total: {reportOutput.rows.length} lines
                  </span>
                </div>
                
                <div className="bg-white border border-gray-400 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.1)] overflow-x-auto max-h-[295px]">
                  <table className="w-full border-collapse text-[10px]">
                    <thead className="bg-[#c0c0c0] font-bold text-center border-b border-gray-400  sticky top-0 z-10 font-sans">
                      <tr className="h-8">
                        {activePoReportKey === 'r1' && (
                          <th className="px-2 border-r border-gray-300 w-12 text-center text-[9.5px] uppercase">
                            <input  id="checkbox_2118" name="checkbox" aria-label="checkbox"
                              type="checkbox"
                              checked={reportOutput.rows.length > 0 && selectedMonthsForPrint.length === reportOutput.rows.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedMonthsForPrint(reportOutput.rows.map(r => r[0]));
                                } else {
                                  setSelectedMonthsForPrint([]);
                                }
                              }}
                              className="cursor-pointer"
                              title="Select/deselect all months"
                            />
                          </th>
                        )}
                        {reportOutput.headers.map((h, i) => (
                          <th key={i} className="px-3 border-r border-gray-300 text-[9.5px] uppercase truncate">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-bold font-sans">
                      {reportOutput.rows.map((row, idx) => (
                        <tr 
                          key={idx} 
                          className="h-9 hover:bg-[#ffffd0]/45 transition-colors border-b border-gray-50"
                        >
                          {activePoReportKey === 'r1' && (
                            <td className="px-2 border-r border-gray-100 text-center w-12">
                              <input  id="checkbox_2146" name="checkbox" aria-label="checkbox"
                                type="checkbox"
                                checked={selectedMonthsForPrint.includes(row[0])}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedMonthsForPrint(prev => [...prev, row[0]]);
                                  } else {
                                    setSelectedMonthsForPrint(prev => prev.filter(m => m !== row[0]));
                                  }
                                }}
                                className="cursor-pointer"
                              />
                            </td>
                          )}
                          {row.map((cell, cidx) => {
                            const isClickableMonth = activePoReportKey === 'r1' && cidx === 0;
                            return (
                              <td 
                                key={cidx} 
                                className={cn(
                                  "px-3 truncate transition-all duration-150",
                                  cidx === 0 ? "text-slate-900 text-left font-mono" : "text-center text-slate-700",
                                  cell.includes('Rs.') || cell.includes('Rs') ? "text-right text-indigo-900 font-black pr-4" : "",
                                  cell.includes('MT') ? "text-right text-teal-950 pr-4" : "",
                                  isClickableMonth ? "text-blue-700 hover:text-blue-900 underline decoration-blue-400 font-black cursor-pointer hover:bg-blue-55/15" : ""
                                )}
                                title={isClickableMonth ? `Click to download granular detail contracts CSV for ${cell}` : cell}
                                onClick={isClickableMonth ? () => downloadIndividualContractsCSV(cell) : undefined}
                              >
                                {cell}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {reportOutput.rows.length > 0 && (
                        <tr className="h-10 bg-[#f1f5f9] font-black border-t-2 border-gray-400 ">
                          {activePoReportKey === 'r1' && (
                            <td className="bg-[#f1f5f9] border-r border-gray-300"></td>
                          )}
                          {calculateReportTotals(
                            activePoReportKey, 
                            activePoReportKey === 'r1' && selectedMonthsForPrint.length > 0 
                              ? reportOutput.rows.filter(r => selectedMonthsForPrint.includes(r[0])) 
                              : reportOutput.rows
                          ).map((cell, cidx) => (
                            <td 
                              key={`total-${cidx}`} 
                              className={cn(
                                "px-3 truncate text-slate-900 border-r border-gray-300",
                                cidx === 0 ? "text-left font-sans font-black" : "text-center font-mono font-black",
                                cell.includes('Rs.') || cell.includes('Rs') ? "text-right text-indigo-950 pr-4" : "",
                                cell.includes('MT') ? "text-right text-teal-950 pr-4" : ""
                              )}
                              title={cell}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      )}
                      {reportOutput.rows.length === 0 && (
                        <tr className="h-20">
                          <td colSpan={(reportOutput.headers.length || 1) + (activePoReportKey === 'r1' ? 1 : 0)} className="text-center text-gray-400 italic">
                            No records compiled for chosen report layout and filtering timeline.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* Dynamic Concatenated Print Modal */}
      {showPrintModal && (
        <div className="print-modal-wrapper fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 overflow-y-auto print:absolute print:inset-0 print:bg-white print:p-0 print:overflow-visible">
          <div className="print-modal-inner bg-[#d4d0c8] border-2 border-white shadow-[4px_4px_10px_rgba(0,0,0,0.35)] w-full max-w-4xl rounded-sm p-4 print:border-0 print:shadow-none print:bg-white print:p-0">
            
            {/* Modal Controls - Hidden during System Print */}
            <div className="flex justify-between items-center pb-3 border-b-2 border-gray-400 mb-4 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-indigo-950" />
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                  Concatenated Executive Print Center (Selected Months: {selectedMonthsForPrint.length})
                </h2>
              </div>
              <div className="flex items-center gap-2 font-black">
                <button
                  onClick={() => window.print()}
                  className="bg-emerald-705 hover:bg-emerald-800 text-white border border-emerald-800 px-3 py-1.5 text-[10.5px] uppercase font-bold flex items-center gap-1.5 shadow-sm rounded-sm bg-emerald-600 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Send to System Print</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="bg-gray-100 hover:bg-white border border-gray-400 text-slate-800 px-3 py-1.5 text-[10.5px] uppercase font-bold shadow-sm rounded-sm cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>

            {/* Print Document Stage - Scrolling Preview Frame for Screen */}
            <div className="bg-slate-500 overflow-y-auto max-h-[75vh] p-6 space-y-8 select-text print:bg-white print:p-0 print:overflow-visible print:max-h-none print:space-y-0 shadow-inner">
              
              {/* PAGE 1: Consolidated Executive Cover Sheet & Global Summary */}
              <div className="print-page bg-white p-10 max-w-[210mm] mx-auto border border-gray-300 shadow-md print:shadow-none print:border-0 print:p-0 rounded-sm">
                
                {/* Brand Header */}
                <div className="flex justify-between items-start border-b-4 border-slate-900 pb-4">
                  <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase font-sans">
                      CHAMPDANY FIBRE TRADING LIMITED
                    </h1>
                    <p className="text-[10px] text-gray-500 font-mono mt-1 uppercase">
                      Executive Monthly Raw Materials Procurement & Consolidation Dossier
                    </p>
                    <p className="text-[9.5px] text-gray-400 italic">
                      Assembled: {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })} at {new Date().toLocaleTimeString('en-IN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="border-2 border-slate-900 px-3 py-1 bg-slate-50 text-[10px] font-black uppercase text-slate-950 inline-block font-sans">
                      DOSSIER COVER
                    </span>
                    {poReportSupplier !== 'ALL' && (
                      <p className="text-[9px] font-bold text-slate-850 uppercase mt-2">
                        Vendor Focus: <span className="underline">{poReportSupplier}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Cover Narrative */}
                <div className="my-5 bg-slate-55 border border-slate-200 p-3 rounded-sm font-sans">
                  <h3 className="text-[10.5px] font-black text-slate-900 uppercase">
                    CONSOLIDATED MASTER EXECUTIVE OVERVIEW
                  </h3>
                  <p className="text-[9.5px] text-gray-650 mt-1 leading-relaxed">
                    This official dossier compiles, checks, and certifies the raw material procurement logs and contract entries corresponding to {selectedMonthsForPrint.length} selected monthly billing cycles. The records listed represent verified contractual commitments, transaction volumes, rates, and required commercial capital outlays.
                  </p>
                </div>

                {/* Consolidated Table */}
                <h4 className="text-[9.5px] font-extrabold text-slate-800 uppercase tracking-wider mb-2 font-sans">Compiled Billing Cycle Totals</h4>
                <div className="border border-slate-800 overflow-hidden mb-6">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white font-black uppercase  text-[9.5px] font-sans">
                        <th className="p-2 border border-slate-800">Billing Cycle</th>
                        <th className="p-2 border border-slate-800 text-center font-bold">Contracts count</th>
                        <th className="p-2 border border-slate-800 text-right">Sourced Mass (MT)</th>
                        <th className="p-2 border border-slate-800 text-right">Avg B-Rate (INR)</th>
                        <th className="p-2 border border-slate-800 text-right">Est. Required Capital</th>
                      </tr>
                    </thead>
                    <tbody className="font-sans">
                      {(() => {
                        const selectedRows = reportOutput.rows.filter(r => selectedMonthsForPrint.includes(r[0]));
                        
                        let grandCount = 0;
                        let grandWeight = 0;
                        let grandSumRate = 0;
                        let rateCount = 0;
                        let grandCapital = 0;

                        selectedRows.forEach(row => {
                          grandCount += Number(row[1]) || 0;
                          grandWeight += Number(row[2]) || 0;
                          
                          const rateNum = Number(row[3].replace(/[^\d]/g, '')) || 0;
                          if (rateNum) {
                            grandSumRate += rateNum;
                            rateCount++;
                          }

                          const capitalNum = Number(row[4].replace(/[^\d]/g, '')) || 0;
                          if (capitalNum) {
                            grandCapital += capitalNum;
                          }
                        });

                        const avgGrandRate = rateCount > 0 ? Math.round(grandSumRate / rateCount) : 0;

                        return (
                          <>
                            {selectedRows.map((row, index) => (
                              <tr key={index} className="border-b border-gray-300 font-sans">
                                <td className="p-2 font-mono font-bold border border-gray-300 text-slate-800">{row[0]}</td>
                                <td className="p-2 text-center border border-gray-300 font-semibold">{row[1]}</td>
                                <td className="p-2 text-right font-mono font-bold border border-gray-300 text-emerald-950">{row[2]} MT</td>
                                <td className="p-2 text-right border border-gray-300 text-indigo-900 font-bold">{row[3]}</td>
                                <td className="p-2 text-right border border-gray-300 text-teal-900 font-black">{row[4]}</td>
                              </tr>
                            ))}
                            
                            {/* Grand Totals */}
                            <tr className="bg-slate-100 border-t-2 border-slate-800 font-black text-slate-955">
                              <td className="p-2 border border-slate-800 text-left text-[10px] font-sans font-black">CONSOLIDATED SUM ({selectedRows.length} MONTHS)</td>
                              <td className="p-2 border border-slate-800 text-center font-mono font-black">{grandCount}</td>
                              <td className="p-2 border border-slate-800 text-right font-mono font-black text-emerald-950">{grandWeight.toFixed(3)} MT</td>
                              <td className="p-2 border border-slate-800 text-right text-indigo-950 font-black">{avgGrandRate > 0 ? `Rs. ${avgGrandRate.toLocaleString('en-IN')}` : '--'}</td>
                              <td className="p-2 border border-slate-800 text-right text-teal-950 font-black">Rs. {grandCapital.toLocaleString('en-IN')}</td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Verification Checkoff list */}
                <div className="border border-dashed border-gray-300 p-3 rounded-sm leading-relaxed text-[9px] text-gray-400 font-sans mb-10">
                  <span className="font-extrabold text-slate-750 block uppercase mb-1">Dossier Inclusion Verification Checklists</span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <div>✔ Master purchase ledger audit matches detailing metrics.</div>
                    <div>✔ Procurement values aligned with verified broker confirmation notes.</div>
                    <div>✔ Active billing cycles certified individually in pages following.</div>
                    <div>✔ Weight aggregates compiled on structural gross tare weight scales.</div>
                  </div>
                </div>

                {/* Authorizations Signoff block */}
                <div className="pt-6 border-t border-gray-300 flex justify-between items-center font-sans">
                  <div>
                    <div className="h-10"></div>
                    <p className="text-[10px] font-black uppercase text-slate-800">COMPILED BY CHIEF CONTROLLER</p>
                    <p className="text-[8.5px] text-gray-505 italic mt-0.5">Procurement Operations Division</p>
                  </div>
                  <div className="text-right">
                    <div className="h-10"></div>
                    <p className="text-[10px] font-black uppercase text-slate-800">AUTHORIZED EXECUTIVE SIGNATURE</p>
                    <p className="text-[8.5px] text-gray-505 italic mt-0.5">Sourcing & Schedulers Board</p>
                  </div>
                </div>
              </div>

              {/* PAGES 2+: Detailed Individual Monthly Procurement Audits */}
              {selectedMonthsForPrint.map((monthYear, pIdx) => {
                // Parse out target month number and year
                const parts = monthYear.trim().split(/\s+/);
                const mName = parts[0]?.toLowerCase().substring(0, 3) || '';
                const targetMonthNum = MONTH_LABELS.find(m => m.label.toLowerCase().substring(0, 3) === mName)?.value || '';
                const targetYearNum = Number(parts[1]) || 0;

                // Grab matching contract records from poFilteredByPeriod
                const monthlyPos = poFilteredByPeriod.filter(po => {
                  if (!po.po_date) return false;
                  const d = new Date(po.po_date);
                  return (d.getMonth() + 1).toString() === targetMonthNum && d.getFullYear() === targetYearNum;
                });

                // Compute aggregated totals for KPI cards
                const poCount = monthlyPos.length;
                const totalWeight = monthlyPos.reduce((sum, po) => sum + (Number(po.total_contract_mt) || 0), 0);
                const totalValue = monthlyPos.reduce((sum, po) => {
                  const wt = Number(po.total_contract_mt) || 0;
                  const rate = Number(po.b_rate) || 17100;
                  return sum + (wt * rate);
                }, 0);
                const avgBrate = poCount > 0 
                  ? Math.round(monthlyPos.reduce((sum, po) => sum + (Number(po.b_rate) || 0), 0) / (monthlyPos.filter(po => po.b_rate).length || 1)) 
                  : 0;

                return (
                  <div key={monthYear} className="print-page bg-white p-10 max-w-[210mm] mx-auto border border-gray-300 shadow-md print:shadow-none print:border-0 print:p-0 rounded-sm mt-8 print:mt-0">
                    
                    {/* Header bar */}
                    <div className="flex justify-between items-start border-b-2 border-slate-400 pb-3 font-sans">
                      <div>
                        <h2 className="text-md font-extrabold text-slate-900 tracking-tight uppercase">
                          CHAMPDANY FIBRE TRADING LIMITED
                        </h2>
                        <p className="text-[9.5px] text-slate-500 uppercase font-bold tracking-tight mt-0.5">
                          MONTHLY PROCUREMENT AUDIT & DETAILS — {monthYear.toUpperCase()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="border border-slate-400 px-2.5 py-0.5 bg-slate-50 text-[9px] font-bold uppercase text-slate-800 inline-block font-mono">
                          SHEET {pIdx + 2} OF {selectedMonthsForPrint.length + 1}
                        </span>
                      </div>
                    </div>

                    {/* Sourcing KPIs for current Month Sheet */}
                    <div className="grid grid-cols-4 gap-3 my-4 font-sans text-center">
                      <div className="bg-slate-50 border border-slate-300 p-2 rounded-sm">
                        <span className="text-[7.5px] font-extrabold text-slate-450 uppercase tracking-widest block">CONTRACT DEALS</span>
                        <span className="text-sm font-black text-slate-800 block uppercase font-mono mt-0.5">{poCount} POs</span>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-sm">
                        <span className="text-[7.5px] font-extrabold text-emerald-600 block uppercase tracking-widest block">SOURCED TONNAGE</span>
                        <span className="text-sm font-black text-emerald-950 block uppercase font-mono mt-0.5">{totalWeight.toFixed(3)} MT</span>
                      </div>
                      <div className="bg-indigo-50 border border-indigo-200 p-2 rounded-sm">
                        <span className="text-[7.5px] font-extrabold text-indigo-600 block uppercase tracking-widest block">AVG CONTRACT RATE</span>
                        <span className="text-sm font-black text-indigo-950 block uppercase font-mono mt-0.5 font-bold text-indigo-950">Rs. {avgBrate.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-teal-50 border border-teal-200 p-2 rounded-sm border-dashed">
                        <span className="text-[7.5px] font-extrabold text-teal-650 block uppercase tracking-widest block">ESTIMATED CAPITAL</span>
                        <span className="text-sm font-black text-teal-950 block uppercase font-mono mt-0.5 font-bold text-teal-950">Rs. {Math.round(totalValue).toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {/* Table of specific contract matches for the month */}
                    <h4 className="text-[9.5px] font-extrabold text-slate-850 uppercase tracking-wider mb-1.5 font-sans">Granular Contract Registry Log</h4>
                    <div className="border border-slate-300 overflow-hidden mb-6">
                      <table className="w-full text-left text-[9px] border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-800 font-bold uppercase  text-[8.5px] border-b border-slate-300 font-sans">
                            <th className="p-1.5 border-r border-slate-300">PO No & Ref</th>
                            <th className="p-1.5 border-r border-slate-300">PO Date</th>
                            <th className="p-1.5 border-r border-slate-300">Supplier/Merchant</th>
                            <th className="p-1.5 border-r border-slate-300">Broker Reference</th>
                            <th className="p-1.5 border-r border-slate-300">Sourcing Area</th>
                            <th className="p-1.5 border-r border-slate-305 text-right">Mass (MT)</th>
                            <th className="p-1.5 text-right">B-Rate (Rs/Q)</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono text-slate-700">
                          {monthlyPos.map((po, poIdx) => (
                            <tr key={poIdx} className="border-b border-gray-300 hover:bg-slate-50">
                              <td className="p-1.5 font-bold border-r border-gray-300 text-slate-900">{po.po_no}</td>
                              <td className="p-1.5 border-r border-gray-300 whitespace-nowrap">
                                {po.po_date ? po.po_date.substring(0, 10) : '--'}
                              </td>
                              <td className="p-1.5 border-r border-gray-300 font-sans truncate max-w-[130px]" title={po.supplier}>
                                {po.supplier || 'DIRECT'}
                              </td>
                              <td className="p-1.5 border-r border-gray-300 truncate max-w-[100px]" title={po.broker}>
                                {po.broker || 'DIRECT'}
                              </td>
                              <td className="p-1.5 border-r border-gray-300 whitespace-nowrap">{po.area || '--'}</td>
                              <td className="p-1.5 border-r border-gray-300 text-right font-bold text-slate-900">
                                {Number(po.total_contract_mt || 0).toFixed(3)}
                              </td>
                              <td className="p-1.5 text-right font-extrabold text-indigo-950">
                                {Number(po.b_rate || 0).toLocaleString('en-IN')}
                              </td>
                            </tr>
                          ))}
                          {monthlyPos.length === 0 && (
                            <tr>
                              <td colSpan={7} className="text-center p-6 text-gray-400 italic font-sans font-bold">
                                No active PO registration records belong to this month under current active filter schemes.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Signature block of specific Sheet */}
                    <div className="pt-6 border-t border-dashed border-slate-300 flex justify-between items-center font-sans">
                      <div>
                        <div className="h-6"></div>
                        <p className="text-[8.5px] font-black uppercase text-slate-800">PREPARED & LOGGED BY Dispatcher</p>
                        <p className="text-[7.5px] text-gray-500 italic">Central Database Record Stream</p>
                      </div>
                      <div className="text-right">
                        <div className="h-6"></div>
                        <p className="text-[8.5px] font-black uppercase text-slate-800">AUDITED & APPROVED BY</p>
                        <p className="text-[7.5px] text-gray-500 italic">Fibre Procurement Controller</p>
                      </div>
                    </div>

                  </div>
                );
              })}

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
