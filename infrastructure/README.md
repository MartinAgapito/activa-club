# Infraestructura — ActivaClub

IaC Terraform para todos los recursos AWS que potencian ActivaClub.
Ningún recurso se crea desde la consola de AWS. Todo está definido aquí.

## Advertencia de Costos

Los siguientes servicios están dentro del Free Tier de AWS para la carga de trabajo esperada de la tesis:
- Lambda: 1M requests/mes gratis
- DynamoDB: 25 GB de almacenamiento, 25 WCU/RCU provisionadas gratis
- API Gateway HTTP API: 1M requests/mes gratis
- Cognito: 50.000 MAU gratis
- SNS: 1M publicaciones/mes gratis

Servicios que PUEDEN generar costo:
- CloudFront: 1 TB/mes gratis, pero las invalidaciones > 1000/mes se cobran.
- S3: 5 GB gratis; imágenes/uploads pueden superar este límite.

## Estructura de Directorios

```
infrastructure/
├── modules/                  # Módulos Terraform reutilizables
│   ├── dynamodb/             # Tablas DynamoDB + GSIs
│   ├── lambda/               # Función Lambda + rol IAM
│   ├── api-gateway/          # HTTP API + rutas + integraciones + autorizador
│   ├── cognito/              # User Pool + App Client + Grupos
│   ├── sns/                  # Tópicos SNS + suscripciones
│   └── s3-cloudfront/        # Bucket S3 + distribución CloudFront
├── envs/
│   ├── dev/                  # Overlay del ambiente de desarrollo
│   └── prd/                  # Overlay del ambiente de producción
└── README.md
```

## Resumen de Módulos

| Módulo | Recursos Creados |
|--------|-----------------|
| `dynamodb` | Tabla DynamoDB con GSIs, TTL, recuperación point-in-time |
| `lambda` | Función Lambda, rol IAM, grupo de logs CloudWatch |
| `api-gateway` | HTTP API, autorizador JWT (Cognito), rutas, stages |
| `cognito` | User Pool, App Client, Grupos (Admin/Manager/Member) |
| `sns` | Tópico de promociones, suscripciones de email opcionales |
| `s3-cloudfront` | Bucket S3 (SPA + assets), distribución CloudFront |

## Uso

```bash
cd infrastructure/envs/dev
terraform init
terraform plan -var-file="terraform.tfvars"
terraform apply -var-file="terraform.tfvars"
```

## Convenciones de Nombres

| Recurso | Patrón |
|---------|--------|
| Lambda | `activa-club-<service>-<env>` |
| Tabla DynamoDB | `<PascalCase>Table-<env>` |
| Rol IAM | `activa-club-<service>-role-<env>` |
| Tópico SNS | `activa-club-<topic>-<env>` |
| Bucket S3 | `activa-club-<purpose>-<account_id>-<env>` |

## Backend de Estado Remoto

Configurar estado remoto en el `main.tf` de cada ambiente:
```hcl
terraform {
  backend "s3" {
    bucket         = "activa-club-tfstate-<account_id>"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "activa-club-tfstate-lock"
  }
}
```
Este bucket S3 NO es provisionado por este repositorio. Crearlo manualmente una sola vez antes del primer apply.

## IAM de Mínimo Privilegio

Cada Lambda tiene su propio rol IAM que otorga únicamente:
- `dynamodb:GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Query`, `Scan` sobre sus propias tablas
- `ssm:GetParameter` para obtener secretos
- `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents`
- Específico por servicio: `sns:Publish` para Lambda de promotions, `s3:PutObject` para Lambda de admin
