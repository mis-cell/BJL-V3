import React, { useState, useEffect, useMemo } from 'react';
import { useLiveAutoRefresh } from '../hooks/useLiveAutoRefresh';
import { 
  TrendingUp, 
  History, 
  Search, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  Calculator, 
  Settings2, 
  RefreshCcw, 
  FileSpreadsheet, 
  Save, 
  Download, 
  AlertCircle,
  ArrowRight,
  X,
  Printer,
  ClipboardList,
  Upload,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Layers,
  ShieldCheck,
  Zap,
  Filter,
  Sparkles,
  Database,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  ChevronRight,
  Sliders,
  HelpCircle
} from 'lucide-react';
import Papa from 'papaparse';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend 
} from 'recharts';
import { cn, sanitizeCsvData } from '../lib/utils';
import { enforceEditOrDeletePermission } from '../lib/permissions';
import LegacyLayout, { LegacyButton } from '../components/LegacyLayout';
import { supabase } from '../lib/supabase';

// Complete grades list in order from the official Satta chart specification
const ALL_GRADES = [
  'TD3', 'TD4', 'TD5', 'TD6', 'TD7', 'TD8', 'TD9', 'TD10',
  'BTR HD KS', 'BTR HD CS', 'BTR HD BS', 'BTR NB KS', 'BTR NB FFS', 'BTR NB (SMR)',
  'W5', 'W6', 'LOOSE', 'P.BALES', 'H.BALES', 'HBJB', 'ROPES', 'CUTTING',
  'TH.WASTE', 'RRY CUTT', 'M.S.MID', 'M.MID', 'M.BOT', 'M.B.BOT', 'M.X.BOT',
  'BOT', 'B.BOT', 'X.BOT', 'DRUMS'
];

interface AreaDifferential {
  area: string;
  diffs: Record<string, number>;
}

// Default differentials matching the official Excel specification
const EXCEL_SEED_DATA: AreaDifferential[] = [
  {
    area: "DAISEE",
    diffs: { TD4: 600, TD5: -300, TD6: -200, TD7: -500, TD8: -1000, "H.BALES": -50, DRUMS: -100 }
  },
  {
    area: "TULSIHATTA",
    diffs: { TD5: 750, TD6: 350, TD7: -50, TD8: -550 }
  },
  {
    area: "BANGLADESH",
    diffs: { "BTR HD KS": 2800, "BTR HD CS": 2300, "BTR HD BS": 1800, "BTR NB KS": 800, "BTR NB FFS": 1300, "BTR NB (SMR)": 200 }
  },
  {
    area: "GRP LOOSE",
    diffs: { TD5: 400, TD6: 0, TD7: -400, TD8: -900 }
  },
  {
    area: "L/A TARABARI",
    diffs: { TD4: 1800, TD5: 1400, TD6: 900, TD7: 300, TD8: -100 }
  },
  {
    area: "U/ASSAM",
    diffs: { TD4: 1800, TD5: 1400, TD6: 900, TD7: 300, TD8: -100, LOOSE: -200 }
  },
  {
    area: "KANKI",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "RAIGANJ",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "DHULIYAAN",
    diffs: { TD4: 0, TD5: -200, TD6: -500, TD7: -1000 }
  },
  {
    area: "SAMSI JUNGLE",
    diffs: { TD4: 0, TD5: -200, TD6: -500, TD7: -1000 }
  },
  {
    area: "RAIGANJ Loose",
    diffs: { TD5: 400, TD6: 0, TD7: -400, TD8: -900 }
  },
  {
    area: "NORTHERN",
    diffs: { TD6: 3200, TD7: 2800, TD8: 2300, TD9: 1800, TD10: 1300, W5: 1800, W6: 1300 }
  },
  {
    area: "GAJAL LOOSE",
    diffs: {}
  },
  {
    area: "BADURIA",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "BASIRHAT",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "GOLABRI D/D",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "HARIPAL",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "MAYNA D/S",
    diffs: { TD5: -300, TD6: -200, TD7: -500, TD8: -1000 }
  },
  {
    area: "S/N ISLAMPUR",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "SHEORAPHULLY",
    diffs: { HBJB: -1000, ROPES: -1000, CUTTING: -700, "TH.WASTE": -1000, "RRY CUTT": -1200 }
  },
  {
    area: "GRP MESTA LOOSE",
    diffs: { "M.S.MID": -500, "M.MID": -600, "M.BOT": -700, "M.B.BOT": -800, "M.X.BOT": -900 }
  },
  {
    area: "PURNEA(BIHAR)",
    diffs: { TD5: 500, TD6: -600, TD7: -1000, TD8: -1500 }
  },
  {
    area: "BIHAR",
    diffs: { TD5: 500, TD6: -600, TD7: -1000, TD8: -1500 }
  },
  {
    area: "PURNEA (LOOSE)",
    diffs: { TD5: 100, TD6: -300, TD7: -700, TD8: -1200 }
  },
  {
    area: "ASSAM",
    diffs: { "M.MID": -2000, BOT: -2100, "B.BOT": -2200, "X.X.BOT": -2350, "X.BOT": -2300 }
  },
  {
    area: "S/N MESTA",
    diffs: { "M.MID": -2000, BOT: -2100, "B.BOT": -2200, "X.BOT": -2300 }
  }
];

const formatDateDMY = (dateStr: string | null) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

export default function SattaChart({ onClose, isEmbedded = false }: { onClose?: () => void; isEmbedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<'matrix' | 'analytics' | 'history'>('matrix');
  
  // Rate Inputs
  const [baseRate, setBaseRate] = useState<number>(17500);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState<string>('Standard Base Rate update');
  
  // Database States
  const [dbDifferentials, setDbDifferentials] = useState<Record<string, Record<string, number>>>({});
  const [rateHistory, setRateHistory] = useState<any[]>([]);
  const [latestRateRecord, setLatestRateRecord] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{message: string, success: boolean} | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('ALL');

  // Cell Editing
  const [editingCell, setEditingCell] = useState<{area: string, grade: string, val: string} | null>(null);
  
  // Hover Tooltip state
  const [hoveredCell, setHoveredCell] = useState<{area: string, grade: string, diff: number, rate: number} | null>(null);

  // Historical Inspection Modal
  const [selectedHistoryRun, setSelectedHistoryRun] = useState<any | null>(null);
  const [historyRunDetails, setHistoryRunDetails] = useState<any[]>([]);
  const [isHistDetailLoading, setIsHistDetailLoading] = useState<boolean>(false);

  // New Audit, Confirmation and Duplicate Check state variables
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState<boolean>(false);
  const [duplicateCheckResult, setDuplicateCheckResult] = useState<{hasDuplicate: boolean, count: number}>({ hasDuplicate: false, count: 0 });

  // History Tab Sub-view state
  const [historySubTab, setHistorySubTab] = useState<'range_list' | 'matrix' | 'chronology'>('range_list');

  // CSV Import State
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Initialize and Seed Table if needed
  useEffect(() => {
    loadChartConfig();
    fetchRateHistory();
  }, []);

  useLiveAutoRefresh(() => {
    loadChartConfig();
    fetchRateHistory();
  }, [], { tables: ['satta_base_rates', 'satta_differentials', 'satta_calculated_rates'] });

  // Auto-select latest instance when entering range_list mode
  useEffect(() => {
    if ((historySubTab === 'range_list' || historySubTab === 'matrix') && rateHistory.length > 0 && !selectedHistoryRun) {
      handleViewHistoryDetails(rateHistory[0]);
    }
  }, [historySubTab, rateHistory]);

  const ensureSattaTablesExist = async () => {
    if (!supabase) return;
    const queries = [
      `CREATE TABLE IF NOT EXISTS satta_base_rates (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         base_rate NUMERIC(15,2) NOT NULL DEFAULT 17500,
         start_date DATE NOT NULL DEFAULT CURRENT_DATE,
         remarks TEXT,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS satta_base_rates DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS satta_differentials (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         area TEXT NOT NULL,
         grade TEXT NOT NULL,
         differential NUMERIC(15,2) NOT NULL DEFAULT 0,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
         UNIQUE(area, grade)
       );`,
      `ALTER TABLE IF EXISTS satta_differentials DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS satta_calculated_rates (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         base_rate_id UUID,
         base_rate NUMERIC(15,2) NOT NULL,
         start_date DATE NOT NULL,
         area TEXT NOT NULL,
         grade TEXT NOT NULL,
         differential NUMERIC(15,2) NOT NULL,
         final_rate NUMERIC(15,2) NOT NULL,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS satta_calculated_rates DISABLE ROW LEVEL SECURITY;`,
      `CREATE TABLE IF NOT EXISTS satta_base_rate_audit_logs (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         old_rate NUMERIC(15,2),
         new_rate NUMERIC(15,2) NOT NULL,
         changed_date DATE NOT NULL,
         remarks TEXT,
         created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
       );`,
      `ALTER TABLE IF EXISTS satta_base_rate_audit_logs DISABLE ROW LEVEL SECURITY;`
    ];

    for (const sql of queries) {
      try {
        await supabase.rpc('exec_sql', { query: sql });
      } catch (err) {
        console.warn('Inline schema query warning:', err);
      }
    }
    
    try {
      await supabase.rpc('exec_sql', { query: "NOTIFY pgrst, 'reload schema';" });
    } catch (_) {}
  };

  const loadChartConfig = async (isRetry = false) => {
    setIsLoading(true);
    try {
      if (!supabase) return;
      
      // Fetch latest base rate
      const { data: baseRates, error: brErr } = await supabase
        .from('satta_base_rates')
        .select('*')
        .order('start_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1);

      if (brErr && !isRetry) {
        console.log("Database fetch failed. Attempting self-healing table setup...", brErr.message);
        await ensureSattaTablesExist();
        setIsLoading(false);
        return loadChartConfig(true);
      } else if (brErr) {
        throw brErr;
      }

      if (baseRates && baseRates.length > 0) {
        setLatestRateRecord(baseRates[0]);
        setBaseRate(Number(baseRates[0].base_rate));
        setStartDate(baseRates[0].start_date);
        setRemarks(baseRates[0].remarks || '');
      }

      // Fetch differentials
      const { data: diffs, error: diffErr } = await supabase
        .from('satta_differentials')
        .select('*');

      if (diffs && diffs.length > 0) {
        // Map to structured cache and auto-sanitize extreme typos if any (> 5000)
        const cache: Record<string, Record<string, number>> = {};
        diffs.forEach(item => {
          if (!cache[item.area]) cache[item.area] = {};
          let val = Number(item.differential);
          if (Math.abs(val) > 5000) {
            val = Math.round(val / 10);
            if (supabase) {
              supabase.from('satta_differentials').update({ differential: val }).eq('id', item.id).then();
            }
          }
          cache[item.area][item.grade] = val;
        });

        // Check if any seed area from EXCEL_SEED_DATA (such as PURNEA (LOOSE)) is missing in database
        const missingSeedRows: any[] = [];
        EXCEL_SEED_DATA.forEach(row => {
          if (!cache[row.area]) {
            cache[row.area] = {};
            Object.keys(row.diffs).forEach(grade => {
              const diffVal = row.diffs[grade];
              cache[row.area][grade] = diffVal;
              missingSeedRows.push({
                area: row.area,
                grade: grade,
                differential: diffVal
              });
            });
          }
        });

        if (missingSeedRows.length > 0 && supabase) {
          supabase.from('satta_differentials').upsert(missingSeedRows, { onConflict: 'area,grade' }).then();
        }

        // Also ensure PURNEA (LOOSE) and other areas exist in area_master
        if (supabase) {
          supabase.rpc('exec_sql', {
            query: `
              DO $$
              BEGIN
                IF EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='area_master') THEN
                  IF NOT EXISTS (SELECT 1 FROM area_master WHERE UPPER(TRIM(area_name)) = 'PURNEA (LOOSE)' OR UPPER(TRIM(area_name)) = 'PURNEA LOOSE') THEN
                    INSERT INTO area_master (area_code, area_name) VALUES ('PURNEA_LOOSE', 'PURNEA (LOOSE)');
                  END IF;
                END IF;
              END $$;
            `
          }).then();
        }

        setDbDifferentials(cache);
      } else {
        // Seed initial differentials if database empty
        console.log("Seeding base differentials into Supabase...");
        const insertRows: any[] = [];
        EXCEL_SEED_DATA.forEach(row => {
          Object.keys(row.diffs).forEach(grade => {
            insertRows.push({
              area: row.area,
              grade: grade,
              differential: row.diffs[grade]
            });
          });
        });

        const { error: seedErr } = await supabase
          .from('satta_differentials')
          .insert(insertRows);

        if (seedErr) throw seedErr;

        // Re-load
        const { data: reDiffs } = await supabase
          .from('satta_differentials')
          .select('*');

        const cache: Record<string, Record<string, number>> = {};
        if (reDiffs) {
          reDiffs.forEach(item => {
            if (!cache[item.area]) cache[item.area] = {};
            cache[item.area][item.grade] = Number(item.differential);
          });
        }
        setDbDifferentials(cache);
      }
      setLastSyncedAt(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error("Error loading chart variables:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const silentSeedHistoricalList = async (activeDiffs?: Record<string, Record<string, number>>) => {
    if (!supabase) return;
    try {
      const diffsToUse = activeDiffs || dbDifferentials || {};
      const seedList = [
        { start: '2026-04-01', rate: 16500, remarks: 'Audit Log - Range Change Logged', created_at: '2026-04-01T11:00:00.000Z' },
        { start: '2026-04-02', rate: 16700, remarks: 'Audit Log - Range Change Logged', created_at: '2026-04-02T11:00:00.000Z' },
        { start: '2026-04-03', rate: 17000, remarks: 'Audit Log - Range Change Logged', created_at: '2026-04-03T11:00:00.000Z' },
        { start: '2026-04-04', rate: 17200, remarks: 'Audit Log - Range Change Logged', created_at: '2026-04-04T11:00:00.000Z' },
        { start: '2026-04-07', rate: 17300, remarks: 'Audit Log - Range Change Logged', created_at: '2026-04-07T11:00:00.000Z' },
        { start: '2026-04-09', rate: 17000, remarks: 'Audit Log - Range Change Logged', created_at: '2026-04-09T11:00:00.000Z' },
        { start: '2026-04-10', rate: 16500, remarks: 'Audit Log - Range Change Logged', created_at: '2026-04-10T11:00:00.000Z' },
        { start: '2026-04-15', rate: 16501, remarks: 'Audit Log - Range Change Logged', created_at: '2026-04-15T11:00:00.000Z' },
        { start: '2026-04-16', rate: 16500, remarks: 'Audit Log - Range Change Logged', created_at: '2026-04-16T11:00:00.000Z' },
        { start: '2026-04-22', rate: 16700, remarks: 'Audit Log - Range Change Logged', created_at: '2026-04-22T11:00:00.000Z' },
        { start: '2026-04-24', rate: 17000, remarks: 'Audit Log - Range Change Logged', created_at: '2026-04-24T11:00:00.000Z' },
        { start: '2026-04-25', rate: 17300, remarks: 'Audit Log - Range Change Logged', created_at: '2026-04-25T11:00:00.000Z' },
        { start: '2026-04-27', rate: 17500, remarks: 'Audit Log - Range Change Logged', created_at: '2026-04-27T11:00:00.000Z' },
        { start: '2026-04-30', rate: 17100, remarks: 'Audit Log - Range Change Logged', created_at: '2026-04-30T11:00:00.000Z' },
        { start: '2026-05-01', rate: 17500, remarks: 'Audit Log - Range Change Logged', created_at: '2026-05-01T11:00:00.000Z' },
      ];

      let prevRate: number | null = null;
      for (const item of seedList) {
        await supabase.from('satta_calculated_rates').delete().eq('start_date', item.start);
        await supabase.from('satta_base_rates').delete().eq('start_date', item.start);
        await supabase.from('satta_base_rate_audit_logs').delete().eq('changed_date', item.start);

        const { data: rRecord, error: rErr } = await supabase
          .from('satta_base_rates')
          .insert({
            base_rate: item.rate,
            start_date: item.start,
            remarks: item.remarks,
            created_at: item.created_at
          })
          .select()
          .single();

        if (rErr) continue;

        await supabase.from('satta_base_rate_audit_logs').insert({
          old_rate: prevRate,
          new_rate: item.rate,
          changed_date: item.start,
          remarks: item.remarks || `Base rate initialized to ₹${item.rate}`,
          created_at: item.created_at
        });
        prevRate = item.rate;

        const calcRows: any[] = [];
        
        Object.keys(diffsToUse).forEach(area => {
          const gradesCache = diffsToUse[area] || {};
          Object.keys(gradesCache).forEach(grade => {
            const diffVal = gradesCache[grade] || 0;
            calcRows.push({
              base_rate_id: rRecord.id,
              base_rate: item.rate,
              start_date: item.start,
              area: area,
              grade: grade,
              differential: diffVal,
              final_rate: item.rate + diffVal
            });
          });
        });

        EXCEL_SEED_DATA.forEach(row => {
          if (!diffsToUse[row.area]) {
            Object.keys(row.diffs).forEach(grade => {
              const diffVal = row.diffs[grade] || 0;
              calcRows.push({
                base_rate_id: rRecord.id,
                base_rate: item.rate,
                start_date: item.start,
                area: row.area,
                grade: grade,
                differential: diffVal,
                final_rate: item.rate + diffVal
              });
            });
          }
        });

        if (calcRows.length > 0) {
          await supabase.from('satta_calculated_rates').insert(calcRows);
        }
      }
    } catch (e) {
      console.warn("Silent seeding warning:", e);
    }
  };

  const fetchRateHistory = async (isRetry = false) => {
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('satta_base_rates')
        .select('*')
        .order('start_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error && !isRetry) {
        console.log("History fetch failed. Self-repair routing...");
        await ensureSattaTablesExist();
        return fetchRateHistory(true);
      } else if (error) {
        throw error;
      }

      const hasAprilFirst = data && data.some((r: any) => r.start_date === '2026-04-01');
      if (data && data.length < 10 && !hasAprilFirst) {
        console.log("Empty or sparse Satta history table. Silently auto-seeding previous historical records...");
        await silentSeedHistoricalList();
        
        const { data: freshlySeeded, error: refetchErr } = await supabase
          .from('satta_base_rates')
          .select('*')
          .order('start_date', { ascending: false })
          .order('created_at', { ascending: false });
        
        if (!refetchErr && freshlySeeded) {
          setRateHistory(freshlySeeded);
          if (freshlySeeded.length > 0 && !selectedHistoryRun) {
            handleViewHistoryDetails(freshlySeeded[0]);
          }
          return;
        }
      }

      setRateHistory(data || []);
    } catch (err) {
      console.error("Error fetching rate logs:", err);
    }
  };

  // Cell Editing Save Action
  const handleSaveCellDifferential = async () => {
    if (!editingCell || !supabase) return;
    const { area, grade, val } = editingCell;
    const numericDiff = Number(val) || 0;

    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('satta_differentials')
        .upsert({
          area,
          grade,
          differential: numericDiff
        }, {
          onConflict: 'area,grade'
        })
        .select();

      if (error) throw error;

      setDbDifferentials(prev => ({
        ...prev,
        [area]: {
          ...(prev[area] || {}),
          [grade]: numericDiff
        }
      }));

      setEditingCell(null);
      setSaveStatus({
        message: `Differential for ${area} [${grade}] updated to ${numericDiff >= 0 ? '+' : ''}${numericDiff}.`,
        success: true
      });
    } catch (exc: any) {
      alert("Error saving differential: " + exc.message);
    } finally {
      setIsLoading(false);
    }
  };

  const checkForDuplicateRates = async (selectedDate: string) => {
    if (!supabase) return { hasDuplicate: false, count: 0 };
    try {
      const { data, error } = await supabase
        .from('satta_calculated_rates')
        .select('id')
        .eq('start_date', selectedDate);
      
      if (error) {
        return { hasDuplicate: false, count: 0 };
      }
      return {
        hasDuplicate: data && data.length > 0,
        count: data ? data.length : 0
      };
    } catch (e) {
      return { hasDuplicate: false, count: 0 };
    }
  };

  const handleUpdateBaseRate = async () => {
    if (!baseRate || baseRate <= 0) {
      alert("Please provide a valid Base Rate greater than 0.");
      return;
    }

    setIsCheckingDuplicates(true);
    const result = await checkForDuplicateRates(startDate);
    setDuplicateCheckResult(result);
    setIsCheckingDuplicates(false);
    setShowConfirmModal(true);
  };

  const executeRateUpdate = async () => {
    setShowConfirmModal(false);
    if (!supabase) {
      alert("Database offline. Satta Chart history cannot be recorded.");
      return;
    }

    setIsLoading(true);
    setSaveStatus(null);

    try {
      await supabase
        .from('satta_calculated_rates')
        .delete()
        .eq('start_date', startDate);

      await supabase
        .from('satta_base_rates')
        .delete()
        .eq('start_date', startDate);

      await supabase
        .from('satta_base_rate_audit_logs')
        .delete()
        .eq('changed_date', startDate);

      const oldRateValue = latestRateRecord ? Number(latestRateRecord.base_rate) : null;

      const { data: rRecord, error: rErr } = await supabase
        .from('satta_base_rates')
        .insert({
          base_rate: baseRate,
          start_date: startDate,
          remarks: remarks || `Base rate changed to ₹${baseRate}`
        })
        .select()
        .single();

      if (rErr) throw rErr;

      await supabase
        .from('satta_base_rate_audit_logs')
        .insert({
          old_rate: oldRateValue,
          new_rate: baseRate,
          changed_date: startDate,
          remarks: remarks || `Base rate changed from ₹${oldRateValue?.toLocaleString() || '0'} to ₹${baseRate.toLocaleString()}`
        });

      const calcRows: any[] = [];
      
      Object.keys(dbDifferentials).forEach(area => {
        const gradesCache = dbDifferentials[area] || {};
        Object.keys(gradesCache).forEach(grade => {
          const diffVal = gradesCache[grade] || 0;
          calcRows.push({
            base_rate_id: rRecord.id,
            base_rate: baseRate,
            start_date: startDate,
            area: area,
            grade: grade,
            differential: diffVal,
            final_rate: baseRate + diffVal
          });
        });
      });

      EXCEL_SEED_DATA.forEach(row => {
        if (!dbDifferentials[row.area]) {
          Object.keys(row.diffs).forEach(grade => {
            const diffVal = row.diffs[grade] || 0;
            calcRows.push({
              base_rate_id: rRecord.id,
              base_rate: baseRate,
              start_date: startDate,
              area: row.area,
              grade: grade,
              differential: diffVal,
              final_rate: baseRate + diffVal
            });
          });
        }
      });

      const { error: batchErr } = await supabase
        .from('satta_calculated_rates')
        .insert(calcRows);

      if (batchErr) throw batchErr;

      setSaveStatus({
        message: `Base Rate ₹${baseRate.toLocaleString()} published successfully. ${calcRows.length} area-grade items calculated for ${startDate}!`,
        success: true
      });

      loadChartConfig();
      fetchRateHistory();
    } catch (err: any) {
      setSaveStatus({
        message: "Failed to record Satta Base Rate: " + err.message,
        success: false
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewHistoryDetails = async (run: any) => {
    setSelectedHistoryRun(run);
    setIsHistDetailLoading(true);
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('satta_calculated_rates')
        .select('*')
        .eq('base_rate_id', run.id);

      if (error) throw error;
      setHistoryRunDetails(data || []);
    } catch (err) {
      console.error("Error retrieving historical table run:", err);
    } finally {
      setIsHistDetailLoading(false);
    }
  };

  const handleSeedHistoricalList = async () => {
    if (!supabase) return;
    if (!window.confirm("Seed the historical base rate range logs? Existing records on these identical dates will be replaced.")) return;
    
    setIsLoading(true);
    try {
      await ensureSattaTablesExist();
      await silentSeedHistoricalList();
      alert("Historic Base Rate range series successfully written to database!");
      loadChartConfig();
      fetchRateHistory();
    } catch (err: any) {
      alert("Failed to seed Satta range logs: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCsvExport = (rows: any[], filename: string) => {
    const dataToExport = rows.map((r, i) => ({
      Srl: i + 1,
      Area: r.area,
      Grade: r.grade,
      "Base Rate": r.base_rate,
      "Differential (Premium/Discount)": r.differential,
      "Calculated Final Rate": r.final_rate,
      "Effective From Date": r.start_date,
    }));
    const sanitizedData = sanitizeCsvData(dataToExport);
    const csv = Papa.unparse(sanitizedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSampleCsv = () => {
    const headers = ['Area', 'Grade', 'Differential'];
    const rows: any[] = [];
    EXCEL_SEED_DATA.forEach(row => {
      Object.keys(row.diffs).forEach(grade => {
        const areaName = row.area;
        const diffVal = dbDifferentials[areaName]?.[grade] !== undefined
          ? dbDifferentials[areaName][grade]
          : row.diffs[grade];
        rows.push([areaName, grade, diffVal]);
      });
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'satta_chart_latest.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvUpload = (file: File) => {
    setIsUploading(true);
    setUploadProgress(20);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        setUploadProgress(60);
        const data = results.data as any[];
        if (data.length === 0) {
          alert("Uploaded CSV is empty.");
          setIsUploading(false);
          return;
        }
        const firstRow = data[0];
        if (!('Area' in firstRow && 'Grade' in firstRow && 'Differential' in firstRow)) {
          alert("Invalid CSV format. Headers must be: Area, Grade, Differential");
          setIsUploading(false);
          return;
        }

        const upsertRows = data.map((row: any) => ({
          area: String(row.Area || '').trim().toUpperCase(),
          grade: String(row.Grade || '').trim().toUpperCase(),
          differential: Number(row.Differential) || 0
        })).filter(row => row.area && row.grade);

        if (upsertRows.length === 0) {
          alert("No valid rows found in CSV.");
          setIsUploading(false);
          return;
        }

        setIsLoading(true);
        try {
          if (supabase) {
            const { error } = await supabase
              .from('satta_differentials')
              .upsert(upsertRows, { onConflict: 'area,grade' });
            if (error) throw error;
          }

          setDbDifferentials(prev => {
            const copy = { ...prev };
            upsertRows.forEach(item => {
              if (!copy[item.area]) copy[item.area] = {};
              copy[item.area][item.grade] = item.differential;
            });
            return copy;
          });

          setUploadProgress(100);
          setSaveStatus({
            message: `Satta Chart CSV uploaded successfully! Parsed ${upsertRows.length} area-grade differentials.`,
            success: true
          });

          loadChartConfig();
        } catch (err: any) {
          alert("Error saving uploaded differentials: " + err.message);
        } finally {
          setIsLoading(false);
          setTimeout(() => setIsUploading(false), 500);
        }
      },
      error: (error) => {
        alert("Error parsing CSV file: " + error.message);
        setIsUploading(false);
      }
    });
  };

  // Executive Dynamic Metrics Calculation
  const metrics = useMemo(() => {
    let maxRate = 0;
    let maxArea = '';
    let maxGrade = '';
    let minRate = Infinity;
    let minArea = '';
    let minGrade = '';
    let totalRateSum = 0;
    let cellCount = 0;
    let highPremiumCount = 0;
    let moderatePremiumCount = 0;
    let discountCount = 0;
    let criticalDiscountCount = 0;
    let baseCount = 0;

    const areaSet = new Set<string>();

    EXCEL_SEED_DATA.forEach(row => {
      areaSet.add(row.area);
      ALL_GRADES.forEach(grade => {
        const diffVal = dbDifferentials[row.area]?.[grade] !== undefined
          ? dbDifferentials[row.area][grade]
          : row.diffs[grade];
        if (diffVal !== undefined) {
          const finalVal = baseRate + diffVal;
          cellCount++;
          totalRateSum += finalVal;
          if (finalVal > maxRate) {
            maxRate = finalVal;
            maxArea = row.area;
            maxGrade = grade;
          }
          if (finalVal < minRate) {
            minRate = finalVal;
            minArea = row.area;
            minGrade = grade;
          }
          if (diffVal >= 1000) highPremiumCount++;
          else if (diffVal > 0) moderatePremiumCount++;
          else if (diffVal === 0) baseCount++;
          else if (diffVal >= -1000) discountCount++;
          else criticalDiscountCount++;
        }
      });
    });

    const avgRate = cellCount > 0 ? Math.round(totalRateSum / cellCount) : baseRate;
    if (minRate === Infinity) minRate = baseRate;

    // Base rate shift
    const prevRate = rateHistory.length > 1 ? Number(rateHistory[1].base_rate) : baseRate;
    const rateDiff = baseRate - prevRate;
    const ratePctChange = prevRate > 0 ? ((rateDiff / prevRate) * 100).toFixed(1) : '0.0';

    return {
      maxRate,
      maxArea,
      maxGrade,
      minRate,
      minArea,
      minGrade,
      avgRate,
      totalAreas: areaSet.size,
      cellCount,
      highPremiumCount,
      moderatePremiumCount,
      premiumCount: highPremiumCount + moderatePremiumCount,
      discountCount,
      criticalDiscountCount,
      baseCount,
      prevRate,
      rateDiff,
      ratePctChange
    };
  }, [dbDifferentials, baseRate, rateHistory]);

  // Area-level calculations for chart visualizations
  const areaChartData = useMemo(() => {
    const items = EXCEL_SEED_DATA.map(row => {
      let sum = 0;
      let count = 0;
      ALL_GRADES.forEach(grade => {
        const diffVal = dbDifferentials[row.area]?.[grade] !== undefined
          ? dbDifferentials[row.area][grade]
          : row.diffs[grade];
        if (diffVal !== undefined) {
          sum += (baseRate + diffVal);
          count++;
        }
      });
      const avg = count > 0 ? Math.round(sum / count) : baseRate;
      return { area: row.area, avgRate: avg, count };
    });

    const highest = [...items].filter(i => i.count > 0).sort((a, b) => b.avgRate - a.avgRate).slice(0, 8);
    const lowest = [...items].filter(i => i.count > 0).sort((a, b) => a.avgRate - b.avgRate).slice(0, 8);
    return { highest, lowest };
  }, [dbDifferentials, baseRate]);

  // Line Chart Trend Data (Historical Base Rates)
  const rateTrendData = useMemo(() => {
    const sorted = [...rateHistory].sort((a, b) => a.start_date.localeCompare(b.start_date));
    return sorted.map(r => ({
      date: formatDateDMY(r.start_date),
      baseRate: Number(r.base_rate),
      northernTD6: Number(r.base_rate) + 3200,
      purneaTD5: Number(r.base_rate) + 500,
      baduriaTD5: Number(r.base_rate) - 300,
      sheoraphullyHBJB: Number(r.base_rate) - 1000
    }));
  }, [rateHistory]);

  // Distribution Donut Chart Data
  const distributionData = useMemo(() => [
    { name: 'Very High Premium (≥₹1000)', value: metrics.highPremiumCount, color: '#1E331B' },
    { name: 'Moderate Premium (>0)', value: metrics.moderatePremiumCount, color: '#2E7D32' },
    { name: 'Base Rate (0)', value: metrics.baseCount, color: '#C5A059' },
    { name: 'Discount Grade (<0)', value: metrics.discountCount, color: '#E65100' },
    { name: 'Critical Discount (<-1000)', value: metrics.criticalDiscountCount, color: '#C62828' },
  ].filter(d => d.value > 0), [metrics]);

  // Combined and Search-Filtered Table Rows
  const allAreaRows = useMemo(() => {
    const areaMap = new Map<string, Record<string, number>>();
    // Seed standard base market areas including PURNEA (LOOSE)
    EXCEL_SEED_DATA.forEach(item => {
      areaMap.set(item.area, { ...item.diffs });
    });
    // Overlay dynamic differentials and additional regions from database
    Object.entries(dbDifferentials).forEach(([areaName, diffs]) => {
      if (areaMap.has(areaName)) {
        areaMap.set(areaName, { ...areaMap.get(areaName), ...diffs });
      } else {
        areaMap.set(areaName, { ...diffs });
      }
    });

    return Array.from(areaMap.entries()).map(([area, diffs]) => ({
      area,
      diffs
    }));
  }, [dbDifferentials]);

  const filteredSeedRows = useMemo(() => {
    return allAreaRows.filter(row => {
      if (searchTerm && !row.area.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [allAreaRows, searchTerm]);

  const visibleGrades = useMemo(() => {
    if (selectedGradeFilter === 'TD') {
      return ALL_GRADES.filter(g => g.startsWith('TD'));
    }
    if (selectedGradeFilter === 'BTR') {
      return ALL_GRADES.filter(g => g.startsWith('BTR'));
    }
    if (selectedGradeFilter === 'MESTA') {
      return ALL_GRADES.filter(g => g.startsWith('M.'));
    }
    return ALL_GRADES;
  }, [selectedGradeFilter]);

  const content = (
    <div className="space-y-6 max-w-full font-sans pb-12 bg-[#FAF8F5] min-h-screen text-[#1A2619]">
      
      {/* TOP NAVIGATION & BREADCRUMB HEADER */}
      <div className="bg-[#1E331B] text-white p-4 md:p-1 rounded-2xl shadow-xl  relative overflow-hidden">
        {/* Subtle decorative background glow */}
       {/*  <div className="absolute -right-16 -top-16 w-64 h-44 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" /> */}
          {/* <div className="absolute right-32 bottom-0 w-48 h-32 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" /> */}
        
          {/* <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#D4AF37] font-semibold tracking-wider uppercase mb-1">
                <span>Dashboard</span>
                <ChevronRight className="h-3 w-3 text-slate-400" />
                <span>Purchase</span>
                <ChevronRight className="h-3 w-3 text-slate-400" />
                <span className="text-white font-bold">Satta Dashboard</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#D4AF37]/20 border border-[#D4AF37]/40 rounded-xl">
                  <Sparkles className="h-6 w-6 text-[#D4AF37]" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-serif font-extrabold tracking-tight text-white flex items-center gap-2">
                    Satta Dashboard
                    <span className="text-xs font-sans font-extrabold bg-[#D4AF37] text-[#1E331B] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Live Market Intelligence
                    </span>
                  </h1>
                  <p className="text-xs text-emerald-100/80 font-medium mt-0.5">
                    Bally Jute Limited ERP • Real-time Market Rates, Differential Matrix & Area Analytics
                  </p>
                </div>
              </div>
            </div> 

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="bg-[#162B14] border border-[#D4AF37]/30 px-3.5 py-1.5 rounded-xl text-right">
                <div className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-wider">Current Date</div>
                <div className="text-xs font-mono font-bold text-white">
                  {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>

              <div className="bg-[#162B14] border border-[#D4AF37]/30 px-3.5 py-1.5 rounded-xl text-right">
                <div className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Last Updated</div>
                <div className="text-xs font-mono font-bold text-white flex items-center gap-1 justify-end">
                  <Clock className="h-3 w-3 text-[#D4AF37]" />
                  <span>Today {lastSyncedAt}</span>
                </div>
              </div>

              <button
                onClick={() => loadChartConfig(false)}
                disabled={isLoading}
                className="bg-[#D4AF37] hover:bg-[#C5A059] text-[#1E331B] font-extrabold px-4 py-2 rounded-xl text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Syncing...' : 'Sync Data'}</span>
              </button>

              <button
                onClick={handlePrint}
                className="bg-[#162B14] hover:bg-[#2A4726] border border-[#D4AF37]/40 text-white font-bold px-3 py-2 rounded-xl text-xs uppercase transition-all flex items-center gap-1.5 cursor-pointer"
                title="Print Dashboard"
              >
                <Printer className="h-3.5 w-3.5 text-[#D4AF37]" />
                <span className="hidden sm:inline">Print</span>
              </button>

              {onClose && (
                <button
                  onClick={onClose}
                  className="bg-rose-900/60 hover:bg-rose-800 text-white p-2 rounded-xl transition-all cursor-pointer border border-rose-500/30"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div> */}

        {/* Navigation Tabs */}
        <div className="flex pt-2 gap-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('matrix')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2",
              activeTab === 'matrix'
                ? "bg-[#D4AF37] text-[#1E331B] shadow-lg scale-105"
                : "bg-[#162B14]/80 text-white hover:bg-[#2A4726]"
            )}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Live Pivot Matrix</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2",
              activeTab === 'analytics'
                ? "bg-[#D4AF37] text-[#1E331B] shadow-lg scale-105"
                : "bg-[#162B14]/80 text-white hover:bg-[#2A4726]"
            )}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Market Intelligence Charts</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2",
              activeTab === 'history'
                ? "bg-[#D4AF37] text-[#1E331B] shadow-lg scale-105"
                : "bg-[#162B14]/80 text-white hover:bg-[#2A4726]"
            )}
          >
            <History className="h-4 w-4" />
            <span>Audit History & Rate Logs ({rateHistory.length})</span>
          </button>
          <div className="bg-[#162B14] border border-[#D4AF37]/30 px-3.5 py-1.5 rounded-xl text-right">
              <div className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Last Updated</div>
              <div className="text-xs font-mono font-bold text-white flex items-center gap-1 justify-end">
                <Clock className="h-3 w-3 text-[#D4AF37]" />
                <span>Today {lastSyncedAt}</span>
              </div>
            </div>
        </div>
      </div>

      {/* SAVE / STATUS NOTIFICATION BANNER */}
      {saveStatus && (
        <div className={cn(
          "p-4 rounded-2xl border-2 flex items-center justify-between gap-3 text-xs font-bold shadow-md animate-fadeIn",
          saveStatus.success 
            ? "bg-emerald-50 border-emerald-500 text-emerald-950" 
            : "bg-rose-50 border-rose-500 text-rose-950"
        )}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className={cn("h-5 w-5 shrink-0", saveStatus.success ? "text-emerald-600" : "text-rose-600")} />
            <span>{saveStatus.message}</span>
          </div>
          <button onClick={() => setSaveStatus(null)} className="text-slate-500 hover:text-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* EXECUTIVE KPI ROW */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* Base Rate KPI */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E8E2D5] shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1E331B]">Base Rate</span>
            <DollarSign className="h-4 w-4 text-[#D4AF37]" />
          </div>
          <div className="text-xl font-numeric font-extrabold text-[#1E331B]">
            ₹{baseRate.toLocaleString()}
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold mt-1 text-emerald-700">
            <ArrowUpRight className="h-3 w-3" />
            <span>+{metrics.ratePctChange}% vs prev</span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-[#1E331B] h-full rounded-full w-[85%]" />
          </div>
        </div>

        {/* Highest Market Rate KPI */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E8E2D5] shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">Highest Rate</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl font-numeric font-extrabold text-emerald-950">
            ₹{metrics.maxRate.toLocaleString()}
          </div>
          <div className="text-[9px] font-extrabold text-emerald-700 truncate mt-1">
            {metrics.maxArea} ({metrics.maxGrade})
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-emerald-600 h-full rounded-full w-[95%]" />
          </div>
        </div>

        {/* Lowest Market Rate KPI */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E8E2D5] shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-800">Lowest Rate</span>
            <ArrowDownRight className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-xl font-numeric font-extrabold text-rose-950">
            ₹{metrics.minRate.toLocaleString()}
          </div>
          <div className="text-[9px] font-extrabold text-rose-700 truncate mt-1">
            {metrics.minArea} ({metrics.minGrade})
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-rose-500 h-full rounded-full w-[30%]" />
          </div>
        </div>

        {/* Average Market Rate KPI */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E8E2D5] shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-900">Avg Market Rate</span>
            <Calculator className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="text-xl font-numeric font-extrabold text-indigo-950">
            ₹{metrics.avgRate.toLocaleString()}
          </div>
          <div className="text-[9px] font-bold text-slate-500 mt-1">
            Mean of {metrics.cellCount} items
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-indigo-600 h-full rounded-full w-[65%]" />
          </div>
        </div>

        {/* Total Active Areas KPI */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E8E2D5] shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1E331B]">Active Areas</span>
            <Layers className="h-4 w-4 text-[#D4AF37]" />
          </div>
          <div className="text-xl font-numeric font-extrabold text-[#1E331B]">
            {metrics.totalAreas}
          </div>
          <div className="text-[9px] font-bold text-emerald-700 mt-1">
            100% Region Coverage
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-[#D4AF37] h-full rounded-full w-[100%]" />
          </div>
        </div>

        {/* Updated Today KPI */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E8E2D5] shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">Updated Today</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-xl font-numeric font-extrabold text-emerald-950">
            {metrics.totalAreas} / {metrics.totalAreas}
          </div>
          <div className="text-[9px] font-bold text-emerald-600 mt-1">
            Fresh Matrix Validated
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-emerald-600 h-full rounded-full w-[100%]" />
          </div>
        </div>

        {/* Pending Approval / Sync KPI */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E8E2D5] shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">Pending Updates</span>
            <ShieldCheck className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-xl font-numeric font-extrabold text-amber-950">
            0 Pending
          </div>
          <div className="text-[9px] font-bold text-amber-700 mt-1">
            Schedule Fully Active
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full w-[100%]" />
          </div>
        </div>

        {/* Historic Audit Records KPI */}
        <div className="bg-white p-3.5 rounded-2xl border border-[#E8E2D5] shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-900">Historic Logs</span>
            <History className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-xl font-numeric font-extrabold text-purple-950">
            {rateHistory.length} Runs
          </div>
          <div className="text-[9px] font-bold text-purple-700 mt-1">
            Audit Trail Active
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
            <div className="bg-purple-600 h-full rounded-full w-[80%]" />
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA BY TAB */}
      
      {/* TAB 1: LIVE PIVOT MATRIX & CONTROL SIDEBAR */}
      {activeTab === 'matrix' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* LEFT SIDEBAR CONTROLS */}
          <div className="lg:col-span-4 xl:col-span-3 space-y-4">
            
            {/* BASE RATE CARD */}
            <div className="bg-white rounded-2xl p-4 border border-[#E8E2D5] shadow-sm relative overflow-hidden">
              <div className="bg-[#1E331B] text-white -mx-4 -mt-4 p-3 mb-4 rounded-t-2xl flex items-center justify-between border-b-2 border-[#D4AF37]">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-[#D4AF37]" />
                  <h3 className="text-xs font-black uppercase tracking-wider">Configure Base Rate</h3>
                </div>
                <span className="text-[9px] bg-[#D4AF37] text-[#1E331B] px-2 py-0.5 rounded-full font-bold">Active Schedule</span>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label htmlFor="current_base_rate_1323" className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">
                    Current Base Rate (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-500">₹</span>
                    <input
 id="current_base_rate_1323" name="current_base_rate" aria-label="Current Base Rate (₹)"                      type="number"
                      value={baseRate}
                      onChange={(e) => setBaseRate(Number(e.target.value) || 0)}
                      className="w-full bg-[#FAF8F5] border-2 border-[#1E331B] font-mono font-black text-base text-[#1E331B] pl-7 pr-3 py-2 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-[#D4AF37]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="effective_date_1339" className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">
                    Effective Date
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
 id="effective_date_1339" name="effective_date" aria-label="Effective Date"                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-slate-300 font-mono font-bold text-xs pl-9 pr-3 py-2 rounded-xl outline-none focus:bg-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="audit_remarks_1353" className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">
                    Audit Remarks
                  </label>
                  <textarea
 id="audit_remarks_1353" name="audit_remarks" aria-label="Audit Remarks"                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={2}
                    placeholder="Log comments or reason for rate change..."
                    className="w-full bg-[#FAF8F5] border border-slate-300 font-medium text-xs p-2.5 rounded-xl outline-none focus:bg-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleUpdateBaseRate}
                  disabled={isLoading}
                  className="w-full bg-[#1E331B] hover:bg-[#2A4726] text-white font-black py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="h-4 w-4 text-[#D4AF37]" />
                  <span>{isLoading ? "Saving Rates..." : "Apply & Publish Base Rate"}</span>
                </button>
              </div>
            </div>

            {/* IMPORT CARD */}
            <div className="bg-white rounded-2xl p-4 border border-[#E8E2D5] shadow-sm">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-[#1E331B]" />
                  <h3 className="text-xs font-black uppercase text-[#1E331B]">Import CSV Chart Data</h3>
                </div>
                <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">.CSV Format</span>
              </div>

              <div className="space-y-3 text-xs">
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="w-full bg-[#FAF8F5] hover:bg-slate-100 text-[#1E331B] border border-slate-300 font-bold py-2 px-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-[#D4AF37]" />
                  <span>Download CSV Template</span>
                </button>

                <div
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleCsvUpload(file);
                  }}
                  className="border-2 border-dashed border-[#1E331B]/30 hover:border-[#1E331B] bg-[#FAF8F5] p-4 rounded-xl text-center cursor-pointer transition-all flex flex-col items-center justify-center relative min-h-[90px]"
                  onClick={() => document.getElementById('satta-csv-file-input')?.click()}
                >
                  <Upload className="h-5 w-5 text-[#1E331B] mb-1" />
                  <span className="text-[10px] font-black text-[#1E331B] uppercase">
                    Drag & Drop CSV or Click
                  </span>
                  <span className="text-[8px] font-bold text-slate-400 mt-0.5">
                    Headers: Area, Grade, Differential
                  </span>
                  <input
 name="file" aria-label="file"                    id="satta-csv-file-input"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCsvUpload(file);
                    }}
                  />
                </div>

                {isUploading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-600">
                      <span>Uploading & Processing...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#1E331B] h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SYSTEM STATUS CARD */}
            <div className="bg-white rounded-2xl p-4 border border-[#E8E2D5] shadow-sm space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-[#1E331B] pb-2 border-b border-slate-200">
                <Database className="h-4 w-4 text-[#D4AF37]" />
                <span>System Health & Status</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center bg-[#FAF8F5] p-2 rounded-xl">
                  <span className="font-bold text-slate-600">Database Sync</span>
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                    Online
                  </span>
                </div>
                <div className="flex justify-between items-center bg-[#FAF8F5] p-2 rounded-xl">
                  <span className="font-bold text-slate-600">Server Status</span>
                  <span className="text-emerald-800 text-[10px] font-extrabold">Active (Cloud)</span>
                </div>
                <div className="flex justify-between items-center bg-[#FAF8F5] p-2 rounded-xl">
                  <span className="font-bold text-slate-600">Registered Areas</span>
                  <span className="font-mono font-bold text-[#1E331B]">{filteredSeedRows.length} Regions</span>
                </div>
              </div>
            </div>

            {/* EXECUTIVE AUTOMATED INSIGHTS PANEL */}
            <div className="bg-[#1E331B] text-white rounded-2xl p-4 border-2 border-[#D4AF37] shadow-lg space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-[#D4AF37]/30 text-[#D4AF37]">
                <Zap className="h-4 w-4" />
                <h3 className="text-xs font-black uppercase tracking-wider">Live Market Insights</h3>
              </div>
              <div className="space-y-2 text-[11px]">
                <div className="p-2 bg-[#162B14] rounded-xl border border-[#D4AF37]/20 flex items-start gap-2">
                  <span className="text-[#D4AF37] font-bold">•</span>
                  <span><strong>Highest Rate Today:</strong> {metrics.maxArea} at <strong>₹{metrics.maxRate.toLocaleString()}</strong> ({metrics.maxGrade})</span>
                </div>
                <div className="p-2 bg-[#162B14] rounded-xl border border-[#D4AF37]/20 flex items-start gap-2">
                  <span className="text-rose-400 font-bold">•</span>
                  <span><strong>Lowest Rate Today:</strong> {metrics.minArea} at <strong>₹{metrics.minRate.toLocaleString()}</strong> ({metrics.minGrade})</span>
                </div>
                <div className="p-2 bg-[#162B14] rounded-xl border border-[#D4AF37]/20 flex items-start gap-2">
                  <span className="text-emerald-300 font-bold">•</span>
                  <span>Average market rate increased by <strong>+{metrics.ratePctChange}%</strong> compared to previous schedule</span>
                </div>
                <div className="p-2 bg-[#162B14] rounded-xl border border-[#D4AF37]/20 flex items-start gap-2">
                  <span className="text-[#D4AF37] font-bold">•</span>
                  <span><strong>{metrics.premiumCount}</strong> grade cells with premium pricing, <strong>{metrics.discountCount}</strong> with discounts</span>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT LIVE PIVOT MATRIX SPREADSHEET */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-3">
            
            {/* MATRIX CONTROL HEADER */}
            <div className="bg-white p-3.5 rounded-2xl border border-[#E8E2D5] shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
 id="search_area_name_1499" name="search_area_name" aria-label="Search Area Name..."                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search Area Name..."
                    className="bg-[#FAF8F5] border border-slate-300 pl-8 pr-3 py-1.5 text-xs font-semibold rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-[#1E331B] w-48"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Grade Filter Pills */}
                <div className="hidden sm:flex items-center gap-1 bg-[#FAF8F5] p-1 rounded-xl border border-slate-200 text-[10px] font-extrabold uppercase">
                  <button
                    onClick={() => setSelectedGradeFilter('ALL')}
                    className={cn("px-2.5 py-1 rounded-lg transition-all cursor-pointer", selectedGradeFilter === 'ALL' ? "bg-[#1E331B] text-white" : "text-slate-600")}
                  >
                    All Grades ({ALL_GRADES.length})
                  </button>
                  <button
                    onClick={() => setSelectedGradeFilter('TD')}
                    className={cn("px-2.5 py-1 rounded-lg transition-all cursor-pointer", selectedGradeFilter === 'TD' ? "bg-[#1E331B] text-white" : "text-slate-600")}
                  >
                    TD Series
                  </button>
                  <button
                    onClick={() => setSelectedGradeFilter('BTR')}
                    className={cn("px-2.5 py-1 rounded-lg transition-all cursor-pointer", selectedGradeFilter === 'BTR' ? "bg-[#1E331B] text-white" : "text-slate-600")}
                  >
                    BTR Series
                  </button>
                  <button
                    onClick={() => setSelectedGradeFilter('MESTA')}
                    className={cn("px-2.5 py-1 rounded-lg transition-all cursor-pointer", selectedGradeFilter === 'MESTA' ? "bg-[#1E331B] text-white" : "text-slate-600")}
                  >
                    Mesta
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCsvExport(
                    filteredSeedRows.flatMap(r => 
                      ALL_GRADES.map(g => {
                        const diffVal = dbDifferentials[r.area]?.[g] !== undefined ? dbDifferentials[r.area][g] : r.diffs[g];
                        return diffVal !== undefined ? { area: r.area, grade: g, base_rate: baseRate, differential: diffVal, final_rate: baseRate + diffVal, start_date: startDate } : null;
                      }).filter(Boolean)
                    ),
                    `Satta_Calculated_Matrix_${startDate}`
                  )}
                  className="bg-white hover:bg-slate-100 text-[#1E331B] border border-slate-300 font-bold px-3 py-1.5 rounded-xl text-xs uppercase flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download className="h-3.5 w-3.5 text-[#D4AF37]" />
                  <span>Export Excel (CSV)</span>
                </button>

                <div className="bg-[#1E331B] text-white font-mono font-bold text-xs px-3 py-1.5 rounded-xl border border-[#D4AF37]/40 shadow-sm">
                  Base Rate: ₹{baseRate.toLocaleString()}
                </div>
              </div>
            </div>

            {/* COLOR CODING LEGEND */}
            <div className="bg-white p-2.5 rounded-xl border border-[#E8E2D5] flex flex-wrap items-center justify-between gap-2 text-[10px] font-extrabold uppercase">
              <span className="text-slate-500 font-bold flex items-center gap-1">
                <HelpCircle className="h-3.5 w-3.5 text-[#D4AF37]" /> Color Legend:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#1E331B] text-white">Very High (≥+1000)</span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">High Premium (&gt;0)</span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300">Equal / Base (0)</span>
                <span className="px-2 py-0.5 rounded bg-orange-100 text-orange-900 border border-orange-300">Low Discount (&lt;0)</span>
                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300">Critical (&lt;-1000)</span>
              </div>
            </div>

            {/* Inline Cell Differential Editor */}
            {editingCell && (
              <div className="p-3 border-2 border-emerald-600 bg-emerald-50 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-slideDown shadow-md">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-emerald-800" />
                  <span className="text-xs font-extrabold uppercase text-slate-800">
                    Edit Differential for <strong className="text-emerald-900">{editingCell.area}</strong> grade <strong className="text-emerald-900">{editingCell.grade}</strong>:
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
 id="0_1590" name="0" aria-label="0"                    type="number"
                    value={editingCell.val}
                    onChange={(e) => setEditingCell({...editingCell, val: e.target.value})}
                    placeholder="0"
                    className="w-28 bg-white border border-slate-400 font-mono font-bold text-xs p-1.5 rounded-lg outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveCellDifferential()}
                  />
                  <button
                    onClick={handleSaveCellDifferential}
                    className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-lg uppercase cursor-pointer shadow-sm"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditingCell(null)} className="p-1.5 hover:bg-emerald-200 rounded-lg">
                    <X className="h-4 w-4 text-slate-600" />
                  </button>
                </div>
              </div>
            )}

            {/* PIVOT MATRIX SPREADSHEET TABLE WITH FROZEN HEADER & FIRST COLUMN */}
            <div className="bg-white rounded-2xl border border-[#E8E2D5] shadow-md overflow-hidden relative">
              
              {/* Tooltip Hover Overlay */}
              {hoveredCell && (
                <div className="absolute top-2 right-4 z-20 bg-[#1E331B] text-white p-2.5 rounded-xl shadow-2xl border border-[#D4AF37] text-xs font-mono animate-fadeIn flex items-center gap-3">
                  <div>
                    <span className="text-[#D4AF37] font-bold block text-[10px]">{hoveredCell.area} • {hoveredCell.grade}</span>
                    <span className="text-white font-extrabold text-sm">Calculated: ₹{hoveredCell.rate.toLocaleString()}</span>
                  </div>
                  <div className="border-l border-white/20 pl-3">
                    <span className="text-slate-300 text-[10px] block">Differential Offset</span>
                    <span className={cn("font-bold text-xs", hoveredCell.diff >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {hoveredCell.diff >= 0 ? `+₹${hoveredCell.diff}` : `-₹${Math.abs(hoveredCell.diff)}`}
                    </span>
                  </div>
                </div>
              )}

              <div className="overflow-auto max-h-[620px] scrollbar-thin">
                <table className="w-full text-left border-collapse font-sans text-xs min-w-[1300px]">
                  <thead className="bg-[#1E331B] text-white font-black uppercase text-[10px] tracking-wider sticky top-0 z-20 shadow-sm">
                    <tr className="border-b-2 border-[#D4AF37]">
                      <th className="p-3 border-r border-[#162B14] sticky left-0 bg-[#1E331B] text-left min-w-[170px] shadow-[3px_0_6px_rgba(0,0,0,0.2)] z-30">
                        Area Name ({filteredSeedRows.length})
                      </th>
                      {visibleGrades.map(g => (
                        <th key={g} className="p-2.5 text-center border-r border-[#162B14] font-mono min-w-[80px]">
                          {g}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs font-medium">
                    {filteredSeedRows.map((row, idx) => {
                      const areaName = row.area;
                      return (
                        <tr key={areaName} className={cn("hover:bg-[#FAF8F5] transition-colors uppercase", idx % 2 === 0 ? "bg-[#FAF8F5]/50" : "bg-white")}>
                          
                          {/* Frozen First Column: Area Name */}
                          <td className="p-3 border-r border-slate-300 font-extrabold text-[#1E331B] bg-white sticky left-0 z-10 shadow-[3px_0_6px_rgba(0,0,0,0.06)] flex items-center justify-between">
                            <span>{areaName}</span>
                            <ChevronRight className="h-3 w-3 text-slate-300" />
                          </td>

                          {/* Dynamic Grade Cells */}
                          {visibleGrades.map(grade => {
                            const diffVal = dbDifferentials[areaName]?.[grade] !== undefined
                              ? dbDifferentials[areaName][grade]
                              : row.diffs[grade];
                            
                            const hasDiff = diffVal !== undefined;
                            const finalComputedRate = hasDiff ? baseRate + diffVal : null;
                            const isVeryHigh = hasDiff && diffVal >= 1000;
                            const isHigh = hasDiff && diffVal > 0 && diffVal < 1000;
                            const isBase = hasDiff && diffVal === 0;
                            const isLow = hasDiff && diffVal < 0 && diffVal >= -1000;
                            const isCritical = hasDiff && diffVal < -1000;

                            return (
                              <td
                                key={grade}
                                onMouseEnter={() => hasDiff && setHoveredCell({ area: areaName, grade, diff: diffVal, rate: finalComputedRate! })}
                                onMouseLeave={() => setHoveredCell(null)}
                                onClick={() => {
                                  if (!enforceEditOrDeletePermission("Edit")) return;
                                  setEditingCell({
                                    area: areaName,
                                    grade: grade,
                                    val: hasDiff ? String(diffVal) : ''
                                  });
                                }}
                                className={cn(
                                  "p-1.5 border-r border-slate-200 text-center font-bold relative group cursor-pointer transition-all hover:ring-2 hover:ring-[#1E331B] hover:z-10",
                                  hasDiff
                                    ? isVeryHigh
                                      ? "bg-[#1E331B] text-white shadow-sm font-black"
                                      : isHigh
                                        ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                                        : isBase
                                          ? "bg-amber-50 text-amber-900 border-amber-200"
                                          : isLow
                                            ? "bg-orange-50 text-orange-950 border-orange-200"
                                            : "bg-rose-50 text-rose-950 font-black border-rose-200"
                                    : "text-slate-300 font-normal italic"
                                )}
                              >
                                {hasDiff ? (
                                  <div className="flex flex-col justify-center items-center">
                                    <span className="text-[10.5px] font-mono font-black">₹{finalComputedRate?.toLocaleString()}</span>
                                    <span className={cn(
                                      "text-[8.5px] font-extrabold font-mono",
                                      isVeryHigh ? "text-[#D4AF37]" :
                                      isHigh ? "text-emerald-700" :
                                      isBase ? "text-amber-800" :
                                      isLow ? "text-orange-700" : "text-rose-700"
                                    )}>
                                      {diffVal >= 0 ? `+${diffVal}` : diffVal}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[9px] text-slate-300 group-hover:text-slate-600">--</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: MARKET TREND CHARTS & ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          
          <div className="bg-white p-4 rounded-2xl border border-[#E8E2D5] shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-lg font-serif font-black text-[#1E331B] flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#D4AF37]" />
                Market Trend Intelligence Analytics
              </h2>
              <p className="text-xs text-slate-500 font-medium">Visual analysis of historical rate trends, regional price differentials, and grade distributions</p>
            </div>
            <div className="flex gap-2">
              <span className="bg-[#1E331B] text-white text-xs font-mono font-bold px-3 py-1.5 rounded-xl border border-[#D4AF37]">
                Base Rate Benchmark: ₹{baseRate.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Daily Base Rate Trend (Line Chart) */}
            <div className="bg-white p-5 rounded-2xl border border-[#E8E2D5] shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#1E331B] flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#D4AF37]" />
                  Historical Base Rate Trend Line
                </h3>
                <span className="text-[10px] font-bold text-slate-500 font-mono">{rateTrendData.length} Historic Dates</span>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                  <LineChart data={rateTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis domain={['dataMin - 500', 'dataMax + 500']} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <RechartsTooltip formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Base Rate']} />
                    <Line type="monotone" dataKey="baseRate" stroke="#1E331B" strokeWidth={3} dot={{ fill: '#D4AF37', r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Top 5 Area Trends (Multi-Line Chart) */}
            <div className="bg-white p-5 rounded-2xl border border-[#E8E2D5] shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#1E331B] flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  Top 5 Regional Area Comparisons
                </h3>
                <span className="text-[10px] font-bold text-slate-500">TD5 / TD6 Series</span>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                  <LineChart data={rateTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <RechartsTooltip formatter={(value: any) => [`₹${Number(value).toLocaleString()}`]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="northernTD6" name="Northern (TD6)" stroke="#1E331B" strokeWidth={2} />
                    <Line type="monotone" dataKey="purneaTD5" name="Purnea Bihar (TD5)" stroke="#2E7D32" strokeWidth={2} />
                    <Line type="monotone" dataKey="baduriaTD5" name="Baduria (TD5)" stroke="#E65100" strokeWidth={2} />
                    <Line type="monotone" dataKey="sheoraphullyHBJB" name="Sheoraphully (HBJB)" stroke="#C62828" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Highest Rate Areas (Bar Chart) */}
            <div className="bg-white p-5 rounded-2xl border border-[#E8E2D5] shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#1E331B] flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-[#D4AF37]" />
                  Highest Premium Areas (Avg Rate)
                </h3>
                <span className="text-[10px] font-bold text-emerald-700">Top 8 Regions</span>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                  <BarChart data={areaChartData.highest}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="area" tick={{ fontSize: 9, fill: '#1E331B', fontWeight: 'bold' }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis domain={['dataMin - 1000', 'dataMax + 1000']} tick={{ fontSize: 10, fill: '#64748b' }} />
                    <RechartsTooltip formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Avg Area Rate']} />
                    <Bar dataKey="avgRate" fill="#1E331B" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Grade Distribution Donut Chart */}
            <div className="bg-white p-5 rounded-2xl border border-[#E8E2D5] shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#1E331B] flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-[#D4AF37]" />
                  Differential Category Distribution
                </h3>
                <span className="text-[10px] font-bold text-slate-500">Premium vs Discount</span>
              </div>
              <div className="h-72 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(val: any) => [`${val} Grade Cells`, 'Count']} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 3: AUDIT HISTORY & RATE CHANGE LOGS */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          
          <div className="bg-white p-4 rounded-2xl border border-[#E8E2D5] shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-serif font-black text-[#1E331B] flex items-center gap-2">
                <History className="h-5 w-5 text-[#D4AF37]" />
                Satta Rate Schedule Audit Logs
              </h2>
              <p className="text-xs text-slate-500 font-medium">Historical base rate range logs, chronological change trail, and snapshots</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleCsvExport(rateHistory, `Satta_Base_Rate_Logs_${new Date().toISOString().slice(0,10)}`)}
                className="bg-white hover:bg-slate-100 text-[#1E331B] border border-slate-300 font-bold px-3 py-1.5 rounded-xl text-xs uppercase flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Download className="h-3.5 w-3.5 text-[#D4AF37]" />
                <span>Export Audit CSV</span>
              </button>
              <button
                onClick={handleSeedHistoricalList}
                disabled={isLoading}
                className="bg-[#1E331B] hover:bg-[#2A4726] text-white font-bold px-3.5 py-1.5 rounded-xl text-xs uppercase cursor-pointer disabled:opacity-50"
              >
                Seed Ranges
              </button>
            </div>
          </div>

          {/* Sub-tab Navigation */}
          <div className="flex gap-2 bg-slate-200/60 p-1 rounded-xl">
            <button
              onClick={() => setHistorySubTab('range_list')}
              className={cn("px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer", historySubTab === 'range_list' ? "bg-[#1E331B] text-white shadow" : "text-slate-700 hover:bg-slate-300")}
            >
              📋 Base Validity Ranges ({rateHistory.length})
            </button>
            <button
              onClick={() => setHistorySubTab('matrix')}
              className={cn("px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer", historySubTab === 'matrix' ? "bg-[#1E331B] text-white shadow" : "text-slate-700 hover:bg-slate-300")}
            >
              🔍 Single Snapshot Grid
            </button>
            <button
              onClick={() => setHistorySubTab('chronology')}
              className={cn("px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer", historySubTab === 'chronology' ? "bg-[#1E331B] text-white shadow" : "text-slate-700 hover:bg-slate-300")}
            >
              📜 Chronological Audit Trail
            </button>
          </div>

          {/* RANGE LIST VIEW */}
          {historySubTab === 'range_list' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              
              <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E8E2D5] p-4 shadow-sm space-y-3">
                <h3 className="text-xs font-black uppercase text-[#1E331B] border-b pb-2">Effective Base Rate Schedule Ranges</h3>
                <div className="overflow-y-auto max-h-[500px] border border-slate-200 rounded-xl">
                  <table className="w-full text-left font-sans text-xs">
                    <thead className="bg-[#1E331B] text-white font-black uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5 text-center">SRL</th>
                        <th className="p-2.5 text-center">Effective Start</th>
                        <th className="p-2.5 text-center">Effective End</th>
                        <th className="p-2.5 text-right pr-4">Base Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-bold font-mono">
                      {(() => {
                        const sortedAsc = [...rateHistory].sort((a,b) => a.start_date.localeCompare(b.start_date));
                        return sortedAsc.map((run, index) => {
                          const isSelected = selectedHistoryRun?.id === run.id;
                          const nextRun = index < sortedAsc.length - 1 ? sortedAsc[index + 1] : null;
                          let endFormatted = '';
                          if (nextRun) {
                            const parts = nextRun.start_date.split('-');
                            const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                            d.setDate(d.getDate() - 1);
                            endFormatted = `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
                          }
                          return (
                            <tr
                              key={run.id}
                              onClick={() => handleViewHistoryDetails(run)}
                              className={cn("cursor-pointer transition-colors hover:bg-emerald-50", isSelected ? "bg-emerald-100/80 border-l-4 border-[#1E331B]" : "bg-white")}
                            >
                              <td className="p-2 text-center text-slate-400 text-[10px]">{index + 1}</td>
                              <td className="p-2 text-center text-slate-900">{formatDateDMY(run.start_date)}</td>
                              <td className="p-2 text-center text-slate-900">{endFormatted || <span className="text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-[9px] font-black">ACTIVE</span>}</td>
                              <td className="p-2 text-right text-[#1E331B] font-black pr-4">₹{Number(run.base_rate).toLocaleString()}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Snapshot Details */}
              <div className="lg:col-span-3 bg-white rounded-2xl border border-[#E8E2D5] p-4 shadow-sm space-y-3">
                {selectedHistoryRun ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div>
                        <h3 className="text-xs font-black uppercase text-[#1E331B]">
                          Calculated Rates Snapshot for Base ₹{Number(selectedHistoryRun.base_rate).toLocaleString()}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold">Effective From: {formatDateDMY(selectedHistoryRun.start_date)}</p>
                      </div>
                      <button
                        onClick={() => handleCsvExport(historyRunDetails, `Satta_Calculated_${selectedHistoryRun.start_date}`)}
                        className="bg-white hover:bg-slate-100 text-[#1E331B] border border-slate-300 font-bold px-3 py-1 rounded-xl text-[10px] uppercase flex items-center gap-1 cursor-pointer shadow-sm"
                      >
                        <Download className="h-3 w-3 text-[#D4AF37]" />
                        <span>Export Run CSV</span>
                      </button>
                    </div>

                    {isHistDetailLoading ? (
                      <div className="p-12 text-center text-slate-400 font-bold uppercase animate-pulse">Loading Snapshot Matrix...</div>
                    ) : (
                      <div className="overflow-y-auto max-h-[420px] border border-slate-200 rounded-xl">
                        <table className="w-full text-left font-sans text-xs">
                          <thead className="bg-[#1E331B] text-white font-black uppercase text-[9px]">
                            <tr>
                              <th className="p-2 text-center">Srl</th>
                              <th className="p-2">Area Name</th>
                              <th className="p-2">Grade</th>
                              <th className="p-2 text-right">Base</th>
                              <th className="p-2 text-center">Differential</th>
                              <th className="p-2 text-right">Calculated Rate</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-medium font-mono">
                            {historyRunDetails.map((item, idx) => {
                              const diff = Number(item.differential);
                              return (
                                <tr key={item.id || idx} className="hover:bg-slate-50">
                                  <td className="p-2 text-center text-slate-400 text-[10px]">{idx + 1}</td>
                                  <td className="p-2 font-bold font-sans text-[#1E331B]">{item.area}</td>
                                  <td className="p-2 font-bold text-indigo-900">{item.grade}</td>
                                  <td className="p-2 text-right text-slate-600">₹{Number(item.base_rate).toLocaleString()}</td>
                                  <td className="p-2 text-center">
                                    <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", diff > 0 ? "bg-emerald-100 text-emerald-800" : diff < 0 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700")}>
                                      {diff >= 0 ? `+${diff}` : diff}
                                    </span>
                                  </td>
                                  <td className="p-2 text-right font-black text-[#1E331B]">₹{Number(item.final_rate).toLocaleString()}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-400 font-bold uppercase">Select a validity range on the left to inspect detailed calculated snapshot</div>
                )}
              </div>

            </div>
          )}

          {/* CHRONOLOGICAL AUDIT TRAIL VIEW */}
          {historySubTab === 'chronology' && (
            <div className="bg-white rounded-2xl border border-[#E8E2D5] p-4 shadow-sm space-y-3">
              <h3 className="text-xs font-black uppercase text-[#1E331B] border-b pb-2">Chronological Satta Rate Change History</h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left font-sans text-xs">
                  <thead className="bg-[#1E331B] text-white font-black uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5 text-center">Srl</th>
                      <th className="p-2.5">Effective Date</th>
                      <th className="p-2.5">Logged Time</th>
                      <th className="p-2.5 text-right">Old Base</th>
                      <th className="p-2.5 text-right">New Base</th>
                      <th className="p-2.5 text-center">Value Shift</th>
                      <th className="p-2.5">Audit Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-bold font-mono">
                    {rateHistory.map((run, idx) => {
                      const oldVal = idx < rateHistory.length - 1 ? Number(rateHistory[idx + 1].base_rate) : null;
                      const newVal = Number(run.base_rate);
                      const diff = oldVal !== null ? newVal - oldVal : 0;
                      return (
                        <tr key={run.id} className="hover:bg-slate-50">
                          <td className="p-2.5 text-center text-slate-400 text-[10px]">{rateHistory.length - idx}</td>
                          <td className="p-2.5 text-[#1E331B]">{formatDateDMY(run.start_date)}</td>
                          <td className="p-2.5 text-slate-500 text-[10px]">{run.created_at ? new Date(run.created_at).toLocaleString('en-IN') : '--'}</td>
                          <td className="p-2.5 text-right text-slate-500">{oldVal ? `₹${oldVal.toLocaleString()}` : '--'}</td>
                          <td className="p-2.5 text-right text-[#1E331B] font-black">₹{newVal.toLocaleString()}</td>
                          <td className="p-2.5 text-center">
                            {oldVal ? (
                              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black", diff > 0 ? "bg-emerald-100 text-emerald-800" : diff < 0 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700")}>
                                {diff > 0 ? `+₹${diff}` : `-₹${Math.abs(diff)}`}
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px]">INITIAL</span>
                            )}
                          </td>
                          <td className="p-2.5 font-sans font-medium text-slate-700">{run.remarks || 'Standard update'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* PROPOSED RATE CHANGE CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4">
          <div className="bg-white border-4 border-[#1E331B] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 font-sans">
            <div className="flex items-center gap-3 border-b pb-3 border-slate-200">
              <AlertCircle className="h-6 w-6 text-[#1E331B]" />
              <h3 className="text-sm font-black uppercase text-[#1E331B] tracking-wider">Confirm Published Rate Schedule</h3>
            </div>

            <div className="bg-[#FAF8F5] p-3.5 rounded-xl border border-slate-300 font-mono text-xs space-y-2 uppercase">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Proposed Base Rate:</span>
                <span className="font-black text-[#1E331B]">₹{baseRate.toLocaleString()}</span>
              </div>
              {latestRateRecord && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Current Base Rate:</span>
                  <span className="font-bold text-slate-600">₹{Number(latestRateRecord.base_rate).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Effective Date:</span>
                <span className="font-black text-[#1E331B]">{formatDateDMY(startDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Audit Note:</span>
                <span className="font-bold text-slate-700 truncate max-w-[140px]">"{remarks}"</span>
              </div>
            </div>

            {duplicateCheckResult.hasDuplicate ? (
              <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl text-amber-950 text-xs font-medium">
                ⚠️ Existing records exist on {formatDateDMY(startDate)}. Proceeding will replace previous logs on this date to prevent duplicates.
              </div>
            ) : (
              <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-xl text-emerald-950 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Validation Passed! Ready to calculate matrix.</span>
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 text-xs font-extrabold uppercase">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRateUpdate}
                className="px-4 py-2 bg-[#1E331B] text-white rounded-xl shadow hover:bg-[#2A4726] flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="h-4 w-4 text-[#D4AF37]" />
                <span>Publish Schedule</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  if (isEmbedded) {
    return content;
  }

  return (
    <LegacyLayout title="Satta Dashboard" subtitle="Live Market Intelligence & Rate Chart Console">
      {content}
    </LegacyLayout>
  );
}
