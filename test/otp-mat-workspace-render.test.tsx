import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OtpMatWorkspace } from "../client/src/pages/OtpMatWorkspace";

test("OTP/MOUD workspace renders corrected CMS domains and clinical safeguards", () => {
  const html = renderToStaticMarkup(<OtpMatWorkspace />);
  assert.match(html, /OTP \/ MOUD coding &amp; billing/i);
  assert.match(html, /Episode and claim identity/i);
  assert.match(html, /Program eligibility/i);
  assert.match(html, /Medication and weekly bundle/i);
  assert.match(html, /Assessments, recovery supports and supply/i);
  assert.match(html, /POS 58/i);
  assert.match(html, /Clinical care and billing stay separate/i);
  assert.match(html, /No diagnosis is inferred or repaired/i);
  assert.match(html, /Human approval/i);
});
