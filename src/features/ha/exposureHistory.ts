import type { ClinicalSnapshot, HemoadsorptionExposure } from '../../clinical/types';
import { orderSnapshots } from '../dashboard/snapshotContext';

function mergeRecords<T extends object>(earlier: T[] | undefined, later: T[] | undefined, identity: (record: T) => string, identityOnly: (record: T) => T, issues: Set<string>): T[] | undefined {
  if (!earlier && !later) return undefined;
  const records = new Map<string, { canonical: string; record: T }>();
  for (const record of [...earlier ?? [], ...later ?? []]) {
    // These schema-validated subrecords are flat; normalize timestamp spelling and key order only.
    const canonical = JSON.stringify(Object.entries(record).filter(([, value]) => value !== undefined).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, key === 'timestamp' || key.endsWith('Timestamp') ? Date.parse(String(value)) : value]));
    const id = identity(record), previous = records.get(id);
    if (!previous) records.set(id, { canonical, record });
    else if (previous.canonical !== canonical) {
      issues.add(`同一事件／採檢／給藥時間的 HA 子紀錄衝突（${JSON.stringify(identityOnly(record))}）；不可自行覆寫或判定已解除。`);
      // The source snapshots retain every variant. Count the shared identity once,
      // but do not select a disputed severity, dose or concentration as established.
      // Repeated later variants must not restore details after a conflict.
      previous.record = identityOnly(previous.record);
    }
  }
  return [...records.values()].map(item => item.record);
}

/** Documentation continuity only: no carried-forward finding becomes a current clinical assessment. */
export function reconcileHaExposures(current: ClinicalSnapshot, snapshots: ClinicalSnapshot[]) {
  const episodes = new Map<number, { exposure: HemoadsorptionExposure; stopped?: number }>();
  const issues = new Set<string>();
  const seenAt = new Set<string>();
  const currentTime = Date.parse(current.timestamp);
  for (const snapshot of orderSnapshots(snapshots).filter(item => item.caseId === current.caseId && Date.parse(item.timestamp) <= currentTime)) {
    const documentedAt = Date.parse(snapshot.timestamp);
    for (const exposure of snapshot.hemoadsorptionExposures ?? []) {
      const start = Date.parse(exposure.startedTimestamp);
      const prior = episodes.get(start);
      const recordKey = `${documentedAt}/${start}`;
      if (seenAt.has(recordKey)) issues.add('同一時間點的 HA 暴露記錄重複；需核對唯一療程。');
      seenAt.add(recordKey);
      if (start > documentedAt) issues.add('HA 開始時間晚於記錄時間，暴露時序需核對。');
      if (prior && (prior.exposure.device !== exposure.device || prior.exposure.targetAdsorbate !== exposure.targetAdsorbate)) {
        issues.add('相同 HA 開始時間的裝置／目標記錄衝突；不可自動選擇其中一筆。');
      }
      let stopped = prior?.stopped;
      if (exposure.stoppedTimestamp) {
        const stop = Date.parse(exposure.stoppedTimestamp);
        if (!Number.isFinite(stop) || stop < start || stop > documentedAt) issues.add('HA 停止時間無效或晚於記錄時間；不能視為已停止。');
        else {
          if (stopped !== undefined && stopped !== stop) issues.add('HA 停止時間記錄衝突；請核對實際停機時間。');
          stopped = stopped === undefined ? stop : Math.min(stopped, stop);
        }
      } else if (stopped !== undefined && documentedAt > stopped) {
        issues.add('已停止 HA 療程又被記錄為活動暴露；需釐清新療程或資料衝突。');
      }
      const history = prior?.exposure;
      const cartridgeTimes = history?.cartridgeChangeTimestamps || exposure.cartridgeChangeTimestamps
        ? [...new Map([...history?.cartridgeChangeTimestamps ?? [], ...exposure.cartridgeChangeTimestamps ?? []].map(timestamp => [Date.parse(timestamp), timestamp])).values()] : undefined;
      episodes.set(start, { exposure: {
        ...exposure, stoppedTimestamp: stopped === undefined ? undefined : new Date(stopped).toISOString(),
        cartridgeChangeTimestamps: cartridgeTimes,
        drugExposures: mergeRecords(history?.drugExposures, exposure.drugExposures, record => `${record.drugName}/${Date.parse(record.administeredTimestamp)}`,
          record => ({ drugName: record.drugName, administeredTimestamp: record.administeredTimestamp }), issues),
        therapeuticDrugMonitoring: mergeRecords(history?.therapeuticDrugMonitoring, exposure.therapeuticDrugMonitoring, record => `${record.drugName}/${Date.parse(record.sampledTimestamp)}`,
          record => ({ drugName: record.drugName, sampledTimestamp: record.sampledTimestamp }), issues),
        adverseEvents: mergeRecords(history?.adverseEvents, exposure.adverseEvents, record => `${record.kind}/${Date.parse(record.timestamp)}`,
          record => ({ kind: record.kind, timestamp: record.timestamp }), issues),
      }, stopped });
    }
  }
  const active = [...episodes.values()].filter(episode => episode.stopped === undefined).map(episode => episode.exposure);
  for (const exposure of active) {
    if (!(current.hemoadsorptionExposures ?? []).some(item => Date.parse(item.startedTimestamp) === Date.parse(exposure.startedTimestamp))) {
      issues.add('目前時間點未重新記錄先前活動 HA 暴露；未記錄不等於停止，請立即核對目前治療。');
    }
  }
  if (active.length > 1) issues.add('多個活動 HA 暴露；療程重疊或重複需臨床核對。');
  return { active, issues: [...issues] };
}
