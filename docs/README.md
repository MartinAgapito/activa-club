# Docs - ActivaClub

Technical documentation for the ActivaClub platform.

## Structure

```
docs/
├── architecture/       # System architecture diagrams and overview
│   ├── architecture.mmd     # Mermaid diagrams (C4-style, auth flow, Stripe, SNS)
│   └── architecture.drawio  # Draw.io diagram file
├── design/             # Per-story technical design documents (AC-XXX-design.md)
└── api/                # OpenAPI specifications (if maintained separately from code)
```

## Design Document Convention

Every backlog item `AC-XXX` that involves code changes gets a corresponding design document:
- Path: `docs/design/AC-XXX-design.md`
- Sections: Overview, Services Impacted, API Contract, DynamoDB Changes, AuthZ Rules, Terraform Changes, Frontend Changes, Edge Cases

## Architecture Documents

- `architecture/architecture.mmd` - Primary Mermaid source for all system diagrams
- `architecture/architecture.drawio` - Draw.io version for presentation/export
