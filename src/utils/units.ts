import type { Sex } from '../clinical/types';

const isPositiveFinite = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value > 0;

/** Returns mL/kg/h. Missing/invalid measurements are unknown; measured zero is zero. */
export function normalizeUrineOutput({ volumeMl, hours, weightKg }: {
  volumeMl?: number;
  hours?: number;
  weightKg?: number;
}): number | undefined {
  if (volumeMl === undefined || !Number.isFinite(volumeMl) || volumeMl < 0
    || !isPositiveFinite(hours) || !isPositiveFinite(weightKg)) return undefined;
  const normalized = volumeMl / hours / weightKg;
  return Number.isFinite(normalized) && (normalized > 0 || volumeMl === 0) ? normalized : undefined;
}

/**
 * Devine arithmetic in kg; not a recommendation to select ideal weight.
 * Local safety boundary: do not extrapolate below 60 inches or infer sex.
 */
export function calculateIdealBodyWeight(heightCm: number | undefined, sex: Sex | undefined): number | undefined {
  if (!isPositiveFinite(heightCm) || heightCm < 152.4 || (sex !== 'male' && sex !== 'female')) return undefined;
  const weightKg = (sex === 'male' ? 50 : 45.5) + 2.3 * (heightCm / 2.54 - 60);
  return Number.isFinite(weightKg) ? weightKg : undefined;
}

/**
 * IBW + 0.4 × (actual − IBW), in kg. Caller explicitly selects the weight basis.
 * No obesity threshold or automatic CRRT/urine-output denominator selection.
 */
export function calculateAdjustedBodyWeight(actualWeightKg: number | undefined, idealWeightKg: number | undefined): number | undefined {
  if (!isPositiveFinite(actualWeightKg) || !isPositiveFinite(idealWeightKg) || actualWeightKg < idealWeightKg) return undefined;
  return idealWeightKg + 0.4 * (actualWeightKg - idealWeightKg);
}
