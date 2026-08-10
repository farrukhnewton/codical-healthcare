import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VadEcmoWorkspace } from "../client/src/pages/VadEcmoWorkspace";

test("VAD/ECMO workspace renders evidence, coverage, OCR, and claim-scope controls", () => {
  const markup = renderToStaticMarkup(<VadEcmoWorkspace />);
  assert.match(markup, /VAD \/ ECMO CODER/);
  assert.match(markup, /Professional \/ CPT/);
  assert.match(markup, /Inpatient facility \/ ICD-10-PCS/);
  assert.match(markup, /Medicare durable-LVAD coverage evidence/);
  assert.match(markup, /Upload VAD \/ ECMO records/);
  assert.match(markup, /Build VAD \/ ECMO worksheet/);
  assert.doesNotMatch(markup, /CMS-1500/);
});
