import React, { useState, useEffect, useRef } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { 
  Save, 
  X, 
  Plus, 
  Trash2,
  RefreshCw,
  Archive,
  ChevronDown,
  ArrowLeft,
  Lock,
  Unlock,
  AlertTriangle
} from 'lucide-react';
import { cn, sanitizeDate } from '../lib/utils';
import { Amad, ArrivalDetailRow } from '../types';
import { dbModule } from '../services/dbModule';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { supabase } from '../lib/supabase';
import { enforceEditOrDeletePermission, getCurrentUserContext } from '../lib/permissions';

export default function TemporaryArrival({ onSave, onCancel, initialData }: { onSave?: (d: any) => void; onCancel?: () => void; initialData?: Amad }) {
  const [loading, setLoading] = useState(false);
  const [showPoDropdown, setShowPoDropdown] = useState(false);
  const [closedSaudaMap, setClosedSaudaMap] = useState<Map<string, { po_no: string; sauda_no?: string; contractLorries: number; receivedLorries: number; isClosed: boolean }>>(new Map());

  const amadContainerRef = useRef<HTMLDivElement>(null);
  useKeyboardNavigation(amadContainerRef, () => {
    handleSave();
  });
  const [brokers, setBrokers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [markas, setMarkas] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);

  // We can write a parseDetails helper
  const getPaddedDetails = (initialAmad?: Amad) => {
    let pDetails: ArrivalDetailRow[] = [];
    if (initialAmad && initialAmad.grid_details) {
      if (typeof initialAmad.grid_details === 'string') {
        try {
          const parsed = initialAmad.grid_details === 'undefined' || initialAmad.grid_details === 'null' ? [] : JSON.parse(initialAmad.grid_details === "undefined" ? "null" : initialAmad.grid_details);
          if (Array.isArray(parsed)) {
            pDetails = parsed;
          }
        } catch (e) {
          console.error("Error parsing grid_details JSON:", e);
        }
      } else if (Array.isArray(initialAmad.grid_details)) {
        pDetails = initialAmad.grid_details;
      }
    }
    
    // Ensure agency and string fields are cleanly mapped
    pDetails = pDetails.map(d => {
      const agencyName = d.agency_name || (d as any).agency || '';
      const agencyCode = d.agency_code || '';
      return { 
        ...d, 
        agency_name: agencyName, 
        agency_code: agencyCode,
        quantity_chln: d.quantity_chln !== undefined && d.quantity_chln !== null ? Number(d.quantity_chln) : 0,
        quantity_rcpt: d.quantity_rcpt !== undefined && d.quantity_rcpt !== null ? Number(d.quantity_rcpt) : 0,
        netto_pnto: d.netto_pnto !== undefined && d.netto_pnto !== null ? Number(d.netto_pnto) : 0
      };
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
        remarks: ''
      });
    }
    return padded.map((row, idx) => ({ ...row, srl_no: idx + 1 }));
  };

  const [details, setDetails] = useState<ArrivalDetailRow[]>(() => getPaddedDetails(initialData));
  const [unitList, setUnitList] = useState<string[]>(['BALES', 'DRUMS', 'LOOSE', 'P.BALES', 'H.BALES']);

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
        remarks: ''
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
        console.warn("Failed to fetch unit_master in AmadEntry", err);
      }
    }
    loadUnits();
  }, []);

  const today = new Date().toISOString().split('T')[0];

  const parseLorry = (lorry?: string) => {
    let prefix = '';
    let suffix = '';
    if (lorry) {
      const parts = lorry.split('-');
      if (parts.length > 1) {
        prefix = parts[0];
        suffix = parts.slice(1).join('-');
      } else {
        prefix = lorry;
      }
    }
    return { prefix, suffix };
  };

  const [formData, setFormData] = useState(() => {
    const lorryInfo = parseLorry(initialData?.lorry_number || (initialData as any)?.lorry_no || (initialData as any)?.vehicle_no);
    return {
      financial_year: initialData?.financial_year || '2026-2027',
      arrival_no: initialData?.temporary_arrival_no || initialData?.amad_no || 'MR',
      po_no: initialData?.po_no || '',
      date: initialData?.date || '',
      jci: initialData?.jci || 'No',
      challan_supplier: (initialData?.challan_supplier || '').toUpperCase(),
      supplier: (initialData?.supplier || '').toUpperCase(),
      broker: (initialData?.broker || '').toUpperCase(),
      transporter_name: initialData?.transporter_name || '',
      challan_rr_no: initialData?.challan_rr_no || initialData?.challan_railway_receipt_no || '',
      challan_railway_receipt_no: initialData?.challan_railway_receipt_no || initialData?.challan_rr_no || '',
      lorry_prefix: lorryInfo.prefix,
      lorry_suffix: lorryInfo.suffix,
      pan_no: initialData?.pan_no || '',
      lorry_date: initialData?.lorry_date || '',
      consignment_note: initialData?.consignment_note || initialData?.consignment_note_no || '',
      consignment_note_no: initialData?.consignment_note || initialData?.consignment_note_no || '',
      di_no: initialData?.di_no || '',
      di_date: initialData?.di_date || '',
      invoice_no: initialData?.invoice_no || '',
      invoice_date: initialData?.invoice_date || '',
      ptf: initialData?.ptf || 'No',
      lorry_returned: initialData?.lorry_returned || 'No',
      lorry_returned_other_mill: initialData?.lorry_returned_other_mill || 'No',
      arrival_area_code: initialData?.arrival_area_code || '',
      arrival_area_name: (initialData?.arrival_area_name || '').toUpperCase(),
      unit_code: initialData?.unit_code || 'I',
      unit_name: initialData?.unit_name || 'BALES',
      way_bill_no: initialData?.way_bill_no || '',
      way_bill_date: initialData?.way_bill_date || '',
      apmc_fees: initialData?.apmc_fees || 0,
      remarks: initialData?.remarks || '',

      // Bottom weights
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

  const fetchPurchaseOrders = async () => {
    try {
      const [scpRes, amadRes, faRes] = await Promise.all([
        supabase ? supabase.from('sauda_check_point').select('*').order('created_at', { ascending: false }) : dbModule.fetchAll('sauda_check_point', 'created_at', false).then(d => ({ data: d, error: null })),
        supabase ? supabase.from('temporary_material_received').select('*') : dbModule.fetchAll('temporary_material_received').then(d => ({ data: d, error: null })),
        supabase ? supabase.from('final_arrival').select('*') : dbModule.fetchAll('final_arrival').then(d => ({ data: d, error: null }))
      ]);

      const amadList = amadRes?.data || [];
      const faList = faRes?.data || [];
      const tempPoData = (scpRes?.data || []).map((po: any) => ({ ...po, status: po.status || 'temp', sourceTable: 'sauda_check_point' }));

      // Deduplicate by po_no from sauda_check_point
      const uniqueMap = new Map<string, any>();
      tempPoData.forEach((po: any) => {
        if (po && po.po_no) {
          const key = String(po.po_no).trim().toUpperCase();
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, po);
          }
        }
      });

      const uniquePos = Array.from(uniqueMap.values());
      const nextClosedMap = new Map<string, { po_no: string; sauda_no?: string; contractLorries: number; receivedLorries: number; isClosed: boolean }>();

      const filtered = uniquePos
        .filter((po: any) => {
          if (!po.po_no || po.status === 'cancelled') return false;

          const poKey = String(po.po_no).trim().toUpperCase();
          const saudaKey = String(po.sauda_no || '').trim().toUpperCase();
          const isCurrentMatch = initialData && initialData.po_no && (
            String(initialData.po_no).trim().toUpperCase() === poKey ||
            (saudaKey && String(initialData.po_no).trim().toUpperCase() === saudaKey)
          );

          // 1. Check if explicitly reopened by Level 4 or Admin
          const isExplicitReopened = po.is_reopened === true || 
                                     po.reopened === true || 
                                     localStorage.getItem(`sauda_reopened_${poKey}`) === 'true' ||
                                     (saudaKey && localStorage.getItem(`sauda_reopened_${saudaKey}`) === 'true');

          // 2. Check if explicitly closed
          const isExplicitClosed = po.is_closed === true || 
                                   po.sauda_closed === true || 
                                   po.status === 'closed' || 
                                   localStorage.getItem(`sauda_closed_${poKey}`) === 'true' ||
                                   (saudaKey && localStorage.getItem(`sauda_closed_${saudaKey}`) === 'true');

          // 3. Contract lorries
          const contractLorries = Math.max(1, parseInt(po.total_lorries || po.total_no_of_lorries || po.no_of_lorries || po.lorries || 1, 10) || 1);

          // 4. Calculate received lorries from both temporary material received and final arrival
          const amadMatches = amadList.filter((a: any) => {
            const aPo = String(a.po_no || a.ptf_no || '').trim().toUpperCase();
            const aSauda = String(a.sauda_no || '').trim().toUpperCase();
            return (aPo && (aPo === poKey || (saudaKey && aPo === saudaKey))) ||
                   (aSauda && (aSauda === poKey || (saudaKey && aSauda === saudaKey)));
          });

          const faMatches = (faList || []).filter((f: any) => {
            const fPo = String(f.po_no || f.ptf_no || '').trim().toUpperCase();
            const fSauda = String(f.sauda_no || '').trim().toUpperCase();
            return (fPo && (fPo === poKey || (saudaKey && fPo === saudaKey))) ||
                   (fSauda && (fSauda === poKey || (saudaKey && fSauda === saudaKey)));
          });

          const distinctArrivalKeys = new Set<string>();
          amadMatches.forEach((ar: any) => {
            const k = ar.temporary_arrival_no || ar.amad_id || ar.lorry_number || ar.amad_no;
            if (k) distinctArrivalKeys.add(String(k).trim().toUpperCase());
          });
          faMatches.forEach((fa: any) => {
            const k = fa.temporary_arrival_no || fa.arrival_no || fa.lorry_number || fa.mr_no;
            if (k) distinctArrivalKeys.add(String(k).trim().toUpperCase());
          });
          const receivedLorries = Math.max(amadMatches.length, distinctArrivalKeys.size);

          const tempWeightOf = (ar: any) => {
            if (ar.challan_material_weight && Number(ar.challan_material_weight) > 0) return Number(ar.challan_material_weight);
            if (ar.weight_reduced && Number(ar.weight_reduced) > 0) return Number(ar.weight_reduced);
            if (ar.weight_qtl && Number(ar.weight_qtl) > 0) return Number(ar.weight_qtl) / 10;
            if (ar.weight && Number(ar.weight) > 0) return Number(ar.weight) / 10;
            return 0;
          };
          const finalWeightOf = (ar: any) => {
            if (ar.weight_qtl && Number(ar.weight_qtl) > 0) return Number(ar.weight_qtl) / 10;
            if (ar.weight && Number(ar.weight) > 0) return Number(ar.weight) / 10;
            if (ar.challan_material_weight && Number(ar.challan_material_weight) > 0) return Number(ar.challan_material_weight);
            return 0;
          };

          const matchingFinalArrivalNos = new Set(
            faMatches.map((f: any) => String(f.temporary_arrival_no || f.amad_no || '').trim().toUpperCase()).filter(Boolean)
          );
          const matchingFinalLorries = new Set(
            faMatches.map((f: any) => String(f.lorry_number || '').trim().toUpperCase()).filter(Boolean)
          );

          const unpromotedAmad = amadMatches.filter((a: any) => {
            const aNo = String(a.temporary_arrival_no || a.amad_no || '').trim().toUpperCase();
            const aLorry = String(a.lorry_number || '').trim().toUpperCase();
            return (!aNo || !matchingFinalArrivalNos.has(aNo)) && (!aLorry || !matchingFinalLorries.has(aLorry));
          });

          const totalReceivedMt = faMatches.reduce((sum: number, f: any) => sum + finalWeightOf(f), 0) +
                                  unpromotedAmad.reduce((sum: number, a: any) => sum + tempWeightOf(a), 0);

          const contractWeight = parseFloat(po.total_contract_mt) || 0;
          const remainingWeight = contractWeight - totalReceivedMt;

          // Sauda is considered closed if all contracted lorries have arrived, or if remaining weight <= 8 MT,
          // UNLESS explicitly reopened by Admin or Level 4 user.
          const isLorryClosed = contractLorries > 0 && receivedLorries >= contractLorries;
          const isWeightClosed = contractWeight > 0 && totalReceivedMt >= 5.0 && (remainingWeight <= 8.25 || totalReceivedMt >= contractWeight - 8.25);
          const isClosed = !isExplicitReopened && (isExplicitClosed || isLorryClosed || isWeightClosed);

          if (isClosed) {
            const closedEntry = {
              po_no: String(po.po_no).trim(),
              sauda_no: po.sauda_no ? String(po.sauda_no).trim() : undefined,
              contractLorries,
              receivedLorries,
              contractWeight,
              receivedWeight: totalReceivedMt,
              isClosed: true
            };
            nextClosedMap.set(poKey, closedEntry);
            if (saudaKey) nextClosedMap.set(saudaKey, closedEntry);
          }

          // Strict User Requirement:
          // "here Sauda Closed Means In Temporary Arrival Section That Sauda number Is Not shown
          // When It reopen By Level 4 user or admin Then opnly In Temporary Arrival That Sauda or P.O number Show ."
          if (isClosed && !isCurrentMatch) {
            return false;
          }

          return true;
        })
        .map((po: any) => {
          const poKey = String(po.po_no).trim().toUpperCase();
          const saudaKey = String(po.sauda_no || '').trim().toUpperCase();
          const isExplicitReopened = po.is_reopened === true || 
                                     po.reopened === true || 
                                     localStorage.getItem(`sauda_reopened_${poKey}`) === 'true' ||
                                     (saudaKey && localStorage.getItem(`sauda_reopened_${saudaKey}`) === 'true');
          const contractLorries = Math.max(1, parseInt(po.total_lorries || po.total_no_of_lorries || po.no_of_lorries || po.lorries || 1, 10) || 1);

          const amadMatches = amadList.filter((a: any) => {
            const aPo = String(a.po_no || a.ptf_no || '').trim().toUpperCase();
            const aSauda = String(a.sauda_no || '').trim().toUpperCase();
            return (aPo && (aPo === poKey || (saudaKey && aPo === saudaKey))) ||
                   (aSauda && (aSauda === poKey || (saudaKey && aSauda === saudaKey)));
          });
          const faMatches = (faList || []).filter((f: any) => {
            const fPo = String(f.po_no || f.ptf_no || '').trim().toUpperCase();
            const fSauda = String(f.sauda_no || '').trim().toUpperCase();
            return (fPo && (fPo === poKey || (saudaKey && fPo === saudaKey))) ||
                   (fSauda && (fSauda === poKey || (saudaKey && fSauda === saudaKey)));
          });
          const distinctArrivalKeys = new Set<string>();
          amadMatches.forEach((ar: any) => {
            const k = ar.temporary_arrival_no || ar.amad_id || ar.lorry_number || ar.amad_no;
            if (k) distinctArrivalKeys.add(String(k).trim().toUpperCase());
          });
          faMatches.forEach((fa: any) => {
            const k = fa.temporary_arrival_no || fa.arrival_no || fa.lorry_number || fa.mr_no;
            if (k) distinctArrivalKeys.add(String(k).trim().toUpperCase());
          });
          const receivedLorries = Math.max(amadMatches.length, distinctArrivalKeys.size);

          return {
            ...po,
            po_no: String(po.po_no).trim(),
            broker: (po.broker || '').toUpperCase(),
            supplier: (po.supplier || po.party_name || po.merchant || '').toUpperCase(),
            challan_supplier: (po.challan_supplier || po.supplier || po.party_name || po.merchant || '').toUpperCase(),
            area: (po.area || '').toUpperCase(),
            contract_lorries: contractLorries,
            received_lorries: receivedLorries,
            is_reopened: isExplicitReopened
          };
        });

      setClosedSaudaMap(nextClosedMap);
      setPurchaseOrders(filtered);
    } catch (err) {
      console.warn("Error in fetchPurchaseOrders from sauda_check_point:", err);
    }
  };

  useLiveAutoRefresh(fetchPurchaseOrders, [], { tables: ['temporary_material_received', 'sauda_check_point', 'sauda_check_point_details', 'purchase_master', 'purchase_detail_master', 'lorry_weighments', 'final_arrival'] });

  useEffect(() => {
    const handleSaudaStatusChange = () => {
      fetchPurchaseOrders();
    };
    window.addEventListener('storage', handleSaudaStatusChange);
    window.addEventListener('sauda_status_changed', handleSaudaStatusChange);
    return () => {
      window.removeEventListener('storage', handleSaudaStatusChange);
      window.removeEventListener('sauda_status_changed', handleSaudaStatusChange);
    };
  }, []);

  // Load master records and set up real-time PO query subscription
  useEffect(() => {
    async function loadMastersAndIncrement() {
      try {
        const [brokData, suppData, areaData, agcData, gradeData, markaData, allAmads] = await Promise.all([
          dbModule.fetchAll('broker_master').catch(() => []),
          dbModule.fetchAll('supply_master').catch(() => []),
          dbModule.fetchAll('area_master').catch(() => []),
          dbModule.fetchAll('agency_master').catch(() => []),
          dbModule.fetchAll('grade_master').catch(() => []),
          dbModule.fetchAll('marka_master').catch(() => []),
          dbModule.fetchAll('temporary_material_received').catch(() => [])
        ]);

        setBrokers((brokData || []).map((b: any) => ({ ...b, brok_name: (b.brok_name || '').toUpperCase() })));
        setSuppliers((suppData || []).map((s: any) => ({ ...s, supp_name: (s.supp_name || '').toUpperCase() })));
        setAreas((areaData || []).map((a: any) => ({ ...a, area_name: (a.area_name || '').toUpperCase() })));
        setAgencies(agcData || []);
        setGrades(gradeData || []);

        await fetchPurchaseOrders();

        let finalMarkas = markaData || [];
        if (finalMarkas.length === 0) {
          const fallbackNames = ["NO MARK", "SH", "CHANGE", "MJ", "BSP", "RT", "PUROHIT", "DB", "KK", "C.M", "BS", "IM", "NI", "RIEEM", "MAA", "V VISHNU", "KR", "SUNIL", "SARTAJ", "J.S.J", "PK", "ANAND", "RR", "HARI", "PS", "RS", "MR", "GOPAL", "A.P.J.S", "SUN", "SAHEB", "C.R.D", "SM", "SA", "AM", "RABI", "AD", "ML", "RK", "MUBIN", "AMAN", "SKB", "ANTIMA", "SHM", "JMP", "HM", "SN", "KT", "LN", "RAJU", "RA", "SS", "SR", "RAHA", "TT", "USHA", "OP", "ST", "PB", "SK", "BAHETI", "DR", "ROHIT", "BK", "KAMAL", "JM", "CHAIN", "SSB", "SANVI", "BR", "UDM", "JAYA", "MM", "SANGITA", "S", "HBGM", "DHRUV", "SD", "AS", "BALAJI", "AJAY", "SG", "GS", "SB", "RE", "JS", "RM", "RBT", "BD", "MS", "RAEEM", "TS", "TOSH", "LC", "SUMAN", "VANSH", "DK", "BHAWANI", "BP", "SHIV", "SHREE HARI", "A", "KS", "KJ", "VK", "JK", "ARHAM", "SOVA", "KM", "PRAMOD", "PUJA", "DURGA", "JSB", "NS", "JAY HANUMAN", "MB", "MANOJ", "SHUBHAM", "KISHAN", "JAY", "AX", "SKC", "YUNUS", "BIJOY", "BN", "A.J.P", "J/MU/DK", "J/MU/HP", "AP", "ANISH", "RISHAV", "SKS", "BUL BUL", "KEDIA", "SMB", "NAIZA", "MH", "BULBUL", "RAKHECHA", "R.JAIN", "MKC", "NC", "MRR", "P", "J.A.K.", "JAK", "GOBINDA", "RAM", "TULSI G", "PP", "HARI OM", "MOTI", "GK", "KRISHNA", "SANJOY", "AA", "MP", "TANU", "ASHA", "DNJ(BHOWMICK)", "SUMIT", "TULSI/H", "KP", "K.L.K", "SWASTIK", "JC", "PM", "BB", "GM", "SHREE"];
          // Try to async insert them to the DB so they are persistent
          try {
            await Promise.all(
              fallbackNames.map((name, i) => {
                const codeStr = String(i + 1).padStart(2, '0');
                return dbModule.insert('marka_master', { marka_code: codeStr, marka_name: name }).catch(() => null);
              })
            );
          } catch(e) {
            console.warn("Could not insert seed markas to DB:", e);
          }
          finalMarkas = fallbackNames.map((name, i) => ({
            id: i + 1,
            marka_code: String(i + 1).padStart(2, '0'),
            marka_name: name
          }));
        }
        setMarkas(finalMarkas);

        if (!initialData) {
          // Dynamic auto-increment to establish a clean reference voucher serial
          let nextNum = 168; // default base starting number
          if (allAmads && allAmads.length > 0) {
            let lastNum = 167;
            allAmads.forEach((a: any) => {
              const an = String(a.temporary_arrival_no || a.amad_no || '');
              const num = parseInt(an.replace(/[^0-9]/g, ''), 10);
              if (!isNaN(num) && num > lastNum) {
                lastNum = num;
              }
            });
            nextNum = lastNum + 1;
          }
          
          setFormData(prev => ({
            ...prev,
            arrival_no: initialData?.temporary_arrival_no || initialData?.amad_no || 'MR',
            challan_supplier: '',
            supplier: '',
            agency_name: '',
            broker: '',
            arrival_area_name: '',
            arrival_area_code: ''
          }));
        }
      } catch (e) {
        console.error("Error loading master templates:", e);
      }
    }
    loadMastersAndIncrement();

    const handleLocalUpdate = () => {
      fetchPurchaseOrders();
    };
    window.addEventListener('app-data-updated', handleLocalUpdate);

    let poSub: any = null;
    if (supabase) {
      poSub = supabase
        .channel('amad_entry_po_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_master' }, () => {
          fetchPurchaseOrders();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_check_point' }, () => {
          fetchPurchaseOrders();
        })
        .subscribe();
    }

    return () => {
      window.removeEventListener('app-data-updated', handleLocalUpdate);
      if (poSub) {
        supabase.removeChannel(poSub);
      }
    };
  }, [initialData]);

  // Draft features disabled to ensure form is always a fresh blank form on click, per user request
  useEffect(() => {
    // Left empty intentionally to prevent restoring old drafts
  }, [initialData]);

  // Auto-match and pull weights and party info from lorry_weighments table based on Lorry Arrival Date & Lorry Number
  useEffect(() => {
    const lorryDateStr = (formData.lorry_date || '').trim();
    const lorryPrefix = (formData.lorry_prefix || '').trim();
    const lorrySuffix = (formData.lorry_suffix || '').trim();
    const combinedLorryClean = `${lorryPrefix}${lorrySuffix}`.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // BOTH Lorry Arrival Date AND Full Lorry Number (Prefix & Suffix) are MANDATORY before pulling data
    if (!lorryDateStr || !lorryPrefix || !lorrySuffix || !combinedLorryClean) return;

    let isMounted = true;

    const syncFromLorryWeighments = async () => {
      try {
        let rows: any[] = [];
        if (supabase) {
          const { data } = await supabase.from('lorry_weighments').select('*');
          rows = data || [];
        } else {
          rows = await dbModule.fetchAll('lorry_weighments').catch(() => []);
        }

        if (!rows || rows.length === 0 || !isMounted) return;

        // Exact match by entry_date (or date) and lorry_no (or lorry_number / vehicle_no)
        const matched = rows.find((r: any) => {
          const rDate = String(r.entry_date || r.date || r.created_at || '').split('T')[0].trim();
          const rLorryClean = String(r.lorry_no || r.lorry_number || r.vehicle_no || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

          const dateMatch = rDate === lorryDateStr;
          const lorryMatch = rLorryClean === combinedLorryClean;

          return dateMatch && lorryMatch;
        });

        if (matched && isMounted) {
          const formatToMT = (val: any): number => {
            if (val === null || val === undefined || val === '') return 0;
            const num = Number(val);
            if (isNaN(num) || num <= 0) return 0;
            return num > 200 ? Number((num / 1000).toFixed(3)) : Number(num.toFixed(3));
          };

          const gateNet = formatToMT(matched.gate_net_weight ?? matched.stage1_net_weight);
          const gateGross = formatToMT(matched.gate_gross_weight ?? matched.stage1_gross_weight);
          const gateTare = formatToMT(matched.gate_tare_weight ?? matched.stage1_tare_weight);

          const millGrossNum = Number(matched.mill_gross_weight ?? matched.stage2_gross_weight ?? 0);
          const millTareNum = Number(matched.mill_tare_weight ?? matched.stage2_tare_weight ?? 0);
          const millGross = formatToMT(millGrossNum);
          const millTare = formatToMT(millTareNum);

          let millNet = 0;
          if (millGrossNum > 0 && millTareNum > 0) {
            millNet = formatToMT(millGrossNum - millTareNum);
          } else {
            millNet = formatToMT(matched.mill_net_weight ?? matched.stage2_net_weight);
          }

          const elecGrossNum = Number(matched.electric_gross_weight ?? matched.stage3_gross_weight ?? 0);
          const elecTareNum = Number(matched.electric_tare_weight ?? matched.stage3_tare_weight ?? 0);
          const elecGross = formatToMT(elecGrossNum);
          const elecTare = formatToMT(elecTareNum);

          let elecNet = 0;
          if (elecGrossNum > 0 && elecTareNum > 0) {
            elecNet = formatToMT(elecGrossNum - elecTareNum);
          } else {
            elecNet = formatToMT(matched.electric_net_weight ?? matched.stage3_net_weight);
          }

          setFormData(prev => {
            const updated = { ...prev };

            // Weight fields
            if (gateNet > 0) updated.challan_material_weight = gateNet;
            if (millNet > 0) updated.supplier_net_weight = millNet;
            if (elecNet > 0) updated.electronic_net_weight = elecNet;

            if (gateGross > 0) updated.actual_gross_weight = gateGross;
            if (millGross > 0) updated.supplier_challan_gross = millGross;
            if (elecGross > 0) updated.electronic_gross_weight = elecGross;

            if (gateTare > 0) updated.actual_tare_weight = gateTare;
            if (millTare > 0) updated.supplier_tare_weight = millTare;
            if (elecTare > 0) updated.electronic_tare_weight = elecTare;

            // Auto-fill party_name if P.O. Number is BLANK
            if (!prev.po_no || !prev.po_no.trim()) {
              const party = (matched.party_name || matched.broker || matched.supplier || '').toUpperCase();
              if (party) {
                updated.broker = party;
                updated.challan_supplier = party;
                updated.supplier = party;
              }
            }

            return updated;
          });
        }
      } catch (err) {
        console.warn("Error matching with lorry_weighments:", err);
      }
    };

    syncFromLorryWeighments();

    return () => {
      isMounted = false;
    };
  }, [formData.lorry_date, formData.lorry_prefix, formData.lorry_suffix, formData.po_no]);

  // Helper function to calculate allocated Netto (M.T) based on Final Weight and RCPT
  // Formula: (RCPT / Total RCPT) * Final Weight.
  // Note: This calculation is strictly NOT APPLICABLE for "LOOSE" unit.
  const calculateProportionalNetto = (finalWeightVal: number, rows: ArrivalDetailRow[]): ArrivalDetailRow[] => {
    const isLoose = (formData.unit_name || '').toUpperCase().includes('LOOSE');
    if (isLoose) {
      return rows; // Pro-rata calculation is NOT applicable for "LOOSE"
    }

    const getRowQuantity = (r: ArrivalDetailRow) => Number(r.quantity_rcpt) || Number(r.quantity_chln) || 0;

    const sumRcpt = rows.reduce((sum, d) => sum + getRowQuantity(d), 0);
    if (sumRcpt <= 0 || finalWeightVal <= 0) {
      return rows; // Do NOT zero out when sumRcpt is 0
    }

    const nonZeroIndices = rows.map((r, i) => (getRowQuantity(r) > 0 ? i : -1)).filter(i => i !== -1);
    if (nonZeroIndices.length === 0) {
      return rows;
    }

    const updated = [...rows];
    let allocated = 0;

    nonZeroIndices.forEach((idx, k) => {
      const q = getRowQuantity(updated[idx]);
      if (k === nonZeroIndices.length - 1) {
        // Last non-zero item absorbs any remaining rounding difference to match exact Final Weight
        const lastVal = Number((finalWeightVal - allocated).toFixed(3));
        updated[idx] = { ...updated[idx], netto_pnto: Math.max(0, lastVal) };
      } else {
        const val = Number(((finalWeightVal / sumRcpt) * q).toFixed(3));
        updated[idx] = { ...updated[idx], netto_pnto: val };
        allocated += val;
      }
    });

    // Zero out any rows with quantity <= 0 for non-LOOSE items
    rows.forEach((r, i) => {
      if (getRowQuantity(r) <= 0) {
        updated[i] = { ...updated[i], netto_pnto: 0 };
      }
    });

    return updated;
  };

  // Sync and dynamically calculate net weights based on scale inputs and determine Final Weight (lowest Net Weight)
  useEffect(() => {
    setFormData(prev => {
      const grossChln = Number(prev.actual_gross_weight) || 0;
      const tareChln = Number(prev.actual_tare_weight) || 0;
      const grossMill = Number(prev.supplier_challan_gross) || 0;
      const tareMill = Number(prev.supplier_tare_weight) || 0;
      const grossElec = Number(prev.electronic_gross_weight) || 0;
      const tareElec = Number(prev.electronic_tare_weight) || 0;

      const calculatedChallanNet = grossChln > 0 ? Number(Math.max(0, grossChln - tareChln).toFixed(3)) : (Number(prev.challan_material_weight) || 0);
      const calculatedSupplierNet = grossMill > 0 ? Number(Math.max(0, grossMill - tareMill).toFixed(3)) : (Number(prev.supplier_net_weight) || 0);
      const calculatedElectronicNet = grossElec > 0 ? Number(Math.max(0, grossElec - tareElec).toFixed(3)) : (Number(prev.electronic_net_weight) || 0);

      // Final Weight is lowest value among the Net Weight section (CHALLAN WT, MILL NET, ELECTRONIC NET)
      const validNetWeights = [
        calculatedChallanNet,
        calculatedSupplierNet,
        calculatedElectronicNet
      ].filter(v => v > 0);

      const minNetWeight = validNetWeights.length > 0 ? Number(Math.min(...validNetWeights).toFixed(3)) : (Number(prev.weight_reduced) || 0);

      if (
        calculatedChallanNet === prev.challan_material_weight &&
        calculatedSupplierNet === prev.supplier_net_weight &&
        calculatedElectronicNet === prev.electronic_net_weight &&
        minNetWeight === prev.weight_reduced
      ) {
        return prev;
      }

      return {
        ...prev,
        challan_material_weight: calculatedChallanNet,
        supplier_net_weight: calculatedSupplierNet,
        electronic_net_weight: calculatedElectronicNet,
        weight_reduced: minNetWeight
      };
    });
  }, [
    formData.actual_gross_weight,
    formData.actual_tare_weight,
    formData.supplier_challan_gross,
    formData.supplier_tare_weight,
    formData.electronic_gross_weight,
    formData.electronic_tare_weight,
    formData.challan_material_weight,
    formData.supplier_net_weight,
    formData.electronic_net_weight
  ]);

  // Recalculate Receipt Grade Details Netto (M.T) whenever Final Weight or quantity_rcpt/quantity_chln changes (non-LOOSE only)
  useEffect(() => {
    const isLoose = (formData.unit_name || '').toUpperCase().includes('LOOSE');
    if (isLoose) return; // Strictly not applicable for LOOSE

    const finalWeight = Number(formData.weight_reduced) || 0;
    setDetails(prev => {
      const recalculated = calculateProportionalNetto(finalWeight, prev);
      const isDifferent = recalculated.some((r, i) => r.netto_pnto !== prev[i]?.netto_pnto);
      return isDifferent ? recalculated : prev;
    });
  }, [
    formData.weight_reduced,
    formData.unit_name,
    details.map(d => `${d.quantity_rcpt}_${d.quantity_chln}_${d.unit}`).join(',')
  ]);

  const loadDetailsFromPo = async (poNo: string) => {
    if (!poNo || !poNo.trim()) return;
    try {
      const poNoUpper = poNo.trim().toUpperCase();
      let filteredDetails: any[] = [];

      // 1. Query Supabase directly if available
      if (supabase) {
        const [scpRes, pdmRes] = await Promise.all([
          supabase.from('sauda_check_point_details').select('*').eq('po_no', poNo.trim()),
          supabase.from('purchase_detail_master').select('*').eq('po_no', poNo.trim())
        ]);
        const scp = scpRes.data || [];
        const pdm = pdmRes.data || [];

        if (scp.length > 0) {
          filteredDetails = scp;
        } else if (pdm.length > 0) {
          filteredDetails = pdm;
        } else {
          // Case insensitive fallback
          const [scpIns, pdmIns] = await Promise.all([
            supabase.from('sauda_check_point_details').select('*').ilike('po_no', poNoUpper),
            supabase.from('purchase_detail_master').select('*').ilike('po_no', poNoUpper)
          ]);
          filteredDetails = (scpIns.data && scpIns.data.length > 0) ? scpIns.data : (pdmIns.data || []);
        }
      }

      // 2. Query dbModule fallback if still empty
      if (!filteredDetails || filteredDetails.length === 0) {
        const [allScp, allPdm] = await Promise.all([
          dbModule.fetchAll('sauda_check_point_details').catch(() => []),
          dbModule.fetchAll('purchase_detail_master').catch(() => [])
        ]);
        const scp = (allScp || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poNoUpper);
        const pdm = (allPdm || []).filter((d: any) => String(d.po_no).trim().toUpperCase() === poNoUpper);
        filteredDetails = scp.length > 0 ? scp : pdm;
      }

      // 3. Fallback to embedded items in purchaseOrders list
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
          const rawGrade = String(fd.grade_code || fd.grade_name || fd.grade || '').trim();
          const matchingGrade = grades.find(g => 
            String(g.grade_code || '').trim().toUpperCase() === rawGrade.toUpperCase() || 
            String(g.grade_name || '').trim().toUpperCase() === rawGrade.toUpperCase()
          );
          const gradeName = matchingGrade ? matchingGrade.grade_name : rawGrade;
          const gradeCode = matchingGrade ? matchingGrade.grade_code : rawGrade;

          const rawMarka = String(fd.marka_code || fd.marka_name || fd.marka || fd.challan_marka_name || fd.challan_marka_code || '').trim();
          const matchingMarka = markas.find(m => 
            String(m.marka_code || '').trim().toUpperCase() === rawMarka.toUpperCase() || 
            String(m.marka_name || '').trim().toUpperCase() === rawMarka.toUpperCase()
          );
          const markaName = matchingMarka ? matchingMarka.marka_name : (rawMarka || 'NO MARK');
          const markaCode = matchingMarka ? matchingMarka.marka_code : (rawMarka || '01');

          const rawAgency = String(fd.agency_code || fd.agency_name || fd.agency || '').trim();
          const matchingAgency = agencies.find(a =>
            String(a.agency_code || '').trim().toUpperCase() === rawAgency.toUpperCase() ||
            String(a.agency_name || '').trim().toUpperCase() === rawAgency.toUpperCase()
          );
          const agencyName = matchingAgency ? matchingAgency.agency_name : rawAgency;
          const agencyCode = matchingAgency ? matchingAgency.agency_code : rawAgency;

          const weightVal = parseFloat(fd.weight_mt || fd.netto_pnto || fd.weight || fd.weight_reduced || (fd.weight_qtl ? (parseFloat(fd.weight_qtl) / 10) : 0) || 0) || 0;
          const qtyVal = parseInt(fd.quantity || fd.quantity_rcpt || fd.quantity_chln || 0, 10) || 0;

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
            netto_pnto: weightVal,
            quantity_chln: qtyVal,
            quantity_rcpt: qtyVal,
            remarks: fd.remarks || ''
          };
        });
        setDetails(newDetails);
      }
    } catch (e) {
      console.warn("Error loading details from PO:", e);
    }
  };

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    let finalValue = value;
    if (name === 'broker' || name === 'supplier' || name === 'challan_supplier' || name === 'arrival_area_name') {
      finalValue = (value || '').toUpperCase();
    }
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: name.includes('weight') || name.includes('fees') ? (finalValue === '' ? '' : Number(finalValue)) : finalValue
      };

      if (name === 'po_no' && finalValue) {
        const matched = purchaseOrders.find((po: any) => String(po.po_no).trim().toUpperCase() === String(finalValue).trim().toUpperCase());
        if (matched) {
          updated.supplier = (matched.supplier || prev.supplier || '').toUpperCase();
          updated.challan_supplier = (matched.challan_supplier || matched.supplier || prev.challan_supplier || '').toUpperCase();
          updated.broker = (matched.broker || prev.broker || '').toUpperCase();
          updated.arrival_area_name = (matched.area || prev.arrival_area_name || '').toUpperCase();
          const matchedArea = areas.find((a: any) => String(a.area_name).trim().toUpperCase() === String(matched.area).trim().toUpperCase());
          if (matchedArea) {
            updated.arrival_area_code = matchedArea.area_code;
          }
          const matchedUnit = matched.purchase_unit_name || matched.unit_name || matched.unit || prev.unit_name || 'BALES';
          updated.unit_name = matchedUnit;
          const codeMap: Record<string, string> = {
            BALES: 'I',
            LOOSE: 'II',
            DRUMS: '2',
            'P.BALES': '4',
            'H.BALES': '5',
          };
          updated.unit_code = matched.purchase_unit_code || matched.unit_code || codeMap[matchedUnit] || prev.unit_code || 'I';
          updated.ptf = (matched.ptf_no || matched.is_ptf) ? 'Yes' : 'No';
        }
        
        // Pull details from purchase_detail_master / sauda_check_point_details
        loadDetailsFromPo(finalValue);
      }

      return updated;
    });
  };

  const handleDetailChange = (index: number, field: keyof ArrivalDetailRow, value: any) => {
    setDetails(prev => {
      const updated = [...prev];

      updated[index] = {
        ...updated[index],
        [field]: value
      };

      // Auto-update grade labels and code when selected by Name
      if (field === 'receipt_grade_name') {
        const foundGrade = grades.find(g => g.grade_name === value);
        if (foundGrade) {
          updated[index].receipt_grade_code = foundGrade.grade_code || '';
          updated[index].challan_grade_name = foundGrade.grade_name || '';
        } else {
          updated[index].receipt_grade_code = '';
          updated[index].challan_grade_name = '';
        }
      }

      if (field === 'quantity_rcpt') {
        updated[index].quantity_rcpt = Number(value) || 0;
      }

      if (field === 'quantity_chln') {
        updated[index].quantity_chln = Number(value) || 0;
      }

      // Auto-update marka labels and code when selected by Name
      if (field === 'challan_marka_name') {
        const inputVal = (value || '').trim().toUpperCase();
        const foundMarka = markas.find(m => (m.marka_name || '').trim().toUpperCase() === inputVal);
        if (foundMarka) {
          updated[index].challan_marka_code = foundMarka.marka_code || '';
          updated[index].challan_marka_name = foundMarka.marka_name; // preserve the standard casing
        } else {
          updated[index].challan_marka_code = ''; // manually typed entry - code will be assigned on save
          updated[index].challan_marka_name = value ? value.toUpperCase() : ''; // keep as uppercase custom marka
        }
      }

      if (field === 'agency_name') {
        const inputVal = (value || '').trim().toUpperCase();
        const foundAgency = agencies.find(a => (a.agency_name || '').trim().toUpperCase() === inputVal);
        if (foundAgency) {
          updated[index].agency_code = foundAgency.agency_code || '';
          updated[index].agency_name = foundAgency.agency_name;
        } else {
          updated[index].agency_code = updated[index].agency_code || '';
          updated[index].agency_name = value ? value.toUpperCase() : '';
        }
      }

      if (field === 'agency_code') {
        const inputCode = (value || '').trim().toUpperCase();
        const foundAgency = agencies.find(a => String(a.agency_code || '').trim().toUpperCase() === inputCode);
        if (foundAgency) {
          updated[index].agency_code = foundAgency.agency_code || inputCode;
          updated[index].agency_name = foundAgency.agency_name || updated[index].agency_name;
        } else {
          updated[index].agency_code = inputCode;
        }
      }

      if (field === 'netto_pnto') {
        updated[index].netto_pnto = Number(value) || 0;
      }

      return updated;
    });
  };

  const clearForm = () => {
    setDetails([{
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
      remarks: ''
    }]);
    setFormData(prev => ({
      ...prev,
      po_no: '',
      transporter_name: '',
      challan_rr_no: '',
      lorry_prefix: '',
      lorry_suffix: '',
      pan_no: '',
      lorry_date: '',
      consignment_note_no: '',
      di_no: '',
      di_date: '',
      invoice_no: '',
      invoice_date: '',
      ptf: 'No',
      lorry_returned: 'No',
      lorry_returned_other_mill: 'No',
      way_bill_no: '',
      way_bill_date: '',
      apmc_fees: 0,
      remarks: '',
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
    }));
    localStorage.removeItem('amad_draft_form');
    localStorage.removeItem('amad_draft_details');
  };

  const handleSave = async () => {
    if (initialData && !enforceEditOrDeletePermission("Edit")) {
      return;
    }

    // Guard: Prohibit creating new temporary arrivals against closed saudas
    const cleanEnteredPo = String(formData.po_no || '').trim().toUpperCase();
    if (!initialData && cleanEnteredPo && closedSaudaMap.has(cleanEnteredPo)) {
      const closedItem = closedSaudaMap.get(cleanEnteredPo);
      alert(`🔒 Action Prohibited: Sauda #${closedItem?.po_no || cleanEnteredPo} is CLOSED (${closedItem?.receivedLorries || 0}/${closedItem?.contractLorries || 1} Lorries Received).\n\nClosed Saudas are not accepted for Temporary Arrival. Only an Admin or Level 4 user can Reopen this Sauda from Sauda Check Point.`);
      return;
    }

    setLoading(true);
    try {
      const activeRows = details.filter(row => 
        row.receipt_grade_code || 
        row.receipt_grade_name ||
        row.challan_grade_name || 
        row.challan_marka_name ||
        row.agency_name ||
        Number(row.netto_pnto) > 0 || 
        Number(row.quantity_rcpt) > 0 || 
        Number(row.quantity_chln) > 0
      );

      // Check if there are any new manual marks to insert into the database
      const uniqueNewMarkas: string[] = [];
      activeRows.forEach(row => {
        const markaName = (row.challan_marka_name || '').trim();
        if (markaName) {
          const exists = markas.some(m => (m.marka_name || '').trim().toUpperCase() === markaName.toUpperCase());
          if (!exists && !uniqueNewMarkas.some(n => n.toUpperCase() === markaName.toUpperCase())) {
            uniqueNewMarkas.push(markaName);
          }
        }
      });

      if (uniqueNewMarkas.length > 0) {
        let maxMarkaCode = markas.reduce((acc, m) => {
          const codeVal = parseInt(m.marka_code || '0', 10);
          return isNaN(codeVal) ? acc : Math.max(acc, codeVal);
        }, 170);

        for (const name of uniqueNewMarkas) {
          maxMarkaCode += 1;
          const codeStr = String(maxMarkaCode).padStart(2, '0');
          try {
            await dbModule.insert('marka_master', {
              marka_code: codeStr,
              marka_name: name.toUpperCase() // Save nicely as uppercase standard
            });
            // Update in activeRows detail so it saves with the newly generated code str
            activeRows.forEach(r => {
              if ((r.challan_marka_name || '').trim().toUpperCase() === name.toUpperCase()) {
                r.challan_marka_code = codeStr;
                r.challan_marka_name = name.toUpperCase();
              }
            });
          } catch (e) {
            console.error("Failed to insert new marka name:", name, e);
          }
        }
      }

      const totalPacketsSum = Math.round(activeRows.reduce((acc, curr) => acc + (Number(curr.quantity_rcpt) || 0), 0));
      const totalWeightSum = activeRows.reduce((acc, curr) => acc + (Number(curr.netto_pnto) || 0), 0);
      const lorryCombined = `${formData.lorry_prefix}-${formData.lorry_suffix}`.trim();

      const primaryRow = activeRows.find(r => (Number(r.netto_pnto) > 0 || Number(r.quantity_chln) > 0 || Number(r.quantity_rcpt) > 0)) || activeRows[0];

      const payload = {
        financial_year: formData.financial_year,
        amad_no: formData.arrival_no,
        temporary_arrival_no: formData.arrival_no,
        po_no: formData.po_no,
        date: sanitizeDate(formData.date),
        jci: formData.jci,
        challan_supplier: formData.challan_supplier,
        supplier: formData.supplier,
        broker: formData.broker,
        transporter_name: formData.transporter_name,
        challan_rr_no: formData.challan_rr_no || (formData as any).challan_railway_receipt_no || '',
        challan_railway_receipt_no: (formData as any).challan_railway_receipt_no || formData.challan_rr_no || '',
        lorry_number: lorryCombined,
        pan_no: formData.pan_no,
        lorry_date: sanitizeDate(formData.lorry_date),
        consignment_note: (formData as any).consignment_note || formData.consignment_note_no || '',
        consignment_note_no: (formData as any).consignment_note || formData.consignment_note_no || '',
        di_no: formData.di_no,
        di_date: sanitizeDate(formData.di_date),
        invoice_no: formData.invoice_no,
        invoice_date: sanitizeDate(formData.invoice_date),
        ptf: formData.ptf,
        lorry_returned: formData.lorry_returned,
        lorry_returned_other_mill: formData.lorry_returned_other_mill,
        arrival_area_code: formData.arrival_area_code,
        arrival_area_name: formData.arrival_area_name,
        unit_code: formData.unit_code,
        unit_name: formData.unit_name,
        way_bill_no: formData.way_bill_no,
        way_bill_date: sanitizeDate(formData.way_bill_date),
        apmc_fees: formData.apmc_fees || 0,
        remarks: formData.remarks,
        total_packets: totalPacketsSum,
        weight_qtl: totalWeightSum * 10,
        grid_details: activeRows.map(row => {
          return {
            srl_no: Number(row.srl_no) || 1,
            remarks: row.remarks || '',
            crop_year: row.crop_year || '2026-27',
            netto_pnto: Number(row.netto_pnto) || 0,
            agency_code: row.agency_code || '',
            agency_name: row.agency_name || '',
            quantity_chln: Math.round(Number(row.quantity_chln) || 0),
            quantity_rcpt: Math.round(Number(row.quantity_rcpt) || 0),
            challan_grade_name: row.challan_grade_name || row.receipt_grade_name || '',
            challan_marka_code: row.challan_marka_code || '',
            challan_marka_name: row.challan_marka_name || '',
            receipt_grade_code: row.receipt_grade_code || '',
            receipt_grade_name: row.receipt_grade_name || ''
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
        weight_reduced: formData.weight_reduced || 0,

        // Backward compatibility properties & grade indexing
        packets: totalPacketsSum,
        weight: totalWeightSum * 10,
        commodity: 'RAW JUTE',
        variety: primaryRow?.receipt_grade_name || primaryRow?.challan_grade_name || 'TOSSA',
        grading: primaryRow?.receipt_grade_name || primaryRow?.challan_grade_name || 'TD6',
        marka: primaryRow?.challan_marka_name || 'DIRECT',
        status: 'Active'
      };

      let changesSummaryArr: string[] = [];
      if (initialData) {
        const keysToCompare = [
          { key: 'po_no', label: 'PO No' },
          { key: 'date', label: 'Date' },
          { key: 'supplier', label: 'Supplier' },
          { key: 'lorry_number', label: 'Lorry Number' },
          { key: 'total_packets', label: 'Total Packets' },
          { key: 'remarks', label: 'Remarks' },
          { key: 'actual_gross_weight', label: 'Gross Weight' },
          { key: 'actual_tare_weight', label: 'Tare Weight' }
        ];

        keysToCompare.forEach(({ key, label }) => {
          const oldVal = (initialData as any)[key];
          const newVal = (payload as any)[key];
          if (String(oldVal || '').trim() !== String(newVal || '').trim()) {
            changesSummaryArr.push(`${label}: "${oldVal ?? ''}" → "${newVal ?? ''}"`);
          }
        });
      }

      // Prepare standard database payload (strip non-table properties)
      const dbPayload = { ...payload };
      delete (dbPayload as any).amad_no;
      delete (dbPayload as any).grade;

      const tryDbOperation = async (operation: () => Promise<any>) => {
        try {
          return await operation();
        } catch (e: any) {
          const errMsg = e?.message || String(e || '');
          const match = errMsg.match(/Could not find the '([^']+)' column/i);
          if (match && match[1] && (dbPayload as any)[match[1]] !== undefined) {
            console.warn(`Stripping unknown column '${match[1]}' from payload and retrying`);
            delete (dbPayload as any)[match[1]];
            return await operation();
          }
          if (errMsg.includes('amad_no')) {
            delete (dbPayload as any).amad_no;
            return await operation();
          }
          if (errMsg.includes('temporary_arrival_no')) {
            delete (dbPayload as any).temporary_arrival_no;
            return await operation();
          }
          throw e;
        }
      };

      if (initialData && initialData.amad_id) {
        await Promise.all([
          tryDbOperation(() => dbModule.update('temporary_material_received', 'amad_id', initialData.amad_id, dbPayload)).catch((e) => {
            console.error("Error updating temporary_material_received:", e);
            throw e;
          }),
          tryDbOperation(() => dbModule.update('issue_master', 'amad_id', initialData.amad_id, dbPayload)).catch((e) => {
            console.warn("Could not sync with issue_master or issue_master didn't exist for update, skipping:", e);
          })
        ]);

        // Insert audit trail for update
        const historyLog = {
          amad_no: formData.arrival_no || 'UNKNOWN',
          amad_id: initialData.amad_id,
          action_type: 'UPDATE',
          modified_by: getCurrentUserContext().username || 'ADMIN',
          old_values: JSON.stringify(initialData),
          new_values: JSON.stringify(payload),
          changes_summary: changesSummaryArr.join(', ') || 'Voucher record updated (re-saved)'
        };
        await dbModule.insert('amad_change_history', historyLog).catch((e) => {
          console.error("Failed to write update log:", e);
        });

        alert(`Arrival Register Voucher #${formData.arrival_no} updated successfully!`);
      } else {
        let insertAmadError: any = null;
        let insertIssueError: any = null;
        await Promise.all([
          tryDbOperation(() => dbModule.insert('temporary_material_received', dbPayload)).catch((e) => { insertAmadError = e; return null; }),
          tryDbOperation(() => dbModule.insert('issue_master', dbPayload)).catch((e) => { insertIssueError = e; return null; })
        ]);
        if (insertAmadError) {
          alert(`Failed to save to Database: ${insertAmadError.message || insertAmadError}`);
          return;
        }

        // Insert audit trail for insert
        const historyLog = {
          amad_no: formData.arrival_no || 'UNKNOWN',
          amad_id: formData.arrival_no,
          action_type: 'INSERT',
          modified_by: getCurrentUserContext().username || 'ADMIN',
          old_values: null,
          new_values: JSON.stringify(payload),
          changes_summary: `New Arrival Voucher registered by ${getCurrentUserContext().username || 'ADMIN'} containing ${payload.total_packets} Packets`
        };
        await dbModule.insert('amad_change_history', historyLog).catch((e) => {
          console.error("Failed to write insert log:", e);
        });

        alert(`Arrival Register Saved successfully!\nAdded under Arrival Voucher #${formData.arrival_no}`);
      }

      // Dynamically calculate and update status of PO & Sauda based on total received quantities/weights
      const currentPoNo = formData.po_no ? formData.po_no.trim().toUpperCase() : '';
      if (currentPoNo) {
        try {
          const allPos = await dbModule.fetchAll('purchase_master', 'created_at', false).catch(() => []);
          const matchedPo = allPos.find((po: any) => String(po.po_no).trim().toUpperCase() === currentPoNo);

          if (matchedPo) {
            const allAmads = await dbModule.fetchAll('temporary_material_received').catch(() => []);
            let totalReceivedMt = 0;
            allAmads.forEach((am: any) => {
              // Ensure we don't count the current saved record twice if it is already indexed in allAmads
              if (payload && (formData.arrival_no === am.amad_no || formData.arrival_no === am.amad_id || formData.arrival_no === am.temporary_arrival_no)) return;
              if (initialData && initialData.amad_id === am.amad_id) return;
              if (am.po_no && String(am.po_no).trim().toUpperCase() === currentPoNo) {
                totalReceivedMt += (Number(am.weight_qtl) || 0) / 10;
              }
            });

            totalReceivedMt += totalWeightSum;

            const contractWeight = Number(matchedPo.total_contract_mt) || 0;
            const isComplete = contractWeight > 0 && totalReceivedMt >= (contractWeight - 0.01);
            console.log(`[PO STATUS TRIGGER] Checking fulfillment for PO ${currentPoNo || 'unknown'}: Cumulative Received ${totalReceivedMt.toFixed(3)} MT / Contract Weight ${contractWeight.toFixed(3)} MT. Complete: ${isComplete}`);
            const newStatus = isComplete ? 'completed' : 'in progress';

            const prevPendingStatus = matchedPo.pending;
            const prevTextStatus = matchedPo.status || 'pending';
            
            console.log(`[PO STATUS TRANSITION AUDIT] PO No: ${currentPoNo} during M.R. Entry. Contract: ${contractWeight} MT. Added weight: ${totalWeightSum} MT. Total received weight: ${totalReceivedMt} MT. Complete: ${isComplete}. Transition: pending ${prevPendingStatus} -> ${!isComplete}, status '${prevTextStatus}' -> '${newStatus}'`);

            // Save status transition trace into user_activity_logs for auditing
            dbModule.insert('user_activity_logs', {
              username: getCurrentUserContext().username || 'ADMIN',
              action_type: 'PO_STATUS_TRANSITION',
              action_details: `PO ${currentPoNo} updated during material receipt save. Weight added: ${totalWeightSum} MT. Total cumulative receipts: ${totalReceivedMt.toFixed(3)} MT / ${contractWeight.toFixed(3)} MT. Transitioned from '${prevTextStatus}' (pending: ${prevPendingStatus}) to '${newStatus}' (pending: ${!isComplete}).`,
              ip_address: 'Client Sync Service'
            }).catch((err) => {
              console.warn("Could not insert PO status transition track in user_activity_logs, skipping:", err);
            });

            await dbModule.update('purchase_master', 'po_id', matchedPo.po_id, {
              pending: !isComplete,
              status: newStatus
            }).catch((err) => console.warn("Failed to update purchase_master status:", err));

            const allSaudas = await dbModule.fetchAll('sauda_master').catch(() => []);
            const matchedSauda = allSaudas.find((s: any) => {
              const saudaPoNo = `PO-${s.sauda_no}/${s.financial_year ? s.financial_year.split('-')[1].substring(2) : '26'}`.toUpperCase();
              return saudaPoNo === currentPoNo || String(s.sauda_no) === currentPoNo.replace(/[^0-9]/g, '');
            });

            if (matchedSauda) {
              await dbModule.update('sauda_master', 'sauda_id', matchedSauda.sauda_id, {
                status: newStatus
              }).catch((err) => console.warn("Failed to update sauda_master status:", err));
            }
          }
        } catch (err) {
          console.warn("Error running PO/Sauda status trigger logic:", err);
        }
      }

      localStorage.removeItem('amad_draft_form');
      localStorage.removeItem('amad_draft_details');
      window.dispatchEvent(new CustomEvent('app-data-updated'));
      window.dispatchEvent(new CustomEvent('storage'));
      onSave?.(payload);
    } catch (e: any) {
      console.error(e);
      alert("Error saving Arrival voucher: " + (e.message || "Could not write transaction."));
    } finally {
      setLoading(false);
    }
  };

  return (
    
    <LegacyLayout title="Temporary M.R" subtitle="ARRIVAL WORKSTATION" onClose={onCancel}>
      <div className="flex-1 flex flex-col font-sans text-slate-800 space-y-5">
        <div className="relative px-6 py-4 bg-[#174C2C] border border-[#0F351E] rounded-xl flex items-center justify-between shrink-0 shadow-md overflow-hidden w-full text-white">
          {/* Background Mill Illustration Artwork on the Right with light opacity */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 pointer-events-none bg-no-repeat bg-right bg-contain filter brightness-200"
            style={{ backgroundImage: `url('https://res.cloudinary.com/x6tw39wi/image/upload/v1785928946/icon_vffvx9.png')` }}
          />

          <div className="relative z-10 flex flex-col gap-1">
            <h2 className="font-serif font-black text-2xl text-amber-300 tracking-tight leading-none">
              New Arrival
            </h2>
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

        {/* ================= Receipt Voucher Info ================= */}
        <div className="w-full rounded-xl border border-[#174C2C] bg-white shadow-xs overflow-visible relative z-30 mt-3">
          {/* Header */}
          <div className="px-4 py-1.5 bg-[#174C2C] border-b border-[#0F351E] rounded-t-[11px]">
            <h2 className="text-xs font-bold text-white tracking-wide uppercase">
              Receipt Voucher Info
            </h2>
          </div>
          {/* Body */}
          <div className="p-3">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6 gap-y-1.5">

              {/* LEFT COLUMN */}
              <div className="space-y-1.5">

                {/* Temporary M.R No. */}
                <div className="flex items-center gap-2">
                  <label htmlFor="arrival_no_1077" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Temporary M.R No.
                  </label>
                  <input
                    id="arrival_no_1077" aria-label="Temporary M.R No."
                    type="text"
                    name="arrival_no"
                    value={formData.arrival_no}
                    onChange={handleChange}
                    className="flex-1 border border-sky-300 rounded bg-[#EAF4FF] text-sky-950 px-2 h-7 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>

                {/* P.O Number */}
                <div className="flex items-center gap-2 relative">
                  <label htmlFor="po_no_1094" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    P.O. Number <span className="text-rose-600 font-black">*</span>
                  </label>

                  <div className="flex-1 flex gap-1 relative overflow-visible">
                    <div className="flex-1 flex relative">
                      <input
                        id="po_no_1094" aria-label="P.O. Number"
                        type="text"
                        name="po_no"
                        required
                        value={formData.po_no}
                        onChange={(e) => {
                          handleChange(e);
                          setShowPoDropdown(true);
                        }}
                        onFocus={() => {
                          setShowPoDropdown(true);
                          fetchPurchaseOrders();
                        }}
                        onBlur={() => setTimeout(() => setShowPoDropdown(false), 200)}
                        autoComplete="off"
                        placeholder="-- TYPE OR SELECT P.O. * --"
                        className="w-full border-2 border-rose-300 rounded bg-[#FFECEC] text-slate-900 px-2.5 h-7 font-bold uppercase font-mono text-[11px] pr-7 focus:border-rose-500 focus:outline-none"
                      />

                      <div
                        className="absolute right-0 top-0 bottom-0 w-7 flex items-center justify-center cursor-pointer text-gray-500 hover:text-black"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const nextState = !showPoDropdown;
                          setShowPoDropdown(nextState);
                          if (nextState) fetchPurchaseOrders();
                        }}
                      >
                        <ChevronDown size={14} />
                      </div>
                    </div>

                    {(() => {
                      const cleanEntered = String(formData.po_no || '').trim().toUpperCase();
                      const closedItem = closedSaudaMap.get(cleanEntered);
                      if (closedItem && !initialData) {
                        return (
                          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-1 rounded">
                            <Lock className="w-3 h-3 text-amber-700 shrink-0" />
                            <span>Sauda #{closedItem.po_no} is CLOSED ({closedItem.receivedLorries}/{closedItem.contractLorries} Lorries Received). Reopen by Admin or Level 4 User is required.</span>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {showPoDropdown && (
                      <div className="absolute top-8 left-0 min-w-0 sm:min-w-[320px] w-full max-w-[calc(100vw-32px)] sm:max-w-[480px] bg-white border-2 border-indigo-600 rounded-lg shadow-2xl max-h-56 overflow-y-auto z-[9999]">
                        {purchaseOrders.length === 0 ? (
                          <div className="p-3 text-xs text-gray-500 italic text-center">
                            No active P.O. records found in sauda_check_point
                          </div>
                        ) : (
                          (() => {
                            const filteredList = purchaseOrders.filter(po => {
                              if (!formData.po_no) return true;
                              const search = formData.po_no.toLowerCase().trim();
                              const poNo = String(po.po_no || '').toLowerCase();
                              const supp = String(po.supplier || po.party_name || po.merchant || '').toLowerCase();
                              const brok = String(po.broker || '').toLowerCase();
                              return poNo.includes(search) || supp.includes(search) || brok.includes(search);
                            });

                            if (filteredList.length === 0) {
                              const searchUpper = (formData.po_no || '').trim().toUpperCase();
                              const closedMatch = Array.from(closedSaudaMap.values()).find(
                                c => c.po_no.toUpperCase().includes(searchUpper) || (c.sauda_no && String(c.sauda_no).toUpperCase().includes(searchUpper))
                              );

                              if (closedMatch) {
                                return (
                                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs space-y-1">
                                    <div className="flex items-center gap-1.5 font-bold text-amber-950">
                                      <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                      <span>Sauda #{closedMatch.po_no} is CLOSED</span>
                                    </div>
                                    <p className="text-[11px] text-amber-900 leading-snug">
                                      All {closedMatch.contractLorries} contracted {closedMatch.contractLorries === 1 ? 'lorry has' : 'lorries have'} been received ({closedMatch.receivedLorries}/{closedMatch.contractLorries}).
                                    </p>
                                    <p className="text-[10px] font-semibold text-rose-800 bg-white/80 p-1.5 rounded border border-rose-200">
                                      🔒 Closed Saudas are NOT shown for Temporary Arrival. An Admin or Level 4 user must Reopen this Sauda in Sauda Check Point to record further arrivals.
                                    </p>
                                  </div>
                                );
                              }

                              return (
                                <div className="p-3 text-xs text-gray-500 italic text-center">
                                  No matching active P.O. found for "{formData.po_no}"
                                </div>
                              );
                            }

                            return filteredList.map(po => (
                              <div 
                                key={po.po_id || po.po_no} 
                                className="px-2.5 py-1.5 text-xs font-mono cursor-pointer hover:bg-indigo-50 hover:text-indigo-900 uppercase border-b border-gray-100 last:border-b-0 transition-colors"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    const poSupplier = (po.supplier || po.party_name || po.merchant || '').toUpperCase();
                                    const poBroker = (po.broker || '').toUpperCase();
                                    const poChallanSupplier = (po.challan_supplier || poSupplier).toUpperCase();
                                    const poArea = (po.area || '').toUpperCase();

                                    setFormData(prev => {
                                      const updated = {
                                        ...prev,
                                        po_no: po.po_no,
                                        supplier: poSupplier || prev.supplier,
                                        challan_supplier: poChallanSupplier || poSupplier || prev.challan_supplier,
                                        broker: poBroker || prev.broker,
                                        arrival_area_name: poArea || prev.arrival_area_name,
                                        jci: 'No'
                                      };

                                      const matchedArea = areas.find((a: any) => String(a.area_name).trim().toUpperCase() === poArea);
                                      if (matchedArea) {
                                        updated.arrival_area_code = matchedArea.area_code;
                                      }
                                      if (po.purchase_unit_code) updated.unit_code = po.purchase_unit_code;
                                      if (po.purchase_unit_name) updated.unit_name = po.purchase_unit_name;
                                      if (po.ptf_no || po.is_ptf) updated.ptf = 'Yes';

                                      return updated;
                                    });

                                    loadDetailsFromPo(po.po_no);
                                    setShowPoDropdown(false);
                                }}
                              >
                                <div className="flex items-center justify-between font-bold text-indigo-950">
                                  <span className="flex items-center gap-1.5">
                                    P.O. #{po.po_no}
                                    {po.is_reopened ? (
                                      <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-sans font-bold flex items-center gap-0.5">
                                        <Unlock className="w-2.5 h-2.5 text-amber-700" />
                                        <span>REOPENED ({po.received_lorries || 0}/{po.contract_lorries || 1} Lorry)</span>
                                      </span>
                                    ) : (
                                      <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-sans normal-case">
                                        Sauda Check Point
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-[10px] text-gray-500 font-normal">{po.po_date || ''}</span>
                                </div>
                                <div className="text-[11px] text-gray-600 flex items-center justify-between gap-2 mt-0.5">
                                  <span className="truncate">Supp: <strong className="text-gray-800">{po.supplier || po.party_name || po.merchant || 'N/A'}</strong></span>
                                  <span className="shrink-0 font-semibold text-emerald-700">{po.total_contract_mt || po.quantity || 0} MT</span>
                                </div>
                              </div>
                            ));
                          })()
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Receipt Date */}
                <div className="flex items-center gap-2">
                  <label htmlFor="date_1140" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Temporary Date <span className="text-rose-600 font-black">*</span>
                  </label>

                  <div className="flex-1 flex gap-2">
                    <input
                      id="date_1140" aria-label="Receipt Date"
                      type="date"
                      name="date"
                      required
                      value={formData.date}
                      onChange={handleChange}
                      className="flex-1 border-2 border-rose-300 rounded bg-[#FFECEC] text-slate-900 px-2 h-7 text-xs font-bold focus:border-rose-500 focus:outline-none"
                    />

                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-red-700 text-[10px]">J.C.I</span>

                      <select
                        id="jci_1151" aria-label="jci"
                        name="jci"
                        value={formData.jci}
                        onChange={handleChange}
                        className="border border-gray-400 rounded bg-white px-1.5 h-7 text-xs font-bold"
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Challan Supplier */}
                <div className="flex items-center gap-2">
                  <label htmlFor="challan_supplier_1171" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Challan Supplier
                  </label>

                  <div className="flex-1">
                    <input
                      id="challan_supplier_1171" aria-label="Challan Supplier"
                      type="text"
                      name="challan_supplier"
                      value={formData.challan_supplier}
                      onChange={handleChange}
                      list="challan_supplier_list"
                      placeholder="-- TYPE OR SELECT CHALLAN SUPPLIER --"
                      className={`w-full border rounded px-2.5 h-7 uppercase font-bold font-mono text-[11px] ${
                        formData.challan_supplier ? 'bg-[#EAF4FF] border-sky-300 text-sky-950' : 'bg-white border-gray-400'
                      }`}
                    />

                    <datalist id="challan_supplier_list">
                      {suppliers.map((s) => (
                        <option key={s.id || s.supp_name} value={s.supp_name}>
                          {s.supp_name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Supplier */}
                <div className="flex items-center gap-2">
                  <label htmlFor="supplier_1198" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Supplier
                  </label>

                  <div className="flex-1">
                    <input
                      id="supplier_1198" aria-label="Supplier"
                      type="text"
                      name="supplier"
                      value={formData.supplier}
                      onChange={handleChange}
                      list="supplier_list"
                      placeholder="-- TYPE OR SELECT ACTUAL SUPPLIER --"
                      className={`w-full border rounded px-2.5 h-7 uppercase font-bold font-mono text-[11px] ${
                        formData.supplier ? 'bg-[#EAF4FF] border-sky-300 text-sky-950' : 'bg-white border-gray-400'
                      }`}
                    />

                    <datalist id="supplier_list">
                      {suppliers.map((s) => (
                        <option key={s.id || s.supp_name} value={s.supp_name}>
                          {s.supp_name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN */}
              <div className="space-y-1.5">

                {/* Broker */}
                <div className="flex items-center gap-2">
                  <label htmlFor="broker_1230" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Broker
                  </label>

                  <div className="flex-1">
                    <input
                      id="broker_1230" aria-label="Broker"
                      type="text"
                      name="broker"
                      value={formData.broker}
                      onChange={handleChange}
                      list="broker_list"
                      placeholder="-- TYPE OR SELECT BROKER --"
                      className={`w-full border rounded px-2.5 h-7 uppercase font-bold font-mono text-[11px] ${
                        formData.broker ? 'bg-[#EAF4FF] border-sky-300 text-sky-950' : 'bg-white border-gray-400'
                      }`}
                    />

                    <datalist id="broker_list">
                      <option value="DIRECT" />
                      {brokers.map((b) => (
                        <option key={b.id || b.brok_name} value={b.brok_name}>
                          {b.brok_name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Transporter */}
                <div className="flex items-center gap-2">
                  <label htmlFor="transporter_name_1257" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Transporter Name
                  </label>

                  <input
                    id="transporter_name_1257" aria-label="Transporter Name"
                    type="text"
                    name="transporter_name"
                    value={formData.transporter_name}
                    onChange={handleChange}
                    className="flex-1 border border-gray-400 rounded bg-white px-2.5 h-7 text-xs font-bold"
                  />
                </div>

                {/* Challan */}
                <div className="flex items-center gap-2">
                  <label htmlFor="challan_rr_no_1272" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Challan No & Date / R.R. No.
                  </label>

                  <input
                    id="challan_rr_no_1272" aria-label="Challan / R.R. No."
                    type="text"
                    name="challan_rr_no"
                    value={formData.challan_rr_no}
                    onChange={handleChange}
                    className="flex-1 border border-gray-400 rounded bg-white px-2.5 h-7 text-xs font-bold"
                  />
                </div>

                {/* Lorry */}
                <div className="flex items-center gap-2">
                  <label htmlFor="lorry_prefix_1288" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Lorry Number
                  </label>

                  <div className="flex-1 flex gap-1.5">
                    <input
                      id="lorry_prefix_1288" aria-label="Lorry Number"
                      type="text"
                      name="lorry_prefix"
                      value={formData.lorry_prefix}
                      onChange={handleChange}
                      placeholder="PREFIX"
                      className="w-24 text-center uppercase border border-gray-400 rounded h-7 text-xs font-bold"
                    />

                    <input
                      id="lorry_suffix_1297" aria-label="SUFFIX"
                      type="text"
                      name="lorry_suffix"
                      value={formData.lorry_suffix}
                      onChange={handleChange}
                      placeholder="SUFFIX"
                      className="flex-1 text-center uppercase border border-gray-400 rounded h-7 text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Pan */}
                <div className="flex items-center gap-2">
                  <label htmlFor="pan_no_1314" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Pan No.
                  </label>

                  <input
                    id="pan_no_1314" aria-label="Pan No."
                    type="text"
                    name="pan_no"
                    value={formData.pan_no}
                    onChange={handleChange}
                    className="flex-1 border border-gray-400 rounded bg-white px-2.5 h-7 text-xs font-bold font-mono"
                  />
                </div>

                {/* Arrival Date */}
                <div className="flex items-center gap-2">
                  <label htmlFor="lorry_date_1329" className="w-36 text-[10px] font-bold text-gray-800 shrink-0">
                    Lorry Arrival Date
                  </label>

                  <input
                    id="lorry_date_1329" aria-label="Lorry Arrival Date"
                    type="date"
                    name="lorry_date"
                    value={formData.lorry_date}
                    onChange={handleChange}
                    className="flex-1 border border-gray-400 rounded bg-white px-2 h-7 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-[#174C2C]"
                  />
                </div>

              </div>

            </div>
          </div>
        </div>

        {/* ===========================Transport & Document Info=========================== */}
        <div className="w-full rounded-xl border border-[#174C2C] bg-white shadow-xs overflow-visible relative z-10 mt-3">

          {/* Header */}
          <div className="bg-[#174C2C] px-4 py-1.5 rounded-t-[11px]">
            <h3 className="text-white text-xs font-bold tracking-wide uppercase">
              Transport & Document Information
            </h3>
          </div>

          {/* Body */}
          <div className="p-3">

            <div className="grid grid-cols-2 gap-x-6 gap-y-2">

              {/* ================= LEFT ================= */}
              <div className="space-y-1.5">

                {/* Consignment */}
                <div>
                  <label htmlFor="consignment_note_no_1368" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    Consignment Note No.
                  </label>

                  <input
                    id="consignment_note_no_1368" aria-label="Consignment Note No."
                    type="text"
                    name="consignment_note_no"
                    value={formData.consignment_note_no}
                    onChange={handleChange}
                    readOnly={formData.jci === 'No'}
                    className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
                  />
                </div>

                {/* DI */}
                <div>
                  <label htmlFor="di_no_1385" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    D.I. Details
                  </label>

                  <div className="grid grid-cols-2 gap-2">

                    <input
                      id="di_no_1385" aria-label="D.I. Details"
                      type="text"
                      name="di_no"
                      placeholder="DI Number"
                      value={formData.di_no}
                      onChange={handleChange}
                      readOnly={formData.jci === 'No'}
                      className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
                      //className="h-7 rounded border border-gray-300 px-2 text-xs font-semibold"
                    />

                    <input
                      id="di_date_1394" aria-label="di date"
                      type="date"
                      name="di_date"
                      value={formData.di_date}
                      onChange={handleChange}
                      //className="h-7 rounded border border-gray-300 px-2 text-xs"
                      readOnly={formData.jci === 'No'}
                      className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
                    />

                  </div>
                </div>

                {/* Invoice */}
                <div>
                  <label htmlFor="invoice_no_1413" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    Invoice Details
                  </label>

                  <div className="grid grid-cols-2 gap-2">

                    <input
                      id="invoice_no_1413" aria-label="Invoice Details"
                      type="text"
                      name="invoice_no"
                      placeholder="Invoice Number"
                      value={formData.invoice_no}
                      onChange={handleChange}
                      readOnly={formData.jci === 'No'}
                      className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
                      //className="h-7 rounded border border-gray-300 px-2 text-xs font-semibold"
                    />

                    <input
                      id="invoice_date_1422" aria-label="invoice date"
                      type="date"
                      name="invoice_date"
                      value={formData.invoice_date}
                      onChange={handleChange}
                      readOnly={formData.jci === 'No'}
                      className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
                      //className="h-7 rounded border border-gray-300 px-2 text-xs"
                    />

                  </div>
                </div>

                {/* PTF */}
                <div>
                  <label htmlFor="ptf_1439" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    P.T.F
                  </label>

                  <select
                    id="ptf_1439" aria-label="P.T.F"
                    name="ptf"
                    value={formData.ptf}
                    onChange={handleChange}
                    className="w-full h-7 rounded border border-gray-300 px-2 text-xs font-semibold"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

                {/* Lorry */}
                <div>
                  <label htmlFor="lorry_returned_1458" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    Lorry Returned
                  </label>

                  <div className="grid grid-cols-2 gap-2">

                    <select
                      id="lorry_returned_1458" aria-label="Lorry Returned"
                      name="lorry_returned"
                      value={formData.lorry_returned}
                      onChange={handleChange}
                      className="h-7 rounded border border-gray-300 px-2 text-xs font-semibold"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>

                    <select
                      id="lorry_returned_other_mill_1468" aria-label="lorry returned other mill"
                      name="lorry_returned_other_mill"
                      value={formData.lorry_returned_other_mill}
                      onChange={handleChange}
                      className="h-7 rounded border border-gray-300 px-2 text-xs font-semibold"
                    >
                      <option value="No">Ret. Other Mill : No</option>
                      <option value="Yes">Ret. Other Mill : Yes</option>
                    </select>

                  </div>
                </div>

                {/* Arrival Area */}
                <div>
                  <label htmlFor="arrival_area_code_1489" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    Arrival Area
                  </label>

                  <div className="flex gap-2">

                    <input
                      id="arrival_area_code_1489" aria-label="Arrival Area"
                      type="text"
                      name="arrival_area_code"
                      value={formData.arrival_area_code}
                      readOnly
                      className="w-16 h-7 rounded border border-gray-300 bg-slate-100 text-center text-xs font-bold"
                    />

                    <select
                      id="arrival_area_name_1497" aria-label="arrival area name"
                      name="arrival_area_name"
                      value={formData.arrival_area_name}
                      onChange={(e) => {
                        const matchedArea = areas.find(
                          a => a.area_name === e.target.value
                        );

                        setFormData(prev => ({
                          ...prev,
                          arrival_area_name: e.target.value,
                          arrival_area_code: matchedArea
                            ? matchedArea.area_code
                            : prev.arrival_area_code
                        }));
                      }}
                      className="flex-1 h-7 rounded border border-gray-300 px-2 text-xs font-semibold"
                    >
                      <option value="">-- SELECT AREA --</option>

                      {areas.map(a => (
                        <option key={a.id} value={a.area_name}>
                          {a.area_name}
                        </option>
                      ))}
                    </select>

                  </div>
                </div>

              </div>

              {/* ================= RIGHT ================= */}

              <div className="space-y-1.5">

                {/* Unit */}
                <div>
                  <label htmlFor="unit_code_1541" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    Unit
                  </label>

                  <div className="flex gap-2">

                    <input
                      id="unit_code_1541" aria-label="Unit"
                      type="text"
                      name="unit_code"
                      value={formData.unit_code}
                      readOnly
                      className="w-16 h-7 rounded border border-gray-300 bg-slate-100 text-center text-xs font-bold"
                    />

                    <select
                      id="unit_name_1549" aria-label="unit name"
                      name="unit_name"
                      value={formData.unit_name || "BALES"}
                      onChange={(e) => {
                        const uVal = e.target.value;

                        const codeMap = {
                          BALES: "I",
                          LOOSE: "II",
                          DRUMS: "2",
                          "P.BALES": "4",
                          "H.BALES": "5",
                        };

                        setFormData(prev => ({
                          ...prev,
                          unit_name: uVal,
                          unit_code:
                            codeMap[uVal] ||
                            prev.unit_code ||
                            "1",
                        }));
                      }}
                      className="flex-1 h-7 rounded border border-gray-300 px-2 text-xs font-semibold"
                    >
                      {Array.from(
                        new Set(
                          [...unitList, formData.unit_name].filter(Boolean)
                        )
                      ).map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>

                  </div>
                </div>

                {/* Way Bill */}
                <div>
                  <label htmlFor="way_bill_no_1596" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    Way Bill
                  </label>

                  <div className="grid grid-cols-2 gap-2">

                    <input
                      id="way_bill_no_1596" aria-label="Way Bill"
                      type="text"
                      name="way_bill_no"
                      value={formData.way_bill_no}
                      onChange={handleChange}
                      placeholder="Way Bill No."
                      //className="h-7 rounded border border-gray-300 px-2 text-xs font-semibold"
                      readOnly={formData.jci === 'No'}
                      className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
                    />

                    <input
                      id="way_bill_date_1605" aria-label="way bill date"
                      type="date"
                      name="way_bill_date"
                      value={formData.way_bill_date}
                      onChange={handleChange}
                      //className="h-7 rounded border border-gray-300 px-2 text-xs"
                      readOnly={formData.jci === 'No'}
                      className={`w-full h-7 rounded border px-2 text-xs font-semibold outline-none ${formData.jci === 'No'? "bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed": "border-gray-300 focus:border-[#174C2C]"  }`}
                    />

                  </div>
                </div>

                {/* APMC */}
                <div>
                  <label htmlFor="apmc_fees_1622" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    A.P.M.C Fees (Rs.) 
                  </label>

                  <input
                    id="apmc_fees_1622" aria-label="A.P.M.C Fees (Rs.)"
                    type="number"
                    step="0.01"
                    min="0"
                    name="apmc_fees"
                    placeholder="0.00"
                    value={formData.apmc_fees !== undefined && formData.apmc_fees !== null ? formData.apmc_fees : ""}
                    onChange={handleChange}
                    className="w-full h-7 rounded border border-gray-300 px-2 text-right text-xs font-bold focus:border-[#174C2C]"
                  />
                </div>

                {/* Remarks */}
                <div>
                  <label htmlFor="remarks_1638" className="block text-[10px] font-bold text-gray-700 mb-0.5">
                    Remarks
                  </label>

                  <textarea
                    id="remarks_1638" aria-label="Remarks"
                    name="remarks"
                    rows={2}
                    value={formData.remarks}
                    onChange={handleChange}
                    placeholder="Enter Remarks..."
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-semibold resize-none h-14"
                  />
                </div>

              </div>

            </div>

          </div>

        </div>

        {/* ===========================Receipt Grade Details=========================== */}
        <div className="w-full rounded-xl border border-[#174C2C] bg-white shadow-md overflow-hidden mt-5">

          {/* Header */}
          <div className="bg-[#174C2C] px-5 py-3 flex items-center justify-between">
            <h3 className="text-white text-sm font-bold tracking-wide">
              Receipt Grade Details
            </h3>
            <span className="text-[11px] text-green-100 font-medium">
              Grade / Agency / Marka / Quantity Information
            </span>
          </div>
          {/* Body */}
          <div className="p-4 bg-[#F8FAFC]">
            <div className="flex items-center justify-between p-1.5 bg-[#174C2C] border-b border-slate-300">
             <span className="text-[10px] font-bold uppercase text-slate-700"></span>
             <div className="flex items-center gap-1.5">
                <button
                   type="button"
                   onClick={handleAddRow}
                   className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-2 py-0.5 text-[10px] rounded flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                >
                   + Spawn Row
                </button>
                <button
                   type="button"
                   onClick={handleDeleteRow}
                   className="bg-rose-700 hover:bg-rose-800 text-white font-bold px-2 py-0.5 text-[10px] rounded flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                >
                   - Delete Row
                </button>
             </div>
          </div>
          <div className="w-full overflow-x-auto">
          <table className="w-full table-fixed min-w-[950px] border-collapse text-left text-[11px] font-sans">
            <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm">
              <tr className="bg-slate-800 text-white font-bold uppercase text-[9px]/tight text-center">
                <th className="p-1 border border-gray-400 w-10 shrink-0" rowSpan={2}>Srl</th>
                <th className="p-1 border border-gray-400 text-center w-52" colSpan={2}>Receipt Grade</th>
                <th className="p-1 border border-gray-400 w-24" rowSpan={2}>Crop Year</th>
                <th className="p-1 border border-gray-400 w-28" rowSpan={2}>Challan Grade</th>
                <th className="p-1 border border-gray-400 text-center w-48" colSpan={2}>Agency</th>
                <th className="p-1 border border-gray-400 text-center w-48" colSpan={2}>Challan Marka</th>
                <th className="p-1 border border-gray-400 w-24" rowSpan={2}>Netto (M.T)</th>
                <th className="p-1 border border-gray-400 w-32" colSpan={2}>Quantity</th>
                <th className="p-1 border border-gray-400 w-36" rowSpan={2}>Remarks</th>
              </tr>
              <tr className="bg-slate-200 text-black font-extrabold text-[8px] text-center border-b border-gray-400">
                <th className="p-0.5 border border-gray-400 w-16">Code</th>
                <th className="p-0.5 border border-gray-400 w-36">Name</th>
                <th className="p-0.5 border border-gray-400 w-14">Code</th>
                <th className="p-0.5 border border-gray-400 w-34">Name</th>
                <th className="p-0.5 border border-gray-400 w-14">Code</th>
                <th className="p-0.5 border border-gray-400 w-34">Name</th>
                <th className="p-0.5 border border-gray-400 w-16">Chln</th>
                <th className="p-0.5 border border-gray-400 w-16">Rcpt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {details.map((detail, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors h-7 text-[10.5px]">
                  {/* Srl */}
                  <td className="p-1 text-center font-bold text-gray-900 border border-gray-300 bg-slate-100 w-10">{detail.srl_no}</td>

                  {/* Receipt Grade Code */}
                  <td className="p-0.5 border border-gray-300 w-16 bg-slate-50 text-center">
                    <input
 id="field_1721" name="field" aria-label="--"                      type="text"
                      value={detail.receipt_grade_code}
                      readOnly
                      placeholder="--"
                      className="w-full bg-transparent border-0 p-0 text-center font-bold text-gray-800 outline-none"
                    />
                  </td>

                  {/* Receipt Grade Name */}
                  <td className="p-0.5 border border-gray-300 w-36">
                    <select
 id="detail_receipt_grade_name_1732" name="detail_receipt_grade_name" aria-label="detail receipt grade name"                      value={detail.receipt_grade_name}
                      onChange={(e) => handleDetailChange(idx, 'receipt_grade_name', e.target.value)}
                      className="w-full bg-white border border-gray-300 p-0 text-left font-bold text-gray-900 outline-none h-6"
                    >
                      <option value=""></option>
                      {detail.receipt_grade_name && !grades.some(g => g.grade_name === detail.receipt_grade_name) && (
                        <option value={detail.receipt_grade_name}>{detail.receipt_grade_name}</option>
                      )}
                      {grades.map(g => (
                        <option key={g.id || g.grade_code} value={g.grade_name}>{g.grade_name}</option>
                      ))}
                    </select>
                  </td>

                  {/* Crop Year */}
                  <td className="p-0.5 border border-gray-300 w-24">
                    <select  id="detail_crop_year_1749" name="detail_crop_year" aria-label="detail crop year"
                      value={detail.crop_year} 
                      onChange={(e) => handleDetailChange(idx, 'crop_year', e.target.value)}
                      className="w-full bg-white border border-gray-300 p-0 text-center font-bold text-gray-900 outline-none h-6 text-xs" 
                    >
                      <option value=""></option>
                      {detail.crop_year && !['2024-25', '2025-26', '2026-27', '2027-28', '2028-29'].includes(detail.crop_year) && (
                        <option value={detail.crop_year}>{detail.crop_year}</option>
                      )}
                      <option value="2024-25">2024-25</option>
                      <option value="2025-26">2025-26</option>
                      <option value="2026-27">2026-27</option>
                      <option value="2027-28">2027-28</option>
                      <option value="2028-29">2028-29</option>
                    </select>
                  </td>

                  {/* Challan Grade Name */}
                  <td className="p-0.5 border border-gray-300 w-28">
                    <input  id="detail_challan_grade_name_1768" name="detail_challan_grade_name" aria-label="detail challan grade name"
                      type="text" 
                      value={detail.challan_grade_name} 
                      onChange={(e) => handleDetailChange(idx, 'challan_grade_name', e.target.value)}
                      className="w-full bg-transparent border-0 p-0 outline-none px-1" 
                    />
                  </td>

                  {/* Agency Code */}
                  <td className="p-0.5 border border-gray-300 w-14 bg-slate-50 text-center">
                    <input
 id="field_1778" name="field" aria-label="--"                      type="text"
                      value={detail.agency_code || ''}
                      onChange={(e) => handleDetailChange(idx, 'agency_code', e.target.value)}
                      placeholder="--"
                      className="w-full bg-transparent border-0 p-0 text-center font-bold text-gray-800 outline-none uppercase font-mono"
                    />
                  </td>

                  {/* Agency Name */}
                  <td className="p-0.5 border border-gray-300 w-34">
                    <input
 id="type_select_agency_1789" name="type_select_agency" aria-label="Type/Select Agency..."                      type="text"
                      list="agencies_list"
                      placeholder="Type/Select Agency..."
                      value={detail.agency_name || ''}
                      onChange={(e) => handleDetailChange(idx, 'agency_name', e.target.value)}
                      className="w-full bg-white text-left font-bold text-gray-900 outline-none px-1 h-6 uppercase font-mono border-0"
                    />
                  </td>

                  {/* Challan Marka Code */}
                  <td className="p-0.5 border border-gray-300 w-14 bg-slate-50 text-center">
                    <input
 id="field_1801" name="field" aria-label="--"                      type="text"
                      value={detail.challan_marka_code}
                      readOnly
                      placeholder="--"
                      className="w-full bg-transparent border-0 p-0 text-center font-bold text-gray-800 outline-none"
                    />
                  </td>

                  {/* Challan Marka Name */}
                  <td className="p-0.5 border border-gray-300 w-34">
                    <input
 id="type_select_marka_1812" name="type_select_marka" aria-label="Type/Select Marka..."                      type="text"
                      list="markas_list"
                      placeholder="Type/Select Marka..."
                      value={detail.challan_marka_name || ''}
                      onChange={(e) => handleDetailChange(idx, 'challan_marka_name', e.target.value)}
                      className="w-full bg-white text-left font-bold text-gray-900 outline-none px-1 h-6 uppercase font-mono border-0"
                    />
                  </td>

                  {/* Netto Pnto */}
                  <td className="p-0.5 border border-gray-300 w-24">
                    {(() => {
                      const rowUnit = (detail.unit || formData.unit_name || 'BALES' ||'DRUMS' ).toString().trim().toUpperCase();
                      const isBales = rowUnit === 'BALES' || rowUnit.includes('BALE') || rowUnit === 'DRUMS' || rowUnit.includes('DRUM');
                      //const isDrumss = rowUnit === 'DRUMS' || rowUnit.includes('DRUM');
                      return (
                        <input  id={`netto_pnto_main_${idx}`} name={`netto_pnto_main_${idx}`} aria-label="Netto M.T"
                          type="number" 
                          step="0.001"
                          placeholder="0.000"
                          readOnly={isBales }
                          value={detail.netto_pnto !== undefined && detail.netto_pnto !== null ? detail.netto_pnto : 0} 
                          onChange={(e) => {
                            if (!isBales) {
                              const val = e.target.value;
                              handleDetailChange(idx, 'netto_pnto', val === '' ? 0 : Number(val));
                            }
                          }}
                          title={isBales ? "Auto-calculated: (RCPT / Total RCPT) * Final Weight" : "Enter Netto Weight"}
                          className={cn(
                            "w-full p-0 text-right font-bold outline-none pr-1 transition-colors",
                            isBales
                              ? "bg-amber-50/90 border border-amber-300 text-amber-950 cursor-not-allowed"
                              : "bg-white border border-gray-300 text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                          )}
                        />
                      );
                    })()}
                  </td>

                  {/* Quantity Chln */}
                  <td className="p-0.5 border border-gray-300 w-16">
                    <input  id="0_1839" name="0" aria-label="0"
                      type="number" 
                      step="1"
                      placeholder="0"
                      value={detail.quantity_chln !== undefined && detail.quantity_chln !== null ? detail.quantity_chln : 0} 
                      onChange={(e) => {
                        const val = e.target.value;
                        handleDetailChange(idx, 'quantity_chln', val === '' ? 0 : Number(val));
                      }}
                      className="w-full bg-white border border-blue-200 p-0 text-center font-bold text-blue-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" 
                    />
                  </td>

                  {/* Quantity Rcpt */}
                  <td className="p-0.5 border border-gray-300 w-16">
                    <input  id="0_1854" name="0" aria-label="0"
                      type="number" 
                      step="1"
                      placeholder="0"
                      value={detail.quantity_rcpt !== undefined && detail.quantity_rcpt !== null ? detail.quantity_rcpt : 0} 
                      onChange={(e) => {
                        const val = e.target.value;
                        handleDetailChange(idx, 'quantity_rcpt', val === '' ? 0 : Number(val));
                      }}
                      className="w-full bg-white border border-indigo-200 p-0 text-center font-bold text-indigo-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600" 
                    />
                  </td>

                  {/* Remarks */}
                  <td className="p-0.5 border border-gray-300 w-36">
                    <input  id="detail_remarks_1869" name="detail_remarks" aria-label="detail remarks"
                      type="text" 
                      value={detail.remarks} 
                      onChange={(e) => handleDetailChange(idx, 'remarks', e.target.value)}
                      className="w-full bg-transparent border-0 p-0 text-left outline-none px-1" 
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </div>

        </div>

        {/* ================= Weight Information ================= */}
        <div className="w-full rounded-xl border border-[#174C2C] bg-white shadow-md overflow-hidden mt-5">

          {/* Header */}
          <div className="bg-[#174C2C] text-white px-4 py-2 border-b border-[#0F351E]">
            <h3 className="text-sm font-bold tracking-wide uppercase">
              Weight Information
            </h3>
          </div>

          {/* Body */}
          <div className="grid grid-cols-1 lg:grid-cols-3 divide-x divide-gray-300">

            {/* 1st: Gross Weight */}
            <div className="p-3 space-y-2">
              <h4 className="text-[11px] font-bold text-[#174C2C] border-b border-gray-300 pb-1 uppercase">
                Gross Weight
              </h4>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold">CHALLAN GROSS</span>
                <input
                  id="actual_gross_weight_1948"
                  aria-label="actual gross weight"
                  type="number"
                  step="0.001"
                  name="actual_gross_weight"
                  value={formData.actual_gross_weight || ""}
                  onChange={handleChange}
                  className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold">MILL GROSS</span>
                <input
                  id="supplier_challan_gross_1960"
                  aria-label="supplier challan gross"
                  type="number"
                  step="0.001"
                  name="supplier_challan_gross"
                  value={formData.supplier_challan_gross || ""}
                  onChange={handleChange}
                  className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold">ELECTRONIC GROSS</span>
                <input
                  id="electronic_gross_weight_1972"
                  aria-label="electronic gross weight"
                  type="number"
                  step="0.001"
                  name="electronic_gross_weight"
                  value={formData.electronic_gross_weight || ""}
                  onChange={handleChange}
                  className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
                />
              </div>
            </div>

            {/* 2nd: Tare Weight */}
            <div className="p-3 space-y-2">
              <h4 className="text-[11px] font-bold text-[#174C2C] border-b border-gray-300 pb-1 uppercase">
                Tare Weight
              </h4>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold">CHALLAN TARE</span>
                <input
                  id="actual_tare_weight_1991"
                  aria-label="actual tare weight"
                  type="number"
                  step="0.001"
                  name="actual_tare_weight"
                  value={formData.actual_tare_weight || ""}
                  onChange={handleChange}
                  className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold">MILL TARE</span>
                <input
                  id="supplier_tare_weight_2003"
                  aria-label="supplier tare weight"
                  type="number"
                  step="0.001"
                  name="supplier_tare_weight"
                  value={formData.supplier_tare_weight || ""}
                  onChange={handleChange}
                  className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold">ELECTRONIC TARE</span>
                <input
                  id="electronic_tare_weight_2015"
                  aria-label="electronic tare weight"
                  type="number"
                  step="0.001"
                  name="electronic_tare_weight"
                  value={formData.electronic_tare_weight || ""}
                  onChange={handleChange}
                  className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
                />
              </div>
            </div>

            {/* 3rd: Net Weight */}
            <div className="p-3 space-y-2">
              <h4 className="text-[11px] font-bold text-[#174C2C] border-b border-gray-300 pb-1 uppercase">
                Net Weight
              </h4>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold">CHALLAN WT</span>
                <input
                  id="challan_material_weight_1905"
                  aria-label="challan material weight"
                  type="number"
                  step="0.001"
                  name="challan_material_weight"
                  value={formData.challan_material_weight || 0}
                  onChange={handleChange}
                  className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold">MILL NET</span>
                <input
                  id="supplier_net_weight_1917"
                  aria-label="supplier net weight"
                  type="number"
                  step="0.001"
                  name="supplier_net_weight"
                  value={formData.supplier_net_weight || 0}
                  onChange={handleChange}
                  className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold">ELECTRONIC NET</span>
                <input
                  id="electronic_net_weight_1929"
                  aria-label="electronic net weight"
                  type="number"
                  step="0.001"
                  name="electronic_net_weight"
                  value={formData.electronic_net_weight || 0}
                  onChange={handleChange}
                  className="w-24 h-7 border rounded border-gray-300 bg-white px-2 text-right font-bold font-mono"
                />
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="border-t border-gray-300 bg-gray-50 px-4 py-2 flex justify-center items-center gap-3">
            <span className="text-[11px] font-bold text-[#174C2C] uppercase">
              Final Weight (M.Ton)
            </span>

            <input
 id="weight_reduced_2034" aria-label="final weight"              type="number"
              step="0.001"
              name="weight_reduced"
              value={formData.weight_reduced || ""}
              onChange={handleChange}
              className="w-32 h-8 border border-red-300 rounded bg-white text-right px-2 font-black font-mono text-red-700"
            />
          </div>

        </div>
        

        {/* Bottom Action Bar */}
        <div className="w-full rounded-xl border border-[#174C2C] bg-[#174C2C] shadow-md overflow-hidden mt-5">
          <div className="flex justify-end items-center gap-3">
            <button
              onClick={clearForm}
              className="flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow transition-all duration-200 hover:scale-[1.02] active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              Clear (F2)
            </button>

            <button
              onClick={onCancel}
              className="flex items-center gap-2 h-9 px-5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow transition-all duration-200 hover:scale-[1.02] active:scale-95"
            >
              <X className="w-3.5 h-3.5" />
              Exit (Esc)
            </button>

            <button
              onClick={handleSave}
              disabled={loading}
              className={`flex items-center gap-2 h-9 px-6 rounded-lg text-xs font-semibold shadow transition-all duration-200 active:scale-95 ${
                loading
                  ? "bg-gray-500 text-white cursor-not-allowed"
                  : "bg-[#ffb900] hover:bg-[#e6a700] text-black"
              }`}
            >
              <Save className="w-3.5 h-3.5" />
              {loading ? "SAVING..." : "SAVE ARRIVAL"}
            </button>
          </div>
        </div>

      </div>




      {/* <div ref={amadContainerRef} className="flex flex-col min-h-full gap-3  p-2"> */}
        
        {/* Core Inputs layout styled matching exact SaudaEntry themes */}
        {/* <div className="grid grid-cols-12 gap-3 shrink-0"> */}
          
          {/* Column Group 1 - Primary Details */}
          {/* <div className="col-span-12 lg:col-span-6 flex flex-col gap-2">
            <LegacyFieldset legend="Receipt Voucher Info1">
              <div className="grid grid-cols-12 gap-x-3 gap-y-1.5 text-[11px] items-center">
                
                <span className="col-span-4 font-bold text-gray-800 text-right">Temporary M.R No.</span>
                <input 
                  type="text" 
                  name="arrival_no" 
                  value={formData.arrival_no} 
                  onChange={handleChange}
                  className="col-span-8 border border-gray-400 bg-white px-2 py-0.5 font-bold outline-none h-6" 
                />

                <span className="col-span-4 font-bold text-gray-800 text-right">P.O. Number</span>
                <div className="col-span-8 flex gap-1 relative overflow-visible">
                  <div className="flex-1 flex relative">
                    <input
                      type="text"
                      name="po_no"
                      value={formData.po_no}
                      onChange={(e) => {
                        handleChange(e);
                        setShowPoDropdown(true);
                      }}
                      onFocus={() => {
                        setShowPoDropdown(true);
                        fetchPurchaseOrders();
                      }}
                      onBlur={() => setTimeout(() => setShowPoDropdown(false), 200)}
                      autoComplete="off"
                      placeholder="-- TYPE OR SELECT P.O. --"
                      className="w-full border border-gray-400 bg-white px-2 py-0.5 font-bold outline-none h-6 font-mono text-xs uppercase pr-6"
                    />
                    <div 
                      className="absolute right-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-pointer text-gray-500 hover:text-black"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const nextState = !showPoDropdown;
                        setShowPoDropdown(nextState);
                        if (nextState) fetchPurchaseOrders();
                      }}
                    >
                      <ChevronDown size={14} />
                    </div>
                  </div>

                  {(() => {
                    const cleanEntered = String(formData.po_no || '').trim().toUpperCase();
                    const closedItem = closedSaudaMap.get(cleanEntered);
                    if (closedItem && !initialData) {
                      return (
                        <div className="absolute top-7 left-0 z-10 flex items-center gap-1.5 text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded shadow-sm">
                          <Lock className="w-3 h-3 text-amber-700 shrink-0" />
                          <span>Sauda #{closedItem.po_no} is CLOSED ({closedItem.receivedLorries}/{closedItem.contractLorries} Lorries Received). Reopen by Admin/L4 required.</span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {showPoDropdown && (
                     <div className="absolute top-6 left-0 min-w-[360px] w-full max-w-[480px] bg-white border border-gray-400 max-h-56 overflow-y-auto z-[9999] shadow-2xl rounded border-2 border-indigo-600">
                        {purchaseOrders.length === 0 ? (
                          <div className="p-3 text-xs text-gray-500 italic text-center">
                            No active P.O. records found in purchase_master
                          </div>
                        ) : (
                          (() => {
                            const filteredList = purchaseOrders.filter(po => {
                              if (!formData.po_no) return true;
                              const search = formData.po_no.toLowerCase().trim();
                              const poNo = String(po.po_no || '').toLowerCase();
                              const supp = String(po.supplier || po.party_name || po.merchant || '').toLowerCase();
                              const brok = String(po.broker || '').toLowerCase();
                              return poNo.includes(search) || supp.includes(search) || brok.includes(search);
                            });

                            if (filteredList.length === 0) {
                              const searchUpper = (formData.po_no || '').trim().toUpperCase();
                              const closedMatch = Array.from(closedSaudaMap.values()).find(
                                c => c.po_no.toUpperCase().includes(searchUpper) || (c.sauda_no && String(c.sauda_no).toUpperCase().includes(searchUpper))
                              );

                              if (closedMatch) {
                                return (
                                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs space-y-1">
                                    <div className="flex items-center gap-1.5 font-bold text-amber-950">
                                      <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                                      <span>Sauda #{closedMatch.po_no} is CLOSED</span>
                                    </div>
                                    <p className="text-[11px] text-amber-900 leading-snug">
                                      All {closedMatch.contractLorries} contracted {closedMatch.contractLorries === 1 ? 'lorry has' : 'lorries have'} been received ({closedMatch.receivedLorries}/{closedMatch.contractLorries}).
                                    </p>
                                    <p className="text-[10px] font-semibold text-rose-800 bg-white/80 p-1.5 rounded border border-rose-200">
                                      🔒 Closed Saudas are NOT shown for Temporary Arrival. An Admin or Level 4 user must Reopen this Sauda in Sauda Check Point to record further arrivals.
                                    </p>
                                  </div>
                                );
                              }

                              return (
                                <div className="p-3 text-xs text-gray-500 italic text-center">
                                  No matching active P.O. found for "{formData.po_no}"
                                </div>
                              );
                            }

                            return filteredList.map(po => (
                              <div 
                                 key={po.po_id || po.po_no} 
                                 className="px-2.5 py-1.5 text-xs font-mono cursor-pointer hover:bg-indigo-50 hover:text-indigo-900 uppercase border-b border-gray-100 last:border-b-0 transition-colors"
                                 onMouseDown={(e) => {
                                     e.preventDefault();
                                     const poSupplier = (po.supplier || po.party_name || po.merchant || '').toUpperCase();
                                     const poBroker = (po.broker || '').toUpperCase();
                                     const poChallanSupplier = (po.challan_supplier || poSupplier).toUpperCase();
                                     const poArea = (po.area || '').toUpperCase();

                                     setFormData(prev => {
                                       const updated = {
                                         ...prev,
                                         po_no: po.po_no,
                                         supplier: poSupplier || prev.supplier,
                                         challan_supplier: poChallanSupplier || poSupplier || prev.challan_supplier,
                                         broker: poBroker || prev.broker,
                                         arrival_area_name: poArea || prev.arrival_area_name,
                                         jci: 'No'
                                       };

                                       const matchedArea = areas.find((a: any) => String(a.area_name).trim().toUpperCase() === poArea);
                                       if (matchedArea) {
                                         updated.arrival_area_code = matchedArea.area_code;
                                       }
                                       if (po.purchase_unit_code) updated.unit_code = po.purchase_unit_code;
                                       if (po.purchase_unit_name) updated.unit_name = po.purchase_unit_name;
                                       if (po.ptf_no || po.is_ptf) updated.ptf = 'Yes';

                                       return updated;
                                     });

                                     loadDetailsFromPo(po.po_no);
                                     setShowPoDropdown(false);
                                 }}
                              >
                                 <div className="flex items-center justify-between font-bold text-indigo-950">
                                   <span className="flex items-center gap-1.5">
                                     P.O. #{po.po_no}
                                     {po.is_reopened ? (
                                       <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-sans font-bold flex items-center gap-0.5">
                                         <Unlock className="w-2.5 h-2.5 text-amber-700" />
                                         <span>REOPENED ({po.received_lorries || 0}/{po.contract_lorries || 1} Lorry)</span>
                                       </span>
                                     ) : (
                                       <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-sans normal-case">
                                         Sauda Check Point
                                       </span>
                                     )}
                                   </span>
                                   <span className="text-[10px] text-gray-500 font-normal">{po.po_date || ''}</span>
                                 </div>
                                 <div className="text-[11px] text-gray-600 flex items-center justify-between gap-2 mt-0.5">
                                   <span className="truncate">Supp: <strong className="text-gray-800">{po.supplier || po.party_name || po.merchant || 'N/A'}</strong></span>
                                   <span className="shrink-0 font-semibold text-emerald-700">{po.total_contract_mt || po.quantity || 0} MT</span>
                                 </div>
                              </div>
                            ));
                          })()
                        )}
                     </div>
                  )}
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Receipt Date</span>
                <input 
                  type="date" 
                  name="date" 
                  value={formData.date} 
                  onChange={handleChange}
                  className="col-span-4 border border-gray-400 bg-white px-2 py-0.5 font-bold outline-none h-6" 
                />

                <div className="col-span-4 flex items-center justify-end gap-2">
                  <span className="font-bold text-red-700">J.C.I</span>
                  <select 
                    name="jci" 
                    value={formData.jci} 
                    onChange={handleChange}
                    className="border border-gray-400 bg-white px-1 py-0.5 font-bold outline-none h-6 w-16"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Challan Supplier</span>
                <div className="col-span-8 flex gap-1 relative overflow-visible">
                  <input
                    type="text"
                    name="challan_supplier"
                    value={formData.challan_supplier}
                    onChange={handleChange}
                    list="challan_supplier_list"
                    placeholder="-- TYPE OR SELECT CHALLAN SUPPLIER --"
                    className="flex-1 border border-gray-400 bg-white px-2 py-0.5 font-bold outline-none h-6 uppercase font-mono text-xs"
                  />
                  <datalist id="challan_supplier_list">
                    {suppliers.map(s => (
                      <option key={s.id || s.supp_name} value={s.supp_name}>
                        {s.supp_name}
                      </option>
                    ))}
                  </datalist>
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Supplier</span>
                <div className="col-span-8 flex gap-1 relative overflow-visible">
                  <input
                    type="text"
                    name="supplier"
                    value={formData.supplier}
                    onChange={handleChange}
                    list="supplier_list"
                    placeholder="-- TYPE OR SELECT ACTUAL SUPPLIER --"
                    className="flex-1 border border-gray-400 bg-white px-2 py-0.5 font-bold outline-none h-6 uppercase font-mono text-xs"
                  />
                  <datalist id="supplier_list">
                    {suppliers.map(s => (
                      <option key={s.id || s.supp_name} value={s.supp_name}>
                        {s.supp_name}
                      </option>
                    ))}
                  </datalist>
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Broker</span>
                <div className="col-span-8 flex gap-1 relative overflow-visible">
                  <input
                    type="text"
                    name="broker"
                    value={formData.broker}
                    onChange={handleChange}
                    list="broker_list"
                    placeholder="-- TYPE OR SELECT BROKER --"
                    className="flex-1 border border-gray-400 bg-white px-2 py-0.5 font-bold outline-none h-6 uppercase font-mono text-xs"
                  />
                  <datalist id="broker_list">
                    <option value="DIRECT" />
                    {brokers.map(b => (
                      <option key={b.id || b.brok_name} value={b.brok_name}>
                        {b.brok_name}
                      </option>
                    ))}
                  </datalist>
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Transporter Name</span>
                <input 
                  type="text" 
                  name="transporter_name" 
                  value={formData.transporter_name} 
                  onChange={handleChange}
                  className="col-span-8 border border-gray-400 bg-white px-2 py-0.5 outline-none font-bold h-6" 
                />

                <span className="col-span-4 font-bold text-gray-800 text-right">Challan / R.R. No.</span>
                <input 
                  type="text" 
                  name="challan_rr_no" 
                  value={formData.challan_rr_no} 
                  onChange={handleChange}
                  className="col-span-8 border border-gray-400 bg-white px-2 py-0.5 outline-none font-bold h-6" 
                />

                <span className="col-span-4 font-bold text-gray-800 text-right">Lorry Number</span>
                <div className="col-span-8 flex gap-1">
                  <input 
                    type="text" 
                    name="lorry_prefix" 
                    placeholder="PREFIX"
                    value={formData.lorry_prefix} 
                    onChange={handleChange}
                    className="w-1/3 text-center uppercase border border-gray-400 px-2 py-0.5 font-bold outline-none h-6" 
                  />
                  <span className="font-extrabold flex items-center justify-center">-</span>
                  <input 
                    type="text" 
                    name="lorry_suffix" 
                    placeholder="SUFFIX"
                    value={formData.lorry_suffix} 
                    onChange={handleChange}
                    className="flex-1 text-center uppercase border border-gray-400 px-2 py-0.5 font-bold outline-none h-6" 
                  />
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Pan No.</span>
                <input 
                  type="text" 
                  name="pan_no" 
                  value={formData.pan_no} 
                  onChange={handleChange}
                  className="col-span-8 border border-gray-400 bg-white px-2 py-0.5 outline-none font-bold font-mono h-6" 
                />

                <span className="col-span-4 font-bold text-gray-800 text-right">Lorry Arrival Date</span>
                <input 
                  type="date" 
                  name="lorry_date" 
                  value={formData.lorry_date} 
                  onChange={handleChange}
                  className="col-span-8 border border-gray-400 bg-white px-2 py-0.5 font-bold outline-none h-6" 
                />
              </div>
            </LegacyFieldset>
          </div> */}

          {/* Column Group 2 - Delivery and Invoicing */}
          {/* <div className="col-span-12 lg:col-span-6 flex flex-col gap-2">
            <LegacyFieldset legend="Logistics & Compliance Tracker">
              <div className="grid grid-cols-12 gap-x-3 gap-y-1.5 text-[11px] items-center">
                
                <span className="col-span-4 font-bold text-gray-800 text-right">Consignment Note No.</span>
                <input 
                  type="text" 
                  name="consignment_note_no" 
                  value={formData.consignment_note_no} 
                  onChange={handleChange}
                  className="col-span-8 border border-gray-400 bg-white px-2 py-0.5 outline-none font-bold h-6" 
                />

                <span className="col-span-4 font-bold text-gray-800 text-right">D.I. No.</span>
                <input 
                  type="text" 
                  name="di_no" 
                  value={formData.di_no} 
                  onChange={handleChange}
                  className="col-span-4 border border-gray-400 bg-white px-2 py-0.5 outline-none font-bold h-6" 
                />

                <div className="col-span-4 flex items-center gap-1.5 pl-1 justify-end">
                  <span className="font-bold text-gray-700">DI Date</span>
                  <input 
                    type="date" 
                    name="di_date" 
                    value={formData.di_date} 
                    onChange={handleChange}
                    className="w-28 border border-gray-400 bg-white px-1 py-0.5 font-bold outline-none h-6 text-center" 
                  />
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Invoice No.</span>
                <input 
                  type="text" 
                  name="invoice_no" 
                  value={formData.invoice_no} 
                  onChange={handleChange}
                  className="col-span-4 border border-gray-400 bg-white px-2 py-0.5 outline-none font-bold h-6" 
                />

                <div className="col-span-4 flex items-center gap-1.5 pl-1 justify-end">
                  <span className="font-bold text-gray-700">Inv. Date</span>
                  <input 
                    type="date" 
                    name="invoice_date" 
                    value={formData.invoice_date} 
                    onChange={handleChange}
                    className="w-28 border border-gray-400 bg-white px-1 py-0.5 font-bold outline-none h-6 text-center" 
                  />
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">P.T.F</span>
                <select 
                  name="ptf" 
                  value={formData.ptf} 
                  onChange={handleChange}
                  className="col-span-8 border border-gray-400 bg-white px-2 py-0.5 font-bold text-gray-900 outline-none h-6"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>

                <span className="col-span-4 font-bold text-gray-800 text-right">Lorry Returned</span>
                <select 
                  name="lorry_returned" 
                  value={formData.lorry_returned} 
                  onChange={handleChange}
                  className="col-span-3 border border-gray-400 bg-white px-2 py-0.5 font-bold text-gray-900 outline-none h-6"
                >
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>

                <div className="col-span-5 flex items-center justify-end gap-2">
                  <span className="font-bold text-gray-700 text-[10px] whitespace-nowrap">Ret. Other Mill</span>
                  <select 
                    name="lorry_returned_other_mill" 
                    value={formData.lorry_returned_other_mill} 
                    onChange={handleChange}
                    className="border border-gray-400 bg-white px-1 py-0.5 font-bold text-gray-900 outline-none h-6 w-16"
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Arrival Area</span>
                <div className="col-span-8 flex gap-1">
                  <input 
                    type="text" 
                    name="arrival_area_code"
                    value={formData.arrival_area_code}
                    readOnly
                    placeholder="CODE"
                    className="w-16 text-center font-bold bg-slate-100 border border-gray-400 py-0.5 h-6" 
                  />
                  <select
                    name="arrival_area_name"
                    value={formData.arrival_area_name}
                    onChange={(e) => {
                      const matchedArea = areas.find(a => a.area_name === e.target.value);
                      setFormData(prev => ({
                        ...prev,
                        arrival_area_name: e.target.value,
                        arrival_area_code: matchedArea ? matchedArea.area_code : prev.arrival_area_code
                      }));
                    }}
                    className="flex-1 bg-white border border-gray-400 py-0.5 outline-none font-bold h-6 text-xs"
                  >
                    <option value="">-- SELECT AREA --</option>
                    {areas.map(a => (
                      <option key={a.id} value={a.area_name}>{a.area_name}</option>
                    ))}
                  </select>
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Unit</span>
                <div className="col-span-8 flex gap-1">
                  <input 
                    type="text" 
                    name="unit_code"
                    value={formData.unit_code}
                    onChange={handleChange}
                    className="w-16 text-center font-bold border border-gray-400 py-0.5 h-6 text-xs bg-slate-50" 
                    readOnly
                  />
                  <select 
                    name="unit_name"
                    value={formData.unit_name || 'BALES'}
                    onChange={(e) => {
                      const uVal = e.target.value;
                      const codeMap: Record<string, string> = { 'BALES': 'I', 'LOOSE': 'II', 'DRUMS': '2', 'P.BALES': '4', 'H.BALES': '5' };
                      setFormData(prev => ({
                        ...prev,
                        unit_name: uVal,
                        unit_code: codeMap[uVal] || prev.unit_code || '1'
                      }));
                    }}
                    className="flex-1 border border-gray-400 py-0.5 px-1 uppercase font-bold h-6 text-xs bg-white outline-none cursor-pointer" 
                  >
                    {Array.from(new Set([...unitList, formData.unit_name].filter(Boolean))).map((u: string) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right">Way Bill No.</span>
                <input 
                  type="text" 
                  name="way_bill_no" 
                  value={formData.way_bill_no} 
                  onChange={handleChange}
                  className="col-span-4 border border-gray-400 bg-white px-2 py-0.5 outline-none font-bold h-6" 
                />

                <div className="col-span-4 flex items-center gap-1.5 pl-1 justify-end">
                  <span className="font-bold text-gray-700">W.B. Date</span>
                  <input 
                    type="date" 
                    name="way_bill_date" 
                    value={formData.way_bill_date} 
                    onChange={handleChange}
                    className="w-28 border border-gray-400 bg-white px-1 py-0.5 font-bold outline-none h-6 text-center" 
                  />
                </div>

                <span className="col-span-4 font-bold text-gray-800 text-right flex items-center justify-end gap-1">
                  A.P.M.C Fees (Rs.)
                </span>
                <input 
                  type="number" 
                  name="apmc_fees" 
                  placeholder="0.00"
                  value={formData.apmc_fees || ''} 
                  onChange={handleChange}
                  className="col-span-3 border border-gray-400 bg-white px-2 py-0.5 outline-none font-mono text-right font-bold h-6 focus:border-blue-600 focus:ring-1 focus:ring-blue-600" 
                />

                <div className="col-span-5 flex items-center justify-end gap-1.5">
                  <span className="font-bold text-gray-800 text-[10px] shrink-0">Remarks</span>
                  <input 
                    type="text" 
                    name="remarks" 
                    placeholder="REMARKS"
                    value={formData.remarks} 
                    onChange={handleChange}
                    className="flex-1 border border-gray-400 bg-white px-1 py-0.5 outline-none font-bold h-6" 
                  />
                </div>
              </div>
            </LegacyFieldset>
          </div>
        </div> */}

        {/* TRANS-GRADE BATCH LEDGER TABLE */}
        {/* <div className="flex-1 min-h-[180px] border-2 border-slate-300 overflow-x-auto bg-white">
          <div className="flex items-center justify-between p-1.5 bg-slate-200 border-b border-slate-300">
             <span className="text-[10px] font-bold uppercase text-slate-700">Receipt Grid Items</span>
             <div className="flex items-center gap-1.5">
                <button
                   type="button"
                   onClick={handleAddRow}
                   className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-2 py-0.5 text-[10px] rounded flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                >
                   + Spawn Row
                </button>
                <button
                   type="button"
                   onClick={handleDeleteRow}
                   className="bg-rose-700 hover:bg-rose-800 text-white font-bold px-2 py-0.5 text-[10px] rounded flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
                >
                   - Delete Row
                </button>
             </div>
          </div>
          <table className="w-full table-fixed min-w-[950px] border-collapse text-left text-[11px] font-sans">
            <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm">
              <tr className="bg-slate-800 text-white font-bold uppercase text-[9px]/tight text-center">
                <th className="p-1 border border-gray-400 w-10 shrink-0" rowSpan={2}>Srl</th>
                <th className="p-1 border border-gray-400 text-center w-52" colSpan={2}>Receipt Grade</th>
                <th className="p-1 border border-gray-400 w-24" rowSpan={2}>Crop Year</th>
                <th className="p-1 border border-gray-400 w-28" rowSpan={2}>Challan Grade</th>
                <th className="p-1 border border-gray-400 text-center w-48" colSpan={2}>Agency</th>
                <th className="p-1 border border-gray-400 text-center w-48" colSpan={2}>Challan Marka</th>
                <th className="p-1 border border-gray-400 w-24" rowSpan={2}>Netto (M.T)</th>
                <th className="p-1 border border-gray-400 w-32" colSpan={2}>Quantity</th>
                <th className="p-1 border border-gray-400 w-36" rowSpan={2}>Remarks</th>
              </tr>
              <tr className="bg-slate-200 text-black font-extrabold text-[8px] text-center border-b border-gray-400">
                <th className="p-0.5 border border-gray-400 w-16">Code</th>
                <th className="p-0.5 border border-gray-400 w-36">Name</th>
                <th className="p-0.5 border border-gray-400 w-14">Code</th>
                <th className="p-0.5 border border-gray-400 w-34">Name</th>
                <th className="p-0.5 border border-gray-400 w-14">Code</th>
                <th className="p-0.5 border border-gray-400 w-34">Name</th>
                <th className="p-0.5 border border-gray-400 w-16">Chln</th>
                <th className="p-0.5 border border-gray-400 w-16">Rcpt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-300">
              {details.map((detail, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors h-7 text-[10.5px]">
                 
                  <td className="p-1 text-center font-bold text-gray-900 border border-gray-300 bg-slate-100 w-10">{detail.srl_no}</td>

                  
                  <td className="p-0.5 border border-gray-300 w-16 bg-slate-50 text-center">
                    <input
                      type="text"
                      value={detail.receipt_grade_code}
                      readOnly
                      placeholder="--"
                      className="w-full bg-transparent border-0 p-0 text-center font-bold text-gray-800 outline-none"
                    />
                  </td>

                  
                  <td className="p-0.5 border border-gray-300 w-36">
                    <select
                      value={detail.receipt_grade_name}
                      onChange={(e) => handleDetailChange(idx, 'receipt_grade_name', e.target.value)}
                      className="w-full bg-white border border-gray-300 p-0 text-left font-bold text-gray-900 outline-none h-6"
                    >
                      <option value=""></option>
                      {detail.receipt_grade_name && !grades.some(g => g.grade_name === detail.receipt_grade_name) && (
                        <option value={detail.receipt_grade_name}>{detail.receipt_grade_name}</option>
                      )}
                      {grades.map(g => (
                        <option key={g.id || g.grade_code} value={g.grade_name}>{g.grade_name}</option>
                      ))}
                    </select>
                  </td>

                  
                  <td className="p-0.5 border border-gray-300 w-24">
                    <select 
                      value={detail.crop_year} 
                      onChange={(e) => handleDetailChange(idx, 'crop_year', e.target.value)}
                      className="w-full bg-white border border-gray-300 p-0 text-center font-bold text-gray-900 outline-none h-6 text-xs" 
                    >
                      <option value=""></option>
                      {detail.crop_year && !['2024-25', '2025-26', '2026-27', '2027-28', '2028-29'].includes(detail.crop_year) && (
                        <option value={detail.crop_year}>{detail.crop_year}</option>
                      )}
                      <option value="2024-25">2024-25</option>
                      <option value="2025-26">2025-26</option>
                      <option value="2026-27">2026-27</option>
                      <option value="2027-28">2027-28</option>
                      <option value="2028-29">2028-29</option>
                    </select>
                  </td>

                  
                  <td className="p-0.5 border border-gray-300 w-28">
                    <input 
                      type="text" 
                      value={detail.challan_grade_name} 
                      onChange={(e) => handleDetailChange(idx, 'challan_grade_name', e.target.value)}
                      className="w-full bg-transparent border-0 p-0 outline-none px-1" 
                    />
                  </td>

                  
                  <td className="p-0.5 border border-gray-300 w-14 bg-slate-50 text-center">
                    <input
                      type="text"
                      value={detail.agency_code || ''}
                      onChange={(e) => handleDetailChange(idx, 'agency_code', e.target.value)}
                      placeholder="--"
                      className="w-full bg-transparent border-0 p-0 text-center font-bold text-gray-800 outline-none uppercase font-mono"
                    />
                  </td>

                  
                  <td className="p-0.5 border border-gray-300 w-34">
                    <input
                      type="text"
                      list="agencies_list"
                      placeholder="Type/Select Agency..."
                      value={detail.agency_name || ''}
                      onChange={(e) => handleDetailChange(idx, 'agency_name', e.target.value)}
                      className="w-full bg-white text-left font-bold text-gray-900 outline-none px-1 h-6 uppercase font-mono border-0"
                    />
                  </td>

                  
                  <td className="p-0.5 border border-gray-300 w-14 bg-slate-50 text-center">
                    <input
                      type="text"
                      value={detail.challan_marka_code}
                      readOnly
                      placeholder="--"
                      className="w-full bg-transparent border-0 p-0 text-center font-bold text-gray-800 outline-none"
                    />
                  </td>

                  
                  <td className="p-0.5 border border-gray-300 w-34">
                    <input
                      type="text"
                      list="markas_list"
                      placeholder="Type/Select Marka..."
                      value={detail.challan_marka_name || ''}
                      onChange={(e) => handleDetailChange(idx, 'challan_marka_name', e.target.value)}
                      className="w-full bg-white text-left font-bold text-gray-900 outline-none px-1 h-6 uppercase font-mono border-0"
                    />
                  </td>

                  
                  <td className="p-0.5 border border-gray-300 w-24">
                    {(() => {
                      const rowUnit = (detail.unit || formData.unit_name || 'BALES').toString().trim().toUpperCase();
                      const isBales = rowUnit === 'BALES' || rowUnit.includes('BALE');
                      return (
                        <input 
                          type="number" 
                          step="0.001"
                          placeholder="0.000"
                          readOnly={isBales}
                          value={detail.netto_pnto !== undefined && detail.netto_pnto !== null ? detail.netto_pnto : 0} 
                          onChange={(e) => {
                            if (!isBales) {
                              const val = e.target.value;
                              handleDetailChange(idx, 'netto_pnto', val === '' ? 0 : Number(val));
                            }
                          }}
                          title={isBales ? "Auto-calculated: (RCPT / Total RCPT) * Final Weight" : "Enter Netto Weight"}
                          className={cn(
                            "w-full p-0 text-right font-bold outline-none pr-1 transition-colors",
                            isBales
                              ? "bg-amber-50/90 border border-amber-300 text-amber-950 cursor-not-allowed"
                              : "bg-white border border-gray-300 text-gray-900 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                          )}
                        />
                      );
                    })()}
                  </td>

                  
                  <td className="p-0.5 border border-gray-300 w-16">
                    <input 
                      type="number" 
                      step="1"
                      placeholder="0"
                      value={detail.quantity_chln !== undefined && detail.quantity_chln !== null ? detail.quantity_chln : 0} 
                      onChange={(e) => {
                        const val = e.target.value;
                        handleDetailChange(idx, 'quantity_chln', val === '' ? 0 : Number(val));
                      }}
                      className="w-full bg-white border border-blue-200 p-0 text-center font-bold text-blue-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600" 
                    />
                  </td>

                  
                  <td className="p-0.5 border border-gray-300 w-16">
                    <input 
                      type="number" 
                      step="1"
                      placeholder="0"
                      value={detail.quantity_rcpt !== undefined && detail.quantity_rcpt !== null ? detail.quantity_rcpt : 0} 
                      onChange={(e) => {
                        const val = e.target.value;
                        handleDetailChange(idx, 'quantity_rcpt', val === '' ? 0 : Number(val));
                      }}
                      className="w-full bg-white border border-indigo-200 p-0 text-center font-bold text-indigo-900 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600" 
                    />
                  </td>

                  
                  <td className="p-0.5 border border-gray-300 w-36">
                    <input 
                      type="text" 
                      value={detail.remarks} 
                      onChange={(e) => handleDetailChange(idx, 'remarks', e.target.value)}
                      className="w-full bg-transparent border-0 p-0 text-left outline-none px-1" 
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> */}

        {/* WEIGHMENT SCALE BLOCKS */}
        {/* <div className="shrink-0">
          <LegacyFieldset legend="Automatic Weighment Ledger & Verification Weights (in metric tons)">
            <div className="grid grid-cols-12 gap-4 text-[10.5px] items-center"> */}
              
              {/* Box Column 1 */}
              {/* <div className="col-span-12 md:col-span-4 bg-slate-100/50 p-2 border border-gray-300 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">CHALLAN WEIGHT</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="challan_material_weight"
                    value={formData.challan_material_weight || 0}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono font-bold bg-white" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">SUPPLIER NET WT</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="supplier_net_weight"
                    value={formData.supplier_net_weight || 0}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono font-bold bg-white" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">ELECTRONIC SCALE NET</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="electronic_net_weight"
                    value={formData.electronic_net_weight || 0}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono bg-white font-bold" 
                  />
                </div>
              </div> */}

              {/* Box Column 2 */}
              {/* <div className="col-span-12 md:col-span-4 bg-slate-100/50 p-2 border border-gray-300 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">ACTUAL GROSS (LORRY+TARE)</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="actual_gross_weight"
                    value={formData.actual_gross_weight || ''}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono font-bold bg-white" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">SUPPLIER CHALLAN GROSS</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="supplier_challan_gross"
                    value={formData.supplier_challan_gross || ''}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono font-bold bg-white" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">ELECTRONIC SCALE GROSS</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="electronic_gross_weight"
                    value={formData.electronic_gross_weight || ''}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono bg-white" 
                  />
                </div>
              </div> */}

              {/* Box Column 3 */}
              {/* <div className="col-span-12 md:col-span-4 bg-slate-100/50 p-2 border border-gray-300 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">ACTUAL TARE (EMPTY LORRY)</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="actual_tare_weight"
                    value={formData.actual_tare_weight || ''}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono font-bold bg-white" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">SUPPLIER TARE WEIGHT</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="supplier_tare_weight"
                    value={formData.supplier_tare_weight || ''}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono font-bold bg-white" 
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[10px] text-slate-700">ELECTRONIC SCALE TARE</span>
                  <input 
                    type="number" 
                    step="0.001"
                    name="electronic_tare_weight"
                    value={formData.electronic_tare_weight || ''}
                    onChange={handleChange}
                    className="w-24 border border-gray-400 text-right px-2 py-0.5 font-mono bg-white" 
                  />
                </div>
              </div> */}

           {/*  </div> */}

            {/* Weight Shortage reduction info helper bottom centered */}
            {/* <div className="mt-2.5 flex justify-center border-t border-gray-200 pt-2.5">
              <div className="flex items-center gap-3">
                <span className="font-bold text-gray-800 text-[10.5px]">WEIGHT REDUCED IN DISCREPANCY (M.Ton)</span>
                <input 
                  type="number" 
                  step="0.001"
                  name="weight_reduced"
                  value={formData.weight_reduced || ''}
                  onChange={handleChange}
                  className="w-32 border border-gray-400 text-right px-2 py-0.5 font-mono font-black text-rose-700 bg-white" 
                />
              </div>
            </div> */}
          {/* </LegacyFieldset> 
        </div>*/}

        {/* <div className="flex bg-[#c0c0c0] p-1 border border-black/20 gap-1 shrink-0">
          <LegacyButton icon={Plus} label="Clear (F2)" onClick={clearForm} />
          <div className="flex-1" />
          <LegacyButton icon={X} label="Exit (Esc)" onClick={onCancel} />
          <LegacyButton icon={Save} label={loading ? "SAVING..." : "SAVE ARRIVAL"} active={!loading} onClick={handleSave} />
        </div>*/}
        <div>
        <datalist id="markas_list">
          {markas.map((m, mIdx) => (
            <option key={m.id || mIdx} value={m.marka_name} />
          ))}
        </datalist>

        <datalist id="agencies_list">
          {agencies.map((a, aIdx) => (
            <option key={a.id || aIdx} value={a.agency_name} />
          ))}
        </datalist>

      </div> 
    </LegacyLayout>
  );
}
