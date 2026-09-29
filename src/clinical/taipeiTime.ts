const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1_000;

/** Form values are Taiwan wall time, independent of the device timezone. */
export function fromTaipeiInput(raw: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw)) return raw;
  const parsed = Date.parse(`${raw}+08:00`);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : raw;
}

export function toTaipeiInput(instant: string): string {
  const parsed = Date.parse(instant);
  return Number.isFinite(parsed) ? new Date(parsed + TAIPEI_OFFSET_MS).toISOString().slice(0, 19) : instant;
}

export function formatTaipeiDateTime(instant: string): string {
  const parsed = Date.parse(instant);
  return Number.isFinite(parsed) ? `${toTaipeiInput(instant).replace('T', ' ')}（台灣時間）` : '無效時間';
}

/** Display only. Never use this to change recorded instants or exported JSON. */
export function formatTaipeiTimestamps(text: string): string {
  return text.replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})\b/g,
    instant => formatTaipeiDateTime(instant));
}
