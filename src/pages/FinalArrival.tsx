import React, { useState, useEffect } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Search, 
  RefreshCw, 
  Download, 
  X, 
  FileText, 
  Info,
  Calendar,
  AlertCircle,
  AlertTriangle,
  Truck,
  TrendingDown,
  TrendingUp,
  Scale,
  Plus,
  Edit,
  Trash2,
  FileSpreadsheet,
  Layers,
  Printer,
  Calculator,
  Bell,
  ChevronDown,
  PackageCheck,
  Package,
  Clock,
  Leaf,
  ShieldCheck,
  ClipboardCheck,
  RefreshCcw,
  Filter
} from 'lucide-react';
import Papa from 'papaparse';
import { cn, sanitizeCsvData } from '../lib/utils';
import { enforceEditOrDeletePermission, canEditOrDelete, canViewCompletedData, getCurrentUserContext } from '../lib/permissions';
import { PaginationControls } from '../components/PaginationControls';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import { supabase } from '../lib/supabase';
import { dbModule } from '../services/dbModule';
import FinalArrivalEntry from './FinalArrivalEntry';
import PrintModal from '../components/PrintModal';
import FinalArrivalReconciliation from '../components/FinalArrivalReconciliation';

const FactorySketchIllustration = () => (
  <svg className="w-32 h-20 opacity-80" viewBox="0 0 200 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 100 Q 50 70 100 95 Q 150 110 190 90 L 190 110 L 10 110 Z" fill="#E6DDC8" opacity="0.5" />
    <rect x="150" y="30" width="14" height="70" fill="#476A35" opacity="0.8" />
    <polygon points="148,30 166,30 164,25 150,25" fill="#1E4D2B" />
    <path d="M157 20 Q 152 10 162 5 T 155 -5" stroke="#C6A15B" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.6" />
    <rect x="30" y="55" width="115" height="45" fill="#1E4D2B" opacity="0.85" rx="1" />
  </svg>
);

interface FinalArrivalRecord {
  final_arrival_id: string;
  financial_year: string;
  final_arrival_no: string;
  mr_no: string | null;
  po_no: string | null;
  po_date: string | null;
  date: string | null;
  jci: string | null;
  challan_supplier: string | null;
  supplier: string | null;
  broker: string | null;
  transporter_name: string | null;
  challan_rr_no: string | null;
  challan_railway_receipt_no?: string | null;
  challan_rr_date: string | null;
  lorry_number: string | null;
  pan_no: string | null;
  consignment_note?: string | null;
  consignment_note_no: string | null;
  consignment_note_date?: string | null;
  di_no: string | null;
  di_date: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  ptf: string | null;
  arrival_area_code: string | null;
  arrival_area_name: string | null;
  unit_code?: string | null;
  unit_name: string | null;
  total_packets: number | null;
  weight_qtl: number | null;
  remarks: string | null;
  grid_details: any;
  created_at?: string;
  
  // Weighments
  challan_material_weight?: number;
  actual_gross_weight?: number;
  actual_tare_weight?: number;
  supplier_net_weight?: number;
  supplier_challan_gross?: number;
  supplier_tare_weight?: number;
  electronic_net_weight?: number;
  electronic_gross_weight?: number;
  electronic_tare_weight?: number;
  status?: string | null;
  packets?: number | null;
}

interface FinalArrivalProps {
  onClose?: () => void;
  isArchiveView?: boolean;
  initialData?: any;
  onNavigate?: (id: string) => void;
}

export const calculateNetWeightVal = (
  gross: number,
  moisture: number,
  dust: number,
  ncv: number,
  arrivalAreaName: string,
  poDateStr: string,
  generalDateStr?: string
): string => {
  if (!gross) return "";
  
  let month = 0;
  let dateToParse = poDateStr || generalDateStr;
  if (dateToParse) {
    const d = new Date(dateToParse);
    if (!isNaN(d.getTime())) {
      month = d.getMonth();
    }
  }

  const areaNameClean = String(arrivalAreaName || '').toLowerCase();
  const isDaisee = areaNameClean.includes("daisee");
  
  let moistureLimit = 16;
  const isJanToJune = month >= 0 && month <= 5;
  
  if (isJanToJune) {
    if (isDaisee) {
      moistureLimit = 18;
    } else {
      moistureLimit = 16;
    }
  } else {
    if (isDaisee) {
      moistureLimit = 20;
    } else {
      moistureLimit = 18;
    }
  }

  const moistureExcessPct = moisture > moistureLimit ? (moisture - moistureLimit) : 0;
  const totalDeductionPct = moistureExcessPct + dust + ncv;
  const netWeight = gross * (1 - totalDeductionPct / 100);
  return netWeight.toFixed(3);
};

export default function FinalArrival({ onClose, isArchiveView = false, initialData, onNavigate }: FinalArrivalProps) {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<FinalArrivalRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<FinalArrivalRecord | null>(null);

  // 100-rows per page pagination (searches full dataset, displays paginated)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, startDateFilter, endDateFilter]);
  
  // View states
  const [viewState, setViewState] = useState<'list' | 'entry' | 'reconciliation'>(() => initialData ? 'entry' : 'list');
  const [editingRecord, setEditingRecord] = useState<FinalArrivalRecord | null>(() => initialData || null);

  useEffect(() => {
    if (initialData) {
      setEditingRecord(initialData);
      setViewState('entry');
    }
  }, [initialData]);
  const [unitList, setUnitList] = useState<string[]>(['BALES', 'DRUMS', 'LOOSE', 'P.BALES', 'H.BALES']);

  useEffect(() => {
    async function fetchUnits() {
      try {
        if (supabase) {
          const { data } = await supabase.from('unit_master').select('unit_name').order('unit_name');
          if (data && data.length > 0) {
            const fetched = data.map((u: any) => u.unit_name).filter(Boolean);
            setUnitList(prev => Array.from(new Set([...fetched, ...prev])));
          }
        }
      } catch (err) {
        console.warn("Failed to load unit_master in FinalArrival", err);
      }
    }
    fetchUnits();
  }, []);

  // Popover state for net weight deduction audit
  const [auditPopoverId, setAuditPopoverId] = useState<string | null>(null);

  const getQualityParams = (r: any) => {
    let moisture = 16;
    let dust = 0;
    let ncv = 0;
    if (r.grid_details) {
      try {
        const parsed = typeof r.grid_details === 'string' ? (r.grid_details === 'undefined' || r.grid_details === 'null' ? [] : JSON.parse(r.grid_details === "undefined" ? "null" : r.grid_details)) : r.grid_details;
        if (Array.isArray(parsed) && parsed.length > 0) {
          moisture = Number(parsed[0].moisture_pct || parsed[0].moisture || parsed[0].actual_moisture || 16);
          dust = Number(parsed[0].dust_pct || parsed[0].dust || parsed[0].actual_dust || 0);
          ncv = Number(parsed[0].ncv_pct || parsed[0].ncv || parsed[0].actual_ncv || 0);
        }
      } catch (e) {}
    } else {
      moisture = Number(r.moisture_pct || r.actual_moisture || 16);
      dust = Number(r.dust_pct || r.actual_dust || 0);
      ncv = Number(r.ncv_pct || r.actual_ncv || 0);
    }
    return { moisture, dust, ncv };
  };

  // Print Form System
  const [printData, setPrintData] = useState<any | null>(null);
  const [isPrintingModalOpen, setIsPrintingModalOpen] = useState(false);
  const [printColumns, setPrintColumns] = useState({
    crop_year: true,
    marka: true,
    quality: true,
    quantity_rcpt: true,
    unit: true,
    claim: false,
    gross_wt: true,
    moisture_pct: true,
    dust_pct: true,
    ncv_pct: false,
    net_wt: true,
    settlement: false,
    rate: false
  });

  const updatePrintRow = (idx: number, field: string, val: any) => {
    if (!printData) return;
    const updatedRows = [...printData.rows];
    updatedRows[idx][field] = val;

    if (field === 'gross_wt' || field === 'moisture_pct' || field === 'dust_pct' || field === 'ncv_pct') {
      const gross = Number(updatedRows[idx].gross_wt) || 0;
      const m = Number(updatedRows[idx].moisture_pct) || 0;
      const d = Number(updatedRows[idx].dust_pct) || 0;
      const n = Number(updatedRows[idx].ncv_pct) || 0;
      updatedRows[idx].net_wt = calculateNetWeightVal(
        gross,
        m,
        d,
        n,
        printData.arrival_area_name || '',
        printData.po_date || '',
        printData.date || ''
      );
    }

    setPrintData({ ...printData, rows: updatedRows });
  };

  // States summary cards
  const [stats, setStats] = useState({
    totalCount: 0,
    totalWeightMt: 0,
    totalPackets: 0,
    totalVehicles: 0
  });

  const fetchRecords = async () => {
    if (records.length === 0) setLoading(true);
    try {
      const targetTable = isArchiveView ? 'm.r_archive' : 'final_arrival';
      let { data, error } = await supabase
        .from(targetTable)
        .select('*')
        .order('created_at', { ascending: false });

      if (isArchiveView && (error || !data || data.length === 0)) {
        const altRes = await supabase.from('mr_archive').select('*').order('created_at', { ascending: false });
        if (altRes.data && altRes.data.length > 0) {
          data = altRes.data;
          error = null;
        } else {
          const rawRes = await supabase.from('final_arrival').select('*').eq('status', 'settled').order('created_at', { ascending: false });
          data = rawRes.data || [];
          error = null;
        }
      }

      if (error) throw error;

      let loadedRecords = (data || []) as FinalArrivalRecord[];
      if (!isArchiveView) {
        loadedRecords = loadedRecords.filter(r => r.status !== 'settled' && !(r as any).archived_at);
      }
      setRecords(loadedRecords);

      // Settle statistics
      let weightSumQtl = 0;
      let packetsSum = 0;
      const uniqueVehicles = new Set();

      loadedRecords.forEach(r => {
        weightSumQtl += Number(r.weight_qtl) || 0;
        packetsSum += getRcptQty(r);
        if (r.lorry_number || (r as any).lorry_no || (r as any).vehicle_no) {
          uniqueVehicles.add(String(r.lorry_number || (r as any).lorry_no || (r as any).vehicle_no).trim().toUpperCase());
        }
      });

      setStats({
        totalCount: loadedRecords.length,
        totalWeightMt: Number((weightSumQtl / 10).toFixed(3)), // 10 QTL = 1 MT
        totalPackets: packetsSum,
        totalVehicles: uniqueVehicles.size
      });
    } catch (e) {
      console.error('Failed to load final arrival registries:', e);
    } finally {
      setLoading(false);
    }
  };

  useLiveAutoRefresh(fetchRecords, [isArchiveView], { tables: ['final_arrival', 'm.r_archive'] });

  useEffect(() => {
    fetchRecords();
    const handleUpdate = () => {
      fetchRecords();
    };
    window.addEventListener('app-data-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('app-data-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handlePreparePrint = async (record: FinalArrivalRecord) => {
    setLoading(true);
    try {
      let inspectionMaster: any = null;
      let inspectionDetails: any[] = [];
      let mrSettlementMaster: any = null;
      let mrSettlementDetails: any[] = [];

      if (supabase) {
        if (record.mr_no) {
          const { data: mMaster, error: mMasterErr } = await supabase
            .from('mill_inspection_master')
            .select('*')
            .eq('mr_no', record.mr_no)
            .maybeSingle();

          if (!mMasterErr && mMaster) {
            inspectionMaster = mMaster;
            const { data: mDetails } = await supabase
              .from('mill_inspection_detail')
              .select('*')
              .eq('mr_no', mMaster.mr_no)
              .order('srl_no', { ascending: true });
            if (mDetails) inspectionDetails = mDetails;

            const { data: sMaster } = await supabase
              .from('mr_settlement_master')
              .select('*')
              .eq('mr_no', mMaster.mr_no)
              .maybeSingle();
            if (sMaster) {
              mrSettlementMaster = sMaster;
              const { data: sDetails } = await supabase
                .from('mr_settlement_detail')
                .select('*')
                .eq('mr_no', mMaster.mr_no)
                .order('srl_no', { ascending: true });
              if (sDetails) mrSettlementDetails = sDetails;
            }
          }
        }
      }

      let parsedGrid: any[] = [];
      if (record.grid_details) {
        if (typeof record.grid_details === 'string') {
          try {
            const parsed = record.grid_details === 'undefined' || record.grid_details === 'null' ? [] : JSON.parse(record.grid_details === "undefined" ? "null" : record.grid_details);
            if (Array.isArray(parsed)) {
              parsedGrid = parsed;
            }
          } catch(e) {}
        } else if (Array.isArray(record.grid_details)) {
          parsedGrid = record.grid_details;
        }
      }

      const parsedAgencyNames = parsedGrid
        .map((row: any) => (row.agency_name || '').trim())
        .filter(Boolean);
      const uniqueAgencies = Array.from(new Set(parsedAgencyNames));
      let finalArrivalAreaName = record.arrival_area_name || '';
      const agencyNameStr = uniqueAgencies.join(", ");
      if (agencyNameStr && !finalArrivalAreaName.includes(agencyNameStr)) {
        finalArrivalAreaName = `${finalArrivalAreaName} / ${agencyNameStr}`;
      }

      const mappedRows: any[] = (inspectionDetails.length > 0) ? inspectionDetails.map((det, i) => {
        const settRow = mrSettlementDetails.find(s => s.srl_no === det.srl_no);
        const gross = Number(det.challan_gross_wt) || 0;
        const moisture = Number(inspectionMaster?.actual_moisture) || 0;
        const dust = Number(inspectionMaster?.actual_dust) || 0;
        const ncv = Number(inspectionMaster?.actual_ncv) || 0;
        const netStr = calculateNetWeightVal(
          gross,
          moisture,
          dust,
          ncv,
          finalArrivalAreaName,
          record.po_date || '',
          record.date || ''
        );

        return {
          crop_year: det.crop_year || '2026-27',
          marka: det.marka || '',
          quality: det.stock_grade_name || '',
          quantity_rcpt: Number(det.quantity) || 0,
          unit: det.unit || 'BALES',
          gross_wt: gross || '',
          moisture_pct: moisture || '',
          dust_pct: dust || '',
          ncv_pct: ncv || '',
          net_wt: netStr || '',
          settlement_grade: settRow?.sett_grade || det.stock_grade_name || '',
          settlement_moisture: settRow?.sett_moisture_deduction || '',
          settlement_dust: settRow?.sett_dust_deduction || '',
          settlement_prem_less: settRow?.sett_all_diff || '',
          rate: mrSettlementMaster?.summary_rate_qtel || ''
        };
      }) : parsedGrid.filter(row => row.receipt_grade_name || row.challan_marka_name).map((p, i) => {
        return {
          crop_year: p.crop_year || '2026-27',
          marka: p.challan_marka_name || '',
          quality: p.receipt_grade_name || '',
          quantity_rcpt: p.quantity_rcpt || p.quantity_chln || p.quantity || 0,
          unit: p.unit || 'BALES',
          gross_wt: p.netto_pnto || p.weight || '',
          moisture_pct: '',
          dust_pct: '',
          ncv_pct: '',
          net_wt: p.netto_pnto || p.weight || '',
          settlement_grade: p.receipt_grade_name || '',
          settlement_moisture: '',
          settlement_dust: '',
          settlement_prem_less: '',
          rate: ''
        };
      });

      while (mappedRows.length < 8) {
        mappedRows.push({
          crop_year: '', marka: '', quality: '', quantity_rcpt: '', unit: '',
          gross_wt: '', moisture_pct: '', dust_pct: '', ncv_pct: '', net_wt: '',
          settlement_grade: '', settlement_moisture: '', settlement_dust: '', settlement_prem_less: '', rate: ''
        });
      }

      setPrintData({
        amad_no: record.final_arrival_no,
        date: record.date,
        po_no: record.po_no || '',
        po_date: record.po_date || record.date,
        mr_no: record.mr_no || '',
        mr_date: inspectionMaster?.mr_date || record.date,
        transporter_name: record.transporter_name || '',
        challan_rr_no: record.challan_rr_no || '',
        lorry_number: (record.lorry_number || (record as any).lorry_no || (record as any).vehicle_no) || '',
        arrival_area_name: finalArrivalAreaName,
        supplier: record.supplier || '',
        remarks: record.remarks || inspectionMaster?.remarks || '',
        rows: mappedRows
      });

      setIsPrintingModalOpen(true);
    } catch(e) {
      console.error("Error setting up print view:", e);
      alert("Failed to load full final arrival details, loading basic data.");
    } finally {
      setLoading(false);
    }
  };

  // Background Auto-Sync States
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState("");
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [detectedConflicts, setDetectedConflicts] = useState<any[]>([]);
  const [showConflictsAlert, setShowConflictsAlert] = useState(false);

  const toggleAutoSync = () => {
    setAutoSyncEnabled(prev => !prev);
  };

  const runBackgroundStatusSync = async (silent = true) => {
    try {
      // 1. Fetch current final_arrival records directly from database
      const { data: arrivals, error: arrivalsErr } = await supabase
        .from('final_arrival')
        .select('*');

      if (arrivalsErr) throw arrivalsErr;
      if (!arrivals || arrivals.length === 0) return;

      // 2. Fetch all finalized inspections
      const { data: inspections, error: inspectionsErr } = await supabase
        .from('mill_inspection_master')
        .select('*');

      if (inspectionsErr) throw inspectionsErr;
      if (!inspections || inspections.length === 0) {
        if (!silent) {
          setSyncStatusMessage("No finalized quality audit records found in the system.");
          setTimeout(() => setSyncStatusMessage(""), 4000);
        }
        return;
      }

      // 3. Scan & analyze for data mismatches or quality audit conflicts
      const conflictsList: any[] = [];
      arrivals.forEach((record) => {
        const match = inspections.find(ins => {
          if (record?.mr_no && ins?.mr_no && String(record.mr_no).trim().toUpperCase() === String(ins.mr_no).trim().toUpperCase()) {
            return true;
          }
          const insArrivalNo = String(ins?.arrival_no || '').trim().toUpperCase();
          const recTempArrivalNo = String(record?.temporary_arrival_no || '').trim().toUpperCase();
          const recFinalArrivalNo = String(record?.final_arrival_no || '').trim().toUpperCase();
          
          const amadMatch = insArrivalNo && (insArrivalNo === recTempArrivalNo || insArrivalNo === recFinalArrivalNo);
          
          const insSupplier = String(ins?.supplier_name || '').trim().toUpperCase();
          const recSupplier = String(record?.supplier || '').trim().toUpperCase();
          
          const lorryMatch = (record?.lorry_number || (record as any)?.lorry_no || (record as any)?.vehicle_no) && ins?.arrival_date && 
            String(ins?.arrival_no || '').toUpperCase().includes(String((record?.lorry_number || (record as any)?.lorry_no || (record as any)?.vehicle_no)).trim().toUpperCase()) &&
            insSupplier === recSupplier;

          return amadMatch || lorryMatch;
        });

        if (match) {
          const itemConflicts: { field: string; label: string; arrivalVal: any; qualityVal: any }[] = [];
          
          // PO Number
          const recPo = String(record.po_no || '').trim().toUpperCase();
          const insPo = String(match.po_no || '').trim().toUpperCase();
          if (recPo && insPo && recPo !== insPo) {
            itemConflicts.push({
              field: 'po_no',
              label: 'Contract PO Number',
              arrivalVal: record.po_no,
              qualityVal: match.po_no
            });
          }

          // Supplier Name
          const recSup = String(record.supplier || '').trim().toUpperCase();
          const insSup = String(match.supplier_name || '').trim().toUpperCase();
          if (recSup && insSup && recSup !== insSup && !recSup.includes(insSup) && !insSup.includes(recSup)) {
            itemConflicts.push({
              field: 'supplier',
              label: 'Supplier Identity',
              arrivalVal: record.supplier,
              qualityVal: match.supplier_name
            });
          }

          // Moisture % (Deduction weight factor alignment)
          const recMoisture = Number(record.actual_moisture) || 0;
          const insMoisture = Number(match.actual_moisture) || 0;
          if (recMoisture > 0 && insMoisture > 0 && Math.abs(recMoisture - insMoisture) > 0.1) {
            itemConflicts.push({
              field: 'actual_moisture',
              label: 'Actual Moisture %',
              arrivalVal: recMoisture + '%',
              qualityVal: insMoisture + '%'
            });
          }

          // Dust %
          const recDust = Number(record.actual_dust) || 0;
          const insDust = Number(match.actual_dust) || 0;
          if (recDust > 0 && insDust > 0 && Math.abs(recDust - insDust) > 0.1) {
            itemConflicts.push({
              field: 'actual_dust',
              label: 'Actual Dust %',
              arrivalVal: recDust + '%',
              qualityVal: insDust + '%'
            });
          }

          // NCV
          const recNcv = Number(record.actual_ncv) || 0;
          const insNcv = Number(match.actual_ncv) || 0;
          if (recNcv > 0 && insNcv > 0 && Math.abs(recNcv - insNcv) > 0.1) {
            itemConflicts.push({
              field: 'actual_ncv',
              label: 'Net Calorific Value',
              arrivalVal: recNcv,
              qualityVal: insNcv
            });
          }

          if (itemConflicts.length > 0) {
            conflictsList.push({
              arrivalId: record.final_arrival_id,
              arrivalNo: record.final_arrival_no || 'N/A',
              lorryNo: (record?.lorry_number || (record as any)?.lorry_no || (record as any)?.vehicle_no) || 'N/A',
              supplier: record.supplier || 'N/A',
              mrNo: match.mr_no || 'N/A',
              conflicts: itemConflicts
            });
          }
        }
      });

      setDetectedConflicts(conflictsList);
      if (conflictsList.length > 0 && !silent) {
        setShowConflictsAlert(true);
      } else {
        setShowConflictsAlert(false);
      }

      // Identify pending records
      const pendingRecords = arrivals.filter(r => {
        const isPending = !r.mr_no || r.mr_no.trim() === '' || r.mr_no.trim().toUpperCase() === 'DIRECT REGISTER';
        return isPending;
      });

      if (pendingRecords.length === 0) {
        if (!silent) {
          if (conflictsList.length > 0) {
            setSyncStatusMessage(`Manual Audit Scan: All arrival registers processed, but ${conflictsList.length} data conflict warnings were detected! See alert panel below.`);
          } else {
            setSyncStatusMessage("All system arrivals are fully synchronized. No pending records or conflicts found.");
          }
          setTimeout(() => setSyncStatusMessage(""), 6000);
        }
        return;
      }

      if (!silent) setBackgroundSyncing(true);

      let updatedCount = 0;
      const updatesPromise = pendingRecords.map(async (record) => {
        // Find matching inspection based on arrival number or lorry number with supplier
        const match = inspections.find(ins => {
          const insArrivalNo = String(ins.arrival_no || '').trim().toUpperCase();
          const recTempArrivalNo = String(record?.temporary_arrival_no || '').trim().toUpperCase();
          const recFinalArrivalNo = String(record?.final_arrival_no || '').trim().toUpperCase();
          
          const amadMatch = insArrivalNo && (insArrivalNo === recTempArrivalNo || insArrivalNo === recFinalArrivalNo);
          
          const insSupplier = String(ins.supplier_name || '').trim().toUpperCase();
          const recSupplier = String(record?.supplier || '').trim().toUpperCase();
          
          const lorryMatch = (record?.lorry_number || (record as any)?.lorry_no || (record as any)?.vehicle_no) && ins?.arrival_date && 
            String(ins?.arrival_no || '').toUpperCase().includes(String((record?.lorry_number || (record as any)?.lorry_no || (record as any)?.vehicle_no)).trim().toUpperCase()) &&
            insSupplier === recSupplier;

          return amadMatch || lorryMatch;
        });

        if (match) {
          // Sync all quality fields!
          const { error: updateErr } = await supabase
            .from('final_arrival')
            .update({
              mr_no: match.mr_no,
              mr_date: match.mr_date || null,
              po_no: match.po_no || record.po_no,
              po_date: match.po_date || record.po_date,
              broker_name: match.broker_name || record.broker,
              supplier_name: match.supplier_name || record.supplier,
              actual_moisture: match.actual_moisture ? Number(match.actual_moisture) : record.actual_moisture,
              claim_moisture: match.claim_moisture ? Number(match.claim_moisture) : record.claim_moisture,
              actual_dust: match.actual_dust ? Number(match.actual_dust) : record.actual_dust,
              claim_dust: match.claim_dust ? Number(match.claim_dust) : record.claim_dust,
              actual_ncv: match.actual_ncv ? Number(match.actual_ncv) : record.actual_ncv,
              claim_ncv: match.claim_ncv ? Number(match.claim_ncv) : record.claim_ncv,
              detention_days: match.detention_days ? Number(match.detention_days) : record.detention_days,
              unloading_date: match.unloading_date || record.unloading_date,
              remarks: match.remarks || record.remarks,
            })
            .eq('final_arrival_id', record.final_arrival_id);

          if (!updateErr) {
            updatedCount++;
            
            // Build original and updated dictionary states for exact traceability audit
            const origObj = {
              mr_no: record.mr_no || "Pending/Direct",
              po_no: record.po_no || "N/A",
              actual_moisture: record.actual_moisture || 0,
              actual_dust: record.actual_dust || 0,
              actual_ncv: record.actual_ncv || 0,
            };

            const upObj = {
              mr_no: match.mr_no,
              po_no: match.po_no || record.po_no || "N/A",
              actual_moisture: match.actual_moisture ? Number(match.actual_moisture) : record.actual_moisture || 0,
              actual_dust: match.actual_dust ? Number(match.actual_dust) : record.actual_dust || 0,
              actual_ncv: match.actual_ncv ? Number(match.actual_ncv) : record.actual_ncv || 0,
            };

            // Write to the general log system with formatted original/updated JSON for audit traceability
            const currentUser = getCurrentUserContext().username || "prosunmajhi@gmail.com";
            try {
              const logDetails = `[AUTO-SYNC ENGINE] MATCH: ${record.final_arrival_no} | MR: ${match.mr_no} | ORIGINAL: ${JSON.stringify(origObj)} | UPDATED: ${JSON.stringify(upObj)}`;
              await supabase.from("system_logs").insert({
                user_id: currentUser,
                action: 'AUTO_SYNC',
                details: logDetails
              }).then(() => {}, () => {});
            } catch (le) {
              console.warn("Log write error:", le);
            }
          }
        }
      });

      await Promise.all(updatesPromise);

      if (updatedCount > 0) {
        await fetchRecords();
        setSyncStatusMessage(`Auto-Sync Completed: ${updatedCount} pending arrival(s) have been successfully linked to finalized quality inspections.`);
        setTimeout(() => setSyncStatusMessage(""), 7000);
      } else if (!silent) {
        setSyncStatusMessage("Cross-reference completed. No new finalized matching quality inspections were found.");
        setTimeout(() => setSyncStatusMessage(""), 4000);
      }
    } catch (e: any) {
      console.error("Auto status sync error:", e);
      if (!silent) {
        setSyncStatusMessage(`Sync Failed: ${e.message}`);
        setTimeout(() => setSyncStatusMessage(""), 5000);
      }
    } finally {
      const nowStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (' + new Date().toLocaleDateString('en-GB') + ')';
      setLastSyncTime(nowStr);
      if (!silent) setBackgroundSyncing(false);
    }
  };

  const runReconcileFix = async () => {
    try {
      setLoading(true);
      let resolvedCount = 0;
      
      const fixPromises = detectedConflicts.map(async (conf) => {
        // Fetch corresponding quality audit master record
        const { data: insData, error: insErr } = await supabase
          .from('mill_inspection_master')
          .select('*')
          .eq('mr_no', conf.mrNo)
          .maybeSingle();
          
        if (insErr || !insData) return;
        
        // Update final arrivals table with certified metrics
        const { error: updateErr } = await supabase
          .from('final_arrival')
          .update({
            po_no: insData.po_no || null,
            supplier: insData.supplier_name || null,
            broker: insData.broker_name || null,
            actual_moisture: insData.actual_moisture ? Number(insData.actual_moisture) : null,
            actual_dust: insData.actual_dust ? Number(insData.actual_dust) : null,
            actual_ncv: insData.actual_ncv ? Number(insData.actual_ncv) : null,
          })
          .eq('final_arrival_id', conf.arrivalId);
          
        if (!updateErr) {
          resolvedCount++;
        }
      });
      
      await Promise.all(fixPromises);
      await fetchRecords();
      setDetectedConflicts([]);
      setShowConflictsAlert(false);
      alert(`Successfully reconciled and updated ${resolvedCount} arrival records to match Lab Quality certification master.`);
    } catch (e: any) {
      alert("Bulk Reconcile failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Periodic Auto-Sync Task Scheduler
  useEffect(() => {
    if (!autoSyncEnabled) return;

    // Run initial sync shortly after component mounts
    const initialTimer = setTimeout(() => {
      runBackgroundStatusSync(true);
    }, 1500);

    return () => {
      clearTimeout(initialTimer);
    };
  }, [autoSyncEnabled]);

  const handleExportCSV = () => {
    if (records.length === 0) {
      alert("No data available to export.");
      return;
    }

    const dataToExport = records.map(r => ({
      "Final Arrival Number": r.final_arrival_no,
      "Inspection MR Number": r.mr_no || '',
      "Arrival Date": r.date ? new Date(r.date).toLocaleDateString('en-GB') : '',
      "Purchase Order No": r.po_no || '',
      "Ledger Supplier": r.supplier || '',
      "Broker Name": r.broker || '',
      "Lorry Number": r.lorry_number || (r as any).lorry_no || (r as any).vehicle_no || '',
      "Consignment Note": r.consignment_note || r.consignment_note_no || (r as any).consignment_notice_no || '',
      "Challan / Railway Receipt No.": r.challan_railway_receipt_no || r.challan_rr_no || '',
      "Challan RR Date": r.challan_rr_date ? new Date(r.challan_rr_date).toLocaleDateString('en-GB') : '',
      "Total Packets (Bags)": getRcptQty(r),
      "Weight (QTL)": r.weight_qtl ?? 0,
      "Weight (MT)": r.weight_qtl ? (r.weight_qtl / 10).toFixed(3) : '0.000',
      "Transit Area": r.arrival_area_name || '',
      "Weigh Bridge Electronic Net": r.electronic_net_weight ?? 0,
      "Supplier Reported Net": r.supplier_net_weight ?? 0,
      "System Registry Notes": r.remarks || ''
    }));

    try {
      const sanitizedData = sanitizeCsvData(dataToExport);
      const csv = Papa.unparse(sanitizedData);
      const csvContent = "\uFEFF" + csv;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Final_Arrivals_Enterprise_Report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch(e: any) {
      alert("Error generating CSV Export: " + e.message);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!enforceEditOrDeletePermission("Delete")) {
      return;
    }

    if (confirm(`Are you sure you want to completely delete Final Arrival Voucher #${code}? This will remove it from the database.`)) {
      try {
        if (code && supabase) {
          // Cascade clean linked inspection details & deductions
          await Promise.all([
            supabase.from('material_inspection_details').delete().or(`mr_no.eq.${code},arrival_no.eq.${code}`).then(() => {}, () => {}),
            supabase.from('material_inspection_deductions').delete().or(`mr_no.eq.${code}`).then(() => {}, () => {}),
            supabase.from('mill_inspection_deduction').delete().or(`mr_no.eq.${code}`).then(() => {}, () => {}),
          ]);
          await supabase.from('material_inspection').delete().or(`mr_no.eq.${code},arrival_no.eq.${code},final_arrival_no.eq.${code}`).then(() => {}, () => {});
        }
        await dbModule.delete('final_arrival', 'final_arrival_id', id);
        alert(`Final Arrival Voucher #${code} deleted permanently.`);
        fetchRecords();
        if (selectedRecord && selectedRecord.final_arrival_id === id) setSelectedRecord(null);
      } catch (e: any) {
        alert("Failed to delete voucher: " + e.message);
      }
    }
  };

  const filteredRecords = records.filter(r => {
    const q = searchQuery.toLowerCase().trim();
    const isVoid = r.status === 'cancelled';
    const matchSearch = !q || (
      (r.final_arrival_no || '').toLowerCase().includes(q) ||
      (r.mr_no || '').toLowerCase().includes(q) ||
      (r.po_no || '').toLowerCase().includes(q) ||
      (r.supplier || '').toLowerCase().includes(q) ||
      (r.broker || '').toLowerCase().includes(q) ||
      (r.lorry_number || (r as any).lorry_no || (r as any).vehicle_no || '').toLowerCase().includes(q) ||
      (isVoid && q === 'void')
    );

    let matchDateRange = true;
    if (startDateFilter && r.date) {
      matchDateRange = matchDateRange && (r.date >= startDateFilter);
    }
    if (endDateFilter && r.date) {
      matchDateRange = matchDateRange && (r.date <= endDateFilter);
    }

    if (!canViewCompletedData()) {
      const isCompleted = Boolean(r.mr_no && r.mr_no.trim() !== '' && r.mr_no.trim().toUpperCase() !== 'DIRECT REGISTER');
      if (isCompleted) return false;
    }

    return matchSearch && matchDateRange;
  }).sort((a, b) => {
    // 1. Voucher Date (b.date vs a.date - descending for newest date first)
    const dateDiff = new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
    if (dateDiff !== 0) return dateDiff;

    // 2. Supplier Name
    const suppA = (a.supplier || '').toUpperCase();
    const suppB = (b.supplier || '').toUpperCase();
    const suppDiff = suppA.localeCompare(suppB);
    if (suppDiff !== 0) return suppDiff;

    // 3. Unit
    const unitA = (a.unit_name || (a as any).unit || a.unit_code || '').toUpperCase();
    const unitB = (b.unit_name || (b as any).unit || b.unit_code || '').toUpperCase();
    const unitDiff = unitA.localeCompare(unitB);
    if (unitDiff !== 0) return unitDiff;

    // 4. Inspection Status
    const isCompletedA = (a.mr_no && a.mr_no.trim() !== '' && a.mr_no.trim().toUpperCase() !== 'DIRECT REGISTER') ? 'COMPLETED' : 'PENDING';
    const isCompletedB = (b.mr_no && b.mr_no.trim() !== '' && b.mr_no.trim().toUpperCase() !== 'DIRECT REGISTER') ? 'COMPLETED' : 'PENDING';
    return isCompletedA.localeCompare(isCompletedB);
  });

  // Helper to extract Receipt Quantity ("RCPT") from Receipt Grade Details (grid_details)
  const getRcptQty = (item: any): number => {
    if (!item) return 0;
    const itemUnit = (item.unit_name || item.unit || item.unit_code || '').toString().trim().toUpperCase();
    if (itemUnit.includes('LOOSE') || itemUnit === 'LOOSE') return 0;

    if (item.grid_details) {
      let grid: any[] = [];
      if (typeof item.grid_details === 'string') {
        try {
          const parsed = item.grid_details === 'undefined' || item.grid_details === 'null' ? [] : JSON.parse(item.grid_details === "undefined" ? "null" : item.grid_details);
          if (Array.isArray(parsed)) grid = parsed;
        } catch (e) {}
      } else if (Array.isArray(item.grid_details)) {
        grid = item.grid_details;
      }
      if (grid.length > 0) {
        let hasRcpt = false;
        let sumRcpt = 0;
        grid.forEach((row: any) => {
          const rowUnit = (row.unit || itemUnit).toString().trim().toUpperCase();
          if (rowUnit.includes('LOOSE') || rowUnit === 'LOOSE') return;
          const val = row.quantity_rcpt !== undefined && row.quantity_rcpt !== null && row.quantity_rcpt !== ''
            ? Number(row.quantity_rcpt)
            : (row.rcpt !== undefined && row.rcpt !== null && row.rcpt !== '' ? Number(row.rcpt) : NaN);
          if (!isNaN(val)) {
            hasRcpt = true;
            sumRcpt += val;
          }
        });
        if (hasRcpt) return sumRcpt;

        const fallback = grid.reduce((acc: number, row: any) => {
          const rowUnit = (row.unit || itemUnit).toString().trim().toUpperCase();
          if (rowUnit.includes('LOOSE') || rowUnit === 'LOOSE') return acc;
          return acc + (Number(row.quantity_rcpt) || Number(row.rcpt) || Number(row.quantity) || Number(row.qty) || 0);
        }, 0);
        if (fallback > 0) return fallback;
      }
    }
    return Number(item.total_packets || item.packets || 0);
  };

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

  // Calculate dynamic summaries based on filtered list
  const totalBales = filteredRecords.reduce((acc, r) => acc + getRcptQty(r), 0);
  const totalWeightMt = filteredRecords.reduce((acc, r) => acc + getLowestNetWeight(r), 0);
  const filteredVehiclesCount = filteredRecords.length;

  const totalFilteredCount = filteredRecords.length;
  const completedFilteredCount = filteredRecords.filter(r => r.mr_no && r.mr_no.trim() !== '' && r.mr_no.trim().toUpperCase() !== 'DIRECT REGISTER').length;
  const pendingFilteredCount = totalFilteredCount - completedFilteredCount;

  // Group by Date for the "Date Wise Total Arrival Report (Global Summary)" Card
  const dateWiseArrivalsMap: { [date: string]: { count: number; packets: number; weight: number } } = {};
  records.forEach(r => {
    const d = r.date || 'No Date';
    if (!dateWiseArrivalsMap[d]) {
      dateWiseArrivalsMap[d] = { count: 0, packets: 0, weight: 0 };
    }
    dateWiseArrivalsMap[d].count += 1;
    dateWiseArrivalsMap[d].packets += getRcptQty(r);
    dateWiseArrivalsMap[d].weight += getLowestNetWeight(r);
  });

  const dateWiseArrivalList = Object.entries(dateWiseArrivalsMap)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Compute print slip totals
  const printTotalQty = printData?.rows?.reduce((acc: number, r: any) => acc + (Number(r.quantity_rcpt) || 0), 0) || 0;
  const printTotalGrossWt = printData?.rows?.reduce((acc: number, r: any) => acc + (Number(r.gross_wt) || 0), 0) || 0;
  const printTotalNetWt = printData?.rows?.reduce((acc: number, r: any) => acc + (Number(r.net_wt) || 0), 0) || 0;

  // Top Nav Items
  const navTabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'maingate', label: 'Main Gate' },
    { id: 'mill', label: 'Mill' },
    { id: 'po', label: 'Purchase' },
    { id: 'satta', label: 'Satta' },
    { id: 'amad', label: 'T.M.R' },
    { id: 'final_arrival', label: 'Final M.R', active: true },
    { id: 'material_inspection', label: 'Quality' },
    { id: 'stock', label: 'Inventory' },
    { id: 'production', label: 'Production' },
    { id: 'reports', label: 'Reports' },
    { id: 'vyapari', label: 'Masters' },
    { id: 'admindesk', label: 'Administration' },
  ];

  if (viewState === 'reconciliation') {
    return (
      <LegacyLayout
        title="FINAL ARRIVAL QUALITY RECONCILIATION REPORT"
        onClose={onClose}
      >
        <FinalArrivalReconciliation
          onBack={() => {
            setViewState('list');
            fetchRecords();
          }}
          onSelectInspectionForFA={(prefilled) => {
            setEditingRecord(prefilled);
            setViewState('entry');
          }}
        />
      </LegacyLayout>
    );
  }

  if (viewState === 'entry') {
    return (
      <FinalArrivalEntry
        initialData={editingRecord}
        onCancel={() => {
          setViewState('list');
          setEditingRecord(null);
        }}
        onSave={() => {
          setViewState('list');
          setEditingRecord(null);
          fetchRecords();
        }}
      />
    );
  }

  return (
    <LegacyLayout
      title={isArchiveView ? "FINAL M.R ARCHIVE" : "FINAL M.R"}
      onClose={onClose}
      activeNavTab="final_mr"
    >
      <div className="bg-[#F9F5EC] text-slate-800 font-sans flex flex-col selection:bg-[#1E4D2B] selection:text-white p-2 md:p-4 space-y-5 max-w-[1700px] w-full mx-auto">

        {/* KPI CARDS GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* KPI 1 */}
          <div className="bg-white rounded-xl border border-[#E6DDC8] p-3.5 shadow-xs hover:border-[#1E4D2B]/40 transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Filtered Loads</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#1E4D2B] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold font-mono text-slate-900">{filteredRecords.length} <span className="text-xs font-sans font-semibold text-slate-600">Lorries</span></p>
            <p className="text-[10px] font-medium text-emerald-700 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active Final M.R
            </p>
          </div>

          {/* KPI 2: Total */}
          <div className="bg-white rounded-xl border border-[#E6DDC8] p-3.5 shadow-xs hover:border-[#1E4D2B]/40 transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Total</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#8C6D33] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold font-mono text-blue-900">{totalBales.toLocaleString()} <span className="text-xs font-sans font-semibold text-slate-600">Bales</span></p>
            <p className="text-[10px] font-medium text-slate-500 mt-1">Finalized Packets</p>
          </div>

          {/* KPI 3 */}
          <div className="bg-white rounded-xl border border-[#E6DDC8] p-3.5 shadow-xs hover:border-[#1E4D2B]/40 transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Total Weight</span>
              <div className="w-8 h-8 rounded-lg bg-[#F9F5EC] text-[#1E4D2B] flex items-center justify-center group-hover:scale-110 transition-transform">
                <Scale className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xl font-bold font-mono text-rose-700">{totalWeightMt.toFixed(3)} <span className="text-xs font-sans font-semibold text-slate-600">MT</span></p>
            <p className="text-[10px] font-medium text-slate-500 mt-1">Net Metric Tons</p>
          </div>

          {/* KPI 4: Sync Daemon */}
          <div className="bg-white rounded-xl border border-[#E6DDC8] p-3.5 shadow-xs hover:border-[#1E4D2B]/40 transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Sync Daemon</span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <RefreshCcw className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-base font-bold font-mono text-slate-800">{autoSyncEnabled ? 'ACTIVE' : 'IDLE'}</p>
            <p className="text-[10px] font-medium text-slate-500 mt-1 truncate">{lastSyncTime || 'Auto Sync Ready'}</p>
          </div>
        </div>


        {/* Live Mismatch / Audit Conflict Alert Notification Panel */}
        <AnimatePresence>
          {showConflictsAlert && detectedConflicts.length > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-amber-50/90 border-2 border-amber-500 rounded-lg p-3.5 shadow-md flex flex-col gap-3 font-sans animate-fade-in"
            >
              <div className="flex items-start justify-between gap-3 border-b border-amber-200 pb-2">
                <div className="flex items-center gap-2">
                  <span className="p-1 px-2 rounded-md bg-amber-600 text-white font-serif font-black animate-pulse flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  </span>
                  <div>
                    <h4 className="text-xs font-black uppercase text-amber-900 tracking-wide">
                      ⚠️ Quality Audit System Reconciliation Conflicts
                    </h4>
                    <p className="text-[10px] font-semibold text-amber-700 leading-tight">
                      Manual force-refresh has detected {detectedConflicts.length} active conflict(s) between raw Jute Goods Arrival Tracking records and certified Laboratory Quality Inspections.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowConflictsAlert(false)}
                  className="p-1 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-md transition-all cursor-pointer text-xs uppercase font-black"
                  title="Dismiss alert panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Detail list of mismatches */}
              <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-amber-300">
                {detectedConflicts.map((conf, index) => (
                  <div key={index} className="bg-white border border-amber-200 rounded-md p-2.5 shadow-xs flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-slate-100 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-amber-600 text-white font-mono font-black text-[9px] px-1.5 py-0.5 rounded shadow-xs">
                          FA #: {conf.arrivalNo}
                        </span>
                        <span className="bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[9px] px-1.5 py-0.5 rounded font-black">
                          LORRY: {conf.lorryNo}
                        </span>
                        <span className="text-slate-400 font-bold text-[10px]">•</span>
                        <span className="text-slate-700 font-semibold text-[10px] truncate max-w-xs">
                          Supplier: <strong>{conf.supplier}</strong>
                        </span>
                      </div>
                      <div className="bg-amber-100/60 text-amber-850 border border-amber-300 text-[9px] font-mono font-black px-2 py-0.5 rounded">
                        Linked M.R. NO: {conf.mrNo}
                      </div>
                    </div>

                    <table className="w-full text-left text-[10.5px] font-sans border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-black uppercase text-[8.5px] border-b border-slate-150">
                          <th className="py-1 px-2 w-[40%]">Metric Field Comparison</th>
                          <th className="py-1 px-2 text-rose-700 w-[30%]">Arrival tracking Value</th>
                          <th className="py-1 px-2 text-emerald-700 w-[30%]">Quality Audit master Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold">
                        {conf.conflicts.map((item: any, i: number) => (
                          <tr key={i} className="hover:bg-amber-50/20 font-mono">
                            <td className="py-1 px-2 text-slate-600 font-sans">{item.label}</td>
                            <td className="py-1 px-2 text-rose-600 font-black">{item.arrivalVal || 'N/A'}</td>
                            <td className="py-1 px-2 text-emerald-600 font-black">{item.qualityVal || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-t border-amber-200 pt-2 gap-2">
                <span className="text-[9px] text-amber-800 font-medium italic">
                  Note: Values in the Quality Audit Ledger are authorized and certified directly by the Mill Lab premises.
                </span>
                <button
                  onClick={() => {
                    if (confirm("Would you like to force update the arrival registers using lab-certified values to eradicate all mismatched differences?")) {
                      runReconcileFix();
                    }
                  }}
                  className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-wider shadow-xs hover:shadow-sm cursor-pointer transition-all duration-100 text-[9px]"
                >
                  ⚡ Bulk Reconcile with Quality Values
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* SEARCH, FILTER & ACTION CONTROLS */}
        <div className="bg-white rounded-xl border border-[#E6DDC8] p-3.5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
 id="search_by_fa_no_mr_no_po__1422" name="search_by_fa_no_mr_no_po_" aria-label="Search by FA No, MR No, PO No, Supplier Name, Lorry..."              type="text"
              placeholder="Search by FA No, MR No, PO No, Supplier Name, Lorry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F9F5EC] border border-[#E6DDC8] rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1E4D2B]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Filters */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-1.5 bg-[#F9F5EC] border border-[#E6DDC8] rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase">From:</span>
              <input
 id="startdatefilter_1443" name="startdatefilter" aria-label="startdatefilter"                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[10px] font-bold text-slate-500 uppercase ml-1">To:</span>
              <input
 id="enddatefilter_1450" name="enddatefilter" aria-label="enddatefilter"                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
            <button
              onClick={() => {
                setEditingRecord(null);
                setViewState('entry');
              }}
              className="bg-[#1E4D2B] hover:bg-[#163E21] text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> New Final M.R
            </button>
            <button
              onClick={handleExportCSV}
              className="bg-[#F9F5EC] hover:bg-[#EAE3D2] border border-[#E6DDC8] text-[#1E4D2B] px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              onClick={() => {
                if (selectedRecordId) {
                  const target = records.find(r => r.final_arrival_id === selectedRecordId);
                  if (target) handlePreparePrint(target);
                  else alert("Selected record not found.");
                } else {
                  alert("Please select a row first.");
                }
              }}
              className="bg-[#F9F5EC] hover:bg-[#EAE3D2] border border-[#E6DDC8] text-slate-700 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" /> Print Selected
            </button>
          </div>
        </div>

        {/* Ledger Table Container */}
        <div className="bg-white rounded-xl border border-[#E6DDC8] shadow-xs overflow-x-auto overflow-y-auto min-h-[350px] w-full max-w-full">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 py-24">
              <RefreshCw className="h-8 w-8 text-[#1E4D2B] animate-spin mb-3" />
              <span className="text-xs font-bold uppercase tracking-widest text-slate-700">Reindexing Final Arrival registries...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 py-24 text-center font-sans">
              <FileText className="h-12 w-12 text-slate-300 mb-2.5" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">No Finalized Arrival Records Found</h3>
              <p className="text-[10px] text-slate-500 max-w-sm mt-1">
                No active final arrivals found matching this search criteria. Create a new record or adjust your filter presets.
              </p>
            </div>
          ) : (
            <table className="w-full border-collapse text-xs font-sans min-w-[1100px]">
              <thead className="bg-[#1E4D2B] text-white font-serif sticky top-0 z-10">
                <tr className="border-b border-[#163E21] h-10 text-emerald-50">
                  <th className="px-3 border-r border-[#163E21] font-bold text-center w-24 whitespace-nowrap">Voucher Date</th>
                  <th className="px-3 border-r border-[#163E21] font-bold text-center w-24 whitespace-nowrap">Arrival #</th>
                  <th className="px-3 border-r border-[#163E21] font-bold text-center w-28 whitespace-nowrap">PO #</th>
                  <th className="px-3 border-r border-[#163E21] font-bold text-left whitespace-nowrap">Supplier Name</th>
                  <th className="px-3 border-r border-[#163E21] font-bold text-left whitespace-nowrap">Broker Reference</th>
                  <th className="px-3 border-r border-[#163E21] font-bold text-center w-28 whitespace-nowrap">Lorry Number</th>
                  <th className="px-3 border-r border-[#163E21] font-bold text-center w-20 whitespace-nowrap">Unit</th>
                  <th className="px-3 border-r border-[#163E21] font-bold text-right w-20 whitespace-nowrap">Qty</th>
                  <th className="px-3 border-r border-[#163E21] font-bold text-right w-24 text-amber-200 whitespace-nowrap">Weight</th>
                  <th className="px-3 font-bold text-center w-24 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono text-xs">
                {filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((r, idx) => {
                    const isSelected = selectedRecordId === r.final_arrival_id;
                    const formattedDate = r.date ? new Date(r.date).toLocaleDateString('en-GB') : '--';
                    const bales = getRcptQty(r);
                    const weightMt = getLowestNetWeight(r);
                    const isPending = !r.mr_no || r.mr_no.trim() === '' || r.mr_no.trim().toUpperCase() === 'DIRECT REGISTER';
                    const isVoid = r.status === 'cancelled';
                    
                    return (
                      <tr 
                        key={r.final_arrival_id || idx} 
                        onClick={() => setSelectedRecordId(r.final_arrival_id || null)}
                        onDoubleClick={() => {
                          if (isVoid) return;
                          setSelectedRecordId(r.final_arrival_id || null);
                          setEditingRecord(r);
                          setViewState('entry');
                        }}
                        className={cn(
                          "h-9.5 cursor-pointer group hover:bg-[#ffffd0]/65 text-xs", 
                          isSelected 
                            ? "bg-indigo-50 text-indigo-950 font-bold border-y border-indigo-200 shadow-sm" 
                            : isVoid 
                                ? "bg-red-50/40 text-gray-400 line-through decoration-red-500/50"
                                : (isPending 
                                    ? "bg-amber-100/40 hover:bg-amber-100/60 text-amber-950" 
                                    : (idx % 2 === 0 ? "bg-white text-gray-900" : "bg-gray-50/40 text-gray-900")
                                  )
                        )}
                      >
                        {/* Voucher Date */}
                        <td className={cn("text-center font-bold px-2.5 border-r border-gray-200 whitespace-nowrap", isSelected ? "text-indigo-900" : isVoid ? "text-red-400" : "text-gray-500")}>
                          {formattedDate}
                        </td>

                        {/* Final Arrival No */}
                        <td className="text-center font-black px-2 border-r border-gray-200 whitespace-nowrap">
                          <div className="flex flex-col items-center justify-center py-0.5">
                            <span className={cn(isSelected ? "text-indigo-950" : "text-gray-900")}>#{r.final_arrival_no}</span>
                            {isPending && (
                              <span className="text-[8.5px] px-1 bg-amber-500 text-white font-extrabold uppercase rounded-sm mt-0.5 tracking-wide leading-none ">Pending</span>
                            )}
                          </div>
                        </td>

                      {/* PO No */}
                      <td className={cn("text-center font-bold font-mono text-xs px-1.5 border-r border-gray-200 whitespace-nowrap", isSelected ? "text-indigo-950 bg-indigo-100/40" : "text-amber-800 bg-amber-50/10")}>
                        {r.po_no || '--'}
                      </td>

                      {/* Supplier Name */}
                      <td className="px-3 truncate uppercase font-sans font-semibold text-left border-r border-gray-200 whitespace-nowrap max-w-[200px]">
                        {r.supplier || '--'}
                      </td>

                      {/* Broker Reference */}
                      <td className={cn("px-3 truncate uppercase font-sans text-left border-r border-gray-200 whitespace-nowrap max-w-[150px]", isSelected ? "text-indigo-900/90" : "text-gray-600")}>
                        {r.broker || 'DIRECT'}
                      </td>

                      {/* Lorry Number */}
                      <td className="text-center font-extrabold uppercase border-r border-gray-200 whitespace-nowrap">
                        {r.lorry_number || (r as any).lorry_no || (r as any).vehicle_no || '--'}
                      </td>

                      {/* Unit */}
                      <td className="text-center border-r border-gray-200 whitespace-nowrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase border bg-blue-50 text-blue-800 border-blue-200">
                          {r.unit_name || r.unit_code || 'BALES'}
                        </span>
                      </td>

                      {/* Bales (Qty) */}
                      <td className={cn("text-right px-2 font-black tabular-nums font-mono border-r border-gray-200 whitespace-nowrap", isSelected ? "text-indigo-900" : "text-blue-700 group-hover:text-blue-900")}>
                        {bales}
                      </td>

                      {/* Weight (M.T) */}
                      <td 
                        onClick={(e) => {
                          e.stopPropagation();
                          setAuditPopoverId(auditPopoverId === r.final_arrival_id ? null : (r.final_arrival_id || ''));
                        }}
                        className={cn(
                          "text-right px-2 font-black tabular-nums font-mono border-r border-gray-200 relative cursor-pointer group/cell active:scale-[0.98] transition-transform  whitespace-nowrap", 
                          isSelected ? "text-red-800 bg-red-100/50" : "text-red-700 bg-red-50/25 hover:bg-red-100"
                        )}
                        title="Click to view detailed quality math audit"
                      >
                        <div className="flex items-center justify-end gap-1 ">
                          <Calculator className="h-[10px] w-[10px] opacity-40 shrink-0 group-hover/cell:opacity-100 text-red-600" />
                          <span>{weightMt.toFixed(3)}</span>
                        </div>

                        {/* Visual Popover detail */}
                        {auditPopoverId === r.final_arrival_id && (
                          <div 
                            onClick={(e) => e.stopPropagation()} 
                            className="absolute right-0 top-10 bg-[#E8E6E1] border-2 border-white shadow-2xl p-3 z-50 rounded text-slate-800 text-[10px] w-64 text-left font-sans font-medium space-y-2"
                          >
                            <div className="bg-[#000080] text-white p-1 text-[9.5px] font-black uppercase flex justify-between items-center">
                              <span>📊 QUANTITATIVE AUDIT TRACE</span>
                              <button 
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setAuditPopoverId(null);
                                }}
                                className="cursor-pointer bg-red-600 px-1 hover:bg-red-700 font-extrabold text-[8px] rounded text-white"
                              >
                                CLOSE
                              </button>
                            </div>
                            
                            {(() => {
                              const { moisture, dust, ncv } = getQualityParams(r);
                              const areaClean = String(r.arrival_area_name || '').toLowerCase();
                              const isDaisee = areaClean.includes("daisee");
                              
                              let month = 0;
                              const dateToCheck = r.po_date || r.date;
                              if (dateToCheck) {
                                const d = new Date(dateToCheck);
                                if (!isNaN(d.getTime())) month = d.getMonth();
                              }
                              
                              const isJanToJune = month >= 0 && month <= 5;
                              let moistureLimit = 16;
                              if (isJanToJune) {
                                moistureLimit = isDaisee ? 18 : 16;
                              } else {
                                moistureLimit = isDaisee ? 20 : 18;
                              }
                              
                              const excessMoisture = moisture > moistureLimit ? (moisture - moistureLimit) : 0;
                              const totalDed = excessMoisture + dust + ncv;
                              
                              // Deducted Net weight calculation
                              const grossRawVal = r.weight_qtl ? (r.weight_qtl / 10) : 0;
                              const calculatedNetVal = grossRawVal * (1 - totalDed / 100);

                              return (
                                <div className="space-y-1.5 leading-tight text-slate-700 font-sans">
                                  <div className="flex justify-between border-b border-gray-400 pb-1 font-semibold text-slate-900">
                                    <span>Lorry Number:</span>
                                    <span className="font-mono text-indigo-950 font-black uppercase">{r.lorry_number || (r as any).lorry_no || (r as any).vehicle_no || 'WB-XXXX'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Operating Area:</span>
                                    <span className="font-bold underline">{r.arrival_area_name || 'Standard Area'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>DAISEE status:</span>
                                    <span className="font-bold">{isDaisee ? "✅ YES (Bonus allowance)" : "❌ NO"}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Season context:</span>
                                    <span className="font-bold lowercase first-letter:uppercase">{(isJanToJune ? "Jan-Jun (Wet)" : "Jul-Dec (Dry)")}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Moisture threshold limit:</span>
                                    <span className="bg-amber-100 text-amber-950 px-1 font-mono font-bold rounded">{moistureLimit}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Recorded Moisture:</span>
                                    <span className="font-semibold">{moisture}%</span>
                                  </div>
                                  <div className="flex justify-between text-red-650 font-bold">
                                    <span>Excess Deduct pct:</span>
                                    <span>+{excessMoisture.toFixed(1)}%</span>
                                  </div>
                                  <div className="flex justify-between text-slate-600">
                                    <span>Dust & NCV limits:</span>
                                    <span>+{dust}% + {ncv}%</span>
                                  </div>
                                  <div className="flex justify-between border-t border-dashed border-gray-400 pt-1 text-red-700 font-black uppercase text-[9px]">
                                    <span>Total cumulative deductions:</span>
                                    <span>{totalDed.toFixed(1)}%</span>
                                  </div>

                                  <div className="bg-white p-1.5 font-mono text-[9px] text-[#000080] border border-slate-300 rounded leading-none">
                                    <p className="font-bold uppercase text-[8px] text-slate-500">RECONCILIATION MATH:</p>
                                    <p className="mt-1">{grossRawVal.toFixed(3)} MT * (1 - {totalDed.toFixed(1)}%)</p>
                                    <p className="text-red-700 font-black mt-1.5">Net weight = {calculatedNetVal.toFixed(3)} MT</p>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="text-center px-1.5" onClick={(e) => e.stopPropagation()}>
                        {isVoid ? (
                           <div className="flex items-center justify-center gap-2">
                             <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px] uppercase border border-red-200">VOID</span>
                             {canEditOrDelete() && (
                               <button
                                 onClick={(e) => { e.stopPropagation(); handleDelete(r.final_arrival_id, r.final_arrival_no); }}
                                 className="p-1 text-red-600 hover:text-red-800 hover:bg-black/10 rounded transition-colors"
                                 title="Delete Permanently"
                               >
                                 <Trash2 className="w-3.5 h-3.5" />
                               </button>
                             )}
                           </div>
                        ) : (
                        <div className="flex justify-center gap-1.5">
                          <button 
                            onClick={() => setSelectedRecord(r)} 
                            className={cn(
                              "p-1 hover:bg-black/15 rounded transition-colors",
                              isSelected ? "text-red-200 hover:text-white" : "text-red-600 hover:text-red-800"
                            )}
                            title="Open Detail Voucher Slip"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handlePreparePrint(r)} 
                            className={cn(
                              "p-1 hover:bg-black/15 rounded transition-colors",
                              isSelected ? "text-indigo-200 hover:text-white" : "text-indigo-600 hover:text-indigo-800"
                            )}
                            title="Print Arrival Slip"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          {canEditOrDelete() && (
                            <>
                              <button 
                                onClick={() => {
                                  if (!enforceEditOrDeletePermission("Edit")) return;
                                  setEditingRecord(r);
                                  setViewState('entry');
                                }} 
                                className={cn(
                                  "p-1 hover:bg-black/15 rounded transition-colors",
                                  isSelected ? "text-blue-200 hover:text-white" : "text-blue-600 hover:text-blue-800"
                                )}
                                title="Edit Record"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDelete(r.final_arrival_id, r.final_arrival_no)} 
                                className={cn(
                                  "p-1 hover:bg-black/15 rounded transition-colors",
                                  isSelected ? "text-gray-200 hover:text-white" : "text-red-600 hover:text-red-800"
                                )}
                                title="Cancel Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="mt-2">
          <PaginationControls
            currentPage={currentPage}
            totalItems={filteredRecords.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </div>

      {/* Audit Detail Record Slip Popup */}
      <AnimatePresence>
        {selectedRecord && (
          <div className="fixed inset-0 bg-black/65 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="w-full max-w-3xl bg-[#dfdfdf] border-t-white border-l-white border-b-slate-900 border-r-slate-900 border-2 shadow-[4px_4px_16px_rgba(0,0,0,0.35)] font-sans text-xs"
            >
              {/* Header */}
              <div className="bg-indigo-950 text-white px-3 py-1.5 flex justify-between items-center h-10 border-b border-black/30">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-black uppercase tracking-wider italic">
                    Finalized Stock Entry Voucher - [FA No: {selectedRecord.final_arrival_no}]
                  </span>
                </div>
                <button 
                  onClick={() => setSelectedRecord(null)}
                  className="bg-[#c0c0c0] hover:bg-red-700 hover:text-white text-black px-2 py-0.5 border-t-white border-l-white border-b-slate-800 border-r-slate-800 border-2 text-xs font-black"
                >
                  ✖
                </button>
              </div>

              {/* Slips Body */}
              <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto font-sans">
                
                <div className="bg-white border border-gray-400 p-3 shadow-inner space-y-1">
                  <div className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Enterprise Final Materials Desk</div>
                  <div className="text-xl font-bold font-mono tracking-tight text-red-900">FINAL ARRIVAL RECORD #{selectedRecord.final_arrival_no}</div>
                  <div className="text-[10px] text-slate-600 font-medium">
                    This finalized arrival slip is compiled post-inspection. It registers verified material stock additions against active mill purchase sauda/ruka.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  
                  <LegacyFieldset legend="Document & Dispatch Logistics">
                    <div className="grid grid-cols-12 gap-x-2 gap-y-1.5 text-[11px] items-center">
                      <span className="col-span-5 font-bold text-gray-600">Arrival Date:</span>
                      <span className="col-span-7 font-mono font-bold text-indigo-950 bg-white p-1 border border-gray-300 text-center">
                        {selectedRecord.date ? new Date(selectedRecord.date).toLocaleDateString('en-GB') : 'N/A'}
                      </span>

                      <span className="col-span-5 font-bold text-gray-600">Inspection MR No:</span>
                      <span className="col-span-7 font-mono font-black text-emerald-800 bg-emerald-50 p-1 border border-emerald-300 text-center">
                        {selectedRecord.mr_no || 'DIRECT REGISTER'}
                      </span>

                      <span className="col-span-12 my-0.5 border-b border-dashed border-gray-300"></span>

                      <span className="col-span-5 font-bold text-gray-600">Associated Purchase PO:</span>
                      <span className="col-span-7 font-mono font-bold text-amber-900 bg-amber-50/20 p-1 border border-amber-300 text-center">
                        {selectedRecord.po_no || 'N/A'}
                      </span>

                      <span className="col-span-5 font-bold text-gray-600">Financial Year:</span>
                      <span className="col-span-7 font-mono font-extrabold text-slate-700 bg-white p-1 border border-gray-300 text-center">
                        {selectedRecord.financial_year}
                      </span>

                      <span className="col-span-12 my-0.5 border-b border-dashed border-gray-300"></span>

                      <span className="col-span-5 font-bold text-gray-600">Consignment Note:</span>
                      <span className="col-span-7 font-mono font-bold text-slate-900 bg-white p-1 border border-gray-300 text-center">
                        {selectedRecord.consignment_note || selectedRecord.consignment_note_no || (selectedRecord as any).consignment_notice_no || 'N/A'}
                      </span>

                      <span className="col-span-5 font-bold text-gray-600">Challan / RR No:</span>
                      <span className="col-span-7 font-mono font-bold text-slate-900 bg-white p-1 border border-gray-300 text-center">
                        {selectedRecord.challan_railway_receipt_no || selectedRecord.challan_rr_no || 'N/A'}
                      </span>
                    </div>
                  </LegacyFieldset>

                  <LegacyFieldset legend="Stakeholder Information & Lorry">
                    <div className="grid grid-cols-12 gap-x-2 gap-y-1.5 text-[11px] items-center">
                      <span className="col-span-4 font-bold text-gray-600">Challan Supplier:</span>
                      <span className="col-span-8 font-serif font-black text-indigo-950 bg-white p-1 border border-gray-300 truncate uppercase">
                        {selectedRecord.challan_supplier || 'N/A'}
                      </span>

                      <span className="col-span-4 font-bold text-gray-600">Ledger Acc Supp:</span>
                      <span className="col-span-8 font-serif font-black text-indigo-950 bg-white p-1 border border-gray-300 truncate uppercase">
                        {selectedRecord.supplier || 'N/A'}
                      </span>

                      <span className="col-span-4 font-bold text-gray-600">Broker:</span>
                      <span className="col-span-8 font-sans font-bold text-slate-800 bg-white p-1 border border-gray-300 truncate uppercase">
                        {selectedRecord.broker || 'DIRECT'}
                      </span>

                      <span className="col-span-12 my-0.5 border-b border-dashed border-gray-300"></span>

                      <span className="col-span-4 font-bold text-gray-600">Lorry Number:</span>
                      <span className="col-span-8 font-mono font-black text-red-800 bg-red-50 p-1 border border-red-200 text-center uppercase">
                        {(selectedRecord.lorry_number || (selectedRecord as any).lorry_no || (selectedRecord as any).vehicle_no) || 'N/A'}
                      </span>
                    </div>
                  </LegacyFieldset>

                </div>

                {/* Sub row details of weigh bridges */}
                <LegacyFieldset legend="Enterprise Weigh Bridge Compilations">
                  <div className="grid grid-cols-3 gap-3 font-mono text-[11px]">
                    <div className="bg-blue-50/40 border border-blue-200 p-2 text-center rounded space-y-0.5">
                      <p className="text-[9px] font-sans font-bold text-blue-900 uppercase">Challan Weight</p>
                      <p className="text-sm font-black text-blue-950">{selectedRecord.challan_material_weight || 0} MT</p>
                    </div>
                    <div className="bg-emerald-50/40 border border-emerald-200 p-2 text-center rounded space-y-0.5">
                      <p className="text-[9px] font-sans font-bold text-emerald-900 uppercase">Supplier Net Weight</p>
                      <p className="text-sm font-black text-emerald-950">{selectedRecord.supplier_net_weight || 0} MT</p>
                    </div>
                    <div className="bg-purple-50/40 border border-purple-200 p-2 text-center rounded space-y-0.5">
                      <p className="text-[9px] font-sans font-bold text-purple-900 uppercase">Electronic Net Weight</p>
                      <p className="text-sm font-black text-purple-950">{selectedRecord.electronic_net_weight || 0} MT</p>
                    </div>
                  </div>
                </LegacyFieldset>

                {/* Grid Item Details */}
                {selectedRecord.grid_details && (
                  <LegacyFieldset legend="Material Grade Specifications Summary">
                    <div className="border border-gray-300 max-h-40 overflow-y-auto">
                      <table className="w-full text-[10px] border-collapse bg-white">
                        <thead className="bg-gray-100 sticky top-0 font-sans border-b border-gray-300">
                          <tr className="h-6 text-gray-700">
                            <th className="px-2 border-r border-gray-300 font-bold text-center w-10">Srl</th>
                            <th className="px-2 border-r border-gray-300 font-bold text-center w-16">Grade Code</th>
                            <th className="px-2 border-r border-gray-300 font-bold text-left">Grade Name</th>
                            <th className="px-2 border-r border-gray-300 font-bold text-center w-16">Crop Yr</th>
                            <th className="px-2 border-r border-gray-300 font-bold text-left">Marka Name</th>
                            <th className="px-2 border-r border-gray-300 font-bold text-right w-24">Netto Weight (MT)</th>
                            <th className="px-2 font-bold text-right w-24">Receipt (Bags)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 font-mono">
                          {(() => {
                            try {
                              const list = typeof selectedRecord.grid_details === 'string' 
                                ? (selectedRecord.grid_details === 'undefined' || selectedRecord.grid_details === 'null' ? [] : JSON.parse(selectedRecord.grid_details === "undefined" ? "null" : selectedRecord.grid_details)) 
                                : selectedRecord.grid_details;
                              
                              if (!Array.isArray(list)) return null;

                              return list.map((item: any, i: number) => (
                                <tr key={i} className="h-6 hover:bg-slate-50">
                                  <td className="text-center font-bold text-gray-500 border-r border-gray-200">{item.srl_no || (i + 1)}</td>
                                  <td className="text-center font-bold text-slate-800 border-r border-gray-200">{item.receipt_grade_code || '--'}</td>
                                  <td className="px-2 border-r border-gray-200 text-indigo-950 font-bold uppercase">{item.receipt_grade_name || item.challan_grade_name || '--'}</td>
                                  <td className="text-center border-r border-gray-200">{item.crop_year || '--'}</td>
                                  <td className="px-2 border-r border-gray-200 uppercase">{item.challan_marka_name || '--'}</td>
                                  <td className="text-right pr-2 font-black text-blue-900 border-r border-gray-200">{item.netto_pnto ? Number(item.netto_pnto).toFixed(3) : '0.000'}</td>
                                  <td className="text-right pr-2 font-semibold text-amber-950">{item.quantity_rcpt || 0}</td>
                                </tr>
                              ));
                            } catch (e) {
                              return <tr><td colSpan={7} className="text-center py-2">Failed to parse detailed lists</td></tr>;
                            }
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </LegacyFieldset>
                )}

                {/* Remarks & System notes */}
                {selectedRecord.remarks && (
                  <div className="p-2 border border-gray-400 bg-white font-mono text-[10px] text-gray-600 leading-snug">
                    <span className="font-bold text-gray-800">REMARKS & ADVICE NOTES: </span>
                    {selectedRecord.remarks}
                  </div>
                )}

              </div>

              {/* Footer bar */}
              <div className="bg-[#c0c0c0] p-2 flex justify-end gap-2 border-t border-gray-400">
                <LegacyButton
                  onClick={() => setSelectedRecord(null)}
                  variant="default"
                >
                  OK, Close Details
                </LegacyButton>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PrintModal
        isOpen={isPrintingModalOpen}
        onClose={() => setIsPrintingModalOpen(false)}
        title="MARKS & QUALITY RECEIVED [MILL COPY - CONTINUOUS PRINT FORM]"
        showTip={false}
      >
        {printData && (
            <div className="p-4 bg-[#a0a0a0] flex justify-center overflow-x-auto print:bg-white print:p-0">
              <div className="print-continuous-paper-container flex bg-white shadow-2xl border border-gray-400 select-text pr-px print:shadow-none print:border-none">
                    
                    {/* Left Tractor Feed band with holes */}
                    <div id="tractor-feed-holes-left" className="w-[32px] bg-[#fdfaf2] border-r border-red-200 flex flex-col justify-between py-6 shrink-0 ">
                      {Array.from({ length: 18 }).map((_, i) => (
                        <div key={i} className="w-3.5 h-3.5 bg-[#403c34]/50 rounded-full mx-auto shadow-[inset_1.5px_1.5px_2.5px_rgba(0,0,0,0.7)] opacity-85 border border-amber-900/10"></div>
                      ))}
                    </div>

                    {/* Main Print Slip Sheet */}
                    <div id="print-sheet-wrapper" className="w-[840px] bg-white p-6 md:p-8 flex flex-col justify-between select-text text-black print:p-0 print:w-full">
                      
                      {/* Slip Header */}
                      <div>
                        <div className="flex justify-between items-start">
                          <div className="text-left max-w-[320px]">
                            <h1 className="font-sans font-black text-xl tracking-tight text-red-600 leading-none">BALLY JUTE COMPANY LIMITED</h1>
                            <p className="text-[10px] font-bold text-red-700/95 tracking-wide mt-1 uppercase font-mono">AUTHORIZED MILL PREMISES</p>
                          </div>
                          
                          <div className="text-center shrink-0 border-b-2 border-red-600 pb-1.5 px-4">
                            <h2 className="font-serif font-black text-[20px] text-red-600 uppercase tracking-widest leading-none">FINAL ARRIVAL REGISTER</h2>
                            <p className="text-[10px] font-black tracking-widest text-red-700 uppercase mt-1">MARKS & QUALITY RECEIVED</p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-extrabold text-[11px] text-red-700 uppercase border-2 border-red-600 px-2 py-0.5 tracking-widest font-mono">MILL COPY</span>
                          </div>
                        </div>

                        {/* Master Metadata Box-Wise Grid */}
                        <div className="border border-red-600 mt-5 text-[11px] font-bold text-red-700 bg-white">
                          {/* Row 1 */}
                          <div className="grid grid-cols-12 border-b border-red-600">
                            <div className="col-span-8 flex items-center px-2 py-1.5 border-r border-red-600">
                              <span className="shrink-0 font-black uppercase text-[10px] tracking-wider text-red-800 mr-2">FROM :</span>
                              <input  id="printdata_supplier_2020" name="printdata_supplier" aria-label="printdata supplier"
                                value={printData.supplier || ''} 
                                onChange={(e) => setPrintData({...printData, supplier: e.target.value})}
                                className="flex-1 bg-transparent border-0 p-0 focus:ring-0 focus:outline-none uppercase text-black font-black text-[11.5px]"
                              />
                            </div>
                            <div className="col-span-4 flex items-center px-2 py-1.5">
                              <span className="shrink-0 font-black uppercase text-[10px] tracking-wider text-red-800 mr-2">M.R. NO. :</span>
                              <input  id="printdata_mr_no_2028" name="printdata_mr_no" aria-label="printdata mr no"
                                value={printData.mr_no || ''} 
                                onChange={(e) => setPrintData({...printData, mr_no: e.target.value})}
                                className="flex-1 bg-transparent border-0 p-0 focus:ring-0 focus:outline-none uppercase text-black font-mono font-black text-[11.5px]"
                              />
                            </div>
                          </div>
                          {/* Row 2 */}
                          <div className="grid grid-cols-12">
                            <div className="col-span-4 flex items-center px-2 py-1.5 border-r border-red-600">
                              <span className="shrink-0 font-black uppercase text-[10px] tracking-wider text-red-800 mr-2">DATE :</span>
                              <input  id="printdata_mr_date_2039" name="printdata_mr_date" aria-label="printdata mr date"
                                type="date"
                                value={printData.mr_date || ''} 
                                onChange={(e) => setPrintData({...printData, mr_date: e.target.value})}
                                className="flex-1 bg-transparent border-0 p-0 focus:ring-0 focus:outline-none text-black font-black text-xs"
                              />
                            </div>
                            <div className="col-span-4 flex items-center px-2 py-1.5 border-r border-red-600">
                              <span className="shrink-0 font-black uppercase text-[10px] tracking-wider text-red-800 mr-2">ORDER NO. :</span>
                              <input  id="printdata_po_no_2048" name="printdata_po_no" aria-label="printdata po no"
                                value={printData.po_no || ''} 
                                onChange={(e) => setPrintData({...printData, po_no: e.target.value})}
                                className="flex-1 bg-transparent border-0 p-0 focus:ring-0 focus:outline-none uppercase text-black font-mono font-black text-[11.5px]"
                              />
                            </div>
                            <div className="col-span-4 flex items-center px-2 py-1.5">
                              <span className="shrink-0 font-black uppercase text-[10px] tracking-wider text-red-800 mr-2">DATE :</span>
                              <input  id="printdata_po_date_2056" name="printdata_po_date" aria-label="printdata po date"
                                type="date"
                                value={printData.po_date || ''} 
                                onChange={(e) => setPrintData({...printData, po_date: e.target.value})}
                                className="flex-1 bg-transparent border-0 p-0 focus:ring-0 focus:outline-none text-black font-black text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Table Container */}
                        <div className="mt-4 border border-red-600 bg-white">
                          <table className="w-full border-collapse text-[10px]">
                            <thead>
                              {/* Row 1 of headers */}
                              <tr className="bg-red-600 text-white font-extrabold border-b border-red-600 shrink-0 h-9">
                                {printColumns.crop_year && <th className="border-r border-red-600 text-center uppercase p-0.5 w-[50px] text-[9.5px]" rowSpan={2}>Crop</th>}
                                {printColumns.marka && <th className="border-r border-red-600 text-center uppercase p-0.5 w-[65px] text-[9.5px]" rowSpan={2}>Mark</th>}
                                {printColumns.quality && <th className="border-r border-red-600 text-left uppercase pl-2 p-0.5 w-[140px] text-[9.5px]" rowSpan={2}>Quality</th>}
                                {printColumns.quantity_rcpt && <th className="border-r border-red-600 text-right uppercase pr-2 p-0.5 w-[65px] text-[9.5px]" rowSpan={2}>Quantity</th>}
                                {printColumns.unit && <th className="border-r border-red-600 text-center uppercase p-0.5 w-[50px] text-[9.5px]" rowSpan={2}>Unit</th>}
                                {printColumns.claim && <th className="border-r border-red-600 text-center uppercase p-0.5 w-[60px] text-[9.5px]" rowSpan={2}>Claim</th>}
                                {printColumns.gross_wt && <th className="border-r border-red-600 text-right uppercase pr-2 p-0.5 w-[75px] text-[9.5px]" rowSpan={2}>Gross Wt.</th>}
                                {printColumns.moisture_pct && <th className="border-r border-red-600 text-center uppercase p-0.5 w-[50px] text-[8.5px] no-print" rowSpan={2}>Moisture<br/>% Kg.</th>}
                                {printColumns.dust_pct && <th className="border-r border-red-600 text-center uppercase p-0.5 w-[50px] text-[8.5px] no-print" rowSpan={2}>Dust<br/>% Kg.</th>}
                                {printColumns.ncv_pct && <th className="border-r border-red-600 text-center uppercase p-0.5 w-[50px] text-[8.5px] no-print" rowSpan={2}>NCV<br/>% Kg.</th>}
                                {printColumns.net_wt && <th className="border-r border-red-600 text-right uppercase pr-2 p-0.5 w-[75px] text-[9.5px]" rowSpan={2}>Net Wt.</th>}
                                {printColumns.settlement && <th className="border-r border-red-600 text-center uppercase p-0.5" colSpan={4}>Settlement</th>}
                                {printColumns.rate && <th className="text-right uppercase pr-2 p-0.5 w-[60px] text-[9.5px]" rowSpan={2}>Rate</th>}
                              </tr>
                              {/* Row 2 of headers for settlement subdivisions */}
                              {printColumns.settlement && (
                                <tr className="bg-red-600 text-white font-bold border-b border-red-600 h-6">
                                  <th className="border-r border-red-500 text-center p-0.5 text-[8.2px] uppercase w-[55px]">Grade</th>
                                  <th className="border-r border-red-500 text-center p-0.5 text-[8.2px] uppercase w-[50px] no-print">Moisture</th>
                                  <th className="border-r border-red-500 text-center p-0.5 text-[8.2px] uppercase w-[45px] no-print">Dust</th>
                                  <th className="border-r border-red-600 text-center p-0.5 text-[8.2px] uppercase w-[55px]">Prem./Less</th>
                                </tr>
                              )}
                            </thead>
                            <tbody className="divide-y divide-red-200">
                              {printData.rows.map((row: any, rIdx: number) => {
                                const isRowEmpty = !row.crop_year && !row.marka && !row.quality;
                                return (
                                  <tr key={rIdx} className="h-7.5 hover:bg-red-50/50">
                                    {/* Crop Year */}
                                    {printColumns.crop_year && (
                                      <td className="border-r border-red-200 text-center p-0">
                                        <input  id="field_2104" name="field" aria-label="--"
                                          value={row.crop_year || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'crop_year', e.target.value)}
                                          className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-bold font-mono text-black"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Marka */}
                                    {printColumns.marka && (
                                      <td className="border-r border-red-200 text-center p-0">
                                        <input  id="field_2115" name="field" aria-label="--"
                                          value={row.marka || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'marka', e.target.value)}
                                          className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-bold uppercase text-black"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Quality */}
                                    {printColumns.quality && (
                                      <td className="border-r border-red-200 px-1 p-0">
                                        <input  id="field_2126" name="field" aria-label="--"
                                          value={row.quality || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'quality', e.target.value)}
                                          className="w-full bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-[10px] uppercase font-bold text-black pl-1.5"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Quantity / Packet Bales */}
                                    {printColumns.quantity_rcpt && (
                                      <td className="border-r border-red-200 text-right p-0">
                                        <input  id="field_2137" name="field" aria-label="--"
                                          type={isRowEmpty ? "text" : "number"}
                                          value={row.quantity_rcpt || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'quantity_rcpt', e.target.value)}
                                          className="w-full bg-transparent text-right border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-bold font-mono text-blue-800 pr-1.5"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Unit */}
                                    {printColumns.unit && (
                                      <td className="border-r border-red-200 text-center p-0">
                                        <select  id="row_unit_bales_2149" name="row_unit_bales" aria-label="row unit bales"
                                          value={row.unit || 'BALES'} 
                                          onChange={(e) => updatePrintRow(rIdx, 'unit', e.target.value)}
                                          className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[10px] uppercase font-bold text-black cursor-pointer"
                                        >
                                          {Array.from(new Set([...unitList, row.unit].filter(Boolean))).map((u: string) => (
                                            <option key={u} value={u}>{u}</option>
                                          ))}
                                        </select>
                                      </td>
                                    )}
                                    {/* Claim */}
                                    {printColumns.claim && (
                                      <td className="border-r border-red-200 text-center p-0">
                                        <input  id="field_2163" name="field" aria-label="--"
                                          value={row.claim_val || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'claim_val', e.target.value)}
                                          className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[9.5px] text-black"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Gross Wt */}
                                    {printColumns.gross_wt && (
                                      <td className="border-r border-red-200 text-right p-0">
                                        <input  id="field_2174" name="field" aria-label="--"
                                          value={row.gross_wt || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'gross_wt', e.target.value)}
                                          className="w-full bg-transparent text-right border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-bold font-mono text-black pr-1.5"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Moisture % */}
                                    {printColumns.moisture_pct && (
                                      <td className="border-r border-red-200 text-center p-0 no-print">
                                        <input  id="field_2185" name="field" aria-label="--"
                                          value={row.moisture_pct || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'moisture_pct', e.target.value)}
                                          className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-bold font-mono text-black"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Dust % */}
                                    {printColumns.dust_pct && (
                                      <td className="border-r border-red-200 text-center p-0 no-print">
                                        <input  id="field_2196" name="field" aria-label="--"
                                          value={row.dust_pct || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'dust_pct', e.target.value)}
                                          className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-bold font-mono text-black"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* NCV % */}
                                    {printColumns.ncv_pct && (
                                      <td className="border-r border-red-200 text-center p-0 no-print">
                                        <input  id="field_2207" name="field" aria-label="--"
                                          value={row.ncv_pct || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'ncv_pct', e.target.value)}
                                          className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-bold font-mono text-black"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Net Wt */}
                                    {printColumns.net_wt && (
                                      <td className="border-r border-red-200 text-right p-0">
                                        <input  id="field_2218" name="field" aria-label="--"
                                          value={row.net_wt || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'net_wt', e.target.value)}
                                          className="w-full bg-transparent text-right border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-black font-mono text-red-700 pr-1.5"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                    {/* Settlement: Grade, Moisture, Dust, Premium */}
                                    {printColumns.settlement && (
                                      <>
                                        <td className="border-r border-red-200 p-0 text-center">
                                          <input  id="field_2230" name="field" aria-label="--"
                                            value={row.settlement_grade || ''} 
                                            onChange={(e) => updatePrintRow(rIdx, 'settlement_grade', e.target.value)}
                                            className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[9.5px] uppercase"
                                            placeholder="--"
                                          />
                                        </td>
                                        <td className="border-r border-red-200 p-0 text-center">
                                          <input  id="field_2238" name="field" aria-label="--"
                                            value={row.settlement_moisture || ''} 
                                            onChange={(e) => updatePrintRow(rIdx, 'settlement_moisture', e.target.value)}
                                            className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[9.5px]"
                                            placeholder="--"
                                          />
                                        </td>
                                        <td className="border-r border-red-200 p-0 text-center">
                                          <input  id="field_2246" name="field" aria-label="--"
                                            value={row.settlement_dust || ''} 
                                            onChange={(e) => updatePrintRow(rIdx, 'settlement_dust', e.target.value)}
                                            className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[9.5px]"
                                            placeholder="--"
                                          />
                                        </td>
                                        <td className="border-r border-red-200 p-0 text-center">
                                          <input  id="field_2254" name="field" aria-label="--"
                                            value={row.settlement_prem_less || ''} 
                                            onChange={(e) => updatePrintRow(rIdx, 'settlement_prem_less', e.target.value)}
                                            className="w-full bg-transparent text-center border-none p-0 focus:ring-0 focus:outline-none text-[9.5px]"
                                            placeholder="--"
                                          />
                                        </td>
                                      </>
                                    )}
                                    {/* Rate */}
                                    {printColumns.rate && (
                                      <td className="text-right p-0">
                                        <input  id="field_2266" name="field" aria-label="--"
                                          value={row.rate || ''} 
                                          onChange={(e) => updatePrintRow(rIdx, 'rate', e.target.value)}
                                          className="w-full bg-transparent text-right border-none p-0 focus:ring-0 focus:outline-none text-[10px] font-bold font-mono text-black pr-1.5"
                                          placeholder="--"
                                        />
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}

                              {/* TOTAL ROW */}
                              <tr className="h-8.5 border-t-2 border-red-600 bg-red-50/30 text-red-700 font-extrabold ">
                                {((printColumns.crop_year ? 1 : 0) + (printColumns.marka ? 1 : 0) + (printColumns.quality ? 1 : 0)) > 0 && (
                                  <td className="border-r border-red-600 text-center border-b border-red-600" colSpan={(printColumns.crop_year ? 1 : 0) + (printColumns.marka ? 1 : 0) + (printColumns.quality ? 1 : 0)}>
                                    <span className="text-[10px] tracking-widest font-black uppercase">TOTALS:</span>
                                  </td>
                                )}
                                {/* Total Qty (bales) */}
                                {printColumns.quantity_rcpt && (
                                  <td className="border-r border-red-600 text-right pr-1.5 font-mono text-black font-black text-[11px]">
                                    {printTotalQty > 0 ? printTotalQty.toLocaleString() : '--'}
                                  </td>
                                )}
                                {printColumns.unit && <td className="border-r border-red-600 border-b border-red-600"></td>}
                                {printColumns.claim && <td className="border-r border-red-600 border-b border-red-600"></td>}
                                {/* Total Gross Wt. */}
                                {printColumns.gross_wt && (
                                  <td className="border-r border-red-600 text-right pr-1.5 font-mono text-black font-black text-[11px]">
                                    {printTotalGrossWt > 0 ? printTotalGrossWt.toFixed(3) : '--'}
                                  </td>
                                )}
                                {/* Deduction Column spacers */}
                                {printColumns.moisture_pct && <td className="border-r border-red-200 border-b border-red-600 no-print"></td>}
                                {printColumns.dust_pct && <td className="border-r border-red-200 border-b border-red-600 no-print"></td>}
                                {printColumns.ncv_pct && <td className="border-r border-red-600 border-b border-red-600 no-print"></td>}
                                {/* Total Net Wt. */}
                                {printColumns.net_wt && (
                                  <td className="border-r border-red-600 text-right pr-1.5 font-mono text-red-700 font-black text-[11.5px]">
                                    {printTotalNetWt > 0 ? printTotalNetWt.toFixed(3) : '--'}
                                  </td>
                                )}
                                {/* Right subdivisions and Rate spacers */}
                                {printColumns.settlement && <td className="border-r border-red-600 border-b border-red-600" colSpan={4}></td>}
                                {printColumns.rate && <td className="text-right border-b border-red-600"></td>}
                              </tr>
                            </tbody>
                          </table>
                        </div>



                        {/* Remarks Section */}
                        <div className="mt-3 text-[11px] font-bold text-red-700">
                          <div className="flex items-start gap-1.5">
                            <span className="shrink-0 mt-0.5 uppercase tracking-wide">Remarks:</span>
                            <textarea  id="no_remarks_registered_cli_2323" name="no_remarks_registered_cli" aria-label="No remarks registered. Click to write any custom remarks or specifications on-form..."
                              rows={2}
                              value={printData.remarks || ''} 
                              onChange={(e) => setPrintData({...printData, remarks: e.target.value})}
                              className="flex-1 bg-transparent border-b border-dashed border-red-300 p-0 focus:ring-0 focus:outline-none text-black text-[11px] font-black h-11 w-full resize-none leading-tight"
                              placeholder="No remarks registered. Click to write any custom remarks or specifications on-form..."
                            />
                          </div>
                        </div>

                        {/* Sub Footer Box */}
                        <div className="grid grid-cols-12 border border-red-600 mt-4 text-[10px] font-bold text-red-700 divide-x divide-red-600">
                          <div className="col-span-5 p-2 flex flex-col justify-center">
                            <div className="flex items-center gap-1.5">
                              <span className="shrink-0 uppercase">Challan No & Date :</span>
                              <input  id="printdata_challan_rr_no_2338" name="printdata_challan_rr_no" aria-label="printdata challan rr no"
                                value={printData.challan_rr_no || ''} 
                                onChange={(e) => setPrintData({...printData, challan_rr_no: e.target.value})}
                                className="flex-1 bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-black font-extrabold uppercase text-[10.5px]"
                              />
                            </div>
                          </div>
                          <div className="col-span-4 p-2 flex flex-col justify-center">
                            <div className="flex items-center gap-1.5">
                              <span className="shrink-0 uppercase">Lorry Number :</span>
                              <input  id="printdata_lorry_number_2348" name="printdata_lorry_number" aria-label="printdata lorry number"
                                value={printData.lorry_number || ''} 
                                onChange={(e) => setPrintData({...printData, lorry_number: e.target.value})}
                                className="flex-1 bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-black font-extrabold font-mono uppercase text-[10.5px]"
                              />
                            </div>
                          </div>
                          <div className="col-span-3 p-2 flex flex-col justify-center">
                            <div className="flex items-center gap-1.5">
                              <span className="shrink-0 uppercase">Stations :</span>
                              <input  id="printdata_arrival_area_na_2358" name="printdata_arrival_area_na" aria-label="printdata arrival area na"
                                value={printData.arrival_area_name || ''} 
                                onChange={(e) => setPrintData({...printData, arrival_area_name: e.target.value})}
                                className="flex-1 bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-black font-extrabold uppercase text-[10.5px]"
                              />
                            </div>
                          </div>
                        </div>

                      </div>

                      {/* Notes Terms & Conditions & Signatures Section */}
                      <div className="grid grid-cols-12 mt-4 text-[8.2px] leading-tight text-red-700/90 pt-2.5">
                        <div className="col-span-7 flex flex-col gap-1 border-r border-red-300 pr-4">
                          <p className="font-black uppercase tracking-wider text-[8.5px] text-red-800">Note:</p>
                          <p>1. Initiate your offer of settlement at an early date failing which we shall refer the matter to B.C.C.I for arbitrator.</p>
                          <p>2. Seller must remove the bales within three days from the date of serving the Mill Receipt if the rates given on the Mill Receipt by the Buyers are not acceptable to them, failing which Buyer will treat the consignment as having been accepted and will not be responsible for its being used up.</p>
                          <p>3. Net weight is reduced from gross weight to account for seasonal moisture excess exceeding DAISEE or standard limits, along with dust allowances. Deductions are determined strictly from authorized material inspections.</p>
                          <p className="font-extrabold text-[9px] text-red-700 uppercase tracking-wide mt-1">ORIGINAL MUST BE ATTACHED WITH BILL/COPY</p>
                        </div>
                        <div className="col-span-5 flex flex-col justify-between pl-4 text-center">
                          <p className="font-black text-[12px] tracking-wide uppercase font-sans text-red-800/90">For, BALLY JUTE COMPANY LIMITED</p>
                          <div className="mt-7 flex flex-col items-center">
                            <div className="w-56 border-t border-dashed border-red-400"></div>
                            <p className="font-bold text-[9px] mt-1 text-red-700/80 uppercase">Authorised Signatory</p>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Right Tractor Feed band with holes */}
                    <div id="tractor-feed-holes-right" className="w-[32px] bg-[#fdfaf2] border-l border-[#dcd8cc] flex flex-col justify-between py-6 shrink-0 ">
                      {Array.from({ length: 18 }).map((_, i) => (
                        <div key={i} className="w-3.5 h-3.5 bg-[#403c34]/50 rounded-full mx-auto shadow-[inset_1.5px_1.5px_2.5px_rgba(0,0,0,0.7)] opacity-85 border border-amber-900/10"></div>
                      ))}
                    </div>
                  </div>
                </div>
        )}
      </PrintModal>
    </LegacyLayout>
  );
}
