import React, { useState, useEffect, useRef } from 'react';
import { getCurrentUserContext } from '../lib/permissions';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  RefreshCw, 
  FileSpreadsheet, 
  Plus, 
  Search, 
  ArrowLeft, 
  Layers,
  Check,
  HelpCircle,
  TrendingUp,
  Scale,
  Sparkles,
  PlayCircle,
  BarChart,
  Eye,
  EyeOff,
  Flame,
  Grid
} from 'lucide-react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LineChart as RechartsLineChart,
  Line
} from 'recharts';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { cn, sanitizeCsvData } from '../lib/utils';

import { canViewCompletedData } from '../lib/permissions';

interface ReconciliationRecord {
  id: string; // unique comparative id
  status: 'fully_matched' | 'mismatch' | 'pending_inspection' | 'orphan_inspection';
  typeLabel: string;
  has_mill_issue?: boolean;
  mill_issue_no?: string;
  
  // Arrival Record values (if exists)
  final_arrival_id?: string;
  final_arrival_no?: string;
  arrival_date?: string;
  lorry_number?: string;
  arrival_supplier?: string;
  arrival_po?: string;
  arrival_moisture?: number;
  arrival_dust?: number;
  arrival_ncv?: number;
  
  // Inspection Record values (if exists)
  mr_no?: string;
  inspection_date?: string;
  inspection_supplier?: string;
  inspection_po?: string;
  inspection_moisture?: number;
  inspection_dust?: number;
  inspection_ncv?: number;

  // Comparative Quantity/Weight Metrics
  expected_qty?: number;
  actual_qty?: number;
  expected_weight?: number;
  actual_weight?: number;

  // Specific discrepancies
  mismatches: {
    field: string;
    label: string;
    arrivalVal: any;
    inspectionVal: any;
  }[];
}

interface FinalArrivalReconciliationProps {
  onBack: () => void;
  onSelectInspectionForFA: (inspection: any) => void;
}

export default function FinalArrivalReconciliation({ onBack, onSelectInspectionForFA }: FinalArrivalReconciliationProps) {
  const [loading, setLoading] = useState(false);
  const [reconciledItems, setReconciledItems] = useState<ReconciliationRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'mismatch' | 'pending_inspection' | 'orphan_inspection' | 'fully_matched'>('all');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Safety threshold (%) configuration for arrival variance background audit checks
  const [varianceThreshold, setVarianceThreshold] = useState<number>(5);
  const inMemoryCustomMismatchesRef = useRef<any[]>([]);
  const inMemoryAlertedMismatchIdsRef = useRef<string[]>([]);

  // Background check that automatically registers a custom Mismatch Case and alerts the operator
  const performVarianceBackgroundCheck = (items: ReconciliationRecord[], thresholdPercent: number) => {
    if (items.length === 0) return;
    const THRESHOLD = thresholdPercent / 100;
    let customMismatches: any[] = inMemoryCustomMismatchesRef.current;
    let alertedMismatchIds: string[] = inMemoryAlertedMismatchIdsRef.current;
    let newlyAlertedCount = 0;
    let newlyCreatedCount = 0;

    items.forEach(item => {
      // Check applies to matched entries (status 'mismatch' or 'fully_matched')
      if (item.status === 'mismatch' || item.status === 'fully_matched') {
        const expectedQty = item.expected_qty || 0;
        const actualQty = item.actual_qty || 0;
        const expectedWt = item.expected_weight || 0;
        const actualWt = item.actual_weight || 0;

        if (expectedQty > 0 && expectedWt > 0) {
          const qtyDiffPercent = Math.abs(actualQty - expectedQty) / expectedQty;
          const wtDiffPercent = Math.abs(actualWt - expectedWt) / expectedWt;

          // If variance in either quantity or weight exceeds safety threshold
          if (qtyDiffPercent > THRESHOLD || wtDiffPercent > THRESHOLD) {
            const mismatchId = `MIS-FA-${item.final_arrival_no || item.id}`;

            // Check if mismatch case already exists in custom mismatches list
            const alreadyExists = customMismatches.some(cm => cm.id === mismatchId);
            if (!alreadyExists) {
              const qtyVarSign = actualQty >= expectedQty ? '+' : '';
              const wtVarSign = actualWt >= expectedWt ? '+' : '';
              const qtyVarText = `${qtyVarSign}${(actualQty - expectedQty).toFixed(1)} Bales (${(qtyDiffPercent * 100).toFixed(1)}%)`;
              const wtVarText = `${wtVarSign}${(actualWt - expectedWt).toFixed(2)} MT (${(wtDiffPercent * 100).toFixed(1)}%)`;

              const newMismatch = {
                id: mismatchId,
                sourceType: 'weighbridge_wt' as const,
                sourceRef: item.final_arrival_no || 'FA-RECON',
                supplierName: item.arrival_supplier || item.inspection_supplier || 'UNKNOWN SUPPLIER',
                poNo: item.arrival_po || item.inspection_po || 'NOT LINKED',
                saudaNo: 'N/A',
                lorryNo: item.lorry_number || 'N/A',
                detectedAt: new Date().toISOString().split('T')[0],
                issueDescription: `Final Arrival weighbridge/quantity variance exceeds safety compliance limit of ${thresholdPercent}%. Expected: ${expectedQty.toFixed(1)} Bales / ${expectedWt.toFixed(2)} MT, Actual Received: ${actualQty.toFixed(1)} Bales / ${actualWt.toFixed(2)} MT.`,
                expectedValue: `${expectedQty.toFixed(1)} Bales / ${expectedWt.toFixed(2)} MT`,
                actualValue: `${actualQty.toFixed(1)} Bales / ${actualWt.toFixed(2)} MT`,
                difference: `Qty Diff: ${qtyVarText}, Weight Diff: ${wtVarText}`,
                severity: (qtyDiffPercent > 0.15 || wtDiffPercent > 0.15) ? 'high' as const : 'medium' as const,
                status: 'pending' as const
              };

              customMismatches.push(newMismatch);
              newlyCreatedCount++;

              if (supabase) {
                supabase.from('material_mismatch').upsert({
                  mismatch_id: mismatchId,
                  po_no: item.arrival_po || item.inspection_po || null,
                  arrival_no: item.final_arrival_no || null,
                  supplier: item.arrival_supplier || item.inspection_supplier || null,
                  lorry_number: item.lorry_number || null,
                  issue_description: newMismatch.issueDescription,
                  expected_value: newMismatch.expectedValue,
                  actual_value: newMismatch.actualValue,
                  difference: newMismatch.difference,
                  severity: newMismatch.severity,
                  status: 'pending'
                }, { onConflict: 'mismatch_id' }).then(() => {});
              }
            }

            // Check if user has already been alerted for this exact mismatch
            const alreadyAlerted = alertedMismatchIds.includes(mismatchId);
            if (!alreadyAlerted) {
              alertedMismatchIds.push(mismatchId);
              newlyAlertedCount++;

              // Delay slightly to prevent blocking UI load thread
              setTimeout(() => {
                window.alert(
                  `⚠️ SECURITY COMPLIANCE ALERT: ARRIVAL VARIANCE EXCEEDS SAFETY LIMIT!\n\n` +
                  `Final Arrival Voucher: #${item.final_arrival_no || 'N/A'}\n` +
                  `Supplier: ${item.arrival_supplier || item.inspection_supplier || 'N/A'}\n` +
                  `Lorry Number: ${item.lorry_number || 'N/A'}\n\n` +
                  `Expected (Lab Inspection Detail): ${expectedQty.toFixed(1)} Bales | ${expectedWt.toFixed(2)} MT\n` +
                  `Actual Received (Physical Weighbridge): ${actualQty.toFixed(1)} Bales | ${actualWt.toFixed(2)} MT\n\n` +
                  `Variance exceeds safety threshold of ${thresholdPercent}%.\n` +
                  `A formal 'Mismatch Case' audit record (#${mismatchId}) has been dynamically generated for compliance desk review.`
                );
              }, 400);
            }
          }
        }
      }
    });

    if (newlyCreatedCount > 0) {
      inMemoryCustomMismatchesRef.current = customMismatches;
    }
    if (newlyAlertedCount > 0) {
      inMemoryAlertedMismatchIdsRef.current = alertedMismatchIds;
    }
  };

  const handleThresholdChange = (val: number) => {
    setVarianceThreshold(val);
  };

  // Stats Counters
  const [counters, setCounters] = useState({
    total: 0,
    fullyMatched: 0,
    mismatchCount: 0,
    pendingInspection: 0,
    orphanInspection: 0
  });

  const loadReconciliationData = async () => {
    setLoading(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      // 1. Fetch actual recorded arrivals
      const { data: arrivals, error: arrivalsErr } = await supabase
        .from('final_arrival')
        .select('*');

      if (arrivalsErr) throw arrivalsErr;

      // 2. Fetch expected audit inspections
      const { data: inspections, error: inspectionsErr } = await supabase
        .from('mill_inspection_master')
        .select('*');

      if (inspectionsErr) throw inspectionsErr;

      // 2b. Fetch inspection detail lines to aggregate expected quantities/weights
      const { data: detailsData, error: detailsErr } = await supabase
        .from('mill_inspection_detail')
        .select('mr_no, quantity, challan_gross_wt');

      if (detailsErr) {
        console.warn("Could not fetch mill_inspection_detail:", detailsErr);
      }

      // 2c. Fetch mill issues to identify complete material issues
      const { data: millIssues, error: millIssuesErr } = await supabase
        .from('mill_issue_master')
        .select('issue_id, issue_no, requisition_no');

      if (millIssuesErr) {
        console.warn("Could not fetch mill_issue_master:", millIssuesErr);
      }

      const detailsList = detailsData || [];
      const arrivalsList = arrivals || [];
      const inspectionsList = inspections || [];
      const millIssuesList = millIssues || [];

      // 3. Keep track of which inspections are matched to arrivals
      const matchedInspectionIds = new Set<string>();

      const compiledRecords: ReconciliationRecord[] = [];

      // Process actual recorded arrivals
      arrivalsList.forEach((arrival) => {
        // Check for matching Material Issue Desk entry
        const matchingIssue = millIssuesList.find(issue => 
          issue.requisition_no && 
          arrival.final_arrival_no && 
          String(issue.requisition_no).trim().toUpperCase() === String(arrival.final_arrival_no).trim().toUpperCase()
        );

        // Attempt to find corresponding quality inspection
        const match = inspectionsList.find(ins => {
          // Rule A: Match by exact MR No (if provided)
          if (arrival.mr_no && ins.mr_no && String(arrival.mr_no).trim().toUpperCase() === String(ins.mr_no).trim().toUpperCase()) {
            return true;
          }
          // Rule B: Match by Arrival / Amad number
          const insArrivalNo = String(ins.arrival_no || '').trim().toUpperCase();
          const recTempArrivalNo = String(arrival.temporary_arrival_no || '').trim().toUpperCase();
          const recFinalArrivalNo = String(arrival.final_arrival_no || '').trim().toUpperCase();
          
          if (insArrivalNo && (insArrivalNo === recTempArrivalNo || insArrivalNo === recFinalArrivalNo)) {
            return true;
          }

          // Rule C: Match by Lorry Number + Supplier Name + Date range (if close)
          const insSupplier = String(ins.supplier_name || '').trim().toUpperCase();
          const recSupplier = String(arrival.supplier || '').trim().toUpperCase();
          if (arrival.lorry_number && ins.arrival_date && 
              String(ins.arrival_no || '').toUpperCase().includes(String(arrival.lorry_number).trim().toUpperCase()) &&
              (insSupplier === recSupplier || recSupplier.includes(insSupplier) || insSupplier.includes(recSupplier))) {
            return true;
          }

          return false;
        });

        // Compute actual values from recorded final arrival
        const arrUnit = (arrival.unit_name || arrival.unit || '').toString().trim().toUpperCase();
        const isArrLoose = arrUnit.includes('LOOSE') || arrUnit === 'LOOSE';
        const actQty = isArrLoose ? 0 : (Number(arrival.total_packets) || 0);
        const actWeight = Number(arrival.electronic_net_weight) || Number(arrival.supplier_net_weight) || Number(arrival.challan_material_weight) || 0;

        if (match) {
          matchedInspectionIds.add(match.mr_no);

          // Sum up expected detail lines for matched inspection
          const matchDetails = detailsList.filter(d => d.mr_no === match.mr_no);
          const expQty = matchDetails.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
          const expWeight = matchDetails.reduce((acc, curr) => acc + (Number(curr.challan_gross_wt) || 0), 0);

          // Compare fields for discrepancies
          const mismatchesList: ReconciliationRecord['mismatches'] = [];

          // Compare PO
          const arrPo = String(arrival.po_no || '').trim().toUpperCase();
          const insPo = String(match.po_no || '').trim().toUpperCase();
          if (arrPo && insPo && arrPo !== insPo) {
            mismatchesList.push({
              field: 'po_no',
              label: 'Purchase Order No',
              arrivalVal: arrival.po_no,
              inspectionVal: match.po_no
            });
          }

          // Compare Supplier
          const arrSup = String(arrival.supplier || '').trim().toUpperCase();
          const insSup = String(match.supplier_name || '').trim().toUpperCase();
          if (arrSup && insSup && arrSup !== insSup && !arrSup.includes(insSup) && !insSup.includes(arrSup)) {
            mismatchesList.push({
              field: 'supplier',
              label: 'Supplier Identity',
              arrivalVal: arrival.supplier,
              inspectionVal: match.supplier_name
            });
          }

          // Compare Moisture
          const arrMoist = Number(arrival.actual_moisture) || 0;
          const insMoist = Number(match.actual_moisture) || 0;
          if (arrMoist > 0 && insMoist > 0 && Math.abs(arrMoist - insMoist) > 0.1) {
            mismatchesList.push({
              field: 'actual_moisture',
              label: 'Moisture Content %',
              arrivalVal: `${arrMoist}%`,
              inspectionVal: `${insMoist}%`
            });
          }

          // Compare Dust
          const arrDust = Number(arrival.actual_dust) || 0;
          const insDust = Number(match.actual_dust) || 0;
          if (arrDust > 0 && insDust > 0 && Math.abs(arrDust - insDust) > 0.1) {
            mismatchesList.push({
              field: 'actual_dust',
              label: 'Dust Content %',
              arrivalVal: `${arrDust}%`,
              inspectionVal: `${insDust}%`
            });
          }

          // Compare NCV
          const arrNcv = Number(arrival.actual_ncv) || 0;
          const insNcv = Number(match.actual_ncv) || 0;
          if (arrNcv > 0 && insNcv > 0 && Math.abs(arrNcv - insNcv) > 0.1) {
            mismatchesList.push({
              field: 'actual_ncv',
              label: 'Net Calorific Value',
              arrivalVal: arrNcv,
              inspectionVal: insNcv
            });
          }

          compiledRecords.push({
            id: `matched-${arrival.final_arrival_id}`,
            status: mismatchesList.length > 0 ? 'mismatch' : 'fully_matched',
            typeLabel: mismatchesList.length > 0 ? 'Discrepancy (Mismatched parameters)' : 'Fully Reconciled & Approved',
            has_mill_issue: !!matchingIssue,
            mill_issue_no: matchingIssue ? matchingIssue.issue_no : undefined,
            
            final_arrival_id: arrival.final_arrival_id,
            final_arrival_no: arrival.final_arrival_no,
            arrival_date: arrival.date,
            lorry_number: arrival.lorry_number,
            arrival_supplier: arrival.supplier,
            arrival_po: arrival.po_no,
            arrival_moisture: arrMoist,
            arrival_dust: arrDust,
            arrival_ncv: arrNcv,
            
            mr_no: match.mr_no,
            inspection_date: match.mr_date,
            inspection_supplier: match.supplier_name,
            inspection_po: match.po_no,
            inspection_moisture: insMoist,
            inspection_dust: insDust,
            inspection_ncv: insNcv,

            // Quantities and weights comparative values
            expected_qty: expQty,
            actual_qty: actQty,
            expected_weight: expWeight,
            actual_weight: actWeight,

            mismatches: mismatchesList
          });
        } else {
          // No inspection match found -> Pending quality audit inspection
          compiledRecords.push({
            id: `pending-${arrival.final_arrival_id}`,
            status: 'pending_inspection',
            typeLabel: 'Pending Lab Quality Audit',
            has_mill_issue: !!matchingIssue,
            mill_issue_no: matchingIssue ? matchingIssue.issue_no : undefined,
            
            final_arrival_id: arrival.final_arrival_id,
            final_arrival_no: arrival.final_arrival_no,
            arrival_date: arrival.date,
            lorry_number: arrival.lorry_number,
            arrival_supplier: arrival.supplier,
            arrival_po: arrival.po_no,
            arrival_moisture: Number(arrival.actual_moisture) || 0,
            arrival_dust: Number(arrival.actual_dust) || 0,
            arrival_ncv: Number(arrival.actual_ncv) || 0,

            // Quantities and weights comparative values
            expected_qty: 0,
            actual_qty: actQty,
            expected_weight: 0,
            actual_weight: actWeight,
            
            mismatches: []
          });
        }
      });

      // Find Orphaned Inspections (Inspections recorded but no recorded Final Arrival)
      inspectionsList.forEach((ins) => {
        if (!matchedInspectionIds.has(ins.mr_no)) {
          // Sum up details for the orphan inspection
          const matchDetails = detailsList.filter(d => d.mr_no === ins.mr_no);
          const expQty = matchDetails.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
          const expWeight = matchDetails.reduce((acc, curr) => acc + (Number(curr.challan_gross_wt) || 0), 0);

          compiledRecords.push({
            id: `orphan-${ins.mr_no}`,
            status: 'orphan_inspection',
            typeLabel: 'Orphan Inspection (No Arrival Registered)',
            
            mr_no: ins.mr_no,
            inspection_date: ins.mr_date,
            inspection_supplier: ins.supplier_name,
            inspection_po: ins.po_no,
            inspection_moisture: Number(ins.actual_moisture) || 0,
            inspection_dust: Number(ins.actual_dust) || 0,
            inspection_ncv: Number(ins.actual_ncv) || 0,

            expected_qty: expQty,
            actual_qty: 0,
            expected_weight: expWeight,
            actual_weight: 0,

            // To assist on-the-fly prefilling
            lorry_number: ins.arrival_no?.match(/WB-\d{2}-[A-Z]-\d{4}/gi)?.[0] || ins.arrival_no || '',
            arrival_date: ins.arrival_date || ins.mr_date,

            mismatches: []
          });
        }
      });

      // Calculate statistics counters
      const total = compiledRecords.length;
      const fullyMatched = compiledRecords.filter(c => c.status === 'fully_matched').length;
      const mismatchCount = compiledRecords.filter(c => c.status === 'mismatch').length;
      const pendingInspection = compiledRecords.filter(c => c.status === 'pending_inspection').length;
      const orphanInspection = compiledRecords.filter(c => c.status === 'orphan_inspection').length;

      setCounters({ total, fullyMatched, mismatchCount, pendingInspection, orphanInspection });
      setReconciledItems(compiledRecords);
    } catch (e: any) {
      console.error("Reconciliation loading error:", e);
      setErrorMessage(e.message || "Failed to load complete reconciliation audit trail.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReconciliationData();
  }, []);

  // Run the variance background audit check whenever items are fetched or safety limit is updated
  useEffect(() => {
    if (reconciledItems.length > 0) {
      performVarianceBackgroundCheck(reconciledItems, varianceThreshold);
    }
  }, [reconciledItems, varianceThreshold]);

  // Filter and search items
  const filteredItems = reconciledItems.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || (
      (item.final_arrival_no || '').toLowerCase().includes(q) ||
      (item.mr_no || '').toLowerCase().includes(q) ||
      (item.lorry_number || '').toLowerCase().includes(q) ||
      (item.arrival_supplier || '').toLowerCase().includes(q) ||
      (item.inspection_supplier || '').toLowerCase().includes(q) ||
      (item.arrival_po || '').toLowerCase().includes(q) ||
      (item.inspection_po || '').toLowerCase().includes(q)
    );

    if (!canViewCompletedData() && item.status === 'fully_matched') {
      return false;
    }

    const matchesFilter = filterType === 'all' || item.status === filterType;

    return matchesSearch && matchesFilter;
  });

  // Reconcile single record difference
  const handleSingleReconcile = async (item: ReconciliationRecord) => {
    if (!item.final_arrival_id || !item.mr_no) return;
    try {
      setLoading(true);
      // Fetch corresponding quality audit master record
      const { data: insData, error: insErr } = await supabase
        .from('mill_inspection_master')
        .select('*')
        .eq('mr_no', item.mr_no)
        .maybeSingle();
        
      if (insErr || !insData) throw new Error(insErr?.message || "Lab Quality inspection record missing.");
      
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
        .eq('final_arrival_id', item.final_arrival_id);
        
      if (updateErr) throw updateErr;

      // Insert log audit history
      const currentUser = getCurrentUserContext().username || "prosunmajhi@gmail.com";
      try {
        await supabase.from("system_logs").insert({
          user_id: currentUser,
          action: 'RECONCILIATION',
          details: `[RECONCILIATION REPORT] Resolved discrepancy for Final Arrival: ${item.final_arrival_no} linked to MR: ${item.mr_no}. Corrected to certified lab metrics.`
        }).then(() => {}, () => {});
      } catch (err) {
        console.warn("Auditing sync write failed:", err);
      }

      setSuccessMessage(`Discrepancy for Final Arrival Voucher #${item.final_arrival_no} resolved using lab-certified values.`);
      await loadReconciliationData();
    } catch (e: any) {
      setErrorMessage("Failed to resolve discrepancy: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Reconcile all mismatch discrepancies at once
  const handleBulkReconcile = async () => {
    const mismatchList = reconciledItems.filter(r => r.status === 'mismatch');
    if (mismatchList.length === 0) {
      alert("No active mismatch discrepancies to bulk-resolve.");
      return;
    }

    if (!confirm(`Are you sure you want to force bulk-update all ${mismatchList.length} mismatched Final Arrival records to align with official lab-certified quality audits?`)) {
      return;
    }

    try {
      setLoading(true);
      let successCount = 0;

      const promises = mismatchList.map(async (item) => {
        if (!item.final_arrival_id || !item.mr_no) return;
        const { data: insData } = await supabase
          .from('mill_inspection_master')
          .select('*')
          .eq('mr_no', item.mr_no)
          .maybeSingle();

        if (insData) {
          const { error } = await supabase
            .from('final_arrival')
            .update({
              po_no: insData.po_no || null,
              supplier: insData.supplier_name || null,
              broker: insData.broker_name || null,
              actual_moisture: insData.actual_moisture ? Number(insData.actual_moisture) : null,
              actual_dust: insData.actual_dust ? Number(insData.actual_dust) : null,
              actual_ncv: insData.actual_ncv ? Number(insData.actual_ncv) : null,
            })
            .eq('final_arrival_id', item.final_arrival_id);

          if (!error) {
            successCount++;
          }
        }
      });

      await Promise.all(promises);
      setSuccessMessage(`Successfully synchronized ${successCount} mismatched record(s) to lab-certified quality values.`);
      await loadReconciliationData();
    } catch (e: any) {
      setErrorMessage("Bulk reconciliation encountered errors: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Export comparative report to CSV/Excel
  const handleExportCSV = () => {
    if (reconciledItems.length === 0) {
      alert("No reconciliation data loaded to export.");
      return;
    }

    const exportRows = reconciledItems.map((item) => {
      let mismatchesSummary = "None (Matched)";
      if (item.status === 'mismatch') {
        mismatchesSummary = item.mismatches.map(m => `${m.label}: FA [${m.arrivalVal}] vs INSP [${m.inspectionVal}]`).join(" | ");
      } else if (item.status === 'pending_inspection') {
        mismatchesSummary = "Pending Inspection Report";
      } else if (item.status === 'orphan_inspection') {
        mismatchesSummary = "Orphaned Quality Audit (No FA recorded)";
      }

      return {
        "Status Code": item.status.toUpperCase(),
        "Status Category": item.typeLabel,
        "Final Arrival No": item.final_arrival_no || 'N/A',
        "FA Date": item.arrival_date ? new Date(item.arrival_date).toLocaleDateString('en-GB') : 'N/A',
        "Lorry / Lorry Plate": item.lorry_number || 'N/A',
        "FA Supplier": item.arrival_supplier || 'N/A',
        "FA Contract PO": item.arrival_po || 'N/A',
        "FA Moisture %": item.arrival_moisture ?? 'N/A',
        "FA Dust %": item.arrival_dust ?? 'N/A',
        "FA NCV": item.arrival_ncv ?? 'N/A',
        "M.R. No": item.mr_no || 'N/A',
        "Inspection Date": item.inspection_date ? new Date(item.inspection_date).toLocaleDateString('en-GB') : 'N/A',
        "Inspection Supplier": item.inspection_supplier || 'N/A',
        "Inspection PO": item.inspection_po || 'N/A',
        "Inspection Moisture %": item.inspection_moisture ?? 'N/A',
        "Inspection Dust %": item.inspection_dust ?? 'N/A',
        "Inspection NCV": item.inspection_ncv ?? 'N/A',
        "Detected Discrepancies Details": mismatchesSummary
      };
    });

    try {
      const sanitizedData = sanitizeCsvData(exportRows);
      const csv = Papa.unparse(sanitizedData);
      const csvContent = "\uFEFF" + csv;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Final_Arrival_Quality_Reconciliation_Audit_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e: any) {
      alert("Error exporting CSV: " + e.message);
    }
  };

  // Switch back to create entry form with this inspection prefilled
  const handleRegisterOrphan = async (item: ReconciliationRecord) => {
    // We construct mock/actual initialData structure compatible with FinalArrivalEntry
    const prefilledData = {
      po_no: item.inspection_po || '',
      mr_no: item.mr_no || '',
      supplier: item.inspection_supplier || '',
      temporary_arrival_no: item.final_arrival_no || item.mr_no || '',
      temporary_arrival_date: item.arrival_date || item.inspection_date || '',
      lorry_number: item.lorry_number || '',
      actual_moisture: item.inspection_moisture || 0,
      actual_dust: item.inspection_dust || 0,
      actual_ncv: item.inspection_ncv || 0,
      remarks: `Pre-populated from Orphan Lab Quality Audit M.R. #${item.mr_no}`
    };
    onSelectInspectionForFA(prefilledData);
  };

  // Local states for the Recharts visualization panel
  const [showChart, setShowChart] = useState(true);
  const [chartMetric, setChartMetric] = useState<'quantity' | 'weight'>('quantity');
  
  // Historical trend states
  const [showTrendChart, setShowTrendChart] = useState(true);
  const [selectedTrendSupplier, setSelectedTrendSupplier] = useState<string>('ALL');

  // 12-Month Heatmap states
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [heatmapMetric, setHeatmapMetric] = useState<'quantity' | 'weight' | 'combined'>('combined');
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<{
    vendor: string;
    monthLabel: string;
    value: number;
    deliveriesCount: number;
    loads: any[];
  } | null>(null);

  // Prepare dynamic chart data comparing expected vs actual quantities/weights
  const chartData = reconciledItems
    .filter(item => {
      // Keep records that have non-zero comparative values
      const hasQty = (item.expected_qty || 0) > 0 || (item.actual_qty || 0) > 0;
      const hasWeight = (item.expected_weight || 0) > 0 || (item.actual_weight || 0) > 0;
      return hasQty || hasWeight;
    })
    .slice(0, 15) // Limit to top 15 records for crisp horizontal readability
    .map(item => {
      const identifier = item.final_arrival_no || item.mr_no || 'N/A';
      const shortLabel = identifier.length > 12 ? `...${identifier.slice(-8)}` : identifier;
      return {
        name: shortLabel,
        fullName: identifier,
        expected: chartMetric === 'quantity' ? (item.expected_qty || 0) : (item.expected_weight || 0),
        actual: chartMetric === 'quantity' ? (item.actual_qty || 0) : (item.actual_weight || 0),
        expectedQty: item.expected_qty || 0,
        actualQty: item.actual_qty || 0,
        expectedWeight: item.expected_weight || 0,
        actualWeight: item.actual_weight || 0,
        supplier: item.arrival_supplier || item.inspection_supplier || 'Unknown Supplier',
        status: item.status,
        lorry: item.lorry_number || 'N/A'
      };
    });

  // Dynamic bar colors highlighting variances
  const getBarColorForEntry = (entry: any) => {
    if (entry.status === 'pending_inspection') return '#93c5fd'; // Light Blue
    if (entry.status === 'orphan_inspection') return '#fda4af';  // Rose/Pink (orphan)

    const diff = entry.actual - entry.expected;
    if (Math.abs(diff) < 0.1) return '#10b981'; // Emerald Green (Matched)
    return diff < 0 ? '#f59e0b' : '#6366f1';    // Amber (Deficit warning) / Indigo (Surplus)
  };

  // Custom interactive tooltip for Recharts
  const renderChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isQty = chartMetric === 'quantity';
      const exp = isQty ? data.expectedQty : data.expectedWeight;
      const act = isQty ? data.actualQty : data.actualWeight;
      const diff = act - exp;
      const unit = isQty ? ' Bales/Packets' : ' MT/Qtls';

      let varianceText = '';
      let varianceClass = 'text-slate-400';
      if (Math.abs(diff) < 0.1) {
        varianceText = 'Perfect Match (±0.0)';
        varianceClass = 'text-emerald-400 font-bold';
      } else if (diff < 0) {
        varianceText = `${diff.toFixed(2)}${unit} Deficit (Shortage)`;
        varianceClass = 'text-amber-400 font-bold';
      } else {
        varianceText = `+${diff.toFixed(2)}${unit} Surplus (Over-receipt)`;
        varianceClass = 'text-indigo-300 font-bold';
      }

      return (
        <div className="bg-slate-900 border-2 border-slate-700 text-white p-3 shadow-xl rounded-md text-[10px] leading-relaxed max-w-xs font-sans">
          <p className="font-extrabold text-[11px] text-yellow-400 border-b border-slate-700 pb-1 mb-2 uppercase tracking-wide font-sans">
            Load No: {data.fullName}
          </p>
          <div className="space-y-1 font-medium font-sans">
            <p className="text-slate-300">Supplier: <span className="text-white font-bold">{data.supplier}</span></p>
            {data.lorry && data.lorry !== 'N/A' && (
              <p className="text-slate-300">Lorry Number: <span className="text-white font-mono">{data.lorry}</span></p>
            )}
            <div className="pt-1.5 border-t border-slate-800 mt-1.5 grid grid-cols-2 gap-2 font-mono">
              <div>
                <span className="text-slate-400 block text-[8px] uppercase">Expected (Lab)</span>
                <span className="text-white font-extrabold text-[10px]">{exp.toFixed(1)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[8px] uppercase">Actual (Arrival)</span>
                <span className="text-white font-extrabold text-[10px]">{act.toFixed(1)}</span>
              </div>
            </div>
            <div className="pt-1.5 border-t border-slate-800 mt-1">
              <span className="text-slate-400 block text-[8px] uppercase">Audit Variance</span>
              <span className={varianceClass}>{varianceText}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Extract all unique suppliers for trend filtering
  const uniqueTrendSuppliers = React.useMemo(() => {
    const suppliers = new Set<string>();
    reconciledItems.forEach(item => {
      const name = item.arrival_supplier || item.inspection_supplier;
      if (name) suppliers.add(name);
    });
    return Array.from(suppliers).sort();
  }, [reconciledItems]);

  // Compute 6-month historical trend data for average arrival variances
  const trendData = React.useMemo(() => {
    const monthsList = [];
    // Anchor to June 2026 as the current month
    const currentYear = 2026;
    const currentMonth = 5; // June is index 5
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const monthName = d.toLocaleString('default', { month: 'short' });
      const yearSuffix = d.getFullYear().toString().slice(-2);
      monthsList.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${monthName} '${yearSuffix}`,
        rawMonth: d.getMonth(),
        rawYear: d.getFullYear(),
        totalQtyVariance: 0,
        qtyVarianceCount: 0,
        totalWtVariance: 0,
        wtVarianceCount: 0,
      });
    }

    reconciledItems.forEach(item => {
      const dateStr = item.arrival_date || item.inspection_date;
      if (!dateStr) return;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return;

      const y = date.getFullYear();
      const m = date.getMonth();
      
      const slot = monthsList.find(s => s.rawYear === y && s.rawMonth === m);
      if (!slot) return;

      // Filter by supplier if selected
      if (selectedTrendSupplier && selectedTrendSupplier !== 'ALL') {
        const itemSupplier = item.arrival_supplier || item.inspection_supplier || '';
        if (itemSupplier !== selectedTrendSupplier) return;
      }

      // Quantity Variance %
      const expQty = item.expected_qty || 0;
      const actQty = item.actual_qty || 0;
      if (expQty > 0) {
        const varPct = (Math.abs(actQty - expQty) / expQty) * 100;
        slot.totalQtyVariance += varPct;
        slot.qtyVarianceCount++;
      }

      // Weight Variance %
      const expWt = item.expected_weight || 0;
      const actWt = item.actual_weight || 0;
      if (expWt > 0) {
        const varPct = (Math.abs(actWt - expWt) / expWt) * 100;
        slot.totalWtVariance += varPct;
        slot.wtVarianceCount++;
      }
    });

    return monthsList.map(slot => {
      const avgQtyVar = slot.qtyVarianceCount > 0 ? Number((slot.totalQtyVariance / slot.qtyVarianceCount).toFixed(2)) : 0;
      const avgWtVar = slot.wtVarianceCount > 0 ? Number((slot.totalWtVariance / slot.wtVarianceCount).toFixed(2)) : 0;
      return {
        monthLabel: slot.label,
        "Quantity Variance (%)": avgQtyVar,
        "Weight Variance (%)": avgWtVar,
        qtyCount: slot.qtyVarianceCount,
        wtCount: slot.wtVarianceCount,
      };
    });
  }, [reconciledItems, selectedTrendSupplier]);

  // Supplier discrepancy statistics to highlight persistent deviations
  const supplierDiscrepancyRank = React.useMemo(() => {
    const stats: Record<string, { totalVar: number; count: number; mismatchCount: number }> = {};
    
    reconciledItems.forEach(item => {
      const name = item.arrival_supplier || item.inspection_supplier;
      if (!name) return;

      const expQty = item.expected_qty || 0;
      const actQty = item.actual_qty || 0;
      const expWt = item.expected_weight || 0;
      const actWt = item.actual_weight || 0;

      let totalRecordVar = 0;
      let recordVarCount = 0;

      if (expQty > 0) {
        totalRecordVar += (Math.abs(actQty - expQty) / expQty) * 100;
        recordVarCount++;
      }
      if (expWt > 0) {
        totalRecordVar += (Math.abs(actWt - expWt) / expWt) * 100;
        recordVarCount++;
      }

      if (recordVarCount > 0) {
        const avg = totalRecordVar / recordVarCount;
        if (!stats[name]) {
          stats[name] = { totalVar: 0, count: 0, mismatchCount: 0 };
        }
        stats[name].totalVar += avg;
        stats[name].count += 1;
        if (item.status === 'mismatch') {
          stats[name].mismatchCount += 1;
        }
      }
    });

    return Object.entries(stats)
      .map(([name, val]) => ({
        name,
        avgVariance: val.count > 0 ? Number((val.totalVar / val.count).toFixed(2)) : 0,
        mismatchCount: val.mismatchCount,
        deliveryCount: val.count
      }))
      .sort((a, b) => b.avgVariance - a.avgVariance);
  }, [reconciledItems]);

  // Compute 12-Month Vendor Variance Heatmap Data
  const heatmapData = React.useMemo(() => {
    const months: { label: string; year: number; month: number }[] = [];
    const anchorYear = 2026;
    const anchorMonth = 5; // June is index 5
    
    for (let i = 11; i >= 0; i--) {
      const d = new Date(anchorYear, anchorMonth - i, 1);
      months.push({
        label: d.toLocaleString('default', { month: 'short' }) + " '" + d.getFullYear().toString().slice(-2),
        year: d.getFullYear(),
        month: d.getMonth()
      });
    }

    const vendorSet = new Set<string>();
    reconciledItems.forEach(item => {
      const name = item.arrival_supplier || item.inspection_supplier;
      if (name) vendorSet.add(name);
    });
    const vendors = Array.from(vendorSet).sort();

    const grid = vendors.map(vendor => {
      const monthlyStats = months.map(m => {
        const records = reconciledItems.filter(item => {
          const itemVendor = item.arrival_supplier || item.inspection_supplier;
          if (itemVendor !== vendor) return false;

          const dateStr = item.arrival_date || item.inspection_date;
          if (!dateStr) return false;

          const date = new Date(dateStr);
          return date.getFullYear() === m.year && date.getMonth() === m.month;
        });

        let totalQtyVar = 0;
        let qtyCount = 0;
        let totalWtVar = 0;
        let wtCount = 0;

        records.forEach(r => {
          const expQty = r.expected_qty || 0;
          const actQty = r.actual_qty || 0;
          if (expQty > 0) {
            totalQtyVar += (Math.abs(actQty - expQty) / expQty) * 100;
            qtyCount++;
          }

          const expWt = r.expected_weight || 0;
          const actWt = r.actual_weight || 0;
          if (expWt > 0) {
            totalWtVar += (Math.abs(actWt - expWt) / expWt) * 100;
            wtCount++;
          }
        });

        const avgQtyVar = qtyCount > 0 ? Number((totalQtyVar / qtyCount).toFixed(2)) : 0;
        const avgWtVar = wtCount > 0 ? Number((totalWtVar / wtCount).toFixed(2)) : 0;
        const combinedVar = (qtyCount > 0 || wtCount > 0)
          ? Number(((totalQtyVar + totalWtVar) / (qtyCount + wtCount)).toFixed(2))
          : 0;

        return {
          monthLabel: m.label,
          year: m.year,
          month: m.month,
          qtyVar: avgQtyVar,
          wtVar: avgWtVar,
          combinedVar,
          deliveriesCount: records.length,
          loads: records
        };
      });

      const totalDeliveries = monthlyStats.reduce((acc, curr) => acc + curr.deliveriesCount, 0);
      const overallAvgVar = monthlyStats.reduce((acc, curr) => acc + curr.combinedVar, 0) / (monthlyStats.filter(s => s.deliveriesCount > 0).length || 1);

      return {
        vendor,
        monthlyStats,
        totalDeliveries,
        overallAvgVar: Number(overallAvgVar.toFixed(2))
      };
    });

    return { months, grid };
  }, [reconciledItems]);

  return (
    <div className="space-y-4 font-sans text-slate-800 animate-fade-in">
      {/* Top Banner & Title bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-300 pb-3 gap-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-slate-200 border border-slate-300 rounded text-slate-700 bg-[#f4f2ee] shadow-[1px_1px_0_0_rgba(0,0,0,0.2)] hover:shadow-md cursor-pointer transition-all duration-100 flex items-center justify-center"
            title="Return to Final Arrival list View"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-base font-black uppercase tracking-tight text-slate-800 flex items-center gap-2">
              📊 Final Arrival Quality Reconciliation Control Panel
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              Enterprise comparative matrix tracking real-time material receipt balances vs official Laboratory Inspection metrics.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Safety Variance Threshold Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-300 rounded px-2.5 py-1 ">
            <span className="text-[9px] font-black uppercase text-slate-600 tracking-wider flex items-center gap-1">
              🛡️ Safety Limit:
            </span>
            <select
 id="variancethreshold_1060" name="variancethreshold" aria-label="variancethreshold"              value={varianceThreshold}
              onChange={(e) => handleThresholdChange(Number(e.target.value))}
              className="bg-white border border-slate-350 rounded text-[9.5px] font-extrabold uppercase py-0.5 px-1.5 outline-none focus:border-indigo-500 cursor-pointer text-slate-800 font-mono"
              title="Variance tolerance safety threshold before auto-generating audit mismatch cases"
            >
              <option value="2">2% Strict</option>
              <option value="5">5% Recommended</option>
              <option value="10">10% Standard</option>
              <option value="15">15% Relaxed</option>
            </select>
          </div>

          <button 
            onClick={handleExportCSV}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-mono text-[10px] uppercase font-black px-3 py-1.5 rounded shadow-[1px_1px_0_0_rgba(0,0,0,0.3)] hover:shadow border border-emerald-600 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
            title="Download full audit discrepancy spreadsheet"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Export Comparative Sheet
          </button>
          <button 
            onClick={loadReconciliationData}
            disabled={loading}
            className="bg-indigo-700 hover:bg-indigo-850 text-white font-mono text-[10px] uppercase font-black px-3 py-1.5 rounded shadow-[1px_1px_0_0_rgba(0,0,0,0.3)] hover:shadow border border-indigo-600 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Re-run Scan
          </button>
        </div>
      </div>

      {/* Success/Error notices */}
      {successMessage && (
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-3 text-emerald-950 font-semibold text-xs rounded shadow-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="bg-rose-50 border-l-4 border-rose-500 p-3 text-rose-950 font-semibold text-xs rounded shadow-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Metric summary bento cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Total comparative audits */}
        <div className="bg-slate-100 border border-slate-300 p-2.5 rounded shadow-xs flex flex-col justify-between ">
          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Overall Audited Loads</span>
          <span className="text-xl font-mono font-black text-slate-800 leading-none mt-1">{counters.total}</span>
          <span className="text-[8.5px] text-slate-400 mt-1">Cross-table registries</span>
        </div>

        {/* Fully Matched */}
        <div className="bg-emerald-50 border border-emerald-250 p-2.5 rounded shadow-xs flex flex-col justify-between ">
          <span className="text-[9px] uppercase font-bold text-emerald-600 tracking-wider flex items-center gap-1">
            🟢 Fully Matched
          </span>
          <span className="text-xl font-mono font-black text-emerald-700 leading-none mt-1">{counters.fullyMatched}</span>
          <span className="text-[8.5px] text-emerald-600 mt-1 font-semibold">100% parameter accuracy</span>
        </div>

        {/* Parameter Mismatch */}
        <div className="bg-amber-50 border border-amber-250 p-2.5 rounded shadow-xs flex flex-col justify-between ">
          <span className="text-[9px] uppercase font-bold text-amber-600 tracking-wider flex items-center gap-1 animate-pulse">
            ⚠️ Parameter Mismatch
          </span>
          <span className="text-xl font-mono font-black text-amber-700 leading-none mt-1">{counters.mismatchCount}</span>
          <span className="text-[8.5px] text-amber-700 mt-1 font-bold">Needs lab metrics sync</span>
        </div>

        {/* Pending Inspections */}
        <div className="bg-blue-50 border border-blue-250 p-2.5 rounded shadow-xs flex flex-col justify-between ">
          <span className="text-[9px] uppercase font-bold text-blue-600 tracking-wider">Pending Quality Audit</span>
          <span className="text-xl font-mono font-black text-blue-700 leading-none mt-1">{counters.pendingInspection}</span>
          <span className="text-[8.5px] text-blue-500 mt-1">Awaiting lab checklist</span>
        </div>

        {/* Orphaned Inspections */}
        <div className="bg-rose-50 border border-rose-250 p-2.5 rounded shadow-xs flex flex-col justify-between ">
          <span className="text-[9px] uppercase font-bold text-rose-600 tracking-wider">Orphan Inspections</span>
          <span className="text-xl font-mono font-black text-rose-700 leading-none mt-1">{counters.orphanInspection}</span>
          <span className="text-[8.5px] text-rose-500 mt-1 font-bold">No Final Arrival logged</span>
        </div>
      </div>

      {/* Dynamic Quantity & Weight Reconciliation Visualizer */}
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-2 mb-3 gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 border border-indigo-200 rounded text-indigo-700">
              <BarChart className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-xs font-black uppercase tracking-tight text-slate-800">
                Expected vs. Actual Quantity & Weight Balance Visualizer
              </h3>
              <p className="text-[9px] text-slate-500 font-semibold leading-none mt-1">
                Audit analytics: compares Expected (Lab Inspection Master/Details) against Actual physical receipts.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            {/* Metric Selector */}
            <div className="flex bg-slate-100 border border-slate-300 rounded p-0.5">
              <button
                type="button"
                onClick={() => setChartMetric('quantity')}
                className={cn(
                  "px-2 py-1 text-[8px] font-black uppercase rounded transition-all cursor-pointer",
                  chartMetric === 'quantity' ? "bg-slate-800 text-white shadow-inner" : "text-slate-600 hover:bg-slate-200"
                )}
              >
                Packets / Bales
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('weight')}
                className={cn(
                  "px-2 py-1 text-[8px] font-black uppercase rounded transition-all cursor-pointer",
                  chartMetric === 'weight' ? "bg-slate-800 text-white shadow-inner" : "text-slate-600 hover:bg-slate-200"
                )}
              >
                Tons / Qtls Weight
              </button>
            </div>

            {/* Minimize/Maximize Toggle */}
            <button
              onClick={() => setShowChart(!showChart)}
              className="p-1 hover:bg-slate-150 border border-slate-300 bg-slate-50 rounded text-slate-600 transition-colors cursor-pointer flex items-center justify-center"
              title={showChart ? "Collapse analytics view" : "Expand analytics view"}
            >
              {showChart ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {showChart ? (
          chartData.length === 0 ? (
            <div className="py-8 text-center text-xs font-bold text-slate-400 bg-slate-50 border border-dashed border-slate-300 rounded">
              No matching quantity/weight data available to render the audit chart. Register or match some arrivals first.
            </div>
          ) : (
            <div className="space-y-2 animate-fade-in">
              <div className="h-64 md:h-72 w-full pr-2">
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                  <RechartsBarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#475569" 
                      fontSize={9} 
                      fontWeight="bold"
                      tickLine={false} 
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <YAxis 
                      stroke="#475569" 
                      fontSize={9} 
                      fontWeight="bold"
                      tickLine={false} 
                      axisLine={{ stroke: '#cbd5e1' }}
                    />
                    <Tooltip content={renderChartTooltip} cursor={{ fill: 'rgba(241,245,249,0.5)' }} />
                    <Legend 
                      verticalAlign="top" 
                      height={24}
                      content={() => (
                        <div className="flex flex-wrap justify-center gap-4 text-[8px] font-black uppercase tracking-wider text-slate-600 mb-2">
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-2.5 h-2.5 bg-slate-400 rounded-xs" />
                            Expected (Lab Details)
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-2.5 h-2.5 bg-indigo-600 rounded-xs" />
                            Actual Received (Dynamic Color Highlights)
                          </span>
                        </div>
                      )}
                    />
                    <Bar 
                      dataKey="expected" 
                      fill="#94a3b8" 
                      radius={[3, 3, 0, 0]} 
                      barSize={16}
                    />
                    <Bar 
                      dataKey="actual" 
                      radius={[3, 3, 0, 0]} 
                      barSize={16}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getBarColorForEntry(entry)} />
                      ))}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>

              {/* Legend & Color-Key Explanation */}
              <div className="bg-slate-50 border border-slate-200 rounded p-2 text-[9px] font-semibold text-slate-500 leading-normal flex flex-col md:flex-row gap-2 items-start md:items-center justify-between">
                <span className="font-bold text-slate-600 uppercase tracking-wide shrink-0">💡 Color Variance Indicator:</span>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1 text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" /> Balanced Match (±0)
                  </span>
                  <span className="flex items-center gap-1 text-amber-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> Deficit Warning (Receipt Shortage)
                  </span>
                  <span className="flex items-center gap-1 text-indigo-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" /> Surplus Over-receipt
                  </span>
                  <span className="flex items-center gap-1 text-blue-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#93c5fd]" /> Pending Inspection (Expected = 0)
                  </span>
                  <span className="flex items-center gap-1 text-rose-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#fda4af]" /> Orphan Audit (Actual = 0)
                  </span>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="py-2.5 text-center text-[9px] text-slate-600 font-bold uppercase bg-slate-50 border border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setShowChart(true)}>
            📊 Visualization minimized. Click to expand comparative metrics chart.
          </div>
        )}
      </div>

      {/* 6-Month Historical Discrepancy Trend */}
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-2 mb-3 gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 border border-indigo-200 rounded text-indigo-700">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-xs font-black uppercase tracking-tight text-slate-800">
                6-Month Historical Discrepancy & Variance Trend
              </h3>
              <p className="text-[9px] text-slate-500 font-semibold leading-none mt-1">
                Monitors average monthly deviations (%) in material quantity and weight to identify vendor inconsistency.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
            {/* Vendor / Supplier Dropdown */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5">
              <span className="text-[8px] font-black uppercase text-slate-500 font-mono">Filter Vendor:</span>
              <select
 id="selectedtrendsupplier_1315" name="selectedtrendsupplier" aria-label="selectedtrendsupplier"                value={selectedTrendSupplier}
                onChange={(e) => setSelectedTrendSupplier(e.target.value)}
                className="bg-white border border-slate-200 rounded text-[9.5px] font-extrabold py-0.5 px-1 outline-none cursor-pointer text-slate-800"
              >
                <option value="ALL">All Vendors / Suppliers</option>
                {uniqueTrendSuppliers.map(sup => (
                  <option key={sup} value={sup}>{sup}</option>
                ))}
              </select>
            </div>

            {/* Minimize/Maximize Toggle */}
            <button
              onClick={() => setShowTrendChart(!showTrendChart)}
              className="p-1 hover:bg-slate-150 border border-slate-300 bg-slate-50 rounded text-slate-600 transition-colors cursor-pointer flex items-center justify-center"
              title={showTrendChart ? "Collapse trend analytics" : "Expand trend analytics"}
            >
              {showTrendChart ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {showTrendChart ? (
          <div className="space-y-3 animate-fade-in">
            <div className="h-64 md:h-72 w-full pr-2">
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                <RechartsLineChart
                  data={trendData}
                  margin={{ top: 10, right: 15, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="monthLabel" 
                    stroke="#475569" 
                    fontSize={9} 
                    fontWeight="bold"
                    tickLine={false} 
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis 
                    stroke="#475569" 
                    fontSize={9} 
                    fontWeight="bold"
                    tickLine={false} 
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-slate-900 border-2 border-slate-700 text-white p-2.5 shadow-xl rounded-md text-[10px] font-sans">
                            <p className="font-extrabold text-[11px] text-yellow-400 border-b border-slate-700 pb-1 mb-2 uppercase tracking-wide">
                              {label} Trend
                            </p>
                            <div className="space-y-1 font-mono">
                              {payload.map((pld: any) => (
                                <p key={pld.name} style={{ color: pld.color }}>
                                  <span className="font-bold">{pld.name}:</span> {pld.value}% 
                                  <span className="text-slate-400 text-[8px] ml-1">
                                    ({pld.name.includes("Quantity") ? `${pld.payload.qtyCount} loads` : `${pld.payload.wtCount} loads`})
                                  </span>
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={24}
                    iconType="circle"
                    iconSize={8}
                    content={() => (
                      <div className="flex flex-wrap justify-center gap-4 text-[8px] font-black uppercase tracking-wider text-slate-600 mb-2">
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-2.5 h-0.5 bg-indigo-600 border-t-2 border-indigo-600" />
                          Average Quantity Variance (%)
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-2.5 h-0.5 bg-amber-500 border-t-2 border-amber-500" />
                          Average Weight Variance (%)
                        </span>
                      </div>
                    )}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Quantity Variance (%)" 
                    stroke="#4f46e5" 
                    strokeWidth={2.5}
                    activeDot={{ r: 6 }} 
                    dot={{ r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Weight Variance (%)" 
                    stroke="#f59e0b" 
                    strokeWidth={2.5}
                    activeDot={{ r: 6 }} 
                    dot={{ r: 4 }}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>

            {/* Vendor compliance ranking summary and insights */}
            {supplierDiscrepancyRank.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded p-2.5 space-y-1.5">
                <span className="text-[9px] font-black uppercase text-indigo-950 tracking-wider flex items-center gap-1">
                  🔍 Vendor Compliance Desk: Recurring Deviation Insights
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-0.5">
                  <div className="text-[9.5px] font-semibold text-slate-600 leading-relaxed space-y-1">
                    <p>
                      Top recurring variance records over the last 6 months (minimum 1 delivery):
                    </p>
                    <div className="space-y-1">
                      {supplierDiscrepancyRank.slice(0, 3).map((sup, idx) => (
                        <div key={sup.name} className="flex items-center justify-between text-[9px] bg-white border border-slate-150 rounded px-1.5 py-0.5">
                          <span className="font-bold text-slate-700 truncate max-w-[150px]">
                            {idx + 1}. {sup.name}
                          </span>
                          <span className="font-mono font-black text-rose-600 flex items-center gap-1">
                            {sup.avgVariance}% Avg Dev
                            <span className="text-[8px] text-slate-400 font-normal">({sup.deliveryCount} loads, {sup.mismatchCount} mis)</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-indigo-50 border border-indigo-200 rounded p-2 text-[9px] font-medium leading-normal flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-indigo-900 block uppercase tracking-wide mb-1">🚨 Persistence Alert Flag</span>
                      {supplierDiscrepancyRank[0] && supplierDiscrepancyRank[0].avgVariance > 2 ? (
                        <p className="text-indigo-950">
                          Supplier <strong className="text-rose-700">{supplierDiscrepancyRank[0].name}</strong> exhibits the highest average arrival variance of <strong>{supplierDiscrepancyRank[0].avgVariance}%</strong> across {supplierDiscrepancyRank[0].deliveryCount} audited loads, generating <strong>{supplierDiscrepancyRank[0].mismatchCount}</strong> critical mismatches. Consider auditing weighbridge calibrations.
                        </p>
                      ) : (
                        <p className="text-slate-600">
                          All suppliers remain within normal safe compliance thresholds. No systemic weight or bale mismatches detected over the current 6-month period.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-2 text-center text-[9px] text-slate-600 font-bold uppercase bg-slate-50 border border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setShowTrendChart(true)}>
            📈 Trend analysis minimized. Click to expand 6-month variance timeline.
          </div>
        )}
      </div>

      {/* 12-Month Vendor Discrepancy Heatmap */}
      <div className="bg-white border border-slate-300 rounded shadow-xs p-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 pb-2 mb-3 gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-50 border border-rose-200 rounded text-rose-700 animate-pulse">
              <Flame className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-xs font-black uppercase tracking-tight text-slate-800 flex items-center gap-1.5">
                12-Month Vendor Arrival Variance Heatmap
                <span className="text-[8px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">Live Audit</span>
              </h3>
              <p className="text-[9px] text-slate-500 font-semibold leading-none mt-1">
                Visualizes recurring weight & quantity deviations per supplier. Click any colored tile to inspect individual shipment loads.
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {/* Metric Selector Button Group */}
            <div className="flex items-center border border-slate-300 rounded overflow-hidden p-0.5 bg-slate-50">
              <button
                onClick={() => {
                  setHeatmapMetric('combined');
                  setSelectedHeatmapCell(null);
                }}
                className={cn(
                  "px-2 py-0.5 text-[8.5px] font-black uppercase rounded-xs transition-colors cursor-pointer",
                  heatmapMetric === 'combined' ? "bg-slate-800 text-white" : "text-slate-600 hover:text-slate-800 hover:bg-slate-200"
                )}
              >
                Combined
              </button>
              <button
                onClick={() => {
                  setHeatmapMetric('quantity');
                  setSelectedHeatmapCell(null);
                }}
                className={cn(
                  "px-2 py-0.5 text-[8.5px] font-black uppercase rounded-xs transition-colors cursor-pointer",
                  heatmapMetric === 'quantity' ? "bg-slate-800 text-white" : "text-slate-600 hover:text-slate-800 hover:bg-slate-200"
                )}
              >
                Quantity
              </button>
              <button
                onClick={() => {
                  setHeatmapMetric('weight');
                  setSelectedHeatmapCell(null);
                }}
                className={cn(
                  "px-2 py-0.5 text-[8.5px] font-black uppercase rounded-xs transition-colors cursor-pointer",
                  heatmapMetric === 'weight' ? "bg-slate-800 text-white" : "text-slate-600 hover:text-slate-800 hover:bg-slate-200"
                )}
              >
                Weight
              </button>
            </div>

            {/* Minimize/Maximize Toggle */}
            <button
              onClick={() => setShowHeatmap(!showHeatmap)}
              className="p-1 hover:bg-slate-150 border border-slate-300 bg-slate-50 rounded text-slate-600 transition-colors cursor-pointer flex items-center justify-center"
              title={showHeatmap ? "Collapse heatmap panel" : "Expand heatmap panel"}
            >
              {showHeatmap ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {showHeatmap ? (
          <div className="space-y-3 animate-fade-in">
            {/* Heatmap Grid Wrapper */}
            <div className="overflow-x-auto border border-slate-200 rounded">
              <div className="min-w-[840px] bg-slate-50/50 p-2">
                
                {/* Header Months row */}
                <div 
                  className="gap-1 items-center mb-1.5 text-center font-mono"
                  style={{ display: 'grid', gridTemplateColumns: '170px repeat(12, minmax(0, 1fr)) 80px', gap: '4px' }}
                >
                  <div className="text-left pl-1 text-[8.5px] font-black uppercase text-slate-500 tracking-wider">
                    Vendor / Supplier
                  </div>
                  {heatmapData.months.map(m => (
                    <div key={m.label} className="text-[8px] font-black uppercase text-slate-500 py-1 bg-slate-100 rounded border border-slate-200">
                      {m.label}
                    </div>
                  ))}
                  <div className="text-[8px] font-black uppercase text-slate-600 bg-slate-200 rounded border border-slate-300 py-1">
                    Overall
                  </div>
                </div>

                {/* Heatmap Rows per Vendor */}
                {heatmapData.grid.length === 0 ? (
                  <div className="py-8 text-center text-[10px] text-slate-400 font-extrabold uppercase font-mono">
                    No supplier transaction data available to render heatmap.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {heatmapData.grid.map(row => {
                      return (
                        <div 
                          key={row.vendor} 
                          className="gap-1 items-center text-center"
                          style={{ display: 'grid', gridTemplateColumns: '170px repeat(12, minmax(0, 1fr)) 80px', gap: '4px' }}
                        >
                          {/* Vendor Name Column */}
                          <div className="text-left pl-1 truncate text-[9.5px] font-extrabold text-slate-700 tracking-tight" title={row.vendor}>
                            {row.vendor}
                          </div>

                          {/* 12 Monthly cells */}
                          {row.monthlyStats.map((stat, idx) => {
                            const val = heatmapMetric === 'quantity' ? stat.qtyVar : (heatmapMetric === 'weight' ? stat.wtVar : stat.combinedVar);
                            const count = stat.deliveriesCount;

                            // Dynamic cell styling based on variance thresholds
                            let cellBg = 'bg-slate-100/70 border border-slate-200 text-slate-300'; // No deliveries
                            let titleText = `${row.vendor} - ${stat.monthLabel}: No shipments`;
                            
                            if (count > 0) {
                              if (val <= 1.5) {
                                cellBg = 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 cursor-pointer';
                              } else if (val <= 4.0) {
                                cellBg = 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-300 cursor-pointer';
                              } else if (val <= 8.0) {
                                cellBg = 'bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-300 cursor-pointer';
                              } else if (val <= 15.0) {
                                cellBg = 'bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 cursor-pointer';
                              } else {
                                cellBg = 'bg-rose-200 hover:bg-rose-300 text-rose-900 border border-rose-400 font-black cursor-pointer animate-pulse';
                              }
                              titleText = `${row.vendor} (${stat.monthLabel}): ${val}% Avg Variance (${count} load${count > 1 ? 's' : ''})`;
                            }

                            const isSelected = selectedHeatmapCell?.vendor === row.vendor && selectedHeatmapCell?.monthLabel === stat.monthLabel;

                            return (
                              <div
                                key={idx}
                                onClick={() => {
                                  if (count > 0) {
                                    setSelectedHeatmapCell({
                                      vendor: row.vendor,
                                      monthLabel: stat.monthLabel,
                                      value: val,
                                      deliveriesCount: count,
                                      loads: stat.loads
                                    });
                                  }
                                }}
                                className={cn(
                                  "text-[8.5px] font-mono font-bold py-1.5 rounded-xs  transition-all",
                                  cellBg,
                                  isSelected ? "ring-2 ring-indigo-600 ring-offset-1 scale-102 font-black border-indigo-500" : "hover:scale-103"
                                )}
                                title={titleText}
                              >
                                {count > 0 ? `${val}%` : '-'}
                              </div>
                            );
                          })}

                          {/* Overall Average Column */}
                          <div className={cn(
                            "text-[8.5px] font-mono font-black py-1.5 rounded border",
                            row.overallAvgVar <= 1.5 ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                            row.overallAvgVar <= 4.0 ? "bg-yellow-50 text-yellow-800 border-yellow-200" :
                            row.overallAvgVar <= 8.0 ? "bg-orange-50 text-orange-800 border-orange-200" :
                            "bg-rose-50 text-rose-800 border-rose-200"
                          )}>
                            {row.overallAvgVar}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            </div>

            {/* Heatmap Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[8.5px] font-black uppercase text-slate-500 font-mono tracking-wider">
              <span className="flex items-center gap-1.5">
                📊 Color Scale (Avg Variance %):
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3.5 h-3.5 bg-slate-100 border border-slate-200 rounded-xs" />
                  No Data
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3.5 h-3.5 bg-emerald-100 border border-emerald-300 rounded-xs" />
                  ≤ 1.5% (Safe)
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3.5 h-3.5 bg-yellow-100 border border-yellow-300 rounded-xs" />
                  1.5% - 4%
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3.5 h-3.5 bg-orange-100 border border-orange-300 rounded-xs" />
                  4% - 8%
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3.5 h-3.5 bg-red-100 border border-red-300 rounded-xs" />
                  8% - 15%
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3.5 h-3.5 bg-rose-200 border border-rose-400 rounded-xs animate-pulse" />
                  &gt; 15% (Critical)
                </span>
              </div>
            </div>

            {/* Detail Inspector Panel for selected Heatmap cell */}
            {selectedHeatmapCell && (
              <div className="bg-slate-900 border border-slate-700 rounded-md p-3 text-white space-y-2.5 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="p-1 bg-rose-950 text-rose-400 border border-rose-900 rounded">
                      <Grid className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-[10px] uppercase font-black tracking-wide text-slate-100">
                      Heatmap Audit Inspector: <strong className="text-yellow-400">{selectedHeatmapCell.vendor}</strong> in <strong className="text-yellow-400">{selectedHeatmapCell.monthLabel}</strong>
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedHeatmapCell(null)}
                    className="text-slate-400 hover:text-white font-black text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    × Close Inspector
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[9px] font-mono text-slate-300 bg-slate-950 p-2 rounded border border-slate-800">
                  <div>
                    <span className="text-slate-500 block uppercase font-extrabold text-[8px]">Reconciled Loads:</span>
                    <strong className="text-white text-[11px]">{selectedHeatmapCell.deliveriesCount} shipment(s)</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase font-extrabold text-[8px]">Average Variance ({heatmapMetric}):</span>
                    <strong className="text-rose-400 text-[11px]">{selectedHeatmapCell.value}% Avg Deviation</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase font-extrabold text-[8px]">Safety Status:</span>
                    <strong className={cn(
                      "text-[11px] uppercase",
                      selectedHeatmapCell.value <= varianceThreshold ? "text-emerald-400" : "text-rose-400 animate-pulse"
                    )}>
                      {selectedHeatmapCell.value <= varianceThreshold ? "🛡️ Compliant" : "🚨 Safety Violation"}
                    </strong>
                  </div>
                </div>

                {/* Table of individual transaction loads in the selected cell */}
                <div className="overflow-x-auto max-h-40 border border-slate-800 rounded">
                  <table className="w-full text-left font-mono text-[8.5px] text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-bold sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="p-1.5 pl-2">Voucher / ID</th>
                        <th className="p-1.5">Date</th>
                        <th className="p-1.5 text-right">Expected Qty/Wt</th>
                        <th className="p-1.5 text-right">Actual Qty/Wt</th>
                        <th className="p-1.5 text-right">Variance</th>
                        <th className="p-1.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {selectedHeatmapCell.loads.map((load, idx) => {
                        const qtyDiff = load.expected_qty ? (Math.abs((load.actual_qty || 0) - load.expected_qty) / load.expected_qty) * 100 : 0;
                        const wtDiff = load.expected_weight ? (Math.abs((load.actual_weight || 0) - load.expected_weight) / load.expected_weight) * 100 : 0;
                        const variance = heatmapMetric === 'quantity' ? qtyDiff : (heatmapMetric === 'weight' ? wtDiff : (qtyDiff + wtDiff) / 2);

                        return (
                          <tr key={load.id || idx} className="hover:bg-slate-850">
                            <td className="p-1.5 pl-2 font-bold text-yellow-500">
                              #{load.final_arrival_no || load.id.slice(0, 8)}
                            </td>
                            <td className="p-1.5">{load.arrival_date || load.inspection_date || 'N/A'}</td>
                            <td className="p-1.5 text-right">
                              {load.expected_qty?.toFixed(0) || '0'} B / {load.expected_weight?.toFixed(2) || '0'} MT
                            </td>
                            <td className="p-1.5 text-right text-white">
                              {load.actual_qty?.toFixed(0) || '0'} B / {load.actual_weight?.toFixed(2) || '0'} MT
                            </td>
                            <td className="p-1.5 text-right font-bold text-rose-400">
                              {variance.toFixed(1)}%
                            </td>
                            <td className="p-1.5 text-center">
                              <span className={cn(
                                "px-1 py-0.5 rounded text-[7px] font-black uppercase",
                                load.status === 'fully_matched' ? "bg-emerald-950 text-emerald-400 border border-emerald-900" : "bg-rose-950 text-rose-400 border border-rose-900"
                              )}>
                                {load.status?.replace('_', ' ')}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-2 text-center text-[9px] text-slate-600 font-bold uppercase bg-slate-50 border border-dashed border-slate-300 rounded cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => setShowHeatmap(true)}>
            🔥 Vendor Variance Heatmap minimized. Click to expand 12-month analytics.
          </div>
        )}
      </div>

      {/* Filtering and search desk */}
      <div className="bg-slate-200 p-2 border border-slate-350 rounded flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button 
            onClick={() => setFilterType('all')}
            className={cn(
              "px-3 py-1 text-[10px] uppercase font-black rounded cursor-pointer transition-all duration-100",
              filterType === 'all' ? "bg-slate-800 text-white shadow-inner" : "bg-white hover:bg-slate-100 border border-slate-300 text-slate-700"
            )}
          >
            All ({counters.total})
          </button>
          <button 
            onClick={() => setFilterType('mismatch')}
            className={cn(
              "px-3 py-1 text-[10px] uppercase font-black rounded cursor-pointer transition-all duration-100",
              filterType === 'mismatch' ? "bg-amber-600 text-white shadow-inner" : "bg-amber-100/60 hover:bg-amber-200 border border-amber-300 text-amber-800"
            )}
          >
            Mismatches ({counters.mismatchCount})
          </button>
          <button 
            onClick={() => setFilterType('pending_inspection')}
            className={cn(
              "px-3 py-1 text-[10px] uppercase font-black rounded cursor-pointer transition-all duration-100",
              filterType === 'pending_inspection' ? "bg-blue-600 text-white shadow-inner" : "bg-blue-100/60 hover:bg-blue-200 border border-blue-300 text-blue-800"
            )}
          >
            Pending Labs ({counters.pendingInspection})
          </button>
          <button 
            onClick={() => setFilterType('orphan_inspection')}
            className={cn(
              "px-3 py-1 text-[10px] uppercase font-black rounded cursor-pointer transition-all duration-100",
              filterType === 'orphan_inspection' ? "bg-rose-600 text-white shadow-inner" : "bg-rose-100/60 hover:bg-rose-200 border border-rose-300 text-rose-800"
            )}
          >
            Orphans ({counters.orphanInspection})
          </button>
          <button 
            onClick={() => setFilterType('fully_matched')}
            className={cn(
              "px-3 py-1 text-[10px] uppercase font-black rounded cursor-pointer transition-all duration-100",
              filterType === 'fully_matched' ? "bg-emerald-600 text-white shadow-inner" : "bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-800"
            )}
          >
            Fully Matched ({counters.fullyMatched})
          </button>
        </div>

        {/* Search */}
        <div className="flex bg-white border border-slate-350 rounded overflow-hidden shadow-xs w-full md:w-80">
          <input  id="search_fa_mr_no_supplier__1843" name="search_fa_mr_no_supplier_" aria-label="Search FA, MR No, supplier, contract..."
            className="flex-1 text-xs px-2.5 py-1.5 outline-none font-medium placeholder:text-slate-400" 
            placeholder="Search FA, MR No, supplier, contract..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="bg-slate-100 px-3 flex items-center justify-center border-l border-slate-200">
            <Search className="h-3.5 w-3.5 text-slate-500" />
          </div>
        </div>
      </div>

      {/* Bulk action bar if there are mismatches */}
      {counters.mismatchCount > 0 && (filterType === 'all' || filterType === 'mismatch') && (
        <div className="bg-amber-100/70 border border-amber-300 p-3 rounded flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-amber-600 text-white">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-black text-amber-950 uppercase">Active Discrepancies Found ({counters.mismatchCount} items)</p>
              <p className="text-[10px] text-amber-800 font-semibold leading-tight">These Final Arrival logs differ from lab-certified quality audits. Choose action to restore consistency.</p>
            </div>
          </div>
          <button 
            onClick={handleBulkReconcile}
            className="bg-amber-600 hover:bg-amber-700 text-white font-mono text-[9px] uppercase font-black px-3.5 py-1.5 rounded shadow-sm border border-amber-500 flex items-center gap-1.5 cursor-pointer hover:-translate-y-px active:translate-y-0 transition-all"
          >
            ⚡ Bulk Reconcile with Quality Values
          </button>
        </div>
      )}

      {/* Main comparative workspace table */}
      <div className="bg-[#d4d0c8] p-1 border border-white shadow-[inset_1px_1px_0_0_rgba(0,0,0,0.2)] overflow-x-auto rounded">
        <table className="w-full text-left text-[11px] border-collapse bg-white">
          <thead>
            <tr className="bg-slate-800 text-white font-mono text-[10px] uppercase ">
              <th className="p-2 border border-slate-700 text-center w-10">Srl</th>
              <th className="p-2 border border-slate-700 w-40">Status Class</th>
              <th className="p-2 border border-slate-700 w-1/3">
                <div className="font-bold border-b border-slate-700 pb-0.5">🚚 Recorded Final Arrival Track</div>
                <div className="grid grid-cols-3 text-[8.5px] text-slate-300 pt-0.5">
                  <span>FA / Lorry / Date</span>
                  <span>Supplier / Contract PO</span>
                  <span>Lab: M / D / NCV</span>
                </div>
              </th>
              <th className="p-2 border border-slate-700 w-1/3">
                <div className="font-bold border-b border-slate-700 pb-0.5">🔬 Expected Lab Quality Audit</div>
                <div className="grid grid-cols-3 text-[8.5px] text-slate-300 pt-0.5">
                  <span>MR No / Date</span>
                  <span>Supplier / Contract PO</span>
                  <span>Lab: M / D / NCV</span>
                </div>
              </th>
              <th className="p-2 border border-slate-700 text-center w-36">Actions / Action Logs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500 font-mono italic">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-indigo-700" />
                    <span className="uppercase text-[10px] font-black tracking-widest text-indigo-900 animate-pulse">Scanning database nodes...</span>
                  </div>
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500 font-mono italic">
                  No matching reconciliation records found for selected filter criteria.
                </td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => {
                return (
                  <tr 
                    key={item.id} 
                    className={cn(
                      "hover:bg-slate-50/80 transition-colors",
                      item.status === 'mismatch' ? "bg-amber-50/45" : "",
                      item.status === 'pending_inspection' ? "bg-blue-50/25" : "",
                      item.status === 'orphan_inspection' ? "bg-rose-50/20" : ""
                    )}
                  >
                    {/* Index */}
                    <td className="p-2 border border-slate-200 text-center font-mono font-bold text-slate-700">
                      {idx + 1}
                    </td>

                    {/* Status Class Badge */}
                    <td className="p-2 border border-slate-200">
                      <div className="space-y-1">
                        <span className={cn(
                          "px-2 py-0.5 text-[8.5px] font-black uppercase tracking-wider rounded font-mono block text-center",
                          item.status === 'fully_matched' ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "",
                          item.status === 'mismatch' ? "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse" : "",
                          item.status === 'pending_inspection' ? "bg-blue-100 text-blue-800 border border-blue-300" : "",
                          item.status === 'orphan_inspection' ? "bg-rose-100 text-rose-800 border border-rose-300" : ""
                        )}>
                          {item.status === 'fully_matched' && "✅ Matched"}
                          {item.status === 'mismatch' && "⚠️ Mismatch"}
                          {item.status === 'pending_inspection' && "⏱️ Pending Lab"}
                          {item.status === 'orphan_inspection' && "🚨 Orphan"}
                        </span>
                        <div className="text-[8.5px] text-slate-500 font-mono text-center truncate">
                          {item.typeLabel}
                        </div>
                      </div>
                    </td>

                    {/* Final Arrival Column details */}
                    <td className="p-2 border border-slate-200">
                      {item.final_arrival_no ? (
                        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                          {/* Col 1 */}
                          <div className="space-y-0.5">
                            <div className="font-mono font-bold text-slate-950 truncate flex items-center gap-1.5" title={`FA No: ${item.final_arrival_no}`}>
                              <span>{item.final_arrival_no}</span>
                              {item.has_mill_issue && (
                                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[8px] px-1 rounded-sm font-black uppercase tracking-wider  animate-fade-in" title={`Material Issue Created: ${item.mill_issue_no || ''}`}>
                                  Complete
                                </span>
                              )}
                            </div>
                            <div className="text-[9.5px] text-slate-500 font-mono truncate">
                              Plt: {item.lorry_number || 'N/A'}
                            </div>
                            <div className="text-[9.5px] text-slate-500 font-mono">
                              {item.arrival_date ? new Date(item.arrival_date).toLocaleDateString('en-GB') : 'N/A'}
                            </div>
                          </div>

                          {/* Col 2 */}
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-800 truncate" title={item.arrival_supplier}>
                              {item.arrival_supplier || 'N/A'}
                            </div>
                            <div className="text-[9.5px] font-mono font-bold text-slate-500 truncate" title={`Contract PO: ${item.arrival_po}`}>
                              {item.arrival_po || 'DIRECT'}
                            </div>
                          </div>

                          {/* Col 3 */}
                          <div className="space-y-0.5 text-right font-mono">
                            <div className={cn(
                              "text-[10px] font-bold",
                              item.mismatches.some(m => m.field === 'actual_moisture') ? "text-rose-600 underline font-black" : "text-slate-700"
                            )}>
                              Moist: {item.arrival_moisture ?? '0'}%
                            </div>
                            <div className={cn(
                              "text-[10px] font-bold",
                              item.mismatches.some(m => m.field === 'actual_dust') ? "text-rose-600 underline font-black" : "text-slate-700"
                            )}>
                              Dust: {item.arrival_dust ?? '0'}%
                            </div>
                            <div className={cn(
                              "text-[10px] font-bold",
                              item.mismatches.some(m => m.field === 'actual_ncv') ? "text-rose-600 underline font-black" : "text-slate-700"
                            )}>
                              NCV: {item.arrival_ncv ?? '0'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-slate-400 font-mono italic text-[10px] py-2">
                          -- No registered arrival record --
                        </div>
                      )}
                    </td>

                    {/* Inspection Column details */}
                    <td className="p-2 border border-slate-200">
                      {item.mr_no ? (
                        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                          {/* Col 1 */}
                          <div className="space-y-0.5">
                            <div className="font-mono font-bold text-slate-950 truncate" title={`MR No: ${item.mr_no}`}>
                              MR No: {item.mr_no}
                            </div>
                            <div className="text-[9.5px] text-slate-500 font-mono">
                              {item.inspection_date ? new Date(item.inspection_date).toLocaleDateString('en-GB') : 'N/A'}
                            </div>
                          </div>

                          {/* Col 2 */}
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-800 truncate" title={item.inspection_supplier}>
                              {item.inspection_supplier || 'N/A'}
                            </div>
                            <div className="text-[9.5px] font-mono font-bold text-slate-500 truncate" title={`Inspection PO: ${item.inspection_po}`}>
                              PO: {item.inspection_po || 'N/A'}
                            </div>
                          </div>

                          {/* Col 3 */}
                          <div className="space-y-0.5 text-right font-mono">
                            <div className={cn(
                              "text-[10px] font-bold",
                              item.mismatches.some(m => m.field === 'actual_moisture') ? "text-emerald-700 font-black" : "text-slate-700"
                            )}>
                              M: {item.inspection_moisture ?? '0'}%
                            </div>
                            <div className={cn(
                              "text-[10px] font-bold",
                              item.mismatches.some(m => m.field === 'actual_dust') ? "text-emerald-700 font-black" : "text-slate-700"
                            )}>
                              D: {item.inspection_dust ?? '0'}%
                            </div>
                            <div className={cn(
                              "text-[10px] font-bold",
                              item.mismatches.some(m => m.field === 'actual_ncv') ? "text-emerald-700 font-black" : "text-slate-700"
                            )}>
                              N: {item.inspection_ncv ?? '0'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-slate-400 font-mono italic text-[10px] py-2">
                          -- Pending quality inspection report --
                        </div>
                      )}
                    </td>

                    {/* Actions and status message */}
                    <td className="p-2 border border-slate-200 text-center">
                      {item.status === 'fully_matched' && (
                        <div className="flex items-center justify-center gap-1 text-emerald-700 font-mono text-[9px] uppercase font-black">
                          <CheckCircle2 className="h-3 w-3" /> Fully OK
                        </div>
                      )}

                      {item.status === 'mismatch' && (
                        <div className="space-y-1.5">
                          <div className="text-[8px] uppercase font-black tracking-tight text-amber-800 font-bold">
                            {item.mismatches.length} Fields Mismatch
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSingleReconcile(item)}
                            className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[8.5px] uppercase font-black tracking-wide cursor-pointer flex items-center gap-1 mx-auto"
                            title="Force sync arrival to match certified lab values"
                          >
                            <Check className="h-2.5 w-2.5" /> Reconcile Now
                          </button>
                        </div>
                      )}

                      {item.status === 'pending_inspection' && (
                        <span className="text-[9px] text-blue-600 font-mono uppercase font-semibold">
                          Awaiting Inspection
                        </span>
                      )}

                      {item.status === 'orphan_inspection' && (
                        <button
                          type="button"
                          onClick={() => handleRegisterOrphan(item)}
                          className="bg-rose-100 hover:bg-rose-250 text-rose-900 border border-rose-300 px-2 py-1 rounded text-[8.5px] uppercase font-black tracking-wider cursor-pointer flex items-center gap-1 mx-auto transition-colors"
                          title="Register new arrival with this pre-filled inspection data"
                        >
                          <Plus className="h-3 w-3" /> Register Arrival
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Help box */}
      <div className="bg-[#f2efe9] border border-slate-350 rounded p-3 text-[10px] space-y-1 ">
        <p className="font-bold uppercase tracking-wide text-slate-700 flex items-center gap-1 text-[10.5px]">
          <HelpCircle className="h-3.5 w-3.5 text-slate-500" /> Operational Reconciliation Guideline
        </p>
        <ul className="list-disc pl-4 space-y-0.5 text-slate-600 font-medium">
          <li><strong>Discrepancies (Mismatches):</strong> Represent linked records with differing quality levels (Moisture, Dust, NCV) or contract POs. Reconciling updates the Final Arrival table records with authenticated Lab certified values.</li>
          <li><strong>Pending Inspections:</strong> Registered Final Arrival loads that have not yet had their laboratory inspection checks finalized in the system.</li>
          <li><strong>Orphaned Quality Audits:</strong> Lab inspections registered by quality controllers for which no final arrival voucher has been logged yet in the gate office. You can click <strong>"Register Arrival"</strong> to instantly pre-fill and save their arrival.</li>
        </ul>
      </div>
    </div>
  );
}
