# Backend — ActivaClub

Backend NestJS serverless.
Cada subdirectorio dentro de `services/` es una función Lambda independiente desplegada vía Terraform.

## Arquitectura: Clean Architecture por Módulo

Todos los servicios siguen el mismo esquema interno:

```
<service>/
├── src/
│   ├── application/        # Casos de uso (commands, queries, handlers)
│   │   ├── commands/
│   │   └── queries/
│   ├── domain/             # Entidades, value objects, repositorios (interfaces)
│   │   ├── entities/
│   │   ├── value-objects/
│   │   └── repositories/
│   ├── infrastructure/     # Adaptadores DynamoDB, clientes externos, Lambda handler
│   │   ├── repositories/
│   │   └── handlers/
│   └── presentation/       # Controladores NestJS + DTOs
│       ├── controllers/
│       └── dtos/
├── test/
│   ├── unit/
│   └── integration/
├── package.json
├── tsconfig.json
└── README.md
```

## Servicios

| Servicio       | Nombre Lambda (dev)              | Dominio                                    |
|----------------|----------------------------------|--------------------------------------------|
| members        | activa-club-members-dev          | Incorporación de socios, auth, perfil      |
| reservations   | activa-club-reservations-dev     | Reservas de áreas, turnos, capacidad       |
| payments       | activa-club-payments-dev         | Checkout Stripe, webhooks, facturación     |
| promotions     | activa-club-promotions-dev       | CRUD de promociones, difusión SNS          |
| guests         | activa-club-guests-dev           | Registro de invitados, códigos de acceso   |
| areas          | activa-club-areas-dev            | Catálogo de áreas y configuración de horarios |
| admin          | activa-club-admin-dev            | Consultas admin, analíticas, gestión       |

## Librerías Compartidas (`libs/`)

| Librería   | Propósito                                                  |
|------------|------------------------------------------------------------|
| auth       | Validación JWT Cognito, guards RBAC, decoradores           |
| dto        | DTOs compartidos de request/response y schemas Zod         |
| logging    | Logging estructurado (patrón AWS Lambda PowerTools)        |
| utils      | Helpers de fecha, paginación, constructores de respuesta   |
| dynamodb   | Factory de DynamoDBDocumentClient, repositorio base        |
| errors     | Clases de error de dominio y mapeadores de excepciones HTTP|

## Desarrollo Local

Dos puntos de entrada disponibles según el caso de uso:

| Modo | Comando | Puerto | Entry point | Módulo |
|------|---------|--------|-------------|--------|
| **Members standalone** (recomendado) | `nest start members --watch` | 3001 | `services/members/src/main.ts` | `MembersModule` |
| **App combinada** | `npm run start:dev` | 3000 | `src/main.ts` | `AppModule` |

```bash
# Instalar todas las dependencias (desde backend/)
npm install

# Ejecutar el servicio members standalone
nest start members --watch
# API:     http://localhost:3001/v1
# Swagger: http://localhost:3001/api/docs

# Ejecutar con debugger (conectar VS Code al puerto 9229)
nest start members --debug --watch

# Ejecutar todos los tests unitarios
npm test

# Tests de un servicio específico
npm test -- --testPathPattern="services/members"

# Con cobertura
npm run test:cov -- --testPathPattern="services/members"
```

## Convención del Lambda Handler

Cada servicio expone un export `handler` desde `src/infrastructure/handlers/lambda.handler.ts`
usando `@vendia/serverless-express`. El handler cachea la app NestJS bootstrapeada entre invocaciones calientes.

## Estado de Implementación

| Servicio       | Estado         | Historias                                |
|----------------|----------------|------------------------------------------|
| members        | Implementado   | AC-001 a AC-010 (EP-01 completo)         |
| reservations   | Scaffolded     | —                                        |
| payments       | Scaffolded     | —                                        |
| promotions     | Scaffolded     | —                                        |
| guests         | Scaffolded     | —                                        |
| areas          | Scaffolded     | —                                        |
| admin          | Scaffolded     | —                                        |

## Variables de Entorno

Cada servicio tiene su propio `.env` en `services/<nombre>/.env` para desarrollo local.
En producción, todos los valores son inyectados por Terraform vía configuración de entorno de Lambda.
Los secretos (Stripe) se obtienen en runtime desde AWS SSM Parameter Store.

| Variable | Usado por | Descripción |
|----------|-----------|-------------|
| `PORT` | Todos (local) | Puerto del servidor HTTP local |
| `ENV` | Todos | `local` / `dev` / `production` |
| `DYNAMODB_REGION` | Todos | Región AWS para DynamoDB |
| `MEMBERS_TABLE_NAME` | members | Tabla DynamoDB de perfiles |
| `SEED_MEMBERS_TABLE_NAME` | members | Datos pre-cargados de DNI (solo lectura) |
| `COGNITO_USER_POOL_ID` | members | ID del Cognito User Pool |
| `COGNITO_CLIENT_ID` | members | ID del App Client de Cognito |
| `STRIPE_SECRET_KEY` | payments (SSM) | Clave secreta de Stripe |
| `STRIPE_WEBHOOK_SECRET` | payments (SSM) | Secreto de firma del webhook de Stripe |
| `SNS_PROMOTIONS_TOPIC_ARN` | promotions | ARN del tópico SNS de promociones |
