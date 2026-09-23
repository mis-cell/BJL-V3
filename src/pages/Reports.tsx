import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  Download, 
  Printer, 
  Filter,
  ChevronDown,
  ArrowRight,
  Database,
  Calendar,
  Layers,
  ArrowLeftRight,
  ClipboardList,
  Clock,
  History,
  FileCheck,
  MapPin,
  Globe,
  TrendingUp,
  Scale,
  RefreshCw,
  TrendingDown,
  UserCheck,
  FileSpreadsheet
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  Legend,
  AreaChart,
  Area,
  ComposedChart
} from 'recharts';
import { cn } from '../lib/utils';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import PurchaseOrderSummary from '../components/PurchaseOrderSummary';
import { PercentageWiseAnalyticsSection } from '../components/reports/PercentageWiseAnalyticsSection';
//import PaymentReport from '../components/PaymentReport';
//import TradeReport from '../components/TradeReport';
import { dbModule } from '../services/dbModule';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Map as PigeonMap, Overlay as PigeonOverlayOriginal } from 'pigeon-maps';
const PigeonOverlay = PigeonOverlayOriginal as any;

const voyagerProvider = (x: number, y: number, z: number, dpr?: number) => {
  const s = 'abc'[Math.abs(x + y) % 3];
  return `https://${s}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}${dpr && dpr >= 2 ? '@2x' : ''}.png`;
};

const osmProvider = (x: number, y: number, z: number) => {
  const s = 'abc'[Math.abs(x + y) % 3];
  return `https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
};

// Indian Jute Sourcing hubs and coordinates mapping
const REGION_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'BIHAR': { lat: 25.6112, lng: 85.1214 }, // Patna/Bihar region
  'DAISEE': { lat: 22.9786, lng: 88.4354 }, // Bengalee jute hubs / Kolkata / West Bengal
  'NORTHERN': { lat: 30.7046, lng: 76.7179 }, // Northern hub near Punjab / Haryana / UP border
  'DIRECT SOURCING': { lat: 26.1584, lng: 85.7878 }, // Darbhanga / jute sourcing farm belts
  'KOLKATA': { lat: 22.5726, lng: 88.3639 },
  'WEST BENGAL': { lat: 22.9868, lng: 87.8550 },
  'ASSAM': { lat: 26.2006, lng: 92.9376 }
};

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

const SAUDA_REPORTS = [
  { key: 'r1', name: '1. Monthly Dispatch Summary', description: 'Month-on-month overview of outbound sales weights, packaging volumes, and reference commission rates.' },
  { key: 'r2', name: '2. Broker Sales commission Ledger', description: 'Broker rankings by closed sales volumes, aggregate packet weights, and commissions accruals.' },
  { key: 'r3', name: '3. Buyer Supplier Sales Ledger', description: 'Sales weight distribution across buying entities, and estimated contract gross values.' },
  { key: 'r4', name: '4. Packaging Unit Distribution Audit', description: 'Dispatch distribution ratios by packaging variety (Loose Jute, Packs, Bags, Bales).' },
  { key: 'r5', name: '5. Brand Quality Specific Sales Pricing', description: 'Average reference prices and aggregate quantity dispatches by product fine quality.' },
  { key: 'r6', name: '6. Shipment & Delivery Timelines Audit', description: 'Contract shipment scheduling limits, target delivery timelines, and risk compliance logs.' },
  { key: 'r7', name: '7. Growing Area Performance Summary', description: 'Contract distribution and output metrics mapped against Jute botanical source regions.' },
  { key: 'r8', name: '8. Claims & Penalties Audit Log', description: 'Outstanding packaging brand claims, discrepancy reports, and delays penalties accrued.' },
  { key: 'r9', name: '9. Agency-wide Sales Allocation', description: 'Physical dispatches and sourcing performance breakdown across distinct localized Agencies.' },
  { key: 'r10', name: '10. Lorries Dispatch & Payload Logs', description: 'Outbound lorry vehicle counts, container density specs, and total payload weights.' }
];

function getAreaCoordinates(areaName: string): { lat: number; lng: number } {
  // Handle combined formats politely (e.g. BIHAR - KISHANGAN)
  const cleanName = areaName.includes(' - ') ? areaName.split(' - ')[0] : areaName;
  const norm = cleanName.toUpperCase().trim();
  
  let baseCoords = { lat: 0, lng: 0 };
  let found = false;

  if (REGION_COORDINATES[norm]) {
    baseCoords = { ...REGION_COORDINATES[norm] };
    found = true;
  } else {
    const normFull = areaName.toUpperCase().trim();
    if (REGION_COORDINATES[normFull]) {
      baseCoords = { ...REGION_COORDINATES[normFull] };
      found = true;
    }
  }

  if (found) {
    // If it's a combined name or different from base region name, inject slight deterministic jitter so pins won't overlap
    if (areaName.includes(' - ') || areaName !== cleanName) {
      let hash = 0;
      for (let i = 0; i < areaName.length; i++) {
        hash = areaName.charCodeAt(i) + ((hash << 5) - hash);
      }
      const latOffset = ((Math.abs(hash) % 200) - 100) / 1800; // tiny offset (~5-10km scale max)
      const lngOffset = ((Math.abs(hash >> 3) % 200) - 100) / 1800;
      return { lat: baseCoords.lat + latOffset, lng: baseCoords.lng + lngOffset };
    }
    return baseCoords;
  }

  // Fallback to deterministic LatLng within the prominent Indian Jute Belts (East & Northeast India)
  let hash1 = 0;
  let hash2 = 0;
  const normFull = areaName.toUpperCase().trim();
  for (let i = 0; i < normFull.length; i++) {
    hash1 = normFull.charCodeAt(i) + ((hash1 << 5) - hash1);
    hash2 = normFull.charCodeAt(i) + ((hash2 << 7) - hash2);
  }
  // Map nicely into North/East India Latitude (between 22.0 to 27.5 North) and Longitude (84.0 to 90.0 East)
  const lat = 22.0 + (Math.abs(hash1) % 550) / 100;
  const lng = 84.0 + (Math.abs(hash2) % 600) / 100;
  return { lat, lng };
}

export default function Reports({ onClose, initialReportType }: { onClose?: () => void; initialReportType?: string }) {
  const [reportType, setReportType] = useState<
    'amad' | 'sauda_analyze' | 'po_summary' | 'map_wise_po' | 'data_aggregation' | 'global_analytics' | 'payment_report' | 'trade'
  >(() => {
    if (initialReportType) {
      const clean = initialReportType.toLowerCase().replace('reports:', '').trim();
      if (clean === 'trade_report' || clean === 'trade') return 'trade';
      if (clean === 'sauda_analyze' || clean === 'report1' || clean === 'po_summary' || clean === 'map_wise_po' || clean === 'map_wise' || clean === 'data_aggregation' || clean === 'global_analytics' || clean === 'payment_report' || clean === 'amad') {
        return (clean === 'report1' ? 'sauda_analyze' : clean === 'map_wise' ? 'map_wise_po' : clean) as any;
      }
    }
    return 'sauda_analyze';
  });

  useEffect(() => {
    if (initialReportType) {
      const clean = initialReportType.toLowerCase().replace('reports:', '').trim();
      if (clean === 'trade_report' || clean === 'trade') {
        setReportType('trade');
      } else if (clean === 'sauda_analyze' || clean === 'po_summary' || clean === 'map_wise_po' || clean === 'data_aggregation' || clean === 'global_analytics' || clean === 'payment_report' || clean === 'amad') {
        setReportType(clean as any);
      }
    }
  }, [initialReportType]);

  useEffect(() => {
    const handleTabChange = (e: any) => {
      const tab = e.detail?.tab || e.detail?.reportType;
      if (tab) {
        const clean = String(tab).toLowerCase().replace('reports:', '').trim();
        if (clean === 'trade_report' || clean === 'trade') {
          setReportType('trade');
        } else if (clean === 'sauda_analyze' || clean === 'po_summary' || clean === 'map_wise_po' || clean === 'data_aggregation' || clean === 'global_analytics' || clean === 'payment_report' || clean === 'amad') {
          setReportType(clean as any);
        }
      }
    };
    window.addEventListener('reports-tab-change', handleTabChange);
    return () => window.removeEventListener('reports-tab-change', handleTabChange);
  }, []);
  const [mapMode, setMapMode] = useState<'street' | 'voyager' | 'cyber'>('street');
  const [sourcingGroupMode, setSourcingGroupMode] = useState<'area' | 'agency' | 'both'>('agency');
  const [center, setCenter] = useState<[number, number]>([24.5, 84.5]);
  const [zoom, setZoom] = useState<number>(5.5);
  const [loading, setLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Datasets
  const [globalStats, setGlobalStats] = useState<Record<string, number>>({});
  const [amadData, setAmadData] = useState<any[]>([]);
  const [saudaData, setSaudaData] = useState<any[]>([]);
  const [poData, setPoData] = useState<any[]>([]);
  const [poDetails, setPoDetails] = useState<any[]>([]);
  const [agencyList, setAgencyList] = useState<any[]>([]);
  const [gradeList, setGradeList] = useState<any[]>([]);
  const [saudaDetails, setSaudaDetails] = useState<any[]>([]);
  const [finalArrivalData, setFinalArrivalData] = useState<any[]>([]);
  const [inspectionData, setInspectionData] = useState<any[]>([]);
  const [deductionData, setDeductionData] = useState<any[]>([]);
  const [paymentData, setPaymentData] = useState<any[]>([]);
  const [scpData, setScpData] = useState<any[]>([]);

  // Advanced Sauda Report Engine State
  const [saudaViewMode, setSaudaViewMode] = useState<'percentage_analytics' | 'dashboard' | 'advanced_reports'>('percentage_analytics');
  const [activeSaudaReportKey, setActiveSaudaReportKey] = useState<string>('r1');
  const [saudaReportMonth, setSaudaReportMonth] = useState<string>('ALL');
  const [saudaReportYear, setSaudaReportYear] = useState<string>('ALL');
  const [saudaReportSearch, setSaudaReportSearch] = useState<string>('');

  // Filter States - Amad
  const [amadStart, setAmadStart] = useState('');
  const [amadEnd, setAmadEnd] = useState('');
  const [amadSearch, setAmadSearch] = useState('');

  // Filter States - Sauda
  const [saudaSearch, setSaudaSearch] = useState('');
  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());

  const MONTHS = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  const monthlySaudaList = useMemo(() => {
    return saudaData.filter(item => {
      if (!item.date) return false;
      const d = new Date(item.date);
      return (d.getMonth() + 1) === reportMonth && d.getFullYear() === reportYear;
    });
  }, [saudaData, reportMonth, reportYear]);

  const monthlySaudaAggregates = useMemo(() => {
    let count = monthlySaudaList.length;
    let totalWeight = 0;
    let totalUnits = 0;
    let sumRate = 0;
    let rateCount = 0;

    monthlySaudaList.forEach(s => {
      totalWeight += Number(s.total_wt_in_ton) || 0;
      totalUnits += Number(s.total_unit) || 0;
      if (s.b_rate) {
        sumRate += Number(s.b_rate);
        rateCount++;
      }
    });

    return {
      count,
      totalWeight: parseFloat(totalWeight.toFixed(3)),
      totalUnits,
      avgRate: rateCount > 0 ? parseFloat((sumRate / rateCount).toFixed(2)) : 0
    };
  }, [monthlySaudaList]);

  const handleDownloadPdf = () => {
    if (monthlySaudaList.length === 0) return;

    try {
      const doc = new jsPDF();
      
      const monthLabel = MONTHS.find(m => m.value === reportMonth)?.label || 'Report';
      const yearLabel = reportYear;

      // Draw elegant branding header
      doc.setFillColor(30, 41, 59); // deep slate
      doc.rect(0, 0, 210, 38, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("MILL SAUDA ASSOCIATES", 15, 16);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Monthly Sauda Contract Summary: ${monthLabel.toUpperCase()} - ${yearLabel}`, 15, 23);
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`, 15, 29);

      // KPIs container background
      doc.setFillColor(241, 245, 249);
      doc.rect(15, 45, 180, 24, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(15, 45, 180, 24, 'S');

      doc.setTextColor(15, 23, 42); // slate-900
      
      // KPI 1: CONTRACTS
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("TOTAL CONTRACTS", 20, 52);
      doc.setFontSize(12);
      doc.text(`${monthlySaudaAggregates.count}`, 20, 61);

      // KPI 2: TOTAL WEIGHT
      doc.setFontSize(8);
      doc.text("AGGREGATE MASS (MT)", 65, 52);
      doc.setFontSize(12);
      doc.text(`${monthlySaudaAggregates.totalWeight.toLocaleString()} MT`, 65, 61);

      // KPI 3: TOTAL UNITS
      doc.setFontSize(8);
      doc.text("TOTAL UNITS (BALES)", 115, 52);
      doc.setFontSize(12);
      doc.text(`${monthlySaudaAggregates.totalUnits.toLocaleString()}`, 115, 61);

      // KPI 4: AVERAGE RATE
      doc.setFontSize(8);
      doc.text("AVG B_RATE (PER QTL)", 155, 52);
      doc.setFontSize(12);
      doc.text(`INR ${monthlySaudaAggregates.avgRate.toLocaleString()}`, 155, 61);

      // Table Headers and data rows
      const headers = [['DATE', 'SAUDA NO', 'SUPPLIER NAME', 'BROKER NAME', 'SOURCING AREA', 'UNIT QTY', 'RATE (QTL)', 'NET MASS (MT)']];
      const rows = monthlySaudaList.map(item => [
        item.date ? new Date(item.date).toLocaleDateString('en-GB') : 'N/A',
        `#${item.sauda_no || 'N/A'}`,
        item.supplier || 'DIRECT',
        item.broker || 'DIRECT',
        item.area || 'N/A',
        `${item.total_unit || 0} ${item.unit_type || 'BALES'}`,
        item.b_rate ? `Rs ${Number(item.b_rate).toFixed(2)}` : '--',
        `${(Number(item.total_wt_in_ton) || 0).toFixed(3)} MT`
      ]);

      // jspdf-autotable injection
      autoTable(doc, {
        startY: 76,
        head: headers,
        body: rows,
        theme: 'striped',
        styles: {
          fontSize: 8.5,
          font: 'helvetica',
          textColor: [51, 65, 85],
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [13, 148, 136], // teal-600 to visually match Sauda color scheme
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 38 },
          3: { cellWidth: 34 },
          4: { cellWidth: 25, halign: 'center' },
          5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 22, halign: 'right' },
          7: { cellWidth: 24, halign: 'right' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        margin: { left: 15, right: 15 },
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            data.settings.margin.left,
            doc.internal.pageSize.height - 10
          );
          doc.text(
            "Mill PO Automation System - All Rights Reserved",
            doc.internal.pageSize.width - data.settings.margin.right - 70,
            doc.internal.pageSize.height - 10
          );
        }
      });

      doc.save(`Sauda_Monthly_Report_${monthLabel}_${yearLabel}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
      alert("Error generating PDF: " + (error as Error).message);
    }
  };

  // Map wise PO selections
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  // --- GENERAL PO & SAUDA HISTORICAL AGGREGATION ENGINE ---
  const [activeAggReportKey, setActiveAggReportKey] = useState<string>('monthly_po_summary');
  const [aggSearchTerm, setAggSearchTerm] = useState<string>('');

  const computedAggReport = useMemo(() => {
    let headers: string[] = [];
    let rows: string[][] = [];
    let summary: string = "";

    switch (activeAggReportKey) {
      case 'monthly_po_summary': {
        headers = ["Month-Year", "Total Contract Count", "Total Contract Volume (MT)", "Avg Contract Weight (MT)", "Total Est. Units", "Unique Suppliers", "Unique Brokers"];
        
        const groups: Record<string, { key: string; count: number; weight: number; units: number; suppliers: Set<string>; brokers: Set<string> }> = {};
        
        poData.forEach(p => {
          if (!p.po_date) return;
          const d = new Date(p.po_date);
          if (isNaN(d.getTime())) return;
          const mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const label = `${mNames[d.getMonth()]} ${d.getFullYear()}`;
          const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          
          if (!groups[sortKey]) {
            groups[sortKey] = { key: label, count: 0, weight: 0, units: 0, suppliers: new Set(), brokers: new Set() };
          }
          
          const grp = groups[sortKey];
          grp.count++;
          
          let wt = 0;
          const details = poDetails.filter(dt => dt.po_no === p.po_no);
          if (details.length > 0) {
            wt = details.reduce((sum, dLine) => sum + (Number(dLine.weight_mt) || Number(dLine.weight) || 0), 0);
          }
          if (wt === 0) wt = Number(p.total_contract_mt) || 0;
          if (wt === 0) {
            const unitsVal = Number(p.total_units) || (Number(p.total_lorries) * Number(p.units_per_lorry)) || 0;
            wt = (unitsVal * (Number(p.weight_unit_kgs) || 50)) / 1000;
          }
          grp.weight += wt;
          grp.units += Number(p.total_units) || 0;
          if (p.supplier) grp.suppliers.add(p.supplier.trim().toUpperCase());
          if (p.broker) grp.brokers.add(p.broker.trim().toUpperCase());
        });
        
        const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
        rows = sortedKeys.map(k => {
          const g = groups[k];
          return [
            g.key,
            g.count.toString(),
            g.weight.toFixed(2),
            g.count > 0 ? (g.weight / g.count).toFixed(2) : "0.00",
            g.units.toString(),
            g.suppliers.size.toString(),
            g.brokers.size.toString()
          ];
        });
        
        const totWeight = Object.values(groups).reduce((s, g) => s + g.weight, 0);
        summary = `Analyzed ${poData.length} total purchase contracts across ${sortedKeys.length} historical months. Global Volume: ${totWeight.toFixed(2)} MT.`;
        break;
      }
      
      case 'yearly_po_summary': {
        headers = ["Financial Year", "Total Contracts Owned", "Total Sourced Weight (MT)", "Avg Contract Weight (MT)", "Total Units", "Unique Suppliers Count", "Unique Brokers Count"];
        
        const groups: Record<string, { key: string; count: number; weight: number; units: number; suppliers: Set<string>; brokers: Set<string> }> = {};
        
        poData.forEach(p => {
          let finYear = p.financial_year || '';
          if (!finYear && p.po_date) {
            const yr = new Date(p.po_date).getFullYear();
            finYear = `${yr}-${yr + 1}`;
          }
          if (!finYear) finYear = "Historical/Unassigned";
          
          if (!groups[finYear]) {
            groups[finYear] = { key: finYear, count: 0, weight: 0, units: 0, suppliers: new Set(), brokers: new Set() };
          }
          
          const grp = groups[finYear];
          grp.count++;
          
          let wt = 0;
          const details = poDetails.filter(dt => dt.po_no === p.po_no);
          if (details.length > 0) {
            wt = details.reduce((sum, dLine) => sum + (Number(dLine.weight_mt) || Number(dLine.weight) || 0), 0);
          }
          if (wt === 0) wt = Number(p.total_contract_mt) || 0;
          if (wt === 0) {
            const unitsVal = Number(p.total_units) || (Number(p.total_lorries) * Number(p.units_per_lorry)) || 0;
            wt = (unitsVal * (Number(p.weight_unit_kgs) || 50)) / 1000;
          }
          grp.weight += wt;
          grp.units += Number(p.total_units) || 0;
          if (p.supplier) grp.suppliers.add(p.supplier.trim().toUpperCase());
          if (p.broker) grp.brokers.add(p.broker.trim().toUpperCase());
        });
        
        const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
        rows = sortedKeys.map(k => {
          const g = groups[k];
          return [
            g.key,
            g.count.toString(),
            g.weight.toFixed(2),
            g.count > 0 ? (g.weight / g.count).toFixed(2) : "0.00",
            g.units.toString(),
            g.suppliers.size.toString(),
            g.brokers.size.toString()
          ];
        });
        
        const totWeight = Object.values(groups).reduce((s, g) => s + g.weight, 0);
        summary = `Sourced ${poData.length} records. Total Contract Volume: ${totWeight.toFixed(2)} MT across ${sortedKeys.length} financial years.`;
        break;
      }
      
      case 'monthly_sauda_summary': {
        headers = ["Month-Year", "Total Sauda Contracts", "Total Weight (MT)", "Total Lorries Allocated", "Total Sauda Value (Rs.)", "Avg Rate (Rs./MT)", "Unique Brokers", "Unique Suppliers"];
        
        const groups: Record<string, { key: string; count: number; weight: number; lorries: number; value: number; suppliers: Set<string>; brokers: Set<string> }> = {};
        
        saudaData.forEach(s => {
          if (!s.date) return;
          const d = new Date(s.date);
          if (isNaN(d.getTime())) return;
          const mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const label = `${mNames[d.getMonth()]} ${d.getFullYear()}`;
          const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          
          if (!groups[sortKey]) {
            groups[sortKey] = { key: label, count: 0, weight: 0, lorries: 0, value: 0, suppliers: new Set(), brokers: new Set() };
          }
          
          const grp = groups[sortKey];
          grp.count++;
          grp.weight += Number(s.total_wt_in_ton) || 0;
          grp.lorries += Number(s.no_of_lorries) || Number(s.total_lorry) || 0;
          grp.value += Number(s.total_value) || (Number(s.b_rate) * Number(s.total_wt_in_ton) * 10) || 0;
          
          if (s.supplier) grp.suppliers.add(s.supplier.trim().toUpperCase());
          if (s.broker) grp.brokers.add(s.broker.trim().toUpperCase());
        });
        
        const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
        rows = sortedKeys.map(k => {
          const g = groups[k];
          return [
            g.key,
            g.count.toString(),
            g.weight.toFixed(2),
            g.lorries.toString(),
            Math.round(g.value).toLocaleString('en-IN'),
            g.weight > 0 ? Math.round(g.value / g.weight).toString() : "0",
            g.brokers.size.toString(),
            g.suppliers.size.toString()
          ];
        });
        
        const totWeight = Object.values(groups).reduce((s, g) => s + g.weight, 0);
        summary = `Analyzed ${saudaData.length} Sauda dispatches. Global Traded Volume: ${totWeight.toFixed(2)} MT across ${sortedKeys.length} months.`;
        break;
      }
      
      case 'yearly_sauda_summary': {
        headers = ["Financial Year", "Total Sauda Contracts", "Total Weight Sold (MT)", "Total Lorries Used", "Total Sauda Value (Rs.)", "Avg Rate (Rs./MT)", "Unique Brokers", "Unique Suppliers"];
        
        const groups: Record<string, { key: string; count: number; weight: number; lorries: number; value: number; suppliers: Set<string>; brokers: Set<string> }> = {};
        
        saudaData.forEach(s => {
          let finYear = s.financial_year || '';
          if (!finYear && s.date) {
            const yr = new Date(s.date).getFullYear();
            finYear = `${yr}-${yr + 1}`;
          }
          if (!finYear) finYear = "Historical/Unassigned";
          
          if (!groups[finYear]) {
            groups[finYear] = { key: finYear, count: 0, weight: 0, lorries: 0, value: 0, suppliers: new Set(), brokers: new Set() };
          }
          
          const grp = groups[finYear];
          grp.count++;
          grp.weight += Number(s.total_wt_in_ton) || 0;
          grp.lorries += Number(s.no_of_lorries) || Number(s.total_lorry) || 0;
          grp.value += Number(s.total_value) || (Number(s.b_rate) * Number(s.total_wt_in_ton) * 10) || 0;
          
          if (s.supplier) grp.suppliers.add(s.supplier.trim().toUpperCase());
          if (s.broker) grp.brokers.add(s.broker.trim().toUpperCase());
        });
        
        const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
        rows = sortedKeys.map(k => {
          const g = groups[k];
          return [
            g.key,
            g.count.toString(),
            g.weight.toFixed(2),
            g.lorries.toString(),
            Math.round(g.value).toLocaleString('en-IN'),
            g.weight > 0 ? Math.round(g.value / g.weight).toString() : "0",
            g.brokers.size.toString(),
            g.suppliers.size.toString()
          ];
        });
        
        const totWeight = Object.values(groups).reduce((s, g) => s + g.weight, 0);
        summary = `Sourced ${saudaData.length} records. Total Sauda Weight: ${totWeight.toFixed(2)} MT across ${sortedKeys.length} financial master years.`;
        break;
      }
      
      case 'po_broker_distribution': {
        headers = ["Broker Name", "Total Purchase Orders", "Total Sourced Tons (MT)", "Avg Lease Size (MT)", "Percentage Share (%)"];
        
        const groups: Record<string, { count: number; weight: number }> = {};
        let grandTotalWt = 0;
        
        poData.forEach(p => {
          const bName = (p.broker || 'DIRECT / UNASSIGNED').trim().toUpperCase();
          if (!groups[bName]) groups[bName] = { count: 0, weight: 0 };
          
          let wt = 0;
          const details = poDetails.filter(dt => dt.po_no === p.po_no);
          if (details.length > 0) {
            wt = details.reduce((sum, dLine) => sum + (Number(dLine.weight_mt) || Number(dLine.weight) || 0), 0);
          }
          if (wt === 0) wt = Number(p.total_contract_mt) || 0;
          if (wt === 0) {
            const unitsVal = Number(p.total_units) || (Number(p.total_lorries) * Number(p.units_per_lorry)) || 0;
            wt = (unitsVal * (Number(p.weight_unit_kgs) || 50)) / 1000;
          }
          groups[bName].count++;
          groups[bName].weight += wt;
          grandTotalWt += wt;
        });
        
        rows = Object.keys(groups)
          .map(b => {
            const g = groups[b];
            return [
              b,
              g.count.toString(),
              g.weight.toFixed(2),
              g.count > 0 ? (g.weight / g.count).toFixed(2) : "0.00",
              grandTotalWt > 0 ? ((g.weight / grandTotalWt) * 100).toFixed(1) + "%" : "0.0%"
            ];
          })
          .sort((a, b) => Number(b[2]) - Number(a[2]));
        
        summary = `Sourced volume split across ${rows.length} unique active PO brokers.`;
        break;
      }

      case 'po_supplier_distribution': {
        headers = ["Supplier Name", "Total Purchase Orders", "Total Sourced Tons (MT)", "Avg Tons per Order", "Percentage Share (%)"];
        
        const groups: Record<string, { count: number; weight: number }> = {};
        let grandTotalWt = 0;
        
        poData.forEach(p => {
          const sName = (p.supplier || 'DIRECT / UNASSIGNED').trim().toUpperCase();
          if (!groups[sName]) groups[sName] = { count: 0, weight: 0 };
          
          let wt = 0;
          const details = poDetails.filter(dt => dt.po_no === p.po_no);
          if (details.length > 0) {
            wt = details.reduce((sum, dLine) => sum + (Number(dLine.weight_mt) || Number(dLine.weight) || 0), 0);
          }
          if (wt === 0) wt = Number(p.total_contract_mt) || 0;
          if (wt === 0) {
            const unitsVal = Number(p.total_units) || (Number(p.total_lorries) * Number(p.units_per_lorry)) || 0;
            wt = (unitsVal * (Number(p.weight_unit_kgs) || 50)) / 1000;
          }
          groups[sName].count++;
          groups[sName].weight += wt;
          grandTotalWt += wt;
        });
        
        rows = Object.keys(groups)
          .map(s => {
            const g = groups[s];
            return [
              s,
              g.count.toString(),
              g.weight.toFixed(2),
              g.count > 0 ? (g.weight / g.count).toFixed(2) : "0.00",
              grandTotalWt > 0 ? ((g.weight / grandTotalWt) * 100).toFixed(1) + "%" : "0.0%"
            ];
          })
          .sort((a, b) => Number(b[2]) - Number(a[2]));
        
        summary = `PO sourcing split across ${rows.length} unique active suppliers.`;
        break;
      }

      case 'sauda_broker_distribution': {
        headers = ["Broker Name", "Total Sauda Contracts", "Total Weight Traded (MT)", "Total Value (Rs.)", "Avg Rate (Rs./MT)", "Percentage Share (%)"];
        
        const groups: Record<string, { count: number; weight: number; value: number }> = {};
        let grandTotalWt = 0;
        
        saudaData.forEach(s => {
          const bName = (s.broker || 'DIRECT / UNASSIGNED').trim().toUpperCase();
          if (!groups[bName]) groups[bName] = { count: 0, weight: 0, value: 0 };
          
          const wt = Number(s.total_wt_in_ton) || 0;
          const val = Number(s.total_value) || (Number(s.b_rate) * Number(s.total_wt_in_ton) * 10) || 0;
          
          groups[bName].count++;
          groups[bName].weight += wt;
          groups[bName].value += val;
          grandTotalWt += wt;
        });
        
        rows = Object.keys(groups)
          .map(b => {
            const g = groups[b];
            return [
              b,
              g.count.toString(),
              g.weight.toFixed(2),
              Math.round(g.value).toLocaleString('en-IN'),
              g.weight > 0 ? Math.round(g.value / g.weight).toString() : "0",
              grandTotalWt > 0 ? ((g.weight / grandTotalWt) * 100).toFixed(1) + "%" : "0.0%"
            ];
          })
          .sort((a, b) => Number(b[2]) - Number(a[2]));
        
        summary = `Sauda outbound volumes handled by ${rows.length} specialized brokers.`;
        break;
      }

      case 'sauda_supplier_distribution': {
        headers = ["Supplier Name", "Total Sauda Contracts", "Total Weight Traded (MT)", "Total Value (Rs.)", "Avg Rate (Rs./MT)", "Percentage Share (%)"];
        
        const groups: Record<string, { count: number; weight: number; value: number }> = {};
        let grandTotalWt = 0;
        
        saudaData.forEach(s => {
          const sName = (s.supplier || 'DIRECT / UNASSIGNED').trim().toUpperCase();
          if (!groups[sName]) groups[sName] = { count: 0, weight: 0, value: 0 };
          
          const wt = Number(s.total_wt_in_ton) || 0;
          const val = Number(s.total_value) || (Number(s.b_rate) * Number(s.total_wt_in_ton) * 10) || 0;
          
          groups[sName].count++;
          groups[sName].weight += wt;
          groups[sName].value += val;
          grandTotalWt += wt;
        });
        
        rows = Object.keys(groups)
          .map(s => {
            const g = groups[s];
            return [
              s,
              g.count.toString(),
              g.weight.toFixed(2),
              Math.round(g.value).toLocaleString('en-IN'),
              g.weight > 0 ? Math.round(g.value / g.weight).toString() : "0",
              grandTotalWt > 0 ? ((g.weight / grandTotalWt) * 100).toFixed(1) + "%" : "0.0%"
            ];
          })
          .sort((a, b) => Number(b[2]) - Number(a[2]));
        
        summary = `Sauda order split across ${rows.length} buyer suppliers.`;
        break;
      }

      case 'po_area_sourcing': {
        headers = ["Sourcing Area / Region", "Total Contracts", "Total Contract Volume (MT)", "Avg Contract MT", "Unique Active Brokers"];
        
        const groups: Record<string, { count: number; weight: number; brokers: Set<string> }> = {};
        
        poData.forEach(p => {
          const area = (p.area || 'DIRECT SOURCING').trim().toUpperCase();
          if (!groups[area]) groups[area] = { count: 0, weight: 0, brokers: new Set() };
          
          let wt = 0;
          const details = poDetails.filter(dt => dt.po_no === p.po_no);
          if (details.length > 0) {
            wt = details.reduce((sum, dLine) => sum + (Number(dLine.weight_mt) || Number(dLine.weight) || 0), 0);
          }
          if (wt === 0) wt = Number(p.total_contract_mt) || 0;
          if (wt === 0) {
            const unitsVal = Number(p.total_units) || (Number(p.total_lorries) * Number(p.units_per_lorry)) || 0;
            wt = (unitsVal * (Number(p.weight_unit_kgs) || 50)) / 1000;
          }
          groups[area].count++;
          groups[area].weight += wt;
          if (p.broker) groups[area].brokers.add(p.broker.trim().toUpperCase());
        });
        
        rows = Object.keys(groups)
          .map(ar => {
            const g = groups[ar];
            return [
              ar,
              g.count.toString(),
              g.weight.toFixed(2),
              g.count > 0 ? (g.weight / g.count).toFixed(2) : "0.00",
              g.brokers.size.toString()
            ];
          })
          .sort((a, b) => Number(b[2]) - Number(a[2]));
        
        summary = `Sourcing distributions and regional yields across ${rows.length} stations.`;
        break;
      }

      case 'sauda_transport_logistics': {
        headers = ["Month-Year", "Total Truck Dispatches", "Total Volume Sold (MT)", "Avg Load/Truck (MT)", "Total Value Settle (Rs.)"];
        
        const groups: Record<string, { count: number; weight: number; value: number; lorries: number }> = {};
        
        saudaData.forEach(s => {
          if (!s.date) return;
          const d = new Date(s.date);
          if (isNaN(d.getTime())) return;
          const mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const label = `${mNames[d.getMonth()]} ${d.getFullYear()}`;
          const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          
          if (!groups[sortKey]) {
            groups[sortKey] = { count: 0, weight: 0, value: 0, lorries: 0 };
          }
          
          const grp = groups[sortKey];
          grp.count++;
          grp.weight += Number(s.total_wt_in_ton) || 0;
          grp.lorries += Number(s.no_of_lorries) || Number(s.total_lorry) || 0;
          grp.value += Number(s.total_value) || (Number(s.b_rate) * Number(s.total_wt_in_ton) * 10) || 0;
        });
        
        const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
        rows = sortedKeys.map(k => {
          const g = groups[k];
          const mName = k.split('-')[1];
          const yearStr = k.split('-')[0];
          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const label = `${monthNames[parseInt(mName) - 1]} ${yearStr}`;
          
          return [
            label,
            g.lorries.toString(),
            g.weight.toFixed(2),
            g.lorries > 0 ? (g.weight / g.lorries).toFixed(2) : "0.00",
            Math.round(g.value).toLocaleString('en-IN')
          ];
        });
        
        summary = `Historical logistics and fleet capacity audit covering ${rows.length} months.`;
        break;
      }
    }

    if (aggSearchTerm.trim() !== '') {
      const term = aggSearchTerm.toLowerCase();
      rows = rows.filter(row => {
        return row.some(cell => cell.toLowerCase().includes(term));
      });
    }

    return { headers, rows, summary };
  }, [activeAggReportKey, poData, saudaData, poDetails, aggSearchTerm]);

  const handleExportAggCSV = () => {
    const reportName = activeAggReportKey.toUpperCase().replace(/\s+/g, '_');
    const filename = `Historical_Aggregation_${reportName}.csv`;
    const headersStr = computedAggReport.headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
    const rowsStr = computedAggReport.rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','));
    const csvContent = [headersStr, ...rowsStr].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [amad, saudas, pos, details, agencies, grades, sDetails, finalArrivals, inspections, deductions, payments, scp, payMaster] = await Promise.all([
        dbModule.fetchAll('temporary_material_received').catch(() => []),
        dbModule.fetchAll('sauda_master').catch(() => []),
        dbModule.fetchAll('purchase_master').catch(() => []),
        dbModule.fetchAll('purchase_detail_master').catch(() => []),
        dbModule.fetchAll('agency_master').catch(() => []),
        dbModule.fetchAll('grade_master').catch(() => []),
        dbModule.fetchAll('sauda_quality_details').catch(() => []),
        dbModule.fetchAll('final_arrival').catch(() => []),
        dbModule.fetchAll('material_inspection').catch(() => []),
        dbModule.fetchAll('material_inspection_deductions').catch(() => []),
        dbModule.fetchAll('payment_records').catch(() => []),
        dbModule.fetchAll('sauda_check_point').catch(() => []),
        dbModule.fetchAll('payment_master').catch(() => [])
      ]);
      
      const parseDateMs = (val: any) => {
        if (!val) return 0;
        const d = new Date(val);
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };

      // Sort datasets descending by date/created_at
      const sortedAmad = [...(amad || [])]
        .map((item: any) => {
          const tempNo = item.temporary_arrival_no || item.amad_no || item.arrival_no || item.mr_no || (item.amad_id ? String(item.amad_id).slice(0, 8) : '');
          return {
            ...item,
            temporary_arrival_no: tempNo,
            amad_no: tempNo
          };
        })
        .sort((a,b) => parseDateMs(b.date || b.created_at) - parseDateMs(a.date || a.created_at));
      const sortedSauda = [...(saudas || [])].sort((a,b) => parseDateMs(b.date || b.created_at) - parseDateMs(a.date || a.created_at));
      const sortedPo = [...(pos || [])].sort((a,b) => parseDateMs(b.po_date || b.created_at) - parseDateMs(a.po_date || a.created_at));

      setAmadData(sortedAmad);
      setSaudaData(sortedSauda);
      setPoData(sortedPo);
      setPoDetails(details || []);
      setAgencyList(agencies || []);
      setGradeList(grades || []);
      setSaudaDetails(sDetails || []);
      setFinalArrivalData(finalArrivals || []);
      setInspectionData(inspections || []);
      setDeductionData(deductions || []);
      setPaymentData([...(payments || []), ...(payMaster || [])]);
      setScpData(scp || []);

      // Fetch global stats
      try {
         const tablesToCount = [
           'user_master',
           'sauda_master',
           'purchase_master',
           'temporary_material_received',
           'final_arrival',
           'material_inspection',
           'mill_issue_master',
           'requisitions',
           'department_master',
           'godown_master'
         ];
         const counts: Record<string, number> = {};
         await Promise.all(tablesToCount.map(async (table) => {
           try {
             const data = await dbModule.fetchAll(table);
             counts[table] = data ? data.length : 0;
           } catch(e) {
             counts[table] = 0;
           }
         }));
         setGlobalStats(counts);
      } catch (err) {}

      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error("Error loading reports data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (areaGroupedPo.length > 0) {
      setSelectedArea(areaGroupedPo[0].name);
    } else {
      setSelectedArea(null);
    }
  }, [sourcingGroupMode]);

  // --- ADVANCED MONTH-WISE & YEAR-WISE SAUDA REPORTS ENGINE ---

  const saudaYears = useMemo(() => {
    const yrs = new Set<string>();
    saudaData.forEach(item => {
      if (item.financial_year) yrs.add(item.financial_year);
      if (item.date) {
        const cal = new Date(item.date).getFullYear().toString();
        yrs.add(cal);
      }
    });
    return Array.from(yrs).sort();
  }, [saudaData]);

  // Filter core Sauda master lists for Advanced Reports
  const saudaFilteredByPeriod = useMemo(() => {
    return saudaData.filter(item => {
      if (!item.date) return false;
      const d = new Date(item.date);
      const m = d.getMonth() + 1;
      const yr = d.getFullYear();
      
      // Month selector check
      if (saudaReportMonth !== 'ALL' && m.toString() !== saudaReportMonth) {
        return false;
      }
      
      // Year / Financial Year check
      if (saudaReportYear !== 'ALL') {
        if (item.financial_year !== saudaReportYear && yr.toString() !== saudaReportYear) {
          return false;
        }
      }
      
      // Keyword filter check
      if (saudaReportSearch.trim()) {
        const trm = saudaReportSearch.toLowerCase();
        const matches = 
          (item.sauda_no || '').toLowerCase().includes(trm) ||
          (item.supplier || '').toLowerCase().includes(trm) ||
          (item.broker || '').toLowerCase().includes(trm) ||
          (item.area || '').toLowerCase().includes(trm) ||
          (item.agency || '').toLowerCase().includes(trm);
        if (!matches) return false;
      }
      
      return true;
    });
  }, [saudaData, saudaReportMonth, saudaReportYear, saudaReportSearch]);

  // Join Sauda Details for the filtered matches
  const filteredSaudaDetails = useMemo(() => {
    const saudaIds = new Set(saudaFilteredByPeriod.map(s => s.sauda_id));
    return saudaDetails.filter(d => d.sauda_id && saudaIds.has(d.sauda_id));
  }, [saudaDetails, saudaFilteredByPeriod]);

  // Calculate specialized reports dataset for Sauda (r1 - r10)
  const saudaReportOutput = useMemo(() => {
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

    const colors = ['#1e3a8a', '#0f766e', '#312e81', '#0891b2', '#4f46e5', '#1d4ed8', '#0d9488', '#2563eb'];

    if (activeSaudaReportKey === 'r1') {
      // 1. Monthly Dispatch Summary
      const monthMap: Record<string, { monthYear: string; count: number; weight: number; sumRate: number; rateCount: number; sumUnits: number }> = {};
      saudaFilteredByPeriod.forEach(s => {
        if (!s.date) return;
        const d = new Date(s.date);
        const mLabel = d.toLocaleString('default', { month: 'short' });
        const yr = d.getFullYear();
        const key = `${mLabel} ${yr}`;
        if (!monthMap[key]) {
          monthMap[key] = { monthYear: key, count: 0, weight: 0, sumRate: 0, rateCount: 0, sumUnits: 0 };
        }
        monthMap[key].count++;
        monthMap[key].weight += Number(s.total_wt_in_ton) || 0;
        monthMap[key].sumUnits += Number(s.total_unit) || 0;
        if (s.b_rate) {
          monthMap[key].sumRate += Number(s.b_rate);
          monthMap[key].rateCount++;
        }
      });

      result.headers = ['MONTH / YEAR', 'DEALS COUNT', 'DISPATCHED PACKETS', 'TOTAL WEIGHED MASS (MT)', 'AVG PRICE RATE / QL', 'EST SALES VAL (INR)'];
      result.chartData = Object.values(monthMap).map(m => {
        const avg = m.rateCount > 0 ? Math.round(m.sumRate / m.rateCount) : 18500;
        const estValue = m.weight * avg;
        return {
          name: m.monthYear,
          weight: parseFloat(m.weight.toFixed(3)),
          value: parseFloat(m.weight.toFixed(3)),
          averageRate: avg,
          estimatedValue: parseFloat(estValue.toFixed(2))
        };
      });
      result.rows = Object.values(monthMap).map(m => {
        const avg = m.rateCount > 0 ? Math.round(m.sumRate / m.rateCount) : 18500;
        const val = m.weight * avg;
        return [
          m.monthYear,
          m.count.toString(),
          m.sumUnits.toLocaleString(),
          m.weight.toFixed(3),
          `Rs. ${avg.toLocaleString('en-IN')}`,
          `Rs. ${Math.round(val).toLocaleString('en-IN')}`
        ];
      });
      result.chartType = 'area';
    } 
    else if (activeSaudaReportKey === 'r2') {
      // 2. Broker Sales Commission Ledger
      const brokerMap: Record<string, { broker: string; count: number; weight: number; sumRate: number; rateCount: number; sumUnits: number }> = {};
      saudaFilteredByPeriod.forEach(s => {
        const name = s.broker ? s.broker.trim().toUpperCase() : 'DIRECT';
        if (!brokerMap[name]) {
          brokerMap[name] = { broker: name, count: 0, weight: 0, sumRate: 0, rateCount: 0, sumUnits: 0 };
        }
        brokerMap[name].count++;
        brokerMap[name].weight += Number(s.total_wt_in_ton) || 0;
        brokerMap[name].sumUnits += Number(s.total_unit) || 0;
        if (s.b_rate) {
          brokerMap[name].sumRate += Number(s.b_rate);
          brokerMap[name].rateCount++;
        }
      });

      result.headers = ['BROKER NAME', 'SALES CLOSED', 'TOTAL TONNES (MT)', 'TOTAL PACKETS', 'AVG VALUE PRICE', 'EST COMMISSIONS (INR)'];
      result.chartData = Object.values(brokerMap).map(b => ({
        name: b.broker,
        weight: parseFloat(b.weight.toFixed(3)),
        value: parseFloat(b.weight.toFixed(3))
      })).sort((a,b) => b.value - a.value).slice(0, 8);

      result.rows = Object.values(brokerMap).map(b => {
        const avg = b.rateCount > 0 ? Math.round(b.sumRate / b.rateCount) : 18500;
        const commissionsEst = b.weight * 120;
        return [
          b.broker,
          b.count.toString(),
          b.weight.toFixed(3),
          b.sumUnits.toLocaleString(),
          `Rs. ${avg.toLocaleString('en-IN')}`,
          `Rs. ${Math.round(commissionsEst).toLocaleString('en-IN')}`
        ];
      });
      result.chartType = 'bar';
    }
    else if (activeSaudaReportKey === 'r3') {
      // 3. Supplier Sales Allocation Ledger
      const supMap: Record<string, { supplier: string; count: number; weight: number; sumUnits: number; sumRate: number; rateCount: number }> = {};
      saudaFilteredByPeriod.forEach(s => {
        const name = s.supplier ? s.supplier.trim().toUpperCase() : 'DIRECT';
        if (!supMap[name]) {
          supMap[name] = { supplier: name, count: 0, weight: 0, sumUnits: 0, sumRate: 0, rateCount: 0 };
        }
        supMap[name].count++;
        supMap[name].weight += Number(s.total_wt_in_ton) || 0;
        supMap[name].sumUnits += Number(s.total_unit) || 0;
        if (s.b_rate) {
          supMap[name].sumRate += Number(s.b_rate);
          supMap[name].rateCount++;
        }
      });

      result.headers = ['BUYER / PARTY NAME', 'SAUDAS COMPLETED', 'TOTAL DISPATCH WT (MT)', 'TOTAL PACKETS', 'AVG SELLING PRICE', 'EST COVENANT REVENUE (INR)'];
      result.chartData = Object.values(supMap).map(su => ({
        name: su.supplier,
        weight: parseFloat(su.weight.toFixed(3)),
        value: parseFloat(su.weight.toFixed(3))
      })).sort((a,b) => b.value - a.value).slice(0, 8);

      result.rows = Object.values(supMap).map(su => {
        const avg = su.rateCount > 0 ? Math.round(su.sumRate / su.rateCount) : 18500;
        const rev = su.weight * avg;
        return [
          su.supplier,
          su.count.toString(),
          su.weight.toFixed(3),
          su.sumUnits.toLocaleString(),
          `Rs. ${avg.toLocaleString('en-IN')}`,
          `Rs. ${Math.round(rev).toLocaleString('en-IN')}`
        ];
      });
      result.chartType = 'bar';
    }
    else if (activeSaudaReportKey === 'r4') {
      // 4. Packaging Unit Distribution Audit
      const unitMap: Record<string, { type: string; count: number; units: number; weight: number }> = {};
      saudaFilteredByPeriod.forEach(s => {
        const type = s.units_per_lorry_type ? s.units_per_lorry_type.trim().toUpperCase() : (s.unit_type ? s.unit_type.trim().toUpperCase() : 'BALES');
        if (!unitMap[type]) {
          unitMap[type] = { type, count: 0, units: 0, weight: 0 };
        }
        unitMap[type].count++;
        unitMap[type].units += Number(s.total_unit) || 0;
        unitMap[type].weight += Number(s.total_wt_in_ton) || 0;
      });

      const totalWtSum = Object.values(unitMap).reduce((acc, curr) => acc + curr.weight, 0);

      result.headers = ['PACKAGING SPEC', 'SAUDA CONTRACTS', 'TOTAL UNITS DISPATCHED', 'TOTAL WEIGHT (MT)', 'EXPORT EXPOSURE ratio (%)'];
      result.chartData = Object.values(unitMap).map(u => ({
        name: u.type,
        weight: parseFloat(u.weight.toFixed(3)),
        value: parseFloat(u.weight.toFixed(2)),
        percentage: totalWtSum > 0 ? parseFloat(((u.weight / totalWtSum) * 100).toFixed(1)) : 0
      })).sort((a,b) => b.value - a.value);

      result.rows = Object.values(unitMap).map(u => {
        const ratio = totalWtSum > 0 ? ((u.weight / totalWtSum) * 100).toFixed(1) : '0';
        return [
          u.type,
          u.count.toString(),
          u.units.toLocaleString(),
          u.weight.toFixed(3) + ' MT',
          `${ratio}%`
        ];
      });
      result.chartType = 'half_circle';
    }
    else if (activeSaudaReportKey === 'r5') {
      // 5. Brand Quality Specific Sales Pricing
      const qualMap: Record<string, { name: string; marka: string; lines: number; qqty: number; sumRs: number; rCount: number; sumWt: number }> = {};
      filteredSaudaDetails.forEach(d => {
        const name = d.quality ? d.quality.toString().toUpperCase().trim() : 'STANDARD';
        if (!qualMap[name]) {
          qualMap[name] = { name, marka: d.marka || 'STANDARD', lines: 0, qqty: 0, sumRs: 0, rCount: 0, sumWt: 0 };
        }
        qualMap[name].lines++;
        qualMap[name].qqty += Number(d.qty) || 0;
        qualMap[name].sumWt += Number(d.weight_mt) || (Number(d.qty) * 0.180);
        if (d.rs) {
          qualMap[name].sumRs += Number(d.rs);
          qualMap[name].rCount++;
        }
      });

      const totalWtSum = Object.values(qualMap).reduce((acc, curr) => acc + curr.sumWt, 0);

      result.headers = ['JUTE OUTGOING QUALITY', 'MARKA BRAND STAMP', 'TRANSACTION RECORDS', 'PCS COMMITTED', 'TOTAL WEIGHT (MT)', 'AVG SELLING PRICE (INR)'];
      result.chartData = Object.values(qualMap).map(q => ({
        name: q.name,
        weight: parseFloat(q.sumWt.toFixed(3)),
        value: parseFloat(q.sumWt.toFixed(3)),
        percentage: totalWtSum > 0 ? parseFloat(((q.sumWt / totalWtSum) * 100).toFixed(1)) : 0
      })).sort((a,b) => b.value - a.value);

      result.rows = Object.values(qualMap).map(q => {
        const avg = q.rCount > 0 ? Math.round(q.sumRs / q.rCount) : 18500;
        return [
          q.name,
          q.marka,
          q.lines.toString(),
          q.qqty.toLocaleString(),
          q.sumWt.toFixed(3),
          `Rs. ${avg.toLocaleString('en-IN')}`
        ];
      });
      result.chartType = 'pie';
    }
    else if (activeSaudaReportKey === 'r6') {
      // 6. Shipment & Delivery Timelines Audit
      result.headers = ['SAUDA #', 'BROKER NAME', 'BUYING ENTITY', 'TARGET DISPATCH DATE', 'OPERATIONAL WINDOW DAYS', 'DAILY PENALTY / DELAY', 'TIMELINE RISK RATING'];
      result.rows = saudaFilteredByPeriod.map((s: any) => {
        const penalty = s.shipment_penalty || 50;
        const days = s.shipment_days || 15;
        let riskText = 'Standard SLA';
        if (days < 10) riskText = 'Risk Schedule 🔵';
        if (Number(s.quantity_claim) > 0) riskText = 'Settlement Claim Risk 🔴';
        return [
          s.sauda_no,
          s.broker || 'DIRECT',
          s.supplier || 'DIRECT',
          s.shipment_date ? new Date(s.shipment_date).toLocaleDateString('en-GB') : 'N/A',
          `${days} Days`,
          `Rs. ${penalty}/Day`,
          riskText
        ];
      });

      result.chartData = saudaFilteredByPeriod.map((s: any) => ({
        name: s.sauda_no,
        value: Number(s.shipment_days) || 15,
        weight: Number(s.total_wt_in_ton) || 0
      })).slice(0, 10);
      result.chartType = 'bar';
    }
    else if (activeSaudaReportKey === 'r7') {
      // 7. Growing Area Performance Summary
      const areaMap: Record<string, { area: string; count: number; weight: number; sumRate: number; rCount: number; leadAlly: string }> = {};
      saudaFilteredByPeriod.forEach(s => {
        const area = s.area ? s.area.trim().toUpperCase() : 'MAIN ZONE';
        if (!areaMap[area]) {
          areaMap[area] = { area, count: 0, weight: 0, sumRate: 0, rCount: 0, leadAlly: s.broker || 'DIRECT' };
        }
        areaMap[area].count++;
        areaMap[area].weight += Number(s.total_wt_in_ton) || 0;
        if (s.b_rate) {
          areaMap[area].sumRate += Number(s.b_rate);
          areaMap[area].rCount++;
        }
      });

      result.headers = ['JUTE OUTWARD AREA', 'SAUDAS MAPPED', 'SOUCED OUTPUT MAS (MT)', 'WEIGHED AVERAGE B_RATE', 'LEADING PERFORMANCE PARTNER'];
      result.chartData = Object.values(areaMap).map(a => ({
        name: a.area,
        weight: parseFloat(a.weight.toFixed(3)),
        value: parseFloat(a.weight.toFixed(3))
      })).sort((a,b) => b.value - a.value);

      result.rows = Object.values(areaMap).map(a => {
        const avg = a.rCount > 0 ? Math.round(a.sumRate / a.rCount) : 18500;
        return [
          a.area,
          a.count.toString(),
          a.weight.toFixed(3),
          `Rs. ${avg.toLocaleString('en-IN')}`,
          a.leadAlly
        ];
      });
      result.chartType = 'hbar';
    }
    else if (activeSaudaReportKey === 'r8') {
      // 8. Claims & Penalties Audit Log
      result.headers = ['SAUDA #', 'BUYING PARTY', 'MARKS DISCREPANCY CLAIMS', 'QTY DEFICIT CLAIMS', 'MAX COMITTED SHIPMENT DAYS', 'EST DELAY PENALTY (INR)', 'NET DEBIT ADJUSTMENT (INR)'];
      result.rows = saudaFilteredByPeriod.map((s: any) => {
        const mClaim = Number(s.marks_claim) || 0;
        const qClaim = Number(s.quantity_claim) || 0;
        const penalty = (Number(s.shipment_penalty) || 50) * 2.5;
        const grandDebit = mClaim + qClaim + penalty;
        return [
          s.sauda_no,
          s.supplier || 'DIRECT',
          `Rs. ${mClaim.toLocaleString('en-IN')}`,
          `Rs. ${qClaim.toLocaleString('en-IN')}`,
          `${s.shipment_days || 0} Days`,
          `Rs. ${penalty.toLocaleString('en-IN')}`,
          `Rs. ${Math.round(grandDebit).toLocaleString('en-IN')}`
        ];
      });

      result.chartData = saudaFilteredByPeriod.map((s: any) => ({
        name: s.sauda_no,
        mClaim: Number(s.marks_claim) || 0,
        qClaim: Number(s.quantity_claim) || 0
      })).slice(0, 10);
      result.chartType = 'line';
    }
    else if (activeSaudaReportKey === 'r9') {
      // 9. Agency-wide Sales Allocation
      const agMap: Record<string, { name: string; count: number; weight: number; sumRate: number; rCount: number }> = {};
      saudaFilteredByPeriod.forEach(s => {
        const ag = s.agency ? s.agency.trim().toUpperCase() : 'HEAD STATIONS';
        if (!agMap[ag]) {
          agMap[ag] = { name: ag, count: 0, weight: 0, sumRate: 0, rCount: 0 };
        }
        agMap[ag].count++;
        agMap[ag].weight += Number(s.total_wt_in_ton) || 0;
        if (s.b_rate) {
          agMap[ag].sumRate += Number(s.b_rate);
          agMap[ag].rCount++;
        }
      });

      const totalWtSum = Object.values(agMap).reduce((acc, curr) => acc + curr.weight, 0);

      result.headers = ['AGENCY DISPATCH STATION', 'CONTRACT DEALS', 'TOTAL WEIGHED MASS (MT)', 'AVG PRICE RATE', 'VOLUME SHARE ratio (%)'];
      result.chartData = Object.values(agMap).map(a => ({
        name: a.name,
        weight: parseFloat(a.weight.toFixed(3)),
        value: parseFloat(a.weight.toFixed(3)),
        percentage: totalWtSum > 0 ? parseFloat(((a.weight / totalWtSum) * 100).toFixed(1)) : 0
      })).sort((a,b) => b.value - a.value);

      result.rows = Object.values(agMap).map(a => {
        const avg = a.rCount > 0 ? Math.round(a.sumRate / a.rCount) : 18500;
        const share = totalWtSum > 0 ? ((a.weight / totalWtSum) * 100).toFixed(1) : '0';
        return [
          a.name,
          a.count.toString(),
          a.weight.toFixed(3),
          `Rs. ${avg.toLocaleString('en-IN')}`,
          `${share}%`
        ];
      });
      result.chartType = 'pie';
    }
    else if (activeSaudaReportKey === 'r10') {
      // 10. Lorries Dispatch & Payload Logs
      result.headers = ['SAUDA #', 'BROKER CODE', 'LORRIES DISPATCHED', 'PACKETS / VEHICLE', 'NET CARRIER SPEC WT', 'TOTAL payload LOAD (MT)'];
      result.rows = saudaFilteredByPeriod.map((s: any) => {
        const load = (Number(s.no_of_lorries) || 0) * (Number(s.wt_per_lorry) || 0);
        return [
          s.sauda_no,
          s.broker || 'DIRECT DISPATCH',
          (s.no_of_lorries || 0).toString(),
          (s.total_unit || 0).toString(),
          (s.wt_per_lorry || 0).toString() + ' MT',
          load.toFixed(3) + ' MT'
        ];
      });

      result.chartData = saudaFilteredByPeriod.map((s: any) => ({
        name: s.sauda_no,
        lorries: Number(s.no_of_lorries) || 0,
        payload: Number(s.wt_per_lorry) || 0,
        value: Number(s.no_of_lorries) || 0
      })).slice(0, 10);
      result.chartType = 'composed';
    }

    result.totalCount = saudaFilteredByPeriod.length;
    result.totalMT = parseFloat(saudaFilteredByPeriod.reduce((sum, s) => sum + (Number(s.total_wt_in_ton) || 0), 0).toFixed(3));

    return result;
  }, [saudaFilteredByPeriod, filteredSaudaDetails, activeSaudaReportKey]);

  // Export Sauda CSV Handler
  const handleExportSaudaCSV = () => {
    const reportNameObj = SAUDA_REPORTS.find(r => r.key === activeSaudaReportKey);
    const reportName = reportNameObj ? reportNameObj.name.substring(3).trim().replace(/\s+/g, '_') : 'Sauda_Dispatches_Audit';
    const month = saudaReportMonth === 'ALL' ? 'AllMonths' : MONTH_LABELS.find(m => m.value === saudaReportMonth)?.label;
    const year = saudaReportYear === 'ALL' ? 'AllYears' : saudaReportYear;
    
    const filename = `Sauda_Report_${reportName}_${month}_${year}.csv`;
    
    // Generate CSV content
    const headersStr = saudaReportOutput.headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
    const rowsStr = saudaReportOutput.rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','));
    const csvContent = [headersStr, ...rowsStr].join('\n');
    
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

  // --- Amad calculations & filtering ---
  const filteredAmads = useMemo(() => {
    return amadData.filter(item => {
      // Date range filter
      if (amadStart) {
        const itemDate = new Date(item.date);
        const filterStart = new Date(amadStart);
        if (itemDate < filterStart) return false;
      }
      if (amadEnd) {
        const itemDate = new Date(item.date);
        const filterEnd = new Date(amadEnd);
        filterEnd.setHours(23, 59, 59, 999);
        if (itemDate > filterEnd) return false;
      }
      // Search Box filter
      if (amadSearch.trim()) {
        const query = amadSearch.toLowerCase();
        const matMatch = String(item.temporary_arrival_no || item.amad_no || item.arrival_no || item.mr_no || '').toLowerCase().includes(query) || false;
        const poMatch = item.po_no?.toLowerCase().includes(query) || false;
        const suppMatch = item.supplier?.toLowerCase().includes(query) || false;
        const brokMatch = item.broker?.toLowerCase().includes(query) || false;
        const lorryMatch = String(item?.lorry_number || item?.lorry_no || item?.vehicle_no || '').toLowerCase().includes(query) || false;
        const areaMatch = item.arrival_area_name?.toLowerCase().includes(query) || false;
        const markaMatch = item.remarks?.toLowerCase().includes(query) || false;
        return matMatch || poMatch || suppMatch || brokMatch || lorryMatch || areaMatch || markaMatch;
      }
      return true;
    });
  }, [amadData, amadStart, amadEnd, amadSearch]);

  const amadAggregates = useMemo(() => {
    let pkts = 0;
    let wtQtl = 0;
    filteredAmads.forEach(a => {
      pkts += Number(a.total_packets || a.packets || 0);
      wtQtl += Number(a.weight_qtl || a.weight || 0);
    });
    return { pkts, wtQtl };
  }, [filteredAmads]);


  // --- Sauda calculations, filtering & charts ---
  const filteredSaudas = useMemo(() => {
    return saudaData.filter(item => {
      if (saudaSearch.trim()) {
        const query = saudaSearch.toLowerCase();
        return (
          (item.sauda_no || '').toLowerCase().includes(query) ||
          (item.supplier || '').toLowerCase().includes(query) ||
          (item.broker || '').toLowerCase().includes(query) ||
          (item.area || '').toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [saudaData, saudaSearch]);

  const saudaAggregates = useMemo(() => {
    let count = filteredSaudas.length;
    let totalWeight = 0;
    let totalUnits = 0;
    let sumRate = 0;
    let rateCount = 0;

    filteredSaudas.forEach(s => {
      totalWeight += Number(s.total_wt_in_ton) || 0;
      totalUnits += Number(s.total_unit) || 0;
      if (s.b_rate) {
        sumRate += Number(s.b_rate);
        rateCount++;
      }
    });

    return {
      count,
      totalWeight: parseFloat(totalWeight.toFixed(3)),
      totalUnits,
      avgRate: rateCount > 0 ? parseFloat((sumRate / rateCount).toFixed(2)) : 0
    };
  }, [filteredSaudas]);

  const saudaChartData = useMemo(() => {
    const brokerMap: Record<string, number> = {};
    filteredSaudas.forEach(s => {
      const bName = s.broker || 'DIRECT';
      const wt = Number(s.total_wt_in_ton) || 0;
      brokerMap[bName] = (brokerMap[bName] || 0) + wt;
    });
    return Object.entries(brokerMap).map(([name, weight]) => ({
      name,
      weight: parseFloat(weight.toFixed(3))
    })).sort((a,b) => b.weight - a.weight).slice(0, 8);
  }, [filteredSaudas]);


  // --- Map-wise PO Aggregates & Visualization ---
  const areaGroupedPo = useMemo(() => {
    const groups: Record<string, { name: string; count: number; totalTons: number; pos: any[] }> = {};
    let grandTons = 0;

    poData.forEach(p => {
      // Get logical clean Area from purchase_master (p.area)
      const areaName = (p.area || '').trim().toUpperCase() || 'DIRECT SOURCING';

      // Get Agency from purchase_detail_master (poDetails) and agency_master (agencyList)
      const matchingDetails = poDetails.filter(d => d.po_no === p.po_no);
      let fetchedAgencyName = 'MAIN AGENCY';
      if (matchingDetails.length > 0) {
        const detailWithAgency = matchingDetails.find(d => d.agency_code);
        if (detailWithAgency && detailWithAgency.agency_code) {
          const code = String(detailWithAgency.agency_code).trim();
          const matchedAg = agencyList.find(a => String(a.agency_code).trim().toUpperCase() === code.toUpperCase());
          fetchedAgencyName = matchedAg ? matchedAg.agency_name : code;
        } else {
          // fallback
          fetchedAgencyName = (p.purchase_unit_name || p.agency_name || p.agency_code || 'MAIN AGENCY').trim();
        }
      } else {
        // fallback
        fetchedAgencyName = (p.purchase_unit_name || p.agency_name || p.agency_code || 'MAIN AGENCY').trim();
      }
      const agencyName = fetchedAgencyName.toUpperCase();

      // Decide group name based on chosen sourcingGroupMode
      let groupName = '';
      if (sourcingGroupMode === 'area') {
        groupName = areaName;
      } else if (sourcingGroupMode === 'agency') {
        groupName = agencyName;
      } else {
        // Combined Area & Agency
        groupName = `${areaName} - ${agencyName}`;
      }
      
      // Calculate individual PO weight using detail lines first if present
      let calculatedWt = 0;
      if (matchingDetails.length > 0) {
        calculatedWt = matchingDetails.reduce((sum, d) => sum + (Number(d.weight_mt) || Number(d.weight) || 0), 0);
      }
      if (calculatedWt === 0) {
        calculatedWt = Number(p.total_contract_mt) || 0;
      }
      if (calculatedWt === 0) {
        // Fallback calculations using total_units & weight_unit_kgs
        const totalUnits = Number(p.total_units) || (Number(p.total_lorries) * Number(p.units_per_lorry)) || 0;
        const weightUnitKgs = Number(p.weight_unit_kgs) || 50;
        calculatedWt = (totalUnits * weightUnitKgs) / 1000;
        if (calculatedWt === 0) {
          calculatedWt = Number(p.total_lorries) * (Number(p.weight_per_lorry) || 0);
        }
      }

      grandTons += calculatedWt;

      if (!groups[groupName]) {
        groups[groupName] = {
          name: groupName,
          count: 0,
          totalTons: 0,
          pos: []
        };
      }

      groups[groupName].count++;
      groups[groupName].totalTons += calculatedWt;

      // Find any child grade detail records from poDetails if available to enrich the display,
      // otherwise fallback to parent-level fields.
      let gradeName = 'STANDARD GRADE';
      if (matchingDetails.length > 0) {
        const firstDetail = matchingDetails[0];
        const gradeObj = gradeList.find(g => g.grade_code === firstDetail.grade_code);
        gradeName = gradeObj ? gradeObj.grade_name : (firstDetail.grade_code || 'STANDARD GRADE');
      }

      groups[groupName].pos.push({
        po_no: p.po_no,
        po_id: p.po_id,
        po_date: p.po_date,
        area: areaName,
        agency_name: agencyName,
        grade_name: gradeName,
        supplier: p.supplier || 'DIRECT',
        broker: p.broker || 'DIRECT',
        total_contract_mt: calculatedWt
      });
    });

    return Object.values(groups).map(g => ({
      ...g,
      percentage: grandTons > 0 ? parseFloat(((g.totalTons / grandTons) * 100).toFixed(1)) : 0,
      totalTons: parseFloat(g.totalTons.toFixed(3))
    })).sort((a, b) => b.totalTons - a.totalTons);
  }, [poData, poDetails, gradeList, agencyList, sourcingGroupMode]);

  // Deterministic coordinate generator for the geographic interactive dashboard map
  const getDeterministicCoords = (name: string) => {
    let hash1 = 0;
    let hash2 = 0;
    for (let i = 0; i < name.length; i++) {
      hash1 = name.charCodeAt(i) + ((hash1 << 5) - hash1);
      hash2 = name.charCodeAt(i) + ((hash2 << 7) - hash2);
    }
    // Spread coordinates on the map container beautifully
    const x = Math.min(85, Math.max(15, Math.abs(hash1) % 65 + 18));
    const y = Math.min(80, Math.max(15, Math.abs(hash2) % 65 + 15));
    return { x, y };
  };

  const selectedAreaDetail = useMemo(() => {
    if (!selectedArea) return null;
    return areaGroupedPo.find(a => a.name === selectedArea) || null;
  }, [areaGroupedPo, selectedArea]);

  const mapCenter = useMemo(() => {
    if (areaGroupedPo.length === 0) return { lat: 24.5, lng: 84.5 };
    let sumLat = 0;
    let sumLng = 0;
    let count = 0;
    areaGroupedPo.forEach(area => {
      const coords = getAreaCoordinates(area.name);
      sumLat += coords.lat;
      sumLng += coords.lng;
      count++;
    });
    return { lat: sumLat / count, lng: sumLng / count };
  }, [areaGroupedPo]);

  // Sync center and zoom when the selected area changes
  useEffect(() => {
    if (selectedArea) {
      const coords = getAreaCoordinates(selectedArea);
      setCenter([coords.lat, coords.lng]);
      setZoom(7.5);
    } else {
      setCenter([mapCenter.lat, mapCenter.lng]);
      setZoom(5.5);
    }
  }, [selectedArea, mapCenter]);


  return (
    <LegacyLayout title="Reports & Analytics" onClose={onClose}>
      <div className="space-y-4">
        {/* Module Selector win95 Tab styling */}
        <div className="flex flex-wrap items-center gap-1.5 px-2 py-2 bg-green-900 border-2 border-green-950 rounded-xl">

          {/* Report1 (formerly Sauda Analyze) */}
          <button
            id="tab-report1"
            onClick={() => setReportType('sauda_analyze')}
            className={cn(
              "px-5 h-9 text-[11px] sm:text-xs font-black uppercase tracking-wide",
              "rounded-lg border transition-all duration-150 shadow-sm",
              reportType === 'sauda_analyze'
                ? "bg-yellow-400 text-green-950 border-yellow-300 shadow-md shadow-yellow-500/30 font-black scale-[1.02]"
                : "bg-green-950 text-green-100 border-green-800 hover:bg-yellow-400 hover:text-green-950 hover:border-yellow-300"
            )}
          >
            Report
          </button>

          {/* MAP WISE (formerly Map Wise P.O) */}
          <button
            id="tab-map-wise"
            onClick={() => {
              setReportType('map_wise_po');
              if (areaGroupedPo.length > 0 && !selectedArea) {
                setSelectedArea(areaGroupedPo[0].name);
              }
            }}
            className={cn(
              "px-5 h-9 text-[11px] sm:text-xs font-black uppercase tracking-wide",
              "rounded-lg border transition-all duration-150 shadow-sm",
              reportType === 'map_wise_po'
                ? "bg-yellow-400 text-green-950 border-yellow-300 shadow-md shadow-yellow-500/30 font-black scale-[1.02]"
                : "bg-green-950 text-green-100 border-green-800 hover:bg-yellow-400 hover:text-green-950 hover:border-yellow-300"
            )}
          >
            MAP WISE
          </button>

        </div>

        {/* --- 1. AMAD REGISTER VIEW --- */}
        {reportType === 'amad' && (
          <div className="bg-[#d4d0c8] border-2 border-white shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] p-4 space-y-4" id="report-amad-container">
             {/* Filter block */}
             <div className="flex flex-wrap gap-3 items-end bg-[#c0c0c0] p-3 border border-black/10 shadow-[inset_1px_1px_1px_rgba(0,0,0,0.1)] rounded-sm">
                <div className="space-y-1">
                   <label htmlFor="period_start_1716" className="text-[10px] font-bold text-gray-700 uppercase italic block ml-1">Period Start</label>
                   <div className="flex bg-white border border-gray-400 p-px">
                      <input  id="period_start_1716" name="period_start" aria-label="Period Start"
                        type="date" 
                        value={amadStart}
                        onChange={(e) => setAmadStart(e.target.value)}
                        className="p-1 text-[11px] font-black outline-none w-32" 
                      />
                   </div>
                </div>
                <div className="space-y-1">
                   <label htmlFor="period_end_1727" className="text-[10px] font-bold text-gray-700 uppercase italic block ml-1">Period End</label>
                   <div className="flex bg-white border border-gray-400 p-px">
                      <input  id="period_end_1727" name="period_end" aria-label="Period End"
                        type="date" 
                        value={amadEnd}
                        onChange={(e) => setAmadEnd(e.target.value)}
                        className="p-1 text-[11px] font-black outline-none w-32" 
                      />
                   </div>
                </div>
                
                <div className="flex-1 space-y-1 min-w-[180px]">
                   <label htmlFor="live_search_scanner_1739" className="text-[10px] font-bold text-gray-700 uppercase italic block ml-1">Live Search Scanner</label>
                   <div className="flex bg-white border border-gray-400 p-px mb-0.5">
                      <input  id="live_search_scanner_1739" name="live_search_scanner" aria-label="Live Search Scanner"
                        className="flex-1 p-1 text-[11px] font-black outline-none placeholder:text-slate-400" 
                        placeholder="Scan Arrival No, Supplier, Lorry, Location..." 
                        value={amadSearch}
                        onChange={(e) => setAmadSearch(e.target.value)}
                      />
                      <button className="bg-[#d4d0c8] px-2 border-l border-gray-400">
                        <Search className="h-3 w-3" />
                      </button>
                   </div>
                </div>

                <div className="flex gap-1.5 shrink-0">
                   <button 
                     onClick={fetchAllData}
                     className="bg-[#d4d0c8] p-1.5 border border-white hover:bg-white active:shadow-inner text-[10px] font-bold uppercase flex items-center gap-1 shadow-[1px_1px_0_0_black]"
                   >
                     <RefreshCw className={cn("h-3 w-3 text-slate-700", loading && "animate-spin")} />
                     <span>Refresh</span>
                   </button>
                </div>
             </div>

             {/* Records Output Grid */}
             <div className="bg-white border border-gray-400 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.1)] overflow-x-auto">
                <table className="w-full border-collapse text-[10px] min-w-[700px]">
                   <thead className="bg-[#c0c0c0] font-bold text-center border-b border-gray-400 ">
                      <tr className="h-8">
                         <th className="px-3 text-left border-r border-gray-300">DATE</th>
                         <th className="px-3 border-r border-gray-300">AMAD NO</th>
                         <th className="px-3 border-r border-gray-300">P.O. CONTRACT</th>
                         <th className="px-5 text-left border-r border-gray-300">SUPPLIER (KISAN)</th>
                         <th className="px-3 border-r border-gray-300 text-left">BROKER / AGENT</th>
                         <th className="px-3 border-r border-gray-300">LORRY NUMBER</th>
                         <th className="px-3 border-r border-gray-300">LOCATION AREA</th>
                         <th className="px-3 border-r border-gray-300 text-right">PACKETS</th>
                         <th className="px-4 text-right">NET WEIGHT (Q)</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100 font-bold">
                      {filteredAmads.map((amad, idx) => {
                         const packetsNum = Number(amad.total_packets || amad.packets || 0);
                         const qtlNum = Number(amad.weight_qtl || amad.weight || 0);
                         return (
                            <tr key={amad.amad_id || idx} className="h-10 hover:bg-[#ffffd0]/30 transition-colors group cursor-default border-b border-gray-50">
                               <td className="px-3 text-gray-500 font-mono italic">
                                 {amad.date ? new Date(amad.date).toLocaleDateString('en-GB') : '--'}
                               </td>
                               <td className="px-3 text-center bg-blue-50/10 text-blue-900 border-r border-gray-100 font-mono">
                                 #{amad.temporary_arrival_no || amad.amad_no || amad.arrival_no || amad.mr_no || '--'}
                               </td>
                               <td className="px-3 text-center text-indigo-900 font-mono text-[9px]">
                                 {amad.po_no || '--'}
                               </td>
                               <td className="px-5 text-slate-900 truncate max-w-[170px]" title={amad.supplier}>
                                 {amad.supplier || 'N/A'}
                               </td>
                               <td className="px-3 text-left text-slate-600 font-medium truncate max-w-[140px]" title={amad.broker}>
                                 {amad.broker || 'DIRECT'}
                               </td>
                               <td className="px-3 text-center font-mono opacity-80">{amad?.lorry_number || (amad as any)?.lorry_no || (amad as any)?.vehicle_no || '--'}</td>
                               <td className="px-3 text-center text-gray-500 uppercase italic text-[9px]">{amad.arrival_area_name || 'MAIN ZONE'}</td>
                               <td className="px-3 text-right tabular-nums text-slate-800">{packetsNum.toLocaleString()}</td>
                               <td className="px-4 text-right tabular-nums text-indigo-950 font-black italic">{qtlNum.toFixed(2)} Q</td>
                            </tr>
                         );
                      })}
                      {filteredAmads.length === 0 && (
                         <tr className="h-20">
                            <td colSpan={9} className="text-center text-gray-400 italic">No live arrival entries found matching current filter context.</td>
                         </tr>
                      )}
                   </tbody>
                </table>
             </div>

             {/* Aggregations HUD */}
             <div className="bg-[#808080] p-1 flex justify-between gap-px border border-black/10">
                <div className="flex gap-1.5">
                   <div className="bg-white px-4 py-1.5 border border-gray-400 min-w-[150px]">
                      <span className="text-[7.5px] font-black text-slate-400 uppercase leading-none block">Aggregate Packets</span>
                      <span className="text-sm font-black italic text-slate-900 tracking-tight tabular-nums underline decoration-blue-800 decoration-2 underline-offset-1">
                        {amadAggregates.pkts.toLocaleString()} BALES
                      </span>
                   </div>
                   <div className="bg-white px-4 py-1.5 border border-gray-400 min-w-[150px]">
                      <span className="text-[7.5px] font-black text-slate-400 uppercase leading-none block">Aggregate Net Weight</span>
                      <span className="text-sm font-black italic text-indigo-900 tracking-tight tabular-nums">
                        {amadAggregates.wtQtl.toLocaleString(undefined, { minimumFractionDigits: 2 })} QUINTALS
                      </span>
                   </div>
                   <div className="bg-white px-4 py-1.5 border border-gray-400 min-w-[150px] hidden sm:block">
                      <span className="text-[7.5px] font-black text-slate-400 uppercase leading-none block">Total Records Loaded</span>
                      <span className="text-sm font-black italic text-emerald-800 tracking-tight">
                        {filteredAmads.length} Vouchers
                      </span>
                   </div>
                </div>

                <div className="flex items-center text-[9px] text-white font-bold font-mono uppercase bg-slate-800 border border-slate-700 px-3 tracking-widest block ">
                  Live DB Inbound Feed
                </div>
             </div>
          </div>
        )}

        {/* --- 2. SAUDA ANALYZE (OUT) --- */}
        {reportType === 'sauda_analyze' && (
        <div
          className="bg-gradient-to-br from-emerald-50 via-white to-green-50 border border-emerald-200 rounded-2xl shadow-lg p-3 sm:p-4 space-y-4"
          id="report-sauda-container"
        >
          {/* ==================== SUB NAVIGATION ==================== */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-emerald-200">
            <div className="flex flex-wrap gap-2">

              <button
                onClick={() => setSaudaViewMode('percentage_analytics')}
                className={cn(
                  "px-4 py-2 text-[10px] sm:text-[11px] font-black uppercase tracking-wide",
                  "rounded-xl border transition-all duration-200",
                  "shadow-sm hover:shadow-md hover:-translate-y-[1px]",
                  saudaViewMode === 'percentage_analytics'
                    ? "bg-emerald-700 text-white border-emerald-800 shadow-emerald-200"
                    : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                )}
              >
                ⚡ Percentage-Wise Analytics
              </button>

              <button
                onClick={() => setSaudaViewMode('dashboard')}
                className={cn(
                  "px-4 py-2 text-[10px] sm:text-[11px] font-black uppercase tracking-wide",
                  "rounded-xl border transition-all duration-200",
                  "shadow-sm hover:shadow-md hover:-translate-y-[1px]",
                  saudaViewMode === 'dashboard'
                    ? "bg-emerald-700 text-white border-emerald-800 shadow-emerald-200"
                    : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                )}
              >
                📊 Sauda Overview
              </button>

              <button
                onClick={() => setSaudaViewMode('advanced_reports')}
                className={cn(
                  "px-4 py-2 text-[10px] sm:text-[11px] font-black uppercase tracking-wide",
                  "rounded-xl border transition-all duration-200",
                  "shadow-sm hover:shadow-md hover:-translate-y-[1px]",
                  saudaViewMode === 'advanced_reports'
                    ? "bg-emerald-700 text-white border-emerald-800 shadow-emerald-200"
                    : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                )}
              >
                📋 Legacy 10-Reports Deck
              </button>

            </div>

            <span className="text-[9px] font-black text-emerald-800 uppercase tracking-[0.18em] font-mono">
              JUTE MIS • PERCENTAGE-WISE ANALYTICS ENGINE
            </span>
          </div>

          {/* ==================== PERCENTAGE-WISE ANALYTICS SECTION ==================== */}
          {saudaViewMode === 'percentage_analytics' && (
            <PercentageWiseAnalyticsSection
              saudaData={saudaData}
              poData={poData}
              poDetails={poDetails}
              mrData={finalArrivalData}
              tempMRData={amadData}
              paymentData={paymentData}
              scpData={scpData}
            />
          )}

          {/* ==================== DASHBOARD ==================== */}
          {saudaViewMode === 'dashboard' && (
            <React.Fragment>

              {/* KPI CARDS */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

                <div className="bg-white border border-emerald-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-black text-emerald-900 leading-none mb-1">
                        {saudaAggregates.count}
                      </p>
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                        Sauda Contracts
                      </p>
                    </div>

                    <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                      <ClipboardList className="h-4 w-4 text-emerald-700" />
                    </div>
                  </div>
                </div>


                <div className="bg-white border border-blue-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-black text-blue-900 leading-none mb-1">
                        {saudaAggregates.totalWeight.toLocaleString()} T
                      </p>
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                        Total Weight Out
                      </p>
                    </div>

                    <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                      <Scale className="h-4 w-4 text-blue-700" />
                    </div>
                  </div>
                </div>


                <div className="bg-white border border-teal-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-black text-teal-900 leading-none mb-1">
                        {saudaAggregates.totalUnits.toLocaleString()}
                      </p>
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                        Aggregate Units
                      </p>
                    </div>

                    <div className="h-9 w-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center">
                      <Layers className="h-4 w-4 text-teal-700" />
                    </div>
                  </div>
                </div>


                <div className="bg-white border border-amber-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-black text-amber-900 leading-none mb-1">
                        ₹ {saudaAggregates.avgRate.toLocaleString()}
                      </p>
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">
                        Weighted Avg Rate / Ql
                      </p>
                    </div>

                    <div className="h-9 w-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-amber-700" />
                    </div>
                  </div>
                </div>

              </div>


              {/* CHART + SUMMARY */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* CHART */}
                <div className="lg:col-span-2 bg-white border border-emerald-100 rounded-xl p-4 shadow-sm">

                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-emerald-950 tracking-wider">
                        Top Brokers by Contract Weight
                      </h4>

                      <p className="text-[8px] text-slate-400 italic">
                        Distribution based on registered Sauda logs
                      </p>
                    </div>

                    <span className="text-[8px] font-bold bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg">
                      LIVE DATA
                    </span>
                  </div>

                  <div className="h-56 mt-2 font-mono text-[9px]">

                    {saudaChartData.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                        <span>No transaction records found</span>
                      </div>
                    ) : (
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                        minWidth={100}
                        minHeight={100}
                      >
                        <BarChart
                          data={saudaChartData}
                          margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#d1fae5"
                          />

                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 7.5 }}
                          />

                          <YAxis
                            tick={{ fontSize: 7.5 }}
                          />

                          <RechartsTooltip
                            contentStyle={{
                              fontSize: 9,
                              borderRadius: 10,
                              border: "1px solid #d1fae5"
                            }}
                          />

                          <Bar
                            dataKey="weight"
                            fill="#047857"
                            radius={[5, 5, 0, 0]}
                          >
                            {saudaChartData.map((entry, index) => {
                              const colors = [
                                '#047857',
                                '#0f766e',
                                '#15803d',
                                '#059669',
                                '#16a34a'
                              ];

                              return (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={colors[index % colors.length]}
                                />
                              );
                            })}
                          </Bar>

                        </BarChart>
                      </ResponsiveContainer>
                    )}

                  </div>
                </div>


                {/* SUMMARY PANEL */}
                <div className="bg-white border border-emerald-100 rounded-xl p-4 shadow-sm flex flex-col justify-between">

                  <div className="space-y-3">

                    <div>
                      <h4 className="text-[10px] font-black uppercase text-emerald-950 tracking-wider">
                        Sauda Sourcing Statistics
                      </h4>

                      <p className="text-[8px] text-slate-400 italic">
                        Analytical summary of contract registry
                      </p>
                    </div>


                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 space-y-3">

                      <div>
                        <span className="text-[7px] font-bold text-emerald-600 uppercase block">
                          Prime Broker
                        </span>

                        <span className="font-black text-emerald-950 text-[10px] block truncate">
                          {saudaChartData[0]?.name || 'DIRECT'}
                          {' '}
                          ({saudaChartData[0]?.weight || 0} MT)
                        </span>
                      </div>


                      <div className="border-t border-emerald-100 pt-2 flex justify-between gap-2">

                        <div>
                          <span className="text-[7px] font-bold text-slate-400 uppercase block">
                            Brokers Count
                          </span>

                          <span className="font-black text-slate-800 block">
                            {saudaChartData.length} active
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[7px] font-bold text-slate-400 uppercase block">
                            Total Mass
                          </span>

                          <span className="font-black text-emerald-800 block">
                            {saudaAggregates.totalWeight.toLocaleString()} MT
                          </span>
                        </div>

                      </div>
                    </div>


                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[8.5px] text-amber-900 leading-normal">
                      💡 <strong>Sourcing Insight:</strong> Sauda contracts are mapped against
                      live buyer commitments. Track weight discrepancies periodically.
                    </div>

                  </div>


                  <button
                    id="download-sauda-ins"
                    onClick={() => {
                      window.print();
                    }}
                    className="
                      w-full mt-3
                      bg-emerald-700
                      hover:bg-emerald-800
                      text-white
                      py-2
                      rounded-xl
                      border border-emerald-800
                      text-[9px]
                      font-black
                      uppercase
                      tracking-wider
                      shadow-sm
                      hover:shadow-md
                      transition-all
                    "
                  >
                    🖨️ Print Active Sauda
                  </button>

                </div>

              </div>

            </React.Fragment>
          )}


          {/* ==================== ADVANCED REPORTS ==================== */}
          {saudaViewMode === 'advanced_reports' && (
            <div className="space-y-4">

              <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

                {/* LEFT FILTER PANEL */}
                <div className="xl:col-span-1 bg-white border border-emerald-100 rounded-xl p-4 shadow-sm">

                  <div className="space-y-3">

                    <div>
                      <h4 className="text-[10px] font-black uppercase text-emerald-950 tracking-wider">
                        Reports Preset Deck
                      </h4>

                      <p className="text-[8px] text-slate-400 italic">
                        Select from available report formats
                      </p>
                    </div>


                    {/* SEARCH */}
                    <div className="space-y-1">

                      <label
                        htmlFor="keyword_search_filter_2017"
                        className="text-[8px] font-black text-slate-700 uppercase tracking-tight"
                      >
                        Keyword Search Filter
                      </label>

                      <div className="relative">

                        <input
                          id="keyword_search_filter_2017"
                          name="keyword_search_filter"
                          aria-label="Keyword Search Filter"
                          type="text"
                          value={saudaReportSearch}
                          onChange={(e) => setSaudaReportSearch(e.target.value)}
                          placeholder="Search Broker, Supplier, Area..."
                          className="
                            w-full
                            text-[10px]
                            pl-7
                            pr-2
                            py-2
                            bg-slate-50
                            border border-emerald-100
                            rounded-lg
                            focus:bg-white
                            focus:border-emerald-500
                            focus:ring-2
                            focus:ring-emerald-100
                            focus:outline-none
                            text-slate-900
                          "
                        />

                        <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-emerald-600" />

                      </div>
                    </div>


                    {/* MONTH YEAR */}
                    <div className="grid grid-cols-2 gap-2">

                      <div className="space-y-1">

                        <label
                          htmlFor="target_month_2032"
                          className="text-[8px] font-black text-slate-700 uppercase"
                        >
                          Target Month
                        </label>

                        <select
                          id="target_month_2032"
                          name="target_month"
                          aria-label="Target Month"
                          value={saudaReportMonth}
                          onChange={(e) => setSaudaReportMonth(e.target.value)}
                          className="
                            w-full
                            text-[10px]
                            py-2
                            px-2
                            bg-slate-50
                            border border-emerald-100
                            rounded-lg
                            focus:border-emerald-500
                            focus:outline-none
                            text-slate-900
                            font-bold
                          "
                        >
                          {MONTH_LABELS.map(m => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>

                      </div>


                      <div className="space-y-1">

                        <label
                          htmlFor="financial_year_2044"
                          className="text-[8px] font-black text-slate-700 uppercase"
                        >
                          Financial Year
                        </label>

                        <select
                          id="financial_year_2044"
                          name="financial_year"
                          aria-label="Financial Year"
                          value={saudaReportYear}
                          onChange={(e) => setSaudaReportYear(e.target.value)}
                          className="
                            w-full
                            text-[10px]
                            py-2
                            px-2
                            bg-slate-50
                            border border-emerald-100
                            rounded-lg
                            focus:border-emerald-500
                            focus:outline-none
                            text-slate-900
                            font-bold
                          "
                        >
                          <option value="ALL">-- ALL YEARS --</option>

                          {saudaYears.map(yr => (
                            <option key={yr} value={yr}>
                              {yr}
                            </option>
                          ))}

                        </select>

                      </div>

                    </div>


                    {/* REPORT LIST */}
                    <div className="border border-emerald-100 rounded-xl overflow-hidden max-h-[320px] overflow-y-auto">

                      {SAUDA_REPORTS.map((r, i) => {

                        const isActive = activeSaudaReportKey === r.key;

                        return (
                          <button
                            key={r.key}
                            onClick={() => setActiveSaudaReportKey(r.key)}
                            className={cn(
                              "w-full text-left p-3 transition-all border-b last:border-b-0",
                              isActive
                                ? "bg-emerald-700 text-white border-emerald-800"
                                : "bg-white hover:bg-emerald-50 border-emerald-50"
                            )}
                          >

                            <span
                              className={cn(
                                "text-[9.5px] font-black uppercase block leading-tight",
                                isActive
                                  ? "text-white"
                                  : "text-slate-800"
                              )}
                            >
                              {r.name}
                            </span>

                            <span
                              className={cn(
                                "text-[7.5px] block truncate leading-tight mt-1",
                                isActive
                                  ? "text-emerald-100"
                                  : "text-slate-400"
                              )}
                              title={r.description}
                            >
                              {r.description}
                            </span>

                          </button>
                        );

                      })}

                    </div>

                  </div>


                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[8px] text-slate-500 leading-normal font-mono mt-3">
                    * Calculated indexes are generated dynamically from live MIS data.
                  </div>

                </div>


                {/* RIGHT AREA */}
                <div className="xl:col-span-3 space-y-4">

                  {/* REPORT HEADER */}
                  <div className="bg-white border border-emerald-100 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">

                    <div className="space-y-1">

                      <h3 className="text-xs font-black text-emerald-950 uppercase tracking-widest flex items-center gap-2">

                        <span>
                          {SAUDA_REPORTS.find(
                            r => r.key === activeSaudaReportKey
                          )?.name}
                        </span>

                        <span className="bg-emerald-100 text-emerald-800 text-[7px] font-black px-2 py-1 rounded-full uppercase">
                          Dynamic Query
                        </span>

                      </h3>

                      <p className="text-[9px] text-slate-500 max-w-xl leading-normal">
                        {SAUDA_REPORTS.find(
                          r => r.key === activeSaudaReportKey
                        )?.description}
                      </p>

                    </div>


                    <button
                      onClick={handleExportSaudaCSV}
                      className="
                        bg-emerald-700
                        hover:bg-emerald-800
                        text-white
                        border border-emerald-800
                        px-4
                        py-2
                        rounded-xl
                        text-[9px]
                        font-black
                        uppercase
                        tracking-wider
                        flex
                        items-center
                        justify-center
                        gap-1.5
                        shadow-sm
                        hover:shadow-md
                        transition-all
                      "
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      Export CSV
                    </button>

                  </div>


                  {/* KPI BELT */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

                    <div className="bg-white border border-emerald-100 rounded-xl p-3 text-center shadow-sm">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">
                        ACTIVE DEALS
                      </span>

                      <span className="text-sm font-black text-emerald-900 block mt-1">
                        {saudaReportOutput.totalCount} completed
                      </span>
                    </div>


                    <div className="bg-white border border-blue-100 rounded-xl p-3 text-center shadow-sm">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">
                        MASS DISPATCHED
                      </span>

                      <span className="text-sm font-black text-blue-900 block mt-1">
                        {saudaReportOutput.totalMT.toLocaleString()} MT
                      </span>
                    </div>


                    <div className="bg-white border border-amber-100 rounded-xl p-3 text-center shadow-sm">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">
                        REPORT MONTH
                      </span>

                      <span className="text-sm font-black text-amber-900 block mt-1 uppercase font-mono">
                        {saudaReportMonth === 'ALL'
                          ? 'ALL MONTHS'
                          : MONTH_LABELS.find(
                              m => m.value === saudaReportMonth
                            )?.label.substring(0, 3)}
                      </span>
                    </div>


                    <div className="bg-white border border-teal-100 rounded-xl p-3 text-center shadow-sm">
                      <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest block">
                        REPORT YEAR
                      </span>

                      <span className="text-sm font-black text-teal-900 block mt-1 uppercase font-mono">
                        {saudaReportYear === 'ALL'
                          ? 'ALL YEARS'
                          : saudaReportYear}
                      </span>
                    </div>

                  </div>


                  {/* GRAPH */}
                  <div className="bg-white border border-emerald-100 rounded-xl p-4 shadow-sm">

                    <div className="mb-2">

                      <h4 className="text-[9px] font-black uppercase text-emerald-950 tracking-wider">
                        Dynamic Graphical Distribution
                      </h4>

                      <p className="text-[7.5px] text-slate-400 italic">
                        Visual correlation based on structured database segments
                      </p>

                    </div>


                    <div className="h-52 font-mono text-[8px]">

                      {saudaReportOutput.chartData.length === 0 ? (

                        <div className="h-full flex items-center justify-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                          No analytical dimensions to map with current filters
                        </div>

                      ) : (

                        <ResponsiveContainer
                          width="100%"
                          height="100%"
                          minWidth={100}
                          minHeight={100}
                        >

                          {saudaReportOutput.chartType === 'area' ? (

                            <AreaChart
                              data={saudaReportOutput.chartData}
                              margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                            >
                              <defs>
                                <linearGradient
                                  id="saudaPrGrad"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor="#047857"
                                    stopOpacity={0.75}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="#047857"
                                    stopOpacity={0.05}
                                  />
                                </linearGradient>
                              </defs>

                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#d1fae5"
                              />

                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 7.5 }}
                              />

                              <YAxis
                                tick={{ fontSize: 7.5 }}
                              />

                              <RechartsTooltip />

                              <Area
                                type="monotone"
                                dataKey="weight"
                                stroke="#047857"
                                fillOpacity={1}
                                fill="url(#saudaPrGrad)"
                                name="Dispatched Mass (MT)"
                              />

                            </AreaChart>

                          ) : saudaReportOutput.chartType === 'line' ? (

                            <LineChart
                              data={saudaReportOutput.chartData}
                              margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                            >

                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#d1fae5"
                              />

                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 7.5 }}
                              />

                              <YAxis
                                tick={{ fontSize: 7.5 }}
                              />

                              <RechartsTooltip />

                              <Legend wrapperStyle={{ fontSize: 7.5 }} />

                              <Line
                                type="monotone"
                                dataKey="mClaim"
                                stroke="#ea580c"
                                strokeWidth={2}
                                name="Quality Marks Claims (INR)"
                              />

                              <Line
                                type="monotone"
                                dataKey="qClaim"
                                stroke="#2563eb"
                                strokeWidth={2}
                                name="Packaging Deficit Claims (INR)"
                              />

                            </LineChart>

                          ) : saudaReportOutput.chartType === 'pie' ||
                            saudaReportOutput.chartType === 'half_circle' ? (

                            <PieChart>

                              <Pie
                                data={saudaReportOutput.chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={
                                  saudaReportOutput.chartType === 'half_circle'
                                    ? 35
                                    : 0
                                }
                                outerRadius={70}
                                paddingAngle={2}
                                dataKey="value"
                                label={({ name, percent }: any) =>
                                  `${name} (${((percent || 0) * 100).toFixed(0)}%)`
                                }
                              >

                                {saudaReportOutput.chartData.map(
                                  (entry, index) => {

                                    const clrs = [
                                      '#047857',
                                      '#0f766e',
                                      '#15803d',
                                      '#059669',
                                      '#16a34a',
                                      '#0d9488',
                                      '#065f46',
                                      '#166534'
                                    ];

                                    return (
                                      <Cell
                                        key={`cell-${index}`}
                                        fill={clrs[index % clrs.length]}
                                      />
                                    );

                                  }
                                )}

                              </Pie>

                              <RechartsTooltip />

                            </PieChart>

                          ) : saudaReportOutput.chartType === 'composed' ? (

                            <ComposedChart
                              data={saudaReportOutput.chartData}
                              margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                            >

                              <CartesianGrid stroke="#d1fae5" />

                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 7.5 }}
                              />

                              <YAxis
                                tick={{ fontSize: 7.5 }}
                              />

                              <RechartsTooltip />

                              <Legend wrapperStyle={{ fontSize: 7.5 }} />

                              <Bar
                                dataKey="lorries"
                                name="Lorry Dispatches (Trips)"
                                fill="#047857"
                                barSize={20}
                              />

                              <Line
                                type="monotone"
                                dataKey="payload"
                                name="Payload Capacity Specs (MT)"
                                stroke="#0f766e"
                                strokeWidth={2.5}
                              />

                            </ComposedChart>

                          ) : saudaReportOutput.chartType === 'hbar' ? (

                            <BarChart
                              data={saudaReportOutput.chartData}
                              layout="vertical"
                              margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                            >

                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#d1fae5"
                              />

                              <XAxis
                                type="number"
                                tick={{ fontSize: 7.5 }}
                              />

                              <YAxis
                                dataKey="name"
                                type="category"
                                tick={{ fontSize: 7.5 }}
                                width={80}
                              />

                              <RechartsTooltip />

                              <Bar
                                dataKey="weight"
                                name="Weighed Tons (MT)"
                                fill="#0f766e"
                                radius={[0, 5, 5, 0]}
                              />

                            </BarChart>

                          ) : (

                            <BarChart
                              data={saudaReportOutput.chartData}
                              margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                            >

                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#d1fae5"
                              />

                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 7.5 }}
                              />

                              <YAxis
                                tick={{ fontSize: 7.5 }}
                              />

                              <RechartsTooltip />

                              <Bar
                                dataKey="weight"
                                name="Outward Volume (MT)"
                                fill="#047857"
                                radius={[5, 5, 0, 0]}
                              >

                                {saudaReportOutput.chartData.map(
                                  (entry, index) => {

                                    const clrs = [
                                      '#047857',
                                      '#0f766e',
                                      '#15803d',
                                      '#059669',
                                      '#16a34a',
                                      '#0d9488',
                                      '#065f46',
                                      '#166534'
                                    ];

                                    return (
                                      <Cell
                                        key={`cell-${index}`}
                                        fill={clrs[index % clrs.length]}
                                      />
                                    );

                                  }
                                )}

                              </Bar>

                            </BarChart>

                          )}

                        </ResponsiveContainer>

                      )}

                    </div>

                  </div>


                  {/* LEDGER TABLE */}
                  <div className="bg-white border border-emerald-100 rounded-xl p-4 shadow-sm">

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">

                      <div>

                        <h4 className="text-[9px] font-black uppercase text-emerald-950 tracking-wider">
                          Consolidated Outbound Ledger
                        </h4>

                        <p className="text-[7.5px] text-slate-400 italic">
                          Audit values and generated records satisfying filter parameters
                        </p>

                      </div>

                      <span className="text-[8px] text-emerald-700 font-mono font-bold bg-emerald-50 px-2 py-1 rounded-lg">
                        Mapped: {saudaReportOutput.rows.length} records
                      </span>

                    </div>


                    <div className="border border-emerald-100 rounded-xl overflow-x-auto overflow-y-auto max-h-[420px]">

                      <table
                        className="w-full min-w-max text-left font-mono text-[9px] border-collapse"
                        id="sauda-advanced-ledger"
                      >

                        <thead className="sticky top-0 z-10">

                          <tr className="bg-emerald-800 text-white border-b border-emerald-900">

                            {saudaReportOutput.headers.map((h, i) => (

                              <th
                                key={i}
                                className="
                                  p-2.5
                                  font-black
                                  uppercase
                                  text-[8px]
                                  border-r
                                  border-emerald-700
                                  whitespace-nowrap
                                "
                              >
                                {h}
                              </th>

                            ))}

                          </tr>

                        </thead>


                        <tbody className="divide-y divide-slate-100">

                          {saudaReportOutput.rows.map((row, rindex) => (

                            <tr
                              key={rindex}
                              className="
                                hover:bg-emerald-50
                                odd:bg-slate-50/40
                                transition-colors
                              "
                            >

                              {row.map((cell, cindex) => (

                                <td
                                  key={cindex}
                                  className={cn(
                                    "p-2 border-r border-slate-100 font-mono tracking-tight text-slate-800 whitespace-nowrap",
                                    cindex === 0
                                      ? "font-bold text-emerald-900 text-[9.5px]"
                                      : ""
                                  )}
                                >
                                  {cell}
                                </td>

                              ))}

                            </tr>

                          ))}


                          {saudaReportOutput.rows.length === 0 && (

                            <tr className="h-24">

                              <td
                                colSpan={
                                  saudaReportOutput.headers.length || 6
                                }
                                className="text-center font-bold text-slate-400 italic"
                              >
                                No active transactional database logs satisfying filters.
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

        </div>

        )}

        {/* --- 3. MAP WISE P.O --- */}
         {reportType === 'po_summary' && (
            <div className="bg-emerald-800 border-2 border-emerald-950 shadow-[2px_2px_0_0_rgba(0,0,0,0.5)] p-4 rounded-sm">
              <PurchaseOrderSummary refreshTrigger={refreshTrigger} />
            </div>
          )}

          {reportType === 'map_wise_po' && (
          <div className="space-y-4">
             {/* Map Page Header Option Bar - All Options in Single Bar, no text */}
              <div className="bg-white p-2 border border-slate-200 shadow-sm rounded-lg flex items-center justify-start gap-3 flex-wrap">
                {/* Sourcing Stats Box on Left Side */}
                <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-md shadow-sm text-white font-mono text-[8.5px] font-black tracking-wider flex items-center gap-2">
                  <span>
                    ACTIVE {sourcingGroupMode === 'area' ? 'AREAS' : sourcingGroupMode === 'agency' ? 'AGENCIES' : 'REGIONS'}:
                    <span className="text-emerald-400 ml-1">
                      {areaGroupedPo.length}
                    </span>
                  </span>

                  <span className="text-slate-500">•</span>

                  <span>
                    GLOBAL MT TONS:
                    <span className="text-cyan-400 ml-1">
                      {poData.reduce((acc,p) => acc + (Number(p.total_contract_mt)||0), 0).toFixed(2)} MT
                    </span>
                  </span>
                </div>

                {/* Divider */}
                <span className="text-slate-300 hidden lg:inline">|</span>

                {/* Map Modes */}
                <div className="flex items-center gap-1.5 flex-wrap font-sans">

                  <button
                    onClick={() => setMapMode('street')}
                    className={cn(
                      "px-3 py-1.5 text-[8.5px] font-bold uppercase border rounded-md transition-all duration-150 cursor-pointer",
                      mapMode === 'street'
                        ? "bg-emerald-700 text-white border-emerald-700 shadow-sm font-black"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
                    )}
                  >
                    🗺️ OPENSTREETMAP STD
                  </button>

                  <button
                    onClick={() => setMapMode('voyager')}
                    className={cn(
                      "px-3 py-1.5 text-[8.5px] font-bold uppercase border rounded-md transition-all duration-150 cursor-pointer",
                      mapMode === 'voyager'
                        ? "bg-emerald-700 text-white border-emerald-700 shadow-sm font-black"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
                    )}
                  >
                    🎨 VOYAGER ACCENT
                  </button>

                  <button
                    onClick={() => setMapMode('cyber')}
                    className={cn(
                      "px-3 py-1.5 text-[8.5px] font-bold uppercase border rounded-md transition-all duration-150 cursor-pointer",
                      mapMode === 'cyber'
                        ? "bg-slate-900 text-cyan-400 border-slate-900 shadow-sm font-black"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                    )}
                  >
                    📡 CYBER RADAR
                  </button>

                </div>

                {/* Divider */}
                <span className="text-slate-300 hidden md:inline">|</span>

                {/* Sourcing Category Modes */}
                <div className="flex items-center gap-1.5 flex-wrap font-sans">

                  <button
                    onClick={() => setSourcingGroupMode('area')}
                    className={cn(
                      "px-3 py-1.5 text-[8.5px] font-bold uppercase border rounded-md transition-all duration-150 cursor-pointer",
                      sourcingGroupMode === 'area'
                        ? "bg-emerald-700 text-white border-emerald-700 shadow-sm font-black"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
                    )}
                  >
                    🗺️ AREA WISE
                  </button>

                  <button
                    onClick={() => setSourcingGroupMode('agency')}
                    className={cn(
                      "px-3 py-1.5 text-[8.5px] font-bold uppercase border rounded-md transition-all duration-150 cursor-pointer",
                      sourcingGroupMode === 'agency'
                        ? "bg-emerald-700 text-white border-emerald-700 shadow-sm font-black"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
                    )}
                  >
                    🏢 AGENCY WISE
                  </button>

                  <button
                    onClick={() => setSourcingGroupMode('both')}
                    className={cn(
                      "px-3 py-1.5 text-[8.5px] font-bold uppercase border rounded-md transition-all duration-150 cursor-pointer",
                      sourcingGroupMode === 'both'
                        ? "bg-emerald-700 text-white border-emerald-700 shadow-sm font-black"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800"
                    )}
                  >
                    🏷️ ALL (COMBINED)
                  </button>

                </div>

              </div>
             

             <div className="flex flex-col gap-4">
                
                {/* Real-time OpenStreetMap Sourcing Tracker or Cyber Abstract Terminal */}
                <div className="w-full space-y-3 flex flex-col justify-between overflow-hidden">

                   {mapMode === 'cyber' ? (
                      <div className="bg-slate-950 border-2 border-slate-800 h-[450px] w-full relative rounded-sm overflow-hidden shadow-inner flex flex-col justify-between p-3 ">
                     
                     {/* Cyber Tech Grid Background overlay */}
                     <div className="absolute inset-0 bg-transparent flex flex-col pointer-events-none opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                     
                     {/* Compass Dial Indicator background */}
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full border border-slate-850/15 pointer-events-none flex items-center justify-center">
                       <span className="w-48 h-48 rounded-full border border-dotted border-slate-850/20"></span>
                     </div>

                     {/* Radar sweep retro sweep bar */}
                     <div className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-500/5 to-transparent skew-x-12 animate-pulse pointer-events-none"></div>

                     {/* Grid Coordinates display */}
                     <div className="flex justify-between items-center text-[7.5px] font-bold text-slate-500 font-mono tracking-tight shrink-0 z-10">
                       <span className="uppercase">[Sensing Array Sector: Grid-3B]</span>
                       <span className="text-center font-extrabold uppercase animate-pulse text-sky-400 flex items-center gap-1">
                         <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block animate-ping"></span>
                         LIVE PO FEED CONSOLE ACCURATE
                       </span>
                     </div>

                     {/* Interactive Glowing Pins inside the geographic frame */}
                     <div className="flex-1 w-full relative min-h-[290px]">
                       {areaGroupedPo.map((area, idx) => {
                          const { x, y } = getDeterministicCoords(area.name);
                          const isSelected = selectedArea === area.name;
                          return (
                            <div 
                              key={area.name} 
                              className="absolute transition-all duration-350 cursor-pointer group"
                              style={{ left: `${x}%`, top: `${y}%` }}
                              onClick={() => {
                                setSelectedArea(area.name);
                              }}
                            >
                               {/* Pulsing glow halo represent supply volume */}
                               <span className={cn(
                                 "absolute -left-3 -top-3 w-8 h-8 rounded-full border opacity-20 pointer-events-none transition-all scale-100 group-hover:scale-125 duration-300",
                                 isSelected ? "bg-amber-400 border-amber-300 scale-150 opacity-40 animate-ping" : "bg-sky-500 border-sky-400"
                               )}></span>

                               {/* Pin Core component */}
                               <div className="relative flex items-center justify-center">
                                 <span className={cn(
                                   "w-3 h-3 rounded-full border border-white relative z-10 flex items-center justify-center transition-all shadow-md",
                                   isSelected ? "bg-amber-400 scale-125 ring-2 ring-black" : "bg-sky-600 group-hover:bg-sky-400"
                                 )}>
                                   <span className="w-1 h-1 bg-white rounded-full"></span>
                                 </span>
                                 
                                 {/* Floating Pin popup Label */}
                                 <div className={cn(
                                   "absolute left-6 top-1/2 -translate-y-1/2 whitespace-nowrap bg-slate-900 border text-white font-mono text-[10px] font-black p-1.5 px-2.5 shadow-md rounded-sm z-30 transition-all uppercase flex gap-2 items-center",
                                   isSelected 
                                     ? "border-amber-300 bg-amber-950/95 text-amber-100 ring-1 ring-amber-500 scale-105" 
                                     : "border-slate-700 bg-slate-900/90 text-slate-300 opacity-90 group-hover:opacity-100 group-hover:border-sky-400"
                                 )}>
                                    <MapPin className={cn("h-3.5 w-3.5 animate-pulse", isSelected ? "text-amber-300" : "text-sky-400")} />
                                    <span className="font-sans font-black tracking-wider text-[11px]">{area.name}</span>
                                    <span className={cn("font-bold px-1 py-0.5 rounded text-[9.5px]", isSelected ? "bg-amber-900/60 text-amber-250 animate-pulse" : "bg-sky-950 text-sky-300")}>{area.count} P.O.</span>
                                    <span className="text-emerald-400 font-extrabold font-mono text-[10px]">({parseFloat(area.totalTons.toFixed(1))} MT)</span>
                                 </div>
                               </div>
                            </div>
                          );
                       })}
                     </div>

                     {/* Interactive HUD Instructions / Indicator keys */}
                     <div className="flex justify-between items-end border-t border-slate-800/80 pt-2 shrink-0 z-10 ">
                       <div className="flex gap-4 text-[7px] font-bold text-slate-500 font-mono">
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block"></span>
                            <span>INACTIVE SELECTION</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-ping"></span>
                            <span className="text-slate-300">ACTIVE REGION TARGET</span>
                          </div>
                       </div>
                       <div className="text-[7.5px] font-extrabold text-slate-400 font-mono block">
                         AUTO MATRIX COORDINATES VERIFIED
                       </div>
                     </div>
                   </div>
                    ) : (
                       /* Live Free OpenStreetMap / Voyager Map Container with dynamic centering */
                       <div className="relative border border-slate-400 h-[450px] w-full rounded-sm overflow-hidden bg-slate-100 shadow-inner" style={{ height: '450px' }}>
                          <PigeonMap
                            center={center}
                            zoom={zoom}
                            onBoundsChanged={({ center: newCenter, zoom: newZoom }) => {
                              setCenter(newCenter);
                              setZoom(newZoom);
                            }}
                            provider={mapMode === 'voyager' ? voyagerProvider : osmProvider}
                            height={450}
                          >
                            {areaGroupedPo.map(area => {
                               const coords = getAreaCoordinates(area.name);
                               const isSelected = selectedArea === area.name;
                               return (
                                 <PigeonOverlay
                                   key={area.name}
                                   anchor={[coords.lat, coords.lng]}
                                   offset={[0, 0]}
                                 >
                                   <div 
                                     onClick={() => setSelectedArea(area.name)}
                                     className="relative group/marker cursor-pointer flex flex-col items-center "
                                     style={{ transform: 'translate(-50%, -100%)' }}
                                   >
                                      {/* Pulsing ring halo */}
                                      <span className={cn(
                                        "absolute w-12 h-12 rounded-full border opacity-25 pointer-events-none transition-all scale-100 group-hover/marker:scale-125 duration-300 -translate-y-4",
                                        isSelected ? "bg-amber-400 border-amber-300 scale-150 opacity-40 animate-ping" : "bg-teal-505 border-teal-400 opacity-0"
                                      )}></span>
                                      
                                      {/* Drop shadow indicator */}
                                      <div className="w-2.5 h-1.5 bg-slate-900 rounded-full blur-[1px] opacity-40 translate-y-[2px]"></div>

                                      {/* Dynamic Badge Capsule representing the sourcing region */}
                                      <div className={cn(
                                        "flex items-center gap-1 px-1.5 py-0.5 rounded-sm border-2 shadow-md transition-all transform hover:-translate-y-0.5",
                                        isSelected 
                                          ? "bg-amber-600 border-amber-300 text-white font-extrabold scale-105 z-40" 
                                          : "bg-teal-800 border-teal-500 text-teal-50 hover:bg-teal-700 scale-100 z-10"
                                      )}>
                                        <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-200 animate-bounce" />
                                        <div className="flex flex-col text-left leading-none font-sans">
                                          <span className="text-[11px] font-black tracking-tight uppercase whitespace-nowrap">{area.name}</span>
                                          <span className="text-[9.5px] font-mono opacity-90 mt-0.5 flex gap-1.5 items-center whitespace-nowrap font-bold">
                                             <span>{area.count} P.O.</span>
                                             <span className="opacity-45">|</span>
                                             <span className="text-yellow-300 font-extrabold">{parseFloat(area.totalTons.toFixed(1))} MT</span>
                                          </span>
                                        </div>
                                      </div>
                                   </div>
                                 </PigeonOverlay>
                               );
                            })}
                          </PigeonMap>
                       </div>
                    )}

                   {/* Registry Breakdown under the Map */}
                   <div className="bg-white border border-gray-400 p-2.5 rounded-sm flex flex-col justify-between shadow-sm">
                     <span className="text-[10px] font-black uppercase text-slate-800 tracking-wider mb-2">
                       {sourcingGroupMode === 'area' && 'Area-wise Jute Sourcing Registry'}
                       {sourcingGroupMode === 'agency' && 'Agency-wise Jute Sourcing Registry'}
                       {sourcingGroupMode === 'both' && 'Area & Agency Combined Sourcing Registry'}
                     </span>
                     <div className="max-h-[148px] overflow-auto border border-gray-200">
                        <table className="w-full text-left text-[9px] border-collapse relative">
                          <thead className="bg-[#e4e0d8] font-bold sticky top-0 border-b border-gray-300">
                             <tr>
                               <th className="p-1 px-2 border-r border-gray-300">{sourcingGroupMode === 'area' ? 'SOURCING AREA' : sourcingGroupMode === 'agency' ? 'SOURCING AGENCY' : 'AREA & AGENCY COMBINED'}</th>
                               <th className="p-1 text-center border-r border-gray-300 w-24">PO COUNT</th>
                               <th className="p-1 text-right border-r border-gray-300 w-28">WEIGHT IN MT</th>
                               <th className="p-1 text-right w-24">% RATIO MAP</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                             {areaGroupedPo.map((areaItem, idx) => {
                               const isActive = selectedArea === areaItem.name;
                               return (
                                 <tr 
                                   key={idx} 
                                   onClick={() => setSelectedArea(areaItem.name)}
                                   className={cn(
                                     "hover:bg-[#ffffd0]/60 cursor-pointer font-bold  h-7",
                                     isActive ? "bg-amber-100 text-amber-955 font-black border-l-2 border-amber-600" : "even:bg-white/60"
                                   )}
                                 >
                                    <td className="p-1 px-2 font-mono uppercase font-black truncate max-w-[170px]" title={areaItem.name}>
                                       {areaItem.name}
                                    </td>
                                    <td className="p-1 text-center font-mono text-slate-400">
                                       {areaItem.count} POs
                                    </td>
                                    <td className="p-1 px-2 text-right font-mono text-indigo-950">
                                       {areaItem.totalTons.toLocaleString()} MT
                                    </td>
                                    <td className="p-1 px-2 text-right">
                                       <span className="text-[8.5px] bg-[#bfdbfe]/30 font-black px-1 rounded inline-block text-blue-900">{areaItem.percentage}%</span>
                                    </td>
                                 </tr>
                               );
                             })}
                             {areaGroupedPo.length === 0 && (
                               <tr>
                                 <td colSpan={4} className="p-4 text-center text-gray-400 italic">No agency records in the DB master list.</td>
                               </tr>
                             )}
                          </tbody>
                        </table>
                     </div>
                   </div>
                </div>

                {/* Drill Down side-sheet details */}
                <div id="area-drilldown-sheet" className="w-full bg-white border border-gray-400 p-3 flex flex-col justify-between rounded-sm shadow-sm font-sans">
                   <div className="space-y-4 overflow-hidden flex-1 flex flex-col">
                      <div>
                        <h4 className="text-[10px] font-black uppercase text-slate-800 tracking-wider">{sourcingGroupMode === 'area' ? 'Area & Sourcing Grade Detail Audit' : sourcingGroupMode === 'agency' ? 'Agency & Sourcing Grade Detail Audit' : 'Combined Area/Agency Grade Audit'}</h4>
                        <p className="text-[8.5px] text-gray-450 italic mb-1">{sourcingGroupMode === 'area' ? 'Details representing currently selected Sourcing Area' : sourcingGroupMode === 'agency' ? 'Details representing currently selected Sourcing Agency' : 'Details representing currently selected Sourcing Area & Agency'}</p>
                      </div>

                      {selectedAreaDetail ? (
                        <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                           <div className="bg-slate-50 border border-slate-200 p-2 text-[10px]">
                              <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest block leading-none mb-1 font-mono">{sourcingGroupMode === 'area' ? 'Inspected Target Area' : sourcingGroupMode === 'agency' ? 'Inspected Target Agency' : 'Inspected Combined Segment'}</span>
                              <span className="text-sm font-black text-amber-955 uppercase tracking-tight block truncate">{selectedAreaDetail.name}</span>
                              
                              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200/50 font-mono text-[9px]">
                                 <div className="bg-white border p-1 block">
                                    <span className="block text-[7.5px] text-gray-400 font-bold uppercase">PO Items</span>
                                    <span className="font-black text-rose-700">{selectedAreaDetail.count} Lines</span>
                                 </div>
                                 <div className="bg-white border p-1 block">
                                    <span className="block text-[7.5px] text-gray-450 font-bold uppercase">Scale Sum</span>
                                    <span className="font-black text-indigo-950">{selectedAreaDetail.totalTons} MT</span>
                                 </div>
                              </div>
                           </div>

                           <span className="text-[8px] font-extrabold text-slate-400 uppercase font-mono block mb-1">Detailed Listings ({selectedAreaDetail.pos.length})</span>
                           <div className="flex-1 overflow-auto border border-gray-200 bg-slate-50">
                             <div className="divide-y divide-slate-200">
                               {selectedAreaDetail.pos.map((p, idx) => (
                                  <div key={p.po_id || idx} className="p-2 text-[9.5px] hover:bg-slate-100 border-l-[3px] border-l-slate-300">
                                    <div className="flex justify-between items-start font-mono">
                                       <span className="font-extrabold text-blue-900 border-b border-dashed border-slate-300 text-[10px] leading-tight select-all">#{p.po_no}</span>
                                       <span className="text-gray-400 text-[8px] italic">{p.po_date ? new Date(p.po_date).toLocaleDateString('en-GB') : ''}</span>
                                    </div>
                                    <div className="mt-1 font-bold text-slate-800 truncate flex justify-between gap-1 items-baseline">
                                       <span className="truncate max-w-[130px] font-bold text-slate-800" title={p.supplier}>{p.supplier || 'DIRECT'}</span>
                                       <span className="text-indigo-900 font-black shrink-0 font-mono">{p.total_contract_mt ? `${p.total_contract_mt} MT` : '--'}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-1 text-[8.2px] font-mono mt-1 font-bold text-slate-500 bg-white p-1 border border-slate-100 rounded-sm">
                                       <div className="truncate">AREA: <span className="text-teal-600 font-extrabold">{p.area || 'DIRECT SOURCING'}</span></div>
                                       <div className="truncate font-bold">GRADE: <span className="text-rose-600 font-extrabold">{p.grade_name || 'STANDARD'}</span></div>
                                    </div>
                                    <div className="text-[7.5px] text-gray-400 italic mt-0.5 font-mono">
                                       Broker: {p.broker || 'DIRECT'}
                                    </div>
                                  </div>
                               ))}
                             </div>
                           </div>
                        </div>
                      ) : (
                        <div className="h-56 flex flex-col justify-center items-center text-gray-400 italic bg-slate-50 border border-dashed border-slate-200 rounded-sm p-4">
                           <MapPin className="h-6 w-6 text-slate-300 mb-1" />
                           <span className="text-center text-[9px]">Select overlay agency from the Map or Sourcing registry list to load live purchase lists.</span>
                        </div>
                      )}
                   </div>

                   <button 
                     onClick={() => {
                        if (areaGroupedPo.length > 0) {
                           setSelectedArea(areaGroupedPo[0].name);
                        } else {
                           setSelectedArea(null);
                        }
                     }}
                     className="w-full mt-3 bg-[#d4d0c8] py-1.5 border border-white hover:bg-white text-[9.5px] font-bold uppercase shadow-[1px_1px_0_0_black]"
                   >
                     Select Default Prime Agency
                   </button>
                </div>
             </div>
          </div>
        )}

        {reportType === 'data_aggregation' && (
          <div className="bg-slate-50 border border-slate-200 shadow-sm p-4 space-y-4 rounded-xl">

            {/* Header Bar */}
            <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 border border-slate-200 shadow-sm rounded-lg">

              <div>
                <h3 className="text-sm font-black uppercase text-emerald-800 tracking-wide">
                  Multi-Module ERP Historical Data Aggregator
                </h3>

                <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-wide">
                  Queries real-time data from Supabase, aggregates master lists, and formats 10 specialized reports.
                </p>
              </div>

              <div className="flex items-end gap-3">

                {/* Search Box */}
                <div className="flex flex-col">
                  <label
                    htmlFor="agg-report-search"
                    className="text-[8px] font-black text-slate-500 uppercase tracking-wider ml-1 mb-1"
                  >
                    Filter Records
                  </label>

                  <input
                    name="filter_records"
                    aria-label="Filter Records"
                    id="agg-report-search"
                    type="text"
                    placeholder="Search result rows..."
                    value={aggSearchTerm}
                    onChange={(e) => setAggSearchTerm(e.target.value)}
                    className="bg-slate-50 text-[10px] border border-slate-300 px-3 py-2 w-48 font-semibold rounded-md text-slate-800 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 placeholder:text-slate-400"
                  />
                </div>

                {/* Export CSV Button */}
                <div>
                  <button
                    id="download-agg-csv"
                    onClick={handleExportAggCSV}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white border border-emerald-800 shadow-sm text-[10px] font-black uppercase px-4 py-2 flex items-center gap-2 tracking-wide cursor-pointer rounded-md transition-all active:scale-[0.98]"
                  >
                    📥 Export Active to CSV
                  </button>
                </div>

              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

              {/* Reports List Left Sidebar */}
              <div className="md:col-span-1 space-y-1.5 bg-white p-3 border border-slate-200 shadow-sm rounded-lg">

                <p className="text-[9px] font-black uppercase text-emerald-800 tracking-wider mb-3 border-b border-slate-200 pb-2">
                  Suite 10 Aggregated Reports
                </p>

                {[
                  { key: 'monthly_po_summary', label: '1. PO Month-Wise Summary' },
                  { key: 'yearly_po_summary', label: '2. PO Year-Wise Summary' },
                  { key: 'monthly_sauda_summary', label: '3. Sauda Month-Wise Summary' },
                  { key: 'yearly_sauda_summary', label: '4. Sauda Year-Wise Summary' },
                  { key: 'po_broker_distribution', label: '5. PO Broker Share' },
                  { key: 'po_supplier_distribution', label: '6. PO Supplier Share' },
                  { key: 'sauda_broker_distribution', label: '7. Sauda Broker Share' },
                  { key: 'sauda_supplier_distribution', label: '8. Sauda Supplier Share' },
                  { key: 'po_area_sourcing', label: '9. PO Sourcing Regions' },
                  { key: 'sauda_transport_logistics', label: '10. Sauda Transit Logistics' }
                ].map((it) => (
                  <button
                    id={`agg-report-btn-${it.key}`}
                    key={it.key}
                    onClick={() => {
                      setActiveAggReportKey(it.key);
                      setAggSearchTerm('');
                    }}
                    className={cn(
                      "w-full text-left font-black uppercase tracking-wide text-[9px] px-3 py-2 transition-all rounded-md border cursor-pointer",
                      activeAggReportKey === it.key
                        ? "bg-emerald-700 border-emerald-700 text-white shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-800"
                    )}
                  >
                    {it.label}
                  </button>
                ))}
              </div>

              {/* Active Report Table Right Column */}
              <div className="md:col-span-3 space-y-3">

                {/* Meta Statement */}
                <div className="bg-white border border-slate-200 px-3 py-2.5 text-[10px] font-bold text-slate-600 flex justify-between items-center rounded-lg shadow-sm">

                  <span>
                    {computedAggReport.summary}
                  </span>

                  <span className="text-[8px] font-black tracking-wide bg-emerald-50 text-emerald-700 px-2 py-1 border border-emerald-200 rounded-md">
                    ACTIVE REPORT STATUS: LIVE
                  </span>

                </div>

                {/* Grid Table Container */}
                <div className="bg-white border border-slate-200 shadow-sm overflow-x-auto min-h-[350px] rounded-lg">

                  <table className="w-full text-left text-[10px] font-bold border-collapse min-w-[800px]">

                    <thead className="bg-emerald-700 text-white uppercase tracking-wider sticky top-0">
                      <tr>
                        {computedAggReport.headers.map((h, idx) => (
                          <th
                            key={idx}
                            className="px-3 py-2.5 border-r border-emerald-600 font-black uppercase text-[9px] whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">

                      {computedAggReport.rows.length > 0 ? (
                        computedAggReport.rows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className="hover:bg-emerald-50/60 transition-colors"
                          >
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className="px-3 py-2 border-r border-slate-100 font-mono text-slate-700 whitespace-nowrap"
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={computedAggReport.headers.length}
                            className="px-3 py-16 text-center text-slate-400 italic"
                          >
                            No matching aggregates found. Make sure data is seeded in purchase_master and sauda_master.
                          </td>
                        </tr>
                      )}

                    </tbody>

                  </table>
                </div>

              </div>
            </div>

          </div>
        )}
         {/* {reportType === 'payment_report' && (
           <PaymentReport></PaymentReport>
         )} */}
         {/* {reportType === 'trade' && (
           <TradeReport
             saudaData={saudaData}
             saudaDetails={saudaDetails}
             amadData={amadData}
             onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
           />
         )} */}

        <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-1  text-gray-450 border-t border-gray-300 mt-2">
           <div className="flex items-center gap-3">
              <History className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-[9px] font-bold uppercase tracking-widest italic leading-none text-gray-500">Live Connection Stable // Operational Control Console Enabled // Database Realtime Sourced</span>
           </div>
           
           <span className="text-[9.5px] font-black italic text-indigo-700 bg-white/60 px-2 py-0.5 border border-slate-300 uppercase shrink-0 font-mono">
             ERP REQ PORTLET: SECURE
           </span>
        </div>
      </div>
    </LegacyLayout>
  );
}
