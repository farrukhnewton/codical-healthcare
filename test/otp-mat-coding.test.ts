import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOtpCase, type OtpCaseInput, type OtpServiceRecord } from "../shared/otp-mat-coding";

const base: OtpCaseInput = {
  serviceDate: "2026-08-10",
  payerMode: "medicare-ffs",
  claimEntity: "professional",
  siteType: "freestanding",
  diagnosisCodes: ["F11.20"],
  organizationNpi: "1234567890",
  orderingNpi: "0987654321",
  program: { samhsaCertified: true, accredited: true, medicareEnrolled: true, deaAndStateAuthorized: true },
  medication: "methadone",
  drugComponentFurnished: true,
  nondrugComponentFurnished: true,
  telecom: { mode: "none", service: "none" },
};

test("complete professional methadone episode produces G2067 with POS 58", () => {
  const result = evaluateOtpCase(base);
  assert.equal(result.primaryCode, "G2067");
  assert.equal(result.claimFormat, "837P");
  assert.equal(result.claimContext.placeOfService, "58");
  assert.equal(result.lines[0].nationalAmountCents, 27729);
});

test("institutional freestanding episode uses 087x and revenue code", () => {
  const result = evaluateOtpCase({ ...base, claimEntity: "institutional" });
  assert.equal(result.claimFormat, "837I");
  assert.equal(result.claimContext.typeOfBill, "087x");
  assert.equal(result.claimContext.revenueCode, "0900");
});

test("provider-based institutional episode adds condition code 89", () => {
  const result = evaluateOtpCase({ ...base, claimEntity: "institutional", siteType: "provider-based" });
  assert.equal(result.claimContext.conditionCode, "89");
});

test("hospital and CAH paths use their distinct types of bill", () => {
  assert.equal(evaluateOtpCase({ ...base, claimEntity: "institutional", siteType: "hospital-based" }).claimContext.typeOfBill, "013x");
  assert.equal(evaluateOtpCase({ ...base, claimEntity: "institutional", siteType: "cah-based" }).claimContext.typeOfBill, "085x");
});

test("program certification and enrollment are independent holds", () => {
  const result = evaluateOtpCase({ ...base, program: { samhsaCertified: false, accredited: false, medicareEnrolled: false, deaAndStateAuthorized: false } });
  const blockers = result.domains.find((item) => item.domain === "program")!.blockers.join(" ");
  assert.match(blockers, /SAMHSA/);
  assert.match(blockers, /accreditation/i);
  assert.match(blockers, /Medicare enrollment/i);
  assert.match(blockers, /DEA/i);
});

test("a primary bundle requires a furnished component", () => {
  const result = evaluateOtpCase({ ...base, drugComponentFurnished: false, nondrugComponentFurnished: false });
  assert.equal(result.lines.some((line) => line.category === "primary-bundle"), false);
  assert.equal(result.domains.find((item) => item.domain === "bundle")!.status, "hold");
});

test("no-drug G2074 specifically requires a non-drug service", () => {
  const result = evaluateOtpCase({ ...base, medication: "no-drug", drugComponentFurnished: false, nondrugComponentFurnished: false });
  assert.match(result.domains.find((item) => item.domain === "bundle")!.blockers.join(" "), /G2074/);
});

test("medication switch chooses only the drug used most of the week", () => {
  const result = evaluateOtpCase({ ...base, medicationSwitchedDuringWeek: true, medication: "methadone", medicationUsedMostOfWeek: "buprenorphine-oral" });
  assert.equal(result.primaryCode, "G2068");
  assert.equal(result.lines.filter((line) => line.category === "primary-bundle").length, 1);
});

test("unresolved medication switch holds the primary bundle", () => {
  const result = evaluateOtpCase({ ...base, medicationSwitchedDuringWeek: true, medicationUsedMostOfWeek: null });
  assert.equal(result.lines.some((line) => line.category === "primary-bundle"), false);
});

test("take-home units round to seven-day units and cap at three", () => {
  const accepted = evaluateOtpCase({ ...base, takeHome: { additionalDays: 13, noOverlapWithBundleDates: true, practitionerAuthorized: true } });
  assert.equal(accepted.lines.find((line) => line.hcpcs === "G2078")?.units, 2);
  const held = evaluateOtpCase({ ...base, takeHome: { additionalDays: 22, noOverlapWithBundleDates: true, practitionerAuthorized: true } });
  assert.equal(held.lines.some((line) => line.hcpcs === "G2078"), false);
});

test("take-home add-on must match the primary medication", () => {
  const result = evaluateOtpCase({ ...base, medication: "naltrexone", takeHome: { additionalDays: 7, noOverlapWithBundleDates: true, practitionerAuthorized: true } });
  assert.match(result.domains.find((item) => item.domain === "add-ons")!.blockers.join(" "), /only match methadone or oral buprenorphine/i);
});

test("take-home overlap and practitioner authorization are explicit gates", () => {
  const result = evaluateOtpCase({ ...base, takeHome: { additionalDays: 7, noOverlapWithBundleDates: false, practitionerAuthorized: false } });
  const blockers = result.domains.find((item) => item.domain === "add-ons")!.blockers.join(" ");
  assert.match(blockers, /overlap/i);
  assert.match(blockers, /practitioner/i);
});

test("additional counseling uses complete 30-minute units", () => {
  const result = evaluateOtpCase({ ...base, additionalCounselingMinutes: 65, counselingBeyondBundlePlan: true });
  assert.equal(result.lines.find((line) => line.hcpcs === "G2080")?.units, 2);
});

test("additional counseling is held unless beyond bundle services", () => {
  const result = evaluateOtpCase({ ...base, additionalCounselingMinutes: 30, counselingBeyondBundlePlan: false });
  assert.equal(result.lines.some((line) => line.hcpcs === "G2080"), false);
});

const iopServices = (count: number, countedElsewhere = false): OtpServiceRecord[] => Array.from({ length: count }, (_, index) => ({ id: String(index), serviceDate: `2026-08-${String(10 + Math.floor(index / 2)).padStart(2, "0")}`, category: "counseling", countedElsewhere }));

test("IOP requires nine unique non-duplicated services and certification", () => {
  const accepted = evaluateOtpCase({ ...base, intensiveOutpatient: { requested: true, practitionerCertified: true, services: iopServices(9) } });
  assert.equal(accepted.lines.some((line) => line.hcpcs === "G0137"), true);
  const held = evaluateOtpCase({ ...base, intensiveOutpatient: { requested: true, practitionerCertified: false, services: iopServices(8) } });
  assert.equal(held.lines.some((line) => line.hcpcs === "G0137"), false);
});

test("services counted elsewhere do not satisfy IOP threshold", () => {
  const services = [...iopServices(8), ...iopServices(1, true).map((service) => ({ ...service, id: "elsewhere" }))];
  const result = evaluateOtpCase({ ...base, intensiveOutpatient: { requested: true, practitionerCertified: true, services } });
  assert.equal(result.lines.some((line) => line.hcpcs === "G0137"), false);
});

test("audio-video periodic assessment uses modifier 95 and POS 58", () => {
  const result = evaluateOtpCase({ ...base, newPatient: false, periodicAssessmentPerformed: true, telecom: { mode: "audio-video", service: "periodic-assessment", federalStateRequirementsMet: true } });
  assert.equal(result.lines.find((line) => line.hcpcs === "G2077")?.modifier, "95");
  assert.equal(result.claimContext.placeOfService, "58");
});

test("audio-only methadone intake requires AV unavailable and in-person DEA practitioner", () => {
  const result = evaluateOtpCase({ ...base, newPatient: true, intakePerformed: true, telecom: { mode: "audio-only", service: "intake", audioVideoUnavailable: false, patientWithDeaPractitioner: false, federalStateRequirementsMet: true } });
  const blockers = result.domains.find((item) => item.domain === "telecom")!.blockers.join(" ");
  assert.match(blockers, /unavailable/i);
  assert.match(blockers, /DEA-registered/i);
});

test("limited duplicate bundle can use modifier 59 only with records", () => {
  const accepted = evaluateOtpCase({ ...base, duplicateBundle: { detected: true, reason: "guest-dosing", recordsExchanged: true, modifier59Supported: true } });
  assert.equal(accepted.lines.find((line) => line.category === "primary-bundle")?.modifier, "59");
  const held = evaluateOtpCase({ ...base, duplicateBundle: { detected: true, reason: "other", recordsExchanged: true, modifier59Supported: true } });
  assert.equal(held.lines.some((line) => line.category === "primary-bundle"), false);
});

test("injectable naloxone uses whole milligram units and contractor pricing", () => {
  const result = evaluateOtpCase({ ...base, overdoseMedication: { product: "g2216-injectable", dosageMg: 1.2 } });
  assert.equal(result.lines.find((line) => line.hcpcs === "G2216")?.units, 2);
  assert.deepEqual(result.payment.contractorPricedCodes, ["G2216"]);
  assert.equal(result.payment.estimatedTotalCents, null);
});

test("repeat overdose medication within 30 days requires medical necessity", () => {
  const result = evaluateOtpCase({ ...base, overdoseMedication: { product: "g2215-nasal", lastSupplyDate: "2026-08-01", additionalSupplyNecessary: false } });
  assert.equal(result.lines.some((line) => line.hcpcs === "G2215"), false);
});

test("diagnoses are filtered but never inferred or repaired", () => {
  const result = evaluateOtpCase({ ...base, diagnosisCodes: ["opioid dependence", "F11.20", "F11.2!"] });
  assert.deepEqual(result.diagnosisCodes, ["F11.20"]);
  assert.match(result.queries.join(" "), /no diagnosis was inferred/i);
});

test("a non-OUD diagnosis does not satisfy Medicare claim readiness", () => {
  const result = evaluateOtpCase({ ...base, diagnosisCodes: ["F41.1"] });
  assert.match(result.domains.find((item) => item.domain === "claim")!.blockers.join(" "), /opioid-use-disorder/i);
});

test("locality factor adjusts only non-drug components", () => {
  const result = evaluateOtpCase({ ...base, localityAdjustment: 1.1 });
  assert.equal(result.lines[0].estimatedAmountCents, Math.round(4441 + 23288 * 1.1));
});

test("engine always requires human approval and disables autonomous submission", () => {
  const result = evaluateOtpCase(base);
  assert.equal(result.requiresHumanApproval, true);
  assert.equal(result.autonomousClaimSubmission, false);
});
