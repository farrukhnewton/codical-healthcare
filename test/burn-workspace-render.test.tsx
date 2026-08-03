import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BurnWorkspace } from "../client/src/pages/BurnWorkspace";

test("Burn workspace renders its initial route state without throwing", () => {
  const html = renderToStaticMarkup(<BurnWorkspace />);
  assert.match(html, /BURN &amp; SKIN GRAFT CODING/);
  assert.match(html, /Candidate service lines/);
  assert.match(html, /Documentation gates/);
});
