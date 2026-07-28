import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildPgxCmsImportPlan, parseCmsCsv, summarizePgxCmsImportPlan } from "../server/pgx-cms-importer";

function write(root: string, area: "current_article" | "current_lcd", name: string, value: string) {
  const folder = path.join(root, area, area === "current_article" ? "current_article_csv" : "current_lcd_csv");
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, name), value, "utf8");
}

test("CMS CSV parser preserves quoted commas", () => {
  assert.deepEqual(parseCmsCsv('id,"title"\r\n1,"PGx, coding"\r\n'), [{ id: "1", title: "PGx, coding" }]);
});

test("fixture importer retains all MAC rows but qualifies target jurisdictions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "codical-pgx-cms-"));
  try {
    write(root, "current_article", "article.csv", "article_id,article_version,title,article_pub_date,article_eff_date,article_end_date,status,last_updated,display_id\n59915,3,PGx Article,2026-01-01,2026-01-15,,Active,2026-07-01,A59915\n");
    write(root, "current_article", "article_x_contractor.csv", "article_id,article_version,contractor_id,contractor_type_id,contractor_version,last_updated\n59915,3,10,12,1,2026-07-01\n");
    write(root, "current_article", "article_x_hcpc_code.csv", "article_id,article_version,hcpc_code_id,hcpc_code_version,hcpc_code_group,range,last_updated\n59915,3,81225,2026,1,,2026-07-01\n");
    write(root, "current_article", "article_x_icd10_covered.csv", "article_id,article_version,icd10_code_id,icd10_code_version,icd10_covered_group,range,last_updated\n59915,3,Z13.79,2026,1,,2026-07-01\n");
    write(root, "current_article", "article_x_icd10_noncovered.csv", "article_id,article_version,icd10_code_id,icd10_code_version,icd10_noncovered_group,range,last_updated\n");
    write(root, "current_article", "contractor.csv", "contractor_id,contractor_type_id,contractor_version,contractor_bus_name,contractor_number,status\n10,12,1,Example MAC,12345,Active\n11,12,1,Other MAC,67890,Active\n");
    write(root, "current_article", "contractor_type_lookup.csv", "contractor_type_id,description\n12,A and B MAC\n");
    write(root, "current_article", "contractor_jurisdiction.csv", "contractor_id,contractor_type_id,contractor_version,state_id,last_updated,active_date,term_date\n10,12,1,1,2026-07-01,2020-01-01,\n11,12,1,2,2026-07-01,2020-01-01,\n");
    write(root, "current_article", "state_lookup.csv", "state_id,state_abbrev,description\n1,NY,New York\n2,CA,California\n");
    write(root, "current_lcd", "lcd.csv", "lcd_id,lcd_version,title,orig_det_eff_date,ent_det_end_date,rev_eff_date,rev_end_date,status,last_updated,mcd_publish_date,display_id\n39995,2,PGx LCD,2026-01-01,,2026-01-15,,Active,2026-07-01,2026-01-01,L39995\n");
    write(root, "current_lcd", "lcd_x_contractor.csv", "lcd_id,lcd_version,contractor_id,contractor_type_id,contractor_version,last_updated\n39995,2,10,12,1,2026-07-01\n");
    const plan = buildPgxCmsImportPlan(root);
    const summary = summarizePgxCmsImportPlan(plan);
    assert.equal(summary.allMacVersions, 2);
    assert.deepEqual(summary.targetStates, ["NY"]);
    assert.equal(summary.quarantineCount, 0);
    assert.ok(summary.codeLinks >= 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
