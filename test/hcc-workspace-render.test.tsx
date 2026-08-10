import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { HccWorkspace } from "../client/src/pages/HccWorkspace";

test("HCC workspace renders the model, evidence, hierarchy, and safety boundaries", () => {
  const html = renderToStaticMarkup(<HccWorkspace />);
  assert.match(html, /CMS-HCC model intelligence/);
  assert.match(html, /8,019 mappings/);
  assert.match(html, /Current-year diagnosis evidence/);
  assert.match(html, /Historical review queue/);
  assert.match(html, /No generic revenue multiplier/);
  assert.match(html, /Build risk-adjustment worksheet/);
});
