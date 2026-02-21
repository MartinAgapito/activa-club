# Senior DevOps Engineer - ActivaClub Memory

## Project Fundamentals
- Region: us-east-1 | Active env: production | Provider: hashicorp/aws ~> 5.0 | TF >= 1.6
- AWS Account ID: 583075178346
- GitHub repo: MartinAgapito/activa-club (confirm with `git remote -v` — NOT MartinMontanari)
- AWS Profile local: activaclub-prd
- Backend: S3 remote (`activa-club-tfstate-583075178346`) + DynamoDB lock (`activa-club-tflock`). Bootstrap uses `backend "local" {}`.
- Shell: MINGW64 (Git Bash on Windows). Always use forward slashes.

## Infrastructure Layout (current clean state)
- Bootstrap (run once): `infrastructure/bootstrap/` — main.tf, iam-cicd.tf, variables.tf, outputs.tf
- Production env: `infrastructure/envs/production/` — main.tf, variables.tf, outputs.tf
- DynamoDB module: `infrastructure/modules/dynamodb/` — main.tf, variables.tf, outputs.tf
- Cognito module: `infrastructure/modules/cognito/` — main.tf, variables.tf, outputs.tf
- CI/CD workflow: `.github/workflows/terraform-production.yml`
- Dead folder: `infrastructure/envs/dev/` — only README.md. DO NOT recreate tf files there.

## Naming Conventions
| Resource        | Pattern                                                  |
|-----------------|----------------------------------------------------------|
| DynamoDB table  | `<PascalCase>Table-${var.env}`                           |
| Cognito pool    | `activa-club-${var.env}`                                 |
| Lambda          | `activa-club-<service>-${var.env}`                       |
| IAM role        | `activa-club-<service>-role-${var.env}`                  |
| S3 bucket       | `activa-club-<purpose>-<account_id>-${var.env}`          |
| TF state bucket | `activa-club-tfstate-<account_id>` (no env — shared)     |
| TF lock table   | `activa-club-tflock` (no env suffix — shared)            |
| CI/CD role      | `activa-club-cicd-role` (bootstrap, no env suffix)       |

## Terraform Module Conventions
- Data sources live in `main.tf`, not in `outputs.tf`.
- DynamoDB: `enable_pitr = false` default; set `true` for production tables.
- SSE enabled on all DynamoDB tables (`server_side_encryption { enabled = true }`).
- `range_key` defaults to `""`. In resource: `range_key = var.range_key != "" ? var.range_key : null`.

## Module Input Contracts
- `modules/dynamodb`: table_name, env, billing_mode, hash_key, range_key (default ""), attributes, global_secondary_indexes (default []), enable_pitr (default false), tags
- `modules/cognito`: env, project (default "activa-club"), tags
  - All Cognito config is fixed inside the module (no variables for password policy, groups, etc.)
  - 3 groups: Admin (p=1), Manager (p=2), Member (p=3). self-registration disabled.

## Bootstrap Details
- `github_org` has NO default — must be passed: `terraform apply -var="github_org=MartinAgapito"`
- OIDC sub condition uses wildcard: `repo:${github_org}/${github_repo}:*` (not main-only)
- OIDC thumbprints: `6938fd4d98bab03faadb97b34396831e3780aea1`, `1c58a3a8518e8759bf075b76b750d4f2df264fcd`
- Outputs: `state_bucket_name`, `lock_table_name`, `cicd_role_arn`

## Production Environment (infrastructure/envs/production/)
- `module.members_table`: MembersTable-production, PK(S)+SK(S), GSI1 (GSI1PK/GSI1SK, ALL projection), PITR=true
- `module.seed_members_table`: SeedMembersTable-production, hash=DNI(S) only, no GSIs, PITR=false
- `module.cognito`: activa-club-production user pool + app client + domain
- Outputs: members_table_name/arn, seed_members_table_name/arn, cognito_user_pool_id, cognito_app_client_id, cognito_issuer_url, cognito_user_pool_domain

## CI/CD Workflow
- Trigger: push to ANY branch OR PR to main, paths `infrastructure/**`
- Single job `terraform` with `environment: production` (manual approval gate on GitHub)
- Role ARN hard-coded in workflow: `arn:aws:iam::583075178346:role/activa-club-cicd-role`
- Backend config passed via `-backend-config` flags (not secrets) at init time
- Apply runs ONLY on `github.ref == 'refs/heads/main' && github.event_name == 'push'`
- No GitHub secrets needed (role ARN and bucket names are not secrets)

## Security Rules
- No AWS Secrets Manager (cost). Use SSM Parameter Store (Standard, free).
- No static IAM access keys. OIDC only for GitHub Actions.
- S3 buckets private; CloudFront OAC for frontend access.
- Cognito: no client secret, ALLOW_USER_PASSWORD_AUTH + ALLOW_USER_SRP_AUTH + ALLOW_REFRESH_TOKEN_AUTH.
- `allow_admin_create_user_only = true` (DNI match required before Cognito account creation).
