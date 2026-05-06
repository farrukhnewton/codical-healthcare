import "dotenv/config";
import { ensureDatabaseSchema, pool } from "./db";

async function seed() {
  console.log("Preparing schema and seeding reference data...");
  await ensureDatabaseSchema();
  console.log("Seed complete.");
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
