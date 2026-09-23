import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Shield, Lock, Info, Check, X, AlertTriangle } from "lucide-react";

interface SystemNoticeModalProps {
  message: string;
  onClose: () => void;
  title?: string;
  actionRequiredText?: string;
  statusText?: string;
}

export const SystemNoticeModal: React.FC<SystemNoticeModalProps> = ({
  message,
  onClose,
  title = "SYSTEM NOTICE",
  actionRequiredText = "ACTION REQUIRED",
  statusText = "SESSION AUTO-LOCKED",
}) => {
  const [showLearnMore, setShowLearnMore] = useState(false);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="w-full max-w-lg bg-[#faf8f3] rounded-2xl shadow-2xl border-2 border-amber-400/60 overflow-hidden relative font-sans text-slate-800"
        >
          {/* Top Header Bar */}
          <div className="bg-gradient-to-r from-[#750718] via-[#4a0d25] to-[#1e0b3a] text-white px-5 py-3.5 flex justify-between items-center border-b border-amber-400/40 relative">
            <div className="flex items-center gap-3">
              {/* Alert Icon Circle */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-200 flex items-center justify-center shadow-md shrink-0">
                <span className="text-white font-black text-xl leading-none drop-shadow">!</span>
              </div>
              <div className="flex flex-col">
                <h3 className="text-base sm:text-lg font-black tracking-wider uppercase text-white leading-tight drop-shadow-sm">
                  {title}
                </h3>
                <div className="flex items-center gap-1.5 text-amber-300 text-[10px] sm:text-[11px] font-bold tracking-[0.2em] uppercase opacity-95">
                  <span className="opacity-60">—</span>
                  <span>{actionRequiredText}</span>
                  <span className="opacity-60">—</span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-white/20 bg-white/10 hover:bg-white/25 active:scale-95 text-white/90 flex items-center justify-center transition-all cursor-pointer"
              title="Close Notice"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Main Body */}
          <div className="p-6 sm:p-8 bg-[#f8f6f0] relative flex flex-col items-center text-center overflow-hidden">
            {/* Background Dot Grid Pattern */}
            <div className="absolute inset-0 opacity-25 pointer-events-none bg-[radial-gradient(#b8985c_1px,transparent_1px)] [background-size:14px_14px]" />

            {/* Center Lock Emblem */}
            {/* <div className="relative mb-5 flex items-center justify-center">
             
              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full border-2 border-dashed border-amber-400/60 flex items-center justify-center p-2 bg-amber-50/30 relative">
                
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400 shadow-sm" />
                <span className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 shadow-sm" />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400 shadow-sm" />

                
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-b from-amber-50 via-white to-amber-100/80 border-2 border-amber-300/80 shadow-lg flex items-center justify-center relative">
                  
                  <Shield className="w-16 h-16 text-amber-200/50 absolute stroke-[1]" />
                  
                  
                  <div className="relative z-10 p-2 rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 text-white shadow-md">
                    <Lock className="w-8 h-8 sm:w-9 sm:h-9 stroke-[2.2] fill-amber-100/20 text-white" />
                  </div>
                </div>
              </div>
            </div> */}

            {/* Section Subtitle */}
            {/* <div className="flex items-center justify-center gap-2.5 text-[#3d0818] font-black text-base sm:text-lg tracking-wider uppercase my-1">
              <span className="text-amber-500 tracking-widest text-xs">◆ ◆ ◆</span>
              <span>{statusText}</span>
              <span className="text-amber-500 tracking-widest text-xs">◆ ◆ ◆</span>
            </div> */}

            {/* Shield Divider */}
            {/* <div className="flex items-center justify-center gap-3 w-full max-w-xs my-2.5">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />
              <div className="w-6 h-6 rounded-md bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shadow-2xs">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />
            </div> */}

            {/* Notice Message Payload */}
            <p className="text-slate-700 font-medium text-xs sm:text-sm max-w-sm leading-relaxed my-2">
              {message}
            </p>

            {/* Learn More Expandable Details */}
            {showLearnMore && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full max-w-sm mt-3 p-3 bg-amber-50/80 border border-amber-300/70 rounded-xl text-left text-xs text-amber-900 leading-normal shadow-inner"
              >
                <div className="font-bold flex items-center gap-1.5 mb-1 text-[#5c0b1d]">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Security Protocol Details:</span>
                </div>
                For security compliance and to protect sensitive Jute Mill records, idle user sessions are automatically suspended after 15 minutes of continuous inactivity. Please acknowledge to return to the sign-in prompt.
              </motion.div>
            )}

            {/* Action Footer Buttons */}
            <div className="w-full pt-5 mt-3 border-t border-amber-200/80 flex flex-col sm:flex-row items-center justify-center gap-3">
              {/* Learn More Button */}
              {/* <button
                type="button"
                onClick={() => setShowLearnMore(!showLearnMore)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border-2 border-amber-500/80 bg-white hover:bg-amber-50/80 text-[#3d0818] font-black text-[11px] tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
              >
                <div className="w-4 h-4 rounded-full border border-amber-600 text-amber-800 flex items-center justify-center font-serif text-[10px] font-bold">
                  i
                </div>
                <span>{showLearnMore ? "Hide Info" : "Learn More"}</span>
              </button> */}

              {/* Acknowledge & Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#750718] via-[#4a0d25] to-[#1e0b3a] hover:from-[#88081c] hover:to-[#280d4c] text-white font-black text-[11px] tracking-wider uppercase flex items-center justify-center gap-2.5 transition-all shadow-md shadow-maroon-900/30 active:scale-[0.98] cursor-pointer border border-amber-400/40"
              >
                <div className="w-4 h-4 rounded-full bg-white text-[#5c0b1d] flex items-center justify-center shrink-0 shadow-2xs">
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </div>
                <span>Acknowledge & Close</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
