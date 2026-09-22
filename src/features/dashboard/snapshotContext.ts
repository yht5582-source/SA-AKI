import type { ClinicalSnapshot } from '../../clinical/types';

/** Tie order is an explicit display convention, never evidence that one observation supersedes another. */
export function orderSnapshots(snapshots: ClinicalSnapshot[]): ClinicalSnapshot[] {
  return [...snapshots].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id.localeCompare(b.id));
}

/** Never compare equal instants or arbitrarily choose from the most recent ambiguous earlier instant. */
export function strictlyEarlierSnapshot(current: ClinicalSnapshot, snapshots: ClinicalSnapshot[]): ClinicalSnapshot | undefined {
  const earlier = orderSnapshots(snapshots.filter(snapshot => snapshot.caseId === current.caseId && Date.parse(snapshot.timestamp) < Date.parse(current.timestamp)));
  const candidate = earlier.at(-1);
  return candidate && earlier.filter(snapshot => Date.parse(snapshot.timestamp) === Date.parse(candidate.timestamp)).length === 1 ? candidate : undefined;
}

export function duplicateSnapshotTimes(snapshots: ClinicalSnapshot[]): number[] {
  const counts = new Map<number, number>();
  for (const snapshot of snapshots) { const time = Date.parse(snapshot.timestamp); counts.set(time, (counts.get(time) ?? 0) + 1); }
  return [...counts].filter(([, count]) => count > 1).map(([time]) => time).sort((a, b) => a - b);
}
