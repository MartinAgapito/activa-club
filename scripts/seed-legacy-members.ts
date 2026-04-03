/**
 * seed-legacy-members.ts
 *
 * Imports pre-existing member records from a JSON or CSV file into SeedMembersTable.
 * This table is used by the registration flow to:
 *   1. Validate that the DNI belongs to an existing club member.
 *   2. Enforce account_status (active/inactive) before creating a Cognito user.
 *   3. Provide full_name and membership_type for the DynamoDB profile created
 *      at verify-email time.
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
 *       "accountStatus": "active",        // required — active | inactive
 *       "email":         "j@email.com",  // optional
 *       "phone":         "+541112345678"  // optional
 *     }
 *   ]
 *
 * Behaviour:
 *   - Upsert: PutItem without condition — existing DNI records are overwritten.
 *   - Skips records with invalid fields and logs a warning for each.
 *   - Prints progress for each record and a final summary (inserted / skipped / errors).
 *   - --dry-run validates every record and prints what would be written, without touching DynamoDB.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

// ─── Types ────────────────────────────────────────────────────────────────────

type MembershipTier = 'VIP' | 'Gold' | 'Silver';
type AccountStatus  = 'active' | 'inactive';

interface RawRecord {
  dni?:            unknown;
  firstName?:      unknown;
  lastName?:       unknown;
  membershipTier?: unknown;
  accountStatus?:  unknown;
  email?:          unknown;
  phone?:          unknown;
}

interface ValidRecord {
  index:          number;
  dni:            string;
  fullName:       string;
  membershipType: MembershipTier;
  accountStatus:  AccountStatus;
  email?:         string;
  phone?:         string;
  importedAt:     string;
}

interface RecordError {
  index:  number;
  dni:    string;
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
  let env:     string | null = null;
  let table:   string | null = null;
  let file     = '';
  let region   = 'us-east-1';
  let profile: string | null = null;
  let dryRun   = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--env':     env     = args[++i]; break;
      case '--table':   table   = args[++i]; break;
      case '--file':    file    = args[++i]; break;
      case '--region':  region  = args[++i]; break;
      case '--profile': profile = args[++i]; break;
      case '--dry-run': dryRun  = true;      break;
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
  npx ts-node seed-legacy-members.ts --env <dev|production> --file <path> [options]
  npx ts-node seed-legacy-members.ts --table <tableName>    --file <path> [options]

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

function normaliseStatus(raw: unknown): AccountStatus | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (v === 'active')   return 'active';
  if (v === 'inactive') return 'inactive';
  return null;
}

function validateRecord(
  raw: RawRecord,
  index: number,
  importedAt: string,
): ValidRecord | RecordError {
  const dniRaw = typeof raw.dni === 'string' ? raw.dni.trim() : String(raw.dni ?? '').trim();

  if (!/^\d{7,8}$/.test(dniRaw)) {
    return { index, dni: dniRaw || '?', reason: `"dni" must be 7–8 numeric digits, got "${raw.dni ?? ''}"` };
  }

  const firstName = typeof raw.firstName === 'string' ? raw.firstName.trim() : '';
  if (!firstName) {
    return { index, dni: dniRaw, reason: '"firstName" is required' };
  }

  const lastName = typeof raw.lastName === 'string' ? raw.lastName.trim() : '';
  if (!lastName) {
    return { index, dni: dniRaw, reason: '"lastName" is required' };
  }

  const membershipType = normaliseTier(raw.membershipTier);
  if (!membershipType) {
    return {
      index, dni: dniRaw,
      reason: `"membershipTier" must be VIP | Gold | Silver, got "${raw.membershipTier ?? ''}"`,
    };
  }

  const accountStatus = normaliseStatus(raw.accountStatus);
  if (accountStatus === null) {
    return {
      index, dni: dniRaw,
      reason: `"accountStatus" must be active | inactive, got "${raw.accountStatus ?? ''}"`,
    };
  }

  const record: ValidRecord = {
    index,
    dni:            dniRaw,
    fullName:       `${firstName} ${lastName}`,
    membershipType,
    accountStatus,
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

// ─── File loaders ─────────────────────────────────────────────────────────────

function readFile(filePath: string): string {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`Error: file not found: ${absPath}`);
    process.exit(1);
  }
  return fs.readFileSync(absPath, 'utf-8');
}

function parseJson(content: string): RawRecord[] {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    console.error('Error: could not parse JSON file.');
    process.exit(1);
  }
  if (!Array.isArray(raw)) {
    console.error('Error: JSON file must contain an array of objects at the root level.');
    process.exit(1);
  }
  return raw as RawRecord[];
}

function loadFile(filePath: string): { records: ValidRecord[]; errors: RecordError[] } {
  const content    = readFile(filePath);
  const rawRecords = parseJson(content);

  const importedAt = new Date().toISOString();
  const records: ValidRecord[] = [];
  const errors: RecordError[]  = [];

  rawRecords.forEach((item, i) => {
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
): Promise<void> {
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
      // No ConditionExpression — upsert: overwrites existing record for the same DNI.
    }),
  );
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
  console.log('Loading file...');
  const { records, errors: validationErrors } = loadFile(file);

  if (validationErrors.length > 0) {
    console.log(`\n⚠  Skipped records (${validationErrors.length} invalid):\n`);
    for (const e of validationErrors) {
      console.warn(`  [${e.index}] DNI=${e.dni} — ${e.reason}`);
    }
    console.log('');
  }

  console.log(`  Total loaded : ${records.length + validationErrors.length}`);
  console.log(`  Valid        : ${records.length}`);
  console.log(`  Skipped      : ${validationErrors.length}`);
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
    console.log(`\nDry-run complete. ${records.length} records would be written.`);
    process.exit(0);
  }

  // ── Live write ──
  if (profile) {
    process.env['AWS_PROFILE'] = profile;
  }

  const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
    marshallOptions: { removeUndefinedValues: true },
  });

  console.log('Writing to DynamoDB...\n');

  let inserted    = 0;
  let writeErrors = 0;

  for (const record of records) {
    const counter = `[${String(inserted + writeErrors + 1).padStart(3)}/${String(records.length).padStart(3)}]`;
    process.stdout.write(`  ${counter} DNI=${record.dni} — `);

    try {
      await putItem(docClient, tableName, record);
      inserted++;
      console.log(`inserted  (${record.fullName} / ${record.membershipType} / ${record.accountStatus})`);
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
  console.log(`  Total processed   : ${records.length + validationErrors.length}`);
  console.log(`  Skipped (invalid) : ${validationErrors.length}`);
  console.log(`  Inserted          : ${inserted}`);
  console.log(`  Errors            : ${writeErrors}`);
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
