-- ============================================================================
-- BJCL_DB: Complete PostgreSQL 18 Database Initialization Script
-- System: Bally Jute Company Limited (BJL) - Raw Jute Management System
-- Database: bjcl_db
-- ============================================================================

-- Ensure required PostgreSQL extensions are active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable UTC / Indian Standard Time timezone consistency
SET timezone = 'Asia/Kolkata';

-- ============================================================================
-- 1. MASTER DIRECTORY & PARAMETER TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_year_master (
    year_code TEXT PRIMARY KEY, -- e.g. "2025-2026", "2026-2027"
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO financial_year_master (year_code, start_date, end_date, is_active) VALUES 
('2024-2025', '2024-04-01', '2025-03-31', FALSE),
('2025-2026', '2025-04-01', '2026-03-31', TRUE),
('2026-2027', '2026-04-01', '2027-03-31', TRUE)
ON CONFLICT (year_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS area_master (
    area_code TEXT PRIMARY KEY,
    area_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agency_master (
    agency_code TEXT PRIMARY KEY,
    area_code TEXT REFERENCES area_master(area_code) ON DELETE SET NULL,
    agency_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grade_master (
    grade_code TEXT PRIMARY KEY,
    grade_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS godown_master (
    gdn_code TEXT PRIMARY KEY,
    gdn_name TEXT NOT NULL,
    gdn_capacity NUMERIC(15,2),
    gdn_short_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supply_master (
    supp_code TEXT PRIMARY KEY,
    supp_name TEXT NOT NULL,
    acc_no TEXT,
    supp_add1 TEXT,
    supp_add2 TEXT,
    supp_add3 TEXT,
    supp_city TEXT,
    supp_contact TEXT,
    supp_ph_no TEXT,
    supp_cell_no TEXT,
    supp_fax_no TEXT,
    supp_email TEXT,
    supp_webadd TEXT,
    erp_user_code TEXT,
    pan_no TEXT,
    ifsc_code TEXT,
    ifsc_branch TEXT,
    supplier_group TEXT,
    jc_regis_no TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS broker_master (
    brok_code TEXT PRIMARY KEY,
    brok_name TEXT NOT NULL,
    acc_no TEXT,
    brok_add1 TEXT,
    brok_add2 TEXT,
    brok_add3 TEXT,
    brok_city TEXT,
    brok_contact TEXT,
    brok_ph_no TEXT,
    brok_cell_no TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS unit_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO unit_master (unit_name) VALUES 
('DRUMS'), ('BALES'), ('LOOSE'), ('P.BALES'), ('H.BALES'), ('QTL'), ('KGS'), ('MT')
ON CONFLICT (unit_name) DO NOTHING;

-- ============================================================================
-- 2. USER AUTHENTICATION & ACCESS CONTROL
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_master (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    role TEXT DEFAULT 'operator',
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS authentication_master (
    auth_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES user_master(user_id) ON DELETE CASCADE,
    portal_access JSONB,
    role_type TEXT,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 3. SAUDA & SATTA TRANSACTION MODULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS sauda_master (
    sauda_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financial_year TEXT NOT NULL,
    sauda_no TEXT NOT NULL UNIQUE,
    session TEXT, 
    po_type TEXT,
    date DATE NOT NULL,
    broker TEXT,
    supplier TEXT,
    challan_supplier TEXT,
    area TEXT,
    agency TEXT,
    marks TEXT,
    no_of_lorries INTEGER,
    units_per_lorry NUMERIC(15,2),
    units_per_lorry_type TEXT,
    total_unit INTEGER,
    wt_per_lorry NUMERIC(15,3),
    unit_type TEXT,
    total_wt_in_ton NUMERIC(15,3),
    shipment_date DATE,
    shipment_days INTEGER,
    shipment_penalty NUMERIC(15,2),
    marks_claim NUMERIC(15,2),
    quantity_claim NUMERIC(15,2),
    remarks TEXT,
    b_rate NUMERIC(15,2),
    b_date DATE,
    superior_normal_marks TEXT,
    signature_url TEXT,
    status TEXT DEFAULT 'pending',
    open_remarks JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sauda_quality_details (
    detail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sauda_id UUID REFERENCES sauda_master(sauda_id) ON DELETE CASCADE,
    financial_year TEXT,
    quality TEXT,
    qty NUMERIC(15,3),
    rs NUMERIC(15,2),
    agency TEXT,
    marka TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sauda_check_point (
    po_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financial_year TEXT NOT NULL,
    purchase_order TEXT,
    po_type TEXT,
    ptf_no TEXT,
    pending BOOLEAN DEFAULT TRUE,
    po_no TEXT NOT NULL UNIQUE,
    po_date DATE NOT NULL,
    broker TEXT,
    supplier TEXT,
    challan_supplier TEXT,
    area TEXT,
    trans_paid_by TEXT,
    weight_unit_kgs NUMERIC(15,2),
    against_cancellation TEXT,
    purchase_unit_code TEXT,
    purchase_unit_name TEXT,
    total_lorries NUMERIC(15,2),
    units_per_lorry NUMERIC(15,2),
    total_units NUMERIC(15,2),
    weight_per_lorry NUMERIC(15,3),
    total_contract_mt NUMERIC(15,3),
    marka_type TEXT,
    marka_penalty NUMERIC(15,2),
    qty_penalty NUMERIC(15,2),
    delivery_from DATE,
    delivery_to DATE,
    grace_days INTEGER,
    delivery_penalty NUMERIC(15,2),
    contract_po_no TEXT,
    contract_date DATE,
    rate_detail TEXT,
    delivery_schedule TEXT,
    terms_condition TEXT,
    remarks TEXT,
    po_identification TEXT,
    b_rate NUMERIC(15,2),
    s_date DATE,
    status TEXT DEFAULT 'pending',
    open_remarks JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sauda_check_point_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_no TEXT,
    srl_no INTEGER,
    crop_year TEXT,
    grade_code TEXT,
    agency_code TEXT,
    marka_code TEXT,
    quantity INTEGER,
    weight_mt NUMERIC(15,3),
    rate_qntl NUMERIC(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sauda_check_point_deductions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_no TEXT,
    deduction_name TEXT,
    rate NUMERIC(15,2),
    amount NUMERIC(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS satta_master (
    satta_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    satta_no TEXT UNIQUE,
    date DATE,
    broker TEXT,
    supplier TEXT,
    satta_data JSONB,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS satta_quality_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    satta_id UUID REFERENCES satta_master(satta_id) ON DELETE CASCADE,
    quality TEXT,
    quantity NUMERIC(15,3),
    rate NUMERIC(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS satta_base_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_date DATE,
    item_code TEXT,
    base_rate NUMERIC(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS satta_differentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_grade TEXT,
    to_grade TEXT,
    differential_amount NUMERIC(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS satta_calculated_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    satta_no TEXT,
    calculation_date DATE,
    data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 4. PURCHASE ORDER (PO) & TEMPORARY PO TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_master (
    po_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financial_year TEXT NOT NULL,
    purchase_order TEXT,
    po_type TEXT,
    ptf_no TEXT,
    pending BOOLEAN DEFAULT TRUE,
    po_no TEXT NOT NULL UNIQUE,
    po_date DATE NOT NULL,
    broker TEXT,
    supplier TEXT,
    challan_supplier TEXT,
    area TEXT,
    trans_paid_by TEXT,
    weight_unit_kgs NUMERIC(15,2),
    against_cancellation TEXT,
    purchase_unit_code TEXT,
    purchase_unit_name TEXT,
    total_lorries NUMERIC(15,2),
    units_per_lorry NUMERIC(15,2),
    total_units NUMERIC(15,2),
    weight_per_lorry NUMERIC(15,3),
    total_contract_mt NUMERIC(15,3),
    marka_type TEXT,
    marka_penalty NUMERIC(15,2),
    qty_penalty NUMERIC(15,2),
    delivery_from DATE,
    delivery_to DATE,
    grace_days INTEGER,
    delivery_penalty NUMERIC(15,2),
    contract_po_no TEXT,
    contract_date DATE,
    rate_detail TEXT,
    delivery_schedule TEXT,
    terms_condition TEXT,
    remarks TEXT,
    po_identification TEXT,
    b_rate NUMERIC(15,2),
    s_date DATE,
    status TEXT DEFAULT 'pending',
    open_remarks JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_detail_master (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_no TEXT REFERENCES purchase_master(po_no) ON DELETE CASCADE,
    srl_no INTEGER,
    crop_year TEXT,
    grade_code TEXT,
    agency_code TEXT,
    marka_code TEXT,
    quantity INTEGER,
    weight_mt NUMERIC(15,3),
    rate_qntl NUMERIC(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS temporary_po (
    po_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financial_year TEXT NOT NULL,
    purchase_order TEXT,
    po_type TEXT,
    ptf_no TEXT,
    pending BOOLEAN DEFAULT TRUE,
    po_no TEXT NOT NULL UNIQUE,
    po_date DATE NOT NULL,
    broker TEXT,
    supplier TEXT,
    challan_supplier TEXT,
    area TEXT,
    trans_paid_by TEXT,
    weight_unit_kgs NUMERIC(15,2),
    against_cancellation TEXT,
    purchase_unit_code TEXT,
    purchase_unit_name TEXT,
    total_lorries NUMERIC(15,2),
    units_per_lorry NUMERIC(15,2),
    total_units NUMERIC(15,2),
    weight_per_lorry NUMERIC(15,3),
    total_contract_mt NUMERIC(15,3),
    marka_type TEXT,
    marka_penalty NUMERIC(15,2),
    qty_penalty NUMERIC(15,2),
    delivery_from DATE,
    delivery_to DATE,
    grace_days INTEGER,
    delivery_penalty NUMERIC(15,2),
    contract_po_no TEXT,
    contract_date DATE,
    rate_detail TEXT,
    delivery_schedule TEXT,
    terms_condition TEXT,
    remarks TEXT,
    po_identification TEXT,
    b_rate NUMERIC(15,2),
    s_date DATE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS temporary_po_details (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_no TEXT REFERENCES temporary_po(po_no) ON DELETE CASCADE,
    srl_no INTEGER,
    crop_year TEXT,
    grade_code TEXT,
    agency_code TEXT,
    marka_code TEXT,
    quantity INTEGER,
    weight_mt NUMERIC(15,3),
    rate_qntl NUMERIC(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 5. MATERIAL ARRIVAL & AMAD MODULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS issue_master (
    amad_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    financial_year TEXT NOT NULL,
    amad_no TEXT NOT NULL,
    date DATE NOT NULL,
    floor TEXT,
    chamber TEXT,
    farmer_name TEXT,
    acc_no TEXT,
    commodity TEXT,
    variety TEXT,
    grading TEXT,
    marka TEXT,
    bardana_type TEXT,
    vehicle_no TEXT,
    total_packets INTEGER,
    weight_qtl NUMERIC(15,2),
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS temporary_material_received (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    temporary_arrival_no TEXT UNIQUE,
    amad_no TEXT,
    date DATE,
    po_no TEXT,
    po_date DATE,
    supplier TEXT,
    challan_supplier TEXT,
    broker TEXT,
    agency TEXT,
    arrival_area_code TEXT,
    arrival_area_name TEXT,
    arrival_area TEXT,
    lorry_number TEXT,
    consignment_note TEXT,
    consignment_note_no TEXT,
    challan_railway_receipt_no TEXT,
    challan_rr_no TEXT,
    grid_details JSONB,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS final_arrival (
    final_arrival_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    final_arrival_no TEXT UNIQUE,
    arrival_no TEXT,
    temporary_arrival_no TEXT,
    temporary_arrival_date DATE,
    final_arrival_date DATE,
    mr_no TEXT,
    mr_date DATE,
    date DATE,
    po_no TEXT,
    po_date DATE,
    jci TEXT DEFAULT 'No',
    jci_no TEXT,
    supplier TEXT,
    challan_supplier TEXT,
    broker TEXT,
    transporter_name TEXT,
    lorry_number TEXT,
    lorry_date DATE,
    pan_no TEXT,
    part_no TEXT,
    part_date DATE,
    di_no TEXT,
    di_date DATE,
    challan_railway_receipt_no TEXT,
    challan_rr_no TEXT,
    challan_rr_date DATE,
    invoice_no TEXT,
    invoice_date DATE,
    consignment_note TEXT,
    consignment_note_no TEXT,
    consignment_note_date DATE,
    arrival_area_code TEXT,
    arrival_area_name TEXT,
    arrival_area TEXT,
    area TEXT,
    ptf TEXT DEFAULT 'No',
    rfs TEXT DEFAULT 'No',
    lorry_returned TEXT DEFAULT 'No',
    lorry_returned_other_mill TEXT DEFAULT 'No',
    way_bill_no TEXT,
    way_bill_date DATE,
    rr_gr_no TEXT,
    unit_name TEXT,
    total_packets INTEGER DEFAULT 0,
    grid_details JSONB,
    details JSONB,
    items JSONB,
    status TEXT DEFAULT 'Completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 6. INSPECTION & WEIGHMENT MODULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS inspection_master (
    mr_no TEXT PRIMARY KEY,
    mr_date DATE,
    date DATE,
    arrival_no TEXT,
    arrival_date DATE,
    po_no TEXT,
    po_date DATE,
    broker_name TEXT,
    supplier_name TEXT,
    arrival_area_code TEXT,
    arrival_area_name TEXT,
    arrival_area TEXT,
    grid_details JSONB,
    actual_moisture NUMERIC,
    claim_moisture NUMERIC,
    actual_dust NUMERIC,
    claim_dust NUMERIC,
    actual_ncv NUMERIC,
    claim_ncv NUMERIC,
    detention_days NUMERIC,
    unloading_date DATE,
    mill_po_no TEXT,
    mill_po_date DATE,
    mr_spcl_print TEXT,
    remarks TEXT,
    lorry_number TEXT,
    delivery_claim NUMERIC DEFAULT 0,
    deduction_type TEXT,
    deduction_rate NUMERIC DEFAULT 0,
    deduction_qty NUMERIC DEFAULT 0,
    deduction_amount NUMERIC DEFAULT 0,
    arival_apmc_fees NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspection_details (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    mr_no TEXT REFERENCES inspection_master(mr_no) ON DELETE CASCADE,
    srl_no INTEGER,
    arrival_grade TEXT,
    stock_grade_code TEXT,
    stock_grade_name TEXT,
    area TEXT,
    agency TEXT,
    marka TEXT,
    marks TEXT,
    crop_year TEXT,
    lot TEXT,
    quantity NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'BALES',
    challan_gross_wt NUMERIC DEFAULT 0,
    receipt_gross_wt NUMERIC DEFAULT 0,
    gross_weight_batch NUMERIC DEFAULT 0,
    add_weight NUMERIC DEFAULT 0,
    less_weight NUMERIC DEFAULT 0,
    reduced_weight NUMERIC DEFAULT 0,
    lorry_moisture_min NUMERIC DEFAULT 0,
    lorry_moisture_max NUMERIC DEFAULT 0,
    lorry_read_min NUMERIC DEFAULT 0,
    lorry_read_max NUMERIC DEFAULT 0,
    lorry_read_avg NUMERIC DEFAULT 0,
    insp_read_min NUMERIC DEFAULT 0,
    insp_read_max NUMERIC DEFAULT 0,
    insp_read_avg NUMERIC DEFAULT 0,
    moisture_act NUMERIC DEFAULT 0,
    moisture_claim NUMERIC DEFAULT 0,
    dust_act NUMERIC DEFAULT 0,
    dust_claim NUMERIC DEFAULT 0,
    ncv_act NUMERIC DEFAULT 0,
    ncv_claim NUMERIC DEFAULT 0,
    grade_down_act NUMERIC DEFAULT 0,
    grade_down_claim NUMERIC DEFAULT 0,
    final_receipt_wt NUMERIC DEFAULT 0,
    settlement_moisture NUMERIC DEFAULT 0,
    settlement_grade_down NUMERIC DEFAULT 0,
    settlement_dust NUMERIC DEFAULT 0,
    settlement_ncv NUMERIC DEFAULT 0,
    ropes_weight NUMERIC DEFAULT 0,
    ropes_tot_wt_grd NUMERIC DEFAULT 0,
    ropes_grade TEXT,
    chotta_weight NUMERIC DEFAULT 0,
    chotta_tot_wt_grd NUMERIC DEFAULT 0,
    chotta_grade TEXT,
    tolerable TEXT,
    row_remarks TEXT,
    jqi_remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspection_checklist (
    mr_no TEXT PRIMARY KEY,
    mr_date DATE,
    date DATE,
    arrival_no TEXT,
    arrival_date DATE,
    po_no TEXT,
    po_date DATE,
    broker_name TEXT,
    supplier_name TEXT,
    arrival_area_code TEXT,
    arrival_area_name TEXT,
    arrival_area TEXT,
    grid_details JSONB,
    actual_moisture NUMERIC,
    claim_moisture NUMERIC,
    actual_dust NUMERIC,
    claim_dust NUMERIC,
    actual_ncv NUMERIC,
    claim_ncv NUMERIC,
    detention_days NUMERIC,
    unloading_date DATE,
    mill_po_no TEXT,
    mill_po_date DATE,
    mr_spcl_print TEXT,
    remarks TEXT,
    lorry_number TEXT,
    delivery_claim NUMERIC DEFAULT 0,
    deduction_type TEXT,
    deduction_rate NUMERIC DEFAULT 0,
    deduction_qty NUMERIC DEFAULT 0,
    deduction_amount NUMERIC DEFAULT 0,
    arival_apmc_fees NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspection_checklist_details (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    mr_no TEXT REFERENCES inspection_checklist(mr_no) ON DELETE CASCADE,
    srl_no INTEGER,
    arrival_grade TEXT,
    stock_grade_code TEXT,
    stock_grade_name TEXT,
    area TEXT,
    agency TEXT,
    marka TEXT,
    marks TEXT,
    crop_year TEXT,
    lot TEXT,
    quantity NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'BALES',
    challan_gross_wt NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mill_inspection_master (
    mr_no TEXT PRIMARY KEY,
    mr_date DATE,
    date DATE,
    arrival_no TEXT,
    arrival_date DATE,
    po_no TEXT,
    po_date DATE,
    broker_name TEXT,
    supplier_name TEXT,
    arrival_area_code TEXT,
    arrival_area_name TEXT,
    arrival_area TEXT,
    grid_details JSONB,
    actual_moisture NUMERIC,
    claim_moisture NUMERIC,
    actual_dust NUMERIC,
    claim_dust NUMERIC,
    actual_ncv NUMERIC,
    claim_ncv NUMERIC,
    lorry_number TEXT,
    arival_apmc_fees NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mill_inspection_detail (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    mr_no TEXT REFERENCES mill_inspection_master(mr_no) ON DELETE CASCADE,
    srl_no INTEGER,
    arrival_grade TEXT,
    stock_grade_code TEXT,
    stock_grade_name TEXT,
    area TEXT,
    agency TEXT,
    marka TEXT,
    marks TEXT,
    crop_year TEXT,
    lot TEXT,
    quantity NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'BALES',
    challan_gross_wt NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lorry_weighments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lorry_no TEXT NOT NULL,
    gross_weight NUMERIC(15,3),
    tare_weight NUMERIC(15,3),
    net_weight NUMERIC(15,3),
    weighment_date DATE,
    weighbridge_slip_no TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 7. STOCK, INVENTORY & PAYMENT MODULES
-- ============================================================================

CREATE TABLE IF NOT EXISTS opening_stock (
    stock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    godown_code TEXT,
    grade_code TEXT,
    quantity NUMERIC(15,3),
    weight_mt NUMERIC(15,3),
    as_on_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS closing_stock (
    stock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    godown_code TEXT,
    grade_code TEXT,
    quantity NUMERIC(15,3),
    weight_mt NUMERIC(15,3),
    as_on_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_master (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_no TEXT UNIQUE,
    payment_date DATE,
    supplier TEXT,
    po_no TEXT,
    mr_no TEXT,
    gross_amount NUMERIC(15,2),
    total_deductions NUMERIC(15,2),
    net_amount NUMERIC(15,2),
    payment_mode TEXT,
    cheque_rtgs_no TEXT,
    status TEXT DEFAULT 'processed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES payment_master(payment_id) ON DELETE CASCADE,
    particulars TEXT,
    amount NUMERIC(15,2),
    deduction_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_issue_master (
    issue_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_no TEXT UNIQUE,
    date DATE,
    department TEXT,
    issued_to TEXT,
    grid_details JSONB,
    status TEXT DEFAULT 'Issued',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bardana_vouchers (
    voucher_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_no TEXT UNIQUE,
    date DATE,
    supplier TEXT,
    broker TEXT,
    quantity INTEGER,
    amount NUMERIC(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lorry_dispatches (
    dispatch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispatch_no TEXT UNIQUE,
    dispatch_date DATE,
    lorry_no TEXT,
    destination TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    status TEXT DEFAULT 'Dispatched',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 8. INTEGRATIONS, MISMATCH, SMS, & EMAIL TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS imap_emails (
    id TEXT PRIMARY KEY,
    subject TEXT,
    sender_name TEXT,
    sender_email TEXT,
    date TIMESTAMP WITH TIME ZONE,
    snippet TEXT,
    body TEXT,
    html TEXT,
    attachments JSONB,
    unread BOOLEAN DEFAULT TRUE,
    starred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sms_sauda_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender TEXT,
    message_text TEXT,
    extracted_data JSONB,
    matched_sauda_no TEXT,
    status TEXT DEFAULT 'Unmatched',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_mismatch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mr_no TEXT,
    po_no TEXT,
    lorry_no TEXT,
    mismatch_type TEXT,
    description TEXT,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS satta_mismatch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    satta_no TEXT,
    sauda_no TEXT,
    mismatch_type TEXT,
    description TEXT,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT DEFAULT 'info',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_master (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_name TEXT,
    report_type TEXT,
    last_generated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 9. STORED PROCEDURES & UTILITY FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE query;
END;
$$;

CREATE OR REPLACE FUNCTION exec_sql_return(query text)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r record;
BEGIN
    FOR r IN EXECUTE query LOOP
        RETURN NEXT to_jsonb(r);
    END LOOP;
END;
$$;

-- ============================================================================
-- 10. OPTIMIZED COMPOSITE & FOREIGN KEY INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sauda_status_created ON sauda_master(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sauda_no ON sauda_master(sauda_no);
CREATE INDEX IF NOT EXISTS idx_sauda_check_point_po_status ON sauda_check_point(po_no, status);
CREATE INDEX IF NOT EXISTS idx_purchase_master_po_status ON purchase_master(po_no, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_detail_po_grade ON purchase_detail_master(po_no, grade_code);
CREATE INDEX IF NOT EXISTS idx_temp_arrival_po_created ON temporary_material_received(po_no, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_final_arrival_no_status ON final_arrival(final_arrival_no, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_final_arrival_po_no ON final_arrival(po_no);
CREATE INDEX IF NOT EXISTS idx_inspection_mr_status ON inspection_master(mr_no, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_mr_po ON inspection_master(po_no);
CREATE INDEX IF NOT EXISTS idx_mill_inspection_mr_po ON mill_inspection_master(mr_no, po_no, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_master_supp_po ON payment_master(supplier, po_no, mr_no);
CREATE INDEX IF NOT EXISTS idx_issue_master_date ON issue_master(date DESC);
CREATE INDEX IF NOT EXISTS idx_imap_emails_date ON imap_emails(date DESC);
