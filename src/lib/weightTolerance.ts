/**
 * Sauda Weight Acceptance Policy & Tolerance Calculation
 * 
 * Business Rules:
 * 1. BALE-SPECIFIC TOLERANCE (Unit / Lorry = 'BALES' - case-insensitive):
 *    - 3% of Sauda Quantity (in MT) OR 1500 KG (1.500 MT), whichever tolerance is LOWER.
 *      Allowed Tolerance = MIN(3% of Sauda Quantity, 1.500 MT)
 *    - Minimum Acceptable Weight = Sauda Quantity - Allowed Tolerance
 *    - Maximum Acceptable Weight = Sauda Quantity + Allowed Tolerance
 *    - Within range [Minimum Acceptable, Maximum Acceptable] => Status = 'completed' (COMPLETED)
 *    - Outside range => Status = 'mismatch' (WEIGHT MISMATCH / NOT ACCEPTABLE) or 'partial' (PARTIAL)
 * 
 * 2. NON-BALE UNITS (Unit / Lorry ≠ 'BALES', e.g. KG, MT, TON, LORRY, DRUMS):
 *    - Do NOT apply the 3% / 1500 KG rule.
 *    - Follow existing standard validation logic (completed when received weight meets contract weight).
 */

export interface WeightToleranceResult {
  contractMt: number;
  receivedMt: number;
  contractQtl: number;
  receivedQtl: number;
  diffMt: number;
  diffQtl: number;
  absDiffMt: number;
  absDiffQtl: number;
  unit: string;
  isBales: boolean;
  pct3Mt: number;
  pct3Qtl: number;
  fixedToleranceMt: number;
  fixedToleranceQtl: number;
  toleranceMt: number;
  toleranceQtl: number;
  tolerancePct: number;
  toleranceBasis: '3% (Lower)' | '1500 KG (Lower)' | 'Standard';
  minAcceptableMt: number;
  maxAcceptableMt: number;
  minAcceptableQtl: number;
  maxAcceptableQtl: number;
  excessOverToleranceMt: number;
  excessOverToleranceQtl: number;
  excessOverContractMt: number;
  excessOverContractQtl: number;
  shortUnderToleranceMt: number;
  shortUnderToleranceQtl: number;
  deductibleQtyMt: number;
  deductibleQtyQtl: number;
  policyStatus: 'Within Tolerance – No Deduction' | 'Excess Deduction' | 'Short Deduction' | 'Pending Arrival';
  isAcceptable: boolean;
  isCompleted: boolean;
  isUnderDelivery: boolean;
  isOverDelivery: boolean;
  status: 'completed' | 'partial' | 'pending' | 'mismatch';
  statusLabel: 'COMPLETED' | 'PARTIAL' | 'PENDING' | 'WEIGHT MISMATCH';
  formattedTolerance: string; // e.g. "±1.500 MT (15.00 Qtl)"
  formattedRange: string;     // e.g. "63.502 – 66.502 MT (635.02 – 665.02 Qtl)"
}

export function isBaleUnit(unit: string | null | undefined): boolean {
  if (!unit) return false;
  const u = String(unit).trim().toUpperCase();
  return u === 'BALES' || u === 'BALE';
}

export function calculateWeightTolerance(
  contractWeight: number | string | null | undefined,
  receivedWeight: number | string | null | undefined,
  unit?: string | null | undefined
): WeightToleranceResult {
  const contractMt = Math.max(0, parseFloat(String(contractWeight ?? 0)) || 0);
  const receivedMt = Math.max(0, parseFloat(String(receivedWeight ?? 0)) || 0);
  const unitStr = String(unit || 'BALES').trim().toUpperCase();
  const isBales = isBaleUnit(unitStr);

  const contractQtl = contractMt * 10;
  const receivedQtl = receivedMt * 10;
  const diffMt = receivedMt - contractMt;
  const diffQtl = receivedQtl - contractQtl;
  const absDiffMt = Math.abs(diffMt);
  const absDiffQtl = Math.abs(diffQtl);

  // 3% of contract quantity in MT & Qtl
  const pct3Mt = contractMt * 0.03;
  const pct3Qtl = contractQtl * 0.03;
  const fixedToleranceMt = 1.5; // 1500 KG = 15 Quintal = 1.500 MT
  const fixedToleranceQtl = 15.0; // 1500 KG = 15 Quintal

  // Allowed Tolerance = Lower of (3% of Sauda Quantity) or 1,500 kg (15 Quintal / 1.500 MT)
  const toleranceMt = contractMt > 0 ? Math.min(pct3Mt, fixedToleranceMt) : 0;
  const toleranceQtl = contractQtl > 0 ? Math.min(pct3Qtl, fixedToleranceQtl) : 0;
  const tolerancePct = contractMt > 0 ? (toleranceMt / contractMt) * 100 : 0;
  const toleranceBasis = contractMt > 0 
    ? (pct3Mt <= fixedToleranceMt ? '3% (Lower)' : '1500 KG (Lower)')
    : 'Standard';

  const minAcceptableMt = Math.max(0, contractMt - toleranceMt);
  const maxAcceptableMt = contractMt + toleranceMt;
  const minAcceptableQtl = Math.max(0, contractQtl - toleranceQtl);
  const maxAcceptableQtl = contractQtl + toleranceQtl;

  const isWithinTolerance = contractMt > 0 && receivedMt >= (minAcceptableMt - 0.0001) && receivedMt <= (maxAcceptableMt + 0.0001);
  const isOverDelivery = contractMt > 0 && receivedMt > (maxAcceptableMt + 0.0001);
  const isUnderDelivery = contractMt > 0 && receivedMt > 0 && receivedMt < (minAcceptableMt - 0.0001);

  const excessOverToleranceMt = isOverDelivery ? Math.max(0, receivedMt - maxAcceptableMt) : 0;
  const excessOverToleranceQtl = isOverDelivery ? Math.max(0, receivedQtl - maxAcceptableQtl) : 0;
  const excessOverContractMt = receivedMt > contractMt ? Math.max(0, receivedMt - contractMt) : 0;
  const excessOverContractQtl = receivedQtl > contractQtl ? Math.max(0, receivedQtl - contractQtl) : 0;
  const shortUnderToleranceMt = isUnderDelivery ? Math.max(0, minAcceptableMt - receivedMt) : 0;
  const shortUnderToleranceQtl = isUnderDelivery ? Math.max(0, minAcceptableQtl - receivedQtl) : 0;

  // Deductible Quantity = Excess/Short Difference − Allowed Tolerance
  // Deduct only the quantity exceeding the allowed tolerance
  const deductibleQtyQtl = isWithinTolerance 
    ? 0 
    : Math.max(0, absDiffQtl - toleranceQtl);
  const deductibleQtyMt = deductibleQtyQtl / 10;

  let policyStatus: 'Within Tolerance – No Deduction' | 'Excess Deduction' | 'Short Deduction' | 'Pending Arrival' = 'Pending Arrival';
  if (contractMt === 0 || receivedMt === 0) {
    policyStatus = 'Pending Arrival';
  } else if (isWithinTolerance) {
    policyStatus = 'Within Tolerance – No Deduction';
  } else if (isOverDelivery) {
    policyStatus = 'Excess Deduction';
  } else if (isUnderDelivery) {
    policyStatus = 'Short Deduction';
  }

  let status: 'completed' | 'partial' | 'pending' | 'mismatch' = 'pending';
  let statusLabel: 'COMPLETED' | 'PARTIAL' | 'PENDING' | 'WEIGHT MISMATCH' = 'PENDING';

  if (contractMt > 0) {
    if (isWithinTolerance) {
      status = 'completed';
      statusLabel = 'COMPLETED';
    } else if (isOverDelivery) {
      status = 'mismatch';
      statusLabel = 'WEIGHT MISMATCH';
    } else if (receivedMt > 0) {
      status = 'partial';
      statusLabel = 'PARTIAL';
    } else {
      status = 'pending';
      statusLabel = 'PENDING';
    }
  }

  return {
    contractMt,
    receivedMt,
    contractQtl,
    receivedQtl,
    diffMt,
    diffQtl,
    absDiffMt,
    absDiffQtl,
    unit: unitStr,
    isBales,
    pct3Mt,
    pct3Qtl,
    fixedToleranceMt,
    fixedToleranceQtl,
    toleranceMt,
    toleranceQtl,
    tolerancePct,
    toleranceBasis,
    minAcceptableMt,
    maxAcceptableMt,
    minAcceptableQtl,
    maxAcceptableQtl,
    excessOverToleranceMt,
    excessOverToleranceQtl,
    excessOverContractMt,
    excessOverContractQtl,
    shortUnderToleranceMt,
    shortUnderToleranceQtl,
    deductibleQtyMt,
    deductibleQtyQtl,
    policyStatus,
    isAcceptable: isWithinTolerance,
    isCompleted: isWithinTolerance,
    isUnderDelivery,
    isOverDelivery,
    status,
    statusLabel,
    formattedTolerance: `±${toleranceQtl.toFixed(2)} Qtl (${toleranceMt.toFixed(3)} MT)`,
    formattedRange: `${minAcceptableQtl.toFixed(2)} – ${maxAcceptableQtl.toFixed(2)} Qtl (${minAcceptableMt.toFixed(3)} – ${maxAcceptableMt.toFixed(3)} MT)`
  };
}
