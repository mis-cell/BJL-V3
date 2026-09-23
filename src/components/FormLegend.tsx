import React from 'react';
import { Sparkles, Asterisk, Edit3 } from 'lucide-react';

interface FormLegendProps {
  className?: string;
  showCalculated?: boolean;
}

export const FormLegend: React.FC<FormLegendProps> = ({
  className = "",
  showCalculated = true
}) => {
  return (
    <div className={`bg-gradient-to-r from-sky-50/80 via-rose-50/60 to-slate-50/80 border border-slate-300/80 rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs text-xs font-semibold ${className}`}>
      <div className="flex items-center gap-1.5 text-slate-700 font-bold">
        <span className="uppercase text-[10px] tracking-wider text-slate-500">Field Color Guide:</span>
      </div>
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        {/* Auto Populated */}
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-[#EAF4FF] border border-[#BFDBFE] flex items-center justify-center text-[#1E3A8A] shadow-2xs">
            <Sparkles className="w-2.5 h-2.5" />
          </span>
          <span className="text-[11px] text-sky-950 font-bold">
            Light Blue: <span className="font-semibold text-sky-800">Auto-populated / System-filled</span>
          </span>
        </div>

        {/* Mandatory */}
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-[#FFECEC] border border-[#FCA5A5] flex items-center justify-center text-rose-700 font-black text-[10px] shadow-2xs">
            *
          </span>
          <span className="text-[11px] text-rose-950 font-bold">
            Light Red: <span className="font-semibold text-rose-800">Mandatory / Required Field</span>
          </span>
        </div>

        {/* User Input */}
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-[#FFFFFF] border border-[#D1D5DB] flex items-center justify-center text-slate-500 shadow-2xs">
            <Edit3 className="w-2.5 h-2.5" />
          </span>
          <span className="text-[11px] text-slate-800 font-bold">
            White: <span className="font-semibold text-slate-600">Normal Manual Input</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default FormLegend;

