import { evaluateDemoTimepoint } from '../../src/features/demo/evaluateDemo';
import { demoCases, demoExport, findDemoCase } from '../../src/features/demo/demoCases';
import { caseExportSchema, assertNoDirectIdentifiers } from '../../src/data/schema';

const out = (id: string, index: number) => {
  const { outputs, decisions } = evaluateDemoTimepoint(findDemoCase(id)!, index);
  return { text: (label: string) => outputs.find(item => item.label === label)?.text ?? '', decision: (rule: string) => decisions.find(item => item.id === rule) };
};

it('every demo case passes the same import validation as a real case and carries no identifiers', () => {
  expect(demoCases).toHaveLength(6);
  for (const demo of demoCases) {
    expect(() => caseExportSchema.parse(demoExport(demo))).not.toThrow();
    expect(() => assertNoDirectIdentifiers(demoExport(demo))).not.toThrow();
    for (const point of demo.timepoints) expect(point.prompt && point.story && point.teaching).toBeTruthy();
  }
});

describe('T1 monitored deferral', () => {
  it('allows a monitored challenge only when response, tolerance and perfusion need agree', () => {
    expect(out('demo-t1', 0).text('輸液計畫')).toContain('可考慮小量監測 fluid challenge');
  });
  it('reaches KDIGO stage 3 without a dialysis recommendation', () => {
    const point = out('demo-t1', 1);
    expect(point.text('AKI 分期')).toContain('KDIGO stage 3');
    expect(point.text('是否透析')).toContain('目前不建議開始透析');
    expect(point.text('透析模式')).toContain('尚不選定');
  });
  it('still has no indication after urine recovers', () => {
    expect(out('demo-t1', 2).text('是否透析')).toContain('目前不建議開始透析');
  });
});

describe('T2 refractory hyperkalemia', () => {
  it('screens K 6.4 as urgent confirmation, not automatic dialysis', () => {
    expect(out('demo-t2', 0).text('是否透析')).toContain('立即確認是否需要透析');
  });
  it('recommends urgent KRT at KDIGO stage 2 and CRRT discussion when unstable', () => {
    const point = out('demo-t2', 1);
    expect(point.text('AKI 分期')).toContain('KDIGO stage 2');
    expect(point.text('是否透析')).toContain('建議立即評估啟動透析');
    expect(point.text('透析模式')).toContain('優先討論 CRRT');
  });
});

describe('T3 fluid conflict and prescription', () => {
  it('blocks fluid when responsive but intolerant', () => {
    const point = out('demo-t3', 0);
    expect(point.text('輸液計畫')).toContain('responsiveness 與 tolerance 衝突');
    expect(point.text('是否透析')).toContain('立即確認是否需要透析');
  });
  it('confirms refractory edema and keeps UFNET 0 while perfusion is uncertain', () => {
    const point = out('demo-t3', 1);
    expect(point.text('是否透析')).toContain('建議立即評估啟動透析');
    expect(point.text('透析模式')).toContain('優先討論 CRRT');
    expect(point.text('淨脫水')).toContain('UFNET 0');
  });
  it('matches the narrated arithmetic and reaches evacuation', () => {
    const point = out('demo-t3', 2);
    const evidence = point.decision('crrt-prescription-safety')!.evidence.join('\n');
    expect(evidence).toContain('目前設定 effluent：2300 mL/h');
    expect(evidence).toContain('處方安全 checklist：complete');
    const dose = point.decision('crrt-delivered-dose')!;
    expect(dose.evidence[0]).toContain('configured estimate 23.8');
    expect(dose.evidence[0]).toContain('observed 19.5');
    expect(dose.severity).toBe('warning');
    expect(point.text('ROSE 階段')).toContain('evacuation');
    expect(point.text('淨脫水')).toContain('可考慮漸進去復甦');
    expect(point.decision('crrt-anticoagulation')!.conclusion).toContain('Conditional RCA review');
    expect(point.text('是否透析')).toBe('');
    expect(point.text('適應症複核（已在 CRRT 中）')).toContain('仍有危險訊號');
  });
});

describe('T4 liberation', () => {
  it('walks continue → supervised trial-off → observation → restart', () => {
    expect(out('demo-t4', 0).text('CRRT 脫離')).toContain('尚不支持脫離');
    expect(out('demo-t4', 1).text('CRRT 脫離')).toContain('監督下試停');
    const off = out('demo-t4', 2).decision('crrt-liberation-review')!;
    expect(off.actions[0]).toContain('目前已記錄 trial-off');
    expect(out('demo-t4', 3).text('CRRT 脫離')).toContain('重啟觸發');
  });
});

describe('T5 provisional stage and uremic pericarditis', () => {
  it('labels an unreliable baseline provisional, then confirms it on serial measurements', () => {
    expect(out('demo-t5', 0).text('AKI 分期')).toContain('暫定 KDIGO stage 3');
    const later = out('demo-t5', 1);
    expect(later.text('AKI 分期')).toMatch(/^KDIGO stage 3/);
    expect(later.text('是否透析')).toContain('建議立即評估啟動透析');
    expect(later.text('透析模式')).toContain('優先討論 IHD');
  });
});

describe('T6 data conflict and HA gates', () => {
  it('withholds a mode on a conflicting stable label', () => {
    const point = out('demo-t6', 0);
    expect(point.text('是否透析')).toContain('建議立即評估啟動透析');
    expect(point.text('透析模式')).toContain('模式資料互相衝突');
  });
  it('resolves to CRRT once corrected and never produces an HA device match', () => {
    const point = out('demo-t6', 1);
    expect(point.text('透析模式')).toContain('優先討論 CRRT');
    expect(point.decision('ha-device-match')).toBeUndefined();
    expect(point.decision('ha-not-routine')?.conclusion).toContain('conditional against routine');
  });
});
