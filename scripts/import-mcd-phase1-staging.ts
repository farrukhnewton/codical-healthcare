import "dotenv/config";
import fs from "node:fs";
import pg from "pg";

const { Pool } = pg;

if (!process.argv.includes("--allow-supabase-mcd-import")) {
  console.error(
    [
      "Refusing to import CMS MCD data into Supabase.",
      "The CMS dataset has moved to the Cloudflare D1/R2 pipeline because Supabase free-tier database space is reserved for app/user data.",
      "Pass --allow-supabase-mcd-import only if you intentionally want to recreate the old Supabase CMS staging tables.",
    ].join("\n"),
  );
  process.exit(1);
}

const BATCH_SIZE = Math.max(50, Math.min(Number(process.env.MCD_IMPORT_BATCH_SIZE || 500), 1000));
const shouldTruncate = !process.argv.includes("--no-truncate");

type ManifestRow = {
  dataset_key: string;
  csv_table_name: string;
  staging_table_name: string;
  source_file_name: string;
  local_upload_path: string;
  expected_rows: string;
  expected_columns: number;
  headers: string[];
};

function quoteIdent(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") {
        i++;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function assertHeaderMatches(filePath: string, actual: string[], expected: string[]) {
  const sameLength = actual.length === expected.length;
  const sameNames = sameLength && actual.every((header, index) => header === expected[index]);

  if (!sameNames) {
    throw new Error(
      [
        `Header mismatch for ${filePath}`,
        `Expected (${expected.length}): ${expected.join(", ")}`,
        `Actual (${actual.length}): ${actual.join(", ")}`,
      ].join("\n"),
    );
  }
}

async function insertBatch(
  pool: pg.Pool,
  tableName: string,
  headers: string[],
  rows: string[][],
  importBatchId: string,
  sourceFile: string,
  sourceDataset: string,
) {
  if (rows.length === 0) return;

  const insertColumns = [...headers, "import_batch_id", "source_file", "source_dataset"];
  const values: string[] = [];
  const params: string[] = [];
  const valueWidth = insertColumns.length;

  rows.forEach((row, rowIndex) => {
    if (row.length !== headers.length) {
      throw new Error(`Row has ${row.length} columns, expected ${headers.length} for ${tableName}`);
    }

    const rowValues = [...row, importBatchId, sourceFile, sourceDataset];
    rowValues.forEach((value) => params.push(value));
    const placeholders = Array.from({ length: valueWidth }, (_, columnIndex) => {
      return `$${rowIndex * valueWidth + columnIndex + 1}`;
    });
    values.push(`(${placeholders.join(", ")})`);
  });

  await pool.query(
    `insert into ${quoteIdent(tableName)} (${insertColumns.map(quoteIdent).join(", ")}) values ${values.join(", ")}`,
    params,
  );
}

async function importOne(pool: pg.Pool, item: ManifestRow) {
  const filePath = item.local_upload_path;
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing CSV file: ${filePath}`);
  }

  if (shouldTruncate) {
    await pool.query(`truncate table ${quoteIdent(item.staging_table_name)}`);
  }

  const started = await pool.query<{ id: string }>(
    `insert into "mcd_import_batches" ("dataset_key", "dataset_scope", "source_file_name", "source_table_name", "source_path", "row_count", "status", "started_at")
     values ($1, 'current', $2, $3, $4, $5, 'running', now())
     returning "id"`,
    [item.dataset_key, item.source_file_name, item.staging_table_name, filePath, Number(item.expected_rows)],
  );
  const importBatchId = started.rows[0].id;

  try {
    const parsed = parseCsv(fs.readFileSync(filePath, "utf8"));
    const [header, ...rows] = parsed;

    assertHeaderMatches(filePath, header, item.headers);

    let inserted = 0;
    for (let index = 0; index < rows.length; index += BATCH_SIZE) {
      const batch = rows.slice(index, index + BATCH_SIZE);
      await insertBatch(
        pool,
        item.staging_table_name,
        item.headers,
        batch,
        importBatchId,
        item.source_file_name,
        item.dataset_key,
      );
      inserted += batch.length;
    }

    const countResult = await pool.query<{ count: string }>(
      `select count(*)::text as count from ${quoteIdent(item.staging_table_name)}`,
    );
    const actualRows = Number(countResult.rows[0].count);
    const expectedRows = Number(item.expected_rows);

    if (inserted !== expectedRows || actualRows !== expectedRows) {
      throw new Error(
        `Row count mismatch for ${item.staging_table_name}: inserted=${inserted}, actual=${actualRows}, expected=${expectedRows}`,
      );
    }

    await pool.query(
      `update "mcd_import_batches"
       set "status" = 'completed', "completed_at" = now(), "updated_at" = now(), "row_count" = $2
       where "id" = $1`,
      [importBatchId, actualRows],
    );

    return actualRows;
  } catch (error: any) {
    await pool.query(
      `update "mcd_import_batches"
       set "status" = 'failed', "completed_at" = now(), "updated_at" = now(), "error_message" = $2
       where "id" = $1`,
      [importBatchId, error?.message || String(error)],
    );
    throw error;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const manifestResult = await pool.query<ManifestRow>(
      `select "dataset_key", "csv_table_name", "staging_table_name", "source_file_name",
              "local_upload_path", "expected_rows", "expected_columns", "headers"
       from "mcd_phase1_staging_manifest"
       order by "dataset_key", "csv_table_name"`,
    );

    const manifest = manifestResult.rows;
    if (manifest.length === 0) {
      throw new Error("No rows found in mcd_phase1_staging_manifest.");
    }

    console.log(`Importing ${manifest.length} CMS MCD CSV files with batch size ${BATCH_SIZE}...`);
    if (shouldTruncate) {
      console.log("Existing staging rows will be truncated first.");
    }

    let totalRows = 0;
    for (const item of manifest) {
      const rows = await importOne(pool, item);
      totalRows += rows;
      console.log(`${item.staging_table_name}: ${rows.toLocaleString()} rows`);
    }

    console.log(`Imported ${totalRows.toLocaleString()} rows into Phase 1 staging tables.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
