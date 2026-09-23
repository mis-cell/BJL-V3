// Satta-based Deduction Calculation Service
// Calculates Deduction (₹/Qtl) in Payment Section based on Satta Chart grade differentials

export interface AreaDifferential {
  area: string;
  diffs: Record<string, number>;
}

// Master Satta chart seed differentials matching the official market specification
// and the live Satta Chart configurations (including PURNEA(BIHAR) and BIHAR synonyms)
export const EXCEL_SEED_DATA: AreaDifferential[] = [
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
    area: "ASSAM",
    diffs: { "M.MID": -2000, BOT: -2100, "B.BOT": -2200, "X.X.BOT": -2350, "X.BOT": -2300 }
  },
  {
    area: "S/N MESTA",
    diffs: { "M.MID": -2000, BOT: -2100, "B.BOT": -2200, "X.BOT": -2300 }
  }
];

// Ordered standard jute grade hierarchies for grade downgrade progression
export const GRADE_SEQUENCES: string[][] = [
  ['TD3', 'TD4', 'TD5', 'TD6', 'TD7', 'TD8', 'TD9', 'TD10'],
  ['W5', 'W6', 'W7', 'LOOSE'],
  ['BTR HD KS', 'BTR HD CS', 'BTR HD BS', 'BTR NB KS', 'BTR NB FFS', 'BTR NB (SMR)'],
  ['M.S.MID', 'M.MID', 'M.BOT', 'M.B.BOT', 'M.X.BOT'],
  ['BOT', 'B.BOT', 'X.BOT', 'X.X.BOT']
];

// Module-level cache for live database differentials
let cachedSattaDiffs: any[] = [];
export const setCachedSattaDiffs = (diffs: any[]) => {
  if (Array.isArray(diffs)) {
    cachedSattaDiffs = diffs;
  }
};
export const getCachedSattaDiffs = () => cachedSattaDiffs;

// Normalize grade string (e.g. 'TD-6' -> 'TD6', 'TD 6' -> 'TD6')
export function normalizeGrade(grade?: string | null): string {
  if (!grade) return '';
  const clean = String(grade).trim().toUpperCase();
  // Strip spaces/hyphens for TD, W grades: TD-6, TD 6 -> TD6
  const tdMatch = clean.match(/^TD[\s\-_]*([0-9]+)$/i);
  if (tdMatch) return `TD${tdMatch[1]}`;
  const wMatch = clean.match(/^W[\s\-_]*([0-9]+)$/i);
  if (wMatch) return `W${wMatch[1]}`;
  return clean;
}

// Find the next sequential lower grade for a given grade
export function getNextLowerGrade(currentGrade?: string | null): string | null {
  const norm = normalizeGrade(currentGrade);
  if (!norm) return null;

  for (const seq of GRADE_SEQUENCES) {
    const idx = seq.findIndex(g => normalizeGrade(g) === norm);
    if (idx !== -1 && idx < seq.length - 1) {
      return seq[idx + 1];
    }
  }

  // Fallback pattern for TD grades: TD(n) -> TD(n+1)
  const tdNumMatch = norm.match(/^TD([0-9]+)$/);
  if (tdNumMatch) {
    const nextNum = parseInt(tdNumMatch[1], 10) + 1;
    return `TD${nextNum}`;
  }

  // Fallback pattern for W grades: W(n) -> W(n+1)
  const wNumMatch = norm.match(/^W([0-9]+)$/);
  if (wNumMatch) {
    const nextNum = parseInt(wNumMatch[1], 10) + 1;
    return `W${nextNum}`;
  }

  return null;
}

// Build candidate area names ordered by specificity to match Satta Chart records
export function getCandidateAreas(area?: string | null, agency?: string | null): string[] {
  const cleanArea = String(area || '').trim().toUpperCase();
  const cleanAgency = String(agency || '').trim().toUpperCase();

  const candidates: string[] = [];

  // Purnea / Bihar synonyms (as specified: "PURNEA(BIHAR) and Bihar Are Same")
  if (cleanArea.includes('BIHAR') || cleanArea.includes('PURNEA') || cleanAgency.includes('GULABBAGH') || cleanAgency.includes('PURNEA')) {
    if (cleanArea.includes('LOOSE')) {
      candidates.push('PURNEA (LOOSE)', 'PURNEA LOOSE', 'PURNEA(BIHAR)', 'BIHAR', 'PURNEA');
    } else {
      candidates.push('PURNEA(BIHAR)', 'PURNEA (BIHAR)', 'BIHAR', 'PURNEA', 'PURNEA (LOOSE)', 'PURNEA LOOSE');
    }
  }

  // Specific regional mappings
  if (cleanArea.includes('DAISEE')) candidates.push('DAISEE');
  if (cleanArea.includes('TULSIHATTA')) candidates.push('TULSIHATTA');
  if (cleanArea.includes('BANGLADESH')) candidates.push('BANGLADESH');
  if (cleanArea.includes('GRP LOOSE')) candidates.push('GRP LOOSE');
  if (cleanArea.includes('TARABARI')) candidates.push('L/A TARABARI', 'TARABARI');
  if (cleanArea.includes('U/ASSAM') || cleanArea.includes('UPPER ASSAM')) candidates.push('U/ASSAM', 'ASSAM');
  else if (cleanArea.includes('ASSAM')) candidates.push('ASSAM', 'U/ASSAM');
  if (cleanArea.includes('KANKI')) candidates.push('KANKI');
  if (cleanArea.includes('RAIGANJ')) {
    if (cleanArea.includes('LOOSE')) candidates.push('RAIGANJ Loose', 'RAIGANJ');
    else candidates.push('RAIGANJ', 'RAIGANJ Loose');
  }
  if (cleanArea.includes('DHULIYAAN') || cleanArea.includes('DHULIYAN')) candidates.push('DHULIYAAN');
  if (cleanArea.includes('SAMSI')) candidates.push('SAMSI JUNGLE');
  if (cleanArea.includes('NORTHERN')) candidates.push('NORTHERN', 'SEMI NORTHERN');
  if (cleanArea.includes('GAJAL')) candidates.push('GAJAL LOOSE');
  if (cleanArea.includes('BADURIA')) candidates.push('BADURIA');
  if (cleanArea.includes('BASIRHAT')) candidates.push('BASIRHAT');
  if (cleanArea.includes('GOLABRI')) candidates.push('GOLABRI D/D');
  if (cleanArea.includes('HARIPAL')) candidates.push('HARIPAL');
  if (cleanArea.includes('MAYNA')) candidates.push('MAYNA D/S');
  if (cleanArea.includes('ISLAMPUR')) candidates.push('S/N ISLAMPUR', 'ISLAMPUR');
  if (cleanArea.includes('SHEORAPHULLY')) candidates.push('SHEORAPHULLY');
  if (cleanArea.includes('MESTA')) candidates.push('GRP MESTA LOOSE', 'S/N MESTA');

  if (cleanAgency && !candidates.includes(cleanAgency)) candidates.push(cleanAgency);
  if (cleanArea && !candidates.includes(cleanArea)) candidates.push(cleanArea);

  return candidates;
}

// Retrieve differential for a specific area and grade from DB list or fallback to EXCEL_SEED_DATA
export function getSattaDiff(
  area?: string | null,
  grade?: string | null,
  agency?: string | null,
  dbDiffsList?: any[]
): { differential: number; matchedArea: string; found: boolean } {
  const normGrade = normalizeGrade(grade);
  if (!normGrade) return { differential: 0, matchedArea: '', found: false };

  const candidateAreas = getCandidateAreas(area, agency);
  const diffs = (dbDiffsList && dbDiffsList.length > 0) ? dbDiffsList : cachedSattaDiffs;

  // 1. Search in database table records (satta_differentials)
  if (diffs && diffs.length > 0) {
    for (const candArea of candidateAreas) {
      const match = diffs.find(d => {
        const dArea = String(d.area || '').trim().toUpperCase();
        const dGrade = normalizeGrade(d.grade);
        return dArea === candArea && dGrade === normGrade;
      });
      if (match && match.differential !== undefined && match.differential !== null && match.differential !== '') {
        return {
          differential: Number(match.differential),
          matchedArea: candArea,
          found: true
        };
      }
    }
  }

  // 2. Search in master EXCEL_SEED_DATA
  for (const candArea of candidateAreas) {
    const seedArea = EXCEL_SEED_DATA.find(r => r.area.trim().toUpperCase() === candArea);
    if (seedArea && seedArea.diffs) {
      const gKey = Object.keys(seedArea.diffs).find(k => normalizeGrade(k) === normGrade);
      if (gKey && seedArea.diffs[gKey] !== undefined) {
        return {
          differential: Number(seedArea.diffs[gKey]),
          matchedArea: candArea,
          found: true
        };
      }
    }
  }

  return { differential: 0, matchedArea: '', found: false };
}

export interface SattaDeductionResult {
  deduction: number;         // Calculated Deduction (₹/Qtl) = GradeDiff * (Sett% / 100)
  gradeDiff: number;         // Absolute Satta differential difference between current and lower grade
  currentGrade: string;      // Contracted / original grade (e.g. 'TD6')
  lowerGrade: string | null; // Next grade down or stock grade (e.g. 'TD7')
  currentDiff: number;       // Satta differential of current grade (e.g. -600)
  lowerDiff: number;         // Satta differential of lower grade (e.g. -1000)
  settPct: number;           // Settlement % (Claim %) (e.g. 30%)
  origRate: number;          // Original Rate (₹/Qtl)
  settRate: number;          // Settled Rate = origRate - deduction (₹/Qtl)
  explanation: string;       // Formatted explanation for tooltips & verification
}

/**
 * Calculates Deduction (₹/Qtl) for Payment Section using the Satta Chart.
 * 
 * Formula:
 * Grade Difference = |SattaDiff(ContractedGrade) - SattaDiff(NextLowerGrade)|
 * Deduction (₹/Qtl) = Grade Difference * (Settlement % / 100)
 * Sett Rate (₹/Qtl) = Original Rate (₹/Qtl) - Deduction (₹/Qtl)
 * 
 * Example provided by user:
 * Grade: TD6, Area: BIHAR (matches PURNEA(BIHAR)), Claim: 30%
 * TD6 Diff = -600 (rate 11,700), TD7 Diff = -1000 (rate 11,300)
 * Grade Difference = |-600 - (-1000)| = 400 ₹/Qtl
 * Deduction = 400 * 30% = 120 ₹/Qtl
 * Sett Rate = 11,000 - 120 = 10,880 ₹/Qtl
 */
export function calculateSattaDeduction(
  col: {
    grade?: string | null;
    area?: string | null;
    agency?: string | null;
    rate_value?: number | string | null;
    sett_pct?: number | string | null;
    gd_claim?: number | string | null;
    gd_sett?: number | string | null;
    stock_grade_name?: string | null;
    stock_grade_code?: string | null;
  },
  dbDiffsList?: any[],
  customSettPct?: number
): SattaDeductionResult {
  const currentGrade = normalizeGrade(col.grade) || 'TD6';
  const origRate = Number(col.rate_value) || 0;

  // Determine Settlement / Claim %
  let settPct = 0;
  if (customSettPct !== undefined && !isNaN(customSettPct)) {
    settPct = customSettPct;
  } else if (col.sett_pct !== undefined && col.sett_pct !== null && col.sett_pct !== "" && !isNaN(Number(col.sett_pct)) && Number(col.sett_pct) > 0) {
    settPct = Number(col.sett_pct);
  } else if (col.gd_claim !== undefined && col.gd_claim !== null && !isNaN(Number(col.gd_claim)) && Number(col.gd_claim) > 0) {
    settPct = Number(col.gd_claim);
  } else if (col.gd_sett !== undefined && col.gd_sett !== null && !isNaN(Number(col.gd_sett)) && Number(col.gd_sett) > 0) {
    settPct = Number(col.gd_sett);
  } else if (col.sett_pct !== undefined && col.sett_pct !== null && !isNaN(Number(col.sett_pct))) {
    settPct = Number(col.sett_pct);
  }

  // Determine target downgraded grade
  let lowerGrade: string | null = null;
  const stockGrade = normalizeGrade(col.stock_grade_name || col.stock_grade_code);
  if (stockGrade && stockGrade !== currentGrade) {
    lowerGrade = stockGrade;
  } else {
    lowerGrade = getNextLowerGrade(currentGrade);
  }

  if (settPct <= 0 || !lowerGrade) {
    return {
      deduction: 0,
      gradeDiff: 0,
      currentGrade,
      lowerGrade,
      currentDiff: 0,
      lowerDiff: 0,
      settPct,
      origRate,
      settRate: origRate,
      explanation: settPct <= 0 ? 'No settlement / claim % applied' : 'No lower grade in hierarchy'
    };
  }

  // Look up differentials in Satta Chart
  const currDiffRes = getSattaDiff(col.area, currentGrade, col.agency, dbDiffsList);
  const lowerDiffRes = getSattaDiff(col.area, lowerGrade, col.agency, dbDiffsList);

  const currentDiff = currDiffRes.differential;
  const lowerDiff = lowerDiffRes.differential;

  // Satta grade rate difference is the difference between differentials
  const gradeDiff = Math.abs(currentDiff - lowerDiff);

  // If grade difference found in Satta Chart, compute deduction as GradeDiff * (SettPct / 100)
  if (gradeDiff > 0) {
    const deduction = Number(((gradeDiff * settPct) / 100).toFixed(2));
    const settRate = Math.max(0, Number((origRate - deduction).toFixed(2)));
    const matchedAreaName = currDiffRes.matchedArea || lowerDiffRes.matchedArea || col.area || 'Satta Chart';

    const explanation = `Satta Chart (${matchedAreaName}): ${currentGrade} [${currentDiff >= 0 ? '+' : ''}${currentDiff}] vs ${lowerGrade} [${lowerDiff >= 0 ? '+' : ''}${lowerDiff}] = ₹${gradeDiff} Diff × ${settPct}% Claim = ₹${deduction.toFixed(2)}/Qtl`;

    return {
      deduction,
      gradeDiff,
      currentGrade,
      lowerGrade,
      currentDiff,
      lowerDiff,
      settPct,
      origRate,
      settRate,
      explanation
    };
  }

  // Fallback if no Satta differentials exist for this area/grade
  const fallbackDeduction = Number(((origRate * settPct) / 100).toFixed(2));
  const fallbackSettRate = Math.max(0, Number((origRate - fallbackDeduction).toFixed(2)));

  return {
    deduction: fallbackDeduction,
    gradeDiff: 0,
    currentGrade,
    lowerGrade,
    currentDiff: 0,
    lowerDiff: 0,
    settPct,
    origRate,
    settRate: fallbackSettRate,
    explanation: `Standard rate basis: ₹${origRate} × ${settPct}% = ₹${fallbackDeduction.toFixed(2)}/Qtl`
  };
}
