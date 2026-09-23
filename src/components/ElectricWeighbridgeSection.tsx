import React, { useState, useMemo } from "react";
import {
  Scale,
  Search,
  Lock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Info,
  Check,
  X,
  Truck,
  FileText
} from "lucide-react";
import { LorryRecord, UserRole } from "../pages/LorryDispatchSystem";
import { cn } from "../lib/utils";

function safeStr(val: any, fallback = "N/A"): string {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  if (typeof val === "object") {
    if (typeof val.name === "string") return val.name;
    if (typeof val.supp_name === "string") return val.supp_name;
    if (typeof val.brok_name === "string") return val.brok_name;
    if (typeof val.supplier_name === "string") return val.supplier_name;
    if (typeof val.broker_name === "string") return val.broker_name;
    if (val.supplier) return safeStr(val.supplier, fallback);
    if (val.broker) return safeStr(val.broker, fallback);
    return fallback;
  }
  return fallback;
}

interface ElectricWeighbridgeSectionProps {
  lorries: LorryRecord[];
  currentUserRole: UserRole;
  onSaveWeighment: (
    lorryId: string,
    station: "MILL" | "ELECTRIC",
    type: "GROSS" | "TARE",
    weightKg: number
  ) => void;
}

export default function ElectricWeighbridgeSection({
  lorries,
  currentUserRole,
  onSaveWeighment
}: ElectricWeighbridgeSectionProps) {
  // Selected Vehicle for Weighment
  const [selectedLorryId, setSelectedLorryId] = useState<string>("");

  // Search Filter in Pending Queue
  const [searchQuery, setSearchQuery] = useState("");

  // Electric Weight Inputs
  const [electricGrossInput, setElectricGrossInput] = useState<number | "">(9850);
  const [electricTareInput, setElectricTareInput] = useState<number | "">(1610);

  // Unloaded Toggle
  const [isUnloaded, setIsUnloaded] = useState(false);

  // Pending Electric Lorries Queue
  const pendingElectricLorries = useMemo(() => {
    return lorries.filter((l) => {
      return (
        l.status === "ELECTRIC_GROSS_PENDING" ||
        l.status === "ELECTRIC_TARE_PENDING" ||
        l.status === "WAITING_FOR_MILL_GROSS"
      );
    });
  }, [lorries]);

  // Filtered Queue List
  const filteredQueue = useMemo(() => {
    return pendingElectricLorries.filter((l) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        l.lorryNo.toLowerCase().includes(q) ||
        l.gatePassNo.toLowerCase().includes(q) ||
        l.broker.toLowerCase().includes(q)
      );
    });
  }, [pendingElectricLorries, searchQuery]);

  // Active Lorry
  const activeLorry = useMemo(() => {
    return lorries.find((l) => l.id === selectedLorryId);
  }, [lorries, selectedLorryId]);

  // Auto Select Lorry
  const handleSelectLorry = (lorry: LorryRecord) => {
    setSelectedLorryId(lorry.id);
    setElectricGrossInput(lorry.electricGrossWeight || 9850);
    setElectricTareInput(lorry.electricTareWeight || 1610);
    setIsUnloaded(!!lorry.millTareWeight || lorry.status === "ELECTRIC_TARE_PENDING");
  };

  // Submit Handler
  const handleSubmitWeighment = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLorryId || !activeLorry) {
      alert("Please select a vehicle first.");
      return;
    }

    const needsTare = activeLorry.electricGrossWeight && activeLorry.electricGrossWeight > 0;

    if (needsTare) {
      const wt = Number(electricTareInput);
      if (!wt || wt <= 0) {
        alert("Please enter a valid Electric Tare Weight in kg.");
        return;
      }
      onSaveWeighment(activeLorry.id, "ELECTRIC", "TARE", wt);
      alert(`Electric Tare Weight (${wt} kg) Recorded Successfully for Lorry ${activeLorry.lorryNo}!`);
    } else {
      const wt = Number(electricGrossInput);
      if (!wt || wt <= 0) {
        alert("Please enter a valid Electric Gross Weight in kg.");
        return;
      }
      onSaveWeighment(activeLorry.id, "ELECTRIC", "GROSS", wt);
      alert(`Electric Gross Weight (${wt} kg) Recorded Successfully for Lorry ${activeLorry.lorryNo}!`);
    }

    // Reset Form
    setSelectedLorryId("");
  };

  return (
    <div className="space-y-6 text-[#1E331B]">
      
      {/* HEADER STATION BANNER */}
      <div className="bg-[#F4EFE6] border border-[#C5BA9E] p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#C5BA9E] pb-3 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#1E331B] text-[#FAF7F0] rounded-2xl shrink-0">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#1E331B] uppercase tracking-wider font-mono">
                Electric Weighbridge Station
              </h2>
              <p className="text-xs text-[#5A6E54] font-medium">
                High-precision electric weighment check station
              </p>
            </div>
          </div>

          <span className="px-3 py-1 bg-amber-100 border border-amber-300 text-amber-900 text-xs font-mono font-bold rounded-full shrink-0">
            {pendingElectricLorries.length} Vehicles Pending
          </span>
        </div>

        {/* SEARCHABLE DROPDOWN SELECTOR */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[#5A6E54] uppercase tracking-wider block">
            Select Vehicle ({pendingElectricLorries.length} Pending)
          </label>
          <select
 id="selectedlorryid_147" name="selectedlorryid" aria-label="selectedlorryid"            value={selectedLorryId}
            onChange={(e) => {
              const l = lorries.find((x) => x.id === e.target.value);
              if (l) handleSelectLorry(l);
              else setSelectedLorryId("");
            }}
            className="w-full bg-[#FAF7F0] border border-[#C5BA9E] text-xs font-mono font-bold text-[#1E331B] p-3 rounded-xl outline-none focus:border-[#1E331B]"
          >
            <option value="">-- Choose Vehicle for Electric Weighment --</option>
            {pendingElectricLorries.map((l) => (
              <option key={l.id} value={l.id}>
                {l.lorryNo} ({l.gatePassNo} - {l.broker} - {l.department})
              </option>
            ))}
          </select>
        </div>

        {/* SELECTED VEHICLE CARD */}
        {activeLorry && (
          <div className="bg-[#FAF7F0] border-2 border-[#1E331B] p-4 rounded-2xl space-y-4 animate-fade-in shadow-xs">
            <div className="flex items-center justify-between border-b border-[#C5BA9E] pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#1E331B]" />
                <div>
                  <h3 className="text-sm font-black text-[#1E331B] font-mono">{activeLorry.lorryNo}</h3>
                  <p className="text-[11px] text-[#5A6E54]">Gate Pass: <strong className="text-[#1E331B] font-mono">{activeLorry.gatePassNo}</strong></p>
                </div>
              </div>

              <button
                onClick={() => setSelectedLorryId("")}
                className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Clear Selection
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-[#F4EFE6] p-2.5 rounded-xl border border-[#C5BA9E]">
                <span className="text-[10px] text-[#5A6E54] font-bold block uppercase">Party / Broker</span>
                <span className="font-extrabold text-[#1E331B]">{safeStr(activeLorry.broker)}</span>
              </div>
              <div className="bg-[#F4EFE6] p-2.5 rounded-xl border border-[#C5BA9E]">
                <span className="text-[10px] text-[#5A6E54] font-bold block uppercase">Department</span>
                <span className="font-extrabold text-[#1E331B]">{safeStr(activeLorry.department)}</span>
              </div>
              <div className="bg-[#F4EFE6] p-2.5 rounded-xl border border-[#C5BA9E]">
                <span className="text-[10px] text-[#5A6E54] font-bold block uppercase">Mokam / Marka</span>
                <span className="font-extrabold text-[#1E331B]">{safeStr(activeLorry.mokam)} / {safeStr(activeLorry.marka)}</span>
              </div>
            </div>

            {/* WEIGHT INPUT & VERIFICATION FORM */}
            <form onSubmit={handleSubmitWeighment} className="space-y-4 pt-2 border-t border-[#C5BA9E]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Electric Gross Weight Input */}
                <div>
                  <label htmlFor="electric_gross_weight_kg_211" className="text-[10px] font-bold text-[#5A6E54] uppercase block mb-1">
                    Electric Gross Weight (kg)
                  </label>
                  <div className="relative">
                    <Scale className="w-4 h-4 text-[#5A6E54] absolute left-3 top-3" />
                    <input
 id="electric_gross_weight_kg_211" name="electric_gross_weight_kg" aria-label="Electric Gross Weight (kg)"                      type="number"
                      disabled={!!activeLorry.electricGrossWeight && currentUserRole !== "SUPER_ADMIN"}
                      value={electricGrossInput}
                      onChange={(e) => setElectricGrossInput(e.target.value ? Number(e.target.value) : "")}
                      placeholder="e.g. 9850"
                      className={cn(
                        "w-full border rounded-xl pl-10 pr-3 py-2 text-sm font-mono font-bold outline-none",
                        activeLorry.electricGrossWeight
                          ? "bg-slate-200 text-slate-700 border-slate-300 cursor-not-allowed"
                          : "bg-[#F4EFE6] text-[#1E331B] border-[#C5BA9E] focus:border-[#1E331B]"
                      )}
                    />
                  </div>
                  {activeLorry.electricGrossWeight && (
                    <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1 mt-1">
                      <Lock className="w-3 h-3" /> 🔒 Electric Gross Weight Recorded ({activeLorry.electricGrossWeight} kg)
                    </span>
                  )}
                </div>

                {/* Electric Tare Weight Input */}
                <div>
                  <label htmlFor="electric_tare_weight_kg_239" className="text-[10px] font-bold text-[#5A6E54] uppercase block mb-1">
                    Electric Tare Weight (kg)
                  </label>
                  <div className="relative">
                    <Scale className="w-4 h-4 text-[#5A6E54] absolute left-3 top-3" />
                    <input
 id="electric_tare_weight_kg_239" name="electric_tare_weight_kg" aria-label="Electric Tare Weight (kg)"                      type="number"
                      disabled={!activeLorry.electricGrossWeight || (!!activeLorry.electricTareWeight && currentUserRole !== "SUPER_ADMIN")}
                      value={electricTareInput}
                      onChange={(e) => setElectricTareInput(e.target.value ? Number(e.target.value) : "")}
                      placeholder="e.g. 1610"
                      className={cn(
                        "w-full border rounded-xl pl-10 pr-3 py-2 text-sm font-mono font-bold outline-none",
                        !activeLorry.electricGrossWeight || activeLorry.electricTareWeight
                          ? "bg-slate-200 text-slate-700 border-slate-300 cursor-not-allowed"
                          : "bg-[#F4EFE6] text-[#1E331B] border-[#C5BA9E] focus:border-[#1E331B]"
                      )}
                    />
                  </div>

                  {!activeLorry.electricGrossWeight && (
                    <span className="text-[10px] font-bold text-amber-800 flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3 h-3" /> Tare Weight is active after Gross Weight entry
                    </span>
                  )}

                  {activeLorry.electricTareWeight && (
                    <span className="text-[10px] font-bold text-emerald-800 flex items-center gap-1 mt-1">
                      <Lock className="w-3 h-3" /> 🔒 Electric Tare Weight Recorded ({activeLorry.electricTareWeight} kg)
                    </span>
                  )}
                </div>
              </div>

              {/* Dynamic Net Weight Calculation */}
              {Number(electricGrossInput) > 0 && Number(electricTareInput) > 0 && (
                <div className="bg-emerald-100 border border-emerald-400 p-3.5 rounded-xl text-emerald-950 font-mono font-extrabold text-sm flex items-center justify-between">
                  <span>Calculated Electric Net Weight:</span>
                  <span className="text-base font-black text-emerald-900">
                    {(Number(electricGrossInput) - Number(electricTareInput)).toLocaleString()} KG
                  </span>
                </div>
              )}

              {/* Unloading Verification Toggle */}
              <div className="flex items-center justify-between bg-[#F4EFE6] p-3 rounded-xl border border-[#C5BA9E]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={cn("w-5 h-5", isUnloaded ? "text-emerald-700" : "text-[#5A6E54]")} />
                  <div>
                    <span className="text-xs font-bold text-[#1E331B]">Unloading Verification Status</span>
                    <p className="text-[10px] text-[#5A6E54]">Confirm material has been fully unloaded in department yard</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsUnloaded(!isUnloaded)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5",
                    isUnloaded
                      ? "bg-emerald-700 text-white shadow-xs"
                      : "bg-[#EAE2D2] text-[#1E331B] hover:bg-[#C5BA9E]"
                  )}
                >
                  {isUnloaded ? "Status: UNLOADED ✓" : "Mark Unloaded"}
                </button>
              </div>

              {/* Contextual Action Button */}
              <button
                type="submit"
                className="w-full py-3 bg-[#1E331B] hover:bg-[#2D4D28] text-[#FAF7F0] font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>
                  {activeLorry.electricGrossWeight && activeLorry.electricGrossWeight > 0
                    ? "Submit Electric Tare Weight"
                    : "Submit Electric Gross Weight"}
                </span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* PENDING QUEUE & SEARCH LIST */}
      <div className="bg-[#F4EFE6] border border-[#C5BA9E] p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#C5BA9E] pb-3">
          <h3 className="text-sm font-black text-[#1E331B] uppercase tracking-wider font-mono">
            Pending Electric Weighment Queue ({filteredQueue.length})
          </h3>
        </div>

        {/* Live Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#5A6E54] absolute left-3.5 top-3" />
          <input
 id="search_pending_queue_by_v_330" name="search_pending_queue_by_v" aria-label="Search pending queue by vehicle number or gate pass..."            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pending queue by vehicle number or gate pass..."
            className="w-full bg-[#FAF7F0] border border-[#C5BA9E] text-xs text-[#1E331B] font-mono pl-10 pr-4 py-2.5 rounded-xl outline-none focus:border-[#1E331B]"
          />
        </div>

        <div className="space-y-3">
          {filteredQueue.length === 0 ? (
            <div className="bg-[#FAF7F0] border-2 border-dashed border-[#C5BA9E] rounded-2xl p-8 text-center space-y-2 text-[#5A6E54]">
              <Scale className="w-8 h-8 text-[#1E331B] mx-auto" />
              <h4 className="text-xs font-black uppercase text-[#1E331B] font-mono">
                No Vehicles Pending Electric Scale Weighment
              </h4>
              <p className="text-xs">Electric scale queue is empty.</p>
            </div>
          ) : (
            filteredQueue.map((l) => (
              <div
                key={l.id}
                className="bg-[#FAF7F0] border border-[#C5BA9E] hover:border-[#1E331B] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all shadow-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-[#1E331B] font-mono">{l.lorryNo}</span>
                    <span className="px-2 py-0.5 bg-[#1E331B]/10 text-[#1E331B] text-xs font-mono font-bold rounded">
                      {l.gatePassNo}
                    </span>
                    <span className="px-2 py-0.5 bg-cyan-100 text-cyan-900 text-[10px] font-bold uppercase rounded">
                      {l.department}
                    </span>
                  </div>

                  <p className="text-xs text-[#5A6E54]">
                    Party: <strong className="text-[#1E331B]">{safeStr(l.broker)}</strong> | Status: <span className="font-bold uppercase text-[#1E331B]">{l.status.replace(/_/g, " ")}</span>
                  </p>
                </div>

                <button
                  onClick={() => handleSelectLorry(l)}
                  className="px-4 py-2 bg-[#1E331B] hover:bg-[#2D4D28] text-[#FAF7F0] font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                >
                  <Scale className="w-4 h-4" />
                  <span>Weigh</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}
