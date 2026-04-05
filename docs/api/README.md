# Documentación de la API — ActivaClub

Especificaciones OpenAPI y documentación de referencia de la API de ActivaClub.

## Enfoque

La documentación primaria de la API vive inline en cada controlador NestJS del servicio
mediante decoradores `@nestjs/swagger`. Este directorio contiene:
- Snapshots exportados de OpenAPI JSON/YAML (generados desde el servicio en ejecución)
- Referencias manuales para endpoints no NestJS (ej. payloads de webhooks de Stripe)

## Archivos (se agregan a medida que se implementan los servicios)

| Archivo | Descripción |
|---------|-------------|
| `members.openapi.yaml` | Spec OpenAPI del servicio members |
| `reservations.openapi.yaml` | Spec OpenAPI del servicio reservations |
| `payments.openapi.yaml` | Spec OpenAPI del servicio payments |
| `promotions.openapi.yaml` | Spec OpenAPI del servicio promotions |
| `guests.openapi.yaml` | Spec OpenAPI del servicio guests |
| `areas.openapi.yaml` | Spec OpenAPI del servicio areas |
| `admin.openapi.yaml` | Spec OpenAPI del servicio admin |

## Generar la Spec

Cada servicio NestJS expone una Swagger UI en `/api/docs` durante el desarrollo local.
Para exportar:
```bash
# Desde el directorio del servicio
npm run export:openapi
```
Esto genera la spec en `docs/api/<servicio>.openapi.yaml`.

## URL Base

| Ambiente | URL Base |
|----------|----------|
| Dev | `https://<api-id>.execute-api.<region>.amazonaws.com` |
| Local | `http://localhost:3001` |

Todos los endpoints tienen el prefijo `/v1`.
