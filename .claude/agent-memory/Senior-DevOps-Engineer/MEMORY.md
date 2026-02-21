# Senior DevOps Engineer - ActivaClub Memory

## Project Fundamentals
- Region: us-east-1 | Active env: production | Provider: hashicorp/aws ~> 5.0 | TF >= 1.6
- Backend: S3 remote (`activa-club-tfstate-<ACCOUNT_ID>`) + DynamoDB lock (`activa-club-tflock`). Bootstrap uses `backend "local" {}`.
- Shell: MINGW64 (Git Bash on Windows). Always use forward slashes. `terraform` is NOT in PATH yet.
- All resource physical names include `-${var.env}` suffix (e.g., `MembersTable-production`).

## Environment Layout
- Active env: `infrastructure/envs/production/` (main.tf, variables.tf, outputs.tf)
- Dead folder: `infrastructure/envs/dev/` — only README.md remains. DO NOT recreate tf files there.
- Bootstrap: `infrastructure/bootstrap/` — run once per account, local backend, creates S3 + DynamoDB + OIDC role.

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
- Use `dynamic` blocks for DynamoDB GSIs and `for_each` with `{ for g in var.groups : g.name => g }` for Cognito groups.
- DynamoDB: `enable_pitr = false` default (free); set `true` for production.
- Cognito: `deletion_protection` variable, default `"INACTIVE"`; set `"ACTIVE"` for production.
- SSE enabled on all DynamoDB tables (`server_side_encryption { enabled = true }`).

## Module Input Contracts
- `modules/dynamodb`: table_name, billing_mode, hash_key, range_key?, attributes, global_secondary_indexes, tags, env, enable_pitr
- `modules/cognito`: user_pool_name, env, password_policy, allow_self_registration, auto_verified_attributes, username_attributes, groups, deletion_protection, tags

## Outputs Exposed by Production Env (infrastructure/envs/production/outputs.tf)
seed_members_table_arn, seed_members_table_name, members_table_arn, members_table_name,
cognito_user_pool_id, cognito_user_pool_arn, cognito_app_client_id, cognito_issuer_url

## Bootstrap Outputs (infrastructure/bootstrap/outputs.tf)
tf_state_bucket_name, tf_lock_table_name, cicd_role_arn

## AC-001 DynamoDB Tables
- SeedMembersTable-production: hash=pk(S), no SK, no GSIs. Holds legacy DNI roster.
- MembersTable-production: hash=pk(S), range=sk(S). GSIs: GSI_DNI(dni), GSI_Email(email), GSI_CognitoSub(cognito_user_id) — all KEYS_ONLY.

## CI/CD — GitHub Actions
- Workflow file: `.github/workflows/terraform-production.yml`
- Trigger: push/PR to main, paths `infrastructure/**`
- Jobs: `terraform-plan` (always) + `terraform-apply` (push to main only, exitcode=2 only)
- OIDC: `aws-actions/configure-aws-credentials@v4`, role from `secrets.AWS_ROLE_ARN`
- Backend config at init via `-backend-config` flags from `secrets.TF_BACKEND_BUCKET` and `secrets.TF_BACKEND_DYNAMODB_TABLE`
- Apply job uses `environment: production` for manual approval gate.
- Required GitHub secrets: `AWS_ROLE_ARN`, `TF_BACKEND_BUCKET`, `TF_BACKEND_DYNAMODB_TABLE`

## Security Rules
- No AWS Secrets Manager (cost). Use SSM Parameter Store (Standard, free).
- No static IAM access keys. OIDC only for GitHub Actions.
- S3 buckets private; CloudFront OAC for frontend access.
- Cognito app client: no secret, ALLOW_USER_PASSWORD_AUTH + ALLOW_USER_SRP_AUTH + ALLOW_REFRESH_TOKEN_AUTH.
- `allow_admin_create_user_only = true` (self-registration disabled — DNI match required first).
- OIDC trust policy sub: `repo:<ORG>/<REPO>:ref:refs/heads/main` (main branch only).
- GitHub OIDC thumbprint: `6938fd4d98bab03faadb97b34396831e3780aea1` (refresh if GitHub rotates TLS chain).
