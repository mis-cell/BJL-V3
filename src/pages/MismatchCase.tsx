import React, { useState, useEffect } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  Scale, 
  Clock, 
  TrendingUp, 
  Check, 
  FileSpreadsheet, 
  RefreshCw,
  Info,
  Lock
} from 'lucide-react';
import { cn, canApproveMismatch } from '../lib/utils';
import { PaginationControls } from '../components/PaginationControls';
import { dbModule } from '../services/dbModule';
import { supabase } from '../lib/supabase';
import { comparePoInspection, compareSaudaTempArrival, PoMismatchDetail } from '../lib/poMatch';
import LegacyLayout from '../components/LegacyLayout';
import { getCurrentUserContext } from '../lib/permissions';

function safeStr(val: any, fallback = ''): string {
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
    if (typeof val.area_name === 'string') return val.area_name;
    if (typeof val.agency_name === 'string') return val.agency_name;
    if (typeof val.grade_name === 'string') return val.grade_name;
    if (val.supplier) return safeStr(val.supplier, fallback);
    if (val.broker) return safeStr(val.broker, fallback);
    return fallback;
  }
  return fallback;
}

const inMemorySattaResolutions: Record<string, any> = {};

// Excel Seed Data for Satta differentials
const EXCEL_SEED_DATA = [
  {
    area: "DAISEE",
    diffs: { TD4: 600, TD5: -300, TD6: -200, TD7: -500, TD8: -1000, "H.BALES": -50, DRUMS: -100 }
  },
  {
    area: "TULSIHATTA",
    diffs: { TD5: 750, TD6: 350, TD7: -55, TD8: -550 }
  },
  {
    area: "BANGLADESH",
    diffs: { "BTR HD KS": 2800, "BTR HD CS": 2300, "BTR HD BS": 1800, "BTR NB KS": 800, "BTR NB FFS": 1300, "BTR NB (SMR)": 200 }
  },
  {
    area: "GRP LOOSE",
    diffs: { TD5: 400, TD6: 0, TD7: -400, TD8: -900 }
  },
  {
    area: "L/A TARABARI",
    diffs: { TD4: 1800, TD5: 1400, TD6: 900, TD7: 300, TD8: -100 }
  },
  {
    area: "U/ASSAM",
    diffs: { TD4: 1800, TD5: 1400, TD6: 900, TD7: 300, TD8: -100, LOOSE: -200 }
  },
  {
    area: "KANKI",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "RAIGANJ",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "DHULIYAAN",
    diffs: { TD4: 0, TD5: -200, TD6: -500, TD7: -1000 }
  },
  {
    area: "SAMSI JUNGLE",
    diffs: { TD4: 0, TD5: -200, TD6: -500, TD7: -1000 }
  },
  {
    area: "RAIGANJ Loose",
    diffs: { TD5: 400, TD6: 0, TD7: -400, TD8: -900 }
  },
  {
    area: "NORTHERN",
    diffs: { TD6: 3200, TD7: 2800, TD8: 2300, TD9: 1800, TD10: 1300, W5: 1800, W6: 1300 }
  },
  {
    area: "GAJAL LOOSE",
    diffs: {}
  },
  {
    area: "BADURIA",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "BASIRHAT",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "GOLABRI D/D",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "HARIPAL",
    diffs: { TD5: -300, TD6: -205, TD7: -500, TD8: -1000 }
  },
  {
    area: "MAYNA D/S",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "S/N ISLAMPUR",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "SHEORAPHULLY",
    diffs: { HBJB: -1000, ROPES: -1000, CUTTING: -700, "TH.WASTE": -10000, "RRY CUTT": -12000 }
  },
  {
    area: "PURNEA(BIHAR)",
    diffs: { TD5: 500, TD6: 100, TD7: -300, TD8: -800 }
  },
  {
    area: "PURNEA (LOOSE)",
    diffs: { TD5: 100, TD6: -300, TD7: -700, TD8: -1200 }
  }
];

const GRADE_SATTA_VARIANCE_LIMITS: Record<string, number> = {
  'TD4': 0,
  'TD5': 0,
  'TD6': 0,
  'TD7': 0,
  'TD8': 0,
  'DEFAULT': 0
};

export interface MaterialMismatchItem {
  id: string;
  poNo: string;
  saudaNo: string;
  supplierName: string;
  brokerName: string;
  area: string;
  grade: string;
  agency: string;
  ptfMode: string;
  poContract: string;
  challanSupplier: string;
  ratePerMt: string;
  lorryNumber: string;
  lorryProgress: {
    totalLorries: number;
    receivedLorries: number;
    remainingLorries: number;
  };
  mismatchedFields: string[];
  mismatchDetailsList: PoMismatchDetail[];
  detectedAt: string;
  issueDescription: string;
  severity: 'low' | 'medium' | 'high';
  status: 'pending' | 'resolved';
  isClosed?: boolean;
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  approvalLevel?: string;
}

export interface SattaMismatchItem {
  id: string;
  poNo: string;
  saudaNo?: string;
  poDate: string;
  supplierName: string;
  brokerName: string;
  area: string;
  grade: string;
  poRateMt: number;
  poRateQtl: number;
  sattaBaseRateQtl: number;
  differentialQtl: number;
  sattaFinalRateMt: number;
  sattaFinalRateQtl: number;
  status: 'dispute' | 'ok' | 'resolved';
  issueDescription: string;
  differenceMt: number;
  differenceQtl: number;
  weightMt: number;
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  approvalLevel?: string;
  sourceType?: 'sauda_master' | 'sms_sauda' | 'sauda_check_point' | 'purchase_master';
  sourceLabel?: string;
}

export default function MismatchCase({ onClose, variant = 'satta' }: { onClose?: () => void; variant?: 'satta' | 'material' }) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'ruka_to_satta' | 'material_inspection'>(variant === 'material' ? 'material_inspection' : 'ruka_to_satta');
  
  // Material Mismatch States
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [selectedBroker, setSelectedBroker] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [mismatchList, setMismatchList] = useState<MaterialMismatchItem[]>([]);
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  
  // Satta Mismatch States
  const [sattaMismatchList, setSattaMismatchList] = useState<SattaMismatchItem[]>([]);
  const [sattaFilterStatus, setSattaFilterStatus] = useState<'all' | 'dispute' | 'ok' | 'resolved'>('dispute');
  const [sattaSourceFilter, setSattaSourceFilter] = useState<'ALL' | 'sauda_master' | 'sauda_check_point' | 'purchase_master'>('ALL');
  const [savingSattaId, setSavingSattaId] = useState<string | null>(null);

  // 100-rows per page pagination (searches full dataset, displays paginated)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [sattaCurrentPage, setSattaCurrentPage] = useState(1);
  const [sattaPageSize, setSattaPageSize] = useState(100);

  useEffect(() => {
    setCurrentPage(1);
    setSattaCurrentPage(1);
  }, [searchQuery, filterStatus, selectedSupplier, selectedBroker, sattaFilterStatus, sattaSourceFilter]);

  const [successToast, setSuccessToast] = useState<string | null>(null);

  const parseDateToComparable = (dateStr: string) => {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) return dateStr;
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dateStr;
  };

  const getSattaRate = (date: string, poArea: string, poGrade: string, baseRates: any[], differentials: any[]) => {
    if (!date) return { baseRate: 17500, differential: 0, finalRate: 17500 };

    const sortedBase = [...baseRates].sort((a, b) => b.start_date.localeCompare(a.start_date));
    const effectiveBase = sortedBase.find(r => r.start_date <= date) || sortedBase[sortedBase.length - 1];
    const baseRate = effectiveBase ? Number(effectiveBase.base_rate) : 16700;

    const cleanArea = (poArea || '').trim().toUpperCase();
    const cleanGrade = (poGrade || '').trim().replace(/\./g, '').toUpperCase();

    const lookupAreas = [cleanArea];
    if (cleanArea === 'SEMI NORTHERN' || cleanArea.includes('SEMI NORTHERN')) {
      lookupAreas.push('NORTHERN');
    } else if (cleanArea === 'NORTHERN' || cleanArea.includes('NORTHERN')) {
      lookupAreas.push('SEMI NORTHERN');
    }

    if (cleanArea.includes('PURNEA') || cleanArea.includes('BIHAR')) {
      if (!lookupAreas.includes('PURNEA(BIHAR)')) lookupAreas.push('PURNEA(BIHAR)');
      if (!lookupAreas.includes('PURNEA')) lookupAreas.push('PURNEA');
    }

    let differential: number | undefined;
    for (const lookupArea of lookupAreas) {
      const match = differentials.find(d => 
        (d.area || '').trim().toUpperCase() === lookupArea &&
        (d.grade || '').trim().replace(/\./g, '').toUpperCase() === cleanGrade
      );
      if (match) {
        differential = Number(match.differential);
        break;
      }
    }

    if (differential === undefined) {
      for (const lookupArea of lookupAreas) {
        const seedArea = EXCEL_SEED_DATA.find(r => r.area.toUpperCase() === lookupArea);
        if (seedArea && seedArea.diffs) {
          const key = Object.keys(seedArea.diffs).find(k => k.toUpperCase() === cleanGrade);
          if (key) {
            differential = (seedArea.diffs as Record<string, number>)[key];
            break;
          }
        }
      }
    }

    if (differential === undefined) {
      differential = 0;
    }

    return {
      baseRate,
      differential,
      finalRate: baseRate + differential
    };
  };

  const loadMismatches = async () => {
    setLoading(true);
    try {
      // Direct fresh queries from database (no browser cache dependency)
      const [scpRows, scpDetailRows, amadRows, matInspRows, millInspRows, dbMismatches, purchaseMasterRows, purchaseDetailRows, sattaBaseRows, sattaDiffRows, gradeRows, dbSattaMismatches, saudaMasterRows, saudaQualityRows, sattaMasterRows, sattaQualityRows, smsSaudaDbRows] = await Promise.all([
        supabase ? supabase.from('sauda_check_point').select('*').then(res => res.data || []) : dbModule.fetchAll('sauda_check_point').catch(() => []),
        supabase ? supabase.from('sauda_check_point_details').select('*').then(res => res.data || []) : dbModule.fetchAll('sauda_check_point_details').catch(() => []),
        dbModule.fetchAll('temporary_material_received').catch(() => []),
        dbModule.fetchAll('material_inspection').catch(() => []),
        dbModule.fetchAll('mill_inspection_master').catch(() => []),
        supabase ? supabase.from('material_mismatch').select('*').then(res => res.data || []) : dbModule.fetchAll('material_mismatch').catch(() => []),
        supabase ? supabase.from('purchase_master').select('*').then(res => res.data || []) : dbModule.fetchAll('purchase_master').catch(() => []),
        supabase ? supabase.from('purchase_detail_master').select('*').then(res => res.data || []) : Promise.resolve([]),
        supabase ? supabase.from('satta_base_rates').select('*').then(res => res.data || []) : Promise.resolve([]),
        supabase ? supabase.from('satta_differentials').select('*').then(res => res.data || []) : Promise.resolve([]),
        dbModule.fetchAll('grade_master').catch(() => []),
        supabase ? supabase.from('satta_mismatch').select('*').then(res => res.data || []) : dbModule.fetchAll('satta_mismatch').catch(() => []),
        supabase ? supabase.from('sauda_master').select('*').then(res => res.data || []) : dbModule.fetchAll('sauda_master').catch(() => []),
        supabase ? supabase.from('sauda_quality_details').select('*').then(res => res.data || []) : dbModule.fetchAll('sauda_quality_details').catch(() => []),
        supabase ? supabase.from('satta_master').select('*').then(res => res.data || []) : dbModule.fetchAll('satta_master').catch(() => []),
        supabase ? supabase.from('satta_quality_details').select('*').then(res => res.data || []) : dbModule.fetchAll('satta_quality_details').catch(() => []),
        supabase ? supabase.from('sms_sauda').select('*').then(res => res.data || []) : Promise.resolve([]),
      ]);

      const inspMasterRows = [...(matInspRows || []), ...(millInspRows || [])];

      let localSmsSaudas: any[] = [];
      try {
        localSmsSaudas = JSON.parse(localStorage.getItem('po_auto_sms_saudas') || '[]');
      } catch (e) {}

      const combinedSmsSaudas = [...smsSaudaDbRows, ...localSmsSaudas];

      const items: MaterialMismatchItem[] = [];

      // Combine PO sources: sauda_check_point + purchase_master + sauda_master + satta_master
      const allPoRecords = [...scpRows, ...purchaseMasterRows, ...saudaMasterRows, ...sattaMasterRows];
      const poMap = new Map<string, any>();
      allPoRecords.forEach(p => {
        const pNo = String(p.po_no || p.contract_po_no || p.sauda_no || p.satta_no || '').trim().toUpperCase();
        if (pNo && !poMap.has(pNo)) poMap.set(pNo, p);
      });

      const allDetailRecords = [...scpDetailRows, ...purchaseDetailRows, ...saudaQualityRows, ...sattaQualityRows];

      poMap.forEach((po, poNo) => {
        const matchingInspections = inspMasterRows.filter((i: any) => {
          const iPo = String(i.po_no || '').trim().toUpperCase();
          const mPo = String(i.mill_po_no || '').trim().toUpperCase();
          return (iPo && iPo === poNo) || (mPo && mPo === poNo);
        });
        const matchingAmads = amadRows.filter((a: any) => String(a.po_no || '').trim().toUpperCase() === poNo);
        const poDetails = allDetailRecords.filter((d: any) => String(d.po_no || '').trim().toUpperCase() === poNo);

        const latestInsp = matchingAmads[0] || matchingInspections[0] || null;
        if (!latestInsp) return;

        const enrichedInsp = {
          ...(matchingInspections[0] || {}),
          ...(matchingAmads[0] || {}),
        };

        const allLorryReceipts = [...matchingInspections];

        const matchRes = compareSaudaTempArrival(po, poDetails, enrichedInsp, allLorryReceipts);

        if (matchRes.hasInspection && matchRes.status === 'mismatch' && matchRes.mismatches.length > 0) {
          const dbMm = (dbMismatches || []).find((m: any) => {
            const mPo = String(m.po_no || '').trim().toUpperCase();
            const mId = String(m.mismatch_id || m.id || '').toUpperCase();
            const poUpper = poNo.toUpperCase();
            const poSuffix = poUpper.split('/').pop() || '';
            return (
              (mPo && (mPo === poUpper || poUpper.includes(mPo) || mPo.includes(poUpper) || (poSuffix && mPo.includes(poSuffix)))) ||
              mId === `MIS-${poUpper}` ||
              mId.includes(poUpper) ||
              (poSuffix && mId.includes(poSuffix))
            );
          });
          
          const isCleared = Boolean(
            po.mismatch_cleared === true || 
            (dbMm && (
              dbMm.status === 'resolved' || 
              dbMm.status === 'approved' ||
              dbMm.status === 'cleared' ||
              Boolean(dbMm.approved_by) ||
              String(dbMm.remarks || '').toLowerCase().includes('approved') ||
              String(dbMm.remarks || '').toLowerCase().includes('resolved')
            )) ||
            localStorage.getItem(`material_resolved_${poNo.toUpperCase()}`) ||
            (poNo.split('/').pop() && localStorage.getItem(`material_resolved_${poNo.split('/').pop()?.toUpperCase()}`)) ||
            localStorage.getItem(`material_resolved_MIS-${poNo.toUpperCase()}`)
          );

          const mismatchedLabels = matchRes.mismatches.map(m => m.mismatchLabel || `${m.field} mismatch`);

          items.push({
            id: `MIS-${poNo}`,
            poNo: poNo,
            saudaNo: po.po_contract || po.contract_no || po.sauda_no || 'N/A',
            supplierName: safeStr(po.supplier || po.supplier_name, 'N/A'),
            brokerName: safeStr(po.broker || po.broker_name, 'N/A'),
            area: safeStr(po.area, 'N/A'),
            grade: safeStr(po.grade || po.quality, 'N/A'),
            agency: safeStr(po.agency || po.agency_name, 'N/A'),
            ptfMode: po.ptf_mode || po.po_type || 'N/A',
            poContract: po.po_contract || po.contract_no || 'N/A',
            challanSupplier: safeStr(po.challan_supplier, 'N/A'),
            ratePerMt: po.b_rate ? `₹ ${po.b_rate}` : (poDetails[0]?.rate_qntl ? `₹ ${poDetails[0].rate_qntl * 10}` : 'N/A'),
            lorryNumber: enrichedInsp.lorry_number || enrichedInsp.lorry_no || 'N/A',
            lorryProgress: matchRes.lorryProgress || { totalLorries: 1, receivedLorries: 1, remainingLorries: 0 },
            mismatchedFields: mismatchedLabels,
            mismatchDetailsList: matchRes.mismatches,
            detectedAt: String(enrichedInsp.created_at || po.created_at || new Date().toISOString()).split('T')[0],
            issueDescription: `Mismatched fields detected: ${mismatchedLabels.join(', ')}.`,
            severity: matchRes.mismatches.some(m => m.field.includes('Weight') || m.field.includes('Rate')) ? 'high' : 'medium',
            status: isCleared ? 'resolved' : 'pending',
            isClosed: Boolean(po.is_closed),
            resolutionNotes: (dbMm && dbMm.remarks) || po.mismatch_remarks || undefined,
            resolvedBy: (dbMm && dbMm.approved_by) || po.approved_by || (isCleared ? 'L3/L5 User' : undefined),
            resolvedAt: (dbMm && dbMm.approved_at) ? String(dbMm.approved_at).split('T')[0] : (po.approved_at ? String(po.approved_at).split('T')[0] : (isCleared ? new Date().toISOString().split('T')[0] : undefined)),
            approvalLevel: (dbMm && dbMm.approval_level) || po.approval_level || 'L3/L5',
          });
        }
      });

      // Also include standalone records from material_mismatch table in DB
      dbMismatches.forEach((r: any) => {
        const poNo = String(r.po_no || '').trim().toUpperCase();
        if (poNo && !items.some(i => i.poNo === poNo)) {
          const labels = r.mismatched_fields ? r.mismatched_fields.split(', ') : ['Material mismatch'];
          items.push({
            id: r.mismatch_id || `MIS-${poNo}`,
            poNo: poNo,
            saudaNo: 'N/A',
            supplierName: safeStr(r.supplier, 'N/A'),
            brokerName: safeStr(r.broker, 'N/A'),
            area: safeStr(r.area, 'N/A'),
            grade: safeStr(r.grade, 'N/A'),
            agency: safeStr(r.agency, 'N/A'),
            ptfMode: r.ptf_mode || 'N/A',
            poContract: 'N/A',
            challanSupplier: safeStr(r.challan_supplier, 'N/A'),
            ratePerMt: r.rate_per_mt || 'N/A',
            lorryNumber: r.lorry_number || 'N/A',
            lorryProgress: { totalLorries: 1, receivedLorries: 1, remainingLorries: 0 },
            mismatchedFields: labels,
            mismatchDetailsList: [],
            detectedAt: r.created_at ? String(r.created_at).split('T')[0] : new Date().toISOString().split('T')[0],
            issueDescription: r.issue_description || `Mismatched fields: ${labels.join(', ')}.`,
            severity: (r.severity as any) || 'medium',
            status: r.status === 'resolved' ? 'resolved' : 'pending',
            isClosed: Boolean(poMap.get(poNo)?.is_closed || r.is_closed),
            resolutionNotes: r.remarks,
            resolvedBy: r.approved_by,
            resolvedAt: r.approved_at ? String(r.approved_at).split('T')[0] : undefined,
            approvalLevel: r.approval_level || 'L3/L5',
          });
        }
      });

      setMismatchList(items);

      // --- Satta Mismatch Processing ---
      const sattaItems: SattaMismatchItem[] = [];
      const saudaPoRowsToProcess: { 
        header: any; 
        detail: any; 
        poNoFormatted: string; 
        sourceType: 'sauda_master' | 'sms_sauda' | 'sauda_check_point' | 'purchase_master'; 
        sourceLabel: string;
      }[] = [];

      // Function to generate formatted Order No (e.g. BJC0158/26-27 or BJC4007/26-27)
      const getFormattedOrderNo = (header: any) => {
        if (!header) return 'N/A';
        if (header.session && header.session.trim()) {
          const s = header.session.trim();
          if (s.includes('/')) {
            const parts = s.split('/').filter(Boolean);
            if (parts.length >= 3) return s;
            if (parts.length === 2 && parts[0] === 'BJCL') return `BJC${parts[1]}`;
          }
        }
        const val = String(header.sauda_no || header.po_no || header.contract_po_no || header.satta_no || header.order_no || '').trim();
        if (!val) return 'N/A';
        if (val.startsWith('BJC') || val.startsWith('BJCL')) return val;
        let yearPart = '26-27';
        if (header.financial_year) {
          const startYr = header.financial_year.split('-')[0].trim();
          if (startYr.length >= 4) yearPart = `${startYr.slice(-2)}-${(parseInt(startYr.slice(-2)) + 1).toString().padStart(2, '0')}`;
        }
        return `BJC${val.replace(/^#/, '')}/${yearPart}`;
      };

      // 1. Process sauda_master & sauda_quality_details (Sauda Desk Entries)
      if (saudaMasterRows.length > 0) {
        saudaMasterRows.forEach((sm: any) => {
          const formattedNo = getFormattedOrderNo(sm);
          const matchingDetails = saudaQualityRows.filter((sq: any) => 
            (sq.sauda_id && sq.sauda_id === sm.sauda_id) ||
            (sq.sauda_no && sm.sauda_no && String(sq.sauda_no).trim().toUpperCase() === String(sm.sauda_no).trim().toUpperCase())
          );

          if (matchingDetails.length > 0) {
            matchingDetails.forEach((qd: any) => {
              saudaPoRowsToProcess.push({ header: sm, detail: qd, poNoFormatted: formattedNo, sourceType: 'sauda_master', sourceLabel: 'Sauda Desk Module' });
            });
          } else {
            saudaPoRowsToProcess.push({ header: sm, detail: sm, poNoFormatted: formattedNo, sourceType: 'sauda_master', sourceLabel: 'Sauda Desk Module' });
          }
        });
      }

      // 1b. Process sms_sauda entries (SMS Sauda Desk)
      if (combinedSmsSaudas.length > 0) {
        combinedSmsSaudas.forEach((ss: any) => {
          const formattedNo = getFormattedOrderNo(ss);
          if (!saudaPoRowsToProcess.some(r => r.poNoFormatted === formattedNo)) {
            saudaPoRowsToProcess.push({
              header: ss,
              detail: ss,
              poNoFormatted: formattedNo,
              sourceType: 'sms_sauda',
              sourceLabel: 'Sauda Desk Module'
            });
          }
        });
      }

      // Fallback: Any sauda_quality_details not yet included
      saudaQualityRows.forEach((sq: any) => {
        const found = saudaPoRowsToProcess.some(r => r.detail === sq || (r.detail.sauda_id && r.detail.sauda_id === sq.sauda_id && r.detail.quality === sq.quality));
        if (!found) {
          const matchedHeader = saudaMasterRows.find((sm: any) => sm.sauda_id === sq.sauda_id || sm.sauda_no === sq.sauda_no) || sq;
          const formattedNo = getFormattedOrderNo(matchedHeader);
          saudaPoRowsToProcess.push({ header: matchedHeader, detail: sq, poNoFormatted: formattedNo, sourceType: 'sauda_master', sourceLabel: 'Sauda Desk Module' });
        }
      });

      saudaPoRowsToProcess.forEach(({ header, detail, poNoFormatted, sourceType, sourceLabel }) => {
        const poNo = poNoFormatted || String(detail.po_no || header.po_no || header.contract_po_no || header.sauda_no || '').trim().toUpperCase();
        if (!poNo || poNo === 'N/A') return;

        const matchedGrade = (gradeRows || []).find((g: any) => String(g.grade_code || '').trim() === String(detail.grade_code || detail.quality || header.grade_code || '').trim());
        const poGrade = (matchedGrade ? matchedGrade.grade_name || '' : (detail.quality || detail.grade_code || header.grade || header.quality || '')).trim().replace(/\./g, '').toUpperCase() || 'TD6';
        
        // Extract rate and normalize to Rate per Quintal (e.g. 13400)
        const rawRate = Number(detail.rs || detail.rate_qntl || detail.rate_per_qtl || detail.b_rate || detail.rate_mt || detail.rate || header.b_rate || header.rate_qntl || header.rate || 0);
        if (rawRate <= 0) return;

        // Ensure rate is full Quintal rate (e.g. 13400)
        let poRateQtl = rawRate;
        if (poRateQtl > 0 && poRateQtl < 5000) {
          poRateQtl = poRateQtl * 10;
        } else if (poRateQtl > 50000) {
          poRateQtl = poRateQtl / 10;
        }
        const poRateMt = poRateQtl * 10;

        const poDate = header.date || header.po_date || header.b_date || '2026-04-02';
        const poArea = header.area || detail.area || 'NORTHERN';

        const { baseRate, differential, finalRate } = getSattaRate(
          parseDateToComparable(poDate),
          poArea,
          poGrade,
          sattaBaseRows,
          sattaDiffRows
        );

        // Normalize Satta Base, Differential, and Final Rate to full Quintal values (e.g. Base 13500, Diff -200, Final 13300)
        let sattaBaseRateQtl = baseRate;
        if (sattaBaseRateQtl > 0 && sattaBaseRateQtl < 5000) {
          sattaBaseRateQtl = sattaBaseRateQtl * 10;
        }

        let differentialQtl = differential;
        if (differentialQtl !== 0 && Math.abs(differentialQtl) < 100) {
          differentialQtl = differentialQtl * 10;
        }

        const sattaFinalRateQtl = sattaBaseRateQtl + differentialQtl;
        const sattaFinalRateMt = sattaFinalRateQtl * 10;

        const diffInRateQtl = poRateQtl - sattaFinalRateQtl;
        const diffInRateMt = diffInRateQtl * 10;

        const allowedVarianceQtl = GRADE_SATTA_VARIANCE_LIMITS[poGrade] !== undefined 
          ? GRADE_SATTA_VARIANCE_LIMITS[poGrade] 
          : (GRADE_SATTA_VARIANCE_LIMITS.DEFAULT || 0);

        const isDispute = diffInRateQtl > allowedVarianceQtl;

        const itemId = `SAT-${detail.id || detail.item_id || `${poNo}-${poGrade}-${rawRate}`}`;
        const cleanPoNo = String(poNo || '').trim().toUpperCase();
        const cleanSaudaNo = String(header.po_contract || header.sauda_no || header.contract_no || '').trim().toUpperCase();
        const cleanRefNo = String(header.order_no || header.ref_no || header.sauda_id || '').trim().toUpperCase();

        const poSuffix = cleanPoNo.split('/').pop() || '';
        const saudaSuffix = cleanSaudaNo.split('/').pop() || '';

        const dbSattaMm = (dbSattaMismatches || []).find((sm: any) => {
          const smPo = String(sm.po_no || '').trim().toUpperCase();
          const smSauda = String(sm.sauda_no || '').trim().toUpperCase();
          const smId = String(sm.mismatch_id || sm.id || '').toUpperCase();
          return (
            (smPo && (smPo === cleanPoNo || cleanPoNo.includes(smPo) || smPo.includes(cleanPoNo) || (poSuffix && smPo.includes(poSuffix)))) ||
            (smSauda && (smSauda === cleanSaudaNo || cleanSaudaNo.includes(smSauda) || smSauda.includes(cleanSaudaNo) || (saudaSuffix && smSauda.includes(saudaSuffix)))) ||
            (cleanRefNo && smSauda && (smSauda === cleanRefNo || cleanRefNo.includes(smSauda) || smSauda.includes(cleanRefNo))) ||
            (cleanRefNo && smPo && (smPo === cleanRefNo || cleanRefNo.includes(smPo) || smPo.includes(cleanRefNo))) ||
            smId === itemId.toUpperCase() ||
            (smPo && cleanSaudaNo && (smPo.includes(cleanSaudaNo) || cleanSaudaNo.includes(smPo))) ||
            (smSauda && cleanPoNo && (smSauda.includes(cleanPoNo) || cleanPoNo.includes(smSauda))) ||
            (poSuffix && smId.includes(poSuffix)) ||
            (saudaSuffix && smId.includes(saudaSuffix))
          );
        });

        const isResolved = Boolean(
          header.satta_dispute_approved === true || 
          header.mismatch_cleared === true || 
          (dbSattaMm && (
            dbSattaMm.status === 'resolved' || 
            dbSattaMm.status === 'approved' ||
            dbSattaMm.status === 'cleared' ||
            Boolean(dbSattaMm.approved_by) ||
            String(dbSattaMm.remarks || '').toLowerCase().includes('approved') ||
            String(dbSattaMm.remarks || '').toLowerCase().includes('resolved')
          )) ||
          localStorage.getItem(`satta_resolved_${cleanPoNo}`) ||
          localStorage.getItem(`satta_resolved_${cleanSaudaNo}`) ||
          (poSuffix && localStorage.getItem(`satta_resolved_${poSuffix}`)) ||
          (saudaSuffix && localStorage.getItem(`satta_resolved_${saudaSuffix}`)) ||
          (cleanRefNo && localStorage.getItem(`satta_resolved_${cleanRefNo}`)) ||
          localStorage.getItem(`satta_resolved_${itemId.toUpperCase()}`)
        );

        sattaItems.push({
          id: itemId,
          poNo,
          saudaNo: header.po_contract || header.sauda_no || header.contract_no || poNo,
          poDate,
          supplierName: safeStr(header.supplier || header.supplier_name, 'UNKNOWN SUPPLIER'),
          brokerName: safeStr(header.broker || header.broker_name, 'UNKNOWN BROKER'),
          area: poArea,
          grade: poGrade,
          poRateMt,
          poRateQtl,
          sattaBaseRateQtl,
          differentialQtl,
          sattaFinalRateMt,
          sattaFinalRateQtl,
          status: isResolved ? 'resolved' : (isDispute ? 'dispute' : 'ok'),
          issueDescription: isDispute 
            ? `Sauda Contract Rate exceeds active Satta Chart parameters. Contract specifies ₹${poRateQtl.toLocaleString()}/Qtl, which exceeds active Satta limit of ₹${sattaFinalRateQtl.toLocaleString()}/Qtl by ₹${diffInRateQtl.toLocaleString()}/Qtl.`
            : "Sauda rate aligns with active Satta Chart parameters.",
          differenceMt: diffInRateMt,
          differenceQtl: diffInRateQtl,
          weightMt: Number(detail.weight_mt || detail.total_wt_in_ton || header.total_wt_in_ton || 0),
          resolutionNotes: (dbSattaMm && dbSattaMm.remarks) || header.satta_remarks,
          resolvedAt: (dbSattaMm && dbSattaMm.approved_at) ? String(dbSattaMm.approved_at).split('T')[0] : (header.approved_at ? String(header.approved_at).split('T')[0] : (isResolved ? new Date().toISOString().split('T')[0] : undefined)),
          resolvedBy: (dbSattaMm && dbSattaMm.approved_by) || header.approved_by || (isResolved ? 'L3/L5 User' : undefined),
          approvalLevel: (dbSattaMm && dbSattaMm.approval_level) || header.approval_level || 'L3/L5',
          sourceType,
          sourceLabel
        });
      });

      // --- Same-Date B. Rate Mismatch Detection (Sauda Desk & PTF Entry) ---
      // 1. Sauda Desk (sauda_master): Group by b_date (or date), verify b_rate is identical across same b_date
      const saudaByDate = new Map<string, any[]>();
      saudaMasterRows.forEach((sm: any) => {
        const bDate = String(sm.b_date || sm.date || '').trim();
        if (!bDate) return;
        if (!saudaByDate.has(bDate)) saudaByDate.set(bDate, []);
        saudaByDate.get(bDate)!.push(sm);
      });

      saudaByDate.forEach((entries, bDate) => {
        if (entries.length < 2) return;
        const refRate = Number(entries[0].b_rate || entries[0].rate || 0);
        for (let i = 1; i < entries.length; i++) {
          const entry = entries[i];
          const entryRate = Number(entry.b_rate || entry.rate || 0);
          if (refRate > 0 && Math.abs(entryRate - refRate) > 0.01) {
            const formattedNo = getFormattedOrderNo(entry);
            const itemId = `SD-RATEDIFF-${entry.sauda_id || formattedNo}`;
            if (!sattaItems.some(item => item.id === itemId)) {
              const cleanPoNo = String(formattedNo || '').trim().toUpperCase();
              const cleanSaudaNo = String(entry.sauda_no || formattedNo || '').trim().toUpperCase();
              const poSuffix = cleanPoNo.split('/').pop() || '';
              const saudaSuffix = cleanSaudaNo.split('/').pop() || '';
              const entryId = String(entry.sauda_id || '').toUpperCase();

              const dbSattaMm = (dbSattaMismatches || []).find((sm: any) => {
                const smPo = String(sm.po_no || '').trim().toUpperCase();
                const smSauda = String(sm.sauda_no || '').trim().toUpperCase();
                const smId = String(sm.mismatch_id || sm.id || '').toUpperCase();
                return (
                  (smId && (smId === itemId.toUpperCase() || (entryId && smId.includes(entryId)))) ||
                  (smPo && (smPo === cleanPoNo || cleanPoNo.includes(smPo) || smPo.includes(cleanPoNo) || (poSuffix && smPo.includes(poSuffix)))) ||
                  (smSauda && (smSauda === cleanSaudaNo || cleanSaudaNo.includes(smSauda) || smSauda.includes(cleanSaudaNo) || (saudaSuffix && smSauda.includes(saudaSuffix))))
                );
              });

              const isResolved = Boolean(
                entry.satta_dispute_approved === true ||
                entry.mismatch_cleared === true ||
                (dbSattaMm && (
                  dbSattaMm.status === 'resolved' ||
                  dbSattaMm.status === 'approved' ||
                  dbSattaMm.status === 'cleared' ||
                  Boolean(dbSattaMm.approved_by) ||
                  String(dbSattaMm.remarks || '').toLowerCase().includes('approved') ||
                  String(dbSattaMm.remarks || '').toLowerCase().includes('resolved')
                )) ||
                (cleanPoNo && localStorage.getItem(`satta_resolved_${cleanPoNo}`)) ||
                (cleanSaudaNo && localStorage.getItem(`satta_resolved_${cleanSaudaNo}`)) ||
                (poSuffix && localStorage.getItem(`satta_resolved_${poSuffix}`)) ||
                (saudaSuffix && localStorage.getItem(`satta_resolved_${saudaSuffix}`)) ||
                (entryId && localStorage.getItem(`satta_resolved_${entryId}`)) ||
                localStorage.getItem(`satta_resolved_${itemId.toUpperCase()}`)
              );

              sattaItems.push({
                id: itemId,
                poNo: formattedNo,
                saudaNo: entry.sauda_no || formattedNo,
                poDate: bDate,
                supplierName: safeStr(entry.supplier, 'UNKNOWN SUPPLIER'),
                brokerName: safeStr(entry.broker, 'UNKNOWN BROKER'),
                area: safeStr(entry.area, 'NORTHERN'),
                grade: safeStr(entry.grade, 'TD6'),
                poRateMt: entryRate * 10,
                poRateQtl: entryRate,
                sattaBaseRateQtl: refRate,
                differentialQtl: entryRate - refRate,
                sattaFinalRateMt: refRate * 10,
                sattaFinalRateQtl: refRate,
                status: isResolved ? 'resolved' : 'dispute',
                issueDescription: `Same-Date B. Rate Mismatch on date ${bDate}: Reference rate for date ${bDate} is ₹${refRate.toLocaleString()}/Qtl, but contract specifies ₹${entryRate.toLocaleString()}/Qtl.`,
                differenceMt: (entryRate - refRate) * 10,
                differenceQtl: entryRate - refRate,
                weightMt: Number(entry.total_wt_in_ton || 0),
                resolutionNotes: (dbSattaMm && dbSattaMm.remarks) || entry.satta_remarks,
                resolvedAt: (dbSattaMm && dbSattaMm.approved_at) ? String(dbSattaMm.approved_at).split('T')[0] : (entry.approved_at ? String(entry.approved_at).split('T')[0] : (isResolved ? new Date().toISOString().split('T')[0] : undefined)),
                resolvedBy: (dbSattaMm && dbSattaMm.approved_by) || entry.approved_by || (isResolved ? 'Administrator' : undefined),
                approvalLevel: (dbSattaMm && dbSattaMm.approval_level) || entry.approval_level || 'L3/L5',
                sourceType: 'sauda_master',
                sourceLabel: 'Sauda Desk Module (Same-Date Rate Mismatch)'
              });
            }
          }
        }
      });

      // 2. PTF Entries in Sauda Check Point / Purchase Master (where is_ptf or po_identification === 'PTF' or po_type === 'PTF')
      const ptfRows = [...scpRows, ...purchaseMasterRows].filter((p: any) => 
        p.is_ptf || p.po_identification === 'PTF' || p.po_type === 'PTF' || p.ptf_no
      );
      const ptfByDate = new Map<string, any[]>();
      ptfRows.forEach((p: any) => {
        const sDate = String(p.s_date || p.po_date || p.date || '').trim();
        if (!sDate) return;
        if (!ptfByDate.has(sDate)) ptfByDate.set(sDate, []);
        ptfByDate.get(sDate)!.push(p);
      });

      ptfByDate.forEach((entries, sDate) => {
        if (entries.length < 2) return;
        const refRate = Number(entries[0].b_rate || entries[0].rate_qntl || 0);
        for (let i = 1; i < entries.length; i++) {
          const entry = entries[i];
          const entryRate = Number(entry.b_rate || entry.rate_qntl || 0);
          if (refRate > 0 && Math.abs(entryRate - refRate) > 0.01) {
            const poNo = String(entry.po_no || entry.purchase_order || '').trim();
            const itemId = `PTF-RATEDIFF-${poNo || i}`;
            if (!sattaItems.some(item => item.id === itemId)) {
              const cleanPoNo = String(poNo || '').trim().toUpperCase();
              const cleanSaudaNo = String(entry.contract_po_no || poNo || '').trim().toUpperCase();
              const poSuffix = cleanPoNo.split('/').pop() || '';
              const saudaSuffix = cleanSaudaNo.split('/').pop() || '';

              const dbSattaMm = (dbSattaMismatches || []).find((sm: any) => {
                const smPo = String(sm.po_no || '').trim().toUpperCase();
                const smSauda = String(sm.sauda_no || '').trim().toUpperCase();
                const smId = String(sm.mismatch_id || sm.id || '').toUpperCase();
                return (
                  (smId && (smId === itemId.toUpperCase() || itemId.toUpperCase().includes(smId))) ||
                  (smPo && (smPo === cleanPoNo || cleanPoNo.includes(smPo) || smPo.includes(cleanPoNo) || (poSuffix && smPo.includes(poSuffix)))) ||
                  (smSauda && (smSauda === cleanSaudaNo || cleanSaudaNo.includes(smSauda) || smSauda.includes(cleanSaudaNo) || (saudaSuffix && smSauda.includes(saudaSuffix))))
                );
              });

              const isResolved = Boolean(
                entry.satta_dispute_approved === true ||
                entry.mismatch_cleared === true ||
                (dbSattaMm && (
                  dbSattaMm.status === 'resolved' ||
                  dbSattaMm.status === 'approved' ||
                  dbSattaMm.status === 'cleared' ||
                  Boolean(dbSattaMm.approved_by) ||
                  String(dbSattaMm.remarks || '').toLowerCase().includes('approved') ||
                  String(dbSattaMm.remarks || '').toLowerCase().includes('resolved')
                )) ||
                (cleanPoNo && localStorage.getItem(`satta_resolved_${cleanPoNo}`)) ||
                (cleanSaudaNo && localStorage.getItem(`satta_resolved_${cleanSaudaNo}`)) ||
                (poSuffix && localStorage.getItem(`satta_resolved_${poSuffix}`)) ||
                (saudaSuffix && localStorage.getItem(`satta_resolved_${saudaSuffix}`)) ||
                localStorage.getItem(`satta_resolved_${itemId.toUpperCase()}`)
              );

              sattaItems.push({
                id: itemId,
                poNo: poNo || 'N/A',
                saudaNo: entry.contract_po_no || poNo || 'N/A',
                poDate: sDate,
                supplierName: safeStr(entry.supplier, 'UNKNOWN SUPPLIER'),
                brokerName: safeStr(entry.broker, 'UNKNOWN BROKER'),
                area: safeStr(entry.area, 'NORTHERN'),
                grade: safeStr(entry.grade, 'TD6'),
                poRateMt: entryRate * 10,
                poRateQtl: entryRate,
                sattaBaseRateQtl: refRate,
                differentialQtl: entryRate - refRate,
                sattaFinalRateMt: refRate * 10,
                sattaFinalRateQtl: refRate,
                status: isResolved ? 'resolved' : 'dispute',
                issueDescription: `Same-Date PTF B. Rate Mismatch on S Date ${sDate}: Reference rate for date ${sDate} is ₹${refRate.toLocaleString()}/Qtl, but PTF entry specifies ₹${entryRate.toLocaleString()}/Qtl.`,
                differenceMt: (entryRate - refRate) * 10,
                differenceQtl: entryRate - refRate,
                weightMt: Number(entry.total_contract_mt || entry.total_wt_in_ton || 0),
                resolutionNotes: (dbSattaMm && dbSattaMm.remarks) || entry.satta_remarks,
                resolvedAt: (dbSattaMm && dbSattaMm.approved_at) ? String(dbSattaMm.approved_at).split('T')[0] : (entry.approved_at ? String(entry.approved_at).split('T')[0] : (isResolved ? new Date().toISOString().split('T')[0] : undefined)),
                resolvedBy: (dbSattaMm && dbSattaMm.approved_by) || entry.approved_by || (isResolved ? 'Administrator' : undefined),
                approvalLevel: (dbSattaMm && dbSattaMm.approval_level) || entry.approval_level || 'L3/L5',
                sourceType: 'sauda_check_point',
                sourceLabel: 'Sauda Check Point PTF Module (Same-Date Rate Mismatch)'
              });
            }
          }
        }
      });

      // 3. Include any standalone records from satta_mismatch table in DB
      dbSattaMismatches.forEach((sm: any) => {
        const poNo = String(sm.po_no || '').trim().toUpperCase();
        const saudaNo = String(sm.sauda_no || '').trim().toUpperCase();
        const smId = sm.mismatch_id || sm.id || `SAT-DB-${poNo}`;
        if (!sattaItems.some(item => item.id === smId || (poNo && item.poNo === poNo))) {
          const isResolved = sm.status === 'resolved' || sm.status === 'approved' || Boolean(sm.approved_by);
          sattaItems.push({
            id: smId,
            poNo: poNo || 'N/A',
            saudaNo: saudaNo || poNo || 'N/A',
            poDate: sm.created_at ? String(sm.created_at).split('T')[0] : new Date().toISOString().split('T')[0],
            supplierName: sm.supplier || 'N/A',
            brokerName: sm.broker || 'N/A',
            area: sm.area || 'DAISEE',
            grade: sm.grade || 'TD6',
            poRateMt: Number(sm.actual_rate || 0) * 10,
            poRateQtl: Number(sm.actual_rate || 0),
            sattaBaseRateQtl: Number(sm.expected_rate || 0),
            differentialQtl: 0,
            sattaFinalRateMt: Number(sm.expected_rate || 0) * 10,
            sattaFinalRateQtl: Number(sm.expected_rate || 0),
            status: isResolved ? 'resolved' : 'dispute',
            issueDescription: sm.remarks || 'Satta Rate Mismatch',
            differenceMt: (Number(sm.actual_rate || 0) - Number(sm.expected_rate || 0)) * 10,
            differenceQtl: Number(sm.actual_rate || 0) - Number(sm.expected_rate || 0),
            weightMt: 0,
            resolutionNotes: sm.remarks,
            resolvedAt: sm.approved_at ? String(sm.approved_at).split('T')[0] : (isResolved ? new Date().toISOString().split('T')[0] : undefined),
            resolvedBy: sm.approved_by || (isResolved ? 'Administrator' : undefined),
            approvalLevel: sm.approval_level || 'L3/L5',
            sourceType: 'sauda_master',
            sourceLabel: 'Satta Mismatch Database'
          });
        }
      });

      setSattaMismatchList(sattaItems);
    } catch (err) {
      console.error('Error loading mismatches from DB:', err);
    } finally {
      setLoading(false);
    }
  };

  useLiveAutoRefresh(loadMismatches, [], { tables: ['material_mismatch', 'satta_mismatch', 'sauda_check_point', 'purchase_master', 'sauda_master', 'satta_master'] });

  useEffect(() => {
    loadMismatches();
    const handleUpdate = () => {
      loadMismatches();
    };
    window.addEventListener('app-data-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('app-data-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handleResolve = async (itemId: string, itemPoNo: string) => {
    const rawRemarks = remarksMap[itemId] || '';
    const remarks = rawRemarks.trim() || 'Approved and cleared by Administrator';

    const ctx = getCurrentUserContext();
    const username = ctx.username || ctx.userName || 'Administrator';
    const approvalLevel = (ctx.userLevel || ctx.userRole || 'ADMIN').toUpperCase();
    const nowIso = new Date().toISOString();

    const targetItem = mismatchList.find(i => i.id === itemId || i.poNo === itemPoNo);

    // Save resolution in localStorage immediately for resilient offline/local caching
    const poTokens = [
      itemPoNo,
      itemPoNo.split('/').pop() || '',
      itemPoNo.replace(/^BJCL\//i, ''),
      itemPoNo.replace(/^BJC\//i, ''),
      itemId,
      itemId.replace(/^MIS-/i, '')
    ].filter(Boolean);

    poTokens.forEach(token => {
      try {
        const tu = token.toUpperCase();
        const payload = JSON.stringify({
          resolvedBy: username,
          resolvedAt: nowIso,
          approvalLevel,
          remarks: remarks.trim(),
          status: 'resolved'
        });
        localStorage.setItem(`material_resolved_${tu}`, payload);
        localStorage.setItem(`mismatch_resolved_${tu}`, payload);
        localStorage.setItem(`mismatch_cleared_${tu}`, 'true');
        localStorage.setItem(`pass_status_${tu}`, 'pass');
      } catch (e) {}
    });

    // 1. Base record (compatible with standard PostgreSQL table schema)
    const baseMaterialRecord: Record<string, any> = {
      po_no: itemPoNo,
      arrival_no: targetItem?.lorryNumber && targetItem.lorryNumber !== 'N/A' ? targetItem.lorryNumber : 'N/A',
      inspection_no: itemId,
      area: targetItem?.area || 'DAISEE',
      grade: targetItem?.grade || 'N/A',
      field: Array.isArray(targetItem?.mismatchedFields) ? targetItem.mismatchedFields.join(', ') : (targetItem?.mismatchedFields || 'Material Mismatch'),
      expected_value: targetItem?.issueDescription || 'PO Specifications',
      actual_value: targetItem?.issueDescription || 'Material Inspection Variance',
      status: 'resolved',
      remarks: `[APPROVED by ${username} (${approvalLevel}) on ${nowIso.split('T')[0]}]: ${remarks.trim()}`,
    };

    // 2. Extended record (if database has extra columns)
    const extendedMaterialRecord: Record<string, any> = {
      ...baseMaterialRecord,
      mismatch_id: itemId,
      approved_by: username,
      approved_at: nowIso,
      approval_level: approvalLevel,
      supplier: targetItem?.supplierName || null,
      broker: targetItem?.brokerName || null,
      agency: targetItem?.agency || null,
      ptf_mode: targetItem?.ptfMode || null,
      challan_supplier: targetItem?.challanSupplier || null,
      rate_per_mt: targetItem?.ratePerMt || null,
      lorry_number: targetItem?.lorryNumber || null,
      issue_description: targetItem?.issueDescription || null,
      mismatched_fields: Array.isArray(targetItem?.mismatchedFields) ? targetItem.mismatchedFields.join(', ') : (targetItem?.mismatchedFields || null),
      severity: targetItem?.severity || 'medium',
    };

    if (supabase) {
      try {
        // First check existing rows using select('*') which never fails
        const searchSuffix = itemPoNo.split('/').pop() || itemPoNo;
        const { data: existingRows } = await supabase
          .from('material_mismatch')
          .select('*')
          .or(`po_no.ilike.%${searchSuffix}%,mismatch_id.ilike.%${searchSuffix}%`);

        if (existingRows && existingRows.length > 0) {
          const rowId = existingRows[0].id;
          const { error: updErr } = await supabase.from('material_mismatch').update(extendedMaterialRecord).eq('id', rowId);
          if (updErr) {
            await supabase.from('material_mismatch').update(baseMaterialRecord).eq('id', rowId);
          }
        } else {
          const { error: insErr } = await supabase.from('material_mismatch').insert(extendedMaterialRecord);
          if (insErr) {
            await supabase.from('material_mismatch').insert(baseMaterialRecord);
          }
        }
      } catch (e) {
        console.warn("material_mismatch write warning:", e);
      }

      // Update parent tables
      for (const token of poTokens) {
        try {
          await supabase.from('sauda_check_point').update({
            mismatch_cleared: true,
            pass_status: 'pass',
            mismatch_remarks: remarks.trim(),
            approved_by: username,
            approved_at: nowIso,
            approval_level: approvalLevel,
          }).ilike('po_no', `%${token}%`);
        } catch (e) {}

        try {
          await supabase.from('purchase_master').update({
            mismatch_cleared: true,
            pass_status: 'pass',
            mismatch_remarks: remarks.trim(),
            approved_by: username,
            approved_at: nowIso,
            approval_level: approvalLevel,
          }).ilike('po_no', `%${token}%`);
        } catch (e) {}

        try {
          await supabase.from('sauda_master').update({
            mismatch_cleared: true,
            mismatch_remarks: remarks.trim(),
            approved_by: username,
            approved_at: nowIso,
            approval_level: approvalLevel,
          }).ilike('sauda_no', `%${token}%`);
        } catch (e) {}
      }
    }

    // Direct persistence in dbModule as well
    await dbModule.insert('material_mismatch', { ...extendedMaterialRecord, id: itemId }).catch(() => {});

    // Optimistically update local state immediately so user sees it resolved on screen
    setMismatchList(prev => prev.map(m => {
      if (m.id === itemId || m.poNo === itemPoNo) {
        return {
          ...m,
          status: 'resolved',
          resolutionNotes: remarks.trim(),
          resolvedBy: username,
          resolvedAt: nowIso.split('T')[0],
          approvalLevel: approvalLevel,
        };
      }
      return m;
    }));

    // Dispatch global live update events
    window.dispatchEvent(new CustomEvent('mismatch_resolved', { detail: { poNo: itemPoNo } }));
    window.dispatchEvent(new CustomEvent('app-data-updated'));

    // Refetch fresh data from database
    await loadMismatches();

    setSuccessToast(`Purchase Order [${itemPoNo}] Material Mismatch approved and cleared by ${approvalLevel} level user.`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleResolveSatta = async (itemId: string, itemPoNo: string) => {
    setSavingSattaId(itemId);
    try {
      const rawRemarks = remarksMap[itemId] || '';
      const remarks = rawRemarks.trim() || 'Approved and cleared by Administrator';

      const ctx = getCurrentUserContext();
      const username = ctx.username || ctx.userName || 'Administrator';
      const approvalLevel = (ctx.userLevel || ctx.userRole || 'ADMIN').toUpperCase();
      const nowIso = new Date().toISOString();

      const targetItem = sattaMismatchList.find(i => i.id === itemId || i.poNo === itemPoNo || i.saudaNo === itemPoNo);

      // Save resolution in localStorage immediately for resilient caching
      const saudaTokens = [
        itemPoNo, 
        targetItem?.saudaNo, 
        itemPoNo.split('/').pop() || '', 
        (targetItem?.saudaNo || '').split('/').pop() || '',
        itemPoNo.replace(/^BJCL\//i, ''),
        (targetItem?.saudaNo || '').replace(/^BJCL\//i, ''),
        itemId
      ].filter(Boolean);

      saudaTokens.forEach(token => {
        try {
          const payload = JSON.stringify({
            resolvedBy: username,
            resolvedAt: nowIso,
            approvalLevel,
            remarks: remarks.trim(),
            status: 'resolved'
          });
          localStorage.setItem(`satta_resolved_${String(token).toUpperCase()}`, payload);
          localStorage.setItem(`mismatch_resolved_${String(token).toUpperCase()}`, payload);
          localStorage.setItem(`mismatch_cleared_${String(token).toUpperCase()}`, 'true');
        } catch (e) {}
      });

      // Generate a stable UUID for new records
      const recordUuid = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'sat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

      // 1. Base record (compatible with standard PostgreSQL table schema)
      const baseSattaRecord: Record<string, any> = {
        id: recordUuid,
        sauda_no: String(targetItem?.saudaNo || itemPoNo || '').trim(),
        po_no: String(itemPoNo || '').trim(),
        area: String(targetItem?.area || 'DAISEE'),
        grade: String(targetItem?.grade || 'TD6'),
        field: 'Price Dispute',
        expected_value: String(targetItem?.sattaFinalRateQtl || ''),
        actual_value: String(targetItem?.poRateQtl || ''),
        expected_rate: Number(targetItem?.sattaFinalRateQtl || 0),
        actual_rate: Number(targetItem?.poRateQtl || 0),
        status: 'resolved',
        remarks: `[APPROVED by ${username} (${approvalLevel}) on ${nowIso.split('T')[0]}]: ${remarks.trim()}`,
      };

      // 2. Extended record (if database has extra columns)
      const extendedSattaRecord: Record<string, any> = {
        ...baseSattaRecord,
        mismatch_id: itemId,
        approved_by: username,
        approved_at: nowIso,
        approval_level: approvalLevel,
      };

      if (supabase) {
        try {
          // Query existing rows using select('*')
          const searchToken = (targetItem?.saudaNo || itemPoNo).split('/').pop() || itemPoNo;
          const { data: existingRows } = await supabase
            .from('satta_mismatch')
            .select('*')
            .or(`mismatch_id.eq.${itemId},po_no.ilike.%${searchToken}%,sauda_no.ilike.%${searchToken}%`);

          if (existingRows && existingRows.length > 0) {
            const rowId = existingRows[0].id;
            const updatePayload = { ...extendedSattaRecord };
            delete updatePayload.id;
            const { error: updErr } = await supabase.from('satta_mismatch').update(updatePayload).eq('id', rowId);
            if (updErr) {
              const basePayload = { ...baseSattaRecord };
              delete basePayload.id;
              await supabase.from('satta_mismatch').update(basePayload).eq('id', rowId);
            }
          } else {
            const { error: insErr } = await supabase.from('satta_mismatch').insert(extendedSattaRecord);
            if (insErr) {
              await supabase.from('satta_mismatch').insert(baseSattaRecord);
            }
          }
        } catch (e) {
          console.warn("satta_mismatch write warning:", e);
        }

        // Update sauda_master, sms_sauda, sauda_check_point, and purchase_master with approval flags
        for (const token of saudaTokens) {
          try {
            await supabase.from('sauda_master').update({
              satta_dispute_approved: true,
              mismatch_cleared: true,
              satta_remarks: remarks.trim(),
              approved_by: username,
              approved_at: nowIso,
              approval_level: approvalLevel,
            }).ilike('sauda_no', `%${token}%`);
          } catch (e) {}

          try {
            await supabase.from('sms_sauda').update({
              satta_dispute_approved: true,
              mismatch_cleared: true,
              satta_remarks: remarks.trim(),
              approved_by: username,
              approved_at: nowIso,
              approval_level: approvalLevel,
            }).ilike('sauda_no', `%${token}%`);
          } catch (e) {}

          try {
            await supabase.from('sauda_check_point').update({
              satta_dispute_approved: true,
              mismatch_cleared: true,
              satta_remarks: remarks.trim(),
              approved_by: username,
              approved_at: nowIso,
              approval_level: approvalLevel,
            }).or(`po_no.ilike.%${token}%,contract_po_no.ilike.%${token}%`);
          } catch (e) {}

          try {
            await supabase.from('purchase_master').update({
              satta_dispute_approved: true,
              mismatch_cleared: true,
              satta_remarks: remarks.trim(),
              approved_by: username,
              approved_at: nowIso,
              approval_level: approvalLevel,
            }).or(`po_no.ilike.%${token}%,contract_po_no.ilike.%${token}%`);
          } catch (e) {}
        }
      }

      // Direct persistence in dbModule as well
      await dbModule.insert('satta_mismatch', { ...extendedSattaRecord, id: itemId }).catch(() => {});

      // Optimistically update local state immediately so user sees it resolved on screen
      setSattaMismatchList(prev => prev.map(s => {
        if (s.id === itemId || s.poNo === itemPoNo || (s.saudaNo && s.saudaNo === itemPoNo)) {
          return {
            ...s,
            status: 'resolved',
            resolutionNotes: remarks.trim(),
            resolvedBy: username,
            resolvedAt: nowIso.split('T')[0],
            approvalLevel: approvalLevel,
          };
        }
        return s;
      }));

      // Clear input remarks for this item
      setRemarksMap(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });

      window.dispatchEvent(new CustomEvent('satta_resolved', { detail: { poNo: itemPoNo, itemId } }));
      window.dispatchEvent(new CustomEvent('app-data-updated'));
      await loadMismatches();

      setSuccessToast(`Satta Price Dispute for [${itemPoNo}] approved, saved, and cleared by ${approvalLevel} level user.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      console.error('Failed to resolve Satta dispute:', err);
    } finally {
      setSavingSattaId(null);
    }
  };

  const supplierOptions = Array.from(
    new Set(mismatchList.map(i => i.supplierName).filter(s => s && s !== 'N/A'))
  ).sort();

  const brokerOptions = Array.from(
    new Set(mismatchList.map(i => i.brokerName).filter(b => b && b !== 'N/A'))
  ).sort();

  const filteredMismatchList = mismatchList.filter(item => {
    const matchesSearch = 
      item.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.poNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brokerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.grade.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.issueDescription.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = 
      filterStatus === 'all' ? true : item.status === filterStatus;

    const matchesSupplier = 
      selectedSupplier === 'ALL' ? true : item.supplierName.toLowerCase() === selectedSupplier.toLowerCase();

    const matchesBroker = 
      selectedBroker === 'ALL' ? true : item.brokerName.toLowerCase() === selectedBroker.toLowerCase();

    return matchesSearch && matchesStatus && matchesSupplier && matchesBroker;
  });

  const filteredSattaList = sattaMismatchList.filter(item => {
    const matchesSearch = 
      item.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.poNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.saudaNo && item.saudaNo.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.brokerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.grade.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = 
      sattaFilterStatus === 'all' ? true : item.status === sattaFilterStatus;

    const matchesSource = 
      sattaSourceFilter === 'ALL' 
        ? true 
        : sattaSourceFilter === 'sauda_master' 
          ? (item.sourceType === 'sauda_master' || item.sourceType === 'sms_sauda')
          : item.sourceType === sattaSourceFilter;

    const matchesSupplier = 
      selectedSupplier === 'ALL' ? true : item.supplierName.toLowerCase() === selectedSupplier.toLowerCase();

    const matchesBroker = 
      selectedBroker === 'ALL' ? true : item.brokerName.toLowerCase() === selectedBroker.toLowerCase();

    return matchesSearch && matchesStatus && matchesSource && matchesSupplier && matchesBroker;
  });

  const downloadCSV = () => {
    let csvContent = "";
    if (activeTab === 'ruka_to_satta') {
      csvContent = "data:text/csv;charset=utf-8," 
        + ["Mismatch ID,P.O. / Sauda No,Date,Supplier,Area,Grade,Sauda Rate (₹/Qtl),Satta Limit Rate (₹/Qtl),Variance (₹/Qtl),Status,Approved By,Remarks"]
          .concat(sattaMismatchList.map(item => 
            `"${item.id}","${item.poNo}","${item.poDate}","${item.supplierName}","${item.area}","${item.grade}","${item.poRateQtl}","${item.sattaFinalRateQtl}","${item.differenceQtl}","${item.status}","${item.resolvedBy || 'N/A'}","${item.resolutionNotes || 'N/A'}"`
          )).join("\n");
    } else {
      csvContent = "data:text/csv;charset=utf-8," 
        + ["P.O. Number,Supplier,Broker,Area,Grade,Mismatched Fields,Status,Approved By,Remarks"]
          .concat(mismatchList.map(item => 
            `"${item.poNo}","${item.supplierName}","${item.brokerName}","${item.area}","${item.grade}","${item.mismatchedFields.join('; ')}","${item.status}","${item.resolvedBy || 'N/A'}","${item.resolutionNotes || 'N/A'}"`
          )).join("\n");
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BJCL-Mismatch-${activeTab === 'ruka_to_satta' ? 'Satta' : 'Material'}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pendingCount = mismatchList.filter(i => i.status === 'pending').length;
  const resolvedCount = mismatchList.filter(i => i.status === 'resolved').length;

  return (
    <LegacyLayout title={variant === 'material' ? "Material Mismatch Board" : "Satta Mismatch"} subtitle="">
      <div className="space-y-5 max-w-full px-1 sm:px-2">
        {/* Header Stats & Quick Action Bar */}
        <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Scale className="h-5 w-5 text-indigo-700" />
              <span>{variant === 'material' ? "Material Mismatch Board (Base Mode)" : "Satta Price Mismatch"}</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {variant === 'material' 
                ? "Comparison across Sauda Check Point, Temporary P.O., and Material Inspections. Always fetched fresh from database."
                : "Validating contract rates registered in sauda_master (Sauda Desk) against active Satta Chart limits."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={loadMismatches}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-bold text-slate-800 transition flex items-center gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-slate-600", loading && "animate-spin")} />
              <span>Fetch Fresh Data</span>
            </button>
            <button
              onClick={downloadCSV}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded text-xs font-bold transition flex items-center gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Notifications */}
        {successToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-lg flex items-center gap-2 text-xs font-bold text-emerald-800 shadow-xs">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Main Content Area */}
        {variant === 'material' ? (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="bg-white border border-slate-300 p-3 rounded-lg shadow-xs space-y-3">
              {/* Top Row: Quick Status Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setFilterStatus('pending')}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider border transition flex items-center gap-1.5",
                      filterStatus === 'pending'
                        ? "bg-rose-700 text-white border-rose-800 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                    )}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Pending ({pendingCount})</span>
                  </button>
                  <button
                    onClick={() => setFilterStatus('resolved')}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider border transition flex items-center gap-1.5",
                      filterStatus === 'resolved'
                        ? "bg-emerald-700 text-white border-emerald-800 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                    )}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Resolved ({resolvedCount})</span>
                  </button>
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-extrabold uppercase tracking-wider border transition",
                      filterStatus === 'all'
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                    )}
                  >
                    All ({mismatchList.length})
                  </button>
                </div>

                {/* Reset Filters */}
                {(selectedSupplier !== 'ALL' || selectedBroker !== 'ALL' || searchQuery || filterStatus !== 'pending') && (
                  <button
                    onClick={() => {
                      setSelectedSupplier('ALL');
                      setSelectedBroker('ALL');
                      setFilterStatus('pending');
                      setSearchQuery('');
                    }}
                    className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline flex items-center gap-1"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Bottom Row: Dropdown Selectors & Search Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                {/* Status Dropdown */}
                <div>
                  <label htmlFor="filter_by_status_685" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">
                    Filter by Status
                  </label>
                  <select
 id="filter_by_status_685" name="filter_by_status" aria-label="Filter by Status"                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="w-full text-xs py-1.5 px-2 border border-slate-300 rounded bg-white text-slate-800 font-bold focus:outline-none focus:border-indigo-600"
                  >
                    <option value="pending">Pending Approval</option>
                    <option value="resolved">Resolved / Approved</option>
                    <option value="all">All Statuses</option>
                  </select>
                </div>

                {/* Supplier Dropdown */}
                <div>
                  <label htmlFor="filter_by_supplier_701" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">
                    Filter by Supplier
                  </label>
                  <select
 id="filter_by_supplier_701" name="filter_by_supplier" aria-label="Filter by Supplier"                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    className="w-full text-xs py-1.5 px-2 border border-slate-300 rounded bg-white text-slate-800 font-medium focus:outline-none focus:border-indigo-600"
                  >
                    <option value="ALL">All Suppliers ({supplierOptions.length})</option>
                    {supplierOptions.map((s, idx) => (
                      <option key={idx} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* Broker Dropdown */}
                <div>
                  <label htmlFor="filter_by_broker_718" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">
                    Filter by Broker
                  </label>
                  <select
 id="filter_by_broker_718" name="filter_by_broker" aria-label="Filter by Broker"                    value={selectedBroker}
                    onChange={(e) => setSelectedBroker(e.target.value)}
                    className="w-full text-xs py-1.5 px-2 border border-slate-300 rounded bg-white text-slate-800 font-medium focus:outline-none focus:border-indigo-600"
                  >
                    <option value="ALL">All Brokers ({brokerOptions.length})</option>
                    {brokerOptions.map((b, idx) => (
                      <option key={idx} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                {/* Search Input Bar */}
                <div>
                  <label htmlFor="search_keyword_737" className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">
                    Search Keyword
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400 font-bold" />
                    <input
 id="search_keyword_737" name="search_keyword" aria-label="Search Keyword"                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="PO, Area, Grade, Discrepancy..."
                      className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:border-indigo-600 text-slate-800 font-medium"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Main Material Mismatch Base Table */}
            <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-7 w-7 border-2 border-indigo-700 border-t-transparent mx-auto" />
                  <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mt-3">Fetching fresh data from database...</p>
                </div>
              ) : filteredMismatchList.length === 0 ? (
                <div className="p-12 text-center bg-slate-50">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase">No Material Mismatches Found</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    All Purchase Orders match their corresponding Material Inspections and arrival receipts.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10.5px] tracking-wider">
                        <th className="p-3 border-r border-slate-200">P.O. Number & Date</th>
                        <th className="p-3 border-r border-slate-200">Supplier & Broker</th>
                        <th className="p-3 border-r border-slate-200">Area & Grade</th>
                        <th className="p-3 border-r border-slate-200 bg-indigo-50/50 text-indigo-950 font-black">
                          Remaining Lorries (Contract | Recv | Rem)
                        </th>
                        <th className="p-3 border-r border-slate-200 text-rose-800">Mismatched Fields</th>
                        <th className="p-3 border-r border-slate-200">Status</th>
                        <th className="p-3">Action & Approval Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredMismatchList.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(item => (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition align-top">
                          {/* PO Number & Date */}
                          <td className="p-3 border-r border-slate-200 font-mono">
                            <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                              <span>{item.poNo}</span>
                              {item.isClosed && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 shadow-2xs flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5 text-amber-400" />
                                  CLOSED
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                              Detected: {item.detectedAt}
                            </div>
                            {item.saudaNo && item.saudaNo !== 'N/A' && (
                              <div className="text-[9.5px] text-indigo-700 font-bold mt-0.5">
                                Sauda: {item.saudaNo}
                              </div>
                            )}
                          </td>

                          {/* Supplier & Broker */}
                          <td className="p-3 border-r border-slate-200">
                            <div className="font-bold text-slate-900 uppercase">{item.supplierName}</div>
                            <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                              Broker: <span className="font-semibold text-slate-800">{item.brokerName}</span>
                            </div>
                            {item.challanSupplier && item.challanSupplier !== 'N/A' && (
                              <div className="text-[10px] text-slate-500">Challan Supp: {item.challanSupplier}</div>
                            )}
                          </td>

                          {/* Area & Grade */}
                          <td className="p-3 border-r border-slate-200">
                            <div className="font-bold text-slate-800">{item.area}</div>
                            <div className="text-[11px] text-slate-600 font-medium">Grade: <span className="font-bold">{item.grade}</span></div>
                            {item.agency && item.agency !== 'N/A' && (
                              <div className="text-[10px] text-slate-500">Agency: {item.agency}</div>
                            )}
                          </td>

                          {/* Remaining Lorries Column */}
                          <td className="p-3 border-r border-slate-200 bg-indigo-50/30 min-w-[180px]">
                            <div className="bg-white border border-indigo-200 rounded p-2 text-center shadow-2xs space-y-1">
                              <div className="text-[11px] font-black text-indigo-950">
                                {item.lorryProgress?.totalLorries || 1} Contract | {item.lorryProgress?.receivedLorries || 1} Recv
                              </div>
                              <div className={cn(
                                "text-[10px] font-extrabold px-2 py-0.5 rounded border inline-block",
                                (item.lorryProgress?.remainingLorries ?? 0) > 0 
                                  ? "bg-amber-100 text-amber-900 border-amber-300" 
                                  : "bg-emerald-100 text-emerald-900 border-emerald-300"
                              )}>
                                {(item.lorryProgress?.remainingLorries ?? 0) > 0 
                                  ? `⏳ Waiting For Remaining Lorries (${item.lorryProgress.remainingLorries} Left)` 
                                  : "✅ All Lorries Received"}
                              </div>
                            </div>
                          </td>

                          {/* Mismatched Fields Column */}
                          <td className="p-3 border-r border-slate-200 max-w-xs">
                            <div className="flex flex-wrap gap-1 mb-2">
                              {item.mismatchedFields.map((fieldLabel, idx) => (
                                <span
                                  key={idx}
                                  className="bg-rose-100 text-rose-900 border border-rose-300 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tight"
                                >
                                  ⚠️ {fieldLabel}
                                </span>
                              ))}
                            </div>

                            {/* Field Discrepancy Breakdown */}
                            {item.mismatchDetailsList && item.mismatchDetailsList.length > 0 && (
                              <div className="bg-slate-50 border border-slate-200 rounded p-1.5 space-y-1 text-[10px]">
                                {item.mismatchDetailsList.map((d, dIdx) => (
                                  <div key={dIdx} className="flex items-center justify-between text-slate-700">
                                    <span className="font-bold text-slate-800">{d.field}:</span>
                                    <span className="text-slate-500 line-through mr-1">{d.poValue}</span>
                                    <span className="font-extrabold text-rose-700">➔ {d.inspValue}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="p-3 border-r border-slate-200">
                            {item.status === 'resolved' ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                                Cleared / Approved
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1 items-start">
                                <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-900 border border-rose-300 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                  <AlertTriangle className="h-3.5 w-3.5 text-rose-700" />
                                  {item.isClosed ? 'Closed – Mismatch' : 'Pending Approval'}
                                </span>
                                {item.isClosed && (
                                  <span className="text-[8.5px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                    P.O Closed
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Action & Remarks */}
                          <td className="p-3 min-w-[220px]">
                            {item.status === 'pending' ? (
                              canApproveMismatch() ? (
                                <div className="space-y-2">
                                  <textarea
 id="enter_approval_remarks_882" name="enter_approval_remarks" aria-label="Enter approval remarks..."                                    rows={2}
                                    placeholder="Enter approval remarks..."
                                    value={remarksMap[item.id] || ''}
                                    onChange={(e) => setRemarksMap({ ...remarksMap, [item.id]: e.target.value })}
                                    className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 bg-white"
                                  />
                                  <button
                                    onClick={() => handleResolve(item.id, item.poNo)}
                                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black uppercase px-3 py-1.5 rounded text-[10.5px] tracking-wider transition flex items-center justify-center gap-1.5 shadow-xs"
                                  >
                                    <Check className="h-4 w-4" />
                                    <span>Approve Mismatch</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="bg-slate-100 border border-slate-200 text-slate-600 p-2 rounded text-[10px] font-bold text-center">
                                  🔒 L3 / L5 Level User Approval Required
                                </div>
                              )
                            ) : (
                              <div className="bg-emerald-50 border border-emerald-200 p-2 rounded text-[10px] text-slate-800 space-y-1">
                                <div className="font-extrabold text-emerald-950 flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                                  <span>Approval Record</span>
                                </div>
                                <div><span className="font-bold">Approved By:</span> {item.resolvedBy || 'L3/L5 User'}</div>
                                <div><span className="font-bold">Approval Level:</span> <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-950 font-black rounded text-[9.5px]">{item.approvalLevel || 'L3/L5'}</span></div>
                                <div><span className="font-bold">Date:</span> {item.resolvedAt || 'N/A'}</div>
                                <div><span className="font-bold">Remarks:</span> "{item.resolutionNotes || 'Approved'}"</div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-2">
                <PaginationControls
                  currentPage={currentPage}
                  totalItems={filteredMismatchList.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Satta Mismatch View */
          <div className="space-y-4">
            <div className="bg-white border border-slate-300 p-3 rounded-lg shadow-xs space-y-3">
              {/* Top Row: Status Badges & Data Source Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setSattaFilterStatus('dispute')}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-extrabold uppercase border transition flex items-center gap-1.5",
                      sattaFilterStatus === 'dispute' ? "bg-amber-700 text-white border-amber-800 shadow-xs" : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                    )}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Price Disputes ({sattaMismatchList.filter(s => s.status === 'dispute').length})</span>
                  </button>
                  <button
                    onClick={() => setSattaFilterStatus('resolved')}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-extrabold uppercase border transition flex items-center gap-1.5",
                      sattaFilterStatus === 'resolved' ? "bg-emerald-700 text-white border-emerald-800 shadow-xs" : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                    )}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Approved ({sattaMismatchList.filter(s => s.status === 'resolved').length})</span>
                  </button>
                  <button
                    onClick={() => setSattaFilterStatus('ok')}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-extrabold uppercase border transition flex items-center gap-1.5",
                      sattaFilterStatus === 'ok' ? "bg-blue-700 text-white border-blue-800 shadow-xs" : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                    )}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Aligned Rate ({sattaMismatchList.filter(s => s.status === 'ok').length})</span>
                  </button>
                  <button
                    onClick={() => setSattaFilterStatus('all')}
                    className={cn(
                      "px-3 py-1.5 rounded text-xs font-extrabold uppercase border transition",
                      sattaFilterStatus === 'all' ? "bg-slate-900 text-white border-slate-900 shadow-xs" : "bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100"
                    )}
                  >
                    All Status ({sattaMismatchList.length})
                  </button>
                </div>

                {/* Quick info chip */}
                <div className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                  Validation: <span className="text-slate-900 font-bold">sauda_master Rate (₹/Qtl)</span> vs <span className="text-indigo-900 font-bold">Satta Limit Rate (Base + Area/Grade Diff)</span>
                </div>
              </div>

              {/* Second Row: Source Selector & Search Box */}
              <div className="pt-2 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Search Box */}
                <div className="relative w-full md:w-80 ml-auto">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Sauda No, Supplier, Broker..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:border-indigo-600 text-slate-800 font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-300 rounded-lg shadow-xs overflow-hidden">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-7 w-7 border-2 border-indigo-700 border-t-transparent mx-auto" />
                  <p className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mt-3">Evaluating Sauda rates against Satta Chart parameters...</p>
                </div>
              ) : filteredSattaList.length === 0 ? (
                <div className="p-12 text-center bg-slate-50">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
                  <h3 className="text-sm font-extrabold text-slate-800 uppercase">No Satta Price Mismatches</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    No records match the selected status filter or search criteria.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10.5px]">
                        <th className="p-3 border-r border-slate-200">Sauda No. & Date</th>
                        <th className="p-3 border-r border-slate-200">Supplier & Broker</th>
                        <th className="p-3 border-r border-slate-200">Area & Grade</th>
                        <th className="p-3 border-r border-slate-200 bg-slate-50">Sauda Rate (₹/Qtl)</th>
                        <th className="p-3 border-r border-slate-200 bg-indigo-50/60 text-indigo-950 font-black">Satta Limit Rate (₹/Qtl)</th>
                        <th className="p-3 border-r border-slate-200">Variance / Excess (₹/Qtl)</th>
                        <th className="p-3 border-r border-slate-200">Status</th>
                        <th className="p-3">Action & Approval Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredSattaList.slice((sattaCurrentPage - 1) * sattaPageSize, sattaCurrentPage * sattaPageSize).map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition align-top">
                          <td className="p-3 border-r border-slate-200 font-mono">
                            <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                              <span>{item.poNo}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-semibold mt-1">Date: {item.poDate}</div>
                            {item.saudaNo && item.saudaNo !== 'N/A' && item.saudaNo !== item.poNo && (
                              <div className="text-[9.5px] text-indigo-700 font-bold mt-0.5">Ref: {item.saudaNo}</div>
                            )}
                          </td>
                          <td className="p-3 border-r border-slate-200">
                            <div className="font-bold text-slate-800 uppercase">{item.supplierName}</div>
                            <div className="text-[10.5px] text-slate-500 font-medium">Broker: <span className="font-semibold text-slate-700">{item.brokerName}</span></div>
                          </td>
                          <td className="p-3 border-r border-slate-200">
                            <div className="font-bold text-slate-800">{item.area}</div>
                            <div className="text-[11px] text-slate-600 font-medium">Grade: <span className="font-bold">{item.grade}</span></div>
                          </td>
                          <td className="p-3 border-r border-slate-200 bg-slate-50/50">
                            <div className="font-black text-slate-900 text-sm">
                              ₹ {item.poRateQtl.toLocaleString()} <span className="text-[10px] font-bold text-slate-500">/ Qtl</span>
                            </div>
                          </td>
                          <td className="p-3 border-r border-slate-200 bg-indigo-50/30">
                            <div className="font-black text-indigo-950 text-sm">
                              ₹ {item.sattaFinalRateQtl.toLocaleString()} <span className="text-[10px] font-bold text-indigo-700">/ Qtl</span>
                            </div>
                            <div className="text-[10px] font-semibold text-indigo-800 mt-0.5">
                              (Base ₹{item.sattaBaseRateQtl.toLocaleString()} {item.differentialQtl >= 0 ? `+ Diff ₹${item.differentialQtl.toLocaleString()}` : `- Diff ₹${Math.abs(item.differentialQtl).toLocaleString()}`})
                            </div>
                          </td>
                          <td className="p-3 border-r border-slate-200 font-black">
                            {item.differenceQtl > 0 ? (
                              <div className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded text-xs inline-block">
                                ⚠️ + ₹ {item.differenceQtl.toLocaleString()} / Qtl
                              </div>
                            ) : item.differenceQtl < 0 ? (
                              <div className="text-emerald-700 text-xs font-bold">
                                - ₹ {Math.abs(item.differenceQtl).toLocaleString()} / Qtl
                              </div>
                            ) : (
                              <span className="text-emerald-700 font-extrabold">Aligned</span>
                            )}
                          </td>
                          <td className="p-3 border-r border-slate-200 font-bold uppercase">
                            {item.status === 'dispute' ? (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                                Price Dispute
                              </span>
                            ) : item.status === 'resolved' ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                                Approved / Cleared
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-900 border border-blue-300 px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide">
                                <Check className="h-3.5 w-3.5 text-blue-700" />
                                OK
                              </span>
                            )}
                          </td>
                          <td className="p-3 min-w-[200px]">
                            {item.status === 'dispute' ? (
                              canApproveMismatch() ? (
                                <div className="space-y-2">
                                  <textarea
                                    rows={2}
                                    placeholder="Enter dispute clearance remarks..."
                                    value={remarksMap[item.id] || ''}
                                    onChange={(e) => setRemarksMap({ ...remarksMap, [item.id]: e.target.value })}
                                    className="w-full text-xs p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600 bg-white"
                                  />
                                  <button
                                    onClick={() => handleResolveSatta(item.id, item.poNo)}
                                    disabled={savingSattaId === item.id}
                                    className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-black uppercase px-3 py-1.5 rounded text-[10.5px] tracking-wider transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                                    title="Click to Save & Approve Price Dispute clearance"
                                  >
                                    {savingSattaId === item.id ? (
                                      <>
                                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                        <span>Saving...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Check className="h-4 w-4" />
                                        <span>Save & Approve Dispute</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <div className="bg-slate-100 border border-slate-200 text-slate-600 p-2 rounded text-[10px] font-bold text-center">
                                  🔒 L3 / L5 Level User Approval Required
                                </div>
                              )
                            ) : item.status === 'resolved' ? (
                              <div className="bg-emerald-50 border border-emerald-200 p-2 rounded text-[10px] text-slate-800 space-y-1">
                                <div className="font-extrabold text-emerald-950 flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                                  <span>Approval Record</span>
                                </div>
                                <div><span className="font-bold">Approved By:</span> {item.resolvedBy || 'L3/L5 User'}</div>
                                <div><span className="font-bold">Approval Level:</span> <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-950 font-black rounded text-[9.5px]">{item.approvalLevel || 'L3/L5'}</span></div>
                                <div><span className="font-bold">Date:</span> {item.resolvedAt || 'N/A'}</div>
                                <div><span className="font-bold">Remarks:</span> "{item.resolutionNotes || 'Approved'}"</div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500 font-medium italic">
                                Rate within acceptable limits. No action required.
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="mt-2">
                <PaginationControls
                  currentPage={sattaCurrentPage}
                  totalItems={filteredSattaList.length}
                  pageSize={sattaPageSize}
                  onPageChange={setSattaCurrentPage}
                  onPageSizeChange={setSattaPageSize}
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </LegacyLayout>
  );
}
