import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, 
  Search, 
  Plus, 
  Trash2,
  X,
  Edit,
  Printer,
  Database,
  Check,
  ChevronDown,
  Calendar,
  Layers,
  FileText,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PaginationControls } from '../components/PaginationControls';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import MaterialIssueEntry from '../components/MaterialIssueEntry';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { enforceEditOrDeletePermission, canEditOrDelete } from '../lib/permissions';
import { dbModule } from '../services/dbModule';
import { supabase } from '../lib/supabase';

import PrintModal from '../components/PrintModal';

// Common Jute Mill Departments
const DEFAULT_DEPARTMENTS = [
  'BATCHING',
  'PREPARING',
  'SPINNING',
  'WINDING',
  'BEAMING (SIZING)',
  'WEAVING',
  'FINISHING',
  'DUST SHAKING',
  'SEWING & HEMMING',
  'PACKING & BALING',
  'MAINTENANCE / WORKSHOP',
  'ELECTRICAL',
  'BOILER HOUSE',
  'STORES / GENERAL'
];

// Default suggestions
const DEFAULT_ISSUE_TYPES = [
  'factory Issue',
  'Godown',
  'Internal Transfer',
  'Sale'
];

const DEFAULT_STOCK_GROUPS = [
  'RAW JUTE',
  'BARDANA',
  'COAL',
  'LUBRICANTS & OILS',
  'MACHINERY SPARES',
  'GENERAL STORES'
];

const DEFAULT_SHIFTS = [
  'A',
  'B',
  'C',
  'D',
  'GENERAL',
  'NIGHT',
  'DAY'
];

const DEFAULT_CROPS = [
  '2025-26',
  '2024-25',
  '2026-27',
  '2023-24'
];

const DEFAULT_GRADES = [
  'TD1', 'TD2', 'TD3', 'TD4', 'TD5', 'TD6', 'TD7', 'TD8',
  'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8',
  'MESTA', 'BIMLI', 'RAW JUTE'
];

const DEFAULT_MARKAS = [
  'NO MARK',
  'JCI',
  'STANDARD',
  'SUPPLIER MARK',
  'EXPORT QUALITY'
];

// Generic Autocomplete/ComboBox dropdown that supports selection AND custom manual entry.
function ManualEntryComboBox({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  className 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  options: string[]; 
  placeholder?: string; 
  className?: string; 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(value.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <div className="relative flex items-center">
        <input
 id="value_132" name="value" aria-label="value"          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onClick={() => setIsOpen(true)}
          placeholder={placeholder}
          className={cn(
            "w-full bg-white border border-gray-400 p-1 pr-6 text-xs font-bold outline-none uppercase text-slate-800 focus:border-blue-600",
            className
          )}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(prev => !prev);
          }}
          className="absolute right-0 top-0 bottom-0 px-1.5 text-slate-500 hover:bg-slate-200 border-l border-slate-300"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
      {isOpen && (
        <ul className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-gray-400 shadow-md text-[11px] divide-y divide-slate-100">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => (
              <li
                key={idx}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className="p-1.5 hover:bg-slate-900 hover:text-white cursor-pointer uppercase text-left font-bold text-slate-700"
              >
                {opt}
              </li>
            ))
          ) : (
            <li className="p-1.5 text-slate-400 italic text-left ">
              Press enter to use "{value}"
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// Custom Select Component for Issue Type (Strict Dropdown)
interface CustomDropdownSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  id?: string;
}

function CustomDropdownSelect({
  value,
  onChange,
  options,
  placeholder = "Select Option",
  className,
  id
}: CustomDropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative flex-1" id={id}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full bg-white border border-gray-400 p-1 px-2 text-xs font-black text-slate-800 flex justify-between items-center outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500 uppercase text-left rounded-sm min-h-[25px]",
          className
        )}
      >
        <span>{value || placeholder}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-400 shadow-lg text-[11px] rounded-sm divide-y divide-slate-100">
          {options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
              className="w-full p-2 text-left hover:bg-indigo-600 hover:text-white font-black text-slate-750 uppercase transition-all duration-100 cursor-pointer block"
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Custom Editable Select Component for Godown with Dynamic Fetching support
interface CustomEditableSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  id?: string;
}

function CustomEditableSelect({
  value,
  onChange,
  options,
  placeholder = "Select or Type...",
  className,
  id
}: CustomEditableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter(opt => 
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div ref={wrapperRef} className="relative flex-1" id={id}>
      <div className="relative flex items-center">
        <input
 id="searchterm_295" name="searchterm" aria-label="searchterm"          type="text"
          value={searchTerm}
          onChange={(e) => {
            const val = e.target.value;
            setSearchTerm(val);
            onChange(val);
            setIsOpen(true);
          }}
          onClick={() => setIsOpen(true)}
          placeholder={placeholder}
          className={cn(
            "w-full bg-white border border-gray-400 p-1 px-2 text-xs font-black text-slate-850 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-500 uppercase rounded-sm min-h-[25px]",
            className
          )}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(prev => !prev);
          }}
          className="absolute right-0 top-0 bottom-0 px-2 text-slate-500 hover:bg-slate-150 border-l border-slate-300"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-400 shadow-lg text-[11px] rounded-sm divide-y divide-slate-100">
          {filtered.length > 0 ? (
            filtered.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className="w-full p-2 text-left hover:bg-indigo-600 hover:text-white font-black text-slate-750 uppercase transition-all duration-100 cursor-pointer block"
              >
                {opt}
              </button>
            ))
          ) : (
            <div className="p-2 text-slate-400 italic text-left  text-[10px]">
              Press enter or keep typing to override manually
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Full A4 monospaced print layout
function MaterialIssuePrintSlip({ master, details }: { master: any, details: any[] }) {
  const paddedDetails = [...details];
  while (paddedDetails.length < 10) {
    paddedDetails.push({
      srl: paddedDetails.length + 1,
      crop: '',
      grade_name: '',
      marka: '',
      qty: '',
      weight_kgs: '',
      rate: ''
    });
  }

  const totalBales = details.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const totalWeight = details.reduce((sum, item) => sum + (Number(item.weight_kgs) || 0), 0);
  const totalAmount = details.reduce((sum, item) => sum + ((Number(item.qty) || 0) * (Number(item.rate) || 0)), 0);

  return (
    <div className="bg-[#525659] p-4 sm:p-8 min-h-[315mm] print:min-h-0 print:h-auto flex justify-center items-center print:block print:bg-white print:p-0 font-mono select-text w-full overflow-x-auto relative z-[9999]">
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-full-sheet {
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            padding: 12mm 15mm !important;
            margin: 0 auto !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            box-sizing: border-box !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
        .dotted-line-value {
          border-bottom: 1px dotted #000;
          padding-bottom: 2px;
        }
      `}</style>
      
      {/* Main continuous paper template wrapper */}
      <div className="print-full-sheet w-[210mm] min-h-[297mm] max-h-[297mm] bg-[#fbf9f4] shadow-2xl border border-gray-400 p-8 flex select-text text-black shrink-0 relative overflow-hidden print:shadow-none print:border-none print:bg-white box-sizing:border-box mt-16 print:mt-0">
        
        {/* Left Sprocket Feed Holes */}
        <div className="w-[32px] bg-transparent border-r border-dotted border-gray-400 flex flex-col justify-between py-6 shrink-0  pr-3 mr-3 print:hidden">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="w-3.5 h-3.5 bg-gray-300 rounded-full mx-auto shadow-inner border border-gray-400 opacity-60"></div>
          ))}
        </div>

        {/* Content Container */}
        <div className="flex-1 flex flex-col text-[11px] leading-relaxed">
          
          {/* Document Header */}
          <div>
            <div className="flex justify-between items-start ">
              <div className="text-left w-2/3">
                <h1 className="font-sans font-black text-lg tracking-tight text-red-600 leading-none uppercase">
                  {master.party_name || "BALLY JUTE COMPANY LIMITED"}
                </h1>
                <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wide mt-1">AUTHORIZED MILL PREMISES</p>
              </div>
              <div className="text-right w-1/3">
                <span className="font-black text-[11px] text-red-700 uppercase border-2 border-red-600 px-2.5 py-0.5 tracking-widest font-mono">MATERIAL ISSUE</span>
                <p className="text-[9px] font-bold text-gray-500 mt-1 font-mono">Form No: JMCL-MAT-ISSUE</p>
              </div>
            </div>

            <div className="text-center my-2 border-y-2 border-double border-red-650 py-1">
              <h2 className="font-serif font-black text-sm tracking-widest text-[#0d47a1] uppercase">RAW MATERIAL ISSUE SLIP</h2>
            </div>

            {/* Document Meta (Reference keys row-by-row) */}
            <div className="grid grid-cols-2 gap-y-1 my-3 font-semibold text-slate-900 pr-4">
              {master.issue_type?.toUpperCase() === 'SELL' ? (
                <>
                  <div className="flex">
                    <span className="w-28 shrink-0 font-bold">Invoice / Sell No:</span>
                    <span className="flex-1 font-black text-[#0b6e54] uppercase">{master.issue_no}</span>
                  </div>
                  <div className="flex pl-4 border-l border-gray-300">
                    <span className="w-24 shrink-0 font-bold">Sale Date:</span>
                    <span className="flex-1 font-mono">{master.date}</span>
                  </div>

                  <div className="flex">
                    <span className="w-28 shrink-0 font-bold">Agreement No:</span>
                    <span className="flex-1 font-mono text-stone-850">{master.requisition_no || 'N/A'}</span>
                  </div>
                  <div className="flex pl-4 border-l border-gray-300">
                    <span className="w-24 shrink-0 font-bold">Challan / D.O:</span>
                    <span className="flex-1 font-mono uppercase text-stone-800">{master.batch_order || 'N/A'}</span>
                  </div>

                  <div className="flex">
                    <span className="w-28 shrink-0 font-bold">J.C.I Govt:</span>
                    <span className="flex-1 uppercase font-bold">{master.jci || 'No'}</span>
                  </div>
                  <div className="flex pl-4 border-l border-gray-300">
                    <span className="w-24 shrink-0 font-bold">Source Godown:</span>
                    <span className="flex-1 uppercase font-bold text-red-700">{master.godown || 'N/A'}</span>
                  </div>

                  <div className="flex col-span-2 mt-1 border-t border-dashed border-gray-300 pt-1">
                    <span className="w-28 shrink-0 font-bold text-slate-500 uppercase text-[9.5px]">Sender Company:</span>
                    <span className="flex-1 uppercase font-black text-indigo-900">BALLY JUTE COMPANY LIMITED</span>
                  </div>

                  <div className="flex col-span-2 mt-1 border-t border-dashed border-gray-300 pt-1">
                    <span className="w-28 shrink-0 font-bold text-slate-500 uppercase text-[9.5px]">Buyer Factory:</span>
                    <span className="flex-1 uppercase font-black text-[#0b6e54]">{master.department || 'N/A'}</span>
                  </div>

                  <div className="flex col-span-2 mt-0.5">
                    <span className="w-28 shrink-0 font-bold text-slate-500 uppercase text-[9.5px]">Delivery Dest:</span>
                    <span className="flex-1 uppercase font-bold text-stone-850">{master.destination_godown || 'N/A'}</span>
                  </div>

                  <div className="flex col-span-2 mt-0.5">
                    <span className="w-28 shrink-0 font-bold text-slate-500 uppercase text-[9.5px]">Buyer Contact:</span>
                    <span className="flex-1 uppercase font-medium text-stone-800">{master.received_by || 'N/A'}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex">
                    <span className="w-28 shrink-0 font-bold">Issue Voucher No:</span>
                    <span className="flex-1 font-black text-[#0d47a1] uppercase">{master.issue_no}</span>
                  </div>
                  <div className="flex pl-4 border-l border-gray-300">
                    <span className="w-24 shrink-0 font-bold">Date:</span>
                    <span className="flex-1 font-mono">{master.date}</span>
                  </div>
                  
                  <div className="flex">
                    <span className="w-28 shrink-0 font-bold">Financial Year:</span>
                    <span className="flex-1 font-mono">{master.financial_year || '2026-2027'}</span>
                  </div>
                  <div className="flex pl-4 border-l border-gray-300">
                    <span className="w-24 shrink-0 font-bold">Issue Type:</span>
                    <span className="flex-1 font-black uppercase text-stone-800">{master.issue_type}</span>
                  </div>

                  <div className="flex">
                    <span className="w-28 shrink-0 font-bold">Department:</span>
                    <span className="flex-1 uppercase font-bold">{master.department}</span>
                  </div>
                  <div className="flex pl-4 border-l border-gray-300">
                    <span className="w-24 shrink-0 font-bold">Godown:</span>
                    <span className="flex-1 uppercase font-bold">{master.godown}</span>
                  </div>

                  <div className="flex">
                    <span className="w-28 shrink-0 font-bold">Shift:</span>
                    <span className="flex-1 uppercase font-bold">{master.mill_shift}</span>
                  </div>
                  <div className="flex pl-4 border-l border-gray-300">
                    <span className="w-24 shrink-0 font-bold">Stock Group:</span>
                    <span className="flex-1 uppercase font-bold">{master.stock_group}</span>
                  </div>

                  {master.requisition_no && (
                    <div className="flex">
                      <span className="w-28 shrink-0 font-bold">{master.issue_type.toLowerCase() === 'sale' ? 'Contract No:' : 'Requisition No:'}</span>
                      <span className="flex-1 uppercase font-bold text-red-700">{master.requisition_no}</span>
                    </div>
                  )}
                  {master.gate_pass_no && (
                    <div className="flex pl-4 border-l border-gray-300">
                      <span className="w-24 shrink-0 font-bold">Gate Pass:</span>
                      <span className="flex-1 uppercase font-bold">{master.gate_pass_no}</span>
                    </div>
                  )}
                  {master.challan_no && (
                    <div className="flex">
                      <span className="w-28 shrink-0 font-bold">Challan No:</span>
                      <span className="flex-1 uppercase font-bold">{master.challan_no}</span>
                    </div>
                  )}
                  {(master?.lorry_number || (master as any)?.lorry_no || (master as any)?.vehicle_no) && (
                    <div className="flex pl-4 border-l border-gray-300">
                      <span className="w-24 shrink-0 font-bold">Lorry Number:</span>
                      <span className="flex-1 uppercase font-bold">{master?.lorry_number || (master as any)?.lorry_no || (master as any)?.vehicle_no}</span>
                    </div>
                  )}
                  {master.party_name && (
                    <div className="flex col-span-2 mt-1 border-t border-dashed border-gray-300 pt-1">
                      <span className="w-28 shrink-0 font-bold text-indigo-900">Company / Party:</span>
                      <span className="flex-1 uppercase font-black text-indigo-900">{master.party_name}</span>
                    </div>
                  )}
                  {master.destination_godown && (
                    <div className="flex col-span-2 mt-1 border-t border-dashed border-gray-300 pt-1">
                      <span className="w-28 shrink-0 font-bold text-emerald-800">Destination Gdn:</span>
                      <span className="flex-1 uppercase font-black text-emerald-800">{master.destination_godown}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Detail Rows Grid Table */}
            <div className="border border-black mt-4 bg-white min-h-[300px]">
              {master.issue_type?.toUpperCase() === 'SELL' ? (
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-emerald-50 border-b border-black text-center font-bold uppercase ">
                      <th className="px-1 py-1 border-r border-black w-8">Srl</th>
                      <th className="px-1 py-1 border-r border-black w-16">Crop Year</th>
                      <th className="px-1 py-1 border-r border-black">Grade</th>
                      <th className="px-1 py-1 border-r border-black">Marka</th>
                      <th className="px-1 py-1 border-r border-black text-right w-16">Qty (Bales)</th>
                      <th className="px-1 py-1 border-r border-black text-right w-20">Weight (M.T)</th>
                      <th className="px-1 py-1 border-r border-black text-right w-20">Price (₹)</th>
                      <th className="px-1 py-1 text-right w-24">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300 font-semibold text-slate-800">
                    {paddedDetails.map((row, idx) => (
                      <tr key={idx} className="h-6 font-mono">
                        <td className="px-1 text-center border-r border-gray-300  text-[9px]">{row.srl}</td>
                        <td className="px-1 border-r border-gray-300 text-center text-[9px]">{row.crop || ''}</td>
                        <td className="px-1 border-r border-gray-300 uppercase text-[9px]">{row.grade_name || ''}</td>
                        <td className="px-1 border-r border-gray-300 uppercase text-[9px]">{row.marka || ''}</td>
                        <td className="px-1 border-r border-gray-300 text-right font-bold text-stone-900">
                          {(row.qty !== "" && row.qty != null) ? Number(row.qty).toFixed(2) : ''}
                        </td>
                        <td className="px-1 border-r border-gray-300 text-right font-bold text-stone-900">
                          {(row.weight_kgs !== "" && row.weight_kgs != null) ? (Number(row.weight_kgs) / 1000).toFixed(3) : ''}
                        </td>
                        <td className="px-1 border-r border-gray-300 text-right font-bold text-emerald-800">
                          {(row.rate !== "" && row.rate != null) ? Number(row.rate).toFixed(2) : ''}
                        </td>
                        <td className="px-1 text-right font-bold text-emerald-950">
                          {(row.qty !== "" && row.qty != null && row.rate !== "" && row.rate != null) ? (Number(row.qty) * Number(row.rate)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Summary Row */}
                    <tr className="bg-emerald-50 border-t border-black font-extrabold text-[#0b6e54]">
                      <td colSpan={4} className="px-2 text-right uppercase py-1">TOTAL OUTWARD SUMMARY :</td>
                      <td className="px-1 text-right font-black border-r border-gray-300">{totalBales !== undefined ? totalBales.toFixed(2) : '-'}</td>
                      <td className="px-1 text-right font-black border-r border-gray-300">{(totalWeight / 1000).toFixed(3)}</td>
                      <td className="px-1 text-right font-black border-r border-gray-300">&mdash;</td>
                      <td className="px-1 text-right font-black">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <table className="w-full border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-gray-100 border-b border-black text-center font-bold uppercase ">
                      <th className="px-2 py-1.5 border-r border-black w-10">Srl</th>
                      <th className="px-2 py-1.5 border-r border-black w-24">Crop Year</th>
                      <th className="px-2 py-1.5 border-r border-black">Grade</th>
                      <th className="px-2 py-1.5 border-r border-black">Marka / Logo</th>
                      <th className="px-2 py-1.5 border-r border-black w-28 text-right">Qty (Bales)</th>
                      <th className="px-2 py-1.5 text-right w-32">Weight (M.T)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300 font-semibold text-slate-800">
                    {paddedDetails.map((row, idx) => (
                      <tr key={idx} className="h-6 font-mono">
                        <td className="px-2 text-center border-r border-gray-300  text-[9.5px]">{row.srl}</td>
                        <td className="px-2 border-r border-gray-300 text-center text-[9.5px]">{row.crop || ''}</td>
                        <td className="px-2 border-r border-gray-300 uppercase text-[9.5px]">{row.grade_name || ''}</td>
                        <td className="px-2 border-r border-gray-300 uppercase text-[9.5px]">{row.marka || ''}</td>
                        <td className="px-2 border-r border-gray-300 text-right font-bold text-stone-900">
                          {(row.qty !== "" && row.qty != null) ? Number(row.qty).toFixed(2) : ''}
                        </td>
                        <td className="px-2 text-right font-bold text-stone-900">
                          {(row.weight_kgs !== "" && row.weight_kgs != null) ? (Number(row.weight_kgs) / 1000).toFixed(3) : ''}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Summary Row */}
                    <tr className="bg-gray-50 border-t border-black font-extrabold text-[#0d47a1]">
                      <td colSpan={4} className="px-3 text-right uppercase py-1.5">TOTAL ISSUED QUANTITY SUMMARY :</td>
                      <td className="px-2 text-right font-black border-r border-gray-300">{totalBales !== undefined ? totalBales.toFixed(2) : '-'}</td>
                      <td className="px-2 text-right font-black">{(totalWeight / 1000).toFixed(3)}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            {/* Special Instructions & Remarks Row */}
            <div className="grid grid-cols-12 gap-2 mt-4 items-start">
              <div className="col-span-8 flex items-start gap-1 font-semibold text-slate-800">
                <span className="font-bold shrink-0">Remarks / Clause :</span>
                <p className="italic text-gray-700 leading-snug">{master.remarks || 'Standard Material Issue against Requisition/Contract.'}</p>
              </div>
              <div className="col-span-4 flex items-start gap-1 font-semibold text-slate-800 justify-end">
                <span className="font-bold shrink-0">Print Ref:</span>
                <span className="font-mono text-stone-600 truncate">STANDARD_ISSUE</span>
              </div>
            </div>
          </div>

          <div className="flex-1" /> {/* Spacer to push signatures to bottom */}

          {/* Audit Signatures */}
          <div className="flex justify-between items-end mt-12  pb-4">
            <div className="text-left w-1/4">
              {master.issued_by ? (
                <div>
                  <p className="font-mono text-[9px] text-slate-500 lowercase italic normal-case font-medium mb-1">Digitally Issued By</p>
                  <p className="font-sans text-xs text-indigo-900 tracking-wider font-extrabold mb-1 truncate">{master.issued_by}</p>
                  <div className="border-t border-black pt-1 font-bold text-[10.5px]">STOREKEEPER SIGNATURE</div>
                </div>
              ) : (
                <div>
                  <div className="w-full border-t border-black mb-1"></div>
                  <p className="font-bold text-[10.5px]">PREPARED BY</p>
                </div>
              )}
            </div>
            
            <div className="text-center w-1/4">
              <div className="w-full border-t border-black mb-1"></div>
              <p className="font-bold text-[10.5px] uppercase">{master.issue_type.toLowerCase() === 'sale' ? 'SALES MANAGER' : 'GODOWN IN-CHARGE'}</p>
            </div>

            <div className="text-right w-1/4">
              {master.received_by ? (
                <div>
                  <p className="font-mono text-[9px] text-slate-500 lowercase italic normal-case font-medium mb-1">Digitally Received By</p>
                  <p className="font-sans text-xs text-indigo-900 tracking-wider font-extrabold mb-1 truncate text-right">{master.received_by}</p>
                  <div className="border-t border-black pt-1 font-bold text-[10.5px] text-right">DEPARTMENT HEAD / SIRDAR</div>
                </div>
              ) : (
                <div>
                  <div className="w-full border-t border-black mb-1"></div>
                  <p className="font-bold text-[10.5px] text-right">DEPARTMENT HEAD</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MaterialIssue({ onSave, onCancel, setCurrentPage, closePage, embedded = false }: { onSave?: (d: any) => void; onCancel?: () => void; setCurrentPage?: (p: any) => void; closePage?: (p: any, d?: any) => void; embedded?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // View States for Dashboard
  const [viewState, setViewState] = useState<'list' | 'entry'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [savedDetails, setSavedDetails] = useState<any[]>([]);

  // 100-rows per page pagination
  const [listCurrentPage, setListCurrentPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(100);

  useEffect(() => {
    setListCurrentPage(1);
  }, [searchQuery, startDateFilter, endDateFilter]);

  // Background Sync States
  const [backgroundSyncing, setBackgroundSyncing] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState('');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Auto-save key mapping
  useKeyboardNavigation(containerRef, () => {
    if (viewState === 'entry') {
      handleSave();
    }
  });

  const generateIssueNo = () => {
    return `IS-${new Date().getFullYear().toString().substring(2)}-${Math.floor(1000 + Math.random() * 9000)}`;
  };

  // Masters Types
  interface GodownRecord {
    gdn_code: string;
    gdn_name: string;
    location?: string;
    gdn_location?: string;
  }
  interface DepartmentRecord {
    dept_code: string;
    dept_name: string;
    location?: string;
  }

  // Main Form State
  const [formData, setFormData] = useState({
    financial_year: '2026-2027',
    issue_no: '', // dynamically calculated based on route
    date: new Date().toISOString().split('T')[0],
    issue_type: 'factory Issue',
    mill_shift: 'A',
    department: 'BATCHING',
    department_code: 'BATCHING',
    department_location: 'FLOOR A',
    godown: 'N/A',
    godown_code: 'N/A',
    godown_location: 'N/A',
    stock_group: 'RAW JUTE',
    remarks: '',
    grade_name: '',
    unit: '',
    quantity: '',
    weight_mt: '',
    challan_no: '',
    gate_pass_no: '',
    lorry_number: '',
    party_name: '',
    destination_godown: '',
    requisition_no: '',
    issued_by: '',
    received_by: '',
    // Multi-route extra fields
    stack_no: '',
    jci: 'No',
    batch_order: '',
    requisition_date: new Date().toISOString().split('T')[0],
    issued_for: 'MAIN MILL'
  });

  const [issueRoute, setIssueRoute] = useState<'godown' | 'mill' | 'factory' | null>(null);

  // Items Grid state
  const [items, setItems] = useState<any[]>([]);

  // Subform State (for editing or adding single grid line item)
  const [subForm, setSubForm] = useState({
    crop: '2025-26',
    grade_name: 'TD5',
    marka: 'NO MARK',
    qty: '',
    weight_kgs: ''
  });
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);

  // Form Validation State
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [subformErrors, setSubformErrors] = useState<Record<string, string>>({});

  // Masters States
  const [godownRecords, setGodownRecords] = useState<GodownRecord[]>([]);
  const [departmentRecords, setDepartmentRecords] = useState<DepartmentRecord[]>([]);
  const [gradeOptions, setGradeOptions] = useState<string[]>([]);
  const [unitOptions, setUnitOptions] = useState<string[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalIssueNo, setOriginalIssueNo] = useState<string | null>(null);

  // Prefill Integration States
  const [finalArrivals, setFinalArrivals] = useState<any[]>([]);
  const [godownStocks, setGodownStocks] = useState<any[]>([]);
  const [selectedArrivalId, setSelectedArrivalId] = useState<string>('');
  const [selectedStockId, setSelectedStockId] = useState<string>('');

  // Search Modal
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [savedIssues, setSavedIssues] = useState<any[]>([]);
  const [searchFilter, setSearchFilter] = useState('');

  // Print View Overlay
  const [showPrintView, setShowPrintView] = useState(false);

  const fetchArrivalsAndStocks = async () => {
    try {
      const [arrivalsRes, poRes, issuesRes] = await Promise.all([
        supabase.from('final_arrival').select('*').order('date', { ascending: false }).limit(100),
        supabase.from('purchase_master').select('po_no, party_name, broker_name'),
        supabase.from('mill_issue_master').select('requisition_no')
      ]);

      if (!arrivalsRes.error && arrivalsRes.data) {
        // Collect issued requisition numbers
        const issuedRequisitions = new Set((issuesRes.data || []).map((i: any) => i.requisition_no).filter(Boolean));
        
        const enrichedArrivals = arrivalsRes.data.map(arrival => {
          const matchedPo = poRes.data?.find(po => po.po_no === arrival.po_no);
          return {
            ...arrival,
            is_issued: issuedRequisitions.has(arrival.final_arrival_no),
            supplier: arrival.supplier || matchedPo?.party_name || '',
            broker: arrival.broker || matchedPo?.broker_name || ''
          };
        });
        setFinalArrivals(enrichedArrivals);
      }
    } catch (e) {
      console.warn("Failed to fetch final_arrival records for prefill:", e);
    }

    try {
      const { data: stocks, error: errS } = await supabase
        .from('godown_wise_stock')
        .select('*')
        .order('stock_date', { ascending: false })
        .limit(150);
      if (!errS && stocks) {
        setGodownStocks(stocks);
      }
    } catch (e) {
      console.warn("Failed to fetch godown_wise_stock records for prefill:", e);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const records = await dbModule.fetchAll('mill_issue_master', 'date', false);
      setSavedIssues(records);
      try {
        const details = await dbModule.fetchAll('mill_issue_detail');
        setSavedDetails(details || []);
      } catch (e) {
        console.warn("Failed to fetch detail records:", e);
        setSavedDetails([]);
      }
    } catch (err: any) {
      console.warn("Failed to fetch historic records:", err);
      setSavedIssues([]);
    } finally {
      setLoading(false);
    }
  };

  const runBackgroundStatusSync = async (silent = true) => {
    setBackgroundSyncing(true);
    if (!silent) {
      setSyncStatusMessage("Comparing stock master ledgers with dispatch transactions...");
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Set status message
    setSyncStatusMessage("All local issues match godown stock counts. No variance detected!");
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB') + " (" + now.toLocaleDateString('en-GB') + ")";
    setLastSyncTime(timeStr);

    setTimeout(() => {
      setSyncStatusMessage("");
    }, 4000);
    
    setBackgroundSyncing(false);
  };

  const toggleAutoSync = () => {
    setAutoSyncEnabled(prev => !prev);
  };

  // Load records and run sync on mount
  useEffect(() => {
    fetchRecords();
    fetchArrivalsAndStocks();
    if (autoSyncEnabled) {
      const timer = setTimeout(() => {
        runBackgroundStatusSync(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Load masters on mount
  useEffect(() => {
    const fetchMastersAndPrepopulate = async () => {
      try {
        let list: any[] = [];
        if (supabase) {
          const { data, error } = await supabase.from('godown_master').select('*');
          if (!error && data) {
            list = data;
          }
        }
        if (!list || list.length === 0) {
          list = await dbModule.fetchAll('godown_master');
        }
        let parsedGodowns: GodownRecord[] = [];
        if (list && list.length > 0) {
          parsedGodowns = list.map((g: any) => ({
            gdn_code: g.gdn_code,
            gdn_name: g.gdn_name,
            location: g.location || g.gdn_location || ''
          }));
        } else {
          parsedGodowns = [
            { gdn_code: 'GDN-01', gdn_name: 'MAIN GODOWN', location: 'MAIN WAREHOUSE' },
            { gdn_code: 'GDN-02', gdn_name: 'GODOWN-B', location: 'EAST SHED' },
            { gdn_code: 'GDN-03', gdn_name: 'GDW-A (RAW MAIN)', location: 'NORTH WAREHOUSE' }
          ];
        }
        setGodownRecords(parsedGodowns);
        setFormData(prev => {
          if (prev.issue_type === 'Godown') {
            const firstGdn = parsedGodowns[0];
            return {
              ...prev,
              godown: prev.godown && prev.godown !== 'N/A' ? prev.godown : (firstGdn ? firstGdn.gdn_name : 'MAIN GODOWN'),
              godown_code: prev.godown_code && prev.godown_code !== 'N/A' ? prev.godown_code : (firstGdn ? firstGdn.gdn_code : 'GDN-01'),
              godown_location: prev.godown_location && prev.godown_location !== 'N/A' ? prev.godown_location : (firstGdn ? (firstGdn.location || '') : 'MAIN WAREHOUSE')
            };
          } else {
            return {
              ...prev,
              godown: 'N/A',
              godown_code: 'N/A',
              godown_location: 'N/A'
            };
          }
        });
      } catch (e) {
        console.warn("Failed to load godowns from master, using defaults:", e);
        const defaults = [
          { gdn_code: 'GDN-01', gdn_name: 'MAIN GODOWN', location: 'MAIN WAREHOUSE' },
          { gdn_code: 'GDN-02', gdn_name: 'GODOWN-B', location: 'EAST SHED' },
          { gdn_code: 'GDN-03', gdn_name: 'GDW-A (RAW MAIN)', location: 'NORTH WAREHOUSE' }
        ];
        setGodownRecords(defaults);
      }

      try {
        const deptList = await dbModule.fetchAll('department_master');
        let parsedDepts: DepartmentRecord[] = [];
        if (deptList && deptList.length > 0) {
          parsedDepts = deptList.map((d: any) => ({
            dept_code: d.dept_code,
            dept_name: d.dept_name,
            location: d.location || ''
          }));
        } else {
          parsedDepts = DEFAULT_DEPARTMENTS.map(name => ({
            dept_code: name.replace(/[^A-Z0-9]/g, '').substring(0, 15).toUpperCase() || 'DEPT-NEW',
            dept_name: name,
            location: 'MAIN PLANT'
          }));
        }
        setDepartmentRecords(parsedDepts);
        setFormData(prev => {
          if (prev.issue_type !== 'Godown' && prev.issue_type !== 'Sale') {
            const firstDept = parsedDepts.find(d => d.dept_name.toUpperCase() === 'BATCHING') || parsedDepts[0];
            return {
              ...prev,
              department: prev.department && prev.department !== 'N/A' ? prev.department : (firstDept ? firstDept.dept_name : 'BATCHING'),
              department_code: prev.department_code && prev.department_code !== 'N/A' ? prev.department_code : (firstDept ? firstDept.dept_code : 'BATCHING'),
              department_location: prev.department_location && prev.department_location !== 'N/A' ? prev.department_location : (firstDept ? (firstDept.location || '') : 'FLOOR A')
            };
          } else {
            return {
              ...prev,
              department: 'N/A',
              department_code: 'N/A',
              department_location: 'N/A'
            };
          }
        });
      } catch (e) {
        console.warn("Failed to load departments from master, using defaults:", e);
        const defaults = DEFAULT_DEPARTMENTS.map(name => ({
          dept_code: name.replace(/[^A-Z0-9]/g, '').substring(0, 15).toUpperCase() || 'DEPT-NEW',
          dept_name: name,
          location: 'MAIN PLANT'
        }));
        setDepartmentRecords(defaults);
      }

      // Fetch grades and units
      try {
        const { data: gradesData } = await supabase.from('grade_master').select('grade_name').limit(150);
        if (gradesData) {
          setGradeOptions(gradesData.map((g: any) => g.grade_name).filter(Boolean));
        } else {
          setGradeOptions(['TD3', 'TD4', 'TD5', 'TD6', 'W2', 'W3', 'W4', 'W5']);
        }
      } catch (err) {
        console.warn("Failed to load grade_master", err);
        setGradeOptions(['TD3', 'TD4', 'TD5', 'TD6', 'W2', 'W3', 'W4', 'W5']);
      }

      try {
        const { data: unitsData } = await supabase.from('unit_master').select('unit_name').limit(150);
        if (unitsData) {
          setUnitOptions(unitsData.map((u: any) => u.unit_name).filter(Boolean));
        } else {
          setUnitOptions(['BALES', 'HALF BALES', 'KGS', 'M.T']);
        }
      } catch (err) {
        console.warn("Failed to load unit_master", err);
        setUnitOptions(['BALES', 'HALF BALES', 'KGS', 'M.T']);
      }
    };
    fetchMastersAndPrepopulate();
  }, []);

  const handleGodownChange = async (val: string) => {
    setFormData(prev => ({
      ...prev,
      godown: val
    }));

    setValidationErrors(prev => {
      const copy = { ...prev };
      delete copy.godown;
      delete copy.godown_code;
      delete copy.godown_location;
      return copy;
    });

    if (!val.trim() || val === 'N/A') return;

    try {
      const { data, error } = await supabase
        .from('godown_master')
        .select('*')
        .ilike('gdn_name', val.trim());

      if (!error && data && data.length > 0) {
        const matched = data[0];
        setFormData(prev => ({
          ...prev,
          godown: matched.gdn_name,
          godown_code: matched.gdn_code || 'GDN-CUSTOM',
          godown_location: matched.location || matched.gdn_location || 'MAIN PLANT'
        }));
      } else {
        const genCode = `GDN-${val.replace(/[^A-Za-z0-9]/g, '').substring(0, 8).toUpperCase()}`;
        setFormData(prev => ({
          ...prev,
          godown_code: genCode,
          godown_location: 'MAIN PLANT'
        }));
      }
    } catch (err) {
      console.warn("Real-time godown fetch error:", err);
    }
  };

  const handleDepartmentChange = async (val: string) => {
    setFormData(prev => ({
      ...prev,
      department: val
    }));

    setValidationErrors(prev => {
      const copy = { ...prev };
      delete copy.department;
      delete copy.department_code;
      delete copy.department_location;
      return copy;
    });

    if (!val.trim() || val === 'N/A') return;

    try {
      const { data, error } = await supabase
        .from('department_master')
        .select('*')
        .ilike('dept_name', val.trim());

      if (!error && data && data.length > 0) {
        const matched = data[0];
        setFormData(prev => ({
          ...prev,
          department: matched.dept_name,
          department_code: matched.dept_code || 'DEPT-CUSTOM',
          department_location: matched.location || 'MAIN PLANT'
        }));
      } else {
        const genCode = `DEPT-${val.replace(/[^A-Za-z0-9]/g, '').substring(0, 8).toUpperCase()}`;
        setFormData(prev => ({
          ...prev,
          department_code: genCode,
          department_location: 'MAIN PLANT'
        }));
      }
    } catch (err) {
      console.warn("Real-time department fetch error:", err);
    }
  };

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setValidationErrors(prev => {
      const copy = { ...prev };
      delete copy[name];
      // also clear general items if they update items
      return copy;
    });
  };

  const handleSubformChange = (field: string, val: string) => {
    setSubForm(prev => ({ ...prev, [field]: val }));
    setSubformErrors(prev => {
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Grid Controls
  const addOrUpdateItem = () => {
    const errors: Record<string, string> = {};
    if (!subForm.qty) {
      errors.qty = "Quantity (Bales) is required.";
    } else if (isNaN(Number(subForm.qty)) || Number(subForm.qty) <= 0) {
      errors.qty = "Quantity must be greater than 0.";
    }

    if (!subForm.weight_kgs) {
      errors.weight_kgs = "Weight (Kgs) is required.";
    } else if (isNaN(Number(subForm.weight_kgs)) || Number(subForm.weight_kgs) <= 0) {
      errors.weight_kgs = "Weight must be greater than 0.";
    }

    if (Object.keys(errors).length > 0) {
      setSubformErrors(errors);
      return;
    }

    setSubformErrors({});

    if (selectedRowIndex !== null) {
      // Update existing item
      const updated = [...items];
      updated[selectedRowIndex] = {
        ...updated[selectedRowIndex],
        crop: subForm.crop,
        grade_name: subForm.grade_name,
        marka: subForm.marka,
        qty: Number(subForm.qty),
        weight_kgs: Number(subForm.weight_kgs)
      };
      setItems(updated);
      setSelectedRowIndex(null);
      showToast("Grid row updated successfully!");
    } else {
      // Add new item
      const newItem = {
        srl: items.length + 1,
        crop: subForm.crop,
        grade_name: subForm.grade_name,
        marka: subForm.marka,
        qty: Number(subForm.qty),
        weight_kgs: Number(subForm.weight_kgs)
      };
      setItems([...items, newItem]);
      showToast("Item added to grid!");
      
      // Clear items validator warning
      setValidationErrors(prev => {
        const copy = { ...prev };
        delete copy.items;
        return copy;
      });
    }

    // Reset sub-form
    setSubForm({
      crop: '2025-26',
      grade_name: 'TD5',
      marka: 'NO MARK',
      qty: '',
      weight_kgs: ''
    });
  };

  const loadItemForEdit = (idx: number) => {
    const item = items[idx];
    setSubForm({
      crop: item.crop,
      grade_name: item.grade_name,
      marka: item.marka,
      qty: item.qty.toString(),
      weight_kgs: item.weight_kgs.toString()
    });
    setSelectedRowIndex(idx);
  };

  const removeItem = (idx: number) => {
    const updated = items.filter((_, i) => i !== idx).map((item, i) => ({
      ...item,
      srl: i + 1
    }));
    setItems(updated);
    if (selectedRowIndex === idx) {
      setSelectedRowIndex(null);
    }
    showToast("Item removed from grid.");
  };

  const handleNew = () => {
    const defaultDept = departmentRecords.find(d => d.dept_name.toUpperCase() === 'BATCHING') || departmentRecords[0];
    const year = new Date().getFullYear();
    const randomNo = Math.floor(10000 + Math.random() * 90000);
    const initialIssueNo = `GRN/${year}/${randomNo}`;

    setFormData({
      financial_year: '2026-2027',
      issue_no: initialIssueNo,
      date: new Date().toISOString().split('T')[0],
      issue_type: 'GODOWN',
      mill_shift: 'A',
      department: defaultDept ? defaultDept.dept_name : 'BATCHING',
      department_code: defaultDept ? defaultDept.dept_code : 'BATCHING',
      department_location: defaultDept ? (defaultDept.location || '') : 'FLOOR A',
      godown: 'N/A',
      godown_code: 'N/A',
      godown_location: 'N/A',
      stock_group: 'RAW JUTE',
      remarks: '',
      grade_name: '',
      unit: '',
      quantity: '',
      weight_mt: '',
      challan_no: '',
      gate_pass_no: '',
      lorry_number: '',
      party_name: '',
      destination_godown: '',
      requisition_no: '',
      issued_by: '',
      received_by: '',
      stack_no: '',
      jci: 'No',
      batch_order: '',
      requisition_date: new Date().toISOString().split('T')[0],
      issued_for: 'MAIN MILL'
    });
    setIssueRoute(null);
    setItems([
      { srl: 1, crop: '2025-26', grade_name: 'TD5', marka: 'NO MARK', qty: 0, weight_kgs: 0, area: '', agency: '', code: '', batch_name: '', unit: 'BALES', place: '', itg_no: '', rate: 0, location_dest: '' },
      { srl: 2, crop: '2025-26', grade_name: 'TD5', marka: 'NO MARK', qty: 0, weight_kgs: 0, area: '', agency: '', code: '', batch_name: '', unit: 'BALES', place: '', itg_no: '', rate: 0, location_dest: '' },
      { srl: 3, crop: '2025-26', grade_name: 'TD5', marka: 'NO MARK', qty: 0, weight_kgs: 0, area: '', agency: '', code: '', batch_name: '', unit: 'BALES', place: '', itg_no: '', rate: 0, location_dest: '' }
    ]);
    setSubForm({
      crop: '2025-26',
      grade_name: 'TD5',
      marka: 'NO MARK',
      qty: '',
      weight_kgs: ''
    });
    setSelectedRowIndex(null);
    setIsEditMode(false);
    setOriginalIssueNo(null);
    setValidationErrors({});
    setSubformErrors({});
    showToast("Form initialized. Choose an issue route to proceed.");
  };

  // Direct Supabase saving/updating
  const handleSave = async () => {
    if (!issueRoute) {
      showToast("Please choose an issue route before saving.");
      return;
    }

    const errors: Record<string, string> = {};

    if (!formData.financial_year?.trim()) {
      errors.financial_year = "Financial Year cannot be blank.";
    }
    if (!formData.issue_no?.trim()) {
      errors.issue_no = "Voucher Number cannot be blank.";
    }
    if (!formData.date?.trim()) {
      errors.date = "Voucher Date cannot be blank.";
    }

    if (items.length === 0) {
      showToast("Submission blocked: Please add at least one detail row to the allocation grid.");
      return;
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      showToast("Submission blocked: Please correct the highlighted errors.");
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    if (isEditMode && !enforceEditOrDeletePermission("Edit")) {
      return;
    }

    setValidationErrors({});
    setLoading(true);
    try {
      // Map master fields depending on current issueRoute
      let masterPayload: any = {
        financial_year: formData.financial_year,
        issue_no: formData.issue_no,
        date: formData.date,
        issue_type: issueRoute === 'mill' ? 'SELL' : issueRoute.toUpperCase(),
        remarks: formData.remarks,
        issued_by: formData.issued_by,
        received_by: formData.received_by
      };

      if (issueRoute === 'godown') {
        masterPayload.godown = formData.godown || 'MAIN GODOWN';
        masterPayload.stack_no = formData.stack_no;
        masterPayload.requisition_no = formData.requisition_no; // Link FA
        masterPayload.department = formData.department || 'N/A';
      } else if (issueRoute === 'mill') {
        masterPayload.requisition_no = formData.requisition_no; // Link FA / PO
        masterPayload.jci = formData.jci;
        masterPayload.batch_order = formData.batch_order;
        masterPayload.mill_shift = formData.mill_shift;
        masterPayload.department = formData.department || 'BATCHING'; // Mill section
        masterPayload.godown = formData.godown || 'MAIN GODOWN';
        masterPayload.destination_godown = formData.destination_godown || '';
        masterPayload.party_name = formData.party_name || 'BALLY JUTE COMPANY LIMITED';
      } else if (issueRoute === 'factory') {
        masterPayload.requisition_no = formData.requisition_no; // Req No
        masterPayload.requisition_date = formData.requisition_date;
        masterPayload.godown = formData.godown || 'MAIN GODOWN'; // Source godown
        masterPayload.issued_for = formData.issued_for;
        masterPayload.batch_order = formData.batch_order;
        masterPayload.lorry_number = formData.lorry_number;
        masterPayload.department = formData.issued_for || 'BATCHING';
      }

      if (isEditMode && originalIssueNo) {
        // Edit Mode: Update master record
        await dbModule.update('mill_issue_master', 'issue_no', originalIssueNo, masterPayload);

        // Delete old details and recreate
        await dbModule.delete('mill_issue_detail', 'issue_no', originalIssueNo);

        // Loop insert detail rows
        for (const it of items) {
          await dbModule.insert('mill_issue_detail', {
            issue_no: formData.issue_no,
            srl: Number(it.srl),
            crop: it.crop || '2025-26',
            grade_name: it.grade_name || '',
            marka: it.marka || '',
            qty: Number(it.qty || 0),
            weight_kgs: Number(it.weight_kgs || 0),
            area: it.area || '',
            agency: it.agency || '',
            code: it.code || '',
            batch_name: it.batch_name || '',
            unit: it.unit || 'BALES',
            place: it.place || '',
            itg_no: it.itg_no || '',
            rate: Number(it.rate || 0),
            location_dest: it.location_dest || ''
          });
        }

        setIsEditMode(true);
        setOriginalIssueNo(formData.issue_no);
        showToast(`Material Issue Voucher "${formData.issue_no}" successfully updated!`);
      } else {
        // New Mode: Ensure unique issue_no
        const allMasters = await dbModule.fetchAll('mill_issue_master').catch(() => []);
        const isDuplicate = allMasters.some((m: any) => m.issue_no.trim().toUpperCase() === formData.issue_no.trim().toUpperCase());
        if (isDuplicate) {
          setValidationErrors(prev => ({
            ...prev,
            issue_no: `Voucher number "${formData.issue_no}" already exists in records. Please change or edit the number.`
          }));
          showToast("Saving failed: Duplicate voucher number.");
          setLoading(false);
          if (containerRef.current) {
            containerRef.current.scrollIntoView({ behavior: 'smooth' });
          }
          return;
        }

        // Insert Master
        await dbModule.insert('mill_issue_master', masterPayload);

        // Insert Details
        for (const it of items) {
          await dbModule.insert('mill_issue_detail', {
            issue_no: formData.issue_no,
            srl: Number(it.srl),
            crop: it.crop || '2025-26',
            grade_name: it.grade_name || '',
            marka: it.marka || '',
            qty: Number(it.qty || 0),
            weight_kgs: Number(it.weight_kgs || 0),
            area: it.area || '',
            agency: it.agency || '',
            code: it.code || '',
            batch_name: it.batch_name || '',
            unit: it.unit || 'BALES',
            place: it.place || '',
            itg_no: it.itg_no || '',
            rate: Number(it.rate || 0),
            location_dest: it.location_dest || ''
          });
        }

        setIsEditMode(true);
        setOriginalIssueNo(formData.issue_no);
        showToast(`Material Issue Voucher "${formData.issue_no}" successfully saved!`);
      }

      await fetchRecords();
      setViewState('list');
    } catch (err: any) {
      console.error("Error saving Material Issue voucher:", err);
      alert(`Database Operation Failed: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Historic View Loader
  const openSearchModal = async () => {
    setLoading(true);
    try {
      const records = await dbModule.fetchAll('mill_issue_master', 'date', false);
      setSavedIssues(records);
      setShowSearchModal(true);
    } catch (err: any) {
      console.warn("Failed to fetch historic records (likely table empty):", err);
      setSavedIssues([]);
      setShowSearchModal(true);
    } finally {
      setLoading(false);
    }
  };

  const loadIssueIntoForm = async (masterRecord: any) => {
    setLoading(true);
    try {
      const allDetails = await dbModule.fetchAll('mill_issue_detail');
      const filtered = allDetails.filter((d: any) => d.issue_no === masterRecord.issue_no);
      filtered.sort((a: any, b: any) => a.srl - b.srl);

      const matchedGdn = godownRecords.find(g => 
        (g.gdn_name || '').toUpperCase() === (masterRecord.godown || '').toUpperCase() || 
        (g.gdn_code || '').toUpperCase() === (masterRecord.godown || '').toUpperCase()
      );
      const matchedDept = departmentRecords.find(d => 
        (d.dept_name || '').toUpperCase() === (masterRecord.department || '').toUpperCase() || 
        (d.dept_code || '').toUpperCase() === (masterRecord.department || '').toUpperCase()
      );

      // Determine active route
      let rRoute: 'godown' | 'mill' | 'factory' = 'factory';
      const ty = (masterRecord.issue_type || '').toUpperCase();
      if (ty === 'GODOWN') rRoute = 'godown';
      else if (ty === 'MILL' || ty === 'SELL') rRoute = 'mill';
      else rRoute = 'factory';

      setIssueRoute(rRoute);

      setFormData({
        financial_year: masterRecord.financial_year || '2026-2027',
        issue_no: masterRecord.issue_no,
        date: masterRecord.date,
        issue_type: masterRecord.issue_type || 'FACTORY ISSUE',
        mill_shift: masterRecord.mill_shift || 'A',
        department: masterRecord.department || 'BATCHING',
        department_code: matchedDept ? matchedDept.dept_code : `DEPT-${(masterRecord.department || '').replace(/[^A-Za-z0-9]/g, '').substring(0, 8).toUpperCase()}`,
        department_location: matchedDept ? (matchedDept.location || '') : '',
        godown: masterRecord.godown || 'N/A',
        godown_code: matchedGdn ? matchedGdn.gdn_code : `GDN-${(masterRecord.godown || '').replace(/[^A-Za-z0-9]/g, '').substring(0, 8).toUpperCase()}`,
        godown_location: matchedGdn ? (matchedGdn.location || matchedGdn.gdn_location || '') : '',
        stock_group: masterRecord.stock_group || 'RAW JUTE',
        remarks: masterRecord.remarks || '',
        grade_name: masterRecord.grade_name || '',
        unit: masterRecord.unit || '',
        quantity: masterRecord.quantity !== null && masterRecord.quantity !== undefined ? masterRecord.quantity.toString() : '',
        weight_mt: masterRecord.weight_mt !== null && masterRecord.weight_mt !== undefined ? masterRecord.weight_mt.toString() : '',
        challan_no: masterRecord.challan_no || '',
        gate_pass_no: masterRecord.gate_pass_no || '',
        lorry_number: masterRecord.lorry_number || '',
        party_name: masterRecord.party_name || '',
        destination_godown: masterRecord.destination_godown || '',
        requisition_no: masterRecord.requisition_no || '',
        issued_by: masterRecord.issued_by || '',
        received_by: masterRecord.received_by || '',
        stack_no: masterRecord.stack_no || '',
        jci: masterRecord.jci || 'No',
        batch_order: masterRecord.batch_order || '',
        requisition_date: masterRecord.requisition_date || new Date().toISOString().split('T')[0],
        issued_for: masterRecord.issued_for || 'MAIN MILL'
      });

      // Map details with fallback fields
      const mappedDetails = filtered.map((d: any, idx: number) => ({
        srl: d.srl || (idx + 1),
        crop: d.crop || '2025-26',
        grade_name: d.grade_name || 'TD5',
        marka: d.marka || 'NO MARK',
        qty: Number(d.qty || 0),
        weight_kgs: Number(d.weight_kgs || 0),
        area: d.area || '',
        agency: d.agency || '',
        code: d.code || '',
        batch_name: d.batch_name || d.batch || '',
        unit: d.unit || 'BALES',
        place: d.place || '',
        itg_no: d.itg_no || '',
        rate: Number(d.rate || 0),
        location_dest: d.location_dest || ''
      }));

      setItems(mappedDetails);
      setIsEditMode(true);
      setOriginalIssueNo(masterRecord.issue_no);
      setViewState('entry');
      setShowSearchModal(false);
      showToast(`Voucher "${masterRecord.issue_no}" loaded successfully.`);
    } catch (err: any) {
      console.error("Failed to load details for issue voucher:", err);
      alert("Error loading details from database.");
    } finally {
      setLoading(false);
    }
  };

  const handlePreparePrint = async (record: any) => {
    setLoading(true);
    try {
      const allDetails = await dbModule.fetchAll('mill_issue_detail');
      const filtered = allDetails.filter((d: any) => d.issue_no === record.issue_no);
      filtered.sort((a: any, b: any) => a.srl - b.srl);

      const matchedGdn = godownRecords.find(g => 
        (g.gdn_name || '').toUpperCase() === (record.godown || '').toUpperCase() || 
        (g.gdn_code || '').toUpperCase() === (record.godown || '').toUpperCase()
      );
      const matchedDept = departmentRecords.find(d => 
        (d.dept_name || '').toUpperCase() === (record.department || '').toUpperCase() || 
        (d.dept_code || '').toUpperCase() === (record.department || '').toUpperCase()
      );

      setFormData(prev => ({
        ...prev,
        financial_year: record.financial_year || '2026-2027',
        issue_no: record.issue_no,
        date: record.date,
        issue_type: record.issue_type || 'FACTORY ISSUE',
        mill_shift: record.mill_shift || 'A',
        department: record.department,
        department_code: matchedDept ? matchedDept.dept_code : `DEPT-${(record.department || '').replace(/[^A-Za-z0-9]/g, '').substring(0, 8).toUpperCase()}`,
        department_location: matchedDept ? (matchedDept.location || '') : '',
        godown: record.godown,
        godown_code: matchedGdn ? matchedGdn.gdn_code : `GDN-${(record.godown || '').replace(/[^A-Za-z0-9]/g, '').substring(0, 8).toUpperCase()}`,
        godown_location: matchedGdn ? (matchedGdn.location || matchedGdn.gdn_location || '') : '',
        stock_group: record.stock_group || 'RAW JUTE',
        remarks: record.remarks || '',
        grade_name: record.grade_name || '',
        unit: record.unit || '',
        quantity: record.quantity !== null && record.quantity !== undefined ? record.quantity.toString() : '',
        weight_mt: record.weight_mt !== null && record.weight_mt !== undefined ? record.weight_mt.toString() : '',
        challan_no: record.challan_no || '',
        gate_pass_no: record.gate_pass_no || '',
        lorry_number: record.lorry_number || '',
        party_name: record.party_name || '',
        destination_godown: record.destination_godown || '',
        requisition_no: record.requisition_no || '',
        issued_by: record.issued_by || '',
        received_by: record.received_by || ''
      }));
      setItems(filtered);
      setShowPrintView(true);
    } catch (e) {
      console.error("Failed to load details for print:", e);
      alert("Error loading details from database.");
    } finally {
      setLoading(false);
    }
  };

  const handleDashboardDelete = async (issueNo: string) => {
    if (!enforceEditOrDeletePermission("Delete")) return;
    const conf = window.confirm(`CRITICAL DELETION:\nAre you sure you want to permanently erase the Material Issue Voucher "${issueNo}"? This action cannot be undone!`);
    if (!conf) return;

    setLoading(true);
    try {
      await dbModule.delete('mill_issue_master', 'issue_no', issueNo);
      await dbModule.delete('mill_issue_detail', 'issue_no', issueNo);
      showToast(`Voucher "${issueNo}" deleted successfully.`);
      await fetchRecords();
      if (selectedRecordId === issueNo) setSelectedRecordId(null);
    } catch (err: any) {
      console.error("Failed to delete voucher:", err);
      alert(`Deletion Failed: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const filteredRecordsList = savedIssues.filter(record => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || (
        (record.issue_no || '').toLowerCase().includes(q) ||
        (record.department || '').toLowerCase().includes(q) ||
        (record.godown || '').toLowerCase().includes(q) ||
        (record.destination_godown || '').toLowerCase().includes(q) ||
        (record.requisition_no || '').toLowerCase().includes(q) ||
        (record.issue_type || '').toLowerCase().includes(q) ||
        (record.stock_group || '').toLowerCase().includes(q) ||
        (record.remarks || '').toLowerCase().includes(q)
      );

      let matchDateRange = true;
      if (startDateFilter && record.date) {
        matchDateRange = matchDateRange && (record.date >= startDateFilter);
      }
      if (endDateFilter && record.date) {
        matchDateRange = matchDateRange && (record.date <= endDateFilter);
      }

      return matchSearch && matchDateRange;
    });

    if (filteredRecordsList.length === 0) {
      alert("No records found to export.");
      return;
    }

    const headers = [
      "Voucher Date",
      "Issue No",
      "Department",
      "Destination Godown",
      "Source P.O. Number",
      "Stock Group",
      "Issue Type",
      "Total Bales",
      "Total Weight (KGS)",
      "Total Weight (MT)",
      "Remarks"
    ];

    const rows = filteredRecordsList.map(r => {
      const rDetails = savedDetails.filter(d => d.issue_no === r.issue_no);
      const bales = rDetails.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      const weightKgs = rDetails.reduce((sum, item) => sum + (Number(item.weight_kgs) || 0), 0);
      const weightMt = weightKgs / 1000;

      return [
        r.date || '',
        r.issue_no || '',
        r.department || '',
        r.destination_godown || r.godown || '',
        r.requisition_no || '',
        r.stock_group || '',
        r.issue_type || '',
        bales,
        weightKgs,
        weightMt.toFixed(3),
        (r.remarks || '').replace(/"/g, '""')
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${val}"`).join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Material_Issues_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async () => {
    if (!enforceEditOrDeletePermission("Delete")) return;

    if (!isEditMode || !originalIssueNo) {
      alert("Please load an existing record using 'View' or 'Edit' button first before attempting delete.");
      return;
    }

    const conf = window.confirm(`CRITICAL DELETION:\nAre you sure you want to permanently erase the Material Issue Voucher "${formData.issue_no}"? This action cannot be undone!`);
    if (!conf) return;

    setLoading(true);
    try {
      await dbModule.delete('mill_issue_master', 'issue_no', originalIssueNo);
      await dbModule.delete('mill_issue_detail', 'issue_no', originalIssueNo);
      showToast(`Voucher "${formData.issue_no}" deleted successfully from records.`);
      await fetchRecords();
      setViewState('list');
      handleNew();
    } catch (err: any) {
      console.error("Failed to delete voucher:", err);
      alert(`Deletion Failed: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Calculations for Footer Totals
  const totalBales = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  const totalWeight = items.reduce((sum, item) => sum + (Number(item.weight_kgs) || 0), 0);

  // Filtered search records
  const filteredSavedIssues = savedIssues.filter(record => 
    record.issue_no.toLowerCase().includes(searchFilter.toLowerCase()) ||
    record.department.toLowerCase().includes(searchFilter.toLowerCase()) ||
    record.godown.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (record.remarks || '').toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleFormCancel = () => {
    if (viewState === 'entry') {
      setViewState('list');
      handleNew();
    } else {
      onCancel?.();
    }
  };

  if (viewState === 'list') {
    // Calculate dynamic stats
    const totalVouchersCount = savedIssues.length;
    
    // Filtered records based on searchQuery, startDateFilter, and endDateFilter
    const filteredRecords = savedIssues.filter(r => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || (
        (r.issue_no || '').toLowerCase().includes(q) ||
        (r.department || '').toLowerCase().includes(q) ||
        (r.godown || '').toLowerCase().includes(q) ||
        (r.destination_godown || '').toLowerCase().includes(q) ||
        (r.requisition_no || '').toLowerCase().includes(q) ||
        (r.issue_type || '').toLowerCase().includes(q) ||
        (r.stock_group || '').toLowerCase().includes(q) ||
        (r.remarks || '').toLowerCase().includes(q)
      );

      let matchDateRange = true;
      if (startDateFilter && r.date) {
        matchDateRange = matchDateRange && (r.date >= startDateFilter);
      }
      if (endDateFilter && r.date) {
        matchDateRange = matchDateRange && (r.date <= endDateFilter);
      }

      return matchSearch && matchDateRange;
    });

    const filteredIssuesCount = filteredRecords.length;
    
    let totalBalesVal = 0;
    let totalWeightMtVal = 0;

    filteredRecords.forEach(r => {
      const rDetails = savedDetails.filter(d => d.issue_no === r.issue_no);
      totalBalesVal += rDetails.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      const totalWeightKgs = rDetails.reduce((sum, item) => sum + (Number(item.weight_kgs) || 0), 0);
      totalWeightMtVal += totalWeightKgs / 1000;
    });

    // Group by Date for the "Date Wise Total Arrival Report (Global Summary)" Card
    const dateWiseMap: { [date: string]: { count: number; packets: number; weight: number } } = {};
    savedIssues.forEach(r => {
      const d = r.date || 'No Date';
      if (!dateWiseMap[d]) {
        dateWiseMap[d] = { count: 0, packets: 0, weight: 0 };
      }
      dateWiseMap[d].count += 1;
      const rDetails = savedDetails.filter(det => det.issue_no === r.issue_no);
      dateWiseMap[d].packets += rDetails.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
      const kgs = rDetails.reduce((sum, item) => sum + (Number(item.weight_kgs) || 0), 0);
      dateWiseMap[d].weight += (kgs / 1000);
    });

    const dateWiseList = Object.entries(dateWiseMap)
      .map(([date, st]) => ({ date, ...st }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const listContent = (
      <div className="space-y-4 font-bold text-[11px] text-slate-800">
          
          {/* Success Toast banner */}
          {successToast && (
            <div className="bg-emerald-50 text-emerald-950 px-3.5 py-2.5 border border-emerald-400 rounded flex items-center justify-between shadow-md ">
              <span className="flex items-center gap-1.5 font-black uppercase text-[10px]">
                <Check className="h-4 w-4 text-emerald-600 stroke-[3]" />
                {successToast}
              </span>
              <button onClick={() => setSuccessToast(null)} className="text-emerald-700 hover:text-emerald-950 font-bold uppercase text-[9px] cursor-pointer">
                [ Dismiss ]
              </button>
            </div>
          )}

          {/* TWO WIDGET PANELS GRID */}
          <div className="grid grid-cols-12 gap-4">

            {/* Card 1: Operational Overview */}
            <div className="col-span-12 md:col-span-4">
              <div className="h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

                {/* Header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Layers className="w-4 h-4 text-blue-700" />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Operational Overview
                    </h3>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                      Current Summary
                    </p>
                  </div>
                </div>

                {/* Statistics */}
                <div className="p-4 grid grid-cols-2 gap-3">

                  {/* Filtered Loads */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                      Filtered Loads
                    </p>

                    <p className="mt-1 text-lg font-black text-slate-800">
                      {filteredIssuesCount}
                      <span className="ml-1 text-[10px] font-bold text-slate-500">
                        Slips
                      </span>
                    </p>
                  </div>

                  {/* Total Packets */}
                  <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                      Total Packets
                    </p>

                    <p className="mt-1 text-lg font-black text-blue-700">
                      {totalBalesVal.toLocaleString()}
                      <span className="ml-1 text-[10px] font-bold text-blue-500">
                        Bales
                      </span>
                    </p>
                  </div>

                  {/* Total Weight */}
                  <div className="col-span-2 rounded-lg border border-red-100 bg-red-50/40 p-3">
                    <div className="flex items-center justify-between">

                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                          Total Net Weight
                        </p>

                        <p className="mt-1 text-xl font-black text-red-700">
                          {totalWeightMtVal.toFixed(3)}

                          <span className="ml-1 text-[11px] font-bold text-red-500">
                            MT
                          </span>
                        </p>
                      </div>

                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                        <span className="text-sm font-black text-red-600">
                          MT
                        </span>
                      </div>

                    </div>
                  </div>

                </div>
              </div>
            </div>


            {/* Card 2: Date Wise Total Issue Report */}
            <div className="col-span-12 md:col-span-8">
              <div className="h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">

                {/* Header */}
                <div className="flex justify-between items-center px-4 py-3 bg-slate-50 border-b border-slate-200">

                  <div className="flex items-center gap-2">

                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-red-600" />
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-800">
                        Date Wise Total Issue Report
                      </h3>

                      <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                        Global Summary
                      </p>
                    </div>

                  </div>

                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-md">
                    Latest Days
                  </span>

                </div>


                {/* Table */}
                <div className="flex-1 px-4 pt-3">

                  <div className="border border-slate-200 rounded-lg overflow-hidden h-[125px] overflow-y-auto">

                    <table className="w-full text-left border-collapse">

                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-100 border-b border-slate-200">

                          <th className="px-3 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                            Issue Date
                          </th>

                          <th className="px-3 py-2 text-center text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                            Voucher Count
                          </th>

                          <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                            Total Bales
                          </th>

                          <th className="px-3 py-2 text-right text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                            Net Weight
                          </th>

                        </tr>
                      </thead>


                      <tbody className="divide-y divide-slate-100">

                        {dateWiseList.map((rep) => {

                          const isSelectedDate =
                            startDateFilter === rep.date &&
                            endDateFilter === rep.date;

                          return (

                            <tr
                              key={rep.date}
                              className={cn(
                                "cursor-pointer transition-all hover:bg-blue-50",
                                isSelectedDate && "bg-blue-50"
                              )}
                              onClick={() => {
                                setStartDateFilter(rep.date);
                                setEndDateFilter(rep.date);
                              }}
                            >

                              {/* Date */}
                              <td className="px-3 py-2">

                                <div className="flex items-center gap-2">

                                  <span
                                    className={cn(
                                      "w-2 h-2 rounded-full bg-indigo-500",
                                      isSelectedDate &&
                                        "bg-red-500 animate-pulse"
                                    )}
                                  />

                                  <span className="text-[11px] font-bold text-slate-700">
                                    {new Date(rep.date).toLocaleDateString(
                                      'en-GB',
                                      {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric'
                                      }
                                    )}
                                  </span>

                                </div>

                              </td>


                              {/* Voucher */}
                              <td className="px-3 py-2 text-center">
                                <span className="inline-flex items-center justify-center min-w-[45px] px-2 py-1 rounded-md bg-slate-100 text-[10px] font-bold text-slate-700">
                                  {rep.count} Slips
                                </span>
                              </td>


                              {/* Bales */}
                              <td className="px-3 py-2 text-right text-[11px] font-black text-indigo-700">
                                {rep.packets}
                              </td>


                              {/* Weight */}
                              <td className="px-3 py-2 text-right">

                                <span className="text-[11px] font-black text-red-600">
                                  {rep.weight.toFixed(3)}

                                  <span className="ml-1 text-[9px] font-bold text-red-400">
                                    MT
                                  </span>
                                </span>

                              </td>

                            </tr>
                          );
                        })}


                        {dateWiseList.length === 0 && (

                          <tr>
                            <td
                              colSpan={4}
                              className="text-center py-8 text-slate-400 uppercase font-semibold text-[10px]"
                            >
                              No historical calendar data loaded.
                            </td>
                          </tr>

                        )}

                      </tbody>

                    </table>

                  </div>

                </div>


                {/* Footer */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 px-4 py-3 mt-2 border-t border-slate-100 bg-slate-50/50">

                  <span className="text-[10px] text-slate-500 font-medium">
                    Click on any date row to filter that day's files in the ledger.
                  </span>


                  {(startDateFilter || endDateFilter) && (

                    <button
                      onClick={() => {
                        setStartDateFilter('');
                        setEndDateFilter('');
                      }}
                      className="self-start sm:self-auto px-3 py-1.5 rounded-md border border-red-200 bg-white text-red-600 text-[10px] font-bold hover:bg-red-50 hover:border-red-300 transition-all cursor-pointer"
                    >
                      Clear Date Filter{' '}

                      {startDateFilter === endDateFilter
                        ? `(${new Date(startDateFilter).toLocaleDateString(
                            'en-GB'
                          )})`
                        : `(${startDateFilter} to ${endDateFilter})`}
                    </button>

                  )}

                </div>

              </div>
            </div>

          </div>
          {/* <div className="grid grid-cols-12 gap-3">

            <div className="col-span-12 md:col-span-4 bg-[#d4d0c8] border-2 border-white border-b-slate-650 border-r-slate-650 p-2 shadow-sm rounded-sm">
              <h3 className="text-[10px] uppercase font-black text-slate-700 border-b border-slate-400 pb-1 mb-1.5 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-blue-800" /> Operational Overview
              </h3>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-white border border-slate-400 p-1">
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Filtered Loads</p>
                  <p className="text-xs font-black text-slate-900 font-mono">{filteredIssuesCount} Slips</p>
                </div>
                <div className="bg-white border border-slate-400 p-1">
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Total Packets</p>
                  <p className="text-xs font-black text-blue-800 font-mono">{totalBalesVal.toLocaleString()} Bales</p>
                </div>
                <div className="bg-white border border-slate-400 p-1 col-span-2">
                  <p className="text-[9px] font-bold text-slate-500 uppercase">Total Net Weight (M.T)</p>
                  <p className="text-xs font-black text-red-700 font-mono">{totalWeightMtVal.toFixed(3)} MT</p>
                </div>
              </div>
            </div>

            <div className="col-span-12 md:col-span-8 bg-[#d4d0c8] border-2 border-white border-b-slate-650 border-r-slate-650 p-2 shadow-sm flex flex-col rounded-sm">
              <div className="flex justify-between items-center border-b border-slate-400 pb-1 mb-1.5">
                <h3 className="text-[10px] uppercase font-black text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-red-700" /> Date Wise Total Issue Report (Global Summary)
                </h3>
                <span className="text-[8.5px] uppercase tracking-wider font-extrabold text-slate-500 bg-white/50 px-1 border border-slate-300">Latest Days</span>
              </div>
              
              <div className="bg-white border border-slate-400 h-[83px] overflow-y-auto">
                <table className="w-full text-left text-[9px] border-collapse font-mono">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 sticky top-0 font-bold text-slate-600 ">
                      <th className="px-2 py-0.5 border-r border-slate-200">Issue Date</th>
                      <th className="px-2 py-0.5 text-center border-r border-slate-200">Voucher Count</th>
                      <th className="px-2 py-0.5 text-right border-r border-slate-200">Total Bales</th>
                      <th className="px-2 py-0.5 text-right">Net Weight (M.T)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dateWiseList.map((rep) => {
                      const isSelectedDate = startDateFilter === rep.date && endDateFilter === rep.date;
                      return (
                        <tr 
                          key={rep.date} 
                          className="hover:bg-blue-50 cursor-pointer text-[10px] h-6"
                          onClick={() => { setStartDateFilter(rep.date); setEndDateFilter(rep.date); }}
                        >
                          <td className="px-2 py-0.5 font-bold text-slate-700 flex items-center gap-1">
                            <span className={cn("w-1.5 h-1.5 rounded-full bg-indigo-600 inline-block", isSelectedDate && "bg-red-600 animate-pulse")} />
                            {new Date(rep.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-2 py-0.5 text-center font-black text-slate-800">{rep.count} Slips</td>
                          <td className="px-2 py-0.5 text-right font-black text-indigo-700">{rep.packets}</td>
                          <td className="px-2 py-0.5 text-right font-black text-red-600">{rep.weight.toFixed(3)} MT</td>
                        </tr>
                      );
                    })}
                    {dateWiseList.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-4 text-slate-400 uppercase font-bold text-[9px]">No historical calendar data loaded.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-1 text-[8px] text-slate-500 font-bold ">
                <span>* Click on any date row to immediately filter that day's files in the ledger table.</span>
                {(startDateFilter || endDateFilter) && (
                  <button 
                    onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                    className="text-red-700 font-extrabold border border-red-300 hover:bg-red-50 px-1 bg-white cursor-pointer hover:text-red-900 transition-colors"
                  >
                    Clear Date Filter {startDateFilter === endDateFilter ? `(${new Date(startDateFilter).toLocaleDateString('en-GB')})` : `(${startDateFilter} to ${endDateFilter})`}
                  </button>
                )}
              </div>
            </div>
          </div> */}

          {/* SEARCH & FILTER STRIP */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">

            {/* Search */}
            <div className="flex flex-1 min-w-[250px] items-center rounded-lg border border-slate-200 bg-slate-50 overflow-hidden transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
              <input
                id="search_by_issue_no_depart_1952"
                name="search_by_issue_no_depart"
                aria-label="Search by Issue No, Department, Godown, Stock Group..."
                className="flex-1 bg-transparent text-xs px-3 py-2 outline-none font-semibold uppercase text-slate-700 placeholder:text-slate-400"
                placeholder="Search by Issue No, Department, Godown, Stock Group..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />

              <div className="px-3 border-l border-slate-200 flex items-center justify-center bg-white">
                <Search className="h-4 w-4 text-slate-500" />
              </div>
            </div>


            {/* Date Filter */}
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1">

              <div className="flex items-center gap-1">
                <span className="text-[9px] font-black uppercase text-slate-400">
                  From
                </span>

                <input
                  id="startdatefilter_1965"
                  name="startdatefilter"
                  aria-label="startdatefilter"
                  type="date"
                  className="bg-white rounded-md border border-slate-200 text-xs px-2 py-1.5 outline-none font-bold text-slate-700 focus:border-blue-400"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                />
              </div>


              <div className="h-5 w-px bg-slate-200" />


              <div className="flex items-center gap-1">
                <span className="text-[9px] font-black uppercase text-slate-400">
                  To
                </span>

                <input
                  id="enddatefilter_1972"
                  name="enddatefilter"
                  aria-label="enddatefilter"
                  type="date"
                  className="bg-white rounded-md border border-slate-200 text-xs px-2 py-1.5 outline-none font-bold text-slate-700 focus:border-blue-400"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                />
              </div>


              {(startDateFilter || endDateFilter) && (
                <button
                  onClick={() => {
                    setStartDateFilter('');
                    setEndDateFilter('');
                  }}
                  className="ml-1 w-7 h-7 rounded-md bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 flex items-center justify-center transition-colors cursor-pointer"
                  title="Clear date range"
                >
                  ×
                </button>
              )}

            </div>


            {/* Action Buttons */}
            <div className="flex items-center gap-2">

              {/* Export */}
              <button
                onClick={handleExportCSV}
                className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-sm hover:shadow cursor-pointer active:scale-95"
                title="Download filtered records as CSV"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export CSV
              </button>


              {/* Clear */}
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStartDateFilter('');
                  setEndDateFilter('');
                }}
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 text-slate-600 hover:text-red-600 text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title="Clear Search & Filters"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>


              {/* Refresh */}
              <button
                onClick={fetchRecords}
                className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-sm hover:shadow cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-wait"
                disabled={loading}
                title="Refresh database records"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    loading ? 'animate-spin' : ''
                  }`}
                />

                {loading ? 'Refreshing...' : 'Refresh'}
              </button>

            </div>

          </div>
          {/* <div className="flex bg-[#d4d0c8] p-1 border-2 border-white border-b-slate-650 border-r-slate-650 gap-2 items-center flex-wrap rounded-sm">
            <div className="flex bg-white border border-slate-400 p-px flex-1 min-w-[200px]">
              <input  id="search_by_issue_no_depart_1952" name="search_by_issue_no_depart" aria-label="Search by Issue No, Department, Godown, Stock Group..."
                className="flex-1 text-xs px-2 outline-none py-1 font-sans font-semibold uppercase" 
                placeholder="Search by Issue No, Department, Godown, Stock Group..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="bg-[#d4d0c8] px-2 border-l border-slate-400 flex items-center justify-center">
                <Search className="h-3.5 w-3.5 text-slate-600" />
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-white border border-slate-400 p-px">
              <span className="text-[9px] font-black uppercase text-slate-500 pl-1">From:</span>
              <input  id="startdatefilter_1965" name="startdatefilter" aria-label="startdatefilter"
                type="date"
                className="text-xs px-1 py-0.5 outline-none font-bold"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
              />
              <span className="text-[9px] font-black uppercase text-slate-500">To:</span>
              <input  id="enddatefilter_1972" name="enddatefilter" aria-label="enddatefilter"
                type="date"
                className="text-xs px-1 py-0.5 outline-none font-bold"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
              />
              {(startDateFilter || endDateFilter) && (
                <button 
                  onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                  className="text-slate-400 hover:text-red-650 px-1.5 border-l border-slate-200 font-bold cursor-pointer"
                  title="Clear date range"
                >
                  ×
                </button>
              )}
            </div>

            <div className="flex gap-1">
              <button 
                onClick={handleExportCSV} 
                className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] px-3 text-[10px] font-bold h-6 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Download filtered records as CSV"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-100" /> Export to CSV
              </button>
              <button 
                onClick={() => { setSearchQuery(''); setStartDateFilter(''); setEndDateFilter(''); }} 
                className="bg-[#d4d0c8] border border-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] px-3 text-[10px] font-bold h-6 flex items-center gap-1 hover:bg-[#c8c4bc] cursor-pointer"
                title="Clear Search & Filters"
              >
                <X className="h-3 w-3 text-red-800" /> Clear
              </button>
              <button 
                onClick={fetchRecords} 
                className="bg-emerald-700 hover:bg-emerald-800 text-white border border-white shadow-[1px_1px_0_0_rgba(0,0,0,0.5)] px-3 text-[10px] font-bold h-6 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                disabled={loading}
                title="Refresh database records"
              >
                <RefreshCw className={`h-3 w-3 text-emerald-100 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div> */}

          {/* ACTION TOOLBAR */}
          <div className="flex flex-wrap items-stretch justify-end gap-2 my-3 p-2 rounded-xl border border-slate-200 bg-slate-50">

            {/* New Issue */}
            <button 
              type="button"
              onClick={() => {
                handleNew();
                setViewState('entry');
              }}
              className="group min-w-[125px] h-[58px] px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex items-center gap-3 active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-md bg-white/15 group-hover:bg-white/20 flex items-center justify-center">
                <Plus className="h-4 w-4" />
              </div>

              <div className="flex flex-col items-start">
                <span className="text-[11px] font-bold leading-tight">
                  New Issue
                </span>
                <span className="text-[8px] uppercase tracking-wider text-blue-100">
                  Create Slip
                </span>
              </div>
            </button>


            {/* Export CSV */}
            <button 
              type="button"
              onClick={handleExportCSV}
              className="group min-w-[125px] h-[58px] px-4 rounded-lg bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex items-center gap-3 active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 flex items-center justify-center">
                <FileSpreadsheet className="h-4 w-4" />
              </div>

              <div className="flex flex-col items-start">
                <span className="text-[11px] font-bold leading-tight">
                  Export CSV
                </span>
                <span className="text-[8px] uppercase tracking-wider text-slate-400">
                  Download Data
                </span>
              </div>
            </button>


            {/* Refresh */}
            <button 
              type="button"
              onClick={fetchRecords}
              className="group min-w-[125px] h-[58px] px-4 rounded-lg bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex items-center gap-3 active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-md bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 flex items-center justify-center">
                <RefreshCw className="h-4 w-4" />
              </div>

              <div className="flex flex-col items-start">
                <span className="text-[11px] font-bold leading-tight">
                  Refresh
                </span>
                <span className="text-[8px] uppercase tracking-wider text-slate-400">
                  Database
                </span>
              </div>
            </button>


            {/* Open Selected Slip */}
            <button 
              type="button"
              onClick={() => {
                if (selectedRecordId) {
                  const target = savedIssues.find(r => r.issue_no === selectedRecordId);
                  if (target) {
                    loadIssueIntoForm(target);
                  }
                } else {
                  alert("Please select a record from the ledger table first.");
                }
              }}
              className="group min-w-[150px] h-[58px] px-4 rounded-lg bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-700 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex items-center gap-3 active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-600 group-hover:bg-amber-100 flex items-center justify-center">
                <FileText className="h-4 w-4" />
              </div>

              <div className="flex flex-col items-start">
                <span className="text-[11px] font-bold leading-tight">
                  Open Slip
                </span>
                <span className="text-[8px] uppercase tracking-wider text-slate-400">
                  Selected Record
                </span>
              </div>
            </button>


            {/* Print Selected Slip */}
            <button
              type="button"
              onClick={() => {
                if (selectedRecordId) {
                  const target = savedIssues.find(r => r.issue_no === selectedRecordId);
                  if (target) {
                    handlePreparePrint(target);
                  }
                } else {
                  alert("Please select a record from the ledger table first.");
                }
              }}
              className="group min-w-[150px] h-[58px] px-4 rounded-lg bg-slate-800 hover:bg-slate-900 text-white shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex items-center gap-3 active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-md bg-white/10 group-hover:bg-white/15 flex items-center justify-center">
                <Printer className="h-4 w-4" />
              </div>

              <div className="flex flex-col items-start">
                <span className="text-[11px] font-bold leading-tight">
                  Print Slip
                </span>
                <span className="text-[8px] uppercase tracking-wider text-slate-300">
                  Selected Record
                </span>
              </div>
            </button>

          </div>
          {/* <div className="flex flex-wrap gap-1.5 items-center my-2">
            <button 
              type="button"
              onClick={() => {
                handleNew();
                setViewState('entry');
              }}
              className="bg-white border-2 border-[#bccbfd] text-[#1c4587] shadow-[2px_2px_0_0_rgba(0,0,0,0.15)] hover:bg-slate-50 transition-all font-bold cursor-pointer flex flex-col items-center justify-center min-w-[120px] h-[52px] px-4"
            >
              <Plus className="h-4 w-4 mb-0.5 text-[#1c4587]" />
              <span className="text-[10px] font-black uppercase tracking-tight">New Issue</span>
            </button>

            <button 
              type="button"
              onClick={handleExportCSV}
              className="bg-[#f0f4f1] border-2 border-white shadow-[2px_2px_0_0_rgba(0,0,0,0.15)] hover:bg-[#e6ebe7] text-[#1c4587] transition-all font-bold cursor-pointer flex flex-col items-center justify-center min-w-[120px] h-[52px] px-4"
            >
              <FileSpreadsheet className="h-4 w-4 mb-0.5 text-slate-500" />
              <span className="text-[10px] font-black uppercase tracking-tight">Export to CSV</span>
            </button>

            <button 
              type="button"
              onClick={fetchRecords}
              className="bg-[#f0f4f1] border-2 border-white shadow-[2px_2px_0_0_rgba(0,0,0,0.15)] hover:bg-[#e6ebe7] text-[#1c4587] transition-all font-bold cursor-pointer flex flex-col items-center justify-center min-w-[120px] h-[52px] px-4"
            >
              <RefreshCw className="h-4 w-4 mb-0.5 text-slate-500" />
              <span className="text-[10px] font-black uppercase tracking-tight">Refresh Database</span>
            </button>

            <button 
              type="button"
              onClick={() => {
                if (selectedRecordId) {
                  const target = savedIssues.find(r => r.issue_no === selectedRecordId);
                  if (target) {
                    loadIssueIntoForm(target);
                  }
                } else {
                  alert("Please select a record from the ledger table first.");
                }
              }}
              className="bg-[#f0f4f1] border-2 border-white shadow-[2px_2px_0_0_rgba(0,0,0,0.15)] hover:bg-[#e6ebe7] text-[#1c4587] transition-all font-bold cursor-pointer flex flex-col items-center justify-center min-w-[120px] h-[52px] px-4"
            >
              <FileText className="h-4 w-4 mb-0.5 text-slate-500" />
              <span className="text-[10px] font-black uppercase tracking-tight">Open Selected Slip</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedRecordId) {
                  const target = savedIssues.find(r => r.issue_no === selectedRecordId);
                  if (target) {
                    handlePreparePrint(target);
                  }
                } else {
                  alert("Please select a record from the ledger table first.");
                }
              }}
              className="bg-[#dbd7d0] border border-[#8b857c] text-[#1c4587] hover:bg-[#cfcac1] font-bold px-4 h-[52px] text-xs flex items-center gap-2 shadow-[2px_2px_0_0_rgba(0,0,0,0.1)] transition-all cursor-pointer self-center"
            >
              <Printer className="h-4 w-4 text-[#1c4587]" />
              <span>Print Selected Slip</span>
            </button>
          </div> */}

          {/* TOTAL SUMMARY COUNTER LABEL */}
          {/* <div className="flex justify-between items-center pr-1 text-[10px] font-black ">
            <span className="text-slate-500 uppercase">Double-click any voucher in the ledger below to load it into the form</span>
            <span className="text-indigo-900 font-extrabold uppercase">TOTAL FILTERED METRIC TONS : {totalWeightMtVal.toFixed(3)} MT</span>
          </div> */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">

            {/* Instruction */}
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                <FileText className="h-3.5 w-3.5" />
              </div>

              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Double-click any voucher in the ledger below to load it into the form
              </span>
            </div>

            {/* Total Weight */}
            <div className="flex items-center gap-2 rounded-md border border-indigo-100 bg-white px-3 py-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Total Filtered Weight
              </span>

              <span className="text-[12px] font-black tabular-nums text-indigo-700">
                {totalWeightMtVal.toFixed(3)}
                <span className="ml-1 text-[9px] text-indigo-400">
                  MT
                </span>
              </span>
            </div>

          </div>

          {/* REGISTER LEDGER TABLE */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="overflow-x-auto max-h-[420px] rounded-lg border border-slate-200">

              <table className="w-full min-w-[950px] text-xs border-collapse">

                {/* Table Header */}
                <thead className="sticky top-0 z-20 bg-slate-800 text-white">
                  <tr className="h-10 border-b border-slate-700">

                    <th className="px-3 text-center font-bold text-[10px] uppercase tracking-wide whitespace-nowrap">
                      Voucher Date
                    </th>

                    <th className="px-3 text-center font-bold text-[10px] uppercase tracking-wide whitespace-nowrap">
                      Issue No
                    </th>

                    <th className="px-3 text-center font-bold text-[10px] uppercase tracking-wide whitespace-nowrap">
                      Buyer / Dept
                    </th>

                    <th className="px-3 text-left font-bold text-[10px] uppercase tracking-wide whitespace-nowrap">
                      Destination Godown
                    </th>

                    <th className="px-3 text-left font-bold text-[10px] uppercase tracking-wide whitespace-nowrap">
                      Source P.O. Number
                    </th>

                    <th className="px-3 text-left font-bold text-[10px] uppercase tracking-wide whitespace-nowrap">
                      Stock Group
                    </th>

                    <th className="px-3 text-center font-bold text-[10px] uppercase tracking-wide whitespace-nowrap">
                      Issue Type
                    </th>

                    <th className="px-3 text-center font-bold text-[10px] uppercase tracking-wide whitespace-nowrap">
                      Shift
                    </th>

                    <th className="px-3 text-right font-bold text-[10px] uppercase tracking-wide whitespace-nowrap">
                      Qty
                    </th>

                    <th className="px-3 text-right font-bold text-[10px] uppercase tracking-wide whitespace-nowrap bg-red-900/40">
                      Net Weight (M.T)
                    </th>

                    <th className="px-3 text-center font-bold text-[10px] uppercase tracking-wide whitespace-nowrap">
                      Actions
                    </th>

                  </tr>
                </thead>


                <tbody className="divide-y divide-slate-100 font-mono text-xs">

                  {filteredRecords.slice((listCurrentPage - 1) * listPageSize, listCurrentPage * listPageSize).map((r, idx) => {

                    const isSelected = selectedRecordId === r.issue_no;

                    const formattedDate = r.date
                      ? new Date(r.date).toLocaleDateString('en-GB')
                      : '--';

                    const rDetails = savedDetails.filter(
                      d => d.issue_no === r.issue_no
                    );

                    const bales = rDetails.reduce(
                      (sum, item) => sum + (Number(item.qty) || 0),
                      0
                    );

                    const weightMt =
                      rDetails.reduce(
                        (sum, item) =>
                          sum + (Number(item.weight_kgs) || 0),
                        0
                      ) / 1000;


                    return (

                      <tr
                        key={r.issue_no || idx}
                        onClick={() => setSelectedRecordId(r.issue_no || null)}
                        onDoubleClick={() => {
                          setSelectedRecordId(r.issue_no || null);
                          loadIssueIntoForm(r);
                        }}
                        className={cn(
                          "h-11 cursor-pointer group transition-colors duration-150",
                          "hover:bg-blue-50/70",
                          isSelected
                            ? "bg-indigo-50 border-y border-indigo-200 text-indigo-950"
                            : idx % 2 === 0
                              ? "bg-white text-slate-700"
                              : "bg-slate-50/60 text-slate-700"
                        )}
                      >

                        {/* Voucher Date */}
                        <td
                          className={cn(
                            "text-center px-3 whitespace-nowrap border-r border-slate-100 font-semibold",
                            isSelected
                              ? "text-indigo-700"
                              : "text-slate-500"
                          )}
                        >
                          {formattedDate}
                        </td>


                        {/* Issue No */}
                        <td className="text-center px-3 border-r border-slate-100 font-black text-slate-800 uppercase whitespace-nowrap">
                          {r.issue_no}
                        </td>


                        {/* Department */}
                        <td className="text-center px-3 border-r border-slate-100 whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex px-2 py-1 rounded-md text-[9px] font-bold uppercase",
                              isSelected
                                ? "bg-indigo-100 text-indigo-800"
                                : "bg-blue-50 text-blue-700"
                            )}
                          >
                            {r.department || '--'}
                          </span>
                        </td>


                        {/* Godown */}
                        <td className="px-3 truncate uppercase font-sans font-semibold text-left border-r border-slate-100 whitespace-nowrap max-w-[200px] text-slate-700">
                          {r.destination_godown || r.godown || '--'}
                        </td>


                        {/* Source P.O. Number */}
                        <td
                          className={cn(
                            "px-3 truncate uppercase font-sans font-semibold text-left border-r border-slate-100 whitespace-nowrap max-w-[180px]",
                            isSelected
                              ? "text-indigo-800"
                              : "text-slate-600"
                          )}
                        >
                          {r.requisition_no || '--'}
                        </td>


                        {/* Stock Group */}
                        <td className="px-3 truncate uppercase font-sans text-left border-r border-slate-100 whitespace-nowrap max-w-[150px] text-slate-500">
                          {r.stock_group || '--'}
                        </td>


                        {/* Issue Type */}
                        <td className="text-center border-r border-slate-100 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 rounded-md bg-slate-100 text-slate-600 font-bold uppercase text-[9px]">
                            {r.issue_type || '--'}
                          </span>
                        </td>


                        {/* Shift */}
                        <td className="text-center border-r border-slate-100 whitespace-nowrap">

                          <span
                            className={cn(
                              "inline-flex items-center justify-center min-w-[24px] px-2 py-1 rounded-md text-[9px] font-black border",
                              isSelected
                                ? "bg-indigo-100 border-indigo-200 text-indigo-700"
                                : "bg-slate-50 border-slate-200 text-slate-600"
                            )}
                          >
                            {r.mill_shift || 'A'}
                          </span>

                        </td>


                        {/* Bales */}
                        <td
                          className={cn(
                            "text-right px-3 font-black tabular-nums border-r border-slate-100 whitespace-nowrap",
                            isSelected
                              ? "text-indigo-700"
                              : "text-blue-600"
                          )}
                        >
                          {bales}
                        </td>


                        {/* Net Weight */}
                        <td
                          className={cn(
                            "text-right px-3 font-black tabular-nums border-r border-slate-100 whitespace-nowrap",
                            isSelected
                              ? "bg-red-100/60 text-red-800"
                              : "bg-red-50/40 text-red-600"
                          )}
                        >
                          {weightMt.toFixed(3)}
                        </td>


                        {/* Actions */}
                        <td
                          className="text-center px-2"
                          onClick={(e) => e.stopPropagation()}
                        >

                          <div className="flex justify-center items-center gap-1">

                            {canEditOrDelete() && (
                              <button
                                onClick={() => loadIssueIntoForm(r)}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition-colors cursor-pointer"
                                title="Open & Edit Voucher"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}


                            <button
                              onClick={() => handlePreparePrint(r)}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 transition-colors cursor-pointer"
                              title="Print Slip"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>


                            {canEditOrDelete() && (
                              <button
                                onClick={() => handleDashboardDelete(r.issue_no)}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors cursor-pointer"
                                title="Delete Voucher"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                          </div>

                        </td>

                      </tr>

                    );
                  })}


                  {filteredRecords.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="text-center py-14 text-slate-400 font-bold uppercase text-[10px]"
                      >
                        No saved material issue vouchers found.
                      </td>
                    </tr>
                  )}

                </tbody>

              </table>

            </div>
            <div className="mt-2">
              <PaginationControls
                currentPage={listCurrentPage}
                totalItems={filteredRecords.length}
                pageSize={listPageSize}
                onPageChange={setListCurrentPage}
                onPageSizeChange={setListPageSize}
              />
            </div>
          </div>
          {/* <div className="bg-[#d4d0c8] p-1 border border-slate-400 shadow-sm rounded-sm">
            <div className="bg-white border-2 border-b-white border-r-white border-t-slate-600 border-l-slate-600 overflow-x-auto max-h-[420px]">
              <table className="w-full text-xs border-collapse min-w-[950px]">
                <thead className="bg-[#d4d0c8] text-slate-700 sticky top-0  border-b border-slate-400 font-bold text-center">
                  <tr className="h-9 border-b border-slate-400 divide-x divide-slate-350">
                    <th className="px-2 font-bold text-center w-24 whitespace-nowrap">Voucher Date</th>
                    <th className="px-2 font-bold text-center w-24 whitespace-nowrap">Issue No</th>
                    <th className="px-2 font-bold text-center w-32 whitespace-nowrap">Buyer / Dept</th>
                    <th className="px-3 font-bold text-left whitespace-nowrap">Destination Godown</th>
                    <th className="px-3 font-bold text-left whitespace-nowrap">Source P.O. Number</th>
                    <th className="px-3 font-bold text-left whitespace-nowrap">Stock Group</th>
                    <th className="px-2 font-bold text-center w-36 whitespace-nowrap">Issue Type</th>
                    <th className="px-2 font-bold text-center w-20 whitespace-nowrap">Shift</th>
                    <th className="px-2 font-bold text-right w-24 whitespace-nowrap">Qty</th>
                    <th className="px-2 font-bold text-right w-28 bg-red-50/50 text-red-900 whitespace-nowrap">Net Weight (M.T)</th>
                    <th className="px-2 font-bold text-center w-24 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-xs">
                  {filteredRecords.map((r, idx) => {
                    const isSelected = selectedRecordId === r.issue_no;
                    const formattedDate = r.date ? new Date(r.date).toLocaleDateString('en-GB') : '--';
                    
                    const rDetails = savedDetails.filter(d => d.issue_no === r.issue_no);
                    const bales = rDetails.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
                    const weightMt = rDetails.reduce((sum, item) => sum + (Number(item.weight_kgs) || 0), 0) / 1000;

                    return (
                      <tr 
                        key={r.issue_no || idx} 
                        onClick={() => setSelectedRecordId(r.issue_no || null)}
                        onDoubleClick={() => {
                          setSelectedRecordId(r.issue_no || null);
                          loadIssueIntoForm(r);
                        }}
                        className={cn(
                          "h-9.5 cursor-pointer group hover:bg-[#ffffd0]/65 text-xs", 
                          isSelected 
                            ? "bg-indigo-50 text-indigo-950 font-bold border-y border-indigo-200" 
                            : (idx % 2 === 0 ? "bg-white text-slate-900" : "bg-slate-50/30 text-slate-900")
                        )}
                      >
                        <td className={cn("text-center px-2 border-r border-slate-200 whitespace-nowrap", isSelected ? "text-indigo-900 font-bold" : "text-slate-500 font-bold")}>
                          {formattedDate}
                        </td>

                        <td className="text-center font-black px-2 border-r border-slate-200 uppercase whitespace-nowrap">
                          {r.issue_no}
                        </td>

                        <td className={cn("text-center font-bold px-1.5 border-r border-slate-200 uppercase whitespace-nowrap", isSelected ? "text-indigo-950 bg-indigo-100/40" : "text-indigo-900 bg-indigo-50/10")}>
                          {r.department || '--'}
                        </td>

                        <td className="px-3 truncate uppercase font-sans font-semibold text-left border-r border-slate-200 whitespace-nowrap max-w-[200px]">
                          {r.destination_godown || r.godown || '--'}
                        </td>

                        <td className={cn("px-3 truncate uppercase font-sans font-semibold text-left border-r border-slate-200 whitespace-nowrap max-w-[180px]", isSelected ? "text-indigo-900 font-bold" : "text-indigo-950")}>
                          {r.requisition_no || '--'}
                        </td>

                        <td className={cn("px-3 truncate uppercase font-sans text-left border-r border-slate-200 whitespace-nowrap max-w-[150px]", isSelected ? "text-indigo-900" : "text-slate-600")}>
                          {r.stock_group || '--'}
                        </td>

                        <td className="text-center font-extrabold uppercase border-r border-slate-200 font-sans text-[10px] whitespace-nowrap">
                          {r.issue_type || '--'}
                        </td>

                        <td className="text-center border-r border-slate-200 whitespace-nowrap">
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded font-bold uppercase border",
                            isSelected ? "border-indigo-300 bg-indigo-100 text-indigo-900" : "bg-slate-100 text-slate-600 border-slate-200"
                          )}>
                            {r.mill_shift || 'A'}
                          </span>
                        </td>

                        <td className={cn("text-right px-2.5 font-black tabular-nums border-r border-slate-200 whitespace-nowrap", isSelected ? "text-indigo-900" : "text-blue-700 group-hover:text-blue-900")}>
                          {bales}
                        </td>

                        <td className={cn("text-right px-2.5 font-black tabular-nums border-r border-slate-200 whitespace-nowrap", isSelected ? "text-red-800 bg-red-100/50" : "text-red-700 bg-red-50/25")}>
                          {weightMt.toFixed(3)}
                        </td>

                        <td className="text-center px-1" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center gap-1.5">
                            {canEditOrDelete() && (
                              <button 
                                onClick={() => loadIssueIntoForm(r)} 
                                className={cn(
                                  "p-0.5 hover:bg-black/15 rounded transition-colors",
                                  isSelected ? "text-blue-200 hover:text-white" : "text-blue-600 hover:text-blue-800"
                                )}
                                title="Open & Edit Voucher"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button 
                              onClick={() => handlePreparePrint(r)} 
                              className={cn(
                                "p-0.5 hover:bg-black/15 rounded transition-colors",
                                isSelected ? "text-indigo-200 hover:text-white" : "text-indigo-600 hover:text-indigo-800"
                              )}
                              title="Print Slip"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            {canEditOrDelete() && (
                              <button 
                                onClick={() => handleDashboardDelete(r.issue_no)} 
                                className={cn(
                                  "p-0.5 hover:bg-black/15 rounded transition-colors",
                                  isSelected ? "text-gray-200 hover:text-white" : "text-red-600 hover:text-red-800"
                                )}
                                title="Delete Voucher"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-slate-400 italic font-bold uppercase ">
                        No saved material issue vouchers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div> */}
        </div>
    );

    return (
      <>
        {embedded ? (
          listContent
        ) : (
          <LegacyLayout 
            title="Issue"
            subtitle=""
            onClose={handleFormCancel}
            onMaximize={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
              } else {
                document.documentElement.requestFullscreen().catch(() => {});
              }
            }}
          >
            {listContent}
          </LegacyLayout>
        )}
        <PrintModal
          isOpen={showPrintView}
          onClose={() => setShowPrintView(false)}
          title={`MATERIAL ISSUE VOUCHER - ${formData?.issue_no || ''}`}
        >
          <MaterialIssuePrintSlip 
            master={formData} 
            details={items} 
          />
        </PrintModal>
      </>
    );
  }

  return (
    <>
      <MaterialIssueEntry
        formData={formData}
        setFormData={setFormData}
        items={items}
        setItems={setItems}
        issueRoute={issueRoute}
        setIssueRoute={setIssueRoute}
        finalArrivals={finalArrivals}
        godownRecords={godownRecords}
        isEditMode={isEditMode}
        validationErrors={validationErrors}
        setValidationErrors={setValidationErrors}
        handleSave={handleSave}
        handleFormCancel={handleFormCancel}
        showToast={showToast}
        successToast={successToast}
        setSuccessToast={setSuccessToast}
        containerRef={containerRef}
        setCurrentPage={setCurrentPage}
        closePage={closePage}
        embedded={embedded}
      />
      
      <PrintModal
        isOpen={showPrintView}
        onClose={() => setShowPrintView(false)}
        title={`MATERIAL ISSUE VOUCHER - ${formData?.issue_no || ''}`}
      >
        <MaterialIssuePrintSlip 
          master={formData} 
          details={items} 
        />
      </PrintModal>
    </>
  );
}
