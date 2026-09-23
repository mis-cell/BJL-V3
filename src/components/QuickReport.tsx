import React from 'react';
import { motion } from 'motion/react';
import { 
  Archive, 
  FileCheck, 
  RefreshCw, 
  Database, 
  Clock, 
  ArrowRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

interface QuickReportProps {
  totalArrivals: number;
  pendingMrSettlements: number;
  totalPackets: number;
  totalWeightQtl: number;
  loading: boolean;
  onRefresh: () => void;
  onNavigate: (page: string) => void;
}

export default function QuickReport({
  totalArrivals,
  pendingMrSettlements,
  totalPackets,
  totalWeightQtl,
  loading,
  onRefresh,
  onNavigate
}: QuickReportProps) {
  return (
    <div className="bg-[#f8fafc]/90 border border-slate-300 p-4.5 rounded-xl shadow-sm space-y-4 font-sans">
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Database className="h-4.5 w-4.5 text-indigo-900" />
            <h3 className="text-[12px] font-black uppercase tracking-wider text-slate-800">
              Quick Report Summary
            </h3>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 px-2.5 py-1 text-[9.5px] font-black uppercase text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm active:translate-y-px transition-all rounded-[3px]"
          id="quick-report-refresh-btn"
        >
          <RefreshCw className={cn("h-3 w-3 text-slate-500", loading && "animate-spin")} />
          <span>{loading ? "Syncing" : "Refresh"}</span>
        </button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Total Arrivals (from amad_register) */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="bg-white border border-slate-350 p-4 rounded-lg shadow-sm relative overflow-hidden flex flex-col justify-between"
          id="card-total-arrivals"
        >
          <div className="absolute top-2 right-2 text-indigo-50/70 pointer-events-none">
            <Archive className="h-14 w-14" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase text-indigo-550 bg-indigo-50 border border-indigo-150 px-1.5 py-0.5 tracking-wider rounded-sm">
              Source: amad_register (Live)
            </span>
            <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wide mt-3 mb-1">
              Total Safe Jute Arrivals
            </h4>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-mono font-black text-slate-900">
                {loading ? "..." : totalArrivals}
              </span>
              <span className="text-[9.5px] font-bold text-slate-400 font-mono uppercase">
                Lorries Arrived
              </span>
            </div>
          </div>
          
          <div className="border-t border-slate-100 mt-4 pt-3 space-y-1.5">
            <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono">
              <span className="font-bold">TOTAL VOLUME QUANTITY:</span>
              <span className="font-black text-slate-800">{totalPackets.toLocaleString()} Bales</span>
            </div>
            <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono">
              <span className="font-bold">ESTIMATED LAID-DOWN WEIGHT:</span>
              <span className="font-black text-emerald-700 font-bold">
                {(totalWeightQtl / 10).toFixed(2)} MT
              </span>
            </div>
          </div>

          <button
            onClick={() => onNavigate('amad')}
            className="mt-3.5 w-full bg-slate-50 hover:bg-indigo-50 text-indigo-950 font-extrabold uppercase text-[9px] tracking-wider py-1.5 border border-slate-300 hover:border-indigo-300 shadow-sm flex items-center justify-center gap-1 cursor-pointer group rounded"
            id="btn-goto-amad-reg"
          >
            <span>Amad Arrival Registry</span>
            <ArrowRight className="h-3 w-3 text-indigo-700 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </motion.div>

        {/* Card 2: Pending M.R. Settlements (from material_inspection) */}
        <motion.div 
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          className="bg-white border border-slate-350 p-4 rounded-lg shadow-sm relative overflow-hidden flex flex-col justify-between"
          id="card-pending-settlements"
        >
          <div className="absolute top-2 right-2 text-rose-50/70 pointer-events-none">
            <FileCheck className="h-14 w-14" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase text-rose-650 bg-rose-50 border border-rose-150 px-1.5 py-0.5 tracking-wider rounded-sm">
              Source: material_inspection
            </span>
            <h4 className="text-[11px] font-black text-slate-705 uppercase tracking-wide mt-3 mb-1">
              Pending M.R. Settlements
            </h4>
            <div className="flex items-baseline gap-2 mt-2">
              <span className={cn(
                "text-2xl font-mono font-black",
                pendingMrSettlements > 0 ? "text-rose-600" : "text-emerald-750"
              )}>
                {loading ? "..." : pendingMrSettlements}
              </span>
              <span className="text-[9.5px] font-bold text-slate-400 font-mono uppercase">
                Awaiting clearance
              </span>
            </div>
          </div>

          <div className="border-t border-slate-100 mt-4 pt-3">
            {pendingMrSettlements > 0 ? (
              <div className="flex items-center gap-1.5 text-[9px] text-amber-700 bg-amber-50 border border-amber-200/50 p-2 rounded">
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="font-bold uppercase tracking-tight">
                  {pendingMrSettlements} inspection logs require physical weighbridge comparisons & claims clearance!
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-200/50 p-2 rounded">
                <FileCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="font-bold uppercase tracking-tight">
                  Operational clean state: All quality inspections have been cleanly settled.
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate('mr_settlement')}
            className="mt-3.5 w-full bg-slate-50 hover:bg-rose-50 text-rose-950 font-extrabold uppercase text-[9px] tracking-wider py-1.5 border border-slate-300 hover:border-rose-350 shadow-sm flex items-center justify-center gap-1 cursor-pointer group rounded"
            id="btn-goto-mr-desk"
          >
            <span>Weighbridge Settlement Desk</span>
            <ArrowRight className="h-3 w-3 text-rose-700 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
