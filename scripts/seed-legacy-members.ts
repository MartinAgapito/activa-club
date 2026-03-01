/**
 * seed-legacy-members.ts
 *
 * Imports pre-existing member records from a JSON file into SeedMembersTable.
 * This table is used by the registration flow (AC-001) to:
 *   1. Validate that the DNI belongs to an existing club member.
 *   2. Enforce account_status (active/inactive) before creating a Cognito user.
 *   3. Provide full_name and membership_type for the DynamoDB profile created
 *      at verify-email time (Step 2 of AC-001).
 *
 * Usage:
 *   npx ts-node seed-legacy-members.ts --env dev --file ./data/legacy-members.json
 *   npx ts-node seed-legacy-members.ts --table SeedMembersTable-dev --file ./data/legacy-members.json
 *   npx ts-node seed-legacy-members.ts --env dev --file ./data/legacy-members.json --dry-run
 *
 * JSON format (array of objects):
 *   [
 *     {
 *       "dni":           "20345678",      // required — 7–8 numeric digits
 *       "firstName":     "Juan",          // required
 *       "lastName":      "Pérez",         // required
 *       "membershipTier":"Gold",          // required — VIP | Gold | Silver
 *       "email":         "j@email.com",  // optional
 *       "phone":         "+541112345678", // optional
 *       "accountStatus": "active"         // optional — active | inactive (default: active)
 *     }
 *   ]
 *
 * Behaviour:
 *   - Skips duplicates: ConditionExpression ensures an existing DNI is never overwritten.
 *   - Prints progress for each record and a final summary.
 *   - Exits with code 1 if any record produced a validation or write error.
 *   - --dry-run validates every record and prints what would be written, without touching DynamoDB.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

// ─── Types ────────────────────────────────────────────────────────────────────

type MembershipTier  = 'VIP' | 'Gold' | 'Silver';
type AccountStatus   = 'active' | 'inactive';

interface RawRecord {
  dni?:           unknown;
  firstName?:     unknown;
  lastName?:      unknown;
  membershipTier?:unknown;
  email?:         unknown;
  phone?:         unknown;
  accountStatus?: unknown;
}

interface ValidRecord {
  index:         number;
  dni:           string;
  fullName:      string;
  membershipType:MembershipTier;
  accountStatus: AccountStatus;
  email?:        string;
  phone?:        string;
  importedAt:    string;
}

interface RecordError {
  index:  number;
  raw:    RawRecord;
  reason: string;
}

// ─── CLI argument parsing ─────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  tableName: string;
  file: string;
  region: string;
  profile: string | null;
  dryRun: boolean;
} {
  const args = argv.slice(2);
  let env: string | null = null;
  let table: string | null = null;
  let file = '';
  let region = 'us-east-1';
  let profile: string | null = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--env':    env     = args[++i]; break;
      case '--table':  table   = args[++i]; break;
      case '--file':   file    = args[++i]; break;
      case '--region': region  = args[++i]; break;
      case '--profile':profile = args[++i]; break;
      case '--dry-run':dryRun  = true;      break;
    }
  }

  if (!file) {
    console.error('Error: --file is required.');
    printUsage();
    process.exit(1);
  }

  if (!env && !table) {
    console.error('Error: either --env or --table is required.');
    printUsage();
    process.exit(1);
  }

  return {
    tableName: table ?? `SeedMembersTable-${env}`,
    file,
    region,
    profile,
    dryRun,
  };
}

function printUsage(): void {
  console.log(`
Usage:
  npx ts-node seed-legacy-members.ts --env <dev|production> --file <json-path> [options]
  npx ts-node seed-legacy-members.ts --table <tableName>    --file <json-path> [options]

Options:
  --env <env>      Derives table name as SeedMembersTable-<env>
  --table <name>   Explicit DynamoDB table name (overrides --env)
  --file <path>    Path to the JSON file (required)
  --region <r>     AWS region (default: us-east-1)
  --profile <p>    AWS CLI named profile
  --dry-run        Validate without writing to DynamoDB
`);
}

// ─── Validation ───────────────────────────────────────────────────────────────

const TIER_MAP: Record<string, MembershipTier> = {
  vip: 'VIP', gold: 'Gold', silver: 'Silver',
};

function normaliseTier(raw: unknown): MembershipTier | null {
  if (typeof raw !== 'string') return null;
  return TIER_MAP[raw.trim().toLowerCase()] ?? null;
}

function normaliseStatus(raw: unknown): AccountStatus {
  return typeof raw === 'string' && raw.trim().toLowerCase() === 'inactive'
    ? 'inactive'
    : 'active';
}

function validateRecord(
  raw: RawRecord,
  index: number,
  importedAt: string,
): ValidRecord | RecordError {
  const dni = typeof raw.dni === 'string' ? raw.dni.trim() : '';
  if (!/^\d{7,8}$/.test(dni)) {
    return { index, raw, reason: `"dni" must be 7–8 numeric digits, got "${raw.dni ?? ''}"` };
  }

  const firstName = typeof raw.firstName === 'string' ? raw.firstName.trim() : '';
  if (!firstName) {
    return { index, raw, reason: '"firstName" is required' };
  }

  const lastName = typeof raw.lastName === 'string' ? raw.lastName.trim() : '';
  if (!lastName) {
    return { index, raw, reason: '"lastName" is required' };
  }

  const membershipType = normaliseTier(raw.membershipTier);
  if (!membershipType) {
    return {
      index,
      raw,
      reason: `"membershipTier" must be VIP | Gold | Silver, got "${raw.membershipTier ?? ''}"`,
    };
  }

  const record: ValidRecord = {
    index,
    dni,
    fullName: `${firstName} ${lastName}`,
    membershipType,
    accountStatus: normaliseStatus(raw.accountStatus),
    importedAt,
  };

  if (typeof raw.email === 'string' && raw.email.trim()) {
    record.email = raw.email.trim().toLowerCase();
  }
  if (typeof raw.phone === 'string' && raw.phone.trim()) {
    record.phone = raw.phone.trim();
  }

  return record;
}

// ─── JSON loader ──────────────────────────────────────────────────────────────

function loadJson(filePath: string): { records: ValidRecord[]; errors: RecordError[] } {
  const absPath = path.resolve(filePath);

  if (!fs.existsSync(absPath)) {
    console.error(`Error: file not found: ${absPath}`);
    process.exit(1);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
  } catch {
    console.error(`Error: could not parse JSON from ${absPath}`);
    process.exit(1);
  }

  if (!Array.isArray(raw)) {
    console.error('Error: JSON file must contain an array of objects at the root level.');
    process.exit(1);
  }

  const importedAt = new Date().toISOString();
  const records: ValidRecord[] = [];
  const errors: RecordError[] = [];

  (raw as RawRecord[]).forEach((item, i) => {
    const result = validateRecord(item, i + 1, importedAt);
    if ('reason' in result) {
      errors.push(result);
    } else {
      records.push(result);
    }
  });

  return { records, errors };
}

// ─── DynamoDB write ───────────────────────────────────────────────────────────

async function putItem(
  docClient: DynamoDBDocumentClient,
  tableName: string,
  record: ValidRecord,
): Promise<'inserted' | 'skipped'> {
  try {
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          DNI:             record.dni,
          full_name:       record.fullName,
          membership_type: record.membershipType,
          account_status:  record.accountStatus,
          ...(record.email && { email: record.email }),
          ...(record.phone && { phone: record.phone }),
          imported_at:     record.importedAt,
        },
        // Never overwrite an existing record
        ConditionExpression: 'attribute_not_exists(DNI)',
      }),
    );
    return 'inserted';
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
      return 'skipped';
    }
    throw err;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { tableName, file, region, profile, dryRun } = parseArgs(process.argv);

  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║       ActivaClub — SeedMembersTable Importer         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Table  : ${tableName}`);
  console.log(`  Region : ${region}`);
  console.log(`  File   : ${path.resolve(file)}`);
  console.log(`  Mode   : ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE'}`);
  if (profile) console.log(`  Profile: ${profile}`);
  console.log('');

  // ── Load and validate ──
  console.log('Loading JSON...');
  const { records, errors: validationErrors } = loadJson(file);

  if (validationErrors.length > 0) {
    console.log(`\n⚠  Validation errors (${validationErrors.length} records will be skipped):\n`);
    for (const e of validationErrors) {
      console.log(`  [${e.index}] ${e.reason}`);
    }
    console.log('');
  }

  console.log(`  Total loaded : ${records.length + validationErrors.length}`);
  console.log(`  Valid        : ${records.length}`);
  console.log(`  Invalid      : ${validationErrors.length}`);
  console.log('');

  if (records.length === 0) {
    console.log('No valid records to import. Exiting.');
    process.exit(validationErrors.length > 0 ? 1 : 0);
  }

  // ── Dry-run ──
  if (dryRun) {
    console.log('DRY-RUN — records that would be written:\n');
    for (const r of records) {
      console.log(
        `  [${String(r.index).padStart(3)}] DNI=${r.dni} | ${r.fullName} | ${r.membershipType} | ${r.accountStatus}`,
      );
    }
    console.log(`\nDry-run complete. ${records.length} records would be attempted.`);
    process.exit(0);
  }

  // ── Live write ──
  // Setting AWS_PROFILE lets the SDK default credential chain pick up the named profile
  // without requiring @aws-sdk/credential-providers as an extra dependency.
  if (profile) {
    process.env['AWS_PROFILE'] = profile;
  }

  const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
    marshallOptions: { removeUndefinedValues: true },
  });

  console.log('Writing to DynamoDB...\n');

  let inserted    = 0;
  let skipped     = 0;
  let writeErrors = 0;

  for (const record of records) {
    const counter = `[${String(inserted + skipped + writeErrors + 1).padStart(3)}/${String(records.length).padStart(3)}]`;
    process.stdout.write(`  ${counter} DNI=${record.dni} — `);

    try {
      const outcome = await putItem(docClient, tableName, record);
      if (outcome === 'inserted') {
        inserted++;
        console.log(`inserted  (${record.fullName} / ${record.membershipType})`);
      } else {
        skipped++;
        console.log('skipped   (duplicate)');
      }
    } catch (err: unknown) {
      writeErrors++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`ERROR — ${msg}`);
    }
  }

  // ── Summary ──
  console.log('');
  console.log('══════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('══════════════════════════════════════════════════════');
  console.log(`  Total processed      : ${records.length + validationErrors.length}`);
  console.log(`  Validation errors    : ${validationErrors.length}`);
  console.log(`  Inserted             : ${inserted}`);
  console.log(`  Skipped (duplicates) : ${skipped}`);
  console.log(`  Write errors         : ${writeErrors}`);
  console.log('══════════════════════════════════════════════════════');
  console.log('');

  if (writeErrors > 0 || validationErrors.length > 0) {
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
