# API Documentation

OpenAPI specifications and API reference documentation for ActivaClub.

## Approach

The primary API documentation lives inline in each service's NestJS controllers
via `@nestjs/swagger` decorators. This directory holds:
- Exported OpenAPI JSON/YAML snapshots (generated from the running service)
- Manual API references for non-NestJS endpoints (e.g., Stripe webhook payloads)

## Files (to be added as services are implemented)

| File                      | Description                               |
|---------------------------|-------------------------------------------|
| `members.openapi.yaml`    | Members service OpenAPI spec              |
| `reservations.openapi.yaml` | Reservations service OpenAPI spec       |
| `payments.openapi.yaml`   | Payments service OpenAPI spec             |
| `promotions.openapi.yaml` | Promotions service OpenAPI spec           |
| `guests.openapi.yaml`     | Guests service OpenAPI spec               |
| `areas.openapi.yaml`      | Areas service OpenAPI spec                |
| `admin.openapi.yaml`      | Admin service OpenAPI spec                |

## Generating the Spec

Each NestJS service exposes a Swagger UI at `/docs` during local development.
To export:
```bash
# From the service directory
npm run export:openapi
```
This outputs the spec to `docs/api/<service>.openapi.yaml`.

## Base URL

| Environment | Base URL                                              |
|-------------|-------------------------------------------------------|
| Dev         | `https://<api-id>.execute-api.<region>.amazonaws.com` |
| Local       | `http://localhost:3000`                               |

All endpoints are prefixed with `/v1`.
