# Commit & Release Specialist - MEMORY

## Files NEVER to commit (Terraform artifacts)
- `infrastructure/bootstrap/.terraform/` — provider cache, always local
- `infrastructure/bootstrap/terraform.tfstate` — bootstrap uses local backend intentionally
- `infrastructure/envs/production/.terraform/` — provider cache, always local
- `infrastructure/envs/production/tfplan` — binary plan artifact (uploaded to GH Actions instead)
- Any `*.tfstate` or `*.tfstate.backup` in any env

## Files safe to commit in Terraform
- `*.tf` — all Terraform source files
- `.terraform.lock.hcl` — provider version lock (commit this, it belongs in source control)
- `README.md` files inside module/env directories

## Commit grouping strategy for this project
Order of commits when infrastructure and docs land together:
1. `build(infra)` — bootstrap resources (S3 state, DynamoDB lock, IAM/OIDC)
2. `feat(<scope>)` — reusable modules (one commit per module)
3. `feat(infra)` — environment composition wiring the modules
4. `ci(infra)` — GitHub Actions workflows
5. `chore(repo)` — placeholder/cleanup changes
6. `docs(<scope>)` — user stories and technical design docs
7. `chore(repo)` — agent memory, settings, lock files

## Scope mapping confirmed in use
- `infra` — Terraform environments, bootstrap, cross-cutting AWS resources
- `auth` — Cognito module and auth-related infrastructure
- `members` — DynamoDB module, member domain docs
- `repo` — root config, agent memory, lock files, placeholders
