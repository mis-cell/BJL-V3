import React from 'react';
import { Sauda } from '../types';

interface Props {
  sauda: Sauda;
  onClose?: () => void;
}

export default function SaudaPrintSlip({ sauda }: Props) {
  const qualityRows = sauda.quality_details || [];
  
  // Pad local qualities to at least 7 rows to match the physical slip format
  const paddedQualities = [...qualityRows];
  while (paddedQualities.length < 7) {
    paddedQualities.push({ quality: '', percentage: 0, rate: 0, qty: 0, rs: 0, marka: '', agency: '' });
  }

  const sessionParts = sauda.session ? sauda.session.split('/') : ['BJCL', '2026-2027', sauda.sauda_no];
  const yearStr = sessionParts[1] || '2026-2027';

  // Format any rate values nicely
  const getBrateString = () => {
    if (sauda.b_rate) {
      return `${Number(sauda.b_rate).toLocaleString('en-IN')}/-`;
    }
    // Try to find the first quality rate as a backup
    const firstWithRate = qualityRows.find(q => q.rs && Number(q.rs) > 0);
    if (firstWithRate) {
      return `${Number(firstWithRate.rs).toLocaleString('en-IN')}/-`;
    }
    return '17,100/-';
  };

  return (
    <div className="bg-white w-[148mm] h-[210mm] min-h-[210mm] max-h-[210mm] mx-auto p-6 flex flex-col font-sans text-black print:w-[148mm] print:h-[210mm] print:max-h-[210mm] print:p-6 print:m-0 box-border text-[11px] leading-relaxed relative overflow-hidden page-break-inside-avoid shadow-lg print:shadow-none">
       {/* Invoice/Contract Header */}
       <div className="flex justify-between items-center mb-2 flex-none border-b-2 border-black pb-2">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded border-2 border-black flex items-center justify-center font-serif font-black text-xs text-black shrink-0">
                BJ
             </div>
             <div className="flex flex-col">
                <div className="font-extrabold text-[15px] text-black leading-tight tracking-tight">BALLY JUTE COMPANY LIMITED</div>
                <div className="text-[10px] font-bold text-neutral-800 tracking-wider font-mono">SAUDA CONTRACT SLIP • {yearStr}</div>
             </div>
          </div>
          <div className="flex flex-col items-end text-right">
             <div className="font-bold text-[16px] text-black">BJCL / {sauda.sauda_no}</div>
             <div className="text-[11px] font-bold text-black">Date: {sauda.date ? new Date(sauda.date).toLocaleDateString('en-GB') : ''}</div>
             <div className="text-[10px] font-mono text-black">P.O. : {sauda.po_type || 'Normal/PTF'}</div>
          </div>
       </div>

       {/* Parties Block */}
       <div className="flex flex-col gap-3 font-semibold mb-4 flex-none">
          <div className="flex items-end">
             <span className="w-[140px] text-black font-bold shrink-0">Broker :</span>
             <span className="flex-1 border-b border-black border-dotted pb-0.5 uppercase text-black font-bold text-[11px] pl-1">
                {(sauda.broker || '').toUpperCase()}
             </span>
          </div>
          <div className="flex items-end">
             <span className="w-[140px] text-black font-bold shrink-0">Supplier :</span>
             <span className="flex-1 border-b border-black border-dotted pb-0.5 uppercase text-black font-bold text-[11px] pl-1">
                {(sauda.supplier || '').toUpperCase()}
             </span>
          </div>
          <div className="flex items-end">
             <span className="w-[140px] text-black font-bold shrink-0">Challan Supplier :</span>
             <span className="flex-1 border-b border-black border-dotted pb-0.5 uppercase text-black font-bold text-[11px] pl-1">
                {(sauda.challan_supplier || '').toUpperCase()}
             </span>
          </div>
          <div className="flex items-end">
             <span className="w-[140px] text-black font-bold shrink-0">Area :</span>
             <span className="flex-1 border-b border-black border-dotted pb-0.5 uppercase text-black font-bold text-[11px] pl-1">
                {(sauda.area || '').toUpperCase()}
             </span>
          </div>
       </div>

       {/* Quantities & Logistics Block */}
       <div className="flex flex-col gap-3 font-semibold mb-4 flex-none">
          <div className="flex justify-between gap-6">
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">No. of Lorries</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black text-[12px]">
                   {sauda.no_of_lorries || sauda.total_lorry || ''}
                </span>
             </div>
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Units/Lorry :</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black uppercase">
                   {sauda.units_per_lorry_type || ''}
                </span>
             </div>
          </div>
          <div className="flex justify-between gap-6">
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Total Unit :</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black">
                   {sauda.total_unit || ''}
                </span>
             </div>
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Wt/Lorry :</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black">
                   {sauda.wt_per_lorry || ''}
                </span>
             </div>
          </div>
          <div className="flex justify-between items-end gap-4">
             <div className="text-black font-bold shrink-0">Unit : Bales/H. Bales/Drums/Loose</div>
             <div className="flex w-[210px] items-end shrink-0">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Total Wt. :</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black inline-flex justify-center items-center">
                   {sauda.total_wt_in_ton ? `${sauda.total_wt_in_ton} tons` : ''}
                </span>
             </div>
          </div>
       </div>

       {/* Qualities Table (List Format) */}
       <div className="flex flex-col gap-1.5  flex-none mb-4 font-mono text-[11px]">
          {paddedQualities.map((item, idx) => (
             <div key={idx} className="flex items-end justify-between font-bold h-5">
                {/* Quality */}
                <div className="flex items-end flex-initial w-[110px]">
                   <span className="text-black font-bold mr-1 shrink-0">Quality:</span>
                   <span className="flex-1 border-b border-black border-dotted text-center h-4 flex items-end justify-center font-extrabold pb-0.5 uppercase text-black">
                      {item.quality ? `${item.quality.trim().toUpperCase()}` : ''}
                   </span>
                </div>
                
                {/* Qty */}
                <div className="flex items-end flex-initial w-[80px]">
                   <span className="text-black font-bold mr-1 shrink-0">Qty:</span>
                   <span className="flex-1 border-b border-black border-dotted text-center h-4 flex items-end justify-center font-bold pb-0.5 text-black">
                      {item.qty || ''}
                   </span>
                </div>

                {/* Agency */}
                <div id={`printed-agency-${idx}`} className="flex items-end flex-initial w-[130px] print-hide-agency">
                   <span className="text-black font-bold mr-1 shrink-0">Agency:</span>
                   <span className="flex-1 border-b border-black border-dotted text-center h-4 flex items-end justify-center font-bold pb-0.5 uppercase text-black">
                      {item.agency ? item.agency.trim().toUpperCase() : ''}
                   </span>
                </div>

                {/* Marka */}
                <div id={`printed-marka-${idx}`} className="flex items-end flex-initial w-[125px] print-hide-marka">
                   <span className="text-black font-bold mr-1 shrink-0">Marka:</span>
                   <span className="flex-1 border-b border-black border-dotted text-center h-4 flex items-end justify-center font-bold pb-0.5 uppercase text-black">
                      {item.marka ? item.marka.trim().toUpperCase() : ''}
                   </span>
                </div>

                {/* @ Rs. */}
                <div className="flex items-end flex-initial w-[110px]">
                   <span className="text-black font-bold mr-1 shrink-0">@ Rs.</span>
                   <span className="flex-1 border-b border-black border-dotted text-center h-4 flex items-end justify-end font-bold pb-0.5 pr-2 text-black">
                      {item.rs ? `${Number(item.rs).toLocaleString('en-IN')}/-` : ''}
                   </span>
                </div>
             </div>
          ))}
       </div>

       {/* Terms Block */}
       <div className="flex flex-col gap-2.5 font-semibold mb-4 flex-none">
          <div className="flex gap-4 items-end">
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Shipment :</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black">
                   {sauda.shipment_date ? new Date(sauda.shipment_date).toLocaleDateString('en-GB') : ''}
                </span>
             </div>
             <div className="flex w-28 items-end shrink-0">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Days :</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black">
                   {sauda.shipment_days || sauda.delivery_days || ''}
                </span>
             </div>
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Penalty :</span>
                <span className="flex-1 border-b border-black border-dotted text-center pb-0.5 font-bold text-black">
                   {sauda.shipment_penalty ? `${sauda.shipment_penalty}/Per day` : '5/Per day'}
                </span>
             </div>
          </div>
          <div className="flex gap-4 items-end">
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Marks Claim :</span>
                <span className="flex-1 border-b border-black border-dotted pb-0.5 font-bold text-black">
                   {sauda.marks_claim || ''}
                </span>
             </div>
             <div className="flex flex-1 items-end">
                <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Quantity Claim :</span>
                <span className="flex-1 border-b border-black border-dotted pb-0.5 font-bold text-black font-mono">
                   {sauda.quantity_claim || ''}
                </span>
             </div>
          </div>
          <div className="flex items-start mt-1">
             <span className="whitespace-nowrap mr-2 text-black font-bold shrink-0">Remarks :</span>
             <span className="flex-1 italic text-black font-semibold leading-snug">
                {sauda.remarks || 'Area, Agency Grade, Grade differential can change as per market.'} B.Rate - {getBrateString()} S. Date - {sauda.date ? new Date(sauda.date).toLocaleDateString('en-GB') : ''}
             </span>
          </div>
       </div>

       {/* Signatures & Footer Branding Area */}
       <div className="flex flex-col gap-2 mt-auto pt-4 mb-1 font-semibold flex-none font-sans border-t border-black/30">
          <div className="flex justify-between items-end">
             <div className="text-left pl-1">
                <p className="text-black font-bold text-[11px]">Superior / Normal (Marks)</p>
             </div>
             <div className="text-center w-40">
                <div className="w-32 border-t border-black mb-1 mx-auto"></div>
                <p className="text-black font-bold text-[11px]">Signature</p>
             </div>
          </div>
          <div className="flex justify-between items-center text-[9px] font-mono text-neutral-600 pt-1">
             <div>BALLY JUTE CO. LTD. • AUTHORIZED COMPUTER GENERATED SYSTEM CONTRACT</div>
             <div>Page 1 of 1</div>
          </div>
       </div>
    </div>
  );
}
