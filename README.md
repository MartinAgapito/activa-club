# ActivaClub

Plataforma web serverless para un club recreativo, construida sobre AWS.
Este repositorio contiene el monorepo completo: backend, frontend, infraestructura y documentación.

## Descripción General

ActivaClub gestiona:
- Incorporación de socios mediante validación de DNI contra datos pre-cargados del sistema legado
- Planes de membresía (VIP / Gold / Silver) que rigen las reglas de reserva
- Reservas de áreas recreativas con control de capacidad y horarios
- Registro de invitados con códigos de acceso únicos (QR + numérico)
- Pagos de membresía (renovación mensual y anual) vía Stripe
- Promociones creadas por Managers y difundidas a todos los socios vía SNS
- Notificaciones a través de tópicos de Amazon SNS
- Panel de administración que cubre socios, reservas, pagos, analíticas y notificaciones
- Bot FAQ (base de conocimiento de solo lectura)

## Roles (RBAC)

| Rol     | Grupo Cognito | Capacidades                                          |
|---------|---------------|------------------------------------------------------|
| Admin   | Admin         | Acceso completo, gestión de usuarios, analíticas     |
| Manager | Manager       | Crear y gestionar promociones, ver reportes          |
| Member  | Member        | Reservas, invitados, pagos, ver promociones          |

## Stack Tecnológico

| Capa           | Tecnología                                     |
|----------------|------------------------------------------------|
| Cloud          | AWS (prioridad Free Tier)                      |
| IaC            | Terraform                                      |
| Backend        | NestJS (serverless, una Lambda por módulo)     |
| Cómputo        | AWS Lambda                                     |
| API            | Amazon API Gateway HTTP API                    |
| Base de datos  | Amazon DynamoDB (diseño multi-tabla)           |
| Autenticación  | Amazon Cognito (User Pool + Groups)            |
| Pagos          | Stripe (sandbox → producción)                  |
| Notificaciones | Amazon SNS                                     |
| Frontend       | React + TypeScript (Vite, Shadcn/ui, Tailwind) |
| Estado global  | Zustand + React Query                          |

## Estructura del Repositorio

```
activa-club/
├── backend/          # Backend NestJS serverless (una Lambda por servicio)
├── frontend/         # SPA React + TypeScript (Vite)
├── infrastructure/   # IaC Terraform (módulos + overlays por ambiente)
├── docs/             # Diagramas de arquitectura y docs de diseño por historia
├── backlog/          # Historias de usuario y documentos de producto (Scrum)
├── scripts/          # Utilidades de seed e importación de datos
└── README.md
```

## Inicio Rápido

Ver el README de cada subdirectorio para instrucciones de configuración:

- [Backend](./backend/README.md)
- [Frontend](./frontend/README.md)
- [Infraestructura](./infrastructure/README.md)
- [Documentación](./docs/README.md)
- [Backlog](./backlog/README.md)

## Convenciones de Nombres

| Artefacto       | Patrón                                           | Ejemplo                          |
|-----------------|--------------------------------------------------|----------------------------------|
| Tabla DynamoDB  | `PascalCaseTable`                                | `MembersTable`                   |
| Lambda function | `activa-club-<service>-<env>`                    | `activa-club-members-dev`        |
| Rutas de API    | `/v1/<resource>`                                 | `/v1/members`                    |
| Módulo Terraform| `<resource-type>` dentro de `infrastructure/modules/` | `dynamodb`, `lambda`        |

## Diagramas de Arquitectura

Ver [`docs/architecture/`](./docs/architecture/) para diagramas Mermaid y Draw.io.

## Estado del Proyecto (EP-01 completado)

| Historia | Título | Estado |
|----------|--------|--------|
| AC-001 | Importación de datos seed desde sistema legado | Implementado |
| AC-002 | Registro de socio — validación DNI y creación de cuenta | Implementado |
| AC-003 | Registro de socio — verificación de email y creación de perfil | Implementado |
| AC-004 | Reenvío de código de verificación | Implementado |
| AC-005 | Login de socio — validación de credenciales | Implementado |
| AC-006 | Login de socio — verificación OTP y emisión de tokens JWT | Implementado |
| AC-007 | Frontend — flujo completo de autenticación | Implementado |
| AC-008 | Logout del socio — revocación de tokens | Implementado |
| AC-009 | Redirección post-login según rol | Implementado |
| AC-010 | Recordar dispositivo — omisión de OTP en dispositivos confiables | Implementado |

## CI/CD

| Workflow | Trigger | Descripción |
|----------|---------|-------------|
| `ci.yml` | Push / PR a cualquier rama | Lint, type-check, tests unitarios |
| `terraform-dev.yml` | Push a `main` | Terraform plan + apply en `dev` |
| `terraform-prd.yml` | Push a `main` (aprobación manual) | Terraform plan + apply en producción |
| `deploy-members-dev.yml` | Push a `main` | Build + deploy Lambda members a `dev` |
| `deploy-members-prd.yml` | Push a `main` (aprobación manual) | Build + deploy Lambda members a `prd` |
| `deploy-frontend-dev.yml` | Push a `main` | Build + deploy SPA a S3/CF `dev` |
| `deploy-frontend-prd.yml` | Push a `main` (aprobación manual) | Build + deploy SPA a S3/CF `prd` |

## Ejecución Local

```bash
# Backend (NestJS)
cd backend
npm install
npm run start:dev

# Frontend (React + Vite)
cd frontend
npm install
cp .env   # completar con valores reales de Cognito
npm run dev

# Seed de socios del sistema legado (dev)
cd scripts
npx ts-node seed-legacy-members.ts --env dev --file ./data/legacy-members.json
```
