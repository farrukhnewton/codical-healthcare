// scripts/seed-cms-registry.mjs
// Run with: node scripts/seed-cms-registry.mjs
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import { readFileSync } from "fs";

// Load .env manually
const envFile = readFileSync(".env", "utf8");
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DATASETS = [
  { uuid: "6395b458-2f89-4828-8c1a-e1e16b723d48", title: "CERT Error Testing", category: "Compliance", notes: "Comprehensive Error Rate Testing data for compliance monitoring" },
  { uuid: "2457ea29-fc82-48b0-86ec-3b0755de7515", title: "FFS Provider Enrollment", category: "Provider", notes: "Fee-for-service provider enrollment data" },
  { uuid: "113eb0bc-0c9a-4d91-9f93-3f6b28c0bf6b", title: "Taxonomy Crosswalk", category: "Provider", notes: "Provider taxonomy code crosswalk reference" },
  { uuid: "09fd71b8-eb3e-45af-a01e-f8ab5a190e84", title: "Part B Discarded Drug Units", category: "Drugs", notes: "Medicare Part B discarded drug and biological units reporting" },
  { uuid: "bf6a5b3b-31ee-4abb-b1ad-2607a1e7510a", title: "Part B Drug Spending", category: "Drugs", notes: "Medicare Part B drug spending by drug and manufacturer" },
  { uuid: "4ff7c618-4e40-483a-b390-c8a58c94fa15", title: "Part D Drug Spending", category: "Drugs", notes: "Medicare Part D drug spending dashboard data" },
  { uuid: "cb2a224f-4d52-4cae-aa55-8c00c671384f", title: "PDP Formulary & Network", category: "Drugs", notes: "Prescription Drug Plan formulary and pharmacy network files" },
  { uuid: "939226be-b107-476e-8777-f199a840138a", title: "Telehealth Trends", category: "Utilization", notes: "Medicare telehealth trends and utilization data" },
  { uuid: "a2d56d3f-3531-4315-9d87-e29986516b41", title: "DME Utilization (A)", category: "Utilization", notes: "Durable Medical Equipment utilization and payment data" },
  { uuid: "6a3aa708-3c9d-411a-a1a4-e046d3ade7ef", title: "Hospital Price Transparency Enforcement", category: "Compliance", notes: "Hospital price transparency enforcement actions and compliance" },
];

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS cms_dataset_registry (
        uuid TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'General',
        enabled BOOLEAN NOT NULL DEFAULT true,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("Table cms_dataset_registry ready.");

    for (const ds of DATASETS) {
      await client.query(
        `INSERT INTO cms_dataset_registry (uuid, title, category, enabled, notes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (uuid) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, notes = EXCLUDED.notes`,
        [ds.uuid, ds.title, ds.category, true, ds.notes]
      );
      console.log("Seeded:", ds.title);
    }
    console.log("Done. All datasets seeded.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
