import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Database,
  Plus,
  Trash2,
  Edit,
  Download,
  Upload,
  Search,
  Lock,
  User,
  Settings,
  Box,
  FileText,
  Users,
  MapPin,
  Layers,
  ChevronRight,
  Save,
  X,
  FileSpreadsheet,
  Terminal,
  Monitor,
  Archive,
  Bell,
  Mail,
  ChevronLeft,
  Briefcase,
  HelpCircle,
  FileText as InvoiceIcon,
  PlayCircle,
  ShieldAlert,
  Sparkles,
  ClipboardList,
  CheckCircle2,
  Calendar,
  Award,
  DollarSign,
  UserCheck,
  Building,
  MessageSquare,
  Notebook,
  Key,
  BookOpen,
  Contact,
  GraduationCap,
  Server,
  Scale,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { dbModule } from "../services/dbModule";
import LegacyLayout, {
  LegacyFieldset,
  LegacyButton,
} from "../components/LegacyLayout";
import Papa from "papaparse";
import { cn, canDeleteData } from "../lib/utils";
import { getCurrentUserContext, ALL_SYSTEM_MODULES, broadcastPermissionsUpdated, normalizeAllowedModules, getCanonicalModuleId } from "../lib/permissions";

// Import our beautiful modular material design subpages
import DashboardTab from "../components/material/DashboardTab";
import UIElementsTab from "../components/material/UIElementsTab";
import DatabaseTab from "../components/material/DatabaseTab";
import FormsChartsTab from "../components/material/FormsChartsTab";
import ExtraPagesTab from "../components/material/ExtraPagesTab";
import EmailActivityTab from "../components/material/EmailActivityTab";
import SMTPDiagnosticTab from "../components/material/SMTPDiagnosticTab";

interface TableDef {
  name: string;
  label: string;
  icon: any;
  pk: string;
}

const TABLES: TableDef[] = [
  // Core User & System Tables
  { name: "user_master", label: "User Master", icon: User, pk: "user_id" },
  { name: "user_activity_logs", label: "User Activity Logs", icon: ClipboardList, pk: "log_id" },
  { name: "userlog_master", label: "User Log Master", icon: Terminal, pk: "id" },

  // Jute Mill ERP Tables
  { name: "batch_master", label: "Batch Master", icon: Layers, pk: "code" },
  { name: "sauda_master", label: "Sauda Master", icon: FileText, pk: "sauda_id" },
  { name: "satta_master", label: "Satta Master", icon: FileText, pk: "satta_id" },
  { name: "temporary_material_received", label: "Temporary M.R (Current)", icon: Archive, pk: "amad_id" },
  { name: "final_arrival", label: "Final M.R", icon: CheckCircle2, pk: "final_arrival_id" },
  { name: "issue_master", label: "Issue Master", icon: Layers, pk: "amad_id" },
  { name: "mill_issue_master", label: "Mill Issue Master", icon: Layers, pk: "issue_id" },
  { name: "mill_issue_detail", label: "Mill Issue Detail", icon: Layers, pk: "id" },
  { name: "godown_master", label: "Godown Master", icon: Box, pk: "id" },
  { name: "godown_wise_stock", label: "Godown Wise Stock", icon: Box, pk: "id" },
  { name: "opening_stock", label: "Opening Stock", icon: CheckCircle2, pk: "id" },
  { name: "closing_stock", label: "Closing Stock", icon: CheckCircle2, pk: "id" },
  { name: "supply_master", label: "Supply Master", icon: Users, pk: "id" },
  { name: "customer_master", label: "Customer Master", icon: Users, pk: "id" },
  { name: "broker_master", label: "Broker Master", icon: Users, pk: "id" },
  { name: "area_master", label: "Area Master", icon: MapPin, pk: "id" },
  { name: "agency_master", label: "Agency Master", icon: MapPin, pk: "id" },
  { name: "grade_master", label: "Grade Master", icon: Layers, pk: "id" },
  { name: "marka_master", label: "Marka Master", icon: Box, pk: "id" },
  { name: "purchase_master", label: "Purchase Master", icon: FileText, pk: "po_id" },
  { name: "unit_master", label: "Unit Master", icon: Layers, pk: "id" },
  { name: "lorry_weighments", label: "Lorry Weighments", icon: Scale, pk: "id" },
  { name: "deduction_master", label: "Deduction Master", icon: DollarSign, pk: "id" },
  { name: "moisture_logic", label: "Moisture Logic", icon: ClipboardList, pk: "id" },
  { name: "satta_base_rates", label: "Satta Base Rates", icon: DollarSign, pk: "id" },
  { name: "satta_differentials", label: "Satta Differentials", icon: Layers, pk: "id" },
  { name: "satta_calculated_rates", label: "Satta Calculated Rates", icon: FileText, pk: "id" },

  // Academic & Student Management Tables (from screenshots)
  { name: "academic_year_master", label: "Academic Year Master", icon: Calendar, pk: "id" },
  { name: "account_master", label: "Account Master", icon: FileText, pk: "id" },
  { name: "admission_inquiry", label: "Admission Inquiry", icon: HelpCircle, pk: "id" },
  { name: "asset_master", label: "Asset Master", icon: Key, pk: "id" },
  { name: "asset_tagging_employee", label: "Asset Tagging Employee", icon: Briefcase, pk: "id" },
  { name: "assignments_master", label: "Assignments Master", icon: Notebook, pk: "id" },
  { name: "class_master", label: "Class Master", icon: Building, pk: "id" },
  { name: "dailywork_master", label: "Dailywork Master", icon: Notebook, pk: "id" },
  { name: "department_master", label: "Department Master", icon: Layers, pk: "dept_code" },
  { name: "discipline_record", label: "Discipline Record", icon: ShieldAlert, pk: "id" },
  { name: "employee_attendance", label: "Employee Attendance", icon: ClipboardList, pk: "id" },
  { name: "employee_document", label: "Employee Document", icon: FileSpreadsheet, pk: "id" },
  { name: "employee_master", label: "Employee Master", icon: Users, pk: "id" },
  { name: "escort_card", label: "Escort Card", icon: Contact, pk: "id" },
  { name: "event_master", label: "Event Master", icon: Calendar, pk: "id" },
  { name: "exam_marks", label: "Exam Marks", icon: Award, pk: "id" },
  { name: "exam_master", label: "Exam Master", icon: GraduationCap, pk: "id" },
  { name: "exam_schedule", label: "Exam Schedule", icon: Calendar, pk: "id" },
  { name: "expense_master", label: "Expense Master", icon: DollarSign, pk: "id" },
  { name: "fee_concession", label: "Fee Concession", icon: DollarSign, pk: "id" },
  { name: "fee_structure", label: "Fee Structure", icon: Layers, pk: "id" },
  { name: "feedback_master", label: "Feedback Master", icon: MessageSquare, pk: "id" },
  { name: "feedback_response", label: "Feedback Response", icon: MessageSquare, pk: "id" },
  { name: "fees_collection", label: "Fees Collection", icon: DollarSign, pk: "id" },
  { name: "holiday_master", label: "Holiday Master", icon: Calendar, pk: "id" },
  { name: "income_master", label: "Income Master", icon: DollarSign, pk: "id" },
  { name: "inventory_master", label: "Inventory Master", icon: Box, pk: "id" },
  { name: "leave_application", label: "Leave Application", icon: Mail, pk: "id" },
  { name: "leave_balance", label: "Leave Balance", icon: Layers, pk: "id" },
  { name: "notice_automation", label: "Notice Automation", icon: Bell, pk: "id" },
  { name: "offer_letter", label: "Offer Letter", icon: FileText, pk: "id" },
  { name: "parent_portal_access", label: "Parent Portal Access", icon: Lock, pk: "id" },
  { name: "payroll_master", label: "Payroll Master", icon: DollarSign, pk: "id" },
  { name: "report_card", label: "Report Card", icon: Award, pk: "id" },
  { name: "salary_slip", label: "Salary Slip", icon: FileSpreadsheet, pk: "id" },
  { name: "student_attendance", label: "Student Attendance", icon: ClipboardList, pk: "id" },
  { name: "student_idcard", label: "Student ID Card", icon: Contact, pk: "id" },
  { name: "student_master", label: "Student Master", icon: GraduationCap, pk: "id" },
  { name: "subject_master", label: "Subject Master", icon: BookOpen, pk: "id" },
  { name: "teacher_idcard", label: "Teacher ID Card", icon: Contact, pk: "id" },
  { name: "template_master", label: "Template Master", icon: FileText, pk: "id" },
  { name: "timetable_master", label: "Timetable Master", icon: Calendar, pk: "id" },
  { name: "timetable_substitution", label: "Timetable Substitution", icon: Calendar, pk: "id" },
  { name: "vendor_master", label: "Vendor Master", icon: Users, pk: "id" },
  { name: "visitor_master", label: "Visitor Master", icon: UserCheck, pk: "id" },
  { name: "warning_letter", label: "Warning Letter", icon: ShieldAlert, pk: "id" },
  { name: "whatsapp_log", label: "WhatsApp Log", icon: MessageSquare, pk: "id" },
];

interface LogEntry {
  id: string;
  timestamp: string;
  event: string;
  details: string;
  currentPage: string;
  runningPages: string[];
}

export default function AdminDesk({
  onClose,
  onLogin,
  isAdmin = false,
  systemLogs = [],
  onClearLogs,
  onNavigate,
}: {
  onClose: () => void;
  onLogin?: () => void;
  isAdmin?: boolean;
  systemLogs?: LogEntry[];
  onClearLogs?: () => void;
  onNavigate?: (page: any) => void;
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(isAdmin);
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [error, setError] = useState("");

  // Administrative theme styles toggler
  const [useMaterialTheme, setUseMaterialTheme] = useState(false);

  // Database core state variables
  const [tables, setTables] = useState<TableDef[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableDef | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingRow, setEditingRow] = useState<any>(null);
  const [isNewRow, setIsNewRow] = useState<boolean>(false);
  const lastEditingRowRef = useRef<any>(null);

  useEffect(() => {
    if (editingRow !== null && lastEditingRowRef.current === null) {
      // Transition from closed (null) to open (non-null)
      const isNew = Object.keys(editingRow).length === 0;
      setIsNewRow(isNew);
    }
    lastEditingRowRef.current = editingRow;
  }, [editingRow]);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState("TEXT");
  const [newTableName, setNewTableName] = useState("");

  // Memoize purchaseOrders with real database values or high-quality retro defaults
  const purchaseOrders = useMemo(() => {
    if (data && data.length > 0 && selectedTable?.name === "purchase_master") {
      return data;
    }
    return [
      { po_no: "PO-88/26", supplier: "BENGAL BALING CO.", broker: "DIRECT", area: "KOLKATA CORE", total_contract_mt: 45, b_rate: 17400 },
      { po_no: "PO-102/26", supplier: "BIHAR ASSOCIATED FIBRES", broker: "K.C. CHOPRA", area: "BIHAR VALLEY", total_contract_mt: 36, b_rate: 17150 },
      { po_no: "PO-115/26", supplier: "ORISSA JUTE EXPORTERS", broker: "R.K. MEHTA", area: "ORISSA COAST", total_contract_mt: 60, b_rate: 17600 },
      { po_no: "PO-142/26", supplier: "EASTERN BALER TRADERS", broker: "DIRECT", area: "ASSAM REGION", total_contract_mt: 50, b_rate: 17200 },
    ];
  }, [data, selectedTable]);
  
  // Retro Administrative tab layout option
  const [activeSchemaTab, setActiveSchemaTab] = useState<"row" | "column" | "sql" | "event_log" | "reconciliation_log">("row");

  // Reconciled Weight calculations math state
  const [reconRecords, setReconRecords] = useState<any[]>([]);
  const [selectedReconId, setSelectedReconId] = useState<string>("");
  const [reconLoading, setReconLoading] = useState(false);

  useEffect(() => {
    if (activeSchemaTab === "reconciliation_log") {
      const loadReconRecords = async () => {
        setReconLoading(true);
        try {
          let fetched: any[] = [];
          if (supabase) {
            const { data, error } = await supabase.from('final_arrival').select('*');
            if (!error && data) {
              fetched = data;
            }
          }
          if (!fetched || fetched.length === 0) {
            fetched = [
              {
                final_arrival_id: "fa-1",
                final_arrival_no: "2044",
                supplier: "BENGAL BALING CO.",
                lorry_number: "WB-23-4412",
                weight_qtl: 145.2,
                electronic_net_weight: 14.120,
                arrival_area_name: "DAISEE CORE AREA",
                po_date: "2026-03-12",
                grid_details: JSON.stringify([
                  { moisture_pct: 19.5, dust_pct: 1.0, ncv_pct: 0.5 }
                ])
              },
              {
                final_arrival_id: "fa-2",
                final_arrival_no: "2045",
                supplier: "EASTERN BALER TRADERS",
                lorry_number: "OR-14-9980",
                weight_qtl: 184.8,
                electronic_net_weight: 16.520,
                arrival_area_name: "KOLKATA DOCKS",
                po_date: "2026-02-28",
                grid_details: JSON.stringify([
                  { moisture_pct: 21.0, dust_pct: 1.5, ncv_pct: 1.0 }
                ])
              },
              {
                final_arrival_id: "fa-3",
                final_arrival_no: "2046",
                supplier: "ORISSA JUTE EXPORTERS",
                lorry_number: "WB-25-1102",
                weight_qtl: 120.0,
                electronic_net_weight: 11.880,
                arrival_area_name: "ORISSA STATION",
                po_date: "2026-05-15",
                grid_details: JSON.stringify([
                  { moisture_pct: 16.0, dust_pct: 0.5, ncv_pct: 0.5 }
                ])
              }
            ];
          }
          setReconRecords(fetched);
          if (fetched.length > 0) {
            setSelectedReconId(fetched[0].final_arrival_id);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setReconLoading(false);
        }
      };
      loadReconRecords();
    }
  }, [activeSchemaTab]);

  // Modern Material Tab selected
  const [activeMaterialPage, setActiveMaterialPage] = useState<string>("db_console");

  // System Event Log UI states
  const [logFilter, setLogFilter] = useState("");
  const [logType, setLogType] = useState("ALL");
  const [logSubTab, setLogSubTab] = useState<"system" | "print" | "queue" | "sync">("system");
  const [printLogs, setPrintLogs] = useState<any[]>([]);

  // Centralized Print Queue State variables
  const [printQueue, setPrintQueue] = useState<any[]>([]);
  const [printingItem, setPrintingItem] = useState<any | null>(null);

  // Manual document queuing state
  const [queueModule, setQueueModule] = useState<"po" | "sauda" | "amad" | "material_inspection" | "stock">("po");
  const [queueDocRef, setQueueDocRef] = useState("");
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState("");
  const [expandedSyncRow, setExpandedSyncRow] = useState<string | null>(null);

  // Load Print Queue from localStorage on mount
  useEffect(() => {
    try {
      const savedQueue = localStorage.getItem("mill_central_print_queue");
      if (savedQueue) {
        setPrintQueue(JSON.parse(savedQueue === "undefined" ? "null" : savedQueue));
      }
    } catch (e) {
      console.error("Failed to parse mill_central_print_queue from localStorage:", e);
    }
  }, []);

  // Save print queue to localStorage helper
  const savePrintQueueObj = (updatedQueue: any[]) => {
    setPrintQueue(updatedQueue);
    try {
      localStorage.setItem("mill_central_print_queue", JSON.stringify(updatedQueue));
    } catch (e) {
      console.error("Failed to write mill_central_print_queue:", e);
    }
  };

  const handleAddToQueue = async () => {
    if (!queueDocRef.trim()) {
      setQueueError("Please key in a reference identifier first.");
      return;
    }
    setQueueLoading(true);
    setQueueError("");
    try {
      let docTitle = ``;
      let docSummary = ``;
      let payload: any = {};
      const id = Date.now().toString();
      const timestamp = new Date().toISOString();

      if (!supabase) {
        // Offline / fallback custom item addition
        docTitle = `${queueModule.toUpperCase()} - Manual Receipt #${queueDocRef}`;
        docSummary = `Offline local registry bypass. Custom reference: ${queueDocRef}`;
        payload = { ref: queueDocRef, module: queueModule, offline: true, date: new Date().toLocaleDateString() };
      } else {
        if (queueModule === "po") {
          const { data, error } = await supabase
            .from("purchase_master")
            .select("*")
            .ilike("po_no", `%${queueDocRef.trim()}%`)
            .limit(1);
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error(`No purchase orders (P.O) found matching PO reference "${queueDocRef}"`);
          }
          const po = data[0];
          docTitle = `Purchase Order Contract`;
          docSummary = `Ref: ${po.po_no} | Supplier: ${po.supplier_name || po.supplier || "N/A"} | Weight Contract: ${po.total_contract_mt || 0} MT`;
          payload = po;
        } else if (queueModule === "sauda") {
          const { data, error } = await supabase
            .from("sauda_master")
            .select("*")
            .or(`sauda_id.eq.${Number(queueDocRef) || -1},broker.ilike.%${queueDocRef}%,party_name.ilike.%${queueDocRef}%`)
            .limit(1);
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error(`No Saudas found matching Sauda identifier/party "${queueDocRef}"`);
          }
          const s = data[0];
          docTitle = `Sauda Contract Agreement`;
          docSummary = `Ref ID: ${s.sauda_id} | Party: ${s.party_name || "N/A"} | Rate: Rs. ${s.b_rate || 0} | Weight: ${s.total_wt_in_ton || 0} MT`;
          payload = s;
        } else if (queueModule === "amad") {
          const { data, error } = await supabase
            .from("temporary_material_received")
            .select("*")
            .or(`temporary_arrival_no.ilike.%${queueDocRef}%,lorry_number.ilike.%${queueDocRef}%`)
            .limit(1);
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error(`No arrivals (AMAD) found matching reference/lorry "${queueDocRef}"`);
          }
          const a = data[0];
          docTitle = `Station Temporary M.R Gatepass`;
          docSummary = `Amad No: ${a.amad_no || "N/A"} | Lorry Number: ${a.lorry_number} | Packets: ${a.packets || 0} | Weight: ${a.weight || 0} Qtl`;
          payload = a;
        } else if (queueModule === "material_inspection") {
          const { data, error } = await supabase
            .from("mill_inspection_master")
            .select("*")
            .ilike("mr_no", `%${queueDocRef.trim()}%`)
            .limit(1);
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error(`No inspections found matching inspection M.R. No "${queueDocRef}"`);
          }
          const insp = data[0];
          docTitle = `Material Quality Inspection Certificate`;
          docSummary = `M.R. No: ${insp.mr_no} | Moisture: ${insp.actual_moisture || 0}% | Supplier: ${insp.supplier_name || "N/A"}`;
          payload = insp;
        } else if (queueModule === "stock") {
          const { data, error } = await supabase
            .from("opening_stock")
            .select("*")
            .or(`grade.ilike.%${queueDocRef}%,godown.ilike.%${queueDocRef}%`)
            .order("id")
            .limit(1);
          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error(`No stock registers found matching "${queueDocRef}"`);
          }
          const st = data[0];
          docTitle = `Opening Stock Ledger`;
          docSummary = `Grade: ${st.grade} | Godown: ${st.godown} | Quantity: ${st.quantity} BALES | Weight: ${st.weight} Kg`;
          payload = st;
        }
      }

      const newItem = {
        id,
        module: queueModule,
        refNo: queueDocRef.toUpperCase(),
        title: docTitle,
        summary: docSummary,
        timestamp,
        payload
      };

      const revisedQueue = [newItem, ...printQueue];
      savePrintQueueObj(revisedQueue);
      setQueueDocRef("");
      setQueueError("");
      alert(`Success! "${docTitle}" has been queued.`);
    } catch (err: any) {
      console.error(err);
      setQueueError(err.message || "An unexpected lookup error occurred.");
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    const loadPrintLogs = async () => {
      let localLogs = [];
      try {
        localLogs = JSON.parse(localStorage.getItem("mill_inspection_print_logs") === "undefined" ? "[]" : (localStorage.getItem("mill_inspection_print_logs") || "[]"));
      } catch (e) {
        console.error(e);
      }

      let mergedLogs = [...localLogs];
      try {
        if (supabase) {
          const { data: dbLogs, error } = await supabase
            .from("mill_inspection_print_logs")
            .select("*")
            .order("timestamp", { ascending: false })
            .then(res => res, () => ({ data: null, error: new Error('Table unavailable') }));
          if (dbLogs && dbLogs.length > 0) {
            const seenIds = new Set(localLogs.map((l: any) => l.id));
            const freshDbLogs = dbLogs.filter((l: any) => !seenIds.has(l.id));
            mergedLogs = [
              ...localLogs,
              ...freshDbLogs.map((dl: any) => ({
                id: dl.id || String(dl.timestamp),
                user_id: dl.user_id,
                timestamp: dl.timestamp,
                row_ids: dl.row_ids || [],
                details: dl.details || `Printed report for: ${dl.row_ids?.join(", ")}`,
              }))
            ];
          }
        }
      } catch (err) {
        console.warn("Could not load print logs from Supabase:", err);
      }

      mergedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPrintLogs(mergedLogs);
    };

    loadPrintLogs();
  }, [activeSchemaTab, activeMaterialPage]);

  const handleClearPrintLogs = () => {
    if (confirm("Are you sure you want to purge the print logs history?")) {
      localStorage.removeItem("mill_inspection_print_logs");
      setPrintLogs([]);
    }
  };

  const [currentColumns, setCurrentColumns] = useState<{ name: string; type: string }[]>([]);
  const [sqlQuery, setSqlQuery] = useState("");
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlExecuting, setSqlExecuting] = useState(false);
  const [confirmDeleteTable, setConfirmDeleteTable] = useState<string | null>(null);

  // Database Offline JSON Backup engine
  const [isExporting, setIsExporting] = useState(false);

  const handleDatabaseExport = async () => {
    if (!supabase) {
      alert("Offline Mode: Supreme DB client not initialized.");
      return;
    }
    setIsExporting(true);
    try {
      // Define list of critical tables covering Amad, Sauda, Purchase Orders, and associated metadata
      const tablesToExport = [
        { key: "temporary_material_received", tableName: "temporary_material_received", label: "Material Arrivals (AMAD)" },
        { key: "final_arrival", tableName: "final_arrival", label: "Final Arrivals Registry" },
        { key: "sauda_master", tableName: "sauda_master", label: "Sauda Contracts Master" },
        { key: "sauda_quality_details", tableName: "sauda_quality_details", label: "Sauda Premium Qualities" },
        { key: "purchase_master", tableName: "purchase_master", label: "Purchase Master Orders (P.O)" },
        { key: "purchase_detail_master", tableName: "purchase_detail_master", label: "Purchase Specification Logs" },
        { key: "satta_master", tableName: "satta_master", label: "Satta Desk Contracts" },
        { key: "satta_quality_details", tableName: "satta_quality_details", label: "Satta Specification Log" },
        { key: "user_master", tableName: "user_master", label: "User Accounts Index" },
        { key: "godown_master", tableName: "godown_master", label: "Godown Storage Index" },
        { key: "department_master", tableName: "department_master", label: "Department Directory" },
        { key: "broker_master", tableName: "broker_master", label: "Broker Index" },
        { key: "supply_master", tableName: "supply_master", label: "Suppliers Directory" }
      ];

      const backupObj: Record<string, any> = {
        meta: {
          app_id: "def84b34-813c-44a3-9726-818829c5ea17",
          title: "Jute Mill Automations Database Backup",
          timestamp_iso: new Date().toISOString(),
          timestamp_local: new Date().toLocaleString(),
          exporter_username: loginUser || "ADMIN_CONSOLE",
          version: "v2.1"
        },
        payload: {}
      };

      for (const t of tablesToExport) {
        try {
          const { data: dbRows, error: dbErr } = await supabase.from(t.tableName).select("*");
          if (dbErr) {
            console.warn(`Unable to fetch schema reference for ${t.tableName}:`, dbErr);
            backupObj.payload[t.key] = {
              status: "partial_error",
              error: dbErr.message,
              data: []
            };
          } else {
            backupObj.payload[t.key] = {
              status: "active",
              count: dbRows?.length || 0,
              data: dbRows || []
            };
          }
        } catch (tableErr: any) {
          backupObj.payload[t.key] = {
            status: "failed",
            error: tableErr.message,
            data: []
          };
        }
      }

      // Generate string wrapper and initiate anchor download trigger
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObj, null, 2));
      const downloadAnchor = document.createElement("a");
      const backupFilename = `BJCL_ADMIN_OFFLINE_BACKUP_${new Date().toISOString().substring(0, 10)}_${new Date().getTime()}.json`;
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", backupFilename);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);

      alert(`Backup downloaded successfully!\nFilename: ${backupFilename}\nCritical tables packed safely.`);
    } catch (exportErr: any) {
      console.error("Critical Backup export loop crashed:", exportErr);
      alert("Failed to export database state. Error details: " + exportErr.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Initialize and load tables
  useEffect(() => {
    if (isAuthenticated) {
      fetchTables();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedTable) {
      fetchData();
    }
  }, [selectedTable]);

  // Read tables schema metadata
  const fetchTables = async () => {
    if (!supabase) {
      setTables(TABLES);
      if (!selectedTable) setSelectedTable(TABLES[0]);
      return;
    }
    try {
      const isBootstrapped = typeof window !== 'undefined' && (sessionStorage.getItem('admindesk_tables_bootstrapped') || localStorage.getItem('admindesk_tables_bootstrapped'));
      if (!isBootstrapped) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('admindesk_tables_bootstrapped', '1');
          localStorage.setItem('admindesk_tables_bootstrapped', '1');
        }
        // Automatically patch user_master to align user_id to TEXT PRIMARY KEY and correct column list
        try {
          await supabase.rpc("exec_sql", {
            query: `
              DO $$
              BEGIN
                IF EXISTS (
                  SELECT 1 
                  FROM information_schema.columns 
                  WHERE table_name = 'user_master' 
                    AND (column_name = 'is_active' OR (column_name = 'user_id' AND data_type = 'uuid'))
                ) THEN
                  DROP TABLE IF EXISTS user_master CASCADE;
                END IF;
              END $$;

              CREATE TABLE IF NOT EXISTS user_master (
                user_id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'USER',
                status TEXT DEFAULT 'Active',
                allowed_modules TEXT DEFAULT '*',
                level TEXT DEFAULT 'L1', last_login TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );

              INSERT INTO user_master (user_id, username, password, role, status, allowed_modules, level)
              VALUES ('001', 'ADMIN', 'ADMIN', 'ADMIN', 'Active', '*', 'L1')
              ON CONFLICT (username) DO NOTHING;
            `
          });
        } catch (err) {
          console.warn("Table patch user_master schema validation failure:", err);
        }

        // Automatically construct customer_master if it doesn't exist
        try {
          await supabase.rpc("exec_sql", {
            query: `
              CREATE TABLE IF NOT EXISTS customer_master (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                firm_name TEXT,
                proprietor_name TEXT,
                email TEXT,
                contact_number TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );
              ALTER TABLE IF EXISTS customer_master DISABLE ROW LEVEL SECURITY;

              CREATE TABLE IF NOT EXISTS moisture_logic (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                season TEXT,
                operating_area TEXT,
                threshold_limit TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );
              ALTER TABLE IF EXISTS moisture_logic DISABLE ROW LEVEL SECURITY;

              INSERT INTO moisture_logic (season, operating_area, threshold_limit)
              SELECT 'JANUARY TO JUNE (WET SEASON)', 'DAISEE Operating Areas', 'Moisture threshold limit is 18%'
              WHERE NOT EXISTS (SELECT 1 FROM moisture_logic WHERE season = 'JANUARY TO JUNE (WET SEASON)' AND operating_area = 'DAISEE Operating Areas');

              INSERT INTO moisture_logic (season, operating_area, threshold_limit)
              SELECT 'JANUARY TO JUNE (WET SEASON)', 'Standard / Non-DAISEE', 'Moisture threshold limit is 16%'
              WHERE NOT EXISTS (SELECT 1 FROM moisture_logic WHERE season = 'JANUARY TO JUNE (WET SEASON)' AND operating_area = 'Standard / Non-DAISEE');

              INSERT INTO moisture_logic (season, operating_area, threshold_limit)
              SELECT 'JULY TO DECEMBER (DRY SEASON)', 'DAISEE Operating Areas', 'Moisture threshold limit is 20%'
              WHERE NOT EXISTS (SELECT 1 FROM moisture_logic WHERE season = 'JULY TO DECEMBER (DRY SEASON)' AND operating_area = 'DAISEE Operating Areas');

              INSERT INTO moisture_logic (season, operating_area, threshold_limit)
              SELECT 'JULY TO DECEMBER (DRY SEASON)', 'Standard / Non-DAISEE', 'Moisture threshold limit is 18%'
              WHERE NOT EXISTS (SELECT 1 FROM moisture_logic WHERE season = 'JULY TO DECEMBER (DRY SEASON)' AND operating_area = 'Standard / Non-DAISEE');
            `
          });
        } catch (err) {
          console.warn("Table creation warn on customer_master/moisture_logic:", err);
        }

        // Automatically construct user_activity_logs if it doesn't exist
        try {
          await supabase.rpc("exec_sql", {
            query: `
              CREATE TABLE IF NOT EXISTS user_activity_logs (
                log_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                username TEXT,
                activity_type TEXT,
                module_name TEXT,
                action_details TEXT,
                ip_address TEXT DEFAULT 'Local',
                created_at TIMESTAMPTZ DEFAULT NOW()
              );
              ALTER TABLE IF EXISTS user_activity_logs DISABLE ROW LEVEL SECURITY;
            `
          });
        } catch (err) {
          console.warn("Table creation warn on user_activity_logs:", err);
        }

        // Automatically construct unit_master and drop unit_maste if exists
        try {
          await supabase.rpc("exec_sql", {
            query: `
              -- Drop unit_maste
              DROP TABLE IF EXISTS unit_maste CASCADE;

              -- Create unit_master
              CREATE TABLE IF NOT EXISTS unit_master (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                unit_name TEXT NOT NULL UNIQUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );
              ALTER TABLE IF EXISTS unit_master DISABLE ROW LEVEL SECURITY;

              INSERT INTO unit_master (unit_name)
              VALUES ('DRUMS'), ('BALES'), ('LOOSE'), ('P.BALES'), ('H.BALES')
              ON CONFLICT (unit_name) DO NOTHING;

              CREATE TABLE IF NOT EXISTS deduction_master (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                deduction TEXT NOT NULL UNIQUE,
                rate_per_qntl NUMERIC(15,2),
                rate_per_unit NUMERIC(15,2),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
              );
              ALTER TABLE IF EXISTS deduction_master DISABLE ROW LEVEL SECURITY;

              INSERT INTO deduction_master (deduction, rate_per_qntl, rate_per_unit) VALUES
              ('GODOWN DAMAGE FOR BALES', NULL, 400),
              ('RAIN WET FOR BALES', NULL, 200),
              ('RTCH DAMAGE FOR BALES', NULL, 400),
              ('CT FOR HABIJABI / CHATTA / ROPE', 1500, NULL),
              ('RAIN WET FOR DRUMS', NULL, 200),
              ('RAIN WET FOR HALF BALES', NULL, 200),
              ('GODOWN DAMAGE FOR DRUMS', NULL, 200),
              ('GODOWN DAMAGE FOR HALF BALES', NULL, 200),
              ('PITCH DAMAGE FOR DRUMS', NULL, 200),
              ('PITCH DAMAGE FOR HALF BALES', NULL, 200),
              ('GODOWN DAMAGE FOR LOOSE', 400, NULL),
              ('PITCH DAMAGE FOR LOOSE', 400, NULL),
              ('RAIN WET FOR LOOSE', 400, NULL),
              ('IN CASE OF BALE IF WEIGHT IS LESS THAN 144', NULL, 20),
              ('IN CASE OF BALE IF WEIGHT IS LESS THAN 142', NULL, 30),
              ('IN CASE OF BALES IF WEIGHT IS LESS THAN 139', NULL, 40),
              ('DELIVERY CLAIM PER QUINTAL (RS. PER DAY)', NULL, 5)
              ON CONFLICT (deduction) DO NOTHING;
            `
          });
        } catch (err) {
          console.warn("Table creation warn on unit masters auto bootstrap:", err);
        }
      }

      let { data: records, error } = await supabase.rpc("exec_sql_return", {
        query:
          "SELECT c.relname as table_name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') ORDER BY c.relname",
      });

      if (error && error.message?.includes("function exec_sql_return")) {
         await supabase.rpc("exec_sql", { query: `
            DROP FUNCTION IF EXISTS exec_sql_return(text);
            CREATE OR REPLACE FUNCTION exec_sql_return(query text) RETURNS SETOF json AS $$
            BEGIN
              RETURN QUERY EXECUTE query;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
         `});
         const retry = await supabase.rpc("exec_sql_return", {
             query: "SELECT c.relname as table_name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') ORDER BY c.relname",
         });
         records = retry.data;
         error = retry.error;
      }

      if (error || !records || records.length === 0) {
        setTables(TABLES);
        if (!selectedTable) setSelectedTable(TABLES[0]);
        return;
      }

      const discoveredTables = records.map((r: any) => ({
        name: r.table_name,
        label: r.table_name.toUpperCase().replace(/_/g, " "),
        icon: Database,
        pk: "id",
      }));

      const mergedTables = discoveredTables.map((dt: any) => {
        const hardcoded = TABLES.find((ht) => ht.name === dt.name);
        return hardcoded ? { ...dt, label: hardcoded.label, icon: hardcoded.icon, pk: hardcoded.pk } : dt;
      });

      const { data: pkData } = await supabase.rpc("exec_sql_return", {
        query: `
          SELECT kcu.table_name, kcu.column_name
          FROM information_schema.table_constraints tco
          JOIN information_schema.key_column_usage kcu 
            ON kcu.constraint_name = tco.constraint_name
            AND kcu.table_schema = tco.table_schema
          WHERE tco.constraint_type = 'PRIMARY KEY'
          AND tco.table_schema = 'public'
        `,
      });

      if (pkData) {
        pkData.forEach((pk: any) => {
          const t = mergedTables.find((dt: any) => dt.name === pk.table_name);
          if (t && t.pk === "id") t.pk = pk.column_name;
        });
      }

      setTables(mergedTables);
      if (mergedTables.length > 0 && !selectedTable) {
        setSelectedTable(mergedTables[0]);
      }
    } catch (err) {
      setTables(TABLES);
      if (!selectedTable) setSelectedTable(TABLES[0]);
    }
  };

  // Fetch rows for select tables
  const fetchData = async () => {
    if (!supabase || !selectedTable) return;
    setLoading(true);
    try {
      let cols: { name: string; type: string }[] = [];
      const { data: colData, error: colError } = await supabase.rpc(
        "exec_sql_return",
        {
          query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${selectedTable.name}' AND table_schema = 'public' ORDER BY ordinal_position`,
        },
      );

      if (!colError && Array.isArray(colData) && colData.length > 0) {
        cols = colData.map((c: any) => ({ name: c.column_name, type: c.data_type }));
      }

      let records: any[] = [];
      const res = await supabase.from(selectedTable.name).select("*").limit(150);
      records = res.data || [];
      setData(records);

      if (cols.length === 0) {
        if (records.length > 0) {
          cols = Object.keys(records[0]).map((k) => ({
            name: k,
            type: typeof records[0][k] === "number" ? "numeric" : "text",
          }));
        } else {
          // Fallbacks for known tables if DB is empty and RPC query returned empty
          if (selectedTable.name === "supply_master") {
            cols = [
              { name: "id", type: "uuid" },
              { name: "supp_code", type: "text" },
              { name: "supp_name", type: "text" },
              { name: "acc_no", type: "text" },
              { name: "supp_add1", type: "text" },
              { name: "supp_add2", type: "text" },
              { name: "supp_add3", type: "text" },
              { name: "supp_city", type: "text" },
              { name: "supp_contact", type: "text" },
              { name: "supp_ph_no", type: "text" },
              { name: "supp_cell_no", type: "text" },
              { name: "supp_fax_no", type: "text" },
              { name: "supp_email", type: "text" },
              { name: "created_at", type: "timestamp with time zone" },
            ];
          } else if (selectedTable.name === "broker_master") {
            cols = [
              { name: "id", type: "uuid" },
              { name: "brok_code", type: "text" },
              { name: "brok_name", type: "text" },
              { name: "acc_no", type: "text" },
              { name: "brok_add1", type: "text" },
              { name: "brok_add2", type: "text" },
              { name: "brok_add3", type: "text" },
              { name: "brok_city", type: "text" },
              { name: "brok_contact", type: "text" },
              { name: "brok_ph_no", type: "text" },
              { name: "brok_cell_no", type: "text" },
              { name: "brok_fax_no", type: "text" },
              { name: "brok_email", type: "text" },
              { name: "created_at", type: "timestamp with time zone" },
            ];
          } else if (selectedTable.name === "area_master") {
            cols = [
              { name: "id", type: "uuid" },
              { name: "area_code", type: "text" },
              { name: "area_name", type: "text" },
              { name: "created_at", type: "timestamp with time zone" },
            ];
          } else if (selectedTable.name === "agency_master") {
            cols = [
              { name: "id", type: "uuid" },
              { name: "agency_code", type: "text" },
              { name: "agency_name", type: "text" },
              { name: "created_at", type: "timestamp with time zone" },
            ];
          } else if (selectedTable.name === "grade_master") {
            cols = [
              { name: "id", type: "uuid" },
              { name: "grade_code", type: "text" },
              { name: "grade_name", type: "text" },
              { name: "created_at", type: "timestamp with time zone" },
            ];
          } else if (selectedTable.name === "marka_master") {
            cols = [
              { name: "id", type: "uuid" },
              { name: "marka_code", type: "text" },
              { name: "marka_name", type: "text" },
              { name: "created_at", type: "timestamp with time zone" },
            ];
          }
        }
      }

      setCurrentColumns(cols);
    } catch (err) {
      console.error("Fetch records output failure:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Run arbitrary shell raw SQL query
  const runSqlQuery = async () => {
    if (!sqlQuery || !supabase) return;
    setSqlExecuting(true);
    setSqlResult(null);
    try {
      const { data, error } = await supabase.rpc("exec_sql_return", { query: sqlQuery });
      if (error) {
        setSqlResult({ error: error.message });
      } else {
        setSqlResult(data);
        fetchTables();
      }
    } catch (err: any) {
      setSqlResult({ error: err.message || "Command failure" });
    } finally {
      setSqlExecuting(false);
    }
  };

  const logActivityDirectly = async (type: string, details: string) => {
    if (!supabase) return;
    try {
      const username = getCurrentUserContext().username || 'ADMIN';
      await supabase.from('user_activity_logs').insert([{
        username,
        activity_type: type,
        module_name: selectedTable?.name || 'admindesk',
        action_details: details,
        ip_address: 'Local'
      }]);
    } catch (err) {
      console.warn("Direct activity logging problem:", err);
    }
  };

  // Database Row Edit submission
  const handleSave = async () => {
    if (!supabase || !selectedTable || !editingRow) return;
    setLoading(true);

    let rowToSave = { ...editingRow };
    if (selectedTable.name === "supply_master" && typeof rowToSave.supp_name === "string") {
      rowToSave.supp_name = rowToSave.supp_name.toUpperCase();
    }
    if (selectedTable.name === "broker_master" && typeof rowToSave.brok_name === "string") {
      rowToSave.brok_name = rowToSave.brok_name.toUpperCase();
    }

    const isNew = isNewRow;
    const cleanedRow: any = {};

    // Use currentColumns if available, else Object.keys of rowToSave
    const allCols = currentColumns.length > 0 ? currentColumns.map((c) => c.name) : Object.keys(rowToSave);

    if (isNew) {
      for (const col of allCols) {
        const val = rowToSave[col];
        const colInfo = currentColumns.find((c) => c.name === col);
        const colType = (colInfo?.type || "").toLowerCase();

        // 1. Primary key column handling
        if (col === selectedTable.pk) {
          const isUuid = colType.includes("uuid");
          const isAutoNum = colType.includes("int") || colType.includes("serial") || colType.includes("identity");

          if (isUuid || isAutoNum || val === "AUTO_GENERATED" || val === "" || val === null || val === undefined) {
            continue; // Skip primary key so DB generates ID
          }
        }

        // 2. Omit empty / null / AUTO_GENERATED fields on insert
        if (val === "" || val === null || val === undefined || val === "AUTO_GENERATED") {
          continue;
        }

        // 3. Type casting for numeric, int, boolean
        if (colType.includes("int")) {
          const num = parseInt(String(val), 10);
          if (!isNaN(num)) cleanedRow[col] = num;
        } else if (
          colType.includes("numeric") ||
          colType.includes("real") ||
          colType.includes("double") ||
          colType.includes("decimal")
        ) {
          const num = parseFloat(String(val));
          if (!isNaN(num)) cleanedRow[col] = num;
        } else if (colType.includes("boolean") || colType.includes("bool")) {
          cleanedRow[col] = String(val).toLowerCase() === "true" || val === true || val === "1";
        } else {
          cleanedRow[col] = typeof val === "string" ? val.trim() : val;
        }
      }

      // Determine if primary key is UUID vs integer/numeric
      const pkColInfo = currentColumns.find((c) => c.name === selectedTable.pk);
      const pkColType = (pkColInfo?.type || "").toLowerCase();
      const samplePkVal = data && data.length > 0 ? data[0][selectedTable.pk] : null;
      const isNumericPk = pkColType.includes("int") || pkColType.includes("serial") || pkColType.includes("numeric") || typeof samplePkVal === "number";
      const isExplicitUuidPk = pkColType.includes("uuid") || (typeof samplePkVal === "string" && samplePkVal.includes("-") && samplePkVal.length === 36);

      if (!cleanedRow[selectedTable.pk]) {
        if (isExplicitUuidPk) {
          cleanedRow[selectedTable.pk] = crypto.randomUUID();
        } else if (isNumericPk) {
          // Explicitly omit primary key so PostgreSQL sequence/identity auto-generates numeric ID (bigint)
          delete cleanedRow[selectedTable.pk];
        }
      }

      // Master table specific fallback values
      if (selectedTable.name === "supply_master") {
        if (!cleanedRow.supp_code && cleanedRow.supp_name) {
          cleanedRow.supp_code = `SUPP-${Math.floor(100 + Math.random() * 900)}`;
        }
      } else if (selectedTable.name === "broker_master") {
        if (!cleanedRow.brok_code && cleanedRow.brok_name) {
          cleanedRow.brok_code = `BROK-${Math.floor(100 + Math.random() * 900)}`;
        }
      } else if (selectedTable.name === "area_master") {
        if (!cleanedRow.area_code && cleanedRow.area_name) {
          cleanedRow.area_code = `AREA-${Math.floor(100 + Math.random() * 900)}`;
        }
      } else if (selectedTable.name === "agency_master") {
        if (!cleanedRow.agency_code && cleanedRow.agency_name) {
          cleanedRow.agency_code = `AGNC-${Math.floor(100 + Math.random() * 900)}`;
        }
      } else if (selectedTable.name === "grade_master") {
        if (!cleanedRow.grade_code && cleanedRow.grade_name) {
          cleanedRow.grade_code = `GRD-${Math.floor(100 + Math.random() * 900)}`;
        }
      } else if (selectedTable.name === "marka_master") {
        if (!cleanedRow.marka_code && cleanedRow.marka_name) {
          cleanedRow.marka_code = `MRK-${Math.floor(100 + Math.random() * 900)}`;
        }
      } else if (selectedTable.name === "user_master") {
        if (!cleanedRow.user_id && cleanedRow.username) {
          cleanedRow.user_id = cleanedRow.username.toLowerCase().trim().replace(/\s+/g, "_");
        }
        if (!cleanedRow.status) {
          cleanedRow.status = "Active";
        }
        if (!cleanedRow.role) {
          cleanedRow.role = "OPERATOR";
        }
      }

      if (currentColumns.some((c) => c.name === "created_at") && !cleanedRow.created_at) {
        cleanedRow.created_at = new Date().toISOString();
      }
    } else {
      for (const col of Object.keys(rowToSave)) {
        const val = rowToSave[col];
        const colInfo = currentColumns.find((c) => c.name === col);
        const colType = (colInfo?.type || "").toLowerCase();

        if (val === "" || val === null || val === undefined) {
          cleanedRow[col] = null;
        } else if (colType.includes("int")) {
          const num = parseInt(String(val), 10);
          cleanedRow[col] = isNaN(num) ? null : num;
        } else if (
          colType.includes("numeric") ||
          colType.includes("real") ||
          colType.includes("double") ||
          colType.includes("decimal")
        ) {
          const num = parseFloat(String(val));
          cleanedRow[col] = isNaN(num) ? null : num;
        } else if (colType.includes("boolean") || colType.includes("bool")) {
          cleanedRow[col] = String(val).toLowerCase() === "true" || val === true || val === "1";
        } else {
          cleanedRow[col] = typeof val === "string" ? val.trim() : val;
        }
      }
    }

    try {
      let savedResult: any = null;
      let res: any = null;

      if (isNew) {
        console.log(`[AdminDesk] Inserting row into ${selectedTable.name}:`, cleanedRow);
        try {
          res = await supabase.from(selectedTable.name).insert([cleanedRow]).select();
          if (res.data && res.data.length > 0) {
            savedResult = res.data[0];
          }
        } catch (e) {
          console.warn(`[AdminDesk] Primary insert error, executing dbModule fallback:`, e);
          savedResult = await dbModule.insert(selectedTable.name, cleanedRow);
        }

        if (res && res.error) {
          console.warn(`[AdminDesk] Supabase insert error (${res.error.message}), executing dbModule fallback`);
          savedResult = await dbModule.insert(selectedTable.name, cleanedRow);
        }

        if (!savedResult) savedResult = cleanedRow;
        logActivityDirectly("DATA_INSERTION", `Created new record in "${selectedTable.name}". Row data: ${JSON.stringify(savedResult)}`);
      } else {
        const pkVal = cleanedRow[selectedTable.pk] ?? rowToSave[selectedTable.pk];
        console.log(`[AdminDesk] Updating row in ${selectedTable.name} [PK ${selectedTable.pk}=${pkVal}]:`, cleanedRow);
        try {
          res = await supabase
            .from(selectedTable.name)
            .update(cleanedRow)
            .eq(selectedTable.pk, pkVal)
            .select();
          if (res.data && res.data.length > 0) {
            savedResult = res.data[0];
          }
        } catch (e) {
          console.warn(`[AdminDesk] Primary update error, executing dbModule fallback:`, e);
          savedResult = await dbModule.update(selectedTable.name, selectedTable.pk, pkVal, cleanedRow);
        }

        if (res && res.error) {
          console.warn(`[AdminDesk] Supabase update error (${res.error.message}), executing dbModule fallback`);
          savedResult = await dbModule.update(selectedTable.name, selectedTable.pk, pkVal, cleanedRow);
        }

        if (!savedResult) savedResult = { ...rowToSave, ...cleanedRow };
        logActivityDirectly("DATA_MODIFICATION", `Updated record [PK: ${pkVal}] in "${selectedTable.name}". Row data: ${JSON.stringify(savedResult)}`);
      }

      // Broadcast update across application
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app-data-updated", { detail: { table: selectedTable.name } }));
      }

      // If user_master updated, broadcast live permission changes
      if (selectedTable.name === "user_master") {
        broadcastPermissionsUpdated({
          userId: cleanedRow.user_id || rowToSave.user_id,
          username: cleanedRow.username || rowToSave.username,
          allowed_modules: cleanedRow.allowed_modules !== undefined ? cleanedRow.allowed_modules : rowToSave.allowed_modules,
          role: cleanedRow.role || rowToSave.role,
          level: cleanedRow.level || rowToSave.level,
        });
      }

      // Update local data state immediately
      setData((prev) => {
        if (isNew) {
          return [savedResult, ...prev];
        } else {
          const pkVal = savedResult[selectedTable.pk] ?? rowToSave[selectedTable.pk];
          return prev.map((r) => (r[selectedTable.pk] === pkVal ? savedResult : r));
        }
      });

      alert(`Record ${isNew ? "inserted" : "updated"} successfully in ${selectedTable.label}!`);
      setEditingRow(null);
      fetchData();
    } catch (err: any) {
      console.error("Save database record failure:", err);
      alert("Save database record failure: " + (err.message || JSON.stringify(err)));
    } finally {
      setLoading(false);
    }
  };

  // Delete matching table rows
  const handleDelete = async (pkValue: any) => {
    if (!canDeleteData()) {
      alert("Only Admin can delete data.");
      return;
    }

    if (!supabase || !selectedTable || !confirm("Verify direct deletion request?")) return;
    try {
      let err = null;
      try {
        const res = await supabase.from(selectedTable.name).delete().eq(selectedTable.pk, pkValue);
        if (res.error) err = res.error;
      } catch (e) {
        err = e;
      }

      if (err) {
        await dbModule.delete(selectedTable.name, selectedTable.pk, pkValue);
      }

      logActivityDirectly("DATA_DELETION", `Deleted record [PK: ${pkValue}] from table "${selectedTable.name}"`);

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app-data-updated", { detail: { table: selectedTable.name } }));
      }

      setData((prev) => prev.filter((r) => r[selectedTable.pk] !== pkValue));
      alert(`Record deleted successfully from ${selectedTable.label}!`);
      fetchData();
    } catch (err: any) {
      alert("Delete transaction failure: " + (err.message || JSON.stringify(err)));
    }
  };

  // Delete system column field path
  const handleDeleteColumn = async ( columnName: string) => {
    if (!canDeleteData()) {
      alert("Only Admin can delete data.");
      return;
    }

    if (!supabase || !confirm(`Permanently drop column "${columnName}"? This action cannot be revoked.`)) return;
    const sql = `ALTER TABLE ${selectedTable?.name} DROP COLUMN ${columnName};`;
    try {
      const { error } = await supabase.rpc("exec_sql", { query: sql });
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert("Drop column aborted: See console log data.");
    }
  };

  // Append customized field to selected table
  const handleAddField = async () => {
    if (!newFieldName || !supabase) return;
    const sql = `ALTER TABLE ${selectedTable?.name} ADD COLUMN ${newFieldName} ${newFieldType};`;
    try {
      const { error } = await supabase.rpc("exec_sql", { query: sql });
      if (error) throw error;
      setNewFieldName("");
      fetchData();
    } catch (err: any) {
      alert("Add core column field failed. Verify SQL privileges.");
    }
  };

  // Creation of entirely new table
  const handleCreateTable = async () => {
    if (!newTableName || !supabase) return;
    const sql = `CREATE TABLE IF NOT EXISTS ${newTableName} (id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW());`;
    try {
      const { error } = await supabase.rpc("exec_sql", { query: sql });
      if (error) throw error;
      setNewTableName("");
      fetchTables();
    } catch (err: any) {
      alert("Deploy structural table failed: Verify custom RPC configuration is correct.");
    }
  };

  // Complete system tables bootstrap bootloader
  const initializeDatabase = async () => {
    if (!supabase || !confirm("Deploy missing system database tables? This will patch empty files.")) return;
    try {
      // Build missing master entities
      await supabase.rpc("exec_sql", {
        query: `
          DROP TABLE IF EXISTS amad_master CASCADE;
          CREATE TABLE IF NOT EXISTS customer_master (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), firm_name TEXT, proprietor_name TEXT, email TEXT, contact_number TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
          ALTER TABLE IF EXISTS customer_master DISABLE ROW LEVEL SECURITY;
          CREATE TABLE IF NOT EXISTS user_master (user_id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT DEFAULT 'USER', status TEXT DEFAULT 'Active', allowed_modules TEXT DEFAULT '*', level TEXT DEFAULT 'L1', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), last_login TIMESTAMP WITH TIME ZONE); ALTER TABLE user_master ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
          CREATE TABLE IF NOT EXISTS sauda_master (sauda_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, sauda_no TEXT UNIQUE, broker TEXT, rate_qntl NUMERIC, f_year TEXT);
          CREATE TABLE IF NOT EXISTS user_activity_logs (
            log_id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
            username TEXT,
            activity_type TEXT,
            module_name TEXT,
            action_details TEXT,
            ip_address TEXT DEFAULT 'Local',
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS user_activity_logs DISABLE ROW LEVEL SECURITY;

          -- Create final_arrival table base on JPG specifications
          CREATE TABLE IF NOT EXISTS final_arrival (
            final_arrival_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            financial_year TEXT,
            final_arrival_no TEXT,
            mr_no TEXT,
            po_no TEXT,
            po_date DATE,
            date DATE,
            jci TEXT,
            challan_supplier TEXT,
            supplier TEXT,
            broker TEXT,
            transporter_name TEXT,
            challan_rr_no TEXT,
            challan_railway_receipt_no TEXT,
            challan_rr_date DATE,
            lorry_number TEXT,
            pan_no TEXT,
            consignment_note TEXT,
            consignment_note_no TEXT,
            consignment_note_date DATE,
            di_no TEXT,
            di_date DATE,
            invoice_no TEXT,
            invoice_date DATE,
            ptf TEXT,
            ptf TEXT,
            lorry_returned BOOLEAN,
            lorry_returned_other_mill TEXT,
            arrival_area_code TEXT,
            arrival_area_name TEXT,
            unit_code TEXT,
            unit_name TEXT,
            way_bill_no TEXT,
            way_bill_date DATE,
            apmc_fees NUMERIC,
            remarks TEXT,
            temporary_arrival_no TEXT,
            temporary_arrival_date DATE,
            total_packets NUMERIC,
            weight_qtl NUMERIC,
            grid_details JSONB,
            challan_material_weight NUMERIC,
            actual_gross_weight NUMERIC,
            actual_tare_weight NUMERIC,
            supplier_net_weight NUMERIC,
            supplier_challan_gross NUMERIC,
            supplier_tare_weight NUMERIC,
            electronic_net_weight NUMERIC,
            electronic_gross_weight NUMERIC,
            electronic_tare_weight NUMERIC,
            weight_reduced NUMERIC,
            created_at TIMESTAMPTZ DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS final_arrival DISABLE ROW LEVEL SECURITY;

          -- Create unit_master
          CREATE TABLE IF NOT EXISTS unit_master (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            unit_name TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          ALTER TABLE IF EXISTS unit_master DISABLE ROW LEVEL SECURITY;

          INSERT INTO unit_master (unit_name)
          VALUES ('DRUMS'), ('BALES'), ('LOOSE'), ('P.BALES'), ('H.BALES')
          ON CONFLICT (unit_name) DO NOTHING;

          -- Drop unit_maste
          DROP TABLE IF EXISTS unit_maste CASCADE;
        `,
      });
      fetchTables();
      alert("Bootstrap database completed successfully. Systems updated.");
    } catch (err: any) {
      alert("DB bootstrap failed. Check connection configuration details.");
    }
  };

  // Drop select database table
  const handleDropTable = async (tableName: string) => {
    if (!supabase) return;
    const sql = `DROP TABLE IF EXISTS ${tableName} CASCADE;`;
    try {
      const { error } = await supabase.rpc("exec_sql", { query: sql });
      if (error) throw error;
      fetchTables();
      setSelectedTable(null);
    } catch (err: any) {
      alert("Drop structural table failed: SQL execution exception.");
    }
  };

  // Parsed CSV loaders
  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase || !selectedTable) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          let rowsToInsert = results.data;
          if (selectedTable.name === "supply_master") {
            rowsToInsert = results.data.map((row: any) => {
              if (row && typeof row.supp_name === "string") {
                return { ...row, supp_name: row.supp_name.toUpperCase() };
              }
              return row;
            });
          }
          const { error } = await supabase.from(selectedTable.name).insert(rowsToInsert);
          if (error) throw error;
          fetchData();
          alert(`Successfully inserted ${results.data.length} records into ${selectedTable.label}`);
        } catch (err: any) {
          alert("Import failed: check schema match. Error " + err.message);
        }
      },
    });
  };

  // Helper column field modifiers
  const editorColumns = useMemo(() => {
    return currentColumns.map((col) => col.name);
  }, [currentColumns]);

  const renderEditField = (col: string) => {
    const val = editingRow?.[col] ?? "";
    const colType = currentColumns.find((c) => c.name === col)?.type || "text";

    // Dynamic auto-generation for USER_ID in user_master
    if (selectedTable?.name === "user_master" && col === "user_id") {
      let currentVal = val;
      if (!currentVal) {
        // Auto calculate next numerical serial ID like 001, 002
        let nextNum = 1;
        if (data && data.length > 0) {
          const numericIds = data
            .filter((r) => String(r.user_id || "").length < 10)
            .map((r) => {
              const matched = String(r.user_id).match(/\d+/);
              return matched ? parseInt(matched[0], 10) : NaN;
            })
            .filter((n) => !isNaN(n));
          if (numericIds.length > 0) {
            nextNum = Math.max(...numericIds) + 1;
          }
        }
        currentVal = String(nextNum).padStart(3, "0");
        
        // Push update to state deferred to prevent React render-loop warn
        setTimeout(() => {
          setEditingRow((prev: any) => {
            if (prev && !prev.user_id) {
              return { ...prev, user_id: currentVal };
            }
            return prev;
          });
        }, 0);
      }

      return (
        <input
 id="system_generated_serial_1272" name="system_generated_serial" aria-label="System Generated Serial"          type="text"
          value={currentVal}
          onChange={(e) => setEditingRow((prev: any) => ({ ...prev, [col]: e.target.value }))}
          className="w-full bg-white border border-slate-300 p-2 text-xs font-black font-mono rounded outline-none focus:border-indigo-500"
          placeholder="System Generated Serial"
        />
      );
    }

    // Dynamic auto-generation for CREATED_AT in user_master
    if (selectedTable?.name === "user_master" && col === "created_at") {
      let currentVal = val;
      if (!currentVal) {
        currentVal = new Date().toISOString();
        setTimeout(() => {
          setEditingRow((prev: any) => {
            if (prev && !prev.created_at) {
              return { ...prev, created_at: currentVal };
            }
            return prev;
          });
        }, 0);
      }

      return (
        <input
 id="creation_timestamp_1298" name="creation_timestamp" aria-label="Creation Timestamp"          type="text"
          value={currentVal}
          disabled
          className="w-full bg-slate-100 border border-slate-300 p-2 text-xs font-black font-mono rounded outline-none cursor-not-allowed opacity-80"
          placeholder="Creation Timestamp"
        />
      );
    }

    // Overrides for user_activity_logs
    if (selectedTable?.name === "user_activity_logs") {
      if (col === "log_id") {
        return (
          <input
 id="system_sequential_unique__1312" name="system_sequential_unique_" aria-label="System Sequential Unique Key"            type="text"
            value={val || "AUTO_GENERATED"}
            disabled
            className="w-full bg-slate-100 border border-slate-300 p-2 text-xs font-black font-mono rounded outline-none cursor-not-allowed opacity-80"
            placeholder="System Sequential Unique Key"
          />
        );
      }
      if (col === "created_at") {
        let currentVal = val;
        if (!currentVal) {
          currentVal = new Date().toISOString();
          setTimeout(() => {
            setEditingRow((prev: any) => {
              if (prev && !prev.created_at) {
                return { ...prev, created_at: currentVal };
              }
              return prev;
            });
          }, 0);
        }
        return (
          <input
 id="event_timestamp_1335" name="event_timestamp" aria-label="Event Timestamp"            type="text"
            value={currentVal}
            disabled
            className="w-full bg-slate-100 border border-slate-300 p-2 text-xs font-black font-mono rounded outline-none cursor-not-allowed opacity-80"
            placeholder="Event Timestamp"
          />
        );
      }
      if (col === "username") {
        let currentVal = val;
        if (!currentVal) {
          currentVal = getCurrentUserContext().username || 'ADMIN';
          setTimeout(() => {
            setEditingRow((prev: any) => {
              if (prev && !prev.username) {
                return { ...prev, username: currentVal };
              }
              return prev;
            });
          }, 0);
        }
      }
      if (col === "ip_address") {
        let currentVal = val;
        if (!currentVal) {
          currentVal = "Local";
          setTimeout(() => {
            setEditingRow((prev: any) => {
              if (prev && !prev.ip_address) {
                return { ...prev, ip_address: currentVal };
              }
              return prev;
            });
          }, 0);
        }
      }
    }

    if (col === "role") {
      const activeRole = val || "OPERATOR";
      return (
        <select
 id="activerole_1377" name="activerole" aria-label="activerole"          value={activeRole}
          onChange={(e) => setEditingRow((prev: any) => ({ ...prev, [col]: e.target.value }))}
          className="w-full bg-white border border-slate-300 p-2 text-xs font-bold rounded outline-none cursor-pointer"
        >
          <option value="OPERATOR">OPERATOR</option>
          <option value="USER">USER</option>
          <option value="SUPER USER">SUPER USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      );
    }

    if (col.toLowerCase() === "level") {
      const activeLevel = val || "L1";
      return (
        <select
 id="activelevel_1393" name="activelevel" aria-label="activelevel"          value={activeLevel}
          onChange={(e) => setEditingRow((prev: any) => ({ ...prev, [col]: e.target.value }))}
          className="w-full bg-white border border-slate-300 p-2 text-xs font-bold rounded outline-none cursor-pointer"
        >
          <option value="L1">L1</option>
          <option value="L2">L2</option>
          <option value="L3">L3</option>
          <option value="L4">L4</option>
          <option value="L5">L5</option>
        </select>
      );
    }

    if (col === "status") {
      return (
        <select
 id="val_active_1409" name="val_active" aria-label="val active"          value={val || "Active"}
          onChange={(e) => setEditingRow((prev: any) => ({ ...prev, [col]: e.target.value }))}
          className="w-full bg-white border border-slate-300 p-2 text-xs font-bold rounded outline-none cursor-pointer"
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      );
    }

    if (col === "is_active" || col.toLowerCase() === "is_active") {
      const activeVal = String(val).toLowerCase() === "true" || val === "1" || val === 1 || val === "Active" || val === true;
      return (
        <select
 id="activeval_true_false_1423" name="activeval_true_false" aria-label="activeval true false"          value={activeVal ? "true" : "false"}
          onChange={(e) => setEditingRow((prev: any) => ({ ...prev, [col]: e.target.value === "true" }))}
          className="w-full bg-white border border-slate-300 p-2 text-xs font-bold rounded outline-none cursor-pointer"
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      );
    }

    if (col === "allowed_modules") {
      const allModulesList = ALL_SYSTEM_MODULES;

      const currentVal = (String(val) || "").trim();
      const isAll = currentVal === "*";
      const selectedList = isAll 
        ? allModulesList.map(m => m.id) 
        : normalizeAllowedModules(currentVal);

      const handleToggle = (id: string) => {
        const canonicalId = getCanonicalModuleId(id);
        let newList: string[];
        if (selectedList.includes(canonicalId)) {
          newList = selectedList.filter(x => x !== canonicalId);
        } else {
          newList = [...selectedList, canonicalId];
        }
        const valToSave = newList.length === allModulesList.length ? "*" : newList.join(",");
        setEditingRow((prev: any) => ({ ...prev, [col]: valToSave }));
      };

      const handleToggleAll = () => {
        if (isAll) {
          setEditingRow((prev: any) => ({ ...prev, [col]: "" }));
        } else {
          setEditingRow((prev: any) => ({ ...prev, [col]: "*" }));
        }
      };

      const handleApplyPreset = (presetModules: string[]) => {
        const normalizedPresets = normalizeAllowedModules(presetModules);
        const valToSave = normalizedPresets.join(",");
        setEditingRow((prev: any) => ({ ...prev, [col]: valToSave }));
      };

      // Group modules by category for pristine scannability
      const categories = Array.from(new Set(allModulesList.map(m => m.category)));

      return (
        <div className="border border-slate-300 p-3 rounded-lg bg-slate-50 space-y-3 max-h-[320px] overflow-y-auto w-full text-left font-sans shadow-inner col-span-2">
          {/* Quick Select Presets Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <input
                name="checkbox"
                aria-label="Full access"
                type="checkbox"
                id="module-all"
                checked={isAll}
                onChange={handleToggleAll}
                className="rounded text-emerald-700 focus:ring-emerald-600 h-4 w-4 cursor-pointer accent-emerald-700"
              />
              <label htmlFor="module-all" className="text-xs font-black text-emerald-950 uppercase cursor-pointer">
                ★ * (Full Access to All Modules)
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Presets:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset(['sms_sauda', 'sauda'])}
                className="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer border border-indigo-300"
              >
                SMS + Sauda Desk
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(['sauda'])}
                className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer border border-amber-300"
              >
                Sauda Only
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(['main_gate'])}
                className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer border border-blue-300"
              >
                Main Gate Only
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(['sms_sauda'])}
                className="px-2 py-0.5 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer border border-purple-300"
              >
                SMS Only
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(['sauda', 'main_gate', 'sms_sauda'])}
                className="px-2 py-0.5 bg-teal-100 hover:bg-teal-200 text-teal-900 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer border border-teal-300"
              >
                Sauda + Gate + SMS
              </button>
              <button
                type="button"
                onClick={() => setEditingRow((prev: any) => ({ ...prev, [col]: "" }))}
                className="px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer border border-rose-300"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Current Selection Summary */}
          <div className="bg-white border border-slate-200 p-2 rounded text-[11px] text-slate-700 flex items-center justify-between">
            <span className="font-semibold text-slate-600">
              Active Permissions: <strong className="text-emerald-800 font-mono">{isAll ? "FULL ACCESS (*)" : `${selectedList.length} permitted module(s)`}</strong>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              DB Value: {currentVal || "(none)"}
            </span>
          </div>

          {/* Grouped Categorized Checkboxes */}
          <div className="space-y-3">
            {categories.map((category) => {
              const items = allModulesList.filter(m => m.category === category);
              return (
                <div key={category} className="bg-white border border-slate-200 rounded-md p-2.5 shadow-xs">
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 pb-1 border-b border-slate-100">
                    {category}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                    {items.map((item) => {
                      const isChecked = isAll || selectedList.includes(item.id.toLowerCase());
                      return (
                        <div key={item.id} className="flex items-center gap-2">
                          <input
                            name="checkbox"
                            aria-label={item.label}
                            type="checkbox"
                            id={`module-${item.id}`}
                            checked={isChecked}
                            disabled={isAll}
                            onChange={() => handleToggle(item.id)}
                            className="rounded text-emerald-700 focus:ring-emerald-600 h-3.5 w-3.5 cursor-pointer accent-emerald-700 disabled:opacity-50"
                          />
                          <label
                            htmlFor={`module-${item.id}`}
                            className={`text-[11px] font-semibold tracking-tight truncate cursor-pointer ${
                              isAll ? 'text-slate-400' : isChecked ? 'text-emerald-950 font-bold' : 'text-slate-700 hover:text-slate-900'
                            }`}
                          >
                            {item.label}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Handle primary key column rules generically to prevent UUID/auto-increment mismatch errors
    if (col === selectedTable?.pk) {
      if (!isNewRow) {
        // Disabled for editing existing rows (cannot change PK)
        return (
          <input
 id="val_1532" name="val" aria-label="val"            type="text"
            value={val}
            disabled
            className="w-full bg-slate-100 border border-slate-300 p-2 text-xs font-black font-mono rounded outline-none cursor-not-allowed opacity-80 text-slate-600"
          />
        );
      } else {
        // If it's a new row, and the PK column is a UUID or auto-incrementing integer (e.g., contains uuid, int, or the name is "id" and is not user_master)
        const isUuid = colType.toLowerCase().includes("uuid") || (selectedTable?.name === "customer_master" && col === "id");
        const isAutoNum = colType.toLowerCase().includes("int") || colType.toLowerCase().includes("serial") || colType.toLowerCase().includes("identity") || col === "id";
        
        if (isUuid || isAutoNum) {
          return (
            <input
 id="system_generated_id_1546" name="system_generated_id" aria-label="System Generated ID"              type="text"
              value="AUTO_GENERATED"
              disabled
              className="w-full bg-slate-100 border border-slate-300 p-2 text-xs font-black font-mono rounded outline-none cursor-not-allowed opacity-80 text-slate-500 font-semibold"
              placeholder="System Generated ID"
            />
          );
        }
      }
    }

    return (
      <input
 id="val_1559" name="val" aria-label="val"        type={colType.includes("int") || colType.includes("numeric") ? "number" : "text"}
        value={val}
        onChange={(e) => setEditingRow((prev: any) => ({ ...prev, [col]: e.target.value }))}
        className="w-full bg-white border border-slate-300 p-2 text-xs font-bold font-mono rounded outline-none"
      />
    );
  };

  // Standard vintage fallback login flow if they arent logged in
  if (!isAuthenticated) {
    return (
      <div className="h-screen w-full bg-[#dfdfdf] flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-[#E8E6E1] border-t-white border-l-white border-b-slate-800 border-r-slate-800 border-2 shadow-[2px_2px_0_0_rgba(0,0,0,0.2)]">
          <div className="bg-[#000080] text-white px-2 py-1 flex justify-between items-center h-8">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest italic">Admin Master Lock</span>
            </div>
          </div>
          <div className="p-8 space-y-6">
             <div className="text-center space-y-1">
                <h2 className="text-2xl font-black text-indigo-950 italic">Administrative Vault</h2>
                <p className="text-[9px] font-extrabold text-[#000080] uppercase tracking-widest leading-none">Console Override</p>
             </div>
             {error && <div className="p-2 border border-rose-300 bg-rose-50 text-rose-800 text-[10px] uppercase font-bold text-center">{error}</div>}
             <div className="space-y-4">
                <input
 id="operator_id_1586" name="operator_id" aria-label="Operator ID"                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  className="w-full bg-white border border-slate-300 p-2 text-sm uppercase outline-none placeholder:text-slate-300 font-bold"
                  placeholder="Operator ID"
                />
                <input
 id="password_1592" name="password" aria-label="Password"                  type="password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  className="w-full bg-white border border-slate-300 p-2 text-sm outline-none placeholder:text-slate-300 font-bold"
                  placeholder="Password"
                />
                <button
                  onClick={() => {
                    if (loginUser.toUpperCase() === "ADMIN" && loginPass === "Admin@1234") {
                      setIsAuthenticated(true);
                      if (onLogin) onLogin();
                    } else if (loginUser.toUpperCase() !== "ADMIN") {
                      setError("AUTHENTICATION DENIED: ADMIN PRIVILEGES REQUIRED.");
                    } else {
                      setError("AUTHENTICATION DENIED: INVALID PASSWORD.");
                    }
                  }}
                  className="w-full py-3 bg-[#000080] text-white font-black uppercase text-[11px] tracking-[0.2em]"
                >
                  DESTRUCT CRITICAL OVERRIDE
                </button>
             </div>
          </div>
        </div>
      </div>
    );
  }

  const renderSystemLogs = () => {
    const filteredLogs = systemLogs.filter(log => {
      const matchesSearch = 
        log.details.toLowerCase().includes(logFilter.toLowerCase()) ||
        log.event.toLowerCase().includes(logFilter.toLowerCase()) ||
        log.currentPage.toLowerCase().includes(logFilter.toLowerCase());
      
      const matchesType = logType === "ALL" || log.event === logType;
      
      return matchesSearch && matchesType;
    });

    const filteredPrintLogs = printLogs.filter((log) => {
      // Exclude auto-sync logs from standard material quality print logs
      if (log.details && log.details.startsWith("[AUTO-SYNC ENGINE]")) {
        return false;
      }
      const query = logFilter.toLowerCase();
      return (
        log.user_id.toLowerCase().includes(query) ||
        log.details.toLowerCase().includes(query) ||
        (log.row_ids && log.row_ids.some((id: string) => id.toLowerCase().includes(query)))
      );
    });

    // Parse and prepare sync logs specifically for the Auto-Sync Operations tab in Admin Desk
    const syncLogsParsed = printLogs
      .filter((log) => {
        return log.details && log.details.trim().startsWith("[AUTO-SYNC ENGINE]");
      })
      .map((log) => {
        const detailsStr = log.details || "";
        const parts = detailsStr.split("|");
        
        let finalArrivalNo = "N/A";
        let mrNo = "N/A";
        let originalState: any = null;
        let updatedState: any = null;

        parts.forEach((p: string) => {
          const trimmed = p.trim();
          if (trimmed.startsWith("[AUTO-SYNC ENGINE] MATCH:")) {
            finalArrivalNo = trimmed.replace("[AUTO-SYNC ENGINE] MATCH:", "").trim();
          } else if (trimmed.startsWith("MR:")) {
            mrNo = trimmed.replace("MR:", "").trim();
          } else if (trimmed.startsWith("ORIGINAL:")) {
            try {
              originalState = JSON.parse(trimmed.replace("ORIGINAL:", "").trim());
            } catch (err) {
              // fallback
            }
          } else if (trimmed.startsWith("UPDATED:")) {
            try {
              updatedState = JSON.parse(trimmed.replace("UPDATED:", "").trim());
            } catch (err) {
              // fallback
            }
          }
        });

        // Regex fallback if split fails
        if (finalArrivalNo === "N/A") {
          const matchArrival = detailsStr.match(/MATCH:\s*([A-Za-z0-9\-\/]+)/) || detailsStr.match(/arrival\s*#([A-Za-z0-9\-\/]+)/);
          if (matchArrival) finalArrivalNo = matchArrival[1];
        }
        if (mrNo === "N/A") {
          const matchMR = detailsStr.match(/MR:\s*([A-Za-z0-9\-\/]+)/) || detailsStr.match(/inspection\s*MR:\s*([A-Za-z0-9\-\/]+)/);
          if (matchMR) mrNo = matchMR[1];
        }

        return {
          id: log.id,
          timestamp: log.timestamp,
          user_id: log.user_id,
          finalArrivalNo,
          mrNo,
          originalState,
          updatedState,
          rawDetails: detailsStr
        };
      });

    const filteredSyncLogs = syncLogsParsed.filter((log) => {
      const query = logFilter.toLowerCase();
      return (
        log.finalArrivalNo.toLowerCase().includes(query) ||
        log.mrNo.toLowerCase().includes(query) ||
        log.user_id.toLowerCase().includes(query) ||
        log.rawDetails.toLowerCase().includes(query)
      );
    });

    const eventTypes = ["ALL", "SYSTEM_BOOT", "NAVIGATION", "TASK_STARTED", "MINIMIZE", "RESTORE", "PAGE_CLOSE", "SYSTEM_DEPART"];

    // Compute unique printed items count
    const uniqueMrNos = new Set<string>();
    printLogs.forEach(l => {
      // Exclude sync operations from printed counts
      if (l.details && l.details.trim().startsWith("[AUTO-SYNC ENGINE]")) {
        return;
      }
      if (Array.isArray(l.row_ids)) {
        l.row_ids.forEach((id: string) => uniqueMrNos.add(id));
      }
    });

    return (
      <div className="space-y-4">
        {/* Sub-tab selection */}
        <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300">
          <button
            onClick={() => setLogSubTab("system")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
              logSubTab === "system"
                ? "border-indigo-600 text-indigo-600 bg-indigo-50/10"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            💻 System activity debugger
          </button>
          <button
            onClick={() => setLogSubTab("print")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
              logSubTab === "print"
                ? "border-emerald-600 text-emerald-600 bg-emerald-50/10"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            🖨️ inspection print audit logs
          </button>
          <button
            onClick={() => setLogSubTab("sync")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
              logSubTab === "sync"
                ? "border-amber-600 text-amber-600 bg-amber-100/10"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            🔄 Auto-Sync Operations Audit
          </button>
          <button
            onClick={() => setLogSubTab("queue")}
            className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
              logSubTab === "queue"
                ? "border-indigo-600 text-indigo-600 bg-indigo-50/10"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            📋 Central Print Queue
          </button>
        </div>

        {/* Logs Control Panel */}
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className={`p-2 rounded-lg ${
              logSubTab === "system" 
                ? "bg-indigo-50 text-indigo-600" 
                : logSubTab === "print" 
                  ? "bg-emerald-50 text-emerald-600" 
                  : logSubTab === "sync"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-pink-50 text-[#ec407a]"
            }`}>
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 font-display">
                {logSubTab === "system" 
                  ? "System Activity Event Debugger" 
                  : logSubTab === "print" 
                    ? "Material Quality Print Audit Registry" 
                    : logSubTab === "sync"
                      ? "DAEMON SUMMARY: Auto-Sync status verification ledger"
                      : "Centralized Jute Mill Document Print Queue"}
              </h4>
              <p className="text-[10px] text-slate-400 font-medium">
                {logSubTab === "system" 
                  ? "Track and monitor interface states, workspace tasks, and taskbar events" 
                  : logSubTab === "print"
                    ? "Authorized legal printed transaction log tracking; auditing print counts, target rows, and operational operator IDs"
                    : logSubTab === "sync"
                      ? "Traceability logs recording automatic cross-references between pending unclubbed arrivals and finalized quality inspections"
                      : "Queued documents stored for printing, allowing quick re-printing or purging without re-opening individual modules"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Search Input */}
            {logSubTab !== "queue" && (
              <div className="relative flex items-center bg-slate-50 border border-slate-200 px-2.5 py-1.5 w-full sm:w-48 text-xs rounded-lg">
                <Search className="h-3.5 w-3.5 text-slate-400 mr-1.5 shrink-0" />
                <input
 id="search_logs_1814" name="search_logs" aria-label="Search logs..."                  type="text"
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  placeholder="Search logs..."
                  className="bg-transparent border-none outline-none text-slate-707 w-full placeholder:text-slate-450 font-semibold"
                />
              </div>
            )}

            {/* Quick Queueing Form for Queue subtab only */}
            {logSubTab === "queue" && (
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto font-sans">
                <select
 id="queuemodule_1827" name="queuemodule" aria-label="queuemodule"                  value={queueModule}
                  onChange={(e) => setQueueModule(e.target.value as any)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-slate-650 outline-none w-full sm:w-auto cursor-pointer"
                >
                  <option value="po">P.O Contract</option>
                  <option value="sauda">Sauda Agreement</option>
                  <option value="amad">AMAD Entry</option>
                  <option value="material_inspection">Inspection Report</option>
                  <option value="stock">Stock Inventory</option>
                </select>

                <div className="relative flex items-center bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-xs rounded-lg w-full sm:w-44">
                  <input
 id="enter_no_ref_1840" name="enter_no_ref" aria-label="Enter No/Ref..."                    type="text"
                    value={queueDocRef}
                    onChange={(e) => setQueueDocRef(e.target.value)}
                    placeholder="Enter No/Ref..."
                    className="bg-transparent border-none outline-none text-slate-707 w-full font-extrabold placeholder:text-slate-400 uppercase font-mono"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddToQueue();
                    }}
                  />
                </div>

                <button
                  onClick={handleAddToQueue}
                  disabled={queueLoading}
                  className="bg-indigo-650 hover:bg-indigo-700 text-white font-black text-[9px] px-4 py-2 rounded-lg transition-all uppercase tracking-wider disabled:opacity-50 w-full sm:w-auto cursor-pointer whitespace-nowrap"
                >
                  {queueLoading ? "Finding..." : "Queue Doc"}
                </button>
              </div>
            )}

            {/* Filter Category Select - only show if on System logs */}
            {logSubTab === "system" && (
              <select
 id="logtype_1864" name="logtype" aria-label="logtype"                value={logType}
                onChange={(e) => setLogType(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-bold text-slate-600 outline-none cursor-pointer"
              >
                {eventTypes.map(t => (
                  <option key={t} value={t}>{t === "ALL" ? "All Event Types" : t.replace(/_/g, " ")}</option>
                ))}
              </select>
            )}

            {/* Clear Logs button for Print Subtab */}
            {logSubTab === "print" && (
              <button
                onClick={handleClearPrintLogs}
                className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-extrabold text-[10px] px-3.5 py-1.5 rounded-lg transition-all uppercase tracking-wider cursor-pointer font-sans"
              >
                Clear Audit Trail
              </button>
            )}

            {/* Clear Logs Button (for system activity) */}
            {logSubTab === "system" && onClearLogs && (
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to purge the event log trace buffer?")) {
                    onClearLogs();
                  }
                }}
                className="bg-rose-50 hover:bg-rose-105 border border-rose-200 text-rose-600 font-extrabold text-[10px] px-3.5 py-1.5 rounded-lg transition-all uppercase tracking-wider cursor-pointer font-sans"
              >
                Clear Log Buffer
              </button>
            )}
          </div>
        </div>

        {logSubTab === "system" ? (
          <>
            {/* Stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Trace Volume</span>
                <span className="text-base font-black text-slate-800 font-mono mt-0.5 block">{systemLogs.length} events</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Filtered Volume</span>
                <span className="text-base font-black text-indigo-600 font-mono mt-0.5 block">{filteredLogs.length} events</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-150 shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Current Page State</span>
                <span className="text-xs font-mono font-black text-slate-705 block mt-1 truncate uppercase bg-slate-50 px-2.5 py-0.5 border border-slate-200 rounded max-w-full">{systemLogs[0]?.currentPage || "dashboard"}</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-150 shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Active Tasks State</span>
                <span className="text-[10px] font-mono font-black text-emerald-600 block mt-1 truncate max-w-full">
                  {systemLogs[0]?.runningPages?.join(", ") || "(none)"}
                </span>
              </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white rounded-xl border border-slate-150 shadow-md overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider ">
                    <tr>
                      <th className="p-3 w-1/12 text-center">Timestamp</th>
                      <th className="p-3 w-2/12">Event Tag</th>
                      <th className="p-3 w-5/12">Execution Detail Trace</th>
                      <th className="p-3 w-2/12 text-center">Screen State</th>
                      <th className="p-3 w-2/12">Running Pages State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-105 font-mono text-[10px] text-slate-700">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-sans italic">
                          No system events captured matching the specified filters. Try selecting "All Event Types" or typing other words.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => {
                        let badgeClass = "bg-slate-100 text-slate-755 border-slate-200";
                        if (log.event === "SYSTEM_BOOT") badgeClass = "bg-emerald-50 text-emerald-750 border-emerald-250";
                        else if (log.event === "NAVIGATION") badgeClass = "bg-blue-50 text-blue-755 border-blue-255";
                        else if (log.event === "TASK_STARTED") badgeClass = "bg-indigo-50 text-indigo-755 border-indigo-250";
                        else if (log.event === "MINIMIZE") badgeClass = "bg-amber-50 text-amber-755 border-amber-250";
                        else if (log.event === "RESTORE") badgeClass = "bg-cyan-50 text-cyan-755 border-cyan-250";
                        else if (log.event === "PAGE_CLOSE") badgeClass = "bg-rose-50 text-rose-755 border-rose-250";
                        else if (log.event === "SYSTEM_DEPART") badgeClass = "bg-orange-50 text-orange-755 border-orange-250";

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/60 font-semibold transition-colors">
                            <td className="p-2.5 text-center text-slate-450 font-mono whitespace-nowrap text-[9px] border-r border-slate-100">
                              {log.timestamp}
                            </td>
                            <td className="p-2.5 whitespace-nowrap border-r border-slate-100">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-wider  ${badgeClass}`}>
                                {log.event}
                              </span>
                            </td>
                            <td className="p-2.5 font-sans font-semibold text-slate-800 break-words max-w-[30vw] border-r border-slate-100">
                              {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details ?? '')}
                            </td>
                            <td className="p-2.5 text-center border-r border-slate-100">
                              <span className="bg-slate-50 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded text-[9px] font-bold block truncate uppercase">
                                {log.currentPage}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <div className="flex flex-wrap gap-1">
                                {log.runningPages.length === 0 ? (
                                  <span className="text-[9px] text-slate-400 italic font-sans">(none)</span>
                                ) : (
                                  log.runningPages.map(rp => (
                                    <span key={rp} className="bg-indigo-50/50 border border-indigo-100 text-indigo-600 text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase">
                                      {rp}
                                    </span>
                                  ))
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : logSubTab === "print" ? (
          <>
            {/* stats strip print */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Total Print Events</span>
                <span className="text-base font-black text-slate-800 font-mono mt-0.5 block">{printLogs.length} triggers</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Filtered Records</span>
                <span className="text-base font-black text-emerald-600 font-mono mt-0.5 block">{filteredPrintLogs.length} events</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-150 shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Unique printed items</span>
                <span className="text-base font-black text-[#0d47a1] font-mono mt-0.5 block">{uniqueMrNos.size} MR Nos</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-150 shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Legal Framework</span>
                <span className="text-[10px] font-black text-amber-600 font-mono mt-1.5 block uppercase">Audit Safe v1.2</span>
              </div>
            </div>

            {/* Print Logs Table */}
            <div className="bg-white rounded-xl border border-slate-150 shadow-md overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider ">
                    <tr>
                      <th className="p-3 w-2/12 text-center">Timestamp</th>
                      <th className="p-3 w-2/12">Operator ID</th>
                      <th className="p-3 w-3/12">Target Record M.R. Nos</th>
                      <th className="p-3 w-5/12">Execution Audit narrative</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-105 font-mono text-[10px] text-slate-700">
                    {filteredPrintLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400 font-sans italic">
                          No material inspection print events captured matching specified query.
                        </td>
                      </tr>
                    ) : (
                      filteredPrintLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/60 transition-colors font-semibold animate-fade-in">
                          <td className="p-2.5 text-center text-slate-450 whitespace-nowrap border-r border-slate-100 font-mono">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="p-2.5 font-bold text-indigo-700 border-r border-slate-100 whitespace-nowrap font-mono">
                            {log.user_id}
                          </td>
                          <td className="p-2.5 border-r border-slate-100 font-mono">
                            <div className="flex flex-wrap gap-1">
                              {log.row_ids && log.row_ids.length > 0 ? (
                                log.row_ids.map((id: string) => (
                                  <span key={id} className="bg-rose-50 text-rose-700 border border-rose-200 text-[8px] font-black px-1.5 py-px rounded font-mono">
                                    {id}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[9px] text-slate-400 italic font-sans">(none)</span>
                              )}
                            </div>
                          </td>
                          <td className="p-2.5 font-sans text-slate-800 break-words">
                            {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details ?? '')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : logSubTab === "sync" ? (
          <>
            {/* stats strip sync */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-in">
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Matched Auto-Syncs</span>
                <span className="text-base font-black text-slate-800 font-mono mt-0.5 block">{syncLogsParsed.length} records</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Filtered View Volume</span>
                <span className="text-base font-black text-amber-600 font-mono mt-0.5 block">{filteredSyncLogs.length} matching</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-150 shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Unique Arrivals Linked</span>
                <span className="text-base font-black text-[#0d47a1] font-mono mt-0.5 block">
                  {new Set(syncLogsParsed.map(log => log.finalArrivalNo)).size} items
                </span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-150 shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider">Audit Traceability</span>
                <span className="text-[10px] font-black text-amber-600 font-mono mt-1.5 block uppercase">Diff Vectors Online</span>
              </div>
            </div>

            {/* Auto Sync Logs Table */}
            <div className="bg-white rounded-xl border border-slate-150 shadow-md overflow-hidden flex flex-col animate-fade-in">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead className="bg-slate-105 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider ">
                    <tr>
                      <th className="p-3 w-2/12 text-center">Timestamp</th>
                      <th className="p-3 w-3/12">Affected Record Targets</th>
                      <th className="p-3 w-5/12">Audit Trace Summary Narrative</th>
                      <th className="p-3 w-2/12 text-center">Trace Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-105 font-mono text-[10px] text-slate-707">
                    {filteredSyncLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-400 font-sans italic">
                          No automatic status synchronization logs found. Ensure background sync matches and saves correctly.
                        </td>
                      </tr>
                    ) : (
                      filteredSyncLogs.map((log) => (
                        <React.Fragment key={log.id}>
                          <tr className="hover:bg-slate-50/60 transition-colors font-semibold ">
                            <td className="p-2.5 text-center text-slate-450 whitespace-nowrap border-r border-slate-100 font-mono">
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td className="p-2.5 border-r border-slate-100 font-mono">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="bg-slate-100 text-slate-700 border border-slate-350 text-[9px] font-black px-1.5 py-0.5 rounded">
                                  FA #: {log.finalArrivalNo}
                                </span>
                                <span className="bg-amber-50 text-amber-800 border border-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded">
                                  MR: {log.mrNo}
                                </span>
                              </div>
                            </td>
                            <td className="p-2.5 font-sans text-slate-800 border-r border-slate-100 leading-normal">
                              Automatic matching linked pending arrival <strong className="text-indigo-650">#{log.finalArrivalNo}</strong> against finalized Quality inspection <strong className="text-emerald-700">MR: {log.mrNo}</strong>, synching all moisture, dust, and detention metrics.
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                onClick={() => setExpandedSyncRow(expandedSyncRow === log.id ? null : log.id)}
                                className="px-2.5 py-1 text-[8.5px] font-black uppercase tracking-wider rounded border border-amber-300 bg-amber-50 text-amber-805 hover:bg-amber-100 transition-colors cursor-pointer"
                              >
                                {expandedSyncRow === log.id ? "Close Diff" : "Inspect Diff"}
                              </button>
                            </td>
                          </tr>
                          
                          {/* Expanded Diff Vector visualization */}
                          {expandedSyncRow === log.id && (
                            <tr>
                              <td colSpan={4} className="p-3 bg-amber-50/30 border-t border-b border-amber-200">
                                <div className="font-sans text-xs space-y-3 p-2">
                                  <div className="flex items-center gap-1.5 border-b pb-1">
                                    <span className="text-amber-600 font-black text-xs">🔄</span>
                                    <h5 className="font-black text-amber-900 tracking-tight">
                                      Traceability Analysis (Quality State Vector Diffs)
                                    </h5>
                                  </div>
                                  
                                  {log.originalState && log.updatedState ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {/* Original State */}
                                      <div className="bg-slate-50 border border-slate-200 p-2.5 rounded shadow-sm">
                                        <div className="font-black uppercase tracking-wider text-[8.5px] text-slate-500 border-b pb-1 mb-2">
                                          🔴 PRE-SYNC VALUE STATES (PENDING VEHICLE)
                                        </div>
                                        <table className="w-full text-left text-xs font-mono">
                                          <tbody>
                                            <tr>
                                              <td className="py-0.5 text-[10px] text-slate-500 font-sans">Quality M.R. Link:</td>
                                              <td className="py-0.5 text-[10px] font-bold text-slate-800 italic">{log.originalState.mr_no}</td>
                                            </tr>
                                            <tr>
                                              <td className="py-0.5 text-[10px] text-slate-500 font-sans">PO Contract Link:</td>
                                              <td className="py-0.5 text-[10px] font-bold text-slate-800 italic">{log.originalState.po_no}</td>
                                            </tr>
                                            <tr>
                                              <td className="py-0.5 text-[10px] text-slate-500 font-sans">Actual Moisture %:</td>
                                              <td className="py-0.5 text-[10px] font-bold text-slate-800">{log.originalState.actual_moisture}%</td>
                                            </tr>
                                            <tr>
                                              <td className="py-0.5 text-[10px] text-slate-500 font-sans">Actual Dust Allowance:</td>
                                              <td className="py-0.5 text-[10px] font-bold text-slate-800">{log.originalState.actual_dust}%</td>
                                            </tr>
                                            <tr>
                                              <td className="py-0.5 text-[10px] text-slate-500 font-sans">Net Calorific Value:</td>
                                              <td className="py-0.5 text-[10px] font-bold text-slate-800">{log.originalState.actual_ncv}</td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>

                                      {/* Synched State */}
                                      <div className="bg-emerald-50/50 border border-emerald-250 p-2.5 rounded shadow-sm">
                                        <div className="font-black uppercase tracking-wider text-[8.5px] text-emerald-700 border-b border-emerald-100 pb-1 mb-2 flex items-center justify-between">
                                          <span>🟢 POST-SYNC VALUE STATES (VERIFIED DATA)</span>
                                          <span className="bg-emerald-100 text-emerald-805 text-[7.5px] font-sans px-1 py-0.2 rounded font-black uppercase">DAEMON APPLIED</span>
                                        </div>
                                        <table className="w-full text-left text-xs font-mono">
                                          <tbody>
                                            <tr>
                                              <td className="py-0.5 text-[10px] text-emerald-700 font-sans font-bold">Quality M.R. Link:</td>
                                              <td className="py-0.5 text-[10px] font-black text-emerald-900 bg-emerald-100/60 px-1 rounded">{log.updatedState.mr_no}</td>
                                            </tr>
                                            <tr>
                                              <td className="py-0.5 text-[10px] text-emerald-805 font-sans">PO Contract Link:</td>
                                              <td className="py-0.5 text-[10px] font-bold text-emerald-950 font-black">{log.updatedState.po_no}</td>
                                            </tr>
                                            <tr>
                                              <td className="py-0.5 text-[10px] text-emerald-850 font-sans">Actual Moisture %:</td>
                                              <td className={cn("py-0.5 text-[10px] font-bold text-emerald-950", log.updatedState.actual_moisture !== log.originalState.actual_moisture && "text-emerald-700 font-extrabold")}>
                                                {log.updatedState.actual_moisture}% {log.updatedState.actual_moisture !== log.originalState.actual_moisture && "⬆️"}
                                              </td>
                                            </tr>
                                            <tr>
                                              <td className="py-0.5 text-[10px] text-emerald-850 font-sans">Actual Dust Allowance:</td>
                                              <td className={cn("py-0.5 text-[10px] font-bold text-emerald-950", log.updatedState.actual_dust !== log.originalState.actual_dust && "text-emerald-700 font-extrabold")}>
                                                {log.updatedState.actual_dust}% {log.updatedState.actual_dust !== log.originalState.actual_dust && "⬆️"}
                                              </td>
                                            </tr>
                                            <tr>
                                              <td className="py-0.5 text-[10px] text-emerald-850 font-sans">Net Calorific Value:</td>
                                              <td className={cn("py-0.5 text-[10px] font-bold text-emerald-950", log.updatedState.actual_ncv !== log.originalState.actual_ncv && "text-emerald-700 font-extrabold")}>
                                                {log.updatedState.actual_ncv} {log.updatedState.actual_ncv !== log.originalState.actual_ncv && "⬆️"}
                                              </td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="bg-white border border-slate-200 p-2 text-[10px] text-slate-500 italic rounded">
                                      Raw transaction query log reference: {log.rawDetails}
                                    </div>
                                  )}
                                  
                                  <div className="text-[8.5px] text-slate-400 text-right">
                                    Operator Trace ID: {log.user_id || "SYSTEM_DAEMON"} | ID: {log.id}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* stats strip queue */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-sans animate-fade-in">
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider font-sans">Active Queue Items</span>
                <span className="text-base font-black text-[#0d47a1] font-mono mt-0.5 block">{printQueue.length} documents</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider font-sans">Offline Slips</span>
                <span className="text-base font-black text-amber-600 font-mono mt-0.5 block">
                  {printQueue.filter(q => q.payload?.offline).length} items
                </span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-150 shadow-xs">
                <span className="text-[9px] font-black uppercase text-slate-400 block tracking-wider font-sans">Queue Integrity</span>
                <span className="text-xs font-black text-emerald-600 block mt-1.5 uppercase font-mono">100% SECURE</span>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-150 shadow-xs animate-fade-in">
                <button
                  onClick={() => {
                    if (confirm("Are you sure you want to completely clear the document print queue?")) {
                      savePrintQueueObj([]);
                    }
                  }}
                  disabled={printQueue.length === 0}
                  className="w-full text-center bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-[10px] py-1.5 rounded-lg transition-all border border-rose-200 cursor-pointer uppercase tracking-wider"
                >
                  Purge Entire Queue
                </button>
              </div>
            </div>

            {queueError && (
              <div className="bg-rose-50 border border-rose-150 text-rose-700 px-4 py-2.5 text-xs font-bold rounded-lg uppercase tracking-wide my-2">
                ⚠️ {queueError}
              </div>
            )}

            {/* Print Queue Table */}
            <div className="bg-white rounded-xl border border-slate-150 shadow-md overflow-hidden flex flex-col font-sans animate-fade-in">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider ">
                    <tr>
                      <th className="p-3 w-2/12 text-center font-bold">Queued Time</th>
                      <th className="p-3 w-2/12 font-bold">Module Category</th>
                      <th className="p-3 w-6/12 font-bold font-sans">Document Title & Summary Facts</th>
                      <th className="p-3 w-2/12 text-center font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-105 font-mono text-[10px] text-slate-700 font-semibold">
                    {printQueue.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-slate-400 font-sans italic animate-fade-in">
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <span className="text-xl">📋</span>
                            <p className="font-extrabold text-sm text-slate-500">The Print Queue is currently empty</p>
                            <p className="text-xs text-slate-400 leading-normal max-w-sm mx-auto">
                              Add documents above, or print items anywhere in active modules to queue them automagically.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      printQueue.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/60 font-semibold transition-colors">
                          <td className="p-3 text-center text-slate-450 border-r border-slate-100 font-mono">
                            {new Date(item.timestamp).toLocaleString()}
                          </td>
                          <td className="p-3 border-r border-slate-100 font-mono">
                            <span className="px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-wider  bg-indigo-50 text-indigo-700 border-indigo-200">
                              {item.module.replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="p-3 font-sans text-slate-805 text-slate-800 border-r border-slate-100 font-sans">
                            <div className="font-extrabold text-slate-900 text-xs mb-0.5">{item.title}</div>
                            <div className="text-slate-500 font-mono text-[10px] break-all">{item.summary}</div>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-2 font-sans">
                              <button
                                onClick={() => setPrintingItem(item)}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-[9px] px-2.5 py-1.5 rounded-lg border border-indigo-200 cursor-pointer transition-colors uppercase tracking-wider whitespace-nowrap"
                              >
                                🖨️ Reprint
                              </button>
                              <button
                                onClick={() => {
                                  const filtered = printQueue.filter((q) => q.id !== item.id);
                                  savePrintQueueObj(filtered);
                                }}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-[9px] px-2.5 py-1.5 rounded-lg border border-rose-200 cursor-pointer transition-colors uppercase tracking-wider whitespace-nowrap"
                              >
                                🗑️ Clear
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // RENDER DYNAMIC THEMES:
  // OPTION A: REACT MATERIAL ADMIN FULL (DEFAULT & REQUESTED GORGEOUS SIDEBAR TYPE)
  if (useMaterialTheme) {
    return (
      <div className="h-screen w-full flex flex-col bg-[#f5f7fb] font-sans text-slate-800 overflow-hidden relative selection:bg-pink-100">
        
        {/* Pink Modern Material Header Bar */}
        <header className="h-14 bg-[#ec407a] text-white px-4 flex items-center justify-between shadow-md shrink-0 z-50">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-full transition-all flex items-center justify-center text-white"
              title="Return to Operational Hub"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold tracking-wide uppercase font-display ">
                React Material Admin Full
              </span>
              <span className="hidden md:inline-block bg-white/20 text-[8px] font-black px-2 py-0.5 rounded tracking-widest">
                AUTOMATED CONSOLE
              </span>
            </div>
          </div>

          {/* Right hand layout icons matching screenshot */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-white/10 border border-white/5 rounded-full px-3 py-1 text-xs">
              <Search className="h-4 w-4 text-white/70" />
              <input
 id="search_console_2388" name="search_console" aria-label="Search console..."                className="bg-transparent border-none outline-none text-white text-xs placeholder:text-white/40 max-w-[120px]"
                placeholder="Search console..."
              />
            </div>

            <button className="relative p-1.5 hover:bg-white/10 rounded-full transition-all">
              <Bell className="h-5 w-5" />
              <span className="absolute top-0 right-0 h-4 w-4 bg-amber-500 text-white font-black text-[8px] rounded-full flex items-center justify-center border border-[#ec407a]">
                4
              </span>
            </button>

            <button className="relative p-1.5 hover:bg-white/10 rounded-full transition-all">
              <Mail className="h-5 w-5" />
              <span className="absolute top-0 right-0 h-4 w-4 bg-[#3f51b5] text-white font-black text-[8px] rounded-full flex items-center justify-center border border-[#ec407a]">
                4
              </span>
            </button>

            <div className="h-6 w-px bg-white/15" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-900 border-2 border-white/20 overflow-hidden flex items-center justify-center shrink-0">
                <img
                  src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=120&auto=format&fit=crop"
                  referrerPolicy="no-referrer"
                  alt="Robert profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xs font-bold hidden sm:inline ">Hi, Robert Cotton</span>
            </div>
          </div>
        </header>

        {/* Master Body section with Sidebar + Dynamic View Container */}
        <div className="flex-1 flex min-h-0 min-w-0">
          
          {/* Left Navigation Sidebar designed with precise modern Material layouts */}
          <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 overflow-y-auto overflow-x-auto h-full max-h-full py-4 sidebar">
            <div className="space-y-6">
              
              {/* Category Group 1 */}
              <div className="space-y-1 px-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block px-3 mb-2">Main Components</span>
                <button
                  onClick={() => setActiveMaterialPage("dashboard")}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2.5 rounded-lg text-xs font-black transition-all uppercase ${
                    activeMaterialPage === "dashboard"
                      ? "bg-pink-50 text-pink-600 font-extrabold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Monitor className="h-4 w-4" />
                  <span>Dashboard Hub</span>
                </button>
                <button
                  onClick={() => setActiveMaterialPage("e_commerce")}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2.5 rounded-lg text-xs font-black transition-all uppercase ${
                    activeMaterialPage === "e_commerce"
                      ? "bg-pink-50 text-pink-600 font-extrabold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Briefcase className="h-4 w-4" />
                  <span>E-Commerce Log</span>
                </button>
                <button
                  onClick={() => setActiveMaterialPage("documentation")}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2.5 rounded-lg text-xs font-black transition-all uppercase ${
                    activeMaterialPage === "documentation"
                      ? "bg-pink-50 text-pink-600 font-extrabold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>Documentation</span>
                </button>
              </div>

              {/* Category Group 2 */}
              <div className="space-y-1 px-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block px-3 mb-2">Visual Template</span>
                
                <button
                  onClick={() => setActiveMaterialPage("ui_elements")}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2.5 rounded-lg text-xs font-black transition-all uppercase ${
                    activeMaterialPage === "ui_elements"
                      ? "bg-pink-50 text-pink-600 font-extrabold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span>UI Elements Play</span>
                </button>

                <button
                  onClick={() => setActiveMaterialPage("forms")}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2.5 rounded-lg text-xs font-black transition-all uppercase ${
                    activeMaterialPage === "forms"
                      ? "bg-pink-50 text-pink-600 font-extrabold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  <span>Forms & Checks</span>
                </button>

                <button
                  onClick={() => setActiveMaterialPage("extra_pages")}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2.5 rounded-lg text-xs font-black transition-all uppercase ${
                    activeMaterialPage === "extra_pages"
                      ? "bg-pink-50 text-pink-600 font-extrabold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Archive className="h-4 w-4" />
                  <span>Extra Pages</span>
                </button>
              </div>

              {/* System Admin utilities section */}
              <div className="space-y-1 px-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block px-3 mb-2">Database Admin</span>
                <button
                  onClick={() => setActiveMaterialPage("db_console")}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2.5 rounded-lg text-xs font-black transition-all uppercase ${
                    activeMaterialPage === "db_console"
                      ? "bg-pink-50 text-pink-600 font-extrabold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Database className="h-4 w-4" />
                  <span>Table Manager</span>
                </button>
                <button
                  onClick={() => setActiveMaterialPage("event_log")}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2.5 rounded-lg text-xs font-black transition-all uppercase ${
                    activeMaterialPage === "event_log"
                      ? "bg-pink-50 text-pink-600 font-extrabold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Terminal className="h-4 w-4" />
                  <span>System Event Log</span>
                </button>
              </div>

              {/* System Admin shortcuts section */}
              <div className="space-y-1 px-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-[#ec407a] block px-3 mb-2">Operational Apps</span>
                <button
                  onClick={() => onNavigate?.("settings")}
                  className="w-full text-left px-3 py-2 flex items-center gap-2.5 rounded-lg text-xs font-black transition-all uppercase text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                >
                  <Settings className="h-4 w-4 text-slate-400" />
                  <span>Config Center</span>
                </button>
                <button
                  onClick={() => onNavigate?.("ai_assistant")}
                  className="w-full text-left px-3 py-2 flex items-center gap-2.5 rounded-lg text-xs font-black transition-all uppercase text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                >
                  <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                  <span>Jarves AI 2.0</span>
                </button>
              </div>

            </div>

            {/* Sidebar bottom indicator */}
            <div className="px-5 border-t border-slate-100 pt-4 pb-2">
              <div className="text-[8px] font-black uppercase text-slate-300 text-center tracking-[0.2em]">
                STATION OVERRIDE ACTIVE
              </div>
            </div>
          </aside>

          {/* Right Side Main Area Container */}
          <main className="flex-1 bg-slate-50/50 p-4 sm:p-6 overflow-y-auto overflow-x-auto min-w-0 min-h-0 main-content">
            {activeMaterialPage === "dashboard" && (
              <DashboardTab dbStats={{ poCount: data.length || 118, saudaCount: 42, activeUsers: 5 }} />
            )}

            {activeMaterialPage === "e_commerce" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Operational Jute Commerce Ledger</h3>
                    <p className="text-xs text-slate-400 mt-1">Real-time ledger entries derived directly from purchase_master database</p>
                  </div>
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase rounded-full">
                    ● ACTIVE STREAM
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-slate-100 shadow-md overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-black uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3">PO Reference</th>
                        <th className="p-3">Supplier Name</th>
                        <th className="p-3">Broker Code</th>
                        <th className="p-3">Volume Area</th>
                        <th className="p-3 text-right">Total Contract MT</th>
                        <th className="p-3 text-right">Valuation Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold font-mono text-[10px] text-slate-700">
                      {purchaseOrders?.slice(0, 15).map((po: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-5 w-full hover:bg-slate-50/60 font-semibold">
                          <td className="p-3 text-indigo-700 font-extrabold">{po.po_no}</td>
                          <td className="p-3 uppercase font-sans font-bold">{po.supplier || "VARIOUS SUPPLIER"}</td>
                          <td className="p-3 uppercase font-sans font-bold">{po.broker}</td>
                          <td className="p-3 uppercase font-sans">{po.area}</td>
                          <td className="p-3 text-right">{po.total_contract_mt} MT</td>
                          <td className="p-3 text-right text-pink-600 font-extrabold font-mono">₹{(Number(po.b_rate) || 17200).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeMaterialPage === "documentation" && (
              <div className="max-w-2xl bg-white border border-slate-100 p-8 rounded-2xl shadow-sm space-y-6">
                <div className="space-y-2">
                  <span className="px-2.5 py-0.5 bg-pink-100 text-pink-800 text-[10px] font-black uppercase tracking-widest rounded-full">Guides Center</span>
                  <h3 className="text-xl font-bold tracking-tight text-[#1a237e]">PO-Automation Enterprise Module Pipeline</h3>
                </div>
                <hr className="border-slate-100" />
                <div className="space-y-4 text-xs text-slate-600 leading-relaxed font-semibold">
                  <p>
                    Welcome to the central documentation module. The Jute Mill automation pipeline coordinate transactional workflows in accordance with standard mill regulatory directives:
                  </p>
                  <ul className="list-decimal pl-5 space-y-2">
                    <li>
                      <strong>Sauda Registrations:</strong> Standard pre-arranged commercial bookings with verified Raw Jute brokers mapping regional target rates.
                    </li>
                    <li>
                      <strong>Purchase Orders allocation:</strong> Automatic distribution of deliveries tied directly to active Saudas.
                    </li>
                    <li>
                      <strong>Physical Scales Recording (AMAD):</strong> Direct entry of trucklorry shipment weighments at Bored road transit warehouses.
                    </li>
                    <li>
                      <strong>Quality inspection audits:</strong> Mandatory testing of incoming fiber moisture ratings that locks release values on the system account ledgers.
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {activeMaterialPage === "ui_elements" && <UIElementsTab />}

            {activeMaterialPage === "forms" && <FormsChartsTab />}

            {activeMaterialPage === "extra_pages" && <ExtraPagesTab purchaseOrders={purchaseOrders} />}

            {activeMaterialPage === "db_console" && (
              <DatabaseTab
                tables={tables}
                selectedTable={selectedTable ?? tables[0]}
                setSelectedTable={setSelectedTable}
                data={data}
                loading={loading}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                setEditingRow={setEditingRow}
                activeSchemaTab={activeSchemaTab}
                setActiveSchemaTab={setActiveSchemaTab}
                sqlQuery={sqlQuery}
                setSqlQuery={setSqlQuery}
                sqlResult={sqlResult}
                sqlExecuting={sqlExecuting}
                runSqlQuery={runSqlQuery}
                currentColumns={currentColumns}
                handleDelete={handleDelete}
                handleDeleteColumn={handleDeleteColumn}
                newFieldName={newFieldName}
                setNewFieldName={setNewFieldName}
                newFieldType={newFieldType}
                setNewFieldType={setNewFieldType}
                handleAddField={handleAddField}
                newTableName={newTableName}
                setNewTableName={setNewTableName}
                handleCreateTable={handleCreateTable}
                initializeDatabase={initializeDatabase}
                confirmDeleteTable={confirmDeleteTable}
                setConfirmDeleteTable={setConfirmDeleteTable}
                handleDropTable={handleDropTable}
                handleCsvImport={handleCsvImport}
                onDatabaseExport={handleDatabaseExport}
                isExporting={isExporting}
              />
            )}

            {activeMaterialPage === "email_activity" && <EmailActivityTab />}
            {activeMaterialPage === "smtp_diagnostic" && <SMTPDiagnosticTab />}

            {activeMaterialPage === "event_log" && (
              <div className="flex-1 overflow-y-auto p-6">
                {renderSystemLogs()}
              </div>
            )}
          </main>
        </div>

        {/* Row inline Dialog Modal drawer */}
        {editingRow && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
              <div className="bg-[#ec407a] p-4 text-white flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Edit className="h-4 w-4" />
                  Editor: {selectedTable?.label || "Row Update"}
                </span>
                <button onClick={() => setEditingRow(null)}>
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {editorColumns.map((col) => (
                    <div key={col} className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">
                        {col.replace(/_/g, " ")}
                      </label>
                      {renderEditField(col)}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 text-xs font-bold">
                <button
                  onClick={() => setEditingRow(null)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 font-bold uppercase rounded-lg text-[10px] tracking-wider hover:bg-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-pink-600 text-white font-black uppercase rounded-lg text-[10px] tracking-wider hover:bg-pink-700"
                >
                  Save Record Value
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // OPTION B: ORIGINAL CLASSIC RETRO G01 DATABASE SYSTEM PANEL (SKINNED ACCORDING TO SAVED localStorage)
  return (
    <LegacyLayout
      title="P.O Automation - Vintage Master Desk"
      subtitle="Administrative Schema Control Panel"
      onClose={onClose}
    >
      <div className="grid grid-cols-12 gap-4 h-full min-h-0">
        
        {/* Left Column table choices */}
        <div className="col-span-3 bg-[#c0c0c0] border border-black/20 overflow-y-auto pixel-scroll shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)] flex flex-col">
          <div className="bg-[#000080] text-white px-2 py-1 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <Database className="h-3 w-3" />
              <span className="text-[10px] font-black uppercase italic tracking-widest">
                Master Tables list
              </span>
            </div>
            <button onClick={fetchTables}>
              <Plus className="h-3 w-3 rotate-45" />
            </button>
          </div>

          <div className="flex-1 p-1 space-y-1 overflow-y-auto">
            {tables.map((table) => (
              <div key={table.name} className="w-full relative group/item">
                <div className="w-full flex items-center justify-between">
                  <button
                    onClick={() => { setSelectedTable(table); setActiveSchemaTab("row"); }}
                    className={`flex-1 text-left px-2 py-1.5 flex items-center gap-2 border ${
                      selectedTable?.name === table.name
                        ? "bg-indigo-900 text-white border-black shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3)]"
                        : "hover:bg-white border-transparent"
                    }`}
                  >
                    {React.createElement(table.icon || Database, { className: "h-3 w-3" })}
                    <span className="text-[11px] font-bold uppercase truncate">{table.label}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Drop ${table.name}?`)) handleDropTable(table.name);
                    }}
                    className="p-1 text-red-600 hover:bg-slate-200 hidden group-hover/item:block absolute right-1 bg-white border rounded"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Quick theme toggler */}
          <div className="p-2 border-t border-black/10 bg-slate-200 text-center">
            <span className="text-[8px] font-black uppercase text-slate-400 block mb-1.5">Classic UI Panel Mode</span>
            <button
              onClick={() => setUseMaterialTheme(true)}
              className="w-full bg-[#000080] hover:bg-black text-white text-[9px] font-black uppercase tracking-wider py-1 rounded"
            >
              🎨 Switch Material Desk
            </button>
          </div>
        </div>

        {/* Dynamic content tab grids */}
        <div className="col-span-9 space-y-4 flex flex-col overflow-hidden">
          <div className="flex gap-1">
            {(["row", "column", "sql", "event_log", "reconciliation_log"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSchemaTab(tab)}
                className={`px-4 py-1.5 text-[10px] font-black uppercase italic tracking-widest border-t-2 border-x border-black/10 transition-all ${
                  activeSchemaTab === tab
                    ? "bg-white border-t-indigo-600 shadow-sm"
                    : "bg-slate-300 opacity-60"
                }`}
              >
                {tab === "row" && "Rows view"}
                {tab === "column" && "Columns structure"}
                {tab === "sql" && "SQL command shell"}
                {tab === "event_log" && "System event log"}
                {tab === "reconciliation_log" && "Weight Reconciliation Log"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-auto bg-white border border-black/10 p-4 space-y-4">
            
            {/* Archive Management & Admin Apps Section */}
            <div className="border border-dashed border-indigo-400 p-2.5 text-xs bg-slate-50 relative rounded">
              <span className="absolute -top-2.5 left-2 bg-white px-2 text-[9px] font-black uppercase text-[#000080] tracking-wider">
                Archive Management & System Launchers
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2 pt-1.5">
                 {/* Create Card */}
                 <button
                   onClick={() => {
                     setActiveSchemaTab("row");
                     const targetTbl = tables[0];
                     if (targetTbl) setSelectedTable(targetTbl);
                   }}
                   className="bg-amber-50 border-2 border-amber-300 hover:border-amber-800 active:translate-x-[0.5px] active:translate-y-[0.5px] p-2 text-left shadow-[1px_1px_0_0_rgba(0,0,0,0.85)] flex items-center gap-2 w-full cursor-pointer group"
                 >
                   <div className="p-1 px-1.5 bg-amber-600 text-white shrink-0 group-hover:bg-amber-700">
                     <Plus className="h-4 w-4" />
                   </div>
                   <div className="overflow-hidden">
                     <p className="text-[10px] font-black uppercase tracking-wider text-amber-950 truncate">Create</p>
                     <p className="text-[8px] text-amber-700 font-bold uppercase tracking-tight truncate">New Table / Schema</p>
                   </div>
                 </button>



                 <button
                   onClick={() => onNavigate?.("settings")}
                   className="bg-[#d4d0c8] border-2 border-white hover:border-black active:translate-x-[0.5px] active:translate-y-[0.5px] p-2 text-left shadow-[1px_1px_0_0_rgba(0,0,0,0.85)] flex items-center gap-2 w-full cursor-pointer"
                 >
                   <div className="p-1 px-1.5 bg-[#000080] text-white shrink-0">
                     <Settings className="h-4 w-4" />
                   </div>
                   <div className="overflow-hidden">
                     <p className="text-[10px] font-black uppercase tracking-wider text-black truncate">Config Center</p>
                     <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tight truncate">System Config</p>
                   </div>
                 </button>

                 <button
                   onClick={() => onNavigate?.("ai_assistant")}
                   className="bg-[#d4d0c8] border-2 border-white hover:border-black active:translate-x-[0.5px] active:translate-y-[0.5px] p-2 text-left shadow-[1px_1px_0_0_rgba(0,0,0,0.85)] flex items-center gap-2 w-full cursor-pointer"
                 >
                   <div className="p-1 px-1.5 bg-amber-500 text-white animate-pulse shrink-0">
                     <Sparkles className="h-4 w-4" />
                   </div>
                   <div className="overflow-hidden">
                     <p className="text-[10px] font-black uppercase tracking-wider text-black truncate">Jarves AI 2.0</p>
                     <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tight truncate">Smart AI Bot</p>
                   </div>
                 </button>

                 <button
                   onClick={handleDatabaseExport}
                   disabled={isExporting}
                   className="bg-[#d4d0c8] border-2 border-white hover:border-black active:translate-x-[0.5px] active:translate-y-[0.5px] p-2 text-left shadow-[1px_1px_0_0_rgba(0,0,0,0.85)] flex items-center gap-2 w-full cursor-pointer"
                 >
                   <div className="p-1 px-1.5 bg-purple-700 text-white hover:bg-purple-800 shrink-0">
                     <Download className="h-4 w-4" />
                   </div>
                   <div className="overflow-hidden">
                     <p className="text-[10px] font-black uppercase tracking-wider text-black truncate">
                       {isExporting ? "EXPORTING..." : "DB EXPORT"}
                     </p>
                     <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tight truncate">Offline JSON</p>
                   </div>
                 </button>
              </div>
            </div>

            {/* Admin Stats Panel at the top of Schema desk */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
               <div className="bg-[#d4d0c8] border border-white border-b-gray-600 border-r-gray-600 p-2 shadow-sm flex flex-col justify-center">
                  <p className="text-[9px] font-black uppercase text-gray-500 leading-none mb-1">Database Schema Tables</p>
                  <p className="text-base font-mono font-black text-indigo-900">{tables.length} Registered</p>
               </div>
               <div className="bg-[#d4d0c8] border border-white border-b-gray-600 border-r-gray-600 p-2 shadow-sm flex flex-col justify-center">
                  <p className="text-[9px] font-black uppercase text-gray-500 leading-none mb-1">Telemetry Event Log Stream</p>
                  <p className="text-base font-mono font-black text-emerald-800">{(systemLogs && systemLogs.length) || 104} Triggers</p>
               </div>
               <div className="bg-[#d4d0c8] border border-white border-b-gray-600 border-r-gray-600 p-2 shadow-sm flex flex-col justify-center">
                  <p className="text-[9px] font-black uppercase text-gray-500 leading-none mb-1">Table Loaded Records</p>
                  <p className="text-base font-mono font-black text-rose-800">{selectedTable ? `${data.length} rows` : "No table selected"}</p>
               </div>
            </div>

            {activeSchemaTab === "row" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-slate-100 p-2 border border-slate-200">
                  <span className="text-xs font-bold uppercase">Dynamic records viewer</span>
                  <button
                    onClick={() => { setEditingRow({}); setIsNewRow(true); }}
                    className="bg-indigo-900 text-white font-black text-[9px] uppercase px-4 py-1 border border-black/10 cursor-pointer"
                  >
                    New Row Item
                  </button>
                </div>

                <div className="overflow-auto border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs ">
                    <thead className="bg-[#000080] text-white font-extrabold uppercase text-[9px]">
                      <tr>
                        <th className="p-2 border-r border-[#ffffff20] text-center w-[110px]">Actions</th>
                        {currentColumns.map((c) => {
                          let label = c.name;
                          if (selectedTable?.name === "user_master") {
                            if (c.name === "password_hash" || c.name === "password") label = "PASSWORD";
                            else if (c.name === "user_id") label = "USER ID";
                            else if (c.name === "is_active" || c.name === "status") label = "STATUS";
                            else if (c.name === "created_at") label = "CREATED_AT";
                          }
                          return (
                            <th key={c.name} className="p-2 uppercase border-r border-[#ffffff20]">
                              {label}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-[9px]">
                      {data.map((row, i) => (
                        <tr 
                          key={i} 
                          title="Click row to directly edit record details"
                          className="hover:bg-indigo-50 border-b border-slate-200 cursor-pointer transition-colors"
                          onClick={() => { setEditingRow(row); setIsNewRow(false); }}
                        >
                          <td className="p-1.5 flex gap-2 justify-center items-center" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => { setEditingRow(row); setIsNewRow(false); }} className="text-indigo-700 hover:text-indigo-900 font-black cursor-pointer bg-slate-100 hover:bg-slate-200 px-1 py-0.5 rounded border border-slate-250">
                              [Edit]
                            </button>
                            <button onClick={() => handleDelete(row[selectedTable?.pk || "id"])} className="text-rose-600 hover:text-rose-800 font-black cursor-pointer bg-slate-100 hover:bg-slate-200 px-1 py-0.5 rounded border border-slate-250">
                              [Del]
                            </button>
                          </td>
                          {currentColumns.map((c) => {
                            let cellVal = row[c.name];
                            let displayVal = cellVal !== null ? String(cellVal) : "NULL";

                            if (selectedTable?.name === "user_master") {
                              if (c.name === "is_active" || c.name.toLowerCase() === "is_active" || c.name === "status") {
                                const activeVal = String(cellVal).toLowerCase() === "true" || cellVal === "1" || cellVal === 1 || cellVal === "active" || cellVal === "Active" || cellVal === true;
                                displayVal = activeVal ? "Active" : "Inactive";
                              }
                            }

                            return (
                              <td key={c.name} className="p-2 truncate max-w-[150px] border-r border-slate-200 text-slate-800">
                                {displayVal}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeSchemaTab === "column" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase">Field structure catalog</span>
                    <div className="border border-slate-200 divide-y divide-slate-100 p-2 bg-slate-50">
                      {currentColumns.map((c) => (
                        <div key={c.name} className="py-2 flex justify-between items-center text-xs">
                          <span className="font-mono font-bold">{c.name} ({c.type})</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-100 border border-slate-200 space-y-4">
                    <span className="text-[10px] font-black uppercase block">Add Column Field</span>
                    <input
 id="e_g_tracking_id_3041" name="e_g_tracking_id" aria-label="e.g. tracking_id"                      className="w-full bg-white border border-slate-350 p-2 text-xs font-bold font-mono outline-none uppercase"
                      placeholder="e.g. tracking_id"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                    />
                    <button
                      onClick={handleAddField}
                      className="w-full py-2 bg-indigo-950 text-white font-black uppercase text-[10px]"
                    >
                      Deploy Field Column
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSchemaTab === "sql" && (
              <div className="space-y-4">
                <textarea
 id="enter_sql_command_here_3060" name="enter_sql_command_here" aria-label="-- ENTER SQL COMMAND HERE..."                  className="w-full h-40 bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded"
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  placeholder="-- ENTER SQL COMMAND HERE..."
                />
                <button
                  onClick={runSqlQuery}
                  className="px-6 py-2 bg-[#000080] text-white font-black text-xs uppercase"
                >
                  Execute SQL Statement
                </button>
                {sqlResult && (
                  <pre className="bg-slate-50 border p-3 rounded text-[10px] font-mono whitespace-pre max-h-[150px] overflow-auto">
                    {JSON.stringify(sqlResult, null, 2)}
                  </pre>
                )}
              </div>
            )}

            {activeSchemaTab === "event_log" && (
              <div className="h-full overflow-y-auto">
                {renderSystemLogs()}
              </div>
            )}

            {activeSchemaTab === "reconciliation_log" && (
              <div className="space-y-4 font-sans text-xs">
                <div className="bg-slate-100 p-3 border border-black/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                  <div>
                    <h3 className="font-black text-[12px] uppercase text-[#000080]">Weight Deduction Reconciliations</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase italic mt-0.5">Audit-trace math breakdown of gross vs net weights with DAISEE limits.</p>
                  </div>
                  <button
                    onClick={async () => {
                      setReconLoading(true);
                      try {
                        if (supabase) {
                          const { data, error } = await supabase.from('final_arrival').select('*').order('date', { ascending: false });
                          if (!error && data) setReconRecords(data);
                        }
                      } catch (e) {}
                      setReconLoading(false);
                    }}
                    className="p-1 px-3.5 bg-[#000080] text-white font-black uppercase text-[10px]"
                  >
                    Refresh Logs
                  </button>
                </div>

                <div className="grid grid-cols-12 gap-4">
                  {/* Left: selectable records list */}
                  <div className="col-span-12 md:col-span-4 flex flex-col space-y-1.5">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Select Final Arrival Slip</span>
                    <div className="bg-white border border-gray-400 p-1.5 max-h-[380px] overflow-y-auto divide-y divide-gray-200">
                      {reconRecords.map((r, i) => {
                        const isSel = r.final_arrival_id === selectedReconId;
                        return (
                          <div
                            key={r.final_arrival_id || i}
                            onClick={() => setSelectedReconId(r.final_arrival_id)}
                            className={`p-2.5 cursor-pointer text-left transition-colors ${
                              isSel ? 'bg-[#000080] text-white font-black' : 'hover:bg-slate-100'
                            }`}
                          >
                            <p className="font-mono text-[10.5px] font-black">FA-#{r.final_arrival_no || r.final_arrival_id}</p>
                            <p className="text-[9.5px] font-semibold truncate mt-0.5 opacity-80 uppercase">{r.supplier || 'DIRECT SUPPLIER'}</p>
                            <div className="flex justify-between items-center text-[8.5px] mt-1.5 opacity-60">
                              <span>Lorry: {r.lorry_number || '--'}</span>
                              <span>{r.date ? new Date(r.date).toLocaleDateString('en-GB') : '--'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right: Specific Math Breakdown card */}
                  <div className="col-span-12 md:col-span-8">
                    {(() => {
                      const selRec = reconRecords.find(r => r.final_arrival_id === selectedReconId);
                      if (!selRec) {
                        return (
                          <div className="bg-slate-50/50 border border-slate-350 p-8 text-center uppercase text-slate-400 italic">
                            No final arrival record selected for mathematical Audit.
                          </div>
                        );
                      }

                      // Math parameters extraction
                      const grossRaw = Number(selRec.weight_qtl || 0) / 10;
                      let moisture = 16;
                      let dust = 0;
                      let ncv = 0;
                      if (selRec.grid_details) {
                        try {
                          const parsed = typeof selRec.grid_details === 'string' ? (selRec.grid_details === 'undefined' || selRec.grid_details === 'null' ? [] : JSON.parse(selRec.grid_details === "undefined" ? "null" : selRec.grid_details)) : selRec.grid_details;
                          if (Array.isArray(parsed) && parsed.length > 0) {
                            moisture = Number(parsed[0].moisture_pct || parsed[0].moisture || parsed[0].actual_moisture || 16);
                            dust = Number(parsed[0].dust_pct || parsed[0].dust || parsed[0].actual_dust || 0);
                            ncv = Number(parsed[0].ncv_pct || parsed[0].ncv || parsed[0].actual_ncv || 0);
                          }
                        } catch (e) {}
                      } else {
                        moisture = Number(selRec.actual_moisture || 16);
                        dust = Number(selRec.actual_dust || 0);
                        ncv = Number(selRec.actual_ncv || 0);
                      }

                      const area = String(selRec.arrival_area_name || '').toLowerCase();
                      const isDaisee = area.includes("daisee");
                      let month = 0;
                      if (selRec.po_date || selRec.date) {
                        const d = new Date(selRec.po_date || selRec.date);
                        if (!isNaN(d.getTime())) {
                          month = d.getMonth();
                        }
                      }
                      const isJanToJune = month >= 0 && month <= 5;

                      let moistureLimit = 16;
                      if (isJanToJune) {
                        moistureLimit = isDaisee ? 18 : 16;
                      } else {
                        moistureLimit = isDaisee ? 20 : 18;
                      }

                      const moistureExcess = moisture > moistureLimit ? (moisture - moistureLimit) : 0;
                      const totalDeductions = moistureExcess + dust + ncv;
                      const reconciledNet = grossRaw * (1 - totalDeductions / 100);
                      const weighedNet = Number(selRec.electronic_net_weight || selRec.supplier_net_weight || grossRaw);
                      const totalDeductionWeight = grossRaw * (totalDeductions / 100);
                      const discrepancy = Math.abs(weighedNet - reconciledNet);

                      return (
                        <div className="bg-white border-2 border-slate-300 p-4 space-y-4 shadow-sm text-left">
                          <div className="border-b border-gray-200 pb-2 flex justify-between items-center bg-indigo-50/40 p-2 border">
                            <div>
                              <p className="text-[12px] font-black text-indigo-950 uppercase">Audit Sheet: Slip #{selRec.final_arrival_no}</p>
                              <p className="text-[9.5px] font-semibold text-slate-500 uppercase mt-0.5">Supplier: {selRec.supplier || 'DIRECT'}</p>
                            </div>
                            <span className="font-mono text-xs font-black bg-indigo-950 text-white rounded px-2.5 py-1 uppercase tracking-wide">
                              ID: {selRec.final_arrival_id.substring(0,6)}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                            <div className="bg-slate-50 border p-2 text-center rounded space-y-0.5">
                              <p className="text-[9px] font-bold text-slate-500 uppercase">Gross Weight</p>
                              <p className="text-[11.5px] font-black text-slate-800 font-mono">{grossRaw.toFixed(3)} MT</p>
                              <p className="text-[8px] text-slate-400 font-semibold italic uppercase">({selRec.weight_qtl || 0} QTL)</p>
                            </div>
                            <div className="bg-slate-50 border p-2 text-center rounded space-y-0.5">
                              <p className="text-[9px] font-bold text-slate-500 uppercase font-sans">Weighed Net (WB)</p>
                              <p className="text-[11.5px] font-black text-slate-800 font-mono">{weighedNet.toFixed(3)} MT</p>
                              <p className="text-[8px] text-slate-400 font-semibold italic uppercase">Certified Net</p>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 p-2 text-center rounded space-y-0.5">
                              <p className="text-[9px] font-bold text-blue-900 uppercase">Audit Match Net</p>
                              <p className="text-[11.5px] font-black text-blue-950 font-mono">{reconciledNet.toFixed(3)} MT</p>
                              <p className="text-[8px] text-blue-400 font-semibold italic uppercase">After Deductions</p>
                            </div>
                            <div className={`p-2 text-center rounded border space-y-0.5 ${discrepancy > 0.15 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-green-50 border-green-200 text-green-950'}`}>
                              <p className="text-[9px] font-bold uppercase">Discrepancy</p>
                              <p className="text-[11.5px] font-black font-mono">{discrepancy.toFixed(3)} MT</p>
                              <span className="text-[8.5px] uppercase font-bold tracking-tighter block leading-none">
                                {discrepancy > 0.15 ? '⚠️ Exceeds Limit' : '✓ Reconciled'}
                              </span>
                            </div>
                          </div>

                          {/* Mathematical Steps List */}
                          <div className="space-y-2 border border-slate-350 p-2.5 rounded bg-slate-50/50">
                            <h4 className="text-[10px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1">
                              <span>➕</span> Reconciliation Formula Flow & Seasonal Limits
                            </h4>

                            <div className="divide-y divide-dashed divide-gray-300 font-sans text-[10.5px] space-y-1 pt-1.5">
                              <div className="py-1 flex justify-between">
                                <span className="font-bold text-slate-600">1. Operating Area & DAISEE Status</span>
                                <span className="font-mono bg-white px-1.5 border uppercase font-extrabold text-slate-800">
                                  {selRec.arrival_area_name || "CENTRAL STATION"} &rarr; {isDaisee ? "DAISEE STATION [YES]" : "STANDARD STATION [NO]"}
                                </span>
                              </div>

                              <div className="py-1 flex justify-between">
                                <span className="font-bold text-slate-600">2. Arrival Season & Month Check</span>
                                <span className="font-mono bg-white px-1.5 border uppercase font-bold text-indigo-950">
                                  Month: {new Date(selRec.po_date || selRec.date || '2026-01-01').toLocaleString('default', { month: 'long' })} ({isJanToJune ? 'Jan-June Season' : 'July-Dec Season'})
                                </span>
                              </div>

                              <div className="py-1 flex justify-between">
                                <span className="font-bold text-slate-600">3. Moisture Permissible Allowance Limit</span>
                                <span className="font-mono bg-white px-1.5 border uppercase font-black text-amber-900">
                                  {moistureLimit}% Permissible Limit
                                </span>
                              </div>

                              <div className="py-1 flex justify-between">
                                <span className="font-bold text-slate-600">4. Recorded Moisture vs Limit Excess</span>
                                <span className="font-mono bg-white px-1.5 border font-semibold text-slate-800">
                                  Recorded: {moisture}% | Excess Offset: <span className="font-black text-red-600">{(moistureExcess).toFixed(2)}%</span>
                                </span>
                              </div>

                              <div className="py-1 flex justify-between">
                                <span className="font-bold text-slate-600 font-sans">5. Dust Allowance & NCV Allowances</span>
                                <span className="font-mono bg-white px-1.5 border text-slate-800">
                                  Dust: {dust}% | NCV: {ncv}%
                                </span>
                              </div>

                              <div className="py-1 flex justify-between">
                                <span className="font-bold text-indigo-950 uppercase tracking-tight">6. Combined Deduction Percentage</span>
                                <span className="font-mono bg-indigo-50 px-1.5 border font-black text-red-600">
                                  {totalDeductions.toFixed(2)}% Cumulative Deduction
                                </span>
                              </div>

                              <div className="bg-white p-2 border-2 border-dashed border-slate-300 mt-2 font-mono text-[10.5px]">
                                <p className="font-bold text-slate-900 uppercase underline text-[9.5px]">Calculation Breakdown Formula:</p>
                                <p className="mt-1 leading-relaxed text-indigo-950">
                                  W_net = W_gross * (1 - Total_Deduction / 100)
                                </p>
                                <p className="text-slate-800 font-semibold mt-1">
                                  W_net = {grossRaw.toFixed(3)} MT * (1 - {totalDeductions.toFixed(2)} / 100)
                                </p>
                                <p className="text-red-700 font-black text-[12px] mt-1.5">
                                  W_reconciled = {reconciledNet.toFixed(3)} MT
                                </p>
                                <p className="text-slate-500 font-sans font-bold uppercase text-[8px] tracking-wide mt-1 italic">
                                  Deduction Weight Loss equivalent: {totalDeductionWeight.toFixed(3)} MT
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Row modal edit fallback */}
      {editingRow && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#E8E6E1] border-2 border-white shadow-2xl w-full max-w-lg p-5 space-y-4">
            <div className="bg-[#000080] text-white p-1.5 flex justify-between items-center">
              <span className="text-xs font-black uppercase">Edit Row metadata</span>
              <button onClick={() => setEditingRow(null)}>X</button>
            </div>
            <div className="grid grid-cols-2 gap-4 max-h-[380px] overflow-y-auto pr-1">
              {editorColumns.map((col) => {
                let labelName = col;
                if (selectedTable?.name === "user_master") {
                  if (col === "password_hash") {
                    labelName = "FULL NAME";
                  } else if (col === "user_id") {
                    labelName = "USER ID (SYSTEM AUTO)";
                  } else if (col === "is_active") {
                    labelName = "STATUS (IS ACTIVE)";
                  } else if (col === "created_at") {
                    labelName = "CREATED AT (AUTO)";
                  }
                } else if (selectedTable?.name === "user_activity_logs") {
                  if (col === "log_id") {
                    labelName = "LOG ID (SYSTEM AUTO)";
                  } else if (col === "username") {
                    labelName = "USERNAME / ACTOR";
                  } else if (col === "activity_type") {
                    labelName = "ACTIVITY / EVENT TYPE";
                  } else if (col === "module_name") {
                    labelName = "MODULE ACCESSED";
                  } else if (col === "action_details") {
                    labelName = "ACTION DETAIL SUMMARY";
                  } else if (col === "ip_address") {
                    labelName = "IP ADDRESS / SOURCE";
                  } else if (col === "created_at") {
                    labelName = "OCCURRED AT (AUTO)";
                  }
                }
                const isFullWidth = col === "allowed_modules" || col === "action_details";
                return (
                  <div key={col} className={`space-y-1 text-xs font-bold ${isFullWidth ? "col-span-2" : ""}`}>
                    <label className="text-slate-500 uppercase text-[9px] block font-black leading-none">{labelName}</label>
                    {renderEditField(col)}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 text-xs font-bold">
              <button onClick={() => setEditingRow(null)} className="px-4 py-1.5 bg-slate-300">Cancel</button>
              <button onClick={handleSave} className="px-4 py-1.5 bg-[#000080] text-white">Save Item</button>
            </div>
          </div>
        </div>
      )}
    </LegacyLayout>
  );
}
