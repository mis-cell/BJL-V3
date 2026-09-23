import React, { useState, useEffect } from 'react';
import { 
  Check, 
  AlertTriangle, 
  Layers, 
  FileText, 
  Settings, 
  Terminal, 
  Archive, 
  Printer, 
  X, 
  RefreshCw, 
  Plus, 
  Trash2 
} from 'lucide-react';
import { cn } from '../lib/utils';
import LegacyLayout from './LegacyLayout';

const BATCH_CODES: Record<string, string> = {
  "1": "EXPORT YARN 6.5 LBS",
  "2": "SACKING WARP 12-14 LBS",
  "3": "HESSIAN WARP 8.5 LBS",
  "4": "SACKING WARP 10.5 LBS",
  "5": "SALE YARN 14.0 LBS",
  "6": "SACKING WEFT",
  "7": "BRIGHT SALE YARN 36 LBS",
  "8": "EXPORT YARN 8.0-12.0 LBS",
  "9": "EXPORT YARN 8.00 LBS",
  "10": "HESSIAN WARP 7.5 LBS",
  "11": "TEA BAG 8.00-8.50 LBS",
  "12": "BRIGHT 48.0 LBS",
  "13": "CANVAS",
  "14": "DOBBY COLOUR YARN",
  "15": "EXPORT YARN 9.00 LBS",
  "16": "F.G.Q HESSIAN 9.00 LBS",
  "17": "JACQUARD",
  "18": "RUSSIAN",
  "19": "SALE YARN 36 LBS",
  "20": "SINGLE WARP CANVAS 10.0 LBS",
  "21": "S.T.B",
  "22": "EXPORT YARN 10.0 LBS",
  "23": "EXPORT YARN 4.8 LBS",
  "24": "H.C.F SACKING",
  "25": "H.C.F HESSIAN",
  "26": "GTF_BATCH NOT AVAILABLE",
  "27": "EXPORT YARN 17 LBS",
  "28": "BROAD LOOM",
  "29": "I.L",
  "30": "DYE YARN",
  "31": "9.50 LBS BLEACHED YARN",
  "32": "N.C.B 6.00-6.50 LBS",
  "33": "J/NG/JB",
  "34": "HEAVY SACKING WARP",
  "35": "HEAVY SACKING WARP",
  "36": "SACKING WARP 9.5-13.0 LBS",
  "37": "BIS SAMPLE"
};

const GRADES = ["", "TD5", "TD5/6", "TD6", "TD6/7", "TD7", "TD8", "TD9", "TD10", "TD12"];
const UNITS = ["BALES", "DRUMS", "LOOSE"];
const CROPS = ["2025-26", "2024-25", "2023-24"];

export function EditableComboBox({
  value,
  onChange,
  options,
  placeholder
}: {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    (opt || "").toLowerCase().includes((filter || "").toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="flex border border-slate-300 rounded overflow-hidden bg-white shadow-xs">
        <input
 id="value_96" name="value" aria-label="value"          ref={inputRef}
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setFilter(e.target.value);
            setIsOpen(true);
          }}
          onClick={() => {
            setFilter("");
            setIsOpen(true);
          }}
          className="w-full px-2 py-1 font-medium text-slate-800 outline-none text-[13px]"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(prev => !prev);
          }}
          className="bg-slate-50 border-l border-slate-300 px-2 flex items-center justify-center hover:bg-slate-100 cursor-pointer shrink-0 animate-none "
        >
          <span className="text-[9px] text-slate-500">▼</span>
        </button>
      </div>

      {isOpen && (
        <ul className="absolute z-[9999] left-0 right-0 mt-1 max-h-[160px] overflow-y-auto bg-white border border-slate-300 shadow-lg rounded-md text-[12px] font-bold text-slate-700">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => (
              <li
                key={idx}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevents input blur before selection registers
                }}
                onClick={() => {
                  onChange(opt);
                  setFilter("");
                  setIsOpen(false);
                }}
                className="px-3 py-1.5 hover:bg-indigo-50 hover:text-indigo-900 cursor-pointer border-b border-slate-100 last:border-b-0 text-left"
              >
                {opt}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-slate-400 italic text-left">No matches. Use typed value.</li>
          )}
        </ul>
      )}
    </div>
  );
}

interface EntryContainerProps {
  children: React.ReactNode;
  embedded?: boolean;
  issueRoute: 'godown' | 'mill' | 'factory' | null;
  handleFormCancel: () => void;
  setCurrentPage?: (p: any) => void;
}

function EntryContainer({
  children,
  embedded,
  issueRoute,
  handleFormCancel,
  setCurrentPage
}: EntryContainerProps) {
  const getRouteTitle = () => {
    if (issueRoute === 'godown') return "ISSUE TO GODOWN";
    if (issueRoute === 'mill') return "SELL (GODOWN TO FACTORY)";
    if (issueRoute === 'factory') return "GODOWN TO FACTORY";
    return "RAW JUTE MATERIAL ISSUE";
  };

  if (embedded) {
    return (
      <div className="border border-slate-300 rounded overflow-hidden flex flex-col bg-[#eae7e1] flex-1">
        <div className="bg-[#000080] text-white font-mono px-3 py-1.5 flex justify-between items-center text-[10px] font-bold  uppercase tracking-wider">
          <span>📋 {getRouteTitle()}</span>
          <button 
            type="button" 
            onClick={handleFormCancel} 
            className="text-white hover:text-red-300 uppercase font-black text-[9px] cursor-pointer"
          >
            [ Back to List ]
          </button>
        </div>
        {children}
      </div>
    );
  }
  return (
    <LegacyLayout 
      title={getRouteTitle()} 
      subtitle={issueRoute ? undefined : 'Choose a Route'} 
      onBack={handleFormCancel}
      onClose={handleFormCancel}
      onMaximize={() => {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      }}
    >
      {children}
    </LegacyLayout>
  );
}

interface MaterialIssueEntryProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  items: any[];
  setItems: React.Dispatch<React.SetStateAction<any[]>>;
  issueRoute: 'godown' | 'mill' | 'factory' | null;
  setIssueRoute: (route: 'godown' | 'mill' | 'factory' | null) => void;
  finalArrivals: any[];
  godownRecords?: any[];
  isEditMode: boolean;
  validationErrors: Record<string, string>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleSave: () => Promise<void>;
  handleFormCancel: () => void;
  showToast: (msg: string) => void;
  successToast: string | null;
  setSuccessToast: (msg: string | null) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  setCurrentPage?: (p: any) => void;
  closePage?: (p: any, d?: any) => void;
  embedded?: boolean;
}

export default function MaterialIssueEntry({
  formData,
  setFormData,
  items,
  setItems,
  issueRoute,
  setIssueRoute,
  finalArrivals,
  godownRecords = [],
  isEditMode,
  validationErrors,
  setValidationErrors,
  handleSave,
  handleFormCancel,
  showToast,
  successToast,
  setSuccessToast,
  containerRef,
  setCurrentPage,
  closePage,
  embedded = false
}: MaterialIssueEntryProps) {

  const [selectedArrivalId, setSelectedArrivalId] = useState<string>('');
  const [arrivalMeta, setArrivalMeta] = useState<any>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [batchOptions, setBatchOptions] = useState<string[]>([]);

  // Fetch batches from batch_master on mount with robust fallback
  useEffect(() => {
    async function loadBatches() {
      try {
        const { supabase } = await import('../lib/supabase.ts');
        if (supabase) {
          const { data, error } = await supabase
            .from('batch_master')
            .select('batch_name')
            .order('batch_name');
          if (data && data.length > 0) {
            const names = Array.from(new Set(data.map((r: any) => r.batch_name).filter(Boolean))) as string[];
            setBatchOptions(names);
            return;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch from batch_master, using fallback:', err);
      }
      setBatchOptions(Object.values(BATCH_CODES));
    }
    loadBatches();
  }, []);

  // Pre-load linked arrival when editing or when requisition_no changes
  useEffect(() => {
    if (formData.requisition_no) {
      const matched = finalArrivals.find(a => a.final_arrival_no === formData.requisition_no);
      if (matched) {
        const idVal = matched.id || matched.final_arrival_id;
        if (selectedArrivalId !== idVal) {
          setSelectedArrivalId(idVal);
        }
        
        let parsedGrid: any[] = [];
        if (matched.grid_details) {
          if (typeof matched.grid_details === 'string') {
            try { parsedGrid = JSON.parse(matched.grid_details === "undefined" ? "null" : matched.grid_details); } catch(e){}
          } else if (Array.isArray(matched.grid_details)) {
            parsedGrid = matched.grid_details;
          }
        }

        const computedChlnQty = (parsedGrid || []).reduce((acc: number, row: any) => acc + Number(row.quantity_chln || row.quantity_rcpt || row.quantity || row.qty || 0), 0);
        const enhancedMatched = {
          ...matched,
          extracted_total_chln_qty: computedChlnQty > 0 ? computedChlnQty : matched.total_packets
        };
        
        if (!arrivalMeta || (arrivalMeta.final_arrival_id !== matched.final_arrival_id && arrivalMeta.id !== matched.id)) {
          setArrivalMeta(enhancedMatched);
        }
      } else {
        if (selectedArrivalId) setSelectedArrivalId('');
        if (arrivalMeta) setArrivalMeta(null);
      }
    } else {
      if (arrivalMeta || isEditMode) {
        setSelectedArrivalId('');
        setArrivalMeta(null);
      }
    }
  }, [isEditMode, formData.requisition_no, finalArrivals]);

  // Auto generate voucher number based on route if not editing
  const generateRouteIssueNo = (route: 'godown' | 'mill' | 'factory') => {
    const prefix = route === 'godown' ? 'GRN' : route === 'mill' ? 'SEL' : 'RJI';
    const year = new Date().getFullYear();
    const randomNo = Math.floor(10000 + Math.random() * 90000);
    return `${prefix}/${year}/${randomNo}`;
  };

  const chooseRoute = (route: 'godown' | 'mill' | 'factory') => {
    setIssueRoute(route);
    setFormData(prev => ({
      ...prev,
      issue_no: isEditMode && prev.issue_no ? prev.issue_no : generateRouteIssueNo(route),
      godown: route === 'mill' ? (godownRecords[0]?.gdn_name || '') : prev.godown,
      party_name: route === 'mill' ? "BALLY JUTE COMPANY LIMITED" : prev.party_name
    }));

    // Seed empty details rows
    if (items.length === 0) {
      setItems([
        { srl: 1, crop: '2025-26', grade_name: 'TD5', marka: 'NO MARK', qty: 0, weight_kgs: 0, area: '', agency: '', code: '', batch_name: '', unit: 'BALES', place: '', itg_no: '', rate: 0, location_dest: '' },
        { srl: 2, crop: '2025-26', grade_name: 'TD5', marka: 'NO MARK', qty: 0, weight_kgs: 0, area: '', agency: '', code: '', batch_name: '', unit: 'BALES', place: '', itg_no: '', rate: 0, location_dest: '' },
        { srl: 3, crop: '2025-26', grade_name: 'TD5', marka: 'NO MARK', qty: 0, weight_kgs: 0, area: '', agency: '', code: '', batch_name: '', unit: 'BALES', place: '', itg_no: '', rate: 0, location_dest: '' }
      ]);
    }
  };

  const changeRoute = () => {
    if (confirm("Are you sure you want to change route? Unsaved changes will be reset.")) {
      setIssueRoute(null);
      setItems([]);
      setSelectedArrivalId('');
      setArrivalMeta(null);
    }
  };

  const loadFA = () => {
    if (!selectedArrivalId) {
      alert("Select a Final Arrival first.");
      return;
    }
    const matched = finalArrivals.find(a => a.id === selectedArrivalId || a.final_arrival_id === selectedArrivalId);
    if (matched) {
      // Parse details
      let parsedGrid: any[] = [];
      if (matched.grid_details) {
        if (typeof matched.grid_details === 'string') {
          try { parsedGrid = JSON.parse(matched.grid_details === "undefined" ? "null" : matched.grid_details); } catch(e){}
        } else if (Array.isArray(matched.grid_details)) {
          parsedGrid = matched.grid_details;
        }
      }

      const mappedDetails = (parsedGrid || []).map((row: any, idx: number) => ({
        srl: idx + 1,
        crop: row.crop_year || row.crop || '2025-26',
        grade_name: row.receipt_grade_name || row.challan_grade_name || row.grade_name || 'TD5',
        marka: row.challan_marka_name || row.marka || 'NO MARK',
        qty: Number(row.quantity_chln || row.quantity_rcpt || row.quantity || row.qty || 0),
        weight_kgs: Number(row.netto_pnto !== undefined ? (row.netto_pnto * 1000) : (row.weight_kgs || 0)),
        area: row.area || matched.arrival_area_name || '',
        agency: row.agency_name || row.agency || '',
        code: row.receipt_grade_code || row.challan_marka_code || row.code || '',
        batch_name: row.batch_name || '',
        unit: row.unit || 'BALES',
        place: '',
        itg_no: '',
        rate: 0,
        location_dest: ''
      }));

      const computedChlnQty = (parsedGrid || []).reduce((acc: number, row: any) => acc + Number(row.quantity_chln || row.quantity_rcpt || row.quantity || row.qty || 0), 0);
      const enhancedMatched = {
        ...matched,
        extracted_total_chln_qty: computedChlnQty > 0 ? computedChlnQty : matched.total_packets
      };

      // Fallback row if empty
      if (mappedDetails.length === 0) {
        mappedDetails.push({
          srl: 1, crop: '2025-26', grade_name: 'TD5', marka: 'NO MARK', qty: 0, weight_kgs: 0, area: enhancedMatched.arrival_area_name || '', agency: '', code: '', batch_name: '', unit: 'BALES', place: '', itg_no: '', rate: 0, location_dest: ''
        });
      }

      setItems(mappedDetails);
      setArrivalMeta(enhancedMatched);
      setFormData(prev => ({
        ...prev,
        requisition_no: matched.final_arrival_no || '',
        party_name: matched.supplier || '',
        lorry_number: matched.lorry_number || matched.lorry_no || matched.vehicle_no || '',
        remarks: `STOCKED POST-RECEIVE #FA-${matched.final_arrival_no || ''}`
      }));
      showToast(`Loaded details from Final Arrival #${matched.final_arrival_no || ''}`);
    }
  };

  const addRow = () => {
    const nextSrl = items.length + 1;
    setItems(prev => [
      ...prev,
      {
        srl: nextSrl,
        crop: '2025-26',
        grade_name: 'TD5',
        marka: 'NO MARK',
        qty: 0,
        weight_kgs: 0,
        area: arrivalMeta?.arrival_area_name || '',
        agency: '',
        code: '',
        batch_name: '',
        unit: 'BALES',
        place: '',
        itg_no: '',
        rate: 0,
        location_dest: ''
      }
    ]);
  };

  const deleteRow = (index: number) => {
    setItems(prev => {
      const copy = prev.filter((_, i) => i !== index);
      return copy.map((item, idx) => ({ ...item, srl: idx + 1 }));
    });
  };

  const deleteLastRow = () => {
    if (items.length <= 1) return;
    setItems(prev => {
      const copy = prev.slice(0, -1);
      return copy.map((item, idx) => ({ ...item, srl: idx + 1 }));
    });
  };

  const updateRow = (index: number, field: string, val: any) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      if (field === 'code') {
        copy[index].batch_name = BATCH_CODES[val] || '';
      }
      return copy;
    });
  };

  // Split totals calculation
  const getSplitTotals = () => {
    const acc: Record<string, { q: number; w: number }> = {
      BALES: { q: 0, w: 0 },
      LOOSE: { q: 0, w: 0 },
      DRUMS: { q: 0, w: 0 }
    };
    items.forEach(it => {
      const u = (it.unit || 'BALES').toUpperCase();
      const q = parseFloat(it.qty) || 0;
      const w = parseFloat(it.weight_kgs) || 0;
      if (acc[u]) {
        acc[u].q += q;
        acc[u].w += w;
      }
    });

    const grandQ = acc.BALES.q + acc.LOOSE.q + acc.DRUMS.q;
    const grandW = acc.BALES.w + acc.LOOSE.w + acc.DRUMS.w;
    const grandAmount = items.reduce((sum, it) => sum + ((parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0)), 0);

    return {
      balesQ: acc.BALES.q,
      balesW: acc.BALES.w / 1000, // converted to MT
      looseQ: acc.LOOSE.q,
      looseW: acc.LOOSE.w / 1000,
      drumsQ: acc.DRUMS.q,
      drumsW: acc.DRUMS.w / 1000,
      grandQ,
      grandW: grandW / 1000,
      grandAmount
    };
  };

  const splitTotals = getSplitTotals();

  // Reconciliation parameters
  const getReconciliation = () => {
    if (!arrivalMeta) return { matchBales: true, matchWt: true, balBales: 0, balWt: 0, arrBales: 0, arrWt: 0 };
    const arrBales = Number(arrivalMeta.extracted_total_chln_qty || arrivalMeta.total_packets || arrivalMeta.packets || arrivalMeta.bales || 0);
    const arrWt = arrivalMeta.challan_material_weight !== undefined && arrivalMeta.challan_material_weight !== null
      ? Number(arrivalMeta.challan_material_weight)
      : (arrivalMeta.weight_qtl 
          ? (Number(arrivalMeta.weight_qtl) / 10) 
          : Number(arrivalMeta.total_actual_weight || arrivalMeta.total_weight_kgs || 0) / 1000); // in MT

    const balBales = arrBales - splitTotals.balesQ;
    const balWt = arrWt - splitTotals.grandW;

    const matchBales = balBales === 0;
    const matchWt = Math.abs(balWt) < 0.005;

    return {
      arrBales,
      arrWt,
      balBales,
      balWt,
      matchBales,
      matchWt
    };
  };

  const recon = getReconciliation();

  const resetAll = () => {
    if (confirm("Are you sure you want to clear this form?")) {
      setFormData((prev: any) => ({
        ...prev,
        remarks: '',
        issued_by: '',
        received_by: '',
        stack_no: '',
        jci: 'No',
        batch_order: '',
        requisition_no: '',
        lorry_number: '',
        party_name: ''
      }));
      setItems([
        { srl: 1, crop: '2025-26', grade_name: 'TD5', marka: 'NO MARK', qty: 0, weight_kgs: 0, area: '', agency: '', code: '', batch_name: '', unit: 'BALES', place: '', itg_no: '', rate: 0, location_dest: '' }
      ]);
    }
  };

  return (
    <EntryContainer
      embedded={embedded}
      issueRoute={issueRoute}
      handleFormCancel={handleFormCancel}
      setCurrentPage={setCurrentPage}
    >
      <div 
        ref={containerRef} 
        className="bg-[#eae7e1] font-sans text-[12px] text-slate-900 selection:bg-slate-300 flex flex-col flex-1 p-4 gap-4 overflow-y-auto"
      >
        {/* Success Toast banner */}
        {successToast && (
          <div className="bg-emerald-50 text-emerald-950 p-3 border border-emerald-400 rounded flex items-center justify-between shadow-sm ">
            <span className="flex items-center gap-1.5 font-bold uppercase text-[11px]">
              <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
              {successToast}
            </span>
            <button onClick={() => setSuccessToast(null)} className="text-emerald-700 hover:text-emerald-950 font-bold uppercase text-[9px] cursor-pointer">
              [ Dismiss ]
            </button>
          </div>
        )}

        {/* Validation Errors banner */}
        {Object.keys(validationErrors).length > 0 && (
          <div className="bg-rose-50 border-2 border-rose-400 p-3.5 rounded shadow-sm text-rose-950 ">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-[12px] uppercase mb-1">
              <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              <span>Voucher Validation Failed (Incomplete Record)</span>
            </div>
            <ul className="list-disc pl-8 text-[11px] font-semibold text-rose-900 space-y-0.5">
              {Object.entries(validationErrors).map(([field, msg]) => (
                <li key={field} className="uppercase tracking-tight">{msg}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 1. ROUTE SELECTOR PANEL */}
        {!issueRoute && (
          <div className="bg-white border border-[#dbe1ea] rounded-md p-6 shadow-xs">
            <div className="font-bold text-[#1c4587] text-[14px] mb-4 uppercase tracking-wider">Choose issue route</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button 
                type="button" 
                onClick={() => chooseRoute('godown')}
                className="flex gap-4 items-center text-left p-5 border-2 border-[#bcd0ea] rounded-lg bg-white cursor-pointer hover:translate-y-[-2px] hover:shadow-md hover:border-[#1c4587] transition-all"
              >
                <div className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-[21px] text-white bg-gradient-to-br from-[#1c4587] to-[#2c6bb3]">🏭</div>
                <div>
                  <div className="font-extrabold text-[#1c4587] text-[14px]">ISSUE TO GODOWN</div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-tight">Store a verified Final Arrival into a godown stack (GRN).</div>
                </div>
              </button>

              <button 
                type="button" 
                onClick={() => chooseRoute('mill')}
                className="flex gap-4 items-center text-left p-5 border-2 border-[#bfe3d3] rounded-lg bg-white cursor-pointer hover:translate-y-[-2px] hover:shadow-md hover:border-[#0b6e54] transition-all"
              >
                <div className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-[21px] text-white bg-gradient-to-br from-[#0b6e54] to-[#159c74]">💰</div>
                <div>
                  <div className="font-extrabold text-[#0b6e54] text-[14px]">SELL (Godown to Factory)</div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-tight">Direct sale or transfer of raw jute from Godown to Factory.</div>
                </div>
              </button>

              <button 
                type="button" 
                onClick={() => chooseRoute('factory')}
                className="flex gap-4 items-center text-left p-5 border-2 border-[#f0d79a] rounded-lg bg-white cursor-pointer hover:translate-y-[-2px] hover:shadow-md hover:border-[#e0972f] transition-all"
              >
                <div className="w-11 h-11 rounded-lg flex items-center justify-center font-bold text-[21px] text-white bg-gradient-to-br from-[#b9851a] to-[#e0972f]">📦</div>
                <div>
                  <div className="font-extrabold text-[#b9851a] text-[14px]">GODOWN &rarr; FACTORY</div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-tight">Issue raw jute already stored in a godown out to the factory.</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* 2. ROUTE BAR (If selected) */}
        {issueRoute && (
          <div className="flex items-center gap-3 bg-[#eef4fb] border border-[#cfe0f2] rounded p-3 ">
            <span className="font-bold text-slate-700">Issue route:</span>
            <span className={cn(
              "font-extrabold text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded text-white",
              issueRoute === 'godown' ? "bg-[#1c4587]" : issueRoute === 'mill' ? "bg-[#0b6e54]" : "bg-[#e0972f]"
            )}>
              {issueRoute === 'godown' ? 'ISSUE TO GODOWN' : issueRoute === 'mill' ? 'SELL (GODOWN TO FACTORY)' : 'GODOWN TO FACTORY'}
            </span>
            <span className="text-slate-500 font-medium">
              {issueRoute === 'godown' 
                ? 'Store verified arrivals to a stack record.' 
                : issueRoute === 'mill' 
                  ? 'Sell direct from godown to buyer factory.' 
                  : 'Despatching raw jute from godown rows to spinning units.'
              }
            </span>
            <button 
              type="button" 
              onClick={changeRoute}
              className="ml-auto bg-white border border-[#1c4587] text-[#1c4587] hover:bg-[#f1f5fc] rounded px-3 py-1 font-bold cursor-pointer transition-colors"
            >
              Change route
            </button>
          </div>
        )}

        {/* 3. LINKED FINAL ARRIVAL (godown only) */}
        {issueRoute && issueRoute === 'godown' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#103A20] bg-[#174C2C] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                <Archive className="h-4 w-4 text-white" />
              </div>

              <div>
                <span className="block text-sm font-bold text-white">
                  Linked Final Arrival
                </span>

                <span className="text-[9px] font-semibold uppercase tracking-wider text-green-100">
                  Arrival Reference Details
                </span>
              </div>
            </div>
          </div>
          
          <div className="space-y-5 p-4">

            {/* Select Arrival */}
            <div className="flex flex-wrap items-end gap-3">

              <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
                <label
                  htmlFor="select_final_arrival_fa_686"
                  className="text-[10px] font-bold uppercase tracking-wide text-slate-500"
                >
                  Select Final Arrival (FA #)
                </label>

                <select
                  id="select_final_arrival_fa_686"
                  name="select_final_arrival_fa"
                  aria-label="Select Final Arrival (FA #)"
                  value={selectedArrivalId}
                  onChange={(e) => setSelectedArrivalId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">— Select Final Arrival —</option>

                  {finalArrivals
                    .filter(
                      arr =>
                        !arr.is_issued ||
                        arr.final_arrival_no === formData.requisition_no
                    )
                    .map((arr) => (
                      <option
                        key={arr.id || arr.final_arrival_id}
                        value={arr.id || arr.final_arrival_id}
                      >
                        {arr.final_arrival_no} — {arr.supplier} (
                        {arr.total_packets || arr.packets || arr.bales || 0} bales){' '}
                        {arr.is_issued ? '(Already Issued)' : ''}
                      </option>
                    ))}
                </select>
              </div>


              <button
                type="button"
                onClick={loadFA}
                className="flex h-[38px] items-center gap-2 rounded-lg bg-blue-600 px-5 text-[11px] font-bold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow active:scale-[0.98] cursor-pointer"
              >
                <Archive className="h-3.5 w-3.5" />
                Load Arrival
              </button>

            </div>


            {/* Readonly FA Details */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">

              <div className="mb-3 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />

                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Arrival Information
                </span>
              </div>


              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">

                {/* Voucher Date */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="voucher_date_712"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-400"
                  >
                    Voucher Date
                  </label>

                  <input
                    id="voucher_date_712"
                    name="voucher_date"
                    aria-label="Voucher Date"
                    readOnly
                    value={
                      arrivalMeta
                        ? new Date(arrivalMeta.date).toLocaleDateString('en-GB')
                        : '--'
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                  />
                </div>


                {/* PO Number */}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label
                    htmlFor="p_o_mill_p_o_no_716"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-400"
                  >
                    P.O. / Mill P.O. No.
                  </label>

                  <input
                    id="p_o_mill_p_o_no_716"
                    name="p_o_mill_p_o_no"
                    aria-label="P.O. / Mill P.O. No."
                    readOnly
                    value={
                      arrivalMeta?.po_no ||
                      arrivalMeta?.purchase_order_no ||
                      '--'
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                  />
                </div>


                {/* JCI */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="j_c_i_govt_720"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-400"
                  >
                    J.C.I Govt
                  </label>

                  <input
                    id="j_c_i_govt_720"
                    name="j_c_i_govt"
                    aria-label="J.C.I Govt"
                    readOnly
                    value={arrivalMeta?.jci || 'No'}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                  />
                </div>


                {/* Supplier */}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label
                    htmlFor="supplier_name_724"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-400"
                  >
                    Supplier Name
                  </label>

                  <input
                    id="supplier_name_724"
                    name="supplier_name"
                    aria-label="Supplier Name"
                    readOnly
                    value={arrivalMeta?.supplier || '--'}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                  />
                </div>


                {/* Broker */}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label
                    htmlFor="broker_reference_728"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-400"
                  >
                    Broker Reference
                  </label>

                  <input
                    id="broker_reference_728"
                    name="broker_reference"
                    aria-label="Broker Reference"
                    readOnly
                    value={arrivalMeta?.broker || '--'}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                  />
                </div>


                {/* Lorry */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="lorry_number_732"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-400"
                  >
                    Lorry Number
                  </label>

                  <input
                    id="lorry_number_732"
                    name="lorry_number"
                    aria-label="Lorry Number"
                    readOnly
                    value={
                      arrivalMeta?.lorry_number ||
                      arrivalMeta?.lorry_no ||
                      arrivalMeta?.vehicle_no ||
                      '--'
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                  />
                </div>


                {/* Net Weight */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="arrival_net_wt_m_t_736"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-400"
                  >
                    Arrival Net Wt (M.T)
                  </label>

                  <input
                    id="arrival_net_wt_m_t_736"
                    name="arrival_net_wt_m_t"
                    aria-label="Arrival Net Wt (M.T)"
                    readOnly
                    value={
                      arrivalMeta
                        ? (
                            arrivalMeta.challan_material_weight !== undefined &&
                            arrivalMeta.challan_material_weight !== null
                              ? Number(
                                  arrivalMeta.challan_material_weight
                                ).toFixed(3)
                              : (
                                  Number(
                                    arrivalMeta.total_actual_weight ||
                                    arrivalMeta.total_weight_kgs ||
                                    0
                                  ) / 1000
                                ).toFixed(3)
                          )
                        : '0.000'
                    }
                    className="w-full rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-right text-xs font-bold tabular-nums text-emerald-700 outline-none"
                  />
                </div>

              </div>

            </div>

          </div>
        </div>
         
        )}

        {/* 4. MODE SPECIFIC FORM HEADERS */}

        {/* 4A. ISSUE TO GODOWN HEADER */}
        {issueRoute === 'godown' && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-[#103A20] bg-[#174C2C] px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
                <Layers className="h-4 w-4 text-white" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">
                  Godown Storage Details
                </h3>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-green-100">
                  Storage & Warehouse Information
                </p>
              </div>
            </div>


            {/* Form Body */}
            <div className="p-4">

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">

                {/* Godown Receipt No. */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="godown_receipt_no_756"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    Godown Receipt No.
                  </label>

                  <input
                    id="godown_receipt_no_756"
                    name="godown_receipt_no"
                    aria-label="Godown Receipt No."
                    value={formData.issue_no}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        issue_no: e.target.value
                      }))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-[#174C2C] outline-none transition-all focus:border-[#174C2C] focus:bg-white focus:ring-2 focus:ring-green-100"
                  />
                </div>


                {/* Storing Date */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="storing_date_764"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    Storing Date
                  </label>

                  <input
                    id="storing_date_764"
                    name="storing_date"
                    aria-label="Storing Date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        date: e.target.value
                      }))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 outline-none transition-all focus:border-[#174C2C] focus:bg-white focus:ring-2 focus:ring-green-100"
                  />
                </div>


                {/* Godown No. */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="godown_no_773"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    Godown No.
                  </label>

                  <select
                    id="godown_no_773"
                    name="godown_no"
                    aria-label="Godown No."
                    value={formData.godown === 'N/A' ? '' : formData.godown}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        godown: e.target.value
                      }))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 outline-none transition-all focus:border-[#174C2C] focus:bg-white focus:ring-2 focus:ring-green-100 cursor-pointer"
                  >
                    <option value="">— Select Godown —</option>

                    {godownRecords?.map((gdn: any) => (
                      <option
                        key={gdn.gdn_code || gdn.id}
                        value={gdn.gdn_name}
                      >
                        {gdn.gdn_name}
                      </option>
                    ))}
                  </select>
                </div>


                {/* Stack / Lot */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="stack_lot_no_788"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    Stack / Lot No.
                  </label>

                  <input
                    id="stack_lot_no_788"
                    name="stack_lot_no"
                    aria-label="Stack / Lot No."
                    placeholder="Stack identifier"
                    value={formData.stack_no}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        stack_no: e.target.value
                      }))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-[#174C2C] focus:bg-white focus:ring-2 focus:ring-green-100"
                  />
                </div>


                {/* Stored By */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="stored_by_keeper_797"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    Stored By (Keeper)
                  </label>

                  <input
                    id="stored_by_keeper_797"
                    name="stored_by_keeper"
                    aria-label="Stored By (Keeper)"
                    placeholder="Godown keeper name"
                    value={formData.issued_by}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        issued_by: e.target.value
                      }))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-[#174C2C] focus:bg-white focus:ring-2 focus:ring-green-100"
                  />
                </div>


                {/* Checked By */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="checked_by_806"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    Checked By
                  </label>

                  <input
                    id="checked_by_806"
                    name="checked_by"
                    aria-label="Checked By"
                    placeholder="Supervisor name"
                    value={formData.received_by}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        received_by: e.target.value
                      }))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-[#174C2C] focus:bg-white focus:ring-2 focus:ring-green-100"
                  />
                </div>


                {/* Company */}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold uppercase tracking-wide text-slate-500">
                    Company Details / Sender Company
                  </label>

                  <EditableComboBox
                    value={formData.party_name || ''}
                    onChange={(val) =>
                      setFormData((p: any) => ({
                        ...p,
                        party_name: val
                      }))
                    }
                    options={[
                      "BALLY JUTE COMPANY LIMITED",
                      "HOWRAH JUTE MILLS LTD.",
                      "HOOGHLY JUTE MILLS CO.",
                      "BIRLA JUTE INDUSTRIES"
                    ]}
                    placeholder="Select or enter Company details"
                  />
                </div>


                {/* Remarks */}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label
                    htmlFor="remarks_824"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    Remarks
                  </label>

                  <input
                    id="remarks_824"
                    name="remarks"
                    aria-label="Remarks"
                    placeholder="Condition / short / excess notes"
                    value={formData.remarks}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        remarks: e.target.value
                      }))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-[#174C2C] focus:bg-white focus:ring-2 focus:ring-green-100"
                  />
                </div>

              </div>

            </div>

          </div>
          
        )}

        {/* 4B. SELL (FACTORY TO FACTORY) HEADER */}
        {issueRoute === 'mill' && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#174C2C]">
                <Settings className="h-4 w-4 text-white" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#174C2C]">
                  Sell Details — Godown to Factory Direct
                </h3>

                <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700">
                  Direct Sale &amp; Delivery Information
                </p>
              </div>
            </div>

            {/* Form Body */}
            <div className="p-4">

              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">

                {/* Sell / Invoice No. */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="sell_invoice_no_847"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    Sell / Invoice No.
                  </label>

                  <input
                    id="sell_invoice_no_847"
                    name="sell_invoice_no"
                    aria-label="Sell / Invoice No."
                    value={formData.issue_no}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        issue_no: e.target.value
                      }))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-[#174C2C] outline-none transition-all focus:border-[#174C2C] focus:bg-white focus:ring-2 focus:ring-green-100"
                  />
                </div>


                {/* Sale Date */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="sale_date_855"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    Sale Date
                  </label>

                  <input
                    id="sale_date_855"
                    name="sale_date"
                    aria-label="Sale Date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        date: e.target.value
                      }))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 outline-none transition-all focus:border-[#174C2C] focus:bg-white focus:ring-2 focus:ring-green-100"
                  />
                </div>


                {/* PO / Agreement */}
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label
                    htmlFor="p_o_agreement_no_864"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    P.O. / Agreement No.
                  </label>

                  <input
                    id="p_o_agreement_no_864"
                    name="p_o_agreement_no"
                    aria-label="P.O. / Agreement No."
                    placeholder="Enter Purchase Order or Agreement number"
                    value={formData.requisition_no}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        requisition_no: e.target.value
                      }))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-[#174C2C] focus:bg-white focus:ring-2 focus:ring-green-100"
                  />
                </div>


                {/* JCI */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="j_c_i_govt_873"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    J.C.I Govt
                  </label>

                  <select
                    id="j_c_i_govt_873"
                    name="j_c_i_govt"
                    aria-label="J.C.I Govt"
                    value={formData.jci}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        jci: e.target.value
                      }))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 outline-none transition-all focus:border-[#174C2C] focus:bg-white focus:ring-2 focus:ring-green-100 cursor-pointer"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>


                {/* Challan */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="challan_delivery_order_no_884"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    Challan / Delivery Order No.
                  </label>

                  <input
                    id="challan_delivery_order_no_884"
                    name="challan_delivery_order_no"
                    aria-label="Challan / Delivery Order No."
                    placeholder="Delivery order reference"
                    value={formData.batch_order}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        batch_order: e.target.value
                      }))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-[#174C2C] focus:bg-white focus:ring-2 focus:ring-green-100"
                  />
                </div>


                {/* Buyer Factory */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="buyer_factory_name_893"
                    className="text-[9px] font-black uppercase tracking-wide text-emerald-700"
                  >
                    Buyer Factory Name
                  </label>

                  <input
                    id="buyer_factory_name_893"
                    name="buyer_factory_name"
                    aria-label="Buyer Factory Name"
                    placeholder="Buyer mill or factory name"
                    value={formData.department}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        department: e.target.value
                      }))
                    }
                    className="h-9 rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-[#174C2C] focus:bg-white focus:ring-2 focus:ring-green-100"
                  />
                </div>


                {/* Buyer Delivery Address */}
                <div className="col-span-2 md:col-span-3 flex flex-col gap-1.5">
                  <label
                    htmlFor="buyer_delivery_address_de_902"
                    className="text-[9px] font-black uppercase tracking-wide text-emerald-700"
                  >
                    Buyer Delivery Address / Destination
                  </label>

                  <input
                    id="buyer_delivery_address_de_902"
                    name="buyer_delivery_address_de"
                    aria-label="Buyer Delivery Address / Destination"
                    placeholder="Enter full destination address of Buyer"
                    value={formData.destination_godown || ''}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        destination_godown: e.target.value
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-[#174C2C] focus:bg-white focus:ring-2 focus:ring-green-100"
                  />
                </div>


                {/* Issued By */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="issued_by_911"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    Issued By
                  </label>

                  <input
                    id="issued_by_911"
                    name="issued_by"
                    aria-label="Issued By"
                    placeholder="Store in-charge"
                    value={formData.issued_by}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        issued_by: e.target.value
                      }))
                    }
                    className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-[#174C2C] focus:bg-white focus:ring-2 focus:ring-green-100"
                  />
                </div>


                {/* Multi-Select Godown */}
                <div className="col-span-2 flex flex-col gap-1.5">

                  <label className="text-[9px] font-black uppercase tracking-wide text-emerald-700">
                    Godown No. (Source) [Select Multiple]
                  </label>

                  <div className="flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/30 p-1.5">

                    {godownRecords?.map((gdn: any) => {

                      const selectedGodowns =
                        formData.godown && formData.godown !== 'N/A'
                          ? formData.godown
                              .split(',')
                              .map((g: string) => g.trim())
                              .filter(Boolean)
                          : [];

                      const isSelected =
                        selectedGodowns.includes(gdn.gdn_name);

                      return (
                        <button
                          key={gdn.gdn_code || gdn.id}
                          type="button"
                          onClick={() => {
                            let newList: string[];

                            if (isSelected) {
                              newList = selectedGodowns.filter(
                                (g: string) => g !== gdn.gdn_name
                              );
                            } else {
                              newList = [
                                ...selectedGodowns,
                                gdn.gdn_name
                              ];
                            }

                            const godownStr =
                              newList.join(', ') || '';

                            setFormData((p: any) => ({
                              ...p,
                              godown: godownStr || 'N/A'
                            }));
                          }}
                          className={cn(
                            "flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[9px] font-black uppercase transition-all cursor-pointer",
                            isSelected
                              ? "border-[#174C2C] bg-[#174C2C] text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                          )}
                        >
                          {isSelected && (
                            <span className="text-[9px] font-bold">
                              &#10003;
                            </span>
                          )}

                          {gdn.gdn_name}
                        </button>
                      );
                    })}

                    {godownRecords?.length === 0 && (
                      <span className="text-[11px] italic text-slate-400">
                        No godowns loaded.
                      </span>
                    )}

                  </div>
                </div>


                {/* Sender Company */}
                <div className="col-span-2 flex flex-col gap-1.5">

                  <label
                    htmlFor="sender_company_960"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    Sender Company
                  </label>

                  <input
                    id="sender_company_960"
                    name="sender_company"
                    aria-label="Sender Company"
                    readOnly
                    value="BALLY JUTE COMPANY LIMITED"
                    className="h-9 cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 text-xs font-black uppercase text-slate-700 outline-none"
                  />
                </div>


                {/* Remarks */}
                <div className="col-span-2 flex flex-col gap-1.5">

                  <label
                    htmlFor="remarks_gstin_comments_968"
                    className="text-[9px] font-bold uppercase tracking-wide text-slate-500"
                  >
                    Remarks / GSTIN / Comments
                  </label>

                  <input
                    id="remarks_gstin_comments_968"
                    name="remarks_gstin_comments"
                    aria-label="Remarks / GSTIN / Comments"
                    placeholder="Feed / blend instructions or Buyer GSTIN"
                    value={formData.remarks}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        remarks: e.target.value
                      }))
                    }
                    className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-[#174C2C] focus:bg-white focus:ring-2 focus:ring-green-100"
                  />

                </div>

              </div>
            </div>
          </div>

        )}

        {/* 4C. GODOWN -> FACTORY HEADER (IMAGE 2 DESIGN) */}
        {issueRoute === 'factory' && (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

            {/* Header */}
            <div className="relative overflow-hidden bg-[#174C2C] px-5 py-4">
              
              {/* Decorative background */}
              <div className="absolute right-0 top-0 h-full w-40 opacity-10">
                <div className="h-full w-full bg-[repeating-linear-gradient(45deg,white_0_12px,transparent_12px_24px)]" />
              </div>

              <div className="relative flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <Layers className="h-5 w-5 text-white" />
                </div>

                <div>
                  <h2 className="text-base font-black uppercase tracking-wide text-white">
                    Godown To Factory
                  </h2>
                  <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-green-100">
                    Bally Jute Company Limited
                  </p>
                </div>
              </div>
            </div>


            {/* Form */}
            <div className="bg-slate-50/60 p-5">

              <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">

                {/* Issue No */}
                <div className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all focus-within:border-[#174C2C] focus-within:ring-2 focus-within:ring-green-100">
                  <label
                    htmlFor="issue_no_996"
                    className="w-[125px] shrink-0 text-[10px] font-black uppercase tracking-wide text-[#174C2C]"
                  >
                    Issue No.
                  </label>

                  <input
                    id="issue_no_996"
                    name="issue_no"
                    aria-label="Issue No."
                    value={formData.issue_no}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        issue_no: e.target.value
                      }))
                    }
                    className="h-8 flex-1 border-0 bg-transparent px-1 text-xs font-bold text-[#174C2C] outline-none"
                  />
                </div>


                {/* Issue Date */}
                <div className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all focus-within:border-[#174C2C] focus-within:ring-2 focus-within:ring-green-100">
                  <label
                    htmlFor="issue_date_1004"
                    className="w-[125px] shrink-0 text-[10px] font-black uppercase tracking-wide text-[#174C2C]"
                  >
                    Issue Date
                  </label>

                  <input
                    id="issue_date_1004"
                    name="issue_date"
                    aria-label="Issue Date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        date: e.target.value
                      }))
                    }
                    className="h-8 flex-1 border-0 bg-transparent px-1 text-xs font-bold text-slate-800 outline-none"
                  />
                </div>


                {/* Requisition No */}
                <div className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all focus-within:border-[#174C2C] focus-within:ring-2 focus-within:ring-green-100">
                  <label
                    htmlFor="requisition_no_1014"
                    className="w-[125px] shrink-0 text-[10px] font-black uppercase tracking-wide text-[#174C2C]"
                  >
                    Requisition No.
                  </label>

                  <input
                    id="requisition_no_1014"
                    name="requisition_no"
                    aria-label="Requisition No."
                    placeholder="Batching requisition"
                    value={formData.requisition_no}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        requisition_no: e.target.value
                      }))
                    }
                    className="h-8 flex-1 border-0 bg-transparent px-1 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none"
                  />
                </div>


                {/* Requisition Date */}
                <div className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all focus-within:border-[#174C2C] focus-within:ring-2 focus-within:ring-green-100">
                  <label
                    htmlFor="requisition_date_1023"
                    className="w-[125px] shrink-0 text-[10px] font-black uppercase tracking-wide text-[#174C2C]"
                  >
                    Requisition Date
                  </label>

                  <input
                    id="requisition_date_1023"
                    name="requisition_date"
                    aria-label="Requisition Date"
                    type="date"
                    value={formData.requisition_date}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        requisition_date: e.target.value
                      }))
                    }
                    className="h-8 flex-1 border-0 bg-transparent px-1 text-xs font-bold text-slate-800 outline-none"
                  />
                </div>


                {/* Godown */}
                <div className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all focus-within:border-[#174C2C] focus-within:ring-2 focus-within:ring-green-100">
                  <label
                    htmlFor="godown_no_source_1033"
                    className="w-[125px] shrink-0 text-[10px] font-black uppercase tracking-wide text-[#174C2C]"
                  >
                    Godown No. (Source)
                  </label>

                  <select
                    id="godown_no_source_1033"
                    name="godown_no_source"
                    aria-label="Godown No. (Source)"
                    value={formData.godown === 'N/A' ? '' : formData.godown}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        godown: e.target.value
                      }))
                    }
                    className="h-8 flex-1 cursor-pointer border-0 bg-transparent px-1 text-xs font-bold text-slate-800 outline-none"
                  >
                    <option value="">— Select Godown —</option>

                    {godownRecords?.map((gdn: any) => (
                      <option
                        key={gdn.gdn_code || gdn.id}
                        value={gdn.gdn_name}
                      >
                        {gdn.gdn_name}
                      </option>
                    ))}
                  </select>
                </div>


                {/* Issued For */}
                <div className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <label className="w-[125px] shrink-0 text-[10px] font-black uppercase tracking-wide text-[#174C2C]">
                    Issued For
                  </label>

                  <div className="flex-1">
                    <EditableComboBox
                      value={formData.issued_for || ''}
                      onChange={(val) =>
                        setFormData((p: any) => ({
                          ...p,
                          issued_for: val
                        }))
                      }
                      options={["MAIN MILL"]}
                      placeholder="Select or type Issued For"
                    />
                  </div>
                </div>


                {/* Batching Order */}
                <div className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <label className="w-[125px] shrink-0 text-[10px] font-black uppercase tracking-wide text-[#174C2C]">
                    Batching Order
                  </label>

                  <div className="flex-1">
                    <EditableComboBox
                      value={formData.batch_order || ''}
                      onChange={(val) =>
                        setFormData((p: any) => ({
                          ...p,
                          batch_order: val
                        }))
                      }
                      options={batchOptions}
                      placeholder="Select or type batching order"
                    />
                  </div>
                </div>


                {/* Lorry Number */}
                <div className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all focus-within:border-[#174C2C] focus-within:ring-2 focus-within:ring-green-100">
                  <label
                    htmlFor="lorry_number_1067"
                    className="w-[125px] shrink-0 text-[10px] font-black uppercase tracking-wide text-[#174C2C]"
                  >
                    Lorry Number
                  </label>

                  <input
                    id="lorry_number_1067"
                    name="lorry_number"
                    aria-label="Lorry Number"
                    placeholder="Lorry Number"
                    value={formData.lorry_number}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        lorry_number: e.target.value
                      }))
                    }
                    className="h-8 flex-1 border-0 bg-transparent px-1 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none"
                  />
                </div>


                {/* Issued By */}
                <div className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all focus-within:border-[#174C2C] focus-within:ring-2 focus-within:ring-green-100">
                  <label
                    htmlFor="issued_by_1077"
                    className="w-[125px] shrink-0 text-[10px] font-black uppercase tracking-wide text-[#174C2C]"
                  >
                    Issued By
                  </label>

                  <input
                    id="issued_by_1077"
                    name="issued_by"
                    aria-label="Issued By"
                    placeholder="Godown keeper name"
                    value={formData.issued_by}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        issued_by: e.target.value
                      }))
                    }
                    className="h-8 flex-1 border-0 bg-transparent px-1 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none"
                  />
                </div>


                {/* Received By */}
                <div className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all focus-within:border-[#174C2C] focus-within:ring-2 focus-within:ring-green-100">
                  <label
                    htmlFor="received_by_1086"
                    className="w-[125px] shrink-0 text-[10px] font-black uppercase tracking-wide text-[#174C2C]"
                  >
                    Received By
                  </label>

                  <input
                    id="received_by_1086"
                    name="received_by"
                    aria-label="Received By"
                    placeholder="Mill / batching in-charge"
                    value={formData.received_by}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        received_by: e.target.value
                      }))
                    }
                    className="h-8 flex-1 border-0 bg-transparent px-1 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none"
                  />
                </div>


                {/* Company */}
                <div className="md:col-span-2 group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <label className="w-[125px] shrink-0 text-[10px] font-black uppercase tracking-wide text-[#174C2C]">
                    Company Details / Sender
                  </label>

                  <div className="flex-1">
                    <EditableComboBox
                      value={formData.party_name || ''}
                      onChange={(val) =>
                        setFormData((p: any) => ({
                          ...p,
                          party_name: val
                        }))
                      }
                      options={[
                        "BALLY JUTE COMPANY LIMITED",
                        "HOWRAH JUTE MILLS LTD.",
                        "HOOGHLY JUTE MILLS CO.",
                        "BIRLA JUTE INDUSTRIES"
                      ]}
                      placeholder="Select or enter Company details"
                    />
                  </div>
                </div>


                {/* Remarks */}
                <div className="md:col-span-2 flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm transition-all focus-within:border-[#174C2C] focus-within:ring-2 focus-within:ring-green-100">
                  <label
                    htmlFor="remarks_1108"
                    className="mt-2 w-[125px] shrink-0 text-[10px] font-black uppercase tracking-wide text-[#174C2C]"
                  >
                    Remarks
                  </label>

                  <textarea
                    id="remarks_1108"
                    name="remarks"
                    aria-label="Remarks"
                    placeholder="Issue notes, dampness, short / excess details, observations"
                    value={formData.remarks}
                    onChange={(e) =>
                      setFormData((p: any) => ({
                        ...p,
                        remarks: e.target.value
                      }))
                    }
                    className="min-h-[52px] flex-1 resize-y border-0 bg-transparent px-1 py-1 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none"
                  />
                </div>

              </div>
            </div>
          </div>
        )}

        {/* 5. DYNAMIC ALLOCATION DETAILS TABLE */}
        {issueRoute && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            {/* =========================================================
                HEADER
            ========================================================= */}
            <div className="bg-[#174C2C] border-b-4 border-[#103A20] px-4 py-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">

                {/* Title */}
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 border border-white/20">
                    <Layers className="h-4 w-4 text-white" />
                  </div>

                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wide">
                      Material Issue Details
                      {issueRoute === 'factory' && (
                        <span className="ml-1 text-green-200">
                          — Godown to Factory
                        </span>
                      )}
                    </h3>

                    <p className="text-[9px] text-green-100 font-semibold uppercase tracking-[1.5px] mt-0.5">
                      Material allocation &amp; issue entry
                    </p>
                  </div>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2">

                  <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex items-center gap-1.5 bg-white text-[#174C2C] hover:bg-green-50 border border-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[3]" />
                    Add Row
                  </button>

                  <button
                    type="button"
                    onClick={deleteLastRow}
                    className="inline-flex items-center gap-1.5 bg-[#103A20] hover:bg-[#0b2d18] text-white border border-white/20 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>

                </div>
              </div>
            </div>


            {/* =========================================================
                TABLE AREA
            ========================================================= */}
            <div className="overflow-x-auto bg-slate-50/50">

              <table className="w-full text-center border-collapse min-w-[1250px]">

                {/* =====================================================
                    GODOWN HEADER
                ===================================================== */}
                {issueRoute === 'godown' && (
                  <thead>
                    <tr className="bg-[#174C2C] text-white text-[10px] uppercase tracking-wide">

                      <th className="py-3 px-2 border-r border-white/10 w-12">
                        Srl
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-28">
                        Grade
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-28">
                        Marka
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-28">
                        Area
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-28">
                        Agency
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-28">
                        Crop Year
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-16">
                        Code
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-24">
                        Quantity
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-24">
                        Unit
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-28">
                        Weight (M.T)
                      </th>

                      <th className="py-3 px-2 text-left">
                        Stack Position
                      </th>

                      <th className="py-3 px-2 w-12 colhide">
                        &nbsp;
                      </th>

                    </tr>
                  </thead>
                )}


                {/* =====================================================
                    MILL HEADER
                ===================================================== */}
                {issueRoute === 'mill' && (
                  <thead>
                    <tr className="bg-[#174C2C] text-white text-[10px] uppercase tracking-wide">

                      <th className="py-3 px-2 border-r border-white/10 w-12">
                        Srl
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-28">
                        Grade
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-28">
                        Marka
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-28">
                        Area
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-28">
                        Agency
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-28">
                        Crop Year
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-16">
                        Code
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-24">
                        Quantity
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-24">
                        Unit
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-24">
                        Weight (M.T)
                      </th>

                      <th className="py-3 px-2 border-r border-green-800 bg-[#103A20] w-28">
                        Price / Rate
                      </th>

                      <th className="py-3 px-2 border-r border-green-800 bg-[#103A20] w-28">
                        Total Amount
                      </th>

                      <th className="py-3 px-2 text-left">
                        Buyer Destination
                      </th>

                      <th className="py-3 px-2 w-12 colhide">
                        &nbsp;
                      </th>

                    </tr>
                  </thead>
                )}


                {/* =====================================================
                    FACTORY HEADER
                ===================================================== */}
                {issueRoute === 'factory' && (
                  <thead>
                    <tr className="bg-[#174C2C] text-white text-[10px] uppercase tracking-wide">

                      <th className="py-3 px-2 border-r border-white/10 w-12">
                        Srl
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-28">
                        I.TG No.
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-28">
                        Grade / Quality
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-28">
                        Area
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-24">
                        Quantity
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-28">
                        Unit
                      </th>

                      <th className="py-3 px-2 border-r border-white/10 w-28">
                        Weight (M.Ton)
                      </th>

                      <th className="py-3 px-2 w-12 colhide">
                        &nbsp;
                      </th>

                    </tr>
                  </thead>
                )}


                {/* =====================================================
                    TABLE BODY
                ===================================================== */}
                <tbody>

                  {items.map((row, idx) => (

                    <tr
                      key={idx}
                      className={cn(
                        "border-b border-slate-200 transition-all",
                        idx % 2 === 0
                          ? "bg-white"
                          : "bg-slate-50/70",
                        "hover:bg-green-50/50"
                      )}
                    >

                      {/* Serial */}
                      <td className="py-2 px-2">
                        <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-green-50 text-[#174C2C] text-[10px] font-black">
                          {idx + 1}
                        </div>
                      </td>


                      {/* =================================================
                          FACTORY ROUTE
                      ================================================= */}
                      {issueRoute === 'factory' ? (
                        <>

                          {/* I.TG No */}
                          <td className="px-1 py-1.5">
                            <input
                              id="row_itg_no_1219"
                              name="row_itg_no"
                              aria-label="row itg no"
                              type="text"
                              value={row.itg_no || ''}
                              onChange={(e) =>
                                updateRow(idx, 'itg_no', e.target.value)
                              }
                              className="w-full text-center px-2 py-1.5 rounded-md border border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-[#174C2C] outline-none text-xs font-medium"
                            />
                          </td>


                          {/* Grade */}
                          <td className="px-1 py-1.5">
                            <select
                              id="row_grade_name_1228"
                              name="row_grade_name"
                              aria-label="row grade name"
                              value={row.grade_name}
                              onChange={(e) =>
                                updateRow(idx, 'grade_name', e.target.value)
                              }
                              className="w-full text-center px-2 py-1.5 rounded-md border border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-[#174C2C] outline-none text-xs font-bold"
                            >
                              {GRADES.map(g => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                            </select>
                          </td>


                          {/* Area */}
                          <td className="px-1 py-1.5">
                            <input
                              id="row_area_1238"
                              name="row_area"
                              aria-label="row area"
                              type="text"
                              value={row.area || ''}
                              onChange={(e) =>
                                updateRow(idx, 'area', e.target.value)
                              }
                              className="w-full text-center px-2 py-1.5 rounded-md border border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-[#174C2C] outline-none text-xs"
                            />
                          </td>

                        </>

                      ) : (

                        /* =================================================
                          GODOWN / MILL ROUTE
                        ================================================= */
                        <>

                          {/* Grade */}
                          <td className="px-1 py-1.5">
                            <select
                              id="row_grade_name_1250"
                              name="row_grade_name"
                              aria-label="row grade name"
                              value={row.grade_name}
                              onChange={(e) =>
                                updateRow(idx, 'grade_name', e.target.value)
                              }
                              className="w-full text-center px-2 py-1.5 rounded-md border border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-[#174C2C] outline-none text-xs font-bold"
                            >
                              {GRADES.map(g => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                            </select>
                          </td>


                          {/* Marka */}
                          <td className="px-1 py-1.5">
                            <input
                              id="row_marka_1260"
                              name="row_marka"
                              aria-label="row marka"
                              type="text"
                              value={row.marka || ''}
                              onChange={(e) =>
                                updateRow(idx, 'marka', e.target.value)
                              }
                              className="w-full text-center px-2 py-1.5 rounded-md border border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-[#174C2C] outline-none text-xs font-mono"
                            />
                          </td>


                          {/* Area */}
                          <td className="px-1 py-1.5">
                            <input
                              id="row_area_1269"
                              name="row_area"
                              aria-label="row area"
                              type="text"
                              value={row.area || ''}
                              onChange={(e) =>
                                updateRow(idx, 'area', e.target.value)
                              }
                              className="w-full text-center px-2 py-1.5 rounded-md border border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-[#174C2C] outline-none text-xs"
                            />
                          </td>


                          {/* Agency */}
                          <td className="px-1 py-1.5">
                            <input
                              id="row_agency_1278"
                              name="row_agency"
                              aria-label="row agency"
                              type="text"
                              value={row.agency || ''}
                              onChange={(e) =>
                                updateRow(idx, 'agency', e.target.value)
                              }
                              className="w-full text-center px-2 py-1.5 rounded-md border border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-[#174C2C] outline-none text-xs"
                            />
                          </td>


                          {/* Crop Year */}
                          <td className="px-1 py-1.5">
                            <select
                              id="row_crop_1287"
                              name="row_crop"
                              aria-label="row crop"
                              value={row.crop}
                              onChange={(e) =>
                                updateRow(idx, 'crop', e.target.value)
                              }
                              className="w-full text-center px-2 py-1.5 rounded-md border border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-[#174C2C] outline-none text-xs"
                            >
                              {CROPS.map(cr => (
                                <option key={cr} value={cr}>
                                  {cr}
                                </option>
                              ))}
                            </select>
                          </td>


                          {/* Code */}
                          <td className="px-1 py-1.5">
                            <select
                              id="row_code_1297"
                              name="row_code"
                              aria-label="row code"
                              value={row.code}
                              onChange={(e) =>
                                updateRow(idx, 'code', e.target.value)
                              }
                              className="w-full text-center px-2 py-1.5 rounded-md border border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-[#174C2C] outline-none text-xs font-bold text-[#174C2C]"
                            >
                              <option value=""></option>

                              {row.code && !BATCH_CODES[row.code] && (
                                <option value={row.code}>
                                  {row.code}
                                </option>
                              )}

                              {Object.keys(BATCH_CODES).map(c => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </td>

                        </>
                      )}


                      {/* =================================================
                          QUANTITY
                      ================================================= */}
                      <td className="px-1 py-1.5">

                        <input
                          id="0_1314"
                          name="0"
                          aria-label="0"
                          type="number"
                          min="0"
                          placeholder="0"
                          value={row.qty || ''}
                          onChange={(e) =>
                            updateRow(
                              idx,
                              'qty',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full text-right px-2 py-1.5 rounded-md border border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-[#174C2C] outline-none text-xs font-black text-[#174C2C]"
                        />

                      </td>


                      {/* =================================================
                          UNIT
                      ================================================= */}
                      <td className="px-1 py-1.5">

                        <select
                          id="row_unit_1326"
                          name="row_unit"
                          aria-label="row unit"
                          value={row.unit}
                          onChange={(e) =>
                            updateRow(idx, 'unit', e.target.value)
                          }
                          className="w-full text-center px-2 py-1.5 rounded-md border border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-[#174C2C] outline-none text-xs font-bold"
                        >
                          {UNITS.map(u => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>

                      </td>


                      {/* =================================================
                          WEIGHT
                      ================================================= */}
                      <td className="px-1 py-1.5">

                        <input
                          id="0_000_1337"
                          name="0_000"
                          aria-label="0.000"
                          type="number"
                          step="0.001"
                          min="0"
                          placeholder="0.000"
                          value={
                            row.weight_kgs
                              ? row.weight_kgs / 1000
                              : ''
                          }
                          onChange={(e) =>
                            updateRow(
                              idx,
                              'weight_kgs',
                              (parseFloat(e.target.value) || 0) * 1000
                            )
                          }
                          className="w-full text-right px-2 py-1.5 rounded-md border border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-[#174C2C] outline-none text-xs font-black"
                        />

                      </td>


                      {/* =================================================
                          MILL PRICE
                      ================================================= */}
                      {issueRoute === 'mill' && (
                        <>

                          <td className="px-1 py-1.5 bg-green-50/50">

                            <input
                              id="0_00_1352"
                              name="0_00"
                              aria-label="0.00"
                              type="number"
                              min="0"
                              placeholder="0.00"
                              value={row.rate || ''}
                              onChange={(e) =>
                                updateRow(
                                  idx,
                                  'rate',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full text-right px-2 py-1.5 rounded-md border border-green-200 bg-white focus:border-[#174C2C] outline-none text-xs font-bold text-[#174C2C] font-mono"
                            />

                          </td>


                          <td className="px-2 text-right font-mono font-bold text-[#174C2C] bg-green-50/50 text-xs">

                            {row.qty && row.rate
                              ? (
                                  row.qty * row.rate
                                ).toLocaleString(
                                  'en-IN',
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  }
                                )
                              : '0.00'
                            }

                          </td>

                        </>
                      )}


                      {/* =================================================
                          PLACE / DESTINATION
                      ================================================= */}
                      {issueRoute !== 'factory' && (
                        <td className="px-1 py-1.5">

                          <input
                            id="stack_section_ref_1370"
                            name="stack_section_ref"
                            aria-label="Stack / section ref"
                            type="text"
                            placeholder="Stack / section ref"
                            value={
                              row.place ||
                              row.location_dest ||
                              ''
                            }
                            onChange={(e) => {

                              updateRow(
                                idx,
                                'place',
                                e.target.value
                              );

                              updateRow(
                                idx,
                                'location_dest',
                                e.target.value
                              );

                            }}
                            className="w-full text-left px-2 py-1.5 rounded-md border border-transparent bg-transparent hover:border-slate-200 focus:bg-white focus:border-[#174C2C] outline-none text-xs font-medium"
                          />

                        </td>
                      )}


                      {/* =================================================
                          DELETE ROW
                      ================================================= */}
                      <td className="colhide px-2">

                        <button
                          type="button"
                          title="Delete Row"
                          onClick={() => deleteRow(idx)}
                          className="flex h-7 w-7 items-center justify-center mx-auto rounded-md text-slate-400 hover:text-white hover:bg-rose-600 transition-all cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>

                      </td>

                    </tr>

                  ))}

                </tbody>


                {/* =====================================================
                    FOOTER TOTALS
                ===================================================== */}
                <tfoot>

                  {/* TOTAL BALES */}
                  <tr className="bg-green-50 border-t-2 border-[#174C2C] text-[#174C2C]">

                    <td
                      className="py-3 px-3 text-right font-black uppercase text-[10px]"
                      colSpan={issueRoute === 'factory' ? 4 : 7}
                    >
                      Total Bales Issued
                    </td>

                    <td className="text-right px-2 font-mono text-sm font-black">
                      {splitTotals.balesQ}
                    </td>

                    <td className="text-[10px] font-black uppercase">
                      BALES
                    </td>

                    <td className="text-right px-2 font-mono text-sm font-black">
                      {splitTotals.balesW.toFixed(3)}
                    </td>


                    {issueRoute === 'mill' ? (
                      <>

                        <td className="text-right px-2 font-mono font-bold text-slate-400">
                          &mdash;
                        </td>

                        <td className="text-right px-2 font-mono font-bold text-[#174C2C]">

                          {items
                            .filter(
                              it =>
                                (it.unit || 'BALES')
                                  .toUpperCase() === 'BALES'
                            )
                            .reduce(
                              (sum, it) =>
                                sum +
                                (
                                  (parseFloat(it.qty) || 0) *
                                  (parseFloat(it.rate) || 0)
                                ),
                              0
                            )
                            .toLocaleString(
                              'en-IN',
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              }
                            )}

                        </td>

                        <td
                          colSpan={2}
                          className="colhide"
                        />

                      </>

                    ) : (

                      <td className="colhide" />

                    )}

                  </tr>


                  {/* GRAND TOTAL */}
                  <tr className="bg-[#174C2C] text-white">

                    <td
                      className="py-3 px-3 text-right font-black uppercase text-[11px]"
                      colSpan={issueRoute === 'factory' ? 4 : 7}
                    >
                      Grand Total
                    </td>

                    <td className="text-right px-2 font-mono text-sm font-black">
                      {splitTotals.grandQ}
                    </td>

                    <td className="font-bold">
                      &mdash;
                    </td>

                    <td className="text-right px-2 font-mono text-sm font-black">
                      {splitTotals.grandW.toFixed(3)}
                    </td>


                    {issueRoute === 'mill' ? (
                      <>

                        <td className="text-right px-2 font-mono font-bold text-green-100">
                          &mdash;
                        </td>

                        <td className="text-right px-2 font-mono font-black text-green-200">

                          ₹{splitTotals.grandAmount.toLocaleString(
                            'en-IN',
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }
                          )}

                        </td>

                        <td
                          colSpan={2}
                          className="colhide"
                        />

                      </>

                    ) : (

                      <td className="colhide" />

                    )}

                  </tr>

                </tfoot>

              </table>

            </div>


            {/* =========================================================
                BOTTOM ACTION BAR
            ========================================================= */}
            <div className="border-t border-slate-200 bg-white px-4 py-3">

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">

                <div className="flex items-center gap-2">

                  <div className="h-7 w-7 rounded-md bg-green-50 flex items-center justify-center">
                    <Plus className="h-3.5 w-3.5 text-[#174C2C]" />
                  </div>

                  <div>
                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-wide">
                      Allocation Rows
                    </p>

                    <p className="text-[9px] text-slate-400 font-medium">
                      Add or remove material issue lines as required.
                    </p>
                  </div>

                </div>


                <div className="flex items-center gap-2">

                  <button
                    type="button"
                    onClick={addRow}
                    className="inline-flex items-center gap-1.5 bg-[#174C2C] hover:bg-[#103A20] text-white font-black px-4 py-2 rounded-lg text-[10px] uppercase tracking-wide shadow-sm transition-all cursor-pointer active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[3]" />
                    Add Row
                  </button>

                  <button
                    type="button"
                    onClick={deleteLastRow}
                    className="inline-flex items-center gap-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-black px-4 py-2 rounded-lg text-[10px] uppercase tracking-wide transition-all cursor-pointer active:scale-95"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Row
                  </button>

                </div>

              </div>

            </div>

          </div>
         
        )}

        {/* 7. ACTION ZONE */}
        {issueRoute && (
          <>
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

            {/* Top accent line */}
            <div
              className={cn(
                "h-1 w-full",
                issueRoute === 'godown'
                  ? "bg-gradient-to-r from-[#1c4587] via-[#3b82c4] to-[#1c4587]"
                  : issueRoute === 'mill'
                  ? "bg-gradient-to-r from-[#0b6e54] via-[#159c74] to-[#0b6e54]"
                  : "bg-gradient-to-r from-[#1c4587] via-[#3b82c4] to-[#1c4587]"
              )}
            />

            <div className="flex items-center justify-between gap-4 px-4 py-3 flex-wrap bg-slate-50/70">
              
              {/* Information Section */}
              <div className="flex items-center gap-3 min-w-[250px] flex-1">
                
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm",
                    issueRoute === 'godown'
                      ? "bg-[#eaf0f8] text-[#1c4587]"
                      : issueRoute === 'mill'
                      ? "bg-emerald-50 text-[#0b6e54]"
                      : "bg-[#eaf0f8] text-[#1c4587]"
                  )}
                >
                  <Check className="h-5 w-5 stroke-[2.5]" />
                </div>

                <div className="leading-tight">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-700">
                    Material Issue Control
                  </p>

                  <span className="mt-1 block text-[11px] font-medium text-slate-400">
                    Selecting a Code auto-fills the Batch Name. Totals split and reconcile automatically.
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                
                {/* Clear */}
                <button 
                  type="button" 
                  onClick={resetAll}
                  className="group flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-100 active:scale-95 cursor-pointer"
                >
                  <span className="text-base leading-none transition-transform group-hover:rotate-[-45deg]">
                    ↻
                  </span>
                  <span>Clear</span>
                </button>

                {/* Print */}
                <button 
                  type="button" 
                  onClick={() => window.print()}
                  className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-[#b66b09] shadow-sm transition-all hover:bg-[#e0972f] hover:text-white hover:border-[#e0972f] active:scale-95 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Slip</span>
                </button>

                {/* Save */}
                <button 
                  type="button" 
                  onClick={handleSave}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-5 py-2 text-xs font-extrabold text-white shadow-md transition-all hover:-translate-y-[1px] hover:shadow-lg active:translate-y-0 active:scale-95 cursor-pointer",
                    issueRoute === 'godown'
                      ? "bg-[#1c4587] hover:bg-[#143160]"
                      : issueRoute === 'mill'
                      ? "bg-[#0b6e54] hover:bg-[#08523f]"
                      : "bg-[#1c4587] hover:bg-[#143160]"
                  )}
                >
                  <Check className="h-4 w-4 stroke-[3]" />

                  <span>
                    {issueRoute === 'godown'
                      ? 'Save & Stack'
                      : issueRoute === 'mill'
                      ? 'Save & Sell (Factory to Factory)'
                      : 'Save & Issue'}
                  </span>
                </button>
              </div>
            </div>
          </div>
          {/* <div className="flex items-center gap-3 bg-white p-4 border border-[#dbe1ea] rounded-md flex-wrap  shadow-xs">
            <span className="text-[11px] text-slate-400 font-bold mr-auto">
              Selecting a Code auto-fills the Batch Name. Totals split and reconcile automatically.
            </span>
            
            <button 
              type="button" 
              onClick={resetAll}
              className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold px-4 py-2 rounded cursor-pointer transition-colors"
            >
              Clear
            </button>

            <button 
              type="button" 
              onClick={() => window.print()}
              className="bg-[#e0972f] hover:brightness-95 text-white font-bold px-4 py-2 rounded cursor-pointer transition-colors flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" />
              <span>Print Slip</span>
            </button>

            <button 
              type="button" 
              onClick={handleSave}
              className="bg-[#159c74] hover:bg-[#117c5d] text-white font-extrabold px-5 py-2 rounded cursor-pointer transition-all flex items-center gap-1.5 shadow-sm hover:shadow"
            >
              <Check className="h-4 w-4 stroke-[3]" />
              <span>
                {issueRoute === 'godown' ? 'Save & Stack' :
                 issueRoute === 'mill' ? 'Save & Sell (Factory to Factory)' : 'Save & Issue'}
              </span>
            </button>
          </div> */}
          </>
        )}

      </div>
    </EntryContainer>
  );
}
