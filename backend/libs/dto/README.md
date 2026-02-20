# Lib: dto

Shared Data Transfer Objects and validation schemas used across all ActivaClub services.

## Contents

- `pagination.dto.ts` - Generic `PaginatedRequest` and `PaginatedResponse<T>` types
- `common-response.dto.ts` - Standard envelope `{ data, meta, error }`
- `member.dto.ts` - Shared member-related DTOs imported by multiple services
- `schemas/` - Zod schemas for runtime validation at Lambda entry points

## Conventions

- All DTOs are plain TypeScript classes decorated with `class-validator` annotations.
- Zod schemas are co-located and used for Lambda event body validation before hitting NestJS pipes.
- Field names use `camelCase` in TypeScript and map to DynamoDB attribute names via the repository layer.
