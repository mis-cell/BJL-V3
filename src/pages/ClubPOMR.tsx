import React, { useState, useEffect } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { 
  Link, 
  Unlink, 
  Search, 
  HelpCircle, 
  CheckCircle2, 
  Scale, 
  FileCheck, 
  FileText, 
  ArrowRight, 
  ChevronRight, 
  Info, 
  TrendingUp, 
  RefreshCw, 
  Printer, 
  Trash2, 
  Sparkles,
  Download,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PaginationControls } from '../components/PaginationControls';
import { supabase } from '../lib/supabase';
import { dbModule } from '../services/dbModule';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import PrintModal from '../components/PrintModal';

interface ClubbingRecord {
  id: string;
  clubbedAt: string;
  supplier: string;
  poNos: string[];
  amadNos: string[];
  totalPoWeight: number;
  totalReceivedWeight: number;
  variancePct: number;
  recordedBy: string;
  remarks: string;
}

const inMemoryClubbedHistory: ClubbingRecord[] = [];

export default function ClubPOMR({ onClose }: { onClose?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  
  // Data lists based on selection
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [materialReceipts, setMaterialReceipts] = useState<any[]>([]);
  const [unclubbedMrs, setUnclubbedMrs] = useState<any[]>([]);
  const [selectedDetailMr, setSelectedDetailMr] = useState<any | null>(null);
  const [selectedInspection, setSelectedInspection] = useState<any | null>(null);
  
  // Selection check states
  const [selectedPos, setSelectedPos] = useState<string[]>([]);
  const [selectedAmads, setSelectedAmads] = useState<string[]>([]);
  
  // Clubbed History
  const [clubbingHistory, setClubbingHistory] = useState<ClubbingRecord[]>([]);
  const [remarks, setRemarks] = useState('');

  // 100-rows per page pagination (searches full dataset, displays paginated)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSupplier]);
  
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [printingClub, setPrintingClub] = useState<ClubbingRecord | null>(null);

  // Initialize and load suppliers
  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch tables
      const [allPos, allAmads, allFinalArrivals, allInspections] = await Promise.all([
        dbModule.fetchAll('purchase_master').catch(() => []),
        dbModule.fetchAll('temporary_material_received').catch(() => []),
        dbModule.fetchAll('final_arrival').catch(() => []),
        dbModule.fetchAll('mill_inspection_master').catch(() => [])
      ]);

      // Extract unique suppliers from tables
      const supplierSet = new Set<string>();
      allPos.forEach((p: any) => { if (p.supplier) supplierSet.add(p.supplier); });
      allAmads.forEach((a: any) => { if (a.supplier) supplierSet.add(a.supplier); });
      allFinalArrivals.forEach((f: any) => { if (f.supplier) supplierSet.add(f.supplier); });
      allInspections.forEach((i: any) => { if (i.supplier_name) supplierSet.add(i.supplier_name); });

      const suppliersList = Array.from(supplierSet).sort();
      setSuppliers(suppliersList);

      // Default select to 'ALL'
      if (!selectedSupplier) {
        setSelectedSupplier('ALL');
      }

      setClubbingHistory(inMemoryClubbedHistory);

    } catch (err) {
      console.error('Error loading Master entries:', err);
    } finally {
      setLoading(false);
    }
  };

  // When supplier switches, fetch their open POs, unclassified MR entries and un-clubbed final arrivals
  const fetchSupplierDocuments = async (supplierName: string) => {
    if (!supplierName) return;
    setLoading(true);
    try {
      const [allPos, allFinalArrivals, allInspections, allInspectionDetails] = await Promise.all([
        dbModule.fetchAll('purchase_master').catch(() => []),
        dbModule.fetchAll('final_arrival').catch(() => []),
        dbModule.fetchAll('mill_inspection_master').catch(() => []),
        dbModule.fetchAll('mill_inspection_detail').catch(() => [])
      ]);

      const isAll = supplierName === 'ALL';

      // Filter POs
      const filteredPos = isAll ? allPos : allPos.filter((p: any) => p.supplier === supplierName);
      
      // Filter Material Inspections
      const filteredInspections = isAll 
        ? allInspections 
        : allInspections.filter((a: any) => String(a.supplier_name || '').trim().toUpperCase() === supplierName.trim().toUpperCase());

      // Enrich with weights and bales
      const enrichedInspections = filteredInspections.map((insp: any) => {
        const matchingDetails = allInspectionDetails.filter((d: any) => d.mr_no === insp.mr_no);
        const totalWeight = matchingDetails.reduce((sum: number, d: any) => sum + (Number(d.challan_gross_wt) || 0), 0);
        const totalBales = matchingDetails.reduce((sum: number, d: any) => sum + (Number(d.quantity) || 0), 0);
        return {
          ...insp,
          total_weight: totalWeight,
          total_bales: totalBales,
          details: matchingDetails
        };
      });

      // Filter unclubbed final arrivals where Mill P.O No is empty/blank
      const filteredFinalArrivals = allFinalArrivals.filter((fa: any) => {
        const isPoBlank = !fa.po_no || fa.po_no.trim() === '' || fa.po_no.trim().toLowerCase() === 'no' || fa.po_no.trim().toUpperCase() === 'N/A';
        const matchesSupplier = isAll || String(fa.supplier || fa.challan_supplier || '').trim().toUpperCase() === supplierName.trim().toUpperCase();
        return isPoBlank && matchesSupplier;
      });

      setPurchaseOrders(filteredPos);
      setMaterialReceipts(enrichedInspections);
      setUnclubbedMrs(filteredFinalArrivals);
      
      // Clear selections on supplier change
      setSelectedPos([]);
      setSelectedAmads([]);
    } catch (err) {
      console.error('Error fetching documents for supplier:', err);
    } finally {
      setLoading(false);
    }
  };

  useLiveAutoRefresh(loadInitialData, [], { tables: ['purchase_master', 'temporary_material_received', 'final_arrival'] });
  useLiveAutoRefresh(() => {
    if (selectedSupplier) fetchSupplierDocuments(selectedSupplier);
  }, [selectedSupplier], { tables: ['purchase_master', 'temporary_material_received', 'final_arrival'] });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedSupplier) {
      fetchSupplierDocuments(selectedSupplier);
    }
  }, [selectedSupplier]);

  const toggleSelectPo = (arrivalNo: string) => {
    setSelectedPos(prev => 
      prev.includes(arrivalNo) ? prev.filter(p => p !== arrivalNo) : [...prev, arrivalNo]
    );
  };

  const toggleSelectAmad = (mrNo: string) => {
    setSelectedAmads(prev => 
      prev.includes(mrNo) ? prev.filter(a => a !== mrNo) : [...prev, mrNo]
    );
  };

  const handleUnclubInspection = async (mrNo: string) => {
    setLoading(true);
    try {
      await dbModule.update('material_inspection', 'mr_no', mrNo, {
        arrival_no: "",
        po_no: "",
        mill_po_no: ""
      });
      setSuccessToast(`Successfully un-clubbed Sauda Check Point and P.O for inspection: ${mrNo}`);
      setSelectedInspection(null);
      
      // Refresh documents
      if (selectedSupplier) {
        fetchSupplierDocuments(selectedSupplier);
      }
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      console.error('Error un-clubbing inspection:', err);
      setSuccessToast(`Failed to un-club: ${err.message || err}`);
      setTimeout(() => setSuccessToast(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const executeClubbing = () => {
    if (selectedPos.length === 0 || selectedAmads.length === 0) return;

    // Calculate aggregated weights
    const totalPoWt = unclubbedMrs
      .filter(mr => selectedPos.includes(mr.final_arrival_no))
      .reduce((sum, current) => sum + ((current.weight_qtl || 0) / 10), 0);

    const totalReceivedWt = materialReceipts
      .filter(a => selectedAmads.includes(a.mr_no))
      .reduce((sum, current) => sum + (current.total_weight || 0), 0);

    const variance = totalPoWt > 0 ? ((totalReceivedWt - totalPoWt) / totalPoWt) * 100 : 0;

    let finalSupplier = selectedSupplier;
    if (selectedSupplier === 'ALL' && selectedPos.length > 0) {
      const firstMr = unclubbedMrs.find(mr => mr.final_arrival_no === selectedPos[0]);
      if (firstMr) {
        finalSupplier = firstMr.supplier || firstMr.challan_supplier || 'MULTI-SUPPLIER';
      }
    }

    const newClub: ClubbingRecord = {
      id: `CLUB-${Date.now().toString().slice(-4)}`,
      clubbedAt: new Date().toISOString().split('T')[0],
      supplier: finalSupplier,
      poNos: [...selectedPos],
      amadNos: [...selectedAmads],
      totalPoWeight: totalPoWt,
      totalReceivedWeight: totalReceivedWt,
      variancePct: variance,
      recordedBy: 'SYSTEM-AUDITOR',
      remarks: remarks || 'Manual operational mapping Alignment'
    };

    const updatedHistory = [newClub, ...clubbingHistory];
    inMemoryClubbedHistory.length = 0;
    inMemoryClubbedHistory.push(...updatedHistory);
    setClubbingHistory(updatedHistory);

    setRemarks('');
    setSelectedPos([]);
    setSelectedAmads([]);
    setSuccessToast(`Vouchers successfully clubbed. ID: ${newClub.id}`);
    
    // Refresh lists
    if (selectedSupplier) {
      fetchSupplierDocuments(selectedSupplier);
    }
    
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const deleteClubItem = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this clubbed record?")) return;
    try {
      if (supabase) {
        await supabase.from('clubbed_pomr').delete().eq('id', id);
      }
      const updated = clubbingHistory.filter(c => c.id !== id);
      inMemoryClubbedHistory.length = 0;
      inMemoryClubbedHistory.push(...updated);
      setClubbingHistory(updated);
      setSuccessToast(`Pairing record deleted.`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      console.error("Delete pairing error:", err);
      alert("Failed to delete pairing record: " + (err.message || err));
    }
  };

  // Computed values
  const totalPoWeight = unclubbedMrs
    .filter(mr => selectedPos.includes(mr.final_arrival_no))
    .reduce((sum, current) => sum + ((current.weight_qtl || 0) / 10), 0);

  const totalReceivedWeight = materialReceipts
    .filter(a => selectedAmads.includes(a.mr_no))
    .reduce((sum, current) => sum + (current.total_weight || 0), 0);

  const variancePct = totalPoWeight > 0 ? ((totalReceivedWeight - totalPoWeight) / totalPoWeight) * 100 : 0;

  return (
    <LegacyLayout title="Club" subtitle="">
      <div className="space-y-6 max-w-full px-1 sm:px-4 text-left">
        
        {/* Top Supplier Selection panel */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">Account Alignment</span>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide mt-1">Open Vouchers Matching Console</h2>
              <p className="text-[10.5px] text-slate-500 font-bold uppercase tracking-tight mt-1">
                Showing all open vouchers across all active Jute suppliers for consolidation.
              </p>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={loadInitialData}
                className="p-2 px-3 border border-slate-200 rounded-lg hover:bg-slate-100 transition cursor-pointer flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-slate-700 bg-slate-50 shadow-sm"
                title="Refresh master files"
              >
                <RefreshCw className="h-3.5 w-3.5 text-indigo-700 animate-hover" />
                <span>Refresh Data</span>
              </button>
            </div>
          </div>
        </div>

        {/* Success Alert */}
        {successToast && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Dynamic Vouchers Matcher Dual Screen Board */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Clubbed M.R and P.O Block (Column-5) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 p-4.5 rounded-xl shadow-sm space-y-4">
            <div className="border-b border-zinc-100 pb-2.5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="h-[18px] w-[18px] text-blue-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Clubbed M.R and P.O</h3>
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/50">
                {unclubbedMrs.length} M.Rs
              </span>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {unclubbedMrs.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider">No Clubbed M.R and P.O Found</p>
                </div>
              ) : (
                unclubbedMrs.map((mr, idx) => {
                  const isChecked = selectedPos.includes(mr.final_arrival_no);
                  const weightMt = mr.weight_qtl ? (parseFloat(mr.weight_qtl) / 10).toFixed(2) : '0.00';
                  return (
                    <div
                      key={mr.final_arrival_no || idx}
                      onClick={() => setSelectedDetailMr(mr)}
                      className={cn(
                        "p-3.5 rounded-lg border transition-all duration-150 cursor-pointer flex justify-between items-center  group relative",
                        isChecked 
                          ? "bg-slate-900 border-slate-900 text-white" 
                          : "bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-[10.5px] font-black font-mono",
                            isChecked ? "text-white" : "text-slate-800"
                          )}>
                            {mr.final_arrival_no || 'FA-N/A'}
                          </span>
                          <span className="text-[8.5px] font-extrabold uppercase tracking-wide opacity-50">• Date: {mr.date || mr.final_arrival_date}</span>
                        </div>
                        <p className={cn(
                          "text-[9px] font-extrabold uppercase",
                          isChecked ? "text-slate-300" : "text-slate-400"
                        )}>
                          Challan: {mr?.challan_rr_no || 'N/A'} • Lorry: {mr?.lorry_number || (mr as any)?.lorry_no || (mr as any)?.vehicle_no || 'N/A'}
                        </p>
                        
                        <span className={cn(
                          "text-[8px] font-extrabold uppercase block tracking-tight truncate max-w-[220px] mt-0.5",
                          isChecked ? "text-indigo-200" : "text-indigo-600 bg-indigo-50/70 px-1.5 py-0.5 rounded-sm border border-indigo-100/50 inline-block"
                        )}>
                          Supplier: {mr.supplier || mr.challan_supplier || 'N/A'}
                        </span>
                        
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectPo(mr.final_arrival_no);
                            }}
                            className={cn(
                              "text-[8.5px] font-extrabold px-1.5 py-0.5 rounded border transition-all uppercase",
                              isChecked
                                ? "bg-white/10 hover:bg-white/20 text-white border-white/20"
                                : "bg-indigo-50 hover:bg-indigo-150 text-indigo-700 border-indigo-200"
                            )}
                          >
                            {isChecked ? 'Selected' : 'Select to Bind'}
                          </button>
                          <span className="text-[8px] font-bold text-slate-400 uppercase  opacity-60">Click card for details</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black block">
                          {weightMt} MT
                        </span>
                        <span className="text-[8px] font-black opacity-50 uppercase tracking-tight block">
                          {mr.total_packets || mr.packets || '0'} Bales
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Action Joiner (Column-2) */}
          <div className="lg:col-span-2 flex flex-col justify-center items-center h-full min-h-[140px] gap-3">
            <div className="bg-indigo-50 border border-indigo-100/50 p-4 rounded-xl text-center shadow-inner w-full space-y-3">
              <div className="relative">
                <Link className="h-6 w-6 text-indigo-700 mx-auto animate-pulse" />
              </div>
              <h4 className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider font-mono">Aggregation Summary</h4>

              <div className="space-y-2 text-left text-[10px] font-mono">
                <div className="flex justify-between border-b border-indigo-100/30 pb-1">
                  <span className="text-slate-400 uppercase font-bold">Final MR Wt:</span>
                  <span className="font-extrabold text-indigo-950">{totalPoWeight.toFixed(2)} MT</span>
                </div>
                <div className="flex justify-between border-b border-indigo-100/30 pb-1">
                  <span className="text-slate-400 uppercase font-bold">Temp MR Wt:</span>
                  <span className="font-extrabold text-indigo-950">{totalReceivedWeight.toFixed(2)} MT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 uppercase font-bold">Variance:</span>
                  <span className={cn(
                    "font-black",
                    variancePct > 0 ? "text-emerald-600" : variancePct < 0 ? "text-rose-500" : "text-slate-600"
                  )}>
                    {variancePct > 0 ? '+' : ''}{variancePct.toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* Remarks Box */}
              <input  id="clubbing_comments_445" name="clubbing_comments" aria-label="Clubbing comments..."
                type="text"
                placeholder="Clubbing comments..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full text-[9px] p-2 bg-white border border-slate-200 focus:outline-none rounded text-slate-705 placeholder:text-zinc-300"
              />

              <button
                onClick={executeClubbing}
                disabled={selectedPos.length === 0 || selectedAmads.length === 0}
                className={cn(
                  "w-full py-2 bg-indigo-700 hover:bg-indigo-850 hover:shadow border border-indigo-700 text-white font-black uppercase text-[9px] tracking-wider rounded-lg transition-all flex items-center justify-center gap-1",
                  (selectedPos.length === 0 || selectedAmads.length === 0) && "opacity-45 cursor-not-allowed hover:bg-indigo-700"
                )}
              >
                <span>Bind Vouchers</span>
              </button>
            </div>
          </div>

                  {/* Material Receipts (Column-5) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 p-4.5 rounded-xl shadow-sm space-y-4">
            <div className="border-b border-zinc-100 pb-2.5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileCheck className="h-[18px] w-[18px] text-teal-600" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">Un-clubbed Material Receipts</h3>
              </div>
              <span className="text-[10px] font-extrabold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/50">
                {materialReceipts.length} Arrivals
              </span>
            </div>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {materialReceipts.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-[10.5px] font-extrabold text-slate-400 uppercase tracking-wider">No Un-clubbed Arrivals</p>
                </div>
              ) : (
                materialReceipts.map((amad, idx) => {
                  const isChecked = selectedAmads.includes(amad.mr_no);
                  const amadWt = amad.total_weight || 0;
                  return (
                    <div
                      key={amad.mr_no || idx}
                      onClick={() => setSelectedInspection(amad)}
                      className={cn(
                        "p-3.5 rounded-lg border transition-all duration-150 cursor-pointer flex justify-between items-center  group relative",
                        isChecked 
                          ? "bg-slate-900 border-slate-900 text-white" 
                          : "bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/50"
                      )}
                    >
                      <div className="space-y-1 text-left">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-[10.5px] font-black font-mono",
                            isChecked ? "text-white" : "text-teal-950"
                          )}>
                            M.R: {amad.mr_no}
                          </span>
                          <span className="text-[8px] font-black uppercase tracking-wide opacity-50">• {amad.mr_date}</span>
                        </div>
                        <p className={cn(
                          "text-[9px] font-extrabold uppercase",
                          isChecked ? "text-slate-300" : "text-slate-450"
                        )}>
                          Temp P.O: <span className="font-mono text-amber-700 font-black">{amad.arrival_no || 'NOT SET'}</span> • P.O: <span className="font-mono text-indigo-700 font-black">{amad.po_no || 'NOT SET'}</span>
                        </p>
                        
                        <span className={cn(
                          "text-[8px] font-extrabold uppercase block tracking-tight truncate max-w-[220px] mt-0.5",
                          isChecked ? "text-teal-200" : "text-teal-600 bg-teal-50/70 px-1.5 py-0.5 rounded-sm border border-teal-100/50 inline-block"
                        )}>
                          Supplier: {amad.supplier_name || 'N/A'}
                        </span>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectAmad(amad.mr_no);
                            }}
                            className={cn(
                              "text-[8.5px] font-extrabold px-1.5 py-0.5 rounded border transition-all uppercase cursor-pointer",
                              isChecked
                                ? "bg-white/10 hover:bg-white/20 text-white border-white/20"
                                : "bg-teal-50 hover:bg-teal-150 text-teal-700 border-teal-200"
                            )}
                          >
                            {isChecked ? 'Selected' : 'Select to Bind'}
                          </button>
                          <span className="text-[8px] font-bold text-slate-400 uppercase  opacity-60">Click card for details</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-black block">
                          {amadWt.toFixed(2)} MT
                        </span>
                        <span className="text-[8px] font-black opacity-50 uppercase tracking-tight block">
                          {amad.total_bales || '0'} Bales
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Clubbing Record Logs Table (Bottom panel) */}
        <div className="bg-white border border-slate-200 p-4.5 rounded-xl shadow-sm space-y-4">
          <div className="border-b border-zinc-100 pb-3 flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Historical Voucher Pairings Register</h3>
              <p className="text-[9.5px] text-slate-400 uppercase font-bold tracking-tight">Vouchers mapped to supplier claims ledger accounting</p>
            </div>
            
            <button 
              onClick={() => {
                const csvContent = "data:text/csv;charset=utf-8," 
                  + ["Binding ID,Date,Supplier,POs Included,Arrivals Included,Total Contract weight,Total Received weight,Deviation %"]
                    .concat(clubbingHistory.map(c => 
                      `"${c.id}","${c.clubbedAt}","${c.supplier}","${c.poNos.join(';') || ''}","${c.amadNos.join(';') || ''}","${c.totalPoWeight}","${c.totalReceivedWeight}","${c.variancePct.toFixed(2)}"`
                    )).join("\n");
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", `BJCL-Binding-Ledger-${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-205 rounded text-[10px] font-extrabold text-slate-700 flex items-center gap-1"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export bindings ledger</span>
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-100/80 rounded-lg">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/60 text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 ">
                  <th className="p-3">Reference ID</th>
                  <th className="p-3 font-mono">Date</th>
                  <th className="p-3">Supplier Name</th>
                  <th className="p-3 text-center">POs Bounded</th>
                  <th className="p-3 text-center">Receipts Bounded</th>
                  <th className="p-3 text-right">PO Contract Weight</th>
                  <th className="p-3 text-right">MR Actual Weight</th>
                  <th className="p-3 text-center">Variance %</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clubbingHistory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 uppercase tracking-wider font-extrabold text-[10px]">
                      No historical voucher pairings established yet
                    </td>
                  </tr>
                ) : (
                  clubbingHistory.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((item) => (
                    <tr key={item.id} className="border-b border-slate-100/65 hover:bg-slate-50/30 transition text-slate-800">
                      <td className="p-3 font-black text-slate-900 uppercase">
                        {item.id}
                      </td>
                      <td className="p-3 font-mono text-[10.5px]">
                        {item.clubbedAt}
                      </td>
                      <td className="p-3 font-bold text-[11px] uppercase">
                        {item.supplier}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-wrap gap-1 justify-center max-w-[150px] mx-auto">
                          {item.poNos.map(p => (
                            <span key={p} className="text-[8.5px] font-semibold bg-gray-100 text-gray-700 border border-gray-200 px-1.5 py-0.5 rounded">
                              {p}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-wrap gap-1 justify-center max-w-[150px] mx-auto">
                          {item.amadNos.map(a => (
                            <span key={a} className="text-[8.5px] font-semibold bg-teal-50 text-teal-800 border border-teal-150 px-1.5 py-0.5 rounded">
                              {a}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {item.totalPoWeight.toFixed(2)} MT
                      </td>
                      <td className="p-3 text-right font-black text-slate-900">
                        {item.totalReceivedWeight.toFixed(2)} MT
                      </td>
                      <td className="p-3 text-center font-bold">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black border",
                          item.variancePct > 0 ? "bg-emerald-50 text-emerald-800 border-emerald-200/50" : 
                          item.variancePct < 0 ? "bg-rose-50 text-rose-800 border-rose-200/50" : "bg-slate-50 text-slate-800 border-slate-205"
                        )}>
                          {item.variancePct > 0 ? '+' : ''}{item.variancePct.toFixed(2)}%
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => setPrintingClub(item)}
                            className="p-1.5 bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-600 hover:text-indigo-700 rounded transition"
                            title="Print binding invoice"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteClubItem(item.id)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 border border-slate-205 hover:border-rose-200 text-slate-500 hover:text-rose-700 rounded transition"
                            title="Delete pairing"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-2">
            <PaginationControls
              currentPage={currentPage}
              totalItems={clubbingHistory.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>

      </div>

      {/* Print Audit Modal */}
      {printingClub && (
        <PrintModal 
          isOpen={!!printingClub} 
          onClose={() => setPrintingClub(null)}
          title={`Binding Statement: ${printingClub.id}`}
        >
          <div className="p-5 space-y-4 text-xs" id="printable-binding-receipt">
            <div className="text-center border-b border-slate-200 pb-3">
              <h2 className="text-sm font-black uppercase text-slate-900">MILL INTEGRATED MANAGEMENT</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">VOUCHERS ASSOCIATION REPORT</p>
            </div>

            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3 text-slate-700">
              <div>
                <p><span className="font-extrabold uppercase text-[9px] text-slate-400 block tracking-wider">BINDING REFERENCE ID</span> <strong>{printingClub.id}</strong></p>
                <p className="mt-2"><span className="font-extrabold uppercase text-[9px] text-slate-400 block tracking-wider">DATE ESTABLISHED</span> {printingClub.clubbedAt}</p>
              </div>
              <div className="text-right">
                <p><span className="font-extrabold uppercase text-[9px] text-slate-400 block tracking-wider">SUPPLIER ACCOUNT</span> <strong className="uppercase text-[11px] text-slate-900">{printingClub.supplier}</strong></p>
                <p className="mt-2"><span className="font-extrabold uppercase text-[9px] text-slate-400 block tracking-wider">AUDITED BY</span> {printingClub.recordedBy}</p>
              </div>
            </div>

            <div>
              <h4 className="font-extrabold uppercase text-[9px] text-slate-400 tracking-wider mb-2">Mapped Vouchers Inventory</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded p-2.5 bg-slate-50/50">
                  <span className="font-bold text-[9px] text-slate-450 block uppercase">POs Mapped</span>
                  <p className="font-mono mt-1 font-semibold text-slate-800 leading-relaxed">
                    {printingClub.poNos.join(', ')}
                  </p>
                </div>
                <div className="border border-slate-200 rounded p-2.5 bg-slate-50/50">
                  <span className="font-bold text-[9px] text-slate-450 block uppercase">Material Receipts (Amads)</span>
                  <p className="font-mono mt-1 font-semibold text-slate-800 leading-relaxed">
                    {printingClub.amadNos.join(', ')}
                  </p>
                </div>
              </div>
            </div>

            {/* Calculations summaries */}
            <div className="border-t border-b border-slate-200 py-3 mt-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Total Contract PO WT</span>
                  <span className="text-xs font-black text-slate-800 block mt-0.5">{printingClub.totalPoWeight.toFixed(2)} MT</span>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Total Received gate WT</span>
                  <span className="text-xs font-black text-slate-800 block mt-0.5">{printingClub.totalReceivedWeight.toFixed(2)} MT</span>
                </div>
                <div>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase block">Discrepancy Variance</span>
                  <span className={cn(
                    "text-xs font-black block mt-0.5",
                    printingClub.variancePct > 0 ? "text-emerald-600" : printingClub.variancePct < 0 ? "text-rose-500" : "text-slate-600"
                  )}>
                    {printingClub.variancePct > 0 ? '+' : ''}{printingClub.variancePct.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {printingClub.remarks && (
              <div className="bg-slate-50 p-2.5 border border-slate-150 rounded">
                <span className="font-extrabold text-[8.5px] text-slate-400 block uppercase">Sign-off Remarks</span>
                <p className="italic text-slate-600 mt-1 font-semibold">"{printingClub.remarks}"</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-8 text-[9px] text-slate-400 uppercase font-bold tracking-widest leading-none ">
              <span>Sign (Authorized Jute Mill Executive)</span>
              <span>Sign (Audit Desk)</span>
            </div>
          </div>
        </PrintModal>
      )}

      {/* Un-clubbed M.R Details Modal Popup */}
      {selectedDetailMr && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-300 w-full max-w-4xl rounded-xl shadow-2xl flex flex-col font-sans overflow-hidden max-h-[92vh] animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-3.5 flex justify-between items-center px-5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="h-[18px] w-[18px] text-teal-400" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider">Material Receipt All Details</h3>
                  <p className="text-[9px] font-mono opacity-65 uppercase tracking-tight mt-0.5">Reference ID: {selectedDetailMr.final_arrival_id}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDetailMr(null)}
                className="p-1 hover:bg-slate-800 rounded transition text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-800 bg-slate-50/50">
              {/* Row 1: Vital Stats badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center shadow-sm">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 block tracking-wider">Final Arrival No</span>
                  <span className="font-mono font-black text-sm text-slate-900">{selectedDetailMr.final_arrival_no || 'N/A'}</span>
                </div>
                <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center shadow-sm">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 block tracking-wider">Temporary MR No</span>
                  <span className="font-mono font-black text-sm text-slate-900">{selectedDetailMr.temporary_arrival_no || 'N/A'}</span>
                </div>
                <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center shadow-sm">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 block tracking-wider font-mono">Date</span>
                  <span className="font-mono font-black text-xs text-slate-900">{selectedDetailMr.date || selectedDetailMr.final_arrival_date || 'N/A'}</span>
                </div>
                <div className="bg-white border border-slate-200 p-2.5 rounded-lg text-center shadow-sm">
                  <span className="text-[8px] font-extrabold uppercase text-slate-400 block tracking-wider">Financial Year</span>
                  <span className="font-mono font-black text-xs text-indigo-700">{selectedDetailMr.financial_year || 'N/A'}</span>
                </div>
              </div>

              {/* Box 1: Supplier & Buyer info */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5 mb-3">Supplier & Logistics Identification</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5 text-left">
                    <p><span className="font-extrabold text-slate-450 uppercase tracking-tight block text-[8.5px]">Supplier Name</span> <strong className="uppercase text-slate-900">{selectedDetailMr.supplier || 'N/A'}</strong></p>
                    <p className="pt-1.5"><span className="font-extrabold text-slate-450 uppercase tracking-tight block text-[8.5px]">Challan Supplier</span> <strong className="uppercase text-slate-700">{selectedDetailMr.challan_supplier || 'N/A'}</strong></p>
                  </div>
                  <div className="space-y-1.5 text-left md:border-l md:border-dashed md:border-slate-200 md:pl-4">
                    <p><span className="font-extrabold text-slate-450 uppercase tracking-tight block text-[8.5px]">Broker</span> <strong className="uppercase text-slate-900">{selectedDetailMr.broker || 'N/A'}</strong></p>
                    <div className="grid grid-cols-2 gap-2 pt-1.5">
                      <div>
                        <span className="font-extrabold text-slate-450 uppercase tracking-tight block text-[8.5px]">Arrival Yard</span> 
                        <strong className="uppercase text-slate-700">{selectedDetailMr.arrival_area_name || 'N/A'}</strong>
                      </div>
                      <div>
                        <span className="font-extrabold text-slate-450 uppercase tracking-tight block text-[8.5px]">Unit Spec</span> 
                        <strong className="uppercase text-slate-700">{selectedDetailMr.unit_name || 'BALES'}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Box 2: Dispatch and vehicle vouchers */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5 mb-3">Lorry, Challan & Invoice Reference</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
                  <div>
                    <span className="font-extrabold text-slate-405 uppercase tracking-tight block text-[8.5px]">Lorry Number / Date</span>
                    <strong className="text-slate-800 uppercase block mt-0.5">{selectedDetailMr?.lorry_number || (selectedDetailMr as any)?.lorry_no || (selectedDetailMr as any)?.vehicle_no || 'N/A'}</strong>
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">{selectedDetailMr.lorry_date || ''}</span>
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-405 uppercase tracking-tight block text-[8.5px]">Transporter</span>
                    <strong className="text-slate-800 uppercase block mt-0.5">{selectedDetailMr.transporter_name || 'N/A'}</strong>
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-405 uppercase tracking-tight block text-[8.5px]">Challan / RR No & Date</span>
                    <strong className="text-slate-800 uppercase block mt-0.5">{selectedDetailMr.challan_rr_no || 'N/A'}</strong>
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">{selectedDetailMr.challan_rr_date || ''}</span>
                  </div>
                  <div>
                    <span className="font-extrabold text-slate-405 uppercase tracking-tight block text-[8.5px]">Invoice No & Date</span>
                    <strong className="text-indigo-850 uppercase block mt-0.5">{selectedDetailMr.invoice_no || 'N/A'}</strong>
                    <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">{selectedDetailMr.invoice_date || ''}</span>
                  </div>
                </div>
              </div>

              {/* Box 3: Weight metrics dual table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                  <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5 mb-3">Challan vs Gate weight (MT)</h4>
                  <div className="space-y-2 text-left font-mono text-[11px]">
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span className="text-slate-400 font-bold uppercase">Challan Material Wt:</span>
                      <span className="font-black text-slate-800">{selectedDetailMr.challan_material_weight || '0.00'} MT</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span className="text-slate-400 font-bold uppercase">Actual Weight (m.T):</span>
                      <span className="font-black text-slate-800">{(parseFloat(selectedDetailMr.weight_qtl || '0') / 10).toFixed(2)} m.T</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span className="text-slate-400 font-bold uppercase">Actual Weight (kg):</span>
                      <span className="font-black text-emerald-700">{(parseFloat(selectedDetailMr.weight_qtl || '0') * 100).toLocaleString(undefined, {maximumFractionDigits: 0})} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold uppercase">Bales Count:</span>
                      <span className="font-black text-indigo-755">{selectedDetailMr.total_packets || selectedDetailMr.packets || '0'} BALES</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
                  <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5 mb-3">Electronic Weighbridge details</h4>
                  <div className="space-y-2 text-left font-mono text-[11px]">
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span className="text-slate-400 font-bold uppercase">Gross Weight:</span>
                      <span className="font-bold text-slate-700">{selectedDetailMr.electronic_gross_weight || '0.00'} MT</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span className="text-slate-400 font-bold uppercase">Tare Weight:</span>
                      <span className="font-bold text-slate-700">{selectedDetailMr.electronic_tare_weight || '0.00'} MT</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-1">
                      <span className="text-slate-400 font-bold uppercase">Electronic Net Wt:</span>
                      <span className="font-black text-indigo-900">{selectedDetailMr.electronic_net_weight || '0.00'} MT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400 font-bold uppercase">Moisture Redn Wt:</span>
                      <span className="font-bold text-rose-600">{selectedDetailMr.weight_reduced || '0.00'} MT</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Box 4: Quality grading detail matrix rows */}
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm text-left">
                <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-1.5 mb-3">Itemized Grades & Marko Verification Ledger</h4>
                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-[11px] text-left border-collapse font-mono">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 border-b border-slate-150">
                        <th className="p-2 ">Srl</th>
                        <th className="p-2">Receipt Grade</th>
                        <th className="p-2">Challan Grade</th>
                        <th className="p-2">Crop Year</th>
                        <th className="p-2">Agency Yard</th>
                        <th className="p-2">Challan Marka</th>
                        <th className="p-2 text-right">Net Weight</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let parsedGrid: any[] = [];
                        try {
                          if (selectedDetailMr.grid_details) {
                            const parsed = typeof selectedDetailMr.grid_details === 'string' 
                              ? (selectedDetailMr.grid_details === 'undefined' || selectedDetailMr.grid_details === 'null' ? [] : JSON.parse(selectedDetailMr.grid_details === "undefined" ? "null" : selectedDetailMr.grid_details))
                              : selectedDetailMr.grid_details;
                            if (Array.isArray(parsed)) {
                              parsedGrid = parsed;
                            }
                          }
                        } catch (e) {
                          console.error("Error parsing grid_details", e);
                        }

                        if (parsedGrid.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="p-4 text-center text-slate-400 uppercase font-black text-[9px] tracking-wide">
                                No specific grade breakdown records found
                              </td>
                            </tr>
                          );
                        }

                        return parsedGrid.map((gr: any, gidx: number) => (
                          <tr key={gr.srl_no || gidx} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="p-2 font-bold text-slate-400">{gr.srl_no || gidx + 1}</td>
                            <td className="p-2 font-bold text-slate-900 uppercase">{gr.receipt_grade_name || gr.receipt_grade_code || 'N/A'}</td>
                            <td className="p-2 text-slate-600 uppercase">{gr.challan_grade_name || 'N/A'}</td>
                            <td className="p-2 text-slate-700">{gr.crop_year || 'N/A'}</td>
                            <td className="p-2 text-slate-600 uppercase">{gr.agency_name || 'BALAGARH'}</td>
                            <td className="p-2 text-slate-600 uppercase">{gr.challan_marka_name || 'NO MARK'}</td>
                            <td className="p-2 text-right font-black text-indigo-900">{gr.netto_pnto ? `${parseFloat(gr.netto_pnto).toFixed(2)} MT` : '0.00 MT'}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks Box */}
              {selectedDetailMr.remarks && (
                <div className="bg-amber-50 p-3 border border-amber-200 rounded-lg text-left">
                  <span className="font-extrabold text-[8.5px] text-amber-800 block uppercase tracking-wider">Arrival Remarks / Operator comments</span>
                  <p className="italic text-amber-900 mt-1 font-semibold">"{selectedDetailMr.remarks}"</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-3 px-5 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                onClick={() => {
                  const isChecked = selectedPos.includes(selectedDetailMr.final_arrival_no);
                  toggleSelectPo(selectedDetailMr.final_arrival_no);
                  setSelectedDetailMr(null);
                }}
                className={cn(
                  "px-4 py-2 font-black uppercase text-[10px] tracking-wider rounded border",
                  selectedPos.includes(selectedDetailMr.final_arrival_no)
                    ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-500"
                    : "bg-indigo-700 hover:bg-indigo-800 text-white border-indigo-700"
                )}
              >
                {selectedPos.includes(selectedDetailMr.final_arrival_no) ? 'Remove Selection' : 'Select to Bind'}
              </button>
              <button
                onClick={() => setSelectedDetailMr(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-800 font-extrabold uppercase text-[10px] tracking-wider rounded transition"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Material Inspection Details & Un-club Modal */}
      {selectedInspection && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-350 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col font-sans overflow-hidden max-h-[92vh] animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-3.5 flex justify-between items-center px-5 border-b border-slate-850">
              <div className="flex items-center gap-2">
                <FileCheck className="h-[18px] w-[18px] text-teal-450" />
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider">Material Inspection Voucher Details</h3>
                  <p className="text-[9px] font-mono opacity-65 uppercase tracking-tight mt-0.5 font-bold">M.R Inspection No: {selectedInspection.mr_no}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedInspection(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Main Metadata */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 border border-slate-100 rounded-lg">
                <div>
                  <span className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-wider block">M.R Date</span>
                  <span className="font-mono font-bold text-slate-800 text-[11px]">{selectedInspection.mr_date || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-wider block">Unloading Date</span>
                  <span className="font-mono font-bold text-slate-800 text-[11px]">{selectedInspection.unloading_date || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-wider block">Broker</span>
                  <span className="font-bold text-slate-800 text-[11px] uppercase">{selectedInspection.broker_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[8.5px] text-slate-400 font-extrabold uppercase tracking-wider block">Supplier</span>
                  <span className="font-bold text-slate-800 text-[11px] uppercase">{selectedInspection.supplier_name || 'N/A'}</span>
                </div>
              </div>

              {/* Quality Parameters */}
              <div className="border border-slate-150 rounded-lg overflow-hidden">
                <div className="bg-teal-50 border-b border-slate-150 p-2 px-3 text-[9px] font-black uppercase text-teal-900 tracking-wider">
                  Quality Audit Parameters
                </div>
                <div className="grid grid-cols-3 divide-x divide-slate-150 text-center py-2.5">
                  <div>
                    <span className="text-[8.5px] text-slate-400 font-extrabold uppercase block">Actual Moisture</span>
                    <span className="font-black text-sm text-teal-950 mt-0.5 block">{selectedInspection.actual_moisture || 0}%</span>
                    <span className="text-[8px] text-slate-400 font-semibold block">Claim: {selectedInspection.claim_moisture || 0}%</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] text-slate-400 font-extrabold uppercase block">Actual Dust</span>
                    <span className="font-black text-sm text-teal-950 mt-0.5 block">{selectedInspection.actual_dust || 0}%</span>
                    <span className="text-[8px] text-slate-400 font-semibold block">Claim: {selectedInspection.claim_dust || 0}%</span>
                  </div>
                  <div>
                    <span className="text-[8.5px] text-slate-400 font-extrabold uppercase block">Actual NCV</span>
                    <span className="font-black text-sm text-teal-950 mt-0.5 block">{selectedInspection.actual_ncv || 0}%</span>
                    <span className="text-[8px] text-slate-400 font-semibold block">Claim: {selectedInspection.claim_ncv || 0}%</span>
                  </div>
                </div>
              </div>

              {/* P.O and Temp P.O Mappings Panel */}
              <div className="border border-indigo-150 bg-indigo-50/20 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1">
                    <Link className="h-3.5 w-3.5 text-indigo-755" />
                    Voucher Mappings Linkage Status
                  </span>
                  <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Active Linkage
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-3 border border-indigo-100 rounded-lg shadow-xs flex flex-col justify-center">
                    <span className="text-[8.5px] text-slate-400 font-extrabold uppercase block tracking-wider">Sauda Check Point / Jute Arrival No</span>
                    <span className="font-mono font-black text-sm text-amber-950 mt-1">
                      {selectedInspection.arrival_no || <span className="text-zinc-400 font-normal italic text-xs">NOT MAPPED</span>}
                    </span>
                  </div>

                  <div className="bg-white p-3 border border-indigo-100 rounded-lg shadow-xs flex flex-col justify-center">
                    <span className="text-[8.5px] text-slate-400 font-extrabold uppercase block tracking-wider">Purchase Order (P.O) Reference No</span>
                    <span className="font-mono font-black text-sm text-indigo-950 mt-1">
                      {selectedInspection.po_no || <span className="text-zinc-400 font-normal italic text-xs">NOT MAPPED</span>}
                    </span>
                  </div>
                </div>

                {selectedInspection.remarks && (
                  <div className="bg-white/60 p-2.5 rounded border border-indigo-100/50 leading-relaxed italic text-indigo-950">
                    "{selectedInspection.remarks}"
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer with Un-club Button */}
            <div className="bg-slate-50 p-3 px-5 border-t border-slate-100 flex justify-between items-center gap-3 flex-wrap">
              <div>
                {(selectedInspection.arrival_no || selectedInspection.po_no) ? (
                  <button
                    onClick={() => handleUnclubInspection(selectedInspection.mr_no)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 hover:shadow text-white border border-red-600 font-black uppercase text-[10px] tracking-wider rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    <span>Un-club Sauda Check Point & P.O</span>
                  </button>
                ) : (
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider italic">No active mappings to un-club</span>
                )}
              </div>

              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    const isChecked = selectedAmads.includes(selectedInspection.mr_no);
                    toggleSelectAmad(selectedInspection.mr_no);
                    setSelectedInspection(null);
                  }}
                  className={cn(
                    "px-4 py-2 font-black uppercase text-[10px] tracking-wider rounded border cursor-pointer transition-all",
                    selectedAmads.includes(selectedInspection.mr_no)
                      ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-500"
                      : "bg-teal-700 hover:bg-teal-850 text-white border-teal-700"
                  )}
                >
                  {selectedAmads.includes(selectedInspection.mr_no) ? 'Remove Selection' : 'Select to Bind'}
                </button>
                <button
                  onClick={() => setSelectedInspection(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 border border-slate-300 text-slate-800 font-extrabold uppercase text-[10px] tracking-wider rounded-lg transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </LegacyLayout>
  );
}
