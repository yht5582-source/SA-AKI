import { formatTaipeiDateTime, formatTaipeiTimestamps, fromTaipeiInput, toTaipeiInput } from '../../src/clinical/taipeiTime';

it('converts a Taiwan wall time into an offset-aware instant without relying on the browser timezone', () => {
  expect(fromTaipeiInput('2026-09-21T08:30')).toBe('2026-09-21T00:30:00.000Z');
  expect(fromTaipeiInput('2026-09-21T08:30:45')).toBe('2026-09-21T00:30:45.000Z');
  expect(fromTaipeiInput('2026-09-21T99:30')).toBe('2026-09-21T99:30');
});

it('shows Taipei time to seconds without milliseconds, including midnight rollover and imported offsets', () => {
  expect(toTaipeiInput('2026-09-21T23:30:45.375Z')).toBe('2026-09-22T07:30:45');
  expect(formatTaipeiDateTime('2026-09-21T23:30:45.375Z')).toBe('2026-09-22 07:30:45（台灣時間）');
  expect(formatTaipeiDateTime('2026-09-22T07:30:45+08:00')).toBe('2026-09-22 07:30:45（台灣時間）');
  expect(formatTaipeiTimestamps('藥物 2026-09-21T07:00:00.125Z；TDM 2026-09-21T16:30:15+08:00'))
    .toBe('藥物 2026-09-21 15:00:00（台灣時間）；TDM 2026-09-21 16:30:15（台灣時間）');
});
