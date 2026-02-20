# Lib: utils

General-purpose utility functions shared across all ActivaClub services.

## Contents

- `date.utils.ts` - Date formatting, timezone normalization (America/Argentina/Buenos_Aires), slot generation
- `pagination.utils.ts` - DynamoDB `LastEvaluatedKey` to cursor encoding/decoding
- `response.utils.ts` - HTTP response builder matching the standard envelope format
- `id.utils.ts` - ULID-based ID generation for DynamoDB items
- `access-code.utils.ts` - Unique guest access code generator (numeric + QR-friendly string)

## ID Strategy

All primary keys use ULIDs (via `ulid` package) for:
- Lexicographic sort order (time-prefixed)
- URL-safe characters
- Collision-free without coordination
