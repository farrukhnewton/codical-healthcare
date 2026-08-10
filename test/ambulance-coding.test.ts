import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAmbulanceModifier, estimateAmbulancePayment, evaluateAls2, evaluateAmbulanceCase,
  roundAmbulanceMileage, type AmbulanceCaseInput,
} from "../shared/ambulance-coding";

function ambulanceCase(overrides: Partial<AmbulanceCaseInput> = {}): AmbulanceCaseInput {
  return {
    serviceDate: "2026-08-04",
    payerMode: "medicare-fs",
    entityType: "independent-supplier",
    provision: "direct",
    transportMode: "ground",
    responseType: "emergency",
    outcome: "transported",
    origin: "S",
    destination: "H",
    pointOfPickupZip: "90210",
    rurality: "urban",
    loadedMiles: 9.01,
    patientCount: 1,
    medicalNecessity: true,
    destinationAppropriate: true,
    nearestAppropriateFacility: true,
    diagnosisCodes: ["R07.9"],
    contraindicationToOtherTransport: "Continuous monitoring was required.",
    signatureStatus: "complete",
    abnStatus: "not-required",
    medications: [],
    als2Procedures: [],
    ...overrides,
  };
}

test("BLS emergency selects A0429 rather than non-emergency A0428", () => {
  const result = evaluateAmbulanceCase(ambulanceCase());
  assert.equal(result.levelOfService.hcpcs, "A0429");
  assert.deepEqual(result.lines.map((line) => line.hcpcs), ["A0429", "A0425"]);
});

test("BLS non-emergency selects A0428", () => {
  assert.equal(evaluateAmbulanceCase(ambulanceCase({ responseType: "non-emergency" })).levelOfService.hcpcs, "A0428");
});

test("ALS assessment in an emergency selects ALS1 emergency", () => {
  assert.equal(evaluateAmbulanceCase(ambulanceCase({ alsAssessment: true })).levelOfService.hcpcs, "A0427");
});

test("non-emergency ALS intervention selects A0426", () => {
  assert.equal(evaluateAmbulanceCase(ambulanceCase({ responseType: "non-emergency", alsIntervention: true })).levelOfService.hcpcs, "A0426");
});

test("three separate protocol IV administrations qualify for ALS2", () => {
  const medications = [1, 2, 3].map((index) => ({ medication: `dose ${index}`, route: "iv-push" as const, standardProtocolDose: true, documented: true }));
  const result = evaluateAmbulanceCase(ambulanceCase({ medications }));
  assert.equal(result.levelOfService.hcpcs, "A0433");
});

test("crystalloids, non-IV routes, and split doses are excluded from ALS2", () => {
  const result = evaluateAls2({ medications: [
    { medication: "saline", route: "iv-bolus", isCrystalloid: true },
    { medication: "epinephrine", route: "intramuscular" },
    { medication: "adenosine", route: "iv-push", splitDose: true },
  ], als2Procedures: [] });
  assert.equal(result.qualifies, false);
  assert.equal(result.medicationCount, 0);
});

test("one listed ALS2 procedure is sufficient when medically necessary", () => {
  const result = evaluateAmbulanceCase(ambulanceCase({ als2Procedures: ["endotracheal-intubation"] }));
  assert.equal(result.levelOfService.hcpcs, "A0433");
});

test("SCT requires every gate including state paramedic scope", () => {
  const incomplete = evaluateAmbulanceCase(ambulanceCase({ sct: { interfacility: true, criticallyIllOrInjured: true, ongoingCareRequired: true, beyondStateParamedicScope: null } }));
  assert.notEqual(incomplete.levelOfService.hcpcs, "A0434");
  assert.match(incomplete.queries.join(" "), /state paramedic scope/i);
  const complete = evaluateAmbulanceCase(ambulanceCase({ sct: { interfacility: true, criticallyIllOrInjured: true, ongoingCareRequired: true, beyondStateParamedicScope: true } }));
  assert.equal(complete.levelOfService.hcpcs, "A0434");
});

test("fixed and rotary wing use distinct base and mileage codes", () => {
  const air = { groundTransportInappropriate: true, rapidTransportRequired: true, distanceOrObstacleDocumented: true };
  assert.deepEqual(evaluateAmbulanceCase(ambulanceCase({ transportMode: "fixed-wing", air })).lines.map((line) => line.hcpcs), ["A0430", "A0435"]);
  assert.deepEqual(evaluateAmbulanceCase(ambulanceCase({ transportMode: "rotary-wing", air })).lines.map((line) => line.hcpcs), ["A0431", "A0436"]);
});

test("CMS mileage rounding is always upward", () => {
  assert.equal(roundAmbulanceMileage(0.01), 0.1);
  assert.equal(roundAmbulanceMileage(99.91), 100);
  assert.equal(roundAmbulanceMileage(100), 100);
  assert.equal(roundAmbulanceMileage(100.01), 101);
});

test("X is allowed only in destination position", () => {
  assert.equal(buildAmbulanceModifier("S", "X"), "SX");
  assert.equal(buildAmbulanceModifier("X", "H"), null);
});

test("death after dispatch and before load creates BLS base only with QL", () => {
  const result = evaluateAmbulanceCase(ambulanceCase({ outcome: "pronounced-after-dispatch-before-load", loadedMiles: 5 }));
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].hcpcs, "A0428");
  assert.ok(result.lines[0].modifiers.includes("QL"));
});

test("institutional providers receive 837I, POS and QN/QM path", () => {
  const direct = evaluateAmbulanceCase(ambulanceCase({ entityType: "institutional-provider", provision: "direct" }));
  assert.equal(direct.claimFormat, "837I");
  assert.equal(direct.providerModifier, "QN");
  assert.ok(direct.lines[0].modifiers.includes("QN"));
});

test("diagnoses are filtered but never invented", () => {
  const result = evaluateAmbulanceCase(ambulanceCase({ diagnosisCodes: ["R07.9", "DOB", "", "F25.1"] }));
  assert.deepEqual(result.diagnosisCodes, ["R07.9", "F25.1"]);
});

test("payment is unavailable without a versioned rate", () => {
  const input = ambulanceCase();
  const estimate = estimateAmbulancePayment(input, evaluateAmbulanceCase(input));
  assert.equal(estimate.status, "unavailable");
  assert.equal(estimate.estimatedAllowed, null);
});

test("rural first 17 miles and ESRD reduction follow calculation order", () => {
  const input = ambulanceCase({ responseType: "non-emergency", origin: "R", destination: "J", rurality: "rural", loadedMiles: 20 });
  const evaluation = evaluateAmbulanceCase(input);
  const estimate = estimateAmbulancePayment(input, evaluation, {
    sourceVersion: "CMS-2026-Q3-test",
    effectiveFrom: "2026-07-01",
    effectiveTo: "2026-09-30",
    importedAt: "2026-08-01T00:00:00Z",
    baseRate: 300,
    mileageRate: 10,
    ruralMiles1To17Rate: 15,
    includesTemporaryAddOns: true,
  });
  assert.equal(estimate.baseAmount, 300);
  assert.equal(estimate.mileageAmount, 285);
  assert.equal(estimate.reductionAmount, 134.55);
  assert.equal(estimate.estimatedAllowed, 450.45);
});

test("emergency response remains separate from medical necessity", () => {
  const result = evaluateAmbulanceCase(ambulanceCase({ medicalNecessity: false, contraindicationToOtherTransport: "" }));
  assert.equal(result.levelOfService.hcpcs, "A0429");
  assert.equal(result.medicalNecessity.status, "hold");
  assert.equal(result.coverage.status, "hold");
});
