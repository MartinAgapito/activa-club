# Librería: utils

Funciones utilitarias de uso general compartidas por todos los servicios de ActivaClub.

## Contenido

- `date.utils.ts` — Formateo de fechas, normalización de zona horaria (America/Argentina/Buenos_Aires), generación de turnos
- `pagination.utils.ts` — Codificación/decodificación de `LastEvaluatedKey` de DynamoDB a cursor
- `response.utils.ts` — Constructor de respuestas HTTP en el formato de envelope estándar
- `id.utils.ts` — Generación de IDs basados en ULID para ítems de DynamoDB
- `access-code.utils.ts` — Generador de códigos de acceso únicos para invitados (numérico + string compatible con QR)

## Estrategia de IDs

Todas las claves primarias usan ULIDs (vía paquete `ulid`) por:
- Orden lexicográfico (prefijo temporal)
- Caracteres seguros para URLs
- Sin colisiones, sin coordinación central
