# Scripts - ActivaClub

Utility scripts for data seeding, imports, and administrative tasks.

## Contents

| Script                      | Purpose                                                |
|-----------------------------|--------------------------------------------------------|
| `seed-legacy-members.ts`    | Import pre-existing member DNI data into MembersTable  |
| `seed-areas.ts`             | Seed initial recreational areas into AreasTable        |
| `seed-dev-users.ts`         | Create Cognito test users for local development        |
| `export-members.ts`         | Export member list to CSV for reporting                |

## Running Scripts

Scripts use `ts-node` and assume AWS credentials are configured.

```bash
cd scripts
npm install
npx ts-node seed-legacy-members.ts --env dev --file ./data/legacy-members.csv
```

## Legacy Data Import (seed-legacy-members.ts)

The club provides a CSV with pre-existing member DNI records.
The script:
1. Reads the CSV file
2. Validates each row (required: `dni`, `firstName`, `lastName`)
3. Writes items to `MembersTable` with `status=Pending` (not yet onboarded via app)
4. Skips duplicates (conditional put on `GSI_DNI`)
5. Outputs a summary: total processed, inserted, skipped, errors

### CSV Format Expected

```csv
dni,firstName,lastName,email,membershipTier
12345678,Juan,Perez,juan@example.com,Silver
87654321,Maria,Garcia,maria@example.com,Gold
```

## Environment Configuration

Scripts read AWS config from environment variables or `~/.aws/credentials`.
DynamoDB table names are passed via `--env` flag or directly as arguments.
