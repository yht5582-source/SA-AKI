import { readDraft, writeDraft } from '../../src/features/assessment/draft';

afterEach(() => sessionStorage.clear());

it('converts an existing UTC draft to Taiwan display while preserving its exact recorded instant', () => {
  sessionStorage.setItem('sa-aki:assessment-draft:v1:case1', JSON.stringify({
    values: { timestamp: '2026-09-21T06:30:45.375', crrtStartedTimestamp: '2026-09-21T23:30:00.125' },
    step: 0, haEnabled: false,
  }));
  const draft = readDraft('case1');
  expect(draft.values).toMatchObject({ timestamp: '2026-09-21T14:30:45', crrtStartedTimestamp: '2026-09-22T07:30:00' });
  expect(draft.legacyTimeInstants).toMatchObject({ timestamp: '2026-09-21T06:30:45.375Z', crrtStartedTimestamp: '2026-09-21T23:30:00.125Z' });
  expect(writeDraft('case1', draft)).toBe(true);
  expect(readDraft('case1')).toEqual(draft);
});
