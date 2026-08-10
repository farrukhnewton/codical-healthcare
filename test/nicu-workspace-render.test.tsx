import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NicuWorkspace } from "../client/src/pages/NicuWorkspace";

test("NICU workspace renders daily evidence, payer, OCR, and safety boundaries", () => {
  const markup = renderToStaticMarkup(React.createElement(NicuWorkspace));
  assert.match(markup, /NICU DAILY CODER/);
  assert.match(markup, /Present weight/);
  assert.match(markup, /Date-effective payer policy verified/);
  assert.match(markup, /Upload NICU records/);
  assert.match(markup, /Build NICU daily worksheet/);
  assert.match(markup, /does not establish critical illness/i);
});
