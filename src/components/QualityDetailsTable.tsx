import React from 'react';
import { Settings, Plus, Trash2 } from 'lucide-react';
import SectionHeader from './SectionHeader';
import SearchableSelect from './SearchableSelect';

interface QualityDetailsTableProps {
  qualityDetails: any[];
  onQualityChange: (index: number, field: string, value: any) => void;
  onAddRow: () => void;
  onDeleteRow: () => void;
  onRemoveRowAt: (index: number) => void;
  grades: any[];
  agencies: any[];
  markas: any[];
  isUser010?: boolean;
}

export const QualityDetailsTable: React.FC<QualityDetailsTableProps> = ({
  qualityDetails,
  onQualityChange,
  onAddRow,
  onDeleteRow,
  onRemoveRowAt,
  grades,
  agencies,
  markas,
  isUser010 = false
}) => {
  // Format options lists
  const gradeOptions = React.useMemo(() => {
    const list: string[] = [];
    [...grades]
      .sort((a, b) => (a.grade_name || a.grade_code || "").localeCompare(b.grade_name || b.grade_code || ""))
      .forEach(g => {
        const val = g.grade_name || g.grade_code || g.name || '';
        if (val && !list.includes(val)) list.push(val);
      });
    return list;
  }, [grades]);

  const agencyOptions = React.useMemo(() => {
    const list: string[] = [];
    [...agencies]
      .sort((a, b) => (a.agency_name || a.name || "").localeCompare(b.agency_name || b.name || ""))
      .forEach(a => {
        const val = a.agency_name || a.name || (typeof a === 'string' ? a : '');
        if (val && !list.includes(val)) list.push(val);
      });
    return list;
  }, [agencies]);

  const markaOptions = React.useMemo(() => {
    const list: string[] = [];
    [...markas]
      .sort((a, b) => (a.marka_name || a.name || "").localeCompare(b.marka_name || b.name || ""))
      .forEach(m => {
        const val = m.marka_name || m.name || (typeof m === 'string' ? m : '');
        if (val && !list.includes(val)) list.push(val);
      });
    return list;
  }, [markas]);

  return (
    <div className="bg-white rounded-[18px] p-5 shadow-md border border-[#D8D3C5] hover:border-[#174C2C]/40 hover:shadow-lg transition-all">
      <SectionHeader
        icon={Settings}
        title="Quality Details"
        rightAction={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddRow}
              className="bg-[#174C2C] hover:bg-[#113A21] text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Spawn Row</span>
            </button>
            <button
              type="button"
              onClick={onDeleteRow}
              className="border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Row</span>
            </button>
          </div>
        }
      />

      {/* Table */}
      <div className="rounded-xl border border-[#E0DBCF] shadow-2xs overflow-visible bg-white">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-20 shadow-2xs">
            <tr className="bg-[#EDF4EF] text-[#174C2C] font-bold text-xs uppercase border-b border-[#D8E4DC]">
              {isUser010 ? (
                <>
                  <th className="px-3.5 py-2.5 w-3/5 bg-[#EDF4EF] rounded-tl-xl">
                    Quality
                  </th>
                  <th className="px-3.5 py-2.5 w-2/5 text-right bg-[#EDF4EF]">
                    Rs.
                  </th>
                  <th className="px-2 py-2.5 w-12 text-center bg-[#EDF4EF] rounded-tr-xl"></th>
                </>
              ) : (
                <>
                  <th className="px-3.5 py-2.5 w-1/3 bg-[#EDF4EF] rounded-tl-xl">
                    Quality <span className="text-rose-600 font-black">*</span>
                  </th>
                  <th className="px-3.5 py-2.5 w-1/4 bg-[#EDF4EF]">Agency</th>
                  <th className="px-3.5 py-2.5 w-1/4 bg-[#EDF4EF]">Marka</th>
                  <th className="px-3.5 py-2.5 w-1/6 text-right bg-[#EDF4EF]">
                    Rs. <span className="text-rose-600 font-black">*</span>
                  </th>
                  <th className="px-2 py-2.5 w-12 text-center bg-[#EDF4EF] rounded-tr-xl"></th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EAE6DD] text-xs">
            {qualityDetails.map((qd, i) => (
              <tr key={i} className="hover:bg-[#F9F8F5] transition-colors relative z-0 focus-within:z-30 hover:z-20">
                {/* Quality - SEARCHABLE SELECT */}
                <td className="p-2">
                  <SearchableSelect
                    id={`qd_quality_${i}`}
                    name="qd_quality"
                    value={qd.quality || ''}
                    onChange={(val) => onQualityChange(i, 'quality', val)}
                    options={gradeOptions}
                    placeholder={isUser010 ? "Select Quality..." : "--Select Quality *--"}
                    isRequired={!isUser010}
                    compact={true}
                  />
                </td>

                {!isUser010 && (
                  <>
                    {/* Agency - SEARCHABLE SELECT */}
                    <td className="p-2">
                      <SearchableSelect
                        id={`agency_${i}`}
                        name="agency"
                        value={qd.agency || ''}
                        onChange={(val) => onQualityChange(i, 'agency', val)}
                        options={agencyOptions}
                        placeholder="Search / Select Agency"
                        compact={true}
                        isAutoPopulated={Boolean(qd.agency)}
                      />
                    </td>

                    {/* Marka - SEARCHABLE SELECT */}
                    <td className="p-2">
                      <SearchableSelect
                        id={`marka_${i}`}
                        name="marka"
                        value={qd.marka || ''}
                        onChange={(val) => onQualityChange(i, 'marka', val)}
                        options={markaOptions}
                        placeholder="Search / Select Marka"
                        compact={true}
                        isAutoPopulated={Boolean(qd.marka)}
                      />
                    </td>
                  </>
                )}

                {/* Rs. */}
                <td className="p-2">
                  <input
                    id={`rs_${i}`}
                    name="rs"
                    aria-label="Rs."
                    type="number"
                    step="0.01"
                    required={!isUser010}
                    value={qd.rs ?? ''}
                    onChange={(e) => onQualityChange(i, 'rs', e.target.value)}
                    placeholder={isUser010 ? "Rs." : "Rs. *"}
                    className={`w-full rounded-lg px-2.5 py-1.5 text-xs font-bold text-right outline-none transition-all font-mono ${
                      isUser010
                        ? "bg-white border border-[#D5D0C5] text-slate-800 focus:border-[#174C2C] focus:ring-1 focus:ring-[#174C2C]/20"
                        : "bg-[#FFECEC] border-2 border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-slate-900 font-black"
                    }`}
                  />
                </td>

                {/* Action Delete */}
                <td className="p-2 text-center">
                  <button
                    type="button"
                    onClick={() => onRemoveRowAt(i)}
                    title="Delete row"
                    className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QualityDetailsTable;

