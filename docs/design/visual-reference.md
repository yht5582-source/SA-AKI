# Binding visual reference — SA-AKI Clinical Navigator

Approval date: 2026-09-21.
Decision: the user explicitly approved BOTH concepts. Desktop and mobile are equally binding; neither is an optional inspiration image.

| Surface | Approved reference | Native dimensions |
|---|---|---|
| Desktop command center | [desktop-command-center.png](concepts/desktop-command-center.png) | 1586 × 992 pixels |
| Mobile assessment wizard | [mobile-assessment-wizard.png](concepts/mobile-assessment-wizard.png) | 941 × 1672 pixels (approximately 430 × 764 CSS pixels) |

Preserve the exact mandatory copy, hierarchy, navy/teal/amber direction, desktop three-column workspace, and mobile eight-step wizard. Render all text/controls natively, never as a screenshot background. Raster noise and antialiasing are not intended effects. New clinical behavior belongs to subsequent implementation tasks; never imply this shell makes a validated clinical judgment.

Safety-copy override approved in Task 1 review fix round 1 (2026-09-21): the existing shared safety strip must additionally display `不適用於兒科、孕婦及新生兒` and `不可取代臨床判斷` on both desktop and mobile. These explicit population exclusions and clinical-judgment boundary take precedence over the concepts' shorter wording. Keep the original `臨床決策支援，非自動醫囑` as the primary line and the additions as secondary text within the same pale-blue region; do not add a new panel or change the hierarchy.

Task 1 scope: native editable numeric/date fields, in-page navigation, and native disclosure. Unimplemented creation, saving, timepoint addition, and future-module controls are disabled until their owning tasks. This preserves the approved labels without pretending those operations work. There is no persistence yet. Native date-picker affordances and CSS keyboard focus rings are functional/accessibility necessities.

The following copy inventory is the allowed visible-copy list for the initial desktop/mobile states. Only content already present here or explicitly required by the authoritative spec may appear above the fold. Additional states require review within their owning task.

## Design rationale

The desktop is a clinical command center, not a marketing wrapper: navy navigation, a white identity/action header, a safety boundary, and one three-column working surface. The clinician can inspect inputs, provisional judgment, and the 0–72-hour sequence simultaneously. Hairline separators organize the workspace without nesting everything in cards.

The mobile view transforms those three columns into an eight-step assessment flow. It shows AKI step 2 with a compact paired-field form, the current provisional judgment, missing inputs, next action, and an anchored previous/save-and-continue action area. It preserves the desktop's semantic hierarchy and navy/teal/amber language without squeezing the desktop sidebar onto the phone.

The anonymous A-001 sample intentionally has no invented clinical measurements. Incomplete data are labeled as incomplete, never as normal. There is no unsupported diagnosis, treatment order, mortality estimate, invented trajectory, or claim of clinical approval. The timeline is an empty sequence of expected time points, not a precise data chart. HA is separated as an opt-in, unenabled rescue assessment with a non-routine warning, rather than recommended as part of ordinary AKI care.

The main design motifs are: navy command rail/header; a persistent pale-blue safety band; open ruled sections; and one amber-labeled provisional judgment. Decorative medical images, AI personas, chat UI, account controls, and patient-identifying fields are absent.

## Exact visible-copy audit

Manual visual audit of the final native-size images; this is a raster inspection, not OCR or a DOM test.

| Required literal | Desktop | Mobile |
|---|---|---|
| `SA-AKI Clinical Navigator` | Present in white top header | Present in navy header, deliberate line break before Navigator |
| `新增匿名病例` | Present in top-right teal button | Present in case utility row |
| `目前判斷` | Present at top of judgment column | Present in amber judgment region |
| `缺失資料` | Present above missing-data list | Present below judgment region |
| `下一步` | Present above next-action region | Present below missing-data region |
| `臨床決策支援，非自動醫囑` | Present in pale-blue safety band | Present in pale-blue safety band |

Additional desktop visible-copy inventory, reading order:

- Identity/chrome: `SA-AKI`; `成人醫護人員專用`; `匿名病例 A-001`; `評估時間點 0 h`; `新增時間點`.
- Navigation: `病例總覽`; `決策首頁`; `逐步評估`; `病程趨勢`; `床邊摘要`; `HA 救援評估`; `選配・未啟用` (rendered separator spacing is typographic); `證據與版本`; `資料管理`; `資料只存在本機`.
- Status legend: `立即處理`; `需重評`; `持續監測`; `穩定`. Active judgment is amber, not critical red.
- Input region: `目前輸入`; `AKI`; `灌流`; `KRT`; `腎功能與尿量`; `基準 SCr`; `來源與可信度尚未記錄`; `目前 SCr`; `尿量`; `觀察時數`; `體重基準`; `利尿劑使用`; `尚未記錄`; `時間關係`; `Sepsis 起始時間`; `AKI 起始時間`; `補齊評估資料`. Empty em-dash-like placeholders; units `mg/dL`, `mL`, `h`, `kg`.
- Judgment region: `需重評`; `資料不足，尚無法完成分期`; `AKI / SA-AKI 判斷待完成`; `判斷依據`; `SCr 與尿量需雙軌評估`; `需確認 sepsis 與 AKI 時間關係`.
- Missing-data list: `基準 SCr 與資料來源`; `尿量、觀察時數與體重基準`; `Sepsis 與 AKI 起始時間`, with numbered markers 1–3.
- Action/evidence: `補齊缺失資料後重新評估`; `重評時間：待臨床確認`; `哪些變化會改變判斷？`; `查看規則與來源`; `內容審查：待完成`.
- Trajectory: `0–72 小時病程`; `0 h`, `6 h`, `12 h`, `24 h`, `48 h`, `72 h`; `目前時間點`; `尚無資料`; `趨勢摘要`; `新增至少兩個時間點後比較病程`; `查看病程趨勢`.
- HA note: `HA 非常規治療路徑`; `僅由使用者主動進入救援評估`.
- Footer: `成人專用｜匿名資料｜臨床內容尚待專業審查`; `概念示意 · 非真實病例`. Divider glyph spacing is visual rather than a content change.

Additional mobile visible-copy inventory:

- `成人醫護人員專用`; `匿名病例 A-001`; `步驟 2 / 8`; `AKI 評估`.
- `腎功能與尿量`; `請記錄數值、觀察時數與體重基準`.
- `基準 SCr`; `目前 SCr`; `尿量`; `觀察時數`; `體重基準`; `利尿劑使用`; `尚未記錄`; `mg/dL`; `mL`; `h`; `kg`; empty em-dash-like placeholders.
- `基準 SCr 來源與可信度尚未記錄`.
- `需重評`; `資料不足，尚無法完成分期`; `SCr、尿量資料與起始時間`; `補齊資料後重新評估`; `重評時間：待臨床確認`.
- `上一步`; `儲存並繼續`; `資料只存在本機 · 概念示意`.

All six mandated strings are readable and present. Other copy above is a transcription of the visible concept, with ordinary punctuation spacing normalized for implementation inventory. The images are not a substitute for exact code-native text in the future app.

## Desktop component inventory

1. Full-height fixed navy navigation rail with compass-like brand mark, eight navigation entries, active teal row, lower local-storage note.
2. White product header with title/subtitle and create-anonymous-case primary action.
3. Case/time utility band, add-timepoint outline button, and persistent safety strip.
4. Page heading with four semantic state symbols and text labels.
5. Single bordered work surface split into input/judgment/trajectory columns by fine vertical rules.
6. Input module tab strip, labeled blank inputs with explicit units, dropdown, date/time fields, form-section divider, outlined completion action.
7. Judgment heading, amber provisional-state region, evidence bullets, numbered missing-data list, next action/reassessment text, counterfactual disclosure, source link and review metadata.
8. Vertical timepoint rail with selected first node and five empty future nodes, empty trend summary, trend-navigation action.
9. HA non-routine informational note.
10. Adult/anonymous/pending-review/concept footer.

## Mobile component inventory

1. Solid navy compact masthead with menu icon, two-line brand title, clinician-only subtitle, plus icon button.
2. White case utility row and create-case text action.
3. Full-width safety strip.
4. Eight-segment progress indicator with 2 / 8 and AKI assessment label.
5. Main form heading, helper text, two-column control rows, provenance helper.
6. Amber provisional-state region followed by open missing-data and next-action sections.
7. Anchored white footer with previous and save/continue actions plus local-data/concept note.
8. No desktop sidebar, redundant mobile tab bar, floating chat, or decorative imagery.

## Palette, typography, and container model

Tokens below are the intended palette from the generation brief, visually consistent with the final images; they are approximate design extraction, not measured CSS values:

| Role | Intended value |
|---|---|
| Navy rail/header | #122C3F |
| Teal active navigation/CTA | #087F83 |
| Main workspace | #F4F7F9, cool gray, not cream |
| Inputs/panels/footer | #FFFFFF, true white |
| Main ink | #142E40 |
| Muted text | #60717D |
| Borders | #DCE4E9 |
| Pale-blue safety strip | #E6F3F6 |
| Amber text/status | #A76612 |
| Pale amber region | #FFF7E8 |
| Critical | Reserved red, visible only as tiny legend reference in this sample |
| Monitor / stable | Blue outlined circle / green checked circle with text |

Typography: Noto Sans TC-like Traditional Chinese sans serif with Inter-like Latin numerals/abbreviations. Future implementation should use an available licensed TC family with system fallbacks, not rasterize labels. Desktop title roughly 36px at native concept scale, major headings 24–28px, region headings 20–24px, labels/body 16–18px, metadata 13–15px. Mobile is a high-density source image at about 2.2× a 430px-wide layout; target CSS sizes should remain approximately 18–20px brand, 24px content heading, 14–16px labels/body, and 12–13px metadata, rather than using source-image pixel sizes literally. Medium/bold headings, regular body; comfortable Chinese line heights; tabular numerals for future measurements.

Geometry: desktop approximately 220px native rail, compact 86px header and 80px case band, roughly 24px workspace gutters, 1px dividers; left-to-right workspace columns about 33% / 38% / 29% of the available panel width. Actual generated image geometry takes precedence over requested percentages if later approved. Mobile approximately 16px CSS horizontal gutters, paired controls with balanced gutters, adequate separation between form and judgment. Controls and highlighted regions have small 6–8px-equivalent radii. Broad flat surfaces, no elevation-based card hierarchy. The mobile cleanup significantly removed the v1 cloudy/blurred texture; minor raster antialiasing/tonal variation is not an intended visual effect.

Motion: no motion is depicted or approved. Any later motion should be subtle state transition only and respect reduced motion; not part of this concept gate.

## Icon inventory

The source style is generally Lucide-like outline icons with rounded caps and approximately 1.75–2px-equivalent stroke, mostly 18–24px-equivalent, aligned optically beside labels with 8–12px gaps. Exact icons must be checked against approved images before implementation; not every generated icon maps one-to-one to Lucide.

| Icon / glyph | Meaning and location | Treatment |
|---|---|---|
| Four-point compass/circle mark | Desktop product brand | Custom pale-blue/white geometric compass, large, no background container |
| House | Case overview navigation | White outline, about 24px |
| Square document/list | Decision navigation / judgment heading | White outline in rail; navy in content |
| Bulleted list | Wizard navigation | White outline |
| Connected line-chart nodes | Trend navigation | White outline |
| Page/document | Bedside summary; case label; complete-input action | Outline, white/navy/teal according to context |
| Life buoy | Optional HA rescue navigation | White outline |
| Open book | Evidence navigation/source footer | Outline white in rail, navy in content |
| Cog | Data management | White outline |
| Laptop | Local-storage note | Small white outline |
| Plus | New case buttons, mobile utility action | White or teal, centered, button-associated |
| Clock | Current timepoint, add timepoint | Navy outline circle |
| Shield with check | Safety boundary | Navy desktop / teal mobile outline |
| Pencil | Input-region heading | Navy outline |
| Calendar | Desktop start-time inputs | Muted outline, right aligned |
| Chevron down | Dropdown and counterfactual disclosure | Muted/navy outline |
| Red filled circle | Immediate-risk legend | Tiny red symbol plus text; not active case severity |
| Amber warning triangle | Reassessment legend and missing-data/judgment status | Outline for legend/list/mobile, filled for desktop state callout |
| Blue hollow circle | Monitor legend | Blue outline plus text |
| Green circle/check | Stable legend | Filled green circle with white check plus text |
| Number circles 1–3 | Missing-data ordered list | Pale amber filled circles, dark numerals |
| Right arrow in circle | Desktop next-action heading | Navy filled circle, white arrow |
| Question mark circle | Counterfactual disclosure | Navy outline |
| External-link square/arrow | Rules/source link | Blue outline |
| Vertical bars | Trend-summary heading | Navy filled bars |
| Rising trend arrow | View-trend action | Teal outline |
| Information circle | HA warning | Blue outline |
| Hollow timeline nodes | Expected timepoints | Gray outlines; active 0h has teal double-ring emphasis |
| Hamburger | Mobile navigation trigger | White outline, no circle |
| Plus in rounded square | Mobile header creation trigger | White outline |
| Eight horizontal segments | Wizard progress | First two teal, six gray; explicit 2 / 8 text |
| Right arrow | Mobile save-and-continue | White outline |

Only selected states are pictured: teal desktop decision nav, teal AKI tab, teal current timepoint, and 2/8 mobile progress. Hover, keyboard focus, disabled, error-validation, and expanded-disclosure states are not depicted and must be designed/accessibility-verified after approval. No unsupported icon interaction is claimed.


## Implementation extraction notes

- Fonts are self-hosted Noto Sans TC Variable (SIL Open Font License) with system Latin/UI fallbacks, ensuring Traditional Chinese glyphs are available offline.
- Desktop navigation rail 220px, header 86px, utility band 80px, content gutters 24px; initial desktop work surface uses 33% / 38% / 29% columns.
- Mobile breakpoint 1050px; the approved mobile screen is checked at 430 × 764 CSS pixels. The native mobile image is a high-density source, not a 941px CSS viewport requirement.
- Semantic severity uses text plus symbols. Red is not an active result in the incomplete sample. Unknown values remain blank/provisional.
- Custom compass SVG faithfully follows the approved geometric mark; remaining icons use Lucide outline components with consistent 1.85px stroke.
- Both mobile creation affordances are retained because both were approved.
- No motion is needed beyond native focus/anchor navigation; reduced-motion users receive instant scrolling.

## Task 1 checkpoint and deferred verification

The main agent explicitly authorized a scoped Task 1 checkpoint commit on 2026-09-21. This is **not final visual signoff** and does not waive either approved concept.

Browser plugin navigation to the local preview returned `net::ERR_BLOCKED_BY_CLIENT`. The normal Playwright Chromium CDN download timed out. A temporary registry-provided Chromium binary could be extracted, but execution failed with `spawn EACCES`; no attempt was made to bypass that permission restriction. Browser-generated screenshots therefore do not exist for this checkpoint.

Task 13 MUST perform desktop and mobile rendering, core interactions, console/overflow checks, offline/PWA checks, screenshots at 1586×992 desktop and approximately 430×764 CSS-pixel mobile (plus the actual device viewport), and `view_image` comparison of each approved concept with its latest browser screenshot. Record a mismatch ledger covering copy, hierarchy, typography, palette, container geometry, spacing, and icons; fix mismatches before final signoff. Automated shell tests and builds are not a substitute for this gate.
