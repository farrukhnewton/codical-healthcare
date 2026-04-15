import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const PAYERS = [
  {
    name: "UnitedHealthcare",
    shortName: "UHC",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/23/UnitedHealthcare_logo.svg",
    policyPortalUrl: "https://www.uhcprovider.com/en/policies-protocols.html",
    paPortalUrl: "https://www.uhcprovider.com/en/prior-auth.html",
    phone: "888-817-3818"
  },
  {
    name: "Aetna (CVS Health)",
    shortName: "Aetna",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Aetna_logo.svg/1200px-Aetna_logo.svg.png",
    policyPortalUrl: "https://www.aetna.com/medical-policy-bulletins.html",
    paPortalUrl: "https://www.aetna.com/healthcare-professionals/precertification.html",
    phone: "800-624-0756"
  },
  {
    name: "Cigna",
    shortName: "Cigna",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Cigna_logo.svg",
    policyPortalUrl: "https://cignaforhcp.cigna.com/public/content/clinical-payment-coding-policies",
    paPortalUrl: "https://cignaforhcp.cigna.com/public/content/prior-authorization-forms",
    phone: "800-882-4462"
  },
  {
    name: "Anthem Blue Cross Blue Shield",
    shortName: "Anthem",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Anthem_logo.svg/2560px-Anthem_logo.svg.png",
    policyPortalUrl: "https://www.anthem.com/provider/medical-policies-and-clinical-guidelines/",
    paPortalUrl: "https://www.anthem.com/provider/prior-authorization/",
    phone: "800-676-2583"
  },
  {
    name: "Humana",
    shortName: "Humana",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c7/Humana_logo.svg",
    policyPortalUrl: "https://www.humana.com/provider/medical-resources/clinical-resources/medical-policies",
    paPortalUrl: "https://www.humana.com/provider/medical-resources/prior-authorization",
    phone: "800-448-6262"
  },
  {
    name: "Kaiser Permanente",
    shortName: "KP",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Kaiser_Permanente_Logo.svg/1200px-Kaiser_Permanente_Logo.svg.png",
    policyPortalUrl: "https://provider.ghc.org/all-sites/clinical/guidelines/",
    paPortalUrl: "https://provider.ghc.org/all-sites/prior-authorization/",
    phone: "800-813-2000"
  },
  {
    name: "Centene (Ambetter)",
    shortName: "Centene",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/05/Centene_Corporation_logo.svg",
    policyPortalUrl: "https://www.centene.com/providers/medical-policies.html",
    paPortalUrl: "https://www.centene.com/providers/prior-authorization.html",
    phone: "866-514-4194"
  },
  {
    name: "Molina Healthcare",
    shortName: "Molina",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Molina_Healthcare_Logo.svg/2560px-Molina_Healthcare_Logo.svg.png",
    policyPortalUrl: "https://www.molinahealthcare.com/providers/common/medical-policies/",
    paPortalUrl: "https://www.molinahealthcare.com/providers/common/prior-auth/",
    phone: "888-562-5442"
  },
  {
    name: "Blue Cross Blue Shield (Federal)",
    shortName: "BCBS FEP",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Cross_and_Blue_Shield_logo.svg/1200px-Blue_Cross_and_Blue_Shield_logo.svg.png",
    policyPortalUrl: "https://www.fepblue.org/benefit-plans/medical-policies",
    paPortalUrl: "https://www.fepblue.org/benefit-plans/prior-approval",
    phone: "800-411-2583"
  },
  {
    name: "TRICARE",
    shortName: "TRICARE",
    logoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Tricare_logo.svg/1200px-Tricare_logo.svg.png",
    policyPortalUrl: "https://manuals.health.mil/pages/DisplayManual.aspx?DocId=68",
    paPortalUrl: "https://tricare.mil/PriorAuth",
    phone: "877-874-2273"
  }
];

async function seedPayers() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

  try {
    for (const payer of PAYERS) {
      await pool.query(
        `INSERT INTO commercial_payers (name, short_name, logo_url, policy_portal_url, pa_portal_url, phone)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (name) DO UPDATE SET 
         short_name = EXCLUDED.short_name,
         logo_url = EXCLUDED.logo_url,
         policy_portal_url = EXCLUDED.policy_portal_url,
         pa_portal_url = EXCLUDED.pa_portal_url,
         phone = EXCLUDED.phone`,
        [payer.name, payer.shortName, payer.logoUrl, payer.policyPortalUrl, payer.paPortalUrl, payer.phone]
      );
      console.log(`✅ Seeded payer: ${payer.name}`);
    }
    console.log("Seeding finished.");
  } catch (err) {
    console.error("Error seeding payers:", err);
  } finally {
    await pool.end();
  }
}

seedPayers();
