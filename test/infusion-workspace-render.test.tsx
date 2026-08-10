import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { InfusionWorkspace } from "../client/src/pages/InfusionWorkspace";

test("infusion workspace renders timing, unit, source, and safety controls", () => {
  const html = renderToStaticMarkup(<InfusionWorkspace />);
  assert.match(html, /Infusion coding intelligence/);
  assert.match(html, /Every minute mapped/);
  assert.match(html, /890 HCPCS entries/);
  assert.match(html, /Administration timeline/);
  assert.match(html, /JW \/ JZ policy applies/);
  assert.match(html, /Build infusion worksheet/);
  assert.match(html, /Nothing is auto-submitted/);
});
