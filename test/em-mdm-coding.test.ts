import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOverallMdm,
  calculateReportableTime,
  evaluateDataLevel,
  evaluateEmMdmCase,
  evaluateProblemLevel,
  evaluateRiskLevel,
  type EmMdmCaseInput,
} from "../shared/em-mdm-coding";

const base: EmMdmCaseInput = {
  serviceDate: "2026-08-10",
  payerMode: "medicare-ffs",
  siteType: "office",
  placeOfService: "11",
  patientType: "established",
  priorProfessionalServiceWithin3Years: true,
  sameGroupAndExactSpecialty: true,
  patientStatusVerified: true,
  selectionBasis: "mdm",
  diagnosisCodes: ["E11.9", "I10"],
  billingNpi: "1234567890",
  medicallyAppropriateHistoryExam: true,
  serviceMedicallyNecessary: true,
  currentCptEditionVerified: true,
  problems: {
    minorSelfLimited: 0,
    stableChronic: 2,
    acuteUncomplicated: 0,
    stableAcute: 0,
    chronicExacerbation: 0,
    undiagnosedUncertainPrognosis: 0,
    acuteSystemicSymptoms: 0,
    acuteComplicatedInjury: 0,
    chronicSevereExacerbation: 0,
    threatToLifeOrBodilyFunction: 0,
    clinicianCharacterizationVerified: true,
  },
  data: {
    externalNoteSourceIds: [],
    tests: [],
    independentHistorianRequired: false,
    independentHistorianReasonDocumented: null,
    independentInterpretationPerformed: false,
    interpretationSeparatelyReported: false,
    externalDiscussionPerformed: false,
    externalDiscussionPartnerDocumented: null,
  },
  risk: {
    minimalManagement: false,
    otcMedicationManagement: false,
    minorProcedureWithoutRiskFactors: false,
    physicalOrOccupationalTherapy: false,
    ivFluidsWithoutAdditives: false,
    prescriptionDrugManagement: true,
    minorProcedureWithRiskFactors: false,
    electiveMajorSurgeryWithoutRiskFactors: false,
    diagnosisOrTreatmentLimitedBySdoh: false,
    intensiveDrugToxicityMonitoring: false,
    electiveMajorSurgeryWithRiskFactors: false,
    emergencyMajorSurgery: false,
    hospitalizationOrEscalation: false,
    deescalationBecausePoorPrognosis: false,
    parenteralControlledSubstance: false,
    managementDecisionDocumented: true,
  },
  time: { totalQhpMinutes: 0, separatelyReportedServiceMinutes: 0, overlappingTeamMinutes: 0, clinicalStaffMinutesIncluded: 0, totalTimeDocumented: null, dateOfServiceOnly: null },
  sameDay: { serviceType: "none", procedureGlobalDays: "none", significantSeparateEmDocumented: null, decisionForMajorSurgeryDocumented: null },
  g2211: { requested: false, longitudinalRelationship: "none", relationshipDocumented: null },
};

test("two stable chronic problems reach moderate problem complexity", () => {
  assert.equal(evaluateProblemLevel(base.problems).level, "moderate");
});

test("one stable chronic problem reaches low problem complexity", () => {
  assert.equal(evaluateProblemLevel({ ...base.problems, stableChronic: 1 }).level, "low");
});

test("one minor problem is straightforward", () => {
  assert.equal(evaluateProblemLevel({ ...base.problems, stableChronic: 0, minorSelfLimited: 1 }).level, "straightforward");
});

test("severe exacerbation reaches high problem complexity", () => {
  assert.equal(evaluateProblemLevel({ ...base.problems, stableChronic: 0, chronicSevereExacerbation: 1 }).level, "high");
});

test("coder cannot characterize clinical stability without clinician verification", () => {
  const result = evaluateProblemLevel({ ...base.problems, clinicianCharacterizationVerified: false });
  assert.match(result.blockers.join(" "), /physician or QHP/i);
});

test("test order and result review with the same identity count once", () => {
  const result = evaluateDataLevel({ ...base.data, tests: [{ id: "cbc", ordered: true, resultReviewed: true }] });
  assert.equal(result.category1Elements, 1);
  assert.equal(result.level, "straightforward");
});

test("two unique category-one elements support low data", () => {
  const result = evaluateDataLevel({ ...base.data, externalNoteSourceIds: ["cardiology"], tests: [{ id: "cbc", resultReviewed: true }] });
  assert.equal(result.level, "low");
});

test("three unique category-one elements support moderate data", () => {
  const result = evaluateDataLevel({ ...base.data, externalNoteSourceIds: ["cardiology"], tests: [{ id: "cbc", resultReviewed: true }, { id: "cmp", ordered: true }] });
  assert.equal(result.level, "moderate");
});

test("high data requires two categories", () => {
  const result = evaluateDataLevel({ ...base.data, externalNoteSourceIds: ["cardiology"], tests: [{ id: "cbc", resultReviewed: true }, { id: "cmp", ordered: true }], independentInterpretationPerformed: true });
  assert.equal(result.level, "high");
});

test("independent interpretation cannot count when separately reported", () => {
  const result = evaluateDataLevel({ ...base.data, independentInterpretationPerformed: true, interpretationSeparatelyReported: true });
  assert.match(result.blockers.join(" "), /separately reported/i);
});

test("independent historian requires a documented reason", () => {
  const result = evaluateDataLevel({ ...base.data, independentHistorianRequired: true, independentHistorianReasonDocumented: false });
  assert.match(result.blockers.join(" "), /why an independent historian/i);
});

test("prescription drug management is moderate risk, not low", () => {
  assert.equal(evaluateRiskLevel(base.risk).level, "moderate");
});

test("OTC management is low risk", () => {
  const risk = { ...base.risk, prescriptionDrugManagement: false, otcMedicationManagement: true };
  assert.equal(evaluateRiskLevel(risk).level, "low");
});

test("intensive toxicity monitoring is high risk", () => {
  const risk = { ...base.risk, prescriptionDrugManagement: false, intensiveDrugToxicityMonitoring: true };
  assert.equal(evaluateRiskLevel(risk).level, "high");
});

test("problem severity alone does not create management risk", () => {
  const risk = { ...base.risk, prescriptionDrugManagement: false, managementDecisionDocumented: null };
  assert.equal(evaluateRiskLevel(risk).level, "none");
});

test("overall MDM is the second-highest of three elements", () => {
  assert.equal(calculateOverallMdm("high", "low", "moderate"), "moderate");
  assert.equal(calculateOverallMdm("high", "high", "straightforward"), "high");
});

test("moderate established MDM selects 99214", () => {
  const result = evaluateEmMdmCase(base);
  assert.equal(result.overallMdmLevel, "moderate");
  assert.equal(result.mdmPath.code, "99214");
  assert.equal(result.selectedPath?.code, "99214");
});

test("moderate new-patient MDM selects 99204", () => {
  const result = evaluateEmMdmCase({ ...base, patientType: "new", priorProfessionalServiceWithin3Years: false, sameGroupAndExactSpecialty: false });
  assert.equal(result.mdmPath.code, "99204");
});

test("conflicting new-patient status prevents a supported path", () => {
  const result = evaluateEmMdmCase({ ...base, patientType: "new", priorProfessionalServiceWithin3Years: true, sameGroupAndExactSpecialty: true });
  assert.equal(result.mdmPath.supported, false);
});

test("reportable time excludes separate services, overlap, and clinical staff", () => {
  assert.equal(calculateReportableTime({ totalQhpMinutes: 60, separatelyReportedServiceMinutes: 10, overlappingTeamMinutes: 5, clinicalStaffMinutesIncluded: 7, totalTimeDocumented: true, dateOfServiceOnly: true }), 38);
});

test("current minimum-time thresholds select office/outpatient code", () => {
  const result = evaluateEmMdmCase({ ...base, selectionBasis: "time", time: { totalQhpMinutes: 40, separatelyReportedServiceMinutes: 0, overlappingTeamMinutes: 0, clinicalStaffMinutesIncluded: 0, totalTimeDocumented: true, dateOfServiceOnly: true } });
  assert.equal(result.timePath.code, "99215");
});

test("time below minimum does not select a code", () => {
  const result = evaluateEmMdmCase({ ...base, selectionBasis: "time", time: { totalQhpMinutes: 9, separatelyReportedServiceMinutes: 0, overlappingTeamMinutes: 0, clinicalStaffMinutesIncluded: 0, totalTimeDocumented: true, dateOfServiceOnly: true } });
  assert.equal(result.timePath.code, null);
});

test("Medicare established prolonged time begins G2212 at 69 minutes", () => {
  const result = evaluateEmMdmCase({ ...base, selectionBasis: "time", time: { totalQhpMinutes: 69, separatelyReportedServiceMinutes: 0, overlappingTeamMinutes: 0, clinicalStaffMinutesIncluded: 0, totalTimeDocumented: true, dateOfServiceOnly: true } });
  assert.equal(result.prolonged.code, "G2212");
  assert.equal(result.prolonged.units, 1);
});

test("Medicare new prolonged time increments every complete 15 minutes", () => {
  const result = evaluateEmMdmCase({ ...base, patientType: "new", priorProfessionalServiceWithin3Years: false, sameGroupAndExactSpecialty: false, selectionBasis: "time", time: { totalQhpMinutes: 104, separatelyReportedServiceMinutes: 0, overlappingTeamMinutes: 0, clinicalStaffMinutesIncluded: 0, totalTimeDocumented: true, dateOfServiceOnly: true } });
  assert.equal(result.prolonged.units, 2);
});

test("non-Medicare prolonged pathway is held for payer-specific licensed rules", () => {
  const result = evaluateEmMdmCase({ ...base, payerMode: "commercial", selectionBasis: "time", time: { totalQhpMinutes: 70, separatelyReportedServiceMinutes: 0, overlappingTeamMinutes: 0, clinicalStaffMinutesIncluded: 0, totalTimeDocumented: true, dateOfServiceOnly: true } });
  assert.match(result.prolonged.blockers.join(" "), /payer's licensed prolonged-service/i);
});

test("modifier 25 requires a significant separately identifiable E/M", () => {
  const accepted = evaluateEmMdmCase({ ...base, sameDay: { serviceType: "minor-procedure", procedureGlobalDays: "0", significantSeparateEmDocumented: true, decisionForMajorSurgeryDocumented: null } });
  assert.deepEqual(accepted.sameDayModifiers, ["25"]);
  const held = evaluateEmMdmCase({ ...base, sameDay: { serviceType: "minor-procedure", procedureGlobalDays: "0", significantSeparateEmDocumented: false, decisionForMajorSurgeryDocumented: null } });
  assert.equal(held.sameDayModifiers.length, 0);
});

test("modifier 57 is limited to documented decision for major surgery", () => {
  const result = evaluateEmMdmCase({ ...base, sameDay: { serviceType: "major-procedure", procedureGlobalDays: "90", significantSeparateEmDocumented: null, decisionForMajorSurgeryDocumented: true } });
  assert.deepEqual(result.sameDayModifiers, ["57"]);
});

test("G2211 passes for documented longitudinal Medicare relationship", () => {
  const result = evaluateEmMdmCase({ ...base, g2211: { requested: true, longitudinalRelationship: "continuing-focal-point", relationshipDocumented: true } });
  assert.equal(result.g2211.suggested, true);
});

test("G2211 with modifier 25 is allowed for represented preventive pathways", () => {
  const result = evaluateEmMdmCase({ ...base, sameDay: { serviceType: "annual-wellness", procedureGlobalDays: "none", significantSeparateEmDocumented: true, decisionForMajorSurgeryDocumented: null }, g2211: { requested: true, longitudinalRelationship: "continuing-focal-point", relationshipDocumented: true } });
  assert.equal(result.g2211.suggested, true);
});

test("G2211 with modifier 25 is held for an ordinary minor procedure", () => {
  const result = evaluateEmMdmCase({ ...base, sameDay: { serviceType: "minor-procedure", procedureGlobalDays: "0", significantSeparateEmDocumented: true, decisionForMajorSurgeryDocumented: null }, g2211: { requested: true, longitudinalRelationship: "continuing-focal-point", relationshipDocumented: true } });
  assert.equal(result.g2211.suggested, false);
});

test("G2211 is bundled in RHC and FQHC payment", () => {
  const result = evaluateEmMdmCase({ ...base, siteType: "rhc", g2211: { requested: true, longitudinalRelationship: "continuing-focal-point", relationshipDocumented: true } });
  assert.match(result.g2211.blockers.join(" "), /bundled/i);
});

test("diagnoses are filtered but never inferred", () => {
  const result = evaluateEmMdmCase({ ...base, diagnosisCodes: ["diabetes", "E11.9", "I10!"] });
  assert.deepEqual(result.diagnosisCodes, ["E11.9"]);
  assert.match(result.queries.join(" "), /no diagnosis was inferred/i);
});

test("claim release requires current licensed CPT edition verification", () => {
  const result = evaluateEmMdmCase({ ...base, currentCptEditionVerified: false });
  assert.match(result.domains.find((item) => item.domain === "claim")!.blockers.join(" "), /licensed CPT edition/i);
});

test("history and examination do not determine the office E/M level", () => {
  const result = evaluateEmMdmCase({ ...base, medicallyAppropriateHistoryExam: false });
  assert.equal(result.overallMdmLevel, "moderate");
  assert.match(result.queries.join(" "), /do not set/i);
});

test("engine always requires human approval and embeds no licensed descriptors", () => {
  const result = evaluateEmMdmCase(base);
  assert.equal(result.requiresHumanApproval, true);
  assert.equal(result.autonomousClaimSubmission, false);
  assert.equal(result.licensedCptDescriptorsEmbedded, false);
});
