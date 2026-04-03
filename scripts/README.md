# Scripts - ActivaClub

Utility scripts for data seeding, imports, and administrative tasks.

## Contents

| Script                      | Purpose                                                     |
|-----------------------------|-------------------------------------------------------------|
| `seed-legacy-members.ts`    | Import pre-existing member data into SeedMembersTable       |
| `seed-areas.ts`             | Seed initial recreational areas into AreasTable             |
| `seed-dev-users.ts`         | Create Cognito test users for local development             |
| `export-members.ts`         | Export member list to JSON for reporting                    |

## Prerequisites

Before running any script from your local machine:

1. **Node.js** — version 18 or higher (`node -v` to check)
2. **AWS credentials** — configured via `aws configure` or a named profile (`~/.aws/credentials`)
3. **Dependencies installed:**

```bash
cd scripts
npm install
```

## Running Scripts

```bash
cd scripts
npx ts-node seed-legacy-members.ts --env dev --file ./data/legacy-members.json
```

## Legacy Data Import (seed-legacy-members.ts)

Reads a JSON array of pre-existing member records and writes each one into
`SeedMembersTable-<env>`. Used as the **precondition of AC-001**: the registration
flow validates every DNI against this table before creating a Cognito user.

### Behaviour

1. Loads and validates every record in the JSON file.
2. Writes each valid record with `PutItem` (upsert — existing records are overwritten with the new data).
3. Skips invalid records with a warning; does not interrupt the rest of the import.
4. Prints progress per record and a final summary (inserted / skipped / errors).
5. Exits with code `1` if any validation or write error occurred.

### JSON Format

```json
[
  {
    "dni":            "20345678",
    "firstName":      "Juan",
    "lastName":       "Pérez",
    "membershipTier": "Gold",
    "email":          "juan.perez@email.com",
    "phone":          "+5491112345678",
    "accountStatus":  "active"
  }
]
```

| Field           | Required | Values                  | Notes                          |
|-----------------|----------|-------------------------|--------------------------------|
| `dni`           | yes      | 7–8 numeric digits      |                                |
| `firstName`     | yes      | string                  |                                |
| `lastName`      | yes      | string                  |                                |
| `membershipTier`| yes      | `VIP` \| `Gold` \| `Silver` | case-insensitive           |
| `email`         | no       | string                  | stored in lowercase            |
| `phone`         | no       | string                  |                                |
| `accountStatus` | yes      | `active` \| `inactive`  | invalid value → record skipped |

### Options

```
--env <env>      Derives table name as SeedMembersTable-<env>
--table <name>   Explicit DynamoDB table name (overrides --env)
--file <path>    Path to the JSON file (required)
--region <r>     AWS region (default: us-east-1)
--profile <p>    AWS CLI named profile
--dry-run        Validate without writing to DynamoDB
```

### Examples

```bash
# Validate first without writing
npx ts-node seed-legacy-members.ts --env dev --file ./data/legacy-members.json --dry-run

# Run against dev environment with local AWS profile
npx ts-node seed-legacy-members.ts --env dev --file ./data/legacy-members.json --profile activaclub-prd

# Explicit table name
npx ts-node seed-legacy-members.ts --table SeedMembersTable-dev --file ./data/legacy-members.json
```

## Environment Configuration

Scripts read AWS config from environment variables or `~/.aws/credentials`.
Table names are derived from `--env` (e.g. `SeedMembersTable-dev`) or passed explicitly via `--table`.
