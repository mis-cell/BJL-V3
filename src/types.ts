export interface Farmer {
  id: string;
  name: string;
  father_name?: string;
  village: string;
  mobile: string;
  account_no?: string;
  address?: string;
  created_at: string;
}

export interface Trader {
  id: string;
  name: string;
  village: string;
  mobile: string;
  created_at: string;
}

export interface ArrivalDetailRow {
  srl_no: number;
  receipt_grade_code: string;
  receipt_grade_name: string;
  crop_year: string;
  challan_grade_name: string;
  agency_code: string;
  agency_name: string;
  challan_marka_code: string;
  challan_marka_name: string;
  netto_pnto: number;
  quantity_chln: number;
  quantity_rcpt: number;
  unit?: string;
  remarks: string;
  marks_phota?: string;
}

export interface Amad {
  amad_id?: string;
  id?: string;
  financial_year: string;
  amad_no: string;
  temporary_arrival_no?: string;
  po_no?: string;
  date: string;
  jci?: string;
  challan_supplier?: string;
  supplier?: string;
  agency_name?: string;
  broker?: string;
  transporter_name?: string;
  challan_rr_no?: string;
  challan_railway_receipt_no?: string;
  lorry_number?: string;
  pan_no?: string;
  lorry_date?: string;
  consignment_note?: string;
  consignment_note_no?: string;
  consignment_note_date?: string;
  di_no?: string;
  di_date?: string;
  invoice_no?: string;
  invoice_date?: string;
  ptf?: string;
  lorry_returned?: string;
  lorry_returned_other_mill?: string;
  arrival_area_code?: string;
  arrival_area_name?: string;
  unit_code?: string;
  unit_name?: string;
  way_bill_no?: string;
  way_bill_date?: string;
  apmc_fees?: number;
  remarks?: string;
  total_packets?: number;
  weight_qtl?: number;
  grid_details?: ArrivalDetailRow[] | string;
  challan_material_weight?: number;
  actual_gross_weight?: number;
  actual_tare_weight?: number;
  supplier_net_weight?: number;
  supplier_challan_gross?: number;
  supplier_tare_weight?: number;
  electronic_net_weight?: number;
  electronic_gross_weight?: number;
  electronic_tare_weight?: number;
  weight_reduced?: number;
  created_at?: string;
  status?: string;

  // Backward compatibility properties:
  packets?: number;
  weight?: number;
  commodity?: string;
  variety?: string;
  grading?: string;
  marka?: string;
  bardana_type?: string;
  farmer_id?: string;
  room_chamber?: string;
  floor?: string;
  loading_type?: string;
  condition?: string;
  remark?: string;
}

export interface SaudaQualityDetail {
  detail_id?: string;
  sauda_id?: string;
  quality: string;
  qty: number;
  marka?: string;
  agency?: string;
  rs: number;
  percentage?: number;
  rate?: number;
}

export interface Sauda {
  sauda_id?: string;
  financial_year: string;
  sauda_no: string;
  session?: string;
  po_type?: string;
  date: string;
  broker?: string;
  supplier?: string;
  challan_supplier?: string;
  area?: string;
  agency?: string;
  marks?: string;
  no_of_lorries?: number;
  total_lorry?: number;
  units_per_lorry?: number;
  units_per_lorry_type?: string;
  total_unit?: number;
  wt_per_lorry?: number;
  unit_type?: string;
  total_wt_in_ton?: number;
  shipment_date?: string;
  shipment_days?: number;
  delivery_days?: number;
  shipment_penalty?: number;
  marks_claim?: number;
  quantity_claim?: number;
  remarks?: string;
  b_rate?: number;
  b_date?: string;
  superior_normal_marks?: string;
  signature_url?: string;
  status: 'pending' | 'completed' | 'cancelled';
  created_at?: string;
  quality_details?: SaudaQualityDetail[];
}

export interface SattaQualityDetail {
  detail_id?: string;
  satta_id?: string;
  quality: string;
  qty: number;
  marka?: string;
  agency?: string;
  rs: number;
  percentage?: number;
  rate?: number;
}

export interface Satta {
  satta_id?: string;
  financial_year: string;
  satta_no: string;
  session?: string;
  po_type?: string;
  date: string;
  broker?: string;
  supplier?: string;
  challan_supplier?: string;
  area?: string;
  agency?: string;
  marks?: string;
  no_of_lorries?: number;
  total_lorry?: number;
  units_per_lorry?: number;
  units_per_lorry_type?: string;
  total_unit?: number;
  wt_per_lorry?: number;
  unit_type?: string;
  total_wt_in_ton?: number;
  shipment_date?: string;
  shipment_days?: number;
  delivery_days?: number;
  shipment_penalty?: number;
  marks_claim?: number;
  quantity_claim?: number;
  remarks?: string;
  b_rate?: number;
  b_date?: string;
  superior_normal_marks?: string;
  signature_url?: string;
  status: 'pending' | 'completed' | 'cancelled';
  created_at?: string;
  quality_details?: SattaQualityDetail[];
}

export interface BardanaVoucher {
  id: string;
  type: 'issue' | 'purchase' | 'return' | 'transfer';
  date: string;
  account_name: string; // can be farmer or trader or supplier
  quantity: number;
  rate?: number;
  amount?: number;
  remark?: string;
  created_at: string;
}
