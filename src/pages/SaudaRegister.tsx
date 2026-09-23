import React, { useState, useEffect } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { createPortal } from 'react-dom';
import Papa from 'papaparse';
import { 
  HandCoins, 
  Search, 
  Download, 
  Printer, 
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  Filter,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUpRight,
  Calculator,
  ChevronDown,
  X,
  RefreshCcw,
  FileText,
  Edit,
  Trash2,
  Mail,
  Send,
  ClipboardList,
  Scale,
  IndianRupee
} from 'lucide-react';
import { cn, sanitizeCsvData, getApiUrl } from '../lib/utils';
import LegacyLayout, { LegacyFieldset, LegacyButton } from '../components/LegacyLayout';
import SaudaEntry from './SaudaEntry';
import SaudaPrintSlip from '../components/SaudaPrintSlip';
import { dbModule, flushOfflineQueue } from '../services/dbModule';
import { Sauda, SaudaQualityDetail } from '../types';
import { supabase } from '../lib/supabase';
import { enforceEditOrDeletePermission, canEditOrDelete, canViewCompletedData } from '../lib/permissions';
import { PaginationControls } from '../components/PaginationControls';
import { generateSaudaPdfBase64 } from '../lib/saudaPdf';

const compareQualities = (aStr: string, bStr: string): number => {
  const clean = (val: string) => {
    return String(val || '')
      .trim()
      .replace(/\.$/, '') // strip trailing dot
      .replace(/\s+/g, '') // strip all spaces
      .toUpperCase();
  };

  const a = clean(aStr);
  const b = clean(bStr);

  if (!a && !b) return 0;
  if (!a) return 1; // empty to the end
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

  if (rankA !== undefined && rankB !== undefined) {
    return rankA - rankB;
  }
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

    if (prefixA === prefixB) {
      return numA - numB;
    }
    return prefixA.localeCompare(prefixB);
  }

  return a.localeCompare(b);
};

const formatPoNumber = (sauda: any) => {
  if (!sauda) return '';
  if (sauda.session && sauda.session.trim()) {
    const s = sauda.session.trim();
    const parts = s.split('/').filter(Boolean);
    if (parts.length >= 3) {
      return s;
    }
    const base = s.endsWith('/') ? s : s + '/';
    return `${base}${sauda.sauda_no || ''}`;
  }
  const numPart = parseInt(sauda.sauda_no, 10);
  const val = isNaN(numPart) ? sauda.sauda_no : numPart;
  
  // Format the year suffix
  let yearPart = '26'; // fallback
  if (sauda.financial_year) {
    const startYear = sauda.financial_year.split('-')[0].trim();
    if (startYear.length >= 4) {
      yearPart = startYear.slice(-2);
    } else if (startYear.length === 2) {
      yearPart = startYear;
    }
  } else if (sauda.session && sauda.session.includes('/')) {
    const parts = sauda.session.split('/');
    if (parts.length > 1) {
      const yr = parts[1].split('-')[0].trim();
      if (yr.length >= 4) yearPart = yr.slice(-2);
    }
  }
  return `BJCL${val}/${yearPart}`;
};

// Helper to generate a high-fidelity retro HTML email representation of a Sauda Slip
const generateSaudaHtmlEmail = (s: Sauda) => {
  const qualityRows = (s.quality_details || []).map((q, idx) => `
    <tr style="height: 24px;">
      <td style="border: 1px solid #000; text-align: center; padding: 4px; font-size: 11px;">${idx + 1}</td>
      <td style="border: 1px solid #000; padding: 4px; font-size: 11px; font-weight: bold;">${q.quality}</td>
      <td style="border: 1px solid #000; text-align: right; padding: 4px; font-size: 11px; font-weight: bold;">${q.qty}</td>
      <td style="border: 1px solid #000; padding: 4px; font-size: 11px;">${q.agency || ''}</td>
      <td style="border: 1px solid #000; padding: 4px; font-size: 11px;">${q.marka || ''}</td>
      <td style="border: 1px solid #000; text-align: right; padding: 4px; font-size: 11px; font-weight: bold;">&#8377;${(q.rs || q.rate || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: 'Courier New', Courier, monospace; max-width: 700px; border: 2px solid #000; padding: 20px; background-color: #ffffff; color: #111;">
      <div style="font-size: 18px; font-weight: bold; text-align: center; text-transform: uppercase; color: #2a3088;">Bally Jute Company Limited</div>
      <div style="font-size: 11px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px; font-weight: bold; color: #555;">
        REGISTERED OFFICE: 5, SREE CHARAN SARANI, BALLY, HOWRAH - 711201
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px;">
        <tr>
          <td style="width: 50%;"><strong>SLIP NO:</strong> <span style="border-bottom: 1px dotted #000; display: inline-block; width: 150px;">&nbsp;${s.sauda_no || ''}</span></td>
          <td style="width: 50%; text-align: right;"><strong>P.O. TYPE:</strong> <span style="border-bottom: 1px dotted #000; display: inline-block; width: 150px; text-align: left;">&nbsp;${s.po_type || 'Normal'}</span></td>
        </tr>
        <tr>
          <td><strong>DATE:</strong> <span style="border-bottom: 1px dotted #000; display: inline-block; width: 150px;">&nbsp;${s.date ? new Date(s.date).toLocaleDateString('en-GB') : ''}</span></td>
          <td style="text-align: right;"><strong>SESSION:</strong> <span style="border-bottom: 1px dotted #000; display: inline-block; width: 150px; text-align: left;">&nbsp;${s.session || '2026-2027'}</span></td>
        </tr>
      </table>

      <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 6px 0; margin-bottom: 12px; font-size: 12px;">
        <tr>
          <td style="width: 130px; padding: 4px 0;"><strong>BROKER / VYAPARI:</strong></td>
          <td style="padding: 4px 0;"><span style="border-bottom: 1px dotted #000; display: block; width: 100%;">&nbsp;${s.broker || ''}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>SUPPLIER:</strong></td>
          <td style="padding: 4px 0;"><span style="border-bottom: 1px dotted #000; display: block; width: 100%;">&nbsp;${s.supplier || ''}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>CHALLAN SUPPLIER:</strong></td>
          <td style="padding: 4px 0;"><span style="border-bottom: 1px dotted #000; display: block; width: 100%;">&nbsp;${s.challan_supplier || ''}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>AREA / CENTER:</strong></td>
          <td style="padding: 4px 0;"><span style="border-bottom: 1px dotted #000; display: block; width: 100%;">&nbsp;${s.area || ''}</span></td>
        </tr>
      </table>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px;">
        <tr>
          <td style="width: 33%; padding: 4px 0;"><strong>NO. OF LORRIES:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.no_of_lorries || s.total_lorry || 1}</span></td>
          <td style="width: 33%; padding: 4px 0;"><strong>UNITS/LORRY:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.units_per_lorry_type || 'BALES'}</span></td>
          <td style="width: 34%; padding: 4px 0;"><strong>TOTAL UNIT:</strong> <span style="border-bottom: 1px dotted #000; font-weight: bold;">&nbsp;${s.total_unit || 0}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>WT/LORRY (MT):</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.wt_per_lorry || 10.28}</span></td>
          <td style="padding: 4px 0;"><strong>UNIT TYPE:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.unit_type || 'BALES'}</span></td>
          <td style="padding: 4px 0;"><strong>TOTAL WEIGHT (MT):</strong> <span style="border-bottom: 1px dotted #000; font-weight: bold;">&nbsp;${s.total_wt_in_ton || 0}</span></td>
        </tr>
      </table>

      <div style="font-size: 12px; font-weight: bold; margin-bottom: 6px; text-decoration: underline; color: #2a3088;">QUALITY / GRADE SPECIFICATION DETAILS:</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #000; padding: 4px; text-align: center; width: 40px;">SL.</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: left;">QUALITY / GRADE</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: right; width: 100px;">QUANTITY (BALES)</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: left; width: 150px;">AGENCY</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: left; width: 120px;">MARKA</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: right; width: 120px;">B. RATE (&#8377;/Qtl)</th>
          </tr>
        </thead>
        <tbody>
          ${qualityRows}
        </tbody>
      </table>

      <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #000; padding-top: 8px; margin-bottom: 12px; font-size: 11px;">
        <tr>
          <td style="width: 50%; padding: 4px 0;"><strong>SHIPMENT BY:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.shipment_date || ''}</span></td>
          <td style="width: 50%; padding: 4px 0;"><strong>SHIPMENT DAYS:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.shipment_days || s.delivery_days || 15} Days</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>PENALTY (&#8377;/Qtl/Day):</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;&#8377;${s.shipment_penalty || 5}</span></td>
          <td style="padding: 4px 0;"><strong>MARKS CLAIM (&#8377;/Qtl):</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;&#8377;${s.marks_claim || 0}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>QUANTITY CLAIM (Kg/Bale):</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.quantity_claim || 0} Kg</span></td>
          <td style="padding: 4px 0;"><strong>SUPERIOR / NORMAL MARKS:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.superior_normal_marks || ''}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>BOOK RATE (&#8377;/Qtl):</strong> <span style="border-bottom: 1px dotted #000; font-weight: bold;">&nbsp;&#8377;${(s.b_rate || 16300).toLocaleString()}</span></td>
          <td style="padding: 4px 0;"><strong>S. DATE:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.b_date || s.date || ''}</span></td>
        </tr>
      </table>

      <div style="font-size: 11px; margin-top: 10px;">
        <strong>REMARKS / INSTRUCTIONS:</strong><br/>
        <div style="border: 1px dashed #555; padding: 6px; min-height: 40px; margin-top: 4px; font-size: 10px; line-height: 1.3; background-color: #fafafa;">
          ${s.remarks || 'No specific terms or claims recorded.'}
        </div>
      </div>
    </div>
  `;
};

export default function SaudaRegister({ onClose, onNew, isActive = true }: { onClose?: () => void; onNew?: () => void; isActive?: boolean }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusTab, setStatusTab] = useState<'pending' | 'all'>('pending');
  const [saudaList, setSaudaList] = useState<Sauda[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [poList, setPoList] = useState<any[]>([]);
  const [scpList, setScpList] = useState<any[]>([]);
  const [arrivalsList, setArrivalsList] = useState<any[]>([]);
  const [editingSauda, setEditingSauda] = useState<Sauda | null>(null);
  const [printingSauda, setPrintingSauda] = useState<Sauda | null>(null);
  const [printingBook, setPrintingBook] = useState(false);
  const [selectedSaudaId, setSelectedSaudaId] = useState<string | null>(null);
  const [isAccountsModalOpen, setIsAccountsModalOpen] = useState(false);
  const [emailSendingStatus, setEmailSendingStatus] = useState<Record<string, 'idle' | 'sending' | 'success' | 'error'>>({});

  // 100-rows per page pagination (searches full dataset, displays paginated)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate, statusTab]);

  const handleSendMail = async (sauda: Sauda) => {
    const sId = sauda.sauda_id;
    if (!sId) return;

    setEmailSendingStatus(prev => ({ ...prev, [sId]: 'sending' }));

    try {
      let qDetails: SaudaQualityDetail[] = sauda.quality_details || [];
      
      // If quality details are not loaded on the row, fetch them from DB
      if (qDetails.length === 0 && supabase) {
        const { data, error } = await supabase
          .from('sauda_quality_details')
          .select('*')
          .eq('sauda_id', sId);
        if (!error && data) {
          qDetails = data;
        }
      }

      const fullSauda = {
        ...sauda,
        quality_details: qDetails
      };

      const emailHtml = generateSaudaHtmlEmail(fullSauda);
      const saudaPdfBase64 = generateSaudaPdfBase64(fullSauda);

      let recipientEmails = "";
      if (supabase) {
        const addedEmails = new Set<string>();
        
        // Lookup Broker in customer_master
        if (sauda.broker) {
          const { data: custBroker } = await supabase
            .from('customer_master')
            .select('email')
            .eq('firm_name', sauda.broker)
            .maybeSingle();
          if (custBroker?.email) {
            const email = custBroker.email.trim();
            if (email && !addedEmails.has(email.toLowerCase())) {
              recipientEmails += `, ${email}`;
              addedEmails.add(email.toLowerCase());
            }
          }
        }
        
        // Lookup Supplier in customer_master
        if (sauda.supplier) {
          const { data: custSupplier } = await supabase
            .from('customer_master')
            .select('email')
            .eq('firm_name', sauda.supplier)
            .maybeSingle();
          if (custSupplier?.email) {
            const email = custSupplier.email.trim();
            if (email && !addedEmails.has(email.toLowerCase())) {
              recipientEmails += `, ${email}`;
              addedEmails.add(email.toLowerCase());
            }
          }
        }
      }

      const res = await fetch(getApiUrl("/api/send-email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `📋 SAUDA SLIP CONTRACT: #${sauda.sauda_no} - [${sauda.broker || 'N/A'}]`,
          to: recipientEmails.split(',').map(e => e.trim()).filter(Boolean).join(', ') || 'rawjute@ballyjute.com',
          html: emailHtml,
          filename: `Sauda_Contract_${sauda.sauda_no || 'Draft'}.pdf`,
          pdfData: saudaPdfBase64 || undefined
        })
      });

      const resText = await res.text();
      let resData;
      try {
        resData = JSON.parse(resText);
      } catch (e) {
        throw new Error("Mail Dispatch Failed: " + (resText.substring(0, 100) || `Status ${res.status}`));
      }
      
      if (res.ok && resData.success) {
        setEmailSendingStatus(prev => ({ ...prev, [sId]: 'success' }));
        alert(`Email for Sauda #${sauda.sauda_no} sent successfully to ${recipientEmails}!`);
        setTimeout(() => {
          setEmailSendingStatus(prev => ({ ...prev, [sId]: 'idle' }));
        }, 3000);
      } else {
        throw new Error(resData.error || "Failed to send email");
      }
    } catch (err: any) {
      console.error(err);
      setEmailSendingStatus(prev => ({ ...prev, [sId]: 'error' }));
      alert(`Failed to send email: ${err.message || String(err)}`);
      setTimeout(() => {
        setEmailSendingStatus(prev => ({ ...prev, [sId]: 'idle' }));
      }, 3000);
    }
  };

  const handleCsvDownload = async () => {
    try {
      if (!supabase) {
        alert("Database connection client not loaded.");
        return;
      }
      const { data: fullData, error } = await supabase
        .from('sauda_master')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!fullData || fullData.length === 0) {
        alert("No Sauda contracts found in database to export.");
        return;
      }

      // Map raw columns to descriptive headers
      const dataToExport = fullData.map((row: any) => ({
        "Sauda ID": row.sauda_id,
        "Sauda Contract No": row.sauda_no,
        "Date": row.date ? new Date(row.date).toLocaleDateString('en-GB') : '',
        "Broker": row.broker || '',
        "Supplier / Merchant": row.supplier || '',
        "Marka / Marks": row.marks || '',
        "Units per Lorry Type": row.units_per_lorry_type || '',
        "Total Unit": row.total_unit || 0,
        "B. Rate (Rs)": row.b_rate || 0,
        "Total Wt In Ton": row.total_wt_in_ton || 0,
        "Status": (row.status || '').toUpperCase(),
        "Financial Year": row.financial_year || '',
        "Created At": row.created_at || ''
      }));

      const sanitizedData = sanitizeCsvData(dataToExport);
      const csv = Papa.unparse(sanitizedData);
      const csvContent = "\uFEFF" + csv; // Add UTF-8 BOM so excel reads unicode correctly
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Sauda_Register_Full_Export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error("CSV Export failed:", err);
      alert("Failed to export: " + err.message);
    }
  };

  const fetchSaudas = async () => {
    setIsRefreshing(true);
    try {
      if (navigator.onLine) await flushOfflineQueue().catch(() => {});
      const [saudasData, posData, arrivalsData, scpData] = await Promise.all([
        dbModule.fetchAll('sauda_master', 'created_at', false),
        dbModule.fetchAll('purchase_master').catch(() => []),
        dbModule.fetchAll('temporary_material_received', 'created_at', false).catch(() => []),
        dbModule.fetchAll('sauda_check_point').catch(() => [])
      ]);
      setSaudaList(saudasData || []);
      setPoList(posData || []);
      setArrivalsList(arrivalsData || []);
      setScpList(scpData || []);
    } catch(e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useLiveAutoRefresh(() => {
    if (isActive) fetchSaudas();
  }, [isActive], { tables: ['sauda_master', 'sms_sauda', 'purchase_master', 'temporary_material_received', 'sauda_check_point', 'sauda_check_point_details'] });

  useEffect(() => {
    if (isActive) {
      fetchSaudas();
    }

    const handleDataUpdate = () => {
      fetchSaudas();
    };

    window.addEventListener('app-data-updated', handleDataUpdate);
    window.addEventListener('storage', handleDataUpdate);

    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel('sauda-register-realtime-sub')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_check_point' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'final_po' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_master' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_quality_details' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_master' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_sauda' }, handleDataUpdate)
        .subscribe();
    }

    return () => {
      window.removeEventListener('app-data-updated', handleDataUpdate);
      window.removeEventListener('storage', handleDataUpdate);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [isActive]);

  const handleDelete = async (id: string) => {
    if (!enforceEditOrDeletePermission("Delete")) {
      return;
    }

    if (confirm("Are you sure you want to delete this Sauda?")) {
      try {
        if (supabase) {
          await supabase.from('sauda_quality_details').delete().eq('sauda_id', id);
        }
        await dbModule.delete('sauda_master', 'sauda_id', id);
        alert("Sauda deleted permanently.");
        await fetchSaudas();
      } catch (e: any) {
        console.error("Delete Sauda error:", e);
        alert("Failed to delete Sauda: " + (e.message || e));
      }
    }
  };

  const handleEdit = async (sauda: Sauda) => {
    if (!enforceEditOrDeletePermission("Edit")) {
      return;
    }
    // Fetch quality details for this sauda
    try {
      if (dbModule) {
        const { supabase } = await import('../lib/supabase.ts');
        if (supabase) {
           const { data } = await supabase.from('sauda_quality_details').select('*').eq('sauda_id', sauda.sauda_id);
           const sorted = (data || []).sort((a: any, b: any) => compareQualities(a.quality || '', b.quality || ''));
           sauda.quality_details = sorted;
        }
      }
    } catch(e) { console.error("Could not fetch qualities", e); }
    
    setEditingSauda(sauda);
  };

  const handlePrint = async (sauda: Sauda) => {
    let fullSauda = { ...sauda };
    try {
      if (dbModule) {
        const { supabase } = await import('../lib/supabase.ts');
        if (supabase) {
           const { data } = await supabase.from('sauda_quality_details').select('*').eq('sauda_id', sauda.sauda_id);
           const sorted = (data || []).sort((a: any, b: any) => compareQualities(a.quality || '', b.quality || ''));
           if (sorted && sorted.length > 0) fullSauda.quality_details = sorted;
        }
      }
    } catch(e) { console.error("Could not fetch qualities", e); }
    
    setPrintingSauda(fullSauda);
  };

  if (printingSauda) {
    const portalModal = (
      <div className="fixed inset-0 z-[200] bg-[#525659] flex flex-col print:bg-white print:static print:z-auto print-modal">
        <style>{`
          @media print {
            /* Bulletproof print reset: completely hide everything in #root and outside of the print modal */
            #root {
               display: none !important;
            }
            .no-print {
               display: none !important;
            }
            /* Reset body limits to allow natural print flow */
            html, body {
               height: auto !important;
               min-height: 0 !important;
               overflow: visible !important;
               max-height: none !important;
               background: white !important;
               border: none !important;
               box-shadow: none !important;
               padding: 0 !important;
               margin: 0 !important;
            }
            /* Position print content perfectly at page start */
            .print-modal {
               position: static !important;
               background: white !important;
               box-shadow: none !important;
               border: none !important;
               margin: 0 !important;
               padding: 0 !important;
               width: 100% !important;
               height: auto !important;
            }
            @page {
               size: A5 portrait;
               margin: 0;
            }
          }
        `}</style>
        {/* Viewer Toolbar */}
        <div className="flex-none bg-[#323639] shadow-md px-6 py-3 flex justify-between items-center no-print">
          <div className="flex items-center gap-4">
             <button onClick={() => setPrintingSauda(null)} className="p-2 text-gray-300 hover:bg-white/10 rounded-full transition">
               <ArrowLeft className="w-5 h-5" />
             </button>
             <span className="text-white font-medium">Sauda_Contract_#{printingSauda.sauda_no}.pdf</span>
          </div>
          <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded shadow flex items-center gap-2 font-bold transition">
             <Printer className="w-4 h-4" /> Print
          </button>
        </div>

        {/* Scrollable Canvas */}
        <div className="flex-1 overflow-y-auto p-8 flex justify-center print:p-0 print:overflow-visible">
           <SaudaPrintSlip sauda={printingSauda} />
        </div>
      </div>
    );

    return createPortal(portalModal, document.body);
  }

  if (editingSauda) {
    return (
       <SaudaEntry 
         initialData={editingSauda} 
         onCancel={() => setEditingSauda(null)} 
         onSave={() => { setEditingSauda(null); fetchSaudas(); }} 
       />
    );
  }

  // Check if a Sauda contract has already been entered into Sauda Check Point or Final P.O.
  function isSaudaInCheckPointOrPo(s: Sauda) {
    if (!s) return false;
    const statusVal = String((s as any).status || '').toLowerCase();
    if (statusVal === 'completed' || statusVal === 'in_check_point' || statusVal === 'in_po' || statusVal === 'final') {
      return true;
    }

    const sId = String(s.sauda_id || (s as any).id || '').trim().toUpperCase();
    const sNo = String(s.sauda_no || '').trim().toUpperCase();
    const sSession = String(s.session || '').trim().toUpperCase();
    const sDisplay = (formatPoNumber(s) || '').trim().toUpperCase();

    const getCleanDigits = (str: string) => {
      if (!str) return '';
      const clean = String(str).trim().toUpperCase();
      const withoutPrefix = clean
        .replace(/^BJCL\//i, '')
        .replace(/^BJC\//i, '')
        .replace(/^BJC/i, '')
        .replace(/^PO[-/]/i, '')
        .replace(/^PTF[-/]/i, '');
      const withoutYear = withoutPrefix
        .replace(/20\d{2}-20\d{2}/g, '')
        .replace(/20\d{2}\/20\d{2}/g, '')
        .replace(/20\d{2}20\d{2}/g, '')
        .replace(/\/\d{2}-\d{2}$/g, '')
        .replace(/^\d{2}-\d{2}\//g, '')
        .replace(/[^0-9]/g, '');
      return withoutYear.replace(/^0+/, '');
    };

    const sNoDigits = getCleanDigits(sNo);
    const sDisplayDigits = getCleanDigits(sDisplay);
    const sSessionDigits = getCleanDigits(sSession);

    const allPoSources = [...(scpList || []), ...(poList || [])];

    return allPoSources.some(p => {
      if (!p) return false;
      const pSaudaId = String(p.sauda_id || p.sauda_id_ref || '').trim().toUpperCase();
      if (sId && pSaudaId && sId === pSaudaId) return true;

      const pPo = String(p.po_no || '').trim().toUpperCase();
      const pContract = String(p.contract_po_no || '').trim().toUpperCase();
      const pSaudaNo = String(p.sauda_no || p.po_contract || p.contract_no || '').trim().toUpperCase();
      const pPtf = String(p.ptf_no || '').trim().toUpperCase();

      const pTokens = [pPo, pContract, pSaudaNo, pPtf].filter(Boolean);
      if (pTokens.some(tok => tok === sNo || tok === sDisplay || tok === sSession)) {
        return true;
      }

      for (const tok of pTokens) {
        const tokDigits = getCleanDigits(tok);
        if (sNoDigits && tokDigits && sNoDigits === tokDigits) return true;
        if (sDisplayDigits && tokDigits && sDisplayDigits === tokDigits) return true;
        if (sSessionDigits && tokDigits && sSessionDigits === tokDigits) return true;
      }

      return false;
    });
  }

  // Function declaration (hoisted) so getSaudaStatusAndWeight can use it even when
  // called from the filter above — avoids a "before initialization" crash.
  function matchPoNo(po1: string, po2: string) {
    if (!po1 || !po2) return false;
    const p1 = po1.trim().toLowerCase();
    const p2 = po2.trim().toLowerCase();
    if (p1 === p2) return true;

    const clean1 = p1.replace(/[^a-z0-9]/g, '');
    const clean2 = p2.replace(/[^a-z0-9]/g, '');
    if (clean1 && clean1 === clean2) return true;

    if (clean1.length > 5 && clean2.length > 5 && (clean1.includes(clean2) || clean2.includes(clean1))) {
      return true;
    }

    const num1 = p1.replace(/[^0-9]/g, '');
    const num2 = p2.replace(/[^0-9]/g, '');
    if (num1.length >= 4 && num2.length >= 4 && (num1.includes(num2) || num2.includes(num1))) {
      return true;
    }
    return false;
  }

  function getSaudaStatusAndWeight(s: Sauda) {
    const isMovedToCheckPoint = isSaudaInCheckPointOrPo(s);
    if (isMovedToCheckPoint) {
      return {
        status: 'completed',
        receivedWeight: 0,
        contractWeight: Number(s.total_wt_in_ton) || 0
      };
    }

    const saudaPoDisplayNo = formatPoNumber(s);
    
    const matchSaudaWithPo = (saudaNumStr: string, poNoStr: string, contractPoNoStr?: string) => {
      if (!saudaNumStr || !poNoStr) return false;
      const sNoClean = saudaNumStr.trim().toUpperCase().replace(/[^0-9]/g, '');
      if (!sNoClean) return false;

      const checkMatch = (p: string) => {
        const pUpper = p.trim().toUpperCase();
        if (pUpper === saudaNumStr.trim().toUpperCase()) return true;

        const pNoClean = pUpper.replace(/[^0-9]/g, '');
        let pNoDigits = pNoClean;
        pNoDigits = pNoDigits.replace(/20\d{2}20\d{2}/g, ''); // strip "20262027"
        pNoDigits = pNoDigits.replace(/\d{4}/g, ''); // strip remaining 4-digit blocks
        
        const cleanS = sNoClean.replace(/^0+/, '');
        const cleanP = pNoDigits.replace(/^0+/, '');

        if (cleanS && cleanP && cleanS === cleanP) {
          return true;
        }

        const regex = new RegExp(`(^|[^0-9])${sNoClean}([^0-9]|$)`);
        return regex.test(pUpper);
      };

      return checkMatch(poNoStr) || (contractPoNoStr ? checkMatch(contractPoNoStr) : false);
    };

    const matchedPos = poList.filter(p => {
      const pNo = String(p.po_no || '');
      const cpNo = String(p.contract_po_no || '');
      return (
        matchSaudaWithPo(String(s.sauda_no || ''), pNo, cpNo) ||
        matchSaudaWithPo(saudaPoDisplayNo, pNo, cpNo)
      );
    });

    let totalContractMt = 0;
    let totalReceivedMt = 0;
    let anyPoIsPending = false;

    // Check if arrivals has entries matching these POs
    matchedPos.forEach(p => {
      const contractWeight = parseFloat(p.total_contract_mt) || 0;
      totalContractMt += contractWeight;

      const matchingArrivals = (arrivalsList || []).filter((ar: any) => 
        matchPoNo(p.po_no, ar.po_no) || matchPoNo(p.contract_po_no, ar.po_no)
      );
      const poReceived = matchingArrivals.reduce((sum: number, ar: any) => {
        return sum + (Number(ar.weight_qtl || ar.weight || 0) / 10);
      }, 0);
      totalReceivedMt += poReceived;

      const isDbCompleted = p.pending === false || p.pending === 'No' || String(p.pending).toLowerCase() === 'false' || p.pending === 0;
      const isWeightCompleted = contractWeight > 0 && poReceived >= (contractWeight - 0.01);
      if (!(isDbCompleted || isWeightCompleted)) {
        anyPoIsPending = true;
      }
    });

    if (matchedPos.length === 0) {
      const isDbCompleted = s.status === 'completed';
      return {
        status: isDbCompleted ? 'completed' : 'pending',
        receivedWeight: 0,
        contractWeight: Number(s.total_wt_in_ton) || 0
      };
    }

    const isCompleted = !anyPoIsPending;
    const isPartial = !isCompleted && totalReceivedMt > 0;
    const status = isCompleted ? 'completed' : (isPartial ? 'partial' : 'pending');

    return {
      status,
      receivedWeight: totalReceivedMt,
      contractWeight: totalContractMt
    };
  }

  const filteredSaudas = saudaList.filter(s => {
    // When viewing Pending mode (default), hide Saudas that have moved into Sauda Check Point or P.O.
    const isAlreadyMovedToCheckPoint = isSaudaInCheckPointOrPo(s);
    if (statusTab === 'pending' && isAlreadyMovedToCheckPoint) {
      return false;
    }

    const term = searchTerm.toLowerCase().trim();
    const saudaDisplayNo = (formatPoNumber(s) || '').toLowerCase();
    const matchesSearch = !term || 
      (s.sauda_no || '').toLowerCase().includes(term) ||
      (s.session || '').toLowerCase().includes(term) ||
      saudaDisplayNo.includes(term) ||
      (s.broker || '').toLowerCase().includes(term) || 
      (s.supplier || '').toLowerCase().includes(term) ||
      (s.challan_supplier || '').toLowerCase().includes(term) ||
      (s.marks || '').toLowerCase().includes(term) ||
      (s.area || '').toLowerCase().includes(term) ||
      (s.agency || '').toLowerCase().includes(term) ||
      (s.remarks || '').toLowerCase().includes(term);
      
    if (!matchesSearch) return false;

    if (startDate && (!s.date || new Date(s.date) < new Date(startDate))) return false;
    if (endDate && (!s.date || new Date(s.date) > new Date(endDate))) return false;

    if (!canViewCompletedData()) {
      const saudaStatus = getSaudaStatusAndWeight(s).status;
      if (saudaStatus === 'completed') return false;
    }

    return true;
  }).sort((a, b) => new Date(b.date || (b as any).b_date || (b as any).created_at || 0).getTime() - new Date(a.date || (a as any).b_date || (a as any).created_at || 0).getTime());

  const pendingSaudas = saudaList.filter(s => !isSaudaInCheckPointOrPo(s));
  const completedSaudas = saudaList.filter(s => isSaudaInCheckPointOrPo(s));
  const pendingSaudasCount = pendingSaudas.length;
  const totalSaudas = saudaList.length;
  const pendingWeightTons = pendingSaudas.reduce((acc, s) => acc + (Number(s.total_wt_in_ton) || 0), 0);
  const totalWeightTons = saudaList.reduce((acc, s) => acc + (Number(s.total_wt_in_ton) || 0), 0);
  const displayedWeightTons = filteredSaudas.reduce((acc, s) => acc + (Number(s.total_wt_in_ton) || 0), 0);
  const bookTotalValue = filteredSaudas.reduce((acc, s) => acc + (Number(s.b_rate || 0) * Number(s.total_wt_in_ton || 0)), 0);

  return (
    <LegacyLayout title="Sauda Desk" subtitle="Bally Jute Limited ERP Console" onClose={onClose}>
      <div className="space-y-4 relative pb-10 font-sans">
        {/* 1. Four Modern Enterprise KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Active Pending Saudas */}
          <div className="bg-white rounded-[18px] border border-slate-200/90 p-4 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between">
            <div>
              <p className="text-2xl font-black text-slate-800 tracking-tight font-mono">{pendingSaudasCount}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Active Pending Saudas</p>
              <p className="text-[9px] font-semibold text-rose-500 mt-0.5">Awaiting Check Point</p>
            </div>
            <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-2xl text-rose-600 shadow-2xs">
              <Clock className="h-6 w-6" />
            </div>
          </div>

          {/* Card 2: Total Registered Saudas */}
          <div className="bg-white rounded-[18px] border border-slate-200/90 p-4 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between">
            <div>
              <p className="text-2xl font-black text-slate-800 tracking-tight font-mono">{totalSaudas}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Total Registered Saudas</p>
              <p className="text-[9px] font-semibold text-slate-400 mt-0.5">{completedSaudas.length} in Check Point</p>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200/80 rounded-2xl text-blue-600 shadow-2xs">
              <ClipboardList className="h-6 w-6" />
            </div>
          </div>

          {/* Card 3: Cumulative Sauda Weight */}
          <div className="bg-white rounded-[18px] border border-slate-200/90 p-4 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between">
            <div>
              <p className="text-2xl font-black text-slate-800 tracking-tight font-mono">
                {(statusTab === 'pending' ? pendingWeightTons : totalWeightTons).toFixed(2)} <span className="text-sm font-semibold text-slate-500">Tons</span>
              </p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                {statusTab === 'pending' ? "Pending Sauda Weight" : "Cumulative Sauda Weight"}
              </p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-2xl text-emerald-700 shadow-2xs">
              <Scale className="h-6 w-6" />
            </div>
          </div>

          {/* Card 4: Book Total Value */}
          <div className="bg-white rounded-[18px] border border-slate-200/90 p-4 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between">
            <div>
              <p className="text-2xl font-black text-slate-800 tracking-tight font-mono">
                ₹{bookTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                {statusTab === 'pending' ? "Pending Book Value" : "Book Total Value"}
              </p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-amber-600 shadow-2xs">
              <IndianRupee className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* 2. Large Search & Date Filter Section */}
        <div className="bg-white border border-slate-200 rounded-[18px] p-3 shadow-xs flex flex-wrap lg:flex-nowrap items-center gap-3 justify-between">
          {/* Segmented View Switcher: Pending vs All */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
            <button
              type="button"
              onClick={() => setStatusTab('pending')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                statusTab === 'pending'
                  ? "bg-[#174C2C] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <span>Pending Saudas</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                statusTab === 'pending' ? "bg-emerald-700/80 text-white" : "bg-slate-200 text-slate-600"
              )}>
                {pendingSaudasCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusTab('all')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                statusTab === 'all'
                  ? "bg-[#174C2C] text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <span>All Saudas History</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                statusTab === 'all' ? "bg-emerald-700/80 text-white" : "bg-slate-200 text-slate-600"
              )}>
                {totalSaudas}
              </span>
            </button>
          </div>

          {/* Large Search Box */}
          <div className="relative flex-1 min-w-0 sm:min-w-[220px] w-full sm:w-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input  id="search_broker_or_supplier_830" name="search_broker_or_supplier" aria-label="Search Broker or Supplier..."
              type="text"
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#174C2C]/20 focus:border-[#174C2C] transition-all" 
              placeholder="Search Broker or Supplier..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Date Filters & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">From</span>
              <input  id="startdate_843" name="startdate" aria-label="startdate"
                type="date" 
                className="bg-transparent font-medium text-slate-700 outline-none text-xs" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">To</span>
              <input  id="enddate_853" name="enddate" aria-label="enddate"
                type="date" 
                className="bg-transparent font-medium text-slate-700 outline-none text-xs" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
              />
            </div>

            <button 
              onClick={() => { setSearchTerm(''); setStartDate(''); setEndDate(''); }}
              className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95" 
              title="Clear search and filter"
            >
              <X className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>

            <button 
              onClick={fetchSaudas}
              disabled={isRefreshing}
              className="px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              title="Refresh Sauda database"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* 3. Action Toolbar (Green Filled & White Outline Buttons) */}
        <div className="flex flex-wrap items-center justify-between gap-3 my-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onNew}
              className="bg-[#174C2C] hover:bg-[#103A20] text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-xs hover:shadow transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus className="h-4 w-4 text-amber-300" />
              <span>New Sauda</span>
            </button>

            <button
              onClick={() => {
                if (selectedSaudaId) {
                  const sauda = saudaList.find(s => s.sauda_id === selectedSaudaId);
                  if (sauda) handlePrint(sauda);
                } else {
                  setPrintingBook(true);
                }
              }}
              className="bg-white hover:bg-slate-50 text-slate-700 hover:text-[#174C2C] border border-slate-300 hover:border-[#174C2C] px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Printer className="h-4 w-4" />
              <span>Print Book</span>
            </button>

            <button
              onClick={handleCsvDownload}
              className="bg-white hover:bg-slate-50 text-slate-700 hover:text-[#174C2C] border border-slate-300 hover:border-[#174C2C] px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              title="Download full Sauda Contract database as CSV"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setIsAccountsModalOpen(true)}
              className="bg-white hover:bg-slate-50 text-slate-700 hover:text-[#174C2C] border border-slate-300 hover:border-[#174C2C] px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Calculator className="h-4 w-4" />
              <span>Accounts</span>
            </button>
          </div>

          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl px-4 py-1.5 flex flex-col text-right">
            <span className="text-[10px] font-extrabold uppercase text-amber-800 tracking-wider">Book Total Value</span>
            <span className="text-base font-black text-[#174C2C] font-mono">
              ₹{bookTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* 4. Data Table */}
        <div className="bg-white border border-slate-200 rounded-[18px] shadow-xs overflow-hidden">
          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full border-collapse text-xs min-w-[1050px]">
              <thead className="bg-slate-100/90 border-b border-slate-200 sticky top-0 z-10">
                <tr className="h-10 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="px-3 py-2 text-center">Date</th>
                  <th className="px-3 py-2 text-center">Order No.</th>
                  <th className="px-3 py-2 text-center">Session</th>
                  <th className="px-4 py-2 text-left">Broker</th>
                  <th className="px-4 py-2 text-left">Supplier</th>
                  <th className="px-3 py-2 text-center">Unit/Lorry</th>
                  <th className="px-3 py-2 text-right">T. Unit</th>
                  <th className="px-4 py-2 text-right bg-blue-50/60 text-blue-900">B. Rate</th>
                  <th className="px-3 py-2 text-center">Status</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSaudas.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((entry, idx) => {
                  const isSelected = selectedSaudaId === entry.sauda_id;
                  const { status: st } = getSaudaStatusAndWeight(entry);
                  return (
                    <tr 
                      key={entry.sauda_id} 
                      onClick={() => setSelectedSaudaId(entry.sauda_id!)}
                      onDoubleClick={() => { if (canEditOrDelete()) handleEdit(entry); }}
                      className={cn(
                        "h-10 cursor-pointer transition-colors text-xs font-medium", 
                        isSelected 
                          ? "bg-[#174C2C] text-white" 
                          : (idx % 2 === 0 ? "bg-white hover:bg-amber-50/50" : "bg-slate-50/40 hover:bg-amber-50/50")
                      )}
                    >
                      <td className={cn("px-3 text-center font-mono text-[11px]", isSelected ? "text-white" : "text-slate-500")}>
                        {new Date(entry.date).toLocaleDateString('en-GB')}
                      </td>
                      <td className={cn("px-3 text-center font-bold", isSelected ? "text-amber-300" : "text-slate-900")}>
                        #{entry.sauda_no}
                      </td>
                      <td className={cn("px-3 text-center text-[10px] font-mono", isSelected ? "text-emerald-100" : "text-slate-500")}>
                        {entry.session}
                      </td>
                      <td className="px-4 font-bold uppercase truncate max-w-[150px]">
                        {entry.broker}
                      </td>
                      <td className={cn("px-4 uppercase truncate max-w-[150px]", isSelected ? "text-emerald-100" : "text-slate-600")}>
                        {entry.supplier}
                      </td>
                      <td className="px-3 text-center text-slate-700">
                        {entry.units_per_lorry_type}
                      </td>
                      <td className="px-3 text-right font-bold font-mono">
                        {entry.total_unit}
                      </td>
                      <td className={cn("px-4 text-right font-black font-mono", isSelected ? "text-amber-300 bg-[#123e24]" : "text-rose-700 bg-rose-50/30")}>
                        ₹{Number(entry.b_rate).toLocaleString()}
                      </td>
                      <td className="px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span 
                            className={cn(
                              "inline-block w-2 h-2 rounded-full shrink-0", 
                              st === 'completed' ? 'bg-emerald-500' : st === 'partial' ? 'bg-blue-500' : 'bg-amber-500'
                            )} 
                          />
                          <span className={cn("font-bold text-[11px] font-mono whitespace-nowrap", isSelected ? "text-white" : "text-slate-800")}>
                            {(Number(entry.total_wt_in_ton) || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} Ton
                          </span>
                        </div>
                      </td>
                      <td className="px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {canEditOrDelete() && (
                            <>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleEdit(entry); }} 
                                className="p-1.5 hover:bg-black/10 rounded-lg transition-colors cursor-pointer"
                                title="Edit Sauda"
                              >
                                <Edit className={cn("w-3.5 h-3.5", isSelected ? "text-white" : "text-blue-600")} />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(entry.sauda_id!); }} 
                                className="p-1.5 hover:bg-black/10 rounded-lg transition-colors cursor-pointer"
                                title="Delete Sauda"
                              >
                                <Trash2 className={cn("w-3.5 h-3.5", isSelected ? "text-white" : "text-rose-600")} />
                              </button>
                            </>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); handlePrint(entry); }} 
                            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors cursor-pointer"
                            title="Print Sauda Slip"
                          >
                            <Printer className={cn("w-3.5 h-3.5", isSelected ? "text-white" : "text-slate-600")} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleSendMail(entry); }} 
                            className={cn(
                              "p-1.5 rounded-lg cursor-pointer transition-all",
                              emailSendingStatus[entry.sauda_id || ''] === 'sending' && "text-amber-600 bg-amber-50 border border-amber-300",
                              emailSendingStatus[entry.sauda_id || ''] === 'success' && "text-emerald-700 bg-emerald-50 border border-emerald-300",
                              emailSendingStatus[entry.sauda_id || ''] === 'error' && "text-rose-600 bg-rose-50 border border-rose-300",
                              (!emailSendingStatus[entry.sauda_id || ''] || emailSendingStatus[entry.sauda_id || ''] === 'idle') && (isSelected ? "text-white hover:bg-white/20" : "text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50")
                            )}
                            disabled={emailSendingStatus[entry.sauda_id || ''] === 'sending'}
                            title="Send Sauda Contract Slip via Email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredSaudas.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-14 text-center text-slate-500 bg-slate-50/50">
                      <div className="flex flex-col items-center justify-center space-y-2.5">
                        <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                          <ClipboardList className="h-8 w-8 text-[#174C2C]" />
                        </div>
                        <p className="font-bold text-sm text-slate-700">
                          {statusTab === 'pending'
                            ? "No Active Pending Saudas"
                            : "No Sauda Records Found"}
                        </p>
                        <p className="text-xs text-slate-500 max-w-md">
                          {statusTab === 'pending'
                            ? "All registered Saudas have been entered and moved to Sauda Check Point. Only uncompleted / pending Saudas will appear here."
                            : "No Sauda contracts match the selected search or date criteria."}
                        </p>
                        {statusTab === 'pending' && totalSaudas > 0 && (
                          <button
                            type="button"
                            onClick={() => setStatusTab('all')}
                            className="mt-1 px-4 py-2 bg-white border border-slate-300 hover:border-[#174C2C] hover:bg-emerald-50/40 rounded-xl text-xs font-bold text-[#174C2C] transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                          >
                            <span>View All Saudas History ({totalSaudas})</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <PaginationControls
            currentPage={currentPage}
            totalItems={filteredSaudas.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />

          {/* Quick Summary Footer Bar inside Card */}
          <div className="bg-slate-50 border-t border-slate-200 p-3 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total Saudas</p>
                <p className="text-xs font-black text-slate-800">{filteredSaudas.length}</p>
              </div>
              <div className="bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cumulative Weight</p>
                <p className="text-xs font-black text-slate-800 font-mono">
                  {filteredSaudas.reduce((acc, s) => acc + Number(s.total_wt_in_ton || 0), 0).toFixed(2)} Ton
                </p>
              </div>
            </div>

            <div className="bg-white px-4 py-1.5 rounded-xl border border-slate-200 shadow-2xs text-right">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Filtered Book Value</p>
              <p className="text-xs font-black text-[#174C2C] font-mono">
                ₹{bookTotalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* 5. Floating Quick Action Button */}
        <button
          onClick={onNew}
          className="fixed bottom-12 right-8 z-30 bg-[#174C2C] hover:bg-[#103A20] text-white p-4 rounded-2xl shadow-xl flex items-center gap-2.5 font-bold text-xs transition-all hover:scale-105 active:scale-95 cursor-pointer border border-[#0d301b] group"
          title="Quick Add New Sauda"
        >
          <Plus className="h-5 w-5 text-amber-300 group-hover:rotate-90 transition-transform duration-300" />
          <span className="pr-1">Quick Add</span>
        </button>
      </div>

      {printingBook && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 no-print">
          <div className="bg-[#d4d0c8] border-2 border-white border-r-gray-800 border-b-gray-800 p-1 w-96 shadow-lg">
            <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-2 py-1 flex items-center justify-between text-white font-bold text-sm">
              <span>Print Preview</span>
              <button onClick={() => setPrintingBook(false)} className="hover:bg-red-500 px-1 rounded-sm">✕</button>
            </div>
            <div className="p-6 bg-[#d4d0c8] flex flex-col items-center">
              <Printer className="w-12 h-12 text-gray-700 mb-4" />
              <p className="text-center font-bold text-sm mb-2">Print Sauda Register Book</p>
              <p className="text-center text-xs text-gray-600 mb-6">Are you sure you want to print the current register view? The view will be printed exactly as shown in the table.</p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => {
                    window.print();
                    setPrintingBook(false);
                  }} 
                  className="px-6 py-1.5 bg-[#d4d0c8] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-r-white active:border-b-white active:border-t-gray-800 active:border-l-gray-800 focus:outline-none focus:ring-1 focus:ring-black font-bold flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> Print
                </button>
                <button 
                  onClick={() => setPrintingBook(false)} 
                  className="px-6 py-1.5 bg-[#d4d0c8] border-2 border-white border-r-gray-800 border-b-gray-800 active:border-r-white active:border-b-white active:border-t-gray-800 active:border-l-gray-800 focus:outline-none focus:ring-1 focus:ring-black"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAccountsModalOpen && (
        <AccountsModal 
          saudaList={saudaList}
          poList={poList}
          arrivalsList={arrivalsList}
          onClose={() => setIsAccountsModalOpen(false)}
        />
      )}
    </LegacyLayout>
  );
}

function Th({ label, className }: any) {
  return (
    <th className={cn("text-[9px] font-bold uppercase tracking-tight text-gray-600 border-r border-[#808080]/30 h-full px-2", className)}>
       <div className="flex items-center justify-center gap-1">
          {label}
          <ChevronDown className="h-2.5 w-2.5 text-gray-400" />
       </div>
    </th>
  )
}

function AccountsModal({ saudaList, poList, arrivalsList, onClose }: any) {
  function matchPoNo(po1: string, po2: string) {
    if (!po1 || !po2) return false;
    const p1 = po1.trim().toLowerCase();
    const p2 = po2.trim().toLowerCase();
    if (p1 === p2) return true;
    const clean1 = p1.replace(/[^a-z0-9]/g, '');
    const clean2 = p2.replace(/[^a-z0-9]/g, '');
    if (clean1 && clean1 === clean2) return true;
    if (clean1.length > 5 && clean2.length > 5 && (clean1.includes(clean2) || clean2.includes(clean1))) return true;
    return false;
  }

  function getSaudaStatusAndWeight(s: Sauda) {
    const saudaPoDisplayNo = (s.sauda_no || '').replace(/[^0-9]/g, '');
    const matchedPos = poList.filter((p: any) => {
      const pNo = String(p.po_no || '');
      const cpNo = String(p.contract_po_no || '');
      return matchPoNo(String(s.sauda_no || ''), pNo) || matchPoNo(String(s.sauda_no || ''), cpNo) || 
             matchPoNo(saudaPoDisplayNo, pNo) || matchPoNo(saudaPoDisplayNo, cpNo);
    });

    let totalContractMt = 0;
    let totalReceivedMt = 0;
    let anyPoIsPending = false;

    matchedPos.forEach((p: any) => {
      const contractWeight = parseFloat(p.total_contract_mt) || 0;
      totalContractMt += contractWeight;
      const matchingArrivals = arrivalsList.filter((ar: any) => matchPoNo(p.po_no, ar.po_no) || matchPoNo(p.contract_po_no, ar.po_no));
      const poReceived = matchingArrivals.reduce((sum: number, ar: any) => sum + (Number(ar.weight_qtl || ar.weight || 0) / 10), 0);
      totalReceivedMt += poReceived;
      const isDbCompleted = p.pending === false || p.pending === 'No' || String(p.pending).toLowerCase() === 'false' || p.pending === 0;
      const isWeightCompleted = contractWeight > 0 && poReceived >= (contractWeight - 0.01);
      if (!(isDbCompleted || isWeightCompleted)) {
        anyPoIsPending = true;
      }
    });

    if (matchedPos.length === 0) {
      const isDbCompleted = s.status === 'completed';
      return { status: isDbCompleted ? 'completed' : 'pending', receivedWeight: 0, contractWeight: Number(s.total_wt_in_ton) || 0 };
    }

    const isCompleted = !anyPoIsPending;
    const isPartial = !isCompleted && totalReceivedMt > 0;
    return {
      status: isCompleted ? 'completed' : (isPartial ? 'partial' : 'pending'),
      receivedWeight: totalReceivedMt,
      contractWeight: totalContractMt
    };
  }

  const ledgerData = saudaList.map((s: Sauda) => {
    const { status, receivedWeight, contractWeight } = getSaudaStatusAndWeight(s);
    const b_rate = Number(s.b_rate) || 0;
    const total_wt = Number(s.total_wt_in_ton) || 0;
    let pendingWt = total_wt - receivedWeight;
    if (pendingWt < 0) pendingWt = 0;
    if (status === 'completed') pendingWt = 0;
    const pendingValue = pendingWt * b_rate;
    return { ...s, status, receivedWeight, pendingWt, pendingValue };
  }).filter((s: any) => s.pendingWt > 0.01)
  .sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

  const totalPendingWt = ledgerData.reduce((acc: number, s: any) => acc + s.pendingWt, 0);
  const totalPendingValue = ledgerData.reduce((acc: number, s: any) => acc + s.pendingValue, 0);

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-[#ece9d8] w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl border-2 border-white border-r-gray-800 border-b-gray-800 rounded-md overflow-hidden">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-2 flex justify-between items-center shrink-0 shadow-sm border-b border-gray-400">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-white drop-shadow" />
            <h2 className="text-white font-bold text-sm uppercase tracking-wider drop-shadow-md">Accounts / Pending Sauda Ledger</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded active:bg-black/20 transition-colors">
            <X className="h-4 w-4 text-white" />
          </button>
        </div>

        {/* Stats Summary */}
        <div className="bg-[#f0ece1] p-3 flex flex-wrap gap-2.5 sm:gap-4 shrink-0 border-b border-gray-400">
          <div className="bg-white px-4 py-2 border border-gray-400 shadow-sm min-w-0 sm:min-w-[140px] flex-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase">Total Pending Saudas</p>
            <p className="text-lg font-black text-blue-900">{ledgerData.length}</p>
          </div>
          <div className="bg-white px-4 py-2 border border-gray-400 shadow-sm min-w-0 sm:min-w-[140px] flex-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase">Total Pending Quantity</p>
            <p className="text-lg font-black text-orange-700">{totalPendingWt.toFixed(3)} Ton</p>
          </div>
          <div className="bg-white px-4 py-2 border border-gray-400 shadow-sm min-w-0 sm:min-w-[180px] flex-1">
            <p className="text-[10px] font-bold text-gray-500 uppercase">Total Pending Value</p>
            <p className="text-lg font-black text-green-800">Rs. {totalPendingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto bg-gray-50 p-3">
          <table className="w-full border-collapse text-[10px] bg-white border border-gray-400 shadow-sm">
            <thead className="bg-[#c0c0c0] sticky top-0 z-10">
              <tr className="border-b border-gray-400 shadow-[inset_0_-1px_0_rgba(0,0,0,0.1)] h-8">
                <th className="text-left px-2 font-bold uppercase tracking-tight text-gray-600 border-r border-[#808080]/30">Date</th>
                <th className="text-left px-2 font-bold uppercase tracking-tight text-gray-600 border-r border-[#808080]/30">Sauda No</th>
                <th className="text-left px-2 font-bold uppercase tracking-tight text-gray-600 border-r border-[#808080]/30">Supplier</th>
                <th className="text-left px-2 font-bold uppercase tracking-tight text-gray-600 border-r border-[#808080]/30">Broker</th>
                <th className="text-right px-2 font-bold uppercase tracking-tight text-gray-600 border-r border-[#808080]/30 bg-blue-50/50">B. Rate</th>
                <th className="text-right px-2 font-bold uppercase tracking-tight text-gray-600 border-r border-[#808080]/30">Total Wt</th>
                <th className="text-right px-2 font-bold uppercase tracking-tight text-gray-600 border-r border-[#808080]/30">Recv. Wt</th>
                <th className="text-right px-2 font-bold uppercase tracking-tight text-orange-700 border-r border-[#808080]/30 bg-orange-50">Pending Wt</th>
                <th className="text-right px-2 font-bold uppercase tracking-tight text-green-800 bg-green-50">Pending Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ledgerData.map((s: any, i: number) => (
                <tr key={s.sauda_id || i} className="hover:bg-[#ffffd0] transition-colors h-7">
                  <td className="px-2 text-gray-700">{s.date ? new Date(s.date).toLocaleDateString('en-GB') : '-'}</td>
                  <td className="px-2 font-bold text-indigo-900">{s.sauda_no}</td>
                  <td className="px-2 truncate max-w-[150px]">{s.supplier}</td>
                  <td className="px-2 truncate max-w-[120px]">{s.broker}</td>
                  <td className="px-2 text-right font-mono bg-blue-50/30">₹{Number(s.b_rate || 0).toLocaleString()}</td>
                  <td className="px-2 text-right font-mono text-gray-600">{Number(s.total_wt_in_ton || 0).toFixed(3)}</td>
                  <td className="px-2 text-right font-mono text-gray-500">{s.receivedWeight.toFixed(3)}</td>
                  <td className="px-2 text-right font-mono font-bold text-orange-700 bg-orange-50/50">{s.pendingWt.toFixed(3)}</td>
                  <td className="px-2 text-right font-mono font-bold text-green-800 bg-green-50/50">
                    ₹{s.pendingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {ledgerData.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400 font-medium">
                    No pending saudas found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
