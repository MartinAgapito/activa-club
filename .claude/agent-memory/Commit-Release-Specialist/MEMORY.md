# Commit & Release Specialist - MEMORY

## MANDATORY Commit Style Rules (user-enforced, never override)

- NO Co-Authored-By: never add "Co-Authored-By: Claude" or any Anthropic reference in any commit.
- NO emojis: never use gitmojis or any emoji in commit messages.
- Strict format: `type(scope): lowercase description`
- Messages in English, plain text, professional tone.



### MANDATORY FORMAT
```
type(scope): lowercase description in english
```

### ALLOWED TYPES (only these)
- `feat` — new feature
- `fix` — bug fix
- `chore` — maintenance, cleanup, configuration tasks
- `docs` — documentation
- `refactor` — refactoring without behavior change
- `test` — tests
- `ci` — CI/CD pipelines and workflows

### Correct examples
```
chore(infra): tear down all AWS infrastructure and reset to zero
feat(auth): add cognito user pool configuration
fix(dynamodb): correct table billing mode
docs(members): add user story AC-001
```

### Incorrect examples (never do)
```
chore(infra): 🔨 tear down all AWS infrastructure    <- emoji forbidden
feat(auth): ✨ Add Cognito User Pool Configuration   <- emoji + uppercase forbidden
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>  <- reference forbidden
```

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
1. `chore(infra)` — bootstrap resources (S3 state, DynamoDB lock, IAM/OIDC)
2. `feat(<scope>)` — reusable modules (one commit per module)
3. `feat(infra)` — environment composition wiring the modules
4. `ci(infra)` — GitHub Actions workflows
5. `chore(repo)` — placeholder/cleanup changes
6. `docs(<scope>)` — user stories and technical design docs
7. `chore(repo)` — agent memory, settings, lock files

## Scope mapping confirmed in use
- `infra` — Terraform environments, bootstrap, cross-cutting AWS resources
- `auth` — Cognito module and auth-related infrastructure
- `cognito` — Cognito-specific infrastructure and configuration
- `members` — DynamoDB module, member domain docs
- `repo` — root config, agent memory, lock files, placeholders
- `agents` — agent memory and configuration files
- `github-actions` — GitHub Actions workflow files
