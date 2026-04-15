import { db } from "./db";
import { icd10Codes, cptCodes, hcpcsCodes, guidelines, users } from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  // Ensure default user
  const [existingUser] = await db.select().from(users).limit(1);
  if (!existingUser) {
    await db.insert(users).values({ username: "coder1", role: "coder" });
  }

  const icdData = [
    { code: "E11.9", description: "Type 2 diabetes mellitus without complications", guideline: "Use additional code to identify control using insulin." },
    { code: "I10", description: "Essential (primary) hypertension", guideline: "Includes high blood pressure." },
    { code: "Z00.00", description: "Encounter for general adult medical examination without abnormal findings" },
    { code: "J45.909", description: "Unspecified asthma, uncomplicated" },
    { code: "M54.50", description: "Low back pain, unspecified" }
  ];

  const cptData = [
    { code: "99213", description: "Office or other outpatient visit for the evaluation and management of an established patient (low level)" },
    { code: "99214", description: "Office or other outpatient visit (moderate level)" },
    { code: "90658", description: "Influenza virus vaccine, trivalent" },
    { code: "80053", description: "Comprehensive metabolic panel" },
    { code: "36415", description: "Collection of venous blood by venipuncture" }
  ];

  const hcpcsData = [
    { code: "G0439", description: "Annual wellness visit, subsequent" },
    { code: "A0429", description: "Ambulance service, basic life support, emergency transport" },
    { code: "J1745", description: "Injection, infliximab, excludes biosimilar, 10 mg" },
    { code: "E0431", description: "Portable gaseous oxygen system, rental" },
    { code: "V2020", description: "Frames, purchases" }
  ];

  for (const item of icdData) {
    await db.insert(icd10Codes).values(item as any).onConflictDoNothing();
  }
  for (const item of cptData) {
    await db.insert(cptCodes).values(item as any).onConflictDoNothing();
  }
  for (const item of hcpcsData) {
    await db.insert(hcpcsCodes).values(item as any).onConflictDoNothing();
  }

  console.log("Seed complete.");
}

seed().catch(console.error);
