# Backlog - ActivaClub

Product backlog for the ActivaClub platform.
Managed by the Senior Product Owner agent.

## Structure

```
backlog/
├── README.md           # This file
├── epics/              # High-level epics grouping related stories
└── stories/            # Individual user story files (AC-XXX.md)
```

## Story Naming Convention

Stories are named `AC-XXX.md` where `XXX` is a zero-padded sequential number.
Example: `AC-001.md`, `AC-002.md`, `AC-010.md`

## Story File Format

Each story file follows this template:

```markdown
# AC-XXX: Story Title

**Epic:** <Epic name>
**Priority:** High / Medium / Low
**Story Points:** <estimate>
**Status:** Backlog / In Progress / Done

## User Story
As a <role>, I want to <action> so that <benefit>.

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Notes
<Architecture / design notes>

## Design Document
Link to: docs/design/AC-XXX-design.md
```

## Epics

| Epic ID | Name                        | Description                                      |
|---------|-----------------------------|--------------------------------------------------|
| EP-01   | Member Onboarding           | DNI matching, account creation, Cognito setup    |
| EP-02   | Reservations                | Area booking, availability, capacity management  |
| EP-03   | Guest Management            | Guest registration, access codes, entry control  |
| EP-04   | Payments & Billing          | Stripe integration, monthly/annual plans         |
| EP-05   | Promotions                  | Manager-driven promotions, SNS broadcast         |
| EP-06   | Admin Dashboard             | Analytics, user management, reports              |
| EP-07   | Notifications               | SNS subscriptions, membership/payment alerts     |
| EP-08   | FAQ Bot                     | Read-only FAQ interface                          |

## Stories

| ID     | Título                                                  | Epic  | Prioridad | Puntos | Estado  |
|--------|---------------------------------------------------------|-------|-----------|--------|---------|
| AC-001 | Importación de datos seed desde sistema legado          | EP-01 | Alta      | 3      | Backlog |
| AC-002 | Registro de socio — validación DNI y creación de cuenta                    | EP-01 | Alta      | 5      | Done    |
| AC-003 | Registro de socio — verificación de email por link y creación de perfil    | EP-01 | Alta      | 5      | Done    |
| AC-004 | Reenvío de link de verificación de email                                   | EP-01 | Media     | 2      | Done    |
| AC-005 | Login de socio — validación de credenciales                                | EP-01 | Alta      | 3      | Done    |
| AC-006 | Login de socio — verificación OTP y emisión de tokens JWT                  | EP-01 | Alta      | 3      | Done    |
| AC-007 | Frontend — flujo completo de autenticación                                 | EP-01 | Alta      | 5      | Done    |
| AC-008 | Logout del socio — cierre de sesión con revocación de tokens               | EP-01 | Alta      | 3      | Backlog |
| AC-009 | Redirección post-login según rol                                           | EP-01 | Alta      | 2      | Backlog |
