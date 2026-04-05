# Módulo Terraform: api-gateway

Crea un Amazon API Gateway HTTP API con:
- Autorizador JWT respaldado por Amazon Cognito
- Definición de rutas que mapean método HTTP + ruta a integraciones Lambda
- Despliegue de stage (default: `$default` para HTTP APIs)
- Logging de acceso en CloudWatch

## Entradas

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `api_name` | string | Nombre del API Gateway |
| `cognito_issuer_url` | string | URL del emisor del Cognito User Pool para el autorizador JWT |
| `cognito_audience` | list(string) | IDs del App Client de Cognito |
| `routes` | list(object) | Definiciones de ruta (method, path, lambda_invoke_arn, auth_required) |
| `cors_origins` | list(string) | Orígenes CORS permitidos |
| `stage_name` | string | Nombre del stage (default: `dev`) |
| `tags` | map(string) | Tags de recursos AWS |

## Salidas

| Salida | Descripción |
|--------|-------------|
| `api_id` | ID del API Gateway |
| `api_endpoint` | URL base del API |

## Convención de Rutas

Todas las rutas siguen el patrón: `<MÉTODO> /v1/<recurso>`

La ruta del webhook de Stripe (`POST /v1/payments/webhook`) se configura sin el autorizador JWT para permitir que Stripe la llame sin token Cognito. La verificación de la firma del request de Stripe se realiza dentro del Lambda.

## Configuración CORS

CORS se configura a nivel de API Gateway para el dominio CloudFront del frontend.
En dev, `http://localhost:5173` se agrega a los orígenes permitidos.
