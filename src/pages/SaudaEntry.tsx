import React, { useState, useEffect, useRef } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { ArrowLeft, FileText } from 'lucide-react';
import { Sauda } from '../types';
import { dbModule } from '../services/dbModule';
import { supabase } from '../lib/supabase';
import { enforceEditOrDeletePermission, getCurrentUserContext } from '../lib/permissions';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';

import LegacyLayout from '../components/LegacyLayout';
import BasicDetailsCard from '../components/BasicDetailsCard';
import TransportationCard from '../components/TransportationCard';
import QualityDetailsTable from '../components/QualityDetailsTable';
import ShipmentClaimsCard from '../components/ShipmentClaimsCard';
import RemarksCard from '../components/RemarksCard';
import FooterActions from '../components/FooterActions';
import SaudaPrintSlip from '../components/SaudaPrintSlip';
import FormLegend from '../components/FormLegend';

const UNIT_OPTIONS = ["BALES", "DRUMS", "LOOSE", "P.BALES", "H.BALES"];

const compareQualities = (aStr: string, bStr: string): number => {
  const clean = (val: string) => {
    return String(val || '')
      .trim()
      .replace(/\.$/, '')
      .replace(/\s+/g, '')
      .toUpperCase();
  };

  const a = clean(aStr);
  const b = clean(bStr);

  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const PREDEFINED_RANKS: Record<string, number> = {
    'TD1': 10, 'TD2': 20, 'TD3': 30, 'TD4': 40, 'TD5': 50, 'TD6': 60, 'TD7': 70, 'TD8': 80,
    'W1': 110, 'W2': 120, 'W3': 130, 'W4': 140, 'W5': 150, 'W6': 160, 'W7': 170, 'W8': 180,
    'M1': 210, 'M2': 220, 'M3': 230, 'M4': 240, 'M5': 250, 'M6': 260, 'M7': 270, 'M8': 280,
    'BTC': 310, 'BTR': 320,
    'STANDARD GRADE': 1000, 'NORMAL GRADE': 1010
  };

  const rankA = PREDEFINED_RANKS[a];
  const rankB = PREDEFINED_RANKS[b];

  if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
  if (rankA !== undefined) return -1;
  if (rankB !== undefined) return 1;

  const regex = /^([A-Z]+)(\d+)(.*)$/;
  const matchA = a.match(regex);
  const matchB = b.match(regex);

  if (matchA && matchB) {
    const prefixA = matchA[1];
    const numA = parseInt(matchA[2], 10);
    const prefixB = matchB[1];
    const numB = parseInt(matchB[2], 10);

    if (prefixA === prefixB) return numA - numB;
    return prefixA.localeCompare(prefixB);
  }

  return a.localeCompare(b);
};

export default function SaudaEntry({ 
  initialData, 
  onSave, 
  onCancel 
}: { 
  initialData?: any; 
  onSave?: (d: any) => void; 
  onCancel?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [showPrintSlip, setShowPrintSlip] = useState(false);

  const [brokers, setBrokers] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [agencies, setAgencies] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);
  const [markas, setMarkas] = useState<any[]>([]);
  const [baseRatesList, setBaseRatesList] = useState<any[]>([]);
  const [dbDiffsList, setDbDiffsList] = useState<any[]>([]);

  // User 010 Detection logic
  const userCtx = getCurrentUserContext();
  const uid = String(userCtx?.userId || (userCtx as any)?.user_id || '').trim().toLowerCase();
  const uname = String(userCtx?.username || userCtx?.userName || '').trim().toLowerCase();
  
  let sessionUid = '';
  let sessionUname = '';
  try {
    const rawSess = typeof window !== 'undefined' ? localStorage.getItem('bally_auth_session') : null;
    if (rawSess) {
      const parsed = JSON.parse(rawSess);
      sessionUid = String(parsed?.userId || parsed?.user_id || '').trim().toLowerCase();
      sessionUname = String(parsed?.username || '').trim().toLowerCase();
    }
  } catch {}

  const detectedIs010 = 
    uid === '010' || uid === '10' || uid === 'user010' || uid === 'user 010' ||
    uname === '010' || uname === '10' || uname === 'user010' || uname === 'user 010' ||
    sessionUid === '010' || sessionUid === '10' || sessionUid === 'user010' ||
    sessionUname === '010' || sessionUname === '10' || sessionUname === 'user010';

  const [forceUser010, setForceUser010] = useState<boolean | null>(null);
  const isUser010 = forceUser010 !== null ? forceUser010 : detectedIs010;

  const today = new Date().toISOString().split('T')[0];

  const getInitialFormData = (): Sauda => {
    if (initialData) {
      const copy = { ...initialData };
      copy.broker = (copy.broker || '').toUpperCase();
      copy.supplier = (copy.supplier || '').toUpperCase();
      copy.challan_supplier = (copy.challan_supplier || '').toUpperCase();
      copy.area = (copy.area || '').toUpperCase();
      
      const realQD = (copy.quality_details || [])
        .filter((item: any) => item.quality || item.qty || item.agency || item.marka || item.rs)
        .sort((a: any, b: any) => compareQualities(a.quality || '', b.quality || ''));

      if (copy.units_per_lorry === undefined && copy.units_per_lorry_type && !isNaN(Number(copy.units_per_lorry_type))) {
        copy.units_per_lorry = Number(copy.units_per_lorry_type);
      }

      const existingCount = realQD.length;
      if (existingCount < 1) {
        copy.quality_details = [{ quality: '', qty: 0, agency: '', marka: '', rs: 0 }];
      } else {
        copy.quality_details = realQD;
      }
      return copy;
    }

    return {
      sauda_no: '0153',
      financial_year: '2026-2027',
      session: 'BJCL/2026-2027/',
      po_type: 'Normal',
      date: today,
      broker: '',
      supplier: '',
      challan_supplier: '',
      area: '',
      agency: '',
      marks: '',
      no_of_lorries: 1,
      units_per_lorry: 0,
      units_per_lorry_type: 'BALES',
      total_unit: 0,
      wt_per_lorry: 0,
      unit_type: 'BALES',
      total_wt_in_ton: 0,
      shipment_date: today,
      shipment_days: 0,
      shipment_penalty: 5,
      marks_claim: 0,
      quantity_claim: 0,
      remarks: 'Area, Agency Grade, Grade differential can change as per market.',
      b_rate: 0,
      b_date: today,
      superior_normal_marks: 'New (F2)',
      signature_url: '',
      status: 'pending',
      quality_details: [{ quality: '', qty: 0, agency: '', marka: '', rs: 0 }]
    };
  };

  const [formData, setFormData] = useState<Sauda>(getInitialFormData());

  const formContainerRef = useRef<HTMLDivElement>(null);
  useKeyboardNavigation(formContainerRef);

  async function loadMasterData() {
    try {
        const [brokData, suppData, areaData, agcData, gradeData, markaData, allSaudas, sattaBaseRates, sattaDiffs] = await Promise.all([
          dbModule.fetchAll('broker_master'),
          dbModule.fetchAll('supply_master'),
          dbModule.fetchAll('area_master'),
          dbModule.fetchAll('agency_master'),
          dbModule.fetchAll('grade_master'),
          dbModule.fetchAll('marka_master').catch(() => []),
          dbModule.fetchAll('sauda_master').catch(() => []),
          supabase ? supabase.from('satta_base_rates').select('*').order('start_date', { ascending: false }).then(r => r.data || []) : Promise.resolve([]),
          supabase ? supabase.from('satta_differentials').select('*').then(r => r.data || []) : Promise.resolve([])
        ]);

        if (brokData) setBrokers(brokData.map((b: any) => b.brok_name || b.name || '').filter(Boolean));
        if (suppData) setSuppliers(suppData.map((s: any) => s.supp_name || s.name || '').filter(Boolean));
        if (areaData) setAreas(areaData.map((a: any) => a.area_name || a.name || '').filter(Boolean));
        if (agcData) setAgencies(agcData);
        if (gradeData) setGrades(gradeData);
        if (markaData) setMarkas(markaData);
        if (sattaBaseRates && sattaBaseRates.length > 0) {
          setBaseRatesList(sattaBaseRates);
          const sorted = [...sattaBaseRates].sort((a: any, b: any) => (b.start_date || '').localeCompare(a.start_date || ''));
          const targetDt = formData.b_date || formData.date || today;
          const eff = sorted.find((r: any) => r.start_date <= targetDt) || sorted[sorted.length - 1];
          if (eff && eff.base_rate) {
            const activeBase = Number(eff.base_rate);
            setFormData(prev => ({
              ...prev,
              b_rate: prev.b_rate && prev.b_rate > 0 ? prev.b_rate : activeBase
            }));
          }
        }
        if (sattaDiffs) setDbDiffsList(sattaDiffs);

        // Auto-generate next Order No. if creating new Sauda
        if (!initialData && allSaudas && allSaudas.length > 0) {
          const numbers = allSaudas.map((s: any) => {
            const val = parseInt(s.sauda_no || '0', 10);
            return isNaN(val) ? 0 : val;
          });
          const maxNo = Math.max(...numbers, 152);
          const nextNoStr = String(maxNo + 1).padStart(4, '0');
          setFormData(prev => ({
            ...prev,
            sauda_no: nextNoStr,
            session: `BJCL/2026-2027/${nextNoStr}`
          }));
        }
      } catch (err) {
        console.error("Error loading master data:", err);
      }
  }

  useEffect(() => {
    loadMasterData();
  }, [initialData]);

  useLiveAutoRefresh(loadMasterData, [initialData], { tables: ['sauda_master', 'broker_master', 'supply_master', 'area_master', 'agency_master', 'grade_master', 'marka_master', 'satta_base_rates', 'satta_differentials'] });

  // Recalculate Satta rate for a quality row based on Date, Area, Grade
  const recalculateRowRate = (date: string, area: string, grade: string) => {
    if (!date || !area || !grade || baseRatesList.length === 0) return null;

    const dStr = date;
    const sortedBaseRates = [...baseRatesList].sort((a, b) => b.start_date.localeCompare(a.start_date));
    const effectiveBase = sortedBaseRates.find(r => r.start_date <= dStr) || sortedBaseRates[sortedBaseRates.length - 1];
    const baseVal = effectiveBase ? Number(effectiveBase.base_rate) : 17500;

    const cleanArea = area.trim().toUpperCase();
    const cleanGrade = grade.trim().toUpperCase();

    const lookupAreas = [cleanArea];
    if (cleanArea === 'SEMI NORTHERN' || cleanArea.includes('SEMI NORTHERN')) {
      lookupAreas.push('NORTHERN');
    } else if (cleanArea === 'NORTHERN' || cleanArea.includes('NORTHERN')) {
      lookupAreas.push('SEMI NORTHERN');
    }

    if (cleanArea.includes('PURNEA') || cleanArea.includes('BIHAR')) {
      if (cleanArea.includes('LOOSE')) {
        if (!lookupAreas.includes('PURNEA (LOOSE)')) lookupAreas.unshift('PURNEA (LOOSE)');
        if (!lookupAreas.includes('PURNEA LOOSE')) lookupAreas.push('PURNEA LOOSE');
      } else {
        if (!lookupAreas.includes('PURNEA(BIHAR)')) lookupAreas.push('PURNEA(BIHAR)');
        if (!lookupAreas.includes('PURNEA (BIHAR)')) lookupAreas.push('PURNEA (BIHAR)');
        if (!lookupAreas.includes('PURNEA (LOOSE)')) lookupAreas.push('PURNEA (LOOSE)');
      }
    }

    let diffVal: number | undefined;
    for (const lookupArea of lookupAreas) {
      const diffObj = dbDiffsList.find(
        d => (d.area || '').toUpperCase() === lookupArea && 
             (d.grade || '').toUpperCase() === cleanGrade
      );
      if (diffObj) {
        diffVal = Number(diffObj.differential);
        break;
      }
    }

    if (diffVal !== undefined) {
      return baseVal + diffVal;
    }

    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let finalValue: any = value;

    setFormData(prev => {
      const updated = { ...prev, [name]: finalValue };

      // Calculate Shipment Days automatically: Shipment Date - Contract Date
      if (name === 'shipment_date' || name === 'date') {
        const contractDt = name === 'date' ? new Date(value) : new Date(prev.date || today);
        const shipmentDt = name === 'shipment_date' ? new Date(value) : new Date(prev.shipment_date || today);
        if (!isNaN(contractDt.getTime()) && !isNaN(shipmentDt.getTime())) {
          const diffDays = Math.max(0, Math.ceil((shipmentDt.getTime() - contractDt.getTime()) / (1000 * 3600 * 24)));
          updated.shipment_days = diffDays;
        }
      }

      // Sync Unit Type when Units/Lorry changes
      if (name === 'units_per_lorry_type' && isNaN(Number(finalValue))) {
        updated.unit_type = finalValue;
      }

      // Automatically calculate Total Unit = No. of Lorries * Units/Lorry
      // and Wt/Lorry = Total Wt. in Ton / No. of Lorries or Total Wt = Lorries * Wt/Lorry
      if (name === 'no_of_lorries') {
        const lorries = parseFloat(value) || 0;
        const units = parseFloat(prev.units_per_lorry !== undefined && prev.units_per_lorry !== null ? prev.units_per_lorry as any : prev.units_per_lorry_type as any) || 0;
        updated.total_unit = Math.round(lorries * units);

        const wt = parseFloat(prev.wt_per_lorry as any) || 0;
        if (wt > 0) {
          updated.total_wt_in_ton = parseFloat((lorries * wt).toFixed(3));
        } else if (parseFloat(prev.total_wt_in_ton as any) > 0 && lorries > 0) {
          updated.wt_per_lorry = parseFloat(((parseFloat(prev.total_wt_in_ton as any)) / lorries).toFixed(3));
        }
      }

      if (name === 'units_per_lorry') {
        const units = parseFloat(value) || 0;
        const lorries = parseFloat(prev.no_of_lorries as any) || 0;
        updated.units_per_lorry = units;
        updated.units_per_lorry_type = String(units);
        updated.total_unit = Math.round(lorries * units);
      }

      if (name === 'wt_per_lorry') {
        const wt = parseFloat(value) || 0;
        const lorries = parseFloat(prev.no_of_lorries as any) || 0;
        updated.wt_per_lorry = wt;
        updated.total_wt_in_ton = parseFloat((lorries * wt).toFixed(3));
      }

      if (name === 'total_wt_in_ton') {
        const totalWt = parseFloat(value) || 0;
        const lorries = parseFloat(prev.no_of_lorries as any) || 0;
        updated.total_wt_in_ton = totalWt;
        if (lorries > 0) {
          updated.wt_per_lorry = parseFloat((totalWt / lorries).toFixed(3));
        }
      }

      // Automatically update b_rate from active Satta Base Rates when date or b_date changes
      if ((name === 'date' || name === 'b_date') && finalValue && baseRatesList.length > 0) {
        const sorted = [...baseRatesList].sort((a: any, b: any) => (b.start_date || '').localeCompare(a.start_date || ''));
        const eff = sorted.find((r: any) => r.start_date <= finalValue) || sorted[sorted.length - 1];
        if (eff && eff.base_rate) {
          updated.b_rate = Number(eff.base_rate);
        }
      }

      // Automatically update quality rates if area or date changes
      if ((name === 'area' || name === 'date') && finalValue) {
        const currentArea = name === 'area' ? finalValue : prev.area;
        const currentDate = name === 'date' ? finalValue : prev.date;

        if (currentArea) {
          let firstCalculated = null;
          const updatedQD = (updated.quality_details || []).map((row: any, i: number) => {
            if (row.quality) {
              const calculatedPrice = recalculateRowRate(currentDate || today, currentArea, row.quality);
              if (calculatedPrice !== null) {
                if (i === 0) firstCalculated = calculatedPrice;
                return { ...row, rs: calculatedPrice };
              }
            }
            return row;
          });
          updated.quality_details = updatedQD;
          if (firstCalculated !== null) updated.b_rate = firstCalculated;
        }
      }

      // Auto sync Order No. and Session
      if (name === 'sauda_no' && value) {
        const cleanVal = value.trim();
        const financialYear = prev.financial_year || '2026-2027';
        updated.session = `BJCL/${financialYear}/${cleanVal}`;
      }

      return updated;
    });
  };

  const handleSelectChange = (field: string, val: string) => {
    handleChange({
      target: { name: field, value: val }
    } as any);
  };

  const handleQualityChange = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const qd = [...(prev.quality_details || [])];
      qd[index] = { ...qd[index], [field]: value };

      if (field === 'quality' && value && prev.area) {
        const calculatedPrice = recalculateRowRate(prev.date || today, prev.area, value);
        if (calculatedPrice !== null) {
          qd[index].rs = calculatedPrice;
          if (index === 0) {
            return { ...prev, quality_details: qd, b_rate: calculatedPrice };
          }
        }
      }

      return { ...prev, quality_details: qd };
    });
  };

  const handleAddQualityRow = () => {
    setFormData(prev => ({
      ...prev,
      quality_details: [...(prev.quality_details || []), { quality: '', qty: 0, agency: '', marka: '', rs: 0 }]
    }));
  };

  const handleDeleteQualityRow = () => {
    setFormData(prev => {
      const current = prev.quality_details || [];
      if (current.length <= 1) return prev;
      return {
        ...prev,
        quality_details: current.slice(0, -1)
      };
    });
  };

  const handleRemoveQualityRowAt = (index: number) => {
    setFormData(prev => {
      const current = [...(prev.quality_details || [])];
      if (current.length <= 1) {
        current[0] = { quality: '', qty: 0, agency: '', marka: '', rs: 0 };
        return { ...prev, quality_details: current };
      }
      current.splice(index, 1);
      return { ...prev, quality_details: current };
    });
  };

  const handleSave = async () => {
    if ((formData.sauda_id || initialData) && !enforceEditOrDeletePermission("Edit")) {
      return;
    }

    if (!isUser010) {
      if (!formData.sauda_no) {
        alert("Please fill in the Order No.");
        return;
      }

      if (!formData.broker) {
        alert("Please fill in or select a Broker.");
        return;
      }

      if (!formData.supplier) {
        alert("Please fill in or select a Supplier.");
        return;
      }

      if (!formData.area) {
        alert("Please fill in or select an Area.");
        return;
      }

      // Validate Quality Details rows
      const qdRows = formData.quality_details || [];
      for (let i = 0; i < qdRows.length; i++) {
        const row = qdRows[i];
        if (row.quality || row.qty || row.rs || row.agency || row.marka) {
          if (!row.quality) {
            alert(`Please select or fill in Quality in Row ${i + 1}.`);
            return;
          }
        }
      }

      if (!formData.b_rate || Number(formData.b_rate) <= 0) {
        alert("B. Rate (Rs.) is required.");
        return;
      }

      if (!formData.b_date) {
        alert("B. Date is required.");
        return;
      }
    }

    setLoading(true);
    try {
      const saudaData = { ...formData };

      // For User 010: apply safe fallbacks for hidden/non-mandatory fields
      if (isUser010) {
        if (!saudaData.sauda_no) {
          saudaData.sauda_no = '0153';
        }
        if (!saudaData.date) {
          saudaData.date = today;
        }
        if (!saudaData.broker) {
          saudaData.broker = 'DIRECT';
        }
        if (!saudaData.supplier) {
          saudaData.supplier = saudaData.broker || 'DIRECT';
        }
        if (!saudaData.area) {
          saudaData.area = 'LOCAL';
        }
        if (!saudaData.b_rate || Number(saudaData.b_rate) <= 0) {
          const firstRs = Number(saudaData.quality_details?.[0]?.rs) || 0;
          saudaData.b_rate = firstRs;
        }
        if (!saudaData.b_date) {
          saudaData.b_date = saudaData.date || today;
        }
      }

      const qd = saudaData.quality_details;

      // Extract first row agency/marka into main master record for backward compatibility
      if (qd && qd.length > 0) {
        const validFirst = qd.find((x: any) => x.quality || x.agency || x.marka);
        if (validFirst) {
          if (validFirst.agency) saudaData.agency = validFirst.agency;
          if (validFirst.marka) saudaData.marks = validFirst.marka;
        }
      }

      const SAUDA_MASTER_FIELDS = [
        'sauda_id',
        'financial_year',
        'sauda_no',
        'session',
        'po_type',
        'date',
        'broker',
        'supplier',
        'challan_supplier',
        'area',
        'agency',
        'marks',
        'no_of_lorries',
        'units_per_lorry',
        'units_per_lorry_type',
        'total_unit',
        'wt_per_lorry',
        'unit_type',
        'total_wt_in_ton',
        'shipment_date',
        'shipment_days',
        'shipment_penalty',
        'marks_claim',
        'quantity_claim',
        'remarks',
        'b_rate',
        'b_date',
        'superior_normal_marks',
        'signature_url',
        'status',
        'created_at'
      ];

      const saudaPayload: Record<string, any> = {};
      SAUDA_MASTER_FIELDS.forEach(field => {
        if ((saudaData as any)[field] !== undefined) {
          saudaPayload[field] = (saudaData as any)[field];
        }
      });

      // Ensure units_per_lorry is stored strictly as numeric
      const numericUnitsPerLorry = (formData.units_per_lorry !== undefined && formData.units_per_lorry !== null && String(formData.units_per_lorry) !== '' && !isNaN(Number(formData.units_per_lorry)))
        ? Number(formData.units_per_lorry)
        : (formData.units_per_lorry_type && !isNaN(Number(formData.units_per_lorry_type)) ? Number(formData.units_per_lorry_type) : null);
      saudaPayload.units_per_lorry = numericUnitsPerLorry;
      saudaPayload.units_per_lorry_type = numericUnitsPerLorry !== null ? String(numericUnitsPerLorry) : (formData.units_per_lorry_type || formData.unit_type || 'BALES');

      let inserted;
      let isEditMode = !!saudaPayload.sauda_id;

      if (!saudaPayload.sauda_id && saudaPayload.sauda_no) {
        const targetFYear = saudaPayload.financial_year || '2026-2027';
        const allSaudas = await dbModule.fetchAll('sauda_master').catch(() => []);
        const match = allSaudas.find((s: any) => s.sauda_no === saudaPayload.sauda_no && s.financial_year === targetFYear);
        if (match) {
          saudaPayload.sauda_id = match.sauda_id;
          isEditMode = true;
        }
      }

      if (saudaPayload.sauda_id) {
        inserted = await dbModule.update('sauda_master', 'sauda_id', saudaPayload.sauda_id, saudaPayload);
      } else {
        inserted = await dbModule.insert('sauda_master', saudaPayload);
      }

      if (inserted && qd) {
        if (isEditMode) {
          await dbModule.delete('sauda_quality_details', 'sauda_id', inserted.sauda_id);
        }

        const sortedQd = [...qd].sort((a: any, b: any) => compareQualities(a.quality || '', b.quality || ''));
        for (const row of sortedQd) {
          if (row.quality || row.qty || row.rs || row.marka || row.agency) {
            try {
              await dbModule.insert('sauda_quality_details', {
                sauda_id: inserted.sauda_id,
                financial_year: inserted.financial_year || saudaData.financial_year,
                quality: row.quality,
                qty: Number(row.qty) || 0,
                agency: row.agency || '',
                marka: row.marka || '',
                rs: Number(row.rs) || 0
              });
            } catch (e) {
              console.error(e);
            }
          }
        }
      }

      alert("Sauda Contract saved successfully!");
      onSave?.(saudaData);
    } catch (err: any) {
      console.error(err);
      alert("Save failed: " + (err.message || "Database error."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LegacyLayout title="Sauda Desk" subtitle={initialData ? "Modify Contract" : "Add Sauda Contract"} onClose={onCancel}>
      <div className="flex-1 flex flex-col font-sans text-slate-800 space-y-4 w-full pb-10">
        {/* HEADER BAR - MATCHING MILL INSPECTION AESTHETIC */}
        <div className="bg-[#174C2C] text-white px-6 py-4 rounded-xl shadow-lg flex flex-wrap items-center justify-between border border-[#0F351E] gap-4">
          {/* Left Badge & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-800/40 border border-emerald-400/40 flex items-center justify-center text-amber-300 shadow-inner">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="bg-[#0b2415] text-amber-300 text-[11px] font-extrabold px-2.5 py-0.5 rounded border border-emerald-700/60 tracking-wider w-fit">
                {formData.session || 'BJCL 2026 - 2027'}
              </span>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-widest text-amber-300 drop-shadow mt-0.5">
                {initialData ? `MODIFY SAUDA #${formData.sauda_no}` : "NEW SAUDA CONTRACT ENTRY"}
              </h1>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setForceUser010(prev => prev === null ? !detectedIs010 : !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-2xs flex items-center gap-1.5 ${
                isUser010
                  ? "bg-amber-400 hover:bg-amber-300 text-[#0b2415] border-amber-300 font-black shadow-xs"
                  : "bg-[#0b2415]/70 hover:bg-[#0b2415] text-emerald-200 border-emerald-700/60"
              }`}
              title="Toggle between standard form and User 010 non-mandatory streamlined layout"
            >
              <span className={`w-2 h-2 rounded-full ${isUser010 ? "bg-emerald-900 animate-pulse" : "bg-emerald-400"}`} />
              <span>User 010 Mode: {isUser010 ? "ON" : "OFF"}</span>
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-[#0b2415]/80 hover:bg-[#123920] border border-emerald-400/50 rounded-lg text-xs font-bold text-white flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
              title="Back to Sauda Desk (Esc)"
            >
              <ArrowLeft className="h-4 w-4 text-amber-300" />
              <span>Back</span>
            </button>
          </div>
        </div>

        {/* 2. Main Form Content */}
        <main ref={formContainerRef} className="flex-1 space-y-5 w-full">
          {/* Field Color Guide */}
          <FormLegend />

          {/* Section 1: Basic Details */}
          <BasicDetailsCard
            formData={formData}
            onChange={handleChange}
            onSelectChange={handleSelectChange}
            brokers={brokers}
            suppliers={suppliers}
            areas={areas}
            isUser010={isUser010}
          />

          {/* Section 2: Transportation Details */}
          <TransportationCard
            formData={formData}
            onChange={handleChange}
            onSelectChange={handleSelectChange}
            unitOptions={UNIT_OPTIONS}
            isUser010={isUser010}
          />

          {/* Section 3: Quality Details Table */}
          <QualityDetailsTable
            qualityDetails={formData.quality_details || []}
            onQualityChange={handleQualityChange}
            onAddRow={handleAddQualityRow}
            onDeleteRow={handleDeleteQualityRow}
            onRemoveRowAt={handleRemoveQualityRowAt}
            grades={grades}
            agencies={agencies}
            markas={markas}
            isUser010={isUser010}
          />

          {/* Section 4: Shipment & Claims */}
          <ShipmentClaimsCard
            formData={formData}
            onChange={handleChange}
          />

          {/* Section 5: Remarks & Finalisation (with Attached Action Footer) */}
          <RemarksCard
            formData={formData}
            onChange={handleChange}
            onSignatureChange={(url) => setFormData(prev => ({ ...prev, signature_url: url }))}
            onPrint={() => setShowPrintSlip(true)}
            onBack={onCancel}
            onSave={handleSave}
            isLoading={loading}
          />
        </main>

        {/* Print Slip Modal */}
        {showPrintSlip && (
          <SaudaPrintSlip
            sauda={formData}
            onClose={() => setShowPrintSlip(false)}
          />
        )}
      </div>
    </LegacyLayout>
  );
}
