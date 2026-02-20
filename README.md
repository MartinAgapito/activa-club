# ActivaClub

Serverless web platform for a recreational club, built on AWS.
This repository contains the full-stack monorepo: backend, frontend, infrastructure, and documentation.

## System Overview

ActivaClub manages:
- Member onboarding via DNI matching against pre-seeded legacy data
- Membership tiers (VIP / Gold / Silver) that govern reservation rules
- Recreational area reservations with capacity and schedule enforcement
- Guest registration with unique access codes (QR + numeric)
- Membership payments (monthly auto-renewal and annual) via Stripe
- Promotions created by Managers and broadcast to all members via SNS
- Notifications through Amazon SNS topics
- Admin dashboard covering members, reservations, payments, analytics, and notifications
- FAQ bot (read-only FAQ knowledge base)

## Roles (RBAC)

| Role    | Cognito Group | Capabilities                                      |
|---------|---------------|---------------------------------------------------|
| Admin   | Admin         | Full platform access, user management, analytics  |
| Manager | Manager       | Create and manage promotions, view reports        |
| Member  | Member        | Reservations, guests, payments, promotions view   |

## Tech Stack

| Layer          | Technology                                  |
|----------------|---------------------------------------------|
| Cloud          | AWS (Free Tier priority)                    |
| IaC            | Terraform                                   |
| Backend        | NestJS (serverless, one Lambda per module)  |
| Compute        | AWS Lambda                                  |
| API Layer      | Amazon API Gateway HTTP API                 |
| Database       | Amazon DynamoDB (multi-table design)        |
| Auth           | Amazon Cognito (User Pool + Groups)         |
| Payments       | Stripe (sandbox -> production)              |
| Notifications  | Amazon SNS                                  |
| Frontend       | React + TypeScript (Vite, Shadcn/ui, TW)    |
| State Mgmt     | Zustand + React Query                       |

## Repository Layout

```
activa-club/
├── backend/          # NestJS serverless backend (one Lambda per service)
├── frontend/         # React + TypeScript SPA (Vite)
├── infrastructure/   # Terraform IaC (modules + environment overlays)
├── docs/             # Architecture diagrams and per-story design docs
├── backlog/          # Scrum user stories and product documents
├── scripts/          # Seed and data-import utilities
└── README.md
```

## Getting Started

See each sub-directory's README for setup instructions:

- [Backend](./backend/README.md)
- [Frontend](./frontend/README.md)
- [Infrastructure](./infrastructure/README.md)
- [Docs](./docs/README.md)
- [Backlog](./backlog/README.md)

## Naming Conventions

| Artifact        | Pattern                                        | Example                          |
|-----------------|------------------------------------------------|----------------------------------|
| DynamoDB Table  | `PascalCaseTable`                              | `MembersTable`                   |
| Lambda function | `activa-club-<service>-<env>`                  | `activa-club-members-dev`        |
| API routes      | `/v1/<resource>`                               | `/v1/members`                    |
| Terraform module| `<resource-type>` inside `infrastructure/modules/` | `dynamodb`, `lambda`         |

## Architecture Diagrams

See [`docs/architecture/`](./docs/architecture/) for Mermaid and Draw.io diagrams.
