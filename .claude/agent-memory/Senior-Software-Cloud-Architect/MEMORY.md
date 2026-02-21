# Architect Memory - ActivaClub

## Repository Root
`C:/Users/Martin/Desktop/Tesis` (Windows path, use Unix forward-slash in bash tools)

## Confirmed Project Structure
Initialized 2026-02-20. All top-level directories and READMEs exist.
See `patterns.md` for full layout and conventions.

## Key Architectural Decisions (locked)
- Backend: NestJS, one Lambda per service (7 services)
- API: API Gateway HTTP API (NOT REST API)
- DB: DynamoDB multi-table (6 tables, PascalCaseTable naming)
- Auth: Cognito User Pool, Groups: Admin / Manager / Member
- IaC: Terraform only in `/infrastructure`
- Frontend: React+Vite, Zustand+React Query, Shadcn/ui+Tailwind
- Payments: Stripe (sandbox), webhook at POST /v1/payments/webhook (no JWT authorizer)
- Notifications: Amazon SNS

## Naming Conventions
- Lambda: `activa-club-<service>-<env>`
- DynamoDB: `PascalCaseTable` (e.g., MembersTable)
- Routes: `/v1/<resource>`
- Terraform module dirs: lowercase hyphenated (e.g., `api-gateway`, `s3-cloudfront`)
- Story design docs: `docs/design/AC-XXX-design.md`

## DynamoDB PK Pattern
All tables use composite PK/SK with prefix pattern:
- PK: `<ENTITY_TYPE>#<ulid>` (e.g., `MEMBER#01J...`)
- SK: contextual (e.g., `PROFILE`, `METADATA`, `MEMBER#<id>`)

## Free Tier Warnings
- CloudFront: invalidations >1000/month charged
- S3: 5 GB free (images/uploads can exceed)
- SNS email delivery: $2/100k notifications

## Registration Flow (AC-001) — Key Decisions
- POST /v1/auth/register is PUBLIC (no JWT authorizer on API Gateway route)
- Cognito: AdminCreateUser + AdminSetUserPassword (Permanent:true) + AdminAddUserToGroup("Member")
- Rollback: if DynamoDB PutItem fails after Cognito user created, call AdminDeleteUser
- SeedMembersTable PK pattern: `DNI#<dni>` (no SK), read-only, GetItem only
- MembersTable GSIs: GSI_DNI (dni), GSI_Email (email), GSI_CognitoSub (cognito_user_id)
- Error envelope: { status, error: { code, message, details[] } } — same for all services
- Two public routes total: POST /v1/auth/register + POST /v1/payments/webhook

## Design Doc Template (11 sections, confirmed in AC-001)
Sections: Overview, System Context, DynamoDB Schema, API Contract, Architecture Flow (Mermaid sequenceDiagram), Lambda Design (Clean Arch file tree + key types), Cognito Config, Security, Terraform, Frontend Changes, Open Questions

## Links to Detail Files
- `patterns.md` - Full directory tree, service map, Clean Architecture layers
