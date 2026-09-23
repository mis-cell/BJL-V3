import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Save, 
  X, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Archive, 
  ChevronDown, 
  Layers,
  ClipboardCheck,
  Calendar,
  Filter,
  Leaf,
  ArrowLeft
} from 'lucide-react';
import { cn, sanitizeDate } from '../lib/utils';
import { Amad, ArrivalDetailRow } from '../types';
import { dbModule } from '../services/dbModule';
import LegacyLayout from '../components/LegacyLayout';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { enforceEditOrDeletePermission } from '../lib/permissions';
import { supabase } from '../lib/supabase';

interface FinalArrivalEntryProps {
  onSave?: (d: any) => void;
  onCancel?: () => void;
  initialData?: any;
}

export default function FinalArrivalEntry({ onSave, onCancel, initialData }: FinalArrivalEntryProps) {
  const [loading, setLoading] = useState(false);
  const [showPoDropdown, setShowPoDropdown] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  useKeyboardNavigation(containerRef, () => {
    handleSave();
  });

  const [brokers, setBrokers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [markas, setMarkas] = useState<any[]>([]);
  const [inspectionsList, setInspectionsList] = useState<any[]>([]);
  const [existingArrivals, setExistingArrivals] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [temporaryArrivalList, setTemporaryArrivalList] = useState<any[]>([]);

  const getPaddedDetails = (initialFA?: any) => {
    let pDetails: ArrivalDetailRow[] = [];
    if (initialFA && initialFA.grid_details) {
      if (typeof initialFA.grid_details === 'string') {
        try {
          const parsed = initialFA.grid_details === 'undefined' || initialFA.grid_details === 'null' ? [] : JSON.parse(initialFA.grid_details === "undefined" ? "null" : initialFA.grid_details);
          if (Array.isArray(parsed)) {
            pDetails = parsed;
          }
        } catch (e) {
          console.error("Error parsing grid_details JSON:", e);
        }
      } else if (Array.isArray(initialFA.grid_details)) {
        pDetails = initialFA.grid_details;
      }
    }
    
    // Backfill quantity_chln and quantity_rcpt from netto_pnto if missing
    pDetails = pDetails.map(d => {
      const u = (d.unit || initialFA?.unit_name || '').toString().trim().toUpperCase();
      const isLoose = u.includes('LOOSE') || u === 'LOOSE';
      if (isLoose) {
        return {
          ...d,
          quantity_chln: 0,
          quantity_rcpt: 0
        };
      }
      if (Number(d.netto_pnto) > 0 && (!d.quantity_chln || !d.quantity_rcpt)) {
        const roundedNetto = Math.round(Number(d.netto_pnto));
        return {
          ...d,
          quantity_chln: d.quantity_chln || roundedNetto,
          quantity_rcpt: d.quantity_rcpt || roundedNetto
        };
      }
      return d;
    });

    const padded = [...pDetails];
    if (padded.length === 0) {
      padded.push({
        srl_no: 1,
        receipt_grade_code: '',
        receipt_grade_name: '',
        crop_year: '2026-27',
        challan_grade_name: '',
        agency_code: '',
        agency_name: '',
        challan_marka_code: '',
        challan_marka_name: '',
        netto_pnto: 0,
        quantity_chln: 0,
        quantity_rcpt: 0,
        unit: 'BALES',
        remarks: '',
        marks_phota: ''
      });
    }
    return padded.map((row, idx) => ({ ...row, srl_no: idx + 1 }));
  };

  const [details, setDetails] = useState<ArrivalDetailRow[]>(() => getPaddedDetails(initialData));

  const handleAddRow = () => {
    setDetails(prev => [
      ...prev,
      {
        srl_no: prev.length + 1,
        receipt_grade_code: '',
        receipt_grade_name: '',
        crop_year: '2026-27',
        challan_grade_name: '',
        agency_code: '',
        agency_name: '',
        challan_marka_code: '',
        challan_marka_name: '',
        netto_pnto: 0,
        quantity_chln: 0,
        quantity_rcpt: 0,
        unit: formData.unit_name || 'BALES',
        remarks: '',
        marks_phota: ''
      }
    ]);
  };

  const handleDeleteRow = () => {
    setDetails(prev => {
      if (prev.length <= 1) return prev;
      const copy = prev.slice(0, -1);
      return copy.map((row, idx) => ({ ...row, srl_no: idx + 1 }));
    });
  };

  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState(() => {
    return {
      financial_year: initialData?.financial_year || '2026-2027',
      arrival_no: initialData?.final_arrival_no || initialData?.arrival_no || '',
      mr_no: initialData?.mr_no || '',
      po_no: initialData?.po_no || '',
      po_date: initialData?.po_date || '',
      date: initialData?.date || initialData?.final_arrival_date || '',
      jci: initialData?.jci || initialData?.jci_no || 'No',
      jci_no: initialData?.jci || initialData?.jci_no || 'No',
      challan_supplier: (initialData?.challan_supplier || '').toUpperCase(),
      supplier: (initialData?.supplier || '').toUpperCase(),
      broker: (initialData?.broker || '').toUpperCase(),
      transporter_name: initialData?.transporter_name || '',
      challan_rr_no: initialData?.challan_rr_no || initialData?.challan_railway_receipt_no || initialData?.rr_gr_no || '',
      challan_railway_receipt_no: initialData?.challan_railway_receipt_no || initialData?.challan_rr_no || '',
      challan_rr_date: initialData?.challan_rr_date || '',
      lorry_number: initialData?.lorry_number || (initialData as any)?.lorry_no || (initialData as any)?.vehicle_no || '',
      pan_no: initialData?.pan_no || initialData?.part_no || '',
      part_no: initialData?.part_no || initialData?.pan_no || '',
      part_date: initialData?.part_date || '',
      consignment_note: initialData?.consignment_note || initialData?.consignment_note_no || (initialData as any)?.consignment_notice_no || '',
      consignment_note_no: initialData?.consignment_note || initialData?.consignment_note_no || (initialData as any)?.consignment_notice_no || '',
      consignment_note_date: initialData?.consignment_note_date || '',
      di_no: initialData?.di_no || '',
      di_date: initialData?.di_date || '',
      invoice_no: initialData?.invoice_no || '',
      invoice_date: initialData?.invoice_date || '',
      ptf: initialData?.ptf || initialData?.rfs || 'No',
      rfs: initialData?.rfs || initialData?.ptf || 'No',
      lorry_returned: initialData?.lorry_returned || 'No',
      lorry_returned_other_mill: initialData?.lorry_returned_other_mill || 'No',
      arrival_area_code: initialData?.arrival_area_code || '',
      arrival_area_name: (initialData?.arrival_area_name || initialData?.area || '').toUpperCase(),
      area: (initialData?.area || initialData?.arrival_area_name || '').toUpperCase(),
      unit_code: initialData?.unit_code || 'I',
      unit_name: initialData?.unit_name || 'BALES',
      way_bill_no: initialData?.way_bill_no || '',
      way_bill_date: initialData?.way_bill_date || '',
      rr_gr_no: initialData?.rr_gr_no || '',
      apmc_fees: initialData?.apmc_fees || 0,
      remarks: initialData?.remarks || '',
      temporary_arrival_no: initialData?.temporary_arrival_no || '',
      temporary_arrival_date: initialData?.temporary_arrival_date || '',

      // Weighments
      challan_material_weight: initialData?.challan_material_weight || 0,
      actual_gross_weight: initialData?.actual_gross_weight || 0,
      actual_tare_weight: initialData?.actual_tare_weight || 0,
      supplier_net_weight: initialData?.supplier_net_weight || 0,
      supplier_challan_gross: initialData?.supplier_challan_gross || 0,
      supplier_tare_weight: initialData?.supplier_tare_weight || 0,
      electronic_net_weight: initialData?.electronic_net_weight || 0,
      electronic_gross_weight: initialData?.electronic_gross_weight || 0,
      electronic_tare_weight: initialData?.electronic_tare_weight || 0,
      weight_reduced: initialData?.weight_reduced || 0
    };
  });

  const [unitList, setUnitList] = useState<string[]>(['BALES', 'DRUMS', 'LOOSE', 'P.BALES', 'H.BALES']);

  useEffect(() => {
    async function loadUnits() {
      try {
        if (supabase) {
          const { data } = await supabase.from('unit_master').select('unit_name').order('unit_name');
          if (data && data.length > 0) {
            const fetched = data.map((u: any) => u.unit_name).filter(Boolean);
            setUnitList(prev => Array.from(new Set([...fetched, ...prev])));
          }
        }
      } catch (err) {
        console.warn("Failed to fetch unit_master in FinalArrivalEntry", err);
      }
    }
    loadUnits();
  }, []);

  // Combined PO options sourced directly from Temporary Material Received table + Purchase Orders
  const combinedPoOptions = useMemo(() => {
    const list: any[] = [];
    
    // Filter temporaryArrivalList to exclude those already converted to a Final Arrival
    const pendingTempArrivals = (temporaryArrivalList || []).filter((ta: any) => {
      const tempMrVal = String(ta.temporary_arrival_no || ta.amad_no || ta.arrival_no || '').trim().toUpperCase();
      const tempId = String(ta.id || ta.temporary_arrival_id || '').trim().toUpperCase();

      if (!tempMrVal && !tempId) return true;

      // Keep if currently being edited
      const isCurrentMatch = initialData && (
        (initialData.temporary_arrival_no && String(initialData.temporary_arrival_no).trim().toUpperCase() === tempMrVal) ||
        (initialData.arrival_no && String(initialData.arrival_no).trim().toUpperCase() === tempMrVal)
      );
      if (isCurrentMatch) return true;

      // Check if already saved in final_arrival table (existingArrivals)
      const isAlreadyFinalized = (existingArrivals || []).some((fa: any) => {
        const faTempNo = String(fa.temporary_arrival_no || fa.amad_no || '').trim().toUpperCase();
        const faArrNo = String(fa.arrival_no || fa.mr_no || '').trim().toUpperCase();
        const faTempId = String(fa.temporary_arrival_id || '').trim().toUpperCase();

        return (
          (tempMrVal && (faTempNo === tempMrVal || faArrNo === tempMrVal)) ||
          (tempId && faTempId === tempId)
        );
      });

      return !isAlreadyFinalized;
    });

    // Sourced from Temporary Material Received list (Temporary Arrival Section)
    pendingTempArrivals.forEach((ta: any, idx: number) => {
      const poVal = (ta.po_no || '').trim().toUpperCase();
      const tempMrVal = (ta.temporary_arrival_no || ta.amad_no || ta.arrival_no || '').trim().toUpperCase();
      const supplierVal = (ta.supplier || ta.challan_supplier || '').trim();
      const lorryVal = (ta.lorry_number || ta.lorry_no || ta.vehicle_no || '').trim();
      const weightVal = ta.challan_material_weight || ta.quantity || 0;
      const dateVal = ta.date || ta.temporary_arrival_date || ta.po_date || '';

      list.push({
        id: ta.id || ta.temporary_arrival_id || `temp_${idx}`,
        po_no: tempMrVal || poVal || `TEMP-${idx + 1}`,
        temp_mr_no: tempMrVal,
        display_label: tempMrVal 
          ? `Temp MR #${tempMrVal} ${poVal ? `(PO: ${poVal})` : ''} - ${supplierVal} ${lorryVal ? `[${lorryVal}]` : ''}` 
          : `${poVal} - ${supplierVal} (${weightVal} MT)`,
        supplier: supplierVal,
        challan_supplier: ta.challan_supplier || supplierVal,
        broker: ta.broker || '',
        lorry_number: lorryVal,
        po_date: dateVal,
        quantity: weightVal,
        source: 'temporary_material_received',
        raw_item: ta
      });
    });

    return list;
  }, [temporaryArrivalList, existingArrivals, initialData]);

  // Load master registers on startup
  useEffect(() => {
    async function loadMastersAndIncrement() {
      try {
        const [brokData, suppData, areaData, agcData, gradeData, markaData, allArrivals, inspectionData, poData, tempPoData, tempArrivalData] = await Promise.all([
          dbModule.fetchAll('broker_master').catch(() => []),
          dbModule.fetchAll('supply_master').catch(() => []),
          dbModule.fetchAll('area_master').catch(() => []),
          dbModule.fetchAll('agency_master').catch(() => []),
          dbModule.fetchAll('grade_master').catch(() => []),
          dbModule.fetchAll('marka_master').catch(() => []),
          dbModule.fetchAll('final_arrival').catch(() => []),
          supabase ? supabase.from('material_inspection').select('*').order('created_at', { ascending: false }).then(r => r.data || []) : [],
          dbModule.fetchAll('purchase_master').catch(() => []),
          dbModule.fetchAll('sauda_check_point').catch(() => []),
          dbModule.fetchAll('temporary_material_received', 'created_at', false).catch(() => [])
        ]);

        setBrokers((brokData || []).map((b: any) => ({ ...b, brok_name: (b.brok_name || '').toUpperCase() })));
        setSuppliers((suppData || []).map((s: any) => ({ ...s, supp_name: (s.supp_name || '').toUpperCase() })));
        setAreas((areaData || []).map((a: any) => ({ ...a, area_name: (a.area_name || '').toUpperCase() })));
        setAgencies(agcData || []);
        setGrades(gradeData || []);
        setInspectionsList(inspectionData || []);
        setExistingArrivals(allArrivals || []);
        setTemporaryArrivalList(tempArrivalData || []);
        const normalizedTempPoData = (tempPoData || []).map(po => ({ ...po, status: po.status || 'temp' }));
        const mergedPos = [...(poData || []), ...normalizedTempPoData];
        const uniquePos = Array.from(new Map(mergedPos.map(po => [po.po_no, po])).values());

        setPurchaseOrders(uniquePos.filter((po: any) => {
          if (!po.po_no || po.status === 'cancelled') return false;
          
          const isCurrentMatch = initialData && initialData.po_no && String(po.po_no).trim().toUpperCase() === String(initialData.po_no).trim().toUpperCase();
          
          const pendingStr = String(po.pending ?? '').trim().toLowerCase();
          const statusStr = String(po.status ?? '').trim().toLowerCase();
          const receivedWt = parseFloat(po.received_weight_mt || po.received_mt) || 0;
          const contractWt = parseFloat(po.total_contract_mt || po.quantity) || 0;
          const isCompleted = po.pending === false || pendingStr === 'no' || pendingStr === 'false' || po.pending === 0 || statusStr === 'completed' || statusStr === 'settled' || (contractWt > 0 && receivedWt >= contractWt);

          if (isCurrentMatch) return true;
          return !isCompleted;
        }));

        let finalMarkas = markaData || [];
        setMarkas(finalMarkas);

        if (!initialData) {
          let nextNum = 502;
          if (allArrivals && allArrivals.length > 0) {
            let lastNum = 500;
            allArrivals.forEach((a: any) => {
              const an = a.final_arrival_no || '';
              const num = parseInt(an.replace(/[^0-9]/g, ''), 10);
              if (!isNaN(num) && num > lastNum) {
                lastNum = num;
              }
            });
            nextNum = lastNum + 1;
          }
          
          setFormData(prev => ({
            ...prev,
            arrival_no: `FA-${nextNum}`
          }));
        }
      } catch (err) {
        console.error("Failed to load schema collections:", err);
      }
    }
    loadMastersAndIncrement();
  }, [initialData]);

  const loadDetailsFromAmad = async (tempMrNo: string) => {
    if (!tempMrNo) {
      alert("Please select or enter a Temporary M.R. Number.");
      return;
    }
    try {
      const searchVal = tempMrNo.trim().toUpperCase();

      // Check if there is an associated Quality Inspection record in Inspection Section
      let matchedInsp = inspectionsList.find(ins => {
        const arrNo = String(ins.arrival_no || ins.ref_arrival_no || '').trim().toUpperCase();
        const mrNo = String(ins.mr_no || '').trim().toUpperCase();
        return arrNo === searchVal || mrNo === searchVal || mrNo.endsWith(`/${searchVal}`) || mrNo.includes(`/${searchVal}`);
      });

      if (!matchedInsp && supabase) {
        const { data: dbInsp } = await supabase
          .from('mill_inspection_master')
          .select('*')
          .or(`arrival_no.eq.${searchVal},ref_arrival_no.eq.${searchVal},mr_no.ilike.%${searchVal}%`);
        if (dbInsp && dbInsp.length > 0) {
          matchedInsp = dbInsp[0];
        }
      }

      if (matchedInsp) {
        // Automatically sync and load directly from Quality Inspection Section!
        await loadDetailsFromInspection(matchedInsp.mr_no);
        return;
      }

      let matchedAmad = temporaryArrivalList.find(a => 
        String(a.temporary_arrival_no || a.amad_no || a.arrival_no || a.amad_id || '').trim().toUpperCase() === searchVal
      );

      if (!matchedAmad && supabase) {
        const { data } = await supabase
          .from('temporary_material_received')
          .select('*')
          .or(`temporary_arrival_no.eq.${searchVal},amad_no.eq.${searchVal}`);
        if (data && data.length > 0) matchedAmad = data[0];
      }

      if (matchedAmad) {
        const matchedPo = purchaseOrders.find(po => String(po.po_no).trim().toUpperCase() === String(matchedAmad.po_no || '').trim().toUpperCase());

        setFormData(prev => ({
          ...prev,
          temporary_arrival_no: matchedAmad.temporary_arrival_no || matchedAmad.amad_no || matchedAmad.arrival_no || prev.temporary_arrival_no,
          arrival_no: matchedAmad.temporary_arrival_no || matchedAmad.amad_no || matchedAmad.arrival_no || prev.temporary_arrival_no,
          temporary_arrival_date: matchedAmad.date || matchedAmad.temporary_arrival_date || prev.temporary_arrival_date,
          po_no: matchedAmad.po_no || prev.po_no,
          po_date: matchedPo?.po_date || matchedPo?.s_date || matchedAmad.po_date || matchedAmad.date || prev.po_date,
          jci: matchedAmad.jci || prev.jci,
          supplier: (matchedAmad.supplier || matchedPo?.supplier || prev.supplier || '').toUpperCase(),
          challan_supplier: (matchedAmad.challan_supplier || matchedAmad.supplier || matchedPo?.challan_supplier || matchedPo?.supplier || prev.challan_supplier || '').toUpperCase(),
          broker: (matchedAmad.broker || matchedPo?.broker || prev.broker || '').toUpperCase(),
          date: matchedAmad.date || prev.date,
          lorry_number: matchedAmad.lorry_number || matchedAmad.lorry_no || matchedAmad.vehicle_no || prev.lorry_number,
          transporter_name: matchedAmad.transporter_name || prev.transporter_name,
          challan_rr_no: matchedAmad.challan_rr_no || matchedAmad.challan_railway_receipt_no || prev.challan_rr_no,
          challan_railway_receipt_no: matchedAmad.challan_railway_receipt_no || matchedAmad.challan_rr_no || prev.challan_railway_receipt_no,
          challan_rr_date: matchedAmad.challan_rr_date || matchedAmad.date || prev.challan_rr_date,
          pan_no: matchedAmad.pan_no || prev.pan_no,
          consignment_note: matchedAmad.consignment_note || matchedAmad.consignment_note_no || prev.consignment_note,
          consignment_note_no: matchedAmad.consignment_note || matchedAmad.consignment_note_no || prev.consignment_note_no,
          consignment_note_date: matchedAmad.consignment_note_date || prev.consignment_note_date,
          di_no: matchedAmad.di_no || prev.di_no,
          di_date: matchedAmad.di_date || prev.di_date,
          part_date: matchedAmad.di_date || prev.part_date,
          invoice_no: matchedAmad.invoice_no || prev.invoice_no,
          invoice_date: matchedAmad.invoice_date || prev.invoice_date,
          ptf: matchedAmad.ptf || prev.ptf,
          lorry_returned: matchedAmad.lorry_returned || prev.lorry_returned,
          lorry_returned_other_mill: matchedAmad.lorry_returned_other_mill || prev.lorry_returned_other_mill,
          arrival_area_code: matchedAmad.arrival_area_code || prev.arrival_area_code,
          arrival_area_name: (matchedAmad.arrival_area_name || prev.arrival_area_name || '').toUpperCase(),
          unit_code: matchedAmad.unit_code || prev.unit_code,
          unit_name: (matchedAmad.unit_name || prev.unit_name || '').toUpperCase(),
          way_bill_no: matchedAmad.way_bill_no || prev.way_bill_no,
          way_bill_date: matchedAmad.way_bill_date || prev.way_bill_date,
          apmc_fees: matchedAmad.apmc_fees || prev.apmc_fees,
          remarks: matchedAmad.remarks || prev.remarks,
          challan_material_weight: Number(matchedAmad.challan_material_weight) || Number(prev.challan_material_weight),
          actual_gross_weight: Number(matchedAmad.actual_gross_weight) || Number(prev.actual_gross_weight),
          supplier_challan_gross: Number(matchedAmad.supplier_challan_gross) || Number(prev.supplier_challan_gross),
          electronic_gross_weight: Number(matchedAmad.electronic_gross_weight) || Number(prev.electronic_gross_weight),
          actual_tare_weight: Number(matchedAmad.actual_tare_weight) || Number(prev.actual_tare_weight),
          supplier_tare_weight: Number(matchedAmad.supplier_tare_weight) || Number(prev.supplier_tare_weight),
          electronic_tare_weight: Number(matchedAmad.electronic_tare_weight) || Number(prev.electronic_tare_weight),
          supplier_net_weight: Number(matchedAmad.supplier_net_weight) || Number(prev.supplier_net_weight),
          electronic_net_weight: Number(matchedAmad.electronic_net_weight) || Number(prev.electronic_net_weight),
          weight_reduced: Number(matchedAmad.weight_reduced) || Number(prev.weight_reduced),
        }));

        const rawGrid = matchedAmad.grid_details || matchedAmad.details || matchedAmad.items;
        const amadUnit = (matchedAmad.unit_name || matchedAmad.unit || formData.unit_name || 'BALES').toUpperCase();
        if (rawGrid) {
          let parsedGrid: any[] = [];
          if (typeof rawGrid === 'string') {
            try { parsedGrid = JSON.parse(rawGrid); } catch (e) {}
          } else if (Array.isArray(rawGrid)) {
            parsedGrid = rawGrid;
          }
          if (parsedGrid && parsedGrid.length > 0) {
            setDetails(parsedGrid.map((row: any, idx: number) => {
              const rowUnit = (row.unit || amadUnit || 'BALES').toString().trim().toUpperCase();
              const isLoose = rowUnit.includes('LOOSE') || rowUnit === 'LOOSE';
              const rawNetto = Number(row.netto_pnto) || Number(row.quantity_mt) || Number(row.challan_gross_wt) || Number(row.net_weight) || Number(matchedAmad.supplier_net_weight) || 0;
              return { 
                ...row, 
                srl_no: idx + 1,
                unit: row.unit || amadUnit,
                quantity_chln: isLoose ? 0 : (row.quantity_chln !== undefined ? Number(row.quantity_chln) : Number(row.quantity) || 0),
                quantity_rcpt: isLoose ? 0 : (row.quantity_rcpt !== undefined ? Number(row.quantity_rcpt) : Number(row.quantity) || 0),
                netto_pnto: rawNetto
              };
            }));
          }
        }
      } else {
        alert(`No Temporary M.R record found matching "${tempMrNo}".`);
      }
    } catch (e) {
      console.error("Error loading Temporary M.R details:", e);
    }
  };

  const loadDetailsFromInspection = async (mrNo: string) => {
    if (!mrNo) {
      alert("Please enter or select a Material Inspection M.R. Number first.");
      return;
    }
    try {
      const mrNoUpper = mrNo.trim().toUpperCase();
      const matchedInspection = inspectionsList.find(ins => String(ins.mr_no).trim().toUpperCase() === mrNoUpper);

      if (matchedInspection) {
        let matchedDetails: any[] = [];
        let amadData: any = null;

        if (supabase) {
          const { data } = await supabase
            .from('mill_inspection_detail')
            .select('*')
            .eq('mr_no', mrNoUpper)
            .order('srl_no', { ascending: true });
          if (data) matchedDetails = data;

          if (matchedInspection.arrival_no || matchedInspection.ref_arrival_no) {
            const arrNo = (matchedInspection.arrival_no || matchedInspection.ref_arrival_no).trim();
            const { data: tDataList, error: tErr } = await supabase
              .from('temporary_material_received')
              .select('*')
              .eq('temporary_arrival_no', arrNo);

            if (tErr) console.warn("Could not fetch temporary_arrival mapping:", tErr);
            
            if (tDataList && tDataList.length > 0) {
              amadData = tDataList[0];
            }
          }
        }

        const finalPoNo = matchedInspection.po_no || amadData?.po_no || '';
        const matchedPo = purchaseOrders.find(po => String(po.po_no).trim().toUpperCase() === String(finalPoNo).trim().toUpperCase());

        setFormData(prev => ({
          ...prev,
          mr_no: matchedInspection.mr_no,
          po_no: finalPoNo || prev.po_no || '',
          po_date: matchedPo?.po_date || matchedPo?.s_date || matchedInspection.po_date || amadData?.date || amadData?.lorry_date || prev.po_date || '',
          jci: matchedInspection.jci || amadData?.jci || prev.jci || 'No',
          supplier: (matchedInspection.supplier_name || amadData?.supplier || matchedPo?.supplier || prev.supplier || '').toUpperCase(),
          challan_supplier: (matchedInspection.challan_supplier || amadData?.challan_supplier || matchedInspection.supplier_name || matchedPo?.challan_supplier || matchedPo?.supplier || prev.challan_supplier || '').toUpperCase(),
          broker: (matchedInspection.broker_name || amadData?.broker || matchedPo?.broker || prev.broker || '').toUpperCase(),
          date: matchedInspection.arrival_date || amadData?.date || prev.date,
          lorry_number: (matchedInspection as any).lorry_number || (matchedInspection as any).lorry_no || (matchedInspection as any).vehicle_no || (amadData as any)?.lorry_number || (amadData as any)?.lorry_no || (amadData as any)?.vehicle_no || prev.lorry_number,
          transporter_name: matchedInspection.transporter_name || amadData?.transporter_name || prev.transporter_name,
          challan_rr_no: matchedInspection.challan_rr_no || (matchedInspection as any).challan_railway_receipt_no || amadData?.challan_rr_no || amadData?.challan_railway_receipt_no || prev.challan_rr_no,
          challan_railway_receipt_no: (matchedInspection as any).challan_railway_receipt_no || matchedInspection.challan_rr_no || amadData?.challan_railway_receipt_no || amadData?.challan_rr_no || prev.challan_railway_receipt_no,
          challan_rr_date: matchedInspection.challan_rr_date || amadData?.lorry_date || prev.challan_rr_date,
          pan_no: matchedInspection.pan_no || amadData?.pan_no || prev.pan_no,
          consignment_note: (matchedInspection as any).consignment_note || matchedInspection.consignment_note_no || (matchedInspection as any).consignment_no || amadData?.consignment_note || amadData?.consignment_note_no || prev.consignment_note,
          consignment_note_no: (matchedInspection as any).consignment_note || matchedInspection.consignment_note_no || (matchedInspection as any).consignment_no || amadData?.consignment_note || amadData?.consignment_note_no || prev.consignment_note_no,
          consignment_note_date: (matchedInspection as any).consignment_note_date || (matchedInspection as any).consignment_date || amadData?.consignment_note_date || prev.consignment_note_date,
          di_no: matchedInspection.di_no || amadData?.di_no || prev.di_no,
          di_date: matchedInspection.di_date || amadData?.di_date || prev.di_date,
          part_date: matchedInspection.part_date || amadData?.part_date || prev.part_date,
          invoice_no: matchedInspection.invoice_no || amadData?.invoice_no || prev.invoice_no,
          invoice_date: matchedInspection.invoice_date || amadData?.invoice_date || prev.invoice_date,
          ptf: matchedInspection.ptf || amadData?.ptf || prev.ptf,
          lorry_returned: matchedInspection.lorry_returned || amadData?.lorry_returned || prev.lorry_returned,
          lorry_returned_other_mill: matchedInspection.lorry_returned_other_mill || amadData?.lorry_returned_other_mill || prev.lorry_returned_other_mill,
          arrival_area_code: matchedInspection.arrival_area_code || amadData?.arrival_area_code || prev.arrival_area_code,
          arrival_area_name: matchedInspection.arrival_area_name || amadData?.arrival_area_name || prev.arrival_area_name,
          unit_code: matchedInspection.unit_code || amadData?.unit_code || prev.unit_code,
          unit_name: matchedInspection.unit_name || amadData?.unit_name || prev.unit_name,
          way_bill_no: matchedInspection.way_bill_no || amadData?.way_bill_no || prev.way_bill_no,
          way_bill_date: matchedInspection.way_bill_date || amadData?.way_bill_date || prev.way_bill_date,
          apmc_fees: matchedInspection.apmc_fees || amadData?.apmc_fees || prev.apmc_fees,
          remarks: matchedInspection.remarks || amadData?.remarks || prev.remarks,
          temporary_arrival_no: matchedInspection.arrival_no || amadData?.temporary_arrival_no || amadData?.amad_no || prev.temporary_arrival_no,
          arrival_no: matchedInspection.arrival_no || amadData?.temporary_arrival_no || amadData?.amad_no || prev.temporary_arrival_no,
          temporary_arrival_date: matchedInspection.arrival_date || amadData?.date || prev.temporary_arrival_date,
          challan_material_weight: Number(matchedInspection.challan_material_weight) || Number(amadData?.challan_material_weight) || Number(prev.challan_material_weight),
          actual_gross_weight: Number(matchedInspection.actual_gross_weight) || Number(amadData?.actual_gross_weight) || Number(prev.actual_gross_weight),
          actual_tare_weight: Number(matchedInspection.actual_tare_weight) || Number(amadData?.actual_tare_weight) || Number(prev.actual_tare_weight),
          supplier_net_weight: Number(matchedInspection.supplier_net_weight) || Number(amadData?.supplier_net_weight) || Number(prev.supplier_net_weight),
          supplier_challan_gross: Number(matchedInspection.supplier_challan_gross) || Number(amadData?.supplier_challan_gross) || Number(prev.supplier_challan_gross),
          supplier_tare_weight: Number(matchedInspection.supplier_tare_weight) || Number(amadData?.supplier_tare_weight) || Number(prev.supplier_tare_weight),
          electronic_net_weight: Number(matchedInspection.electronic_net_weight) || Number(amadData?.electronic_net_weight) || Number(prev.electronic_net_weight),
          electronic_gross_weight: Number(matchedInspection.electronic_gross_weight) || Number(amadData?.electronic_gross_weight) || Number(prev.electronic_gross_weight),
          electronic_tare_weight: Number(matchedInspection.electronic_tare_weight) || Number(amadData?.electronic_tare_weight) || Number(prev.electronic_tare_weight),
          weight_reduced: Number(matchedInspection.weight_reduced) || Number(amadData?.weight_reduced) || Number(prev.weight_reduced)
        }));

        if (matchedDetails && matchedDetails.length > 0) {
          const newDetails = matchedDetails.map((md: any, index: number) => {
            const matchingGrade = grades.find(g => 
              String(g.grade_code).trim().toUpperCase() === String(md.stock_grade_code).trim().toUpperCase() || 
              String(g.grade_name).trim().toUpperCase() === String(md.stock_grade_code).trim().toUpperCase() ||
              String(g.grade_name).trim().toUpperCase() === String(md.arrival_grade).trim().toUpperCase()
            );
            const gradeName = matchingGrade ? matchingGrade.grade_name : (md.stock_grade_name || md.arrival_grade || '');
            const gradeCode = matchingGrade ? matchingGrade.grade_code : (md.stock_grade_code || '');

            const matchingMarka = markas.find(m => 
              String(m.marka_code).trim().toUpperCase() === String(md.marka).trim().toUpperCase() || 
              String(m.marka_name).trim().toUpperCase() === String(md.marka).trim().toUpperCase()
            );
            const markaName = matchingMarka ? matchingMarka.marka_name : (md.marka || 'NO MARK');
            const markaCode = matchingMarka ? matchingMarka.marka_code : (md.marka || '01');

            const rowUnit = (md.unit || matchedInspection.unit_name || amadData?.unit_name || formData.unit_name || 'BALES').toString().trim().toUpperCase();
            const isLoose = rowUnit.includes('LOOSE') || rowUnit === 'LOOSE';
            const rawNetto = Number(md.challan_gross_wt) || Number(md.netto_pnto) || 0;

            return {
              srl_no: index + 1,
              receipt_grade_code: gradeCode,
              receipt_grade_name: gradeName,
              crop_year: md.crop_year || '2026-27',
              challan_grade_name: gradeName,
              agency_code: '',
              agency_name: md.agency || '',
              challan_marka_code: markaCode,
              challan_marka_name: markaName,
              netto_pnto: rawNetto,
              quantity_chln: isLoose ? 0 : (Number(md.quantity) || Math.round(rawNetto)),
              quantity_rcpt: isLoose ? 0 : (Number(md.quantity) || Math.round(rawNetto)),
              unit: md.unit || rowUnit,
              remarks: '',
              marks_phota: md.marks_phota || ''
            };
          });
          setDetails(newDetails);
        }
      }
    } catch (e: any) {
      alert("Error loading inspection records: " + e.message);
    }
  };

  const loadDetailsFromPo = async (poNo: string) => {
    if (!poNo) return;
    try {
      const poNoUpper = poNo.trim().toUpperCase();
      let filteredDetails: any[] = [];

      if (supabase) {
        const [pdmRes, scpRes] = await Promise.all([
          supabase.from('purchase_detail_master').select('*').eq('po_no', poNo.trim()),
          supabase.from('sauda_check_point_details').select('*').eq('po_no', poNo.trim())
        ]);
        const pdm = pdmRes.data || [];
        const scp = scpRes.data || [];

        if (pdm.length > 0) {
          filteredDetails = pdm;
        } else if (scp.length > 0) {
          filteredDetails = scp;
        } else {
          const [pdmIns, scpIns] = await Promise.all([
            supabase.from('purchase_detail_master').select('*').ilike('po_no', poNoUpper),
            supabase.from('sauda_check_point_details').select('*').ilike('po_no', poNoUpper)
          ]);
          filteredDetails = (pdmIns.data && pdmIns.data.length > 0) ? pdmIns.data : (scpIns.data || []);
        }
      }

      if (!filteredDetails || filteredDetails.length === 0) {
        const [allPdm, allScp] = await Promise.all([
          dbModule.fetchAll('purchase_detail_master').catch(() => []),
          dbModule.fetchAll('sauda_check_point_details').catch(() => [])
        ]);
        const pdm = (allPdm || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poNoUpper);
        const scp = (allScp || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poNoUpper);
        filteredDetails = pdm.length > 0 ? pdm : scp;
      }

      if (!filteredDetails || filteredDetails.length === 0) {
        const matchedPo = purchaseOrders.find((p: any) => String(p.po_no).trim().toUpperCase() === poNoUpper);
        if (matchedPo) {
          if (Array.isArray(matchedPo.items) && matchedPo.items.length > 0) {
            filteredDetails = matchedPo.items;
          } else if (Array.isArray(matchedPo.details) && matchedPo.details.length > 0) {
            filteredDetails = matchedPo.details;
          }
        }
      }

      if (filteredDetails && filteredDetails.length > 0) {
        const newDetails: ArrivalDetailRow[] = filteredDetails.map((fd: any, index: number) => {
          const gradeName = fd.grade_name || fd.variety || fd.item_name || '';
          const gradeCode = fd.grade_code || fd.item_code || '';
          const markaName = fd.marka_name || fd.marka || '';
          const markaCode = fd.marka_code || '';
          const agencyName = fd.agency_name || fd.agency || '';
          const agencyCode = fd.agency_code || '';
          const nettoVal = Number(fd.quantity_mt || fd.quantity || fd.netto_pnto || 0);
          const rowUnit = (fd.unit || formData.unit_name || 'BALES').toString().trim().toUpperCase();
          const isLoose = rowUnit.includes('LOOSE') || rowUnit === 'LOOSE';

          return {
            srl_no: index + 1,
            receipt_grade_code: gradeCode,
            receipt_grade_name: gradeName,
            crop_year: fd.crop_year || '2026-27',
            challan_grade_name: gradeName,
            agency_code: agencyCode,
            agency_name: agencyName,
            challan_marka_code: markaCode,
            challan_marka_name: markaName,
            netto_pnto: nettoVal,
            quantity_chln: isLoose ? 0 : Math.round(nettoVal),
            quantity_rcpt: isLoose ? 0 : Math.round(nettoVal),
            unit: fd.unit || rowUnit,
            remarks: fd.remarks || ''
          };
        });
        setDetails(newDetails);
      }
    } catch (err) {
      console.warn("Error loading details from PO:", err);
    }
  };

  const handleInputChange = (field: string, val: any) => {
    setFormData(prev => {
      const next = { ...prev, [field]: val };
      if (field === 'consignment_note') {
        next.consignment_note_no = val;
      } else if (field === 'consignment_note_no') {
        next.consignment_note = val;
      } else if (field === 'challan_rr_no') {
        next.challan_railway_receipt_no = val;
      } else if (field === 'challan_railway_receipt_no') {
        next.challan_rr_no = val;
      } else if (field === 'temporary_arrival_no') {
        next.arrival_no = val;
      }

      if (field === 'unit_name') {
        const uUpper = String(val || '').trim().toUpperCase();
        const isLoose = uUpper.includes('LOOSE') || uUpper === 'LOOSE';
        setDetails(prev => prev.map(r => ({
          ...r,
          unit: uUpper,
          ...(isLoose ? { quantity_chln: 0, quantity_rcpt: 0 } : {})
        })));
      }

      if (field === 'po_no' && val) {
        const valUpper = String(val).trim().toUpperCase();
        const matched = purchaseOrders.find(po => String(po.po_no).trim().toUpperCase() === valUpper);
        if (matched) {
          next.po_date = matched.po_date || matched.s_date || matched.date || next.po_date;
          next.supplier = (matched.supplier || matched.merchant || next.supplier || '').toUpperCase();
          next.challan_supplier = (matched.challan_supplier || matched.supplier || matched.merchant || next.challan_supplier || '').toUpperCase();
          next.broker = (matched.broker || next.broker || '').toUpperCase();
          next.arrival_area_name = (matched.area || next.arrival_area_name || '').toUpperCase();
          const matchedArea = areas.find(a => String(a.area_name).trim().toUpperCase() === String(matched.area).trim().toUpperCase());
          if (matchedArea) {
            next.arrival_area_code = matchedArea.area_code;
          }
        }
        loadDetailsFromPo(valUpper);
      }
      return next;
    });
  };

  const handleSelectPoOption = (item: any) => {
    handleInputChange('po_no', item.po_no);
    if (item.supplier) handleInputChange('supplier', item.supplier);
    if (item.challan_supplier) handleInputChange('challan_supplier', item.challan_supplier);
    if (item.broker) handleInputChange('broker', item.broker);
    if (item.po_date) handleInputChange('po_date', item.po_date);
    if (item.lorry_number) handleInputChange('lorry_number', item.lorry_number);
    
    if (item.temp_mr_no) {
      handleInputChange('temporary_arrival_no', item.temp_mr_no);
      loadDetailsFromAmad(item.temp_mr_no);
    } else if (item.po_no) {
      loadDetailsFromPo(item.po_no);
    }
    setShowPoDropdown(false);
  };

  // Double direction linkages
  const handleAreaChange = (val: string) => {
    const upperVal = val.toUpperCase();
    setFormData(prev => {
      const matched = areas.find(a => String(a.area_name).toUpperCase() === upperVal || `${a.area_code} - ${a.area_name}`.toUpperCase() === upperVal);
      return {
        ...prev,
        arrival_area_name: matched ? String(matched.area_name).toUpperCase() : upperVal,
        arrival_area_code: matched ? matched.area_code : prev.arrival_area_code
      };
    });
  };

  const handleRowChange = (index: number, field: keyof ArrivalDetailRow, val: any) => {
    const updatedDetails = [...details];
    
    if (field === 'unit') {
      const uUpper = String(val || '').trim().toUpperCase();
      const isLoose = uUpper.includes('LOOSE') || uUpper === 'LOOSE';
      updatedDetails[index] = {
        ...updatedDetails[index],
        unit: uUpper,
        ...(isLoose ? { quantity_chln: 0, quantity_rcpt: 0 } : {})
      };
    } else if (field === 'receipt_grade_code') {
      const g = grades.find(g => String(g.grade_code) === String(val));
      updatedDetails[index] = {
        ...updatedDetails[index],
        receipt_grade_code: val,
        receipt_grade_name: g ? g.grade_name : updatedDetails[index].receipt_grade_name,
        challan_grade_name: g ? g.grade_name : updatedDetails[index].challan_grade_name
      };
    } else {
      updatedDetails[index] = {
        ...updatedDetails[index],
        [field]: val
      };
    }
    
    setDetails(updatedDetails);
  };

  const handleSave = async () => {
    if (initialData && !enforceEditOrDeletePermission("Edit")) {
      return;
    }
    if (!formData.arrival_no) {
      alert("Arrival No. is mandatory.");
      return;
    }

    setLoading(true);
    try {
      const activeRows = details.filter(d => 
        d.receipt_grade_name || d.receipt_grade_code || d.challan_grade_name || Number(d.netto_pnto) > 0 || Number(d.quantity_chln) > 0 || Number(d.quantity_rcpt) > 0
      );

      const totalPacketsSum = activeRows.reduce((acc, curr) => {
        const u = (curr.unit || formData.unit_name || '').toString().trim().toUpperCase();
        const isLoose = u.includes('LOOSE') || u === 'LOOSE';
        if (isLoose) return acc;
        return acc + (Number(curr.quantity_rcpt) || Number(curr.quantity_chln) || 0);
      }, 0);
      const totalWeightSum = activeRows.reduce((acc, curr) => acc + (Number(curr.netto_pnto) || 0), 0);

      const isHeaderLoose = (formData.unit_name || '').toString().trim().toUpperCase().includes('LOOSE');
      const payload = {
        financial_year: formData.financial_year,
        final_arrival_no: formData.arrival_no,
        arrival_no: formData.arrival_no,
        final_arrival_date: sanitizeDate(formData.date),
        arrival_date: sanitizeDate(formData.date),
        mr_no: formData.mr_no || null,
        po_no: formData.po_no || null,
        po_date: sanitizeDate(formData.po_date),
        date: sanitizeDate(formData.date),
        jci: formData.jci || 'No',
        jci_no: formData.jci || 'No',
        challan_supplier: formData.challan_supplier,
        supplier: formData.supplier,
        broker: formData.broker,
        transporter_name: formData.transporter_name,
        challan_rr_no: formData.challan_rr_no || formData.challan_railway_receipt_no || '',
        challan_railway_receipt_no: formData.challan_railway_receipt_no || formData.challan_rr_no || '',
        challan_rr_date: sanitizeDate(formData.challan_rr_date),
        lorry_number: formData.lorry_number,
        lorry_no: formData.lorry_number,
        pan_no: formData.pan_no || formData.part_no || '',
        part_no: formData.part_no || formData.pan_no || '',
        part_date: sanitizeDate(formData.part_date),
        consignment_note: formData.consignment_note || formData.consignment_note_no || '',
        consignment_note_no: formData.consignment_note || formData.consignment_note_no || '',
        consignment_note_date: sanitizeDate(formData.consignment_note_date),
        di_no: formData.di_no,
        di_date: sanitizeDate(formData.di_date),
        invoice_no: formData.invoice_no,
        invoice_date: sanitizeDate(formData.invoice_date),
        ptf: formData.ptf || 'No',
        rfs: formData.ptf || 'No',
        lorry_returned: formData.lorry_returned || 'No',
        lorry_returned_other_mill: formData.lorry_returned_other_mill || 'No',
        arrival_area_code: formData.arrival_area_code,
        arrival_area_name: formData.arrival_area_name,
        area: formData.arrival_area_name,
        unit_code: formData.unit_code,
        unit_name: formData.unit_name,
        way_bill_no: formData.way_bill_no,
        way_bill_date: sanitizeDate(formData.way_bill_date),
        rr_gr_no: formData.rr_gr_no || '',
        apmc_fees: formData.apmc_fees || 0,
        remarks: formData.remarks,
        temporary_arrival_no: formData.temporary_arrival_no,
        temporary_arrival_date: sanitizeDate(formData.temporary_arrival_date),
        total_packets: isHeaderLoose ? 0 : totalPacketsSum,
        weight_qtl: totalWeightSum * 10,
        grid_details: activeRows.map(row => {
          const u = (row.unit || formData.unit_name || '').toString().trim().toUpperCase();
          const isLoose = u.includes('LOOSE') || u === 'LOOSE' || isHeaderLoose;
          return {
            ...row,
            unit: row.unit || formData.unit_name || 'BALES',
            quantity_chln: isLoose ? 0 : Math.round(Number(row.quantity_chln) || 0),
            quantity_rcpt: isLoose ? 0 : Math.round(Number(row.quantity_rcpt) || 0)
          };
        }),

        // Weighments
        challan_material_weight: formData.challan_material_weight || 0,
        actual_gross_weight: formData.actual_gross_weight || 0,
        actual_tare_weight: formData.actual_tare_weight || 0,
        supplier_net_weight: formData.supplier_net_weight || 0,
        supplier_challan_gross: formData.supplier_challan_gross || 0,
        supplier_tare_weight: formData.supplier_tare_weight || 0,
        electronic_net_weight: formData.electronic_net_weight || 0,
        electronic_gross_weight: formData.electronic_gross_weight || 0,
        electronic_tare_weight: formData.electronic_tare_weight || 0,
        weight_reduced: Number(finalWeightDisplayValue) || Number(formData.weight_reduced) || 0
      };

      try {
        if (initialData && initialData.final_arrival_id) {
          await dbModule.update('final_arrival', 'final_arrival_id', initialData.final_arrival_id, payload);
          alert(`Final Arrival Voucher #${formData.arrival_no} updated successfully!`);
        } else {
          await dbModule.insert('final_arrival', payload);
          alert(`Final Arrival Register Saved successfully!\nAdded under Final Arrival Voucher #${formData.arrival_no}`);
        }
      } catch (saveErr: any) {
        if (saveErr?.message?.includes('lorry_number') || saveErr?.message?.includes('schema cache')) {
          try {
            await supabase?.rpc("exec_sql", { 
              query: `
                ALTER TABLE IF EXISTS final_arrival ADD COLUMN IF NOT EXISTS lorry_number TEXT;
                NOTIFY pgrst, 'reload schema';
              ` 
            });
            if (initialData && initialData.final_arrival_id) {
              await dbModule.update('final_arrival', 'final_arrival_id', initialData.final_arrival_id, payload);
              alert(`Final Arrival Voucher #${formData.arrival_no} updated successfully!`);
            } else {
              await dbModule.insert('final_arrival', payload);
              alert(`Final Arrival Register Saved successfully!\nAdded under Final Arrival Voucher #${formData.arrival_no}`);
            }
          } catch (retryErr: any) {
            // Fallback: strip lorry_number if column is absent in legacy DB schema cache
            const { lorry_number, ...fallbackPayload } = payload as any;
            if (initialData && initialData.final_arrival_id) {
              await dbModule.update('final_arrival', 'final_arrival_id', initialData.final_arrival_id, fallbackPayload);
              alert(`Final Arrival Voucher #${formData.arrival_no} updated successfully!`);
            } else {
              await dbModule.insert('final_arrival', fallbackPayload);
              alert(`Final Arrival Register Saved successfully!\nAdded under Final Arrival Voucher #${formData.arrival_no}`);
            }
          }
        } else {
          throw saveErr;
        }
      }

      // Synchronize unit with material_inspection_details and mill_inspection_detail in Supabase
      if (supabase && formData.unit_name) {
        const u = formData.unit_name.toUpperCase();
        const keys = [formData.arrival_no, formData.mr_no, formData.temporary_arrival_no, formData.po_no].filter(Boolean);
        for (const k of keys) {
          Promise.all([
            supabase.from('material_inspection_details').update({ unit: u }).eq('mr_no', k),
            supabase.from('material_inspection').update({ unit_name: u }).eq('mr_no', k)
          ]).catch(() => {});
        }
      }

      if (onSave) onSave(payload);
    } catch (e: any) {
      alert("Failed to save final arrival voucher: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const totalReceiptQuantity = details.reduce((acc, curr) => {
    const u = (curr.unit || formData.unit_name || '').toString().trim().toUpperCase();
    const isLoose = u.includes('LOOSE') || u === 'LOOSE';
    return acc + (isLoose ? 0 : (Number(curr.quantity_rcpt) || 0));
  }, 0);

  const totalChallanQuantity = details.reduce((acc, curr) => {
    const u = (curr.unit || formData.unit_name || '').toString().trim().toUpperCase();
    const isLoose = u.includes('LOOSE') || u === 'LOOSE';
    return acc + (isLoose ? 0 : (Number(curr.quantity_chln) || 0));
  }, 0);
  const totalNettoWeight = details.reduce((acc, curr) => acc + (Number(curr.netto_pnto) || 0), 0);

  const calculatedLowestNetWeight = useMemo(() => {
    const elecNet = (Number(formData.electronic_gross_weight) || Number(formData.actual_gross_weight) || 0) - (Number(formData.electronic_tare_weight) || Number(formData.actual_tare_weight) || 0);
    const suppNet = (Number(formData.supplier_challan_gross) || 0) - (Number(formData.supplier_tare_weight) || 0);
    const nets = [
      Number(formData.electronic_net_weight),
      elecNet > 0 ? elecNet : 0,
      Number(formData.supplier_net_weight),
      suppNet > 0 ? suppNet : 0,
      Number(formData.challan_material_weight),
      Number(formData.weight_reduced)
    ].filter(v => typeof v === 'number' && !isNaN(v) && v > 0);
    return nets.length > 0 ? Math.min(...nets) : '';
  }, [
    formData.electronic_net_weight,
    formData.electronic_gross_weight,
    formData.electronic_tare_weight,
    formData.actual_gross_weight,
    formData.actual_tare_weight,
    formData.supplier_net_weight,
    formData.supplier_challan_gross,
    formData.supplier_tare_weight,
    formData.challan_material_weight,
    formData.weight_reduced
  ]);

  const finalWeightDisplayValue = (formData.weight_reduced !== undefined && formData.weight_reduced !== null && formData.weight_reduced !== 0 && formData.weight_reduced !== '')
    ? formData.weight_reduced
    : calculatedLowestNetWeight;

  // Auto-calculate NETTO (M.T) for rows where UNIT is BALES (not LOOSE): (RCPT / Total RCPT) * Final Weight (M.TON)
  useEffect(() => {
    const finalWeight = Number(finalWeightDisplayValue) || 0;

    const isBalesRow = (row: ArrivalDetailRow) => {
      const u = (row.unit || formData.unit_name || 'BALES').toString().trim().toUpperCase();
      return u.includes('BALE') || u === 'BALES' || (!u.includes('LOOSE') && u !== 'LOOSE');
    };

    const getRowRcpt = (r: ArrivalDetailRow) => {
      const u = (r.unit || formData.unit_name || 'BALES').toString().trim().toUpperCase();
      if (u.includes('LOOSE') || u === 'LOOSE') return 0;
      return Number(r.quantity_rcpt) || Number(r.quantity_chln) || 0;
    };

    const balesIndices = details
      .map((r, i) => (isBalesRow(r) && getRowRcpt(r) > 0 ? i : -1))
      .filter(i => i !== -1);

    const sumRcpt = balesIndices.reduce((sum, idx) => sum + getRowRcpt(details[idx]), 0);

    let needsUpdate = false;
    let allocatedNetto = 0;

    const updated = details.map((row, index) => {
      const u = (row.unit || formData.unit_name || 'BALES').toString().trim().toUpperCase();
      const isLoose = u.includes('LOOSE') || u === 'LOOSE';

      if (isLoose) {
        if (row.quantity_chln !== 0 || row.quantity_rcpt !== 0) {
          needsUpdate = true;
          return { ...row, quantity_chln: 0, quantity_rcpt: 0 };
        }
        return row;
      }

      if (!isBalesRow(row)) return row;

      const rcpt = getRowRcpt(row);
      if (rcpt <= 0 || sumRcpt <= 0 || finalWeight <= 0) {
        if (Number(row.netto_pnto) !== 0) {
          needsUpdate = true;
          return { ...row, netto_pnto: 0 };
        }
        return row;
      }

      const isLastBalesRow = index === balesIndices[balesIndices.length - 1];
      let calculatedNetto = 0;
      if (isLastBalesRow) {
        calculatedNetto = Number((finalWeight - allocatedNetto).toFixed(3));
        calculatedNetto = Math.max(0, calculatedNetto);
      } else {
        calculatedNetto = Number(((rcpt / sumRcpt) * finalWeight).toFixed(3));
        allocatedNetto += calculatedNetto;
      }

      if (Number(row.netto_pnto) !== calculatedNetto) {
        needsUpdate = true;
        return { ...row, netto_pnto: calculatedNetto };
      }
      return row;
    });

    if (needsUpdate) {
      setDetails(updated);
    }
  }, [finalWeightDisplayValue, formData.unit_name, details]);

  const resetFormToBlank = () => {
    let nextNum = 502;
    setFormData({
      financial_year: '2026-2027',
      arrival_no: `FA-${nextNum}`,
      mr_no: '',
      po_no: '',
      po_date: today,
      date: today,
      jci: 'No',
      jci_no: 'No',
      part_no: '',
      rfs: '',
      area: '',
      rr_gr_no: '',
      challan_supplier: '',
      supplier: '',
      broker: '',
      transporter_name: '',
      challan_rr_no: '',
      challan_railway_receipt_no: '',
      challan_rr_date: today,
      lorry_number: '',
      pan_no: '',
      consignment_note: '',
      consignment_note_no: '',
      consignment_note_date: today,
      di_no: '',
      di_date: today,
      part_date: today,
      invoice_no: '',
      invoice_date: today,
      ptf: 'No',
      lorry_returned: 'No',
      lorry_returned_other_mill: 'No',
      arrival_area_code: '',
      arrival_area_name: '',
      unit_code: 'I',
      unit_name: 'BALES',
      way_bill_no: '',
      way_bill_date: today,
      apmc_fees: 0,
      remarks: '',
      temporary_arrival_no: '',
      temporary_arrival_date: today,
      challan_material_weight: 0,
      actual_gross_weight: 0,
      actual_tare_weight: 0,
      supplier_net_weight: 0,
      supplier_challan_gross: 0,
      supplier_tare_weight: 0,
      electronic_net_weight: 0,
      electronic_gross_weight: 0,
      electronic_tare_weight: 0,
      weight_reduced: 0
    } as any);
    setDetails(getPaddedDetails(null));
  };

  return (
    <LegacyLayout title="FINAL ARRIVAL" subtitle="MATERIAL RECEIVED WORKSTATION" onClose={onCancel} activeNavTab="final_mr">
      <div className="bg-[#F9F5EC] text-slate-800 font-sans flex flex-col p-2 md:p-3 space-y-4 max-w-[1700px] w-full mx-auto select-text selection:bg-[#103A20] selection:text-white">
        
        {/* 1. HERO BANNER HEADER - DEEP GREEN THEME */}
        <div className="bg-gradient-to-r from-[#174C2C] to-[#103A20] rounded-xl border border-[#0d301b] p-3.5 text-white shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#103A20] text-amber-300 flex items-center justify-center border border-[#235E39] shrink-0 shadow-xs">
              <ClipboardCheck className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-white tracking-wide flex items-center gap-2">
                Final Arrival
              </h2>
              <p className="text-[11px] text-emerald-200/90 font-medium mt-0.5">
                Enter final M.R details and receipt grid items
              </p>
            </div>
          </div>
          {/* Action Controls & Session Badge */}
          <div className="relative z-10 flex items-center gap-3">
            <button
              type="button"
              className="px-3.5 py-1.5 bg-[#103A20] hover:bg-[#1C5130] text-amber-300 border border-[#235E39] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
              title="Back to Sauda Desk (Esc)"
              onClick={onCancel}
            >
              <ArrowLeft className="h-4 w-4 text-amber-300" />
              <span>Back</span>
            </button>
            <div className="bg-[#103A20] border border-[#235E39] px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-2 shadow-2xs">
              <span className="text-emerald-200/80 font-medium">Session:</span>
              <span className="font-bold text-amber-300 font-mono text-xs">{ 'BJCL/2026-2027/'}</span>
            </div>
          </div>
        </div>

        {/* 2. MASTER FORM FIELDS CARD */}
        <div className="bg-white rounded-xl border border-[#E6DDC8] shadow-xs p-4 space-y-3.5 text-xs text-slate-800">
          
          {/* ROW 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
            {/* Temporary M.R No */}
            <div className="lg:col-span-1">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Temporary M.R No</label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={formData.temporary_arrival_no || 'MR'}
                  onChange={(e) => handleInputChange('temporary_arrival_no', e.target.value)}
                  onBlur={() => {
                    if (formData.temporary_arrival_no) loadDetailsFromAmad(formData.temporary_arrival_no);
                  }}
                  placeholder="Enter Temporary M.R No"
                  className={cn(
                    "w-full h-8 rounded px-2 outline-none text-xs font-mono focus:ring-1 focus:ring-sky-600 transition-colors",
                    formData.temporary_arrival_no 
                      ? "bg-sky-100 border-2 border-sky-400 text-sky-950 font-bold shadow-xs" 
                      : "bg-white border border-slate-300 font-semibold"
                  )}
                />
                <button
                  type="button"
                  onClick={() => loadDetailsFromAmad(formData.temporary_arrival_no)}
                  className="bg-[#103A20] hover:bg-[#1c5932] text-white px-2.5 h-8 rounded text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  Pick
                </button>
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Temporary Date <span className="text-rose-600 font-black">*</span></label>
              <input
                type="date"
                value={formData.temporary_arrival_date || ''}
                onChange={(e) => handleInputChange('temporary_arrival_date', e.target.value)}
                className={cn(
                  "w-full h-8 rounded px-2 outline-none text-xs transition-colors",
                  formData.temporary_arrival_date 
                    ? "bg-sky-100 border-2 border-sky-400 text-sky-950 font-bold shadow-xs" 
                    : "bg-white border border-slate-300 text-slate-800"
                )}
              />
            </div>

            {/* Arrival No */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Arrival No</label>
              <input
                type="text"
                value={formData.arrival_no || ''}
                onChange={(e) => handleInputChange('arrival_no', e.target.value)}
                className="w-full h-8 bg-red-50/30 border border-red-500 rounded px-2 outline-none text-xs font-mono font-bold text-red-600 focus:border-red-700"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Arrival Date</label>
              <input
                type="date"
                value={formData.date || ''}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs text-slate-800 focus:border-[#103A20]"
              />
            </div>

            {/* MR / P.O No. */}
            <div className="relative">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">MR / P.O No.</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.po_no || ''}
                  onChange={(e) => handleInputChange('po_no', e.target.value)}
                  onFocus={() => setShowPoDropdown(true)}
                  onBlur={() => setTimeout(() => setShowPoDropdown(false), 200)}
                  placeholder="-- SELECT MR / P.O --"
                  className={cn(
                    "w-full h-8 rounded px-2 outline-none text-xs font-mono uppercase pr-6 transition-colors",
                    formData.po_no 
                      ? "bg-sky-100 border-2 border-sky-400 text-sky-950 font-bold shadow-xs" 
                      : "bg-white border border-slate-300"
                  )}
                />
                <div
                  className="absolute right-1 top-0 bottom-0 w-6 flex items-center justify-center cursor-pointer text-slate-500"
                  onMouseDown={(e) => { e.preventDefault(); setShowPoDropdown(!showPoDropdown); }}
                >
                  <ChevronDown size={14} />
                </div>
                {showPoDropdown && combinedPoOptions.length > 0 && (
                  <div className="absolute top-9 left-0 w-[420px] bg-white border border-slate-300 rounded-lg max-h-60 overflow-y-auto z-[9999] shadow-xl">
                    {combinedPoOptions
                      .filter(opt => 
                        !formData.po_no || 
                        opt.po_no.toLowerCase().includes(formData.po_no.toLowerCase()) || 
                        opt.temp_mr_no.toLowerCase().includes(formData.po_no.toLowerCase()) ||
                        opt.display_label.toLowerCase().includes(formData.po_no.toLowerCase())
                      )
                      .map((opt, idx) => (
                        <div
                          key={opt.id || idx}
                          className="px-3 py-2 text-xs font-mono cursor-pointer hover:bg-emerald-50 border-b border-slate-100 last:border-b-0 flex flex-col gap-0.5"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectPoOption(opt);
                          }}
                        >
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <span className="flex items-center gap-1.5">
                              <span>{opt.po_no}</span>
                              {opt.temp_mr_no && opt.temp_mr_no !== opt.po_no && (
                                <span className="text-emerald-700 font-semibold text-[11px] bg-emerald-50 px-1 rounded">
                                  Temp MR #{opt.temp_mr_no}
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-emerald-800 bg-emerald-100/70 px-1.5 py-0.5 rounded font-sans font-medium">
                              {opt.source === 'temporary_material_received' ? 'Temp Arrival' : 'PO Master'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-600 font-sans">
                            <span className="truncate max-w-[280px]">
                              {opt.supplier || 'No Supplier'} {opt.lorry_number ? `• Lorry: ${opt.lorry_number}` : ''}
                            </span>
                            <span className="text-slate-500 font-mono text-[10px]">{opt.po_date}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">P.O Date</label>
              <input
                type="date"
                value={formData.po_date || ''}
                onChange={(e) => handleInputChange('po_date', e.target.value)}
                className={cn(
                  "w-full h-8 rounded px-2 outline-none text-xs transition-colors",
                  formData.po_date 
                    ? "bg-sky-100 border-2 border-sky-400 text-sky-950 font-bold shadow-xs" 
                    : "bg-white border border-slate-300 text-slate-800"
                )}
              />
            </div>

            {/* J.C.I No */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">J.C.I No</label>
              <select
                value={formData.jci || 'No'}
                onChange={(e) => handleInputChange('jci', e.target.value)}
                className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs text-slate-800 focus:border-[#103A20]"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
          </div>

          {/* ROW 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Challan Supplier</label>
              <input
                type="text"
                list="suppliers_dl"
                value={formData.challan_supplier || ''}
                onChange={(e) => handleInputChange('challan_supplier', e.target.value.toUpperCase())}
                placeholder="Enter Challan Supplier"
                className={cn(
                  "w-full h-8 rounded px-2 outline-none text-xs transition-colors",
                  formData.challan_supplier 
                    ? "bg-sky-100 border-2 border-sky-400 text-sky-950 font-bold shadow-xs" 
                    : "bg-white border border-slate-300"
                )}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Supplier</label>
              <input
                type="text"
                list="suppliers_dl"
                value={formData.supplier || ''}
                onChange={(e) => handleInputChange('supplier', e.target.value.toUpperCase())}
                placeholder="Enter Supplier"
                className={cn(
                  "w-full h-8 rounded px-2 outline-none text-xs transition-colors",
                  formData.supplier 
                    ? "bg-sky-100 border-2 border-sky-400 text-sky-950 font-bold shadow-xs" 
                    : "bg-white border border-slate-300"
                )}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Lorry No.</label>
              <input
                type="text"
                value={formData.lorry_number.toUpperCase() || ''}
                onChange={(e) => handleInputChange('lorry_number', e.target.value.toUpperCase())}
                placeholder="WB-12K-9901"
                className={cn(
                  "w-full h-8 rounded px-2 outline-none text-xs font-mono transition-colors",
                  formData.lorry_number 
                    ? "bg-sky-100 border-2 border-sky-400 text-sky-950 font-bold shadow-xs" 
                    : "bg-white border border-slate-300"
                )}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Part No</label>
              <input
                type="text"
                value={formData.pan_no || ''}
                onChange={(e) => handleInputChange('pan_no', e.target.value.toUpperCase())}
                placeholder="Enter Part No"
                /* className={cn(
                  "w-full h-8 rounded px-2 outline-none text-xs transition-colors",
                  formData.pan_no 
                    ? "bg-sky-100 border-2 border-sky-400 text-sky-950 font-bold shadow-xs" 
                    : "bg-white border border-slate-300"
                )} */
                readOnly={formData.jci === 'No'}
                className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Part Date</label>
              <input
                type="date"
                value={formData.part_date || ''}
                onChange={(e) => handleInputChange('part_date', e.target.value)}
                readOnly={formData.jci === 'No'}
                className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
                //className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs focus:border-[#103A20]"
              />
            </div>
          </div>

          {/* ROW 3 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Broker</label>
              <input
                type="text"
                list="brokers_dl"
                value={formData.broker || ''}
                onChange={(e) => handleInputChange('broker', e.target.value.toUpperCase())}
                placeholder="Enter Broker"
                className={cn(
                  "w-full h-8 rounded px-2 outline-none text-xs transition-colors",
                  formData.broker 
                    ? "bg-sky-100 border-2 border-sky-400 text-sky-950 font-bold shadow-xs" 
                    : "bg-white border border-slate-300"
                )}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Transporter Name</label>
              <input
                type="text"
                value={formData.transporter_name || ''}
                onChange={(e) => handleInputChange('transporter_name', e.target.value)}
                placeholder="Enter Transporter Name"
                className={cn(
                  "w-full h-8 rounded px-2 outline-none text-xs transition-colors",
                  formData.transporter_name 
                    ? "bg-sky-100 border-2 border-sky-400 text-sky-950 font-bold shadow-xs" 
                    : "bg-white border border-slate-300"
                )}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">D.I. No.</label>
              <input
                type="text"
                value={formData.di_no || ''}
                onChange={(e) => handleInputChange('di_no', e.target.value)}
                placeholder="Enter D.I. No."
                readOnly={formData.jci === 'No'}
                className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
                //className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs focus:border-[#103A20]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">D.I. Date</label>
              <input
                type="date"
                value={formData.di_date || ''}
                onChange={(e) => handleInputChange('di_date', e.target.value)}
                readOnly={formData.jci === 'No'}
                className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
                //className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs focus:border-[#103A20]"
              />
            </div>
          </div>

          {/* ROW 4 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div className="md:col-span-2 grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Challan / Receipt No.</label>
                <input
                  type="text"
                  value={formData.challan_rr_no || ''}
                  onChange={(e) => handleInputChange('challan_rr_no', e.target.value)}
                  placeholder="Challan / Receipt No "
                  className={cn(
                    "w-full h-8 rounded px-2 outline-none text-xs transition-colors",
                    formData.challan_rr_no 
                      ? "bg-sky-100 border-2 border-sky-400 text-sky-950 font-bold shadow-xs" 
                      : "bg-white border border-slate-300"
                  )}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.challan_rr_date || ''}
                  onChange={(e) => handleInputChange('challan_rr_date', e.target.value)}
                  className={cn(
                    "w-full h-8 rounded px-2 outline-none text-xs transition-colors",
                    formData.challan_rr_date 
                      ? "bg-sky-100 border-2 border-sky-400 text-sky-950 font-bold shadow-xs" 
                      : "bg-white border border-slate-300"
                  )}
                />
              </div>
            </div>

            <div className="md:col-span-3 grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Invoice No.</label>
                <input
                  type="text"
                  value={formData.invoice_no || ''}
                  onChange={(e) => handleInputChange('invoice_no', e.target.value)}
                  placeholder="Enter Invoice No."
                  readOnly={formData.jci === 'No'}
                  className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
                  //className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs focus:border-[#103A20]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={formData.invoice_date || ''}
                  onChange={(e) => handleInputChange('invoice_date', e.target.value)}
                  readOnly={formData.jci === 'No'}
                  className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
                  //className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs focus:border-[#103A20]"
                />
              </div>
            </div>
          </div>

          {/* ROW 5 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div className="md:col-span-2 grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Consignment Note</label>
                <input
                  type="text"
                  value={formData.consignment_note || formData.consignment_note_no || ''}
                  onChange={(e) => handleInputChange('consignment_note', e.target.value)}
                  placeholder="Enter Consignment Note"
                  readOnly={formData.jci === 'No'}
                  className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
                  //className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs focus:border-[#103A20]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.consignment_note_date || ''}
                  onChange={(e) => handleInputChange('consignment_note_date', e.target.value)}
                  readOnly={formData.jci === 'No'}
                  className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
                  //className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs focus:border-[#103A20]"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Arrival Area</label>
              <input
                type="text"
                list="areas_dl"
                value={formData.arrival_area_name || ''}
                onChange={(e) => handleAreaChange(e.target.value)}
                placeholder="Search / Choose Transit Area"
                className={cn(
                  "w-full h-8 rounded px-2 outline-none text-xs transition-colors",
                  formData.arrival_area_name 
                    ? "bg-sky-100 border-2 border-sky-400 text-sky-950 font-bold shadow-xs" 
                    : "bg-white border border-slate-300"
                )}
              />
            </div>
          </div>

          {/* ROW 6 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">R.F.S</label>
              <select
                value={formData.ptf || 'No'}
                onChange={(e) => handleInputChange('ptf', e.target.value)}
                className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs focus:border-[#103A20]"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">Lorry Returned</label>
              <select
                value={formData.lorry_returned || 'No'}
                onChange={(e) => handleInputChange('lorry_returned', e.target.value)}
                className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs focus:border-[#103A20]"
              >
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>

            <div className="md:col-span-2 grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Way Bill No.</label>
                <input
                  type="text"
                  value={formData.way_bill_no || ''}
                  onChange={(e) => handleInputChange('way_bill_no', e.target.value)}
                  placeholder="Enter Way Bill No."
                  //className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs focus:border-[#103A20]"
                  readOnly={formData.jci === 'No'}
                  className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1"> Way Bill Date</label>
                <input
                  type="date"
                  value={formData.way_bill_date || ''}
                  onChange={(e) => handleInputChange('way_bill_date', e.target.value)}
                  //className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs focus:border-[#103A20]"
                  readOnly={formData.jci === 'No'}
                  className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}

                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">R.R / G.R No.</label>
              <input
                type="text"
                value={formData.rr_gr_no || ''}
                onChange={(e) => handleInputChange('rr_gr_no', e.target.value)}
                placeholder="Enter R.R / G.R No."
                readOnly={formData.jci === 'No'}
                className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
                //className="w-full h-8 bg-white border border-slate-300 rounded px-2 outline-none text-xs focus:border-[#103A20]"
              />
            </div>
          </div>

        </div>

        {/* 3. FINAL MR RECEIPT GRID ITEMS CARD */}
        <div className="bg-white rounded-xl border border-[#E6DDC8] shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-800" />
              <h3 className="font-bold text-slate-800 text-sm">Final MR Receipt Grid Items</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="bg-[#103A20] hover:bg-[#1c5932] text-white px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
              >
                + Spawn Row
              </button>
              <button
                type="button"
                onClick={handleDeleteRow}
                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
              >
                - Delete Row
              </button>
            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[1000px] text-xs">
              <thead className="bg-[#103A20] text-white text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-2 text-center w-12">SRL NO</th>
                  <th className="p-2 text-center" colSpan={2}>RECEIPT GRADE</th>
                  <th className="p-2 text-center w-24">CROP YEAR</th>
                  <th className="p-2 text-center">CHALLAN GRADE</th>
                  <th className="p-2 text-center" colSpan={2}>AGENCY</th>
                  <th className="p-2 text-center" colSpan={2}>CHALLAN MARKA</th>
                  <th className="p-2 text-center">MARKS (PHOTA)</th>
                  <th className="p-2 text-center w-24">NETTO (M.T)</th>
                  <th className="p-2 text-center" colSpan={3}>QUANTITY</th>
                  <th className="p-2 text-center">REMARKS</th>
                  <th className="p-2 text-center w-10"></th>
                </tr>
                <tr className="bg-[#174C2C] text-[9px]">
                  <th className="p-1"></th>
                  <th className="p-1 text-center w-16">CODE</th>
                  <th className="p-1 text-left">NAME</th>
                  <th className="p-1"></th>
                  <th className="p-1 text-left">NAME</th>
                  <th className="p-1 text-center w-16">CODE</th>
                  <th className="p-1 text-left">NAME</th>
                  <th className="p-1 text-center w-16">CODE</th>
                  <th className="p-1 text-left">NAME</th>
                  <th className="p-1"></th>
                  <th className="p-1"></th>
                  <th className="p-1 text-right w-16">CHLN.</th>
                  <th className="p-1 text-right w-16">RCPT.</th>
                  <th className="p-1 text-center w-20">UNIT</th>
                  <th className="p-1"></th>
                  <th className="p-1"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {details.map((row, index) => (
                  <tr key={index} className="hover:bg-slate-50 transition-colors">
                    <td className="p-1.5 text-center font-bold text-slate-600 bg-slate-50">{row.srl_no}</td>
                    <td className="p-1.5">
                      <select
                        value={row.receipt_grade_code}
                        onChange={(e) => handleRowChange(index, 'receipt_grade_code', e.target.value)}
                        className="w-full h-7 bg-white border border-slate-300 rounded px-1 text-xs outline-none"
                      >
                        <option value="">--</option>
                        {grades.map(g => (
                          <option key={g.grade_code} value={g.grade_code}>{g.grade_code}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1.5">
                      <input
                        type="text"
                        list="grades_dl"
                        value={row.receipt_grade_name}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          const matched = grades.find(g => String(g.grade_name).toUpperCase() === val);
                          setDetails(prev => {
                            const next = [...prev];
                            next[index] = {
                              ...next[index],
                              receipt_grade_name: val,
                              receipt_grade_code: matched ? matched.grade_code : next[index].receipt_grade_code,
                              challan_grade_name: matched ? matched.grade_name : next[index].challan_grade_name
                            };
                            return next;
                          });
                        }}
                        placeholder="Enter Name"
                        className="w-full h-7 bg-white border border-slate-300 rounded px-1.5 text-xs outline-none uppercase"
                      />
                    </td>
                    <td className="p-1.5 w-24">
                      <select
                        value={row.crop_year || '2026-27'}
                        onChange={(e) => handleRowChange(index, 'crop_year', e.target.value)}
                        className="w-full h-7 bg-white border border-slate-300 rounded px-1 text-xs text-center font-bold outline-none"
                      >
                        {row.crop_year && !['2024-25', '2025-26', '2026-27', '2027-28', '2028-29'].includes(row.crop_year) && (
                          <option value={row.crop_year}>{row.crop_year}</option>
                        )}
                        <option value="2024-25">2024-25</option>
                        <option value="2025-26">2025-26</option>
                        <option value="2026-27">2026-27</option>
                        <option value="2027-28">2027-28</option>
                        <option value="2028-29">2028-29</option>
                      </select>
                    </td>
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={row.challan_grade_name}
                        onChange={(e) => handleRowChange(index, 'challan_grade_name', e.target.value.toUpperCase())}
                        placeholder="Enter Grade Name"
                        className="w-full h-7 bg-white border border-slate-300 rounded px-1.5 text-xs outline-none uppercase"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={row.agency_code || ''}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          const matched = agencies.find(a => String(a.agency_code).toUpperCase() === val);
                          setDetails(prev => {
                            const next = [...prev];
                            next[index] = {
                              ...next[index],
                              agency_code: val,
                              agency_name: matched ? String(matched.agency_name).toUpperCase() : next[index].agency_name
                            };
                            return next;
                          });
                        }}
                        placeholder="Enter Code"
                        className="w-full h-7 bg-white border border-slate-300 rounded px-1 text-xs text-center outline-none uppercase"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="text"
                        list="agencies_dl"
                        value={row.agency_name || ''}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          const matched = agencies.find(a => String(a.agency_name).toUpperCase() === val);
                          setDetails(prev => {
                            const next = [...prev];
                            next[index] = {
                              ...next[index],
                              agency_name: val,
                              agency_code: matched ? String(matched.agency_code).toUpperCase() : next[index].agency_code
                            };
                            return next;
                          });
                        }}
                        placeholder="Enter Name"
                        className="w-full h-7 bg-white border border-slate-300 rounded px-1.5 text-xs outline-none uppercase"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={row.challan_marka_code || ''}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          const matched = markas.find(m => String(m.marka_code).toUpperCase() === val);
                          setDetails(prev => {
                            const next = [...prev];
                            next[index] = {
                              ...next[index],
                              challan_marka_code: val,
                              challan_marka_name: matched ? String(matched.marka_name).toUpperCase() : next[index].challan_marka_name
                            };
                            return next;
                          });
                        }}
                        placeholder="Enter Code"
                        className="w-full h-7 bg-white border border-slate-300 rounded px-1 text-xs text-center outline-none uppercase"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="text"
                        list="markas_dl"
                        value={row.challan_marka_name || ''}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          const matched = markas.find(m => String(m.marka_name).toUpperCase() === val);
                          setDetails(prev => {
                            const next = [...prev];
                            next[index] = {
                              ...next[index],
                              challan_marka_name: val,
                              challan_marka_code: matched ? String(matched.marka_code).toUpperCase() : next[index].challan_marka_code
                            };
                            return next;
                          });
                        }}
                        placeholder="Enter Name"
                        className="w-full h-7 bg-white border border-slate-300 rounded px-1.5 text-xs outline-none uppercase"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={row.marks_phota || ''}
                        onChange={(e) => handleRowChange(index, 'marks_phota', e.target.value)}
                        placeholder="Enter Marks"
                        className="w-full h-7 bg-white border border-slate-300 rounded px-1.5 text-xs outline-none"
                      />
                    </td>
                    <td className="p-1.5 w-24">
                      {(() => {
                        const rowUnit = (row.unit || formData.unit_name || 'BALES').toString().trim().toUpperCase();
                        const isBales = rowUnit.includes('BALE') || rowUnit === 'BALES' || (!rowUnit.includes('LOOSE') && rowUnit !== 'LOOSE');
                        return (
                          <input
                            type="number"
                            step="0.001"
                            readOnly={isBales}
                            value={row.netto_pnto !== undefined && row.netto_pnto !== null ? row.netto_pnto : ''}
                            onChange={(e) => {
                              if (!isBales) {
                                const val = e.target.value;
                                handleRowChange(index, 'netto_pnto', val === '' ? 0 : Number(val));
                              }
                            }}
                            placeholder="0.000"
                            title={isBales ? "Auto-calculated: (RCPT / Total RCPT) * Final Weight" : "Enter Netto Weight"}
                            className={cn(
                              "w-full h-7 border rounded px-1.5 text-xs text-right font-bold outline-none font-mono transition-colors",
                              isBales
                                ? "bg-amber-50/90 border-amber-300 text-amber-950 cursor-not-allowed"
                                : "bg-white border-slate-300 text-slate-900 focus:border-[#174C2C]"
                            )}
                          />
                        );
                      })()}
                    </td>
                    <td className="p-1.5">
                      {(() => {
                        const rowUnit = (row.unit || formData.unit_name || 'BALES').toString().trim().toUpperCase();
                        const isLoose = rowUnit.includes('LOOSE') || rowUnit === 'LOOSE';
                        return (
                          <input
                            type="number"
                            readOnly={isLoose}
                            value={isLoose ? 0 : (row.quantity_chln !== undefined ? row.quantity_chln : 0)}
                            onChange={(e) => {
                              if (!isLoose) {
                                handleRowChange(index, 'quantity_chln', e.target.value === '' ? '' : Number(e.target.value));
                              }
                            }}
                            title={isLoose ? "Challan quantity is 0 for LOOSE" : "Enter Challan Quantity"}
                            className={cn(
                              "w-full h-7 border rounded px-1 text-xs text-right font-bold outline-none transition-colors",
                              isLoose
                                ? "bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed"
                                : "bg-white border-slate-300 text-slate-900 focus:border-[#174C2C]"
                            )}
                          />
                        );
                      })()}
                    </td>
                    <td className="p-1.5">
                      {(() => {
                        const rowUnit = (row.unit || formData.unit_name || 'BALES').toString().trim().toUpperCase();
                        const isLoose = rowUnit.includes('LOOSE') || rowUnit === 'LOOSE';
                        return (
                          <input
                            type="number"
                            readOnly={isLoose}
                            value={isLoose ? 0 : (row.quantity_rcpt !== undefined ? row.quantity_rcpt : 0)}
                            onChange={(e) => {
                              if (!isLoose) {
                                handleRowChange(index, 'quantity_rcpt', e.target.value === '' ? '' : Number(e.target.value));
                              }
                            }}
                            title={isLoose ? "Receipt quantity is 0 for LOOSE" : "Enter Receipt Quantity"}
                            className={cn(
                              "w-full h-7 border rounded px-1 text-xs text-right font-bold outline-none transition-colors",
                              isLoose
                                ? "bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed"
                                : "bg-white border-slate-300 text-slate-900 focus:border-[#174C2C]"
                            )}
                          />
                        );
                      })()}
                    </td>
                    <td className="p-1.5 w-24">
                      <input
                        type="text"
                        readOnly
                        value={row.unit || formData.unit_name || 'BALES'}
                        className="w-full h-7 bg-slate-100 border border-slate-300 rounded px-1.5 text-xs text-center font-bold text-slate-700 outline-none cursor-default uppercase"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={row.remarks}
                        onChange={(e) => handleRowChange(index, 'remarks', e.target.value)}
                        placeholder="Enter Remarks"
                        className="w-full h-7 bg-white border border-slate-300 rounded px-1.5 text-xs outline-none"
                      />
                    </td>
                    <td className="p-1.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setDetails(prev => prev.filter((_, i) => i !== index).map((r, i) => ({ ...r, srl_no: i + 1 })));
                        }}
                        className="text-red-500 hover:text-red-700 p-1 rounded cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* FOOTER TOTAL BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleAddRow}
              className="text-[#103A20] hover:text-[#1c5932] font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              + Add New Row
            </button>
            <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
              <span>GRID TOTAL:</span>
              <span>NETTO: <span className="font-mono text-slate-900">{totalNettoWeight.toFixed(3)} M.T</span></span>
              <span>CHLN: <span className="font-mono text-slate-900">{totalChallanQuantity}</span></span>
              <span>RCPT: <span className="font-mono text-slate-900">{totalReceiptQuantity}</span></span>
              <span className="bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded font-bold text-[10px] uppercase">
                AUTO-CALCULATED SUMMARY
              </span>
            </div>
          </div>
        </div>

        {/* 4. UNIFIED WEIGHT INFORMATION CARD (Matching Temporary Arrival) */}
        <div className="w-full rounded-xl border border-[#174C2C] bg-white shadow-xs overflow-hidden mt-1">
          {/* Header */}
          <div className="bg-[#174C2C] text-white px-4 py-2 border-b border-[#0F351E]">
            <h3 className="text-xs font-bold tracking-wide uppercase">
              WEIGHT INFORMATION
            </h3>
          </div>

          {/* Body: 3 Columns (NET WEIGHT | GROSS WEIGHT | TARE WEIGHT) */}
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-300">

            {/* GROSS WEIGHT */}
            <div className="p-3 space-y-2">
              <h4 className="text-[11px] font-bold text-[#174C2C] border-b border-gray-300 pb-1 uppercase">
                GROSS WEIGHT
              </h4>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-800">CHALLAN GROSS</span>
                <input
                  type="number"
                  step="0.001"
                  value={formData.actual_gross_weight || ''}
                  onChange={(e) => handleInputChange('actual_gross_weight', e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-28 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono text-xs focus:border-[#174C2C] outline-none"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-800">MILL GROSS</span>
                <input
                  type="number"
                  step="0.001"
                  value={formData.supplier_challan_gross || ''}
                  onChange={(e) => handleInputChange('supplier_challan_gross', e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-28 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono text-xs focus:border-[#174C2C] outline-none"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-800">ELECTRONIC GROSS</span>
                <input
                  type="number"
                  step="0.001"
                  value={formData.electronic_gross_weight || ''}
                  onChange={(e) => handleInputChange('electronic_gross_weight', e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-28 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono text-xs focus:border-[#174C2C] outline-none"
                />
              </div>
            </div>

            {/* TARE WEIGHT */}
            <div className="p-3 space-y-2">
              <h4 className="text-[11px] font-bold text-[#174C2C] border-b border-gray-300 pb-1 uppercase">
                TARE WEIGHT
              </h4>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-800">CHALLAN TARE</span>
                <input
                  type="number"
                  step="0.001"
                  value={formData.actual_tare_weight || ''}
                  onChange={(e) => handleInputChange('actual_tare_weight', e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-28 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono text-xs focus:border-[#174C2C] outline-none"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-800">MILL TARE</span>
                <input
                  type="number"
                  step="0.001"
                  value={formData.supplier_tare_weight || ''}
                  onChange={(e) => handleInputChange('supplier_tare_weight', e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-28 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono text-xs focus:border-[#174C2C] outline-none"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-800">ELECTRONIC TARE</span>
                <input
                  type="number"
                  step="0.001"
                  value={formData.electronic_tare_weight || ''}
                  onChange={(e) => handleInputChange('electronic_tare_weight', e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-28 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono text-xs focus:border-[#174C2C] outline-none"
                />
              </div>
            </div>

            {/* NET WEIGHT */}
            <div className="p-3 space-y-2">
              <h4 className="text-[11px] font-bold text-[#174C2C] border-b border-gray-300 pb-1 uppercase">
                NET WEIGHT
              </h4>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-800">CHALLAN WT</span>
                <input
                  type="number"
                  step="0.001"
                  value={formData.challan_material_weight ?? ''}
                  onChange={(e) => handleInputChange('challan_material_weight', e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-28 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono text-xs focus:border-[#174C2C] outline-none"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-800">MILL NET</span>
                <input
                  type="number"
                  step="0.001"
                  value={formData.supplier_net_weight ?? ''}
                  onChange={(e) => handleInputChange('supplier_net_weight', e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-28 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono text-xs focus:border-[#174C2C] outline-none"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-800">ELECTRONIC NET</span>
                <input
                  type="number"
                  step="0.001"
                  value={formData.electronic_net_weight ?? ''}
                  onChange={(e) => handleInputChange('electronic_net_weight', e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-28 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono text-xs focus:border-[#174C2C] outline-none"
                />
              </div>
            </div>

          </div>

          {/* Footer: FINAL WEIGHT (M.TON) */}
          <div className="border-t border-gray-300 bg-gray-50/80 px-4 py-2 flex justify-center items-center gap-3">
            <span className="text-[11px] font-bold text-[#174C2C] uppercase tracking-wide">
              FINAL WEIGHT (M.TON)
            </span>

            <input
              type="number"
              step="0.001"
              value={finalWeightDisplayValue}
              onChange={(e) => handleInputChange('weight_reduced', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-32 h-8 border border-red-300 rounded bg-white text-right px-2 font-black font-mono text-red-700 outline-none text-xs"
            />
          </div>
        </div>

        {/* 5. BOTTOM ACTION TOOLBAR */}
        <div className="bg-white rounded-xl border border-[#E6DDC8] p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={resetFormToBlank}
            className="bg-[#103A20] hover:bg-[#1c5932] text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4 text-amber-300" /> ADD NEW
          </button>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="bg-[#103A20] hover:bg-[#1c5932] text-white px-5 py-2 rounded-lg text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4 text-amber-300" /> {loading ? "SAVING..." : "SAVE"}
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="border border-red-500 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-4 h-4" /> CANCEL
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="border border-red-500 text-red-600 hover:bg-red-50 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-4 h-4" /> EXIT
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="border border-[#103A20] text-[#103A20] hover:bg-emerald-50 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Archive className="w-4 h-4" /> VIEW LIST
            </button>
          </div>
        </div>

        {/* Datalists */}
        <datalist id="brokers_dl">
          {brokers.map((b, idx) => (
            <option key={b.id || idx} value={String(b.brok_name).toUpperCase()} />
          ))}
        </datalist>

        <datalist id="suppliers_dl">
          {suppliers.map((s, idx) => (
            <option key={s.id || idx} value={String(s.supp_name).toUpperCase()} />
          ))}
        </datalist>

        <datalist id="areas_dl">
          {areas.map((a, idx) => (
            <option key={a.id || idx} value={String(a.area_name).toUpperCase()} />
          ))}
        </datalist>

        <datalist id="agencies_dl">
          {agencies.map((agency, idx) => (
            <option key={agency.id || idx} value={String(agency.agency_name).toUpperCase()} />
          ))}
        </datalist>

        <datalist id="grades_dl">
          {grades.map((g, idx) => (
            <option key={g.id || idx} value={String(g.grade_name).toUpperCase()} />
          ))}
        </datalist>

        <datalist id="markas_dl">
          {markas.map((m, idx) => (
            <option key={m.id || idx} value={String(m.marka_name).toUpperCase()} />
          ))}
        </datalist>

      </div>
    </LegacyLayout>
  );
}
