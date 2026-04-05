# Servicio: areas

Lambda: `activa-club-areas-dev`
Tabla: `AreasTable`

## Responsabilidad

Catálogo de áreas recreativas y configuración de horarios:
- Definición de áreas (nombre, descripción, capacidad, amenidades)
- Configuración de horarios (horario de apertura, fechas bloqueadas)
- Reglas de capacidad por plan de membresía
- Gestión de imágenes de áreas (referencias a S3)

## Estructura Clean Architecture

```
src/
├── application/
│   ├── commands/
│   │   ├── create-area.command.ts
│   │   ├── update-area.command.ts
│   │   ├── deactivate-area.command.ts
│   │   └── set-area-schedule.command.ts
│   └── queries/
│       ├── get-area-by-id.query.ts
│       └── list-active-areas.query.ts
├── domain/
│   ├── entities/
│   │   └── area.entity.ts
│   ├── value-objects/
│   │   ├── area-status.vo.ts         # Active | Inactive | Maintenance
│   │   ├── schedule.vo.ts            # Horario de apertura, duración de turno
│   │   └── capacity-rule.vo.ts
│   └── repositories/
│       └── area.repository.interface.ts
├── infrastructure/
│   ├── repositories/
│   │   └── area.dynamo.repository.ts
│   └── handlers/
│       └── lambda.handler.ts
└── presentation/
    ├── controllers/
    │   └── areas.controller.ts
    └── dtos/
        ├── create-area.dto.ts
        └── area-response.dto.ts
```

## Endpoints de la API

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | /v1/areas | Member+ | Listar todas las áreas activas |
| GET | /v1/areas/:id | Member+ | Detalle y horario de un área |
| POST | /v1/areas | Admin | Crear nueva área |
| PATCH | /v1/areas/:id | Admin | Actualizar datos del área |
| DELETE | /v1/areas/:id | Admin | Desactivar área |
| PUT | /v1/areas/:id/schedule | Admin | Configurar horario del área |

## DynamoDB: AreasTable

| Atributo | Tipo | Notas |
|----------|------|-------|
| `PK` | String | `AREA#<areaId>` |
| `SK` | String | `METADATA` |
| `areaId` | String | ULID |
| `name` | String | |
| `description` | String | |
| `capacity` | Number | Máximo de usuarios concurrentes |
| `slotDuration` | Number | Minutos por turno (ej. 60) |
| `openingTime` | String | HH:MM |
| `closingTime` | String | HH:MM |
| `amenities` | List | Lista de etiquetas de amenidades |
| `imageUrls` | List | URLs de S3/CloudFront |
| `status` | String | Active / Inactive / Maintenance |
| `cancelWindow` | Number | Horas antes del turno en que cierra la cancelación |
| `createdAt` | String | ISO 8601 |

GSI: `GSI_Status` — PK: `status` (filtrar áreas activas de forma eficiente)
