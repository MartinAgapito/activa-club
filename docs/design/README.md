# Design Documents

Per-story technical design documents for ActivaClub.

## Naming Convention

Each document is named after the backlog item it covers:

```
AC-XXX-design.md
```

Where `XXX` is the zero-padded backlog item number (e.g., `AC-001-design.md`).

## Required Sections (per document)

1. **Overview** - What changes, why, scope
2. **Services Impacted** - Which Lambda functions are affected
3. **API Contract** - HTTP method, path, request body, response body, error codes
4. **DynamoDB Changes** - New tables, new attributes, new GSIs
5. **AuthZ Rules** - Which Cognito groups can call which endpoints
6. **Terraform Changes** - New or modified infrastructure resources
7. **Frontend Changes** - New pages, components, or API client changes
8. **Edge Cases** - Business rules, failure modes, limits, debt scenarios

## Index

| Story  | Title                              | Status   |
|--------|------------------------------------|----------|
| AC-001 | (first story - to be defined)      | Pending  |

Add rows as stories are designed.
