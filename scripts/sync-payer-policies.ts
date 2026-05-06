import "dotenv/config";
import { db, ensureDatabaseSchema } from "../server/db";
import { commercialPayers, payerPolicies } from "../shared/schema";
import { discoverPayerPolicies } from "../server/services/payer-policy-ingestion";
import { and, asc, eq } from "drizzle-orm";

const limitPerPayer = Math.min(Math.max(Number(process.env.PAYER_POLICY_LIMIT || 20), 1), 50);
const requestedPayers = (process.env.PAYER_POLICY_PAYERS || "")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

async function upsertPolicy(payerId: number, doc: Awaited<ReturnType<typeof discoverPayerPolicies>>[number]) {
  const existing = await db.query.payerPolicies.findFirst({
    where: and(
      eq(payerPolicies.payerId, payerId),
      eq(payerPolicies.sourceUrl, doc.sourceUrl)
    ),
  });
  const fetchedAt = new Date();
  const values = {
    payerId,
    title: doc.title,
    policyNumber: doc.policyNumber,
    documentType: doc.documentType,
    status: "indexed",
    effectiveDate: doc.effectiveDate,
    lastPublishedAt: doc.lastPublishedAt,
    cptCodes: doc.cptCodes,
    hcpcsCodes: doc.hcpcsCodes,
    drugCodes: doc.drugCodes,
    requirementsText: doc.requirementsText,
    isBillable: true,
    sourceUrl: doc.sourceUrl,
    sourceHost: doc.sourceHost,
    lastFetchedAt: fetchedAt,
    updatedAt: fetchedAt,
  };

  if (existing) {
    await db.update(payerPolicies).set(values).where(eq(payerPolicies.id, existing.id));
    return "updated";
  }

  await db.insert(payerPolicies).values(values);
  return "created";
}

async function main() {
  await ensureDatabaseSchema();
  const payers = await db.query.commercialPayers.findMany({
    orderBy: asc(commercialPayers.name),
  });
  const targets = requestedPayers.length
    ? payers.filter((payer) =>
        requestedPayers.includes(payer.name.toLowerCase()) ||
        requestedPayers.includes(String(payer.shortName || "").toLowerCase())
      )
    : payers;

  if (targets.length === 0) {
    throw new Error("No matching commercial payers found to sync.");
  }

  for (const payer of targets) {
    console.log(`Syncing ${payer.name}...`);
    try {
      const docs = await discoverPayerPolicies(payer, limitPerPayer);
      let created = 0;
      let updated = 0;
      for (const doc of docs) {
        const result = await upsertPolicy(payer.id, doc);
        if (result === "created") created += 1;
        if (result === "updated") updated += 1;
      }
      console.log(`${payer.name}: indexed ${docs.length}, created ${created}, updated ${updated}`);
    } catch (error: any) {
      console.warn(`${payer.name}: skipped (${error?.message || "sync unavailable"})`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
