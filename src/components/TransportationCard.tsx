import React from 'react';
import { Truck, CheckCircle2, AlertTriangle } from 'lucide-react';
import SectionHeader from './SectionHeader';
import SearchableSelect from './SearchableSelect';

interface TransportationCardProps {
  formData: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSelectChange?: (field: string, value: string) => void;
  unitOptions: string[];
  isUser010?: boolean;
}

export const TransportationCard: React.FC<TransportationCardProps> = ({
  formData,
  onChange,
  onSelectChange,
  unitOptions,
  isUser010 = false
}) => {
  const hasValidationIssues = (Number(formData.no_of_lorries) || 0) <= 0;

  return (
    <div className="bg-white rounded-[18px] p-5 shadow-md border border-[#D8D3C5] hover:border-[#174C2C]/40 hover:shadow-lg transition-all">
      <SectionHeader icon={Truck} title="Unit & Transportation Details" />

      {isUser010 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* No. of Lorries */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="no_of_lorries_010" className="text-xs font-semibold text-slate-700">
              No. of Lorries
            </label>
            <input
              id="no_of_lorries_010"
              aria-label="No. of Lorries"
              type="number"
              min="1"
              name="no_of_lorries"
              value={formData.no_of_lorries ?? 1}
              onChange={onChange}
              className="bg-white border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 text-right outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs font-mono"
            />
          </div>

          {/* Unit Type */}
          <SearchableSelect
            id="unit_type_010"
            label="Unit Type"
            value={formData.unit_type || 'BALES'}
            onChange={(val) => {
              if (onSelectChange) {
                onSelectChange('unit_type', val);
              } else {
                onChange({ target: { name: 'unit_type', value: val } } as any);
              }
            }}
            options={unitOptions}
            placeholder="SELECT OR TYPE UNIT..."
            isRequired={false}
            isAutoPopulated={false}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* No. of Lorries */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="no_of_lorries_26" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <span>No. of Lorries</span>
            <span className="text-rose-600 font-black text-sm">*</span>
          </label>
          <input
            id="no_of_lorries_26"
            aria-label="No. of Lorries"
            type="number"
            min="1"
            name="no_of_lorries"
            value={formData.no_of_lorries ?? 1}
            onChange={onChange}
            className="bg-[#FFECEC] border-2 border-rose-300 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 text-right outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200 transition-all shadow-2xs font-mono"
          />
        </div>

        {/* Units/Lorry - NUMERIC INPUT */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="units_per_lorry_input" className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <span>Units/Lorry</span>
          </label>
          <input
            id="units_per_lorry_input"
            aria-label="Units/Lorry"
            type="number"
            step="1"
            min="0"
            name="units_per_lorry"
            placeholder="e.g. 150"
            value={formData.units_per_lorry !== undefined && formData.units_per_lorry !== null ? formData.units_per_lorry : (Number(formData.units_per_lorry_type) || '')}
            onChange={onChange}
            className="bg-white border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 text-right outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs font-mono"
          />
        </div>

        {/* Total Unit = No. of Lorries * Units/Lorry */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="total_unit_56" className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Total Unit</span>
            <span className="text-[9px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded border border-sky-300 font-bold uppercase">Auto (Lorry × Units/Lorry)</span>
          </label>
          <input
            id="total_unit_56"
            aria-label="Total Unit"
            type="number"
            name="total_unit"
            value={formData.total_unit ?? 0}
            onChange={onChange}
            className="bg-[#EAF4FF] border border-sky-300 rounded-xl px-3.5 py-2 text-xs font-bold text-sky-950 text-right outline-none focus:ring-2 focus:ring-sky-300 transition-all shadow-2xs font-mono"
          />
        </div>

        {/* Weight/Lorry = Total Wt. in Ton / No. of Lorries */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wt_per_lorry_68" className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Wt/Lorry (MT)</span>
            <span className="text-[9px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded border border-sky-300 font-bold uppercase">Total Wt / Lorry</span>
          </label>
          <input
            id="wt_per_lorry_68"
            aria-label="Wt/Lorry"
            type="number"
            step="0.001"
            name="wt_per_lorry"
            value={formData.wt_per_lorry ?? 0}
            onChange={onChange}
            className="bg-white border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 text-right outline-none focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 transition-all shadow-2xs font-mono"
          />
        </div>

        {/* Unit Type - SEARCHABLE DROPDOWN */}
        <SearchableSelect
          label="Unit Type"
          value={formData.unit_type || 'BALES'}
          onChange={(val) => {
            if (onSelectChange) {
              onSelectChange('unit_type', val);
            } else {
              onChange({ target: { name: 'unit_type', value: val } } as any);
            }
          }}
          options={unitOptions}
          placeholder="SELECT OR TYPE UNIT..."
          isAutoPopulated={Boolean(formData.unit_type)}
        />

        {/* Total Weight in Ton */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="total_wt_in_ton_98" className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Total Wt. in Ton</span>
            <span className="text-[9px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded border border-sky-300 font-bold uppercase">Auto</span>
          </label>
          <input
            id="total_wt_in_ton_98"
            aria-label="Total Wt. in Ton"
            type="number"
            step="0.001"
            name="total_wt_in_ton"
            value={formData.total_wt_in_ton ?? 0}
            onChange={onChange}
            className="bg-[#EAF4FF] border border-sky-300 rounded-xl px-3.5 py-2 text-xs font-bold text-sky-950 text-right outline-none focus:ring-2 focus:ring-sky-300 transition-all shadow-2xs font-mono"
          />
        </div>

        {/* Issue Validation Panel */}
        <div className="md:col-span-2 flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Issue</label>
          {hasValidationIssues ? (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Please specify a valid lorry count greater than 0</span>
            </div>
          ) : (
            <div className="bg-[#F0FDF4] border border-[#DCFCE7] text-[#166534] rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0" />
              <span>No issues recorded</span>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

export default TransportationCard;

