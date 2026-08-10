import assert from "node:assert/strict";
import test from "node:test";
import { parseNemsisXml } from "../server/services/ambulance-nemsis";

const sample = `<?xml version="1.0" encoding="UTF-8"?>
<EMSDataSet xmlns="http://www.nemsis.org" version="3.5.1">
  <Header><PatientCareReport><eRecord><eRecord.01>PCR-2048</eRecord.01></eRecord>
  <ePatient><ePatient.02>Rivera</ePatient.02><ePatient.03>Alex</ePatient.03></ePatient>
  <eSituation><eSituation.09>Chest pain</eSituation.09></eSituation>
  <eMedications><eMedications.MedicationGroup><eMedications.03>Aspirin</eMedications.03><eMedications.05>Oral</eMedications.05></eMedications.MedicationGroup></eMedications>
  <eProcedures><eProcedures.ProcedureGroup><eProcedures.03>12-lead ECG</eProcedures.03><eProcedures.06>Yes</eProcedures.06></eProcedures.ProcedureGroup></eProcedures>
  </PatientCareReport></Header>
</EMSDataSet>`;

test("NEMSIS importer maps evidence and hashes the immutable source", () => {
  const result = parseNemsisXml(sample);
  assert.equal(result.detectedVersion, "3.5.1");
  assert.equal(result.recordNumber, "PCR-2048");
  assert.equal(result.patientName, "Alex Rivera");
  assert.deepEqual(result.symptoms, ["Chest pain"]);
  assert.equal(result.medications[0].name, "Aspirin");
  assert.equal(result.procedures[0].name, "12-lead ECG");
  assert.match(result.fileSha256, /^[a-f0-9]{64}$/);
});

test("NEMSIS importer rejects external entity declarations", () => {
  assert.throws(() => parseNemsisXml(`<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><EMSDataSet>&xxe;</EMSDataSet>`), /not allowed/i);
});
