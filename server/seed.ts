import { db } from "./db";
import { icd10Codes, cptCodes, hcpcsCodes, guidelines, users, commercialPayers } from "@shared/schema";

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

  const payerData = [
    { name: "UnitedHealthcare", shortName: "UHC", policyPortalUrl: "https://www.uhcprovider.com/en/policies-protocols.html", paPortalUrl: "https://www.uhcprovider.com/en/prior-auth.html" },
    { name: "Aetna", shortName: "Aetna", policyPortalUrl: "https://www.aetna.com/health-care-professionals/clinical-policy-bulletins.html", paPortalUrl: "https://www.aetna.com/health-care-professionals/prior-authorization.html" },
    { name: "Cigna", shortName: "Cigna", policyPortalUrl: "https://www.cigna.com/health-care-professionals/medical-performance-clinical-policy/", paPortalUrl: "https://www.cigna.com/health-care-professionals/prior-authorization-precertification" },
    { name: "Humana", shortName: "Humana", policyPortalUrl: "https://www.humana.com/provider/medical-resources/clinical-resources/medical-policies", paPortalUrl: "https://www.humana.com/provider/medical-resources/prior-authorization" },
    { name: "Anthem Blue Cross", shortName: "Anthem", policyPortalUrl: "https://www.anthem.com/provider/medical-policies-clinical-guidelines/", paPortalUrl: "https://web.anthem.com/provider/prior-authorization" },
    { name: "Kaiser Permanente", shortName: "Kaiser", policyPortalUrl: "https://healthy.kaiserpermanente.org/health-wellness/health-encyclopedia/medical-policies", paPortalUrl: "https://provider.kaiserpermanente.org/" },
    { name: "Centene", shortName: "Centene", policyPortalUrl: "https://www.centene.com/health-plans/medical-policies.html", paPortalUrl: "https://www.centene.com/" },
    { name: "Molina Healthcare", shortName: "Molina", policyPortalUrl: "https://www.molinahealthcare.com/providers/common/medicaid/manual/pages/medpol.aspx", paPortalUrl: "https://provider.molinahealthcare.com/" },
    { name: "Blue Cross Blue Shield (National)", shortName: "BCBS", policyPortalUrl: "https://www.bcbs.com/medical-policy", paPortalUrl: "https://www.bcbs.com/prior-authorization" },
    { name: "Tricare", shortName: "Tricare", policyPortalUrl: "https://manuals.health.mil/pages/v3/DownloadManuals.aspx", paPortalUrl: "https://www.tricare-west.com/content/hnw/home/provider/auth.html" },
    { name: "CareSource", shortName: "CareSource", policyPortalUrl: "https://www.caresource.com/providers/tools-resources/medical-policies/", paPortalUrl: "https://www.caresource.com/providers/tools-resources/prior-authorization/" },
    { name: "Highmark", shortName: "Highmark", policyPortalUrl: "https://medicalpolicy.highmarkbluecrossblueshield.com/", paPortalUrl: "https://hb.highmark.com/" },
    { name: "Independence Blue Cross", shortName: "IBX", policyPortalUrl: "https://www.ibx.com/providers/guidelines-and-resources/medical-policy", paPortalUrl: "https://www.ibx.com/providers/authorization" },
    { name: "HCSC", shortName: "HCSC", policyPortalUrl: "https://www.hcsc.com/provider/clinical-guidelines", paPortalUrl: "https://www.hcsc.com/" },
    { name: "Blue Shield of California", shortName: "BSCA", policyPortalUrl: "https://www.blueshieldca.com/provider/guidelines/medical-policy/index.sp", paPortalUrl: "https://www.blueshieldca.com/provider/authorizations/" },
    { name: "Florida Blue", shortName: "FloridaBlue", policyPortalUrl: "https://www.floridablue.com/providers/medical-policies", paPortalUrl: "https://www.floridablue.com/providers/authorizations" },
    { name: "Horizon BCBS", shortName: "Horizon", policyPortalUrl: "https://www.horizonblue.com/providers/policies-procedures/medical-policy", paPortalUrl: "https://www.horizonblue.com/providers/authorizations" },
    { name: "WellCare", shortName: "WellCare", policyPortalUrl: "https://www.wellcare.com/Providers/Clinical-Guidelines", paPortalUrl: "https://www.wellcare.com/" },
    { name: "Amerigroup", shortName: "Amerigroup", policyPortalUrl: "https://provider.amerigroup.com/provider/medical-policies", paPortalUrl: "https://provider.amerigroup.com/authorizations" },
    { name: "Oscar Health", shortName: "Oscar", policyPortalUrl: "https://www.hioscar.com/providers/policies", paPortalUrl: "https://www.hioscar.com/providers/prior-authorization" },
  ];

  for (const payer of payerData) {
    await db.insert(commercialPayers).values(payer).onConflictDoNothing();
  }

  console.log("Seed complete.");
}

seed().catch(console.error);
