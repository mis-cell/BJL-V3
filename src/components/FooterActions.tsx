import React from 'react';
import { Printer, ArrowLeft, Save, Loader2 } from 'lucide-react';

interface FooterActionsProps {
  onPrint?: () => void;
  onBack?: () => void;
  onSave?: () => void;
  isLoading?: boolean;
}

export const FooterActions: React.FC<FooterActionsProps> = ({
  onPrint,
  onBack,
  onSave,
  isLoading = false
}) => {
  return (
    <div className="bg-[#174C2C] border-t border-[#0F351E] px-6 py-3.5 flex items-center justify-between text-white -mx-5 -mb-5 mt-5 rounded-b-[17px]">
      <div className="flex items-center gap-3">
        {/* Print Button */}
        <button
          type="button"
          onClick={onPrint}
          className="bg-[#215E38] hover:bg-[#2A7546] active:bg-[#1C5130] text-white border border-[#3A8A57] font-bold text-xs px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
        >
          <Printer className="h-4 w-4 text-emerald-200" />
          <span>Print</span>
        </button>

        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="bg-[#215E38] hover:bg-[#2A7546] active:bg-[#1C5130] text-amber-200 border border-[#3A8A57] font-bold text-xs px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
        >
          <ArrowLeft className="h-4 w-4 text-amber-300" />
          <span>Back (Esc)</span>
        </button>
      </div>

      {/* Center Branding */}
      <div className="hidden md:flex items-center gap-2 px-4 py-1 bg-[#103A20] rounded-lg border border-[#235E39]">
        <span className="text-[11px] font-extrabold text-amber-300 tracking-wider font-serif">BALLY JUTE COMPANY LIMITED</span>
        <span className="text-[9px] font-mono text-emerald-200 uppercase tracking-widest">• ESTD. 1979</span>
      </div>

      {/* Save Contract Button */}
      <button
        type="button"
        onClick={onSave}
        disabled={isLoading}
        className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:from-amber-300 hover:to-amber-200 active:from-amber-500 disabled:opacity-50 text-[#0B2A17] font-black text-xs sm:text-sm px-8 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all cursor-pointer active:scale-95 tracking-wider uppercase border border-amber-200/50"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-[#0B2A17]" />
            <span>SAVING CONTRACT...</span>
          </>
        ) : (
          <>
            <Save className="h-4 w-4 text-[#0B2A17]" />
            <span>SAVE CONTRACT</span>
          </>
        )}
      </button>
    </div>
  );
};

export default FooterActions;
