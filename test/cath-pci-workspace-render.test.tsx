import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CathPciWorkspace } from "../client/src/pages/CathPciWorkspace";

test("cath PCI workspace renders OCR vessel ledger setting boundary and release controls", () => {
  const markup = renderToStaticMarkup(<CathPciWorkspace />);
  assert.match(markup, /CARDIAC CATH \+ PCI/); assert.match(markup, /Professional/); assert.match(markup, /Hospital outpatient/); assert.match(markup, /Inpatient facility/); assert.match(markup, /Completed coronary interventions/); assert.match(markup, /Upload cath \/ PCI records/); assert.match(markup, /Build cath \/ PCI worksheet/);
});
