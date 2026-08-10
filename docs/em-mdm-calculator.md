# Office / Outpatient E/M MDM Calculator

## Scope and outcome

This specialty module creates an auditable office/outpatient E/M coding worksheet for codes 99202–99205 and 99212–99215. It compares the medical-decision-making pathway with the date-of-service time pathway, then independently reviews patient status, prolonged Medicare time, same-day modifiers, G2211, medical necessity, and claim readiness.

The module does not embed official CPT descriptors, reproduce the complete proprietary MDM table, infer diagnoses, determine whether a clinical problem is stable or worsening, or submit claims autonomously.

## Corrections to the original plan

The original plan described a simple points calculator. It was corrected before implementation because:

- MDM is based on two of three independently evaluated elements, not a single summed point score.
- Ordering and reviewing the same unique test cannot be counted twice.
- High data complexity requires two qualifying data categories; a flat `4+ points` rule is incorrect.
- Prescription drug management is represented at moderate management risk, not low.
- Drug therapy requiring intensive toxicity monitoring is represented at high management risk, not moderate.
- Problem severity does not by itself establish patient-management risk.
- The physician/QHP, rather than the coder, determines whether a problem is stable, worsening, uncertain, or threatening.
- Since CPT 2024, office/outpatient time values function as minimum thresholds that must be met or exceeded, rather than upper-bounded ranges.
- Clinical staff time, duplicate team time, and time for separately reported services cannot be included in reportable physician/QHP time.
- Medicare G2212 begins at Medicare-specific thresholds, which differ from non-Medicare prolonged-service rules.
- New/established patient status requires the three-year, group, and exact specialty/subspecialty review.
- Modifier 25, modifier 57, and G2211 require independent evidence and are never automatic.
- Starting in 2025, Medicare allows G2211 with modifier 25 only for represented allowed same-day AWV, vaccine administration, or Part B preventive pathways.
- G2211 is bundled rather than separately payable in RHC/FQHC encounter payment.

## Decision workflow

1. Confirm office/outpatient setting, POS, payer, service date, patient type, and practitioner.
2. Verify the new/established status evidence.
3. Enter only diagnoses documented for the encounter.
4. Classify problems actually addressed using physician/QHP characterization.
5. Count unique external sources and tests without duplicate order/result credit.
6. Verify independent historian, independent interpretation, and external discussion requirements.
7. Record management decisions and patient-specific risk separately from problem severity.
8. Derive each MDM element and apply the two-of-three rule.
9. Calculate reportable date-of-service time after exclusions.
10. Compare MDM and time paths without silently choosing an unsupported higher code.
11. Evaluate G2212, same-day modifiers, and G2211 independently.
12. Require medical necessity, current licensed CPT metadata, and human coder approval before release.

## Time path

The implemented minimum thresholds are:

| Patient | First level | Low | Moderate | High |
| --- | ---: | ---: | ---: | ---: |
| New | 15 minutes | 30 minutes | 45 minutes | 60 minutes |
| Established | 10 minutes | 20 minutes | 30 minutes | 40 minutes |

For Medicare FFS, G2212 begins at 89 minutes with 99205 or 69 minutes with 99215, then adds one unit for each complete additional 15 minutes. Non-Medicare prolonged-service coding is held until a payer-effective licensed rule is available.

## CPT licensing boundary

The repository stores:

- CPT code identifiers;
- original paraphrases written for this application;
- structural thresholds and decision states;
- links and identifiers for authoritative sources.

The repository does not store official CPT descriptors or the complete licensed MDM table. The D1 schema provides a tenant-scoped encrypted adapter record for a current AMA-licensed CPT source. Claim release requires verification of the current edition.

## Evidence and OCR

Uploaded notes and supporting records are stored through encrypted specialty object storage when configured. Native text and OCR results may raise search flags for medication management, hospitalization, historian, discussion, or time language, but those flags never auto-populate claim-bound MDM evidence. The physician/QHP and coder must verify the exact source page and encounter context.

## D1 architecture

Migration `0008_em_mdm_calculator.sql` adds:

- source and version registries;
- licensed CPT adapter metadata;
- original-paraphrase office code metadata and time thresholds;
- MDM and Medicare rule registries;
- tenant-scoped encrypted cases and documents;
- clinician/coder-verified evidence;
- separate problem, data, risk, time, modifier, and G2211 evaluations;
- human-gated claim previews and immutable audit events.

Database constraints prohibit embedded licensed descriptors and autonomous claim submission.

## Primary sources

- CMS, [Evaluation and Management Services, May 2026](https://www.cms.gov/files/document/mln006764-evaluation-management-services.pdf)
- CMS, [Medicare Claims Processing Manual, Chapter 12](https://www.cms.gov/Regulations-and-Guidance/Guidance/Manuals/Downloads/clm104c12.pdf)
- CMS, [How to Use G2211](https://www.cms.gov/files/document/mm13473-how-use-office-and-outpatient-evaluation-and-management-visit-complexity-add-code-g2211.pdf)
- AMA, [CPT Evaluation and Management](https://www.ama-assn.org/practice-management/cpt/cpt-evaluation-and-management)
- AMA, [2024 minimum-time revision](https://www.ama-assn.org/practice-management/cpt/simpler-approach-helps-physicians-properly-report-em-services)

## Safety boundaries

- No diagnosis inference or repair.
- No coder determination of clinical problem status.
- No automatic modifier or add-on assignment.
- No unsupported non-Medicare prolonged code.
- No official CPT descriptor storage without a licensed adapter.
- No autonomous claim submission.
- Human approval is always required.
