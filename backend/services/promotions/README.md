# Servicio: promotions

Lambda: `activa-club-promotions-dev`
Tabla: `PromotionsTable`

## Responsabilidad

Promociones gestionadas por Managers y difusión vía SNS:
- CRUD de promociones (crear, leer, actualizar, eliminar)
- Publicación en tópico SNS para difundir a todos los socios suscritos
- Programación y vencimiento de promociones
- Feed de promociones activas para socios

## Estructura Clean Architecture

```
src/
├── application/
│   ├── commands/
│   │   ├── create-promotion.command.ts
│   │   ├── update-promotion.command.ts
│   │   ├── delete-promotion.command.ts
│   │   └── broadcast-promotion.command.ts
│   └── queries/
│       ├── get-promotion-by-id.query.ts
│       └── list-active-promotions.query.ts
├── domain/
│   ├── entities/
│   │   └── promotion.entity.ts
│   ├── value-objects/
│   │   ├── promotion-status.vo.ts    # Draft | Active | Expired | Cancelled
│   │   └── promotion-target.vo.ts    # All | VIP | Gold | Silver
│   └── repositories/
│       └── promotion.repository.interface.ts
├── infrastructure/
│   ├── repositories/
│   │   └── promotion.dynamo.repository.ts
│   ├── sns/
│   │   └── sns.client.ts
│   └── handlers/
│       └── lambda.handler.ts
└── presentation/
    ├── controllers/
    │   └── promotions.controller.ts
    └── dtos/
        ├── create-promotion.dto.ts
        └── promotion-response.dto.ts
```

## Endpoints de la API

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | /v1/promotions | Manager+ | Crear promoción |
| GET | /v1/promotions | Member+ | Listar promociones activas |
| GET | /v1/promotions/:id | Member+ | Detalle de promoción |
| PATCH | /v1/promotions/:id | Manager+ | Actualizar promoción |
| DELETE | /v1/promotions/:id | Admin | Eliminar promoción |
| POST | /v1/promotions/:id/broadcast | Manager+ | Publicar en tópico SNS |

## DynamoDB: PromotionsTable

| Atributo | Tipo | Notas |
|----------|------|-------|
| `PK` | String | `PROMOTION#<promotionId>` |
| `SK` | String | `METADATA` |
| `promotionId` | String | ULID |
| `title` | String | |
| `description` | String | |
| `imageUrl` | String | URL de S3/CloudFront |
| `target` | String | All / VIP / Gold / Silver |
| `status` | String | Draft / Active / Expired / Cancelled |
| `startsAt` | String | ISO 8601 |
| `expiresAt` | String | ISO 8601 |
| `createdBy` | String | memberId del Manager |
| `broadcastAt` | String | Timestamp del último publish SNS |

GSI: `GSI_Status` — PK: `status`, SK: `startsAt` (listar activas ordenadas por fecha)

## Integración SNS

- Tópico: `activa-club-promotions-<env>`
- Los atributos del mensaje incluyen `membershipTier` para filtros en los suscriptores.
- Los socios se suscriben al tópico al registrarse (endpoint de email o push).
