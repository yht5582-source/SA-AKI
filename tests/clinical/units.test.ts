import { calculateAdjustedBodyWeight, calculateIdealBodyWeight, normalizeUrineOutput } from '../../src/utils/units';

describe('urine output normalization (mL/kg/h)', () => {
  it.each([
    [{ volumeMl: 180, hours: 6, weightKg: 60 }, 0.5],
    [{ volumeMl: 0, hours: 6, weightKg: 60 }, 0],
    [{ volumeMl: 180, hours: 12, weightKg: 60 }, 0.25],
  ])('normalizes observed volume without replacing anuria', (input, expected) => {
    expect(normalizeUrineOutput(input)).toBeCloseTo(expected);
  });

  it.each([
    {}, { volumeMl: 180 }, { volumeMl: 180, hours: 6 },
    { volumeMl: -1, hours: 6, weightKg: 60 },
    { volumeMl: 180, hours: 0, weightKg: 60 },
    { volumeMl: 180, hours: -1, weightKg: 60 },
    { volumeMl: 180, hours: 6, weightKg: 0 },
    { volumeMl: 180, hours: 6, weightKg: -1 },
    { volumeMl: NaN, hours: 6, weightKg: 60 },
    { volumeMl: 180, hours: Infinity, weightKg: 60 },
    { volumeMl: 180, hours: 6, weightKg: Infinity },
  ])('leaves missing or invalid measurements unknown: %j', input => {
    expect(normalizeUrineOutput(input)).toBeUndefined();
  });

  it('does not turn numeric underflow into measured anuria', () => {
    expect(normalizeUrineOutput({ volumeMl: Number.MIN_VALUE, hours: 6, weightKg: 60 })).toBeUndefined();
  });
});

describe('explicit adult weight arithmetic, never weight-basis selection', () => {
  it.each([
    ['male', 152.4, 50], ['female', 152.4, 45.5],
    ['male', 177.8, 73], ['female', 177.8, 68.5],
  ] as const)('uses the Devine %s coefficient at %s cm', (sex, heightCm, expected) => {
    expect(calculateIdealBodyWeight(heightCm, sex)).toBeCloseTo(expected);
  });

  it.each([undefined, 0, -1, NaN, Infinity, 150])('does not extrapolate missing/invalid or below-60-inch heights: %s', heightCm => {
    expect(calculateIdealBodyWeight(heightCm, 'male')).toBeUndefined();
  });

  it('does not infer a sex-specific coefficient', () => {
    expect(calculateIdealBodyWeight(177.8, undefined)).toBeUndefined();
    expect(calculateIdealBodyWeight(177.8, 'intersex')).toBeUndefined();
  });

  it('uses the explicit adjusted-weight arithmetic for marked obesity', () => {
    expect(calculateAdjustedBodyWeight(120, 70)).toBe(90);
  });

  it('does not silently raise an underweight adult to ideal weight', () => {
    expect(calculateAdjustedBodyWeight(60, 70)).toBeUndefined();
  });

  it.each([[undefined, 70], [120, undefined], [0, 70], [120, 0], [NaN, 70], [120, Infinity], [-1, 70]])('leaves invalid weight inputs unknown: %s / %s', (actual, ideal) => {
    expect(calculateAdjustedBodyWeight(actual, ideal)).toBeUndefined();
  });
});
