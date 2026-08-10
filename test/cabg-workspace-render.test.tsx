import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CabgWorkspace } from "../client/src/pages/CabgWorkspace";

test("CABG workspace renders OCR target ledger claim boundary and release controls", () => {
  const markup = renderToStaticMarkup(<CabgWorkspace />);
  assert.match(markup, /CABG ASSEMBLER/);
  assert.match(markup, /Professional/);
  assert.match(markup, /Inpatient facility/);
  assert.match(markup, /Completed distal coronary targets/);
  assert.match(markup, /Upload CABG source records/);
  assert.match(markup, /Build CABG worksheet/);
  assert.doesNotMatch(markup, /CMS-1500/);
});
