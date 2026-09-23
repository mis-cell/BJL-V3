import React from 'react';
import { FileText } from 'lucide-react';
import SectionHeader from './SectionHeader';
import FileUploader from './FileUploader';
import FooterActions from './FooterActions';

interface RemarksCardProps {
  formData: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSignatureChange: (url: string) => void;
  onPrint?: () => void;
  onBack?: () => void;
  onSave?: () => void;
  isLoading?: boolean;
}

export const RemarksCard: React.FC<RemarksCardProps> = ({
  formData,
  onChange,
  onSignatureChange,
  onPrint,
  onBack,
  onSave,
  isLoading = false
}) => {
  return (
    <div className="bg-white rounded-[18px] p-5 shadow-md border border-[#D8D3C5] hover:border-[#174C2C]/40 hover:shadow-lg transition-all overflow-hidden">
      <SectionHeader icon={FileText} title="Remarks & Finalisation" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-2">
        {/* Remarks Textarea */}
        <div className="lg:col-span-7 flex flex-col gap-1.5">
          <label htmlFor="remarks_34" className="text-xs font-semibold text-slate-700">Remarks</label>
          <textarea
 id="remarks_34" aria-label="Remarks"            name="remarks"
            rows={4}
            value={formData.remarks ?? 'Area, Agency Grade, Grade differential can change as per market.'}
            onChange={onChange}
            className="w-full bg-white border border-[#D5D0C5] focus:border-[#174C2C] focus:ring-2 focus:ring-[#174C2C]/20 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none transition-all shadow-2xs resize-none"
          />
        </div>

        {/* Finalisation Fields */}
        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* B. Rate (Rs.) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="b_rate_48" className="text-xs font-semibold text-slate-700">B. Rate (Rs.)</label>
            <input
 id="b_rate_48" aria-label="B. Rate (Rs.)"              type="number"
              step="0.01"
              name="b_rate"
              value={formData.b_rate ?? 0}
              onChange={onChange}
              className="bg-white border border-[#D5D0C5] focus:border-[#174C2C] rounded-xl px-3.5 py-2 text-xs font-bold text-[#174C2C] text-right outline-none transition-all shadow-2xs"
            />
          </div>

          {/* B. Date */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="b_date_61" className="text-xs font-semibold text-slate-700">B. Date</label>
            <input
 id="b_date_61" aria-label="B. Date"              type="date"
              name="b_date"
              value={formData.b_date || ''}
              onChange={onChange}
              className="bg-white border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#174C2C] transition-all shadow-2xs cursor-pointer"
            />
          </div>

          {/* Superior / Normal Marks */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="superior_normal_marks_73" className="text-xs font-semibold text-slate-700">Superior/Normal</label>
            <select
 id="superior_normal_marks_73" aria-label="Superior/Normal"              name="superior_normal_marks"
              value={formData.superior_normal_marks || 'New (F2)'}
              onChange={onChange}
              className="bg-white border border-[#D5D0C5] rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#174C2C] transition-all shadow-2xs cursor-pointer"
            >
              <option value="New (F2)">New (F2)</option>
              <option value="Superior">Superior</option>
              <option value="Normal">Normal</option>
            </select>
          </div>

          {/* Digital Signature Upload */}
          <FileUploader
            label="Digital Signature"
            value={formData.signature_url}
            onChange={onSignatureChange}
          />
        </div>
      </div>

      {/* Embedded Action Footer */}
      {(onPrint || onBack || onSave) && (
        <FooterActions
          onPrint={onPrint || (() => {})}
          onBack={onBack || (() => {})}
          onSave={onSave || (() => {})}
          isLoading={isLoading}
        />
      )}
    </div>
  );
};

export default RemarksCard;
