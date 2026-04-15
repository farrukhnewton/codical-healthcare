import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function applyMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not defined in .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    const migrationPath = path.join(process.cwd(), 'migrations', '0001_amused_genesis.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const statements = sql.split('--> statement-breakpoint');

    console.log(`Found ${statements.length} statements to execute.`);

    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed) continue;

      try {
        await pool.query(trimmed);
        console.log('✅ Statement executed successfully');
      } catch (err: any) {
        if (err.message.includes('already exists')) {
          console.log(`⚠️  Skipping: ${err.message}`);
        } else {
          console.error(`❌ Error executing statement: ${err.message}`);
          console.error('Statement:', trimmed);
        }
      }
    }

    console.log('Migration finished.');
  } catch (err) {
    console.error('Error reading migration file:', err);
  } finally {
    await pool.end();
  }
}

applyMigration();
