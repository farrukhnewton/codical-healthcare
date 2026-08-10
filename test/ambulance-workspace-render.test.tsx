import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AmbulanceWorkspace } from "../client/src/pages/AmbulanceWorkspace";

test("Ambulance workspace renders its evidence and claim boundaries", () => {
  const html = renderToStaticMarkup(<AmbulanceWorkspace />);
  assert.match(html, /Ambulance coding &amp; billing/i);
  assert.match(html, /Import NEMSIS EMSDataSet/);
  assert.match(html, /Level-of-service evidence/);
  assert.match(html, /never invents diagnoses or submits a claim autonomously/i);
});
