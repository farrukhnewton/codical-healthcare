import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EmMdmWorkspace } from "../client/src/pages/EmMdmWorkspace";

test("E/M MDM workspace renders corrected evidence, time, and license boundaries", () => {
  const html = renderToStaticMarkup(<EmMdmWorkspace />);
  assert.match(html, /Office \/ outpatient E\/M intelligence/i);
  assert.match(html, /Encounter identity and code family/i);
  assert.match(html, /Problems actually addressed/i);
  assert.match(html, /Data reviewed and analyzed/i);
  assert.match(html, /Risk of patient management/i);
  assert.match(html, /Total time and prolonged services/i);
  assert.match(html, /Same-day services and G2211/i);
  assert.match(html, /No diagnosis is inferred or repaired/i);
  assert.match(html, /Not a point calculator/i);
});
