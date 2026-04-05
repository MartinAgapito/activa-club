# Librería: dto

Data Transfer Objects compartidos y schemas de validación usados por todos los servicios de ActivaClub.

## Contenido

- `pagination.dto.ts` — Tipos genéricos `PaginatedRequest` y `PaginatedResponse<T>`
- `common-response.dto.ts` — Envelope estándar `{ data, meta, error }`
- `member.dto.ts` — DTOs compartidos relacionados a socios, importados por múltiples servicios
- `schemas/` — Schemas Zod para validación en runtime en los puntos de entrada de Lambda

## Convenciones

- Todos los DTOs son clases TypeScript planas decoradas con anotaciones de `class-validator`.
- Los schemas Zod están co-ubicados y se usan para validar el body del evento Lambda antes de que llegue a los pipes de NestJS.
- Los nombres de campos usan `camelCase` en TypeScript y se mapean a los atributos de DynamoDB en la capa de repositorio.
