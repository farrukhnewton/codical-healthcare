import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TransplantWorkspace } from "../client/src/pages/TransplantWorkspace";

test("Transplant workspace renders lifecycle boundaries and evidence domains", () => {
  const html = renderToStaticMarkup(<TransplantWorkspace />);
  assert.match(html, /Organ transplant lifecycle coding/i);
  assert.match(html, /Episode and program record/i);
  assert.match(html, /Clinical and coverage evidence/i);
  assert.match(html, /does not infer diagnoses/i);
  assert.match(html, /Human approval required/i);
});
